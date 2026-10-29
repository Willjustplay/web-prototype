import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const api = axios.create({ baseURL: API });

const savedToken = typeof localStorage !== "undefined" ? localStorage.getItem("wjp_token") : null;
if (savedToken) api.defaults.headers.common.Authorization = `Bearer ${savedToken}`;

export const formatApiError = (detail) => {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
};

export const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export const USD_RATE = 16000;

export const resolveUSD = (itemOrUsd, fallbackIdr = 0) => {
  if (itemOrUsd && typeof itemOrUsd === "object") {
    const explicit = Number(itemOrUsd.price_usd);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const idr = Number(itemOrUsd.price || 0);
    if (idr > 0) return Math.max(1, Math.round((idr / USD_RATE) * 100) / 100);
    return 0;
  }
  const direct = Number(itemOrUsd);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const idr = Number(fallbackIdr || 0);
  if (idr > 0) return Math.max(1, Math.round((idr / USD_RATE) * 100) / 100);
  return 0;
};

export const formatUSD = (itemOrUsd, fallbackIdr = 0) => {
  const val = resolveUSD(itemOrUsd, fallbackIdr);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: val % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
};

export const WA_NUMBER = "6285693161480";
export const FB_URL = "https://www.facebook.com/share/1Ey74rNDVi/";
export const FB_LOGO_URL = "https://www.facebook.com/share/1DNMWVGsG5/";
export const STORE_LOGO_URL = "/assets/aistudio/photo_2026-10-28_01-45-50_fca1f215.jpg";

export const PROFILE_AVATARS = [
  { id: "av-1", name: "Rick", url: "/assets/aistudio/photo_2026-10-28_02-22-09_470c90d8.jpg" },
  { id: "av-2", name: "Dante", url: "/assets/aistudio/photo_2026-10-28_02-22-13_652b92ce.jpg" },
  { id: "av-3", name: "Vergil", url: "/assets/aistudio/photo_2026-10-28_02-22-16_52b6e712.jpg" },
  { id: "av-4", name: "Aizen", url: "/assets/aistudio/photo_2026-10-28_02-22-18_efd389db.jpg" },
  { id: "av-5", name: "Rukia", url: "/assets/aistudio/photo_2026-10-28_02-22-20_5831c2fa.jpg" },
  { id: "av-6", name: "Renge", url: "/assets/aistudio/photo_2026-10-28_02-22-23_21c3bd49.jpg" },
  { id: "av-7", name: "Maple", url: "/assets/aistudio/photo_2026-10-28_02-22-25_b7f0d619.jpg" },
  { id: "av-8", name: "Gojo", url: "/assets/aistudio/photo_2026-10-28_02-22-29_87215399.jpg" },
  { id: "av-9", name: "Saitama", url: "/assets/aistudio/photo_2026-10-28_02-22-31_d3fa61d6.jpg" },
  { id: "av-10", name: "Chitoge", url: "/assets/aistudio/photo_2026-10-28_02-22-34_4bd8132c.jpg" },
];

export const getLocalUserAvatar = (user) => {
  if (typeof localStorage === "undefined") return "";
  const key = String(user?.id || user?.email || "").trim().toLowerCase();
  if (key) {
    const saved = localStorage.getItem(`wjp_avatar_${key}`);
    if (saved && saved.trim()) return saved.trim();
  }
  const fallbackSaved = localStorage.getItem("wjp_avatar_active");
  return fallbackSaved && fallbackSaved.trim() ? fallbackSaved.trim() : "";
};

export const saveLocalUserAvatar = (user, avatarUrl) => {
  if (typeof localStorage === "undefined" || !avatarUrl) return;
  const clean = String(avatarUrl).trim();
  if (!clean) return;
  const key = String(user?.id || user?.email || "").trim().toLowerCase();
  if (key) {
    localStorage.setItem(`wjp_avatar_${key}`, clean);
  }
  localStorage.setItem("wjp_avatar_active", clean);
};

export const resolveUserAvatar = (user) => {
  if (user?.avatar && String(user.avatar).trim()) return String(user.avatar).trim();
  const localAv = getLocalUserAvatar(user);
  if (localAv) return localAv;
  const seed = String(user?.email || user?.id || "wjp");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PROFILE_AVATARS[hash % PROFILE_AVATARS.length].url;
};

export const waLink = (text) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

export const imgSrc = (url) => {
  if (!url) return "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'/%3E";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return BACKEND_URL ? `${BACKEND_URL}${url}` : url;
};
