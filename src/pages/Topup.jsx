import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, ShieldCheck, Clock, Sparkles, Gamepad2, ReceiptText } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TopupGameGrid } from "@/components/topup/TopupGameGrid";
import { useLanguage } from "@/context/LanguageContext";
import { useTopupGames } from "@/hooks/useTopup";

export default function Topup() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { games, loading, error, reload } = useTopupGames();

  // If someone visits /topup?game=slug, redirect directly to /topup/:slug
  useEffect(() => {
    const gameParam = searchParams.get("game");
    if (gameParam) {
      navigate(`/topup/${encodeURIComponent(gameParam)}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const chooseGame = (g) => {
    if (!g?.slug) return;
    navigate(`/topup/${g.slug}`);
  };

  const totalSkus = useMemo(
    () =>
      (Array.isArray(games) ? games : []).reduce(
        (sum, g) => sum + (Array.isArray(g?.denominations) ? g.denominations.length : 0),
        0
      ),
    [games]
  );

  return (
    <main className="min-h-screen bg-void grid-bg relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[460px] h-[460px] bg-neon/5 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-lime/5 rounded-full blur-[130px]" />
      </div>

      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 pt-[72px] pb-28 sm:pt-24 sm:pb-28">
        {/* Compact & Dynamic Top Up Header (Android & Desktop Optimized) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl border border-line/90 bg-gradient-to-br from-panel/95 via-void/90 to-panel/85 p-3.5 sm:p-6 mb-4 sm:mb-5 shadow-[0_14px_36px_rgba(0,0,0,0.4)] relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -right-14 -top-14 w-52 h-52 rounded-full bg-neon/10 blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
            <div className="space-y-1.5">
              {/* Top Row: Official Badge + Mobile History Shortcut */}
              <div className="flex items-center justify-between sm:justify-start flex-wrap gap-1.5 sm:gap-2">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-[0.16em] sm:tracking-[0.22em] text-neon bg-neon/10 border border-neon/30 rounded-lg px-2 py-1">
                    <Sparkles size={10} className="shrink-0" />
                    <span>{t("Top Up Resmi 24/7", "Official 24/7 Top Up")}</span>
                  </span>
                  {!loading && games.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono text-slate-300 bg-void/80 border border-line rounded-lg px-2 py-1">
                      <Gamepad2 size={10} className="text-lime shrink-0" />
                      <span>
                        {games.length} {t("Game", "Games")}
                        <span className="hidden min-[380px]:inline">
                          {totalSkus > 0 ? ` • ${totalSkus} SKU` : ""}
                        </span>
                      </span>
                    </span>
                  )}
                </div>

                <Link
                  to="/akun"
                  className="inline-flex lg:hidden items-center gap-1 rounded-lg border border-neon/40 bg-neon/10 active:bg-neon active:text-void text-neon px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider transition-all shrink-0"
                >
                  <ReceiptText size={11} />
                  <span>{t("Riwayat", "History")}</span>
                </Link>
              </div>

              <h1 className="font-display font-black text-lg min-[380px]:text-xl sm:text-3xl uppercase tracking-tight text-white leading-snug sm:leading-tight">
                {t("Pilih", "Choose Your")}{" "}
                <span className="text-stroke">{t("Game", "Favorite")}</span>{" "}
                {t("Favoritmu", "Game")}
              </h1>

              <p className="text-[11px] sm:text-xs font-mono text-slate-400 max-w-xl leading-relaxed">
                {t(
                  "Pilih game, masukkan ID tujuan, dan selesaikan pembayaran otomatis dalam hitungan detik.",
                  "Pick a game, enter your target ID, and complete automated payment within seconds."
                )}
              </p>
            </div>

            {/* 3-Column Feature Strip on Android + Desktop History Button */}
            <div className="flex flex-col sm:flex-row lg:items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 w-full sm:w-auto">
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 rounded-xl border border-line/80 bg-void/80 px-2 py-2 sm:px-3 sm:py-2 text-center sm:text-left">
                  <Zap size={13} className="text-neon shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-display font-bold text-slate-100 leading-tight truncate">
                      {t("1–5 Detik", "1–5 Secs")}
                    </p>
                    <p className="text-[8px] sm:text-[9px] font-mono text-slate-400 truncate">
                      {t("Instan", "Instant")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 rounded-xl border border-line/80 bg-void/80 px-2 py-2 sm:px-3 sm:py-2 text-center sm:text-left">
                  <ShieldCheck size={13} className="text-lime shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-display font-bold text-slate-100 leading-tight truncate">
                      {t("100% Resmi", "Official")}
                    </p>
                    <p className="text-[8px] sm:text-[9px] font-mono text-slate-400 truncate">
                      {t("Legal & Aman", "Safe & Legal")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 rounded-xl border border-line/80 bg-void/80 px-2 py-2 sm:px-3 sm:py-2 text-center sm:text-left">
                  <Clock size={13} className="text-cyan-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-display font-bold text-slate-100 leading-tight truncate">
                      24 / 7
                    </p>
                    <p className="text-[8px] sm:text-[9px] font-mono text-slate-400 truncate">
                      {t("Otomatis", "Automated")}
                    </p>
                  </div>
                </div>
              </div>

              <Link
                to="/akun"
                className="hidden lg:inline-flex items-center justify-center gap-1.5 rounded-xl border border-neon/40 bg-neon/10 hover:bg-neon hover:text-void text-neon px-3.5 py-2.5 text-[11px] font-display font-bold uppercase tracking-wider transition-all shrink-0"
              >
                <ReceiptText size={13} />
                <span>{t("Riwayat Top Up", "Top Up History")}</span>
              </Link>
            </div>
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          aria-label={t("Pilih game top up", "Select top up game")}
        >
          <TopupGameGrid
            games={games}
            loading={loading}
            error={error}
            value=""
            onSelect={chooseGame}
            onRetry={reload}
          />
        </motion.section>
      </div>

      <Footer />
    </main>
  );
}

