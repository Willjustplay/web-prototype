import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  Clock,
  Home,
  MessageCircle,
  KeyRound,
  ExternalLink,
  Copy,
  Upload,
  XCircle,
  Star,
  Coins,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Mail,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  api,
  waLink,
  imgSrc,
  formatIDR,
  formatUSD,
  removeActiveClientSession,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ReviewModal } from "@/components/ReviewModal";

function parseClientDeliveryInfo(rawInput, serverStructured) {
  if (serverStructured && serverStructured.is_structured) {
    return {
      isStructured: true,
      accountType: serverStructured.account_type || "Gmail",
      accountEmail: serverStructured.account_email || "",
      accountPassword: serverStructured.account_password || "",
      formattedBracket:
        serverStructured.formatted_bracket ||
        `[${serverStructured.account_type}] [${serverStructured.account_email}] [${serverStructured.account_password}]`,
      extraNotes: serverStructured.extra_notes || "",
    };
  }
  const raw = String(rawInput || "").trim();
  const match = raw.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/);
  if (match) {
    const accountType = match[1].trim();
    const accountEmail = match[2].trim();
    const accountPassword = match[3].trim();
    return {
      isStructured: true,
      accountType,
      accountEmail,
      accountPassword,
      formattedBracket: `[${accountType}] [${accountEmail}] [${accountPassword}]`,
      extraNotes: raw
        .replace(match[0], "")
        .replace(/^\s*[-•|:]?\s*/, "")
        .trim(),
    };
  }
  return {
    isStructured: false,
    accountType: "",
    accountEmail: "",
    accountPassword: "",
    formattedBracket: raw,
    extraNotes: "",
  };
}

function PureQrisImage({
  qrisString,
  src,
  alt = "QRIS",
  className = "w-56 h-56 object-contain",
  testId = "paykita-qris-image",
}) {
  const [pureSrc, setPureSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    const rawQris = String(qrisString || "").trim();

    if (rawQris) {
      QRCode.toDataURL(rawQris, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 420,
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then((url) => {
          if (!cancelled) setPureSrc(url);
        })
        .catch(() => {
          if (!cancelled) setPureSrc(src || "");
        });
      return () => {
        cancelled = true;
      };
    }

    if (!src) {
      setPureSrc("");
      return () => {
        cancelled = true;
      };
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      if (cancelled) return;
      try {
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const results = await detector.detect(img);
          if (!cancelled && results && results.length > 0) {
            const first = results[0];
            if (first.rawValue) {
              const generated = await QRCode.toDataURL(first.rawValue, {
                errorCorrectionLevel: "M",
                margin: 1,
                width: 420,
                color: { dark: "#000000", light: "#ffffff" },
              });
              if (!cancelled) {
                setPureSrc(generated);
                return;
              }
            }
            if (first.boundingBox) {
              const bb = first.boundingBox;
              const pad = Math.round(Math.max(bb.width, bb.height) * 0.04);
              const sx = Math.max(0, bb.x - pad);
              const sy = Math.max(0, bb.y - pad);
              const sw = Math.min(img.naturalWidth - sx, bb.width + pad * 2);
              const sh = Math.min(img.naturalHeight - sy, bb.height + pad * 2);
              const canvas = document.createElement("canvas");
              canvas.width = 420;
              canvas.height = 420;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, 420, 420);
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 420, 420);
                if (!cancelled) {
                  setPureSrc(canvas.toDataURL("image/png"));
                  return;
                }
              }
            }
          }
        }
      } catch {
        // Fallback to aspect-ratio check below
      }

      if (img.naturalWidth > 0 && img.naturalHeight > img.naturalWidth * 1.15) {
        try {
          const side = Math.round(img.naturalWidth * 0.76);
          const sx = Math.round((img.naturalWidth - side) / 2);
          const sy = Math.round(img.naturalHeight * 0.25);
          const sh = Math.min(side, img.naturalHeight - sy);
          const canvas = document.createElement("canvas");
          canvas.width = 420;
          canvas.height = 420;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 420, 420);
            ctx.drawImage(img, sx, sy, side, sh, 0, 0, 420, 420);
            if (!cancelled) {
              setPureSrc(canvas.toDataURL("image/png"));
              return;
            }
          }
        } catch {
          // If canvas is tainted by CORS, fall back to original image
        }
      }

      if (!cancelled) setPureSrc(src);
    };
    img.onerror = () => {
      if (!cancelled) setPureSrc(src);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [qrisString, src]);

  const finalUrl =
    pureSrc ||
    src ||
    (qrisString
      ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=4&data=${encodeURIComponent(
          qrisString
        )}`
      : "");

  if (!finalUrl) {
    return <p className="text-xs text-coral p-6">Kode QRIS sedang dimuat...</p>;
  }

  return (
    <img
      src={finalUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      data-testid={testId}
    />
  );
}

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id") || params.get("order_id");
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState("checking");
  const [delivery, setDelivery] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [txData, setTxData] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [txHashInput, setTxHashInput] = useState("");
  const [submittingHash, setSubmittingHash] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshingQris, setRefreshingQris] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [cancellingPayment, setCancellingPayment] = useState(false);
  const [now, setNow] = useState(Date.now());
  void paymentType;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    let tries = 0;
    let stopped = false;
    const applyData = (data) => {
      setTxData(data);
      const isPaykita =
        data.provider === "paykita" || data.payment_type === "paykita";
      const isConfirmedPaid = isPaykita
        ? data.payment_status === "paid" && data.paykita_confirmed !== false
        : data.payment_status === "paid" || data.status === "completed";

      if (isConfirmedPaid) {
        removeActiveClientSession(sessionId);
        setStatus("paid");
        setDelivery(data.delivery_info || "");
        setPaymentType(data.payment_type || "");
        if (
          data.product_type === "topup" &&
          data.digiflazz_status === "Pending" &&
          tries < 120
        ) {
          return false;
        }
        return true;
      }
      if (data.status === "cancelled_out_of_stock") {
        removeActiveClientSession(sessionId);
        setStatus("out_of_stock");
        return true;
      }
      if (data.status === "cancelled_by_buyer") {
        removeActiveClientSession(sessionId);
        setStatus("cancelled_by_buyer");
        return true;
      }
      if (data.provider === "manual") {
        if (data.status === "rejected" || data.payment_status === "failed") {
          removeActiveClientSession(sessionId);
          setStatus("rejected");
          return true;
        }
        if (data.status === "waiting_approval") {
          setStatus("manual_waiting");
          return false;
        }
        setStatus("manual_pending");
        return false;
      }
      if (isPaykita) {
        if (data.payment_status === "failed") {
          removeActiveClientSession(sessionId);
          setStatus(data.status === "expired" ? "expired" : "failed");
          return true;
        }
        if (tries > 400) {
          setStatus("pending");
          return true;
        }
        setStatus("paykita_pending");
        return false;
      }
      if (data.payment_status === "failed") {
        removeActiveClientSession(sessionId);
        setStatus("failed");
        return true;
      }
      if (tries > 12) {
        setStatus("pending");
        return true;
      }
      return false;
    };
    const poll = async () => {
      tries += 1;
      try {
        if (tries > 1 && tries % 2 === 0) {
          await api.post(`/payments/paykita/sync/${sessionId}`).catch(() => {});
        }
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (stopped) return;
        if (applyData(data)) clearInterval(timer);
      } catch (err) {
        if (stopped) return;
        if (err.response?.status === 404 || tries > 12) {
          setStatus("error");
          clearInterval(timer);
        }
      }
    };
    const timer = setInterval(poll, 3000);
    poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  const uploadProof = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("proof", file);
      if (txHashInput.trim()) fd.append("tx_hash", txHashInput.trim());
      await api.post(`/payments/manual/upload-proof/${sessionId}`, fd);
      toast.success("Bukti transfer berhasil diupload");
      setStatus("manual_waiting");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mengupload bukti");
    } finally {
      setUploading(false);
    }
  };

  const submitTxHash = async () => {
    if (!txHashInput.trim()) {
      toast.error("Masukkan TXID / Hash transaksi terlebih dahulu");
      return;
    }
    setSubmittingHash(true);
    try {
      await api.post(`/payments/crypto/submit-tx/${sessionId}`, {
        tx_hash: txHashInput.trim(),
      });
      toast.success("TXID / Hash transaksi crypto berhasil dikirim");
      setStatus("manual_waiting");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mengirim TXID transaksi");
    } finally {
      setSubmittingHash(false);
    }
  };

  const isCryptoOrder =
    txData?.payment_type === "crypto" ||
    txData?.manual_destination?.type === "crypto";

  const isLink = /^https?:\/\//i.test(delivery.trim());
  const parsedCred = parseClientDeliveryInfo(delivery, txData?.structured_delivery);
  const isTopupOrder = txData?.product_type === "topup";
  const isWalletTopupOrder =
    txData?.order_type === "wallet_topup" || txData?.product_type === "wallet_topup";

  const copyDelivery = () => {
    const textToCopy = parsedCred.isStructured ? parsedCred.formattedBracket : delivery;
    navigator.clipboard
      .writeText(textToCopy)
      .then(() =>
        toast.success(
          parsedCred.isStructured
            ? "Format penuh [Tipe Akun] [Email] [Password] berhasil disalin!"
            : "Data pesanan berhasil disalin"
        )
      );
  };

  const copyFieldText = (label, value) => {
    navigator.clipboard
      .writeText(String(value || ""))
      .then(() => toast.success(`${label} berhasil disalin`));
  };

  const handleResendOrderEmail = async () => {
    if (!sessionId) return;
    setResendingEmail(true);
    try {
      const { data } = await api.post(`/payments/resend-order-email/${sessionId}`);
      toast.success(
        data?.message ||
          `Email berhasil dikirim ke ${data?.to_email || txData?.buyer_email}`
      );
      setTxData((prev) =>
        prev
          ? {
              ...prev,
              fulfillment_email_sent: true,
              fulfillment_email_sent_at: data?.sent_at || new Date().toISOString(),
            }
          : prev
      );
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Gagal mengirim ulang email pesanan"
      );
    } finally {
      setResendingEmail(false);
    }
  };

  const checkNow = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post(`/payments/paykita/sync/${sessionId}`);
      if (data.payment_status === "paid" && data.confirmed !== false) {
        toast.success(data.message || "Pembayaran terkonfirmasi!");
      } else if (data.payment_status === "failed") {
        toast.error(data.message || "Pembayaran kedaluwarsa / dibatalkan");
      } else {
        toast.info(
          data.message ||
            "Pembayaran belum terdeteksi. Silakan selesaikan pembayaran terlebih dahulu."
        );
      }
      const r = await api.get(`/payments/status/${sessionId}`);
      setTxData(r.data);
      if (
        r.data.payment_status === "paid" &&
        r.data.paykita_confirmed !== false
      ) {
        setStatus("paid");
        setDelivery(r.data.delivery_info || "");
      } else if (r.data.status === "cancelled_out_of_stock") {
        setStatus("out_of_stock");
      } else if (r.data.payment_status === "failed") {
        setStatus(r.data.status === "expired" ? "expired" : "failed");
      } else {
        setStatus("paykita_pending");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Gagal mengecek status pembayaran"
      );
    } finally {
      setSyncing(false);
    }
  };

  const cancelPaymentNow = async () => {
    if (!sessionId || cancellingPayment) return;
    setCancellingPayment(true);
    try {
      const { data } = await api.post(`/payments/cancel/${sessionId}`);
      removeActiveClientSession(sessionId);
      setStatus("cancelled_by_buyer");
      setTxData((prev) =>
        prev
          ? {
              ...prev,
              status: "cancelled_by_buyer",
              payment_status: "failed",
              qris_string: null,
              qris_image: null,
              va_number: null,
              pay_url: null,
            }
          : prev
      );
      toast.success(
        data?.message ||
          "Pembayaran berhasil dibatalkan. Anda kini dapat memesan produk ini kembali."
      );
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Gagal membatalkan pembayaran"
      );
    } finally {
      setCancellingPayment(false);
    }
  };

  const expiresIn = txData?.expired_at
    ? Math.max(
        0,
        Math.floor((new Date(txData.expired_at).getTime() - now) / 1000)
      )
    : null;
  const mmss = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
      2,
      "0"
    )}`;

  const paidSyncedSessionRef = useRef("");

  useEffect(() => {
    if (status !== "paid" || !sessionId) return;
    let alive = true;
    if (paidSyncedSessionRef.current !== sessionId) {
      paidSyncedSessionRef.current = sessionId;
      refreshUser?.();
    }
    if (!isWalletTopupOrder) {
      api
        .get(`/reviews/eligibility/${sessionId}`, {
          params: user?.email ? { email: user.email } : {},
        })
        .then(({ data }) => alive && setReviewEligibility(data))
        .catch(() => alive && setReviewEligibility(null));
    }
    return () => {
      alive = false;
    };
  }, [status, sessionId, user?.email, isWalletTopupOrder, refreshUser]);

  const reviewProductTitle =
    txData?.product_title || reviewEligibility?.order?.product_title || "";

  // Determine active checkout step for visual clarity (1: Bayar, 2: Verifikasi, 3: Selesai)
  const currentStep =
    status === "paid"
      ? 3
      : status === "manual_waiting" || status === "pending" || status === "checking"
      ? 2
      : 1;

  return (
    <div
      data-testid="payment-success-page"
      className="min-h-screen bg-void grid-bg flex items-center justify-center px-4 py-8 sm:py-12 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative max-w-lg w-full bg-panel border border-line p-5 sm:p-7 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
      >
        {/* Clean 3-Step Progress Indicator */}
        {status !== "error" && (
          <div className="grid grid-cols-3 gap-2 pb-4 mb-5 border-b border-line/70 text-xs">
            <div
              className={`flex items-center gap-1.5 font-mono ${
                currentStep >= 1 ? "text-neon font-semibold" : "text-slate-500"
              }`}
            >
              <span>01.</span>
              <span className="truncate">Pembayaran</span>
            </div>
            <div
              className={`flex items-center justify-center gap-1.5 font-mono ${
                currentStep >= 2 ? "text-neon font-semibold" : "text-slate-500"
              }`}
            >
              <span>02.</span>
              <span className="truncate">Verifikasi</span>
            </div>
            <div
              className={`flex items-center justify-end gap-1.5 font-mono ${
                currentStep === 3 ? "text-lime font-semibold" : "text-slate-500"
              }`}
            >
              <span>03.</span>
              <span className="truncate">Selesai</span>
            </div>
          </div>
        )}

        {/* Order Metadata Bar (Product Name & Copyable Session ID) */}
        {txData && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-void/60 border border-line/70 px-3.5 py-2.5 mb-5 text-left">
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-slate-400">Produk Pesanan</p>
              <p className="text-xs font-semibold text-slate-100 truncate">
                {txData.product_title || "Pesanan Produk"}
              </p>
            </div>
            {sessionId && (
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(sessionId)
                    .then(() => toast.success("ID Pesanan disalin"))
                }
                title="Salin ID Pesanan"
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-neon transition-colors shrink-0"
              >
                <span className="truncate max-w-[130px]">{sessionId}</span>
                <Copy size={11} />
              </button>
            )}
          </div>
        )}

        {/* STATE: CHECKING */}
        {status === "checking" && (
          <div className="py-8 text-center">
            <Loader2
              size={44}
              className="mx-auto text-neon animate-spin"
              data-testid="payment-checking-icon"
            />
            <h1 className="font-display font-bold text-lg mt-5">
              Memuat Instruksi Pembayaran...
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Mohon tunggu sebentar, sedang menyiapkan sesi transaksi kamu.
            </p>
          </div>
        )}

        {/* STATE: PAID / COMPLETED */}
        {status === "paid" && (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <CheckCircle2
                size={52}
                className="mx-auto text-lime"
                data-testid="payment-paid-icon"
              />
            </motion.div>
            <h1
              className="font-display font-bold text-xl mt-4 text-slate-100"
              data-testid="payment-success-title"
            >
              {isWalletTopupOrder ? (
                <>
                  Top Up Saldo <span className="text-lime">Berhasil</span>
                </>
              ) : (
                <>
                  Pembayaran <span className="text-lime">Berhasil</span>
                </>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {isWalletTopupOrder
                ? `Saldo sebesar ${formatIDR(txData?.amount || 0)} telah berhasil ditambahkan ke Saldo Akun Anda.`
                : isTopupOrder
                ? "Pembayaran Top Up kamu telah lunas dan invoice resmi telah dikirim ke email."
                : "Pembayaran terkonfirmasi! Akses data akun telah dikirim ke email kamu & tersedia di bawah ini."}
            </p>

            {/* Email Delivery Confirmation & Resend Banner */}
            {txData?.buyer_email && !isWalletTopupOrder && (
              <div
                data-testid="email-delivery-banner"
                className="mt-4 flex flex-wrap items-center justify-between gap-2.5 bg-lime/10 border border-lime/40 px-3.5 py-2.5 text-left"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Mail size={15} className="text-lime shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-lime">
                      {isTopupOrder
                        ? "Invoice Top Up Terkirim ke Email"
                        : "Akses Data Akun Terkirim ke Email"}
                    </p>
                    <p
                      className="text-xs font-mono text-slate-200 truncate"
                      data-testid="paid-buyer-email"
                    >
                      {txData.buyer_email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResendOrderEmail}
                  disabled={resendingEmail}
                  data-testid="resend-order-email-button"
                  className="inline-flex items-center gap-1.5 border border-lime/50 bg-void/80 hover:bg-lime hover:text-void text-lime text-[11px] font-mono font-semibold px-2.5 py-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {resendingEmail ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  <span>{resendingEmail ? "Mengirim..." : "Kirim Ulang Email"}</span>
                </button>
              </div>
            )}

            {/* Official Top Up Invoice Card when Top Up order is Paid */}
            {isTopupOrder && txData && (
              <div
                data-testid="topup-invoice-card"
                className="mt-4 text-left border border-neon/40 bg-void/80 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-line/70">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-neon" />
                    <span className="text-xs font-semibold text-neon uppercase tracking-wider">
                      Invoice Resmi Top Up Game
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                      txData.digiflazz_status === "Sukses" || txData.status === "delivered"
                        ? "text-lime bg-lime/10 border-lime/30"
                        : txData.digiflazz_status === "Gagal"
                          ? "text-coral bg-coral/10 border-coral/30"
                          : "text-neon bg-neon/10 border-neon/30"
                    }`}
                  >
                    {txData.digiflazz_status === "Sukses" || txData.status === "delivered"
                      ? "TOP UP SUKSES"
                      : txData.digiflazz_status === "Gagal"
                        ? "GANGGUAN / PROSES CS"
                        : "SEDANG DIPROSES"}
                  </span>
                </div>
                <dl className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">No. Invoice</dt>
                    <dd className="text-slate-100 font-semibold">#{sessionId}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Game</dt>
                    <dd className="text-slate-100 font-semibold">
                      {txData.game_name || txData.game?.name || "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Item Nominal</dt>
                    <dd className="text-neon font-bold">
                      {txData.denomination_label || txData.product_title || "-"}
                    </dd>
                  </div>
                  {(txData.customer_no || txData.destination) && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">ID Tujuan</dt>
                      <dd className="text-slate-200 text-right break-all">
                        {txData.customer_no ||
                          Object.values(txData.destination || {})
                            .filter(Boolean)
                            .join(" / ")}
                      </dd>
                    </div>
                  )}
                  {txData.verified_nickname && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Nickname</dt>
                      <dd className="text-lime font-bold">{txData.verified_nickname}</dd>
                    </div>
                  )}
                  {txData.digiflazz_sn && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Serial Number (SN)</dt>
                      <dd className="text-lime font-bold text-right break-all" data-testid="topup-invoice-sn">
                        {txData.digiflazz_sn}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 pt-1.5 border-t border-line/60">
                    <dt className="text-slate-300 font-semibold">Total Dibayar</dt>
                    <dd className="text-lime font-bold">
                      {formatIDR(txData.pay_amount || txData.amount || 0)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {isWalletTopupOrder ? (
              <div
                data-testid="wallet-topup-success-card"
                className="mt-4 text-left border border-lime/40 bg-lime/10 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300">Nominal Saldo Ditambahkan</span>
                  <strong className="text-lime text-sm font-extrabold">
                    +{formatIDR(txData?.amount || 0)}
                  </strong>
                </div>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">
                  {delivery ||
                    "Saldo Akun Anda sudah aktif dan dapat langsung digunakan untuk membeli Produk Akun maupun Top Up Game."}
                </p>
                <Link
                  to="/isi-saldo"
                  className="inline-flex items-center justify-center gap-2 w-full bg-lime text-void font-display font-bold text-xs uppercase tracking-wider py-2.5 px-4 mt-1 hover:bg-neon transition-colors"
                >
                  <span>Lihat Saldo Akun Saya</span>
                </Link>
              </div>
            ) : delivery ? (
              <div
                className="mt-4 text-left border border-neon/40 bg-void/80 p-4 space-y-3"
                data-testid="delivery-info-box"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound size={14} className="text-neon" />
                    <span className="text-xs font-semibold text-neon">
                      {parsedCred.isStructured
                        ? "Data Akses Akun [Tipe Akun] [Email] [Password]"
                        : "Data Akun / Pesanan Kamu"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyDelivery}
                    data-testid="delivery-info-copy"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-neon hover:text-lime transition-colors cursor-pointer"
                  >
                    <Copy size={12} />
                    <span>
                      {parsedCred.isStructured ? "Salin Format Penuh" : "Salin Data"}
                    </span>
                  </button>
                </div>

                {isLink ? (
                  <a
                    href={delivery.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="delivery-info-link"
                    className="flex items-center justify-center gap-2 bg-neon text-void font-display font-bold text-xs uppercase tracking-wider py-3 px-4 hover:bg-lime transition-colors duration-200 break-all"
                  >
                    <ExternalLink size={14} />
                    <span>Buka Akses Akun</span>
                  </a>
                ) : parsedCred.isStructured ? (
                  <div className="space-y-2.5">
                    {/* Full [Tipe Akun] [Email] [Password] String */}
                    <div className="bg-panel border border-neon/30 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          Format Lengkap
                        </span>
                        <span className="text-[10px] font-mono text-lime">
                          [Tipe Akun] [Email] [Password]
                        </span>
                      </div>
                      <pre
                        data-testid="delivery-info-text"
                        className="whitespace-pre-wrap break-all font-mono text-xs font-bold text-neon leading-relaxed"
                      >
                        {parsedCred.formattedBracket}
                      </pre>
                    </div>

                    {/* Per-Part Structured Credential Rows with Individual Copy Buttons */}
                    <div className="divide-y divide-line/70 border border-line bg-panel/90">
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase text-slate-400">
                            Tipe Akun
                          </p>
                          <p
                            className="text-xs font-mono font-bold text-slate-100 truncate"
                            data-testid="delivery-account-type"
                          >
                            {parsedCred.accountType}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyFieldText("Tipe Akun", parsedCred.accountType)
                          }
                          data-testid="copy-account-type"
                          className="inline-flex items-center gap-1 border border-line hover:border-neon px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-neon transition-colors shrink-0 cursor-pointer"
                        >
                          <Copy size={11} />
                          <span>Salin</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase text-slate-400">
                            Email / Username
                          </p>
                          <p
                            className="text-xs font-mono font-bold text-neon break-all"
                            data-testid="delivery-account-email"
                          >
                            {parsedCred.accountEmail}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyFieldText("Email / Username", parsedCred.accountEmail)
                          }
                          data-testid="copy-account-email"
                          className="inline-flex items-center gap-1 border border-line hover:border-neon px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-neon transition-colors shrink-0 cursor-pointer"
                        >
                          <Copy size={11} />
                          <span>Salin</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase text-slate-400">
                            Password Akun
                          </p>
                          <p
                            className="text-xs font-mono font-bold text-lime break-all"
                            data-testid="delivery-account-password"
                          >
                            {parsedCred.accountPassword}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyFieldText("Password", parsedCred.accountPassword)
                          }
                          data-testid="copy-account-password"
                          className="inline-flex items-center gap-1 border border-line hover:border-lime px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-lime transition-colors shrink-0 cursor-pointer"
                        >
                          <Copy size={11} />
                          <span>Salin</span>
                        </button>
                      </div>
                    </div>

                    {parsedCred.extraNotes && (
                      <div className="bg-panel/60 border border-line/70 px-3 py-2 text-xs font-mono text-slate-300 whitespace-pre-line">
                        {parsedCred.extraNotes}
                      </div>
                    )}
                  </div>
                ) : (
                  <pre
                    data-testid="delivery-info-text"
                    className="whitespace-pre-wrap break-words font-mono text-xs text-slate-100 bg-panel border border-line p-3 leading-relaxed"
                  >
                    {delivery}
                  </pre>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Simpan informasi akun ini dengan aman. Salinan lengkap juga telah dikirimkan ke alamat email kamu.
                </p>
              </div>
            ) : (
              <div className="mt-5 p-4 bg-void/70 border border-line text-xs text-slate-300 leading-relaxed">
                Detail pesanan / data akun telah dikirimkan ke alamat Email yang kamu daftarkan.
              </div>
            )}

            <p
              className="text-[11px] font-mono text-slate-500 mt-4 break-all"
              data-testid="payment-session-id"
            >
              ID Sesi: {sessionId}
            </p>

            {!isWalletTopupOrder && (
              !reviewEligibility?.has_review ? (
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  data-testid="payment-review-button"
                  className="mt-4 w-full flex items-center justify-center gap-2 border border-lime/50 text-lime hover:bg-lime/10 text-xs font-semibold py-2.5 px-4 transition-colors duration-200"
                >
                  <Star size={14} />
                  <span>Beri Ulasan Pembelian</span>
                </button>
              ) : (
                <p
                  data-testid="payment-review-done"
                  className="mt-4 flex items-center justify-center gap-1.5 text-xs font-mono text-lime"
                >
                  <Star size={13} fill="currentColor" />
                  <span>Terima kasih, ulasanmu sudah tersimpan</span>
                </p>
              )
            )}
          </div>
        )}

        {/* STATE: MANUAL TRANSFER OR CRYPTO PENDING */}
        {status === "manual_pending" && txData && (
          <>
            {isCryptoOrder ? (
              <div data-testid="crypto-pending-view" className="space-y-4">
                <div className="text-left">
                  <h1
                    className="font-display font-bold text-lg text-slate-100"
                    data-testid="crypto-pending-title"
                  >
                    Selesaikan Pembayaran Crypto
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Transfer tepat sesuai nominal berikut ke alamat wallet tujuan:
                  </p>
                </div>

                {/* Amount Card */}
                <div className="flex items-center justify-between bg-void/80 border border-lime/40 px-4 py-3">
                  <div className="text-left">
                    <p className="text-[11px] font-mono text-slate-400">
                      Total Transfer Crypto
                    </p>
                    <strong
                      className="text-base sm:text-lg font-mono font-bold text-lime tabular-nums"
                      data-testid="crypto-amount-usd"
                    >
                      {formatUSD(txData.amount_usd, txData.amount)} USD (
                      {txData.crypto_symbol ||
                        txData.manual_destination?.symbol ||
                        "USDT"}
                      )
                    </strong>
                    <span className="block text-[11px] font-mono text-slate-400">
                      Setara {formatIDR(txData.amount)}
                    </span>
                  </div>
                  <Coins size={22} className="text-lime shrink-0" />
                </div>

                {/* Destination Wallet Box */}
                <div
                  className="bg-void/80 border border-line p-4 text-left space-y-3"
                  data-testid="crypto-destination-box"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-line/70 pb-2.5">
                    <div>
                      <p className="text-[10px] font-mono text-slate-400">
                        Aset Crypto
                      </p>
                      <p className="font-semibold text-sm text-slate-100">
                        {txData.manual_destination?.name ||
                          txData.destination_name ||
                          "Crypto Wallet"}
                      </p>
                    </div>
                    {(txData.crypto_network ||
                      txData.manual_destination?.network) && (
                      <div className="text-right">
                        <p className="text-[10px] font-mono text-slate-400">
                          Jaringan / Network
                        </p>
                        <span className="text-xs font-mono font-bold text-lime">
                          {txData.crypto_network ||
                            txData.manual_destination?.network}
                        </span>
                      </div>
                    )}
                  </div>

                  {txData.manual_destination?.account_number &&
                    txData.manual_destination.account_number !== "-" && (
                      <div className="flex justify-center py-1">
                        <div className="bg-white p-2.5 border border-line">
                          <PureQrisImage
                            src={
                              txData.manual_destination.image
                                ? imgSrc(txData.manual_destination.image)
                                : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=4&data=${encodeURIComponent(
                                    txData.manual_destination.account_number
                                  )}`
                            }
                            alt="Wallet QR"
                            className="w-40 h-40 object-contain mx-auto block"
                            testId="crypto-wallet-qr"
                          />
                        </div>
                      </div>
                    )}

                  {txData.manual_destination?.account_number &&
                    txData.manual_destination.account_number !== "-" && (
                      <div>
                        <p className="text-[10px] font-mono text-slate-400 mb-1">
                          Alamat Wallet / Pay ID
                        </p>
                        <div className="flex items-center justify-between gap-2 bg-panel border border-line px-3 py-2">
                          <p
                            className="font-mono text-xs text-lime font-semibold break-all"
                            data-testid="manual-account-number"
                          >
                            {txData.manual_destination.account_number}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(
                                  txData.manual_destination.account_number
                                )
                                .then(() =>
                                  toast.success("Alamat wallet disalin")
                                )
                            }
                            data-testid="manual-copy-account"
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 border border-line text-xs font-mono text-slate-200 hover:text-lime hover:border-lime transition-colors"
                            aria-label="Salin alamat wallet"
                          >
                            <Copy size={12} />
                            <span>Salin</span>
                          </button>
                        </div>
                      </div>
                    )}
                </div>

                {/* TXID / Hash Input + Proof Upload */}
                <div className="space-y-3 text-left pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Konfirmasi dengan TXID atau Bukti Screenshot
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={txHashInput}
                        onChange={(e) => setTxHashInput(e.target.value)}
                        placeholder="Tempel TXID / Transaction Hash..."
                        data-testid="crypto-txhash-input"
                        className="flex-1 bg-void border border-line focus:border-lime outline-none text-xs font-mono px-3 py-2.5 text-slate-100 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={submitTxHash}
                        disabled={submittingHash || !txHashInput.trim()}
                        data-testid="crypto-submit-txhash"
                        className="bg-lime text-void font-display font-bold text-xs uppercase tracking-wider px-4 py-2.5 hover:bg-neon transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        {submittingHash ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          "Kirim TXID"
                        )}
                      </button>
                    </div>
                  </div>

                  <label
                    className="block w-full cursor-pointer bg-void/70 border border-dashed border-lime/50 hover:border-lime hover:bg-lime/5 transition-colors p-3.5 text-center"
                    data-testid="upload-proof-label"
                  >
                    <span className="text-xs font-semibold text-lime flex items-center justify-center gap-2">
                      {uploading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Upload size={16} />
                      )}
                      <span>
                        {uploading
                          ? "Mengupload Bukti..."
                          : "Upload Screenshot Bukti Transfer"}
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={uploadProof}
                      disabled={uploading}
                      data-testid="upload-proof-input"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                <div>
                  <h1
                    className="font-display font-bold text-lg text-slate-100"
                    data-testid="manual-pending-title"
                  >
                    Selesaikan Pembayaran
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Transfer sesuai nominal berikut lalu upload bukti pembayaran:
                  </p>
                </div>

                {/* Clean Nominal Box with Copy Button */}
                <div className="flex items-center justify-between gap-2 bg-void/80 border border-line px-4 py-3">
                  <div>
                    <p className="text-[10px] font-mono text-slate-400">
                      Nominal Transfer
                    </p>
                    <strong
                      className="text-lg font-mono font-bold text-neon tabular-nums"
                      data-testid="manual-amount"
                    >
                      {formatIDR(txData.amount)}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(String(txData.amount || 0))
                        .then(() => toast.success("Nominal transfer disalin"))
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line text-xs font-mono text-slate-300 hover:text-neon hover:border-neon transition-colors"
                  >
                    <Copy size={12} />
                    <span>Salin Nominal</span>
                  </button>
                </div>

                {/* Destination Account / QRIS Box */}
                <div
                  className="bg-void/80 border border-line p-4 space-y-3"
                  data-testid="manual-destination-box"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {txData.manual_destination?.name || "Tujuan Pembayaran"}
                    </span>
                    {txData.manual_destination?.account_name && (
                      <span className="text-xs font-mono text-slate-400">
                        a/n{" "}
                        <strong className="text-slate-100">
                          {txData.manual_destination.account_name}
                        </strong>
                      </span>
                    )}
                  </div>

                  {txData.manual_destination?.type === "qris" &&
                    txData.manual_destination?.image && (
                      <div className="py-2 flex justify-center">
                        <div className="bg-white p-3 border border-line">
                          <PureQrisImage
                            src={imgSrc(txData.manual_destination.image)}
                            alt="QRIS"
                            className="w-52 h-52 object-contain mx-auto block"
                            testId="manual-qris-image"
                          />
                        </div>
                      </div>
                    )}

                  {txData.manual_destination?.account_number &&
                    txData.manual_destination.account_number !== "-" && (
                      <div className="flex items-center justify-between gap-2 bg-panel border border-line px-3.5 py-2.5">
                        <p
                          className="font-mono text-base sm:text-lg text-slate-100 font-bold break-all tabular-nums"
                          data-testid="manual-account-number"
                        >
                          {txData.manual_destination.account_number}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(
                                txData.manual_destination.account_number
                              )
                              .then(() => toast.success("Nomor rekening disalin"))
                          }
                          data-testid="manual-copy-account"
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-neon text-void text-xs font-mono font-semibold hover:bg-lime transition-colors"
                          aria-label="Salin nomor"
                        >
                          <Copy size={12} />
                          <span>Salin</span>
                        </button>
                      </div>
                    )}

                  {!txData.manual_destination && (
                    <p className="text-xs text-coral">
                      Tujuan transfer tidak lagi tersedia. Silakan hubungi CS untuk bantuan.
                    </p>
                  )}
                </div>

                {/* Clean Proof Upload Button */}
                <div>
                  <label
                    className="block w-full cursor-pointer bg-neon text-void hover:bg-lime transition-colors py-3.5 px-4 text-center"
                    data-testid="upload-proof-label"
                  >
                    <span className="font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                      {uploading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Upload size={16} />
                      )}
                      <span>
                        {uploading
                          ? "Mengupload Bukti Transfer..."
                          : "Upload Bukti Pembayaran"}
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={uploadProof}
                      disabled={uploading}
                      data-testid="upload-proof-input"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 text-center mt-2">
                    Pesanan langsung diverifikasi setelah bukti pembayaran diunggah.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* STATE: PAYKITA / DUITKU AUTOMATIC GATEWAY PENDING */}
        {status === "paykita_pending" &&
          txData &&
          (() => {
            const finalPayAmount = Number(
              txData.pay_amount || txData.amount || 0
            );
            const baseAmount = Number(txData.base_amount || txData.amount || 0);
            const uniqueCode = Number(txData.unique_code || 0);
            const feeAmount = Number(txData.fee_amount || 0);
            const hasExtraAmount =
              uniqueCode > 0 ||
              feeAmount > 0 ||
              finalPayAmount !== baseAmount;
            const nonSvgServerImg =
              txData.qris_image &&
              !String(txData.qris_image).startsWith("data:image/svg+xml")
                ? imgSrc(txData.qris_image)
                : "";
            const progressPct =
              expiresIn !== null
                ? Math.max(
                    4,
                    Math.min(100, Math.round((expiresIn / 900) * 100))
                  )
                : 100;

            const handleRefreshPaykitaQris = async () => {
              setRefreshingQris(true);
              try {
                const { data } = await api.post(
                  `/payments/paykita/refresh-qris/${sessionId}`,
                  {
                    origin_url: window.location.origin,
                  }
                );
                toast.success(
                  data.message ||
                    `Instruksi ${
                      txData.gateway_name || "Pembayaran"
                    } berhasil diperbarui!`
                );
                const r = await api.get(`/payments/status/${sessionId}`);
                setTxData(r.data);
              } catch (err) {
                toast.error(
                  err.response?.data?.detail ||
                    `Gagal memuat instruksi dari ${
                      txData.gateway_name || "Gateway"
                    }.`
                );
                try {
                  const r = await api.get(`/payments/status/${sessionId}`);
                  setTxData(r.data);
                } catch {
                  // ignore
                }
              } finally {
                setRefreshingQris(false);
              }
            };

            const gwLabel =
              txData.gateway_name ||
              (txData.gateway_id === "duitku" ||
              txData.product_type === "topup"
                ? "Duitku"
                : "PayKita");
            const paymentFlow = String(
              txData.duitku_payment_flow || "qris"
            ).toLowerCase();
            const channelTitle =
              txData.duitku_channel_name || txData.qris_provider || gwLabel;
            const isVaOrRetail =
              (paymentFlow === "va" || paymentFlow === "retail") &&
              Boolean(txData.va_number);
            const isEwallet = paymentFlow === "ewallet";

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 text-left">
                  <div>
                    <p className="text-[11px] font-mono text-neon">
                      Pembayaran Otomatis · {gwLabel}
                    </p>
                    <h1
                      className="font-display font-bold text-lg sm:text-xl text-slate-100 mt-0.5"
                      data-testid="paykita-pending-title"
                    >
                      {paymentFlow === "va" ? (
                        <>Virtual Account {channelTitle}</>
                      ) : paymentFlow === "retail" ? (
                        <>Kode Bayar {channelTitle}</>
                      ) : paymentFlow === "ewallet" ? (
                        <>Pembayaran {channelTitle}</>
                      ) : (
                        <>Scan QRIS untuk Membayar</>
                      )}
                    </h1>
                  </div>
                  {expiresIn !== null && (
                    <div
                      className="text-right shrink-0"
                      data-testid="paykita-countdown"
                    >
                      <p className="text-[10px] font-mono text-slate-400">
                        Batas Waktu
                      </p>
                      <p
                        className={`text-sm font-mono font-bold tabular-nums ${
                          expiresIn < 60 ? "text-coral" : "text-slate-100"
                        }`}
                      >
                        {mmss(expiresIn)}
                      </p>
                    </div>
                  )}
                </div>

                {expiresIn !== null && (
                  <div className="w-full h-1 bg-line/40 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        expiresIn < 60 ? "bg-coral" : "bg-neon"
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}

                {/* Dynamic Display: VA / Retail vs E-Wallet / QRIS */}
                {isVaOrRetail ? (
                  <div
                    className="border border-line bg-void/80 p-4 text-left space-y-3"
                    data-testid="duitku-va-box"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        {paymentFlow === "retail"
                          ? `Kode Pembayaran ${channelTitle}`
                          : `Nomor Virtual Account ${channelTitle}`}
                      </span>
                      <span className="text-xs font-mono font-semibold text-neon">
                        {txData.duitku_channel || "VA"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 bg-panel border border-line px-3.5 py-3">
                      <strong
                        className="font-mono text-lg sm:text-xl font-bold tracking-wider text-white select-all break-all tabular-nums"
                        data-testid="duitku-va-number"
                      >
                        {txData.va_number}
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(String(txData.va_number))
                            .then(() =>
                              toast.success(
                                paymentFlow === "retail"
                                  ? "Kode pembayaran disalin"
                                  : "Nomor Virtual Account disalin"
                              )
                            )
                        }
                        data-testid="duitku-copy-va"
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-neon text-void font-mono font-semibold text-xs hover:bg-lime transition-colors cursor-pointer"
                      >
                        <Copy size={12} />
                        <span>Salin</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {paymentFlow === "retail"
                        ? `Tunjukkan kode di atas ke kasir ${channelTitle}. Pesanan diproses otomatis setelah pembayaran selesai.`
                        : `Bayar melalui m-Banking atau ATM ${channelTitle}. Pesanan terverifikasi otomatis setelah transfer berhasil.`}
                    </p>
                  </div>
                ) : (
                  <div className="bg-void/60 border border-line/80 p-4 text-center space-y-3">
                    {isEwallet && txData.pay_url && (
                      <div>
                        <a
                          href={txData.pay_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="duitku-ewallet-pay-button"
                          className="w-full inline-flex items-center justify-center gap-2 bg-neon text-void font-display font-bold text-xs uppercase tracking-wider py-3 px-4 hover:bg-lime transition-colors"
                        >
                          <span>Buka Aplikasi {channelTitle}</span>
                        </a>
                        <p className="text-xs text-slate-400 mt-2">
                          Atau scan kode QRIS di bawah ini:
                        </p>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <div
                        className="inline-flex items-center justify-center bg-white p-3 border border-line"
                        data-testid="paykita-qris-box"
                      >
                        <div className="w-56 h-56 overflow-hidden bg-white flex items-center justify-center">
                          <PureQrisImage
                            qrisString={txData.qris_string}
                            src={nonSvgServerImg}
                            alt={`QRIS ${gwLabel}`}
                            className="w-full h-full object-contain block"
                            testId="paykita-qris-image"
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400">
                      Mendukung GoPay, DANA, OVO, ShopeePay, LinkAja &amp; semua M-Banking.
                    </p>
                  </div>
                )}

                {txData.paykita_error && txData.paykita_mode !== "live" && (
                  <div
                    className="border border-amber-400/30 bg-amber-500/10 p-3 text-left space-y-2"
                    data-testid="paykita-diagnostic-banner"
                  >
                    <div className="flex items-start gap-2 text-xs text-amber-200 leading-relaxed">
                      <AlertTriangle
                        size={14}
                        className="shrink-0 mt-0.5 text-amber-400"
                      />
                      <div>
                        <p className="font-semibold text-amber-300">
                          Info Sinkronisasi {gwLabel}:
                        </p>
                        <p className="mt-0.5 text-amber-100/90">
                          {txData.paykita_error}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshPaykitaQris}
                      disabled={refreshingQris}
                      data-testid="paykita-refresh-qris-button"
                      className="w-full flex items-center justify-center gap-1.5 border border-amber-400/50 bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 text-xs font-mono font-semibold py-2 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        size={12}
                        className={refreshingQris ? "animate-spin" : ""}
                      />
                      <span>
                        {refreshingQris
                          ? `Memuat ulang dari ${gwLabel}...`
                          : `Muat Ulang Instruksi ${gwLabel}`}
                      </span>
                    </button>
                  </div>
                )}

                {/* Clean Payment Breakdown & Total Row */}
                <div className="bg-void/60 border border-line/80 px-4 py-3 text-left space-y-2">
                  {hasExtraAmount && (
                    <>
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                        <span>Harga Produk</span>
                        <span className="text-slate-200">
                          {formatIDR(baseAmount)}
                        </span>
                      </div>
                      {uniqueCode > 0 && (
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                          <span>Kode Unik {gwLabel}</span>
                          <span className="text-lime">
                            +{formatIDR(uniqueCode)}
                          </span>
                        </div>
                      )}
                      {feeAmount > 0 && (
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                          <span>Biaya Layanan</span>
                          <span className="text-slate-200">
                            +{formatIDR(feeAmount)}
                          </span>
                        </div>
                      )}
                      <div className="border-t border-line/60 my-1" />
                    </>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      Total Bayar
                    </span>
                    <div className="flex items-center gap-2">
                      <strong
                        className="text-lg font-mono font-bold text-neon tabular-nums"
                        data-testid="paykita-amount"
                      >
                        {formatIDR(finalPayAmount)}
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(String(finalPayAmount))
                            .then(() =>
                              toast.success("Nominal pembayaran disalin")
                            )
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 border border-line text-xs font-mono text-slate-300 hover:text-neon hover:border-neon transition-colors"
                        title="Salin nominal"
                      >
                        <Copy size={11} />
                        <span>Salin</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clear Action Button for Checking Payment Status */}
                <button
                  type="button"
                  onClick={!syncing ? checkNow : undefined}
                  disabled={syncing}
                  data-testid="paykita-check-button"
                  className="w-full flex items-center justify-center gap-2 bg-neon text-void hover:bg-lime font-display font-bold text-xs uppercase tracking-wider py-3.5 px-4 transition-colors disabled:opacity-60"
                >
                  <RefreshCw
                    size={14}
                    className={syncing ? "animate-spin" : ""}
                  />
                  <span>
                    {syncing
                      ? `Mengecek Status ${gwLabel}...`
                      : "Cek Status Pembayaran"}
                  </span>
                </button>

                <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
                  <ShieldCheck size={13} className="text-lime shrink-0" />
                  <span>
                    Halaman ini juga mengecek pembayaran secara otomatis setiap 3 detik.
                  </span>
                </p>
              </div>
            );
          })()}

        {/* STATE: WAITING MANUAL VERIFICATION */}
        {status === "manual_waiting" && (
          <div className="py-6 text-center">
            <Clock size={48} className="mx-auto text-lime" />
            <h1
              className="font-display font-bold text-lg mt-4 text-lime"
              data-testid="manual-waiting-title"
            >
              Menunggu Verifikasi Admin
            </h1>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Bukti pembayaranmu sudah diterima. Admin kami sedang memverifikasi transaksi (estimasi 5–15 menit). Halaman ini akan otomatis diperbarui begitu pesanan selesai.
            </p>
          </div>
        )}

        {/* STATE: OUT OF STOCK (CANCELLED BECAUSE PURCHASED BY ANOTHER BUYER) */}
        {status === "out_of_stock" && (
          <div className="py-6 text-center space-y-3" data-testid="payment-out-of-stock">
            <XCircle
              size={48}
              className="mx-auto text-coral"
              data-testid="payment-out-of-stock-icon"
            />
            <h1 className="font-display font-bold text-lg text-coral">
              Produk Baru Saja Terjual Habis
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
              {txData?.cancel_reason ||
                "Produk ini telah dibeli terlebih dahulu oleh pembeli lain sehingga stoknya menjadi 0. Pembayaran pada sesi ini telah dibatalkan secara otomatis."}
            </p>
            <div className="rounded-xl border border-coral/40 bg-coral/10 p-3 text-left text-[11px] font-mono text-slate-200 space-y-1">
              <p className="font-bold text-coral">
                Kode pembayaran telah ditutup otomatis
              </p>
              <p className="text-slate-300 leading-relaxed">
                Mohon jangan melakukan transfer untuk sesi ini. Apabila Anda sudah telanjur melakukan pembayaran tepat sebelum stok habis, silakan klik tombol Bantuan CS di bawah dengan menyertakan ID Sesi.
              </p>
            </div>
          </div>
        )}

        {/* STATE: CANCELLED BY BUYER */}
        {status === "cancelled_by_buyer" && (
          <div className="py-6 text-center space-y-3" data-testid="payment-cancelled-by-buyer">
            <XCircle
              size={48}
              className="mx-auto text-coral"
              data-testid="payment-cancelled-icon"
            />
            <h1 className="font-display font-bold text-lg text-coral">
              Pembayaran Telah Dibatalkan
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
              Sesi pembayaran untuk pesanan ini telah berhasil kamu batalkan. Kamu sekarang dapat kembali memesan produk ini atau memilih metode pembayaran lainnya.
            </p>
          </div>
        )}

        {/* STATE: REJECTED / FAILED / EXPIRED */}
        {(status === "rejected" ||
          status === "failed" ||
          status === "expired") && (
          <div className="py-6 text-center">
            <XCircle
              size={48}
              className="mx-auto text-coral"
              data-testid="payment-rejected-icon"
            />
            <h1 className="font-display font-bold text-lg mt-4 text-coral">
              {status === "rejected"
                ? "Pembayaran Belum Terverifikasi"
                : status === "expired"
                ? "Waktu Pembayaran Habis"
                : "Pembayaran Gagal"}
            </h1>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {status === "rejected"
                ? "Bukti transfer belum dapat kami verifikasi. Jika kamu sudah melakukan pembayaran, silakan hubungi CS dengan menyertakan ID Sesi."
                : status === "expired"
                ? "Batas waktu pembayaran untuk sesi ini sudah berakhir. Silakan buat pesanan baru atau hubungi CS jika sudah membayar."
                : "Transaksi tidak dapat dilanjutkan. Silakan coba pesan kembali atau hubungi CS kami."}
            </p>
          </div>
        )}

        {/* STATE: PENDING */}
        {status === "pending" && (
          <div className="py-6 text-center">
            <Clock
              size={48}
              className="mx-auto text-neon"
              data-testid="payment-pending-icon"
            />
            <h1 className="font-display font-bold text-lg mt-4">
              Pembayaran Sedang Diproses
            </h1>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Transaksi kamu masih dalam antrean konfirmasi. Hubungi CS jika membutuhkan bantuan lebih lanjut.
            </p>
          </div>
        )}

        {/* STATE: ERROR */}
        {status === "error" && (
          <div className="py-6 text-center">
            <Clock
              size={48}
              className="mx-auto text-coral"
              data-testid="payment-error-icon"
            />
            <h1 className="font-display font-bold text-lg mt-4">
              Sesi Tidak Ditemukan
            </h1>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Kami tidak menemukan data untuk sesi pembayaran ini. Silakan kembali ke beranda atau hubungi CS.
            </p>
          </div>
        )}

        {/* Cancel Active Payment Button (Available while payment is still pending) */}
        {(status === "paykita_pending" || status === "manual_pending") && (
          <div className="mt-4">
            <button
              type="button"
              disabled={cancellingPayment}
              onClick={cancelPaymentNow}
              data-testid="cancel-active-payment-button"
              className="w-full flex items-center justify-center gap-1.5 border border-coral/50 bg-coral/10 hover:bg-coral hover:text-white text-coral font-display font-bold text-xs uppercase tracking-wider py-2.5 px-4 transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancellingPayment ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <XCircle size={14} />
              )}
              <span>
                {cancellingPayment
                  ? "Membatalkan Pembayaran..."
                  : "Batalkan Pembayaran Ini"}
              </span>
            </button>
          </div>
        )}

        {/* Bottom Navigation Bar */}
        <div className="mt-4 pt-4 border-t border-line/60 grid grid-cols-2 gap-2.5">
          <Link
            to="/"
            data-testid="payment-back-home-button"
            className="flex items-center justify-center gap-1.5 bg-void hover:bg-neon hover:text-void border border-line hover:border-neon text-slate-200 font-display font-bold text-xs uppercase tracking-wider py-3 transition-colors duration-200"
          >
            <Home size={14} />
            <span>Kembali ke Beranda</span>
          </Link>
          <a
            href={waLink(
              `Halo WillJustPlay, saya ingin menanyakan pesanan dengan ID Sesi: ${
                sessionId || "-"
              }`
            )}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="payment-cs-button"
            className="flex items-center justify-center gap-1.5 bg-void hover:border-neon border border-line text-slate-200 hover:text-neon text-xs font-medium py-3 transition-colors duration-200"
          >
            <MessageCircle size={14} />
            <span>Bantuan CS</span>
          </a>
        </div>
      </motion.div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        sessionId={sessionId}
        productTitle={reviewProductTitle}
        defaultEmail={user?.email || ""}
        onSubmitted={() =>
          setReviewEligibility((e) => ({ ...(e || {}), has_review: true }))
        }
      />
    </div>
  );
}
