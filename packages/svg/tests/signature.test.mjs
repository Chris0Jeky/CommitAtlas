import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { computeLensProjectionHash } from '../../core/dist/lens-projection.js';
import { parseSceneXml, sceneVisibleText, sceneXmlText } from '../dist/scene-svg.js';
import { assertSceneContract, stripSceneMotion } from './scene-harness.mjs';
import { sceneContext, sceneInputs } from './scene.fixture.mjs';
import { denseSignatureProjection, maximumSignatureProjection, signatureInputs, signatureProjection } from './signature.fixture.mjs';

const definition = () => {
  const value = svg.getScene('signature');
  assert.ok(value, 'Developer Signature is available through the scene registry');
  return value;
};
const render = (inputs = signatureInputs(), context = {}) => svg.renderSceneDefinition(definition(), inputs, { ...sceneContext, ...context });
const visible = output => sceneVisibleText(parseSceneXml(output).root);
const description = output => sceneXmlText(parseSceneXml(output).root.children.find(node => node.name === 'desc'));

test('signature prints all six exact readings, the archetype and its two strongest dimensions', () => {
  const result = render();
  assert.equal(result.unavailable, false);
  const text = visible(result.svg);
  for (const value of ['DERIVED SIGNATURE', 'SYNTHETIC SHOWCASE', 'not a productivity score', 'The Force Multiplier',
    'Focus', '0.18', 'Shipping', '0.91', 'Collaboration', '0.72', 'Consistency', '1', 'Breadth', '0.99', 'Stewardship', '0.83',
    'STRONGEST DIMENSIONS', 'Consistency 1', 'Breadth 0.99', 'DERIVED COVERAGE', '100%', '1 warning']) assert.ok(text.includes(value), value);
  assert.ok(text.includes(svg.sceneLensDescription(signatureInputs().lens)));
  assert.ok(description(result.svg).includes(svg.sceneLensDescription(signatureInputs().lens)));
  assert.match(description(result.svg), /focus 0\.18.*shipping 0\.91.*collaboration 0\.72.*consistency 1.*breadth 0\.99.*stewardship 0\.83/);
  assert.match(description(result.svg), /fill is decorative/);
});

test('signature satisfies the shared contract with the strict full C0 projection', () => {
  assertSceneContract(definition(), {
    ready: {
      inputs: signatureInputs(),
      textFields: ['lens.archetype.name', 'lens.archetype.description', 'lens.rangeLabel', 'lens.privacyNote', 'lens.coverage.warnings.0.displayText'],
      readings: ['focus 0.18', 'shipping 0.91', 'collaboration 0.72', 'consistency 1', 'breadth 0.99', 'stewardship 0.83', 'The Force Multiplier'],
      visibleReadings: ['0.18', '0.91', '0.72', '0.99', '0.83', '100%', signatureProjection.privacyNote],
      encodings: ['Clockwise', '0 to 1', 'fill is decorative', 'calibration'],
    },
    changed: { inputs: signatureInputs({ mutate(projection) { projection.dna[0].value = 0.19; } }) },
    unavailable: { inputs: sceneInputs() },
  });
});

test('axis order and equal-value ties are stable without weakening the producer tuple', () => {
  const inputs = signatureInputs({ mutate(projection) { for (const axis of projection.dna) axis.value = 0.5; } });
  const model = definition().buildModel(inputs);
  assert.deepEqual(model.axes.map(axis => axis.key), ['focus', 'shipping', 'collaboration', 'consistency', 'breadth', 'stewardship']);
  assert.deepEqual(model.strongest.map(axis => axis.key), ['focus', 'shipping']);
  // The scene model uses keys, so independent model callers cannot accidentally permute the axes.
  const reordered = definition().buildModel({ ...inputs, lens: { ...inputs.lens, dna: [...inputs.lens.dna].reverse() } });
  assert.deepEqual(reordered, model);
  const shuffled = structuredClone(signatureProjection);
  shuffled.dna.reverse();
  shuffled.provenance.projectionHash = computeLensProjectionHash(shuffled);
  assert.throws(() => svg.createLensProjectionContext(shuffled, inputs.snapshot), /LENS_INVALID_PROJECTION/);
});

test('projection age is visible and historical signatures are still; expired projections never build', () => {
  const staleInputs = signatureInputs({ ageDays: 55 });
  const stale = render(staleInputs, { motion: 'ambient', backend: 'smil' });
  assert.equal(stale.unavailable, false);
  assert.match(visible(stale.svg), /STALE PROJECTION.*55 days/);
  assert.match(visible(stale.svg), /LAST DERIVED COVERAGE/);
  assert.equal(stale.counters.animatedElements, 0);
  assert.equal(stale.counters.loopingGroups, 0);
  assert.equal(stale.svg, render(staleInputs).svg);
  let built = false;
  const expired = svg.renderSceneDefinition({ ...definition(), buildModel() { built = true; throw new Error('expired inputs reached the model'); } }, signatureInputs({ ageDays: 91 }), { ...sceneContext, motion: 'ambient' });
  assert.equal(built, false);
  assert.equal(expired.unavailable, true);
  assert.match(visible(expired.svg), /UNAVAILABLE/);
  assert.match(visible(expired.svg), /EXPIRED PROJECTION.*91 days/);
  assert.equal(expired.counters.animatedElements, 0);
});

test('legacy common context cannot impersonate six supplied DNA readings', () => {
  const inputs = sceneInputs({ lens: svg.createPublicDemoLensContext({ dataClass: 'C0', scope: 'public-demo',
    coverage: { complete: 1, partial: 0, unavailable: 0, total: 1, warnings: [] }, privacyNote: 'Synthetic data.' }) });
  const result = render(inputs, { motion: 'ambient' });
  assert.equal(result.unavailable, true);
  assert.equal(result.counters.animatedElements, 0);
  assert.doesNotMatch(visible(result.svg), /Focus|Shipping|100%/);
});

test('zero values stay explicit and high-precision supplied readings are not rounded away', () => {
  for (const value of [0, 0.1234567890123456]) {
    const result = render(signatureInputs({ mutate(projection) { for (const axis of projection.dna) axis.value = value; } }));
    const model = definition().buildModel(signatureInputs({ mutate(projection) { for (const axis of projection.dna) axis.value = value; } }));
    assert.ok(model.axes.every(axis => axis.value === value));
    assert.ok(visible(result.svg).includes(String(value)));
    assert.ok(description(result.svg).includes(`focus ${value}`));
  }
  const emptyCoverage = render(signatureInputs({ mutate(projection) { projection.coverage = { complete: 0, partial: 0, unavailable: 2, total: 2, scorePercent: 0, warnings: projection.coverage.warnings }; } }));
  assert.ok(visible(emptyCoverage.svg).includes('0%'));
  assert.doesNotMatch(emptyCoverage.svg, /NaN|Infinity/);
});

test('radar radius follows each supplied axis instead of filling missing distance', () => {
  for (const value of [0, 0.5, 1]) {
    const result = render(signatureInputs({ mutate(projection) { projection.dna.forEach((axis, index) => { axis.value = index === 0 ? value : 0; }); } }));
    const radar = parseSceneXml(result.svg).nodes.find(node => node.attrs.id?.endsWith('-element-radar'));
    const axis = radar.children.find(node => node.name === 'path' && /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/.test(node.attrs.d));
    const [cx, cy, x, y] = axis.attrs.d.match(/\d+(?:\.\d+)?/g).map(Number);
    const outline = radar.children.find(node => node.name === 'path' && node.attrs.fill !== 'none');
    const coordinates = outline.attrs.d.match(/\d+(?:\.\d+)?/g).map(Number);
    assert.deepEqual(coordinates.slice(0, 2), [cx + (x - cx) * value, cy + (y - cy) * value]);
    assert.deepEqual(coordinates.slice(2), [cx, cy, cx, cy, cx, cy, cx, cy, cx, cy]);
  }
});

test('the neutral score track preserves producer coverage even when observed-count division differs', () => {
  const result = render(signatureInputs({ mutate(projection) {
    projection.coverage = { ...projection.coverage, complete: 1, partial: 0, unavailable: 1, total: 2, scorePercent: 100 };
  } }));
  assert.ok(visible(result.svg).includes('Coverage: 1 complete, 0 partial, 1 unavailable, 2 total. Coverage 100%.'));
  const tracks = parseSceneXml(result.svg).nodes.filter(node => node.name === 'path' && node.attrs['stroke-width'] === '3');
  assert.equal(tracks.length, 2);
  const [start, , end] = tracks[0].attrs.d.match(/\d+(?:\.\d+)?/g).map(Number);
  const fill = tracks[1].attrs.d.match(/h([\d.]+)/)[1];
  assert.equal(Number(fill), end - start);
  assert.equal(tracks[1].attrs.stroke, svg.themes.aurora.muted);
});

test('every theme and width keeps complete maximum text inside the bounded frame', () => {
  const inputs = signatureInputs({ mutate: maximumSignatureProjection });
  for (const theme of Object.keys(svg.themes)) for (const layout of ['wide', 'compact']) {
    const result = render(inputs, { theme, layout });
    const document = parseSceneXml(result.svg);
    const [x, y, width, height] = document.root.attrs.viewBox.split(' ').map(Number);
    assert.deepEqual([x, y, width], [0, 0, layout === 'compact' ? 480 : 860]);
    assert.ok(height <= 1000);
    assert.ok(visible(result.svg).includes(svg.sceneLensDescription(inputs.lens)));
    assert.ok(description(result.svg).includes(inputs.lens.archetype.description));
    for (const node of document.nodes.filter(node => node.name === 'text' || node.name === 'tspan')) {
      if (node.attrs.x === undefined || node.attrs.y === undefined || node.attrs.textLength === undefined) continue;
      const right = Number(node.attrs.x) + Number(node.attrs.textLength);
      assert.ok(Number(node.attrs.x) >= 20 && right <= width - 20, `${sceneXmlText(node)}: horizontal bounds`);
      assert.ok(Number(node.attrs.y) >= 0 && Number(node.attrs.y) <= height - 24, `${sceneXmlText(node)}: vertical bounds`);
    }
    assert.ok(result.counters.bytes <= 80 * 1024);
  }
});

test('wrapped wide archetype names keep clear line spacing under measured font substitution', () => {
  const result = render(signatureInputs({ mutate: maximumSignatureProjection }));
  const name = parseSceneXml(result.svg).nodes.find(node => node.name === 'text' && node.attrs['font-size'] === '28');
  assert.ok(name.children.length >= 3, 'maximum name must exercise multiple wrapped lines');
  for (let index = 1; index < name.children.length; index += 1) {
    const stride = Number(name.children[index].attrs.y) - Number(name.children[index - 1].attrs.y);
    // Controlled Chromium measured 33px rectangles; keep at least two pixels between those rows.
    assert.ok(stride >= 35, 'wide name lines must clear the measured 33px font rectangle');
  }
});

test('wrapped compact range labels clear measured emoji font rectangles', () => {
  const inputs = signatureInputs({ mutate: denseSignatureProjection });
  const result = render(inputs, { layout: 'compact' });
  const range = parseSceneXml(result.svg).nodes.find(node => node.name === 'text' && sceneXmlText(node) === inputs.lens.rangeLabel);
  assert.ok(range.children.length >= 2, 'the admitted emoji range must exercise wrapped lines');
  for (let index = 1; index < range.children.length; index += 1) {
    const stride = Number(range.children[index].attrs.y) - Number(range.children[index - 1].attrs.y);
    // Chromium confirms Noto Color Emoji has 14px ink rectangles at this 11px font size.
    assert.ok(stride >= 15, 'range rows must clear the measured 14px emoji rectangle');
  }
});

test('combined admitted text, word-break, count and numeric extremes stay within the frame body', () => {
  for (const glyph of ['界', '✨']) for (const wordLength of [0, 14, 20, 22, 28]) for (const ageDays of [0, 55, 7300]) {
    const inputs = signatureInputs({ ageDays, maxAgeDays: ageDays === 7300 ? 3650 : 45, mutate(projection) { denseSignatureProjection(projection, { glyph, wordLength }); } });
    for (const layout of ['wide', 'compact']) {
      const result = render(inputs, { layout });
      const document = parseSceneXml(result.svg);
      const [, top, width, height] = document.root.attrs.viewBox.split(' ').map(Number);
      assert.ok(height + top <= 1000, `${glyph}/${wordLength}/${ageDays}/${layout}: body limit`);
      assert.equal(top, ageDays ? -28 : 0, 'the stale strip is outside the bounded body');
      const text = visible(result.svg);
      for (const value of [inputs.lens.archetype.name, inputs.lens.archetype.description, inputs.lens.rangeLabel,
        svg.sceneLensDescription(inputs.lens), 'Collaboration 0.0000010000000000000002', 'Stewardship 0.0000010000000000000002']) {
        assert.ok(text.includes(value), 'all supplied text and precise readings remain visible');
      }
      for (const node of document.nodes.filter(node => node.name === 'tspan' && node.attrs.textLength !== undefined)) {
        assert.ok(Number(node.attrs.x) >= 20 && Number(node.attrs.x) + Number(node.attrs.textLength) <= width - 20);
        assert.ok(Number(node.attrs.y) >= 0 && Number(node.attrs.y) <= height + top - 24);
      }
    }
  }
});

test('compact scale caption clears the bottom axis marker, radar ring and coverage divider', () => {
  const document = parseSceneXml(render(undefined, { layout: 'compact' }).svg);
  const radar = document.nodes.find(node => node.attrs.id?.endsWith('-element-radar'));
  const bottom = radar.children.find(node => node.name === 'text' && sceneXmlText(node) === '4');
  const caption = document.nodes.find(node => node.name === 'text' && sceneXmlText(node) === 'SCALE 0–1');
  const baseline = Number(caption.children[0].attrs.y);
  const captionTop = baseline - Number(caption.attrs['font-size']);
  const calibration = document.nodes.find(node => node.attrs.id?.endsWith('-element-calibration'));
  const ring = calibration.children.find(node => node.name === 'circle');
  assert.ok(captionTop >= Number(bottom.attrs.y) + 6, 'caption must follow the bottom numbered axis with clearance');
  assert.ok(captionTop >= Number(ring.attrs.cy) + Number(ring.attrs.r) + 12, 'caption must sit outside the plot');
  const divider = document.nodes.find(node => node.name === 'path' && /^M24 [\d.]+H456$/.test(node.attrs.d));
  assert.ok(Number(divider.attrs.d.match(/^M24 ([\d.]+)/)[1]) >= baseline + 12, 'coverage divider must follow the caption');
});

test('safe punctuation is escaped and remains readable after strict projection validation', () => {
  const phrase = 'Invented <&> "print"';
  const inputs = signatureInputs({ mutate(projection) {
    projection.archetype.name = phrase; projection.archetype.description = phrase;
    projection.rangeLabel = phrase; projection.privacyNote = phrase;
  } });
  const result = render(inputs);
  assert.ok(visible(result.svg).includes(phrase));
  assert.match(result.svg, /&lt;&amp;&gt;/);
  assert.ok(parseSceneXml(result.svg).nodes.every(node => !['script', 'image', 'foreignObject'].includes(node.name)));
});

test('ambient motion decorates two targets and leaves stationary facts at frame zero', () => {
  for (const backend of ['css', 'smil']) {
    const moving = render(undefined, { motion: 'ambient', backend });
    const still = render(undefined, { backend });
    assert.equal(stripSceneMotion(moving.svg), still.svg);
    assert.equal(moving.counters.animatedElements, 2);
    assert.equal(moving.counters.loopingGroups, 2);
    if (backend === 'smil') assert.match(moving.svg, /repeatDur="45s"/);
    else assert.match(moving.svg, /prefers-reduced-motion:reduce/);
    const document = parseSceneXml(moving.svg);
    for (const group of document.nodes.filter(node => node.name === 'g' && node.children.some(child => child.name.startsWith('animate')))) {
      assert.equal(group.attrs['aria-hidden'], 'true');
      assert.ok(group.children.every(child => child.name !== 'text'));
    }
  }
});
