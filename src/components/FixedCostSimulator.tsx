import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calculator,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  CreditCard,
  Utensils,
  Layers,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Percent,
  Sliders,
  HelpCircle,
  Activity,
  Bot,
  MessageSquare,
  Send,
  User
} from 'lucide-react';
import { Transaction, AppRole, DebtItem } from '../types';
import { getStoredDebts } from '../utils/debtUtils';
import { pullDailySalesFromCloud } from '../utils/cloudSync';
import {
  saveGlobalPerformanceToSheet,
  fetchGlobalPerformanceFromSheet,
  GlobalPerformanceSnapshot
} from '../sheetsService';
import { logAppActivity } from '../utils/activityLogger';
import { generateSmartCashflowChatReply } from '../utils/aiAssistantEngine';
import { saveFixedCostsToMySql, saveGlobalEvaluationToMySql } from '../utils/mysqlSync';

export interface FixedCostItem {
  id: string;
  name: string;
  category: string;
  amount: number;
}

function formatRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0);
}

export interface DailySalesRecord {
  id: string;
  tanggal: string;
  cups: number;
  omset: number;
  hppTotal: number;
  notes?: string;
  menuSales?: Array<{
    menuId: string;
    nama: string;
    kategori: string;
    hargaJual: number;
    hpp: number;
    jatah: number;
    terjual: number;
  }>;
}

interface FixedCostSimulatorProps {
  transactions?: Transaction[];
  spreadsheetId?: string | null;
  spreadsheetName?: string | null;
  spreadsheetUrl?: string | null;
  token?: string | null;
  userRole?: AppRole;
  onLoginGoogle?: () => void;
}

type TimeframeMode = 'harian' | 'bulanan' | 'tahunan';

const DEFAULT_FIXED_COSTS: FixedCostItem[] = [
  { id: '1', name: 'Sewa Ruko Bulanan', category: 'Sewa Tempat', amount: 3500000 },
  { id: '2', name: 'Gaji Tetap Barista & Staff', category: 'Tenaga Kerja', amount: 4000000 },
  { id: '3', name: 'Paket Internet (i connect wifi)', category: 'Utilitas', amount: 350000 },
  { id: '4', name: 'Beban Listrik & Air Minimum', category: 'Utilitas', amount: 750000 },
  { id: '5', name: 'Retribusi Sampah & Keamanan', category: 'Administrasi', amount: 150000 }
];

export default function FixedCostSimulator({
  transactions: propTransactions,
  spreadsheetId,
  spreadsheetName,
  spreadsheetUrl,
  token,
  userRole = 'owner',
  onLoginGoogle
}: FixedCostSimulatorProps) {
  // 1. Timeframe selection
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('bulanan');
  
  // Dates state
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM
  const currentYearStr = String(now.getFullYear()); // YYYY

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return localStorage.getItem('aruskas_cogs_selected_date') || todayStr;
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);

  // 2. Fixed cost items state
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>(() => {
    const saved = localStorage.getItem('aruskas_fixed_costs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return DEFAULT_FIXED_COSTS;
  });

  // Fixed Cost management form
  const [showManageFixedCost, setShowManageFixedCost] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Sewa Tempat');
  const [newItemAmount, setNewItemAmount] = useState<string>('');

  // 3. Realtime external data states
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (propTransactions && propTransactions.length > 0) return propTransactions;
    try {
      const saved = localStorage.getItem('aruskas_manager_transactions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [debts, setDebts] = useState<DebtItem[]>(() => getStoredDebts());
  const [dailySales, setDailySales] = useState<DailySalesRecord[]>(() => {
    try {
      const saved = localStorage.getItem('aruskas_cogs_page_daily_sales');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // 4. Saved Snapshots history
  const [savedSnapshots, setSavedSnapshots] = useState<GlobalPerformanceSnapshot[]>([]);
  const [isSavingToSheet, setIsSavingToSheet] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
    needsAuth?: boolean;
  } | null>(null);

  // 5. AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string>(() => {
    return localStorage.getItem('aruskas_global_performance_ai') || '';
  });
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini'>('claude');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiEngineUsed, setAiEngineUsed] = useState<string>('');
  const [isCopiedAi, setIsCopiedAi] = useState(false);

  // AI Chat & Discussion Sub-Tab State
  const [aiSubTab, setAiSubTab] = useState<'analysis' | 'chat'>('analysis');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'model'; content: string; timestamp: string }>>(() => {
    try {
      const saved = localStorage.getItem('basco_fixed_cost_chat');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        role: 'model',
        content: 'Halo! Saya AI Financial Advisor Basco Coffee. Tanyakan apa saja mengenai evaluasi titik impas (BEP), efisiensi pos biaya tetap, keamanan cicilan hutang, atau strategi mendongkrak margin laba bersih kafe.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('basco_fixed_cost_chat', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    if (aiSubTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, aiSubTab]);

  // 6. Interactive Stress Test & Simulation
  const [omsetSliderAdjust, setOmsetSliderAdjust] = useState<number>(0); // -30% to +30%

  // Keep transactions in sync with props
  useEffect(() => {
    if (propTransactions) {
      setTransactions(propTransactions);
    }
  }, [propTransactions]);

  // Persist fixed costs
  useEffect(() => {
    localStorage.setItem('aruskas_fixed_costs', JSON.stringify(fixedCosts));
    if (fixedCosts.length > 0) {
      saveFixedCostsToMySql(fixedCosts);
    }
  }, [fixedCosts]);

  // Load saved snapshots on mount
  useEffect(() => {
    void fetchGlobalPerformanceFromSheet(spreadsheetId, token).then(res => {
      if (res && res.length > 0) setSavedSnapshots(res);
    });
  }, [spreadsheetId, token]);

  // Pull latest cloud daily sales and debts
  const refreshLiveSources = async () => {
    setDebts(getStoredDebts());
    try {
      const sharedData = await pullDailySalesFromCloud();
      if (sharedData?.recordsByDate && typeof sharedData.recordsByDate === 'object') {
        const remoteSales = (Object.values(sharedData.recordsByDate) as DailySalesRecord[]).filter(
          r => r && r.id !== 'ds-1' && r.id !== 'ds-2' && r.id !== 'ds-3'
        );
        if (remoteSales.length > 0) {
          setDailySales(remoteSales);
          localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(remoteSales));
        }
      }
    } catch {}
  };

  useEffect(() => {
    void refreshLiveSources();
  }, []);

  // Compute Total Fixed Cost (Monthly base)
  const totalMonthlyFixedCost = useMemo(() => {
    return fixedCosts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [fixedCosts]);

  // Compute Total Active Debts & Monthly installment
  const debtMetrics = useMemo(() => {
    const activeDebts = debts.filter(d => d.status === 'active');
    const totalRemaining = activeDebts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
    const totalMonthlyInstallment = activeDebts.reduce((sum, d) => sum + (Number(d.monthlyInstallment) || 0), 0);
    const totalAnnualInstallment = activeDebts.reduce((sum, d) => sum + (Number(d.annualInstallment) || (Number(d.monthlyInstallment) * 12) || 0), 0);
    return {
      activeDebts,
      count: activeDebts.length,
      totalRemaining,
      totalMonthlyInstallment,
      totalAnnualInstallment
    };
  }, [debts]);

  // Current Period Label
  const currentPeriodLabel = useMemo(() => {
    if (timeframeMode === 'harian') {
      try {
        const [y, m, d] = selectedDate.split('-');
        return `${d}/${m}/${y}`;
      } catch {
        return selectedDate;
      }
    } else if (timeframeMode === 'bulanan') {
      try {
        const [y, m] = selectedMonth.split('-');
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return `${monthNames[parseInt(m, 10) - 1] || m} ${y}`;
      } catch {
        return selectedMonth;
      }
    } else {
      return `Tahun ${selectedYear}`;
    }
  }, [timeframeMode, selectedDate, selectedMonth, selectedYear]);

  // REALTIME MULTI-DIMENSION METRICS ENGINE
  const liveMetrics = useMemo(() => {
    // 1. Filter Cashflow Transactions
    const filteredTx = transactions.filter(t => {
      if (!t.tanggal) return false;
      if (timeframeMode === 'harian') {
        return t.tanggal === selectedDate;
      } else if (timeframeMode === 'bulanan') {
        return t.tanggal.startsWith(selectedMonth);
      } else {
        return t.tanggal.startsWith(selectedYear);
      }
    });

    const cashInflow = filteredTx.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
    const cashOutflow = filteredTx.reduce((sum, t) => sum + (Number(t.kredit || 0) + Number(t.kredit2 || 0)), 0);
    const netCashflow = cashInflow - cashOutflow;

    // 2. Filter Daily Sales (Realisasi Omset & Porsi)
    const filteredSales = dailySales.filter(ds => {
      if (!ds.tanggal) return false;
      if (timeframeMode === 'harian') {
        return ds.tanggal === selectedDate;
      } else if (timeframeMode === 'bulanan') {
        return ds.tanggal.startsWith(selectedMonth);
      } else {
        return ds.tanggal.startsWith(selectedYear);
      }
    });

    const totalSalesOmset = filteredSales.reduce((sum, ds) => sum + (Number(ds.omset) || 0), 0);
    const totalSalesCups = filteredSales.reduce((sum, ds) => sum + (Number(ds.cups) || 0), 0);
    const totalSalesHpp = filteredSales.reduce((sum, ds) => sum + (Number(ds.hppTotal) || 0), 0);

    // If Daily Sales omset is 0, fall back to cashflow sales inflow so data is always meaningful
    const baseOmset = totalSalesOmset > 0 ? totalSalesOmset : cashInflow;
    
    // Apply interactive slider adjust if simulated
    const effectiveOmset = Math.round(baseOmset * (1 + omsetSliderAdjust / 100));

    // 3. Pro-rate Fixed Cost based on Timeframe
    let timeframeFixedCost = totalMonthlyFixedCost;
    if (timeframeMode === 'harian') {
      timeframeFixedCost = Math.round(totalMonthlyFixedCost / 30);
    } else if (timeframeMode === 'tahunan') {
      timeframeFixedCost = totalMonthlyFixedCost * 12;
    }

    // 4. Pro-rate Debt Installment based on Timeframe
    let timeframeDebtCost = debtMetrics.totalMonthlyInstallment;
    if (timeframeMode === 'harian') {
      timeframeDebtCost = Math.round(debtMetrics.totalMonthlyInstallment / 30);
    } else if (timeframeMode === 'tahunan') {
      timeframeDebtCost = debtMetrics.totalAnnualInstallment;
    }

    // 5. Estimate COGS / Bahan Baku
    let effectiveCogs = totalSalesHpp;
    if (effectiveCogs <= 0) {
      // Find transactions categorized under COGS / Bahan Baku
      const cogsTx = filteredTx
        .filter(t => (t.jenisPengeluaran || '').toLowerCase().includes('bahan') || (t.jenisPengeluaran || '').toLowerCase().includes('cogs'))
        .reduce((sum, t) => sum + (Number(t.kredit || 0) + Number(t.kredit2 || 0)), 0);
      effectiveCogs = cogsTx > 0 ? cogsTx : Math.round(effectiveOmset * 0.35); // standard cafe 35% COGS default
    }
    if (omsetSliderAdjust !== 0 && baseOmset > 0) {
      effectiveCogs = Math.round(effectiveCogs * (1 + omsetSliderAdjust / 100));
    }

    // 5b. Breakdown of HPP per division (Minuman, Makanan, Snack)
    let hppMinuman = 0;
    let hppFood = 0;
    let hppSnack = 0;

    filteredSales.forEach(ds => {
      if (Array.isArray(ds.menuSales) && ds.menuSales.length > 0) {
        ds.menuSales.forEach(ms => {
          const kat = (ms.kategori || '').toLowerCase();
          const cost = ((Number(ms.terjual) || 0) + (Number(ms.jatah) || 0)) * (Number(ms.hpp) || 0);
          if (kat.includes('minum') || kat.includes('drink') || kat.includes('bar') || kat.includes('kopi')) {
            hppMinuman += cost;
          } else if (kat.includes('snack') || kat.includes('cemilan')) {
            hppSnack += cost;
          } else if (kat.includes('makan') || kat.includes('food')) {
            hppFood += cost;
          } else {
            hppMinuman += cost;
          }
        });
      }
    });

    const sumDiv = hppMinuman + hppFood + hppSnack;
    if (sumDiv > 0 && effectiveCogs > 0) {
      const scale = effectiveCogs / sumDiv;
      hppMinuman = Math.round(hppMinuman * scale);
      hppFood = Math.round(hppFood * scale);
      hppSnack = Math.round(hppSnack * scale);
    } else if (effectiveCogs > 0) {
      hppMinuman = Math.round(effectiveCogs * 0.65);
      hppSnack = Math.round(effectiveCogs * 0.20);
      hppFood = Math.round(effectiveCogs * 0.15);
    }

    // 5c. Breakdown of Fixed Costs (Sewa, Gaji, Utilitas, Operasional)
    const timeframeFactor = timeframeMode === 'harian' ? 1 / 30 : timeframeMode === 'tahunan' ? 12 : 1;
    let sewaTempat = 0;
    let gajiStaff = 0;
    let utilitas = 0;
    let operasionalLain = 0;

    fixedCosts.forEach(fc => {
      const cat = (fc.category || '').toLowerCase();
      const name = (fc.name || '').toLowerCase();
      const amt = (Number(fc.amount) || 0) * timeframeFactor;
      if (cat.includes('sewa') || name.includes('sewa') || name.includes('ruko')) {
        sewaTempat += amt;
      } else if (cat.includes('tenaga') || cat.includes('gaji') || name.includes('gaji') || name.includes('barista') || name.includes('staff')) {
        gajiStaff += amt;
      } else if (cat.includes('utilitas') || name.includes('listrik') || name.includes('air') || name.includes('wifi') || name.includes('internet')) {
        utilitas += amt;
      } else {
        operasionalLain += amt;
      }
    });

    // Fallback: Check cashflow for salary if not captured in fixed costs
    const salaryFromTx = filteredTx
      .filter(t => (t.jenisPengeluaran || '').toLowerCase().includes('gaji') || (t.keterangan || '').toLowerCase().includes('gaji'))
      .reduce((sum, t) => sum + (Number(t.kredit || 0) + Number(t.kredit2 || 0)), 0);
    if (gajiStaff === 0 && salaryFromTx > 0) {
      gajiStaff = salaryFromTx;
    }

    // Top Expenses from filteredTx
    const expCatMap: Record<string, number> = {};
    filteredTx.forEach(t => {
      const amt = (Number(t.kredit) || 0) + (Number(t.kredit2) || 0);
      if (amt > 0) {
        const cat = t.jenisPengeluaran || t.kategori || t.keterangan || 'Operasional';
        expCatMap[cat] = (expCatMap[cat] || 0) + amt;
      }
    });
    const topExpenses = Object.entries(expCatMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // 6. Profitability & Capability Output
    const grossProfit = effectiveOmset - effectiveCogs;
    const grossMarginPct = effectiveOmset > 0 ? (grossProfit / effectiveOmset) * 100 : 65;
    const cogsRatioPct = effectiveOmset > 0 ? (effectiveCogs / effectiveOmset) * 100 : 35;
    const operatingProfit = grossProfit - timeframeFixedCost;
    const netProfit = operatingProfit - timeframeDebtCost;
    const netMarginPct = effectiveOmset > 0 ? (netProfit / effectiveOmset) * 100 : 0;
    const fixedCostRatioPct = effectiveOmset > 0 ? (timeframeFixedCost / effectiveOmset) * 100 : 0;
    const debtRatioPct = effectiveOmset > 0 ? (timeframeDebtCost / effectiveOmset) * 100 : 0;

    // 7. BEP (Break-Even Point) Calculation
    const marginDecimal = grossMarginPct > 0 ? grossMarginPct / 100 : 0.65;
    const totalObligations = timeframeFixedCost + timeframeDebtCost;
    const bepRevenue = marginDecimal > 0 ? Math.round(totalObligations / marginDecimal) : 0;
    const bepProgressPct = bepRevenue > 0 ? Math.min(250, Math.round((effectiveOmset / bepRevenue) * 100)) : 0;

    // 8. Financial Health Category
    let status: 'PRIMA' | 'SEHAT' | 'WASPADA' | 'DEFISIT' = 'SEHAT';
    let statusBadgeColor = 'emerald';
    let statusDescription = 'Operasional stabil & mampu menutup seluruh kewajiban.';

    if (netProfit > 0 && bepProgressPct >= 120 && fixedCostRatioPct <= 35) {
      status = 'PRIMA';
      statusBadgeColor = 'indigo';
      statusDescription = 'Kemampuan prima! Omset melampaui BEP dengan laba & arus kas lapang.';
    } else if (netProfit >= 0) {
      status = 'SEHAT';
      statusBadgeColor = 'emerald';
      statusDescription = 'Kondisi sehat & berkelanjutan, biaya tetap dan cicilan tertutup rapi.';
    } else if (netProfit < 0 && netProfit >= -timeframeFixedCost * 0.3) {
      status = 'WASPADA';
      statusBadgeColor = 'amber';
      statusDescription = 'Waspada! Margin tipis atau omset belum optimal menutup biaya tetap.';
    } else {
      status = 'DEFISIT';
      statusBadgeColor = 'rose';
      statusDescription = 'Defisit finansial! Pengeluaran melebihi pemasukan, butuh efisiensi segera.';
    }

    return {
      timeframeMode,
      periodLabel: currentPeriodLabel,
      cashInflow,
      cashOutflow,
      netCashflow,
      baseOmset,
      effectiveOmset,
      totalSalesCups,
      effectiveCogs,
      hppMinuman,
      hppFood,
      hppSnack,
      sewaTempat,
      gajiStaff,
      utilitas,
      operasionalLain,
      topExpenses,
      grossProfit,
      grossMarginPct,
      cogsRatioPct,
      timeframeFixedCost,
      timeframeDebtCost,
      operatingProfit,
      netProfit,
      netMarginPct,
      fixedCostRatioPct,
      debtRatioPct,
      bepRevenue,
      bepProgressPct,
      status,
      statusBadgeColor,
      statusDescription,
      hasLiveSales: totalSalesOmset > 0,
      hasLiveCashflow: filteredTx.length > 0,
      txCount: filteredTx.length
    };
  }, [
    transactions,
    dailySales,
    timeframeMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    totalMonthlyFixedCost,
    debtMetrics,
    omsetSliderAdjust,
    currentPeriodLabel
  ]);

  // Handler: Add Item to Fixed Costs
  const handleAddFixedCostItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemAmount || parseFloat(newItemAmount) <= 0) return;

    const newItem: FixedCostItem = {
      id: `fc-${Date.now()}`,
      name: newItemName.trim(),
      category: newItemCategory,
      amount: parseFloat(newItemAmount)
    };

    setFixedCosts(prev => [...prev, newItem]);
    setNewItemName('');
    setNewItemAmount('');
    logAppActivity({
      role: userRole,
      actionType: 'create',
      module: 'Kinerja Global & Fixed Cost',
      description: `Menambahkan pos biaya tetap baru: "${newItem.name}" (${formatRupiah(newItem.amount)}/bln)`
    });
  };

  const handleDeleteFixedCostItem = (id: string, name: string) => {
    setFixedCosts(prev => prev.filter(item => item.id !== id));
    logAppActivity({
      role: userRole,
      actionType: 'delete',
      module: 'Kinerja Global & Fixed Cost',
      description: `Menghapus pos biaya tetap: "${name}"`
    });
  };

  // Handler: Request AI Financial Capability Analysis
  const handleRequestAiAnalysis = async () => {
    setIsLoadingAi(true);
    setAiEngineUsed('');
    try {
      const payload = {
        timeframeMode,
        periodLabel: currentPeriodLabel,
        fixedCosts,
        totalFixedCost: liveMetrics.timeframeFixedCost,
        provider: aiProvider,
        metrics: {
          omsetPenjualan: liveMetrics.effectiveOmset,
          cashInflow: liveMetrics.cashInflow,
          cashOutflow: liveMetrics.cashOutflow,
          netCashflow: liveMetrics.netCashflow,
          totalFixedCost: liveMetrics.timeframeFixedCost,
          totalDebtInstallment: liveMetrics.timeframeDebtCost,
          totalCogs: liveMetrics.effectiveCogs,
          netProfit: liveMetrics.netProfit,
          netMarginPct: liveMetrics.netMarginPct,
          fixedCostRatioPct: liveMetrics.fixedCostRatioPct,
          bepRevenue: liveMetrics.bepRevenue,
          bepProgressPct: liveMetrics.bepProgressPct,
          status: liveMetrics.status
        },
        salesData: {
          totalOmset: liveMetrics.effectiveOmset,
          cups: liveMetrics.totalSalesCups
        },
        cashflowData: {
          inflow: liveMetrics.cashInflow,
          outflow: liveMetrics.cashOutflow,
          netCashflow: liveMetrics.netCashflow,
          txCount: liveMetrics.txCount
        },
        debtData: {
          activeCount: debtMetrics.count,
          totalRemaining: debtMetrics.totalRemaining,
          totalInstallment: liveMetrics.timeframeDebtCost
        },
        cogsData: {
          totalCogs: liveMetrics.effectiveCogs,
          grossMarginPct: liveMetrics.grossMarginPct
        }
      };

      const res = await fetch('/api/gemini/fixed-cost-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Gagal menghubungi engine AI.');
      }

      const data = await res.json();
      const analysisText = data.analysis || 'Analisis kinerja kafe siap.';
      setAiAnalysis(analysisText);
      setAiEngineUsed(data.engine || (aiProvider === 'claude' ? 'Claude 3.7 Sonnet' : 'Gemini 2.5 Flash'));
      localStorage.setItem('aruskas_global_performance_ai', analysisText);

      logAppActivity({
        role: userRole,
        actionType: 'create',
        module: 'Kinerja Global & Fixed Cost',
        description: `Menjalankan analisis AI evaluasi kemampuan kafe (${timeframeMode} - ${currentPeriodLabel})`
      });
    } catch (err: any) {
      console.error(err);
      setAiAnalysis(`Maaf, terjadi kendala saat menghubungkan ke AI. Silakan coba kembali.`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Handler: Send Chat Question inside AI Panel
  const handleSendPanelChat = async (overridePrompt?: string) => {
    const text = (overridePrompt || chatInput).trim();
    if (!text || isSendingChat) return;

    const userMsg = {
      role: 'user' as const,
      content: text,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    const next = [...chatMessages, userMsg];
    setChatMessages(next);
    setChatInput('');
    setIsSendingChat(true);

    const statsPayload = {
      totalDebit: liveMetrics.effectiveOmset,
      totalKredit: liveMetrics.effectiveCogs + liveMetrics.timeframeFixedCost + liveMetrics.timeframeDebtCost,
      saldo: liveMetrics.netProfit,
      cashInflow: liveMetrics.cashInflow,
      cashOutflow: liveMetrics.cashOutflow,
      netCashflow: liveMetrics.netCashflow,
      transactionCount: liveMetrics.txCount
    };

    const cafeMetricsPayload = {
      totalSales: liveMetrics.effectiveOmset,
      totalHpp: liveMetrics.effectiveCogs,
      hppPercentage: liveMetrics.cogsRatioPct,
      hppMinuman: liveMetrics.hppMinuman,
      hppFood: liveMetrics.hppFood,
      hppSnack: liveMetrics.hppSnack,
      totalSalary: liveMetrics.gajiStaff,
      salaryPercentage: liveMetrics.effectiveOmset > 0 ? (liveMetrics.gajiStaff / liveMetrics.effectiveOmset) * 100 : 0,
      totalRent: liveMetrics.sewaTempat,
      rentPercentage: liveMetrics.effectiveOmset > 0 ? (liveMetrics.sewaTempat / liveMetrics.effectiveOmset) * 100 : 0,
      totalUtility: liveMetrics.utilitas,
      utilityPercentage: liveMetrics.effectiveOmset > 0 ? (liveMetrics.utilitas / liveMetrics.effectiveOmset) * 100 : 0,
      totalFixedCost: liveMetrics.timeframeFixedCost,
      fixedCostPercentage: liveMetrics.fixedCostRatioPct,
      totalDebt: liveMetrics.timeframeDebtCost,
      debtPercentage: liveMetrics.debtRatioPct,
      netProfit: liveMetrics.netProfit,
      netProfitPercentage: liveMetrics.netMarginPct,
      bepRevenue: liveMetrics.bepRevenue,
      bepProgressPct: liveMetrics.bepProgressPct,
      status: liveMetrics.status,
      cups: liveMetrics.totalSalesCups
    };

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          question: text,
          messages: next,
          periodName: currentPeriodLabel,
          stats: statsPayload,
          cafeMetrics: cafeMetricsPayload,
          topExpenses: liveMetrics.topExpenses,
          context: {
            mode: timeframeMode,
            period: currentPeriodLabel,
            omset: liveMetrics.effectiveOmset,
            totalDebit: liveMetrics.effectiveOmset,
            totalCOGS: liveMetrics.effectiveCogs,
            cogs: liveMetrics.effectiveCogs,
            cogsRatio: liveMetrics.cogsRatioPct,
            totalCOGSDrink: liveMetrics.hppMinuman,
            totalCOGSFood: liveMetrics.hppFood,
            totalCOGSSnack: liveMetrics.hppSnack,
            fixedCost: liveMetrics.timeframeFixedCost,
            totalFixedCost: liveMetrics.timeframeFixedCost,
            debtCost: liveMetrics.timeframeDebtCost,
            totalDebt: liveMetrics.timeframeDebtCost,
            totalSalary: liveMetrics.gajiStaff,
            totalRent: liveMetrics.sewaTempat,
            totalUtility: liveMetrics.utilitas,
            wagesRatio: liveMetrics.effectiveOmset > 0 ? (liveMetrics.gajiStaff / liveMetrics.effectiveOmset) * 100 : 0,
            netProfit: liveMetrics.netProfit,
            netProfitMargin: liveMetrics.netMarginPct,
            bepRevenue: liveMetrics.bepRevenue,
            bepProgressPct: liveMetrics.bepProgressPct,
            status: liveMetrics.status
          }
        })
      });

      if (!res.ok) throw new Error('Chat API error');
      const data = await res.json();
      const reply = data.reply || data.answer || 'Siap menganalisis kondisi keuangan kafe.';
      setChatMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: reply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch {
      const offlineReply = generateSmartCashflowChatReply({
        provider: aiProvider,
        question: text,
        stats: statsPayload,
        cafeMetrics: cafeMetricsPayload,
        periodName: currentPeriodLabel,
        topExpenses: liveMetrics.topExpenses
      });
      setChatMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: offlineReply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Handler: Save Snapshot to Google Sheets
  const handleSaveToSpreadsheet = async () => {
    setIsSavingToSheet(true);
    setSaveMessage(null);

    const snapshot: GlobalPerformanceSnapshot = {
      id: `snap-${timeframeMode}-${Date.now()}`,
      timestamp: new Date().toLocaleString('id-ID'),
      timeframeMode,
      periodLabel: currentPeriodLabel,
      omsetPenjualan: liveMetrics.effectiveOmset,
      cashInflow: liveMetrics.cashInflow,
      cashOutflow: liveMetrics.cashOutflow,
      netCashflow: liveMetrics.netCashflow,
      totalFixedCost: liveMetrics.timeframeFixedCost,
      totalDebtInstallment: liveMetrics.timeframeDebtCost,
      totalCogs: liveMetrics.effectiveCogs,
      operatingProfit: liveMetrics.operatingProfit,
      netProfit: liveMetrics.netProfit,
      netMarginPct: liveMetrics.netMarginPct,
      fixedCostRatioPct: liveMetrics.fixedCostRatioPct,
      status: liveMetrics.status,
      aiSummary: aiAnalysis ? aiAnalysis.slice(0, 450) : `${liveMetrics.status}: Laba Bersih ${formatRupiah(liveMetrics.netProfit)} (BEP ${liveMetrics.bepProgressPct}%)`
    };

    // Save to MySQL in parallel
    saveGlobalEvaluationToMySql(snapshot);

    try {
      const result = await saveGlobalPerformanceToSheet(spreadsheetId, snapshot, token);
      if (result.success) {
        const isAuthWarning = result.message.includes('401') || result.message.includes('Google OAuth') || result.message.includes('login akun Google');
        setSaveMessage({
          type: isAuthWarning ? 'warning' : 'success',
          text: result.message,
          needsAuth: isAuthWarning
        });
        setSavedSnapshots(prev => [snapshot, ...prev.filter(s => s.id !== snapshot.id)].slice(0, 60));
        logAppActivity({
          role: userRole,
          actionType: 'sync',
          module: 'Kinerja Global & Fixed Cost',
          description: `Menyimpan evaluasi kinerja kafe (${timeframeMode} - ${currentPeriodLabel}) ke Google Sheets tab 'Evaluasi Kinerja Global'`
        });
      } else {
        const isAuthErr = result.message.includes('401') || result.message.includes('UNAUTHENTICATED') || result.message.includes('invalid authentication credentials');
        setSaveMessage({
          type: isAuthErr ? 'warning' : 'error',
          text: isAuthErr
            ? 'Sesi login Google OAuth kedaluwarsa atau belum terhubung (401). Silakan klik tombol "Login Akun Google" untuk memperbarui sinkronisasi spreadsheet.'
            : result.message,
          needsAuth: isAuthErr
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Gagal menyimpan snapshot.';
      const isAuthErr = errMsg.includes('401') || errMsg.includes('UNAUTHENTICATED') || errMsg.includes('invalid authentication credentials');
      setSaveMessage({
        type: isAuthErr ? 'warning' : 'error',
        text: isAuthErr
          ? 'Sesi login Google OAuth kedaluwarsa atau belum terhubung (401). Silakan klik tombol "Login Akun Google" untuk memperbarui sinkronisasi spreadsheet.'
          : errMsg,
        needsAuth: isAuthErr
      });
    } finally {
      setIsSavingToSheet(false);
    }
  };

  // Copy AI output
  const handleCopyAi = () => {
    if (!aiAnalysis) return;
    navigator.clipboard.writeText(aiAnalysis);
    setIsCopiedAi(true);
    setTimeout(() => setIsCopiedAi(false), 2000);
  };

  // Export saved snapshots as CSV
  const handleExportHistoryCSV = () => {
    if (savedSnapshots.length === 0) return;
    const headers = [
      'ID',
      'Waktu Simpan',
      'Mode',
      'Periode',
      'Omset Penjualan (Rp)',
      'Arus Kas Masuk (Rp)',
      'Arus Kas Keluar (Rp)',
      'Net Cashflow (Rp)',
      'Biaya Tetap (Rp)',
      'Cicilan Hutang (Rp)',
      'Estimasi COGS (Rp)',
      'Laba Bersih (Rp)',
      'Margin Bersih (%)',
      'Rasio Beban Tetap (%)',
      'Status'
    ];
    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = savedSnapshots.map(s => [
      escapeCsv(s.id),
      escapeCsv(s.timestamp),
      escapeCsv(s.timeframeMode.toUpperCase()),
      escapeCsv(s.periodLabel),
      escapeCsv(s.omsetPenjualan),
      escapeCsv(s.cashInflow),
      escapeCsv(s.cashOutflow),
      escapeCsv(s.netCashflow),
      escapeCsv(s.totalFixedCost),
      escapeCsv(s.totalDebtInstallment),
      escapeCsv(s.totalCogs),
      escapeCsv(s.netProfit),
      escapeCsv(s.netMarginPct.toFixed(1) + '%'),
      escapeCsv(s.fixedCostRatioPct.toFixed(1) + '%'),
      escapeCsv(s.status)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evaluasi_kinerja_global_${todayStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse simple markdown formatting for AI response
  const renderFormattedAiText = (txt: string) => {
    if (!txt) return null;
    const lines = txt.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return (
          <h4 key={idx} className="text-sm font-black text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            {trimmed.replace(/^###\s*/, '')}
          </h4>
        );
      }
      if (trimmed.startsWith('####')) {
        return (
          <h5 key={idx} className="text-xs font-black text-slate-800 mt-2.5 mb-1 text-indigo-950 uppercase tracking-wide">
            {trimmed.replace(/^####\s*/, '')}
          </h5>
        );
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const cleanContent = trimmed.replace(/^[-*]\s*/, '');
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-slate-700 leading-relaxed font-medium mb-1">
            {parseInlineBold(cleanContent)}
          </li>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal text-xs text-slate-700 leading-relaxed font-medium mb-1">
            {parseInlineBold(numMatch[2])}
          </li>
        );
      }
      if (!trimmed) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-xs text-slate-700 leading-relaxed mb-1 font-medium">
          {parseInlineBold(trimmed)}
        </p>
      );
    });
  };

  const parseInlineBold = (txt: string) => {
    const parts = txt.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header Banner & Control Center */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-gradient-to-br from-slate-900 to-indigo-950 text-emerald-400 rounded-2xl shadow-xs shrink-0">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Evaluasi Kemampuan & Kinerja Global Kafe
                </h1>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Realtime Financial Audit</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Kalkulasi komprehensif harian, bulanan & tahunan (Penjualan, Cashflow, Biaya Tetap, Hutang & COGS) berbasis Analisis AI & Google Sheets.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={refreshLiveSources}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition border border-slate-200"
              title="Perbarui data realtime dari buku kas, sales & hutang"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Data</span>
            </button>

            <button
              onClick={handleSaveToSpreadsheet}
              disabled={isSavingToSheet}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition shadow-sm disabled:opacity-50"
            >
              {isSavingToSheet ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Menyimpan ke Sheets...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Simpan ke Google Sheets</span>
                </>
              )}
            </button>

            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200"
              >
                <span>Buka Sheets</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Save feedback banner */}
        {saveMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-bold flex flex-wrap items-center justify-between gap-2 ${
              saveMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : saveMessage.type === 'warning'
                ? 'bg-amber-50 text-amber-950 border border-amber-300'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              {saveMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : saveMessage.type === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span className="leading-relaxed">{saveMessage.text}</span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {saveMessage.needsAuth && onLoginGoogle && (
                <button
                  type="button"
                  onClick={onLoginGoogle}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black shadow-xs transition"
                >
                  Login Akun Google
                </button>
              )}
              <button
                onClick={() => setSaveMessage(null)}
                className="text-slate-400 hover:text-slate-600 font-black text-sm px-1.5"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Timeframe Selector & Date Pickers Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Mode Switcher: Harian, Bulanan, Tahunan */}
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setTimeframeMode('harian')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                timeframeMode === 'harian'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Evaluasi Harian
            </button>
            <button
              type="button"
              onClick={() => setTimeframeMode('bulanan')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                timeframeMode === 'bulanan'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📆 Evaluasi Bulanan
            </button>
            <button
              type="button"
              onClick={() => setTimeframeMode('tahunan')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                timeframeMode === 'tahunan'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Evaluasi Tahunan
            </button>
          </div>

          {/* Dynamic Period Control */}
          <div className="flex flex-wrap items-center gap-2.5">
            {timeframeMode === 'harian' && (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span className="text-[10px] font-black uppercase text-slate-400">Pilih Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-mono font-black text-slate-900 focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline ml-1"
                >
                  Hari Ini
                </button>
              </div>
            )}

            {timeframeMode === 'bulanan' && (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span className="text-[10px] font-black uppercase text-slate-400">Pilih Bulan:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-mono font-black text-slate-900 focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setSelectedMonth(currentMonthStr)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline ml-1"
                >
                  Bulan Ini
                </button>
              </div>
            )}

            {timeframeMode === 'tahunan' && (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span className="text-[10px] font-black uppercase text-slate-400">Pilih Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="bg-transparent text-xs font-mono font-black text-slate-900 focus:outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028].map(y => (
                    <option key={y} value={String(y)}>
                      Tahun {y}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedYear(currentYearStr)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline ml-1"
                >
                  Tahun Ini
                </button>
              </div>
            )}

            <div className="px-3 py-1 rounded-xl bg-slate-900 text-amber-400 text-xs font-mono font-black">
              {liveMetrics.periodLabel}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Ringkasan 6 Kartu Metrik Kemampuan Kafe (Scorecards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Penjualan / Omset */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                1. Penjualan & Omset
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black font-mono text-slate-900">
              {formatRupiah(liveMetrics.effectiveOmset)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>
              {liveMetrics.totalSalesCups > 0 ? `${liveMetrics.totalSalesCups} Porsi Menu` : `${liveMetrics.txCount} Transaksi Masuk`}
            </span>
            <span className="text-emerald-700 font-bold">
              {liveMetrics.hasLiveSales ? 'Sumber: Sales & Menu' : 'Sumber: Cashflow Masuk'}
            </span>
          </div>
        </div>

        {/* Card 2: Arus Kas Riil (Cashflow) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                2. Arus Kas Riil (Cashflow)
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`mt-2 text-xl sm:text-2xl font-black font-mono ${
                liveMetrics.netCashflow >= 0 ? 'text-blue-900' : 'text-rose-600'
              }`}
            >
              {formatRupiah(liveMetrics.netCashflow)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Inflow: {formatRupiah(liveMetrics.cashInflow)}</span>
            <span>Outflow: {formatRupiah(liveMetrics.cashOutflow)}</span>
          </div>
        </div>

        {/* Card 3: Beban Biaya Tetap (Fixed Cost) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                3. Beban Biaya Tetap (Fixed Cost)
              </span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Calculator className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black font-mono text-amber-950">
              {formatRupiah(liveMetrics.timeframeFixedCost)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Rasio: {liveMetrics.fixedCostRatioPct.toFixed(1)}% dari Omset</span>
            <button
              type="button"
              onClick={() => setShowManageFixedCost(prev => !prev)}
              className="text-indigo-600 hover:text-indigo-800 font-bold underline text-[11px]"
            >
              {showManageFixedCost ? 'Tutup Rincian' : 'Kelola Pos Biaya'}
            </button>
          </div>
        </div>

        {/* Card 4: Beban Hutang & Liabilitas */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                4. Beban Angsuran Hutang
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black font-mono text-rose-950">
              {formatRupiah(liveMetrics.timeframeDebtCost)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>{debtMetrics.count} Hutang Aktif</span>
            <span>Sisa Pokok: {formatRupiah(debtMetrics.totalRemaining)}</span>
          </div>
        </div>

        {/* Card 5: Estimasi COGS & Bahan Baku */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                5. Estimasi COGS (Bahan Baku)
              </span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <Utensils className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black font-mono text-purple-950">
              {formatRupiah(liveMetrics.effectiveCogs)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Gross Margin: {liveMetrics.grossMarginPct.toFixed(1)}%</span>
            <span>Food Cost: {(100 - liveMetrics.grossMarginPct).toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 6: Laba Bersih & Status Kemampuan */}
        <div
          className={`rounded-2xl border p-4 flex flex-col justify-between shadow-xs ${
            liveMetrics.netProfit >= 0
              ? 'bg-gradient-to-br from-emerald-50/60 to-white border-emerald-200'
              : 'bg-gradient-to-br from-rose-50/60 to-white border-rose-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                6. Laba Bersih Akhir (Kemampuan)
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  liveMetrics.status === 'PRIMA'
                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                    : liveMetrics.status === 'SEHAT'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : liveMetrics.status === 'WASPADA'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                {liveMetrics.status}
              </span>
            </div>
            <div
              className={`mt-2 text-xl sm:text-2xl font-black font-mono ${
                liveMetrics.netProfit >= 0 ? 'text-emerald-900' : 'text-rose-700'
              }`}
            >
              {formatRupiah(liveMetrics.netProfit)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Net Margin: {liveMetrics.netMarginPct.toFixed(1)}%</span>
            <span>BEP Tercapai: {liveMetrics.bepProgressPct}%</span>
          </div>
        </div>
      </div>

      {/* 3. Panel Manajemen Komponen Biaya Tetap (Collapsible) */}
      {showManageFixedCost && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Kelola Daftar Komponen Biaya Tetap (Fixed Cost)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Atur biaya tetap bulanan kafe (Sewa, gaji barista & staff, internet, listrik/air). Data akan dihitung otomatis sesuai mode harian/bulanan/tahunan.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-900 text-xs font-black">
              Total Bulanan: {formatRupiah(totalMonthlyFixedCost)}
            </span>
          </div>

          {/* Form Add New Item */}
          <form onSubmit={handleAddFixedCostItem} className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nama Biaya Tetap</label>
              <input
                type="text"
                placeholder="e.g. Sewa Ruko, Gaji Pokok Barista, Internet..."
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Kategori</label>
              <select
                value={newItemCategory}
                onChange={e => setNewItemCategory(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="Sewa Tempat">Sewa Tempat</option>
                <option value="Tenaga Kerja">Tenaga Kerja</option>
                <option value="Utilitas">Utilitas (Air/Listrik/Wifi)</option>
                <option value="Administrasi">Administrasi / Keamanan</option>
                <option value="Pemeliharaan">Pemeliharaan & Inventaris</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nominal per Bulan (Rp)</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Jumlah Rp"
                  value={newItemAmount}
                  onChange={e => setNewItemAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs shrink-0"
                >
                  + Tambah
                </button>
              </div>
            </div>
          </form>

          {/* Table of Fixed Costs */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-4">Nama Pos Pengeluaran</th>
                  <th className="py-2.5 px-4">Kategori Golongan</th>
                  <th className="py-2.5 px-4 text-right">Biaya Bulanan</th>
                  <th className="py-2.5 px-4 text-right">Prorata Harian (/30)</th>
                  <th className="py-2.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                {fixedCosts.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(item.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                      {formatRupiah(Math.round(item.amount / 30))}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteFixedCostItem(item.id, item.name)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                        title="Hapus pos biaya"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Analisis BEP & Stress-Test Simulation (Full Width Card) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Percent className="h-4 w-4 text-indigo-600" />
            <span>Titik Impas (BEP) & Stress-Test Kemampuan Kafe</span>
          </h3>
          <span className="text-xs font-bold text-slate-500">
            Target BEP: <strong className="text-slate-900">{formatRupiah(liveMetrics.bepRevenue)}</strong>
          </span>
        </div>

        {/* Progress Bar BEP */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-600">Pencapaian Target BEP Periode Ini:</span>
            <span
              className={`font-mono font-black ${
                liveMetrics.bepProgressPct >= 100 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {liveMetrics.bepProgressPct}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                liveMetrics.bepProgressPct >= 100
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${Math.min(100, liveMetrics.bepProgressPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
            {liveMetrics.effectiveOmset >= liveMetrics.bepRevenue ? (
              <span className="text-emerald-700 font-bold">
                ✓ Omset sudah melampaui titik impas sebesar {formatRupiah(liveMetrics.effectiveOmset - liveMetrics.bepRevenue)}!
              </span>
            ) : (
              <span className="text-amber-800 font-bold">
                ⚠️ Butuh tambahan omset {formatRupiah(liveMetrics.bepRevenue - liveMetrics.effectiveOmset)} lagi untuk mencapai titik impas sempurna.
              </span>
            )}
          </p>
        </div>

        {/* Stress-Test Simulation Slider */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-slate-900 uppercase">Simulasi Skenario Omset</span>
              <p className="text-[10px] text-slate-500 font-medium">
                Uji daya tahan kafe jika penjualan mengalami kenaikan atau penurunan mendadak.
              </p>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono font-bold text-xs">
              {omsetSliderAdjust >= 0 ? `+${omsetSliderAdjust}%` : `${omsetSliderAdjust}%`}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-bold text-rose-600">-30%</span>
            <input
              type="range"
              min="-30"
              max="30"
              step="5"
              value={omsetSliderAdjust}
              onChange={e => setOmsetSliderAdjust(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-[10px] font-bold text-emerald-600">+30%</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setOmsetSliderAdjust(-20)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              Skenario Drop -20%
            </button>
            <button
              type="button"
              onClick={() => setOmsetSliderAdjust(0)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              Reset Normal (0%)
            </button>
            <button
              type="button"
              onClick={() => setOmsetSliderAdjust(20)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              Skenario Naik +20%
            </button>
          </div>
        </div>
      </div>

      {/* 5. Riwayat Evaluasi Tersimpan (Saved Snapshots Table) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Riwayat Simpanan Evaluasi Kinerja Kafe</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Daftar evaluasi yang telah disimpan ke Google Sheets tab <strong>'Evaluasi Kinerja Global'</strong> & Cloud storage.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {savedSnapshots.length > 0 && (
              <button
                type="button"
                onClick={handleExportHistoryCSV}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh CSV</span>
              </button>
            )}
          </div>
        </div>

        {savedSnapshots.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400">
            Belum ada snapshot evaluasi yang tersimpan. Klik <strong>"Simpan ke Google Sheets"</strong> di bagian atas untuk menyimpan evaluasi periode ini.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                  <th className="py-2.5 px-3">Waktu Simpan</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Periode</th>
                  <th className="py-2.5 px-3 text-right">Omset (Rp)</th>
                  <th className="py-2.5 px-3 text-right">Net Cashflow</th>
                  <th className="py-2.5 px-3 text-right">Fixed Cost</th>
                  <th className="py-2.5 px-3 text-right">Cicilan Hutang</th>
                  <th className="py-2.5 px-3 text-right">Laba Bersih</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {savedSnapshots.slice(0, 15).map(snap => (
                  <tr key={snap.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{snap.timestamp}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-slate-100 text-slate-700">
                        {snap.timeframeMode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{snap.periodLabel}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(snap.omsetPenjualan)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        snap.netCashflow >= 0 ? 'text-blue-900' : 'text-rose-600'
                      }`}
                    >
                      {formatRupiah(snap.netCashflow)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {formatRupiah(snap.totalFixedCost)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {formatRupiah(snap.totalDebtInstallment)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        snap.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'
                      }`}
                    >
                      {formatRupiah(snap.netProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          snap.status === 'PRIMA'
                            ? 'bg-indigo-100 text-indigo-900'
                            : snap.status === 'SEHAT'
                            ? 'bg-emerald-100 text-emerald-900'
                            : snap.status === 'WASPADA'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        {snap.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. AI FINANCIAL ADVISOR - Di Halaman Paling Bawah (Full Width & Nyaman Dibaca) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white rounded-2xl shadow-sm">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
                  AI Financial Advisor
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase">
                  Analisis Mendalam 360° & Chat Realtime
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Konsultasi strategi titik impas (BEP), audit rasio beban tetap, mitigasi hutang & proyeksi profitabilitas kafe.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Provider selector */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setAiProvider('claude')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  aiProvider === 'claude' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Claude
              </button>
              <button
                type="button"
                onClick={() => setAiProvider('gemini')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  aiProvider === 'gemini' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Gemini
              </button>
            </div>

            <button
              type="button"
              onClick={handleRequestAiAnalysis}
              disabled={isLoadingAi}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>{isLoadingAi ? 'Menganalisis...' : 'Minta Analisis AI'}</span>
            </button>
          </div>
        </div>

        {/* Sub-Tab Navigation inside AI Panel: Laporan vs Chat */}
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
          <button
            type="button"
            onClick={() => setAiSubTab('analysis')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              aiSubTab === 'analysis'
                ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 bg-slate-50'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Laporan Analisis Mendalam</span>
          </button>
          <button
            type="button"
            onClick={() => setAiSubTab('chat')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              aiSubTab === 'chat'
                ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 bg-slate-50'
            }`}
          >
            <MessageSquare className="h-4 w-4 text-indigo-600" />
            <span>Diskusi & Chat Interaktif AI</span>
          </button>
        </div>

        {/* TAB CONTENT 1: LAPORAN ANALISIS (LUAS, NYAMAN DIBACA) */}
        {aiSubTab === 'analysis' ? (
          <div className="space-y-4">
            {isLoadingAi ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
                <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
                <span className="text-sm font-bold text-slate-600">
                  AI sedang mengalkulasi data omset, cashflow, fixed cost & hutang kafe...
                </span>
                <p className="text-xs text-slate-400">Menyusun skor kesehatan finansial dan 3-tier action plan</p>
              </div>
            ) : aiAnalysis ? (
              <div className="bg-slate-50/70 p-6 sm:p-7 rounded-2xl border border-slate-200/80 text-xs sm:text-sm max-h-[750px] overflow-y-auto leading-relaxed shadow-inner">
                {renderFormattedAiText(aiAnalysis)}
              </div>
            ) : (
              <div className="py-14 text-center px-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Sparkles className="h-10 w-10 text-indigo-400 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-bold text-slate-700">Belum ada analisis mendalam untuk periode ini.</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Klik tombol <strong>"Minta Analisis AI"</strong> di atas atau di bawah untuk melakukan audit komprehensif performa kafe secara otomatis.
                </p>
                <button
                  type="button"
                  onClick={handleRequestAiAnalysis}
                  className="mt-4 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition active:scale-95"
                >
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Minta Analisis AI Sekarang</span>
                </button>
              </div>
            )}

            {/* Action buttons bottom (only on analysis sub-tab) */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              {aiAnalysis ? (
                <button
                  type="button"
                  onClick={handleCopyAi}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                >
                  {isCopiedAi ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
                  <span>{isCopiedAi ? 'Tersalin ke Clipboard' : 'Salin Laporan Lengkap'}</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleRequestAiAnalysis}
                disabled={isLoadingAi}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>{isLoadingAi ? 'Menganalisis...' : 'Refresh Analisis AI'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* TAB CONTENT 2: CHAT & TANYA JAWAB AI (LEGA & INTERAKTIF) */
          <div className="flex flex-col h-[520px] bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4">
            {/* Chat message stream */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start space-x-2.5 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'model' && (
                    <div className="p-1.5 bg-indigo-950 text-emerald-400 rounded-xl shrink-0 mt-0.5 shadow-xs">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                        : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/80 shadow-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span
                      className={`text-[10px] block text-right mt-1.5 ${
                        msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {isSendingChat && (
                <div className="flex items-center space-x-2 text-slate-500 text-xs italic py-2 px-3 bg-white/80 rounded-xl border border-slate-200/60 w-fit">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  <span>AI sedang berpikir & menyusun rekomendasi finansial...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts Chips */}
            <div className="pt-3 pb-2 flex items-center space-x-2 overflow-x-auto text-[11px] font-bold border-t border-slate-200/80 bg-white -mx-4 -mb-4 px-4 rounded-b-2xl">
              <span className="text-[10px] text-slate-400 uppercase font-black shrink-0">Tanya Cepat:</span>
              <button
                type="button"
                onClick={() => handleSendPanelChat('Bagaimana cara menurunkan titik impas (BEP) kafe?')}
                className="whitespace-nowrap px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition"
              >
                Turunkan BEP?
              </button>
              <button
                type="button"
                onClick={() => handleSendPanelChat('Apakah beban cicilan hutang saat ini aman?')}
                className="whitespace-nowrap px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Keamanan Hutang?
              </button>
              <button
                type="button"
                onClick={() => handleSendPanelChat('Strategi menaikkan omset harian tanpa menambah biaya')}
                className="whitespace-nowrap px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Dongkrak Omset?
              </button>
              <button
                type="button"
                onClick={() => handleSendPanelChat('Bagaimana cara menekan food cost & pemborosan bahan baku?')}
                className="whitespace-nowrap px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Tekan Food Cost?
              </button>
            </div>

            {/* Chat Input form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendPanelChat();
              }}
              className="pt-3 border-t border-slate-200 flex items-center space-x-2"
            >
              <input
                type="text"
                placeholder="Tanyakan analisis keuangan, strategi margin, cicilan hutang kafe..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isSendingChat}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl disabled:opacity-50 transition shadow-xs shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
