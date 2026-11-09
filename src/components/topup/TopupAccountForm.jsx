import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, Loader2, ShieldQuestion, UserCheck, Info, ShieldCheck } from "lucide-react";
import { localFieldError } from "@/hooks/useTopup";

/** Enter the in-game destination (User ID / Server / Zone) and verify Game ID nickname. */
export const TopupAccountForm = ({
  game,
  values,
  onChange,
  errors,
  checking,
  validation,
  onValidate,
}) => {
  if (!game) return null;
  const fields = game.fields || [];

  return (
    <div data-testid="topup-account-form" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-neon/15 border border-neon/40 text-neon grid place-items-center font-mono text-[11px] font-bold">
            1
          </span>
          <div>
            <h2 className="font-display font-bold text-sm sm:text-base text-slate-100">
              Masukkan &amp; Verifikasi ID Akun Game
            </h2>
            <p className="text-[11px] font-mono text-slate-400">
              Pastikan ID &amp; Server benar, lalu klik tombol Verifikasi ID Game untuk cek nickname
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onValidate}
          disabled={checking}
          data-testid="topup-validate-button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neon/60 bg-neon/15 text-neon font-display font-bold text-[11px] uppercase tracking-wider px-4 py-2 hover:bg-neon hover:text-void transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-95 shadow-[0_0_16px_rgba(0,240,255,0.15)]"
        >
          {checking ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
          <span>{checking ? "Memverifikasi ID..." : "Verifikasi ID Game"}</span>
        </button>
      </div>

      {/* Dynamic Input Grid */}
      <div className={`grid gap-3.5 sm:gap-4 ${fields.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {fields.map((field) => {
          const error = errors?.[field.key] ?? localFieldError(field, values[field.key]);
          const inputId = `topup-field-${field.key}`;
          const hasOptions = Array.isArray(field.options) && field.options.length > 0;
          return (
            <div key={field.key} className="space-y-1.5">
              <label
                htmlFor={inputId}
                className="block text-[11px] font-mono uppercase tracking-wider text-slate-300"
              >
                {field.label}
                {field.required === false && (
                  <span className="text-slate-500 normal-case tracking-normal"> (opsional)</span>
                )}
              </label>

              {hasOptions ? (
                <select
                  id={inputId}
                  data-testid={`topup-input-${field.key}`}
                  name={field.key}
                  value={values[field.key] ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${inputId}-error` : `${inputId}-help`}
                  className={`w-full rounded-xl bg-void border px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none transition-all duration-200 ${
                    error
                      ? "border-coral focus:border-coral"
                      : "border-line focus:border-neon focus:shadow-[0_0_16px_rgba(0,240,255,0.12)]"
                  }`}
                >
                  <option value="">{field.placeholder || `Pilih ${field.label}...`}</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={inputId}
                  data-testid={`topup-input-${field.key}`}
                  name={field.key}
                  value={values[field.key] ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  inputMode={field.inputmode || "text"}
                  placeholder={field.placeholder || `Masukkan ${field.label}...`}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${inputId}-error` : `${inputId}-help`}
                  className={`w-full rounded-xl bg-void border px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all duration-200 ${
                    error
                      ? "border-coral focus:border-coral"
                      : "border-line focus:border-neon focus:shadow-[0_0_16px_rgba(0,240,255,0.12)]"
                  }`}
                />
              )}

              {error ? (
                <p
                  id={`${inputId}-error`}
                  data-testid={`topup-error-${field.key}`}
                  className="flex items-start gap-1.5 text-[11px] font-mono text-coral"
                >
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              ) : (
                field.help && (
                  <p id={`${inputId}-help`} className="text-[11px] font-mono text-slate-500">
                    {field.help}
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Live Game ID Verification Feedback */}
      <div aria-live="polite" role="status" className="text-xs font-mono">
        <AnimatePresence mode="wait">
          {validation?.ok && validation.checked && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="topup-validate-ok"
              className="rounded-xl bg-lime/10 border border-lime/40 px-4 py-3 text-lime"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="w-5 h-5 rounded-full bg-lime text-void grid place-items-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>Nickname: {validation.nickname || "Akun ditemukan"}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-void/70 border border-lime/40 text-lime">
                  <ShieldCheck size={11} /> ID Terverifikasi
                </span>
              </div>
              {validation.customer_no && (
                <p className="text-[11px] font-mono text-slate-300 mt-1.5 pl-7">
                  Tujuan Pengiriman: <span className="text-slate-100 font-bold">{validation.customer_no}</span>
                  {validation.server_label ? ` (${validation.server_label})` : ""}
                </p>
              )}
            </motion.div>
          )}
          {validation?.ok && !validation.checked && (
            <motion.div
              key="unchecked"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="topup-validate-unchecked"
              className="inline-flex items-center gap-1.5 text-slate-300"
            >
              <ShieldQuestion size={13} className="text-neon" />
              <span>{validation.message || "ID siap diproses"}</span>
            </motion.div>
          )}
          {validation && !validation.ok && (
            <motion.div
              key="fail"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="topup-validate-fail"
              className="flex items-center gap-2 rounded-xl bg-coral/10 border border-coral/40 px-3.5 py-2.5 text-coral"
            >
              <AlertCircle size={14} className="shrink-0" />
              <span>{validation.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {game.notes && (
        <div className="flex items-start gap-2 rounded-xl bg-void/50 border border-line/70 px-3.5 py-2.5 text-[11px] font-mono text-slate-400">
          <Info size={13} className="text-neon shrink-0 mt-0.5" />
          <p>{game.notes}</p>
        </div>
      )}
    </div>
  );
};

export default TopupAccountForm;


