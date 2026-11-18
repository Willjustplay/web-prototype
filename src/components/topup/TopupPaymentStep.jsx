import { useState, useMemo } from "react";
import {
  Loader2,
  Wallet,
  QrCode,
  Store,
  AlertCircle,
  Mail,
  Phone,
  ShieldCheck,
  Check,
  Zap,
  ArrowRight,
  Landmark,
  Sparkles,
} from "lucide-react";
import { formatIDR, imgSrc } from "@/lib/api";

export const DEFAULT_DUITKU_CHANNELS = [
  // QRIS (PayKita Primary Option + Duitku QRIS)
  {
    code: "PK_QRIS",
    gateway_id: "paykita",
    name: "QRIS Otomatis (PayKita)",
    short_name: "QRIS Otomatis (PayKita)",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS instan via GoPay, DANA, OVO, ShopeePay & semua M-Banking",
  },
  {
    code: "SP",
    gateway_id: "duitku",
    name: "QRIS (ShopeePay / All E-Wallet & M-Banking)",
    short_name: "QRIS All Payment",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS dari DANA, OVO, GoPay, ShopeePay, LinkAja & M-Banking",
  },
  {
    code: "NQ",
    name: "QRIS Nobu Bank",
    short_name: "QRIS Nobu",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS Nasional via Nobu Bank",
  },
  {
    code: "DQ",
    name: "QRIS DANA",
    short_name: "QRIS DANA",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS Dinamis via DANA",
  },
  {
    code: "LA",
    name: "QRIS LinkAja",
    short_name: "QRIS LinkAja",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS Dinamis via LinkAja",
  },
  {
    code: "GQ",
    name: "QRIS GudangVoucher",
    short_name: "QRIS GV",
    category: "qris",
    category_label: "QRIS Instan",
    payment_flow: "qris",
    description: "Scan QRIS Dinamis via GudangVoucher",
  },
  // E-Wallet
  {
    code: "DA",
    name: "DANA",
    short_name: "DANA",
    category: "ewallet",
    category_label: "E-Wallet Instan",
    payment_flow: "ewallet",
    description: "Bayar instan langsung melalui aplikasi DANA",
  },
  {
    code: "OV",
    name: "OVO",
    short_name: "OVO",
    category: "ewallet",
    category_label: "E-Wallet Instan",
    payment_flow: "ewallet",
    description: "Bayar instan melalui notifikasi / aplikasi OVO",
  },
  {
    code: "SA",
    name: "ShopeePay Apps",
    short_name: "ShopeePay",
    category: "ewallet",
    category_label: "E-Wallet Instan",
    payment_flow: "ewallet",
    description: "Bayar instan langsung dari aplikasi ShopeePay",
  },
  {
    code: "LF",
    name: "LinkAja Apps",
    short_name: "LinkAja",
    category: "ewallet",
    category_label: "E-Wallet Instan",
    payment_flow: "ewallet",
    description: "Bayar instan langsung dari aplikasi LinkAja",
  },
  // Virtual Account Bank
  {
    code: "BC",
    name: "BCA Virtual Account",
    short_name: "BCA VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via myBCA, BCA Mobile, KlikBCA, atau ATM",
  },
  {
    code: "M2",
    name: "Mandiri Virtual Account",
    short_name: "Mandiri VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via Livin' by Mandiri atau ATM",
  },
  {
    code: "I1",
    name: "BNI Virtual Account",
    short_name: "BNI VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via Wondr / BNI Mobile atau ATM",
  },
  {
    code: "BR",
    name: "BRI Virtual Account (BRIVA)",
    short_name: "BRI VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via BRImo atau ATM BRI",
  },
  {
    code: "BV",
    name: "BSI Virtual Account",
    short_name: "BSI VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via BYOND / BSI Mobile",
  },
  {
    code: "B1",
    name: "CIMB Niaga Virtual Account",
    short_name: "CIMB VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via OCTO Mobile atau ATM",
  },
  {
    code: "BT",
    name: "Permata Bank Virtual Account",
    short_name: "Permata VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via PermataME / ATM",
  },
  {
    code: "VA",
    name: "Maybank Virtual Account",
    short_name: "Maybank VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via M2U ID atau ATM",
  },
  {
    code: "NC",
    name: "Bank Neo Commerce (BNC) VA",
    short_name: "BNC VA",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Verifikasi otomatis via aplikasi neobank",
  },
  {
    code: "A1",
    name: "ATM Bersama Virtual Account",
    short_name: "ATM Bersama",
    category: "va",
    category_label: "Virtual Account Bank",
    payment_flow: "va",
    description: "Transfer dari seluruh bank anggota jaringan ATM Bersama",
  },
  // Minimarket / Retail
  {
    code: "IR",
    name: "Indomaret",
    short_name: "Indomaret",
    category: "retail",
    category_label: "Minimarket / Retail",
    payment_flow: "retail",
    description: "Bayar tunai di gerai Indomaret / Ceriamart terdekat",
  },
  {
    code: "FT",
    name: "Alfamart / Alfamidi / Pos",
    short_name: "Alfamart Group",
    category: "retail",
    category_label: "Minimarket / Retail",
    payment_flow: "retail",
    description: "Bayar tunai di gerai Alfamart, Alfamidi, Pegadaian, atau Pos",
  },
];

const CATEGORY_TABS = [
  { id: "all", label: "Semua Metode", icon: Sparkles },
  { id: "qris", label: "QRIS Instan", icon: QrCode },
  { id: "ewallet", label: "E-Wallet", icon: Wallet },
  { id: "va", label: "Virtual Account Bank", icon: Landmark },
  { id: "retail", label: "Minimarket", icon: Store },
];

const getCategoryIcon = (category) => {
  switch (category) {
    case "qris":
      return QrCode;
    case "ewallet":
      return Wallet;
    case "va":
      return Landmark;
    case "retail":
      return Store;
    default:
      return QrCode;
  }
};

/** Step 4 — buyer contact, Duitku multi-payment method selection and order summary. */
export const TopupPaymentStep = ({
  game,
  denomination,
  destinationLabel,
  verifiedNickname,
  email,
  wa,
  onEmail,
  onWa,
  duitkuChannels = DEFAULT_DUITKU_CHANNELS,
  duitkuChannel = "PK_QRIS",
  onSelectDuitkuChannel,
  submitting,
  summaryError,
  onSubmit,
}) => {
  const [activeCategory, setActiveCategory] = useState("all");

  const channels = useMemo(
    () =>
      Array.isArray(duitkuChannels) && duitkuChannels.length > 0
        ? duitkuChannels
        : DEFAULT_DUITKU_CHANNELS,
    [duitkuChannels]
  );

  const selectedChannelObj = useMemo(
    () =>
      channels.find((c) => c.code === duitkuChannel) ||
      channels[0] ||
      DEFAULT_DUITKU_CHANNELS[0],
    [channels, duitkuChannel]
  );

  const groupedSections = useMemo(() => {
    const groups = [
      {
        id: "qris",
        title: "QRIS (Scan Semua E-Wallet & M-Banking)",
        subtitle: "Langsung aktif otomatis begitu selesai scan",
        icon: QrCode,
      },
      {
        id: "ewallet",
        title: "E-Wallet & Aplikasi Instan",
        subtitle: "DANA, OVO, ShopeePay, & LinkAja",
        icon: Wallet,
      },
      {
        id: "va",
        title: "Virtual Account Bank (Cek Otomatis 24 Jam)",
        subtitle: "BCA, Mandiri, BNI, BRI, BSI, CIMB, Permata, Maybank, BNC & ATM Bersama",
        icon: Landmark,
      },
      {
        id: "retail",
        title: "Minimarket / Gerai Retail",
        subtitle: "Bayar tunai di kasir Indomaret atau Alfamart",
        icon: Store,
      },
    ];
    return groups
      .filter((g) => activeCategory === "all" || activeCategory === g.id)
      .map((g) => ({
        ...g,
        items: channels.filter((c) => c.category === g.id),
      }))
      .filter((g) => g.items.length > 0);
  }, [channels, activeCategory]);

  return (
    <div data-testid="topup-payment-step" className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      {/* Left Column: Contact & Duitku Multi-Payment Selection */}
      <div className="lg:col-span-7 space-y-6">
        {/* Card 1: Buyer Contact (Mandatory Email for Top Up Invoice) */}
        <div className="rounded-2xl border border-line bg-panel/90 p-5 sm:p-6 shadow-[0_12px_35px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display font-bold text-sm sm:text-base text-slate-100">
                  01. Email Penerima Invoice Top Up
                </p>
                <span className="px-2 py-0.5 rounded border border-neon/40 bg-neon/10 text-neon text-[10px] font-mono font-bold uppercase">
                  Wajib Diisi *
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Invoice resmi pembayaran Top Up akan dikirim otomatis ke email Anda setelah pembayaran terkonfirmasi lunas.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="topup-buyer-email"
                className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-200"
              >
                <span>
                  Alamat Email Aktif <span className="text-neon font-bold">*</span>
                </span>
                {email?.trim() && (
                  <span
                    className={`text-[10px] ${
                      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                        ? "text-lime"
                        : "text-amber-300"
                    }`}
                  >
                    {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                      ? "✓ Format Valid"
                      : "Format Belum Valid"}
                  </span>
                )}
              </label>
              <div className="relative group">
                <Mail
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neon transition-colors pointer-events-none"
                />
                <input
                  id="topup-buyer-email"
                  data-testid="topup-buyer-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  placeholder="nama@gmail.com (Wajib diisi)"
                  className="w-full rounded-xl bg-void border border-line pl-10 pr-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-neon focus:shadow-[0_0_18px_rgba(0,240,255,0.14)] transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="topup-buyer-wa"
                className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-300"
              >
                <span>Nomor WhatsApp</span>
                <span className="text-[10px] text-slate-500">Opsional</span>
              </label>
              <div className="relative group">
                <Phone
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-neon transition-colors pointer-events-none"
                />
                <input
                  id="topup-buyer-wa"
                  data-testid="topup-buyer-wa"
                  type="tel"
                  inputMode="numeric"
                  value={wa}
                  onChange={(e) => onWa(e.target.value)}
                  placeholder="08123456789 (Opsional)"
                  className="w-full rounded-xl bg-void border border-line pl-10 pr-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-neon focus:shadow-[0_0_18px_rgba(0,240,255,0.14)] transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Duitku Multi-Payment Methods */}
        <div className="rounded-2xl border border-line bg-panel/90 p-5 sm:p-6 shadow-[0_12px_35px_rgba(0,0,0,0.4)] space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display font-bold text-sm sm:text-base text-slate-100">
                  02. Pilih Metode Pembayaran Otomatis
                </p>
                <span className="px-2 py-0.5 rounded-md border border-neon/40 bg-neon/10 text-neon text-[10px] font-mono font-bold uppercase">
                  Duitku Gateway
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Semua metode di bawah diproses otomatis 24/7 oleh Duitku tanpa perlu unggah bukti transfer manual.
              </p>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div
            className="flex flex-wrap gap-1.5 pb-3 border-b border-line/80"
            data-testid="duitku-category-tabs"
          >
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isTabActive = activeCategory === tab.id;
              const count =
                tab.id === "all"
                  ? channels.length
                  : channels.filter((c) => c.category === tab.id).length;
              if (tab.id !== "all" && count === 0) return null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  data-testid={`duitku-cat-${tab.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    isTabActive
                      ? "bg-neon text-void shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                      : "bg-void/80 border border-line text-slate-300 hover:border-neon/50 hover:text-neon"
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                      isTabActive ? "bg-void/20 text-void" : "bg-panel text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grouped Payment Channels */}
          <div className="space-y-5" data-testid="topup-methods">
            {groupedSections.map((group) => {
              const SectionIcon = group.icon;
              return (
                <div key={group.id} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SectionIcon size={14} className="text-neon shrink-0" />
                      <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-200">
                        {group.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                      {group.subtitle}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {group.items.map((ch) => {
                      const isSelected = ch.code === selectedChannelObj?.code;
                      const ChIcon = getCategoryIcon(ch.category);
                      return (
                        <button
                          key={ch.code}
                          type="button"
                          onClick={() => onSelectDuitkuChannel?.(ch.code)}
                          data-testid={`topup-duitku-channel-${ch.code}`}
                          aria-pressed={isSelected}
                          className={`group flex items-start justify-between gap-3 rounded-xl p-3.5 border text-left transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? "border-neon bg-neon/[0.09] shadow-[0_0_20px_rgba(0,240,255,0.16)]"
                              : "border-line bg-void/75 hover:border-neon/50"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 transition-colors mt-0.5 ${
                                isSelected
                                  ? "bg-neon text-void"
                                  : "bg-panel border border-line text-neon"
                              }`}
                            >
                              <ChIcon size={16} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-display font-bold text-xs text-slate-100">
                                  {ch.short_name || ch.name}
                                </span>
                                <span
                                  className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                                    isSelected
                                      ? "bg-neon/20 text-neon border border-neon/40"
                                      : "bg-panel border border-line text-slate-400"
                                  }`}
                                >
                                  {ch.code}
                                </span>
                              </div>
                              <p className="text-[10px] font-mono text-slate-400 mt-1 leading-snug line-clamp-2">
                                {ch.description || ch.name}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`w-5 h-5 rounded-full border grid place-items-center shrink-0 mt-0.5 transition-colors ${
                              isSelected
                                ? "border-neon bg-neon text-void"
                                : "border-line bg-void"
                            }`}
                          >
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Sticky Interactive Checkout Summary Card */}
      <aside className="lg:col-span-5">
        <div className="rounded-2xl border border-line bg-panel/95 overflow-hidden shadow-[0_16px_45px_rgba(0,0,0,0.5)] lg:sticky lg:top-24">
          <div className="h-1 w-full bg-gradient-to-r from-neon via-cyan-300 to-lime" />

          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <p className="font-display font-bold text-sm uppercase tracking-wider text-slate-100">
                Ringkasan Checkout
              </p>
              <span className="text-[10px] font-mono text-neon">Otomatis 24/7</span>
            </div>

            {/* Selected Game & Nominal Mini Card */}
            {game && (
              <div className="flex items-center gap-3.5 rounded-xl bg-void/90 border border-line p-3.5 mb-5">
                <img
                  src={imgSrc(game.icon || game.banner)}
                  alt={game.name}
                  className="w-12 h-12 rounded-lg object-cover border border-line shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-xs sm:text-sm text-slate-100 truncate">
                    {game.name}
                  </p>
                  <p className="flex items-center gap-1 text-xs font-mono font-semibold text-neon truncate mt-0.5">
                    <Zap size={11} className="shrink-0" />
                    <span className="truncate">{denomination?.label || "-"}</span>
                  </p>
                </div>
              </div>
            )}

            <dl className="space-y-3 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 font-mono">Game</dt>
                <dd className="text-right font-display font-bold text-slate-100">{game?.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 font-mono shrink-0">Tujuan Akun</dt>
                <dd
                  className="text-right font-mono text-slate-200 break-all"
                  data-testid="topup-summary-destination"
                >
                  {destinationLabel || "-"}
                </dd>
              </div>
              {verifiedNickname && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400 font-mono shrink-0">Nickname Pemain</dt>
                  <dd
                    className="text-right font-mono font-bold text-lime break-all"
                    data-testid="topup-summary-nickname"
                  >
                    {verifiedNickname}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 font-mono">Item Nominal</dt>
                <dd className="text-right font-display font-bold text-slate-100">
                  {denomination?.label || "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 font-mono shrink-0">Email Invoice</dt>
                <dd
                  className={`text-right font-mono break-all ${
                    email?.trim() ? "text-lime font-semibold" : "text-coral"
                  }`}
                  data-testid="topup-summary-email"
                >
                  {email?.trim() || "Wajib diisi *"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 font-mono">Gateway &amp; Metode</dt>
                <dd
                  className="text-right font-mono text-neon font-bold"
                  data-testid="topup-summary-method"
                >
                  Duitku &middot; {selectedChannelObj?.short_name || selectedChannelObj?.name} ({selectedChannelObj?.code})
                </dd>
              </div>

              <div className="flex justify-between items-end gap-4 pt-4 mt-2 border-t border-line">
                <dt className="text-slate-300 font-display font-bold text-xs uppercase tracking-wider">
                  Total Bayar
                </dt>
                <dd className="text-right">
                  <span
                    className="block font-mono font-extrabold text-neon text-lg sm:text-xl tabular-nums"
                    data-testid="topup-summary-total"
                  >
                    {formatIDR(denomination?.price || 0)}
                  </span>
                </dd>
              </div>
            </dl>

            {summaryError && (
              <div
                data-testid="topup-summary-error"
                className="flex items-start gap-2 mt-4 rounded-xl bg-coral/10 border border-coral/40 p-3 text-[11px] font-mono text-coral"
              >
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>{summaryError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              data-testid="topup-submit-button"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon to-cyan-300 hover:from-lime hover:to-neon text-void font-display font-extrabold text-xs uppercase tracking-wider py-3.5 px-5 shadow-[0_0_24px_rgba(0,240,255,0.3)] hover:shadow-[0_0_28px_rgba(163,230,53,0.45)] transition-all duration-200 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Memproses Pesanan...</span>
                </>
              ) : (
                <>
                  <span>Bayar dengan {selectedChannelObj?.short_name || "Duitku"}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            <div className="mt-4 pt-3.5 border-t border-line/60 flex items-center justify-center gap-2 text-[11px] font-mono text-slate-400 text-center">
              <ShieldCheck size={14} className="text-lime shrink-0" />
              <span>Verifikasi pembayaran otomatis Duitku 24/7</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default TopupPaymentStep;
