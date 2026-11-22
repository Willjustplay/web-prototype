import { useCallback, useEffect, useRef, useState } from "react";
import {
  Database,
  Server,
  CloudCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  FileJson,
  Copy,
  UploadCloud,
  DownloadCloud,
  Code2,
  ShieldCheck,
  HardDrive,
  Loader2,
  Trash2,
  Layers,
  Replace,
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
  const [loadingJsonExport, setLoadingJsonExport] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);

  // Manual Import / Restore states
  const fileInputRef = useRef(null);
  const [importMode, setImportMode] = useState("merge"); // "merge" | "replace"
  const [importFileMeta, setImportFileMeta] = useState(null);
  const [importContent, setImportContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

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
      toast.success(data?.message || "Konfigurasi PostgreSQL disimpan");
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

  const handleDownloadJsonBackup = async () => {
    setLoadingJsonExport(true);
    try {
      const { data } = await api.get("/admin/database/export-json");
      const backupObj = data?.backup;
      if (!backupObj) {
        throw new Error("Data backup JSON kosong");
      }
      const jsonText = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        data?.filename ||
        `willjustplay_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup JSON (.json) berhasil diunduh");
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Gagal mengunduh backup JSON"
      );
    } finally {
      setLoadingJsonExport(false);
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
        toast.success("Dump PostgreSQL (.sql) berhasil diunduh");
      } else {
        setShowSqlPreview(true);
      }
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Gagal membuat dump SQL"
      );
    } finally {
      setLoadingSql(false);
    }
  };

  const copySqlDump = async () => {
    if (!sqlDump) return;
    try {
      await navigator.clipboard.writeText(sqlDump);
      toast.success("Skrip SQL disalin");
    } catch {
      toast.error("Gagal menyalin skrip SQL");
    }
  };

  const inspectRawDatabaseText = (text, filename = "database_file") => {
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      setImportFileMeta(null);
      return;
    }
    const isLikelyJson =
      filename.toLowerCase().endsWith(".json") || trimmed.startsWith("{");
    if (isLikelyJson) {
      try {
        const parsed = JSON.parse(trimmed);
        const root =
          parsed?.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
            ? parsed.data
            : parsed;
        const games = Array.isArray(root?.games) ? root.games : [];
        const denomCount = games.reduce(
          (acc, g) => acc + (Array.isArray(g?.denominations) ? g.denominations.length : 0),
          0
        );
        setImportFileMeta({
          name: filename,
          size: trimmed.length,
          format: "json",
          valid: true,
          previewCounts: {
            products: Array.isArray(root?.products) ? root.products.length : 0,
            games: games.length,
            denominations: denomCount,
            users: Array.isArray(root?.users) ? root.users.length : 0,
            transactions: Array.isArray(root?.transactions) ? root.transactions.length : 0,
            files:
              root?.files && typeof root.files === "object"
                ? Object.keys(root.files).length
                : 0,
          },
        });
        return;
      } catch (err) {
        setImportFileMeta({
          name: filename,
          size: trimmed.length,
          format: "json",
          valid: false,
          error: `JSON tidak valid: ${err?.message || "Syntax error"}`,
        });
        return;
      }
    }

    const matches = trimmed.match(/INSERT\s+INTO\s+(?:public\.)?wjp_[a-z0-9_]+/gi) || [];
    setImportFileMeta({
      name: filename,
      size: trimmed.length,
      format: "sql",
      valid: matches.length > 0,
      sqlInserts: matches.length,
      error:
        matches.length === 0
          ? "Tidak ditemukan INSERT INTO wjp_* di file SQL ini."
          : null,
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || "");
      setImportContent(content);
      inspectRawDatabaseText(content, file.name);
    };
    reader.onerror = () => {
      toast.error("Gagal membaca file");
    };
    reader.readAsText(file);
  };

  const handleClearImportFile = () => {
    setImportContent("");
    setImportFileMeta(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleManualImportSubmit = async () => {
    const trimmed = String(importContent || "").trim();
    if (!trimmed) {
      toast.error("Pilih file database (.json / .sql) terlebih dahulu.");
      return;
    }
    if (importFileMeta && importFileMeta.valid === false) {
      toast.error(importFileMeta.error || "Format file tidak valid.");
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await api.post("/admin/database/import", {
        mode: importMode,
        format: importFileMeta?.format || "",
        content: trimmed,
      });
      setImportResult(data);
      toast.success(data?.message || "Database berhasil dipulihkan!");
      await loadStatus(true);
      if (onReload) onReload();
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Gagal memulihkan database"
      );
    } finally {
      setImporting(false);
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
    <div className="space-y-5" data-testid="admin-database-section">
      {/* Unified Compact Header & Backup/Restore Bar */}
      <div
        className="rounded-2xl border border-line bg-panel/90 p-4 sm:p-5 space-y-4"
        data-testid="manual-database-backup-restore-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl grid place-items-center bg-neon/10 border border-neon/40 text-neon">
              <Database size={16} />
            </span>
            <h2 className="font-display font-extrabold text-sm sm:text-base text-slate-100">
              Database &amp; Backup Manual
            </h2>
            <span className="rounded-md bg-void border border-line px-2 py-0.5 text-[11px] font-mono text-neon font-bold tabular-nums">
              {status?.total_records || 0} Baris
            </span>
          </div>

          <button
            type="button"
            onClick={() => loadStatus(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-void hover:border-neon/50 text-slate-300 hover:text-neon text-xs font-mono px-3 py-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-neon" : ""} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Single Row Controls: Unduh & Upload */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-line/60">
          {/* Unduh (Export) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1">
              Unduh:
            </span>
            <button
              type="button"
              onClick={handleDownloadJsonBackup}
              disabled={loadingJsonExport}
              data-testid="download-json-backup-button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-lime/50 bg-lime/10 hover:bg-lime hover:text-void text-lime text-xs font-mono font-bold px-3.5 py-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingJsonExport ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileJson size={14} />
              )}
              <span>Unduh .JSON</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadSqlDump(true)}
              disabled={loadingSql}
              data-testid="download-postgres-sql-button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neon/50 bg-neon/10 hover:bg-neon hover:text-void text-neon text-xs font-mono font-bold px-3.5 py-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingSql ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Unduh .SQL</span>
            </button>
          </div>

          {/* Upload / Restore */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1">
              Restore:
            </span>

            {/* Mode Segmented Toggle */}
            <div className="inline-flex rounded-xl border border-line bg-void p-0.5">
              <button
                type="button"
                onClick={() => setImportMode("merge")}
                data-testid="import-mode-merge-button"
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  importMode === "merge"
                    ? "bg-lime/20 text-lime"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers size={12} />
                <span>Merge</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode("replace")}
                data-testid="import-mode-replace-button"
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  importMode === "replace"
                    ? "bg-coral/20 text-coral"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Replace size={12} />
                <span>Replace</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.sql,application/json,application/sql,text/plain"
              onChange={handleFileChange}
              data-testid="manual-database-file-input"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="trigger-upload-db-button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/50 bg-cyan-400/10 hover:bg-cyan-400 hover:text-void text-cyan-300 text-xs font-mono font-bold px-3.5 py-2 transition-colors cursor-pointer"
            >
              <Upload size={14} />
              <span>{importFileMeta ? "Ganti File" : "Upload (.json / .sql)"}</span>
            </button>

            {importFileMeta && (
              <>
                <button
                  type="button"
                  onClick={handleManualImportSubmit}
                  disabled={importing || !importContent.trim() || !importFileMeta.valid}
                  data-testid="import-manual-database-button"
                  className={`inline-flex items-center gap-1.5 rounded-xl font-display font-extrabold text-xs uppercase tracking-wider px-4 py-2 transition-all cursor-pointer disabled:opacity-50 ${
                    importMode === "replace"
                      ? "bg-coral text-void hover:bg-coral/90"
                      : "bg-gradient-to-r from-lime to-neon text-void"
                  }`}
                >
                  {importing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <UploadCloud size={14} />
                  )}
                  <span>{importing ? "Proses..." : "Pulihkan"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearImportFile}
                  className="inline-flex items-center rounded-xl border border-line bg-void hover:border-coral/50 text-slate-400 hover:text-coral p-2 transition-colors cursor-pointer"
                  title="Batal"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Compact File Info Badge when a file is chosen */}
        {importFileMeta && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
              importFileMeta.valid
                ? "border-neon/40 bg-neon/5 text-slate-200"
                : "border-coral/50 bg-coral/10 text-coral"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-100">{importFileMeta.name}</span>
              <span className="text-slate-400">
                ({Math.max(1, Math.round((importFileMeta.size || 0) / 1024))} KB)
              </span>
            </div>

            {importFileMeta.valid && importFileMeta.previewCounts && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
                <span>Produk: <strong className="text-lime">{importFileMeta.previewCounts.products}</strong></span>
                <span>Game: <strong className="text-lime">{importFileMeta.previewCounts.games}</strong></span>
                <span>SKU: <strong className="text-lime">{importFileMeta.previewCounts.denominations}</strong></span>
                <span>Transaksi: <strong className="text-neon">{importFileMeta.previewCounts.transactions}</strong></span>
              </div>
            )}

            {importFileMeta.valid && importFileMeta.format === "sql" && (
              <span className="text-[11px] text-lime tabular-nums">
                {importFileMeta.sqlInserts} baris INSERT siap dipulihkan
              </span>
            )}

            {!importFileMeta.valid && importFileMeta.error && (
              <span className="text-[11px] text-coral">{importFileMeta.error}</span>
            )}
          </div>
        )}

        {/* Import Result Banner */}
        {importResult?.ok && (
          <div
            className="rounded-xl border border-lime/40 bg-lime/10 px-3.5 py-2.5 text-xs font-mono text-lime flex items-center gap-2"
            data-testid="manual-import-result-banner"
          >
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{importResult.message}</span>
          </div>
        )}
      </div>

      {/* 3 Storage Engine Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-line bg-panel/85 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-slate-100">
              <Server size={15} className="text-neon" />
              PostgreSQL
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                pg.connected
                  ? "bg-lime/15 border border-lime/40 text-lime"
                  : pg.configured
                  ? "bg-coral/15 border border-coral/40 text-coral"
                  : "bg-neon/15 border border-neon/40 text-neon"
              }`}
            >
              {pg.connected ? "TERHUBUNG" : pg.configured ? "ERROR" : "SIAP"}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400 space-y-0.5">
            <p className="truncate">
              Host: <span className="text-slate-200">{pg.host ? `${pg.host}:${pg.port || 5432}/${pg.database}` : "-"}</span>
            </p>
            <p>
              Skema: <span className="text-lime">14 Tabel Relasional</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel/85 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-slate-100">
              <CloudCheck size={15} className="text-lime" />
              Cloud Database
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                fb.configured
                  ? "bg-lime/15 border border-lime/40 text-lime"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {fb.configured ? "AKTIF" : "NONAKTIF"}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400 space-y-0.5">
            <p className="truncate">
              Project: <span className="text-slate-200">{fb.project_id || "-"}</span>
            </p>
            <p className="inline-flex items-center gap-1 text-lime">
              <ShieldCheck size={12} /> Rules Aktif
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel/85 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-slate-100">
              <HardDrive size={15} className="text-cyan-300" />
              Persistent Store
            </span>
            <span className="rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-cyan-400/15 border border-cyan-400/40 text-cyan-300">
              AKTIF
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400 space-y-0.5 tabular-nums">
            <p>
              Ukuran: <span className="text-slate-200">{Math.max(1, Math.round((local.size_bytes || 0) / 1024))} KB</span>
            </p>
            <p>
              Sinkron:{" "}
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
        className="rounded-2xl border border-line bg-panel/90 p-4 sm:p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-100">
            Koneksi PostgreSQL
          </h3>
          {pg.version && (
            <span className="text-[11px] font-mono text-lime bg-lime/10 border border-lime/30 rounded-lg px-2.5 py-0.5">
              {pg.version}
            </span>
          )}
        </div>

        {pg.last_error && (
          <div className="rounded-xl border border-coral/40 bg-coral/10 p-3 flex items-start gap-2 text-xs font-mono text-coral">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span className="text-slate-200">{pg.last_error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <input
              type="text"
              value={connString}
              onChange={(e) => setConnString(e.target.value)}
              placeholder="postgresql://postgres:password@db.example.com:5432/willjustplay?sslmode=require"
              data-testid="postgres-uri-input"
              className="w-full rounded-xl bg-void border border-line focus:border-neon outline-none text-xs font-mono px-3.5 py-2.5 text-slate-100 placeholder:text-slate-600 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUseSsl((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-mono font-bold transition-colors cursor-pointer ${
                useSsl
                  ? "border-neon/50 bg-neon/10 text-neon"
                  : "border-line bg-void text-slate-400"
              }`}
            >
              {useSsl ? "SSL: Aktif" : "SSL: Nonaktif"}
            </button>

            <button
              type="button"
              onClick={() => setAutoSync((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-mono font-bold transition-colors cursor-pointer ${
                autoSync
                  ? "border-lime/50 bg-lime/10 text-lime"
                  : "border-line bg-void text-slate-400"
              }`}
            >
              {autoSync ? "Sync: Otomatis" : "Sync: Manual"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              data-testid="save-postgres-config-button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-neon to-cyan-300 text-void font-display font-extrabold text-xs uppercase tracking-wider px-4 py-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Simpan Koneksi</span>
            </button>

            <button
              type="button"
              onClick={() => handleSync("push")}
              disabled={Boolean(syncing)}
              data-testid="postgres-push-button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neon/40 bg-neon/10 hover:bg-neon/20 text-neon text-xs font-mono font-bold px-3.5 py-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncing === "push" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UploadCloud size={14} />
              )}
              <span>Push</span>
            </button>

            <button
              type="button"
              onClick={() => handleSync("pull")}
              disabled={Boolean(syncing)}
              data-testid="postgres-pull-button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-lime/40 bg-lime/10 hover:bg-lime/20 text-lime text-xs font-mono font-bold px-3.5 py-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncing === "pull" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <DownloadCloud size={14} />
              )}
              <span>Pull</span>
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
            <span>{showSqlPreview ? "Tutup SQL" : "Lihat Skema SQL"}</span>
          </button>
        </div>
      </form>

      {/* Optional SQL Preview */}
      {showSqlPreview && sqlDump && (
        <div className="rounded-2xl border border-neon/40 bg-void/95 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-neon">
              Skema &amp; Dump SQL PostgreSQL
            </h4>
            <button
              type="button"
              onClick={copySqlDump}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neon/40 bg-neon/10 hover:bg-neon hover:text-void text-neon text-xs font-mono font-bold px-3 py-1.5 transition-colors cursor-pointer"
            >
              <Copy size={13} />
              <span>Salin SQL</span>
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-xl bg-panel/90 border border-line p-3.5 text-[11px] font-mono text-slate-300 leading-relaxed">
            {sqlDump}
          </pre>
        </div>
      )}

      {/* Relational Tables Overview */}
      <div className="rounded-2xl border border-line bg-panel/90 overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-100">
            Tabel Database (14 Tabel)
          </h3>
          <span className="text-xs font-mono text-neon font-bold tabular-nums">
            Total: {status?.total_records || 0} Baris
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-void/60 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-4">Tabel</th>
                <th className="py-2.5 px-4">Entitas</th>
                <th className="py-2.5 px-4">Primary Key</th>
                <th className="py-2.5 px-4 text-right">Baris</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 text-xs font-mono">
              {tables.map((t) => (
                <tr key={t.name} className="hover:bg-void/40 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-neon">{t.name}</td>
                  <td className="py-2.5 px-4 text-slate-300">{t.label}</td>
                  <td className="py-2.5 px-4 text-slate-400">{t.primary_key}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-lime tabular-nums">
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
