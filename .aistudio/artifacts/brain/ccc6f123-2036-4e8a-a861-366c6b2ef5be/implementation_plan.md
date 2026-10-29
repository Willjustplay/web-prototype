# Rencana Implementasi: Format Pengiriman Akun Terstruktur, Pengiriman Email Otomatis (Akses Akun & Invoice Top Up), dan Wajib Email Saat Checkout

## 1. Tujuan & Gambaran Umum
Menyempurnakan alur pembelian, pengiriman produk akun beranda, dan pengiriman invoice produk Top Up dengan empat pembaruan utama:
1. **Format Pengiriman Data Akun Terstruktur (`[Tipe Akun] [Email] [Password]`)**: Menyediakan input terstruktur 3 kolom (Tipe Akun seperti Gmail/Moonton/Google/dll, Email/Username, dan Password) di Panel Admin yang tersinkronisasi dua arah dengan mode tempel teks langsung (`[tipe akun] [email] [password]`).
2. **Tampilan Kartu Kredensial Akun Interaktif**: Menampilkan data akses akun di halaman sukses pembayaran (`PaymentSuccess`) dalam kartu terstruktur dengan tombol salin per bagian (*Tipe Akun*, *Email*, *Password*) sekaligus tombol salin format penuh (`[Tipe Akun] [Email] [Password]`).
3. **Pengiriman Email Otomatis ke Pembeli Saat Lunas**:
   - **Produk Beranda (Akun/Item)**: Mengirimkan email berisi **Data Akses Akun Terstruktur** (`[Tipe Akun] [Email] [Password]`) beserta rincian transaksi ke email pembeli begitu pembayaran terkonfirmasi lunas (baik via QRIS otomatis PayKita maupun persetujuan Admin).
   - **Produk Top Up Game**: Mengirimkan email **Invoice Resmi Top Up Game** (berisi ID Pesanan, Game, Nominal Item, Tujuan User ID/Zone ID & Nickname, Metode Bayar Duitku, Total Bayar, dan Status Pengiriman Digiflazz) ke email pembeli segera setelah pembayaran Top Up terkonfirmasi lunas.
4. **Wajib Memasukkan Email Sebelum Pembelian**: Mewajibkan pembeli mengisi alamat email yang valid (otomatis terisi jika sudah login) sebelum melanjutkan pembayaran baik pada produk Beranda (`ProductModal`) maupun produk Top Up (`Topup` & `TopupPaymentStep`), disertai validasi di sisi server (`server.ts`).

---

## 2. Perubahan Antarmuka & Pengalaman Pengguna (Frontend)

### A. Wajib Email pada Checkout Produk Beranda (`src/components/ProductModal.jsx`)
- Mengubah input kontak pada `ProductModal.jsx` agar memiliki **input Email Pembeli (Wajib `*`)** yang otomatis terisi dari email akun apabila user sudah login, serta input **WhatsApp (Opsional)** pendamping.
- Menambahkan validasi format email (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) sebelum tombol **Bayar Sekarang** memproses pesanan, dengan pesan petunjuk bahwa akses akun (`[Tipe Akun] [Email] [Password]`) dan bukti pembayaran akan dikirim langsung ke alamat email tersebut.

### B. Wajib Email pada Checkout Produk Top Up (`src/pages/Topup.jsx` & `src/components/topup/TopupPaymentStep.jsx`)
- Menandai kolom **Alamat Email** sebagai **Wajib (`*`)** di `TopupPaymentStep.jsx` dengan keterangan bahwa invoice resmi Top Up akan dikirim otomatis ke email tersebut setelah lunas.
- Memperbarui validasi `submit()` di `src/pages/Topup.jsx` agar mewajibkan email aktif yang valid sebelum membuat transaksi Duitku.

### C. Input Pengiriman Akun Terstruktur di Panel Admin (`src/pages/Admin.jsx`)
- Pada modal **Tambah / Edit Produk Beranda**, bagian **Info Akun / Pengiriman Data (`delivery_info`)** dilengkapi builder interaktif:
  - **Input Kolom Terstruktur**: Pilihan cepat / input `Tipe Akun` (Gmail, Moonton, Google Play, Facebook, Hoyoverse, Riot, VK, Lainnya), kolom `Email / Username`, kolom `Password`, serta `Catatan Tambahan (Opsional)`.
  - **Sinkronisasi Otomatis & Mode Tempel Langsung**: Setiap perubahan pada ketiga kolom otomatis membentuk format standar `[Tipe Akun] [Email] [Password]`, dan jika Admin menempelkan teks berformat `[Gmail] [contoh@gmail.com] [pass123]` pada kotak teks langsung, ketiga kolom otomatis terisi.

### D. Kartu Akses Akun Terstruktur & Status Email di Halaman Pembayaran (`src/pages/PaymentSuccess.jsx`)
- Menambahkan parser cerdas yang membaca `delivery_info` berformat `[Tipe Akun] [Email] [Password]` (maupun format baris/teks).
- Menampilkan **Kartu Kredensial Akun** yang memisahkan baris **Tipe Akun**, **Email / Username**, dan **Password** lengkap dengan tombol **Salin** di masing-masing baris serta tombol **Salin Semua Format (`[Tipe] [Email] [Password]`)**.
- Menampilkan indikator bahwa salinan akses akun (untuk produk Beranda) atau invoice resmi (untuk produk Top Up) telah dikirimkan ke alamat email pembeli (`buyer_email`), disertai tombol **Kirim Ulang ke Email** bila pembeli ingin menerima ulang di inbox.

---

## 3. Perubahan Backend & Pengiriman Email (`server.ts`)

### A. Validasi Wajib Email Pembeli (`parseBuyer`)
- Memperbarui fungsi `parseBuyer(body)` di `server.ts` agar memastikan `buyer_email` wajib diisi dan memiliki format email yang valid pada setiap pembuatan pesanan (`/api/payments/paykita/checkout`, `/api/payments/manual/checkout`, `/api/payments/crypto/checkout`, dan `/api/payments/topup/checkout`).

### B. Helper Parser & Formatter Pengiriman Akun
- Menambahkan fungsi `parseStructuredDeliveryInfo(raw)` dan `formatStructuredDeliveryInfo(...)` di `server.ts` untuk mengekstrak `accountType`, `accountEmail`, `accountPassword`, dan `extraNotes` dari format `[tipe akun] [email] [password]` serta memperbarui data seed produk beranda agar menggunakan format standar `[Tipe Akun] [Email] [Password]`.

### C. Pengiriman Email Akses Akun & Invoice Top Up Otomatis Saat Lunas
- Membuat fungsi `sendOrderFulfillmentEmail(tx, req?)` menggunakan `renderBrandedEmailTemplate` dan `sendTransactionalEmail`:
  1. **Untuk Produk Beranda (`product_type !== "topup"`)**: Mengirimkan email bertajuk **"📦 Akses Data Akun & Bukti Pembelian — {{product_title}}"** yang memuat blok kredensial `[Tipe Akun]`, `[Email / Username]`, `[Password]`, format lengkap `[tipe akun] [email] [password]`, serta detail invoice pesanan.
  2. **Untuk Produk Top Up Game (`product_type === "topup"`)**: Mengirimkan email bertajuk **"🧾 Invoice Resmi Top Up {{game_name}} — {{denomination_label}}"** yang memuat Nomor Invoice (`session_id`), Nama Game & Item, Tujuan Akun (`customer_no` & `verified_nickname`), Metode Pembayaran (`destination_name`), Rincian Harga & Total Lunas, serta Waktu Lunas.
- Memanggil `sendOrderFulfillmentEmail(tx)` secara otomatis dan idempoten (`tx.fulfillment_email_sent_at`) saat status transaksi berubah menjadi `paid` di:
  - `markPaykitaTransactionPaid` (saat pembayaran QRIS PayKita atau Duitku terkonfirmasi lunas via cek status / webhook).
  - `admin.post("/orders/:session_id/approve")` (saat Admin menyetujui pembayaran manual / crypto / pesanan).
- Menambahkan endpoint `POST /api/payments/resend-order-email/:session_id` agar pembeli atau admin dapat mengirim ulang email akses akun / invoice kapan saja jika diperlukan.
