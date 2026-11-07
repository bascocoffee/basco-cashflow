import React, { useState, useMemo, useEffect, FormEvent } from 'react';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  RefreshCw, 
  History, 
  X, 
  Save, 
  Check, 
  Info,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Search,
  ArrowRight,
  Receipt,
  FileSpreadsheet,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DebtItem, DebtCategory, DebtType, DebtStatus, DebtPaymentLog, Transaction } from '../types';
import { 
  getStoredDebts, 
  saveStoredDebts, 
  DEFAULT_DEBTS, 
  CATEGORY_LABELS, 
  DEBT_TYPE_LABELS, 
  getDueDateStatus, 
  calculateDebtFinancialMetrics 
} from '../utils/debtUtils';
import {
  fetchDebtsFromSheet,
  saveDebtsToSheet,
  markIncomingBatchPaidInSheet,
  getDebtSheetGid,
  DEBT_SHEET_TAB_NAME,
  DEFAULT_SPREADSHEET_ID,
} from '../sheetsService';
import { googleSignIn } from '../firebase';
import { saveCloudSlot } from '../utils/cloudSync';
import {
  generateSmartDebtAnalysis,
  getSavedAiProvider,
  setSavedAiProvider,
  type AiProvider,
} from '../utils/aiAssistantEngine';

function AiMarkdownReport({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split('\n');

  const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-2 text-xs text-slate-700 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h5 key={idx} className="text-xs font-black text-slate-900 mt-2 uppercase tracking-wide">
              {parseInline(trimmed.replace('### ', ''))}
            </h5>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h4 key={idx} className="text-sm font-black text-slate-900 mt-3 pt-2 border-t border-slate-200 uppercase tracking-tight">
              {parseInline(trimmed.replace('## ', ''))}
            </h4>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h3 key={idx} className="text-base font-black text-slate-900 mt-4 mb-1">
              {parseInline(trimmed.replace('# ', ''))}
            </h3>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-3">
              <span className="text-amber-500 font-black shrink-0">•</span>
              <span>{parseInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-3">
              <span className="font-bold text-slate-500 shrink-0">{numMatch[1]}.</span>
              <span>{parseInline(numMatch[2])}</span>
            </div>
          );
        }
        return <p key={idx}>{parseInline(trimmed)}</p>;
      })}
    </div>
  );
}

interface DebtTrackerPageProps {
  transactions: Transaction[];
  spreadsheetId?: string | null;
  spreadsheetUrl?: string | null;
  token?: string | null;
}

export default function DebtTrackerPage({
  transactions,
  spreadsheetId,
  token,
}: DebtTrackerPageProps) {
  const activeSpreadsheetId =
    spreadsheetId || localStorage.getItem('aruskas_spreadsheet_id') || DEFAULT_SPREADSHEET_ID;
  const activeToken =
    token || localStorage.getItem('aruskas_google_access_token') || 'local-token';

  const [debts, setDebts] = useState<DebtItem[]>(() => getStoredDebts());
  const [filterType, setFilterType] = useState<'all' | 'monthly' | 'annual' | 'lump_sum' | 'active' | 'paid_off'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [isCreatingSheetTab, setIsCreatingSheetTab] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [debtSheetGid, setDebtSheetGid] = useState<number | null>(null);
  const [sheetSyncNotice, setSheetSyncNotice] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => getSavedAiProvider());

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  
  // Payment Modal State
  const [paymentModalDebt, setPaymentModalDebt] = useState<DebtItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentPeriod, setPaymentPeriod] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');

  // History Modal State
  const [historyModalDebt, setHistoryModalDebt] = useState<DebtItem | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formLender, setFormLender] = useState('');
  const [formCategory, setFormCategory] = useState<DebtCategory>('supplier');
  const [formDebtType, setFormDebtType] = useState<DebtType>('lump_sum');
  const [formPrincipal, setFormPrincipal] = useState<string>('');
  const [formRemaining, setFormRemaining] = useState<string>('');
  const [formMonthlyInstallment, setFormMonthlyInstallment] = useState<string>('');
  const [formTenorMonths, setFormTenorMonths] = useState<string>('1');
  const [formPaidMonths, setFormPaidMonths] = useState<string>('0');
  const [formDueDay, setFormDueDay] = useState<number>(5);
  const [formStartDate, setFormStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState<string>('');

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(() => {
    return localStorage.getItem('aruskas_debt_ai_analysis') || null;
  });
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI Section Minimize State
  const [isAiSectionMinimized, setIsAiSectionMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aruskas_debt_ai_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const toggleAiSectionMinimized = () => {
    setIsAiSectionMinimized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('aruskas_debt_ai_minimized', String(next));
      } catch {}
      return next;
    });
  };

  // Realtime sync from Google Spreadsheet ("Pencatatan Hutang")
  const syncDebtsFromSpreadsheet = async (showSpinner = false) => {
    if (!activeSpreadsheetId) return;
    if (showSpinner) setIsSyncingSheet(true);
    try {
      const synced = await fetchDebtsFromSheet(activeSpreadsheetId, activeToken, transactions);
      if (Array.isArray(synced) && synced.length > 0) {
        setDebts(prev => {
          const prevSig = prev.map(d => `${d.id}:${d.remainingAmount}:${d.status}`).join('|');
          const nextSig = synced.map(d => `${d.id}:${d.remainingAmount}:${d.status}`).join('|');
          if (prevSig === nextSig && prev.length === synced.length) return prev;
          saveStoredDebts(synced);
          return synced;
        });
        setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      }
      const gid = await getDebtSheetGid(activeSpreadsheetId, activeToken);
      if (gid !== null) setDebtSheetGid(gid);
    } catch (err) {
      console.error('Error syncing debts from spreadsheet:', err);
    } finally {
      if (showSpinner) setIsSyncingSheet(false);
    }
  };

  // Explicit 1-click handler to create/update the dedicated "Pencatatan Hutang" sheet tab in Google Spreadsheet
  const handleCreateOrUpdateSheetTab = async () => {
    if (!activeSpreadsheetId) return;
    setIsCreatingSheetTab(true);
    setSheetSyncNotice(null);
    try {
      const currentList = debts.length > 0 ? debts : [...DEFAULT_DEBTS];
      let res = await saveDebtsToSheet(activeSpreadsheetId, currentList, activeToken);

      if (res.needsGoogleAuth && !res.syncedToSheet) {
        // User logged in via Password without active OAuth write token -> request Google OAuth popup
        const signInResult = await googleSignIn();
        if (signInResult?.accessToken) {
          localStorage.setItem('aruskas_google_access_token', signInResult.accessToken);
          await saveCloudSlot('auth_token', {
            accessToken: signInResult.accessToken,
            spreadsheetId: activeSpreadsheetId,
          });
          res = await saveDebtsToSheet(activeSpreadsheetId, currentList, signInResult.accessToken);
        }
      }

      if (res.sheetGid !== undefined && res.sheetGid !== null) {
        setDebtSheetGid(res.sheetGid);
      }

      if (res.syncedToSheet) {
        setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        setSheetSyncNotice(
          `✓ Sheet "${DEBT_SHEET_TAB_NAME}" berhasil dibuat & diperbarui di Google Spreadsheet (${currentList.length} baris hutang)!`
        );
      } else {
        setSheetSyncNotice(
          `Data tersimpan di Cloud (${currentList.length} baris). Klik kembali dan pilih akun Google Owner untuk menulis tab "${DEBT_SHEET_TAB_NAME}" di Google Sheets.`
        );
      }
    } catch (err) {
      console.error('Error creating/updating Pencatatan Hutang sheet tab:', err);
      setSheetSyncNotice('Gagal membuat tab di Google Sheets. Pastikan popup login Google diizinkan.');
    } finally {
      setIsCreatingSheetTab(false);
    }
  };

  const handleRestoreDefaultCafeDebts = async () => {
    const restored = [...DEFAULT_DEBTS];
    setDebts(restored);
    saveStoredDebts(restored);
    setIsSyncingSheet(true);
    try {
      const res = await saveDebtsToSheet(activeSpreadsheetId, restored, activeToken);
      if (res.sheetGid !== undefined && res.sheetGid !== null) {
        setDebtSheetGid(res.sheetGid);
      }
      setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      setSheetSyncNotice(
        `✓ 13 data hutang cafe berhasil dipulihkan & disinkronkan ke Sheet "${DEBT_SHEET_TAB_NAME}"!`
      );
    } finally {
      setIsSyncingSheet(false);
    }
  };

  useEffect(() => {
    syncDebtsFromSpreadsheet(true);
  }, [activeSpreadsheetId, activeToken, transactions.length]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      syncDebtsFromSpreadsheet(false);
    }, 7000);
    const handleFocus = () => syncDebtsFromSpreadsheet(false);
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeSpreadsheetId, activeToken, transactions]);

  // Save to localStorage whenever debts change
  useEffect(() => {
    saveStoredDebts(debts);
  }, [debts]);

  // Format currency helper
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  // Comprehensive financial & debt metrics
  const metrics = useMemo(() => {
    return calculateDebtFinancialMetrics(debts, transactions);
  }, [debts, transactions]);

  // Filtered debts
  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      // Type / Status filter
      if (filterType === 'monthly' && debt.debtType !== 'monthly') return false;
      if (filterType === 'annual' && debt.debtType !== 'annual') return false;
      if (filterType === 'lump_sum' && debt.debtType !== 'lump_sum') return false;
      if (filterType === 'active' && debt.status !== 'active') return false;
      if (filterType === 'paid_off' && debt.status !== 'paid_off') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = debt.name.toLowerCase().includes(q);
        const matchLender = debt.lenderName.toLowerCase().includes(q);
        const matchNotes = (debt.notes || '').toLowerCase().includes(q);
        return matchName || matchLender || matchNotes;
      }
      return true;
    });
  }, [debts, filterType, searchQuery]);

  // Urgent upcoming due dates list (for alert banner)
  const urgentDueDebts = useMemo(() => {
    const now = new Date();
    return debts
      .filter(d => d.status === 'active')
      .map(d => ({
        debt: d,
        dueStatus: getDueDateStatus(d, now)
      }))
      .filter(item => item.dueStatus.status === 'overdue' || item.dueStatus.status === 'due_today' || item.dueStatus.status === 'due_soon')
      .sort((a, b) => a.dueStatus.daysLeft - b.dueStatus.daysLeft);
  }, [debts]);

  // Open Form Modal
  const handleOpenForm = (debtToEdit?: DebtItem) => {
    if (debtToEdit) {
      setEditingDebt(debtToEdit);
      setFormName(debtToEdit.name);
      setFormLender(debtToEdit.lenderName);
      setFormCategory(debtToEdit.category);
      setFormDebtType(debtToEdit.debtType);
      setFormPrincipal(String(debtToEdit.principalAmount));
      setFormRemaining(String(debtToEdit.remainingAmount));
      setFormMonthlyInstallment(String(debtToEdit.monthlyInstallment));
      setFormTenorMonths(String(debtToEdit.tenorMonths));
      setFormPaidMonths(String(debtToEdit.paidMonths));
      setFormDueDay(debtToEdit.dueDayOfMonth);
      setFormStartDate(debtToEdit.startDate);
      setFormNotes(debtToEdit.notes || '');
    } else {
      setEditingDebt(null);
      setFormName('');
      setFormLender('');
      setFormCategory('supplier');
      setFormDebtType('lump_sum');
      setFormPrincipal('');
      setFormRemaining('');
      setFormMonthlyInstallment('');
      setFormTenorMonths('1');
      setFormPaidMonths('0');
      setFormDueDay(5);
      setFormStartDate(new Date().toISOString().split('T')[0]);
      setFormNotes('');
    }
    setIsFormModalOpen(true);
  };

  // Auto calculate monthly installment from principal & tenor
  const handleAutoCalcInstallment = () => {
    const p = Number(formPrincipal.replace(/\D/g, ''));
    const t = Number(formTenorMonths) || 1;
    if (p > 0 && t > 0) {
      const calculated = Math.round(p / t);
      setFormMonthlyInstallment(String(calculated));
    }
  };

  // Save Debt (and sync to Google Spreadsheet in realtime)
  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Mohon isi nama pinjaman / hutang');
      return;
    }

    const principal = Number(formPrincipal.replace(/\D/g, '')) || 0;
    const remaining = formRemaining.trim() ? Number(formRemaining.replace(/\D/g, '')) : principal;
    const monthly = Number(formMonthlyInstallment.replace(/\D/g, '')) || remaining || principal;
    const tenor = Number(formTenorMonths) || 1;
    const paidM = Number(formPaidMonths) || 0;
    const dueDay = Math.min(31, Math.max(1, Number(formDueDay) || 5));
    
    const now = new Date();
    let nextYear = now.getFullYear();
    let nextMonth = now.getMonth();
    if (now.getDate() > dueDay) {
      nextMonth += 1;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
    }
    const nextDueDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

    const annualAmount = formDebtType === 'annual' ? principal : monthly * 12;

    if (editingDebt) {
      setDebts(prev => {
        const nextList = prev.map(item => {
          if (item.id === editingDebt.id) {
            return {
              ...item,
              name: formName.trim(),
              lenderName: formLender.trim() || 'Kreditur',
              category: formCategory,
              debtType: formDebtType,
              principalAmount: principal,
              remainingAmount: remaining,
              monthlyInstallment: monthly,
              annualInstallment: annualAmount,
              tenorMonths: tenor,
              paidMonths: paidM,
              dueDayOfMonth: dueDay,
              nextDueDate: item.nextDueDate || nextDueDateStr,
              startDate: formStartDate,
              notes: formNotes.trim(),
              status: (remaining <= 0 ? 'paid_off' : 'active') as DebtStatus,
              updatedAt: new Date().toISOString()
            };
          }
          return item;
        });
        saveStoredDebts(nextList);
        saveDebtsToSheet(activeSpreadsheetId, nextList, activeToken).catch(() => {});
        return nextList;
      });
    } else {
      const newDebt: DebtItem = {
        id: `debt-${Date.now()}`,
        name: formName.trim(),
        lenderName: formLender.trim() || 'Kreditur',
        category: formCategory,
        debtType: formDebtType,
        principalAmount: principal,
        remainingAmount: remaining,
        monthlyInstallment: monthly,
        annualInstallment: annualAmount,
        tenorMonths: tenor,
        paidMonths: paidM,
        dueDayOfMonth: dueDay,
        nextDueDate: nextDueDateStr,
        startDate: formStartDate,
        status: remaining <= 0 ? 'paid_off' : 'active',
        notes: formNotes.trim(),
        paymentLogs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setDebts(prev => {
        const nextList = [newDebt, ...prev];
        saveStoredDebts(nextList);
        saveDebtsToSheet(activeSpreadsheetId, nextList, activeToken).catch(() => {});
        return nextList;
      });
    }

    setIsFormModalOpen(false);
  };

  // Delete Debt (and sync deletion to Google Spreadsheet)
  const handleDeleteDebt = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus catatan hutang: "${name}"?`)) {
      setDebts(prev => {
        const nextList = prev.filter(d => d.id !== id);
        saveStoredDebts(nextList);
        saveDebtsToSheet(activeSpreadsheetId, nextList, activeToken, [id]).catch(() => {});
        return nextList;
      });
    }
  };

  // Open Pay Installment Modal
  const handleOpenPaymentModal = (debt: DebtItem) => {
    setPaymentModalDebt(debt);
    setPaymentAmount(String(debt.monthlyInstallment || debt.remainingAmount || ''));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    
    const nextInstallmentNum = (debt.paidMonths || 0) + 1;
    const now = new Date();
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    setPaymentPeriod(
      debt.debtType === 'lump_sum'
        ? `Pelunasan Tempo (${monthNames[now.getMonth()]} ${now.getFullYear()})`
        : `Angsuran ke-${nextInstallmentNum} (${monthNames[now.getMonth()]} ${now.getFullYear()})`
    );
    setPaymentNote('');
  };

  // Submit Payment (and sync to Google Spreadsheet + "Barang Masuk & Pembelian" if applicable)
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDebt) return;

    const amount = Number(paymentAmount.replace(/\D/g, ''));
    if (amount <= 0) {
      alert('Nominal pembayaran harus lebih dari 0');
      return;
    }

    const log: DebtPaymentLog = {
      id: `log-${Date.now()}`,
      paymentDate,
      amountPaid: amount,
      periodLabel: paymentPeriod || 'Pembayaran Angsuran',
      note: paymentNote.trim(),
      createdAt: new Date().toISOString()
    };

    const targetDebt = paymentModalDebt as any;
    const isGoingToBePaidOff = Math.max(0, (paymentModalDebt.remainingAmount || 0) - amount) <= 0;

    setDebts(prev => {
      const nextList = prev.map(d => {
        if (d.id === paymentModalDebt.id) {
          const newRemaining = Math.max(0, (d.remainingAmount || 0) - amount);
          const newPaidMonths = (d.paidMonths || 0) + 1;
          const isPaidOff = newRemaining <= 0;

          let nextDueDateStr = d.nextDueDate;
          if (!isPaidOff && d.nextDueDate) {
            const parts = d.nextDueDate.split('-');
            if (parts.length === 3) {
              let y = parseInt(parts[0], 10);
              let m = parseInt(parts[1], 10);
              m += 1;
              if (m > 12) {
                m = 1;
                y += 1;
              }
              nextDueDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d.dueDayOfMonth).padStart(2, '0')}`;
            }
          }

          return {
            ...d,
            remainingAmount: newRemaining,
            paidMonths: newPaidMonths,
            status: (isPaidOff ? 'paid_off' : 'active') as DebtStatus,
            nextDueDate: nextDueDateStr,
            paymentLogs: [log, ...(d.paymentLogs || [])],
            updatedAt: new Date().toISOString()
          };
        }
        return d;
      });

      saveStoredDebts(nextList);
      saveDebtsToSheet(activeSpreadsheetId, nextList, activeToken).catch(() => {});
      return nextList;
    });

    if (isGoingToBePaidOff && (targetDebt.batchId || String(targetDebt.id).startsWith('sheet-bm-'))) {
      const batchId = targetDebt.batchId || String(targetDebt.id).replace(/^sheet-bm-/, '');
      markIncomingBatchPaidInSheet(activeSpreadsheetId, batchId, activeToken).catch(() => {});
    }

    setPaymentModalDebt(null);
  };

  // Call Claude / Gemini AI for Debt Analysis
  const handleConsultAi = async (overrideProvider?: AiProvider) => {
    const activeProvider = overrideProvider || aiProvider;
    setIsAnalyzingAi(true);
    setAiError(null);

    const activeDebts = debts.filter(d => d.status === 'active');
    const fallbackReport = () =>
      generateSmartDebtAnalysis({
        provider: activeProvider,
        debtSummary: {
          totalActiveDebtRemaining: metrics.totalRemaining,
          totalMonthlyObligation: metrics.totalMonthlyInstallment,
          dsrPercentage: metrics.debtToRevenueRatio,
          dsrStatus:
            metrics.safetyStatus === 'safe'
              ? 'Aman'
              : metrics.safetyStatus === 'caution'
              ? 'Waspada'
              : 'Bahaya',
          activeDebtsList: activeDebts.map(d => ({
            nama: d.name,
            kreditur: d.lenderName,
            sisaPokok: d.remainingAmount,
            cicilanPerBulan: d.monthlyInstallment,
            jatuhTempo: d.nextDueDate || `Tanggal ${d.dueDayOfMonth}`,
          })),
        },
        cashflowSummary: {
          avgMonthlyIncome: metrics.monthlyRevenue,
          avgMonthlyExpense: metrics.monthlyExpenses,
          avgMonthlyNetProfit: metrics.monthlyNetProfit,
        },
      });

    try {
      const payload = {
        provider: activeProvider,
        debtSummary: {
          totalPrincipal: metrics.totalPrincipal,
          totalRemaining: metrics.totalRemaining,
          totalMonthlyInstallment: metrics.totalMonthlyInstallment,
          totalAnnualInstallment: metrics.totalAnnualInstallment,
          activeDebtCount: metrics.activeCount,
          debtsList: activeDebts.map(d => ({
            name: d.name,
            lenderName: d.lenderName,
            debtType: d.debtType,
            category: d.category,
            monthlyInstallment: d.monthlyInstallment,
            remainingAmount: d.remainingAmount,
            dueDayOfMonth: d.dueDayOfMonth,
            tenorMonths: d.tenorMonths,
            paidMonths: d.paidMonths,
            status: d.status
          }))
        },
        financialContext: {
          monthlyRevenue: metrics.monthlyRevenue,
          monthlyExpenses: metrics.monthlyExpenses,
          monthlyNetProfit: metrics.monthlyNetProfit,
          netProfitMargin: metrics.netProfitMargin,
          cashBalance: metrics.cashBalance,
          dscr: metrics.dscr,
          debtToIncomeRatio: metrics.debtToRevenueRatio,
          freeCashFlowAfterDebt: metrics.freeCashFlowAfterDebt,
          safetyStatus: metrics.safetyStatus
        }
      };

      let analysisResult = '';
      try {
        const response = await fetch('/api/gemini/debt-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const data = await response.json();
          analysisResult = data.analysis || '';
        }
      } catch {
        // Fallback to local Claude/Gemini analytical engine
      }

      if (!analysisResult.trim()) {
        analysisResult = fallbackReport();
      }

      setAiAnalysis(analysisResult);
      localStorage.setItem('aruskas_debt_ai_analysis', analysisResult);
    } catch (err: any) {
      console.error(err);
      const fallback = fallbackReport();
      setAiAnalysis(fallback);
      localStorage.setItem('aruskas_debt_ai_analysis', fallback);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <span className="p-2 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
              <CreditCard className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Pencatatan Hutang & Liabilitas Cafe
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-[10px] rounded-full uppercase flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Sync Spreadsheet ({debts.length} Item)</span>
            </span>
            {lastSyncTime && (
              <span className="text-[10px] font-bold text-slate-400">
                Sync: {lastSyncTime}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium max-w-2xl">
            Tersinkronisasi otomatis secara real-time dengan sheet khusus <strong>"{DEBT_SHEET_TAB_NAME}"</strong> pada Google Spreadsheet Basco Cashflow.
          </p>
          {sheetSyncNotice && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>{sheetSyncNotice}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setAiProvider('claude');
                setSavedAiProvider('claude');
                handleConsultAi('claude');
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                aiProvider === 'claude'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Claude AI
            </button>
            <button
              type="button"
              onClick={() => {
                setAiProvider('gemini');
                setSavedAiProvider('gemini');
                handleConsultAi('gemini');
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                aiProvider === 'gemini'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gemini AI
            </button>
          </div>

          <button
            type="button"
            onClick={handleCreateOrUpdateSheetTab}
            disabled={isCreatingSheetTab || isSyncingSheet}
            className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-1.5"
            title={`Buat atau perbarui sheet "${DEBT_SHEET_TAB_NAME}" di Google Spreadsheet`}
          >
            <FileSpreadsheet className={`h-4 w-4 ${isCreatingSheetTab ? 'animate-bounce' : ''}`} />
            <span>
              {isCreatingSheetTab ? 'Membuat Sheet...' : `Buat / Update Sheet "${DEBT_SHEET_TAB_NAME}"`}
            </span>
          </button>

          <a
            href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit${
              debtSheetGid !== null ? `#gid=${debtSheetGid}` : ''
            }`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs transition flex items-center space-x-1.5"
            title={`Buka sheet "${DEBT_SHEET_TAB_NAME}" di Google Spreadsheet`}
          >
            <ExternalLink className="h-3.5 w-3.5 text-emerald-700" />
            <span>Buka Sheet</span>
          </a>

          <button
            type="button"
            onClick={() => syncDebtsFromSpreadsheet(true)}
            disabled={isSyncingSheet}
            className="px-3.5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-1.5"
            title={`Tarik data terbaru dari sheet "${DEBT_SHEET_TAB_NAME}" di Google Spreadsheet`}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
            <span>{isSyncingSheet ? 'Menyinkronkan...' : 'Sync Spreadsheet'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleConsultAi()}
            disabled={isAnalyzingAi}
            className="px-4 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center space-x-2 disabled:opacity-60"
          >
            {isAnalyzingAi ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                <span>Menganalisis Finansial...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-slate-950" />
                <span>Analisis Kelayakan AI</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleOpenForm()}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Hutang</span>
          </button>
        </div>
      </div>

      {/* NOTIFIKASI JATUH TEMPO PEMBAYARAN (URGENT PAYMENT DUE NOTIFICATION BANNER) */}
      {urgentDueDebts.length > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300/80 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shrink-0 mt-0.5 shadow-sm">
              <Clock className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide flex items-center gap-2">
                  <span>Peringatan Tanggal Pembayaran Hutang</span>
                  <span className="bg-amber-200/90 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-black border border-amber-300">
                    {urgentDueDebts.length} Tagihan Menunggu
                  </span>
                </h3>
                <span className="text-xs font-black text-amber-900 font-mono">
                  Total Perlu Disiapkan: {formatRupiah(urgentDueDebts.reduce((sum, item) => sum + item.debt.monthlyInstallment, 0))}
                </span>
              </div>
              <p className="text-xs text-amber-800 font-medium mt-1">
                Harap perhatikan jadwal jatuh tempo pembayaran berikut agar reputasi kredit bisnis tetap terjaga dan terhindar dari denda keterlambatan:
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {urgentDueDebts.map(({ debt, dueStatus }) => (
                  <div 
                    key={debt.id} 
                    className="bg-white/95 rounded-xl border border-amber-200 p-3 flex flex-col justify-between shadow-2xs hover:border-amber-400 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-black border uppercase tracking-wider ${dueStatus.badgeBg} ${dueStatus.badgeText} ${dueStatus.badgeBorder}`}>
                          {dueStatus.label}
                        </span>
                        <span className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          Tgl {debt.dueDayOfMonth}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 line-clamp-1">
                        {debt.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {debt.lenderName}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Angsuran</span>
                        <span className="text-xs font-black text-slate-900 font-mono">
                          {formatRupiah(debt.monthlyInstallment)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(debt)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-lg transition cursor-pointer flex items-center space-x-1"
                      >
                        <Check className="h-3 w-3" />
                        <span>Bayar Cicilan</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5 KEY FINANCIAL SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Pokok Pinjaman */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Total Pokok Hutang
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1">
            {formatRupiah(metrics.totalPrincipal)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center justify-between">
            <span>{debts.length} pinjaman tercatat</span>
            <span className="text-emerald-700 font-bold">{metrics.overallProgressPct}% lunas</span>
          </div>
        </div>

        {/* Total Sisa Pokok Hutang */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Sisa Pokok Hutang
          </span>
          <div className="text-lg sm:text-xl font-black text-amber-700 font-mono mt-1">
            {formatRupiah(metrics.totalRemaining)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">
            {metrics.activeCount} pinjaman aktif berjalan
          </div>
        </div>

        {/* Total Beban Cicilan Bulanan */}
        <div className="bg-white rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block">
              Total Beban Bulanan
            </span>
            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold uppercase">
              Per Bulan
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-700 font-mono mt-1">
            {formatRupiah(metrics.totalMonthlyInstallment)}
          </div>
          <div className="text-[10px] text-indigo-800/80 font-medium mt-1">
            Alokasi angsuran wajib tiap bulan
          </div>
        </div>

        {/* Total Beban Angsuran Tahunan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Total Beban Tahunan
            </span>
            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">
              Per Tahun
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1">
            {formatRupiah(metrics.totalAnnualInstallment)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">
            Estimasi 12 bulan kewajiban hutang
          </div>
        </div>

        {/* AI Health Status Badge */}
        <div className={`col-span-2 lg:col-span-1 rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between ${
          metrics.safetyStatus === 'safe'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : metrics.safetyStatus === 'caution'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">
                Kelayakan Finansial AI
              </span>
              {metrics.safetyStatus === 'safe' ? (
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-700" />
              )}
            </div>
            <div className="text-sm font-black mt-1 flex items-center gap-1.5">
              <span>{metrics.safetyStatus === 'safe' ? '🟢 AMAN' : metrics.safetyStatus === 'caution' ? '🟡 WASPADA' : '🔴 BAHAYA'}</span>
            </div>
          </div>
          <div className="text-[10.5px] font-medium mt-2 leading-tight opacity-90">
            DSCR: <strong className="font-mono">{metrics.dscr}x</strong> | Beban Omset: <strong className="font-mono">{metrics.debtToRevenueRatio}%</strong>
          </div>
        </div>
      </div>

      {/* AI AUTOMATION & CAPACITY DASHBOARD (PERHITUNGAN OTOMASI AI & KELAYAKAN BERHUTANG) */}
      <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs transition-all ${
        isAiSectionMinimized ? 'p-4 sm:p-5' : 'p-5 sm:p-6 space-y-4'
      }`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isAiSectionMinimized ? '' : 'pb-3 border-b border-slate-150'
        }`}>
          <div 
            className="flex items-center space-x-3 cursor-pointer select-none group flex-1 min-w-0"
            onClick={toggleAiSectionMinimized}
            title={isAiSectionMinimized ? "Klik untuk menampilkan rincian otomasi AI" : "Klik untuk minimize"}
          >
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200 group-hover:bg-indigo-100 transition-colors shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight group-hover:text-indigo-900 transition-colors">
                  Perhitungan Otomasi AI: Kelayakan & Batas Aman Berhutang
                </h3>
                {isAiSectionMinimized && (
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border shrink-0 ${
                    metrics.safetyStatus === 'safe'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : metrics.safetyStatus === 'caution'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    {metrics.safetyStatus === 'safe' ? '🟢 AMAN BERHUTANG' : metrics.safetyStatus === 'caution' ? '🟡 WASPADA CICILAN' : '🔴 BAHAYA'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium truncate sm:whitespace-normal">
                {isAiSectionMinimized 
                  ? `DSCR: ${metrics.dscr}x • Beban Omset: ${metrics.debtToRevenueRatio}% • Sisa Laba: ${formatRupiah(metrics.freeCashFlowAfterDebt)} • Klik untuk melihat rincian`
                  : `Membaca data live omset (${formatRupiah(metrics.monthlyRevenue)}) dan laba bersih (${formatRupiah(metrics.monthlyNetProfit)}) untuk mengukur risiko gagal bayar.`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isAiSectionMinimized && (
              <button
                type="button"
                onClick={handleConsultAi}
                disabled={isAnalyzingAi}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold rounded-xl border border-indigo-200 transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isAnalyzingAi ? 'animate-spin' : ''}`} />
                <span>Perbarui Analisis AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleAiSectionMinimized}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer flex items-center space-x-1.5"
              id="btn-toggle-minimize-ai-debt"
              title={isAiSectionMinimized ? "Buka / Tampilkan Analisis AI" : "Kecilkan / Minimize Analisis AI"}
            >
              {isAiSectionMinimized ? (
                <>
                  <ChevronDown className="h-4 w-4 text-slate-600" />
                  <span>Buka Detail</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4 text-slate-600" />
                  <span>Minimize</span>
                </>
              )}
            </button>
          </div>
        </div>

        {!isAiSectionMinimized && (
          <>
            {/* 4 In-Depth Mathematical Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* DSCR Ratio */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                  <span>Debt Service Coverage (DSCR)</span>
                  <span className="font-mono text-indigo-700 font-black">Laba ÷ Cicilan</span>
                </div>
                <div className="text-xl font-black font-mono text-slate-900 mt-1">
                  {metrics.dscr}x
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  {metrics.dscr >= 1.8 ? '🟢 Sangat Sehat (>1.5x standar perbankan)' : metrics.dscr >= 1.2 ? '🟡 Cukup Sehat (1.2x - 1.5x)' : '🔴 Rawan (Di bawah 1.2x)'}
                </p>
              </div>

              {/* Debt Service Ratio (to Revenue) */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                  <span>Beban Cicilan thd Omset</span>
                  <span className="font-mono text-indigo-700 font-black">Cicilan ÷ Omset</span>
                </div>
                <div className="text-xl font-black font-mono text-slate-900 mt-1">
                  {metrics.debtToRevenueRatio}%
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  {metrics.debtToRevenueRatio <= 15 ? '🟢 Ideal untuk F&B (<15%)' : metrics.debtToRevenueRatio <= 22 ? '🟡 Batas Menengah (15-22%)' : '🔴 Sangat Tinggi (>22%)'}
                </p>
              </div>

              {/* Sisa Laba Bersih Bebas (Free Cash Flow Cushion) */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                  <span>Sisa Laba Bersih (Buffer)</span>
                  <span className="font-mono text-indigo-700 font-black">Laba - Cicilan</span>
                </div>
                <div className={`text-xl font-black font-mono mt-1 ${
                  metrics.freeCashFlowAfterDebt >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {formatRupiah(metrics.freeCashFlowAfterDebt)}
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  {metrics.freeCashFlowAfterDebt >= 0 ? 'Sisa kas bebas untuk dividen & tabungan' : '⚠️ Defisit kas! Pengeluaran melebihi laba'}
                </p>
              </div>

              {/* Safe Borrowing Capacity Monthly */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                  <span>Plafon Cicilan Tambahan Aman</span>
                  <span className="font-mono text-indigo-700 font-black">Kapasitas Baru</span>
                </div>
                <div className="text-xl font-black font-mono text-indigo-700 mt-1">
                  {metrics.maxSafeBorrowingMonthly > 0 ? formatRupiah(metrics.maxSafeBorrowingMonthly) : 'Rp 0'}
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  {metrics.maxSafeBorrowingMonthly > 0 ? 'Batas maksimal cicilan baru yang aman diambil' : 'Tidak disarankan menambah pinjaman baru'}
                </p>
              </div>
            </div>

            {/* AI Assessment Callout / Markdown Result */}
            <div className={`rounded-xl border p-4 text-xs font-medium leading-relaxed ${
              metrics.safetyStatus === 'safe'
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                : metrics.safetyStatus === 'caution'
                  ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                  : 'bg-rose-50/60 border-rose-200 text-rose-950'
            }`}>
              <div className="flex items-start space-x-2.5">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black text-sm uppercase tracking-tight block">
                    Kesimpulan Otomasi AI: {metrics.safetyLabel}
                  </span>
                  <p>{metrics.safetyReason}</p>
                </div>
              </div>
            </div>

            {/* Deep Gemini AI Generated Report */}
            {aiError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-650" />
                <span>{aiError}</span>
              </div>
            )}

            {aiAnalysis && (
              <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Laporan Mendalam Konsultan Keuangan AI (Basco Risk Advisor)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(aiAnalysis);
                      alert('Laporan analisis AI berhasil disalin ke clipboard!');
                    }}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline"
                  >
                    Salin Teks
                  </button>
                </div>

                <div className="max-w-none text-slate-700 font-sans leading-relaxed">
                  <AiMarkdownReport content={aiAnalysis} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FILTER & DATA TABLE SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({debts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('monthly')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                filterType === 'monthly'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cicilan Bulanan ({debts.filter(d => d.debtType === 'monthly').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('annual')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                filterType === 'annual'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Beban Tahunan ({debts.filter(d => d.debtType === 'annual').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('lump_sum')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                filterType === 'lump_sum'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tempo Supplier ({debts.filter(d => d.debtType === 'lump_sum').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                filterType === 'active'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum Lunas ({metrics.activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('paid_off')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                filterType === 'paid_off'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lunas ({metrics.paidOffCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari hutang / kreditur..."
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Debts Table / Cards List */}
        {filteredDebts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <CreditCard className="h-10 w-10 mx-auto text-slate-300" />
            <p className="text-xs font-bold">Tidak ada data hutang yang sesuai filter</p>
            <button
              type="button"
              onClick={() => handleOpenForm()}
              className="text-xs font-bold text-amber-650 hover:underline"
            >
              Tambah Catatan Hutang Baru
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDebts.map(debt => {
              const dueStatus = getDueDateStatus(debt);
              const progressPct = debt.principalAmount > 0 
                ? Math.min(100, Math.round(((debt.principalAmount - debt.remainingAmount) / debt.principalAmount) * 100))
                : 100;
              const catMeta = CATEGORY_LABELS[debt.category] || CATEGORY_LABELS.other;

              return (
                <div 
                  key={debt.id} 
                  className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs ${
                    debt.status === 'paid_off' 
                      ? 'bg-slate-50/70 border-slate-200 opacity-80' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Info, Category & Name */}
                    <div className="space-y-1.5 min-w-0 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${catMeta.bg} ${catMeta.color}`}>
                          {catMeta.label}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {DEBT_TYPE_LABELS[debt.debtType]?.short || 'Bulanan'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                          debt.status === 'paid_off'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {debt.status === 'paid_off' ? '✓ Lunas' : 'Aktif Berjalan'}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                        {debt.name}
                      </h3>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                        <span>Kreditur: <strong className="text-slate-700">{debt.lenderName}</strong></span>
                        <span>•</span>
                        <span>Mulai: {debt.startDate}</span>
                        {debt.notes && (
                          <>
                            <span>•</span>
                            <span className="italic text-slate-400">"{debt.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle: Numbers & Calculations */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left lg:text-right shrink-0">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Pokok</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">
                          {formatRupiah(debt.principalAmount)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Sisa Pokok</span>
                        <span className={`text-xs sm:text-sm font-black font-mono block ${
                          debt.remainingAmount === 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          {formatRupiah(debt.remainingAmount)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Cicilan / Bulan</span>
                        <span className="text-xs sm:text-sm font-black text-indigo-700 font-mono block">
                          {formatRupiah(debt.monthlyInstallment)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Jatuh Tempo</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md inline-block mt-0.5 border ${dueStatus.badgeBg} ${dueStatus.badgeText} ${dueStatus.badgeBorder}`}>
                          Tgl {debt.dueDayOfMonth} ({dueStatus.label})
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 self-end lg:self-center shrink-0">
                      {debt.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentModal(debt)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Catat Pembayaran Cicilan"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Bayar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setHistoryModalDebt(debt)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        title="Lihat Riwayat Pembayaran"
                      >
                        <History className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenForm(debt)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        title="Edit Data Hutang"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDebt(debt.id, debt.name)}
                        className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-xl transition cursor-pointer"
                        title="Hapus Catatan Hutang"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Tenor info */}
                  <div className="mt-3 pt-2.5 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Angsuran {debt.paidMonths} dari {debt.tenorMonths} bulan</span>
                        <span className="font-mono">{progressPct}% lunas</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-150 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            debt.status === 'paid_off' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 font-bold shrink-0">
                      Beban Tahunan: <span className="font-mono text-slate-700">{formatRupiah(debt.annualInstallment || (debt.monthlyInstallment * 12))}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer info & Sync button */}
        <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Menampilkan {filteredDebts.length} dari {debts.length} catatan hutang (Sheet: <strong>{DEBT_SHEET_TAB_NAME}</strong>)
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRestoreDefaultCafeDebts}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Pulihkan 13 Data Hutang Cafe
            </button>
            <button
              type="button"
              onClick={handleCreateOrUpdateSheetTab}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
            >
              Sinkronkan ke Sheet "{DEBT_SHEET_TAB_NAME}"
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: TAMBAH / EDIT HUTANG */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150 mb-4">
              <h3 className="text-base font-black text-slate-900">
                {editingDebt ? 'Edit Data Hutang' : 'Tambah Catatan Hutang Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDebt} className="space-y-4 text-xs font-semibold text-slate-700">
              {/* Nama Pinjaman */}
              <div>
                <label className="block text-slate-500 mb-1">Nama Hutang / Pinjaman *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Cicilan Mesin Espresso La Marzocco"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900"
                />
              </div>

              {/* Kreditur & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Nama Kreditur / Bank / Supplier</label>
                  <input
                    type="text"
                    value={formLender}
                    onChange={(e) => setFormLender(e.target.value)}
                    placeholder="Contoh: Bank BRI / PT Kopi Nusantara"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Kategori Penggunaan</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as DebtCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900"
                  >
                    <option value="equipment">Mesin & Peralatan</option>
                    <option value="renovation">Renovasi & Tempat</option>
                    <option value="working_capital">Modal Kerja</option>
                    <option value="supplier">Hutang Supplier Bahan</option>
                    <option value="bank_loan">Pinjaman Bank / KUR</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Tipe Hutang & Tanggal Jatuh Tempo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Tipe Pembayaran Hutang</label>
                  <select
                    value={formDebtType}
                    onChange={(e) => setFormDebtType(e.target.value as DebtType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900"
                  >
                    <option value="monthly">Cicilan Bulanan (Monthly)</option>
                    <option value="annual">Beban Tahunan (Annual)</option>
                    <option value="lump_sum">Pelunasan Sekaligus (Tempo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Tanggal Jatuh Tempo per Bulan (1-31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={formDueDay}
                    onChange={(e) => setFormDueDay(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Total Pokok & Sisa Pokok */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Total Pokok Hutang Awal (Rp) *</label>
                  <input
                    type="text"
                    required
                    value={formPrincipal}
                    onChange={(e) => setFormPrincipal(e.target.value)}
                    placeholder="Contoh: 36000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Sisa Pokok Saat Ini (Rp)</label>
                  <input
                    type="text"
                    value={formRemaining}
                    onChange={(e) => setFormRemaining(e.target.value)}
                    placeholder="Biarkan kosong jika sama dengan pokok"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Tenor, Bulan Sudah Bayar & Cicilan Bulanan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Tenor (Bulan)</label>
                  <input
                    type="number"
                    min={1}
                    value={formTenorMonths}
                    onChange={(e) => setFormTenorMonths(e.target.value)}
                    placeholder="12"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Sudah Lunas (Bulan)</label>
                  <input
                    type="number"
                    min={0}
                    value={formPaidMonths}
                    onChange={(e) => setFormPaidMonths(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-500">Cicilan / Bulan (Rp)</label>
                    <button
                      type="button"
                      onClick={handleAutoCalcInstallment}
                      className="text-[10px] text-amber-650 hover:underline font-bold"
                    >
                      Hitung Rata
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formMonthlyInstallment}
                    onChange={(e) => setFormMonthlyInstallment(e.target.value)}
                    placeholder="Contoh: 1500000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Tanggal Mulai Pinjaman */}
              <div>
                <label className="block text-slate-500 mb-1">Tanggal Mulai Pinjaman</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900"
                />
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-slate-500 mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Contoh: No rekening transfer, nomor kontrak, jaminan BPKB, dsb."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-medium text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-150 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs flex items-center space-x-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingDebt ? 'Simpan Perubahan' : 'Tambahkan Hutang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BAYAR ANGSURAN */}
      {paymentModalDebt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Catat Pembayaran Cicilan</h3>
                <p className="text-xs text-slate-500 font-medium">{paymentModalDebt.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalDebt(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                <div className="flex justify-between mb-1">
                  <span>Sisa Pokok Saat Ini:</span>
                  <strong className="font-mono">{formatRupiah(paymentModalDebt.remainingAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Angsuran Terjadwal:</span>
                  <strong className="font-mono">{formatRupiah(paymentModalDebt.monthlyInstallment)}</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Nominal yang Dibayarkan (Rp) *</label>
                <input
                  type="text"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-sm font-black text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Tanggal Pembayaran</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Label Periode Pembayaran</label>
                <input
                  type="text"
                  value={paymentPeriod}
                  onChange={(e) => setPaymentPeriod(e.target.value)}
                  placeholder="Contoh: Angsuran ke-4 (Oktober 2026)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Catatan / No Referensi Transfer</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Contoh: Ref BCA 889212 / Bukti di kasir"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-medium text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-150 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalDebt(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xs flex items-center space-x-1"
                >
                  <Check className="h-4 w-4" />
                  <span>Konfirmasi Pembayaran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RIWAYAT PEMBAYARAN */}
      {historyModalDebt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Riwayat Pembayaran Cicilan</h3>
                <p className="text-xs text-slate-500 font-medium">{historyModalDebt.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalDebt(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(!historyModalDebt.paymentLogs || historyModalDebt.paymentLogs.length === 0) ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                Belum ada catatan pembayaran riil yang dicatat untuk pinjaman ini.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {historyModalDebt.paymentLogs.map(log => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900">{log.periodLabel}</div>
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>Dibayar: {log.paymentDate}</span>
                        {log.note && <span className="italic">({log.note})</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-700 font-mono block">
                        {formatRupiah(log.amountPaid)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Berhasil</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-150 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalDebt(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
