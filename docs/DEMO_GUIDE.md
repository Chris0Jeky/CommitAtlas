# CommitAtlas demonstration guide

This walkthrough exercises every implemented v0.1 demonstration surface without requiring a
GitHub token. It uses the production build and synthetic data for repeatability, then shows the
supported live-public partial-data path.

## Start the production demo

Requirements: Node.js 22.13 or newer and npm.

```powershell
Set-Location 'C:\Users\Cristian3\Documents\Codex\2026-08-18\i-x20\work\CommitAtlas'
npm.cmd ci
npm.cmd run check
npm.cmd run start
```

Open [http://localhost:3000](http://localhost:3000). The Studio is at
[http://localhost:3000/studio](http://localhost:3000/studio).

`localhost` embed URLs are preview-only. A deployment must regenerate Markdown from its real HTTPS
origin before those URLs belong in a README.

## Ten-minute guided tour

### 1. Landing page

- Inspect the product promise, five-card toolkit, project dashboard explanation, and navigation.
- Resize from a desktop width to about 390 pixels. The navigation, glow, cards, and footer should
  remain inside the page with no horizontal scrolling.

### 2. Synthetic Studio preview

- Leave `octocat`, Synthetic, and Ember selected.
- Confirm all five card choices are checked and two starter projects are present.
- Select **Preview atlas**.
- The status should say `Synthetic preview loaded`; the dashboard should show Hello-World and
  Spoon-Knife; the Markdown should contain Profile, Streak, Activity, Languages, and Projects URLs
  on the current localhost origin.

### 3. Themes and card selection

- Switch through Ember, Aurora, Midnight, and Paper and preview each one.
- Uncheck a card and confirm its Markdown line disappears immediately. Restore it.
- Uncheck every card and select **Copy Markdown**. The status should ask for at least one card.
- Restore all five and copy again. The clipboard should equal the textarea exactly.

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

- Select Live public and preview `octocat`.
- Public profile/project data should load without a token.
- Contribution history should be unavailable, not zero. Streak and Activity remain selected but
  disabled and are omitted from Markdown; Profile, Languages, and Projects remain.
- Switch back to Synthetic. All five retained selections should be available again.

### 6. Error retention

- Enter an invalid handle such as `bad_handle` and preview.
- The status should identify the validation error and say the prior profile remains visible.
- The invalid configuration must not reuse the prior embed origin or project evidence.

### 7. Direct cards and API

Open these local examples:

- [Profile SVG](http://localhost:3000/api/v1/cards/profile.svg?user=octocat&demo=true&theme=ember)
- [Streak SVG](http://localhost:3000/api/v1/cards/streak.svg?user=octocat&demo=true&theme=aurora)
- [Activity SVG](http://localhost:3000/api/v1/cards/activity.svg?user=octocat&demo=true&theme=midnight&days=120)
- [Languages SVG](http://localhost:3000/api/v1/cards/languages.svg?user=octocat&demo=true&theme=paper)
- [Projects SVG](http://localhost:3000/api/v1/projects.svg?owner=octocat&repos=Hello-World,Spoon-Knife&states=Hello-World:active,Spoon-Knife:maintenance&demo=true&theme=ember)
- [Health JSON](http://localhost:3000/api/v1/health)
- [Profile JSON](http://localhost:3000/api/v1/profile?user=octocat&demo=true)
- [Project JSON](http://localhost:3000/api/v1/projects?owner=octocat&repos=Hello-World,Spoon-Knife&states=Hello-World:active,Spoon-Knife:maintenance&demo=true)
- [Social image](http://localhost:3000/og.png)

Each SVG should identify itself accessibly and contain no buttons or scripts. Individual project
actions belong in the HTML Studio dashboard.

## QA checklist

- Desktop: 1440x900, no horizontal overflow or clipped controls.
- Mobile: 390x844, one-column Studio, no horizontal overflow.
- Four themes and five cards visually inspected.
- Blank/configured workflows remain truthful.
- Project add/remove and safe action links behave as described.
- Synthetic/live-public/error paths expose their provenance and unavailable data.
- Generated Markdown matches the selected, currently validated configuration.
- Browser console has no application warnings/errors.
- A real keyboard can reach and activate navigation, fields, details, checkboxes, Preview, Copy, and
  action links with a visible focus indicator.

The last item still needs a human or a driver capable of proving sequential focus movement; the
current automation controller could not do so reliably.

## Deliberately outside this demonstration

- No Sites deployment or public production URL is claimed.
- No GitHub release or npm publication is claimed.
- Token-backed live contribution data requires a server-side credential that CommitAtlas can prove
  is public-only; do not paste a token into the browser.
- The static five-file generator and Node 24 GitHub Action are planned in
  [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md) but are not implemented yet.
