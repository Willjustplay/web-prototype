import { useCallback, useEffect, useState } from "react";
import {
  Database,
  Server,
  CloudCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  UploadCloud,
  DownloadCloud,
  Code2,
  ShieldCheck,
  HardDrive,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";

export function AdminDatabase({ onReload }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState("");
  const [connString, setConnString] = useState("");
  const [useSsl, setUseSsl] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [sqlDump, setSqlDump] = useState("");
  const [loadingSql, setLoadingSql] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/admin/database/status");
      setStatus(data);
      if (data?.postgres) {
        setConnString((prev) => prev || data.postgres.masked_url || "");
        setUseSsl(data.postgres.ssl !== false);
        setAutoSync(data.postgres.auto_sync !== false);
      }
    } catch (e) {
      if (!silent) {
        toast.error(formatApiError(e.response?.data?.detail) || "Gagal memuat status database");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSaveConfig = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/admin/database/postgres/config", {
        connection_string: connString.trim(),
        ssl: useSsl,
        auto_sync: autoSync,
      });
      toast.success(data?.message || "Konfigurasi PostgreSQL berhasil disimpan");
      await loadStatus(true);
      if (onReload) onReload();
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Gagal menghubungkan ke server PostgreSQL"
      );
      await loadStatus(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (direction) => {
    setSyncing(direction);
    try {
      const { data } = await api.post("/admin/database/postgres/sync", { direction });
      toast.success(data?.message || "Sinkronisasi PostgreSQL berhasil");
      await loadStatus(true);
      if (onReload) onReload();
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Gagal melakukan sinkronisasi PostgreSQL"
      );
    } finally {
      setSyncing("");
    }
  };

  const handleLoadSqlDump = async (downloadImmediately = false) => {
    setLoadingSql(true);
    try {
      const { data } = await api.get("/admin/database/postgres/sql-dump");
      const sqlText = data?.sql || "";
      setSqlDump(sqlText);
      if (downloadImmediately && sqlText) {
        const blob = new Blob([sqlText], { type: "application/sql;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data?.filename || "willjustplay_postgres_dump.sql";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("File skema & data PostgreSQL (.sql) berhasil diunduh");
      } else {
        setShowSqlPreview(true);
      }
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Gagal membuat dump SQL PostgreSQL"
      );
    } finally {
      setLoadingSql(false);
    }
  };

  const copySqlDump = async () => {
    if (!sqlDump) return;
    try {
      await navigator.clipboard.writeText(sqlDump);
      toast.success("Skrip SQL PostgreSQL disalin ke clipboard");
    } catch {
      toast.error("Gagal menyalin skrip SQL");
    }
  };

  if (loading && !status) {
    return (
      <div className="rounded-2xl border border-line bg-panel/80 p-12 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-neon" />
      </div>
    );
  }

  const pg = status?.postgres || {};
  const fb = status?.firebase || {};
  const local = status?.local_store || {};
  const tables = status?.tables || [];

  return (
    <div className="space-y-6" data-testid="admin-database-section">
      {/* Top Banner */}
      <div className="rounded-2xl border border-line bg-panel/90 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl grid place-items-center bg-neon/10 border border-neon/40 text-neon">
              <Database size={18} />
            </span>
            <div>
              <h2 className="font-display font-extrabold text-base sm:text-lg text-slate-100 tracking-tight">
                Database PostgreSQL &amp; Cloud Persistence
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Dukungan penuh skema relasional PostgreSQL (14 tabel <code className="text-neon">wjp_*</code> termasuk penyimpanan foto <code className="text-lime">wjp_files</code>), sinkronisasi otomatis real-time, serta penyimpanan Cloud.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleLoadSqlDump(true)}
            disabled={loadingSql}
            data-testid="download-postgres-sql-button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-neon/50 bg-neon/10 hover:bg-neon hover:text-void text-neon text-xs font-mono font-bold px-3.5 py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loadingSql ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span>Unduh Dump PostgreSQL (.sql)</span>
          </button>
          <button
            type="button"
            onClick={() => loadStatus(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-void hover:border-neon/50 text-slate-300 hover:text-neon text-xs font-mono px-3.5 py-2.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-neon" : ""} />
            <span>Segarkan Status</span>
          </button>
        </div>
      </div>

      {/* 3 Storage Engine Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. PostgreSQL Engine Card */}
        <div className="rounded-2xl border border-line bg-panel/85 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-slate-100">
              <Server size={15} className="text-neon" />
              PostgreSQL Engine
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                pg.connected
                  ? "bg-lime/15 border border-lime/40 text-lime"
                  : pg.configured
                  ? "bg-coral/15 border border-coral/40 text-coral"
                  : "bg-neon/15 border border-neon/40 text-neon"
              }`}
            >
              {pg.connected ? "TERHUBUNG" : pg.configured ? "ERROR KONEKSI" : "SIAP DIHUBUNGKAN"}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400 space-y-1">
            <p>
              Driver: <span className="text-slate-200">node-postgres (pg.Pool)</span>
            </p>
            <p>
              Host:{" "}
              <span className="text-slate-200">
                {pg.host ? `${pg.host}:${pg.port || 5432}/${pg.database}` : "Menunggu URI PostgreSQL"}
              </span>
            </p>
            <p>
              Skema Relasional:{" "}
              <span className="text-lime">14 Tabel (JSONB + Foto Binary Base64)</span>
            </p>
          </div>
        </div>

        {/* 2. Provisioned Cloud Database Card */}
        <div className="rounded-2xl border border-line bg-panel/85 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-slate-100">
              <CloudCheck size={15} className="text-lime" />
              Cloud Database
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                fb.configured
                  ? "bg-lime/15 border border-lime/40 text-lime"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {fb.configured ? "AKTIF & TERPROTEKSI" : "NONAKTIF"}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400 space-y-1">
            <p className="truncate">
              Project ID: <span className="text-slate-200">{fb.project_id || "-"}</span>
            </p>
            <p className="truncate" title={fb.database_id}>
              Database ID: <span className="text-neon">{fb.database_id || "-"}</span>
            </p>
            <p className="inline-flex items-center gap-1 text-lime">
              <ShieldCheck size={12} /> Security Rules Terdeploy
            </p>
          </div>
        </div>

        {/* 3. Persistent State Store Card */}
        <div className="rounded-2xl border border-line bg-panel/85 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-slate-100">
              <HardDrive size={15} className="text-cyan-300" />
              Persistent Store
            </span>
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-cyan-400/15 border border-cyan-400/40 text-cyan-300">
              AKTIF
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400 space-y-1">
            <p>
              Total Baris Data:{" "}
              <span className="text-slate-100 font-bold">{status?.total_records || 0} Record</span>
            </p>
            <p>
              Ukuran State:{" "}
              <span className="text-slate-200">
                {Math.max(1, Math.round((local.size_bytes || 0) / 1024))} KB
              </span>
            </p>
            <p>
              Sinkronisasi Terakhir:{" "}
              <span className="text-slate-200">
                {pg.last_sync_at ? new Date(pg.last_sync_at).toLocaleTimeString("id-ID") : "Real-time"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* PostgreSQL Connection Configuration Form */}
      <form
        onSubmit={handleSaveConfig}
        className="rounded-2xl border border-line bg-panel/90 p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line/70">
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-100">
              Koneksi Database PostgreSQL (Supabase / Neon / Cloud SQL / RDS / Self-Hosted)
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Masukkan Connection URI PostgreSQL Anda atau atur melalui variabel environment <code className="text-neon">DATABASE_URL</code> / <code className="text-neon">POSTGRES_URL</code>.
            </p>
          </div>
          {pg.version && (
            <span className="text-[11px] font-mono text-lime bg-lime/10 border border-lime/30 rounded-lg px-2.5 py-1">
              {pg.version}
            </span>
          )}
        </div>

        {pg.last_error && (
          <div className="rounded-xl border border-coral/40 bg-coral/10 p-3.5 flex items-start gap-2.5 text-xs font-mono text-coral">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase">Pesan Koneksi PostgreSQL:</p>
              <p className="mt-0.5 text-slate-200">{pg.last_error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <label className="block lg:col-span-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              PostgreSQL Connection URI (DATABASE_URL)
            </span>
            <input
              type="text"
              value={connString}
              onChange={(e) => setConnString(e.target.value)}
              placeholder="postgresql://postgres:password@db.example.com:5432/willjustplay?sslmode=require"
              data-testid="postgres-uri-input"
              className="mt-1.5 w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-slate-100 placeholder:text-slate-600 transition-colors"
            />
          </label>

          <div className="flex flex-col justify-end gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUseSsl((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-mono transition-colors cursor-pointer ${
                  useSsl
                    ? "border-neon/50 bg-neon/10 text-neon"
                    : "border-line bg-void text-slate-400"
                }`}
              >
                <div className="text-[10px] uppercase text-slate-400">Mode SSL</div>
                <div className="font-bold">{useSsl ? "SSL Aktif" : "Non-SSL"}</div>
              </button>

              <button
                type="button"
                onClick={() => setAutoSync((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-mono transition-colors cursor-pointer ${
                  autoSync
                    ? "border-lime/50 bg-lime/10 text-lime"
                    : "border-line bg-void text-slate-400"
                }`}
              >
                <div className="text-[10px] uppercase text-slate-400">Auto-Sync</div>
                <div className="font-bold">{autoSync ? "Otomatis" : "Manual"}</div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              data-testid="save-postgres-config-button"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon to-cyan-300 hover:from-lime hover:to-neon text-void font-display font-extrabold text-xs uppercase tracking-wider px-5 py-2.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Simpan &amp; Inisialisasi Tabel PostgreSQL</span>
            </button>

            <button
              type="button"
              onClick={() => handleSync("push")}
              disabled={Boolean(syncing)}
              data-testid="postgres-push-button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neon/40 bg-neon/10 hover:bg-neon/20 text-neon text-xs font-mono font-bold px-3.5 py-2.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncing === "push" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UploadCloud size={14} />
              )}
              <span>Push Data ke PostgreSQL</span>
            </button>

            <button
              type="button"
              onClick={() => handleSync("pull")}
              disabled={Boolean(syncing)}
              data-testid="postgres-pull-button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-lime/40 bg-lime/10 hover:bg-lime/20 text-lime text-xs font-mono font-bold px-3.5 py-2.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncing === "pull" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <DownloadCloud size={14} />
              )}
              <span>Pull Data dari PostgreSQL</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showSqlPreview) {
                setShowSqlPreview(false);
              } else {
                handleLoadSqlDump(false);
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 hover:text-neon underline cursor-pointer"
          >
            <Code2 size={14} />
            <span>{showSqlPreview ? "Sembunyikan Skema SQL" : "Lihat Skema & Query SQL PostgreSQL"}</span>
          </button>
        </div>
      </form>

      {/* Optional SQL Schema & Data Preview */}
      {showSqlPreview && sqlDump && (
        <div className="rounded-2xl border border-neon/40 bg-void/95 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-neon">
                Skema Relasional &amp; Data Dump PostgreSQL (Siap Eksekusi di psql / Supabase SQL Editor)
              </h4>
              <p className="text-[11px] font-mono text-slate-400">
                Berisi perintah <code className="text-slate-200">CREATE TABLE IF NOT EXISTS</code> dan <code className="text-slate-200">INSERT ... ON CONFLICT DO UPDATE</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copySqlDump}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neon/40 bg-neon/10 hover:bg-neon hover:text-void text-neon text-xs font-mono font-bold px-3 py-1.5 transition-colors cursor-pointer"
              >
                <Copy size={13} />
                <span>Salin SQL</span>
              </button>
              <button
                type="button"
                onClick={() => handleLoadSqlDump(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel hover:border-neon/40 text-slate-200 text-xs font-mono px-3 py-1.5 transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>Unduh .sql</span>
              </button>
            </div>
          </div>
          <pre className="max-h-80 overflow-auto rounded-xl bg-panel/90 border border-line p-4 text-[11px] font-mono text-slate-300 leading-relaxed">
            {sqlDump}
          </pre>
        </div>
      )}

      {/* Relational Tables Overview */}
      <div className="rounded-2xl border border-line bg-panel/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-100">
              Struktur Tabel Relasional PostgreSQL (14 Tabel)
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Seluruh entitas aplikasi dan file foto upload (<code className="text-neon">wjp_files</code>) dipetakan ke tabel relasional PostgreSQL dengan kolom indeks utama dan payload JSONB.
            </p>
          </div>
          <span className="text-xs font-mono text-neon font-bold">
            Total: {status?.total_records || 0} Baris
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-void/60 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Nama Tabel SQL</th>
                <th className="py-3 px-4">Deskripsi Entitas</th>
                <th className="py-3 px-4">Primary Key</th>
                <th className="py-3 px-4 text-right">Jumlah Baris</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 text-xs font-mono">
              {tables.map((t) => (
                <tr key={t.name} className="hover:bg-void/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-neon">{t.name}</td>
                  <td className="py-3 px-4 text-slate-300">{t.label}</td>
                  <td className="py-3 px-4 text-slate-400">{t.primary_key}</td>
                  <td className="py-3 px-4 text-right font-bold text-lime tabular-nums">
                    {t.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
