import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientSource = fs.readFileSync(path.join(root, "app/studio/studio-client.tsx"), "utf8");
// Shared repository rule mirrored from packages/github/src/validation.ts (do not change the API rule).
const REPOSITORY = /^(?!\.\.?$)[a-z\d._-]{1,100}$/i;

test("invalid repo name is blocked before any board fetch with a validation notice", () => {
  assert.ok(
    clientSource.includes("^(?!\\.\\.?$)[a-z\\d._-]{1,100}$"),
    "studio client must mirror the shared REPOSITORY rule",
  );
  assert.match(clientSource, /REPOSITORY\.test\(/);

  const validationIndex = clientSource.indexOf("REPOSITORY.test(");
  const boardUrlIndex = clientSource.indexOf('buildStudioRouteUrl("projects"');
  assert.ok(validationIndex !== -1 && boardUrlIndex !== -1, "both validation and board fetch must exist");
  assert.ok(
    validationIndex < boardUrlIndex,
    "repository validation must run before the board request is built",
  );

  const between = clientSource.slice(validationIndex, boardUrlIndex);
  assert.match(between, /retainedPreviewNotice\(/, "invalid repo must surface a retained-preview notice");
  assert.match(between, /setPhase\("error"\)/, "invalid repo must set the error phase");
  assert.match(between, /return/, "invalid repo must return without fetching");

  // The reported reproduction value never satisfies the shared rule.
  assert.equal(REPOSITORY.test("a,b"), false);
  assert.equal(REPOSITORY.test("Hello-World"), true);
  assert.equal(REPOSITORY.test("Spoon-Knife"), true);

  // Blocked before fetch: validation returns early so no request fires.
  let fetched = false;
  const activeProjects = [{ repo: "a,b" }];
  const invalid = activeProjects.find((project) => !REPOSITORY.test(project.repo.trim()));
  if (invalid) {
    // preview() returns here in the client; the fetch below must not run.
  } else {
    fetched = true;
  }
  assert.equal(fetched, false);
});

test("board 500 still commits fresh profile and contributions", async () => {
  // The board request must settle independently instead of rejecting Promise.all.
  assert.match(
    clientSource,
    /board\w*\s*=\s*\(?\s*activeProjects\.length[\s\S]*?\.then\(\(value\) => \(\{\s*value,\s*error:\s*null\s*\}\)\)[\s\S]*?\.catch\(/,
    "board fetch must be wrapped in a value/error result like contributions",
  );
  const promiseAll = clientSource.slice(clientSource.indexOf("await Promise.all("));
  assert.doesNotMatch(
    promiseAll,
    /fetchJson<ProjectBoardSnapshot>/,
    "Promise.all must not contain a raw rejecting board fetch",
  );
  assert.ok(clientSource.includes("boardResult.value"), "settled board value must drive setBoard");
  assert.ok(clientSource.includes("boardResult.error"), "settled board error must drive the notice");
  assert.match(
    clientSource,
    /projectsForValidatedPreview\(activeProjects,\s*!boardResult\.error\)/,
    "a failed board must remove its project inputs from validated output",
  );
  assert.match(
    clientSource,
    /projects:\s*previewConfiguration\.projects/,
    "README Markdown must use the sanitized validated project list",
  );

  // Simulate: profile 200 + contributions 200 + board 500 with settled wrappers.
  const nextProfile = { login: "octocat" };
  const contributionResult = { value: { totalContributions: 1 }, error: null };
  const boardPromise = Promise.reject(new Error("Request failed with 500"))
    .then((value) => ({ value, error: null }))
    .catch((error) => ({ value: null, error }));
  const [profile, contributions, boardResult] = await Promise.all([
    Promise.resolve(nextProfile),
    Promise.resolve(contributionResult),
    boardPromise,
  ]);

  const activeProjects = [{ repo: "Hello-World" }, { repo: "Hello-World" }];
  const state = { profile: null, contribs: null, board: "untouched", projects: activeProjects, validated: false, notice: "" };
  state.profile = profile;
  state.contribs = contributions.value;
  state.board = boardResult.value;
  state.projects = boardResult.error ? [] : activeProjects;
  state.validated = true;
  state.notice = contributions.error
    ? "contribution unavailable"
    : boardResult.error
      ? "Available public signals loaded. Project board is unavailable for this preview and was omitted; no value was guessed."
      : "preview loaded";

  assert.deepEqual(state.profile, nextProfile);
  assert.deepEqual(state.contribs, { totalContributions: 1 });
  assert.equal(state.board, null);
  assert.deepEqual(state.projects, []);
  assert.equal(state.validated, true);
  assert.match(state.notice, /unavailable|omitted/i);
});

test("all-200 happy path still commits every signal", async () => {
  for (const token of ["setProfile(", "setContributions(", "setBoard(", "setPreviewConfiguration(", "setValidatedPreview("]) {
    assert.ok(clientSource.includes(token), `happy path must still call ${token}`);
  }

  const contributionPromise = Promise.resolve({ totalContributions: 1 })
    .then((value) => ({ value, error: null }))
    .catch((error) => ({ value: null, error }));
  const boardPromise = Promise.resolve({ projects: [] })
    .then((value) => ({ value, error: null }))
    .catch((error) => ({ value: null, error }));
  const [profile, contributionResult, boardResult] = await Promise.all([
    Promise.resolve({ login: "octocat" }),
    contributionPromise,
    boardPromise,
  ]);
  assert.deepEqual(profile, { login: "octocat" });
  assert.deepEqual(contributionResult.value, { totalContributions: 1 });
  assert.equal(contributionResult.error, null);
  assert.deepEqual(boardResult.value, { projects: [] });
  assert.equal(boardResult.error, null);
});

test("optional project URL inputs cannot trap submit behind native validation", () => {
  // type="url" blocks form submission on invalid text with no app notice, while
  // safeProjectActionUrl already drops invalid values downstream — so the inputs
  // must not ask the browser to validate them. inputMode keeps URL keyboards.
  const urlInputs = clientSource
    .split("\n")
    .filter((line) => line.includes("URL (optional)") && line.includes("<input"));
  assert.equal(urlInputs.length, 3, "expected the docs, install, and download project inputs");
  for (const line of urlInputs) {
    assert.doesNotMatch(line, /type="url"/, "optional project URLs must not use native url validation");
    assert.match(line, /type="text"/, "optional project URLs stay explicit text inputs");
    assert.match(line, /inputMode="url"/, "optional project URLs keep the URL keyboard hint");
  }
  assert.match(clientSource, /safeProjectActionUrl\(/, "invalid URLs must still be dropped downstream");
});
