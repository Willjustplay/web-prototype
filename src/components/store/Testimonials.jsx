import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Quote,
  MessageSquare,
  X,
  ShieldCheck,
  Image as ImageIcon,
  ZoomIn,
} from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

const Stars = ({ n }) => (
  <span className="flex gap-0.5 text-lime">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={12}
        fill={i < n ? "currentColor" : "none"}
        className={i < n ? "" : "text-slate-600"}
      />
    ))}
  </span>
);

export const Testimonials = () => {
  const { t, translateDesc } = useLanguage();
  const [items, setItems] = useState([]);
  const [zoom, setZoom] = useState(null);
  const [activeGame, setActiveGame] = useState("all");
  const [onlyWithPhoto, setOnlyWithPhoto] = useState(false);

  useEffect(() => {
    api
      .get("/testimonials")
      .then((r) => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const games = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      if (it.game) set.add(it.game);
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (activeGame !== "all" && it.game !== activeGame) return false;
      if (onlyWithPhoto && !it.image) return false;
      return true;
    });
  }, [items, activeGame, onlyWithPhoto]);

  const avgRating = useMemo(() => {
    if (items.length === 0) return "5.0";
    const sum = items.reduce((acc, it) => acc + Number(it.rating || 5), 0);
    return (sum / items.length).toFixed(1);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <section
      id="testimoni"
      data-testid="testimonials-section"
      className="py-16 sm:py-24 border-t border-line bg-void grid-bg relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header & Rating Summary */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 sm:mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neon font-mono mb-2.5">
              {t("03. Bukti Sosial & Reputasi", "03. Social Proof & Reputation")}
            </p>
            <h2
              className="font-display font-bold uppercase tracking-tight text-2xl sm:text-3xl lg:text-4xl text-slate-100"
              data-testid="testimonials-title"
            >
              {t("Kata Mereka. ", "Their Words. ")}
              <span className="text-stroke">
                {t("Bukan Kata Kami.", "Not Just Ours.")}
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-fit flex items-center gap-2.5 py-1">
              <div className="flex items-center gap-1.5 text-lime font-display font-black text-base sm:text-lg font-mono tabular-nums">
                <Star size={15} fill="currentColor" />
                <span>{avgRating}</span>
              </div>
              <span className="text-slate-600">·</span>
              <p className="text-[11px] sm:text-xs font-mono text-slate-300 flex items-center gap-1.5 tabular-nums">
                <MessageSquare size={13} className="text-neon" />
                <span>
                  {items.length} {t("ulasan terverifikasi", "verified reviews")}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Filter Controls */}
        {(games.length > 1 || items.some((x) => x.image)) && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-8 pb-3.5 border-b border-line/80">
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              <button
                type="button"
                onClick={() => setActiveGame("all")}
                className={`relative w-fit flex-none px-2.5 py-1 text-[11px] sm:text-xs font-mono leading-tight transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeGame === "all"
                    ? "text-neon font-bold underline decoration-neon decoration-2 underline-offset-4"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {t(`Semua Game (${items.length})`, `All Games (${items.length})`)}
              </button>
              {games.map((g) => {
                const isSelected = activeGame === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setActiveGame(g)}
                    className={`relative w-fit flex-none px-2.5 py-1 text-[11px] sm:text-xs font-mono leading-tight transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? "text-neon font-bold underline decoration-neon decoration-2 underline-offset-4"
                        : "text-slate-400 hover:text-slate-100"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            {items.some((x) => x.image) && (
              <button
                type="button"
                onClick={() => setOnlyWithPhoto((v) => !v)}
                className={`w-fit flex-none inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] sm:text-xs font-mono leading-tight transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  onlyWithPhoto
                    ? "text-lime font-bold underline decoration-lime decoration-2 underline-offset-4"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ImageIcon size={12} />
                <span>{t("Dengan Bukti Foto", "With Photo Proof")}</span>
              </button>
            )}
          </div>
        )}

        {/* Testimonials Grid */}
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-3 sm:pb-0 no-scrollbar">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, i) => {
              const initials = String(item.name || "M")
                .trim()
                .slice(0, 2)
                .toUpperCase();
              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, delay: (i % 4) * 0.05 }}
                  whileHover={{ y: -4 }}
                  data-testid={`testimonial-card-${item.id}`}
                  className="w-[82vw] max-w-[310px] sm:w-auto sm:max-w-none shrink-0 snap-center group relative rounded-2xl bg-panel/90 border border-line hover:border-neon/50 p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <Stars n={item.rating} />
                      <Quote
                        size={18}
                        className="text-neon/30 group-hover:text-neon transition-colors duration-200"
                      />
                    </div>

                    <p className="text-xs sm:text-sm leading-relaxed text-slate-200">
                      &ldquo;{translateDesc(item.text)}&rdquo;
                    </p>

                    {item.image && (
                      <button
                        type="button"
                        onClick={() => setZoom(item)}
                        data-testid={`testimonial-image-${item.id}`}
                        className="mt-4 w-full relative block overflow-hidden rounded-xl border border-line hover:border-neon/60 transition-colors group/img cursor-pointer"
                      >
                        <img
                          src={imgSrc(item.image)}
                          alt={t(`Bukti chat ${item.name}`, `Chat proof ${item.name}`)}
                          referrerPolicy="no-referrer"
                          className="w-full h-40 object-cover object-top group-hover/img:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-void/85 via-transparent to-transparent flex items-end justify-between p-2.5">
                          <span className="text-[10px] font-mono text-neon font-semibold">
                            {t("Bukti Transaksi", "Transaction Proof")}
                          </span>
                          <span className="w-6 h-6 rounded-lg bg-void/80 border border-line text-slate-200 grid place-items-center">
                            <ZoomIn size={12} />
                          </span>
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-line/70 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-neon/10 border border-neon/30 text-neon font-display font-bold text-xs grid place-items-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-display font-bold text-xs text-slate-100 truncate">
                          {item.name}
                        </p>
                        <ShieldCheck
                          size={12}
                          className="text-lime shrink-0"
                          title={t("Pembeli Terverifikasi", "Verified Buyer")}
                        />
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {item.game}
                        {item.product ? ` · ${item.product}` : ""}
                      </p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Lightbox Modal for Screenshot Proof */}
      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoom(null)}
            data-testid="testimonial-zoom"
            className="fixed inset-0 z-50 bg-void/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-panel border border-line text-slate-300 hover:text-coral hover:border-coral grid place-items-center transition-colors"
              data-testid="testimonial-zoom-close"
            >
              <X size={20} />
            </button>
            <motion.img
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              src={imgSrc(zoom.image)}
              alt={t("Bukti chat", "Chat proof")}
              referrerPolicy="no-referrer"
              className="max-h-[88vh] max-w-full rounded-xl border border-line shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
