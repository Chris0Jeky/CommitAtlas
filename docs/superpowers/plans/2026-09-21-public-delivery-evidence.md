# Public Delivery Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate an automatically refreshed, source-backed pull-request flow card and evidence JSON for the configured public CommitAtlas portfolio, then embed the dark/light card in the owner profile.

**Architecture:** Add a separate versioned `DeliverySnapshot` beside the existing contribution `PortfolioSnapshot`. A token-backed GitHub GraphQL collector issues one aliased aggregate-count query restricted to the configured public repositories, a pure derivation module validates and calculates display signals, the static generator emits `delivery.svg` plus `delivery.json`, and the existing Action/profile refresh pipeline publishes both themes atomically.

**Tech Stack:** TypeScript 5.9, GitHub GraphQL API, Zod-compatible runtime validation patterns, Node test runner/tsx, CommitAtlas SVG/static packages, GitHub Actions.

**Spec:** `docs/specs/PUBLIC_DELIVERY_EVIDENCE.md`

## Global Constraints

- Existing cards remain credential-free and byte-compatible when `delivery` is not selected.
- Delivery queries name only the configured public repositories; token visibility must not expand scope.
- Aggregate counts only; never request PR prose, branches, commits, reviewers, or private repository metadata.
- All windows use inclusive UTC dates and print exact bounds.
- Every ratio and benchmark multiple is labelled derived and carries its formula in `delivery.json`.
- The UI must say `activity flow · not quality or impact` and must not claim a percentile or global rank.
- Unknown, contradictory, malformed, or incomplete evidence fails generation rather than becoming zero.
- Static SVG remains deterministic, XML-safe, accessible, motion-safe, and below 96 KiB.

## Review Focus

1. A broad token must still produce queries restricted to configured repositories; the collector test asserts every query contains the exact repo clause and no unconfigured repo.
2. Calendar-day boundaries near month/year changes must remain inclusive; derivation tests use 2025-12-31/2026-01-01 fixtures.
3. `closed < merged`, non-integer counts, or missing aliases must fail; parser tests cover each branch.
4. Zero denominators must render `unavailable`, not `0%`, `∞`, or `NaN`; derivation and SVG tests cover these states.
5. A secondary theme failure must occur before either output directory is written; existing atomic-generation tests are extended with delivery artifacts.

---

### Task 1: Contract and pure derivation

**Files:**
- Create: `docs/specs/PUBLIC_DELIVERY_EVIDENCE.md`
- Create: `packages/github/src/delivery.ts`
- Create: `packages/github/src/delivery.test.ts`
- Modify: `packages/github/src/index.ts`
- Modify: `packages/github/src/types.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: configured login, configured `owner/repository` names, UTC `Date`, validated aggregate alias counts.
- Produces: `buildDeliveryQueries(input): DeliveryQueryPlan`, `deriveDeliverySnapshot(input): DeliverySnapshot`, and exported versioned types.

- [ ] **Step 1: Write the failing contract tests**

```ts
test("buildDeliveryQueries scopes every alias to the exact configured public repositories", () => {
  const plan = buildDeliveryQueries({ login: "Chris0Jeky", repositories: ["Chris0Jeky/Taskdeck"], asOf: NOW });
  assert.equal(plan.queries.length, 14);
  assert.ok(plan.queries.every(({ query }) => query.includes("author:Chris0Jeky repo:Chris0Jeky/Taskdeck")));
});

test("deriveDeliverySnapshot refuses contradictory lifetime counts", () => {
  assert.throws(() => deriveDeliverySnapshot({ ...fixture(), counts: { ...fixture().counts, closed: 2, merged: 3 } }), /merged.*closed/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test packages/github/src/delivery.test.ts`
Expected: FAIL because `delivery.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal pure contract**

Implement strict handle/repository parsing, inclusive 7/30/90/365-day windows, deterministic aliases, integer count validation, lifetime consistency checks, repository concentration, resolved conversion, weekly rate, integration balance, WIP merge-weeks, and benchmark multiple. Return `null` for undefined ratios.

- [ ] **Step 4: Run focused and package tests**

Run: `npx tsx --test packages/github/src/delivery.test.ts`
Expected: PASS.

Run: `npm run test:github`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/PUBLIC_DELIVERY_EVIDENCE.md packages/github/src/delivery.ts packages/github/src/delivery.test.ts packages/github/src/index.ts packages/github/src/types.ts package.json
git commit -m "feat(github): define public delivery evidence contract"
```

### Task 2: One-request GitHub collector

**Files:**
- Modify: `packages/github/src/client.ts`
- Modify: `lib/github/client.test.ts`

**Interfaces:**
- Consumes: `DeliveryQueryPlan` from Task 1 and an authenticated GitHub token.
- Produces: `GitHubClient.fetchDeliverySnapshot(login, repositories, benchmark)`.

- [ ] **Step 1: Add failing transport tests**

```ts
test("delivery collection uses one GraphQL request and count-only aliases", async () => {
  const calls: Request[] = [];
  const client = new GitHubClient({ token: "public-repo-token", fetchImpl: fixtureFetch(calls) });
  await client.fetchDeliverySnapshot("Chris0Jeky", ["Chris0Jeky/Taskdeck"]);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(await calls[0]!.clone().text(), /title|body|comments|headRef|review/i);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- lib/github/client.test.ts`
Expected: FAIL because `fetchDeliverySnapshot` is missing.

- [ ] **Step 3: Implement the collector**

Generate one GraphQL document with aliased `search(type: ISSUE, first: 1)` fields, send the query through the existing bounded GraphQL transport, validate every `issueCount`, and feed the resulting alias map to `deriveDeliverySnapshot`. Refuse collection without a token.

- [ ] **Step 4: Run focused and GitHub suites**

Run: `npm test -- lib/github/client.test.ts packages/github/src/delivery.test.ts`
Expected: PASS.

Run: `npm run test:github`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/github/src/client.ts lib/github/client.test.ts
git commit -m "feat(github): collect scoped delivery counts in one request"
```

### Task 3: Evidence JSON and accessible SVG

**Files:**
- Create: `packages/static/src/delivery-evidence.ts`
- Create: `packages/static/tests/delivery-evidence.test.mjs`
- Modify: `packages/svg/src/index.ts`
- Modify: `packages/svg/tests/cards.test.mjs`
- Modify: `packages/static/src/render.ts`

**Interfaces:**
- Consumes: `DeliverySnapshot`.
- Produces: `renderDeliveryEvidence(snapshot): string` and `renderDeliveryCard(data, options): string`.

- [ ] **Step 1: Add failing renderer tests**

```ts
test("delivery JSON is deterministic and carries formulas and benchmark provenance", () => {
  const left = renderDeliveryEvidence(snapshot());
  const right = renderDeliveryEvidence(snapshot());
  assert.equal(left, right);
  assert.match(left, /resolved_merge_conversion/);
  assert.match(left, /publisher/);
});

test("delivery card exposes every reading and the non-claim in accessible text", () => {
  const svg = renderDeliveryCard(cardData(), { theme: "paper", motion: "none" });
  assert.match(svg, /activity flow · not quality or impact/i);
  assert.match(svg, /<title>/);
  assert.match(svg, /<desc>/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:svg && npm run test:static`
Expected: FAIL because the renderer/evidence functions do not exist.

- [ ] **Step 3: Implement bounded outputs**

Use the existing theme/font/escape/card-shell helpers. Render merged/week as the focal reading, benchmark multiple as a comparison, four supporting readings, exact scope/window, freshness, and explicit non-claim. Serialize a stable JSON object with sorted repository rows and trailing newline.

- [ ] **Step 4: Verify focused suites**

Run: `npm run test:svg && npm run test:static`
Expected: PASS with `delivery.svg < 96 KiB` and no forbidden SVG element.

- [ ] **Step 5: Commit**

```bash
git add packages/static/src/delivery-evidence.ts packages/static/tests/delivery-evidence.test.mjs packages/svg/src/index.ts packages/svg/tests/cards.test.mjs packages/static/src/render.ts
git commit -m "feat: render delivery evidence and portfolio card"
```

### Task 4: Static generator and Action integration

**Files:**
- Modify: `packages/static/src/config.ts`
- Modify: `packages/static/src/generate.ts`
- Modify: `packages/static/tests/static.test.mjs`
- Modify: `action.yml`
- Modify: `action/src/index.ts`
- Modify: `action/action.test.mjs`
- Modify: `action/dist/index.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: optional `github-token` Action input; required when `delivery` is selected.
- Produces: managed `delivery.svg`, `delivery.json`, manifest rows, `delivery`, and `delivery-json` Action outputs.

- [ ] **Step 1: Add failing config/generator/Action tests**

Assert token-required behavior, delivery artifact cleanup ownership, both artifacts in manifests, and output paths.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:static && npm run test:action`
Expected: FAIL before config, generator, and Action support exist.

- [ ] **Step 3: Implement integration**

Add `delivery` to the static enum and managed names, pass token into the GitHub client, fetch delivery only when selected, render the evidence once per snapshot and include it in each theme output, expose Action input/outputs, document usage, then rebuild `action/dist/index.js`.

- [ ] **Step 4: Verify static and Action suites**

Run: `npm run test:static && npm run test:action`
Expected: PASS and clean bundled Action diff after rebuild.

- [ ] **Step 5: Commit**

```bash
git add packages/static action.yml action README.md
git commit -m "feat(action): publish automated delivery artifacts"
```

### Task 5: Profile consumer

**Files (in `Chris0Jeky/Chris0Jeky`):**
- Modify: `.commitatlas.json`
- Modify: `.github/workflows/commitatlas.yml`
- Modify: `.github/workflows/tests.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: CommitAtlas Action commit containing Task 4.
- Produces: daily dark/light `delivery.svg` and `delivery.json` plus an embedded profile card.

- [ ] **Step 1: Add failing consumer expectations**

Update tests/manifest expectations to require `delivery.svg` and `delivery.json` before changing config/workflow generation.

- [ ] **Step 2: Run hosted consumer CI and verify RED**

Expected: profile tests fail because the config and generated manifest do not yet include delivery artifacts.

- [ ] **Step 3: Wire the consumer**

Select `delivery`, pass `${{ github.token }}`, pin the exact CommitAtlas head, expose the card immediately below the main Atlas with transparent scope/benchmark copy, and validate both theme manifests plus matching `delivery.json` bytes/hash.

- [ ] **Step 4: Run profile CI and manual refresh**

Expected: tests green; manual refresh generates both themes from one snapshot and either commits the new artifacts or reports no diff.

- [ ] **Step 5: Commit and open dependent PR**

```bash
git add .commitatlas.json .github/workflows README.md
git commit -m "feat(profile): publish automated delivery evidence"
```

### Task 6: Whole-branch proof and documentation truth

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: issue #226 / PR description

- [ ] **Step 1: Run the complete exact-head gate**

Run: `npm run check`
Expected: PASS with no warnings or uncommitted Action bundle changes.

- [ ] **Step 2: Inspect the generated SVG and JSON fixtures**

Verify visible hierarchy, dark/light contrast, text alternatives, exact formulas, no clipped labels, no `NaN`/`Infinity`, and no private/unconfigured repository token.

- [ ] **Step 3: Record proof and residual risk**

Record exact head SHA, CI run URLs, artifact paths/hashes, benchmark date/source, the configured-repository scope, and the limitation that PR count is not delivered value.

- [ ] **Step 4: Commit state sync**

```bash
git add docs/PROJECT_STATE.md
git commit -m "docs: record delivery evidence checkpoint"
```
