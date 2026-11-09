# Dukungan Penuh Produk Tanpa Cek ID & Penghapusan Kata Digiflazz di Halaman Top Up

Memastikan semua produk Top Up yang tidak memiliki integrasi pengecekan ID (atau saat pengecekan nickname tidak tersedia) **selalu dapat digunakan hingga pembayaran selesai**, menyederhanakan tampilan pop-up konfirmasi agar langsung menampilkan **ID Tujuan** tanpa baris Nickname pada game tersebut, serta menghapus seluruh kata **"Digiflazz"** dari halaman, status, dan notifikasi Top Up sisi pembeli.

## User Review & Critical Decisions

> [!IMPORTANT]
> Keputusan produk yang telah dikonfirmasi untuk perubahan ini:

- **Produk Tanpa Integrasi Cek ID Selalu Bisa Dibeli**: Game yang tidak memiliki kode Cek ID, belum terintegrasi dengan layanan cek nickname, atau sedang mengalami antrean pengecekan tidak akan lagi diblokir pada saat klik **"Beli Sekarang"** maupun saat pembuatan invoice pembayaran. Selama format kolom ID Tujuan valid, transaksi selalu diizinkan lanjut ke pembayaran.
- **Tampilan Pop-up Konfirmasi Tanpa Baris Nickname (Jika Tanpa Cek ID)**: Apabila game mendukung Cek ID dan mengembalikan Nickname, pop-up menampilkan **Nickname + ID Tujuan**. Namun apabila game tidak mendukung Cek ID (atau nickname tidak tersedia), pop-up konfirmasi langsung menampilkan **ID Tujuan** secara bersih tanpa baris Nickname dan mengizinkan pembeli langsung menekan **"Lanjut Bayar"**.
- **Penghapusan Penuh Kata "Digiflazz" di Sisi Pembeli**: Seluruh teks, lencana (*badge*), keterangan kosong (*empty state*), hingga pesan status/notifikasi dari server yang tampil kepada pembeli di halaman Top Up dibersihkan dari kata **"Digiflazz"** dan diganti menjadi istilah netral seperti *"Terverifikasi"*, *"Sistem Otomatis 24/7"*, atau *"ID Akun Tidak Ditemukan"*.

---

## 1. Overview & Core Concept

- **What It Does**: Menghilangkan hambatan checkout pada katalog game yang tidak memiliki fitur Cek Nickname otomatis, sekaligus membersihkan *branding* pihak ketiga ("Digiflazz") dari seluruh antarmuka dan pesan respon yang dilihat oleh pembeli.
- **Target Audience / Persona**: Pembeli top up game di perangkat Android dan desktop yang membeli berbagai jenis game (baik game yang mendukung cek nickname maupun game yang hanya membutuhkan input User ID/UID langsung).
- **Key Value**: Semua produk top up di katalog 100% dapat ditransaksikan kapan saja tanpa gagal akibat ketiadaan fitur Cek ID, dengan tampilan toko yang profesional dan mandiri.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Input Data & Pilih Paket**: Pembeli mengisi `User ID` / `Zone ID` / `Server`, memilih nominal, metode pembayaran, dan email.
  2. **Klik "Beli Sekarang"**:
     - Jika game memiliki fitur Cek ID aktif dan akun ditemukan: pop-up konfirmasi menampilkan **Nickname Akun** beserta **ID Tujuan**.
     - Jika game tidak memiliki integrasi Cek ID (atau layanan cek nickname sedang antre/tidak tersedia): sistem langsung memvalidasi format input lokal dan membuka pop-up konfirmasi yang menampilkan **ID Tujuan** secara langsung tanpa baris Nickname.
     - Pesanan hanya ditolak apabila format input kosong/salah atau server game secara eksplisit menyatakan ID akun tidak terdaftar.
  3. **Klik "Lanjut Bayar"**: Sistem membuat tagihan pembayaran tanpa memblokir produk yang tidak memiliki integrasi Cek ID, lalu mengarahkan pembeli ke halaman pembayaran.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Clean gaming storefront dengan informasi ringkas, bebas dari istilah teknis *supplier* H2H.
  - *Color Palette & Mood*: Kanvas `--color-void` (`#0B0E14`), kartu `--color-panel` (`#121722`), aksen `--color-neon` (`#00F0FF`), dan aksen sukses `--color-lime` (`#A3E635`).
  - *Typography & Hierarchy*: Judul menggunakan `Outfit` (`font-display`) dan nomor tujuan/harga menggunakan `JetBrains Mono` (`font-mono tabular-nums`).
- **Interactive Feedback & Motion**:
  - Tidak ada pesan peringatan merah di Langkah 1 untuk game yang tidak memiliki integrasi Cek ID.
  - Seluruh pesan toast, banner status, dan informasi kosong menggunakan bahasa toko resmi (Indonesia & Inggris) tanpa menyebutkan nama penyedia H2H.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Validasi Format Sebagai Syarat Utama Checkout untuk Game Tanpa Cek ID**
  - *Chosen Approach*: Mengubah logika verifikasi di sisi server dan klien agar ketiadaan konfigurasi Cek ID, antrean pengecekan, atau kendala jaringan pengecekan nickname dianggap lolos (`valid: true, checked: false`) selama format ID Tujuan memenuhi aturan kolom game.
  - *Why*: Banyak game atau produk voucher/top up yang secara bawaan memang tidak menyediakan endpoint pengecekan nickname, sehingga pembeli harus tetap bisa menyelesaikan pembelian kapan pun.
- **Decision 2: Penyembunyian Baris Nickname secara Dinamis pada Modal Konfirmasi**
  - *Chosen Approach*: Hanya merender baris **Nickname** pada modal konfirmasi apabila `validation.checked` bernilai benar dan `validation.nickname` tersedia; selain itu hanya menampilkan kartu **ID Tujuan**.
  - *Why*: Lebih jujur dan bersih secara visual daripada menampilkan teks placeholder pada baris Nickname ketika game tersebut memang tidak menggunakan pengecekan nickname.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌──────────────────────────────────────────────────────────────────────┐
│                  Alur Checkout & Verifikasi Top Up                   │
│                                                                      │
│         [ Pembeli Klik Tombol "Beli Sekarang" / "Buy Now" ]          │
│                                 │                                    │
│                                 ▼                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Validasi Format Input Tujuan (User ID / Zone ID / Server)      │  │
│  └──────────────┬───────────────────────────────┬─────────────────┘  │
│                 │                               │                    │
│        Format Tidak Sesuai                 Format Valid              │
│                 │                               │                    │
│                 ▼                               ▼                    │
│  ┌─────────────────────────────┐ ┌────────────────────────────────┐  │
│  │ Tampilkan Pesan Perbaikan   │ │ Cek apakah Game memiliki       │  │
│  │ Kolom pada Langkah 1        │ │ Integrasi Cek ID Aktif         │  │
│  └─────────────────────────────┘ └──────┬──────────────────┬──────┘  │
│                                         │                  │         │
│                            Tanpa Cek ID /             Memiliki       │
│                           Tidak Tersedia             Cek ID Aktif    │
│                                         │                  │         │
│                                         ▼                  ▼         │
│                          ┌────────────────────┐ ┌─────────────────┐  │
│                          │ Lolos Otomatis     │ │ Panggil Cek ID  │  │
│                          │ (checked: false)   │ │ (checked: true) │  │
│                          └─────────┬──────────┘ └────────┬────────┘  │
│                                    │                     │           │
│                                    ▼                     ▼           │
│  ┌───────────────────────────────────┐ ┌──────────────────────────┐  │
│  │ Pop-up Konfirmasi Checkout        │ │ Pop-up Konfirmasi        │  │
│  │ • Menampilkan ID Tujuan langsung  │ │ Checkout                 │  │
│  │   (Tanpa baris Nickname)          │ │ • Menampilkan Nickname   │  │
│  │ • Izinkan Lanjut Bayar            │ │   & ID Tujuan            │  │
│  └─────────────────┬─────────────────┘ └─────────────┬────────────┘  │
│                    └───────────────┬─────────────────┘               │
│                                    ▼                                 │
│                    [ Klik "Lanjut Bayar" / "Pay Now" ]               │
│                                    │                                 │
│                                    ▼                                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Endpoint Checkout Selalu Mengizinkan Transaksi Selama Format   │  │
│  │ ID Sesuai & Mengarahkan Pembeli ke Halaman Pembayaran          │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - Respon verifikasi tujuan (`verifyGameAccountId`) mengembalikan:
    - `valid: true, format_valid: true, checked: true, nickname: "..."` saat integrasi Cek ID tersedia dan mengembalikan nickname.
    - `valid: true, format_valid: true, checked: false, nickname: ""` saat game tidak memiliki integrasi Cek ID, kredensial cek belum diatur, antrean sedang *pending*, atau layanan cek nickname tidak mendukung SKU tersebut.
    - `valid: false, format_valid: false` atau `code: "ACCOUNT_NOT_FOUND"` hanya ketika format input tidak sesuai atau ID akun terbukti tidak ditemukan.
- **Interactive Component & State Mapping**:
  - Pada endpoint pembuatan invoice pembayaran (`/payments/topup/checkout`), pemeriksaan verifikasi hanya memblokir transaksi jika `verification.format_valid === false` atau `verification.code === "ACCOUNT_NOT_FOUND"`, sehingga produk tanpa Cek ID selalu berhasil melanjutkan ke pembuatan invoice pembayaran.
  - Pada tampilan halaman Top Up, seluruh teks statis maupun dinamis yang sebelumnya memuat kata `"Digiflazz"` diganti dengan teks netral dwibahasa (Indonesia & Inggris).
