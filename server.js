require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { getPool } = require("./db");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

let pool = null;

function mustPool() {
  if (!pool) pool = getPool();
  return pool;
}

app.get("/api/health", async (req, res) => {
  try {
    const p = mustPool();
    await p.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "DB_ERROR" });
  }
});

app.get("/api/canal", async (req, res) => {
  const slug = (req.query.slug || "canal1").toString();

  try {
    const p = mustPool();
    const [rows] = await p.query(
      "SELECT id, slug, nombre, is_live, hls_url, updated_at FROM canales WHERE slug = ? LIMIT 1",
      [slug]
    );

    if (!rows.length) {
      return res.json({ ok: true, canal: { slug, nombre: slug, is_live: 0, hls_url: null } });
    }

    const c = rows[0];
    res.json({
      ok: true,
      canal: {
        id: c.id,
        slug: c.slug,
        nombre: c.nombre,
        is_live: !!c.is_live,
        hls_url: c.hls_url || null,
        updated_at: c.updated_at
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

app.post("/api/admin/canal", async (req, res) => {
  const auth = (req.headers.authorization || "").toString();
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const { slug, is_live, hls_url } = req.body || {};

  if (!slug || typeof slug !== "string") return res.status(400).json({ ok: false, error: "BAD_SLUG" });

  try {
    const p = mustPool();
    const [t] = await p.query("SELECT token FROM admin_tokens WHERE token = ? LIMIT 1", [token]);
    if (!t.length) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const liveVal = is_live ? 1 : 0;
    const urlVal = hls_url ? String(hls_url) : null;

    await p.query(
      "UPDATE canales SET is_live = ?, hls_url = ? WHERE slug = ?",
      [liveVal, urlVal, slug]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("API listening on", PORT);
});
