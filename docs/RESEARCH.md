# Ecosystem research

Research refreshed 2026-08-18 from project repositories and GitHub documentation.

## What exists

| Project | Strongest idea | Constraint CommitAtlas addresses |
| --- | --- | --- |
| [GitHub Readme Stats](https://github.com/anuraghazra/github-readme-stats) and its active [Stats Extended successor](https://github.com/stats-organization/github-stats-extended) | Familiar URL-configured stats, language, pin, and WakaTime cards | Shared endpoints are best-effort; project health and evidence freshness are not the core product |
| [GitHub Readme Streak Stats](https://github.com/DenverCoder1/github-readme-streak-stats) | Clear current/longest streak visualization and static Action output | UTC/cache differences need explicit disclosure |
| [GitHub Readme Activity Graph](https://github.com/ashutosh00710/github-readme-activity-graph) | Highly configurable recent-activity chart | A chart alone cannot explain release, CI, lifecycle, or next actions |
| [GitHub Profile Summary Cards](https://github.com/vn7n24fzkq/github-profile-summary-cards) | Cohesive multi-card theme system and scheduled generation | Profile summaries do not provide a true actionable project catalog |
| [GitHub Profile Trophy](https://github.com/ryo-ma/github-profile-trophy) | Compact gamification and flexible layout | Operating cost and opaque ranks weaken factual portfolio storytelling |
| [Metrics](https://github.com/lowlighter/metrics) | Extremely broad plugin architecture | Hundreds of options create a steep setup surface for focused portfolios |
| [User Statistician](https://github.com/cicirello/user-statistician) | Reliable GitHub Action-only generation | Primarily an all-in-one profile summary rather than a live project surface |

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
