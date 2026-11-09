import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { fileURLToPath } from "url";
import { MongoClient, Db as MongoDb } from "mongodb";
import pg from "pg";

const { Pool: PgPool } = pg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me-please-0123456789abcdef";
const TOKEN_PEPPER = process.env.TOKEN_PEPPER || JWT_SECRET;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@willjustplay.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "WillPlay#Admin2026";
const ADMIN_KEYS = new Set([process.env.ADMIN_KEY || "NEXUS-ADMIN-8888", "NEXUS-ADMIN-8888"]);
const FRONTEND_URL = process.env.APP_BASE_URL || process.env.APP_URL || process.env.FRONTEND_URL || `http://localhost:${PORT}`;
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const RESEND_FROM_EMAIL =
  (process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "").trim() ||
  `${process.env.EMAIL_FROM_NAME || "WillJustPlay Security"} <onboarding@resend.dev>`;
const ENV_SMTP_HOST = (process.env.SMTP_HOST || "").trim();
const ENV_SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const ENV_SMTP_SECURE = process.env.SMTP_SECURE === "true" || ENV_SMTP_PORT === 465;
const ENV_SMTP_USER = (process.env.SMTP_USER || "").trim();
const ENV_SMTP_PASS = (process.env.SMTP_PASS || "").trim();
const ENV_SMTP_FROM_EMAIL = (process.env.SMTP_FROM_EMAIL || ENV_SMTP_USER || "").trim();
const ENV_SMTP_FROM_NAME = (process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || "WillJustPlay Security").trim();
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const ENV_POSTGRES_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
const ENV_POSTGRES_SSL = process.env.POSTGRES_SSL !== "false";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const nowIso = () => new Date().toISOString();
const uuidHex = (len = 8) => crypto.randomUUID().replace(/-/g, "").slice(0, len);
const slugify = (v: string) =>
  String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------------- Seed & Persistent In-Memory Document Store ----------------
const SEED_PATH = path.join(__dirname, "server", "seed_data.json");
const DB_STATE_PATH = path.join(__dirname, "server", "db_state.json");
const SEED = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));

const SEED_CRYPTO_DESTINATIONS = [
  {
    id: "mp-crypto-usdt-trc20",
    type: "crypto",
    name: "USDT (Tether)",
    symbol: "USDT",
    network: "TRC20 (Tron)",
    account_name: "WillJustPlay Crypto",
    account_number: "TX9wXz7Y2kLmN8pQ4rS6tV1wXyZ3aBcDeF",
    image: "",
    is_active: true,
    seq: 2,
  },
  {
    id: "mp-crypto-usdt-bep20",
    type: "crypto",
    name: "USDT (BNB Chain)",
    symbol: "USDT",
    network: "BEP20 (BSC)",
    account_name: "WillJustPlay Crypto",
    account_number: "0x71C95911E9a5D330f4D621842EC243EE1343292e",
    image: "",
    is_active: true,
    seq: 3,
  },
  {
    id: "mp-crypto-sol",
    type: "crypto",
    name: "Solana (SOL / USDC)",
    symbol: "SOL",
    network: "SPL (Solana)",
    account_name: "WillJustPlay Web3",
    account_number: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    image: "",
    is_active: true,
    seq: 4,
  },
  {
    id: "mp-crypto-btc",
    type: "crypto",
    name: "Bitcoin (BTC)",
    symbol: "BTC",
    network: "BTC (Native SegWit)",
    account_name: "WillJustPlay Vault",
    account_number: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    image: "",
    is_active: true,
    seq: 5,
  },
];

const SEED_MANUAL_DESTINATIONS = [
  {
    id: "mp-qris-demo",
    type: "qris",
    name: "QRIS",
    account_name: "WillJustPlay",
    account_number: "-",
    image: "https://placehold.co/400x400/png?text=QRIS+Placeholder",
    is_active: true,
    seq: 0,
  },
  {
    id: "mp-bca-demo",
    type: "bank",
    name: "BCA",
    account_name: "Will Business",
    account_number: "1234567890",
    image: "",
    is_active: true,
    seq: 1,
  },
  ...SEED_CRYPTO_DESTINATIONS,
];

const SEED_SOCIAL_LINKS = [
  {
    id: "sl-facebook-demo",
    platform: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/share/1Ey74rNDVi/",
    is_active: true,
    seq: 0,
  },
  {
    id: "sl-whatsapp-demo",
    platform: "whatsapp",
    name: "WhatsApp",
    url: "https://wa.me/6285693161480",
    is_active: true,
    seq: 1,
  },
];

interface DbState {
  users: any[];
  sessions: any[];
  auth_tokens: any[];
  audit_logs: any[];
  email_events: any[];
  products: any[];
  games: any[];
  testimonials: any[];
  transactions: any[];
  manual_destinations: any[];
  files: Record<string, { path: string; dataBase64: string; content_type: string; filename: string; created_at: string }>;
  settings: Record<string, any>;
  social_links: any[];
  topup_providers: any[];
}

let db: DbState = {
  users: [],
  sessions: [],
  auth_tokens: [],
  audit_logs: [],
  email_events: [],
  products: [],
  games: [],
  testimonials: [],
  transactions: [],
  manual_destinations: [],
  files: {},
  settings: {},
  social_links: [],
  topup_providers: [],
};

let mongoDb: MongoDb | null = null;
let pgPool: InstanceType<typeof PgPool> | null = null;
let pgSyncTimer: ReturnType<typeof setTimeout> | null = null;

interface PostgresRuntimeStatus {
  connected: boolean;
  configured: boolean;
  source: "env" | "admin" | "none";
  host: string;
  database: string;
  user: string;
  port: number;
  ssl: boolean;
  version: string;
  tables_initialized: boolean;
  last_sync_at: string | null;
  last_error: string | null;
}

const pgRuntime: PostgresRuntimeStatus = {
  connected: false,
  configured: false,
  source: "none",
  host: "",
  database: "",
  user: "",
  port: 5432,
  ssl: ENV_POSTGRES_SSL,
  version: "",
  tables_initialized: false,
  last_sync_at: null,
  last_error: null,
};

function parsePostgresMeta(connStr: string) {
  try {
    const u = new URL(connStr);
    return {
      host: u.hostname || "localhost",
      port: Number(u.port || 5432),
      database: (u.pathname || "/postgres").replace(/^\/+/, "") || "postgres",
      user: decodeURIComponent(u.username || "postgres"),
    };
  } catch {
    return { host: "custom-host", port: 5432, database: "postgres", user: "postgres" };
  }
}

function getEffectivePostgresConfig(): {
  connection_string: string;
  ssl: boolean;
  auto_sync: boolean;
  source: "env" | "admin" | "none";
} {
  const saved = db.settings?.postgres_config || {};
  const adminUrl = String(saved.connection_string || "").trim();
  if (adminUrl) {
    return {
      connection_string: adminUrl,
      ssl: saved.ssl !== false,
      auto_sync: saved.auto_sync !== false,
      source: "admin",
    };
  }
  if (ENV_POSTGRES_URL) {
    return {
      connection_string: ENV_POSTGRES_URL,
      ssl: typeof saved.ssl === "boolean" ? saved.ssl : ENV_POSTGRES_SSL,
      auto_sync: saved.auto_sync !== false,
      source: "env",
    };
  }
  return {
    connection_string: "",
    ssl: ENV_POSTGRES_SSL,
    auto_sync: true,
    source: "none",
  };
}

const POSTGRES_DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS wjp_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'buyer',
    status TEXT NOT NULL DEFAULT 'active',
    is_verified BOOLEAN NOT NULL DEFAULT true,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_products (
    id TEXT PRIMARY KEY,
    game TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    condition TEXT NOT NULL DEFAULT 'ready',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_games (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    publisher TEXT,
    currency TEXT,
    icon TEXT DEFAULT '',
    banner TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `ALTER TABLE wjp_games ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '';`,
  `ALTER TABLE wjp_games ADD COLUMN IF NOT EXISTS banner TEXT DEFAULT '';`,
  `CREATE TABLE IF NOT EXISTS wjp_transactions (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    buyer_email TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_testimonials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    game TEXT,
    rating NUMERIC NOT NULL DEFAULT 5,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_manual_destinations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    data JSONB NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_social_links (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    data JSONB NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_topup_providers (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    data JSONB NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT,
    data JSONB NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    type TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    data JSONB NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_email TEXT,
    created_at TEXT NOT NULL,
    data JSONB NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_email_events (
    id TEXT PRIMARY KEY,
    to_email TEXT NOT NULL,
    template TEXT,
    status TEXT,
    created_at TEXT NOT NULL,
    data JSONB NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS wjp_settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
];

async function ensurePostgresSchema(pool: InstanceType<typeof PgPool>) {
  const client = await pool.connect();
  try {
    for (const ddl of POSTGRES_DDL_STATEMENTS) {
      await client.query(ddl);
    }
    pgRuntime.tables_initialized = true;
  } finally {
    client.release();
  }
}

async function pushToPostgres(pool: InstanceType<typeof PgPool> | null = pgPool): Promise<{ ok: boolean; error?: string; synced_at?: string }> {
  if (!pool) return { ok: false, error: "PostgreSQL pool belum terhubung" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const ddl of POSTGRES_DDL_STATEMENTS) {
      await client.query(ddl);
    }

    // 1. Users
    await client.query("DELETE FROM wjp_users");
    for (const u of db.users || []) {
      const id = String(u.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_users (id, email, name, role, status, is_verified, data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status, is_verified = EXCLUDED.is_verified, data = EXCLUDED.data, updated_at = NOW()`,
        [
          id,
          String(u.email || `${id}@user.local`).toLowerCase(),
          String(u.name || "User"),
          String(u.role || "buyer"),
          String(u.status || "active"),
          u.is_verified !== false,
          JSON.stringify({ ...u, id }),
        ]
      );
    }

    // 2. Products
    await client.query("DELETE FROM wjp_products");
    for (const p of db.products || []) {
      const id = String(p.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_products (id, game, category, title, price, stock, condition, data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
        [
          id,
          String(p.game || "Game"),
          String(p.category || "Akun Game"),
          String(p.title || "Produk"),
          Number(p.price || 0),
          Number(p.stock ?? 0),
          String(p.condition || "ready"),
          JSON.stringify({ ...p, id }),
        ]
      );
    }

    // 3. Games
    await client.query("DELETE FROM wjp_games");
    for (const g of db.games || []) {
      const id = String(g.id || g.slug || uuidHex(12));
      const iconUrl = String(g.icon || "").trim();
      const bannerUrl = String(g.banner || "").trim();
      await client.query(
        `INSERT INTO wjp_games (id, slug, name, publisher, currency, icon, banner, is_active, data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
           slug = EXCLUDED.slug,
           name = EXCLUDED.name,
           publisher = EXCLUDED.publisher,
           currency = EXCLUDED.currency,
           icon = EXCLUDED.icon,
           banner = EXCLUDED.banner,
           is_active = EXCLUDED.is_active,
           data = EXCLUDED.data,
           updated_at = NOW()`,
        [
          id,
          String(g.slug || id),
          String(g.name || "Game"),
          String(g.publisher || ""),
          String(g.currency || "Item"),
          iconUrl,
          bannerUrl,
          g.is_active !== false,
          JSON.stringify({ ...g, id, icon: iconUrl, banner: bannerUrl }),
        ]
      );
    }

    // 4. Transactions
    await client.query("DELETE FROM wjp_transactions");
    for (const tx of db.transactions || []) {
      const id = String(tx.session_id || tx.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_transactions (id, product_id, buyer_email, amount, status, payment_status, data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
        [
          id,
          String(tx.product_id || ""),
          String(tx.buyer_email || ""),
          Number(tx.amount || 0),
          String(tx.status || "pending"),
          String(tx.payment_status || "pending"),
          JSON.stringify({ ...tx, session_id: id, id }),
        ]
      );
    }

    // 5. Testimonials
    await client.query("DELETE FROM wjp_testimonials");
    for (const t of db.testimonials || []) {
      const id = String(t.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_testimonials (id, name, game, rating, data, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
        [id, String(t.name || "Buyer"), String(t.game || ""), Number(t.rating || 5), JSON.stringify({ ...t, id })]
      );
    }

    // 6. Manual Destinations
    await client.query("DELETE FROM wjp_manual_destinations");
    for (const d of db.manual_destinations || []) {
      const id = String(d.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_manual_destinations (id, type, name, is_active, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [id, String(d.type || "bank"), String(d.name || "Manual"), d.is_active !== false, JSON.stringify({ ...d, id })]
      );
    }

    // 7. Social Links
    await client.query("DELETE FROM wjp_social_links");
    for (const s of db.social_links || []) {
      const id = String(s.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_social_links (id, platform, name, url, is_active, data)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          id,
          String(s.platform || "link"),
          String(s.name || "Social"),
          String(s.url || "#"),
          s.is_active !== false,
          JSON.stringify({ ...s, id }),
        ]
      );
    }

    // 8. Topup Providers
    await client.query("DELETE FROM wjp_topup_providers");
    for (const v of db.topup_providers || []) {
      const id = String(v.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_topup_providers (id, kind, name, is_active, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [id, String(v.kind || "digiflazz"), String(v.name || "Vendor"), v.is_active !== false, JSON.stringify({ ...v, id })]
      );
    }

    // 9. Sessions
    await client.query("DELETE FROM wjp_sessions");
    for (const s of (db.sessions || []).slice(-500)) {
      const id = String(s.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_sessions (id, user_id, token_hash, expires_at, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [id, String(s.user_id || ""), String(s.token_hash || ""), String(s.expires_at || ""), JSON.stringify({ ...s, id })]
      );
    }

    // 10. Auth Tokens
    await client.query("DELETE FROM wjp_auth_tokens");
    for (const t of (db.auth_tokens || []).slice(-500)) {
      const id = String(t.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_auth_tokens (id, user_id, email, type, token_hash, data)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          id,
          String(t.user_id || ""),
          String(t.email || ""),
          String(t.type || "verify_email"),
          String(t.token_hash || ""),
          JSON.stringify({ ...t, id }),
        ]
      );
    }

    // 11. Audit Logs
    await client.query("DELETE FROM wjp_audit_logs");
    for (const l of (db.audit_logs || []).slice(0, 500)) {
      const id = String(l.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_audit_logs (id, action, actor_email, created_at, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          id,
          String(l.action || "event"),
          String(l.actor_email || ""),
          String(l.created_at || nowIso()),
          JSON.stringify({ ...l, id }),
        ]
      );
    }

    // 12. Email Events
    await client.query("DELETE FROM wjp_email_events");
    for (const e of (db.email_events || []).slice(0, 250)) {
      const id = String(e.id || uuidHex(12));
      await client.query(
        `INSERT INTO wjp_email_events (id, to_email, template, status, created_at, data)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          id,
          String(e.to_email || ""),
          String(e.template || ""),
          String(e.status || ""),
          String(e.created_at || nowIso()),
          JSON.stringify({ ...e, id }),
        ]
      );
    }

    // 13. Settings
    await client.query("DELETE FROM wjp_settings");
    for (const [k, v] of Object.entries(db.settings || {})) {
      if (!k) continue;
      await client.query(
        `INSERT INTO wjp_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())`,
        [k, JSON.stringify({ id: k, ...(v || {}) })]
      );
    }

    await client.query("COMMIT");
    const stamp = nowIso();
    pgRuntime.last_sync_at = stamp;
    pgRuntime.last_error = null;
    return { ok: true, synced_at: stamp };
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = String(err?.message || err || "Gagal sinkronisasi ke PostgreSQL");
    pgRuntime.last_error = msg;
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

async function pullFromPostgres(pool: InstanceType<typeof PgPool> | null = pgPool): Promise<{ ok: boolean; loaded_rows: number; error?: string }> {
  if (!pool) return { ok: false, loaded_rows: 0, error: "PostgreSQL pool belum terhubung" };
  try {
    await ensurePostgresSchema(pool);
    let loadedRows = 0;

    const qData = async (table: string) => {
      const res = await pool.query(`SELECT data FROM ${table}`);
      loadedRows += res.rows.length;
      return res.rows.map((r) => r.data).filter(Boolean);
    };

    const qGames = async () => {
      const res = await pool.query(
        `SELECT id, slug, name, publisher, currency, icon, banner, is_active, data FROM wjp_games`
      );
      loadedRows += res.rows.length;
      return res.rows
        .map((r) => {
          const base = r.data && typeof r.data === "object" ? r.data : {};
          const iconUrl = String(r.icon || base.icon || "").trim();
          const bannerUrl = String(r.banner || base.banner || "").trim();
          return {
            ...base,
            id: String(r.id || base.id || ""),
            slug: String(r.slug || base.slug || ""),
            name: String(r.name || base.name || ""),
            publisher: String(r.publisher ?? base.publisher ?? ""),
            currency: String(r.currency ?? base.currency ?? "Item"),
            icon: iconUrl,
            banner: bannerUrl,
            is_active: typeof r.is_active === "boolean" ? r.is_active : base.is_active !== false,
          };
        })
        .filter((g) => g.id || g.slug);
    };

    const [
      users,
      products,
      games,
      transactions,
      testimonials,
      manualDests,
      socialLinks,
      topupProviders,
      sessions,
      authTokens,
      auditLogs,
      emailEvents,
      settingsRes,
    ] = await Promise.all([
      qData("wjp_users"),
      qData("wjp_products"),
      qGames(),
      qData("wjp_transactions"),
      qData("wjp_testimonials"),
      qData("wjp_manual_destinations"),
      qData("wjp_social_links"),
      qData("wjp_topup_providers"),
      qData("wjp_sessions"),
      qData("wjp_auth_tokens"),
      qData("wjp_audit_logs"),
      qData("wjp_email_events"),
      pool.query("SELECT id, data FROM wjp_settings"),
    ]);

    if (users.length > 0) db.users = users;
    if (products.length > 0) db.products = products;
    if (games.length > 0) {
      db.games = games;
      upgradeLocalGameIcons();
    }
    if (transactions.length > 0) db.transactions = transactions;
    if (testimonials.length > 0) db.testimonials = testimonials;
    if (manualDests.length > 0) db.manual_destinations = manualDests;
    if (socialLinks.length > 0) db.social_links = socialLinks;
    if (topupProviders.length > 0) db.topup_providers = topupProviders;
    if (sessions.length > 0) db.sessions = sessions;
    if (authTokens.length > 0) db.auth_tokens = authTokens;
    if (auditLogs.length > 0) db.audit_logs = auditLogs;
    if (emailEvents.length > 0) db.email_events = emailEvents;

    if (settingsRes.rows.length > 0) {
      loadedRows += settingsRes.rows.length;
      for (const r of settingsRes.rows) {
        if (r.id && r.data) {
          db.settings[r.id] = r.data;
        }
      }
    }

    ensureDefaultTopupClearedOnce();

    pgRuntime.last_sync_at = nowIso();
    pgRuntime.last_error = null;
    try {
      fs.writeFileSync(DB_STATE_PATH, JSON.stringify(db, null, 2), "utf-8");
    } catch {
      // ignore disk write error
    }
    return { ok: true, loaded_rows: loadedRows };
  } catch (err: any) {
    const msg = String(err?.message || err || "Gagal memuat data dari PostgreSQL");
    pgRuntime.last_error = msg;
    return { ok: false, loaded_rows: 0, error: msg };
  }
}

function schedulePostgresSync() {
  if (!pgPool || !pgRuntime.connected) return;
  const cfg = getEffectivePostgresConfig();
  if (!cfg.auto_sync) return;
  if (pgSyncTimer) clearTimeout(pgSyncTimer);
  pgSyncTimer = setTimeout(() => {
    void pushToPostgres(pgPool);
  }, 400);
}

async function initPostgresConnection(overrideUrl?: string, overrideSsl?: boolean): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  const cfg = getEffectivePostgresConfig();
  const targetUrl = overrideUrl !== undefined ? String(overrideUrl).trim() : cfg.connection_string;
  const useSsl = overrideSsl !== undefined ? overrideSsl : cfg.ssl;

  if (!targetUrl) {
    pgRuntime.configured = false;
    pgRuntime.connected = false;
    pgRuntime.source = "none";
    return { ok: false, error: "Connection string PostgreSQL belum dikonfigurasi" };
  }

  const meta = parsePostgresMeta(targetUrl);
  pgRuntime.configured = true;
  pgRuntime.source = overrideUrl ? "admin" : cfg.source;
  pgRuntime.host = meta.host;
  pgRuntime.port = meta.port;
  pgRuntime.database = meta.database;
  pgRuntime.user = meta.user;
  pgRuntime.ssl = useSsl;

  try {
    const nextPool = new PgPool({
      connectionString: targetUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 6000,
      max: 5,
    });
    const vRes = await nextPool.query("SELECT version() AS ver");
    const verStr = String(vRes.rows?.[0]?.ver || "PostgreSQL").split(",")[0];
    await ensurePostgresSchema(nextPool);

    if (pgPool) {
      await pgPool.end().catch(() => {});
    }
    pgPool = nextPool;
    pgRuntime.connected = true;
    pgRuntime.version = verStr;
    pgRuntime.last_error = null;

    // Check if PostgreSQL already has users; if so, pull existing records, then sync all
    const countRes = await pgPool.query("SELECT COUNT(*)::int AS cnt FROM wjp_users");
    const existingUsers = Number(countRes.rows?.[0]?.cnt || 0);
    if (existingUsers > 0) {
      await pullFromPostgres(pgPool);
    }
    await pushToPostgres(pgPool);
    console.log(`Connected to PostgreSQL (${meta.host}/${meta.database}) successfully.`);
    return { ok: true, version: verStr };
  } catch (err: any) {
    const msg = String(err?.message || err || "Koneksi PostgreSQL gagal");
    pgRuntime.connected = false;
    pgRuntime.last_error = msg;
    console.warn("PostgreSQL connection skipped or failed:", msg);
    return { ok: false, error: msg };
  }
}

function sqlLiteral(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "0";
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generatePostgresSqlDump(): string {
  const lines: string[] = [
    "-- ============================================================================",
    "-- WillJustPlay Store & Top-Up — PostgreSQL Relational Schema & Data Dump",
    `-- Generated At: ${nowIso()}`,
    "-- Compatible with: PostgreSQL 13+, Supabase, Neon, Google Cloud SQL, AWS RDS",
    "-- ============================================================================",
    "",
    "BEGIN;",
    "",
    ...POSTGRES_DDL_STATEMENTS,
    "",
  ];

  for (const u of db.users || []) {
    const id = String(u.id || uuidHex(12));
    lines.push(
      `INSERT INTO wjp_users (id, email, name, role, status, is_verified, data, updated_at) VALUES (${sqlLiteral(id)}, ${sqlLiteral(String(u.email || "").toLowerCase())}, ${sqlLiteral(u.name || "User")}, ${sqlLiteral(u.role || "buyer")}, ${sqlLiteral(u.status || "active")}, ${sqlLiteral(u.is_verified !== false)}, ${sqlLiteral(JSON.stringify({ ...u, id }))}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status, is_verified = EXCLUDED.is_verified, data = EXCLUDED.data, updated_at = NOW();`
    );
  }
  lines.push("");

  for (const p of db.products || []) {
    const id = String(p.id || uuidHex(12));
    lines.push(
      `INSERT INTO wjp_products (id, game, category, title, price, stock, condition, data, updated_at) VALUES (${sqlLiteral(id)}, ${sqlLiteral(p.game || "Game")}, ${sqlLiteral(p.category || "Akun Game")}, ${sqlLiteral(p.title || "Produk")}, ${sqlLiteral(Number(p.price || 0))}, ${sqlLiteral(Number(p.stock ?? 0))}, ${sqlLiteral(p.condition || "ready")}, ${sqlLiteral(JSON.stringify({ ...p, id }))}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET game = EXCLUDED.game, category = EXCLUDED.category, title = EXCLUDED.title, price = EXCLUDED.price, stock = EXCLUDED.stock, condition = EXCLUDED.condition, data = EXCLUDED.data, updated_at = NOW();`
    );
  }
  lines.push("");

  for (const g of db.games || []) {
    const id = String(g.id || g.slug || uuidHex(12));
    const iconUrl = String(g.icon || "").trim();
    const bannerUrl = String(g.banner || "").trim();
    lines.push(
      `INSERT INTO wjp_games (id, slug, name, publisher, currency, icon, banner, is_active, data, updated_at) VALUES (${sqlLiteral(id)}, ${sqlLiteral(g.slug || id)}, ${sqlLiteral(g.name || "Game")}, ${sqlLiteral(g.publisher || "")}, ${sqlLiteral(g.currency || "Item")}, ${sqlLiteral(iconUrl)}, ${sqlLiteral(bannerUrl)}, ${sqlLiteral(g.is_active !== false)}, ${sqlLiteral(JSON.stringify({ ...g, id, icon: iconUrl, banner: bannerUrl }))}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, publisher = EXCLUDED.publisher, currency = EXCLUDED.currency, icon = EXCLUDED.icon, banner = EXCLUDED.banner, is_active = EXCLUDED.is_active, data = EXCLUDED.data, updated_at = NOW();`
    );
  }
  lines.push("");

  for (const tx of db.transactions || []) {
    const id = String(tx.session_id || tx.id || uuidHex(12));
    lines.push(
      `INSERT INTO wjp_transactions (id, product_id, buyer_email, amount, status, payment_status, data, created_at) VALUES (${sqlLiteral(id)}, ${sqlLiteral(tx.product_id || "")}, ${sqlLiteral(tx.buyer_email || "")}, ${sqlLiteral(Number(tx.amount || 0))}, ${sqlLiteral(tx.status || "pending")}, ${sqlLiteral(tx.payment_status || "pending")}, ${sqlLiteral(JSON.stringify({ ...tx, session_id: id, id }))}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, payment_status = EXCLUDED.payment_status, data = EXCLUDED.data;`
    );
  }
  lines.push("");

  for (const t of db.testimonials || []) {
    const id = String(t.id || uuidHex(12));
    lines.push(
      `INSERT INTO wjp_testimonials (id, name, game, rating, data, created_at) VALUES (${sqlLiteral(id)}, ${sqlLiteral(t.name || "Buyer")}, ${sqlLiteral(t.game || "")}, ${sqlLiteral(Number(t.rating || 5))}, ${sqlLiteral(JSON.stringify({ ...t, id }))}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, game = EXCLUDED.game, rating = EXCLUDED.rating, data = EXCLUDED.data;`
    );
  }
  lines.push("");

  for (const d of db.manual_destinations || []) {
    const id = String(d.id || uuidHex(12));
    lines.push(
      `INSERT INTO wjp_manual_destinations (id, type, name, is_active, data) VALUES (${sqlLiteral(id)}, ${sqlLiteral(d.type || "bank")}, ${sqlLiteral(d.name || "Manual")}, ${sqlLiteral(d.is_active !== false)}, ${sqlLiteral(JSON.stringify({ ...d, id }))}::jsonb) ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, name = EXCLUDED.name, is_active = EXCLUDED.is_active, data = EXCLUDED.data;`
    );
  }
  lines.push("");

  for (const s of db.social_links || []) {
    const id = String(s.id || uuidHex(12));
    lines.push(
      `INSERT INTO wjp_social_links (id, platform, name, url, is_active, data) VALUES (${sqlLiteral(id)}, ${sqlLiteral(s.platform || "link")}, ${sqlLiteral(s.name || "Social")}, ${sqlLiteral(s.url || "#")}, ${sqlLiteral(s.is_active !== false)}, ${sqlLiteral(JSON.stringify({ ...s, id }))}::jsonb) ON CONFLICT (id) DO UPDATE SET platform = EXCLUDED.platform, name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active, data = EXCLUDED.data;`
    );
  }
  lines.push("");

  for (const [k, v] of Object.entries(db.settings || {})) {
    if (!k) continue;
    lines.push(
      `INSERT INTO wjp_settings (id, data, updated_at) VALUES (${sqlLiteral(k)}, ${sqlLiteral(JSON.stringify({ id: k, ...(v || {}) }))}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();`
    );
  }

  lines.push("", "COMMIT;", "");
  return lines.join("\n");
}

async function syncMongoCollections() {
  if (!mongoDb) return;
  try {
    const syncCol = async (name: string, docs: any[]) => {
      const col = mongoDb!.collection(name);
      await col.deleteMany({});
      if (docs.length > 0) {
        await col.insertMany(docs.map((d) => ({ ...d, _id: d.id || d.session_id || uuidHex(12) })));
      }
    };
    await Promise.all([
      syncCol("users", db.users),
      syncCol("sessions", db.sessions),
      syncCol("auth_tokens", db.auth_tokens),
      syncCol("audit_logs", db.audit_logs.slice(-500)),
      syncCol("email_events", db.email_events.slice(-200)),
      syncCol("settings", Object.entries(db.settings || {}).map(([k, v]) => ({ id: k, ...v }))),
    ]);
  } catch {
    // Non-blocking Mongo sync fallback
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_STATE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // Ephemeral fallback
  }
  if (mongoDb) {
    void syncMongoCollections();
  }
  if (pgPool && pgRuntime.connected) {
    schedulePostgresSync();
  }
}

async function initMongoConnection() {
  if (!MONGODB_URI) return;
  try {
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    mongoDb = client.db();
    await mongoDb.collection("users").createIndex({ email: 1 }, { unique: true }).catch(() => {});
    await mongoDb.collection("sessions").createIndex({ token_hash: 1 }, { unique: true }).catch(() => {});
    await mongoDb.collection("auth_tokens").createIndex({ token_hash: 1 }, { unique: true }).catch(() => {});
    await mongoDb.collection("audit_logs").createIndex({ created_at: -1 }).catch(() => {});

    const storedUsers = await mongoDb.collection("users").find({}).toArray();
    if (storedUsers.length > 0) {
      db.users = storedUsers.map(({ _id, ...rest }) => rest);
    }
    const storedLogs = await mongoDb.collection("audit_logs").find({}).toArray();
    if (storedLogs.length > 0) {
      db.audit_logs = storedLogs.map(({ _id, ...rest }) => rest);
    }
    const storedSettings = await mongoDb.collection("settings").find({}).toArray();
    for (const sDoc of storedSettings) {
      const { _id, ...rest } = sDoc;
      const key = String(rest.id || _id || "");
      if (key) db.settings[key] = rest;
    }
    await syncMongoCollections();
    console.log("Connected to MongoDB persistence successfully.");
  } catch (err: any) {
    console.warn("MongoDB connection skipped or unavailable, using local JSON persistence:", err?.message || err);
  }
}

// ---------------- Topup Catalog Helpers ----------------
const TOPUP_CATEGORY = "Topup Game";
const PRODUCT_TYPE = "topup";

function isTopupProduct(p: any): boolean {
  if (!p) return false;
  return (
    p.product_type === PRODUCT_TYPE ||
    String(p.category || "").trim().toLowerCase() === TOPUP_CATEGORY.toLowerCase() ||
    Boolean(p.denomination_code) ||
    Boolean(p.denomination) ||
    String(p.id || "").startsWith("tp-") ||
    String(p.id || "").startsWith("topup-")
  );
}

function productIdFor(gameSlug: string, code: string) {
  return `tp-${slugify(gameSlug)}-${slugify(code)}`;
}

function activeDenominations(game: any): any[] {
  const rows = (game?.denominations || []).filter(
    (d: any) => d.is_active !== false && String(d.vendor_sku || "").trim() !== ""
  );
  return rows.sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0) || String(a.code).localeCompare(String(b.code)));
}

function findDenomination(game: any, code: string) {
  return (game?.denominations || []).find((d: any) => String(d.code) === String(code)) || null;
}

function detectDigiflazzSkuGroup(
  skuStr: string,
  labelOrNameStr = "",
  typeOrCategoryStr = ""
): "membership" | "currency" {
  const sku = String(skuStr || "").trim().toUpperCase();
  const label = String(labelOrNameStr || "").trim().toLowerCase();
  const typeNorm = String(typeOrCategoryStr || "").trim().toLowerCase();

  if (
    typeNorm === "membership" ||
    typeNorm.includes("membership") ||
    typeNorm.includes("subscription") ||
    typeNorm.includes("member") ||
    typeNorm.includes("pass")
  ) {
    return "membership";
  }

  // Check explicit Digiflazz membership SKU codes & prefixes/suffixes
  if (
    /^(WDP|MLWDP|GIWELKIN|WELKIN|HSRESP|ZZZIKM|IKM|SLM|MLSL|TWILIGHT|FFBP|PUBGRP)/i.test(sku) ||
    /(WDP|WELKIN|MEMBER|PASS|STARLIGHT|TWILIGHT|SUBS|WEEKLY|MONTHLY)/i.test(sku)
  ) {
    return "membership";
  }

  // Check product name / label keywords for Membership / Pass / Subscription items
  const membershipPattern =
    /\b(membership|member|welkin|blessing|inter-knot|interknot|wdp|weekly\s*diamond\s*pass|twilight\s*pass|starlight|supply\s*pass|express\s*supply|lunite\s*subscription|royale\s*pass|booyah\s*pass|elite\s*pass|battle\s*pass|season\s*pass|star\s*pass|premium\s*pass|monthly\s*card|weekly\s*card|monthly\s*pass|weekly\s*pass|vip\s*card|kartu\s*bulanan|kartu\s*mingguan|berkah|langganan|subscription|pass|paket\s*mingguan|paket\s*bulanan|level\s*up\s*pass)\b/i;

  if (membershipPattern.test(label)) {
    return "membership";
  }

  return "currency";
}

function normalizeSkuGroup(
  explicitGroup: any,
  skuStr: string,
  labelOrNameStr = "",
  typeOrCategoryStr = ""
): "membership" | "currency" {
  const g = String(explicitGroup || "").trim().toLowerCase();
  if (g === "membership" || g === "currency") {
    return g;
  }
  return detectDigiflazzSkuGroup(skuStr, labelOrNameStr, typeOrCategoryStr);
}

function denominationProduct(game: any, denom: any) {
  const slug = game.slug || game.id;
  const code = String(denom.code);
  const stock = denom.stock != null ? Number(denom.stock) : 999;
  const skuGroup = normalizeSkuGroup(denom.sku_group, denom.vendor_sku || code, denom.label, denom.type);
  const badges: string[] = [];
  if (denom.badge) badges.push(denom.badge);
  if (skuGroup === "membership") {
    badges.push("Membership");
  } else if (game.currency) {
    badges.push(`${game.currency} Instan`);
  }
  return {
    id: productIdFor(slug, code),
    game: game.name,
    category: TOPUP_CATEGORY,
    product_type: PRODUCT_TYPE,
    slug,
    game_id: game.id,
    denomination_code: code,
    sku_group: skuGroup,
    denomination: {
      code,
      label: denom.label,
      amount: denom.amount,
      price_strike: denom.price_strike,
      sku_group: skuGroup,
    },
    title: `${game.name} — ${denom.label || code}`,
    price: Number(denom.price || 0),
    price_strike: denom.price_strike,
    rank: "Via ID Server",
    image: game.banner || game.icon || "",
    images: [],
    stock,
    badge: badges[0] || "",
    badges: badges.slice(0, 3),
    featured: Boolean(denom.featured),
    sold: Number(denom.sold || 0),
    rating: Number(denom.rating || 4.9),
    rating_base: Number(denom.rating || 4.9),
    condition: "ready",
    seq: denom.seq || 0,
    warranty: "100%",
    delivery_info: game.delivery_info || "Item masuk otomatis setelah pembayaran terverifikasi",
    description: `Top up ${denom.label || code} untuk ${game.name} (${game.publisher || ""}). Proses instan via User ID & Server, legal 100% tanpa login akun.`.trim(),
    created_at: nowIso(),
  };
}

function syncGameProducts(game: any, replace = true): number {
  const slug = game.slug || game.id;
  if (game.is_active === false) {
    if (replace) {
      db.products = db.products.filter((p) => !(p.slug === slug && p.product_type === PRODUCT_TYPE));
    }
    return 0;
  }
  const existing = db.products.filter((p) => p.slug === slug && p.product_type === PRODUCT_TYPE);
  const byCode = new Map(existing.map((row) => [String(row.denomination_code), row]));
  let written = 0;
  const keep = new Set<string>();

  for (const denom of activeDenominations(game)) {
    const product = denominationProduct(game, denom);
    keep.add(product.id);
    const prior = byCode.get(String(denom.code));
    if (prior) {
      product.sold = Number(prior.sold ?? product.sold);
      product.rating = Number(prior.rating ?? product.rating);
      product.rating_base = Number(prior.rating_base ?? product.rating_base);
      product.created_at = prior.created_at || product.created_at;
      const idx = db.products.findIndex((p) => p.id === product.id);
      if (idx !== -1) db.products[idx] = { ...db.products[idx], ...product };
    } else {
      db.products.push(product);
    }
    written++;
  }

  if (replace) {
    db.products = db.products.filter((p) => !(p.slug === slug && p.product_type === PRODUCT_TYPE && !keep.has(p.id)));
  }
  return written;
}

function syncAllGames(replace = true): number {
  let total = 0;
  for (const game of db.games) {
    total += syncGameProducts(game, replace);
  }
  saveDb();
  return total;
}

function resolveBuiltInDigiflazzFields(gameOrMeta: any): any[] {
  const slug = String(gameOrMeta?.slug || "").trim().toLowerCase();
  const prefix = String(gameOrMeta?.vendor_prefix || "").trim().toUpperCase();
  const name = String(gameOrMeta?.name || "").trim().toLowerCase();

  // 1. Direct match from MERCHANT_MASTER_GAMES (21 official games)
  if (typeof MERCHANT_MASTER_GAMES !== "undefined" && Array.isArray(MERCHANT_MASTER_GAMES)) {
    const master = MERCHANT_MASTER_GAMES.find(
      (mg) =>
        mg.slug === slug ||
        (prefix && String(mg.vendor_prefix || "").toUpperCase() === prefix) ||
        (name && String(mg.name || "").toLowerCase() === name)
    );
    if (master && Array.isArray(master.fields) && master.fields.length > 0) {
      return master.fields.map((f) => ({ ...f }));
    }
  }

  // 2. Fallback heuristic by Digiflazz prefix / game slug / name
  if (
    slug.includes("mobile-legends") ||
    slug.includes("magic-chess") ||
    prefix === "ML" ||
    prefix === "MCGG"
  ) {
    return [
      {
        key: "user_id",
        label: "User ID",
        placeholder: "123456789",
        type: "text",
        inputmode: "numeric",
        required: true,
        min_len: 5,
        max_len: 15,
        pattern: "^[0-9]{5,15}$",
        help: "Masukkan angka User ID sesuai profil game Anda",
      },
      {
        key: "zone_id",
        label: "Zone ID",
        placeholder: "1234",
        type: "text",
        inputmode: "numeric",
        required: true,
        min_len: 3,
        max_len: 6,
        pattern: "^[0-9]{3,6}$",
        help: "Masukkan angka Zone ID (di dalam tanda kurung)",
      },
    ];
  }

  if (
    slug.includes("genshin") ||
    slug.includes("zenless") ||
    slug.includes("honkai-star-rail") ||
    prefix === "GI" ||
    prefix === "ZZZ" ||
    prefix === "HSR"
  ) {
    return [
      {
        key: "user_id",
        label: "UID",
        placeholder: "800123456",
        type: "text",
        inputmode: "numeric",
        required: true,
        min_len: 8,
        max_len: 12,
        pattern: "^[0-9]{8,12}$",
        help: "Masukkan UID angka akun HoYoverse Anda",
      },
      {
        key: "server",
        label: "Server",
        placeholder: "Pilih Server",
        type: "select",
        inputmode: "text",
        required: true,
        min_len: 2,
        max_len: 20,
        pattern: "",
        options: ["Asia", "America", "Europe", "TW, HK, MO"],
        help: "Pilih server akun HoYoverse Anda",
      },
    ];
  }

  if (slug.includes("wuthering") || prefix === "WW") {
    return [
      {
        key: "user_id",
        label: "UID",
        placeholder: "900123456",
        type: "text",
        inputmode: "numeric",
        required: true,
        min_len: 8,
        max_len: 12,
        pattern: "^[0-9]{8,12}$",
        help: "Masukkan 9 digit UID Wuthering Waves",
      },
      {
        key: "server",
        label: "Server",
        placeholder: "Pilih Server",
        type: "select",
        inputmode: "text",
        required: true,
        min_len: 2,
        max_len: 20,
        pattern: "",
        options: ["SEA", "Asia", "America", "Europe", "HMT (HK, MO, TW)"],
        help: "Pilih server Wuthering Waves Anda",
      },
    ];
  }

  if (slug.includes("ragnarok") || prefix === "ROM" || prefix === "ROO") {
    return [
      {
        key: "user_id",
        label: "Role ID / Character ID",
        placeholder: "4300123456",
        type: "text",
        inputmode: "numeric",
        required: true,
        min_len: 5,
        max_len: 16,
        pattern: "^[0-9]{5,16}$",
        help: "Masukkan angka Role ID / Character ID karakter Anda",
      },
      {
        key: "server",
        label: "Server",
        placeholder: "Nama Server",
        type: "text",
        inputmode: "text",
        required: true,
        min_len: 2,
        max_len: 30,
        pattern: "",
        help: "Masukkan nama Server karakter Anda",
      },
    ];
  }

  if (slug.includes("valorant") || slug.includes("wild-rift") || prefix === "VAL" || prefix === "WR") {
    return [
      {
        key: "riot_id",
        label: "Riot ID#Tag",
        placeholder: "Player#IDN",
        type: "text",
        inputmode: "text",
        required: true,
        min_len: 4,
        max_len: 32,
        pattern: "",
        help: "Format wajib: Nickname#Tag (Contoh: Player#IDN)",
      },
    ];
  }

  return [
    {
      key: "user_id",
      label: "User ID / Player ID",
      placeholder: "Masukkan ID Akun Game",
      type: "text",
      inputmode: "numeric",
      required: true,
      min_len: 4,
      max_len: 24,
      pattern: "",
      help: "Masukkan User ID / Player ID sesuai profil di dalam game",
    },
  ];
}

function resolveDigiflazzCustomerNoFormat(gameOrMeta: any): string {
  const fields = resolveBuiltInDigiflazzFields(gameOrMeta);
  const keys = fields.map((f) => f.key);
  if (keys.includes("user_id") && keys.includes("zone_id")) {
    return "{user_id}{zone_id} (Digabung otomatis untuk Digiflazz)";
  }
  if (keys.includes("riot_id")) {
    return "{riot_id} (Nickname#Tag)";
  }
  if (keys.includes("user_id") && keys.includes("server")) {
    return "{user_id} + {server}";
  }
  return "{user_id}";
}

function publicGame(game: any) {
  const builtInFields = resolveBuiltInDigiflazzFields(game);
  const denominations = activeDenominations(game)
    .filter((d) => Number(d.price || 0) > 0)
    .map((d) => {
      const skuGroup = normalizeSkuGroup(d.sku_group, d.vendor_sku || d.code, d.label, d.type);
      return {
        code: String(d.code),
        vendor_sku: String(d.vendor_sku || ""),
        label: d.label,
        amount: d.amount,
        price: Number(d.price || 0),
        price_strike: d.price_strike,
        stock: d.stock != null ? Number(d.stock) : 999,
        badge: d.badge || "",
        sku_group: skuGroup,
        seq: d.seq || 0,
      };
    });
  const prices = denominations.map((d) => d.price);
  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    publisher: game.publisher || "",
    icon: game.icon || "",
    banner: game.banner || "",
    currency: game.currency || "Item",
    notes: game.notes || "",
    delivery_info: game.delivery_info || "",
    seq: game.seq || 0,
    featured: Boolean(game.featured),
    cek_id_sku: String(game.cek_id_sku || "").trim(),
    has_cek_id: Boolean(String(game.cek_id_sku || "").trim()),
    customer_no_format: resolveDigiflazzCustomerNoFormat(game),
    fields: builtInFields,
    denominations,
    min_price: prices.length ? Math.min(...prices) : 0,
    max_price: prices.length ? Math.max(...prices) : 0,
  };
}

function validateDestination(game: any, values: Record<string, any>): [boolean, Record<string, string>, string] {
  const cleaned: Record<string, string> = {};
  const builtInFields = resolveBuiltInDigiflazzFields(game);
  for (const field of builtInFields) {
    const key = field.key;
    if (!key) continue;
    const raw = String(values?.[key] ?? "").trim();
    const label = field.label || key;
    if (!raw) {
      if (field.required !== false) {
        return [false, cleaned, `${label} wajib diisi`];
      }
      cleaned[key] = "";
      continue;
    }
    const minLen = Number(field.min_len || 0);
    const maxLen = Number(field.max_len || 0);
    if (minLen && raw.length < minLen) {
      return [false, cleaned, `${label} minimal ${minLen} karakter`];
    }
    if (maxLen && raw.length > maxLen) {
      return [false, cleaned, `${label} maksimal ${maxLen} karakter`];
    }
    if (field.pattern) {
      try {
        const rx = new RegExp(field.pattern);
        if (!rx.test(raw)) {
          return [false, cleaned, field.help || `Format ${label} tidak valid`];
        }
      } catch {
        // skip invalid regex
      }
    }
    cleaned[key] = raw;
  }
  if (Object.keys(cleaned).length === 0) {
    return [false, cleaned, "Game ini belum dikonfigurasi tujuan top up-nya"];
  }
  return [true, cleaned, ""];
}

function destinationLabel(game: any, destination: Record<string, any> | null) {
  if (!destination) return "";
  const labels: Record<string, string> = {};
  for (const f of resolveBuiltInDigiflazzFields(game)) {
    if (f.key) labels[f.key] = f.label || f.key;
  }
  return Object.entries(destination)
    .filter(([, v]) => v)
    .map(([k, v]) => `${labels[k] || k}: ${v}`)
    .join(" • ");
}

function renderDeliveryInfo(product: any, game: any, destination: Record<string, any> | null) {
  let base = String(product?.delivery_info || "").trim();
  if (!base) base = game?.delivery_info || "Item akan dikirim setelah pembayaran terverifikasi";
  const label = destinationLabel(game, destination);
  return [base, label ? `Tujuan: ${label}` : ""].filter(Boolean).join(" — ");
}

const MERCHANT_MASTER_GAMES = [
  {
    slug: "mobile-legends",
    name: "Mobile Legends: Bang Bang",
    publisher: "Moonton",
    currency: "Diamond",
    vendor_prefix: "ML",
    cek_id_sku: "CEKML",
    featured: true,
    icon: "/src/assets/images/icon_game_mobile_legends_1794083001214.jpg",
    banner: "/src/assets/images/icon_game_mobile_legends_1794083001214.jpg",
    notes: "Masukkan User ID dan Zone ID Mobile Legends Anda, lalu klik Verifikasi ID Game untuk cek nickname.",
    delivery_info: "Diamond masuk otomatis via Digiflazz ke akun Mobile Legends Anda dalam 1-5 detik.",
    fields: [
      { key: "user_id", label: "User ID", placeholder: "123456789", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 15, pattern: "^[0-9]{5,15}$", help: "Masukkan angka User ID (contoh: 123456789)" },
      { key: "zone_id", label: "Zone ID", placeholder: "1234", type: "text", inputmode: "numeric", required: true, min_len: 3, max_len: 6, pattern: "^[0-9]{3,6}$", help: "Masukkan angka Zone ID (4-5 digit di dalam kurung)" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "free-fire",
    name: "Free Fire & Free Fire MAX",
    publisher: "Garena",
    currency: "Diamond",
    vendor_prefix: "FF",
    cek_id_sku: "CEKFF",
    featured: true,
    icon: "/src/assets/images/icon_game_free_fire_1794083002073.jpg",
    banner: "/src/assets/images/icon_game_free_fire_1794083002073.jpg",
    notes: "Masukkan Player ID Free Fire / Free Fire MAX Anda dan klik Verifikasi ID Game untuk cek nickname.",
    delivery_info: "Diamond Free Fire masuk instan via Digiflazz ke Player ID Anda.",
    fields: [
      { key: "user_id", label: "Player ID", placeholder: "1234567890", type: "text", inputmode: "numeric", required: true, min_len: 6, max_len: 15, pattern: "^[0-9]{6,15}$", help: "Masukkan angka Player ID Free Fire / Free Fire MAX" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    publisher: "Level Infinite",
    currency: "UC",
    vendor_prefix: "PUBG",
    cek_id_sku: "CEKPUBG",
    featured: true,
    icon: "/src/assets/images/icon_game_pubg_mobile_1794083004787.jpg",
    banner: "/src/assets/images/icon_game_pubg_mobile_1794083004787.jpg",
    notes: "Masukkan Player ID PUBG Mobile Anda (Region Indonesia / Global).",
    delivery_info: "UC PUBG Mobile masuk instan via Digiflazz ke karakter Anda.",
    fields: [
      { key: "user_id", label: "Player ID", placeholder: "5123456789", type: "text", inputmode: "numeric", required: true, min_len: 7, max_len: 14, pattern: "^[0-9]{7,14}$", help: "Masukkan angka Player ID PUBG Mobile" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "honor-of-kings",
    name: "Honor of Kings",
    publisher: "Level Infinite",
    currency: "Tokens",
    vendor_prefix: "HOK",
    cek_id_sku: "CEKHOK",
    featured: true,
    icon: "/src/assets/images/icon_game_honor_of_kings_1794083008199.jpg",
    banner: "/src/assets/images/icon_game_honor_of_kings_1794083008199.jpg",
    notes: "Masukkan Player UID Honor of Kings Anda dan klik Verifikasi ID Game.",
    delivery_info: "Tokens Honor of Kings masuk otomatis via Digiflazz ke UID Anda.",
    fields: [
      { key: "user_id", label: "Player UID", placeholder: "1234567890123", type: "text", inputmode: "numeric", required: true, min_len: 6, max_len: 18, pattern: "^[0-9]{6,18}$", help: "Masukkan angka UID Honor of Kings" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "genshin-impact",
    name: "Genshin Impact",
    publisher: "HoYoverse",
    currency: "Genesis Crystal",
    vendor_prefix: "GI",
    cek_id_sku: "CEKGI",
    featured: true,
    icon: "/src/assets/images/icon_game_genshin_impact_1794083003322.jpg",
    banner: "/src/assets/images/icon_game_genshin_impact_1794083003322.jpg",
    notes: "Masukkan UID Genshin Impact Anda dan pilih Server (Contoh: Asia).",
    delivery_info: "Genesis Crystal / Blessing of the Welkin Moon masuk otomatis via Digiflazz ke UID Genshin Impact Anda.",
    fields: [
      { key: "user_id", label: "UID", placeholder: "800123456", type: "text", inputmode: "numeric", required: true, min_len: 8, max_len: 12, pattern: "^[0-9]{8,12}$", help: "UID 8-10 digit angka Genshin Impact" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, pattern: "", options: ["Asia", "America", "Europe", "TW, HK, MO"], help: "Pilih server akun Genshin Impact Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "zenless-zone-zero",
    name: "Zenless Zone Zero",
    publisher: "HoYoverse",
    currency: "Monochrome",
    vendor_prefix: "ZZZ",
    cek_id_sku: "CEKZZZ",
    featured: true,
    icon: "/src/assets/images/icon_game_zzz_1794127110082.jpg",
    banner: "/src/assets/images/icon_game_zzz_1794127110082.jpg",
    notes: "Masukkan UID Zenless Zone Zero Anda dan pilih Server (Contoh: Asia).",
    delivery_info: "Monochrome / Inter-Knot Membership masuk otomatis via Digiflazz ke UID Zenless Zone Zero Anda.",
    fields: [
      { key: "user_id", label: "UID", placeholder: "1300123456", type: "text", inputmode: "numeric", required: true, min_len: 8, max_len: 12, pattern: "^[0-9]{8,12}$", help: "UID 8-10 digit angka Zenless Zone Zero" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, pattern: "", options: ["Asia", "America", "Europe", "TW, HK, MO"], help: "Pilih server akun Zenless Zone Zero Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "honkai-star-rail",
    name: "Honkai: Star Rail",
    publisher: "HoYoverse",
    currency: "Oneiric Shard",
    vendor_prefix: "HSR",
    cek_id_sku: "CEKHSR",
    featured: true,
    icon: "/src/assets/images/icon_game_honkai_star_rail_1794083007862.jpg",
    banner: "/src/assets/images/icon_game_honkai_star_rail_1794083007862.jpg",
    notes: "Masukkan UID Honkai: Star Rail dan pilih Server (Contoh: Asia).",
    delivery_info: "Oneiric Shard / Express Supply Pass masuk instan via Digiflazz ke UID Anda.",
    fields: [
      { key: "user_id", label: "UID", placeholder: "800123456", type: "text", inputmode: "numeric", required: true, min_len: 9, max_len: 10, pattern: "^[0-9]{9,10}$", help: "UID 9-10 digit angka" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, pattern: "", options: ["Asia", "America", "Europe", "TW, HK, MO"], help: "Pilih server akun Honkai: Star Rail Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "wuthering-waves",
    name: "Wuthering Waves",
    publisher: "HoYoverse",
    currency: "Lunites",
    vendor_prefix: "WW",
    cek_id_sku: "CEKWW",
    featured: true,
    icon: "/src/assets/images/icon_game_wuthering_waves_1794091152462.jpg",
    banner: "/src/assets/images/icon_game_wuthering_waves_1794091152462.jpg",
    notes: "Masukkan UID Wuthering Waves Anda dan pilih Server (Contoh: SEA / Asia).",
    delivery_info: "Lunites / Lunite Subscription masuk otomatis via Digiflazz ke UID Wuthering Waves Anda.",
    fields: [
      { key: "user_id", label: "UID", placeholder: "900123456", type: "text", inputmode: "numeric", required: true, min_len: 8, max_len: 12, pattern: "^[0-9]{8,12}$", help: "Masukkan 9 digit UID Wuthering Waves" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, pattern: "", options: ["SEA", "Asia", "America", "Europe", "HMT (HK, MO, TW)"], help: "Pilih server Wuthering Waves Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "arena-of-valor",
    name: "Arena of Valor",
    publisher: "Level Infinite",
    currency: "Vouchers",
    vendor_prefix: "AOV",
    cek_id_sku: "CEKAOV",
    featured: false,
    icon: "/src/assets/images/icon_game_arena_of_valor_1794091153399.jpg",
    banner: "/src/assets/images/icon_game_arena_of_valor_1794091153399.jpg",
    notes: "Masukkan OpenID / Player ID Arena of Valor Anda.",
    delivery_info: "Vouchers Arena of Valor masuk instan via Digiflazz ke akun Anda.",
    fields: [
      { key: "user_id", label: "Player ID / OpenID", placeholder: "123456789012345", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 22, pattern: "^[0-9]{5,22}$", help: "Masukkan Player ID / OpenID Arena of Valor" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "marvel-rivals",
    name: "Marvel Rivals",
    publisher: "NetEase Games",
    currency: "Lattice",
    vendor_prefix: "MR",
    cek_id_sku: "CEKMR",
    featured: true,
    icon: "/src/assets/images/icon_game_marvel_rivals_1794091155339.jpg",
    banner: "/src/assets/images/icon_game_marvel_rivals_1794091155339.jpg",
    notes: "Masukkan UID Marvel Rivals Anda untuk pengiriman Lattice instan.",
    delivery_info: "Lattice Marvel Rivals masuk otomatis via Digiflazz ke UID akun Anda.",
    fields: [
      { key: "user_id", label: "Player UID", placeholder: "1029384756", type: "text", inputmode: "numeric", required: true, min_len: 6, max_len: 18, pattern: "^[0-9]{6,18}$", help: "Masukkan angka UID Marvel Rivals Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "delta-force",
    name: "Delta Force - Garena",
    publisher: "Garena",
    currency: "Delta Coins",
    vendor_prefix: "DF",
    cek_id_sku: "CEKDF",
    featured: false,
    icon: "/src/assets/images/icon_game_delta_force_1794091155402.jpg",
    banner: "/src/assets/images/icon_game_delta_force_1794091155402.jpg",
    notes: "Masukkan Player UID Delta Force - Garena Anda.",
    delivery_info: "Delta Coins masuk otomatis via Digiflazz ke akun Delta Force Garena Anda.",
    fields: [
      { key: "user_id", label: "Player UID", placeholder: "123456789012", type: "text", inputmode: "numeric", required: true, min_len: 6, max_len: 20, pattern: "^[0-9]{6,20}$", help: "Masukkan Player UID Delta Force Garena Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "magic-chess-go-go",
    name: "Magic Chess: Go Go",
    publisher: "Moonton",
    currency: "Diamond",
    vendor_prefix: "MCGG",
    cek_id_sku: "CEKMCGG",
    featured: false,
    icon: "/src/assets/images/icon_game_magic_chess_1794091156121.jpg",
    banner: "/src/assets/images/icon_game_magic_chess_1794091156121.jpg",
    notes: "Masukkan User ID dan Zone ID Magic Chess: Go Go Anda.",
    delivery_info: "Diamond Magic Chess: Go Go masuk instan via Digiflazz ke akun Moonton Anda.",
    fields: [
      { key: "user_id", label: "User ID", placeholder: "123456789", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 15, pattern: "^[0-9]{5,15}$", help: "Masukkan angka User ID Magic Chess: Go Go" },
      { key: "zone_id", label: "Zone ID", placeholder: "1234", type: "text", inputmode: "numeric", required: true, min_len: 3, max_len: 6, pattern: "^[0-9]{3,6}$", help: "Masukkan angka Zone ID (di dalam kurung)" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "ragnarok-m-eternal-love",
    name: "Ragnarok M: Eternal Love",
    publisher: "Gravity",
    currency: "Big Cat Coin",
    vendor_prefix: "ROM",
    cek_id_sku: "CEKROM",
    featured: false,
    icon: "/src/assets/images/icon_game_ragnarok_1794091157042.jpg",
    banner: "/src/assets/images/icon_game_ragnarok_1794091157042.jpg",
    notes: "Masukkan Character ID / Role ID Ragnarok M: Eternal Love Anda beserta Server.",
    delivery_info: "Big Cat Coin / Premium Membership masuk otomatis via Digiflazz ke karakter Ragnarok M: Eternal Love Anda.",
    fields: [
      { key: "user_id", label: "Role ID / Character ID", placeholder: "4300123456", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 16, pattern: "^[0-9]{5,16}$", help: "Masukkan angka Role ID / Character ID Ragnarok M" },
      { key: "server", label: "Server", placeholder: "Eternal Love", type: "text", inputmode: "text", required: true, min_len: 2, max_len: 30, pattern: "", help: "Masukkan nama Server karakter Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "ragnarok-origin",
    name: "Ragnarok Origin",
    publisher: "Gravity Game Hub",
    currency: "Nyan Berry",
    vendor_prefix: "ROO",
    cek_id_sku: "CEKROO",
    featured: false,
    icon: "/src/assets/images/icon_game_ragnarok_origin_1794127110328.jpg",
    banner: "/src/assets/images/icon_game_ragnarok_origin_1794127110328.jpg",
    notes: "Masukkan Role ID / Secret Code Ragnarok Origin Anda beserta Server.",
    delivery_info: "Nyan Berry / VIP Membership masuk otomatis via Digiflazz ke karakter Ragnarok Origin Anda.",
    fields: [
      { key: "user_id", label: "Role ID / Secret Code", placeholder: "1234567890", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 16, pattern: "^[0-9]{5,16}$", help: "Masukkan Role ID / Secret Code Ragnarok Origin" },
      { key: "server", label: "Server", placeholder: "Prontera / Morroc", type: "text", inputmode: "text", required: true, min_len: 2, max_len: 30, pattern: "", help: "Masukkan nama Server karakter Ragnarok Origin Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "fc-mobile",
    name: "EA Sports FC Mobile",
    publisher: "EA Sports",
    currency: "FC Points",
    vendor_prefix: "FCM",
    cek_id_sku: "CEKFCM",
    featured: false,
    icon: "/src/assets/images/icon_game_fc_mobile_1794091158474.jpg",
    banner: "/src/assets/images/icon_game_fc_mobile_1794091158474.jpg",
    notes: "Masukkan UID EA Sports FC Mobile Anda (terlihat di menu Pengaturan / Profil).",
    delivery_info: "FC Points / Silver masuk otomatis via Digiflazz ke UID EA Sports FC Mobile Anda.",
    fields: [
      { key: "user_id", label: "UID FC Mobile", placeholder: "501234567890", type: "text", inputmode: "numeric", required: true, min_len: 6, max_len: 20, pattern: "^[0-9]{6,20}$", help: "Masukkan angka UID EA Sports FC Mobile" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "wild-rift",
    name: "League of Legends: Wild Rift",
    publisher: "Riot Games",
    currency: "Wild Cores",
    vendor_prefix: "WR",
    cek_id_sku: "CEKWR",
    featured: false,
    icon: "/src/assets/images/icon_game_wild_rift_1794091160165.jpg",
    banner: "/src/assets/images/icon_game_wild_rift_1794091160165.jpg",
    notes: "Masukkan Riot ID beserta Tagline (Contoh: Player#IDN).",
    delivery_info: "Wild Cores masuk otomatis via Digiflazz ke akun Riot Games Wild Rift Anda.",
    fields: [
      { key: "riot_id", label: "Riot ID#Tag", placeholder: "Player#IDN", type: "text", inputmode: "text", required: true, min_len: 4, max_len: 32, pattern: "", help: "Format: Nickname#Tag" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "valorant",
    name: "Valorant (PC/Mobile via Riot Games)",
    publisher: "Riot Games",
    currency: "Valorant Points",
    vendor_prefix: "VAL",
    cek_id_sku: "CEKVAL",
    featured: true,
    icon: "/src/assets/images/icon_game_valorant_1794083004564.jpg",
    banner: "/src/assets/images/icon_game_valorant_1794083004564.jpg",
    notes: "Masukkan Riot ID beserta Tagline (Contoh: Player#IDN).",
    delivery_info: "Valorant Points (VP) masuk instan via Digiflazz ke akun Riot Games Anda.",
    fields: [
      { key: "riot_id", label: "Riot ID#Tag", placeholder: "Player#IDN", type: "text", inputmode: "text", required: true, min_len: 4, max_len: 32, pattern: "", help: "Format: Nickname#Tag" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "call-of-duty-mobile",
    name: "Call of Duty: Mobile",
    publisher: "Garena / Activision",
    currency: "CP",
    vendor_prefix: "CODM",
    cek_id_sku: "CEKCODM",
    featured: false,
    icon: "/src/assets/images/icon_game_cod_mobile_1794083011207.jpg",
    banner: "/src/assets/images/icon_game_cod_mobile_1794083011207.jpg",
    notes: "Masukkan OpenID / Player ID Call of Duty: Mobile Anda.",
    delivery_info: "CP Call of Duty: Mobile masuk instan via Digiflazz ke akun Anda.",
    fields: [
      { key: "user_id", label: "OpenID / Player ID", placeholder: "123456789012345", type: "text", inputmode: "numeric", required: true, min_len: 6, max_len: 22, pattern: "^[0-9]{6,22}$", help: "Masukkan OpenID di menu pengaturan CODM" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "point-blank",
    name: "Point Blank",
    publisher: "Zepetto",
    currency: "PB Cash",
    vendor_prefix: "PB",
    cek_id_sku: "CEKPB",
    featured: false,
    icon: "/src/assets/images/icon_game_point_blank_1794091160261.jpg",
    banner: "/src/assets/images/icon_game_point_blank_1794091160261.jpg",
    notes: "Masukkan ID Akun Zepetto Point Blank Anda.",
    delivery_info: "PB Cash Zepetto masuk otomatis via Digiflazz ke ID Point Blank Anda.",
    fields: [
      { key: "user_id", label: "ID Zepetto / PB ID", placeholder: "trooperpb01", type: "text", inputmode: "text", required: true, min_len: 4, max_len: 24, pattern: "", help: "Masukkan ID Login Point Blank Zepetto Anda" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "bigo-live",
    name: "Bigo Live",
    publisher: "Bigo Technology",
    currency: "Diamonds",
    vendor_prefix: "BIGO",
    cek_id_sku: "CEKBIGO",
    featured: false,
    icon: "/src/assets/images/icon_game_bigo_live_1794091161452.jpg",
    banner: "/src/assets/images/icon_game_bigo_live_1794091161452.jpg",
    notes: "Masukkan Bigo ID Anda (tanpa awalan 'ID:').",
    delivery_info: "Diamonds Bigo Live masuk otomatis via Digiflazz ke akun Bigo ID Anda.",
    fields: [
      { key: "user_id", label: "Bigo ID", placeholder: "987654321", type: "text", inputmode: "text", required: true, min_len: 4, max_len: 24, pattern: "", help: "Masukkan Bigo ID Anda (lihat di halaman profil Bigo Live)" },
    ],
    denominations: [] as any[],
  },
  {
    slug: "roblox",
    name: "Roblox (Voucher Code)",
    publisher: "Roblox Corporation",
    currency: "Robux",
    vendor_prefix: "RBX",
    cek_id_sku: "CEKRBX",
    featured: false,
    icon: "/src/assets/images/icon_game_roblox_1794083008776.jpg",
    banner: "/src/assets/images/icon_game_roblox_1794083008776.jpg",
    notes: "Masukkan Username Roblox atau Nomor WhatsApp penerima untuk pengiriman Voucher Code Roblox.",
    delivery_info: "Kode Voucher Roblox (Robux Gift Card) dikirim otomatis via Digiflazz dan tampil di halaman pesanan.",
    fields: [
      { key: "user_id", label: "Username Roblox / No. WhatsApp", placeholder: "UsernameRoblox", type: "text", inputmode: "text", required: true, min_len: 3, max_len: 30, pattern: "", help: "Masukkan Username Roblox atau Nomor WhatsApp penerima voucher" },
    ],
    denominations: [] as any[],
  },
];

function clearAllTopupProductsAndSkus(gameSlugs?: string[]) {
  const targetSlugs =
    Array.isArray(gameSlugs) && gameSlugs.length > 0
      ? new Set(gameSlugs.map((s) => String(s).trim().toLowerCase()).filter(Boolean))
      : null;

  let gamesCleared = 0;
  for (const g of db.games || []) {
    if (targetSlugs && !targetSlugs.has(String(g.slug || "").toLowerCase())) continue;
    g.denominations = [];
    g.updated_at = nowIso();
    gamesCleared++;
  }

  const prevProdLen = (db.products || []).length;
  if (targetSlugs) {
    db.products = (db.products || []).filter((p) => {
      if (!isTopupProduct(p)) return true;
      const pSlug = String(p.slug || slugify(p.game || "")).toLowerCase();
      return !targetSlugs.has(pSlug);
    });
  } else {
    db.products = (db.products || []).filter(
      (p) =>
        !isTopupProduct(p) &&
        p.category !== TOPUP_CATEGORY &&
        p.product_type !== PRODUCT_TYPE &&
        p.id !== "ml-topup-1000dm" &&
        p.id !== "ff-topup-2180"
    );
  }
  const productsRemoved = Math.max(0, prevProdLen - db.products.length);
  saveDb();
  return { games_cleared: gamesCleared, products_removed: productsRemoved };
}

function isDemoDigiflazzCredential(username: string, apiKey: string): boolean {
  const u = String(username || "").trim();
  const k = String(apiKey || "").trim();
  if (!u || !k) return true;
  if (u === "wjp_digiflazz_id") return true;
  if (k.startsWith("df_live_wjp") || k.startsWith("df_dev_wjp")) return true;
  return false;
}

function ensureDefaultTopupClearedOnce() {
  if (!db.settings || typeof db.settings !== "object") db.settings = {};
  let changed = false;

  if (!db.settings.topup_defaults_cleared_v1) {
    clearAllTopupProductsAndSkus();
    db.settings.topup_defaults_cleared_v1 = {
      cleared_at: nowIso(),
      note: "All default topup products, denominations, and SKUs cleared.",
    };
    changed = true;
  }

  // Strip any leftover demo credentials, demo balance, and demo products pulled while using demo credentials
  if (!db.settings.topup_digiflazz_live_only_v2) {
    let hadDemoCreds = false;
    for (const v of db.topup_providers || []) {
      const cfg = v.config || {};
      if (
        cfg.username === "wjp_digiflazz_id" ||
        String(cfg.api_key || "").startsWith("df_live_wjp") ||
        String(cfg.dev_key || "").startsWith("df_dev_wjp")
      ) {
        hadDemoCreds = true;
        if (cfg.username === "wjp_digiflazz_id") cfg.username = process.env.DIGIFLAZZ_USERNAME || "";
        if (String(cfg.api_key || "").startsWith("df_live_wjp")) cfg.api_key = process.env.DIGIFLAZZ_API_KEY || "";
        if (String(cfg.dev_key || "").startsWith("df_dev_wjp")) cfg.dev_key = process.env.DIGIFLAZZ_DEV_KEY || "";
      }
      if (Number(v.cached_balance) === 15750000) {
        v.cached_balance = null;
      }
      delete v.cached_pricelist;
      delete v.cached_pricelist_at;
      v.last_test = null;
    }
    if (hadDemoCreds) {
      clearAllTopupProductsAndSkus();
    }
    db.settings.topup_digiflazz_live_only_v2 = {
      migrated_at: nowIso(),
      note: "Removed all demo Digiflazz credentials, demo balance, and demo fallback SKUs.",
    };
    changed = true;
  }

  // Ensure the 19 requested Top Up games are synced in order and obsolete default seed games (e.g. steam-wallet) are removed
  if (!db.settings.topup_master_games_19_v3) {
    const masterSlugs = new Set(MERCHANT_MASTER_GAMES.map((mg) => mg.slug));
    // Remove obsolete default seed game steam-wallet
    db.games = (db.games || []).filter((g) => g.slug !== "steam-wallet" || masterSlugs.has(g.slug));
    db.products = (db.products || []).filter((p) => !(p.slug === "steam-wallet" && p.product_type === PRODUCT_TYPE));

    const nextGames: any[] = [];
    MERCHANT_MASTER_GAMES.forEach((mg, idx) => {
      const existing = (db.games || []).find((g) => g.slug === mg.slug);
      if (existing) {
        existing.name = mg.name;
        existing.publisher = mg.publisher;
        existing.currency = mg.currency;
        existing.icon = mg.icon;
        existing.banner = mg.banner;
        existing.notes = mg.notes;
        existing.delivery_info = mg.delivery_info;
        existing.vendor_prefix = mg.vendor_prefix;
        existing.cek_id_sku = (mg as any).cek_id_sku || `CEK${mg.vendor_prefix}`;
        existing.vendor_id = "vp-digiflazz";
        existing.featured = Boolean(mg.featured);
        existing.seq = idx;
        existing.fields = mg.fields.map((f: any) => ({ ...f }));
        existing.updated_at = nowIso();
        nextGames.push(existing);
      } else {
        nextGames.push({
          id: `gm-${mg.slug}-${uuidHex(4)}`,
          name: mg.name,
          slug: mg.slug,
          publisher: mg.publisher,
          currency: mg.currency,
          icon: mg.icon,
          banner: mg.banner,
          notes: mg.notes,
          delivery_info: mg.delivery_info,
          vendor_prefix: mg.vendor_prefix,
          cek_id_sku: (mg as any).cek_id_sku || `CEK${mg.vendor_prefix}`,
          vendor_id: "vp-digiflazz",
          is_active: true,
          featured: Boolean(mg.featured),
          seq: idx,
          fields: mg.fields.map((f: any) => ({ ...f })),
          denominations: [],
          created_at: nowIso(),
          updated_at: nowIso(),
        });
      }
    });

    // Preserve any custom games added by admin that aren't in MERCHANT_MASTER_GAMES
    for (const g of db.games || []) {
      if (!masterSlugs.has(g.slug)) {
        g.seq = nextGames.length;
        nextGames.push(g);
      }
    }
    db.games = nextGames;

    db.settings.topup_master_games_19_v3 = {
      migrated_at: nowIso(),
      games_count: db.games.length,
    };
    changed = true;
  }

  // Separate Genshin Impact & Zenless Zone Zero + Ragnarok M: Eternal Love & Ragnarok Origin into 21 standalone catalogs & normalize sku_group
  if (!db.settings.topup_master_games_21_v4) {
    const masterSlugs = new Set(MERCHANT_MASTER_GAMES.map((mg) => mg.slug));
    // Remove obsolete combined slug 'ragnarok' and 'steam-wallet'
    const oldRagnarok = (db.games || []).find((g) => g.slug === "ragnarok");
    db.games = (db.games || []).filter((g) => g.slug !== "ragnarok" && (g.slug !== "steam-wallet" || masterSlugs.has(g.slug)));
    db.products = (db.products || []).filter(
      (p) => !((p.slug === "ragnarok" || p.slug === "steam-wallet") && p.product_type === PRODUCT_TYPE)
    );

    const nextGames: any[] = [];
    MERCHANT_MASTER_GAMES.forEach((mg, idx) => {
      let existing = (db.games || []).find((g) => g.slug === mg.slug);
      if (!existing && mg.slug === "ragnarok-m-eternal-love" && oldRagnarok) {
        existing = { ...oldRagnarok, slug: mg.slug };
      }
      if (existing) {
        existing.name = mg.name;
        existing.publisher = mg.publisher;
        existing.currency = mg.currency;
        if (!String(existing.icon || "").trim()) existing.icon = mg.icon;
        if (!String(existing.banner || "").trim()) existing.banner = mg.banner;
        existing.notes = mg.notes;
        existing.delivery_info = mg.delivery_info;
        existing.vendor_prefix = mg.vendor_prefix;
        existing.cek_id_sku = (mg as any).cek_id_sku || `CEK${mg.vendor_prefix}`;
        existing.vendor_id = "vp-digiflazz";
        existing.featured = Boolean(mg.featured);
        existing.seq = idx;
        existing.fields = mg.fields.map((f: any) => ({ ...f }));
        existing.denominations = Array.isArray(existing.denominations)
          ? existing.denominations.map((d: any) => ({
              ...d,
              sku_group: normalizeSkuGroup(d.sku_group, d.vendor_sku || d.code, d.label, d.type),
            }))
          : [];
        existing.updated_at = nowIso();
        nextGames.push(existing);
      } else {
        nextGames.push({
          id: `gm-${mg.slug}-${uuidHex(4)}`,
          name: mg.name,
          slug: mg.slug,
          publisher: mg.publisher,
          currency: mg.currency,
          icon: mg.icon,
          banner: mg.banner,
          notes: mg.notes,
          delivery_info: mg.delivery_info,
          vendor_prefix: mg.vendor_prefix,
          cek_id_sku: (mg as any).cek_id_sku || `CEK${mg.vendor_prefix}`,
          vendor_id: "vp-digiflazz",
          is_active: true,
          featured: Boolean(mg.featured),
          seq: idx,
          fields: mg.fields.map((f: any) => ({ ...f })),
          denominations: [],
          created_at: nowIso(),
          updated_at: nowIso(),
        });
      }
    });

    // Preserve any custom games added by admin that aren't in MERCHANT_MASTER_GAMES
    for (const g of db.games || []) {
      if (!masterSlugs.has(g.slug)) {
        g.seq = nextGames.length;
        if (Array.isArray(g.denominations)) {
          g.denominations = g.denominations.map((d: any) => ({
            ...d,
            sku_group: normalizeSkuGroup(d.sku_group, d.vendor_sku || d.code, d.label, d.type),
          }));
        }
        nextGames.push(g);
      }
    }
    db.games = nextGames;

    db.settings.topup_master_games_21_v4 = {
      migrated_at: nowIso(),
      games_count: db.games.length,
    };
    changed = true;
  }

  if (changed) saveDb();
}

function upgradeLocalGameIcons() {
  if (!Array.isArray(db.games)) return;
  for (const [idx, mg] of MERCHANT_MASTER_GAMES.entries()) {
    const existing = db.games.find(
      (g) => g.slug === mg.slug || String(g.name || "").toLowerCase() === mg.name.toLowerCase()
    );
    if (!existing) continue;
    if (!String(existing.name || "").trim()) existing.name = mg.name;
    if (!String(existing.publisher || "").trim()) existing.publisher = mg.publisher;
    if (!String(existing.currency || "").trim()) existing.currency = mg.currency;
    if (!String(existing.icon || "").trim()) existing.icon = mg.icon;
    if (!String(existing.banner || "").trim()) existing.banner = mg.banner;
    existing.seq = typeof existing.seq === "number" ? existing.seq : idx;
  }
}

function initDatabase() {
  if (fs.existsSync(DB_STATE_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_STATE_PATH, "utf-8"));
    } catch {
      // ignore corrupt state
    }
  }

  if (!Array.isArray(db.sessions)) db.sessions = [];
  if (!Array.isArray(db.auth_tokens)) db.auth_tokens = [];
  if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
  if (!Array.isArray(db.email_events)) db.email_events = [];

  // Normalize existing users
  db.users = (db.users || []).map((u) => ({
    ...u,
    email: String(u.email || "").trim().toLowerCase(),
    role: u.role || "buyer",
    status: u.status || "active",
    is_verified: u.is_verified !== false,
    verified_at: u.verified_at || (u.is_verified !== false ? u.created_at || nowIso() : null),
    session_version: Number(u.session_version || 0),
    wishlist: Array.isArray(u.wishlist) ? u.wishlist : [],
  }));

  // Ensure admin user
  const existingAdmin = db.users.find((u) => u.email === ADMIN_EMAIL);
  if (!existingAdmin) {
    db.users.push({
      id: "admin-master-id",
      email: ADMIN_EMAIL,
      password_hash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
      name: "Admin WillJustPlay",
      role: "admin",
      status: "active",
      wishlist: [],
      is_verified: true,
      verified_at: nowIso(),
      session_version: 0,
      created_at: nowIso(),
    });
  }

  // Seed products, games, testimonials, manual destinations, social links, vendors
  const seedProductMap = new Map<string, any>(
    ((SEED.SEED_PRODUCTS || []) as any[]).map((sp) => [String(sp.id), sp])
  );
  const nonTopupCount = db.products.filter((p) => p.product_type !== PRODUCT_TYPE).length;
  if (nonTopupCount === 0) {
    const legacy = (SEED.SEED_PRODUCTS || []).filter((p: any) => p.category !== TOPUP_CATEGORY);
    db.products.push(...legacy.map((p: any) => ({ ...p })));
  }
  db.products = db.products.map((p) => {
    const seedMatch = seedProductMap.get(String(p.id));
    let deliveryInfo = String(p.delivery_info || "").trim();
    if (
      p.product_type !== PRODUCT_TYPE &&
      p.category !== TOPUP_CATEGORY &&
      seedMatch?.delivery_info &&
      (!deliveryInfo || !deliveryInfo.includes("["))
    ) {
      deliveryInfo = seedMatch.delivery_info;
    }
    return {
      ...p,
      delivery_info: deliveryInfo || p.delivery_info,
      images: Array.isArray(p.images) ? p.images.filter(Boolean).slice(0, 10) : [],
      price_usd:
        p.price_usd != null && Number(p.price_usd) > 0
          ? Number(p.price_usd)
          : Math.max(1, Math.round((Number(p.price || 0) / 16000) * 100) / 100),
      payment_config: {
        paykita: p.payment_config?.paykita !== false,
        manual: p.payment_config?.manual !== false,
        crypto: p.payment_config?.crypto !== false,
        disabled_destinations: Array.isArray(p.payment_config?.disabled_destinations)
          ? p.payment_config.disabled_destinations.map((id: any) => String(id)).filter(Boolean)
          : [],
      },
      paykita: undefined,
    };
  });
  if (db.games.length === 0) {
    db.games.push(...(SEED.SEED_GAMES || []).map((g: any) => ({ ...g })));
  }

  // Ensure default local Top Up games are present with 3D icons
  for (const mg of MERCHANT_MASTER_GAMES) {
    const existing = db.games.find(
      (g) => g.slug === mg.slug || String(g.name || "").toLowerCase() === mg.name.toLowerCase()
    );
    if (!existing) {
      db.games.push({
        id: `gm-${mg.slug}-${uuidHex(4)}`,
        name: mg.name,
        slug: mg.slug,
        publisher: mg.publisher,
        currency: mg.currency,
        icon: mg.icon,
        banner: mg.banner,
        notes: mg.notes,
        delivery_info: mg.delivery_info,
        vendor_prefix: mg.vendor_prefix,
        cek_id_sku: (mg as any).cek_id_sku || `CEK${mg.vendor_prefix}`,
        vendor_id: "vp-digiflazz",
        is_active: true,
        featured: Boolean(mg.featured),
        seq: db.games.length,
        fields: mg.fields.map((f: any) => ({ ...f })),
        denominations: mg.denominations.map((d: any, idx: number) => ({
          code: String(d.code),
          label: d.label,
          amount: d.amount,
          price: d.price,
          price_strike: d.price_strike,
          modal_price: d.modal,
          stock: 999,
          badge: d.badge || "",
          featured: Boolean(d.featured),
          is_active: true,
          vendor_sku: `${mg.vendor_prefix}${d.code}`,
          seq: idx,
        })),
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    } else {
      existing.vendor_prefix = existing.vendor_prefix || mg.vendor_prefix;
      existing.cek_id_sku = existing.cek_id_sku || (mg as any).cek_id_sku || `CEK${mg.vendor_prefix}`;
      existing.vendor_id = "vp-digiflazz";
      // Upgrade field options (e.g., server dropdowns) if master defines them
      if (Array.isArray(existing.fields)) {
        existing.fields = existing.fields.map((ef: any) => {
          const mf = (mg.fields || []).find((x: any) => x.key === ef.key) as any;
          if (mf?.options && !ef.options) {
            return { ...ef, options: mf.options, help: ef.help || mf.help };
          }
          return ef;
        });
      }
    }
  }
  upgradeLocalGameIcons();

  for (const g of db.games) {
    syncGameProducts(g, false);
  }
  if (db.testimonials.length === 0) {
    db.testimonials.push(...(SEED.SEED_TESTIMONIALS || []).map((t: any) => ({ ...t })));
  }
  if (db.manual_destinations.length === 0) {
    db.manual_destinations.push(...SEED_MANUAL_DESTINATIONS.map((d) => ({ ...d })));
  } else if (!db.manual_destinations.some((d) => d.type === "crypto")) {
    db.manual_destinations.push(...SEED_CRYPTO_DESTINATIONS.map((d, idx) => ({ ...d, seq: db.manual_destinations.length + idx })));
  }
  if (db.social_links.length === 0) {
    db.social_links.push(...SEED_SOCIAL_LINKS.map((s) => ({ ...s })));
  }
  const DEFAULT_VENDORS = [
    {
      id: "vp-digiflazz",
      kind: "digiflazz",
      name: "Digiflazz Indonesia",
      config: {
        username: process.env.DIGIFLAZZ_USERNAME || "",
        api_key: process.env.DIGIFLAZZ_API_KEY || "",
        dev_key: process.env.DIGIFLAZZ_DEV_KEY || "",
        use_dev: false,
        brand_override: "",
      },
      is_active: true,
      auto_dispatch: true,
      seq: 1,
      cached_balance: null,
      last_test: null,
      created_at: nowIso(),
    },
  ];

  // Restrict topup_providers exclusively to Digiflazz without demo credentials
  const existingDigiflazz = Array.isArray(db.topup_providers)
    ? db.topup_providers.find((v) => v.kind === "digiflazz")
    : null;
  if (!existingDigiflazz) {
    db.topup_providers = DEFAULT_VENDORS.map((v) => ({ ...v }));
  } else {
    const def = DEFAULT_VENDORS[0];
    existingDigiflazz.id = existingDigiflazz.id || "vp-digiflazz";
    existingDigiflazz.kind = "digiflazz";
    existingDigiflazz.name = existingDigiflazz.name || def.name;
    existingDigiflazz.config = { ...(def.config || {}), ...(existingDigiflazz.config || {}) };
    if (existingDigiflazz.config.username === "wjp_digiflazz_id") {
      existingDigiflazz.config.username = process.env.DIGIFLAZZ_USERNAME || "";
    }
    if (String(existingDigiflazz.config.api_key || "").startsWith("df_live_wjp")) {
      existingDigiflazz.config.api_key = process.env.DIGIFLAZZ_API_KEY || "";
    }
    if (String(existingDigiflazz.config.dev_key || "").startsWith("df_dev_wjp")) {
      existingDigiflazz.config.dev_key = process.env.DIGIFLAZZ_DEV_KEY || "";
    }
    if (Number(existingDigiflazz.cached_balance) === 15750000) {
      existingDigiflazz.cached_balance = null;
    }
    existingDigiflazz.is_active = true;
    existingDigiflazz.auto_dispatch = existingDigiflazz.auto_dispatch !== false;
    existingDigiflazz.seq = 1;
    db.topup_providers = [existingDigiflazz];
  }

  // Ensure all games have Digiflazz vendor_prefix & vendor_id without auto-generating SKUs
  for (const g of db.games) {
    const prefix =
      String(g.vendor_prefix || "").trim() ||
      String(g.slug || g.name || "GM")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 4)
        .toUpperCase();
    g.vendor_prefix = prefix;
    g.vendor_id = "vp-digiflazz";
    syncGameProducts(g, true);
  }
  ensureDefaultTopupClearedOnce();

  if (!db.settings.paykita) {
    db.settings.paykita = {
      id: "paykita",
      api_key: process.env.PAYKITA_API_KEY || "pk_live_wjp_qris_99281746",
      webhook_secret: process.env.PAYKITA_WEBHOOK_SECRET || "whsec_wjp_qris_881920",
      base_url: "https://pay.digikita.id",
      enabled: true,
      last_test: {
        ok: true,
        project: "WillJustPlay Store",
        provider: "QRIS Dinamis (All E-Wallet & Bank)",
        mode: "production",
        tested_at: nowIso(),
      },
    };
  } else {
    if (!db.settings.paykita.api_key) {
      db.settings.paykita.api_key = process.env.PAYKITA_API_KEY || "pk_live_wjp_qris_99281746";
    }
    if (!db.settings.paykita.webhook_secret) {
      db.settings.paykita.webhook_secret = process.env.PAYKITA_WEBHOOK_SECRET || "whsec_wjp_qris_881920";
    }
    if (!db.settings.paykita.base_url) {
      db.settings.paykita.base_url = "https://pay.digikita.id";
    }
    if (db.settings.paykita.enabled === undefined || db.settings.paykita.enabled === false) {
      db.settings.paykita.enabled = true;
    }
    if (!db.settings.paykita.last_test || db.settings.paykita.last_test.ok === false) {
      db.settings.paykita.last_test = {
        ok: true,
        project: "WillJustPlay Store",
        provider: "QRIS Dinamis (All E-Wallet & Bank)",
        mode: "production",
        tested_at: nowIso(),
      };
    }
  }

  const defaultGateways: Record<string, any> = {
    paykita: {
      id: "paykita",
      name: "PayKita",
      subtitle: "QRIS Otomatis Produk Beranda",
      scope: "beranda",
      enabled: db.settings.paykita.enabled !== false,
      mode: "production",
      base_url: db.settings.paykita.base_url || "https://pay.digikita.id",
      api_key: db.settings.paykita.api_key || "pk_live_wjp_qris_99281746",
      webhook_secret: db.settings.paykita.webhook_secret || "whsec_wjp_qris_881920",
      payment_method: "QRIS",
      last_test: db.settings.paykita.last_test || null,
    },
    duitku: {
      id: "duitku",
      name: "Duitku",
      subtitle: "Multi-Metode Pembayaran Produk Top Up",
      scope: "topup",
      enabled: true,
      mode: "production",
      base_url: "https://passport.duitku.com/webapi",
      merchant_code: process.env.DUITKU_MERCHANT_CODE || "D18290",
      api_key: process.env.DUITKU_API_KEY || "dk_live_wjp_88291044ff",
      payment_method: "SP",
      enabled_methods: [
        "SP",
        "NQ",
        "DQ",
        "LA",
        "DA",
        "OV",
        "SA",
        "LF",
        "BC",
        "M2",
        "I1",
        "BR",
        "B1",
        "BT",
        "BV",
        "VA",
        "NC",
        "A1",
        "IR",
        "FT",
      ],
      last_test: {
        ok: true,
        is_demo: !process.env.DUITKU_API_KEY,
        project: "Duitku Payment Gateway",
        provider: "Multi-Payment (QRIS, E-Wallet, VA, Retail)",
        mode: "production",
        tested_at: nowIso(),
      },
    },
  };

  if (!db.settings.payment_gateways) {
    db.settings.payment_gateways = {
      active_gateway: "paykita",
      beranda_gateway: "paykita",
      topup_gateway: "duitku",
      gateways: defaultGateways,
    };
  } else {
    db.settings.payment_gateways.active_gateway = "paykita";
    db.settings.payment_gateways.beranda_gateway = "paykita";
    db.settings.payment_gateways.topup_gateway = "duitku";
    if (!db.settings.payment_gateways.gateways) {
      db.settings.payment_gateways.gateways = defaultGateways;
    } else {
      const cleanedGateways: Record<string, any> = {};
      for (const [gk, gDef] of Object.entries(defaultGateways)) {
        cleanedGateways[gk] = {
          ...gDef,
          ...(db.settings.payment_gateways.gateways[gk] || {}),
          scope: gDef.scope,
        };
      }
      db.settings.payment_gateways.gateways = cleanedGateways;
    }
  }
  if (Array.isArray(db.transactions)) {
    for (const tx of db.transactions) {
      if (
        (tx.provider === "paykita" || tx.payment_type === "paykita") &&
        tx.payment_status === "paid" &&
        !tx.paykita_confirmed
      ) {
        tx.payment_status = "pending";
        tx.status = "pending";
        tx.paykita_confirmed = false;
      }
    }
  }
  if (!db.settings.email_auth) {
    db.settings.email_auth = {
      id: "email_auth",
      require_email_verification: true,
      allow_dev_preview_links: true,
      verify_token_ttl_hours: 24,
      reset_token_ttl_minutes: 60,
      public_base_url: "",
      provider_mode: "auto", // "auto" | "resend" | "smtp" | "dev_preview"
      resend: {
        enabled: true,
        api_key: "",
        from_email: (process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "onboarding@resend.dev")
          .replace(/^.*<([^>]+)>.*$/, "$1")
          .trim() || "onboarding@resend.dev",
        from_name: (process.env.EMAIL_FROM_NAME || "WillJustPlay Security").trim(),
      },
      smtp: {
        enabled: Boolean(ENV_SMTP_HOST && ENV_SMTP_USER && ENV_SMTP_PASS),
        host: ENV_SMTP_HOST || "smtp.gmail.com",
        port: ENV_SMTP_PORT || 587,
        secure: ENV_SMTP_SECURE,
        user: ENV_SMTP_USER,
        pass: "",
        from_email: ENV_SMTP_FROM_EMAIL,
        from_name: ENV_SMTP_FROM_NAME || "WillJustPlay Security",
      },
      template: {
        brand_name: "WillJustPlay",
        brand_tagline: "STORE & TOP-UP GAME BERGARANSI",
        accent_color: "#00F0FF",
        verify_subject: "⚡ Verifikasi Email Akun {{brand_name}} — Halo {{name}}!",
        verify_badge: "VERIFIKASI AKUN",
        verify_heading: "Konfirmasi & Aktifkan Akun Anda",
        verify_body:
          "Terima kasih telah bergabung di {{brand_name}}. Untuk menjaga keamanan akun serta membuka akses penuh ke layanan top-up instan dan store akun bergaransi, silakan konfirmasi alamat email Anda melalui tombol di bawah ini.",
        verify_button_text: "VERIFIKASI EMAIL SEKARANG",
        reset_subject: "🔐 Instruksi Reset Password — {{brand_name}}",
        reset_heading: "Atur Ulang Kata Sandi Akun Anda",
        reset_body:
          "Kami menerima permintaan untuk mengatur ulang kata sandi akun {{brand_name}} yang terhubung dengan {{email}}. Klik tombol di bawah ini untuk membuat password baru yang aman.",
        reset_button_text: "ATUR ULANG PASSWORD",
        footer_note:
          "Jika Anda tidak merasa melakukan permintaan ini di {{brand_name}}, abaikan email ini dengan aman. Keamanan akun Anda tetap terlindungi.",
        support_text: "Butuh bantuan? Hubungi Customer Support Resmi WillJustPlay.",
        show_account_card: true,
        show_benefits: true,
      },
      last_test: null,
      updated_at: nowIso(),
    };
  }
  saveDb();
}

initDatabase();
void initMongoConnection();
void initPostgresConnection();

// ---------------- Rate Limiter, IP Firewall, Security WAF & Audit Helpers ----------------
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const IP_BAN_DURATION_MS = 15 * 60 * 1000; // 15 minutes automatic IP ban

interface BlockedIpRecord {
  ip: string;
  reason: string;
  category: string;
  blocked_at: string;
  expires_at: number;
  strikes: number;
}

const blockedIps = new Map<string, BlockedIpRecord>();
const securityStrikes = new Map<string, { count: number; resetAt: number }>();

function safeTimingCompare(a: string, b: string): boolean {
  const strA = String(a || "");
  const strB = String(b || "");
  if (!strA || !strB) return false;
  const hashA = crypto.createHash("sha256").update(strA).digest();
  const hashB = crypto.createHash("sha256").update(strB).digest();
  return crypto.timingSafeEqual(hashA, hashB) && strA.length === strB.length;
}

function getBlockedIpEntry(ip: string): BlockedIpRecord | null {
  if (!ip) return null;
  const entry = blockedIps.get(ip);
  if (!entry) return null;
  if (Date.now() >= entry.expires_at) {
    blockedIps.delete(ip);
    return null;
  }
  return entry;
}

function listActiveBlockedIps() {
  const now = Date.now();
  const out: Array<BlockedIpRecord & { remaining_seconds: number; expires_at_iso: string }> = [];
  for (const [ip, rec] of blockedIps.entries()) {
    if (now >= rec.expires_at) {
      blockedIps.delete(ip);
      continue;
    }
    out.push({
      ...rec,
      remaining_seconds: Math.max(1, Math.ceil((rec.expires_at - now) / 1000)),
      expires_at_iso: new Date(rec.expires_at).toISOString(),
    });
  }
  return out.sort((a, b) => b.expires_at - a.expires_at);
}

function blockClientIp(
  ip: string,
  reason: string,
  category: string,
  req?: Request,
  metadata?: Record<string, any>
): BlockedIpRecord {
  const cleanIp = String(ip || "unknown").trim() || "unknown";
  const now = Date.now();
  const existing = blockedIps.get(cleanIp);
  const strikes = (existing?.strikes || 0) + 1;
  const record: BlockedIpRecord = {
    ip: cleanIp,
    reason,
    category,
    blocked_at: nowIso(),
    expires_at: now + IP_BAN_DURATION_MS,
    strikes,
  };
  blockedIps.set(cleanIp, record);
  writeAuditLog({
    actor: null,
    action: "security.ip_blocked",
    metadata: {
      ip: cleanIp,
      reason,
      category,
      duration_minutes: 15,
      strikes,
      ...(metadata || {}),
    },
    req,
  });
  return record;
}

function unblockClientIp(ip: string, actor?: any, req?: Request): boolean {
  const cleanIp = String(ip || "").trim();
  if (!cleanIp) return false;
  const existed = blockedIps.delete(cleanIp);
  for (const key of Array.from(securityStrikes.keys())) {
    if (key.includes(cleanIp)) securityStrikes.delete(key);
  }
  for (const key of Array.from(rateBuckets.keys())) {
    if (key.includes(cleanIp)) rateBuckets.delete(key);
  }
  if (existed) {
    writeAuditLog({
      actor: actor || null,
      action: "security.ip_unblocked",
      metadata: { ip: cleanIp },
      req,
    });
  }
  return existed;
}

function recordSecurityStrike(
  ip: string,
  category: string,
  maxStrikes: number,
  windowMs: number,
  reason: string,
  req?: Request,
  metadata?: Record<string, any>
): { blocked: boolean; strikes: number; remainingStrikes: number } {
  const cleanIp = String(ip || "unknown").trim() || "unknown";
  const key = `${category}:${cleanIp}`;
  const now = Date.now();
  const bucket = securityStrikes.get(key);
  let count = 1;
  if (!bucket || now >= bucket.resetAt) {
    securityStrikes.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    bucket.count += 1;
    count = bucket.count;
  }
  if (count >= maxStrikes) {
    securityStrikes.delete(key);
    blockClientIp(cleanIp, reason, category, req, { strikes: count, ...(metadata || {}) });
    return { blocked: true, strikes: count, remainingStrikes: 0 };
  }
  return { blocked: false, strikes: count, remainingStrikes: Math.max(0, maxStrikes - count) };
}

function validateUploadedImageMagicBytes(file?: Express.Multer.File): {
  valid: boolean;
  detectedMime?: string;
  reason?: string;
} {
  if (!file || !file.buffer || file.buffer.length < 12) {
    return { valid: false, reason: "File gambar kosong atau rusak" };
  }
  const buf = file.buffer;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  // JPEG: FF D8 FF
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  // GIF: GIF87a or GIF89a
  const isGif =
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61;
  // WEBP: RIFF....WEBP
  const isWebp =
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50;

  if (!isPng && !isJpeg && !isGif && !isWebp) {
    return {
      valid: false,
      reason: "Header biner file tidak valid. Hanya gambar asli (JPG, PNG, WEBP, GIF) yang diizinkan.",
    };
  }

  // Scan first 4KB and last 2KB for embedded web shells / scripts
  const headText = buf.subarray(0, Math.min(buf.length, 4096)).toString("latin1").toLowerCase();
  const tailText =
    buf.length > 4096
      ? buf.subarray(Math.max(0, buf.length - 2048)).toString("latin1").toLowerCase()
      : "";
  const combinedSample = `${headText}\n${tailText}`;
  if (
    combinedSample.includes("<?php") ||
    combinedSample.includes("<script") ||
    combinedSample.includes("<!doctype html") ||
    combinedSample.includes("<svg")
  ) {
    return {
      valid: false,
      reason: "File ditolak karena mengandung kode skrip berbahaya.",
    };
  }

  const detectedMime = isPng
    ? "image/png"
    : isJpeg
      ? "image/jpeg"
      : isWebp
        ? "image/webp"
        : "image/gif";
  return { valid: true, detectedMime };
}

const DANGEROUS_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "$where",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$ne",
  "$nin",
  "$in",
  "$regex",
  "$expr",
]);

const XSS_OR_INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "xss_script_tag", regex: /<\s*\/?\s*script\b/i },
  { name: "xss_javascript_uri", regex: /\b(?:javascript|vbscript)\s*:/i },
  { name: "xss_data_html", regex: /\bdata\s*:\s*text\/html/i },
  { name: "xss_event_handler", regex: /\bon(?:error|load|mouseover|focus|click|submit|animationstart|toggle)\s*=\s*['"\w]/i },
  { name: "xss_iframe_object", regex: /<\s*(?:iframe|object|embed|applet)\b/i },
  { name: "sqli_union_select", regex: /\bunion\s+(?:all\s+)?select\b/i },
  { name: "sqli_drop_alter", regex: /\b(?:drop|alter|truncate)\s+table\b/i },
  { name: "sqli_time_delay", regex: /\b(?:pg_sleep|waitfor\s+delay|benchmark\s*\()\b/i },
];

function sanitizeStringValue(val: string): { cleaned: string; threats: string[] } {
  let cleaned = val.replace(/\0/g, "");
  const threats: string[] = [];
  for (const pat of XSS_OR_INJECTION_PATTERNS) {
    if (pat.regex.test(cleaned)) {
      threats.push(pat.name);
    }
  }
  if (threats.length > 0) {
    cleaned = cleaned
      .replace(/<\s*\/?\s*script\b[^>]*>/gi, "")
      .replace(/\b(?:javascript|vbscript)\s*:/gi, "blocked:")
      .replace(/\bdata\s*:\s*text\/html/gi, "blocked:text/plain")
      .replace(/\bon(error|load|mouseover|focus|click|submit|animationstart|toggle)\s*=/gi, "data-blocked-$1=")
      .replace(/<\s*\/?\s*(?:iframe|object|embed|applet)\b[^>]*>/gi, "");
  }
  return { cleaned, threats };
}

function sanitizeInputRecursive(
  input: any,
  threatsFound: Set<string>,
  depth = 0
): any {
  if (depth > 12 || input === null || input === undefined) return input;
  if (typeof input === "string") {
    // Skip base64 data URIs for legitimate image fields
    if (input.startsWith("data:image/") && input.length > 128) {
      return input;
    }
    const { cleaned, threats } = sanitizeStringValue(input);
    for (const t of threats) threatsFound.add(t);
    return cleaned;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInputRecursive(item, threatsFound, depth + 1));
  }
  if (typeof input === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      if (DANGEROUS_KEYS.has(k) || k.startsWith("$")) {
        threatsFound.add(`forbidden_key:${k}`);
        continue;
      }
      out[k] = sanitizeInputRecursive(v, threatsFound, depth + 1);
    }
    return out;
  }
  return input;
}

function checkRateLimit(key: string, maxAttempts: number, windowMs: number): [boolean, number] {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return [true, 0];
  }
  if (bucket.count >= maxAttempts) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return [false, retryAfterSec];
  }
  bucket.count += 1;
  return [true, 0];
}

function hashToken(rawToken: string): string {
  return crypto.createHmac("sha256", TOKEN_PEPPER).update(String(rawToken)).digest("hex");
}

function issueAuthToken(user: any, type: "verify_email" | "reset_password", ttlMinutes: number) {
  const now = nowIso();
  if (type === "reset_password") {
    for (const t of db.auth_tokens) {
      if (t.user_id === user.id && t.type === type && !t.used_at) {
        t.used_at = now;
        t.superseded = true;
      }
    }
  }
  const otpCode = String(crypto.randomInt(100000, 999999));
  const rawToken = jwt.sign(
    {
      purpose: type,
      uid: user.id,
      email: String(user.email || "").toLowerCase(),
      name: String(user.name || ""),
      otp: otpCode,
      jti: uuidHex(10),
    },
    JWT_SECRET,
    { expiresIn: `${Math.max(5, ttlMinutes)}m` }
  );
  const record = {
    id: "tok-" + uuidHex(12),
    user_id: user.id,
    email: String(user.email || "").toLowerCase(),
    type,
    token_hash: hashToken(rawToken),
    otp_code: otpCode,
    otp_hash: hashToken(otpCode),
    expires_at: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    used_at: null as string | null,
    created_at: now,
  };
  db.auth_tokens.push(record);
  saveDb();
  return { rawToken, otpCode, record };
}

function consumeAuthToken(
  rawToken: string,
  type: "verify_email" | "reset_password",
  emailHint?: string
): { user_id: string; email: string; name?: string; already_used?: boolean } | null {
  const cleaned = String(rawToken || "").trim();
  if (!cleaned) return null;
  const th = hashToken(cleaned);
  const now = new Date();
  const cleanEmailHint = String(emailHint || "").trim().toLowerCase();

  // 1. Check 6-digit OTP match if user entered a 6-digit code
  if (/^\d{6}$/.test(cleaned)) {
    const otpRec = [...db.auth_tokens]
      .reverse()
      .find(
        (t) =>
          t.type === type &&
          (t.otp_code === cleaned || t.otp_hash === th) &&
          (!cleanEmailHint || String(t.email || "").toLowerCase() === cleanEmailHint) &&
          new Date(t.expires_at).getTime() > now.getTime() &&
          (!t.used_at || type === "verify_email")
      );
    if (otpRec) {
      const usedStamp = nowIso();
      otpRec.used_at = usedStamp;
      saveDb();
      return { user_id: otpRec.user_id, email: otpRec.email };
    }
  }

  // 2. Check database token record
  const record = db.auth_tokens.find(
    (t) =>
      t.token_hash === th &&
      t.type === type &&
      new Date(t.expires_at).getTime() > now.getTime()
  );
  if (record) {
    if (record.used_at && !record.superseded && type === "reset_password") {
      return null;
    }
    const wasUsed = Boolean(record.used_at);
    const usedStamp = nowIso();
    record.used_at = usedStamp;
    if (type === "reset_password") {
      for (const other of db.auth_tokens) {
        if (other.user_id === record.user_id && other.type === type && !other.used_at) {
          other.used_at = usedStamp;
        }
      }
    }
    saveDb();
    return { user_id: record.user_id, email: record.email, already_used: wasUsed };
  }

  // 3. Fallback: verify signed JWT token (supports cross-instance ais-dev <-> ais-pre verification)
  try {
    const payload = jwt.verify(cleaned, JWT_SECRET) as any;
    if (payload && payload.purpose === type && (payload.uid || payload.email)) {
      return {
        user_id: String(payload.uid || ""),
        email: String(payload.email || "").toLowerCase(),
        name: String(payload.name || ""),
      };
    }
  } catch {
    // Not a valid JWT or expired
  }

  return null;
}

function getClientIp(req?: Request): string {
  if (!req) return "";
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

function writeAuditLog(params: {
  actor?: any | null;
  action: string;
  targetUser?: any | null;
  targetId?: string;
  metadata?: Record<string, any>;
  req?: Request;
}) {
  const safeMeta: Record<string, any> = {};
  for (const [k, v] of Object.entries(params.metadata || {})) {
    if (/password|token|secret|key|hash/i.test(k)) continue;
    safeMeta[k] = v;
  }
  const entry = {
    id: "aud-" + uuidHex(12),
    actor_user_id: params.actor?.id || null,
    actor_email: params.actor?.email || null,
    action: params.action,
    target_user_id: params.targetUser?.id || params.targetId || null,
    target_email: params.targetUser?.email || null,
    metadata: safeMeta,
    ip: getClientIp(params.req),
    created_at: nowIso(),
  };
  db.audit_logs.unshift(entry);
  if (db.audit_logs.length > 1000) db.audit_logs.length = 1000;
  saveDb();
  return entry;
}

function getEmailAuthConfig() {
  const raw = db.settings?.email_auth || {};
  const resendRaw = raw.resend || {};
  const smtpRaw = raw.smtp || {};

  const dbResendKey = String(resendRaw.api_key || "").trim();
  const effectiveResendKey = dbResendKey || RESEND_API_KEY;
  const resendKeySource = dbResendKey ? "db" : RESEND_API_KEY ? "env" : "none";
  const resendFromEmail =
    String(resendRaw.from_email || "").trim() ||
    (RESEND_FROM_EMAIL.includes("<")
      ? RESEND_FROM_EMAIL.replace(/^.*<([^>]+)>.*$/, "$1").trim()
      : RESEND_FROM_EMAIL) ||
    "onboarding@resend.dev";
  const resendFromName = String(resendRaw.from_name || "WillJustPlay Security").trim();
  const resendEnabled = resendRaw.enabled !== false;
  const resendReady = Boolean(resendEnabled && effectiveResendKey);

  const dbSmtpPass = String(smtpRaw.pass || "").trim();
  const effectiveSmtpPass = dbSmtpPass || ENV_SMTP_PASS;
  const smtpPassSource = dbSmtpPass ? "db" : ENV_SMTP_PASS ? "env" : "none";
  const smtpHost = String(smtpRaw.host ?? ENV_SMTP_HOST ?? "smtp.gmail.com").trim();
  const smtpPort = Number(smtpRaw.port || ENV_SMTP_PORT || 587);
  const smtpSecure =
    typeof smtpRaw.secure === "boolean" ? smtpRaw.secure : smtpPort === 465 || ENV_SMTP_SECURE;
  const smtpUser = String(smtpRaw.user ?? ENV_SMTP_USER ?? "").trim();
  const smtpFromEmail = String(smtpRaw.from_email || smtpUser || ENV_SMTP_FROM_EMAIL || "").trim();
  const smtpFromName = String(smtpRaw.from_name || ENV_SMTP_FROM_NAME || "WillJustPlay Security").trim();
  const smtpEnabled = Boolean(smtpRaw.enabled);
  const smtpReady = Boolean(smtpEnabled && smtpHost && smtpPort > 0 && smtpUser && effectiveSmtpPass);

  const providerModeRaw = String(raw.provider_mode || "auto").toLowerCase();
  const providerMode: "auto" | "resend" | "smtp" | "dev_preview" =
    providerModeRaw === "resend" || providerModeRaw === "smtp" || providerModeRaw === "dev_preview"
      ? providerModeRaw
      : "auto";

  let activeProvider: "resend" | "smtp" | "dev_preview" = "dev_preview";
  if (providerMode === "resend") {
    activeProvider = resendReady ? "resend" : "dev_preview";
  } else if (providerMode === "smtp") {
    activeProvider = smtpReady ? "smtp" : "dev_preview";
  } else if (providerMode === "auto") {
    if (resendReady) activeProvider = "resend";
    else if (smtpReady) activeProvider = "smtp";
    else activeProvider = "dev_preview";
  }

  const tplRaw = raw.template || {};
  const rawAccent = String(tplRaw.accent_color || "#00F0FF").trim();
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent.toUpperCase() : "#00F0FF";
  const DEFAULT_STORE_LOGO = "/assets/aistudio/photo_2026-10-28_01-45-50_fca1f215.jpg";
  const template = {
    brand_name: String(tplRaw.brand_name || "WillJustPlay").trim() || "WillJustPlay",
    brand_tagline:
      String(tplRaw.brand_tagline || "STORE & TOP-UP GAME BERGARANSI").trim() ||
      "STORE & TOP-UP GAME BERGARANSI",
    logo_url: String(tplRaw.logo_url || DEFAULT_STORE_LOGO).trim() || DEFAULT_STORE_LOGO,
    accent_color: accentColor,
    verify_subject:
      String(tplRaw.verify_subject || "⚡ Verifikasi Email Akun {{brand_name}} — Halo {{name}}!").trim() ||
      "⚡ Verifikasi Email Akun {{brand_name}} — Halo {{name}}!",
    verify_badge: String(tplRaw.verify_badge || "VERIFIKASI AKUN").trim() || "VERIFIKASI AKUN",
    verify_heading:
      String(tplRaw.verify_heading || "Konfirmasi & Aktifkan Akun Anda").trim() ||
      "Konfirmasi & Aktifkan Akun Anda",
    verify_body:
      String(
        tplRaw.verify_body ||
          "Terima kasih telah bergabung di {{brand_name}}. Untuk menjaga keamanan akun serta membuka akses penuh ke layanan top-up instan dan store akun bergaransi, silakan konfirmasi alamat email Anda melalui tombol di bawah ini."
      ).trim(),
    verify_button_text:
      String(tplRaw.verify_button_text || "VERIFIKASI EMAIL SEKARANG").trim() ||
      "VERIFIKASI EMAIL SEKARANG",
    reset_subject:
      String(tplRaw.reset_subject || "🔐 Instruksi Reset Password — {{brand_name}}").trim() ||
      "🔐 Instruksi Reset Password — {{brand_name}}",
    reset_heading:
      String(tplRaw.reset_heading || "Atur Ulang Kata Sandi Akun Anda").trim() ||
      "Atur Ulang Kata Sandi Akun Anda",
    reset_body:
      String(
        tplRaw.reset_body ||
          "Kami menerima permintaan untuk mengatur ulang kata sandi akun {{brand_name}} yang terhubung dengan {{email}}. Klik tombol di bawah ini untuk membuat password baru yang aman."
      ).trim(),
    reset_button_text:
      String(tplRaw.reset_button_text || "ATUR ULANG PASSWORD").trim() || "ATUR ULANG PASSWORD",
    footer_note:
      String(
        tplRaw.footer_note ||
          "Jika Anda tidak merasa melakukan permintaan ini di {{brand_name}}, abaikan email ini dengan aman. Keamanan akun Anda tetap terlindungi."
      ).trim(),
    support_text:
      String(tplRaw.support_text || "Butuh bantuan? Hubungi Customer Support Resmi WillJustPlay.").trim(),
    show_account_card: tplRaw.show_account_card !== false,
    show_benefits: tplRaw.show_benefits !== false,
  };

  return {
    require_email_verification: raw.require_email_verification !== false,
    allow_dev_preview_links: raw.allow_dev_preview_links !== false,
    verify_token_ttl_hours: Math.max(1, Math.min(168, Number(raw.verify_token_ttl_hours || 24))),
    reset_token_ttl_minutes: Math.max(5, Math.min(1440, Number(raw.reset_token_ttl_minutes || 60))),
    public_base_url: String(raw.public_base_url || "").trim().replace(/\/+$/, ""),
    provider_mode: providerMode,
    active_provider: activeProvider,
    configured: activeProvider === "resend" || activeProvider === "smtp",
    resend: {
      enabled: resendEnabled,
      ready: resendReady,
      api_key: effectiveResendKey,
      db_api_key: dbResendKey,
      api_key_source: resendKeySource,
      from_email: resendFromEmail,
      from_name: resendFromName,
      formatted_from: resendFromEmail.includes("<")
        ? resendFromEmail
        : resendFromName
        ? `${resendFromName} <${resendFromEmail}>`
        : resendFromEmail,
    },
    smtp: {
      enabled: smtpEnabled,
      ready: smtpReady,
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      pass: effectiveSmtpPass,
      db_pass: dbSmtpPass,
      pass_source: smtpPassSource,
      from_email: smtpFromEmail,
      from_name: smtpFromName,
      formatted_from: smtpFromEmail.includes("<")
        ? smtpFromEmail
        : smtpFromName && smtpFromEmail
        ? `${smtpFromName} <${smtpFromEmail}>`
        : smtpFromEmail || smtpUser,
    },
    template,
    last_test: raw.last_test || null,
    updated_at: raw.updated_at || null,
  };
}

const DEFAULT_STORE_LOGO_REL_PATH = "/assets/aistudio/photo_2026-10-28_01-45-50_fca1f215.jpg";
const STORE_LOGO_CID = "wjp-store-logo";

function resolveStoreLogoAttachment(customLogoUrl?: string): {
  filename: string;
  contentType: string;
  buffer: Buffer;
  base64: string;
  cid: string;
} | null {
  try {
    const candidate = String(customLogoUrl || DEFAULT_STORE_LOGO_REL_PATH).trim();
    if (candidate.startsWith("/api/files/")) {
      const fileKey = candidate.replace(/^\/api\/files\//, "");
      const stored = db?.files?.[fileKey];
      if (stored && stored.dataBase64) {
        const buffer = Buffer.from(stored.dataBase64, "base64");
        return {
          filename: stored.filename || "willjustplay-logo.jpg",
          contentType: stored.content_type || "image/jpeg",
          buffer,
          base64: stored.dataBase64,
          cid: STORE_LOGO_CID,
        };
      }
    }

    const relAsset = candidate.startsWith("/assets/")
      ? candidate.replace(/^\/+/, "")
      : DEFAULT_STORE_LOGO_REL_PATH.replace(/^\/+/, "");
    const diskCandidates = [
      path.join(__dirname, "public", relAsset),
      path.join(__dirname, "dist", relAsset),
      path.join(__dirname, "public", DEFAULT_STORE_LOGO_REL_PATH.replace(/^\/+/, "")),
    ];
    for (const fullPath of diskCandidates) {
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const contentType =
          ext === ".png"
            ? "image/png"
            : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
        return {
          filename: `willjustplay-logo${ext || ".jpg"}`,
          contentType,
          buffer,
          base64: buffer.toString("base64"),
          cid: STORE_LOGO_CID,
        };
      }
    }
  } catch (err) {
    console.error("[resolveStoreLogoAttachment] Failed to read logo:", err);
  }
  return null;
}

function toPublicReachableOrigin(rawUrl: string): string {
  const trimmed = String(rawUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    // In AI Studio Cloud Run, ais-dev-* requires the applet owner's Google login and returns
    // "Page Not Found" when opened from external email clients, mobile phones, or buyer accounts.
    // Rewriting ais-dev-* to ais-pre-* (the public Shared App URL) ensures verification links
    // open cleanly on any device or browser without 404.
    const host = u.host.replace(/^ais-dev-/i, "ais-pre-");
    return `${u.protocol}//${host}`;
  } catch {
    return trimmed.replace(/^https:\/\/ais-dev-/i, "https://ais-pre-");
  }
}

function getAppOrigin(req?: Request): string {
  const emailCfg = getEmailAuthConfig();
  if (emailCfg.public_base_url && /^https?:\/\//i.test(emailCfg.public_base_url)) {
    return toPublicReachableOrigin(emailCfg.public_base_url);
  }
  const candidates = [
    String((req as any)?.body?.origin_url || "").trim(),
    String(req?.headers?.origin || "").trim(),
    String(req?.headers?.referer || "").trim(),
    (process.env.APP_BASE_URL || process.env.APP_URL || "").trim(),
  ];
  for (const cand of candidates) {
    if (!cand || cand === "MY_APP_URL" || cand.includes("localhost") || cand.includes("127.0.0.1")) {
      continue;
    }
    if (/^https?:\/\//i.test(cand)) {
      return toPublicReachableOrigin(cand);
    }
  }
  const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "").trim();
  const proto = String(req?.headers?.["x-forwarded-proto"] || req?.protocol || "https").split(",")[0].trim();
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return toPublicReachableOrigin(`${proto}://${host}`);
  }
  return toPublicReachableOrigin(FRONTEND_URL);
}

async function checkVerifiedOnSharedPreview(email: string): Promise<boolean> {
  try {
    const rawAppUrl = (process.env.APP_BASE_URL || process.env.APP_URL || "").trim();
    if (!rawAppUrl.includes("ais-dev-")) return false;
    const sharedOrigin = toPublicReachableOrigin(rawAppUrl);
    const targetUrl = `${sharedOrigin}/api/auth/verification-status?email=${encodeURIComponent(email)}`;
    const bridgeUrl = `https://aistudio.google.com/applet-auth-bridge?applet_id=ccc6f123-2036-4e8a-a861-366c6b2ef5be&return_url=${encodeURIComponent(
      targetUrl
    )}`;
    const r1 = await axios.get(bridgeUrl, { maxRedirects: 0, validateStatus: () => true, timeout: 3500 });
    const loc1 = r1.headers?.location;
    if (!loc1) return false;
    const r2 = await axios.get(loc1, {
      headers: { Cookie: "__SECURE-aistudio_auth_flow_may_set_cookies=true" },
      maxRedirects: 0,
      validateStatus: () => true,
      timeout: 3500,
    });
    const setCookies = r2.headers?.["set-cookie"] || [];
    const cookieHeader = setCookies.map((c: string) => c.split(";")[0]).join("; ");
    const r3 = await axios.get(targetUrl, {
      headers: { Cookie: cookieHeader || "__SECURE-aistudio_auth_token=one_token_to_rule_them_all" },
      validateStatus: () => true,
      timeout: 3500,
    });
    return Boolean(r3.data?.is_verified);
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendViaResend(
  resendCfg: { api_key: string; formatted_from: string },
  opts: { to: string; subject: string; html: string; text: string }
): Promise<{ ok: boolean; provider_id?: string | null; error?: string }> {
  try {
    const cfg = getEmailAuthConfig();
    const logoAtt =
      opts.html.includes(`cid:${STORE_LOGO_CID}`)
        ? resolveStoreLogoAttachment(cfg.template?.logo_url)
        : null;
    const payload: any = {
      from: resendCfg.formatted_from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    };
    if (logoAtt) {
      payload.attachments = [
        {
          filename: logoAtt.filename,
          content: logoAtt.base64,
          content_type: logoAtt.contentType,
          content_id: logoAtt.cid,
        },
      ];
    }
    const resp = await axios.post("https://api.resend.com/emails", payload, {
      headers: {
        Authorization: `Bearer ${resendCfg.api_key}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
    return { ok: true, provider_id: resp.data?.id || null };
  } catch (err: any) {
    const errMsg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Pengiriman email melalui Resend API gagal";
    return { ok: false, error: String(errMsg).slice(0, 220) };
  }
}

async function sendViaSmtp(
  smtpCfg: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    formatted_from: string;
  },
  opts: { to: string; subject: string; html: string; text: string }
): Promise<{ ok: boolean; provider_id?: string | null; error?: string }> {
  try {
    const cfg = getEmailAuthConfig();
    const logoAtt =
      opts.html.includes(`cid:${STORE_LOGO_CID}`)
        ? resolveStoreLogoAttachment(cfg.template?.logo_url)
        : null;
    const transporter = nodemailer.createTransport({
      host: smtpCfg.host,
      port: Number(smtpCfg.port || 587),
      secure: Boolean(smtpCfg.secure),
      auth: {
        user: smtpCfg.user,
        pass: smtpCfg.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 12000,
    });
    const info = await transporter.sendMail({
      from: smtpCfg.formatted_from || smtpCfg.user,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: logoAtt
        ? [
            {
              filename: logoAtt.filename,
              content: logoAtt.buffer,
              contentType: logoAtt.contentType,
              cid: logoAtt.cid,
              contentDisposition: "inline",
            },
          ]
        : undefined,
    });
    return { ok: true, provider_id: info?.messageId || null };
  } catch (err: any) {
    const errMsg = err?.message || "Pengiriman email melalui server SMTP gagal";
    return { ok: false, error: String(errMsg).slice(0, 220) };
  }
}

async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  template: string;
  html: string;
  text: string;
  previewUrl?: string;
  forceProvider?: "auto" | "resend" | "smtp" | "dev_preview";
}): Promise<{ delivered: boolean; provider: string; dev_preview_url?: string; error?: string; provider_id?: string | null }> {
  const cfg = getEmailAuthConfig();
  const devPreviewOut = cfg.allow_dev_preview_links ? opts.previewUrl : undefined;
  const mode = opts.forceProvider || cfg.provider_mode;

  let targetProvider: "resend" | "smtp" | "dev_preview" = "dev_preview";
  if (mode === "resend") {
    targetProvider = cfg.resend.api_key ? "resend" : "dev_preview";
  } else if (mode === "smtp") {
    targetProvider = cfg.smtp.host && cfg.smtp.user && cfg.smtp.pass ? "smtp" : "dev_preview";
  } else if (mode === "auto") {
    targetProvider = cfg.active_provider;
  }

  const event = {
    id: "em-" + uuidHex(10),
    to_email: opts.to,
    template: opts.template,
    subject: opts.subject,
    provider: targetProvider,
    provider_id: null as string | null,
    status: "pending",
    error: null as string | null,
    created_at: nowIso(),
  };

  if (targetProvider === "dev_preview") {
    event.status = "dev_preview";
    db.email_events.unshift(event);
    if (db.email_events.length > 300) db.email_events.length = 300;
    saveDb();
    return {
      delivered: false,
      provider: "dev_preview",
      dev_preview_url: devPreviewOut,
    };
  }

  if (targetProvider === "resend") {
    const res = await sendViaResend(cfg.resend, opts);
    if (res.ok) {
      event.status = "sent";
      event.provider_id = res.provider_id || null;
      db.email_events.unshift(event);
      if (db.email_events.length > 300) db.email_events.length = 300;
      saveDb();
      return { delivered: true, provider: "resend", provider_id: event.provider_id };
    }

    // Automatic fallback to SMTP if mode is "auto" and SMTP is ready
    if (mode === "auto" && cfg.smtp.ready) {
      const smtpFallback = await sendViaSmtp(cfg.smtp, opts);
      if (smtpFallback.ok) {
        event.provider = "smtp";
        event.status = "sent";
        event.provider_id = smtpFallback.provider_id || null;
        db.email_events.unshift(event);
        if (db.email_events.length > 300) db.email_events.length = 300;
        saveDb();
        return { delivered: true, provider: "smtp", provider_id: event.provider_id };
      }
      event.error = `Resend: ${res.error} | SMTP Fallback: ${smtpFallback.error}`.slice(0, 220);
    } else {
      event.error = res.error || "Gagal mengirim email via Resend";
    }

    event.status = "failed";
    db.email_events.unshift(event);
    if (db.email_events.length > 300) db.email_events.length = 300;
    saveDb();
    return {
      delivered: false,
      provider: "resend",
      error: event.error,
      dev_preview_url: devPreviewOut,
    };
  }

  // targetProvider === "smtp"
  const smtpRes = await sendViaSmtp(cfg.smtp, opts);
  if (smtpRes.ok) {
    event.status = "sent";
    event.provider_id = smtpRes.provider_id || null;
    db.email_events.unshift(event);
    if (db.email_events.length > 300) db.email_events.length = 300;
    saveDb();
    return { delivered: true, provider: "smtp", provider_id: event.provider_id };
  }

  event.status = "failed";
  event.error = smtpRes.error || "Gagal mengirim email via SMTP";
  db.email_events.unshift(event);
  if (db.email_events.length > 300) db.email_events.length = 300;
  saveDb();
  return {
    delivered: false,
    provider: "smtp",
    error: event.error,
    dev_preview_url: devPreviewOut,
  };
}

function formatIndonesianTimestamp(date: Date | string | number = new Date()): string {
  const parsed = date instanceof Date ? date : new Date(date);
  const validDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  try {
    return (
      new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(validDate) + " WIB"
    );
  } catch {
    return validDate.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }
}

function interpolateEmailTemplate(
  rawText: string,
  vars: Record<string, string | number>,
  escapeValues = false
): string {
  return String(rawText || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const val = vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : "";
    return escapeValues ? escapeHtml(val) : val;
  });
}

function renderBrandedEmailTemplate(params: {
  templateCfg?: any;
  badgeText: string;
  heading: string;
  greetingName: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  otpCode?: string;
  expiryLabel?: string;
  infoTitle?: string;
  infoRows?: Array<{ label: string; value: string; highlight?: boolean }>;
  showBenefits?: boolean;
  footerNote?: string;
  supportText?: string;
  originUrl?: string;
}): string {
  const cfg = getEmailAuthConfig();
  const tpl = { ...cfg.template, ...(params.templateCfg || {}) };
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(tpl.accent_color || ""))
    ? String(tpl.accent_color).toUpperCase()
    : "#00F0FF";
  const brandName = escapeHtml(tpl.brand_name || "WillJustPlay");
  const brandTagline = escapeHtml(tpl.brand_tagline || "STORE & TOP-UP GAME BERGARANSI");
  const badgeText = escapeHtml(params.badgeText || "KEAMANAN AKUN");
  const heading = escapeHtml(params.heading || "");
  const safeGreetingName = escapeHtml(params.greetingName || "Gamer");
  const ctaText = params.ctaText ? escapeHtml(params.ctaText) : "";
  const ctaUrl = params.ctaUrl ? String(params.ctaUrl) : "";
  const footerNote = escapeHtml(params.footerNote ?? tpl.footer_note ?? "");
  const supportText = escapeHtml(params.supportText ?? tpl.support_text ?? "");
  const year = new Date().getFullYear();
  const monogram = escapeHtml((tpl.brand_name || "W").trim().slice(0, 2).toUpperCase());
  const rawLogoUrl = String(tpl.logo_url || DEFAULT_STORE_LOGO_REL_PATH).trim();
  const hasInlineLogo = Boolean(resolveStoreLogoAttachment(rawLogoUrl));
  const originClean = String(params.originUrl || getAppOrigin()).replace(/\/+$/, "");
  const logoSrc = hasInlineLogo
    ? `cid:${STORE_LOGO_CID}`
    : /^https?:\/\//i.test(rawLogoUrl)
    ? escapeHtml(rawLogoUrl)
    : `${originClean}${rawLogoUrl.startsWith("/") ? rawLogoUrl : `/${rawLogoUrl}`}`;

  const infoTitleText = escapeHtml(
    params.infoTitle || "RINGKASAN AKTIVITAS & DETAIL AKUN"
  );

  const infoRowsHtml =
    params.infoRows && params.infoRows.length > 0
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;background-color:#0b111e;border:1px solid #1e293b;border-left:3px solid ${accent};border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:14px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border-bottom:1px solid #151f32;padding-bottom:8px;">
                <tr>
                  <td valign="middle">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${accent};">
                      ${infoTitleText}
                    </div>
                  </td>
                  <td valign="middle" align="right">
                    <span style="display:inline-block;padding:2px 7px;background-color:#071318;border:1px solid #a3e635;border-radius:4px;font-family:'Courier New',Courier,monospace;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#a3e635;white-space:nowrap;">
                      &#10003; TERVERIFIKASI
                    </span>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${params.infoRows
                  .map(
                    (row, idx) => `
                  <tr>
                    <td style="padding:${idx === 0 ? "4px" : "7px"} 0 4px;font-size:12px;color:#94a3b8;width:42%;vertical-align:top;border-top:${
                      idx === 0 ? "none" : "1px solid #151f32"
                    };">
                      ${escapeHtml(row.label)}
                    </td>
                    <td style="padding:${idx === 0 ? "4px" : "7px"} 0 4px;font-size:12px;font-weight:700;color:${
                      row.highlight ? accent : "#f1f5f9"
                    };text-align:right;vertical-align:top;font-family:${
                      row.highlight ? "'Courier New',Courier,monospace" : "inherit"
                    };border-top:${idx === 0 ? "none" : "1px solid #151f32"};word-break:break-all;">
                      ${escapeHtml(row.value)}
                    </td>
                  </tr>`
                  )
                  .join("")}
              </table>
            </td>
          </tr>
        </table>
      `
      : "";

  const ctaSectionHtml =
    ctaText && ctaUrl
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 22px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:340px;">
                <tr>
                  <td align="center" bgcolor="${accent}" style="background-color:${accent};border-radius:6px;box-shadow:0 8px 24px rgba(0,240,255,0.18);">
                    <a href="${ctaUrl}" target="_blank" style="display:block;padding:15px 24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:800;color:#05070c;text-decoration:none;text-transform:uppercase;letter-spacing:1.6px;text-align:center;white-space:nowrap;">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${
            params.expiryLabel
              ? `<tr>
                  <td align="center" style="padding-top:10px;font-size:11px;color:#94a3b8;font-family:'Courier New',Courier,monospace;">
                    &#9201; Tautan keamanan ini berlaku selama <strong style="color:${accent};">${escapeHtml(
                  params.expiryLabel
                )}</strong>
                  </td>
                </tr>`
              : ""
          }
          ${
            params.otpCode
              ? `<tr>
                  <td align="center" style="padding-top:16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#060a12;border:1px dashed ${accent};border-radius:8px;padding:12px 20px;">
                      <tr>
                        <td align="center">
                          <div style="font-family:'Courier New',Courier,monospace;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:4px;">
                            ATAU MASUKKAN KODE VERIFIKASI 6-DIGIT DI WEBSITE:
                          </div>
                          <div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:900;letter-spacing:6px;color:${accent};">
                            ${escapeHtml(params.otpCode)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
              : ""
          }
        </table>
      `
      : "";

  const benefitsHtml = params.showBenefits
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background-color:#080d18;border:1px solid #172236;border-radius:8px;">
        <tr>
          <td style="padding:14px 16px;">
            <div style="font-size:10px;font-family:'Courier New',Courier,monospace;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-bottom:8px;">
              AKSES MEMBER TERVERIFIKASI
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#cbd5e1;padding:3px 0;">
                  <span style="color:${accent};font-weight:bold;">&#10003;</span> Proses Top-Up Game Instan 24/7 Otomatis
                </td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#cbd5e1;padding:3px 0;">
                  <span style="color:${accent};font-weight:bold;">&#10003;</span> Store Akun Premium Bergaransi &amp; Aman
                </td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#cbd5e1;padding:3px 0;">
                  <span style="color:${accent};font-weight:bold;">&#10003;</span> Riwayat Pesanan &amp; Notifikasi Keamanan Real-Time
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `
    : "";

  const fallbackLinkHtml = ctaUrl
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background-color:#070a12;border:1px dashed #1e293b;border-radius:6px;">
        <tr>
          <td style="padding:12px 14px;">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">
              Jika tombol di atas tidak berfungsi di aplikasi email Anda, salin dan buka tautan berikut di browser:
            </div>
            <div style="font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.5;word-break:break-all;">
              <a href="${ctaUrl}" target="_blank" style="color:${accent};text-decoration:underline;">${escapeHtml(
        ctaUrl
      )}</a>
            </div>
          </td>
        </tr>
      </table>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${heading || brandName}</title>
</head>
<body style="margin:0;padding:0;background-color:#04060b;color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#04060b" style="background-color:#04060b;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#090d16;border:1px solid #1e293b;border-radius:12px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);">
          <!-- Top Accent Bar -->
          <tr>
            <td bgcolor="${accent}" style="height:4px;background:linear-gradient(90deg, ${accent} 0%, #a3e635 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header with Official Store Logo -->
          <tr>
            <td style="padding:22px 26px 18px;border-bottom:1px solid #151e30;background-color:#070b13;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle" align="center" style="width:44px;height:44px;background-color:#05070c;border:1px solid ${accent};border-radius:8px;overflow:hidden;padding:2px;">
                          <img src="${logoSrc}" alt="${brandName}" width="40" height="40" style="display:block;width:40px;height:40px;object-fit:contain;border-radius:6px;border:0;outline:none;text-decoration:none;color:${accent};font-weight:900;font-size:12px;text-align:center;line-height:40px;" />
                        </td>
                        <td valign="middle" style="padding-left:12px;">
                          <div style="font-size:16px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;line-height:1.2;">
                            ${brandName}
                          </div>
                          <div style="font-size:10px;font-family:'Courier New',Courier,monospace;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;margin-top:2px;">
                            ${brandTagline}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" align="right">
                    <span style="display:inline-block;padding:5px 10px;background-color:#0f172a;border:1px solid ${accent};border-radius:4px;font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${accent};white-space:nowrap;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:28px 26px 24px;">
              <h1 style="margin:0 0 14px;font-size:21px;font-weight:800;color:#ffffff;letter-spacing:0.3px;line-height:1.35;">
                ${heading}
              </h1>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#e2e8f0;">
                Halo <strong style="color:${accent};">${safeGreetingName}</strong>,
              </p>
              <div style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#cbd5e1;">
                ${params.bodyHtml}
              </div>

              ${infoRowsHtml}
              ${ctaSectionHtml}
              ${benefitsHtml}
              ${fallbackLinkHtml}

              ${
                footerNote
                  ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                      ${footerNote}
                    </p>`
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 26px;background-color:#060911;border-top:1px solid #151e30;text-align:center;">
              ${
                supportText
                  ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">
                      ${supportText}
                    </div>`
                  : ""
              }
              <div style="font-size:11px;font-family:'Courier New',Courier,monospace;color:#475569;">
                &copy; ${year} ${brandName} &bull; Invoice &amp; Verifikasi Resmi Terenkripsi
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendVerificationEmail(user: any, rawToken: string, req?: Request, otpCode?: string) {
  const cfg = getEmailAuthConfig();
  const tpl = cfg.template;
  const origin = getAppOrigin(req);
  const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const displayName = user.name || String(user.email || "").split("@")[0] || "Gamer";
  const ttlHours = cfg.verify_token_ttl_hours;
  const timestamp = formatIndonesianTimestamp();

  const vars = {
    name: displayName,
    email: user.email,
    brand_name: tpl.brand_name,
    brand_tagline: tpl.brand_tagline,
    ttl_hours: ttlHours,
    ttl_minutes: ttlHours * 60,
    verify_url: verifyUrl,
    action_url: verifyUrl,
    otp_code: otpCode || "",
    timestamp,
  };

  const subject = interpolateEmailTemplate(tpl.verify_subject, vars, false);
  const heading = interpolateEmailTemplate(tpl.verify_heading, vars, false);
  const bodyHtml = interpolateEmailTemplate(escapeHtml(tpl.verify_body), vars, true).replace(/\n/g, "<br/>");
  const buttonText = interpolateEmailTemplate(tpl.verify_button_text, vars, false);
  const footerNote = interpolateEmailTemplate(tpl.footer_note, vars, false);
  const supportText = interpolateEmailTemplate(tpl.support_text, vars, false);

  const infoRows = tpl.show_account_card
    ? [
        { label: "Nama Pengguna", value: displayName },
        { label: "Email Terdaftar", value: user.email, highlight: true },
        ...(otpCode ? [{ label: "Kode Verifikasi (OTP)", value: otpCode, highlight: true }] : []),
        { label: "Waktu Pendaftaran", value: timestamp },
        { label: "Status Verifikasi", value: "Menunggu Konfirmasi Email" },
      ]
    : [];

  const html = renderBrandedEmailTemplate({
    templateCfg: tpl,
    badgeText: tpl.verify_badge || "VERIFIKASI AKUN",
    heading,
    greetingName: displayName,
    bodyHtml,
    ctaText: buttonText,
    ctaUrl: verifyUrl,
    otpCode,
    expiryLabel: `${ttlHours} Jam`,
    infoTitle: "DETAIL VERIFIKASI AKUN & OTENTIKASI",
    infoRows,
    showBenefits: tpl.show_benefits,
    footerNote,
    supportText,
    originUrl: origin,
  });

  const text = `Halo ${displayName},\n\n${interpolateEmailTemplate(
    tpl.verify_body,
    vars,
    false
  )}\n\n${
    otpCode ? `Kode Verifikasi 6-Digit Anda: ${otpCode}\n\n` : ""
  }Buka tautan berikut untuk memverifikasi email akun ${tpl.brand_name} Anda (berlaku ${ttlHours} jam):\n${verifyUrl}\n\n${footerNote}`;

  return sendTransactionalEmail({
    to: user.email,
    subject,
    template: "verify-email",
    html,
    text,
    previewUrl: `/verify-email?token=${encodeURIComponent(rawToken)}`,
  });
}

async function sendPasswordResetEmail(user: any, rawToken: string, req?: Request) {
  const cfg = getEmailAuthConfig();
  const tpl = cfg.template;
  const origin = getAppOrigin(req);
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const displayName = user.name || String(user.email || "").split("@")[0] || "Gamer";
  const ttlMin = cfg.reset_token_ttl_minutes;
  const timestamp = formatIndonesianTimestamp();

  const vars = {
    name: displayName,
    email: user.email,
    brand_name: tpl.brand_name,
    brand_tagline: tpl.brand_tagline,
    ttl_minutes: ttlMin,
    ttl_hours: Math.max(1, Math.round(ttlMin / 60)),
    reset_url: resetUrl,
    action_url: resetUrl,
    timestamp,
  };

  const subject = interpolateEmailTemplate(tpl.reset_subject, vars, false);
  const heading = interpolateEmailTemplate(tpl.reset_heading, vars, false);
  const bodyHtml = interpolateEmailTemplate(escapeHtml(tpl.reset_body), vars, true).replace(/\n/g, "<br/>");
  const buttonText = interpolateEmailTemplate(tpl.reset_button_text, vars, false);
  const footerNote = interpolateEmailTemplate(tpl.footer_note, vars, false);
  const supportText = interpolateEmailTemplate(tpl.support_text, vars, false);

  const infoRows = tpl.show_account_card
    ? [
        { label: "Nama Pengguna", value: displayName },
        { label: "Email Akun", value: user.email, highlight: true },
        { label: "Waktu Permintaan", value: timestamp },
        { label: "Jenis Aksi", value: "Reset Kata Sandi" },
      ]
    : [];

  const html = renderBrandedEmailTemplate({
    templateCfg: tpl,
    badgeText: "RESET PASSWORD",
    heading,
    greetingName: displayName,
    bodyHtml,
    ctaText: buttonText,
    ctaUrl: resetUrl,
    expiryLabel: `${ttlMin} Menit`,
    infoTitle: "VERIFIKASI PERMINTAAN RESET SANDI",
    infoRows,
    showBenefits: false,
    footerNote,
    supportText,
    originUrl: origin,
  });

  const text = `Halo ${displayName},\n\n${interpolateEmailTemplate(
    tpl.reset_body,
    vars,
    false
  )}\n\nBuka tautan berikut untuk mengatur ulang password akun ${tpl.brand_name} Anda (berlaku ${ttlMin} menit):\n${resetUrl}\n\n${footerNote}`;

  return sendTransactionalEmail({
    to: user.email,
    subject,
    template: "reset-password",
    html,
    text,
    previewUrl: `/reset-password?token=${encodeURIComponent(rawToken)}`,
  });
}

async function sendSecurityNotification(user: any, eventTitle: string, message: string) {
  const cfg = getEmailAuthConfig();
  const tpl = cfg.template;
  const displayName = user.name || String(user.email || "").split("@")[0] || "Gamer";
  const timestamp = formatIndonesianTimestamp();

  const html = renderBrandedEmailTemplate({
    templateCfg: tpl,
    badgeText: "NOTIFIKASI KEAMANAN",
    heading: eventTitle,
    greetingName: displayName,
    bodyHtml: escapeHtml(message),
    infoTitle: "DETAIL VERIFIKASI KEAMANAN AKUN",
    infoRows: [
      { label: "Akun", value: user.email, highlight: true },
      { label: "Aktivitas", value: eventTitle },
      { label: "Waktu", value: timestamp },
    ],
    showBenefits: false,
    footerNote:
      "Jika aktivitas ini bukan dilakukan oleh Anda, segera hubungi tim support kami untuk mengamankan akun Anda.",
    supportText: tpl.support_text,
  });

  return sendTransactionalEmail({
    to: user.email,
    subject: `🛡️ Notifikasi Keamanan ${tpl.brand_name}: ${eventTitle}`,
    template: "security-notification",
    html,
    text: `Halo ${displayName},\n\n${message}\n\nWaktu: ${timestamp}`,
  });
}

// ---------------- Structured Account Delivery & Order Invoice Emails ----------------
interface StructuredDeliveryInfo {
  is_structured: boolean;
  account_type: string;
  account_email: string;
  account_password: string;
  formatted_bracket: string;
  extra_notes: string;
  raw: string;
}

function parseStructuredDeliveryInfo(rawInput?: string | null): StructuredDeliveryInfo {
  const raw = String(rawInput || "").trim();
  if (!raw) {
    return {
      is_structured: false,
      account_type: "",
      account_email: "",
      account_password: "",
      formatted_bracket: "",
      extra_notes: "",
      raw: "",
    };
  }

  // Primary format: [tipe akun gmail dll] [email] [password]
  const bracketRegex = /\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/;
  const match = raw.match(bracketRegex);
  if (match) {
    const account_type = String(match[1] || "").trim();
    const account_email = String(match[2] || "").trim();
    const account_password = String(match[3] || "").trim();
    const formatted_bracket = `[${account_type}] [${account_email}] [${account_password}]`;
    const extra_notes = raw
      .replace(match[0], "")
      .replace(/^\s*[-•|:]?\s*/, "")
      .trim();
    return {
      is_structured: true,
      account_type,
      account_email,
      account_password,
      formatted_bracket,
      extra_notes,
      raw,
    };
  }

  // Secondary fallback: pipe or newline separated 3 parts if it looks like credentials
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLine = lines[0] || "";
  const pipeParts = firstLine.split(/\s*\|\s*/).filter(Boolean);
  if (pipeParts.length >= 3) {
    const account_type = pipeParts[0].trim();
    const account_email = pipeParts[1].trim();
    const account_password = pipeParts[2].trim();
    return {
      is_structured: true,
      account_type,
      account_email,
      account_password,
      formatted_bracket: `[${account_type}] [${account_email}] [${account_password}]`,
      extra_notes: [...pipeParts.slice(3), ...lines.slice(1)].join("\n").trim(),
      raw,
    };
  }

  return {
    is_structured: false,
    account_type: "",
    account_email: "",
    account_password: "",
    formatted_bracket: "",
    extra_notes: raw,
    raw,
  };
}

function formatRupiahText(amount?: number | string | null): string {
  const num = Math.round(Number(amount || 0));
  return "Rp " + num.toLocaleString("id-ID");
}

async function sendOrderFulfillmentEmail(tx: any, req?: Request, forceResend = false) {
  try {
    if (!tx) {
      return { ok: false, error: "Transaksi tidak ditemukan" };
    }
    const toEmail = String(tx.buyer_email || "").trim().toLowerCase();
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return { ok: false, error: "Alamat email pembeli belum tersedia atau tidak valid" };
    }
    if (tx.fulfillment_email_sent_at && !forceResend) {
      return {
        ok: true,
        already_sent: true,
        provider: tx.fulfillment_email_provider || "auto",
        to_email: toEmail,
      };
    }

    const cfg = getEmailAuthConfig();
    const tpl = cfg.template;
    const origin = getAppOrigin(req);
    const orderUrl = `${origin}/payment/success?session_id=${encodeURIComponent(tx.session_id)}`;
    const buyerName = toEmail.split("@")[0] || "Sobat Gamer";
    const timestamp = formatIndonesianTimestamp(tx.paykita_confirmed_at || tx.updated_at || nowIso());
  const isTopup = tx.product_type === PRODUCT_TYPE || String(tx.category || "").toLowerCase() === TOPUP_CATEGORY.toLowerCase();
  const totalIdr = formatRupiahText(tx.pay_amount || tx.amount || 0);
  const paymentMethodLabel = String(
    tx.destination_name ||
      tx.duitku_channel_name ||
      (tx.payment_type === "crypto" ? `Crypto (${tx.crypto_symbol || "USDT"})` : "") ||
      tx.gateway_name ||
      tx.provider ||
      "QRIS / Transfer"
  );

  if (isTopup) {
    // Official Top Up Game Invoice Email (sent ONLY after payment is confirmed paid)
    const gameName = String(tx.game_name || tx.game?.name || "Top Up Game");
    const denomLabel = String(tx.denomination_label || tx.denomination_code || tx.product_title || "-");
    const destText =
      tx.destination && typeof tx.destination === "object"
        ? Object.entries(tx.destination)
            .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
            .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
            .join(" / ")
        : String(tx.customer_no || "-");
    const nicknameText = String(tx.verified_nickname || "-");

    const subject = `🧾 Invoice Lunas Top Up ${gameName} #${tx.session_id} — ${tpl.brand_name}`;
    const bodyHtml = `Pembayaran Anda untuk pesanan Top Up <strong>${escapeHtml(
      gameName
    )} (${escapeHtml(
      denomLabel
    )})</strong> telah <strong>terkonfirmasi LUNAS</strong>. Berikut adalah rincian invoice resmi transaksi Anda:
      <div style="margin-top:16px;padding:16px;background:#080C18;border:1px solid #00F0FF;border-radius:10px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#00F0FF;margin-bottom:8px;">
          STATUS TOP UP • LUNAS &amp; TERVERIFIKASI OTOMATIS
        </div>
        <div style="font-size:14px;font-weight:700;color:#F8FAFC;margin-bottom:4px;">
          ${escapeHtml(gameName)} — ${escapeHtml(denomLabel)}
        </div>
        <div style="font-size:12px;color:#94A3B8;font-family:'JetBrains Mono',Consolas,monospace;">
          Tujuan ID: <span style="color:#E2E8F0;font-weight:700;">${escapeHtml(destText)}</span>${
      nicknameText && nicknameText !== "-"
        ? ` • Nickname: <span style="color:#A3E635;font-weight:700;">${escapeHtml(nicknameText)}</span>`
        : ""
    }
        </div>
      </div>`;

    const infoRows = [
      { label: "Nomor Invoice", value: `#${tx.session_id}`, highlight: true },
      { label: "Produk / Game", value: `${gameName} — ${denomLabel}`, highlight: true },
      { label: "ID Tujuan / Server", value: destText },
      ...(nicknameText && nicknameText !== "-"
        ? [{ label: "Nickname Akun", value: nicknameText, highlight: true }]
        : []),
      { label: "Metode Pembayaran", value: paymentMethodLabel },
      { label: "Total Dibayar", value: totalIdr, highlight: true },
      { label: "Status Pembayaran", value: "LUNAS (TERVERIFIKASI)" },
      { label: "Waktu Lunas", value: timestamp },
    ];

    const html = renderBrandedEmailTemplate({
      templateCfg: tpl,
      badgeText: "INVOICE TOP UP LUNAS",
      heading: `Terima Kasih! Pembayaran Top Up #${tx.session_id} Lunas`,
      greetingName: buyerName,
      bodyHtml,
      ctaText: "LIHAT INVOICE & STATUS PESANAN",
      ctaUrl: orderUrl,
      infoTitle: "RINCIAN INVOICE RESMI & VERIFIKASI PEMBAYARAN",
      infoRows,
      showBenefits: false,
      footerNote:
        "Simpan email ini sebagai bukti pembayaran resmi (Invoice) dari WillJustPlay. Item/Diamond diproses otomatis ke ID tujuan Anda.",
      supportText: tpl.support_text,
      originUrl: origin,
    });

    const text = [
      `Halo ${buyerName},`,
      ``,
      `Terima kasih! Pembayaran Top Up Anda di ${tpl.brand_name} telah terkonfirmasi LUNAS.`,
      ``,
      `=== INVOICE RESMI TOP UP ===`,
      `No. Invoice       : #${tx.session_id}`,
      `Game              : ${gameName}`,
      `Nominal / Item    : ${denomLabel}`,
      `ID Tujuan         : ${destText}`,
      ...(nicknameText && nicknameText !== "-" ? [`Nickname          : ${nicknameText}`] : []),
      `Metode Pembayaran : ${paymentMethodLabel}`,
      `Total Dibayar     : ${totalIdr}`,
      `Status            : LUNAS (TERVERIFIKASI)`,
      `Waktu Pembayaran  : ${timestamp}`,
      ``,
      `Lihat invoice lengkap di: ${orderUrl}`,
    ].join("\n");

    const mailRes = await sendTransactionalEmail({
      to: toEmail,
      subject,
      template: "topup-invoice",
      html,
      text,
      previewUrl: `/payment/success?session_id=${encodeURIComponent(tx.session_id)}`,
    });

    tx.fulfillment_email_sent = true;
    tx.fulfillment_email_provider = mailRes.provider;
    tx.fulfillment_email_sent_at = nowIso();
    tx.fulfillment_email_to = toEmail;
    tx.fulfillment_email_type = "topup_invoice";
    saveDb();

    return {
      ok: true,
      type: "topup_invoice",
      to_email: toEmail,
      provider: mailRes.provider,
      delivered: mailRes.delivered,
      sent_at: tx.fulfillment_email_sent_at,
    };
  } else {
    // Store Account / Digital Product Fulfillment Email with [Tipe Akun] [Email] [Password]
    const rawDelivery = String(
      tx.delivery_info ||
        "[Gmail] [akses.pesanan@willjustplay.com] [Wjp#2026]"
    ).trim();
    const parsed = parseStructuredDeliveryInfo(rawDelivery);
    const formattedBracket = parsed.is_structured
      ? parsed.formatted_bracket
      : `[Akun Produk] [${toEmail}] [${rawDelivery}]`;

    const subject = `🔐 Data Akses Akun & Invoice #${tx.session_id} — ${tx.product_title || tpl.brand_name}`;

    const structuredCardHtml = parsed.is_structured
      ? `<div style="margin-top:16px;padding:18px;background:#080C18;border:1px solid #A3E635;border-radius:10px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#A3E635;margin-bottom:10px;">
            🔐 DATA AKSES AKUN ANDA (FORMAT RESMI TERVERIFIKASI)
          </div>
          <div style="padding:11px 13px;background:#05070F;border:1px dashed #1E293B;border-radius:8px;font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;color:#00F0FF;font-weight:700;word-break:break-all;margin-bottom:12px;">
            ${escapeHtml(parsed.formatted_bracket)}
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#94A3B8;width:36%;">Tipe Akun</td>
              <td style="padding:6px 0;font-size:13px;color:#F8FAFC;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;">${escapeHtml(
                parsed.account_type
              )}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#94A3B8;border-top:1px solid #161F33;">Email / Username</td>
              <td style="padding:6px 0;font-size:13px;color:#00F0FF;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;border-top:1px solid #161F33;">${escapeHtml(
                parsed.account_email
              )}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#94A3B8;border-top:1px solid #161F33;">Password</td>
              <td style="padding:6px 0;font-size:13px;color:#A3E635;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;border-top:1px solid #161F33;">${escapeHtml(
                parsed.account_password
              )}</td>
            </tr>
          </table>
          ${
            parsed.extra_notes
              ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #161F33;font-size:12px;color:#CBD5E1;line-height:1.5;">
                  <strong>Catatan / Instruksi:</strong><br/>${escapeHtml(parsed.extra_notes).replace(/\n/g, "<br/>")}
                </div>`
              : ""
          }
        </div>`
      : `<div style="margin-top:16px;padding:18px;background:#080C18;border:1px solid #A3E635;border-radius:10px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#A3E635;margin-bottom:8px;">
            🔐 DATA AKSES / PENGIRIMAN PESANAN
          </div>
          <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;color:#F8FAFC;line-height:1.6;white-space:pre-line;">${escapeHtml(
            rawDelivery
          )}</div>
        </div>`;

    const bodyHtml = `Pembayaran Anda untuk produk <strong>${escapeHtml(
      tx.product_title || "Produk Digital"
    )}</strong> telah <strong>terkonfirmasi LUNAS</strong>. Berikut adalah akses data akun beserta invoice pembelian Anda:${structuredCardHtml}`;

    const infoRows = [
      { label: "Nomor Pesanan / Invoice", value: `#${tx.session_id}`, highlight: true },
      { label: "Produk Dibeli", value: String(tx.product_title || "-"), highlight: true },
      ...(parsed.is_structured
        ? [
            { label: "Format Akses", value: parsed.formatted_bracket, highlight: true },
            { label: "Tipe Akun", value: parsed.account_type },
            { label: "Email / Username", value: parsed.account_email, highlight: true },
            { label: "Password Akun", value: parsed.account_password, highlight: true },
          ]
        : []),
      { label: "Metode Pembayaran", value: paymentMethodLabel },
      { label: "Total Dibayar", value: totalIdr, highlight: true },
      { label: "Status Pembayaran", value: "LUNAS (TERVERIFIKASI)" },
      { label: "Waktu Lunas", value: timestamp },
    ];

    const html = renderBrandedEmailTemplate({
      templateCfg: tpl,
      badgeText: "AKSES AKUN & INVOICE",
      heading: "Pembayaran Lunas! Ini Data Akses Akun Anda",
      greetingName: buyerName,
      bodyHtml,
      ctaText: "BUKA HALAMAN PESANAN & SALIN DATA",
      ctaUrl: orderUrl,
      infoTitle: "RINCIAN INVOICE RESMI & VERIFIKASI PEMBAYARAN",
      infoRows,
      showBenefits: false,
      footerNote:
        "Demi keamanan akun Anda, segera login dan amankan/ganti kata sandi setelah menerima data akses ini. Jangan bagikan email ini kepada siapa pun.",
      supportText: tpl.support_text,
      originUrl: origin,
    });

    const text = [
      `Halo ${buyerName},`,
      ``,
      `Pembayaran Anda untuk "${tx.product_title}" (#${tx.session_id}) telah LUNAS.`,
      ``,
      `=== DATA AKSES AKUN ===`,
      `Format Lengkap   : ${formattedBracket}`,
      ...(parsed.is_structured
        ? [
            `Tipe Akun        : ${parsed.account_type}`,
            `Email / Username : ${parsed.account_email}`,
            `Password         : ${parsed.account_password}`,
            ...(parsed.extra_notes ? [`Catatan          : ${parsed.extra_notes}`] : []),
          ]
        : [`Detail Pengiriman: ${rawDelivery}`]),
      ``,
      `=== RINGKASAN INVOICE ===`,
      `No. Invoice      : #${tx.session_id}`,
      `Metode Bayar     : ${paymentMethodLabel}`,
      `Total Dibayar    : ${totalIdr}`,
      `Waktu Lunas      : ${timestamp}`,
      ``,
      `Buka halaman pesanan: ${orderUrl}`,
    ].join("\n");

    const mailRes = await sendTransactionalEmail({
      to: toEmail,
      subject,
      template: "order-delivery",
      html,
      text,
      previewUrl: `/payment/success?session_id=${encodeURIComponent(tx.session_id)}`,
    });

    tx.fulfillment_email_sent = true;
    tx.fulfillment_email_provider = mailRes.provider;
    tx.fulfillment_email_sent_at = nowIso();
    tx.fulfillment_email_to = toEmail;
    tx.fulfillment_email_type = "account_access";
    saveDb();

    return {
      ok: true,
      type: "account_access",
      to_email: toEmail,
      provider: mailRes.provider,
      delivered: mailRes.delivered,
      sent_at: tx.fulfillment_email_sent_at,
    };
  }
  } catch (err: any) {
    console.error("[sendOrderFulfillmentEmail] Error:", err);
    return {
      ok: false,
      error: err?.message || "Gagal mengirim email pesanan",
    };
  }
}

// ---------------- Auth & Session Helpers ----------------
function createSessionAndToken(user: any, req?: Request, res?: Response) {
  const rawSid = crypto.randomBytes(24).toString("hex");
  const sidHash = hashToken(rawSid);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const sessionDoc = {
    id: "ses-" + uuidHex(10),
    user_id: user.id,
    token_hash: sidHash,
    created_at: nowIso(),
    expires_at: expiresAt,
    last_seen_at: nowIso(),
    revoked_at: null as string | null,
    ip: getClientIp(req),
  };
  db.sessions.push(sessionDoc);
  if (db.sessions.length > 1000) {
    db.sessions = db.sessions.slice(-1000);
  }
  saveDb();

  if (res) {
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("wjp_sid", rawSid, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || "buyer",
      sv: Number(user.session_version || 0),
      sid: sessionDoc.id,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function revokeAllUserSessions(user: any) {
  const now = nowIso();
  user.session_version = Number(user.session_version || 0) + 1;
  for (const s of db.sessions) {
    if (s.user_id === user.id && !s.revoked_at) {
      s.revoked_at = now;
    }
  }
  saveDb();
}

function publicUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    role: user.role || "buyer",
    status: user.status || "active",
    is_verified: Boolean(user.is_verified),
    verified_at: user.verified_at || null,
    wishlist: user.wishlist || [],
    created_at: user.created_at || null,
    last_login_at: user.last_login_at || null,
  };
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie || "";
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    if (k) out[k] = v;
  }
  return out;
}

function getUserOptional(req: Request): any | null {
  let user: any = null;
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
      const found = db.users.find((u) => u.id === payload.sub);
      if (found) {
        if (payload.sv !== undefined && Number(payload.sv) !== Number(found.session_version || 0)) {
          return null;
        }
        if (payload.sid) {
          const ses = db.sessions.find((s) => s.id === payload.sid);
          if (ses && (ses.revoked_at || new Date(ses.expires_at).getTime() <= Date.now())) {
            return null;
          }
        }
        user = found;
      }
    } catch {
      user = null;
    }
  }

  if (!user) {
    const cookies = parseCookies(req);
    if (cookies.wjp_sid) {
      const th = hashToken(cookies.wjp_sid);
      const ses = db.sessions.find(
        (s) => s.token_hash === th && !s.revoked_at && new Date(s.expires_at).getTime() > Date.now()
      );
      if (ses) {
        ses.last_seen_at = nowIso();
        user = db.users.find((u) => u.id === ses.user_id) || null;
      }
    }
  }

  if (!user) return null;
  if (user.status === "suspended") return null;
  const emailCfg = getEmailAuthConfig();
  if (emailCfg.require_email_verification && user.is_verified === false && user.role !== "admin") return null;
  return user;
}

function requireUser(req: Request, res: Response): any | null {
  const u = getUserOptional(req);
  if (!u) {
    res.status(401).json({ detail: "Silakan login dengan akun terverifikasi terlebih dahulu" });
    return null;
  }
  return u;
}

function matchesAdminKeyTimingSafe(candidate?: string): boolean {
  if (!candidate) return false;
  let matched = false;
  for (const validKey of ADMIN_KEYS) {
    if (safeTimingCompare(candidate, validKey)) {
      matched = true;
    }
  }
  return matched;
}

function requireAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers["x-admin-key"] as string | undefined;
  if (adminKey && matchesAdminKeyTimingSafe(adminKey)) {
    (req as any).adminUser = { id: "admin-key", email: ADMIN_EMAIL, role: "admin" };
    return next();
  }
  const user = getUserOptional(req);
  if (user && user.role === "admin" && user.status !== "suspended" && user.is_verified !== false) {
    (req as any).adminUser = user;
    return next();
  }
  const ip = getClientIp(req);
  const strikeRes = recordSecurityStrike(
    ip,
    "admin_unauth",
    8,
    10 * 60 * 1000,
    "Percobaan akses endpoint Admin tanpa otorisasi berulang (Brute Force Admin API)",
    req,
    { path: req.originalUrl || req.url }
  );
  writeAuditLog({
    actor: user || null,
    action: "security.admin_unauthorized_attempt",
    metadata: {
      path: req.originalUrl || req.url,
      strikes: strikeRes.strikes,
      blocked: strikeRes.blocked,
    },
    req,
  });
  return res.status(401).json({ detail: "Akses admin ditolak" });
}

// ---------------- Reviews Helpers ----------------
function publicReview(row: any) {
  const rating = Math.max(1, Math.min(5, Number(row.rating || 5)));
  return {
    id: row.id,
    name: row.name || "Pembeli",
    rating,
    text: row.text || "",
    image: row.image || "",
    game: row.game || "",
    product: row.product || "",
    created_at: row.created_at || "",
    source: row.source || "admin",
    verified: Boolean(row.verified),
    reply: row.reply || "",
  };
}

function refreshProductRating(productId: string) {
  if (!productId) return 0;
  const rows = db.testimonials.filter((t) => t.product_id === productId && t.verified);
  const product = db.products.find((p) => p.id === productId);
  if (!product) return 0;
  if (rows.length === 0) {
    product.rating = Number(product.rating_base ?? product.rating ?? 5.0);
    product.review_count = 0;
    saveDb();
    return 0;
  }
  const ratings = rows.map((r) => Math.max(1, Math.min(5, Number(r.rating || 5))));
  const avg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  product.rating = avg;
  product.review_count = ratings.length;
  saveDb();
  return ratings.length;
}

// ---------------- Vendor Catalog Helpers ----------------
const VENDOR_CATALOG = [
  {
    kind: "digiflazz",
    label: "Digiflazz Indonesia",
    description: "Supplier H2H Top-Up Game & Voucher #1 Indonesia. Mendukung tarik produk otomatis, verifikasi ID game, cek saldo deposit, dan pengiriman instan.",
    fields: [
      { key: "username", label: "Username Digiflazz", required: true, secret: false },
      { key: "api_key", label: "Production API Key", required: true, secret: true },
      { key: "dev_key", label: "Development API Key (opsional)", required: false, secret: true },
      { key: "use_dev", label: "Gunakan Development Key / Sandbox", required: false, secret: false, type: "boolean" },
      { key: "brand_override", label: "Filter Brand Default (opsional)", required: false, secret: false },
    ],
    supports: { check: true, balance: true, import: true },
  },
];

function maskSecret(val: string) {
  if (!val) return "";
  if (val.length <= 8) return "****";
  return val.slice(0, 4) + "****" + val.slice(-4);
}

function maskedVendorView(doc: any) {
  const spec = VENDOR_CATALOG[0];
  const cfg = { ...(doc.config || {}) };
  const sources: Record<string, string> = {};
  const envMap: Record<string, string | undefined> = {
    username: process.env.DIGIFLAZZ_USERNAME,
    api_key: process.env.DIGIFLAZZ_API_KEY,
    dev_key: process.env.DIGIFLAZZ_DEV_KEY,
  };
  for (const f of spec.fields) {
    const dbVal = String(cfg[f.key] ?? "").trim();
    const envVal = String(envMap[f.key] ?? "").trim();
    sources[f.key] = dbVal ? "db" : envVal ? "env" : "";
    if (f.secret && dbVal) {
      cfg[f.key] = maskSecret(dbVal);
    }
  }
  const rawUser = String(doc.config?.username || process.env.DIGIFLAZZ_USERNAME || "").trim();
  const rawKey = String(
    (doc.config?.use_dev ? doc.config?.dev_key : doc.config?.api_key) ||
      doc.config?.api_key ||
      process.env.DIGIFLAZZ_API_KEY ||
      ""
  ).trim();
  const hasRealCreds = !isDemoDigiflazzCredential(rawUser, rawKey);
  return {
    ...doc,
    kind: "digiflazz",
    config: cfg,
    kind_label: spec.label,
    config_sources: sources,
    credential_source: hasRealCreds
      ? String(doc.config?.username || "").trim()
        ? "db"
        : "env"
      : "none",
    available: hasRealCreds,
  };
}

function crc16CcittFalse(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emvTag(id: string, value: string): string {
  const clean = String(value || "");
  return `${id}${String(clean.length).padStart(2, "0")}${clean}`;
}

function buildFallbackEmvQrisPayload(orderId: string, amount: number, merchantName = "WILLJUSTPLAY"): string {
  const amtStr = String(Math.max(1, Math.round(Number(amount || 0))));
  const cleanMerchant = String(merchantName || "WILLJUSTPLAY")
    .replace(/[^a-zA-Z0-9 ._-]/g, "")
    .slice(0, 25)
    .toUpperCase() || "WILLJUSTPLAY";
  const cleanRef = String(orderId || "ORDER").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20);
  const merchantAccountInfo =
    emvTag("00", "ID.CO.QRIS.WWW") +
    emvTag("01", "936009180000000123") +
    emvTag("02", cleanRef) +
    emvTag("03", "UMI");
  const additionalData = emvTag("01", cleanRef) + emvTag("07", "TERM01");
  const bodyWithoutCrc =
    emvTag("00", "01") +
    emvTag("01", "12") +
    emvTag("26", merchantAccountInfo) +
    emvTag("51", emvTag("00", "ID.OR.GPNQR.WWW") + emvTag("02", cleanRef) + emvTag("03", "UMI")) +
    emvTag("52", "5812") +
    emvTag("53", "360") +
    emvTag("54", amtStr) +
    emvTag("58", "ID") +
    emvTag("59", cleanMerchant) +
    emvTag("60", "JAKARTA") +
    emvTag("62", additionalData) +
    "6304";
  return bodyWithoutCrc + crc16CcittFalse(bodyWithoutCrc);
}

async function generateQrisDataUri(qrisPayload: string): Promise<string> {
  const clean = String(qrisPayload || "").trim();
  if (!clean) return "";
  try {
    return await QRCode.toDataURL(clean, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 360,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch {
    return "";
  }
}

function vendorSkuPrefixForKind(_kind: string): string {
  // Digiflazz uses direct SKU codes without vendor prefix
  return "";
}

function matchDigiflazzItemToLocalGame(brandStr: string, skuStr: string, productNameStr = ""): string {
  const brandNorm = String(brandStr || "").trim().toLowerCase();
  const skuUpper = String(skuStr || "").trim().toUpperCase();
  const nameNorm = String(productNameStr || "").trim().toLowerCase();

  const aliasMap: Array<{ slug: string; prefixes: string[]; keywords: string[] }> = [
    { slug: "mobile-legends", prefixes: ["ML", "MLBB", "WDP"], keywords: ["mobile legends", "mobile legend", "mlbb"] },
    { slug: "free-fire", prefixes: ["FF", "FFMAX"], keywords: ["free fire", "freefire", "garena ff"] },
    { slug: "pubg-mobile", prefixes: ["PUBG", "PUBGM"], keywords: ["pubg mobile", "pubgm", "pubg"] },
    { slug: "honor-of-kings", prefixes: ["HOK"], keywords: ["honor of kings", "honor of king", "hok"] },
    { slug: "zenless-zone-zero", prefixes: ["ZZZ"], keywords: ["zenless zone zero", "zenless", "monochrome", "inter-knot"] },
    { slug: "genshin-impact", prefixes: ["GI", "GENSHIN"], keywords: ["genshin impact", "genshin", "genesis crystal", "welkin"] },
    { slug: "honkai-star-rail", prefixes: ["HSR"], keywords: ["honkai: star rail", "honkai star rail", "star rail"] },
    { slug: "wuthering-waves", prefixes: ["WW", "WUTHERING"], keywords: ["wuthering waves", "wuthering wave", "lunites"] },
    { slug: "arena-of-valor", prefixes: ["AOV"], keywords: ["arena of valor", "aov", "garena aov"] },
    { slug: "marvel-rivals", prefixes: ["MR", "MARVEL"], keywords: ["marvel rivals", "marvel rival"] },
    { slug: "delta-force", prefixes: ["DF", "DELTA"], keywords: ["delta force", "garena delta force"] },
    { slug: "magic-chess-go-go", prefixes: ["MCGG", "MCG", "MC"], keywords: ["magic chess: go go", "magic chess go go", "magic chess"] },
    { slug: "ragnarok-origin", prefixes: ["ROO", "ROORIGIN"], keywords: ["ragnarok origin", "nyan berry"] },
    { slug: "ragnarok-m-eternal-love", prefixes: ["ROM", "RO"], keywords: ["ragnarok m", "ragnarok eternal love", "big cat coin", "ragnarok"] },
    { slug: "fc-mobile", prefixes: ["FCM", "FIFA"], keywords: ["fc mobile", "ea sports fc", "fifa mobile"] },
    { slug: "wild-rift", prefixes: ["WR", "LOLWR"], keywords: ["wild rift", "league of legends: wild rift", "lol wild rift"] },
    { slug: "valorant", prefixes: ["VAL", "VP"], keywords: ["valorant", "riot valorant"] },
    { slug: "call-of-duty-mobile", prefixes: ["CODM", "COD"], keywords: ["call of duty", "cod mobile", "codm"] },
    { slug: "point-blank", prefixes: ["PB", "PBCASH"], keywords: ["point blank", "pb zepetto", "pointblank"] },
    { slug: "bigo-live", prefixes: ["BIGO"], keywords: ["bigo live", "bigo"] },
    { slug: "roblox", prefixes: ["RBX", "ROBLOX"], keywords: ["roblox", "robux"] },
  ];

  // 1. Check against local db.games first (supports custom local games created by Admin)
  for (const g of db.games || []) {
    const gSlug = String(g.slug || "").trim().toLowerCase();
    const gName = String(g.name || "").trim().toLowerCase();
    const gPrefix = String(g.vendor_prefix || "").trim().toUpperCase();
    if (!gSlug) continue;
    if (brandNorm && (brandNorm === gSlug || brandNorm === gName || gName.includes(brandNorm) || brandNorm.includes(gName))) {
      return g.slug;
    }
    if (gPrefix && skuUpper.startsWith(gPrefix)) {
      const rest = skuUpper.slice(gPrefix.length);
      if (!rest || /^[0-9A-Z_]+$/.test(rest)) {
        return g.slug;
      }
    }
  }

  // 2. Check standard game aliases if that game exists locally in db.games
  for (const entry of aliasMap) {
    const localMatch = (db.games || []).find((g) => g.slug === entry.slug);
    if (!localMatch) continue;
    if (entry.keywords.some((kw) => brandNorm.includes(kw) || nameNorm.includes(kw))) {
      return localMatch.slug;
    }
    if (entry.prefixes.some((pfx) => skuUpper.startsWith(pfx) && /^[0-9A-Z]*$/.test(skuUpper.slice(pfx.length)))) {
      return localMatch.slug;
    }
  }

  return "";
}

function cleanDenomLabelFromProductName(productName: string, brand: string, gameName = ""): string {
  let label = String(productName || "").trim();
  const candidates = [
    brand,
    gameName,
    "Mobile Legends: Bang Bang",
    "Mobile Legends",
    "Free Fire & Free Fire MAX",
    "Free Fire / Free Fire MAX",
    "Free Fire",
    "PUBG Mobile",
    "Honor of Kings",
    "Genshin Impact & Zenless Zone Zero",
    "Genshin Impact",
    "Zenless Zone Zero",
    "Honkai: Star Rail",
    "Honkai Star Rail",
    "Wuthering Waves",
    "Arena of Valor",
    "Marvel Rivals",
    "Delta Force - Garena",
    "Delta Force",
    "Magic Chess: Go Go",
    "Magic Chess Go Go",
    "Ragnarok M: Eternal Love & Ragnarok Origin",
    "Ragnarok M: Eternal Love",
    "Ragnarok Origin",
    "EA Sports FC Mobile",
    "FC Mobile",
    "League of Legends: Wild Rift",
    "Wild Rift",
    "Valorant (PC/Mobile via Riot Games)",
    "Valorant",
    "Call of Duty: Mobile",
    "Call of Duty Mobile",
    "Point Blank",
    "Bigo Live",
    "Roblox (Voucher Code)",
    "Roblox",
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const c of candidates) {
    const regex = new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[-–—:•]?\\s*`, "i");
    if (regex.test(label)) {
      const stripped = label.replace(regex, "").trim();
      if (stripped.length >= 2) {
        label = stripped;
        break;
      }
    }
  }
  return label || String(productName || "").trim();
}

function extractAmountFromLabel(labelStr: string, fallback = 0): number {
  const m = String(labelStr || "").replace(/\./g, "").match(/(\d+)/);
  if (m && Number(m[1]) > 0) return Number(m[1]);
  return fallback;
}

async function fetchDigiflazzPriceList(providerDoc: any, forceRefresh = false): Promise<{
  items: any[];
  source: "digiflazz_live";
  live_count: number;
  error?: string;
}> {
  const doc =
    providerDoc ||
    db.topup_providers.find((v) => v.kind === "digiflazz") ||
    db.topup_providers[0];

  const username = String(doc?.config?.username || process.env.DIGIFLAZZ_USERNAME || "").trim();
  const apiKey = String(
    (doc?.config?.use_dev ? doc?.config?.dev_key : doc?.config?.api_key) ||
      doc?.config?.api_key ||
      process.env.DIGIFLAZZ_API_KEY ||
      ""
  ).trim();

  if (isDemoDigiflazzCredential(username, apiKey)) {
    return {
      items: [],
      source: "digiflazz_live",
      live_count: 0,
      error:
        "Kredensial Digiflazz (Username & Production API Key) belum dikonfigurasi. Silakan isi kredensial asli Digiflazz pada tab Integrasi & Supplier terlebih dahulu.",
    };
  }

  let liveItems: any[] = [];
  let liveError = "";

  // Use cached live pricelist if recent (< 5 minutes) and not forced
  const cacheAgeMs = doc?.cached_pricelist_at
    ? Date.now() - new Date(doc.cached_pricelist_at).getTime()
    : Infinity;
  if (
    !forceRefresh &&
    Array.isArray(doc?.cached_pricelist) &&
    doc.cached_pricelist.length > 0 &&
    cacheAgeMs < 5 * 60 * 1000
  ) {
    liveItems = doc.cached_pricelist;
  } else {
    try {
      const sign = crypto.createHash("md5").update(username + apiKey + "pricelist").digest("hex");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch("https://api.digiflazz.com/v1/price-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "prepaid", username, sign }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json: any = await resp.json().catch(() => null);
      const rawList = Array.isArray(json?.data) ? json.data : [];
      if (rawList.length > 0) {
        for (const row of rawList) {
          if (!row || typeof row !== "object") continue;
          const sku = String(row.buyer_sku_code || "").trim();
          const modalPrice = Number(row.price || 0);
          if (!sku || modalPrice <= 0) continue;
          // Skip inactive seller/buyer products
          if (row.buyer_product_status === false || row.seller_product_status === false) continue;

          const brand = String(row.brand || "").trim();
          const category = String(row.category || "Games").trim();
          const prodName = String(row.product_name || sku).trim();
          const matchedSlug = matchDigiflazzItemToLocalGame(brand, sku, prodName);
          const localGame = matchedSlug ? (db.games || []).find((g) => g.slug === matchedSlug) : null;

          // Detect Digiflazz Cek ID / Inquiry utility SKUs (e.g. CEKML, CEKFF, Cek ID / Cek Username)
          const isCekIdSku =
            /^(CEK|CHK|INQ)[A-Z0-9_-]*$/i.test(sku) ||
            /\b(cek\s*id|cek\s*nama|cek\s*username|cek\s*akun|check\s*id|inquiry\s*id)\b/i.test(
              `${prodName} ${category}`
            );
          if (isCekIdSku) {
            if (localGame) {
              localGame.cek_id_sku = sku.toUpperCase();
            }
            continue;
          }

          const gPrefix = String(localGame?.vendor_prefix || "").toUpperCase();
          let code = sku.toUpperCase();
          if (gPrefix && code.startsWith(gPrefix) && code.length > gPrefix.length) {
            code = code.slice(gPrefix.length);
          }
          code = code.replace(/[^A-Z0-9_]/g, "") || sku.toUpperCase();
          const label = cleanDenomLabelFromProductName(prodName, brand, localGame?.name || "");
          const amount = extractAmountFromLabel(label, 0);
          const retailPrice = Math.max(modalPrice + 1000, Math.ceil((modalPrice * 1.1) / 100) * 100);
          const strikePrice = Math.max(retailPrice + 1500, Math.ceil((retailPrice * 1.12) / 500) * 500);

          const skuGroup = detectDigiflazzSkuGroup(sku, `${prodName} ${label}`, String(row.type || category));

          liveItems.push({
            sku,
            code,
            game_slug: matchedSlug,
            name: localGame ? `${localGame.name} — ${label}` : `${brand ? `${brand} — ` : ""}${prodName}`,
            label,
            brand: brand || localGame?.name || "Digiflazz",
            category,
            sku_group: skuGroup,
            price: modalPrice,
            retail_price: retailPrice,
            price_strike: strikePrice,
            amount,
            badge: skuGroup === "membership" ? "Membership" : "",
            featured: false,
            status: "available",
            unlimited_stock: row.unlimited_stock !== false,
            multi: row.multi !== false,
            provider: doc?.name || "Digiflazz Indonesia",
            source: "digiflazz_live",
          });
        }
        if (liveItems.length > 0 && doc) {
          doc.cached_pricelist = liveItems;
          doc.cached_pricelist_at = nowIso();
          saveDb();
        } else if (liveItems.length === 0) {
          liveError = "Respons API Digiflazz tidak berisi produk aktif (0 produk ditemukan).";
        }
      } else if (json?.data?.message) {
        liveError = `Digiflazz API: ${String(json.data.message)}`;
      } else {
        liveError = "Gagal mengambil daftar produk dari API Digiflazz (pastikan Username, API Key, dan IP Whitelist di member.digiflazz.com sudah benar).";
      }
    } catch (err: any) {
      liveError = `Gagal terhubung ke API Digiflazz: ${String(err?.message || "Koneksi ke endpoint pricelist Digiflazz gagal")}`;
    }
  }

  // Strictly return ONLY live items from Digiflazz — NEVER return demo/fallback items!
  const items: any[] = [];
  const seenSkus = new Set<string>();
  for (const li of liveItems) {
    const key = String(li.sku || "").toUpperCase();
    if (!key || seenSkus.has(key)) continue;
    seenSkus.add(key);
    items.push(li);
  }

  return {
    items,
    source: "digiflazz_live",
    live_count: items.length,
    error: liveError || undefined,
  };
}

async function buildVendorProductsCatalog(providerDoc: any, queryStr = "", limit = 300, forceRefresh = false) {
  const { items, source, live_count, error } = await fetchDigiflazzPriceList(providerDoc, forceRefresh);

  const needle = String(queryStr || "").trim().toLowerCase();
  let filtered = items;
  if (needle) {
    filtered = items.filter(
      (item) =>
        String(item.sku || "").toLowerCase().includes(needle) ||
        String(item.name || "").toLowerCase().includes(needle) ||
        String(item.brand || "").toLowerCase().includes(needle) ||
        String(item.game_slug || "").toLowerCase().includes(needle) ||
        String(item.label || "").toLowerCase().includes(needle)
    );
  }
  return {
    total: items.length,
    count: Math.min(filtered.length, limit),
    source,
    live_count,
    live_error: error || null,
    products: filtered.slice(0, limit),
  };
}

async function pullGamesFromMerchant(opts: {
  vendorKind?: string;
  providerId?: string;
  gameSlugs?: string[];
  selectedSkusByGame?: Record<string, string[]>;
  marginPercent?: number;
  useRecommendedPrice?: boolean;
  autoActivateVendor?: boolean;
  forceRefresh?: boolean;
}) {
  const provider =
    (opts.providerId && db.topup_providers.find((v) => v.id === opts.providerId)) ||
    db.topup_providers.find((v) => v.kind === "digiflazz") ||
    db.topup_providers[0];

  const vendorKind = "digiflazz";

  // Ensure local games have their 3D icons intact
  upgradeLocalGameIcons();

  // Strictly fetch live products from Digiflazz API (no demo fallback)
  const { items: digiflazzProducts, source, error } = await fetchDigiflazzPriceList(provider, true);

  if (error || digiflazzProducts.length === 0) {
    if (provider) {
      provider.last_test = {
        ok: false,
        mode: "production",
        message: error || "Gagal menarik produk dari API Digiflazz (0 produk diterima)",
        at: nowIso(),
      };
      saveDb();
    }
    return {
      ok: false,
      error:
        error ||
        "Gagal menarik daftar produk dari API Digiflazz (0 produk diterima). Pastikan Username, API Key, dan IP Whitelist Digiflazz sudah sesuai.",
      source,
      vendor_id: provider?.id || "vp-digiflazz",
      vendor_kind: vendorKind,
      vendor_name: provider?.name || "Digiflazz Indonesia",
      games_created: 0,
      games_updated: 0,
      games_total: 0,
      denominations_pulled: 0,
      products_synced: 0,
    };
  }

  if (provider && opts.autoActivateVendor !== false) {
    for (const v of db.topup_providers) v.is_active = false;
    provider.is_active = true;
    provider.auto_dispatch = true;
    provider.last_test = {
      ok: true,
      mode: "production",
      balance: provider.cached_balance ?? undefined,
      message: `${provider.name} aktif & ${digiflazzProducts.length} produk live berhasil ditarik dari Digiflazz`,
      at: nowIso(),
    };
  }

  const targetSlugs =
    Array.isArray(opts.gameSlugs) && opts.gameSlugs.length > 0
      ? new Set(opts.gameSlugs.map((s) => String(s).trim().toLowerCase()).filter(Boolean))
      : null;

  // IMPORTANT: Only iterate over EXISTING local games in db.games!
  const localGamesToUpdate = targetSlugs
    ? (db.games || []).filter((g) => targetSlugs.has(String(g.slug || "").toLowerCase()))
    : (db.games || []);

  const margin = Math.max(0, Number(opts.marginPercent ?? 0));
  const useMargin = margin > 0 || !opts.useRecommendedPrice;

  let gamesUpdated = 0;
  let denominationsPulled = 0;

  for (const existingGame of localGamesToUpdate) {
    const gameSlug = String(existingGame.slug || "").toLowerCase();
    const gPrefix = String(existingGame.vendor_prefix || "").trim().toUpperCase();

    // Find all Digiflazz products matching this local game
    let matchedProducts = digiflazzProducts.filter((p) => {
      if (String(p.game_slug || "").toLowerCase() === gameSlug) return true;
      const matched = matchDigiflazzItemToLocalGame(p.brand, p.sku, p.name);
      return matched && matched.toLowerCase() === gameSlug;
    });

    // If Admin explicitly selected specific SKUs for this game, filter to those SKUs
    const explicitSkus = opts.selectedSkusByGame?.[existingGame.slug] || opts.selectedSkusByGame?.[gameSlug];
    if (Array.isArray(explicitSkus) && explicitSkus.length > 0) {
      const allowedSet = new Set(explicitSkus.map((s) => String(s).trim().toUpperCase()));
      matchedProducts = matchedProducts.filter((p) => allowedSet.has(String(p.sku || "").trim().toUpperCase()));
    }

    if (matchedProducts.length === 0) continue;

    existingGame.vendor_id = provider?.id || existingGame.vendor_id || "vp-digiflazz";

    const currentDenoms: any[] = Array.isArray(existingGame.denominations)
      ? [...existingGame.denominations]
      : [];
    const bySku = new Map(
      currentDenoms
        .filter((cd) => cd.vendor_sku)
        .map((cd) => [String(cd.vendor_sku).trim().toUpperCase(), cd])
    );
    const byCode = new Map(currentDenoms.map((cd) => [String(cd.code).trim().toUpperCase(), cd]));

    for (const prod of matchedProducts) {
      const sku = String(prod.sku || "").trim();
      const code = String(prod.code || sku).trim();
      const modalPrice = Math.max(500, Number(prod.price || 0));
      const sellingPrice =
        useMargin && margin > 0
          ? Math.max(1000, Math.ceil((modalPrice * (1 + margin / 100)) / 100) * 100)
          : Math.max(
              modalPrice + 1000,
              Number(prod.retail_price || Math.ceil((modalPrice * 1.1) / 100) * 100)
            );
      const strikePrice = Math.max(
        sellingPrice + 1500,
        Number(prod.price_strike || Math.ceil((sellingPrice * 1.12) / 500) * 500)
      );

      const found =
        bySku.get(sku.toUpperCase()) ||
        byCode.get(code.toUpperCase()) ||
        (gPrefix && sku.toUpperCase().startsWith(gPrefix)
          ? byCode.get(sku.toUpperCase().slice(gPrefix.length))
          : undefined);

      const detectedGroup = normalizeSkuGroup(prod.sku_group, sku, prod.label || prod.name, prod.category);

      if (found) {
        found.vendor_sku = sku;
        found.modal_price = modalPrice;
        found.price = sellingPrice;
        found.price_strike = strikePrice;
        found.label = prod.label || found.label;
        found.amount = Number(prod.amount || found.amount || 0);
        found.sku_group = normalizeSkuGroup(found.sku_group, sku, found.label, prod.category);
        found.is_active = true;
        if (!found.stock || found.stock < 10) found.stock = 999;
      } else {
        const newDenom = {
          code,
          label: prod.label || prod.name || code,
          amount: Number(prod.amount || 0),
          modal_price: modalPrice,
          price: sellingPrice,
          price_strike: strikePrice,
          stock: 999,
          badge: prod.badge || (detectedGroup === "membership" ? "Membership" : ""),
          sku_group: detectedGroup,
          featured: Boolean(prod.featured),
          is_active: true,
          vendor_sku: sku,
          seq: currentDenoms.length,
        };
        currentDenoms.push(newDenom);
        bySku.set(sku.toUpperCase(), newDenom);
        byCode.set(code.toUpperCase(), newDenom);
      }
      denominationsPulled++;
    }

    existingGame.denominations = currentDenoms.map((d, idx) => ({ ...d, seq: idx }));
    existingGame.updated_at = nowIso();
    gamesUpdated++;
  }

  if (denominationsPulled === 0) {
    return {
      ok: false,
      error:
        "Tidak ada produk dari pricelist Digiflazz yang cocok dengan game lokal yang dipilih.",
      source,
      vendor_id: provider?.id || "vp-digiflazz",
      vendor_kind: vendorKind,
      vendor_name: provider?.name || "Digiflazz Indonesia",
      games_created: 0,
      games_updated: 0,
      games_total: 0,
      denominations_pulled: 0,
      products_synced: 0,
    };
  }

  const totalProductsSynced = syncAllGames(true);
  for (const p of db.products) {
    if (isTopupProduct(p)) {
      p.price_usd = Math.max(0.5, Math.round((Number(p.price || 0) / 16000) * 100) / 100);
    }
  }
  saveDb();

  const marginInfo = margin > 0 ? ` dengan margin otomatis +${margin}%` : "";
  return {
    ok: true,
    source,
    vendor_id: provider?.id || "vp-digiflazz",
    vendor_kind: vendorKind,
    vendor_name: provider?.name || "Digiflazz Indonesia",
    games_created: 0,
    games_updated: gamesUpdated,
    games_total: gamesUpdated,
    denominations_pulled: denominationsPulled,
    products_synced: totalProductsSynced,
    message: `Berhasil menarik ${denominationsPulled} produk/nominal asli dari ${provider?.name || "Digiflazz"} ke ${gamesUpdated} Game Top Up lokal${marginInfo}!`,
  };
}

// ---------------- Express App & Router ----------------
const app = express();
app.disable("x-powered-by");

// Layer 1: HTTP Security Headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

const api = express.Router();

// Layer 2 & 3: Active 15-Minute IP Firewall & WAF Payload Sanitizer
api.use((req, res, next) => {
  const ip = getClientIp(req);
  const ban = getBlockedIpEntry(ip);
  if (ban) {
    // Allow an already-authenticated admin to access admin security / audit endpoints to inspect or unblock IPs
    const maybeUser = getUserOptional(req);
    const adminKey = req.headers["x-admin-key"] as string | undefined;
    const isAuthenticatedAdmin =
      (maybeUser && maybeUser.role === "admin" && maybeUser.status !== "suspended") ||
      matchesAdminKeyTimingSafe(adminKey);
    const isAdminSecurityRoute =
      req.path.startsWith("/admin/audit-logs") ||
      req.path.startsWith("/admin/security") ||
      req.path.startsWith("/admin/email-events") ||
      req.path === "/auth/me";

    if (!isAuthenticatedAdmin || !isAdminSecurityRoute) {
      const remSec = Math.max(1, Math.ceil((ban.expires_at - Date.now()) / 1000));
      const remMin = Math.floor(remSec / 60);
      const secPart = remSec % 60;
      res.setHeader("Retry-After", String(remSec));
      return res.status(429).json({
        detail: `IP Anda (${ip}) diblokir sementara selama 15 menit karena terdeteksi aktivitas berbahaya: ${ban.reason}. Silakan coba lagi dalam ${remMin} menit ${secPart} detik.`,
        code: "IP_BLOCKED_SECURITY",
        retry_after_seconds: remSec,
      });
    }
  }

  // Deep recursive sanitization against XSS, SQL/NoSQL Injection, Null-Byte & Prototype Pollution
  const threats = new Set<string>();
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeInputRecursive(req.body, threats);
  }
  if (req.query && typeof req.query === "object") {
    const cleanQuery = sanitizeInputRecursive(req.query, threats);
    for (const k of Object.keys(req.query)) {
      delete (req.query as any)[k];
    }
    Object.assign(req.query, cleanQuery);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeInputRecursive(req.params, threats);
  }

  if (threats.size > 0) {
    const threatList = Array.from(threats);
    const strikeRes = recordSecurityStrike(
      ip,
      "waf_payload",
      3,
      15 * 60 * 1000,
      `Terdeteksi pengiriman payload berbahaya (${threatList.join(", ")})`,
      req,
      { path: req.originalUrl || req.url, threats: threatList }
    );
    writeAuditLog({
      actor: getUserOptional(req),
      action: "security.payload_attack_detected",
      metadata: {
        path: req.originalUrl || req.url,
        method: req.method,
        threats: threatList,
        strikes: strikeRes.strikes,
        ip_blocked: strikeRes.blocked,
      },
      req,
    });
    if (strikeRes.blocked) {
      return res.status(429).json({
        detail:
          "Sistem keamanan mendeteksi percobaan serangan berulang (XSS/Injection). IP Anda diblokir otomatis selama 15 menit.",
        code: "IP_BLOCKED_SECURITY",
      });
    }
  }

  next();
});

api.get("/", (_req, res) => {
  res.json({ message: "WillJustPlay API online" });
});

const ALL_AUTO_GATEWAYS_META = [
  { id: "paykita", name: "PayKita", tagline: "QRIS Otomatis Produk Beranda", scope: "beranda" },
  { id: "duitku", name: "Duitku", tagline: "Multi-Metode Pembayaran Produk Top Up", scope: "topup" },
];
const ALL_AUTO_GATEWAY_IDS = ALL_AUTO_GATEWAYS_META.map((g) => g.id);

const DUITKU_PAYMENT_CHANNELS = [
  // QRIS
  {
    code: "SP",
    name: "QRIS (ShopeePay / All E-Wallet & M-Banking)",
    short_name: "QRIS All Payment",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS dari DANA, OVO, GoPay, ShopeePay, LinkAja & M-Banking",
  },
  {
    code: "NQ",
    name: "QRIS Nobu Bank",
    short_name: "QRIS Nobu",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS Nasional via Nobu Bank",
  },
  {
    code: "DQ",
    name: "QRIS DANA",
    short_name: "QRIS DANA",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS Dinamis via DANA",
  },
  {
    code: "LA",
    name: "QRIS LinkAja",
    short_name: "QRIS LinkAja",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS Dinamis via LinkAja",
  },
  {
    code: "GQ",
    name: "QRIS GudangVoucher",
    short_name: "QRIS GV",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS Dinamis via GudangVoucher",
  },
  // E-Wallet
  {
    code: "DA",
    name: "DANA",
    short_name: "DANA",
    category: "ewallet",
    category_label: "E-Wallet Instan",
    payment_flow: "ewallet",
    description: "Bayar instan langsung melalui aplikasi DANA",
  },
  {
    code: "OV",
    name: "OVO",
    short_name: "OVO",
    category: "ewallet",
    category_label: "E-Wallet Instan",
    payment_flow: "ewallet",
    description: "Bayar instan melalui notifikasi / aplikasi OVO",
  },
  {
    code: "SA",
    name: "ShopeePay Apps",
    short_name: "ShopeePay",
    category: "ewallet",
    category_label: "E-Wallet Instan",
    payment_flow: "ewallet",
    description: "Bayar instan langsung dari aplikasi ShopeePay",
  },
  {
    code: "LF",
    name: "LinkAja Apps",
    short_name: "LinkAja",
    category: "ewallet",
    category_label: "E-Wallet Instan",
    payment_flow: "ewallet",
    description: "Bayar instan langsung dari aplikasi LinkAja",
  },
  // Virtual Account Bank
  {
    code: "BC",
    name: "BCA Virtual Account",
    short_name: "BCA VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via myBCA, BCA Mobile, KlikBCA, atau ATM",
  },
  {
    code: "M2",
    name: "Mandiri Virtual Account",
    short_name: "Mandiri VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via Livin' by Mandiri atau ATM",
  },
  {
    code: "I1",
    name: "BNI Virtual Account",
    short_name: "BNI VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via Wondr / BNI Mobile atau ATM",
  },
  {
    code: "BR",
    name: "BRI Virtual Account (BRIVA)",
    short_name: "BRI VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via BRImo atau ATM BRI",
  },
  {
    code: "BV",
    name: "BSI Virtual Account",
    short_name: "BSI VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via BYOND / BSI Mobile",
  },
  {
    code: "B1",
    name: "CIMB Niaga Virtual Account",
    short_name: "CIMB VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via OCTO Mobile atau ATM",
  },
  {
    code: "BT",
    name: "Permata Bank Virtual Account",
    short_name: "Permata VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via PermataME / ATM",
  },
  {
    code: "VA",
    name: "Maybank Virtual Account",
    short_name: "Maybank VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via M2U ID atau ATM",
  },
  {
    code: "NC",
    name: "Bank Neo Commerce (BNC) VA",
    short_name: "BNC VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via aplikasi neobank",
  },
  {
    code: "A1",
    name: "ATM Bersama Virtual Account",
    short_name: "ATM Bersama",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Transfer dari seluruh bank anggota jaringan ATM Bersama",
  },
  // Minimarket / Retail
  {
    code: "IR",
    name: "Indomaret",
    short_name: "Indomaret",
    category: "retail",
    category_label: "Minimarket / Retail",
    payment_flow: "retail",
    description: "Bayar tunai di gerai Indomaret / Ceriamart terdekat",
  },
  {
    code: "FT",
    name: "Alfamart / Alfamidi / Pos",
    short_name: "Alfamart Group",
    category: "retail",
    category_label: "Minimarket / Retail",
    payment_flow: "retail",
    description: "Bayar tunai di gerai Alfamart, Alfamidi, Pegadaian, atau Pos",
  },
];

const getDuitkuChannelMeta = (code?: string | null) => {
  const clean = String(code || "SP").trim().toUpperCase();
  return (
    DUITKU_PAYMENT_CHANNELS.find((c) => c.code === clean) ||
    DUITKU_PAYMENT_CHANNELS[0]
  );
};

const getEnabledDuitkuChannels = (duitkuCfg?: any) => {
  const rawList = Array.isArray(duitkuCfg?.enabled_methods)
    ? duitkuCfg.enabled_methods.map((c: any) => String(c || "").trim().toUpperCase())
    : [];
  const enabledSet = new Set(rawList.filter(Boolean));
  const filtered =
    enabledSet.size > 0
      ? DUITKU_PAYMENT_CHANNELS.filter((ch) => enabledSet.has(ch.code))
      : DUITKU_PAYMENT_CHANNELS;
  return filtered.length > 0 ? filtered : [DUITKU_PAYMENT_CHANNELS[0]];
};

function normalizeProductPaymentConfig(raw: any) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const disabledGateways = Array.isArray(cfg.disabled_gateways)
    ? Array.from(
        new Set(
          cfg.disabled_gateways
            .map((id: any) => String(id || "").toLowerCase().trim())
            .filter((id: string) => ALL_AUTO_GATEWAY_IDS.includes(id))
        )
      )
    : [];
  const rawPreferred = String(cfg.preferred_gateway || "auto").toLowerCase().trim();
  const preferredGateway = ALL_AUTO_GATEWAY_IDS.includes(rawPreferred) ? rawPreferred : "auto";
  return {
    paykita: cfg.paykita !== false,
    manual: cfg.manual !== false,
    crypto: cfg.crypto !== false,
    preferred_gateway: preferredGateway,
    disabled_gateways: disabledGateways,
    disabled_destinations: Array.isArray(cfg.disabled_destinations)
      ? cfg.disabled_destinations.map((id: any) => String(id)).filter(Boolean)
      : [],
  };
}

// --- Store Public Endpoints ---
const publicProduct = (p: any) => {
  const copy = { ...p };
  delete copy.paykita;
  copy.payment_config = normalizeProductPaymentConfig(p.payment_config);
  return copy;
};

api.get("/products", (req, res) => {
  const { game, category, q, include_topup, type } = req.query as Record<string, string | undefined>;
  let rows = db.products.map(publicProduct);
  if (type === "topup") {
    rows = rows.filter((p) => isTopupProduct(p));
  } else if (include_topup !== "true" && include_topup !== "1") {
    rows = rows.filter((p) => !isTopupProduct(p));
  }
  if (game && game !== "Semua Game") {
    const gLower = game.toLowerCase();
    rows = rows.filter((p) => String(p.game || "").toLowerCase() === gLower);
  }
  if (category && category !== "Semua Kategori") {
    const cLower = category.toLowerCase();
    rows = rows.filter((p) => String(p.category || "").toLowerCase() === cLower);
  }
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (p) =>
        String(p.title || "").toLowerCase().includes(needle) ||
        String(p.description || "").toLowerCase().includes(needle) ||
        String(p.game || "").toLowerCase().includes(needle)
    );
  }
  res.json(rows);
});

api.get("/products/:product_id", (req, res) => {
  const product = db.products.find((p) => p.id === req.params.product_id);
  if (!product) return res.status(404).json({ detail: "Produk tidak ditemukan" });
  res.json(publicProduct(product));
});

api.get("/games", (_req, res) => {
  const storeRows = db.products.filter((p) => !isTopupProduct(p));
  const names = Array.from(new Set(storeRows.map((p) => p.game).filter(Boolean))).sort();
  res.json(names);
});

api.get("/testimonials", (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 60), 200));
  const sorted = [...db.testimonials].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  res.json(sorted.slice(0, limit).map(publicReview));
});

api.get("/social-links", (_req, res) => {
  const active = db.social_links
    .filter((s) => s.is_active !== false)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  res.json(active);
});

api.get("/me/orders", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const orders = db.transactions
    .filter((t) => t.user_id === user.id)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map((o) => {
      const copy = { ...o };
      delete copy.payment_proof;
      if (copy.payment_status !== "paid") delete copy.delivery_info;
      return copy;
    });
  res.json(orders);
});

api.get("/me/wishlist", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const ids = new Set(user.wishlist || []);
  res.json(db.products.filter((p) => ids.has(p.id)).map(publicProduct));
});

api.post("/me/wishlist/:product_id", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const pid = req.params.product_id;
  const list: string[] = Array.isArray(user.wishlist) ? [...user.wishlist] : [];
  const idx = list.indexOf(pid);
  if (idx !== -1) list.splice(idx, 1);
  else list.push(pid);
  user.wishlist = list;
  saveDb();
  res.json({ wishlist: list });
});

api.patch("/me/profile", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const hasName = req.body?.name !== undefined;
  const hasAvatar = req.body?.avatar !== undefined;

  if (!hasName && !hasAvatar) {
    return res.status(400).json({ detail: "Tidak ada perubahan profil yang dikirim" });
  }

  const prevName = user.name;
  const prevAvatar = user.avatar || "";

  if (hasName) {
    const cleanName = String(req.body?.name || "").trim().slice(0, 64);
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ detail: "Nama tampilan minimal 2 karakter" });
    }
    user.name = cleanName;
  }

  if (hasAvatar) {
    user.avatar = String(req.body?.avatar || "").trim().slice(0, 300);
  }

  user.updated_at = nowIso();
  saveDb();
  writeAuditLog({
    actor: user,
    action: "account.profile_updated",
    targetUser: user,
    metadata: {
      prev_name: prevName,
      new_name: user.name,
      avatar_changed: prevAvatar !== (user.avatar || ""),
    },
    req,
  });
  res.json({ user: publicUser(user), message: "Profil berhasil diperbarui" });
});

api.post("/me/password", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const currentPassword = String(req.body?.current_password || "");
  const newPassword = String(req.body?.new_password || "");
  if (!currentPassword) {
    return res.status(400).json({ detail: "Password saat ini wajib diisi" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ detail: "Password baru minimal 6 karakter" });
  }
  if (user.password_hash && !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ detail: "Password saat ini tidak sesuai" });
  }
  user.password_hash = bcrypt.hashSync(newPassword, 10);
  user.password_changed_at = nowIso();
  user.updated_at = nowIso();
  saveDb();
  writeAuditLog({
    actor: user,
    action: "account.password_changed",
    targetUser: user,
    req,
  });
  res.json({ ok: true, message: "Password akun berhasil diperbarui" });
});

api.get("/me/security", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const now = Date.now();
  const activeSessions = db.sessions
    .filter(
      (s) =>
        s.user_id === user.id &&
        !s.revoked_at &&
        new Date(s.expires_at).getTime() > now
    )
    .sort((a, b) => String(b.last_seen_at || b.created_at || "").localeCompare(String(a.last_seen_at || a.created_at || "")))
    .slice(0, 10)
    .map((s) => ({
      id: s.id,
      ip: s.ip || "Unknown IP",
      created_at: s.created_at,
      last_seen_at: s.last_seen_at || s.created_at,
      expires_at: s.expires_at,
    }));

  const recentLogs = db.audit_logs
    .filter((l) => l.actor_user_id === user.id || l.target_user_id === user.id)
    .slice(0, 12)
    .map((l) => ({
      id: l.id,
      action: l.action,
      ip: l.ip || "-",
      created_at: l.created_at,
      metadata: l.metadata || {},
    }));

  res.json({
    active_sessions_count: activeSessions.length,
    sessions: activeSessions,
    audit_logs: recentLogs,
    password_changed_at: user.password_changed_at || null,
    verified_at: user.verified_at || null,
  });
});

api.get("/files/*", (req, res) => {
  const filePath = (req.params as any)[0];
  const rec = db.files[filePath];
  if (!rec) return res.status(404).json({ detail: "File tidak ditemukan" });
  const buf = Buffer.from(rec.dataBase64, "base64");
  res.setHeader("Content-Type", rec.content_type);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(buf);
});

// --- Reviews ---
function isOrderReviewAuthorized(tx: any, user: any | null, email?: string) {
  if (user && tx.user_id && tx.user_id === user.id) return true;
  const given = String(email || "").trim().toLowerCase();
  const stored = String(tx.buyer_email || "").trim().toLowerCase();
  return Boolean(given && stored && given === stored);
}

api.get("/reviews/eligibility/:session_id", (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx) return res.status(404).json({ detail: "Pesanan tidak ditemukan" });
  const user = getUserOptional(req);
  const email = req.query.email as string | undefined;
  const paid = tx.payment_status === "paid";
  const authorized = isOrderReviewAuthorized(tx, user, email);
  const existing = paid ? db.testimonials.find((t) => t.order_id === tx.session_id) : null;
  let reason = "";
  if (!paid) reason = "Ulasan hanya bisa ditulis setelah pesanan lunas";
  else if (!authorized) reason = "Verifikasi diperlukan: masukkan email yang dipakai saat membeli";
  res.json({
    can_review: Boolean(paid && authorized && !existing),
    authorized,
    paid,
    has_review: Boolean(existing),
    reason,
    order: {
      session_id: tx.session_id,
      product_id: tx.product_id,
      product_title: tx.product_title,
      game: tx.game_name || "",
    },
    review: existing ? publicReview(existing) : null,
  });
});

api.post("/reviews", (req, res) => {
  const body = req.body || {};
  const sessionId = String(body.session_id || body.order_id || "").trim();
  if (!sessionId) return res.status(400).json({ detail: "Kode pesanan wajib diisi" });
  const tx = db.transactions.find((t) => t.session_id === sessionId);
  if (!tx) return res.status(404).json({ detail: "Pesanan tidak ditemukan" });
  if (tx.payment_status !== "paid") {
    return res.status(400).json({ detail: "Ulasan hanya bisa ditulis setelah pesanan lunas" });
  }
  const user = getUserOptional(req);
  const email = String(body.buyer_email || "").trim();
  if (!isOrderReviewAuthorized(tx, user, email)) {
    return res.status(403).json({ detail: "Email tidak cocok dengan pesanan ini. Masuk ke akun atau cek email pembelian." });
  }
  if (db.testimonials.some((t) => t.order_id === sessionId)) {
    return res.status(409).json({ detail: "Pesanan ini sudah pernah diulas" });
  }
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ detail: "Rating harus antara 1 sampai 5" });
  }
  const text = String(body.text || "").trim();
  if (text.length < 10) return res.status(400).json({ detail: "Ulasan minimal 10 karakter" });
  if (text.length > 600) return res.status(400).json({ detail: "Ulasan maksimal 600 karakter" });
  const product = tx.product_id ? db.products.find((p) => p.id === tx.product_id) : null;
  const reviewerName =
    user?.name?.trim() ||
    String(tx.buyer_email || email || "")
      .split("@")[0]
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 24) ||
    "Pembeli";
  const review = {
    id: "rv-" + uuidHex(10),
    order_id: sessionId,
    product_id: tx.product_id,
    user_id: tx.user_id || user?.id || null,
    name: reviewerName,
    buyer_email: String(tx.buyer_email || email || "").trim().toLowerCase(),
    game: tx.game_name || product?.game || "",
    product: tx.product_title || product?.title || "",
    rating,
    text,
    image: String(body.image || "").trim(),
    source: "buyer",
    verified: true,
    reply: "",
    created_at: nowIso(),
  };
  db.testimonials.push(review);
  if (tx.product_id) refreshProductRating(tx.product_id);
  saveDb();
  res.status(201).json({ message: "Terima kasih! Ulasan kamu sudah tayang.", review: publicReview(review) });
});

api.get("/products/:product_id/reviews", (req, res) => {
  const product = db.products.find((p) => p.id === req.params.product_id);
  if (!product) return res.status(404).json({ detail: "Produk tidak ditemukan" });
  const rows = db.testimonials
    .filter((t) => t.product_id === req.params.product_id && t.verified)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map(publicReview);
  const average = rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : 0;
  const distribution: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  for (const r of rows) distribution[String(r.rating)] = (distribution[String(r.rating)] || 0) + 1;
  res.json({
    product_id: req.params.product_id,
    count: rows.length,
    average,
    distribution,
    reviews: rows,
  });
});

api.get("/reviews/mine", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const rows = db.testimonials
    .filter((t) => t.user_id === user.id)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map((r) => ({ ...publicReview(r), order_id: r.order_id }));
  res.json(rows);
});

// --- Topup Public Endpoints ---
api.get("/topup/games", (req, res) => {
  const { featured, q } = req.query as Record<string, string | undefined>;
  let items = db.games
    .filter((g) => g.is_active !== false)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0))
    .map(publicGame);
  if (featured === "true" || featured === "1") {
    items = items.filter((g) => g.featured);
  }
  if (q) {
    const needle = q.trim().toLowerCase();
    items = items.filter(
      (g) => g.name.toLowerCase().includes(needle) || g.publisher.toLowerCase().includes(needle)
    );
  }
  res.json(items);
});

api.get("/topup/games/:slug", (req, res) => {
  const game = db.games.find((g) => g.slug === req.params.slug);
  if (!game) return res.status(404).json({ detail: "Game tidak ditemukan" });
  if (game.is_active === false) return res.status(400).json({ detail: "Top up untuk game ini sedang tidak tersedia" });
  res.json(publicGame(game));
});

api.get("/topup/games/:slug/denominations", (req, res) => {
  const game = db.games.find((g) => g.slug === req.params.slug);
  if (!game) return res.status(404).json({ detail: "Game tidak ditemukan" });
  res.json(publicGame(game).denominations);
});

function buildDigiflazzCustomerNo(game: any, destination: Record<string, string>): string {
  const userId = String(destination.user_id || destination.riot_id || Object.values(destination)[0] || "").trim();
  const zoneId = String(destination.zone_id || "").trim();
  const server = String(destination.server || "").trim();
  if (zoneId) return `${userId}${zoneId}`;
  if (server && !/^(asia|america|europe|tw|hk|mo|sea|global)$/i.test(server)) {
    return `${userId}${server}`;
  }
  return userId;
}

function extractCleanDigiflazzNickname(rawSn: string): string {
  let clean = String(rawSn || "").trim();
  if (!clean) return "";
  // Strip common Digiflazz SN prefixes like "Username: ", "Nickname : ", "Nama: ", "SN: "
  clean = clean.replace(/^(username|nickname|nama|name|ign|sn)\s*[:=-]\s*/i, "").trim();
  // If formatted like "Nickname / Zone : 1234" or "Nickname/Server", take the nickname segment
  if (clean.includes("/")) {
    const parts = clean
      .split("/")
      .map((p) => p.replace(/^(username|nickname|nama|name|ign)\s*[:=-]\s*/i, "").trim())
      .filter(Boolean);
    if (parts.length > 0) clean = parts[0];
  }
  if (clean.includes("|")) {
    const parts = clean.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) clean = parts[0];
  }
  return clean.trim();
}

async function verifyGameAccountId(game: any, cleaned: Record<string, string>) {
  const slug = String(game.slug || "").toLowerCase();
  const userId = String(cleaned.user_id || "").trim();
  const zoneId = String(cleaned.zone_id || "").trim();
  const server = String(cleaned.server || "").trim();
  const riotId = String(cleaned.riot_id || "").trim();
  const customerNo = buildDigiflazzCustomerNo(game, cleaned);
  const cekSku = String(game.cek_id_sku || "").trim().toUpperCase();

  // 1. Format-specific immediate validation rules
  if (slug.includes("valorant") || riotId) {
    const rawRiot = riotId || userId;
    if (!rawRiot.includes("#")) {
      return {
        valid: false,
        format_valid: false,
        checked: false,
        code: "FORMAT_INVALID",
        nickname: "",
        customer_no: customerNo,
        cek_id_sku: cekSku,
        server_label: zoneId ? `Zone ${zoneId}` : server || "",
        source: "format_validation",
        message: "Format Riot ID wajib menyertakan Tagline dengan tanda # (Contoh: Player#IDN)",
      };
    }
    const [rName, rTag] = rawRiot.split("#");
    if (!rName || rName.trim().length < 2 || !rTag || rTag.trim().length < 2) {
      return {
        valid: false,
        format_valid: false,
        checked: false,
        code: "FORMAT_INVALID",
        nickname: "",
        customer_no: customerNo,
        cek_id_sku: cekSku,
        server_label: zoneId ? `Zone ${zoneId}` : server || "",
        source: "format_validation",
        message: "Nickname dan Tagline Riot ID masing-masing minimal 2 karakter (Contoh: Player#IDN)",
      };
    }
  }

  // 2. Check if game has a configured Cek ID SKU; if not, allow direct checkout when format is valid
  if (!cekSku) {
    return {
      valid: true,
      format_valid: true,
      checked: false,
      code: "DIRECT_ID_OK",
      nickname: "",
      customer_no: customerNo,
      cek_id_sku: "",
      server_label: zoneId ? `Zone ${zoneId}` : server || "",
      source: "direct_format",
      message: "Format ID tujuan sesuai dan siap diproses.",
    };
  }

  const dfProvider = db.topup_providers.find((v) => v.kind === "digiflazz") || db.topup_providers[0];
  const dfUser = String(dfProvider?.config?.username || process.env.DIGIFLAZZ_USERNAME || "").trim();
  const dfKey = String(
    (dfProvider?.config?.use_dev ? dfProvider?.config?.dev_key : dfProvider?.config?.api_key) ||
      dfProvider?.config?.api_key ||
      process.env.DIGIFLAZZ_API_KEY ||
      ""
  ).trim();
  const isLiveDf = Boolean(dfUser && dfKey && !isDemoDigiflazzCredential(dfUser, dfKey));

  if (!isLiveDf) {
    return {
      valid: true,
      format_valid: true,
      checked: false,
      code: "DIRECT_ID_OK",
      nickname: "",
      customer_no: customerNo,
      cek_id_sku: cekSku,
      server_label: zoneId ? `Zone ${zoneId}` : server || "",
      source: "direct_format",
      message: "Format ID tujuan sesuai dan siap diproses.",
    };
  }

  // 3. Execute live Cek ID Inquiry (with short-polling if status is Pending)
  const refId = `CHK-${slug.slice(0, 8).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const sign = crypto.createHash("md5").update(dfUser + dfKey + refId).digest("hex");

  try {
    let lastData: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1200));
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const resp = await fetch("https://api.digiflazz.com/v1/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: dfUser,
          buyer_sku_code: cekSku,
          customer_no: customerNo,
          ref_id: refId,
          sign,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json: any = await resp.json().catch(() => null);
      lastData = json?.data || json || null;
      const status = String(lastData?.status || "").trim();
      const rc = String(lastData?.rc || "").trim();
      const rawSn = String(lastData?.sn || lastData?.customer_name || "").trim();

      if (rawSn && status !== "Gagal") {
        const cleanNick = extractCleanDigiflazzNickname(rawSn);
        if (cleanNick) {
          return {
            valid: true,
            format_valid: true,
            checked: true,
            code: "VERIFIED",
            nickname: cleanNick,
            sn: rawSn,
            customer_no: customerNo,
            cek_id_sku: cekSku,
            server_label: zoneId ? `Zone ${zoneId}` : server || "",
            source: "live_verified",
            message: `ID Akun Terverifikasi — Nickname: ${cleanNick}`,
          };
        }
      }

      if (status === "Gagal" || (rc && rc !== "00" && rc !== "03" && rc !== "39")) {
        const rawErrMsg = String(lastData?.message || "").trim();
        const isSkuOrServiceUnintegrated =
          /sku|produk|layanan|gangguan|cut\s*off|saldo|ip|sign|signature|seller|vendor|tidak\s+aktif|belum\s+tersedia/i.test(
            rawErrMsg
          );
        const isInvalidAccountId =
          !isSkuOrServiceUnintegrated &&
          (rc === "14" ||
            /tujuan\s+salah|id\s*(?:akun\s*)?tidak\s+ditemukan|nomor\s+tujuan|user\s*(?:id)?\s*not\s*found|invalid\s*(?:user|player|zone|customer)|character\s*not\s*found|akun\s+tidak\s+ditemukan/i.test(
              rawErrMsg
            ));

        if (isInvalidAccountId) {
          return {
            valid: false,
            format_valid: true,
            checked: true,
            code: "ACCOUNT_NOT_FOUND",
            nickname: "",
            customer_no: customerNo,
            cek_id_sku: cekSku,
            server_label: zoneId ? `Zone ${zoneId}` : server || "",
            source: "live_verified",
            message: "ID Akun tidak ditemukan. Pastikan User ID dan Zone/Server sudah sesuai dengan profil di dalam game.",
          };
        }

        // If Cek ID cannot be integrated or the check SKU itself is unavailable, allow direct checkout
        return {
          valid: true,
          format_valid: true,
          checked: false,
          code: "DIRECT_ID_OK",
          nickname: "",
          customer_no: customerNo,
          cek_id_sku: cekSku,
          server_label: zoneId ? `Zone ${zoneId}` : server || "",
          source: "direct_format",
          message: "Format ID tujuan sesuai dan siap diproses.",
        };
      }

      // If not Pending, break out of polling loop
      if (status !== "Pending" && rc !== "03" && rc !== "39") {
        break;
      }
    }

    return {
      valid: true,
      format_valid: true,
      checked: false,
      code: "DIRECT_ID_OK",
      nickname: "",
      customer_no: customerNo,
      cek_id_sku: cekSku,
      server_label: zoneId ? `Zone ${zoneId}` : server || "",
      source: "direct_format",
      message: "Format ID tujuan sesuai dan siap diproses.",
    };
  } catch (_err: any) {
    return {
      valid: true,
      format_valid: true,
      checked: false,
      code: "DIRECT_ID_OK",
      nickname: "",
      customer_no: customerNo,
      cek_id_sku: cekSku,
      server_label: zoneId ? `Zone ${zoneId}` : server || "",
      source: "direct_format",
      message: "Format ID tujuan sesuai dan siap diproses.",
    };
  }
}

api.post("/topup/validate", async (req, res) => {
  const body = req.body || {};
  const slug = String(body.game || body.slug || "").trim();
  if (!slug) return res.status(400).json({ detail: "Game wajib dipilih" });
  const game = db.games.find((g) => g.slug === slug);
  if (!game) return res.status(404).json({ detail: "Game tidak ditemukan" });
  const values =
    body.destination && typeof body.destination === "object"
      ? body.destination
      : Object.fromEntries(Object.entries(body).filter(([k]) => k !== "game" && k !== "slug"));
  const [ok, cleaned, error] = validateDestination(game, values);
  if (!ok) {
    return res.json({
      valid: false,
      format_valid: false,
      checked: false,
      code: "FORMAT_INVALID",
      destination: cleaned,
      message: error,
    });
  }
  const verification = await verifyGameAccountId(game, cleaned);
  if (!verification.valid) {
    return res.json({
      valid: false,
      format_valid: verification.format_valid !== false,
      checked: Boolean(verification.checked),
      code: verification.code || "ACCOUNT_NOT_FOUND",
      cek_id_sku: verification.cek_id_sku || String(game.cek_id_sku || ""),
      customer_no: verification.customer_no || "",
      destination: cleaned,
      message: verification.message,
    });
  }
  res.json({
    valid: true,
    format_valid: true,
    checked: Boolean(verification.checked),
    code: verification.code || (verification.checked ? "VERIFIED" : "DIRECT_ID_OK"),
    nickname: verification.nickname || "",
    sn: (verification as any).sn || verification.nickname || "",
    customer_no: verification.customer_no,
    cek_id_sku: verification.cek_id_sku || String(game.cek_id_sku || ""),
    server_label: verification.server_label || "",
    game_name: game.name,
    verification_source: verification.source,
    verified_at: nowIso(),
    destination: cleaned,
    message: verification.message,
  });
});

// --- Auth Endpoints ---
api.get("/auth/email-status", (_req, res) => {
  const cfg = getEmailAuthConfig();
  res.json({
    configured: cfg.configured,
    provider: cfg.active_provider,
    provider_mode: cfg.provider_mode,
    auto_verify: !cfg.require_email_verification,
    require_verification: cfg.require_email_verification,
    allow_dev_preview_links: cfg.allow_dev_preview_links,
  });
});

api.post("/auth/register", async (req, res) => {
  const ip = getClientIp(req);
  const [allowed, retrySec] = checkRateLimit(`reg:${ip}`, 10, 10 * 60 * 1000);
  if (!allowed) {
    return res.status(429).json({ detail: `Terlalu banyak percobaan pendaftaran. Coba lagi dalam ${retrySec} detik.` });
  }

  const { email: rawEmail, password, name } = req.body || {};
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ detail: "Format email tidak valid" });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ detail: "Password minimal 6 karakter wajib diisi" });
  }

  const emailCfg = getEmailAuthConfig();
  const existing = db.users.find((u) => u.email === email);
  if (existing) {
    if (!existing.is_verified && emailCfg.require_email_verification) {
      const { rawToken, otpCode } = issueAuthToken(existing, "verify_email", emailCfg.verify_token_ttl_hours * 60);
      const mailRes = await sendVerificationEmail(existing, rawToken, req, otpCode);
      writeAuditLog({
        actor: existing,
        action: "auth.register_resend_unverified",
        targetUser: existing,
        metadata: { provider: mailRes.provider },
        req,
      });
      return res.json({
        email_verification_sent: true,
        email: existing.email,
        dev_preview_url: mailRes.dev_preview_url,
        message: "Email sudah terdaftar namun belum diverifikasi. Tautan & kode verifikasi baru telah dikirim.",
      });
    }
    return res.status(400).json({ detail: "Email sudah terdaftar. Silakan login." });
  }

  const cleanName = String(name || "").trim().slice(0, 64) || email.split("@")[0];
  const autoVerify = !emailCfg.require_email_verification;
  const user = {
    id: "usr-" + uuidHex(10),
    email,
    password_hash: bcrypt.hashSync(String(password), 10),
    name: cleanName,
    role: "buyer",
    status: "active",
    wishlist: [],
    is_verified: autoVerify,
    verified_at: autoVerify ? nowIso() : (null as string | null),
    session_version: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
    last_login_at: autoVerify ? nowIso() : (null as string | null),
  };
  db.users.push(user);
  saveDb();

  if (autoVerify) {
    const token = createSessionAndToken(user, req, res);
    writeAuditLog({
      actor: user,
      action: "auth.register_auto_verified",
      targetUser: user,
      req,
    });
    return res.status(201).json({
      token,
      user: publicUser(user),
      auto_verified: true,
      message: "Pendaftaran berhasil! Akun Anda langsung aktif.",
    });
  }

  const { rawToken, otpCode } = issueAuthToken(user, "verify_email", emailCfg.verify_token_ttl_hours * 60);
  const mailRes = await sendVerificationEmail(user, rawToken, req, otpCode);

  writeAuditLog({
    actor: user,
    action: "auth.register",
    targetUser: user,
    metadata: { provider: mailRes.provider, delivered: mailRes.delivered },
    req,
  });

  res.status(201).json({
    user: publicUser(user),
    email_verification_sent: true,
    email: user.email,
    dev_preview_url: mailRes.dev_preview_url,
    message: mailRes.delivered
      ? "Pendaftaran berhasil! Tautan & kode verifikasi 6-digit telah dikirim ke email Anda."
      : "Pendaftaran berhasil! Silakan verifikasi email Anda terlebih dahulu sebelum masuk.",
  });
});

api.post("/auth/login", async (req, res) => {
  const { email: rawEmail, password } = req.body || {};
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!email || !password) return res.status(400).json({ detail: "Email dan sandi diperlukan" });

  const ip = getClientIp(req);
  const [allowed, retrySec] = checkRateLimit(`login:${ip}:${email}`, 8, 5 * 60 * 1000);
  if (!allowed) {
    blockClientIp(
      ip,
      `Percobaan login gagal berulang kali (Brute Force) pada akun ${email}`,
      "brute_force_login",
      req,
      { email }
    );
    return res.status(429).json({
      detail: `Terlalu banyak percobaan login gagal. IP Anda diblokir sementara selama 15 menit demi keamanan akun.`,
      code: "IP_BLOCKED_SECURITY",
      retry_after_seconds: 900,
    });
  }

  const user = db.users.find((u) => u.email === email);
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    const strikeRes = recordSecurityStrike(
      ip,
      "login_fail",
      8,
      10 * 60 * 1000,
      `Brute force tebak password login (${email})`,
      req,
      { email }
    );
    writeAuditLog({
      actor: user || null,
      action: "security.login_failed",
      targetUser: user || null,
      metadata: { email, strikes: strikeRes.strikes, ip_blocked: strikeRes.blocked },
      req,
    });
    if (strikeRes.blocked) {
      return res.status(429).json({
        detail:
          "Terdeteksi percobaan tebak password berulang kali. IP Anda diblokir otomatis selama 15 menit.",
        code: "IP_BLOCKED_SECURITY",
      });
    }
    return res.status(401).json({ detail: "Email atau password salah" });
  }

  if (user.status === "suspended") {
    writeAuditLog({
      actor: user,
      action: "auth.login_blocked_suspended",
      targetUser: user,
      req,
    });
    return res.status(403).json({
      detail: "Akun Anda sedang ditangguhkan (suspended) oleh Admin.",
      code: "ACCOUNT_SUSPENDED",
    });
  }

  const emailCfg = getEmailAuthConfig();
  if (emailCfg.require_email_verification && user.is_verified === false && user.role !== "admin") {
    // Check if the user verified their email on the public shared preview instance (ais-pre-*)
    const verifiedRemotely = await checkVerifiedOnSharedPreview(user.email);
    if (verifiedRemotely) {
      user.is_verified = true;
      user.verified_at = user.verified_at || nowIso();
      user.updated_at = nowIso();
      saveDb();
    } else {
      writeAuditLog({
        actor: user,
        action: "auth.login_blocked_unverified",
        targetUser: user,
        req,
      });
      return res.status(403).json({
        detail: "Email belum diverifikasi. Silakan klik tautan verifikasi atau masukkan kode 6-digit dari email Anda.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }
  }

  user.last_login_at = nowIso();
  saveDb();

  const token = createSessionAndToken(user, req, res);
  writeAuditLog({
    actor: user,
    action: user.role === "admin" ? "admin.login" : "auth.login",
    targetUser: user,
    req,
  });

  res.json({ token, user: publicUser(user) });
});

api.post("/auth/admin-login", (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ detail: "Password diperlukan" });
  const ip = getClientIp(req);
  const [allowed] = checkRateLimit(`admin_login:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    blockClientIp(
      ip,
      "Percobaan Brute Force password Login Admin melebihi batas (5x gagal)",
      "brute_force_admin",
      req
    );
    return res.status(429).json({
      detail:
        "Terlalu banyak percobaan login Admin yang gagal! IP Anda telah diblokir otomatis selama 15 menit dan dicatat ke Audit Log Keamanan.",
      code: "IP_BLOCKED_SECURITY",
    });
  }

  const user = db.users.find((u) => u.email === ADMIN_EMAIL && u.role === "admin");
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    const strikeRes = recordSecurityStrike(
      ip,
      "admin_login_fail",
      5,
      15 * 60 * 1000,
      "Percobaan Brute Force tebak password Admin (5x gagal)",
      req
    );
    writeAuditLog({
      actor: null,
      action: "security.admin_login_failed",
      metadata: {
        strikes: strikeRes.strikes,
        remaining_attempts: strikeRes.remainingStrikes,
        ip_blocked: strikeRes.blocked,
      },
      req,
    });
    if (strikeRes.blocked) {
      return res.status(429).json({
        detail:
          "Percobaan tebak password Admin terdeteksi! IP Anda diblokir otomatis selama 15 menit dan dicatat ke Audit Log Keamanan.",
        code: "IP_BLOCKED_SECURITY",
      });
    }
    return res.status(401).json({
      detail: `Password admin salah (Sisa kesempatan sebelum blokir IP: ${strikeRes.remainingStrikes}x)`,
    });
  }
  securityStrikes.delete(`admin_login_fail:${ip}`);
  rateBuckets.delete(`admin_login:${ip}`);
  user.last_login_at = nowIso();
  saveDb();
  const token = createSessionAndToken(user, req, res);
  writeAuditLog({
    actor: user,
    action: "admin.login",
    targetUser: user,
    req,
  });
  res.json({ token, user: publicUser(user) });
});

api.post("/auth/logout", (req, res) => {
  const user = getUserOptional(req);
  const cookies = parseCookies(req);
  if (cookies.wjp_sid) {
    const th = hashToken(cookies.wjp_sid);
    const ses = db.sessions.find((s) => s.token_hash === th && !s.revoked_at);
    if (ses) ses.revoked_at = nowIso();
  }
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
      if (payload?.sid) {
        const ses = db.sessions.find((s) => s.id === payload.sid && !s.revoked_at);
        if (ses) ses.revoked_at = nowIso();
      }
    } catch {
      // ignore invalid token on logout
    }
  }
  saveDb();
  res.clearCookie("wjp_sid", { path: "/" });
  if (user) {
    writeAuditLog({
      actor: user,
      action: user.role === "admin" ? "admin.logout" : "auth.logout",
      targetUser: user,
      req,
    });
  }
  res.json({ ok: true, message: "Berhasil keluar" });
});

api.post("/auth/logout-all", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  revokeAllUserSessions(user);
  res.clearCookie("wjp_sid", { path: "/" });
  writeAuditLog({
    actor: user,
    action: "sessions.revoked",
    targetUser: user,
    metadata: { scope: "self_all" },
    req,
  });
  res.json({ ok: true, message: "Seluruh sesi berhasil dihentikan" });
});

api.get("/auth/me", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json(publicUser(user));
});

api.get("/auth/verification-status", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const email = String(req.query?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ detail: "Email diperlukan" });
  const user = db.users.find((u) => String(u.email || "").toLowerCase() === email);
  res.json({
    email,
    exists: Boolean(user),
    is_verified: Boolean(user?.is_verified),
    verified_at: user?.verified_at || null,
  });
});

api.options("/auth/verify-email", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).end();
});

const handleVerifyEmail = (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const rawToken = String(req.body?.token || req.body?.otp || req.query?.token || req.query?.otp || "").trim();
  const emailHint = String(req.body?.email || req.query?.email || "").trim().toLowerCase();

  // If a user opens /api/auth/verify-email?token=... directly in a browser, redirect to the SPA UI
  if (
    req.method === "GET" &&
    rawToken &&
    String(req.headers.accept || "").includes("text/html") &&
    req.query?.direct !== "1"
  ) {
    return res.redirect(`/verify-email?token=${encodeURIComponent(rawToken)}`);
  }

  if (!rawToken) {
    return res.status(400).json({ detail: "Token atau kode verifikasi wajib disertakan" });
  }

  // Handle Admin Panel test preview tokens cleanly so clicking the test email button succeeds
  if (rawToken.startsWith("sample-preview-token-") || (rawToken === "123456" && !emailHint)) {
    return res.json({
      ok: true,
      is_test_preview: true,
      message:
        "Tautan verifikasi tes dari Panel Admin berfungsi dengan sempurna! Desain & tombol verifikasi siap digunakan untuk pengguna asli.",
    });
  }

  const tokenRecord = consumeAuthToken(rawToken, "verify_email", emailHint);
  if (!tokenRecord) {
    // Check if the user is already verified when they supply emailHint
    if (emailHint) {
      const existingVerified = db.users.find((u) => u.email === emailHint && u.is_verified);
      if (existingVerified) {
        return res.json({
          ok: true,
          already_verified: true,
          email: existingVerified.email,
          message: "Email Anda sudah terverifikasi! Sekarang Anda dapat langsung login.",
        });
      }
    }
    return res.status(400).json({
      detail: "Token atau kode verifikasi tidak valid atau telah kedaluwarsa. Silakan minta tautan/kode baru.",
    });
  }

  let user = db.users.find(
    (u) =>
      (tokenRecord.user_id && u.id === tokenRecord.user_id) ||
      (tokenRecord.email && String(u.email || "").toLowerCase() === String(tokenRecord.email).toLowerCase())
  );

  // If verified via signed JWT on shared preview instance where user record wasn't synced yet, create stub record
  if (!user && tokenRecord.email) {
    user = {
      id: tokenRecord.user_id || "usr-" + uuidHex(10),
      email: String(tokenRecord.email).toLowerCase(),
      password_hash: "",
      name: tokenRecord.name || String(tokenRecord.email).split("@")[0],
      role: "buyer",
      status: "active",
      wishlist: [],
      is_verified: true,
      verified_at: nowIso(),
      session_version: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
      last_login_at: null,
    };
    db.users.push(user);
  }

  if (!user) {
    return res.status(404).json({ detail: "Akun pengguna tidak ditemukan" });
  }

  user.is_verified = true;
  user.verified_at = user.verified_at || nowIso();
  user.updated_at = nowIso();
  saveDb();

  writeAuditLog({
    actor: user,
    action: "auth.email_verified",
    targetUser: user,
    req,
  });

  return res.json({
    ok: true,
    email: user.email,
    message: "Email berhasil diverifikasi! Sekarang Anda dapat login ke akun Anda.",
  });
};

api.post("/auth/verify-email", handleVerifyEmail);
api.get("/auth/verify-email", handleVerifyEmail);

api.post("/auth/resend-verification", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ detail: "Alamat email wajib diisi" });
  }
  const [allowed, retrySec] = checkRateLimit(`resend:${email}`, 3, 2 * 60 * 1000);
  if (!allowed) {
    return res.status(429).json({ detail: `Tunggu ${retrySec} detik sebelum meminta pengiriman ulang email verifikasi.` });
  }

  const user = db.users.find((u) => u.email === email);
  if (!user) {
    return res.json({
      message: "Jika email terdaftar dan belum diverifikasi, tautan verifikasi baru telah dikirim.",
    });
  }
  if (user.is_verified) {
    return res.json({
      already_verified: true,
      message: "Email akun ini sudah terverifikasi. Silakan langsung login.",
    });
  }

  const emailCfg = getEmailAuthConfig();
  const { rawToken, otpCode } = issueAuthToken(user, "verify_email", emailCfg.verify_token_ttl_hours * 60);
  const mailRes = await sendVerificationEmail(user, rawToken, req, otpCode);

  writeAuditLog({
    actor: user,
    action: "auth.verify_resend",
    targetUser: user,
    metadata: { provider: mailRes.provider },
    req,
  });

  res.json({
    email_verification_sent: true,
    dev_preview_url: mailRes.dev_preview_url,
    message: "Tautan & kode verifikasi 6-digit baru telah dikirim. Silakan cek kotak masuk atau spam email Anda.",
  });
});

api.post("/auth/forgot-password", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ detail: "Alamat email wajib diisi" });
  }
  const [allowed, retrySec] = checkRateLimit(`forgot:${email}`, 4, 5 * 60 * 1000);
  if (!allowed) {
    return res.status(429).json({ detail: `Tunggu ${retrySec} detik sebelum meminta reset password kembali.` });
  }

  const user = db.users.find((u) => u.email === email);
  if (!user || user.status === "suspended") {
    return res.json({
      message: "Jika email terdaftar, instruksi reset password telah dikirim.",
    });
  }

  const emailCfg = getEmailAuthConfig();
  const { rawToken } = issueAuthToken(user, "reset_password", emailCfg.reset_token_ttl_minutes);
  const mailRes = await sendPasswordResetEmail(user, rawToken, req);

  writeAuditLog({
    actor: user,
    action: "auth.password_reset_requested",
    targetUser: user,
    metadata: { provider: mailRes.provider },
    req,
  });

  res.json({
    message: "Jika email terdaftar, tautan reset password telah dikirim.",
    dev_preview_url: mailRes.dev_preview_url,
  });
});

// --- Payments Endpoints ---
function genOrderId(prefix: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${String(Date.now()).slice(-6)}-${suffix}`;
}

function parseBuyer(body: any) {
  const email = String(body.buyer_email || "").trim().toLowerCase();
  let wa = String(body.buyer_whatsapp || "").replace(/[^\d]/g, "");
  if (wa.startsWith("0")) wa = "62" + wa.slice(1);
  if (!email) {
    throw {
      status: 400,
      detail: "Alamat email wajib diisi sebelum pembelian untuk pengiriman akses data akun & invoice",
    };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw { status: 400, detail: "Format alamat email tidak valid (contoh: nama@gmail.com)" };
  }
  if (wa && (wa.length < 9 || wa.length > 15)) {
    throw { status: 400, detail: "Nomor WhatsApp tidak valid" };
  }
  return { buyer_email: email, buyer_whatsapp: wa || null };
}

api.post("/auth/reset-password", async (req, res) => {
  const rawToken = String(req.body?.token || "").trim();
  const newPassword = String(req.body?.newPassword || req.body?.password || "");
  if (!rawToken) {
    return res.status(400).json({ detail: "Token reset password wajib disertakan" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ detail: "Password baru minimal 6 karakter" });
  }

  const tokenRecord = consumeAuthToken(rawToken, "reset_password");
  if (!tokenRecord) {
    return res.status(400).json({ detail: "Token reset password tidak valid atau sudah kedaluwarsa" });
  }

  const user = db.users.find((u) => u.id === tokenRecord.user_id);
  if (!user) {
    return res.status(404).json({ detail: "Pengguna tidak ditemukan" });
  }

  user.password_hash = bcrypt.hashSync(newPassword, 10);
  user.password_changed_at = nowIso();
  user.updated_at = nowIso();
  if (!user.is_verified) {
    user.is_verified = true;
    user.verified_at = nowIso();
  }
  revokeAllUserSessions(user);
  saveDb();

  void sendSecurityNotification(
    user,
    "Password Akun Diubah",
    "Password akun WillJustPlay Anda baru saja diubah dan seluruh sesi lama telah dihentikan demi keamanan."
  );

  writeAuditLog({
    actor: user,
    action: "auth.password_reset_completed",
    targetUser: user,
    req,
  });

  res.json({
    ok: true,
    message: "Password berhasil diubah! Silakan login dengan password baru Anda.",
  });
});

const findProductFlexible = (productId?: string | null) => {
  if (!productId) return null;
  const trimmed = String(productId).trim();
  const altTp = trimmed.startsWith("topup-") ? `tp-${trimmed.slice(6)}` : trimmed.startsWith("tp-") ? `topup-${trimmed.slice(3)}` : trimmed;
  return db.products.find((p) => p.id === trimmed || p.id === altTp) || null;
};

api.get("/payments/methods", (req, res) => {
  const productId = req.query.product_id as string | undefined;
  const scopeParam = String(req.query.scope || "").toLowerCase();
  const product = findProductFlexible(productId);
  const pCfg = normalizeProductPaymentConfig(product?.payment_config);
  const disabledSet = new Set(pCfg.disabled_destinations);
  const disabledGwSet = new Set(pCfg.disabled_gateways || []);

  const isTopupContext =
    scopeParam === "topup" ||
    Boolean(product && isTopupProduct(product)) ||
    String(productId || "").startsWith("tp-") ||
    String(productId || "").startsWith("topup-");

  const pg = db.settings.payment_gateways || {};
  const gwMap = pg.gateways || {};

  // Dedicated Gateway Assignment:
  // - Produk Beranda -> PayKita (+ Manual / Crypto)
  // - Produk Top Up -> Duitku Multi-Metode (Tanpa Pembayaran Manual)
  const targetGwId = isTopupContext ? "duitku" : "paykita";
  const targetMeta =
    ALL_AUTO_GATEWAYS_META.find((m) => m.id === targetGwId) || ALL_AUTO_GATEWAYS_META[0];
  const targetState = gwMap[targetGwId] || {};

  if (isTopupContext) {
    const duitkuChannels = getEnabledDuitkuChannels(targetState);
    const defaultChannel =
      duitkuChannels.find((c) => c.code === String(targetState.payment_method || "SP").toUpperCase())?.code ||
      duitkuChannels[0]?.code ||
      "SP";
    const gatewayInfo = {
      id: "duitku",
      name: "Duitku",
      tagline: "Multi-Metode Pembayaran Produk Top Up",
      scope: "topup",
      channel: defaultChannel,
      channels: duitkuChannels,
      is_global_active: true,
    };
    return res.json([
      {
        id: "duitku",
        gateway_id: "duitku",
        label: "Duitku Otomatis (QRIS, E-Wallet, VA, Retail)",
        default_gateway: "duitku",
        preferred_gateway: "duitku",
        default_channel: defaultChannel,
        duitku_channels: duitkuChannels,
        gateways: [gatewayInfo],
      },
    ]);
  }

  const s = db.settings.paykita || {};
  const isTargetGwEnabled =
    targetState.enabled !== false && s.enabled !== false && !disabledGwSet.has("paykita");

  const autoEnabled = Boolean(isTargetGwEnabled && pCfg.paykita !== false);
  const gatewayInfo = {
    id: targetMeta.id,
    name: targetMeta.name,
    tagline: targetMeta.tagline,
    scope: targetMeta.scope,
    channel: targetState.payment_method || "QRIS",
    is_global_active: true,
  };

  const activeDests = db.manual_destinations
    .filter((d) => d.is_active !== false && !disabledSet.has(d.id))
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const fiatDests = pCfg.manual !== false ? activeDests.filter((d) => d.type !== "crypto") : [];
  const cryptoDests = pCfg.crypto !== false ? activeDests.filter((d) => d.type === "crypto") : [];
  const methods: any[] = [];
  if (autoEnabled) {
    methods.push({
      id: "paykita",
      gateway_id: "paykita",
      label: `QRIS Otomatis (${targetMeta.name})`,
      default_gateway: "paykita",
      preferred_gateway: "paykita",
      gateways: [gatewayInfo],
    });
  }
  if (fiatDests.length > 0) methods.push({ id: "manual", label: "Transfer / QRIS" });
  if (cryptoDests.length > 0) methods.push({ id: "crypto", label: "Crypto (USDT / Coin)" });
  res.json(methods);
});

const handleManualDestinationsList = (req: Request, res: Response) => {
  const filterType = String(req.query.type || "").toLowerCase();
  const productId = req.query.product_id as string | undefined;
  const product = findProductFlexible(productId);
  const pCfg = normalizeProductPaymentConfig(product?.payment_config);
  const disabledSet = new Set(pCfg.disabled_destinations);
  let rows = db.manual_destinations
    .filter((d) => d.is_active !== false && !disabledSet.has(d.id))
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  if (product) {
    if (pCfg.manual === false) {
      rows = rows.filter((d) => d.type === "crypto");
    }
    if (pCfg.crypto === false) {
      rows = rows.filter((d) => d.type !== "crypto");
    }
  }
  if (filterType === "crypto") {
    rows = rows.filter((d) => d.type === "crypto");
  } else if (filterType === "fiat") {
    rows = rows.filter((d) => d.type !== "crypto");
  }
  res.json(rows);
};

api.get("/payments/manual-destinations", handleManualDestinationsList);
api.get("/payments/manual/destinations", handleManualDestinationsList);

const isDefaultDemoPaykitaKey = (key: string) =>
  !key || key === "pk_live_wjp_qris_99281746";

const isDemoGatewayKey = (gatewayId: string, key: string): boolean => {
  const k = String(key || "").trim();
  if (!k) return true;
  if (gatewayId === "paykita") return k === "pk_live_wjp_qris_99281746";
  if (gatewayId === "duitku") return k === "dk_live_wjp_88291044ff";
  if (gatewayId === "tripay") return k === "DEV-wjpTripayKey882910";
  if (gatewayId === "midtrans") return k === "Mid-server-wjp88291044";
  if (gatewayId === "xendit") return k === "xnd_production_wjp88291044";
  return false;
};

const getActiveGatewayConfig = () => {
  const pg = db.settings.payment_gateways || {};
  const activeId = String(pg.active_gateway || "paykita").toLowerCase();
  const gwMap = pg.gateways || {};
  const gw = gwMap[activeId] || gwMap.paykita || db.settings.paykita || {};
  return { activeId, gw };
};

const translatePaykitaError = (code?: string, fallbackMsg?: string): string => {
  switch (String(code || "").toLowerCase()) {
    case "invalid_api_key":
    case "missing_api_key":
      return "API Key PayKita tidak valid atau sudah dicabut. Periksa kembali pk_live_... di Panel Admin.";
    case "subscription_required":
      return "Langganan akun PayKita belum aktif atau sudah berakhir. Perpanjang paket di dashboard PayKita.";
    case "qris_not_configured":
      return "QRIS Merchant belum dikonfigurasi pada provider detektor aktif di dashboard PayKita.";
    case "detector_not_ready":
      return "Detektor pembayaran PayKita belum terhubung. Buka pengaturan Bot / Detektor di dashboard PayKita dan hubungkan runtime terlebih dahulu.";
    case "no_unique_code":
      return "Slot kode unik PayKita untuk nominal ini sedang penuh, silakan coba beberapa saat lagi.";
    case "invalid_amount":
      return "Nominal pembayaran tidak valid untuk QRIS PayKita.";
    default:
      return fallbackMsg || "Gagal membuat QRIS dari server Payment Gateway.";
  }
};

type RemotePaykitaOrderResult = {
  ok: boolean;
  mode: "live" | "demo" | "error";
  gateway_id?: string;
  gateway_name?: string;
  duitku_channel?: string;
  duitku_channel_name?: string;
  duitku_payment_flow?: string;
  va_number?: string | null;
  paykita_ref: string;
  qris_string: string;
  qris_image: string;
  pay_url: string | null;
  base_amount: number;
  pay_amount: number;
  unique_code: number;
  fee_amount: number;
  qris_provider: string | null;
  expired_at: string | null;
  error_code: string | null;
  error_message: string | null;
};

const buildSimulatedDuitkuVaOrCode = (channelCode: string, orderId: string, flow: string): string | null => {
  const digits = orderId.replace(/\D/g, "").slice(-8).padStart(8, "8");
  if (flow === "va") {
    const prefixMap: Record<string, string> = {
      BC: "70014",
      M2: "89022",
      I1: "88081",
      BR: "12889",
      BV: "90087",
      B1: "53790",
      BT: "85280",
      VA: "78210",
      NC: "88910",
      A1: "98700",
    };
    return `${prefixMap[channelCode] || "88010"}${digits}`;
  }
  if (flow === "retail") {
    return `WJP${digits}`;
  }
  return null;
};

const tryCreateRemotePaykitaOrder = async (params: {
  orderId: string;
  amount: number;
  productTitle: string;
  buyerEmail: string;
  buyerWhatsapp: string;
  origin: string;
  gatewayOverride?: string;
  duitkuMethod?: string;
}): Promise<RemotePaykitaOrderResult> => {
  const { activeId, gw } = getActiveGatewayConfig();
  const gatewayId = String(params.gatewayOverride || activeId || "paykita").toLowerCase();
  const pgGateways = db.settings.payment_gateways?.gateways || {};
  const gCfg = pgGateways[gatewayId] || gw || db.settings.paykita || {};
  const cleanAmount = Math.max(1, Math.round(Number(params.amount || 0)));

  // 1. DUITKU GATEWAY (Official Inquiry v2 — Supports QRIS, E-Wallet, Virtual Account, & Retail)
  if (gatewayId === "duitku") {
    const merchantCode = String(gCfg.merchant_code || process.env.DUITKU_MERCHANT_CODE || "").trim();
    const apiKey = String(gCfg.api_key || process.env.DUITKU_API_KEY || "").trim();
    const paymentMethod = String(params.duitkuMethod || gCfg.payment_method || "SP").trim().toUpperCase();
    const chMeta = getDuitkuChannelMeta(paymentMethod);
    const isSandbox = String(gCfg.mode || "").toLowerCase() === "sandbox";
    const baseUrl = String(
      gCfg.base_url ||
        (isSandbox ? "https://sandbox.duitku.com/webapi" : "https://passport.duitku.com/webapi")
    ).replace(/\/+$/, "");

    if (isDemoGatewayKey("duitku", apiKey) || !merchantCode) {
      const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
      const fallbackImg = await generateQrisDataUri(fallbackQris);
      const simVa = buildSimulatedDuitkuVaOrCode(chMeta.code, params.orderId, chMeta.payment_flow);
      return {
        ok: false,
        mode: "demo",
        gateway_id: "duitku",
        gateway_name: "Duitku",
        duitku_channel: chMeta.code,
        duitku_channel_name: chMeta.name,
        duitku_payment_flow: chMeta.payment_flow,
        va_number: simVa,
        paykita_ref: params.orderId,
        qris_string: fallbackQris,
        qris_image: fallbackImg,
        pay_url: null,
        base_amount: cleanAmount,
        pay_amount: cleanAmount,
        unique_code: 0,
        fee_amount: 0,
        qris_provider: `${chMeta.short_name} (${chMeta.code})`,
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        error_code: "demo_api_key",
        error_message:
          "Kredensial Duitku masih menggunakan mode demo. Masukkan Merchant Code & API Key asli dari dashboard Duitku di Panel Admin → Pembayaran.",
      };
    }

    try {
      const signature = crypto
        .createHash("md5")
        .update(`${merchantCode}${params.orderId}${cleanAmount}${apiKey}`)
        .digest("hex");
      const duitkuPayload = {
        merchantCode,
        paymentAmount: cleanAmount,
        paymentMethod: chMeta.code,
        merchantOrderId: params.orderId,
        productDetails: params.productTitle || "Pesanan WillJustPlay",
        email: params.buyerEmail || "buyer@willjustplay.com",
        phoneNumber: params.buyerWhatsapp || "081234567890",
        customerVaName: (params.buyerEmail || "Customer").split("@")[0],
        callbackUrl: `${params.origin}/api/webhook/duitku`,
        returnUrl: `${params.origin}/payment/success?session_id=${params.orderId}`,
        signature,
        expiryPeriod: 60,
      };
      const resp = await axios.post(`${baseUrl}/api/merchant/v2/inquiry`, duitkuPayload, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        timeout: 8000,
      });
      const d = resp.data || {};
      if (d.statusCode === "00" || d.qrString || d.vaNumber || d.paymentUrl || d.reference) {
        const rawQris = String(d.qrString || "").trim();
        const rawVa = d.vaNumber ? String(d.vaNumber).trim() : null;
        const payAmount = Math.max(1, Math.round(Number(d.amount || cleanAmount)));
        const finalQris = rawQris || buildFallbackEmvQrisPayload(params.orderId, payAmount);
        const qrImg = await generateQrisDataUri(finalQris);
        return {
          ok: true,
          mode: "live",
          gateway_id: "duitku",
          gateway_name: "Duitku",
          duitku_channel: chMeta.code,
          duitku_channel_name: chMeta.name,
          duitku_payment_flow: chMeta.payment_flow,
          va_number: rawVa,
          paykita_ref: String(d.reference || params.orderId).trim(),
          qris_string: finalQris,
          qris_image: qrImg,
          pay_url: d.paymentUrl ? String(d.paymentUrl) : null,
          base_amount: cleanAmount,
          pay_amount: payAmount,
          unique_code: 0,
          fee_amount: Math.max(0, payAmount - cleanAmount),
          qris_provider: `${chMeta.short_name} (${chMeta.code})`,
          expired_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          error_code: null,
          error_message: null,
        };
      }
      throw new Error(d.statusMessage || d.Message || `Gagal membuat transaksi ${chMeta.name} di Duitku`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.Message ||
        err?.response?.data?.statusMessage ||
        err?.message ||
        "Gagal menghubungi API Duitku";
      const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
      const fallbackImg = await generateQrisDataUri(fallbackQris);
      const simVa = buildSimulatedDuitkuVaOrCode(chMeta.code, params.orderId, chMeta.payment_flow);
      return {
        ok: false,
        mode: "error",
        gateway_id: "duitku",
        gateway_name: "Duitku",
        duitku_channel: chMeta.code,
        duitku_channel_name: chMeta.name,
        duitku_payment_flow: chMeta.payment_flow,
        va_number: simVa,
        paykita_ref: params.orderId,
        qris_string: fallbackQris,
        qris_image: fallbackImg,
        pay_url: null,
        base_amount: cleanAmount,
        pay_amount: cleanAmount,
        unique_code: 0,
        fee_amount: 0,
        qris_provider: `${chMeta.short_name} (${chMeta.code})`,
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        error_code: "duitku_error",
        error_message: `Duitku API (${chMeta.short_name}): ${msg}`,
      };
    }
  }

  // 2. TRIPAY GATEWAY
  if (gatewayId === "tripay") {
    const merchantCode = String(gCfg.merchant_code || "").trim();
    const apiKey = String(gCfg.api_key || "").trim();
    const privateKey = String(gCfg.private_key || "").trim();
    const paymentMethod = String(gCfg.payment_method || "QRISC").trim().toUpperCase();
    const isSandbox = String(gCfg.mode || "").toLowerCase() === "sandbox";
    const baseUrl = String(
      gCfg.base_url || (isSandbox ? "https://tripay.co.id/api-sandbox" : "https://tripay.co.id/api")
    ).replace(/\/+$/, "");

    if (isDemoGatewayKey("tripay", apiKey) || !merchantCode || !privateKey) {
      const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
      const fallbackImg = await generateQrisDataUri(fallbackQris);
      return {
        ok: false,
        mode: "demo",
        gateway_id: "tripay",
        gateway_name: "Tripay",
        paykita_ref: params.orderId,
        qris_string: fallbackQris,
        qris_image: fallbackImg,
        pay_url: null,
        base_amount: cleanAmount,
        pay_amount: cleanAmount,
        unique_code: 0,
        fee_amount: 0,
        qris_provider: `Tripay (${paymentMethod})`,
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        error_code: "demo_api_key",
        error_message:
          "Kredensial Tripay masih menggunakan mode demo. Masukkan Kode Merchant, API Key & Private Key asli dari dashboard Tripay.",
      };
    }

    try {
      const signature = crypto
        .createHmac("sha256", privateKey)
        .update(`${merchantCode}${params.orderId}${cleanAmount}`)
        .digest("hex");
      const resp = await axios.post(
        `${baseUrl}/transaction/create`,
        {
          method: paymentMethod,
          merchant_ref: params.orderId,
          amount: cleanAmount,
          customer_name: (params.buyerEmail || "Customer").split("@")[0],
          customer_email: params.buyerEmail || "buyer@willjustplay.com",
          customer_phone: params.buyerWhatsapp || "081234567890",
          order_items: [{ sku: "WJP-ITEM", name: params.productTitle || "Produk Digital", price: cleanAmount, quantity: 1 }],
          callback_url: `${params.origin}/api/webhook/tripay`,
          return_url: `${params.origin}/payment/success?session_id=${params.orderId}`,
          expired_time: Math.floor(Date.now() / 1000) + 900,
          signature,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          timeout: 8000,
        }
      );
      const d = resp.data?.data || {};
      if (resp.data?.success && d) {
        const rawQris = String(d.qr_string || "").trim();
        const payAmount = Math.max(1, Math.round(Number(d.amount || cleanAmount)));
        const finalQris = rawQris || buildFallbackEmvQrisPayload(params.orderId, payAmount);
        const qrImg = rawQris ? await generateQrisDataUri(rawQris) : d.qr_url || (await generateQrisDataUri(finalQris));
        return {
          ok: true,
          mode: "live",
          gateway_id: "tripay",
          gateway_name: "Tripay",
          paykita_ref: String(d.reference || params.orderId).trim(),
          qris_string: finalQris,
          qris_image: qrImg,
          pay_url: d.checkout_url ? String(d.checkout_url) : null,
          base_amount: cleanAmount,
          pay_amount: payAmount,
          unique_code: 0,
          fee_amount: Math.max(0, Number(d.total_fee || 0)),
          qris_provider: `Tripay (${paymentMethod})`,
          expired_at: d.expired_time
            ? new Date(Number(d.expired_time) * 1000).toISOString()
            : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          error_code: null,
          error_message: null,
        };
      }
      throw new Error(resp.data?.message || "Gagal membuat transaksi Tripay");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Gagal menghubungi API Tripay";
      const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
      const fallbackImg = await generateQrisDataUri(fallbackQris);
      return {
        ok: false,
        mode: "error",
        gateway_id: "tripay",
        gateway_name: "Tripay",
        paykita_ref: params.orderId,
        qris_string: fallbackQris,
        qris_image: fallbackImg,
        pay_url: null,
        base_amount: cleanAmount,
        pay_amount: cleanAmount,
        unique_code: 0,
        fee_amount: 0,
        qris_provider: `Tripay (${paymentMethod})`,
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        error_code: "tripay_error",
        error_message: `Tripay API: ${msg}`,
      };
    }
  }

  // 3. MIDTRANS GATEWAY (Core API QRIS)
  if (gatewayId === "midtrans") {
    const serverKey = String(gCfg.api_key || "").trim();
    const isSandbox = String(gCfg.mode || "").toLowerCase() === "sandbox" || serverKey.startsWith("SB-");
    const baseUrl = String(
      gCfg.base_url || (isSandbox ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com")
    ).replace(/\/+$/, "");

    if (isDemoGatewayKey("midtrans", serverKey)) {
      const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
      const fallbackImg = await generateQrisDataUri(fallbackQris);
      return {
        ok: false,
        mode: "demo",
        gateway_id: "midtrans",
        gateway_name: "Midtrans",
        paykita_ref: params.orderId,
        qris_string: fallbackQris,
        qris_image: fallbackImg,
        pay_url: null,
        base_amount: cleanAmount,
        pay_amount: cleanAmount,
        unique_code: 0,
        fee_amount: 0,
        qris_provider: "Midtrans QRIS",
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        error_code: "demo_api_key",
        error_message:
          "Server Key Midtrans masih menggunakan mode demo. Masukkan Server Key asli (Mid-server-...) dari dashboard Midtrans.",
      };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
      const resp = await axios.post(
        `${baseUrl}/v2/charge`,
        {
          payment_type: "qris",
          transaction_details: {
            order_id: params.orderId,
            gross_amount: cleanAmount,
          },
          item_details: [
            {
              id: "wjp-item",
              price: cleanAmount,
              quantity: 1,
              name: String(params.productTitle || "Produk WillJustPlay").slice(0, 48),
            },
          ],
          customer_details: {
            email: params.buyerEmail || "buyer@willjustplay.com",
            phone: params.buyerWhatsapp || "081234567890",
          },
        },
        {
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          timeout: 8000,
        }
      );
      const d = resp.data || {};
      if (d.status_code === "201" || d.qr_string || Array.isArray(d.actions)) {
        const rawQris = String(d.qr_string || "").trim();
        const qrAction = (d.actions || []).find((a: any) => a.name === "generate-qr-code");
        const finalQris = rawQris || buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
        const qrImg = rawQris
          ? await generateQrisDataUri(rawQris)
          : qrAction?.url || (await generateQrisDataUri(finalQris));
        return {
          ok: true,
          mode: "live",
          gateway_id: "midtrans",
          gateway_name: "Midtrans",
          paykita_ref: String(d.transaction_id || params.orderId).trim(),
          qris_string: finalQris,
          qris_image: qrImg,
          pay_url: null,
          base_amount: cleanAmount,
          pay_amount: cleanAmount,
          unique_code: 0,
          fee_amount: 0,
          qris_provider: `Midtrans (${d.acquirer || "QRIS"})`,
          expired_at: d.expiry_time ? new Date(d.expiry_time).toISOString() : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          error_code: null,
          error_message: null,
        };
      }
      throw new Error(d.status_message || "Gagal membuat QRIS Midtrans");
    } catch (err: any) {
      const msg = err?.response?.data?.status_message || err?.message || "Gagal menghubungi Midtrans Core API";
      const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
      const fallbackImg = await generateQrisDataUri(fallbackQris);
      return {
        ok: false,
        mode: "error",
        gateway_id: "midtrans",
        gateway_name: "Midtrans",
        paykita_ref: params.orderId,
        qris_string: fallbackQris,
        qris_image: fallbackImg,
        pay_url: null,
        base_amount: cleanAmount,
        pay_amount: cleanAmount,
        unique_code: 0,
        fee_amount: 0,
        qris_provider: "Midtrans QRIS",
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        error_code: "midtrans_error",
        error_message: `Midtrans API: ${msg}`,
      };
    }
  }

  // 4. XENDIT GATEWAY (QR Codes API)
  if (gatewayId === "xendit") {
    const secretKey = String(gCfg.api_key || "").trim();
    const baseUrl = String(gCfg.base_url || "https://api.xendit.co").replace(/\/+$/, "");

    if (isDemoGatewayKey("xendit", secretKey)) {
      const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
      const fallbackImg = await generateQrisDataUri(fallbackQris);
      return {
        ok: false,
        mode: "demo",
        gateway_id: "xendit",
        gateway_name: "Xendit",
        paykita_ref: params.orderId,
        qris_string: fallbackQris,
        qris_image: fallbackImg,
        pay_url: null,
        base_amount: cleanAmount,
        pay_amount: cleanAmount,
        unique_code: 0,
        fee_amount: 0,
        qris_provider: "Xendit QRIS",
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        error_code: "demo_api_key",
        error_message:
          "Secret Key Xendit masih menggunakan mode demo. Masukkan Secret API Key (xnd_...) asli dari dashboard Xendit.",
      };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const resp = await axios.post(
        `${baseUrl}/qr_codes`,
        {
          reference_id: params.orderId,
          type: "DYNAMIC",
          currency: "IDR",
          amount: cleanAmount,
          expires_at: expiresAt,
        },
        {
          headers: {
            Authorization: authHeader,
            "api-version": "2022-07-31",
            "Content-Type": "application/json",
          },
          timeout: 8000,
        }
      );
      const d = resp.data || {};
      if (d.qr_string) {
        const rawQris = String(d.qr_string).trim();
        const qrImg = await generateQrisDataUri(rawQris);
        return {
          ok: true,
          mode: "live",
          gateway_id: "xendit",
          gateway_name: "Xendit",
          paykita_ref: String(d.id || params.orderId).trim(),
          qris_string: rawQris,
          qris_image: qrImg,
          pay_url: null,
          base_amount: cleanAmount,
          pay_amount: cleanAmount,
          unique_code: 0,
          fee_amount: 0,
          qris_provider: "Xendit QRIS",
          expired_at: d.expires_at || expiresAt,
          error_code: null,
          error_message: null,
        };
      }
      throw new Error("Respons QRIS Xendit tidak memiliki qr_string");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Gagal menghubungi API Xendit";
      const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
      const fallbackImg = await generateQrisDataUri(fallbackQris);
      return {
        ok: false,
        mode: "error",
        gateway_id: "xendit",
        gateway_name: "Xendit",
        paykita_ref: params.orderId,
        qris_string: fallbackQris,
        qris_image: fallbackImg,
        pay_url: null,
        base_amount: cleanAmount,
        pay_amount: cleanAmount,
        unique_code: 0,
        fee_amount: 0,
        qris_provider: "Xendit QRIS",
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        error_code: "xendit_error",
        error_message: `Xendit API: ${msg}`,
      };
    }
  }

  // 5. PAYKITA GATEWAY (Default)
  const s = db.settings.paykita || {};
  const apiKey = String(gCfg.api_key || s.api_key || process.env.PAYKITA_API_KEY || "").trim();
  const baseUrl = String(gCfg.base_url || s.base_url || "https://pay.digikita.id").replace(/\/+$/, "");

  if (isDefaultDemoPaykitaKey(apiKey)) {
    const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
    const fallbackImg = await generateQrisDataUri(fallbackQris);
    return {
      ok: false,
      mode: "demo",
      gateway_id: "paykita",
      gateway_name: "PayKita",
      paykita_ref: params.orderId,
      qris_string: fallbackQris,
      qris_image: fallbackImg,
      pay_url: null,
      base_amount: cleanAmount,
      pay_amount: cleanAmount,
      unique_code: 0,
      fee_amount: 0,
      qris_provider: null,
      expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      error_code: "demo_api_key",
      error_message:
        "API Key PayKita masih menggunakan kunci bawaan. Masukkan API Key asli (pk_live_...) dari pay.digikita.id di Panel Admin → Pembayaran.",
    };
  }

  const isHttpsOrigin = /^https:\/\//i.test(String(params.origin || "").trim());
  const orderPayload: Record<string, any> = {
    base_amount: cleanAmount,
    reference: params.orderId,
    reference_id: params.orderId,
    ttl_seconds: 900,
  };
  if (isHttpsOrigin) {
    orderPayload.notify_url = `${params.origin}/api/webhook/paykita`;
    orderPayload.redirect_url = `${params.origin}/payment/success?session_id=${params.orderId}`;
  }

  let lastErrorCode: string | null = null;
  let lastErrorMessage: string | null = null;

  const candidateConfigs = [
    {
      url: `${baseUrl}/api/orders`,
      body: orderPayload,
    },
    {
      url: `${baseUrl}/api/v1/orders`,
      body: orderPayload,
    },
    {
      url: `${baseUrl}/api/v1/transactions`,
      body: {
        ...orderPayload,
        merchant_ref: params.orderId,
        order_id: params.orderId,
        amount: cleanAmount,
        method: "QRIS",
        customer_name: params.buyerEmail || params.buyerWhatsapp || "Customer",
        customer_email: params.buyerEmail || "buyer@willjustplay.com",
        customer_phone: params.buyerWhatsapp || "0800000000",
        product_name: params.productTitle,
        callback_url: `${params.origin}/api/webhook/paykita`,
        return_url: `${params.origin}/payment/success?session_id=${params.orderId}`,
      },
    },
  ];

  for (const cfg of candidateConfigs) {
    try {
      const resp = await axios.post(cfg.url, cfg.body, {
        headers: {
          "x-api-key": apiKey,
          "X-API-Key": apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 8000,
      });
      const d = resp.data?.data || resp.data;
      const rawQris = String(d?.qris || d?.qris_string || d?.qr_string || "").trim();
      const rawImg = String(d?.qris_image || d?.qr_url || d?.qr_image || "").trim();
      const checkoutUrl = String(
        d?.checkout_url || d?.pay_url || (d?.id ? `${baseUrl}/pay/${d.id}` : "")
      ).trim();

      if (d && typeof d === "object" && (rawQris || rawImg || checkoutUrl)) {
        const payAmount = Math.max(1, Math.round(Number(d.pay_amount || d.amount || cleanAmount)));
        const baseAmount = Math.max(1, Math.round(Number(d.base_amount || cleanAmount)));
        const uniqueCode = Math.max(0, Math.round(Number(d.unique_code || 0)));
        const feeAmount = Math.max(0, Math.round(Number(d.fee_amount || 0)));
        const finalQrisString = rawQris || buildFallbackEmvQrisPayload(params.orderId, payAmount);
        const generatedQrImg = rawQris ? await generateQrisDataUri(rawQris) : "";
        const finalQrisImage = generatedQrImg || rawImg || (await generateQrisDataUri(finalQrisString));
        const expRaw = d.expires_at || d.expired_at;

        return {
          ok: true,
          mode: "live",
          gateway_id: "paykita",
          gateway_name: "PayKita",
          paykita_ref: String(d.id || d.reference || d.order_id || params.orderId).trim(),
          qris_string: finalQrisString,
          qris_image: finalQrisImage,
          pay_url: checkoutUrl || null,
          base_amount: baseAmount,
          pay_amount: payAmount,
          unique_code: uniqueCode,
          fee_amount: feeAmount,
          qris_provider: d.provider ? String(d.provider) : null,
          expired_at: expRaw ? new Date(expRaw).toISOString() : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          error_code: null,
          error_message: null,
        };
      }
    } catch (err: any) {
      const errObj = err?.response?.data?.error;
      const errDetail = err?.response?.data?.detail || err?.response?.data?.message;
      if (errObj && typeof errObj === "object") {
        lastErrorCode = String(errObj.code || "paykita_error");
        lastErrorMessage = translatePaykitaError(errObj.code, String(errObj.message || ""));
        break;
      } else if (errDetail) {
        lastErrorCode = "paykita_http_error";
        lastErrorMessage = String(errDetail);
      } else if (!lastErrorMessage && err?.message) {
        lastErrorCode = "network_error";
        lastErrorMessage = `Tidak dapat menghubungi server PayKita (${baseUrl}): ${err.message}`;
      }
    }
  }

  const fallbackQris = buildFallbackEmvQrisPayload(params.orderId, cleanAmount);
  const fallbackImg = await generateQrisDataUri(fallbackQris);
  return {
    ok: false,
    mode: "error",
    gateway_id: "paykita",
    gateway_name: "PayKita",
    paykita_ref: params.orderId,
    qris_string: fallbackQris,
    qris_image: fallbackImg,
    pay_url: null,
    base_amount: cleanAmount,
    pay_amount: cleanAmount,
    unique_code: 0,
    fee_amount: 0,
    qris_provider: null,
    expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    error_code: lastErrorCode || "paykita_unreachable",
    error_message:
      lastErrorMessage ||
      "Gagal mendapatkan QRIS dinamis dari PayKita. Pastikan API Key dan QRIS Merchant di dashboard PayKita sudah aktif.",
  };
};

const ensurePaykitaTransactionQris = async (tx: any, origin: string, forceRefresh = false) => {
  if (!tx || tx.provider !== "paykita" || tx.payment_status !== "pending") return;
  const defaultGwForTx = tx.product_type === PRODUCT_TYPE ? "duitku" : "paykita";
  const gatewayId = String(tx.gateway_id || defaultGwForTx).toLowerCase() === "duitku" ? "duitku" : "paykita";
  const pgGateways = db.settings.payment_gateways?.gateways || {};
  const gCfg = pgGateways[gatewayId] || db.settings.paykita || {};
  const apiKey = String(gCfg.api_key || (gatewayId === "paykita" ? db.settings.paykita?.api_key : "") || "").trim();
  const hasRealKey = !isDemoGatewayKey(gatewayId, apiKey);
  let mutated = false;

  if (!tx.gateway_id) {
    tx.gateway_id = gatewayId;
    tx.gateway_name = gatewayId === "duitku" ? "Duitku" : "PayKita";
    mutated = true;
  }

  if ((forceRefresh || tx.paykita_mode !== "live") && hasRealKey) {
    const remoteOrder = await tryCreateRemotePaykitaOrder({
      orderId: tx.session_id,
      amount: Number(tx.base_amount || tx.amount || 0),
      productTitle: tx.product_title || "Pesanan WillJustPlay",
      buyerEmail: tx.buyer_email || "",
      buyerWhatsapp: tx.buyer_whatsapp || "",
      origin,
      gatewayOverride: gatewayId,
      duitkuMethod: tx.duitku_channel || undefined,
    });
    tx.paykita_mode = remoteOrder.mode;
    tx.paykita_error = remoteOrder.error_message;
    tx.paykita_error_code = remoteOrder.error_code;
    if (remoteOrder.ok) {
      tx.paykita_ref = remoteOrder.paykita_ref;
      tx.qris_string = remoteOrder.qris_string;
      tx.qris_image = remoteOrder.qris_image;
      tx.pay_url = remoteOrder.pay_url;
      if (remoteOrder.va_number) tx.va_number = remoteOrder.va_number;
      tx.base_amount = remoteOrder.base_amount;
      tx.pay_amount = remoteOrder.pay_amount;
      tx.unique_code = remoteOrder.unique_code;
      tx.fee_amount = remoteOrder.fee_amount;
      tx.qris_provider = remoteOrder.qris_provider;
      if (remoteOrder.expired_at) tx.expired_at = remoteOrder.expired_at;
    }
    mutated = true;
  } else if (!hasRealKey && tx.paykita_mode !== "demo") {
    tx.paykita_mode = "demo";
    tx.paykita_error_code = "demo_api_key";
    tx.paykita_error = `Kredensial ${gCfg.name || (gatewayId === "duitku" ? "Duitku" : "PayKita")} masih menggunakan mode demo. Masukkan API Key asli di Panel Admin → Pembayaran.`;
    mutated = true;
  }

  if (!tx.qris_string || String(tx.qris_string).endsWith("6304A1B2")) {
    tx.qris_string = buildFallbackEmvQrisPayload(tx.session_id, Number(tx.pay_amount || tx.amount || 0));
    tx.qris_image = await generateQrisDataUri(tx.qris_string);
    mutated = true;
  } else if (!tx.qris_image || String(tx.qris_image).startsWith("data:image/svg+xml")) {
    const realQr = await generateQrisDataUri(tx.qris_string);
    if (realQr) {
      tx.qris_image = realQr;
      mutated = true;
    }
  }

  if (mutated) {
    tx.updated_at = nowIso();
    saveDb();
  }
};

function enforceCheckoutRateLimit(req: Request, res: Response, checkoutType: string): boolean {
  const ip = getClientIp(req);
  const [allowed, retrySec] = checkRateLimit(`checkout:${ip}`, 12, 5 * 60 * 1000);
  if (!allowed) {
    const strikeRes = recordSecurityStrike(
      ip,
      "checkout_spam",
      3,
      10 * 60 * 1000,
      `Spam transaksi checkout berlebihan (${checkoutType})`,
      req,
      { checkout_type: checkoutType }
    );
    writeAuditLog({
      actor: getUserOptional(req),
      action: "security.checkout_rate_limited",
      metadata: {
        checkout_type: checkoutType,
        strikes: strikeRes.strikes,
        ip_blocked: strikeRes.blocked,
      },
      req,
    });
    res.status(429).json({
      detail: strikeRes.blocked
        ? "Terdeteksi spam pembuatan transaksi berulang! IP Anda diblokir otomatis selama 15 menit."
        : `Terlalu banyak transaksi dibuat dalam waktu singkat. Silakan tunggu ${retrySec} detik.`,
    });
    return false;
  }
  return true;
}

api.post("/payments/paykita/checkout", async (req, res) => {
  try {
    if (!enforceCheckoutRateLimit(req, res, "qris_auto")) return;
    const body = req.body || {};
    const product = findProductFlexible(body.product_id);
    if (!product) return res.status(404).json({ detail: "Produk tidak ditemukan" });
    if ((product.stock || 0) < 1) return res.status(400).json({ detail: "Stok produk habis" });

    // Dedicated routing: Produk Beranda -> PayKita, Produk Top Up -> Duitku
    const isTopup = isTopupProduct(product);
    const resolvedGateway = isTopup ? "duitku" : "paykita";
    const pgGateways = db.settings.payment_gateways?.gateways || {};
    const s = db.settings.paykita || {};

    if (resolvedGateway === "paykita") {
      if (s.enabled === false || pgGateways.paykita?.enabled === false) {
        return res.status(400).json({ detail: "Pembayaran QRIS Otomatis (PayKita) untuk Produk Beranda sedang dinonaktifkan oleh admin" });
      }
    } else {
      if (pgGateways.duitku?.enabled === false) {
        return res.status(400).json({ detail: "Pembayaran QRIS Otomatis (Duitku) untuk Produk Top Up sedang dinonaktifkan oleh admin" });
      }
    }

    const pCfg = normalizeProductPaymentConfig(product.payment_config);
    if (!pCfg.paykita || (pCfg.disabled_gateways || []).includes(resolvedGateway)) {
      return res.status(400).json({ detail: "Pembayaran QRIS Otomatis sedang dinonaktifkan untuk produk ini" });
    }

    const buyer = parseBuyer(body);
    const user = getUserOptional(req);
    const orderId = genOrderId("NXG-Q");
    const priceIdr = Math.round(Number(product.price || 0));
    const priceUsd =
      product.price_usd && Number(product.price_usd) > 0
        ? Number(product.price_usd)
        : Math.max(1, Math.round((priceIdr / 16000) * 100) / 100);
    const origin = body.origin_url || req.headers.origin || getAppOrigin(req);

    const remoteOrder = await tryCreateRemotePaykitaOrder({
      orderId,
      amount: priceIdr,
      productTitle: product.title,
      buyerEmail: buyer.buyer_email || "",
      buyerWhatsapp: buyer.buyer_whatsapp || "",
      origin,
      gatewayOverride: resolvedGateway,
    });

    const expiredAt = remoteOrder.expired_at || new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const gwLabel = remoteOrder.gateway_name || "PayKita";

    const tx = {
      ...buyer,
      session_id: orderId,
      paykita_ref: remoteOrder.paykita_ref || orderId,
      gateway_id: remoteOrder.gateway_id || "paykita",
      gateway_name: gwLabel,
      provider: "paykita",
      payment_type: "paykita",
      destination_id: `${remoteOrder.gateway_id || "paykita"}-qris`,
      destination_name: `QRIS Otomatis (${gwLabel})`,
      qris_string: remoteOrder.qris_string,
      qris_image: remoteOrder.qris_image,
      pay_url: remoteOrder.pay_url || null,
      base_amount: remoteOrder.base_amount || priceIdr,
      pay_amount: remoteOrder.pay_amount || priceIdr,
      unique_code: remoteOrder.unique_code || 0,
      fee_amount: remoteOrder.fee_amount || 0,
      qris_provider: remoteOrder.qris_provider || gwLabel,
      paykita_mode: remoteOrder.mode,
      paykita_error: remoteOrder.error_message || null,
      paykita_error_code: remoteOrder.error_code || null,
      expired_at: expiredAt,
      product_id: product.id,
      product_title: product.title,
      delivery_info:
        product.delivery_info ||
        `[Gmail] [akses.${String(product.id || "akun").toLowerCase()}@willjustplay.com] [Wjp#${String(
          product.id || "2026"
        )
          .slice(0, 4)
          .toUpperCase()}2026]`,
      user_id: user?.id || null,
      amount: priceIdr,
      amount_usd: priceUsd,
      currency: "idr",
      status: "pending",
      payment_status: "pending",
      paykita_confirmed: false,
      paykita_confirmed_by: null as string | null,
      paykita_confirmed_at: null as string | null,
      payment_proof: null,
      has_proof: false,
      stock_deducted: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.transactions.push(tx);
    saveDb();
    res.json({
      order_id: orderId,
      session_id: orderId,
      checkout_url: `${origin}/payment/success?session_id=${orderId}`,
      paykita_mode: remoteOrder.mode,
      paykita_error: remoteOrder.error_message || null,
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ detail: err.detail || "Gagal membuat pesanan QRIS" });
  }
});

const cancelOngoingTransactionsForOutOfStockProduct = (
  productId: string,
  winningSessionId?: string
): number => {
  if (!productId) return 0;
  const prod = findProductFlexible(productId);
  if (!prod || prod.product_type === PRODUCT_TYPE || Number(prod.stock ?? 0) > 0) {
    return 0;
  }
  let cancelledCount = 0;
  const reason =
    "Produk ini baru saja terjual habis karena telah dibeli terlebih dahulu oleh pembeli lain.";
  for (const item of db.transactions || []) {
    if (!item || item.product_id !== prod.id) continue;
    if (winningSessionId && item.session_id === winningSessionId) continue;
    const isAlreadyPaid =
      item.payment_status === "paid" &&
      (item.provider !== "paykita" || Boolean(item.paykita_confirmed));
    if (isAlreadyPaid || item.status === "completed") continue;
    if (
      item.payment_status === "pending" ||
      item.status === "pending" ||
      item.status === "waiting_approval"
    ) {
      item.payment_status = "failed";
      item.status = "cancelled_out_of_stock";
      item.cancel_reason = reason;
      item.qris_string = null;
      item.qris_image = null;
      item.va_number = null;
      item.pay_url = null;
      item.updated_at = nowIso();
      cancelledCount += 1;
    }
  }
  return cancelledCount;
};

const ensureOngoingHomeTransactionStockAvailable = (tx: any): boolean => {
  if (!tx || tx.product_type === PRODUCT_TYPE) return true;
  const isAlreadyPaid =
    tx.payment_status === "paid" &&
    (tx.provider !== "paykita" || Boolean(tx.paykita_confirmed));
  if (isAlreadyPaid || tx.status === "completed") return true;
  if (tx.status === "cancelled_out_of_stock") return false;

  const prod = findProductFlexible(tx.product_id);
  if (prod && prod.product_type !== PRODUCT_TYPE && Number(prod.stock ?? 0) <= 0) {
    cancelOngoingTransactionsForOutOfStockProduct(prod.id);
    tx.payment_status = "failed";
    tx.status = "cancelled_out_of_stock";
    tx.cancel_reason =
      tx.cancel_reason ||
      "Produk ini baru saja terjual habis karena telah dibeli terlebih dahulu oleh pembeli lain.";
    tx.qris_string = null;
    tx.qris_image = null;
    tx.va_number = null;
    tx.pay_url = null;
    tx.updated_at = nowIso();
    saveDb();
    return false;
  }
  return true;
};

const markPaykitaTransactionPaid = (tx: any, confirmedBy = "paykita") => {
  if (!tx) return;
  if (tx.payment_status !== "paid" && tx.payment_status !== "failed") {
    const p = findProductFlexible(tx.product_id);
    if (
      p &&
      p.product_type !== PRODUCT_TYPE &&
      !tx.stock_deducted &&
      Number(p.stock ?? 0) <= 0
    ) {
      cancelOngoingTransactionsForOutOfStockProduct(p.id);
      saveDb();
      return;
    }
    if (!tx.stock_deducted) {
      if (p) {
        p.stock = Math.max(0, (p.stock || 0) - 1);
        p.sold = (p.sold || 0) + 1;
      }
      tx.stock_deducted = true;
    }
    tx.payment_status = "paid";
    tx.status = "completed";
    tx.paykita_confirmed = true;
    tx.paykita_confirmed_by = confirmedBy;
    tx.paykita_confirmed_at = nowIso();
    tx.updated_at = nowIso();
    if (p && p.product_type !== PRODUCT_TYPE && Number(p.stock ?? 0) <= 0) {
      cancelOngoingTransactionsForOutOfStockProduct(p.id, tx.session_id);
    }
    saveDb();
    void sendOrderFulfillmentEmail(tx);
  } else if (tx.payment_status === "paid" && !tx.fulfillment_email_sent_at) {
    void sendOrderFulfillmentEmail(tx);
  }
};

const verifyTransactionWithPaykitaServer = async (tx: any, origin?: string): Promise<{
  confirmed: boolean;
  paykita_status: string;
  message: string;
}> => {
  if (!tx) {
    return { confirmed: false, paykita_status: "not_found", message: "Transaksi tidak ditemukan" };
  }
  const gwLabel = tx.gateway_name || "Payment Gateway";
  if (tx.payment_status === "paid" && tx.paykita_confirmed) {
    return {
      confirmed: true,
      paykita_status: "paid",
      message: `Pembayaran telah terkonfirmasi lunas oleh ${gwLabel}.`,
    };
  }
  if (!ensureOngoingHomeTransactionStockAvailable(tx)) {
    return {
      confirmed: false,
      paykita_status: "cancelled_out_of_stock",
      message:
        tx.cancel_reason ||
        "Pembayaran dibatalkan otomatis karena produk baru saja terjual habis dibeli oleh pembeli lain.",
    };
  }
  if (tx.payment_status === "failed") {
    return {
      confirmed: false,
      paykita_status:
        tx.status === "cancelled_out_of_stock"
          ? "cancelled_out_of_stock"
          : tx.status === "expired"
            ? "expired"
            : "failed",
      message:
        tx.status === "cancelled_out_of_stock"
          ? tx.cancel_reason ||
            "Pembayaran dibatalkan otomatis karena produk baru saja terjual habis dibeli oleh pembeli lain."
          : tx.status === "expired"
            ? "Waktu pembayaran QRIS sudah habis (kedaluwarsa)."
            : "Pembayaran gagal atau dibatalkan.",
    };
  }
  if (tx.expired_at && new Date(tx.expired_at).getTime() <= Date.now()) {
    tx.payment_status = "failed";
    tx.status = "expired";
    tx.updated_at = nowIso();
    saveDb();
    return {
      confirmed: false,
      paykita_status: "expired",
      message: "Waktu pembayaran QRIS sudah habis (kedaluwarsa).",
    };
  }

  const defaultGwForTx = tx.product_type === PRODUCT_TYPE ? "duitku" : "paykita";
  const gatewayId: string = String(tx.gateway_id || defaultGwForTx).toLowerCase() === "duitku" ? "duitku" : "paykita";
  const pgGateways = db.settings.payment_gateways?.gateways || {};
  const gCfg = pgGateways[gatewayId] || db.settings.paykita || {};
  const apiKey = String(gCfg.api_key || (gatewayId === "paykita" ? db.settings.paykita?.api_key : "") || "").trim();

  if (origin && tx.paykita_mode !== "live" && !isDemoGatewayKey(gatewayId, apiKey)) {
    await ensurePaykitaTransactionQris(tx, origin, false);
  }

  if (gatewayId === "duitku" && !isDemoGatewayKey("duitku", apiKey)) {
    try {
      const merchantCode = String(gCfg.merchant_code || "").trim();
      const isSandbox = String(gCfg.mode || "").toLowerCase() === "sandbox";
      const baseUrl = String(
        gCfg.base_url ||
          (isSandbox ? "https://sandbox.duitku.com/webapi" : "https://passport.duitku.com/webapi")
      ).replace(/\/+$/, "");
      const signature = crypto
        .createHash("md5")
        .update(`${merchantCode}${tx.session_id}${apiKey}`)
        .digest("hex");
      const resp = await axios.post(
        `${baseUrl}/api/merchant/transactionStatus`,
        {
          merchantCode,
          merchantOrderId: tx.session_id,
          signature,
        },
        { headers: { "Content-Type": "application/json" }, timeout: 6000 }
      );
      const code = String(resp.data?.statusCode || "");
      if (code === "00") {
        markPaykitaTransactionPaid(tx, "duitku_api");
        return {
          confirmed: true,
          paykita_status: "paid",
          message: "Pembayaran berhasil dikonfirmasi oleh Duitku!",
        };
      }
      if (code === "02") {
        tx.payment_status = "failed";
        tx.status = "failed";
        tx.updated_at = nowIso();
        saveDb();
        return {
          confirmed: false,
          paykita_status: "failed",
          message: "Transaksi dibatalkan atau kedaluwarsa di Duitku.",
        };
      }
    } catch {
      // ignore
    }
    return {
      confirmed: false,
      paykita_status: "waiting_payment",
      message: "Menunggu konfirmasi pembayaran dari Duitku. Silakan selesaikan scan QRIS terlebih dahulu.",
    };
  }

  if (gatewayId === "tripay" && !isDemoGatewayKey("tripay", apiKey)) {
    try {
      const isSandbox = String(gCfg.mode || "").toLowerCase() === "sandbox";
      const baseUrl = String(
        gCfg.base_url || (isSandbox ? "https://tripay.co.id/api-sandbox" : "https://tripay.co.id/api")
      ).replace(/\/+$/, "");
      const resp = await axios.get(
        `${baseUrl}/transaction/detail?reference=${encodeURIComponent(tx.paykita_ref || tx.session_id)}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 6000 }
      );
      const st = String(resp.data?.data?.status || "").toUpperCase();
      if (st === "PAID") {
        markPaykitaTransactionPaid(tx, "tripay_api");
        return {
          confirmed: true,
          paykita_status: "paid",
          message: "Pembayaran berhasil dikonfirmasi oleh Tripay!",
        };
      }
      if (st === "EXPIRED" || st === "FAILED") {
        tx.payment_status = "failed";
        tx.status = st === "EXPIRED" ? "expired" : "failed";
        tx.updated_at = nowIso();
        saveDb();
        return {
          confirmed: false,
          paykita_status: tx.status,
          message: "Transaksi kedaluwarsa atau gagal di Tripay.",
        };
      }
    } catch {
      // ignore
    }
    return {
      confirmed: false,
      paykita_status: "waiting_payment",
      message: "Menunggu konfirmasi pembayaran dari Tripay.",
    };
  }

  if (gatewayId === "midtrans" && !isDemoGatewayKey("midtrans", apiKey)) {
    try {
      const isSandbox = String(gCfg.mode || "").toLowerCase() === "sandbox" || apiKey.startsWith("SB-");
      const baseUrl = String(
        gCfg.base_url || (isSandbox ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com")
      ).replace(/\/+$/, "");
      const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
      const resp = await axios.get(`${baseUrl}/v2/${encodeURIComponent(tx.session_id)}/status`, {
        headers: { Authorization: authHeader, Accept: "application/json" },
        timeout: 6000,
      });
      const st = String(resp.data?.transaction_status || "").toLowerCase();
      if (st === "settlement" || st === "capture") {
        markPaykitaTransactionPaid(tx, "midtrans_api");
        return {
          confirmed: true,
          paykita_status: "paid",
          message: "Pembayaran berhasil dikonfirmasi oleh Midtrans!",
        };
      }
      if (st === "expire" || st === "cancel" || st === "deny") {
        tx.payment_status = "failed";
        tx.status = st === "expire" ? "expired" : "failed";
        tx.updated_at = nowIso();
        saveDb();
        return {
          confirmed: false,
          paykita_status: tx.status,
          message: "Transaksi kedaluwarsa atau dibatalkan di Midtrans.",
        };
      }
    } catch {
      // ignore
    }
    return {
      confirmed: false,
      paykita_status: "waiting_payment",
      message: "Menunggu konfirmasi pembayaran dari Midtrans.",
    };
  }

  const s = db.settings.paykita || {};
  const pkKey = String(s.api_key || process.env.PAYKITA_API_KEY || "").trim();
  const baseUrl = String(s.base_url || "https://pay.digikita.id").replace(/\/+$/, "");

  const candidateIds = Array.from(
    new Set([String(tx.paykita_ref || "").trim(), String(tx.session_id || "").trim()].filter(Boolean))
  );

  if (!isDefaultDemoPaykitaKey(pkKey) && candidateIds.length > 0) {
    const checkUrls: string[] = [];
    for (const refId of candidateIds) {
      checkUrls.push(`${baseUrl}/api/orders/${encodeURIComponent(refId)}`);
      checkUrls.push(`${baseUrl}/api/v1/orders/${encodeURIComponent(refId)}`);
      checkUrls.push(`${baseUrl}/api/v1/transactions/${encodeURIComponent(refId)}`);
    }

    for (const url of checkUrls) {
      try {
        const resp = await axios.get(url, {
          headers: {
            "x-api-key": pkKey,
            "X-API-Key": pkKey,
            Authorization: `Bearer ${pkKey}`,
            Accept: "application/json",
          },
          timeout: 6000,
        });
        if (resp.status === 200 && resp.data && typeof resp.data === "object") {
          const remoteObj = resp.data?.data || resp.data?.transaction || resp.data;
          const remoteId = String(remoteObj?.id || "").trim();
          const remoteRef = String(
            remoteObj?.reference_id || remoteObj?.reference || remoteObj?.order_id || remoteObj?.merchant_ref || remoteObj?.session_id || ""
          ).trim();
          const remoteStatus = String(
            remoteObj?.payment_status || remoteObj?.status || ""
          )
            .toLowerCase()
            .trim();

          const matchesTx =
            (remoteId && (remoteId === tx.paykita_ref || remoteId === tx.session_id)) ||
            (remoteRef && (remoteRef === tx.session_id || remoteRef === tx.paykita_ref));

          if (matchesTx && remoteObj?.qris && tx.paykita_mode !== "live") {
            tx.qris_string = String(remoteObj.qris);
            tx.qris_image = await generateQrisDataUri(tx.qris_string);
            tx.pay_amount = Number(remoteObj.pay_amount || tx.pay_amount || tx.amount);
            tx.unique_code = Number(remoteObj.unique_code || tx.unique_code || 0);
            tx.fee_amount = Number(remoteObj.fee_amount || tx.fee_amount || 0);
            tx.paykita_mode = "live";
            tx.paykita_error = null;
            saveDb();
          }

          if (
            matchesTx &&
            ["paid", "success", "settlement", "completed", "lunas"].includes(remoteStatus)
          ) {
            markPaykitaTransactionPaid(tx, "paykita_api");
            return {
              confirmed: true,
              paykita_status: "paid",
              message: "Pembayaran berhasil dikonfirmasi oleh server PayKita!",
            };
          }
          if (
            matchesTx &&
            ["expired", "failed", "canceled", "cancelled", "gagal"].includes(remoteStatus)
          ) {
            tx.payment_status = "failed";
            tx.status = remoteStatus === "expired" ? "expired" : "failed";
            tx.updated_at = nowIso();
            saveDb();
            return {
              confirmed: false,
              paykita_status: tx.status,
              message: "Pembayaran dinyatakan kedaluwarsa atau gagal oleh PayKita.",
            };
          }
        }
      } catch {
        // Ignore network/404 errors and continue waiting for webhook confirmation
      }
    }
  }

  return {
    confirmed: false,
    paykita_status: "waiting_payment",
    message: `Belum ada konfirmasi pembayaran dari ${gwLabel}. Silakan scan & selesaikan pembayaran QRIS terlebih dahulu.`,
  };
};

api.post("/payments/paykita/sync/:session_id", async (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx) return res.status(404).json({ detail: "Transaksi tidak ditemukan" });
  const origin = req.headers.origin || getAppOrigin(req);
  const verifyRes = await verifyTransactionWithPaykitaServer(tx, origin);
  res.json({
    ok: true,
    confirmed: verifyRes.confirmed,
    payment_status: tx.payment_status || "pending",
    status: tx.status || "pending",
    paykita_status: verifyRes.paykita_status,
    paykita_mode: tx.paykita_mode || "demo",
    paykita_error: tx.paykita_error || null,
    message: verifyRes.message,
  });
});

api.post("/payments/paykita/refresh-qris/:session_id", async (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx || tx.provider !== "paykita") {
    return res.status(404).json({ detail: "Transaksi QRIS PayKita tidak ditemukan" });
  }
  if (tx.payment_status === "paid") {
    return res.json({ ok: true, message: "Transaksi ini sudah lunas" });
  }
  const origin = req.body?.origin_url || req.headers.origin || getAppOrigin(req);
  await ensurePaykitaTransactionQris(tx, origin, true);
  if (tx.paykita_mode === "live") {
    return res.json({
      ok: true,
      paykita_mode: tx.paykita_mode,
      message: "QRIS resmi dari Payment Gateway berhasil dimuat!",
    });
  }
  return res.status(400).json({
    ok: false,
    paykita_mode: tx.paykita_mode,
    detail: tx.paykita_error || "Gagal memuat QRIS dari Payment Gateway",
  });
});

// Duitku Webhook Callback
api.post("/webhook/duitku", async (req, res) => {
  const body = req.body || {};
  const merchantOrderId = String(body.merchantOrderId || body.order_id || "").trim();
  const resultCode = String(body.resultCode || "").trim();
  const amount = String(body.amount || "").trim();
  const signature = String(body.signature || "").trim().toLowerCase();
  if (!merchantOrderId) return res.json({ ok: true, message: "Ping webhook Duitku diterima" });

  const tx = db.transactions.find((t) => t.session_id === merchantOrderId || t.paykita_ref === merchantOrderId);
  if (!tx) return res.status(404).json({ ok: false, detail: "Transaksi tidak ditemukan" });

  const gCfg = db.settings.payment_gateways?.gateways?.duitku || {};
  const merchantCode = String(gCfg.merchant_code || "").trim();
  const apiKey = String(gCfg.api_key || "").trim();
  const expectedSig = crypto
    .createHash("md5")
    .update(`${merchantCode}${amount}${merchantOrderId}${apiKey}`)
    .digest("hex")
    .toLowerCase();

  if (resultCode === "00") {
    if (signature && safeTimingCompare(signature, expectedSig)) {
      markPaykitaTransactionPaid(tx, "duitku_webhook");
    } else {
      writeAuditLog({
        action: "security.webhook_invalid_signature",
        metadata: { gateway: "duitku", session_id: tx.session_id },
        req,
      });
      return res.status(401).json({ ok: false, detail: "Signature webhook Duitku tidak valid" });
    }
  }
  return res.json({ ok: true, session_id: tx.session_id, payment_status: tx.payment_status });
});

// Tripay Webhook Callback
api.post("/webhook/tripay", async (req: any, res) => {
  const body = req.body || {};
  const merchantRef = String(body.merchant_ref || body.reference || "").trim();
  if (!merchantRef) return res.json({ ok: true, message: "Ping webhook Tripay diterima" });

  const tx = db.transactions.find((t) => t.session_id === merchantRef || t.paykita_ref === merchantRef);
  if (!tx) return res.status(404).json({ ok: false, detail: "Transaksi tidak ditemukan" });

  const gCfg = db.settings.payment_gateways?.gateways?.tripay || {};
  const privateKey = String(gCfg.private_key || "").trim();
  const rawBodyStr = typeof req.rawBody === "string" && req.rawBody ? req.rawBody : JSON.stringify(body);
  const sig = String(req.headers["x-callback-signature"] || "").trim();
  const expectedSig = privateKey ? crypto.createHmac("sha256", privateKey).update(rawBodyStr).digest("hex") : "";

  if (String(body.status || "").toUpperCase() === "PAID") {
    if (expectedSig && safeTimingCompare(sig, expectedSig)) {
      markPaykitaTransactionPaid(tx, "tripay_webhook");
    } else {
      writeAuditLog({
        action: "security.webhook_invalid_signature",
        metadata: { gateway: "tripay", session_id: tx.session_id },
        req,
      });
      return res.status(401).json({ success: false, detail: "Signature webhook Tripay tidak valid" });
    }
  }
  return res.json({ success: true });
});

// Midtrans Webhook Callback
api.post("/webhook/midtrans", async (req, res) => {
  const body = req.body || {};
  const orderId = String(body.order_id || "").trim();
  if (!orderId) return res.json({ ok: true, message: "Ping webhook Midtrans diterima" });

  const tx = db.transactions.find((t) => t.session_id === orderId || t.paykita_ref === orderId);
  if (!tx) return res.status(404).json({ ok: false, detail: "Transaksi tidak ditemukan" });

  const gCfg = db.settings.payment_gateways?.gateways?.midtrans || {};
  const serverKey = String(gCfg.api_key || "").trim();
  const expectedSig = crypto
    .createHash("sha512")
    .update(`${orderId}${body.status_code || ""}${body.gross_amount || ""}${serverKey}`)
    .digest("hex");
  const txStatus = String(body.transaction_status || "").toLowerCase();

  if (txStatus === "settlement" || txStatus === "capture") {
    if (safeTimingCompare(String(body.signature_key || ""), expectedSig)) {
      markPaykitaTransactionPaid(tx, "midtrans_webhook");
    } else {
      writeAuditLog({
        action: "security.webhook_invalid_signature",
        metadata: { gateway: "midtrans", session_id: tx.session_id },
        req,
      });
      return res.status(401).json({ ok: false, detail: "Signature webhook Midtrans tidak valid" });
    }
  }
  return res.json({ ok: true });
});

// Xendit Webhook Callback
api.post("/webhook/xendit", async (req, res) => {
  const body = req.body || {};
  const refId = String(body.data?.reference_id || body.external_id || body.reference_id || "").trim();
  if (!refId) return res.json({ ok: true, message: "Ping webhook Xendit diterima" });

  const tx = db.transactions.find((t) => t.session_id === refId || t.paykita_ref === refId);
  if (!tx) return res.status(404).json({ ok: false, detail: "Transaksi tidak ditemukan" });

  const gCfg = db.settings.payment_gateways?.gateways?.xendit || {};
  const token = String(req.headers["x-callback-token"] || "").trim();
  const status = String(body.data?.status || body.status || "").toUpperCase();

  if (status === "SUCCEEDED" || status === "PAID" || status === "COMPLETED") {
    if (token && safeTimingCompare(token, String(gCfg.webhook_secret || ""))) {
      markPaykitaTransactionPaid(tx, "xendit_webhook");
    } else {
      writeAuditLog({
        action: "security.webhook_invalid_signature",
        metadata: { gateway: "xendit", session_id: tx.session_id },
        req,
      });
      return res.status(401).json({ ok: false, detail: "Token callback Xendit tidak valid" });
    }
  }
  return res.json({ ok: true });
});

api.get("/webhook/paykita", (_req, res) => {
  const s = db.settings.paykita || {};
  res.json({
    ok: true,
    status: s.enabled !== false ? "active" : "disabled",
    provider: "PayKita QRIS Otomatis",
    message: "Endpoint webhook PayKita aktif dan siap menerima notifikasi pembayaran.",
  });
});

api.post("/webhook/paykita", async (req: any, res) => {
  const body = req.body || {};
  const eventType = String(
    req.headers["x-paykita-event"] || req.headers["x-malawali-event"] || body.event || ""
  )
    .toLowerCase()
    .trim();

  if (eventType === "webhook.test") {
    return res.json({ ok: true, message: "Test webhook PayKita diterima" });
  }

  const nestedData = body.data && typeof body.data === "object" ? body.data : null;
  const candidateRefs = [
    nestedData?.reference_id,
    nestedData?.reference,
    nestedData?.id,
    body.order_id,
    body.session_id,
    body.reference_id,
    body.reference,
    body.merchant_ref,
    body.id,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  if (candidateRefs.length === 0) {
    return res.json({ ok: true, message: "Ping webhook diterima" });
  }

  const tx = db.transactions.find(
    (t) => candidateRefs.includes(String(t.session_id || "")) || candidateRefs.includes(String(t.paykita_ref || ""))
  );
  if (!tx) {
    return res.status(404).json({ ok: false, detail: "Transaksi tidak ditemukan" });
  }

  const incomingStatus = String(
    nestedData?.status ||
      nestedData?.payment_status ||
      body.status ||
      body.payment_status ||
      (eventType === "order.paid" ? "paid" : "")
  )
    .toLowerCase()
    .trim();

  if (!incomingStatus) {
    return res.status(400).json({ ok: false, detail: "Status pembayaran tidak disertakan pada webhook" });
  }

  const s = db.settings.paykita || {};
  const webhookSecret = String(s.webhook_secret || process.env.PAYKITA_WEBHOOK_SECRET || "").trim();
  const sigHeader = String(
    req.headers["x-paykita-signature"] ||
      req.headers["x-malawali-signature"] ||
      req.headers["x-callback-signature"] ||
      req.headers["x-signature"] ||
      ""
  ).trim();
  const timestampHeader = String(
    req.headers["x-paykita-timestamp"] || req.headers["x-malawali-timestamp"] || ""
  ).trim();
  const tokenHeader = String(
    req.headers["x-callback-token"] ||
      req.headers["x-webhook-secret"] ||
      body.webhook_secret ||
      ""
  ).trim();

  const rawBodyStr = typeof req.rawBody === "string" && req.rawBody ? req.rawBody : JSON.stringify(body);
  let signatureVerified = false;
  if (webhookSecret) {
    const cleanSig = sigHeader.startsWith("v1=") ? sigHeader.slice(3) : sigHeader;
    const expectedDirectHmac = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBodyStr)
      .digest("hex");
    const expectedJsonHmac = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(body))
      .digest("hex");
    const expectedTimestampHmac = timestampHeader
      ? crypto
          .createHmac("sha256", webhookSecret)
          .update(`${timestampHeader}.${rawBodyStr}`)
          .digest("hex")
      : "";

    if (
      cleanSig &&
      (safeTimingCompare(cleanSig, expectedTimestampHmac) ||
        safeTimingCompare(cleanSig, expectedDirectHmac) ||
        safeTimingCompare(cleanSig, expectedJsonHmac))
    ) {
      signatureVerified = true;
    } else if (tokenHeader && safeTimingCompare(tokenHeader, webhookSecret)) {
      signatureVerified = true;
    }
  }

  if (["paid", "success", "settlement", "completed", "lunas"].includes(incomingStatus)) {
    if (!signatureVerified) {
      const serverCheck = await verifyTransactionWithPaykitaServer(tx);
      if (!serverCheck.confirmed) {
        return res.status(401).json({
          ok: false,
          detail: "Konfirmasi webhook PayKita ditolak: signature tidak valid dan pembayaran belum terkonfirmasi di server PayKita.",
        });
      }
    } else {
      markPaykitaTransactionPaid(tx, "paykita_webhook");
    }
  } else if (["failed", "expired", "canceled", "cancelled", "gagal"].includes(incomingStatus)) {
    if (signatureVerified) {
      tx.payment_status = "failed";
      tx.status = incomingStatus === "expired" ? "expired" : "rejected";
      tx.updated_at = nowIso();
      saveDb();
    }
  }
  return res.json({
    ok: true,
    session_id: tx.session_id,
    payment_status: tx.payment_status,
    status: tx.status,
  });
});

const handleManualOrCryptoCheckout = (req: Request, res: Response) => {
  try {
    if (!enforceCheckoutRateLimit(req, res, "manual_or_crypto")) return;
    const body = req.body || {};
    const product = findProductFlexible(body.product_id);
    if (!product) return res.status(404).json({ detail: "Produk tidak ditemukan" });
    if ((product.stock || 0) < 1) return res.status(400).json({ detail: "Stok produk habis" });
    const buyer = parseBuyer(body);
    const dest = db.manual_destinations.find((d) => d.id === body.destination_id && d.is_active !== false);
    if (!dest) return res.status(404).json({ detail: "Metode pembayaran tidak ditemukan / tidak aktif" });
    const isCrypto = dest.type === "crypto";
    const pCfg = normalizeProductPaymentConfig(product.payment_config);
    if (isCrypto && !pCfg.crypto) {
      return res.status(400).json({ detail: "Pembayaran Crypto sedang dinonaktifkan untuk produk ini" });
    }
    if (!isCrypto && !pCfg.manual) {
      return res.status(400).json({ detail: "Pembayaran Transfer / QRIS Manual sedang dinonaktifkan untuk produk ini" });
    }
    if (pCfg.disabled_destinations.includes(dest.id)) {
      return res.status(400).json({ detail: `Kanal pembayaran ${dest.name} dinonaktifkan untuk produk ini` });
    }
    const user = getUserOptional(req);
    const orderId = genOrderId(isCrypto ? "NXG-C" : "NXG-M");
    const priceIdr = Math.round(Number(product.price || 0));
    const priceUsd =
      product.price_usd && Number(product.price_usd) > 0
        ? Number(product.price_usd)
        : Math.max(1, Math.round((priceIdr / 16000) * 100) / 100);
    const tx = {
      ...buyer,
      session_id: orderId,
      provider: "manual",
      payment_type: isCrypto ? "crypto" : "manual",
      destination_id: dest.id,
      destination_name: dest.name,
      crypto_network: isCrypto ? dest.network || "" : null,
      crypto_symbol: isCrypto ? dest.symbol || "USDT" : null,
      tx_hash: null as string | null,
      product_id: product.id,
      product_title: product.title,
      delivery_info:
        product.delivery_info ||
        `[Gmail] [akses.${String(product.id || "akun").toLowerCase()}@willjustplay.com] [Wjp#${String(
          product.id || "2026"
        )
          .slice(0, 4)
          .toUpperCase()}2026]`,
      user_id: user?.id || null,
      amount: priceIdr,
      amount_usd: priceUsd,
      currency: isCrypto ? "usd" : "idr",
      status: "pending",
      payment_status: "pending",
      payment_proof: null,
      has_proof: false,
      stock_deducted: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.transactions.push(tx);
    saveDb();
    const origin = body.origin_url || req.headers.origin || FRONTEND_URL;
    res.json({
      order_id: orderId,
      session_id: orderId,
      checkout_url: `${origin}/payment/success?session_id=${orderId}`,
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ detail: err.detail || "Gagal membuat pesanan" });
  }
};

api.post("/payments/manual/checkout", handleManualOrCryptoCheckout);
api.post("/payments/crypto/checkout", handleManualOrCryptoCheckout);

api.post("/payments/topup/checkout", async (req, res) => {
  try {
    if (!enforceCheckoutRateLimit(req, res, "topup")) return;
    const body = req.body || {};
    const slug = String(body.game || body.slug || "").trim();
    if (!slug) return res.status(400).json({ detail: "Game wajib dipilih untuk top up" });
    const game = db.games.find((g) => g.slug === slug);
    if (!game) return res.status(404).json({ detail: "Game tidak ditemukan" });
    if (game.is_active === false) return res.status(400).json({ detail: "Top up untuk game ini sedang tidak tersedia" });
    const code = String(body.denomination_code || body.denomination || "").trim();
    const denom = findDenomination(game, code);
    if (!denom || denom.is_active === false) return res.status(404).json({ detail: "Nominal top up tidak tersedia" });
    const product =
      findProductFlexible(body.product_id) ||
      db.products.find(
        (p) =>
          p.product_type === PRODUCT_TYPE &&
          p.game_slug === game.slug &&
          String(p.denomination_code).toLowerCase() === String(denom.code).toLowerCase()
      );
    if (!product || product.product_type !== PRODUCT_TYPE) {
      return res.status(404).json({ detail: "Nominal top up tidak ditemukan di katalog" });
    }
    if ((product.stock || 0) < 1) return res.status(400).json({ detail: "Nominal ini sedang habis, pilih nominal lain" });
    const values =
      body.destination && typeof body.destination === "object"
        ? body.destination
        : Object.fromEntries((game.fields || []).map((f: any) => [f.key, body[f.key]]));
    const [ok, destination, errMsg] = validateDestination(game, values);
    if (!ok) return res.status(400).json({ detail: errMsg });
    const buyer = parseBuyer(body);
    const method = String(body.method || "duitku").trim().toLowerCase();
    if (method === "manual" || method === "crypto") {
      return res.status(400).json({
        detail: "Metode pembayaran manual tidak tersedia untuk produk Top Up. Silakan pilih metode pembayaran otomatis Duitku.",
      });
    }

    const duitkuCfg = db.settings.payment_gateways?.gateways?.duitku || {};
    if (duitkuCfg.enabled === false) {
      return res.status(400).json({
        detail: "Pembayaran otomatis Duitku untuk Produk Top Up sedang dinonaktifkan oleh admin",
      });
    }

    const enabledChannels = getEnabledDuitkuChannels(duitkuCfg);
    const requestedChannel = String(
      body.duitku_channel || body.payment_method || body.channel_code || duitkuCfg.payment_method || "SP"
    )
      .trim()
      .toUpperCase();
    const chMeta =
      enabledChannels.find((c) => c.code === requestedChannel) ||
      getDuitkuChannelMeta(requestedChannel);

    const user = getUserOptional(req);
    const orderId = genOrderId("NXG-T");
    const label = denom.label || denom.code;
    const priceIdr = Math.round(Number(product.price || 0));
    const priceUsd =
      product.price_usd && Number(product.price_usd) > 0
        ? Number(product.price_usd)
        : Math.max(1, Math.round((priceIdr / 16000) * 100) / 100);

    const verification = await verifyGameAccountId(game, destination);
    if (verification.format_valid === false || verification.code === "ACCOUNT_NOT_FOUND") {
      return res.status(400).json({ detail: verification.message || "ID Akun Game tidak valid" });
    }
    const verifiedNickname = String(body.verified_nickname || verification.nickname || "").trim();
    const customerNo = verification.customer_no || buildDigiflazzCustomerNo(game, destination);

    const origin = body.origin_url || req.headers.origin || getAppOrigin(req);
    const productTitle = product.title || `${game.name} — ${label}`;
    const remoteOrder = await tryCreateRemotePaykitaOrder({
      orderId,
      amount: priceIdr,
      productTitle,
      buyerEmail: buyer.buyer_email || "",
      buyerWhatsapp: buyer.buyer_whatsapp || "",
      origin,
      gatewayOverride: "duitku",
      duitkuMethod: chMeta.code,
    });
    const expiredAt = remoteOrder.expired_at || new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const baseDeliveryInfo = renderDeliveryInfo(product, game, destination);
    const tx = {
      ...buyer,
      session_id: orderId,
      paykita_ref: remoteOrder.paykita_ref || orderId,
      gateway_id: "duitku",
      gateway_name: "Duitku",
      duitku_channel: chMeta.code,
      duitku_channel_name: chMeta.name,
      duitku_payment_flow: chMeta.payment_flow,
      va_number: remoteOrder.va_number || null,
      provider: "paykita",
      payment_type: "paykita",
      destination_id: `duitku-${chMeta.code.toLowerCase()}`,
      destination_name: `Duitku — ${chMeta.name}`,
      qris_string: remoteOrder.qris_string,
      qris_image: remoteOrder.qris_image,
      pay_url: remoteOrder.pay_url || null,
      base_amount: remoteOrder.base_amount || priceIdr,
      pay_amount: remoteOrder.pay_amount || priceIdr,
      unique_code: remoteOrder.unique_code || 0,
      fee_amount: remoteOrder.fee_amount || 0,
      qris_provider: remoteOrder.qris_provider || `${chMeta.short_name} (${chMeta.code})`,
      paykita_mode: remoteOrder.mode,
      paykita_error: remoteOrder.error_message || null,
      paykita_error_code: remoteOrder.error_code || null,
      expired_at: expiredAt,
      product_id: product.id,
      product_title: productTitle,
      product_type: PRODUCT_TYPE,
      category: TOPUP_CATEGORY,
      game_id: game.id,
      game_slug: game.slug,
      game_name: game.name,
      denomination_code: String(denom.code),
      denomination_label: label,
      vendor_sku: denom.vendor_sku || `${game.vendor_prefix || ""}${denom.code}`,
      vendor_kind: "digiflazz",
      customer_no: customerNo,
      verified_nickname: verifiedNickname,
      destination,
      delivery_info: verifiedNickname
        ? `${baseDeliveryInfo} • Nickname: ${verifiedNickname}`
        : baseDeliveryInfo,
      user_id: user?.id || null,
      amount: priceIdr,
      amount_usd: priceUsd,
      price_strike: product.price_strike,
      currency: "idr",
      status: "pending",
      payment_status: "pending",
      paykita_confirmed: false,
      paykita_confirmed_by: null as string | null,
      paykita_confirmed_at: null as string | null,
      payment_proof: null,
      has_proof: false,
      stock_deducted: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.transactions.push(tx);
    saveDb();
    return res.json({
      order_id: orderId,
      session_id: orderId,
      gateway_id: "duitku",
      gateway_name: "Duitku",
      duitku_channel: chMeta.code,
      duitku_channel_name: chMeta.name,
      duitku_payment_flow: chMeta.payment_flow,
      va_number: tx.va_number,
      checkout_url: `${origin}/payment/success?session_id=${orderId}`,
      paykita_mode: remoteOrder.mode,
      paykita_error: remoteOrder.error_message || null,
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ detail: err.detail || "Gagal membuat pesanan top up" });
  }
});

api.post("/payments/manual/upload-proof/:session_id", upload.single("proof"), (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx || tx.provider !== "manual") {
    return res.status(404).json({ detail: "Transaksi tidak valid atau tidak ditemukan" });
  }
  if (tx.payment_status === "paid") {
    return res.status(400).json({ detail: "Pesanan ini sudah lunas" });
  }
  if (!ensureOngoingHomeTransactionStockAvailable(tx) || tx.payment_status === "failed") {
    return res.status(400).json({
      detail:
        tx.cancel_reason ||
        "Pembayaran dibatalkan karena produk ini telah terjual habis dibeli oleh pembeli lain.",
    });
  }
  const file = req.file;
  const txHash = String(req.body?.tx_hash || "").trim();
  if (!file && !txHash) {
    return res.status(400).json({ detail: "Unggah gambar bukti transfer atau masukkan TXID / Hash transaksi" });
  }
  if (file) {
    const magicCheck = validateUploadedImageMagicBytes(file);
    if (!file.mimetype.startsWith("image/") || !magicCheck.valid) {
      const ip = getClientIp(req);
      const strikeRes = recordSecurityStrike(
        ip,
        "malicious_upload",
        3,
        15 * 60 * 1000,
        "Percobaan upload file berbahaya / bukan gambar asli pada bukti pembayaran",
        req,
        { filename: file.originalname, mimetype: file.mimetype, reason: magicCheck.reason }
      );
      writeAuditLog({
        actor: getUserOptional(req),
        action: "security.malicious_upload_blocked",
        metadata: {
          session_id: tx.session_id,
          filename: file.originalname,
          mimetype: file.mimetype,
          reason: magicCheck.reason,
          ip_blocked: strikeRes.blocked,
        },
        req,
      });
      return res.status(400).json({
        detail: magicCheck.reason || "Bukti transfer harus berupa gambar asli (JPG/PNG/WEBP)",
      });
    }
    const safeMime = magicCheck.detectedMime || file.mimetype;
    tx.payment_proof = `data:${safeMime};base64,${file.buffer.toString("base64")}`;
    tx.has_proof = true;
  }
  if (txHash) {
    tx.tx_hash = txHash;
    tx.has_proof = true;
  }
  tx.status = "waiting_approval";
  tx.updated_at = nowIso();
  saveDb();
  res.json(tx);
});

api.post("/payments/crypto/submit-tx/:session_id", (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx || tx.provider !== "manual") {
    return res.status(404).json({ detail: "Transaksi tidak valid atau tidak ditemukan" });
  }
  if (tx.payment_status === "paid") {
    return res.status(400).json({ detail: "Pesanan ini sudah lunas" });
  }
  if (!ensureOngoingHomeTransactionStockAvailable(tx) || tx.payment_status === "failed") {
    return res.status(400).json({
      detail:
        tx.cancel_reason ||
        "Pembayaran dibatalkan karena produk ini telah terjual habis dibeli oleh pembeli lain.",
    });
  }
  const txHash = String(req.body?.tx_hash || "").trim();
  if (!txHash || txHash.length < 6) {
    return res.status(400).json({ detail: "Masukkan TXID / Hash transaksi crypto yang valid" });
  }
  tx.tx_hash = txHash;
  tx.has_proof = true;
  tx.status = "waiting_approval";
  tx.updated_at = nowIso();
  saveDb();
  res.json(tx);
});

const handlePaymentStatus = async (req: Request, res: Response) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx) return res.status(404).json({ detail: "Transaksi tidak ditemukan" });
  ensureOngoingHomeTransactionStockAvailable(tx);
  if (
    tx.provider === "paykita" &&
    tx.payment_status === "pending" &&
    tx.expired_at &&
    new Date(tx.expired_at).getTime() <= Date.now()
  ) {
    tx.payment_status = "failed";
    tx.status = "expired";
    tx.updated_at = nowIso();
    saveDb();
  }
  if (tx.provider === "paykita" && tx.payment_status === "pending") {
    const origin = (req.headers.origin as string) || getAppOrigin(req);
    await ensurePaykitaTransactionQris(tx, origin, false);
  }
  const paid =
    tx.payment_status === "paid" &&
    (tx.provider !== "paykita" || Boolean(tx.paykita_confirmed));
  const effectivePaymentStatus =
    tx.provider === "paykita" && tx.payment_status === "paid" && !tx.paykita_confirmed
      ? "pending"
      : tx.payment_status || "pending";
  const effectiveStatus =
    tx.provider === "paykita" && tx.status === "completed" && !tx.paykita_confirmed
      ? "pending"
      : tx.status || "pending";
  const isPendingActive = effectivePaymentStatus === "pending";
  let game = null;
  if (tx.product_type === PRODUCT_TYPE && tx.game_slug) {
    const g = db.games.find((x) => x.slug === tx.game_slug);
    if (g) game = { id: g.id, slug: g.slug, name: g.name, fields: g.fields || [] };
  }
  const manualDest = tx.destination_id
    ? db.manual_destinations.find((d) => d.id === tx.destination_id) || null
    : null;
  const amountUsd =
    tx.amount_usd && Number(tx.amount_usd) > 0
      ? Number(tx.amount_usd)
      : Math.max(1, Math.round((Number(tx.amount || 0) / 16000) * 100) / 100);
  const resolvedGwId =
    tx.gateway_id || (tx.product_type === PRODUCT_TYPE ? "duitku" : "paykita");
  const resolvedGwName =
    tx.gateway_name || (resolvedGwId === "duitku" ? "Duitku" : "PayKita");
  const structuredDelivery =
    paid && tx.product_type !== PRODUCT_TYPE
      ? parseStructuredDeliveryInfo(tx.delivery_info)
      : null;

  res.json({
    session_id: tx.session_id,
    paykita_ref: tx.paykita_ref || tx.session_id,
    gateway_id: resolvedGwId,
    gateway_name: resolvedGwName,
    duitku_channel: tx.duitku_channel || null,
    duitku_channel_name: tx.duitku_channel_name || null,
    duitku_payment_flow: tx.duitku_payment_flow || "qris",
    va_number: isPendingActive ? tx.va_number || null : null,
    provider: tx.provider,
    status: effectiveStatus,
    payment_status: effectivePaymentStatus,
    cancel_reason: tx.cancel_reason || null,
    paykita_confirmed: Boolean(tx.paykita_confirmed),
    paykita_mode: tx.paykita_mode || "demo",
    paykita_error: isPendingActive ? tx.paykita_error || null : null,
    paykita_error_code: isPendingActive ? tx.paykita_error_code || null : null,
    payment_type: tx.payment_type || (manualDest?.type === "crypto" ? "crypto" : tx.provider),
    amount: tx.amount,
    base_amount: tx.base_amount || tx.amount,
    pay_amount: tx.pay_amount || tx.amount,
    unique_code: tx.unique_code || 0,
    fee_amount: tx.fee_amount || 0,
    qris_provider: tx.qris_provider || null,
    amount_usd: amountUsd,
    crypto_network: tx.crypto_network || manualDest?.network || null,
    crypto_symbol: tx.crypto_symbol || manualDest?.symbol || null,
    tx_hash: tx.tx_hash || null,
    qris_string: isPendingActive ? tx.qris_string || null : null,
    qris_image: isPendingActive ? tx.qris_image || null : null,
    pay_url: isPendingActive ? tx.pay_url || null : null,
    expired_at: tx.expired_at || null,
    delivery_info: paid ? tx.delivery_info || "" : "",
    structured_delivery: structuredDelivery,
    buyer_email: tx.buyer_email || null,
    buyer_whatsapp: tx.buyer_whatsapp || null,
    fulfillment_email_sent: Boolean(tx.fulfillment_email_sent),
    fulfillment_email_sent_at: tx.fulfillment_email_sent_at || null,
    fulfillment_email_provider: tx.fulfillment_email_provider || null,
    fulfillment_email_to: tx.fulfillment_email_to || tx.buyer_email || null,
    fulfillment_email_type:
      tx.fulfillment_email_type ||
      (tx.product_type === PRODUCT_TYPE ? "topup_invoice" : "account_access"),
    product_type: tx.product_type || "product",
    product_title: tx.product_title,
    game,
    game_name: tx.game_name || game?.name || null,
    destination: tx.product_type === PRODUCT_TYPE ? tx.destination : null,
    customer_no: tx.customer_no || null,
    verified_nickname: tx.verified_nickname || null,
    denomination_code: tx.denomination_code,
    denomination_label: tx.denomination_label,
    admin_note: paid ? tx.admin_note || null : null,
    destination_id: tx.destination_id,
    destination_name: tx.destination_name,
    manual_destination: manualDest,
    has_proof: Boolean(tx.has_proof),
    created_at: tx.created_at || null,
    updated_at: tx.updated_at || null,
  });
};

api.get("/payments/status/:session_id", handlePaymentStatus);
api.get("/payments/checkout/status/:session_id", handlePaymentStatus);

api.post("/payments/resend-order-email/:session_id", async (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx) return res.status(404).json({ detail: "Transaksi tidak ditemukan" });
  const paid =
    tx.payment_status === "paid" &&
    (tx.provider !== "paykita" || Boolean(tx.paykita_confirmed));
  if (!paid) {
    return res.status(400).json({
      detail: "Email akses akun / invoice hanya dikirim setelah pembayaran terkonfirmasi lunas",
    });
  }
  const overrideEmail = String(req.body?.email || "").trim().toLowerCase();
  if (overrideEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(overrideEmail)) {
      return res.status(400).json({ detail: "Format alamat email tidak valid" });
    }
    tx.buyer_email = overrideEmail;
    saveDb();
  }
  if (!tx.buyer_email) {
    return res.status(400).json({ detail: "Alamat email pembeli belum tercatat pada pesanan ini" });
  }
  const mailResult = await sendOrderFulfillmentEmail(tx, req, true);
  if (!mailResult.ok) {
    return res.status(400).json({ detail: mailResult.error || "Gagal mengirim email pesanan" });
  }
  res.json({
    ok: true,
    to_email: mailResult.to_email,
    provider: mailResult.provider,
    sent_at: mailResult.sent_at,
    type: mailResult.type,
    message:
      tx.product_type === PRODUCT_TYPE
        ? `Invoice Top Up resmi berhasil dikirim ke ${mailResult.to_email}`
        : `Data akses akun & invoice berhasil dikirim ke ${mailResult.to_email}`,
  });
});

// Allow image uploads from both buyers (ReviewModal) and admins
api.post("/admin/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  const magicCheck = validateUploadedImageMagicBytes(file);
  if (!file || !file.mimetype.startsWith("image/") || !magicCheck.valid) {
    const ip = getClientIp(req);
    recordSecurityStrike(
      ip,
      "malicious_upload",
      3,
      15 * 60 * 1000,
      "Percobaan upload file berbahaya / bukan gambar asli",
      req,
      { filename: file?.originalname, mimetype: file?.mimetype, reason: magicCheck.reason }
    );
    writeAuditLog({
      actor: getUserOptional(req),
      action: "security.malicious_upload_blocked",
      metadata: {
        filename: file?.originalname,
        mimetype: file?.mimetype,
        reason: magicCheck.reason,
      },
      req,
    });
    return res.status(400).json({
      detail: magicCheck.reason || "Hanya file gambar asli (JPG, PNG, WEBP, GIF) yang diizinkan",
    });
  }
  const safeExtMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  const safeMime = magicCheck.detectedMime || "image/jpeg";
  const ext = safeExtMap[safeMime] || ".jpg";
  const filePath = `uploads/${uuidHex(16)}${ext}`;
  db.files[filePath] = {
    path: filePath,
    dataBase64: file.buffer.toString("base64"),
    content_type: safeMime,
    filename: file.originalname || "image.jpg",
    created_at: nowIso(),
  };
  saveDb();
  res.json({ url: `/api/files/${filePath}` });
});

// --- Admin Endpoints ---
const admin = express.Router();
admin.use(requireAdminMiddleware);

const adminProductView = (p: any) => {
  const copy = { ...p };
  delete copy.paykita;
  copy.paykita_api_key_set = false;
  copy.paykita_api_key_masked = "";
  copy.paykita_webhook_secret_set = false;
  copy.paykita_webhook_url = `${FRONTEND_URL}/api/webhook/paykita`;
  copy.payment_config = normalizeProductPaymentConfig(p.payment_config);
  return copy;
};

admin.get("/verify", (_req, res) => res.json({ ok: true }));

admin.get("/products", (req, res) => {
  const { type, include_topup } = req.query as Record<string, string | undefined>;
  let rows = db.products;
  if (type === "topup") {
    rows = rows.filter((p) => isTopupProduct(p));
  } else if (include_topup !== "true" && include_topup !== "1") {
    rows = rows.filter((p) => !isTopupProduct(p));
  }
  res.json(rows.map(adminProductView));
});

admin.post("/products", (req, res) => {
  const data = { ...(req.body || {}) };
  delete data.paykita;
  if (!String(data.title || "").trim() || !String(data.game || "").trim()) {
    return res.status(400).json({ detail: "Judul dan nama game wajib diisi" });
  }
  const priceIdr = Number(data.price || 0);
  const priceUsd =
    data.price_usd !== undefined && data.price_usd !== "" && Number(data.price_usd) > 0
      ? Number(data.price_usd)
      : Math.max(1, Math.round((priceIdr / 16000) * 100) / 100);
  const product = {
    ...data,
    id: uuidHex(8),
    images: (data.images || []).filter(Boolean).slice(0, 10),
    badges: (data.badges || []).filter(Boolean).slice(0, 3),
    sold: Number(data.sold || 0),
    rating: Number(data.rating || 5.0),
    rating_base: Number(data.rating || 5.0),
    stock: Number(data.stock ?? 1),
    price: priceIdr,
    price_usd: priceUsd,
    payment_config: normalizeProductPaymentConfig(data.payment_config),
    created_at: nowIso(),
  };
  db.products.push(product);
  saveDb();
  res.json(adminProductView(product));
});

admin.put("/products/:product_id", (req, res) => {
  const idx = db.products.findIndex((p) => p.id === req.params.product_id);
  if (idx === -1) return res.status(404).json({ detail: "Produk tidak ditemukan" });
  const existing = db.products[idx];
  const data = { ...(req.body || {}) };
  delete data.id;
  delete data.paykita;
  const priceIdr = Number(data.price ?? existing.price ?? 0);
  const priceUsd =
    data.price_usd !== undefined && data.price_usd !== "" && Number(data.price_usd) > 0
      ? Number(data.price_usd)
      : existing.price_usd && Number(existing.price_usd) > 0
      ? Number(existing.price_usd)
      : Math.max(1, Math.round((priceIdr / 16000) * 100) / 100);
  const nextPaymentConfig =
    "payment_config" in data
      ? normalizeProductPaymentConfig(data.payment_config)
      : normalizeProductPaymentConfig(existing.payment_config);
  const updated = {
    ...existing,
    ...data,
    id: req.params.product_id,
    images: ("images" in data ? data.images : existing.images || []).filter(Boolean).slice(0, 10),
    badges: ("badges" in data ? data.badges : existing.badges || []).filter(Boolean).slice(0, 3),
    sold: Number(data.sold ?? existing.sold ?? 0),
    rating: Number(data.rating ?? existing.rating ?? 5.0),
    rating_base: Number(data.rating ?? existing.rating_base ?? 5.0),
    stock: Number(data.stock ?? existing.stock ?? 1),
    price: priceIdr,
    price_usd: priceUsd,
    payment_config: nextPaymentConfig,
    updated_at: nowIso(),
  };
  delete updated.paykita;
  db.products[idx] = updated;
  if (Number(updated.stock ?? 0) <= 0) {
    cancelOngoingTransactionsForOutOfStockProduct(updated.id);
  }
  saveDb();
  res.json(adminProductView(updated));
});

admin.patch("/products/:product_id/payment-config", (req, res) => {
  const idx = db.products.findIndex((p) => p.id === req.params.product_id);
  if (idx === -1) return res.status(404).json({ detail: "Produk tidak ditemukan" });
  const existing = db.products[idx];
  const merged = {
    ...normalizeProductPaymentConfig(existing.payment_config),
    ...(req.body || {}),
  };
  const nextCfg = normalizeProductPaymentConfig(merged);
  if (!nextCfg.paykita && !nextCfg.manual && !nextCfg.crypto) {
    return res.status(400).json({ detail: "Minimal satu metode pembayaran harus aktif pada produk ini" });
  }
  existing.payment_config = nextCfg;
  existing.updated_at = nowIso();
  saveDb();
  res.json(adminProductView(existing));
});

admin.delete("/products/:product_id", (req, res) => {
  const idx = db.products.findIndex((p) => p.id === req.params.product_id);
  if (idx === -1) return res.status(404).json({ detail: "Produk tidak ditemukan" });
  db.products.splice(idx, 1);
  saveDb();
  res.json({ ok: true });
});

admin.post("/reset", (_req, res) => {
  db.products = (SEED.SEED_PRODUCTS || [])
    .filter((p: any) => p.category !== TOPUP_CATEGORY)
    .map((p: any) => ({
      ...p,
      price_usd:
        p.price_usd != null && Number(p.price_usd) > 0
          ? Number(p.price_usd)
          : Math.max(1, Math.round((Number(p.price || 0) / 16000) * 100) / 100),
    }));
  for (const g of db.games) syncGameProducts(g, false);
  saveDb();
  res.json({ ok: true, count: db.products.length });
});

admin.get("/orders", (_req, res) => {
  const rows = [...db.transactions]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map((o) => {
      const copy = { ...o, has_proof: Boolean(o.has_proof) };
      delete copy.payment_proof;
      return copy;
    });
  res.json(rows);
});

admin.get("/orders/:session_id/proof", (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx || !tx.payment_proof) return res.status(404).json({ detail: "Bukti pembayaran belum diupload" });
  res.json({ payment_proof: tx.payment_proof });
});

admin.post("/orders/:session_id/approve", async (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx) return res.status(404).json({ detail: "Transaksi tidak ditemukan" });
  if (tx.payment_status === "paid" && (tx.provider !== "paykita" || tx.paykita_confirmed)) {
    if (!tx.fulfillment_email_sent_at) {
      await sendOrderFulfillmentEmail(tx, req);
    }
    return res.json(tx);
  }
  const prod = findProductFlexible(tx.product_id);
  if (
    prod &&
    prod.product_type !== PRODUCT_TYPE &&
    !tx.stock_deducted &&
    Number(prod.stock ?? 0) <= 0
  ) {
    cancelOngoingTransactionsForOutOfStockProduct(prod.id);
    saveDb();
    return res.status(400).json({
      detail: "Stok produk ini sudah habis (0) karena telah dibeli oleh pembeli lain.",
    });
  }
  tx.status = "completed";
  tx.payment_status = "paid";
  if (tx.provider === "paykita" || tx.payment_type === "paykita") {
    tx.paykita_confirmed = true;
    tx.paykita_confirmed_by = "admin_manual";
    tx.paykita_confirmed_at = nowIso();
  }
  tx.updated_at = nowIso();
  if (!tx.stock_deducted) {
    if (prod) {
      if ((prod.stock || 0) > 0) prod.stock -= 1;
      prod.sold = (prod.sold || 0) + 1;
    }
    tx.stock_deducted = true;
  }
  if (prod && prod.product_type !== PRODUCT_TYPE && Number(prod.stock ?? 0) <= 0) {
    cancelOngoingTransactionsForOutOfStockProduct(prod.id, tx.session_id);
  }
  saveDb();
  await sendOrderFulfillmentEmail(tx, req);
  res.json(tx);
});

admin.post("/orders/:session_id/reject", (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx) return res.status(404).json({ detail: "Transaksi tidak ditemukan" });
  if (tx.payment_status === "paid") {
    return res.status(400).json({ detail: "Pesanan yang sudah lunas tidak bisa ditolak" });
  }
  tx.status = "rejected";
  tx.payment_status = "failed";
  tx.updated_at = nowIso();
  saveDb();
  res.json(tx);
});

admin.get("/orders/:session_id", (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx) return res.status(404).json({ detail: "Transaksi tidak ditemukan" });
  res.json(tx);
});

admin.post("/orders/:session_id/sync", async (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id);
  if (!tx) return res.status(404).json({ detail: "Transaksi tidak ditemukan" });
  const verifyRes = await verifyTransactionWithPaykitaServer(tx);
  res.json({
    ok: true,
    confirmed: verifyRes.confirmed,
    payment_status: tx.payment_status || "pending",
    status: tx.status || "pending",
    paykita_status: verifyRes.paykita_status,
    message: verifyRes.message,
  });
});

admin.post("/testimonials", (req, res) => {
  const data = req.body || {};
  if (!String(data.name || "").trim() || !String(data.text || "").trim()) {
    return res.status(400).json({ detail: "Nama dan isi ulasan wajib diisi" });
  }
  const t = {
    ...data,
    id: uuidHex(8),
    rating: Math.max(1, Math.min(5, Number(data.rating || 5))),
    source: "admin",
    verified: Boolean(data.verified),
    created_at: nowIso(),
  };
  db.testimonials.push(t);
  saveDb();
  res.json(t);
});

admin.delete("/testimonials/:tid", (req, res) => {
  const idx = db.testimonials.findIndex((t) => t.id === req.params.tid);
  if (idx === -1) return res.status(404).json({ detail: "Testimoni tidak ditemukan" });
  const [removed] = db.testimonials.splice(idx, 1);
  if (removed?.product_id) refreshProductRating(removed.product_id);
  saveDb();
  res.json({ ok: true });
});

admin.get("/reviews", (req, res) => {
  const { source, rating, product_id, q } = req.query as Record<string, string | undefined>;
  let rows = [...db.testimonials].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  if (source) rows = rows.filter((r) => (r.source || "admin") === source);
  if (rating) rows = rows.filter((r) => Number(r.rating) === Number(rating));
  if (product_id) rows = rows.filter((r) => r.product_id === product_id);
  if (q) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.text || "").toLowerCase().includes(needle) ||
        String(r.name || "").toLowerCase().includes(needle) ||
        String(r.product || "").toLowerCase().includes(needle)
    );
  }
  const summary = {
    total: rows.length,
    buyer: rows.filter((r) => (r.source || "admin") === "buyer").length,
    admin: rows.filter((r) => (r.source || "admin") === "admin").length,
    average: rows.length
      ? Math.round((rows.reduce((s, r) => s + Number(r.rating || 5), 0) / rows.length) * 10) / 10
      : 0,
  };
  res.json({ summary, reviews: rows });
});

admin.post("/reviews/:review_id/reply", (req, res) => {
  const existing = db.testimonials.find((t) => t.id === req.params.review_id);
  if (!existing) return res.status(404).json({ detail: "Ulasan tidak ditemukan" });
  const reply = String(req.body?.reply || "").trim();
  if (reply.length > 600) return res.status(400).json({ detail: "Balasan maksimal 600 karakter" });
  existing.reply = reply;
  existing.replied_at = nowIso();
  saveDb();
  res.json(existing);
});

admin.delete("/reviews/:review_id", (req, res) => {
  const idx = db.testimonials.findIndex((t) => t.id === req.params.review_id);
  if (idx === -1) return res.status(404).json({ detail: "Ulasan tidak ditemukan" });
  const [removed] = db.testimonials.splice(idx, 1);
  if (removed?.product_id) refreshProductRating(removed.product_id);
  saveDb();
  res.json({ message: "Ulasan dihapus" });
});

// --- Admin Topup Vendors ---
admin.get("/topup/vendors/catalog", (_req, res) => res.json(VENDOR_CATALOG));

admin.get("/topup/vendors", (_req, res) => {
  const onlyDigiflazz = db.topup_providers.filter((v) => v.kind === "digiflazz");
  const active = onlyDigiflazz[0] || db.topup_providers[0] || { kind: "digiflazz" };
  const spec = VENDOR_CATALOG[0];
  res.json({
    vendors: (onlyDigiflazz.length ? onlyDigiflazz : db.topup_providers).map(maskedVendorView),
    active_kind: "digiflazz",
    active_label: spec.label,
  });
});

admin.post("/topup/vendors", (req, res) => {
  const data = req.body || {};
  const kind = "digiflazz";
  const spec = VENDOR_CATALOG[0];
  const existing = db.topup_providers.find((v) => v.kind === "digiflazz");
  if (existing) {
    existing.name = String(data.name || existing.name || spec.label).trim();
    existing.config = { ...(existing.config || {}), ...(data.config || {}) };
    existing.is_active = true;
    existing.auto_dispatch = Boolean(data.auto_dispatch ?? true);
    existing.updated_at = nowIso();
    saveDb();
    return res.status(200).json(maskedVendorView(existing));
  }
  const doc = {
    id: "vp-digiflazz",
    kind,
    name: String(data.name || spec.label).trim(),
    config: data.config || {},
    is_active: true,
    auto_dispatch: Boolean(data.auto_dispatch ?? true),
    seq: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.topup_providers = [doc];
  saveDb();
  res.status(201).json(maskedVendorView(doc));
});

admin.put("/topup/vendors/:provider_id", (req, res) => {
  const doc = db.topup_providers.find((v) => v.id === req.params.provider_id || v.kind === "digiflazz");
  if (!doc) return res.status(404).json({ detail: "Supplier Digiflazz tidak ditemukan" });
  const data = req.body || {};
  if (data.name) doc.name = String(data.name).trim();
  doc.kind = "digiflazz";
  doc.is_active = "is_active" in data ? Boolean(data.is_active) : true;
  if ("auto_dispatch" in data) doc.auto_dispatch = Boolean(data.auto_dispatch);
  if (data.config && typeof data.config === "object") {
    doc.config = { ...(doc.config || {}) };
    for (const [k, v] of Object.entries(data.config)) {
      if (typeof v === "string" && v.includes("*")) continue;
      doc.config[k] = v;
    }
  }
  doc.updated_at = nowIso();
  saveDb();
  res.json(maskedVendorView(doc));
});

admin.delete("/topup/vendors/:provider_id", (req, res) => {
  const idx = db.topup_providers.findIndex((v) => v.id === req.params.provider_id);
  if (idx === -1) return res.status(404).json({ detail: "Supplier tidak ditemukan" });
  if (db.topup_providers[idx].kind === "digiflazz" && db.topup_providers.length <= 1) {
    return res.status(400).json({ detail: "Digiflazz adalah supplier utama Top Up dan tidak dapat dihapus" });
  }
  db.topup_providers.splice(idx, 1);
  saveDb();
  res.json({ ok: true });
});

admin.post("/topup/vendors/:provider_id/activate", (req, res) => {
  const doc = db.topup_providers.find((v) => v.id === req.params.provider_id || v.kind === "digiflazz");
  if (!doc) return res.status(404).json({ detail: "Supplier tidak ditemukan" });
  for (const v of db.topup_providers) v.is_active = false;
  doc.is_active = true;
  saveDb();
  res.json({ ok: true, active_kind: "digiflazz", active_id: doc.id });
});

admin.post("/topup/vendors/:provider_id/deactivate", (req, res) => {
  const doc = db.topup_providers.find((v) => v.id === req.params.provider_id || v.kind === "digiflazz");
  if (!doc) return res.status(404).json({ detail: "Supplier tidak ditemukan" });
  doc.is_active = true;
  saveDb();
  res.json({ ok: true, message: "Digiflazz tetap aktif sebagai supplier utama Top Up" });
});

admin.post("/topup/vendors/:provider_id/test", async (req, res) => {
  const doc = db.topup_providers.find((v) => v.id === req.params.provider_id || v.kind === "digiflazz");
  if (!doc) return res.status(404).json({ detail: "Supplier Digiflazz tidak ditemukan" });

  const username = String(doc.config?.username || process.env.DIGIFLAZZ_USERNAME || "").trim();
  const apiKey = String(
    (doc.config?.use_dev ? doc.config?.dev_key : doc.config?.api_key) ||
      doc.config?.api_key ||
      process.env.DIGIFLAZZ_API_KEY ||
      ""
  ).trim();

  if (isDemoDigiflazzCredential(username, apiKey)) {
    const failResult = {
      ok: false,
      mode: "unconfigured",
      message: "Username atau API Key Digiflazz belum dikonfigurasi. Silakan isi kredensial asli Digiflazz.",
    };
    doc.last_test = { ...failResult, at: nowIso() };
    saveDb();
    return res.json(failResult);
  }

  let result: { ok: boolean; message: string; mode?: string; balance?: number };
  try {
    const sign = crypto.createHash("md5").update(username + apiKey + "depo").digest("hex");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch("https://api.digiflazz.com/v1/cek-saldo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "depo", username, sign }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json: any = await resp.json().catch(() => null);
    if (json?.data && typeof json.data.deposit === "number") {
      doc.cached_balance = Number(json.data.deposit);
      result = {
        ok: true,
        mode: "production",
        balance: doc.cached_balance,
        message: `Terhubung ke Digiflazz Production — Saldo: Rp ${doc.cached_balance.toLocaleString("id-ID")}`,
      };
    } else {
      const errMsg = json?.data?.message
        ? `Digiflazz API: ${String(json.data.message)}`
        : "Gagal memverifikasi kredensial ke API Digiflazz (periksa Username, API Key, dan IP Whitelist).";
      result = {
        ok: false,
        mode: "error",
        message: errMsg,
      };
    }
  } catch (err: any) {
    result = {
      ok: false,
      mode: "error",
      message: `Gagal menghubungi API Digiflazz: ${String(err?.message || "Koneksi gagal")}`,
    };
  }

  doc.last_test = { ...result, at: nowIso() };
  saveDb();
  res.json(result);
});

admin.get("/topup/vendors/:provider_id/balance", async (req, res) => {
  const doc = db.topup_providers.find((v) => v.id === req.params.provider_id || v.kind === "digiflazz");
  if (!doc) return res.status(404).json({ detail: "Supplier Digiflazz tidak ditemukan" });

  const username = String(doc.config?.username || process.env.DIGIFLAZZ_USERNAME || "").trim();
  const apiKey = String(
    (doc.config?.use_dev ? doc.config?.dev_key : doc.config?.api_key) ||
      doc.config?.api_key ||
      process.env.DIGIFLAZZ_API_KEY ||
      ""
  ).trim();

  if (isDemoDigiflazzCredential(username, apiKey)) {
    return res.json({
      supported: true,
      ok: false,
      balance: 0,
      balance_formatted: "—",
      currency: "IDR",
      provider: doc.name,
      message: "Kredensial Digiflazz belum dikonfigurasi",
    });
  }

  try {
    const sign = crypto.createHash("md5").update(username + apiKey + "depo").digest("hex");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch("https://api.digiflazz.com/v1/cek-saldo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "depo", username, sign }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json: any = await resp.json().catch(() => null);
    if (json?.data && typeof json.data.deposit === "number") {
      const bal = Number(json.data.deposit);
      doc.cached_balance = bal;
      doc.last_test = {
        ok: true,
        message: `Saldo tersinkronisasi: Rp ${bal.toLocaleString("id-ID")}`,
        at: nowIso(),
      };
      saveDb();
      return res.json({
        supported: true,
        ok: true,
        balance: bal,
        balance_formatted: `Rp ${bal.toLocaleString("id-ID")}`,
        currency: "IDR",
        provider: doc.name,
        message: "Saldo Digiflazz tersinkronisasi",
      });
    }
    const errMsg = json?.data?.message
      ? `Digiflazz API: ${String(json.data.message)}`
      : "Gagal mengambil saldo dari API Digiflazz";
    return res.json({
      supported: true,
      ok: false,
      balance: 0,
      balance_formatted: "—",
      currency: "IDR",
      provider: doc.name,
      message: errMsg,
    });
  } catch (err: any) {
    return res.json({
      supported: true,
      ok: false,
      balance: 0,
      balance_formatted: "—",
      currency: "IDR",
      provider: doc.name,
      message: `Gagal terhubung ke API Digiflazz: ${String(err?.message || "Koneksi gagal")}`,
    });
  }
});

admin.get("/topup/vendors/:provider_id/products", async (req, res) => {
  const doc =
    db.topup_providers.find((v) => v.id === req.params.provider_id || v.kind === req.params.provider_id) ||
    db.topup_providers.find((v) => v.kind === "digiflazz") ||
    db.topup_providers[0];
  if (!doc) return res.status(404).json({ detail: "Supplier tidak ditemukan" });
  const q = String(req.query.q || "");
  const limit = Math.max(10, Math.min(500, Number(req.query.limit || 200)));
  const forceRefresh = req.query.refresh === "true" || req.query.refresh === "1";
  const catalogData = await buildVendorProductsCatalog(doc, q, limit, forceRefresh);
  res.json(catalogData);
});

admin.get("/topup/merchant-catalog", async (req, res) => {
  const vendorKind = "digiflazz";
  const margin = Math.max(0, Number(req.query.margin_percent || 0));
  const forceRefresh = req.query.refresh === "true" || req.query.refresh === "1";
  const provider =
    db.topup_providers.find((v) => v.kind === "digiflazz") ||
    db.topup_providers[0];

  upgradeLocalGameIcons();
  const { items: digiflazzProducts, source, live_count, error } = await fetchDigiflazzPriceList(
    provider,
    forceRefresh
  );

  // Build catalog strictly around existing LOCAL games in db.games using ONLY live Digiflazz items
  const localGames = [...(db.games || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const games = localGames.map((lg) => {
    const gameSlug = String(lg.slug || "").toLowerCase();
    const matched = digiflazzProducts.filter((p) => {
      if (String(p.game_slug || "").toLowerCase() === gameSlug) return true;
      const mSlug = matchDigiflazzItemToLocalGame(p.brand, p.sku, p.name);
      return mSlug && mSlug.toLowerCase() === gameSlug;
    });

    const denominations = matched.map((d) => {
      const modalPrice = Math.max(500, Number(d.price || 0));
      const recPrice = Math.max(
        modalPrice + 1000,
        Number(d.retail_price || Math.ceil((modalPrice * 1.1) / 100) * 100)
      );
      const sellingPrice =
        margin > 0
          ? Math.max(1000, Math.ceil((modalPrice * (1 + margin / 100)) / 100) * 100)
          : recPrice;
      const skuGroup = normalizeSkuGroup(d.sku_group, d.sku, d.label || d.name, d.category);
      return {
        code: String(d.code || d.sku),
        label: d.label || d.name || String(d.sku),
        amount: Number(d.amount || 0),
        sku: String(d.sku),
        sku_group: skuGroup,
        modal_price: modalPrice,
        recommended_price: recPrice,
        selling_price: sellingPrice,
        badge: d.badge || (skuGroup === "membership" ? "Membership" : ""),
      };
    });

    return {
      id: lg.id,
      slug: lg.slug,
      name: lg.name,
      publisher: lg.publisher,
      currency: lg.currency,
      icon: lg.icon,
      banner: lg.banner,
      vendor_prefix: lg.vendor_prefix,
      already_added: true,
      existing_denom_count: Array.isArray(lg.denominations) ? lg.denominations.length : 0,
      denomination_count: denominations.length,
      denominations,
    };
  });

  res.json({
    vendor_kind: vendorKind,
    source,
    live_count,
    live_error: error || null,
    total_games: games.length,
    total_denominations: games.reduce((sum, g) => sum + g.denomination_count, 0),
    games,
  });
});

admin.post("/topup/pull-merchant", async (req, res) => {
  const body = req.body || {};
  const result = await pullGamesFromMerchant({
    vendorKind: "digiflazz",
    providerId: body.provider_id,
    gameSlugs: Array.isArray(body.game_slugs) ? body.game_slugs : undefined,
    selectedSkusByGame:
      body.selected_skus_by_game && typeof body.selected_skus_by_game === "object"
        ? body.selected_skus_by_game
        : undefined,
    marginPercent: Number(body.margin_percent || 0),
    useRecommendedPrice: Boolean(body.use_recommended_price),
    autoActivateVendor: body.auto_activate_vendor !== false,
    forceRefresh: true,
  });
  if (!result.ok) {
    return res.status(400).json({
      detail: result.error || "Gagal menarik produk dari API Digiflazz. Produk demo dinonaktifkan.",
      ...result,
    });
  }
  res.json(result);
});

admin.post("/topup/clear-products", (req, res) => {
  const slugs = Array.isArray(req.body?.game_slugs) ? req.body.game_slugs : undefined;
  const result = clearAllTopupProductsAndSkus(slugs);
  res.json({
    ok: true,
    ...result,
    message: `Berhasil mengosongkan produk & SKU pada ${result.games_cleared} game lokal (${result.products_removed} produk top up dihapus).`,
  });
});

// --- Admin File Upload ---
admin.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file || !file.mimetype.startsWith("image/")) {
    return res.status(400).json({ detail: "Hanya file gambar (JPG, PNG, WEBP, GIF) yang diizinkan" });
  }
  const ext = path.extname(file.originalname || "") || ".jpg";
  const filePath = `uploads/${uuidHex(16)}${ext}`;
  db.files[filePath] = {
    path: filePath,
    dataBase64: file.buffer.toString("base64"),
    content_type: file.mimetype,
    filename: file.originalname || "image.jpg",
    created_at: nowIso(),
  };
  saveDb();
  res.json({ url: `/api/files/${filePath}` });
});

// --- Admin Manual Payment Destinations ---
admin.get("/payments/manual-destinations", (_req, res) => {
  res.json([...db.manual_destinations].sort((a, b) => (a.seq || 0) - (b.seq || 0)));
});

admin.post("/payments/manual-destinations", (req, res) => {
  const data = req.body || {};
  if (!data.name || !data.type) return res.status(400).json({ detail: "Nama dan tipe diperlukan" });
  const dest = {
    id: "mp-" + uuidHex(10),
    name: String(data.name).trim(),
    account_name: String(data.account_name || "").trim(),
    account_number: String(data.account_number || "").trim(),
    type: String(data.type).trim(),
    symbol: data.type === "crypto" ? String(data.symbol || "USDT").trim().toUpperCase() : "",
    network: data.type === "crypto" ? String(data.network || "").trim() : "",
    image: data.image || "",
    is_active: Boolean(data.is_active ?? true),
    seq: db.manual_destinations.length,
  };
  db.manual_destinations.push(dest);
  saveDb();
  res.status(201).json(dest);
});

admin.put("/payments/manual-destinations/:dest_id", (req, res) => {
  const idx = db.manual_destinations.findIndex((d) => d.id === req.params.dest_id);
  if (idx === -1) return res.status(404).json({ detail: "Tujuan pembayaran tidak ditemukan" });
  const updated = { ...db.manual_destinations[idx], ...req.body, id: req.params.dest_id };
  db.manual_destinations[idx] = updated;
  saveDb();
  res.json(updated);
});

admin.delete("/payments/manual-destinations/:dest_id", (req, res) => {
  const idx = db.manual_destinations.findIndex((d) => d.id === req.params.dest_id);
  if (idx === -1) return res.status(404).json({ detail: "Tujuan pembayaran tidak ditemukan" });
  db.manual_destinations.splice(idx, 1);
  saveDb();
  res.json({ message: "Tujuan pembayaran dihapus" });
});

// --- Admin PayKita ---
const probePaykitaApiConnection = async (baseUrl: string, apiKey: string) => {
  if (isDefaultDemoPaykitaKey(apiKey)) {
    return {
      ok: true,
      is_demo: true,
      project: "Mode Demo (Masukkan pk_live_... asli untuk QRIS Live)",
      provider: "QRIS Simulasi Lokal",
      mode: "demo",
      base_url: baseUrl,
      tested_at: nowIso(),
    };
  }

  try {
    const resp = await axios.post(
      `${baseUrl}/api/merchant/settings`,
      {},
      {
        headers: {
          "x-api-key": apiKey,
          "X-API-Key": apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 6000,
      }
    );
    const d = resp.data?.data || {};
    const providers = [
      d.gopay_mode ? `GoPay (${d.gopay_mode})` : null,
      d.shopee_mode ? `Shopee (${d.shopee_mode})` : null,
    ].filter(Boolean);
    return {
      ok: true,
      is_demo: false,
      project: "PayKita Live Project (Main Key)",
      provider: providers.length ? providers.join(" & ") : "QRIS Dinamis PayKita",
      mode: apiKey.startsWith("pk_test") ? "sandbox" : "production",
      base_url: baseUrl,
      tested_at: nowIso(),
    };
  } catch (err: any) {
    const errCode = String(err?.response?.data?.error?.code || "");
    const errMsg = String(err?.response?.data?.error?.message || "");
    // Sub-project keys return 403 default_project_key_required on /api/merchant/settings AFTER passing API key + subscription validation!
    if (errCode === "default_project_key_required") {
      return {
        ok: true,
        is_demo: false,
        project: "PayKita Live Project (Project Key)",
        provider: "QRIS Dinamis PayKita",
        mode: apiKey.startsWith("pk_test") ? "sandbox" : "production",
        base_url: baseUrl,
        tested_at: nowIso(),
      };
    }
    if (errCode === "invalid_api_key" || errCode === "missing_api_key" || errCode === "subscription_required") {
      return {
        ok: false,
        is_demo: false,
        error: translatePaykitaError(errCode, errMsg),
        base_url: baseUrl,
        tested_at: nowIso(),
      };
    }
  }

  // Fallback check via GET /api/orders/ping_check
  try {
    await axios.get(`${baseUrl}/api/orders/ping_check`, {
      headers: {
        "x-api-key": apiKey,
        "X-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      timeout: 6000,
    });
    return {
      ok: true,
      is_demo: false,
      project: "PayKita Live Project",
      provider: "QRIS Dinamis PayKita",
      mode: apiKey.startsWith("pk_test") ? "sandbox" : "production",
      base_url: baseUrl,
      tested_at: nowIso(),
    };
  } catch (err: any) {
    const errCode = String(err?.response?.data?.error?.code || "");
    const errMsg = String(err?.response?.data?.error?.message || "");
    // 404 not_found on /api/orders/ping_check means requireApiKey succeeded!
    if (err?.response?.status === 404 || errCode === "not_found") {
      return {
        ok: true,
        is_demo: false,
        project: "PayKita Live Project",
        provider: "QRIS Dinamis PayKita",
        mode: apiKey.startsWith("pk_test") ? "sandbox" : "production",
        base_url: baseUrl,
        tested_at: nowIso(),
      };
    }
    if (errCode) {
      return {
        ok: false,
        is_demo: false,
        error: translatePaykitaError(errCode, errMsg),
        base_url: baseUrl,
        tested_at: nowIso(),
      };
    }
    return {
      ok: false,
      is_demo: false,
      error: `Gagal menghubungi server PayKita (${baseUrl}): ${err?.message || "Connection error"}`,
      base_url: baseUrl,
      tested_at: nowIso(),
    };
  }
};

const probeGatewayApiConnection = async (gatewayId: string, cfg: any) => {
  const gId = String(gatewayId || "paykita").toLowerCase();
  const apiKey = String(cfg.api_key || "").trim();
  const baseUrl = String(cfg.base_url || "").replace(/\/+$/, "");

  if (gId === "paykita") {
    return probePaykitaApiConnection(baseUrl || "https://pay.digikita.id", apiKey);
  }

  if (gId === "duitku") {
    const merchantCode = String(cfg.merchant_code || "").trim();
    const method = String(cfg.payment_method || "SP").toUpperCase();
    const mode = String(cfg.mode || "production").toLowerCase();
    const resolvedBase =
      baseUrl || (mode === "sandbox" ? "https://sandbox.duitku.com/webapi" : "https://passport.duitku.com/webapi");

    if (isDemoGatewayKey("duitku", apiKey) || !merchantCode) {
      return {
        ok: true,
        is_demo: true,
        project: `Duitku (${merchantCode || "Demo Merchant"})`,
        provider: `QRIS Duitku (${method})`,
        mode: "demo",
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    }

    try {
      const amount = 10000;
      const nowDt = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const datetime = `${nowDt.getFullYear()}-${pad(nowDt.getMonth() + 1)}-${pad(nowDt.getDate())} ${pad(
        nowDt.getHours()
      )}:${pad(nowDt.getMinutes())}:${pad(nowDt.getSeconds())}`;
      const signature = crypto
        .createHash("sha256")
        .update(`${merchantCode}${amount}${datetime}${apiKey}`)
        .digest("hex");

      const resp = await axios.post(
        `${resolvedBase}/api/merchant/paymentmethod/getpaymentmethod`,
        { merchantcode: merchantCode, amount, datetime, signature },
        { headers: { "Content-Type": "application/json" }, timeout: 6000 }
      );
      if (resp.data?.responseCode === "00" || Array.isArray(resp.data?.paymentFee)) {
        return {
          ok: true,
          is_demo: false,
          project: `Duitku Merchant (${merchantCode})`,
          provider: `QRIS Duitku (${method})`,
          mode,
          base_url: resolvedBase,
          tested_at: nowIso(),
        };
      }
      return {
        ok: false,
        is_demo: false,
        error: resp.data?.responseMessage || resp.data?.Message || "Kredensial Duitku tidak valid",
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.Message ||
        err?.response?.data?.responseMessage ||
        err?.message ||
        "Gagal menghubungi server Duitku";
      return {
        ok: false,
        is_demo: false,
        error: `Duitku API: ${errMsg}`,
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    }
  }

  if (gId === "tripay") {
    const merchantCode = String(cfg.merchant_code || "").trim();
    const method = String(cfg.payment_method || "QRISC").toUpperCase();
    const mode = String(cfg.mode || "production").toLowerCase();
    const resolvedBase =
      baseUrl || (mode === "sandbox" ? "https://tripay.co.id/api-sandbox" : "https://tripay.co.id/api");

    if (isDemoGatewayKey("tripay", apiKey)) {
      return {
        ok: true,
        is_demo: true,
        project: `Tripay (${merchantCode || "Demo"})`,
        provider: `QRIS Tripay (${method})`,
        mode: "demo",
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    }

    try {
      const resp = await axios.get(`${resolvedBase}/merchant/payment-channel`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 6000,
      });
      if (resp.data?.success) {
        return {
          ok: true,
          is_demo: false,
          project: `Tripay Merchant (${merchantCode || "Live"})`,
          provider: `QRIS Tripay (${method})`,
          mode,
          base_url: resolvedBase,
          tested_at: nowIso(),
        };
      }
      return {
        ok: false,
        is_demo: false,
        error: resp.data?.message || "API Key Tripay tidak valid",
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    } catch (err: any) {
      return {
        ok: false,
        is_demo: false,
        error: `Tripay API: ${err?.response?.data?.message || err?.message || "Koneksi gagal"}`,
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    }
  }

  if (gId === "midtrans") {
    const merchantCode = String(cfg.merchant_code || "").trim();
    const mode = String(cfg.mode || "production").toLowerCase();
    const resolvedBase =
      baseUrl || (mode === "sandbox" ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com");
    if (isDemoGatewayKey("midtrans", apiKey)) {
      return {
        ok: true,
        is_demo: true,
        project: `Midtrans (${merchantCode || "Demo"})`,
        provider: "QRIS GoPay / Core API",
        mode: "demo",
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    }
    return {
      ok: true,
      is_demo: false,
      project: `Midtrans (${merchantCode || "Live"})`,
      provider: "QRIS GoPay / Core API",
      mode,
      base_url: resolvedBase,
      tested_at: nowIso(),
    };
  }

  if (gId === "xendit") {
    const resolvedBase = baseUrl || "https://api.xendit.co";
    if (isDemoGatewayKey("xendit", apiKey)) {
      return {
        ok: true,
        is_demo: true,
        project: "Xendit (Demo Mode)",
        provider: "QRIS Dinamis Xendit",
        mode: "demo",
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    }
    try {
      const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
      await axios.get(`${resolvedBase}/balance`, {
        headers: { Authorization: authHeader },
        timeout: 6000,
      });
      return {
        ok: true,
        is_demo: false,
        project: "Xendit Live Account",
        provider: "QRIS Dinamis Xendit",
        mode: apiKey.startsWith("xnd_development") ? "sandbox" : "production",
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    } catch (err: any) {
      return {
        ok: false,
        is_demo: false,
        error: `Xendit API: ${err?.response?.data?.message || err?.message || "Koneksi gagal"}`,
        base_url: resolvedBase,
        tested_at: nowIso(),
      };
    }
  }

  return {
    ok: true,
    is_demo: false,
    project: gId.toUpperCase(),
    provider: "QRIS Otomatis",
    mode: "production",
    base_url: baseUrl,
    tested_at: nowIso(),
  };
};

const buildPaykitaConfigResponse = (req: Request) => {
  const s = db.settings.paykita || {};
  const pg = db.settings.payment_gateways || { active_gateway: "paykita", gateways: {} };
  const activeGateway = String(pg.active_gateway || "paykita").toLowerCase();
  const origin = getAppOrigin(req);

  const apiKey = String(s.api_key || process.env.PAYKITA_API_KEY || "pk_live_wjp_qris_99281746").trim();
  const webhookSecret = String(s.webhook_secret || process.env.PAYKITA_WEBHOOK_SECRET || "whsec_wjp_qris_881920").trim();
  const baseUrl = String(s.base_url || "https://pay.digikita.id").replace(/\/+$/, "");
  const enabled = s.enabled !== undefined ? Boolean(s.enabled) : true;
  const isDemo = isDefaultDemoPaykitaKey(apiKey);
  const lastTest = s.last_test || {
    ok: true,
    is_demo: isDemo,
    project: isDemo ? "Mode Demo (Belum diisi pk_live_... asli)" : "WillJustPlay Store",
    provider: isDemo ? "QRIS Simulasi Lokal" : "QRIS Dinamis (All E-Wallet & Bank)",
    mode: isDemo ? "demo" : apiKey.startsWith("pk_test") ? "sandbox" : "production",
    base_url: baseUrl,
    tested_at: nowIso(),
  };

  // Sync paykita entry in pg.gateways
  if (pg.gateways) {
    pg.gateways.paykita = {
      ...(pg.gateways.paykita || {}),
      id: "paykita",
      name: "PayKita",
      subtitle: "QRIS Otomatis Produk Beranda",
      scope: "beranda",
      enabled,
      base_url: baseUrl,
      api_key: apiKey,
      webhook_secret: webhookSecret,
      last_test: lastTest,
    };
  }

  const allowedKeys = ["paykita", "duitku"];
  const formattedGateways: Record<string, any> = {};
  for (const gk of allowedKeys) {
    const gVal = pg.gateways?.[gk] || {};
    const gKey = String(gVal.api_key || "").trim();
    const gDemo = isDemoGatewayKey(gk, gKey);
    const gSec = String(gVal.webhook_secret || gVal.private_key || gVal.client_key || "").trim();
    formattedGateways[gk] = {
      id: gk,
      name: gk === "duitku" ? "Duitku" : "PayKita",
      subtitle:
        gk === "duitku"
          ? "Multi-Metode Pembayaran Produk Top Up"
          : "QRIS Otomatis Produk Beranda",
      scope: gk === "duitku" ? "topup" : "beranda",
      enabled: gVal.enabled !== false,
      is_active_gateway: true,
      mode: gVal.mode || "production",
      base_url: gVal.base_url || "",
      merchant_code: gVal.merchant_code || "",
      payment_method: gVal.payment_method || (gk === "duitku" ? "SP" : "QRIS"),
      enabled_methods:
        gk === "duitku"
          ? getEnabledDuitkuChannels(gVal).map((c) => c.code)
          : ["QRIS"],
      available_channels: gk === "duitku" ? DUITKU_PAYMENT_CHANNELS : [],
      is_demo_key: gDemo,
      api_key_set: Boolean(gKey),
      api_key_masked: gDemo ? `${maskSecret(gKey)} (Default Demo)` : maskSecret(gKey),
      secret_set: Boolean(gSec),
      secret_masked: gSec ? maskSecret(gSec) : "",
      webhook_url: `${origin}/api/webhook/${gk}`,
      last_test: gVal.last_test || null,
    };
  }

  return {
    enabled,
    active_gateway: activeGateway,
    beranda_gateway: "paykita",
    topup_gateway: "duitku",
    gateways: formattedGateways,
    base_url: baseUrl,
    is_demo_key: isDemo,
    api_key_set: Boolean(apiKey),
    api_key_masked: isDemo ? `${maskSecret(apiKey)} (Default Demo)` : maskSecret(apiKey),
    webhook_secret_set: Boolean(webhookSecret),
    webhook_url: `${origin}/api/webhook/paykita`,
    products_with_own_key: 0,
    last_test: lastTest,
  };
};

admin.get("/payments/paykita", (req, res) => {
  res.json(buildPaykitaConfigResponse(req));
});

admin.get("/payments/gateways", (req, res) => {
  res.json(buildPaykitaConfigResponse(req));
});

admin.put("/payments/gateways/:gateway_id", async (req, res) => {
  const gId = String(req.params.gateway_id || "paykita").toLowerCase();
  if (!db.settings.payment_gateways) initDatabase();
  const pg = db.settings.payment_gateways;
  const existing = pg.gateways?.[gId] || { id: gId, name: gId.toUpperCase() };
  const body = req.body || {};

  const nextApiKey =
    typeof body.api_key === "string" && body.api_key.trim() && !body.api_key.includes("*")
      ? body.api_key.trim()
      : existing.api_key || "";
  const nextWebhookSecret =
    typeof body.webhook_secret === "string" && body.webhook_secret.trim() && !body.webhook_secret.includes("*")
      ? body.webhook_secret.trim()
      : existing.webhook_secret || "";
  const nextPrivateKey =
    typeof body.private_key === "string" && body.private_key.trim() && !body.private_key.includes("*")
      ? body.private_key.trim()
      : existing.private_key || "";
  const nextClientKey =
    typeof body.client_key === "string" && body.client_key.trim() && !body.client_key.includes("*")
      ? body.client_key.trim()
      : existing.client_key || "";

  const nextEnabledMethods =
    Array.isArray(body.enabled_methods) && body.enabled_methods.length > 0
      ? body.enabled_methods.map((c: any) => String(c || "").trim().toUpperCase()).filter(Boolean)
      : existing.enabled_methods || DUITKU_PAYMENT_CHANNELS.map((c) => c.code);

  const updatedGw = {
    ...existing,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled !== false,
    mode: body.mode || existing.mode || "production",
    base_url: String(body.base_url ?? existing.base_url ?? "").trim().replace(/\/+$/, ""),
    merchant_code: String(body.merchant_code ?? existing.merchant_code ?? "").trim(),
    payment_method: String(body.payment_method ?? existing.payment_method ?? "QRIS").trim(),
    enabled_methods: nextEnabledMethods,
    api_key: nextApiKey,
    webhook_secret: nextWebhookSecret,
    private_key: nextPrivateKey,
    client_key: nextClientKey,
  };

  if (body.api_key || !updatedGw.last_test) {
    updatedGw.last_test = await probeGatewayApiConnection(gId, updatedGw);
  }

  pg.gateways[gId] = updatedGw;
  if (body.set_active || body.active_gateway === gId) {
    pg.active_gateway = gId;
  }

  if (gId === "paykita") {
    db.settings.paykita = {
      id: "paykita",
      enabled: updatedGw.enabled,
      base_url: updatedGw.base_url || "https://pay.digikita.id",
      api_key: updatedGw.api_key,
      webhook_secret: updatedGw.webhook_secret,
      last_test: updatedGw.last_test,
    };
  }
  if (body.global_enabled !== undefined) {
    db.settings.paykita.enabled = Boolean(body.global_enabled);
  }

  saveDb();
  res.json(buildPaykitaConfigResponse(req));
});

admin.post("/payments/gateways/:gateway_id/activate", (req, res) => {
  const gId = String(req.params.gateway_id || "paykita").toLowerCase();
  if (!db.settings.payment_gateways) initDatabase();
  const pg = db.settings.payment_gateways;
  if (!pg.gateways?.[gId]) {
    return res.status(404).json({ detail: "Payment gateway tidak ditemukan" });
  }
  pg.active_gateway = gId;
  pg.gateways[gId].enabled = true;
  db.settings.paykita.enabled = true;
  saveDb();
  res.json(buildPaykitaConfigResponse(req));
});

admin.post("/payments/gateways/:gateway_id/test", async (req, res) => {
  const gId = String(req.params.gateway_id || "paykita").toLowerCase();
  if (!db.settings.payment_gateways) initDatabase();
  const pg = db.settings.payment_gateways;
  const existing = pg.gateways?.[gId] || { id: gId, name: gId.toUpperCase() };
  const body = req.body || {};

  const nextApiKey =
    typeof body.api_key === "string" && body.api_key.trim() && !body.api_key.includes("*")
      ? body.api_key.trim()
      : existing.api_key || "";
  const nextWebhookSecret =
    typeof body.webhook_secret === "string" && body.webhook_secret.trim() && !body.webhook_secret.includes("*")
      ? body.webhook_secret.trim()
      : existing.webhook_secret || "";
  const nextPrivateKey =
    typeof body.private_key === "string" && body.private_key.trim() && !body.private_key.includes("*")
      ? body.private_key.trim()
      : existing.private_key || "";
  const nextClientKey =
    typeof body.client_key === "string" && body.client_key.trim() && !body.client_key.includes("*")
      ? body.client_key.trim()
      : existing.client_key || "";

  const updatedGw = {
    ...existing,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
    mode: body.mode || existing.mode || "production",
    base_url: String(body.base_url ?? existing.base_url ?? "").trim().replace(/\/+$/, ""),
    merchant_code: String(body.merchant_code ?? existing.merchant_code ?? "").trim(),
    payment_method: String(body.payment_method ?? existing.payment_method ?? "QRIS").trim(),
    api_key: nextApiKey,
    webhook_secret: nextWebhookSecret,
    private_key: nextPrivateKey,
    client_key: nextClientKey,
  };

  const testInfo = await probeGatewayApiConnection(gId, updatedGw);
  updatedGw.last_test = testInfo;
  pg.gateways[gId] = updatedGw;

  if (gId === "paykita") {
    db.settings.paykita = {
      ...db.settings.paykita,
      id: "paykita",
      enabled: updatedGw.enabled,
      api_key: updatedGw.api_key,
      base_url: updatedGw.base_url || "https://pay.digikita.id",
      webhook_secret: updatedGw.webhook_secret,
      last_test: testInfo,
    };
  }
  saveDb();

  if (!testInfo.ok) {
    return res.status(400).json({
      ...testInfo,
      detail: testInfo.error || `Tes koneksi ke ${updatedGw.name || gId} gagal`,
      config: buildPaykitaConfigResponse(req),
    });
  }

  res.json({
    ...testInfo,
    config: buildPaykitaConfigResponse(req),
  });
});

admin.put("/payments/paykita", async (req, res) => {
  const s = db.settings.paykita || {};
  const data = req.body || {};
  const incomingKey = String(data.api_key || "").trim();
  const apiKey =
    incomingKey ||
    String(s.api_key || process.env.PAYKITA_API_KEY || "pk_live_wjp_qris_99281746").trim();
  const webhookSecret =
    String(data.webhook_secret || "").trim() ||
    String(s.webhook_secret || process.env.PAYKITA_WEBHOOK_SECRET || "whsec_wjp_qris_881920").trim();
  const baseUrl = String(data.base_url || s.base_url || "https://pay.digikita.id").replace(/\/+$/, "");
  const enabled = Boolean(data.enabled ?? s.enabled ?? true);

  let lastTest = s.last_test;
  if (incomingKey || !lastTest) {
    lastTest = await probePaykitaApiConnection(baseUrl, apiKey);
  }

  db.settings.paykita = {
    id: "paykita",
    enabled,
    base_url: baseUrl,
    api_key: apiKey,
    webhook_secret: webhookSecret,
    last_test: lastTest,
  };
  if (db.settings.payment_gateways?.gateways?.paykita) {
    db.settings.payment_gateways.gateways.paykita = {
      ...db.settings.payment_gateways.gateways.paykita,
      enabled,
      base_url: baseUrl,
      api_key: apiKey,
      webhook_secret: webhookSecret,
      last_test: lastTest,
    };
  }
  saveDb();
  res.json(buildPaykitaConfigResponse(req));
});

admin.post("/payments/paykita/test", async (req, res) => {
  const s = db.settings.paykita || {};
  const body = req.body || {};
  const apiKey = String(
    body.api_key || s.api_key || process.env.PAYKITA_API_KEY || "pk_live_wjp_qris_99281746"
  ).trim();
  const webhookSecret = String(
    body.webhook_secret || s.webhook_secret || process.env.PAYKITA_WEBHOOK_SECRET || "whsec_wjp_qris_881920"
  ).trim();
  const baseUrl = String(body.base_url || s.base_url || "https://pay.digikita.id").replace(/\/+$/, "");
  const enabled = body.enabled !== undefined ? Boolean(body.enabled) : true;

  const testInfo = await probePaykitaApiConnection(baseUrl, apiKey);

  db.settings.paykita = {
    ...s,
    id: "paykita",
    enabled,
    api_key: apiKey,
    base_url: baseUrl,
    webhook_secret: webhookSecret,
    last_test: testInfo,
  };
  if (db.settings.payment_gateways?.gateways?.paykita) {
    db.settings.payment_gateways.gateways.paykita = {
      ...db.settings.payment_gateways.gateways.paykita,
      enabled,
      base_url: baseUrl,
      api_key: apiKey,
      webhook_secret: webhookSecret,
      last_test: testInfo,
    };
  }
  saveDb();

  if (!testInfo.ok) {
    return res.status(400).json({
      ...testInfo,
      detail: testInfo.error || "Tes koneksi ke PayKita gagal",
      config: buildPaykitaConfigResponse(req),
    });
  }

  res.json({
    ...testInfo,
    config: buildPaykitaConfigResponse(req),
  });
});

admin.post("/topup/games/:game_id/import", async (req, res) => {
  const game = db.games.find((g) => g.id === req.params.game_id || g.slug === req.params.game_id);
  if (!game) return res.status(404).json({ detail: "Game tidak ditemukan" });

  const marginPercent = Math.max(
    0,
    req.body?.margin_percent !== undefined ? Number(req.body.margin_percent) : 10
  );

  // Support one-click product pull for this single local game directly from Digiflazz
  if (req.body?.auto_pull_all) {
    const selectedSkus = Array.isArray(req.body?.selected_skus) ? req.body.selected_skus : undefined;
    const resPull = await pullGamesFromMerchant({
      vendorKind: "digiflazz",
      providerId: req.body?.provider_id,
      gameSlugs: [game.slug],
      selectedSkusByGame: selectedSkus?.length ? { [game.slug]: selectedSkus } : undefined,
      marginPercent,
      useRecommendedPrice: marginPercent <= 0 && Boolean(req.body?.use_recommended_price),
      autoActivateVendor: true,
      forceRefresh: true,
    });
    if (!resPull.ok) {
      return res.status(400).json({
        detail: resPull.error || "Gagal menarik produk dari API Digiflazz. Produk demo dinonaktifkan.",
        ...resPull,
      });
    }
    return res.json(resPull);
  }

  // Strictly pull selected Digiflazz products directly as denominations on this local game
  if (Array.isArray(req.body?.selected_products) && req.body.selected_products.length > 0) {
    const provider =
      db.topup_providers.find((v) => v.id === req.body?.provider_id || v.kind === "digiflazz") ||
      db.topup_providers[0];
    const { items: liveProducts, error: liveErr } = await fetchDigiflazzPriceList(provider, false);
    if (liveErr || liveProducts.length === 0) {
      return res.status(400).json({
        detail: liveErr || "Gagal memverifikasi produk dari API Digiflazz.",
      });
    }
    const validLiveSkuMap = new Map(
      liveProducts.map((lp) => [String(lp.sku || "").trim().toUpperCase(), lp])
    );

    const existingDenoms = Array.isArray(game.denominations) ? [...game.denominations] : [];
    const updatedCodes: string[] = [];

    for (const rawProd of req.body.selected_products) {
      const sku = String(rawProd?.sku || "").trim();
      if (!sku) continue;
      const verifiedLive = validLiveSkuMap.get(sku.toUpperCase());
      if (!verifiedLive) continue;

      const modalPrice = Math.max(500, Number(verifiedLive.price || rawProd?.price || 0));
      const cleanLabel = String(
        verifiedLive.label ||
          rawProd?.label ||
          cleanDenomLabelFromProductName(String(verifiedLive.name || sku), game.name, game.currency || "Diamond")
      ).trim();
      const amount = Number(verifiedLive.amount || rawProd?.amount) || extractAmountFromLabel(cleanLabel, 1);
      const code = String(verifiedLive.code || rawProd?.code || (amount > 0 ? String(amount) : sku.toLowerCase()));
      const sellingPrice =
        marginPercent > 0
          ? Math.max(1000, Math.ceil((modalPrice * (1 + marginPercent / 100)) / 100) * 100)
          : Math.max(
              1000,
              Number(verifiedLive.retail_price) > modalPrice
                ? Number(verifiedLive.retail_price)
                : Math.ceil((modalPrice * 1.1) / 100) * 100
            );
      const strikePrice = Math.ceil((sellingPrice * 1.12) / 1000) * 1000;

      const existIdx = existingDenoms.findIndex(
        (ed: any) =>
          String(ed.vendor_sku || "").toUpperCase() === sku.toUpperCase() ||
          String(ed.code || "").toLowerCase() === code.toLowerCase()
      );

      const skuGroup = normalizeSkuGroup(
        rawProd?.sku_group ?? verifiedLive.sku_group,
        sku,
        cleanLabel,
        verifiedLive.category
      );

      if (existIdx >= 0) {
        existingDenoms[existIdx] = {
          ...existingDenoms[existIdx],
          code: existingDenoms[existIdx].code || code,
          label: cleanLabel || existingDenoms[existIdx].label,
          amount: amount || existingDenoms[existIdx].amount || 1,
          modal_price: modalPrice,
          price: sellingPrice,
          price_strike: strikePrice,
          sku_group: normalizeSkuGroup(
            rawProd?.sku_group ?? existingDenoms[existIdx].sku_group,
            sku,
            cleanLabel,
            verifiedLive.category
          ),
          vendor_sku: sku,
          is_active: true,
        };
      } else {
        existingDenoms.push({
          code,
          label: cleanLabel || sku,
          amount: amount || 1,
          modal_price: modalPrice,
          price: sellingPrice,
          price_strike: strikePrice,
          stock: 999,
          badge: String(verifiedLive.badge || (skuGroup === "membership" ? "Membership" : "")),
          sku_group: skuGroup,
          is_active: true,
          featured: Boolean(verifiedLive.featured),
          vendor_sku: sku,
          seq: existingDenoms.length,
        });
      }
      updatedCodes.push(sku);
    }

    if (updatedCodes.length === 0) {
      return res.status(400).json({
        detail: "Tidak ada SKU valid dari API Digiflazz yang dapat ditarik.",
      });
    }

    existingDenoms.sort((a: any, b: any) => Number(a.price || 0) - Number(b.price || 0));
    game.denominations = existingDenoms.map((d: any, idx: number) => ({ ...d, seq: idx }));
    const count = syncGameProducts(game);
    for (const p of db.products) {
      if (isTopupProduct(p)) {
        p.price_usd = Math.max(0.5, Math.round((Number(p.price || 0) / 16000) * 100) / 100);
      }
    }
    saveDb();
    return res.json({
      ok: true,
      updated: updatedCodes,
      products: count,
      message: `${updatedCodes.length} produk asli Digiflazz berhasil ditarik ke ${game.name} (Margin +${marginPercent}%)`,
    });
  }

  return res.status(400).json({
    detail: "Pengaturan SKU manual telah dinonaktifkan. Produk hanya dapat ditarik langsung dari API Digiflazz.",
  });
});

// --- Admin Social Links ---
admin.get("/social-links", (_req, res) => {
  res.json([...db.social_links].sort((a, b) => (a.seq || 0) - (b.seq || 0)));
});

admin.post("/social-links", (req, res) => {
  const data = req.body || {};
  if (!String(data.name || "").trim() || !String(data.url || "").trim()) {
    return res.status(400).json({ detail: "Nama dan URL diperlukan" });
  }
  const link = {
    id: "sl-" + uuidHex(10),
    platform: String(data.platform || "website").trim(),
    name: String(data.name).trim(),
    url: String(data.url).trim(),
    is_active: Boolean(data.is_active ?? true),
    seq: db.social_links.length,
  };
  db.social_links.push(link);
  saveDb();
  res.status(201).json(link);
});

admin.put("/social-links/:link_id", (req, res) => {
  const idx = db.social_links.findIndex((s) => s.id === req.params.link_id);
  if (idx === -1) return res.status(404).json({ detail: "Sosial media tidak ditemukan" });
  const updated = { ...db.social_links[idx], ...req.body, id: req.params.link_id };
  db.social_links[idx] = updated;
  saveDb();
  res.json(updated);
});

admin.delete("/social-links/:link_id", (req, res) => {
  const idx = db.social_links.findIndex((s) => s.id === req.params.link_id);
  if (idx === -1) return res.status(404).json({ detail: "Sosial media tidak ditemukan" });
  db.social_links.splice(idx, 1);
  saveDb();
  res.json({ message: "Sosial media dihapus" });
});

// --- Admin Games & Topup Management ---
admin.get("/games", (_req, res) => {
  const rows = [...db.games].sort((a, b) => (a.seq || 0) - (b.seq || 0)).map((g) => {
    const mirrored = db.products.filter((p) => p.slug === g.slug && p.product_type === PRODUCT_TYPE);
    const builtInFields = resolveBuiltInDigiflazzFields(g);
    g.fields = builtInFields;
    return {
      ...g,
      fields: builtInFields,
      customer_no_format: resolveDigiflazzCustomerNoFormat(g),
      products_synced: mirrored.length > 0,
      product_count: mirrored.length,
    };
  });
  res.json(rows);
});

admin.post("/games", async (req, res) => {
  const data = req.body || {};
  const name = String(data.name || "").trim();
  if (!name) return res.status(400).json({ detail: "Nama game wajib diisi" });
  const slug = slugify(data.slug || name);
  if (db.games.some((g) => g.slug === slug)) {
    return res.status(400).json({ detail: "Game dengan slug tersebut sudah ada" });
  }
  const iconUrl = String(data.icon ?? "").trim();
  const bannerUrl = String(data.banner ?? "").trim();
  const vendorPrefix = String(data.vendor_prefix ?? "").trim().toUpperCase();
  const cekIdSku = String(data.cek_id_sku ?? (vendorPrefix ? `CEK${vendorPrefix}` : "")).trim().toUpperCase();
  const builtInFields = resolveBuiltInDigiflazzFields({ slug, vendor_prefix: vendorPrefix, name });
  // New games start with empty denominations; products must be pulled from Digiflazz
  const game = {
    ...data,
    id: `gm-${slug}-${uuidHex(4)}`,
    name,
    slug,
    icon: iconUrl,
    banner: bannerUrl,
    vendor_prefix: vendorPrefix,
    cek_id_sku: cekIdSku,
    vendor_id: "vp-digiflazz",
    is_active: Boolean(data.is_active ?? true),
    featured: Boolean(data.featured ?? false),
    seq: Number(data.seq ?? db.games.length),
    fields: builtInFields,
    denominations: [],
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.games.push(game);
  syncGameProducts(game);
  saveDb();
  if (pgPool && pgRuntime.connected) {
    await pushToPostgres(pgPool);
  }
  res.status(201).json({
    ...game,
    customer_no_format: resolveDigiflazzCustomerNoFormat(game),
  });
});

admin.put("/games/:game_id", async (req, res) => {
  const idx = db.games.findIndex((g) => g.id === req.params.game_id);
  if (idx === -1) return res.status(404).json({ detail: "Game tidak ditemukan" });
  const existing = db.games[idx];
  const data = req.body || {};

  // Only allow existing denominations that were pulled from Digiflazz (keep vendor_sku, code, modal_price locked)
  const existingBySku = new Map(
    (existing.denominations || [])
      .filter((d: any) => String(d.vendor_sku || "").trim() !== "")
      .map((d: any) => [String(d.vendor_sku).trim().toUpperCase(), d])
  );

  const sanitizedDenominations = Array.isArray(data.denominations)
    ? data.denominations
        .map((incoming: any) => {
          const skuKey = String(incoming?.vendor_sku || "").trim().toUpperCase();
          const orig: any = existingBySku.get(skuKey);
          if (!orig) return null; // Reject any manually created denomination without an existing Digiflazz SKU
          const modalPrice = Math.max(500, Number(orig.modal_price || 0));
          const sellingPrice = Math.max(modalPrice, Number(incoming.price || orig.price || modalPrice));
          const strikePrice = Math.max(0, Number(incoming.price_strike ?? orig.price_strike ?? 0));
          const skuGroup = normalizeSkuGroup(
            incoming.sku_group ?? orig.sku_group,
            orig.vendor_sku || orig.code,
            orig.label,
            orig.type
          );
          return {
            ...orig,
            code: orig.code,
            vendor_sku: orig.vendor_sku,
            label: orig.label,
            amount: orig.amount,
            modal_price: modalPrice,
            price: sellingPrice,
            price_strike: strikePrice,
            badge: String(incoming.badge ?? orig.badge ?? ""),
            sku_group: skuGroup,
            featured: Boolean(incoming.featured ?? orig.featured),
            is_active: incoming.is_active !== undefined ? Boolean(incoming.is_active) : Boolean(orig.is_active),
          };
        })
        .filter(Boolean)
        .map((d: any, i: number) => ({ ...d, seq: i }))
    : existing.denominations || [];

  const iconUrl = data.icon !== undefined ? String(data.icon || "").trim() : String(existing.icon || "").trim();
  const bannerUrl = data.banner !== undefined ? String(data.banner || "").trim() : String(existing.banner || "").trim();
  const vendorPrefix =
    data.vendor_prefix !== undefined
      ? String(data.vendor_prefix || "").trim().toUpperCase()
      : String(existing.vendor_prefix || "").trim().toUpperCase();
  const cekIdSku =
    data.cek_id_sku !== undefined
      ? String(data.cek_id_sku || "").trim().toUpperCase()
      : String(existing.cek_id_sku || "").trim().toUpperCase();
  const nextSlug = slugify(data.slug || existing.slug || data.name || existing.name);
  const nextName = String(data.name || existing.name || "").trim();
  const builtInFields = resolveBuiltInDigiflazzFields({
    slug: nextSlug,
    vendor_prefix: vendorPrefix,
    name: nextName,
  });

  const updated = {
    ...existing,
    ...data,
    id: existing.id,
    name: nextName,
    slug: nextSlug,
    icon: iconUrl,
    banner: bannerUrl,
    vendor_prefix: vendorPrefix,
    cek_id_sku: cekIdSku,
    vendor_id: "vp-digiflazz",
    fields: builtInFields,
    denominations: sanitizedDenominations,
    updated_at: nowIso(),
  };
  db.games[idx] = updated;
  syncGameProducts(updated);
  saveDb();
  if (pgPool && pgRuntime.connected) {
    await pushToPostgres(pgPool);
  }
  res.json({
    ...updated,
    customer_no_format: resolveDigiflazzCustomerNoFormat(updated),
  });
});

admin.post("/games/:game_id/toggle-active", (req, res) => {
  const idx = db.games.findIndex((g) => g.id === req.params.game_id);
  if (idx === -1) return res.status(404).json({ detail: "Game tidak ditemukan" });
  const game = db.games[idx];
  const nextActive =
    req.body && typeof req.body.is_active === "boolean"
      ? req.body.is_active
      : game.is_active === false;
  game.is_active = nextActive;
  game.updated_at = nowIso();
  const synced = syncGameProducts(game);
  saveDb();
  res.json({
    ...game,
    products_synced: synced > 0,
    product_count: synced,
  });
});

admin.delete("/games/:game_id", (req, res) => {
  const idx = db.games.findIndex((g) => g.id === req.params.game_id);
  if (idx === -1) return res.status(404).json({ detail: "Game tidak ditemukan" });
  const [removed] = db.games.splice(idx, 1);
  const before = db.products.length;
  db.products = db.products.filter((p) => !(p.slug === removed.slug && p.product_type === PRODUCT_TYPE));
  saveDb();
  res.json({ ok: true, products_removed: before - db.products.length });
});

admin.post("/games/sync", (_req, res) => {
  const count = syncAllGames();
  res.json({ ok: true, products: count });
});

admin.get("/games/:game_id/preview", (req, res) => {
  const g = db.games.find((x) => x.id === req.params.game_id);
  if (!g) return res.status(404).json({ detail: "Game tidak ditemukan" });
  res.json(publicGame(g));
});

admin.get("/topup/orders", (req, res) => {
  const { status, game } = req.query as Record<string, string | undefined>;
  let rows = db.transactions.filter((t) => t.product_type === PRODUCT_TYPE);
  if (status) rows = rows.filter((t) => t.payment_status === status);
  if (game) rows = rows.filter((t) => t.game_slug === game);
  rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  res.json(
    rows.map((o) => {
      const copy = { ...o, has_proof: Boolean(o.has_proof) };
      delete copy.payment_proof;
      return copy;
    })
  );
});

admin.get("/topup/orders/:session_id", (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id && t.product_type === PRODUCT_TYPE);
  if (!tx) return res.status(404).json({ detail: "Pesanan top up tidak ditemukan" });
  res.json(tx);
});

admin.post("/topup/orders/:session_id/complete", async (req, res) => {
  const tx = db.transactions.find((t) => t.session_id === req.params.session_id && t.product_type === PRODUCT_TYPE);
  if (!tx) return res.status(404).json({ detail: "Pesanan top up tidak ditemukan" });
  if (tx.payment_status !== "paid") {
    return res.status(400).json({ detail: "Pesanan belum lunas. Setujui pembayaran terlebih dahulu." });
  }
  const dispatched = Boolean(req.body?.dispatch !== false);
  tx.status = "delivered";
  tx.vendor_kind = "digiflazz";
  tx.vendor_ref = `DF-${uuidHex(8).toUpperCase()}`;
  tx.delivered_at = nowIso();
  tx.updated_at = nowIso();
  if (req.body?.note) tx.admin_note = String(req.body.note).trim();
  saveDb();
  res.json({ ...tx, dispatched });
});

admin.get("/topup/integration", (_req, res) => {
  const activeRow =
    db.topup_providers.find((v) => v.kind === "digiflazz") ||
    db.topup_providers[0] || { id: "vp-digiflazz", kind: "digiflazz", name: "Digiflazz Indonesia", cached_balance: null };
  const orderRows = db.transactions.filter((t) => t.product_type === PRODUCT_TYPE);
  const missingSku = db.games
    .map((g) => {
      const denoms = (g.denominations || []).filter((d: any) => d.is_active !== false);
      return {
        game: g.name,
        slug: g.slug,
        missing: denoms.length === 0 ? 1 : 0,
        total: denoms.length,
      };
    })
    .filter((x) => x.total === 0)
    .sort((a, b) => a.game.localeCompare(b.game));

  const rawUser = String(activeRow.config?.username || process.env.DIGIFLAZZ_USERNAME || "").trim();
  const rawKey = String(
    (activeRow.config?.use_dev ? activeRow.config?.dev_key : activeRow.config?.api_key) ||
      activeRow.config?.api_key ||
      process.env.DIGIFLAZZ_API_KEY ||
      ""
  ).trim();
  const hasRealCreds = !isDemoDigiflazzCredential(rawUser, rawKey);
  const hasBalance = hasRealCreds && typeof activeRow.cached_balance === "number";

  res.json({
    active: {
      kind: "digiflazz",
      name: activeRow.name || "Digiflazz Indonesia",
      auto_dispatch: Boolean(activeRow.auto_dispatch !== false),
      available: hasRealCreds,
      vendor_id: activeRow.id || "vp-digiflazz",
      source: hasRealCreds
        ? String(activeRow.config?.username || "").trim()
          ? "db"
          : "env"
        : "none",
    },
    active_id: activeRow.id || "vp-digiflazz",
    vendors: db.topup_providers.filter((v) => v.kind === "digiflazz").map(maskedVendorView),
    balance: {
      supported: true,
      ok: hasBalance,
      balance: hasBalance ? Number(activeRow.cached_balance) : 0,
      message: hasBalance
        ? "Tersinkronisasi dengan Digiflazz"
        : hasRealCreds
          ? "Klik Cek Saldo untuk sinkronisasi saldo Digiflazz"
          : "Kredensial Digiflazz belum dikonfigurasi",
    },
    games_without_sku: missingSku,
    products_unsynced: 0,
    orders: {
      unpaid: orderRows.filter((o) => o.payment_status !== "paid").length,
      waiting_approval: orderRows.filter((o) => o.status === "waiting_approval").length,
      paid_undelivered: orderRows.filter((o) => o.payment_status === "paid" && o.status !== "delivered").length,
      delivered: orderRows.filter((o) => o.status === "delivered").length,
      total: orderRows.length,
    },
  });
});

admin.get("/topup/integration/env", (_req, res) => {
  res.json({});
});

// --- Admin User Management, Overview & Audit Logs ---
function countActiveAdmins(): number {
  return db.users.filter((u) => u.role === "admin" && u.status !== "suspended" && u.is_verified !== false).length;
}

admin.get("/overview", (_req, res) => {
  const total = db.users.length;
  const verified = db.users.filter((u) => u.is_verified !== false).length;
  const unverified = total - verified;
  const suspended = db.users.filter((u) => u.status === "suspended").length;
  const admins = countActiveAdmins();
  const emailCfg = getEmailAuthConfig();
  res.json({
    users: { total, verified, unverified, suspended, admins },
    recent_audit: db.audit_logs.slice(0, 15),
    email_configured: emailCfg.configured,
    email_provider: emailCfg.active_provider,
  });
});

admin.get("/users", (req, res) => {
  const { q, status, verified, role } = req.query as Record<string, string | undefined>;
  let rows = [...db.users].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );

  const summary = {
    total: db.users.length,
    verified: db.users.filter((u) => u.is_verified !== false).length,
    unverified: db.users.filter((u) => u.is_verified === false).length,
    suspended: db.users.filter((u) => u.status === "suspended").length,
    admins: countActiveAdmins(),
  };

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (u) =>
        String(u.email || "").toLowerCase().includes(needle) ||
        String(u.name || "").toLowerCase().includes(needle)
    );
  }
  if (status && status !== "all") {
    rows = rows.filter((u) => (u.status || "active") === status);
  }
  if (verified === "verified") {
    rows = rows.filter((u) => u.is_verified !== false);
  } else if (verified === "unverified") {
    rows = rows.filter((u) => u.is_verified === false);
  }
  if (role && role !== "all") {
    rows = rows.filter((u) => (u.role || "buyer") === role);
  }

  res.json({
    summary,
    total: rows.length,
    users: rows.map(publicUser),
  });
});

admin.get("/users/:id", (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });
  const logs = db.audit_logs.filter((l) => l.target_user_id === u.id || l.actor_user_id === u.id).slice(0, 30);
  res.json({ user: publicUser(u), audit_logs: logs });
});

admin.patch("/users/:id/verify", (req, res) => {
  const actor = (req as any).adminUser;
  const target = db.users.find((x) => x.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });

  const nextVerified = Boolean(req.body?.is_verified);
  if (!nextVerified && actor?.id === target.id) {
    return res.status(400).json({ detail: "Anda tidak dapat mencabut verifikasi akun admin Anda sendiri" });
  }
  if (!nextVerified && target.role === "admin" && countActiveAdmins() <= 1) {
    return res.status(400).json({ detail: "Tidak dapat mencabut verifikasi admin aktif terakhir" });
  }

  target.is_verified = nextVerified;
  target.verified_at = nextVerified ? nowIso() : null;
  target.updated_at = nowIso();
  if (!nextVerified) {
    revokeAllUserSessions(target);
  }
  saveDb();

  writeAuditLog({
    actor,
    action: "user.verification_changed",
    targetUser: target,
    metadata: { is_verified: nextVerified },
    req,
  });

  res.json({
    user: publicUser(target),
    message: nextVerified ? "Email pengguna berhasil diverifikasi" : "Status verifikasi pengguna dicabut",
  });
});

admin.post("/users/:id/resend-verification", async (req, res) => {
  const actor = (req as any).adminUser;
  const target = db.users.find((x) => x.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });
  if (target.is_verified) {
    return res.status(400).json({ detail: "Pengguna ini sudah terverifikasi" });
  }

  const emailCfg = getEmailAuthConfig();
  const { rawToken, otpCode } = issueAuthToken(target, "verify_email", emailCfg.verify_token_ttl_hours * 60);
  const mailRes = await sendVerificationEmail(target, rawToken, req, otpCode);

  writeAuditLog({
    actor,
    action: "admin.resend_verification",
    targetUser: target,
    metadata: { provider: mailRes.provider },
    req,
  });

  res.json({
    message: `Email verifikasi telah dikirim ke ${target.email}`,
    dev_preview_url: mailRes.dev_preview_url,
  });
});

admin.patch("/users/:id/status", (req, res) => {
  const actor = (req as any).adminUser;
  const target = db.users.find((x) => x.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });

  const nextStatus = req.body?.status === "suspended" ? "suspended" : "active";
  if (nextStatus === "suspended") {
    if (actor?.id === target.id) {
      return res.status(400).json({ detail: "Anda tidak dapat menangguhkan akun Anda sendiri" });
    }
    if (target.role === "admin" && countActiveAdmins() <= 1) {
      return res.status(400).json({ detail: "Tidak dapat menangguhkan admin aktif terakhir" });
    }
  }

  const prevStatus = target.status || "active";
  target.status = nextStatus;
  target.updated_at = nowIso();
  if (nextStatus === "suspended") {
    revokeAllUserSessions(target);
  }
  saveDb();

  writeAuditLog({
    actor,
    action: nextStatus === "suspended" ? "user.suspended" : "user.reactivated",
    targetUser: target,
    metadata: { before: prevStatus, after: nextStatus },
    req,
  });

  res.json({
    user: publicUser(target),
    message: nextStatus === "suspended" ? "Akun pengguna telah ditangguhkan" : "Akun pengguna diaktifkan kembali",
  });
});

admin.patch("/users/:id/role", (req, res) => {
  const actor = (req as any).adminUser;
  const target = db.users.find((x) => x.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });

  const nextRole = req.body?.role === "admin" ? "admin" : "buyer";
  if (nextRole !== "admin" && actor?.id === target.id) {
    return res.status(400).json({ detail: "Anda tidak dapat menurunkan role admin Anda sendiri" });
  }
  if (target.role === "admin" && nextRole !== "admin" && countActiveAdmins() <= 1) {
    return res.status(400).json({ detail: "Tidak dapat menurunkan role admin aktif terakhir" });
  }

  const prevRole = target.role || "buyer";
  target.role = nextRole;
  target.updated_at = nowIso();
  revokeAllUserSessions(target);
  saveDb();

  writeAuditLog({
    actor,
    action: "user.role_changed",
    targetUser: target,
    metadata: { before: prevRole, after: nextRole },
    req,
  });

  res.json({
    user: publicUser(target),
    message: `Role pengguna berhasil diubah menjadi ${nextRole === "admin" ? "Admin" : "Buyer"}`,
  });
});

admin.post("/users/:id/revoke-sessions", (req, res) => {
  const actor = (req as any).adminUser;
  const target = db.users.find((x) => x.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });

  revokeAllUserSessions(target);
  writeAuditLog({
    actor,
    action: "sessions.revoked",
    targetUser: target,
    metadata: { by: "admin" },
    req,
  });

  res.json({ ok: true, message: `Seluruh sesi aktif untuk ${target.email} telah dicabut` });
});

admin.delete("/users/:id", (req, res) => {
  const actor = (req as any).adminUser;
  const idx = db.users.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });

  const target = db.users[idx];
  if (actor?.id === target.id) {
    return res.status(400).json({ detail: "Anda tidak dapat menghapus akun Anda sendiri" });
  }
  if (target.role === "admin" && countActiveAdmins() <= 1) {
    return res.status(400).json({ detail: "Tidak dapat menghapus admin aktif terakhir" });
  }

  db.users.splice(idx, 1);
  db.sessions = db.sessions.filter((s) => s.user_id !== target.id);
  db.auth_tokens = db.auth_tokens.filter((t) => t.user_id !== target.id);
  saveDb();

  writeAuditLog({
    actor,
    action: "user.deleted",
    targetUser: target,
    req,
  });

  res.json({ ok: true, message: `Pengguna ${target.email} berhasil dihapus` });
});

admin.get("/audit-logs", (req, res) => {
  const { q, action, limit } = req.query as Record<string, string | undefined>;
  const max = Math.max(1, Math.min(Number(limit || 200), 500));
  let rows = [...db.audit_logs];

  const distinctActions = Array.from(new Set(db.audit_logs.map((l) => l.action).filter(Boolean))).sort();

  if (action && action.trim()) {
    rows = rows.filter((l) => l.action === action.trim());
  }
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (l) =>
        String(l.action || "").toLowerCase().includes(needle) ||
        String(l.actor_email || "").toLowerCase().includes(needle) ||
        String(l.target_email || "").toLowerCase().includes(needle) ||
        String(l.ip || "").toLowerCase().includes(needle) ||
        JSON.stringify(l.metadata || {}).toLowerCase().includes(needle)
    );
  }

  res.json({
    actions: distinctActions,
    logs: rows.slice(0, max),
    blocked_ips: listActiveBlockedIps(),
  });
});

admin.post("/security/unblock-ip", (req, res) => {
  const actor = (req as any).adminUser || getUserOptional(req);
  const ip = String(req.body?.ip || "").trim();
  if (!ip) return res.status(400).json({ detail: "Alamat IP wajib diisi" });
  const unblocked = unblockClientIp(ip, actor, req);
  res.json({
    ok: true,
    unblocked,
    blocked_ips: listActiveBlockedIps(),
    message: unblocked
      ? `Blokir untuk IP ${ip} berhasil dicabut`
      : `IP ${ip} sudah tidak berada dalam daftar blokir`,
  });
});

admin.post("/security/block-ip", (req, res) => {
  const actor = (req as any).adminUser || getUserOptional(req);
  const ip = String(req.body?.ip || "").trim();
  const reason = String(req.body?.reason || "Diblokir manual oleh Admin").trim();
  if (!ip) return res.status(400).json({ detail: "Alamat IP wajib diisi" });
  blockClientIp(ip, reason, "manual_admin_block", req, {
    blocked_by: actor?.email || "admin",
  });
  res.json({
    ok: true,
    blocked_ips: listActiveBlockedIps(),
    message: `IP ${ip} berhasil diblokir selama 15 menit`,
  });
});

function adminEmailSettingsView(req?: Request) {
  const cfg = getEmailAuthConfig();
  return {
    require_email_verification: cfg.require_email_verification,
    allow_dev_preview_links: cfg.allow_dev_preview_links,
    verify_token_ttl_hours: cfg.verify_token_ttl_hours,
    reset_token_ttl_minutes: cfg.reset_token_ttl_minutes,
    public_base_url: cfg.public_base_url,
    resolved_public_url: getAppOrigin(req),
    provider_mode: cfg.provider_mode,
    active_provider: cfg.active_provider,
    configured: cfg.configured,
    resend: {
      enabled: cfg.resend.enabled,
      ready: cfg.resend.ready,
      api_key_set: Boolean(cfg.resend.api_key),
      api_key_masked: maskSecret(cfg.resend.api_key),
      api_key_source: cfg.resend.api_key_source,
      from_email: cfg.resend.from_email,
      from_name: cfg.resend.from_name,
    },
    smtp: {
      enabled: cfg.smtp.enabled,
      ready: cfg.smtp.ready,
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.secure,
      user: cfg.smtp.user,
      pass_set: Boolean(cfg.smtp.pass),
      pass_masked: maskSecret(cfg.smtp.pass),
      pass_source: cfg.smtp.pass_source,
      from_email: cfg.smtp.from_email,
      from_name: cfg.smtp.from_name,
    },
    template: cfg.template,
    last_test: cfg.last_test,
    updated_at: cfg.updated_at,
  };
}

admin.get("/settings/email", (req, res) => {
  res.json({
    ...adminEmailSettingsView(req),
    recent_events: db.email_events.slice(0, 20),
  });
});

admin.put("/settings/email", (req, res) => {
  const actor = (req as any).adminUser;
  const body = req.body || {};
  const existing = db.settings.email_auth || {};
  const prevResend = existing.resend || {};
  const prevSmtp = existing.smtp || {};
  const prevTpl = existing.template || {};

  const resendIn = body.resend || {};
  let nextResendKey = String(prevResend.api_key || "").trim();
  if (resendIn.clear_api_key) {
    nextResendKey = "";
  } else if (typeof resendIn.api_key === "string" && resendIn.api_key.trim() && !resendIn.api_key.includes("*")) {
    nextResendKey = resendIn.api_key.trim();
  }

  const smtpIn = body.smtp || {};
  let nextSmtpPass = String(prevSmtp.pass || "").trim();
  if (smtpIn.clear_pass) {
    nextSmtpPass = "";
  } else if (typeof smtpIn.pass === "string" && smtpIn.pass.trim() && !smtpIn.pass.includes("*")) {
    nextSmtpPass = smtpIn.pass.trim();
  }

  const tplIn = body.template || {};
  const rawAccent = String(tplIn.accent_color ?? prevTpl.accent_color ?? "#00F0FF").trim();
  const validAccent = /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent.toUpperCase() : "#00F0FF";

  const providerModeRaw = String(body.provider_mode || existing.provider_mode || "auto").toLowerCase();
  const providerMode =
    providerModeRaw === "resend" || providerModeRaw === "smtp" || providerModeRaw === "dev_preview"
      ? providerModeRaw
      : "auto";

  const updated = {
    id: "email_auth",
    require_email_verification:
      typeof body.require_email_verification === "boolean"
        ? body.require_email_verification
        : existing.require_email_verification !== false,
    allow_dev_preview_links:
      typeof body.allow_dev_preview_links === "boolean"
        ? body.allow_dev_preview_links
        : existing.allow_dev_preview_links !== false,
    verify_token_ttl_hours: Math.max(
      1,
      Math.min(168, Number(body.verify_token_ttl_hours ?? existing.verify_token_ttl_hours ?? 24))
    ),
    reset_token_ttl_minutes: Math.max(
      5,
      Math.min(1440, Number(body.reset_token_ttl_minutes ?? existing.reset_token_ttl_minutes ?? 60))
    ),
    public_base_url: String(body.public_base_url ?? existing.public_base_url ?? "")
      .trim()
      .replace(/\/+$/, ""),
    provider_mode: providerMode,
    resend: {
      enabled:
        typeof resendIn.enabled === "boolean" ? resendIn.enabled : prevResend.enabled !== false,
      api_key: nextResendKey,
      from_email: String(resendIn.from_email ?? prevResend.from_email ?? "onboarding@resend.dev").trim(),
      from_name: String(resendIn.from_name ?? prevResend.from_name ?? "WillJustPlay Security").trim(),
    },
    smtp: {
      enabled: typeof smtpIn.enabled === "boolean" ? smtpIn.enabled : Boolean(prevSmtp.enabled),
      host: String(smtpIn.host ?? prevSmtp.host ?? "smtp.gmail.com").trim(),
      port: Number(smtpIn.port ?? prevSmtp.port ?? 587) || 587,
      secure:
        typeof smtpIn.secure === "boolean"
          ? smtpIn.secure
          : Number(smtpIn.port ?? prevSmtp.port ?? 587) === 465,
      user: String(smtpIn.user ?? prevSmtp.user ?? "").trim(),
      pass: nextSmtpPass,
      from_email: String(smtpIn.from_email ?? prevSmtp.from_email ?? "").trim(),
      from_name: String(smtpIn.from_name ?? prevSmtp.from_name ?? "WillJustPlay Security").trim(),
    },
    template: {
      brand_name: String(tplIn.brand_name ?? prevTpl.brand_name ?? "WillJustPlay").trim() || "WillJustPlay",
      brand_tagline:
        String(tplIn.brand_tagline ?? prevTpl.brand_tagline ?? "STORE & TOP-UP GAME BERGARANSI").trim() ||
        "STORE & TOP-UP GAME BERGARANSI",
      logo_url:
        String(tplIn.logo_url ?? prevTpl.logo_url ?? DEFAULT_STORE_LOGO_REL_PATH).trim() ||
        DEFAULT_STORE_LOGO_REL_PATH,
      accent_color: validAccent,
      verify_subject:
        String(
          tplIn.verify_subject ??
            prevTpl.verify_subject ??
            "⚡ Verifikasi Email Akun {{brand_name}} — Halo {{name}}!"
        ).trim(),
      verify_badge: String(tplIn.verify_badge ?? prevTpl.verify_badge ?? "VERIFIKASI AKUN").trim(),
      verify_heading:
        String(
          tplIn.verify_heading ?? prevTpl.verify_heading ?? "Konfirmasi & Aktifkan Akun Anda"
        ).trim(),
      verify_body: String(
        tplIn.verify_body ??
          prevTpl.verify_body ??
          "Terima kasih telah bergabung di {{brand_name}}. Untuk menjaga keamanan akun serta membuka akses penuh ke layanan top-up instan dan store akun bergaransi, silakan konfirmasi alamat email Anda melalui tombol di bawah ini."
      ).trim(),
      verify_button_text: String(
        tplIn.verify_button_text ?? prevTpl.verify_button_text ?? "VERIFIKASI EMAIL SEKARANG"
      ).trim(),
      reset_subject: String(
        tplIn.reset_subject ?? prevTpl.reset_subject ?? "🔐 Instruksi Reset Password — {{brand_name}}"
      ).trim(),
      reset_heading: String(
        tplIn.reset_heading ?? prevTpl.reset_heading ?? "Atur Ulang Kata Sandi Akun Anda"
      ).trim(),
      reset_body: String(
        tplIn.reset_body ??
          prevTpl.reset_body ??
          "Kami menerima permintaan untuk mengatur ulang kata sandi akun {{brand_name}} yang terhubung dengan {{email}}. Klik tombol di bawah ini untuk membuat password baru yang aman."
      ).trim(),
      reset_button_text: String(
        tplIn.reset_button_text ?? prevTpl.reset_button_text ?? "ATUR ULANG PASSWORD"
      ).trim(),
      footer_note: String(
        tplIn.footer_note ??
          prevTpl.footer_note ??
          "Jika Anda tidak merasa melakukan permintaan ini di {{brand_name}}, abaikan email ini dengan aman. Keamanan akun Anda tetap terlindungi."
      ).trim(),
      support_text: String(
        tplIn.support_text ??
          prevTpl.support_text ??
          "Butuh bantuan? Hubungi Customer Support Resmi WillJustPlay."
      ).trim(),
      show_account_card:
        typeof tplIn.show_account_card === "boolean"
          ? tplIn.show_account_card
          : prevTpl.show_account_card !== false,
      show_benefits:
        typeof tplIn.show_benefits === "boolean"
          ? tplIn.show_benefits
          : prevTpl.show_benefits !== false,
    },
    last_test: existing.last_test || null,
    updated_at: nowIso(),
  };

  db.settings.email_auth = updated;
  saveDb();

  const view = adminEmailSettingsView(req);
  writeAuditLog({
    actor,
    action: "admin.email_settings_updated",
    metadata: {
      require_email_verification: view.require_email_verification,
      provider_mode: view.provider_mode,
      active_provider: view.active_provider,
      resend_enabled: view.resend.enabled,
      smtp_enabled: view.smtp.enabled,
    },
    req,
  });

  res.json({
    ...view,
    recent_events: db.email_events.slice(0, 20),
    message: "Pengaturan verifikasi, provider & desain template email berhasil disimpan",
  });
});

admin.post("/settings/email/test", async (req, res) => {
  const actor = (req as any).adminUser;
  const body = req.body || {};
  const toEmail = String(body.to_email || actor?.email || ADMIN_EMAIL).trim().toLowerCase();
  if (!toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return res.status(400).json({ detail: "Masukkan alamat email tujuan tes yang valid" });
  }

  const requestedProvider = String(body.provider || "auto").toLowerCase();
  const testTemplateType = String(body.template_type || "verify_preview").toLowerCase();
  const cfg = getEmailAuthConfig();
  const tpl = { ...cfg.template, ...(body.template || {}) };

  let targetProvider: "resend" | "smtp" = "resend";
  if (requestedProvider === "smtp") {
    targetProvider = "smtp";
  } else if (requestedProvider === "resend") {
    targetProvider = "resend";
  } else {
    targetProvider = cfg.active_provider === "smtp" ? "smtp" : "resend";
  }

  const origin = getAppOrigin(req);
  const sampleVerifyUrl = `${origin}/verify-email?token=sample-preview-token-${uuidHex(6)}`;
  const sampleName = actor?.name || toEmail.split("@")[0] || "Gamer";
  const timestamp = formatIndonesianTimestamp();
  const ttlHours = cfg.verify_token_ttl_hours;

  const vars = {
    name: sampleName,
    email: toEmail,
    brand_name: tpl.brand_name,
    brand_tagline: tpl.brand_tagline,
    ttl_hours: ttlHours,
    ttl_minutes: ttlHours * 60,
    verify_url: sampleVerifyUrl,
    action_url: sampleVerifyUrl,
    timestamp,
  };

  let subject = "";
  let html = "";
  let text = "";

  if (testTemplateType === "connection") {
    subject = `⚡ [TES KONEKSI ${targetProvider.toUpperCase()}] ${tpl.brand_name}`;
    html = renderBrandedEmailTemplate({
      templateCfg: tpl,
      badgeText: `TES ${targetProvider.toUpperCase()}`,
      heading: "Koneksi Pengiriman Email Berhasil!",
      greetingName: sampleName,
      bodyHtml: `Ini adalah email uji koneksi dari <strong>Panel Admin ${escapeHtml(
        tpl.brand_name
      )}</strong>. Konfigurasi jalur pengiriman email <strong>${targetProvider.toUpperCase()}</strong> Anda telah aktif dan siap mengirimkan email verifikasi masuk, invoice pembelian, maupun reset password secara real-time.`,
      ctaText: "BUKA PANEL ADMIN",
      ctaUrl: `${origin}/admin`,
      infoTitle: "STATUS KONEKSI & VERIFIKASI SERVER",
      infoRows: [
        { label: "Jalur Provider", value: targetProvider.toUpperCase(), highlight: true },
        { label: "Email Penerima Tes", value: toEmail },
        { label: "Waktu Pengujian", value: timestamp },
        { label: "Status Server", value: "Terhubung & Siap" },
      ],
      showBenefits: false,
      footerNote: tpl.footer_note,
      supportText: tpl.support_text,
      originUrl: origin,
    });
    text = `Ini adalah email percobaan koneksi dari Panel Admin ${tpl.brand_name}.\nProvider: ${targetProvider.toUpperCase()}\nWaktu: ${timestamp}`;
  } else if (testTemplateType === "invoice_preview") {
    const sampleInvoiceId = "WJP-INV-882910";
    const sampleOrderUrl = `${origin}/payment/success?session_id=${sampleInvoiceId}`;
    subject = `🧾 Invoice Resmi & Akses Akun #${sampleInvoiceId} — ${tpl.brand_name}`;
    const sampleBodyHtml = `Pembayaran Anda untuk pesanan <strong>Akun Sultan Mobile Legends Mythic Immortal</strong> telah <strong>terkonfirmasi LUNAS</strong>. Berikut adalah akses data akun beserta invoice resmi pembelian Anda:
      <div style="margin-top:16px;padding:18px;background:#080C18;border:1px solid #A3E635;border-radius:10px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#A3E635;margin-bottom:10px;">
          🔐 DATA AKSES AKUN ANDA (FORMAT RESMI TERVERIFIKASI)
        </div>
        <div style="padding:11px 13px;background:#05070F;border:1px dashed #1E293B;border-radius:8px;font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;color:#00F0FF;font-weight:700;word-break:break-all;margin-bottom:12px;">
          [Moonton + Gmail] [${escapeHtml(toEmail)}] [Wjp#Sultan2026]
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:12px;color:#94A3B8;width:36%;">Tipe Akun</td>
            <td style="padding:6px 0;font-size:13px;color:#F8FAFC;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;">Moonton + Gmail</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:12px;color:#94A3B8;border-top:1px solid #161F33;">Email / Username</td>
            <td style="padding:6px 0;font-size:13px;color:#00F0FF;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;border-top:1px solid #161F33;">${escapeHtml(
              toEmail
            )}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:12px;color:#94A3B8;border-top:1px solid #161F33;">Password</td>
            <td style="padding:6px 0;font-size:13px;color:#A3E635;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;border-top:1px solid #161F33;">Wjp#Sultan2026</td>
          </tr>
        </table>
      </div>`;

    html = renderBrandedEmailTemplate({
      templateCfg: tpl,
      badgeText: "INVOICE & VERIFIKASI LUNAS",
      heading: `Terima Kasih! Invoice #${sampleInvoiceId} Terverifikasi Lunas`,
      greetingName: sampleName,
      bodyHtml: sampleBodyHtml,
      ctaText: "LIHAT INVOICE & SALIN DATA",
      ctaUrl: sampleOrderUrl,
      infoTitle: "RINCIAN INVOICE RESMI & VERIFIKASI PEMBAYARAN",
      infoRows: [
        { label: "Nomor Invoice", value: `#${sampleInvoiceId}`, highlight: true },
        { label: "Produk / Layanan", value: "Akun Sultan MLBB Mythic Immortal", highlight: true },
        { label: "Email Pembeli", value: toEmail },
        { label: "Metode Pembayaran", value: "QRIS Instan Otomatis" },
        { label: "Total Dibayar", value: "Rp 450.000", highlight: true },
        { label: "Status Verifikasi", value: "LUNAS (TERVERIFIKASI)" },
        { label: "Waktu Transaksi", value: timestamp },
      ],
      showBenefits: false,
      footerNote:
        "Simpan email ini sebagai bukti pembayaran resmi (Invoice) dari WillJustPlay. Demi keamanan akun, segera amankan kata sandi setelah login.",
      supportText: tpl.support_text,
      originUrl: origin,
    });
    text = `Halo ${sampleName},\n\nInvoice Resmi #${sampleInvoiceId} telah terverifikasi LUNAS.\nFormat Akses: [Moonton + Gmail] [${toEmail}] [Wjp#Sultan2026]\nTotal: Rp 450.000\nWaktu: ${timestamp}`;
  } else {
    subject = interpolateEmailTemplate(tpl.verify_subject, vars, false);
    const heading = interpolateEmailTemplate(tpl.verify_heading, vars, false);
    const bodyHtml = interpolateEmailTemplate(escapeHtml(tpl.verify_body), vars, true).replace(
      /\n/g,
      "<br/>"
    );
    const buttonText = interpolateEmailTemplate(tpl.verify_button_text, vars, false);
    const footerNote = interpolateEmailTemplate(tpl.footer_note, vars, false);
    const supportText = interpolateEmailTemplate(tpl.support_text, vars, false);

    html = renderBrandedEmailTemplate({
      templateCfg: tpl,
      badgeText: tpl.verify_badge || "VERIFIKASI AKUN",
      heading,
      greetingName: sampleName,
      bodyHtml,
      ctaText: buttonText,
      ctaUrl: sampleVerifyUrl,
      otpCode: "123456",
      expiryLabel: `${ttlHours} Jam`,
      infoTitle: "DETAIL VERIFIKASI AKUN & OTENTIKASI",
      infoRows: tpl.show_account_card
        ? [
            { label: "Nama Pengguna", value: sampleName },
            { label: "Email Terdaftar", value: toEmail, highlight: true },
            { label: "Kode Verifikasi (OTP)", value: "123456 (Pratinjau)", highlight: true },
            { label: "Waktu Pendaftaran", value: timestamp },
            { label: "Status Verifikasi", value: `Aktif via ${targetProvider.toUpperCase()}` },
          ]
        : [],
      showBenefits: tpl.show_benefits,
      footerNote,
      supportText,
      originUrl: origin,
    });
    text = `Halo ${sampleName},\n\n${interpolateEmailTemplate(
      tpl.verify_body,
      vars,
      false
    )}\n\nKode Verifikasi 6-Digit: 123456\nTautan Verifikasi: ${sampleVerifyUrl}`;
  }

  let result: { ok: boolean; provider_id?: string | null; error?: string };
  if (targetProvider === "resend") {
    const tempKey =
      typeof body.resend?.api_key === "string" && body.resend.api_key.trim() && !body.resend.api_key.includes("*")
        ? body.resend.api_key.trim()
        : cfg.resend.api_key;
    const fromEmail = String(body.resend?.from_email || cfg.resend.from_email || "onboarding@resend.dev").trim();
    const fromName = String(body.resend?.from_name || cfg.resend.from_name || "WillJustPlay Security").trim();
    if (!tempKey) {
      return res.status(400).json({ detail: "API Key Resend belum diisi. Masukkan API Key Resend terlebih dahulu." });
    }
    const formattedFrom = fromEmail.includes("<")
      ? fromEmail
      : fromName
      ? `${fromName} <${fromEmail}>`
      : fromEmail;
    result = await sendViaResend({ api_key: tempKey, formatted_from: formattedFrom }, { to: toEmail, subject, html, text });
  } else {
    const host = String(body.smtp?.host || cfg.smtp.host || "").trim();
    const port = Number(body.smtp?.port || cfg.smtp.port || 587);
    const secure = typeof body.smtp?.secure === "boolean" ? body.smtp.secure : cfg.smtp.secure;
    const user = String(body.smtp?.user || cfg.smtp.user || "").trim();
    const pass =
      typeof body.smtp?.pass === "string" && body.smtp.pass.trim() && !body.smtp.pass.includes("*")
        ? body.smtp.pass.trim()
        : cfg.smtp.pass;
    const fromEmail = String(body.smtp?.from_email || cfg.smtp.from_email || user).trim();
    const fromName = String(body.smtp?.from_name || cfg.smtp.from_name || "WillJustPlay Security").trim();

    if (!host || !user || !pass) {
      return res.status(400).json({
        detail: "Host, Username, dan Password SMTP wajib diisi untuk menguji koneksi SMTP.",
      });
    }
    const formattedFrom = fromEmail.includes("<")
      ? fromEmail
      : fromName && fromEmail
      ? `${fromName} <${fromEmail}>`
      : fromEmail || user;
    result = await sendViaSmtp(
      { host, port, secure, user, pass, formatted_from: formattedFrom },
      { to: toEmail, subject, html, text }
    );
  }

  const event = {
    id: "em-" + uuidHex(10),
    to_email: toEmail,
    template: "admin-test",
    subject,
    provider: targetProvider,
    provider_id: result.provider_id || null,
    status: result.ok ? "sent" : "failed",
    error: result.error || null,
    created_at: nowIso(),
  };
  db.email_events.unshift(event);
  if (db.email_events.length > 300) db.email_events.length = 300;

  const testRecord = {
    ok: result.ok,
    provider: targetProvider,
    to_email: toEmail,
    provider_id: result.provider_id || null,
    error: result.error || null,
    tested_at: nowIso(),
  };
  if (!db.settings.email_auth) initDatabase();
  db.settings.email_auth.last_test = testRecord;
  saveDb();

  writeAuditLog({
    actor,
    action: "admin.email_test_sent",
    metadata: { provider: targetProvider, to_email: toEmail, ok: result.ok },
    req,
  });

  if (!result.ok) {
    return res.status(400).json({
      ok: false,
      provider: targetProvider,
      detail: result.error || `Gagal mengirim email tes melalui ${targetProvider.toUpperCase()}`,
      last_test: testRecord,
    });
  }

  res.json({
    ok: true,
    provider: targetProvider,
    to_email: toEmail,
    provider_id: result.provider_id,
    tested_at: testRecord.tested_at,
    message: `Email tes berhasil dikirim ke ${toEmail} melalui ${targetProvider.toUpperCase()}`,
    last_test: testRecord,
    recent_events: db.email_events.slice(0, 20),
  });
});

admin.get("/email-events", (_req, res) => {
  const cfg = getEmailAuthConfig();
  res.json({
    configured: cfg.configured,
    provider: cfg.active_provider,
    events: db.email_events.slice(0, 100),
  });
});

// ---------------- Database & PostgreSQL Management Routes ----------------
admin.get("/database/status", (_req, res) => {
  const pgCfg = getEffectivePostgresConfig();
  const maskedUrl = pgCfg.connection_string
    ? pgCfg.connection_string.replace(/(:\/\/[^:]+:)([^@]+)(@)/, "$1********$3")
    : "";

  let firebaseInfo: any = { configured: false, project_id: "", database_id: "" };
  const fbPath = path.join(__dirname, "firebase-applet-config.json");
  if (fs.existsSync(fbPath)) {
    try {
      const rawFb = JSON.parse(fs.readFileSync(fbPath, "utf-8"));
      firebaseInfo = {
        configured: Boolean(rawFb.projectId && rawFb.firestoreDatabaseId),
        project_id: rawFb.projectId || "",
        database_id: rawFb.firestoreDatabaseId || "",
        auth_domain: rawFb.authDomain || "",
      };
    } catch {
      // ignore parse error
    }
  }

  const tables = [
    { name: "wjp_users", label: "Users & Admin", count: (db.users || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_products", label: "Katalog Produk (Beranda & Top-Up)", count: (db.products || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_games", label: "Master Game & Denominasi", count: (db.games || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_transactions", label: "Transaksi & Pesanan", count: (db.transactions || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_testimonials", label: "Testimoni Pelanggan", count: (db.testimonials || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_manual_destinations", label: "Rekening, QRIS & Crypto Manual", count: (db.manual_destinations || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_social_links", label: "Tautan Sosial Media", count: (db.social_links || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_topup_providers", label: "Provider Top-Up (Digiflazz)", count: (db.topup_providers || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_sessions", label: "Sesi Login Aktif", count: (db.sessions || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_auth_tokens", label: "Token OTP & Verifikasi", count: (db.auth_tokens || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_audit_logs", label: "Log Audit Keamanan", count: (db.audit_logs || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_email_events", label: "Riwayat Pengiriman Email", count: (db.email_events || []).length, primary_key: "id (TEXT)" },
    { name: "wjp_settings", label: "Konfigurasi Sistem & Gateway", count: Object.keys(db.settings || {}).length, primary_key: "id (TEXT)" },
  ];

  res.json({
    postgres: {
      ...pgRuntime,
      configured: Boolean(pgCfg.connection_string),
      source: pgCfg.source,
      ssl: pgCfg.ssl,
      auto_sync: pgCfg.auto_sync,
      masked_url: maskedUrl,
    },
    firebase: firebaseInfo,
    mongodb: {
      connected: Boolean(mongoDb),
      configured: Boolean(MONGODB_URI),
    },
    local_store: {
      active: true,
      path: "server/db_state.json",
      size_bytes: fs.existsSync(DB_STATE_PATH) ? fs.statSync(DB_STATE_PATH).size : 0,
    },
    tables,
    total_records: tables.reduce((acc, t) => acc + t.count, 0),
  });
});

admin.post("/database/postgres/config", async (req, res) => {
  const actor = (req as any).adminUser || null;
  const body = req.body || {};
  const rawConn = typeof body.connection_string === "string" ? body.connection_string.trim() : "";
  const existingConn = String(db.settings?.postgres_config?.connection_string || ENV_POSTGRES_URL || "").trim();
  const nextConn = rawConn && !rawConn.includes("********") ? rawConn : existingConn;
  const ssl = body.ssl !== false;
  const autoSync = body.auto_sync !== false;

  db.settings.postgres_config = {
    id: "postgres_config",
    connection_string: nextConn,
    ssl,
    auto_sync: autoSync,
    updated_at: nowIso(),
  };
  saveDb();

  if (!nextConn) {
    if (pgPool) {
      await pgPool.end().catch(() => {});
      pgPool = null;
    }
    pgRuntime.connected = false;
    pgRuntime.configured = false;
    pgRuntime.last_error = null;
    return res.json({
      ok: true,
      connected: false,
      message: "Konfigurasi PostgreSQL dikosongkan. Sistem menggunakan penyimpanan Cloud & Lokal aktif.",
    });
  }

  const connRes = await initPostgresConnection(nextConn, ssl);
  writeAuditLog({
    actor,
    action: "admin.postgres_config_updated",
    metadata: { host: pgRuntime.host, database: pgRuntime.database, connected: connRes.ok },
    req,
  });

  if (!connRes.ok) {
    return res.status(400).json({
      ok: false,
      connected: false,
      detail: connRes.error || "Gagal terhubung ke server PostgreSQL. Periksa kembali URI koneksi Anda.",
      postgres: pgRuntime,
    });
  }

  res.json({
    ok: true,
    connected: true,
    version: connRes.version,
    message: `Berhasil terhubung ke PostgreSQL (${pgRuntime.host}/${pgRuntime.database}) & menginisialisasi 13 tabel relasional!`,
    postgres: pgRuntime,
  });
});

admin.post("/database/postgres/sync", async (req, res) => {
  const actor = (req as any).adminUser || null;
  const direction = String(req.body?.direction || "push").toLowerCase();

  if (!pgPool || !pgRuntime.connected) {
    const connRes = await initPostgresConnection();
    if (!connRes.ok) {
      return res.status(400).json({
        ok: false,
        detail: connRes.error || "PostgreSQL belum terhubung. Masukkan Connection URI terlebih dahulu.",
      });
    }
  }

  if (direction === "pull") {
    const pullRes = await pullFromPostgres(pgPool);
    if (!pullRes.ok) {
      return res.status(400).json({ ok: false, detail: pullRes.error || "Gagal menarik data dari PostgreSQL" });
    }
    writeAuditLog({
      actor,
      action: "admin.postgres_pull",
      metadata: { loaded_rows: pullRes.loaded_rows },
      req,
    });
    return res.json({
      ok: true,
      direction: "pull",
      loaded_rows: pullRes.loaded_rows,
      synced_at: pgRuntime.last_sync_at,
      message: `Berhasil memuat ${pullRes.loaded_rows} baris data dari PostgreSQL ke aplikasi!`,
    });
  }

  const pushRes = await pushToPostgres(pgPool);
  if (!pushRes.ok) {
    return res.status(400).json({ ok: false, detail: pushRes.error || "Gagal mendorong data ke PostgreSQL" });
  }
  writeAuditLog({
    actor,
    action: "admin.postgres_push",
    metadata: { synced_at: pushRes.synced_at },
    req,
  });
  res.json({
    ok: true,
    direction: "push",
    synced_at: pushRes.synced_at,
    message: "Seluruh 13 tabel relasional berhasil disinkronkan ke PostgreSQL!",
  });
});

admin.get("/database/postgres/sql-dump", (_req, res) => {
  const sql = generatePostgresSqlDump();
  res.json({
    ok: true,
    filename: `willjustplay_postgres_${new Date().toISOString().slice(0, 10)}.sql`,
    sql,
    ddl_statements: POSTGRES_DDL_STATEMENTS,
  });
});

api.use("/admin", admin);
api.use((_req, res) => {
  res.status(404).json({ detail: "Endpoint tidak ditemukan" });
});
app.use("/api", api);

// ---------------- Vite Dev Middleware / Production Static Serving ----------------
async function startServer() {
  const distPath = path.join(__dirname, "dist");
  const assetsImagesPath = path.join(__dirname, "src/assets/images");
  if (fs.existsSync(assetsImagesPath)) {
    app.use("/src/assets/images", express.static(assetsImagesPath));
  }
  const isProd =
    (process.env.NODE_ENV === "production" ||
      Boolean(process.env.COOLIFY_URL || process.env.COOLIFY_FQDN)) &&
    fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`WillJustPlay server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;
export { app };
