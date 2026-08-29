/**
 * Local, direct-SVG motion measurement for issue #113.
 *
 * It intentionally does not emulate GitHub's Camo proxy or sanitizer. Serve the fixture directory
 * locally, render every probe as <img> and <picture>, capture independent browser frames, and
 * compare decoded RGBA pixels. A changed PNG byte stream is not evidence; a changed pixel is.
 *
 * Example:
 *   node tests/motion-probes/capture.mjs --browser "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --out C:\\temp\\commitatlas-motion
 */
import { createServer } from "node:http";
import { inflateSync } from "node:zlib";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const probes = [
  "css-enter", "css-breathe", "css-plot", "css-from-state-control",
  "smil-transform", "smil-plot", "smil-animate-motion", "css-offset-path",
];
const embeds = ["img", "picture"];
// A 250 ms frame sits inside the shipped CSS-enter effect (60 ms delay + 380 ms duration).
const frameTimes = [0, 250, 500, 2_000, 5_000];
const motionPixelThreshold = { changedPixels: 16, totalChannelDelta: 1_000 };
const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "motion-probes");
const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--reduced-motion") argumentsMap.set(argument, "true");
  else argumentsMap.set(argument, process.argv[++index]);
}
const browser = argumentsMap.get("--browser");
const playwrightEngine = argumentsMap.get("--playwright-engine");
const playwrightCli = argumentsMap.get("--playwright-cli");
const reducedMotion = argumentsMap.has("--reduced-motion");
const outputDirectory = argumentsMap.get("--out");
if ((!browser && !playwrightEngine) || !outputDirectory || (browser && playwrightEngine)) {
  throw new Error("Usage: node tests/motion-probes/capture.mjs (--browser <chromium-exe> | --playwright-engine <chromium|firefox|webkit>) --out <absolute-output-directory>");
}
const selectedProbes = argumentsMap.has("--probe") ? argumentsMap.get("--probe").split(",") : probes;
const selectedEmbeds = argumentsMap.has("--embed") ? argumentsMap.get("--embed").split(",") : embeds;
if (!selectedProbes.every((probe) => probes.includes(probe)) || !selectedEmbeds.every((embed) => embeds.includes(embed))) {
  throw new Error("--probe and --embed must name an included fixture");
}
if (reducedMotion && (!playwrightEngine || !playwrightCli)) {
  throw new Error("--reduced-motion requires --playwright-engine and --playwright-cli so no dependency is installed");
}
if (playwrightCli) {
  if (path.basename(playwrightCli).toLowerCase() !== "cli.js") {
    throw new Error("--playwright-cli must be the Playwright package's cli.js, not a Windows .cmd launcher");
  }
  await access(playwrightCli);
}
const playwrightModule = playwrightCli && reducedMotion
  ? await import(pathToFileURL(path.join(path.dirname(playwrightCli), "index.js")).href)
  : null;
const playwright = playwrightModule?.default ?? playwrightModule;

const server = createServer(async (request, response) => {
  const requestPath = new URL(request.url ?? "/", "http://localhost").pathname;
  const relative = requestPath === "/" || /^\/(?:img|picture)\/[^/]+$/.test(requestPath)
    ? "index.html"
    : requestPath.replace(/^\/+/, "");
  const candidate = path.resolve(fixtureDirectory, relative);
  if (!candidate.startsWith(`${fixtureDirectory}${path.sep}`) && candidate !== path.join(fixtureDirectory, "index.html")) {
    response.writeHead(400).end("invalid fixture path");
    return;
  }
  try {
    const body = await readFile(candidate);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": candidate.endsWith(".svg") ? "image/svg+xml; charset=utf-8" : "text/html; charset=utf-8",
    }).end(body);
  } catch {
    response.writeHead(404).end("missing fixture");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("fixture server did not bind a TCP port");
const origin = `http://127.0.0.1:${address.port}/`;

try {
  // Never replace an evidence directory. A caller must select a fresh, explicit output path.
  await mkdir(outputDirectory);
  const report = {
    protocol: "independent browser screenshots decoded to RGBA and compared pixel-for-pixel",
    browser: browser ?? `Playwright ${playwrightEngine}`,
    origin,
    frameTimesMs: frameTimes,
    motionPixelThreshold,
    reducedMotion,
    rows: [],
  };
  for (const probe of selectedProbes) {
    for (const embed of selectedEmbeds) {
      const directory = path.join(outputDirectory, `${probe}--${embed}`);
      const browserProfile = path.join(outputDirectory, "chrome-profile", `${probe}--${embed}`);
      await mkdir(directory, { recursive: true });
      const captures = [];
      for (const timeMs of frameTimes) {
        const file = path.join(directory, `${timeMs}.png`);
        const page = `${origin}${embed}/${probe}`;
        if (playwrightEngine) {
          const playwrightArgs = [
            "screenshot", "--browser", playwrightEngine,
            "--viewport-size", "720,240", "--wait-for-timeout", String(timeMs), page, file,
          ];
          if (playwright) {
            const instance = await playwright[playwrightEngine].launch();
            const context = await instance.newContext({ viewport: { width: 720, height: 240 }, reducedMotion: "reduce" });
            const browserPage = await context.newPage();
            await browserPage.goto(page);
            await browserPage.waitForTimeout(timeMs);
            await browserPage.screenshot({ path: file });
            await instance.close();
          } else if (playwrightCli) {
            await run(process.execPath, [playwrightCli, ...playwrightArgs]);
          } else {
            const command = ["npx", "--no-install", "playwright", ...playwrightArgs].join(" ");
            await run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command]);
          }
        } else {
          const virtualTime = timeMs > 0 ? [`--virtual-time-budget=${timeMs}`] : [];
          await run(browser, [
            "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
            `--user-data-dir=${browserProfile}`, "--window-size=720,240",
            "--run-all-compositor-stages-before-draw", ...virtualTime,
            `--screenshot=${file}`, page,
          ]);
        }
        captures.push({ timeMs, file: path.relative(outputDirectory, file).replaceAll("\\", "/") });
      }
      const images = await Promise.all(captures.map(async ({ file }) => decodePng(await readFile(path.join(outputDirectory, file)))));
      const differences = images.slice(1).map((image, index) => ({
        fromMs: frameTimes[index],
        toMs: frameTimes[index + 1],
        ...pixelDifference(images[index], image),
      }));
      report.rows.push({
        probe,
        host: "local-direct",
        embed,
        engine: playwrightEngine ? `playwright-${playwrightEngine}` : "chromium-headless",
        captures,
        differences,
        reducedMotionControlPixels: reducedMotion ? countPixel(images[0], [255, 209, 102, 255]) : null,
        verdict: differences.some((difference) => (
          difference.changedPixels >= motionPixelThreshold.changedPixels
          && difference.totalChannelDelta >= motionPixelThreshold.totalChannelDelta
        )) ? "animates" : "frozen at frame zero",
      });
      await writeFile(path.join(outputDirectory, "report.partial.json"), `${JSON.stringify(report, null, 2)}\n`);
    }
  }
  await writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe", windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`browser exited ${code}: ${stderr}`)));
  });
}

function decodePng(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) throw new Error("not a PNG");
  let position = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  const parts = [];
  while (position < buffer.length) {
    const length = buffer.readUInt32BE(position);
    const type = buffer.subarray(position + 4, position + 8).toString("ascii");
    const value = buffer.subarray(position + 8, position + 8 + length);
    position += length + 12;
    if (type === "IHDR") {
      width = value.readUInt32BE(0);
      height = value.readUInt32BE(4);
      bitDepth = value[8];
      colorType = value[9];
      if (bitDepth !== 8 || ![2, 6].includes(colorType) || value[12] !== 0) throw new Error("unsupported PNG format");
    }
    if (type === "IDAT") parts.push(value);
    if (type === "IEND") break;
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const compressed = inflateSync(Buffer.concat(parts));
  const rgba = Buffer.alloc(width * height * 4);
  let source = 0;
  let prior = Buffer.alloc(stride);
  for (let row = 0; row < height; row += 1) {
    const filter = compressed[source++];
    const current = Buffer.from(compressed.subarray(source, source + stride));
    source += stride;
    unfilter(current, prior, filter, channels);
    for (let column = 0; column < width; column += 1) {
      const input = column * channels;
      const output = (row * width + column) * 4;
      rgba[output] = current[input];
      rgba[output + 1] = current[input + 1];
      rgba[output + 2] = current[input + 2];
      rgba[output + 3] = channels === 4 ? current[input + 3] : 255;
    }
    prior = current;
  }
  return { width, height, rgba };
}

function unfilter(current, prior, filter, channels) {
  for (let index = 0; index < current.length; index += 1) {
    const left = index >= channels ? current[index - channels] : 0;
    const up = prior[index];
    const upLeft = index >= channels ? prior[index - channels] : 0;
    if (filter === 1) current[index] = (current[index] + left) & 0xff;
    else if (filter === 2) current[index] = (current[index] + up) & 0xff;
    else if (filter === 3) current[index] = (current[index] + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) current[index] = (current[index] + paeth(left, up, upLeft)) & 0xff;
    else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
  }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  return leftDistance <= upDistance && leftDistance <= upLeftDistance ? left : upDistance <= upLeftDistance ? up : upLeft;
}

function pixelDifference(left, right) {
  if (left.width !== right.width || left.height !== right.height) throw new Error("capture dimensions differ");
  let changedPixels = 0;
  let totalChannelDelta = 0;
  for (let index = 0; index < left.rgba.length; index += 4) {
    const delta = Math.abs(left.rgba[index] - right.rgba[index]) + Math.abs(left.rgba[index + 1] - right.rgba[index + 1]) + Math.abs(left.rgba[index + 2] - right.rgba[index + 2]) + Math.abs(left.rgba[index + 3] - right.rgba[index + 3]);
    if (delta > 0) changedPixels += 1;
    totalChannelDelta += delta;
  }
  return { changedPixels, totalChannelDelta };
}

function countPixel(image, expected) {
  let count = 0;
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (expected.every((value, channel) => image.rgba[index + channel] === value)) count += 1;
  }
  return count;
}
