import path from "path";
import {
  nowIso,
  uuidHex,
   normalizeUploadFilePath,
  cleanBase64Payload,
} from "./helpers";

export interface ParsedDatabaseCollections {
  users?: any[];
  products?: any[];
  games?: any[];
  transactions?: any[];
  testimonials?: any[];
  manual_destinations?: any[];
  social_links?: any[];
  topup_providers?: any[];
  sessions?: any[];
  auth_tokens?: any[];
  audit_logs?: any[];
  email_events?: any[];
  settings?: Record<string, any>;
  files?: Record<string, any>;
}

export function buildFullJsonBackup(db: any) {
  const users = Array.isArray(db.users) ? db.users : [];
  const products = Array.isArray(db.products) ? db.products : [];
  const games = Array.isArray(db.games) ? db.games : [];
  const transactions = Array.isArray(db.transactions) ? db.transactions : [];
  const testimonials = Array.isArray(db.testimonials) ? db.testimonials : [];
  const manual_destinations = Array.isArray(db.manual_destinations) ? db.manual_destinations : [];
  const social_links = Array.isArray(db.social_links) ? db.social_links : [];
  const topup_providers = Array.isArray(db.topup_providers) ? db.topup_providers : [];
  const sessions = Array.isArray(db.sessions) ? db.sessions : [];
  const auth_tokens = Array.isArray(db.auth_tokens) ? db.auth_tokens : [];
  const audit_logs = Array.isArray(db.audit_logs) ? db.audit_logs : [];
  const email_events = Array.isArray(db.email_events) ? db.email_events : [];
  const settings = db.settings && typeof db.settings === "object" ? db.settings : {};
  const files = db.files && typeof db.files === "object" ? db.files : {};

  const totalDenominations = games.reduce(
    (sum: number, g: any) => sum + (Array.isArray(g?.denominations) ? g.denominations.length : 0),
    0
  );

  return {
    format: "willjustplay_db_backup_v1",
    version: 1,
    exported_at: nowIso(),
    counts: {
      users: users.length,
      products: products.length,
      games: games.length,
      denominations: totalDenominations,
      transactions: transactions.length,
      testimonials: testimonials.length,
      manual_destinations: manual_destinations.length,
      social_links: social_links.length,
      topup_providers: topup_providers.length,
      audit_logs: audit_logs.length,
      email_events: email_events.length,
      settings: Object.keys(settings).length,
      files: Object.keys(files).length,
    },
    data: {
      users,
      products,
      games,
      transactions,
      testimonials,
      manual_destinations,
      social_links,
      topup_providers,
      sessions,
      auth_tokens,
      audit_logs,
      email_events,
      settings,
      files,
    },
  };
}

/**
 * Extracts SQL single-quoted string literals and returns any literal followed by ::jsonb
 * or the last JSON-like literal in an INSERT statement.
 */
function extractJsonbFromInsertStatement(stmt: string): any | null {
  const literals: { value: string; isJsonb: boolean }[] = [];
  let i = 0;
  const len = stmt.length;

  while (i < len) {
    if (stmt[i] === "'") {
      i++; // skip opening quote
      let chars: string[] = [];
      while (i < len) {
        if (stmt[i] === "'") {
          if (i + 1 < len && stmt[i + 1] === "'") {
            chars.push("'");
            i += 2;
            continue;
          } else {
            i++; // skip closing quote
            break;
          }
        }
        chars.push(stmt[i]);
        i++;
      }
      const afterSlice = stmt.slice(i, i + 12).trimStart().toLowerCase();
      const isJsonb = afterSlice.startsWith("::jsonb");
      literals.push({ value: chars.join(""), isJsonb });
    } else {
      i++;
    }
  }

  const jsonbCand =
    literals.find((l) => l.isJsonb) ||
    [...literals].reverse().find((l) => {
      const t = l.value.trim();
      return t.startsWith("{") && t.endsWith("}");
    });

  if (!jsonbCand) return null;
  try {
    return JSON.parse(jsonbCand.value);
  } catch {
    return null;
  }
}

export function parseSqlDumpToCollections(sqlText: string): {
  ok: boolean;
  collections: ParsedDatabaseCollections;
  parsedRows: number;
  error?: string;
} {
  const raw = String(sqlText || "").trim();
  if (!raw) {
    return { ok: false, collections: {}, parsedRows: 0, error: "File SQL kosong" };
  }

  const collections: Required<ParsedDatabaseCollections> = {
    users: [],
    products: [],
    games: [],
    transactions: [],
    testimonials: [],
    manual_destinations: [],
    social_links: [],
    topup_providers: [],
    sessions: [],
    auth_tokens: [],
    audit_logs: [],
    email_events: [],
    settings: {},
    files: {},
  };

  let parsedRows = 0;
  const insertRegex = /INSERT\s+INTO\s+(?:public\.)?(wjp_[a-z0-9_]+)\b/gi;
  let match: RegExpExecArray | null;
  const starts: { table: string; index: number }[] = [];

  while ((match = insertRegex.exec(raw)) !== null) {
    starts.push({ table: match[1].toLowerCase(), index: match.index });
  }

  if (starts.length === 0) {
    return {
      ok: false,
      collections: {},
      parsedRows: 0,
      error: "Tidak ditemukan perintah INSERT INTO wjp_* di dalam file SQL tersebut.",
    };
  }

  for (let idx = 0; idx < starts.length; idx++) {
    const current = starts[idx];
    const nextIndex = idx + 1 < starts.length ? starts[idx + 1].index : raw.length;
    const stmt = raw.slice(current.index, nextIndex);
    const doc = extractJsonbFromInsertStatement(stmt);
    if (!doc || typeof doc !== "object") continue;

    switch (current.table) {
      case "wjp_users":
        collections.users.push(doc);
        parsedRows++;
        break;
      case "wjp_products":
        collections.products.push(doc);
        parsedRows++;
        break;
      case "wjp_games":
        collections.games.push(doc);
        parsedRows++;
        break;
      case "wjp_transactions":
        collections.transactions.push(doc);
        parsedRows++;
        break;
      case "wjp_testimonials":
        collections.testimonials.push(doc);
        parsedRows++;
        break;
      case "wjp_manual_destinations":
        collections.manual_destinations.push(doc);
        parsedRows++;
        break;
      case "wjp_social_links":
        collections.social_links.push(doc);
        parsedRows++;
        break;
      case "wjp_topup_providers":
        collections.topup_providers.push(doc);
        parsedRows++;
        break;
      case "wjp_sessions":
        collections.sessions.push(doc);
        parsedRows++;
        break;
      case "wjp_auth_tokens":
        collections.auth_tokens.push(doc);
        parsedRows++;
        break;
      case "wjp_audit_logs":
        collections.audit_logs.push(doc);
        parsedRows++;
        break;
      case "wjp_email_events":
        collections.email_events.push(doc);
        parsedRows++;
        break;
      case "wjp_settings": {
        const key = String(doc.id || "").trim();
        if (key) {
          collections.settings[key] = doc;
          parsedRows++;
        }
        break;
      }
      case "wjp_files": {
        const cleanPath =
          normalizeUploadFilePath(doc.path) || String(doc.path || "").replace(/^\/+/, "");
        const cleanB64 = cleanBase64Payload(doc.dataBase64 || doc.data_base64 || "");
        if (cleanPath && cleanB64) {
          collections.files[cleanPath] = {
            path: cleanPath,
            dataBase64: cleanB64,
            content_type: String(doc.content_type || "image/jpeg"),
            filename: String(doc.filename || path.basename(cleanPath)),
            created_at: String(doc.created_at || nowIso()),
          };
          parsedRows++;
        }
        break;
      }
      default:
        break;
    }
  }

  if (parsedRows === 0) {
    return {
      ok: false,
      collections: {},
      parsedRows: 0,
      error: "Gagal mengekstrak data JSONB dari perintah INSERT SQL.",
    };
  }

  return { ok: true, collections, parsedRows };
}

export function parseJsonBackupToCollections(rawPayload: any): {
  ok: boolean;
  collections: ParsedDatabaseCollections;
  parsedRows: number;
  error?: string;
} {
  let obj = rawPayload;
  if (typeof rawPayload === "string") {
    try {
      obj = JSON.parse(rawPayload);
    } catch (e: any) {
      return {
        ok: false,
        collections: {},
        parsedRows: 0,
        error: `Format JSON tidak valid: ${e?.message || "Gagal mem-parsing JSON"}`,
      };
    }
  }

  if (!obj || typeof obj !== "object") {
    return {
      ok: false,
      collections: {},
      parsedRows: 0,
      error: "Isi file JSON harus berupa objek database yang valid.",
    };
  }

  const root = obj.data && typeof obj.data === "object" && !Array.isArray(obj.data) ? obj.data : obj;

  const collections: ParsedDatabaseCollections = {};
  let parsedRows = 0;

  const arrayKeys: (keyof ParsedDatabaseCollections)[] = [
    "users",
    "products",
    "games",
    "transactions",
    "testimonials",
    "manual_destinations",
    "social_links",
    "topup_providers",
    "sessions",
    "auth_tokens",
    "audit_logs",
    "email_events",
  ];

  for (const key of arrayKeys) {
    if (Array.isArray(root[key])) {
      (collections as any)[key] = root[key];
      parsedRows += root[key].length;
    }
  }

  if (root.settings && typeof root.settings === "object" && !Array.isArray(root.settings)) {
    collections.settings = root.settings;
    parsedRows += Object.keys(root.settings).length;
  }

  if (root.files && typeof root.files === "object" && !Array.isArray(root.files)) {
    const cleanFiles: Record<string, any> = {};
    for (const [rawKey, rec] of Object.entries<any>(root.files)) {
      if (!rec || typeof rec !== "object") continue;
      const cleanPath =
        normalizeUploadFilePath(rawKey || rec.path) ||
        String(rec.path || rawKey || "").replace(/^\/+/, "");
      const cleanB64 = cleanBase64Payload(rec.dataBase64 || rec.data_base64 || "");
      if (!cleanPath || !cleanB64) continue;
      cleanFiles[cleanPath] = {
        path: cleanPath,
        dataBase64: cleanB64,
        content_type: String(rec.content_type || "image/jpeg"),
        filename: String(rec.filename || path.basename(cleanPath)),
        created_at: String(rec.created_at || nowIso()),
      };
      parsedRows++;
    }
    collections.files = cleanFiles;
  }

  const hasAnyCollection =
    arrayKeys.some((k) => Array.isArray((collections as any)[k])) ||
    Boolean(collections.settings) ||
    Boolean(collections.files);

  if (!hasAnyCollection) {
    return {
      ok: false,
      collections: {},
      parsedRows: 0,
      error:
        "File JSON tidak memiliki struktur koleksi database WillJustPlay (users, products, games, transactions, dll).",
    };
  }

  return { ok: true, collections, parsedRows };
}

export function mergeArrayById(existingList: any[], incomingList: any[], idGetter: (item: any) => string): any[] {
  const map = new Map<string, any>();
  for (const item of Array.isArray(existingList) ? existingList : []) {
    if (!item || typeof item !== "object") continue;
    const key = idGetter(item);
    if (key) map.set(key, item);
  }
  for (const item of Array.isArray(incomingList) ? incomingList : []) {
    if (!item || typeof item !== "object") continue;
    const key = idGetter(item) || uuidHex(12);
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, ...item } : item);
  }
  return Array.from(map.values());
}
