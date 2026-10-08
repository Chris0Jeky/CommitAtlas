import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "../dist/index.js";
import { assertSceneContract } from "./scene-harness.mjs";
import { exampleScene, exampleFixtures } from "./scene.fixture.mjs";
import { coverageInputs, unavailableCoverageInputs } from "./evidence-coverage.fixture.mjs";

test('painted-reading declarations require actual visible text, not metadata or hidden ink', () => {
  const fixtures = exampleFixtures();
  fixtures.ready.visibleReadings = [...fixtures.ready.readings];
  assertSceneContract(exampleScene(), fixtures);
  const base = exampleScene();
  const variants = [
    ['metadata-only', output => output.replace(/<text x="10" y="20">[^<]*<\/text>/u, '')],
    ['transparent-text', output => output.replace('<text x="10" y="20">', '<text x="10" y="20" opacity="0">')],
    ['no-fill', output => output.replace('<text x="10" y="20">', '<text x="10" y="20" fill="none">')],
    ['zero-font', output => output.replace('<text x="10" y="20">', '<text x="10" y="20" font-size="0">')],
    ['hidden-parent', output => output.replace(/(<text x="10" y="20">[^<]*<\/text>)/u, '<g aria-hidden="true">$1</g>')],
    ['definition-only', output => output.replace(/(<text x="10" y="20">[^<]*<\/text>)/u, '<defs>$1</defs>')],
  ];
  for (const [id, mutate] of variants) {
    const definition = exampleScene({ id, render(model, context) { return mutate(base.render(model, context)); } });
    assert.throws(() => assertSceneContract(definition, fixtures), /visible text omits reading/u, id);
  }
});

test('visible-reading declarations reject misspelled shapes and empty assertions', () => {
  for (const value of ['not-an-array', null, [1], [''], ['   ']]) {
    const fixtures = exampleFixtures();
    fixtures.ready.visibleReadings = value;
    assert.throws(() => assertSceneContract(exampleScene(), fixtures), /visibleReadings/u);
  }
});

test('an accessible-only reading remains supported unless explicitly declared visible', () => {
  const fixtures = exampleFixtures();
  fixtures.ready.readings.push('observations');
  assertSceneContract(exampleScene(), fixtures);
  fixtures.ready.visibleReadings = ['observations'];
  assert.throws(() => assertSceneContract(exampleScene(), fixtures), /visible text omits reading observations/u);
});

test('the production evidence-coverage scene paints its declared primary readings', () => {
  const ready = coverageInputs(), changed = structuredClone(ready);
  changed.snapshot.projects.projects[0].ci.state = 'failing';
  const readings = ['4 PASSING', '1 STALE', '1 UNCONFIGURED', '3 PUBLISHED', 'NOT WINDOW-SCOPED', 'NOT OBSERVED', 'NOT REQUESTED', 'LIVE'];
  assertSceneContract(svg.getScene('evidence-coverage'), {
    ready: {inputs: ready, textFields: [], readings, visibleReadings: readings, encodings: ['Bar length', 'Neutral ink', 'Row order', 'Dashed', 'scan']},
    changed: {inputs: changed}, unavailable: {inputs: unavailableCoverageInputs()},
  });
});
