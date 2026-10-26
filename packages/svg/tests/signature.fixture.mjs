import { readFile } from 'node:fs/promises';
import { computeLensProjectionHash, COVERAGE_WARNINGS } from '../../core/dist/lens-projection.js';
import { createLensProjectionContext } from '../dist/index.js';
import { sceneInputs } from './scene.fixture.mjs';

export const signatureProjection = JSON.parse(await readFile(new URL('../../../research-contracts/lens-projection/v1/showcase.fixture.json', import.meta.url), 'utf8'));

/** Keep the producer fixture's timestamp unchanged; move only the explicit synthetic snapshot. */
export function signatureInputs({ ageDays = 0, maxAgeDays = 45, mutate } = {}) {
  const projection = structuredClone(signatureProjection);
  mutate?.(projection);
  projection.provenance.projectionHash = computeLensProjectionHash(projection);
  const inputs = sceneInputs();
  inputs.snapshot.freshness.generatedAt = new Date(Date.parse(signatureProjection.generatedAt) + ageDays * 86_400_000).toISOString();
  inputs.lens = createLensProjectionContext(projection, inputs.snapshot, maxAgeDays);
  return inputs;
}

export function maximumSignatureProjection(projection) {
  projection.archetype.name = '界'.repeat(40);
  projection.archetype.description = '界'.repeat(160);
  projection.rangeLabel = '界'.repeat(40);
  projection.privacyNote = '界'.repeat(240);
  projection.coverage.warnings = Object.entries(COVERAGE_WARNINGS).map(([code, displayText]) => ({ code, displayText }));
}

/** Combine admitted text, count and numeric extremes instead of exercising each in isolation. */
export function denseSignatureProjection(projection, { glyph = '✨', wordLength = 0 } = {}) {
  maximumSignatureProjection(projection);
  const pattern = wordLength ? `${glyph.repeat(wordLength)} ` : glyph;
  const value = length => pattern.repeat(length).slice(0, length);
  projection.archetype.name = value(40);
  projection.archetype.description = value(160);
  projection.rangeLabel = value(40);
  projection.privacyNote = value(240);
  projection.coverage = { ...projection.coverage, complete: 333333, partial: 333333, unavailable: 333334, total: 1000000, scorePercent: 55 };
  for (const axis of projection.dna) axis.value = ['collaboration', 'stewardship'].includes(axis.key) ? 0.0000010000000000000002 : 0;
}
