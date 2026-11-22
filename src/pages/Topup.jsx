import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
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

      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 pt-[72px] pb-24 sm:pt-24 sm:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="mb-3.5 sm:mb-4"
        >
          <h1 className="font-display font-black text-lg sm:text-2xl uppercase tracking-tight text-white">
            Top Up <span className="text-stroke">Game</span>
          </h1>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
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

