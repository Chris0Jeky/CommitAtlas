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
| Atlas | 365-day density, heatmap, streaks, activity mix, momentum, rhythm, languages, project health | SVG + Studio |
| Profile | Public repositories, stars, followers, following, contribution total | SVG + JSON |
| Streak | Current and longest streak inside the exact displayed UTC window | SVG + JSON |
| Breakdown | Exact categorized counts when available; otherwise non-window-scoped profile-view percentages | SVG + Studio |
| Rhythm | Transparent within-window personal consistency, never a GitHub rank | SVG + Studio |
| Activity | Bounded daily contribution graph and exact date window | SVG + JSON |
| Languages | Complete repository-language share, not proficiency | SVG + JSON |
| Projects | Explicit lifecycle, named-workflow CI, release, freshness, and configured actions | SVG summary + HTML actions + JSON |
| Cadence | UTC weekday contribution share and busiest day | Static SVG |
| Releases | Latest published releases across curated projects | Static SVG |
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
- CI reads only the exact workflow configured for each project. Lifecycle and action URLs are owner
  declarations, never guesses derived from repository age or popularity.

The logged-out profile view can include anonymous aggregate contributions the GitHub user elected to
show publicly. CommitAtlas requests no private repository names, commits, URLs, or other private
details through that path.

## Security and truth boundaries

- Query parameters and config fields are allowlisted, length-bounded, canonicalized, and versioned.
- Outbound requests target GitHub hosts only. Manifest links are validated but never fetched.
- Tokens are server-side only and are never accepted in URLs, Studio state, static config, Action
  inputs, fixtures, manifests, or generated SVGs.
- Token-backed public routes require positive public-only proof before resource lookup, reject
  private repository responses, and reject restricted contribution collections.
- Every GitHub text field is role-bounded before it reaches a snapshot or renderer. Invalid optional
  HTTPS URLs are omitted; credential-bearing URLs are rejected.
- Renderers XML-escape normalized text and emit no scripts, remote images, `foreignObject`, event
  attributes, or arbitrary external CSS.
- Missing, partial, gapped, stale, restricted, and unavailable evidence is never silently rewritten
  as zero or passing.
- The rhythm score is a documented within-window consistency summary, not a universal developer rank.

## Hosted delivery and caching

The hosted service is best-effort and cache-first. Public responses use canonical cache keys and
bounded edge lifetimes; private/token responses use `no-store`. Stable ETags support conditional
requests.

The Worker also keeps a public-only last-known-good layer in the `LAST_GOOD` Workers KV binding.
Only validated `200` JSON/SVG representations from canonical live-public requests are eligible.
The key is a SHA-256 digest of the route plus sorted query pairs, so user, theme, layout, window,
repository, lifecycle, and workflow choices cannot collide or leak across responses. Synthetic
requests, token-backed requests, invalid input, not-found answers, and malformed upstream data are
never written or served from this layer.

Entries expire after seven days. When anonymous GitHub later produces a supported quota (`429`) or
availability (`502`) error, a valid entry is returned with `X-CommitAtlas-Data-State: stale`, its
stored and observed timestamps, a short cache lifetime, and an HTTP stale warning. SVG responses
also receive a high-contrast `STALE SNAPSHOT` strip below the original view box content and add the
same warning to the accessible description. Versioned JSON bodies preserve their observed values
while changing `freshness.mode` to `stale`; both representations receive a new ETag. A cold, expired, corrupt, or
cross-key lookup retains the original bounded error.

KV is eventually consistent, so a just-primed value may take time to become visible in another
Cloudflare location. That is an honest resilience layer, not an availability guarantee or a source
of stronger evidence. Persistence runs through `ctx.waitUntil()` and cannot delay a successful
response. See Cloudflare's [KV consistency model](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
and [`waitUntil` contract](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil).

The Studio uses the same versioned API and renderers. It only emits Markdown for a configuration that
actually rendered, retires stale project evidence after edits, and keeps independent project actions
in HTML.

## Static delivery

The static package reads one tracked `.commitatlas.json`, fetches public data without a credential,
builds one `PortfolioSnapshot`, renders a selected subset of ten cards, and writes `manifest.json`
with byte sizes and SHA-256 hashes. Repository-contained path and symlink checks run before output.
All data and payloads validate before staged per-file replacement; unrelated siblings survive while
stale files from the bounded set of CommitAtlas-managed artifact names are removed after success.
When `responsiveAtlas` is enabled, the same snapshot also renders the alternate Atlas layout into
the same manifest, so responsive consumers never compare two independently fetched datasets.

The root Node 24 Action calls that package and returns generated paths. It does not commit, push,
upload, deploy, or receive `GITHUB_TOKEN`. A consumer workflow owns publication and can preserve the
last known-good committed cards when refresh fails. See
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md) for the exact contract.

## Project configuration

```json
{
  "version": 1,
  "user": "Chris0Jeky",
  "theme": "ember",
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
