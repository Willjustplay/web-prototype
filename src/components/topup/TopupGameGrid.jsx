import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Gamepad2, X, ArrowUpRight, Flame, SlidersHorizontal } from "lucide-react";
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
          (g.publisher || "").toLowerCase().includes(needle)
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
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {Array.from({ length: 8 }).map((_, i) => (
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
        <p className="text-sm font-mono text-coral">Gagal memuat daftar game.</p>
        <button
          type="button"
          onClick={onRetry}
          data-testid="topup-games-retry"
          className="mt-5 rounded-xl bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] px-6 py-3 hover:bg-lime transition-colors cursor-pointer"
        >
          Coba Lagi
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
          Belum ada game yang tersedia untuk top up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Search & Filter Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 rounded-2xl border border-line/90 bg-panel/60 backdrop-blur-md p-3 sm:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="relative flex-1 group">
          <label htmlFor="topup-game-search" className="sr-only">
            Cari game
          </label>
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-neon transition-colors pointer-events-none"
          />
          <input
            id="topup-game-search"
            data-testid="topup-game-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari game atau publisher (mis. Mobile Legends, Moonton)..."
            className="w-full rounded-xl bg-void/90 border border-line pl-10 pr-9 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-neon/80 focus:shadow-[0_0_20px_rgba(0,240,255,0.12)] transition-all duration-200"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Hapus pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg grid place-items-center text-slate-400 hover:text-neon hover:bg-panel transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-xl bg-void/80 border border-line p-1 overflow-x-auto max-w-full">
            {FILTER_MODES.map((m) => {
              const active = filterMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFilterMode(m.id)}
                  className={`relative px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-display font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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
                  <span className="relative z-10 inline-flex items-center gap-1">
                    {m.id === "featured" && <Flame size={11} />}
                    {m.id === "cheapest" && <SlidersHorizontal size={11} />}
                    <span>{m.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <span className="hidden lg:inline-block text-[11px] font-mono text-slate-400 pl-1 tabular-nums">
            {filtered.length} game
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          data-testid="topup-games-no-match"
          className="rounded-2xl border border-line bg-panel/50 py-14 px-4 text-center"
        >
          <p className="text-sm font-mono text-slate-400">
            Tidak ada game yang cocok dengan pencarian &ldquo;{q}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setFilterMode("all");
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-neon hover:text-lime transition-colors cursor-pointer"
          >
            Reset pencarian
          </button>
        </div>
      ) : (
        <motion.div
          layout
          data-testid="topup-game-grid"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((g, i) => {
              const selected = value === g.slug;
              return (
                <motion.button
                  layout
                  key={g.slug}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03 }}
                  onClick={() => onSelect(g)}
                  data-testid={`topup-game-${g.slug}`}
                  aria-pressed={selected}
                  className={`group relative flex flex-col justify-between text-left rounded-2xl bg-panel/90 border transition-all duration-300 overflow-hidden cursor-pointer ${
                    selected
                      ? "border-neon shadow-[0_0_28px_rgba(0,240,255,0.22)] ring-1 ring-neon/50"
                      : "border-line hover:border-neon/60 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
                  }`}
                >
                  <div>
                    <div className="relative aspect-[4/3] overflow-hidden bg-void">
                      <img
                        src={imgSrc(g.banner || g.icon)}
                        alt={g.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-panel via-void/25 to-transparent" />
                      {g.featured && (
                        <span className="absolute top-2.5 left-2.5 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neon text-void shadow-[0_0_12px_rgba(0,240,255,0.4)]">
                          Populer
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 sm:p-4 pb-2">
                      <p className="font-display font-bold text-xs sm:text-sm text-slate-100 group-hover:text-neon transition-colors leading-snug truncate">
                        {g.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mt-1 truncate">
                        <span className="truncate">{g.publisher || "Official"}</span>
                        {g.denominations?.length > 0 && (
                          <>
                            <span aria-hidden="true">&middot;</span>
                            <span className="shrink-0">{g.denominations.length} nominal</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-3.5 sm:px-4 pb-3.5 pt-2 mt-1 flex items-center justify-between gap-2 border-t border-line/60">
                    <div>
                      <span className="block text-[9px] font-mono uppercase tracking-wider text-slate-500">
                        Mulai dari
                      </span>
                      <span className="font-mono font-bold text-xs text-neon">
                        {g.min_price > 0 ? formatIDR(g.min_price) : "Tersedia"}
                      </span>
                    </div>
                    <span className="w-7 h-7 rounded-lg bg-void/90 border border-line group-hover:border-neon group-hover:bg-neon group-hover:text-void text-slate-400 grid place-items-center transition-all duration-200 shrink-0">
                      <ArrowUpRight size={13} />
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

