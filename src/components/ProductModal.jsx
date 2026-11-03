import { useCallback, useEffect, useState } from "react";
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
  CheckCircle2,
  Phone,
  Mail,
  ChevronDown,
  Coins,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatIDR, formatUSD, waLink, imgSrc } from "@/lib/api";
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
  products = [],
  onSelectProduct,
  onClose,
}) => {
  const { user } = useAuth();
  const { t, translateDesc, translateCategory, translateBadge } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [buyerContact, setBuyerContact] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerWa, setBuyerWa] = useState("");
  const [showExtraContact, setShowExtraContact] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [manualDestinations, setManualDestinations] = useState([]);
  const [selectedDest, setSelectedDest] = useState("");
  const [selectedAutoGateway, setSelectedAutoGateway] = useState("paykita");
  const [methods, setMethods] = useState([
    { id: "manual", label: "Transfer / QRIS" },
    { id: "crypto", label: "Crypto (USDT / Coin)" },
  ]);
  const [method, setMethod] = useState("manual");
  const [imageFit, setImageFit] = useState("contain");

  void selectedAutoGateway;

  const pPayCfg = product?.payment_config || {};
  const disabledDestIds = Array.isArray(pPayCfg.disabled_destinations)
    ? pPayCfg.disabled_destinations
    : [];
  const disabledGwIds = Array.isArray(pPayCfg.disabled_gateways)
    ? pPayCfg.disabled_gateways
    : [];
  const paykitaMethodObj = methods.find((m) => m.id === "paykita");
  const fallbackGateways = [
    { id: "paykita", name: "PayKita", tagline: "QRIS Otomatis Produk Beranda" },
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
  const fiatDestinations =
    pPayCfg.manual !== false
      ? manualDestinations.filter(
          (d) => d.type !== "crypto" && !disabledDestIds.includes(d.id)
        )
      : [];
  const cryptoDestinations =
    pPayCfg.crypto !== false
      ? manualDestinations.filter(
          (d) => d.type === "crypto" && !disabledDestIds.includes(d.id)
        )
      : [];
  const manualAvailable =
    pPayCfg.manual !== false &&
    (methods.some((m) => m.id === "manual") || fiatDestinations.length > 0);
  const cryptoAvailable =
    pPayCfg.crypto !== false &&
    (methods.some((m) => m.id === "crypto") || cryptoDestinations.length > 0);
  const availableTabCount =
    (paykitaAvailable ? 1 : 0) +
    (manualAvailable ? 1 : 0) +
    (cryptoAvailable ? 1 : 0);

  const activeChannelList = method === "crypto" ? cryptoDestinations : fiatDestinations;
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

  const otherProducts = product
    ? [
        ...products.filter((p) => p.id !== product.id && p.game === product.game),
        ...products.filter((p) => p.id !== product.id && p.game !== product.game),
      ].slice(0, 12)
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
    setActive(0);
    setZoom(false);
    setShowDescription(false);
    setShowExtraContact(false);
    const defaultEmail = user?.email || "";
    setBuyerEmail(defaultEmail);
    setBuyerWa("");
    setBuyerContact(defaultEmail);

    const cfg = product?.payment_config || {};
    const dis = Array.isArray(cfg.disabled_destinations) ? cfg.disabled_destinations : [];
    api
      .get("/payments/manual-destinations", { params: { product_id: product?.id } })
      .then((r) => {
        const rawList = Array.isArray(r.data) ? r.data : [];
        const list = rawList.filter((d) => !dis.includes(d.id));
        setManualDestinations(list);
        const fiats = cfg.manual !== false ? list.filter((d) => d.type !== "crypto") : [];
        const cryptos = cfg.crypto !== false ? list.filter((d) => d.type === "crypto") : [];
        const firstList = fiats.length > 0 ? fiats : cryptos;
        if (firstList.length > 0) {
          setSelectedDest((cur) =>
            firstList.some((d) => d.id === cur) ? cur : firstList[0].id
          );
        } else {
          setSelectedDest("");
        }
      })
      .catch(() => {});
    api
      .get("/payments/methods", { params: { product_id: product?.id } })
      .then((r) => {
        if (Array.isArray(r.data)) {
          setMethods(r.data);
          const pkItem = r.data.find((m) => m.id === "paykita");
          const pkOk = Boolean(pkItem) && cfg.paykita !== false;
          const mnOk = r.data.some((m) => m.id === "manual") && cfg.manual !== false;
          const crOk = r.data.some((m) => m.id === "crypto") && cfg.crypto !== false;
          if (pkItem) {
            setSelectedAutoGateway("paykita");
          }
          if (pkOk) setMethod("paykita");
          else if (mnOk) setMethod("manual");
          else if (crOk) setMethod("crypto");
        }
      })
      .catch(() => {});
  }, [product, user?.email]);

  useEffect(() => {
    if (method === "paykita" && !paykitaAvailable) {
      if (manualAvailable) setMethod("manual");
      else if (cryptoAvailable) setMethod("crypto");
    } else if (method === "manual" && !manualAvailable) {
      if (paykitaAvailable) setMethod("paykita");
      else if (cryptoAvailable) setMethod("crypto");
    } else if (method === "crypto" && !cryptoAvailable) {
      if (paykitaAvailable) setMethod("paykita");
      else if (manualAvailable) setMethod("manual");
    }
  }, [method, paykitaAvailable, manualAvailable, cryptoAvailable]);

  useEffect(() => {
    if (method === "crypto") {
      if (!cryptoDestinations.some((d) => d.id === selectedDest)) {
        setSelectedDest(cryptoDestinations[0]?.id || "");
      }
    } else if (method === "manual") {
      if (!fiatDestinations.some((d) => d.id === selectedDest)) {
        setSelectedDest(fiatDestinations[0]?.id || "");
      }
    }
  }, [method, cryptoDestinations, fiatDestinations, selectedDest]);

  const switchPaymentMethod = (nextMethod) => {
    setMethod(nextMethod);
    if (nextMethod === "crypto") {
      if (!cryptoDestinations.some((d) => d.id === selectedDest) && cryptoDestinations[0]) {
        setSelectedDest(cryptoDestinations[0].id);
      }
    } else if (nextMethod === "manual") {
      if (!fiatDestinations.some((d) => d.id === selectedDest) && fiatDestinations[0]) {
        setSelectedDest(fiatDestinations[0].id);
      }
    }
  };

  const handleEmailChange = (val) => {
    setBuyerEmail(val);
    setBuyerContact(val);
  };

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim());

  const resolveBuyerPayload = () => {
    const finalEmail = buyerEmail.trim().toLowerCase();
    const finalWa = buyerWa.trim();
    return {
      buyer_email: finalEmail,
      buyer_whatsapp: finalWa,
    };
  };

  const handleBuy = async () => {
    const buyer = resolveBuyerPayload();
    if (!buyer.buyer_email) {
      toast.error("Wajib memasukkan alamat email aktif sebelum melakukan pembelian");
      const emailEl = document.getElementById("primary-buyer-email");
      if (emailEl) emailEl.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.buyer_email)) {
      toast.error("Format alamat email tidak valid (contoh: nama@gmail.com)");
      const emailEl = document.getElementById("primary-buyer-email");
      if (emailEl) emailEl.focus();
      return;
    }
    setLoading(true);
    try {
      if (method === "paykita") {
        const { data } = await api.post("/payments/paykita/checkout", {
          ...buyer,
          product_id: product.id,
          gateway_id: "paykita",
          origin_url: window.location.origin,
        });
        window.location.href = data.checkout_url;
        return;
      }
      if (!selectedDest) {
        toast.error("Pilih tujuan pembayaran terlebih dahulu");
        setLoading(false);
        return;
      }
      const { data } = await api.post("/payments/manual/checkout", {
        ...buyer,
        product_id: product.id,
        destination_id: selectedDest,
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(
        e.response?.data?.detail ||
          (e.response
            ? "Gagal membuat sesi pembayaran"
            : "Tidak dapat terhubung ke server. Coba lagi.")
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
        className="max-w-2xl sm:max-w-3xl w-[calc(100vw-16px)] sm:w-[92vw] max-h-[86dvh] sm:max-h-[88vh] bg-panel border border-line text-slate-100 p-0 overflow-y-auto overflow-x-hidden gap-0 shadow-[0_20px_60px_rgba(0,0,0,0.75)] focus:outline-none [&>button:last-child]:z-30 [&>button:last-child]:bg-void/90 [&>button:last-child]:border [&>button:last-child]:border-line [&>button:last-child]:p-1 [&>button:last-child]:text-slate-300 [&>button:last-child]:hover:text-neon [&>button:last-child]:hover:border-neon [&>button:last-child]:opacity-100"
      >
        {product && (
          <DialogTitle className="sr-only">{product.title}</DialogTitle>
        )}
        {product && (
          <div className="flex flex-col min-w-0 w-full">
            <div className="grid grid-cols-1 md:grid-cols-12 min-w-0 w-full items-stretch">
              {/* LEFT COLUMN: Compact Product Media & Specs */}
              <div className="md:col-span-5 min-w-0 w-full bg-void/60 border-b md:border-b-0 md:border-r border-line p-3 sm:p-4 flex flex-col justify-between gap-2.5">
                {/* Compact 16:10 Media Frame */}
                <div
                  className="relative aspect-[16/10] w-full bg-void border border-line/70 group overflow-hidden touch-pan-y select-none"
                  {...swipeHandlers}
                  data-testid="modal-swipe-surface"
                >
                  <img
                    src={imgSrc(gallery[active] || product.image)}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-25 pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-void/30 pointer-events-none" />

                  <AnimatePresence mode="wait">
                    <motion.img
                      key={gallery[active] || product.image}
                      src={imgSrc(gallery[active] || product.image)}
                      alt={product.title}
                      data-testid="modal-main-image"
                      referrerPolicy="no-referrer"
                      draggable="false"
                      initial={{ opacity: 0.4, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0.4, scale: 1.01 }}
                      transition={{ duration: 0.16 }}
                      onClick={() => setZoom(true)}
                      className={`relative z-10 w-full h-full cursor-zoom-in transition-transform duration-200 ease-out ${
                        imageFit === "contain"
                          ? "object-contain p-1.5"
                          : "object-cover"
                      }`}
                      style={
                        dragOffset
                          ? { transform: `translate3d(${dragOffset}px, 0, 0)` }
                          : undefined
                      }
                    />
                  </AnimatePresence>

                  {/* Subtle Top Kicker Label */}
                  {mBadges.length > 0 && (
                    <div
                      className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-void/85 backdrop-blur px-2 py-0.5 border border-line/70"
                      data-testid="modal-badges"
                    >
                      <span className="text-[9px] font-mono font-semibold text-neon tracking-wider">
                        {mBadges.map((b) => translateBadge(b)).join(" · ")}
                      </span>
                    </div>
                  )}

                  {/* Ratio Toggle & Zoom Controls */}
                  {gallery.length > 0 && (
                    <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setImageFit((f) => (f === "contain" ? "cover" : "contain"))
                        }
                        title={t("Ubah mode tampilan foto", "Toggle image fit mode")}
                        className="px-2 h-6 bg-void/85 backdrop-blur text-[9px] font-mono text-slate-300 hover:text-neon border border-line/70 hover:border-neon transition-colors whitespace-nowrap shrink-0"
                      >
                        {imageFit === "contain"
                          ? t("Penuh", "Full")
                          : t("Pas", "Fit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoom(true)}
                        data-testid="modal-zoom-button"
                        aria-label={t("Perbesar gambar", "Zoom image")}
                        className="grid place-items-center w-6 h-6 bg-void/85 backdrop-blur text-slate-200 hover:text-neon border border-line/70 hover:border-neon transition-colors duration-200"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  )}

                  {/* Prev / Next Arrows */}
                  {gallery.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goPrev}
                        data-testid="modal-prev-button"
                        aria-label={t("Gambar sebelumnya", "Previous image")}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-6 h-6 bg-void/85 backdrop-blur border border-line/70 hover:border-neon text-slate-200 hover:text-neon opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        data-testid="modal-next-button"
                        aria-label={t("Gambar selanjutnya", "Next image")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-6 h-6 bg-void/85 backdrop-blur border border-line/70 hover:border-neon text-slate-200 hover:text-neon opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </>
                  )}

                  {/* Bottom Counter */}
                  <div className="absolute bottom-1.5 right-1.5 z-20 bg-void/85 backdrop-blur px-1.5 py-0.5 text-[9px] font-mono tabular-nums text-slate-300">
                    {active + 1} / {Math.max(gallery.length, 1)}
                  </div>
                </div>

                {/* Compact Thumbnail Strip & Hairline Spec Row */}
                <div className="space-y-2">
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
                          aria-label={t(`Lihat gambar ${i + 1}`, `View image ${i + 1}`)}
                          className={`relative w-11 h-8 shrink-0 overflow-hidden border transition-all duration-150 ${
                            active === i
                              ? "border-neon opacity-100"
                              : "border-line/60 opacity-55 hover:opacity-95"
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

                  {/* Compact 3-Column Spec Bar */}
                  <div className="grid grid-cols-3 divide-x divide-line/70 border-y border-line/70 py-1.5 text-center">
                    <div className="px-1.5">
                      <p className="text-[9px] font-mono text-slate-400">
                        Rank / Tier
                      </p>
                      <p className="text-[11px] font-semibold text-slate-100 truncate">
                        {product.rank || "-"}
                      </p>
                    </div>
                    <div className="px-1.5">
                      <p className="text-[9px] font-mono text-slate-400">
                        {t("Stok", "Stock")}
                      </p>
                      <p
                        className="text-[11px] font-mono font-semibold tabular-nums text-slate-100"
                        data-testid="modal-stock"
                      >
                        {product.stock}{" "}
                        {t("Unit", Number(product.stock) === 1 ? "Unit" : "Units")}
                      </p>
                    </div>
                    <div className="px-1.5">
                      <p className="text-[9px] font-mono text-slate-400">
                        {t("Garansi", "Warranty")}
                      </p>
                      <p
                        className="text-[11px] font-semibold text-lime"
                        data-testid="modal-warranty"
                      >
                        {product.warranty === "100% Aman" || !product.warranty
                          ? t("100% Aman", "100% Safe")
                          : product.warranty}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Compact Checkout Module */}
              <div className="md:col-span-7 min-w-0 w-full p-3 sm:p-4 flex flex-col justify-between gap-2.5">
                {/* Top Product Summary */}
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pr-7 text-[11px] text-slate-400">
                    <div className="flex flex-wrap items-center gap-1 min-w-0">
                      <span className="font-mono text-neon truncate">
                        {product.game}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{translateCategory(product.category)}</span>
                      {product.condition && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-mono font-semibold ${condTone(
                              product.condition
                            )}`}
                            data-testid="modal-condition"
                          >
                            {product.condition}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-lime shrink-0 font-mono text-[11px] tabular-nums">
                      <Star size={11} fill="currentColor" />
                      <span className="font-semibold">{product.rating}</span>
                      <span className="text-slate-500">· {product.sold}</span>
                    </div>
                  </div>

                  {/* Title & Price */}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/70 pb-2">
                    <h3
                      className="font-display font-bold text-sm sm:text-base leading-snug text-slate-100 break-words min-w-0"
                      data-testid="modal-product-title"
                    >
                      {product.title}
                    </h3>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <p
                        className="font-mono font-bold text-base sm:text-lg text-neon tabular-nums"
                        data-testid="modal-price"
                      >
                        {formatIDR(product.price)}
                      </p>
                      <span
                        className="font-mono text-[10px] text-slate-400 tabular-nums"
                        data-testid="modal-price-usd"
                      >
                        ({formatUSD(product)} USD)
                      </span>
                    </div>
                  </div>

                  {/* Compact Expandable Description */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDescription((prev) => !prev)}
                      data-testid="toggle-product-description"
                      aria-label={
                        showDescription
                          ? t("Sembunyikan deskripsi produk", "Hide product description")
                          : t("Tampilkan deskripsi produk", "Show product description")
                      }
                      className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-neon transition-colors py-0.5"
                    >
                      <span className="truncate pr-2">
                        {showDescription
                          ? t("Deskripsi Produk", "Product Description")
                          : translateDesc(product.description) ||
                            t("Deskripsi Produk", "Product Description")}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-neon shrink-0">
                        <span>
                          {showDescription
                            ? t("Tutup", "Close")
                            : t("Detail", "Details")}
                        </span>
                        <ChevronDown
                          size={12}
                          className={`transition-transform duration-200 ${
                            showDescription ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {showDescription && (
                        <motion.p
                          key="modal-description"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.14 }}
                          className="overflow-y-auto max-h-20 text-[11px] leading-relaxed text-slate-300 mt-1.5 pt-1.5 border-t border-line/50 pr-1 whitespace-pre-line"
                          data-testid="modal-product-description"
                        >
                          {translateDesc(product.description) ||
                            t("Tidak ada deskripsi tambahan.", "No additional description.")}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* COMPACT CHECKOUT FORM */}
                <div className="space-y-2.5">
                  {/* Buyer Email + Optional WhatsApp */}
                  <div className="space-y-1.5" data-testid="buyer-contact-fields">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="primary-buyer-email"
                        className="text-[11px] font-medium text-slate-200"
                      >
                        {t("Email Penerima", "Recipient Email")}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowExtraContact((prev) => !prev)}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-neon transition-colors whitespace-nowrap shrink-0"
                      >
                        <Plus
                          size={10}
                          className={`transition-transform duration-150 ${
                            showExtraContact ? "rotate-45 text-neon" : ""
                          }`}
                        />
                        <span>
                          {showExtraContact
                            ? t("Tutup WhatsApp", "Hide WhatsApp")
                            : "WhatsApp"}
                        </span>
                      </button>
                    </div>

                    <div className="relative">
                      <Mail
                        size={13}
                        className={`absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors ${
                          isEmailValid ? "text-lime" : "text-neon"
                        }`}
                      />
                      <input
                        id="primary-buyer-email"
                        type="email"
                        required
                        value={buyerEmail}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        placeholder="nama@gmail.com"
                        data-testid="buyer-email-input"
                        className={`w-full bg-void/90 border ${
                          isEmailValid
                            ? "border-lime/70 focus:border-lime"
                            : "border-line focus:border-neon"
                        } outline-none text-xs font-mono pl-8 pr-8 py-1.5 text-slate-100 placeholder:text-slate-500 transition-colors`}
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
                          <div className="relative pt-0.5">
                            <Phone
                              size={12}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                              type="tel"
                              value={buyerWa}
                              onChange={(e) => setBuyerWa(e.target.value)}
                              placeholder={t(
                                "No. WhatsApp (opsional)",
                                "WhatsApp No. (optional)"
                              )}
                              data-testid="buyer-whatsapp-input"
                              className="w-full bg-void/90 border border-line focus:border-neon outline-none text-xs font-mono pl-8 pr-2.5 py-1.5 text-slate-100 placeholder:text-slate-500 transition-colors"
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
                          aria-label="WhatsApp Cadangan"
                          className="sr-only"
                          tabIndex={-1}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Payment Method & Channel Selector */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-medium text-slate-200">
                      {t("Metode Pembayaran", "Payment Method")}
                    </span>

                    {availableTabCount > 0 ? (
                      <div
                        className={`grid ${
                          availableTabCount === 3
                            ? "grid-cols-3"
                            : availableTabCount === 2
                            ? "grid-cols-2"
                            : "grid-cols-1"
                        } gap-1 p-1 bg-void/90 border border-line`}
                        data-testid="payment-method-tabs"
                      >
                        {paykitaAvailable && (
                          <button
                            type="button"
                            onClick={() => switchPaymentMethod("paykita")}
                            data-testid="method-paykita"
                            className={`flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 px-2 transition-all duration-150 whitespace-nowrap shrink-0 ${
                              method === "paykita"
                                ? "bg-neon text-void font-semibold"
                                : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]"
                            }`}
                          >
                            <QrCode size={12} />
                            <span>{t("QRIS Instan", "Instant QRIS")}</span>
                          </button>
                        )}
                        {manualAvailable && (
                          <button
                            type="button"
                            onClick={() => switchPaymentMethod("manual")}
                            data-testid="method-manual"
                            className={`flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 px-2 transition-all duration-150 whitespace-nowrap shrink-0 ${
                              method === "manual"
                                ? "bg-neon text-void font-semibold"
                                : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]"
                            }`}
                          >
                            <Wallet size={12} />
                            <span>{t("Transfer / QRIS", "Transfer / QRIS")}</span>
                          </button>
                        )}
                        {cryptoAvailable && (
                          <button
                            type="button"
                            onClick={() => switchPaymentMethod("crypto")}
                            data-testid="method-crypto"
                            className={`flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 px-2 transition-all duration-150 whitespace-nowrap shrink-0 ${
                              method === "crypto"
                                ? "bg-lime text-void font-semibold"
                                : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]"
                            }`}
                          >
                            <Coins size={12} />
                            <span>Crypto</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 bg-coral/10 border border-coral/30 text-xs text-coral">
                        {t(
                          "Metode pembayaran sedang tidak aktif.",
                          "Payment methods are currently inactive."
                        )}
                      </div>
                    )}

                    {/* Compact Sub-Panel per Method */}
                    <AnimatePresence mode="wait" initial={false}>
                      {method === "paykita" ? (
                        <motion.div
                          key="panel-paykita"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.12 }}
                          className="flex items-center justify-between gap-2 bg-void/60 border border-line/80 px-2.5 py-2"
                          data-testid="paykita-info-box"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <QrCode size={14} className="text-neon shrink-0" />
                            <span className="text-[11px] text-slate-200 truncate">
                              {t(
                                "QRIS Semua E-Wallet & M-Banking",
                                "QRIS All E-Wallets & M-Banking"
                              )}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-lime shrink-0">
                            {t("Otomatis", "Automatic")}
                          </span>
                        </motion.div>
                      ) : method === "crypto" ? (
                        <motion.div
                          key="panel-crypto"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.12 }}
                          data-testid="crypto-payment-panel"
                        >
                          {cryptoDestinations.length > 0 ? (
                            <div className="grid grid-cols-2 gap-1.5">
                              {cryptoDestinations.map((d) => {
                                const isSelected = d.id === selectedDest;
                                return (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => setSelectedDest(d.id)}
                                    data-testid={`crypto-dest-${d.id}`}
                                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 border text-left transition-all duration-150 ${
                                      isSelected
                                        ? "border-lime bg-lime/10 text-slate-100"
                                        : "border-line bg-void/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-semibold truncate">
                                        {d.symbol || "USDT"} · {d.name}
                                      </p>
                                      <p className="text-[9px] font-mono text-slate-400 truncate">
                                        {d.network || d.account_number}
                                      </p>
                                    </div>
                                    <CheckCircle2
                                      size={13}
                                      className={`shrink-0 transition-opacity ${
                                        isSelected ? "text-lime opacity-100" : "opacity-0"
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-coral py-1">
                              {t(
                                "Wallet crypto belum tersedia.",
                                "Crypto wallet is not available yet."
                              )}
                            </p>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="panel-manual"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.12 }}
                        >
                          {activeChannelList.length > 0 ? (
                            <>
                              <div className="grid grid-cols-2 gap-1.5">
                                {activeChannelList.map((d) => {
                                  const isSelected = d.id === selectedDest;
                                  return (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => setSelectedDest(d.id)}
                                      className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 border text-left transition-all duration-150 ${
                                        isSelected
                                          ? "border-neon bg-neon/10 text-slate-100"
                                          : "border-line bg-void/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-semibold truncate">
                                          {d.name}
                                        </p>
                                        <p className="text-[9px] font-mono text-slate-400 truncate">
                                          {d.account_number && d.account_number !== "-"
                                            ? d.account_number
                                            : d.type?.toUpperCase() || "QRIS"}
                                        </p>
                                      </div>
                                      <CheckCircle2
                                        size={13}
                                        className={`shrink-0 transition-opacity ${
                                          isSelected ? "text-neon opacity-100" : "opacity-0"
                                        }`}
                                      />
                                    </button>
                                  );
                                })}
                              </div>

                              <select
                                value={selectedDest}
                                onChange={(e) => setSelectedDest(e.target.value)}
                                data-testid="manual-destination-select"
                                aria-label={t(
                                  "Pilih Tujuan Transfer",
                                  "Select Transfer Destination"
                                )}
                                className="sr-only"
                              >
                                {manualDestinations.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} ({d.type})
                                  </option>
                                ))}
                              </select>
                            </>
                          ) : (
                            <p className="text-xs text-coral py-1">
                              {t(
                                "Tujuan transfer belum tersedia.",
                                "Transfer destination is not available yet."
                              )}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Primary Action Bar */}
                  <div className="sticky bottom-0 z-20 -mx-3 px-3 py-2 bg-panel/95 backdrop-blur border-t border-line sm:static sm:mx-0 sm:px-0 sm:py-0 sm:pt-0.5 sm:bg-transparent sm:border-t-0">
                    <div className="flex items-stretch gap-1.5">
                      <button
                        onClick={handleBuy}
                        disabled={
                          loading ||
                          product.stock < 1 ||
                          ((method === "manual" || method === "crypto") && !selectedDest)
                        }
                        data-testid="modal-buy-button"
                        className={`flex-1 flex items-center justify-center gap-1.5 ${
                          method === "crypto"
                            ? "bg-lime text-void hover:bg-neon"
                            : "bg-neon text-void hover:bg-lime"
                        } font-display font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
                      >
                        {loading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : method === "crypto" ? (
                          <Coins size={14} />
                        ) : (
                          <Zap size={14} />
                        )}
                        <span>
                          {product.stock < 1
                            ? t("Stok Habis", "Out of Stock")
                            : loading
                            ? t("Memproses...", "Processing...")
                            : method === "crypto"
                            ? `${t("Beli", "Buy")} · ${formatUSD(product)} USD`
                            : `${t("Beli Sekarang", "Buy Now")} · ${formatIDR(
                                product.price
                              )}`}
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
                        title={t("Tanya CS via WhatsApp", "Ask Support via WhatsApp")}
                        className="inline-flex items-center justify-center gap-1.5 border border-line hover:border-neon bg-void/80 text-slate-200 hover:text-neon text-xs font-medium px-3 py-2.5 transition-colors duration-200 whitespace-nowrap shrink-0"
                      >
                        <MessageCircle size={14} />
                        <span>{t("Tanya CS", "Ask Support")}</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COMPACT MULTI-PRODUCT QUICK SWITCHER INSIDE POPUP */}
            {otherProducts.length > 0 && typeof onSelectProduct === "function" && (
              <div
                className="border-t border-line bg-void/40 px-3 sm:px-4 py-2.5"
                data-testid="modal-other-products"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {t("Produk Lainnya (Klik untuk Ganti)", "More Products (Click to Switch)")}
                  </span>
                  <span className="text-[10px] font-mono text-neon tabular-nums">
                    {otherProducts.length} {t("Produk", "Items")}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {otherProducts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectProduct(item)}
                      data-testid={`modal-quick-product-${item.id}`}
                      className="flex items-center gap-2 p-1.5 bg-panel/90 hover:bg-panel border border-line/70 hover:border-neon/60 text-left transition-all group"
                    >
                      <img
                        src={imgSrc(item.image)}
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-cover bg-void shrink-0 border border-line/50"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-mono text-neon/90 truncate">
                          {item.game}
                        </p>
                        <p className="text-[10px] font-display font-bold text-slate-100 group-hover:text-neon truncate">
                          {item.title}
                        </p>
                        <p className="text-[10px] font-mono font-bold text-lime tabular-nums truncate">
                          {formatIDR(item.price)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
