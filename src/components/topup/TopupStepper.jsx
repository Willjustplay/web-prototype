import { motion } from "framer-motion";
import { Check, Gamepad2, Zap, CreditCard } from "lucide-react";

const STEPS = [
  { id: "game", label: "Pilih Game", icon: Gamepad2 },
  { id: "account", label: "Tujuan & Nominal", icon: Zap },
  { id: "payment", label: "Checkout", icon: CreditCard },
];

/** Horizontal progress indicator for the 3-step top up wizard. */
export const TopupStepper = ({ current, onGoTo, reachable, summaries = {} }) => {
  const normalizedCurrent = current === "denomination" ? "account" : current;
  const index = STEPS.findIndex((s) => s.id === normalizedCurrent);

  return (
    <ol
      data-testid="topup-stepper"
      className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-8"
      aria-label="Langkah top up"
    >
      {STEPS.map((step, i) => {
        const done = i < index;
        const active = i === index;
        const canGo = reachable ? reachable(step.id) : false;
        const StepIcon = step.icon;
        const subText = summaries[step.id];

        return (
          <li key={step.id} className="min-w-0">
            <button
              type="button"
              onClick={() => canGo && onGoTo(step.id)}
              disabled={!canGo}
              data-testid={`topup-step-${step.id}`}
              aria-current={active ? "step" : undefined}
              className={`group relative w-full text-left rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 overflow-hidden ${
                active
                  ? "border-neon/70 bg-neon/[0.07] shadow-[0_0_20px_rgba(0,240,255,0.12)]"
                  : done
                    ? "border-lime/40 bg-lime/[0.04] hover:border-lime/70"
                    : "border-line bg-panel/50 opacity-60"
              } ${canGo ? "cursor-pointer active:scale-[0.99]" : "cursor-default"}`}
            >
              {active && (
                <motion.div
                  layoutId="topupStepActiveBar"
                  className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-neon via-cyan-300 to-lime"
                />
              )}
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg shrink-0 grid place-items-center text-[10px] sm:text-[11px] font-bold font-mono transition-colors ${
                    active
                      ? "bg-neon text-void shadow-[0_0_10px_rgba(0,240,255,0.35)]"
                      : done
                        ? "bg-lime text-void"
                        : "bg-void/80 border border-line text-slate-500"
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : <StepIcon size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-display font-bold text-[11px] sm:text-xs truncate ${
                      active ? "text-neon" : done ? "text-slate-100" : "text-slate-400"
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-60 mr-1">0{i + 1}.</span>
                    {step.label}
                  </p>
                  {subText && (
                    <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5 hidden sm:block">
                      {subText}
                    </p>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export default TopupStepper;


