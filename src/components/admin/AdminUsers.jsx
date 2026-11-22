import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  Ban,
  MailCheck,
  Trash2,
  Loader2,
  RefreshCw,
  LogOut,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    verified: 0,
    unverified: 0,
    suspended: 0,
    admins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState(null);
  const [devPreviewLink, setDevPreviewLink] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (verifiedFilter !== "all") params.verified = verifiedFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (roleFilter !== "all") params.role = roleFilter;
      const { data } = await api.get("/admin/users", { params });
      setUsers(Array.isArray(data?.users) ? data.users : []);
      if (data?.summary) setSummary(data.summary);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal memuat daftar pengguna");
    } finally {
      setLoading(false);
    }
  }, [q, verifiedFilter, statusFilter, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleVerify = async (u) => {
    setBusyId(u.id);
    try {
      const nextVerified = !u.is_verified;
      const { data } = await api.patch(`/admin/users/${u.id}/verify`, {
        is_verified: nextVerified,
      });
      toast.success(data.message || (nextVerified ? "Pengguna diverifikasi" : "Status verifikasi dicabut"));
      loadUsers();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mengubah status verifikasi");
    } finally {
      setBusyId(null);
    }
  };

  const handleResendVerification = async (u) => {
    setBusyId(u.id);
    try {
      const { data } = await api.post(`/admin/users/${u.id}/resend-verification`);
      toast.success(data.message || `Email verifikasi dikirim ke ${u.email}`);
      if (data.dev_preview_url) {
        setDevPreviewLink({ email: u.email, url: data.dev_preview_url });
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mengirim ulang email verifikasi");
    } finally {
      setBusyId(null);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const { type, target } = confirmAction;
    setBusyId(target.id);
    setConfirmAction(null);
    try {
      if (type === "suspend" || type === "activate") {
        const nextStatus = type === "suspend" ? "suspended" : "active";
        const { data } = await api.patch(`/admin/users/${target.id}/status`, {
          status: nextStatus,
        });
        toast.success(data.message || `Status akun diubah menjadi ${nextStatus}`);
      } else if (type === "role") {
        const nextRole = target.role === "admin" ? "buyer" : "admin";
        const { data } = await api.patch(`/admin/users/${target.id}/role`, {
          role: nextRole,
        });
        toast.success(data.message || `Role akun diubah menjadi ${nextRole}`);
      } else if (type === "revoke_sessions") {
        const { data } = await api.post(`/admin/users/${target.id}/revoke-sessions`);
        toast.success(data.message || "Seluruh sesi pengguna berhasil dicabut");
      } else if (type === "delete") {
        const { data } = await api.delete(`/admin/users/${target.id}`);
        toast.success(data.message || "Pengguna dihapus");
      }
      loadUsers();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Aksi gagal dijalankan");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-users-section">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-panel border border-line p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Total User</div>
          <div className="text-2xl font-display font-black text-slate-100 mt-1" data-testid="users-stat-total">
            {summary.total}
          </div>
        </div>
        <div className="bg-panel border border-line p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Terverifikasi</div>
          <div className="text-2xl font-display font-black text-lime mt-1" data-testid="users-stat-verified">
            {summary.verified}
          </div>
        </div>
        <div className="bg-panel border border-line p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Belum Verifikasi</div>
          <div className="text-2xl font-display font-black text-amber-400 mt-1" data-testid="users-stat-unverified">
            {summary.unverified}
          </div>
        </div>
        <div className="bg-panel border border-line p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Ditangguhkan</div>
          <div className="text-2xl font-display font-black text-coral mt-1" data-testid="users-stat-suspended">
            {summary.suspended}
          </div>
        </div>
        <div className="bg-panel border border-line p-4 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Admin Aktif</div>
          <div className="text-2xl font-display font-black text-neon mt-1" data-testid="users-stat-admins">
            {summary.admins}
          </div>
        </div>
      </div>

      {/* Dev Preview Banner if Resend is in Dev Mode */}
      {devPreviewLink && (
        <div
          data-testid="admin-dev-verify-banner"
          className="border border-neon/50 bg-neon/5 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="space-y-1">
            <div className="text-[11px] font-display font-bold uppercase tracking-widest text-neon">
              Pratinjau Tautan Verifikasi (Mode Dev — {devPreviewLink.email})
            </div>
            <div className="text-xs font-mono text-slate-300 break-all">{devPreviewLink.url}</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={devPreviewLink.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-neon text-void text-[10px] font-bold uppercase tracking-widest px-3 py-2 hover:bg-lime transition-colors"
            >
              <ExternalLink size={12} /> Buka Tautan
            </a>
            <button
              type="button"
              onClick={() => setDevPreviewLink(null)}
              className="text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-coral px-2 py-2"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-panel border border-line p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-void border border-line focus-within:border-neon/60 px-3 py-2">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau email pengguna..."
            data-testid="admin-users-search"
            className="w-full bg-transparent outline-none text-xs font-mono text-slate-100 placeholder:text-slate-600"
          />
        </div>

        <select
          value={verifiedFilter}
          onChange={(e) => setVerifiedFilter(e.target.value)}
          data-testid="admin-users-verified-filter"
          className="bg-void border border-line focus:border-neon/60 outline-none text-xs font-mono px-3 py-2.5 text-slate-200"
        >
          <option value="all">Semua Verifikasi</option>
          <option value="verified">Terverifikasi</option>
          <option value="unverified">Belum Verifikasi</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="admin-users-status-filter"
          className="bg-void border border-line focus:border-neon/60 outline-none text-xs font-mono px-3 py-2.5 text-slate-200"
        >
          <option value="all">Semua Status Akun</option>
          <option value="active">Aktif</option>
          <option value="suspended">Ditangguhkan (Suspended)</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          data-testid="admin-users-role-filter"
          className="bg-void border border-line focus:border-neon/60 outline-none text-xs font-mono px-3 py-2.5 text-slate-200"
        >
          <option value="all">Semua Role</option>
          <option value="buyer">User / Buyer</option>
          <option value="admin">Admin</option>
        </select>

        <button
          type="button"
          onClick={loadUsers}
          data-testid="admin-users-refresh"
          className="flex items-center gap-1.5 border border-line hover:border-neon/50 text-slate-300 hover:text-neon text-[10px] font-bold uppercase tracking-widest px-3 py-2.5 transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Segarkan
        </button>
      </div>

      {/* Users Table */}
      <div className="border border-line bg-panel overflow-x-auto" data-testid="admin-users-table">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
            <Loader2 size={16} className="animate-spin text-neon" /> Memuat data pengguna...
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-slate-500">
            Tidak ada pengguna yang cocok dengan filter.
          </div>
        ) : (
          <table className="w-full text-left text-xs font-mono min-w-[920px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Verifikasi Email</th>
                <th className="px-4 py-3">Status Akun</th>
                <th className="px-4 py-3">Terdaftar / Login Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isBusy = busyId === u.id;
                const isSuspended = u.status === "suspended";
                return (
                  <tr
                    key={u.id}
                    data-testid={`admin-user-row-${u.id}`}
                    className="border-b border-line/60 hover:bg-panelhover transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 grid place-items-center border border-line bg-void text-neon font-display font-bold text-xs uppercase shrink-0">
                          {(u.name || u.email || "U").slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-sans font-bold text-slate-100 truncate flex items-center gap-1.5">
                            {u.name || "-"}
                            {isSelf && (
                              <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 bg-neon/15 text-neon border border-neon/40">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${
                          u.role === "admin"
                            ? "border-neon/50 bg-neon/10 text-neon"
                            : "border-line bg-void text-slate-300"
                        }`}
                      >
                        {u.role === "admin" && <Shield size={10} />}
                        {u.role === "admin" ? "Admin" : "Buyer"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {u.is_verified ? (
                        <div className="space-y-0.5">
                          <span
                            data-testid={`user-verified-badge-${u.id}`}
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-lime/15 text-lime"
                          >
                            <CheckCircle2 size={11} /> Terverifikasi
                          </span>
                          {u.verified_at && (
                            <div className="text-[10px] text-slate-500">
                              {String(u.verified_at).slice(0, 16).replace("T", " ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span
                          data-testid={`user-unverified-badge-${u.id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        >
                          <XCircle size={11} /> Belum Verifikasi
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isSuspended ? (
                        <span
                          data-testid={`user-status-badge-${u.id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-coral/15 text-coral border border-coral/30"
                        >
                          <Ban size={10} /> Suspended
                        </span>
                      ) : (
                        <span
                          data-testid={`user-status-badge-${u.id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-neon/10 text-neon"
                        >
                          Aktif
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-[10px] text-slate-400">
                      <div>Daftar: {u.created_at ? String(u.created_at).slice(0, 16).replace("T", " ") : "-"}</div>
                      <div className="text-slate-500">
                        Login: {u.last_login_at ? String(u.last_login_at).slice(0, 16).replace("T", " ") : "Belum pernah"}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() => handleToggleVerify(u)}
                          data-testid={`toggle-verify-user-${u.id}`}
                          title={u.is_verified ? "Cabut status verifikasi" : "Verifikasi manual"}
                          className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 border transition-colors disabled:opacity-40 ${
                            u.is_verified
                              ? "border-line text-slate-400 hover:border-amber-400/50 hover:text-amber-300"
                              : "border-lime/50 text-lime hover:bg-lime/10"
                          }`}
                        >
                          {u.is_verified ? "Cabut Verif" : "Verifikasi"}
                        </button>

                        {!u.is_verified && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleResendVerification(u)}
                            data-testid={`resend-verify-user-${u.id}`}
                            title="Kirim ulang email verifikasi"
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 border border-neon/40 text-neon hover:bg-neon/10 transition-colors disabled:opacity-40"
                          >
                            <MailCheck size={11} /> Kirim Email
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() => setConfirmAction({ type: "role", target: u })}
                          data-testid={`toggle-role-user-${u.id}`}
                          title="Ubah role pengguna"
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 border border-line text-slate-300 hover:border-neon/50 hover:text-neon transition-colors disabled:opacity-40"
                        >
                          {u.role === "admin" ? "Jadikan Buyer" : "Jadikan Admin"}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() =>
                            setConfirmAction({
                              type: isSuspended ? "activate" : "suspend",
                              target: u,
                            })
                          }
                          data-testid={`toggle-suspend-user-${u.id}`}
                          className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 border transition-colors disabled:opacity-40 ${
                            isSuspended
                              ? "border-lime/50 text-lime hover:bg-lime/10"
                              : "border-coral/40 text-coral hover:bg-coral/10"
                          }`}
                        >
                          {isSuspended ? "Aktifkan" : "Suspend"}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmAction({ type: "revoke_sessions", target: u })}
                          data-testid={`revoke-sessions-user-${u.id}`}
                          title="Cabut semua sesi login aktif"
                          className="w-7 h-7 grid place-items-center border border-line text-slate-400 hover:text-neon hover:border-neon/50 transition-colors disabled:opacity-40"
                        >
                          <LogOut size={12} />
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() => setConfirmAction({ type: "delete", target: u })}
                          data-testid={`delete-user-${u.id}`}
                          title="Hapus akun pengguna"
                          className="w-7 h-7 grid place-items-center border border-line text-slate-400 hover:text-coral hover:border-coral/50 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div
          data-testid="admin-user-confirm-modal"
          className="fixed inset-0 z-50 bg-void/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmAction(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-panel border border-line p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 grid place-items-center border border-coral/50 bg-coral/10 text-coral shrink-0">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3 className="font-display font-bold uppercase text-sm text-slate-100">
                  Konfirmasi Tindakan Admin
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Target: {confirmAction.target.email}
                </p>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              {confirmAction.type === "suspend" &&
                "Menangguhkan (suspend) akun ini akan langsung mencabut seluruh sesi login aktif dan menolak akses masuk hingga diaktifkan kembali."}
              {confirmAction.type === "activate" &&
                "Mengaktifkan kembali akun ini akan mengizinkan pengguna untuk masuk seperti semula."}
              {confirmAction.type === "role" &&
                `Anda yakin ingin mengubah role "${confirmAction.target.email}" menjadi ${
                  confirmAction.target.role === "admin" ? "Buyer / User biasa" : "Admin penuh"
                }?`}
              {confirmAction.type === "revoke_sessions" &&
                "Seluruh sesi login aktif pengguna ini di semua perangkat akan langsung dihentikan."}
              {confirmAction.type === "delete" &&
                "Tindakan ini akan menghapus akun pengguna beserta token dan sesinya secara permanen."}
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                data-testid="admin-confirm-cancel"
                className="text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 border border-line text-slate-400 hover:text-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                data-testid="admin-confirm-proceed"
                className="text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 bg-neon text-void hover:bg-lime transition-colors"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
