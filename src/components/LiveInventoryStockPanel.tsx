import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Search,
  Copy,
  Check,
  ArrowRight,
  Flame,
  TrendingDown,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Scale
} from 'lucide-react';
import { IncomingIngredientBatch } from '../types';
import {
  computeLiveInventoryStock,
  getInventorySettings,
  saveInventorySetting,
  InventorySettingsMap,
  StockStatusType,
  InventoryFilterMode,
  InventoryFilterPeriod
} from '../utils/inventoryEngine';

interface LiveInventoryStockPanelProps {
  ingredients: Array<{
    id: string;
    namaBahan: string;
    satuanTakaran?: string;
    takaranPerCup?: number;
  }>;
  incomingBatches: IncomingIngredientBatch[];
  dailySales: Array<{
    tanggal?: string;
    menuSales?: Array<{
      menuId?: string;
      nama?: string;
      terjual?: number;
      jatah?: number;
    }>;
  }>;
  menuItems: Array<{
    id: string;
    nama: string;
    recipe?: Array<{ ingredientId: string; takaran: number }>;
    resep?: Array<{ ingredientId: string; takaran: number }>;
  }>;
  onNavigateToIncomingGoods?: () => void;

  // Optional timeframe controls synced with parent
  filterTimeframe?: InventoryFilterMode;
  selectedYear?: string;
  selectedMonth?: string;
  selectedDate?: string;
  availableYears?: string[];
  availableMonths?: string[];
  onChangeTimeframe?: (tf: InventoryFilterMode) => void;
  onChangeYear?: (y: string) => void;
  onChangeMonth?: (m: string) => void;
  onChangeDate?: (d: string) => void;
}

const STATUS_BADGE: Record<StockStatusType, { label: string; cls: string }> = {
  habis: {
    label: 'HABIS / MINUS',
    cls: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  kritis: {
    label: 'KRITIS',
    cls: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  menipis: {
    label: 'MENIPIS',
    cls: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  aman: {
    label: 'AMAN',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
};

const formatMonthName = (ymStr: string) => {
  if (!ymStr || ymStr === 'ALL') return 'Semua Bulan';
  const parts = ymStr.split('-');
  if (parts.length < 2) return ymStr;
  const year = parts[0];
  const month = parts[1];
  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${monthsIndo[mIndex]} ${year}`;
  }
  return ymStr;
};

const formatDateIndo = (dateStr: string) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const mIndex = parseInt(month, 10) - 1;
  const mName = mIndex >= 0 && mIndex < 12 ? monthsIndo[mIndex] : month;
  return `${day} ${mName} ${year}`;
};

export default function LiveInventoryStockPanel({
  ingredients,
  incomingBatches,
  dailySales,
  menuItems,
  onNavigateToIncomingGoods,
  filterTimeframe: propTimeframe,
  selectedYear: propYear,
  selectedMonth: propMonth,
  selectedDate: propDate,
  availableYears: propAvailableYears,
  availableMonths: propAvailableMonths,
  onChangeTimeframe,
  onChangeYear,
  onChangeMonth,
  onChangeDate,
}: LiveInventoryStockPanelProps) {
  const [settings, setSettings] = useState<InventorySettingsMap>(() => getInventorySettings());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'alerts'>('all');
  const [copiedRestock, setCopiedRestock] = useState(false);

  // Internal timeframe state if not controlled by parent
  const [internalTimeframe, setInternalTimeframe] = useState<InventoryFilterMode>('bulanan');
  const [internalYear, setInternalYear] = useState<string>(() => new Date().getFullYear().toString());
  const [internalMonth, setInternalMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [internalDate, setInternalDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const activeTimeframe: InventoryFilterMode = propTimeframe !== undefined ? propTimeframe : internalTimeframe;
  const activeYear = propYear !== undefined ? propYear : internalYear;
  const activeMonth = propMonth !== undefined ? propMonth : internalMonth;
  const activeDate = propDate !== undefined ? propDate : internalDate;

  // Available Years
  const derivedAvailableYears = useMemo(() => {
    if (propAvailableYears && propAvailableYears.length > 0) return propAvailableYears;
    const s = new Set<string>();
    dailySales.forEach((d) => {
      if (d.tanggal && d.tanggal.length >= 4) s.add(d.tanggal.slice(0, 4));
    });
    incomingBatches.forEach((b) => {
      if (b.tanggal && b.tanggal.length >= 4) s.add(b.tanggal.slice(0, 4));
    });
    const currentYear = new Date().getFullYear().toString();
    s.add(currentYear);
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [propAvailableYears, dailySales, incomingBatches]);

  // Available Months
  const derivedAvailableMonths = useMemo(() => {
    if (propAvailableMonths && propAvailableMonths.length > 0) return propAvailableMonths;
    const s = new Set<string>();
    dailySales.forEach((d) => {
      if (d.tanggal && d.tanggal.length >= 7) s.add(d.tanggal.slice(0, 7));
    });
    incomingBatches.forEach((b) => {
      if (b.tanggal && b.tanggal.length >= 7) s.add(b.tanggal.slice(0, 7));
    });
    const currentYm = new Date().toISOString().slice(0, 7);
    s.add(currentYm);
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [propAvailableMonths, dailySales, incomingBatches]);

  const handleSetTimeframe = (tf: InventoryFilterMode) => {
    if (onChangeTimeframe) onChangeTimeframe(tf);
    setInternalTimeframe(tf);
  };

  const handleSetYear = (y: string) => {
    if (onChangeYear) onChangeYear(y);
    setInternalYear(y);
  };

  const handleSetMonth = (m: string) => {
    if (onChangeMonth) onChangeMonth(m);
    setInternalMonth(m);
  };

  const handleSetDate = (d: string) => {
    if (onChangeDate) onChangeDate(d);
    setInternalDate(d);
  };

  const filterPeriodParam: InventoryFilterPeriod = useMemo(() => {
    return {
      mode: activeTimeframe,
      selectedYear: activeYear,
      selectedMonth: activeMonth,
      selectedDate: activeDate,
    };
  }, [activeTimeframe, activeYear, activeMonth, activeDate]);

  const summary = useMemo(
    () =>
      computeLiveInventoryStock({
        ingredients,
        incomingBatches,
        dailySales,
        menuItems,
        settings,
        filterPeriod: filterPeriodParam,
      }),
    [ingredients, incomingBatches, dailySales, menuItems, settings, filterPeriodParam]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.items.filter((item) => {
      if (filterMode === 'alerts' && item.status === 'aman') return false;
      if (q && !item.namaBahan.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [summary.items, searchQuery, filterMode]);

  const handleUpdateSetting = (
    ingredientId: string,
    field: 'initialStock' | 'minThreshold' | 'manualLiveStock',
    rawVal: string
  ) => {
    if (field === 'manualLiveStock' && rawVal === '') {
      const updated = saveInventorySetting(ingredientId, { manualLiveStock: undefined });
      setSettings({ ...updated });
      return;
    }
    const val = Math.max(0, Number(rawVal) || 0);
    const updated = saveInventorySetting(ingredientId, { [field]: val });
    setSettings({ ...updated });
  };

  const handleCopyRestockList = () => {
    const urgent = summary.items.filter((i) => i.status !== 'aman');
    if (urgent.length === 0) return;
    const lines = [
      `📦 *DAFTAR BELANJA STOK MENIPIS — BASCO COFFEE*`,
      `Periode: ${
        activeTimeframe === 'harian'
          ? formatDateIndo(activeDate)
          : activeTimeframe === 'bulanan'
          ? formatMonthName(activeMonth)
          : activeTimeframe === 'tahunan'
          ? `Tahun ${activeYear}`
          : 'Akumulasi Keseluruhan'
      }`,
      ...urgent.map(
        (i, idx) =>
          `${idx + 1}. ${i.namaBahan} — Sisa: ${Math.round(i.remainingStock).toLocaleString('id-ID')} ${i.satuanTakaran} (${STATUS_BADGE[i.status].label})`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedRestock(true);
    setTimeout(() => setCopiedRestock(false), 2000);
  };

  const urgentItems = summary.items.filter((i) => i.status !== 'aman');

  const periodLabelText = useMemo(() => {
    if (activeTimeframe === 'all') return 'Semua Data Terdata (Akumulasi)';
    if (activeTimeframe === 'tahunan') {
      return activeYear === 'ALL' ? 'Semua Tahun Terdata' : `Tahun ${activeYear}`;
    }
    if (activeTimeframe === 'bulanan') {
      return activeMonth === 'ALL' ? 'Semua Bulan Terdata' : formatMonthName(activeMonth);
    }
    return formatDateIndo(activeDate);
  }, [activeTimeframe, activeYear, activeMonth, activeDate]);

  const periodBadgeTitle = useMemo(() => {
    if (activeTimeframe === 'harian') return 'Harian';
    if (activeTimeframe === 'bulanan') return 'Bulanan';
    if (activeTimeframe === 'tahunan') return 'Tahunan';
    return 'Total';
  }, [activeTimeframe]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Stok Bahan Baku Live (Pemotongan Resep)
              </h4>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Rumus: <span className="font-semibold text-slate-700">Net = Stok Awal + Masuk - Dipakai</span> • <span className="font-semibold text-slate-700">Selisih = Net - Sisa Stok Live (Input Manual)</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {urgentItems.length > 0 && (
            <button
              type="button"
              onClick={handleCopyRestockList}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              {copiedRestock ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedRestock ? 'Tersalin!' : 'Salin Daftar Belanja'}</span>
            </button>
          )}
          {onNavigateToIncomingGoods && (
            <button
              type="button"
              onClick={onNavigateToIncomingGoods}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <span>Input Barang Masuk</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* OPSI CEK: HARIAN, BULANAN, TAHUNAN, SEMUA WAKTU */}
      <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>Periode:</span>
          </span>

          {/* Mode Selector Buttons: Harian, Bulanan, Tahunan, Semua Waktu */}
          <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleSetTimeframe('harian')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTimeframe === 'harian'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Harian
            </button>
            <button
              type="button"
              onClick={() => handleSetTimeframe('bulanan')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTimeframe === 'bulanan'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulanan
            </button>
            <button
              type="button"
              onClick={() => handleSetTimeframe('tahunan')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTimeframe === 'tahunan'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tahunan
            </button>
            <button
              type="button"
              onClick={() => handleSetTimeframe('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTimeframe === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Waktu
            </button>
          </div>

          {/* Conditional Pickers based on activeTimeframe */}
          {activeTimeframe === 'harian' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={activeDate}
                onChange={(e) => handleSetDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleSetDate(new Date().toISOString().split('T')[0])}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Hari Ini
              </button>
            </div>
          )}

          {activeTimeframe === 'bulanan' && (
            <div className="flex items-center space-x-2">
              <select
                value={activeMonth}
                onChange={(e) => handleSetMonth(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              >
                <option value="ALL">Semua Bulan Terdata</option>
                {derivedAvailableMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthName(ym)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTimeframe === 'tahunan' && (
            <div className="flex items-center space-x-2">
              <select
                value={activeYear}
                onChange={(e) => handleSetYear(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              >
                <option value="ALL">Semua Tahun Terdata</option>
                {derivedAvailableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 flex items-center space-x-1.5 self-end lg:self-center">
          <span>Periode:</span>
          <span className="font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            {periodLabelText}
          </span>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {summary.alertCount > 0 ? (
        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-rose-900">
                Peringatan Stok: {summary.alertCount} bahan baku perlu diperhatikan
              </p>
              <p className="text-rose-800/90 mt-0.5">
                {urgentItems
                  .slice(0, 4)
                  .map(
                    (i) =>
                      `${i.namaBahan} (Sisa: ${Math.round(i.remainingStock).toLocaleString('id-ID')} ${i.satuanTakaran})`
                  )
                  .join(' • ')}
                {urgentItems.length > 4 ? ` • +${urgentItems.length - 4} lainnya` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterMode(filterMode === 'alerts' ? 'all' : 'alerts')}
            className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg shrink-0 transition cursor-pointer"
          >
            {filterMode === 'alerts' ? 'Tampilkan Semua' : `Filter ${summary.alertCount} Menipis`}
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center space-x-2 text-xs text-emerald-900 font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Seluruh stok bahan baku dalam kondisi aman dan mencukupi.</span>
        </div>
      )}

      {/* Summary KPIs: Clean Minimalist Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500">Bahan Terpantau</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{summary.items.length}</p>
          <span className="text-[11px] text-slate-400">Master Bahan Baku</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
            <span>Barang Masuk ({periodBadgeTitle})</span>
          </p>
          <p className="text-xl font-bold text-emerald-700 mt-1">
            +{Math.round(summary.totalPeriodIncoming).toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-slate-400">
            Total masuk {periodBadgeTitle.toLowerCase()}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-amber-600" />
            <span>Dipakai ({periodBadgeTitle})</span>
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            -{Math.round(summary.totalPeriodUsed).toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-slate-400">
            {summary.totalPeriodPorsiTerjual} sales + {summary.totalPeriodPorsiJatah} jatah
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Scale className="h-3.5 w-3.5 text-slate-500" />
            <span>Net ({periodBadgeTitle})</span>
          </p>
          <p className={`text-xl font-bold mt-1 ${
            summary.totalPeriodNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {summary.totalPeriodNet >= 0
              ? `+${Math.round(summary.totalPeriodNet).toLocaleString('id-ID')}`
              : Math.round(summary.totalPeriodNet).toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-slate-400">
            {summary.totalPeriodNet >= 0 ? 'Surplus (Stok Awal + Masuk > Pakai)' : 'Defisit (Pakai > Stok Awal + Masuk)'}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama bahan baku..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center space-x-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl border transition cursor-pointer ${
              filterMode === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua ({summary.items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('alerts')}
            className={`px-3 py-1.5 rounded-xl border transition cursor-pointer ${
              filterMode === 'alerts'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            Perlu Belanja ({summary.alertCount})
          </button>
        </div>
      </div>

      {/* Live Inventory Table */}
      <div className="overflow-x-auto max-h-[440px] overflow-y-auto border border-slate-200 rounded-2xl shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-xs">
            <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200">
              <th className="py-2.5 px-3">Nama Bahan Baku</th>
              <th className="py-2.5 px-3 text-right">Stok Awal</th>
              <th className="py-2.5 px-3 text-right text-emerald-800 bg-emerald-50/40">
                Masuk ({periodBadgeTitle})
              </th>
              <th className="py-2.5 px-3 text-right text-amber-900 bg-amber-50/40">
                Dipakai ({periodBadgeTitle})
              </th>
              <th className="py-2.5 px-3 text-right bg-slate-200/50">
                Net ({periodBadgeTitle})
              </th>
              <th className="py-2.5 px-3 text-right font-black bg-amber-100/40">
                Sisa Stok Live
              </th>
              <th className="py-2.5 px-3 text-right bg-indigo-50/50 text-indigo-900">
                Selisih
              </th>
              <th className="py-2.5 px-3 text-right">Batas Min</th>
              <th className="py-2.5 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                  Tidak ada bahan baku yang sesuai filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const badge = STATUS_BADGE[item.status];
                const isNetPositive = item.periodNet >= 0;
                const selisihVal = Math.round(item.selisih);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div>
                        <span className="font-extrabold">{item.namaBahan}</span>
                        <span className="ml-1.5 text-[10px] font-semibold text-slate-400">
                          ({item.satuanTakaran})
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        value={item.initialStock || ''}
                        placeholder="0"
                        onChange={(e) => handleUpdateSetting(item.id, 'initialStock', e.target.value)}
                        className="w-20 text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        title="Edit Stok Awal Manual"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                      <div>
                        <span>+{Math.round(item.periodIncoming).toLocaleString('id-ID')}</span>
                        {activeTimeframe !== 'all' && item.totalIncoming > item.periodIncoming && (
                          <span className="block text-[9.5px] font-normal text-slate-400">
                            All: +{Math.round(item.totalIncoming).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 bg-amber-50/20">
                      <div>
                        <span>-{Math.round(item.periodUsed).toLocaleString('id-ID')}</span>
                        {(item.periodPorsiTerjual > 0 || item.periodPorsiJatah > 0) && (
                          <span className="block text-[9.5px] font-normal text-slate-500">
                            {item.periodPorsiTerjual} sales • {item.periodPorsiJatah} jatah
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold bg-slate-50/80">
                      <span className={isNetPositive ? 'text-emerald-700' : 'text-rose-700'}>
                        {isNetPositive
                          ? `+${Math.round(item.periodNet).toLocaleString('id-ID')}`
                          : Math.round(item.periodNet).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right bg-amber-50/30">
                      <div className="inline-flex items-center justify-end space-x-1">
                        <input
                          type="number"
                          min={0}
                          value={item.hasManualLiveStock ? item.manualLiveStock : ''}
                          placeholder="0"
                          onChange={(e) => handleUpdateSetting(item.id, 'manualLiveStock', e.target.value)}
                          className="w-20 text-right px-2 py-1 bg-white border border-amber-300 rounded-lg font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                          title="Input Manual Sisa Stok Live (Fisik)"
                        />
                        <span className="text-[10px] font-semibold text-slate-500">{item.satuanTakaran}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black bg-indigo-50/20">
                      <span
                        className={
                          selisihVal === 0
                            ? 'text-emerald-700'
                            : selisihVal > 0
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }
                        title="Rumus: Net - Sisa Stok Live"
                      >
                        {selisihVal > 0
                          ? `+${selisihVal.toLocaleString('id-ID')}`
                          : selisihVal.toLocaleString('id-ID')}{' '}
                        {item.satuanTakaran}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        value={item.minThreshold}
                        onChange={(e) => handleUpdateSetting(item.id, 'minThreshold', e.target.value)}
                        className="w-20 text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        title="Edit Batas Minimum Peringatan"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
