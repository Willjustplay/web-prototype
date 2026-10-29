import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Ban, Check } from "lucide-react";
import { formatIDR, formatUSD } from "@/lib/api";

/** Step 3 — pick the denomination to buy. */
export const DenominationGrid = ({ game, value, onSelect }) => {
  const [filter, setFilter] = useState("all");

  const denoms = useMemo(() => game?.denominations || [], [game]);
  const hasPromo = useMemo(
    () => denoms.some((d) => d.badge || (d.price_strike && d.price_strike > d.price)),
    [denoms]
  );

  const visibleDenoms = useMemo(() => {
    if (filter === "promo") {
      return denoms.filter((d) => d.badge || (d.price_strike && d.price_strike > d.price));
    }
    return denoms;
  }, [denoms, filter]);

  if (!game) return null;

  if (!denoms.length) {
    return (
      <div
        data-testid="topup-denom-empty"
        className="rounded-2xl border border-line bg-panel/80 p-10 text-center"
      >
        <Ban size={28} className="mx-auto text-slate-600 mb-3" />
        <p className="text-sm font-mono text-slate-500">
          Nominal untuk {game.name} sedang tidak tersedia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-neon/15 border border-neon/40 text-neon grid place-items-center font-mono text-[11px] font-bold">
            2
          </span>
          <div>
            <h2 className="font-display font-bold text-sm sm:text-base text-slate-100">
              Pilih Nominal {game.currency ? `(${game.currency})` : "Top Up"}
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 ml-1">
            &middot; {visibleDenoms.length} pilihan
          </span>
        </div>

        {hasPromo && (
          <div className="inline-flex items-center gap-1 rounded-xl bg-void/90 border border-line p-1">
            {[
              { id: "all", label: "Semua" },
              { id: "promo", label: "Promo" },
            ].map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-semibold transition-colors cursor-pointer ${
                    active ? "bg-neon text-void font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <motion.div
        layout
        data-testid="topup-denom-grid"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5"
      >
        <AnimatePresence mode="popLayout">
          {visibleDenoms.map((d, i) => {
            const soldOut = (d.stock ?? 1) < 1;
            const selected = value === d.code;
            const hasDiscount = d.price_strike && d.price_strike > d.price;
            return (
              <motion.button
                layout
                key={d.code}
                type="button"
                disabled={soldOut}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={!soldOut ? { y: -3 } : undefined}
                transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.025 }}
                onClick={() => !soldOut && onSelect(d)}
                data-testid={`topup-denom-${d.code}`}
                aria-pressed={selected}
                className={`group relative flex flex-col justify-between text-left rounded-xl p-4 border transition-all duration-200 min-h-[112px] overflow-hidden ${
                  soldOut
                    ? "border-line/50 bg-void/40 cursor-not-allowed opacity-50"
                    : selected
                      ? "border-neon bg-neon/[0.08] shadow-[0_0_24px_rgba(0,240,255,0.2)] cursor-pointer"
                      : "border-line bg-void/80 hover:border-neon/60 hover:bg-void cursor-pointer"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-display font-bold text-xs sm:text-[13px] text-slate-100 leading-snug">
                    <Zap
                      size={13}
                      className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        selected ? "text-neon fill-neon/30" : "text-neon"
                      }`}
                    />
                    <span>{d.label}</span>
                  </p>
                  {selected ? (
                    <span className="w-5 h-5 rounded-full bg-neon text-void grid place-items-center shrink-0 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  ) : (
                    d.badge &&
                    !soldOut && (
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-lime text-void shrink-0">
                        {d.badge}
                      </span>
                    )
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-line/60 flex items-end justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-xs sm:text-sm text-neon tabular-nums">
                      {formatIDR(d.price)}
                    </p>
                    {hasDiscount ? (
                      <p className="font-mono text-[10px] text-slate-500 line-through tabular-nums">
                        {formatIDR(d.price_strike)}
                      </p>
                    ) : (
                      <p className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {formatUSD(null, d.price)} USD
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider ${
                      soldOut ? "text-coral" : "text-slate-500"
                    }`}
                  >
                    {soldOut ? "Habis" : `Stok ${d.stock}`}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default DenominationGrid;

