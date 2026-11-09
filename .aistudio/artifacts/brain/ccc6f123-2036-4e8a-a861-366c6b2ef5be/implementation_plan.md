# Rencana Pengamanan Website Berlapis (Multi-Layer Security Hardening)

Rencana ini merancang sistem pertahanan berlapis untuk melindungi website dari berbagai serangan siber seperti *Brute Force*, *Spam/DDoS Checkout*, *Cross-Site Scripting (XSS)*, *SQL/NoSQL Injection*, *Prototype Pollution*, manipulasi *File Upload*, serta pemalsuan *Webhook* pembayaran.

---

## Keputusan Desain yang Dikonfirmasi

1. **Cakupan Lapisan Keamanan Utama**:
   - **Anti-Brute Force & Rate Limiting Transaksi**: Perlindungan ketat pada endpoint login admin, login pengguna, registrasi, reset password, serta pembuatan transaksi checkout agar tidak dapat di-spam oleh bot.
   - **Filter Anti-XSS, Anti-Injection & Validasi Ketat File Upload**: Pembersihan otomatis seluruh input dari skrip berbahaya, pencegahan injeksi query/objek, serta pemeriksaan *magic bytes* (header biner asli) pada gambar bukti pembayaran.
   - **Pengamanan Webhook, Enkripsi Sesi & Header Keamanan HTTP**: Verifikasi tanda tangan kriptografis (*timing-safe comparison*) pada callback pembayaran, penguncian atribut cookie sesi, serta penyematan header keamanan standar industri.
2. **Tindakan Otomatis terhadap Serangan Berulang**:
   - **Blokir Sementara IP Selama 15 Menit & Pencatatan Audit Log**: Setiap IP yang melampaui ambang batas percobaan login gagal, melakukan spam checkout, atau mengirimkan muatan serangan (payload XSS/Injection) akan langsung diblokir otomatis selama **15 menit** dan dicatat secara rinci ke dalam **Audit Log Keamanan** (lengkap dengan fitur pantau dan buka blokir IP manual bagi Admin).

---

## Arsitektur Pertahanan Berlapis (Security Pipeline)

```text
[ Request Masuk dari Pengunjung / Bot ]
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Lapis 1: Firewall IP & Pemblokiran Sementara (15 Menit) │
│ • Cek apakah IP masuk daftar blokir aktif               │
│ • Jika diblokir -> Tolak (HTTP 429) & blokir akses API  │
└─────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Lapis 2: Header Keamanan HTTP & Proteksi Server         │
│ • Sembunyikan identitas server                          │
│ • Pasang X-Content-Type-Options, Referrer-Policy,       │
│   Permissions-Policy, dan X-XSS-Protection              │
└─────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Lapis 3: Inspeksi & Sanitasi Payload (WAF Ringan)       │
│ • Cegah Prototype Pollution (__proto__, constructor)    │
│ • Deteksi & bersihkan payload XSS (<script>, onerror=)  │
│ • Deteksi pola SQL/NoSQL Injection & Null-Byte Attack   │
│ • Pelanggaran berulang -> Blokir IP 15 Menit + Log      │
└─────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Lapis 4: Rate Limiting Spesifik Endpoint                │
│ • Login Admin & Kunci Admin: Maks 5 gagal -> Blokir IP  │
│ • Checkout & Buat Order: Batasi frekuensi per IP        │
│ • Upload Bukti Bayar: Validasi Magic Bytes (PNG/JPG/WEBP│
│ • Webhook Pembayaran: Verifikasi Signature Timing-Safe  │
└─────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Lapis 5: Audit Log Keamanan & Panel Kendali Admin       │
│ • Catat otomatis kejadian serangan & IP yang diblokir   │
│ • Admin dapat memantau daftar IP terblokir & Unblock IP │
└─────────────────────────────────────────────────────────┘
```

---

## Rincian Implementasi Fitur Keamanan

### 1. Sistem Blokir IP Otomatis 15 Menit & Deteksi Intrusi
- **Manajemen Daftar Blokir IP**: Menyimpan daftar IP yang terindikasi melakukan serangan beserta waktu kedaluwarsa blokir (`15 menit` sejak pelanggaran terdeteksi) dan alasan pemblokiran.
- **Pencegahan Bypass IP**: Membaca IP asli pengunjung secara akurat dengan memperhitungkan header proxy secara aman.
- **Akumulasi Pelanggaran (Strike System)**: Jika satu IP berulang kali memicu *rate limit*, gagal autentikasi admin, atau mengirimkan payload berbahaya, sistem langsung mengaktifkan blokir 15 menit pada IP tersebut dan menulis catatan ke Audit Log.

### 2. Perlindungan Anti-Brute Force Login Admin & Pembatasan Spam Transaksi
- **Proteksi Login Admin & Verifikasi Kunci Admin**:
  - Membatasi percobaan login admin maksimal **5 kali gagal** dalam rentang waktu pengawasan. Jika terlampaui, IP langsung diblokir selama **15 menit** dan dicatat sebagai insiden `security.brute_force_admin`.
  - Menggunakan perbandingan kriptografis waktu konstan (*timing-safe comparison*) saat memeriksa kredensial/kunci admin untuk mencegah serangan *Timing Attack*.
- **Rate Limiting Checkout & Pembayaran**:
  - Membatasi pembuatan transaksi baru (otomatis, manual, kripto, dan top up) per IP agar pelaku tidak dapat melakukan spam order untuk menguras stok atau membebani gateway pembayaran.
  - Pelanggaran berulang pada endpoint checkout akan memicu blokir IP 15 menit dan dicatat sebagai `security.checkout_spam_blocked`.

### 3. Filter Anti-XSS, Anti-Injection & Validasi Ketat File Upload
- **Sanitasi Input Rekursif & Proteksi Prototype Pollution**:
  - Membersihkan seluruh data yang masuk (`body`, `query`, dan `params`) dari properti berbahaya seperti `__proto__`, `prototype`, dan `constructor`, serta menghapus karakter *null-byte*.
  - Menyaring tag skrip berbahaya (`<script>`, `javascript:`, `vbscript:`, `data:text/html`, serta atribut event inline seperti `onerror=` dan `onload=`) agar tidak tersimpan ke database atau dieksekusi di browser pembeli/admin.
- **Deteksi Payload SQL/NoSQL Injection**:
  - Memeriksa pola serangan injeksi pada parameter input. Jika terdeteksi percobaan eksploitasi berbahaya, permintaan langsung ditolak, dicatat ke Audit Log (`security.payload_attack_detected`), dan dihitung sebagai pelanggaran keamanan IP.
- **Validasi *Magic Bytes* File Upload Bukti Pembayaran**:
  - Memeriksa byte pertama (*file signature / magic bytes*) dari file yang diunggah untuk memastikan file benar-benar gambar asli (`PNG`, `JPEG`, atau `WEBP`), bukan file skrip berbahaya (`.php`, `.html`, `.svg`, `.exe`, `.js`) yang disamarkan ekstensi atau tipe MIME-nya.

### 4. Pengamanan Webhook Pembayaran, Sesi, dan Header HTTP
- **Header Keamanan HTTP**:
  - Menonaktifkan eksposur tanda pengenal server dan menyematkan header perlindungan `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, serta `Permissions-Policy` untuk membatasi akses fitur sensitif browser.
- **Pengamanan Sesi & Webhook**:
  - Memastikan token sesi dibuat dengan generator acak kriptografis (`crypto.randomBytes`), disimpan dengan cookie `HttpOnly` dan `SameSite=Lax`, serta memvalidasi signature webhook menggunakan perbandingan aman agar status pesanan tidak dapat dipalsukan dari luar.

### 5. Pemantauan Blokir IP pada Panel Audit Log Admin
- **visibilitas Insiden Keamanan**:
  - Menampilkan daftar **IP yang Sedang Diblokir** secara langsung di halaman **Audit Log** pada dashboard Admin lengkap dengan alasan blokir, sisa waktu blokir, dan tombol **Buka Blokir (Unblock)** jika Admin ingin mencabut blokir lebih awal.
  - Menambahkan penanda visual khusus untuk log bertipe keamanan (`security.*`) agar Admin dapat langsung mengenali riwayat serangan yang berhasil ditangkal sistem.
