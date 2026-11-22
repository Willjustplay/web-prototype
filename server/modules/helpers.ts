import crypto from "crypto";

export const nowIso = () => new Date().toISOString();

export const uuidHex = (len = 8) => crypto.randomUUID().replace(/-/g, "").slice(0, len);

export const slugify = (v: string) =>
  String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function normalizeUploadFilePath(rawUrlOrPath: string): string {
  const s = String(rawUrlOrPath || "").trim();
  if (!s) return "";
  const match = s.match(/(?:^|\/api\/files\/)(uploads\/[a-zA-Z0-9._-]+)/);
  if (match && match[1]) return match[1];
  if (s.startsWith("uploads/")) return s;
  return "";
}

export function cleanBase64Payload(raw: string): string {
  const str = String(raw || "").trim();
  if (!str) return "";
  const commaIdx = str.indexOf("base64,");
  const payload = commaIdx !== -1 ? str.slice(commaIdx + 7) : str;
  return payload.replace(/[\r\n\s]+/g, "");
}

export function sqlLiteral(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "0";
  return `'${String(val).replace(/'/g, "''")}'`;
}
