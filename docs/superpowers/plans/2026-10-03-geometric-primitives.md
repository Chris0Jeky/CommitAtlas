# Geometric primitives implementation plan

> For agentic workers: execute task by task with regression-first verification.

**Goal:** Complete #130's bounded, deterministic geometry for subsequent maps and signatures.
**Architecture:** Keep geometry as static SVG fragments, separate from motion and data collection.
Use the existing SVG themes, escaping and XML scanner. Publish an additive
`@commit-atlas/svg/primitives/geometric` entry point so existing primitives and cards stay unchanged.
**Tech stack:** TypeScript, Node test runner, existing SVG package; no added dependencies.
**Spec:** Issue #130 and `docs/EXPANSION_PLAN.md` sections 4 and 6.

## Constraints and boundary decisions

Finite readings clamp to documented domains; a non-finite reading produces the neutral unavailable
idiom, never a fabricated zero. Invalid structure, oversized arrays, invalid enums, sparse arrays
and non-finite layout dimensions fail before rendering. Layouts are bounded to 160–1600 by
96–1000, without caller-provided markup, colour, IDs or animation. Inputs are never mutated.
Three to eight radar axes are accepted; the complete six-key DNA set renders in canonical order.
A zero terrain renders a labelled flat basin, distinct from an empty or non-finite series.

## Review focus

Check overflow at Number.MAX_VALUE; absent versus zero data; shuffled and duplicate radar keys;
wide/injected labels; one-point series and dense stations. Each gets a focused regression.

## Task 1: Static geometry and numeric boundary

Files: `packages/svg/src/primitives/common.ts`, `geometric.ts`,
`packages/svg/tests/geometric.test.mjs`, `packages/svg/package.json`.
Interfaces: `orbit`, `radar`, `terrain`, `timeline`, `projectNode`, `sparkline` take
context plus typed options and return static SVG fragments. `DNA_AXES` publishes canonical order.

- [x] Add tests for missing exports, all six geometries, hostile/extreme inputs and bounded counts.
- [x] Run the test before implementation and retain its missing-API failure.
- [x] Implement shared bounded layout/text helpers and six deterministic fragments.
- [x] Prove neutral unavailable output, explicit zero basins, fixed radar order and no mutation.
- [x] Add reviewed per-theme golden digests and inspect synthetic rendered examples.
- [ ] Publish a draft PR from current main and run the full repository gate in Actions.
- [ ] Address current-head review, verify exact-head CI, merge only when both are clean.

## Task 2: Follow-on interfaces

Field primitives (#131) will produce fragments plus motion applications rather than self-compiling
separate motion plans. Static/Action scene integration remains #132; no scene registration,
GitHub request, private projection or browser compatibility claim is part of #130.
