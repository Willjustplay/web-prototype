# Rencana Implementasi: Sistem Verifikasi Email, Reset Password, & Manajemen Pengguna Admin

## 1. Ringkasan Eksekutif
Mengaktifkan alur autentikasi berbasis verifikasi tautan email wajib sebelum pengguna dapat masuk ke aplikasi **TanyaHukum**, melengkapi alur lupa dan reset kata sandi berbasis token aman (SHA-256), menyediakan pengiriman email melalui **Resend API** dengan fallback pratinjau tautan instan saat mode pengembangan (ketika `RESEND_API_KEY` belum diatur), mendukung penyimpanan persisten lokal (JSON/file) sekaligus koneksi **MongoDB** jika `MONGODB_URI` dikonfigurasi, serta menambahkan tab **Manajemen User** dan **Audit Log** langsung di halaman Panel Admin (`/admin`).

---

## 2. Arsitektur & Penyimpanan Data (`server.ts` & Modul Database)
- **Dual-Mode Persistence (Penyimpanan Lokal + MongoDB Opsional)**:
  - Menyediakan lapisan abstraksi penyimpanan untuk `users`, `sessions`, `auth_tokens`, `audit_logs`, dan `rule_overrides`.
  - Secara otomatis menyimpan perubahan ke file JSON lokal di server agar data pengguna, status verifikasi, token, dan log audit tetap bertahan meskipun server dimuat ulang, serta otomatis terhubung ke **MongoDB** apabila `MONGODB_URI` tersedia di environment.
- **Koleksi / Tabel Data**:
  - `users`: Menyimpan `id`, `name`, `email`, `password_hash`, `role` (`user` | `admin`), `is_verified` (`boolean`), `verified_at`, `created_at`, `updated_at`, dan `last_login_at`. Akun demo yang sudah ada (`admin@tanyahukum.id`, `budi@email.com`) tetap berstatus terverifikasi (`is_verified: true`).
  - `auth_tokens`: Menyimpan `id`, `user_id`, `email`, `type` (`verify_email` | `reset_password`), `token_hash` (SHA-256 dari raw token 32-byte), `expires_at`, `used_at`, dan `created_at`.
  - `audit_logs`: Menyimpan `id`, `actor_user_id`, `actor_email`, `action` (mis. `AUTH_REGISTER`, `AUTH_VERIFY_EMAIL`, `AUTH_LOGIN`, `AUTH_PASSWORD_RESET`, `ADMIN_USER_VERIFY`, `ADMIN_USER_ROLE`, `ADMIN_USER_DELETE`), `target_type`, `target_id`, `metadata`, `ip`, dan `created_at`.

---

## 3. Alur Autentikasi, Verifikasi Email & Reset Password
- **Registrasi (`POST /api/auth/register`)**:
  - Pengguna baru dibuat dengan `is_verified: false` (tidak langsung login).
  - Menghasilkan token verifikasi 32-byte acak, menyimpan hash SHA-256 ke `auth_tokens` (berlaku 24 jam), dan mengirim email verifikasi berisi tautan `/verify-email?token=...`.
  - Mengembalikan respons `{ message, email_verification_sent: true, dev_preview_url? }` sehingga `AuthModal` otomatis menampilkan layar instruksi cek email dan pratinjau tautan langsung jika berada di mode pengembangan tanpa `RESEND_API_KEY`.
- **Verifikasi Email (`GET /api/auth/verify-email` & `POST /api/auth/resend-verification`)**:
  - Memvalidasi hash token, memastikan belum kedaluwarsa dan belum terpakai, lalu mengubah `user.is_verified = true` serta `verified_at = now`.
  - Mendukung pengiriman ulang tautan verifikasi dengan pembatasan jeda (cooldown) dan pencatatan di `audit_logs`.
- **Login Wajib Verifikasi (`POST /api/auth/login`)**:
  - Memeriksa kecocokan email dan kata sandi.
  - Jika `user.is_verified === false`, mengembalikan HTTP `403` dengan `{ detail: "Email belum diverifikasi. Silakan cek kotak masuk email Anda.", code: "EMAIL_NOT_VERIFIED", email }` agar `AuthModal` langsung membuka panel kirim ulang verifikasi.
- **Lupa & Reset Kata Sandi (`POST /api/auth/forgot-password` & `POST /api/auth/reset-password`)**:
  - `forgot-password`: Membuat token reset password (berlaku 1 jam), mengirim tautan `/reset-password?token=...` via Resend API (atau menyertakan `dev_preview_url` di mode dev), dan mencatat log audit.
  - `reset-password`: Memvalidasi token, memperbarui `password_hash`, menandai token telah digunakan, mencabut seluruh sesi lama pengguna tersebut demi keamanan, dan menandai email sebagai terverifikasi jika sebelumnya belum.

---

## 4. Layanan Email Resend + Pratinjau Mode Pengembangan
- **Integrasi Resend (`RESEND_API_KEY` & `EMAIL_FROM`)**:
  - Jika `RESEND_API_KEY` tersedia, server mengirim email HTML berdesain editorial TanyaHukum melalui API Resend (`https://api.resend.com/emails`).
  - Jika `RESEND_API_KEY` belum dikonfigurasi, sistem tetap berjalan lancar tanpa error 503: mencetak tautan verifikasi/reset di log server dan menyertakan `dev_preview_url` pada respons API agar pengguna/penguji dapat langsung mengklik tombol pratinjau tautan dari dalam dialog autentikasi.

---

## 5. Pembaruan Antarmuka Pengguna & Panel Admin (`src/pages/Admin.jsx` & `src/components/AuthModal.jsx`)
- **Dialog Autentikasi (`AuthModal.jsx`)**:
  - Menampilkan pratinjau tautan verifikasi / reset password langsung di dalam modal apabila server mengembalikan `dev_preview_url` (ketika Resend belum dikonfigurasi), sehingga alur verifikasi dan reset password dapat diuji dari ujung ke ujung dengan satu klik.
- **Tab Baru di Halaman Admin (`/admin`)**:
  - **Tab Manajemen User**:
    - Tabel daftar pengguna dilengkapi pencarian (`name`/`email`), filter status verifikasi (`Semua`, `Terverifikasi`, `Belum Verifikasi`), dan filter peran (`Semua`, `Admin`, `User`).
    - Tombol aksi cepat bagi Admin: **Verifikasi Manual / Cabut Verifikasi**, **Kirim Ulang Email Verifikasi**, **Ubah Role (`user` ↔ `admin`)**, dan **Hapus Pengguna** (dengan proteksi agar admin tidak menghapus akunnya sendiri).
  - **Tab Audit Log**:
    - Menampilkan riwayat aktivitas sistem dan autentikasi secara kronologis (waktu, pelaku, jenis aksi, target, dan detail metadata) beserta filter pencarian aksi.
