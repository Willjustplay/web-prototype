import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, Save, X, Image as ImageIcon, Coins, Wallet, Copy } from "lucide-react";
import { toast } from "sonner";
import { api, imgSrc } from "@/lib/api";

const CRYPTO_PRESETS = [
  { name: "USDT (Tether)", symbol: "USDT", network: "TRC20 (Tron)" },
  { name: "USDT (BNB Chain)", symbol: "USDT", network: "BEP20 (BSC)" },
  { name: "USDC (Solana)", symbol: "USDC", network: "SPL (Solana)" },
  { name: "Solana (SOL)", symbol: "SOL", network: "SPL (Solana)" },
  { name: "Bitcoin (BTC)", symbol: "BTC", network: "BTC (Native SegWit)" },
  { name: "Ethereum (ETH)", symbol: "ETH", network: "ERC20 / Arbitrum" },
  { name: "Binance Pay", symbol: "USDT", network: "Binance Pay ID" },
];

export function AdminPayment({ defaultMode = "all" }) {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filterMode, setFilterMode] = useState(defaultMode);

  useEffect(() => {
    setFilterMode(defaultMode);
  }, [defaultMode]);

  const load = async () => {
    try {
      const { data } = await api.get("/admin/payments/manual-destinations");
      setDestinations(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Gagal memuat metode pembayaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing.id) {
        await api.put(`/admin/payments/manual-destinations/${editing.id}`, editing);
        toast.success("Tujuan pembayaran diperbarui");
      } else {
        await api.post("/admin/payments/manual-destinations", editing);
        toast.success("Tujuan pembayaran ditambahkan");
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan");
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/admin/payments/manual-destinations/${id}`);
      toast.success("Terhapus");
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

  const fiatCount = destinations.filter((d) => d.type !== "crypto").length;
  const cryptoCount = destinations.filter((d) => d.type === "crypto").length;
  const filteredDestinations = destinations.filter((d) => {
    if (filterMode === "crypto") return d.type === "crypto";
    if (filterMode === "fiat") return d.type !== "crypto";
    return true;
  });

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-payment-section">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-black uppercase text-white">
            {filterMode === "crypto"
              ? "Metode Pembayaran Crypto (USDT / Web3)"
              : "Tujuan Pembayaran Manual & Crypto"}
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Kelola rekening bank, E-Wallet, QRIS, serta alamat wallet Crypto (USDT, BTC, SOL, dll) untuk checkout IDR &amp; USD.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setEditing({
                type: "bank",
                name: "",
                account_name: "",
                account_number: "",
                symbol: "",
                network: "",
                image: "",
                is_active: true,
              })
            }
            data-testid="add-destination-button"
            className="bg-neon text-void px-4 py-2.5 font-bold uppercase text-[10px] tracking-wider hover:bg-lime flex items-center gap-2 transition-colors"
          >
            <Plus size={14} /> Tambah Rekening / QRIS
          </button>
          <button
            type="button"
            onClick={() =>
              setEditing({
                type: "crypto",
                name: "USDT (Tether)",
                symbol: "USDT",
                network: "TRC20 (Tron)",
                account_name: "WillJustPlay Crypto",
                account_number: "",
                image: "",
                is_active: true,
              })
            }
            data-testid="add-crypto-destination-button"
            className="bg-lime text-void px-4 py-2.5 font-bold uppercase text-[10px] tracking-wider hover:bg-neon flex items-center gap-2 transition-colors"
          >
            <Coins size={14} /> Tambah Wallet Crypto
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border border-line bg-panel/60 p-2">
        <button
          type="button"
          onClick={() => setFilterMode("all")}
          data-testid="filter-payment-all"
          className={`text-[10px] font-mono uppercase tracking-widest px-3.5 py-2 border transition-colors ${
            filterMode === "all"
              ? "bg-neon text-void border-neon font-bold"
              : "border-line text-slate-400 hover:text-white"
          }`}
        >
          Semua Metode ({destinations.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("fiat")}
          data-testid="filter-payment-fiat"
          className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-3.5 py-2 border transition-colors ${
            filterMode === "fiat"
              ? "bg-neon text-void border-neon font-bold"
              : "border-line text-slate-400 hover:text-white"
          }`}
        >
          <Wallet size={12} /> Bank / E-Wallet / QRIS ({fiatCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("crypto")}
          data-testid="filter-payment-crypto"
          className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-3.5 py-2 border transition-colors ${
            filterMode === "crypto"
              ? "bg-lime text-void border-lime font-bold"
              : "border-line text-slate-400 hover:text-lime"
          }`}
        >
          <Coins size={12} /> Pembayaran Crypto ({cryptoCount})
        </button>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="bg-panel border border-line p-6 space-y-4"
          data-testid="destination-form"
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold uppercase text-neon flex items-center gap-2">
              {editing.type === "crypto" ? <Coins size={16} className="text-lime" /> : <Wallet size={16} />}
              <span>
                {editing.id
                  ? editing.type === "crypto"
                    ? "Edit Wallet Crypto"
                    : "Edit Tujuan Pembayaran"
                  : editing.type === "crypto"
                  ? "Tambah Wallet Crypto Baru"
                  : "Tambah Tujuan Pembayaran Baru"}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {editing.type === "crypto" && (
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-lime mb-2 font-mono">
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
                    className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1.5 border border-lime/40 bg-lime/10 text-lime hover:bg-lime hover:text-void transition-colors"
                  >
                    + {preset.name} ({preset.network})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                Tipe Metode
              </label>
              <select
                data-testid="destination-type-select"
                className="w-full bg-void border border-line px-4 py-2.5 text-sm text-white font-mono"
                value={editing.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setEditing((prev) => ({
                    ...prev,
                    type: nextType,
                    symbol: nextType === "crypto" ? prev.symbol || "USDT" : "",
                    network: nextType === "crypto" ? prev.network || "TRC20 (Tron)" : "",
                  }));
                }}
              >
                <option value="bank">Transfer Bank</option>
                <option value="ewallet">E-Wallet (Dana, Ovo, GoPay, dll)</option>
                <option value="qris">QRIS</option>
                <option value="crypto">Crypto / Web3 Wallet (USDT, BTC, SOL, dll)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                {editing.type === "crypto"
                  ? "Nama Aset / Koin (cth: USDT Tether, Bitcoin, Solana)"
                  : "Nama (cth: BCA, DANA, QRIS Toko)"}
              </label>
              <input
                required
                type="text"
                data-testid="destination-name-input"
                placeholder={editing.type === "crypto" ? "mis. USDT (Tether)" : "mis. BCA / DANA"}
                className="w-full bg-void border border-line px-4 py-2.5 text-sm text-white font-mono"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>

            {editing.type === "crypto" && (
              <>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-lime mb-2">
                    Simbol Koin (Ticker)
                  </label>
                  <input
                    type="text"
                    placeholder="mis. USDT, USDC, BTC, SOL, ETH"
                    data-testid="destination-symbol-input"
                    className="w-full bg-void border border-line px-4 py-2.5 text-sm text-lime font-mono uppercase"
                    value={editing.symbol || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, symbol: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-lime mb-2">
                    Jaringan / Network (Chain)
                  </label>
                  <input
                    type="text"
                    placeholder="mis. TRC20 (Tron), BEP20 (BSC), SPL (Solana)"
                    data-testid="destination-network-input"
                    className="w-full bg-void border border-line px-4 py-2.5 text-sm text-white font-mono"
                    value={editing.network || ""}
                    onChange={(e) => setEditing({ ...editing, network: e.target.value })}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                {editing.type === "crypto"
                  ? "Label Wallet / Catatan Memo (Opsional)"
                  : "Atas Nama (Akun / Rekening)"}
              </label>
              <input
                type="text"
                data-testid="destination-account-name-input"
                placeholder={
                  editing.type === "crypto"
                    ? "mis. WillJustPlay Crypto Vault"
                    : "mis. Will Business"
                }
                className="w-full bg-void border border-line px-4 py-2.5 text-sm text-white font-mono"
                value={editing.account_name || ""}
                onChange={(e) => setEditing({ ...editing, account_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                {editing.type === "crypto"
                  ? "Alamat Wallet Crypto / Binance Pay ID *"
                  : "Nomor Rekening / No HP"}
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
                className="w-full bg-void border border-line px-4 py-2.5 text-sm text-white font-mono"
                value={editing.account_number || ""}
                onChange={(e) => setEditing({ ...editing, account_number: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                {editing.type === "crypto"
                  ? "Gambar QR Wallet (Opsional — otomatis digenerate dari Alamat Wallet jika dikosongkan)"
                  : "Gambar / QR Code (QRIS)"}
              </label>
              <div className="flex gap-4 items-end">
                {editing.image && (
                  <img
                    src={imgSrc(editing.image)}
                    alt="QR"
                    className="w-24 h-24 object-cover border border-line bg-white p-1"
                  />
                )}
                <div className="flex-1">
                  <label className="cursor-pointer bg-void border border-line px-4 py-2.5 text-sm text-slate-300 hover:text-white flex items-center justify-center gap-2">
                    {uploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ImageIcon size={16} />
                    )}
                    {uploading ? "Mengupload..." : "Upload Gambar QR / Logo"}
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
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="bg-void border-line text-neon"
                />
                Aktif (Tampilkan ke pelanggan saat Checkout)
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="border border-line text-slate-400 hover:text-white px-5 py-2 font-bold uppercase text-[10px] tracking-wider"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="destination-save-button"
              className="bg-neon text-void px-6 py-2 font-bold uppercase text-[10px] tracking-wider hover:bg-lime flex items-center gap-2"
            >
              <Save size={14} /> Simpan
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDestinations.map((d) => {
          const isCrypto = d.type === "crypto";
          return (
            <div
              key={d.id}
              data-testid={`destination-card-${d.id}`}
              className={`bg-panel border ${
                isCrypto ? "border-lime/40" : "border-line"
              } p-4 flex gap-4 items-start relative group`}
            >
              {d.image ? (
                <img
                  src={imgSrc(d.image)}
                  alt={d.name}
                  className="w-16 h-16 object-cover border border-line bg-white p-1 shrink-0"
                />
              ) : isCrypto && d.account_number ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                    d.account_number
                  )}`}
                  alt={d.name}
                  className="w-16 h-16 object-contain border border-line bg-white p-1 shrink-0"
                />
              ) : null}

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-white">{d.name}</h4>
                    {isCrypto && d.symbol && (
                      <span className="text-[9px] font-mono font-bold bg-lime text-void px-1.5 py-0.5 uppercase tracking-wider">
                        {d.symbol}
                      </span>
                    )}
                    {!d.is_active && (
                      <span className="text-[9px] bg-coral/20 text-coral px-1.5 py-0.5 uppercase tracking-wider">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditing(d)}
                      data-testid={`destination-edit-${d.id}`}
                      aria-label="Edit"
                      className="text-slate-400 hover:text-neon p-1"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(d.id)}
                      data-testid={`destination-delete-${d.id}`}
                      aria-label="Hapus"
                      className="text-slate-400 hover:text-coral p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      isCrypto ? "text-lime" : "text-slate-400"
                    }`}
                  >
                    {isCrypto ? `CRYPTO${d.network ? ` • ${d.network}` : ""}` : d.type}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-300 space-y-1">
                  {d.account_number && d.account_number !== "-" && (
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-slate-200 break-all">{d.account_number}</p>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(d.account_number)
                            .then(() => toast.success("Disalin ke clipboard"))
                        }
                        className="text-slate-500 hover:text-neon shrink-0"
                        title="Salin"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  {d.account_name && <p className="text-slate-400">{d.account_name}</p>}
                </div>
              </div>
            </div>
          );
        })}

        {filteredDestinations.length === 0 && (
          <div className="col-span-2 text-center text-slate-500 py-10 font-mono text-sm border border-dashed border-line">
            Belum ada tujuan pembayaran pada kategori ini.
          </div>
        )}
      </div>
    </div>
  );
}

