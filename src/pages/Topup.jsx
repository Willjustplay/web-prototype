import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, ShieldCheck, Clock, Sparkles } from "lucide-react";
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

  return (
    <main className="min-h-screen bg-void grid-bg relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[460px] h-[460px] bg-neon/5 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-lime/5 rounded-full blur-[130px]" />
      </div>

      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-22 pb-28 sm:pt-26 sm:pb-32">
        {/* Hero Header */}
        <div className="rounded-3xl border border-line bg-gradient-to-br from-panel/95 via-void/90 to-panel/80 p-6 sm:p-8 mb-7 shadow-[0_18px_45px_rgba(0,0,0,0.45)] relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 rounded-full bg-neon/10 blur-3xl" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.3em] text-neon mb-2">
                <Sparkles size={12} />
                {t("Official Game Top Up Center · 24/7", "Official Game Top Up Center · 24/7")}
              </p>
              <h1 className="font-display font-black text-2xl sm:text-4xl uppercase tracking-tight text-white">
                Pilih <span className="text-stroke">Game</span> Favoritmu
              </h1>
              <p className="text-xs sm:text-sm font-mono text-slate-400 mt-2 max-w-2xl leading-relaxed">
                {t(
                  "Klik game di bawah untuk membuka halaman Top Up khusus game tersebut. Masukkan ID, pilih nominal, dan bayar instan dalam satu halaman.",
                  "Select any game below to open its dedicated Top Up page. Enter your ID, pick a denomination, and pay instantly on a single page."
                )}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
              <div className="rounded-2xl border border-line/80 bg-void/75 px-3.5 py-3 text-center">
                <Zap size={16} className="mx-auto text-neon mb-1" />
                <p className="text-[10px] font-display font-bold uppercase text-slate-100">
                  {t("Detik", "Seconds")}
                </p>
                <p className="text-[9px] font-mono text-slate-400">
                  {t("Proses Instan", "Instant Process")}
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-void/75 px-3.5 py-3 text-center">
                <ShieldCheck size={16} className="mx-auto text-lime mb-1" />
                <p className="text-[10px] font-display font-bold uppercase text-slate-100">
                  100% Resmi
                </p>
                <p className="text-[9px] font-mono text-slate-400">
                  {t("Legal & Aman", "Safe & Legal")}
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-void/75 px-3.5 py-3 text-center">
                <Clock size={16} className="mx-auto text-cyan-300 mb-1" />
                <p className="text-[10px] font-display font-bold uppercase text-slate-100">
                  24 / 7
                </p>
                <p className="text-[9px] font-mono text-slate-400">
                  {t("Otomatis", "Automated")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          aria-label="Pilih game top up"
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
