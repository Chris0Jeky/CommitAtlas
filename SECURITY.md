# Security policy

CommitAtlas renders public GitHub data and may use a server-side GitHub token when self-hosted. A token must never be placed in a card URL, browser bundle, project manifest, issue, log, or committed file.

## Supported versions

Security fixes are provided for the latest published minor release.

| Version | Supported |
| --- | --- |
| Latest `0.x` | Yes |
| Older releases | No |

## Report a vulnerability

Please use this repository's **Report a vulnerability** option under the Security tab. Do not disclose an exploitable issue in a public issue, discussion, or pull request.

Include the affected route or package, reproduction steps, impact, and any safe proof of concept. Remove tokens, private repository names, and personal data from the report. You will receive acknowledgement as soon as practical; this volunteer project does not promise a fixed response SLA.

## Deployment responsibilities

The hosted public instance is public-data only. Self-hosters are responsible for limiting token scopes, rotating exposed credentials, reviewing generated public artifacts, and configuring platform access controls. A generated SVG becomes public wherever it is embedded or committed.

### HTML response policy

The production Worker adds an enforced Content Security Policy, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: no-referrer`, and `X-Frame-Options: DENY` to HTML responses,
including not-found documents and gallery revalidation responses. Bodies, cache directives,
and ETags are unchanged. JSON/SVG APIs retain their separate, stricter sandbox policies.

HTML resources are same-origin, with `data:` gallery images, `blob:` Studio SVG previews,
and the existing `https://pulseboard-observatory.commit-atlas.workers.dev` collector as
explicit exceptions. Production fonts are self-hosted by the build. Framing, objects,
workers, base elements, inline event-handler attributes, and JavaScript eval are disallowed.

This is baseline hardening, not a strict CSP or a complete XSS defense: inline script
elements remain allowed for Vinext hydration and the pre-paint theme/route bootstraps,
and inline styles remain allowed for React and the Pulseboard SDK. A strict script policy
needs framework-compatible nonces or hashes, not removal of that allowance alone. An
existing explicit HTML CSP is preserved. The default CSP is omitted during development
for Vite HMR/CDN fonts, without adding those sources or eval to the production policy.
Forks that replace the collector must update the explicit `connect-src` exception as well.
