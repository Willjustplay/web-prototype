# Rencana Implementasi: Reset Produk Top Up Bawaan & Halaman Khusus per Game Gaya Codashop (`/topup/:slug`)

## 1. Tujuan Utama
1. **Hapus Semua Produk Top Up Bawaan & Kosongkan Nominal/SKU**:
   - Mempertahankan ke-10 entitas **Game Top Up** lokal beserta ikon 3D, *field* tujuan (User ID / Server / Zone), dan konfigurasi dasar masing-masing game.
   - Mengosongkan seluruh daftar nominal/produk bawaan (`denominations: []`) dan SKU bawaan pada 10 game lokal, serta menghapus seluruh produk kategori `"Topup Game"` bawaan (`ml-topup-1000dm`, `ff-topup-2180`, dan produk hasil sinkronisasi `tp-*`) dari database awal maupun data aktif saat ini.
   - Menyediakan kontrol **Kosongkan Semua Produk & SKU Top Up** di panel Admin agar Admin dapat mereset produk/SKU kapan saja sebelum menarik produk pilihan dari Digiflazz.
2. **Halaman Top Up Khusus Setiap Game Bergaya Codashop (`/topup/:slug`)**:
   - **Halaman Katalog Game (`/topup`)**: Menampilkan *grid* pemilihan 10 game lokal dengan ikon 3D. Saat pengguna memilih salah satu game, pengguna diarahkan langsung ke URL khusus game tersebut: `/topup/:slug` (contoh: `/topup/mobile-legends`, `/topup/free-fire`, `/topup/valorant`, dll.).
   - **Halaman Khusus Game (`/topup/:slug`) — Layout 2 Kolom Khas Codashop**:
     - **Kolom Kiri (Sidebar Informasi Game — Sticky di Desktop)**:
       - Banner/Ikon 3D game, nama game, *publisher*, dan *badge* layanan resmi.
       - Deskripsi resmi game dan panduan langkah demi langkah cara menemukan User ID / Zone ID serta cara melakukan Top Up di game tersebut.
       - Navigasi cepat untuk berpindah ke game populer lainnya.
     - **Kolom Kanan (Alur Langkah 1 - 2 - 3 - 4 dalam Satu Halaman Tanpa Pindah Tab)**:
       - **Langkah [1] Masukkan Data Akun / ID Tujuan**: Input dinamis sesuai spesifikasi game (mis. *User ID* & *Zone ID* untuk Mobile Legends, *Riot ID* untuk Valorant, *UID* & *Server* untuk Genshin Impact) lengkap dengan tombol **Cek ID / Verifikasi Nickname** secara langsung.
       - **Langkah [2] Pilih Nominal Top Up**: Menampilkan *grid* kartu nominal/item untuk game tersebut. Jika Admin belum menarik produk/SKU dari Digiflazz untuk game tersebut, tampilkan pesan status yang rapi bahwa nominal untuk game ini belum tersedia / sedang disinkronkan oleh Admin.
       - **Langkah [3] Pilih Metode Pembayaran**: Menampilkan pilihan *channel* pembayaran resmi (QRIS, Virtual Account Bank, E-Wallet) secara langsung dengan indikator total harga pada masing-masing metode pembayaran seperti di Codashop.
       - **Langkah [4] Detail Kontak & Beli Sekarang**: Input alamat Email aktif (untuk pengiriman bukti/invoice transaksi) dan nomor WhatsApp (opsional), ringkasan pesanan *real-time*, serta tombol **Beli Sekarang**.

---

## 2. Perubahan Sistem & Arsitektur

### A. Backend & Database (`/server.ts` & `/server/seed_data.json`)
- **Pembersihan Data Bawaan (`SEED_PRODUCTS`, `SEED_GAMES`, & `MERCHANT_MASTER_GAMES`)**:
  - Menghapus item kategori `"Topup Game"` bawaan dari `SEED_PRODUCTS` di `/server/seed_data.json`.
  - Mengosongkan `denominations: []` pada `SEED_GAMES` di `/server/seed_data.json` dan `MERCHANT_MASTER_GAMES` di `/server.ts` agar game lokal tidak memiliki produk/SKU bawaan sampai Admin menariknya dari Digiflazz (katalog referensi SKU Digiflazz dipindahkan ke kamus pencocokan terpisah `DIGIFLAZZ_VERIFIED_SKUS` yang hanya dipakai saat Admin menekan tombol *Tarik Produk dari Digiflazz*).
- **Migrasi Otomatis Penghapusan Produk Top Up Bawaan**:
  - Menambahkan fungsi migrasi satu kali (`resetDefaultTopupProductsAndSkus()`) saat server dijalankan untuk menghapus seluruh produk kategori `"Topup Game"` bawaan (`tp-*`, `ml-topup-1000dm`, `ff-topup-2180`) dan mengosongkan `denominations: []` serta `vendor_sku` bawaan pada ke-10 game lokal di database aktif (`db_state.json` & PostgreSQL).
- **Endpoint Reset Produk & SKU untuk Admin**:
  - Menambahkan endpoint `POST /api/admin/topup/clear-products` agar Admin dapat mengosongkan seluruh produk & SKU Top Up (baik untuk semua game maupun per game) kapan saja dari dashboard Admin.

### B. Routing & Frontend Halaman Khusus Game (`/src/App.jsx`, `/src/pages/Topup.jsx`, `/src/pages/TopupGameDetail.jsx`)
- **Routing (`/src/App.jsx`)**:
  - Menambahkan route `<Route path="/topup/:slug" element={<TopupGameDetail />} />` di samping `<Route path="/topup" element={<Topup />} />`.
- **Halaman Direktori Game (`/src/pages/Topup.jsx` & `/src/components/topup/TopupGameGrid.jsx`)**:
  - Menampilkan daftar seluruh 10 game lokal (termasuk game yang nominalnya masih kosong dengan label status `"Segera Hadir"` atau harga mulai dari nominal terendah jika sudah ditarik Admin).
  - Mengubah aksi klik kartu game agar menavigasi ke `/topup/${game.slug}`.
- **Halaman Khusus Game Gaya Codashop (`/src/pages/TopupGameDetail.jsx`)**:
  - Membangun halaman khusus per game dengan struktur 2 kolom responsif:
    - **Panel Kiri**: Identitas visual 3D game, informasi pengiriman instan, petunjuk lokasi ID game, dan pemilih cepat antar-game.
    - **Panel Kanan (4 Kartu Bernomor Gaya Codashop)**:
      - **Kartu `1` — Masukkan ID Akun**: Form *field* tujuan + fitur Cek Nickname akun.
      - **Kartu `2` — Pilih Nominal Top Up**: *Grid* interaktif paket top up (atau tampilan *empty state* informatif apabila Admin belum menarik SKU dari Digiflazz).
      - **Kartu `3` — Pilih Pembayaran**: Daftar metode pembayaran dengan *preview* harga langsung pada tiap kartu metode pembayaran.
      - **Kartu `4` — Beli!**: Input Email & WhatsApp serta *sticky summary bar* dengan tombol **Beli Sekarang**.
- **Panel Admin (`/src/components/AdminTopup.jsx`)**:
  - Menambahkan tombol **Kosongkan Produk & SKU** agar Admin memiliki kendali penuh untuk mereset nominal/SKU dan menarik ulang hanya produk yang diinginkan dari Digiflazz.
