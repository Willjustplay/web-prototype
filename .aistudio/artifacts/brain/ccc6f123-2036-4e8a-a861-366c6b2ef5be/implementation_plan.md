# Penyederhanaan Verifikasi ID Akun Saat Checkout Top Up

Menghapus tombol manual **"Cek ID Digiflazz"** pada Langkah 1 halaman detail Top Up Game sehingga pembeli cukup mengisi data akun, memilih paket serta metode pembayaran, lalu memverifikasi ID dan mengonfirmasi **Nickname** melalui pop-up konfirmasi saat menekan tombol **"Beli Sekarang"**.

## User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah keputusan alur produk yang telah dikonfirmasi:

- **Penghapusan Tombol Manual di Langkah 1**: Tombol **"Cek ID Digiflazz / Verify Game ID"** dihapus dari bagian header Langkah 1 agar tampilan input ID lebih ringkas dan tidak membingungkan pembeli.
- **Pop-up Konfirmasi Nickname Saat Checkout**: Ketika pembeli menekan tombol **"Beli Sekarang"**, sistem memvalidasi kelengkapan form (ID Tujuan, Paket Nominal, Metode Pembayaran, dan Email), lalu menjalankan pengecekan ID ke Digiflazz secara otomatis dan menampilkan **Modal Konfirmasi Pesanan & Nickname** sebelum membuat tagihan pembayaran.
- **Toleransi Status Pending / Game Tanpa Cek Nickname**: Apabila respon Digiflazz berstatus *pending* (sedang antre) atau game tidak memiliki fitur cek nickname, pembeli tetap dapat melanjutkan ke pembayaran dari modal konfirmasi selama format ID valid. Pengecekan hanya menolak pesanan secara tegas apabila Digiflazz mengonfirmasi bahwa ID akun **tidak ditemukan (`DIGIFLAZZ_FAILED`)** atau format ID salah.

---

## 1. Overview & Core Concept

- **What It Does**: Mengubah alur halaman detail Top Up menjadi satu alur lurus tanpa tombol verifikasi terpisah di Langkah 1. Verifikasi ID dilakukan tepat saat tombol **"Beli Sekarang"** ditekan, dilanjutkan dengan jendela konfirmasi detail akun (Nickname, ID Tujuan, Item, Metode Bayar, dan Total Harga) sebelum diarahkan ke halaman pembayaran Duitku.
- **Target Audience / Persona**: Pembeli top up game di perangkat Android maupun desktop yang menginginkan proses pengisian data cepat dengan perlindungan konfirmasi akun sebelum membayar.
- **Key Value**: Mengurangi langkah klik ganda di awal formulir sekaligus mencegah kesalahan kirim ke ID yang salah melalui pop-up konfirmasi akhir.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Langkah 1 (Masukkan ID Akun)**: Pembeli langsung mengisi kolom `User ID` / `Zone ID` / `Server` tanpa perlu menekan tombol cek manual.
  2. **Langkah 2–4 (Pilih Nominal, Pembayaran, & Kontak)**: Pembeli memilih item top up, kanal pembayaran, dan mengisi alamat email aktif.
  3. **Klik "Beli Sekarang" (Verifikasi Otomatis)**:
     - Sistem memeriksa kelengkapan Langkah 1–4.
     - Tombol menampilkan indikator *"Memverifikasi ID Akun..."* sementara sistem mengecek ID ke Digiflazz.
     - Jika ID terbukti salah/tidak ditemukan (`DIGIFLAZZ_FAILED`), sistem menampilkan pesan error dan mengarahkan fokus kembali ke Langkah 1.
     - Jika ID valid (baik berhasil mendapatkan Nickname maupun berstatus *pending*/tanpa cek nickname), sistem membuka **Pop-up Konfirmasi Pesanan**.
  4. **Pop-up Konfirmasi Pesanan & Nickname**:
     - Menampilkan ringkasan: **Nickname Akun** (atau keterangan siap proses jika game tanpa cek nickname / pending), **ID Tujuan**, **Item & Game**, **Metode Pembayaran**, **Email Invoice**, dan **Total Pembayaran**.
     - Menyediakan tombol **"Ubah Data"** untuk kembali mengedit dan **"Lanjut Bayar Sekarang"** untuk membuat invoice pembayaran.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Clean gaming storefront berpadu dengan panel gelap kontras tinggi yang responsif untuk layar Android.
  - *Color Palette & Mood*: Kanvas utama `--color-void` (`#0B0E14`), permukaan kartu/modal `--color-panel` (`#121722`), aksen utama `--color-neon` (`#00F0FF`), dan indikator terverifikasi `--color-lime` (`#A3E635`).
  - *Typography & Hierarchy*: Judul menggunakan `Outfit` (`font-display`), angka dan ID akun menggunakan `JetBrains Mono` (`font-mono tabular-nums`) agar mudah diperiksa oleh pembeli.
  - *Component Styling & Layout*: Modal konfirmasi dirancang ramah layar Android (lebar penuh dengan margin aman, tidak terpotong, dan tombol aksi mudah dijangkau ibu jari).
- **Interactive Feedback & Motion**:
  - Transisi halus pada pop-up konfirmasi (`opacity` dan `scale` <= 200ms).
  - Status *loading* yang jelas saat mengecek ID maupun saat meneruskan ke gerbang pembayaran.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Verifikasi Terpusat Saat Checkout + Modal Konfirmasi**
  - *Chosen Approach*: Menghapus tombol cek ID di Langkah 1 dan memindahkan pemanggilan verifikasi ID tepat ketika pembeli menekan **"Beli Sekarang"**, diikuti pop-up konfirmasi.
  - *Why*: Pembeli tidak perlu bolak-balik menekan dua tombol berbeda (Cek ID lalu Beli Sekarang), namun tetap mendapatkan kepastian Nickname akun di layar konfirmasi sebelum transaksi dibuat.
  - *Alternatives Considered*: Langsung mengarahkan ke halaman pembayaran tanpa pop-up konfirmasi (dilewati karena pembeli tidak sempat melihat Nickname hasil verifikasi terlebih dahulu).
- **Decision 2: Kebijakan Fallback Saat Pengecekan Pending atau Tanpa SKU Cek ID**
  - *Chosen Approach*: Mengizinkan pembeli tetap melanjutkan dari modal konfirmasi apabila format ID sudah sesuai dan respon Digiflazz berstatus `DIGIFLAZZ_PENDING` atau game tidak memerlukan/mendukung cek nickname, serta hanya memblokir jika Digiflazz mengembalikan `DIGIFLAZZ_FAILED`.
  - *Why*: Menjaga kelancaran transaksi ketika antrean cek ID Digiflazz sedang padat atau untuk katalog game yang memang tidak menyediakan endpoint cek nickname.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌──────────────────────────────────────────────────────────────────────┐
│                     Halaman Detail Top Up Game                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Langkah 1: Input ID Akun Game (Tanpa Tombol Manual Cek ID)     │  │
│  └──────────────────────────────┬─────────────────────────────────┘  │
│                                 ▼                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Langkah 2, 3, 4: Pilih Paket, Metode Pembayaran, & Isi Email   │  │
│  └──────────────────────────────┬─────────────────────────────────┘  │
│                                 ▼                                    │
│         [ Klik Tombol "Beli Sekarang" / "Buy Now" ]                  │
│                                 │                                    │
│                                 ▼                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Validasi Form Lokal + Request Verifikasi ID ke Digiflazz       │  │
│  └──────────────┬───────────────────────────────┬─────────────────┘  │
│                 │                               │                    │
│     ID Tidak Ditemukan               ID Valid / Format Sesuai        │
│    (DIGIFLAZZ_FAILED)              (Terverifikasi / Pending / OK)    │
│                 │                               │                    │
│                 ▼                               ▼                    │
│  ┌─────────────────────────────┐ ┌────────────────────────────────┐  │
│  │ Tampilkan Error pada Form   │ │ Pop-up Konfirmasi Nickname &   │  │
│  │ & Scroll ke Langkah 1       │ │ Detail Pesanan                 │  │
│  └─────────────────────────────┘ └──────────────┬─────────────────┘  │
│                                                 │                    │
│                                  [ Klik "Lanjut Bayar Sekarang" ]    │
│                                                 │                    │
│                                                 ▼                    │
│                                  ┌────────────────────────────────┐  │
│                                  │ Buat Invoice Checkout Duitku   │  │
│                                  │ & Arahkan ke Halaman Bayar     │  │
│                                  └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `checking`: Menandakan proses verifikasi ID ke server saat tombol **Beli Sekarang** ditekan.
  - `validation`: Menyimpan hasil respon verifikasi (`ok`, `checked`, `nickname`, `customer_no`, `code`, `message`).
  - `confirmModalOpen`: Mengatur tampilan pop-up konfirmasi pesanan setelah ID berhasil diverifikasi atau lolos validasi format.
  - `submitting`: Menandakan proses pembuatan transaksi pembayaran ke endpoint checkout setelah pembeli menyetujui pop-up konfirmasi.
- **Interactive Component & State Mapping**:
  - Perubahan nilai input ID (`changeField`) otomatis mereset status `validation` dan menutup pop-up konfirmasi agar data selalu sinkron.
  - Tombol **"Beli Sekarang"** menjalankan `handleInitiateCheckout`: memvalidasi input Langkah 1–4, memanggil `validateTopupDestination`, menolak jika `DIGIFLAZZ_FAILED` atau `format_valid === false`, dan membuka pop-up konfirmasi jika valid.
  - Tombol **"Lanjut Bayar Sekarang"** di dalam pop-up konfirmasi menjalankan `confirmAndPay`: mengirim payload ke `/payments/topup/checkout` beserta `verified_nickname` dan mengarahkan pembeli ke `checkout_url`.
