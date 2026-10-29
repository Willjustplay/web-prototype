# Rencana Desain Ulang Checkout Produk Beranda (Clean, Dinamis & Simpel)

## 1. Tujuan & Gambaran Umum
Merapikan dan menyederhanakan alur pembelian **Produk Beranda** secara menyeluruh — mulai dari **Modal Detail & Checkout Cepat (`src/components/ProductModal.jsx`)** hingga **Halaman Instruksi & Konfirmasi Pembayaran (`src/pages/PaymentSuccess.jsx`)** — agar terasa jauh lebih bersih (*clean*), responsif/dinamis, minim langkah, dan sangat mudah dipahami oleh pembeli.

---

## 2. Pengalaman Pengguna & Perombakan Antarmuka (UX & UI)

### A. Modal Detail & Checkout Produk Beranda (`src/components/ProductModal.jsx`)
1. **Tata Letak Satu Tampilan Ringkas (*Contiguous Purchase Module*)**:
   - **Kolom Kiri (Media & Spesifikasi Inti)**: Galeri foto produk berasio proporsional dengan navigasi *swipe* & *thumbnail* yang bersih, diikuti baris informasi spesifikasi inti (Rank/Tier, Stok, Garansi) dengan pemisah garis tipis (*hairline divider*) tanpa tumpukan kotak di dalam kotak (*no cards-within-cards*).
   - **Kolom Kanan (Info Produk & Checkout Langsung)**:
     - Header produk yang bersih menampilkan kategori, status ketersediaan, judul produk, dan harga utama (`IDR` & ekuivalen `USD` untuk opsi Crypto) dalam format *tabular numerals* yang tegas.
     - Deskripsi produk ringkas yang dapat dibuka/tutup (*collapsible*) dengan transisi halus tanpa memakan ruang vertikal berlebih.
2. **Input Kontak Pembeli Pintar (1 Kolom Utama + Auto-Fill)**:
   - Mengganti dua kolom input yang padat menjadi **satu input kontak pintar** (*No. WhatsApp atau Email Aktif*) yang otomatis terisi (*auto-filled*) jika pengguna sudah login (`user.email`).
   - Dilengkapi tombol opsional *"+ Tambah WhatsApp / Email cadangan"* jika pembeli ingin menyertakan keduanya, atau deteksi otomatis apakah input berupa nomor WhatsApp (`08...` / `+62...`) atau alamat email, sehingga pembeli cukup mengetik satu kontak saja untuk langsung lanjut bayar.
3. **Pemilih Metode Pembayaran yang Jelas & Dinamis**:
   - Menyajikan pilihan metode pembayaran produk beranda (**QRIS Otomatis PayKita**, **Transfer / QRIS Manual**, dan **Crypto USD**) menggunakan kontrol tab/kartu bersih yang langsung menampilkan ringkasan instruksi singkat:
     - **QRIS Otomatis (PayKita)**: Menampilkan indikator proses instan satu klik tanpa perlu memilih sub-rekening.
     - **Transfer / QRIS Manual**: Menampilkan daftar tujuan bank/e-wallet/QRIS dalam bentuk kartu pilihan bersih yang mudah diklik.
     - **Crypto (USDT/Coin)**: Menampilkan nominal USD otomatis beserta pilihan jaringan (*network*) yang rapi.
4. **Ringkasan Total & Tombol CTA Utama (*Sticky Action Bar*)**:
   - Baris tombol aksi utama yang selalu mudah dijangkau di bagian bawah modal, menampilkan nominal yang harus dibayar secara dinamis sesuai metode yang dipilih serta tombol tanya CS via WhatsApp yang proporsional.

### B. Halaman Instruksi & Status Pembayaran (`src/pages/PaymentSuccess.jsx`)
1. **Hierarki Informasi Pembayaran yang Bersih & Fokus**:
   - Menghilangkan elemen dekoratif yang ramai dan menyatukan kartu pembayaran ke dalam satu kontainer fokus dengan *progress step* yang jelas: **1. Selesaikan Pembayaran → 2. Verifikasi → 3. Pesanan Selesai**.
   - Ringkasan pesanan ringkas di bagian atas (Nama Produk, ID Sesi dengan tombol salin cepat, dan batas waktu pembayaran *live countdown*).
2. **Tampilan Dinamis Berdasarkan Metode Pembayaran**:
   - **Mode QRIS Otomatis (PayKita)**:
     - Bingkai kode QRIS bersih di tengah halaman dengan tombol **"Unduh / Perbesar QRIS"** dan tombol **"Salin Nominal Total Bayar"**.
     - Rincian harga (Harga Produk + Kode Unik/Biaya Layanan jika ada) ditampilkan secara transparan dengan garis pemisah tipis.
     - Tombol **"Cek Status Pembayaran"** yang berdampingan dengan deteksi otomatis (*auto-polling* setiap 3 detik) tanpa perlu muat ulang halaman.
   - **Mode Transfer Manual / Crypto**:
     - Kartu nomor rekening / alamat wallet dengan tombol **Salin** satu klik dan tampilan QR (jika tersedia).
     - Area **Upload Bukti Transfer** (atau input TXID untuk Crypto) dengan pratinjau file dan umpan balik instan saat bukti berhasil dikirim.
3. **Tampilan Pengiriman Akun / Produk (*Delivery Box*)**:
   - Saat pembayaran terkonfirmasi lunas, menampilkan informasi akun/akses di dalam panel khusus yang mudah disalin atau dibuka langsung, disertai tombol ulasan dan bantuan WhatsApp CS.

---

## 3. File yang Akan Dimodifikasi
- `src/components/ProductModal.jsx`: Perombakan tata letak modal produk beranda, penyederhanaan input kontak pembeli (1 input pintar + auto-fill), perapian kartu pemilihan metode pembayaran (PayKita, Manual, Crypto), serta tetap mempertahankan seluruh atribut `data-testid` dan kompatibilitas API backend.
- `src/pages/PaymentSuccess.jsx`: Penyederhanaan tampilan halaman pembayaran dan status transaksi agar lebih bersih, terstruktur dengan *step indicator* yang jelas, serta mempermudah penyalinan nomor rekening/nominal dan *upload* bukti bayar.

---

## 4. Verifikasi
- Memastikan seluruh alur checkout produk beranda (**PayKita QRIS Otomatis**, **Transfer Manual**, dan **Crypto**) berfungsi lancar dari modal produk hingga halaman pembayaran.
- Menjalankan `compile_applet` untuk memastikan tidak ada *error* kompilasi atau *broken imports*.
