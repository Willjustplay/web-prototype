import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  X,
  Image as ImageIcon,
  Coins,
  Wallet,
  Copy,
  Search,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { api, imgSrc, formatIDR, getUsdRate, setUsdRate } from "@/lib/api";

const CRYPTO_PRESETS = [
  { name: "USDT (Tether)", symbol: "USDT", network: "TRC20 (Tron)" },
  { name: "USDT (BNB Chain)", symbol: "USDT", network: "BEP20 (BSC)" },
  { name: "USDC (Solana)", symbol: "USDC", network: "SPL (Solana)" },
  { name: "Solana (SOL)", symbol: "SOL", network: "SPL (Solana)" },
  { name: "Bitcoin (BTC)", symbol: "BTC", network: "BTC (Native SegWit)" },
  { name: "Ethereum (ETH)", symbol: "ETH", network: "ERC20 / Arbitrum" },
  { name: "Binance Pay", symbol: "USDT", network: "Binance Pay ID" },
];

const TYPE_LABELS = {
  bank: "Transfer Bank",
  ewallet: "E-Wallet",
  qris: "QRIS Statis",
  crypto: "Crypto / Web3",
};

export function AdminPayment({ defaultMode = "fiat" }) {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState(
    defaultMode === "crypto" ? "crypto" : "fiat"
  );
  const [usdRateInput, setUsdRateInput] = useState(String(getUsdRate()));
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    if (defaultMode === "crypto" || defaultMode === "fiat") {
      setFilterMode(defaultMode);
    }
  }, [defaultMode]);

  const load = async () => {
    try {
      const [destRes, rateRes] = await Promise.all([
        api.get("/admin/payments/manual-destinations"),
        api.get("/admin/payments/crypto-rate").catch(() => ({ data: null })),
      ]);
      setDestinations(Array.isArray(destRes.data) ? destRes.data : []);
      const loadedRate = Number(rateRes?.data?.usd_to_idr_rate);
      if (loadedRate >= 1000) {
        setUsdRateInput(String(loadedRate));
        setUsdRate(loadedRate);
      }
    } catch {
      toast.error("Gagal memuat metode pembayaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveUsdRate = async (e) => {
    e.preventDefault();
    const numericRate = Math.round(Number(usdRateInput || 0));
    if (!Number.isFinite(numericRate) || numericRate < 1000) {
      toast.error("Kurs minimal Rp 1.000 per 1 USD");
      return;
    }
    setSavingRate(true);
    try {
      const { data } = await api.put("/admin/payments/crypto-rate", {
        usd_to_idr_rate: numericRate,
      });
      const updatedRate = Number(data?.usd_to_idr_rate || numericRate);
      setUsdRateInput(String(updatedRate));
      setUsdRate(updatedRate);
      toast.success(`Kurs Crypto diperbarui: 1 USD = ${formatIDR(updatedRate)}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan kurs Crypto");
    } finally {
      setSavingRate(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const targetMode = editing.type === "crypto" ? "crypto" : "fiat";
      if (editing.id) {
        await api.put(`/admin/payments/manual-destinations/${editing.id}`, editing);
        toast.success("Tujuan pembayaran diperbarui");
      } else {
        await api.post("/admin/payments/manual-destinations", editing);
        toast.success("Tujuan pembayaran ditambahkan");
      }
      setFilterMode(targetMode);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan");
    }
  };

  const toggleActive = async (item) => {
    setTogglingId(item.id);
    try {
      const updated = { ...item, is_active: !item.is_active };
      await api.put(`/admin/payments/manual-destinations/${item.id}`, updated);
      setDestinations((prev) =>
        prev.map((d) => (d.id === item.id ? updated : d))
      );
      toast.success(
        updated.is_active
          ? `${item.name} diaktifkan`
          : `${item.name} dinonaktifkan`
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mengubah status");
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/admin/payments/manual-destinations/${id}`);
      toast.success("Tujuan pembayaran dihapus");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal menghapus");
    }
  };

  const uploadImage = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/admin/upload", fd);
      setEditing((prev) => ({ ...prev, image: data.url }));
      toast.success("Gambar berhasil diupload");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mengupload gambar");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const fiatItems = useMemo(
    () => destinations.filter((d) => d.type !== "crypto"),
    [destinations]
  );
  const cryptoItems = useMemo(
    () => destinations.filter((d) => d.type === "crypto"),
    [destinations]
  );

  const filteredDestinations = useMemo(() => {
    const base = filterMode === "crypto" ? cryptoItems : fiatItems;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (d) =>
        String(d.name || "").toLowerCase().includes(q) ||
        String(d.account_name || "").toLowerCase().includes(q) ||
        String(d.account_number || "").toLowerCase().includes(q) ||
        String(d.symbol || "").toLowerCase().includes(q) ||
        String(d.network || "").toLowerCase().includes(q)
    );
  }, [filterMode, cryptoItems, fiatItems, search]);

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="animate-spin text-neon" size={24} />
      </div>
    );
  }

  return (
    <section
      className="rounded-2xl border border-line bg-panel/75 p-4 sm:p-5 space-y-5"
      data-testid="admin-payment-section"
    >
      {/* Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line/70">
        <div className="flex items-start sm:items-center gap-3">
          <span
            className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 border ${
              filterMode === "crypto"
                ? "bg-lime/10 border-lime/40 text-lime"
                : "bg-neon/10 border-neon/40 text-neon"
            }`}
          >
            {filterMode === "crypto" ? <Coins size={16} /> : <Wallet size={16} />}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-100">
                {filterMode === "crypto"
                  ? "Katalog Wallet Crypto (USDT / Web3)"
                  : "Katalog Rekening Bank, E-Wallet & QRIS"}
              </h3>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                &middot;{" "}
                {filterMode === "crypto"
                  ? `${cryptoItems.length} wallet (${cryptoItems.filter((d) => d.is_active).length} aktif)`
                  : `${fiatItems.length} metode (${fiatItems.filter((d) => d.is_active).length} aktif)`}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              {filterMode === "crypto"
                ? "Kelola alamat wallet USDT, USDC, BTC, SOL & jaringan blockchain untuk pembayaran internasional (USD)."
                : "Kelola nomor rekening bank, E-Wallet, dan gambar QRIS statis untuk pembayaran transfer manual (IDR)."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFilterMode("fiat");
              setEditing({
                type: "bank",
                name: "",
                account_name: "",
                account_number: "",
                symbol: "",
                network: "",
                image: "",
                is_active: true,
              });
            }}
            data-testid="add-destination-button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-neon to-cyan-300 hover:from-lime hover:to-neon text-void text-xs font-display font-extrabold uppercase tracking-wider px-3.5 py-2.5 shadow-[0_0_16px_rgba(0,240,255,0.22)] transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus size={14} />
            <span>Tambah Rekening / QRIS</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode("crypto");
              setEditing({
                type: "crypto",
                name: "USDT (Tether)",
                symbol: "USDT",
                network: "TRC20 (Tron)",
                account_name: "WillJustPlay Crypto",
                account_number: "",
                image: "",
                is_active: true,
              });
            }}
            data-testid="add-crypto-destination-button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-lime/50 bg-lime/15 hover:bg-lime text-lime hover:text-void text-xs font-display font-extrabold uppercase tracking-wider px-3.5 py-2.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Coins size={14} />
            <span>Tambah Wallet Crypto</span>
          </button>
        </div>
      </div>

      {/* Separated Catalog Tabs (No "Semua Metode") + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-void/70 border border-line rounded-xl p-1">
          <button
            type="button"
            onClick={() => setFilterMode("fiat")}
            data-testid="filter-payment-fiat"
            className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-display font-semibold px-3.5 py-2 transition-colors cursor-pointer whitespace-nowrap ${
              filterMode === "fiat"
                ? "bg-neon text-void font-bold shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wallet size={13} />
            <span>Bank / E-Wallet / QRIS</span>
            <span
              className={`text-[10px] font-mono tabular-nums ${
                filterMode === "fiat" ? "text-void/80" : "text-slate-500"
              }`}
            >
              ({fiatItems.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode("crypto")}
            data-testid="filter-payment-crypto"
            className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-display font-semibold px-3.5 py-2 transition-colors cursor-pointer whitespace-nowrap ${
              filterMode === "crypto"
                ? "bg-lime text-void font-bold shadow-[0_0_12px_rgba(163,255,18,0.25)]"
                : "text-slate-400 hover:text-lime"
            }`}
          >
            <Coins size={13} />
            <span>Wallet Crypto / Web3</span>
            <span
              className={`text-[10px] font-mono tabular-nums ${
                filterMode === "crypto" ? "text-void/80" : "text-slate-500"
              }`}
            >
              ({cryptoItems.length})
            </span>
          </button>
        </div>

        <div className="relative w-full md:w-64">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              filterMode === "crypto"
                ? "Cari koin, jaringan, alamat..."
                : "Cari bank, e-wallet, no rek..."
            }
            className="w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono pl-9 pr-3.5 py-2 text-slate-100 placeholder:text-slate-600 transition-colors"
          />
        </div>
      </div>

      {/* Crypto Exchange Rate Setting Bar (1 USD -> IDR) */}
      <form
        onSubmit={handleSaveUsdRate}
        data-testid="admin-crypto-rate-form"
        className="rounded-xl border border-lime/30 bg-lime/[0.04] px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-lime/15 border border-lime/30 text-lime grid place-items-center shrink-0">
            <Coins size={15} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-display font-bold text-slate-100">
                Kurs Crypto (1 USD &rarr; IDR)
              </span>
              <span className="text-[11px] font-mono text-lime font-bold tabular-nums">
                $1 = {formatIDR(Number(usdRateInput) || 16000)} &middot; $10 ={" "}
                {formatIDR((Number(usdRateInput) || 16000) * 10)}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 truncate">
              Otomatis mengonversi nominal top up USD ke saldo IDR pengguna.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-36 sm:w-40">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-lime">
              Rp
            </span>
            <input
              type="number"
              min={1000}
              step={50}
              required
              value={usdRateInput}
              onChange={(e) => setUsdRateInput(e.target.value)}
              data-testid="admin-crypto-rate-input"
              placeholder="16000"
              className="w-full rounded-lg bg-void border border-lime/40 focus:border-lime outline-none pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-white tabular-nums"
            />
          </div>
          <button
            type="submit"
            disabled={savingRate}
            data-testid="admin-crypto-rate-save"
            className="inline-flex items-center gap-1.5 rounded-lg bg-lime text-void hover:bg-neon text-xs font-display font-extrabold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {savingRate ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            <span>Simpan Kurs</span>
          </button>
        </div>
      </form>

      {/* Add / Edit Modal-like Form Card */}
      {editing && (
        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-void/90 border border-neon/40 p-5 sm:p-6 space-y-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          data-testid="destination-form"
        >
          <div className="flex justify-between items-center pb-3 border-b border-line/70">
            <h4 className="text-sm font-display font-extrabold uppercase text-slate-100 flex items-center gap-2">
              {editing.type === "crypto" ? (
                <Coins size={16} className="text-lime" />
              ) : (
                <Wallet size={16} className="text-neon" />
              )}
              <span>
                {editing.id
                  ? editing.type === "crypto"
                    ? "Edit Wallet Crypto"
                    : "Edit Tujuan Pembayaran"
                  : editing.type === "crypto"
                  ? "Tambah Wallet Crypto Baru"
                  : "Tambah Tujuan Pembayaran Baru"}
              </span>
            </h4>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="w-8 h-8 rounded-lg grid place-items-center border border-line text-slate-400 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {editing.type === "crypto" && (
            <div className="rounded-xl border border-lime/25 bg-lime/[0.04] p-3.5">
              <span className="block text-[10px] uppercase tracking-wider text-lime mb-2 font-mono font-bold">
                Preset Koin &amp; Jaringan Cepat:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CRYPTO_PRESETS.map((preset) => (
                  <button
                    key={`${preset.symbol}-${preset.network}`}
                    type="button"
                    onClick={() =>
                      setEditing((prev) => ({
                        ...prev,
                        type: "crypto",
                        name: preset.name,
                        symbol: preset.symbol,
                        network: preset.network,
                      }))
                    }
                    className="rounded-lg text-[10px] font-mono px-2.5 py-1.5 border border-lime/40 bg-lime/10 text-lime hover:bg-lime hover:text-void transition-colors cursor-pointer"
                  >
                    + {preset.name} ({preset.network})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                Tipe Metode
              </label>
              <select
                data-testid="destination-type-select"
                className="w-full rounded-xl bg-panel border border-line focus:border-neon outline-none px-3.5 py-2.5 text-xs text-white font-mono transition-colors"
                value={editing.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setEditing((prev) => ({
                    ...prev,
                    type: nextType,
                    symbol: nextType === "crypto" ? prev.symbol || "USDT" : "",
                    network:
                      nextType === "crypto" ? prev.network || "TRC20 (Tron)" : "",
                  }));
                }}
              >
                <option value="bank">Transfer Bank</option>
                <option value="ewallet">E-Wallet (DANA, OVO, GoPay, dll)</option>
                <option value="qris">QRIS Statis</option>
                <option value="crypto">
                  Crypto / Web3 Wallet (USDT, BTC, SOL, dll)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                {editing.type === "crypto"
                  ? "Nama Aset / Koin (cth: USDT Tether, Solana)"
                  : "Nama Bank / E-Wallet (cth: BCA, DANA, QRIS Toko)"}
              </label>
              <input
                required
                type="text"
                data-testid="destination-name-input"
                placeholder={
                  editing.type === "crypto"
                    ? "mis. USDT (Tether)"
                    : "mis. BCA / DANA"
                }
                className="w-full rounded-xl bg-panel border border-line focus:border-neon outline-none px-3.5 py-2.5 text-xs text-white font-mono transition-colors"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>

            {editing.type === "crypto" && (
              <>
                <div>
                  <label className="block text-[11px] font-mono text-lime mb-1.5">
                    Simbol Koin (Ticker)
                  </label>
                  <input
                    type="text"
                    placeholder="mis. USDT, USDC, BTC, SOL, ETH"
                    data-testid="destination-symbol-input"
                    className="w-full rounded-xl bg-panel border border-line focus:border-lime outline-none px-3.5 py-2.5 text-xs text-lime font-mono uppercase transition-colors"
                    value={editing.symbol || ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        symbol: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-lime mb-1.5">
                    Jaringan / Network (Chain)
                  </label>
                  <input
                    type="text"
                    placeholder="mis. TRC20 (Tron), BEP20 (BSC), SPL (Solana)"
                    data-testid="destination-network-input"
                    className="w-full rounded-xl bg-panel border border-line focus:border-lime outline-none px-3.5 py-2.5 text-xs text-white font-mono transition-colors"
                    value={editing.network || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, network: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                {editing.type === "crypto"
                  ? "Label Wallet / Catatan Memo (Opsional)"
                  : "Atas Nama Rekening / Akun"}
              </label>
              <input
                type="text"
                data-testid="destination-account-name-input"
                placeholder={
                  editing.type === "crypto"
                    ? "mis. WillJustPlay Crypto Vault"
                    : "mis. Will Business"
                }
                className="w-full rounded-xl bg-panel border border-line focus:border-neon outline-none px-3.5 py-2.5 text-xs text-white font-mono transition-colors"
                value={editing.account_name || ""}
                onChange={(e) =>
                  setEditing({ ...editing, account_name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                {editing.type === "crypto"
                  ? "Alamat Wallet Crypto / Binance Pay ID *"
                  : "Nomor Rekening / No. HP"}
              </label>
              <input
                type="text"
                required={editing.type === "crypto"}
                data-testid="destination-account-number-input"
                placeholder={
                  editing.type === "crypto"
                    ? "mis. TX9wXz7Y2kLmN8pQ4rS6tV1wXyZ3aBcDeF"
                    : "mis. 1234567890"
                }
                className="w-full rounded-xl bg-panel border border-line focus:border-neon outline-none px-3.5 py-2.5 text-xs text-white font-mono transition-colors"
                value={editing.account_number || ""}
                onChange={(e) =>
                  setEditing({ ...editing, account_number: e.target.value })
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                {editing.type === "crypto"
                  ? "Gambar QR Wallet (Opsional — otomatis dibuat dari alamat wallet jika kosong)"
                  : "Gambar QR Code (Khusus QRIS / Logo Pembayaran)"}
              </label>
              <div className="flex flex-wrap gap-4 items-center">
                {editing.image && (
                  <img
                    src={imgSrc(editing.image)}
                    alt="QR"
                    className="w-20 h-20 rounded-xl object-contain border border-line bg-white p-1"
                  />
                )}
                <label className="cursor-pointer rounded-xl bg-panel border border-line hover:border-neon/60 px-4 py-2.5 text-xs font-mono text-slate-300 hover:text-neon inline-flex items-center gap-2 transition-colors">
                  {uploading ? (
                    <Loader2 size={14} className="animate-spin text-neon" />
                  ) : (
                    <ImageIcon size={14} />
                  )}
                  <span>
                    {uploading ? "Mengupload..." : "Upload Gambar QR / Logo"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={uploadImage}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="md:col-span-2 pt-1">
              <label className="inline-flex items-center gap-2.5 text-xs font-mono text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#00F0FF] rounded"
                />
                <span>Aktifkan metode ini untuk pelanggan di halaman Checkout</span>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-line/60 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl border border-line text-slate-400 hover:text-white px-4 py-2 font-display font-bold uppercase text-xs tracking-wider transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="destination-save-button"
              className="rounded-xl bg-neon text-void px-5 py-2 font-display font-extrabold uppercase text-xs tracking-wider hover:bg-lime inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save size={14} />
              <span>Simpan Metode</span>
            </button>
          </div>
        </form>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredDestinations.map((d) => {
          const isCrypto = d.type === "crypto";
          return (
            <div
              key={d.id}
              data-testid={`destination-card-${d.id}`}
              className={`rounded-2xl bg-void/70 border p-4 flex gap-3.5 items-start transition-all ${
                !d.is_active
                  ? "border-line/50 opacity-65"
                  : isCrypto
                  ? "border-lime/35 hover:border-lime/70"
                  : "border-line hover:border-neon/50"
              }`}
            >
              {d.image ? (
                <img
                  src={imgSrc(d.image)}
                  alt={d.name}
                  className="w-14 h-14 rounded-xl object-contain border border-line bg-white p-1 shrink-0"
                />
              ) : isCrypto && d.account_number ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                    d.account_number
                  )}`}
                  alt={d.name}
                  className="w-14 h-14 rounded-xl object-contain border border-line bg-white p-1 shrink-0"
                />
              ) : (
                <div
                  className={`w-14 h-14 rounded-xl grid place-items-center border shrink-0 ${
                    isCrypto
                      ? "bg-lime/10 border-lime/30 text-lime"
                      : "bg-neon/10 border-neon/30 text-neon"
                  }`}
                >
                  {d.type === "qris" ? (
                    <QrCode size={20} />
                  ) : isCrypto ? (
                    <Coins size={20} />
                  ) : (
                    <Wallet size={20} />
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display font-bold text-sm text-slate-100 truncate">
                        {d.name}
                      </h4>
                      <span
                        className={`text-[10px] font-mono ${
                          isCrypto ? "text-lime" : "text-neon"
                        }`}
                      >
                        &middot;{" "}
                        {isCrypto
                          ? `${d.symbol || "CRYPTO"}${
                              d.network ? ` (${d.network})` : ""
                            }`
                          : TYPE_LABELS[d.type] || d.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={togglingId === d.id}
                      onClick={() => toggleActive(d)}
                      title={
                        d.is_active
                          ? "Klik untuk nonaktifkan"
                          : "Klik untuk aktifkan"
                      }
                      className={`rounded-lg px-2 py-1 text-[10px] font-mono border transition-colors cursor-pointer ${
                        d.is_active
                          ? "border-lime/40 bg-lime/10 text-lime hover:bg-lime/20"
                          : "border-coral/40 bg-coral/10 text-coral hover:bg-coral/20"
                      }`}
                    >
                      {d.is_active ? "Aktif" : "Nonaktif"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(d)}
                      data-testid={`destination-edit-${d.id}`}
                      aria-label="Edit"
                      className="w-7 h-7 rounded-lg grid place-items-center border border-line bg-panel text-slate-300 hover:text-neon hover:border-neon/60 transition-colors cursor-pointer"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(d.id)}
                      data-testid={`destination-delete-${d.id}`}
                      aria-label="Hapus"
                      className="w-7 h-7 rounded-lg grid place-items-center border border-line bg-panel text-slate-400 hover:text-coral hover:border-coral/60 transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-xs font-mono">
                  {d.account_number && d.account_number !== "-" && (
                    <div className="flex items-center gap-2">
                      <p className="text-slate-200 break-all text-xs">
                        {d.account_number}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(d.account_number)
                            .then(() => toast.success("Nomor / alamat disalin"))
                        }
                        className="text-slate-500 hover:text-neon shrink-0 cursor-pointer"
                        title="Salin"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  {d.account_name && (
                    <p className="text-[11px] text-slate-400">
                      a.n. {d.account_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredDestinations.length === 0 && (
          <div className="col-span-full rounded-2xl text-center text-slate-500 py-10 font-mono text-xs border border-dashed border-line bg-void/40">
            {search.trim()
              ? "Tidak ada metode pembayaran yang cocok dengan pencarian."
              : filterMode === "crypto"
              ? "Belum ada wallet Crypto. Klik 'Tambah Wallet Crypto' untuk menambahkan."
              : "Belum ada rekening bank / E-Wallet / QRIS. Klik 'Tambah Rekening / QRIS' untuk menambahkan."}
          </div>
        )}
      </div>
    </section>
  );
}
