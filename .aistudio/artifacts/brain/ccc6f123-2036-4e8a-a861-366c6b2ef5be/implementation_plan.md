# Rencana Penyederhanaan Desain Dinamis & Perbaikan Bahasa Inggris Halaman Top Up

## 1. Tujuan Perubahan
1. **Penyederhanaan & Desain Dinamis Katalog Top Up (`/src/pages/Topup.jsx` & `/src/components/topup/TopupGameGrid.jsx`)**:
   - Menyederhanakan area *Hero Header* di `/topup` menjadi lebih ringkas, modern, dan tidak memakan banyak ruang vertikal (menggabungkan judul, badge status *Instant Delivery*, dan tombol *Cek Pesanan* dalam satu bar *header* yang proporsional).
   - Membuat *Search & Filter Control Bar* di `TopupGameGrid.jsx` lebih dinamis dan menyatu dengan indikator jumlah game aktif, tombol filter *pill* beranimasi (`All Games`, `Popular`, `Lowest Price`, `A - Z`), serta kartu game yang lebih kompak, responsif, dan tajam dengan efek hover interaktif.
2. **Penyederhanaan & Desain Dinamis Halaman Detail Top Up Game (`/src/pages/TopupGameDetail.jsx` & `/src/components/topup/DenominationGrid.jsx`)**:
   - Menyederhanakan *Sidebar Info Game* (kolom kiri) agar lebih kompak dan bersih: menampilkan kartu profil game, status *live stock*, dan panduan singkat yang ringkas tanpa teks berulang yang terlalu panjang.
   - Menyempurnakan indikator progres tahapan (*Step Progress Bar* 1–4) di bagian atas form agar pengguna dapat melihat status pengisian (*1. Account*, *2. Nominal*, *3. Payment*, *4. Checkout*) secara *real-time* dan dinamis.
   - Merapikan setiap kartu langkah (*Step 1–4*) dengan *header* yang lebih bersih, transisi *smooth*, dan ringkasan pesanan *sticky/inline* yang jelas sebelum tombol *Beli Sekarang / Buy Now*.
3. **Perbaikan Menyeluruh Bahasa Inggris (`EN`) di Seluruh Halaman Top Up**:
   - Memperbaiki seluruh teks yang masih *hardcoded* Bahasa Indonesia di `/src/pages/Topup.jsx`, `/src/components/topup/TopupGameGrid.jsx`, `/src/pages/TopupGameDetail.jsx`, `/src/components/topup/DenominationGrid.jsx`, dan `/src/context/LanguageContext.jsx`.
   - Menerjemahkan judul, subjudul, *placeholder* pencarian, label filter, status kartu game (*Starting from*, *Coming Soon*, *Popular*, *SKUs*), label dan *placeholder* *field* tujuan Digiflazz (*Masukkan User ID* -> *Enter User ID*, *Pilih Server* -> *Select Server*, petunjuk bantuan ID), pesan verifikasi Cek ID Digiflazz, kategori dan deskripsi metode pembayaran, hingga ringkasan pembayaran dan *modal* instruksi *checkout* saat bahasa `EN` dipilih.

## 2. File yang Akan Dimodifikasi
- `/src/pages/Topup.jsx`
  - Merombak *Hero Header* menjadi tata letak kompak berorientasi aksi dengan dukungan dwibahasa (`t(id, en)`) penuh (termasuk memperbaiki judul `Pilih Game Favoritmu` / `Choose Your Favorite Game` dan badge `100% Resmi` / `100% Official`).
- `/src/components/topup/TopupGameGrid.jsx`
  - Memperbarui desain *Search & Filter Bar* serta kartu katalog game agar lebih kompak, dinamis, dan sepenuhnya menggunakan fungsi `t(id, en)` untuk semua teks (*placeholder*, tombol *retry/reset*, *badge* populer, jumlah nominal, dan label harga).
- `/src/pages/TopupGameDetail.jsx`
  - Menyederhanakan *sidebar* informasi game dan menambahkan indikator progres langkah dinamis (*Account* -> *Nominal* -> *Payment* -> *Checkout*).
  - Menerapkan dukungan dwibahasa (`t(id, en)`) secara menyeluruh pada seluruh langkah (Step 1 Akun & Cek ID Digiflazz, Step 2 Nominal, Step 3 Pembayaran, Step 4 Ringkasan & Konfirmasi, serta Modal Instruksi Pembayaran).
- `/src/components/topup/DenominationGrid.jsx`
  - Menyempurnakan tampilan kartu nominal dan menambahkan dukungan `t(id, en)` penuh pada semua label, *tab*, pesan kosong, dan indikator stok.
- `/src/context/LanguageContext.jsx`
  - Memperkaya kamus terjemahan dinamis (`EXACT_MAP` dan aturan pola `translateDynamicString`) untuk label/bantuan *field* bawaan Digiflazz serta istilah halaman Top Up.

## 3. Langkah Verifikasi
- Menjalankan pemeriksaan *build* dan *linting* (`compile_applet` & `lint_applet`) untuk memastikan tidak ada kesalahan sintaks atau *import*.
- Memastikan halaman `/topup` dan `/topup/:slug` tampil lebih simpel, dinamis, dan seluruh teks berubah ke Bahasa Inggris dengan akurat saat bahasa `EN` diaktifkan.
