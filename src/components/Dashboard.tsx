import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Search, 
  Filter, 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  Tag, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown, 
  Download, 
  Printer,
  Sparkles,
  X,
  AlertTriangle,
  Info,
  Briefcase,
  BarChart2,
  LineChart as LineChartIcon,
  Send,
  MessageSquare,
  User,
  Bot,
  RefreshCw,
  Calculator,
  SlidersHorizontal,
  Check,
  Target,
  CheckCircle2,
  Award,
  Zap,
  CreditCard,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShoppingCart,
  FileText,
  Eye
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Transaction, CATEGORIES, CafeRatioCategoryConfig } from '../types';
import WeeklyFinancialReportCard from './WeeklyFinancialReportCard';
import CafeRatioSettingsModal from './CafeRatioSettingsModal';
import { 
  computeCafeMetricsWithConfig, 
  DEFAULT_CAFE_RATIO_CONFIG 
} from '../utils/cafeKpiUtils';
import { 
  formatRupiah, 
  formatLocalDate, 
  parseDateString,
  getFinancialSummary, 
  aggregateMonthlyData, 
  getCategorySpendDistribution,
  CategoryDistribution
} from '../utils';
import { 
  getStoredDebts, 
  calculateDebtFinancialMetrics, 
  getDueDateStatus 
} from '../utils/debtUtils';
import { 
  SHOPPING_LIST_STORAGE_KEY, 
  DEFAULT_SHOPPING_ITEMS, 
  computeShoppingMetrics 
} from '../utils/shoppingListData';

const CustomRechartsTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-2.5 rounded shadow-xl border border-slate-800 text-[10px] space-y-1 select-none font-sans min-w-[150px]">
        <p className="font-bold border-b border-slate-800 pb-1 mb-1 text-slate-300">
          {data.monthLong}
        </p>
        <div className="flex justify-between space-x-4">
          <span className="text-slate-400 font-bold">Pemasukan (IN):</span>
          <span className="font-bold text-emerald-400 font-mono">{formatRupiah(data.debit)}</span>
        </div>
        <div className="flex justify-between space-x-4">
          <span className="text-slate-400 font-bold">Pengeluaran (OUT):</span>
          <span className="font-bold text-rose-400 font-mono">{formatRupiah(data.kredit)}</span>
        </div>
        <div className="flex justify-between space-x-4 border-t border-slate-800 pt-1 mt-1 font-semibold">
          <span className="text-slate-400 font-bold">Arus Bersih:</span>
          <span className={data.saldo >= 0 ? "text-emerald-400 font-mono" : "text-rose-400 font-mono"}>
            {formatRupiah(data.saldo)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardProps {
  transactions: Transaction[];
  onAddTransaction: () => void;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  spreadsheetUrl: string | null;
  categories: string[];
  onManageCategories: () => void;
  onNavigateToDebt?: () => void;
  onNavigateToShopping?: () => void;
  onRefresh?: () => Promise<void>;
  isLoadingData?: boolean;
}

export default function Dashboard({ 
  transactions, 
  onAddTransaction, 
  onEditTransaction, 
  onDeleteTransaction,
  spreadsheetUrl,
  categories,
  onManageCategories,
  onNavigateToDebt,
  onNavigateToShopping,
  onRefresh,
  isLoadingData
}: DashboardProps) {
  
  // Shopping items notification metrics from Sheet 4
  const shoppingMetrics = useMemo(() => {
    try {
      const saved = localStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
      const items = saved ? JSON.parse(saved) : DEFAULT_SHOPPING_ITEMS;
      if (Array.isArray(items)) {
        return computeShoppingMetrics(items);
      }
    } catch {}
    return {
      totalItems: 0,
      needToBuyCount: 0,
      urgentCount: 0,
      purchasedCount: 0,
      totalEstimatedBudget: 0,
      lowStockItemsCount: 0
    };
  }, []);

  // States for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debit' | 'kredit'>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('all');
  const [filterOpMan, setFilterOpMan] = useState<'all' | 'Operasional' | 'Manajemen' | '-'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return localStorage.getItem('aruskas_selected_dashboard_month') || 'all';
  });
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // AI Analyst State
  const [aiSummary, setAiSummary] = useState<string>(() => {
    return localStorage.getItem('aruskas_ai_summary') || '';
  });
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isAiSummaryMinimized, setIsAiSummaryMinimized] = useState<boolean>(() => {
    return localStorage.getItem('aruskas_ai_minimized') === 'true';
  });

  const [customQuestion, setCustomQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; content: string }[]>(() => {
    const saved = localStorage.getItem('aruskas_dashboard_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const toggleAiSummaryMinimize = () => {
    setIsAiSummaryMinimized(prev => {
      const next = !prev;
      localStorage.setItem('aruskas_ai_minimized', String(next));
      return next;
    });
  };

  const handleSendCustomQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;
    setChatLoading(true);
    const newUserMessage = { role: 'user' as const, content: questionText };
    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);
    setCustomQuestion('');
    setSummaryError(null);

    try {
      const context = {
        totalDebit: cafeMetrics.totalSales,
        totalKredit: cafeMetrics.totalExpensesCalculated,
        saldo: cafeMetrics.netProfit,
        netProfitMargin: cafeMetrics.netProfitMargin,
        cogsRatio: cafeMetrics.cogsRatio,
        totalCOGSDrink: cafeMetrics.totalCOGSDrink,
        cogsDrinkRatio: cafeMetrics.cogsDrinkRatio,
        totalCOGSFood: cafeMetrics.totalCOGSFood,
        cogsFoodRatio: cafeMetrics.cogsFoodRatio,
        totalCOGSSnack: cafeMetrics.totalCOGSSnack,
        cogsSnackRatio: cafeMetrics.cogsSnackRatio,
        totalWages: cafeMetrics.totalWages,
        wagesRatio: cafeMetrics.wagesRatio,
        totalOperasional: cafeMetrics.totalOperasional,
        operasionalRatio: cafeMetrics.operasionalRatio
      };

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          context
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal mengirim pesan ke AI.');
      }

      const data = await response.json();
      const newAiMessage = { role: 'model' as const, content: data.reply };
      const finalMessages = [...updatedMessages, newAiMessage];
      setChatMessages(finalMessages);
      localStorage.setItem('aruskas_dashboard_chat_history', JSON.stringify(finalMessages));
    } catch (err: any) {
      console.error(err);
      setSummaryError(err.message || 'Gagal mendapatkan analisis dari asisten AI.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearDashboardChat = () => {
    if (window.confirm('Hapus seluruh riwayat obrolan analisis di dasbor?')) {
      setChatMessages([]);
      localStorage.removeItem('aruskas_dashboard_chat_history');
    }
  };

  const generateAISummary = async () => {
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      const response = await fetch('/api/gemini/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stats: filteredStats,
          metrics: cafeMetrics,
          categorySpend: categorySpend.slice(0, 5),
          monthlyData: monthlyData,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal memproses analisis AI.');
      }

      const data = await response.json();
      setAiSummary(data.summary);
      localStorage.setItem('aruskas_ai_summary', data.summary);
    } catch (err: any) {
      console.error(err);
      setSummaryError(err.message || 'Gagal menghubungi asisten AI.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const parseInlineStyles = (txt: string) => {
    const parts = txt.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderFormattedSummary = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const cleanContent = trimmed.replace(/^[-*]\s*/, '');
        return (
          <li key={idx} className="ml-4 list-disc pl-1 mb-1 text-xs text-slate-700 leading-relaxed font-medium">
            {parseInlineStyles(cleanContent)}
          </li>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal pl-1 mb-1 text-xs text-slate-700 leading-relaxed font-medium">
            {parseInlineStyles(numMatch[2])}
          </li>
        );
      }
      if (trimmed.startsWith('#')) {
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        const cleanHeading = trimmed.replace(/^#+\s*/, '');
        const headingClass = level === 1 ? "text-sm font-black text-slate-900 mt-4 mb-2 uppercase tracking-wide" :
                             level === 2 ? "text-xs font-black text-slate-900 mt-3 mb-1.5 border-b border-slate-100 pb-1" :
                             "text-[11px] font-bold text-slate-800 mt-2 mb-1";
        return (
          <p key={idx} className={headingClass}>
            {parseInlineStyles(cleanHeading)}
          </p>
        );
      }
      if (!trimmed) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-xs text-slate-650 leading-relaxed mb-1.5 font-medium">
          {parseInlineStyles(trimmed)}
        </p>
      );
    });
  };

  // Chart interactivity state
  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);
  const [chartView, setChartView] = useState<'line' | 'bar'>('line');

  // States for expanding metric details
  const [showCogsDetail, setShowCogsDetail] = useState(false);
  const [showWagesDetail, setShowWagesDetail] = useState(false);
  const [showOperasionalDetail, setShowOperasionalDetail] = useState(false);
  const [showProfitabilityDetail, setShowProfitabilityDetail] = useState(false);

  // Cafe Business KPI & Ratio Category Configuration (Manual vs Auto)
  const [ratioConfig, setRatioConfig] = useState<CafeRatioCategoryConfig>(() => {
    const saved = localStorage.getItem('aruskas_cafe_kpi_ratio_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_CAFE_RATIO_CONFIG;
  });
  const [isRatioSettingsModalOpen, setIsRatioSettingsModalOpen] = useState(false);

  // Target Omset Bulanan State (Persisted in localStorage with editable input)
  const [targetOmsetBulanan, setTargetOmsetBulanan] = useState<number>(() => {
    const saved = localStorage.getItem('aruskas_target_omset_bulanan');
    if (saved) {
      const num = Number(saved);
      if (!isNaN(num) && num > 0) return num;
    }
    return 30000000; // Default Rp 30.000.000 / bulan
  });
  const [isEditingTargetOmset, setIsEditingTargetOmset] = useState(false);
  const [tempTargetOmset, setTempTargetOmset] = useState<string>(() => String(targetOmsetBulanan));

  const handleSaveTargetOmset = () => {
    const parsed = Number(tempTargetOmset.replace(/\D/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      setTargetOmsetBulanan(parsed);
      localStorage.setItem('aruskas_target_omset_bulanan', String(parsed));
    }
    setIsEditingTargetOmset(false);
  };

  const handleSaveRatioConfig = (newConfig: CafeRatioCategoryConfig) => {
    setRatioConfig(newConfig);
    localStorage.setItem('aruskas_cafe_kpi_ratio_config', JSON.stringify(newConfig));
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Quick preset filtering
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Reset page when filters change
  const handleFilterChange = (updater: () => void) => {
    updater();
    setCurrentPage(1);
  };

  const monthNamesList = useMemo(() => [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ], []);

  const thisMonthLabel = useMemo(() => {
    const now = new Date();
    return `${monthNamesList[now.getMonth()]} ${now.getFullYear()}`;
  }, [monthNamesList]);

  const lastMonthLabel = useMemo(() => {
    const now = new Date();
    const lM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return `${monthNamesList[lM]} ${lY}`;
  }, [monthNamesList]);

  // Transaction count per month
  const monthTransactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.tanggal) {
        const d = parseDateString(t.tanggal);
        if (d && !isNaN(d.getTime())) {
          const label = `${monthNamesList[d.getMonth()]} ${d.getFullYear()}`;
          counts[label] = (counts[label] || 0) + 1;
        }
      }
    });
    return counts;
  }, [transactions, monthNamesList]);

  // Extract list of unique months for the dashboard filter (including current active month)
  const uniqueMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Ensure current month is always present in list
    monthsSet.add(thisMonthLabel);

    transactions.forEach(t => {
      if (t.tanggal) {
        const date = parseDateString(t.tanggal);
        if (date && !isNaN(date.getTime())) {
          const year = date.getFullYear();
          const monthNum = date.getMonth(); // 0-indexed
          const monthName = monthNamesList[monthNum];
          if (monthName) {
            monthsSet.add(`${monthName} ${year}`);
          }
        }
      }
    });

    // Sort chronologically descending (newest first)
    return Array.from(monthsSet).sort((a, b) => {
      const [mNameA, yStrA] = a.split(' ');
      const [mNameB, yStrB] = b.split(' ');
      const yearA = parseInt(yStrA, 10);
      const yearB = parseInt(yStrB, 10);
      if (yearA !== yearB) return yearB - yearA;
      const mIdxA = monthNamesList.indexOf(mNameA);
      const mIdxB = monthNamesList.indexOf(mNameB);
      return mIdxB - mIdxA;
    });
  }, [transactions, thisMonthLabel, monthNamesList]);

  const handleMonthSelect = (month: string) => {
    handleFilterChange(() => {
      setSelectedMonth(month);
      localStorage.setItem('aruskas_selected_dashboard_month', month);
      setQuickFilter('all');
      setStartDate('');
      setEndDate('');
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const now = new Date();
    let currentM = now.getMonth();
    let currentY = now.getFullYear();

    if (selectedMonth !== 'all') {
      const [mName, yStr] = selectedMonth.split(' ');
      const mIdx = monthNamesList.indexOf(mName);
      if (mIdx >= 0) currentM = mIdx;
      const parsedY = parseInt(yStr, 10);
      if (!isNaN(parsedY)) currentY = parsedY;
    }

    let targetM = direction === 'prev' ? currentM - 1 : currentM + 1;
    let targetY = currentY;
    if (targetM < 0) {
      targetM = 11;
      targetY -= 1;
    } else if (targetM > 11) {
      targetM = 0;
      targetY += 1;
    }

    const targetLabel = `${monthNamesList[targetM]} ${targetY}`;
    handleMonthSelect(targetLabel);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const transactionDate = parseDateString(t.tanggal);
      
      // Term Search filter
      const matchesSearch = t.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.jenisPengeluaran.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (t.jenisPengeluaran2 || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Category filter
      const matchesCategory = selectedCategory === 'all' || 
                              t.jenisPengeluaran === selectedCategory || 
                              t.jenisPengeluaran2 === selectedCategory;

      // Type filter
      const matchesType = filterType === 'all' || 
                         (filterType === 'debit' && t.debit > 0) || 
                         (filterType === 'kredit' && (t.kredit > 0 || (t.kredit2 || 0) > 0));

      // Manual Date filter
      let matchesManualDate = true;
      if (startDate) {
        const startLimit = parseDateString(startDate);
        startLimit.setHours(0, 0, 0, 0);
        const tDate = new Date(transactionDate);
        tDate.setHours(0, 0, 0, 0);
        matchesManualDate = matchesManualDate && tDate.getTime() >= startLimit.getTime();
      }
      if (endDate) {
        const endLimit = parseDateString(endDate);
        endLimit.setHours(23, 59, 59, 999);
        const tDate = new Date(transactionDate);
        matchesManualDate = matchesManualDate && tDate.getTime() <= endLimit.getTime();
      }

      // Quick Preset date filter
      let matchesQuickPreset = true;
      if (quickFilter === 'this_month') {
        matchesQuickPreset = transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
      } else if (quickFilter === 'last_month') {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        matchesQuickPreset = transactionDate.getMonth() === lastMonth && transactionDate.getFullYear() === lastMonthYear;
      } else if (quickFilter === 'this_year') {
        matchesQuickPreset = transactionDate.getFullYear() === currentYear;
      }

      // Operasional & Manajemen filter
      const matchesOpMan = filterOpMan === 'all' || t.operasionalDanManajemen === filterOpMan;

      // Selected Month filter
      let matchesSelectedMonth = true;
      if (selectedMonth !== 'all') {
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const tYear = transactionDate.getFullYear();
        const tMonthNum = transactionDate.getMonth();
        const tMonthName = monthNames[tMonthNum];
        const tMonthLabel = `${tMonthName} ${tYear}`;
        matchesSelectedMonth = tMonthLabel === selectedMonth;
      }

      return matchesSearch && matchesCategory && matchesType && matchesManualDate && matchesQuickPreset && matchesOpMan && matchesSelectedMonth;
    });
  }, [transactions, searchTerm, selectedCategory, filterType, startDate, endDate, quickFilter, filterOpMan, selectedMonth, currentMonth, currentYear]);

  // Statistics calculated purely on the filtered transactions to make the dashboard highly interactive
  const filteredStats = useMemo(() => getFinancialSummary(filteredTransactions), [filteredTransactions]);
  // Statistics calculated on all transactions for global reference
  const globalStats = useMemo(() => getFinancialSummary(transactions), [transactions]);

  // Current Month Actual Omset & Target Achievement Metrics
  const monthlyOmsetMetrics = useMemo(() => {
    // Determine active target month: if selectedMonth is not 'all', use selectedMonth, otherwise use current active calendar month
    const now = new Date();
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    let activeMonthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    let isFilteredByMonth = false;

    if (selectedMonth && selectedMonth !== 'all') {
      activeMonthLabel = selectedMonth;
      isFilteredByMonth = true;
    } else if (quickFilter === 'this_month') {
      activeMonthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    } else if (quickFilter === 'last_month') {
      const lMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const lYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      activeMonthLabel = `${monthNames[lMonth]} ${lYear}`;
    }

    // Filter transactions specifically for this target month to compute pure actual omset (Debit)
    const monthTransactions = transactions.filter(t => {
      if (!t.tanggal) return false;
      const d = parseDateString(t.tanggal);
      if (isNaN(d.getTime())) return false;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      return label === activeMonthLabel;
    });

    const actualDebit = monthTransactions.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
    const actualExpense = monthTransactions.reduce((sum, t) => sum + ((Number(t.kredit) || 0) + (Number(t.kredit2) || 0)), 0);
    const netCashflow = actualDebit - actualExpense;

    const target = targetOmsetBulanan > 0 ? targetOmsetBulanan : 1;
    const progressPercent = Math.min(Math.round((actualDebit / target) * 1000) / 10, 999.9);
    const remaining = Math.max(target - actualDebit, 0);
    const isAchieved = actualDebit >= target;

    // Day progress in the target month (to assess pace)
    const [mName, yStr] = activeMonthLabel.split(' ');
    const mIndex = monthNames.indexOf(mName);
    const targetYear = parseInt(yStr, 10) || now.getFullYear();
    const totalDaysInMonth = new Date(targetYear, (mIndex >= 0 ? mIndex : now.getMonth()) + 1, 0).getDate();
    
    const isCurrentActiveMonth = (mIndex === now.getMonth() && targetYear === now.getFullYear());
    const currentDay = isCurrentActiveMonth ? now.getDate() : totalDaysInMonth;
    const daysRemaining = isCurrentActiveMonth ? Math.max(totalDaysInMonth - currentDay, 0) : 0;
    const dailyTargetNeeded = daysRemaining > 0 && remaining > 0 ? Math.ceil(remaining / daysRemaining) : 0;
    const currentDailyAverage = currentDay > 0 ? Math.round(actualDebit / currentDay) : 0;
    const projectedOmset = currentDailyAverage * totalDaysInMonth;

    return {
      monthLabel: activeMonthLabel,
      actualDebit,
      actualExpense,
      netCashflow,
      target,
      progressPercent,
      remaining,
      isAchieved,
      currentDay,
      totalDaysInMonth,
      daysRemaining,
      dailyTargetNeeded,
      currentDailyAverage,
      projectedOmset,
      isCurrentActiveMonth
    };
  }, [transactions, selectedMonth, quickFilter, targetOmsetBulanan]);

  // Debt & Liability Overview for Dashboard
  const debtDashboardSummary = useMemo(() => {
    try {
      const storedDebts = getStoredDebts();
      const metrics = calculateDebtFinancialMetrics(storedDebts, transactions);
      const now = new Date();
      
      const upcomingDebts = storedDebts
        .filter(d => d.status === 'active')
        .map(d => ({
          debt: d,
          dueStatus: getDueDateStatus(d, now)
        }))
        .sort((a, b) => a.dueStatus.daysUntilDue - b.dueStatus.daysUntilDue);

      const urgentAlerts = upcomingDebts.filter(u => 
        u.dueStatus.status === 'overdue' || u.dueStatus.status === 'due_today' || u.dueStatus.status === 'due_soon'
      );

      return {
        metrics,
        totalDebtsCount: storedDebts.length,
        activeDebtsCount: metrics.activeCount,
        upcomingDebts: upcomingDebts.slice(0, 3),
        urgentAlertsCount: urgentAlerts.length,
        urgentAlerts
      };
    } catch {
      return null;
    }
  }, [transactions]);

  // Spend Distribution
  const categorySpend = useMemo(() => getCategorySpendDistribution(filteredTransactions), [filteredTransactions]);

  // Monthly aggregated data for charts
  const monthlyData = useMemo(() => aggregateMonthlyData(filteredTransactions), [filteredTransactions]);

  // Grouped transactions for concise monthly print report
  const groupedPrintTransactions = useMemo(() => {
    interface GroupedItem {
      jenisKlas: string;
      kategori: string;
      debit: number;
      kredit: number;
      count: number;
      earliestDate: string;
      latestDate: string;
    }

    const groups: Record<string, GroupedItem> = {};

    filteredTransactions.forEach(t => {
      const isDebit = t.debit > 0;
      if (isDebit) {
        const jenisKlas = "PEMASUKAN";
        const rawKategori = (t.jenisPengeluaran && t.jenisPengeluaran !== '-') 
          ? t.jenisPengeluaran.trim() 
          : "Cafe Sales / Pendapatan";
        const cleanKategori = rawKategori.toUpperCase();
        const key = `${jenisKlas}::${cleanKategori}`;

        if (!groups[key]) {
          groups[key] = {
            jenisKlas,
            kategori: rawKategori,
            debit: 0,
            kredit: 0,
            count: 0,
            earliestDate: t.tanggal,
            latestDate: t.tanggal
          };
        }
        groups[key].debit += t.debit || 0;
        groups[key].count += 1;
        if (t.tanggal < groups[key].earliestDate) groups[key].earliestDate = t.tanggal;
        if (t.tanggal > groups[key].latestDate) groups[key].latestDate = t.tanggal;
      } else {
        // Primary credit
        if (t.kredit > 0) {
          const jenisKlas = t.operasionalDanManajemen || 'BIASA';
          const rawKategori = (t.jenisPengeluaran || '').trim() || 'Lain-lain';
          const cleanKategori = rawKategori.toUpperCase();
          const key = `${jenisKlas}::${cleanKategori}`;

          if (!groups[key]) {
            groups[key] = {
              jenisKlas,
              kategori: rawKategori,
              debit: 0,
              kredit: 0,
              count: 0,
              earliestDate: t.tanggal,
              latestDate: t.tanggal
            };
          }
          groups[key].kredit += t.kredit;
          groups[key].count += 1;
          if (t.tanggal < groups[key].earliestDate) groups[key].earliestDate = t.tanggal;
          if (t.tanggal > groups[key].latestDate) groups[key].latestDate = t.tanggal;
        }

        // Secondary credit
        if (t.kredit2 > 0) {
          const jenisKlas = t.operasionalDanManajemen || 'BIASA';
          const rawKategori = (t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-') 
            ? t.jenisPengeluaran2.trim() 
            : ((t.jenisPengeluaran || '').trim() || 'Lain-lain');
          const cleanKategori = rawKategori.toUpperCase();
          const key = `${jenisKlas}::${cleanKategori}`;

          if (!groups[key]) {
            groups[key] = {
              jenisKlas,
              kategori: rawKategori,
              debit: 0,
              kredit: 0,
              count: 0,
              earliestDate: t.tanggal,
              latestDate: t.tanggal
            };
          }
          groups[key].kredit += t.kredit2;
          if (cleanKategori !== (t.jenisPengeluaran || '').trim().toUpperCase() || t.kredit <= 0) {
            groups[key].count += 1;
          }
          if (t.tanggal < groups[key].earliestDate) groups[key].earliestDate = t.tanggal;
          if (t.tanggal > groups[key].latestDate) groups[key].latestDate = t.tanggal;
        }
      }
    });

    return Object.values(groups).sort((a, b) => {
      if (a.jenisKlas === "PEMASUKAN" && b.jenisKlas !== "PEMASUKAN") return -1;
      if (a.jenisKlas !== "PEMASUKAN" && b.jenisKlas === "PEMASUKAN") return 1;
      return b.kredit - a.kredit;
    });
  }, [filteredTransactions]);

  // Summary Pengeluaran, Pemasukan, and Unpaid (0-amount) for PDF Print
  const pdfPrintData = useMemo(() => {
    interface AggItem {
      nama: string;
      frekuensi: number;
      total: number;
      presentase: number;
      klasifikasi: string;
      formattedDates: string;
    }

    // Map for Pengeluaran Terbayar (total > 0)
    const pengeluaranMap: Record<string, { displayName: string; frekuensi: number; total: number; klasifikasiSet: Set<string>; dateSet: Set<string> }> = {};
    // Map for Pengeluaran Belum Terbayar (total === 0)
    const unpaidMap: Record<string, { displayName: string; frekuensi: number; total: number; klasifikasiSet: Set<string>; dateSet: Set<string> }> = {};
    // Map for Pemasukan
    const pemasukanMap: Record<string, { displayName: string; frekuensi: number; total: number; klasifikasiSet: Set<string>; dateSet: Set<string> }> = {};

    filteredTransactions.forEach(t => {
      const debitVal = Number(t.debit) || 0;
      const k1 = Number(t.kredit) || 0;
      const k2 = Number(t.kredit2) || 0;
      const totKredit = k1 + k2;
      const isDebit = debitVal > 0;
      const dateStr = (t.tanggal || '').trim();

      if (isDebit) {
        // Pemasukan: Hanya ambil dari jenisPengeluaran (atau default jika kosong)
        const rawName = (t.jenisPengeluaran && t.jenisPengeluaran.trim() !== '' && t.jenisPengeluaran.trim() !== '-')
          ? t.jenisPengeluaran.trim()
          : 'Pendapatan Kasir / Penjualan POS';
        const normKey = rawName.toUpperCase();

        if (!pemasukanMap[normKey]) {
          pemasukanMap[normKey] = { displayName: rawName, frekuensi: 0, total: 0, klasifikasiSet: new Set(), dateSet: new Set() };
        }
        pemasukanMap[normKey].frekuensi += 1;
        pemasukanMap[normKey].total += debitVal;
        if (dateStr) pemasukanMap[normKey].dateSet.add(dateStr);
        if (t.operasionalDanManajemen && t.operasionalDanManajemen !== '-') {
          pemasukanMap[normKey].klasifikasiSet.add(t.operasionalDanManajemen);
        }
      } else {
        // PENGELUARAN: WAJIB MURNI DARI "PENGELUARAN 1" (t.jenisPengeluaran)!
        // JANGAN PERNAH mengambil t.keterangan atau t.jenisPengeluaran2 karena itu adalah catatan (seperti 'BULAN SEPTEMBER' / '75K')
        const rawName = (t.jenisPengeluaran && t.jenisPengeluaran.trim() !== '' && t.jenisPengeluaran.trim() !== '-')
          ? t.jenisPengeluaran.trim()
          : 'Lain-lain';
        const normKey = rawName.toUpperCase();

        // Jika jumlah nominal 0, masukkan ke tabel berbeda sebagai pengeluaran belum terbayar
        if (totKredit === 0) {
          if (!unpaidMap[normKey]) {
            unpaidMap[normKey] = { displayName: rawName, frekuensi: 0, total: 0, klasifikasiSet: new Set(), dateSet: new Set() };
          }
          unpaidMap[normKey].frekuensi += 1;
          if (dateStr) unpaidMap[normKey].dateSet.add(dateStr);
          if (t.operasionalDanManajemen && t.operasionalDanManajemen !== '-') {
            unpaidMap[normKey].klasifikasiSet.add(t.operasionalDanManajemen);
          }
        } else {
          // Pengeluaran terbayar (total nominal > 0)
          if (!pengeluaranMap[normKey]) {
            pengeluaranMap[normKey] = { displayName: rawName, frekuensi: 0, total: 0, klasifikasiSet: new Set(), dateSet: new Set() };
          }
          pengeluaranMap[normKey].frekuensi += 1;
          pengeluaranMap[normKey].total += totKredit;
          if (dateStr) pengeluaranMap[normKey].dateSet.add(dateStr);
          if (t.operasionalDanManajemen && t.operasionalDanManajemen !== '-') {
            pengeluaranMap[normKey].klasifikasiSet.add(t.operasionalDanManajemen);
          }
        }
      }
    });

    // Helper to format dates string
    const formatDatesList = (dates: Set<string>): string => {
      if (!dates || dates.size === 0) return '-';
      const arr = Array.from(dates).filter(Boolean);
      arr.sort((a, b) => parseDateString(a).getTime() - parseDateString(b).getTime());
      
      const formattedArr = Array.from(new Set(arr.map(d => {
        const dt = parseDateString(d);
        if (!isNaN(dt.getTime())) {
          const dd = String(dt.getDate()).padStart(2, '0');
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const yyyy = dt.getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        }
        return d;
      }).filter(Boolean)));

      if (formattedArr.length === 0) return '-';
      if (formattedArr.length === 1) {
        return formattedArr[0];
      }
      if (formattedArr.length <= 4) {
        return formattedArr.join(', ');
      }
      // If more than 4 dates, show date range with count
      const first = formattedArr[0];
      const last = formattedArr[formattedArr.length - 1];
      return `${first} s.d. ${last} (${formattedArr.length} tgl berbeda)`;
    };

    // 1. Process Pengeluaran Terbayar
    const paidExpensesRaw = Object.values(pengeluaranMap);
    const grandTotalPengeluaran = paidExpensesRaw.reduce((sum, i) => sum + i.total, 0);
    const totalFrekuensiPengeluaran = paidExpensesRaw.reduce((sum, i) => sum + i.frekuensi, 0);

    paidExpensesRaw.sort((a, b) => b.total - a.total);
    const pengeluaranList: AggItem[] = paidExpensesRaw.map(item => ({
      nama: item.displayName,
      frekuensi: item.frekuensi,
      total: item.total,
      presentase: grandTotalPengeluaran > 0 ? parseFloat(((item.total / grandTotalPengeluaran) * 100).toFixed(1)) : 0,
      klasifikasi: Array.from(item.klasifikasiSet).join(', ') || '-',
      formattedDates: formatDatesList(item.dateSet)
    }));

    // 2. Process Pengeluaran Belum Terbayar (Nominal Rp 0)
    const unpaidExpensesRaw = Object.values(unpaidMap);
    unpaidExpensesRaw.sort((a, b) => b.frekuensi - a.frekuensi);
    const unpaidList: AggItem[] = unpaidExpensesRaw.map(item => ({
      nama: item.displayName,
      frekuensi: item.frekuensi,
      total: 0,
      presentase: 0,
      klasifikasi: Array.from(item.klasifikasiSet).join(', ') || '-',
      formattedDates: formatDatesList(item.dateSet)
    }));

    // 3. Process Pemasukan
    const pemasukanRaw = Object.values(pemasukanMap);
    const grandTotalPemasukan = pemasukanRaw.reduce((sum, i) => sum + i.total, 0);
    const totalFrekuensiPemasukan = pemasukanRaw.reduce((sum, i) => sum + i.frekuensi, 0);

    pemasukanRaw.sort((a, b) => b.total - a.total);
    const pemasukanList: AggItem[] = pemasukanRaw.map(item => ({
      nama: item.displayName,
      frekuensi: item.frekuensi,
      total: item.total,
      presentase: grandTotalPemasukan > 0 ? parseFloat(((item.total / grandTotalPemasukan) * 100).toFixed(1)) : 0,
      klasifikasi: Array.from(item.klasifikasiSet).join(', ') || '-',
      formattedDates: formatDatesList(item.dateSet)
    }));

    return {
      pengeluaranList,
      grandTotalPengeluaran,
      totalFrekuensiPengeluaran,
      unpaidList,
      totalFrekuensiUnpaid: unpaidList.reduce((sum, i) => sum + i.frekuensi, 0),
      pemasukanList,
      grandTotalPemasukan,
      totalFrekuensiPemasukan
    };
  }, [filteredTransactions]);

  // Backward compatible alias
  const pengeluaran1Summary = useMemo(() => ({
    list: pdfPrintData.pengeluaranList,
    totalAllKredit: pdfPrintData.grandTotalPengeluaran,
    totalJenis: pdfPrintData.pengeluaranList.length
  }), [pdfPrintData]);

  // Cafe Business Metrics derived from filtered transactions and category configuration
  const cafeMetrics = useMemo(() => {
    return computeCafeMetricsWithConfig(filteredTransactions, ratioConfig);
  }, [filteredTransactions, ratioConfig]);

  // Dynamic AI Financial Condition Analysis for PDF & Dashboard
  const dynamicAiAnalysis = useMemo(() => {
    const netProfit = filteredStats.saldo;
    const isSurplus = netProfit >= 0;
    const npm = cafeMetrics.netProfitMargin;
    const cogs = cafeMetrics.cogsRatio;
    const wages = cafeMetrics.wagesRatio;
    const operasional = cafeMetrics.operasionalRatio;
    const fixedCost = cafeMetrics.totalWages + (cafeMetrics.totalOperasional * 0.6);
    const gpRatio = cafeMetrics.grossProfitMargin / 100;
    const bepTarget = gpRatio > 0 ? fixedCost / gpRatio : 0;
    const isBepAchieved = cafeMetrics.totalSales >= bepTarget;

    const topExpenses = pdfPrintData.pengeluaranList.slice(0, 3);

    return {
      isSurplus,
      netProfit,
      npm,
      cogs,
      wages,
      operasional,
      bepTarget,
      isBepAchieved,
      topExpenses,
      summaryParagraph: isSurplus
        ? `Kondisi keuangan periode ini berada dalam posisi SURPLUS sebesar ${formatRupiah(netProfit)} dengan Net Profit Margin (NPM) mencapai ${npm}%. Kinerja arus kas tergolong sehat dan mampu menopang kebutuhan operasional harian kafe secara mandiri.`
        : `Kondisi keuangan periode ini mengalami DEFISIT sebesar ${formatRupiah(Math.abs(netProfit))} (NPM ${npm}%). Diperlukan pengawasan ketat terhadap pengeluaran harian, pengetatan pos biaya variabel, serta akselerasi omset kasir.`,
      cogsDiagnosis: cogs > 35
        ? `Rasio HPP (COGS) tercatat ${cogs}%, berada di atas batas ideal industri F&B (30% - 35%). Penyumbang HPP terbesar adalah Minuman (${cafeMetrics.cogsDrinkRatio}%) dan Makanan (${cafeMetrics.cogsFoodRatio}%). Disarankan audit stok bahan baku dan standarisasi resep barista.`
        : `Rasio HPP (COGS) terjaga sangat aman di angka ${cogs}% (standar aman F&B: 30% - 35%), mencerminkan efisiensi penggunaan bahan baku yang optimal.`,
      fixedCostDiagnosis: wages > 25
        ? `Biaya gaji staf (${wages}%) melampaui batas wajar 25% omset. Disarankan penyesuaian jadwal shift jam sibuk (peak hours) untuk efisiensi produktivitas.`
        : `Alokasi gaji staf (${wages}%) dan operasional (${operasional}%) terpantau proporsional dan terkendali.`,
      bepDiagnosis: isBepAchieved
        ? `Realisasi omset (${formatRupiah(cafeMetrics.totalSales)}) telah melampaui titik impas BEP (${formatRupiah(bepTarget)}). Setiap tambahan transaksi kasir saat ini langsung berkontribusi pada laba bersih kafe.`
        : `Realisasi omset (${formatRupiah(cafeMetrics.totalSales)}) masih berada di bawah target BEP (${formatRupiah(bepTarget)}). Diperlukan tambahan omset sekitar ${formatRupiah(bepTarget - cafeMetrics.totalSales)} untuk mencapai titik impas operasional.`,
      recommendations: [
        cogs > 35 
          ? 'Terapkan SOP timbangan ketat pada bar barista dan dapur kitchen untuk mencegah waste/pemborosan bahan baku.'
          : 'Pertahankan margin bahan baku dan dorong promosi combo menu ber-margin tinggi (high gross profit).',
        !isBepAchieved
          ? 'Tingkatkan rata-rata nilai transaksi (Average Order Value) melalui program upselling kasir dan promo bundling jam sepi.'
          : 'Alokasikan sebagian surplus laba bersih untuk cadangan kas darurat (emergency fund) dan modal restock bahan baku.',
        pdfPrintData.unpaidList.length > 0
          ? `Terdapat ${pdfPrintData.unpaidList.length} jenis pengeluaran pending/belum terbayar. Segera jadwalkan pelunasan berkala agar tidak mengganggu likuiditas kas periode berikutnya.`
          : 'Disiplin pencatatan transaksi harian sudah sangat baik, pertahankan rekonsiliasi kas kasir setiap pergantian shift.'
      ]
    };
  }, [filteredStats, cafeMetrics, pdfPrintData]);
  // Paginated transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setStartDate('');
    setEndDate('');
    setFilterType('all');
    setQuickFilter('all');
    setFilterOpMan('all');
    setSelectedMonth('all');
    localStorage.setItem('aruskas_selected_dashboard_month', 'all');
    setCurrentPage(1);
  };

  const getFilterPeriodLabel = () => {
    if (selectedMonth !== 'all') return selectedMonth;
    if (quickFilter === 'this_month') return 'Bulan Ini';
    if (quickFilter === 'last_month') return 'Bulan Lalu';
    if (quickFilter === 'this_year') return 'Tahun Ini';
    if (startDate || endDate) {
      return `${startDate ? formatLocalDate(startDate) : 'Mulai'} s.d. ${endDate ? formatLocalDate(endDate) : 'Sekarang'}`;
    }
    return 'Semua Waktu';
  };

  // Quick Preset Handlers
  const handleQuickPreset = (preset: typeof quickFilter) => {
    handleFilterChange(() => {
      setQuickFilter(preset);
      // Clear manual dates if using quick preset
      setStartDate('');
      setEndDate('');
      setSelectedMonth('all');
    });
  };

  // Download filtered transactions summary to CSV
  const handleDownloadCSV = () => {
    let periodName = 'Semua_Waktu';
    if (selectedMonth !== 'all') {
      periodName = selectedMonth.replace(/\s+/g, '_');
    } else if (quickFilter === 'this_month') {
      periodName = 'Bulan_Ini';
    } else if (quickFilter === 'last_month') {
      periodName = 'Bulan_Lalu';
    } else if (quickFilter === 'this_year') {
      periodName = 'Tahun_Ini';
    } else if (startDate || endDate) {
      periodName = `${startDate || 'Mulai'}_sd_${endDate || 'Sampai'}`;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Rangkuman_Transaksi_${periodName}_${timestamp}.csv`;

    // Metadata header comments for easy bookkeeping reference
    const metaHeader = [
      `"LAPORAN REKAPITULASI BASCO CASHFLOW"`,
      `"Tanggal Unduh:","${new Date().toLocaleString('id-ID')}"`,
      `"Periode Filter:","${selectedMonth !== 'all' ? selectedMonth : quickFilter === 'all' ? 'Semua Waktu' : quickFilter === 'this_month' ? 'Bulan Ini' : quickFilter === 'last_month' ? 'Bulan Lalu' : 'Tahun Ini'}"`,
      `"Rentang Tanggal:","${startDate || '-'} s/d ${endDate || '-'}"`,
      `"Pencarian Keterangan/Kategori:","${searchTerm || '-'}"`,
      `"Filter Kategori:","${selectedCategory === 'all' ? 'Semua Kategori' : selectedCategory}"`,
      `"Filter Klasifikasi:","${filterOpMan === 'all' ? 'Semua Klasifikasi' : filterOpMan}"`,
      `"Filter Tipe:","${filterType === 'all' ? 'Semua Tipe' : filterType === 'debit' ? 'Pemasukan' : 'Pengeluaran'}"`,
      `"Total Debit (Pemasukan):","${filteredStats.totalDebit}"`,
      `"Total Kredit (Pengeluaran):","${filteredStats.totalKredit}"`,
      `"Saldo Bersih:","${filteredStats.saldo}"`,
      `""` // Spacer line
    ];

    const columnHeaders = [
      "No",
      "Tanggal",
      "Tipe",
      "Klasifikasi",
      "Pengeluaran 1",
      "Kredit 1 (IDR)",
      "Kategori Keterangan",
      "Kredit 2 (IDR)",
      "Keterangan Detail",
      "Debit (IDR)",
      "Total Transaksi (IDR)"
    ];

    const csvRows = [
      ...metaHeader,
      columnHeaders.map(col => `"${col.replace(/"/g, '""')}"`).join(',')
    ];

    filteredTransactions.forEach((t, index) => {
      const isDebit = t.debit > 0;
      const typeLabel = isDebit ? "Pemasukan" : "Pengeluaran";
      const totalAmount = isDebit ? t.debit : (t.kredit + (t.kredit2 || 0));
      
      const row = [
        index + 1,
        t.tanggal,
        typeLabel,
        t.operasionalDanManajemen || "-",
        t.jenisPengeluaran || "-",
        isDebit ? 0 : t.kredit,
        (t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-') ? t.jenisPengeluaran2 : "-",
        isDebit ? 0 : (t.kredit2 || 0),
        t.keterangan || "-",
        isDebit ? t.debit : 0,
        totalAmount
      ];

      const formattedRow = row.map(val => {
        const strVal = String(val === null || val === undefined ? '' : val);
        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(',');

      csvRows.push(formattedRow);
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print handler with temporary document title update
  const handlePrintPDF = () => {
    let periodName = 'Semua_Waktu';
    if (selectedMonth !== 'all') {
      periodName = selectedMonth.replace(/\s+/g, '_');
    } else if (quickFilter === 'this_month') {
      periodName = 'Bulan_Ini';
    } else if (quickFilter === 'last_month') {
      periodName = 'Bulan_Lalu';
    } else if (quickFilter === 'this_year') {
      periodName = 'Tahun_Ini';
    } else if (startDate || endDate) {
      periodName = `${startDate || 'Mulai'}_sd_${endDate || 'Sampai'}`;
    }

    const originalTitle = document.title;
    document.title = `Laporan_Keuangan_Basco_${periodName}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  // Direct download PDF using html2canvas & jsPDF
  const handleDirectDownloadPDF = async () => {
    const reportElem = document.getElementById('print-report-container');
    if (!reportElem) return;

    setIsGeneratingPdf(true);
    try {
      let periodName = 'Semua_Waktu';
      if (selectedMonth !== 'all') {
        periodName = selectedMonth.replace(/\s+/g, '_');
      } else if (quickFilter === 'this_month') {
        periodName = 'Bulan_Ini';
      } else if (quickFilter === 'last_month') {
        periodName = 'Bulan_Lalu';
      } else if (quickFilter === 'this_year') {
        periodName = 'Tahun_Ini';
      }

      // Clone the printable report element to render off-screen with clean styles
      const clone = reportElem.cloneNode(true) as HTMLElement;
      clone.classList.remove('hidden');
      clone.style.display = 'block';
      clone.style.position = 'fixed';
      clone.style.top = '-99999px';
      clone.style.left = '0';
      clone.style.width = '800px';
      clone.style.maxWidth = '800px';
      clone.style.backgroundColor = '#ffffff';
      clone.style.color = '#0f172a';
      clone.style.zIndex = '-9999';
      clone.style.padding = '32px';
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width mm
      const pageHeight = 297; // A4 height mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Laporan_Keuangan_Basco_${periodName}.pdf`);
    } catch (err) {
      console.error("Gagal mengunduh PDF secara langsung, beralih ke print dialog:", err);
      handlePrintPDF();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Delete handler with custom confirmation window
  const handleDeleteClick = async (t: Transaction) => {
    const isDebit = t.debit > 0;
    const totalAmount = isDebit ? t.debit : (t.kredit + (t.kredit2 || 0));
    const confirmation = window.confirm(
      `Hapus transaksi ini?\n\nTanggal: ${formatLocalDate(t.tanggal)}\nKategori: ${t.jenisPengeluaran}${t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-' ? ` & ${t.jenisPengeluaran2}` : ''}\nJumlah: ${formatRupiah(totalAmount)}\nKeterangan: ${t.keterangan || '-'}\n\nTindakan ini akan menghapus baris data di Google Sheets Anda secara permanen.`
    );
    if (confirmation) {
      await onDeleteTransaction(t.id);
    }
  };

  // Custom SVG Bar Chart Calculation
  const chartHeight = 180;
  const paddingBottom = 25;
  const paddingTop = 15;
  
  const maxChartValue = useMemo(() => {
    const vals = monthlyData.flatMap(d => [d.debit, d.kredit]);
    const maxVal = Math.max(...vals);
    return maxVal > 0 ? maxVal * 1.15 : 100000; // 15% padding for peak, min height scale 100k
  }, [monthlyData]);

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden" id="dashboard-root">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Basco Cashflow
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-[10px] text-amber-800 font-bold uppercase tracking-widest">
              Real-time Spreadsheet Dashboard
            </p>
            <span className="text-slate-300">•</span>
            <span className="text-[10px] font-bold text-slate-500">
              Periode: <strong className="text-slate-800">{selectedMonth === 'all' ? 'Semua Bulan' : selectedMonth}</strong>
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
          {spreadsheetUrl && (
            <a 
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded transition flex items-center justify-center space-x-2 w-full sm:w-auto"
              title="Buka Spreadsheet langsung di Google Sheets"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Buka Google Sheets</span>
            </a>
          )}
          <button
            onClick={onManageCategories}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded transition flex items-center justify-center space-x-2 cursor-pointer w-full sm:w-auto"
            id="manage-categories-btn"
            title="Kelola kategori transaksi"
          >
            <Tag className="h-3.5 w-3.5 text-slate-500" />
            <span>Kelola Kategori</span>
          </button>
          <button
            onClick={onAddTransaction}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-650 text-white font-bold text-xs rounded shadow-sm flex items-center justify-center space-x-2 transition cursor-pointer w-full sm:w-auto"
            id="add-transaction-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Transaksi Baru</span>
          </button>
        </div>
      </div>

      {/* PILIHAN TAMPILAN BULAN / MONTH SELECTOR BAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Left: Label & Month Selector Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Pilihan Tampilan Bulan
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-black text-slate-900 tracking-tight">
                    {selectedMonth === 'all' ? 'Semua Bulan (Kumulatif)' : selectedMonth}
                  </span>
                  {selectedMonth === thisMonthLabel && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Bulan Ini
                    </span>
                  )}
                  {selectedMonth === lastMonthLabel && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-sky-100 text-sky-800 border border-sky-200">
                      Bulan Lalu
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Buttons & Dropdown */}
            <div className="flex items-center gap-1.5 sm:ml-2">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 rounded-lg transition cursor-pointer"
                title="Pindah ke Bulan Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="relative min-w-[210px] sm:min-w-[245px]">
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthSelect(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-xs font-black rounded-lg border border-slate-300 text-slate-800 bg-white hover:border-slate-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer shadow-2xs"
                >
                  <option value="all">🌐 Semua Bulan (Kumulatif)</option>
                  {uniqueMonths.map(month => {
                    const count = monthTransactionCounts[month] || 0;
                    const isCurrent = month === thisMonthLabel;
                    return (
                      <option key={month} value={month}>
                        {isCurrent ? `⭐ ${month} (Bulan Ini - ${count} data)` : `📅 ${month} (${count} data)`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <button
                type="button"
                onClick={() => navigateMonth('next')}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 rounded-lg transition cursor-pointer"
                title="Pindah ke Bulan Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right: Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Pintasan:
            </span>

            <button
              type="button"
              onClick={() => handleMonthSelect('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer border ${
                selectedMonth === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-650 hover:bg-slate-100 border-slate-200'
              }`}
            >
              Semua Bulan
            </button>

            <button
              type="button"
              onClick={() => handleMonthSelect(thisMonthLabel)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer border ${
                selectedMonth === thisMonthLabel
                  ? 'bg-amber-800 text-white border-amber-800 shadow-xs'
                  : 'bg-slate-50 text-slate-650 hover:bg-slate-100 border-slate-200'
              }`}
            >
              Bulan Ini
            </button>

            <button
              type="button"
              onClick={() => handleMonthSelect(lastMonthLabel)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer border ${
                selectedMonth === lastMonthLabel
                  ? 'bg-amber-800 text-white border-amber-800 shadow-xs'
                  : 'bg-slate-50 text-slate-650 hover:bg-slate-100 border-slate-200'
              }`}
            >
              Bulan Lalu
            </button>

            {selectedMonth !== 'all' && (
              <button
                type="button"
                onClick={() => handleMonthSelect('all')}
                className="px-2.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                title="Kembalikan ke Semua Bulan"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reset Bulan</span>
              </button>
            )}
          </div>

        </div>

        {/* Selected Month Summary Info */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 font-medium">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
            <span>
              {selectedMonth === 'all' ? (
                <>Menampilkan data kas <strong>seluruh bulan (kumulatif)</strong> ({filteredTransactions.length} baris transaksi).</>
              ) : (
                <>Data kas difokuskan untuk periode <strong>{selectedMonth}</strong> ({filteredTransactions.length} transaksi).</>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-emerald-700 font-bold">Debit: {formatRupiah(filteredStats.totalDebit)}</span>
            <span className="text-slate-300">|</span>
            <span className="text-rose-700 font-bold">Kredit: {formatRupiah(filteredStats.totalKredit)}</span>
          </div>
        </div>
      </div>

      {/* NOTIFIKASI BAHAN YANG HARUS DIBELANJAKAN (SHEET 4) */}
      {shoppingMetrics.urgentCount > 0 && (
        <div className="bg-linear-to-r from-rose-500/10 via-amber-500/10 to-rose-500/10 border border-rose-300 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-xs shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                  Notifikasi Belanja Bahan (Sheet 4): {shoppingMetrics.urgentCount} Bahan Mendesak Perlu Dibeli!
                </span>
                <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-300 animate-pulse">
                  Stok Kritis
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Total {shoppingMetrics.needToBuyCount} bahan menunggu pengadaan dengan estimasi anggaran Rp{shoppingMetrics.totalEstimatedBudget.toLocaleString('id-ID')}. Data tersinkron dari spreadsheet Sheet 4.
              </p>
            </div>
          </div>
          {onNavigateToShopping && (
            <button
              type="button"
              onClick={onNavigateToShopping}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 shrink-0 shadow-2xs"
            >
              <span>Buka Laporan Belanja</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* CORE FINANCIALS GRID (GEOMETRIC FLAT CARDS STYLE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* TOTAL DEBIT (PEMASUKAN) */}
        <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between min-h-[120px] transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Total Debit
            </span>
            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate max-w-[110px]" title={selectedMonth === 'all' ? 'Semua Waktu' : selectedMonth}>
              {selectedMonth === 'all' ? 'Semua Waktu' : selectedMonth}
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 truncate mt-2">
            {formatRupiah(filteredStats.totalDebit)}
          </h3>
          <div className="w-full h-1 bg-emerald-100 mt-2">
            <div className="w-3/4 h-full bg-emerald-500"></div>
          </div>
        </div>

        {/* TOTAL KREDIT (PENGELUARAN) */}
        <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between min-h-[120px] transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Total Kredit
            </span>
            <span className="text-[9px] font-bold text-red-800 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 truncate max-w-[110px]" title={selectedMonth === 'all' ? 'Semua Waktu' : selectedMonth}>
              {selectedMonth === 'all' ? 'Semua Waktu' : selectedMonth}
            </span>
          </div>
          <h3 className="text-2xl font-black text-red-500 truncate mt-2">
            {formatRupiah(filteredStats.totalKredit)}
          </h3>
          <div className="w-full h-1 bg-red-100 mt-2">
            <div className="w-1/2 h-full bg-red-500"></div>
          </div>
        </div>

        {/* SALDO BERSIH */}
        <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between min-h-[120px] transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Saldo Bersih
            </span>
            <span className="text-[9px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[110px]" title={selectedMonth === 'all' ? 'Semua Waktu' : selectedMonth}>
              {selectedMonth === 'all' ? 'Semua Waktu' : selectedMonth}
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 truncate mt-2">
            {formatRupiah(filteredStats.saldo)}
          </h3>
          <div className="w-full h-1 bg-slate-100 mt-2">
            <div className="w-1/4 h-full bg-slate-900"></div>
          </div>
        </div>

        {/* STATUS REAL-TIME (SLATE CARD) */}
        <div className="bg-slate-900 p-4 rounded flex flex-col justify-center items-center text-center min-h-[120px] border border-slate-800">
          <p className="text-white text-center font-bold text-xs leading-tight uppercase tracking-widest">
            STATUS REAL-TIME:<br/>
            <span className="text-emerald-400 text-[10px] font-black tracking-widest animate-pulse mt-1.5 inline-block">● SYNCED WITH SPREADSHEET</span>
          </p>
          <span className="text-slate-400 text-[10px] font-mono mt-1.5">
            {filteredTransactions.length} Transaksi Terpilih
          </span>
        </div>

      </div>

      {/* TARGET OMSET BULANAN & PROGRESS BAR CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs relative overflow-hidden">
        {/* Subtle Ambient Accent */}
        <div 
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            monthlyOmsetMetrics.isAchieved 
              ? 'bg-emerald-500' 
              : monthlyOmsetMetrics.progressPercent >= 75 
                ? 'bg-amber-500' 
                : 'bg-indigo-600'
          }`}
        />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-150">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              monthlyOmsetMetrics.isAchieved 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-indigo-50 text-indigo-700'
            }`}>
              <Target className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Target Omset Bulanan: {monthlyOmsetMetrics.monthLabel}
                </h3>
                {selectedMonth === 'all' && (
                  <button
                    type="button"
                    onClick={() => handleMonthSelect(monthlyOmsetMetrics.monthLabel)}
                    className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 transition"
                    title={`Klik untuk memfokuskan seluruh kartu dashboard ke bulan ${monthlyOmsetMetrics.monthLabel}`}
                  >
                    Fokuskan dashboard ke {monthlyOmsetMetrics.monthLabel} →
                  </button>
                )}
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black tracking-wider uppercase inline-flex items-center gap-1 ${
                  monthlyOmsetMetrics.isAchieved
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : monthlyOmsetMetrics.progressPercent >= 75
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}>
                  {monthlyOmsetMetrics.isAchieved ? (
                    <>
                      <Award className="h-3 w-3 text-emerald-700" />
                      Target Tercapai!
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 text-indigo-600" />
                      Pencapaian {monthlyOmsetMetrics.progressPercent}%
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Pencapaian penerimaan kas/penjualan kotor vs target penjualan yang ditetapkan untuk periode {monthlyOmsetMetrics.monthLabel}
              </p>
            </div>
          </div>

          {/* Quick Target Editor */}
          <div className="flex items-center gap-2 self-start lg:self-center">
            {isEditingTargetOmset ? (
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-300">
                <span className="text-xs font-bold text-slate-500 pl-2">Rp</span>
                <input
                  type="text"
                  value={tempTargetOmset}
                  onChange={(e) => setTempTargetOmset(e.target.value)}
                  placeholder="Target (Rp)"
                  className="w-32 sm:w-36 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTargetOmset}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Simpan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTargetOmset(false)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempTargetOmset(String(targetOmsetBulanan));
                  setIsEditingTargetOmset(true);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-1.5"
                title="Klik untuk mengubah nilai target omset bulanan"
              >
                <Edit2 className="h-3 w-3 text-slate-500" />
                <span>Atur Target ({formatRupiah(targetOmsetBulanan)})</span>
              </button>
            )}
          </div>
        </div>

        {/* Big Progress Bar Visualization */}
        <div className="mt-5 space-y-2">
          <div className="flex justify-between items-baseline text-xs font-bold">
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 font-semibold">Omset Terkumpul:</span>
              <span className="text-xl font-black text-slate-900 font-mono tracking-tight">
                {formatRupiah(monthlyOmsetMetrics.actualDebit)}
              </span>
            </div>
            <div className="flex items-baseline gap-2 text-right">
              <span className="text-slate-500 font-semibold">Target:</span>
              <span className="text-lg font-black text-indigo-700 font-mono">
                {formatRupiah(monthlyOmsetMetrics.target)}
              </span>
            </div>
          </div>

          {/* Graphical Progress Track */}
          <div className="w-full h-4 bg-slate-150 rounded-full overflow-hidden p-0.5 relative shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out relative ${
                monthlyOmsetMetrics.isAchieved
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : monthlyOmsetMetrics.progressPercent >= 75
                    ? 'bg-gradient-to-r from-amber-500 to-emerald-500'
                    : monthlyOmsetMetrics.progressPercent >= 40
                      ? 'bg-gradient-to-r from-indigo-500 to-amber-500'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-400'
              }`}
              style={{ width: `${Math.min(monthlyOmsetMetrics.progressPercent, 100)}%` }}
            >
              {/* Shimmer light effect inside progress bar */}
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          {/* Sub-markers under progress bar */}
          <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span className="font-extrabold text-slate-600">100% (Target)</span>
          </div>
        </div>

        {/* 4 Informative Operational Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Persentase Capaian
            </span>
            <span className={`text-base font-black font-mono mt-0.5 block ${
              monthlyOmsetMetrics.isAchieved ? 'text-emerald-700' : 'text-indigo-700'
            }`}>
              {monthlyOmsetMetrics.progressPercent}%
            </span>
            <span className="text-[9px] text-slate-500 font-medium">
              {monthlyOmsetMetrics.isAchieved ? 'Melampaui target' : `${(100 - monthlyOmsetMetrics.progressPercent).toFixed(1)}% lagi menuju 100%`}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Kekurangan Omset
            </span>
            <span className={`text-base font-black font-mono mt-0.5 block ${
              monthlyOmsetMetrics.remaining === 0 ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {monthlyOmsetMetrics.remaining === 0 ? 'Lunas (0)' : formatRupiah(monthlyOmsetMetrics.remaining)}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">
              {monthlyOmsetMetrics.remaining === 0 ? 'Target terpenuhi sempurna' : 'Nominal selisih target'}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Rata-rata Harian
            </span>
            <span className="text-base font-black font-mono text-slate-900 mt-0.5 block">
              {formatRupiah(monthlyOmsetMetrics.currentDailyAverage)}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">
              Berjalan {monthlyOmsetMetrics.currentDay} dari {monthlyOmsetMetrics.totalDaysInMonth} hari
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              {monthlyOmsetMetrics.daysRemaining > 0 ? 'Target Harian Sisa' : 'Proyeksi Akhir Bulan'}
            </span>
            <span className={`text-base font-black font-mono mt-0.5 block ${
              monthlyOmsetMetrics.isAchieved ? 'text-emerald-700' : 'text-indigo-900'
            }`}>
              {monthlyOmsetMetrics.daysRemaining > 0 
                ? (monthlyOmsetMetrics.dailyTargetNeeded > 0 ? formatRupiah(monthlyOmsetMetrics.dailyTargetNeeded) : 'Tercapai')
                : formatRupiah(monthlyOmsetMetrics.projectedOmset)}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">
              {monthlyOmsetMetrics.daysRemaining > 0 
                ? `Per hari s/d ${monthlyOmsetMetrics.daysRemaining} hari sisa` 
                : 'Berdasarkan ritme saat ini'}
            </span>
          </div>
        </div>
      </div>

      {/* RINGKASAN HUTANG & EVALUASI KELAYAKAN AI */}
      {debtDashboardSummary && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs relative overflow-hidden" id="dashboard-debt-overview-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Liabilitas & Kalkulasi Hutang Cafe
                  </h3>
                  {debtDashboardSummary.urgentAlertsCount > 0 ? (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black tracking-wider uppercase bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1 animate-pulse">
                      <Clock className="h-3 w-3" />
                      {debtDashboardSummary.urgentAlertsCount} Jatuh Tempo
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {debtDashboardSummary.activeDebtsCount} Hutang Aktif
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pemantauan kewajiban cicilan bulanan, tanggal pembayaran & analisis kesehatan rasio berhutang
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {debtDashboardSummary.metrics.safetyStatus === 'safe' ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>AI: Aman Berhutang</span>
                </div>
              ) : debtDashboardSummary.metrics.safetyStatus === 'caution' ? (
                <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold inline-flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>AI: Waspada Cicilan</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold inline-flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <span>AI: Bahaya / Beban Berat</span>
                </div>
              )}

              {onNavigateToDebt && (
                <button
                  onClick={onNavigateToDebt}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold tracking-tight transition-colors shadow-xs inline-flex items-center gap-1 cursor-pointer"
                  id="btn-goto-debt-tracker"
                >
                  <span>Kelola Hutang</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Cicilan Bulanan
              </span>
              <span className="text-base md:text-lg font-black font-mono text-slate-900 mt-1 block">
                {formatRupiah(debtDashboardSummary.metrics.totalMonthlyInstallment)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {debtDashboardSummary.metrics.debtToRevenueRatio.toFixed(1)}% dari omset bulanan
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Kewajiban Tahunan
              </span>
              <span className="text-base md:text-lg font-black font-mono text-slate-900 mt-1 block">
                {formatRupiah(debtDashboardSummary.metrics.totalAnnualInstallment)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Proyeksi 12 bulan ke depan
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Sisa Pokok Hutang
              </span>
              <span className="text-base md:text-lg font-black font-mono text-rose-600 mt-1 block">
                {formatRupiah(debtDashboardSummary.metrics.totalRemaining)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Dari {debtDashboardSummary.activeDebtsCount} pos pinjaman aktif
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Free Cash Flow / Sisa Laba
              </span>
              <span className={`text-base md:text-lg font-black font-mono mt-1 block ${
                debtDashboardSummary.metrics.freeCashFlowAfterDebt >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {formatRupiah(debtDashboardSummary.metrics.freeCashFlowAfterDebt)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Laba bersih setelah cicilan
              </span>
            </div>
          </div>

          {/* Urgent Payment Notification Banner if any */}
          {debtDashboardSummary.urgentAlerts.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-950 font-semibold">
                  <strong>Pengingat Tanggal Pembayaran:</strong> {debtDashboardSummary.urgentAlerts[0].debt.title} ({formatRupiah(debtDashboardSummary.urgentAlerts[0].debt.monthlyInstallment)}) – {debtDashboardSummary.urgentAlerts[0].dueStatus.label}
                </span>
              </div>
              {onNavigateToDebt && (
                <button
                  onClick={onNavigateToDebt}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer"
                >
                  Bayar / Catat ➜
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* LAPORAN KEUANGAN MINGGUAN (WEEKLY FINANCIAL SUMMARY & DEBIT VS KREDIT CHART) */}
      <WeeklyFinancialReportCard 
        transactions={transactions} 
        onOpenTransaction={onEditTransaction} 
      />

      {/* CAFE BUSINESS KPI & RATIO PANEL */}
      <div className="bg-amber-50 border border-amber-200 rounded p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 border-b border-amber-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <span>☕</span> Analisis Indikator Kinerja & Rasio Bisnis Cafe
              </h3>
              <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider border ${
                ratioConfig.mode === 'manual'
                  ? 'bg-amber-200/80 text-amber-900 border-amber-400'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}>
                {ratioConfig.mode === 'manual' ? 'Mode Manual Aktif' : 'Mode Otomatis AI'}
              </span>
            </div>
            <p className="text-[10px] text-amber-800 font-medium mt-0.5">
              Analisis metrik keuangan standar industri F&amp;B berdasarkan kategori <strong>Pengeluaran 1</strong> pada data terfilter (Gaji, HPP, Operasional, Omset)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsRatioSettingsModalOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              title="Atur pemilihan kategori rasio gaji, HPP, operasional, dll. secara manual"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Atur Kategori Rasio</span>
            </button>
            <div className="text-[10px] bg-amber-100 text-amber-900 px-2.5 py-1.5 rounded font-bold uppercase tracking-wider border border-amber-200">
              Standar Industri F&B
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* COGS CARD */}
          <div className="bg-white p-4 rounded border border-amber-150 flex flex-col justify-between h-fit lg:col-span-1 md:col-span-2">
            <div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                <div className="flex items-center gap-1.5">
                  <span>Rasio HPP (COGS)</span>
                  <button
                    type="button"
                    onClick={() => setIsRatioSettingsModalOpen(true)}
                    className="text-amber-700 hover:text-amber-900 font-bold lowercase text-[10px] flex items-center gap-0.5 hover:underline cursor-pointer"
                    title="Atur pemilihan kategori HPP manual"
                  >
                    <SlidersHorizontal className="h-2.5 w-2.5" />
                    <span>atur</span>
                  </button>
                </div>
                <span className="text-slate-500 font-mono">Target: &lt;35%</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-slate-800">{cafeMetrics.cogsRatio}%</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide ${
                  cafeMetrics.cogsRatio <= 35 ? 'bg-emerald-100 text-emerald-800' :
                  cafeMetrics.cogsRatio <= 45 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  {cafeMetrics.cogsRatio <= 35 ? 'Efisien' :
                   cafeMetrics.cogsRatio <= 45 ? 'Waspada' : 'Tinggi'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    cafeMetrics.cogsRatio <= 35 ? 'bg-emerald-500' :
                    cafeMetrics.cogsRatio <= 45 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(cafeMetrics.cogsRatio, 100)}%` }}
                ></div>
              </div>

              {/* Sub-categories breakdown */}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                <div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>🥤 HPP Minuman</span>
                    <div className="flex space-x-2 font-mono">
                      <span className="text-slate-400">{formatRupiah(cafeMetrics.totalCOGSDrink)}</span>
                      <span className="text-sky-650 font-black">{cafeMetrics.cogsDrinkRatio}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-sky-500 h-full transition-all duration-500" style={{ width: `${Math.min(cafeMetrics.cogsDrinkRatio, 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>🍔 HPP Food (Makanan)</span>
                    <div className="flex space-x-2 font-mono">
                      <span className="text-slate-400">{formatRupiah(cafeMetrics.totalCOGSFood)}</span>
                      <span className="text-amber-655 font-black">{cafeMetrics.cogsFoodRatio}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${Math.min(cafeMetrics.cogsFoodRatio, 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>🍟 HPP Snack (Cemilan)</span>
                    <div className="flex space-x-2 font-mono">
                      <span className="text-slate-400">{formatRupiah(cafeMetrics.totalCOGSSnack)}</span>
                      <span className="text-orange-650 font-black">{cafeMetrics.cogsSnackRatio}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${Math.min(cafeMetrics.cogsSnackRatio, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-500 font-bold mt-3 border-t border-slate-100 pt-2 flex justify-between items-center">
              <span>Total Bahan Baku:</span>
              <span className="font-mono text-slate-700">{formatRupiah(cafeMetrics.totalCOGS)}</span>
            </div>
            
            <button
              onClick={() => setShowCogsDetail(!showCogsDetail)}
              className="mt-2.5 text-[9px] text-amber-700 hover:text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1 justify-center border border-amber-200/50 hover:border-amber-300 bg-amber-50/30 hover:bg-amber-50/80 py-1.5 px-2 rounded transition duration-200 w-full"
            >
              {showCogsDetail ? '▲ Sembunyikan Rincian' : '▼ Tampilkan Rincian'} ({cafeMetrics.cogsDetails.length})
            </button>

            {showCogsDetail && (
              <div className="mt-3 border-t border-slate-150 pt-2.5">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2.5 flex justify-between">
                  <span>Rincian HPP per Jenis</span>
                  <span className="text-slate-600 font-bold">Total: {formatRupiah(cafeMetrics.totalCOGS)}</span>
                </div>
                {cafeMetrics.cogsDetails.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-2 text-center">Tidak ada transaksi</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-3.5 pr-1 font-sans">
                    {(['Minuman', 'Food', 'Snack'] as const).map((type) => {
                      const items = cafeMetrics.cogsDetails.filter(item => (item.subCategory || 'Minuman') === type);
                      const totalType = type === 'Minuman' ? cafeMetrics.totalCOGSDrink :
                                        type === 'Food' ? cafeMetrics.totalCOGSFood : cafeMetrics.totalCOGSSnack;
                      if (items.length === 0) return null;
                      
                      const icon = type === 'Minuman' ? '🥤' : type === 'Food' ? '🍔' : '🍟';
                      const badgeColor = type === 'Food' ? 'bg-amber-100 text-amber-800 border border-amber-200/50' :
                                         type === 'Snack' ? 'bg-orange-100 text-orange-800 border border-orange-200/50' :
                                         'bg-sky-100 text-sky-800 border border-sky-200/50';
                      return (
                        <div key={type} className="bg-slate-50/70 p-2 rounded border border-slate-150">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-1 mb-2">
                            <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-black uppercase ${badgeColor}`}>
                              {icon} {type} ({items.length})
                            </span>
                            <span className="font-mono font-extrabold text-slate-800 text-[9.5px] bg-white px-1.5 py-0.5 rounded border border-slate-150">
                              {formatRupiah(totalType)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {items.map((item, idx) => (
                              <div key={idx} className="text-[10px] flex justify-between items-start gap-1.5 pb-1.5 last:pb-0 border-b border-dashed border-slate-200/60 last:border-0">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[8px] font-semibold text-slate-400 font-mono">{formatLocalDate(item.tanggal)}</span>
                                    <span className="text-[8px] bg-white text-slate-500 border border-slate-150 px-1 rounded truncate max-w-[85px]" title={item.category}>
                                      {item.category}
                                    </span>
                                  </div>
                                  <p className="text-slate-500 font-medium truncate" title={item.keterangan}>
                                    {item.keterangan}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-slate-700 whitespace-nowrap text-[9px] mt-0.5">
                                  {formatRupiah(item.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STAFF CARD */}
          <div className="bg-white p-4 rounded border border-amber-150 flex flex-col justify-between h-fit">
            <div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                <div className="flex items-center gap-1.5">
                  <span>Rasio Gaji & Staff</span>
                  <button
                    type="button"
                    onClick={() => setIsRatioSettingsModalOpen(true)}
                    className="text-indigo-700 hover:text-indigo-900 font-bold lowercase text-[10px] flex items-center gap-0.5 hover:underline cursor-pointer"
                    title="Atur pemilihan kategori Gaji manual"
                  >
                    <SlidersHorizontal className="h-2.5 w-2.5" />
                    <span>atur</span>
                  </button>
                </div>
                <span className="text-slate-500 font-mono">Target: 15-25%</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-slate-800">{cafeMetrics.wagesRatio}%</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide ${
                  cafeMetrics.wagesRatio <= 25 ? 'bg-emerald-100 text-emerald-800' :
                  cafeMetrics.wagesRatio <= 35 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  {cafeMetrics.wagesRatio <= 25 ? 'Sehat' :
                   cafeMetrics.wagesRatio <= 35 ? 'Waspada' : 'Tinggi'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    cafeMetrics.wagesRatio <= 25 ? 'bg-emerald-500' :
                    cafeMetrics.wagesRatio <= 35 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(cafeMetrics.wagesRatio, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-bold mt-3 border-t border-slate-100 pt-2 flex justify-between items-center">
              <span>Gaji Barista:</span>
              <span className="font-mono text-slate-700">{formatRupiah(cafeMetrics.totalWages)}</span>
            </div>

            <button
              onClick={() => setShowWagesDetail(!showWagesDetail)}
              className="mt-2.5 text-[9px] text-amber-700 hover:text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1 justify-center border border-amber-200/50 hover:border-amber-300 bg-amber-50/30 hover:bg-amber-50/80 py-1.5 px-2 rounded transition duration-200 w-full"
            >
              {showWagesDetail ? '▲ Sembunyikan Rincian' : '▼ Tampilkan Rincian'} ({cafeMetrics.wagesDetails.length})
            </button>

            {showWagesDetail && (
              <div className="mt-3 border-t border-slate-150 pt-2.5">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2.5 flex justify-between">
                  <span>Rincian Gaji per Jenis</span>
                  <span className="text-slate-600 font-bold">Total: {formatRupiah(cafeMetrics.totalWages)}</span>
                </div>
                {cafeMetrics.wagesDetails.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-2 text-center">Tidak ada transaksi</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-3.5 pr-1 font-sans">
                    {(() => {
                      const groups: Record<string, { total: number; items: typeof cafeMetrics.wagesDetails }> = {};
                      cafeMetrics.wagesDetails.forEach(item => {
                        const key = item.category || 'Gaji Karyawan';
                        if (!groups[key]) groups[key] = { total: 0, items: [] };
                        groups[key].items.push(item);
                        groups[key].total += item.amount;
                      });
                      
                      return Object.entries(groups).map(([cat, group]) => (
                        <div key={cat} className="bg-slate-50/70 p-2 rounded border border-slate-150">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-1 mb-2">
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200/50">
                              💼 {cat} ({group.items.length})
                            </span>
                            <span className="font-mono font-extrabold text-slate-800 text-[9.5px] bg-white px-1.5 py-0.5 rounded border border-slate-150">
                              {formatRupiah(group.total)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {group.items.map((item, idx) => (
                              <div key={idx} className="text-[10px] flex justify-between items-start gap-1.5 pb-1.5 last:pb-0 border-b border-dashed border-slate-200/60 last:border-0">
                                <div className="min-w-0 flex-1">
                                  <span className="text-[8px] font-semibold text-slate-400 font-mono mb-0.5 block">{formatLocalDate(item.tanggal)}</span>
                                  <p className="text-slate-500 font-medium truncate" title={item.keterangan}>
                                    {item.keterangan}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-slate-700 whitespace-nowrap text-[9px] mt-0.5">
                                  {formatRupiah(item.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* OPERATIONAL CARD */}
          <div className="bg-white p-4 rounded border border-amber-150 flex flex-col justify-between h-fit">
            <div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                <div className="flex items-center gap-1.5">
                  <span>Operasional & Sewa</span>
                  <button
                    type="button"
                    onClick={() => setIsRatioSettingsModalOpen(true)}
                    className="text-rose-700 hover:text-rose-900 font-bold lowercase text-[10px] flex items-center gap-0.5 hover:underline cursor-pointer"
                    title="Atur pemilihan kategori Operasional manual"
                  >
                    <SlidersHorizontal className="h-2.5 w-2.5" />
                    <span>atur</span>
                  </button>
                </div>
                <span className="text-slate-500 font-mono">Target: &lt;20%</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-slate-800">{cafeMetrics.operasionalRatio}%</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide ${
                  cafeMetrics.operasionalRatio <= 20 ? 'bg-emerald-100 text-emerald-800' :
                  cafeMetrics.operasionalRatio <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  {cafeMetrics.operasionalRatio <= 20 ? 'Sehat' :
                   cafeMetrics.operasionalRatio <= 30 ? 'Sedang' : 'Tinggi'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    cafeMetrics.operasionalRatio <= 20 ? 'bg-emerald-500' :
                    cafeMetrics.operasionalRatio <= 30 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(cafeMetrics.operasionalRatio, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-bold mt-3 border-t border-slate-100 pt-2 flex justify-between items-center">
              <span>Biaya Sewa & Listrik:</span>
              <span className="font-mono text-slate-700">{formatRupiah(cafeMetrics.totalOperasional)}</span>
            </div>

            <button
              onClick={() => setShowOperasionalDetail(!showOperasionalDetail)}
              className="mt-2.5 text-[9px] text-amber-700 hover:text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1 justify-center border border-amber-200/50 hover:border-amber-300 bg-amber-50/30 hover:bg-amber-50/80 py-1.5 px-2 rounded transition duration-200 w-full"
            >
              {showOperasionalDetail ? '▲ Sembunyikan Rincian' : '▼ Tampilkan Rincian'} ({cafeMetrics.operasionalDetails.length})
            </button>

            {showOperasionalDetail && (
              <div className="mt-3 border-t border-slate-150 pt-2.5">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2.5 flex justify-between">
                  <span>Rincian Operasional per Jenis</span>
                  <span className="text-slate-600 font-bold">Total: {formatRupiah(cafeMetrics.totalOperasional)}</span>
                </div>
                {cafeMetrics.operasionalDetails.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-2 text-center">Tidak ada transaksi</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-3.5 pr-1 font-sans">
                    {(() => {
                      const groups: Record<string, { total: number; items: typeof cafeMetrics.operasionalDetails }> = {};
                      cafeMetrics.operasionalDetails.forEach(item => {
                        const key = item.category || 'Operasional';
                        if (!groups[key]) groups[key] = { total: 0, items: [] };
                        groups[key].items.push(item);
                        groups[key].total += item.amount;
                      });
                      
                      return Object.entries(groups).map(([cat, group]) => (
                        <div key={cat} className="bg-slate-50/70 p-2 rounded border border-slate-150">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-1 mb-2">
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200/50">
                              🛠️ {cat} ({group.items.length})
                            </span>
                            <span className="font-mono font-extrabold text-slate-800 text-[9.5px] bg-white px-1.5 py-0.5 rounded border border-slate-150">
                              {formatRupiah(group.total)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {group.items.map((item, idx) => (
                              <div key={idx} className="text-[10px] flex justify-between items-start gap-1.5 pb-1.5 last:pb-0 border-b border-dashed border-slate-200/60 last:border-0">
                                <div className="min-w-0 flex-1">
                                  <span className="text-[8px] font-semibold text-slate-400 font-mono mb-0.5 block">{formatLocalDate(item.tanggal)}</span>
                                  <p className="text-slate-500 font-medium truncate" title={item.keterangan}>
                                    {item.keterangan}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-slate-700 whitespace-nowrap text-[9px] mt-0.5">
                                  {formatRupiah(item.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NET PROFIT CARD */}
          <div className="bg-white p-4 rounded border border-amber-150 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                <span>Nett Profit Margin</span>
                <span className="text-slate-500 font-mono">Target: &gt;15%</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-black ${cafeMetrics.netProfitMargin >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                  {cafeMetrics.netProfitMargin}%
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide ${
                  cafeMetrics.netProfitMargin >= 15 ? 'bg-emerald-100 text-emerald-800' :
                  cafeMetrics.netProfitMargin >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  {cafeMetrics.netProfitMargin >= 15 ? 'Sangat Baik' :
                   cafeMetrics.netProfitMargin >= 0 ? 'Moderat' : 'Rugi'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    cafeMetrics.netProfitMargin >= 15 ? 'bg-emerald-500' :
                    cafeMetrics.netProfitMargin >= 0 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(cafeMetrics.netProfitMargin, 100))}%` }}
                ></div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-bold mt-3 border-t border-slate-100 pt-2 flex justify-between items-center">
              <span>Total Omset (Sales):</span>
              <span className="font-mono text-slate-700">{formatRupiah(cafeMetrics.totalSales)}</span>
            </div>

            <button
              onClick={() => setShowProfitabilityDetail(!showProfitabilityDetail)}
              className="mt-2.5 text-[9px] text-amber-700 hover:text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1 justify-center border border-amber-200/50 hover:border-amber-300 bg-amber-50/30 hover:bg-amber-50/80 py-1.5 px-2 rounded transition duration-200 w-full cursor-pointer"
            >
              {showProfitabilityDetail ? '▲ Sembunyikan Analisis' : '▼ Analisis Profitabilitas'}
            </button>

            {showProfitabilityDetail && (
              <div className="mt-3 border-t border-slate-150 pt-2.5 text-left space-y-3 font-sans">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex justify-between">
                  <span>Metrik Profitabilitas Detail</span>
                  <span className="text-slate-600 font-bold">Hasil Filter</span>
                </div>

                {/* 1. Gross Profit */}
                <div className="bg-slate-50/70 p-2 rounded border border-slate-150 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wide">Laba Kotor (GP)</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      cafeMetrics.grossProfitMargin >= 65 ? 'bg-emerald-100 text-emerald-800' :
                      cafeMetrics.grossProfitMargin >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {cafeMetrics.grossProfitMargin >= 65 ? 'Sangat Sehat' : 'Cukup' }
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[11px] font-bold text-slate-800">{formatRupiah(cafeMetrics.grossProfit)}</span>
                    <span className="text-[10.5px] font-black text-indigo-700">{cafeMetrics.grossProfitMargin}%</span>
                  </div>
                  <div className="text-[8px] text-slate-400 font-medium">Standar F&B: 60% - 70% dari Omset</div>
                </div>

                {/* 2. Operating Profit */}
                <div className="bg-slate-50/70 p-2 rounded border border-slate-150 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wide">Laba Operasional</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      cafeMetrics.operatingProfitMargin >= 20 ? 'bg-emerald-100 text-emerald-800' :
                      cafeMetrics.operatingProfitMargin >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {cafeMetrics.operatingProfitMargin >= 20 ? 'Efisien' : 'Waspada'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[11px] font-bold text-slate-800">{formatRupiah(cafeMetrics.operatingProfit)}</span>
                    <span className="text-[10.5px] font-black text-indigo-700">{cafeMetrics.operatingProfitMargin}%</span>
                  </div>
                  <div className="text-[8px] text-slate-400 font-medium">EBITDA (Sebelum Promosi & Pajak)</div>
                </div>

                {/* 3. Break-Even Point (BEP) Analysis */}
                {(() => {
                  const fixedCost = cafeMetrics.totalWages + (cafeMetrics.totalOperasional * 0.6); // Gaji + 60% operasional dianggap fixed cost
                  const gpRatio = cafeMetrics.grossProfitMargin / 100;
                  const bepSales = gpRatio > 0 ? fixedCost / gpRatio : 0;
                  
                  return (
                    <div className="bg-indigo-50/60 p-2.5 rounded border border-indigo-100 space-y-1.5">
                      <div className="text-[9.5px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                        <span>📊</span> Analisis Titik Impas (BEP)
                      </div>
                      <div className="space-y-1 text-[10px] text-slate-600 font-medium">
                        <div className="flex justify-between">
                          <span>Biaya Tetap Estimasi:</span>
                          <span className="font-mono font-bold text-slate-700">{formatRupiah(fixedCost)}</span>
                        </div>
                        <div className="flex justify-between border-t border-indigo-100/50 pt-1 mt-1">
                          <span className="font-semibold text-indigo-900">Target Omset BEP:</span>
                          <span className="font-mono font-extrabold text-indigo-900">{formatRupiah(bepSales)}</span>
                        </div>
                      </div>
                      <p className="text-[8px] text-indigo-700 font-medium leading-relaxed">
                        {cafeMetrics.totalSales >= bepSales ? (
                          <span className="text-emerald-700 font-bold">✓ Selamat! Omset Anda saat ini telah melampaui Titik Impas (BEP).</span>
                        ) : (
                          <span className="text-red-700 font-bold">✗ Omset saat ini masih berada di bawah target BEP untuk menutup biaya tetap.</span>
                        )}
                      </p>
                    </div>
                  );
                })()}

                {/* 4. Rekomendasi Taktis */}
                <div className="bg-amber-50/60 p-2.5 rounded border border-amber-150 space-y-1">
                  <span className="text-[9px] font-black text-amber-900 uppercase tracking-wider block">⚡ Rekomendasi Profitabilitas</span>
                  <p className="text-[9px] text-slate-600 font-medium leading-relaxed">
                    {cafeMetrics.cogsRatio > 35 ? (
                      "Rasio HPP Anda tinggi (>35%). Direkomendasikan melakukan standardisasi resep minuman (recipe costing), negosiasi ke agen supplier besar, atau meluncurkan menu bundling combo hemat."
                    ) : cafeMetrics.wagesRatio > 25 ? (
                      "Biaya karyawan di atas target 25%. Pertimbangkan penjadwalan shift barista secara dinamis berdasarkan jam ramai (peak hours) atau skema part-time di akhir pekan."
                    ) : cafeMetrics.netProfitMargin < 15 ? (
                      "Margin laba tipis. Coba naikkan volume penjualan lewat program loyalitas pelanggan atau optimalkan promo agar tidak terlalu mendepresiasi margin dasar."
                    ) : (
                      "Kinerja luar biasa! Pertahankan rasio pengeluaran saat ini dan pertimbangkan untuk mereinvestasikan laba guna ekspansi menu atau pemasaran digital."
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FINANCIAL HEALTH NOTICE */}
        <div className="mt-4 bg-amber-100/50 rounded border border-amber-200/50 p-3 text-[11px] text-amber-900 flex items-start space-x-2">
          <span className="text-sm mt-0.5">💡</span>
          <div>
            <p className="font-bold">Tips Manajemen Basco Cashflow:</p>
            <p className="text-amber-850 mt-0.5 leading-relaxed">
              Jaga Rasio HPP (COGS) di kisaran <span className="font-bold">28% - 35%</span> dan Gaji Staff maksimal <span className="font-bold">25%</span> dari total omset untuk mengamankan Nett Profit Margin yang ideal di atas <span className="font-bold">15%</span>. Gunakan filter jangka waktu di bawah untuk melihat profitabilitas bulanan atau tahunan secara berkala.
            </p>
          </div>
        </div>
      </div>



      {/* CHARTS & CATEGORY ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART: MONTHLY CASH FLOW (8 Cols) */}
        <div className="lg:col-span-8 bg-white p-6 rounded border border-slate-200 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                Visualisasi Arus Kas Bulanan
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Tren pemasukan vs pengeluaran
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Chart Toggle */}
              <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                <button
                  onClick={() => setChartView('line')}
                  className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded flex items-center gap-1 transition-all cursor-pointer ${
                    chartView === 'line'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Grafik Garis (Recharts)"
                >
                  <LineChartIcon className="h-3 w-3" />
                  <span>Tren Garis</span>
                </button>
                <button
                  onClick={() => setChartView('bar')}
                  className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded flex items-center gap-1 transition-all cursor-pointer ${
                    chartView === 'bar'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Grafik Batang (SVG)"
                >
                  <BarChart2 className="h-3 w-3" />
                  <span>Batang</span>
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-500 border-l border-slate-200 pl-3">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-sm"></span>
                  <span>IN</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-red-400 rounded-sm"></span>
                  <span>OUT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive SVG / Recharts Graph */}
          <div className="relative flex-grow h-[190px] mt-2 select-none">
            {monthlyData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-400 italic">
                Data tidak tersedia untuk visualisasi tren.
              </div>
            ) : chartView === 'line' ? (
              <div className="w-full h-full text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                    />
                    <YAxis 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 'bold' }}
                      tickFormatter={(val) => {
                        if (val === 0) return '0';
                        return formatRupiah(val).replace("Rp\u00A0", "").substring(0, 5) + "k";
                      }}
                    />
                    <RechartsTooltip content={<CustomRechartsTooltip />} cursor={{ stroke: '#f1f5f9', strokeWidth: 1 }} />
                    <Line 
                      type="monotone" 
                      dataKey="debit" 
                      stroke="#10b981" 
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 1, fill: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#10b981' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="kredit" 
                      stroke="#f87171" 
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 1, fill: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#f87171' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col justify-between">
                <svg className="w-full h-full" viewBox={`0 0 500 ${chartHeight}`} preserveAspectRatio="none">
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = ratio * (chartHeight - paddingBottom - paddingTop) + paddingTop;
                    return (
                      <g key={idx}>
                        <line 
                          x1="35" 
                          y1={y} 
                          x2="495" 
                          y2={y} 
                          stroke="#e2e8f0" 
                          strokeWidth="1" 
                          strokeDasharray="4,4" 
                        />
                        <text 
                          x="30" 
                          y={y + 3} 
                          fontSize="8" 
                          textAnchor="end" 
                          fill="#94a3b8"
                          className="font-mono font-bold"
                        >
                          {formatRupiah(maxChartValue * (1 - ratio)).replace("Rp\u00A0", "").substring(0, 5) + "k"}
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Columns for each Month */}
                  {monthlyData.map((d, idx) => {
                    const colCount = monthlyData.length;
                    const spacing = 450 / colCount;
                    const xCenter = 40 + idx * spacing + spacing / 2;
                    
                    // Column Heights
                    const hDebit = ((d.debit) / maxChartValue) * (chartHeight - paddingBottom - paddingTop);
                    const hKredit = ((d.kredit) / maxChartValue) * (chartHeight - paddingBottom - paddingTop);
                    
                    // Coordinates
                    const yDebit = chartHeight - paddingBottom - hDebit;
                    const yKredit = chartHeight - paddingBottom - hKredit;
                    
                    const barWidth = Math.max(4, Math.min(22, 110 / colCount));

                    return (
                      <g key={idx}>
                        {/* Hover Overlay area */}
                        <rect
                          x={xCenter - spacing/2}
                          y={0}
                          width={spacing}
                          height={chartHeight - paddingBottom}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredChartIndex(idx)}
                          onMouseLeave={() => setHoveredChartIndex(null)}
                        />

                        {/* Debit Bar (Green) */}
                        <rect
                          x={xCenter - barWidth - 1}
                          y={yDebit}
                          width={barWidth}
                          height={hDebit}
                          fill="#10b981"
                          className={`transition-all duration-200 ${
                            hoveredChartIndex === idx ? 'opacity-100 filter brightness-105' : 'opacity-85'
                          }`}
                        />

                        {/* Kredit Bar (Red) */}
                        <rect
                          x={xCenter + 1}
                          y={yKredit}
                          width={barWidth}
                          height={hKredit}
                          fill="#f87171"
                          className={`transition-all duration-200 ${
                            hoveredChartIndex === idx ? 'opacity-100 filter brightness-105' : 'opacity-85'
                          }`}
                        />

                        {/* Month Label */}
                        <text
                          x={xCenter}
                          y={chartHeight - 8}
                          fontSize="8.5"
                          textAnchor="middle"
                          fill={hoveredChartIndex === idx ? '#334155' : '#94a3b8'}
                          className={`font-bold transition-colors duration-200`}
                        >
                          {d.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Tooltip Overlay */}
                {hoveredChartIndex !== null && monthlyData[hoveredChartIndex] && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 px-3 rounded shadow-xl border border-slate-800 text-[10px] space-y-0.5 z-20 transition-all pointer-events-none">
                    <p className="font-bold border-b border-slate-800 pb-1 mb-1 text-slate-300">
                      {monthlyData[hoveredChartIndex].monthLong}
                    </p>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-400">Debit:</span>
                      <span className="font-bold text-emerald-400">{formatRupiah(monthlyData[hoveredChartIndex].debit)}</span>
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-400">Kredit:</span>
                      <span className="font-bold text-rose-400">{formatRupiah(monthlyData[hoveredChartIndex].kredit)}</span>
                    </div>
                    <div className="flex justify-between space-x-4 border-t border-slate-800 pt-1 mt-1 font-semibold">
                      <span className="text-slate-400">Arus Bersih:</span>
                      <span className={monthlyData[hoveredChartIndex].saldo >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {formatRupiah(monthlyData[hoveredChartIndex].saldo)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CATEGORIES: SPEND ANALYSIS (4 Cols) */}
        <div className="lg:col-span-4 bg-white p-6 rounded border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
              Pengeluaran 1 (Kategori Biaya)
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 mb-6">
              Proporsi pengeluaran per jenis Pengeluaran 1
            </p>
          </div>

          <div className="space-y-4 flex-grow overflow-y-auto max-h-[160px] pr-1 scrollbar-thin">
            {categorySpend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic py-8">
                Tidak ada data pengeluaran (kredit) dalam filter ini.
              </div>
            ) : (
              categorySpend.map((cat) => {
                return (
                  <div 
                    key={cat.category} 
                    className={`group cursor-pointer p-1.5 -mx-1.5 transition hover:bg-slate-50 rounded`}
                    onClick={() => handleFilterChange(() => setSelectedCategory(cat.category))}
                    title={`Klik untuk filter kategori: ${cat.category}`}
                  >
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-slate-700 flex items-center space-x-1.5 group-hover:text-slate-900 transition">
                        <Tag className="h-3 w-3 text-slate-400" />
                        <span className="truncate max-w-[120px] sm:max-w-none">{cat.category}</span>
                      </span>
                      <div className="font-mono text-[11px] font-bold text-slate-800">
                        <span>{formatRupiah(cat.amount)}</span>
                        <span className="text-slate-400 font-normal text-[9.5px] ml-1.5">({cat.percentage}%)</span>
                      </div>
                    </div>
                    {/* Progress Bar - Geometric Flat Style (Slate color as requested in theme!) */}
                    <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-slate-800 transition-all duration-500"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {categorySpend.length > 0 && (
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center pt-2.5 border-t border-slate-100 mt-2">
              💡 Klik kategori untuk memfilter riwayat secara instan.
            </div>
          )}
        </div>

      </div>

      {/* SEARCH, DATE FILTERS & LIST MODULE */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden" id="transactions-log-card">
        
        {/* FILTER BAR ACTIONS */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 space-y-4">
          
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                  Aliran Data & Filter
                </h3>
                {transactions.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {filteredTransactions.length} ditampilkan ({transactions.length} total baris)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Filter, urutkan, dan cari transaksi keuangan Anda</p>
            </div>

            {/* Quick Filter presets & Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'Semua Waktu' },
                { id: 'this_month', label: 'Bulan Ini' },
                { id: 'last_month', label: 'Bulan Lalu' },
                { id: 'this_year', label: 'Tahun Ini' }
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleQuickPreset(preset.id as any)}
                  className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
                    quickFilter === preset.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              
              <span className="h-6 w-[1px] bg-slate-300 mx-1 hidden sm:inline"></span>

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoadingData}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  title="Sinkronisasi ulang langsung membaca seluruh lembar &amp; data terbaru dari Google Sheets"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                  <span>{isLoadingData ? 'Memuat Sheet...' : 'Sinkronkan Sheet'}</span>
                </button>
              )}

              <button
                onClick={handleDownloadCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer animate-fade-in"
                title="Unduh data transaksi terfilter ke format CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPdfPreviewOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer animate-fade-in"
                title="Lihat pratinjau hasil cetak & ekspor PDF langsung di layar"
              >
                <Eye className="h-3.5 w-3.5 text-indigo-400" />
                <span>Pratinjau PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDirectDownloadPDF}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer animate-fade-in"
                title="Unduh file PDF (.pdf) langsung ke perangkat Anda"
              >
                <Download className={`h-3.5 w-3.5 ${isGeneratingPdf ? 'animate-spin' : ''}`} />
                <span>{isGeneratingPdf ? 'Membuat...' : 'Unduh PDF'}</span>
              </button>
            </div>
          </div>

          {/* Interactive filter options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            
            {/* Search Input */}
            <div className="relative rounded shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleFilterChange(() => setSearchTerm(e.target.value))}
                placeholder="Cari keterangan / kategori..."
                className="block w-full pl-9 pr-3 py-2 text-xs font-bold rounded border border-slate-200 text-slate-800 bg-white placeholder-slate-400 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category select */}
            <div className="relative rounded shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Tag className="h-4 w-4 text-slate-400" />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => handleFilterChange(() => setSelectedCategory(e.target.value))}
                className="block w-full pl-9 pr-3 py-2 text-xs font-bold rounded border border-slate-200 text-slate-800 bg-white focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Month Select dropdown */}
            <div className="relative rounded shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-slate-400" />
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthSelect(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 text-xs font-bold rounded border border-slate-200 text-slate-800 bg-white focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors cursor-pointer"
              >
                <option value="all">Semua Bulan</option>
                {uniqueMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            {/* Operasional & Manajemen select */}
            <div className="relative rounded shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Briefcase className="h-4 w-4 text-slate-400" />
              </div>
              <select
                value={filterOpMan}
                onChange={(e) => handleFilterChange(() => setFilterOpMan(e.target.value as any))}
                className="block w-full pl-9 pr-3 py-2 text-xs font-bold rounded border border-slate-200 text-slate-800 bg-white focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors cursor-pointer"
              >
                <option value="all">Semua Klasifikasi</option>
                <option value="Operasional">Operasional Only</option>
                <option value="Manajemen">Manajemen Only</option>
                <option value="-">Tanpa Klasifikasi (-)</option>
              </select>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded">
              {(['all', 'debit', 'kredit'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleFilterChange(() => setFilterType(type))}
                  className={`py-1 px-2 rounded text-[10px] font-black text-center uppercase tracking-wider transition-all ${
                    filterType === type
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-855'
                  }`}
                >
                  {type === 'all' ? 'Semua' : type === 'debit' ? 'Debit' : 'Kredit'}
                </button>
              ))}
            </div>

            {/* Date Inputs Toggle/Inputs */}
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleFilterChange(() => {
                  setStartDate(e.target.value);
                  setQuickFilter('all'); // Clear quick filter if manual date used
                })}
                className="block w-full px-2 py-1.5 text-[10px] font-bold rounded border border-slate-200 text-slate-800 bg-white focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950"
                title="Mulai Tanggal"
              />
              <span className="text-slate-400 text-xs font-bold">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleFilterChange(() => {
                  setEndDate(e.target.value);
                  setQuickFilter('all'); // Clear quick filter if manual date used
                })}
                className="block w-full px-2 py-1.5 text-[10px] font-bold rounded border border-slate-200 text-slate-800 bg-white focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950"
                title="Sampai Tanggal"
              />
            </div>

          </div>

          {/* Active filter badges display */}
          {(searchTerm || selectedCategory !== 'all' || filterType !== 'all' || startDate || endDate || quickFilter !== 'all' || filterOpMan !== 'all' || selectedMonth !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aktif:</span>
              
              {filterOpMan !== 'all' && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 flex items-center space-x-1">
                  <span>Klasifikasi: {filterOpMan === '-' ? 'Tanpa Klasifikasi' : filterOpMan}</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterOpMan('all')} />
                </span>
              )}

              {searchTerm && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 flex items-center space-x-1">
                  <span>Kata: "{searchTerm}"</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchTerm('')} />
                </span>
              )}

              {selectedCategory !== 'all' && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 flex items-center space-x-1">
                  <span>Kategori: {selectedCategory}</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory('all')} />
                </span>
              )}

              {selectedMonth !== 'all' && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 flex items-center space-x-1">
                  <span>Bulan: {selectedMonth}</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedMonth('all')} />
                </span>
              )}

              {filterType !== 'all' && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 flex items-center space-x-1">
                  <span>Tipe: {filterType === 'debit' ? 'Pemasukan' : 'Pengeluaran'}</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterType('all')} />
                </span>
              )}

              {quickFilter !== 'all' && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 flex items-center space-x-1">
                  <span>Waktu: {quickFilter === 'this_month' ? 'Bulan Ini' : quickFilter === 'last_month' ? 'Bulan Lalu' : 'Tahun Ini'}</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setQuickFilter('all')} />
                </span>
              )}

              {(startDate || endDate) && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 flex items-center space-x-1">
                  <span>Rentang: {startDate ? formatLocalDate(startDate) : '*'} - {endDate ? formatLocalDate(endDate) : '*'}</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setStartDate(''); setEndDate(''); }} />
                </span>
              )}

              <button
                onClick={handleClearFilters}
                className="text-[10px] font-bold text-red-650 hover:underline transition ml-1 uppercase tracking-wider"
              >
                Reset Semua Filter
              </button>
            </div>
          )}

        </div>

        {/* LOG DATA TABLE (DESKTOP) & LIST (MOBILE) */}
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-full text-slate-400">
              <Search className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Tidak ada transaksi yang cocok</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Coba ubah kata kunci pencarian atau bersihkan filter yang aktif</p>
            </div>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
            >
              Bersihkan Filter
            </button>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="py-3 px-5">Tanggal</th>
                    <th className="py-3 px-5">Tipe</th>
                    <th className="py-3 px-5">Pengeluaran 1</th>
                    <th className="py-3 px-5">Keterangan</th>
                    <th className="py-3 px-5">Klasifikasi</th>
                    <th className="py-3 px-5">Keterangan Detail</th>
                    <th className="py-3 px-5 text-right">Jumlah (IDR)</th>
                    <th className="py-3 px-5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {paginatedTransactions.map((t) => {
                    const isDebit = t.debit > 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-5 whitespace-nowrap font-mono text-slate-500">
                          {formatLocalDate(t.tanggal)}
                        </td>
                        <td className="py-3 px-5 whitespace-nowrap">
                          {isDebit ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[9px] font-black tracking-wider bg-emerald-100 text-emerald-800 uppercase border border-emerald-200">
                              <span>Pemasukan</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[9px] font-black tracking-wider bg-red-100 text-red-800 uppercase border border-red-200">
                              <span>Pengeluaran</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 whitespace-nowrap uppercase tracking-wider text-[10px]">
                          <span className="flex items-center space-x-1 text-slate-900">
                            <Tag className="h-3 w-3 text-slate-400" />
                            <span>{t.jenisPengeluaran}</span>
                          </span>
                        </td>
                        <td className="py-3 px-5 whitespace-nowrap uppercase tracking-wider text-[10px]">
                          {t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-' ? (
                            <span className="flex items-center space-x-1 text-slate-900">
                              <Tag className="h-3 w-3 text-slate-400" />
                              <span>{t.jenisPengeluaran2}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold font-mono text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-5 whitespace-nowrap">
                          {t.operasionalDanManajemen === 'Operasional' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-wide bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                              Operasional
                            </span>
                          ) : t.operasionalDanManajemen === 'Manajemen' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-wide bg-purple-50 text-purple-700 border border-purple-100 uppercase">
                              Manajemen
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold font-mono text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-5 max-w-[240px] truncate text-slate-400 font-medium italic" title={t.keterangan}>
                          {t.keterangan || '-'}
                        </td>
                        <td className="py-3 px-5 text-right font-mono whitespace-nowrap">
                          {isDebit ? (
                            <span className="text-emerald-600 font-bold text-sm">+{formatRupiah(t.debit)}</span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-slate-900 font-bold text-sm">
                                {formatRupiah(t.kredit + (t.kredit2 || 0))}
                              </span>
                              {t.kredit2 > 0 && (
                                <span className="text-[9px] text-slate-400 font-semibold font-sans uppercase tracking-wider mt-0.5">
                                  {formatRupiah(t.kredit)} + {formatRupiah(t.kredit2)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => onEditTransaction(t)}
                              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 transition"
                              title="Edit Transaksi"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(t)}
                              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 text-slate-500 transition"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-200">
              {paginatedTransactions.map((t) => {
                const isDebit = t.debit > 0;
                return (
                  <div key={t.id} className="p-4 space-y-3 hover:bg-slate-50 transition">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] font-bold text-slate-400">
                        {formatLocalDate(t.tanggal)}
                      </span>
                      {isDebit ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black tracking-wider bg-emerald-100 text-emerald-800 uppercase border border-emerald-200">
                          Pemasukan
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black tracking-wider bg-red-100 text-red-800 uppercase border border-red-200">
                          Pengeluaran
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center flex-wrap gap-1.5">
                          <span className="flex items-center space-x-1">
                            <Tag className="h-3 w-3 text-slate-400" />
                            <span>{t.jenisPengeluaran}</span>
                          </span>
                          {t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-' && (
                            <span className="flex items-center space-x-1 text-slate-500">
                              <span className="text-slate-300">/</span>
                              <Tag className="h-3 w-3 text-slate-300" />
                              <span className="text-[10px] text-slate-500">{t.jenisPengeluaran2}</span>
                            </span>
                          )}
                          {t.operasionalDanManajemen && t.operasionalDanManajemen !== '-' && (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border tracking-wide ${
                              t.operasionalDanManajemen === 'Operasional' 
                                ? 'bg-blue-50 text-blue-750 border-blue-100' 
                                : 'bg-purple-50 text-purple-750 border-purple-100'
                            }`}>
                              {t.operasionalDanManajemen}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-medium italic max-w-[200px] truncate">
                          {t.keterangan || '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black font-mono">
                          {isDebit ? (
                            <span className="text-emerald-600">+{formatRupiah(t.debit)}</span>
                          ) : (
                            <span className="text-slate-900">{formatRupiah(t.kredit + (t.kredit2 || 0))}</span>
                          )}
                        </p>
                        {!isDebit && t.kredit2 > 0 && (
                          <p className="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5">
                            P1: {formatRupiah(t.kredit)} | Ket: {formatRupiah(t.kredit2)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => onEditTransaction(t)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-[10px] font-bold flex items-center space-x-1"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(t)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-650 text-slate-600 rounded text-[10px] font-bold flex items-center space-x-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <div className="text-slate-400 normal-case font-medium">
                Menampilkan <span className="text-slate-800 font-bold">{paginatedTransactions.length}</span> dari <span className="text-slate-800 font-bold">{filteredTransactions.length}</span> transaksi
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
                </button>
                <div className="px-2 text-slate-500 normal-case font-bold">
                  Halaman <span className="font-black text-slate-900">{currentPage}</span> dari <span className="font-bold text-slate-950">{totalPages}</span>
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* GEMINI AI ANALYST SUMMARY CARD */}
      <div className="bg-white rounded border border-indigo-150 p-6 shadow-xs relative overflow-hidden" id="ai-analyst-panel">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl opacity-40 -mr-10 -mt-10 pointer-events-none"></div>
        
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${isAiSummaryMinimized ? '' : 'border-b border-indigo-50 pb-4 mb-4'}`}>
          <div className="flex items-start space-x-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2 flex-wrap">
                <span>ArusKas AI Analyst</span>
                <span className="text-[9px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold uppercase tracking-widest border border-indigo-200">Powered by Gemini AI</span>
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">
                Ringkasan naratif otomatis mengenai performa kas bulanan & rekomendasi taktis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={generateAISummary}
              disabled={isGeneratingSummary}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded shadow-sm flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-60"
              id="ai-generate-btn"
            >
              {isGeneratingSummary ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Menganalisis Transaksi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{aiSummary ? "Perbarui Analisis AI" : "Hasilkan Analisis AI"}</span>
                </>
              )}
            </button>
            <button
              onClick={toggleAiSummaryMinimize}
              className="p-2 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded transition cursor-pointer flex items-center justify-center shrink-0"
              title={isAiSummaryMinimized ? "Tampilkan Selengkapnya" : "Sembunyikan"}
            >
              {isAiSummaryMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {!isAiSummaryMinimized && (
          <>
            {summaryError && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-850 rounded-xl text-xs font-semibold flex items-start space-x-2.5">
                <span className="text-sm mt-0.5">⚠️</span>
                <div>
                  <p className="font-bold">Gagal Membuat Analisis AI</p>
                  <p className="text-rose-700 mt-0.5">{summaryError}</p>
                  <p className="text-[10.5px] text-slate-500 mt-1.5">Harap pastikan GEMINI_API_KEY telah dikonfigurasi dengan benar di menu Settings &gt; Secrets.</p>
                </div>
              </div>
            )}

            {!summaryError && !aiSummary && !isGeneratingSummary && (
              <div className="py-8 text-center max-w-lg mx-auto">
                <div className="h-12 w-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-3 shadow-xs">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                </div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Belum Ada Analisis Terpasang</h4>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1 px-4 leading-relaxed">
                  Klik tombol <strong className="text-indigo-600">Hasilkan Analisis AI</strong> di atas untuk menganalisis profitabilitas, rasio bahan baku (COGS), dan rincian pengeluaran tertinggi Anda.
                </p>
              </div>
            )}

            {isGeneratingSummary && (
              <div className="space-y-3 py-4 animate-pulse">
                <div className="h-3.5 bg-slate-100 rounded w-1/4"></div>
                <div className="h-2.5 bg-slate-100 rounded w-full"></div>
                <div className="h-2.5 bg-slate-100 rounded w-5/6"></div>
                <div className="h-2.5 bg-slate-100 rounded w-11/12"></div>
                <div className="h-3 bg-slate-100 rounded w-1/3 mt-6"></div>
                <div className="h-2.5 bg-slate-100 rounded w-full"></div>
                <div className="h-2.5 bg-slate-100 rounded w-4/5"></div>
              </div>
            )}

            {!isGeneratingSummary && aiSummary && (
              <div className="bg-slate-50 border border-slate-200 rounded p-5 relative">
                <div className="prose prose-sm max-w-none prose-slate">
                  {renderFormattedSummary(aiSummary)}
                </div>
                
                <div className="mt-4 border-t border-slate-200 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>💡 Rekomendasi di atas disesuaikan dengan transaksi terfilter saat ini secara real-time.</span>
                  <span>Terakhir Diperbarui: Baru saja</span>
                </div>
              </div>
            )}

            {/* Interactive Q&A Section */}
            <div className="mt-6 border-t border-slate-200/85 pt-6" id="dashboard-ai-qa">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-indigo-500 animate-pulse" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Tanya AI Secara Interaktif (Q&A)</h4>
                </div>
                {chatMessages.length > 0 && (
                  <button
                    onClick={handleClearDashboardChat}
                    className="text-[9.5px] font-bold text-red-500 hover:text-red-700 hover:underline transition uppercase tracking-wider cursor-pointer"
                  >
                    Hapus Obrolan
                  </button>
                )}
              </div>

              {/* Chat history bubbles */}
              {chatMessages.length > 0 && (
                <div className="space-y-4 mb-4 max-h-[350px] overflow-y-auto p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                    >
                      <div className={`p-1.5 rounded h-7 w-7 flex items-center justify-center shrink-0 border ${
                        msg.role === 'user' 
                          ? 'bg-slate-200 border-slate-300 text-slate-700' 
                          : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                      }`}>
                        {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-xs font-medium shadow-xs border ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 border-indigo-650 text-white font-semibold'
                          : 'bg-white border-slate-200 text-slate-850'
                      }`}>
                        {msg.role === 'user' ? (
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div className="prose prose-sm max-w-none leading-relaxed">
                            {renderFormattedSummary(msg.content)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {chatLoading && (
                    <div className="flex gap-3 max-w-[80%] mr-auto">
                      <div className="p-1.5 rounded h-7 w-7 flex items-center justify-center shrink-0 border bg-indigo-50 border-indigo-100 text-indigo-600">
                        <Bot className="h-3.5 w-3.5 animate-spin" />
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 flex items-center gap-1.5 font-bold shadow-xs">
                        <RefreshCw className="h-3.5 w-3.5 text-indigo-500 animate-spin" />
                        <span>AI sedang memformulasikan analisis kas...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick suggestion chips */}
              <div className="mb-3.5">
                <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Saran Analisis Kas:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Bagaimana kondisi keuangan Basco saat ini?",
                    "Kenapa profit margin Basco tipis?",
                    "Solusi efisiensi gaji staff",
                    "Apakah rasio HPP (COGS) Basco aman?"
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={chatLoading}
                      onClick={() => handleSendCustomQuestion(preset)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-[10px] font-bold text-slate-650 hover:text-slate-800 rounded-lg border border-slate-250 transition cursor-pointer"
                    >
                      💡 {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCustomQuestion(customQuestion);
                }}
                className="flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  disabled={chatLoading}
                  placeholder="Ketik pertanyaan untuk menganalisis arus kas Basco di sini..."
                  className="flex-grow px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-slate-400 focus:outline-none rounded-xl text-xs font-semibold transition"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !customQuestion.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-150 disabled:text-slate-300 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-sm"
                >
                  <span>Kirim</span>
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

    </div>

      {/* PRINT REPORT TEMPLATE & INTERACTIVE PREVIEW MODAL */}
      <div 
        id="print-report-container" 
        className={`${isPdfPreviewOpen ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex flex-col items-center' : 'hidden'} print:block print:static print:p-0 bg-white font-sans text-slate-900 leading-relaxed max-w-4xl mx-auto`}
      >
        {isPdfPreviewOpen && (
          <div className="w-full max-w-4xl bg-slate-900 text-white p-4 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl border border-slate-700 no-print shrink-0 mb-3 sticky top-0 z-20">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Pratinjau Laporan Keuangan PDF
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Periode: <strong className="text-amber-400">{getFilterPeriodLabel()}</strong> • {pdfPrintData.pengeluaranList.length} Pengeluaran Terbayar • {pdfPrintData.unpaidList.length} Belum Terbayar
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleDirectDownloadPDF}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Download className={`h-3.5 w-3.5 ${isGeneratingPdf ? 'animate-spin' : ''}`} />
                <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Unduh PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPDF}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak / Simpan PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPdfPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Tutup Pratinjau"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Paper Sheet Content */}
        <div className="bg-white w-full rounded-2xl shadow-xl print:shadow-none p-6 sm:p-10 border border-slate-200 print:border-none print:p-0">
          {/* HEADER KOP LAPORAN */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Basco Cashflow</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Sistem Laporan Performa Keuangan Terintegrasi</p>
            <div className="text-[11px] text-slate-600 mt-3 space-y-0.5">
              <p><strong>Sumber Database:</strong> Google Sheets Sync Engine</p>
              {spreadsheetUrl && <p className="truncate max-w-md"><strong>ID Spreadsheet:</strong> {spreadsheetUrl.split('/d/')[1]?.split('/')[0] || 'Tersambung'}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded mb-2">
              LAPORAN BULANAN
            </div>
            <p className="text-xs text-slate-600"><strong>Waktu Cetak:</strong> {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-xs text-slate-600"><strong>Periode Analisis:</strong> <span className="font-bold text-slate-800">{getFilterPeriodLabel()}</span></p>
          </div>
        </div>

        {/* METAGROUP & RINGKASAN UTAMA */}
        <div className="mb-8">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 mb-4">
            I. Ringkasan Kinerja Keuangan
          </h3>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 border border-slate-300 rounded bg-slate-50/50">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Total Pemasukan (IN)</p>
              <p className="text-lg font-extrabold text-emerald-750 font-mono mt-1">{formatRupiah(filteredStats.totalDebit)}</p>
              <p className="text-[9px] text-slate-400 mt-1 font-bold">Penerimaan dari Penjualan / Cafe</p>
            </div>
            <div className="p-4 border border-slate-300 rounded bg-slate-50/50">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Total Pengeluaran (OUT)</p>
              <p className="text-lg font-extrabold text-rose-750 font-mono mt-1">{formatRupiah(filteredStats.totalKredit)}</p>
              <p className="text-[9px] text-slate-400 mt-1 font-bold">HPP, Gaji, Operasional, dll</p>
            </div>
            <div className="p-4 border border-slate-300 rounded bg-slate-50/50">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Arus Kas Bersih (Profit)</p>
              <p className={`text-lg font-extrabold font-mono mt-1 ${filteredStats.saldo >= 0 ? 'text-emerald-750' : 'text-rose-750'}`}>
                {formatRupiah(filteredStats.saldo)}
              </p>
              <p className="text-[9px] text-slate-400 mt-1 font-bold">
                Status: <span className="font-extrabold uppercase tracking-wider">{filteredStats.saldo >= 0 ? 'SURPLUS' : 'DEFISIT'}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 border border-slate-200 rounded text-center">
              <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Margin Laba Bersih</p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">{cafeMetrics.netProfitMargin}%</p>
            </div>
            <div className="p-3 border border-slate-200 rounded text-center flex flex-col justify-between">
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Rasio Bahan Baku (COGS)</p>
                <p className="text-sm font-extrabold text-slate-800 mt-0.5">{cafeMetrics.cogsRatio}%</p>
              </div>
              <div className="text-[7.5px] text-slate-500 font-bold border-t border-slate-150 pt-1 mt-1 space-y-0.5 text-left">
                <div className="flex justify-between"><span>🥤 Minuman:</span><span>{cafeMetrics.cogsDrinkRatio}%</span></div>
                <div className="flex justify-between"><span>🍔 Makanan:</span><span>{cafeMetrics.cogsFoodRatio}%</span></div>
                <div className="flex justify-between"><span>🍟 Snack:</span><span>{cafeMetrics.cogsSnackRatio}%</span></div>
              </div>
            </div>
            <div className="p-3 border border-slate-200 rounded text-center">
              <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Rasio Gaji Staff</p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">{cafeMetrics.wagesRatio}%</p>
            </div>
            <div className="p-3 border border-slate-200 rounded text-center">
              <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Rasio Operasional</p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">{cafeMetrics.operasionalRatio}%</p>
            </div>
          </div>

          {/* Kartu Ringkasan Estimasi Laba Bersih Bulanan (Automated Calculation) */}
          <div className="mt-4 p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 print:bg-none print:bg-slate-50 text-white print:text-slate-900 rounded-2xl border border-slate-800 print:border-slate-300 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 print:border-slate-300 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 print:text-indigo-800 print:bg-indigo-100 rounded-xl border border-indigo-500/30 print:border-indigo-200">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white print:text-slate-900 flex items-center gap-2">
                    Kartu Ringkasan Estimasi Laba Bersih Bulanan
                    <span className="px-2 py-0.5 bg-emerald-500/20 print:bg-emerald-100 text-emerald-300 print:text-emerald-800 font-extrabold text-[9px] rounded-full uppercase tracking-wider border border-emerald-500/30 print:border-emerald-200">
                      Otomatis
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400 print:text-slate-600 font-medium mt-0.5">
                    Kalkulasi Otomatis: Reducing Total Operasional (Fixed Cost) from Margin Laba Kotor
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-emerald-300 print:text-emerald-850 bg-emerald-950/60 print:bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-800/50 print:border-emerald-200 self-start sm:self-auto font-black">
                Formula: Laba Kotor - Fixed Cost = Laba Bersih
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-800/60 print:bg-white p-3.5 rounded-xl border border-slate-700/60 print:border-slate-200 space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 print:text-slate-600 block">1. Total Margin Laba Kotor (GP)</span>
                <p className="font-mono text-lg font-black text-indigo-300 print:text-indigo-800">{formatRupiah(cafeMetrics.grossProfit)}</p>
                <div className="text-[9px] text-slate-400 print:text-slate-600 font-medium flex justify-between pt-1 border-t border-slate-700/50 print:border-slate-200">
                  <span>Gross Margin:</span>
                  <strong className="text-indigo-400 print:text-indigo-800">{cafeMetrics.grossProfitMargin}%</strong>
                </div>
              </div>

              <div className="bg-slate-800/60 print:bg-white p-3.5 rounded-xl border border-slate-700/60 print:border-slate-200 space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 print:text-slate-600 block">2. Total Operasional (Fixed Cost)</span>
                <p className="font-mono text-lg font-black text-amber-300 print:text-amber-800">{formatRupiah(cafeMetrics.totalWages + cafeMetrics.totalOperasional)}</p>
                <div className="text-[9px] text-slate-400 print:text-slate-600 font-medium flex justify-between pt-1 border-t border-slate-700/50 print:border-slate-200">
                  <span>Gaji: {formatRupiah(cafeMetrics.totalWages)}</span>
                  <span>Operasional: {formatRupiah(cafeMetrics.totalOperasional)}</span>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border space-y-1 ${
                cafeMetrics.operatingProfit >= 0 ? 'bg-emerald-950/50 print:bg-emerald-50 border-emerald-500/40 print:border-emerald-300' : 'bg-rose-950/50 print:bg-rose-50 border-rose-500/40 print:border-rose-300'
              }`}>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 print:text-slate-700 block">3. Estimasi Laba Bersih (Net Profit)</span>
                <p className={`font-mono text-xl font-black ${
                  cafeMetrics.operatingProfit >= 0 ? 'text-emerald-400 print:text-emerald-800' : 'text-rose-400 print:text-rose-800'
                }`}>
                  {formatRupiah(cafeMetrics.operatingProfit)}
                </p>
                <div className="text-[9px] text-slate-300 print:text-slate-700 font-semibold flex justify-between pt-1 border-t border-slate-700/50 print:border-slate-200">
                  <span>Net Profit Margin (NPM):</span>
                  <strong className="text-emerald-300 print:text-emerald-800 font-mono">{cafeMetrics.netProfitMargin}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Analisis Profitabilitas Detail & BEP */}
          <div className="mt-4 p-4 border border-indigo-200 rounded bg-indigo-50/20">
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 mb-2.5 flex items-center gap-1">
              <span>📊</span> Analisis Profitabilitas & Titik Impas (Break-Even Point)
            </h4>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500">Laba Kotor (Gross Profit)</p>
                <p className="font-mono font-bold text-slate-800 mt-0.5">{formatRupiah(cafeMetrics.grossProfit)}</p>
                <p className="text-[8px] text-slate-400 font-medium">Margin: <strong className="text-indigo-700">{cafeMetrics.grossProfitMargin}%</strong> (Standar: 60-70%)</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500">Laba Operasional (EBITDA)</p>
                <p className="font-mono font-bold text-slate-800 mt-0.5">{formatRupiah(cafeMetrics.operatingProfit)}</p>
                <p className="text-[8px] text-slate-400 font-medium">Margin: <strong className="text-indigo-700">{cafeMetrics.operatingProfitMargin}%</strong> (Standar: 15-25%)</p>
              </div>
              <div>
                {(() => {
                  const fixedCost = cafeMetrics.totalWages + (cafeMetrics.totalOperasional * 0.6);
                  const gpRatio = cafeMetrics.grossProfitMargin / 100;
                  const bepSales = gpRatio > 0 ? fixedCost / gpRatio : 0;
                  return (
                    <>
                      <p className="text-[9px] font-black uppercase text-indigo-900">Target Omset BEP</p>
                      <p className="font-mono font-black text-indigo-900 mt-0.5">{formatRupiah(bepSales)}</p>
                      <p className="text-[8px] text-slate-500 font-semibold">
                        Status: {cafeMetrics.totalSales >= bepSales ? (
                          <span className="text-emerald-700 font-black uppercase tracking-wider">MENCAPAI BEP</span>
                        ) : (
                          <span className="text-rose-700 font-black uppercase tracking-wider">DI BAWAH BEP</span>
                        )}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* TABEL 1: PENGELUARAN (PENGELUARAN 1 TERGABUNG & TERKONSOLIDASI) */}
        <div className="mb-8 page-break-inside-avoid">
          <div className="flex justify-between items-baseline border-b-2 border-slate-900 pb-1.5 mb-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <span>1. Tabel Pengeluaran</span>
                <span className="text-[10px] font-bold text-slate-500 normal-case">(Terkonsolidasi Pengeluaran 1)</span>
              </h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Akumulasi seluruh biaya terbayar yang otomatis digabungkan berdasarkan kesamaan jenis Pengeluaran 1
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] bg-rose-50 text-rose-800 font-mono font-black px-2.5 py-0.5 rounded border border-rose-200">
                Total: {formatRupiah(pdfPrintData.grandTotalPengeluaran)}
              </span>
            </div>
          </div>
          
          <table className="w-full text-xs text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider border-b border-slate-300 text-[10px]">
                <th className="p-2 border border-slate-300 text-center w-[40px]">No</th>
                <th className="p-2 border border-slate-300">Pengeluaran 1</th>
                <th className="p-2 border border-slate-300 text-center w-[110px]">FREKUENSI</th>
                <th className="p-2 border border-slate-300 text-right w-[160px]">total pengeluaran</th>
                <th className="p-2 border border-slate-300 text-right w-[110px]">presentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pdfPrintData.pengeluaranList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                    Tidak ada data pengeluaran (kredit) dalam filter periode ini.
                  </td>
                </tr>
              ) : (
                pdfPrintData.pengeluaranList.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="p-2 border border-slate-300 text-center text-slate-500 font-semibold">{idx + 1}</td>
                    <td className="p-2 border border-slate-300">
                      <div className="font-bold text-slate-900 uppercase">
                        {item.nama}
                      </div>
                      {item.formattedDates && item.formattedDates !== '-' && (
                        <div className="text-[9.5px] text-slate-500 font-mono mt-0.5 leading-snug">
                          <span className="font-semibold text-slate-600">Tgl:</span> {item.formattedDates}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-700 font-semibold">
                      {item.frekuensi}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-bold text-rose-700">
                      {formatRupiah(item.total)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-bold text-slate-700">
                      {item.presentase}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {pdfPrintData.pengeluaranList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-150 font-black border-t-2 border-slate-400 text-slate-900">
                  <td colSpan={2} className="p-2 border border-slate-300 uppercase tracking-wider text-right font-black">
                    Total Pengeluaran:
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-mono font-black">
                    {pdfPrintData.totalFrekuensiPengeluaran}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-rose-800 text-sm font-black">
                    {formatRupiah(pdfPrintData.grandTotalPengeluaran)}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-black">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* TABEL 2: PEMASUKAN */}
        <div className="mb-8 page-break-inside-avoid">
          <div className="flex justify-between items-baseline border-b-2 border-slate-900 pb-1.5 mb-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <span>2. Tabel Pemasukan</span>
                <span className="text-[10px] font-bold text-slate-500 normal-case">(Terkonsolidasi Sumber Pemasukan)</span>
              </h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Akumulasi seluruh penerimaan kas masuk yang otomatis digabungkan berdasarkan jenis transaksi
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] bg-emerald-50 text-emerald-800 font-mono font-black px-2.5 py-0.5 rounded border border-emerald-200">
                Total: {formatRupiah(pdfPrintData.grandTotalPemasukan)}
              </span>
            </div>
          </div>
          
          <table className="w-full text-xs text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider border-b border-slate-300 text-[10px]">
                <th className="p-2 border border-slate-300 text-center w-[40px]">No</th>
                <th className="p-2 border border-slate-300">Pengeluaran 1</th>
                <th className="p-2 border border-slate-300 text-center w-[110px]">FREKUENSI</th>
                <th className="p-2 border border-slate-300 text-right w-[160px]">total pemasukan</th>
                <th className="p-2 border border-slate-300 text-right w-[110px]">presentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pdfPrintData.pemasukanList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                    Tidak ada data pemasukan (debit) dalam filter periode ini.
                  </td>
                </tr>
              ) : (
                pdfPrintData.pemasukanList.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="p-2 border border-slate-300 text-center text-slate-500 font-semibold">{idx + 1}</td>
                    <td className="p-2 border border-slate-300">
                      <div className="font-bold text-slate-900 uppercase">
                        {item.nama}
                      </div>
                      {item.formattedDates && item.formattedDates !== '-' && (
                        <div className="text-[9.5px] text-slate-500 font-mono mt-0.5 leading-snug">
                          <span className="font-semibold text-slate-600">Tgl:</span> {item.formattedDates}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-700 font-semibold">
                      {item.frekuensi}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-bold text-emerald-700">
                      {formatRupiah(item.total)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-bold text-slate-700">
                      {item.presentase}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {pdfPrintData.pemasukanList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-150 font-black border-t-2 border-slate-400 text-slate-900">
                  <td colSpan={2} className="p-2 border border-slate-300 uppercase tracking-wider text-right font-black">
                    Total Pemasukan:
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-mono font-black">
                    {pdfPrintData.totalFrekuensiPemasukan}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-emerald-800 text-sm font-black">
                    {formatRupiah(pdfPrintData.grandTotalPemasukan)}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-black">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* TABEL PENGELUARAN BELUM TERBAYAR (JIKA TOTAL 0) */}
        {pdfPrintData.unpaidList.length > 0 && (
          <div className="mb-8 page-break-inside-avoid">
            <div className="flex justify-between items-baseline border-b-2 border-amber-600 pb-1.5 mb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                  <span>3. Tabel Pengeluaran Belum Terbayar</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-black border border-amber-300 uppercase">
                    Jumlah Total Rp 0 / Pending
                  </span>
                </h3>
                <p className="text-[10px] text-amber-800 font-medium mt-0.5">
                  Daftar transaksi pengeluaran tercatat yang belum memiliki nominal pembayaran / belum terbayar
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {pdfPrintData.unpaidList.length} Item Belum Terbayar
                </span>
              </div>
            </div>
            
            <table className="w-full text-xs text-left border-collapse border border-amber-300">
              <thead>
                <tr className="bg-amber-100/70 text-amber-950 font-bold uppercase tracking-wider border-b border-amber-300 text-[10px]">
                  <th className="p-2 border border-amber-300 text-center w-[40px]">No</th>
                  <th className="p-2 border border-amber-300">Pengeluaran 1</th>
                  <th className="p-2 border border-amber-300 text-center w-[110px]">FREKUENSI</th>
                  <th className="p-2 border border-amber-300 text-right w-[160px]">total pengeluaran</th>
                  <th className="p-2 border border-amber-300 text-right w-[110px]">presentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200">
                {pdfPrintData.unpaidList.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'}>
                    <td className="p-2 border border-amber-300 text-center text-slate-500 font-semibold">{idx + 1}</td>
                    <td className="p-2 border border-amber-300">
                      <div className="font-bold text-slate-900 uppercase">
                        {item.nama}
                      </div>
                      {item.formattedDates && item.formattedDates !== '-' && (
                        <div className="text-[9.5px] text-amber-800/80 font-mono mt-0.5 leading-snug">
                          <span className="font-semibold text-amber-900">Tgl:</span> {item.formattedDates}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border border-amber-300 text-center font-mono text-slate-700 font-semibold">
                      {item.frekuensi}
                    </td>
                    <td className="p-2 border border-amber-300 text-right font-mono font-bold text-amber-700">
                      Rp 0
                    </td>
                    <td className="p-2 border border-amber-300 text-right font-mono font-bold text-amber-800">
                      0.0% <span className="text-[9px] font-sans font-semibold text-amber-700 block uppercase">(Belum Terbayar)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-100/80 font-black border-t-2 border-amber-400 text-amber-950">
                  <td colSpan={2} className="p-2 border border-amber-300 uppercase tracking-wider text-right font-black">
                    Total Pengeluaran Belum Terbayar:
                  </td>
                  <td className="p-2 border border-amber-300 text-center font-mono font-black">
                    {pdfPrintData.totalFrekuensiUnpaid}
                  </td>
                  <td className="p-2 border border-amber-300 text-right font-mono text-amber-800 text-sm font-black">
                    Rp 0
                  </td>
                  <td className="p-2 border border-amber-300 text-right font-mono font-black">
                    0.0%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REKAPITULASI AKHIR: TOTAL JUMLAH PENGELUARAN SESUAI PENGELUARAN 1 (PENGELOMPOKAN & PENGGABUNGAN) */}
        <div className="mb-8 p-5 bg-slate-50 rounded-xl border-2 border-slate-300 page-break-inside-avoid">
          <div className="border-b border-slate-300 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <span>📋</span> Rekapitulasi Akhir Total Pengeluaran Sesuai Pengeluaran 1
              </h4>
              <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                Pengelompokan dan penggabungan menyeluruh seluruh jenis Pengeluaran 1 beserta akumulasi biaya final
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase text-slate-500 block">Total Pengeluaran Terbayar</span>
              <span className="text-lg font-black text-rose-700 font-mono">
                {formatRupiah(pdfPrintData.grandTotalPengeluaran)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-4">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                Ringkasan Penggabungan Pengeluaran 1
              </span>
              <div className="mt-1.5 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-slate-700">
                  <span>Jumlah Jenis Pengeluaran Terbayar:</span>
                  <strong className="text-slate-900">{pdfPrintData.pengeluaranList.length} Jenis</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Total Frekuensi Transaksi Terbayar:</span>
                  <strong className="text-slate-900">{pdfPrintData.totalFrekuensiPengeluaran} Transaksi</strong>
                </div>
                {pdfPrintData.unpaidList.length > 0 && (
                  <div className="flex justify-between text-amber-800 border-t border-slate-100 pt-1 mt-1">
                    <span>Pengeluaran Belum Terbayar (Rp 0):</span>
                    <strong>{pdfPrintData.unpaidList.length} Jenis ({pdfPrintData.totalFrekuensiUnpaid} Transaksi)</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                Top 3 Pengeluaran Terbesar
              </span>
              <div className="mt-1.5 space-y-1 text-[11px]">
                {pdfPrintData.pengeluaranList.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-slate-700 font-bold truncate max-w-[180px]">{i + 1}. {item.nama}</span>
                    <span className="font-mono font-black text-rose-700">{formatRupiah(item.total)} ({item.presentase}%)</span>
                  </div>
                ))}
                {pdfPrintData.pengeluaranList.length === 0 && (
                  <span className="text-slate-400 italic text-[10px]">Tidak ada data pengeluaran</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
            <span><strong>Status Verifikasi Data:</strong> Seluruh item Pengeluaran 1 telah terverifikasi dan digabungkan secara otomatis.</span>
            <span className="font-mono font-bold text-slate-800">100.0% Terkonsolidasi</span>
          </div>
        </div>

        {/* BAGIAN 5: ANALISIS AI KONDISI KEUANGAN & REKOMENDASI TAKTIS */}
        <div className="mb-8 p-5 bg-indigo-50/40 rounded-xl border-2 border-indigo-200 page-break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-indigo-200 pb-2.5 mb-3.5 gap-2">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <span>5. Analisis AI Kondisi Keuangan & Rekomendasi Taktis</span>
                  <span className="text-[8.5px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold border border-indigo-200 uppercase">
                    AI Financial Diagnosis
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Evaluasi pintar kondisi kas, batas aman rasio bisnis kafe, dan rekomendasi strategis manajemen
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono font-black text-indigo-950 bg-white px-2 py-0.5 rounded border border-indigo-200">
                Basco AI Intelligence
              </span>
            </div>
          </div>

          {dynamicAiAnalysis ? (
            <div className="space-y-3 text-xs">
              {/* Highlight Diagnosis Banner */}
              <div className={`p-3 rounded-lg border flex items-start gap-3 ${
                dynamicAiAnalysis.isSurplus 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                <div className={`p-1.5 rounded-md mt-0.5 ${dynamicAiAnalysis.isSurplus ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                  {dynamicAiAnalysis.isSurplus ? <TrendingUp className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                </div>
                <div>
                  <h5 className="font-black text-[11px] uppercase tracking-wide">
                    {dynamicAiAnalysis.isSurplus ? 'Status Arus Kas: SURPLUS (Sehat & Likuid)' : 'Status Arus Kas: DEFISIT (Perlu Efisiensi Biaya)'}
                  </h5>
                  <p className="text-[10.5px] mt-0.5 leading-relaxed font-medium">
                    {dynamicAiAnalysis.summaryParagraph}
                  </p>
                </div>
              </div>

              {/* Grid 3 Kolom Analisis Detail */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-[9.5px] font-black uppercase text-slate-500">
                    <span>1. Audit Rasio HPP</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold ${dynamicAiAnalysis.cogs <= 35 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {dynamicAiAnalysis.cogs}%
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-600 leading-relaxed pt-0.5">
                    {dynamicAiAnalysis.cogsDiagnosis}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-[9.5px] font-black uppercase text-slate-500">
                    <span>2. Biaya Tetap & Gaji</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold ${dynamicAiAnalysis.wages <= 25 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {dynamicAiAnalysis.wages}% Gaji
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-600 leading-relaxed pt-0.5">
                    {dynamicAiAnalysis.fixedCostDiagnosis}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-[9.5px] font-black uppercase text-slate-500">
                    <span>3. Titik Impas BEP</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold ${dynamicAiAnalysis.isBepAchieved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {dynamicAiAnalysis.isBepAchieved ? 'Mencapai BEP' : 'Di Bawah BEP'}
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-600 leading-relaxed pt-0.5">
                    {dynamicAiAnalysis.bepDiagnosis}
                  </p>
                </div>
              </div>

              {/* Rekomendasi Taktis AI */}
              <div className="p-3.5 bg-white rounded-lg border border-indigo-200 space-y-1.5">
                <h5 className="text-[10.5px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-indigo-600" />
                  Rekomendasi Taktis & Rencana Aksi Manajemen (AI Suggestions):
                </h5>
                <ol className="space-y-1 pl-4 list-decimal text-[10px] text-slate-700 font-medium leading-relaxed">
                  {dynamicAiAnalysis.recommendations.map((rec, rIdx) => (
                    <li key={rIdx}>{rec}</li>
                  ))}
                </ol>
              </div>

              {/* Ulasan Naratif AI Tambahan (Jika sudah digenerate via Gemini) */}
              {aiSummary && (
                <div className="mt-3 p-3.5 bg-white rounded-lg border border-indigo-200 space-y-1.5">
                  <h5 className="text-[10.5px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-indigo-600" />
                    Ulasan Naratif AI Khusus (Gemini Financial Intelligence):
                  </h5>
                  <div className="text-[10px] text-slate-700 leading-relaxed">
                    {renderFormattedSummary(aiSummary)}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* SIGNATURE BLOCK */}
        <div className="mt-12 pt-8 border-t border-slate-200 page-break-inside-avoid">
          <div className="grid grid-cols-2 gap-20">
            <div className="text-center">
              <p className="text-xs text-slate-500">Prepared and Reported by,</p>
              <div className="h-16"></div>
              <p className="text-xs font-bold text-slate-800 underline">Staff Administrasi Keuangan</p>
              <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">Finance Admin & Cashier</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Reviewed and Approved by,</p>
              <div className="h-16"></div>
              <p className="text-xs font-bold text-slate-800 underline">Owner / Cafe Manager</p>
              <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">General Management</p>
            </div>
          </div>
        </div>
        {/* End Paper Sheet Content */}
        </div>
      {/* End #print-report-container */}
      </div>

      {/* MODAL PENGATURAN KATEGORI RASIO BISNIS CAFE SECARA MANUAL */}
      <CafeRatioSettingsModal
        isOpen={isRatioSettingsModalOpen}
        onClose={() => setIsRatioSettingsModalOpen(false)}
        config={ratioConfig}
        onSaveConfig={handleSaveRatioConfig}
        transactions={transactions}
        filteredTransactions={filteredTransactions}
        masterCategories={CATEGORIES as unknown as string[]}
      />
    </>
  );
}
