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

// Real Initial Debts for Basco Coffee Cafe (Synced with "Pencatatan Hutang" Sheet)
export const DEFAULT_DEBTS: DebtItem[] = [
  {
    id: 'debt-basco-1',
    name: 'Kreamer',
    lenderName: 'Spaylater Iza',
    category: 'supplier',
    debtType: 'lump_sum',
    principalAmount: 195000,
    remainingAmount: 195000,
    monthlyInstallment: 195000,
    annualInstallment: 2340000,
    tenorMonths: 1,
    paidMonths: 0,
    dueDayOfMonth: 25,
    nextDueDate: '2026-11-25',
    startDate: '2026-10-25',
    status: 'active',
    notes: '',
    paymentLogs: [],
    createdAt: '2026-10-25T08:00:00Z',
    updatedAt: '2026-10-25T08:00:00Z',
  },
  {
    id: 'debt-basco-2',
    name: 'Kontainer Kecil',
    lenderName: 'Spaylater Iza',
    category: 'equipment',
    debtType: 'monthly',
    principalAmount: 65000,
    remainingAmount: 65000,
    monthlyInstallment: 65000,
    annualInstallment: 780000,
    tenorMonths: 1,
    paidMonths: 0,
    dueDayOfMonth: 25,
    nextDueDate: '2026-11-25',
    startDate: '2026-10-25',
    status: 'active',
    notes: '',
    paymentLogs: [],
    createdAt: '2026-10-25T08:05:00Z',
    updatedAt: '2026-10-25T08:05:00Z',
  },
  {
    id: 'debt-basco-3',
    name: 'Kontainer Hitam',
    lenderName: 'Spaylater',
    category: 'equipment',
    debtType: 'monthly',
    principalAmount: 205000,
    remainingAmount: 205000,
    monthlyInstallment: 205000,
    annualInstallment: 2460000,
    tenorMonths: 1,
    paidMonths: 0,
    dueDayOfMonth: 25,
    nextDueDate: '2026-11-25',
    startDate: '2026-10-25',
    status: 'active',
    notes: '',
    paymentLogs: [],
    createdAt: '2026-10-25T08:10:00Z',
    updatedAt: '2026-10-25T08:10:00Z',
  },
  {
    id: 'debt-basco-4',
    name: 'TBM',
    lenderName: 'Spaylater',
    category: 'supplier',
    debtType: 'lump_sum',
    principalAmount: 205000,
    remainingAmount: 205000,
    monthlyInstallment: 205000,
    annualInstallment: 2460000,
    tenorMonths: 1,
    paidMonths: 0,
    dueDayOfMonth: 5,
    nextDueDate: '2026-11-05',
    startDate: '2026-10-16',
    status: 'active',
    notes: '',
    paymentLogs: [],
    createdAt: '2026-10-16T08:00:00Z',
    updatedAt: '2026-10-16T08:00:00Z',
  },
  {
    id: 'debt-basco-5',
    name: 'Tempat Wijen',
    lenderName: 'Shopee',
    category: 'equipment',
    debtType: 'monthly',
    principalAmount: 283000,
    remainingAmount: 190000,
    monthlyInstallment: 95000,
    annualInstallment: 1140000,
    tenorMonths: 3,
    paidMonths: 1,
    dueDayOfMonth: 25,
    nextDueDate: '2026-11-25',
    startDate: '2026-10-25',
    status: 'active',
    notes: '',
    paymentLogs: [
      {
        id: 'log-tw-1',
        paymentDate: '2026-10-25',
        amountPaid: 93000,
        periodLabel: 'Angsuran 1',
        createdAt: '2026-10-25T10:00:00Z',
      },
    ],
    createdAt: '2026-10-25T08:15:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  },
  {
    id: 'debt-basco-6',
    name: 'Mesin Susu',
    lenderName: 'Spaylater',
    category: 'equipment',
    debtType: 'monthly',
    principalAmount: 190000,
    remainingAmount: 125000,
    monthlyInstallment: 65000,
    annualInstallment: 780000,
    tenorMonths: 3,
    paidMonths: 1,
    dueDayOfMonth: 25,
    nextDueDate: '2026-11-25',
    startDate: '2026-10-25',
    status: 'active',
    notes: '',
    paymentLogs: [
      {
        id: 'log-ms-1',
        paymentDate: '2026-10-25',
        amountPaid: 65000,
        periodLabel: 'Angsuran 1',
        createdAt: '2026-10-25T10:05:00Z',
      },
    ],
    createdAt: '2026-10-25T08:20:00Z',
    updatedAt: '2026-10-25T10:05:00Z',
  },
  {
    id: 'debt-basco-7',
    name: 'Lamina',
    lenderName: 'Spaylater',
    category: 'working_capital',
    debtType: 'monthly',
    principalAmount: 3495000,
    remainingAmount: 3495000,
    monthlyInstallment: 295000,
    annualInstallment: 3540000,
    tenorMonths: 12,
    paidMonths: 0,
    dueDayOfMonth: 5,
    nextDueDate: '2026-11-05',
    startDate: '2026-10-05',
    status: 'active',
    notes: '',
    paymentLogs: [],
    createdAt: '2026-10-05T08:00:00Z',
    updatedAt: '2026-10-05T08:00:00Z',
  },
  {
    id: 'debt-basco-8',
    name: 'Spinjam Anggie',
    lenderName: 'Shopee',
    category: 'working_capital',
    debtType: 'monthly',
    principalAmount: 4960000,
    remainingAmount: 4340000,
    monthlyInstallment: 620000,
    annualInstallment: 7440000,
    tenorMonths: 8,
    paidMonths: 1,
    dueDayOfMonth: 5,
    nextDueDate: '2026-11-05',
    startDate: '2026-10-05',
    status: 'active',
    notes: '',
    paymentLogs: [
      {
        id: 'log-sa-1',
        paymentDate: '2026-10-05',
        amountPaid: 620000,
        periodLabel: 'Angsuran 1',
        createdAt: '2026-10-05T10:00:00Z',
      },
    ],
    createdAt: '2026-10-05T08:10:00Z',
    updatedAt: '2026-10-05T10:00:00Z',
  },
  {
    id: 'debt-basco-9',
    name: 'Mangkok Matcha',
    lenderName: 'Shopee',
    category: 'equipment',
    debtType: 'monthly',
    principalAmount: 195000,
    remainingAmount: 65000,
    monthlyInstallment: 65000,
    annualInstallment: 780000,
    tenorMonths: 3,
    paidMonths: 2,
    dueDayOfMonth: 25,
    nextDueDate: '2026-11-25',
    startDate: '2026-08-25',
    status: 'active',
    notes: '',
    paymentLogs: [
      {
        id: 'log-mm-1',
        paymentDate: '2026-09-25',
        amountPaid: 65000,
        periodLabel: 'Angsuran 1',
        createdAt: '2026-09-25T10:00:00Z',
      },
      {
        id: 'log-mm-2',
        paymentDate: '2026-10-25',
        amountPaid: 65000,
        periodLabel: 'Angsuran 2',
        createdAt: '2026-10-25T10:00:00Z',
      },
    ],
    createdAt: '2026-08-25T08:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  },
  {
    id: 'debt-basco-10',
    name: 'KUR Anggie',
    lenderName: 'Bank BRI',
    category: 'bank_loan',
    debtType: 'monthly',
    principalAmount: 20000000,
    remainingAmount: 17300000,
    monthlyInstallment: 900000,
    annualInstallment: 10800000,
    tenorMonths: 24,
    paidMonths: 3,
    dueDayOfMonth: 25,
    nextDueDate: '2026-11-25',
    startDate: '2026-08-25',
    status: 'active',
    notes: '',
    paymentLogs: [
      {
        id: 'log-ka-1',
        paymentDate: '2026-08-25',
        amountPaid: 900000,
        periodLabel: 'Angsuran 1',
        createdAt: '2026-08-25T10:00:00Z',
      },
      {
        id: 'log-ka-2',
        paymentDate: '2026-09-25',
        amountPaid: 900000,
        periodLabel: 'Angsuran 2',
        createdAt: '2026-09-25T10:00:00Z',
      },
      {
        id: 'log-ka-3',
        paymentDate: '2026-10-25',
        amountPaid: 900000,
        periodLabel: 'Angsuran 3',
        createdAt: '2026-10-25T10:00:00Z',
      },
    ],
    createdAt: '2026-08-25T08:05:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  },
  {
    id: 'debt-basco-11',
    name: 'Tent Top',
    lenderName: 'Spaylater',
    category: 'renovation',
    debtType: 'monthly',
    principalAmount: 2340000,
    remainingAmount: 1520000,
    monthlyInstallment: 205000,
    annualInstallment: 2460000,
    tenorMonths: 12,
    paidMonths: 4,
    dueDayOfMonth: 25,
    nextDueDate: '2026-11-25',
    startDate: '2026-07-25',
    status: 'active',
    notes: '',
    paymentLogs: [
      {
        id: 'log-tt-1',
        paymentDate: '2026-07-25',
        amountPaid: 205000,
        periodLabel: 'Angsuran 1',
        createdAt: '2026-07-25T10:00:00Z',
      },
      {
        id: 'log-tt-2',
        paymentDate: '2026-08-25',
        amountPaid: 205000,
        periodLabel: 'Angsuran 2',
        createdAt: '2026-08-25T10:00:00Z',
      },
      {
        id: 'log-tt-3',
        paymentDate: '2026-09-25',
        amountPaid: 205000,
        periodLabel: 'Angsuran 3',
        createdAt: '2026-09-25T10:00:00Z',
      },
      {
        id: 'log-tt-4',
        paymentDate: '2026-10-25',
        amountPaid: 205000,
        periodLabel: 'Angsuran 4',
        createdAt: '2026-10-25T10:00:00Z',
      },
    ],
    createdAt: '2026-07-25T08:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  },
  {
    id: 'debt-basco-12',
    name: 'KUR',
    lenderName: 'BRI',
    category: 'bank_loan',
    debtType: 'monthly',
    principalAmount: 25000000,
    remainingAmount: 23120000,
    monthlyInstallment: 750000,
    annualInstallment: 9000000,
    tenorMonths: 36,
    paidMonths: 3,
    dueDayOfMonth: 5,
    nextDueDate: '2026-11-05',
    startDate: '2026-08-05',
    status: 'active',
    notes: '',
    paymentLogs: [
      {
        id: 'log-kur-1',
        paymentDate: '2026-08-05',
        amountPaid: 630000,
        periodLabel: 'Angsuran 1',
        createdAt: '2026-08-05T10:00:00Z',
      },
      {
        id: 'log-kur-2',
        paymentDate: '2026-09-05',
        amountPaid: 625000,
        periodLabel: 'Angsuran 2',
        createdAt: '2026-09-05T10:00:00Z',
      },
      {
        id: 'log-kur-3',
        paymentDate: '2026-10-05',
        amountPaid: 625000,
        periodLabel: 'Angsuran 3',
        createdAt: '2026-10-05T10:00:00Z',
      },
    ],
    createdAt: '2026-08-05T08:00:00Z',
    updatedAt: '2026-10-05T10:00:00Z',
  },
  {
    id: 'debt-basco-13',
    name: 'Kopi 5kg',
    lenderName: 'Chandra',
    category: 'supplier',
    debtType: 'lump_sum',
    principalAmount: 600000,
    remainingAmount: 600000,
    monthlyInstallment: 150000,
    annualInstallment: 1800000,
    tenorMonths: 4,
    paidMonths: 0,
    dueDayOfMonth: 25,
    nextDueDate: '2026-10-25',
    startDate: '2026-10-25',
    status: 'active',
    notes: '',
    paymentLogs: [],
    createdAt: '2026-10-25T08:30:00Z',
    updatedAt: '2026-10-25T08:30:00Z',
  },
];

function isLegacyOrAutoInjectedDebtId(id: string): boolean {
  if (!id) return true;
  if (id === 'debt-1' || id === 'debt-2' || id === 'debt-3') return true;
  if (id.startsWith('sheet-bm-') || id.startsWith('sheet-tx-')) return true;
  return false;
}

export function getStoredDebts(): DebtItem[] {
  try {
    const saved = localStorage.getItem(DEBT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (d: any) => d && !isLegacyOrAutoInjectedDebtId(String(d.id || ''))
        );
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
    }
  } catch (err) {
    console.warn('Error reading stored debts:', err);
  }
  return [...DEFAULT_DEBTS];
}

export function saveStoredDebts(debts: DebtItem[]): void {
  try {
    const cleaned = (debts || []).filter(
      (d: any) => d && !isLegacyOrAutoInjectedDebtId(String(d.id || ''))
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
