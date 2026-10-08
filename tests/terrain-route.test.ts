import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/v1/scenes/[id]/route";
import { withWorkerEnv } from "@/lib/runtime-env";
import { parseSceneXml, sceneVisibleText } from "@/packages/svg/src/scene-svg";

for (const theme of ["aurora", "paper", "midnight", "ember"]) {
  for (const layout of ["wide", "compact"]) {
    for (const days of [365, 730]) {
      test(`hosted terrain retains provenance for ${theme}/${layout}/${days} days`, async () => {
        await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
          const query = new URLSearchParams({ user: "octocat", demo: "true" });
          if (theme !== "aurora") query.set("theme", theme);
          if (days !== 365) query.set("days", String(days));
          if (layout !== "wide") query.set("layout", layout);
          const response = await GET(new Request(`https://example.test/api/v1/scenes/activity-terrain.svg?${query}`), {
            params: Promise.resolve({ id: "activity-terrain.svg" }),
          });
          assert.equal(response.status, 200);
          assert.equal(response.headers.get("content-type"), "image/svg+xml; charset=utf-8");
          assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=300");
          assert.match(response.headers.get("content-security-policy") ?? "", /style-src 'none'/);
          const document = parseSceneXml(await response.text());
          assert.equal(Number(document.root.attrs.viewBox.split(" ")[2]), layout === "compact" ? 480 : 720);
          const visible = sceneVisibleText(document.root);
          for (const reading of ["SYNTHETIC PREVIEW", "TOTAL", "PEAK WEEK", "QUIET RUN", "CURRENT STREAK", "CAPTURED", "UTC"])
            assert.ok(visible.includes(reading), reading);
          assert.doesNotMatch(visible, /UNAVAILABLE/);
        });
      });
    }
  }
}
