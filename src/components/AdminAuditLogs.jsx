import { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw, Loader2, ShieldAlert, Mail } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";

export function AdminAuditLogs() {
  const [subTab, setSubTab] = useState("audit");
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [emailEvents, setEmailEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");

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
            <ShieldAlert size={13} /> Audit Keamanan & Admin ({logs.length})
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
          <div className="bg-panel border border-line p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-void border border-line focus-within:border-neon/60 px-3 py-2">
              <Search size={14} className="text-slate-500 shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari email pelaku, target, atau aksi..."
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
                    <th className="px-4 py-3">Pelaku (Actor)</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Detail Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      data-testid={`audit-row-${log.id}`}
                      className="border-b border-line/60 hover:bg-panelhover transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {String(log.created_at || "").slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neon/10 text-neon border border-neon/30">
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
                      <td className="px-4 py-3 text-[11px] text-slate-400 max-w-[320px] truncate">
                        {log.metadata && Object.keys(log.metadata).length > 0
                          ? JSON.stringify(log.metadata)
                          : "-"}
                      </td>
                    </tr>
                  ))}
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
