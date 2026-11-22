export interface PostgresRuntimeStatus {
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

export function parsePostgresMeta(connStr: string) {
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

export const POSTGRES_DDL_STATEMENTS = [
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
  `CREATE TABLE IF NOT EXISTS wjp_files (
    path TEXT PRIMARY KEY,
    content_type TEXT NOT NULL DEFAULT 'image/jpeg',
    filename TEXT DEFAULT '',
    data_base64 TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
];

export const SEED_CRYPTO_DESTINATIONS = [
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

export const SEED_MANUAL_DESTINATIONS = [
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

export const SEED_SOCIAL_LINKS = [
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
