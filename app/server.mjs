import { createServer } from "node:http";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan } from "./plan.mjs";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(appDir, "..");
const demosDir = path.join(root, "demos");
const publicDir = path.join(appDir, "public");
const port = Number(process.env.PORT || 4321);

const RESERVED = new Set(["org.example.json", "org.local.json", "manual-gates.json"]);

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function catalog() {
  return readJson(path.join(demosDir, "manual-gates.json"));
}

function linksFor(id) {
  const file = path.join(demosDir, `${id}.links.json`);
  if (!existsSync(file)) return [];
  const parsed = readJson(file);
  return Array.isArray(parsed.salesforceIds) ? parsed.salesforceIds : [];
}

function listDemos() {
  return readdirSync(demosDir)
    .filter((name) => name.endsWith(".json") && !RESERVED.has(name) && !name.endsWith(".links.json"))
    .map((name) => {
      const spec = readJson(path.join(demosDir, name));
      return { ...spec, salesforceIds: linksFor(spec.id) };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (chunks.reduce((sum, item) => sum + item.length, 0) > 100_000) {
        reject(new Error("Brief is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Send the brief as JSON."));
      }
    });
    req.on("error", reject);
  });
}

function safeId(id) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return null;
  return id;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  try {
    if (req.method === "GET" && url.pathname === "/api/demos") {
      send(res, 200, JSON.stringify(listDemos()));
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/demos/")) {
      const id = safeId(decodeURIComponent(url.pathname.slice("/api/demos/".length)));
      const match = id && listDemos().find((demo) => demo.id === id);
      if (!match) {
        send(res, 404, JSON.stringify({ error: "No demo with that id." }));
        return;
      }
      send(res, 200, JSON.stringify(match));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/demos") {
      const body = await readBody(req);
      const spec = buildPlan(
        {
          industry: body.industry,
          useCase: body.useCase,
          company: body.company,
          beats: body.beats,
        },
        catalog(),
      );
      const file = path.join(demosDir, `${spec.id}.json`);
      writeFileSync(file, `${JSON.stringify({ ...spec, salesforceIds: [] }, null, 2)}\n`);
      send(res, 201, JSON.stringify({ ...spec, salesforceIds: linksFor(spec.id) }));
      return;
    }

    const rel = (url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, ""));
    if (rel.includes("..") || path.isAbsolute(rel)) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    const file = path.join(publicDir, rel);
    if (((!file.startsWith(`${publicDir}${path.sep}`) && file !== publicDir) || !existsSync(file))) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    send(res, 200, readFileSync(file), types[path.extname(file)] || "application/octet-stream");
  } catch (error) {
    send(res, 400, JSON.stringify({ error: error.message || "Could not build that brief." }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Demo builder listening on http://127.0.0.1:${port}`);
});
