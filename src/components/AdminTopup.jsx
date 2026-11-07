import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, X, Loader2, Gamepad2, RefreshCw, Zap, Save,
  ArrowUp, ArrowDown, Plug, FlaskConical, Wallet, Download, CheckCircle2, AlertCircle, Search,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatIDR, formatApiError, imgSrc } from "@/lib/api";

const inputCls =
  "mt-1.5 w-full bg-void border border-line focus:border-neon/60 outline-none text-xs font-mono px-3 py-2.5 placeholder:text-slate-600 transition-colors";
const labelCls = "block text-[10px] uppercase tracking-[0.2em] text-slate-500";

const EMPTY_FIELD = {
  key: "", label: "", placeholder: "", type: "text", inputmode: "numeric",
  required: true, min_len: 0, max_len: 0, pattern: "", help: "",
};
const EMPTY_DENOM = {
  code: "", label: "", amount: 0, modal_price: 0, price: 0, price_strike: 0,
  stock: 100, badge: "", is_active: true, featured: false, vendor_sku: "",
};
const EMPTY_GAME = {
  name: "", slug: "", publisher: "", icon: "", banner: "", currency: "Diamond",
  notes: "", delivery_info: "", is_active: true, featured: false, seq: 0,
  vendor_prefix: "", cek_id_sku: "", vendor_id: "vp-digiflazz",
  fields: [{ ...EMPTY_FIELD, key: "user_id", label: "User ID" }],
  denominations: [],
};

const slugify = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const keyify = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

const statusStyle = (o) => {
  if (o.payment_status === "paid") return "text-lime border-lime/40 bg-lime/10";
  if (o.payment_status === "failed") return "text-coral border-coral/40 bg-coral/10";
  return "text-neon border-neon/40 bg-neon/10";
};
const statusLabel = (o) => {
  if (o.status === "delivered") return "Terkirim";
  if (o.payment_status === "paid") return "Lunas";
  if (o.payment_status === "failed") return o.status === "rejected" ? "Ditolak" : "Gagal";
  if (o.status === "waiting_approval") return "Perlu Verifikasi";
  return o.provider === "manual" ? "Belum Bayar" : "Menunggu QRIS";
};

export const AdminTopup = ({ headers, sections, defaultSection, onReload }) => {
  const allowedSections = useMemo(
    () => (sections?.length ? sections : ["games", "orders", "vendors"]),
    [sections]
  );
  const [subTab, setSubTab] = useState(defaultSection || allowedSections[0]);
  const [games, setGames] = useState([]);
  const [gameSearch, setGameSearch] = useState("");
  const [gameStatusFilter, setGameStatusFilter] = useState("all");
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [activeVendor, setActiveVendor] = useState("digiflazz");
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [vendorForm, setVendorForm] = useState(null);
  const [importTarget, setImportTarget] = useState(null);
  const [proofUrl, setProofUrl] = useState(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const [integration, setIntegration] = useState(null);
  const [busy, setBusy] = useState("");
  const [pullVendorKind, setPullVendorKind] = useState("digiflazz");
  const [pullMargin, setPullMargin] = useState(10);
  const [pullCatalogOpen, setPullCatalogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, o, v, c, i] = await Promise.allSettled([
        api.get("/admin/games", { headers }),
        api.get("/admin/topup/orders", { headers }),
        api.get("/admin/topup/vendors", { headers }),
        api.get("/admin/topup/vendors/catalog", { headers }),
        api.get("/admin/topup/integration", { headers }),
      ]);
      if (g.status === "fulfilled") setGames(Array.isArray(g.value.data) ? g.value.data : []);
      if (o.status === "fulfilled") setOrders(Array.isArray(o.value.data) ? o.value.data : []);
      if (v.status === "fulfilled") {
        setVendors(Array.isArray(v.value.data?.vendors) ? v.value.data.vendors : []);
        setActiveVendor(v.value.data?.active_kind || "digiflazz");
      }
      if (c.status === "fulfilled") setCatalog(Array.isArray(c.value.data) ? c.value.data : []);
      if (i.status === "fulfilled") setIntegration(i.value.data || null);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal memuat data top up");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => ({
    total: orders.length,
    unpaid: orders.filter((o) => o.payment_status !== "paid").length,
    waiting: orders.filter((o) => o.status === "waiting_approval").length,
    paid: orders.filter((o) => o.payment_status === "paid").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  }), [orders]);

  const visibleOrders = useMemo(() => {
    if (orderFilter === "all") return orders;
    if (orderFilter === "unpaid") return orders.filter((o) => o.payment_status !== "paid");
    if (orderFilter === "paid") return orders.filter((o) => o.payment_status === "paid");
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  const filteredGames = useMemo(() => {
    const q = gameSearch.trim().toLowerCase();
    return games.filter((g) => {
      if (gameStatusFilter === "active" && !g.is_active) return false;
      if (gameStatusFilter === "inactive" && g.is_active) return false;
      if (!q) return true;
      return (
        String(g.name || "").toLowerCase().includes(q) ||
        String(g.slug || "").toLowerCase().includes(q) ||
        String(g.publisher || "").toLowerCase().includes(q)
      );
    });
  }, [games, gameSearch, gameStatusFilter]);

  // ------------------------------------------------------------- game editor
  const openNew = () => setForm({ ...EMPTY_GAME, fields: [{ ...EMPTY_FIELD, key: "user_id", label: "User ID" }], denominations: [] });

  const openEdit = (g) => setForm({
    ...EMPTY_GAME,
    ...g,
    fields: (g.fields || []).map((f) => ({ ...EMPTY_FIELD, ...f })),
    denominations: (g.denominations || []).map((d) => ({
      ...EMPTY_DENOM, vendor_sku: d.vendor_sku || "", price_strike: d.price_strike || 0, ...d,
    })),
  });

  const patch = (changes) => setForm((f) => ({ ...f, ...changes }));
  const patchField = (i, changes) => setForm((f) => ({
    ...f, fields: f.fields.map((x, n) => (n === i ? { ...x, ...changes } : x)),
  }));
  const patchDenom = (i, changes) => setForm((f) => ({
    ...f, denominations: f.denominations.map((x, n) => (n === i ? { ...x, ...changes } : x)),
  }));

  const moveDenom = (i, dir) => setForm((f) => {
    const next = [...f.denominations];
    const j = i + dir;
    if (j < 0 || j >= next.length) return f;
    [next[i], next[j]] = [next[j], next[i]];
    return { ...f, denominations: next.map((d, n) => ({ ...d, seq: n })) };
  });

  const formErrors = useMemo(() => {
    if (!form) return {};
    const errs = {};
    if (!form.name.trim()) errs.name = "Nama game wajib diisi";
    if (!slugify(form.slug || form.name)) errs.slug = "Slug tidak valid";
    if (!form.fields.length) errs.fields = "Minimal satu field tujuan";
    form.fields.forEach((f, i) => {
      if (!keyify(f.key)) errs[`field-${i}`] = "Key field wajib (huruf/angka/underscore)";
      if (f.pattern) {
        try { new RegExp(f.pattern); } catch { errs[`field-${i}`] = "Pattern regex tidak valid"; }
      }
    });
    const seen = new Set();
    form.denominations.forEach((d, i) => {
      const code = String(d.code).trim();
      if (!code) errs[`denom-${i}`] = "Kode nominal wajib diisi";
      else if (seen.has(code)) errs[`denom-${i}`] = `Kode ${code} duplikat`;
      seen.add(code);
      if (Number(d.price) <= 0) errs[`denom-${i}`] = errs[`denom-${i}`] || "Harga harus lebih dari 0";
    });
    return errs;
  }, [form]);

  const saveGame = async () => {
    if (Object.keys(formErrors).length) {
      toast.error(Object.values(formErrors)[0]);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: slugify(form.slug || form.name),
        seq: Number(form.seq) || 0,
        fields: form.fields.map((f, i) => ({
          ...f,
          key: keyify(f.key),
          required: !!f.required,
          min_len: Number(f.min_len) || 0,
          max_len: Number(f.max_len) || 0,
        })),
        denominations: form.denominations.map((d, i) => ({
          ...d,
          code: String(d.code).trim(),
          label: d.label.trim() || String(d.code).trim(),
          amount: Number(d.amount) || 0,
          modal_price: Number(d.modal_price) || 0,
          price: Number(d.price) || 0,
          price_strike: Number(d.price_strike) || 0,
          stock: Number(d.stock) || 0,
          seq: i,
          is_active: !!d.is_active,
        })),
      };
      if (form.id) await api.put(`/admin/games/${form.id}`, payload, { headers });
      else await api.post("/admin/games", payload, { headers });
      toast.success(form.id ? "Game diperbarui & produk disinkronkan" : "Game ditambahkan & produk dibuat");
      setForm(null);
      load();
      onReload?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menyimpan game");
    } finally {
      setSaving(false);
    }
  };

  const toggleGameActive = async (g) => {
    const nextActive = !g.is_active;
    setBusy(`toggle-${g.id}`);
    try {
      await api.post(`/admin/games/${g.id}/toggle-active`, { is_active: nextActive }, { headers });
      toast.success(
        nextActive
          ? `${g.name} diaktifkan dan ditampilkan kembali di halaman publik Top Up`
          : `${g.name} dinonaktifkan dan disembunyikan dari halaman publik Top Up`
      );
      load();
      onReload?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mengubah status game");
    } finally {
      setBusy("");
    }
  };

  const syncAll = async () => {
    setBusy("sync");
    try {
      const { data } = await api.post("/admin/games/sync", {}, { headers });
      toast.success(`${data.products} produk top up disinkronkan`);
      load();
      onReload?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal sinkronisasi");
    } finally {
      setBusy("");
    }
  };

  const pullDirectFromMerchant = async (opts = {}) => {
    const vKind = opts.vendor_kind || pullVendorKind || "digiflazz";
    const marginVal = opts.margin_percent !== undefined ? Number(opts.margin_percent) : Number(pullMargin ?? 10);
    setBusy(`pull-${vKind}`);
    try {
      const { data } = await api.post(
        "/admin/topup/pull-merchant",
        {
          vendor_kind: vKind,
          provider_id: opts.provider_id,
          game_slugs: opts.game_slugs,
          selected_skus_by_game: opts.selected_skus_by_game,
          margin_percent: marginVal,
          use_recommended_price: marginVal <= 0,
          auto_activate_vendor: true,
          force_refresh: Boolean(opts.force_refresh),
        },
        { headers }
      );
      toast.success(
        data.message ||
          `Berhasil menarik ${data.denominations_pulled} produk dari ${data.vendor_name} ke ${data.games_updated} game lokal!`
      );
      setPullCatalogOpen(false);
      load();
      onReload?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menarik produk dari Digiflazz");
    } finally {
      setBusy("");
    }
  };

  const clearProductsAndSkus = async (gameSlug = "") => {
    setBusy(gameSlug ? `clear-${gameSlug}` : "clear-all");
    try {
      const payload = gameSlug ? { game_slugs: [gameSlug] } : {};
      const { data } = await api.post("/admin/topup/clear-products", payload, { headers });
      toast.success(
        data.message ||
          `Berhasil mengosongkan ${data.denominations_removed ?? 0} nominal & SKU dan menghapus ${data.products_removed ?? 0} produk top up.`
      );
      load();
      onReload?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mengosongkan produk & SKU");
    } finally {
      setBusy("");
    }
  };

  // ------------------------------------------------------------ order actions
  const orderAction = async (o, action, body = {}) => {
    setBusy(o.session_id);
    try {
      if (action === "approve") await api.post(`/admin/orders/${o.session_id}/approve`, {}, { headers });
      if (action === "reject") {
        await api.post(`/admin/orders/${o.session_id}/reject`, {}, { headers });
      }
      if (action === "sync") {
        const { data } = await api.post(`/admin/orders/${o.session_id}/sync`, {}, { headers });
        toast.success(`Status PayKita: ${data.paykita_status || data.payment_status}`);
      }
      if (action === "complete") {
        const { data } = await api.post(`/admin/topup/orders/${o.session_id}/complete`, body, { headers });
        toast.success(data.dispatched ? "Pesanan dikirim ke supplier" : "Pesanan ditandai terkirim");
      }
      if (action !== "sync") load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Aksi gagal");
    } finally {
      setBusy("");
    }
  };

  const viewProof = async (o) => {
    try {
      const { data } = await api.get(`/admin/orders/${o.session_id}/proof`, { headers });
      setProofUrl(data.payment_proof);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Bukti pembayaran belum ada");
    }
  };

  // ----------------------------------------------------------- vendor actions
  const vendorSpec = (kind) => catalog.find((c) => c.kind === kind);
  // The supplier actually in use, as resolved by the backend.
  const isActiveVendor = (v) =>
    v.is_active && (integration?.active_id ? v.id === integration.active_id : v.kind === activeVendor);
  const openVendor = (v) => {
    const spec = vendorSpec(v?.kind || "digiflazz") || { fields: [] };
    const config = { ...(v?.config || {}) };
    (spec.fields || []).forEach((f) => { config[f.key] = config[f.key] ?? ""; });
    setVendorForm({
      id: v?.id, kind: v?.kind || "digiflazz", name: v?.name || "",
      is_active: v?.is_active ?? false, auto_dispatch: v?.auto_dispatch ?? false,
      seq: v?.seq ?? 0, config,
      // Where each effective value comes from (.env vs database), for the badges.
      sources: v?.config_sources || {},
    });
  };

  const saveVendor = async () => {
    if (!vendorForm) return;
    setSaving(true);
    try {
      const payload = {
        kind: vendorForm.kind, name: vendorForm.name, config: vendorForm.config,
        is_active: vendorForm.is_active, auto_dispatch: vendorForm.auto_dispatch,
        seq: Number(vendorForm.seq) || 0,
      };
      if (vendorForm.id) await api.put(`/admin/topup/vendors/${vendorForm.id}`, payload, { headers });
      else await api.post("/admin/topup/vendors", payload, { headers });
      toast.success("Supplier disimpan");
      setVendorForm(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menyimpan supplier");
    } finally {
      setSaving(false);
    }
  };

  const vendorOp = async (v, op) => {
    const target = v?.id ? v : vendors.find((x) => isActiveVendor(x)) || vendors.find((x) => x.kind !== "manual") || vendors[0];
    if (!target?.id) {
      toast.error("Pilih supplier terlebih dahulu");
      return;
    }
    setBusy(target.id);
    try {
      if (op === "activate") { await api.post(`/admin/topup/vendors/${target.id}/activate`, {}, { headers }); toast.success(`${target.name} diaktifkan`); }
      if (op === "deactivate") { await api.post(`/admin/topup/vendors/${target.id}/deactivate`, {}, { headers }); toast.success(`${target.name} dinonaktifkan`); }
      if (op === "delete") {
        await api.delete(`/admin/topup/vendors/${target.id}`, { headers });
        toast.success("Supplier dihapus");
      }
      if (op === "test") {
        const { data } = await api.post(`/admin/topup/vendors/${target.id}/test`, {}, { headers });
        data.ok ? toast.success(data.message) : toast.error(data.message);
      }
      if (op === "balance") {
        const { data } = await api.get(`/admin/topup/vendors/${target.id}/balance`, { headers });
        const balStr = data.balance_formatted || formatIDR(Number(data.balance) || 0);
        data.ok ? toast.success(`Saldo ${target.name}: ${balStr}`) : toast.error(data.message || "Gagal cek saldo");
      }
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Aksi supplier gagal");
    } finally {
      setBusy("");
    }
  };

  const TABS = useMemo(
    () => [
      { id: "games", label: "Game & Nominal", icon: Gamepad2 },
      { id: "orders", label: `Pesanan Top Up (${orders.length})`, icon: Zap },
      { id: "vendors", label: "Integrasi & Supplier", icon: Plug },
    ].filter((t) => allowedSections.includes(t.id)),
    [orders.length, allowedSections]
  );

  // A single section needs no switcher, so the row collapses to just the actions.
  const showSubTabs = TABS.length > 1;

  return (
    <div data-testid="admin-topup">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2" data-testid="admin-topup-subtabs">
          {showSubTabs &&
            TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                data-testid={`admin-topup-tab-${t.id}`}
                className={`flex items-center gap-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider px-3.5 py-2 border transition-colors cursor-pointer ${
                  subTab === t.id ? "bg-neon text-void border-neon" : "border-line bg-void/60 text-slate-400 hover:text-neon"
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            data-testid="admin-topup-reload"
            className="flex items-center gap-2 rounded-xl text-[11px] font-mono border border-line bg-void/60 text-slate-300 hover:text-neon hover:border-neon/50 px-3.5 py-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-neon" : ""} /> Muat Ulang
          </button>
          {subTab === "games" && (
            <>
              <button
                onClick={() => pullDirectFromMerchant({ vendor_kind: "digiflazz", margin_percent: pullMargin })}
                disabled={busy.startsWith("pull-")}
                data-testid="admin-topup-quick-pull"
                className="flex items-center gap-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider bg-lime text-void hover:bg-neon px-3.5 py-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {busy.startsWith("pull-") ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Tarik Produk Digiflazz
              </button>
              <button
                onClick={syncAll}
                disabled={busy === "sync"}
                data-testid="admin-topup-sync"
                className="flex items-center gap-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider border border-neon/50 text-neon hover:bg-neon/10 px-3.5 py-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} className={busy === "sync" ? "animate-spin" : ""} /> Sinkronkan SKU
              </button>
              <button
                onClick={() => clearProductsAndSkus()}
                disabled={busy === "clear-all"}
                data-testid="admin-topup-clear-all"
                title="Hapus semua produk topup bawaan dan kosongkan semua nominal & SKU pada 10 game lokal"
                className="flex items-center gap-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider border border-coral/50 text-coral hover:bg-coral/10 px-3.5 py-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {busy === "clear-all" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Kosongkan Produk &amp; SKU
              </button>
              <button
                onClick={openNew}
                data-testid="admin-topup-add-game"
                className="flex items-center gap-2 rounded-xl text-[11px] font-display font-extrabold uppercase tracking-wider bg-gradient-to-r from-neon to-cyan-300 text-void hover:from-lime hover:to-neon px-4 py-2 shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all cursor-pointer"
              >
                <Plus size={13} /> Game Top Up Baru
              </button>
            </>
          )}
          {subTab === "vendors" && (
            <>
              <button
                onClick={() => setPullCatalogOpen(true)}
                data-testid="admin-topup-open-merchant-catalog"
                className="flex items-center gap-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider bg-lime text-void hover:bg-neon px-3.5 py-2 transition-colors cursor-pointer"
              >
                <Download size={13} /> Tarik Katalog Digiflazz
              </button>
              <button
                onClick={() => openVendor(vendors[0] || null)}
                data-testid="admin-topup-add-vendor"
                className="flex items-center gap-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider bg-neon text-void hover:bg-lime px-4 py-2 transition-colors cursor-pointer"
              >
                <Plug size={13} /> Konfigurasi Digiflazz
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 py-10" data-testid="admin-topup-loading">
          <Loader2 size={14} className="animate-spin" /> Memuat data top up...
        </div>
      )}

      {/* ------------------------------------------------ games & denominations */}
      {!loading && subTab === "games" && (
        <div className="space-y-4">
          {/* Product-Only Digiflazz Pull Banner */}
          <div
            data-testid="admin-topup-merchant-pull-bar"
            className="rounded-xl border border-neon/40 bg-gradient-to-r from-neon/10 via-void/80 to-lime/5 p-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-lime">
                    <Zap size={11} /> Sinkronisasi Produk Digiflazz
                  </span>
                  <span className="text-slate-600">&middot;</span>
                  <h3 className="font-display font-bold text-sm text-slate-100">
                    Tarik Produk &amp; Harga Digiflazz ke Game Top Up Lokal
                  </h3>
                </div>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Daftar Game Top Up dikelola secara lokal dengan ikon 3D eksklusif. Tarik otomatis hanya{" "}
                  <span className="text-neon font-bold">produk (SKU/nominal)</span> dari Digiflazz ke game lokal yang ada dengan perhitungan{" "}
                  <span className="text-lime font-bold">Harga Modal + Margin (%)</span> otomatis.
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-end gap-2.5 shrink-0">
                <div className="w-full sm:w-40">
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                    Supplier Produk
                  </label>
                  <select
                    value="digiflazz"
                    onChange={() => setPullVendorKind("digiflazz")}
                    data-testid="merchant-pull-select-vendor"
                    className="w-full rounded-lg bg-void border border-line focus:border-neon text-xs font-mono text-neon font-bold px-2.5 py-2 outline-none"
                  >
                    <option value="digiflazz">Digiflazz H2H</option>
                  </select>
                </div>

                <div className="w-full sm:w-48">
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                    Harga Jual (Modal + Margin %)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={[0, 5, 8, 10, 15, 20].includes(Number(pullMargin)) ? pullMargin : "custom"}
                      onChange={(e) => {
                        if (e.target.value !== "custom") setPullMargin(Number(e.target.value));
                      }}
                      data-testid="merchant-pull-select-margin"
                      className="w-full rounded-lg bg-void border border-line focus:border-neon text-xs font-mono text-slate-100 px-2.5 py-2 outline-none"
                    >
                      <option value={5}>Modal + 5%</option>
                      <option value={8}>Modal + 8%</option>
                      <option value={10}>Modal + 10% (Default)</option>
                      <option value={15}>Modal + 15%</option>
                      <option value={20}>Modal + 20%</option>
                      <option value={0}>Harga Rekomendasi</option>
                      <option value="custom">Custom %</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={pullMargin}
                      onChange={(e) => setPullMargin(Math.max(0, Number(e.target.value) || 0))}
                      title="Margin % dari harga modal Digiflazz"
                      className="w-16 rounded-lg bg-void border border-line focus:border-neon text-xs font-mono text-neon text-center px-2 py-2 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => pullDirectFromMerchant({ vendor_kind: "digiflazz", margin_percent: pullMargin })}
                  disabled={busy.startsWith("pull-")}
                  data-testid="merchant-pull-all-btn"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-neon text-void hover:bg-lime font-display font-bold text-[11px] uppercase tracking-wider px-4 py-2.5 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {busy.startsWith("pull-") ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Zap size={13} />
                  )}
                  Tarik Produk Otomatis
                </button>

                <button
                  type="button"
                  onClick={() => setPullCatalogOpen(true)}
                  data-testid="merchant-pull-choose-btn"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neon/50 text-neon hover:bg-neon/10 font-mono font-bold text-[11px] uppercase tracking-wider px-3.5 py-2.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download size={13} /> Pilih Produk per Game
                </button>
              </div>
            </div>
          </div>

          {/* Search & Status Filter for Top Up Games */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: `Semua Game (${games.length})` },
                { id: "active", label: `Aktif (${games.filter((g) => g.is_active).length})` },
                { id: "inactive", label: `Nonaktif (${games.filter((g) => !g.is_active).length})` },
              ].map((st) => {
                const active = gameStatusFilter === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setGameStatusFilter(st.id)}
                    className={`rounded-lg text-[11px] font-mono px-3 py-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? "bg-neon text-void border-neon font-bold"
                        : "border-line bg-void/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-72">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                placeholder="Cari game atau publisher top up..."
                className="w-full rounded-xl bg-void border border-line pl-9 pr-8 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-neon transition-colors"
              />
              {gameSearch && (
                <button
                  type="button"
                  onClick={() => setGameSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-void/40 overflow-x-auto" data-testid="admin-topup-games-table">
          {filteredGames.length === 0 ? (
            <p className="text-center text-xs text-slate-500 font-mono py-14">Belum ada game top up yang sesuai filter.</p>
          ) : (
            <table className="w-full text-left text-xs font-mono min-w-[860px]">
              <thead>
                <tr className="border-b border-line bg-void/70 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5">Game Top Up</th>
                  <th className="px-4 py-3.5">Publisher</th>
                  <th className="px-4 py-3.5">Field Tujuan</th>
                  <th className="px-4 py-3.5">Nominal</th>
                  <th className="px-4 py-3.5">Produk SKU</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredGames.map((g) => (
                  <tr key={g.id} data-testid={`admin-topup-game-row-${g.slug}`} className="hover:bg-void/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {g.icon || g.banner ? (
                          <img
                            src={imgSrc(g.icon || g.banner)}
                            alt={g.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-xl object-cover border border-neon/30 bg-void shadow-[0_0_12px_rgba(0,240,255,0.12)]"
                          />
                        ) : (
                          <span className="w-11 h-11 rounded-xl grid place-items-center border border-line text-slate-500 bg-void"><Gamepad2 size={14} /></span>
                        )}
                        <div>
                          <a
                            href={`/topup/${g.slug}`}
                            className="font-display text-slate-100 hover:text-neon font-bold transition-colors"
                          >
                            {g.name}
                          </a>
                          <p className="text-[10px] text-slate-500">/topup/{g.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">{g.publisher || "-"}</td>
                    <td className="px-4 py-3.5 text-slate-400">{(g.fields || []).map((f) => f.label || f.key).join(" · ") || "-"}</td>
                    <td className="px-4 py-3.5 text-slate-200 font-semibold tabular-nums">{(g.denominations || []).length} paket</td>
                    <td className="px-4 py-3.5 tabular-nums">
                      <span className={g.products_synced ? "text-lime font-bold" : "text-coral font-bold"}>{g.product_count ?? 0}</span>
                      <span className="text-slate-600">/{g.denominations?.length ?? 0}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        data-testid={`admin-topup-game-status-${g.slug}`}
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          g.is_active ? "text-lime" : "text-slate-500"
                        }`}
                      >
                        {g.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setImportTarget(g)}
                          data-testid={`admin-topup-import-${g.slug}`}
                          aria-label="Impor SKU supplier"
                          title="Impor SKU supplier"
                          className="grid place-items-center w-8 h-8 rounded-lg border border-line bg-void/70 text-slate-400 hover:text-neon hover:border-neon/50 transition-colors cursor-pointer"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={() => openEdit(g)}
                          data-testid={`admin-topup-edit-${g.slug}`}
                          aria-label="Edit game"
                          className="grid place-items-center w-8 h-8 rounded-lg border border-line bg-void/70 text-slate-400 hover:text-neon hover:border-neon/50 transition-colors cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleGameActive(g)}
                          disabled={busy === `toggle-${g.id}`}
                          data-testid={`admin-topup-toggle-${g.slug}`}
                          aria-label={g.is_active ? `Nonaktifkan ${g.name}` : `Aktifkan ${g.name}`}
                          title={
                            g.is_active
                              ? "Status Aktif — Klik untuk menonaktifkan dan menyembunyikan dari publik"
                              : "Status Nonaktif — Klik untuk mengaktifkan kembali di publik"
                          }
                          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[10px] font-display font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 ${
                            g.is_active
                              ? "border-lime/50 bg-lime/10 text-lime hover:bg-coral/15 hover:border-coral/50 hover:text-coral"
                              : "border-line bg-void/70 text-slate-400 hover:border-lime/50 hover:bg-lime/10 hover:text-lime"
                          }`}
                        >
                          {busy === `toggle-${g.id}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                g.is_active ? "bg-lime shadow-[0_0_6px_rgba(163,255,18,0.8)]" : "bg-slate-500"
                              }`}
                            />
                          )}
                          <span>{g.is_active ? "Aktif" : "Nonaktif"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- topup orders */}
      {!loading && subTab === "orders" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5" data-testid="admin-topup-order-summary">
            {[
              { k: "total", l: "Total", v: totals.total },
              { k: "unpaid", l: "Belum Bayar", v: totals.unpaid },
              { k: "waiting_approval", l: "Perlu Verifikasi", v: totals.waiting },
              { k: "paid", l: "Lunas", v: totals.paid },
              { k: "delivered", l: "Terkirim", v: totals.delivered },
            ].map((s) => (
              <button
                key={s.k}
                onClick={() => setOrderFilter(s.k)}
                data-testid={`admin-topup-filter-${s.k}`}
                className={`text-left border px-3 py-2.5 transition-colors ${
                  orderFilter === s.k ? "border-neon bg-neon/5" : "border-line bg-panel hover:border-neon/50"
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{s.l}</p>
                <p className="font-display font-bold text-lg text-neon">{s.v}</p>
              </button>
            ))}
          </div>

          <div className="border border-line bg-panel overflow-x-auto" data-testid="admin-topup-orders-table">
            {visibleOrders.length === 0 ? (
              <p className="text-center text-xs text-slate-500 font-mono py-16">Tidak ada pesanan top up.</p>
            ) : (
              <table className="w-full text-left text-xs font-mono min-w-[980px]">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3">Pesanan</th>
                    <th className="px-4 py-3">Game / Nominal</th>
                    <th className="px-4 py-3">Tujuan</th>
                    <th className="px-4 py-3">Pembeli</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((o) => (
                    <tr key={o.session_id} data-testid={`admin-topup-order-${o.session_id}`} className="border-b border-line/60 hover:bg-panelhover transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-slate-300">{o.session_id}</p>
                        <p className="text-[10px] text-slate-600">{o.created_at ? new Date(o.created_at).toLocaleString("id-ID") : "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-100 font-bold">{o.game_name || "-"}</p>
                        <p className="text-[10px] text-slate-500">{o.denomination_label || o.denomination_code}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 break-all max-w-[220px]">
                        <p>{Object.entries(o.destination || {}).map(([k, v]) => `${k}: ${v}`).join(" • ") || "-"}</p>
                        {o.verified_nickname && (
                          <p className="text-[10px] text-lime font-bold mt-0.5">
                            ✓ Nickname: {o.verified_nickname}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {o.buyer_email || o.buyer_whatsapp || "-"}
                      </td>
                      <td className="px-4 py-3 text-neon font-bold">{formatIDR(o.amount)}</td>
                      <td className="px-4 py-3">
                        <span data-testid={`admin-topup-order-status-${o.session_id}`} className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 border ${statusStyle(o)}`}>
                          {statusLabel(o)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {o.has_proof && (
                            <button
                              onClick={() => viewProof(o)}
                              data-testid={`admin-topup-proof-${o.session_id}`}
                              className="text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2 py-1.5 transition-colors"
                            >
                              Bukti
                            </button>
                          )}
                          {o.payment_status === "paid" && o.status !== "delivered" && (
                            <button
                              onClick={() => orderAction(o, "complete", { note: "Pesanan telah dikirim dan diproses", dispatch: true })}
                              disabled={busy === o.session_id}
                              data-testid={`admin-topup-complete-${o.session_id}`}
                              className="text-[10px] uppercase tracking-widest bg-lime text-void hover:bg-neon px-2 py-1.5 transition-colors disabled:opacity-50"
                            >
                              Tandai Terkirim
                            </button>
                          )}
                          {o.payment_status === "paid" && o.status === "delivered" && (
                            <span className="text-[10px] text-lime uppercase tracking-widest inline-flex items-center gap-1">
                              <CheckCircle2 size={11} /> {o.vendor_kind || "manual"}
                            </span>
                          )}
                          {o.payment_status !== "paid" && o.status !== "rejected" && (
                            <>
                              <button
                                onClick={() => orderAction(o, "approve")}
                                disabled={busy === o.session_id}
                                data-testid={`admin-topup-approve-${o.session_id}`}
                                className="text-[10px] uppercase tracking-widest bg-neon text-void hover:bg-lime px-2 py-1.5 transition-colors disabled:opacity-50"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => orderAction(o, "reject")}
                                disabled={busy === o.session_id}
                                data-testid={`admin-topup-reject-${o.session_id}`}
                                className="text-[10px] uppercase tracking-widest border border-coral/50 text-coral hover:bg-coral/10 px-2 py-1.5 transition-colors disabled:opacity-50"
                              >
                                Tolak
                              </button>
                            </>
                          )}
                          {o.provider === "paykita" && o.payment_status === "pending" && (
                            <button
                              onClick={() => orderAction(o, "sync")}
                              disabled={busy === o.session_id}
                              data-testid={`admin-topup-sync-${o.session_id}`}
                              className="text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2 py-1.5 transition-colors disabled:opacity-50"
                            >
                              Cek
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------ vendors */}
      {!loading && subTab === "vendors" && (
        <div className="space-y-4" data-testid="admin-topup-vendors">
          <IntegrationSummary
            integration={integration}
            headers={headers}
            onCheckBalance={() => vendorOp(
              vendors.find((v) => isActiveVendor(v)) || vendors.find((v) => v.kind === activeVendor) || vendors[0] || {}, "balance"
            )}
            onImport={(slug) => {
              const game = games.find((g) => g.slug === slug);
              if (game) setImportTarget(game);
              else toast.error("Buka tab Game & Nominal untuk mengimpor SKU game ini");
            }}
            busy={busy}
          />
          {vendors.length === 0 ? (
            <p className="text-center text-xs text-slate-500 font-mono py-16 border border-line bg-panel">Belum ada supplier.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {vendors.map((v) => (
                <div
                  key={v.id}
                  data-testid={`admin-topup-vendor-${v.kind}`}
                  className={`border bg-panel p-4 ${isActiveVendor(v) ? "border-lime/60" : "border-line"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-bold text-sm flex items-center gap-2">
                        <Plug size={14} className="text-neon" /> {v.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">{v.kind_label} • {v.kind}</p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-1 border ${
                      isActiveVendor(v)
                        ? "text-lime border-lime/40 bg-lime/10"
                        : v.is_active
                          ? "text-slate-400 border-line"
                          : "text-slate-500 border-line"
                    }`}>
                      {isActiveVendor(v) ? "Aktif (dipakai)" : v.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-[10px] font-mono text-slate-500">
                    <p>Auto-kirim: <span className={v.auto_dispatch ? "text-lime" : "text-slate-400"}>{v.auto_dispatch ? "aktif" : "nonaktif"}</span></p>
                    <p>Urutan: {v.seq}</p>
                    {v.last_test && (
                      <p className={v.last_test.ok ? "text-lime" : "text-coral"}>
                        Tes terakhir: {v.last_test.ok ? "OK" : "gagal"} — {v.last_test.message}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {v.kind !== "manual" && (
                      <button
                        onClick={() => pullDirectFromMerchant({ vendor_kind: v.kind, provider_id: v.id })}
                        disabled={busy === `pull-${v.kind}` || busy === v.id}
                        data-testid={`admin-topup-vendor-pull-${v.kind}`}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-neon text-void hover:bg-lime px-2.5 py-1.5 transition-colors disabled:opacity-50"
                      >
                        {busy === `pull-${v.kind}` ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} Tarik Produk
                      </button>
                    )}
                    <button onClick={() => openVendor(v)} data-testid={`admin-topup-vendor-edit-${v.kind}`} className="text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2 py-1.5 transition-colors">Edit</button>
                    <button onClick={() => vendorOp(v, v.is_active ? "deactivate" : "activate")} disabled={busy === v.id} className="text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2 py-1.5 transition-colors disabled:opacity-50">
                      {v.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button onClick={() => vendorOp(v, "test")} disabled={busy === v.id} data-testid={`admin-topup-vendor-test-${v.kind}`} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2 py-1.5 transition-colors disabled:opacity-50">
                      <FlaskConical size={11} /> Tes
                    </button>
                    <button onClick={() => vendorOp(v, "balance")} disabled={busy === v.id} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2 py-1.5 transition-colors disabled:opacity-50">
                      <Wallet size={11} /> Saldo
                    </button>
                    <button onClick={() => vendorOp(v, "delete")} disabled={busy === v.id} data-testid={`admin-topup-vendor-delete-${v.kind}`} className="text-[10px] uppercase tracking-widest border border-coral/40 text-coral hover:bg-coral/10 px-2 py-1.5 transition-colors disabled:opacity-50">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- dialogs */}
      {form && (
        <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm overflow-y-auto p-4" data-testid="admin-topup-game-form" data-lenis-prevent>
          <div className="max-w-4xl mx-auto my-6 bg-panel border border-line">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display font-bold uppercase text-sm">{form.id ? "Edit Game" : "Game Baru"}</h3>
              <button onClick={() => setForm(null)} aria-label="Tutup" data-testid="admin-topup-form-close" className="text-slate-400 hover:text-coral"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="g-name" className={labelCls}>Nama Game *</label>
                  <input id="g-name" data-testid="game-name" value={form.name} onChange={(e) => patch({ name: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} className={inputCls} placeholder="Mobile Legends" />
                  {formErrors.name && <p className="mt-1 text-[10px] font-mono text-coral">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="g-slug" className={labelCls}>Slug *</label>
                  <input id="g-slug" data-testid="game-slug" value={form.slug} onChange={(e) => patch({ slug: e.target.value })} className={inputCls} placeholder="mobile-legends" />
                  {formErrors.slug && <p className="mt-1 text-[10px] font-mono text-coral">{formErrors.slug}</p>}
                </div>
                <div>
                  <label htmlFor="g-pub" className={labelCls}>Publisher</label>
                  <input id="g-pub" value={form.publisher} onChange={(e) => patch({ publisher: e.target.value })} className={inputCls} placeholder="Moonton" />
                </div>
                <div>
                  <label htmlFor="g-cur" className={labelCls}>Mata Uang / Item</label>
                  <input id="g-cur" value={form.currency} onChange={(e) => patch({ currency: e.target.value })} className={inputCls} placeholder="Diamond" />
                </div>
                <div>
                  <label htmlFor="g-icon" className={labelCls}>URL Icon</label>
                  <input id="g-icon" value={form.icon} onChange={(e) => patch({ icon: e.target.value })} className={inputCls} placeholder="https://..." />
                </div>
                <div>
                  <label htmlFor="g-banner" className={labelCls}>URL Banner</label>
                  <input id="g-banner" value={form.banner} onChange={(e) => patch({ banner: e.target.value })} className={inputCls} placeholder="https://..." />
                </div>
                <div>
                  <label htmlFor="g-vprefix" className={labelCls}>Prefix Pencocokan Digiflazz</label>
                  <input id="g-vprefix" data-testid="game-vendor-prefix" value={form.vendor_prefix} onChange={(e) => patch({ vendor_prefix: e.target.value })} className={inputCls} placeholder="ML" />
                  <p className="mt-1 text-[10px] font-mono text-slate-600">Dipakai untuk mencocokkan produk saat menarik pricelist dari API Digiflazz.</p>
                </div>
                <div>
                  <label htmlFor="g-seq" className={labelCls}>Urutan</label>
                  <input id="g-seq" type="number" value={form.seq} onChange={(e) => patch({ seq: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="g-notes" className={labelCls}>Catatan untuk Pembeli</label>
                  <textarea id="g-notes" rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="g-deliv" className={labelCls}>Info Pengiriman</label>
                  <textarea id="g-deliv" rows={2} value={form.delivery_info} onChange={(e) => patch({ delivery_info: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => patch({ is_active: e.target.checked })} data-testid="game-active" /> Aktif
                </label>
                <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={(e) => patch({ featured: e.target.checked })} /> Unggulan
                </label>
              </div>

              {/* destination fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-display font-bold uppercase text-xs text-slate-200">Field Tujuan (User ID / Server)</p>
                  <button onClick={() => patch({ fields: [...form.fields, { ...EMPTY_FIELD }] })} data-testid="add-field" className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2.5 py-1.5 transition-colors">
                    <Plus size={11} /> Tambah Field
                  </button>
                </div>
                {formErrors.fields && <p className="mb-2 text-[10px] font-mono text-coral">{formErrors.fields}</p>}
                <div className="space-y-3">
                  {form.fields.map((f, i) => (
                    <div key={i} data-testid={`field-row-${i}`} className="border border-line p-3">
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>Key</label>
                          <input value={f.key} onChange={(e) => patchField(i, { key: e.target.value })} data-testid={`field-key-${i}`} className={inputCls} placeholder="user_id" />
                        </div>
                        <div>
                          <label className={labelCls}>Label</label>
                          <input value={f.label} onChange={(e) => patchField(i, { label: e.target.value })} className={inputCls} placeholder="User ID" />
                        </div>
                        <div>
                          <label className={labelCls}>Placeholder</label>
                          <input value={f.placeholder} onChange={(e) => patchField(i, { placeholder: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Min Panjang</label>
                          <input type="number" value={f.min_len} onChange={(e) => patchField(i, { min_len: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Max Panjang</label>
                          <input type="number" value={f.max_len} onChange={(e) => patchField(i, { max_len: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Input Mode</label>
                          <select value={f.inputmode} onChange={(e) => patchField(i, { inputmode: e.target.value })} className={inputCls}>
                            <option value="numeric">numeric</option>
                            <option value="text">text</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCls}>Pattern (regex)</label>
                          <input value={f.pattern} onChange={(e) => patchField(i, { pattern: e.target.value })} data-testid={`field-pattern-${i}`} className={inputCls} placeholder="^[0-9]{6,15}$" />
                        </div>
                        <div>
                          <label className={labelCls}>Teks Bantuan</label>
                          <input value={f.help} onChange={(e) => patchField(i, { help: e.target.value })} className={inputCls} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={!!f.required} onChange={(e) => patchField(i, { required: e.target.checked })} /> Wajib
                        </label>
                        {formErrors[`field-${i}`] && <p className="text-[10px] font-mono text-coral">{formErrors[`field-${i}`]}</p>}
                        <button onClick={() => patch({ fields: form.fields.filter((_, n) => n !== i) })} data-testid={`remove-field-${i}`} className="text-[10px] uppercase tracking-widest text-coral hover:underline">Hapus Field</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* denominations (Digiflazz Live Pulled Only) */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="font-display font-bold uppercase text-xs text-slate-200">Nominal &amp; SKU Hasil Tarikan Digiflazz</p>
                    <p className="text-[10px] font-mono text-slate-500">
                      Input manual SKU &amp; nominal dinonaktifkan. Anda tetap dapat mengatur margin harga jual dan status aktif/nonaktif produk hasil tarikan Digiflazz.
                    </p>
                  </div>
                  {form.denominations.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const m = Number(pullMargin) || 10;
                          patch({
                            denominations: form.denominations.map((d) => {
                              const modal = Number(d.modal_price) || Math.round((Number(d.price) || 10000) * 0.9);
                              const nextSell = Math.max(1000, Math.ceil((modal * (1 + m / 100)) / 100) * 100);
                              return { ...d, modal_price: modal, price: nextSell };
                            }),
                          });
                          toast.success(`Harga jual dihitung ulang dengan margin +${m}% dari harga modal Digiflazz`);
                        }}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest border border-lime/40 text-lime hover:bg-lime/10 px-2.5 py-1.5 transition-colors cursor-pointer"
                      >
                        <Zap size={11} /> Terapkan Margin +{Number(pullMargin) || 10}%
                      </button>
                    </div>
                  )}
                </div>

                {form.denominations.length === 0 ? (
                  <div className="border border-dashed border-line bg-void/40 p-5 text-center space-y-2.5" data-testid="denom-empty-digiflazz-only">
                    <p className="text-xs font-mono text-slate-300 font-bold">
                      Belum ada produk &amp; SKU dari Digiflazz untuk game ini.
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 max-w-xl mx-auto">
                      Penambahan nominal &amp; SKU manual telah dihapus. Produk top up hanya dapat ditarik langsung dari API Digiflazz asli (tanpa data demo).
                    </p>
                    {form.id && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const targetGame = form;
                            setForm(null);
                            setImportTarget(targetGame);
                          }}
                          className="inline-flex items-center gap-1.5 bg-neon text-void hover:bg-lime font-display font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 transition-colors cursor-pointer"
                        >
                          <Download size={12} /> Tarik Produk dari Digiflazz
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.denominations.map((d, i) => (
                      <div key={d.vendor_sku || d.code || i} data-testid={`denom-row-${i}`} className="border border-line bg-void/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-line/60">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-neon border border-neon/40 bg-neon/10 px-2 py-0.5" data-testid={`denom-sku-${i}`}>
                              SKU: {d.vendor_sku}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 border border-line bg-void px-2 py-0.5" data-testid={`denom-code-${i}`}>
                              Kode: {d.code}
                            </span>
                            <span className="text-xs font-display font-bold text-slate-100">
                              {d.label}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400" data-testid={`denom-modal-${i}`}>
                            Modal Digiflazz: <strong className="text-slate-200">{formatIDR(d.modal_price || 0)}</strong>
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Harga Jual (IDR) *</label>
                            <input
                              type="number"
                              value={d.price}
                              onChange={(e) => patchDenom(i, { price: e.target.value })}
                              data-testid={`denom-price-${i}`}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Harga Coret (Opsional)</label>
                            <input
                              type="number"
                              value={d.price_strike}
                              onChange={(e) => patchDenom(i, { price_strike: e.target.value })}
                              className={inputCls}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!d.is_active}
                                onChange={(e) => patchDenom(i, { is_active: e.target.checked })}
                                data-testid={`denom-active-${i}`}
                              />{" "}
                              Aktif Ditampilkan
                            </label>
                            <button
                              type="button"
                              onClick={() => moveDenom(i, -1)}
                              disabled={i === 0}
                              aria-label="Naik"
                              className="grid place-items-center w-6 h-6 border border-line text-slate-400 hover:text-neon disabled:opacity-30"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDenom(i, 1)}
                              disabled={i === form.denominations.length - 1}
                              aria-label="Turun"
                              className="grid place-items-center w-6 h-6 border border-line text-slate-400 hover:text-neon disabled:opacity-30"
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>
                          {formErrors[`denom-${i}`] && <p className="text-[10px] font-mono text-coral">{formErrors[`denom-${i}`]}</p>}
                          <button
                            type="button"
                            onClick={() => patch({ denominations: form.denominations.filter((_, n) => n !== i) })}
                            data-testid={`remove-denom-${i}`}
                            className="text-[10px] uppercase tracking-widest text-coral hover:underline cursor-pointer"
                          >
                            Hapus Produk
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-line">
              <button onClick={() => setForm(null)} className="text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-slate-200 px-4 py-2.5">Batal</button>
              <button onClick={saveGame} disabled={saving} data-testid="save-game" className="inline-flex items-center gap-2 bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] px-5 py-2.5 hover:bg-lime transition-colors disabled:opacity-60">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan Game
              </button>
            </div>
          </div>
        </div>
      )}

      {vendorForm && (
        <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm overflow-y-auto p-4" data-testid="admin-topup-vendor-form" data-lenis-prevent>
          <div className="max-w-xl mx-auto my-10 bg-panel border border-line">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display font-bold uppercase text-sm">{vendorForm.id ? "Edit Supplier" : "Supplier Baru"}</h3>
              <button onClick={() => setVendorForm(null)} aria-label="Tutup" className="text-slate-400 hover:text-coral"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="v-kind" className={labelCls}>Jenis Supplier</label>
                <select
                  id="v-kind"
                  data-testid="vendor-kind"
                  value={vendorForm.kind}
                  onChange={(e) => {
                    const kind = e.target.value;
                    const spec = vendorSpec(kind) || { fields: [], label: kind };
                    const config = {};
                    (spec.fields || []).forEach((f) => { config[f.key] = ""; });
                    setVendorForm((v) => ({ ...v, kind, name: v.name || spec.label, config }));
                  }}
                  className={inputCls}
                >
                  {catalog.map((c) => <option key={c.kind} value={c.kind}>{c.label}</option>)}
                </select>
                {vendorSpec(vendorForm.kind)?.description && (
                  <p className="mt-1.5 text-[10px] font-mono text-slate-500">{vendorSpec(vendorForm.kind).description}</p>
                )}
              </div>
              <div>
                <label htmlFor="v-name" className={labelCls}>Nama Tampilan</label>
                <input id="v-name" data-testid="vendor-name" value={vendorForm.name} onChange={(e) => setVendorForm((v) => ({ ...v, name: e.target.value }))} className={inputCls} />
              </div>

              {(vendorSpec(vendorForm.kind)?.fields || []).map((f) => {
                const fromEnv = vendorForm.sources?.[f.key] === "env";
                return (
                <div key={f.key}>
                  <label htmlFor={`v-${f.key}`} className={`${labelCls} flex items-center gap-2`}>
                    <span>{f.label}{f.required ? " *" : ""}</span>
                    {fromEnv && (
                      <span
                        data-testid={`vendor-source-${f.key}`}
                        className="text-[9px] font-mono uppercase tracking-widest text-lime border border-lime/40 bg-lime/10 px-1.5 py-0.5"
                      >
                        dari .env
                      </span>
                    )}
                    {vendorForm.sources?.[f.key] === "db" && (
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                        dari database
                      </span>
                    )}
                  </label>
                  {f.type === "boolean" ? (
                    <label className="mt-2 flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer">
                      <input
                        id={`v-${f.key}`}
                        type="checkbox"
                        checked={vendorForm.config[f.key] === true || vendorForm.config[f.key] === "true"}
                        onChange={(e) => setVendorForm((v) => ({ ...v, config: { ...v.config, [f.key]: e.target.checked } }))}
                        data-testid={`vendor-config-${f.key}`}
                      />
                      Aktifkan
                    </label>
                  ) : (
                    <input
                      id={`v-${f.key}`}
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      value={vendorForm.config[f.key] ?? ""}
                      onChange={(e) => setVendorForm((v) => ({ ...v, config: { ...v.config, [f.key]: e.target.value } }))}
                      data-testid={`vendor-config-${f.key}`}
                      className={inputCls}
                      placeholder={
                        f.secret
                          ? (fromEnv ? "•••• Memakai nilai dari .env" : "•••• (biarkan jika tidak diubah)")
                          : (fromEnv ? "Memakai nilai dari .env" : "")
                      }
                    />
                  )}
                  {fromEnv && !vendorForm.config[f.key] && (
                    <p className="mt-1 text-[10px] font-mono text-slate-600">
                      Kosongkan untuk memakai nilai <code>.env</code>; isi untuk menimpanya.
                    </p>
                  )}
                </div>
                );
              })}

              <div className="flex flex-wrap gap-5 pt-2">
                <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={vendorForm.is_active} onChange={(e) => setVendorForm((v) => ({ ...v, is_active: e.target.checked }))} data-testid="vendor-active" /> Aktif
                </label>
                <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={vendorForm.auto_dispatch} onChange={(e) => setVendorForm((v) => ({ ...v, auto_dispatch: e.target.checked }))} data-testid="vendor-auto" /> Kirim otomatis
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-line">
              <button onClick={() => setVendorForm(null)} className="text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-slate-200 px-4 py-2.5">Batal</button>
              <button onClick={saveVendor} disabled={saving} data-testid="save-vendor" className="inline-flex items-center gap-2 bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] px-5 py-2.5 hover:bg-lime transition-colors disabled:opacity-60">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {importTarget && (
        <ImportDialog
          game={importTarget}
          vendors={vendors}
          headers={headers}
          onClose={() => setImportTarget(null)}
          onDone={() => { setImportTarget(null); load(); }}
        />
      )}

      {pullCatalogOpen && (
        <MerchantPullDialog
          initialVendorKind={pullVendorKind}
          initialMargin={pullMargin}
          headers={headers}
          onClose={() => setPullCatalogOpen(false)}
          onDone={() => { setPullCatalogOpen(false); load(); }}
        />
      )}

      {proofUrl && (
        <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setProofUrl(null)} data-testid="admin-topup-proof-dialog">
          <div className="bg-panel border border-line p-3 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img src={proofUrl} alt="Bukti pembayaran" className="w-full max-h-[70vh] object-contain" />
            <button onClick={() => setProofUrl(null)} className="mt-3 w-full text-[11px] font-mono uppercase tracking-widest border border-line text-slate-400 hover:text-neon py-2.5 transition-colors">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Modal for matching & pulling live Digiflazz products (SKUs/denominations) into existing local Top Up games. */
const MerchantPullDialog = ({ initialVendorKind = "digiflazz", initialMargin = 10, headers, onClose, onDone }) => {
  const [vendorKind] = useState(initialVendorKind || "digiflazz");
  const [marginPercent, setMarginPercent] = useState(
    initialMargin !== undefined ? Number(initialMargin) : 10
  );
  const [catalogGames, setCatalogGames] = useState([]);
  const [liveError, setLiveError] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [selectedSkusByGame, setSelectedSkusByGame] = useState({});
  const [expandedSlug, setExpandedSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);

  const loadCatalog = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setLiveError("");
      try {
        const { data } = await api.get("/admin/topup/merchant-catalog", {
          headers,
          params: {
            vendor_kind: vendorKind,
            margin_percent: marginPercent,
            refresh: forceRefresh ? "1" : undefined,
          },
        });
        const list = Array.isArray(data?.games) ? data.games : [];
        setCatalogGames(list);
        if (data?.live_error) {
          setLiveError(String(data.live_error));
        }
        const gamesWithProducts = list.filter((g) => (g.denominations || []).length > 0);
        setSelectedSlugs((prev) =>
          prev.length > 0 ? prev : gamesWithProducts.map((g) => g.slug)
        );
        setSelectedSkusByGame((prev) => {
          const next = { ...prev };
          for (const g of list) {
            next[g.slug] = (g.denominations || []).map((d) => d.sku);
          }
          return next;
        });
        if (forceRefresh) {
          if (data?.live_error) {
            toast.error(data.live_error);
          } else {
            toast.success("Daftar harga & SKU live Digiflazz berhasil diperbarui!");
          }
        }
      } catch (e) {
        const msg = formatApiError(e.response?.data?.detail) || "Gagal memuat produk Digiflazz";
        setLiveError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [vendorKind, marginPercent, headers]
  );

  useEffect(() => {
    loadCatalog(false);
  }, [loadCatalog]);

  const totalAvailableProducts = useMemo(
    () => catalogGames.reduce((acc, g) => acc + ((g.denominations || []).length || 0), 0),
    [catalogGames]
  );

  const toggleSlug = (slug) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const toggleSkuForGame = (slug, sku) => {
    setSelectedSkusByGame((prev) => {
      const current = prev[slug] || [];
      const exists = current.includes(sku);
      const nextList = exists ? current.filter((x) => x !== sku) : [...current, sku];
      return { ...prev, [slug]: nextList };
    });
    if (!selectedSlugs.includes(slug)) {
      setSelectedSlugs((prev) => [...prev, slug]);
    }
  };

  const toggleAllSkusForGame = (game) => {
    const allSkus = (game.denominations || []).map((d) => d.sku);
    const current = selectedSkusByGame[game.slug] || [];
    const nextList = current.length === allSkus.length ? [] : allSkus;
    setSelectedSkusByGame((prev) => ({ ...prev, [game.slug]: nextList }));
  };

  const toggleAll = () => {
    const selectableSlugs = catalogGames
      .filter((g) => (g.denominations || []).length > 0)
      .map((g) => g.slug);
    if (selectedSlugs.length === selectableSlugs.length) {
      setSelectedSlugs([]);
    } else {
      setSelectedSlugs(selectableSlugs);
    }
  };

  const handlePull = async () => {
    if (totalAvailableProducts === 0) {
      toast.error(liveError || "Tidak ada produk live dari Digiflazz untuk ditarik.");
      return;
    }
    if (!selectedSlugs.length) {
      toast.error("Pilih minimal 1 game lokal untuk ditarik produknya");
      return;
    }
    setPulling(true);
    try {
      const filteredSkusMap = {};
      for (const slug of selectedSlugs) {
        if (Array.isArray(selectedSkusByGame[slug]) && selectedSkusByGame[slug].length > 0) {
          filteredSkusMap[slug] = selectedSkusByGame[slug];
        }
      }
      const { data } = await api.post(
        "/admin/topup/pull-merchant",
        {
          vendor_kind: vendorKind,
          game_slugs: selectedSlugs,
          selected_skus_by_game: filteredSkusMap,
          margin_percent: Number(marginPercent) || 0,
          use_recommended_price: Number(marginPercent) <= 0,
          auto_activate_vendor: true,
        },
        { headers }
      );
      toast.success(data.message || "Produk Digiflazz berhasil ditarik ke game lokal!");
      onDone();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menarik produk Digiflazz");
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm overflow-y-auto p-4" data-testid="admin-topup-merchant-catalog-dialog" data-lenis-prevent>
      <div className="max-w-4xl mx-auto my-6 bg-panel border border-line">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-lime/15 text-lime border border-lime/40 px-2 py-0.5">
                API DIGIFLAZZ LIVE → GAME LOKAL
              </span>
              <h3 className="font-display font-bold uppercase text-sm">
                Tarik Produk (SKU &amp; Harga) Langsung dari Digiflazz
              </h3>
            </div>
            <p className="text-[10px] font-mono text-slate-400 mt-1">
              Hanya menarik produk dari API Digiflazz asli. Jika penarikan gagal, daftar produk tetap kosong tanpa menampilkan data demo.
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="text-slate-400 hover:text-coral">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid sm:grid-cols-3 gap-4 bg-void/60 border border-line p-3.5">
            <div>
              <label className={labelCls}>Sumber Produk</label>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex-1 bg-void border border-line text-xs font-mono text-neon font-bold px-3 py-2.5">
                  Digiflazz H2H (Live API)
                </span>
                <button
                  type="button"
                  onClick={() => loadCatalog(true)}
                  disabled={loading}
                  title="Tarik ulang pricelist live dari API Digiflazz"
                  className="border border-neon/50 text-neon hover:bg-neon/10 px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Margin Harga Jual Otomatis (%)</label>
              <div className="flex items-center gap-2">
                <select
                  value={[0, 5, 8, 10, 15, 20].includes(Number(marginPercent)) ? marginPercent : "custom"}
                  onChange={(e) => {
                    if (e.target.value !== "custom") setMarginPercent(Number(e.target.value));
                  }}
                  data-testid="dialog-merchant-margin"
                  className={inputCls}
                >
                  <option value={5}>Modal Digiflazz + 5%</option>
                  <option value={8}>Modal Digiflazz + 8%</option>
                  <option value={10}>Modal Digiflazz + 10%</option>
                  <option value={15}>Modal Digiflazz + 15%</option>
                  <option value={20}>Modal Digiflazz + 20%</option>
                  <option value={0}>Harga Jual Rekomendasi</option>
                  <option value="custom">Custom %</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Math.max(0, Number(e.target.value) || 0))}
                  className={`${inputCls} w-20 text-center`}
                  title="Persentase Margin (%)"
                />
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={toggleAll}
                disabled={totalAvailableProducts === 0}
                className="w-full border border-line hover:border-neon/60 text-slate-300 hover:text-neon text-[11px] font-mono uppercase tracking-widest py-2.5 px-3 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {selectedSlugs.length > 0 && selectedSlugs.length === catalogGames.filter((g) => (g.denominations || []).length > 0).length
                  ? "Batalkan Semua Game"
                  : `Pilih Game Tersedia`}
              </button>
            </div>
          </div>

          {!loading && (liveError || totalAvailableProducts === 0) && (
            <div className="border border-coral/50 bg-coral/10 p-4 space-y-1.5" data-testid="merchant-catalog-live-error">
              <p className="flex items-start gap-2 text-xs font-mono font-bold text-coral">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{liveError || "Pricelist live Digiflazz kosong (0 produk ditemukan)."}</span>
              </p>
              <p className="text-[11px] font-mono text-slate-400 pl-5">
                Sistem tidak menampilkan produk demo. Pastikan Username &amp; Production API Key Digiflazz sudah benar serta IP server telah di-whitelist di dashboard member Digiflazz.
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs font-mono text-slate-400">
              <Loader2 size={15} className="animate-spin text-neon" /> Menarik pricelist live dari API Digiflazz...
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {catalogGames.map((g) => {
                const checked = selectedSlugs.includes(g.slug);
                const expanded = expandedSlug === g.slug;
                const gameSkus = selectedSkusByGame[g.slug] || [];
                const hasItems = (g.denominations || []).length > 0;
                return (
                  <div
                    key={g.slug}
                    data-testid={`merchant-catalog-game-${g.slug}`}
                    className={`border transition-colors p-3.5 ${
                      checked && hasItems ? "border-neon/60 bg-neon/5" : "border-line bg-void/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className={`flex items-start gap-3 flex-1 ${hasItems ? "cursor-pointer" : "opacity-60"}`}>
                        <input
                          type="checkbox"
                          checked={checked && hasItems}
                          disabled={!hasItems}
                          onChange={() => toggleSlug(g.slug)}
                          className="mt-1"
                        />
                        <img
                          src={imgSrc(g.icon)}
                          alt={g.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-lg object-cover border border-neon/30 shrink-0 bg-void"
                        />
                        <div className="min-w-0">
                          <p className="font-display font-bold text-xs text-slate-100 truncate">
                            {g.name}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {g.publisher} • {gameSkus.length}/{g.denomination_count} Produk live ({g.currency})
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-mono text-neon border border-neon/30 bg-neon/10 px-1.5 py-0.5">
                              Prefix: {g.vendor_prefix}
                            </span>
                            <span className="text-[9px] font-mono text-lime border border-lime/30 bg-lime/10 px-1.5 py-0.5">
                              Tersimpan: {g.existing_denom_count} nominal
                            </span>
                          </div>
                        </div>
                      </label>
                      {hasItems && (
                        <button
                          type="button"
                          onClick={() => setExpandedSlug(expanded ? "" : g.slug)}
                          className="text-[10px] font-mono text-neon hover:text-lime underline shrink-0 cursor-pointer"
                        >
                          {expanded ? "Tutup SKU" : "Pilih SKU"}
                        </button>
                      )}
                    </div>

                    {expanded && hasItems && (
                      <div className="mt-3 pt-3 border-t border-line/60 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                          <span>Pilih produk SKU Digiflazz untuk {g.name}:</span>
                          <button
                            type="button"
                            onClick={() => toggleAllSkusForGame(g)}
                            className="text-neon hover:underline cursor-pointer"
                          >
                            {gameSkus.length === (g.denominations || []).length ? "Reset SKU" : "Pilih Semua SKU"}
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {(g.denominations || []).map((d) => {
                            const skuChecked = gameSkus.includes(d.sku);
                            return (
                              <label
                                key={d.sku}
                                className={`flex items-center justify-between text-[10px] font-mono px-2.5 py-1.5 border cursor-pointer transition-colors ${
                                  skuChecked
                                    ? "bg-neon/10 border-neon/50 text-slate-100"
                                    : "bg-void/80 border-line/50 text-slate-400"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={skuChecked}
                                    onChange={() => toggleSkuForGame(g.slug, d.sku)}
                                  />
                                  <span className="text-neon font-bold">{d.sku}</span>
                                  <span className="text-slate-200">{d.label}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-slate-400 mr-2">
                                    Modal {formatIDR(d.modal_price)}
                                  </span>
                                  <span className="text-lime font-bold">
                                    → Jual {formatIDR(d.selling_price)}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-line bg-void/40">
          <p className="text-[11px] font-mono text-slate-400">
            Target Game Lokal: <strong className="text-neon">{selectedSlugs.length}</strong> game • <strong className="text-lime">{totalAvailableProducts}</strong> produk live tersedia (Margin +{marginPercent}%)
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onClose}
              className="text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-slate-200 px-4 py-2.5"
            >
              Batal
            </button>
            <button
              onClick={handlePull}
              disabled={pulling || selectedSlugs.length === 0 || totalAvailableProducts === 0}
              data-testid="dialog-merchant-pull-selected"
              className="inline-flex items-center gap-2 bg-neon text-void font-display font-bold text-[11px] uppercase tracking-wider px-5 py-2.5 hover:bg-lime transition-colors disabled:opacity-50 cursor-pointer"
            >
              {pulling ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Tarik Produk ke {selectedSlugs.length} Game Lokal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Per-game dialog: Pull/select live Digiflazz products directly into this local game (no manual mapping, no demo fallback). */
const ImportDialog = ({ game, vendors, headers, onClose, onDone }) => {
  const [providerId, setProviderId] = useState(
    vendors.find((v) => v.kind === "digiflazz")?.id ||
      vendors.find((v) => v.kind !== "manual")?.id ||
      "vp-digiflazz"
  );
  const [selectedProductSkus, setSelectedProductSkus] = useState([]);
  const [marginPercent, setMarginPercent] = useState(10);
  const [searchQ, setSearchQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const calcSellPrice = useCallback(
    (modalPrice, retailPrice) => {
      const modal = Math.max(500, Number(modalPrice || 0));
      const m = Math.max(0, Number(marginPercent || 0));
      if (m > 0) {
        return Math.max(1000, Math.ceil((modal * (1 + m / 100)) / 100) * 100);
      }
      return Math.max(1000, Number(retailPrice) > modal ? Number(retailPrice) : Math.ceil((modal * 1.1) / 100) * 100);
    },
    [marginPercent]
  );

  const loadProducts = useCallback(
    async (forceRefresh = false) => {
      if (!providerId) return;
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/admin/topup/vendors/${providerId}/products`, {
          headers,
          params: {
            game_slug: game.slug,
            q: searchQ.trim() || game.vendor_prefix || game.slug || "",
            limit: 300,
            refresh: forceRefresh ? "1" : undefined,
          },
        });
        const list = Array.isArray(data?.products) ? data.products : [];
        setRows(list);
        if (data?.live_error) {
          setError(String(data.live_error));
          setSelectedProductSkus([]);
        } else if (!list.length) {
          setError("Tidak ada produk live Digiflazz yang cocok untuk game ini. Daftar produk dibiarkan kosong tanpa data demo.");
          setSelectedProductSkus([]);
        } else {
          setSelectedProductSkus((prev) =>
            prev.length > 0 ? prev : list.map((r) => r.sku)
          );
        }
      } catch (e) {
        setError(formatApiError(e.response?.data?.detail) || "Gagal memuat daftar produk dari API Digiflazz");
        setRows([]);
        setSelectedProductSkus([]);
      } finally {
        setLoading(false);
      }
    },
    [providerId, headers, game.slug, game.vendor_prefix, searchQ]
  );

  useEffect(() => {
    if (providerId) loadProducts(false);
  }, [providerId, loadProducts]);

  const toggleProductSku = (sku) => {
    setSelectedProductSkus((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );
  };

  const autoPullThisGame = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(
        `/admin/topup/games/${game.id}/import`,
        {
          provider_id: providerId,
          auto_pull_all: true,
          margin_percent: Number(marginPercent) || 0,
        },
        { headers }
      );
      toast.success(data.message || `Semua produk ${game.name} berhasil ditarik dari Digiflazz!`);
      onDone();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menarik produk dari Digiflazz");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const chosenProducts = rows.filter((r) => selectedProductSkus.includes(r.sku));
    if (!chosenProducts.length) {
      toast.error("Pilih minimal 1 produk live Digiflazz untuk ditarik ke game ini");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post(
        `/admin/topup/games/${game.id}/import`,
        {
          provider_id: providerId,
          selected_products: chosenProducts,
          margin_percent: Number(marginPercent) || 0,
        },
        { headers }
      );
      toast.success(data.message || `${chosenProducts.length} produk berhasil ditarik ke ${game.name}`);
      onDone();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menarik produk terpilih dari Digiflazz");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm overflow-y-auto p-4" data-testid="admin-topup-import-dialog" data-lenis-prevent>
      <div className="max-w-3xl mx-auto my-8 bg-panel border border-line">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            {game.icon && (
              <img
                src={imgSrc(game.icon)}
                alt={game.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg object-cover border border-neon/40 bg-void"
              />
            )}
            <div>
              <h3 className="font-display font-bold uppercase text-sm">Tarik Produk Digiflazz — {game.name}</h3>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                Hanya menarik produk langsung dari API Digiflazz asli dengan perhitungan harga Modal + Margin (%) tanpa produk demo.
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Tutup" data-testid="import-close" className="text-slate-400 hover:text-coral"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto">
          <div className="border border-lime/40 bg-lime/5 p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-display font-bold text-lime uppercase">
                Tarik Otomatis Semua Produk Live ({game.name})
              </p>
              <p className="text-[10px] font-mono text-slate-400">
                Tarik langsung semua nominal {game.name} dari API Digiflazz beserta perhitungan harga jual Modal + {marginPercent}%.
              </p>
            </div>
            <button
              type="button"
              onClick={autoPullThisGame}
              disabled={saving}
              data-testid="import-auto-pull-game"
              className="inline-flex items-center gap-1.5 bg-lime text-void hover:bg-neon font-display font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Tarik Semua Produk ({game.name})
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="imp-vendor" className={labelCls}>Supplier</label>
              <select id="imp-vendor" data-testid="import-vendor" value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
                {vendors.filter((v) => v.kind !== "manual").map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.kind_label})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="imp-margin" className={labelCls}>Margin Harga Jual (%)</label>
              <input
                id="imp-margin"
                type="number"
                min={0}
                max={100}
                value={marginPercent}
                onChange={(e) => setMarginPercent(Math.max(0, Number(e.target.value) || 0))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cari SKU / Produk Live</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder={game.vendor_prefix || game.name}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => loadProducts(true)}
                  disabled={loading}
                  data-testid="import-load"
                  title="Muat ulang dari API Digiflazz"
                  className="mt-1.5 border border-neon/50 text-neon hover:bg-neon/10 px-3 py-2.5 text-xs font-mono transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="border border-coral/50 bg-coral/10 p-3.5 space-y-1" data-testid="import-error">
              <p className="flex items-start gap-2 text-[11px] font-mono font-bold text-coral">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
              <p className="text-[10px] font-mono text-slate-400 pl-5">
                Daftar produk dibiarkan kosong tanpa data demo. Periksa kredensial Username &amp; API Key Digiflazz atau whitelist IP Anda.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>
                Terpilih: <strong className="text-neon">{selectedProductSkus.length}</strong> dari {rows.length} produk live Digiflazz
              </span>
              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedProductSkus(
                      selectedProductSkus.length === rows.length ? [] : rows.map((r) => r.sku)
                    )
                  }
                  className="text-neon hover:underline cursor-pointer"
                >
                  {selectedProductSkus.length === rows.length ? "Batalkan Semua" : "Pilih Semua Produk"}
                </button>
              )}
            </div>

            {rows.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {rows.map((r) => {
                  const checked = selectedProductSkus.includes(r.sku);
                  const sellPrice = calcSellPrice(r.price, r.retail_price);
                  return (
                    <label
                      key={r.sku}
                      className={`flex items-center justify-between gap-2 p-2.5 border text-[11px] font-mono cursor-pointer transition-colors ${
                        checked
                          ? "border-neon bg-neon/10 text-slate-100"
                          : "border-line bg-void/50 text-slate-400 hover:border-neon/40"
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProductSku(r.sku)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-neon font-bold truncate">{r.sku}</p>
                          <p className="text-[10px] text-slate-200 truncate">{r.label || r.name}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400">Modal: {formatIDR(r.price)}</p>
                        <p className="text-[10px] text-lime font-bold">Jual: {formatIDR(sellPrice)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-line">
          <button onClick={onClose} className="text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-slate-200 px-4 py-2.5">Batal</button>
          <button
            onClick={save}
            disabled={saving || selectedProductSkus.length === 0 || rows.length === 0}
            data-testid="import-save"
            className="inline-flex items-center gap-2 bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] px-5 py-2.5 hover:bg-lime transition-colors disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Tarik {selectedProductSkus.length} Produk ke {game.name}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Status cards shown above the supplier list. */
const IntegrationSummary = ({ integration, onCheckBalance, onImport, busy }) => {
  if (!integration) {
    return (
      <div data-testid="admin-topup-integration" className="border border-line bg-panel p-4">
        <p className="text-[11px] font-mono text-slate-500">Memuat ringkasan integrasi...</p>
      </div>
    );
  }
  const { active = {}, balance = {}, orders = {}, games_without_sku: missing = [] } = integration;
  const sourceLabel =
    active.source === "db" ? "database" : active.source === "env" ? "file .env" : "belum diatur";

  return (
    <div data-testid="admin-topup-integration" className="space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-line bg-panel p-4" data-testid="integration-active">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Supplier Aktif</p>
          <p className="font-display font-bold text-sm text-neon mt-1 flex items-center gap-2">
            <Plug size={13} /> {active.name || active.kind}
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-1">
            Kredensial dari: <span className={active.source === "none" ? "text-coral" : "text-slate-300"}>{sourceLabel}</span>
          </p>
          <p className="text-[10px] font-mono mt-0.5">
            Auto-kirim:{" "}
            <span className={active.auto_dispatch ? "text-lime" : "text-slate-400"}>
              {active.auto_dispatch ? "aktif" : "nonaktif"}
            </span>
          </p>
        </div>

        <div className="border border-line bg-panel p-4" data-testid="integration-balance">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Saldo Supplier</p>
          <p className="font-display font-bold text-lg mt-1 text-slate-100">
            {balance.supported && balance.ok
              ? new Intl.NumberFormat("id-ID").format(Number(balance.balance) || 0)
              : "—"}
          </p>
          <p className={`text-[10px] font-mono mt-1 ${balance.supported && balance.ok ? "text-lime" : "text-slate-500"}`}>
            {balance.supported ? (balance.ok ? "Tersinkron" : balance.message || "Tidak tersedia") : "Tidak didukung"}
          </p>
          {balance.supported && (
            <button
              type="button"
              onClick={onCheckBalance}
              disabled={busy}
              data-testid="integration-balance-refresh"
              className="mt-2 text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2 py-1 transition-colors disabled:opacity-50"
            >
              Cek Saldo
            </button>
          )}
        </div>

        <div className="border border-line bg-panel p-4" data-testid="integration-orders">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Pesanan Perlu Aksi</p>
          <p className="font-display font-bold text-lg mt-1 text-slate-100">{orders.paid_undelivered ?? 0}</p>
          <p className="text-[10px] font-mono text-slate-500 mt-1">lunas tapi belum terkirim</p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            {orders.waiting_approval ?? 0} perlu verifikasi • {orders.unpaid ?? 0} belum bayar
          </p>
        </div>

        <div
          className={`border p-4 ${missing.length ? "border-coral/40 bg-coral/5" : "border-line bg-panel"}`}
          data-testid="integration-sku"
        >
          <p className="text-[10px] uppercase tracking-widest text-slate-500">SKU Supplier</p>
          {missing.length ? (
            <>
              <p className="font-display font-bold text-lg mt-1 text-coral">{missing.length} game</p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">belum punya SKU di semua nominal</p>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-lg mt-1 text-lime">Lengkap</p>
              <p className="text-[10px] font-mono text-slate-500 mt-1">semua nominal punya SKU</p>
            </>
          )}
          {integration.products_unsynced > 0 && (
            <p className="text-[10px] font-mono text-coral mt-0.5">
              {integration.products_unsynced} produk belum disinkronkan
            </p>
          )}
        </div>
      </div>

      {missing.length > 0 && (
        <div className="border border-coral/30 bg-coral/5 p-3" data-testid="integration-sku-warning">
          <p className="flex items-start gap-2 text-[11px] font-mono text-slate-300">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-coral" />
            Isi SKU agar pengiriman ke supplier bisa berjalan. Pesanan tanpa SKU akan dilewati
            (tidak dikirim otomatis) dan tetap menunggu admin.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.slice(0, 8).map((g) => (
              <button
                key={g.slug}
                type="button"
                onClick={() => onImport(g.slug)}
                data-testid={`integration-missing-${g.slug}`}
                className="text-[10px] font-mono border border-line text-slate-400 hover:text-neon hover:border-neon/50 px-2 py-1 transition-colors"
              >
                {g.game} ({g.missing}/{g.total}) — impor SKU
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTopup;
