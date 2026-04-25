const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_CODE = process.env.ADMIN_CODE || "LSO2012";
const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
const POSTGRES_TABLE = sanitizeSqlIdentifier(
  (process.env.POSTGRES_TABLE || "shared_documents").trim(),
  "shared_documents"
);
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_TABLE = (process.env.SUPABASE_TABLE || "shared_documents").trim();
const hasSupabaseStorage = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const hasPostgresStorage = Boolean(DATABASE_URL);

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const configFile = path.join(dataDir, "shared-config.json");
const stateFile = path.join(dataDir, "shared-state.json");

const sharedDocumentIds = {
  config: "config",
  state: "state"
};

let postgresPool = null;
let storageReadyPromise = null;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sanitizeSqlIdentifier(value, fallback) {
  return /^[a-z_][a-z0-9_]*$/i.test(value) ? value : fallback;
}

function getStorageMode() {
  if (hasSupabaseStorage) {
    return "supabase";
  }

  if (hasPostgresStorage) {
    return "postgres";
  }

  return "local";
}

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

async function readJsonFile(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function writeJsonFile(filePath, payload) {
  await ensureDataDir();
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function deleteJsonFile(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function hasValidAdminCode(req) {
  return (req.headers["x-admin-code"] || "").trim().toUpperCase() === ADMIN_CODE;
}

function getPostgresPool() {
  if (!hasPostgresStorage) {
    return null;
  }

  if (!postgresPool) {
    const { Pool } = require("pg");
    postgresPool = new Pool({
      connectionString: DATABASE_URL
    });
  }

  return postgresPool;
}

async function ensurePostgresStorage() {
  const pool = getPostgresPool();

  await pool.query(`
    create table if not exists ${POSTGRES_TABLE} (
      id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
}

async function ensureStorageReady() {
  if (!storageReadyPromise) {
    storageReadyPromise = (async () => {
      if (hasSupabaseStorage) {
        return;
      }

      if (hasPostgresStorage) {
        await ensurePostgresStorage();
        return;
      }

      await ensureDataDir();
    })();
  }

  try {
    await storageReadyPromise;
  } catch (error) {
    storageReadyPromise = null;
    throw error;
  }
}

function getSupabaseHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extraHeaders
  };
}

function getSupabaseTableUrl() {
  return `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;
}

async function readPostgresDocument(documentId) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `select payload from ${POSTGRES_TABLE} where id = $1 limit 1`,
    [documentId]
  );

  return result.rows[0] ? result.rows[0].payload : null;
}

async function writePostgresDocument(documentId, payload) {
  const pool = getPostgresPool();
  await pool.query(
    `
      insert into ${POSTGRES_TABLE} (id, payload, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (id)
      do update set payload = excluded.payload, updated_at = now()
    `,
    [documentId, JSON.stringify(payload)]
  );
}

async function deletePostgresDocument(documentId) {
  const pool = getPostgresPool();
  await pool.query(`delete from ${POSTGRES_TABLE} where id = $1`, [documentId]);
}

async function readSupabaseDocument(documentId) {
  const endpoint =
    `${getSupabaseTableUrl()}?id=eq.${encodeURIComponent(documentId)}&select=payload`;

  const response = await fetch(endpoint, {
    headers: getSupabaseHeaders()
  });

  if (!response.ok) {
    throw new Error(`supabase read failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows[0] ? rows[0].payload : null;
}

async function writeSupabaseDocument(documentId, payload) {
  const response = await fetch(getSupabaseTableUrl(), {
    method: "POST",
    headers: getSupabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    }),
    body: JSON.stringify([{ id: documentId, payload }])
  });

  if (!response.ok) {
    throw new Error(`supabase write failed: ${response.status}`);
  }
}

async function deleteSupabaseDocument(documentId) {
  const endpoint = `${getSupabaseTableUrl()}?id=eq.${encodeURIComponent(documentId)}`;
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: getSupabaseHeaders({
      Prefer: "return=minimal"
    })
  });

  if (!response.ok) {
    throw new Error(`supabase delete failed: ${response.status}`);
  }
}

async function readSharedConfig() {
  await ensureStorageReady();

  if (hasSupabaseStorage) {
    return readSupabaseDocument(sharedDocumentIds.config);
  }

  if (hasPostgresStorage) {
    return readPostgresDocument(sharedDocumentIds.config);
  }

  return readJsonFile(configFile);
}

async function writeSharedConfig(config) {
  await ensureStorageReady();

  if (hasSupabaseStorage) {
    return writeSupabaseDocument(sharedDocumentIds.config, config);
  }

  if (hasPostgresStorage) {
    return writePostgresDocument(sharedDocumentIds.config, config);
  }

  return writeJsonFile(configFile, config);
}

async function deleteSharedConfig() {
  await ensureStorageReady();

  if (hasSupabaseStorage) {
    return deleteSupabaseDocument(sharedDocumentIds.config);
  }

  if (hasPostgresStorage) {
    return deletePostgresDocument(sharedDocumentIds.config);
  }

  return deleteJsonFile(configFile);
}

async function readSharedState() {
  await ensureStorageReady();

  if (hasSupabaseStorage) {
    return readSupabaseDocument(sharedDocumentIds.state);
  }

  if (hasPostgresStorage) {
    return readPostgresDocument(sharedDocumentIds.state);
  }

  return readJsonFile(stateFile);
}

async function writeSharedState(state) {
  await ensureStorageReady();

  if (hasSupabaseStorage) {
    return writeSupabaseDocument(sharedDocumentIds.state, state);
  }

  if (hasPostgresStorage) {
    return writePostgresDocument(sharedDocumentIds.state, state);
  }

  return writeJsonFile(stateFile, state);
}

async function handleConfigApi(req, res) {
  if (req.method === "GET") {
    try {
      const config = await readSharedConfig();
      sendJson(res, 200, { config });
    } catch (error) {
      sendJson(res, 500, { error: "storage unavailable" });
    }

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

      await writeSharedConfig(payload.config);
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
      await deleteSharedConfig();
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: "delete failed" });
    }

    return;
  }

  sendJson(res, 405, { error: "method not allowed" });
}

async function handleStateApi(req, res) {
  if (req.method === "GET") {
    try {
      const state = await readSharedState();
      sendJson(res, 200, { state });
    } catch (error) {
      sendJson(res, 500, { error: "storage unavailable" });
    }

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

      await writeSharedState(payload.state);
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

  if (url.pathname === "/health") {
    try {
      await ensureStorageReady();
      sendJson(res, 200, {
        ok: true,
        storage: getStorageMode()
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        storage: getStorageMode()
      });
    }

    return;
  }

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
  const storageMode = getStorageMode();

  console.log(`Emotiometre disponible sur http://localhost:${PORT}`);
  console.log(`Stockage actif : ${storageMode}`);

  addresses.forEach((address) => {
    console.log(`Partage reseau : http://${address}:${PORT}`);
  });
});
