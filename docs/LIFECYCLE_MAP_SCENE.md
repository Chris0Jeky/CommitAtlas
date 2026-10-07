# Lifecycle map

`lifecycle-map` is a survey-pack map over the configured public project board. It adds no
GitHub requests and does not read contribution counts, stars, or activity to infer maturity.
It is available through static `scenes` configuration and the hosted scene route when
registered. Default static artifact selections are unchanged.

## Reading the map

Each configured project occupies one row and one declared station: 1 planned, 2 active,
3 maintenance, 4 paused, 5 archived. The compatibility alias `maintained` maps only to
maintenance. Other strings, including inherited JavaScript property names, are rejected.
At most six distinct configured repositories are accepted. Empty or malformed project
boards render the explicit unavailable plate, not an empty or healthy map.

The timeline primitive supplies the shared station axis. Its markers are rendered as
small, independently namespaced geometry beside bounded row labels. The larger
`projectNode` primitive has a 160px minimum width and includes text; scaling that whole
fragment would animate readings and crowd five stations. This map therefore uses the
same declared-position conventions with a smaller row marker rather than
silently squeezing or animating `projectNode` text.

`LIFECYCLE · DECLARED` and the hypothesis-style trim apply to position, not to CI.
CI has a visible word and a distinct monochrome shape: checked disc, crossed diamond,
half-filled pending disc, dashed stale clock, dashed unconfigured socket, or neutral
unavailable plate. Release rows show the latest published release per project, confirmed
none, stale, or unavailable. They do not claim complete release history. Release dates
remain visible even when long tags are shortened. Full bounded labels remain in the
accessible description; the composition explicitly states when labels may be shortened.

## Evidence boundary

Source and observation timestamps are visible. Synthetic/public provenance must agree
between the root snapshot and the project board; unknown modes/sources or invalid UTC
calendar timestamps do not authorize output. Known partial boards retain independently
confirmed signals, since the collector uses `partial` when even one lookup fails.
An unavailable CI/release does not erase its project's declaration or another valid signal.

Project and contribution requests finish independently. The evaluation clock is the later
of the root and project-board observation timestamps, not `Date.now`, and a project request
is not rejected merely for finishing after the contribution request. A board explicitly
stale, or older than 72 hours against that evaluation clock, cannot render current
passing/failing/pending CI or a confirmed absence of releases. The 72-hour CI threshold
matches the existing core policy, including the exact inclusive boundary. Missing,
invalid, or future-dated CI observations become unavailable. A release needs a valid UTC
publication timestamp no later than its board observation plus a bounded tag. Malformed
or contradictory release records do not become confirmed absence.

## Motion and layout

`none` and `subtle` are still. `ambient` breathes only separate geometric marker halos
where current CI evidence exists, and pulses only pending CI lamps. All reading text and
declared points remain stationary. Unavailable/stale/unconfigured lamps do not animate.
The existing GitHub README target bounds loops to its declared interval; CSS and SMIL
stripped output equal the corresponding `none` output. No browser/Camo compatibility is
implied by structural equivalence.

Wide (720px) and compact (480px) layouts reserve separate label and station regions. One
row per project prevents same-station collisions, including all six projects archived.
The longest six-row layout is below the frame's 1000px limit. Colours come only from the
selected theme; no new palette, pack or primitive is accepted from configuration.

## Integration and review

Static configuration adds `"lifecycle-map"` to `scenes` and emits
`scene-lifecycle-map.svg` in each configured theme directory. Consumers that validate an
exact artifact list must explicitly add that filename for each theme. The generator and
Action do not commit artifacts. Hosted example:

```text
/api/v1/scenes/lifecycle-map.svg?user=octocat&repos=atlas&states=atlas%3Aactive&demo=true
```

Run the SVG suite and full repository gate before merge. The synthetic fixture and
`lifecycle-map.test.mjs` cover declared positions, partial/stale/future/missing evidence,
prototype keys, duplicate repositories, invalid release dates, both backends, all themes,
bounded labels and the exact visible declaration stamp. The original #323 source produced
26 failures across the first 29 regression cases. Later tests additionally bind independent
fetch completion times and per-signal handling of partial boards.

A local static Chromium 144.0.7559.96 pass inspected 32 synthetic theme/layout/state
variants with no text bounding box outside the SVG. Visual review corrected prematurely
shortened header/footer text. These are static layout observations, not timed-motion,
production, Camo, cross-platform-font, or full locked-build evidence. The PR records exact
CI and deployment results separately.
