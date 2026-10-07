import assert from 'node:assert/strict';
import test from 'node:test';
import * as staticApi from '../dist/index.js';
import { sceneInputs } from '../../svg/tests/scene.fixture.mjs';

const snapshot = sceneInputs().snapshot;
const raw = {
  version: 1, user: 'scene-demo', theme: 'ember', days: 7, motion: 'none',
  outputDir: 'assets/commitatlas', cards: ['profile'],
  projects: [{ repo: 'scene-demo/atlas', label: 'Atlas', lifecycle: 'active' }],
};

test('a beacon without an identity is not rendered', () => {
  assert.throws(() => staticApi.parseStaticConfig({ ...raw, scenes: ['identity-beacon'] }), /requires a static identity/i);
});

test('a configured identity renders the beacon instead of an empty plate', () => {
  const config = staticApi.parseStaticConfig({
    ...raw, scenes: ['identity-beacon'], identity: { name: 'Ada', tagline: 'Signals', focus: [] },
  });
  const artifacts = staticApi.renderStaticArtifacts(snapshot, config);
  assert.match(artifacts['scene-identity-beacon.svg'], /Ada/);
  assert.match(artifacts['scene-identity-beacon.svg'], /Signals/);
  assert.doesNotMatch(artifacts['scene-identity-beacon.svg'], /UNAVAILABLE/u);
});
