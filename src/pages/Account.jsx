import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  ShieldCheck,
  LogOut,
  Loader2,
  Package,
  Heart,
  ArrowRight,
  KeyRound,
  Star,
  RefreshCw,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  ShoppingBag,
  Clock,
  Wallet,
  Sparkles,
  Lock,
  Edit3,
  Eye,
  EyeOff,
  Activity,
  Gamepad2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  ShieldAlert,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ReviewModal } from "@/components/ReviewModal";
import { useAuth } from "@/context/AuthContext";
import { api, formatIDR, formatUSD, imgSrc } from "@/lib/api";
import { toast } from "sonner";

const linkify = (text) =>
  String(text || "")
    .split(/(\s+)/)
    .map((part, i) =>
      /^https?:\/\//i.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-neon underline break-all hover:text-lime transition-colors"
        >
          {part}
        </a>
      ) : (
        part
      )
    );

const statusStyle = (o) => {
  const s = o.payment_status;
  if (s === "paid") return "text-lime border-lime/40 bg-lime/10";
  if (s === "failed" || s === "cancelled") return "text-coral border-coral/40 bg-coral/10";
  return "text-neon border-neon/40 bg-neon/10";
};

const statusAccentBar = (o) => {
  const s = o.payment_status;
  if (s === "paid") return "bg-lime";
  if (s === "failed" || s === "cancelled") return "bg-coral";
  return "bg-neon";
};

const statusLabel = (o) => {
  const s = o.payment_status;
  if (s === "paid") return "Lunas";
  if (s === "failed") return o.status === "rejected" ? "Ditolak" : "Gagal";
  if (s === "cancelled") return "Dibatalkan";
  if (o.status === "waiting_approval") return "Menunggu Verifikasi";
  return o.provider === "manual" ? "Belum Dibayar" : "Menunggu";
};

const fmtDate = (v) => {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(v);
  }
};

const fmtShortDate = (v) => {
  if (!v) return "Baru bergabung";
  try {
    return new Date(v).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
};

const getMemberTier = (paidCount, totalSpent) => {
  if (paidCount >= 6 || totalSpent >= 1500000) {
    return {
      name: "CYBER LEGEND",
      badgeClass: "text-lime border-lime/50 bg-lime/10",
      accentClass: "from-lime via-neon to-lime",
      nextTier: null,
      progress: 100,
      hint: "Level tertinggi tercapai — Terima kasih telah menjadi pelanggan setia!",
    };
  }
  if (paidCount >= 3 || totalSpent >= 500000) {
    const progress = Math.min(95, Math.round((paidCount / 6) * 100));
    return {
      name: "ELITE SQUAD",
      badgeClass: "text-neon border-neon/50 bg-neon/10",
      accentClass: "from-neon to-lime",
      nextTier: "CYBER LEGEND",
      progress,
      hint: `${Math.max(1, 6 - paidCount)} transaksi lunas lagi menuju level CYBER LEGEND`,
    };
  }
  if (paidCount >= 1) {
    const progress = Math.min(90, Math.round((paidCount / 3) * 100));
    return {
      name: "PRO PLAYER",
      badgeClass: "text-neon border-neon/40 bg-neon/10",
      accentClass: "from-neon/80 to-neon",
      nextTier: "ELITE SQUAD",
      progress,
      hint: `${Math.max(1, 3 - paidCount)} transaksi lunas lagi menuju level ELITE SQUAD`,
    };
  }
  return {
    name: "ROOKIE GAMER",
    badgeClass: "text-slate-300 border-line bg-void/70",
    accentClass: "from-slate-500 to-neon",
    nextTier: "PRO PLAYER",
    progress: 12,
    hint: "Selesaikan 1 transaksi pertama untuk naik ke level PRO PLAYER",
  };
};

const getOrderProgressStep = (o) => {
  if (o.payment_status === "paid") return 4;
  if (o.payment_status === "failed" || o.payment_status === "cancelled") return -1;
  if (o.status === "waiting_approval") return 3;
  return 2;
};

const formatAuditAction = (action) => {
  const map = {
    "auth.login": "Login Berhasil",
    "admin.login": "Login Admin",
    "auth.logout": "Logout Akun",
    "auth.register": "Pendaftaran Akun",
    "auth.register_auto_verified": "Pendaftaran & Aktivasi Instan",
    "auth.email_verified": "Email Diverifikasi",
    "auth.password_reset_requested": "Permintaan Reset Password",
    "auth.password_reset_completed": "Reset Password Selesai",
    "account.profile_updated": "Nama Profil Diperbarui",
    "account.password_changed": "Password Diubah",
    "sessions.revoked": "Semua Sesi Dihentikan",
  };
  return map[action] || action;
};

export default function Account() {
  const { user, initializing, openAuth, logout, toggleWishlist, updateProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [securityData, setSecurityData] = useState({
    active_sessions_count: 1,
    sessions: [],
    audit_logs: [],
    password_changed_at: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewed, setReviewed] = useState({});
  const [reviewTarget, setReviewTarget] = useState(null);

  // Dynamic UI states
  const [activeTab, setActiveTab] = useState("all"); // "all" | "orders" | "wishlist" | "security"
  const [orderStatusFilter, setOrderStatusFilter] = useState("all"); // "all" | "paid" | "pending" | "failed"
  const [orderTypeFilter, setOrderTypeFilter] = useState("all"); // "all" | "topup" | "store"
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSort, setOrderSort] = useState("newest"); // "newest" | "highest"
  const [expandedOrders, setExpandedOrders] = useState({});
  const [maskedAccess, setMaskedAccess] = useState({});
  const [copiedId, setCopiedId] = useState("");

  // Inline / Profile editing states
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  const fetchAccountData = useCallback(
    async (isSilent = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (isSilent) setRefreshing(true);
      else setLoading(true);

      try {
        const [o, w, r, sec] = await Promise.allSettled([
          api.get("/me/orders"),
          api.get("/me/wishlist"),
          api.get("/reviews/mine"),
          api.get("/me/security"),
        ]);

        if (o.status === "fulfilled") {
          setOrders(Array.isArray(o.value.data) ? o.value.data : []);
        }
        if (w.status === "fulfilled") {
          setWishlist(Array.isArray(w.value.data) ? w.value.data : []);
        }
        if (r.status === "fulfilled") {
          const map = {};
          (Array.isArray(r.value.data) ? r.value.data : []).forEach((rev) => {
            if (rev.id) map[rev.id] = rev;
            if (rev.order_id) map[rev.order_id] = rev;
          });
          setReviewed(map);
        }
        if (sec.status === "fulfilled" && sec.value?.data) {
          setSecurityData(sec.value.data);
        }
        if (o.status === "rejected" && w.status === "rejected") {
          toast.error("Gagal memuat data akun. Coba muat ulang halaman.");
        } else if (isSilent) {
          toast.success("Data akun berhasil diperbarui");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    let alive = true;
    if (!user) {
      setLoading(false);
      return;
    }
    setNameInput(user.name || "");
    fetchAccountData(false);
    return () => {
      alive = false;
    };
  }, [user, fetchAccountData]);

  // Computed metrics
  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.payment_status === "paid");
    const pendingOrders = orders.filter(
      (o) => o.payment_status !== "paid" && o.payment_status !== "failed" && o.payment_status !== "cancelled"
    );
    const failedOrders = orders.filter(
      (o) => o.payment_status === "failed" || o.payment_status === "cancelled"
    );
    const topupOrders = orders.filter((o) => o.order_type === "topup" || o.denomination_id);
    const storeOrders = orders.filter((o) => o.order_type !== "topup" && !o.denomination_id);
    const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const reviewCount = Object.keys(reviewed).length / 2;

    return {
      total: orders.length,
      paidCount: paidOrders.length,
      pendingCount: pendingOrders.length,
      failedCount: failedOrders.length,
      topupCount: topupOrders.length,
      storeCount: storeOrders.length,
      totalSpent,
      reviewCount: Math.max(0, Math.round(reviewCount)),
      tier: getMemberTier(paidOrders.length, totalSpent),
    };
  }, [orders, reviewed]);

  // Filtered and sorted orders
  const filteredOrders = useMemo(() => {
    let list = [...orders];

    if (orderStatusFilter === "paid") {
      list = list.filter((o) => o.payment_status === "paid");
    } else if (orderStatusFilter === "pending") {
      list = list.filter(
        (o) => o.payment_status !== "paid" && o.payment_status !== "failed" && o.payment_status !== "cancelled"
      );
    } else if (orderStatusFilter === "failed") {
      list = list.filter((o) => o.payment_status === "failed" || o.payment_status === "cancelled");
    }

    if (orderTypeFilter === "topup") {
      list = list.filter((o) => o.order_type === "topup" || o.denomination_id);
    } else if (orderTypeFilter === "store") {
      list = list.filter((o) => o.order_type !== "topup" && !o.denomination_id);
    }

    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      list = list.filter((o) => {
        const title = String(o.product_title || "").toLowerCase();
        const game = String(o.game_name || "").toLowerCase();
        const oid = String(o.order_id || o.session_id || "").toLowerCase();
        const dest = JSON.stringify(o.destination || {}).toLowerCase();
        return title.includes(q) || game.includes(q) || oid.includes(q) || dest.includes(q);
      });
    }

    if (orderSort === "highest") {
      list.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    } else {
      list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }

    return list;
  }, [orders, orderStatusFilter, orderTypeFilter, orderSearch, orderSort]);

  const handleCopy = (text, label = "Teks") => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedId(String(text));
    toast.success(`${label} disalin ke clipboard`);
    setTimeout(() => setCopiedId(""), 2000);
  };

  const toggleExpandOrder = (id) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMaskAccess = (id) => {
    setMaskedAccess((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveProfileName = async (e) => {
    e?.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      toast.error("Nama minimal 2 karakter");
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(trimmed);
      setEditingName(false);
      toast.success("Nama tampilan berhasil diperbarui!");
      fetchAccountData(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal memperbarui profil");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Masukkan password saat ini");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok");
      return;
    }
    setSavingPassword(true);
    try {
      const { data } = await api.post("/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success(data?.message || "Password berhasil diperbarui!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      fetchAccountData(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mengubah password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    setRevokingSessions(true);
    try {
      await api.post("/auth/logout-all");
      toast.success("Seluruh sesi perangkat berhasil dihentikan. Silakan login kembali.");
      logout();
    } catch {
      toast.error("Gagal menghentikan sesi");
    } finally {
      setRevokingSessions(false);
    }
  };

  const userInitials = useMemo(() => {
    const raw = String(user?.name || user?.email || "M").trim();
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return raw.slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-void grid-bg relative overflow-hidden">
      {/* Ambient dynamic background glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 w-[480px] h-[480px] bg-neon/5 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 -left-40 w-[420px] h-[420px] bg-lime/5 rounded-full blur-[130px]" />
      </div>

      <Navbar />

      <div className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 pb-28 sm:pb-32">
        {initializing ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3" data-testid="account-initializing">
            <Loader2 size={32} className="animate-spin text-neon" />
            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-slate-400">
              Memuat Command Center Akun...
            </p>
          </div>
        ) : !user ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto my-10 bg-panel/90 backdrop-blur-md border border-line p-8 sm:p-12 text-center relative overflow-hidden"
            data-testid="account-guest"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-neon via-lime to-neon" />
            <div className="w-20 h-20 mx-auto mb-6 grid place-items-center bg-neon/10 border border-neon/30 relative">
              <User size={38} className="text-neon" />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-lime border-2 border-void" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-neon mb-2">
              MEMBER COMMAND CENTER
            </p>
            <h1 className="font-display font-black uppercase text-2xl sm:text-3xl text-slate-100">
              Akun Saya
            </h1>
            <p className="text-slate-400 font-mono text-xs mt-3 max-w-md mx-auto leading-relaxed">
              Silakan login untuk memantau status pesanan secara real-time, membuka kredensial akun yang dibeli, dan mengelola wishlist game favorit Anda.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-left">
              <div className="bg-void/60 border border-line p-3.5">
                <Zap size={16} className="text-neon mb-2" />
                <p className="font-display font-bold text-xs text-slate-100 uppercase">Lacak Pesanan</p>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Pantau progres top-up & akses akun instan 24/7.
                </p>
              </div>
              <div className="bg-void/60 border border-line p-3.5">
                <KeyRound size={16} className="text-lime mb-2" />
                <p className="font-display font-bold text-xs text-slate-100 uppercase">Brankas Akses</p>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Data login akun tersimpan aman di riwayat member.
                </p>
              </div>
              <div className="bg-void/60 border border-line p-3.5">
                <Heart size={16} className="text-coral mb-2" />
                <p className="font-display font-bold text-xs text-slate-100 uppercase">Wishlist & Ulasan</p>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Simpan akun incaran dan bangun reputasi member.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <button
                onClick={() => openAuth("login")}
                data-testid="account-login-button"
                className="w-full sm:w-auto bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] px-8 py-3.5 hover:bg-lime transition-colors duration-300"
              >
                Login Sekarang
              </button>
              <button
                onClick={() => openAuth("register")}
                className="w-full sm:w-auto border border-line hover:border-neon/60 text-slate-200 hover:text-neon font-display font-bold text-[11px] uppercase tracking-[0.2em] px-8 py-3.5 transition-colors duration-300"
              >
                Buat Akun Baru
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 sm:space-y-8"
            data-testid="account-dashboard"
          >
            {/* Top Header & Quick Actions Bar */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="inline-block w-2 h-2 bg-lime animate-pulse" />
                  <p className="text-[11px] font-mono tracking-[0.3em] text-neon uppercase">
                    Panel Member &bull; Command Center
                  </p>
                </div>
                <h1 className="font-display font-black uppercase text-3xl sm:text-4xl text-slate-100 mt-1.5 tracking-tight">
                  Halo, <span className="text-neon">{user.name || "Member"}</span>
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fetchAccountData(true)}
                  disabled={refreshing || loading}
                  className="inline-flex items-center gap-2 border border-line hover:border-neon/50 bg-panel px-3.5 py-2.5 text-[10px] font-mono uppercase tracking-widest text-slate-300 hover:text-neon transition-colors disabled:opacity-50"
                  title="Muat ulang status pesanan & aktivitas terbaru"
                >
                  <RefreshCw size={13} className={refreshing ? "animate-spin text-neon" : ""} />
                  {refreshing ? "Memperbarui..." : "Sinkronkan Data"}
                </button>
                <Link
                  to="/topup"
                  className="inline-flex items-center gap-2 border border-neon/40 bg-neon/10 hover:bg-neon hover:text-void px-4 py-2.5 text-[10px] font-display font-bold uppercase tracking-widest text-neon transition-colors"
                >
                  <Zap size={13} /> Top-Up Instan
                </Link>
                <Link
                  to="/#katalog"
                  className="inline-flex items-center gap-2 border border-line hover:border-lime/50 bg-panel px-4 py-2.5 text-[10px] font-display font-bold uppercase tracking-widest text-slate-200 hover:text-lime transition-colors"
                >
                  <ShoppingBag size={13} /> Katalog Akun
                </Link>
              </div>
            </div>

            {/* Dynamic Profile & Loyalty Card */}
            <div
              className="bg-panel border border-line relative overflow-hidden"
              data-testid="account-profile-card"
            >
              <div className={`h-1 w-full bg-gradient-to-r ${stats.tier.accentClass}`} />

              <div className="p-6 sm:p-8">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
                  {/* Left: Avatar & Member Identity */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5 flex-1 min-w-0">
                    <div className="relative w-20 h-20 shrink-0 grid place-items-center bg-gradient-to-br from-neon/20 via-void to-lime/10 border border-neon/40">
                      <span className="font-display font-black text-2xl text-neon tracking-wider">
                        {userInitials}
                      </span>
                      <span
                        className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 bg-lime text-void font-mono font-bold text-[8px] uppercase tracking-wider"
                        title="Status sesi online"
                      >
                        AKTIF
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {editingName ? (
                          <form onSubmit={handleSaveProfileName} className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={nameInput}
                              onChange={(e) => setNameInput(e.target.value)}
                              maxLength={64}
                              autoFocus
                              placeholder="Nama tampilan..."
                              className="bg-void border border-neon/60 px-3 py-1.5 text-xs font-display font-bold text-slate-100 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={savingName}
                              className="bg-neon text-void px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider hover:bg-lime transition-colors"
                            >
                              {savingName ? "..." : "Simpan"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingName(false);
                                setNameInput(user.name || "");
                              }}
                              className="border border-line px-2.5 py-1.5 text-[10px] font-mono uppercase text-slate-400 hover:text-slate-200"
                            >
                              Batal
                            </button>
                          </form>
                        ) : (
                          <>
                            <div
                              className="flex items-center gap-2 text-base sm:text-lg text-slate-100 font-display font-bold"
                              data-testid="account-name"
                            >
                              <span className="truncate">{user.name || "Member"}</span>
                              <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-line bg-void text-slate-300">
                                {user.role || "buyer"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setNameInput(user.name || "");
                                setEditingName(true);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-neon border border-transparent hover:border-line px-2 py-0.5 transition-colors"
                              title="Ubah nama tampilan"
                            >
                              <Edit3 size={11} /> Edit
                            </button>
                          </>
                        )}

                        <span
                          className={`inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 border ${stats.tier.badgeClass}`}
                        >
                          <Sparkles size={10} /> {stats.tier.name}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-mono text-slate-400">
                        <p className="flex items-center gap-2" data-testid="account-email">
                          <Mail size={13} className="text-neon" /> {user.email}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-lime" />
                          <span className="text-lime">Akun terverifikasi</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-500">
                          <Clock size={12} /> Member sejak {fmtShortDate(user.created_at)}
                        </p>
                      </div>

                      {/* Dynamic Member Tier Progress */}
                      <div className="pt-1 max-w-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span className="text-slate-400">{stats.tier.hint}</span>
                          <span className="text-neon font-bold tabular-nums">{stats.tier.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-void border border-line overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.tier.progress}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full bg-gradient-to-r ${stats.tier.accentClass}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Security Status & Logout */}
                  <div className="flex sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-line shrink-0">
                    <div className="flex items-center gap-2">
                      {user.role === "admin" && (
                        <Link
                          to="/admin"
                          className="inline-flex items-center gap-1.5 border border-neon/50 bg-neon/10 text-neon hover:bg-neon hover:text-void text-[10px] font-display font-bold uppercase tracking-[0.18em] px-4 py-3 transition-colors"
                        >
                          Panel Admin <ArrowRight size={12} />
                        </Link>
                      )}
                      <button
                        onClick={logout}
                        data-testid="account-logout-button"
                        className="flex items-center justify-center gap-2 border border-line hover:border-coral/60 text-slate-300 hover:text-coral text-[10px] font-bold uppercase tracking-[0.2em] px-5 py-3 transition-colors duration-300"
                      >
                        <LogOut size={13} /> Keluar
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 text-right hidden sm:block">
                      Sesi aktif: <span className="text-slate-300 tabular-nums">{securityData.active_sessions_count || 1} perangkat</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive KPI Telemetry Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="account-stats-grid">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("all");
                  setOrderStatusFilter("all");
                }}
                className={`text-left bg-panel border p-4 sm:p-5 transition-all group ${
                  orderStatusFilter === "all" && activeTab !== "wishlist" && activeTab !== "security"
                    ? "border-neon/60 bg-neon/[0.03]"
                    : "border-line hover:border-neon/40"
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest">Total Transaksi</span>
                  <Package size={15} className="text-neon group-hover:scale-110 transition-transform" />
                </div>
                <p className="font-display font-black text-2xl sm:text-3xl text-slate-100 font-mono tabular-nums">
                  {stats.total}
                </p>
                <p className="text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums">
                  {stats.topupCount} Top-Up &bull; {stats.storeCount} Store Akun
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("orders");
                  setOrderStatusFilter("paid");
                }}
                className={`text-left bg-panel border p-4 sm:p-5 transition-all group ${
                  orderStatusFilter === "paid"
                    ? "border-lime/60 bg-lime/[0.03]"
                    : "border-line hover:border-lime/40"
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest">Pesanan Lunas</span>
                  <Wallet size={15} className="text-lime group-hover:scale-110 transition-transform" />
                </div>
                <p className="font-display font-black text-xl sm:text-2xl text-lime font-mono tabular-nums truncate">
                  {formatIDR(stats.totalSpent)}
                </p>
                <p className="text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums">
                  {stats.paidCount} pesanan selesai &bull; Klik filter
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("orders");
                  setOrderStatusFilter("pending");
                }}
                className={`text-left bg-panel border p-4 sm:p-5 transition-all group ${
                  orderStatusFilter === "pending"
                    ? "border-neon/60 bg-neon/[0.03]"
                    : "border-line hover:border-neon/40"
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest">Menunggu Proses</span>
                  <Clock size={15} className="text-neon group-hover:scale-110 transition-transform" />
                </div>
                <p className="font-display font-black text-2xl sm:text-3xl text-slate-100 font-mono tabular-nums">
                  {stats.pendingCount}
                </p>
                <p className="text-[10px] font-mono text-slate-500 mt-1.5">
                  {stats.pendingCount > 0 ? "Perlu pembayaran / verifikasi" : "Semua pesanan tuntas"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "wishlist" ? "all" : "wishlist")}
                className={`text-left bg-panel border p-4 sm:p-5 transition-all group ${
                  activeTab === "wishlist"
                    ? "border-coral/60 bg-coral/[0.03]"
                    : "border-line hover:border-coral/40"
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest">Wishlist & Ulasan</span>
                  <Heart size={15} className="text-coral group-hover:scale-110 transition-transform" />
                </div>
                <p className="font-display font-black text-2xl sm:text-3xl text-slate-100 font-mono tabular-nums">
                  {wishlist.length}
                </p>
                <p className="text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums">
                  {stats.reviewCount} ulasan telah dikirim
                </p>
              </button>
            </div>

            {/* Dynamic Section Switcher Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto border-b border-line pb-3">
              {[
                { id: "all", label: "Semua Aktivitas", icon: Sparkles, count: null },
                { id: "orders", label: "Riwayat Pesanan", icon: Package, count: orders.length },
                { id: "wishlist", label: "Wishlist Saya", icon: Heart, count: wishlist.length },
                { id: "security", label: "Pengaturan & Keamanan", icon: Lock, count: null },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-display font-bold uppercase tracking-wider border transition-all whitespace-nowrap shrink-0 ${
                      isActive
                        ? "bg-neon text-void border-neon"
                        : "bg-panel text-slate-300 border-line hover:border-neon/40 hover:text-slate-100"
                    }`}
                  >
                    <Icon size={13} />
                    <span>{tab.label}</span>
                    {tab.count !== null && (
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-mono tabular-nums ${
                          isActive ? "bg-void/20 text-void" : "bg-void text-slate-400"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="space-y-3 py-8">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-24 bg-panel border border-line animate-pulse p-5 flex items-center justify-between"
                  >
                    <div className="space-y-2 w-1/2">
                      <div className="h-4 bg-void w-2/3" />
                      <div className="h-3 bg-void w-1/3" />
                    </div>
                    <div className="h-6 bg-void w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-10">
                {/* ORDERS SECTION */}
                {(activeTab === "all" || activeTab === "orders") && (
                  <section data-testid="account-orders-section" className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 font-display font-bold uppercase text-sm sm:text-base text-slate-100">
                        <Package size={17} className="text-neon" /> Riwayat Pesanan
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                          ({filteredOrders.length} dari {orders.length})
                        </span>
                      </h2>

                      {orders.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            { id: "all", label: "Semua", count: stats.total },
                            { id: "paid", label: "Lunas", count: stats.paidCount },
                            { id: "pending", label: "Menunggu", count: stats.pendingCount },
                            { id: "failed", label: "Gagal/Batal", count: stats.failedCount },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setOrderStatusFilter(f.id)}
                              className={`px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                                orderStatusFilter === f.id
                                  ? "border-neon bg-neon/15 text-neon font-bold"
                                  : "border-line bg-panel text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {f.label} <span className="opacity-70 tabular-nums">({f.count})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Search & Filter Controls when user has orders */}
                    {orders.length > 0 && (
                      <div className="bg-panel border border-line p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <div className="relative flex-1">
                          <Search
                            size={14}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                          />
                          <input
                            type="text"
                            value={orderSearch}
                            onChange={(e) => setOrderSearch(e.target.value)}
                            placeholder="Cari nama produk, game, kode pesanan (#ORD), atau ID tujuan..."
                            className="w-full bg-void border border-line focus:border-neon/60 pl-9 pr-4 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border border-line bg-void p-0.5">
                            {[
                              { id: "all", label: "Semua Jenis" },
                              { id: "topup", label: "Top-Up" },
                              { id: "store", label: "Akun/Store" },
                            ].map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setOrderTypeFilter(t.id)}
                                className={`px-2.5 py-1 text-[10px] font-mono uppercase transition-colors ${
                                  orderTypeFilter === t.id
                                    ? "bg-neon text-void font-bold"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setOrderSort((s) => (s === "newest" ? "highest" : "newest"))
                            }
                            className="inline-flex items-center gap-1.5 border border-line bg-void hover:border-neon/40 px-3 py-1.5 text-[10px] font-mono uppercase text-slate-300"
                            title="Urutkan pesanan"
                          >
                            <SlidersHorizontal size={12} className="text-neon" />
                            {orderSort === "newest" ? "Terbaru" : "Nominal Tertinggi"}
                          </button>
                        </div>
                      </div>
                    )}

                    {orders.length === 0 ? (
                      <div
                        className="bg-panel border border-line p-8 sm:p-10 text-center"
                        data-testid="account-orders-empty"
                      >
                        <Package size={32} className="text-slate-600 mx-auto mb-3" />
                        <p className="text-xs font-mono text-slate-400">
                          Belum ada pesanan. Yuk jelajahi katalog atau top-up game favoritmu!
                        </p>
                        <div className="flex items-center justify-center gap-4 mt-5">
                          <Link
                            to="/#katalog"
                            className="inline-flex items-center gap-1.5 bg-neon text-void font-display font-bold text-[10px] uppercase tracking-widest px-5 py-2.5 hover:bg-lime transition-colors"
                          >
                            Lihat Katalog <ArrowRight size={13} />
                          </Link>
                          <Link
                            to="/topup"
                            className="inline-flex items-center gap-1.5 border border-line hover:border-neon text-slate-200 hover:text-neon font-mono text-[10px] uppercase tracking-widest px-5 py-2.5 transition-colors"
                          >
                            Top-Up Game <Zap size={12} />
                          </Link>
                        </div>
                      </div>
                    ) : filteredOrders.length === 0 ? (
                      <div className="bg-panel border border-line p-8 text-center">
                        <p className="text-xs font-mono text-slate-400">
                          Tidak ada pesanan yang cocok dengan filter pencarian Anda.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setOrderStatusFilter("all");
                            setOrderTypeFilter("all");
                            setOrderSearch("");
                          }}
                          className="mt-3 text-[11px] font-mono uppercase tracking-widest text-neon hover:underline"
                        >
                          Reset Semua Filter
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <AnimatePresence initial={false}>
                          {filteredOrders.map((o) => {
                            const key = o.session_id || o.order_id;
                            const orderCode = o.order_id || o.session_id;
                            const isTopup = o.order_type === "topup" || Boolean(o.denomination_id);
                            const isExpanded = Boolean(expandedOrders[key]);
                            const isMasked = Boolean(maskedAccess[key]);
                            const progressStep = getOrderProgressStep(o);
                            const destEntries =
                              o.destination && typeof o.destination === "object"
                                ? Object.entries(o.destination).filter(([, v]) => v)
                                : [];

                            return (
                              <motion.div
                                key={key}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                data-testid="account-order-item"
                                className="bg-panel border border-line hover:border-slate-700 transition-colors relative overflow-hidden"
                              >
                                {/* Left status indicator stripe */}
                                <div
                                  className={`absolute left-0 top-0 bottom-0 w-1 ${statusAccentBar(o)}`}
                                />

                                <div className="p-4 sm:p-5 pl-5 sm:pl-6">
                                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                                    <div className="flex-1 min-w-0">
                                      {/* Category & Order ID header */}
                                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                        <span
                                          className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 border ${
                                            isTopup
                                              ? "border-neon/40 bg-neon/10 text-neon"
                                              : "border-lime/40 bg-lime/10 text-lime"
                                          }`}
                                        >
                                          {isTopup ? <Zap size={10} /> : <Gamepad2 size={10} />}
                                          {isTopup ? "TOP-UP" : "STORE AKUN"}
                                        </span>

                                        {o.game_name && (
                                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 border border-line bg-void px-2 py-0.5">
                                            {o.game_name}
                                          </span>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleCopy(orderCode, "Kode pesanan")}
                                          className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-neon transition-colors tabular-nums"
                                          title="Klik untuk menyalin kode pesanan"
                                        >
                                          #{orderCode}
                                          {copiedId === String(orderCode) ? (
                                            <Check size={11} className="text-lime" />
                                          ) : (
                                            <Copy size={11} />
                                          )}
                                        </button>

                                        <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                                          &bull; {fmtDate(o.created_at)}
                                        </span>
                                      </div>

                                      {/* Product Title */}
                                      <p className="text-sm sm:text-base font-display font-bold text-slate-100 truncate">
                                        {o.product_title || "Produk"}
                                      </p>

                                      {/* Quick Topup Target Preview */}
                                      {destEntries.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                          {destEntries.map(([k, v]) => (
                                            <span
                                              key={k}
                                              className="text-[10px] font-mono text-slate-300 bg-void border border-line px-2 py-0.5 tabular-nums"
                                            >
                                              <span className="text-slate-500 uppercase">{k}:</span> {String(v)}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Delivery Credentials / Access Box */}
                                      {o.payment_status === "paid" && o.delivery_info && (
                                        <div
                                          className="mt-3 bg-lime/5 border border-lime/25 px-3.5 py-3"
                                          data-testid="account-order-access"
                                        >
                                          <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-lime">
                                              <KeyRound size={11} /> Akses Akun / Link Pengiriman
                                            </p>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => toggleMaskAccess(key)}
                                                className="inline-flex items-center gap-1 text-[9px] font-mono uppercase text-slate-400 hover:text-slate-200"
                                              >
                                                {isMasked ? <Eye size={11} /> : <EyeOff size={11} />}
                                                {isMasked ? "Tampilkan" : "Samarkan"}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleCopy(o.delivery_info, "Data akses akun")}
                                                className="inline-flex items-center gap-1 text-[9px] font-mono uppercase text-lime hover:underline"
                                              >
                                                <Copy size={11} /> Salin Akses
                                              </button>
                                            </div>
                                          </div>
                                          <p
                                            className={`text-[11px] font-mono text-slate-100 whitespace-pre-wrap break-words leading-relaxed transition-all ${
                                              isMasked ? "blur-sm select-none" : ""
                                            }`}
                                          >
                                            {linkify(o.delivery_info)}
                                          </p>
                                        </div>
                                      )}

                                      {/* Action buttons row (Continue Payment, Review, Toggle Details) */}
                                      <div className="flex flex-wrap items-center gap-2.5 mt-3">
                                        {o.provider === "manual" && o.payment_status === "pending" && (
                                          <Link
                                            to={`/payment/success?session_id=${o.session_id}`}
                                            data-testid="account-order-continue"
                                            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neon border border-neon/40 hover:bg-neon/10 px-3 py-1.5 transition-colors"
                                          >
                                            {o.status === "waiting_approval"
                                              ? "Lihat Status"
                                              : "Selesaikan Pembayaran"}{" "}
                                            <ArrowRight size={11} />
                                          </Link>
                                        )}

                                        {o.payment_status === "paid" && (
                                          <div data-testid="account-order-review" className="inline-flex">
                                            {reviewed[o.session_id] ? (
                                              <span
                                                data-testid="account-order-reviewed"
                                                className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-lime border border-lime/30 bg-lime/5 px-2.5 py-1"
                                              >
                                                <Star size={11} fill="currentColor" /> Sudah diulas
                                                <span className="text-slate-400 tabular-nums">
                                                  ({reviewed[o.session_id].rating}/5)
                                                </span>
                                              </span>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => setReviewTarget(o)}
                                                data-testid="account-order-review-button"
                                                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-void bg-lime hover:bg-neon px-3 py-1.5 transition-colors"
                                              >
                                                <Star size={11} /> Beri Ulasan
                                              </button>
                                            )}
                                          </div>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => toggleExpandOrder(key)}
                                          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-neon border border-line px-2.5 py-1 transition-colors"
                                        >
                                          {isExpanded ? (
                                            <>
                                              Tutup Detail <ChevronUp size={12} />
                                            </>
                                          ) : (
                                            <>
                                              Detail Transaksi <ChevronDown size={12} />
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Right: Price & Status Badge */}
                                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-line pt-3 sm:pt-0">
                                      <span className="text-base sm:text-lg font-display font-black text-neon font-mono tabular-nums">
                                        {formatIDR(o.amount)}
                                      </span>
                                      <span
                                        data-testid="account-order-status"
                                        className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 border ${statusStyle(
                                          o
                                        )}`}
                                      >
                                        {o.payment_status === "paid" ? (
                                          <CheckCircle2 size={11} />
                                        ) : o.payment_status === "failed" ||
                                          o.payment_status === "cancelled" ? (
                                          <XCircle size={11} />
                                        ) : (
                                          <AlertCircle size={11} />
                                        )}
                                        {statusLabel(o)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Expandable Transaction Telemetry & Timeline */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="mt-4 pt-4 border-t border-line space-y-4">
                                          {/* Visual Progress Stepper */}
                                          {progressStep > 0 && (
                                            <div className="grid grid-cols-4 gap-2">
                                              {[
                                                { step: 1, label: "Pesanan Dibuat" },
                                                { step: 2, label: "Pembayaran" },
                                                { step: 3, label: "Verifikasi Admin" },
                                                { step: 4, label: "Selesai / Lunas" },
                                              ].map((st) => {
                                                const done = progressStep >= st.step;
                                                return (
                                                  <div key={st.step} className="space-y-1.5">
                                                    <div
                                                      className={`h-1 w-full ${
                                                        done ? "bg-lime" : "bg-void border border-line"
                                                      }`}
                                                    />
                                                    <p
                                                      className={`text-[9px] font-mono uppercase tracking-wider ${
                                                        done ? "text-lime font-bold" : "text-slate-500"
                                                      }`}
                                                    >
                                                      {st.step}. {st.label}
                                                    </p>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}

                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-void/70 border border-line p-3.5 text-[11px] font-mono">
                                            <div>
                                              <p className="text-[9px] uppercase tracking-widest text-slate-500">
                                                ID Sesi / Invoice
                                              </p>
                                              <p className="text-slate-200 mt-0.5 break-all tabular-nums">
                                                {o.session_id}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] uppercase tracking-widest text-slate-500">
                                                Metode Pembayaran
                                              </p>
                                              <p className="text-slate-200 mt-0.5 uppercase">
                                                {o.provider === "paykita"
                                                  ? "QRIS Otomatis (Paylabs/Paykita)"
                                                  : o.manual_destination_label || "Transfer Manual"}
                                              </p>
                                            </div>
                                            <div className="flex sm:justify-end items-center">
                                              <Link
                                                to={`/payment/success?session_id=${o.session_id}`}
                                                className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neon hover:text-lime border border-neon/30 px-3 py-1.5"
                                              >
                                                Halaman Invoice <ExternalLink size={11} />
                                              </Link>
                                            </div>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </section>
                )}

                {/* WISHLIST SECTION */}
                {(activeTab === "all" || activeTab === "wishlist") && (
                  <section data-testid="account-wishlist-section" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 font-display font-bold uppercase text-sm sm:text-base text-slate-100">
                        <Heart size={17} className="text-coral" /> Wishlist
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                          ({wishlist.length})
                        </span>
                      </h2>
                      {wishlist.length > 0 && (
                        <Link
                          to="/#katalog"
                          className="text-[10px] font-mono uppercase tracking-widest text-neon hover:underline inline-flex items-center gap-1"
                        >
                          Tambah dari Katalog <ArrowRight size={11} />
                        </Link>
                      )}
                    </div>

                    {wishlist.length === 0 ? (
                      <div
                        className="bg-panel border border-line p-8 text-center"
                        data-testid="account-wishlist-empty"
                      >
                        <Heart size={28} className="text-slate-600 mx-auto mb-2.5" />
                        <p className="text-xs font-mono text-slate-400">
                          Wishlist kamu masih kosong. Simpan akun incaranmu dari katalog agar mudah dipantau!
                        </p>
                        <Link
                          to="/#katalog"
                          className="inline-flex items-center gap-1.5 mt-4 text-neon font-mono text-[11px] uppercase tracking-widest hover:underline"
                        >
                          Jelajahi Katalog <ArrowRight size={12} />
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {wishlist.map((p) => (
                          <motion.div
                            key={p.id}
                            layout
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            data-testid="account-wishlist-item"
                            className="bg-panel border border-line hover:border-neon/50 overflow-hidden group relative flex flex-col transition-colors"
                          >
                            <button
                              onClick={() =>
                                toggleWishlist(p.id).then(() =>
                                  setWishlist((w) => w.filter((x) => x.id !== p.id))
                                )
                              }
                              data-testid="account-wishlist-remove"
                              aria-label="Hapus dari wishlist"
                              className="absolute top-2.5 right-2.5 z-10 grid place-items-center w-8 h-8 bg-void/85 border border-line text-coral hover:border-coral hover:bg-void transition-colors"
                              title="Hapus dari Wishlist"
                            >
                              <Heart size={14} className="fill-coral" />
                            </button>

                            <div className="aspect-video overflow-hidden bg-void relative">
                              <img
                                src={imgSrc(p.image)}
                                alt={p.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <span className="absolute bottom-2 left-2 bg-void/90 border border-line px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-neon">
                                {p.game}
                              </span>
                            </div>

                            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                  {p.category || "Akun Game"}
                                </p>
                                <p className="text-xs sm:text-sm font-display font-bold text-slate-100 truncate mt-0.5">
                                  {p.title}
                                </p>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-line">
                                <div className="flex items-baseline gap-1.5">
                                  <p className="text-sm font-display font-black text-neon font-mono tabular-nums">
                                    {formatIDR(p.price)}
                                  </p>
                                  <span className="text-[11px] font-mono font-semibold text-lime tabular-nums">
                                    · {formatUSD(p)}
                                  </span>
                                </div>
                                <Link
                                  to={`/?q=${encodeURIComponent(p.title)}#katalog`}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-300 hover:text-lime transition-colors"
                                >
                                  Lihat <ArrowRight size={11} />
                                </Link>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* SECURITY & PROFILE SETTINGS SECTION */}
                {(activeTab === "all" || activeTab === "security") && (
                  <section data-testid="account-security-section" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 font-display font-bold uppercase text-sm sm:text-base text-slate-100">
                        <Lock size={17} className="text-lime" /> Pengaturan Profil & Keamanan Akun
                      </h2>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-lime flex items-center gap-1.5">
                        <ShieldCheck size={13} /> Proteksi Aktif
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left Column: Update Profile & Change Password */}
                      <div className="bg-panel border border-line p-5 sm:p-6 space-y-6">
                        <div>
                          <h3 className="font-display font-bold uppercase text-xs text-slate-100 tracking-wider flex items-center gap-2">
                            <Edit3 size={14} className="text-neon" /> Identitas Tampilan Member
                          </h3>
                          <p className="text-[11px] font-mono text-slate-400 mt-1">
                            Nama ini ditampilkan pada ulasan pembelian dan riwayat pesanan Anda.
                          </p>
                          <form onSubmit={handleSaveProfileName} className="mt-3 flex gap-2">
                            <input
                              type="text"
                              value={nameInput}
                              onChange={(e) => setNameInput(e.target.value)}
                              maxLength={64}
                              placeholder="Nama tampilan Anda"
                              className="flex-1 bg-void border border-line focus:border-neon/60 px-3.5 py-2.5 text-xs font-mono text-slate-100 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={savingName || nameInput.trim() === (user.name || "")}
                              className="bg-neon text-void font-display font-bold text-[10px] uppercase tracking-widest px-5 py-2.5 hover:bg-lime transition-colors disabled:opacity-40"
                            >
                              {savingName ? "Menyimpan..." : "Simpan"}
                            </button>
                          </form>
                        </div>

                        <div className="pt-5 border-t border-line">
                          <div className="flex items-center justify-between">
                            <h3 className="font-display font-bold uppercase text-xs text-slate-100 tracking-wider flex items-center gap-2">
                              <KeyRound size={14} className="text-lime" /> Ubah Password Akun
                            </h3>
                            <button
                              type="button"
                              onClick={() => setShowPasswords((s) => !s)}
                              className="text-[10px] font-mono text-slate-400 hover:text-neon inline-flex items-center gap-1"
                            >
                              {showPasswords ? <EyeOff size={12} /> : <Eye size={12} />}
                              {showPasswords ? "Sembunyikan" : "Lihat Password"}
                            </button>
                          </div>

                          <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
                            <div>
                              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                                Password Saat Ini
                              </label>
                              <input
                                type={showPasswords ? "text" : "password"}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Masukkan password lama..."
                                className="w-full bg-void border border-line focus:border-neon/60 px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                                  Password Baru (Min. 6 Karakter)
                                </label>
                                <input
                                  type={showPasswords ? "text" : "password"}
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="Password baru..."
                                  className="w-full bg-void border border-line focus:border-neon/60 px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                                  Konfirmasi Password Baru
                                </label>
                                <input
                                  type={showPasswords ? "text" : "password"}
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  placeholder="Ulangi password baru..."
                                  className="w-full bg-void border border-line focus:border-neon/60 px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] font-mono text-slate-500">
                                {securityData.password_changed_at
                                  ? `Terakhir diubah: ${fmtDate(securityData.password_changed_at)}`
                                  : "Password belum pernah diubah sejak pendaftaran"}
                              </span>
                              <button
                                type="submit"
                                disabled={savingPassword || !currentPassword || !newPassword}
                                className="border border-lime/50 bg-lime/10 hover:bg-lime hover:text-void text-lime font-display font-bold text-[10px] uppercase tracking-widest px-4 py-2 transition-colors disabled:opacity-40"
                              >
                                {savingPassword ? "Memproses..." : "Perbarui Password"}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>

                      {/* Right Column: Active Sessions & Security Log */}
                      <div className="bg-panel border border-line p-5 sm:p-6 flex flex-col justify-between space-y-5">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-display font-bold uppercase text-xs text-slate-100 tracking-wider flex items-center gap-2">
                                <Activity size={14} className="text-neon" /> Aktivitas & Sesi Keamanan
                              </h3>
                              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                Riwayat autentikasi terbaru pada akun Anda.
                              </p>
                            </div>
                            <span className="px-2.5 py-1 bg-void border border-line text-[10px] font-mono text-neon tabular-nums">
                              {securityData.active_sessions_count || 1} Sesi Aktif
                            </span>
                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {securityData.audit_logs && securityData.audit_logs.length > 0 ? (
                              securityData.audit_logs.slice(0, 6).map((log) => (
                                <div
                                  key={log.id}
                                  className="bg-void/70 border border-line px-3.5 py-2.5 flex items-center justify-between gap-3 text-[11px] font-mono"
                                >
                                  <div className="min-w-0">
                                    <p className="text-slate-200 font-bold truncate">
                                      {formatAuditAction(log.action)}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                                      IP: {log.ip || "-"}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                                    {fmtDate(log.created_at)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="bg-void/60 border border-line p-4 text-center text-xs font-mono text-slate-500">
                                Belum ada riwayat log keamanan tambahan.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-[10px] font-mono text-slate-400">
                            <p className="text-slate-200 font-bold flex items-center gap-1.5">
                              <ShieldAlert size={12} className="text-coral" /> Keluar dari Semua Perangkat
                            </p>
                            <p className="text-slate-500 mt-0.5">
                              Cabut seluruh token sesi aktif jika Anda login di perangkat publik.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleLogoutAllSessions}
                            disabled={revokingSessions}
                            className="shrink-0 border border-coral/50 bg-coral/10 hover:bg-coral hover:text-void text-coral font-display font-bold text-[10px] uppercase tracking-widest px-4 py-2.5 transition-colors disabled:opacity-50"
                          >
                            {revokingSessions ? "Memproses..." : "Cabut Semua Sesi"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <Footer />

      <ReviewModal
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        sessionId={reviewTarget?.session_id}
        productTitle={reviewTarget?.product_title}
        defaultEmail={user?.email || ""}
        onSubmitted={() => {
          setReviewed((m) => ({
            ...m,
            [reviewTarget?.session_id]: { rating: 5, id: reviewTarget?.session_id },
          }));
        }}
      />
    </div>
  );
}
