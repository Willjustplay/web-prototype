import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Ban, Check, Gem, Crown, ArrowRight } from "lucide-react";
import { formatIDR, formatUSD } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

const resolveDenomGroup = (d) => {
  const g = String(d?.sku_group || "").trim().toLowerCase();
  if (g === "membership" || g === "currency") return g;
  const hay = `${d?.vendor_sku || ""} ${d?.code || ""} ${d?.label || ""} ${d?.badge || ""}`;
  if (
    /\b(membership|member|welkin|blessing|inter-knot|interknot|wdp|weekly\s*diamond\s*pass|twilight\s*pass|starlight|supply\s*pass|express\s*supply|lunite\s*subscription|royale\s*pass|booyah\s*pass|elite\s*pass|battle\s*pass|season\s*pass|star\s*pass|premium\s*pass|monthly\s*card|weekly\s*card|monthly\s*pass|weekly\s*pass|vip\s*card|kartu\s*bulanan|kartu\s*mingguan|berkah|langganan|subscription|pass|paket\s*mingguan|paket\s*bulanan|level\s*up\s*pass)\b/i.test(
      hay
    )
  ) {
    return "membership";
  }
  return "currency";
};

/** Step 2 — pick the denomination to buy. */
export const DenominationGrid = ({ game, value, onSelect }) => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("currency");

  const denoms = useMemo(() => game?.denominations || [], [game]);
  const currencyLabel = useMemo(() => String(game?.currency || "Item").trim() || "Item", [game]);
  const currencyDenoms = useMemo(
    () => denoms.filter((d) => resolveDenomGroup(d) === "currency"),
    [denoms]
  );
  const membershipDenoms = useMemo(
    () => denoms.filter((d) => resolveDenomGroup(d) === "membership"),
    [denoms]
  );

  useEffect(() => {
    if (currencyDenoms.length === 0 && membershipDenoms.length > 0) {
      setFilter("membership");
    } else {
      setFilter("currency");
    }
  }, [game?.slug, currencyDenoms.length, membershipDenoms.length]);

  const visibleDenoms = useMemo(() => {
    if (filter === "membership") return membershipDenoms;
    return currencyDenoms;
  }, [currencyDenoms, membershipDenoms, filter]);

  if (!game) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-neon/15 border border-neon/40 text-neon grid place-items-center font-mono text-[11px] font-bold">
            2
          </span>
          <div>
            <h2 className="font-display font-bold text-sm sm:text-base text-slate-100">
              {t(
                `Pilih Nominal & Paket ${game.name}`,
                `Select ${game.name} Denomination & Package`
              )}
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 ml-1">
            &middot; {visibleDenoms.length} {t("pilihan", "options")}
          </span>
        </div>

        <div
          role="tablist"
          aria-label={t(`Kategori SKU ${game.name}`, `${game.name} SKU Categories`)}
          className="relative grid grid-cols-2 sm:inline-flex items-center gap-1.5 rounded-2xl bg-void/95 border border-line/90 p-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.65)] w-full sm:w-auto"
        >
          {[
            {
              id: "currency",
              label: currencyLabel,
              count: currencyDenoms.length,
              icon: Gem,
              activeBg:
                "bg-gradient-to-r from-neon via-cyan-300 to-neon shadow-[0_0_22px_rgba(0,240,255,0.4)]",
              idleHover: "hover:text-neon hover:bg-neon/5",
              iconTone: "text-neon",
            },
            {
              id: "membership",
              label: "Membership",
              count: membershipDenoms.length,
              icon: Crown,
              activeBg:
                "bg-gradient-to-r from-lime via-emerald-300 to-lime shadow-[0_0_22px_rgba(163,230,53,0.4)]",
              idleHover: "hover:text-lime hover:bg-lime/5",
              iconTone: "text-lime",
            },
          ].map((tab) => {
            const active = filter === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`group relative z-10 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-display font-bold whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                  active ? "text-void" : `text-slate-300 ${tab.idleHover}`
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="denom-grid-category-active-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className={`absolute inset-0 -z-10 rounded-xl ${tab.activeBg}`}
                  />
                )}
                <Icon
                  size={13}
                  className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    active ? "text-void" : tab.iconTone
                  }`}
                />
                <span>{tab.label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md font-mono text-[10px] font-bold tabular-nums ${
                    active
                      ? "bg-void/20 text-void"
                      : "bg-panel border border-line/80 text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!denoms.length ? (
        <div
          data-testid="topup-denom-empty"
          className="rounded-2xl border border-line bg-panel/80 p-10 text-center"
        >
          <Ban size={28} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-mono text-slate-500">
            {t(
              `Nominal ${currencyLabel} & Membership untuk ${game.name} sedang tidak tersedia.`,
              `${currencyLabel} & Membership packages for ${game.name} are currently unavailable.`
            )}
          </p>
        </div>
      ) : !visibleDenoms.length ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel/60 p-8 text-center space-y-3">
          <p className="text-xs font-mono text-slate-300">
            {t("Belum ada SKU pada kategori", "No SKUs in category")}{" "}
            <strong className={filter === "membership" ? "text-lime" : "text-neon"}>
              {filter === "membership" ? "Membership" : currencyLabel}
            </strong>{" "}
            {t(`untuk ${game.name}.`, `for ${game.name}.`)}
          </p>
          {(filter === "membership" ? currencyDenoms.length : membershipDenoms.length) > 0 && (
            <button
              type="button"
              onClick={() => setFilter(filter === "membership" ? "currency" : "membership")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neon/50 bg-neon/10 text-neon hover:bg-neon hover:text-void px-3.5 py-2 text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              <span>
                {t("Lihat Kategori", "View")}{" "}
                {filter === "membership" ? currencyLabel : "Membership"} (
                {filter === "membership" ? currencyDenoms.length : membershipDenoms.length})
              </span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      ) : (
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
              const isMembership = resolveDenomGroup(d) === "membership";
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
                      (d.badge || isMembership) &&
                      !soldOut && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-lime text-void shrink-0">
                          {d.badge || "Membership"}
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
                      {soldOut ? t("Habis", "Sold Out") : `${t("Stok", "Stock")} ${d.stock}`}
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

export default DenominationGrid;


