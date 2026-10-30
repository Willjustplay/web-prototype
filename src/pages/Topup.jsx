import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TopupGameGrid } from "@/components/topup/TopupGameGrid";
import { TopupAccountForm } from "@/components/topup/TopupAccountForm";
import { DenominationGrid } from "@/components/topup/DenominationGrid";
import { TopupPaymentStep, DEFAULT_DUITKU_CHANNELS } from "@/components/topup/TopupPaymentStep";
import { TopupStepper } from "@/components/topup/TopupStepper";
import { api, formatApiError, formatIDR, imgSrc } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTopupGames, validateTopupDestination, localFieldError } from "@/hooks/useTopup";

const slugifyId = (v) =>
  String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Topup() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { games, loading, error, reload } = useTopupGames();

  const [step, setStep] = useState("game");
  const [slug, setSlug] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const [validation, setValidation] = useState(null);
  const [denomination, setDenomination] = useState(null);
  const [email, setEmail] = useState("");
  const [wa, setWa] = useState("");
  const [duitkuChannels, setDuitkuChannels] = useState(DEFAULT_DUITKU_CHANNELS);
  const [duitkuChannel, setDuitkuChannel] = useState("SP");
  const [submitting, setSubmitting] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const game = useMemo(() => games.find((g) => g.slug === slug) || null, [games, slug]);

  useEffect(() => {
    if (user?.email) setEmail((cur) => cur || user.email);
  }, [user?.email]);

  const productId = useMemo(
    () => (game && denomination ? `tp-${slugifyId(game.slug)}-${slugifyId(denomination.code)}` : ""),
    [game, denomination]
  );

  // Fetch enabled Duitku payment channels for Top Up products (manual methods removed).
  useEffect(() => {
    if (!game || !denomination) return;
    let alive = true;
    api
      .get("/payments/methods", { params: { product_id: productId, scope: "topup" } })
      .then((res) => {
        if (!alive) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        const duitkuItem =
          rows.find((x) => x.id === "duitku" || x.gateway_id === "duitku" || x.id === "paykita") ||
          rows[0];
        const channels =
          Array.isArray(duitkuItem?.duitku_channels) && duitkuItem.duitku_channels.length > 0
            ? duitkuItem.duitku_channels
            : DEFAULT_DUITKU_CHANNELS;
        setDuitkuChannels(channels);
        const defaultCode = duitkuItem?.default_channel || channels[0]?.code || "SP";
        setDuitkuChannel((cur) =>
          channels.some((c) => c.code === cur) ? cur : defaultCode
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [game, denomination, productId]);

  const accountErrors = useCallback(
    () =>
      Object.fromEntries(
        (game?.fields || [])
          .map((f) => [f.key, localFieldError(f, values[f.key])])
          .filter(([, msg]) => msg)
      ),
    [game, values]
  );

  const chooseGame = (g) => {
    setSlug(g.slug);
    setValues({});
    setErrors({});
    setValidation(null);
    setDenomination(null);
    setSummaryError("");
    setStep("account");
  };

  const changeField = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setValidation(null);
  };

  const runValidate = async () => {
    const found = accountErrors();
    setErrors(found);
    if (Object.keys(found).length) {
      setValidation({ ok: false, checked: false, message: Object.values(found)[0] });
      return false;
    }
    setChecking(true);
    try {
      const result = await validateTopupDestination(slug, values);
      setValidation(result);
      if (!result.ok) {
        toast.error(result.message || "Data tujuan tidak valid");
        return false;
      }
      if (result.checked) toast.success(result.nickname || "Akun ditemukan");
      return true;
    } finally {
      setChecking(false);
    }
  };

  const nextToPayment = async () => {
    if (!denomination) {
      toast.error("Pilih nominal top up terlebih dahulu");
      return;
    }
    if (await runValidate()) {
      setStep("payment");
    }
  };

  const destinationLabel = useMemo(
    () =>
      (game?.fields || [])
        .map((f) => (values[f.key] ? `${f.label}: ${values[f.key]}` : ""))
        .filter(Boolean)
        .join(" • "),
    [game, values]
  );

  const submit = async () => {
    setSummaryError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = "Wajib memasukkan alamat email aktif sebelum melakukan pembelian untuk pengiriman invoice Top Up.";
      setSummaryError(msg);
      toast.error(msg);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const msg = "Format alamat email tidak valid (contoh: nama@gmail.com).";
      setSummaryError(msg);
      toast.error(msg);
      return;
    }
    if (!duitkuChannel) {
      setSummaryError("Pilih metode pembayaran Duitku terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        game: slug,
        denomination_code: denomination.code,
        product_id: productId,
        destination: values,
        verified_nickname: validation?.nickname || "",
        buyer_email: cleanEmail,
        buyer_whatsapp: wa.trim(),
        method: "duitku",
        duitku_channel: duitkuChannel,
        payment_method: duitkuChannel,
        origin_url: window.location.origin,
      };
      const { data } = await api.post("/payments/topup/checkout", payload);
      window.location.href = data.checkout_url;
    } catch (e) {
      const message =
        formatApiError(e.response?.data?.detail) ||
        (e.response ? "Gagal membuat pesanan" : "Tidak dapat terhubung ke server. Coba lagi.");
      setSummaryError(message);
      toast.error(message);
      setSubmitting(false);
    }
  };

  const canReachStep = useCallback(
    (targetStep) => {
      if (targetStep === "game") return true;
      if (targetStep === "account" || targetStep === "denomination") return !!game;
      if (targetStep === "payment") return !!game && !!destinationLabel && !!denomination;
      return false;
    },
    [game, destinationLabel, denomination]
  );

  const stepSummaries = useMemo(
    () => ({
      game: game?.name || t("Belum dipilih", "Not selected"),
      account:
        denomination && destinationLabel
          ? `${validation?.nickname ? `${validation.nickname} · ` : ""}${destinationLabel} · ${denomination.label}`
          : denomination
            ? denomination.label
            : destinationLabel || t("Isi ID & pilih paket", "Enter ID & pick package"),
      payment: denomination ? formatIDR(denomination.price) : t("Metode bayar", "Payment method"),
    }),
    [game, destinationLabel, denomination, validation?.nickname, t]
  );

  const isConfigureStep = step === "account" || step === "denomination";

  return (
    <main className="min-h-screen bg-void grid-bg relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[460px] h-[460px] bg-neon/5 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-lime/5 rounded-full blur-[130px]" />
      </div>

      <Navbar />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-28 sm:pt-28 sm:pb-32">
        <div className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-neon mb-1.5">
            {t("Top Up Instan 24/7 · Digiflazz Official", "24/7 Instant Top Up · Digiflazz Official")}
          </p>
          <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight">
            Top Up <span className="text-stroke">Game</span>
          </h1>
        </div>

        <TopupStepper
          current={step}
          onGoTo={setStep}
          reachable={canReachStep}
          summaries={stepSummaries}
        />

        <AnimatePresence mode="wait">
          {step === "game" && (
            <motion.section
              key="game"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              aria-label="Pilih game"
            >
              <TopupGameGrid
                games={games}
                loading={loading}
                error={error}
                value={slug}
                onSelect={chooseGame}
                onRetry={reload}
              />
            </motion.section>
          )}

          {isConfigureStep && (
            <motion.section
              key="configure"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              aria-label="Isi tujuan dan pilih nominal top up"
              className="space-y-5"
            >
              {/* Compact Selected Game Bar */}
              {game && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel/90 px-4 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={imgSrc(game.icon || game.banner)}
                      alt={game.name}
                      loading="lazy"
                      className="w-11 h-11 rounded-xl object-cover border border-neon/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm sm:text-base text-slate-100 truncate">
                        {game.name}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">
                        {game.publisher || "Official Game"} &middot; Digiflazz Instan 24/7
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep("game")}
                    data-testid="topup-prev-game"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-void/80 text-slate-300 font-mono text-[11px] uppercase tracking-wider px-3.5 py-2 hover:text-neon hover:border-neon/60 transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={13} /> {t("Ganti Game", "Change Game")}
                  </button>
                </div>
              )}

              {/* Unified Destination + Denomination Card */}
              <div className="rounded-2xl border border-line bg-panel/90 p-5 sm:p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)] space-y-6">
                <TopupAccountForm
                  game={game}
                  values={values}
                  onChange={changeField}
                  errors={errors}
                  checking={checking}
                  validation={validation}
                  onValidate={runValidate}
                />

                <div className="border-t border-line/80 pt-6">
                  <DenominationGrid
                    game={game}
                    value={denomination?.code}
                    onSelect={(d) => {
                      setDenomination(d);
                      setSummaryError("");
                    }}
                  />
                </div>

                {/* Simple & Dynamic Bottom Action Bar */}
                <div className="pt-5 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    {denomination ? (
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="inline-flex items-center gap-1.5 font-display font-bold text-xs sm:text-sm text-slate-100">
                          <Zap size={13} className="text-neon shrink-0" />
                          <span>{denomination.label}</span>
                        </span>
                        <span className="text-slate-600">&middot;</span>
                        <span className="font-mono font-extrabold text-sm sm:text-base text-neon tabular-nums">
                          {formatIDR(denomination.price)}
                        </span>
                        {validation?.nickname && (
                          <span className="text-[11px] font-mono text-lime font-semibold">
                            &bull; {validation.nickname}
                          </span>
                        )}
                        {destinationLabel && (
                          <span className="text-[11px] font-mono text-slate-400 truncate">
                            ({destinationLabel})
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs font-mono text-slate-400">
                        {t(
                          "Isi ID tujuan, verifikasi ID game, dan pilih paket nominal di atas untuk melanjutkan.",
                          "Fill in target ID, verify your game ID, and choose a denomination package above to continue."
                        )}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={nextToPayment}
                    disabled={checking}
                    data-testid="topup-next-payment"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon to-cyan-300 hover:from-lime hover:to-neon text-void font-display font-extrabold text-xs uppercase tracking-wider px-6 py-3.5 shadow-[0_0_22px_rgba(0,240,255,0.3)] transition-all disabled:opacity-60 cursor-pointer active:scale-95 shrink-0"
                  >
                    <span>
                      {checking
                        ? t("Memverifikasi ID...", "Verifying ID...")
                        : t("Verifikasi & Lanjut Checkout", "Verify & Proceed to Checkout")}
                    </span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </motion.section>
          )}

          {step === "payment" && (
            <motion.section
              key="payment"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              aria-label={t("Pembayaran", "Payment")}
            >
              <TopupPaymentStep
                game={game}
                denomination={denomination}
                destinationLabel={destinationLabel}
                verifiedNickname={validation?.nickname || ""}
                email={email}
                wa={wa}
                onEmail={setEmail}
                onWa={setWa}
                duitkuChannels={duitkuChannels}
                duitkuChannel={duitkuChannel}
                onSelectDuitkuChannel={setDuitkuChannel}
                submitting={submitting}
                summaryError={summaryError}
                onSubmit={submit}
              />
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setStep("account")}
                  data-testid="topup-prev-denomination"
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel/80 text-slate-300 font-mono text-xs uppercase tracking-wider px-5 py-3 hover:text-neon hover:border-neon/60 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} /> {t("Ubah Tujuan & Nominal", "Change ID & Amount")}
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {step !== "game" && error && (
          <button
            type="button"
            onClick={reload}
            data-testid="topup-reload-games"
            className="mt-8 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-neon transition-colors cursor-pointer"
          >
            <RefreshCw size={13} /> {t("Muat ulang daftar game", "Reload games list")}
          </button>
        )}
      </div>

      <Footer />
    </main>
  );
}
