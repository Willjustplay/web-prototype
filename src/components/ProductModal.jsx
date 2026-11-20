import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Zap,
  MessageCircle,
  Loader2,
  Star,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Wallet,
  Phone,
  Mail,
  ChevronDown,
  Plus,
  Check,
  AlertTriangle,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  formatIDR,
  waLink,
  imgSrc,
  getActiveClientSessions,
  rememberActiveClientSession,
  removeActiveClientSession,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";

const condTone = (c) => {
  const v = (c || "").toLowerCase();
  if (v === "ready") return "text-lime";
  if (v === "sold") return "text-slate-400";
  if (v === "unready") return "text-coral";
  return "text-neon";
};

export const ProductModal = ({
  product,
  onClose,
}) => {
  const { user, openAuth, refreshUser } = useAuth();
  const { t, translateDesc, translateCategory, translateBadge } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerWa, setBuyerWa] = useState("");
  const [showExtraContact, setShowExtraContact] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [methods, setMethods] = useState([
    { id: "wallet", label: "Saldo Akun" },
    { id: "paykita", label: "QRIS Otomatis" },
  ]);
  const [method, setMethod] = useState("wallet");
  const [imageFit, setImageFit] = useState("contain");
  const [activeOrderConflict, setActiveOrderConflict] = useState(null);
  const [cancellingConflict, setCancellingConflict] = useState(false);

  const pPayCfg = product?.payment_config || {};
  const disabledGwIds = Array.isArray(pPayCfg.disabled_gateways)
    ? pPayCfg.disabled_gateways
    : [];
  const paykitaMethodObj = methods.find((m) => m.id === "paykita");
  const fallbackGateways = [
    { id: "paykita", name: "QRIS Otomatis", tagline: "QRIS Otomatis Produk Beranda" },
  ];
  const availableAutoGateways = (
    Array.isArray(paykitaMethodObj?.gateways) && paykitaMethodObj.gateways.length > 0
      ? paykitaMethodObj.gateways
      : fallbackGateways
  ).filter((g) => g.id === "paykita" && !disabledGwIds.includes(g.id));
  const paykitaAvailable =
    Boolean(paykitaMethodObj) &&
    pPayCfg.paykita !== false &&
    availableAutoGateways.length > 0;
  const walletAvailable = true;
  const availableTabCount = (walletAvailable ? 1 : 0) + (paykitaAvailable ? 1 : 0);
  const userBalance = Math.max(0, Math.round(Number(user?.balance || 0)));
  const productPrice = Math.max(0, Math.round(Number(product?.price || 0)));
  const isWalletSufficient = Boolean(user && userBalance >= productPrice);

  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);

  const gallery = product
    ? [product.image, ...(product.images || [])].filter(Boolean)
    : [];
  const mBadges = product
    ? (product.badges?.length
        ? product.badges
        : product.badge
        ? [product.badge]
        : []
      ).slice(0, 2)
    : [];

  const goNext = useCallback(
    () => setActive((i) => (gallery.length ? (i + 1) % gallery.length : 0)),
    [gallery.length]
  );
  const goPrev = useCallback(
    () =>
      setActive((i) =>
        gallery.length ? (i - 1 + gallery.length) % gallery.length : 0
      ),
    [gallery.length]
  );

  const { dragOffset, swipeHandlers } = useSwipeNav({
    onNext: goNext,
    onPrev: goPrev,
    enabled: gallery.length > 1,
    count: gallery.length,
  });

  useEffect(() => {
    setActive((i) => (i < gallery.length ? i : 0));
    setZoom(false);
  }, [gallery.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    if (zoom || gallery.length < 2) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, gallery.length, goNext, goPrev]);

  useEffect(() => {
    if (!product) return;
    setLoading(false);
    setActiveOrderConflict(null);
    setCancellingConflict(false);
    setActive(0);
    setZoom(false);
    setShowDescription(false);
    setShowExtraContact(false);
    const defaultEmail = user?.email || "";
    setBuyerEmail(defaultEmail);
    setBuyerWa("");
    if (user && typeof refreshUser === "function") {
      void refreshUser();
    }

    const cfg = product?.payment_config || {};
    api
      .get("/payments/methods", { params: { product_id: product?.id } })
      .then((r) => {
        if (Array.isArray(r.data)) {
          setMethods(r.data);
          const pkItem = r.data.find((m) => m.id === "paykita");
          const pkOk = Boolean(pkItem) && cfg.paykita !== false;
          if (user && Number(user?.balance || 0) >= Number(product?.price || 0)) {
            setMethod("wallet");
          } else if (pkOk) {
            setMethod("paykita");
          } else {
            setMethod("wallet");
          }
        }
      })
      .catch(() => {});
  }, [product?.id, user?.email]);

  useEffect(() => {
    if (method === "paykita" && !paykitaAvailable) {
      setMethod("wallet");
    }
  }, [method, paykitaAvailable]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim());

  const resolveBuyerPayload = () => ({
    buyer_email: buyerEmail.trim().toLowerCase(),
    buyer_whatsapp: buyerWa.trim(),
  });

  const handleCancelConflictOrder = async () => {
    if (!activeOrderConflict?.session_id) return;
    setCancellingConflict(true);
    try {
      const { data } = await api.post(
        `/payments/cancel/${activeOrderConflict.session_id}`
      );
      removeActiveClientSession(activeOrderConflict.session_id);
      setActiveOrderConflict(null);
      toast.success(
        data?.message || "Pembayaran sebelumnya dibatalkan."
      );
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Gagal membatalkan pembayaran"
      );
    } finally {
      setCancellingConflict(false);
    }
  };

  const handleBuy = async () => {
    if (method === "wallet") {
      if (!user) {
        toast.info(
          t(
            "Silakan login untuk membayar dengan Saldo Akun.",
            "Please log in to pay with Account Balance."
          )
        );
        if (typeof openAuth === "function") openAuth("login");
        return;
      }
      if (!isWalletSufficient) {
        toast.error(
          t(
            "Saldo Akun belum mencukupi. Silakan isi saldo terlebih dahulu.",
            "Insufficient balance. Please top up first."
          )
        );
        const curPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search || ""}`
            : "/";
        window.location.href = `/isi-saldo?from=${encodeURIComponent(curPath)}`;
        return;
      }
    }

    const buyer = resolveBuyerPayload();
    if (!buyer.buyer_email) {
      toast.error("Masukkan alamat email penerima");
      const emailEl = document.getElementById("primary-buyer-email");
      if (emailEl) emailEl.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.buyer_email)) {
      toast.error("Format email tidak valid");
      const emailEl = document.getElementById("primary-buyer-email");
      if (emailEl) emailEl.focus();
      return;
    }
    setLoading(true);
    setActiveOrderConflict(null);
    try {
      const activeSessions = getActiveClientSessions();
      if (method === "wallet") {
        const { data } = await api.post("/payments/wallet/checkout", {
          ...buyer,
          product_id: product.id,
          origin_url: window.location.origin,
          active_session_ids: activeSessions,
        });
        if (typeof refreshUser === "function") {
          void refreshUser();
        }
        rememberActiveClientSession(data.session_id || data.order_id);
        window.location.href = data.checkout_url;
        return;
      }

      const { data } = await api.post("/payments/paykita/checkout", {
        ...buyer,
        product_id: product.id,
        gateway_id: "paykita",
        origin_url: window.location.origin,
        active_session_ids: activeSessions,
      });
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
      toast.error(
        e.response?.data?.detail ||
          (e.response
            ? "Gagal membuat sesi pembayaran"
            : "Tidak dapat terhubung ke server.")
      );
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="product-modal"
        data-lenis-prevent
        aria-describedby={undefined}
        className="max-w-xl sm:max-w-2xl w-[calc(100vw-16px)] sm:w-[90vw] max-h-[88dvh] bg-panel border border-line rounded-xl text-slate-100 p-0 overflow-y-auto overflow-x-hidden gap-0 shadow-[0_20px_60px_rgba(0,0,0,0.75)] focus:outline-none [&>button:last-child]:z-30 [&>button:last-child]:bg-void/90 [&>button:last-child]:border [&>button:last-child]:border-line [&>button:last-child]:rounded-lg [&>button:last-child]:p-1 [&>button:last-child]:text-slate-300 [&>button:last-child]:hover:text-neon [&>button:last-child]:hover:border-neon [&>button:last-child]:opacity-100"
      >
        {product && <DialogTitle className="sr-only">{product.title}</DialogTitle>}
        {product && (
          <div className="grid grid-cols-1 md:grid-cols-12 min-w-0 w-full items-stretch">
            {/* LEFT COLUMN: Clean Image & Quick Specs */}
            <div className="md:col-span-5 min-w-0 w-full bg-void/50 border-b md:border-b-0 md:border-r border-line p-3.5 flex flex-col justify-between gap-2.5">
              <div
                className="relative aspect-[16/10] w-full rounded-lg bg-void border border-line/70 group overflow-hidden touch-pan-y select-none"
                {...swipeHandlers}
                data-testid="modal-swipe-surface"
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={gallery[active] || product.image}
                    src={imgSrc(gallery[active] || product.image)}
                    alt={product.title}
                    data-testid="modal-main-image"
                    referrerPolicy="no-referrer"
                    draggable="false"
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.5 }}
                    transition={{ duration: 0.14 }}
                    onClick={() => setZoom(true)}
                    className={`relative z-10 w-full h-full cursor-zoom-in ${
                      imageFit === "contain" ? "object-contain p-1" : "object-cover"
                    }`}
                    style={
                      dragOffset
                        ? { transform: `translate3d(${dragOffset}px, 0, 0)` }
                        : undefined
                    }
                  />
                </AnimatePresence>

                {mBadges.length > 0 && (
                  <div
                    className="absolute top-2 left-2 z-20 rounded bg-void/85 px-2 py-0.5 border border-line/70"
                    data-testid="modal-badges"
                  >
                    <span className="text-[9px] font-mono font-semibold text-neon">
                      {mBadges.map((b) => translateBadge(b)).join(" · ")}
                    </span>
                  </div>
                )}

                {gallery.length > 0 && (
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setImageFit((f) => (f === "contain" ? "cover" : "contain"))
                      }
                      className="px-2 h-6 rounded bg-void/85 text-[9px] font-mono text-slate-300 hover:text-neon border border-line/70 transition-colors cursor-pointer"
                    >
                      {imageFit === "contain" ? t("Penuh", "Full") : t("Pas", "Fit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(true)}
                      data-testid="modal-zoom-button"
                      aria-label={t("Perbesar gambar", "Zoom image")}
                      className="grid place-items-center w-6 h-6 rounded bg-void/85 text-slate-200 hover:text-neon border border-line/70 transition-colors cursor-pointer"
                    >
                      <Maximize2 size={12} />
                    </button>
                  </div>
                )}

                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      data-testid="modal-prev-button"
                      aria-label={t("Sebelumnya", "Previous")}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-6 h-6 rounded bg-void/85 border border-line/70 hover:border-neon text-slate-200 hover:text-neon opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      data-testid="modal-next-button"
                      aria-label={t("Selanjutnya", "Next")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-6 h-6 rounded bg-void/85 border border-line/70 hover:border-neon text-slate-200 hover:text-neon opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <div className="absolute bottom-1.5 right-1.5 z-20 rounded bg-void/85 px-1.5 py-0.5 text-[9px] font-mono tabular-nums text-slate-300">
                      {active + 1}/{gallery.length}
                    </div>
                  </>
                )}
              </div>

              {gallery.length > 1 && (
                <div
                  className="flex gap-1.5 overflow-x-auto pb-0.5"
                  data-testid="modal-gallery-thumbs"
                >
                  {gallery.map((g, i) => (
                    <button
                      type="button"
                      key={`${g}-${i}`}
                      onClick={() => setActive(i)}
                      data-testid={`modal-thumb-${i}`}
                      className={`relative w-10 h-7 rounded shrink-0 overflow-hidden border transition-all cursor-pointer ${
                        active === i
                          ? "border-neon opacity-100"
                          : "border-line/60 opacity-50 hover:opacity-90"
                      }`}
                    >
                      <img
                        src={imgSrc(g)}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Compact Spec Strip */}
              <div className="grid grid-cols-3 divide-x divide-line/70 rounded-lg border border-line/70 py-1.5 text-center text-[11px] font-mono">
                <div className="px-1.5 truncate">
                  <span className="block text-[9px] text-slate-400">Rank</span>
                  <strong className="text-slate-100 truncate">{product.rank || "-"}</strong>
                </div>
                <div className="px-1.5">
                  <span className="block text-[9px] text-slate-400">{t("Stok", "Stock")}</span>
                  <strong className="text-slate-100 tabular-nums" data-testid="modal-stock">
                    {product.stock}
                  </strong>
                </div>
                <div className="px-1.5 truncate">
                  <span className="block text-[9px] text-slate-400">{t("Garansi", "Warranty")}</span>
                  <strong className="text-lime" data-testid="modal-warranty">
                    {product.warranty || "Aman"}
                  </strong>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Clean & Dynamic Checkout */}
            <div className="md:col-span-7 min-w-0 w-full p-4 flex flex-col justify-between gap-3">
              {/* Top Product Header */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 pr-7 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="text-neon font-semibold truncate">{product.game}</span>
                    <span>·</span>
                    <span className="truncate">{translateCategory(product.category)}</span>
                    {product.condition && (
                      <>
                        <span>·</span>
                        <span
                          className={`font-bold ${condTone(product.condition)}`}
                          data-testid="modal-condition"
                        >
                          {product.condition}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-lime shrink-0 tabular-nums">
                    <Star size={11} fill="currentColor" />
                    {product.rating}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-line/70">
                  <h3
                    className="font-display font-bold text-sm sm:text-base text-slate-100 leading-snug break-words min-w-0"
                    data-testid="modal-product-title"
                  >
                    {product.title}
                  </h3>
                  <p
                    className="font-mono font-extrabold text-base sm:text-lg text-neon tabular-nums shrink-0"
                    data-testid="modal-price"
                  >
                    {formatIDR(product.price)}
                  </p>
                </div>

                {product.description && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDescription((prev) => !prev)}
                      data-testid="toggle-product-description"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-neon transition-colors cursor-pointer"
                    >
                      <span>{t("Deskripsi", "Description")}</span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-150 ${
                          showDescription ? "rotate-180 text-neon" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {showDescription && (
                        <motion.p
                          key="modal-description"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.14 }}
                          className="overflow-y-auto max-h-24 text-[11px] font-mono leading-relaxed text-slate-300 mt-1.5 pt-1.5 border-t border-line/50 whitespace-pre-line"
                          data-testid="modal-product-description"
                        >
                          {translateDesc(product.description)}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Checkout Controls */}
              <div className="space-y-3">
                {/* Buyer Email & Optional WA */}
                <div className="space-y-1.5" data-testid="buyer-contact-fields">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="primary-buyer-email"
                      className="text-xs font-mono text-slate-300 font-semibold"
                    >
                      Email
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowExtraContact((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-neon transition-colors cursor-pointer"
                    >
                      <Plus
                        size={10}
                        className={`transition-transform duration-150 ${
                          showExtraContact ? "rotate-45 text-neon" : ""
                        }`}
                      />
                      <span>WhatsApp</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Mail
                      size={13}
                      className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                        isEmailValid ? "text-lime" : "text-slate-400"
                      }`}
                    />
                    <input
                      id="primary-buyer-email"
                      type="email"
                      required
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="nama@gmail.com"
                      data-testid="buyer-email-input"
                      className={`w-full rounded-lg bg-void border ${
                        isEmailValid
                          ? "border-lime/70 focus:border-lime"
                          : "border-line focus:border-neon"
                      } outline-none text-xs font-mono pl-8 pr-8 py-2 text-slate-100 placeholder:text-slate-500 transition-colors`}
                    />
                    {isEmailValid && (
                      <Check
                        size={13}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-lime"
                      />
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {showExtraContact ? (
                      <motion.div
                        key="wa-extra-visible"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.14 }}
                        className="overflow-hidden"
                      >
                        <div className="relative pt-1">
                          <Phone
                            size={12}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            type="tel"
                            value={buyerWa}
                            onChange={(e) => setBuyerWa(e.target.value)}
                            placeholder="08xxxxxxxxxx"
                            data-testid="buyer-whatsapp-input"
                            className="w-full rounded-lg bg-void border border-line focus:border-neon outline-none text-xs font-mono pl-8 pr-3 py-2 text-slate-100 placeholder:text-slate-500 transition-colors"
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <input
                        key="wa-extra-hidden"
                        type="tel"
                        value={buyerWa}
                        onChange={(e) => setBuyerWa(e.target.value)}
                        data-testid="buyer-whatsapp-input"
                        aria-label="WhatsApp"
                        className="sr-only"
                        tabIndex={-1}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Clean Payment Method Switcher */}
                <div className="space-y-2">
                  <span className="block text-xs font-mono text-slate-300 font-semibold">
                    {t("Pembayaran", "Payment")}
                  </span>

                  {availableTabCount > 0 ? (
                    <div
                      className={`grid ${
                        availableTabCount === 2 ? "grid-cols-2" : "grid-cols-1"
                      } gap-2`}
                      data-testid="payment-method-tabs"
                    >
                      {walletAvailable && (
                        <button
                          type="button"
                          onClick={() => setMethod("wallet")}
                          data-testid="method-wallet"
                          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 border bg-transparent text-xs font-display font-bold transition-all cursor-pointer ${
                            method === "wallet"
                              ? "border-lime text-lime shadow-[0_0_12px_rgba(163,230,53,0.16)]"
                              : "border-line text-slate-400 hover:text-slate-200 hover:border-lime/40"
                          }`}
                        >
                          <Wallet size={13} />
                          <span>{t("Saldo Akun", "Balance")}</span>
                        </button>
                      )}
                      {paykitaAvailable && (
                        <button
                          type="button"
                          onClick={() => setMethod("paykita")}
                          data-testid="method-paykita"
                          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 border bg-transparent text-xs font-display font-bold transition-all cursor-pointer ${
                            method === "paykita"
                              ? "border-neon text-neon shadow-[0_0_12px_rgba(0,240,255,0.16)]"
                              : "border-line text-slate-400 hover:text-slate-200 hover:border-neon/40"
                          }`}
                        >
                          <QrCode size={13} />
                          <span>QRIS</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg p-2 bg-coral/10 border border-coral/30 text-xs text-coral">
                      {t("Pembayaran sedang tidak aktif.", "Payment unavailable.")}
                    </div>
                  )}

                  {/* Minimal Wallet Status Row (Only when Saldo Akun is selected) */}
                  <AnimatePresence initial={false}>
                    {method === "wallet" && (
                      <motion.div
                        key="panel-wallet"
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -2 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs font-mono"
                        data-testid="wallet-info-box"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Wallet
                            size={13}
                            className={
                              user && isWalletSufficient ? "text-lime shrink-0" : "text-neon shrink-0"
                            }
                          />
                          <span className="text-slate-200 truncate tabular-nums">
                            {user ? (
                              <>
                                Saldo: <strong className={isWalletSufficient ? "text-lime" : "text-coral"}>{formatIDR(userBalance)}</strong>
                              </>
                            ) : (
                              t("Login untuk pakai Saldo", "Log in to use Balance")
                            )}
                          </span>
                        </div>

                        {!user ? (
                          <button
                            type="button"
                            onClick={() => typeof openAuth === "function" && openAuth("login")}
                            data-testid="modal-wallet-login-btn"
                            className="shrink-0 rounded border border-neon text-neon hover:bg-neon hover:text-void px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer"
                          >
                            Login
                          </button>
                        ) : (
                          <Link
                            to="/isi-saldo"
                            state={{
                              from:
                                typeof window !== "undefined"
                                  ? `${window.location.pathname}${window.location.search || ""}`
                                  : "/",
                            }}
                            onClick={onClose}
                            data-testid="modal-wallet-topup-link"
                            className="shrink-0 rounded border border-lime/60 text-lime hover:bg-lime hover:text-void px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition-colors"
                          >
                            + {t("Isi Saldo", "Top Up")}
                          </Link>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Active Unpaid Order Conflict Warning */}
                {activeOrderConflict && (
                  <div
                    data-testid="active-order-conflict-banner"
                    className="rounded-lg border border-coral/50 bg-coral/10 p-2.5 space-y-2 text-left"
                  >
                    <div className="flex items-center gap-2 text-xs text-coral font-bold">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span className="truncate">
                        {t("Masih ada tagihan aktif di produk ini", "Active payment exists")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href =
                            activeOrderConflict.checkout_url ||
                            `/payment/success?session_id=${activeOrderConflict.session_id}`;
                        }}
                        data-testid="conflict-open-active-payment"
                        className="inline-flex items-center justify-center gap-1 rounded bg-neon text-void hover:bg-lime font-display font-bold text-[10px] uppercase py-1.5 px-2 transition-colors cursor-pointer"
                      >
                        <ExternalLink size={11} />
                        <span>{t("Buka Tagihan", "Open")}</span>
                      </button>
                      <button
                        type="button"
                        disabled={cancellingConflict}
                        onClick={handleCancelConflictOrder}
                        data-testid="conflict-cancel-active-payment"
                        className="inline-flex items-center justify-center gap-1 rounded border border-coral/60 text-coral hover:bg-coral hover:text-white font-display font-bold text-[10px] uppercase py-1.5 px-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {cancellingConflict ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <XCircle size={11} />
                        )}
                        <span>{t("Batalkan", "Cancel")}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Action Bar */}
                <div className="flex items-stretch gap-2 pt-0.5">
                  <button
                    onClick={handleBuy}
                    disabled={loading || product.stock < 1}
                    data-testid="modal-buy-button"
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg ${
                      method === "wallet"
                        ? "bg-lime text-void hover:bg-neon"
                        : "bg-neon text-void hover:bg-lime"
                    } font-display font-bold text-xs uppercase tracking-wider py-2.5 px-4 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                  >
                    {loading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : method === "wallet" ? (
                      <Wallet size={14} />
                    ) : (
                      <Zap size={14} />
                    )}
                    <span>
                      {product.stock < 1
                        ? t("Stok Habis", "Out of Stock")
                        : loading
                        ? t("Memproses...", "Processing...")
                        : method === "wallet" && !user
                        ? t("Login & Bayar", "Login & Pay")
                        : method === "wallet" && !isWalletSufficient
                        ? t("Isi Saldo Dulu", "Top Up First")
                        : `${t("Beli Sekarang", "Buy Now")} · ${formatIDR(product.price)}`}
                    </span>
                  </button>

                  <a
                    href={waLink(
                      `Halo WillJustPlay, saya tertarik dengan produk: ${product.title} (${formatIDR(
                        product.price
                      )})`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="modal-wa-button"
                    title={t("Chat CS WhatsApp", "Chat WhatsApp Support")}
                    className="inline-flex items-center justify-center rounded-lg border border-line hover:border-neon bg-transparent text-slate-300 hover:text-neon px-3 py-2.5 transition-colors shrink-0"
                  >
                    <MessageCircle size={15} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
        <ImageZoomViewer
          open={zoom}
          onOpenChange={setZoom}
          images={gallery}
          active={active}
          onActiveChange={setActive}
          title={product?.title}
        />
      </DialogContent>
    </Dialog>
  );
};
