import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET, OPTIONS } from "@/app/api/v1/probes/motion/[probe]/route";

const fixtureDirectory = path.resolve("tests/fixtures/motion-probes");
const probeIds = [
  "css-breathe",
  "css-enter",
  "css-from-state-control",
  "css-offset-path",
  "css-plot",
  "reduced-motion-control",
  "smil-animate-motion",
  "smil-plot",
  "smil-transform",
] as const;

test("serves each canonical motion fixture byte-for-byte through the SVG response contract", async () => {
  for (const probe of probeIds) {
    // Git can materialize a pre-existing Windows worktree with CRLF before the
    // fixture-specific eol=lf attribute is present. The committed probe bytes
    // are canonical LF, so normalize only that checkout representation here.
    const expected = Buffer.from(
      (await readFile(path.join(fixtureDirectory, `${probe}.svg`), "utf8")).replaceAll("\r\n", "\n"),
      "utf8",
    );
    const response = await GET(
      new Request(`https://example.test/api/v1/probes/motion/${probe}.svg`),
      { params: Promise.resolve({ probe: `${probe}.svg` }) },
    );
    const actual = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200, probe);
    assert.deepEqual(actual, expected, `${probe} payload changed`);
    assert.equal(response.headers.get("content-type"), "image/svg+xml; charset=utf-8", probe);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=300", probe);
    assert.equal(response.headers.get("access-control-allow-origin"), "*", probe);
    assert.equal(response.headers.get("cross-origin-resource-policy"), "cross-origin", probe);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", probe);
    assert.equal(response.headers.get("etag"), `W/"${sha256(expected)}"`, probe);

    const csp = response.headers.get("content-security-policy") ?? "";
    assert.match(csp, /script-src 'none'/, probe);
    assert.match(csp, /style-src 'unsafe-inline'/, probe);
    assert.match(csp, /object-src 'none'/, probe);
    assertSafeSvg(actual.toString("utf8"), probe);
  }
});

test("returns a bounded uncached error for unknown and path-like probe ids", async () => {
  for (const probe of [
    "unknown.svg",
    "constructor.svg",
    "toString.svg",
    "../css-breathe.svg",
    "css-breathe%2F..%2Fother.svg",
    "css-breathe",
    "css-breathe.svg/other",
    "css-breathe.svg?x=<svg>",
  ]) {
    const response = await GET(
      new Request(`https://example.test/api/v1/probes/motion/${probe}`),
      { params: Promise.resolve({ probe }) },
    );
    assert.equal(response.status, 400, probe);
    assert.equal(response.headers.get("cache-control"), "no-store", probe);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/, probe);
    const body = await response.json() as { status?: string; error?: { code?: string } };
    assert.equal(body.status, "error", probe);
    assert.equal(body.error?.code, "invalid_input", probe);
  }
});

test("rejects query variants before serving a canonical probe", async () => {
  for (const query of ["?cachebust=1", "?x=", "?x=%3Csvg%3E"]) {
    const response = await GET(
      new Request(`https://example.test/api/v1/probes/motion/css-enter.svg${query}`),
      { params: Promise.resolve({ probe: "css-enter.svg" }) },
    );
    assert.equal(response.status, 400, query);
    assert.equal(response.headers.get("cache-control"), "no-store", query);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/, query);
    const body = await response.json() as { status?: string; error?: { code?: string } };
    assert.equal(body.status, "error", query);
    assert.equal(body.error?.code, "invalid_input", query);
  }
});

test("keeps the standard CORS and CSP headers on OPTIONS", () => {
  const response = OPTIONS();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.match(response.headers.get("content-security-policy") ?? "", /script-src 'none'/);
});

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeSvg(svg: string, probe: string): void {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, probe);
  assert.match(svg, /<title id="title">/, probe);
  assert.match(svg, /<desc id="desc">/, probe);
  for (const forbidden of [
    /<script\b/i,
    /<foreignObject\b/i,
    /\bon[a-z]+\s*=/i,
    /(?:href|xlink:href)\s*=\s*["']https?:/i,
    /@import\b/i,
  ]) {
    assert.doesNotMatch(svg, forbidden, `${probe} contains ${forbidden}`);
  }
}
