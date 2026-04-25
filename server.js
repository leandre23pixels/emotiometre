const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_CODE = process.env.ADMIN_CODE || "LSO2012";
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const configFile = path.join(dataDir, "shared-config.json");
const stateFile = path.join(dataDir, "shared-state.json");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(body);
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(message),
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end(message);
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > 1_000_000) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

async function ensureDataDir() {
  await fsp.mkdir(dataDir, { recursive: true });
}

async function readSharedConfig() {
  try {
    const raw = await fsp.readFile(configFile, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function readSharedState() {
  try {
    const raw = await fsp.readFile(stateFile, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function hasValidAdminCode(req) {
  return (req.headers["x-admin-code"] || "").trim().toUpperCase() === ADMIN_CODE;
}

async function handleConfigApi(req, res) {
  if (req.method === "GET") {
    const config = await readSharedConfig();
    sendJson(res, 200, { config });
    return;
  }

  if (req.method === "PUT") {
    if (!hasValidAdminCode(req)) {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      const payload = JSON.parse(rawBody || "{}");

      if (!payload || typeof payload !== "object" || typeof payload.config !== "object") {
        sendJson(res, 400, { error: "invalid config" });
        return;
      }

      await ensureDataDir();
      await fsp.writeFile(configFile, JSON.stringify(payload.config, null, 2), "utf8");
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 400, { error: "invalid request" });
    }

    return;
  }

  if (req.method === "DELETE") {
    if (!hasValidAdminCode(req)) {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }

    try {
      await fsp.unlink(configFile);
    } catch (error) {
      if (error.code !== "ENOENT") {
        sendJson(res, 500, { error: "delete failed" });
        return;
      }
    }

    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 405, { error: "method not allowed" });
}

async function handleStateApi(req, res) {
  if (req.method === "GET") {
    const state = await readSharedState();
    sendJson(res, 200, { state });
    return;
  }

  if (req.method === "PUT") {
    try {
      const rawBody = await readRequestBody(req);
      const payload = JSON.parse(rawBody || "{}");

      if (!payload || typeof payload !== "object" || typeof payload.state !== "object") {
        sendJson(res, 400, { error: "invalid state" });
        return;
      }

      await ensureDataDir();
      await fsp.writeFile(stateFile, JSON.stringify(payload.state, null, 2), "utf8");
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 400, { error: "invalid request" });
    }

    return;
  }

  sendJson(res, 405, { error: "method not allowed" });
}

function resolveStaticPath(urlPath) {
  const pathname = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(rootDir, decodeURIComponent(pathname)));

  if (!filePath.startsWith(rootDir)) {
    return null;
  }

  return filePath;
}

async function handleStaticFile(urlPath, res) {
  const filePath = resolveStaticPath(urlPath);

  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fsp.stat(filePath);

    if (stats.isDirectory()) {
      sendText(res, 404, "Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[extension] || "application/octet-stream";

    res.writeHead(200, {
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=300",
      "Content-Length": stats.size,
      "Content-Type": contentType
    });

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    sendText(res, 404, "Not found");
  }
}

function listLocalAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    });
  });

  return addresses;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

  if (url.pathname === "/api/config") {
    await handleConfigApi(req, res);
    return;
  }

  if (url.pathname === "/api/state") {
    await handleStateApi(req, res);
    return;
  }

  await handleStaticFile(url.pathname, res);
});

server.listen(PORT, HOST, () => {
  const addresses = listLocalAddresses();

  console.log(`Emotiometre disponible sur http://localhost:${PORT}`);

  addresses.forEach((address) => {
    console.log(`Partage reseau : http://${address}:${PORT}`);
  });
});
