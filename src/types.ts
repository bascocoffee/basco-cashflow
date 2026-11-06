export type AppRole = 'owner' | 'manager' | 'barista';

export interface Transaction {
  id: string; // Row index or unique ID
  tanggal: string; // format YYYY-MM-DD
  debit: number; // Income amount (0 if none)
  kredit: number; // Expense amount (0 if none)
  kredit2: number; // Expense amount 2 (0 if none)
  jenisPengeluaran: string; // Category, e.g., "Makanan & Minuman", "Gaji", "Belanja", etc.
  jenisPengeluaran2: string; // "Pengeluaran 2", secondary category or "-"
  keterangan: string; // Notes or description
  operasionalDanManajemen: string; // "Operasional", "Manajemen", or "-"
}

export interface FinancialSummary {
  totalDebit: number; // Total Income
  totalKredit: number; // Total Expense
  saldo: number; // Current balance (debit - kredit)
}

export interface MonthlyData {
  month: string; // e.g., "Jan", "Feb", "Mar"
  monthLong: string; // e.g., "Januari", "Februari"
  year: string; // e.g., "2026"
  debit: number;
  kredit: number;
  saldo: number;
}

export const CATEGORIES = [
  "Penjualan Makanan",
  "Penjualan Minuman",
  "Penjualan Merchandise & Kopi",
  "Event & Sewa Space",
  "Bahan Baku & HPP (COGS)",
  "Gaji Karyawan & Barista",
  "Operasional & Sewa Tempat",
  "Promosi & Marketing",
  "Peralatan & Inventaris",
  "Pajak & Administrasi",
  "Lain-lain"
] as const;

export type CategoryType = typeof CATEGORIES[number];

// ==========================================
// CAFE BUSINESS RATIO & KPI CATEGORY MAPPING
// ==========================================

export type CafeRatioGroup = 
  | 'cogs_minuman' 
  | 'cogs_food' 
  | 'cogs_snack' 
  | 'cogs_general' 
  | 'wages' 
  | 'operasional' 
  | 'promo' 
  | 'other';

export interface CafeRatioCategoryConfig {
  mode: 'auto' | 'manual';
  salesMode: 'all_debit' | 'selected_categories';
  selectedSalesCategories: string[];
  categoryMapping: Record<string, CafeRatioGroup>;
}

// ==========================================
// BARISTA MANAGEMENT & SHIFT SCHEDULE TYPES
// ==========================================

export type BaristaRole = 
  | 'Head Barista'
  | 'Senior Barista'
  | 'Barista'
  | 'Junior Barista'
  | 'Cashier / Bar'
  | 'Part Time';

export interface RoleSalaryStandard {
  role: BaristaRole;
  baseSalary: number; // Gaji Pokok (Rp)
  positionAllowance: number; // Tunjangan Jabatan (Rp)
  dailyAllowance: number; // Uang Kehadiran / Makan / Transport per Hari Masuk (Rp)
  annualIncreaseType: 'fixed' | 'percentage';
  annualIncreaseValue: number; // Nominal (Rp) atau Persentase (%) per tahun masa kerja
  overtimeRatePerHour: number; // Tarif lembur per jam (Rp)
  description?: string;
}

export interface Barista {
  id: string;
  name: string;
  nickname?: string;
  role: BaristaRole;
  phone?: string;
  color: string; // Tailwind color token e.g. 'amber', 'emerald', 'sky', etc.
  isActive: boolean;
  joinDate?: string; // Tanggal Mulai Kerja (YYYY-MM-DD)
  monthlySalary?: number; // Gaji Pokok Bulanan (Rp)
  positionAllowance?: number; // Tunjangan Jabatan (Rp)
  dailySalary?: number; // Uang Kehadiran / Uang Harian per Hari/Shift (Rp)
  annualIncreaseType?: 'fixed' | 'percentage';
  annualIncreaseValue?: number; // Nilai Kenaikan Gaji per Tahun (Rp atau %)
  overtimeRatePerHour?: number; // Tarif lembur per jam (Rp)
  notes?: string;
}

export interface SalaryAdjustment {
  bonus?: number; // Bonus / Insentif Kinerja (Rp)
  bonusNotes?: string;
  overtimeHours?: number; // Jam Lembur Tambahan
  deductions?: number; // Potongan Kasbon / Lainnya (Rp)
  deductionNotes?: string;
}

export interface PayslipData {
  id: string;
  slipNumber: string;
  baristaId: string;
  baristaName: string;
  baristaNickname?: string;
  role: BaristaRole;
  phone?: string;
  joinDate: string;
  periodMonth: string; // e.g., "2026-08"
  periodLabel: string; // e.g., "Agustus 2026"
  generationDate: string; // YYYY-MM-DD
  
  // Masa Kerja
  yearsOfService: number;
  monthsOfService: number;
  serviceDurationText: string;

  // Rekapitulasi Kehadiran dari Jadwal Harian
  totalShiftsScheduled: number;
  totalDaysPresent: number;
  totalHoursWorked: number;
  totalOvertimeHours: number;
  totalDaysOff: number;
  totalLeaveDays: number;

  // Rincian Penghasilan (Earnings)
  baseSalary: number; // Gaji Pokok
  positionAllowance: number; // Tunjangan Jabatan
  annualIncreaseAmount: number; // Kenaikan Gaji Berdasarkan Masa Kerja (Pertahun)
  attendanceAllowance: number; // Uang Kehadiran / Uang Harian (Shift x Tarif)
  overtimePay: number; // Upah Lembur
  bonus: number; // Bonus / Insentif
  bonusNotes?: string;
  totalEarnings: number; // Total Penghasilan Kotor

  // Rincian Potongan (Deductions)
  deductions: number; // Potongan
  deductionNotes?: string;
  totalDeductions: number;

  // Gaji Bersih
  netSalary: number; // Take Home Pay
  terbilangText: string; // Format terbilang rupiah
}

export interface ShiftMaster {
  id: string;
  name: string; // e.g., "Shift Pagi (Opening)", "Shift Middle", "Shift Sore (Closing)", "Shift Malam (Full Bar)", "Libur / Off"
  shortCode: string; // e.g., "PAGI", "MID", "SORE", "MLM", "OFF"
  startTime: string; // "07:00"
  endTime: string; // "15:00"
  durationHours: number; // e.g., 8
  color: string; // e.g., 'emerald', 'sky', 'amber', 'violet', 'slate'
  isOff?: boolean; // true if this represents a Day Off
  description?: string;
}

export type ShiftScheduleStatus = 'scheduled' | 'hadir' | 'libur' | 'izin' | 'sakit' | 'lembur';

export interface BaristaScheduleEntry {
  id: string;
  date: string; // YYYY-MM-DD
  baristaId: string;
  shiftId: string; // References ShiftMaster.id
  customStartTime?: string; // Optional override
  customEndTime?: string; // Optional override
  status: ShiftScheduleStatus;
  notes?: string;
}

// ==========================================
// INCOMING INGREDIENTS / BARANG MASUK TYPE
// ==========================================
export type PaymentStatus = 'Lunas' | 'Belum Lunas' | 'Tempo / Utang' | 'Konsinyasi' | 'Gratis / Sample';

export interface IncomingIngredientBatch {
  id: string;
  tanggal: string; // YYYY-MM-DD
  ingredientId?: string; // References RecipeIngredient.id if selected from master
  namaBahan: string; // Nama barang / bahan
  kategori?: string; // Minuman, Makanan, Packaging, Lain-lain
  berat: number; // Kuantitas / berat / volume
  satuan: string; // gram, kg, ml, liter, pcs, pack, dll.
  harga: number; // Total harga beli (Rp)
  hargaSatuan?: number; // Harga per satuan (Rp/gram atau Rp/kg dsb)
  statusPembayaran: PaymentStatus; // Lunas / Belum Lunas / Tempo dsb
  supplier?: string; // Nama supplier / toko
  keterangan?: string; // Keterangan tambahan / no nota / jatuh tempo
  nomorNota?: string; // Opsional no invoice / receipt
  createdAt?: string; // Timestamp
}

// ==========================================
// COMPREHENSIVE APPLICATION BACKUP JSON TYPE
// ==========================================

export interface StockOpnameEntry {
  itemId: string;
  namaBahan?: string;
  stokAwal: number;
  stokMasuk: number;
  terpakai: number;
  sisaDiBar: number;
  wasteLoss: number;
  catatanLoss?: string;
  nilaiLoss?: number;
  isAutoTerpakai?: boolean;
}

export interface MonthlyStockOpnameReport {
  id: string;
  periodeBulan: string; // YYYY-MM
  namaPeriode: string;
  tanggalOpname: string;
  petugasOpname: string;
  status: 'Draft' | 'Finalized';
  entries: Record<string, StockOpnameEntry>; // itemId -> entry
}

export interface AppFullBackupData {
  appName: string;
  version: string;
  exportedAt: string; // ISO string
  exportedBy?: string;
  transactions?: Transaction[];
  categories?: string[];
  baristas?: Barista[];
  shifts?: ShiftMaster[];
  schedules?: BaristaScheduleEntry[];
  cogsMenuCatalog?: any[];
  cogsIngredients?: any[];
  cogsIncomingBatches?: IncomingIngredientBatch[];
  cogsDailySales?: any[];
  cogsBiaya?: any[];
  calendarActivities?: any[];
  stockOpnameDrafts?: Record<string, any>;
  fixedCosts?: any[];
  debts?: DebtItem[];
  shoppingItems?: any[];
  notes?: string;
}

// ==========================================
// DEBT & LIABILITIES TRACKER (PENCATATAN HUTANG)
// ==========================================

export type DebtType = 'monthly' | 'annual' | 'lump_sum';
export type DebtCategory = 'equipment' | 'renovation' | 'working_capital' | 'supplier' | 'bank_loan' | 'other';
export type DebtStatus = 'active' | 'paid_off';

export interface DebtPaymentLog {
  id: string;
  paymentDate: string; // YYYY-MM-DD
  amountPaid: number;
  periodLabel: string; // e.g. "Angsuran Bulan Juli 2026"
  note?: string;
  createdAt: string;
}

export interface DebtItem {
  id: string;
  name: string; // e.g. "Cicilan Mesin Espresso La Marzocco"
  lenderName: string; // e.g. "Bank BRI / Supplier PT Kopi Jaya"
  category: DebtCategory;
  debtType: DebtType; // 'monthly' (Bulanan) | 'annual' (Tahunan) | 'lump_sum' (Sekaligus)
  
  principalAmount: number; // Total Pokok Hutang Awal (Rp)
  remainingAmount: number; // Sisa Pokok Hutang Saat Ini (Rp)
  monthlyInstallment: number; // Cicilan per Bulan (Rp)
  annualInstallment: number; // Beban Angsuran per Tahun (Rp)
  
  interestRatePerYear?: number; // Suku Bunga (% per tahun jika ada)
  tenorMonths: number; // Durasi Pinjaman dalam Bulan (misal 12, 24, 36)
  paidMonths: number; // Jumlah bulan/angsuran yang sudah lunas
  
  dueDayOfMonth: number; // Tanggal jatuh tempo per bulan (1 - 31)
  nextDueDate: string; // Tanggal pembayaran berikutnya (YYYY-MM-DD)
  startDate: string; // Tanggal mulai pinjaman (YYYY-MM-DD)
  endDate?: string; // Tanggal perkiraan lunas (YYYY-MM-DD)
  
  status: DebtStatus; // 'active' | 'paid_off'
  notes?: string;
  paymentLogs: DebtPaymentLog[];
  createdAt: string;
  updatedAt: string;
}


