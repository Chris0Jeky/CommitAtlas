import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
const require = createRequire(path.resolve('package.json'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

test('all locked fflate copies use the reviewed patched 0.7 release', () => {
  const copies = Object.entries(lock.packages).filter(([name]) => name.endsWith('node_modules/fflate'));
  assert.ok(copies.length > 0);
  for (const [name, value] of copies) assert.equal(value.version, '0.7.5', name);
});
test('the installed native image stack includes patched librsvg', () => {
  const sharp = require('sharp');
  assert.equal(sharp.versions.sharp, '0.35.5');
  const [major, minor, patch] = sharp.versions.rsvg.split('.').map(Number);
  assert.ok(major > 2 || (major === 2 && (minor > 63 || (minor === 63 && patch >= 2))), JSON.stringify(sharp.versions));
});
test('patched codecs preserve a small ZIP round-trip and bounded SVG rasterization', async () => {
  const { zipSync, unzipSync, strToU8, strFromU8 } = require('fflate');
  const fixture = { 'demo.txt': strToU8('Synthetic CommitAtlas codec check') };
  const archive = zipSync(fixture, { mtime: new Date('2026-01-01T00:00:00Z') });
  assert.equal(strFromU8(unzipSync(archive)['demo.txt']), 'Synthetic CommitAtlas codec check');
  const sharp = require('sharp');
  const input = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="black"/></svg>');
  const png = await sharp(input, { limitInputPixels: 16 }).png().toBuffer();
  const info = await sharp(png).metadata();
  assert.equal(info.width, 2); assert.equal(info.height, 2); assert.equal(info.format, 'png');
});
test('a ZIP64 sentinel without its required extra field is rejected within a bounded child', () => {
  // Invented 242-byte invalid fixture for GHSA-px8p-9vwx-vf98, no filesystem extraction.
  // The child deadline also bounds regression behavior on a vulnerable dependency.
  const result = spawnSync(process.execPath, ['--input-type=commonjs', '-e', `
    const { unzipSync } = require('fflate');
    const bytes = Buffer.alloc(242);
    bytes.writeUInt32LE(0x06064b50, 64);
    bytes.writeUInt32LE(1, 96);
    bytes.writeUInt32LE(120, 112);
    bytes.writeUInt32LE(0x02014b50, 120);
    bytes.writeUInt32LE(0xffffffff, 140);
    bytes.writeUInt32LE(0xffffffff, 144);
    bytes.writeUInt32LE(64, 208);
    bytes.writeUInt32LE(0x06054b50, 220);
    bytes.writeUInt16LE(1, 228);
    bytes.writeUInt32LE(0xffffffff, 236);
    try { unzipSync(bytes); process.exitCode = 2; }
    catch (error) { process.stdout.write(JSON.stringify({ rejected: true, code: error.code })); }
  `], { encoding: 'utf8', timeout: 3_000, maxBuffer: 4096, windowsHide: true });
  assert.equal(result.error, undefined, `invalid ZIP64 did not terminate: ${result.error}`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).rejected, true);
});
