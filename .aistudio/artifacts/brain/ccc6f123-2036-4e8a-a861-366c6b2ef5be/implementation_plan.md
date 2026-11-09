# Rencana Implementasi Pembatasan Order Ganda pada Produk yang Sama & Hapus Order Belum Dibayar oleh Admin

Rencana ini mengatur mekanisme agar setiap pembeli tidak dapat membuat pesanan berulang pada produk yang sama selama masih ada transaksi yang belum dibayar (*pending*), menyediakan fitur pembatalan pembayaran oleh pembeli, serta menambahkan tombol hapus pesanan belum lunas pada kolom **Aksi** di tabel pesanan Admin.

---

## Keputusan Desain yang Dikonfirmasi

1. **Perilaku Saat Pembeli Memesan Produk yang Sama (Masih Memiliki Pembayaran Aktif)**:
   - Sistem menolak pembuatan transaksi baru untuk produk yang sama dan menampilkan **peringatan interaktif** beserta tombol pintasan untuk **Membuka Halaman Pembayaran Aktif** atau **Membatalkan Pembayaran Aktif** secara langsung agar pembeli dapat memesan ulang.
   - Di halaman pembayaran aktif, pembeli juga memiliki tombol **Batalkan Pembayaran** untuk membatalkan pesanan yang sedang berjalan kapan saja sebelum dibayar.
2. **Cakupan Fitur Hapus Order oleh Admin**:
   - Pada kolom ke-7 (**Aksi**) di tabel daftar pesanan Admin, semua pesanan yang **belum lunas** (termasuk status *pending / menunggu pembayaran*, *gagal*, *ditolak*, dan *kedaluwarsa*) dilengkapi dengan tombol **Hapus** agar Admin dapat membersihkan data order yang tidak dibayar.

---

## Alur Arsitektur & Validasi Transaksi

```text
[ Pembeli Klik Checkout pada Produk X ]
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Cek Transaksi Aktif Pembeli pada Produk X                   │
│ (Berdasarkan Akun Login / Email / WhatsApp / Sesi Browser)  │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
 [ Ada Order Pending ] [ Tidak Ada Order Pending ]
        │                   │
        ▼                   ▼
┌───────────────────────┐ ┌───────────────────────────────────┐
│ Tahan Order Baru      │ │ Buat Transaksi Baru & Arahkan ke  │
│ (HTTP 409 Conflict)   │ │ Halaman Pembayaran                │
│ Tampilkan Peringatan: │ └───────────────────────────────────┘
│ • [Buka Pembayaran]   │
│ • [Batalkan Order Ini]│
└───────────────────────┘

[ Tabel Pesanan Admin — Kolom Ke-7 (Aksi) ]
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Cek Status Pembayaran Order (payment_status !== "paid")     │
│ • Tampilkan tombol [Hapus] pada semua order belum lunas     │
│ • Saat diklik -> Hapus transaksi dari database & segarkan   │
└─────────────────────────────────────────────────────────────┘
```

---

## Rincian Fitur yang Akan Dibangun

### 1. Pencegahan Pemesanan Berulang pada Produk yang Sama
- **Deteksi Order Aktif (*Pending*) per Pembeli & Produk**:
  - Saat pembeli menekan tombol bayar/checkout (baik melalui QRIS Otomatis, Transfer/QRIS Manual, Crypto, maupun Top Up), server memeriksa apakah pembeli tersebut (berdasarkan ID pengguna yang login, alamat email, nomor WhatsApp, atau ID sesi aktif dari perangkatnya) masih memiliki transaksi berstatus `pending` yang belum kedaluwarsa pada produk yang sama.
  - Jika ditemukan transaksi aktif pada produk tersebut, server mengembalikan status konflik (`ACTIVE_ORDER_EXISTS`) beserta informasi `session_id`, judul produk, nominal, dan tautan pembayaran dari transaksi yang masih menggantung.
- **Tampilan Peringatan & Pintasan Pembatalan untuk Pembeli**:
  - Ketika sistem mendeteksi masih ada pembayaran yang belum diselesaikan pada produk tersebut, pembeli melihat pesan peringatan yang jelas beserta dua tombol tindakan langsung:
    1. **Lanjutkan / Buka Pembayaran Aktif**: Mengarahkan pembeli ke halaman kode bayar dari pesanan yang masih berjalan.
    2. **Batalkan Pembayaran Sebelumnya**: Membatalkan pesanan lama secara instan sehingga pembeli dapat langsung membuat pesanan baru pada produk yang sama.
- **Tombol Batalkan Pembayaran di Halaman Pembayaran**:
  - Menyediakan tombol **Batalkan Pembayaran** pada halaman instruksi pembayaran selama status transaksi masih `pending` agar pembeli dapat membatalkan sendiri pesanannya kapan saja.

### 2. Fitur Hapus Order Belum Dibayar oleh Admin (Kolom Ke-7 Tabel Pesanan)
- **Endpoint Penghapusan Order Belum Lunas**:
  - Menambahkan endpoint khusus Admin untuk menghapus transaksi yang belum lunas (`payment_status !== "paid"`), sekaligus mencatat tindakan penghapusan ke dalam Audit Log Admin.
  - Pesanan yang sudah berstatus `paid` (Lunas) dilindungi agar riwayat transaksi yang sah tidak terhapus secara tidak sengaja.
- **Tombol Hapus pada Kolom Aksi (`td` ke-7)**:
  - Menambahkan tombol **Hapus** berwarna merah (*coral*) pada kolom ke-7 (**Aksi**) di tabel daftar pesanan Admin (baik pada daftar pesanan utama maupun tabel pesanan Top Up) untuk setiap baris order yang belum dibayar (*pending*, *gagal*, *ditolak*, atau *kedaluwarsa*).
