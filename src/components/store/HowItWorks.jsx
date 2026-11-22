import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  MousePointerClick,
  CreditCard,
  ShieldCheck,
  Zap,
  Gamepad2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export const HowItWorks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === "admin";
  const [flowMode, setFlowMode] = useState("store");
  const [activeStep, setActiveStep] = useState(0);

  const flowModes = {
    store: {
      label: t("Beli Akun & Joki", "Buy Accounts & Boost"),
      icon: Gamepad2,
      steps: [
        {
          num: "01",
          icon: MousePointerClick,
          badge: t("~1 Menit", "~1 Minute"),
          title: t("Pilih Akun / Jasa", "Choose Account / Boost"),
          desc: t(
            "Cari akun game impianmu di katalog atau pilih paket jasa joki rank sesuai kebutuhan & budget.",
            "Browse your dream game account in our catalog or pick a rank boosting package that fits your needs & budget."
          ),
          highlights: [
            t("Spesifikasi akun transparan", "Transparent account specs"),
            t("Harga IDR & USD jelas", "Clear IDR & USD pricing"),
          ],
        },
        {
          num: "02",
          icon: CreditCard,
          badge: t("QRIS / Transfer", "QRIS / Transfer"),
          title: t("Bayar & Konfirmasi", "Pay & Confirm"),
          desc: t(
            "Selesaikan pembayaran via QRIS otomatis, e-wallet, atau transfer bank dengan sistem verifikasi cepat.",
            "Complete payment via automated QRIS, e-wallet, or bank transfer with fast verification."
          ),
          highlights: [
            t("QRIS otomatis 24/7", "24/7 automated QRIS"),
            t("Bukti transfer terenkripsi", "Encrypted transfer receipt"),
          ],
        },
        {
          num: "03",
          icon: ShieldCheck,
          badge: t("5–15 Menit", "5–15 Minutes"),
          title: t("Terima & Garansi", "Receive & Warranty"),
          desc: t(
            "Data akses akun atau progres joki langsung dikirim ke dashboard Akun Saya. Dilengkapi garansi penuh.",
            "Account credentials or boosting progress are delivered directly to your My Account dashboard with full warranty."
          ),
          highlights: [
            t("Akses instan di brankas akun", "Instant access in account vault"),
            t("Garansi 100% uang kembali", "100% money-back guarantee"),
          ],
        },
      ],
    },
    topup: {
      label: t("Top-Up Game Instan", "Instant Game Top-Up"),
      icon: Zap,
      steps: [
        {
          num: "01",
          icon: Gamepad2,
          badge: t("Detik Itu Juga", "Right Away"),
          title: t("Masukkan ID & Pilih Nominal", "Enter ID & Select Amount"),
          desc: t(
            "Pilih game favoritmu, masukkan User ID / Zone ID, lalu pilih nominal diamond atau voucher yang diinginkan.",
            "Pick your favorite game, enter your User ID / Zone ID, and choose your desired diamond or voucher package."
          ),
          highlights: [
            t("Tanpa perlu login akun game", "No game login required"),
            t("Harga langsung dari pusat", "Direct official pricing"),
          ],
        },
        {
          num: "02",
          icon: CreditCard,
          badge: t("Otomatis 24/7", "24/7 Automatic"),
          title: t("Scan QRIS / E-Wallet", "Scan QRIS / E-Wallet"),
          desc: t(
            "Bayar praktis menggunakan QRIS atau metode pembayaran instan tanpa harus antre konfirmasi manual.",
            "Pay conveniently via QRIS or instant payment methods without waiting for manual confirmation."
          ),
          highlights: [
            t("Verifikasi pembayaran real-time", "Real-time payment verification"),
            t("Bebas biaya tersembunyi", "Zero hidden fees"),
          ],
        },
        {
          num: "03",
          icon: Zap,
          badge: t("1–5 Menit", "1–5 Minutes"),
          title: t("Diamond Langsung Masuk", "Instant Diamond Delivery"),
          desc: t(
            "Sistem memproses pesanan secara otomatis dan item langsung dikirim ke akun game kamu dengan status real-time.",
            "Our system processes orders automatically and delivers items straight to your game account with real-time status."
          ),
          highlights: [
            t("Lacak status di halaman invoice", "Track status on invoice page"),
            t("Dukungan CS responsif", "Responsive customer support"),
          ],
        },
      ],
    },
  };

  const currentFlow = flowModes[flowMode];

  return (
    <section
      id="cara-kerja"
      data-testid="how-it-works-section"
      className="py-16 sm:py-24 border-t border-line bg-[#0A0D14] relative overflow-hidden"
    >
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
        onClick={isAdmin ? () => navigate("/admin?mode=password") : undefined}
        data-testid="how-it-works-admin-trigger"
        title={isAdmin ? t("Masuk panel admin", "Open admin panel") : undefined}
      >
        {/* Header & Interactive Flow Switcher */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neon font-mono mb-2.5">
              {t("02. Alur Transaksi Cepat", "02. Fast Transaction Flow")}
            </p>
            <h2
              className="font-display font-bold uppercase tracking-tight text-2xl sm:text-3xl lg:text-4xl text-slate-100"
              data-testid="how-it-works-title"
            >
              {t("Tiga Langkah. ", "Three Steps. ")}
              <span className="text-stroke">{t("Nol Ribet.", "Zero Hassle.")}</span>
            </h2>
          </div>

          {/* Interactive Mode Switcher */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg bg-panel/90 border border-line p-1 self-start md:self-auto shadow-sm"
          >
            {Object.entries(flowModes).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isSelected = flowMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFlowMode(key);
                    setActiveStep(0);
                  }}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-display font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected ? "text-void font-bold" : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="howItWorksFlowPill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-md bg-neon shadow-[0_0_12px_rgba(0,240,255,0.3)]"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Icon size={12} className="shrink-0" />
                    <span>{cfg.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Step Cards Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={flowMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid md:grid-cols-3 gap-4 sm:gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {currentFlow.steps.map((s, i) => {
              const isFocused = activeStep === i;
              const StepIcon = s.icon;
              return (
                <motion.div
                  key={s.num}
                  onMouseEnter={() => setActiveStep(i)}
                  onClick={() => setActiveStep(i)}
                  whileHover={{ y: -4 }}
                  data-testid={`step-card-${s.num}`}
                  className={`group relative rounded-2xl bg-panel/90 border p-6 sm:p-7 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden ${
                    isFocused
                      ? "border-neon/60 bg-neon/[0.03] shadow-[0_12px_35px_rgba(0,0,0,0.45)]"
                      : "border-line hover:border-neon/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <span
                        className={`w-11 h-11 rounded-xl grid place-items-center border transition-colors duration-200 shrink-0 ${
                          isFocused
                            ? "bg-neon text-void border-neon shadow-[0_0_15px_rgba(0,240,255,0.35)]"
                            : "bg-void/80 border-line text-neon group-hover:border-neon/50"
                        }`}
                      >
                        <StepIcon size={18} />
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400">
                          <Clock size={11} className="text-lime" /> {s.badge}
                        </span>
                        <span className="font-display font-black text-3xl sm:text-4xl text-stroke opacity-75 group-hover:opacity-100 transition-opacity tabular-nums">
                          {s.num}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-display font-bold text-base sm:text-lg text-slate-100 group-hover:text-neon transition-colors">
                      {s.title}
                    </h3>
                    <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-400">
                      {s.desc}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-line/80 space-y-1.5">
                    {s.highlights.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-[11px] font-mono text-slate-300"
                      >
                        <CheckCircle2 size={12} className="text-lime shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};