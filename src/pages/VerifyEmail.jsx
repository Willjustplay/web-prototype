import { useEffect, useState, useRef } from "react";
import { useSearchParams, useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Home, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { tokenParam } = useParams();
  const navigate = useNavigate();
  const token = params.get("token") || params.get("verify_token") || params.get("otp") || tokenParam || "";

  const [status, setStatus] = useState(token ? "loading" : "manual");
  const [message, setMessage] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [isTestPreview, setIsTestPreview] = useState(false);

  // Manual OTP / Token verification form
  const [manualEmail, setManualEmail] = useState(params.get("email") || "");
  const [manualCode, setManualCode] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  const hasFetched = useRef(false);
  const { openAuth } = useAuth();

  const pingPairedInstance = (tok, em) => {
    try {
      const host = window.location.host || "";
      if (host.startsWith("ais-pre-")) {
        const devOrigin = `${window.location.protocol}//${host.replace(/^ais-pre-/i, "ais-dev-")}`;
        fetch(`${devOrigin}/api/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tok, email: em }),
        }).catch(() => {});
      }
    } catch {
      // ignore cross-instance ping errors
    }
  };

  useEffect(() => {
    if (!token) {
      setStatus("manual");
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;

    api
      .post("/auth/verify-email", { token, email: params.get("email") || undefined })
      .then((res) => {
        setStatus("success");
        setMessage(res.data?.message || "Email berhasil diverifikasi! Sekarang Anda dapat login.");
        setVerifiedEmail(res.data?.email || "");
        setIsTestPreview(Boolean(res.data?.is_test_preview));
        pingPairedInstance(token, res.data?.email || "");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          formatApiError(err.response?.data?.detail) ||
            "Gagal memverifikasi email atau tautan sudah kedaluwarsa. Anda juga dapat memasukkan kode 6-digit dari email di bawah ini."
        );
      });
  }, [token, params]);

  const handleManualVerify = async (e) => {
    e.preventDefault();
    const cleanedCode = String(manualCode || "").trim();
    if (!cleanedCode) {
      toast.error("Masukkan kode verifikasi 6-digit atau token dari email Anda");
      return;
    }
    setSubmittingManual(true);
    try {
      const { data } = await api.post("/auth/verify-email", {
        token: cleanedCode,
        email: manualEmail.trim() || undefined,
      });
      setStatus("success");
      setMessage(data?.message || "Email berhasil diverifikasi!");
      setVerifiedEmail(data?.email || manualEmail.trim());
      setIsTestPreview(Boolean(data?.is_test_preview));
      pingPairedInstance(cleanedCode, data?.email || manualEmail.trim());
      toast.success("Email berhasil diverifikasi!");
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) || "Kode verifikasi tidak valid atau sudah kedaluwarsa"
      );
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleLoginClick = () => {
    navigate("/");
    setTimeout(() => {
      openAuth("login");
    }, 80);
  };

  return (
    <div className="min-h-screen bg-void grid-bg flex items-center justify-center px-4 py-10 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full bg-panel border border-line p-8 sm:p-10 text-center"
      >
        {status === "loading" && (
          <>
            <Loader2 size={52} className="mx-auto text-neon animate-spin" />
            <h1 className="font-display font-bold uppercase text-lg mt-6 text-white">
              Memverifikasi Email...
            </h1>
            <p className="text-xs text-slate-400 mt-3 font-mono">
              Mohon tunggu sebentar, sistem sedang mengaktifkan akun WillJustPlay Anda.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
            >
              <CheckCircle2 size={60} className="mx-auto text-lime" />
            </motion.div>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-lime/10 border border-lime/40 text-lime font-mono text-[10px] uppercase tracking-widest">
              <ShieldCheck size={12} /> {isTestPreview ? "Mode Pratinjau Tes Admin" : "Akun Terverifikasi"}
            </div>
            <h1 className="font-display font-black uppercase text-xl mt-4 text-white">
              {isTestPreview ? (
                <>
                  Tautan Tes <span className="text-lime">Berfungsi!</span>
                </>
              ) : (
                <>
                  Email <span className="text-lime">Terverifikasi!</span>
                </>
              )}
            </h1>
            {verifiedEmail && (
              <p className="text-xs font-mono text-neon mt-1.5 font-bold">{verifiedEmail}</p>
            )}
            <p className="text-xs text-slate-300 mt-3 leading-relaxed font-mono">{message}</p>
            <div className="mt-8 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleLoginClick}
                data-testid="verify-login-button"
                className="w-full flex items-center justify-center gap-2 bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] py-3.5 hover:bg-lime transition-colors duration-300"
              >
                Login ke Akun Sekarang
              </button>
              <Link
                to="/"
                className="w-full flex items-center justify-center gap-2 border border-line hover:border-neon/60 text-slate-300 hover:text-neon text-[10px] font-bold uppercase tracking-[0.2em] py-3.5 transition-colors duration-300"
              >
                <Home size={14} /> Kembali ke Beranda
              </Link>
            </div>
          </>
        )}

        {(status === "error" || status === "manual") && (
          <>
            {status === "error" ? (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                >
                  <XCircle size={52} className="mx-auto text-coral" />
                </motion.div>
                <h1 className="font-display font-bold uppercase text-xl mt-5 text-white">
                  Verifikasi <span className="text-coral">Tautan</span>
                </h1>
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed font-mono">{message}</p>
              </>
            ) : (
              <>
                <MailCheck size={48} className="mx-auto text-neon" />
                <h1 className="font-display font-bold uppercase text-xl mt-5 text-white">
                  Verifikasi <span className="text-neon">Email Akun</span>
                </h1>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed font-mono">
                  Masukkan Kode Verifikasi 6-Digit yang dikirimkan ke email Anda untuk mengaktifkan akun secara instan.
                </p>
              </>
            )}

            <form onSubmit={handleManualVerify} className="mt-6 space-y-3 text-left">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Email Terdaftar (Opsional)
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="nama@email.com"
                  data-testid="verify-manual-email-input"
                  className="w-full bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-white placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Kode Verifikasi 6-Digit / Token
                </label>
                <div className="flex items-center gap-2 bg-void border border-line focus-within:border-neon px-3.5">
                  <KeyRound size={14} className="text-neon shrink-0" />
                  <input
                    type="text"
                    required
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Contoh: 482910"
                    data-testid="verify-manual-code-input"
                    className="w-full bg-transparent outline-none text-sm font-mono font-bold tracking-widest py-2.5 text-white placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submittingManual}
                data-testid="verify-manual-submit-button"
                className="w-full flex items-center justify-center gap-2 bg-neon text-void font-display font-bold text-[11px] uppercase tracking-[0.2em] py-3.5 hover:bg-lime transition-colors duration-300 disabled:opacity-50"
              >
                {submittingManual ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Verifikasi Kode Sekarang
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-line">
              <Link
                to="/"
                className="w-full flex items-center justify-center gap-2 border border-line hover:border-neon/60 text-slate-300 hover:text-neon text-[10px] font-bold uppercase tracking-[0.2em] py-3 transition-colors duration-300"
              >
                <Home size={14} /> Kembali ke Beranda
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
