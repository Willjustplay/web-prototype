import { useRef, useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
} from "framer-motion";
import {
  ArrowDown,
  Share2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Timer,
  BadgeCheck,
  Zap,
  Star,
  Sparkles,
  ArrowUpRight,
  Flame,
  Activity,
} from "lucide-react";
import { formatIDR, formatUSD, imgSrc, api } from "@/lib/api";
import { socialIcon } from "@/lib/socials";

const LINES = [
  { text: "BELI AKUN GAME", cls: "text-slate-100" },
  { text: "& JASA JOKI", cls: "text-neon" },
  { text: "INSTANT.", cls: "text-stroke" },
];

const EASE = [0.16, 1, 0.3, 1];

const FALLBACK_SPOTLIGHTS = [
  {
    id: "fallback-1",
    title: "Akun Sultan Mythic Glory Full Collector",
    game: "Mobile Legends",
    category: "akun",
    price: 4500000,
    original_price: 5200000,
    rating: 4.9,
    sold: 214,
    stock: 1,
    featured: true,
    seller_verified: true,
    specs: { Rank: "Mythic Immortal", Skin: "320+ Skin", Winrate: "74.5%" },
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "fallback-2",
    title: "Paket Joki Cepat Legend ke Mythic",
    game: "Mobile Legends",
    category: "joki",
    price: 185000,
    original_price: 240000,
    rating: 5.0,
    sold: 512,
    stock: 99,
    featured: true,
    seller_verified: true,
    specs: { Estimasi: "6-12 Jam", Penjoki: "Pro Squad", Garansi: "Anti-Ban" },
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "fallback-3",
    title: "Akun Radiant Peak Full Bundle VCT",
    game: "Valorant",
    category: "akun",
    price: 2850000,
    original_price: 3300000,
    rating: 4.9,
    sold: 148,
    stock: 2,
    featured: true,
    seller_verified: true,
    specs: { Rank: "Immortal 3", Skin: "Champions Bundle", Region: "AP / ID" },
    image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=900&q=80",
  },
];

const LIVE_FEED_EVENTS = [
  {
    tag: "TRANSAKSI LIVE",
    text: "Akun Mythic Glory Full Skin baru saja terjual",
    meta: "2 menit lalu • Terverifikasi",
    tone: "text-lime border-lime/40 bg-lime/10",
  },
  {
    tag: "TOP UP KILAT",
    text: "Top Up 257 Diamonds MLBB sukses terkirim",
    meta: "8 detik • Otomatis",
    tone: "text-neon border-neon/40 bg-neon/10",
  },
  {
    tag: "JOKI SELESAI",
    text: "Order Joki Rank Legend → Mythic Honor tuntas",
    meta: "11 menit lalu • Winrate 88%",
    tone: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  },
  {
    tag: "STOK BARU",
    text: "Akun Sultan Valorant & Genshin siap checkout",
    meta: "Baru saja • Garansi 100%",
    tone: "text-coral border-coral/40 bg-coral/10",
  },
];

const compact = (n) =>
  n >= 1000
    ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}K+`
    : `${n}`;

export const Hero = ({ featured, products = [], onSelect }) => {
  const safeProducts = useMemo(
    () =>
      (Array.isArray(products) ? products : []).filter(
        (p) =>
          p &&
          p.product_type !== "topup" &&
          String(p.category || "").toLowerCase() !== "topup game" &&
          !p.denomination_code &&
          !p.denomination &&
          !String(p.id || "").startsWith("tp-") &&
          !String(p.id || "").startsWith("topup-")
      ),
    [products]
  );
  const totalSold = safeProducts.reduce((s, p) => s + (p.sold || 0), 0);
  const avgRating = safeProducts.length
    ? (
        safeProducts.reduce((s, p) => s + (p.rating || 0), 0) /
        safeProducts.length
      ).toFixed(1)
    : "5.0";

  const spotlightList = useMemo(() => {
    if (!safeProducts.length) return FALLBACK_SPOTLIGHTS;
    const feat = safeProducts.filter((p) => p.featured);
    const rest = safeProducts.filter((p) => !p.featured);
    const combined = [...feat, ...rest];
    if (featured && !combined.some((p) => p.id === featured.id)) {
      combined.unshift(featured);
    }
    return combined.slice(0, 5);
  }, [safeProducts, featured]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [feedIndex, setFeedIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= spotlightList.length) {
      setActiveIndex(0);
    }
  }, [spotlightList.length, activeIndex]);

  useEffect(() => {
    if (isPaused || spotlightList.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % spotlightList.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, spotlightList.length]);

  useEffect(() => {
    const feedTimer = setInterval(() => {
      setFeedIndex((prev) => (prev + 1) % LIVE_FEED_EVENTS.length);
    }, 3600);
    return () => clearInterval(feedTimer);
  }, []);

  const highlight = spotlightList[activeIndex] || spotlightList[0] || FALLBACK_SPOTLIGHTS[0];
  const currentFeed = LIVE_FEED_EVENTS[feedIndex];

  const specEntries = useMemo(() => {
    if (!highlight?.specs || typeof highlight.specs !== "object") {
      return [
        ["Status", "Siap Kirim"],
        ["Garansi", "100% Aman"],
        ["Proses", "Instan"],
      ];
    }
    const entries = Object.entries(highlight.specs).slice(0, 3);
    return entries.length
      ? entries
      : [
          ["Status", "Siap Kirim"],
          ["Garansi", "100% Aman"],
        ];
  }, [highlight]);

  const discountPct = useMemo(() => {
    if (
      highlight?.original_price &&
      highlight?.price &&
      highlight.original_price > highlight.price
    ) {
      return Math.round(
        ((highlight.original_price - highlight.price) /
          highlight.original_price) *
          100
      );
    }
    return null;
  }, [highlight]);

  const ref = useRef(null);
  const socialRef = useRef(null);
  const touchStartX = useRef(null);
  const [socialLinks, setSocialLinks] = useState([]);
  const [socialOpen, setSocialOpen] = useState(false);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
    setIsPaused(true);
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current !== null && e.changedTouches?.[0]) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 40 && spotlightList.length > 1) {
        if (dx < 0) {
          setActiveIndex((prev) => (prev + 1) % spotlightList.length);
        } else {
          setActiveIndex(
            (prev) => (prev - 1 + spotlightList.length) % spotlightList.length
          );
        }
      }
    }
    touchStartX.current = null;
    setIsPaused(false);
  };

  useEffect(() => {
    api
      .get("/social-links")
      .then(({ data }) => setSocialLinks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (socialRef.current && !socialRef.current.contains(e.target))
        setSocialOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const rotateX = useSpring(useTransform(my, [0, 1], [4, -4]), {
    stiffness: 120,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-5, 5]), {
    stiffness: 120,
    damping: 18,
  });

  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const handleOpenProduct = () => {
    if (!highlight) return;
    if (onSelect && !String(highlight.id).startsWith("fallback-")) {
      onSelect(highlight);
      return;
    }
    const katalogEl = document.getElementById("katalog");
    if (katalogEl) katalogEl.scrollIntoView({ behavior: "smooth" });
  };

  const prevSlide = (e) => {
    e.stopPropagation();
    setActiveIndex(
      (prev) => (prev - 1 + spotlightList.length) % spotlightList.length
    );
  };

  const nextSlide = (e) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % spotlightList.length);
  };

  return (
    <section
      id="top"
      ref={ref}
      onMouseMove={onMove}
      data-testid="hero-section"
      className="relative overflow-hidden grid-bg pt-28 pb-12 sm:pt-32 sm:pb-20 md:pt-32 md:pb-24"
    >
      {/* Dynamic Ambient Backdrops */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-neon/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/4 right-0 w-[520px] h-[520px] rounded-full bg-neon/10 blur-[150px]" />
      <div className="pointer-events-none absolute bottom-0 right-12 w-[420px] h-[420px] rounded-full bg-coral/10 blur-[140px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-7 md:gap-8 lg:gap-10 items-center relative w-full overflow-hidden sm:overflow-visible">
        {/* LEFT COLUMN: Dynamic Responsive Headline + CTAs + Metrics */}
        <div className="md:col-span-6 lg:col-span-7 min-w-0 w-full max-w-full">
          {/* Dynamic Eyebrow Status Strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-4 sm:mb-6 max-w-full"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime" />
            </span>
            <p
              className="text-[9px] min-[380px]:text-[10px] sm:text-xs uppercase tracking-[0.08em] min-[420px]:tracking-[0.14em] sm:tracking-[0.22em] text-neon/95 font-mono font-semibold leading-tight break-words min-w-0"
              data-testid="hero-eyebrow"
            >
              Store Game Indonesia &bull; 100% Garansi Aman
            </p>
          </motion.div>

          {/* Fluid Responsive Kinetic Headline */}
          <h1
            className="font-display font-black uppercase tracking-tighter leading-[0.96] text-[clamp(1.6rem,7.2vw,2.45rem)] sm:text-[clamp(2.1rem,4.8vw,3.15rem)] md:text-[clamp(1.95rem,3.5vw,4.1rem)] break-words max-w-full"
            data-testid="hero-title"
          >
            {LINES.map((line, i) => (
              <span key={i} className="block overflow-hidden pb-1">
                <motion.span
                  initial={{ y: "115%" }}
                  animate={{ y: 0 }}
                  transition={{
                    delay: 0.2 + i * 0.14,
                    duration: 0.9,
                    ease: EASE,
                  }}
                  className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${line.cls}`}
                >
                  <span>{line.text}</span>
                  {i === 2 && (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={feedIndex}
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-mono font-bold tracking-[0.14em] uppercase bg-neon/10 border border-neon/50 text-neon shadow-[0_0_16px_rgba(0,240,255,0.2)] align-middle"
                      >
                        <Zap size={11} className="text-lime shrink-0" />
                        <span>
                          {
                            [
                              "PROSES 1-5 MENIT",
                              "GARANSI PENUH",
                              "OTOMATIS 24/7",
                              "TERVERIFIKASI",
                            ][feedIndex % 4]
                          }
                        </span>
                      </motion.span>
                    </AnimatePresence>
                  )}
                </motion.span>
              </span>
            ))}
          </h1>

          {/* Animated Cyber Accent Bar */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.85, duration: 0.9, ease: EASE }}
            className="relative mt-4 sm:mt-5 h-[3px] w-36 sm:w-48 origin-left bg-neon/40 overflow-hidden glow-cyan"
            data-testid="hero-accent-bar"
          >
            <motion.span
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-lime to-neon"
            />
          </motion.div>

          {/* Responsive Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.8, ease: EASE }}
            className="mt-4 sm:mt-5 max-w-xl text-xs min-[390px]:text-[13px] sm:text-base leading-relaxed text-slate-300/90 break-words"
            data-testid="hero-subtitle"
          >
            Store game terpercaya, dapatkan akun game berkualitas dan joki
            dengan harga terjangkau, proses cepat dan tanpa ribet juga
            bergaransi.
          </motion.p>

          {/* Interactive Quick-Trust Feature Chips */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.82, duration: 0.7, ease: EASE }}
            className="mt-3.5 sm:mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2"
          >
            {[
              { icon: ShieldCheck, label: "Anti-Hackback", tone: "text-lime border-lime/30 bg-lime/5" },
              { icon: Timer, label: "Kirim Instan", tone: "text-neon border-neon/30 bg-neon/5" },
              { icon: BadgeCheck, label: "Bergaransi", tone: "text-amber-300 border-amber-400/30 bg-amber-400/5" },
            ].map(({ icon: ChipIcon, label, tone }) => (
              <a
                key={label}
                href="#katalog"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider border transition-transform duration-200 hover:-translate-y-0.5 active:scale-95 ${tone}`}
              >
                <ChipIcon size={11} className="shrink-0" />
                <span>{label}</span>
              </a>
            ))}
          </motion.div>

          {/* Adaptive Responsive CTA Button Group (Never Truncates on Any Device) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.8, ease: EASE }}
            className="mt-5 sm:mt-7 grid grid-cols-1 min-[350px]:grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3.5 w-full"
          >
            <a
              href="#katalog"
              data-testid="hero-cta-catalog"
              className="group relative overflow-hidden inline-flex items-center justify-center gap-1.5 sm:gap-2.5 border border-line bg-panel/70 text-slate-200 hover:border-neon hover:text-neon font-display font-bold text-[10px] min-[390px]:text-[11px] sm:text-xs uppercase tracking-[0.06em] min-[400px]:tracking-[0.1em] sm:tracking-[0.18em] px-2.5 min-[390px]:px-4 sm:px-6 py-3 sm:py-3.5 transition-all duration-300 active:scale-95 min-w-0"
            >
              <span className="whitespace-nowrap">Jelajahi Katalog</span>
              <ArrowDown
                size={13}
                className="transition-transform duration-300 group-hover:translate-y-1 shrink-0 text-neon"
              />
            </a>
            <Link
              to="/topup"
              data-testid="hero-cta-topup"
              className="group relative overflow-hidden inline-flex items-center justify-center gap-1.5 sm:gap-2.5 bg-neon text-void font-display font-bold text-[10px] min-[390px]:text-[11px] sm:text-xs uppercase tracking-[0.06em] min-[400px]:tracking-[0.1em] sm:tracking-[0.18em] px-2.5 min-[390px]:px-4 sm:px-6 py-3 sm:py-3.5 hover:bg-lime shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_28px_rgba(0,240,255,0.55)] transition-all duration-300 active:scale-95 min-w-0"
            >
              <Zap size={13} className="shrink-0 transition-transform duration-300 group-hover:scale-110" />
              <span className="whitespace-nowrap">Top Up Instan</span>
            </Link>
            <div className="relative min-[350px]:col-span-2 sm:col-span-1" ref={socialRef}>
              <button
                type="button"
                onClick={() => setSocialOpen((o) => !o)}
                data-testid="hero-cta-social"
                aria-haspopup="true"
                aria-expanded={socialOpen}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-line bg-panel/60 hover:border-neon/60 text-slate-300 hover:text-neon font-display font-bold text-[10px] min-[390px]:text-[11px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.2em] px-4 sm:px-6 py-2.5 sm:py-3.5 transition-all duration-300 active:scale-95"
              >
                <Share2 size={14} className="text-neon shrink-0" />
                <span className="whitespace-nowrap">Sosial Media</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-300 shrink-0 ${
                    socialOpen ? "rotate-180 text-neon" : ""
                  }`}
                />
              </button>
              {socialOpen && (
                <div
                  className="absolute left-0 right-0 sm:right-auto top-full mt-2 sm:w-60 bg-panel border border-line z-50 py-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200"
                  data-testid="hero-social-menu"
                >
                  {socialLinks.length === 0 ? (
                    <p
                      className="px-4 py-3 text-[11px] font-mono text-slate-500"
                      data-testid="hero-social-empty"
                    >
                      Belum ada sosial media
                    </p>
                  ) : (
                    socialLinks.map((s) => {
                      const Icon = socialIcon(s.platform);
                      return (
                        <a
                          key={s.id}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setSocialOpen(false)}
                          data-testid={`hero-social-link-${s.id || s.platform}`}
                          className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-neon hover:bg-void transition-colors"
                        >
                          <Icon size={15} /> {s.name}
                        </a>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 1 }}
            className="mt-6 sm:mt-9 grid grid-cols-3 w-full max-w-md divide-x divide-line border border-line bg-void/70 backdrop-blur-sm"
            data-testid="hero-metrics"
          >
            {[
              {
                v: compact(totalSold || 1240),
                l: "Produk Terjual",
                t: "hero-metric-sold",
              },
              {
                v: `${avgRating}/5`,
                l: "Rating Pembeli",
                t: "hero-metric-rating",
              },
              {
                v: "10.00-22.00",
                l: "Jam Operasional",
                t: "hero-metric-cs",
              },
            ].map((s) => (
              <div key={s.l} className="px-2 sm:px-4 py-2.5 sm:py-3.5 text-center sm:text-left min-w-0">
                <p
                  className="font-display font-bold text-xs sm:text-xl text-neon truncate"
                  data-testid={s.t}
                >
                  {s.v}
                </p>
                <p className="text-[8px] sm:text-[10px] uppercase tracking-wider sm:tracking-widest text-slate-500 mt-0.5 sm:mt-1 truncate">
                  {s.l}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT COLUMN: Dynamic Interactive Showcase Deck */}
        <motion.div
          className="md:col-span-6 lg:col-span-5 min-w-0 w-full"
          style={{ perspective: 1200 }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.8, ease: EASE }}
            style={{ rotateX, rotateY }}
            className="relative w-full max-w-full"
            data-testid="hero-featured-card"
          >
            {/* Live Activity Ticker Bar Above Spotlight */}
            <div className="mb-3 flex items-center justify-between gap-2.5 bg-panel/90 backdrop-blur-md border border-line px-3 py-2.5 shadow-lg overflow-hidden">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-lime" />
                </span>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={feedIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${currentFeed.tone}`}
                      >
                        {currentFeed.tag}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 truncate">
                        {currentFeed.meta}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-200 font-medium truncate mt-0.5">
                      {currentFeed.text}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <Activity size={14} className="text-neon shrink-0 animate-pulse" />
            </div>

            {/* Glowing Cyber Frame */}
            <div className="relative w-full max-w-full overflow-hidden">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-neon/60 via-neon/10 to-coral/50 pointer-events-none opacity-80" />
              <div className="relative bg-panel border border-line glow-cyan overflow-hidden">
                {/* Auto-play Progress Bar */}
                <div className="h-1 w-full bg-void/90 overflow-hidden flex">
                  {spotlightList.map((item, idx) => (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      aria-label={`Pilih produk unggulan ${idx + 1}`}
                      className="flex-1 h-full bg-void/80 relative overflow-hidden border-r border-line/50 last:border-r-0"
                    >
                      {idx === activeIndex && (
                        <motion.span
                          key={`${activeIndex}-${isPaused ? "paused" : "play"}`}
                          initial={{ width: "0%" }}
                          animate={{ width: isPaused ? "100%" : "100%" }}
                          transition={{
                            duration: isPaused ? 0.2 : 4.5,
                            ease: "linear",
                          }}
                          className="block h-full bg-gradient-to-r from-neon to-lime"
                        />
                      )}
                      {idx < activeIndex && (
                        <span className="block h-full w-full bg-neon/60" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Top HUD Header */}
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-line bg-void/50 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles size={12} className="text-neon shrink-0" />
                    <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.16em] sm:tracking-[0.22em] text-slate-300 truncate">
                      Spotlight Showcase
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-neon">
                      {String(activeIndex + 1).padStart(2, "0")} /{" "}
                      {String(spotlightList.length).padStart(2, "0")}
                    </span>
                    <div className="flex items-center border border-line bg-panel">
                      <button
                        type="button"
                        onClick={prevSlide}
                        aria-label="Produk sebelumnya"
                        className="p-1 text-slate-400 hover:text-neon hover:bg-void transition-colors"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={nextSlide}
                        aria-label="Produk selanjutnya"
                        className="p-1 text-slate-400 hover:text-neon hover:bg-void transition-colors border-l border-line"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Spotlight Visual */}
                <div
                  onClick={handleOpenProduct}
                  className="relative aspect-[16/10] bg-void overflow-hidden cursor-pointer group"
                >
                  <img
                    src={imgSrc(highlight?.image)}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-35 pointer-events-none"
                  />
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={highlight?.id || highlight?.title}
                      src={imgSrc(highlight?.image)}
                      alt={highlight?.title || "Produk unggulan"}
                      initial={{ opacity: 0, scale: 1.03 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="relative z-10 w-full h-full object-contain p-1.5 transition-transform duration-700 group-hover:scale-105"
                    />
                  </AnimatePresence>
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-panel via-transparent to-transparent pointer-events-none" />
                  <div className="holo-shimmer z-10 pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-20 flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 bg-neon text-void text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest px-2 py-0.5 sm:px-2.5 sm:py-1 shadow-md">
                      <BadgeCheck size={11} /> Unggulan
                    </span>
                    <span className="flex items-center gap-1 bg-void/85 backdrop-blur-md border border-line text-slate-200 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1">
                      <Flame size={10} className="text-coral" />
                      {highlight?.category === "joki"
                        ? "Jasa Joki Pro"
                        : "Akun Sultan"}
                    </span>
                  </div>

                  {discountPct && (
                    <span className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 bg-coral text-white text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 sm:py-1 shadow-md">
                      Hemat {discountPct}%
                    </span>
                  )}

                  {/* Quick Spec Pills Overlay */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 z-20 flex items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1 min-w-0">
                      {specEntries.slice(0, 2).map(([k, v]) => (
                        <span
                          key={k}
                          className="bg-void/85 backdrop-blur-md border border-line/80 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-mono text-slate-300 truncate max-w-[130px] sm:max-w-none"
                        >
                          <span className="text-slate-500">{k}:</span>{" "}
                          <span className="text-neon font-semibold">{v}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 bg-void/90 backdrop-blur-md border border-amber-400/40 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-mono text-amber-300 shrink-0">
                      <Star
                        size={10}
                        className="fill-amber-400 text-amber-400"
                      />
                      <span>{highlight?.rating || "5.0"}</span>
                    </div>
                  </div>
                </div>

                {/* Spotlight Details & Direct Action */}
                <div className="p-3.5 sm:p-5 border-t border-line bg-panel">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-neon font-mono font-semibold truncate">
                      {highlight?.game || "Mobile Legends"}
                    </p>
                    <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 shrink-0">
                      {highlight?.sold ?? 214} terjual &bull; Stok{" "}
                      {highlight?.stock ?? 1}
                    </span>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.h3
                      key={highlight?.id || highlight?.title}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      onClick={handleOpenProduct}
                      className="font-display font-bold text-xs sm:text-base leading-snug text-slate-100 hover:text-neon cursor-pointer transition-colors line-clamp-1"
                    >
                      {highlight?.title || "Akun Sultan Mythic Glory"}
                    </motion.h3>
                  </AnimatePresence>

                  <div className="mt-3 pt-2.5 border-t border-line/70 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-slate-500">
                        Harga Terbaik
                      </p>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-base sm:text-xl text-neon truncate tabular-nums">
                          {highlight
                            ? formatIDR(highlight.price)
                            : "Rp 4.500.000"}
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-semibold text-lime tabular-nums">
                          · {highlight ? formatUSD(highlight) : "$281.25"}
                        </span>
                        {highlight?.original_price > highlight?.price && (
                          <span className="font-mono text-[10px] sm:text-xs text-slate-500 line-through">
                            {formatIDR(highlight.original_price)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenProduct}
                      data-testid="hero-spotlight-action"
                      className="group inline-flex items-center gap-1.5 bg-neon text-void hover:bg-lime font-display font-bold text-[10px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.16em] px-3 sm:px-4 py-2 sm:py-2.5 transition-all duration-300 shrink-0 active:scale-95"
                    >
                      Lihat Detail
                      <ArrowUpRight
                        size={13}
                        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </button>
                  </div>
                </div>

                {/* Interactive Thumbnail Selector Strip */}
                {spotlightList.length > 1 && (
                  <div className="px-3 sm:px-4 py-2 bg-void/60 border-t border-line flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                    {spotlightList.map((item, idx) => {
                      const active = idx === activeIndex;
                      return (
                        <button
                          key={item.id || idx}
                          type="button"
                          onClick={() => setActiveIndex(idx)}
                          className={`group flex items-center gap-1.5 px-2 py-1 border text-left transition-all shrink-0 ${
                            active
                              ? "border-neon bg-neon/10 text-slate-100"
                              : "border-line/70 bg-panel/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                          }`}
                        >
                          <img
                            src={imgSrc(item.image)}
                            alt={item.title}
                            className="w-6 h-6 sm:w-7 sm:h-7 object-cover border border-line/60 shrink-0"
                          />
                          <div className="max-w-[78px] sm:max-w-[96px]">
                            <p className="text-[8px] sm:text-[9px] font-mono uppercase tracking-wider text-neon truncate">
                              {item.game}
                            </p>
                            <p className="text-[9px] sm:text-[10px] font-medium truncate">
                              {item.title}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Inline Trust Footer inside Showcase Card */}
                <div className="px-3 sm:px-4 py-2 bg-void/90 border-t border-line/70 flex items-center justify-between gap-2 text-[9px] sm:text-[10px] font-mono">
                  <span className="flex items-center gap-1.5 text-lime font-bold uppercase tracking-wider">
                    <ShieldCheck size={12} className="shrink-0" /> Garansi 100%
                  </span>
                  <span className="flex items-center gap-1.5 text-neon font-bold uppercase tracking-wider">
                    <Timer size={12} className="shrink-0" /> Proses 5-15 Menit
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 1 }}
        data-testid="hero-scroll-cue"
        className="hidden lg:flex absolute bottom-5 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-slate-500"
      >
        <span className="text-[9px] font-mono uppercase tracking-[0.4em]">
          Scroll
        </span>
        <span className="block w-px h-8 bg-gradient-to-b from-neon to-transparent animate-pulse-dot" />
      </motion.div>
    </section>
  );
};