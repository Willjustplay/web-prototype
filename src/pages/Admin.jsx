import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  LogOut,
  X,
  Loader2,
  Package,
  Receipt,
  ArrowLeft,
  Upload,
  MessageSquareQuote,
  Webhook,
  Share2,
  Gamepad2,
  Plug,
  Users,
  ShieldAlert,
  MailCheck,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  Wallet,
  Sparkles,
  Eye,
  TrendingUp,
  Calendar,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  QrCode,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatIDR, formatUSD, resolveUSD, imgSrc, formatApiError } from "@/lib/api";
import { AdminTestimonials } from "@/components/AdminTestimonials";
import { AdminPayment } from "@/components/AdminPayment";
import { AdminPaykita } from "@/components/AdminPaykita";
import { AdminSocials } from "@/components/AdminSocials";
import { AdminTopup } from "@/components/AdminTopup";
import { AdminUsers } from "@/components/AdminUsers";
import { AdminAuditLogs } from "@/components/AdminAuditLogs";
import { AdminEmailVerification } from "@/components/AdminEmailVerification";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = ["Akun Game", "Jasa Joki", "Item Game", "Lainnya"];
const BADGE_PRESETS = ["Verified Seller", "Garansi 100%", "Diskon Hot"];
const CONDITION_PRESETS = ["ready", "unready", "sold"];
const MAX_GALLERY_IMAGES = 10;

const isTopupItem = (p) =>
  Boolean(
    p &&
      (p.product_type === "topup" ||
        String(p.category || "").toLowerCase() === "topup game" ||
        p.denomination_code ||
        p.denomination ||
        String(p.id || "").startsWith("tp-") ||
        String(p.id || "").startsWith("topup-"))
  );

const AUTO_GATEWAYS = [
  { id: "paykita", name: "PayKita", tagline: "QRIS Produk Beranda" },
  { id: "duitku", name: "Duitku", tagline: "QRIS Produk Top Up" },
];
const AUTO_GATEWAY_IDS = AUTO_GATEWAYS.map((g) => g.id);

const EMPTY_PAYMENT_CONFIG = {
  paykita: true,
  manual: true,
  crypto: true,
  preferred_gateway: "auto",
  disabled_gateways: [],
  disabled_destinations: [],
};

const normalizePaymentConfig = (raw) => {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const disabledGateways = Array.isArray(cfg.disabled_gateways)
    ? Array.from(
        new Set(
          cfg.disabled_gateways
            .map((id) => String(id || "").toLowerCase().trim())
            .filter((id) => AUTO_GATEWAY_IDS.includes(id))
        )
      )
    : [];
  const rawPreferred = String(cfg.preferred_gateway || "auto").toLowerCase().trim();
  const preferredGateway = AUTO_GATEWAY_IDS.includes(rawPreferred) ? rawPreferred : "auto";
  return {
    paykita: cfg.paykita !== false,
    manual: cfg.manual !== false,
    crypto: cfg.crypto !== false,
    preferred_gateway: preferredGateway,
    disabled_gateways: disabledGateways,
    disabled_destinations: Array.isArray(cfg.disabled_destinations)
      ? cfg.disabled_destinations.map((id) => String(id)).filter(Boolean)
      : [],
  };
};

const ACCOUNT_TYPE_PRESETS = [
  "Gmail",
  "Moonton",
  "Hoyoverse",
  "Riot ID",
  "Google Play",
  "Facebook",
  "VK",
  "Steam",
];

const parseAdminDeliveryBracket = (raw) => {
  const str = String(raw || "");
  const m = str.match(/\[([^\]]*)\]\s*\[([^\]]*)\]\s*\[([^\]]*)\]/);
  if (m) {
    const extra = str
      .replace(m[0], "")
      .replace(/^\s*\r?\n?/, "");
    return {
      accountType: m[1] || "Gmail",
      accountEmail: m[2] || "",
      accountPassword: m[3] || "",
      extraNotes: extra,
      hasBracket: true,
    };
  }
  return {
    accountType: "Gmail",
    accountEmail: "",
    accountPassword: "",
    extraNotes: str,
    hasBracket: false,
  };
};

const buildAdminDeliveryBracket = (accountType, accountEmail, accountPassword, extraNotes) => {
  const cleanType = String(accountType || "Gmail").replace(/[\[\]]/g, "").trim() || "Gmail";
  const cleanEmail = String(accountEmail || "").replace(/[\[\]]/g, "").trim();
  const cleanPass = String(accountPassword || "").replace(/[\[\]]/g, "").trim();
  const cleanNotes = String(extraNotes || "").trim();
  const bracketLine = `[${cleanType}] [${cleanEmail}] [${cleanPass}]`;
  return cleanNotes ? `${bracketLine}\n${cleanNotes}` : bracketLine;
};

const EMPTY_FORM = {
  game: "",
  category: "Akun Game",
  title: "",
  price: 0,
  price_usd: "",
  rank: "",
  image: "",
  images: [],
  stock: 1,
  badges: [],
  description: "",
  featured: false,
  sold: 0,
  rating: 5.0,
  warranty: "100%",
  delivery_info: "[Gmail] [contoh@gmail.com] [Password#123]",
  condition: "ready",
  payment_config: EMPTY_PAYMENT_CONFIG,
};

export default function Admin() {
  const { user, login, adminLogin, logout: authLogout, initializing } = useAuth();
  const [params] = useSearchParams();
  const passwordOnly = params.get("mode") === "password";
  const authed = !!user && user.role === "admin";
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [checking, setChecking] = useState(false);
  const [products, setProducts] = useState([]);
  const [productCatFilter, setProductCatFilter] = useState("Semua");
  const [productSearch, setProductSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [testimonials, setTestimonials] = useState([]);
  const [tab, setTab] = useState("produk");
  const [catalogScope, setCatalogScope] = useState("beranda");
  const [paymentScope, setPaymentScope] = useState("manual");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [badgeInput, setBadgeInput] = useState("");
  const [proofUrl, setProofUrl] = useState(null);
  const [manualDestinations, setManualDestinations] = useState([]);
  const [autoGatewaysState, setAutoGatewaysState] = useState({
    active_gateway: "paykita",
    gateways: {},
  });
  const [togglingPayKey, setTogglingPayKey] = useState(null);

  const berandaProducts = useMemo(() => products.filter((p) => !isTopupItem(p)), [products]);
  const topupProducts = useMemo(() => products.filter((p) => isTopupItem(p)), [products]);

  const filteredBerandaProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return berandaProducts.filter((p) => {
      if (productCatFilter !== "Semua" && p.category !== productCatFilter) return false;
      if (!q) return true;
      return (
        String(p.title || "").toLowerCase().includes(q) ||
        String(p.game || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q)
      );
    });
  }, [berandaProducts, productCatFilter, productSearch]);

  const [userNow, setUserNow] = useState(() => new Date());
  const [showSalesChart, setShowSalesChart] = useState(false);
  const [salesViewMode, setSalesViewMode] = useState("tanggal"); // "tanggal" | "bulan" | "tahun"
  const [salesYear, setSalesYear] = useState(() => new Date().getFullYear());
  const [salesMonth, setSalesMonth] = useState(() => new Date().getMonth());
  const [salesDay, setSalesDay] = useState("all"); // "all" or 1..31
  const [salesOnlyPaid, setSalesOnlyPaid] = useState(true);
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setUserNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const userCalendarMeta = useMemo(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const offsetMin = -userNow.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const absH = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, "0");
    const absM = String(Math.abs(offsetMin) % 60).padStart(2, "0");
    const gmtLabel = `GMT${sign}${absH}:${absM}`;
    const formattedDate = new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(userNow);
    const formattedTime = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(userNow);
    return {
      tz,
      gmtLabel,
      formattedDate,
      formattedTime,
      currentYear: userNow.getFullYear(),
      currentMonth: userNow.getMonth(),
      currentDay: userNow.getDate(),
      todayIso: `${userNow.getFullYear()}-${String(userNow.getMonth() + 1).padStart(2, "0")}-${String(userNow.getDate()).padStart(2, "0")}`,
    };
  }, [userNow]);

  const MONTH_NAMES = useMemo(
    () => [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ],
    []
  );
  const MONTH_SHORT = useMemo(
    () => ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
    []
  );

  const syncToGlobalCalendar = useCallback(() => {
    const now = new Date();
    setUserNow(now);
    setSalesYear(now.getFullYear());
    setSalesMonth(now.getMonth());
    setSalesDay("all");
    setHoveredBarIdx(null);
  }, []);

  const stepPeriod = useCallback(
    (dir) => {
      setHoveredBarIdx(null);
      setSalesDay("all");
      if (salesViewMode === "tanggal") {
        let nextM = salesMonth + dir;
        let nextY = salesYear;
        if (nextM < 0) {
          nextM = 11;
          nextY -= 1;
        } else if (nextM > 11) {
          nextM = 0;
          nextY += 1;
        }
        setSalesMonth(nextM);
        setSalesYear(nextY);
      } else {
        setSalesYear((y) => y + dir);
      }
    },
    [salesViewMode, salesMonth, salesYear]
  );

  const orderStats = useMemo(() => {
    const waiting = orders.filter((o) => o.status === "waiting_approval").length;
    const paid = orders.filter((o) => o.payment_status === "paid");
    const revenue = paid.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
    return {
      total: orders.length,
      waiting,
      paidCount: paid.length,
      revenue,
    };
  }, [orders]);

  const salesChartData = useMemo(() => {
    const parsedOrders = orders
      .map((o) => {
        const d = o.created_at ? new Date(o.created_at) : null;
        if (!d || Number.isNaN(d.getTime())) return null;
        const isPaid = o.payment_status === "paid";
        const isFailed = o.payment_status === "failed";
        return {
          raw: o,
          date: d,
          year: d.getFullYear(),
          month: d.getMonth(),
          day: d.getDate(),
          amount: Number(o.amount) || 0,
          isPaid,
          isFailed,
        };
      })
      .filter(Boolean);

    const curY = userCalendarMeta.currentYear;
    const curM = userCalendarMeta.currentMonth;
    const curD = userCalendarMeta.currentDay;

    const yearSet = new Set([curY - 3, curY - 2, curY - 1, curY, curY + 1, salesYear]);
    parsedOrders.forEach((o) => yearSet.add(o.year));
    const availableYears = Array.from(yearSet).sort((a, b) => a - b);

    const daysInSelectedMonth = new Date(salesYear, salesMonth + 1, 0).getDate();
    const matchesMetric = (o) => (salesOnlyPaid ? o.isPaid : !o.isFailed);

    const todayOrders = parsedOrders.filter(
      (o) => o.year === curY && o.month === curM && o.day === curD && matchesMetric(o)
    );
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.amount, 0);

    const thisMonthOrders = parsedOrders.filter(
      (o) => o.year === curY && o.month === curM && matchesMetric(o)
    );
    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + o.amount, 0);

    let buckets = [];
    if (salesViewMode === "tanggal") {
      for (let d = 1; d <= daysInSelectedMonth; d++) {
        const dayOrders = parsedOrders.filter(
          (o) => o.year === salesYear && o.month === salesMonth && o.day === d
        );
        const activeOrders = dayOrders.filter(matchesMetric);
        const revenue = activeOrders.reduce((sum, o) => sum + o.amount, 0);
        const paidCount = dayOrders.filter((o) => o.isPaid).length;
        const isToday = salesYear === curY && salesMonth === curM && d === curD;
        buckets.push({
          key: `d-${d}`,
          shortLabel: String(d).padStart(2, "0"),
          fullLabel: `${d} ${MONTH_NAMES[salesMonth]} ${salesYear}${isToday ? " (Hari Ini)" : ""}`,
          day: d,
          month: salesMonth,
          year: salesYear,
          revenue,
          count: activeOrders.length,
          paidCount,
          totalOrders: dayOrders.length,
          isToday,
          isSelectedDay: salesDay !== "all" && Number(salesDay) === d,
        });
      }
    } else if (salesViewMode === "bulan") {
      for (let m = 0; m < 12; m++) {
        const monthOrders = parsedOrders.filter((o) => o.year === salesYear && o.month === m);
        const activeOrders = monthOrders.filter(matchesMetric);
        const revenue = activeOrders.reduce((sum, o) => sum + o.amount, 0);
        const paidCount = monthOrders.filter((o) => o.isPaid).length;
        const isCurrentMonth = salesYear === curY && m === curM;
        buckets.push({
          key: `m-${m}`,
          shortLabel: MONTH_SHORT[m],
          fullLabel: `${MONTH_NAMES[m]} ${salesYear}${isCurrentMonth ? " (Bulan Ini)" : ""}`,
          month: m,
          year: salesYear,
          revenue,
          count: activeOrders.length,
          paidCount,
          totalOrders: monthOrders.length,
          isToday: isCurrentMonth,
          isSelectedMonth: salesMonth === m,
        });
      }
    } else {
      availableYears.forEach((yr) => {
        const yearOrders = parsedOrders.filter((o) => o.year === yr);
        const activeOrders = yearOrders.filter(matchesMetric);
        const revenue = activeOrders.reduce((sum, o) => sum + o.amount, 0);
        const paidCount = yearOrders.filter((o) => o.isPaid).length;
        const isCurrentYear = yr === curY;
        buckets.push({
          key: `y-${yr}`,
          shortLabel: String(yr),
          fullLabel: `Tahun ${yr}${isCurrentYear ? " (Tahun Ini)" : ""}`,
          year: yr,
          revenue,
          count: activeOrders.length,
          paidCount,
          totalOrders: yearOrders.length,
          isToday: isCurrentYear,
          isSelectedYear: salesYear === yr,
        });
      });
    }

    const filteredBucketsForSummary =
      salesViewMode === "tanggal" && salesDay !== "all"
        ? buckets.filter((b) => b.day === Number(salesDay))
        : buckets;

    const periodRevenue = filteredBucketsForSummary.reduce((sum, b) => sum + b.revenue, 0);
    const periodCount = filteredBucketsForSummary.reduce((sum, b) => sum + b.count, 0);
    const periodTotalOrders = filteredBucketsForSummary.reduce((sum, b) => sum + b.totalOrders, 0);
    const maxRevenue = Math.max(...buckets.map((b) => b.revenue), 0);
    const peakBucket = buckets.reduce(
      (best, b) => (b.revenue > (best?.revenue || 0) ? b : best),
      null
    );

    const selectedDateIso =
      salesDay !== "all"
        ? `${salesYear}-${String(salesMonth + 1).padStart(2, "0")}-${String(salesDay).padStart(2, "0")}`
        : "";

    const isSyncedWithCurrentCalendar =
      salesYear === curY && salesMonth === curM && salesDay === "all";

    return {
      buckets,
      availableYears,
      daysInSelectedMonth,
      periodRevenue,
      periodCount,
      periodTotalOrders,
      avgOrderValue: periodCount > 0 ? Math.round(periodRevenue / periodCount) : 0,
      maxRevenue,
      peakBucket,
      selectedDateIso,
      todayRevenue,
      todayCount: todayOrders.length,
      thisMonthRevenue,
      thisMonthCount: thisMonthOrders.length,
      isSyncedWithCurrentCalendar,
    };
  }, [
    orders,
    userCalendarMeta,
    salesViewMode,
    salesYear,
    salesMonth,
    salesDay,
    salesOnlyPaid,
    MONTH_NAMES,
    MONTH_SHORT,
  ]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderFilter === "waiting" && o.status !== "waiting_approval") return false;
      if (orderFilter === "paid" && o.payment_status !== "paid") return false;
      if (
        orderFilter === "pending" &&
        (o.payment_status === "paid" ||
          o.payment_status === "failed" ||
          o.status === "waiting_approval")
      )
        return false;
      if (orderFilter === "failed" && o.payment_status !== "failed") return false;

      if (!q) return true;
      return (
        String(o.session_id || "").toLowerCase().includes(q) ||
        String(o.product_title || "").toLowerCase().includes(q) ||
        String(o.buyer_email || "").toLowerCase().includes(q) ||
        String(o.buyer_whatsapp || "").toLowerCase().includes(q)
      );
    });
  }, [orders, orderFilter, orderSearch]);

  const viewProof = async (o) => {
    if (o.payment_proof) return setProofUrl(o.payment_proof);
    try {
      const { data } = await api.get(`/admin/orders/${o.session_id}/proof`);
      setProofUrl(data.payment_proof);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal memuat bukti pembayaran");
    }
  };

  const orderStatusLabel = (o) => {
    if (o.payment_status === "paid") return "Lunas";
    if (o.payment_status === "failed")
      return o.status === "rejected"
        ? "Ditolak"
        : o.status === "expired"
          ? "Kedaluwarsa"
          : "Gagal";
    if (o.status === "waiting_approval") return "Perlu Verifikasi";
    return o.provider === "manual" ? "Belum Bayar" : "Menunggu QRIS";
  };

  const syncOrder = async (o) => {
    try {
      const { data } = await api.post(`/admin/orders/${o.session_id}/sync`);
      if (data.payment_status === "paid" && data.confirmed !== false) {
        toast.success(data.message || "Pembayaran terkonfirmasi LUNAS dari PayKita!");
      } else if (data.payment_status === "failed") {
        toast.error(data.message || "Transaksi QRIS kedaluwarsa atau gagal");
      } else {
        toast.info(
          data.message ||
            `Status PayKita: Masih Menunggu Pembayaran (${data.paykita_status || "waiting_payment"})`
        );
      }
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal cek status ke PayKita");
    }
  };

  const headers = {};

  const load = useCallback(async (showToast = false) => {
    setRefreshing(true);
    try {
      const [p, o, t, md, gw] = await Promise.all([
        api.get("/admin/products"),
        api.get("/admin/orders"),
        api.get("/testimonials"),
        api.get("/admin/payments/manual-destinations").catch(() => ({ data: [] })),
        api
          .get("/admin/payments/gateways")
          .catch(() => ({ data: { active_gateway: "paykita", gateways: {} } })),
      ]);
      setProducts(Array.isArray(p.data) ? p.data : []);
      setOrders(Array.isArray(o.data) ? o.data : []);
      setTestimonials(Array.isArray(t.data) ? t.data : []);
      setManualDestinations(Array.isArray(md.data) ? md.data : []);
      if (gw?.data) {
        setAutoGatewaysState({
          active_gateway: gw.data.active_gateway || "paykita",
          gateways: gw.data.gateways || {},
        });
      }
      if (showToast) toast.success("Data admin berhasil diperbarui");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal memuat data admin");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const doLogin = async () => {
    if (passwordOnly) {
      if (!loginPass) {
        toast.error("Password wajib diisi");
        return;
      }
      setChecking(true);
      try {
        await adminLogin(loginPass);
      } catch (e) {
        toast.error(formatApiError(e.response?.data?.detail) || "Login gagal");
      } finally {
        setChecking(false);
      }
      return;
    }
    if (!loginEmail || !loginPass) {
      toast.error("Email & password wajib diisi");
      return;
    }
    setChecking(true);
    try {
      const u = await login(loginEmail, loginPass);
      if (u.role !== "admin") toast.error("Akun ini bukan admin");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Login gagal");
    } finally {
      setChecking(false);
    }
  };

  const logout = () => authLogout();

  const openNew = () => {
    setForm({
      ...EMPTY_FORM,
      payment_config: { ...EMPTY_PAYMENT_CONFIG, disabled_destinations: [] },
    });
    setEditing("new");
  };

  const openEdit = (p) => {
    setForm({
      game: p.game,
      category: p.category,
      title: p.title,
      price: p.price,
      price_usd: p.price_usd ?? resolveUSD(p) ?? "",
      rank: p.rank || "",
      image: p.image || "",
      images: (p.images || []).slice(0, MAX_GALLERY_IMAGES),
      stock: p.stock,
      badges: p.badges?.length ? p.badges : p.badge ? [p.badge] : [],
      description: p.description || "",
      featured: !!p.featured,
      sold: p.sold || 0,
      rating: p.rating || 5,
      warranty: p.warranty || "100%",
      delivery_info: p.delivery_info || "",
      condition: p.condition || "",
      payment_config: normalizePaymentConfig(p.payment_config),
    });
    setEditing(p.id);
  };

  const quickToggleProductPayment = async (p, methodKey) => {
    const curCfg = normalizePaymentConfig(p.payment_config);
    const nextVal = !curCfg[methodKey];
    const nextCfg = { ...curCfg, [methodKey]: nextVal };
    if (!nextCfg.paykita && !nextCfg.manual && !nextCfg.crypto) {
      toast.error("Minimal 1 metode pembayaran harus tetap aktif untuk produk ini");
      return;
    }
    const labelMap = {
      paykita: "QRIS Otomatis (PayKita)",
      manual: "Transfer / QRIS Manual",
      crypto: "Crypto (USDT / Coin)",
    };
    const busyKey = `${p.id}:${methodKey}`;
    setTogglingPayKey(busyKey);
    setProducts((prev) =>
      prev.map((item) =>
        item.id === p.id ? { ...item, payment_config: nextCfg } : item
      )
    );
    try {
      const { data } = await api.patch(
        `/admin/products/${p.id}/payment-config`,
        nextCfg,
        { headers }
      );
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, ...data } : item))
      );
      toast.success(
        `${labelMap[methodKey] || methodKey} ${
          nextVal ? "diaktifkan" : "dinonaktifkan"
        } untuk "${p.title}"`
      );
    } catch (e) {
      setProducts((prev) =>
        prev.map((item) =>
          item.id === p.id ? { ...item, payment_config: curCfg } : item
        )
      );
      toast.error(
        formatApiError(e.response?.data?.detail) ||
          "Gagal mengubah pengaturan pembayaran produk"
      );
    } finally {
      setTogglingPayKey(null);
    }
  };

  const quickUpdateProductAutoGateway = async (p, patch, customSuccessMsg) => {
    const curCfg = normalizePaymentConfig(p.payment_config);
    const nextCfg = normalizePaymentConfig({ ...curCfg, ...patch });
    if (nextCfg.disabled_gateways.length >= AUTO_GATEWAYS.length && nextCfg.paykita) {
      toast.error("Minimal 1 payment gateway otomatis harus tetap aktif jika QRIS Otomatis diaktifkan");
      return;
    }
    const busyKey = `${p.id}:autogw`;
    setTogglingPayKey(busyKey);
    setProducts((prev) =>
      prev.map((item) =>
        item.id === p.id ? { ...item, payment_config: nextCfg } : item
      )
    );
    try {
      const { data } = await api.patch(
        `/admin/products/${p.id}/payment-config`,
        nextCfg,
        { headers }
      );
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, ...data } : item))
      );
      if (customSuccessMsg) toast.success(customSuccessMsg);
    } catch (e) {
      setProducts((prev) =>
        prev.map((item) =>
          item.id === p.id ? { ...item, payment_config: curCfg } : item
        )
      );
      toast.error(
        formatApiError(e.response?.data?.detail) ||
          "Gagal memperbarui gateway otomatis produk"
      );
    } finally {
      setTogglingPayKey(null);
    }
  };

  const save = async () => {
    if (!form.title || !form.game || !form.price) {
      toast.error("Judul, game, dan harga wajib diisi");
      return;
    }
    const payCfg = normalizePaymentConfig(form.payment_config);
    if (!payCfg.paykita && !payCfg.manual && !payCfg.crypto) {
      toast.error("Pilih minimal 1 metode pembayaran yang aktif untuk produk ini");
      return;
    }
    setSaving(true);
    try {
      const computedUsd =
        form.price_usd !== "" && form.price_usd != null && Number(form.price_usd) > 0
          ? Number(form.price_usd)
          : resolveUSD(null, form.price);
      const payload = {
        ...form,
        badge: form.badges[0] || "",
        price: Number(form.price),
        price_usd: computedUsd,
        images: (form.images || []).filter(Boolean).slice(0, MAX_GALLERY_IMAGES),
        stock: Number(form.stock),
        sold: Number(form.sold),
        rating: Number(form.rating),
        payment_config: payCfg,
      };
      if (editing === "new") {
        await api.post("/admin/products", payload, { headers });
        toast.success("Produk baru ditambahkan");
      } else {
        await api.put(`/admin/products/${editing}`, payload, { headers });
        toast.success("Produk diperbarui");
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menyimpan produk");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/admin/products/${id}`, { headers });
      toast.success("Produk dihapus");
      load();
    } catch {
      toast.error("Gagal menghapus produk");
    }
  };

  const uploadImage = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/admin/upload", fd, { headers });
      setForm((prev) => ({ ...prev, image: data.url }));
      toast.success("Gambar berhasil diupload");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mengupload gambar");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const uploadGallery = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const room = MAX_GALLERY_IMAGES - form.images.length;
    if (room <= 0) {
      toast.error(`Maksimal ${MAX_GALLERY_IMAGES} gambar tambahan`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const urls = [];
      for (const f of files.slice(0, room)) {
        const fd = new FormData();
        fd.append("file", f);
        const { data } = await api.post("/admin/upload", fd, { headers });
        urls.push(data.url);
      }
      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...urls].slice(0, MAX_GALLERY_IMAGES),
      }));
      toast.success(`${urls.length} gambar tambahan diupload`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mengupload gambar");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeGalleryImage = (idx) =>
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));

  const addBadge = (b) => {
    const v = (b || "").trim();
    if (!v) return;
    if (form.badges.includes(v)) {
      setBadgeInput("");
      return;
    }
    if (form.badges.length >= 3) {
      toast.error("Maksimal 3 badge");
      return;
    }
    setForm((prev) => ({ ...prev, badges: [...prev.badges, v] }));
    setBadgeInput("");
  };

  const removeBadge = (b) =>
    setForm((prev) => ({ ...prev, badges: prev.badges.filter((x) => x !== b) }));

  const resetSeed = async () => {
    try {
      await api.post("/admin/reset", {}, { headers });
      toast.success("Katalog direset ke data contoh");
      load();
    } catch {
      toast.error("Gagal mereset katalog");
    }
  };

  const navTabs = [
    {
      id: "produk",
      testId: "admin-tab-products",
      label: "Katalog & Produk",
      count: products.length,
      icon: Package,
    },
    {
      id: "pesanan",
      testId: "admin-tab-orders",
      label: "Pesanan",
      count: orders.length,
      badge: orderStats.waiting > 0 ? `${orderStats.waiting} Baru` : null,
      icon: Receipt,
    },
    {
      id: "integrasi",
      testId: "admin-tab-topup-integration",
      label: "Integrasi Top Up",
      icon: Plug,
    },
    {
      id: "pembayaran",
      testId: "admin-tab-payments",
      label: "Metode Pembayaran",
      icon: Wallet,
    },
    {
      id: "testimoni",
      testId: "admin-tab-testimonials",
      label: "Testimoni",
      count: testimonials.length,
      icon: MessageSquareQuote,
    },
    {
      id: "sosial",
      testId: "admin-tab-socials",
      label: "Sosial Media",
      icon: Share2,
    },
    {
      id: "users",
      testId: "admin-tab-users",
      label: "Manajemen User",
      icon: Users,
    },
    {
      id: "email_auth",
      testId: "admin-tab-email-auth",
      label: "Email & SMTP",
      icon: MailCheck,
    },
    {
      id: "audit",
      testId: "admin-tab-audit",
      label: "Audit Log",
      icon: ShieldAlert,
    },
  ];

  if (initializing) {
    return (
      <div
        className="min-h-screen bg-void grid-bg flex items-center justify-center"
        data-testid="admin-loading"
      >
        <Loader2 size={28} className="animate-spin text-neon" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div
        data-testid="admin-login-page"
        className="min-h-screen bg-void grid-bg flex items-center justify-center px-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-sm w-full rounded-2xl bg-panel/95 border border-line p-7 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
        >
          <span className="w-11 h-11 rounded-xl grid place-items-center bg-neon/10 border border-neon/40 text-neon mb-5">
            <ShieldCheck size={20} />
          </span>
          <h1
            className="font-display font-extrabold uppercase text-lg text-slate-100"
            data-testid="admin-login-title"
          >
            Panel Admin
          </h1>
          {user && user.role !== "admin" ? (
            <>
              <p
                className="text-xs text-coral font-mono mt-2 mb-6"
                data-testid="admin-not-authorized"
              >
                Akun &ldquo;{user.email}&rdquo; bukan admin. Silakan keluar dan masuk dengan akun
                admin.
              </p>
              <button
                onClick={logout}
                data-testid="admin-switch-account"
                className="w-full rounded-xl bg-neon text-void font-display font-bold text-xs uppercase tracking-wider py-3.5 hover:bg-lime transition-colors cursor-pointer"
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 font-mono mt-1.5 mb-5">
                {passwordOnly
                  ? "Masukkan password admin untuk melanjutkan."
                  : "Masuk dengan email & password administrator."}
              </p>
              {!passwordOnly && (
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email admin"
                  data-testid="admin-email-input"
                  className="w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-sm font-mono px-4 py-3 placeholder:text-slate-600 transition-colors"
                />
              )}
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLogin()}
                placeholder="Password"
                autoFocus={passwordOnly}
                data-testid="admin-password-input"
                className={`${passwordOnly ? "" : "mt-3 "}w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-sm font-mono px-4 py-3 placeholder:text-slate-600 transition-colors`}
              />
              <button
                onClick={doLogin}
                disabled={checking}
                data-testid="admin-login-button"
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon to-cyan-300 hover:from-lime hover:to-neon text-void font-display font-extrabold text-xs uppercase tracking-wider py-3.5 transition-all duration-200 disabled:opacity-50 cursor-pointer"
              >
                {checking && <Loader2 size={14} className="animate-spin" />}
                Masuk ke Dashboard
              </button>
            </>
          )}
          <Link
            to="/"
            data-testid="admin-back-home-link"
            className="mt-5 flex items-center justify-center gap-1.5 text-xs font-mono text-slate-400 hover:text-neon transition-colors"
          >
            <ArrowLeft size={13} /> Kembali ke beranda
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div data-testid="admin-dashboard" className="min-h-screen bg-void grid-bg text-slate-100">
      {/* Sticky Modern Admin Header */}
      <header className="border-b border-line bg-[#07080B]/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-neon to-cyan-300 text-void shadow-[0_0_16px_rgba(0,240,255,0.35)] shrink-0">
              <ShieldCheck size={17} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-sm sm:text-base uppercase tracking-tight text-slate-100 truncate">
                  Admin <span className="text-neon">WillJustPlay</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono text-lime">
                  &bull; Aktif
                </span>
              </div>
              {user?.email && (
                <p className="text-[10px] font-mono text-slate-400 truncate hidden sm:block">
                  {user.email}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              title="Muat ulang data"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel/80 hover:border-neon/60 text-slate-300 hover:text-neon text-xs font-mono px-3 py-2 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-neon" : ""} />
              <span className="hidden md:inline">Sinkronkan</span>
            </button>
            <Link
              to="/akun"
              data-testid="admin-view-store-button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel/80 hover:border-neon/60 text-slate-300 hover:text-neon text-xs font-mono px-3.5 py-2 transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Kembali ke Profil Akun</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 space-y-6">
        {/* Collapsible & Global-Calendar-Synced Sales Analytics (Tanggal, Bulan, Tahun) */}
        <div
          data-testid="admin-sales-chart-section"
          className="rounded-2xl border border-line bg-panel/85 overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.4)] transition-all"
        >
          {/* Compact Top Bar — Always Visible with Toggle Button & Live Global Calendar */}
          <div className="p-4 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-br from-neon/20 to-lime/20 border border-neon/40 text-neon shrink-0">
                <TrendingUp size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display font-extrabold text-sm sm:text-base text-slate-100 tracking-tight">
                    Ringkasan &amp; Grafik Penjualan
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-neon bg-void/80 border border-line px-2 py-0.5 rounded-lg"
                    title={`Zona waktu kalender perangkat: ${userCalendarMeta.tz} (${userCalendarMeta.gmtLabel})`}
                  >
                    <Globe size={11} className="text-lime shrink-0" />
                    <span>{userCalendarMeta.formattedDate}</span>
                    <span className="text-slate-500">&bull;</span>
                    <span className="text-lime">{userCalendarMeta.formattedTime}</span>
                    <span className="hidden sm:inline text-slate-400">
                      ({userCalendarMeta.tz})
                    </span>
                  </span>
                </div>

                {/* Quick Inline Summary Strip */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs font-mono">
                  <span className="text-slate-400">
                    Hari Ini:{" "}
                    <strong className="text-lime tabular-nums">
                      {formatIDR(salesChartData.todayRevenue)}
                    </strong>{" "}
                    <span className="text-slate-500">({salesChartData.todayCount} trx)</span>
                  </span>
                  <span className="text-slate-600 hidden sm:inline">&bull;</span>
                  <span className="text-slate-400">
                    Bulan Ini:{" "}
                    <strong className="text-neon tabular-nums">
                      {formatIDR(salesChartData.thisMonthRevenue)}
                    </strong>
                  </span>
                  <span className="text-slate-600 hidden sm:inline">&bull;</span>
                  <span className="text-slate-400">
                    Total Lunas:{" "}
                    <strong className="text-slate-200 tabular-nums">
                      {formatIDR(orderStats.revenue)}
                    </strong>{" "}
                    <span className="text-slate-500">({orderStats.paidCount})</span>
                  </span>
                  {orderStats.waiting > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab("pesanan")}
                      className="text-coral font-bold hover:underline cursor-pointer"
                    >
                      &bull; {orderStats.waiting} Perlu Verifikasi
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Button to Open / Close Sales Chart */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSalesChart((prev) => !prev)}
                data-testid="toggle-sales-chart-button"
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-display font-bold transition-all cursor-pointer ${
                  showSalesChart
                    ? "border-neon bg-neon text-void shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                    : "border-neon/50 bg-void/90 hover:bg-neon/10 text-neon"
                }`}
              >
                <BarChart3 size={15} />
                <span>{showSalesChart ? "Tutup Grafik Penjualan" : "Buka Grafik Penjualan"}</span>
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${
                    showSalesChart ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Expandable Dynamic Sales Chart Panel */}
          <AnimatePresence initial={false}>
            {showSalesChart && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-line/80 p-4 sm:p-5 space-y-4 bg-void/40">
                  {/* Streamlined Single-Row Toolbar: Mode + Calendar Navigation + Quick Date */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 rounded-xl border border-line bg-panel/90 p-3">
                    {/* Left: View Mode Switcher (Harian | Bulanan | Tahunan) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-xl border border-line bg-void p-1">
                        {[
                          { id: "tanggal", label: "Harian (Tanggal)" },
                          { id: "bulan", label: "Bulanan (Bulan)" },
                          { id: "tahun", label: "Tahunan (Tahun)" },
                        ].map((mode) => {
                          const active = salesViewMode === mode.id;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => {
                                setSalesViewMode(mode.id);
                                setHoveredBarIdx(null);
                              }}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-mono transition-all cursor-pointer ${
                                active
                                  ? "bg-neon text-void font-extrabold"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {mode.label}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSalesOnlyPaid((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-mono transition-colors cursor-pointer ${
                          salesOnlyPaid
                            ? "border-lime/50 bg-lime/10 text-lime"
                            : "border-neon/50 bg-neon/10 text-neon"
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        <span>{salesOnlyPaid ? "Hanya Lunas" : "Semua Pesanan"}</span>
                      </button>
                    </div>

                    {/* Right: Easy Period Navigation (Prev/Next, Bulan, Tahun, Kalender, Hari Ini) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Prev / Next Period Stepper */}
                      <div className="inline-flex items-center rounded-xl border border-line bg-void p-0.5">
                        <button
                          type="button"
                          onClick={() => stepPeriod(-1)}
                          title="Periode sebelumnya"
                          className="p-1.5 text-slate-400 hover:text-neon transition-colors cursor-pointer"
                        >
                          <ChevronLeft size={15} />
                        </button>

                        {salesViewMode !== "tahun" && (
                          <select
                            value={salesMonth}
                            onChange={(e) => {
                              setSalesMonth(Number(e.target.value));
                              setSalesDay("all");
                            }}
                            data-testid="sales-filter-month"
                            className="bg-transparent text-xs font-mono font-bold text-slate-100 px-2 py-1 outline-none cursor-pointer"
                          >
                            {MONTH_NAMES.map((name, idx) => (
                              <option key={name} value={idx} className="bg-panel text-slate-100">
                                {name}
                              </option>
                            ))}
                          </select>
                        )}

                        <select
                          value={salesYear}
                          onChange={(e) => {
                            setSalesYear(Number(e.target.value));
                            setSalesDay("all");
                          }}
                          data-testid="sales-filter-year"
                          className="bg-transparent text-xs font-mono font-bold text-neon px-2 py-1 outline-none cursor-pointer"
                        >
                          {salesChartData.availableYears.map((yr) => (
                            <option key={yr} value={yr} className="bg-panel text-slate-100">
                              {yr}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => stepPeriod(1)}
                          title="Periode berikutnya"
                          className="p-1.5 text-slate-400 hover:text-neon transition-colors cursor-pointer"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>

                      {/* Direct Date Picker Input */}
                      <div className="relative">
                        <Calendar
                          size={13}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neon pointer-events-none"
                        />
                        <input
                          type="date"
                          value={salesChartData.selectedDateIso}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              setSalesDay("all");
                              return;
                            }
                            const [yr, mo, dy] = val.split("-").map(Number);
                            if (yr && mo && dy) {
                              setSalesYear(yr);
                              setSalesMonth(mo - 1);
                              setSalesDay(String(dy));
                              setSalesViewMode("tanggal");
                            }
                          }}
                          data-testid="sales-filter-date-picker"
                          title="Pilih tanggal spesifik dari kalender"
                          className="rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono text-slate-100 pl-8 pr-2.5 py-1.5 transition-colors"
                        />
                      </div>

                      {/* Sync to Global User Calendar Button */}
                      <button
                        type="button"
                        onClick={syncToGlobalCalendar}
                        data-testid="sales-sync-today-button"
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer ${
                          salesChartData.isSyncedWithCurrentCalendar
                            ? "border-line bg-void/60 text-slate-400 hover:text-slate-200"
                            : "border-neon/60 bg-neon/10 text-neon font-bold"
                        }`}
                        title="Sinkronkan ke tanggal & bulan kalender pengguna saat ini"
                      >
                        <RotateCcw size={12} />
                        <span>Hari Ini</span>
                      </button>
                    </div>
                  </div>

                  {/* Compact 3-Card Period Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-line bg-panel/80 p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          Omzet Periode Dipilih
                        </p>
                        <p className="font-mono font-extrabold text-base sm:text-lg text-lime tabular-nums mt-0.5">
                          {formatIDR(salesChartData.periodRevenue)}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 tabular-nums">
                          &asymp; {formatUSD(null, salesChartData.periodRevenue)} USD
                        </p>
                      </div>
                      <span className="w-9 h-9 rounded-xl grid place-items-center bg-lime/10 border border-lime/30 text-lime shrink-0">
                        <Wallet size={15} />
                      </span>
                    </div>

                    <div className="rounded-xl border border-line bg-panel/80 p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          Transaksi Periode Ini
                        </p>
                        <p className="font-display font-extrabold text-base sm:text-lg text-slate-100 tabular-nums mt-0.5">
                          {salesChartData.periodCount} Transaksi{" "}
                          <span className="text-xs font-mono font-normal text-slate-400">
                            ({salesChartData.periodTotalOrders} masuk)
                          </span>
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 tabular-nums">
                          Rata-rata: {formatIDR(salesChartData.avgOrderValue)}
                        </p>
                      </div>
                      <span className="w-9 h-9 rounded-xl grid place-items-center bg-neon/10 border border-neon/30 text-neon shrink-0">
                        <Receipt size={15} />
                      </span>
                    </div>

                    <div className="rounded-xl border border-line bg-panel/80 p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          Penjualan Tertinggi
                        </p>
                        <p className="font-mono font-bold text-sm sm:text-base text-slate-100 truncate mt-0.5">
                          {salesChartData.peakBucket && salesChartData.peakBucket.revenue > 0
                            ? salesChartData.peakBucket.fullLabel
                            : "Belum ada transaksi"}
                        </p>
                        <p className="text-[11px] font-mono text-neon tabular-nums">
                          {salesChartData.peakBucket && salesChartData.peakBucket.revenue > 0
                            ? `${formatIDR(salesChartData.peakBucket.revenue)} (${salesChartData.peakBucket.count} trx)`
                            : "Rp 0"}
                        </p>
                      </div>
                      <span className="w-9 h-9 rounded-xl grid place-items-center bg-neon/10 border border-neon/30 text-neon shrink-0">
                        <BarChart3 size={15} />
                      </span>
                    </div>
                  </div>

                  {/* Clean Interactive Chart Box */}
                  <div className="rounded-xl border border-line bg-panel/90 p-4 space-y-3">
                    {/* Active Bar Info Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-line/60 text-xs font-mono">
                      {(() => {
                        const activeBucket =
                          hoveredBarIdx !== null && salesChartData.buckets[hoveredBarIdx]
                            ? salesChartData.buckets[hoveredBarIdx]
                            : salesViewMode === "tanggal" && salesDay !== "all"
                              ? salesChartData.buckets.find((b) => b.day === Number(salesDay))
                              : salesChartData.buckets.find((b) => b.isToday) ||
                                salesChartData.peakBucket;

                        if (!activeBucket) {
                          return (
                            <span className="text-slate-400">
                              Sentuh atau arahkan kursor pada batang grafik untuk melihat rincian.
                            </span>
                          );
                        }

                        return (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-neon" />
                              <span className="text-slate-200 font-bold">
                                {activeBucket.fullLabel}
                              </span>
                              <span className="text-slate-500">&mdash;</span>
                              <span className="text-lime font-extrabold tabular-nums">
                                {formatIDR(activeBucket.revenue)}
                              </span>
                              <span className="text-slate-400 tabular-nums">
                                ({formatUSD(null, activeBucket.revenue)} USD)
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-400 tabular-nums">
                              <span>
                                {activeBucket.paidCount} lunas / {activeBucket.totalOrders} pesanan
                              </span>
                              {salesDay !== "all" && (
                                <button
                                  type="button"
                                  onClick={() => setSalesDay("all")}
                                  className="text-neon hover:underline cursor-pointer"
                                >
                                  Tampilkan Semua Hari
                                </button>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Bars Area */}
                    <div className="relative pt-3 pb-1">
                      <div className="pointer-events-none absolute inset-x-0 top-3 bottom-6 flex flex-col justify-between">
                        {[1, 0.5, 0].map((ratio) => (
                          <div
                            key={ratio}
                            className="w-full border-b border-dashed border-line/40 flex items-center justify-end"
                          >
                            {salesChartData.maxRevenue > 0 && ratio > 0 && (
                              <span className="text-[9px] font-mono text-slate-600 -mt-3.5 pr-1 tabular-nums">
                                {formatIDR(Math.round(salesChartData.maxRevenue * ratio))}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div
                        className="relative z-10 grid items-end gap-1 sm:gap-1.5 h-44 sm:h-52 pt-2"
                        style={{
                          gridTemplateColumns: `repeat(${Math.max(
                            salesChartData.buckets.length,
                            1
                          )}, minmax(0, 1fr))`,
                        }}
                      >
                        {salesChartData.buckets.map((bucket, idx) => {
                          const heightPercent =
                            salesChartData.maxRevenue > 0
                              ? Math.max(
                                  bucket.revenue > 0 ? 12 : 4,
                                  Math.round((bucket.revenue / salesChartData.maxRevenue) * 100)
                                )
                              : bucket.totalOrders > 0
                                ? 20
                                : 4;

                          const isHighlighted =
                            hoveredBarIdx === idx ||
                            bucket.isSelectedDay ||
                            bucket.isToday ||
                            (salesViewMode === "bulan" && bucket.isSelectedMonth) ||
                            (salesViewMode === "tahun" && bucket.isSelectedYear);

                          return (
                            <button
                              key={bucket.key}
                              type="button"
                              onMouseEnter={() => setHoveredBarIdx(idx)}
                              onMouseLeave={() => setHoveredBarIdx(null)}
                              onClick={() => {
                                if (salesViewMode === "tanggal") {
                                  setSalesDay((prev) =>
                                    String(prev) === String(bucket.day)
                                      ? "all"
                                      : String(bucket.day)
                                  );
                                } else if (salesViewMode === "bulan") {
                                  setSalesMonth(bucket.month);
                                  setSalesDay("all");
                                  setSalesViewMode("tanggal");
                                } else if (salesViewMode === "tahun") {
                                  setSalesYear(bucket.year);
                                  setSalesDay("all");
                                  setSalesViewMode("bulan");
                                }
                              }}
                              title={`${bucket.fullLabel}: ${formatIDR(bucket.revenue)} (${bucket.count} transaksi)`}
                              className="group relative h-full flex flex-col justify-end items-center focus:outline-none cursor-pointer"
                            >
                              {hoveredBarIdx === idx && (
                                <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-md border border-neon/50 bg-[#07080B]/95 px-2 py-0.5 text-[10px] font-mono font-bold text-neon shadow-lg">
                                  {bucket.revenue > 0
                                    ? formatIDR(bucket.revenue)
                                    : `${bucket.totalOrders} pesanan`}
                                </div>
                              )}

                              <div className="w-full h-full flex items-end justify-center px-[1px]">
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: `${heightPercent}%` }}
                                  transition={{ duration: 0.3, ease: "easeOut" }}
                                  className={`w-full max-w-[32px] rounded-t-md transition-colors ${
                                    bucket.revenue > 0
                                      ? isHighlighted
                                        ? "bg-gradient-to-t from-neon via-cyan-300 to-lime shadow-[0_0_14px_rgba(0,240,255,0.4)]"
                                        : "bg-gradient-to-t from-neon/65 to-cyan-300/85 group-hover:from-neon group-hover:to-lime"
                                      : bucket.totalOrders > 0
                                        ? "bg-amber-400/50 group-hover:bg-amber-400/80"
                                        : bucket.isToday
                                          ? "bg-neon/45"
                                          : "bg-line/70 group-hover:bg-slate-600"
                                  }`}
                                />
                              </div>

                              <span
                                className={`mt-1.5 text-[9px] sm:text-[10px] font-mono tabular-nums truncate max-w-full ${
                                  bucket.isToday
                                    ? "text-lime font-extrabold underline decoration-lime/60"
                                    : isHighlighted
                                      ? "text-neon font-bold"
                                      : bucket.revenue > 0
                                        ? "text-slate-200 font-semibold"
                                        : "text-slate-500"
                                } ${
                                  salesViewMode === "tanggal" && idx % 2 === 1
                                    ? "hidden sm:inline"
                                    : ""
                                }`}
                              >
                                {bucket.shortLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Simple Legend */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/50 text-[11px] font-mono text-slate-400">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-tr from-neon to-lime" />
                          <span>Penjualan ({salesOnlyPaid ? "Lunas" : "Aktif"})</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/60" />
                          <span>Menunggu Pembayaran</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-lime" />
                          <span>Garis Bawah Hijau = Hari/Bulan/Tahun Kalender Saat Ini</span>
                        </span>
                      </div>
                      <span className="text-slate-500">
                        Klik batang grafik untuk memperbesar rincian periode
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clean Dynamic Navigation Bar */}
        <div className="rounded-2xl border border-line bg-panel/80 p-2 backdrop-blur-md">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap">
            {navTabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  data-testid={item.testId}
                  className={`relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-display font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? "text-void font-bold" : "text-slate-400 hover:text-slate-100 hover:bg-void/50"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="adminActiveTabPill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-xl bg-neon shadow-[0_0_16px_rgba(0,240,255,0.3)]"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Icon size={14} className="shrink-0" />
                    <span>{item.label}</span>
                    {typeof item.count === "number" && (
                      <span
                        className={`text-[10px] font-mono tabular-nums ${
                          active ? "text-void/80" : "text-slate-500"
                        }`}
                      >
                        ({item.count})
                      </span>
                    )}
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                          active ? "bg-void text-neon" : "bg-coral text-white"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {(tab === "pembayaran" || tab === "paykita") && (
              <div className="space-y-6">
                {/* Dynamic Payment Catalog Switcher Bar */}
                <div className="rounded-2xl border border-line bg-panel/90 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display font-extrabold text-base sm:text-lg text-slate-100 tracking-tight">
                      Manajemen Pembayaran Terpadu
                    </h2>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      Kelola katalog metode pembayaran manual (Bank, E-Wallet, QRIS, Crypto) dan pembayaran otomatis secara terpisah.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 bg-void/80 border border-line rounded-xl p-1.5">
                    {[
                      {
                        id: "manual",
                        testId: "admin-payment-scope-manual",
                        label: "Pembayaran Manual",
                        icon: Wallet,
                      },
                      {
                        id: "otomatis",
                        testId: "admin-tab-paykita",
                        label: "Pembayaran Otomatis",
                        icon: Webhook,
                      },
                    ].map((scope) => {
                      const ScopeIcon = scope.icon;
                      const active = paymentScope === scope.id;
                      return (
                        <button
                          key={scope.id}
                          type="button"
                          data-testid={scope.testId}
                          onClick={() => setPaymentScope(scope.id)}
                          className={`relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-display font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? "bg-neon text-void font-bold shadow-[0_0_14px_rgba(0,240,255,0.28)]"
                              : "text-slate-400 hover:text-slate-100"
                          }`}
                        >
                          <ScopeIcon size={14} className="shrink-0" />
                          <span>{scope.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={paymentScope}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                  >
                    {paymentScope === "manual" ? (
                      <AdminPayment defaultMode="fiat" />
                    ) : (
                      <AdminPaykita />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
            {tab === "sosial" && <AdminSocials />}
            {tab === "users" && <AdminUsers />}
            {tab === "email_auth" && <AdminEmailVerification />}
            {tab === "audit" && <AdminAuditLogs />}

            {tab === "integrasi" && (
              <AdminTopup headers={headers} sections={["vendors"]} defaultSection="vendors" onReload={() => load(false)} />
            )}

            {tab === "testimoni" && (
              <AdminTestimonials items={testimonials} headers={headers} reload={load} />
            )}

            {(tab === "produk" || tab === "topup") && (
              <div className="space-y-6">
                {/* Dynamic Catalog Switcher Bar */}
                <div className="rounded-2xl border border-line bg-panel/90 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display font-extrabold text-base sm:text-lg text-slate-100 tracking-tight">
                      Manajemen Katalog Terpadu
                    </h2>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      Kelola Katalog Produk Beranda dan Katalog Produk Top Up dalam satu halaman dengan katalog terpisah.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 bg-void/80 border border-line rounded-xl p-1.5">
                    {[
                      {
                        id: "beranda",
                        label: "Katalog Beranda",
                        count: berandaProducts.length,
                        icon: Package,
                      },
                      {
                        id: "topup",
                        testId: "admin-tab-topup",
                        label: "Katalog Top Up",
                        count: topupProducts.length,
                        icon: Gamepad2,
                      },
                    ].map((scope) => {
                      const ScopeIcon = scope.icon;
                      const active = catalogScope === scope.id;
                      return (
                        <button
                          key={scope.id}
                          type="button"
                          data-testid={scope.testId}
                          onClick={() => setCatalogScope(scope.id)}
                          className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-display font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? "bg-neon text-void font-bold shadow-[0_0_14px_rgba(0,240,255,0.28)]"
                              : "text-slate-400 hover:text-slate-100"
                          }`}
                        >
                          <ScopeIcon size={13} className="shrink-0" />
                          <span>{scope.label}</span>
                          <span
                            className={`text-[10px] font-mono tabular-nums ${
                              active ? "text-void/80" : "text-slate-500"
                            }`}
                          >
                            ({scope.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CATALOG 01: PRODUK BERANDA */}
                {catalogScope === "beranda" && (
                  <section className="rounded-2xl border border-line bg-panel/75 p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-line/70">
                      <div className="flex items-start sm:items-center gap-3">
                        <span className="w-9 h-9 rounded-xl grid place-items-center bg-neon/10 border border-neon/40 text-neon shrink-0">
                          <Package size={16} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-100">
                              Katalog Produk Beranda
                            </h3>
                            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                              &middot; {berandaProducts.length} produk ({berandaProducts.filter((p) => p.stock > 0).length} ready)
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Akun Game, Jasa Joki, Item / Skin, dan Voucher yang tampil di halaman utama toko.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={openNew}
                          data-testid="add-product-button"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-neon to-cyan-300 hover:from-lime hover:to-neon text-void text-xs font-display font-extrabold uppercase tracking-wider px-4 py-2.5 shadow-[0_0_18px_rgba(0,240,255,0.28)] transition-all cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Plus size={14} />
                          <span>Tambah Produk Beranda</span>
                        </button>
                      </div>
                    </div>

                    {/* Product Filter & Search Bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {["Semua", ...CATEGORIES].map((cat) => {
                          const count =
                            cat === "Semua"
                              ? berandaProducts.length
                              : berandaProducts.filter((p) => p.category === cat).length;
                          const active = productCatFilter === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setProductCatFilter(cat)}
                              className={`rounded-lg text-[11px] font-mono px-3 py-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                active
                                  ? "bg-neon text-void border-neon font-bold"
                                  : "border-line bg-void/60 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {cat} ({count})
                            </button>
                          );
                        })}
                      </div>

                      <div className="relative w-full md:w-72">
                        <Search
                          size={14}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Cari produk atau game beranda..."
                          className="w-full rounded-xl bg-void border border-line pl-9 pr-8 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-neon transition-colors"
                        />
                        {productSearch && (
                          <button
                            type="button"
                            onClick={() => setProductSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Beranda Products Table */}
                    <div
                      className="rounded-xl border border-line bg-void/40 overflow-hidden"
                      data-testid="admin-products-table"
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono min-w-[760px]">
                          <thead>
                            <tr className="border-b border-line bg-void/70 text-[10px] uppercase tracking-wider text-slate-400">
                              <th className="px-4 py-3.5">Produk Beranda</th>
                              <th className="px-4 py-3.5">Game &amp; Kategori</th>
                              <th className="px-4 py-3.5">Harga (IDR / USD)</th>
                              <th className="px-4 py-3.5">Stok &amp; Kondisi</th>
                              <th className="px-4 py-3.5">Pembayaran Digunakan (Klik Toggle)</th>
                              <th className="px-4 py-3.5 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/60">
                            {filteredBerandaProducts.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="px-4 py-14 text-center text-slate-500 font-mono text-xs"
                                >
                                  Tidak ada produk beranda yang sesuai filter.
                                </td>
                              </tr>
                            ) : (
                              filteredBerandaProducts.map((p) => {
                                const badges = p.badges?.length
                                  ? p.badges
                                  : p.badge
                                    ? [p.badge]
                                    : [];
                                const pCfg = normalizePaymentConfig(p.payment_config);
                                const disabledDestCount = pCfg.disabled_destinations.length;
                                return (
                                  <tr
                                    key={p.id}
                                    className="hover:bg-void/60 transition-colors"
                                    data-testid={`admin-row-${p.id}`}
                                  >
                                    <td className="px-4 py-3.5">
                                      <div className="flex items-center gap-3">
                                        <img
                                          src={imgSrc(p.image)}
                                          alt=""
                                          className="w-12 h-12 rounded-xl object-cover border border-line shrink-0 bg-void"
                                        />
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-display font-bold text-slate-100 max-w-[230px] truncate">
                                              {p.title}
                                            </span>
                                            {p.featured && (
                                              <Sparkles
                                                size={12}
                                                className="text-neon shrink-0"
                                                title="Produk Unggulan Hero"
                                              />
                                            )}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                            {p.rank && <span>{p.rank}</span>}
                                            {badges.length > 0 && (
                                              <span className="text-slate-400">
                                                &middot; {badges.slice(0, 2).join(", ")}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="text-neon font-semibold">{p.game}</div>
                                      <div className="text-[11px] text-slate-400">{p.category}</div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="text-neon font-bold tabular-nums">
                                        {formatIDR(p.price)}
                                      </div>
                                      <div className="text-[11px] text-lime font-mono tabular-nums">
                                        {formatUSD(p)} USD
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="flex items-center gap-2">
                                        {p.stock < 1 ? (
                                          <span className="text-coral font-bold">Habis (0)</span>
                                        ) : (
                                          <span className="text-slate-200 font-semibold tabular-nums">
                                            {p.stock} unit
                                          </span>
                                        )}
                                        {p.condition && (
                                          <span className="text-[10px] uppercase text-slate-400">
                                            &middot; {p.condition}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div
                                        className="space-y-2"
                                        data-testid={`row-payment-toggles-${p.id}`}
                                      >
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => quickToggleProductPayment(p, "paykita")}
                                            disabled={togglingPayKey === `${p.id}:paykita`}
                                            data-testid={`toggle-paykita-${p.id}`}
                                            title={
                                              pCfg.paykita
                                                ? "QRIS Otomatis PayKita Aktif (Klik untuk Nonaktifkan)"
                                                : "QRIS Otomatis PayKita Nonaktif (Klik untuk Aktifkan)"
                                            }
                                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                              pCfg.paykita
                                                ? "border-neon/60 bg-neon/15 text-neon"
                                                : "border-line bg-void/60 text-slate-500 line-through hover:text-slate-300"
                                            }`}
                                          >
                                            <QrCode size={11} />
                                            <span>QRIS (PayKita)</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => quickToggleProductPayment(p, "manual")}
                                            disabled={togglingPayKey === `${p.id}:manual`}
                                            data-testid={`toggle-manual-${p.id}`}
                                            title={
                                              pCfg.manual
                                                ? "Transfer / QRIS Manual Aktif (Klik untuk Nonaktifkan)"
                                                : "Transfer / QRIS Manual Nonaktif (Klik untuk Aktifkan)"
                                            }
                                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                              pCfg.manual
                                                ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300"
                                                : "border-line bg-void/60 text-slate-500 line-through hover:text-slate-300"
                                            }`}
                                          >
                                            <Wallet size={11} />
                                            <span>Transfer/QRIS</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => quickToggleProductPayment(p, "crypto")}
                                            disabled={togglingPayKey === `${p.id}:crypto`}
                                            data-testid={`toggle-crypto-${p.id}`}
                                            title={
                                              pCfg.crypto
                                                ? "Pembayaran Crypto Aktif (Klik untuk Nonaktifkan)"
                                                : "Pembayaran Crypto Nonaktif (Klik untuk Aktifkan)"
                                            }
                                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                              pCfg.crypto
                                                ? "border-lime/60 bg-lime/15 text-lime"
                                                : "border-line bg-void/60 text-slate-500 line-through hover:text-slate-300"
                                            }`}
                                          >
                                            <Coins size={11} />
                                            <span>Crypto</span>
                                          </button>

                                          {disabledDestCount > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => openEdit(p)}
                                              className="text-[9px] font-mono text-amber-300 hover:underline cursor-pointer"
                                              title="Beberapa rekening/wallet dinonaktifkan pada produk ini"
                                            >
                                              ({disabledDestCount} kanal off)
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => openEdit(p)}
                                          data-testid={`edit-product-${p.id}`}
                                          title="Edit produk & atur pembayaran"
                                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border border-line bg-void/70 text-slate-300 hover:text-neon hover:border-neon/60 transition-colors cursor-pointer"
                                        >
                                          <Pencil size={12} />
                                          <span className="text-[10px]">Edit</span>
                                        </button>
                                        <button
                                          onClick={() => remove(p.id)}
                                          data-testid={`delete-product-${p.id}`}
                                          title="Hapus produk"
                                          className="w-8 h-8 rounded-lg grid place-items-center border border-line bg-void/70 text-slate-400 hover:text-coral hover:border-coral/60 transition-colors cursor-pointer"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                )}

                {/* CATALOG 02: PRODUK TOP UP & GAME */}
                {catalogScope === "topup" && (
                  <section className="rounded-2xl border border-line bg-panel/75 p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-line/70">
                      <div className="flex items-start sm:items-center gap-3">
                        <span className="w-9 h-9 rounded-xl grid place-items-center bg-lime/10 border border-lime/40 text-lime shrink-0">
                          <Gamepad2 size={16} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-100">
                              Katalog Produk Top Up &amp; Game
                            </h3>
                            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                              &middot; {topupProducts.length} SKU aktif
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Daftar game Top Up Instan, nominal diamond/voucher, serta sinkronisasi otomatis dari merchant.
                          </p>
                        </div>
                      </div>
                    </div>

                    <AdminTopup
                      headers={headers}
                      sections={["games", "orders"]}
                      defaultSection="games"
                      onReload={() => load(false)}
                    />
                  </section>
                )}
              </div>
            )}

            {tab === "pesanan" && (
              <div className="space-y-4">
                {/* Orders Filter & Search Bar */}
                <div className="rounded-2xl border border-line bg-panel/80 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: "all", label: `Semua (${orders.length})` },
                      { id: "waiting", label: `Perlu Verifikasi (${orderStats.waiting})` },
                      { id: "paid", label: `Lunas (${orderStats.paidCount})` },
                      { id: "pending", label: "Menunggu Bayar" },
                      { id: "failed", label: "Gagal / Ditolak" },
                    ].map((f) => {
                      const active = orderFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setOrderFilter(f.id)}
                          className={`rounded-lg text-[11px] font-mono px-3 py-1.5 border transition-colors cursor-pointer ${
                            active
                              ? "bg-neon text-void border-neon font-bold"
                              : "border-line bg-void/60 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative w-full md:w-72">
                    <Search
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Cari ID sesi, produk, email/WA..."
                      className="w-full rounded-xl bg-void border border-line pl-9 pr-8 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-neon transition-colors"
                    />
                    {orderSearch && (
                      <button
                        type="button"
                        onClick={() => setOrderSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Orders Table */}
                <div
                  className="rounded-2xl border border-line bg-panel/90 overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.4)]"
                  data-testid="admin-orders-table"
                >
                  {filteredOrders.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 font-mono py-16">
                      Belum ada pesanan yang sesuai filter.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono min-w-[820px]">
                        <thead>
                          <tr className="border-b border-line bg-void/50 text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="px-4 py-3.5">Sesi &amp; Waktu</th>
                            <th className="px-4 py-3.5">Produk</th>
                            <th className="px-4 py-3.5">Pembeli</th>
                            <th className="px-4 py-3.5">Metode</th>
                            <th className="px-4 py-3.5">Jumlah</th>
                            <th className="px-4 py-3.5">Status</th>
                            <th className="px-4 py-3.5 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {filteredOrders.map((o) => (
                            <tr
                              key={o.session_id}
                              className="hover:bg-void/40 transition-colors"
                              data-testid={`order-row-${o.session_id.slice(-6)}`}
                            >
                              <td className="px-4 py-3.5">
                                <div className="text-slate-300 font-semibold">
                                  ...{o.session_id.slice(-10)}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                  <Clock size={10} />
                                  <span>{(o.created_at || "").slice(0, 16).replace("T", " ")}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-slate-100 font-display font-bold max-w-[230px] truncate">
                                {o.product_title}
                              </td>
                              <td
                                className="px-4 py-3.5 text-slate-300 text-[11px] max-w-[200px]"
                                data-testid={`order-buyer-${o.session_id.slice(-6)}`}
                              >
                                <div className="truncate text-neon font-semibold">
                                  {o.buyer_email || "-"}
                                </div>
                                <div className="truncate text-slate-400 text-[10px]">
                                  {o.buyer_whatsapp ? `WA: ${o.buyer_whatsapp}` : "Tanpa WA"}
                                </div>
                                {o.fulfillment_email_sent && (
                                  <div className="mt-1 inline-flex items-center gap-1 text-[9px] text-lime bg-lime/10 border border-lime/30 rounded px-1.5 py-0.5">
                                    <span>✓ Email Terkirim</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-slate-400 uppercase text-[10px]">
                                <div>
                                  {o.payment_type === "crypto" ? (
                                    <span className="text-lime font-bold">CRYPTO</span>
                                  ) : (
                                    o.provider || "manual"
                                  )}
                                  {o.destination_name ? ` · ${o.destination_name}` : ""}
                                  {o.crypto_network ? ` (${o.crypto_network})` : ""}
                                </div>
                                {o.tx_hash && (
                                  <div
                                    className="mt-1 text-[9px] text-lime normal-case truncate max-w-[180px]"
                                    title={o.tx_hash}
                                  >
                                    TXID: {o.tx_hash}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="text-neon font-bold tabular-nums">
                                  {formatIDR(o.amount)}
                                </div>
                                {(o.payment_type === "crypto" || o.amount_usd) && (
                                  <div className="text-[10px] text-lime font-mono tabular-nums">
                                    {formatUSD(o.amount_usd, o.amount)} USD
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  data-testid={`order-status-${o.session_id.slice(-6)}`}
                                  className={`inline-block rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                    o.payment_status === "paid"
                                      ? "bg-lime/15 text-lime"
                                      : o.payment_status === "failed"
                                        ? "bg-coral/15 text-coral"
                                        : o.status === "waiting_approval"
                                          ? "bg-coral/15 text-coral"
                                          : "bg-neon/10 text-neon"
                                  }`}
                                >
                                  {orderStatusLabel(o)}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                {o.provider === "paykita" && o.payment_status === "pending" && (
                                  <button
                                    type="button"
                                    onClick={() => syncOrder(o)}
                                    data-testid={`sync-order-${o.session_id.slice(-6)}`}
                                    className="rounded-lg text-[10px] text-neon border border-neon/40 hover:bg-neon/10 px-2.5 py-1.5 uppercase tracking-wider transition-colors cursor-pointer"
                                  >
                                    Cek Status
                                  </button>
                                )}
                                {o.provider === "manual" && (
                                  <div className="flex flex-col items-end gap-1.5">
                                    {o.payment_proof || (o.has_proof && !o.tx_hash) ? (
                                      <button
                                        type="button"
                                        onClick={() => viewProof(o)}
                                        data-testid={`view-proof-${o.session_id.slice(-6)}`}
                                        className="inline-flex items-center gap-1 rounded-lg text-[10px] text-neon border border-neon/40 hover:bg-neon/10 px-2.5 py-1 uppercase tracking-wider transition-colors cursor-pointer"
                                      >
                                        <Eye size={11} /> Lihat Bukti
                                      </button>
                                    ) : o.tx_hash ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          navigator.clipboard
                                            .writeText(o.tx_hash)
                                            .then(() => toast.success("TXID disalin"))
                                        }
                                        className="rounded-lg text-[10px] text-lime border border-lime/40 hover:bg-lime/10 px-2.5 py-1 uppercase tracking-wider transition-colors cursor-pointer"
                                      >
                                        Salin TXID
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">
                                        Menunggu Bukti
                                      </span>
                                    )}
                                    {o.status === "waiting_approval" && (
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={async () => {
                                            try {
                                              await api.post(
                                                `/admin/orders/${o.session_id}/approve`
                                              );
                                              toast.success(
                                                o.buyer_email
                                                  ? `Pembayaran diterima & akses/invoice dikirim ke ${o.buyer_email}!`
                                                  : "Pembayaran diterima!"
                                              );
                                              load();
                                            } catch (e) {
                                              toast.error(
                                                formatApiError(e.response?.data?.detail) ||
                                                  "Gagal menerima pembayaran"
                                              );
                                            }
                                          }}
                                          data-testid={`approve-order-${o.session_id.slice(-6)}`}
                                          className="rounded-md bg-lime text-void px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider hover:opacity-85 cursor-pointer"
                                        >
                                          Terima
                                        </button>
                                        <button
                                          onClick={async () => {
                                            try {
                                              await api.post(
                                                `/admin/orders/${o.session_id}/reject`
                                              );
                                              toast.success("Pembayaran ditolak");
                                              load();
                                            } catch (e) {
                                              toast.error(
                                                formatApiError(e.response?.data?.detail) ||
                                                  "Gagal menolak pembayaran"
                                              );
                                            }
                                          }}
                                          data-testid={`reject-order-${o.session_id.slice(-6)}`}
                                          className="rounded-md bg-coral text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider hover:opacity-85 cursor-pointer"
                                        >
                                          Tolak
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {o.payment_status === "paid" && o.buyer_email && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const { data } = await api.post(
                                          `/payments/resend-order-email/${o.session_id}`
                                        );
                                        toast.success(
                                          data?.message ||
                                            `Email berhasil dikirim ulang ke ${o.buyer_email}`
                                        );
                                        load(false);
                                      } catch (e) {
                                        toast.error(
                                          formatApiError(e.response?.data?.detail) ||
                                            "Gagal mengirim ulang email"
                                        );
                                      }
                                    }}
                                    data-testid={`resend-email-${o.session_id.slice(-6)}`}
                                    className="mt-1.5 inline-flex items-center gap-1 rounded-lg text-[10px] text-lime border border-lime/40 hover:bg-lime/10 px-2.5 py-1 uppercase tracking-wider transition-colors cursor-pointer"
                                  >
                                    Kirim Ulang Email
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Product Create / Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="product-form-modal"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl rounded-2xl bg-panel border border-line max-h-[90vh] overflow-y-auto shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
            data-lenis-prevent
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 backdrop-blur-md px-6 py-4">
              <h2
                className="font-display font-bold uppercase text-sm text-slate-100"
                data-testid="product-form-title"
              >
                {editing === "new" ? "Tambah Produk Baru" : "Edit Produk"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                data-testid="product-form-close"
                className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:text-coral hover:bg-void transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Judul Produk *
                </span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  data-testid="form-title-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Nama Game *
                </span>
                <input
                  value={form.game}
                  onChange={(e) => setForm({ ...form, game: e.target.value })}
                  placeholder="mis. Mobile Legends"
                  data-testid="form-game-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 placeholder:text-slate-600 transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Kategori
                </span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  data-testid="form-category-select"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 transition-colors"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Harga (IDR) *
                </span>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  data-testid="form-price-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 transition-colors"
                />
              </label>
              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-lime">
                    Harga (USD)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, price_usd: resolveUSD(null, prev.price) }))
                    }
                    className="text-[9px] font-mono uppercase tracking-wider text-neon hover:underline cursor-pointer"
                  >
                    Auto Konversi
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price_usd}
                  onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                  placeholder={form.price ? `mis. ${resolveUSD(null, form.price)}` : "mis. 25.00"}
                  data-testid="form-price-usd-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-lime outline-none text-xs font-mono px-3.5 py-2.5 text-lime placeholder:text-slate-600 transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Rank / Tier
                </span>
                <input
                  value={form.rank}
                  onChange={(e) => setForm({ ...form, rank: e.target.value })}
                  placeholder="mis. Mythic Glory"
                  data-testid="form-rank-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 placeholder:text-slate-600 transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Stok
                </span>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  data-testid="form-stock-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Garansi
                </span>
                <input
                  value={form.warranty}
                  onChange={(e) => setForm({ ...form, warranty: e.target.value })}
                  placeholder="mis. 100% / 30 Hari"
                  data-testid="form-warranty-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 placeholder:text-slate-600 transition-colors"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Kondisi Akun
                </span>
                <input
                  list="condition-presets"
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  placeholder="ready / unready / sold / custom"
                  data-testid="form-condition-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 placeholder:text-slate-600 transition-colors"
                />
                <datalist id="condition-presets">
                  {CONDITION_PRESETS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Gambar Produk Utama
                </span>
                <div className="mt-1.5 flex items-start gap-3">
                  {form.image && (
                    <img
                      src={imgSrc(form.image)}
                      alt="preview"
                      data-testid="form-image-preview"
                      className="w-20 h-20 rounded-xl object-cover border border-line shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <label
                      data-testid="form-image-upload-label"
                      className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-line hover:border-neon/60 text-slate-400 hover:text-neon text-[11px] font-bold uppercase tracking-wider py-3 cursor-pointer transition-colors ${
                        uploading ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {uploading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      {uploading ? "Mengupload..." : "Upload dari Komputer"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={uploadImage}
                        data-testid="form-image-file-input"
                        className="hidden"
                      />
                    </label>
                    <input
                      value={form.image}
                      onChange={(e) => setForm({ ...form, image: e.target.value })}
                      placeholder="atau tempel URL gambar https://..."
                      data-testid="form-image-input"
                      className="w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 placeholder:text-slate-600 transition-colors"
                    />
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Gambar Tambahan ({form.images.length}/{MAX_GALLERY_IMAGES})
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2" data-testid="form-gallery-list">
                  {form.images.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-16 rounded-xl border border-line group overflow-hidden"
                      data-testid={`form-gallery-item-${i}`}
                    >
                      <img src={imgSrc(url)} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(i)}
                        data-testid={`form-gallery-remove-${i}`}
                        className="absolute top-1 right-1 w-5 h-5 rounded-md grid place-items-center bg-coral text-white cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {form.images.length < MAX_GALLERY_IMAGES && (
                    <label
                      data-testid="form-gallery-upload-label"
                      className={`w-16 h-16 rounded-xl grid place-items-center border border-dashed border-line hover:border-neon/60 text-slate-500 hover:text-neon cursor-pointer transition-colors ${
                        uploading ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {uploading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={uploadGallery}
                        data-testid="form-gallery-file-input"
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Badge ({form.badges.length}/3) — maks 3
                </span>
                {form.badges.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-2" data-testid="form-badges-list">
                    {form.badges.map((b) => (
                      <span
                        key={b}
                        data-testid={`form-badge-chip-${b}`}
                        className="flex items-center gap-1.5 rounded-lg bg-neon/10 border border-neon/40 text-neon text-[10px] font-bold uppercase tracking-wider px-2.5 py-1"
                      >
                        {b}
                        <button
                          type="button"
                          onClick={() => removeBadge(b)}
                          data-testid={`form-badge-remove-${b}`}
                          className="text-neon/70 hover:text-coral transition-colors cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {BADGE_PRESETS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => addBadge(b)}
                      data-testid={`form-badge-preset-${b}`}
                      disabled={form.badges.includes(b) || form.badges.length >= 3}
                      className="rounded-lg text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 border border-line text-slate-400 hover:text-neon hover:border-neon/50 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      + {b}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={badgeInput}
                    onChange={(e) => setBadgeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBadge(badgeInput);
                      }
                    }}
                    placeholder="Badge custom..."
                    data-testid="form-badge-custom-input"
                    className="flex-1 rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 placeholder:text-slate-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => addBadge(badgeInput)}
                    data-testid="form-badge-add-button"
                    disabled={form.badges.length >= 3}
                    className="rounded-xl px-4 border border-neon/50 text-neon text-[11px] font-bold uppercase tracking-wider hover:bg-neon hover:text-void transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    Tambah
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2.5 sm:col-span-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  data-testid="form-featured-checkbox"
                  className="w-4 h-4 accent-[#00F0FF]"
                />
                <span className="text-xs font-mono text-slate-300">
                  Tampilkan sebagai Produk Unggulan di Hero Beranda
                </span>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Deskripsi Produk
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  data-testid="form-description-input"
                  className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 leading-relaxed transition-colors"
                />
              </label>
              <div className="sm:col-span-2 rounded-2xl border border-neon/35 bg-void/70 p-4 space-y-3.5">
                {(() => {
                  const parsedCred = parseAdminDeliveryBracket(form.delivery_info);
                  const updateCredField = (patch) => {
                    const nextType =
                      patch.accountType !== undefined ? patch.accountType : parsedCred.accountType;
                    const nextEmail =
                      patch.accountEmail !== undefined
                        ? patch.accountEmail
                        : parsedCred.accountEmail;
                    const nextPass =
                      patch.accountPassword !== undefined
                        ? patch.accountPassword
                        : parsedCred.accountPassword;
                    const nextNotes =
                      patch.extraNotes !== undefined ? patch.extraNotes : parsedCred.extraNotes;
                    setForm({
                      ...form,
                      delivery_info: buildAdminDeliveryBracket(
                        nextType,
                        nextEmail,
                        nextPass,
                        nextNotes
                      ),
                    });
                  };

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neon block">
                            Format Pengiriman Data Akses Akun (Otomatis ke Email Pembeli &amp; Halaman Lunas)
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Format standar: <strong className="text-lime">[Tipe Akun] [Email] [Password]</strong> — isi kolom terstruktur di bawah atau tempel teks langsung.
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-lime/10 border border-lime/30 text-lime">
                          Auto-Email Aktif
                        </span>
                      </div>

                      {/* Quick Preset Pills for Account Type */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 mr-1">
                          Preset Tipe:
                        </span>
                        {ACCOUNT_TYPE_PRESETS.map((preset) => {
                          const isSelected =
                            parsedCred.accountType.toLowerCase() === preset.toLowerCase();
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => updateCredField({ accountType: preset })}
                              className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                                isSelected
                                  ? "border-neon bg-neon text-void font-bold"
                                  : "border-line bg-panel text-slate-300 hover:border-neon/50 hover:text-neon"
                              }`}
                            >
                              {preset}
                            </button>
                          );
                        })}
                      </div>

                      {/* 3-Column Structured Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <label className="block">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
                            1. Tipe Akun (Gmail, Moonton, dll)
                          </span>
                          <input
                            type="text"
                            value={parsedCred.accountType}
                            onChange={(e) => updateCredField({ accountType: e.target.value })}
                            placeholder="Gmail / Moonton / Hoyoverse"
                            data-testid="form-delivery-type-input"
                            className="mt-1 w-full rounded-xl bg-panel border border-line focus:border-neon outline-none text-xs font-mono px-3 py-2 text-slate-100 placeholder:text-slate-600 transition-colors"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
                            2. Email / Username Akun
                          </span>
                          <input
                            type="text"
                            value={parsedCred.accountEmail}
                            onChange={(e) => updateCredField({ accountEmail: e.target.value })}
                            placeholder="akun.game@gmail.com"
                            data-testid="form-delivery-email-input"
                            className="mt-1 w-full rounded-xl bg-panel border border-line focus:border-neon outline-none text-xs font-mono px-3 py-2 text-neon placeholder:text-slate-600 transition-colors"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
                            3. Password Akun
                          </span>
                          <input
                            type="text"
                            value={parsedCred.accountPassword}
                            onChange={(e) => updateCredField({ accountPassword: e.target.value })}
                            placeholder="PasswordAkun#123"
                            data-testid="form-delivery-password-input"
                            className="mt-1 w-full rounded-xl bg-panel border border-line focus:border-neon outline-none text-xs font-mono px-3 py-2 text-lime placeholder:text-slate-600 transition-colors"
                          />
                        </label>
                      </div>

                      {/* Raw / Direct Paste Textarea ([Tipe Akun] [Email] [Password]) */}
                      <label className="block">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            Teks Lengkap Pengiriman ([Tipe Akun] [Email] [Password] + Catatan Opsional)
                          </span>
                          <span className="text-[10px] font-mono text-neon">
                            Mendukung tempel (paste) langsung
                          </span>
                        </div>
                        <textarea
                          value={form.delivery_info}
                          onChange={(e) => setForm({ ...form, delivery_info: e.target.value })}
                          rows={3}
                          placeholder="[Gmail] [contoh@gmail.com] [Password#123]&#10;Catatan tambahan (opsional)..."
                          data-testid="form-delivery-input"
                          className="mt-1.5 w-full rounded-xl bg-panel border border-neon/30 focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 leading-relaxed placeholder:text-slate-600 transition-colors"
                        />
                      </label>
                    </>
                  );
                })()}
              </div>
              {/* Per-Product Payment Methods & Channels Configuration */}
              {(() => {
                const payCfg = normalizePaymentConfig(form.payment_config);
                const activeManualDests = manualDestinations.filter(
                  (d) => d.is_active !== false
                );
                const fiatDests = activeManualDests.filter((d) => d.type !== "crypto");
                const cryptoDests = activeManualDests.filter((d) => d.type === "crypto");

                const setPayField = (patch) => {
                  const next = normalizePaymentConfig({ ...payCfg, ...patch });
                  setForm((prev) => ({ ...prev, payment_config: next }));
                };

                const toggleDestChannel = (destId) => {
                  const exists = payCfg.disabled_destinations.includes(destId);
                  const nextDisabled = exists
                    ? payCfg.disabled_destinations.filter((id) => id !== destId)
                    : [...payCfg.disabled_destinations, destId];
                  setPayField({ disabled_destinations: nextDisabled });
                };

                const toggleAutoGateway = (gwId) => {
                  const exists = payCfg.disabled_gateways.includes(gwId);
                  if (!exists && payCfg.disabled_gateways.length >= AUTO_GATEWAYS.length - 1) {
                    toast.error("Minimal 1 provider gateway otomatis harus tetap aktif");
                    return;
                  }
                  const nextDisabled = exists
                    ? payCfg.disabled_gateways.filter((id) => id !== gwId)
                    : [...payCfg.disabled_gateways, gwId];
                  const nextPreferred =
                    !exists && payCfg.preferred_gateway === gwId
                      ? "auto"
                      : payCfg.preferred_gateway;
                  setPayField({
                    disabled_gateways: nextDisabled,
                    preferred_gateway: nextPreferred,
                  });
                };

                return (
                  <div
                    className="sm:col-span-2 rounded-2xl border border-line bg-void/60 p-4 space-y-4"
                    data-testid="product-payment-config-section"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line/70">
                      <div>
                        <span className="flex items-center gap-2 text-[11px] font-display font-extrabold uppercase tracking-wider text-slate-100">
                          <Wallet size={14} className="text-neon" />
                          Metode Pembayaran Produk Beranda Ini
                        </span>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Aktifkan QRIS Otomatis (PayKita — khusus Produk Beranda) maupun rekening/wallet manual untuk produk ini.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPayField({
                            paykita: true,
                            manual: true,
                            crypto: true,
                            preferred_gateway: "paykita",
                            disabled_gateways: [],
                            disabled_destinations: [],
                          })
                        }
                        data-testid="form-payment-enable-all"
                        className="rounded-lg border border-neon/40 bg-neon/10 hover:bg-neon hover:text-void text-neon px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Aktifkan Semua
                      </button>
                    </div>

                    {/* 3 Main Payment Method Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* 1. QRIS Otomatis (PayKita — Produk Beranda) */}
                      <button
                        type="button"
                        onClick={() => setPayField({ paykita: !payCfg.paykita })}
                        data-testid="form-toggle-paykita"
                        className={`flex flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          payCfg.paykita
                            ? "border-neon/60 bg-neon/10 text-slate-100"
                            : "border-line bg-panel/60 text-slate-500 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-1.5 text-xs font-display font-bold">
                            <QrCode
                              size={14}
                              className={payCfg.paykita ? "text-neon" : "text-slate-500"}
                            />
                            QRIS Otomatis (PayKita)
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[9px] font-mono font-bold uppercase ${
                              payCfg.paykita
                                ? "bg-neon text-void"
                                : "bg-void border border-line text-slate-500"
                            }`}
                          >
                            {payCfg.paykita ? "AKTIF" : "NONAKTIF"}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono leading-relaxed text-slate-400">
                          Gateway PayKita QRIS khusus Produk Beranda.
                        </p>
                      </button>

                      {/* 2. Transfer Bank / QRIS Manual */}
                      <button
                        type="button"
                        onClick={() => setPayField({ manual: !payCfg.manual })}
                        data-testid="form-toggle-manual"
                        className={`flex flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          payCfg.manual
                            ? "border-cyan-400/60 bg-cyan-400/10 text-slate-100"
                            : "border-line bg-panel/60 text-slate-500 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-1.5 text-xs font-display font-bold">
                            <Wallet
                              size={14}
                              className={payCfg.manual ? "text-cyan-300" : "text-slate-500"}
                            />
                            Transfer / QRIS
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[9px] font-mono font-bold uppercase ${
                              payCfg.manual
                                ? "bg-cyan-300 text-void"
                                : "bg-void border border-line text-slate-500"
                            }`}
                          >
                            {payCfg.manual ? "AKTIF" : "NONAKTIF"}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono leading-relaxed text-slate-400">
                          Transfer Bank, E-Wallet &amp; QRIS Manual (IDR).
                        </p>
                      </button>

                      {/* 3. Crypto (USDT / Coin) */}
                      <button
                        type="button"
                        onClick={() => setPayField({ crypto: !payCfg.crypto })}
                        data-testid="form-toggle-crypto"
                        className={`flex flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          payCfg.crypto
                            ? "border-lime/60 bg-lime/10 text-slate-100"
                            : "border-line bg-panel/60 text-slate-500 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-1.5 text-xs font-display font-bold">
                            <Coins
                              size={14}
                              className={payCfg.crypto ? "text-lime" : "text-slate-500"}
                            />
                            Crypto (USD)
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[9px] font-mono font-bold uppercase ${
                              payCfg.crypto
                                ? "bg-lime text-void"
                                : "bg-void border border-line text-slate-500"
                            }`}
                          >
                            {payCfg.crypto ? "AKTIF" : "NONAKTIF"}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono leading-relaxed text-slate-400">
                          Pembayaran Web3 USDT, Solana, Bitcoin, dll.
                        </p>
                      </button>
                    </div>

                    {/* Specific Fiat Channels Selector when Manual is Enabled */}
                    {payCfg.manual && fiatDests.length > 0 && (
                      <div className="rounded-xl border border-line/80 bg-panel/50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
                            Pilih Kanal Transfer / QRIS Manual yang Diaktifkan:
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {
                              fiatDests.filter(
                                (d) => !payCfg.disabled_destinations.includes(d.id)
                              ).length
                            }
                            /{fiatDests.length} aktif
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {fiatDests.map((d) => {
                            const enabled = !payCfg.disabled_destinations.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => toggleDestChannel(d.id)}
                                data-testid={`form-dest-toggle-${d.id}`}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                  enabled
                                    ? "border-cyan-400/50 bg-cyan-400/15 text-slate-100"
                                    : "border-line bg-void/60 text-slate-500 line-through hover:text-slate-300"
                                }`}
                              >
                                <CheckCircle2
                                  size={11}
                                  className={enabled ? "text-cyan-300" : "text-slate-600"}
                                />
                                <span>{d.name}</span>
                                <span className="text-[9px] uppercase text-slate-400">
                                  ({d.type})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Specific Crypto Wallet Channels Selector when Crypto is Enabled */}
                    {payCfg.crypto && cryptoDests.length > 0 && (
                      <div className="rounded-xl border border-line/80 bg-panel/50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-lime">
                            Pilih Wallet Crypto yang Diaktifkan:
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {
                              cryptoDests.filter(
                                (d) => !payCfg.disabled_destinations.includes(d.id)
                              ).length
                            }
                            /{cryptoDests.length} aktif
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cryptoDests.map((d) => {
                            const enabled = !payCfg.disabled_destinations.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => toggleDestChannel(d.id)}
                                data-testid={`form-dest-toggle-${d.id}`}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                  enabled
                                    ? "border-lime/50 bg-lime/15 text-slate-100"
                                    : "border-line bg-void/60 text-slate-500 line-through hover:text-slate-300"
                                }`}
                              >
                                <CheckCircle2
                                  size={11}
                                  className={enabled ? "text-lime" : "text-slate-600"}
                                />
                                <span>{d.name}</span>
                                {d.network && (
                                  <span className="text-[9px] text-slate-400">
                                    ({d.network})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="sticky bottom-0 border-t border-line bg-panel/95 backdrop-blur-md px-6 py-4 flex justify-end gap-2.5">
              <button
                onClick={() => setEditing(null)}
                data-testid="form-cancel-button"
                className="rounded-xl text-xs font-bold uppercase tracking-wider px-5 py-2.5 border border-line text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={save}
                disabled={saving}
                data-testid="save-product-button"
                className="flex items-center gap-2 rounded-xl text-xs font-display font-extrabold uppercase tracking-wider px-5 py-2.5 bg-gradient-to-r from-neon to-cyan-300 hover:from-lime hover:to-neon text-void transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                Simpan Produk
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Payment Proof Modal */}
      {proofUrl && (
        <div
          className="fixed inset-0 z-[60] bg-void/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setProofUrl(null)}
          data-testid="proof-modal"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-panel border border-line max-h-[90vh] overflow-y-auto shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h3 className="font-display font-bold uppercase text-xs text-slate-100">
                Bukti Pembayaran
              </h3>
              <button
                onClick={() => setProofUrl(null)}
                data-testid="proof-modal-close"
                className="w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:text-coral transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <img
                src={proofUrl}
                alt="Bukti pembayaran"
                data-testid="proof-modal-image"
                className="w-full h-auto rounded-xl object-contain border border-line bg-void"
              />
              <a
                href={proofUrl}
                download="bukti-pembayaran"
                data-testid="proof-modal-download"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-neon/50 text-neon text-xs font-bold uppercase tracking-wider py-2.5 hover:bg-neon/10 transition-colors"
              >
                Unduh Bukti
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

