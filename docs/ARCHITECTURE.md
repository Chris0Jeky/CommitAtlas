# Architecture

CommitAtlas has one data-and-rendering core with three delivery surfaces:

```text
                         ┌─ hosted JSON + SVG API
GitHub public evidence ──┼─ interactive HTML Studio
             │           └─ static CLI / Node 24 Action
             ▼                         │
 @commit-atlas/github                  ▼
             │               tracked public SVG assets
             ▼
 validated PortfolioSnapshot
             │
      ┌──────┴────────┐
      ▼               ▼
 @commit-atlas/core  @commit-atlas/svg
 metrics/contracts   accessible renderers
```

## V1 surfaces

| Surface | Purpose | Delivery |
| --- | --- | --- |
| Atlas | Up-to-two-year density (7–730 days or `auto`), heatmap, streaks, activity mix, momentum, rhythm, languages, project health | SVG + Studio |
| Profile | Public repositories, stars, followers, following, contribution total | SVG + JSON |
| Streak | Current and longest streak inside the exact displayed UTC window | SVG + JSON |
| Breakdown | Exact categorized counts when available; otherwise non-window-scoped profile-view percentages | SVG + Studio |
| Rhythm | Transparent within-window personal consistency, never a GitHub rank | SVG + Studio |
| Activity | Bounded daily contribution graph and exact date window | SVG + JSON |
| Languages | Complete repository-language share, not proficiency | SVG + JSON |
| Projects | Explicit lifecycle, named-workflow CI, release, freshness, and configured actions | SVG summary + HTML actions + JSON |
| Cadence | UTC weekday contribution share and busiest day | Static SVG |
| Releases | Latest published releases across curated projects | Static SVG |
| Delivery | Pull-request flow across configured public repositories, labelled as activity flow rather than quality or impact | Static SVG + JSON; opt-in |
| Studio | Configure, preview, copy Markdown, and inspect source/freshness | HTML |

An external SVG embedded in a README is one image link. Internal pseudo-buttons are not a reliable
interaction surface, so a project card links as a whole to the Studio while individual Source, Docs,
Install, Download, Release, and CI actions remain keyboard-accessible HTML.

## Evidence sources

- Public profile/repository/language/project data uses GitHub's public REST API.
- Credential-free contributions use the logged-out GitHub profile contribution view. Daily counts
  and levels must form the complete requested UTC window. Public activity-type percentages come
  from calendar-year profile views, remain percentages, and are labelled as not window-scoped;
  they are not converted into fabricated exact event counts.
- Optional hosted token-backed contributions use GitHub GraphQL only after positive public-only
  classic-token scope evidence. Restricted contributions and broader/unknown credential types fail
  closed.
- Opt-in static Delivery collection uses a separate authenticated GraphQL request for aggregate
  pull-request counts. Every search names the configured public repositories owned by the user;
  the same response must affirm public visibility for every repository. The collector requests no
  pull-request titles, bodies, comments, branches, commit content, or reviewer identities.
- CI reads only the exact workflow configured for each project. Lifecycle and action URLs are owner
  declarations, never guesses derived from repository age or popularity.

The logged-out profile view can include anonymous aggregate contributions the GitHub user elected to
show publicly. CommitAtlas requests no private repository names, commits, URLs, or other private
details through that path.

## Security and truth boundaries

- Query parameters and config fields are allowlisted, length-bounded, canonicalized, and versioned.
- Outbound requests target GitHub hosts only. Manifest links are validated but never fetched.
- Tokens are server/runner inputs, never URLs, Studio state, static config, fixtures, manifests, or
  generated SVGs. The Action's optional `github-token` input and the static process's `GITHUB_TOKEN`
  environment lookup are used only for opt-in Delivery collection; ordinary static collection
  remains credential-free.
- Token-backed public routes require positive public-only proof before resource lookup, reject
  private repository responses, and reject restricted contribution collections.
- Every GitHub text field is role-bounded before it reaches a snapshot or renderer. Invalid optional
  HTTPS URLs are omitted; credential-bearing URLs are rejected.
- Renderers XML-escape normalized text and emit no scripts, remote images, `foreignObject`, event
  attributes, or arbitrary external CSS.
- Missing, partial, gapped, stale, restricted, and unavailable evidence is never silently rewritten
  as zero or passing.
- A GitHub `403` becomes `github_rate_limited` only with a valid `Retry-After`, exhausted
  `x-ratelimit-remaining`, or an explicit rate-limit/abuse message. Other 403s are `github_forbidden`:
  optional project signals degrade locally, while required lookups return the bounded 502 contract.
  Project snapshots carry `releaseState` (`published`, `none`, or `unavailable`) so a refused release
  lookup can never be rendered or counted as an observed absence.
- The rhythm score is a documented within-window consistency summary, not a universal developer rank.

## Hosted delivery and caching

API errors retain the v1 envelope:
`{ version: 1, status: "error", error: { code, message }, generatedAt }`.
Messages describe the failure without copying upstream bodies or transport exceptions.
The typed `GitHubApiError.code` union is the shared client contract; Studio displays the safe message.

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `github_timeout` | 502 | The shared 12-second request deadline expired, including body reads. |
| `github_auth_required` | 502 | GitHub returned 401 or a GraphQL authentication-required error. This concerns server credentials, not the visitor. |
| `github_forbidden` | 502 | GitHub returned a non-rate-limit 403 or a GraphQL permission error. |
| `github_rate_limited` | 429 | A primary or secondary quota refusal, including GraphQL payload errors; validated retry guidance is provided. |
| `github_unavailable` | 502 | An upstream 5xx, immediate network/read failure, or unclassified GraphQL failure. It does not imply a deadline expired. |
| `github_not_found` | 404 | No matching public resource; private and missing resources remain indistinguishable. |

Credential preflight HTTP failures use the same classification. A successful preflight that lacks
explicit public-only scope proof still fails closed as `private_data`. Optional project 403s stay
local unavailable signals; later profile-page deadline failures still produce partial totals.

The hosted service is best-effort and cache-first. Public responses use canonical cache keys and
bounded edge lifetimes; private/token responses use `no-store`. Stable ETags support conditional
requests.

The Worker also keeps a public-only last-known-good layer in the `LAST_GOOD` Workers KV binding.
Only validated `200` JSON/SVG representations from canonical live-public requests are eligible.
The key is a SHA-256 digest of the route plus sorted query pairs, so user, theme, layout, window,
repository, lifecycle, and workflow choices cannot collide or leak across responses. Synthetic
requests, token-backed requests, invalid input, not-found answers, and malformed upstream data are
never written or served from this layer.

Entries expire seven days after storage or the latest matching validation. When anonymous GitHub
later produces `github_rate_limited`, `github_timeout`, `github_auth_required`, `github_forbidden`,
or `github_unavailable`, a valid entry is returned with `X-CommitAtlas-Data-State: stale`, its
stored and observed timestamps, a short cache lifetime, and an HTTP stale warning. SVG responses
also receive a high-contrast `STALE SNAPSHOT` strip below the original view box content and add the
same warning to the accessible description. Versioned JSON bodies preserve their observed values
while changing `freshness.mode` to `stale`; both representations receive a new ETag. A cold, expired, corrupt, or
cross-key lookup retains the original bounded error.

A matching public `304 Not Modified` is also useful evidence: GitHub has confirmed that the
canonical representation is still current even though it did not resend the body. CommitAtlas
therefore refreshes that entry's KV retention and separate `validatedAt` timestamp through
`ctx.waitUntil()`, but only when the request, response, canonical key, and stored weak ETag all
agree. The parser uses validation time for retention eligibility; entries without it use `storedAt`.
The stored and observed timestamps (including stale age headers) are preserved because no body
was newly observed. Missing, expired, malformed, or mismatched entries
are not revived, and a KV read or write failure cannot replace the original `304`.

KV is eventually consistent, so a just-primed value may take time to become visible in another
Cloudflare location. That is an honest resilience layer, not an availability guarantee or a source
of stronger evidence. Persistence runs through `ctx.waitUntil()` and cannot delay a successful
response. See Cloudflare's [KV consistency model](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
and [`waitUntil` contract](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil).

The Studio uses the same versioned API and renderers. It only emits Markdown for a configuration that
actually rendered, retires stale project evidence after edits, and keeps independent project actions
in HTML.

## Static delivery

The static package reads one tracked `.commitatlas.json`, fetches a credential-free public
`PortfolioSnapshot`, and renders selected cards and registry scenes. There are eleven selectable
cards: the original ten remain credential-free and are the default selection; `delivery` is opt-in.
When Delivery is selected, [the generator](../packages/static/src/generate.ts) also collects a
scoped `DeliverySnapshot`, using an explicit programmatic token or the `GITHUB_TOKEN` environment
variable. That token is not passed to the ordinary portfolio client. Delivery's scope and date must
match the configured public projects and portfolio window before rendering.

The primary output and each optional `themes` entry have an independent v1 `manifest.json` with
artifact byte sizes and SHA-256 hashes. Every variant is rendered and validated from the same
observations before publication. Selecting Delivery adds `delivery.svg` and the same deterministic
`delivery.json` to each theme. Ordinary generation leaves the external benchmark unavailable;
verified references remain separate work under #245. When `responsiveAtlas` is enabled, the same
portfolio snapshot also renders the alternate Atlas layout into that directory's manifest, so
responsive and dark/light consumers do not compare independently fetched datasets.

Repository containment and symlink checks run before staging. All themes then pass checks on
selected destinations and stale files before any stale deletion or selected-output replacement.
Stale cleanup requires a prior v1 manifest naming CommitAtlas as the writer, a valid size/digest
entry, and a current regular file with one link whose actual size and SHA-256 match that entry.
For files eligible for cleanup, changed contents, directories, symlinks, hard links and other special
entries stop publication at preflight; an already-missing stale file is harmless. Cleanup stays
within the bounded managed names in the directory whose manifest recorded them.

Legacy name-only entries and missing or invalid integrity metadata leave stale files in place for
manual review. Missing, foreign or unreadable manifests, and manifests with duplicate artifact paths,
disable cleanup entirely. Selected artifacts retain their overwrite contract, so these stale-file
checks do not protect edits to an artifact that remains selected. The v1 writer still uses a
path-based rename/unlink sequence: changes after preflight can race publication, and neither
concurrent-writer isolation nor crash-atomic publication is provided. The test-only v2 store remains
inactive; #256 tracks that work.

The [Node 24 Action](../action/src/index.ts) calls the same generator, accepts the optional
`github-token` input for Delivery, and returns generated paths. It does not commit, push, upload or
deploy. A consumer workflow owns publication and can preserve the last known-good committed assets
when refresh fails. See the [static package contract](../packages/static/README.md) and
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md).

## Optional Developer Lens research bridge

The landing page has one deliberately separate cross-repository input: a versioned
`DeveloperLensMethodTrialSummary.v1` artifact produced by Developer Lens. CommitAtlas vendors one
JSON instance under `research-contracts/`, pins its producer commit in source, validates both schema
and verdict semantics at build/test time, and renders it as an optional explainer inside the design
lab. There is no runtime request to Developer Lens and no dependency in the GitHub evidence or SVG
generation path.

The frozen C0 artifact compares an offline Gaussian BOCPD candidate with the retained rolling
median/MAD baseline on invented weekly system data. Its contract requires the displayed limitations
and unsupported-claim codes, equal measured detection, worse candidate false alerts, and the
nonviable selection outcome. It cannot be used as GitHub profile evidence, a developer score,
real-repository validation, or production monitoring. A future method trial must publish a new
versioned producer artifact and update the pinned consumer deliberately; silent semantic drift
fails closed.

## Motion and scene delivery

`@commit-atlas/svg` exports the `MotionPlan` compiler with CSS and SMIL backends and the
[scene engine](../packages/svg/src/scene.ts). Scenes declare their family, supported packs and
motion profiles, model builder, renderer, and accessibility text. The engine derives deterministic
model seeds, scopes generated identifiers, validates SVG and accessibility output, and enforces
byte, animated-element, and looping-group budgets. Unavailable models render an explicit still
composition.

The package and static config accept `none | subtle | ambient | cinematic`; hosted routes and the
Studio accept `none | subtle | ambient`. Each scene further restricts those choices through its
capability declaration. Existing cards retain their compatibility motion; compiler adoption for
the Atlas and standalone cards remains #126/#127. Scene profiles already select different motion
primitives. Renderer metadata determines whether SVG CSP permits inline presentation styles.

The [registry](../packages/svg/src/scene.ts) contains six built-ins. The
[hosted catalogue](../lib/hosted-scene-catalog.ts) exposes the first four through
`/api/v1/scenes/<id>.svg`:

| Scene | Delivery | Supported motion |
| --- | --- | --- |
| `evidence-coverage` | Hosted + static/Action | `none`, `subtle`, `ambient` |
| `activity-terrain` | Hosted + static/Action | `none`, `subtle`, `ambient` |
| `chronograph` | Hosted + static/Action | `none`, `subtle`, `ambient` |
| `lifecycle-map` | Hosted + static/Action | `none`, `subtle`, `ambient` |
| `identity-beacon` | Static/Action; validated `identity` required | `none`, `ambient`, `cinematic` |
| `nebula` | Static/Action | `none`, `ambient` |

Every built-in currently supports only `survey`. The
[pack implementation](../packages/svg/src/packs.ts) defines `survey`, `orbital`, `spectral`, and
`terminal` frame geometry, but broader scene/pack adoption remains open under #111. Unsupported
scene/pack or scene/motion combinations are rejected. Static configuration selects registry scenes;
the [static renderer](../packages/static/src/render.ts) produces `scene-<id>.svg` artifacts for
inclusion in each theme's manifest, and the Action reports generated paths through its `scenes`
output.

Studio card and scene previews share [bounded SVG loading](../app/studio/studio-svg-preview.tsx),
approval tied to the actual decoded image, and reversible global/per-image Replay, Reduced-motion
and Frame-zero tools. The latter two load `motion=none` twins. Renderer counters describe the loaded
SVG's bytes, animated elements and looping groups; they do not measure browser playback. A still
twin cannot approve an unseen animated configuration for Markdown.

## Remaining programme and qualification

The [backend defaults and budget classes](../packages/svg/src/motion/profile.ts) remain explicitly
provisional. The complete browser/host/embed matrix (#113, with #180's WebKit diagnostic) and
measured render-cost budgets (#114) remain open. Identity Beacon (#134) and Chronograph (#344)
still need their timed visual acceptance; #141 retains production and README round-trip
qualification. This source inventory does not establish a current deployment or complete Phase 1.

The full `PublicLensProjection.v1` consumer (#145) and `ResearchFindingProjection.v1` consumer
(#154) are still planned. The engine's branded synthetic C0 lens context is not a projection file
reader; its finding adapter remains unavailable. The gallery continues to use the WB-C1 method-trial
bridge. [PROJECTION_CONTRACTS.md](./PROJECTION_CONTRACTS.md) records the consumer boundaries;
implementations must pin the published producer schemas and fixtures. Remaining scenes, broader
pack support, and unanswered owner decisions stay in
[EXPANSION_PLAN.md](./EXPANSION_PLAN.md) and #111. C1 profile publication remains gated by #170.

## Project configuration

```json
{
  "version": 1,
  "user": "Chris0Jeky",
  "theme": "ember",
  "themes": [{ "theme": "paper", "outputDir": "assets/commitatlas/light" }],
  "days": 365,
  "motion": "subtle",
  "layout": "wide",
  "responsiveAtlas": true,
  "outputDir": "assets/commitatlas",
  "cards": ["atlas", "profile", "streak", "breakdown", "rhythm", "activity", "languages", "projects"],
  "projects": [
    {
      "repo": "Chris0Jeky/CommitAtlas",
      "label": "CommitAtlas",
      "lifecycle": "active",
      "workflow": "ci.yml",
      "links": {
        "docs": "https://github.com/Chris0Jeky/CommitAtlas#readme"
      }
    }
  ]
}
```

V1 allows one to six repositories owned by the configured user. A project without a workflow is
explicitly unconfigured and makes no workflow-run request; an unavailable declared workflow is never
a passing signal.
