/** Optional loopback HTTP adapter for the built Worker. Never used by deployment or npm run check. */
import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../dist/server/index.js";

const root = await realpath(fileURLToPath(new URL("../dist/client/", import.meta.url)));
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain", ".woff2": "font/woff2" };
async function asset(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
  try {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const filename = await realpath(path.resolve(root, `.${pathname}`));
    if (!filename.startsWith(`${root}${path.sep}`)) return new Response(null, { status: 404 });
    const body = await readFile(filename);
    return new Response(request.method === "HEAD" ? null : body, { headers: { "content-type": mime[path.extname(filename)] ?? "application/octet-stream" } });
  } catch { return new Response(null, { status: 404 }); }
}
const server = http.createServer(async (incoming, outgoing) => {
  try {
    if (incoming.method !== "GET" && incoming.method !== "HEAD") { outgoing.writeHead(405); outgoing.end(); return; }
    const request = new Request(new URL(incoming.url, "https://studio.example.test"), { method: incoming.method, headers: incoming.headers });
    const staticResponse = await asset(request);
    const response = staticResponse.status === 404 ? await worker.fetch(request, { GITHUB_TOKEN: "", ASSETS: { fetch: asset } }, { waitUntil(promise) { void promise.catch(console.error); }, passThroughOnException() {} }) : staticResponse;
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(incoming.method === "HEAD" ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error); outgoing.writeHead(500); outgoing.end("QA adapter error"); }
});
server.listen(3471, "127.0.0.1", () => console.log("Built Worker QA adapter listening on 127.0.0.1:3471"));
