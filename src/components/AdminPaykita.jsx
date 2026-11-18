import { useState, useEffect } from "react";
import {
  Loader2,
  Save,
  Copy,
  Webhook,
  KeyRound,
  CheckCircle2,
  PlugZap,
  Zap,
  Info,
  ShieldCheck,
  CreditCard,
  Globe,
  Building2,
  Package,
  Gamepad2,
  QrCode,
  Wallet,
  Landmark,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";

export const DUITKU_CHANNELS_CATALOG = [
  // QRIS
  {
    code: "SP",
    name: "QRIS All Payment (ShopeePay)",
    category: "qris",
    categoryLabel: "QRIS Instan",
    desc: "Scan dari DANA, OVO, GoPay, ShopeePay & M-Banking",
  },
  {
    code: "NQ",
    name: "QRIS Nobu Bank",
    category: "qris",
    categoryLabel: "QRIS Instan",
    desc: "QRIS Nasional via Nobu Bank",
  },
  {
    code: "DQ",
    name: "QRIS DANA",
    category: "qris",
    categoryLabel: "QRIS Instan",
    desc: "QRIS Dinamis via DANA",
  },
  {
    code: "LA",
    name: "QRIS LinkAja",
    category: "qris",
    categoryLabel: "QRIS Instan",
    desc: "QRIS Dinamis via LinkAja",
  },
  {
    code: "GQ",
    name: "QRIS GudangVoucher",
    category: "qris",
    categoryLabel: "QRIS Instan",
    desc: "QRIS Dinamis via GudangVoucher",
  },
  // E-Wallet
  {
    code: "DA",
    name: "DANA",
    category: "ewallet",
    categoryLabel: "E-Wallet Instan",
    desc: "Bayar langsung via aplikasi DANA",
  },
  {
    code: "OV",
    name: "OVO",
    category: "ewallet",
    categoryLabel: "E-Wallet Instan",
    desc: "Push notifikasi / aplikasi OVO",
  },
  {
    code: "SA",
    name: "ShopeePay Apps",
    category: "ewallet",
    categoryLabel: "E-Wallet Instan",
    desc: "Bayar langsung via aplikasi Shopee",
  },
  {
    code: "LF",
    name: "LinkAja Apps",
    category: "ewallet",
    categoryLabel: "E-Wallet Instan",
    desc: "Bayar langsung via aplikasi LinkAja",
  },
  // Virtual Account Bank
  {
    code: "BC",
    name: "BCA Virtual Account",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via myBCA / BCA Mobile / ATM",
  },
  {
    code: "M2",
    name: "Mandiri Virtual Account",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via Livin' by Mandiri / ATM",
  },
  {
    code: "I1",
    name: "BNI Virtual Account",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via Wondr / BNI Mobile / ATM",
  },
  {
    code: "BR",
    name: "BRI Virtual Account (BRIVA)",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via BRImo / ATM BRI",
  },
  {
    code: "BV",
    name: "BSI Virtual Account",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via BYOND / BSI Mobile",
  },
  {
    code: "B1",
    name: "CIMB Niaga Virtual Account",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via OCTO Mobile / ATM",
  },
  {
    code: "BT",
    name: "Permata Bank Virtual Account",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via PermataME / ATM",
  },
  {
    code: "VA",
    name: "Maybank Virtual Account",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via M2U ID / ATM",
  },
  {
    code: "NC",
    name: "Bank Neo Commerce (BNC) VA",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Otomatis via aplikasi neobank",
  },
  {
    code: "A1",
    name: "ATM Bersama Virtual Account",
    category: "va",
    categoryLabel: "Virtual Account Bank",
    desc: "Transfer dari semua bank jaringan ATM Bersama",
  },
  // Retail / Minimarket
  {
    code: "IR",
    name: "Indomaret",
    category: "retail",
    categoryLabel: "Minimarket / Retail",
    desc: "Bayar tunai di gerai Indomaret",
  },
  {
    code: "FT",
    name: "Alfamart / Alfamidi / Pos",
    category: "retail",
    categoryLabel: "Minimarket / Retail",
    desc: "Bayar tunai di gerai Alfamart Group",
  },
];

const ALL_DUITKU_CODES = DUITKU_CHANNELS_CATALOG.map((c) => c.code);

const GATEWAY_CATALOG = [
  {
    id: "paykita",
    name: "PayKita",
    scope: "beranda",
    scopeLabel: "Produk Beranda & Top Up",
    tagline: "QRIS Otomatis Produk Beranda & Opsi Utama QRIS Top Up",
    badge: "Beranda & Top Up",
    description:
      "Digunakan untuk pembayaran QRIS otomatis pada Katalog Produk Beranda (Akun Game, Jasa Joki, Item Game, & Voucher) serta menjadi opsi utama pada kategori QRIS Instan di halaman Produk Top Up bersama Duitku.",
    defaultBaseUrl: "https://pay.digikita.id",
    docsHint:
      "Salin API Key (pk_live_...) & Webhook Secret dari Dashboard PayKita → Projects.",
  },
  {
    id: "duitku",
    name: "Duitku",
    scope: "topup",
    scopeLabel: "Khusus Produk Top Up",
    tagline: "Multi-Metode Pembayaran Produk Top Up (QRIS, E-Wallet, VA, Retail)",
    badge: "Produk Top Up",
    description:
      "Digunakan khusus untuk seluruh pembayaran otomatis Produk Top Up Game. Mendukung banyak metode pembayaran sekaligus: QRIS, E-Wallet (DANA, OVO, ShopeePay, LinkAja), Virtual Account Bank (BCA, Mandiri, BNI, BRI, BSI, dll), serta Minimarket (Indomaret & Alfamart).",
    defaultBaseUrl: "https://passport.duitku.com/webapi",
    sandboxBaseUrl: "https://sandbox.duitku.com/webapi",
    channels: DUITKU_CHANNELS_CATALOG.map((c) => ({
      code: c.code,
      label: `${c.code} — ${c.name} (${c.categoryLabel})`,
    })),
    docsHint:
      "Masukkan Merchant Code (DXXXX), API Key, dan pilih metode pembayaran Duitku yang diaktifkan untuk halaman Top Up.",
  },
];

const DUITKU_CATEGORY_GROUPS = [
  { id: "qris", label: "QRIS Instan", icon: QrCode },
  { id: "ewallet", label: "E-Wallet Instan", icon: Wallet },
  { id: "va", label: "Virtual Account Bank", icon: Landmark },
  { id: "retail", label: "Minimarket / Retail", icon: Store },
];

export function AdminPaykita() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [selectedTab, setSelectedTab] = useState("paykita");
  const [gatewaysMap, setGatewaysMap] = useState({});

  // Form states for the currently selected tab
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState("production");
  const [baseUrl, setBaseUrl] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("SP");
  const [enabledMethods, setEnabledMethods] = useState(ALL_DUITKU_CODES);
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [testResult, setTestResult] = useState(null);

  const syncFormWithTab = (tabId, mapData) => {
    const meta =
      GATEWAY_CATALOG.find((g) => g.id === tabId) || GATEWAY_CATALOG[0];
    const gw = mapData?.[tabId] || {};
    setEnabled(gw.enabled !== undefined ? Boolean(gw.enabled) : true);
    setMode(gw.mode || "production");
    setBaseUrl(gw.base_url || meta.defaultBaseUrl || "");
    setMerchantCode(gw.merchant_code || "");
    setPaymentMethod(gw.payment_method || "SP");
    setEnabledMethods(
      Array.isArray(gw.enabled_methods) && gw.enabled_methods.length > 0
        ? gw.enabled_methods
        : ALL_DUITKU_CODES
    );
    setApiKey("");
    setWebhookSecret("");
    setTestResult(gw.last_test || null);
  };

  const load = async (preserveTab = false) => {
    try {
      const { data } = await api.get("/admin/payments/gateways");
      const gws = data.gateways || {};
      setGatewaysMap(gws);
      const nextTab = preserveTab ? selectedTab : "paykita";
      if (!preserveTab) setSelectedTab(nextTab);
      syncFormWithTab(nextTab, gws);
    } catch (e) {
      try {
        const { data } = await api.get("/admin/payments/paykita");
        const gws = data.gateways || { paykita: data };
        setGatewaysMap(gws);
        const nextTab = preserveTab ? selectedTab : "paykita";
        if (!preserveTab) setSelectedTab(nextTab);
        syncFormWithTab(nextTab, gws);
      } catch (err) {
        toast.error(
          formatApiError(err.response?.data?.detail) ||
            "Gagal memuat pengaturan Payment Gateway"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const handleSelectGatewayTab = (tabId) => {
    setSelectedTab(tabId);
    syncFormWithTab(tabId, gatewaysMap);
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    const meta = GATEWAY_CATALOG.find((g) => g.id === selectedTab);
    if (meta?.sandboxBaseUrl && meta?.defaultBaseUrl) {
      setBaseUrl(
        nextMode === "sandbox" ? meta.sandboxBaseUrl : meta.defaultBaseUrl
      );
    }
  };

  const toggleDuitkuChannel = (code) => {
    setEnabledMethods((prev) => {
      const exists = prev.includes(code);
      if (exists && prev.length <= 1) {
        toast.error("Minimal 1 metode pembayaran Duitku harus tetap aktif");
        return prev;
      }
      const next = exists ? prev.filter((c) => c !== code) : [...prev, code];
      if (!next.includes(paymentMethod)) {
        setPaymentMethod(next[0] || "SP");
      }
      return next;
    });
  };

  const buildPayload = (overrideEnabled) => {
    const nextEnabled =
      typeof overrideEnabled === "boolean" ? overrideEnabled : enabled;
    const payload = {
      enabled: nextEnabled,
      mode,
      base_url: baseUrl.trim(),
      merchant_code: merchantCode.trim(),
      payment_method: paymentMethod,
      enabled_methods: enabledMethods,
    };
    if (apiKey.trim()) payload.api_key = apiKey.trim();
    if (webhookSecret.trim()) payload.webhook_secret = webhookSecret.trim();
    return payload;
  };

  const save = async (overrideEnabled) => {
    setSaving(true);
    try {
      const payload = buildPayload(overrideEnabled);
      const { data } = await api.put(
        `/admin/payments/gateways/${selectedTab}`,
        payload
      );
      const nextGateways = data.gateways || {
        ...gatewaysMap,
        [selectedTab]: data,
      };
      setGatewaysMap(nextGateways);
      const updatedCurrent = nextGateways[selectedTab] || data;
      if (updatedCurrent.last_test) setTestResult(updatedCurrent.last_test);
      setApiKey("");
      setWebhookSecret("");

      const gwMeta = GATEWAY_CATALOG.find((g) => g.id === selectedTab);
      toast.success(
        `Pengaturan ${gwMeta?.name || selectedTab} (${
          gwMeta?.scopeLabel || ""
        }) berhasil disimpan`
      );
    } catch (e) {
      toast.error(
        formatApiError(e.response?.data?.detail) ||
          "Gagal menyimpan pengaturan gateway"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (checked) => {
    setEnabled(checked);
    await save(checked);
  };

  const test = async () => {
    setTesting(true);
    try {
      const payload = buildPayload(true);
      const { data } = await api.post(
        `/admin/payments/gateways/${selectedTab}/test`,
        payload
      );
      if (data.config?.gateways) {
        setGatewaysMap(data.config.gateways);
      }
      setEnabled(true);
      setTestResult(data);
      setApiKey("");
      setWebhookSecret("");
      const gwMeta = GATEWAY_CATALOG.find((g) => g.id === selectedTab);
      toast.success(
        `Terhubung ke ${gwMeta?.name || selectedTab} — ${
          data.project || "Ready"
        } (${data.provider || "-"}, ${data.mode || "-"})`
      );
    } catch (e) {
      setTestResult({
        ok: false,
        error:
          formatApiError(e.response?.data?.detail) || "Tes koneksi gagal",
      });
      toast.error(
        formatApiError(e.response?.data?.detail) || "Tes koneksi gagal"
      );
    } finally {
      setTesting(false);
    }
  };

  const copyWebhook = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL disalin");
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  const currentMeta =
    GATEWAY_CATALOG.find((g) => g.id === selectedTab) || GATEWAY_CATALOG[0];
  const currentCfg = gatewaysMap[selectedTab] || {};
  const isSelectedReady = Boolean(
    enabled && currentCfg.api_key_set && !currentCfg.is_demo_key
  );
  const webhookUrl =
    currentCfg.webhook_url ||
    `${window.location.origin}/api/webhook/${selectedTab}`;

  return (
    <section className="space-y-6" data-testid="admin-paykita">
      {/* Header & Separated Allocation Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[hsl(var(--border))]">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="heading-display text-xl font-semibold">
                Payment Gateway Otomatis
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-neon/15 text-neon border border-neon/30">
                <Package className="w-3 h-3" />
                Beranda: PayKita (QRIS)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-lime/15 text-lime border border-lime/30">
                <Gamepad2 className="w-3 h-3" />
                Top Up: Duitku (Multi-Metode)
              </span>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              <span className="font-semibold text-[hsl(var(--foreground))]">
                PayKita
              </span>{" "}
              digunakan khusus untuk{" "}
              <span className="font-semibold text-neon">Produk Beranda</span>, sedangkan{" "}
              <span className="font-semibold text-[hsl(var(--foreground))]">
                Duitku
              </span>{" "}
              digunakan khusus untuk{" "}
              <span className="font-semibold text-lime">Produk Top Up</span> dengan dukungan multi-metode (QRIS, E-Wallet, Virtual Account, &amp; Minimarket).
            </p>
          </div>
        </div>

        <label
          className="inline-flex items-center gap-3 cursor-pointer select-none px-3.5 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--foreground))]/30 transition-colors self-start sm:self-auto"
          data-testid="paykita-enabled-toggle"
        >
          <span className="text-xs font-semibold">
            {enabled
              ? `${currentMeta.name} (${currentMeta.badge}) Aktif`
              : `${currentMeta.name} (${currentMeta.badge}) Nonaktif`}
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
            disabled={saving}
            className="sr-only peer"
            data-testid="paykita-enabled-checkbox"
          />
          <div className="w-10 h-5 bg-[hsl(var(--muted))] peer-checked:bg-[hsl(var(--accent))] rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>

      {/* 2 Dedicated Gateway Selector Cards: PayKita (Beranda) & Duitku (Top Up) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Pilih Gateway untuk Dikonfigurasi
          </label>
          <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
            PayKita = Produk Beranda &bull; Duitku = Produk Top Up (Multi-Payment)
          </span>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
          data-testid="payment-gateway-selector"
        >
          {GATEWAY_CATALOG.map((gw) => {
            const gwState = gatewaysMap[gw.id] || {};
            const isTabSelected = selectedTab === gw.id;
            const isGwEnabled = gwState.enabled !== false;
            const isLiveConfigured = Boolean(
              gwState.api_key_set && !gwState.is_demo_key
            );
            const ScopeIcon = gw.scope === "topup" ? Gamepad2 : Package;

            return (
              <button
                key={gw.id}
                type="button"
                onClick={() => handleSelectGatewayTab(gw.id)}
                data-testid={`gateway-tab-${gw.id}`}
                className={`group text-left p-4 rounded-2xl border transition-all relative flex flex-col justify-between min-h-[116px] cursor-pointer ${
                  isTabSelected
                    ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/8 shadow-sm ring-1 ring-[hsl(var(--accent))]/30"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--foreground))]/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                        isTabSelected
                          ? "bg-[hsl(var(--accent))] text-white"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                      }`}
                    >
                      <ScopeIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold leading-tight text-[hsl(var(--foreground))]">
                          {gw.name}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            gw.scope === "topup"
                              ? "bg-lime/15 text-lime border-lime/30"
                              : "bg-neon/15 text-neon border-neon/30"
                          }`}
                        >
                          {gw.scopeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                        {gw.tagline}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      isGwEnabled
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/25"
                        : "bg-rose-500/15 text-rose-500 border-rose-500/25"
                    }`}
                  >
                    {isGwEnabled ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[hsl(var(--border))]/60 flex items-center justify-between w-full text-[11px]">
                  <span className="text-[hsl(var(--muted-foreground))] truncate">
                    {gw.scope === "beranda"
                      ? "QRIS Otomatis Beranda & Opsi Utama QRIS Top Up"
                      : `${(gwState.enabled_methods || ALL_DUITKU_CODES).length} Metode Pembayaran Top Up Aktif`}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] shrink-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isLiveConfigured ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                    {isLiveConfigured ? "API Live" : "Mode Simulasi"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Gateway Status Banner */}
      <div
        className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
          isSelectedReady
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/35"
        }`}
        data-testid="paykita-status-banner"
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isSelectedReady
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[hsl(var(--foreground))]">
                {currentMeta.name} ({currentMeta.scopeLabel}) —{" "}
                {isSelectedReady
                  ? "API Live Terkonfigurasi & Siap Digunakan"
                  : "Mode Simulasi / Demo Otomatis"}
              </p>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                  currentMeta.scope === "topup"
                    ? "bg-lime/15 text-lime"
                    : "bg-neon/15 text-neon"
                }`}
              >
                {currentMeta.scopeLabel}
              </span>
            </div>
            <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
              {currentMeta.description}
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Form for Selected Gateway (PayKita or Duitku) */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[hsl(var(--border))]">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[hsl(var(--accent))]" />
              Konfigurasi Kredensial {currentMeta.name} ({currentMeta.scopeLabel})
            </h3>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
              {currentMeta.docsHint}
            </p>
          </div>

          {selectedTab === "duitku" && (
            <div className="inline-flex items-center rounded-xl p-1 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleModeChange("production")}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  mode === "production"
                    ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))]"
                }`}
              >
                Production (Live)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("sandbox")}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  mode === "sandbox"
                    ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))]"
                }`}
              >
                Sandbox (Testing)
              </button>
            </div>
          )}
        </div>

        {/* Duitku Merchant Code & Default Channel Row */}
        {selectedTab === "duitku" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                Merchant Code Duitku
              </label>
              <input
                type="text"
                value={merchantCode}
                onChange={(e) => setMerchantCode(e.target.value)}
                placeholder="Contoh: D12345 / DS12345"
                data-testid="gateway-merchant-code-input"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs font-mono focus:outline-none focus:border-[hsl(var(--foreground))]"
              />
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Kode unik proyek dari menu Project Saya di Duitku untuk transaksi Top Up Game.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                Metode Pembayaran Default (Utama)
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const val = e.target.value;
                  setPaymentMethod(val);
                  if (!enabledMethods.includes(val)) {
                    setEnabledMethods((prev) => [...prev, val]);
                  }
                }}
                data-testid="gateway-channel-select"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs font-medium focus:outline-none focus:border-[hsl(var(--foreground))]"
              >
                {(currentMeta.channels || []).map((ch) => (
                  <option key={ch.code} value={ch.code}>
                    {ch.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Metode yang otomatis terpilih pertama kali saat pembeli membuka checkout Top Up.
              </p>
            </div>
          </div>
        )}

        {/* Duitku Multi-Payment Methods Selector */}
        {selectedTab === "duitku" && (
          <div
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/25 p-4 space-y-4"
            data-testid="duitku-multi-methods-section"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[hsl(var(--border))]">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--foreground))]">
                  Daftar Metode Pembayaran Duitku yang Diaktifkan ({enabledMethods.length}/{ALL_DUITKU_CODES.length})
                </h4>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Klik metode di bawah untuk mengaktifkan atau menonaktifkan pilihan pembayaran di halaman Top Up Game.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEnabledMethods(ALL_DUITKU_CODES)}
                  data-testid="duitku-enable-all-methods"
                  className="px-3 py-1.5 rounded-xl bg-lime/15 text-lime border border-lime/30 text-[11px] font-semibold hover:bg-lime/25 transition-colors cursor-pointer"
                >
                  Aktifkan Semua ({ALL_DUITKU_CODES.length})
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {DUITKU_CATEGORY_GROUPS.map((grp) => {
                const GroupIcon = grp.icon;
                const channelsInGroup = DUITKU_CHANNELS_CATALOG.filter(
                  (c) => c.category === grp.id
                );
                return (
                  <div key={grp.id} className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--foreground))]">
                      <GroupIcon className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
                      <span>{grp.label}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {channelsInGroup.map((ch) => {
                        const isChActive = enabledMethods.includes(ch.code);
                        const isDefault = paymentMethod === ch.code;
                        return (
                          <button
                            key={ch.code}
                            type="button"
                            onClick={() => toggleDuitkuChannel(ch.code)}
                            data-testid={`duitku-channel-toggle-${ch.code}`}
                            className={`flex items-start justify-between gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isChActive
                                ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-2xs"
                                : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 text-[hsl(var(--muted-foreground))] opacity-60 hover:opacity-90"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]">
                                  {ch.code}
                                </span>
                                <span className="text-xs font-semibold truncate">
                                  {ch.name}
                                </span>
                                {isDefault && isChActive && (
                                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-lime/20 text-lime">
                                    Utama
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 truncate">
                                {ch.desc}
                              </p>
                            </div>
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                isChActive
                                  ? "text-emerald-500"
                                  : "text-[hsl(var(--muted-foreground))]/40"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary API Key & Webhook Secret */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              {selectedTab === "duitku" ? "API Key Duitku" : "API Key PayKita"}
              {currentCfg.api_key_set && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-normal">
                  <CheckCircle2 className="w-3 h-3" /> tersimpan (
                  {currentCfg.api_key_masked})
                </span>
              )}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                currentCfg.api_key_set
                  ? "Biarkan kosong jika tidak ingin mengubah"
                  : selectedTab === "duitku"
                  ? "Masukkan API Key Project Duitku (32 karakter)"
                  : "pk_live_xxxxxxxxxxxxxxxx"
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs font-mono focus:outline-none focus:border-[hsl(var(--foreground))]"
              data-testid="paykita-api-key-input"
            />
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {selectedTab === "duitku"
                ? "Digunakan untuk membuat signature MD5 transaksi Top Up & cek status otomatis."
                : "Kunci rahasia autentikasi pembuatan QRIS otomatis Produk Beranda."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <Webhook className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              {selectedTab === "duitku"
                ? "Callback Secret (Opsional)"
                : "Webhook Secret PayKita"}
              {currentCfg.secret_set && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-normal">
                  <CheckCircle2 className="w-3 h-3" /> tersimpan
                </span>
              )}
            </label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={
                currentCfg.secret_set
                  ? "Biarkan kosong jika tidak ingin mengubah"
                  : selectedTab === "duitku"
                  ? "Otomatis diverifikasi dengan API Key MD5"
                  : "whsec_xxxxxxxxxxxxxxxx"
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs font-mono focus:outline-none focus:border-[hsl(var(--foreground))]"
              data-testid="paykita-webhook-secret-input"
            />
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {selectedTab === "duitku"
                ? "Duitku memverifikasi callback menggunakan MD5(merchantCode + amount + orderId + apiKey)."
                : "Memvalidasi tanda tangan notifikasi pembayaran otomatis dari PayKita."}
            </p>
          </div>
        </div>

        {/* Base URL & Webhook Callback URL */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">
              Base URL Server {currentMeta.name}
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={currentMeta.defaultBaseUrl}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs font-mono focus:outline-none focus:border-[hsl(var(--foreground))]"
              data-testid="paykita-base-url-input"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">
              Callback / Webhook URL ({currentMeta.name})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-xs font-mono text-[hsl(var(--muted-foreground))]"
                data-testid="paykita-webhook-url"
              />
              <button
                type="button"
                onClick={() => copyWebhook(webhookUrl)}
                className="px-3 py-2 rounded-xl border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors inline-flex items-center gap-1.5 text-xs font-medium shrink-0"
                data-testid="paykita-copy-webhook"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Test Result Box */}
      {testResult && (
        <div
          className={`rounded-2xl p-4 text-xs border ${
            testResult.ok
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-300"
          }`}
          data-testid="paykita-test-result"
        >
          {testResult.ok ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="font-semibold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Koneksi {currentMeta.name}{" "}
                Berhasil
              </span>
              <span>
                Project:{" "}
                <strong className="font-mono">
                  {testResult.project || "-"}
                </strong>
              </span>
              <span>
                Provider:{" "}
                <strong className="font-mono">
                  {testResult.provider || "-"}
                </strong>
              </span>
              <span>
                Mode:{" "}
                <strong className="font-mono uppercase">
                  {testResult.mode || "-"}
                </strong>
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Gagal terhubung ke {currentMeta.name}:{" "}
                {testResult.error || "Periksa kembali kredensial API Anda"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={test}
            disabled={testing || saving}
            className="px-4 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs font-semibold inline-flex items-center gap-2 hover:border-[hsl(var(--foreground))]/40 disabled:opacity-50 transition-colors cursor-pointer"
            data-testid="paykita-test-button"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlugZap className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
            )}
            Tes Koneksi &amp; Simpan {currentMeta.name}
          </button>

          <button
            type="button"
            onClick={() => save(undefined)}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))] text-xs font-semibold inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            data-testid="paykita-save-button"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Simpan Pengaturan {currentMeta.name}
          </button>
        </div>
      </div>
    </section>
  );
}
