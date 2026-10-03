// Synthetic-only network boundary for executing the built Action, never a live request.
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const cells = [];
for (let i = 0; i < 365; i++) {
  const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
  cells.push(`<td data-date="${day}" data-level="0"></td><tool-tip>No contributions on ${day}.</tool-tip>`);
}
const html = `<div>${cells.join('')}</div>`;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (new Headers(init?.headers).has('authorization')) throw new Error('Synthetic Action must not receive a credential');
  if (url.origin === 'https://github.com' && url.pathname === '/users/scene-demo/contributions') return new Response(html, { headers: { 'content-type': 'text/html' } });
  if (url.origin !== 'https://api.github.com') throw new Error('Unexpected synthetic Action origin');
  if (url.pathname === '/users/scene-demo') return json({ login: 'scene-demo', name: 'Synthetic Action fixture', public_repos: 0, followers: 0, following: 0 });
  if (url.pathname === '/users/scene-demo/repos') return json([]);
  if (url.pathname === '/repos/scene-demo/atlas') return json({ name: 'atlas', private: false, default_branch: 'main', stargazers_count: 0, forks_count: 0, open_issues_count: 0 });
  if (url.pathname === '/repos/scene-demo/atlas/releases/latest') return json({}, 404);
  throw new Error('Unexpected synthetic Action route');
};
