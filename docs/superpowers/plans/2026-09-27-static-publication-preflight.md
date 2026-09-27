# Static Publication Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent predictable variant or stale-cleanup failures from publishing a mixed static snapshot, while rechecking output containment after directories are created.

**Architecture:** Split publication into a prepare phase and a commit phase. Every target directory is created, containment-checked, ownership-read, and fully staged before cleanup begins; stale owned files are removed before new payloads are installed, and manifests remain the final visible commit marker.

**Tech Stack:** TypeScript 5.9, Node.js filesystem promises, Node test runner, CommitAtlas static package, GitHub Actions.

**Spec:** GitHub issue `#235` and `AGENTS.md` truthfulness/containment rules.

## Global Constraints

- Render and validate all themes from one snapshot before filesystem writes.
- Never delete a file unless the previous valid CommitAtlas manifest claimed it.
- A failed preparation or stale-cleanup phase must not install any new payload or manifest.
- The manifest remains the last file installed in each output directory.
- Existing successful output and dry-run behavior stay unchanged.
- Static source changes require a rebuilt, byte-checked `action/dist` bundle.

## Review Focus

1. A blocked secondary output must not alter an existing primary output.
2. A stale-file cleanup failure must leave both the previous manifest and previous payload bytes intact.
3. A symlink introduced before staging must be rejected by a post-creation containment check.
4. Temporary files from any prepared target must be removed after success or failure.
5. Successful paired themes must still share one evidence window and keep independent manifests.

---

### Task 1: Failure-first publication regressions

**Files:**
- Create: `packages/static/tests/publication.test.mjs`
- Modify: `packages/static/package.json`

**Interfaces:**
- Consumes: existing `generateStaticFromSnapshot` public API and fixture helpers.
- Produces: regressions for blocked variant preparation and stale-cleanup payload integrity.

- [x] Add a test that seeds a primary Atlas, blocks the variant output path with a regular file, attempts a changed paired snapshot, and asserts primary Atlas plus manifest are byte-identical.
- [x] Extend the cleanup-interruption test to use a changed snapshot and assert Atlas plus manifest remain byte-identical after the rejected run.
- [x] Add a render-time symlink replacement regression and require the outside directory to remain untouched.
- [x] Run the focused tests against the original implementation and observe all three fail for the intended reasons.
- [x] Commit the RED tests.

### Task 2: Prepare all outputs before publication

**Files:**
- Modify: `packages/static/src/generate.ts`

**Interfaces:**
- Consumes: rendered target payloads and manifests from `generateStaticFromSnapshot`.
- Produces: prepared target records containing output directory, owned names, staged payloads, staged manifest, and stale managed names.

- [x] Add `prepareArtifacts(root, target)` that creates the directory, re-runs contained-path validation with `mustExist: true`, reads prior ownership, and stages every payload plus manifest.
- [x] Prepare all targets before any cleanup or rename; clean all temporary files if any preparation fails.
- [x] Validate stale paths across all targets before removing any stale managed artifact.
- [x] Remove stale owned artifacts across all prepared targets before installing any payload.
- [x] Install payloads and then manifests, cleaning remaining temporary files in `finally`.
- [x] Run the focused static suite and verify all 41 tests pass.
- [x] Commit the implementation.

### Task 3: Distribution and exact-head verification

**Files:**
- Modify: `action/dist/**` generated output as required.

**Interfaces:**
- Consumes: Task 2 static source.
- Produces: Action bundle byte-equivalent to the source implementation.

- [x] Rebuild with `npm run build:action` under Node 22.13.0 using locked dependencies.
- [x] Commit the generated Action bundle and remove the temporary write-enabled workflow.
- [x] Merge current `main` into the branch and remove the reconciliation workflow in the same merge commit.
- [ ] Verify `npm run test:action`, the full `npm run check`, and production dependency audit at the final owner-authored PR head.
- [ ] Complete fresh review of the final branch and resolve any findings before merge.

## Execution Receipt

- Original implementation: all three new failure-path regressions failed as intended.
- Implemented source: focused publication regressions and the complete static package suite passed, 41/41.
- Generated distribution: `npm run build:action` completed on GitHub Actions and pushed `97ff557`.
- Base reconciliation: clean merge of current `main` pushed as `6f0918e`; temporary workflows are absent from the durable tree.
- Remaining gate: owner-authored exact-head CI and fresh review.
