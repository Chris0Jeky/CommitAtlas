import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { sceneContext, sceneInputs } from './scene.fixture.mjs';

function input(tag) {
  const value = sceneInputs();
  value.snapshot.projects = {
    version: 1, owner: 'scene-demo', freshness: { ...value.snapshot.freshness },
    projects: [{ repo: 'scene-demo/alpha', primaryLanguage: 'TypeScript',
      releaseState: 'published', release: { tag, publishedAt: value.snapshot.freshness.generatedAt } }],
  };
  return value;
}
for (const tag of ['v1.0.0', 'release/v1.0.0', '版本-1.0', 'релиз-1.0']) {
  test(`nebula retains the observed release for compatible tag ${tag}`, () => {
    const value = input(tag);
    const scene = svg.getScene('nebula');
    assert.equal(scene.buildModel(value).clusters[0].tag, tag);
    for (const backend of ['css', 'smil']) {
      for (const motion of ['none', 'ambient']) {
        const output = svg.renderSceneDefinition(scene, value, { ...sceneContext, backend, motion });
        assert.equal(output.unavailable, false);
        assert.equal((output.svg.match(/r="5\.5"/gu) ?? []).length, 1);
        assert.equal((output.svg.match(/r="1\.6"/gu) ?? []).length, value.snapshot.contributions.days.length);
      }
    }
  });
}
for (const mode of ['stale', 'partial', 'unavailable']) {
  test(`a compatible tag does not authorize a ${mode} project board`, () => {
    const value = input('release/v1.0.0');
    value.snapshot.projects.freshness.mode = mode;
    const result = svg.renderSceneDefinition(svg.getScene('nebula'), value, sceneContext);
    assert.equal((result.svg.match(/r="5\.5"/gu) ?? []).length, 0);
    assert.equal((result.svg.match(/r="1\.6"/gu) ?? []).length, value.snapshot.contributions.days.length);
  });
}
