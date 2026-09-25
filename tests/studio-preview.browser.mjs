/**
 * Optional, network-isolated Studio interaction regression.
 * Like the motion harness, this uses an explicitly supplied Playwright installation.
 * This mounts the real React Studio component; Next's navigation-only Link is an
 * anchor in the fixture. Fetch responses are synthetic fixtures; all network requests are blocked.
 * It proves UI state/URL contracts, not production routing or visual rendering.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { build } from "esbuild";

const { values } = parseArgs({ options: {
  "playwright-cli": { type: "string" },
  "browser-executable": { type: "string" },
} });
if (!values["playwright-cli"]) throw new Error("Supply --playwright-cli PATH_TO_PLAYWRIGHT_CLI_JS (same convention as the motion harness)");
const playwrightModule = await import(pathToFileURL(path.join(path.dirname(values["playwright-cli"]), "index.js")).href);
const playwright = playwrightModule.default ?? playwrightModule;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  stdin: {
    contents: 'import {createRoot} from "react-dom/client"; import Studio from "./app/studio/studio-client.tsx"; createRoot(document.getElementById("root")).render(<Studio/>);',
    loader: "tsx", resolveDir: root,
  },
  absWorkingDir: root, bundle: true, write: false, platform: "browser", jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"), define: { "process.env.NODE_ENV": '"test"', "process.env.SITE_ORIGIN": "undefined" },
  plugins: [{ name: "fixture-navigation", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
      contents: 'import {createElement} from "react"; export default function Link({href,children,...props}) { return createElement("a", {...props,href}, children); }',
      resolveDir: root,
    }));
  } }],
});
const browser = await playwright.chromium.launch({
  ...(values["browser-executable"] ? { executablePath: values["browser-executable"] } : {}),
  headless: true,
});
const checks = [];
function check(name, assertion) {
  try { assertion(); checks.push({ name, status: "passed" }); }
  catch (error) { checks.push({ name, status: "failed", message: error.message }); }
}
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error("Fixture page error:", error.message); });
  await page.route("**/*", route => route.abort());
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => {
    window.__studioFixture = { contributions: [], failContributions: false, failProfile: false };
    const freshness = { generatedAt: "2026-09-25T12:00:00.000Z", source: "synthetic-demo", mode: "demo" };
    window.fetch = async input => {
      const url = new URL(String(input), "https://studio.example");
      const fixture = window.__studioFixture;
      const login = url.searchParams.get("user") ?? "octocat";
      function json(value, status = 200) {
        return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/api/v1/profile") return fixture.failProfile
        ? json({ error: { message: "Synthetic profile failure" } }, 503)
        : json({ login, name: "Synthetic preview", profileUrl: `https://github.com/${login}`, publicRepositories: 2, followers: 1, stars: 1, forks: 1, repositoriesTruncated: false, freshness });
      if (url.pathname === "/api/v1/contributions") {
        fixture.contributions.push(url.href);
        return fixture.failContributions ? json({ error: { message: "Synthetic contribution failure" } }, 503)
          : json({ totalContributions: 1, commits: 1, issues: 0, pullRequests: 0, reviews: 0, days: [{ date: "2026-09-25", count: 1 }], freshness });
      }
      if (url.pathname === "/api/v1/projects") return json({ projects: [], freshness });
      throw new Error(`Unexpected fixture request ${url.pathname}`);
    };
  });
  await page.addScriptTag({ content: result.outputFiles[0].text });
  const submit = page.getByRole("button", { name: /Preview atlas/ });
  await submit.click();
  await page.waitForFunction(() => document.querySelector('[role="status"]').textContent.includes("preview loaded"));
  const firstImage = await page.locator(".card-atlas img").getAttribute("src");

  const contributionRequests = await page.evaluate(() => window.__studioFixture.contributions);
  check("collection and preview share the 365-day window", () => {
    assert.equal(new URL(contributionRequests.at(-1)).searchParams.get("days"), "365");
    assert.equal(new URL(firstImage, "https://studio.example").searchParams.get("days"), "365");
  });

  await page.evaluate(() => { window.__studioFixture.failContributions = true; });
  await page.getByLabel("GitHub handle", { exact: true }).fill("octo-alt");
  await page.getByLabel("Card theme", { exact: true }).selectOption("paper");
  await submit.click();
  await page.waitForFunction(() => document.querySelector('[role="status"]').textContent.includes("unavailable for this preview"));
  const image = await page.locator(".card-atlas img").getAttribute("src");
  const compact = await page.locator(".card-atlas source").getAttribute("srcset");
  const link = await page.locator(".card-atlas footer a").getAttribute("href");
  check("partial synthetic preview cannot retain an older configuration's Atlas URL", () => {
    for (const value of [image, compact, link]) {
      const query = new URL(value, "https://studio.example").searchParams;
      assert.equal(query.get("user"), "octo-alt");
      assert.equal(query.get("theme"), "paper");
      assert.equal(query.get("days"), "365");
    }
    assert.notEqual(image, firstImage);
  });

  await page.evaluate(() => { window.__studioFixture.failContributions = false; });
  await page.getByRole("radio", { name: /Live public/ }).check();
  await submit.click();
  await page.waitForFunction(() => document.querySelector('[role="status"]').textContent.includes("Live public preview loaded"));
  const liveImage = await page.locator(".card-atlas img").getAttribute("src");
  await page.evaluate(() => { window.__studioFixture.failProfile = true; });
  await submit.click();
  await page.waitForFunction(() => document.querySelector('[role="status"]').textContent.includes("Synthetic profile failure"));
  const retainedImage = await page.locator(".card-atlas img").getAttribute("src");
  const copyDisabled = await page.getByRole("button", { name: "Copy Markdown" }).isDisabled();
  const footer = await page.locator(".card-atlas footer").innerText();
  const evidenceMessage = await page.getByRole("textbox", { name: "Generated README Markdown" }).inputValue();
  check("failed same-key live refresh retains the preview and withholds current evidence", () => {
    assert.equal(retainedImage, liveImage);
    assert.equal(copyDisabled, true);
    assert.match(footer, /retained preview/);
    assert.match(evidenceMessage, /Run Preview to validate/);
  });
  check("runtime completes without React errors", () => assert.deepEqual(errors, []));
  console.log(JSON.stringify({ browser: browser.version(), node: process.version, fixture: "isolated-real-react-studio", checks }, null, 2));
  if (checks.some(result => result.status === "failed")) process.exitCode = 1;
} finally {
  await browser.close();
}
