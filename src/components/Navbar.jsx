import { useState, useEffect } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import {
  Zap,
  User,
  LogOut,
  Home,
  Globe,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { FB_LOGO_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export const Navbar = () => {
  const { user, openAuth, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const location = useLocation();
  const [activeHash, setActiveHash] = useState("#top");
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

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

  return (
    <>
      <header
        data-testid="main-navbar"
        className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[#07080B]/90 border-b border-line"
      >
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-13 sm:h-16 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 group">
            <a
              href={FB_LOGO_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nav-logo-facebook"
              aria-label="Facebook WillJustPlay"
              className="w-7 h-7 sm:w-8 sm:h-8 grid place-items-center bg-neon text-void transition-transform duration-300 hover:rotate-12 active:scale-95"
            >
              <Zap size={15} strokeWidth={2.75} />
            </a>
            <Link to="/" data-testid="nav-logo" className="font-display font-extrabold text-xs sm:text-sm tracking-tight uppercase">
              Will<span className="text-neon">Just</span>Play
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher (ID / EN) */}
            <div
              data-testid="nav-language-switcher"
              role="group"
              aria-label={t("Pilih Bahasa", "Select Language")}
              className="inline-flex items-center bg-panel/90 border border-line p-0.5 text-[10px] font-mono font-bold uppercase tracking-wider"
            >
              <span className="hidden min-[380px]:inline-flex items-center pl-1.5 pr-1 text-neon">
                <Globe size={11} />
              </span>
              <button
                type="button"
                onClick={() => handleLanguageChange("id")}
                data-testid="nav-lang-id"
                title="Bahasa Indonesia"
                className={`px-1.5 sm:px-2 py-1 transition-all duration-200 cursor-pointer ${
                  lang === "id"
                    ? "bg-neon text-void shadow-[0_0_10px_rgba(0,240,255,0.35)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange("en")}
                data-testid="nav-lang-en"
                title="English"
                className={`px-1.5 sm:px-2 py-1 transition-all duration-200 cursor-pointer ${
                  lang === "en"
                    ? "bg-neon text-void shadow-[0_0_10px_rgba(0,240,255,0.35)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                EN
              </button>
            </div>

            {user ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={logout}
                  data-testid="nav-logout-button"
                  aria-label={t("Keluar", "Sign Out")}
                  className="w-7 h-7 grid place-items-center text-slate-400 hover:text-coral bg-panel/80 border border-line hover:border-coral/50 transition-all duration-200 active:scale-95"
                >
                  <LogOut size={12} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openAuth("login")}
                  data-testid="nav-login-button"
                  className="group relative overflow-hidden flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] bg-neon text-void px-3 py-1.5 hover:bg-lime hover:shadow-[0_0_16px_rgba(0,240,255,0.45)] transition-all duration-300 active:scale-95"
                >
                  <User size={12} className="transition-transform duration-200 group-hover:scale-110" />
                  <span>{t("Masuk", "Sign In")}</span>
                </button>
              </div>
            )}
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
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#07080B]/95 backdrop-blur-xl border-t border-neon/30 shadow-[0_-8px_30px_rgba(0,0,0,0.85)] px-3 pt-1 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="grid grid-cols-3 items-center max-w-md mx-auto">
          <Link
            to="/topup"
            data-testid="bottom-nav-topup"
            className={`relative flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors active:scale-95 ${
              location.pathname === "/topup"
                ? "text-neon"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap size={16} />
            <span className="text-[9px] font-mono uppercase tracking-wider">{t("Top Up", "Top Up")}</span>
          </Link>

          <Link
            to="/"
            onClick={() => setActiveHash("#top")}
            data-testid="bottom-nav-beranda"
            className="relative -top-2 flex flex-col items-center justify-center active:scale-95"
          >
            <span
              className={`w-10 h-10 grid place-items-center border shadow-[0_0_18px_rgba(0,240,255,0.45)] transition-all ${
                location.pathname === "/"
                  ? "bg-lime text-void border-lime"
                  : "bg-neon text-void border-neon"
              }`}
            >
              <Home size={18} strokeWidth={2.5} />
            </span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neon mt-0.5">
              {t("Beranda", "Home")}
            </span>
          </Link>

          <Link
            to="/akun"
            data-testid="bottom-nav-akun"
            className={`relative flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors active:scale-95 ${
              location.pathname.startsWith("/akun")
                ? "text-neon"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User size={16} />
            <span className="text-[9px] font-mono uppercase tracking-wider">{t("Akun", "Account")}</span>
          </Link>
        </div>
      </div>
    </>
  );
};