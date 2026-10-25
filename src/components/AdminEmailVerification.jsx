import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  Save,
  MailCheck,
  KeyRound,
  Server,
  CheckCircle2,
  PlugZap,
  ShieldCheck,
  Send,
  RefreshCw,
  Info,
  AlertTriangle,
  Trash2,
  Sparkles,
  Eye,
  RotateCcw,
  Palette,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";

const SMTP_PRESETS = [
  { label: "Gmail (TLS 587)", host: "smtp.gmail.com", port: 587, secure: false },
  { label: "Gmail (SSL 465)", host: "smtp.gmail.com", port: 465, secure: true },
  { label: "Brevo SMTP", host: "smtp-relay.brevo.com", port: 587, secure: false },
  { label: "Mailgun SMTP", host: "smtp.mailgun.org", port: 587, secure: false },
  { label: "Hostinger / cPanel", host: "smtp.hostinger.com", port: 465, secure: true },
];

const ACCENT_PRESETS = [
  { label: "Cyber Cyan", color: "#00F0FF" },
  { label: "Acid Lime", color: "#A3E635" },
  { label: "Electric Violet", color: "#A855F7" },
  { label: "Solar Amber", color: "#F59E0B" },
  { label: "Crimson Rose", color: "#F43F5E" },
];

const DEFAULT_TEMPLATE = {
  brand_name: "WillJustPlay",
  brand_tagline: "STORE & TOP-UP GAME BERGARANSI",
  accent_color: "#00F0FF",
  verify_subject: "⚡ Verifikasi Email Akun {{brand_name}} — Halo {{name}}!",
  verify_badge: "VERIFIKASI AKUN",
  verify_heading: "Konfirmasi & Aktifkan Akun Anda",
  verify_body:
    "Terima kasih telah bergabung di {{brand_name}}. Untuk menjaga keamanan akun serta membuka akses penuh ke layanan top-up instan dan store akun bergaransi, silakan konfirmasi alamat email Anda melalui tombol di bawah ini.",
  verify_button_text: "VERIFIKASI EMAIL SEKARANG",
  reset_subject: "🔐 Instruksi Reset Password — {{brand_name}}",
  reset_heading: "Atur Ulang Kata Sandi Akun Anda",
  reset_body:
    "Kami menerima permintaan untuk mengatur ulang kata sandi akun {{brand_name}} yang terhubung dengan {{email}}. Klik tombol di bawah ini untuk membuat password baru yang aman.",
  reset_button_text: "ATUR ULANG PASSWORD",
  footer_note:
    "Jika Anda tidak merasa melakukan permintaan ini di {{brand_name}}, abaikan email ini dengan aman. Keamanan akun Anda tetap terlindungi.",
  support_text: "Butuh bantuan? Hubungi Customer Support Resmi WillJustPlay.",
  show_account_card: true,
  show_benefits: true,
};

const DYNAMIC_VARIABLES = [
  { token: "{{name}}", desc: "Nama pengguna" },
  { token: "{{email}}", desc: "Email pengguna" },
  { token: "{{brand_name}}", desc: "Nama brand/store" },
  { token: "{{ttl_hours}}", desc: "Masa aktif (jam)" },
  { token: "{{timestamp}}", desc: "Waktu permintaan" },
];

function interpolatePreview(text, vars) {
  return String(text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ""
  );
}

export function AdminEmailVerification() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testProvider, setTestProvider] = useState("auto");
  const [testTemplateType, setTestTemplateType] = useState("verify_preview");
  const [testResult, setTestResult] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  // Live preview state
  const [previewMode, setPreviewMode] = useState("verify"); // "verify" | "reset"
  const [previewName, setPreviewName] = useState("jon doe");
  const [previewEmail, setPreviewEmail] = useState("jondoe@gmail.com");

  const [cfg, setCfg] = useState({
    require_email_verification: true,
    allow_dev_preview_links: true,
    verify_token_ttl_hours: 24,
    reset_token_ttl_minutes: 60,
    public_base_url: "",
    provider_mode: "auto",
    active_provider: "dev_preview",
    configured: false,
    resend: {
      enabled: true,
      ready: false,
      api_key_set: false,
      api_key_masked: "",
      api_key_source: "none",
      from_email: "onboarding@resend.dev",
      from_name: "WillJustPlay Security",
    },
    smtp: {
      enabled: false,
      ready: false,
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: "",
      pass_set: false,
      pass_masked: "",
      pass_source: "none",
      from_email: "",
      from_name: "WillJustPlay Security",
    },
    template: { ...DEFAULT_TEMPLATE },
    last_test: null,
  });

  const [resendApiKey, setResendApiKey] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [clearResendKey, setClearResendKey] = useState(false);
  const [clearSmtpPass, setClearSmtpPass] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/settings/email");
      setCfg((prev) => ({
        ...prev,
        ...data,
        resend: { ...prev.resend, ...(data.resend || {}) },
        smtp: { ...prev.smtp, ...(data.smtp || {}) },
        template: { ...DEFAULT_TEMPLATE, ...(data.template || {}) },
      }));
      setTestResult(data.last_test || null);
      setRecentEvents(Array.isArray(data.recent_events) ? data.recent_events : []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal memuat pengaturan verifikasi & email");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateTemplate = (patch) => {
    setCfg((prev) => ({
      ...prev,
      template: {
        ...prev.template,
        ...patch,
      },
    }));
  };

  const handleResetTemplate = () => {
    updateTemplate({ ...DEFAULT_TEMPLATE });
    toast.success("Desain & teks template dikembalikan ke pengaturan awal");
  };

  const copyVariableToken = (token) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(token);
      toast.success(`Variabel ${token} disalin! Tempelkan pada subjek atau isi pesan.`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        require_email_verification: Boolean(cfg.require_email_verification),
        allow_dev_preview_links: Boolean(cfg.allow_dev_preview_links),
        verify_token_ttl_hours: Number(cfg.verify_token_ttl_hours || 24),
        reset_token_ttl_minutes: Number(cfg.reset_token_ttl_minutes || 60),
        public_base_url: String(cfg.public_base_url || "").trim(),
        provider_mode: cfg.provider_mode,
        resend: {
          enabled: Boolean(cfg.resend.enabled),
          from_email: String(cfg.resend.from_email || "").trim(),
          from_name: String(cfg.resend.from_name || "").trim(),
          clear_api_key: clearResendKey,
        },
        smtp: {
          enabled: Boolean(cfg.smtp.enabled),
          host: String(cfg.smtp.host || "").trim(),
          port: Number(cfg.smtp.port || 587),
          secure: Boolean(cfg.smtp.secure),
          user: String(cfg.smtp.user || "").trim(),
          from_email: String(cfg.smtp.from_email || "").trim(),
          from_name: String(cfg.smtp.from_name || "").trim(),
          clear_pass: clearSmtpPass,
        },
        template: { ...cfg.template },
      };

      if (resendApiKey.trim()) {
        payload.resend.api_key = resendApiKey.trim();
        payload.resend.clear_api_key = false;
      }
      if (smtpPass.trim()) {
        payload.smtp.pass = smtpPass.trim();
        payload.smtp.clear_pass = false;
      }

      const { data } = await api.put("/admin/settings/email", payload);
      setCfg((prev) => ({
        ...prev,
        ...data,
        resend: { ...prev.resend, ...(data.resend || {}) },
        smtp: { ...prev.smtp, ...(data.smtp || {}) },
        template: { ...DEFAULT_TEMPLATE, ...(data.template || {}) },
      }));
      setResendApiKey("");
      setSmtpPass("");
      setClearResendKey(false);
      setClearSmtpPass(false);
      if (Array.isArray(data.recent_events)) setRecentEvents(data.recent_events);
      toast.success(data.message || "Pengaturan verifikasi & template email berhasil disimpan");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error("Masukkan alamat email tujuan untuk uji pengiriman");
      return;
    }
    setTesting(true);
    try {
      const payload = {
        to_email: testEmail.trim(),
        provider: testProvider,
        template_type: testTemplateType,
        template: cfg.template,
        resend: {
          api_key: resendApiKey.trim() || undefined,
          from_email: cfg.resend.from_email,
          from_name: cfg.resend.from_name,
        },
        smtp: {
          host: cfg.smtp.host,
          port: Number(cfg.smtp.port || 587),
          secure: Boolean(cfg.smtp.secure),
          user: cfg.smtp.user,
          pass: smtpPass.trim() || undefined,
          from_email: cfg.smtp.from_email,
          from_name: cfg.smtp.from_name,
        },
      };
      const { data } = await api.post("/admin/settings/email/test", payload);
      setTestResult(
        data.last_test || {
          ok: true,
          provider: data.provider,
          to_email: data.to_email,
          tested_at: data.tested_at,
        }
      );
      if (Array.isArray(data.recent_events)) setRecentEvents(data.recent_events);
      toast.success(data.message || "Email tes berhasil dikirim!");
    } catch (e) {
      const errDetail = formatApiError(e.response?.data?.detail) || "Pengiriman email tes gagal";
      setTestResult(
        e.response?.data?.last_test || {
          ok: false,
          provider: testProvider,
          error: errDetail,
          tested_at: new Date().toISOString(),
        }
      );
      toast.error(errDetail);
    } finally {
      setTesting(false);
    }
  };

  const applySmtpPreset = (preset) => {
    setCfg((prev) => ({
      ...prev,
      smtp: {
        ...prev.smtp,
        enabled: true,
        host: preset.host,
        port: preset.port,
        secure: preset.secure,
      },
    }));
    toast.success(`Preset ${preset.label} diterapkan`);
  };

  const previewComputed = useMemo(() => {
    const tpl = cfg.template || DEFAULT_TEMPLATE;
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(tpl.accent_color || ""))
      ? tpl.accent_color.toUpperCase()
      : "#00F0FF";
    const sampleOrigin =
      cfg.public_base_url ||
      (typeof window !== "undefined" ? window.location.origin : "https://willjustplay.store");
    const sampleUrl =
      previewMode === "verify"
        ? `${sampleOrigin}/verify-email?token=7f8a9d2c4e1b6a3f9012e8c7b5a4d3f2`
        : `${sampleOrigin}/reset-password?token=4c9e1a8b3d7f2e6c0a5b9d1e4f8a2c6b`;

    const nowFormatted = "25 Okt 2026, 01:45 WIB";
    const vars = {
      name: previewName || "jon doe",
      email: previewEmail || "jondoe@gmail.com",
      brand_name: tpl.brand_name || "WillJustPlay",
      brand_tagline: tpl.brand_tagline || "STORE & TOP-UP GAME BERGARANSI",
      ttl_hours: cfg.verify_token_ttl_hours || 24,
      ttl_minutes: cfg.reset_token_ttl_minutes || 60,
      verify_url: sampleUrl,
      reset_url: sampleUrl,
      action_url: sampleUrl,
      timestamp: nowFormatted,
    };

    const isVerify = previewMode === "verify";
    return {
      accent,
      brandName: tpl.brand_name || "WillJustPlay",
      brandTagline: tpl.brand_tagline || "STORE & TOP-UP GAME BERGARANSI",
      monogram: (tpl.brand_name || "W").trim().slice(0, 2).toUpperCase(),
      subject: interpolatePreview(isVerify ? tpl.verify_subject : tpl.reset_subject, vars),
      badge: isVerify ? tpl.verify_badge || "VERIFIKASI AKUN" : "RESET PASSWORD",
      heading: interpolatePreview(isVerify ? tpl.verify_heading : tpl.reset_heading, vars),
      body: interpolatePreview(isVerify ? tpl.verify_body : tpl.reset_body, vars),
      buttonText: interpolatePreview(
        isVerify ? tpl.verify_button_text : tpl.reset_button_text,
        vars
      ),
      expiryLabel: isVerify
        ? `${cfg.verify_token_ttl_hours || 24} Jam`
        : `${cfg.reset_token_ttl_minutes || 60} Menit`,
      footerNote: interpolatePreview(tpl.footer_note, vars),
      supportText: interpolatePreview(tpl.support_text, vars),
      sampleUrl,
      nowFormatted,
      showAccountCard: tpl.show_account_card !== false,
      showBenefits: isVerify && tpl.show_benefits !== false,
    };
  }, [cfg.template, cfg.public_base_url, cfg.verify_token_ttl_hours, cfg.reset_token_ttl_minutes, previewMode, previewName, previewEmail]);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
        <Loader2 size={18} className="animate-spin text-neon" /> Memuat pengaturan verifikasi & email...
      </div>
    );
  }

  const activeProviderLabel =
    cfg.active_provider === "resend"
      ? "RESEND API AKTIF"
      : cfg.active_provider === "smtp"
      ? "SMTP SERVER AKTIF"
      : "MODE SIMULASI / DEV PREVIEW";

  return (
    <div className="space-y-6" data-testid="admin-email-verification-settings">
      {/* Header & Active Status Banner */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-black uppercase text-white">
            Pengaturan Verifikasi Masuk, Template Dinamis, Resend API & SMTP
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono leading-relaxed max-w-3xl">
            Atur kebijakan verifikasi email, desain & variabel dinamis email yang dikirim ke pelanggan, serta kredensial pengiriman Resend API maupun server SMTP.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          data-testid="email-settings-refresh"
          className="flex items-center gap-1.5 border border-line hover:border-neon/50 text-slate-300 hover:text-neon text-[10px] font-bold uppercase tracking-widest px-3.5 py-2.5 transition-colors"
        >
          <RefreshCw size={12} /> Muat Ulang
        </button>
      </div>

      {/* Status Banner */}
      <div
        data-testid="email-settings-status-banner"
        className={`flex flex-wrap items-center justify-between gap-4 border p-4 ${
          cfg.configured ? "border-lime/40 bg-lime/5" : "border-neon/40 bg-neon/5"
        }`}
      >
        <div className="flex items-start gap-3">
          <MailCheck size={18} className={`mt-0.5 shrink-0 ${cfg.configured ? "text-lime" : "text-neon"}`} />
          <div className="text-xs font-mono space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-bold uppercase tracking-wider ${cfg.configured ? "text-lime" : "text-neon"}`}>
                {activeProviderLabel}
              </span>
              <span className="text-[10px] px-2 py-0.5 border border-line bg-void text-slate-300 uppercase">
                Mode: {cfg.provider_mode}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 uppercase font-bold ${
                  cfg.require_email_verification
                    ? "bg-neon/15 text-neon border border-neon/30"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                }`}
              >
                {cfg.require_email_verification ? "Wajib Verifikasi Email" : "Auto-Verifikasi Pendaftaran"}
              </span>
            </div>
            <p className="text-slate-400">
              Resend: {cfg.resend.ready ? `Siap (${cfg.resend.api_key_masked})` : "Belum aktif/key kosong"} · SMTP:{" "}
              {cfg.smtp.ready ? `Siap (${cfg.smtp.host}:${cfg.smtp.port})` : "Belum aktif/kredensial kosong"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          data-testid="email-settings-save-top"
          className="bg-neon text-void px-5 py-2.5 font-display font-bold uppercase text-[11px] tracking-widest hover:bg-lime transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Simpan Semua Pengaturan
        </button>
      </div>

      {/* Section 1: Kebijakan Verifikasi & Mode Provider */}
      <div className="bg-panel border border-line p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-line pb-3">
          <ShieldCheck size={16} className="text-neon" />
          <h3 className="font-display font-bold uppercase text-sm text-white tracking-wider">
            1. Kebijakan Verifikasi Masuk & Mode Pengiriman
          </h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label
            data-testid="toggle-require-verification"
            className="flex items-start justify-between gap-4 bg-void border border-line p-4 cursor-pointer hover:border-neon/40 transition-colors"
          >
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Wajib Verifikasi Email Sebelum Login
              </div>
              <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                Jika aktif, pengguna baru wajib mengklik tautan verifikasi email sebelum dapat masuk. Jika dimatikan, akun baru langsung aktif otomatis saat mendaftar.
              </p>
            </div>
            <input
              type="checkbox"
              checked={!!cfg.require_email_verification}
              onChange={(e) => setCfg({ ...cfg, require_email_verification: e.target.checked })}
              data-testid="require-verification-checkbox"
              className="w-5 h-5 mt-0.5 shrink-0 accent-[#00F0FF]"
            />
          </label>

          <label
            data-testid="toggle-dev-preview-links"
            className="flex items-start justify-between gap-4 bg-void border border-line p-4 cursor-pointer hover:border-neon/40 transition-colors"
          >
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Tautan Pratinjau Langsung (Fallback / Mode Dev)
              </div>
              <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                Tampilkan tombol tautan verifikasi/reset langsung di layar jika email belum dikonfigurasi atau saat pengiriman email gagal.
              </p>
            </div>
            <input
              type="checkbox"
              checked={!!cfg.allow_dev_preview_links}
              onChange={(e) => setCfg({ ...cfg, allow_dev_preview_links: e.target.checked })}
              data-testid="allow-dev-preview-checkbox"
              className="w-5 h-5 mt-0.5 shrink-0 accent-[#00F0FF]"
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Mode Provider Email Utama
            </span>
            <select
              value={cfg.provider_mode}
              onChange={(e) => setCfg({ ...cfg, provider_mode: e.target.value })}
              data-testid="email-provider-mode-select"
              className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
            >
              <option value="auto">Otomatis (Resend → Fallback SMTP)</option>
              <option value="resend">Hanya Resend API</option>
              <option value="smtp">Hanya SMTP Server</option>
              <option value="dev_preview">Simulasi / Mode Dev Saja</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Masa Berlaku Token Verifikasi (Jam)
            </span>
            <input
              type="number"
              min={1}
              max={168}
              value={cfg.verify_token_ttl_hours}
              onChange={(e) => setCfg({ ...cfg, verify_token_ttl_hours: e.target.value })}
              data-testid="verify-ttl-input"
              className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Masa Berlaku Reset Password (Menit)
            </span>
            <input
              type="number"
              min={5}
              max={1440}
              value={cfg.reset_token_ttl_minutes}
              onChange={(e) => setCfg({ ...cfg, reset_token_ttl_minutes: e.target.value })}
              data-testid="reset-ttl-input"
              className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Base URL Publik (Opsional)
            </span>
            <input
              type="text"
              value={cfg.public_base_url}
              onChange={(e) => setCfg({ ...cfg, public_base_url: e.target.value })}
              placeholder={cfg.resolved_public_url || "Kosongkan untuk deteksi otomatis"}
              data-testid="public-base-url-input"
              className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
            />
            {cfg.resolved_public_url && (
              <span className="mt-1 block text-[10px] font-mono text-lime truncate" title={cfg.resolved_public_url}>
                URL Aktif: {cfg.resolved_public_url}
              </span>
            )}
          </label>
        </div>
      </div>

      {/* Section 2: Kustomisasi Desain & Template Email Dinamis + Live Preview */}
      <div className="bg-panel border border-line p-6 space-y-6" data-testid="dynamic-email-template-section">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-neon" />
            <div>
              <h3 className="font-display font-bold uppercase text-sm text-white tracking-wider">
                2. Desain & Template Email Verifikasi Dinamis
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Sesuaikan tampilan visual, warna aksen, kartu detail akun, dan teks dinamis untuk email verifikasi & reset password.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetTemplate}
            data-testid="reset-email-template-button"
            className="flex items-center gap-1.5 border border-line hover:border-neon/50 text-slate-300 hover:text-neon text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 transition-colors"
          >
            <RotateCcw size={12} /> Reset Desain Default
          </button>
        </div>

        {/* Dynamic Variable Chips Bar */}
        <div className="bg-void border border-line p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300">
            <Palette size={14} className="text-neon shrink-0" />
            <span>Variabel Dinamis (klik untuk menyalin):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DYNAMIC_VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => copyVariableToken(v.token)}
                className="group flex items-center gap-1.5 bg-panel border border-line hover:border-neon px-2.5 py-1 text-[11px] font-mono transition-colors"
                title={`Salin ${v.token} (${v.desc})`}
              >
                <span className="text-neon font-bold">{v.token}</span>
                <span className="text-slate-500 text-[10px]">({v.desc})</span>
                <Copy size={10} className="text-slate-500 group-hover:text-neon" />
              </button>
            ))}
          </div>
        </div>

        {/* Editor + Live Preview Grid */}
        <div className="grid xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form Controls (6 cols) */}
          <div className="xl:col-span-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Nama Brand / Store
                </span>
                <input
                  type="text"
                  value={cfg.template.brand_name}
                  onChange={(e) => updateTemplate({ brand_name: e.target.value })}
                  placeholder="WillJustPlay"
                  data-testid="tpl-brand-name-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Tagline Header Email
                </span>
                <input
                  type="text"
                  value={cfg.template.brand_tagline}
                  onChange={(e) => updateTemplate({ brand_tagline: e.target.value })}
                  placeholder="STORE & TOP-UP GAME BERGARANSI"
                  data-testid="tpl-brand-tagline-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                />
              </label>
            </div>

            {/* Accent Color Picker & Presets */}
            <div className="bg-void border border-line p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Warna Aksen Utama & Tombol CTA
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cfg.template.accent_color || "#00F0FF"}
                    onChange={(e) => updateTemplate({ accent_color: e.target.value.toUpperCase() })}
                    className="w-7 h-7 bg-transparent border border-line cursor-pointer"
                    title="Pilih warna aksen"
                  />
                  <input
                    type="text"
                    value={cfg.template.accent_color}
                    onChange={(e) => updateTemplate({ accent_color: e.target.value })}
                    className="w-24 bg-panel border border-line text-xs font-mono px-2.5 py-1 text-white uppercase"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ACCENT_PRESETS.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    onClick={() => updateTemplate({ accent_color: p.color })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-mono transition-colors ${
                      String(cfg.template.accent_color).toUpperCase() === p.color
                        ? "border-white bg-panel text-white font-bold"
                        : "border-line bg-panel/50 text-slate-400 hover:text-white"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Component Toggles */}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-3 bg-void border border-line px-3.5 py-2.5 cursor-pointer">
                <span className="text-[11px] font-mono text-slate-200">
                  Kartu Ringkasan Akun & Waktu
                </span>
                <input
                  type="checkbox"
                  checked={cfg.template.show_account_card !== false}
                  onChange={(e) => updateTemplate({ show_account_card: e.target.checked })}
                  className="w-4 h-4 accent-[#00F0FF]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 bg-void border border-line px-3.5 py-2.5 cursor-pointer">
                <span className="text-[11px] font-mono text-slate-200">
                  Highlight Keunggulan Member
                </span>
                <input
                  type="checkbox"
                  checked={cfg.template.show_benefits !== false}
                  onChange={(e) => updateTemplate({ show_benefits: e.target.checked })}
                  className="w-4 h-4 accent-[#00F0FF]"
                />
              </label>
            </div>

            {/* Mode Switcher for Editing Verify vs Reset */}
            <div className="flex border-b border-line pt-1">
              <button
                type="button"
                onClick={() => setPreviewMode("verify")}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  previewMode === "verify"
                    ? "border-neon text-neon bg-neon/5"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                Konten Email Verifikasi Masuk
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("reset")}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  previewMode === "reset"
                    ? "border-neon text-neon bg-neon/5"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                Konten Email Reset Password
              </button>
            </div>

            {previewMode === "verify" ? (
              <div className="space-y-3.5">
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="block sm:col-span-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      Subjek Email Verifikasi
                    </span>
                    <input
                      type="text"
                      value={cfg.template.verify_subject}
                      onChange={(e) => updateTemplate({ verify_subject: e.target.value })}
                      data-testid="tpl-verify-subject-input"
                      className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      Label Badge Status
                    </span>
                    <input
                      type="text"
                      value={cfg.template.verify_badge}
                      onChange={(e) => updateTemplate({ verify_badge: e.target.value })}
                      data-testid="tpl-verify-badge-input"
                      className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      Judul Utama (Heading)
                    </span>
                    <input
                      type="text"
                      value={cfg.template.verify_heading}
                      onChange={(e) => updateTemplate({ verify_heading: e.target.value })}
                      data-testid="tpl-verify-heading-input"
                      className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      Teks Tombol Utama (CTA)
                    </span>
                    <input
                      type="text"
                      value={cfg.template.verify_button_text}
                      onChange={(e) => updateTemplate({ verify_button_text: e.target.value })}
                      data-testid="tpl-verify-button-input"
                      className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    Isi Pesan Verifikasi (Mendukung variabel dinamis)
                  </span>
                  <textarea
                    rows={3}
                    value={cfg.template.verify_body}
                    onChange={(e) => updateTemplate({ verify_body: e.target.value })}
                    data-testid="tpl-verify-body-input"
                    className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white leading-relaxed"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3.5">
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    Subjek Email Reset Password
                  </span>
                  <input
                    type="text"
                    value={cfg.template.reset_subject}
                    onChange={(e) => updateTemplate({ reset_subject: e.target.value })}
                    className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                  />
                </label>

                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      Judul Reset Password
                    </span>
                    <input
                      type="text"
                      value={cfg.template.reset_heading}
                      onChange={(e) => updateTemplate({ reset_heading: e.target.value })}
                      className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      Teks Tombol Reset
                    </span>
                    <input
                      type="text"
                      value={cfg.template.reset_button_text}
                      onChange={(e) => updateTemplate({ reset_button_text: e.target.value })}
                      className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    Isi Pesan Reset Password
                  </span>
                  <textarea
                    rows={3}
                    value={cfg.template.reset_body}
                    onChange={(e) => updateTemplate({ reset_body: e.target.value })}
                    className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white leading-relaxed"
                  />
                </label>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Catatan Keamanan (Footer)
                </span>
                <input
                  type="text"
                  value={cfg.template.footer_note}
                  onChange={(e) => updateTemplate({ footer_note: e.target.value })}
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Info Bantuan / Support
                </span>
                <input
                  type="text"
                  value={cfg.template.support_text}
                  onChange={(e) => updateTemplate({ support_text: e.target.value })}
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                />
              </label>
            </div>
          </div>

          {/* Right Column: Live Email Client Preview (6 cols) */}
          <div className="xl:col-span-6 space-y-3" data-testid="live-email-preview-container">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-void border border-line px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-display font-bold uppercase text-white">
                <Eye size={14} className="text-neon" />
                <span>Pratinjau Email Real-Time</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  placeholder="Nama sampel"
                  className="w-28 bg-panel border border-line text-[11px] font-mono px-2 py-1 text-slate-200"
                  title="Simulasi nama penerima"
                />
                <input
                  type="text"
                  value={previewEmail}
                  onChange={(e) => setPreviewEmail(e.target.value)}
                  placeholder="Email sampel"
                  className="w-40 bg-panel border border-line text-[11px] font-mono px-2 py-1 text-slate-200"
                  title="Simulasi email penerima"
                />
              </div>
            </div>

            {/* Simulated Inbox Subject Bar */}
            <div className="bg-[#070a12] border border-line p-3 text-xs font-mono space-y-1">
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span className="text-slate-500 uppercase">Subjek:</span>
                <span className="text-white font-bold truncate">{previewComputed.subject}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span className="text-slate-500 uppercase">Kepada:</span>
                <span className="text-slate-300">
                  {previewName || "jon doe"} &lt;{previewEmail || "jondoe@gmail.com"}&gt;
                </span>
              </div>
            </div>

            {/* Rendered Branded Email Card */}
            <div className="bg-[#04060b] border border-line p-4 sm:p-6">
              <div className="max-w-[520px] mx-auto bg-[#090d16] border border-[#1e293b] rounded-xl overflow-hidden shadow-2xl">
                {/* Top Accent Gradient Bar */}
                <div
                  className="h-1 w-full"
                  style={{
                    background: `linear-gradient(90deg, ${previewComputed.accent} 0%, #a3e635 100%)`,
                  }}
                />

                {/* Email Header */}
                <div className="px-6 py-5 border-b border-[#151e30] bg-[#070b13] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center font-black text-sm shrink-0"
                      style={{
                        backgroundColor: previewComputed.accent,
                        color: "#05070c",
                      }}
                    >
                      {previewComputed.monogram}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black uppercase tracking-wider text-white truncate">
                        {previewComputed.brandName}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 truncate">
                        {previewComputed.brandTagline}
                      </div>
                    </div>
                  </div>

                  <span
                    className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 bg-[#0f172a]"
                    style={{
                      color: previewComputed.accent,
                      border: `1px solid ${previewComputed.accent}`,
                    }}
                  >
                    {previewComputed.badge}
                  </span>
                </div>

                {/* Email Body */}
                <div className="p-6 space-y-4 text-left">
                  <h4 className="text-lg font-extrabold text-white leading-snug">
                    {previewComputed.heading}
                  </h4>

                  <p className="text-xs text-slate-200">
                    Halo{" "}
                    <strong style={{ color: previewComputed.accent }}>
                      {previewName || "jon doe"}
                    </strong>
                    ,
                  </p>

                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {previewComputed.body}
                  </p>

                  {/* Dynamic Account Summary Card */}
                  {previewComputed.showAccountCard && (
                    <div
                      className="bg-[#0b111e] border border-[#1e293b] rounded-lg p-3.5 space-y-2"
                      style={{ borderLeft: `3px solid ${previewComputed.accent}` }}
                    >
                      <div
                        className="text-[10px] font-mono font-bold uppercase tracking-widest"
                        style={{ color: previewComputed.accent }}
                      >
                        RINGKASAN AKTIVITAS & DETAIL AKUN
                      </div>
                      <div className="divide-y divide-[#151f32] text-[11px]">
                        <div className="py-1 flex justify-between gap-2">
                          <span className="text-slate-400">Nama Pengguna</span>
                          <span className="font-bold text-slate-100">{previewName || "jon doe"}</span>
                        </div>
                        <div className="py-1 flex justify-between gap-2">
                          <span className="text-slate-400">Email Terdaftar</span>
                          <span
                            className="font-mono font-bold break-all"
                            style={{ color: previewComputed.accent }}
                          >
                            {previewEmail || "jondoe@gmail.com"}
                          </span>
                        </div>
                        <div className="py-1 flex justify-between gap-2">
                          <span className="text-slate-400">Waktu Permintaan</span>
                          <span className="font-bold text-slate-100">{previewComputed.nowFormatted}</span>
                        </div>
                        <div className="py-1 flex justify-between gap-2">
                          <span className="text-slate-400">Status</span>
                          <span className="font-bold text-slate-100">
                            {previewMode === "verify"
                              ? "Menunggu Verifikasi Email"
                              : "Permintaan Reset Sandi"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Centered Non-Wrapping CTA Button */}
                  <div className="pt-2 pb-1 text-center space-y-2.5">
                    <div
                      className="inline-block w-full max-w-[300px] py-3.5 px-5 rounded-md font-extrabold text-xs uppercase tracking-widest text-center whitespace-nowrap shadow-lg"
                      style={{
                        backgroundColor: previewComputed.accent,
                        color: "#05070c",
                      }}
                    >
                      {previewComputed.buttonText} &rarr;
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      &#9201; Tautan keamanan ini berlaku selama{" "}
                      <strong style={{ color: previewComputed.accent }}>
                        {previewComputed.expiryLabel}
                      </strong>
                    </div>
                    {previewMode === "verify" && (
                      <div
                        className="inline-block bg-[#060a12] rounded-lg px-5 py-2.5 mt-1"
                        style={{ border: `1px dashed ${previewComputed.accent}` }}
                      >
                        <div className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                          ATAU MASUKKAN KODE VERIFIKASI 6-DIGIT DI WEBSITE:
                        </div>
                        <div
                          className="text-lg font-mono font-black tracking-[0.35em] mt-0.5"
                          style={{ color: previewComputed.accent }}
                        >
                          482910
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Benefits Card */}
                  {previewComputed.showBenefits && (
                    <div className="bg-[#080d18] border border-[#172236] rounded-lg p-3.5 space-y-1.5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        AKSES MEMBER TERVERIFIKASI
                      </div>
                      <div className="text-[11px] text-slate-300 space-y-1">
                        <div>
                          <span style={{ color: previewComputed.accent }} className="font-bold mr-1.5">
                            &#10003;
                          </span>
                          Proses Top-Up Game Instan 24/7 Otomatis
                        </div>
                        <div>
                          <span style={{ color: previewComputed.accent }} className="font-bold mr-1.5">
                            &#10003;
                          </span>
                          Store Akun Premium Bergaransi & Aman
                        </div>
                        <div>
                          <span style={{ color: previewComputed.accent }} className="font-bold mr-1.5">
                            &#10003;
                          </span>
                          Riwayat Pesanan & Notifikasi Keamanan Real-Time
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fallback URL Box */}
                  <div className="bg-[#070a12] border border-dashed border-[#1e293b] rounded-md p-3 space-y-1">
                    <div className="text-[10px] text-slate-500">
                      Jika tombol di atas tidak berfungsi di aplikasi email Anda, salin dan buka tautan berikut di browser:
                    </div>
                    <div
                      className="text-[10px] font-mono break-all underline"
                      style={{ color: previewComputed.accent }}
                    >
                      {previewComputed.sampleUrl}
                    </div>
                  </div>

                  {previewComputed.footerNote && (
                    <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                      {previewComputed.footerNote}
                    </p>
                  )}
                </div>

                {/* Email Footer */}
                <div className="px-6 py-4 bg-[#060911] border-t border-[#151e30] text-center space-y-1">
                  {previewComputed.supportText && (
                    <div className="text-[11px] text-slate-400">{previewComputed.supportText}</div>
                  )}
                  <div className="text-[10px] font-mono text-slate-600">
                    &copy; {new Date().getFullYear()} {previewComputed.brandName} &bull; Sistem Otentikasi & Keamanan Terenkripsi
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 & 4: Resend API & SMTP Configuration Side-by-Side on Desktop */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Section 3: Resend API */}
        <div className="bg-panel border border-line p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <KeyRound size={16} className="text-neon" />
                <h3 className="font-display font-bold uppercase text-sm text-white tracking-wider">
                  3. Konfigurasi Resend API
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 ${
                  cfg.resend.ready ? "bg-lime/15 text-lime" : "bg-slate-800 text-slate-400"
                }`}
              >
                {cfg.resend.ready ? "Siap Digunakan" : "Belum Aktif"}
              </span>
            </div>

            <label className="flex items-center justify-between gap-4 bg-void border border-line px-4 py-3 cursor-pointer">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Aktifkan Pengiriman via Resend API
              </span>
              <input
                type="checkbox"
                checked={!!cfg.resend.enabled}
                onChange={(e) =>
                  setCfg({ ...cfg, resend: { ...cfg.resend, enabled: e.target.checked } })
                }
                data-testid="resend-enabled-checkbox"
                className="w-5 h-5 accent-[#00F0FF]"
              />
            </label>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Resend API Key (re_...)
                </label>
                {cfg.resend.api_key_set && !clearResendKey && (
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-lime">
                    <CheckCircle2 size={11} /> Tersimpan ({cfg.resend.api_key_masked} · {cfg.resend.api_key_source.toUpperCase()})
                    {cfg.resend.api_key_source === "db" && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearResendKey(true);
                          setResendApiKey("");
                        }}
                        className="text-coral hover:underline ml-1 inline-flex items-center gap-0.5"
                        title="Hapus API key tersimpan"
                      >
                        <Trash2 size={10} /> Hapus
                      </button>
                    )}
                  </span>
                )}
                {clearResendKey && (
                  <span className="text-[10px] font-mono text-coral">
                    Key akan dihapus saat disimpan
                  </span>
                )}
              </div>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => {
                  setResendApiKey(e.target.value);
                  if (e.target.value) setClearResendKey(false);
                }}
                placeholder={
                  cfg.resend.api_key_set && !clearResendKey
                    ? "•••••••• (kosongkan jika tidak ingin mengubah API Key)"
                    : "Tempel API Key Resend (contoh: re_123456789...)"
                }
                data-testid="resend-api-key-input"
                className="w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
              />
              <p className="text-[10px] font-mono text-slate-500 mt-1.5">
                Buat API key di dashboard <span className="text-slate-300">resend.com/api-keys</span>.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Email Pengirim (From Email)
                </span>
                <input
                  type="text"
                  value={cfg.resend.from_email}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      resend: { ...cfg.resend, from_email: e.target.value },
                    })
                  }
                  placeholder="onboarding@resend.dev"
                  data-testid="resend-from-email-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Nama Pengirim (From Name)
                </span>
                <input
                  type="text"
                  value={cfg.resend.from_name}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      resend: { ...cfg.resend, from_name: e.target.value },
                    })
                  }
                  placeholder="WillJustPlay Security"
                  data-testid="resend-from-name-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 bg-void/70 border border-line/70 p-3 text-[11px] font-mono text-slate-400 flex items-start gap-2">
            <Info size={13} className="text-neon shrink-0 mt-0.5" />
            <span>
              Gunakan <code className="text-neon">onboarding@resend.dev</code> untuk pengujian awal, atau gunakan alamat email domain terverifikasi Anda di Resend agar dapat mengirim ke seluruh email pelanggan.
            </span>
          </div>
        </div>

        {/* Section 4: SMTP Server */}
        <div className="bg-panel border border-line p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <Server size={16} className="text-neon" />
                <h3 className="font-display font-bold uppercase text-sm text-white tracking-wider">
                  4. Konfigurasi SMTP Server
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 ${
                  cfg.smtp.ready ? "bg-lime/15 text-lime" : "bg-slate-800 text-slate-400"
                }`}
              >
                {cfg.smtp.ready ? "Siap Digunakan" : "Belum Aktif"}
              </span>
            </div>

            <label className="flex items-center justify-between gap-4 bg-void border border-line px-4 py-3 cursor-pointer">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Aktifkan Pengiriman via SMTP Server
              </span>
              <input
                type="checkbox"
                checked={!!cfg.smtp.enabled}
                onChange={(e) =>
                  setCfg({ ...cfg, smtp: { ...cfg.smtp, enabled: e.target.checked } })
                }
                data-testid="smtp-enabled-checkbox"
                className="w-5 h-5 accent-[#00F0FF]"
              />
            </label>

            <div>
              <span className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
                Preset Cepat Server SMTP:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SMTP_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applySmtpPreset(p)}
                    className="text-[10px] font-mono px-2.5 py-1 border border-line bg-void text-slate-300 hover:border-neon/50 hover:text-neon transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  SMTP Host
                </span>
                <input
                  type="text"
                  value={cfg.smtp.host}
                  onChange={(e) =>
                    setCfg({ ...cfg, smtp: { ...cfg.smtp, host: e.target.value } })
                  }
                  placeholder="smtp.gmail.com"
                  data-testid="smtp-host-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Port SMTP
                </span>
                <input
                  type="number"
                  value={cfg.smtp.port}
                  onChange={(e) => {
                    const portVal = Number(e.target.value || 587);
                    setCfg({
                      ...cfg,
                      smtp: {
                        ...cfg.smtp,
                        port: portVal,
                        secure: portVal === 465 ? true : portVal === 587 ? false : cfg.smtp.secure,
                      },
                    });
                  }}
                  placeholder="587"
                  data-testid="smtp-port-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
                />
              </label>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!cfg.smtp.secure}
                onChange={(e) =>
                  setCfg({ ...cfg, smtp: { ...cfg.smtp, secure: e.target.checked } })
                }
                data-testid="smtp-secure-checkbox"
                className="w-4 h-4 accent-[#00F0FF]"
              />
              <span className="text-[11px] font-mono text-slate-300">
                Gunakan SSL/TLS Langsung (aktifkan untuk Port 465, matikan untuk STARTTLS Port 587)
              </span>
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  SMTP Username / Email
                </span>
                <input
                  type="text"
                  value={cfg.smtp.user}
                  onChange={(e) =>
                    setCfg({ ...cfg, smtp: { ...cfg.smtp, user: e.target.value } })
                  }
                  placeholder="akun@gmail.com"
                  data-testid="smtp-user-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
                />
              </label>

              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    SMTP Password / App Password
                  </span>
                  {cfg.smtp.pass_set && !clearSmtpPass && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-lime">
                      <CheckCircle2 size={11} /> {cfg.smtp.pass_masked}
                      {cfg.smtp.pass_source === "db" && (
                        <button
                          type="button"
                          onClick={() => {
                            setClearSmtpPass(true);
                            setSmtpPass("");
                          }}
                          className="text-coral hover:underline ml-1"
                        >
                          Hapus
                        </button>
                      )}
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => {
                    setSmtpPass(e.target.value);
                    if (e.target.value) setClearSmtpPass(false);
                  }}
                  placeholder={
                    cfg.smtp.pass_set && !clearSmtpPass
                      ? "•••••••• (kosongkan jika tetap)"
                      : "App Password / Sandi SMTP"
                  }
                  data-testid="smtp-pass-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Email Pengirim (From Email)
                </span>
                <input
                  type="text"
                  value={cfg.smtp.from_email}
                  onChange={(e) =>
                    setCfg({ ...cfg, smtp: { ...cfg.smtp, from_email: e.target.value } })
                  }
                  placeholder="Kosongkan = pakai SMTP Username"
                  data-testid="smtp-from-email-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Nama Pengirim (From Name)
                </span>
                <input
                  type="text"
                  value={cfg.smtp.from_name}
                  onChange={(e) =>
                    setCfg({ ...cfg, smtp: { ...cfg.smtp, from_name: e.target.value } })
                  }
                  placeholder="WillJustPlay Security"
                  data-testid="smtp-from-name-input"
                  className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 bg-void/70 border border-line/70 p-3 text-[11px] font-mono text-slate-400 flex items-start gap-2">
            <Info size={13} className="text-neon shrink-0 mt-0.5" />
            <span>
              Untuk pengguna <strong>Gmail</strong>, gunakan 16 digit <em>Google App Password</em> (Keamanan Akun Google → Verifikasi 2 Langkah → Sandi Aplikasi).
            </span>
          </div>
        </div>
      </div>

      {/* Section 5: Uji Kirim Email & Simpan */}
      <div className="bg-panel border border-line p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <PlugZap size={16} className="text-neon" />
            <h3 className="font-display font-bold uppercase text-sm text-white tracking-wider">
              5. Uji Pengiriman Email & Desain Template (Live Test)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Kirim contoh email verifikasi baru langsung ke inbox Anda untuk melihat hasil desainnya
          </span>
        </div>

        <div className="grid sm:grid-cols-12 gap-3 items-end">
          <label className="block sm:col-span-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Email Tujuan Tes
            </span>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="masukkan-email-anda@gmail.com"
              data-testid="test-email-recipient-input"
              className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
            />
          </label>

          <label className="block sm:col-span-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Jenis Email yang Diuji
            </span>
            <select
              value={testTemplateType}
              onChange={(e) => setTestTemplateType(e.target.value)}
              data-testid="test-email-template-type-select"
              className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
            >
              <option value="verify_preview">Desain Email Verifikasi Dinamis</option>
              <option value="connection">Tes Koneksi Server Standar</option>
            </select>
          </label>

          <label className="block sm:col-span-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Jalur Provider
            </span>
            <select
              value={testProvider}
              onChange={(e) => setTestProvider(e.target.value)}
              data-testid="test-email-provider-select"
              className="mt-1.5 w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white"
            >
              <option value="auto">Sesuai Provider Aktif ({cfg.active_provider.toUpperCase()})</option>
              <option value="resend">Uji Spesifik: Resend API</option>
              <option value="smtp">Uji Spesifik: SMTP Server</option>
            </select>
          </label>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing}
              data-testid="send-test-email-button"
              className="w-full border border-neon text-neon hover:bg-neon hover:text-void font-display font-bold uppercase text-[11px] tracking-widest py-2.5 px-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Kirim Tes
            </button>
          </div>
        </div>

        {testResult && (
          <div
            data-testid="email-test-result-box"
            className={`border p-4 text-xs font-mono flex items-start gap-3 ${
              testResult.ok
                ? "border-lime/40 bg-lime/5 text-lime"
                : "border-coral/40 bg-coral/5 text-coral"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold uppercase">
                {testResult.ok
                  ? `Berhasil Terkirim via ${(testResult.provider || "").toUpperCase()}`
                  : `Gagal Mengirim via ${(testResult.provider || "").toUpperCase()}`}
              </div>
              <div className="text-slate-300">
                {testResult.ok
                  ? `Tujuan: ${testResult.to_email || "-"} ${
                      testResult.provider_id ? `· ID: ${testResult.provider_id}` : ""
                    }`
                  : `Pesan Error: ${testResult.error || "Tidak dapat terhubung ke provider email"}`}
              </div>
              {testResult.tested_at && (
                <div className="text-[10px] text-slate-500">
                  Waktu Tes: {String(testResult.tested_at).slice(0, 19).replace("T", " ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Email Events Log */}
        {recentEvents.length > 0 && (
          <div className="pt-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
              Riwayat Pengiriman Email Terbaru ({recentEvents.length})
            </div>
            <div className="border border-line bg-void overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-left text-[11px] font-mono min-w-[640px]">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Penerima</th>
                    <th className="px-3 py-2">Template</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.slice(0, 8).map((ev) => (
                    <tr key={ev.id} className="border-b border-line/50">
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                        {String(ev.created_at || "").slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="px-3 py-2 text-slate-200">{ev.to_email}</td>
                      <td className="px-3 py-2 text-neon uppercase">{ev.template}</td>
                      <td className="px-3 py-2 text-slate-300 uppercase">{ev.provider}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            ev.status === "sent"
                              ? "bg-lime/15 text-lime"
                              : ev.status === "dev_preview"
                              ? "bg-neon/15 text-neon"
                              : "bg-coral/15 text-coral"
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 truncate max-w-[240px]">
                        {ev.error || (ev.provider_id ? `ID: ${ev.provider_id}` : "Mode pratinjau tautan")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-line flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="email-settings-save-bottom"
            className="bg-neon text-void px-6 py-3 font-display font-bold uppercase text-xs tracking-widest hover:bg-lime transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Simpan Pengaturan Verifikasi & Template Email
          </button>
        </div>
      </div>
    </div>
  );
}
