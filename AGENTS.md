# CommitAtlas — Codex guide

CommitAtlas is an open-source GitHub portfolio toolkit: accessible SVG cards, a project-health
dashboard, and static-generation utilities. Public GitHub data is the default; private data and
tokens must never enter rendered fixtures, logs, query strings, or tracked files.

## Run and prove

- Install: `npm ci`
- Develop: `npm run dev`
- Focused source check: `npm run typecheck && npm run lint`
- Product render check: `npm test`
- Full local gate: `npm run check`
- Keep Vitest-style test runners at two workers or fewer on this Windows machine.

## Map

- `app/`: public Studio/dashboard and HTTP routes.
- `worker/`: Cloudflare/Sites entry point and runtime bindings.
- `tests/`: built-output smoke tests; focused unit fixtures arrive beside the first data module.
- `docs/PROJECT_STATE.md`: live shipped/next/blocked state; read it before implementation.

## Product invariants

- An unknown, missing, or stale signal is never displayed as healthy or passing.
- User text is schema-bounded and XML-escaped; outbound data hosts stay GitHub-owned.
- README SVGs summarize; per-project Docs/Install/Download links belong in HTML.
- Add a fixture and focused test with every metric, renderer, or GitHub response shape.

## Authority

T1 sandbox, public synthetic-safe remote, push/merge free inside the global T1 gate. No human-todo
file. Global Codex working agreements remain binding and are not restated here.
