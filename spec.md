# SPEC.md — Toko Mama (E-commerce Style / Tema Babyzania)

**Versi:** 3.0 · **Target:** Latihan 1 hari · **Stack:** Vite + JavaScript vanilla (Prototype: Single HTML) · **Tema:** Modern E-commerce (Pink/Magenta & Putih)

---

## 1. Tujuan
Membangun aplikasi web katalog + dashboard produk UMKM "Toko Mama" dengan tampilan yang terinspirasi dari e-commerce modern (Babyzania). Aplikasi memungkinkan calon pembeli melihat katalog, mencari, menyaring, dan memesan via WhatsApp, serta memungkinkan pengelola toko (admin) melakukan CRUD produk dan mengubah nomor WhatsApp tujuan—semuanya berjalan di klien (browser) tanpa backend.

---

## 2. Pengguna
| Peran | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Calon Pembeli** | Pengunjung katalog (tidak perlu login). | Cari, filter, sort, lihat detail, hubungi via WA. |
| **Pengelola Toko (Admin)** | Pemilik toko dengan akses ke dashboard. | CRUD produk, upload gambar, ubah nomor WA (dengan PIN). |

Keduanya menggunakan perangkat yang sama; perpindahan mode dilakukan lewat navigasi tab.

---

## 3. Daftar Fitur (MVP)

1. **Katalog Produk (E-commerce Style)**
   - Grid responsif dengan kartu produk (gambar, judul, kategori, harga, tombol BELI).
   - Badge khusus: "TERLARIS" (kuning) untuk produk unggulan, dan diskon visual (merah).
2. **Pencarian & Filter**
   - Pencarian *real-time* berdasarkan nama/deskripsi (case-insensitive).
   - Filter berdasarkan kategori produk (dropdown).
   - Sorting: Nama A–Z, Harga Termurah/Termahal, Stok Terbanyak.
3. **Tombol Pesan WhatsApp**
   - Tombol "BELI" pada setiap kartu membuka `wa.me` dengan teks pesan otomatis (nama & harga).
   - Tombol *floating* WhatsApp di pojok kanan bawah untuk kontak umum.
   - Nomor WA diambil secara dinamis dari konfigurasi admin.
4. **Dashboard Admin (Demo CRUD)**
   - Ringkasan statistik: Total Produk, Total Stok, Jumlah Kategori Aktif.
   - Form Tambah/Edit Produk: Nama, Kategori (preset), Harga, Stok, Deskripsi, Unggulan.
   - Tabel daftar produk dengan aksi Edit & Hapus (dengan konfirmasi).
5. **Upload Gambar Produk**
   - Input file JPG/PNG/WebP.
   - Kompresi otomatis di sisi klien (maks. 800px, target ≤ 300 KB) via `canvas`.
   - Pratinjau gambar sebelum disimpan.
6. **Pengaturan Nomor WhatsApp (Admin-Only)**
   - Panel di dashboard yang terkunci dengan PIN demo (`1234`).
   - Validasi format nomor (8–15 digit, diawali kode negara `62`).
   - Nomor disimpan di `localStorage` dan langsung diterapkan ke tombol WA katalog.
7. **Penyimpanan Data (localStorage)**
   - Data produk disimpan di `localStorage` key `toko-mama:products:v2`.
   - Konfigurasi WA disimpan di `toko-mama:config:v1`.
   - Sesi admin disimpan di `sessionStorage` (auto-logout saat tab ditutup).

---

## 4. Data Model

### A. Produk
```javascript
{
  id: string,          // unik, mis. "p-001" atau generate otomatis
  nama: string,        // wajib, maks 80 karakter
  kategori: string,    // wajib, enum (lihat KATEGORI_PRESET)
  harga: number,       // integer >= 0 (Rupiah)
  stok: number,        // integer >= 0
  deskripsi: string,   // opsional, maks 300 karakter
  imageUrl: string,    // Data URI (base64) / SVG placeholder
  unggulan: boolean    // true = tampil badge & visual diskon
}