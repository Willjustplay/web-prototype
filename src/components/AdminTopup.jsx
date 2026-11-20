import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, X, Loader2, Gamepad2, RefreshCw, Zap, Save,
  ArrowUp, ArrowDown, Plug, FlaskConical, Wallet, Download, CheckCircle2, AlertCircle, Search, Upload,
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
  stock: 100, badge: "", sku_group: "currency", is_active: true, featured: false, vendor_sku: "",
};
const EMPTY_GAME = {
  name: "", slug: "", publisher: "", icon: "", banner: "", currency: "Diamond",
  notes: "", delivery_info: "", is_active: true, featured: false, seq: 0,
  vendor_prefix: "", cek_id_sku: "", vendor_id: "vp-digiflazz",
  fields: [{ ...EMPTY_FIELD, key: "user_id", label: "User ID" }],
  denominations: [],
};

const resolveSkuGroup = (d) => {
  const g = String(d?.sku_group || "").trim().toLowerCase();
  if (g === "membership" || g === "currency") return g;
  const hay = `${d?.vendor_sku || d?.sku || ""} ${d?.code || ""} ${d?.label || d?.name || ""} ${d?.badge || ""}`;
  if (
    /\b(membership|member|welkin|blessing|inter-knot|interknot|wdp|weekly\s*diamond\s*pass|twilight\s*pass|starlight|supply\s*pass|express\s*supply|lunite\s*subscription|royale\s*pass|booyah\s*pass|elite\s*pass|battle\s*pass|season\s*pass|star\s*pass|premium\s*pass|monthly\s*card|weekly\s*card|monthly\s*pass|weekly\s*pass|vip\s*card|kartu\s*bulanan|kartu\s*mingguan|berkah|langganan|subscription|pass|paket\s*mingguan|paket\s*bulanan|level\s*up\s*pass)\b/i.test(
      hay
    )
  ) {
    return "membership";
  }
  return "currency";
};

const slugify = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const resolveBuiltInDigiflazzFields = (gameOrMeta, allGames = []) => {
  const slug = slugify(gameOrMeta?.slug || gameOrMeta?.name || "");
  const prefix = String(gameOrMeta?.vendor_prefix || "").trim().toUpperCase();

  const matchedExisting = (allGames || []).find(
    (g) =>
      String(g.slug || "").toLowerCase() === slug ||
      (prefix && String(g.vendor_prefix || "").toUpperCase() === prefix)
  );
  if (matchedExisting && Array.isArray(matchedExisting.fields) && matchedExisting.fields.length > 0) {
    return matchedExisting.fields;
  }

  if (
    slug.includes("mobile-legends") ||
    slug.includes("magic-chess") ||
    prefix === "ML" ||
    prefix === "MCGG"
  ) {
    return [
      { key: "user_id", label: "User ID", placeholder: "123456789", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 15, pattern: "^[0-9]{5,15}$", help: "Masukkan angka User ID sesuai profil game Anda" },
      { key: "zone_id", label: "Zone ID", placeholder: "1234", type: "text", inputmode: "numeric", required: true, min_len: 3, max_len: 6, pattern: "^[0-9]{3,6}$", help: "Masukkan angka Zone ID (di dalam tanda kurung)" },
    ];
  }

  if (
    slug.includes("genshin") ||
    slug.includes("zenless") ||
    slug.includes("honkai-star-rail") ||
    prefix === "GI" ||
    prefix === "ZZZ" ||
    prefix === "HSR"
  ) {
    return [
      { key: "user_id", label: "UID", placeholder: "800123456", type: "text", inputmode: "numeric", required: true, min_len: 8, max_len: 12, pattern: "^[0-9]{8,12}$", help: "Masukkan UID angka akun HoYoverse Anda" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, options: ["Asia", "America", "Europe", "TW, HK, MO"], help: "Pilih server akun HoYoverse Anda" },
    ];
  }

  if (slug.includes("wuthering") || prefix === "WW") {
    return [
      { key: "user_id", label: "UID", placeholder: "900123456", type: "text", inputmode: "numeric", required: true, min_len: 8, max_len: 12, pattern: "^[0-9]{8,12}$", help: "Masukkan 9 digit UID Wuthering Waves" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, options: ["SEA", "Asia", "America", "Europe", "HMT (HK, MO, TW)"], help: "Pilih server Wuthering Waves Anda" },
    ];
  }

  if (slug.includes("ragnarok") || prefix === "ROM" || prefix === "ROO") {
    return [
      { key: "user_id", label: "Role ID / Character ID", placeholder: "4300123456", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 16, pattern: "^[0-9]{5,16}$", help: "Masukkan angka Role ID / Character ID karakter Anda" },
      { key: "server", label: "Server", placeholder: "Nama Server", type: "text", inputmode: "text", required: true, min_len: 2, max_len: 30, help: "Masukkan nama Server karakter Anda" },
    ];
  }

  if (slug.includes("valorant") || slug.includes("wild-rift") || prefix === "VAL" || prefix === "WR") {
    return [
      { key: "riot_id", label: "Riot ID#Tag", placeholder: "Player#IDN", type: "text", inputmode: "text", required: true, min_len: 4, max_len: 32, help: "Format wajib: Nickname#Tag (Contoh: Player#IDN)" },
    ];
  }

  if (Array.isArray(gameOrMeta?.fields) && gameOrMeta.fields.length > 0) {
    return gameOrMeta.fields;
  }

  return [
    { key: "user_id", label: "User ID / Player ID", placeholder: "Masukkan ID Akun Game", type: "text", inputmode: "numeric", required: true, min_len: 4, max_len: 24, help: "Masukkan User ID / Player ID sesuai profil di dalam game" },
  ];
};

const resolveCustomerNoFormatLabel = (fields = []) => {
  const keys = fields.map((f) => f.key);
  if (keys.includes("user_id") && keys.includes("zone_id")) {
    return "{user_id}{zone_id} (Digabung otomatis ke Digiflazz)";
  }
  if (keys.includes("riot_id")) {
    return "{riot_id} (Nickname#Tag)";
  }
  if (keys.includes("user_id") && keys.includes("server")) {
    return "{user_id} + {server}";
  }
  return "{user_id}";
};

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

  const [adminDenomTab, setAdminDenomTab] = useState("all");

  // ------------------------------------------------------------- game editor
  const openNew = () => {
    setAdminDenomTab("all");
    setForm({ ...EMPTY_GAME, fields: [{ ...EMPTY_FIELD, key: "user_id", label: "User ID" }], denominations: [] });
  };

  const openEdit = (g) => {
    setAdminDenomTab("all");
    setForm({
      ...EMPTY_GAME,
      ...g,
      fields: (g.fields || []).map((f) => ({ ...EMPTY_FIELD, ...f })),
      denominations: (g.denominations || []).map((d) => ({
        ...EMPTY_DENOM,
        vendor_sku: d.vendor_sku || "",
        price_strike: d.price_strike || 0,
        sku_group: resolveSkuGroup(d),
        ...d,
      })),
    });
  };

  const patch = (changes) => setForm((f) => ({ ...f, ...changes }));
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

  const builtInFieldsForForm = useMemo(
    () => (form ? resolveBuiltInDigiflazzFields(form, games) : []),
    [form, games]
  );

  const formErrors = useMemo(() => {
    if (!form) return {};
    const errs = {};
    if (!form.name.trim()) errs.name = "Nama game wajib diisi";
    if (!slugify(form.slug || form.name)) errs.slug = "Slug tidak valid";
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

  const [uploadingField, setUploadingField] = useState("");

  const uploadGameImage = async (fieldKey, file) => {
    if (!file) return;
    setUploadingField(fieldKey);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload", fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      if (data?.url) {
        patch({ [fieldKey]: data.url });
        toast.success(`Gambar ${fieldKey === "icon" ? "Icon" : "Banner"} berhasil diunggah`);
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mengunggah gambar");
    } finally {
      setUploadingField("");
    }
  };

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
        icon: String(form.icon || "").trim(),
        banner: String(form.banner || "").trim(),
        vendor_prefix: String(form.vendor_prefix || "").trim().toUpperCase(),
        cek_id_sku: String(form.cek_id_sku || "").trim().toUpperCase(),
        seq: Number(form.seq) || 0,
        fields: builtInFieldsForForm,
        denominations: form.denominations.map((d, i) => ({
          ...d,
          code: String(d.code).trim(),
          label: d.label.trim() || String(d.code).trim(),
          amount: Number(d.amount) || 0,
          modal_price: Number(d.modal_price) || 0,
          price: Number(d.price) || 0,
          price_strike: Number(d.price_strike) || 0,
          sku_group: resolveSkuGroup(d),
          stock: Number(d.stock) || 0,
          seq: i,
          is_active: !!d.is_active,
        })),
      };
      if (form.id) await api.put(`/admin/games/${form.id}`, payload, { headers });
      else await api.post("/admin/games", payload, { headers });
      toast.success(
        form.id
          ? "Game (termasuk URL Icon & URL Banner) berhasil disimpan ke database PostgreSQL"
          : "Game baru berhasil ditambahkan & disimpan ke database PostgreSQL"
      );
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

  const checkSkuHealth = async () => {
    setBusy("sku-health");
    try {
      const { data } = await api.post("/admin/topup/check-sku-health", {}, { headers });
      if (data.ok) {
        toast.success(data.message || "Kesehatan SKU Digiflazz berhasil diperiksa");
      } else {
        toast.error(data.message || "Gagal memeriksa kesehatan SKU Digiflazz");
      }
      load();
      onReload?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mengecek gangguan SKU Digiflazz");
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
      if (action === "delete") {
        const { data } = await api.delete(`/admin/orders/${o.session_id}`, { headers });
        toast.success(data?.message || `Order ${o.session_id} berhasil dihapus`);
      }
      if (action === "sync") {
        const { data } = await api.post(`/admin/orders/${o.session_id}/sync`, {}, { headers });
        toast.success(`Status Pembayaran: ${data.paykita_status || data.payment_status}`);
      }
      if (action === "check_digiflazz") {
        const { data } = await api.post(`/admin/topup/orders/${o.session_id}/check-digiflazz`, {}, { headers });
        if (data.status === "Sukses") {
          toast.success(`Digiflazz Sukses!${data.sn ? ` SN: ${data.sn}` : ""}`);
        } else if (data.status === "Gagal") {
          toast.error(`Digiflazz Gagal: ${data.message || "Transaksi gagal"}`);
        } else {
          toast.info(`Digiflazz (${data.status || "Pending"}): ${data.message || "Sedang diproses"}`);
        }
      }
      if (action === "complete") {
        const { data } = await api.post(`/admin/topup/orders/${o.session_id}/complete`, body, { headers });
        toast.success(data.dispatched ? "Pesanan dikirim / dicek ke Digiflazz" : "Pesanan ditandai terkirim");
      }
      load();
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
                onClick={checkSkuHealth}
                disabled={busy === "sku-health"}
                data-testid="admin-topup-check-sku-health"
                title="Cek status SKU ke Digiflazz sekarang (auto-hide jika gangguan, tampilkan kembali jika normal)"
                className="flex items-center gap-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider border border-lime/50 text-lime hover:bg-lime/10 px-3.5 py-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} className={busy === "sku-health" ? "animate-spin" : ""} /> Cek Gangguan SKU
              </button>
              <button
                onClick={() => clearProductsAndSkus()}
                disabled={busy === "clear-all"}
                data-testid="admin-topup-clear-all"
                title="Hapus semua produk topup bawaan dan kosongkan semua nominal & SKU pada semua game lokal"
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
                onClick={checkSkuHealth}
                disabled={busy === "sku-health"}
                data-testid="admin-topup-vendor-check-sku-health"
                className="flex items-center gap-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider border border-lime/50 text-lime hover:bg-lime/10 px-3.5 py-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} className={busy === "sku-health" ? "animate-spin" : ""} /> Cek Gangguan SKU
              </button>
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
                    <td className="px-4 py-3.5 text-slate-400">
                      <div>{(g.fields || []).map((f) => f.label || f.key).join(" · ") || "-"}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        SKU Cek ID:{" "}
                        <span className={g.cek_id_sku ? "text-neon font-bold" : "text-slate-600"}>
                          {g.cek_id_sku || "Belum diatur"}
                        </span>
                      </div>
                    </td>
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
                        {o.vendor_sku && (
                          <p className="text-[10px] text-neon font-mono mt-0.5">SKU: {o.vendor_sku}</p>
                        )}
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
                      <td className="px-4 py-3 space-y-1">
                        <span data-testid={`admin-topup-order-status-${o.session_id}`} className={`inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-1 border ${statusStyle(o)}`}>
                          {statusLabel(o)}
                        </span>
                        {o.digiflazz_status && (
                          <div className="text-[10px] font-mono">
                            <span
                              className={`inline-block font-bold px-1.5 py-0.5 border ${
                                o.digiflazz_status === "Sukses"
                                  ? "text-lime border-lime/40 bg-lime/10"
                                  : o.digiflazz_status === "Gagal"
                                    ? "text-coral border-coral/40 bg-coral/10"
                                    : "text-amber-300 border-amber-400/40 bg-amber-400/10"
                              }`}
                            >
                              DF: {o.digiflazz_status}
                            </span>
                            {o.digiflazz_sn && (
                              <p className="text-lime break-all mt-0.5">SN: {o.digiflazz_sn}</p>
                            )}
                            {!o.digiflazz_sn && o.digiflazz_message && (
                              <p className="text-slate-400 break-words max-w-[180px] mt-0.5">{o.digiflazz_message}</p>
                            )}
                          </div>
                        )}
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
                          {o.payment_status === "paid" && (
                            <button
                              onClick={() => orderAction(o, "check_digiflazz")}
                              disabled={busy === o.session_id}
                              data-testid={`admin-topup-check-df-${o.session_id}`}
                              title="Cek status transaksi atau kirim ke Digiflazz"
                              className="text-[10px] uppercase tracking-widest border border-neon/50 text-neon hover:bg-neon/10 px-2 py-1.5 transition-colors disabled:opacity-50"
                            >
                              {o.digiflazz_status ? "Cek Digiflazz" : "Kirim Digiflazz"}
                            </button>
                          )}
                          {o.payment_status === "paid" && o.status !== "delivered" && (
                            <button
                              onClick={() => orderAction(o, "complete", { note: "Pesanan telah dikirim dan diproses", dispatch: false })}
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
                              Cek Bayar
                            </button>
                          )}
                          {o.payment_status !== "paid" && (
                            <button
                              onClick={() => orderAction(o, "delete")}
                              disabled={busy === o.session_id}
                              data-testid={`admin-topup-delete-${o.session_id}`}
                              title="Hapus order yang belum dibayar"
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest border border-coral/50 bg-coral/10 text-coral hover:bg-coral hover:text-white px-2 py-1.5 transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={11} /> Hapus
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
            onCheckSkuHealth={checkSkuHealth}
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="g-icon" className={labelCls}>URL Icon (PostgreSQL: wjp_games.icon)</label>
                    <label className="inline-flex items-center gap-1 text-[10px] font-mono text-neon hover:text-lime cursor-pointer">
                      {uploadingField === "icon" ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                      <span>Upload Icon</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => uploadGameImage("icon", e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    {form.icon ? (
                      <img
                        src={imgSrc(form.icon)}
                        alt="Preview Icon"
                        className="w-10 h-10 rounded-lg object-cover border border-line bg-void shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-dashed border-line bg-void flex items-center justify-center text-[9px] font-mono text-slate-600 shrink-0">
                        ICON
                      </div>
                    )}
                    <input
                      id="g-icon"
                      data-testid="game-icon-url"
                      value={form.icon || ""}
                      onChange={(e) => patch({ icon: e.target.value })}
                      className={`${inputCls} !mt-0`}
                      placeholder="https://... atau /uploads/..."
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="g-banner" className={labelCls}>URL Banner (PostgreSQL: wjp_games.banner)</label>
                    <label className="inline-flex items-center gap-1 text-[10px] font-mono text-neon hover:text-lime cursor-pointer">
                      {uploadingField === "banner" ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                      <span>Upload Banner</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => uploadGameImage("banner", e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    {form.banner ? (
                      <img
                        src={imgSrc(form.banner)}
                        alt="Preview Banner"
                        className="w-16 h-10 rounded-lg object-cover border border-line bg-void shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-10 rounded-lg border border-dashed border-line bg-void flex items-center justify-center text-[9px] font-mono text-slate-600 shrink-0">
                        BANNER
                      </div>
                    )}
                    <input
                      id="g-banner"
                      data-testid="game-banner-url"
                      value={form.banner || ""}
                      onChange={(e) => patch({ banner: e.target.value })}
                      className={`${inputCls} !mt-0`}
                      placeholder="https://... atau /uploads/..."
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="g-vprefix" className={labelCls}>Prefix Pencocokan Digiflazz</label>
                  <input id="g-vprefix" data-testid="game-vendor-prefix" value={form.vendor_prefix || ""} onChange={(e) => patch({ vendor_prefix: e.target.value.toUpperCase() })} className={inputCls} placeholder="ML" />
                  <p className="mt-1 text-[10px] font-mono text-slate-600">Dipakai untuk mencocokkan produk saat menarik pricelist dari API Digiflazz.</p>
                </div>
                <div>
                  <label htmlFor="g-cekid" className={labelCls}>Kode SKU Cek ID Digiflazz (buyer_sku_code)</label>
                  <input
                    id="g-cekid"
                    data-testid="game-cek-id-sku"
                    value={form.cek_id_sku || ""}
                    onChange={(e) => patch({ cek_id_sku: e.target.value.toUpperCase() })}
                    className={inputCls}
                    placeholder="Contoh: CEKML, CEKFF, CEKGI, CEKZZZ"
                  />
                  <p className="mt-1 text-[10px] font-mono text-slate-600">
                    Kode SKU Digiflazz untuk fitur tombol Cek ID / Nickname pada game ini (tersimpan di PostgreSQL).
                  </p>
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

              {/* destination fields (Built-in Digiflazz Read-Only Preset) */}
              <div
                data-testid="admin-builtin-destination-fields"
                className="rounded-xl border border-line bg-void/60 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold uppercase text-xs text-slate-100">
                        Field Tujuan Bawaan Digiflazz
                      </p>
                      <span className="text-[10px] font-mono text-lime uppercase tracking-wider">
                        &bull; Otomatis &amp; Terintegrasi
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Struktur input tujuan pengguna disesuaikan otomatis dengan standar H2H Digiflazz berdasarkan katalog game &amp; prefix.
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-slate-300 bg-panel border border-line rounded-lg px-2.5 py-1.5">
                    Format <span className="text-neon">customer_no</span>:{" "}
                    <strong className="text-slate-100">
                      {resolveCustomerNoFormatLabel(builtInFieldsForForm)}
                    </strong>
                  </div>
                </div>

                <div
                  className={`grid gap-2.5 ${
                    builtInFieldsForForm.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {builtInFieldsForForm.map((f, i) => (
                    <div
                      key={f.key || i}
                      data-testid={`builtin-field-row-${f.key || i}`}
                      className="rounded-lg border border-line/80 bg-panel/80 p-3 space-y-1.5 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-slate-100">
                          {f.label}
                          {f.required !== false && <span className="text-neon ml-1">*</span>}
                        </span>
                        <span className="text-[10px] text-neon">
                          key: <strong>{f.key}</strong>
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          Tipe: <strong className="text-slate-300">{Array.isArray(f.options) && f.options.length ? "Pilihan Server" : f.inputmode || "text"}</strong>
                        </span>
                        <span>&middot;</span>
                        <span>
                          Contoh: <strong className="text-slate-300">{f.placeholder || "-"}</strong>
                        </span>
                        {(f.min_len || f.max_len) ? (
                          <>
                            <span>&middot;</span>
                            <span className="tabular-nums">
                              Panjang: <strong className="text-slate-300">{f.min_len || 1}–{f.max_len || 32}</strong> karakter
                            </span>
                          </>
                        ) : null}
                      </div>
                      {Array.isArray(f.options) && f.options.length > 0 && (
                        <p className="text-[10px] text-lime/90">
                          Opsi Server: {f.options.join(" · ")}
                        </p>
                      )}
                      {f.help && (
                        <p className="text-[10px] text-slate-500">{f.help}</p>
                      )}
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
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-void/60 border border-line p-2.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Menu Kategori SKU Digiflazz:
                      </span>
                      <div className="inline-flex items-center gap-1 bg-void border border-line p-1">
                        {[
                          { id: "all", label: `Semua (${form.denominations.length})` },
                          {
                            id: "currency",
                            label: `${form.currency || "Item"} (${form.denominations.filter((x) => resolveSkuGroup(x) === "currency").length})`,
                          },
                          {
                            id: "membership",
                            label: `Membership (${form.denominations.filter((x) => resolveSkuGroup(x) === "membership").length})`,
                          },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setAdminDenomTab(t.id)}
                            data-testid={`admin-denom-tab-${t.id}`}
                            className={`px-2.5 py-1 text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                              adminDenomTab === t.id
                                ? "bg-neon text-void"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.denominations.map((d, i) => {
                      const currentGroup = resolveSkuGroup(d);
                      if (adminDenomTab !== "all" && currentGroup !== adminDenomTab) return null;
                      return (
                        <div key={d.vendor_sku || d.code || i} data-testid={`denom-row-${i}`} className={`border p-3 ${d.digiflazz_problem ? "border-coral/50 bg-coral/5" : "border-line bg-void/30"}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-line/60">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-neon border border-neon/40 bg-neon/10 px-2 py-0.5" data-testid={`denom-sku-${i}`}>
                                SKU: {d.vendor_sku}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                                  currentGroup === "membership"
                                    ? "text-lime border-lime/40 bg-lime/10"
                                    : "text-slate-300 border-line bg-void"
                                }`}
                              >
                                {currentGroup === "membership" ? "Membership" : form.currency || "Item"}
                              </span>
                              {d.digiflazz_problem && (
                                <span
                                  data-testid={`denom-problem-${i}`}
                                  title={d.digiflazz_status_note || "SKU sedang gangguan di Digiflazz dan otomatis disembunyikan"}
                                  className="text-[10px] font-mono font-bold text-coral border border-coral/50 bg-coral/15 px-2 py-0.5"
                                >
                                  Gangguan Digiflazz (Auto-Hide)
                                </span>
                              )}
                              <span className="text-xs font-display font-bold text-slate-100">
                                {d.label}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400" data-testid={`denom-modal-${i}`}>
                              Modal Digiflazz: <strong className="text-slate-200">{formatIDR(d.modal_price || 0)}</strong>
                            </span>
                          </div>

                          <div className="grid sm:grid-cols-3 gap-3">
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
                            <div>
                              <label className={labelCls}>Menu Kategori SKU</label>
                              <select
                                value={currentGroup}
                                onChange={(e) => patchDenom(i, { sku_group: e.target.value })}
                                data-testid={`denom-group-${i}`}
                                className={inputCls}
                              >
                                <option value="currency">{form.currency || "Item"} (Currency Game)</option>
                                <option value="membership">Membership</option>
                              </select>
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
                      );
                    })}
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
                            const isMembership = resolveSkuGroup(d) === "membership";
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
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 border ${
                                      isMembership
                                        ? "text-lime border-lime/40 bg-lime/10"
                                        : "text-slate-300 border-line bg-void"
                                    }`}
                                  >
                                    {isMembership ? "Membership" : g.currency || "Item"}
                                  </span>
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
                  const isMembership = resolveSkuGroup(r) === "membership";
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
                          <div className="flex items-center gap-1.5">
                            <p className="text-neon font-bold truncate">{r.sku}</p>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 border shrink-0 ${
                                isMembership
                                  ? "text-lime border-lime/40 bg-lime/10"
                                  : "text-slate-300 border-line bg-void"
                              }`}
                            >
                              {isMembership ? "Membership" : game.currency || "Item"}
                            </span>
                          </div>
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
const IntegrationSummary = ({ integration, onCheckBalance, onCheckSkuHealth, onImport, busy }) => {
  if (!integration) {
    return (
      <div data-testid="admin-topup-integration" className="border border-line bg-panel p-4">
        <p className="text-[11px] font-mono text-slate-500">Memuat ringkasan integrasi...</p>
      </div>
    );
  }
  const {
    active = {},
    balance = {},
    orders = {},
    sku_health: skuHealth = {},
    webhook_logs: webhookLogs = [],
    games_without_sku: missing = [],
  } = integration;
  const sourceLabel =
    active.source === "db" ? "database" : active.source === "env" ? "file .env" : "belum diatur";
  const webhookUrl =
    active.webhook_url || `${window.location.origin}/api/webhook/digiflazz`;
  const callbackUrl =
    active.callback_url || `${window.location.origin}/api/callback/digiflazz`;
  const problemSkus = Number(skuHealth.problem_skus || 0);
  const healthySkus = Number(skuHealth.healthy_skus || 0);
  const totalSkus = Number(skuHealth.total_skus || 0);
  const problemItems = Array.isArray(skuHealth.problem_items) ? skuHealth.problem_items : [];

  const copyText = (url, label) => {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success(`${label} berhasil disalin`));
  };

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
            Auto-kirim saat lunas:{" "}
            <span className={active.auto_dispatch ? "text-lime" : "text-slate-400"}>
              {active.auto_dispatch ? "aktif" : "nonaktif"}
            </span>
          </p>
        </div>

        <div
          className={`border p-4 ${
            balance.low_balance_alert ? "border-coral/50 bg-coral/5" : "border-line bg-panel"
          }`}
          data-testid="integration-balance"
        >
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Saldo Supplier</p>
          <p className="font-display font-bold text-lg mt-1 text-slate-100">
            {balance.supported && balance.ok
              ? `Rp ${new Intl.NumberFormat("id-ID").format(Number(balance.balance) || 0)}`
              : "—"}
          </p>
          {balance.supported && (
            <p className="text-[10px] font-mono text-slate-400 mt-1" data-testid="integration-reserved-modal">
              Terkunci ({Number(balance.active_orders) || 0} pesanan aktif):{" "}
              <span className="text-neon">
                Rp {new Intl.NumberFormat("id-ID").format(Number(balance.reserved_modal) || 0)}
              </span>
            </p>
          )}
          <p className={`text-[10px] font-mono mt-0.5 ${balance.supported && balance.ok ? "text-lime" : "text-slate-500"}`}>
            {balance.supported ? (balance.ok ? "Tersinkron (proteksi checkout aktif)" : balance.message || "Tidak tersedia") : "Tidak didukung"}
          </p>
          {balance.supported && (
            <button
              type="button"
              onClick={onCheckBalance}
              disabled={Boolean(busy)}
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
            {orders.digiflazz_pending ?? 0} pending DF • {orders.digiflazz_failed ?? 0} gagal DF
          </p>
        </div>

        <div
          className={`border p-4 ${problemSkus > 0 ? "border-coral/40 bg-coral/5" : "border-line bg-panel"}`}
          data-testid="integration-sku"
        >
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Kesehatan SKU (Cek Tiap 5 Menit)
          </p>
          {problemSkus > 0 ? (
            <>
              <p className="font-display font-bold text-lg mt-1 text-coral">
                {problemSkus} SKU Gangguan (Auto-Hide)
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                {healthySkus} dari {totalSkus} SKU aktif normal
              </p>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-lg mt-1 text-lime">
                {totalSkus > 0 ? `${healthySkus} SKU Normal` : "Siap Pantau"}
              </p>
              <p className="text-[10px] font-mono text-slate-500 mt-1">
                Auto-hide gangguan &amp; auto-unhide saat normal
              </p>
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {onCheckSkuHealth && (
              <button
                type="button"
                onClick={onCheckSkuHealth}
                disabled={busy === "sku-health"}
                data-testid="integration-check-sku-health-btn"
                className="text-[10px] uppercase tracking-widest border border-lime/50 text-lime hover:bg-lime/10 px-2 py-1 transition-colors disabled:opacity-50"
              >
                {busy === "sku-health" ? "Mengecek..." : "Cek Gangguan Sekarang"}
              </button>
            )}
            {skuHealth.last_checked_at && (
              <span className="text-[9px] font-mono text-slate-500">
                Cek: {new Date(skuHealth.last_checked_at).toLocaleTimeString("id-ID")}
              </span>
            )}
          </div>
        </div>
      </div>

      {balance.low_balance_alert && (
        <div
          className="border border-coral/50 bg-coral/10 px-4 py-3 text-xs font-mono text-coral flex flex-wrap items-center justify-between gap-2"
          data-testid="digiflazz-low-balance-alert"
        >
          <div>
            <strong>Peringatan Saldo Digiflazz Tidak Cukup:</strong> Checkout Top Up terakhir ({balance.low_balance_alert.game_name} — {balance.low_balance_alert.item_label}, kode SKU <span className="text-slate-100">{balance.low_balance_alert.sku}</span>) otomatis dibatalkan sebelum membuat tagihan karena total modal dibutuhkan{" "}
            <strong className="text-slate-100">
              Rp {new Intl.NumberFormat("id-ID").format(Number(balance.low_balance_alert.required_total) || 0)}
            </strong>{" "}
            (modal item Rp {new Intl.NumberFormat("id-ID").format(Number(balance.low_balance_alert.item_modal) || 0)} + terkunci pesanan aktif Rp {new Intl.NumberFormat("id-ID").format(Number(balance.low_balance_alert.reserved_modal) || 0)}) melebihi saldo Digiflazz saat itu{" "}
            <strong className="text-slate-100">
              Rp {new Intl.NumberFormat("id-ID").format(Number(balance.low_balance_alert.current_balance) || 0)}
            </strong>.
          </div>
          {balance.low_balance_alert.at && (
            <span className="text-[10px] text-slate-300 shrink-0">
              {new Date(balance.low_balance_alert.at).toLocaleString("id-ID")}
            </span>
          )}
        </div>
      )}

      {/* Digiflazz Webhook & Callback Endpoint Box */}
      <div className="border border-neon/30 bg-panel p-4 space-y-2.5" data-testid="digiflazz-webhook-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-display font-bold uppercase tracking-wider text-neon">
              Webhook &amp; Callback Transaksi Digiflazz
            </p>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Pasang URL di bawah ini pada menu <strong className="text-slate-200">Pengaturan &rarr; Webhook</strong> di dashboard member.digiflazz.com agar status Sukses / Pending / Gagal &amp; SN masuk otomatis.
            </p>
          </div>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-1 border ${
              active.webhook_secret_set
                ? "text-lime border-lime/40 bg-lime/10"
                : "text-neon border-neon/40 bg-neon/10"
            }`}
          >
            {active.webhook_secret_set ? "X-Hub-Signature Aktif" : "Siap Menerima Callback"}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-2.5">
          <div className="flex items-center justify-between gap-2 bg-void border border-line px-3 py-2">
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                URL Webhook Utama
              </p>
              <p className="text-xs font-mono text-slate-200 truncate" data-testid="digiflazz-webhook-url">
                {webhookUrl}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyText(webhookUrl, "URL Webhook Digiflazz")}
              data-testid="copy-digiflazz-webhook-url"
              className="shrink-0 text-[10px] font-mono uppercase tracking-wider border border-neon/50 text-neon hover:bg-neon hover:text-void px-2.5 py-1 transition-colors"
            >
              Salin
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 bg-void border border-line px-3 py-2">
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                URL Callback Alternatif
              </p>
              <p className="text-xs font-mono text-slate-200 truncate" data-testid="digiflazz-callback-url">
                {callbackUrl}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyText(callbackUrl, "URL Callback Digiflazz")}
              data-testid="copy-digiflazz-callback-url"
              className="shrink-0 text-[10px] font-mono uppercase tracking-wider border border-line text-slate-300 hover:border-neon hover:text-neon px-2.5 py-1 transition-colors"
            >
              Salin
            </button>
          </div>
        </div>

        {webhookLogs.length > 0 && (
          <div className="pt-2 border-t border-line/60">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Riwayat Callback Digiflazz Terakhir:
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto text-[10px] font-mono">
              {webhookLogs.slice(0, 5).map((log, idx) => (
                <div key={`${log.ref_id}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 bg-void/50 border border-line/60 px-2.5 py-1">
                  <span className="text-slate-300">
                    <strong>{log.ref_id}</strong> ({log.sku || "-"}) &rarr;{" "}
                    <span
                      className={
                        /^sukses$/i.test(log.status)
                          ? "text-lime font-bold"
                          : /^gagal$/i.test(log.status)
                            ? "text-coral font-bold"
                            : "text-amber-300"
                      }
                    >
                      {log.status}
                    </span>
                    {log.sn ? ` • SN: ${log.sn}` : ""}
                  </span>
                  <span className="text-slate-500">
                    {log.at ? new Date(log.at).toLocaleTimeString("id-ID") : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Currently Auto-Hidden Problem SKUs Alert */}
      {problemItems.length > 0 && (
        <div className="border border-coral/40 bg-coral/5 p-3 space-y-2" data-testid="integration-problem-skus">
          <p className="flex items-start gap-2 text-[11px] font-mono text-coral font-bold">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-coral" />
            <span>
              {problemSkus} SKU sedang mengalami gangguan di Digiflazz dan otomatis di-hide dari halaman pembeli (akan tampil kembali otomatis saat normal pada cek 5 menit berikutnya):
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {problemItems.slice(0, 12).map((item) => (
              <span
                key={`${item.game_slug}-${item.sku}`}
                className="text-[10px] font-mono border border-coral/40 bg-void/70 text-slate-200 px-2 py-1"
              >
                <strong className="text-coral">{item.sku}</strong> ({item.game_name} — {item.label}): {item.reason}
              </span>
            ))}
          </div>
        </div>
      )}

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
