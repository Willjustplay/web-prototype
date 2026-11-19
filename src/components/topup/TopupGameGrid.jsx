import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Gamepad2, X, ArrowUpRight, Sparkles, ArrowUpDown } from "lucide-react";
import { formatIDR, imgSrc } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

const getGameInitials = (name) => {
  const words = String(name || "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "GM";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

/** Step 1 — pick the game to top up. */
export const TopupGameGrid = ({
  games,
  loading,
  error,
  value,
  onSelect,
  onRetry,
  onlyFeatured = false,
}) => {
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("popular");
  const [brokenImages, setBrokenImages] = useState({});

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = Array.isArray(games) ? [...games] : [];

    if (onlyFeatured) {
      list = list.filter((g) => g.featured);
    }

    if (needle) {
      list = list.filter(
        (g) =>
          (g.name || "").toLowerCase().includes(needle) ||
          (g.publisher || "").toLowerCase().includes(needle) ||
          (g.currency || "").toLowerCase().includes(needle)
      );
    }

    if (sortBy === "az") {
      list.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "id", {
          sensitivity: "base",
        })
      );
    } else if (sortBy === "price") {
      list.sort((a, b) => {
        const pa = Number(a.min_price || 0);
        const pb = Number(b.min_price || 0);
        if (pa > 0 && pb > 0) return pa - pb;
        if (pa > 0) return -1;
        if (pb > 0) return 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    } else {
      // popular / default sort_order
      list.sort((a, b) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) {
          return a.featured ? -1 : 1;
        }
        return Number(a.sort_order ?? 999) - Number(b.sort_order ?? 999);
      });
    }

    return list;
  }, [games, q, onlyFeatured, sortBy]);

  if (loading) {
    return (
      <div
        data-testid="topup-games-loading"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-52 rounded-2xl bg-panel/70 border border-line animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="topup-games-error"
        className="rounded-2xl border border-coral/40 bg-coral/5 p-8 text-center"
      >
        <p className="text-sm font-mono text-coral">
          {t("Gagal memuat daftar game.", "Failed to load games list.")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          data-testid="topup-games-retry"
          className="mt-5 rounded-xl bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] px-6 py-3 hover:bg-lime transition-colors cursor-pointer"
        >
          {t("Coba Lagi", "Try Again")}
        </button>
      </div>
    );
  }

  if (!games.length) {
    return (
      <div
        data-testid="topup-games-empty"
        className="rounded-2xl border border-line bg-panel/80 p-10 text-center"
      >
        <Gamepad2 size={30} className="mx-auto text-slate-600 mb-3" />
        <p className="text-sm font-mono text-slate-500">
          {t(
            "Belum ada game yang tersedia untuk top up.",
            "No games available for top up yet."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full min-w-0">
      {/* Clean & Dynamic Search + Sort Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-2xl border border-line/85 bg-panel/80 backdrop-blur-md p-2.5 sm:p-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)] w-full min-w-0 overflow-hidden">
        <div className="relative flex-1 group min-w-0">
          <label htmlFor="topup-game-search" className="sr-only">
            {t("Cari game", "Search games")}
          </label>
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-neon transition-colors pointer-events-none"
          />
          <input
            id="topup-game-search"
            data-testid="topup-game-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(
              "Cari 38+ game, publisher, atau mata uang...",
              "Search 38+ games, publishers, or currency..."
            )}
            className="w-full max-w-full rounded-xl bg-void/90 border border-line/90 pl-9 pr-8 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-neon/80 focus:shadow-[0_0_20px_rgba(0,240,255,0.12)] transition-all duration-200"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label={t("Hapus pencarian", "Clear search")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg grid place-items-center text-slate-400 hover:text-neon hover:bg-panel transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Dynamic Sort Controls & Game Counter */}
        <div className="flex items-center justify-between sm:justify-end gap-2 min-w-0 shrink-0">
          <div
            role="group"
            aria-label={t("Urutkan game", "Sort games")}
            className="inline-flex items-center gap-1 rounded-xl bg-void/90 border border-line/80 p-1"
          >
            <ArrowUpDown size={11} className="text-slate-500 ml-1.5 mr-0.5 hidden sm:inline shrink-0" />
            {[
              { id: "popular", label: t("Populer", "Popular") },
              { id: "az", label: "A–Z" },
              { id: "price", label: t("Termurah", "Lowest") },
            ].map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  data-testid={`topup-sort-${opt.id}`}
                  className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-neon text-void font-bold shadow-[0_0_12px_rgba(0,240,255,0.28)]"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <span className="text-[11px] font-mono text-slate-400 px-1.5 tabular-nums shrink-0">
            {filtered.length} {t("game", filtered.length === 1 ? "game" : "games")}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          data-testid="topup-games-no-match"
          className="rounded-2xl border border-line bg-panel/50 py-12 px-4 text-center"
        >
          <p className="text-sm font-mono text-slate-400">
            {t(
              `Tidak ada game yang cocok dengan pencarian "${q}".`,
              `No games match your search "${q}".`
            )}
          </p>
          <button
            type="button"
            onClick={() => setQ("")}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-neon hover:text-lime transition-colors cursor-pointer"
          >
            {t("Reset pencarian", "Reset search")}
          </button>
        </div>
      ) : (
        <motion.div
          layout
          data-testid="topup-game-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-3.5"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((g, i) => {
              const selected = value === g.slug;
              const skuCount = Array.isArray(g.denominations) ? g.denominations.length : 0;
              const rawImg = g.icon || g.banner;
              const isImgBroken = !rawImg || brokenImages[g.slug];

              return (
                <motion.button
                  layout
                  key={g.slug}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.015 }}
                  onClick={() => onSelect(g)}
                  data-testid={`topup-game-${g.slug}`}
                  aria-pressed={selected}
                  className={`group relative flex flex-col justify-between text-left rounded-2xl bg-panel/90 border transition-all duration-300 overflow-hidden cursor-pointer active:scale-[0.98] ${
                    selected
                      ? "border-neon shadow-[0_0_24px_rgba(0,240,255,0.22)] ring-1 ring-neon/50"
                      : "border-line/85 hover:border-neon/60 hover:shadow-[0_14px_32px_rgba(0,0,0,0.52)]"
                  }`}
                >
                  <div>
                    {/* Clean Visual Cover — Max 1 subtle corner tag, resilient fallback */}
                    <div className="relative aspect-[16/11] sm:aspect-[4/3] overflow-hidden bg-void">
                      {!isImgBroken ? (
                        <img
                          src={imgSrc(rawImg)}
                          alt={g.name}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [g.slug]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-void via-panel to-neon/15 p-3 text-center">
                          <span className="font-display font-black text-xl sm:text-2xl tracking-wider text-neon/90 drop-shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                            {getGameInitials(g.name)}
                          </span>
                          <span className="mt-1 text-[9px] font-mono uppercase tracking-widest text-slate-400 truncate max-w-full">
                            {g.publisher || "Official"}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-panel via-void/15 to-transparent" />

                      {g.featured && (
                        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-void/85 backdrop-blur-md border border-neon/50 text-neon shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
                          <Sparkles size={8} />
                          <span>{t("Populer", "Popular")}</span>
                        </span>
                      )}
                    </div>

                    {/* Clean Editorial Metadata Hierarchy (Zero Pill Clutter) */}
                    <div className="px-3 pt-2.5 pb-1.5 sm:px-3.5 sm:pt-3">
                      <p className="font-display font-bold text-xs sm:text-[13.5px] text-slate-100 group-hover:text-neon transition-colors leading-snug truncate">
                        {g.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                        <span>{g.publisher || "Official"}</span>
                        {g.currency && (
                          <>
                            <span className="mx-1.5 text-slate-600">&middot;</span>
                            <span className="text-slate-300">{g.currency}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Clean Price & SKU Status Footer */}
                  <div className="px-3 pb-2.5 pt-2 sm:px-3.5 sm:pb-3 mt-1.5 flex items-end justify-between gap-2 border-t border-line/55">
                    <div className="min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-mono uppercase tracking-wider text-slate-500 leading-none mb-1">
                        {g.min_price > 0
                          ? t("Mulai dari", "Starts from")
                          : skuCount > 0
                            ? `${skuCount} ${t("Paket", "SKUs")}`
                            : t("Status", "Status")}
                      </span>
                      <span
                        className={`font-mono font-bold text-[11px] sm:text-xs tabular-nums truncate block ${
                          g.min_price > 0 ? "text-neon" : "text-slate-400"
                        }`}
                      >
                        {g.min_price > 0
                          ? formatIDR(g.min_price)
                          : t("Tersedia", "Available")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {skuCount > 0 && (
                        <span className="text-[9px] font-mono text-lime/90 tabular-nums hidden sm:inline">
                          {skuCount} {t("paket", "SKUs")}
                        </span>
                      )}
                      <span className="w-6 h-6 rounded-lg bg-void/90 border border-line/90 group-hover:border-neon group-hover:bg-neon group-hover:text-void text-slate-400 grid place-items-center transition-all duration-200 shrink-0">
                        <ArrowUpRight size={11} />
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
