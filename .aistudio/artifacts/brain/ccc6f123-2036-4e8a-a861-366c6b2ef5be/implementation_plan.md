# Sakelar Aktif & Nonaktif pada Tabel Katalog Top Up Game

Mengganti tombol hapus permanen pada kolom aksi tabel **Katalog Produk Top Up & Game** di halaman Admin menjadi tombol sakelar (**Aktif / Nonaktif**) sekali klik, sehingga Admin dapat menyembunyikan atau menampilkan kembali game di halaman publik Top Up dengan aman tanpa risiko kehilangan konfigurasi game atau produk Digiflazz yang sudah ditarik.

## User Review & Critical Decisions

> [!IMPORTANT]
> Keputusan berikut telah dikonfirmasi dan menjadi dasar implementasi:

- **Cakupan Penggantian Tombol**: Hanya mengganti tombol hapus pada baris tabel **Katalog Top Up & Game** yang dipilih menjadi tombol sakelar **Aktif / Nonaktif** (tetap mempertahankan tombol tarik SKU dan tombol edit game pada baris tersebut).
- **Perilaku Halaman Publik Saat Nonaktif**: Game yang berstatus **Nonaktif** disembunyikan sepenuhnya dari daftar game di halaman publik Top Up serta tidak dapat diakses untuk transaksi baru hingga diaktifkan kembali oleh Admin.

## 1. Overview & Core Concept

- **What It Does**: Menghilangkan tombol ikon tempat sampah (hapus game) di kolom aksi tabel Katalog Top Up Game dan menggantinya dengan tombol sakelar status (**Aktif** / **Nonaktif**) yang langsung memperbarui visibilitas game serta sinkronisasi katalog produk Top Up.
- **Target Audience / Persona**: Admin toko yang ingin menonaktifkan sementara suatu game Top Up (misalnya saat maintenance atau produk sedang kosong) tanpa menghapus data game secara permanen.
- **Key Value**: Mencegah penghapusan tidak sengaja pada 10 game lokal yang sudah terkonfigurasi sekaligus mempercepat alur kerja pengaktifan/penonaktifan game dalam satu klik langsung dari tabel.

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. Admin membuka tab **Katalog Top Up** pada halaman manajemen katalog.
  2. Pada setiap baris game di kolom **Aksi**, Admin melihat tombol **Impor SKU**, **Edit Game**, dan tombol sakelar **Aktif / Nonaktif** (menggantikan tombol hapus).
  3. Saat diklik, status game langsung beralih antara **Aktif** (hijau lime) dan **Nonaktif** (abu-abu slate/coral) disertai indikator loading singkat dan notifikasi toast konfirmasi.
  4. Ketika game dinonaktifkan, game tersebut otomatis disembunyikan dari halaman publik Top Up dan produk SKU miliknya ditarik dari katalog aktif hingga game diaktifkan kembali.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Dark tactical gaming dashboard (`void` `#07080B`, `panel` `#0E1117`, `neon` `#00F0FF`, `lime` `#A3FF12`, `coral` `#FF3B5C`).
  - *Color Palette & Mood*:
    - Status **Aktif**: Aksen border dan teks `lime` (`#A3FF12`) dengan latar `lime/10` yang menandakan game tayang di publik.
    - Status **Nonaktif**: Aksen `slate-400` / `coral` dengan latar `void/70` yang menandakan game disembunyikan dari publik.
- **Interactive Feedback & Motion**:
  - Tombol menampilkan spinner selama proses pembaruan berlangsung dan langsung memperbarui penghitung filter tab (**Semua Game**, **Aktif**, **Nonaktif**) serta jumlah SKU aktif.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Sakelar Status Sekali Klik Menggantikan Hapus Permanen**
  - *Chosen Approach*: Mengganti aksi hapus baris tabel dengan pembaruan status `is_active` secara langsung dan menyinkronkan ulang produk aktif game tersebut.
  - *Why*: Menjaga keutuhan 10 game lokal beserta konfigurasi field tujuan, gambar ikon, dan prefix Digiflazz agar tidak hilang terhapus.
  - *Alternatives Considered*: Membuka modal edit terlebih dahulu untuk mencentang checkbox aktif; cara tersebut membutuhkan terlalu banyak klik dibanding sakelar langsung di baris tabel.
- **Decision 2: Penyembunyian Otomatis di Halaman Publik**
  - *Chosen Approach*: Endpoint daftar game publik hanya mengembalikan game dengan `is_active !== false`, dan sinkronisasi produk hanya menerbitkan SKU dari game yang aktif.
  - *Why*: Memastikan pengunjung tidak melihat atau membeli produk dari game yang sedang dinonaktifkan oleh Admin.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Tabel Katalog Top Up & Game (Admin)                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │ Impor SKU (Ikon) │  │ Edit Game (Ikon) │  │ Sakelar Aktif/Nonaktif│  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────────┬───────────┘  │
└───────────┼─────────────────────┼────────────────────────┼──────────────┘
            │                     │                        │
            ▼                     ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 Endpoint Pembaruan Status Game & Sinkronisasi           │
│  • Mengubah flag `is_active` (!game.is_active)                          │
│  • Menyinkronkan produk Top Up aktif (`syncGameProducts`)               │
│  • Menyembunyikan game nonaktif dari daftar publik `/topup`             │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - Entitas game menyimpan atribut boolean `is_active`.
  - Ketika `is_active` bernilai `false`, fungsi sinkronisasi menghapus cerminan produk aktif game tersebut dari etalase publik namun tetap menyimpan daftar nominal hasil tarikan Digiflazz di dalam data game agar siap tayang kembali saat diaktifkan.
- **Interactive Component & State Mapping**:
  - Klik pada tombol sakelar di kolom **Aksi** memanggil handler `toggleGameActive(game)` yang mengirim pembaruan status ke backend, menampilkan indikator proses per baris (`busy`), memunculkan pesan toast status terbaru, dan memuat ulang tabel serta ringkasan katalog.
