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
