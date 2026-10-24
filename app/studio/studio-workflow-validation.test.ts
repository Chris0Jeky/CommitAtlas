import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { mock, before } from "node:test";
import type { ReactElement } from "react";
import { isValidStudioWorkflowInput } from "./studio-urls";

/**
 * Issue #414: the Studio preview must refuse a malformed workflow identity before any request
 * starts. The first block pins the rule (it is the projects API's own `isWorkflowIdentity`, so
 * C0 and C1 controls are refused too); the second runs the real `StudioClient` submit handler
 * under a minimal hook runtime and observes fetches and state writes.
 */

const C1 = String.fromCharCode(0x85);
const DEL = String.fromCharCode(0x7f);

test("blank workflows are unconfigured and surrounding whitespace is trimmed away", () => {
  for (const workflow of ["", "   ", "\t \n", "ci.yml", "  ci.yml  ", ".github/workflows/release.yml"]) {
    assert.equal(isValidStudioWorkflowInput(workflow), true, JSON.stringify(workflow));
  }
});

test("dot segments and C0, DEL and C1 controls are refused like the projects API refuses them", () => {
  const rejected = ["..", ".", "../ci.yml", "a/./b", ".github\\..\\ci.yml", "ci\x00.yml", "ci\x1f.yml", "ci\nrelease.yml", `ci${DEL}.yml`, `ci${C1}.yml`, "ci\u009f.yml"];
  for (const workflow of rejected) {
    assert.equal(isValidStudioWorkflowInput(workflow), false, JSON.stringify(workflow));
  }
});

test("workflow length is counted in code points after trimming", () => {
  assert.equal(isValidStudioWorkflowInput(`  ${"a".repeat(200)}  `), true);
  assert.equal(isValidStudioWorkflowInput("a".repeat(201)), false);
  assert.equal(isValidStudioWorkflowInput("\u{1F600}".repeat(200)), true);
  assert.equal(isValidStudioWorkflowInput("\u{1F600}".repeat(201)), false);
});

// --- Minimal hook runtime: runs the real StudioClient so the submit handler is exercised. ---

interface Writes { slot: number; value: unknown }
const slots: unknown[] = [];
const writes: Writes[] = [];
let cursor = 0;
let StudioClient: () => ReactElement;

before(async () => {
  const realReact = createRequire(import.meta.url)("react") as Record<string, unknown>;
  const hooks = {
    useState(initial: unknown) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      const set = (next: unknown) => {
        const value = typeof next === "function" ? (next as (current: unknown) => unknown)(slots[slot]) : next;
        writes.push({ slot, value });
        slots[slot] = value;
      };
      return [slots[slot], set];
    },
    useMemo: (compute: () => unknown) => compute(),
    useCallback: (callback: unknown) => callback,
    useEffect: () => undefined,
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  };
  const patched = { ...realReact, ...hooks };
  mock.module("react", { defaultExport: patched, namedExports: patched });
  // The chassis chrome imports `next/link`, which only vinext's build aliases; it is not under test.
  const none = () => null;
  mock.module(new URL("../chassis/console.tsx", import.meta.url).href, {
    namedExports: { ChassisFooter: none, ConsoleHeader: none, STUDIO_LINKS: [] },
  });
  mock.module(new URL("../chassis/workflow-map.tsx", import.meta.url).href, { namedExports: { WorkflowMap: none } });
  Object.assign(globalThis, { window: { location: { search: "", origin: "https://studio.example" } } });
  ({ default: StudioClient } = await import("./studio-client") as { default: () => ReactElement });
});

function render(): ReactElement {
  cursor = 0;
  return StudioClient();
}

type Props = Record<string, unknown> & {
  children?: Tree;
  onChange?: (event: { target: { value: string } }) => void;
  onSubmit?: (event: { preventDefault(): void }) => Promise<void>;
};
interface Element { type: unknown; props: Props }
type Tree = Element | string | number | boolean | null | undefined | Tree[];

function find(node: Tree, match: (element: Element) => boolean): Element | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match);
      if (hit) return hit;
    }
    return null;
  }
  if (node === null || typeof node !== "object") return null;
  if (match(node)) return node;
  return find(node.props?.children, match);
}

function noticeText(): string {
  const status = find(render() as Tree, (element) => element.type === "p" && element.props.role === "status");
  assert.ok(status, "the notice paragraph renders");
  return [status.props.children].flat().join("");
}

function type(label: string, value: string): void {
  const input = find(render() as Tree, (element) => element.props?.["aria-label"] === label);
  assert.ok(input?.props.onChange, `${label} input renders`);
  input.props.onChange({ target: { value } });
}

async function submit(): Promise<void> {
  const form = find(render() as Tree, (element) => element.type === "form");
  assert.ok(form?.props.onSubmit, "the Studio form renders");
  await form.props.onSubmit({ preventDefault() {} });
}

const fetched: string[] = [];
const snapshot = { freshness: { generatedAt: "2026-01-01T00:00:00Z", source: "synthetic-demo", mode: "demo" } };
globalThis.fetch = (async (input: unknown) => {
  const url = String(input);
  fetched.push(url);
  const body = url.includes("/profile")
    ? { ...snapshot, login: "octocat", name: null, profileUrl: "https://github.com/octocat", publicRepositories: 8, followers: 1, stars: 2, forks: 3, repositoriesTruncated: false }
    : url.includes("/contributions")
      ? { ...snapshot, totalContributions: 0, commits: 0, issues: 0, pullRequests: 0, reviews: 0, days: [] }
      : { ...snapshot, projects: [] };
  return Response.json(body);
}) as typeof fetch;

const REFUSAL = "Enter a valid workflow before previewing: a file name or path such as ci.yml without . or .. segments or control characters, or leave it blank. "
  + "Existing preview @octocat remains visible and was not replaced.";
const workflowLabel = "Project 1 workflow (optional)";

test("an invalid workflow starts no request, validates nothing and says what to fix", async () => {
  type("Project 1 repository", "Hello-World");
  type(workflowLabel, `..${"/"}ci.yml`);
  fetched.length = 0;
  writes.length = 0;
  await submit();

  assert.deepEqual(fetched, [], "no preview request may start");
  assert.deepEqual(writes.map(({ value }) => value), [
    "error",
    REFUSAL,
  ], "only the error phase and the actionable notice change; nothing is marked validated or loading");
  assert.equal(noticeText(), REFUSAL, "the same actionable message is what the page renders");
});

test("a control character in a workflow is refused the same way", async () => {
  type(workflowLabel, `ci${C1}.yml`);
  fetched.length = 0;
  writes.length = 0;
  await submit();
  assert.deepEqual(fetched, []);
  assert.equal(writes.length, 2);
});

test("a valid or blank workflow submits, and the trimmed value reaches the projects request", async () => {
  type(workflowLabel, "  ci.yml  ");
  fetched.length = 0;
  writes.length = 0;
  await submit();
  assert.equal(fetched.length, 3, "profile, contributions and projects are requested");
  const projects = fetched.find((url) => url.includes("/projects"));
  assert.ok(projects?.includes("workflows=Hello-World%3Aci.yml"), projects);
  assert.ok(writes.some(({ value }) => (value as { key?: string } | null)?.key), "the preview is marked validated");

  type(workflowLabel, "   ");
  fetched.length = 0;
  await submit();
  assert.equal(fetched.length, 3);
  assert.ok(!fetched.find((url) => url.includes("/projects"))?.includes("workflows="), "blank means unconfigured");
});

test("after a successful preview an invalid workflow leaves that preview and every other state untouched", async () => {
  const before = [...slots];
  type(workflowLabel, "../ci.yml");
  const typed = [...slots];
  fetched.length = 0;
  writes.length = 0;
  await submit();

  assert.deepEqual(fetched, []);
  assert.deepEqual(writes.map(({ value }) => value), [
    "error",
    REFUSAL,
  ]);
  const written = new Set(writes.map(({ slot }) => slot));
  typed.forEach((value, slot) => {
    if (!written.has(slot)) assert.ok(Object.is(slots[slot], value), `state slot ${slot} must not change`);
  });
  assert.ok(before.some((value) => (value as { key?: string } | null)?.key), "a validated preview existed beforehand");
  assert.ok(slots.some((value) => (value as { key?: string } | null)?.key), "and it is still validated");
});
