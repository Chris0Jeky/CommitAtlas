import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGallery } from './gallery';
import { landingSnapshot } from './landing';

for (const [date, rung, state, word] of [
  ['2026-09-01T12:00:00Z', 'derived', 'ready', 'DERIVED SIGNATURE'],
  ['2026-10-26T12:00:00Z', 'derived', 'stale', 'STALE PROJECTION'],
  ['2026-12-01T12:00:00Z', 'unavailable', 'unavailable', 'EXPIRED PROJECTION'],
] as const) {
  test(`signature Gallery tile at ${date} keeps ${rung} evidence and ${state} state`, async () => {
    const snapshot = structuredClone(await landingSnapshot());
    snapshot.freshness.generatedAt = date;
    const tile = buildGallery(snapshot).tiles.find(item => item.id === 'signature');
    assert.ok(tile);
    assert.equal(tile.family, 'signature');
    assert.equal(tile.rung, rung);
    assert.equal(tile.state, state);
    assert.ok(tile.svg.includes(word));
    assert.equal(tile.studioHref, '/studio', 'static-only scene must not invent a hosted Studio selection');
  });
}
