import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  Mail,
  Phone,
  Clock,
  HelpCircle,
  Gamepad2,
  PackageOpen,
  Gem,
  Crown,
  X,
  ExternalLink,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DEFAULT_DUITKU_CHANNELS } from "@/components/topup/TopupPaymentStep";
import {
  api,
  formatApiError,
  formatIDR,
  imgSrc,
  getActiveClientSessions,
  rememberActiveClientSession,
  removeActiveClientSession,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTopupGames, validateTopupDestination, localFieldError } from "@/hooks/useTopup";

const slugifyId = (v) =>
  String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const resolveDenomGroup = (d) => {
  const g = String(d?.sku_group || "").trim().toLowerCase();
  if (g === "membership" || g === "currency") return g;
  const hay = `${d?.vendor_sku || ""} ${d?.code || ""} ${d?.label || ""} ${d?.badge || ""}`;
  if (
    /\b(membership|member|welkin|blessing|inter-knot|interknot|wdp|weekly\s*diamond\s*pass|twilight\s*pass|starlight|supply\s*pass|express\s*supply|lunite\s*subscription|royale\s*pass|booyah\s*pass|elite\s*pass|battle\s*pass|season\s*pass|star\s*pass|premium\s*pass|monthly\s*card|weekly\s*card|monthly\s*pass|weekly\s*pass|vip\s*card|kartu\s*bulanan|kartu\s*mingguan|berkah|langganan|subscription|pass|paket\s*mingguan|paket\s*bulanan|level\s*up\s*pass)\b/i.test(
      hay
    )
  ) {
    return "membership";
  }
  return "currency";
};

const translateFieldMeta = (field, lang) => {
  if (!field || lang !== "en") {
    return {
      label: field?.label || "",
      placeholder: field?.placeholder || `Masukkan ${field?.label || "ID"}...`,
      help: field?.help || "",
    };
  }
  const rawLabel = String(field.label || "").trim();
  const labelMap = {
    "User ID": "User ID",
    "Zone ID": "Zone ID",
    "Server": "Server",
    "Server / Region": "Server / Region",
    "Region Server": "Server Region",
    "UID": "UID",
    "Player ID": "Player ID",
    "Player Tag": "Player Tag",
    "IGG ID": "IGG ID",
    "Hunter ID": "Hunter ID",
    "Account ID (PID)": "Account ID (PID)",
    "Space ID": "Space ID",
    "Username In-Game": "In-Game Username",
    "No. WhatsApp / Steam ID": "WhatsApp No. / Steam ID",
    "Riot ID": "Riot ID",
    "Tagline": "Tagline",
    "Open ID": "Open ID",
    "Character ID": "Character ID",
    "Role ID": "Role ID",
    "ID Tujuan": "Target ID",
    "Nomor Tujuan": "Target Number",
  };
  const label = labelMap[rawLabel] || rawLabel;

  let placeholder = String(field.placeholder || "").trim();
  if (!placeholder) {
    placeholder = Array.isArray(field.options) && field.options.length > 0
      ? `Select ${label}...`
      : `Enter ${label}...`;
  } else {
    placeholder = placeholder
      .replace(/^Pilih\s+/i, "Select ")
      .replace(/^Masukkan\s+/i, "Enter ")
      .replace(/^Contoh:\s*/i, "Example: ")
      .replace(/\batau\b/gi, "or")
      .replace(/\bdigit\b/gi, "digits");
  }

  let help = String(field.help || "").trim();
  if (help) {
    help = help
      .replace(/Lihat di profil in-game/gi, "Check your in-game profile")
      .replace(/Lihat di profil/gi, "Check your profile")
      .replace(/Pilih server sesuai akun game Anda\.?/gi, "Select the server matching your game account.")
      .replace(/Pilih server tempat karakter Anda berada\.?/gi, "Select the server where your character is located.")
      .replace(/Masukkan angka di dalam tanda kurung sebelah User ID\.?/gi, "Enter the digits inside parentheses next to your User ID.")
      .replace(/Masukkan User ID akun game Anda\.?/gi, "Enter your in-game User ID.")
      .replace(/Masukkan UID yang tertera di pojok kanan bawah layar\.?/gi, "Enter the UID shown at the bottom-right corner of your screen.")
      .replace(/Format:\s*/gi, "Format: ")
      .replace(/Wajib diisi/gi, "Required");
  }

  return { label, placeholder, help };
};

const translateLocalFieldErr = (errMsg, lang) => {
  if (!errMsg || lang !== "en") return errMsg;
  return String(errMsg)
    .replace(/\bwajib diisi$/i, "is required")
    .replace(/\bminimal\s+(\d+)\s+karakter$/i, "must be at least $1 characters")
    .replace(/\bmaksimal\s+(\d+)\s+karakter$/i, "must be at most $1 characters")
    .replace(/^Format\s+(.+?)\s+tidak valid$/i, "Invalid $1 format");
};

const stripGatewayNames = (text) => {
  if (!text) return "";
  return String(text)
    .replace(/\s*\(\s*(?:PayKita|Duitku|Tripay|Midtrans|Xendit|Tokopay)\s*\)/gi, "")
    .replace(/\s+via\s+(?:PayKita|Duitku|Tripay|Midtrans|Xendit|Tokopay)(?:\s+Core\s+API)?/gi, "")
    .replace(/\b(?:PayKita|Duitku|Tripay|Midtrans|Xendit|Tokopay)\s+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const translateChannelDescription = (desc, lang) => {
  const cleaned = stripGatewayNames(desc);
  if (!cleaned || lang !== "en") return cleaned;
  return String(cleaned)
    .replace(/Scan QRIS instan via GoPay, DANA, OVO, ShopeePay & semua M-Banking/gi, "Instant QRIS scan via GoPay, DANA, OVO, ShopeePay & all M-Banking")
    .replace(/Scan QRIS via semua E-Wallet & Mobile Banking/gi, "Scan QRIS via any E-Wallet & Mobile Banking")
    .replace(/Pembayaran instan via aplikasi/gi, "Instant payment via app")
    .replace(/Transfer Virtual Account/gi, "Virtual Account Transfer")
    .replace(/Bayar tunai di gerai/gi, "Pay cash at")
    .replace(/Otomatis 24 Jam/gi, "24/7 Automated");
};

export default function TopupGameDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const { games, loading, error, reload } = useTopupGames();

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const [validation, setValidation] = useState(null);
  const [denomination, setDenomination] = useState(null);
  const [denomFilter, setDenomFilter] = useState("currency");
  const [paymentFilter, setPaymentFilter] = useState("qris");
  const [email, setEmail] = useState("");
  const [wa, setWa] = useState("");
  const [duitkuChannels, setDuitkuChannels] = useState(DEFAULT_DUITKU_CHANNELS);
  const [duitkuChannel, setDuitkuChannel] = useState("PK_QRIS");
  const [submitting, setSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [activeOrderConflict, setActiveOrderConflict] = useState(null);
  const [cancellingConflict, setCancellingConflict] = useState(false);
  const [gameSwitcherOpen, setGameSwitcherOpen] = useState(false);
  const [switcherQuery, setSwitcherQuery] = useState("");

  const game = useMemo(
    () =>
      games.find(
        (g) => String(g.slug || "").toLowerCase() === String(slug || "").toLowerCase()
      ) || null,
    [games, slug]
  );

  // Reset form state when switching games
  useEffect(() => {
    setValues({});
    setErrors({});
    setValidation(null);
    setDenomination(null);
    setDenomFilter("currency");
    setPaymentFilter("qris");
    setConfirmModalOpen(false);
    setSummaryError("");
    setActiveOrderConflict(null);
    setCancellingConflict(false);
    setGameSwitcherOpen(false);
    setSwitcherQuery("");
  }, [slug]);

  useEffect(() => {
    if (user?.email) setEmail((cur) => cur || user.email);
  }, [user?.email]);

  const productId = useMemo(
    () =>
      game && denomination
        ? `tp-${slugifyId(game.slug)}-${slugifyId(denomination.code)}`
        : "",
    [game, denomination]
  );

  useEffect(() => {
    if (!game) return;
    let alive = true;
    api
      .get("/payments/methods", {
        params: { product_id: productId || undefined, scope: "topup" },
      })
      .then((res) => {
        if (!alive) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        const duitkuItem =
          rows.find(
            (x) => x.id === "duitku" || x.gateway_id === "duitku" || x.id === "paykita"
          ) || rows[0];
        const channels =
          Array.isArray(duitkuItem?.duitku_channels) &&
          duitkuItem.duitku_channels.length > 0
            ? duitkuItem.duitku_channels
            : DEFAULT_DUITKU_CHANNELS;
        setDuitkuChannels(channels);
        const defaultCode = duitkuItem?.default_channel || channels[0]?.code || "PK_QRIS";
        setDuitkuChannel((cur) =>
          channels.some((c) => c.code === cur) ? cur : defaultCode
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [game, productId]);

  const denoms = useMemo(() => game?.denominations || [], [game]);
  const currencyLabel = useMemo(
    () => String(game?.currency || "Item").trim() || "Item",
    [game]
  );
  const currencyDenoms = useMemo(
    () => denoms.filter((d) => resolveDenomGroup(d) === "currency"),
    [denoms]
  );
  const membershipDenoms = useMemo(
    () => denoms.filter((d) => resolveDenomGroup(d) === "membership"),
    [denoms]
  );

  // Auto-focus tab that has active SKUs when switching games or loading catalog
  useEffect(() => {
    if (currencyDenoms.length === 0 && membershipDenoms.length > 0) {
      setDenomFilter("membership");
    } else {
      setDenomFilter("currency");
    }
  }, [game?.slug, currencyDenoms.length, membershipDenoms.length]);

  const visibleDenoms = useMemo(() => {
    if (denomFilter === "membership") return membershipDenoms;
    return currencyDenoms;
  }, [currencyDenoms, membershipDenoms, denomFilter]);

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

  const paymentGroups = useMemo(
    () => [
      {
        id: "qris",
        label: "QRIS",
        title: t(
          "QRIS (Scan Semua E-Wallet & M-Banking)",
          "QRIS (Scan All E-Wallets & M-Banking)"
        ),
        subtitle: t(
          "Proses otomatis instan begitu scan QRIS selesai",
          "Processed automatically right after scanning QRIS"
        ),
        badge: t("Rekomendasi", "Recommended"),
        icon: QrCode,
      },
      {
        id: "ewallet",
        label: "E-Wallet",
        title: t("E-Wallet Instan", "Instant E-Wallet"),
        subtitle: "DANA, OVO, ShopeePay, & LinkAja",
        badge: t("Instan", "Instant"),
        icon: Wallet,
      },
      {
        id: "va",
        label: "Virtual Account",
        title: t("Virtual Account Bank (24 Jam)", "Bank Virtual Account (24/7)"),
        subtitle: "BCA, Mandiri, BNI, BRI, BSI, CIMB, Permata, Maybank, BNC",
        badge: t("Cek Otomatis", "Auto Verify"),
        icon: Landmark,
      },
      {
        id: "retail",
        label: t("Minimarket", "Retail Store"),
        title: t("Minimarket / Gerai Retail", "Convenience Store / Retail"),
        subtitle: "Indomaret & Alfamart Group",
        badge: t("Tunai", "Cash"),
        icon: Store,
      },
    ],
    [t]
  );

  const paymentCategories = useMemo(() => {
    return paymentGroups
      .map((g) => ({
        ...g,
        items: channels.filter((c) => c.category === g.id),
      }))
      .filter((g) => g.items.length > 0);
  }, [channels, paymentGroups]);

  const activePaymentGroup = useMemo(() => {
    return (
      paymentCategories.find((g) => g.id === paymentFilter) ||
      paymentCategories[0] ||
      null
    );
  }, [paymentCategories, paymentFilter]);

  const accountErrors = useCallback(
    () =>
      Object.fromEntries(
        (game?.fields || [])
          .map((f) => [
            f.key,
            translateLocalFieldErr(localFieldError(f, values[f.key]), lang),
          ])
          .filter(([, msg]) => msg)
      ),
    [game, values, lang]
  );

  const accountReady = useMemo(() => {
    if (!game?.fields?.length) return false;
    return (game.fields || []).every((f) =>
      f.required === false ? true : Boolean(String(values[f.key] ?? "").trim())
    );
  }, [game, values]);

  const emailReady = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  const changeField = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setValidation(null);
    setConfirmModalOpen(false);
    setSummaryError("");
  };

  const destinationLabel = useMemo(
    () =>
      (game?.fields || [])
        .map((f) => (values[f.key] ? `${f.label}: ${values[f.key]}` : ""))
        .filter(Boolean)
        .join(" • "),
    [game, values]
  );

  const scrollToStep = (id) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      scrollToStep("codashop-step-1");
      return;
    }

    // 2. Validate Denomination
    if (!denomination) {
      const msg = t(
        "Pilih paket nominal top up terlebih dahulu pada langkah 2.",
        "Please select a top up package first in Step 2."
      );
      setSummaryError(msg);
      toast.error(msg);
      scrollToStep("codashop-step-2");
      return;
    }

    // 3. Validate Payment Channel
    if (!duitkuChannel) {
      const msg = t(
        "Pilih metode pembayaran terlebih dahulu pada langkah 3.",
        "Please select a payment method first in Step 3."
      );
      setSummaryError(msg);
      toast.error(msg);
      scrollToStep("codashop-step-3");
      return;
    }

    // 4. Validate Buyer Email
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = t(
        "Wajib memasukkan alamat email aktif pada langkah 4 untuk pengiriman bukti & invoice Top Up.",
        "Please enter an active email address in Step 4 to receive your Top Up receipt & invoice."
      );
      setSummaryError(msg);
      toast.error(msg);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const msg = t(
        "Format alamat email tidak valid (contoh: nama@gmail.com).",
        "Invalid email address format (e.g. name@gmail.com)."
      );
      setSummaryError(msg);
      toast.error(msg);
      return;
    }

    // 5. Verify Game ID when buyer clicks Checkout, then open Confirmation Modal
    setChecking(true);
    try {
      let currentValidation = validation;
      if (!currentValidation) {
        currentValidation = await validateTopupDestination(game.slug, values);
        setValidation(currentValidation);
      }

      if (
        currentValidation?.format_valid === false ||
        currentValidation?.code === "ACCOUNT_NOT_FOUND"
      ) {
        const errMsg =
          currentValidation.message ||
          t(
            "Data ID tujuan tidak ditemukan atau tidak valid.",
            "Target account ID not found or invalid."
          );
        setSummaryError(errMsg);
        toast.error(errMsg);
        scrollToStep("codashop-step-1");
        return;
      }

      setConfirmModalOpen(true);
    } catch (_e) {
      // Fallback: if ID check service is unreachable, still allow checkout when local format is valid
      setValidation({
        ok: true,
        format_valid: true,
        checked: false,
        code: "DIRECT_ID_OK",
        nickname: "",
      });
      setConfirmModalOpen(true);
    } finally {
      setChecking(false);
    }
  };

  const handleCancelConflictOrder = async () => {
    if (!activeOrderConflict?.session_id) return;
    setCancellingConflict(true);
    try {
      const { data } = await api.post(
        `/payments/cancel/${activeOrderConflict.session_id}`
      );
      removeActiveClientSession(activeOrderConflict.session_id);
      setActiveOrderConflict(null);
      setSummaryError("");
      toast.success(
        data?.message ||
          t(
            "Pembayaran sebelumnya berhasil dibatalkan! Silakan klik Lanjut Bayar untuk membuat pesanan baru.",
            "Previous payment cancelled! Click Pay Now to create a new order."
          )
      );
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          t(
            "Gagal membatalkan pembayaran sebelumnya",
            "Failed to cancel previous payment"
          )
      );
    } finally {
      setCancellingConflict(false);
    }
  };

  const confirmAndPay = async () => {
    if (!game || !denomination) return;
    const cleanEmail = email.trim().toLowerCase();
    setSubmitting(true);
    setSummaryError("");
    setActiveOrderConflict(null);
    try {
      const rawGw = String(selectedChannelObj?.gateway_id || "").toLowerCase();
      const selectedGw = ["paykita", "duitku", "tripay", "midtrans", "xendit", "tokopay"].includes(rawGw)
        ? rawGw
        : duitkuChannel === "PK_QRIS"
        ? "paykita"
        : duitkuChannel.startsWith("TP_")
        ? "tripay"
        : duitkuChannel.startsWith("MT_")
        ? "midtrans"
        : duitkuChannel.startsWith("XD_")
        ? "xendit"
        : duitkuChannel.startsWith("TK_")
        ? "tokopay"
        : "duitku";
      const payload = {
        game: game.slug,
        denomination_code: denomination.code,
        product_id: productId,
        destination: values,
        verified_nickname: validation?.nickname || "",
        buyer_email: cleanEmail,
        buyer_whatsapp: wa.trim(),
        method: selectedGw,
        gateway_id: selectedGw,
        duitku_channel: duitkuChannel,
        payment_method: duitkuChannel,
        origin_url: window.location.origin,
        active_session_ids: getActiveClientSessions(),
      };
      const { data } = await api.post("/payments/topup/checkout", payload);
      rememberActiveClientSession(data.session_id || data.order_id);
      window.location.href = data.checkout_url;
    } catch (e) {
      if (
        e.response?.status === 409 &&
        e.response?.data?.code === "ACTIVE_ORDER_EXISTS" &&
        e.response?.data?.active_order
      ) {
        setActiveOrderConflict({
          ...e.response.data.active_order,
          detail: e.response.data.detail,
        });
      }
      const message =
        formatApiError(e.response?.data?.detail) ||
        (e.response
          ? t("Gagal membuat pesanan top up", "Failed to create top up order")
          : t(
              "Tidak dapat terhubung ke server. Coba lagi.",
              "Unable to connect to the server. Please try again."
            ));
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

      <div className="relative z-10 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-[72px] pb-28 sm:pt-24 sm:pb-32 overflow-x-hidden">
        {/* Clean, Interactive & Dynamic Top Bar (Breadcrumb + Quick Game Switcher + Step Progress) */}
        <div className="rounded-2xl border border-line/75 bg-panel/75 backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3 mb-3.5 sm:mb-5 min-w-0 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono text-slate-400 min-w-0 flex-1">
              <Link
                to="/topup"
                data-testid="topup-back-to-catalog"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 py-1 text-slate-300 hover:text-neon transition-colors shrink-0"
              >
                <ArrowLeft size={12} />
                <span>{t("Katalog", "Catalog")}</span>
              </Link>
              {game && (
                <>
                  <span className="text-slate-600 shrink-0">/</span>
                  <button
                    type="button"
                    onClick={() => setGameSwitcherOpen((o) => !o)}
                    data-testid="topup-quick-game-switcher"
                    className="group inline-flex items-center gap-1.5 rounded-xl border border-line/75 bg-void/70 hover:border-neon/60 px-2.5 py-1 text-neon font-bold transition-all min-w-0 cursor-pointer"
                    title={t("Ganti game cepat", "Quick switch game")}
                  >
                    {(game.icon || game.banner) && (
                      <img
                        src={imgSrc(game.icon || game.banner)}
                        alt={game.name}
                        className="w-3.5 h-3.5 rounded object-cover shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <span className="truncate max-w-[140px] sm:max-w-[220px]">
                      {game.name}
                    </span>
                    <span className="hidden sm:inline text-[10px] font-normal text-slate-400">
                      ({games.length})
                    </span>
                    <ChevronDown
                      size={12}
                      className={`text-slate-400 group-hover:text-neon transition-transform duration-200 shrink-0 ${
                        gameSwitcherOpen ? "rotate-180 text-neon" : ""
                      }`}
                    />
                  </button>
                </>
              )}
            </div>

            {/* Interactive Step Progress & 24/7 Status */}
            <div className="flex items-center gap-2 shrink-0">
              {game && (
                <div className="hidden md:flex items-center gap-1">
                  {[
                    {
                      id: "codashop-step-1",
                      num: "1",
                      label: t("ID", "ID"),
                      done: accountReady,
                    },
                    {
                      id: "codashop-step-2",
                      num: "2",
                      label: t("Nominal", "Amount"),
                      done: Boolean(denomination),
                    },
                    {
                      id: "codashop-step-3",
                      num: "3",
                      label: t("Bayar", "Pay"),
                      done: Boolean(duitkuChannel),
                    },
                    {
                      id: "codashop-step-4",
                      num: "4",
                      label: t("Email", "Email"),
                      done: emailReady,
                    },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => scrollToStep(s.id)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                        s.done
                          ? "text-lime bg-lime/10"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {s.done ? <Check size={10} /> : <span>{s.num}.</span>}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-lime px-1.5 py-1 shrink-0">
                <Zap size={11} className="shrink-0" />
                <span className="hidden sm:inline">
                  {t("Otomatis 24/7", "24/7 Automated")}
                </span>
                <span className="sm:hidden">24/7</span>
              </div>
            </div>
          </div>

          {/* Expandable Quick Game Switcher Panel with Search Filter for 38+ Games */}
          <AnimatePresence>
            {gameSwitcherOpen && Array.isArray(games) && games.length > 1 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-2.5 border-t border-line/60 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      {t("Pindah Cepat ke Game Lain", "Quick Jump to Another Game")} ({games.length})
                    </span>
                    <input
                      type="text"
                      value={switcherQuery}
                      onChange={(e) => setSwitcherQuery(e.target.value)}
                      placeholder={t("Filter nama game...", "Filter game name...")}
                      className="w-40 sm:w-56 rounded-lg bg-void/90 border border-line/80 px-2.5 py-1 text-[11px] font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-neon"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {games
                      .filter((g) => {
                        const q = switcherQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          (g.name || "").toLowerCase().includes(q) ||
                          (g.publisher || "").toLowerCase().includes(q)
                        );
                      })
                      .map((g) => {
                        const isCurrent = g.slug === game?.slug;
                        return (
                          <Link
                            key={g.slug}
                            to={`/topup/${g.slug}`}
                            onClick={() => setGameSwitcherOpen(false)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-mono font-semibold transition-all shrink-0 ${
                              isCurrent
                                ? "bg-neon text-void font-bold shadow-[0_0_10px_rgba(0,240,255,0.28)]"
                                : "bg-void/80 border border-line/75 text-slate-300 hover:border-neon/60 hover:text-neon"
                            }`}
                          >
                            {(g.icon || g.banner) && (
                              <img
                                src={imgSrc(g.icon || g.banner)}
                                alt={g.name}
                                className="w-3.5 h-3.5 rounded object-cover shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                            <span className="truncate max-w-[125px]">{g.name}</span>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            <div className="lg:col-span-4 h-48 sm:h-80 rounded-2xl bg-panel/70 border border-line animate-pulse" />
            <div className="lg:col-span-8 space-y-4">
              <div className="h-40 rounded-2xl bg-panel/70 border border-line animate-pulse" />
              <div className="h-60 rounded-2xl bg-panel/70 border border-line animate-pulse" />
              <div className="h-60 rounded-2xl bg-panel/70 border border-line animate-pulse" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-coral/40 bg-coral/5 p-6 sm:p-8 text-center">
            <p className="text-xs sm:text-sm font-mono text-coral">
              {t(
                "Gagal memuat halaman game top up.",
                "Failed to load the game top up page."
              )}
            </p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 rounded-xl bg-neon text-void font-display font-bold text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-lime transition-colors cursor-pointer"
            >
              {t("Muat Ulang", "Reload")}
            </button>
          </div>
        )}

        {!loading && !error && !game && (
          <div className="rounded-2xl border border-line bg-panel/90 p-8 sm:p-10 text-center space-y-4">
            <Gamepad2 size={36} className="mx-auto text-slate-500" />
            <h1 className="font-display font-bold text-base sm:text-lg text-slate-100">
              {t("Game Tidak Ditemukan", "Game Not Found")}
            </h1>
            <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
              {t(
                "Game yang Anda cari tidak tersedia atau telah dinonaktifkan. Silakan pilih game lainnya dari katalog Top Up.",
                "The game you are looking for is unavailable or has been disabled. Please choose another game from the Top Up catalog."
              )}
            </p>
            <Link
              to="/topup"
              className="inline-flex items-center gap-2 rounded-xl bg-neon text-void font-display font-bold text-xs uppercase tracking-wider px-5 py-3 hover:bg-lime transition-colors"
            >
              <ArrowLeft size={14} />{" "}
              {t("Kembali ke Daftar Game", "Back to Games List")}
            </Link>
          </div>
        )}

        {!loading && !error && game && (
          <div
            data-testid={`codashop-game-page-${game.slug}`}
            className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-5 lg:gap-6 items-start w-full min-w-0"
          >
            {/* ==================== LEFT COLUMN: COMPACT GAME PROFILE & QUICK GUIDE ==================== */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-3.5 w-full min-w-0">
              <div className="rounded-2xl border border-line bg-panel/95 overflow-hidden shadow-[0_14px_36px_rgba(0,0,0,0.42)] w-full">
                {/* Banner + Game Icon Header (Compact on Android) */}
                <div className="relative h-24 sm:h-36 overflow-hidden bg-void">
                  <img
                    src={imgSrc(game.banner || game.icon)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover scale-110 blur-sm opacity-45"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/65 to-transparent" />

                  <div className="absolute bottom-2.5 sm:bottom-3 left-3 sm:left-4 right-3 sm:right-4 flex items-end gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-13 h-13 sm:w-18 sm:h-18 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-neon shadow-[0_0_20px_rgba(0,240,255,0.28)] bg-void shrink-0">
                      <img
                        src={imgSrc(game.icon || game.banner)}
                        alt={game.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 pb-0.5">
                      <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-neon mb-0.5 truncate">
                        {game.publisher || "Official Publisher"}
                        {game.currency ? ` · ${game.currency}` : ""}
                      </p>
                      <h1 className="font-display font-black text-sm sm:text-lg text-slate-100 leading-tight truncate">
                        {game.name}
                      </h1>
                    </div>
                  </div>
                </div>

                {/* Compact Trust Badges */}
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-line/70 grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-transparent px-1.5 py-1 min-w-0">
                    <Zap size={11} className="mx-auto text-lime mb-0.5" />
                    <span className="block text-[9px] font-mono font-bold text-slate-200 truncate">
                      {t("1–5 Detik", "1–5 Secs")}
                    </span>
                  </div>
                  <div className="bg-transparent px-1.5 py-1 min-w-0">
                    <ShieldCheck size={11} className="mx-auto text-neon mb-0.5" />
                    <span className="block text-[9px] font-mono font-bold text-slate-200 truncate">
                      {t("100% Resmi", "Official")}
                    </span>
                  </div>
                  <div className="bg-transparent px-1.5 py-1 min-w-0">
                    <Clock size={11} className="mx-auto text-cyan-300 mb-0.5" />
                    <span className="block text-[9px] font-mono font-bold text-slate-200 truncate">
                      {t("24/7 Aktif", "24/7 Live")}
                    </span>
                  </div>
                </div>

                {/* Concise Quick Guide (Collapsible on Android, Expanded on Desktop) */}
                <div className="p-3 sm:p-4 space-y-2.5 text-xs font-mono">
                  <p className="text-slate-300 text-[11px] leading-relaxed break-words">
                    {t(
                      `Top up ${currencyLabel} & Membership ${game.name} otomatis tanpa perlu login akun game.`,
                      `Instant ${currencyLabel} & Membership top up for ${game.name} — no game account login required.`
                    )}
                  </p>

                  {/* Android/Mobile Collapsible Guide */}
                  <details className="lg:hidden group bg-transparent py-1">
                    <summary className="font-display font-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-neon flex items-center justify-between gap-2 cursor-pointer list-none">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <HelpCircle size={12} className="shrink-0" />
                        <span className="truncate">{t("Panduan Cepat Top Up", "Quick Top Up Steps")}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 group-open:rotate-180 transition-transform shrink-0">
                        ▼
                      </span>
                    </summary>
                    <div className="mt-2 pt-2 border-t border-line/60 space-y-1.5 text-[11px] text-slate-300">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-md bg-neon/15 text-neon font-bold text-[10px] grid place-items-center shrink-0 mt-0.5">
                          1
                        </span>
                        <span className="break-words min-w-0">
                          {t("Masukkan", "Enter")}{" "}
                          <strong className="text-slate-100">
                            {(game.fields || []).map((f) => f.label).join(" & ") || "User ID"}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-md bg-neon/15 text-neon font-bold text-[10px] grid place-items-center shrink-0 mt-0.5">
                          2
                        </span>
                        <span className="break-words min-w-0">
                          {t("Pilih paket", "Select")}{" "}
                          <strong className="text-slate-100">{currencyLabel}</strong> /{" "}
                          <strong className="text-lime">Membership</strong>
                        </span>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-md bg-neon/15 text-neon font-bold text-[10px] grid place-items-center shrink-0 mt-0.5">
                          3
                        </span>
                        <span className="break-words min-w-0">
                          {t(
                            "Pilih pembayaran & isi email invoice",
                            "Pick payment & enter invoice email"
                          )}
                        </span>
                      </div>
                    </div>
                  </details>

                  {/* Desktop Always-Visible Guide */}
                  <div className="hidden lg:block rounded-xl border border-line bg-void/70 p-3 space-y-2">
                    <p className="font-display font-bold text-[11px] uppercase tracking-wider text-neon flex items-center gap-1.5">
                      <HelpCircle size={12} />
                      <span>{t("Panduan Cepat", "Quick Steps")}</span>
                    </p>
                    <div className="space-y-1.5 text-[11px] text-slate-300">
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-md bg-neon/15 text-neon font-bold text-[10px] grid place-items-center shrink-0 mt-0.5">
                          1
                        </span>
                        <span className="break-words min-w-0">
                          {t("Masukkan", "Enter")}{" "}
                          <strong className="text-slate-100">
                            {(game.fields || []).map((f) => f.label).join(" & ") || "User ID"}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-md bg-neon/15 text-neon font-bold text-[10px] grid place-items-center shrink-0 mt-0.5">
                          2
                        </span>
                        <span className="break-words min-w-0">
                          {t("Pilih paket", "Select")}{" "}
                          <strong className="text-slate-100">{currencyLabel}</strong> /{" "}
                          <strong className="text-lime">Membership</strong>
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-md bg-neon/15 text-neon font-bold text-[10px] grid place-items-center shrink-0 mt-0.5">
                          3
                        </span>
                        <span className="break-words min-w-0">
                          {t(
                            "Pilih pembayaran & isi email invoice",
                            "Pick payment & enter invoice email"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {game.notes && (
                    <div className="flex items-start gap-2 rounded-xl bg-neon/5 border border-neon/25 p-2.5 text-[11px] text-slate-300">
                      <Info size={13} className="text-neon shrink-0 mt-0.5" />
                      <span className="break-words min-w-0">
                        {lang === "en"
                          ? String(game.notes)
                              .replace(/Proses otomatis/gi, "Automated delivery")
                              .replace(/24 jam/gi, "24/7")
                          : game.notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* ==================== RIGHT COLUMN: DYNAMIC STEPS 1 - 2 - 3 - 4 ==================== */}
            <div className="lg:col-span-8 space-y-3.5 sm:space-y-4 w-full min-w-0 max-w-full">
              {/* Interactive 4-Step Progress Bar (Android Safe, No Clipping) */}
              <div className="grid grid-cols-4 gap-1 sm:gap-2 rounded-2xl border border-line bg-panel/90 p-1.5 sm:p-2 shadow-[0_8px_24px_rgba(0,0,0,0.3)] w-full min-w-0">
                {[
                  {
                    num: 1,
                    id: "codashop-step-1",
                    label: t("Akun", "Account"),
                    done: accountReady,
                  },
                  {
                    num: 2,
                    id: "codashop-step-2",
                    label: t("Nominal", "Package"),
                    done: Boolean(denomination),
                  },
                  {
                    num: 3,
                    id: "codashop-step-3",
                    label: t("Bayar", "Payment"),
                    done: Boolean(duitkuChannel),
                  },
                  {
                    num: 4,
                    id: "codashop-step-4",
                    label: t("Beli", "Checkout"),
                    done: emailReady && Boolean(denomination) && accountReady,
                  },
                ].map((s) => (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => scrollToStep(s.id)}
                    className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 rounded-xl px-1 sm:px-2.5 py-1.5 sm:py-2 text-center sm:text-left transition-all cursor-pointer min-w-0 overflow-hidden ${
                      s.done
                        ? "bg-neon/12 border border-neon/40 text-neon"
                        : "bg-void/70 border border-line/70 text-slate-400 hover:text-slate-200 hover:border-line"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-mono font-bold grid place-items-center shrink-0 ${
                        s.done
                          ? "bg-neon text-void"
                          : "bg-panel border border-line text-slate-400"
                      }`}
                    >
                      {s.done ? <Check size={10} strokeWidth={3} /> : s.num}
                    </span>
                    <span className="text-[9px] min-[380px]:text-[10px] sm:text-[11px] font-display font-bold truncate w-full">
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* -------------------- STEP 1: MASUKKAN USER ID -------------------- */}
              <section
                id="codashop-step-1"
                data-testid="topup-account-form"
                className="rounded-2xl border border-line bg-panel/95 p-3 sm:p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] w-full min-w-0 overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-3.5 mb-3.5 sm:mb-4 border-b border-line/80 min-w-0">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-neon text-void font-display font-black text-xs grid place-items-center shadow-[0_0_14px_rgba(0,240,255,0.3)] shrink-0 mt-0.5 sm:mt-0">
                      1
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display font-bold text-xs sm:text-base text-slate-100 leading-snug break-words">
                        {t("Masukkan", "Enter")}{" "}
                        {(game.fields || []).map((f) => f.label).join(" & ") ||
                          t("ID Akun Game", "Game Account ID")}
                      </h2>
                      <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 mt-0.5 break-words">
                        {t(
                          `Pastikan data ID tujuan sesuai dengan profil di dalam game ${game.name}`,
                          `Make sure your target ID matches your in-game ${game.name} profile`
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`grid gap-3 sm:gap-3.5 min-w-0 ${
                    (game.fields || []).length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {(game.fields || []).map((field) => {
                    const err = errors?.[field.key];
                    const inputId = `topup-field-${field.key}`;
                    const hasOptions =
                      Array.isArray(field.options) && field.options.length > 0;
                    const meta = translateFieldMeta(field, lang);
                    return (
                      <div key={field.key} className="space-y-1.5 min-w-0">
                        <label
                          htmlFor={inputId}
                          className="block text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-300 truncate"
                        >
                          {meta.label}
                          {field.required === false ? (
                            <span className="text-slate-500 normal-case">
                              {" "}
                              ({t("opsional", "optional")})
                            </span>
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
                            className={`w-full max-w-full rounded-xl bg-void border px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-100 focus:outline-none transition-all ${
                              err ? "border-coral" : "border-line focus:border-neon"
                            }`}
                          >
                            <option value="">{meta.placeholder}</option>
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
                            placeholder={meta.placeholder}
                            className={`w-full max-w-full rounded-xl bg-void border px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all ${
                              err ? "border-coral" : "border-line focus:border-neon"
                            }`}
                          />
                        )}

                        {err ? (
                          <p
                            data-testid={`topup-error-${field.key}`}
                            className="flex items-start gap-1.5 text-[10px] sm:text-[11px] font-mono text-coral break-words"
                          >
                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                            <span>{err}</span>
                          </p>
                        ) : (
                          meta.help && (
                            <p className="text-[10px] sm:text-[11px] font-mono text-slate-500 leading-relaxed break-words">
                              {meta.help}
                            </p>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Account Verification Status */}
                <AnimatePresence mode="wait">
                  {validation?.ok && validation.checked && validation.nickname && (
                    <motion.div
                      key="ok"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      data-testid="topup-validate-ok"
                      className="mt-3.5 rounded-xl bg-lime/10 border border-lime/40 px-3 sm:px-3.5 py-2.5 text-xs font-mono text-lime flex flex-wrap items-center justify-between gap-2 min-w-0"
                    >
                      <div className="flex items-center gap-2 font-bold min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-lime text-void grid place-items-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words">
                            Nickname: {validation.nickname}
                          </p>
                          {validation.customer_no && (
                            <p className="text-[10px] font-normal text-lime/80 break-all">
                              {t("ID Tujuan", "Target ID")}: {validation.customer_no}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-lg bg-void/80 border border-lime/40 shrink-0">
                        {t("Terverifikasi", "Verified")}
                      </span>
                    </motion.div>
                  )}
                  {validation &&
                    (!validation.ok ||
                      validation.format_valid === false ||
                      validation.code === "ACCOUNT_NOT_FOUND") && (
                      <motion.div
                        key="fail"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        data-testid="topup-validate-fail"
                        className="mt-3.5 flex items-start gap-2 rounded-xl px-3 sm:px-3.5 py-2.5 text-xs font-mono border bg-coral/10 border-coral/40 text-coral min-w-0"
                      >
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="font-bold text-[11px] sm:text-xs break-words">
                            {validation.code === "ACCOUNT_NOT_FOUND"
                              ? t(
                                  "ID Akun Tidak Ditemukan",
                                  "Account ID Not Found"
                                )
                              : t(
                                  "Periksa Kembali Data ID Tujuan",
                                  "Please Check Your Target ID"
                                )}
                          </p>
                          <p className="text-[10px] sm:text-[11px] opacity-90 break-words">
                            {validation.message}
                          </p>
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>
              </section>

              {/* -------------------- STEP 2: PILIH NOMINAL TOP UP -------------------- */}
              <section
                id="codashop-step-2"
                className="rounded-2xl border border-line bg-panel/95 p-3 sm:p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] w-full min-w-0 overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-3.5 mb-3.5 sm:mb-4 border-b border-line/80 min-w-0">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-neon text-void font-display font-black text-xs grid place-items-center shadow-[0_0_14px_rgba(0,240,255,0.3)] shrink-0 mt-0.5 sm:mt-0">
                      2
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display font-bold text-xs sm:text-base text-slate-100 leading-snug break-words">
                        {t(
                          `Pilih Nominal & Paket ${game.name}`,
                          `Select ${game.name} Denomination & Package`
                        )}
                      </h2>
                      <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 mt-0.5 break-words">
                        {t("Pilih kategori", "Select category")}:{" "}
                        <strong className="text-neon">{currencyLabel}</strong>{" "}
                        {t("atau", "or")}{" "}
                        <strong className="text-lime">Membership</strong>
                      </p>
                    </div>
                  </div>

                  {/* Dynamic 2-Tab SKU Category Switch: [Currency Game] & [Membership] */}
                  <div
                    data-testid="topup-sku-group-tabs"
                    role="tablist"
                    aria-label={t(`Kategori SKU ${game.name}`, `${game.name} SKU Categories`)}
                    className="relative grid grid-cols-2 sm:inline-flex items-center gap-1 sm:gap-1.5 rounded-2xl bg-void/95 border border-line/90 p-1 sm:p-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.65)] w-full sm:w-auto min-w-0"
                  >
                    {[
                      {
                        id: "currency",
                        label: currencyLabel,
                        count: currencyDenoms.length,
                        icon: Gem,
                        activeBg:
                          "bg-gradient-to-r from-neon via-cyan-300 to-neon shadow-[0_0_22px_rgba(0,240,255,0.4)]",
                        idleHover: "hover:text-neon hover:bg-neon/5",
                        iconTone: "text-neon",
                      },
                      {
                        id: "membership",
                        label: "Membership",
                        count: membershipDenoms.length,
                        icon: Crown,
                        activeBg:
                          "bg-gradient-to-r from-lime via-emerald-300 to-lime shadow-[0_0_22px_rgba(163,230,53,0.4)]",
                        idleHover: "hover:text-lime hover:bg-lime/5",
                        iconTone: "text-lime",
                      },
                    ].map((tab) => {
                      const active = denomFilter === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setDenomFilter(tab.id)}
                          data-testid={`topup-sku-tab-${tab.id}`}
                          className={`group relative z-10 inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-2 rounded-xl text-[10px] min-[380px]:text-[11px] sm:text-xs font-display font-bold min-w-0 overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                            active ? "text-void" : `text-slate-300 ${tab.idleHover}`
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="topup-sku-category-active-pill"
                              transition={{ type: "spring", stiffness: 420, damping: 32 }}
                              className={`absolute inset-0 -z-10 rounded-xl ${tab.activeBg}`}
                            />
                          )}
                          <Icon
                            size={12}
                            className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                              active ? "text-void" : tab.iconTone
                            }`}
                          />
                          <span className="tracking-wide truncate min-w-0">{tab.label}</span>
                          <span
                            className={`inline-flex items-center justify-center min-w-[16px] sm:min-w-[20px] h-4 sm:h-5 px-1 rounded-md font-mono text-[9px] sm:text-[10px] font-bold tabular-nums shrink-0 transition-colors ${
                              active
                                ? "bg-void/20 text-void"
                                : "bg-panel border border-line/80 text-slate-400 group-hover:border-slate-600 group-hover:text-slate-200"
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {denoms.length === 0 ? (
                  <div
                    data-testid="topup-denom-empty"
                    className="rounded-2xl border border-dashed border-line bg-void/60 p-5 sm:p-8 text-center space-y-2.5"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-neon/10 border border-neon/30 text-neon grid place-items-center mx-auto">
                      <PackageOpen size={20} />
                    </div>
                    <h3 className="font-display font-bold text-xs sm:text-sm text-slate-100 break-words">
                      {t(
                        `Nominal Top Up ${game.name} Belum Tersedia`,
                        `${game.name} Top Up Packages Not Available Yet`
                      )}
                    </h3>
                    <p className="text-[11px] sm:text-xs font-mono text-slate-400 max-w-md mx-auto leading-relaxed break-words">
                      {t(
                        `Paket ${currencyLabel} & Membership untuk ${game.name} sedang diperbarui di katalog.`,
                        `${currencyLabel} & Membership packages for ${game.name} are currently being updated in the catalog.`
                      )}
                    </p>
                  </div>
                ) : visibleDenoms.length === 0 ? (
                  <div
                    data-testid={`topup-denom-empty-${denomFilter}`}
                    className="rounded-2xl border border-dashed border-line bg-void/60 p-5 sm:p-7 text-center space-y-3"
                  >
                    <p className="font-display font-bold text-xs sm:text-sm text-slate-100 break-words">
                      {t("Belum Ada SKU pada Kategori", "No SKUs in Category")}{" "}
                      <span
                        className={
                          denomFilter === "membership" ? "text-lime" : "text-neon"
                        }
                      >
                        {denomFilter === "membership" ? "Membership" : currencyLabel}
                      </span>
                    </p>
                    {(denomFilter === "membership"
                      ? currencyDenoms.length
                      : membershipDenoms.length) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDenomFilter(
                            denomFilter === "membership" ? "currency" : "membership"
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/15 text-neon hover:bg-neon hover:text-void px-3.5 py-2 text-xs font-display font-bold transition-all cursor-pointer max-w-full"
                      >
                        <span className="truncate">
                          {t("Lihat Kategori", "View")}{" "}
                          {denomFilter === "membership" ? currencyLabel : "Membership"} (
                          {denomFilter === "membership"
                            ? currencyDenoms.length
                            : membershipDenoms.length}
                          )
                        </span>
                        <ArrowRight size={13} className="shrink-0" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    data-testid="topup-denom-grid"
                    className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full min-w-0"
                  >
                    {visibleDenoms.map((d) => {
                      const soldOut = (d.stock ?? 1) < 1;
                      const selected = denomination?.code === d.code;
                      const hasDiscount = d.price_strike && d.price_strike > d.price;
                      const isMembership = resolveDenomGroup(d) === "membership";
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
                          className={`group relative flex flex-col justify-between text-left rounded-xl p-2.5 sm:p-3.5 border transition-all duration-200 min-h-[86px] sm:min-h-[100px] min-w-0 w-full overflow-hidden active:scale-[0.98] ${
                            soldOut
                              ? "border-line/40 bg-void/40 opacity-50 cursor-not-allowed"
                              : selected
                                ? "border-neon bg-neon/10 shadow-[0_0_20px_rgba(0,240,255,0.2)] ring-1 ring-neon/50 cursor-pointer"
                                : "border-line bg-void/80 hover:border-neon/60 hover:bg-void cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5 min-w-0">
                            <div className="min-w-0 flex-1">
                              <span className="hidden sm:block text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-0.5 truncate">
                                {isMembership ? "Membership" : currencyLabel}
                              </span>
                              <span className="font-display font-bold text-[11px] sm:text-[13px] text-slate-100 leading-snug block break-words">
                                {d.label}
                              </span>
                            </div>
                            {selected ? (
                              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-neon text-void grid place-items-center shrink-0">
                                <Check size={10} strokeWidth={3} />
                              </span>
                            ) : (
                              (d.badge || isMembership) &&
                              !soldOut && (
                                <span className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-lime text-void shrink-0">
                                  {d.badge || "Pass"}
                                </span>
                              )
                            )}
                          </div>

                          <div className="mt-2 pt-1.5 sm:mt-2.5 sm:pt-2 border-t border-line/60 flex items-end justify-between gap-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-[8px] sm:text-[9px] font-mono uppercase tracking-wider text-slate-500 leading-none mb-0.5">
                                {t("Harga", "Price")}
                              </p>
                              <p className="font-mono font-extrabold text-[11px] sm:text-sm text-neon tabular-nums truncate">
                                {formatIDR(d.price)}
                              </p>
                            </div>
                            {hasDiscount && (
                              <span className="font-mono text-[9px] sm:text-[10px] text-slate-500 line-through tabular-nums shrink-0">
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
                className="rounded-2xl border border-line bg-panel/95 p-3 sm:p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] w-full min-w-0 overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pb-3 sm:pb-3.5 mb-3.5 sm:mb-4 border-b border-line/80 min-w-0">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-neon text-void font-display font-black text-xs grid place-items-center shadow-[0_0_14px_rgba(0,240,255,0.3)] shrink-0 mt-0.5 sm:mt-0">
                      3
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display font-bold text-xs sm:text-base text-slate-100 leading-snug break-words">
                        {t("Pilih Metode Pembayaran", "Select Payment Method")}
                      </h2>
                      <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 mt-0.5 break-words">
                        {t(
                          "Pilih kategori pembayaran otomatis 24 jam",
                          "Choose a 24/7 automated payment category"
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedChannelObj && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-void/90 border border-neon/40 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-mono max-w-full min-w-0">
                      <span className="text-slate-400 shrink-0">
                        {t("Terpilih:", "Selected:")}
                      </span>
                      <span className="font-display font-bold text-neon truncate">
                        {stripGatewayNames(
                          selectedChannelObj.short_name || selectedChannelObj.name
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dynamic 4-Tab Payment Category Switch (No All Button) */}
                <div
                  role="tablist"
                  aria-label={t(
                    "Kategori Metode Pembayaran",
                    "Payment Method Categories"
                  )}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-1.5 rounded-2xl bg-void/95 border border-line/90 p-1 sm:p-1.5 mb-3.5 sm:mb-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.65)] w-full min-w-0"
                >
                  {paymentGroups.map((tab) => {
                    const Icon = tab.icon;
                    const active =
                      (activePaymentGroup?.id || paymentFilter) === tab.id;
                    const count = channels.filter((c) => c.category === tab.id).length;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setPaymentFilter(tab.id);
                          const inCat = channels.filter((c) => c.category === tab.id);
                          if (
                            inCat.length > 0 &&
                            !inCat.some((c) => c.code === duitkuChannel)
                          ) {
                            setDuitkuChannel(inCat[0].code);
                          }
                        }}
                        data-testid={`topup-payment-tab-${tab.id}`}
                        className={`group relative z-10 inline-flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-[10px] min-[380px]:text-[11px] sm:text-xs font-display font-bold min-w-0 overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                          active
                            ? "text-void"
                            : "text-slate-300 hover:text-neon hover:bg-neon/5"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="topup-payment-category-active-pill"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-neon via-cyan-300 to-neon shadow-[0_0_20px_rgba(0,240,255,0.38)]"
                          />
                        )}
                        <Icon
                          size={12}
                          className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                            active ? "text-void" : "text-neon"
                          }`}
                        />
                        <span className="truncate min-w-0">{tab.label}</span>
                        <span
                          className={`inline-flex items-center justify-center min-w-[16px] sm:min-w-[20px] h-4 sm:h-5 px-1 rounded-md font-mono text-[9px] sm:text-[10px] font-bold tabular-nums shrink-0 ${
                            active
                              ? "bg-void/20 text-void"
                              : "bg-panel border border-line/80 text-slate-400"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Payment Category Channels (Simple & Dynamic) */}
                {activePaymentGroup && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePaymentGroup.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-2.5 sm:space-y-3 min-w-0"
                    >
                      <div className="flex items-center justify-between gap-2 px-1 text-[10px] sm:text-[11px] font-mono text-slate-400 min-w-0">
                        <span className="truncate min-w-0 flex-1">{activePaymentGroup.subtitle}</span>
                        <span className="text-lime font-bold shrink-0">
                          &bull; {activePaymentGroup.badge}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 min-w-0">
                        {activePaymentGroup.items.map((ch) => {
                          const selected = duitkuChannel === ch.code;
                          return (
                            <button
                              key={ch.code}
                              type="button"
                              onClick={() => setDuitkuChannel(ch.code)}
                              data-testid={`topup-channel-${ch.code}`}
                              className={`group flex items-center justify-between gap-2 sm:gap-3 rounded-xl px-3 sm:px-3.5 py-2.5 border text-left transition-all duration-200 cursor-pointer active:scale-[0.99] min-w-0 w-full overflow-hidden ${
                                selected
                                  ? "border-neon bg-neon/10 shadow-[0_0_20px_rgba(0,240,255,0.16)] ring-1 ring-neon/40"
                                  : "border-line bg-void/80 hover:border-neon/50 hover:bg-void"
                              }`}
                            >
                              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                                <span
                                  className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 transition-colors ${
                                    selected
                                      ? "bg-neon border-neon text-void"
                                      : "border-slate-600 group-hover:border-neon/60"
                                  }`}
                                >
                                  {selected && <Check size={10} strokeWidth={3} />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-display font-bold text-xs sm:text-[13px] text-slate-100 block truncate">
                                      {stripGatewayNames(ch.short_name || ch.name)}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400 block truncate">
                                    {translateChannelDescription(
                                      ch.description || ch.name,
                                      lang
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right shrink-0 pl-1.5">
                                {denomination ? (
                                  <span className="font-mono font-extrabold text-[11px] sm:text-sm text-lime tabular-nums">
                                    {formatIDR(denomination.price)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {t("Pilih paket", "Select package")}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </section>

              {/* -------------------- STEP 4: DETAIL KONTAK & BELI SEKARANG -------------------- */}
              <section
                id="codashop-step-4"
                className="rounded-2xl border border-line bg-panel/95 p-3 sm:p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] space-y-3.5 sm:space-y-4 w-full min-w-0 overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-3.5 border-b border-line/80 min-w-0">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-neon text-void font-display font-black text-xs grid place-items-center shadow-[0_0_14px_rgba(0,240,255,0.3)] shrink-0 mt-0.5 sm:mt-0">
                      4
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display font-bold text-xs sm:text-base text-slate-100 leading-snug break-words">
                        {t(
                          "Konfirmasi & Bukti Transaksi",
                          "Confirmation & Order Receipt"
                        )}
                      </h2>
                      <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 mt-0.5 break-words">
                        {t(
                          "Masukkan email aktif untuk menerima invoice resmi & status pengiriman otomatis",
                          "Enter an active email to receive your official invoice & real-time delivery status"
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 min-w-0">
                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="topup-buyer-email"
                      className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-300"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <Mail size={12} className="text-neon shrink-0" />{" "}
                        <span className="truncate">{t("Alamat Email Aktif", "Active Email Address")}</span>{" "}
                        <span className="text-neon">*</span>
                      </span>
                    </label>
                    <input
                      id="topup-buyer-email"
                      data-testid="topup-buyer-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("nama@gmail.com", "name@gmail.com")}
                      className="w-full max-w-full rounded-xl bg-void border border-line focus:border-neon px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="topup-buyer-wa"
                      className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-300"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <Phone size={12} className="text-neon shrink-0" />{" "}
                        <span className="truncate">{t("Nomor WhatsApp", "WhatsApp Number")}</span>{" "}
                        <span className="text-slate-500 normal-case shrink-0">
                          ({t("opsional", "optional")})
                        </span>
                      </span>
                    </label>
                    <input
                      id="topup-buyer-wa"
                      data-testid="topup-buyer-wa"
                      type="tel"
                      value={wa}
                      onChange={(e) => setWa(e.target.value)}
                      placeholder="081234567890"
                      className="w-full max-w-full rounded-xl bg-void border border-line focus:border-neon px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {summaryError && (
                  <div
                    data-testid="topup-summary-error"
                    className="flex items-start gap-2 rounded-xl border border-coral/50 bg-coral/10 p-3 text-xs font-mono text-coral min-w-0"
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span className="break-words min-w-0">{summaryError}</span>
                  </div>
                )}

                {/* Bottom Checkout Summary Bar */}
                <div className="rounded-2xl border border-neon/40 bg-gradient-to-r from-void via-void/95 to-neon/10 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
                  <div className="space-y-1 min-w-0 flex-1">
                    {denomination ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-mono text-slate-300 min-w-0">
                          <span className="font-display font-bold text-slate-100 break-words">
                            {denomination.label}
                          </span>
                          <span className="text-slate-600">&bull;</span>
                          <span className="text-neon break-words">
                            {stripGatewayNames(
                              selectedChannelObj?.short_name ||
                                selectedChannelObj?.name
                            )}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="font-mono font-black text-base sm:text-xl text-lime tabular-nums shrink-0">
                            {formatIDR(denomination.price)}
                          </span>
                          {destinationLabel && (
                            <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 break-all min-w-0">
                              ({validation?.nickname ? `${validation.nickname} — ` : ""}
                              {destinationLabel})
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0">
                        <p className="font-display font-bold text-xs sm:text-sm text-slate-200 break-words">
                          {denoms.length === 0
                            ? t(
                                `Nominal ${game.name} belum tersedia`,
                                `${game.name} packages not available yet`
                              )
                            : t(
                                "Belum ada item nominal yang dipilih",
                                "No denomination package selected yet"
                              )}
                        </p>
                        <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 mt-0.5 break-words">
                          {denoms.length === 0
                            ? t(
                                "Silakan pilih game lain atau tunggu pembaruan paket nominal.",
                                "Please select another game or wait for package updates."
                              )
                            : t(
                                "Lengkapi ID akun pada Langkah 1 & pilih nominal pada Langkah 2.",
                                "Complete your account ID in Step 1 & select a package in Step 2."
                              )}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={submitCheckout}
                    disabled={checking || submitting || denoms.length === 0}
                    data-testid="topup-submit-checkout"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon to-lime hover:from-lime hover:to-neon text-void font-display font-black text-xs sm:text-sm uppercase tracking-wider px-5 sm:px-6 py-3.5 shadow-[0_0_25px_rgba(0,240,255,0.3)] transition-all disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
                  >
                    {checking ? (
                      <>
                        <Loader2 size={15} className="animate-spin shrink-0" />
                        <span className="truncate">
                          {t("Memeriksa Data...", "Checking Details...")}
                        </span>
                      </>
                    ) : submitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin shrink-0" />
                        <span className="truncate">
                          {t("Memproses Pesanan...", "Processing Order...")}
                        </span>
                      </>
                    ) : (
                      <>
                        <Zap size={15} className="shrink-0" />
                        <span className="truncate">{t("Beli Sekarang", "Buy Now")}</span>
                        <ArrowRight size={15} className="shrink-0" />
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODAL KONFIRMASI PESANAN ==================== */}
      <AnimatePresence>
        {confirmModalOpen && game && denomination && (
          <motion.div
            key="topup-confirm-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => {
              if (!submitting) setConfirmModalOpen(false);
            }}
            data-testid="topup-confirm-modal"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-line bg-panel p-4 sm:p-5 shadow-[0_24px_64px_rgba(0,0,0,0.75)] space-y-4 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-line/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-neon/15 border border-neon/40 text-neon grid place-items-center shrink-0">
                    <UserCheck size={16} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-sm sm:text-base text-slate-100 leading-tight">
                      {t("Konfirmasi Detail Pesanan", "Confirm Order Details")}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {validation?.checked && validation?.nickname
                        ? t(
                            "Pastikan Nickname & ID tujuan sudah benar sebelum membayar",
                            "Make sure your Nickname & Target ID are correct before paying"
                          )
                        : t(
                            "Pastikan ID tujuan sudah benar sebelum membayar",
                            "Make sure your Target ID is correct before paying"
                          )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmModalOpen(false)}
                  aria-label={t("Tutup", "Close")}
                  className="w-7 h-7 rounded-lg border border-line bg-void/70 text-slate-400 hover:text-slate-100 hover:border-neon/50 grid place-items-center transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Account Destination Highlight: Show Nickname + Target ID if verified, or Target ID directly if no ID check */}
              {validation?.checked && validation?.nickname ? (
                <div className="rounded-xl border bg-lime/10 border-lime/40 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
                      {t("Nickname Akun Game", "In-Game Nickname")}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-lime">
                      <ShieldCheck size={12} />
                      {t("Terverifikasi", "Verified")}
                    </span>
                  </div>

                  <p
                    data-testid="topup-confirm-nickname"
                    className="font-display font-extrabold text-sm sm:text-base text-lime break-words"
                  >
                    {validation.nickname}
                  </p>

                  <p className="text-[11px] font-mono text-slate-300 break-all">
                    {t("ID Tujuan", "Target ID")}:{" "}
                    <strong className="text-slate-100">
                      {destinationLabel || validation.customer_no}
                    </strong>
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border bg-neon/8 border-neon/35 p-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
                      {t("ID Tujuan", "Target ID")}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-neon">
                      <ShieldCheck size={12} />
                      {t("Siap Diproses", "Ready")}
                    </span>
                  </div>

                  <p
                    data-testid="topup-confirm-destination"
                    className="font-mono font-extrabold text-sm sm:text-base text-slate-100 break-all"
                  >
                    {destinationLabel || validation?.customer_no}
                  </p>
                </div>
              )}

              {/* Order Breakdown */}
              <div className="rounded-xl border border-line bg-void/80 p-3.5 space-y-2.5 text-xs font-mono">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400 shrink-0">{t("Game", "Game")}</span>
                  <span className="text-slate-100 font-bold text-right break-words">
                    {game.name}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400 shrink-0">
                    {t("Item Top Up", "Top Up Item")}
                  </span>
                  <span className="text-neon font-bold text-right break-words">
                    {denomination.label}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400 shrink-0">
                    {t("Pembayaran", "Payment")}
                  </span>
                  <span className="text-slate-200 text-right break-words">
                    {stripGatewayNames(
                      selectedChannelObj?.short_name || selectedChannelObj?.name
                    )}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400 shrink-0">
                    {t("Email Bukti", "Receipt Email")}
                  </span>
                  <span className="text-slate-300 text-right break-all">
                    {email.trim().toLowerCase()}
                  </span>
                </div>
                <div className="pt-2.5 border-t border-line/80 flex items-center justify-between gap-3">
                  <span className="text-slate-300 font-bold">
                    {t("Total Bayar", "Total Price")}
                  </span>
                  <span className="font-mono font-black text-base text-lime tabular-nums">
                    {formatIDR(denomination.price)}
                  </span>
                </div>
              </div>

              {/* Active Order Conflict Banner inside Confirmation Modal */}
              {activeOrderConflict && (
                <div
                  data-testid="topup-active-order-conflict"
                  className="rounded-xl border border-coral/50 bg-coral/10 p-3.5 space-y-2.5 text-left"
                >
                  <div className="flex items-start gap-2 text-xs text-slate-100 leading-relaxed">
                    <AlertCircle
                      size={15}
                      className="text-coral shrink-0 mt-0.5"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-coral text-[11px] uppercase tracking-wider">
                        {t(
                          "Masih Ada Pembayaran Aktif di Produk Ini",
                          "Active Payment Exists for This Product"
                        )}
                      </p>
                      <p className="text-[11px] text-slate-200 leading-relaxed">
                        {activeOrderConflict.detail ||
                          t(
                            "Batalkan pembayaran sebelumnya terlebih dahulu sebelum membuat pesanan baru pada nominal yang sama.",
                            "Please cancel the previous payment first before creating a new order for the same item."
                          )}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href =
                          activeOrderConflict.checkout_url ||
                          `/payment/success?session_id=${activeOrderConflict.session_id}`;
                      }}
                      data-testid="topup-conflict-open-payment"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neon text-void hover:bg-lime font-display font-bold text-[11px] uppercase tracking-wider py-2 px-3 transition-colors cursor-pointer"
                    >
                      <ExternalLink size={12} />
                      <span>
                        {t("Buka Pembayaran Aktif", "Open Active Payment")}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={cancellingConflict}
                      onClick={handleCancelConflictOrder}
                      data-testid="topup-conflict-cancel-payment"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-coral/60 bg-void/90 hover:bg-coral hover:text-white text-coral font-display font-bold text-[11px] uppercase tracking-wider py-2 px-3 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {cancellingConflict ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <XCircle size={12} />
                      )}
                      <span>
                        {cancellingConflict
                          ? t("Membatalkan...", "Cancelling...")
                          : t(
                              "Batalkan Pembayaran Aktif",
                              "Cancel Active Payment"
                            )}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmModalOpen(false)}
                  data-testid="topup-confirm-cancel"
                  className="w-full inline-flex items-center justify-center rounded-xl border border-line bg-void hover:border-slate-500 text-slate-300 hover:text-slate-100 font-display font-bold text-xs py-3 px-3 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t("Periksa Lagi", "Edit Details")}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={confirmAndPay}
                  data-testid="topup-confirm-proceed"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-neon to-lime hover:from-lime hover:to-neon text-void font-display font-black text-xs uppercase tracking-wider py-3 px-3 shadow-[0_0_20px_rgba(0,240,255,0.28)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin shrink-0" />
                      <span className="truncate">{t("Memproses...", "Processing...")}</span>
                    </>
                  ) : (
                    <>
                      <span className="truncate">
                        {t("Lanjut Bayar", "Pay Now")}
                      </span>
                      <ArrowRight size={14} className="shrink-0" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </main>
  );
}

