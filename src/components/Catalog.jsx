import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  PackageSearch,
  Images,
  Heart,
  LayoutGrid,
  Rows3,
  X,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { formatIDR, formatUSD, imgSrc } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const badgeCls = (b) =>
  b === "Diskon Hot"
    ? "bg-coral text-white"
    : b === "Garansi 100%"
    ? "bg-lime text-void"
    : "bg-neon text-void";

const condTextCls = (c) => {
  const v = (c || "").toLowerCase();
  if (v === "ready") return "text-lime";
  if (v === "sold") return "text-slate-500";
  if (v === "unready") return "text-coral";
  return "text-neon";
};

const extraPhotos = (p) =>
  Math.max((p.image ? 1 : 0) + (p.images?.length || 0) - 1, 0);

const CATEGORIES = [
  "Semua Kategori",
  "Akun Game",
  "Jasa Joki",
  "Item Game",
  "Lainnya",
];

const SORTS = [
  { v: "populer", l: "Paling Populer" },
  { v: "termurah", l: "Harga Terendah" },
  { v: "termahal", l: "Harga Tertinggi" },
  { v: "terbaru", l: "Produk Terbaru" },
];

export const Catalog = ({ products = [], loading = false, onSelect }) => {
  const { isWishlisted, toggleWishlist } = useAuth();
  const [game, setGame] = useState("Semua Game");
  const [category, setCategory] = useState("Semua Kategori");
  const [sort, setSort] = useState("populer");
  const [q, setQ] = useState("");
  const [mobileCompact, setMobileCompact] = useState(true);

  // Filter out topup products so they are strictly handled in /topup
  const storeProducts = useMemo(() => {
    return (products || []).filter(
      (p) =>
        p.product_type !== "topup" &&
        p.category !== "Topup Game" &&
        !p.denomination_code &&
        !p.denomination_id
    );
  }, [products]);

  const games = useMemo(
    () => ["Semua Game", ...new Set(storeProducts.map((p) => p.game).filter(Boolean))],
    [storeProducts]
  );

  // Category counts for dynamic feedback
  const categoryCounts = useMemo(() => {
    const counts = { "Semua Kategori": storeProducts.length };
    storeProducts.forEach((p) => {
      const c = p.category || "Lainnya";
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [storeProducts]);

  const filtered = useMemo(() => {
    const list = storeProducts.filter(
      (p) =>
        (game === "Semua Game" || p.game === game) &&
        (category === "Semua Kategori" || p.category === category) &&
        (!q.trim() ||
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          (p.game || "").toLowerCase().includes(q.toLowerCase()) ||
          (p.category || "").toLowerCase().includes(q.toLowerCase()))
    );
    const sorters = {
      termurah: (a, b) => a.price - b.price,
      termahal: (a, b) => b.price - a.price,
      populer: (a, b) => (b.sold || 0) - (a.sold || 0),
      terbaru: (a, b) =>
        new Date(b.created_at || 0) - new Date(a.created_at || 0),
    };
    return [...list].sort(sorters[sort]);
  }, [storeProducts, game, category, q, sort]);

  const resetFilters = () => {
    setGame("Semua Game");
    setCategory("Semua Kategori");
    setQ("");
    setSort("populer");
  };

  return (
    <section
      id="katalog"
      data-testid="catalog-section"
      className="py-12 sm:py-16 lg:py-20 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 relative z-10">
        {/* Clean Minimal Header & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-line/60">
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-neon font-mono">
              Katalog Store · Bergaransi 100%
            </p>
            <h2
              className="font-display font-black uppercase tracking-tight text-2xl sm:text-3xl lg:text-4xl text-slate-100"
              data-testid="catalog-title"
            >
              Pilih Senjata<span className="text-neon">mu.</span>
            </h2>
          </div>

          {/* Unified Search & Sort Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari akun, game, atau item..."
                data-testid="catalog-search-input"
                className="w-full bg-panel/70 border border-line/80 focus:border-neon/70 focus:bg-panel outline-none text-xs font-mono pl-9 pr-8 py-2.5 text-slate-100 placeholder:text-slate-500 transition-colors"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-neon p-0.5 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="relative shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                data-testid="catalog-sort-select"
                aria-label="Urutkan produk"
                className="bg-panel/70 border border-line/80 focus:border-neon/70 outline-none text-[11px] sm:text-xs font-mono pl-3 pr-7 py-2.5 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer appearance-none"
              >
                {SORTS.map((s) => (
                  <option key={s.v} value={s.v} className="bg-void text-slate-200">
                    {s.l}
                  </option>
                ))}
              </select>
              <SlidersHorizontal
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setMobileCompact((v) => !v)}
              aria-label="Ubah tampilan grid mobile"
              title={mobileCompact ? "Ganti ke tampilan 1 kolom" : "Ganti ke tampilan 2 kolom"}
              className="sm:hidden grid place-items-center w-9 h-9 bg-panel/70 border border-line/80 text-slate-300 hover:text-neon active:scale-95 transition-all shrink-0"
            >
              {mobileCompact ? <LayoutGrid size={15} /> : <Rows3 size={15} />}
            </button>
          </div>
        </div>

        {/* Streamlined Filter Bar */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Category Segmented Tabs */}
          <div
            className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0 max-w-full"
            data-testid="catalog-category-tabs"
          >
            {CATEGORIES.map((c) => {
              const isActive = category === c;
              const count = categoryCounts[c] ?? 0;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  data-testid={`category-tab-${c.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`relative whitespace-nowrap shrink-0 text-[11px] font-display font-bold uppercase tracking-wider px-3.5 py-2 transition-colors duration-150 flex items-center gap-1.5 ${
                    isActive
                      ? "text-void"
                      : "text-slate-400 hover:text-slate-200 bg-panel/40 hover:bg-panel/80"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="catalogActiveCategory"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 bg-neon z-0"
                    />
                  )}
                  <span className="relative z-10">{c}</span>
                  <span
                    className={`relative z-10 text-[10px] font-mono tabular-nums ${
                      isActive ? "text-void/80 font-bold" : "text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Game Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 max-w-full">
            <div
              className="flex items-center gap-1.5"
              data-testid="catalog-game-chips"
            >
              {games.map((g) => {
                const isActive = game === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGame(g)}
                    data-testid={`game-chip-${g.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`whitespace-nowrap shrink-0 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1.5 border transition-colors duration-150 ${
                      isActive
                        ? "border-neon/80 text-neon bg-neon/10 font-semibold"
                        : "border-transparent text-slate-400 hover:text-slate-200 bg-panel/40 hover:bg-panel/70"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Products Grid */}
        <div className="mt-6 sm:mt-8">
          {loading ? (
            <div
              className={`grid ${
                mobileCompact ? "grid-cols-2" : "grid-cols-1"
              } sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5`}
              data-testid="catalog-loading"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="min-w-0 overflow-hidden bg-panel/60 border border-line/60 animate-pulse"
                >
                  <div className="aspect-[16/10] bg-panelhover/60" />
                  <div className="p-3.5 sm:p-4 space-y-2.5">
                    <div className="h-2.5 w-1/3 bg-panelhover/60" />
                    <div className="h-4 w-3/4 bg-panelhover/60" />
                    <div className="h-3 w-1/2 bg-panelhover/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="border border-line/60 bg-panel/40 py-16 text-center px-4"
              data-testid="catalog-empty"
            >
              <PackageSearch size={34} className="mx-auto text-slate-600 mb-3" />
              <h3 className="font-display font-bold uppercase text-sm sm:text-base text-slate-200">
                Produk tidak ditemukan
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-1 max-w-sm mx-auto">
                Coba kata kunci lain atau atur ulang filter pencarian Anda.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 bg-neon text-void font-display font-bold text-[10px] uppercase tracking-widest px-5 py-2.5 hover:bg-lime transition-colors"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <motion.div
              layout
              className={`grid ${
                mobileCompact ? "grid-cols-2" : "grid-cols-1"
              } sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5`}
              data-testid="catalog-grid"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((p, i) => {
                  const primaryBadge = (
                    p.badges?.length ? p.badges : p.badge ? [p.badge] : []
                  )[0];

                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{
                        duration: 0.2,
                        delay: Math.min(i * 0.02, 0.2),
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      onClick={() => onSelect(p)}
                      data-testid={`product-card-${p.id}`}
                      className="min-w-0 overflow-hidden group cursor-pointer text-left bg-panel/70 border border-line/70 hover:border-neon/50 hover:bg-panel transition-all duration-200 flex flex-col justify-between relative"
                    >
                      <div>
                        {/* Clean Product Thumbnail */}
                        <div className="relative aspect-[16/10] bg-void overflow-hidden">
                          <img
                            src={imgSrc(p.image)}
                            alt={p.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-void/80 via-transparent to-transparent pointer-events-none" />

                          {/* Top Left: Single Primary Badge or Sold Out */}
                          <div
                            className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5"
                            data-testid={`badges-${p.id}`}
                          >
                            {p.stock < 1 ? (
                              <span
                                data-testid={`stock-out-${p.id}`}
                                className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-coral text-white"
                              >
                                Habis
                              </span>
                            ) : primaryBadge ? (
                              <span
                                className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 ${badgeCls(
                                  primaryBadge
                                )}`}
                              >
                                {primaryBadge}
                              </span>
                            ) : null}
                          </div>

                          {/* Top Right: Minimal Wishlist Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishlist(p.id);
                            }}
                            data-testid={`wishlist-toggle-${p.id}`}
                            aria-label="Tambah ke favorit"
                            className="absolute top-2.5 right-2.5 z-20 w-7 h-7 sm:w-8 sm:h-8 grid place-items-center bg-void/75 backdrop-blur-sm border border-line/50 hover:border-neon/60 transition-colors active:scale-90"
                          >
                            <Heart
                              size={13}
                              className={
                                isWishlisted(p.id)
                                  ? "text-coral fill-coral"
                                  : "text-slate-300 hover:text-coral"
                              }
                            />
                          </button>

                          {/* Bottom Right: Extra Photos Count */}
                          {extraPhotos(p) > 0 && (
                            <span
                              data-testid={`gallery-count-${p.id}`}
                              className="absolute bottom-2 right-2.5 z-20 flex items-center gap-1 bg-void/80 backdrop-blur-sm text-[9px] font-mono text-slate-300 px-1.5 py-0.5 tabular-nums"
                            >
                              <Images size={10} /> +{extraPhotos(p)}
                            </span>
                          )}
                        </div>

                        {/* Card Info */}
                        <div className="p-3.5 sm:p-4 pb-2 space-y-1.5">
                          {/* Clean Unboxed Metadata Row */}
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                            <span className="truncate">
                              <span className="text-slate-300">{p.game}</span>
                              <span className="mx-1.5 text-slate-600">·</span>
                              <span>{p.category}</span>
                            </span>
                            {p.condition && (
                              <span
                                data-testid={`condition-${p.id}`}
                                className={`shrink-0 uppercase tracking-wider font-semibold ${condTextCls(
                                  p.condition
                                )}`}
                              >
                                {p.condition}
                              </span>
                            )}
                          </div>

                          <h3 className="font-display font-bold text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.5em] text-slate-100 group-hover:text-neon transition-colors">
                            {p.title}
                          </h3>
                        </div>
                      </div>

                      {/* Clean Price & Dynamic Action Footer */}
                      <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-2 flex items-end justify-between gap-2 border-t border-line/40 mt-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span
                              className="font-mono font-bold text-xs sm:text-[15px] text-neon truncate tabular-nums"
                              data-testid={`price-${p.id}`}
                            >
                              {formatIDR(p.price)}
                            </span>
                            <span
                              className="font-mono text-[10px] sm:text-xs text-lime/90 font-semibold tabular-nums"
                              data-testid={`price-usd-${p.id}`}
                            >
                              · {formatUSD(p)}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
                            {p.rank ? `${p.rank} · ` : ""}
                            {p.sold || 0} terjual
                          </div>
                        </div>

                        <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 grid place-items-center border border-line/80 text-slate-400 group-hover:bg-neon group-hover:text-void group-hover:border-neon transition-all duration-200">
                          <ArrowUpRight
                            size={14}
                            className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};

