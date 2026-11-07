import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  UserCheck,
  Info,
  QrCode,
  Wallet,
  Landmark,
  Store,
  Sparkles,
  Mail,
  Phone,
  Clock,
  HelpCircle,
  Gamepad2,
  PackageOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DEFAULT_DUITKU_CHANNELS } from "@/components/topup/TopupPaymentStep";
import { api, formatApiError, formatIDR, imgSrc } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTopupGames, validateTopupDestination, localFieldError } from "@/hooks/useTopup";

const slugifyId = (v) =>
  String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const PAYMENT_GROUPS = [
  {
    id: "qris",
    title: "QRIS (Scan Semua E-Wallet & M-Banking)",
    subtitle: "Proses otomatis instan begitu scan QRIS selesai",
    badge: "Rekomendasi",
    icon: QrCode,
  },
  {
    id: "ewallet",
    title: "E-Wallet Instan",
    subtitle: "DANA, OVO, ShopeePay, & LinkAja",
    badge: "Instan",
    icon: Wallet,
  },
  {
    id: "va",
    title: "Virtual Account Bank (24 Jam)",
    subtitle: "BCA, Mandiri, BNI, BRI, BSI, CIMB, Permata, Maybank, BNC",
    badge: "Cek Otomatis",
    icon: Landmark,
  },
  {
    id: "retail",
    title: "Minimarket / Gerai Retail",
    subtitle: "Indomaret & Alfamart Group",
    badge: "Tunai",
    icon: Store,
  },
];

export default function TopupGameDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { games, loading, error, reload } = useTopupGames();

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const [validation, setValidation] = useState(null);
  const [denomination, setDenomination] = useState(null);
  const [denomFilter, setDenomFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [email, setEmail] = useState("");
  const [wa, setWa] = useState("");
  const [duitkuChannels, setDuitkuChannels] = useState(DEFAULT_DUITKU_CHANNELS);
  const [duitkuChannel, setDuitkuChannel] = useState("SP");
  const [submitting, setSubmitting] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const game = useMemo(
    () => games.find((g) => String(g.slug || "").toLowerCase() === String(slug || "").toLowerCase()) || null,
    [games, slug]
  );

  // Reset form state when switching games
  useEffect(() => {
    setValues({});
    setErrors({});
    setValidation(null);
    setDenomination(null);
    setSummaryError("");
  }, [slug]);

  useEffect(() => {
    if (user?.email) setEmail((cur) => cur || user.email);
  }, [user?.email]);

  const productId = useMemo(
    () => (game && denomination ? `tp-${slugifyId(game.slug)}-${slugifyId(denomination.code)}` : ""),
    [game, denomination]
  );

  useEffect(() => {
    if (!game) return;
    let alive = true;
    api
      .get("/payments/methods", { params: { product_id: productId || undefined, scope: "topup" } })
      .then((res) => {
        if (!alive) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        const duitkuItem =
          rows.find((x) => x.id === "duitku" || x.gateway_id === "duitku" || x.id === "paykita") ||
          rows[0];
        const channels =
          Array.isArray(duitkuItem?.duitku_channels) && duitkuItem.duitku_channels.length > 0
            ? duitkuItem.duitku_channels
            : DEFAULT_DUITKU_CHANNELS;
        setDuitkuChannels(channels);
        const defaultCode = duitkuItem?.default_channel || channels[0]?.code || "SP";
        setDuitkuChannel((cur) => (channels.some((c) => c.code === cur) ? cur : defaultCode));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [game, productId]);

  const denoms = useMemo(() => game?.denominations || [], [game]);
  const hasPromo = useMemo(
    () => denoms.some((d) => d.badge || (d.price_strike && d.price_strike > d.price)),
    [denoms]
  );
  const visibleDenoms = useMemo(() => {
    if (denomFilter === "promo") {
      return denoms.filter((d) => d.badge || (d.price_strike && d.price_strike > d.price));
    }
    return denoms;
  }, [denoms, denomFilter]);

  const channels = useMemo(
    () =>
      Array.isArray(duitkuChannels) && duitkuChannels.length > 0
        ? duitkuChannels
        : DEFAULT_DUITKU_CHANNELS,
    [duitkuChannels]
  );

  const selectedChannelObj = useMemo(
    () =>
      channels.find((c) => c.code === duitkuChannel) ||
      channels[0] ||
      DEFAULT_DUITKU_CHANNELS[0],
    [channels, duitkuChannel]
  );

  const groupedPaymentSections = useMemo(() => {
    return PAYMENT_GROUPS.filter((g) => paymentFilter === "all" || paymentFilter === g.id)
      .map((g) => ({
        ...g,
        items: channels.filter((c) => c.category === g.id),
      }))
      .filter((g) => g.items.length > 0);
  }, [channels, paymentFilter]);

  const accountErrors = useCallback(
    () =>
      Object.fromEntries(
        (game?.fields || [])
          .map((f) => [f.key, localFieldError(f, values[f.key])])
          .filter(([, msg]) => msg)
      ),
    [game, values]
  );

  const changeField = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setValidation(null);
  };

  const runValidate = async () => {
    const found = accountErrors();
    setErrors(found);
    if (Object.keys(found).length) {
      setValidation({ ok: false, checked: false, message: Object.values(found)[0] });
      toast.error(Object.values(found)[0]);
      return false;
    }
    setChecking(true);
    try {
      const result = await validateTopupDestination(game.slug, values);
      setValidation(result);
      if (!result.ok) {
        toast.error(result.message || "Data akun tujuan tidak valid");
        return false;
      }
      if (result.checked) toast.success(`Akun ditemukan: ${result.nickname || "Terverifikasi"}`);
      return true;
    } finally {
      setChecking(false);
    }
  };

  const destinationLabel = useMemo(
    () =>
      (game?.fields || [])
        .map((f) => (values[f.key] ? `${f.label}: ${values[f.key]}` : ""))
        .filter(Boolean)
        .join(" • "),
    [game, values]
  );

  const submitCheckout = async () => {
    setSummaryError("");
    if (!game) return;

    // 1. Validate Account ID fields
    const foundErrors = accountErrors();
    setErrors(foundErrors);
    if (Object.keys(foundErrors).length > 0) {
      const firstErr = Object.values(foundErrors)[0];
      setSummaryError(firstErr);
      toast.error(firstErr);
      const firstFieldEl = document.getElementById("codashop-step-1");
      firstFieldEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // 2. Validate Denomination
    if (!denomination) {
      const msg = "Pilih paket nominal top up terlebih dahulu pada langkah 2.";
      setSummaryError(msg);
      toast.error(msg);
      const step2El = document.getElementById("codashop-step-2");
      step2El?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // 3. Validate Payment Channel
    if (!duitkuChannel) {
      const msg = "Pilih metode pembayaran terlebih dahulu pada langkah 3.";
      setSummaryError(msg);
      toast.error(msg);
      return;
    }

    // 4. Validate Buyer Email
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = "Wajib memasukkan alamat email aktif pada langkah 4 untuk pengiriman bukti & invoice Top Up.";
      setSummaryError(msg);
      toast.error(msg);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const msg = "Format alamat email tidak valid (contoh: nama@gmail.com).";
      setSummaryError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      // Auto-verify ID if not verified yet
      let verifiedNick = validation?.nickname || "";
      if (!validation?.ok) {
        const vRes = await validateTopupDestination(game.slug, values);
        setValidation(vRes);
        if (!vRes.ok) {
          setSummaryError(vRes.message || "Data ID tujuan tidak valid");
          toast.error(vRes.message || "Data ID tujuan tidak valid");
          setSubmitting(false);
          return;
        }
        verifiedNick = vRes.nickname || "";
      }

      const payload = {
        game: game.slug,
        denomination_code: denomination.code,
        product_id: productId,
        destination: values,
        verified_nickname: verifiedNick,
        buyer_email: cleanEmail,
        buyer_whatsapp: wa.trim(),
        method: "duitku",
        duitku_channel: duitkuChannel,
        payment_method: duitkuChannel,
        origin_url: window.location.origin,
      };
      const { data } = await api.post("/payments/topup/checkout", payload);
      window.location.href = data.checkout_url;
    } catch (e) {
      const message =
        formatApiError(e.response?.data?.detail) ||
        (e.response ? "Gagal membuat pesanan top up" : "Tidak dapat terhubung ke server. Coba lagi.");
      setSummaryError(message);
      toast.error(message);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-void grid-bg relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[460px] h-[460px] bg-neon/5 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-lime/5 rounded-full blur-[130px]" />
      </div>

      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-28 sm:pt-28 sm:pb-32">
        {/* Top Breadcrumb & Back to Games Directory */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Link
              to="/topup"
              data-testid="topup-back-to-catalog"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel/80 px-3.5 py-2 text-slate-200 hover:text-neon hover:border-neon/60 transition-colors"
            >
              <ArrowLeft size={13} />
              <span>{t("Semua Game Top Up", "All Top Up Games")}</span>
            </Link>
            {game && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-neon font-bold truncate max-w-[200px] sm:max-w-xs">
                  {game.name}
                </span>
              </>
            )}
          </div>

          <div className="inline-flex items-center gap-2 text-[11px] font-mono text-lime bg-lime/10 border border-lime/30 rounded-xl px-3 py-1.5">
            <Zap size={12} className="shrink-0" />
            <span>Proses Otomatis 24 Jam &bull; Resmi &amp; Aman</span>
          </div>
        </div>

        {loading && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 h-96 rounded-2xl bg-panel/70 border border-line animate-pulse" />
            <div className="lg:col-span-8 space-y-5">
              <div className="h-44 rounded-2xl bg-panel/70 border border-line animate-pulse" />
              <div className="h-64 rounded-2xl bg-panel/70 border border-line animate-pulse" />
              <div className="h-64 rounded-2xl bg-panel/70 border border-line animate-pulse" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-coral/40 bg-coral/5 p-8 text-center">
            <p className="text-sm font-mono text-coral">Gagal memuat halaman game top up.</p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 rounded-xl bg-neon text-void font-display font-bold text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-lime transition-colors cursor-pointer"
            >
              Muat Ulang
            </button>
          </div>
        )}

        {!loading && !error && !game && (
          <div className="rounded-2xl border border-line bg-panel/90 p-10 text-center space-y-4">
            <Gamepad2 size={36} className="mx-auto text-slate-500" />
            <h1 className="font-display font-bold text-lg text-slate-100">
              Game Tidak Ditemukan
            </h1>
            <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
              Game yang Anda cari tidak tersedia atau telah dinonaktifkan. Silakan pilih game lainnya dari katalog Top Up.
            </p>
            <Link
              to="/topup"
              className="inline-flex items-center gap-2 rounded-xl bg-neon text-void font-display font-bold text-xs uppercase tracking-wider px-5 py-3 hover:bg-lime transition-colors"
            >
              <ArrowLeft size={14} /> Kembali ke Daftar Game
            </Link>
          </div>
        )}

        {!loading && !error && game && (
          <div
            data-testid={`codashop-game-page-${game.slug}`}
            className="grid lg:grid-cols-12 gap-6 lg:gap-7 items-start"
          >
            {/* ==================== LEFT COLUMN: CODASHOP GAME INFO & GUIDE ==================== */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-5">
              <div className="rounded-2xl border border-line bg-panel/95 overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
                {/* Banner + 3D Game Icon Header */}
                <div className="relative h-36 sm:h-40 overflow-hidden bg-void">
                  <img
                    src={imgSrc(game.banner || game.icon)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover scale-110 blur-sm opacity-45"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/60 to-transparent" />

                  <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3.5">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-neon shadow-[0_0_25px_rgba(0,240,255,0.28)] bg-void shrink-0">
                      <img
                        src={imgSrc(game.icon || game.banner)}
                        alt={game.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 pb-0.5">
                      <span className="inline-block text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-neon/15 text-neon border border-neon/40 mb-1">
                        {game.publisher || "Official Publisher"}
                      </span>
                      <h1 className="font-display font-black text-base sm:text-lg text-slate-100 leading-tight truncate">
                        {game.name}
                      </h1>
                    </div>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="px-4 pt-3 pb-4 border-b border-line/70 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-lime bg-lime/10 border border-lime/30 rounded-lg px-2 py-1">
                    <Zap size={11} /> Proses 1-5 Detik
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neon bg-neon/10 border border-neon/30 rounded-lg px-2 py-1">
                    <ShieldCheck size={11} /> 100% Resmi &amp; Legal
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-300 bg-void/80 border border-line rounded-lg px-2 py-1">
                    <Clock size={11} /> Layanan 24/7
                  </span>
                </div>

                {/* Game Description & Step-by-step How-To */}
                <div className="p-4 sm:p-5 space-y-4 text-xs font-mono">
                  <div>
                    <p className="text-slate-300 leading-relaxed">
                      Top up <strong className="text-neon">{game.currency || "Item"} {game.name}</strong> resmi paling praktis dan murah. Cukup masukkan ID akun Anda, pilih nominal, dan selesaikan pembayaran — item langsung ditambahkan ke akun {game.name} Anda secara instan!
                    </p>
                  </div>

                  <div className="rounded-xl border border-line bg-void/70 p-3.5 space-y-2.5">
                    <p className="font-display font-bold text-xs uppercase tracking-wider text-neon flex items-center gap-1.5">
                      <HelpCircle size={13} /> Cara Top Up {game.name}
                    </p>
                    <ol className="space-y-1.5 text-[11px] text-slate-300 list-decimal list-inside">
                      <li>
                        Masukkan{" "}
                        <span className="text-slate-100 font-semibold">
                          {(game.fields || []).map((f) => f.label).join(" & ") || "User ID"}
                        </span>{" "}
                        akun Anda pada kolom <strong className="text-neon">Langkah 1</strong>.
                      </li>
                      <li>
                        Pilih paket nominal <span className="text-slate-100 font-semibold">{game.currency || "Top Up"}</span> yang Anda inginkan pada <strong className="text-neon">Langkah 2</strong>.
                      </li>
                      <li>
                        Pilih metode pembayaran yang paling mudah bagi Anda pada <strong className="text-neon">Langkah 3</strong>.
                      </li>
                      <li>
                        Masukkan alamat <span className="text-slate-100 font-semibold">Email aktif</span> pada <strong className="text-neon">Langkah 4</strong> lalu klik <span className="text-lime font-bold">Beli Sekarang</span>.
                      </li>
                    </ol>
                  </div>

                  {game.notes && (
                    <div className="flex items-start gap-2 rounded-xl bg-neon/5 border border-neon/25 p-3 text-[11px] text-slate-300">
                      <Info size={13} className="text-neon shrink-0 mt-0.5" />
                      <span>{game.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* ==================== RIGHT COLUMN: CODASHOP STEPS 1 - 2 - 3 - 4 ==================== */}
            <div className="lg:col-span-8 space-y-5">
              {/* -------------------- STEP 1: MASUKKAN USER ID -------------------- */}
              <section
                id="codashop-step-1"
                data-testid="topup-account-form"
                className="rounded-2xl border border-line bg-panel/95 p-5 sm:p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-line/80">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-neon text-void font-display font-black text-sm grid place-items-center shadow-[0_0_16px_rgba(0,240,255,0.35)] shrink-0">
                      1
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-sm sm:text-base text-slate-100">
                        Masukkan {(game.fields || []).map((f) => f.label).join(" & ") || "ID Akun Game"}
                      </h2>
                      <p className="text-[11px] font-mono text-slate-400">
                        Pastikan data ID tujuan sesuai dengan profil di dalam game {game.name}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={runValidate}
                    disabled={checking}
                    data-testid="topup-validate-button"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neon/60 bg-neon/15 text-neon font-display font-bold text-[11px] uppercase tracking-wider px-4 py-2 hover:bg-neon hover:text-void transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {checking ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                    <span>{checking ? "Memeriksa ID..." : "Cek ID / Nickname"}</span>
                  </button>
                </div>

                <div
                  className={`grid gap-3.5 sm:gap-4 ${
                    (game.fields || []).length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {(game.fields || []).map((field) => {
                    const err = errors?.[field.key];
                    const inputId = `topup-field-${field.key}`;
                    const hasOptions = Array.isArray(field.options) && field.options.length > 0;
                    return (
                      <div key={field.key} className="space-y-1.5">
                        <label
                          htmlFor={inputId}
                          className="block text-[11px] font-mono uppercase tracking-wider text-slate-300"
                        >
                          {field.label}
                          {field.required === false ? (
                            <span className="text-slate-500 normal-case"> (opsional)</span>
                          ) : (
                            <span className="text-neon ml-1">*</span>
                          )}
                        </label>

                        {hasOptions ? (
                          <select
                            id={inputId}
                            data-testid={`topup-input-${field.key}`}
                            value={values[field.key] ?? ""}
                            onChange={(e) => changeField(field.key, e.target.value)}
                            className={`w-full rounded-xl bg-void border px-3.5 py-3 text-sm font-mono text-slate-100 focus:outline-none transition-all ${
                              err ? "border-coral" : "border-line focus:border-neon"
                            }`}
                          >
                            <option value="">{field.placeholder || `Pilih ${field.label}...`}</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={inputId}
                            data-testid={`topup-input-${field.key}`}
                            value={values[field.key] ?? ""}
                            onChange={(e) => changeField(field.key, e.target.value)}
                            inputMode={field.inputmode || "text"}
                            placeholder={field.placeholder || `Masukkan ${field.label}...`}
                            className={`w-full rounded-xl bg-void border px-3.5 py-3 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all ${
                              err ? "border-coral" : "border-line focus:border-neon"
                            }`}
                          />
                        )}

                        {err ? (
                          <p
                            data-testid={`topup-error-${field.key}`}
                            className="flex items-start gap-1.5 text-[11px] font-mono text-coral"
                          >
                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                            <span>{err}</span>
                          </p>
                        ) : (
                          field.help && (
                            <p className="text-[11px] font-mono text-slate-500">{field.help}</p>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Nickname Verification Status */}
                <AnimatePresence mode="wait">
                  {validation?.ok && validation.checked && (
                    <motion.div
                      key="ok"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      data-testid="topup-validate-ok"
                      className="mt-4 rounded-xl bg-lime/10 border border-lime/40 px-4 py-3 text-xs font-mono text-lime flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 font-bold">
                        <span className="w-5 h-5 rounded-full bg-lime text-void grid place-items-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span>Nickname: {validation.nickname || "Akun Terverifikasi"}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-void/70 border border-lime/40">
                        ID Valid
                      </span>
                    </motion.div>
                  )}
                  {validation && !validation.ok && (
                    <motion.div
                      key="fail"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      data-testid="topup-validate-fail"
                      className="mt-4 flex items-center gap-2 rounded-xl bg-coral/10 border border-coral/40 px-3.5 py-2.5 text-xs font-mono text-coral"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{validation.message}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* -------------------- STEP 2: PILIH NOMINAL TOP UP -------------------- */}
              <section
                id="codashop-step-2"
                className="rounded-2xl border border-line bg-panel/95 p-5 sm:p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-line/80">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-neon text-void font-display font-black text-sm grid place-items-center shadow-[0_0_16px_rgba(0,240,255,0.35)] shrink-0">
                      2
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-sm sm:text-base text-slate-100">
                        Pilih Nominal {game.currency ? `(${game.currency})` : "Top Up"}
                      </h2>
                      <p className="text-[11px] font-mono text-slate-400">
                        {denoms.length > 0
                          ? `Tersedia ${denoms.length} pilihan nominal resmi untuk ${game.name}`
                          : `Daftar nominal untuk ${game.name}`}
                      </p>
                    </div>
                  </div>

                  {hasPromo && denoms.length > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-xl bg-void border border-line p-1">
                      {[
                        { id: "all", label: "Semua Item" },
                        { id: "promo", label: "Promo / Populer" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDenomFilter(tab.id)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-display font-bold transition-colors cursor-pointer ${
                            denomFilter === tab.id
                              ? "bg-neon text-void"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {denoms.length === 0 ? (
                  <div
                    data-testid="topup-denom-empty"
                    className="rounded-2xl border border-dashed border-line bg-void/60 p-8 sm:p-10 text-center space-y-3"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-neon/10 border border-neon/30 text-neon grid place-items-center mx-auto">
                      <PackageOpen size={24} />
                    </div>
                    <h3 className="font-display font-bold text-sm sm:text-base text-slate-100">
                      Nominal Top Up {game.name} Belum Tersedia
                    </h3>
                    <p className="text-xs font-mono text-slate-400 max-w-md mx-auto leading-relaxed">
                      Produk dan SKU untuk <strong className="text-slate-200">{game.name}</strong> saat ini belum ditambahkan atau sedang disinkronkan oleh Admin dari Digiflazz.
                    </p>
                  </div>
                ) : (
                  <div
                    data-testid="topup-denom-grid"
                    className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                  >
                    {visibleDenoms.map((d) => {
                      const soldOut = (d.stock ?? 1) < 1;
                      const selected = denomination?.code === d.code;
                      const hasDiscount = d.price_strike && d.price_strike > d.price;
                      return (
                        <button
                          key={d.code}
                          type="button"
                          disabled={soldOut}
                          onClick={() => {
                            if (!soldOut) {
                              setDenomination(d);
                              setSummaryError("");
                            }
                          }}
                          data-testid={`topup-denom-${d.code}`}
                          aria-pressed={selected}
                          className={`group relative flex flex-col justify-between text-left rounded-xl p-3.5 sm:p-4 border transition-all duration-200 min-h-[108px] overflow-hidden ${
                            soldOut
                              ? "border-line/40 bg-void/40 opacity-50 cursor-not-allowed"
                              : selected
                                ? "border-neon bg-neon/10 shadow-[0_0_24px_rgba(0,240,255,0.2)] ring-1 ring-neon/50 cursor-pointer"
                                : "border-line bg-void/80 hover:border-neon/60 hover:bg-void cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-display font-bold text-xs sm:text-[13px] text-slate-100 leading-snug">
                              {d.label}
                            </span>
                            {selected ? (
                              <span className="w-5 h-5 rounded-full bg-neon text-void grid place-items-center shrink-0">
                                <Check size={11} strokeWidth={3} />
                              </span>
                            ) : (
                              d.badge &&
                              !soldOut && (
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-lime text-void shrink-0">
                                  {d.badge}
                                </span>
                              )
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-line/60 flex items-end justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-mono text-slate-400">Harga</p>
                              <p className="font-mono font-extrabold text-xs sm:text-sm text-neon tabular-nums">
                                {formatIDR(d.price)}
                              </p>
                            </div>
                            {hasDiscount && (
                              <span className="font-mono text-[10px] text-slate-500 line-through tabular-nums">
                                {formatIDR(d.price_strike)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* -------------------- STEP 3: PILIH PEMBAYARAN -------------------- */}
              <section
                id="codashop-step-3"
                data-testid="topup-payment-step"
                className="rounded-2xl border border-line bg-panel/95 p-5 sm:p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-line/80">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-neon text-void font-display font-black text-sm grid place-items-center shadow-[0_0_16px_rgba(0,240,255,0.35)] shrink-0">
                      3
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-sm sm:text-base text-slate-100">
                        Pilih Metode Pembayaran
                      </h2>
                      <p className="text-[11px] font-mono text-slate-400">
                        Verifikasi pembayaran otomatis 24 jam via QRIS, E-Wallet, Virtual Account &amp; Retail
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4">
                  {[
                    { id: "all", label: "Semua", icon: Sparkles },
                    { id: "qris", label: "QRIS", icon: QrCode },
                    { id: "ewallet", label: "E-Wallet", icon: Wallet },
                    { id: "va", label: "Virtual Account", icon: Landmark },
                    { id: "retail", label: "Minimarket", icon: Store },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = paymentFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPaymentFilter(tab.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider border transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? "bg-neon text-void border-neon"
                            : "bg-void/70 text-slate-400 border-line hover:text-slate-200"
                        }`}
                      >
                        <Icon size={12} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Payment Channel Cards with Live Price Preview (Codashop style) */}
                <div className="space-y-4">
                  {groupedPaymentSections.map((group) => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={group.id} className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GroupIcon size={14} className="text-neon" />
                            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-200">
                              {group.title}
                            </h3>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {group.badge}
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-2.5">
                          {group.items.map((ch) => {
                            const selected = duitkuChannel === ch.code;
                            return (
                              <button
                                key={ch.code}
                                type="button"
                                onClick={() => setDuitkuChannel(ch.code)}
                                data-testid={`topup-channel-${ch.code}`}
                                className={`flex items-center justify-between gap-3 rounded-xl p-3.5 border text-left transition-all cursor-pointer ${
                                  selected
                                    ? "border-neon bg-neon/10 shadow-[0_0_20px_rgba(0,240,255,0.15)] ring-1 ring-neon/40"
                                    : "border-line bg-void/80 hover:border-neon/50"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-display font-bold text-xs text-slate-100 truncate">
                                      {ch.short_name || ch.name}
                                    </span>
                                    {selected && (
                                      <span className="w-4 h-4 rounded-full bg-neon text-void grid place-items-center shrink-0">
                                        <Check size={10} strokeWidth={3} />
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                    {ch.description || ch.name}
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  {denomination ? (
                                    <>
                                      <span className="block text-[9px] font-mono uppercase text-slate-500">
                                        Total
                                      </span>
                                      <span className="font-mono font-bold text-xs text-lime tabular-nums">
                                        {formatIDR(denomination.price)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-500">
                                      Pilih nominal
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* -------------------- STEP 4: DETAIL KONTAK & BELI SEKARANG -------------------- */}
              <section
                id="codashop-step-4"
                className="rounded-2xl border border-line bg-panel/95 p-5 sm:p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)] space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line/80">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-neon text-void font-display font-black text-sm grid place-items-center shadow-[0_0_16px_rgba(0,240,255,0.35)] shrink-0">
                      4
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-sm sm:text-base text-slate-100">
                        Beli! — Bukti Transaksi &amp; Konfirmasi
                      </h2>
                      <p className="text-[11px] font-mono text-slate-400">
                        Masukkan alamat email aktif untuk menerima invoice resmi &amp; status pengiriman item
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="topup-buyer-email"
                      className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-300"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={12} className="text-neon" /> Alamat Email Aktif <span className="text-neon">*</span>
                      </span>
                    </label>
                    <input
                      id="topup-buyer-email"
                      data-testid="topup-buyer-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@gmail.com"
                      className="w-full rounded-xl bg-void border border-line focus:border-neon px-3.5 py-3 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="topup-buyer-wa"
                      className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-300"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={12} className="text-neon" /> Nomor WhatsApp <span className="text-slate-500 normal-case">(opsional)</span>
                      </span>
                    </label>
                    <input
                      id="topup-buyer-wa"
                      data-testid="topup-buyer-wa"
                      type="tel"
                      value={wa}
                      onChange={(e) => setWa(e.target.value)}
                      placeholder="081234567890"
                      className="w-full rounded-xl bg-void border border-line focus:border-neon px-3.5 py-3 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {summaryError && (
                  <div
                    data-testid="topup-summary-error"
                    className="flex items-start gap-2 rounded-xl border border-coral/50 bg-coral/10 p-3.5 text-xs font-mono text-coral"
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{summaryError}</span>
                  </div>
                )}

                {/* Codashop Sticky-Style Bottom Checkout Summary Bar */}
                <div className="rounded-2xl border border-neon/40 bg-gradient-to-r from-void via-void/95 to-neon/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    {denomination ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
                          <span className="font-display font-bold text-slate-100">
                            {denomination.label}
                          </span>
                          <span className="text-slate-600">&bull;</span>
                          <span className="text-neon">{selectedChannelObj?.short_name || selectedChannelObj?.name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-lg sm:text-xl text-lime tabular-nums">
                            {formatIDR(denomination.price)}
                          </span>
                          {destinationLabel && (
                            <span className="text-[11px] font-mono text-slate-400 truncate">
                              ({validation?.nickname ? `${validation.nickname} — ` : ""}{destinationLabel})
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="font-display font-bold text-xs sm:text-sm text-slate-200">
                          {denoms.length === 0
                            ? `Nominal ${game.name} belum tersedia`
                            : "Belum ada item nominal yang dipilih"}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {denoms.length === 0
                            ? "Silakan pilih game lain atau tunggu Admin menarik SKU dari Digiflazz."
                            : "Lengkapi ID akun pada Langkah 1 & pilih nominal pada Langkah 2."}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={submitCheckout}
                    disabled={submitting || denoms.length === 0}
                    data-testid="topup-submit-checkout"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon to-lime hover:from-lime hover:to-neon text-void font-display font-black text-xs sm:text-sm uppercase tracking-wider px-7 py-4 shadow-[0_0_25px_rgba(0,240,255,0.3)] transition-all disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Memproses Pesanan...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={15} />
                        <span>Beli Sekarang</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
