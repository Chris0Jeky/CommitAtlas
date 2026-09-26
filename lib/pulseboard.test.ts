import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  pulseboardCardTheme,
  pulseboardEvent,
  pulseboardPresent,
  pulseboardRepoCountBucket,
  pulseboardRoute,
  pulseboardSmallCount,
  whenPulseboardReady,
} from "./pulseboard";

type Call = [string, ...unknown[]];

function fakeSdk(result = true) {
  const calls: Call[] = [];
  return {
    calls,
    scope: {
      Pulseboard: {
        route: (name: string) => { calls.push(["route", name]); return result; },
        count: (event: string) => { calls.push(["count", event]); return result; },
        track: (name: string, props: unknown) => { calls.push(["track", name, props]); return result; },
      },
    },
  };
}

test("product code survives window.Pulseboard being undefined", () => {
  for (const scope of [{}, { Pulseboard: undefined }, { Pulseboard: null }, { Pulseboard: 3 }, null, undefined]) {
    assert.equal(pulseboardPresent(scope), false);
    assert.equal(pulseboardRoute("studio", scope), false);
    assert.equal(pulseboardEvent({ name: "studio.opened", props: {} }, scope), false);
  }
  // Also with the real global scope, where Node defines no Pulseboard.
  assert.equal(pulseboardRoute("home"), false);
  assert.equal(pulseboardEvent({ name: "card.exported", props: { format: "markdown", theme: "ember", cards: 2 } }), false);
});

test("a throwing or partial SDK never throws into product code", () => {
  const throwing = { Pulseboard: { route() { throw new Error("x"); }, count() { throw new Error("x"); }, track() { throw new Error("x"); } } };
  assert.equal(pulseboardRoute("studio", throwing), false);
  assert.equal(pulseboardEvent({ name: "studio.opened", props: {} }, throwing), false);
  assert.equal(pulseboardEvent({ name: "studio.opened", props: {} }, { Pulseboard: {} }), false);
  const hostile = Object.defineProperty({}, "Pulseboard", { get() { throw new Error("blocked"); } });
  assert.equal(pulseboardPresent(hostile), false);
  assert.equal(pulseboardRoute("home", hostile), false);
});

test("registered count events are counted and tracked; other events are tracked only", () => {
  const { scope, calls } = fakeSdk();
  assert.equal(pulseboardEvent({ name: "studio.opened", props: {} }, scope), true);
  assert.equal(pulseboardEvent({ name: "card.exported", props: { format: "markdown", theme: "paper", cards: 3 } }, scope), true);
  assert.equal(pulseboardEvent({
    name: "profile.loaded",
    props: { repoCountBucket: "10-49", source: "live", projects: 2, contributions: true },
  }, scope), true);
  assert.equal(pulseboardRoute("studio", scope), true);
  assert.deepEqual(calls, [
    ["count", "studio.opened"],
    ["track", "studio.opened", {}],
    ["count", "card.exported"],
    ["track", "card.exported", { format: "markdown", theme: "paper", cards: 3 }],
    ["track", "profile.loaded", { repoCountBucket: "10-49", source: "live", projects: 2, contributions: true }],
    ["route", "studio"],
  ]);
});

test("props are closed enums and bounded counts", () => {
  assert.equal(pulseboardCardTheme("ember"), "ember");
  assert.equal(pulseboardCardTheme("midnight"), "midnight");
  assert.equal(pulseboardCardTheme("octocat's private theme"), "other");
  assert.deepEqual(
    [-1, 0, 1, 9, 10, 49, 50, 99, 100, 5000, Number.NaN, null, undefined].map((n) => pulseboardRepoCountBucket(n)),
    ["unknown", "0", "1-9", "1-9", "10-49", "10-49", "50-99", "50-99", "100+", "100+", "unknown", "unknown", "unknown"],
  );
  assert.equal(pulseboardSmallCount(3.7), 3);
  assert.equal(pulseboardSmallCount(-2), 0);
  assert.equal(pulseboardSmallCount(1e9), 32);
  assert.equal(pulseboardSmallCount(Number.POSITIVE_INFINITY), 0);
});

test("whenPulseboardReady runs now when present, else once on load, and can be cancelled", () => {
  const ran: string[] = [];
  whenPulseboardReady(() => ran.push("present"), fakeSdk().scope);
  assert.deepEqual(ran, ["present"]);

  const listeners = new Map<string, () => void>();
  const loading = {
    document: { readyState: "interactive" },
    addEventListener: (type: string, fn: () => void) => { listeners.set(type, fn); },
    removeEventListener: (type: string) => { listeners.delete(type); },
  };
  const cancel = whenPulseboardReady(() => ran.push("late"), loading);
  assert.deepEqual(ran, ["present"]);
  listeners.get("load")?.();
  assert.deepEqual(ran, ["present", "late"]);

  whenPulseboardReady(() => ran.push("cancelled"), loading)();
  assert.equal(listeners.has("load"), false);
  cancel();

  whenPulseboardReady(() => ran.push("complete"), { document: { readyState: "complete" }, addEventListener() {} });
  assert.deepEqual(ran, ["present", "late", "complete"]);
});

test("Studio instrumentation never passes typed handles, repository names or URLs", async () => {
  const source = await readFile(new URL("../app/studio/studio-client.tsx", import.meta.url), "utf8");
  const calls: string[] = [];
  for (let start = source.indexOf("pulseboardEvent({"); start !== -1; start = source.indexOf("pulseboardEvent({", start + 1)) {
    let depth = 0;
    let end = start + "pulseboardEvent(".length;
    do {
      if (source[end] === "{") depth += 1;
      else if (source[end] === "}") depth -= 1;
      end += 1;
    } while (depth > 0 && end < source.length);
    calls.push(source.slice(start, end));
  }
  assert.ok(calls.length >= 3, "studio.opened, profile.loaded and card.exported are instrumented");
  for (const call of calls) {
    assert.doesNotMatch(call, /\b(handle|login|repo|owner|markdown\s*[,}]|baseUrl|url|docs|install|download|workflow|name:\s*nextProfile)\b/u, call);
  }
});
