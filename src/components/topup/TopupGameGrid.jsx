import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Gamepad2, X, ArrowUpRight, Flame, SlidersHorizontal, Sparkles } from "lucide-react";
import { formatIDR, imgSrc } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

/** Step 1 — pick the game to top up. */
export const TopupGameGrid = ({ games, loading, error, value, onSelect, onRetry }) => {
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [filterMode, setFilterMode] = useState("all");

  const FILTER_MODES = [
    { id: "all", label: t("Semua Game", "All Games") },
    { id: "featured", label: t("Populer", "Popular") },
    { id: "cheapest", label: t("Termurah", "Lowest Price") },
    { id: "az", label: "A - Z" },
  ];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = Array.isArray(games) ? [...games] : [];

    if (needle) {
      list = list.filter(
        (g) =>
          (g.name || "").toLowerCase().includes(needle) ||
          (g.publisher || "").toLowerCase().includes(needle) ||
          (g.currency || "").toLowerCase().includes(needle)
      );
    }

    if (filterMode === "featured") {
      const pop = list.filter((g) => g.featured);
      if (pop.length > 0) list = pop;
    } else if (filterMode === "cheapest") {
      list.sort((a, b) => (a.min_price || 999999999) - (b.min_price || 999999999));
    } else if (filterMode === "az") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }

    return list;
  }, [games, q, filterMode]);

  if (loading) {
    return (
      <div
        data-testid="topup-games-loading"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl bg-panel/70 border border-line animate-pulse"
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
      {/* Compact Dynamic Search & Filter Control Bar (Android-First) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 rounded-2xl border border-line/90 bg-panel/75 backdrop-blur-md p-2.5 sm:p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] w-full min-w-0 overflow-hidden">
        <div className="relative flex-1 group min-w-0">
          <label htmlFor="topup-game-search" className="sr-only">
            {t("Cari game", "Search games")}
          </label>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-neon transition-colors pointer-events-none"
          />
          <input
            id="topup-game-search"
            data-testid="topup-game-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(
              "Cari game, publisher, atau mata uang...",
              "Search games, publishers, or currency..."
            )}
            className="w-full max-w-full rounded-xl bg-void/90 border border-line pl-9 pr-8 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-neon/80 focus:shadow-[0_0_20px_rgba(0,240,255,0.12)] transition-all duration-200"
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

        <div className="flex items-center justify-between md:justify-end gap-2 min-w-0">
          <div className="grid grid-cols-4 sm:inline-flex items-center gap-1 rounded-xl bg-void/90 border border-line p-1 w-full md:w-auto min-w-0">
            {FILTER_MODES.map((m) => {
              const active = filterMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFilterMode(m.id)}
                  className={`relative px-1 sm:px-3 py-1.5 rounded-lg text-[9px] min-[380px]:text-[10px] sm:text-[11px] font-display font-semibold transition-colors min-w-0 overflow-hidden text-center cursor-pointer ${
                    active ? "text-void font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="topupGameFilterPill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-neon shadow-[0_0_12px_rgba(0,240,255,0.3)]"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center justify-center gap-1 min-w-0 max-w-full">
                    {m.id === "featured" && <Flame size={10} className="hidden sm:inline shrink-0" />}
                    {m.id === "cheapest" && <SlidersHorizontal size={10} className="hidden sm:inline shrink-0" />}
                    <span className="truncate">{m.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <span className="hidden lg:inline-block text-[11px] font-mono text-slate-400 px-1.5 tabular-nums shrink-0">
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
            onClick={() => {
              setQ("");
              setFilterMode("all");
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-neon hover:text-lime transition-colors cursor-pointer"
          >
            {t("Reset pencarian", "Reset search")}
          </button>
        </div>
      ) : (
        <motion.div
          layout
          data-testid="topup-game-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((g, i) => {
              const selected = value === g.slug;
              const skuCount = Array.isArray(g.denominations) ? g.denominations.length : 0;
              return (
                <motion.button
                  layout
                  key={g.slug}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.02 }}
                  onClick={() => onSelect(g)}
                  data-testid={`topup-game-${g.slug}`}
                  aria-pressed={selected}
                  className={`group relative flex flex-col justify-between text-left rounded-2xl bg-panel/90 border transition-all duration-300 overflow-hidden cursor-pointer active:scale-[0.98] ${
                    selected
                      ? "border-neon shadow-[0_0_24px_rgba(0,240,255,0.22)] ring-1 ring-neon/50"
                      : "border-line hover:border-neon/60 hover:shadow-[0_12px_28px_rgba(0,0,0,0.48)]"
                  }`}
                >
                  <div>
                    <div className="relative aspect-[16/11] sm:aspect-[4/3] overflow-hidden bg-void">
                      <img
                        src={imgSrc(g.icon || g.banner)}
                        alt={g.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-panel via-void/20 to-transparent" />
                      {g.featured && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-neon text-void shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                          <Sparkles size={8} />
                          <span>{t("Populer", "Popular")}</span>
                        </span>
                      )}
                      {g.currency && (
                        <span className="absolute bottom-1.5 left-2 text-[8px] sm:text-[9px] font-mono font-semibold px-1.5 sm:px-2 py-0.5 rounded-md bg-void/90 border border-line/80 text-slate-200 truncate max-w-[88%]">
                          {g.currency}
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 sm:p-3 pb-1 sm:pb-1.5">
                      <p className="font-display font-bold text-[11px] sm:text-[13px] text-slate-100 group-hover:text-neon transition-colors leading-snug truncate">
                        {g.name}
                      </p>
                      <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-mono text-slate-400 mt-0.5">
                        <span className="truncate">{g.publisher || "Official"}</span>
                        {skuCount > 0 ? (
                          <span className="shrink-0 text-lime font-semibold">
                            {skuCount} {t("paket", "SKUs")}
                          </span>
                        ) : (
                          <span className="shrink-0 text-slate-500">
                            {t("Segera", "Soon")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-2.5 pb-2.5 pt-1.5 sm:px-3 sm:pb-3 sm:pt-2 mt-1 flex items-center justify-between gap-1.5 border-t border-line/60">
                    <div className="min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-mono uppercase tracking-wider text-slate-500 leading-none mb-0.5">
                        {g.min_price > 0
                          ? t("Mulai dari", "Starts from")
                          : t("Status", "Status")}
                      </span>
                      <span
                        className={`font-mono font-bold text-[11px] sm:text-xs truncate block ${
                          g.min_price > 0 ? "text-neon" : "text-slate-400"
                        }`}
                      >
                        {g.min_price > 0
                          ? formatIDR(g.min_price)
                          : t("Segera Hadir", "Coming Soon")}
                      </span>
                    </div>
                    <span className="w-6 h-6 rounded-lg bg-void/90 border border-line group-hover:border-neon group-hover:bg-neon group-hover:text-void text-slate-400 grid place-items-center transition-all duration-200 shrink-0">
                      <ArrowUpRight size={11} />
                    </span>
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


