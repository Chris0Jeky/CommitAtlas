import { sceneInputs } from './scene.fixture.mjs';

export function coverageInputs() {
  const inputs = sceneInputs();
  const s = inputs.snapshot;
  s.freshness = { ...s.freshness, mode: 'live', source: 'github-profile-html' };
  s.profile.freshness = { ...s.freshness, source: 'github-rest' };
  s.contributions.freshness = { ...s.freshness };
  s.contributions.breakdownBasis = 'public-profile-percentages';
  s.contributions.commits = 60; s.contributions.issues = 10;
  s.contributions.pullRequests = 20; s.contributions.reviews = 10;
  s.projects = {
    version: 1, owner: 'scene-demo', freshness: { ...s.freshness, source: 'github-rest' },
    projects: ['passing', 'passing', 'passing', 'passing', 'stale', 'unconfigured'].map((state, i) => ({
      repo: `scene-demo/project-${i}`, name: `Project ${i}`, description: null,
      sourceUrl: `https://github.com/scene-demo/project-${i}`, websiteUrl: null,
      lifecycle: 'active', primaryLanguage: null, stars: 0, forks: 0, openIssuesAndPullRequests: 0,
      pushedAt: null, license: null,
      ci: { state, label: state, workflow: state === 'unconfigured' ? null : 'ci.yml', url: null, checkedAt: null, headSha: null },
      releaseState: i < 3 ? 'published' : i === 3 ? 'none' : 'unavailable',
      release: i < 3 ? { tag: 'v1', name: 'Release', url: `https://github.com/scene-demo/project-${i}/releases/tag/v1`, publishedAt: s.freshness.generatedAt, download: null } : null,
    })),
  };
  return inputs;
}
export function unavailableCoverageInputs() {
  const inputs = coverageInputs();
  inputs.snapshot.freshness.mode = 'unavailable';
  inputs.snapshot.contributions.freshness.mode = 'unavailable';
  inputs.snapshot.projects.freshness.mode = 'unavailable';
  return inputs;
}
