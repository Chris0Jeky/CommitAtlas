import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { parseSceneXml, sceneXmlText } from '../dist/scene-svg.js';
import { sceneContext, sceneInputs } from './scene.fixture.mjs';

function assertFooterClearance(output) {
  const { root, nodes } = parseSceneXml(output.svg);
  const [, , width, height] = root.attrs.viewBox.split(' ').map(Number);
  const divider = nodes.find(node => node.name === 'path' && node.attrs['stroke-dasharray'] === '3 3');
  assert.ok(divider, 'stale divider is painted');
  const match = /^M20 ([\d.]+)H([\d.]+)$/u.exec(divider.attrs.d);
  assert.ok(match, 'stale divider has a horizontal, measurable span');
  const lineY = Number(match[1]);
  assert.equal(Number(match[2]), width - 20);
  const readings = nodes.filter(node => node.name === 'text' && /^(?:CURRENT STREAK|NO CURRENT STREAK|LONGEST STREAK|ACTIVE WEEKS)/u.test(sceneXmlText(node)));
  assert.equal(readings.length, 3, 'all three footer readings are retained');
  for (const reading of readings) {
    assert.ok(root.children.includes(reading), 'footer bounds are in root coordinates');
    const baseline = Number(reading.attrs.y);
    const size = Number(reading.attrs['font-size']);
    assert.ok(Number.isFinite(baseline) && size >= 10);
    // Conservative descender allowance, not a font rasterization measurement.
    assert.ok(baseline + size * 0.3 + 8 <= lineY, 'footer intersects stale strip');
  }
  const stale = nodes.find(node => node.name === 'text' && sceneXmlText(node) === 'STALE');
  assert.ok(stale, 'the stale label is not hidden to pass the clearance test');
  const labelY = Number(stale.attrs.y), labelSize = Number(stale.attrs['font-size']);
  assert.ok(labelY - labelSize * 1.2 >= lineY + 8, 'stale label intersects divider');
  assert.ok(labelY + labelSize * 0.3 <= height - 8, 'stale label escapes the frame');
  assert.equal(output.counters.animatedElements, 0);
  assert.doesNotMatch(output.svg, /<animate|<style|>OBSERVED</u);
  return { dividerY: lineY, baselines: readings.map(reading => Number(reading.attrs.y)), labelY };
}

for (const theme of ['aurora', 'midnight', 'ember', 'paper']) {
  for (const layout of ['wide', 'compact']) {
    for (const synthetic of [true, false]) {
      for (const layer of ['root', 'contributions']) {
        test(`chronograph footer clearance: ${theme}/${layout}, synthetic=${synthetic}, stale=${layer}`, () => {
          const value = sceneInputs();
          if (!synthetic) {
            for (const source of [value.snapshot.freshness, value.snapshot.contributions.freshness]) Object.assign(source, { source: 'github-graphql', mode: 'live' });
          }
          (layer === 'root' ? value.snapshot.freshness : value.snapshot.contributions.freshness).mode = 'stale';
          for (const backend of ['css', 'smil']) {
            for (const motion of ['none', 'subtle', 'ambient']) {
              const output = svg.renderSceneDefinition(svg.getScene('chronograph'), value, { ...sceneContext, theme, layout, backend, motion });
              assert.equal(output.unavailable, false);
              assert.deepEqual(assertFooterClearance(output), { dividerY: 444, baselines: [396, 412, 428], labelY: 464 });
            }
          }
        });
      }
    }
  }
}

test('footer oracle rejects a counterexample with the final reading moved onto the stale divider', () => {
  const value = sceneInputs(); value.snapshot.freshness.mode = 'stale';
  const output = svg.renderSceneDefinition(svg.getScene('chronograph'), value, sceneContext);
  assertFooterClearance(output);
  const overlapping = output.svg.replace('y="428"', 'y="444"');
  assert.notEqual(overlapping, output.svg, 'the counterexample actually moves the footer');
  assert.throws(() => assertFooterClearance({ ...output, svg: overlapping }), /footer intersects stale strip/u);
});
