import { DebtItem, DebtCategory, DebtType } from '../types';
import { Transaction } from '../types';
import { parseDateString } from '../utils';

export const DEBT_STORAGE_KEY = 'aruskas_debt_records';

export const CATEGORY_LABELS: Record<DebtCategory, { label: string; color: string; bg: string }> = {
  equipment: { label: 'Mesin & Peralatan', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  renovation: { label: 'Renovasi & Tempat', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  working_capital: { label: 'Modal Kerja', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  supplier: { label: 'Hutang Supplier', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  bank_loan: { label: 'Pinjaman Bank / KUR', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  other: { label: 'Lainnya', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
};

export const DEBT_TYPE_LABELS: Record<DebtType, { label: string; short: string }> = {
  monthly: { label: 'Cicilan Bulanan (Monthly)', short: 'Bulanan' },
  annual: { label: 'Beban Tahunan (Annual)', short: 'Tahunan' },
  lump_sum: { label: 'Pelunasan Sekaligus (Tempo)', short: 'Tempo' },
};

// Realistic Initial Sample Debts for Basco Coffee Cafe
export const DEFAULT_DEBTS: DebtItem[] = [
  {
    id: 'debt-1',
    name: 'Cicilan Mesin Espresso La Marzocco Linea Mini',
    lenderName: 'Leasing F&B / Bank Mandiri',
    category: 'equipment',
    debtType: 'monthly',
    principalAmount: 36000000,
    remainingAmount: 22500000,
    monthlyInstallment: 1500000,
    annualInstallment: 18000000,
    tenorMonths: 24,
    paidMonths: 9,
    dueDayOfMonth: 5,
    nextDueDate: '2026-10-05',
    startDate: '2025-10-05',
    endDate: '2027-10-05',
    status: 'active',
    notes: 'Jaminan BPKB & Invoice Mesin. Autodebet tanggal 5 setiap bulan.',
    paymentLogs: [
      { id: 'log-1', paymentDate: '2026-08-05', amountPaid: 1500000, periodLabel: 'Cicilan Bulan Agustus 2026', createdAt: '2026-08-05T10:00:00Z' },
      { id: 'log-2', paymentDate: '2026-09-05', amountPaid: 1500000, periodLabel: 'Cicilan Bulan September 2026', createdAt: '2026-09-05T10:00:00Z' }
    ],
    createdAt: '2025-10-05T08:00:00Z',
    updatedAt: '2026-09-05T10:00:00Z'
  },
  {
    id: 'debt-2',
    name: 'Pembiayaan Renovasi Slow Bar & Interior Cafe',
    lenderName: 'Bank BRI (Kredit Usaha Rakyat)',
    category: 'renovation',
    debtType: 'monthly',
    principalAmount: 24000000,
    remainingAmount: 12000000,
    monthlyInstallment: 2000000,
    annualInstallment: 24000000,
    tenorMonths: 12,
    paidMonths: 6,
    dueDayOfMonth: 15,
    nextDueDate: '2026-10-15',
    startDate: '2026-03-15',
    endDate: '2027-03-15',
    status: 'active',
    notes: 'Bunga subsidi KUR 6% flat. Pembayaran via transfer VA BRI.',
    paymentLogs: [
      { id: 'log-3', paymentDate: '2026-08-15', amountPaid: 2000000, periodLabel: 'Cicilan Bulan Agustus 2026', createdAt: '2026-08-15T09:00:00Z' },
      { id: 'log-4', paymentDate: '2026-09-15', amountPaid: 2000000, periodLabel: 'Cicilan Bulan September 2026', createdAt: '2026-09-15T09:00:00Z' }
    ],
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-09-15T09:00:00Z'
  },
  {
    id: 'debt-3',
    name: 'Tagihan Tempo Pembelian Biji Kopi Blend & Sirup 50kg',
    lenderName: 'PT Roastery Kopi Nusantara',
    category: 'supplier',
    debtType: 'monthly',
    principalAmount: 7500000,
    remainingAmount: 2500000,
    monthlyInstallment: 2500000,
    annualInstallment: 7500000,
    tenorMonths: 3,
    paidMonths: 2,
    dueDayOfMonth: 28,
    nextDueDate: '2026-09-28',
    startDate: '2026-07-28',
    endDate: '2026-10-28',
    status: 'active',
    notes: 'Jatuh tempo akhir bulan. Sisa 1 kali pembayaran angsuran terakhir.',
    paymentLogs: [
      { id: 'log-5', paymentDate: '2026-07-28', amountPaid: 2500000, periodLabel: 'Pembayaran DP / Angsuran 1', createdAt: '2026-07-28T14:00:00Z' },
      { id: 'log-6', paymentDate: '2026-08-28', amountPaid: 2500000, periodLabel: 'Angsuran 2 Agustus', createdAt: '2026-08-28T14:00:00Z' }
    ],
    createdAt: '2026-07-28T14:00:00Z',
    updatedAt: '2026-08-28T14:00:00Z'
  }
];

export function getStoredDebts(): DebtItem[] {
  try {
    const saved = localStorage.getItem(DEBT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (d: any) => d && d.id !== 'debt-1' && d.id !== 'debt-2' && d.id !== 'debt-3'
        );
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Error reading stored debts:', err);
  }
  return [];
}

export function saveStoredDebts(debts: DebtItem[]): void {
  try {
    const cleaned = (debts || []).filter(
      (d: any) => d && d.id !== 'debt-1' && d.id !== 'debt-2' && d.id !== 'debt-3'
    );
    localStorage.setItem(DEBT_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.error('Error saving debts to localStorage:', err);
  }
}

export interface DueDateStatus {
  status: 'overdue' | 'due_today' | 'due_soon' | 'safe';
  daysLeft: number;
  daysUntilDue: number;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

/**
 * Calculates due date proximity relative to today
 */
export function getDueDateStatus(debt: DebtItem, referenceDate: Date = new Date()): DueDateStatus {
  if (debt.status === 'paid_off') {
    return {
      status: 'safe',
      daysLeft: 999,
      daysUntilDue: 999,
      label: 'Lunas',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200'
    };
  }

  // Parse nextDueDate or construct from dueDayOfMonth
  let targetDate: Date;
  if (debt.nextDueDate) {
    const parts = debt.nextDueDate.split('-');
    if (parts.length === 3) {
      targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      targetDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), debt.dueDayOfMonth);
    }
  } else {
    targetDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), debt.dueDayOfMonth);
  }

  // Normalize both dates to midnight
  const refMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const diffTime = targetMidnight.getTime() - refMidnight.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      status: 'overdue',
      daysLeft,
      daysUntilDue: daysLeft,
      label: `Lewat ${Math.abs(daysLeft)} hari!`,
      badgeBg: 'bg-rose-100',
      badgeText: 'text-rose-800',
      badgeBorder: 'border-rose-300'
    };
  } else if (daysLeft === 0) {
    return {
      status: 'due_today',
      daysLeft: 0,
      daysUntilDue: 0,
      label: 'Jatuh Tempo Hari Ini!',
      badgeBg: 'bg-rose-600',
      badgeText: 'text-white font-black animate-pulse',
      badgeBorder: 'border-rose-600'
    };
  } else if (daysLeft <= 3) {
    return {
      status: 'due_soon',
      daysLeft,
      daysUntilDue: daysLeft,
      label: `${daysLeft} hari lagi! (Mendesak)`,
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-900 font-extrabold',
      badgeBorder: 'border-amber-300'
    };
  } else if (daysLeft <= 7) {
    return {
      status: 'due_soon',
      daysLeft,
      daysUntilDue: daysLeft,
      label: `${daysLeft} hari lagi`,
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-200'
    };
  } else {
    return {
      status: 'safe',
      daysLeft,
      daysUntilDue: daysLeft,
      label: `${daysLeft} hari lagi`,
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-700',
      badgeBorder: 'border-slate-200'
    };
  }
}

export interface DebtFinancialMetrics {
  totalPrincipal: number;
  totalRemaining: number;
  totalPaid: number;
  overallProgressPct: number;
  
  // Installment Aggregations
  totalMonthlyInstallment: number;
  totalAnnualInstallment: number;
  activeCount: number;
  paidOffCount: number;
  
  // Proximity alerts
  overdueCount: number;
  dueSoonCount: number; // <= 7 days
  upcomingPaymentThisMonth: number; // Amount needed for pending payments this month
  
  // AI Automation & Health Indicators based on Real Cafe Data
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyNetProfit: number;
  netProfitMargin: number;
  cashBalance: number;
  
  // Risk & Health Formulae
  dscr: number; // Debt Service Coverage Ratio: Net Profit / Monthly Debt Installment
  debtToRevenueRatio: number; // Monthly Debt / Monthly Revenue (%)
  freeCashFlowAfterDebt: number; // Net Profit - Monthly Debt
  
  // AI Status Assessment
  safetyStatus: 'safe' | 'caution' | 'danger';
  safetyLabel: string;
  safetyReason: string;
  maxSafeBorrowingMonthly: number; // Max additional installment safe to take
}

/**
 * Calculates comprehensive financial health and debt risk metrics based on transactions and debts
 */
export function calculateDebtFinancialMetrics(
  debts: DebtItem[], 
  transactions: Transaction[]
): DebtFinancialMetrics {
  let totalPrincipal = 0;
  let totalRemaining = 0;
  let totalMonthlyInstallment = 0;
  let totalAnnualInstallment = 0;
  let activeCount = 0;
  let paidOffCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let upcomingPaymentThisMonth = 0;

  const now = new Date();

  debts.forEach(d => {
    totalPrincipal += d.principalAmount || 0;
    totalRemaining += d.remainingAmount || 0;

    if (d.status === 'active') {
      activeCount++;
      const monthly = d.monthlyInstallment || 0;
      totalMonthlyInstallment += monthly;
      totalAnnualInstallment += (d.annualInstallment || (monthly * 12));

      const dueStatus = getDueDateStatus(d, now);
      if (dueStatus.status === 'overdue') {
        overdueCount++;
        upcomingPaymentThisMonth += monthly;
      } else if (dueStatus.status === 'due_today' || dueStatus.status === 'due_soon') {
        dueSoonCount++;
        upcomingPaymentThisMonth += monthly;
      } else {
        // Still due this cycle if not paid yet
        upcomingPaymentThisMonth += monthly;
      }
    } else {
      paidOffCount++;
    }
  });

  const totalPaid = Math.max(0, totalPrincipal - totalRemaining);
  const overallProgressPct = totalPrincipal > 0 
    ? Math.min(100, Math.round((totalPaid / totalPrincipal) * 1000) / 10) 
    : 100;

  // Extract monthly financial performance from real transactions
  // Group transactions by month to find representative monthly average
  const monthlyBuckets: Record<string, { debit: number; kredit: number }> = {};

  transactions.forEach(t => {
    if (!t.tanggal) return;
    const d = parseDateString(t.tanggal);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyBuckets[key]) {
      monthlyBuckets[key] = { debit: 0, kredit: 0 };
    }
    monthlyBuckets[key].debit += (Number(t.debit) || 0);
    monthlyBuckets[key].kredit += ((Number(t.kredit) || 0) + (Number(t.kredit2) || 0));
  });

  const monthKeys = Object.keys(monthlyBuckets);
  let avgRevenue = 0;
  let avgExpenses = 0;
  let avgNetProfit = 0;

  if (monthKeys.length > 0) {
    const sumRev = monthKeys.reduce((acc, k) => acc + monthlyBuckets[k].debit, 0);
    const sumExp = monthKeys.reduce((acc, k) => acc + monthlyBuckets[k].kredit, 0);
    avgRevenue = Math.round(sumRev / monthKeys.length);
    avgExpenses = Math.round(sumExp / monthKeys.length);
    avgNetProfit = avgRevenue - avgExpenses;
  } else {
    // Fallback based on transactions direct sum if no dates parsed
    const totalDebit = transactions.reduce((acc, t) => acc + (Number(t.debit) || 0), 0);
    const totalKredit = transactions.reduce((acc, t) => acc + ((Number(t.kredit) || 0) + (Number(t.kredit2) || 0)), 0);
    avgRevenue = totalDebit;
    avgExpenses = totalKredit;
    avgNetProfit = totalDebit - totalKredit;
  }

  const netProfitMargin = avgRevenue > 0 ? Math.round((avgNetProfit / avgRevenue) * 1000) / 10 : 0;
  
  // Total cumulative cash balance
  const cashBalance = transactions.reduce((sum, t) => {
    const deb = Number(t.debit) || 0;
    const kre = (Number(t.kredit) || 0) + (Number(t.kredit2) || 0);
    return sum + deb - kre;
  }, 0);

  // Financial ratios:
  // DSCR (Debt Service Coverage Ratio) = Net Profit / Total Monthly Debt Installment
  let dscr = 0;
  if (totalMonthlyInstallment <= 0) {
    dscr = avgNetProfit > 0 ? 99.9 : 0;
  } else if (avgNetProfit <= 0) {
    dscr = 0;
  } else {
    dscr = Math.round((avgNetProfit / totalMonthlyInstallment) * 100) / 100;
  }

  // Debt to Revenue Ratio (%)
  const debtToRevenueRatio = avgRevenue > 0 
    ? Math.round((totalMonthlyInstallment / avgRevenue) * 1000) / 10 
    : 0;

  const freeCashFlowAfterDebt = avgNetProfit - totalMonthlyInstallment;

  // Maximum safe monthly borrowing capacity (standard F&B guideline: max 30% of net profit or max 15% of revenue allocated to total debt)
  const maxAllowableTotalMonthlyDebt = Math.max(0, Math.min(avgNetProfit * 0.35, avgRevenue * 0.15));
  const maxSafeBorrowingMonthly = Math.max(0, Math.round(maxAllowableTotalMonthlyDebt - totalMonthlyInstallment));

  // Determine Safety Status:
  let safetyStatus: 'safe' | 'caution' | 'danger' = 'safe';
  let safetyLabel = 'Zona Aman (Aman Berhutang)';
  let safetyReason = 'Laba bersih bulanan dan arus kas sangat memadai untuk menutup seluruh cicilan hutang dengan buffer yang kuat.';

  if (avgNetProfit <= 0) {
    safetyStatus = 'danger';
    safetyLabel = 'Zona Bahaya (Sangat Tidak Dianjurkan)';
    safetyReason = 'Bisnis saat ini mengalami defisit operasional. Menambah atau mempertahankan hutang berisiko gagal bayar dan menggerus modal harian.';
  } else if (dscr < 1.0) {
    safetyStatus = 'danger';
    safetyLabel = 'Zona Bahaya (Beban Hutang Melebihi Laba)';
    safetyReason = `Total cicilan bulanan (Rp ${totalMonthlyInstallment.toLocaleString('id-ID')}) lebih besar dari laba bersih bulanan (Rp ${avgNetProfit.toLocaleString('id-ID')}). Rasio DSCR (${dscr}x) berada di bawah 1.0x.`;
  } else if (dscr < 1.4 || debtToRevenueRatio > 18) {
    safetyStatus = 'caution';
    safetyLabel = 'Zona Waspada (Perlu Kehati-hatian Tinggi)';
    safetyReason = `Cicilan bulanan memakan ${Math.round((totalMonthlyInstallment / avgNetProfit) * 100)}% dari laba bersih. Ruang kas untuk biaya tak terduga sangat ketat jika terjadi penurunan omset.`;
  } else {
    safetyStatus = 'safe';
    safetyLabel = 'Zona Aman (Kapasitas Pembayaran Kuat)';
    safetyReason = `Laba bersih kafe (Rp ${avgNetProfit.toLocaleString('id-ID')}) mencakup ${dscr}x lipat dari total cicilan bulanan (Rp ${totalMonthlyInstallment.toLocaleString('id-ID')}). Beban hutang hanya ${debtToRevenueRatio}% dari omset.`;
  }

  return {
    totalPrincipal,
    totalRemaining,
    totalPaid,
    overallProgressPct,
    totalMonthlyInstallment,
    totalAnnualInstallment,
    activeCount,
    paidOffCount,
    overdueCount,
    dueSoonCount,
    upcomingPaymentThisMonth,
    monthlyRevenue: avgRevenue,
    monthlyExpenses: avgExpenses,
    monthlyNetProfit: avgNetProfit,
    netProfitMargin,
    cashBalance,
    dscr,
    debtToRevenueRatio,
    freeCashFlowAfterDebt,
    safetyStatus,
    safetyLabel,
    safetyReason,
    maxSafeBorrowingMonthly
  };
}
