import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const LanguageContext = createContext({
  lang: "id",
  setLang: () => {},
  toggleLang: () => {},
  t: (idText, enText) => idText,
  translateDesc: (text) => text,
  translateCategory: (cat) => cat,
  translateBadge: (badge) => badge,
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
  "Pilih Bahasa": "Select Language",

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
  "Setiap akun melewati verifikasi berlapis & garansi uang kembali penuh jika terjadi kendala keamanan.":
    "Every account passes multi-layer verification & a full money-back guarantee in case of any security issue.",
  "Data akun & progres pesanan diproses cepat dalam 1–15 menit langsung ke akun atau WhatsApp Anda.":
    "Account credentials & order progress are processed rapidly within 1–15 minutes directly to your account or WhatsApp.",
  "Dukungan admin responsif setiap hari pukul 10.00–22.00 WIB siap mengawal transaksi sampai tuntas.":
    "Responsive admin support every day from 10:00–22:00 WIB ready to assist your transaction until completion.",
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
  "6-12 Jam": "6-12 Hours",

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
  "akun": "Account",
  "joki": "Boosting",
  "item": "Item",
  "Semua Game": "All Games",
  "Paling Populer": "Most Popular",
  "Harga Terendah": "Lowest Price",
  "Harga Tertinggi": "Highest Price",
  "Harga: Rendah ke Tinggi": "Price: Low to High",
  "Harga: Tinggi ke Rendah": "Price: High to Low",
  "Produk Terbaru": "Newest Products",
  "Stok Ready": "In Stock",
  "Produk tidak ditemukan": "No products found",
  "Coba kata kunci lain atau atur ulang filter pencarian Anda.":
    "Try another keyword or reset your search filters.",
  "Reset Filter": "Reset Filters",
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
  "02. Alur Transaksi Cepat": "02. Fast Transaction Flow",
  "Tiga Langkah.": "Three Steps.",
  "Tiga Langkah. ": "Three Steps. ",
  "Nol Ribet.": "Zero Hassle.",
  "Beli Akun & Joki": "Buy Accounts & Boost",
  "Top-Up Game Instan": "Instant Game Top-Up",
  "~1 Menit": "~1 Minute",
  "QRIS / Transfer": "QRIS / Transfer",
  "5–15 Menit": "5–15 Minutes",
  "1–5 Menit": "1–5 Minutes",
  "Detik Itu Juga": "Right Away",
  "Otomatis 24/7": "24/7 Automatic",
  "Pilih Akun / Jasa": "Choose Account / Boost",
  "Cari produk game impianmu di katalog atau pilih paket jasa joki rank sesuai kebutuhan & budget.":
    "Browse your dream game account in our catalog or pick a rank boosting package that fits your needs & budget.",
  "Cari akun game impianmu di katalog atau pilih paket jasa joki rank sesuai kebutuhan & budget.":
    "Browse your dream game account in our catalog or pick a rank boosting package that fits your needs & budget.",
  "Spesifikasi akun transparan": "Transparent account specs",
  "Harga IDR & USD jelas": "Clear IDR & USD pricing",
  "Bayar & Konfirmasi": "Pay & Confirm",
  "Transfer ke rekening bank, e-wallet, atau scan QRIS yang tersedia, lalu upload bukti transfer. Admin akan mengonfirmasi pembayaranmu.":
    "Transfer via bank account, e-wallet, or scan QRIS, then upload your payment receipt. Admin will verify your payment.",
  "Selesaikan pembayaran via QRIS otomatis, e-wallet, atau transfer bank dengan sistem verifikasi cepat.":
    "Complete payment via automated QRIS, e-wallet, or bank transfer with fast verification.",
  "QRIS otomatis 24/7": "24/7 automated QRIS",
  "Bukti transfer terenkripsi": "Encrypted transfer receipt",
  "Terima & Garansi": "Receive & Warranty",
  "Data akun atau proses joki langsung dikirim dalam 5-15 menit. Dilengkapi garansi 100% aman.":
    "Account credentials or boosting progress are delivered within 5-15 minutes, backed by our 100% safety guarantee.",
  "Data akses akun atau progres joki langsung dikirim ke dashboard Akun Saya. Dilengkapi garansi penuh.":
    "Account credentials or boosting progress are delivered directly to your My Account dashboard with full warranty.",
  "Akses instan di brankas akun": "Instant access in account vault",
  "Garansi 100% uang kembali": "100% money-back guarantee",
  "Masukkan ID & Pilih Nominal": "Enter ID & Select Amount",
  "Pilih game favoritmu, masukkan User ID / Zone ID, lalu pilih nominal diamond atau voucher yang diinginkan.":
    "Pick your favorite game, enter your User ID / Zone ID, and choose your desired diamond or voucher package.",
  "Tanpa perlu login akun game": "No game login required",
  "Harga langsung dari pusat": "Direct official pricing",
  "Scan QRIS / E-Wallet": "Scan QRIS / E-Wallet",
  "Bayar praktis menggunakan QRIS atau metode pembayaran instan tanpa harus antre konfirmasi manual.":
    "Pay conveniently via QRIS or instant payment methods without waiting for manual confirmation.",
  "Verifikasi pembayaran real-time": "Real-time payment verification",
  "Bebas biaya tersembunyi": "Zero hidden fees",
  "Diamond Langsung Masuk": "Instant Diamond Delivery",
  "Sistem memproses pesanan secara otomatis dan item langsung dikirim ke akun game kamu dengan status real-time.":
    "Our system processes orders automatically and delivers items straight to your game account with real-time status.",
  "Lacak status di halaman invoice": "Track status on invoice page",
  "Dukungan CS responsif": "Responsive customer support",

  // Testimonials
  "03 — Bukti Sosial": "03 — Social Proof",
  "03. Bukti Sosial & Reputasi": "03. Social Proof & Reputation",
  "Kata Mereka.": "Their Words.",
  "Kata Mereka. ": "Their Words. ",
  "Bukan Kata Kami.": "Not Just Ours.",
  "Dengan Bukti Foto": "With Photo Proof",
  "Bukti Transaksi": "Transaction Proof",
  "Pembeli Terverifikasi": "Verified Buyer",
  "Screenshot chat": "Chat Screenshot",

  // Footer
  "Marketplace akun game & jasa joki terpercaya di Indonesia. Semua transaksi dilindungi garansi 100% uang kembali.":
    "Indonesia's trusted game account & boosting marketplace. Every transaction is protected by a 100% money-back guarantee.",
  "Marketplace akun game, top-up instan, & jasa joki terpercaya di Indonesia. Semua transaksi dilindungi garansi resmi 100% uang kembali.":
    "Indonesia's trusted game account, instant top-up, & boosting marketplace. All transactions are backed by an official 100% money-back guarantee.",
  "Chat WhatsApp CS": "Chat WhatsApp Support",
  "Navigasi": "Navigation",
  "Top Up Game": "Game Top Up",
  "Katalog Produk": "Product Catalog",
  "Cara Kerja": "How It Works",
  "Testimoni": "Testimonials",
  "Jaminan Kami": "Our Guarantees",
  "Jaminan Layanan": "Service Guarantees",
  "Garansi 100% uang kembali & akun aman": "100% money-back guarantee & safe accounts",
  "Pembayaran QRIS Otomatis, E-Wallet, & Bank": "Automated QRIS, E-Wallet, & Bank payments",
  "Proses pengiriman cepat 5–15 menit": "Fast 5–15 minute delivery process",
  "Pembayaran via Transfer Bank / E-Wallet / QRIS": "Pay via Bank Transfer / E-Wallet / QRIS",
  "Proses cepat 5-15 menit": "Fast 5-15 minute delivery",
  "© 2026 WillJustPlay — Store Game Indonesia": "© 2026 WillJustPlay — Indonesia Game Store",
  "© 2026 WillJustPlay · Official Game Store Indonesia": "© 2026 WillJustPlay · Official Game Store Indonesia",
  "Akun • Joki • Top Up": "Accounts • Boosting • Top Up",
  "Akun Game · Jasa Joki · Top-Up 24/7": "Game Accounts · Boosting · 24/7 Top-Up",

  // Product Modal & Checkout
  "Layar Penuh": "Full View",
  "Proporsional": "Fit View",
  "Stok": "Stock",
  "Detail": "Details",
  "Tutup": "Close",
  "Tidak ada deskripsi tambahan.": "No additional description.",
  "Email Penerima": "Recipient Email",
  "Tutup WhatsApp": "Hide WhatsApp",
  "QRIS Instan": "Instant QRIS",
  "Transfer / QRIS": "Transfer / QRIS",
  "QRIS Semua E-Wallet & M-Banking": "QRIS All E-Wallets & M-Banking",
  "Otomatis": "Automatic",
  "Metode pembayaran sedang tidak aktif.": "Payment methods are currently inactive.",
  "Wallet crypto belum tersedia.": "Crypto wallet is not available yet.",
  "Tujuan transfer belum tersedia.": "Transfer destination is not available yet.",
  "Memproses...": "Processing...",
  "Tanya CS": "Ask Support",
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
  "Top Up Instan 24/7 · Digiflazz Official": "24/7 Instant Top Up · Digiflazz Official",
  "Top Up Resmi 24/7": "Official 24/7 Top Up",
  "Riwayat Top Up": "Top Up History",
  "Katalog Top Up": "Top Up Catalog",
  "Semua Game Top Up": "All Top Up Games",
  "Otomatis 24/7 • Resmi & Aman": "24/7 Automated • Official & Safe",
  "Proses Otomatis 24 Jam • Resmi & Aman": "24/7 Automated • Official & Safe",
  "Pilih Game": "Select Game",
  "Tujuan & Nominal": "Account & Amount",
  "Data Akun": "Account Info",
  "Pilih Nominal": "Select Amount",
  "Pembayaran": "Payment",
  "Ganti Game": "Change Game",
  "Lanjutkan": "Continue",
  "Kembali": "Back",
  "Cek Akun": "Verify Account",
  "Cek ID Digiflazz": "Verify Game ID",
  "Mengecek ID...": "Checking ID...",
  "Mengecek ke Digiflazz...": "Checking with Digiflazz...",
  "Terverifikasi Digiflazz": "Digiflazz Verified",
  "Akun Terverifikasi": "Verified Account",
  "Bayar Sekarang": "Pay Now",
  "Belum dipilih": "Not selected",
  "Isi ID & pilih paket": "Enter ID & pick package",
  "Metode bayar": "Payment method",
  "Populer": "Popular",
  "Termurah": "Lowest Price",
  "Mulai dari": "Starts from",
  "Status Produk": "Product Status",
  "Segera Hadir": "Coming Soon",
  "Segera": "Soon",
  "Belum ada SKU": "No SKUs yet",
  "Tersedia": "Available",
  "Harga": "Price",
  "Pilih paket": "Select package",
  "Terpilih:": "Selected:",
  "Rekomendasi": "Recommended",
  "Cek Otomatis": "Auto Verify",
  "Tunai": "Cash",
  "Pilih Metode Pembayaran": "Select Payment Method",
  "Pilih kategori pembayaran otomatis 24 jam": "Choose a 24/7 automated payment category",
  "Konfirmasi & Bukti Transaksi": "Confirmation & Order Receipt",
  "Panduan Cepat": "Quick Steps",
  "100% Resmi": "100% Official",
  "1–5 Detik": "1–5 Seconds",
  "Proses Instan": "Instant Delivery",
  "Legal & Aman": "Safe & Legal",
  "24/7 Aktif": "24/7 Live",
  "Reset pencarian": "Reset search",
  "Gagal memuat daftar game.": "Failed to load games list.",
  "Gagal memuat halaman game top up.": "Failed to load the game top up page.",
  "Muat Ulang": "Reload",
  "Game Tidak Ditemukan": "Game Not Found",
  "Kembali ke Daftar Game": "Back to Games List",
  "Belum ada game yang tersedia untuk top up.": "No games available for top up yet.",
  "Masukkan & Verifikasi ID Akun Game": "Enter & Verify Game Account ID",
  "Pastikan ID & Server benar, lalu klik tombol Verifikasi ID Game untuk cek nickname":
    "Make sure your ID & Server are accurate, then click Verify Game ID to check your nickname",
  "Memverifikasi ID...": "Verifying ID...",
  "Verifikasi ID Game": "Verify Game ID",
  "ID Terverifikasi Digiflazz": "Digiflazz Verified ID",
  "ID siap diproses": "ID ready to process",
  "Isi ID tujuan, verifikasi ID game, dan pilih paket nominal di atas untuk melanjutkan.":
    "Fill in target ID, verify your game ID, and choose a denomination package above to continue.",
  "Verifikasi & Lanjut Checkout": "Verify & Proceed to Checkout",
  "Ubah Tujuan & Nominal": "Change ID & Amount",
  "Muat ulang daftar game": "Reload games list",
  "01. Email Penerima Invoice Top Up": "01. Top Up Invoice Recipient Email",
  "Wajib Diisi *": "Required *",
  "Invoice resmi pembayaran Top Up akan dikirim otomatis ke email Anda setelah pembayaran terkonfirmasi lunas.":
    "Your official Top Up payment invoice will be sent automatically to your email once payment is confirmed.",
  "Alamat Email Aktif": "Active Email Address",
  "✓ Format Valid": "✓ Valid Format",
  "Format Belum Valid": "Invalid Format",
  "Nomor WhatsApp": "WhatsApp Number",
  "Opsional": "Optional",
  "opsional": "optional",
  "02. Pilih Metode Pembayaran Otomatis": "02. Select Automated Payment Method",
  "Semua metode di bawah diproses otomatis 24/7 oleh Duitku tanpa perlu unggah bukti transfer manual.":
    "All methods below are processed automatically 24/7 by Duitku with no manual receipt upload needed.",
  "Semua Metode": "All Methods",
  "Virtual Account Bank": "Bank Virtual Account",
  "Minimarket": "Convenience Store",
  "Ringkasan Checkout": "Checkout Summary",
  "Digiflazz · Otomatis 24/7": "Digiflazz · 24/7 Auto",
  "Tujuan Akun": "Target Account",
  "Nickname Pemain": "Player Nickname",
  "Item Nominal": "Selected Package",
  "Email Invoice": "Invoice Email",
  "Gateway & Metode": "Gateway & Method",
  "Total Bayar": "Total Payment",
  "Memproses Pesanan...": "Processing Order...",
  "Verifikasi pembayaran otomatis Duitku 24/7": "24/7 Automated Duitku Payment Verification",

  // Account Page
  "Memuat Command Center Akun...": "Loading Account Command Center...",
  "Akun Saya": "My Account",
  "Silakan login untuk memantau status pesanan secara real-time, membuka kredensial akun yang dibeli, dan mengelola wishlist game favorit Anda.":
    "Please sign in to track order status in real time, access purchased account credentials, and manage your favorite game wishlist.",
  "Lacak Pesanan": "Track Orders",
  "Pantau progres top-up & akses akun instan 24/7.": "Monitor top-up progress & instant account access 24/7.",
  "Brankas Akses": "Access Vault",
  "Data login akun tersimpan aman di riwayat member.": "Account login credentials are safely stored in your member history.",
  "Wishlist & Ulasan": "Wishlist & Reviews",
  "Simpan akun incaran dan bangun reputasi member.": "Save favorite accounts and build your member reputation.",
  "Login Sekarang": "Sign In Now",
  "Buat Akun Baru": "Create New Account",
  "Ubah": "Edit",
  "Simpan": "Save",
  "Batal": "Cancel",
  "Terverifikasi": "Verified",
  "Sinkron...": "Syncing...",
  "Sinkronkan Data": "Sync Data",
  "Total Pesanan": "Total Orders",
  "Total Belanja": "Total Spent",
  "Wishlist Tersimpan": "Saved Wishlist",
  "Keamanan & Sandi": "Security & Password",
  "Kelola sandi & perangkat": "Manage password & devices",
  "Riwayat Pesanan": "Order History",
  "Wishlist": "Wishlist",
  "Proteksi Akun Aktif": "Account Protection Active",
  "Terbaru": "Newest",
  "Nominal": "Highest Amount",
  "Belum ada pesanan. Yuk jelajahi katalog atau top-up game favoritmu!":
    "No orders yet. Explore our catalog or top up your favorite game!",
  "Lihat Katalog": "Browse Catalog",
  "Top-Up Game": "Game Top-Up",
  "Tidak ada pesanan yang cocok dengan filter pencarian Anda.":
    "No orders match your search filter.",
  "Reset Semua Filter": "Reset All Filters",
  "Store Akun": "Store Account",
  "Data Akses / Pengiriman": "Access / Delivery Info",
  "Tampilkan": "Show",
  "Samarkan": "Mask",
  "Salin": "Copy",
  "Lihat Status": "View Status",
  "Selesaikan Pembayaran": "Complete Payment",
  "Beri Ulasan": "Write Review",
  "Tutup Detail": "Hide Details",
  "1. Dibuat": "1. Created",
  "2. Pembayaran": "2. Payment",
  "3. Verifikasi": "3. Verification",
  "4. Selesai": "4. Completed",
  "QRIS Otomatis": "Automated QRIS",
  "Buka Invoice": "Open Invoice",
  "Wishlist kamu masih kosong. Simpan akun incaranmu dari katalog agar mudah dipantau!":
    "Your wishlist is empty. Save your dream accounts from the catalog to track them easily!",
  "Lihat": "View",
  "Ubah Kata Sandi": "Change Password",
  "Gunakan kombinasi huruf dan angka minimal 6 karakter":
    "Use a combination of letters and numbers, at least 6 characters",
  "Sembunyikan": "Hide",
  "Lihat Sandi": "Show Password",
  "Kata Sandi Saat Ini": "Current Password",
  "Kata Sandi Baru": "New Password",
  "Konfirmasi Sandi Baru": "Confirm New Password",
  "Cocok": "Match",
  "Belum cocok": "Does not match",
  "Kekuatan Kata Sandi": "Password Strength",
  "Kuat": "Strong",
  "Sedang": "Medium",
  "Terlalu Pendek": "Too Short",
  "Menyimpan...": "Saving...",
  "Simpan Kata Sandi": "Save Password",
  "Sesi Perangkat Aktif": "Active Device Sessions",
  "Curiga ada akses perangkat lain?": "Suspect unauthorized device access?",
  "Keluar Semua Sesi": "Sign Out All Sessions",
  "Log Keamanan Terkini": "Recent Security Logs",
  "Belum ada riwayat perubahan keamanan terbaru.": "No recent security activity logs.",
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
  "Reset Password": "Reset Password",
  "Kembali ke Login": "Back to Sign In",
  "Sudah punya akun?": "Already have an account?",
  "Belum punya akun?": "Don't have an account?",
  "Aktifkan": "Activate",
  "Kirim ulang email verifikasi": "Resend verification email",
};

const ATTRIBUTE_MAP = {
  "Cari nama akun, game, atau skin...": "Search account name, game, or skin...",
  "Cari akun, game, atau item...": "Search accounts, games, or items...",
  "Cari game atau publisher (mis. Mobile Legends, Moonton)...":
    "Search games or publishers (e.g. Mobile Legends, Moonton)...",
  "Cari nama produk, game, kode pesanan (#ORD), atau ID tujuan...":
    "Search product name, game, order code (#ORD), or target ID...",
  "Hapus pencarian": "Clear search",
  "Urutkan produk": "Sort products",
  "Urutkan pesanan": "Sort orders",
  "Tambah ke favorit": "Add to wishlist",
  "Hapus dari wishlist": "Remove from wishlist",
  "Hapus dari Wishlist": "Remove from Wishlist",
  "Produk sebelumnya": "Previous product",
  "Produk selanjutnya": "Next product",
  "Gambar sebelumnya": "Previous image",
  "Gambar selanjutnya": "Next image",
  "Perbesar gambar": "Zoom image",
  "Ubah mode tampilan foto": "Toggle image fit mode",
  "Tanya CS via WhatsApp": "Ask Support via WhatsApp",
  "No. WhatsApp (opsional)": "WhatsApp No. (optional)",
  "nama@gmail.com (Wajib diisi)": "name@gmail.com (Required)",
  "08123456789 (Opsional)": "08123456789 (Optional)",
  "Masukkan kata sandi saat ini": "Enter current password",
  "Minimal 6 karakter": "At least 6 characters",
  "Ulangi kata sandi baru": "Repeat new password",
  "Nama kamu": "Your name",
  "Password (min. 6 karakter)": "Password (min. 6 characters)",
  "Kode 6-Digit": "6-Digit Code",
  "Cari game...": "Search games...",
  "Cari pesanan...": "Search orders...",
};

// Translates Indonesian product descriptions & customer review quotes into natural English
// while leaving product titles untouched.
const DESC_PHRASE_PAIRS = [
  ["Akun full skin kolektor langka", "Rare collector full-skin account"],
  ["siap pakai untuk push rank", "ready for competitive rank push"],
  ["dilengkapi garansi anti-hackback seumur hidup", "backed by a lifetime anti-hackback warranty"],
  ["Data lengkap dan aman", "Complete and secure credentials"],
  ["bisa langsung ganti email dan password", "email and password can be changed immediately"],
  ["Akun aman 100%", "100% secure account"],
  ["garansi uang kembali penuh", "full money-back guarantee"],
  ["garansi uang kembali", "money-back guarantee"],
  ["garansi penuh", "full warranty"],
  ["proses cepat", "fast process"],
  ["pengiriman instan", "instant delivery"],
  ["admin sangat ramah dan responsif", "admin is super friendly and responsive"],
  ["admin ramah dan fast respon", "friendly and fast-response admin"],
  ["fast respon banget", "super fast response"],
  ["fast respon", "fast response"],
  ["terpercaya banget", "highly trusted"],
  ["sangat terpercaya", "very trustworthy"],
  ["terpercaya", "trusted"],
  ["recommended banget", "highly recommended"],
  ["rekomen banget", "highly recommended"],
  ["mantap jiwa", "awesome service"],
  ["mantap banget", "really great"],
  ["mantap", "great"],
  ["amanah banget", "very reliable"],
  ["amanah", "reliable"],
  ["sesuai deskripsi", "matches the description"],
  ["sesuai gambar", "matches the photos"],
  ["harga terjangkau", "affordable price"],
  ["harga murah", "great price"],
  ["murah meriah", "great value"],
  ["langsung masuk", "delivered instantly"],
  ["hitungan detik", "within seconds"],
  ["hitungan menit", "within minutes"],
  ["tanpa kendala", "without any issues"],
  ["anti-hackback", "anti-hackback"],
  ["pengerjaan cepat", "fast completion"],
  ["penjoki pro player", "pro player booster"],
  ["winrate tinggi", "high winrate"],
  ["bonus bintang", "bonus stars"],
  ["terima kasih", "thank you"],
  ["makasih min", "thanks admin"],
  ["makasih", "thanks"],
  ["sukses selalu", "always the best"],
  ["beli akun di sini", "buying accounts here"],
  ["top up di sini", "topping up here"],
  ["joki di sini", "boosting here"],
  ["jangan ragu", "don't hesitate"],
  ["pasti aman", "guaranteed safe"],
  ["akun sultan", "premium account"],
  ["full akses", "full access"],
  ["all unbind", "all unbound"],
  ["siap kirim", "ready for delivery"],
  ["stok terbatas", "limited stock"],
];

export function translateDescriptionText(raw, lang = "en") {
  if (!raw || typeof raw !== "string" || lang !== "en") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (EXACT_MAP[trimmed]) return EXACT_MAP[trimmed];

  let out = raw;
  for (const [idPhrase, enPhrase] of DESC_PHRASE_PAIRS) {
    const regex = new RegExp(idPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(regex, (match) => {
      const isCapitalized = match[0] && match[0] === match[0].toUpperCase();
      return isCapitalized
        ? enPhrase.charAt(0).toUpperCase() + enPhrase.slice(1)
        : enPhrase;
    });
  }
  return out;
}

export function translateCategoryLabel(cat, lang = "en") {
  if (!cat || lang !== "en") return cat;
  const map = {
    "Semua Kategori": "All Categories",
    "Akun Game": "Game Accounts",
    "Jasa Joki": "Boosting Services",
    "Item Game": "Game Items",
    "Lainnya": "Others",
    "akun": "Game Account",
    "joki": "Boosting",
    "item": "Game Item",
  };
  return map[cat] || map[String(cat).toLowerCase()] || cat;
}

export function translateBadgeLabel(badge, lang = "en") {
  if (!badge || lang !== "en") return badge;
  const map = {
    "Diskon Hot": "Hot Deal",
    "Garansi 100%": "100% Warranty",
    "Unggulan": "Featured",
    "Stok Terbatas": "Limited Stock",
    "Terlaris": "Best Seller",
    "Baru": "New",
    "Populer": "Popular",
    "Promo": "Promo",
    "Instan": "Instant",
  };
  return map[badge] || badge;
}

function translateDynamicString(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (EXACT_MAP[trimmed]) {
    return raw.replace(trimmed, EXACT_MAP[trimmed]);
  }

  // Pattern: "Ready 12+ Produk"
  let m = trimmed.match(/^Ready\s+(\d+\+?)\s+Produk$/i);
  if (m) {
    return raw.replace(trimmed, `Ready ${m[1]} Products`);
  }

  // Pattern: "12 Produk"
  m = trimmed.match(/^(\d+)\s+Produk$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} ${Number(m[1]) === 1 ? "Product" : "Products"}`);
  }

  // Pattern: "Semua Game (12)"
  m = trimmed.match(/^Semua Game\s*\((\d+)\)$/i);
  if (m) {
    return raw.replace(trimmed, `All Games (${m[1]})`);
  }

  // Pattern: "Mythic · 12 terjual" or "12 terjual"
  m = trimmed.match(/^(?:(.+?)\s*·\s*)?(\d+)\s+terjual$/i);
  if (m) {
    const prefix = m[1] ? `${m[1]} · ` : "";
    return raw.replace(trimmed, `${prefix}${m[2]} sold`);
  }

  // Pattern: "123 terjual • Stok 4"
  m = trimmed.match(/^(\d+)\s+terjual\s+[•·]\s+Stok\s+(\d+)$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} sold • Stock ${m[2]}`);
  }

  // Pattern: "4 Unit"
  m = trimmed.match(/^(\d+)\s+Unit$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} ${Number(m[1]) === 1 ? "Unit" : "Units"}`);
  }

  // Pattern: "Stok 12"
  m = trimmed.match(/^Stok\s+(\d+)$/i);
  if (m) {
    return raw.replace(trimmed, `Stock ${m[1]}`);
  }

  // Pattern: "12 nominal"
  m = trimmed.match(/^(\d+)\s+nominal$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} options`);
  }

  // Pattern: "· 12 pilihan"
  m = trimmed.match(/^([·•]\s*)?(\d+)\s+pilihan$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1] || ""}${m[2]} options`);
  }

  // Pattern: "Beli Sekarang · Rp 100.000"
  m = trimmed.match(/^Beli Sekarang\s*·\s*(.+)$/i);
  if (m) {
    return raw.replace(trimmed, `Buy Now · ${m[1]}`);
  }

  // Pattern: "Beli · $12.00 USD"
  m = trimmed.match(/^Beli\s*·\s*(.+)$/i);
  if (m) {
    return raw.replace(trimmed, `Buy · ${m[1]}`);
  }

  // Pattern: "Bayar dengan QRIS"
  m = trimmed.match(/^Bayar dengan\s+(.+)$/i);
  if (m) {
    return raw.replace(trimmed, `Pay with ${m[1]}`);
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

  // Pattern: "12 lunas · 3 diproses"
  m = trimmed.match(/^(\d+)\s+lunas\s*·\s*(\d+)\s+diproses$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} paid · ${m[2]} processing`);
  }

  // Pattern: "2 Top-Up · 4 Akun"
  m = trimmed.match(/^(\d+)\s+Top-Up\s*·\s*(\d+)\s+Akun$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} Top-Up · ${m[2]} Accounts`);
  }

  // Pattern: "3 ulasan telah dikirim"
  m = trimmed.match(/^(\d+)\s+ulasan telah dikirim$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} reviews submitted`);
  }

  // Pattern: "1 Sesi"
  m = trimmed.match(/^(\d+)\s+Sesi$/i);
  if (m) {
    return raw.replace(trimmed, `${m[1]} ${Number(m[1]) === 1 ? "Session" : "Sessions"}`);
  }

  // Pattern: "Diulas (5/5)"
  m = trimmed.match(/^Diulas\s*\((.+)\)$/i);
  if (m) {
    return raw.replace(trimmed, `Reviewed (${m[1]})`);
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

  const translateDesc = useCallback(
    (text) => translateDescriptionText(text, lang),
    [lang]
  );

  const translateCategory = useCallback(
    (cat) => translateCategoryLabel(cat, lang),
    [lang]
  );

  const translateBadge = useCallback(
    (badge) => translateBadgeLabel(badge, lang),
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
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        t,
        translateDesc,
        translateCategory,
        translateBadge,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
