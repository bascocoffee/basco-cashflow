import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  SlidersHorizontal, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Save, 
  Search, 
  HelpCircle,
  TrendingUp,
  Layers,
  Percent,
  DollarSign,
  Plus
} from 'lucide-react';
import { Transaction, CafeRatioGroup, CafeRatioCategoryConfig } from '../types';
import { formatRupiah } from '../utils';
import { 
  CAFE_RATIO_GROUP_INFO, 
  extractUniqueCategories, 
  generateAutoCategoryMapping, 
  computeCafeMetricsWithConfig,
  DEFAULT_CAFE_RATIO_CONFIG,
  detectCategoryGroup
} from '../utils/cafeKpiUtils';

interface CafeRatioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CafeRatioCategoryConfig;
  onSaveConfig: (newConfig: CafeRatioCategoryConfig) => void;
  transactions: Transaction[];
  filteredTransactions?: Transaction[];
  masterCategories?: string[];
  initialTab?: 'all_table' | 'sales' | 'cogs' | 'wages' | 'operasional' | 'promo';
}

export default function CafeRatioSettingsModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  transactions,
  filteredTransactions,
  masterCategories = [],
  initialTab = 'all_table'
}: CafeRatioSettingsModalProps) {
  // Local working copy of configuration for drafting before saving
  const [draftConfig, setDraftConfig] = useState<CafeRatioCategoryConfig>(() => {
    return JSON.parse(JSON.stringify(config || DEFAULT_CAFE_RATIO_CONFIG));
  });

  const [activeTab, setActiveTab] = useState<'all_table' | 'sales' | 'cogs' | 'wages' | 'operasional' | 'promo'>(initialTab);
  const [searchFilter, setSearchFilter] = useState('');
  const [customCatInput, setCustomCatInput] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Extract all categories dynamically from active filtered transactions (with fallback to all transactions so all categories remain configurable)
  const { incomeCategories, expenseCategories } = useMemo(() => {
    const activeTx = (filteredTransactions && filteredTransactions.length > 0) ? filteredTransactions : transactions;
    const filteredExtracted = extractUniqueCategories(activeTx, masterCategories);
    if (activeTx === transactions) return filteredExtracted;

    const allExtracted = extractUniqueCategories(transactions, masterCategories);
    const incMap = new Map(filteredExtracted.incomeCategories.map(c => [c.name, c]));
    allExtracted.incomeCategories.forEach(c => {
      if (!incMap.has(c.name)) {
        incMap.set(c.name, { ...c, totalAmount: 0, count: 0 });
      }
    });

    const expMap = new Map(filteredExtracted.expenseCategories.map(c => [c.name, c]));
    allExtracted.expenseCategories.forEach(c => {
      if (!expMap.has(c.name)) {
        expMap.set(c.name, { ...c, totalAmount: 0, count: 0 });
      }
    });

    return {
      incomeCategories: Array.from(incMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
      expenseCategories: Array.from(expMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    };
  }, [transactions, filteredTransactions, masterCategories]);

  // Ensure draft config has mapping populated for all expense categories
  const activeMapping = useMemo(() => {
    const map = { ...(draftConfig.categoryMapping || {}) };
    const explicitOtherSet = new Set(draftConfig.explicitOtherCategories || []);
    expenseCategories.forEach(c => {
      if (!map[c.name] || (map[c.name] === 'other' && !explicitOtherSet.has(c.name))) {
        map[c.name] = detectCategoryGroup(c.name);
      }
    });
    return map;
  }, [draftConfig.categoryMapping, draftConfig.explicitOtherCategories, expenseCategories]);

  // Re-sync draft config whenever modal opens or parent config changes
  useEffect(() => {
    if (isOpen) {
      setDraftConfig(JSON.parse(JSON.stringify(config || DEFAULT_CAFE_RATIO_CONFIG)));
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, config, initialTab]);

  // Calculate simulated preview metrics in real-time (matches active dashboard filter if provided)
  const simulatedMetrics = useMemo(() => {
    const configToSimulate: CafeRatioCategoryConfig = {
      ...draftConfig,
      categoryMapping: activeMapping
    };
    const targetTransactions = (filteredTransactions && filteredTransactions.length > 0) ? filteredTransactions : transactions;
    return computeCafeMetricsWithConfig(targetTransactions, configToSimulate);
  }, [transactions, filteredTransactions, draftConfig, activeMapping]);

  // Handle Category Mapping changes (automatically enables manual mode so changes take effect immediately)
  const handleSetCategoryGroup = (categoryName: string, group: CafeRatioGroup) => {
    setDraftConfig(prev => {
      const prevExplicit = new Set(prev.explicitOtherCategories || []);
      if (group === 'other') {
        prevExplicit.add(categoryName);
      } else {
        prevExplicit.delete(categoryName);
      }
      return {
        ...prev,
        mode: 'manual',
        explicitOtherCategories: Array.from(prevExplicit),
        categoryMapping: {
          ...(prev.categoryMapping || activeMapping),
          [categoryName]: group
        }
      };
    });
  };

  // Bulk assign all visible filtered categories
  const handleBulkAssign = (group: CafeRatioGroup) => {
    const newMap = { ...(draftConfig.categoryMapping || activeMapping) };
    const prevExplicit = new Set(draftConfig.explicitOtherCategories || []);
    filteredExpenseCategories.forEach(c => {
      newMap[c.name] = group;
      if (group === 'other') {
        prevExplicit.add(c.name);
      } else {
        prevExplicit.delete(c.name);
      }
    });
    setDraftConfig(prev => ({
      ...prev,
      mode: 'manual',
      explicitOtherCategories: Array.from(prevExplicit),
      categoryMapping: newMap
    }));
  };

  // Toggle Sales Category selection
  const handleToggleSalesCategory = (catName: string) => {
    setDraftConfig(prev => {
      const currentList = prev.selectedSalesCategories || [];
      const exists = currentList.includes(catName);
      const updated = exists 
        ? currentList.filter(c => c !== catName)
        : [...currentList, catName];
      return {
        ...prev,
        mode: 'manual',
        salesMode: 'selected_categories',
        selectedSalesCategories: updated
      };
    });
  };

  // Select all or deselect all sales categories
  const handleSelectAllSales = (selectAll: boolean) => {
    setDraftConfig(prev => ({
      ...prev,
      mode: 'manual',
      selectedSalesCategories: selectAll ? incomeCategories.map(c => c.name) : []
    }));
  };

  // Auto-detect and populate all categories using the smart classifier
  const handleAutoDetectAll = () => {
    const allNames = expenseCategories.map(c => c.name);
    const generated = generateAutoCategoryMapping(allNames);
    setDraftConfig(prev => ({
      ...prev,
      mode: 'auto',
      explicitOtherCategories: [],
      categoryMapping: generated
    }));
  };

  // Reset to default F&B Cafe standard
  const handleResetToDefault = () => {
    if (window.confirm('Reset seluruh konfigurasi rasio & target ke standar bawaan Cafe?')) {
      const allNames = expenseCategories.map(c => c.name);
      const generated = generateAutoCategoryMapping(allNames);
      setDraftConfig({
        mode: 'auto',
        salesMode: 'all_debit',
        selectedSalesCategories: incomeCategories.map(c => c.name),
        categoryMapping: generated,
        explicitOtherCategories: [],
        targetCogsPct: 35,
        targetWagesPct: 25,
        targetOperasionalPct: 20,
        targetNetProfitPct: 15
      });
    }
  };

  // Add custom unlisted category
  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customCatInput.trim();
    if (!trimmed) return;
    const detected = detectCategoryGroup(trimmed);
    setDraftConfig(prev => ({
      ...prev,
      mode: 'manual',
      categoryMapping: {
        ...(prev.categoryMapping || activeMapping),
        [trimmed]: detected
      }
    }));
    setCustomCatInput('');
  };

  // Save changes
  const handleSave = () => {
    const finalConfig: CafeRatioCategoryConfig = {
      ...draftConfig,
      categoryMapping: activeMapping
    };
    onSaveConfig(finalConfig);
    setSaveSuccessNotice(true);
    setTimeout(() => {
      setSaveSuccessNotice(false);
      onClose();
    }, 450);
  };

  // Filtered expense categories by search term
  const filteredExpenseCategories = expenseCategories.filter(c => 
    c.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Grouped expense counts for summary chips
  const groupCategoryCounts = useMemo(() => {
    const counts: Record<CafeRatioGroup, { count: number; totalRp: number }> = {
      cogs_minuman: { count: 0, totalRp: 0 },
      cogs_food: { count: 0, totalRp: 0 },
      cogs_snack: { count: 0, totalRp: 0 },
      cogs_general: { count: 0, totalRp: 0 },
      wages: { count: 0, totalRp: 0 },
      operasional: { count: 0, totalRp: 0 },
      promo: { count: 0, totalRp: 0 },
      other: { count: 0, totalRp: 0 }
    };

    expenseCategories.forEach(c => {
      const grp = activeMapping[c.name] || 'other';
      if (counts[grp]) {
        counts[grp].count += 1;
        counts[grp].totalRp += c.totalAmount;
      }
    });

    return counts;
  }, [expenseCategories, activeMapping]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-white">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Analisis Indikator Kinerja & Rasio Bisnis Cafe
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300">
                  Pemilihan Kategori Manual
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Kategori diambil langsung dari kolom <strong>Pengeluaran 1</strong> pada Aliran Data &amp; Filter untuk dipetakan ke rasio Gaji, HPP, Operasional, dll.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODE SELECTOR & LIVE SIMULATION STRIP */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 space-y-3">
          {/* Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-slate-600 tracking-wider">
                Mode Analisis:
              </span>
              <div className="inline-flex p-1 bg-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDraftConfig(prev => ({ ...prev, mode: 'auto' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    draftConfig.mode === 'auto'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Otomatis (Deteksi AI Kata Kunci)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDraftConfig(prev => ({ ...prev, mode: 'manual' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center space-x-1.5 cursor-pointer ${
                    draftConfig.mode === 'manual'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Manual (Pilihan Kategori Mandiri)</span>
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleAutoDetectAll}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition flex items-center space-x-1 cursor-pointer"
                title="Pindai dan petakan otomatis semua kategori berdasarkan kata kunci F&B"
              >
                <Sparkles className="h-3 w-3 text-amber-600" />
                <span>Deteksi Ulang Semua</span>
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 transition flex items-center space-x-1 cursor-pointer"
                title="Reset pengaturan ke bawaan sistem"
              >
                <RotateCcw className="h-3 w-3 text-slate-500" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Real-time Simulated Impact Ribbon & Target % Editor */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                Simulasi Hasil Rasio Keuangan &amp; Pengaturan Target (%):
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                draftConfig.mode === 'manual' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {draftConfig.mode === 'manual' ? '✓ Mode Manual Aktif' : '⚡ Mode Otomatis Aktif'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
              {/* Omset */}
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-150 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Total Omset</span>
                  <span className="text-xs font-black text-slate-900 font-mono block truncate">
                    {formatRupiah(simulatedMetrics.totalSales)}
                  </span>
                </div>
                <span className="text-[8.5px] text-slate-400 font-medium mt-1">Basis Penjualan</span>
              </div>

              {/* HPP */}
              <div className="bg-amber-50/60 rounded-lg p-2 border border-amber-200/60 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-amber-900">
                    <span>HPP (COGS)</span>
                    <span className="font-black text-amber-700">{simulatedMetrics.cogsRatio}%</span>
                  </div>
                  <span className="text-xs font-black text-amber-950 font-mono block truncate">
                    {formatRupiah(simulatedMetrics.totalCOGS)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1 text-[9px] text-amber-800 font-bold">
                  <span>Target &lt;</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draftConfig.targetCogsPct ?? 35}
                    onChange={e => setDraftConfig(prev => ({ ...prev, targetCogsPct: Math.max(1, Math.min(100, Number(e.target.value) || 35)) }))}
                    className="w-11 px-1 py-0.5 text-center bg-white border border-amber-300 rounded font-mono font-black text-amber-950 text-[10px]"
                  />
                  <span>%</span>
                </div>
              </div>

              {/* Gaji */}
              <div className="bg-indigo-50/60 rounded-lg p-2 border border-indigo-200/60 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-indigo-900">
                    <span>Gaji &amp; Staff</span>
                    <span className="font-black text-indigo-700">{simulatedMetrics.wagesRatio}%</span>
                  </div>
                  <span className="text-xs font-black text-indigo-950 font-mono block truncate">
                    {formatRupiah(simulatedMetrics.totalWages)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1 text-[9px] text-indigo-800 font-bold">
                  <span>Target &le;</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draftConfig.targetWagesPct ?? 25}
                    onChange={e => setDraftConfig(prev => ({ ...prev, targetWagesPct: Math.max(1, Math.min(100, Number(e.target.value) || 25)) }))}
                    className="w-11 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded font-mono font-black text-indigo-950 text-[10px]"
                  />
                  <span>%</span>
                </div>
              </div>

              {/* Operasional */}
              <div className="bg-rose-50/60 rounded-lg p-2 border border-rose-200/60 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-rose-900">
                    <span>Operasional</span>
                    <span className="font-black text-rose-700">{simulatedMetrics.operasionalRatio}%</span>
                  </div>
                  <span className="text-xs font-black text-rose-950 font-mono block truncate">
                    {formatRupiah(simulatedMetrics.totalOperasional)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1 text-[9px] text-rose-800 font-bold">
                  <span>Target &lt;</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draftConfig.targetOperasionalPct ?? 20}
                    onChange={e => setDraftConfig(prev => ({ ...prev, targetOperasionalPct: Math.max(1, Math.min(100, Number(e.target.value) || 20)) }))}
                    className="w-11 px-1 py-0.5 text-center bg-white border border-rose-300 rounded font-mono font-black text-rose-950 text-[10px]"
                  />
                  <span>%</span>
                </div>
              </div>

              {/* Nett Profit */}
              <div className="bg-emerald-50/60 rounded-lg p-2 border border-emerald-200/60 col-span-2 sm:col-span-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-emerald-900">
                    <span>Nett Margin</span>
                    <span className={`font-black ${simulatedMetrics.netProfitMargin >= (draftConfig.targetNetProfitPct ?? 15) ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {simulatedMetrics.netProfitMargin}%
                    </span>
                  </div>
                  <span className="text-xs font-black text-emerald-950 font-mono block truncate">
                    {formatRupiah(simulatedMetrics.netProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1 text-[9px] text-emerald-800 font-bold">
                  <span>Target &gt;</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draftConfig.targetNetProfitPct ?? 15}
                    onChange={e => setDraftConfig(prev => ({ ...prev, targetNetProfitPct: Math.max(1, Math.min(100, Number(e.target.value) || 15)) }))}
                    className="w-11 px-1 py-0.5 text-center bg-white border border-emerald-300 rounded font-mono font-black text-emerald-950 text-[10px]"
                  />
                  <span>%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="border-b border-slate-200 px-5 bg-white flex flex-wrap gap-1 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('all_table')}
            className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'all_table'
                ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Tabel Semua Pengeluaran 1 ({expenseCategories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cogs')}
            className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'cogs'
                ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>🥩</span>
            <span>HPP Bahan Baku ({groupCategoryCounts.cogs_minuman.count + groupCategoryCounts.cogs_food.count + groupCategoryCounts.cogs_snack.count + groupCategoryCounts.cogs_general.count})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wages')}
            className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'wages'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>👥</span>
            <span>Gaji & Staff ({groupCategoryCounts.wages.count})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('operasional')}
            className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'operasional'
                ? 'border-rose-600 text-rose-700 bg-rose-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>🏢</span>
            <span>Operasional & Sewa ({groupCategoryCounts.operasional.count})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'sales'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>💰</span>
            <span>Pemasukan / Omset ({incomeCategories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('promo')}
            className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'promo'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>📣</span>
            <span>Promosi ({groupCategoryCounts.promo.count})</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">

          {/* TAB 1: ALL EXPENSE CATEGORIES TABLE MAPPING */}
          {activeTab === 'all_table' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama kategori pengeluaran..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {searchFilter && (
                    <button 
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Add Custom Category Quick Input */}
                <form onSubmit={handleAddCustomCategory} className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    placeholder="Kategori baru manual..."
                    value={customCatInput}
                    onChange={e => setCustomCatInput(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none min-w-[170px]"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah</span>
                  </button>
                </form>
              </div>

              {/* Table of all expense categories */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Kategori (Pengeluaran 1)</th>
                      <th className="py-2.5 px-3">Frekuensi</th>
                      <th className="py-2.5 px-3 text-right">Total Pengeluaran</th>
                      <th className="py-2.5 px-3 w-64">Kelompok Rasio Bisnis Cafe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {filteredExpenseCategories.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                          Tidak ada kategori pengeluaran yang cocok dengan pencarian "{searchFilter}".
                        </td>
                      </tr>
                    ) : (
                      filteredExpenseCategories.map(item => {
                        const currentGroup = activeMapping[item.name] || 'other';
                        const groupInfo = CAFE_RATIO_GROUP_INFO[currentGroup];

                        return (
                          <tr key={item.name} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-900">{item.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {item.count} transaksi
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-right">
                              {formatRupiah(item.totalAmount)}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={currentGroup}
                                onChange={e => handleSetCategoryGroup(item.name, e.target.value as CafeRatioGroup)}
                                className={`w-full py-1.5 px-2 rounded-lg font-bold text-xs border transition cursor-pointer ${groupInfo.badgeBg}`}
                              >
                                <option value="cogs_minuman">🥤 HPP Minuman</option>
                                <option value="cogs_food">🍔 HPP Makanan (Food)</option>
                                <option value="cogs_snack">🍟 HPP Cemilan (Snack)</option>
                                <option value="cogs_general">📦 HPP Bahan Baku Umum</option>
                                <option value="wages">👥 Gaji & Staff / Barista</option>
                                <option value="operasional">🏢 Operasional & Sewa</option>
                                <option value="promo">📣 Promosi & Marketing</option>
                                <option value="other">⚪ Lain-lain / Non-Rasio</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: COGS / HPP BREAKDOWN & SELECTION */}
          {activeTab === 'cogs' && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start space-x-2.5">
                <span className="text-lg mt-0.5">🥩</span>
                <div>
                  <h4 className="font-black uppercase tracking-wide text-amber-900">
                    Konfigurasi Kategori HPP (Cost of Goods Sold)
                  </h4>
                  <p className="mt-0.5 text-amber-800 leading-relaxed font-medium">
                    HPP adalah seluruh biaya bahan baku makanan, minuman, dan cemilan cafe. Standar industri cafe menargetkan HPP berada di bawah <strong>35%</strong> (optimal 28% - 32%) untuk menjaga margin sehat.
                  </p>
                </div>
              </div>

              {/* Subcategories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['cogs_minuman', 'cogs_food', 'cogs_snack', 'cogs_general'] as const).map(grpKey => {
                  const info = CAFE_RATIO_GROUP_INFO[grpKey];
                  const assignedItems = expenseCategories.filter(c => (activeMapping[c.name] || 'other') === grpKey);
                  const totalGrpAmount = assignedItems.reduce((acc, c) => acc + c.totalAmount, 0);

                  return (
                    <div key={grpKey} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-150 mb-2">
                          <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                            <span>{info.icon}</span> {info.shortLabel}
                          </span>
                          <span className="text-xs font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {formatRupiah(totalGrpAmount)}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 mb-3">{info.description}</p>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {assignedItems.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic py-2">Belum ada kategori yang dipetakan ke {info.shortLabel}.</p>
                          ) : (
                            assignedItems.map(item => (
                              <div key={item.name} className="flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-200 text-xs">
                                <span className="font-bold text-slate-800 truncate max-w-[180px]" title={item.name}>
                                  {item.name}
                                </span>
                                <div className="flex items-center space-x-2 font-mono">
                                  <span className="text-slate-600 font-semibold">{formatRupiah(item.totalAmount)}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleSetCategoryGroup(item.name, 'other')}
                                    className="text-slate-400 hover:text-red-500 font-bold px-1"
                                    title="Keluarkan dari grup ini"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Dropdown to add another category to this group */}
                      <div className="mt-3 pt-2 border-t border-slate-100">
                        <select
                          onChange={e => {
                            if (e.target.value) {
                              handleSetCategoryGroup(e.target.value, grpKey);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="w-full text-xs font-medium py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 cursor-pointer"
                        >
                          <option value="" disabled>+ Masukkan Kategori ke {info.shortLabel}...</option>
                          {expenseCategories
                            .filter(c => (activeMapping[c.name] || 'other') !== grpKey)
                            .map(c => (
                              <option key={c.name} value={c.name}>
                                {c.name} ({formatRupiah(c.totalAmount)})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: WAGES / GAJI & STAFF */}
          {activeTab === 'wages' && (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 text-xs text-indigo-950 flex items-start space-x-2.5">
                <span className="text-lg mt-0.5">👥</span>
                <div>
                  <h4 className="font-black uppercase tracking-wide text-indigo-900">
                    Konfigurasi Kategori Gaji & Staff (Labor Cost)
                  </h4>
                  <p className="mt-0.5 text-indigo-800 leading-relaxed font-medium">
                    Mencakup gaji tetap barista, upah harian part-time, tunjangan lembur, bonus, dan uang makan karyawan. Standar biaya tenaga kerja cafe adalah <strong>15% - 25%</strong> dari omset.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-3">
                  <span className="text-xs font-black uppercase text-slate-800">
                    Daftar Kategori yang Dihitung Sebagai Gaji & Staff:
                  </span>
                  <span className="font-mono font-black text-sm text-indigo-900">
                    Total: {formatRupiah(simulatedMetrics.totalWages)}
                  </span>
                </div>

                <div className="space-y-2">
                  {expenseCategories.map(item => {
                    const isAssigned = (activeMapping[item.name] || 'other') === 'wages';
                    return (
                      <label 
                        key={item.name} 
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                          isAssigned 
                            ? 'bg-indigo-50/60 border-indigo-300' 
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {
                              handleSetCategoryGroup(item.name, isAssigned ? 'other' : 'wages');
                            }}
                            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{item.count} transaksi</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {formatRupiah(item.totalAmount)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPERASIONAL & SEWA */}
          {activeTab === 'operasional' && (
            <div className="space-y-4">
              <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200 text-xs text-rose-950 flex items-start space-x-2.5">
                <span className="text-lg mt-0.5">🏢</span>
                <div>
                  <h4 className="font-black uppercase tracking-wide text-rose-900">
                    Konfigurasi Kategori Operasional & Sewa Tempat (Opex)
                  </h4>
                  <p className="mt-0.5 text-rose-800 leading-relaxed font-medium">
                    Mencakup sewa ruko/tempat, biaya listrik PLN, air PDAM, internet wifi (i connect), gas operasional, kebersihan, ATK, dan perawatan mesin kopi. Target ideal di bawah <strong>20%</strong> omset.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-3">
                  <span className="text-xs font-black uppercase text-slate-800">
                    Daftar Kategori yang Dihitung Sebagai Operasional & Sewa:
                  </span>
                  <span className="font-mono font-black text-sm text-rose-900">
                    Total: {formatRupiah(simulatedMetrics.totalOperasional)}
                  </span>
                </div>

                <div className="space-y-2">
                  {expenseCategories.map(item => {
                    const isAssigned = (activeMapping[item.name] || 'other') === 'operasional';
                    return (
                      <label 
                        key={item.name} 
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                          isAssigned 
                            ? 'bg-rose-50/60 border-rose-300' 
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {
                              handleSetCategoryGroup(item.name, isAssigned ? 'other' : 'operasional');
                            }}
                            className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{item.count} transaksi</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {formatRupiah(item.totalAmount)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PEMASUKAN / OMSET (SALES BASE) */}
          {activeTab === 'sales' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start space-x-2.5">
                <span className="text-lg mt-0.5">💰</span>
                <div>
                  <h4 className="font-black uppercase tracking-wide text-emerald-900">
                    Pemilihan Kategori Pemasukan (Dasar Omset Penjualan)
                  </h4>
                  <p className="mt-0.5 text-emerald-800 leading-relaxed font-medium">
                    Omset penjualan menjadi penyebut dasar perhitungan seluruh rasio F&B (HPP %, Gaji %, Operasional %). Anda dapat memilih seluruh pemasukan (debit) atau membatasi hanya pada kategori penjualan tertentu.
                  </p>
                </div>
              </div>

              {/* Sales Mode Option */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="salesMode"
                      value="all_debit"
                      checked={draftConfig.salesMode === 'all_debit'}
                      onChange={() => setDraftConfig(prev => ({ ...prev, salesMode: 'all_debit' }))}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Gunakan Seluruh Transaksi Pemasukan (Debit) sebagai Omset [Rekomendasi]</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="salesMode"
                      value="selected_categories"
                      checked={draftConfig.salesMode === 'selected_categories'}
                      onChange={() => setDraftConfig(prev => ({ ...prev, salesMode: 'selected_categories' }))}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pilih Kategori Pemasukan Tertentu Saja (Kustom)</span>
                  </label>
                </div>

                {draftConfig.salesMode === 'selected_categories' && (
                  <div className="pt-3 border-t border-slate-150 space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-600">Pilih Kategori Pemasukan:</span>
                      <div className="space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSelectAllSales(true)}
                          className="text-[11px] font-bold text-emerald-600 hover:underline"
                        >
                          Pilih Semua
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleSelectAllSales(false)}
                          className="text-[11px] font-bold text-slate-500 hover:underline"
                        >
                          Kosongkan
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {incomeCategories.map(cat => {
                        const isChecked = (draftConfig.selectedSalesCategories || []).includes(cat.name);
                        return (
                          <label 
                            key={cat.name}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                              isChecked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSalesCategory(cat.name)}
                                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-bold text-slate-800">{cat.name}</span>
                            </div>
                            <span className="font-mono font-bold text-slate-800">
                              {formatRupiah(cat.totalAmount)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: PROMOTION & MARKETING */}
          {activeTab === 'promo' && (
            <div className="space-y-4">
              <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200 text-xs text-purple-950 flex items-start space-x-2.5">
                <span className="text-lg mt-0.5">📣</span>
                <div>
                  <h4 className="font-black uppercase tracking-wide text-purple-900">
                    Konfigurasi Kategori Promosi & Marketing
                  </h4>
                  <p className="mt-0.5 text-purple-800 leading-relaxed font-medium">
                    Mencakup iklan berbayar (Instagram Ads, TikTok Ads), cetak standing banner, brosur, diskon promosi, dan endorsement. Standar cafe yang sehat berkisar antara <strong>3% - 7%</strong> dari omset.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-3">
                  <span className="text-xs font-black uppercase text-slate-800">
                    Daftar Kategori Promosi & Marketing:
                  </span>
                  <span className="font-mono font-black text-sm text-purple-900">
                    Total: {formatRupiah(simulatedMetrics.totalPromo)}
                  </span>
                </div>

                <div className="space-y-2">
                  {expenseCategories.map(item => {
                    const isAssigned = (activeMapping[item.name] || 'other') === 'promo';
                    return (
                      <label 
                        key={item.name} 
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                          isAssigned 
                            ? 'bg-purple-50/60 border-purple-300' 
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {
                              handleSetCategoryGroup(item.name, isAssigned ? 'other' : 'promo');
                            }}
                            className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{item.count} transaksi</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {formatRupiah(item.totalAmount)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">
              Mode saat ini: <strong className="text-slate-800 uppercase font-black">{draftConfig.mode}</strong>
            </span>
            {draftConfig.mode === 'manual' && (
              <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                Kustom Terpilih
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{saveSuccessNotice ? 'Tersimpan!' : 'Simpan & Terapkan'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
