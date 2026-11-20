import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Wallet,
  ArrowLeft,
  ArrowRight,
  Loader2,
  RefreshCw,
  QrCode,
  CreditCard,
  Coins,
  Check,
  AlertCircle,
  Clock,
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  formatIDR,
  formatUSD,
  formatApiError,
} from "@/lib/api";

const WALLET_PRESET_AMOUNTS = [20000, 50000, 100000, 250000, 500000, 1000000];

const fmtDate = (v) => {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(v);
  }
};

export default function WalletTopup() {
  const { user, setUser, initializing, openAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const [walletData, setWalletData] = useState({
    balance: Math.max(0, Math.round(Number(user?.balance || 0))),
    min_topup: 20000,
    ledger: [],
    topup_orders: [],
  });
  const [walletAmountInput, setWalletAmountInput] = useState("50000");
  const [walletPaymentType, setWalletPaymentType] = useState("manual");
  const [manualDests, setManualDests] = useState([]);
  const [selectedManualDestId, setSelectedManualDestId] = useState("");
  const [selectedCryptoDestId, setSelectedCryptoDestId] = useState("");
  const [submittingWalletTopup, setSubmittingWalletTopup] = useState(false);

  const userKey = user?.id || user?.email || "";

  const fetchWalletPageData = useCallback(
    async (isSilent = false) => {
      if (!userKey) {
        setLoading(false);
        return;
      }
      if (isSilent || hasLoadedRef.current) setRefreshing(true);
      else setLoading(true);

      try {
        const [wal, wMethods, mDests] = await Promise.allSettled([
          api.get("/me/wallet"),
          api.get("/payments/methods", { params: { scope: "wallet" } }),
          api.get("/payments/manual-destinations"),
        ]);

        if (wal.status === "fulfilled" && wal.value?.data) {
          const nextBalance = Math.max(0, Math.round(Number(wal.value.data.balance || 0)));
          setWalletData({
            balance: nextBalance,
            min_topup: Number(wal.value.data.min_topup || 20000),
            ledger: Array.isArray(wal.value.data.ledger) ? wal.value.data.ledger : [],
            topup_orders: Array.isArray(wal.value.data.topup_orders)
              ? wal.value.data.topup_orders
              : [],
          });
          if (typeof setUser === "function") {
            setUser((prev) =>
              prev && Number(prev.balance || 0) !== nextBalance
                ? { ...prev, balance: nextBalance }
                : prev
            );
          }
        }

        if (wMethods.status === "fulfilled" && Array.isArray(wMethods.value?.data)) {
          const list = wMethods.value.data;
          if (list.length > 0) {
            setWalletPaymentType((cur) =>
              list.some((m) => m.id === cur) ? cur : list[0].id
            );
          }
        }

        if (mDests.status === "fulfilled" && Array.isArray(mDests.value?.data)) {
          const dests = mDests.value.data;
          setManualDests(dests);
          const firstFiat = dests.find((d) => d.type !== "crypto");
          const firstCrypto = dests.find((d) => d.type === "crypto");
          if (firstFiat) setSelectedManualDestId((cur) => cur || firstFiat.id);
          if (firstCrypto) setSelectedCryptoDestId((cur) => cur || firstCrypto.id);
        }

        hasLoadedRef.current = true;
        if (isSilent) {
          toast.success("Saldo diperbarui");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userKey, setUser]
  );

  useEffect(() => {
    if (!userKey) {
      hasLoadedRef.current = false;
      setLoading(false);
      return;
    }
    fetchWalletPageData(false);
  }, [userKey, fetchWalletPageData]);

  const currentWalletBalance = useMemo(() => {
    if (typeof walletData.balance === "number") return walletData.balance;
    return Math.max(0, Math.round(Number(user?.balance || 0)));
  }, [walletData.balance, user?.balance]);

  const fiatManualDests = useMemo(
    () => manualDests.filter((d) => d.type !== "crypto"),
    [manualDests]
  );
  const cryptoManualDests = useMemo(
    () => manualDests.filter((d) => d.type === "crypto"),
    [manualDests]
  );

  const parsedWalletAmount = useMemo(() => {
    const cleaned = String(walletAmountInput || "").replace(/[^0-9]/g, "");
    return Math.round(Number(cleaned || 0));
  }, [walletAmountInput]);

  const minTopup = Number(walletData.min_topup || 20000);
  const pendingTopupOrders = useMemo(
    () => (walletData.topup_orders || []).filter((o) => o.payment_status === "pending"),
    [walletData.topup_orders]
  );

  const handleWalletTopupSubmit = async (e) => {
    e?.preventDefault();
    if (!Number.isFinite(parsedWalletAmount) || parsedWalletAmount < minTopup) {
      toast.error(`Minimal ${formatIDR(minTopup)}`);
      return;
    }
    if (walletPaymentType === "manual" && !selectedManualDestId) {
      toast.error("Pilih tujuan pembayaran manual");
      return;
    }
    if (walletPaymentType === "crypto" && !selectedCryptoDestId) {
      toast.error("Pilih jaringan crypto");
      return;
    }
    setSubmittingWalletTopup(true);
    try {
      const { data } = await api.post("/payments/wallet/topup", {
        amount: parsedWalletAmount,
        payment_type: walletPaymentType,
        destination_id:
          walletPaymentType === "crypto"
            ? selectedCryptoDestId
            : walletPaymentType === "manual"
            ? selectedManualDestId
            : undefined,
        buyer_email: user?.email || "",
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) || "Gagal membuat tagihan"
      );
      setSubmittingWalletTopup(false);
    }
  };

  return (
    <div className="min-h-screen bg-void text-slate-100 flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16">
        {initializing ? (
          <div className="py-24 grid place-items-center text-neon">
            <Loader2 size={26} className="animate-spin" />
          </div>
        ) : !user ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto rounded-2xl bg-panel/90 border border-line p-7 text-center my-8"
            data-testid="wallet-page-guest"
          >
            <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-lime/10 border border-lime/40 grid place-items-center text-lime">
              <Wallet size={20} />
            </div>
            <h1 className="font-display font-extrabold text-lg sm:text-xl">
              Isi Saldo Akun
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-1.5">
              Masuk untuk melanjutkan pengisian saldo.
            </p>
            <div className="flex gap-2.5 justify-center mt-5">
              <button
                onClick={() => openAuth("login")}
                data-testid="wallet-guest-login"
                className="rounded-lg bg-lime text-void font-display font-bold text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-neon transition-colors cursor-pointer"
              >
                Masuk
              </button>
              <button
                onClick={() => openAuth("register")}
                data-testid="wallet-guest-register"
                className="rounded-lg border border-neon text-neon hover:bg-neon/10 font-mono text-xs uppercase tracking-wider px-5 py-2.5 transition-colors cursor-pointer"
              >
                Daftar
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
            data-testid="wallet-topup-page"
          >
            {/* Compact Single-Row Header */}
            <div className="rounded-xl bg-panel/90 border border-line px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link
                  to="/akun"
                  data-testid="wallet-back-to-account"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-transparent hover:border-neon/60 text-slate-300 hover:text-neon px-3 py-1.5 text-xs font-mono font-bold transition-colors"
                >
                  <ArrowLeft size={13} /> Akun
                </Link>
                <h1 className="font-display font-extrabold text-base sm:text-lg text-slate-100">
                  Isi Saldo
                </h1>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-transparent border border-lime/40 px-3.5 py-1.5 flex items-center gap-2">
                  <Wallet size={14} className="text-lime shrink-0" />
                  <span className="text-[11px] font-mono text-slate-400">Saldo:</span>
                  <strong
                    data-testid="wallet-form-current-balance"
                    className="font-mono font-extrabold text-sm sm:text-base text-lime tabular-nums"
                  >
                    {formatIDR(currentWalletBalance)}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => fetchWalletPageData(true)}
                  disabled={refreshing || loading}
                  data-testid="wallet-sync-button"
                  title="Perbarui saldo"
                  className="inline-flex items-center justify-center border border-line hover:border-neon/60 bg-transparent text-slate-300 hover:text-neon rounded-xl p-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={refreshing ? "animate-spin text-neon" : ""} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="min-h-[320px] grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 h-72 rounded-xl bg-panel/80 border border-line animate-pulse" />
                <div className="lg:col-span-5 h-72 rounded-xl bg-panel/80 border border-line animate-pulse" />
              </div>
            ) : (
              <section
                data-testid="account-wallet-section"
                className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
              >
                {/* Left Column: Simple & Dynamic Form */}
                <div className="lg:col-span-7 rounded-xl bg-panel/90 border border-line p-4 sm:p-5">
                  <form onSubmit={handleWalletTopupSubmit} className="space-y-4">
                    {/* Nominal Input + Presets */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <label htmlFor="wallet-topup-amount-input" className="text-slate-300 font-bold">
                          Nominal
                        </label>
                        <span className="text-[11px] text-slate-400">
                          Min. <strong className="text-lime">{formatIDR(minTopup)}</strong>
                        </span>
                      </div>

                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                          Rp
                        </span>
                        <input
                          id="wallet-topup-amount-input"
                          data-testid="wallet-topup-amount-input"
                          type="number"
                          min={minTopup}
                          step={1000}
                          value={walletAmountInput}
                          onChange={(e) => setWalletAmountInput(e.target.value)}
                          placeholder="50000"
                          className="w-full rounded-xl bg-void border border-line focus:border-neon pl-10 pr-4 py-2.5 text-base font-mono font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors tabular-nums"
                        />
                      </div>

                      {parsedWalletAmount > 0 && parsedWalletAmount < minTopup && (
                        <p
                          data-testid="wallet-min-amount-error"
                          className="text-[11px] font-mono text-coral flex items-center gap-1"
                        >
                          <AlertCircle size={12} /> Minimal {formatIDR(minTopup)}
                        </p>
                      )}

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-0.5">
                        {WALLET_PRESET_AMOUNTS.map((amt) => {
                          const active = parsedWalletAmount === amt;
                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setWalletAmountInput(String(amt))}
                              data-testid={`wallet-preset-${amt}`}
                              className={`rounded-lg py-2 px-2 text-xs font-mono font-bold border bg-transparent transition-all cursor-pointer ${
                                active
                                  ? "border-neon text-neon shadow-[0_0_10px_rgba(0,240,255,0.18)]"
                                  : "border-line text-slate-300 hover:border-neon/50 hover:text-neon"
                              }`}
                            >
                              {amt >= 1000000 ? `${amt / 1000000} Jt` : `${amt / 1000}rb`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dynamic Payment Method Switcher */}
                    <div className="space-y-2.5">
                      <span className="block text-xs font-mono font-bold text-slate-300">
                        Metode Pembayaran
                      </span>

                      <div className="grid grid-cols-3 gap-2">
                        {fiatManualDests.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setWalletPaymentType("manual")}
                            data-testid="wallet-method-manual"
                            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 border bg-transparent text-xs font-display font-bold transition-all cursor-pointer ${
                              walletPaymentType === "manual"
                                ? "border-neon text-neon shadow-[0_0_12px_rgba(0,240,255,0.16)]"
                                : "border-line text-slate-300 hover:border-neon/40"
                            }`}
                          >
                            <CreditCard size={14} className="shrink-0" />
                            <span className="truncate">Manual</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setWalletPaymentType("paykita")}
                          data-testid="wallet-method-paykita"
                          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 border bg-transparent text-xs font-display font-bold transition-all cursor-pointer ${
                            walletPaymentType === "paykita"
                              ? "border-neon text-neon shadow-[0_0_12px_rgba(0,240,255,0.16)]"
                              : "border-line text-slate-300 hover:border-neon/40"
                          }`}
                        >
                          <QrCode size={14} className="shrink-0" />
                          <span className="truncate">QRIS</span>
                        </button>

                        {cryptoManualDests.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setWalletPaymentType("crypto")}
                            data-testid="wallet-method-crypto"
                            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 border bg-transparent text-xs font-display font-bold transition-all cursor-pointer ${
                              walletPaymentType === "crypto"
                                ? "border-lime text-lime shadow-[0_0_12px_rgba(163,230,53,0.16)]"
                                : "border-line text-slate-300 hover:border-lime/40"
                            }`}
                          >
                            <Coins size={14} className="shrink-0" />
                            <span className="truncate">Crypto</span>
                          </button>
                        )}
                      </div>

                      <AnimatePresence mode="wait" initial={false}>
                        {walletPaymentType === "manual" && fiatManualDests.length > 0 && (
                          <motion.div
                            key="dest-manual"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.14 }}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5"
                            data-testid="wallet-manual-dest-list"
                          >
                            {fiatManualDests.map((d) => {
                              const selected = selectedManualDestId === d.id;
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => setSelectedManualDestId(d.id)}
                                  data-testid={`wallet-manual-dest-${d.id}`}
                                  className={`flex items-center justify-between gap-2 rounded-xl p-2.5 border bg-transparent text-left transition-all cursor-pointer ${
                                    selected
                                      ? "border-neon text-slate-100"
                                      : "border-line text-slate-300 hover:border-neon/40"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-display font-bold truncate">
                                      {d.name}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-400 truncate">
                                      {d.type === "qris"
                                        ? "QRIS Manual"
                                        : `${d.account_number || ""} ${
                                            d.account_holder ? `· ${d.account_holder}` : ""
                                          }`}
                                    </p>
                                  </div>
                                  <span
                                    className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                      selected ? "border-neon bg-neon text-void" : "border-slate-600"
                                    }`}
                                  >
                                    {selected && <Check size={10} strokeWidth={3} />}
                                  </span>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}

                        {walletPaymentType === "crypto" && cryptoManualDests.length > 0 && (
                          <motion.div
                            key="dest-crypto"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.14 }}
                            className="space-y-1.5 pt-0.5"
                            data-testid="wallet-crypto-dest-list"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {cryptoManualDests.map((d) => {
                                const selected = selectedCryptoDestId === d.id;
                                return (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => setSelectedCryptoDestId(d.id)}
                                    data-testid={`wallet-crypto-dest-${d.id}`}
                                    className={`flex items-center justify-between gap-2 rounded-xl p-2.5 border bg-transparent text-left transition-all cursor-pointer ${
                                      selected
                                        ? "border-lime text-slate-100"
                                        : "border-line text-slate-300 hover:border-lime/40"
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-display font-bold truncate">
                                        {d.name} ({d.symbol || "USDT"})
                                      </p>
                                      <p className="text-[10px] font-mono text-lime truncate">
                                        {d.network || "TRC20 / BEP20"} · ~{formatUSD(null, parsedWalletAmount || minTopup)} USD
                                      </p>
                                    </div>
                                    <span
                                      className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                                        selected ? "border-lime bg-lime text-void" : "border-slate-600"
                                      }`}
                                    >
                                      {selected && <Check size={10} strokeWidth={3} />}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Total & Submit Bar */}
                    <div className="rounded-xl bg-void/80 border border-line px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="block text-[10px] font-mono uppercase text-slate-400">
                          Total Bayar
                        </span>
                        <p
                          data-testid="wallet-topup-total-preview"
                          className="font-mono font-extrabold text-base sm:text-lg text-neon tabular-nums"
                        >
                          {formatIDR(parsedWalletAmount || 0)}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingWalletTopup || parsedWalletAmount < minTopup}
                        data-testid="wallet-topup-submit-btn"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime hover:bg-neon text-void font-display font-extrabold text-xs uppercase tracking-wider px-5 py-3 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {submittingWalletTopup ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Memproses...</span>
                          </>
                        ) : (
                          <>
                            <span>Bayar Sekarang</span>
                            <ArrowRight size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: Pending Bills & Balance History */}
                <div className="lg:col-span-5 space-y-4">
                  {pendingTopupOrders.length > 0 && (
                    <div className="rounded-xl bg-panel/90 border border-neon/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-neon flex items-center gap-1.5">
                          <Clock size={13} /> Tagihan Menunggu
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400">
                          {pendingTopupOrders.length}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {pendingTopupOrders.slice(0, 4).map((o) => (
                          <div
                            key={o.session_id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-void/70 border border-line px-3 py-2 text-xs font-mono"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-lime tabular-nums">{formatIDR(o.amount)}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {o.manual_destination_label || "QRIS"}
                              </p>
                            </div>
                            <Link
                              to={`/payment/success?session_id=${o.session_id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-neon/50 bg-transparent text-neon hover:bg-neon hover:text-void px-2.5 py-1 text-[10px] font-bold shrink-0 transition-colors"
                            >
                              Bayar <ArrowRight size={11} />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl bg-panel/90 border border-line p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Activity size={14} className="text-lime" /> Mutasi Saldo
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                        {walletData.ledger?.length || 0}
                      </span>
                    </div>

                    {!walletData.ledger || walletData.ledger.length === 0 ? (
                      <div className="rounded-lg bg-void/50 border border-line py-6 px-4 text-center text-xs font-mono text-slate-500">
                        Belum ada mutasi saldo
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                        {walletData.ledger.map((entry) => {
                          const isCredit = entry.direction === "credit";
                          return (
                            <div
                              key={entry.id}
                              data-testid="wallet-ledger-item"
                              className="rounded-lg bg-void/65 border border-line px-3 py-2.5 flex items-center justify-between gap-2.5 text-xs font-mono"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-lg grid place-items-center shrink-0 ${
                                    isCredit
                                      ? "text-lime border border-lime/30"
                                      : "text-neon border border-neon/30"
                                  }`}
                                >
                                  {isCredit ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-slate-100 font-semibold truncate">
                                    {entry.description || (isCredit ? "Isi Saldo" : "Pembayaran")}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {fmtDate(entry.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p
                                  className={`font-bold tabular-nums ${
                                    isCredit ? "text-lime" : "text-coral"
                                  }`}
                                >
                                  {isCredit ? "+" : "-"}
                                  {formatIDR(entry.amount)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
}
