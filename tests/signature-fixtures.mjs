import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getScene, renderSceneDefinition } from '../packages/svg/dist/index.js';
import { denseSignatureProjection, maximumSignatureProjection, signatureInputs } from '../packages/svg/tests/signature.fixture.mjs';

export const SIGNATURE_CASES = Object.freeze(['fresh', 'stale', 'expired', 'maximum', 'maximum-stale', 'dense', 'dense-spaced', 'dense-cjk', 'dense-stale', 'zero', 'precise', 'escaped']);
/** Exact authenticated inputs for rendering and independent browser reading comparisons. */
export function signatureFixtureInputs(scenario = 'fresh') {
  if (!SIGNATURE_CASES.includes(scenario)) throw new Error('unknown signature fixture');
  const options = scenario === 'stale' ? { ageDays: 55 } : scenario === 'expired' ? { ageDays: 91 } :
    scenario === 'maximum' ? { mutate: maximumSignatureProjection } :
    scenario === 'maximum-stale' ? { ageDays: 55, mutate: maximumSignatureProjection } :
    scenario === 'dense' ? { mutate: denseSignatureProjection } :
    scenario === 'dense-spaced' ? { mutate(projection) { denseSignatureProjection(projection, { wordLength: 14 }); } } :
    scenario === 'dense-cjk' ? { mutate(projection) { denseSignatureProjection(projection, { glyph: '界', wordLength: 20 }); } } :
    scenario === 'dense-stale' ? { ageDays: 55, mutate: denseSignatureProjection } :
    scenario === 'zero' ? { mutate(projection) { for (const axis of projection.dna) axis.value = 0; } } :
    scenario === 'precise' ? { mutate(projection) { for (const axis of projection.dna) axis.value = 0.1234567890123456; } } :
    scenario === 'escaped' ? { mutate(projection) {
      for (const key of ['name', 'description']) projection.archetype[key] = 'Invented <&> "print"';
      projection.rangeLabel = 'Invented <&> "print"'; projection.privacyNote = 'Invented <&> "print"';
    } } : {};
  return signatureInputs(options);
}
export function renderSignatureFixture({ scenario = 'fresh', theme = 'ember', layout = 'wide', motion = 'none', backend = 'css' } = {}) {
  const definition = getScene('signature');
  if (!definition) throw new Error('build the SVG package before rendering Signature fixtures');
  return renderSceneDefinition(definition, signatureFixtureInputs(scenario), {
    theme, layout, motion, backend, pack: 'survey', instanceNamespace: 'signatureEvidence', seed: '',
  });
}

/** Reproducible local image fixtures. This is not browser playback or GitHub/Camo evidence. */
export async function writeSignatureFixtures(directory) {
  await mkdir(directory, { recursive: true });
  const manifest = [];
  for (const scenario of SIGNATURE_CASES) for (const theme of ['ember', 'aurora', 'midnight', 'paper']) {
    for (const layout of ['wide', 'compact']) for (const backend of ['css', 'smil']) for (const motion of ['none', 'ambient']) {
      const options = { scenario, theme, layout, backend, motion };
      const rendered = renderSignatureFixture(options);
      const filename = `${scenario}-${theme}-${layout}-${backend}-${motion}.svg`;
      await writeFile(path.join(directory, filename), rendered.svg);
      manifest.push({ ...options, filename, sha256: createHash('sha256').update(rendered.svg).digest('hex'), ...rendered.counters, unavailable: rendered.unavailable });
    }
  }
  await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify({ version: 1, fixtureGeneratedAt: '2026-09-01T12:00:00Z', entries: manifest }, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--out') throw new Error('Usage: node tests/signature-fixtures.mjs --out <directory>');
  const entries = await writeSignatureFixtures(path.resolve(process.argv[3]));
  process.stdout.write(`Wrote ${entries.length} deterministic Signature SVG fixtures.\n`);
}
