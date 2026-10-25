import { Zap } from "lucide-react";

const ITEMS = [
  "100% Garansi Akun Aman",
  "Joki Pro Player Fast Rank",
  "Top Up Otomatis 24/7",
  "Proses Hanya 5-15 Menit",
  "Chat CS WhatsApp Responsif",
];

export const Marquee = () => {
  const seq = [...ITEMS, ...ITEMS];
  return (
    <div
      data-testid="marquee-strip"
      className="group relative w-full border-y border-line bg-[#0A0D14] overflow-hidden py-3.5 sm:py-5 select-none marquee-mask"
    >
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0">
            {seq.map((t, i) => (
              <span
                key={i}
                className="flex items-center gap-6 sm:gap-10 px-6 sm:px-10 font-display text-[10px] sm:text-[11px] uppercase tracking-[0.25em] sm:tracking-[0.35em] text-neon/85 whitespace-nowrap"
              >
                {t}
                <Zap size={11} className="text-coral/80 shrink-0" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};