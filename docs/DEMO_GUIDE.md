# CommitAtlas demonstration guide

This walkthrough exercises every implemented v0.1 demonstration surface without requiring a
GitHub token. It uses synthetic data for repeatability, then the credential-free live public-profile
path and static generator.

## Open the public demonstration

Open [commitatlas.jeky-tck.chatgpt.site](https://commitatlas.jeky-tck.chatgpt.site). The Studio is
at [commitatlas.jeky-tck.chatgpt.site/studio](https://commitatlas.jeky-tck.chatgpt.site/studio).
The public [Chris0Jeky profile](https://github.com/Chris0Jeky) shows dependable SVG snapshots and a
responsive Atlas companion produced from one public GitHub snapshot, with links back to the Studio.

For an exact local production-build comparison, use Node.js 22.13 or newer and npm:

```powershell
Set-Location 'C:\Users\Cristian3\Documents\Codex\2026-08-18\i-x20\work\CommitAtlas'
npm.cmd ci
npm.cmd run check
npm.cmd run start
```

Open [http://localhost:3000](http://localhost:3000), with the Studio at
[http://localhost:3000/studio](http://localhost:3000/studio). Localhost embed URLs remain
preview-only; the public Studio emits its real HTTPS origin.

## Ten-minute guided tour

### 1. Landing page

- Inspect the product promise, rich Atlas, four focused stat widgets, project dashboard explanation,
  and navigation.
- Resize from a desktop width to about 390 pixels. The navigation, glow, cards, and footer should
  remain inside the page with no horizontal scrolling.

### 2. Synthetic Studio preview

- Leave `octocat`, Synthetic, and Ember selected.
- Confirm all eight cards are checked by default: Atlas, Profile, Streak, Breakdown, Rhythm,
  Activity, Languages, and Projects. Two starter projects should be present.
- Select **Preview atlas**.
- The status should say `Synthetic preview loaded`; the dashboard should show Hello-World and
  Spoon-Knife; the Markdown should contain all eight card URLs on the current public origin (or
  localhost when deliberately running the local build).

### 3. Themes and card selection

- Switch through Ember, Aurora, Midnight, and Paper and preview each one.
- Uncheck a card and confirm its Markdown line disappears immediately. Restore it.
- Uncheck every card and select **Copy Markdown**. The status should ask for at least one card.
- Restore all eight and copy again. The clipboard should equal the textarea exactly.
- Switch Motion to `subtle`, preview, and confirm the SVG contains load keyframes plus a
  `prefers-reduced-motion` override. Switch to `none`, preview again, and confirm no animation
  keyframes are emitted. A reduced-motion browser preference must not re-enable motion.

### 4. Project dashboard

- Expand a project. Lifecycle is owner-declared; CommitAtlas never guesses it from recency.
- Leave one workflow blank and preview: CI must say `Not configured`.
- Set another workflow to `ci,release:nightly.yml`; it should survive the preview unchanged.
- Add projects until six exist; the Add button should disable.
- Add allowed HTTPS action URLs such as `https://docs.github.com/` or a GitHub release URL. Try an
  arbitrary host, HTTP URL, or credential-bearing URL; it must not become an action.
- Remove a project after preview. The old dashboard row and Markdown entry must disappear
  immediately, the remaining row becomes a neutral draft, and the status asks for a refresh.
- Preview again to bind the exact current project state.

### 5. Supported live-public path

- Select Live public and preview `Chris0Jeky`.
- Public profile, contribution, language, and configured project data should load without a token.
- Atlas, Streak, and Activity should show the complete requested contribution window from GitHub's
  logged-out public profile view. Breakdown should say `PUBLIC PROFILE %` when using that source;
  it must not turn percentages into exact counts. Rhythm should describe personal consistency and
  explicitly say it is not a GitHub rank.
- For a live profile whose public repository list is truncated, Languages likewise remains selected
  but disabled and is omitted from Markdown rather than producing a broken image URL.
- If a public GitHub endpoint is unavailable or its HTML shape becomes incomplete, the bounded error
  is expected to fail closed. Use Synthetic for the deterministic walkthrough; do not add a
  private-capable token merely to make the demo pass.
- Switch back to Synthetic. All eight retained selections should be available again.

### 6. Error retention

- Enter an invalid handle such as `bad_handle` and preview.
- The status should identify the validation error and say the prior profile remains visible.
- The invalid configuration must not reuse the prior embed origin or project evidence.

### 7. Direct cards and API

Open these public examples:

- [Rich Atlas](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/atlas.svg?user=Chris0Jeky&demo=false&theme=ember&days=365&motion=subtle&layout=wide)
- [Profile SVG](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/profile.svg?user=octocat&demo=true&theme=ember)
- [Streak SVG](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/streak.svg?user=octocat&demo=true&theme=aurora)
- [Breakdown SVG](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/breakdown.svg?user=octocat&demo=true&theme=ember&days=365&motion=subtle)
- [Rhythm SVG](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/rhythm.svg?user=octocat&demo=true&theme=aurora&days=365&motion=none)
- [Activity SVG](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/activity.svg?user=octocat&demo=true&theme=midnight&days=120)
- [Languages SVG](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/languages.svg?user=octocat&demo=true&theme=paper)
- [Projects SVG](https://commitatlas.jeky-tck.chatgpt.site/api/v1/projects.svg?owner=octocat&repos=Hello-World,Spoon-Knife&states=Hello-World:active,Spoon-Knife:maintenance&demo=true&theme=ember)
- [Health JSON](https://commitatlas.jeky-tck.chatgpt.site/api/v1/health)
- [Profile JSON](https://commitatlas.jeky-tck.chatgpt.site/api/v1/profile?user=octocat&demo=true)
- [Project JSON](https://commitatlas.jeky-tck.chatgpt.site/api/v1/projects?owner=octocat&repos=Hello-World,Spoon-Knife&states=Hello-World:active,Spoon-Knife:maintenance&demo=true)
- [Social image](https://commitatlas.jeky-tck.chatgpt.site/og.png)

Each SVG should identify itself accessibly and contain no buttons or scripts. Individual project
actions belong in the HTML Studio dashboard.

### 8. Static generator and Action bundle

From a clean checkout, copy and track `.commitatlas.example.json` as `.commitatlas.json`, then run:

```powershell
npm.cmd run build:static
node packages/static/dist/cli.js generate --config .commitatlas.json --dry-run
node packages/static/dist/cli.js generate --config .commitatlas.json
npm.cmd run test:action
```

Inspect `outputs/commitatlas`: with the example config it should contain the eight canonical SVGs,
`atlas-compact.svg`, `projects.json`, `projects.md`, and `manifest.json` (12 files total). Confirm
one window and generation time across the bundle, re-hash each artifact against its manifest entry,
open every SVG, and inspect both project catalog outputs. The Action proof must regenerate
`action/dist/index.js` without a diff and must not accept or emit a credential.

## QA checklist

- Desktop: 1440x900, no horizontal overflow or clipped controls.
- Mobile: 390x844, one-column Studio with configuration before preview, no horizontal overflow.
- Four themes and all eight surfaces visually inspected.
- Blank/configured workflows remain truthful.
- Project add/remove and safe action links behave as described.
- Synthetic/live-public/error paths expose provenance and never turn unavailable data into zero.
- Generated Markdown matches the selected, currently validated configuration; generated project
  JSON/Markdown catalogs agree with the same snapshot and manifest window.
- Browser console has no application warnings/errors.
- A real keyboard can reach and activate navigation, fields, details, checkboxes, Preview, Copy, and
  action links with a visible focus indicator.

The last item still needs a human or a driver capable of proving sequential focus movement; the
current automation controller could not do so reliably.

## Deliberately outside this demonstration

- No GitHub `v0.1.0` release or npm publication is claimed.
- Optional token-backed hosted contribution data requires a server-side credential that CommitAtlas
  can prove is public-only; static generation and its Action remain credential-free.
