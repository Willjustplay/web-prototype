# Rencana Perbaikan & Penyempurnaan Sistem Terjemahan Bahasa Inggris (EN)

Perbaikan menyeluruh pada sistem lokalisasi dua bahasa (`ID` / `EN`) di platform WillJustPlay agar seluruh antarmuka pengguna, bagian beranda, katalog, alur transaksi, testimoni, footer, modal checkout, halaman top-up, serta halaman akun diterjemahkan secara akurat dan instan ke Bahasa Inggris, sambil mempertahankan judul produk asli.

### User Review & Critical Decisions

- **Cakupan Halaman Terjemahan (Dikonfirmasi):** Meliputi seluruh halaman utama (Navbar, Hero, Katalog, Cara Kerja, Testimoni, Footer), Modal Detail & Checkout Produk, Halaman Top-Up Game Instan, Halaman Akun & Riwayat Transaksi, serta Modal Autentikasi.
- **Perlakuan Konten Produk & Ulasan (Dikonfirmasi):** Seluruh label antarmuka (UI), navigasi, lencana status, filter, tahapan cara kerja, serta deskripsi produk dan ulasan diterjemahkan ke Bahasa Inggris saat mode `EN` aktif, namun **judul produk (`product.title`) tetap dipertahankan sesuai aslinya** agar nama item/akun game tidak berubah menjadi rancu.
- **Arsitektur Terjemahan Hibrida (Keputusan Teknis):** Menggabungkan penggunaan hook reaktif `useLanguage()` langsung di dalam komponen React (untuk teks yang berubah secara dinamis saat tab atau modal berganti) dengan kamus pola dinamis (`LanguageContext`) untuk menerjemahkan deskripsi produk serta teks berformat angka secara otomatis.

### 1. Overview & Core Concept

Saat ini, beberapa bagian halaman masih menampilkan teks Bahasa Indonesia ketika pengguna beralih ke mode **EN** (seperti lencana `"Ready X+ Produk"` dan pilar kepercayaan di Hero, filter dan kartu produk di Katalog, seluruh tab dan langkah di bagian `"Cara Kerja"`, filter dan label di `"Testimoni"`, informasi di `"Footer"`, serta form pada `"Modal Checkout"`). Hal ini terjadi karena pembaruan salinan teks UI sebelumnya tidak lagi cocok dengan kamus pencocokan teks lama, serta perubahan state React (seperti pergantian tab atau pembukaan modal) merender ulang elemen DOM tanpa memicu terjemahan ulang yang konsisten.

Solusi ini menyempurnakan mesin lokalisasi sehingga perpindahan antara **ID** dan **EN** bekerja secara instan, bebas kedipan (*flicker-free*), dan mencakup 100% elemen antarmuka beserta deskripsi konten.

### 2. User Experience & Visual Design

- **Konsistensi Navigasi & Sakelar Bahasa:** Tombol `ID` / `EN` di bilah navigasi atas langsung memperbarui seluruh teks di layar secara reaktif tanpa perlu memuat ulang halaman (*reload*).
- **Beranda (Hero, Katalog, Cara Kerja, Testimoni, Footer):**
  - **Hero:** Lencana stok (`"Ready X+ Products"`), tombol aksi, kartu sorotan produk, serta 3 pilar jaminan keamanan tampil dalam Bahasa Inggris yang natural.
  - **Katalog:** Pencarian, filter kategori (`"All"`, `"Game Accounts"`, `"Boosting"`, `"In Stock"`), pengurutan harga (`"Lowest Price"`, `"Highest Price"`), penghitung jumlah produk (`"X Products"`, `"X sold"`), dan deskripsi singkat kartu produk diterjemahkan sepenuhnya, sementara judul produk tetap asli.
  - **Cara Kerja (How It Works):** Tombol pemilih alur (`"Buy Accounts & Boost"` dan `"Instant Game Top-Up"`), lencana estimasi waktu (`"~1 Minute"`, `"5–15 Minutes"`, `"Instant"`), judul langkah, deskripsi langkah, dan poin sorotan diterjemahkan secara langsung mengikuti tab yang aktif.
  - **Testimoni & Bukti Sosial:** Filter game (`"All Games (X)"`, `"With Photo Proof"`), lencana `"Verified Buyer"`, `"Transaction Proof"`, serta teks ulasan pelanggan diterjemahkan dengan rapi.
  - **Footer:** Deskripsi toko, daftar `"Service Guarantees"`, navigasi bawah, dan catatan hak cipta menggunakan Bahasa Inggris profesional.
- **Modal Checkout, Halaman Top-Up, & Akun:**
  - Seluruh label spesifikasi (`"Stock"`, `"X Units"`, `"Full Screen"`, `"Proportional"`), form pengiriman (`"Recipient Email"`, `"WhatsApp No. (optional)"`), metode pembayaran (`"Instant QRIS"`, `"Automatic"`), tombol beli (`"Buy Now"`), serta tahapan pengisian ID dan riwayat pesanan di halaman Top-Up dan Akun tampil sepenuhnya dalam Bahasa Inggris.

### 3. Key Product Decisions & Trade-Offs

- **Terjemahan Reaktif di Komponen vs Mutasi DOM Murni:**
  - *Keputusan:* Menggunakan helper `t(idText, enText)` langsung pada komponen React utama sembari memperbarui kamus pola dinamis di `LanguageContext`.
  - *Alasan:* Mengandalkan mutasi DOM (`MutationObserver`) saja rawan gagal ketika React atau animasi mengganti elemen saat pengguna berpindah tab (misalnya di bagian *Cara Kerja* atau *Modal Checkout*). Dengan mengikat terjemahan langsung ke state `lang`, setiap render ulang dijamin langsung menampilkan bahasa yang benar.
- **Penerjemah Deskripsi Produk Cerdas Tanpa Mengubah Judul:**
  - *Keputusan:* Menyediakan fungsi penerjemah deskripsi (`translateDescription`) yang menerjemahkan istilah umum deskripsi akun/joki dan kalimat penjelasan ke Bahasa Inggris, sementara atribut judul produk dikecualikan dari transformasi teks.
  - *Alasan:* Pembeli internasional maupun pengguna berbahasa Inggris membutuhkan kejelasan spesifikasi dan deskripsi akun, tetapi tetap mengenali nama asli akun, skin, atau paket game tersebut.

### 4. Technical Architecture & Data Strategy

Sistem lokalisasi bekerja melalui dua lapisan yang saling melengkapi: lapisan komponen reaktif menggunakan konteks bahasa, dan lapisan pemformatan teks dinamis untuk konten dari database (deskripsi produk, jumlah terjual, dan ulasan).

```
+-------------------------------------------------------------------+
|                   LanguageContext (State: 'id' | 'en')            |
|  - t(idText, enText): Helper reaktif langsung untuk komponen UI   |
|  - translateDesc(text): Penerjemah deskripsi produk & ulasan      |
|  - Dynamic Pattern Matcher: Menangani angka ("12 Produk", dll.)   |
+---------------------------------+---------------------------------+
                                  |
         +------------------------+------------------------+
         |                                                 |
         v                                                 v
+--------------------------------+       +----------------------------------+
|   Komponen Beranda & Layout    |       |  Transaksi, Top-Up & Akun User   |
|  - Navbar & Footer             |       |  - ProductModal (Checkout Area)  |
|  - Hero & Trust Pillars        |       |  - Topup Page (Game & Nominal)   |
|  - Catalog (Filter, Sort, Card)|       |  - Account Page (Vault & Order)  |
|  - HowItWorks (Tab & Steps)    |       |  - AuthModal & Payment Status    |
|  - Testimonials (Filter & Card)|       |  * Judul Produk Tetap Asli *     |
+--------------------------------+       +----------------------------------+
```
