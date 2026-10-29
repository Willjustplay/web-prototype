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
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";

const condTone = (c) => {
  const v = (c || "").toLowerCase();
  if (v === "ready") return "text-lime";
  if (v === "sold") return "text-slate-400";
  if (v === "unready") return "text-coral";
  return "text-neon";
};

export const ProductModal = ({ product, onClose }) => {
  const { user } = useAuth();
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
        className="max-w-4xl w-[calc(100vw-16px)] sm:w-[94vw] max-h-[88dvh] sm:max-h-[90vh] bg-panel border border-line text-slate-100 p-0 overflow-y-auto overflow-x-hidden gap-0 shadow-[0_24px_80px_rgba(0,0,0,0.75)] focus:outline-none [&>button:last-child]:z-30 [&>button:last-child]:bg-void/90 [&>button:last-child]:border [&>button:last-child]:border-line [&>button:last-child]:p-1.5 [&>button:last-child]:text-slate-300 [&>button:last-child]:hover:text-neon [&>button:last-child]:hover:border-neon [&>button:last-child]:opacity-100"
      >
        {product && (
          <DialogTitle className="sr-only">{product.title}</DialogTitle>
        )}
        {product && (
          <div className="grid grid-cols-1 md:grid-cols-12 min-w-0 w-full items-stretch">
            {/* LEFT COLUMN: Clean Product Media & Essential Specs */}
            <div className="md:col-span-6 min-w-0 w-full bg-void/60 border-b md:border-b-0 md:border-r border-line p-4 sm:p-6 flex flex-col justify-between gap-4">
              {/* Main 4:3 Media Frame */}
              <div
                className="relative aspect-[4/3] w-full bg-void border border-line/70 group overflow-hidden touch-pan-y select-none"
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
                    transition={{ duration: 0.18 }}
                    onClick={() => setZoom(true)}
                    className={`relative z-10 w-full h-full cursor-zoom-in transition-transform duration-200 ease-out ${
                      imageFit === "contain"
                        ? "object-contain p-2"
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
                    className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-void/85 backdrop-blur px-2.5 py-1 border border-line/70"
                    data-testid="modal-badges"
                  >
                    <span className="text-[10px] font-mono font-semibold text-neon tracking-wider">
                      {mBadges.join(" · ")}
                    </span>
                  </div>
                )}

                {/* Ratio Toggle & Zoom Controls */}
                {gallery.length > 0 && (
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setImageFit((f) => (f === "contain" ? "cover" : "contain"))
                      }
                      title="Ubah mode tampilan foto"
                      className="px-2.5 h-8 bg-void/85 backdrop-blur text-[10px] font-mono text-slate-300 hover:text-neon border border-line/70 hover:border-neon transition-colors whitespace-nowrap shrink-0"
                    >
                      {imageFit === "contain" ? "Layar Penuh" : "Proporsional"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(true)}
                      data-testid="modal-zoom-button"
                      aria-label="Perbesar gambar"
                      className="grid place-items-center w-8 h-8 bg-void/85 backdrop-blur text-slate-200 hover:text-neon border border-line/70 hover:border-neon transition-colors duration-200"
                    >
                      <Maximize2 size={14} />
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
                      aria-label="Gambar sebelumnya"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-8 h-8 bg-void/85 backdrop-blur border border-line/70 hover:border-neon text-slate-200 hover:text-neon opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      data-testid="modal-next-button"
                      aria-label="Gambar selanjutnya"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-8 h-8 bg-void/85 backdrop-blur border border-line/70 hover:border-neon text-slate-200 hover:text-neon opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                {/* Bottom Counter */}
                <div className="absolute bottom-2.5 right-2.5 z-20 bg-void/85 backdrop-blur px-2 py-0.5 text-[10px] font-mono tabular-nums text-slate-300">
                  {active + 1} / {Math.max(gallery.length, 1)}
                </div>
              </div>

              {/* Thumbnail Strip & Hairline Spec Row */}
              <div className="space-y-3.5">
                {gallery.length > 1 && (
                  <div
                    className="flex gap-2 overflow-x-auto pb-1"
                    data-testid="modal-gallery-thumbs"
                  >
                    {gallery.map((g, i) => (
                      <button
                        type="button"
                        key={`${g}-${i}`}
                        onClick={() => setActive(i)}
                        data-testid={`modal-thumb-${i}`}
                        aria-label={`Lihat gambar ${i + 1}`}
                        className={`relative w-14 h-11 shrink-0 overflow-hidden border transition-all duration-150 ${
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

                {/* Clean Unboxed 3-Column Spec Bar with Hairline Dividers */}
                <div className="grid grid-cols-3 divide-x divide-line/70 border-y border-line/70 py-2.5 text-center">
                  <div className="px-2">
                    <p className="text-[10px] font-mono text-slate-400">
                      Rank / Tier
                    </p>
                    <p className="text-xs font-semibold text-slate-100 mt-0.5 truncate">
                      {product.rank || "-"}
                    </p>
                  </div>
                  <div className="px-2">
                    <p className="text-[10px] font-mono text-slate-400">
                      Stok
                    </p>
                    <p
                      className="text-xs font-mono font-semibold tabular-nums text-slate-100 mt-0.5"
                      data-testid="modal-stock"
                    >
                      {product.stock} Unit
                    </p>
                  </div>
                  <div className="px-2">
                    <p className="text-[10px] font-mono text-slate-400">
                      Garansi
                    </p>
                    <p
                      className="text-xs font-semibold text-lime mt-0.5"
                      data-testid="modal-warranty"
                    >
                      {product.warranty || "100% Aman"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Clean & Focused Checkout Module */}
            <div className="md:col-span-6 min-w-0 w-full p-4 sm:p-6 flex flex-col justify-between gap-4">
              {/* Top Product Summary */}
              <div className="min-w-0 space-y-2.5">
                {/* Clean Unboxed Metadata Line */}
                <div className="flex flex-wrap items-center justify-between gap-2 pr-8 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-mono text-neon truncate">
                      {product.game}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{product.category}</span>
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
                  <div className="flex items-center gap-1 text-lime shrink-0 font-mono text-xs tabular-nums">
                    <Star size={12} fill="currentColor" />
                    <span className="font-semibold">{product.rating}</span>
                    <span className="text-slate-500">· {product.sold}</span>
                  </div>
                </div>

                {/* Title & Price */}
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line/70 pb-3">
                  <h3
                    className="font-display font-bold text-base sm:text-lg leading-snug text-slate-100 break-words min-w-0"
                    data-testid="modal-product-title"
                  >
                    {product.title}
                  </h3>
                  <div className="flex items-baseline gap-2 shrink-0">
                    <p
                      className="font-mono font-bold text-xl sm:text-2xl text-neon tabular-nums"
                      data-testid="modal-price"
                    >
                      {formatIDR(product.price)}
                    </p>
                    <span
                      className="font-mono text-xs text-slate-400 tabular-nums"
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
                        ? "Sembunyikan deskripsi produk"
                        : "Tampilkan deskripsi produk"
                    }
                    className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-neon transition-colors py-0.5"
                  >
                    <span className="truncate pr-2">
                      {showDescription ? "Deskripsi Produk" : product.description || "Deskripsi Produk"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-neon shrink-0">
                      <span>{showDescription ? "Tutup" : "Detail"}</span>
                      <ChevronDown
                        size={13}
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
                        transition={{ duration: 0.16 }}
                        className="overflow-y-auto max-h-28 text-xs leading-relaxed text-slate-300 mt-2 pt-2 border-t border-line/50 pr-1 whitespace-pre-line"
                        data-testid="modal-product-description"
                      >
                        {product.description || "Tidak ada deskripsi tambahan."}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* CLEAN & TIDY CHECKOUT FORM */}
              <div className="space-y-4">
                {/* Buyer Email + Optional WhatsApp */}
                <div className="space-y-2" data-testid="buyer-contact-fields">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="primary-buyer-email"
                      className="text-xs font-medium text-slate-200"
                    >
                      Email Penerima
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowExtraContact((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-neon transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus
                        size={11}
                        className={`transition-transform duration-150 ${
                          showExtraContact ? "rotate-45 text-neon" : ""
                        }`}
                      />
                      <span>{showExtraContact ? "Tutup WhatsApp" : "WhatsApp"}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Mail
                      size={14}
                      className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
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
                      } outline-none text-xs font-mono pl-9 pr-9 py-2.5 text-slate-100 placeholder:text-slate-500 transition-colors`}
                    />
                    {isEmailValid && (
                      <Check
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-lime"
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
                        transition={{ duration: 0.16 }}
                        className="overflow-hidden"
                      >
                        <div className="relative pt-0.5">
                          <Phone
                            size={13}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            type="tel"
                            value={buyerWa}
                            onChange={(e) => setBuyerWa(e.target.value)}
                            placeholder="No. WhatsApp (opsional)"
                            data-testid="buyer-whatsapp-input"
                            className="w-full bg-void/90 border border-line focus:border-neon outline-none text-xs font-mono pl-8 pr-2.5 py-2 text-slate-100 placeholder:text-slate-500 transition-colors"
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
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-slate-200">
                    Metode Pembayaran
                  </span>

                  {availableTabCount > 0 ? (
                    <div
                      className={`grid ${
                        availableTabCount === 3
                          ? "grid-cols-3"
                          : availableTabCount === 2
                          ? "grid-cols-2"
                          : "grid-cols-1"
                      } gap-1.5 p-1 bg-void/90 border border-line`}
                      data-testid="payment-method-tabs"
                    >
                      {paykitaAvailable && (
                        <button
                          type="button"
                          onClick={() => switchPaymentMethod("paykita")}
                          data-testid="method-paykita"
                          className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-2.5 transition-all duration-150 whitespace-nowrap shrink-0 ${
                            method === "paykita"
                              ? "bg-neon text-void font-semibold"
                              : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]"
                          }`}
                        >
                          <QrCode size={13} />
                          <span>QRIS Instan</span>
                        </button>
                      )}
                      {manualAvailable && (
                        <button
                          type="button"
                          onClick={() => switchPaymentMethod("manual")}
                          data-testid="method-manual"
                          className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-2.5 transition-all duration-150 whitespace-nowrap shrink-0 ${
                            method === "manual"
                              ? "bg-neon text-void font-semibold"
                              : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]"
                          }`}
                        >
                          <Wallet size={13} />
                          <span>Transfer / QRIS</span>
                        </button>
                      )}
                      {cryptoAvailable && (
                        <button
                          type="button"
                          onClick={() => switchPaymentMethod("crypto")}
                          data-testid="method-crypto"
                          className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-2.5 transition-all duration-150 whitespace-nowrap shrink-0 ${
                            method === "crypto"
                              ? "bg-lime text-void font-semibold"
                              : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]"
                          }`}
                        >
                          <Coins size={13} />
                          <span>Crypto</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-coral/10 border border-coral/30 text-xs text-coral">
                      Metode pembayaran sedang tidak aktif.
                    </div>
                  )}

                  {/* Compact Sub-Panel per Method */}
                  <AnimatePresence mode="wait" initial={false}>
                    {method === "paykita" ? (
                      <motion.div
                        key="panel-paykita"
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.14 }}
                        className="flex items-center justify-between gap-3 bg-void/60 border border-line/80 px-3.5 py-2.5"
                        data-testid="paykita-info-box"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <QrCode size={16} className="text-neon shrink-0" />
                          <span className="text-xs text-slate-200 truncate">
                            QRIS Semua E-Wallet &amp; M-Banking
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-lime shrink-0">
                          Otomatis
                        </span>
                      </motion.div>
                    ) : method === "crypto" ? (
                      <motion.div
                        key="panel-crypto"
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.14 }}
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
                                  className={`flex items-center justify-between gap-2 px-3 py-2 border text-left transition-all duration-150 ${
                                    isSelected
                                      ? "border-lime bg-lime/10 text-slate-100"
                                      : "border-line bg-void/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold truncate">
                                      {d.symbol || "USDT"} · {d.name}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-400 truncate">
                                      {d.network || d.account_number}
                                    </p>
                                  </div>
                                  <CheckCircle2
                                    size={14}
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
                            Wallet crypto belum tersedia.
                          </p>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="panel-manual"
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.14 }}
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
                                    className={`flex items-center justify-between gap-2 px-3 py-2 border text-left transition-all duration-150 ${
                                      isSelected
                                        ? "border-neon bg-neon/10 text-slate-100"
                                        : "border-line bg-void/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold truncate">
                                        {d.name}
                                      </p>
                                      <p className="text-[10px] font-mono text-slate-400 truncate">
                                        {d.account_number && d.account_number !== "-"
                                          ? d.account_number
                                          : d.type?.toUpperCase() || "QRIS"}
                                      </p>
                                    </div>
                                    <CheckCircle2
                                      size={14}
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
                              aria-label="Pilih Tujuan Transfer"
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
                            Tujuan transfer belum tersedia.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Primary Action Bar */}
                <div className="sticky bottom-0 z-20 -mx-4 px-4 py-3 bg-panel/95 backdrop-blur border-t border-line sm:static sm:mx-0 sm:px-0 sm:py-0 sm:pt-1 sm:bg-transparent sm:border-t-0">
                  <div className="flex items-stretch gap-2">
                    <button
                      onClick={handleBuy}
                      disabled={
                        loading ||
                        product.stock < 1 ||
                        ((method === "manual" || method === "crypto") && !selectedDest)
                      }
                      data-testid="modal-buy-button"
                      className={`flex-1 flex items-center justify-center gap-2 ${
                        method === "crypto"
                          ? "bg-lime text-void hover:bg-neon"
                          : "bg-neon text-void hover:bg-lime"
                      } font-display font-bold text-xs uppercase tracking-wider py-3.5 px-4 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
                    >
                      {loading ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : method === "crypto" ? (
                        <Coins size={15} />
                      ) : (
                        <Zap size={15} />
                      )}
                      <span>
                        {product.stock < 1
                          ? "Stok Habis"
                          : loading
                          ? "Memproses..."
                          : method === "crypto"
                          ? `Beli · ${formatUSD(product)} USD`
                          : `Beli Sekarang · ${formatIDR(product.price)}`}
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
                      title="Tanya CS via WhatsApp"
                      className="inline-flex items-center justify-center gap-1.5 border border-line hover:border-neon bg-void/80 text-slate-200 hover:text-neon text-xs font-medium px-4 py-3.5 transition-colors duration-200 whitespace-nowrap shrink-0"
                    >
                      <MessageCircle size={15} />
                      <span>Tanya CS</span>
                    </a>
                  </div>
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
