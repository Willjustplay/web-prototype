import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ShieldCheck,
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
  Sparkles,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatIDR, formatUSD, waLink, imgSrc } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";

const badgeCls = (b) =>
  b === "Diskon Hot"
    ? "bg-coral text-white"
    : b === "Garansi 100%"
    ? "bg-lime text-void"
    : "bg-neon text-void";

const condCls = (c) => {
  const v = (c || "").toLowerCase();
  if (v === "ready") return "bg-lime text-void";
  if (v === "sold") return "bg-slate-600 text-slate-200";
  if (v === "unready") return "bg-coral text-white";
  return "border border-neon/50 text-neon bg-void";
};

export const ProductModal = ({ product, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerWa, setBuyerWa] = useState("");
  const [showDescription, setShowDescription] = useState(true);
  const [manualDestinations, setManualDestinations] = useState([]);
  const [selectedDest, setSelectedDest] = useState("");
  const [methods, setMethods] = useState([
    { id: "manual", label: "Transfer / QRIS" },
    { id: "crypto", label: "Crypto (USDT / Coin)" },
  ]);
  const [method, setMethod] = useState("manual");
  const [imageFit, setImageFit] = useState("contain");
  const paykitaAvailable = methods.some((m) => m.id === "paykita");
  const fiatDestinations = manualDestinations.filter((d) => d.type !== "crypto");
  const cryptoDestinations = manualDestinations.filter((d) => d.type === "crypto");
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
      ).slice(0, 3)
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
    setLoading(false);
    setActive(0);
    setZoom(false);
    setBuyerEmail(user?.email || "");
    api
      .get("/payments/manual-destinations")
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setManualDestinations(list);
        const fiats = list.filter((d) => d.type !== "crypto");
        const firstList = fiats.length > 0 ? fiats : list;
        if (firstList.length > 0) {
          setSelectedDest((cur) =>
            firstList.some((d) => d.id === cur) ? cur : firstList[0].id
          );
        }
      })
      .catch(() => {});
    api
      .get("/payments/methods", { params: { product_id: product?.id } })
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length) {
          setMethods(r.data);
          setMethod(
            r.data.some((m) => m.id === "paykita") ? "paykita" : "manual"
          );
        }
      })
      .catch(() => {});
  }, [product, user?.email]);

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

  const activeDestObj = manualDestinations.find((d) => d.id === selectedDest);

  const handleBuy = async () => {
    if (!buyerEmail.trim() && !buyerWa.trim()) {
      toast.error("Isi email atau nomor WhatsApp untuk pengiriman pesanan");
      return;
    }
    const buyer = {
      buyer_email: buyerEmail.trim(),
      buyer_whatsapp: buyerWa.trim(),
    };
    setLoading(true);
    try {
      if (method === "paykita") {
        const { data } = await api.post("/payments/paykita/checkout", {
          ...buyer,
          product_id: product.id,
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
        className="max-w-4xl w-[calc(100vw-16px)] sm:w-[95vw] max-h-[85dvh] sm:max-h-[90vh] bg-panel border-line text-slate-100 p-0 overflow-y-auto overflow-x-hidden gap-0 focus:outline-none [&>button:last-child]:z-30 [&>button:last-child]:bg-void/80 [&>button:last-child]:border [&>button:last-child]:border-line [&>button:last-child]:p-1.5 [&>button:last-child]:text-slate-200 [&>button:last-child]:hover:text-neon [&>button:last-child]:hover:border-neon [&>button:last-child]:opacity-100"
      >
        {product && (
          <DialogTitle className="sr-only">{product.title}</DialogTitle>
        )}
        {product && (
          <div className="grid grid-cols-1 md:grid-cols-12 min-w-0 w-full">
            {/* LEFT COLUMN: Balanced Aspect-Ratio Product Photo & Gallery */}
            <div className="md:col-span-6 min-w-0 w-full bg-void/80 border-b md:border-b-0 md:border-r border-line p-3.5 sm:p-5 flex flex-col justify-between gap-3">
              {/* Main 4:3 Media Frame with Ambient Backdrop */}
              <div
                className="relative aspect-[4/3] w-full bg-void border border-line/80 group overflow-hidden touch-pan-y select-none"
                {...swipeHandlers}
                data-testid="modal-swipe-surface"
              >
                {/* Blurred Ambient Fill so any photo ratio looks cohesive */}
                <img
                  src={imgSrc(gallery[active] || product.image)}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30 pointer-events-none"
                />
                <div className="absolute inset-0 bg-radial from-transparent via-void/30 to-void/80 pointer-events-none" />

                {/* Crisp Main Product Image with Proper Ratio */}
                <AnimatePresence mode="wait">
                  <motion.img
                    key={gallery[active] || product.image}
                    src={imgSrc(gallery[active] || product.image)}
                    alt={product.title}
                    data-testid="modal-main-image"
                    draggable="false"
                    initial={{ opacity: 0.4, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0.4, scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setZoom(true)}
                    className={`relative z-10 w-full h-full cursor-zoom-in transition-transform duration-300 ease-out ${
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

                {/* Top Badges */}
                {mBadges.length > 0 && (
                  <div
                    className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5"
                    data-testid="modal-badges"
                  >
                    {mBadges.map((b) => (
                      <span
                        key={b}
                        className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 shadow ${badgeCls(
                          b
                        )}`}
                      >
                        {b}
                      </span>
                    ))}
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
                      className="px-2 h-8 bg-void/80 backdrop-blur text-[9px] font-mono uppercase tracking-wider text-slate-300 hover:text-neon border border-line/70 hover:border-neon transition-colors"
                    >
                      {imageFit === "contain" ? "Full" : "Crop"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(true)}
                      data-testid="modal-zoom-button"
                      aria-label="Perbesar gambar"
                      className="grid place-items-center w-8 h-8 bg-void/80 backdrop-blur text-slate-200 hover:text-neon border border-line/70 hover:border-neon transition-colors duration-200"
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
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-8 h-8 bg-void/80 backdrop-blur border border-line/70 hover:border-neon text-slate-200 hover:text-neon opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      data-testid="modal-next-button"
                      aria-label="Gambar selanjutnya"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-8 h-8 bg-void/80 backdrop-blur border border-line/70 hover:border-neon text-slate-200 hover:text-neon opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                {/* Bottom Counter Pill */}
                <div className="absolute bottom-2.5 right-2.5 z-20 bg-void/85 backdrop-blur border border-line/70 px-2 py-0.5 text-[9px] font-mono text-slate-400">
                  {active + 1} / { Math.max(gallery.length, 1) } FOTO
                </div>
              </div>

              {/* Thumbnail Strip & Quick Specs Underneath Image */}
              <div className="space-y-3">
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
                        className={`relative w-14 h-11 shrink-0 overflow-hidden border transition-all duration-200 ${
                          active === i
                            ? "border-neon ring-1 ring-neon/40 opacity-100"
                            : "border-line/60 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={imgSrc(g)}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Compact 3-Column Spec Strip */}
                <div className="grid grid-cols-3 gap-px bg-line border border-line text-center">
                  <div className="bg-panel/90 px-2 py-2.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                      Rank / Tier
                    </p>
                    <p className="text-[11px] font-bold mt-0.5 truncate">
                      {product.rank || "-"}
                    </p>
                  </div>
                  <div className="bg-panel/90 px-2 py-2.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                      Stok Tersedia
                    </p>
                    <p
                      className="text-[11px] font-bold mt-0.5"
                      data-testid="modal-stock"
                    >
                      {product.stock}
                    </p>
                  </div>
                  <div className="bg-panel/90 px-2 py-2.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                      Garansi
                    </p>
                    <p
                      className="text-[11px] font-bold mt-0.5 text-lime"
                      data-testid="modal-warranty"
                    >
                      {product.warranty || "100%"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Streamlined Info & Dynamic Checkout Module */}
            <div className="md:col-span-6 min-w-0 w-full p-4 sm:p-6 flex flex-col justify-between gap-4">
              <div className="min-w-0">
                {/* Top Meta & Condition Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pr-7">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-neon truncate">
                      {product.game} &bull; {product.category}
                    </span>
                    {product.condition && (
                      <span
                        className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${condCls(
                          product.condition
                        )}`}
                        data-testid="modal-condition"
                      >
                        {product.condition}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-lime shrink-0">
                    <Star size={11} fill="currentColor" />
                    <span className="text-[11px] font-mono font-bold">
                      {product.rating}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ({product.sold} terjual)
                    </span>
                  </div>
                </div>

                {/* Title & Prominent Price Header */}
                <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2 sm:gap-3 border-b border-line/70 pb-3">
                  <h3
                    className="font-display font-bold text-sm sm:text-lg leading-snug text-slate-100 break-words min-w-0"
                    data-testid="modal-product-title"
                  >
                    {product.title}
                  </h3>
                  <div className="flex flex-col items-end shrink-0">
                    <p
                      className="font-mono font-bold text-lg sm:text-2xl text-neon tabular-nums"
                      data-testid="modal-price"
                    >
                      {formatIDR(product.price)}
                    </p>
                    <p
                      className="font-mono text-xs sm:text-sm font-semibold text-lime tabular-nums"
                      data-testid="modal-price-usd"
                    >
                      {formatUSD(product)} USD
                    </p>
                  </div>
                </div>

                {/* Compact Collapsible Description */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
                      Deskripsi Produk
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDescription((prev) => !prev)}
                      data-testid="toggle-product-description"
                      aria-label={
                        showDescription
                          ? "Sembunyikan deskripsi produk"
                          : "Tampilkan deskripsi produk"
                      }
                      title={showDescription ? "Sembunyikan" : "Tampilkan"}
                      className="inline-flex items-center justify-center w-5 h-5 text-xs font-mono font-bold text-neon hover:text-lime border border-line hover:border-neon/40 bg-void/50 transition-colors"
                    >
                      {showDescription ? "<" : ">"}
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {showDescription && (
                      <motion.p
                        key="modal-description"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-y-auto max-h-20 text-xs leading-relaxed text-slate-400 pr-1"
                        data-testid="modal-product-description"
                      >
                        {product.description ||
                          "Tidak ada rincian deskripsi tambahan untuk produk ini."}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* DYNAMIC & SIMPLE CHECKOUT BOX */}
              <div className="bg-void/70 border border-line p-3.5 sm:p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-neon">
                    <Sparkles size={12} /> Checkout Cepat
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Proses Instan
                  </span>
                </div>

                {/* Contact Inputs */}
                <div
                  className="grid grid-cols-2 gap-2"
                  data-testid="buyer-contact-fields"
                >
                  <label className="block">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                      No. WhatsApp
                    </span>
                    <div className="relative mt-1">
                      <Phone
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                      />
                      <input
                        type="tel"
                        value={buyerWa}
                        onChange={(e) => setBuyerWa(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        data-testid="buyer-whatsapp-input"
                        className="w-full bg-panel border border-line focus:border-neon/70 outline-none text-xs font-mono pl-7 pr-2 py-2 placeholder:text-slate-600 transition-colors"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                      Email Aktif
                    </span>
                    <div className="relative mt-1">
                      <Mail
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                      />
                      <input
                        type="email"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        placeholder="kamu@email.com"
                        data-testid="buyer-email-input"
                        className="w-full bg-panel border border-line focus:border-neon/70 outline-none text-xs font-mono pl-7 pr-2 py-2 placeholder:text-slate-600 transition-colors"
                      />
                    </div>
                  </label>
                </div>

                {/* Payment Method Selector Menu (Transfer/QRIS vs Crypto vs Auto QRIS) */}
                <div className="space-y-2.5">
                  <div
                    className={`grid ${
                      paykitaAvailable ? "grid-cols-3" : "grid-cols-2"
                    } gap-1.5 p-1 bg-panel border border-line`}
                    data-testid="payment-method-tabs"
                  >
                    {paykitaAvailable && (
                      <button
                        type="button"
                        onClick={() => switchPaymentMethod("paykita")}
                        data-testid="method-paykita"
                        className={`flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider py-2 transition-all ${
                          method === "paykita"
                            ? "bg-neon text-void shadow-sm"
                            : "text-slate-400 hover:text-neon"
                        }`}
                      >
                        <QrCode size={12} /> QRIS Auto
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => switchPaymentMethod("manual")}
                      data-testid="method-manual"
                      className={`flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider py-2 transition-all ${
                        method === "manual"
                          ? "bg-neon text-void shadow-sm"
                          : "text-slate-400 hover:text-neon"
                      }`}
                    >
                      <Wallet size={12} /> Transfer / QRIS
                    </button>
                    <button
                      type="button"
                      onClick={() => switchPaymentMethod("crypto")}
                      data-testid="method-crypto"
                      className={`flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider py-2 transition-all ${
                        method === "crypto"
                          ? "bg-lime text-void shadow-sm"
                          : "text-slate-400 hover:text-lime"
                      }`}
                    >
                      <Coins size={12} /> Crypto (USD)
                    </button>
                  </div>

                  {method === "paykita" ? (
                    <div
                      className="flex items-start gap-2.5 bg-panel/90 border border-neon/30 p-2.5"
                      data-testid="paykita-info-box"
                    >
                      <QrCode size={16} className="text-neon shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-neon">
                          QRIS Otomatis (Verifikasi Instan)
                        </p>
                        <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                          Scan kode QRIS dari e-wallet/m-banking apa saja. Pesanan langsung aktif otomatis.
                        </p>
                      </div>
                    </div>
                  ) : method === "crypto" ? (
                    <div data-testid="crypto-payment-panel" className="space-y-2">
                      <div className="flex items-center justify-between bg-lime/10 border border-lime/30 px-2.5 py-1.5">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-lime flex items-center gap-1.5">
                          <Coins size={11} /> Pembayaran Crypto / Web3
                        </span>
                        <span className="text-[11px] font-mono font-bold text-lime tabular-nums">
                          {formatUSD(product)} USD
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                          Pilih Aset &amp; Jaringan (Network)
                        </span>
                        {activeDestObj?.network && (
                          <span className="text-[9px] font-mono text-lime">
                            Network: <strong>{activeDestObj.network}</strong>
                          </span>
                        )}
                      </div>

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
                                className={`group relative flex items-center justify-between gap-2 px-2.5 py-2 border text-left transition-all active:scale-[0.98] ${
                                  isSelected
                                    ? "border-lime bg-lime/10 text-slate-100"
                                    : "border-line bg-panel/80 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                                        isSelected
                                          ? "border-lime bg-lime text-void"
                                          : "border-line text-slate-400"
                                      }`}
                                    >
                                      {d.symbol || "CRYPTO"}
                                    </span>
                                    <p className="text-[11px] font-bold truncate">
                                      {d.name}
                                    </p>
                                  </div>
                                  <p className="text-[9px] font-mono text-slate-400 truncate mt-0.5">
                                    {d.network
                                      ? `Net: ${d.network}`
                                      : d.account_number}
                                  </p>
                                </div>
                                <CheckCircle2
                                  size={14}
                                  className={`shrink-0 transition-opacity ${
                                    isSelected
                                      ? "text-lime opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-coral py-1">
                          Belum ada wallet crypto aktif. Silakan gunakan metode Transfer / QRIS.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                          Pilih Metode Pembayaran
                        </span>
                        {activeDestObj?.account_name && (
                          <span className="text-[10px] font-mono text-slate-400">
                            a/n{" "}
                            <strong className="text-slate-200">
                              {activeDestObj.account_name}
                            </strong>
                          </span>
                        )}
                      </div>

                      {activeChannelList.length > 0 ? (
                        <>
                          {/* Interactive Payment Channel Cards */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {activeChannelList.map((d) => {
                              const isSelected = d.id === selectedDest;
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => setSelectedDest(d.id)}
                                  className={`group relative flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2 border text-left transition-all active:scale-[0.98] ${
                                    isSelected
                                      ? "border-neon bg-neon/10 text-slate-100"
                                      : "border-line bg-panel/80 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 border ${
                                          isSelected
                                            ? "border-neon/60 bg-neon text-void"
                                            : "border-line text-slate-400"
                                        }`}
                                      >
                                        {d.type || "MANUAL"}
                                      </span>
                                      <p className="text-[11px] font-bold truncate">
                                        {d.name}
                                      </p>
                                    </div>
                                    {d.account_number &&
                                      d.account_number !== "-" && (
                                        <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                          {d.account_number}
                                        </p>
                                      )}
                                  </div>
                                  <CheckCircle2
                                    size={14}
                                    className={`shrink-0 transition-opacity ${
                                      isSelected
                                        ? "text-neon opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>

                          {/* Accessible Select synced for compatibility */}
                          <div className="relative mt-1.5">
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
                          </div>
                        </>
                      ) : (
                        <p className="text-[10px] text-coral py-1">
                          Tidak ada tujuan transfer manual yang tersedia saat ini.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Sticky Mobile / Inline Desktop Action Buttons Row */}
                <div className="sticky bottom-0 z-20 -mx-3.5 px-3.5 py-2.5 bg-void/95 backdrop-blur-md border-t border-line/80 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:pt-1 sm:bg-transparent sm:border-t-0 flex items-stretch gap-2">
                  <button
                    onClick={handleBuy}
                    disabled={
                      loading ||
                      product.stock < 1 ||
                      ((method === "manual" || method === "crypto") && !selectedDest)
                    }
                    data-testid="modal-buy-button"
                    className={`flex-1 flex items-center justify-center gap-2 ${
                      method === "crypto" ? "bg-lime text-void hover:bg-neon" : "bg-neon text-void hover:bg-lime"
                    } font-display font-bold text-xs uppercase tracking-[0.16em] sm:tracking-[0.18em] py-3.5 px-4 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]`}
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
                        ? `Bayar Crypto • ${formatUSD(product)} USD (${activeDestObj?.symbol || "USDT"})`
                        : `Beli • ${formatIDR(product.price)} (${formatUSD(product)})`}
                    </span>
                  </button>

                  <a
                    href={waLink(
                      `Halo WillJustPlay, saya mau tanya ketersediaan produk: ${product.title} (${formatIDR(
                        product.price
                      )} / ${formatUSD(product)})`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="modal-wa-button"
                    title="Tanya via WhatsApp"
                    className="inline-flex items-center justify-center gap-1.5 border border-line hover:border-neon/60 bg-panel text-slate-300 hover:text-neon text-[10px] font-mono font-bold uppercase tracking-wider px-3.5 py-3.5 transition-colors duration-300 shrink-0 active:scale-95"
                  >
                    <MessageCircle size={14} />
                    <span>WA</span>
                  </a>
                </div>

                <p className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-500 text-center">
                  <ShieldCheck size={12} className="text-lime shrink-0" />
                  {method === "paykita"
                    ? "QRIS otomatis — pesanan aktif begitu pembayaran terdeteksi."
                    : method === "crypto"
                    ? "Transfer Crypto instan — scan QR wallet atau salin address di langkah berikutnya."
                    : "Transaksi aman & bergaransi. Upload bukti di langkah berikutnya."}
                </p>
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
