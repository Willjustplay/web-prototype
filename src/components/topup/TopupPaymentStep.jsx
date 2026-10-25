import { Loader2, Wallet, QrCode, Store, AlertCircle, Coins } from "lucide-react";
import { formatIDR, formatUSD } from "@/lib/api";

/** Step 4 — buyer contact, payment method and order summary. */
export const TopupPaymentStep = ({
  game,
  denomination,
  destinationLabel,
  email,
  wa,
  onEmail,
  onWa,
  destinations,
  destinationId,
  onDestination,
  methods,
  method,
  onMethod,
  submitting,
  summaryError,
  onSubmit,
}) => {
  const paykitaAvailable = methods.some((m) => m.id === "paykita");
  const fiatDestinations = destinations.filter((d) => d.type !== "crypto");
  const cryptoDestinations = destinations.filter((d) => d.type === "crypto");

  return (
    <div data-testid="topup-payment-step" className="grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 space-y-7">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-4">
            Kontak Penerima
          </p>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="topup-buyer-email"
                className="block text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2"
              >
                Email
              </label>
              <input
                id="topup-buyer-email"
                data-testid="topup-buyer-email"
                type="email"
                value={email}
                onChange={(e) => onEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-void border border-line px-3 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-neon transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="topup-buyer-wa"
                className="block text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2"
              >
                Nomor WhatsApp
              </label>
              <input
                id="topup-buyer-wa"
                data-testid="topup-buyer-wa"
                type="tel"
                inputMode="numeric"
                value={wa}
                onChange={(e) => onWa(e.target.value)}
                placeholder="08123456789"
                className="w-full bg-void border border-line px-3 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-neon transition-colors"
              />
            </div>
          </div>
          <p className="mt-3 text-[11px] font-mono text-slate-600">
            Isi minimal salah satu. Item top up & bukti pesanan dikirim ke kontak ini.
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-4">
            Metode Pembayaran
          </p>
          <div className="space-y-3" data-testid="topup-methods">
            {paykitaAvailable && (
              <button
                type="button"
                onClick={() => onMethod("paykita")}
                data-testid="topup-method-paykita"
                aria-pressed={method === "paykita"}
                className={`w-full flex items-center gap-3 p-4 border text-left transition-colors ${
                  method === "paykita" ? "border-neon bg-neon/5" : "border-line bg-panel hover:border-neon/50"
                }`}
              >
                <QrCode size={18} className="text-neon shrink-0" />
                <span className="flex-1">
                  <span className="block font-display font-bold text-[12px]">QRIS Otomatis</span>
                  <span className="block text-[10px] font-mono text-slate-500">
                    Scan &amp; bayar, terverifikasi otomatis
                  </span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onMethod("manual")}
              data-testid="topup-method-manual"
              aria-pressed={method === "manual"}
              className={`w-full flex items-center gap-3 p-4 border text-left transition-colors ${
                method === "manual" ? "border-neon bg-neon/5" : "border-line bg-panel hover:border-neon/50"
              }`}
            >
              <Wallet size={18} className="text-neon shrink-0" />
              <span className="flex-1">
                <span className="block font-display font-bold text-[12px]">Transfer Manual / QRIS</span>
                <span className="block text-[10px] font-mono text-slate-500">
                  Transfer Bank, E-Wallet, atau QRIS lalu unggah bukti
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => onMethod("crypto")}
              data-testid="topup-method-crypto"
              aria-pressed={method === "crypto"}
              className={`w-full flex items-center gap-3 p-4 border text-left transition-colors ${
                method === "crypto" ? "border-lime bg-lime/5" : "border-line bg-panel hover:border-lime/50"
              }`}
            >
              <Coins size={18} className="text-lime shrink-0" />
              <span className="flex-1">
                <span className="flex items-center gap-2 font-display font-bold text-[12px]">
                  <span>Pembayaran Crypto (USDT / Coin)</span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 bg-lime/15 text-lime border border-lime/40">
                    {formatUSD(null, denomination?.price || 0)} USD
                  </span>
                </span>
                <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                  USDT (TRC20 / BEP20), Solana (SOL), Bitcoin (BTC) &amp; Web3 Wallet
                </span>
              </span>
            </button>
          </div>

          {method === "manual" && fiatDestinations.length > 0 && (
            <div className="mt-4">
              <label
                htmlFor="topup-destination-select"
                className="block text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2.5"
              >
                Pilih Tujuan Pembayaran
              </label>
              <div className="grid sm:grid-cols-2 gap-2.5 mb-2">
                {fiatDestinations.map((d) => {
                  const active = d.id === destinationId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onDestination(d.id)}
                      className={`flex items-center justify-between gap-2 p-3 border text-left transition-all ${
                        active
                          ? "border-neon bg-neon/10 text-slate-100"
                          : "border-line bg-panel hover:border-neon/50 text-slate-400"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                              active
                                ? "border-neon bg-neon text-void"
                                : "border-line text-slate-400"
                            }`}
                          >
                            {d.type || "MANUAL"}
                          </span>
                          <span className="font-display font-bold text-xs truncate">
                            {d.name}
                          </span>
                        </div>
                        {d.account_number && d.account_number !== "-" && (
                          <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                            {d.account_number}{" "}
                            {d.account_name ? `• ${d.account_name}` : ""}
                          </p>
                        )}
                      </div>
                      <Store
                        size={14}
                        className={active ? "text-neon shrink-0" : "text-slate-600 shrink-0"}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="relative sr-only">
                <select
                  id="topup-destination-select"
                  data-testid="topup-destination-select"
                  value={destinationId}
                  onChange={(e) => onDestination(e.target.value)}
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.account_number && d.account_number !== "-" ? ` — ${d.account_number}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {method === "crypto" && (
            <div className="mt-4" data-testid="topup-crypto-destinations">
              <label className="block text-[10px] uppercase tracking-[0.25em] text-lime mb-2.5">
                Pilih Koin &amp; Jaringan Crypto (Network)
              </label>
              {cryptoDestinations.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-2.5 mb-2">
                  {cryptoDestinations.map((d) => {
                    const active = d.id === destinationId;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => onDestination(d.id)}
                        className={`flex items-center justify-between gap-2 p-3 border text-left transition-all ${
                          active
                            ? "border-lime bg-lime/10 text-slate-100"
                            : "border-line bg-panel hover:border-lime/50 text-slate-400"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                                active
                                  ? "border-lime bg-lime text-void"
                                  : "border-line text-slate-400"
                              }`}
                            >
                              {d.symbol || "CRYPTO"}
                            </span>
                            <span className="font-display font-bold text-xs truncate">
                              {d.name}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                            {d.network ? `Network: ${d.network}` : d.account_number}
                          </p>
                        </div>
                        <Coins
                          size={14}
                          className={active ? "text-lime shrink-0" : "text-slate-600 shrink-0"}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs font-mono text-coral">
                  Belum ada wallet crypto aktif saat ini.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="lg:col-span-2">
        <div className="border border-line bg-panel p-5 lg:sticky lg:top-24">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-4">
            Ringkasan Pesanan
          </p>

          <dl className="space-y-3 text-[12px]">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 font-mono">Game</dt>
              <dd className="text-right font-display font-bold">{game?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 font-mono shrink-0">Tujuan</dt>
              <dd className="text-right font-mono break-all" data-testid="topup-summary-destination">
                {destinationLabel || "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 font-mono">Nominal</dt>
              <dd className="text-right font-display font-bold">
                {denomination?.label || "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 pt-3 border-t border-line">
              <dt className="text-slate-400 font-mono">Total</dt>
              <dd className="text-right">
                <span
                  className="block font-mono font-bold text-neon text-base"
                  data-testid="topup-summary-total"
                >
                  {formatIDR(denomination?.price || 0)}
                </span>
                <span className="block font-mono text-xs text-lime font-semibold">
                  {formatUSD(null, denomination?.price || 0)} USD
                </span>
              </dd>
            </div>
          </dl>

          {summaryError && (
            <p
              data-testid="topup-summary-error"
              className="flex items-start gap-1.5 mt-4 text-[11px] font-mono text-coral"
            >
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              {summaryError}
            </p>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            data-testid="topup-submit-button"
            className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-neon text-void font-display font-bold text-[12px] uppercase tracking-[0.2em] py-3.5 hover:bg-lime transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Memproses..." : "Lanjut ke Pembayaran"}
          </button>

          <p className="mt-3 text-[10px] font-mono text-slate-600 text-center">
            Garansi 100% uang kembali bila item tidak masuk
          </p>
        </div>
      </aside>
    </div>
  );
};

export default TopupPaymentStep;
