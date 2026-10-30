import { MessageCircle, ShieldCheck, CreditCard, Clock, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { waLink, STORE_LOGO_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export const Footer = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === "admin";

  return (
    <footer
      id="kontak"
      data-testid="main-footer"
      className="border-t border-line bg-void relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-28 sm:pb-28 relative z-10">
        <div className="grid md:grid-cols-12 gap-10 pb-12">
          <div className="md:col-span-7">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-11 h-11 flex items-center justify-center shrink-0">
                <img
                  src={STORE_LOGO_URL}
                  alt="WillJustPlay Store Logo"
                  className="w-full h-full object-contain mix-blend-lighten brightness-110 contrast-110 [mask-image:radial-gradient(closest-side,black_80%,transparent_100%)] drop-shadow-[0_0_10px_rgba(0,240,255,0.25)]"
                />
              </span>
              <div>
                <span className="font-display font-extrabold text-sm tracking-tight uppercase block text-slate-100">
                  Will<span className="text-neon">Just</span>Play
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-neon/85 block">
                  Official Game Store
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed text-slate-400 max-w-lg">
              {t(
                "Marketplace akun game, top-up instan, & jasa joki terpercaya di Indonesia. Semua transaksi dilindungi garansi resmi 100% uang kembali.",
                "Indonesia's trusted game account, instant top-up, & boosting marketplace. All transactions are backed by an official 100% money-back guarantee."
              )}
            </p>

            {/* Dynamic Action Buttons Area */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={waLink(t("Halo WillJustPlay!", "Hello WillJustPlay!"))}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="footer-whatsapp-button"
                className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-neon to-cyan-300 hover:from-lime hover:to-neon text-void font-display font-bold text-xs uppercase tracking-wider px-5 py-3 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_25px_rgba(163,230,53,0.45)] transition-all duration-200 active:scale-95"
              >
                <MessageCircle
                  size={15}
                  className="transition-transform duration-200 group-hover:scale-110"
                />
                <span>{t("Chat WhatsApp CS", "Chat WhatsApp Support")}</span>
                <ArrowUpRight
                  size={14}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>

              {isAdmin && (
                <Link
                  to="/admin"
                  data-testid="footer-admin-link"
                  aria-label={t("Panel Admin", "Admin Panel")}
                  className="inline-flex items-center gap-2 rounded-xl border border-lime/50 bg-lime/10 text-lime hover:bg-lime/20 font-display font-bold text-xs uppercase tracking-wider px-4 py-3 transition-all duration-200 active:scale-95"
                >
                  <ShieldCheck size={14} />
                  <span>{t("Panel Admin", "Admin Panel")}</span>
                </Link>
              )}
            </div>
          </div>

          <div className="md:col-span-5 md:pl-6">
            <p className="text-xs font-display font-bold uppercase tracking-wider text-slate-200 mb-4">
              {t("Jaminan Layanan", "Service Guarantees")}
            </p>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-center gap-2.5">
                <ShieldCheck size={15} className="text-lime shrink-0" />
                <span>
                  {t(
                    "Garansi 100% uang kembali & akun aman",
                    "100% money-back guarantee & safe accounts"
                  )}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <CreditCard size={15} className="text-neon shrink-0" />
                <span>
                  {t(
                    "Pembayaran QRIS Otomatis, E-Wallet, & Bank",
                    "Automated QRIS, E-Wallet, & Bank payments"
                  )}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock size={15} className="text-coral shrink-0" />
                <span>
                  {t(
                    "Proses pengiriman cepat 5–15 menit",
                    "Fast 5–15 minute delivery process"
                  )}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-line pt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-mono text-slate-500">
            {t(
              "© 2026 WillJustPlay · Official Game Store Indonesia",
              "© 2026 WillJustPlay · Official Game Store Indonesia"
            )}
          </p>
          <p className="text-xs font-mono text-slate-500">
            {t(
              "Akun Game · Jasa Joki · Top-Up 24/7",
              "Game Accounts · Boosting · 24/7 Top-Up"
            )}
          </p>
        </div>
      </div>
    </footer>
  );
};
