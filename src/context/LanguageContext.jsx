import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const LanguageContext = createContext({
  lang: "id",
  setLang: () => {},
  toggleLang: () => {},
  t: (idText, enText) => idText,
});

// Exact phrase dictionary (Indonesian -> English)
const EXACT_MAP = {
  // Navbar & Bottom Dock
  "Masuk": "Sign In",
  "Keluar": "Sign Out",
  "Beranda": "Home",
  "Akun": "Account",
  "Top Up": "Top Up",
  "Panel Admin": "Admin Panel",

  // Hero Section
  "Store Game Indonesia • 100% Garansi Aman": "Indonesia Game Store • 100% Safe Guarantee",
  "BELI AKUN GAME": "BUY GAME ACCOUNTS",
  "& JASA JOKI": "& PRO BOOSTING",
  "INSTANT.": "INSTANTLY.",
  "PROSES 1-5 MENIT": "1-5 MIN PROCESS",
  "GARANSI PENUH": "FULL WARRANTY",
  "OTOMATIS 24/7": "24/7 AUTOMATIC",
  "TERVERIFIKASI": "VERIFIED",
  "Store game terpercaya, dapatkan akun game berkualitas dan joki dengan harga terjangkau, proses cepat dan tanpa ribet juga bergaransi.":
    "Trusted gaming marketplace — get premium game accounts and pro rank boosting at affordable prices, fast delivery, zero hassle, and full warranty.",
  "Anti-Hackback": "Anti-Hackback",
  "Kirim Instan": "Instant Delivery",
  "Bergaransi": "Guaranteed",
  "Jelajahi Katalog": "Explore Catalog",
  "Top Up Instan": "Instant Top Up",
  "Sosial Media": "Social Media",
  "Belum ada sosial media": "No social media links yet",
  "Produk Terjual": "Products Sold",
  "Rating Pembeli": "Buyer Rating",
  "Jam Operasional": "Operating Hours",
  "TRANSAKSI LIVE": "LIVE TRANSACTION",
  "TOP UP KILAT": "FLASH TOP UP",
  "JOKI SELESAI": "BOOST COMPLETED",
  "STOK BARU": "NEW STOCK",
  "Akun Mythic Glory Full Skin baru saja terjual": "Mythic Glory Full Skin Account just sold",
  "Top Up 257 Diamonds MLBB sukses terkirim": "257 Diamonds MLBB Top Up delivered",
  "Order Joki Rank Legend → Mythic Honor tuntas": "Legend → Mythic Honor Boost completed",
  "Akun Sultan Valorant & Genshin siap checkout": "Premium Valorant & Genshin Accounts ready",
  "2 menit lalu • Terverifikasi": "2 mins ago • Verified",
  "8 detik • Otomatis": "8 secs • Automatic",
  "11 menit lalu • Winrate 88%": "11 mins ago • 88% Winrate",
  "Baru saja • Garansi 100%": "Just now • 100% Warranty",
  "Unggulan": "Featured",
  "Jasa Joki Pro": "Pro Boosting",
  "Akun Sultan": "Premium Account",
  "Harga Terbaik": "Best Price",
  "Lihat Detail": "View Details",
  "Garansi 100%": "100% Warranty",
  "Proses 5-15 Menit": "5-15 Min Process",
  "Status": "Status",
  "Siap Kirim": "Ready to Send",
  "Garansi": "Warranty",
  "100% Aman": "100% Safe",
  "Proses": "Process",
  "Instan": "Instant",
  "Estimasi": "Estimated",
  "Penjoki": "Booster",

  // Marquee
  "100% Garansi Akun Aman": "100% Safe Account Warranty",
  "Joki Pro Player Fast Rank": "Pro Player Fast Rank Boost",
  "Top Up Otomatis 24/7": "24/7 Automated Top Up",
  "Proses Hanya 5-15 Menit": "Fast 5-15 Minute Delivery",
  "Chat CS WhatsApp Responsif": "Responsive WhatsApp Support",

  // Catalog
  "Katalog Store • Bergaransi 100%": "Store Catalog • 100% Guaranteed",
  "Pilih Senjata": "Choose Your ",
  "mu.": "Arsenal.",
  "Koleksi akun sultan dan jasa joki terverifikasi siap kirim dengan jaminan anti-hackback.":
    "Verified premium accounts and pro boosting services ready for instant delivery with anti-hackback protection.",
  "Semua Kategori": "All Categories",
  "Akun Game": "Game Accounts",
  "Jasa Joki": "Boosting Services",
  "Item Game": "Game Items",
  "Lainnya": "Others",
  "Semua Game": "All Games",
  "Paling Populer": "Most Popular",
  "Harga: Rendah ke Tinggi": "Price: Low to High",
  "Harga: Tinggi ke Rendah": "Price: High to Low",
  "Produk Terbaru": "Newest Products",
  "Tidak ada produk yang cocok": "No matching products found",
  "Coba gunakan kata kunci pencarian lain atau klik reset filter untuk melihat seluruh katalog.":
    "Try another search keyword or reset the filters to view the full catalog.",
  "Tampilkan Semua Produk": "Show All Products",
  "Detail & Beli": "Details & Buy",
  "Habis": "Sold Out",
  "Diskon Hot": "Hot Deal",
  "Coba Lagi": "Try Again",
  "Gagal memuat produk. Periksa koneksi internet kamu.": "Failed to load products. Check your internet connection.",

  // How It Works
  "02 — Cara Kerja": "02 — How It Works",
  "Tiga Langkah.": "Three Steps.",
  "Tiga Langkah. ": "Three Steps. ",
  "Nol Ribet.": "Zero Hassle.",
  "Pilih Akun / Jasa": "Choose Account / Boost",
  "Cari produk game impianmu di katalog atau pilih paket jasa joki rank sesuai kebutuhan & budget.":
    "Browse your dream game account in our catalog or pick a rank boosting package that fits your needs & budget.",
  "Bayar & Konfirmasi": "Pay & Confirm",
  "Transfer ke rekening bank, e-wallet, atau scan QRIS yang tersedia, lalu upload bukti transfer. Admin akan mengonfirmasi pembayaranmu.":
    "Transfer via bank account, e-wallet, or scan QRIS, then upload your payment receipt. Admin will verify your payment.",
  "Terima & Garansi": "Receive & Warranty",
  "Data akun atau proses joki langsung dikirim dalam 5-15 menit. Dilengkapi garansi 100% aman.":
    "Account credentials or boosting progress are delivered within 5-15 minutes, backed by our 100% safety guarantee.",

  // Testimonials
  "03 — Bukti Sosial": "03 — Social Proof",
  "Kata Mereka.": "Their Words.",
  "Kata Mereka. ": "Their Words. ",
  "Bukan Kata Kami.": "Not Just Ours.",
  "Screenshot chat": "Chat Screenshot",

  // Footer
  "Marketplace akun game & jasa joki terpercaya di Indonesia. Semua transaksi dilindungi garansi 100% uang kembali.":
    "Indonesia's trusted game account & boosting marketplace. Every transaction is protected by a 100% money-back guarantee.",
  "Chat WhatsApp CS": "Chat WhatsApp Support",
  "Navigasi": "Navigation",
  "Top Up Game": "Game Top Up",
  "Katalog Produk": "Product Catalog",
  "Cara Kerja": "How It Works",
  "Testimoni": "Testimonials",
  "Jaminan Kami": "Our Guarantees",
  "Garansi 100% uang kembali": "100% money-back guarantee",
  "Pembayaran via Transfer Bank / E-Wallet / QRIS": "Pay via Bank Transfer / E-Wallet / QRIS",
  "Proses cepat 5-15 menit": "Fast 5-15 minute delivery",
  "© 2026 WillJustPlay — Store Game Indonesia": "© 2026 WillJustPlay — Indonesia Game Store",
  "Akun • Joki • Top Up": "Accounts • Boosting • Top Up",

  // Product Modal & Checkout
  "Spesifikasi": "Specifications",
  "Deskripsi": "Description",
  "Deskripsi Produk": "Product Description",
  "Data Pengiriman Pesanan": "Order Delivery Info",
  "Metode Pembayaran": "Payment Method",
  "Transfer Manual": "Manual Transfer",
  "Pilih Tujuan Transfer": "Select Transfer Destination",
  "Total Pembayaran": "Total Payment",
  "Beli Sekarang": "Buy Now",
  "Tanyakan via WhatsApp": "Ask via WhatsApp",
  "Stok Habis": "Out of Stock",

  // Topup Page
  "Pilih Game": "Select Game",
  "Data Akun": "Account Info",
  "Pilih Nominal": "Select Denomination",
  "Pembayaran": "Payment",
  "Ganti Game": "Change Game",
  "Lanjutkan": "Continue",
  "Kembali": "Back",
  "Cek Akun": "Verify Account",
  "Bayar Sekarang": "Pay Now",

  // Account Page
  "Ringkasan": "Overview",
  "Pesanan": "Orders",
  "Pesanan Saya": "My Orders",
  "Favorit": "Wishlist",
  "Keamanan": "Security",
  "Pengaturan": "Settings",
  "Semua": "All",
  "Menunggu": "Pending",
  "Lunas": "Paid",
  "Gagal": "Failed",
  "Ditolak": "Rejected",
  "Dibatalkan": "Cancelled",
  "Menunggu Verifikasi": "Awaiting Verification",
  "Belum Dibayar": "Unpaid",
  "Baru bergabung": "Just joined",
  "Simpan Perubahan": "Save Changes",
  "Ubah Password": "Change Password",

  // Auth Modal
  "Daftar": "Register",
  "Lupa Password": "Forgot Password",
  "Lupa password?": "Forgot password?",
  "Verifikasi Email": "Verify Email",
  "Kirim Tautan Reset": "Send Reset Link",
  "Buat Akun": "Create Account",
};

const ATTRIBUTE_MAP = {
  "Cari nama akun, game, atau skin...": "Search account name, game, or skin...",
  "Hapus pencarian": "Clear search",
  "Urutkan produk": "Sort products",
  "Tambah ke favorit": "Add to wishlist",
  "Produk sebelumnya": "Previous product",
  "Produk selanjutnya": "Next product",
  "Cari game...": "Search games...",
  "Cari pesanan...": "Search orders...",
};

function translateDynamicString(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (EXACT_MAP[trimmed]) {
    return raw.replace(trimmed, EXACT_MAP[trimmed]);
  }

  // Pattern: "123 terjual • Stok 4"
  let m = trimmed.match(/^(\d+)\s+terjual\s+•\s+Stok\s+(\d+)$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} sold • Stock ${m[2]}`);
  }

  // Pattern: "123 terjual"
  m = trimmed.match(/^(\d+)\s+terjual$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} sold`);
  }

  // Pattern: "12 Item"
  m = trimmed.match(/^(\d+)\s+Item$/);
  if (m) {
    return raw.replace(trimmed, `${m[1]} ${Number(m[1]) === 1 ? "Item" : "Items"}`);
  }

  // Pattern: "Hemat 15%"
  m = trimmed.match(/^Hemat\s+(\d+%)$/i);
  if (m) {
    return raw.replace(trimmed, `Save ${m[1]}`);
  }

  // Pattern: "12 ulasan terverifikasi"
  m = trimmed.match(/^(\d+)\s+ulasan terverifikasi$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} verified reviews`);
  }

  return null;
}

const nodeMemory = new WeakMap();
const trackedNodes = new Set();
const trackedElements = new Set();

function applyTranslationToDOM(lang) {
  if (typeof document === "undefined" || !document.body) return;

  if (lang === "id") {
    trackedNodes.forEach((node) => {
      const mem = nodeMemory.get(node);
      if (mem && node.nodeValue === mem.en) {
        node.nodeValue = mem.id;
      }
    });
    trackedElements.forEach((el) => {
      const mem = nodeMemory.get(el);
      if (mem) {
        for (const [attr, pair] of Object.entries(mem)) {
          if (el.getAttribute(attr) === pair.en) {
            el.setAttribute(attr, pair.id);
          }
        }
      }
    });
    return;
  }

  // lang === "en"
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const parentTag = node.parentElement?.tagName;
    if (parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "NOSCRIPT") continue;
    const currentVal = node.nodeValue || "";
    const mem = nodeMemory.get(node);

    // If already translated and unchanged, skip
    if (mem && currentVal === mem.en) continue;

    // Otherwise treat currentVal as Indonesian source
    const translated = translateDynamicString(currentVal);
    if (translated && translated !== currentVal) {
      nodeMemory.set(node, { id: currentVal, en: translated });
      trackedNodes.add(node);
      node.nodeValue = translated;
    }
  }

  // Translate placeholders and aria-labels
  const elements = document.body.querySelectorAll("[placeholder], [aria-label], [title]");
  elements.forEach((el) => {
    ["placeholder", "aria-label", "title"].forEach((attr) => {
      const val = el.getAttribute(attr);
      if (!val) return;
      const mem = nodeMemory.get(el) || {};
      if (mem[attr] && val === mem[attr].en) return;
      const translated = ATTRIBUTE_MAP[val.trim()] || EXACT_MAP[val.trim()];
      if (translated && translated !== val) {
        mem[attr] = { id: val, en: translated };
        nodeMemory.set(el, mem);
        trackedElements.add(el);
        el.setAttribute(attr, translated);
      }
    });
  });
}

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem("wjp_lang");
      return saved === "en" ? "en" : "id";
    } catch {
      return "id";
    }
  });

  const setLang = useCallback((nextLang) => {
    const normalized = nextLang === "en" ? "en" : "id";
    setLangState(normalized);
    try {
      localStorage.setItem("wjp_lang", normalized);
    } catch {}
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === "id" ? "en" : "id";
      try {
        localStorage.setItem("wjp_lang", next);
      } catch {}
      return next;
    });
  }, []);

  const t = useCallback(
    (idText, enText) => (lang === "en" ? enText : idText),
    [lang]
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    applyTranslationToDOM(lang);

    if (lang !== "en") return;

    let rafId = null;
    const observer = new MutationObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        applyTranslationToDOM("en");
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
