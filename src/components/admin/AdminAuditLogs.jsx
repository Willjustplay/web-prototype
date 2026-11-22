import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Mail,
  Ban,
  Unlock,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";

export function AdminAuditLogs() {
  const [subTab, setSubTab] = useState("audit");
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);
  const [emailEvents, setEmailEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [manualIp, setManualIp] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [busyIp, setBusyIp] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (actionFilter) params.action = actionFilter;
      const [auditRes, emailRes] = await Promise.all([
        api.get("/admin/audit-logs", { params }),
        api.get("/admin/email-events"),
      ]);
      setLogs(Array.isArray(auditRes.data?.logs) ? auditRes.data.logs : []);
      setActions(Array.isArray(auditRes.data?.actions) ? auditRes.data.actions : []);
      setBlockedIps(Array.isArray(auditRes.data?.blocked_ips) ? auditRes.data.blocked_ips : []);
      setEmailEvents(Array.isArray(emailRes.data?.events) ? emailRes.data.events : []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal memuat log audit");
    } finally {
      setLoading(false);
    }
  }, [q, actionFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUnblockIp = async (ip) => {
    if (!ip) return;
    setBusyIp(ip);
    try {
      const res = await api.post("/admin/security/unblock-ip", { ip });
      toast.success(res.data?.message || `Blokir IP ${ip} dicabut`);
      setBlockedIps(Array.isArray(res.data?.blocked_ips) ? res.data.blocked_ips : []);
      await loadData();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal membuka blokir IP");
    } finally {
      setBusyIp("");
    }
  };

  const handleManualBlockIp = async (e) => {
    e.preventDefault();
    const targetIp = manualIp.trim();
    if (!targetIp) {
      toast.error("Masukkan alamat IP yang ingin diblokir");
      return;
    }
    setBusyIp(targetIp);
    try {
      const res = await api.post("/admin/security/block-ip", {
        ip: targetIp,
        reason: manualReason.trim() || "Diblokir manual oleh Admin",
      });
      toast.success(res.data?.message || `IP ${targetIp} diblokir selama 15 menit`);
      setManualIp("");
      setManualReason("");
      setBlockedIps(Array.isArray(res.data?.blocked_ips) ? res.data.blocked_ips : []);
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal memblokir IP");
    } finally {
      setBusyIp("");
    }
  };

  const formatRemaining = (sec) => {
    const s = Math.max(0, Number(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
  };

  return (
    <div className="space-y-6" data-testid="admin-audit-section">
      {/* Sub-navigation between Audit Logs and Email Delivery Logs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-panel border border-line p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab("audit")}
            data-testid="audit-subtab-events"
            className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3.5 py-2 border transition-colors ${
              subTab === "audit"
                ? "bg-neon text-void border-neon"
                : "border-line text-slate-400 hover:text-neon"
            }`}
          >
            <ShieldAlert size={13} /> Audit Keamanan & Firewall IP ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("email")}
            data-testid="audit-subtab-emails"
            className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3.5 py-2 border transition-colors ${
              subTab === "email"
                ? "bg-neon text-void border-neon"
                : "border-line text-slate-400 hover:text-neon"
            }`}
          >
            <Mail size={13} /> Log Pengiriman Email ({emailEvents.length})
          </button>
        </div>

        <button
          type="button"
          onClick={loadData}
          data-testid="admin-audit-refresh"
          className="flex items-center gap-1.5 border border-line hover:border-neon/50 text-slate-300 hover:text-neon text-[10px] font-bold uppercase tracking-widest px-3 py-2 transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Segarkan
        </button>
      </div>

      {subTab === "audit" && (
        <>
          {/* Multi-Layer Security Status & Active 15-Minute IP Ban Firewall */}
          <div className="bg-panel border border-line p-4 space-y-4" data-testid="admin-security-firewall-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className="text-lime shrink-0" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-100">
                    Pertahanan Berlapis Anti-Hacker Aktif (Auto-Ban IP 15 Menit)
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Anti-Brute Force Admin • Rate Limit Checkout • Filter Anti-XSS & SQLi • Validasi Magic-Byte Upload • Timing-Safe Webhook
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-widest bg-lime/15 text-lime border border-lime/30">
                PROTEKSI AKTIF
              </span>
            </div>

            {/* Manual IP Block Form */}
            <form onSubmit={handleManualBlockIp} className="flex flex-wrap items-center gap-2.5">
              <input
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="Contoh IP: 103.20.11.5"
                data-testid="admin-manual-block-ip-input"
                className="bg-void border border-line focus:border-coral/60 outline-none text-xs font-mono px-3 py-2 text-slate-100 placeholder:text-slate-600 w-48"
              />
              <input
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Alasan blokir (opsional)..."
                data-testid="admin-manual-block-reason-input"
                className="flex-1 min-w-[200px] bg-void border border-line focus:border-coral/60 outline-none text-xs font-mono px-3 py-2 text-slate-100 placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={Boolean(busyIp)}
                data-testid="admin-manual-block-submit"
                className="flex items-center gap-1.5 bg-coral/15 hover:bg-coral/25 text-coral border border-coral/40 text-[10px] font-bold uppercase tracking-widest px-3.5 py-2 transition-colors disabled:opacity-50"
              >
                <Lock size={12} /> Blokir IP (15 Menit)
              </button>
            </form>

            {/* Active Blocked IPs List */}
            {blockedIps.length === 0 ? (
              <div className="bg-void/60 border border-line/70 px-3.5 py-2.5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Tidak ada alamat IP yang sedang diblokir saat ini.</span>
                <span className="text-[10px] text-slate-500">Batas blokir otomatis: 15 Menit</span>
              </div>
            ) : (
              <div className="border border-coral/40 bg-coral/5 overflow-x-auto" data-testid="admin-blocked-ips-table">
                <div className="px-3.5 py-2 border-b border-coral/30 flex items-center justify-between text-[11px] font-mono text-coral font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Ban size={13} /> Daftar IP Penyerang yang Sedang Diblokir ({blockedIps.length})
                  </span>
                  <span>Durasi Blokir: 15 Menit</span>
                </div>
                <table className="w-full text-left text-xs font-mono min-w-[680px]">
                  <thead>
                    <tr className="border-b border-coral/20 text-[10px] uppercase tracking-widest text-slate-400">
                      <th className="px-3.5 py-2">Alamat IP</th>
                      <th className="px-3.5 py-2">Kategori</th>
                      <th className="px-3.5 py-2">Alasan Pemblokiran</th>
                      <th className="px-3.5 py-2">Sisa Waktu</th>
                      <th className="px-3.5 py-2 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedIps.map((b) => (
                      <tr key={b.ip} className="border-b border-coral/15">
                        <td className="px-3.5 py-2.5 font-bold text-coral">{b.ip}</td>
                        <td className="px-3.5 py-2.5 text-slate-300 uppercase text-[10px]">{b.category}</td>
                        <td className="px-3.5 py-2.5 text-slate-200">{b.reason}</td>
                        <td className="px-3.5 py-2.5 text-amber-300 font-bold">
                          {formatRemaining(b.remaining_seconds)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={busyIp === b.ip}
                            onClick={() => handleUnblockIp(b.ip)}
                            data-testid={`unblock-ip-${b.ip}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-lime/15 hover:bg-lime/25 text-lime border border-lime/40 transition-colors disabled:opacity-50"
                          >
                            <Unlock size={11} /> Buka Blokir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-panel border border-line p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-void border border-line focus-within:border-neon/60 px-3 py-2">
              <Search size={14} className="text-slate-500 shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari IP penyerang, email pelaku, target, atau aksi..."
                data-testid="admin-audit-search"
                className="w-full bg-transparent outline-none text-xs font-mono text-slate-100 placeholder:text-slate-600"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              data-testid="admin-audit-action-filter"
              className="bg-void border border-line focus:border-neon/60 outline-none text-xs font-mono px-3 py-2.5 text-slate-200"
            >
              <option value="">Semua Jenis Aksi</option>
              {actions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-line bg-panel overflow-x-auto" data-testid="admin-audit-table">
            {loading ? (
              <div className="py-16 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
                <Loader2 size={16} className="animate-spin text-neon" /> Memuat log audit...
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-slate-500">
                Belum ada catatan log audit.
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono min-w-[820px]">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Aksi</th>
                    <th className="px-4 py-3">Pelaku (Actor) / IP</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Detail Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isSecurityEvent = String(log.action || "").startsWith("security.");
                    return (
                      <tr
                        key={log.id}
                        data-testid={`audit-row-${log.id}`}
                        className={`border-b border-line/60 hover:bg-panelhover transition-colors ${
                          isSecurityEvent ? "bg-coral/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {String(log.created_at || "").slice(0, 19).replace("T", " ")}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                              isSecurityEvent
                                ? "bg-coral/15 text-coral border-coral/40"
                                : "bg-neon/10 text-neon border-neon/30"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          <div>{log.actor_email || "Sistem / Tamu"}</div>
                          {log.ip && <div className="text-[10px] text-slate-500">IP: {log.ip}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {log.target_email || log.target_user_id || "-"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-400 max-w-[360px] truncate">
                          {log.metadata && Object.keys(log.metadata).length > 0
                            ? JSON.stringify(log.metadata)
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {subTab === "email" && (
        <div className="border border-line bg-panel overflow-x-auto" data-testid="admin-email-events-table">
          {emailEvents.length === 0 ? (
            <div className="py-16 text-center text-xs font-mono text-slate-500">
              Belum ada riwayat pengiriman email transaksional.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono min-w-[760px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Penerima</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {emailEvents.map((ev) => (
                  <tr key={ev.id} className="border-b border-line/60">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {String(ev.created_at || "").slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{ev.to_email}</td>
                    <td className="px-4 py-3 text-neon uppercase text-[10px]">{ev.template}</td>
                    <td className="px-4 py-3 text-slate-400 uppercase text-[10px]">{ev.provider}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
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
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {ev.error || (ev.provider_id ? `ID: ${ev.provider_id}` : "Tautan siap digunakan")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

