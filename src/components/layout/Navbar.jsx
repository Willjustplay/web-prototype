import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import {
  Zap,
  User,
  LogOut,
  Home,
  Globe,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { FB_LOGO_URL, STORE_LOGO_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export const Navbar = () => {
  const { user, openAuth, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const location = useLocation();
  const [activeHash, setActiveHash] = useState("#top");
  const [taglineIdx, setTaglineIdx] = useState(0);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

  const brandTaglines = [
    {
      label: t("Official Game Store", "Official Game Store"),
      tone: "text-neon",
      dot: "bg-neon",
    },
    {
      label: t("100% Garansi Aman", "100% Safe Guarantee"),
      tone: "text-lime",
      dot: "bg-lime",
    },
    {
      label: t("Proses Instan 24/7", "24/7 Instant Process"),
      tone: "text-cyan-300",
      dot: "bg-cyan-300",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTaglineIdx((prev) => (prev + 1) % 3);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (location.pathname !== "/") return;
      setActiveHash("#top");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [location.pathname]);

  const handleLanguageChange = (nextLang) => {
    if (nextLang === lang) return;
    setLang(nextLang);
    toast.success(
      nextLang === "en"
        ? "Language switched to English (EN)"
        : "Bahasa diubah ke Bahasa Indonesia (ID)"
    );
  };

  const activeTagline = brandTaglines[taglineIdx % brandTaglines.length];

  return (
    <>
      <header
        data-testid="main-navbar"
        className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[#07080B]/90 border-b border-line"
      >
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5 group relative">
            <a
              href={FB_LOGO_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nav-logo-facebook"
              aria-label="Facebook WillJustPlay"
              className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center transition-transform duration-300 active:scale-95"
            >
              <img
                src={STORE_LOGO_URL}
                alt="WillJustPlay Store Logo"
                className="w-full h-full object-contain mix-blend-lighten brightness-110 contrast-110 [mask-image:radial-gradient(closest-side,black_80%,transparent_100%)] drop-shadow-[0_0_10px_rgba(0,240,255,0.25)] transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_16px_rgba(0,240,255,0.5)]"
              />
            </a>

            <Link
              to="/"
              data-testid="nav-logo"
              className="flex flex-col justify-center min-w-0"
            >
              <div className="flex items-center">
                <span className="font-display font-extrabold text-xs sm:text-base tracking-tight uppercase text-slate-100 group-hover:text-white transition-colors leading-none">
                  Will<span className="text-neon drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">Just</span>Play
                </span>
              </div>

              <div className="h-3.5 sm:h-4 flex items-center gap-1.5 overflow-hidden mt-0.5">
                <span className={`w-1 h-1 rounded-full shrink-0 transition-colors duration-300 ${activeTagline.dot}`} />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={taglineIdx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className={`text-[8px] sm:text-[9px] font-mono font-semibold uppercase tracking-[0.14em] truncate ${activeTagline.tone}`}
                  >
                    {activeTagline.label}
                  </motion.span>
                </AnimatePresence>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dynamic Language Switcher (ID / EN) */}
            <div
              data-testid="nav-language-switcher"
              role="group"
              aria-label={t("Pilih Bahasa", "Select Language")}
              className="relative inline-flex items-center gap-0.5 rounded-full bg-panel/90 border border-line/90 hover:border-neon/40 p-1 text-[10px] font-mono font-bold uppercase tracking-wider shadow-[0_4px_18px_rgba(0,0,0,0.45)] transition-colors"
            >
              <motion.span
                key={lang}
                initial={{ rotate: -35, scale: 0.85, opacity: 0.6 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 20 }}
                className="hidden min-[360px]:inline-flex items-center justify-center w-5 h-5 rounded-full bg-neon/10 text-neon"
              >
                <Globe size={11} />
              </motion.span>

              {[
                { code: "id", label: "ID", title: "Bahasa Indonesia" },
                { code: "en", label: "EN", title: "English" },
              ].map((item) => {
                const isActive = lang === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleLanguageChange(item.code)}
                    data-testid={`nav-lang-${item.code}`}
                    title={item.title}
                    className={`relative px-2.5 py-1 rounded-full transition-colors duration-200 cursor-pointer select-none ${
                      isActive
                        ? "text-void font-extrabold"
                        : "text-slate-400 hover:text-slate-100"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="navLangActivePill"
                        transition={{ type: "spring", stiffness: 420, damping: 30 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-neon to-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.45)]"
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <motion.span
          data-testid="nav-scroll-progress"
          style={{ scaleX }}
          className="absolute bottom-0 left-0 right-0 h-px origin-left bg-gradient-to-r from-neon via-lime to-coral"
        />
      </header>

      {/* Universal Bottom Navigation Dock (Ponsel, Tablet & PC) */}
      <div
        data-testid="mobile-bottom-nav"
        style={{
          WebkitTransform: "translateZ(0)",
          transform: "translateZ(0)",
        }}
        className="fixed bottom-0 left-0 right-0 z-[60] pointer-events-none px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2"
      >
        <div className="pointer-events-auto max-w-md mx-auto rounded-2xl bg-[#07080B]/90 backdrop-blur-xl border border-line/90 shadow-[0_-8px_35px_rgba(0,0,0,0.85),0_0_25px_rgba(0,240,255,0.08)] px-2 py-1.5">
          <div className="grid grid-cols-3 items-center gap-1.5">
            <Link
              to="/topup"
              data-testid="bottom-nav-topup"
              className={`group relative flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 active:scale-95 ${
                location.pathname.startsWith("/topup")
                  ? "text-void font-bold"
                  : "text-slate-400 hover:text-slate-100 hover:bg-panel/70"
              }`}
            >
              {location.pathname.startsWith("/topup") && (
                <motion.span
                  layoutId="bottomNavActivePill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-neon to-cyan-300 shadow-[0_0_16px_rgba(0,240,255,0.4)]"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Zap
                  size={15}
                  className={`transition-transform duration-200 group-hover:scale-110 ${
                    location.pathname.startsWith("/topup") ? "text-void fill-void" : "text-neon"
                  }`}
                />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                  {t("Top Up", "Top Up")}
                </span>
              </span>
            </Link>

            <Link
              to="/"
              onClick={() => setActiveHash("#top")}
              data-testid="bottom-nav-beranda"
              className={`group relative flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 active:scale-95 ${
                location.pathname === "/"
                  ? "text-void font-bold"
                  : "text-slate-300 hover:text-slate-100 hover:bg-panel/70"
              }`}
            >
              {location.pathname === "/" && (
                <motion.span
                  layoutId="bottomNavActivePill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-lime to-neon shadow-[0_0_18px_rgba(163,230,53,0.4)]"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Home
                  size={15}
                  strokeWidth={2.3}
                  className={`transition-transform duration-200 group-hover:scale-110 ${
                    location.pathname === "/" ? "text-void" : "text-lime"
                  }`}
                />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                  {t("Beranda", "Home")}
                </span>
              </span>
            </Link>

            <Link
              to="/akun"
              data-testid="bottom-nav-akun"
              className={`group relative flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 active:scale-95 ${
                location.pathname.startsWith("/akun")
                  ? "text-void font-bold"
                  : "text-slate-400 hover:text-slate-100 hover:bg-panel/70"
              }`}
            >
              {location.pathname.startsWith("/akun") && (
                <motion.span
                  layoutId="bottomNavActivePill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-neon to-cyan-300 shadow-[0_0_16px_rgba(0,240,255,0.4)]"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <User
                  size={15}
                  className={`transition-transform duration-200 group-hover:scale-110 ${
                    location.pathname.startsWith("/akun") ? "text-void" : "text-neon"
                  }`}
                />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                  {t("Akun", "Account")}
                </span>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};