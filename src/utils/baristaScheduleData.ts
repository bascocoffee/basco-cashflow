import { Barista, ShiftMaster, BaristaScheduleEntry, RoleSalaryStandard, PayslipData, SalaryAdjustment, BaristaRole } from '../types';

export const STORAGE_KEYS = {
  BARISTAS: 'aruskas_baristas_list',
  SHIFTS: 'aruskas_barista_shifts_master',
  SCHEDULES: 'aruskas_barista_schedules',
  ROLE_SALARIES: 'aruskas_barista_role_salaries',
  PAYROLL_ADJUSTMENTS: 'aruskas_barista_payroll_adjustments',
};

// ==========================================
// MASTER STANDAR GAJI & TUNJANGAN JABATAN
// ==========================================
export const DEFAULT_ROLE_SALARIES: RoleSalaryStandard[] = [
  {
    role: 'Head Barista',
    baseSalary: 3800000,
    positionAllowance: 500000,
    dailyAllowance: 25000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 200000, // Rp 200.000 / tahun masa kerja
    overtimeRatePerHour: 25000,
    description: 'Leader bar, kalibrasi espresso, SOP racikan & supervisi roster tim'
  },
  {
    role: 'Senior Barista',
    baseSalary: 3200000,
    positionAllowance: 300000,
    dailyAllowance: 20000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 175000,
    overtimeRatePerHour: 22000,
    description: 'Spesialis latte art, manual brew V60, briefing & inventory bar'
  },
  {
    role: 'Barista',
    baseSalary: 2800000,
    positionAllowance: 150000,
    dailyAllowance: 20000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 150000,
    overtimeRatePerHour: 20000,
    description: 'Speed brew espresso, grinder dosing & pelayanan bar reguler'
  },
  {
    role: 'Junior Barista',
    baseSalary: 2400000,
    positionAllowance: 100000,
    dailyAllowance: 15000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 120000,
    overtimeRatePerHour: 18000,
    description: 'Prep bahan syrup, ice blend, mocktail & sanitasi station'
  },
  {
    role: 'Cashier / Bar',
    baseSalary: 2500000,
    positionAllowance: 150000,
    dailyAllowance: 20000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 125000,
    overtimeRatePerHour: 18000,
    description: 'Operasional kasir POS, order taking, settlement & support bar'
  },
  {
    role: 'Part Time',
    baseSalary: 0, // Hourly / Shift-based
    positionAllowance: 0,
    dailyAllowance: 90000, // Rp 90.000 / shift masuk
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 50000,
    overtimeRatePerHour: 15000,
    description: 'Bantuan shift akhir pekan, event khusus & rush hours'
  }
];

export const DEFAULT_BARISTAS: Barista[] = [
  {
    id: 'barista-1',
    name: 'Dimas Pratama',
    nickname: 'Dimas',
    role: 'Head Barista',
    phone: '0812-3456-7890',
    color: 'amber',
    isActive: true,
    joinDate: '2024-02-01',
    monthlySalary: 3800000,
    positionAllowance: 500000,
    dailySalary: 25000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 200000,
    overtimeRatePerHour: 25000,
    notes: 'Penanggung jawab kalibrasi mesin espresso & inventaris bar.'
  },
  {
    id: 'barista-2',
    name: 'Siti Rahma',
    nickname: 'Rahma',
    role: 'Senior Barista',
    phone: '0821-9876-5432',
    color: 'emerald',
    isActive: true,
    joinDate: '2024-08-15',
    monthlySalary: 3200000,
    positionAllowance: 300000,
    dailySalary: 20000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 175000,
    overtimeRatePerHour: 22000,
    notes: 'Spesialis Latte Art & V60 Manual Brew.'
  },
  {
    id: 'barista-3',
    name: 'Bayu Wicaksono',
    nickname: 'Bayu',
    role: 'Barista',
    phone: '0857-1122-3344',
    color: 'sky',
    isActive: true,
    joinDate: '2025-03-01',
    monthlySalary: 2800000,
    positionAllowance: 150000,
    dailySalary: 20000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 150000,
    overtimeRatePerHour: 20000,
    notes: 'Speed brew & espresso based drinks.'
  },
  {
    id: 'barista-4',
    name: 'Fajar Nugroho',
    nickname: 'Fajar',
    role: 'Junior Barista',
    phone: '0813-9988-7766',
    color: 'violet',
    isActive: true,
    joinDate: '2025-09-10',
    monthlySalary: 2400000,
    positionAllowance: 100000,
    dailySalary: 15000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 120000,
    overtimeRatePerHour: 18000,
    notes: 'Mocktails, ice tea & prep bahan syrup.'
  },
  {
    id: 'barista-5',
    name: 'Anisa Putri',
    nickname: 'Anisa',
    role: 'Cashier / Bar',
    phone: '0878-1234-5678',
    color: 'rose',
    isActive: true,
    joinDate: '2025-05-20',
    monthlySalary: 2500000,
    positionAllowance: 150000,
    dailySalary: 20000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 125000,
    overtimeRatePerHour: 18000,
    notes: 'Kasir POS & bar support saat rush hour.'
  },
  {
    id: 'barista-6',
    name: 'Kevin Sanjaya',
    nickname: 'Kevin',
    role: 'Part Time',
    phone: '0896-1234-5678',
    color: 'teal',
    isActive: true,
    joinDate: '2026-01-15',
    monthlySalary: 0,
    positionAllowance: 0,
    dailySalary: 90000,
    annualIncreaseType: 'fixed',
    annualIncreaseValue: 50000,
    overtimeRatePerHour: 15000,
    notes: 'Jadwal shift akhir pekan & event.'
  }
];

export const DEFAULT_SHIFTS: ShiftMaster[] = [
  {
    id: 'shift-pagi',
    name: 'Shift Pagi (Opening)',
    shortCode: 'PAGI',
    startTime: '07:00',
    endTime: '15:00',
    durationHours: 8,
    color: 'emerald',
    isOff: false,
    description: 'Buka cafe, kalibrasi espresso grinder, prep ice & fresh milk.'
  },
  {
    id: 'shift-middle',
    name: 'Shift Middle (Siang-Sore)',
    shortCode: 'MID',
    startTime: '11:00',
    endTime: '19:00',
    durationHours: 8,
    color: 'sky',
    isOff: false,
    description: 'Menangani lonjakan order jam makan siang & sore.'
  },
  {
    id: 'shift-sore',
    name: 'Shift Sore (Closing)',
    shortCode: 'SORE',
    startTime: '15:00',
    endTime: '23:00',
    durationHours: 8,
    color: 'amber',
    isOff: false,
    description: 'Rush hour malam, closing kasir, backflush espresso & deep cleaning bar.'
  },
  {
    id: 'shift-malam',
    name: 'Shift Malam / Full Bar',
    shortCode: 'MLM',
    startTime: '18:00',
    endTime: '02:00',
    durationHours: 8,
    color: 'violet',
    isOff: false,
    description: 'Operasional malam hari & closing weekend.'
  },
  {
    id: 'shift-split',
    name: 'Shift Split (Pagi & Malam)',
    shortCode: 'SPLIT',
    startTime: '08:00',
    endTime: '20:00',
    durationHours: 8,
    color: 'indigo',
    isOff: false,
    description: '08:00-12:00 & 16:00-20:00 (Jeda istirahat 4 jam).'
  },
  {
    id: 'shift-off',
    name: 'Libur / Day Off',
    shortCode: 'OFF',
    startTime: '00:00',
    endTime: '00:00',
    durationHours: 0,
    color: 'slate',
    isOff: true,
    description: 'Jadwal istirahat / libur mingguan barista.'
  }
];

// Helper: Get formatted date string YYYY-MM-DD
export function formatToDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper: Calculate hours between two "HH:mm" strings
export function calculateDurationHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime || startTime === endTime) return 0;
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 8;

  let startMinutes = sH * 60 + sM;
  let endMinutes = eH * 60 + eM;

  if (endMinutes < startMinutes) {
    // Overnight shift (e.g. 18:00 to 02:00)
    endMinutes += 24 * 60;
  }

  const diffHours = (endMinutes - startMinutes) / 60;
  return Number(diffHours.toFixed(1));
}

// Helper: Get days in a target week starting Monday
export function getWeekDates(baseDate: Date): Date[] {
  const current = new Date(baseDate);
  const day = current.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day; // calculate diff to Monday
  
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push(d);
  }
  return week;
}

export const INDONESIAN_DAY_NAMES = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu'
];

export const INDONESIAN_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Color mapping for UI badges and cards
export const COLOR_THEMES: Record<string, {
  bg: string;
  text: string;
  border: string;
  badge: string;
  lightBg: string;
  ring: string;
}> = {
  emerald: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    lightBg: 'bg-emerald-50',
    ring: 'focus:ring-emerald-500'
  },
  sky: {
    bg: 'bg-sky-500',
    text: 'text-sky-700',
    border: 'border-sky-300',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    lightBg: 'bg-sky-50',
    ring: 'focus:ring-sky-500'
  },
  amber: {
    bg: 'bg-amber-500',
    text: 'text-amber-700',
    border: 'border-amber-300',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    lightBg: 'bg-amber-50',
    ring: 'focus:ring-amber-500'
  },
  violet: {
    bg: 'bg-violet-500',
    text: 'text-violet-700',
    border: 'border-violet-300',
    badge: 'bg-violet-100 text-violet-800 border-violet-300',
    lightBg: 'bg-violet-50',
    ring: 'focus:ring-violet-500'
  },
  rose: {
    bg: 'bg-rose-500',
    text: 'text-rose-700',
    border: 'border-rose-300',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    lightBg: 'bg-rose-50',
    ring: 'focus:ring-rose-500'
  },
  indigo: {
    bg: 'bg-indigo-500',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    lightBg: 'bg-indigo-50',
    ring: 'focus:ring-indigo-500'
  },
  teal: {
    bg: 'bg-teal-500',
    text: 'text-teal-700',
    border: 'border-teal-300',
    badge: 'bg-teal-100 text-teal-800 border-teal-300',
    lightBg: 'bg-teal-50',
    ring: 'focus:ring-teal-500'
  },
  orange: {
    bg: 'bg-orange-500',
    text: 'text-orange-700',
    border: 'border-orange-300',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    lightBg: 'bg-orange-50',
    ring: 'focus:ring-orange-500'
  },
  slate: {
    bg: 'bg-slate-400',
    text: 'text-slate-600',
    border: 'border-slate-300',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    lightBg: 'bg-slate-50',
    ring: 'focus:ring-slate-400'
  }
};

// Generate realistic initial sample schedules for the current week
export function generateSampleSchedules(weekDates: Date[], baristas: Barista[], shifts: ShiftMaster[]): BaristaScheduleEntry[] {
  const result: BaristaScheduleEntry[] = [];
  const shiftMap = {
    pagi: shifts.find(s => s.id === 'shift-pagi')?.id || 'shift-pagi',
    mid: shifts.find(s => s.id === 'shift-middle')?.id || 'shift-middle',
    sore: shifts.find(s => s.id === 'shift-sore')?.id || 'shift-sore',
    off: shifts.find(s => s.isOff)?.id || 'shift-off',
    mlm: shifts.find(s => s.id === 'shift-malam')?.id || 'shift-malam',
  };

  // Rotation pattern for 6 baristas across 7 days
  const patterns: Record<string, string[]> = {
    'barista-1': [shiftMap.pagi, shiftMap.pagi, shiftMap.pagi, shiftMap.mid, shiftMap.pagi, shiftMap.sore, shiftMap.off],
    'barista-2': [shiftMap.sore, shiftMap.sore, shiftMap.off, shiftMap.sore, shiftMap.sore, shiftMap.mid, shiftMap.pagi],
    'barista-3': [shiftMap.mid, shiftMap.mid, shiftMap.sore, shiftMap.off, shiftMap.mid, shiftMap.pagi, shiftMap.sore],
    'barista-4': [shiftMap.pagi, shiftMap.off, shiftMap.pagi, shiftMap.pagi, shiftMap.sore, shiftMap.sore, shiftMap.mid],
    'barista-5': [shiftMap.mid, shiftMap.pagi, shiftMap.mid, shiftMap.sore, shiftMap.off, shiftMap.mid, shiftMap.pagi],
    'barista-6': [shiftMap.off, shiftMap.off, shiftMap.off, shiftMap.off, shiftMap.sore, shiftMap.mlm, shiftMap.mlm],
  };

  baristas.forEach((barista) => {
    const pattern = patterns[barista.id] || [shiftMap.pagi, shiftMap.pagi, shiftMap.mid, shiftMap.sore, shiftMap.sore, shiftMap.off, shiftMap.off];
    weekDates.forEach((d, idx) => {
      const dateKey = formatToDateKey(d);
      const shiftId = pattern[idx % pattern.length] || shiftMap.pagi;
      const isOffShift = shiftId === shiftMap.off;
      result.push({
        id: `sched-${barista.id}-${dateKey}`,
        date: dateKey,
        baristaId: barista.id,
        shiftId: shiftId,
        status: isOffShift ? 'libur' : 'scheduled'
      });
    });
  });

  return result;
}

// =============================================================
// HELPER: PERHITUNGAN MASA KERJA DARI TANGGAL MULAI KERJA
// =============================================================
export function calculateServiceDuration(joinDateStr?: string, targetDate: Date = new Date()): {
  years: number;
  months: number;
  totalMonths: number;
  text: string;
} {
  if (!joinDateStr) {
    return { years: 0, months: 0, totalMonths: 0, text: 'Baru Bergabung' };
  }

  const joinDate = new Date(joinDateStr);
  if (isNaN(joinDate.getTime())) {
    return { years: 0, months: 0, totalMonths: 0, text: 'Baru Bergabung' };
  }

  let years = targetDate.getFullYear() - joinDate.getFullYear();
  let months = targetDate.getMonth() - joinDate.getMonth();
  
  if (targetDate.getDate() < joinDate.getDate()) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 0) {
    return { years: 0, months: 0, totalMonths: 0, text: '< 1 Bulan' };
  }

  const totalMonths = years * 12 + months;

  let text = '';
  if (years > 0 && months > 0) {
    text = `${years} Tahun ${months} Bulan`;
  } else if (years > 0) {
    text = `${years} Tahun`;
  } else if (months > 0) {
    text = `${months} Bulan`;
  } else {
    text = '< 1 Bulan';
  }

  return { years, months, totalMonths, text };
}

// =============================================================
// HELPER: TERBILANG RUPIAH DALAM BAHASA INDONESIA
// =============================================================
export function numberToIndonesianWords(num: number): string {
  if (num === 0) return 'Nol Rupiah';
  if (num < 0) return 'Minus ' + numberToIndonesianWords(Math.abs(num));

  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

  function convertSection(n: number): string {
    if (n === 0) return '';
    if (n < 12) return satuan[n] + ' ';
    if (n < 20) return convertSection(n - 10) + 'Belas ';
    if (n < 100) return satuan[Math.floor(n / 10)] + ' Puluh ' + convertSection(n % 10);
    if (n < 200) return 'Seratus ' + convertSection(n - 100);
    if (n < 1000) return satuan[Math.floor(n / 100)] + ' Ratus ' + convertSection(n % 100);
    if (n < 2000) return 'Seribu ' + convertSection(n - 1000);
    if (n < 1000000) return convertSection(Math.floor(n / 1000)) + 'Ribu ' + convertSection(n % 1000);
    if (n < 1000000000) return convertSection(Math.floor(n / 1000000)) + 'Juta ' + convertSection(n % 1000000);
    return convertSection(Math.floor(n / 1000000000)) + 'Miliar ' + convertSection(n % 1000000000);
  }

  const result = convertSection(Math.round(num)).trim().replace(/\s+/g, ' ') + ' Rupiah';
  return result;
}

// =============================================================
// HELPER: PERHITUNGAN GAJI TERINTEGRASI JADWAL MASUK HARIAN
// =============================================================
export function calculateBaristaPayroll(
  barista: Barista,
  schedules: BaristaScheduleEntry[],
  periodMonth: string, // YYYY-MM e.g. "2026-08"
  adjustment?: SalaryAdjustment,
  roleStandards: RoleSalaryStandard[] = DEFAULT_ROLE_SALARIES,
  shiftsMaster: ShiftMaster[] = DEFAULT_SHIFTS
): PayslipData {
  // Ambil standar role jika ada nilai yang belum diset di barista
  const standard = roleStandards.find(r => r.role === barista.role) || {
    role: barista.role,
    baseSalary: 2800000,
    positionAllowance: 150000,
    dailyAllowance: 20000,
    annualIncreaseType: 'fixed' as const,
    annualIncreaseValue: 150000,
    overtimeRatePerHour: 20000
  };

  const baseSalary = barista.monthlySalary !== undefined ? barista.monthlySalary : standard.baseSalary;
  const positionAllowance = barista.positionAllowance !== undefined ? barista.positionAllowance : standard.positionAllowance;
  const dailyAllowanceRate = barista.dailySalary !== undefined ? barista.dailySalary : standard.dailyAllowance;
  const annualIncreaseType = barista.annualIncreaseType || standard.annualIncreaseType || 'fixed';
  const annualIncreaseVal = barista.annualIncreaseValue !== undefined ? barista.annualIncreaseValue : standard.annualIncreaseValue;
  const overtimeRate = barista.overtimeRatePerHour !== undefined ? barista.overtimeRatePerHour : standard.overtimeRatePerHour;

  // Hitung masa kerja per tanggal akhir bulan periode
  const [yearStr, monthStr] = periodMonth.split('-');
  const pYear = parseInt(yearStr, 10) || new Date().getFullYear();
  const pMonth = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
  const endOfPeriodDate = new Date(pYear, pMonth, 0); // last day of month

  const service = calculateServiceDuration(barista.joinDate, endOfPeriodDate);

  // Kenaikan Gaji per Tahun Masa Kerja
  let annualIncreaseAmount = 0;
  if (service.years >= 1) {
    if (annualIncreaseType === 'percentage') {
      annualIncreaseAmount = Math.round((baseSalary * (annualIncreaseVal / 100)) * service.years);
    } else {
      annualIncreaseAmount = Math.round(annualIncreaseVal * service.years);
    }
  }

  // Filter jadwal shift barista pada periode bulan ini
  const monthPrefix = `${yearStr}-${String(pMonth).padStart(2, '0')}`;
  const baristaSchedules = schedules.filter(s => s.baristaId === barista.id && s.date.startsWith(monthPrefix));

  let totalDaysPresent = 0;
  let totalHoursWorked = 0;
  let totalOvertimeHours = adjustment?.overtimeHours || 0;
  let totalDaysOff = 0;
  let totalLeaveDays = 0;

  baristaSchedules.forEach(s => {
    const shift = shiftsMaster.find(sh => sh.id === s.shiftId);
    if (!shift) return;

    if (s.status === 'libur' || shift.isOff) {
      totalDaysOff++;
    } else if (s.status === 'izin' || s.status === 'sakit') {
      totalLeaveDays++;
    } else {
      // Hadir / Scheduled / Lembur
      totalDaysPresent++;
      
      let duration = 0;
      if (s.customStartTime && s.customEndTime) {
        duration = calculateDurationHours(s.customStartTime, s.customEndTime);
      } else {
        duration = shift.durationHours || 8;
      }
      totalHoursWorked += duration;

      if (s.status === 'lembur') {
        totalOvertimeHours += Math.max(0, duration - 8);
      }
    }
  });

  // Uang Kehadiran Harian / Shift (misal Part Time dibayar per shift, Full Time uang makan/transport per hadir)
  const attendanceAllowance = totalDaysPresent * dailyAllowanceRate;

  // Upah Lembur
  const overtimePay = Math.round(totalOvertimeHours * overtimeRate);

  // Bonus & Potongan
  const bonus = adjustment?.bonus || 0;
  const deductions = adjustment?.deductions || 0;

  const totalEarnings = baseSalary + positionAllowance + annualIncreaseAmount + attendanceAllowance + overtimePay + bonus;
  const totalDeductions = deductions;
  const netSalary = Math.max(0, totalEarnings - totalDeductions);

  const monthNamesId = INDONESIAN_MONTH_NAMES;
  const periodLabel = `${monthNamesId[pMonth - 1] || 'Bulan'} ${pYear}`;
  const slipNumber = `BC-SLIP/${pYear}/${String(pMonth).padStart(2, '0')}/${barista.id.replace(/[^0-9]/g, '').slice(-3) || '01'}`;

  return {
    id: `payslip-${barista.id}-${periodMonth}`,
    slipNumber,
    baristaId: barista.id,
    baristaName: barista.name,
    baristaNickname: barista.nickname,
    role: barista.role,
    phone: barista.phone,
    joinDate: barista.joinDate || '-',
    periodMonth,
    periodLabel,
    generationDate: formatToDateKey(new Date()),
    yearsOfService: service.years,
    monthsOfService: service.months,
    serviceDurationText: service.text,
    totalShiftsScheduled: baristaSchedules.length,
    totalDaysPresent,
    totalHoursWorked,
    totalOvertimeHours,
    totalDaysOff,
    totalLeaveDays,
    baseSalary,
    positionAllowance,
    annualIncreaseAmount,
    attendanceAllowance,
    overtimePay,
    bonus,
    bonusNotes: adjustment?.bonusNotes,
    totalEarnings,
    deductions,
    deductionNotes: adjustment?.deductionNotes,
    totalDeductions,
    netSalary,
    terbilangText: numberToIndonesianWords(netSalary)
  };
}

// =============================================================
// HELPER: EXPORT SLIP GAJI BERUPA GAMBAR HIGH-DPI (2D CANVAS)
// =============================================================
export function generatePayslipImage(payslip: PayslipData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const dpr = 2; // High-DPI Sharpness
      const width = 840;
      const height = 1180; // Standard aesthetic slip receipt format

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // 1. Background (Clean Crisp White Paper with subtle border)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Outer Paper Border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16, 16, width - 32, height - 32);

      // Inner Accent Border
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // 2. Header Bar (Dark Slate & Amber Gold Accent)
      const grad = ctx.createLinearGradient(20, 20, width - 20, 20);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.6, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(20, 20, width - 40, 110);

      // Gold Strip
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(20, 128, width - 40, 3);

      // Brand Logo & Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('BASCO COFFEE', 48, 62);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('SLIP GAJI RESMI KARYAWAN & BARISTA', 48, 84);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Cafe & Roastery Management System', 48, 104);

      // Right Header Info: Period & Slip No
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Periode: ${payslip.periodLabel}`, width - 48, 62);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11.5px monospace';
      ctx.fillText(`No: ${payslip.slipNumber}`, width - 48, 84);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Cetak: ${payslip.generationDate}`, width - 48, 104);
      ctx.textAlign = 'left';

      // 3. Employee Info Card
      const infoY = 146;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(36, infoY, width - 72, 106);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(36, infoY, width - 72, 106);

      // Left Column
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('NAMA KARYAWAN', 52, infoY + 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(payslip.baristaName, 52, infoY + 44);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('JABATAN / ROLE', 52, infoY + 68);
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(payslip.role, 52, infoY + 88);

      // Middle Column: Join Date & Masa Kerja
      const col2X = 330;
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('TANGGAL MULAI KERJA', col2X, infoY + 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12.5px monospace';
      ctx.fillText(payslip.joinDate, col2X, infoY + 44);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('MASA KERJA (PENGALAMAN)', col2X, infoY + 68);
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(payslip.serviceDurationText, col2X, infoY + 88);

      // Right Column: Kehadiran Masuk
      const col3X = 580;
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('REKAP KEHADIRAN SHIFT', col3X, infoY + 24);
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${payslip.totalDaysPresent} Masuk / ${payslip.totalHoursWorked} Jam`, col3X, infoY + 44);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('LEMBUR / LIBUR / IZIN', col3X, infoY + 68);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${payslip.totalOvertimeHours}j Lembur • ${payslip.totalDaysOff} Libur • ${payslip.totalLeaveDays} Izin`, col3X, infoY + 88);

      // 4. Breakdown Table (Earnings vs Deductions)
      const tableY = 270;
      const colWidth = (width - 72 - 16) / 2; // Two equal side-by-side columns
      const leftColX = 36;
      const rightColX = leftColX + colWidth + 16;

      // --- PENGHASILAN (EARNINGS) ---
      ctx.fillStyle = '#047857';
      ctx.fillRect(leftColX, tableY, colWidth, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('PENGHASILAN (EARNINGS)', leftColX + 14, tableY + 21);

      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(leftColX, tableY, colWidth, 300);

      const earningsItems = [
        { label: 'Gaji Pokok Jabatan', val: payslip.baseSalary, sub: payslip.role },
        { label: 'Tunjangan Jabatan', val: payslip.positionAllowance, sub: 'Tunjangan fungsional' },
        { 
          label: `Kenaikan Gaji Masa Kerja`, 
          val: payslip.annualIncreaseAmount, 
          sub: payslip.yearsOfService > 0 ? `${payslip.yearsOfService} Thn Masa Kerja` : 'Belum 1 tahun' 
        },
        { 
          label: `Uang Kehadiran / Makan`, 
          val: payslip.attendanceAllowance, 
          sub: `${payslip.totalDaysPresent} Shift masuk harian` 
        },
        { 
          label: `Upah Lembur`, 
          val: payslip.overtimePay, 
          sub: `${payslip.totalOvertimeHours} Jam lembur` 
        },
        { 
          label: 'Bonus / Insentif Performa', 
          val: payslip.bonus, 
          sub: payslip.bonusNotes || 'Insentif cafe' 
        },
      ];

      let rowY = tableY + 54;
      earningsItems.forEach((item, idx) => {
        if (idx % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(leftColX + 1, rowY - 16, colWidth - 2, 40);
        }

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(item.label, leftColX + 14, rowY);

        ctx.fillStyle = '#64748b';
        ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(item.sub, leftColX + 14, rowY + 14);

        ctx.textAlign = 'right';
        ctx.fillStyle = item.val > 0 ? '#0f172a' : '#94a3b8';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`Rp ${item.val.toLocaleString('id-ID')}`, leftColX + colWidth - 14, rowY + 6);
        ctx.textAlign = 'left';

        rowY += 42;
      });

      // Total Earnings Footer
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(leftColX, tableY + 300 - 36, colWidth, 36);
      ctx.strokeStyle = '#a7f3d0';
      ctx.strokeRect(leftColX, tableY + 300 - 36, colWidth, 36);

      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('TOTAL PENGHASILAN', leftColX + 14, tableY + 300 - 14);

      ctx.textAlign = 'right';
      ctx.font = 'bold 13.5px monospace';
      ctx.fillText(`Rp ${payslip.totalEarnings.toLocaleString('id-ID')}`, leftColX + colWidth - 14, tableY + 300 - 14);
      ctx.textAlign = 'left';

      // --- POTONGAN (DEDUCTIONS) ---
      ctx.fillStyle = '#be123c';
      ctx.fillRect(rightColX, tableY, colWidth, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('POTONGAN (DEDUCTIONS)', rightColX + 14, tableY + 21);

      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(rightColX, tableY, colWidth, 300);

      const deductionItems = [
        { label: 'Potongan Kasbon / Pinjaman', val: payslip.deductions, sub: payslip.deductionNotes || 'Kasbon karyawan' },
        { label: 'Potongan Keterlambatan / Izin', val: 0, sub: 'Potongan kehadiran' },
        { label: 'BPJS Ketenagakerjaan / Asuransi', val: 0, sub: 'Jaminan sosial' },
        { label: 'Potongan Lain-lain', val: 0, sub: '-' },
      ];

      rowY = tableY + 54;
      deductionItems.forEach((item, idx) => {
        if (idx % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(rightColX + 1, rowY - 16, colWidth - 2, 40);
        }

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(item.label, rightColX + 14, rowY);

        ctx.fillStyle = '#64748b';
        ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(item.sub, rightColX + 14, rowY + 14);

        ctx.textAlign = 'right';
        ctx.fillStyle = item.val > 0 ? '#be123c' : '#94a3b8';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`Rp ${item.val.toLocaleString('id-ID')}`, rightColX + colWidth - 14, rowY + 6);
        ctx.textAlign = 'left';

        rowY += 42;
      });

      // Total Deductions Footer
      ctx.fillStyle = '#fff1f2';
      ctx.fillRect(rightColX, tableY + 300 - 36, colWidth, 36);
      ctx.strokeStyle = '#fecdd3';
      ctx.strokeRect(rightColX, tableY + 300 - 36, colWidth, 36);

      ctx.fillStyle = '#9f1239';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('TOTAL POTONGAN', rightColX + 14, tableY + 300 - 14);

      ctx.textAlign = 'right';
      ctx.font = 'bold 13.5px monospace';
      ctx.fillText(`Rp ${payslip.totalDeductions.toLocaleString('id-ID')}`, rightColX + colWidth - 14, tableY + 300 - 14);
      ctx.textAlign = 'left';

      // 5. Grand Total (Take Home Pay) Box
      const netY = tableY + 320;
      const gradNet = ctx.createLinearGradient(36, netY, width - 36, netY);
      gradNet.addColorStop(0, '#0f172a');
      gradNet.addColorStop(0.5, '#1e293b');
      gradNet.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradNet;
      ctx.fillRect(36, netY, width - 72, 100);

      // Gold Accent outline
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(36, netY, width - 72, 100);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('GAJI BERSIH DITERIMA (TAKE HOME PAY)', 56, netY + 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const netStr = `Rp ${payslip.netSalary.toLocaleString('id-ID')}`;
      ctx.fillText(netStr, 56, netY + 76);

      // Terbilang
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Terbilang:', width - 56, netY + 36);

      ctx.fillStyle = '#fef08a';
      ctx.font = 'italic bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const terbilangStr = `"${payslip.terbilangText}"`;
      ctx.fillText(terbilangStr, width - 56, netY + 64);
      ctx.textAlign = 'left';

      // 6. Signatures Area
      const signY = netY + 124;
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Diterima Oleh,', 100, signY);
      ctx.fillText('Disetujui / Manajemen,', width - 240, signY);

      // Signature lines
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(70, signY + 76);
      ctx.lineTo(210, signY + 76);
      ctx.moveTo(width - 270, signY + 76);
      ctx.lineTo(width - 130, signY + 76);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(payslip.baristaName, 70, signY + 94);
      ctx.fillText('Basco Coffee Roastery', width - 270, signY + 94);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(payslip.role, 70, signY + 108);
      ctx.fillText('Store Manager / Owner', width - 270, signY + 108);

      // Footer note
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Dokumen ini digenerate secara otomatis oleh Basco Coffee Cashflow & Roster Management System.', width / 2, height - 32);

      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    } catch (err) {
      reject(err);
    }
  });
}

