import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  Coffee, 
  Package, 
  TrendingUp, 
  CheckCircle2, 
  Search, 
  Layers, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { 
  MenuItem, 
  RecipeIngredient, 
  DailySalesRecord, 
  calculateRecipeItemCost, 
  calculateMenuItemHppFromRecipe, 
  findIngredientHelper 
} from './CogsDailySalesPage';
import { IncomingIngredientBatch } from '../types';
import { 
  downloadSalesCogsReportPDF, 
  SalesCogsReportData, 
  MenuSalesSummaryItem, 
  IngredientUsageSummaryItem 
} from '../utils/salesCogsReportPdfExport';

interface SalesCogsReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailySales: DailySalesRecord[];
  menuCatalog: MenuItem[];
  ingredients: RecipeIngredient[];
  incomingBatches: IncomingIngredientBatch[];
  defaultMonth?: string;
  cafeName?: string;
}

export default function SalesCogsReportPdfModal({
  isOpen,
  onClose,
  dailySales,
  menuCatalog,
  ingredients,
  incomingBatches,
  defaultMonth,
  cafeName = 'Basco Coffee & Roastery'
}: SalesCogsReportPdfModalProps) {
  // Determine initial dates
  const initialDates = useMemo(() => {
    // If dates exist in dailySales, find min/max
    const dates = dailySales
      .map(d => d.tanggal)
      .filter(Boolean)
      .sort();

    const todayStr = new Date().toISOString().split('T')[0];

    if (defaultMonth && defaultMonth !== 'ALL' && defaultMonth.includes('-')) {
      const [year, month] = defaultMonth.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      return {
        start: `${defaultMonth}-01`,
        end: `${defaultMonth}-${String(lastDay).padStart(2, '0')}`
      };
    }

    if (dates.length > 0) {
      const latestDate = dates[dates.length - 1];
      const ym = latestDate.slice(0, 7);
      const [year, month] = ym.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      return {
        start: `${ym}-01`,
        end: `${ym}-${String(lastDay).padStart(2, '0')}`
      };
    }

    return {
      start: todayStr.slice(0, 7) + '-01',
      end: todayStr
    };
  }, [dailySales, defaultMonth]);

  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [customCafeName, setCustomCafeName] = useState(cafeName);
  const [activeViewTab, setActiveViewTab] = useState<'all' | 'menu' | 'ingredients' | 'incoming'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Preset Date Handlers
  const handleSetPreset = (preset: 'today' | 'last7' | 'thisMonth' | 'lastMonth' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'last7') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const ym = todayStr.slice(0, 7);
      const [year, month] = ym.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      setStartDate(`${ym}-01`);
      setEndDate(`${ym}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'lastMonth') {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ym = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
      const lastDay = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate();
      setStartDate(`${ym}-01`);
      setEndDate(`${ym}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'all') {
      const dates = dailySales.map(d => d.tanggal).filter(Boolean).sort();
      if (dates.length > 0) {
        setStartDate(dates[0]);
        setEndDate(dates[dates.length - 1]);
      } else {
        setStartDate('2026-01-01');
        setEndDate(todayStr);
      }
    }
  };

  // Month Quick Selector options from existing sales data
  const availableMonths = Array.from(
    new Set(
      [
        ...dailySales.map(d => (d.tanggal || '').slice(0, 7)),
        ...incomingBatches.map(b => (b.tanggal || '').slice(0, 7))
      ].filter(Boolean)
    )
  ).sort().reverse();

  const handleSelectMonth = (ym: string) => {
    if (!ym || !ym.includes('-')) return;
    const [year, month] = ym.split('-');
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
    setStartDate(`${ym}-01`);
    setEndDate(`${ym}-${String(lastDay).padStart(2, '0')}`);
  };

  // Filter Sales Records in Date Range
  const filteredDailySales = dailySales.filter(rec => {
    if (!rec.tanggal) return false;
    return rec.tanggal >= startDate && rec.tanggal <= endDate;
  });

  // Filter Incoming Goods in Date Range
  const filteredIncomingGoods = incomingBatches.filter(batch => {
    if (!batch.tanggal) return false;
    return batch.tanggal >= startDate && batch.tanggal <= endDate;
  }).sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  // ==========================================
  // TABEL 1: DATA PENJUALAN MENU
  // ==========================================
  const menuSalesSummary = useMemo(() => {
    const map = new Map<string, {
      menuId: string;
      nama: string;
      kategori: string;
      porsiTerjual: number;
      hargaJual: number;
      hppPerUnit: number;
    }>();

    // Initialize all menu items
    menuCatalog.forEach(m => {
      const calcHpp = calculateMenuItemHppFromRecipe(m, ingredients);
      map.set(m.id, {
        menuId: m.id,
        nama: m.nama,
        kategori: m.kategori,
        porsiTerjual: 0,
        hargaJual: m.hargaJual,
        hppPerUnit: calcHpp > 0 ? calcHpp : m.hpp
      });
    });

    // Aggregate from filtered dailySales
    filteredDailySales.forEach(rec => {
      if (rec.menuSales && rec.menuSales.length > 0) {
        rec.menuSales.forEach(ms => {
          let target = map.get(ms.menuId);
          if (!target) {
            // Find by matching name
            const foundMenu = menuCatalog.find(
              m => m.nama.trim().toLowerCase() === (ms.nama || '').trim().toLowerCase()
            );
            if (foundMenu) {
              target = map.get(foundMenu.id);
            }
          }

          if (target) {
            target.porsiTerjual += ms.terjual || 0;
            if (ms.hargaJual && target.hargaJual === 0) target.hargaJual = ms.hargaJual;
          } else {
            // New item not in catalog
            map.set(ms.menuId || ms.nama, {
              menuId: ms.menuId || ms.nama,
              nama: ms.nama,
              kategori: (ms as any).kategori || 'Minuman',
              porsiTerjual: ms.terjual || 0,
              hargaJual: ms.hargaJual || 0,
              hppPerUnit: ms.hpp || 0
            });
          }
        });
      }
    });

    const result: MenuSalesSummaryItem[] = [];
    map.forEach(val => {
      const totalOmset = val.porsiTerjual * val.hargaJual;
      const totalHpp = val.porsiTerjual * val.hppPerUnit;
      const labaKotor = totalOmset - totalHpp;
      const marginPct = totalOmset > 0 ? (labaKotor / totalOmset) * 100 : 0;

      result.push({
        ...val,
        totalOmset,
        totalHpp,
        labaKotor,
        marginPct
      });
    });

    // Sort by porsiTerjual descending
    return result.sort((a, b) => b.porsiTerjual - a.porsiTerjual);
  }, [menuCatalog, filteredDailySales, ingredients]);

  // ==========================================
  // TABEL 2: PEMAKAIAN BAHAN BAKU
  // ==========================================
  const ingredientUsageSummary = useMemo(() => {
    const usageMap = new Map<string, {
      ingredientId: string;
      namaBahan: string;
      kategori: string;
      totalTakaran: number;
      satuanTakaran: string;
      biayaSatuanTakaran: number;
      totalBiaya: number;
    }>();

    // Iterate through all menu sales that have sold cups
    menuSalesSummary.forEach(mSale => {
      if (mSale.porsiTerjual <= 0) return;

      const catalogItem = menuCatalog.find(m => m.id === mSale.menuId || m.nama === mSale.nama);
      if (!catalogItem || !catalogItem.recipe || catalogItem.recipe.length === 0) return;

      catalogItem.recipe.forEach(recipeItem => {
        const ing = findIngredientHelper(ingredients, recipeItem.ingredientId);
        if (!ing) return;

        const takaranTerpakai = recipeItem.takaran * mSale.porsiTerjual;
        const biayaTakaran = calculateRecipeItemCost(ing, takaranTerpakai);
        const costPerUnit = calculateRecipeItemCost(ing, 1);

        const existing = usageMap.get(ing.id);
        if (existing) {
          existing.totalTakaran += takaranTerpakai;
          existing.totalBiaya += biayaTakaran;
        } else {
          usageMap.set(ing.id, {
            ingredientId: ing.id,
            namaBahan: ing.namaBahan,
            kategori: ing.satuanTakaran === 'gram' || ing.satuanTakaran === 'ml' ? 'Bahan Baku Racikan' : 'Bahan / Kemasan',
            totalTakaran: takaranTerpakai,
            satuanTakaran: ing.satuanTakaran || 'unit',
            biayaSatuanTakaran: costPerUnit,
            totalBiaya: biayaTakaran
          });
        }
      });
    });

    const list = Array.from(usageMap.values());
    const totalAllBiaya = list.reduce((s, i) => s + i.totalBiaya, 0);

    const result: IngredientUsageSummaryItem[] = list.map(item => ({
      ...item,
      kontribusiPct: totalAllBiaya > 0 ? (item.totalBiaya / totalAllBiaya) * 100 : 0
    }));

    // Sort by total biaya descending
    return result.sort((a, b) => b.totalBiaya - a.totalBiaya);
  }, [menuSalesSummary, menuCatalog, ingredients]);

  // ==========================================
  // METRICS & SUMMARY
  // ==========================================
  const summaryMetrics = useMemo(() => {
    const totalPorsi = menuSalesSummary.reduce((s, m) => s + m.porsiTerjual, 0);
    const totalOmset = menuSalesSummary.reduce((s, m) => s + m.totalOmset, 0);
    const totalHpp = menuSalesSummary.reduce((s, m) => s + m.totalHpp, 0);
    const totalLabaKotor = totalOmset - totalHpp;
    const averageMarginPct = totalOmset > 0 ? (totalLabaKotor / totalOmset) * 100 : 0;

    const totalBiayaBahanTerpakai = ingredientUsageSummary.reduce((s, i) => s + i.totalBiaya, 0);

    const totalBelanjaBarangMasuk = filteredIncomingGoods.reduce((s, b) => s + (b.harga || 0), 0);
    const totalBarangLunas = filteredIncomingGoods
      .filter(b => b.statusPembayaran === 'Lunas')
      .reduce((s, b) => s + (b.harga || 0), 0);
    const totalBarangTempo = filteredIncomingGoods
      .filter(b => b.statusPembayaran !== 'Lunas')
      .reduce((s, b) => s + (b.harga || 0), 0);

    return {
      totalPorsi,
      totalOmset,
      totalHpp,
      totalLabaKotor,
      averageMarginPct,
      totalBiayaBahanTerpakai,
      totalBelanjaBarangMasuk,
      totalBarangLunas,
      totalBarangTempo
    };
  }, [menuSalesSummary, ingredientUsageSummary, filteredIncomingGoods]);

  // Period Formatted Label
  const periodLabel = useMemo(() => {
    if (!startDate && !endDate) return 'Semua Periode';
    const s = startDate.split('-').reverse().join('/');
    const e = endDate.split('-').reverse().join('/');
    return `${s} s/d ${e}`;
  }, [startDate, endDate]);

  // Handle PDF Download
  const handleDownloadPdf = () => {
    const reportData: SalesCogsReportData = {
      startDate,
      endDate,
      periodLabel,
      cafeName: customCafeName,
      menuSalesList: menuSalesSummary,
      ingredientUsageList: ingredientUsageSummary,
      incomingGoodsList: filteredIncomingGoods,
      summary: summaryMetrics
    };
    downloadSalesCogsReportPDF(reportData);
  };

  // Handle Browser Print
  const handlePrint = () => {
    window.print();
  };

  // Filter for search in table preview
  const qLower = searchQuery.toLowerCase().trim();
  const displayedMenuSales = useMemo(() => {
    if (!qLower) return menuSalesSummary;
    return menuSalesSummary.filter(m => 
      m.nama.toLowerCase().includes(qLower) || 
      m.kategori.toLowerCase().includes(qLower)
    );
  }, [menuSalesSummary, qLower]);

  const displayedIngredients = useMemo(() => {
    if (!qLower) return ingredientUsageSummary;
    return ingredientUsageSummary.filter(i => 
      i.namaBahan.toLowerCase().includes(qLower) || 
      i.kategori.toLowerCase().includes(qLower)
    );
  }, [ingredientUsageSummary, qLower]);

  const displayedIncomingGoods = useMemo(() => {
    if (!qLower) return filteredIncomingGoods;
    return filteredIncomingGoods.filter(b => 
      b.namaBahan.toLowerCase().includes(qLower) || 
      (b.supplier && b.supplier.toLowerCase().includes(qLower)) ||
      (b.nomorNota && b.nomorNota.toLowerCase().includes(qLower))
    );
  }, [filteredIncomingGoods, qLower]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-6xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-scale-up">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-md">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Export PDF Eksekutif
                </span>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  • {filteredDailySales.length} hari data terpilih
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-white mt-0.5">
                Laporan Penjualan Menu, Pemakaian Bahan & Barang Masuk
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer"
              title="Unduh berkas PDF"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Unduh PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
              title="Cetak langsung"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* MODAL CONTROLS & DATE FILTERS */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Rentang:
              </span>
              <button
                type="button"
                onClick={() => handleSetPreset('today')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('last7')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('thisMonth')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('lastMonth')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition"
              >
                Bulan Lalu
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('all')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition"
              >
                Semua Data
              </button>
            </div>

            {/* Quick Month Select */}
            {availableMonths.length > 0 && (
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400 font-medium">Pilih Bulan:</span>
                <select
                  value=""
                  onChange={(e) => handleSelectMonth(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  <option value="" disabled>Pilih Bulan Cepat...</option>
                  {availableMonths.map(ym => (
                    <option key={ym} value={ym}>{ym}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Date Pickers & Cafe Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="flex items-center space-x-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400 shrink-0">Mulai:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-hidden w-full font-mono cursor-pointer"
              />
            </div>

            <div className="flex items-center space-x-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400 shrink-0">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-hidden w-full font-mono cursor-pointer"
              />
            </div>

            <div className="flex items-center space-x-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400 shrink-0">Header Kafe:</span>
              <input
                type="text"
                value={customCafeName}
                onChange={(e) => setCustomCafeName(e.target.value)}
                placeholder="Nama Kafe pada PDF"
                className="bg-transparent text-xs text-white focus:outline-hidden w-full font-medium"
              />
            </div>
          </div>
        </div>

        {/* MODAL KPI METRICS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/40 border-b border-slate-800 shrink-0">
          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Omset Menu</div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5">
              Rp {summaryMetrics.totalOmset.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summaryMetrics.totalPorsi.toLocaleString('id-ID')} porsi / cup terjual
            </div>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">Total HPP (COGS)</div>
            <div className="text-base sm:text-lg font-black text-amber-400 mt-0.5">
              Rp {Math.round(summaryMetrics.totalHpp).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Rasio {summaryMetrics.totalOmset > 0 ? ((summaryMetrics.totalHpp / summaryMetrics.totalOmset) * 100).toFixed(1) : 0}% omset
            </div>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Laba Kotor (Gross)</div>
            <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
              Rp {Math.round(summaryMetrics.totalLabaKotor).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">
              Margin {summaryMetrics.averageMarginPct.toFixed(1)}%
            </div>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">Barang Masuk</div>
            <div className="text-base sm:text-lg font-black text-sky-400 mt-0.5">
              Rp {summaryMetrics.totalBelanjaBarangMasuk.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {filteredIncomingGoods.length} invoice/batch masuk
            </div>
          </div>
        </div>

        {/* SECTION NAVIGATION & SEARCH */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setActiveViewTab('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                activeViewTab === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Semua Laporan</span>
            </button>
            <button
              onClick={() => setActiveViewTab('menu')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                activeViewTab === 'menu'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Coffee className="h-3.5 w-3.5" />
              <span>1. Penjualan Menu ({displayedMenuSales.length})</span>
            </button>
            <button
              onClick={() => setActiveViewTab('ingredients')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                activeViewTab === 'ingredients'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>2. Pemakaian Bahan ({displayedIngredients.length})</span>
            </button>
            <button
              onClick={() => setActiveViewTab('incoming')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                activeViewTab === 'incoming'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>3. Barang Masuk ({displayedIncomingGoods.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari dalam pratinjau..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>
        </div>

        {/* MODAL CONTENT: PREVIEW TABLES */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 bg-slate-950">
          
          {/* ============================================================ */}
          {/* TABEL 1: DATA PENJUALAN MENU */}
          {/* ============================================================ */}
          {(activeViewTab === 'all' || activeViewTab === 'menu') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-6 bg-slate-500 rounded-xs"></div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">
                    1. Data Penjualan Menu dalam Rentang Hari & Bulan
                  </h4>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {periodLabel}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-200">
                    <thead className="bg-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">No</th>
                        <th className="py-2.5 px-3">Nama Menu</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3 text-center">Porsi Terjual</th>
                        <th className="py-2.5 px-3 text-right">Harga Jual</th>
                        <th className="py-2.5 px-3 text-right">Total Omset</th>
                        <th className="py-2.5 px-3 text-right">Estimasi HPP</th>
                        <th className="py-2.5 px-3 text-right">Laba Kotor</th>
                        <th className="py-2.5 px-3 text-center">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium">
                      {displayedMenuSales.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                            Tidak ada penjualan menu pada rentang tanggal terpilih.
                          </td>
                        </tr>
                      ) : (
                        displayedMenuSales.map((item, idx) => (
                          <tr key={item.menuId || idx} className="hover:bg-slate-800/50 transition">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-white">{item.nama}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
                                {item.kategori}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-amber-400">
                              {item.porsiTerjual.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              Rp {item.hargaJual.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              Rp {item.totalOmset.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-amber-300">
                              Rp {Math.round(item.totalHpp).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                              Rp {Math.round(item.labaKotor).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-xs font-bold text-slate-300">
                              {item.marginPct.toFixed(1)}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-800/90 font-black text-xs border-t border-slate-700">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-slate-300 uppercase tracking-wider">
                          TOTAL ({menuSalesSummary.length} Menu)
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-400 font-mono">
                          {summaryMetrics.totalPorsi.toLocaleString('id-ID')} cup
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">-</td>
                        <td className="py-2.5 px-3 text-right text-white font-mono">
                          Rp {summaryMetrics.totalOmset.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-400 font-mono">
                          Rp {Math.round(summaryMetrics.totalHpp).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-mono">
                          Rp {Math.round(summaryMetrics.totalLabaKotor).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-200 font-mono">
                          {summaryMetrics.averageMarginPct.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TABEL 2: PEMAKAIAN BAHAN BAKU */}
          {/* ============================================================ */}
          {(activeViewTab === 'all' || activeViewTab === 'ingredients') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-6 bg-amber-500 rounded-xs"></div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">
                    2. Pemakaian Bahan Baku (Berdasarkan Resep Menu yang Terjual)
                  </h4>
                </div>
                <span className="text-xs text-amber-400 font-mono">
                  Total Biaya: Rp {Math.round(summaryMetrics.totalBiayaBahanTerpakai).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-200">
                    <thead className="bg-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">No</th>
                        <th className="py-2.5 px-3">Nama Bahan Baku</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3 text-center">Total Pemakaian</th>
                        <th className="py-2.5 px-3 text-right">Biaya per Satuan</th>
                        <th className="py-2.5 px-3 text-right">Total Estimasi Biaya HPP</th>
                        <th className="py-2.5 px-3 text-center">Kontribusi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium">
                      {displayedIngredients.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                            Tidak ada pemakaian bahan baku terdata pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        displayedIngredients.map((item, idx) => (
                          <tr key={item.ingredientId || idx} className="hover:bg-slate-800/50 transition">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-white">{item.namaBahan}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
                                {item.kategori}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-amber-400">
                              {Number(item.totalTakaran.toFixed(1)).toLocaleString('id-ID')} {item.satuanTakaran}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">
                              Rp {Math.round(item.biayaSatuanTakaran).toLocaleString('id-ID')} / {item.satuanTakaran}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-amber-300">
                              Rp {Math.round(item.totalBiaya).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-xs font-bold text-slate-300">
                              {item.kontribusiPct.toFixed(1)}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-800/90 font-black text-xs border-t border-slate-700">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-slate-300 uppercase tracking-wider">
                          TOTAL ESTIMASI BIAYA BAHAN BAKU
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-400 font-mono">
                          Rp {Math.round(summaryMetrics.totalBiayaBahanTerpakai).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-200 font-mono">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TABEL 3: LAPORAN BARANG MASUK */}
          {/* ============================================================ */}
          {(activeViewTab === 'all' || activeViewTab === 'incoming') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-6 bg-sky-500 rounded-xs"></div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">
                    3. Tabel Laporan Barang Masuk (Pembelian Inventory)
                  </h4>
                </div>
                <span className="text-xs text-sky-400 font-mono">
                  {filteredIncomingGoods.length} transaksi • Rp {summaryMetrics.totalBelanjaBarangMasuk.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-200">
                    <thead className="bg-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">No</th>
                        <th className="py-2.5 px-3 text-center">Tanggal</th>
                        <th className="py-2.5 px-3">Nama Bahan / Barang</th>
                        <th className="py-2.5 px-3 text-center">Kuantitas</th>
                        <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                        <th className="py-2.5 px-3 text-right">Total Biaya</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-3">Nota / Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium">
                      {displayedIncomingGoods.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                            Tidak ada transaksi barang masuk pada rentang tanggal terpilih.
                          </td>
                        </tr>
                      ) : (
                        displayedIncomingGoods.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-800/50 transition">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 text-center font-mono text-slate-300">
                              {item.tanggal ? item.tanggal.split('-').reverse().join('/') : '-'}
                            </td>
                            <td className="py-2 px-3 font-bold text-white">{item.namaBahan}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-sky-400">
                              {item.berat} {item.satuan}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">
                              Rp {Math.round(item.hargaSatuan || (item.berat > 0 ? item.harga / item.berat : 0)).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              Rp {item.harga.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.statusPembayaran === 'Lunas' 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {item.statusPembayaran || 'Lunas'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-300">{item.supplier || '-'}</td>
                            <td className="py-2 px-3 text-slate-400 truncate max-w-xs">{item.nomorNota || item.keterangan || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-800/90 font-black text-xs border-t border-slate-700">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-slate-300 uppercase tracking-wider">
                          TOTAL BARANG MASUK ({filteredIncomingGoods.length} Item)
                        </td>
                        <td className="py-2.5 px-3 text-right text-sky-400 font-mono">
                          Rp {summaryMetrics.totalBelanjaBarangMasuk.toLocaleString('id-ID')}
                        </td>
                        <td colSpan={3} className="py-2.5 px-3 text-slate-400 text-xs font-normal">
                          Lunas: <span className="text-emerald-400 font-bold font-mono">Rp {summaryMetrics.totalBarangLunas.toLocaleString('id-ID')}</span> | 
                          Tempo: <span className="text-amber-400 font-bold font-mono">Rp {summaryMetrics.totalBarangTempo.toLocaleString('id-ID')}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Format PDF telah disesuaikan dengan standar A4 profesional Kafe Basco.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Unduh Berkas PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
