# Field primitives implementation plan

**Goal:** Complete #131 with seeded decoration and truthful pending-only signals.
**Architecture:** Immutable recipe handles capture bounded geometry. One assembler
collects all field and optional reading applications into compileSceneMotion;
individual returned fragments can be placed by static scene wrappers.
**Tech stack:** Existing TypeScript SVG package and Node tests, no new dependencies.
**Spec:** #131 and docs/EXPANSION_PLAN.md sections 4–6.

## Constraints and review focus

No hidden independent motion plan, fabricated reading or raw markup. Preserve
none/ambient base equivalence, the 96-particle cap, global compiler counters and
loop budgets, and no hook for unavailable signals. Test bad keys, sparse arrays,
forged recipes, mismatched themes, unsafe/empty/long paths and duplicate targets.

## Implementation and checks

- [x] Record the missing field API failure before implementing the factories.
- [x] Add bounded particle, scanline, plotter and signal recipes.
- [x] Integrate one compiler and validate global budgets in both encoders.
- [x] Preserve the dim full trace, independent placement and literal state labels.
- [x] Run the shared scene contract and focused regression suite.
- [ ] Publish the bounded increment, run exact-head full CI, and address review.
- [ ] Merge only after current-head validation; continue static integration as #132.
