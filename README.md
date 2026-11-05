# Basco Cashflow ☕📊

Sistem pemantau arus kas & manajemen operasional cafe **Basco Coffee** terintegrasi dengan Google Sheets, Firebase Auth, dan analisis cerdas Google Gemini AI.

---

## 🚀 Fitur Utama (Lengkap 100%)

1. **Dashboard & Indikator Kinerja F&B:**
   - Ringkasan Kas: Omset (Pemasukan), Biaya (Pengeluaran), dan Saldo (Net Profit/Loss).
   - Rasio F&B Otomatis: Margin Laba Bersih, Rasio Bahan Baku (COGS/HPP Keseluruhan, Minuman, Makanan, Snack), Rasio Gaji Staff, dan Rasio Biaya Operasional.
   - Tren Arus Kas Bulanan dan Laporan Keuangan Mingguan Otomatis.
2. **Pencatatan Transaksi & Kategori:**
   - Input debit/kredit, rincian biaya, klasifikasi operasional vs manajemen.
   - Manajemen kategori kustom tersinkronisasi langsung ke Google Sheets.
3. **Analisis COGS & Omset Harian:**
   - Penjualan harian vs HPP, margin menu, dan simulasi biaya tetap (*fixed cost*).
   - Ekspor PDF untuk kartu resep & laporan penjualan COGS.
4. **Stok Opname & Barang Masuk:**
   - Form audit stok berkala dan penerimaan belanja bahan baku dari supplier.
5. **Jadwal Barista & Penggajian:**
   - Pengaturan jam shift (*Shift Master*), absensi/kehadiran harian.
   - Kalkulasi gaji otomatis dan pembuatan slip gaji (format gambar PNG & share WhatsApp).
6. **Debt Tracker (Pelacak Hutang) & AI Risk Assessment:**
   - Manajemen cicilan/hutang bulanan & tahunan dengan pengingat tanggal jatuh tempo.
   - Analisis kelayakan berhutang otomatis berbasis AI (Gemini).
7. **Catatan Kalender & Pengingat H-1:**
   - Agenda operasional kafe dengan notifikasi pengingat H-1 pada sidebar.
8. **Asisten AI & Forum HPP:**
   - Konsultasi interaktif seputar optimasi margin, efisiensi bahan, dan strategi keuangan.
9. **Employee Task & Shopping Report:**
   - Checklist penugasan tim kafe dan daftar kebutuhan belanja stok.
10. **Akses Fleksibel & Keamanan:**
    - Login Google (OAuth Google Sheets langsung) atau **Mode Akses Cepat / Manager Lokal**.
    - Fitur Backup & Restore data lokal (JSON).
    - **Tautkan Spreadsheet via Link/ID Langsung:** Anda dapat menempelkan URL Google Sheets yang sudah ada tanpa harus membuat baru!

---

## 💻 Panduan Mengedit di Visual Studio Code (VS Code)

Project ini telah dikonfigurasi penuh agar nyaman diedit di VS Code:

1. **Buka Folder di VS Code:**
   - Buka aplikasi **VS Code**.
   - Pilih menu **File > Open Folder...**, lalu pilih folder `d:\BASCO\Aplikasi`.
2. **Ekstensi yang Direkomendasikan:**
   - Saat folder dibuka, VS Code akan merekomendasikan ekstensi yang sudah disiapkan di `.vscode/extensions.json`:
     - *Tailwind CSS IntelliSense* (untuk autocomplete kelas Tailwind)
     - *Prettier - Code formatter* (untuk format kode rapi saat save)
     - *ESLint*
3. **Jalankan Terminal di VS Code:**
   - Buka terminal terintegrasi dengan menekan tombol **Ctrl + `** (backtick) atau menu **Terminal > New Terminal**.
   - Jalankan server dev:
     ```bash
     npm run dev
     ```
   - Buka browser di [http://localhost:3000](http://localhost:3000). Setiap kali Anda mengedit dan menyimpan file (`Ctrl + S`), perubahan akan langsung muncul seketika di browser tanpa reload (Hot Module Replacement).

---

## 📂 Peta File Penting untuk Diedit

| Bagian yang Ingin Diubah | File Sumber |
| :--- | :--- |
| **Navigasi & Menu Sidebar** | `src/components/Sidebar.tsx` |
| **Halaman Dashboard & Rasio Keuangan** | `src/components/Dashboard.tsx` |
| **Form Transaksi Kas** | `src/components/TransactionForm.tsx` |
| **Omset & HPP (COGS) Menu** | `src/components/CogsDailySalesPage.tsx` |
| **Jadwal Shift & Slip Gaji Barista** | `src/components/BaristaSchedulePage.tsx` |
| **Audit Stok Opname** | `src/components/StockOpnamePage.tsx` |
| **Pelacak Hutang & Analisis AI** | `src/components/DebtTrackerPage.tsx` |
| **Agenda Kalender & Pengingat H-1** | `src/components/CalendarNotesPage.tsx` |
| **Koneksi Google Sheets & Tab Data** | `src/sheetsService.ts` |
| **Endpoint Backend & Prompt Gemini AI** | `apiServer.ts` & `server.ts` |
| **Gaya Desain / Styling CSS** | `src/index.css` |

---

## 📊 Menghubungkan Google Spreadsheet yang Sama

Aplikasi ini menggunakan format multi-tab spreadsheet Google yang mencakup:
* `Sheet1` (Pencatatan Arus Kas Transaksi)
* `Kategori` (Daftar Kategori Pengeluaran)
* `'Catalog Menu'` (Katalog Menu & Harga)
* `'Bahan Baku & Resep'` (Resep HPP & Stok Bahan Baku)
* `'Penjualan Harian'` (Rekap Omset Harian)
* `'Laporan Stok Opname'` (Histori Audit Stok)
* `'Barang Masuk & Pembelian'` (Penerimaan Barang)
* `'Jadwal Barista'` (Jadwal Shift & Absensi)
* `'Master Tim Barista'` & `'Master Jam Shift'`
* `'Catatan & Agenda Kalender'`

### Cara Menghubungkan Spreadsheet yang Sudah Ada:
1. Login dengan akun Google yang memiliki hak akses ke spreadsheet Anda.
2. Pada layar **"Hubungkan Spreadsheet Anda"**:
   - Jika spreadsheet sebelumnya bernama *"Dasbor Arus Kas Keuangan"* atau *"Basco Cashflow"*, aplikasi akan langsung mendeteksinya otomatis.
   - **Atau cukup salin (copy) link Google Spreadsheet Anda**, lalu tempel (*paste*) ke kotak input **"Atau Tautkan Link / ID Spreadsheet Yang Sudah Ada"** dan klik **"Hubungkan Spreadsheet Ini"**.
3. Aplikasi akan langsung tersambung dan memuat seluruh data dari spreadsheet tersebut!

---

## 🌐 Panduan Hosting Gratis (100% Free)

Aplikasi ini siap di-deploy secara gratis ke platform hosting modern:

### Opsi A: Deploy ke Vercel (Paling Cepat & Gratis)
File konfigurasi [`vercel.json`](file:///d:/BASCO/Aplikasi/vercel.json) dan [`api/index.ts`](file:///d:/BASCO/Aplikasi/api/index.ts) sudah siap.

1. Buat repositori baru di GitHub (misal: `basco-cashflow`).
2. Push project ini ke GitHub:
   ```bash
   git add .
   git commit -m "Initial commit Basco Cashflow"
   git remote add origin https://github.com/USERNAME/basco-cashflow.git
   git branch -M main
   git push -u origin main
   ```
3. Buka [vercel.com](https://vercel.com), login dengan GitHub, lalu klik **"Add New Project"**.
4. Pilih repositori `basco-cashflow`.
5. Di bagian **Environment Variables**, tambahkan:
   - `GEMINI_API_KEY`: *(API Key Gemini Anda dari Google AI Studio)*
6. Klik **Deploy**. Dalam ~1 menit aplikasi Anda sudah online dengan domain gratis seperti `https://basco-cashflow.vercel.app`!

> **Catatan OAuth Google di Domain Baru:**
> Jika login Google popup memunculkan peringatan unauthorized domain, buka [Firebase Console](https://console.firebase.google.com/) > Authentication > Settings > Authorized Domains, lalu tambahkan domain Vercel Anda (misal `basco-cashflow.vercel.app`).

---

### Opsi B: Deploy ke Render.com (Free Web Service)
File konfigurasi [`render.yaml`](file:///d:/BASCO/Aplikasi/render.yaml) sudah tersedia.

1. Buka [render.com](https://render.com) dan hubungkan akun GitHub Anda.
2. Buat **New Web Service**, pilih repositori `basco-cashflow`.
3. Pengaturan:
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
4. Di bagian **Environment Variables**, masukkan:
   - `GEMINI_API_KEY`: *(API Key Anda)*
   - `NODE_VERSION`: `22`
5. Klik **Create Web Service**. Aplikasi full-stack akan aktif dengan URL gratis `https://basco-cashflow.onrender.com`.

---

## 🛠️ Perintah Skrip NPM

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server pengembangan lokal (Vite + Express Hot Reload) |
| `npm run build` | Melakukan build produksi (Vite frontend + bundle `server.cjs`) |
| `npm start` | Menjalankan server bundle produksi di port 3000 |
| `npm run lint` | Melakukan pemeriksaan tipe TypeScript (`tsc --noEmit`) |
| `npm run clean` | Membersihkan folder `dist` |
