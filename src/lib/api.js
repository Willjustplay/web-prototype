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

export const waLink = (text) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

export const imgSrc = (url) => {
  if (!url) return "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'/%3E";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return BACKEND_URL ? `${BACKEND_URL}${url}` : url;
};
