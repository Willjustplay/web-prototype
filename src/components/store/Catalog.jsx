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
  Sparkles,
  RotateCcw,
  Star,
} from "lucide-react";
import { formatIDR, formatUSD, imgSrc } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const badgeCls = (b) =>
  b === "Diskon Hot"
    ? "bg-coral text-white shadow-[0_2px_10px_rgba(255,42,109,0.4)]"
    : b === "Garansi 100%"
    ? "bg-lime text-void shadow-[0_2px_10px_rgba(163,230,53,0.35)]"
    : "bg-neon text-void shadow-[0_2px_10px_rgba(0,240,255,0.35)]";

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

export const Catalog = ({ products = [], loading = false, onSelect }) => {
  const { isWishlisted, toggleWishlist } = useAuth();
  const { t, translateCategory, translateBadge } = useLanguage();
  const [game, setGame] = useState("Semua Game");
  const [category, setCategory] = useState("Semua Kategori");
  const [sort, setSort] = useState("populer");
  const [q, setQ] = useState("");
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [mobileCompact, setMobileCompact] = useState(true);

  const sorts = [
    { v: "populer", l: t("Paling Populer", "Most Popular") },
    { v: "termurah", l: t("Harga Terendah", "Lowest Price") },
    { v: "termahal", l: t("Harga Tertinggi", "Highest Price") },
    { v: "terbaru", l: t("Produk Terbaru", "Newest Products") },
  ];

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
    () => [
      "Semua Game",
      ...new Set(storeProducts.map((p) => p.game).filter(Boolean)),
    ],
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
    const list = storeProducts.filter((p) => {
      const matchGame = game === "Semua Game" || p.game === game;
      const matchCat =
        category === "Semua Kategori" || p.category === category;
      const matchQuery =
        !q.trim() ||
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        (p.game || "").toLowerCase().includes(q.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(q.toLowerCase());
      const matchPromo =
        !onlyPromo ||
        (p.original_price && p.original_price > p.price) ||
        (p.badges || []).includes("Diskon Hot") ||
        p.badge === "Diskon Hot";

      return matchGame && matchCat && matchQuery && matchPromo;
    });
    const sorters = {
      termurah: (a, b) => a.price - b.price,
      termahal: (a, b) => b.price - a.price,
      populer: (a, b) => (b.sold || 0) - (a.sold || 0),
      terbaru: (a, b) =>
        new Date(b.created_at || 0) - new Date(a.created_at || 0),
    };
    return [...list].sort(sorters[sort]);
  }, [storeProducts, game, category, q, sort, onlyPromo]);

  const resetFilters = () => {
    setGame("Semua Game");
    setCategory("Semua Kategori");
    setQ("");
    setSort("populer");
    setOnlyPromo(false);
  };

  return (
    <section
      id="katalog"
      data-testid="catalog-section"
      className="py-12 sm:py-16 lg:py-20 relative overflow-hidden"
    >
      {/* Subtle Ambient Glow */}
      <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 w-[620px] h-[220px] rounded-full bg-neon/5 blur-[130px]" />

      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 relative z-10">
        {/* Dynamic Header & Search/Sort Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-line/70">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-transparent">
              <Sparkles size={11} className="text-neon shrink-0" />
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-neon font-mono font-semibold">
                {t("Katalog Store • Bergaransi 100%", "Store Catalog • 100% Guaranteed")}
              </span>
              <span className="pl-2 border-l border-line text-[10px] font-mono text-slate-400 tabular-nums">
                {filtered.length}{" "}
                {t(
                  "Produk",
                  filtered.length === 1 ? "Product" : "Products"
                )}
              </span>
            </div>
            <h2
              className="font-display font-black uppercase tracking-tight text-2xl sm:text-3xl lg:text-4xl text-slate-100"
              data-testid="catalog-title"
            >
              {t("Pilih Senjata", "Choose Your ")}
              <span className="text-neon">{t("mu.", "Arsenal.")}</span>
            </h2>
          </div>

          {/* Unified Search, Quick Toggles & Sort Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[200px] sm:w-72">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t(
                  "Cari akun, game, atau item...",
                  "Search accounts, games, or items..."
                )}
                data-testid="catalog-search-input"
                className="w-full rounded-xl bg-panel/80 border border-line/80 focus:border-neon/70 focus:bg-panel outline-none text-xs font-mono pl-9 pr-8 py-2.5 text-slate-100 placeholder:text-slate-500 transition-all shadow-sm"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label={t("Hapus pencarian", "Clear search")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-neon p-0.5 rounded-md transition-colors"
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
                aria-label={t("Urutkan produk", "Sort products")}
                className="rounded-xl bg-transparent border border-line/80 focus:border-neon/70 outline-none text-[11px] sm:text-xs font-mono pl-3.5 pr-8 py-2.5 text-slate-200 hover:border-slate-600 transition-colors cursor-pointer appearance-none"
              >
                {sorts.map((s) => (
                  <option key={s.v} value={s.v} className="bg-void text-slate-200">
                    {s.l}
                  </option>
                ))}
              </select>
              <SlidersHorizontal
                size={12}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neon pointer-events-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setMobileCompact((v) => !v)}
              aria-label={t("Ubah tampilan grid mobile", "Toggle mobile grid layout")}
              title={
                mobileCompact
                  ? t("Ganti ke tampilan 2 kolom", "Switch to 2-column view")
                  : t("Ganti ke tampilan 3 kolom", "Switch to 3-column view")
              }
              className="sm:hidden grid place-items-center w-9 h-9 rounded-xl bg-panel/80 border border-line/80 text-slate-300 hover:text-neon active:scale-95 transition-all shrink-0"
            >
              {mobileCompact ? <LayoutGrid size={15} /> : <Rows3 size={15} />}
            </button>
          </div>
        </div>

        {/* Streamlined Filter Dock */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Category Segmented Tabs */}
            <div
              className="inline-flex items-center gap-1.5 bg-transparent overflow-x-auto no-scrollbar max-w-full"
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
                    className={`relative whitespace-nowrap shrink-0 text-[11px] font-display font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-colors duration-150 flex items-center gap-1.5 ${
                      isActive
                        ? "text-void"
                        : "text-slate-400 hover:text-slate-200 border border-line/60 hover:border-line"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="catalogActiveCategory"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-neon to-lime z-0 shadow-[0_0_16px_rgba(0,240,255,0.25)]"
                      />
                    )}
                    <span className="relative z-10">{translateCategory(c)}</span>
                    <span
                      className={`relative z-10 text-[10px] font-mono tabular-nums ${
                        isActive
                          ? "text-void/85 font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
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
                    className={`whitespace-nowrap shrink-0 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all duration-150 active:scale-95 ${
                      isActive
                        ? "border-neon/80 text-neon bg-neon/15 font-semibold shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                        : "border-line/60 text-slate-400 hover:text-slate-200 bg-panel/40 hover:bg-panel/80 hover:border-line"
                    }`}
                  >
                    {g === "Semua Game" ? t("Semua Game", "All Games") : g}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* High-Density Compact Products Grid */}
        <div className="mt-5 sm:mt-6">
          {loading ? (
            <div
              className={`grid ${
                mobileCompact ? "grid-cols-3" : "grid-cols-2"
              } sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5 lg:gap-3`}
              data-testid="catalog-loading"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="min-w-0 rounded-xl overflow-hidden bg-panel/60 border border-line/60 animate-pulse"
                >
                  <div className="aspect-[16/10] bg-panelhover/60" />
                  <div className="p-2.5 space-y-2">
                    <div className="h-2 w-1/3 rounded bg-panelhover/60" />
                    <div className="h-3 w-3/4 rounded bg-panelhover/60" />
                    <div className="h-2.5 w-1/2 rounded bg-panelhover/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-line/70 bg-panel/50 backdrop-blur-sm py-16 text-center px-4"
              data-testid="catalog-empty"
            >
              <div className="w-14 h-14 rounded-2xl bg-void/80 border border-line mx-auto grid place-items-center text-neon mb-3.5">
                <PackageSearch size={26} />
              </div>
              <h3 className="font-display font-bold uppercase text-sm sm:text-base text-slate-200">
                {t("Produk tidak ditemukan", "No products found")}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1 max-w-sm mx-auto">
                {t(
                  "Coba kata kunci lain atau atur ulang filter pencarian Anda.",
                  "Try another keyword or reset your search filters."
                )}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon to-lime text-void font-display font-bold text-[11px] uppercase tracking-widest px-5 py-2.5 hover:brightness-105 transition-all active:scale-95"
              >
                <RotateCcw size={13} />
                {t("Reset Filter", "Reset Filters")}
              </button>
            </motion.div>
          ) : (
            <motion.div
              layout
              className={`grid ${
                mobileCompact ? "grid-cols-3" : "grid-cols-2"
              } sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5 lg:gap-3`}
              data-testid="catalog-grid"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((p, i) => {
                  const primaryBadge = (
                    p.badges?.length ? p.badges : p.badge ? [p.badge] : []
                  )[0];

                  const discountPct =
                    p.original_price && p.price && p.original_price > p.price
                      ? Math.round(
                          ((p.original_price - p.price) / p.original_price) *
                            100
                        )
                      : null;

                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      whileHover={{ y: -3 }}
                      transition={{
                        duration: 0.18,
                        delay: Math.min(i * 0.015, 0.15),
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      onClick={() => onSelect(p)}
                      data-testid={`product-card-${p.id}`}
                      className="min-w-0 rounded-xl overflow-hidden group cursor-pointer text-left bg-panel/85 border border-line/75 hover:border-neon/60 hover:bg-panel hover:shadow-[0_8px_24px_rgba(0,240,255,0.1)] transition-all duration-200 flex flex-col justify-between relative"
                    >
                      <div>
                        {/* Compact Product Thumbnail */}
                        <div className="relative aspect-[16/10] bg-void overflow-hidden">
                          <img
                            src={imgSrc(p.image)}
                            alt={p.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-panel/90 via-void/10 to-transparent pointer-events-none" />

                          {/* Top Left: Compact Primary Badge or Sold Out */}
                          <div
                            className="absolute top-1.5 left-1.5 z-20 flex flex-wrap items-center gap-1"
                            data-testid={`badges-${p.id}`}
                          >
                            {p.stock < 1 ? (
                              <span
                                data-testid={`stock-out-${p.id}`}
                                className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-coral text-white shadow-sm"
                              >
                                {t("Habis", "Sold Out")}
                              </span>
                            ) : primaryBadge ? (
                              <span
                                className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${badgeCls(
                                  primaryBadge
                                )}`}
                              >
                                {translateBadge(primaryBadge)}
                              </span>
                            ) : null}

                            {discountPct && p.stock >= 1 && (
                              <span className="text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-coral/90 text-white">
                                -{discountPct}%
                              </span>
                            )}
                          </div>

                          {/* Top Right: Compact Wishlist Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishlist(p.id);
                            }}
                            data-testid={`wishlist-toggle-${p.id}`}
                            aria-label={t("Tambah ke favorit", "Add to wishlist")}
                            className="absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-lg grid place-items-center bg-void/80 backdrop-blur-md border border-line/60 hover:border-coral/60 transition-all active:scale-90"
                          >
                            <Heart
                              size={11}
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
                              className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-0.5 rounded bg-void/85 backdrop-blur-sm border border-line/60 text-[8px] font-mono text-slate-300 px-1 py-0.5 tabular-nums"
                            >
                              <Images size={9} className="text-neon" /> +{extraPhotos(p)}
                            </span>
                          )}
                        </div>

                        {/* Compact Card Info: Game Tag, Status Badge & Title */}
                        <div className="p-2 sm:p-2.5 pb-1.5 space-y-1">
                          <div className="flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] font-mono text-slate-400">
                            <span className="text-neon/90 font-semibold truncate">
                              {p.game}
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

                          <h3 className="font-display font-bold text-[11px] sm:text-xs leading-snug line-clamp-2 min-h-[2.3em] text-slate-100 group-hover:text-neon transition-colors">
                            {p.title}
                          </h3>
                        </div>
                      </div>

                      {/* Streamlined Price & Action Footer */}
                      <div className="px-2 sm:px-2.5 pb-2 sm:pb-2.5 pt-1.5 flex items-center justify-between gap-1.5 border-t border-line/40 mt-1">
                        <div className="min-w-0">
                          <span
                            className="block font-mono font-bold text-[11px] sm:text-xs text-neon truncate tabular-nums"
                            data-testid={`price-${p.id}`}
                          >
                            {formatIDR(p.price)}
                          </span>
                          <span
                            className="sr-only"
                            data-testid={`price-usd-${p.id}`}
                          >
                            {formatUSD(p)}
                          </span>
                        </div>

                        <div className="w-6 h-6 rounded-lg shrink-0 grid place-items-center border border-line/80 bg-void/60 text-slate-300 group-hover:bg-gradient-to-r group-hover:from-neon group-hover:to-lime group-hover:text-void group-hover:border-transparent transition-all duration-200">
                          <ArrowUpRight
                            size={12}
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
