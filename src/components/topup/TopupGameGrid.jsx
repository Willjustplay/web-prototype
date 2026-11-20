import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Gamepad2, X } from "lucide-react";
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
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-44 rounded-2xl bg-panel/70 border border-line animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="topup-games-error"
        className="rounded-2xl border border-coral/40 bg-coral/5 p-6 text-center"
      >
        <p className="text-xs sm:text-sm font-mono text-coral">
          {t("Gagal memuat daftar game.", "Failed to load games list.")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          data-testid="topup-games-retry"
          className="mt-4 rounded-xl bg-neon text-void font-display font-bold text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-lime transition-colors cursor-pointer"
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
        className="rounded-2xl border border-line bg-panel/80 p-8 text-center"
      >
        <Gamepad2 size={28} className="mx-auto text-slate-600 mb-2" />
        <p className="text-xs sm:text-sm font-mono text-slate-500">
          {t("Belum ada game tersedia.", "No games available yet.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 sm:space-y-4 w-full min-w-0">
      {/* Compact Search + Sort Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-line/80 bg-panel/80 backdrop-blur-md p-2 sm:p-2.5 w-full min-w-0">
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
            placeholder={t("Cari game...", "Search game...")}
            className="w-full rounded-xl bg-void/90 border border-line/80 pl-8 pr-8 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-neon transition-colors"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label={t("Hapus pencarian", "Clear search")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg grid place-items-center text-slate-400 hover:text-neon transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label={t("Urutkan game", "Sort games")}
          className="inline-flex items-center gap-1 rounded-xl bg-void/90 border border-line/80 p-1 shrink-0 self-start sm:self-auto"
        >
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
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-neon text-void font-bold"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          data-testid="topup-games-no-match"
          className="rounded-2xl border border-line bg-panel/50 py-10 px-4 text-center"
        >
          <p className="text-xs sm:text-sm font-mono text-slate-400">
            {t(`Game "${q}" tidak ditemukan.`, `No game matching "${q}".`)}
          </p>
          <button
            type="button"
            onClick={() => setQ("")}
            className="mt-3 text-xs font-mono text-neon hover:text-lime transition-colors cursor-pointer"
          >
            {t("Reset", "Reset")}
          </button>
        </div>
      ) : (
        <motion.div
          layout
          data-testid="topup-game-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((g, i) => {
              const selected = value === g.slug;
              const rawImg = g.icon || g.banner;
              const isImgBroken = !rawImg || brokenImages[g.slug];

              return (
                <motion.button
                  layout
                  key={g.slug}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.012 }}
                  onClick={() => onSelect(g)}
                  data-testid={`topup-game-${g.slug}`}
                  aria-pressed={selected}
                  className={`group flex flex-col text-left rounded-2xl bg-panel/90 border transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.98] ${
                    selected
                      ? "border-neon ring-1 ring-neon/50"
                      : "border-line/85 hover:border-neon/60"
                  }`}
                >
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
                        className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-void via-panel to-neon/15 p-3">
                        <span className="font-display font-black text-xl text-neon/90">
                          {getGameInitials(g.name)}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-panel/90 via-transparent to-transparent" />
                  </div>

                  <div className="px-3 py-2.5 flex items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-xs sm:text-[13px] text-slate-100 group-hover:text-neon transition-colors truncate">
                        {g.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                        {g.min_price > 0
                          ? formatIDR(g.min_price)
                          : g.publisher || "Official"}
                      </p>
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
