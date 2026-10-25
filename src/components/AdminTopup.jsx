import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, X, Loader2, Gamepad2, RefreshCw, Zap, Save,
  ArrowUp, ArrowDown, Plug, FlaskConical, Wallet, Download, CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatIDR, formatApiError } from "@/lib/api";

const inputCls =
  "mt-1.5 w-full bg-void border border-line focus:border-neon/60 outline-none text-xs font-mono px-3 py-2.5 placeholder:text-slate-600 transition-colors";
const labelCls = "block text-[10px] uppercase tracking-[0.2em] text-slate-500";

const EMPTY_FIELD = {
  key: "", label: "", placeholder: "", type: "text", inputmode: "numeric",
  required: true, min_len: 0, max_len: 0, pattern: "", help: "",
};
const EMPTY_DENOM = {
  code: "", label: "", amount: 0, price: 0, price_strike: 0,
  stock: 100, badge: "", is_active: true, featured: false, vendor_sku: "",
};
const EMPTY_GAME = {
  name: "", slug: "", publisher: "", icon: "", banner: "", currency: "Diamond",
  notes: "", delivery_info: "", is_active: true, featured: false, seq: 0,
  vendor_prefix: "", vendor_id: "",
  fields: [{ ...EMPTY_FIELD, key: "user_id", label: "User ID" }],
  denominations: [{ ...EMPTY_DENOM }],
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

export const AdminTopup = ({ headers, sections, defaultSection }) => {
  const allowedSections = useMemo(
    () => (sections?.length ? sections : ["games", "orders", "vendors"]),
    [sections]
  );
  const [subTab, setSubTab] = useState(defaultSection || allowedSections[0]);
  const [games, setGames] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [activeVendor, setActiveVendor] = useState("manual");
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
        setActiveVendor(v.value.data?.active_kind || "manual");
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

  // ------------------------------------------------------------- game editor
  const openNew = () => setForm({ ...EMPTY_GAME, fields: [{ ...EMPTY_FIELD, key: "user_id", label: "User ID" }], denominations: [{ ...EMPTY_DENOM }] });

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
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menyimpan game");
    } finally {
      setSaving(false);
    }
  };

  const removeGame = async (g) => {
    try {
      const { data } = await api.delete(`/admin/games/${g.id}`, { headers });
      toast.success(`Game dihapus (${data.products_removed} produk)`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menghapus game");
    }
  };

  const syncAll = async () => {
    setBusy("sync");
    try {
      const { data } = await api.post("/admin/games/sync", {}, { headers });
      toast.success(`${data.products} produk top up disinkronkan`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal sinkronisasi");
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2" data-testid="admin-topup-subtabs">
          {showSubTabs &&
            TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                data-testid={`admin-topup-tab-${t.id}`}
                className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3.5 py-2 border transition-colors ${
                  subTab === t.id ? "bg-neon text-void border-neon" : "border-line text-slate-400 hover:text-neon"
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            data-testid="admin-topup-reload"
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-3.5 py-2 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Muat Ulang
          </button>
          {subTab === "games" && (
            <>
              <button
                onClick={syncAll}
                disabled={busy === "sync"}
                data-testid="admin-topup-sync"
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border border-neon/50 text-neon hover:bg-neon/10 px-3.5 py-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={busy === "sync" ? "animate-spin" : ""} /> Sinkronkan
              </button>
              <button
                onClick={openNew}
                data-testid="admin-topup-add-game"
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest bg-neon text-void hover:bg-lime px-4 py-2 transition-colors"
              >
                <Plus size={13} /> Game Baru
              </button>
            </>
          )}
          {subTab === "vendors" && (
            <button
              onClick={() => openVendor(null)}
              data-testid="admin-topup-add-vendor"
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest bg-neon text-void hover:bg-lime px-4 py-2 transition-colors"
            >
              <Plus size={13} /> Supplier Baru
            </button>
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
        <div className="border border-line bg-panel overflow-x-auto" data-testid="admin-topup-games-table">
          {games.length === 0 ? (
            <p className="text-center text-xs text-slate-500 font-mono py-16">Belum ada game top up.</p>
          ) : (
            <table className="w-full text-left text-xs font-mono min-w-[860px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="px-4 py-3">Game</th>
                  <th className="px-4 py-3">Publisher</th>
                  <th className="px-4 py-3">Field Tujuan</th>
                  <th className="px-4 py-3">Nominal</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id} data-testid={`admin-topup-game-row-${g.slug}`} className="border-b border-line/60 hover:bg-panelhover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {g.icon || g.banner ? (
                          <img src={g.icon || g.banner} alt="" loading="lazy" className="w-8 h-8 object-cover border border-line" />
                        ) : (
                          <span className="w-8 h-8 grid place-items-center border border-line text-slate-500"><Gamepad2 size={13} /></span>
                        )}
                        <div>
                          <p className="text-slate-100 font-bold">{g.name}</p>
                          <p className="text-[10px] text-slate-500">{g.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{g.publisher || "-"}</td>
                    <td className="px-4 py-3 text-slate-400">{(g.fields || []).map((f) => f.label || f.key).join(", ") || "-"}</td>
                    <td className="px-4 py-3 text-slate-300">{(g.denominations || []).length}</td>
                    <td className="px-4 py-3">
                      <span className={g.products_synced ? "text-lime" : "text-coral"}>{g.product_count ?? 0}</span>
                      <span className="text-slate-600">/{g.denominations?.length ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        data-testid={`admin-topup-game-status-${g.slug}`}
                        className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 border ${
                          g.is_active ? "text-lime border-lime/40 bg-lime/10" : "text-slate-500 border-line"
                        }`}
                      >
                        {g.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setImportTarget(g)}
                          data-testid={`admin-topup-import-${g.slug}`}
                          aria-label="Impor SKU supplier"
                          title="Impor SKU supplier"
                          className="grid place-items-center w-8 h-8 border border-line text-slate-400 hover:text-neon hover:border-neon/50 transition-colors"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={() => openEdit(g)}
                          data-testid={`admin-topup-edit-${g.slug}`}
                          aria-label="Edit game"
                          className="grid place-items-center w-8 h-8 border border-line text-slate-400 hover:text-neon hover:border-neon/50 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => removeGame(g)}
                          data-testid={`admin-topup-delete-${g.slug}`}
                          aria-label="Hapus game"
                          className="grid place-items-center w-8 h-8 border border-line text-slate-400 hover:text-coral hover:border-coral/50 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
                      <td className="px-4 py-3 text-slate-400 break-all max-w-[200px]">
                        {Object.entries(o.destination || {}).map(([k, v]) => `${k}: ${v}`).join(" • ") || "-"}
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
                  <label htmlFor="g-vprefix" className={labelCls}>Prefix SKU Supplier</label>
                  <input id="g-vprefix" data-testid="game-vendor-prefix" value={form.vendor_prefix} onChange={(e) => patch({ vendor_prefix: e.target.value })} className={inputCls} placeholder="ML" />
                  <p className="mt-1 text-[10px] font-mono text-slate-600">Dipakai bila nominal tidak punya SKU sendiri.</p>
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

              {/* denominations */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-display font-bold uppercase text-xs text-slate-200">Nominal</p>
                  <button onClick={() => patch({ denominations: [...form.denominations, { ...EMPTY_DENOM }] })} data-testid="add-denom" className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest border border-line text-slate-400 hover:text-neon px-2.5 py-1.5 transition-colors">
                    <Plus size={11} /> Tambah Nominal
                  </button>
                </div>
                <div className="space-y-3">
                  {form.denominations.map((d, i) => (
                    <div key={i} data-testid={`denom-row-${i}`} className="border border-line p-3">
                      <div className="grid sm:grid-cols-4 gap-3">
                        <div>
                          <label className={labelCls}>Kode *</label>
                          <input value={d.code} onChange={(e) => patchDenom(i, { code: e.target.value })} data-testid={`denom-code-${i}`} className={inputCls} placeholder="86" />
                        </div>
                        <div>
                          <label className={labelCls}>Label</label>
                          <input value={d.label} onChange={(e) => patchDenom(i, { label: e.target.value })} className={inputCls} placeholder="86 Diamond" />
                        </div>
                        <div>
                          <label className={labelCls}>Harga *</label>
                          <input type="number" value={d.price} onChange={(e) => patchDenom(i, { price: e.target.value })} data-testid={`denom-price-${i}`} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Harga Coret</label>
                          <input type="number" value={d.price_strike} onChange={(e) => patchDenom(i, { price_strike: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Jumlah Item</label>
                          <input type="number" value={d.amount} onChange={(e) => patchDenom(i, { amount: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Stok</label>
                          <input type="number" value={d.stock} onChange={(e) => patchDenom(i, { stock: e.target.value })} data-testid={`denom-stock-${i}`} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Badge</label>
                          <input value={d.badge} onChange={(e) => patchDenom(i, { badge: e.target.value })} className={inputCls} placeholder="Populer" />
                        </div>
                        <div>
                          <label className={labelCls}>SKU Supplier</label>
                          <input value={d.vendor_sku} onChange={(e) => patchDenom(i, { vendor_sku: e.target.value })} data-testid={`denom-sku-${i}`} className={inputCls} placeholder="ML86" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={!!d.is_active} onChange={(e) => patchDenom(i, { is_active: e.target.checked })} data-testid={`denom-active-${i}`} /> Aktif
                          </label>
                          <button onClick={() => moveDenom(i, -1)} disabled={i === 0} aria-label="Naik" className="grid place-items-center w-6 h-6 border border-line text-slate-400 hover:text-neon disabled:opacity-30"><ArrowUp size={11} /></button>
                          <button onClick={() => moveDenom(i, 1)} disabled={i === form.denominations.length - 1} aria-label="Turun" className="grid place-items-center w-6 h-6 border border-line text-slate-400 hover:text-neon disabled:opacity-30"><ArrowDown size={11} /></button>
                        </div>
                        {formErrors[`denom-${i}`] && <p className="text-[10px] font-mono text-coral">{formErrors[`denom-${i}`]}</p>}
                        <button onClick={() => patch({ denominations: form.denominations.filter((_, n) => n !== i) })} data-testid={`remove-denom-${i}`} className="text-[10px] uppercase tracking-widest text-coral hover:underline">Hapus Nominal</button>
                      </div>
                    </div>
                  ))}
                </div>
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

/** Bulk-attach supplier SKUs to a game's denominations. */
const ImportDialog = ({ game, vendors, headers, onClose, onDone }) => {
  const [providerId, setProviderId] = useState(vendors.find((v) => v.kind !== "manual")?.id || "");
  const [skuMap, setSkuMap] = useState({});
  const [marginPercent, setMarginPercent] = useState(0);
  const [applyPrice, setApplyPrice] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError("");
    try {
      const brand = game.vendor_prefix || game.name;
      const { data } = await api.get(`/admin/topup/vendors/${providerId}/products`, {
        headers, params: { q: game.vendor_prefix || "", limit: 200 },
      });
      const list = data.products || [];
      setRows(list);
      if (!list.length) {
        setError(`Tidak ada SKU yang cocok dengan "${brand}". Isi "Prefix SKU Supplier" di game atau masukkan SKU manual.`);
      } else {
        // Auto-match existing or closest SKU for each denomination so user can save immediately
        setSkuMap((prev) => {
          const next = { ...prev };
          (game.denominations || []).forEach((d, idx) => {
            if (!next[d.code]) {
              const exact = list.find(
                (r) =>
                  r.sku === d.vendor_sku ||
                  String(r.sku).toLowerCase().endsWith(String(d.code).toLowerCase())
              );
              const fallback = list[idx] || list[0];
              const chosen = exact || fallback;
              if (chosen) next[d.code] = { sku: chosen.sku, price: chosen.price };
            }
          });
          return next;
        });
      }
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || "Gagal memuat daftar SKU supplier");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [providerId, headers, game.vendor_prefix, game.name, game.denominations]);

  useEffect(() => {
    if (providerId) loadProducts();
  }, [providerId, loadProducts]);

  const pick = (code, row) => setSkuMap((m) => ({
    ...m,
    [code]: { sku: row.sku, price: row.price },
  }));

  const save = async () => {
    if (!Object.keys(skuMap).length) {
      toast.error("Pilih minimal satu SKU");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/topup/games/${game.id}/import`, {
        provider_id: providerId, skus: skuMap,
        apply_price: applyPrice, margin_percent: Number(marginPercent) || 0,
      }, { headers });
      toast.success(data.message);
      onDone();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal impor SKU");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm overflow-y-auto p-4" data-testid="admin-topup-import-dialog" data-lenis-prevent>
      <div className="max-w-3xl mx-auto my-8 bg-panel border border-line">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h3 className="font-display font-bold uppercase text-sm">Impor SKU Supplier</h3>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">{game.name}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" data-testid="import-close" className="text-slate-400 hover:text-coral"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="imp-vendor" className={labelCls}>Supplier</label>
              <select id="imp-vendor" data-testid="import-vendor" value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
                <option value="">— pilih supplier —</option>
                {vendors.filter((v) => v.kind !== "manual").map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.kind_label})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="imp-margin" className={labelCls}>Margin (%)</label>
              <input id="imp-margin" type="number" value={marginPercent} onChange={(e) => setMarginPercent(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer pb-2.5">
                <input type="checkbox" checked={applyPrice} onChange={(e) => setApplyPrice(e.target.checked)} data-testid="import-apply-price" /> Perbarui harga
              </label>
            </div>
          </div>

          <button onClick={loadProducts} disabled={!providerId || loading} data-testid="import-load" className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border border-neon/50 text-neon hover:bg-neon/10 px-4 py-2 transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Muat Daftar SKU
          </button>

          {error && (
            <p className="flex items-start gap-2 text-[11px] font-mono text-coral" data-testid="import-error">
              <AlertCircle size={12} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <div className="space-y-3">
            {(game.denominations || []).map((d) => (
              <div key={d.code} className="border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-mono text-slate-200">
                    <span className="text-neon">{d.code}</span> — {d.label} • {formatIDR(d.price)}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500" data-testid={`import-current-${d.code}`}>
                    SKU: {skuMap[d.code]?.sku || d.vendor_sku || "—"}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {rows.length === 0 && <p className="text-[10px] font-mono text-slate-600">Muat daftar SKU dahulu.</p>}
                  {rows.map((r) => (
                    <button
                      key={r.sku}
                      onClick={() => pick(d.code, r)}
                      data-testid={`import-pick-${d.code}-${r.sku}`}
                      className={`text-[10px] font-mono border px-2 py-1 transition-colors ${
                        skuMap[d.code]?.sku === r.sku ? "border-neon bg-neon/10 text-neon" : "border-line text-slate-400 hover:text-neon hover:border-neon/50"
                      }`}
                    >
                      {r.sku} • {formatIDR(r.price)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-line">
          <button onClick={onClose} className="text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-slate-200 px-4 py-2.5">Batal</button>
          <button onClick={save} disabled={saving} data-testid="import-save" className="inline-flex items-center gap-2 bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] px-5 py-2.5 hover:bg-lime transition-colors disabled:opacity-60">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Impor SKU
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
