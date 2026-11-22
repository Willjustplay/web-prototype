import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Mail, Lock, User, Zap, MailCheck, ExternalLink, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatApiError, api } from "@/lib/api";

const inputWrap = "flex items-center gap-2.5 bg-void border border-line focus-within:border-neon/60 px-3.5 transition-colors";
const inputCls = "flex-1 bg-transparent outline-none text-sm font-mono py-3 placeholder:text-slate-600 text-slate-100";

export const AuthModal = ({ open, tab, setTab, onClose, onLogin, onRegister, onForgot }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [devPreviewUrl, setDevPreviewUrl] = useState("");
  const [devPreviewLabel, setDevPreviewLabel] = useState("");

  useEffect(() => {
    if (!open) {
      setError("");
      setPassword("");
      setNeedsVerify(false);
      setOtpInput("");
      setDevPreviewUrl("");
      setDevPreviewLabel("");
    }
  }, [open]);

  const switchTab = (nextTab) => {
    setError("");
    setPassword("");
    setTab(nextTab);
  };

  const handleVerifyOtpInline = async () => {
    const cleanOtp = String(otpInput || "").trim();
    if (!cleanOtp) {
      toast.error("Masukkan kode verifikasi 6-digit dari email Anda");
      return;
    }
    setVerifyingOtp(true);
    setError("");
    try {
      const { data } = await api.post("/auth/verify-email", {
        token: cleanOtp,
        email: email.trim() || undefined,
      });
      toast.success(data?.message || "Email berhasil diverifikasi!");
      setNeedsVerify(false);
      setOtpInput("");
      setDevPreviewUrl("");
      if (email && password && password.length >= 6) {
        await onLogin(email, password);
        toast.success("Berhasil masuk. Selamat datang!");
        onClose();
      }
    } catch (err) {
      const detail = formatApiError(err.response?.data?.detail);
      setError(detail || "Kode verifikasi tidak valid atau sudah kedaluwarsa.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      const { data } = await api.post("/auth/resend-verification", {
        email,
        origin_url: window.location.origin,
      });
      toast.success(data.message || "Email verifikasi telah dikirim ulang. Cek inbox atau folder spam kamu.");
      setError("");
      if (data.dev_preview_url) {
        setDevPreviewUrl(data.dev_preview_url);
        setDevPreviewLabel("Verifikasi Email Sekarang (Mode Dev)");
      }
    } catch (err) {
      const detail = formatApiError(err.response?.data?.detail);
      if (err.response?.status === 429) {
        setError(detail || "Tunggu sebentar sebelum meminta tautan baru lagi.");
      } else if (err.response?.status === 503) {
        setError(detail || "Pengiriman email belum aktif. Hubungi CS via WhatsApp untuk verifikasi manual.");
      } else {
        setError(detail || "Gagal mengirim ulang email verifikasi. Coba lagi.");
      }
    } finally {
      setResending(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDevPreviewUrl("");
    try {
      if (tab === "register") {
        const res = await onRegister(email, password, name);
        toast.success(res.message || "Akun berhasil dibuat. Silakan periksa email Anda untuk verifikasi.");
        if (res.token) {
          onClose();
        } else {
          setNeedsVerify(true);
          if (res.dev_preview_url) {
            setDevPreviewUrl(res.dev_preview_url);
            setDevPreviewLabel("Verifikasi Email Sekarang (Mode Dev)");
          }
          setTab("login");
        }
      } else if (tab === "forgot") {
        const res = await onForgot(email);
        toast.success(res?.message || "Tautan reset password telah dikirim jika email terdaftar.");
        if (res?.dev_preview_url) {
          setDevPreviewUrl(res.dev_preview_url);
          setDevPreviewLabel("Buka Halaman Reset Password (Mode Dev)");
        }
        setTab("login");
      } else {
        await onLogin(email, password);
        toast.success("Berhasil masuk. Selamat datang kembali!");
        onClose();
      }
    } catch (err) {
      if (tab === "login" && err.response?.status === 403) {
        if (err.response?.data?.code !== "ACCOUNT_SUSPENDED") {
          setNeedsVerify(true);
        }
      }
      const detail = err.response?.data?.detail;
      setError(
        formatApiError(detail) ||
          (err.response ? "Gagal, coba lagi" : "Tidak dapat terhubung ke server. Periksa koneksi internet kamu.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="auth-modal"
          className="fixed inset-0 z-[100] bg-void/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-panel border border-line max-h-[90vh] overflow-y-auto"
            data-lenis-prevent
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 grid place-items-center bg-neon text-void">
                  <Zap size={16} strokeWidth={2.75} />
                </span>
                <span className="font-display font-extrabold text-sm uppercase tracking-tight">
                  Will<span className="text-neon">Just</span>Play
                </span>
              </div>
              <button onClick={onClose} data-testid="auth-modal-close" className="text-slate-500 hover:text-coral transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 border-b border-line">
              {["login", "register"].map((t) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  data-testid={`auth-tab-${t}`}
                  className={`text-[11px] font-bold uppercase tracking-[0.2em] py-3.5 transition-colors ${
                    tab === t || (tab === "forgot" && t === "login")
                      ? "bg-neon/10 text-neon"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t === "login" ? "Masuk" : "Daftar"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="p-6 space-y-3">
              {tab === "register" && (
                <div className={inputWrap}>
                  <User size={15} className="text-slate-500" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama kamu"
                    data-testid="auth-name-input"
                    className={inputCls}
                  />
                </div>
              )}
              <div className={inputWrap}>
                <Mail size={15} className="text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  data-testid="auth-email-input"
                  className={inputCls}
                />
              </div>

              {tab !== "forgot" && (
                <div className={inputWrap}>
                  <Lock size={15} className="text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tab === "register" ? "Password (min. 6 karakter)" : "Password"}
                    data-testid="auth-password-input"
                    className={inputCls}
                  />
                </div>
              )}

              {error && (
                <p data-testid="auth-error" className="text-[11px] font-mono text-coral">
                  {error}
                </p>
              )}

              {needsVerify && tab === "login" && (
                <div
                  data-testid="auth-verify-notice"
                  className="border border-neon/40 bg-neon/5 px-3.5 py-3.5 space-y-3"
                >
                  <p className="flex items-start gap-2 text-[11px] font-mono text-slate-300 leading-relaxed">
                    <MailCheck size={14} className="mt-0.5 shrink-0 text-neon" />
                    <span>
                      Klik tombol verifikasi di email <strong>{email || "kamu"}</strong>, atau masukkan{" "}
                      <strong className="text-neon">Kode 6-Digit</strong> dari email di bawah ini:
                    </span>
                  </p>

                  <div className="flex gap-1.5">
                    <div className="flex-1 flex items-center gap-2 bg-void border border-line focus-within:border-neon px-2.5">
                      <KeyRound size={13} className="text-neon shrink-0" />
                      <input
                        type="text"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="Kode 6-Digit"
                        data-testid="auth-otp-input"
                        className="w-full bg-transparent outline-none text-xs font-mono font-bold tracking-widest py-2 text-white placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyOtpInline}
                      disabled={verifyingOtp}
                      data-testid="auth-otp-verify-button"
                      className="bg-lime text-void font-display font-bold text-[10px] uppercase tracking-wider px-3 py-2 hover:bg-neon transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0"
                    >
                      {verifyingOtp ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Aktifkan
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={resendVerification}
                    disabled={resending}
                    data-testid="auth-resend-verification-button"
                    className="w-full flex items-center justify-center gap-2 border border-neon/50 text-neon font-mono text-[10px] uppercase tracking-[0.15em] py-2 hover:bg-neon/10 transition-colors duration-300 disabled:opacity-50"
                  >
                    {resending ? <Loader2 size={13} className="animate-spin" /> : <MailCheck size={13} />}
                    Kirim ulang email verifikasi
                  </button>
                </div>
              )}

              {devPreviewUrl && (
                <div
                  data-testid="auth-dev-preview-box"
                  className="border border-lime/50 bg-lime/5 px-3 py-3 space-y-2"
                >
                  <p className="text-[10px] font-mono text-slate-300 leading-relaxed">
                    Pratinjau Tautan Langsung (Mode Dev / Fallback aktif — Resend API & SMTP dapat diatur di Panel Admin):
                  </p>
                  <a
                    href={devPreviewUrl}
                    onClick={() => onClose()}
                    data-testid="auth-dev-preview-link"
                    className="w-full flex items-center justify-center gap-1.5 bg-lime text-void font-display font-bold text-[10px] uppercase tracking-[0.15em] py-2.5 hover:bg-neon transition-colors"
                  >
                    <ExternalLink size={12} /> {devPreviewLabel || "Buka Tautan Verifikasi"}
                  </a>
                </div>
              )}

              {tab === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTab("forgot")}
                    data-testid="auth-forgot-link"
                    className="text-[10px] font-mono text-slate-400 hover:text-neon"
                  >
                    Lupa password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                data-testid="auth-submit-button"
                className="w-full flex items-center justify-center gap-2 bg-neon text-void font-display font-bold text-xs uppercase tracking-[0.2em] py-3.5 hover:bg-lime transition-colors duration-300 disabled:opacity-50"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {tab === "register" ? "Buat Akun" : tab === "forgot" ? "Reset Password" : "Masuk"}
              </button>

              <p className="text-center text-[11px] font-mono text-slate-500">
                {tab === "forgot" ? (
                  <button type="button" onClick={() => setTab("login")} className="text-neon hover:underline">
                    Kembali ke Login
                  </button>
                ) : (
                  <>
                    {tab === "register" ? "Sudah punya akun? " : "Belum punya akun? "}
                    <button
                      type="button"
                      onClick={() => setTab(tab === "register" ? "login" : "register")}
                      data-testid="auth-switch-tab"
                      className="text-neon hover:underline"
                    >
                      {tab === "register" ? "Masuk" : "Daftar"}
                    </button>
                  </>
                )}
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
