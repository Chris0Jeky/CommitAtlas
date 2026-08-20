# Ecosystem research

Research refreshed 2026-08-21 from the competitors' primary repositories and GitHub documentation.

## What exists

| Project | Strongest idea | Constraint CommitAtlas addresses |
| --- | --- | --- |
| [GitHub Readme Stats](https://github.com/anuraghazra/github-readme-stats) | URL-configured stats, language, pin, gist, WakaTime, and themed cards; its README also documents GitHub Action generation | The project warns that its public endpoint is not reliable and recommends self-deployment. CommitAtlas uses a credential-free, one-snapshot generator with provenance and hashes. |
| [GitHub Readme Streak Stats](https://github.com/DenverCoder1/github-readme-streak-stats) | Clear current/longest streak embeds plus a scheduled GitHub Action path | Its README recommends self-hosting for reliability. CommitAtlas makes the returned-window boundary and source explicit and keeps streak beside other portfolio signals. |
| [GitHub Readme Activity Graph](https://github.com/ashutosh00710/github-readme-activity-graph) | A focused, themeable activity graph with URL customization | The documented surface is a graph; CommitAtlas adds categorized breakdown, personal rhythm, project lifecycle, CI, release, and action outputs around the same public evidence. |
| [GitHub Profile Summary Cards](https://github.com/vn7n24fzkq/github-profile-summary-cards) | A cohesive set of generated profile cards with API/Vercel and scheduled Action workflows | Its documented Action setup uses a token and writes cards on a schedule. CommitAtlas keeps v1 public-only and credential-free, with explicit unavailable states instead of a private-capable mode. |
| [GitHub Profile Trophy](https://github.com/ryo-ma/github-profile-trophy) | Compact themed trophies with explicit rank bands and flexible filtering | CommitAtlas deliberately does not convert personal activity into a comparative GitHub rank; Rhythm is a transparent within-window consistency summary. |
| [Metrics](https://github.com/lowlighter/metrics) | Broad plugin/template system: the primary README currently documents 47 plugins and 335 options | That breadth is useful for exploration but creates a large configuration surface. CommitAtlas keeps a narrower eight-card contract and a bounded project catalog. |
| [User Statistician](https://github.com/cicirello/user-statistician) | A GitHub Action that generates a detailed, customizable SVG summary and can split categories into separate SVGs | Its documented workflow commits and pushes generated images by default. CommitAtlas's CLI and Action never commit, push, publish, or deploy; the caller owns those operations and also gets `projects.json`/`projects.md`. |

## Product gap

The whitespace is a truthful portfolio operating surface: beautiful embeds plus an HTML dashboard
that combines explicit project lifecycle, exact CI/release state, action links, data provenance,
freshness, and graceful unknowns. CommitAtlas keeps the proven URL-embed and static-generation
patterns while sharing one typed model and theme system across every output.

## Data-plane constraints

GitHub recommends authenticated requests, conditional requests, bounded concurrency, and explicit
handling of rate-limit responses. CommitAtlas therefore batches GraphQL contribution data, uses REST
for repository/workflow/release details, retains ETags, and caps project boards rather than polling
an unbounded portfolio. See GitHub's [REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api), [GraphQL user schema](https://docs.github.com/en/graphql/reference/users), [workflow API](https://docs.github.com/en/rest/actions/workflows), and [release API](https://docs.github.com/en/rest/releases/releases).

The public-data boundary is also grounded in GitHub's [profile contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference): public contributions are visible to anyone, private contributions can be anonymized, and contribution categories have qualifying rules and display limits. CommitAtlas therefore labels activity mixes from logged-out calendar-year profile views as public-profile percentages that are not scoped to the requested contribution window; it renders window-scoped categorized counts only when the input source is explicitly exact. It does not infer private repository details or turn a percentage into a count.
