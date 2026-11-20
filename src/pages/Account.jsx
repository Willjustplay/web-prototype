import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  Camera,
  QrCode,
  CreditCard,
  Coins,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ReviewModal } from "@/components/ReviewModal";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  formatIDR,
  formatUSD,
  imgSrc,
  PROFILE_AVATARS,
  resolveUserAvatar,
  saveLocalUserAvatar,
  formatApiError,
} from "@/lib/api";
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
  if (o.wallet_refunded || (s === "paid" && o.digiflazz_status === "Gagal")) {
    return "Dikonversi ke Saldo";
  }
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

const WALLET_PRESET_AMOUNTS = [20000, 50000, 100000, 250000, 500000, 1000000];

export default function Account() {
  const { user, setUser, initializing, openAuth, logout, toggleWishlist, updateProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const hasLoadedRef = useRef(false);
  const [reviewed, setReviewed] = useState({});
  const [reviewTarget, setReviewTarget] = useState(null);

  // Dynamic UI states
  const [activeTab, setActiveTab] = useState("orders"); // "orders" | "wishlist" | "security"
  const [orderStatusFilter, setOrderStatusFilter] = useState("all"); // "all" | "paid" | "pending" | "failed"
  const [orderTypeFilter, setOrderTypeFilter] = useState("all"); // "all" | "topup" | "store"
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSort, setOrderSort] = useState("newest"); // "newest" | "highest"
  const [expandedOrders, setExpandedOrders] = useState({});
  const [maskedAccess, setMaskedAccess] = useState({});
  const [copiedId, setCopiedId] = useState("");

  // Wallet balance state
  const [walletData, setWalletData] = useState({
    balance: Math.max(0, Math.round(Number(user?.balance || 0))),
  });

  // Inline / Profile editing states
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(true);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(() => resolveUserAvatar(user));

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  const userKey = user?.id || user?.email || "";

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "wallet") {
      navigate("/isi-saldo", { replace: true });
      return;
    }
    if (tabParam === "orders" || tabParam === "wishlist" || tabParam === "security") {
      setActiveTab(tabParam);
    }
  }, [searchParams, navigate]);

  const fetchAccountData = useCallback(
    async (isSilent = false) => {
      if (!userKey) {
        setLoading(false);
        return;
      }
      if (isSilent || hasLoadedRef.current) setRefreshing(true);
      else setLoading(true);

      try {
        const [o, w, r, sec, wal] = await Promise.allSettled([
          api.get("/me/orders"),
          api.get("/me/wishlist"),
          api.get("/reviews/mine"),
          api.get("/me/security"),
          api.get("/me/wallet"),
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
        if (wal.status === "fulfilled" && wal.value?.data) {
          const nextBalance = Math.max(0, Math.round(Number(wal.value.data.balance || 0)));
          setWalletData({
            balance: nextBalance,
          });
          if (typeof setUser === "function") {
            setUser((prev) =>
              prev && Number(prev.balance || 0) !== nextBalance
                ? { ...prev, balance: nextBalance }
                : prev
            );
          }
        }
        hasLoadedRef.current = true;
        if (o.status === "rejected" && w.status === "rejected") {
          toast.error("Gagal memuat data akun. Coba muat ulang halaman.");
        } else if (isSilent) {
          toast.success("Data akun & saldo berhasil diperbarui");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userKey, setUser]
  );

  useEffect(() => {
    if (!userKey) {
      hasLoadedRef.current = false;
      setLoading(false);
      return;
    }
    setNameInput((prev) => prev || user?.name || "");
    fetchAccountData(false);
  }, [userKey, fetchAccountData]);

  useEffect(() => {
    if (user) {
      setSelectedAvatar(resolveUserAvatar(user));
    }
  }, [user?.id, user?.email, user?.avatar]);

  const currentWalletBalance = useMemo(() => {
    if (typeof walletData.balance === "number") return walletData.balance;
    return Math.max(0, Math.round(Number(user?.balance || 0)));
  }, [walletData.balance, user?.balance]);

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
    const storeOrders = orders.filter(
      (o) => o.order_type !== "topup" && o.order_type !== "wallet_topup" && !o.denomination_id
    );
    const totalSpent = paidOrders
      .filter((o) => o.order_type !== "wallet_topup")
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);
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

  const handleSelectAvatar = async (avatarUrl) => {
    if (!avatarUrl) return;
    setSelectedAvatar(avatarUrl);
    saveLocalUserAvatar(user, avatarUrl);
    setSavingAvatar(true);
    try {
      await updateProfile({ name: user?.name || "Member", avatar: avatarUrl });
      toast.success("Foto profil berhasil diperbarui!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mengubah foto profil");
    } finally {
      setSavingAvatar(false);
    }
  };

  const currentAvatar = selectedAvatar || resolveUserAvatar(user);

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
            {/* Dynamic & Simple Profile Card */}
            <div
              className="bg-panel/90 backdrop-blur-md border border-line rounded-xl relative overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              data-testid="account-profile-card"
            >
              <div className={`h-1 w-full bg-gradient-to-r ${stats.tier.accentClass}`} />

              <div className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 justify-between">
                  {/* Left: Interactive Avatar & Clean Identity */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div
                      onClick={() => setAvatarPickerOpen((o) => !o)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setAvatarPickerOpen((o) => !o);
                        }
                      }}
                      title="Klik untuk mengganti foto profil"
                      className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden border-2 border-neon/60 shadow-[0_0_20px_rgba(0,240,255,0.22)] group cursor-pointer bg-void transition-all duration-300 hover:border-neon hover:shadow-[0_0_26px_rgba(0,240,255,0.45)] active:scale-95"
                    >
                      <img
                        src={imgSrc(currentAvatar)}
                        alt={user.name || "Foto Profil"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-void/65 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-0.5 text-neon">
                        <Camera size={16} />
                        <span className="text-[8px] font-mono font-bold uppercase tracking-wider">
                          Ubah
                        </span>
                      </div>
                      <span
                        className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-lime border-2 border-void shadow-[0_0_8px_rgba(163,230,53,0.9)]"
                        title="Status sesi online"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {editingName ? (
                          <form onSubmit={handleSaveProfileName} className="flex items-center gap-1.5 flex-wrap">
                            <input
                              type="text"
                              value={nameInput}
                              onChange={(e) => setNameInput(e.target.value)}
                              maxLength={64}
                              autoFocus
                              placeholder="Nama tampilan..."
                              className="bg-void border border-neon/60 rounded px-2.5 py-1 text-xs font-display font-bold text-slate-100 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={savingName}
                              className="bg-neon text-void rounded px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider hover:bg-lime transition-colors"
                            >
                              {savingName ? "..." : "Simpan"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingName(false);
                                setNameInput(user.name || "");
                              }}
                              className="border border-line rounded px-2 py-1 text-[10px] font-mono uppercase text-slate-400 hover:text-slate-200"
                            >
                              Batal
                            </button>
                          </form>
                        ) : (
                          <>
                            <div
                              className="flex items-center gap-2 text-base sm:text-xl text-slate-100 font-display font-extrabold tracking-tight"
                              data-testid="account-name"
                            >
                              <span className="truncate">{user.name || "Member"}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setNameInput(user.name || "");
                                setEditingName(true);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-neon px-1.5 py-0.5 rounded hover:bg-void/60 transition-colors"
                              title="Ubah nama tampilan"
                            >
                              <Edit3 size={11} />
                            </button>
                          </>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${stats.tier.badgeClass}`}
                        >
                          <Sparkles size={10} /> {stats.tier.name}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-400">
                        <span className="flex items-center gap-1.5 truncate" data-testid="account-email">
                          <Mail size={12} className="text-neon shrink-0" /> {user.email}
                        </span>
                        <span className="text-slate-600 hidden sm:inline">&bull;</span>
                        <span className="inline-flex items-center gap-1 text-lime text-[11px]">
                          <ShieldCheck size={12} /> Terverifikasi
                        </span>
                      </div>

                      {/* Compact Dynamic Tier Bar */}
                      <div className="flex items-center gap-2.5 pt-0.5 max-w-sm">
                        <div className="flex-1 h-1.5 bg-void/90 rounded-full border border-line/80 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.tier.progress}%` }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                            className={`h-full bg-gradient-to-r ${stats.tier.accentClass}`}
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-neon tabular-nums shrink-0">
                          {stats.tier.progress}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Simple Quick Actions */}
                  <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-line/70 shrink-0">
                    <button
                      type="button"
                      onClick={() => fetchAccountData(true)}
                      disabled={refreshing || loading}
                      data-testid="account-sync-button"
                      title="Muat ulang status pesanan & aktivitas terbaru"
                      className="inline-flex items-center justify-center gap-1.5 border border-line hover:border-neon/60 bg-void/60 text-slate-300 hover:text-neon rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-2 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={refreshing ? "animate-spin text-neon" : ""} />
                      <span>{refreshing ? "Sinkron..." : "Sinkronkan Data"}</span>
                    </button>

                    {user.role === "admin" && (
                      <Link
                        to="/admin"
                        className="inline-flex items-center gap-1.5 border border-neon/50 bg-neon/10 text-neon hover:bg-neon hover:text-void rounded-lg text-[10px] font-display font-bold uppercase tracking-wider px-3 py-2 transition-colors"
                      >
                        Admin <ArrowRight size={12} />
                      </Link>
                    )}

                    <button
                      onClick={logout}
                      data-testid="account-logout-button"
                      className="inline-flex items-center justify-center gap-1.5 border border-line hover:border-coral/60 bg-void/60 text-slate-300 hover:text-coral rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-2 transition-colors"
                    >
                      <LogOut size={12} />
                      <span className="hidden sm:inline">Keluar</span>
                    </button>
                  </div>
                </div>

                {/* Expandable 10-Photo Avatar Selector Drawer */}
                <AnimatePresence>
                  {avatarPickerOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-5 pt-4 border-t border-line/80">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neon flex items-center gap-1.5">
                            <Sparkles size={11} className="text-lime" /> Pilih Karakter Foto Profil ({PROFILE_AVATARS.length} Tersedia)
                          </p>
                          <button
                            type="button"
                            onClick={() => setAvatarPickerOpen(false)}
                            className="text-[10px] font-mono text-slate-400 hover:text-slate-200 uppercase tracking-wider"
                          >
                            Tutup
                          </button>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
                          {PROFILE_AVATARS.map((av) => {
                            const selected = currentAvatar === av.url;
                            return (
                              <button
                                key={av.id}
                                type="button"
                                onClick={() => handleSelectAvatar(av.url)}
                                data-testid={`profile-avatar-option-${av.id}`}
                                className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 active:scale-95 ${
                                  selected
                                    ? "border-neon shadow-[0_0_16px_rgba(0,240,255,0.45)] scale-[1.03]"
                                    : "border-line/80 hover:border-neon/60 opacity-80 hover:opacity-100"
                                }`}
                                title={av.name}
                              >
                                <img
                                  src={imgSrc(av.url)}
                                  alt={av.name}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                />
                                {selected && (
                                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-neon text-void grid place-items-center shadow">
                                    <Check size={10} strokeWidth={3} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Interactive KPI Summary Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3" data-testid="account-stats-grid">
              <Link
                to="/isi-saldo"
                state={{ from: "/akun" }}
                data-testid="account-kpi-wallet"
                className="text-left rounded-xl bg-panel/90 border border-line hover:border-lime/60 p-3.5 transition-all duration-200 group cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-mono text-slate-400 block">Saldo Akun</span>
                  <p
                    data-testid="account-wallet-balance"
                    className="font-display font-black text-base sm:text-lg text-lime font-mono tabular-nums truncate mt-0.5"
                  >
                    {formatIDR(currentWalletBalance)}
                  </p>
                </div>
                <span
                  data-testid="account-kpi-wallet-topup-btn"
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-lime/15 text-lime border border-lime/40 group-hover:bg-lime group-hover:text-void transition-all shrink-0"
                >
                  <PlusCircle size={11} />
                  <span>Isi</span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("orders");
                  setOrderStatusFilter("all");
                }}
                className={`text-left rounded-xl bg-panel/90 border p-3.5 transition-all duration-200 group flex items-center justify-between gap-2 ${
                  activeTab === "orders"
                    ? "border-neon/60 bg-neon/[0.04]"
                    : "border-line hover:border-neon/40"
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-mono text-slate-400 block">Pesanan</span>
                  <p className="font-display font-black text-lg sm:text-xl text-slate-100 font-mono tabular-nums mt-0.5">
                    {stats.total}
                  </p>
                </div>
                <Package size={16} className="text-neon shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("wishlist")}
                className={`text-left rounded-xl bg-panel/90 border p-3.5 transition-all duration-200 group flex items-center justify-between gap-2 ${
                  activeTab === "wishlist"
                    ? "border-coral/60 bg-coral/[0.04]"
                    : "border-line hover:border-coral/40"
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-mono text-slate-400 block">Wishlist</span>
                  <p className="font-display font-black text-lg sm:text-xl text-slate-100 font-mono tabular-nums mt-0.5">
                    {wishlist.length}
                  </p>
                </div>
                <Heart size={16} className="text-coral shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={`text-left rounded-xl bg-panel/90 border p-3.5 transition-all duration-200 group flex items-center justify-between gap-2 ${
                  activeTab === "security"
                    ? "border-neon/60 bg-neon/[0.04]"
                    : "border-line hover:border-neon/40"
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-mono text-slate-400 block">Keamanan</span>
                  <p className="font-display font-black text-lg sm:text-xl text-slate-100 font-mono tabular-nums mt-0.5">
                    {securityData.active_sessions_count || 1} Sesi
                  </p>
                </div>
                <ShieldCheck size={16} className="text-neon shrink-0" />
              </button>
            </div>

            {/* Dynamic Section Switcher Tabs */}
            <div className="bg-panel/90 border border-line rounded-xl p-1 flex items-center gap-1 overflow-x-auto">
              {[
                { id: "orders", label: "Pesanan", icon: Package, count: orders.length },
                { id: "wishlist", label: "Wishlist", icon: Heart, count: wishlist.length },
                { id: "security", label: "Keamanan", icon: Lock, count: null },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`account-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative inline-flex items-center gap-2 px-3.5 py-2 text-xs font-display font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      isActive ? "text-void" : "text-slate-300 hover:text-slate-100 hover:bg-void/50"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="accountActiveTabIndicator"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        className="absolute inset-0 bg-neon rounded-lg"
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1.5">
                      <Icon size={13} />
                      <span>{tab.label}</span>
                      {tab.count !== null && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded tabular-nums ${
                            isActive ? "bg-void/20 text-void font-bold" : "bg-void text-slate-400"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="min-h-[380px] space-y-3 py-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-20 rounded-xl bg-panel/80 border border-line animate-pulse p-5 flex items-center justify-between"
                  >
                    <div className="space-y-2 w-1/2">
                      <div className="h-4 bg-void rounded w-2/3" />
                      <div className="h-3 bg-void rounded w-1/3" />
                    </div>
                    <div className="h-6 bg-void rounded w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-h-[380px] transition-opacity duration-150">
                <AnimatePresence initial={false}>
                  {/* ORDERS SECTION */}
                  {activeTab === "orders" && (
                    <motion.section
                      key="orders"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      data-testid="account-orders-section"
                      className="space-y-3"
                    >
                      {/* Streamlined Single-Row Filter & Search Bar */}
                      {orders.length > 0 && (
                        <div className="bg-panel/90 border border-line rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-1 overflow-x-auto">
                            {[
                              { id: "all", label: "Semua", count: stats.total },
                              { id: "paid", label: "Lunas", count: stats.paidCount },
                              { id: "pending", label: "Menunggu", count: stats.pendingCount },
                              { id: "failed", label: "Gagal", count: stats.failedCount },
                            ].map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setOrderStatusFilter(f.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                                  orderStatusFilter === f.id
                                    ? "bg-neon/15 text-neon border border-neon/50 font-bold"
                                    : "bg-void/60 text-slate-400 border border-transparent hover:text-slate-200"
                                }`}
                              >
                                {f.label} <span className="opacity-70 tabular-nums">({f.count})</span>
                              </button>
                            ))}
                          </div>

                          <div className="relative w-full sm:w-64">
                            <Search
                              size={13}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                            />
                            <input
                              type="text"
                              value={orderSearch}
                              onChange={(e) => setOrderSearch(e.target.value)}
                              placeholder="Cari pesanan..."
                              className="w-full rounded-lg bg-void border border-line focus:border-neon/60 pl-8 pr-3 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                            />
                          </div>
                        </div>
                      )}

                      {orders.length === 0 ? (
                        <div
                          className="rounded-xl bg-panel/90 border border-line p-8 text-center"
                          data-testid="account-orders-empty"
                        >
                          <Package size={28} className="text-slate-600 mx-auto mb-2.5" />
                          <p className="text-xs font-mono text-slate-400">Belum ada pesanan.</p>
                          <div className="flex items-center justify-center gap-2.5 mt-4">
                            <Link
                              to="/#katalog"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-neon text-void font-display font-bold text-xs px-4 py-2 hover:bg-lime transition-colors"
                            >
                              Katalog <ArrowRight size={13} />
                            </Link>
                            <Link
                              to="/topup"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line hover:border-neon text-slate-200 hover:text-neon font-mono text-xs px-4 py-2 transition-colors"
                            >
                              Top-Up <Zap size={12} />
                            </Link>
                          </div>
                        </div>
                      ) : filteredOrders.length === 0 ? (
                        <div className="rounded-xl bg-panel/90 border border-line p-6 text-center">
                          <p className="text-xs font-mono text-slate-400">Tidak ada pesanan yang cocok.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setOrderStatusFilter("all");
                              setOrderTypeFilter("all");
                              setOrderSearch("");
                            }}
                            className="mt-2 text-xs font-mono text-neon hover:underline"
                          >
                            Reset Filter
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <AnimatePresence initial={false}>
                            {filteredOrders.map((o) => {
                              const key = o.session_id || o.order_id;
                              const orderCode = o.order_id || o.session_id;
                              const isWalletTopup = o.order_type === "wallet_topup";
                              const isTopup = o.order_type === "topup" || Boolean(o.denomination_id);
                              const isMasked = Boolean(maskedAccess[key]);
                              const destEntries =
                                o.destination && typeof o.destination === "object"
                                  ? Object.entries(o.destination).filter(([, v]) => v)
                                  : [];

                              return (
                                <motion.div
                                  key={key}
                                  layout
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  data-testid="account-order-item"
                                  className="rounded-xl bg-panel/90 border border-line hover:border-slate-700 transition-colors overflow-hidden"
                                >
                                  <div className="p-3.5 sm:p-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                      <div className="flex-1 min-w-0">
                                        {/* Clean Unboxed Metadata Line */}
                                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
                                          <span
                                            className={
                                              isWalletTopup
                                                ? "text-lime font-semibold"
                                                : isTopup
                                                ? "text-neon font-semibold"
                                                : "text-lime font-semibold"
                                            }
                                          >
                                            {isWalletTopup
                                              ? "Saldo"
                                              : isTopup
                                              ? "Top-Up"
                                              : "Akun"}
                                          </span>
                                          {o.game_name && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span className="text-slate-300">{o.game_name}</span>
                                            </>
                                          )}
                                          <span aria-hidden="true">·</span>
                                          <button
                                            type="button"
                                            onClick={() => handleCopy(orderCode, "Kode pesanan")}
                                            className="inline-flex items-center gap-1 text-slate-400 hover:text-neon transition-colors tabular-nums"
                                            title="Salin kode pesanan"
                                          >
                                            #{orderCode}
                                            {copiedId === String(orderCode) ? (
                                              <Check size={10} className="text-lime" />
                                            ) : (
                                              <Copy size={10} />
                                            )}
                                          </button>
                                          <span aria-hidden="true">·</span>
                                          <span className="text-slate-500 tabular-nums">{fmtDate(o.created_at)}</span>
                                        </div>

                                        {/* Product Title & Target ID */}
                                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mt-0.5">
                                          <p className="text-sm font-display font-bold text-slate-100 truncate">
                                            {o.product_title || "Produk"}
                                          </p>
                                          {destEntries.length > 0 && (
                                            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                              ({destEntries.map(([, v]) => String(v)).join(" / ")})
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right: Amount, Status & Quick Actions */}
                                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0 border-t sm:border-t-0 border-line/70 pt-2.5 sm:pt-0">
                                        <span className="text-sm sm:text-base font-display font-black text-neon font-mono tabular-nums">
                                          {formatIDR(o.amount)}
                                        </span>

                                        <span
                                          data-testid="account-order-status"
                                          className={`inline-flex items-center gap-1 rounded-md text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${statusStyle(
                                            o
                                          )}`}
                                        >
                                          {statusLabel(o)}
                                        </span>

                                        {o.provider === "manual" && o.payment_status === "pending" ? (
                                          <Link
                                            to={`/payment/success?session_id=${o.session_id}`}
                                            data-testid="account-order-continue"
                                            className="inline-flex items-center gap-1 rounded-lg text-[11px] font-bold text-neon border border-neon/40 hover:bg-neon/10 px-2.5 py-1 transition-colors"
                                          >
                                            {o.status === "waiting_approval" ? "Status" : "Bayar"}
                                            <ArrowRight size={11} />
                                          </Link>
                                        ) : (
                                          <Link
                                            to={`/payment/success?session_id=${o.session_id}`}
                                            className="inline-flex items-center gap-1 rounded-lg text-[11px] font-mono text-slate-400 hover:text-neon border border-line px-2 py-1 transition-colors"
                                            title="Buka Invoice"
                                          >
                                            <span>Invoice</span>
                                            <ExternalLink size={11} />
                                          </Link>
                                        )}

                                        {o.payment_status === "paid" && !isWalletTopup && (
                                          <div data-testid="account-order-review" className="inline-flex">
                                            {reviewed[o.session_id] ? (
                                              <span
                                                data-testid="account-order-reviewed"
                                                className="inline-flex items-center gap-1 rounded-lg text-[11px] font-mono text-lime border border-lime/30 bg-lime/5 px-2 py-1"
                                              >
                                                <Star size={10} fill="currentColor" /> {reviewed[o.session_id].rating}/5
                                              </span>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => setReviewTarget(o)}
                                                data-testid="account-order-review-button"
                                                className="inline-flex items-center gap-1 rounded-lg text-[11px] font-bold text-void bg-lime hover:bg-neon px-2.5 py-1 transition-colors"
                                              >
                                                <Star size={10} /> Ulas
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Delivery Credentials / Access Box */}
                                    {o.payment_status === "paid" && o.delivery_info && (
                                      <div
                                        className="mt-2.5 rounded-lg bg-lime/5 border border-lime/25 px-3 py-2"
                                        data-testid="account-order-access"
                                      >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-lime">
                                            <KeyRound size={11} /> Data Akses
                                          </span>
                                          <div className="flex items-center gap-2.5">
                                            <button
                                              type="button"
                                              onClick={() => toggleMaskAccess(key)}
                                              className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-200"
                                            >
                                              {isMasked ? <Eye size={11} /> : <EyeOff size={11} />}
                                              {isMasked ? "Tampilkan" : "Samarkan"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleCopy(o.delivery_info, "Data akses akun")}
                                              className="inline-flex items-center gap-1 text-[10px] font-mono text-lime hover:underline"
                                            >
                                              <Copy size={11} /> Salin
                                            </button>
                                          </div>
                                        </div>
                                        <p
                                          className={`text-xs font-mono text-slate-100 whitespace-pre-wrap break-words leading-relaxed transition-all ${
                                            isMasked ? "blur-sm select-none" : ""
                                          }`}
                                        >
                                          {linkify(o.delivery_info)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.section>
                  )}

                  {/* WISHLIST SECTION */}
                  {activeTab === "wishlist" && (
                    <motion.section
                      key="wishlist"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      data-testid="account-wishlist-section"
                      className="space-y-4"
                    >
                      {wishlist.length === 0 ? (
                        <div
                          className="rounded-xl bg-panel/90 border border-line p-8 sm:p-10 text-center"
                          data-testid="account-wishlist-empty"
                        >
                          <Heart size={28} className="text-slate-600 mx-auto mb-2.5" />
                          <p className="text-xs font-mono text-slate-400">
                            Wishlist kamu masih kosong. Simpan akun incaranmu dari katalog agar mudah dipantau!
                          </p>
                          <Link
                            to="/#katalog"
                            className="inline-flex items-center gap-1.5 mt-4 rounded-lg bg-neon text-void font-display font-bold text-xs px-5 py-2.5 hover:bg-lime transition-colors"
                          >
                            Jelajahi Katalog <ArrowRight size={13} />
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
                              className="rounded-xl bg-panel/90 border border-line hover:border-neon/50 overflow-hidden group relative flex flex-col transition-colors"
                            >
                              <button
                                onClick={() =>
                                  toggleWishlist(p.id).then(() =>
                                    setWishlist((w) => w.filter((x) => x.id !== p.id))
                                  )
                                }
                                data-testid="account-wishlist-remove"
                                aria-label="Hapus dari wishlist"
                                className="absolute top-2.5 right-2.5 z-10 grid place-items-center w-8 h-8 rounded-lg bg-void/85 border border-line text-coral hover:border-coral hover:bg-void transition-colors"
                                title="Hapus dari Wishlist"
                              >
                                <Heart size={14} className="fill-coral" />
                              </button>

                              <div className="aspect-video overflow-hidden bg-void relative">
                                <img
                                  src={imgSrc(p.image)}
                                  alt={p.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              </div>

                              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-mono text-slate-400">
                                    {p.game} · {p.category || "Akun Game"}
                                  </p>
                                  <p className="text-sm font-display font-bold text-slate-100 truncate mt-0.5">
                                    {p.title}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between pt-2.5 border-t border-line">
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
                                    className="inline-flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-lime transition-colors"
                                  >
                                    Lihat <ArrowRight size={12} />
                                  </Link>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </motion.section>
                  )}

                  {/* SECURITY & PASSWORD SECTION */}
                  {activeTab === "security" && (
                    <motion.section
                      key="security"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      data-testid="account-security-section"
                      className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
                    >
                      {/* Left Column: Ubah Kata Sandi */}
                      <div className="lg:col-span-7 rounded-xl bg-panel/90 border border-line p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-line">
                          <div>
                            <h2 className="flex items-center gap-2 font-display font-bold text-base text-slate-100">
                              <KeyRound size={17} className="text-neon" /> Ubah Kata Sandi
                            </h2>
                            <p className="text-xs font-mono text-slate-400 mt-1">
                              {securityData.password_changed_at
                                ? `Terakhir diperbarui pada ${fmtDate(securityData.password_changed_at)}`
                                : "Gunakan kombinasi huruf dan angka minimal 6 karakter"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowPasswords((v) => !v)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-void/70 hover:border-neon/40 px-3 py-1.5 text-[11px] font-mono text-slate-300 transition-colors shrink-0"
                          >
                            {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                            {showPasswords ? "Sembunyikan" : "Lihat Sandi"}
                          </button>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                          <div>
                            <label className="block text-xs font-mono text-slate-300 mb-1.5">
                              Kata Sandi Saat Ini
                            </label>
                            <input
                              type={showPasswords ? "text" : "password"}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              data-testid="account-current-password"
                              placeholder="Masukkan kata sandi saat ini"
                              className="w-full rounded-lg bg-void border border-line focus:border-neon px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-mono text-slate-300 mb-1.5">
                                Kata Sandi Baru
                              </label>
                              <input
                                type={showPasswords ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                data-testid="account-new-password"
                                placeholder="Minimal 6 karakter"
                                className="w-full rounded-lg bg-void border border-line focus:border-neon px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-mono text-slate-300">
                                  Konfirmasi Sandi Baru
                                </label>
                                {confirmPassword && (
                                  <span
                                    className={`text-[10px] font-mono ${
                                      confirmPassword === newPassword ? "text-lime" : "text-coral"
                                    }`}
                                  >
                                    {confirmPassword === newPassword ? "Cocok" : "Belum cocok"}
                                  </span>
                                )}
                              </div>
                              <input
                                type={showPasswords ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                data-testid="account-confirm-password"
                                placeholder="Ulangi kata sandi baru"
                                className="w-full rounded-lg bg-void border border-line focus:border-neon px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                              />
                            </div>
                          </div>

                          {/* Dynamic Password Strength Indicator */}
                          {newPassword.length > 0 && (
                            <div className="rounded-lg bg-void/60 border border-line p-3 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-slate-400">Kekuatan Kata Sandi</span>
                                <span
                                  className={
                                    newPassword.length >= 8 &&
                                    /[A-Za-z]/.test(newPassword) &&
                                    /\d/.test(newPassword)
                                      ? "text-lime font-bold"
                                      : newPassword.length >= 6
                                      ? "text-neon font-bold"
                                      : "text-coral font-bold"
                                  }
                                >
                                  {newPassword.length >= 8 &&
                                  /[A-Za-z]/.test(newPassword) &&
                                  /\d/.test(newPassword)
                                    ? "Kuat"
                                    : newPassword.length >= 6
                                    ? "Sedang"
                                    : "Terlalu Pendek"}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <div
                                  className={`h-1 rounded-full transition-colors ${
                                    newPassword.length >= 6 ? "bg-neon" : "bg-coral/60"
                                  }`}
                                />
                                <div
                                  className={`h-1 rounded-full transition-colors ${
                                    newPassword.length >= 8 && /\d/.test(newPassword)
                                      ? "bg-neon"
                                      : "bg-line"
                                  }`}
                                />
                                <div
                                  className={`h-1 rounded-full transition-colors ${
                                    newPassword.length >= 8 &&
                                    /[A-Za-z]/.test(newPassword) &&
                                    /\d/.test(newPassword)
                                      ? "bg-lime"
                                      : "bg-line"
                                  }`}
                                />
                              </div>
                            </div>
                          )}

                          <div className="pt-2 flex items-center justify-end">
                            <button
                              type="submit"
                              disabled={savingPassword}
                              data-testid="account-save-password"
                              className="inline-flex items-center gap-2 rounded-lg bg-neon text-void font-display font-bold text-xs px-5 py-2.5 hover:bg-lime transition-colors disabled:opacity-50"
                            >
                              {savingPassword ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" /> Menyimpan...
                                </>
                              ) : (
                                <>
                                  <Lock size={14} /> Simpan Kata Sandi
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Right Column: Sesi Perangkat & Log Keamanan */}
                      <div className="lg:col-span-5 space-y-5">
                        {/* Active Sessions Control */}
                        <div className="rounded-xl bg-panel/90 border border-line p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="flex items-center gap-2 font-display font-bold text-sm text-slate-100">
                                <ShieldCheck size={16} className="text-lime" /> Sesi Perangkat Aktif
                              </h3>
                              <p className="text-xs font-mono text-slate-400 mt-1">
                                Saat ini terdapat{" "}
                                <strong className="text-slate-100 tabular-nums">
                                  {securityData.active_sessions_count || 1} sesi
                                </strong>{" "}
                                yang terhubung ke akun Anda.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3">
                            <span className="text-[11px] font-mono text-slate-500">
                              Curiga ada akses perangkat lain?
                            </span>
                            <button
                              type="button"
                              onClick={handleLogoutAllSessions}
                              disabled={revokingSessions}
                              data-testid="account-logout-all-button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-coral/40 bg-coral/10 hover:bg-coral/20 text-coral px-3.5 py-2 text-xs font-mono font-semibold transition-colors disabled:opacity-50 shrink-0"
                            >
                              {revokingSessions ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <LogOut size={13} />
                              )}
                              Keluar Semua Sesi
                            </button>
                          </div>
                        </div>

                        {/* Recent Security Logs */}
                        <div className="rounded-xl bg-panel/90 border border-line p-5">
                          <h3 className="flex items-center gap-2 font-display font-bold text-sm text-slate-100 mb-3">
                            <Activity size={15} className="text-neon" /> Log Keamanan Terkini
                          </h3>

                          {Array.isArray(securityData.audit_logs) &&
                          securityData.audit_logs.length > 0 ? (
                            <div className="divide-y divide-line">
                              {securityData.audit_logs.slice(0, 5).map((log, idx) => (
                                <div
                                  key={log.id || idx}
                                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs font-mono"
                                >
                                  <span className="text-slate-200 truncate">
                                    {formatAuditAction(log.action)}
                                  </span>
                                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                                    {fmtDate(log.created_at)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs font-mono text-slate-500">
                              Belum ada riwayat perubahan keamanan terbaru.
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>
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
