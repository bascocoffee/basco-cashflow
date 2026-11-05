import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  ChevronRight, 
  Info, 
  TrendingDown, 
  Tag, 
  ArrowLeft,
  Briefcase,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { Transaction } from '../types';
import { formatRupiah, formatLocalDate, parseDateString } from '../utils';

interface CategoryExpensesProps {
  transactions: Transaction[];
  categories: string[];
  onBackToDashboard?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Makanan & Minuman': '#ef4444', // Red
  'Pekerjaan & Gaji': '#10b981', // Emerald
  'Belanja': '#3b82f6', // Blue
  'Transportasi': '#f59e0b', // Amber
  'Kebutuhan Rumah': '#6366f1', // Indigo
  'Utilitas & Tagihan': '#8b5cf6', // Violet
  'Kesehatan': '#ec4899', // Pink
  'Hiburan & Rekreasi': '#14b8a6', // Teal
  'Pendidikan': '#06b6d4', // Cyan
  'Investasi': '#a855f7', // Purple
  'Lain-lain': '#64748b', // Slate
};

const INDO_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function CategoryExpenses({ 
  transactions, 
  categories,
  onBackToDashboard 
}: CategoryExpensesProps) {
  
  // 1. Extract all available months from transactions in YYYY-MM format
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    
    transactions.forEach(t => {
      if (!t.tanggal) return;
      try {
        const d = parseDateString(t.tanggal);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          monthsSet.add(`${year}-${month}`);
        }
      } catch (e) {
        // ignore invalid date
      }
    });

    // If empty, add current month
    if (monthsSet.size === 0) {
      const now = new Date();
      monthsSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }

    // Sort months in reverse chronological order
    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  // Selected Month State (defaults to the latest month with transactions, or current month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return availableMonths[0] || '';
  });

  // Search input state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected category for detail drill-down
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Hover state for donut segments
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Helper to format month key "YYYY-MM" to "Bulan Tahun" (Indonesian)
  const formatMonthKey = (key: string) => {
    if (!key) return '-';
    const [year, monthStr] = key.split('-');
    const monthIdx = parseInt(monthStr, 10) - 1;
    const monthName = INDO_MONTH_NAMES[monthIdx] || 'Bulan';
    return `${monthName} ${year}`;
  };

  // Get color for category
  const getCategoryColor = (category: string, idx: number) => {
    if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
    const defaultColors = [
      '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', 
      '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4', '#f97316'
    ];
    return defaultColors[idx % defaultColors.length];
  };

  // 2. Filter transactions by the selected month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.tanggal) return false;
      try {
        const d = parseDateString(t.tanggal);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        return monthKey === selectedMonth;
      } catch (e) {
        return false;
      }
    });
  }, [transactions, selectedMonth]);

  // Filter only expenses (Kredit / Kredit 2 > 0)
  const monthlyExpenses = useMemo(() => {
    return monthlyTransactions.filter(t => t.kredit > 0 || (t.kredit2 || 0) > 0);
  }, [monthlyTransactions]);

  // 3. Aggregate expense data by category for the selected month
  const categoryStats = useMemo(() => {
    const statsMap: Record<string, { amount: number; count: number }> = {};
    let totalMonthlyKredit = 0;

    monthlyExpenses.forEach(t => {
      const cat1 = t.jenisPengeluaran || 'Lain-lain';
      // Primary category
      if (t.kredit > 0) {
        if (!statsMap[cat1]) statsMap[cat1] = { amount: 0, count: 0 };
        statsMap[cat1].amount += t.kredit;
        statsMap[cat1].count += 1;
        totalMonthlyKredit += t.kredit;
      }

      // Secondary category (kredit2)
      if (t.kredit2 > 0) {
        const cat2 = (t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-')
          ? t.jenisPengeluaran2
          : cat1;
        if (!statsMap[cat2]) statsMap[cat2] = { amount: 0, count: 0 };
        statsMap[cat2].amount += t.kredit2;
        
        if (cat2 !== cat1 || t.kredit <= 0) {
          statsMap[cat2].count += 1;
        }
        
        totalMonthlyKredit += t.kredit2;
      }
    });

    const list = Object.keys(statsMap).map((category, idx) => {
      const data = statsMap[category];
      const percentage = totalMonthlyKredit > 0 
        ? parseFloat(((data.amount / totalMonthlyKredit) * 100).toFixed(1)) 
        : 0;
      
      return {
        category,
        amount: data.amount,
        count: data.count,
        percentage,
        color: getCategoryColor(category, idx)
      };
    });

    // Sort by amount descending
    list.sort((a, b) => b.amount - a.amount);

    return {
      list,
      total: totalMonthlyKredit
    };
  }, [monthlyExpenses]);

  // 4. Filter categories by Search Term
  const filteredCategoryList = useMemo(() => {
    return categoryStats.list.filter(item => 
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categoryStats.list, searchTerm]);

  // 5. Get transactions for the currently selected/drilled category in the selected month
  const categoryDetailsTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return monthlyExpenses.filter(t => {
      const cat1 = t.jenisPengeluaran || 'Lain-lain';
      const cat2 = (t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-')
        ? t.jenisPengeluaran2
        : cat1;
      return cat1 === selectedCategory || (t.kredit2 > 0 && cat2 === selectedCategory);
    });
  }, [monthlyExpenses, selectedCategory]);

  // Calculate Donut Chart cumulative angles
  const donutSegments = useMemo(() => {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercentage = 0;

    return categoryStats.list.map(item => {
      const strokeLength = (item.percentage / 100) * circumference;
      const strokeOffset = circumference - (accumulatedPercentage / 100) * circumference;
      const currentAccumulated = accumulatedPercentage;
      accumulatedPercentage += item.percentage;

      return {
        ...item,
        strokeLength,
        strokeOffset,
        startPercentage: currentAccumulated
      };
    });
  }, [categoryStats.list]);

  // Reset category details selection when month changes
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(e.target.value);
    setSelectedCategory(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in" id="category-expenses-page">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3.5">
          {onBackToDashboard && (
            <button 
              onClick={onBackToDashboard}
              className="p-1.5 rounded-lg hover:bg-slate-100 border border-slate-150 text-slate-500 hover:text-slate-900 transition flex items-center justify-center shrink-0"
              title="Kembali ke Dasbor Utama"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-500" />
              <span>Analisis Kategori Pengeluaran</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Proporsi & Distribusi Dana Pengeluaran Selama Sebulan
            </p>
          </div>
        </div>

        {/* Month Selector Dropdown */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <div className="relative rounded shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <select
              value={selectedMonth}
              onChange={handleMonthChange}
              className="block w-full rounded border border-slate-200 py-2 pl-9 pr-8 text-xs font-bold text-slate-800 bg-white focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors cursor-pointer appearance-none"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {formatMonthKey(m)}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
              <ChevronRight className="h-3 w-3 rotate-90" />
            </div>
          </div>
        </div>
      </div>

      {/* NO DATA STATE */}
      {categoryStats.list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto">
            <Info className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider">Tidak Ada Pengeluaran</h3>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mt-1">
              Bulan {formatMonthKey(selectedMonth)}
            </p>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tidak ditemukan catatan transaksi pengeluaran (kredit) pada bulan ini. Coba pilih bulan lain atau tambahkan pengeluaran baru dari halaman utama.
          </p>
          {onBackToDashboard && (
            <button 
              onClick={onBackToDashboard}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-[10px] uppercase tracking-wider rounded transition"
            >
              Kembali ke Dashboard
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT SIDE: VISUAL DONUT CHART & OVERVIEW (4 COLS) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest mb-1">
                Visualisasi Proporsi
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">
                Bulan {formatMonthKey(selectedMonth)}
              </p>

              {/* DONUT CHART */}
              <div className="relative flex justify-center items-center py-4">
                <svg width="220" height="220" className="transform -rotate-180">
                  {/* Outer circle background track */}
                  <circle
                    cx="110"
                    cy="110"
                    r="70"
                    fill="transparent"
                    stroke="#f8fafc"
                    strokeWidth="20"
                  />
                  
                  {/* Segment render */}
                  {donutSegments.map((segment) => {
                    const isSelected = selectedCategory === segment.category;
                    const isHovered = hoveredCategory === segment.category;
                    const strokeW = isSelected ? 24 : (isHovered ? 22 : 20);
                    
                    return (
                      <circle
                        key={segment.category}
                        cx="110"
                        cy="110"
                        r="70"
                        fill="transparent"
                        stroke={segment.color}
                        strokeWidth={strokeW}
                        strokeDasharray={`${segment.strokeLength} ${2 * Math.PI * 70}`}
                        strokeDashoffset={segment.strokeOffset}
                        transform="rotate(-90 110 110)"
                        className="transition-all duration-350 cursor-pointer"
                        onMouseEnter={() => setHoveredCategory(segment.category)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={() => setSelectedCategory(
                          selectedCategory === segment.category ? null : segment.category
                        )}
                        style={{
                          opacity: hoveredCategory && hoveredCategory !== segment.category ? 0.4 : 1,
                        }}
                      />
                    );
                  })}
                </svg>

                {/* Center Hole Information Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    {selectedCategory ? 'Kategori Terpilih' : 'Total Belanja'}
                  </span>
                  <span className="text-sm font-black text-slate-900 tracking-tight leading-none truncate max-w-[160px]" title={selectedCategory || ''}>
                    {selectedCategory ? selectedCategory : formatRupiah(categoryStats.total)}
                  </span>
                  <span className="text-[10px] font-bold font-mono text-indigo-500 uppercase tracking-widest mt-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                    {selectedCategory 
                      ? `${categoryStats.list.find(c => c.category === selectedCategory)?.percentage}%`
                      : `${categoryStats.list.length} Kategori`
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Dana Keluar</p>
                <p className="text-sm font-black text-slate-900 tracking-tight font-mono">{formatRupiah(categoryStats.total)}</p>
              </div>
              <div>
                <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jumlah Transaksi</p>
                <p className="text-sm font-black text-slate-950 tracking-tight font-mono">{monthlyExpenses.length}x</p>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-400 font-semibold italic flex items-start gap-1.5 leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-dashed border-slate-200">
              <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>Tip: Klik bagian berwarna di atas atau baris kategori di sebelah kanan untuk melihat riwayat transaksi rincian dari kategori tersebut.</span>
            </div>
          </div>

          {/* RIGHT SIDE: LIST, SEARCH, AND DRILL-DOWN (7 COLS) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* CATEGORIES PROGRESS LIST */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">
                    Daftar Proporsi Kategori
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Urutan berdasarkan pengeluaran terbesar
                  </p>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative rounded shadow-sm w-full sm:w-64">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Cari kategori..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded border border-slate-200 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-900 text-[10px] font-bold"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </div>

              {/* CATEGORIES SCROLLABLE LIST */}
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {filteredCategoryList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    Kategori tidak ditemukan
                  </div>
                ) : (
                  filteredCategoryList.map((item) => {
                    const isSelected = selectedCategory === item.category;
                    const isHovered = hoveredCategory === item.category;
                    
                    return (
                      <div 
                        key={item.category}
                        onClick={() => setSelectedCategory(isSelected ? null : item.category)}
                        onMouseEnter={() => setHoveredCategory(item.category)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-slate-900/5 border-slate-900' 
                            : 'bg-white border-slate-150 hover:border-slate-300'
                        }`}
                        style={{
                          opacity: hoveredCategory && hoveredCategory !== item.category ? 0.75 : 1
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2.5">
                            {/* Color Dot badge */}
                            <div 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs font-bold text-slate-900">
                              {item.category}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">
                              {item.count} transaksi
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-black text-slate-950 font-mono">
                              {formatRupiah(item.amount)}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-600 font-mono ml-2">
                              {item.percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="w-full bg-slate-50 border border-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ 
                              width: `${item.percentage}%`,
                              backgroundColor: item.color
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* EXPENSE TRANSACTION LIST FOR SELECTED CATEGORY (DRILL-DOWN) */}
            {selectedCategory && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                      <Tag className="h-4 w-4" style={{ color: categoryStats.list.find(c => c.category === selectedCategory)?.color }} />
                      <span>Rincian: {selectedCategory}</span>
                    </h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      Transaksi pada bulan {formatMonthKey(selectedMonth)}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-wider px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition"
                  >
                    Tutup Rincian
                  </button>
                </div>

                <div className="max-h-[250px] overflow-y-auto space-y-2.5 pr-1">
                  {categoryDetailsTransactions.map((t) => {
                    const cat1 = t.jenisPengeluaran || 'Lain-lain';
                    const cat2 = (t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-')
                      ? t.jenisPengeluaran2
                      : cat1;

                    // Check if it's primary or secondary or both in this category
                    const amt1 = cat1 === selectedCategory ? t.kredit : 0;
                    const amt2 = (t.kredit2 > 0 && cat2 === selectedCategory) ? t.kredit2 : 0;
                    const effectiveAmount = amt1 + amt2;

                    return (
                      <div key={t.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-150 transition-colors flex items-center justify-between">
                        <div className="space-y-1 max-w-[70%]">
                          <p className="text-xs font-bold text-slate-900 truncate" title={t.keterangan || 'Tanpa keterangan'}>
                            {t.keterangan || <span className="text-slate-400 italic">Tanpa keterangan</span>}
                          </p>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            <span>{formatLocalDate(t.tanggal)}</span>
                            {cat1 === selectedCategory && t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-' && (
                              <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.2 rounded-full">
                                Bagian dari Multi-Kategori ({t.jenisPengeluaran2})
                              </span>
                            )}
                            {t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-' && cat2 === selectedCategory && (
                              <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.2 rounded-full">
                                Kategori Kedua (K2)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold font-mono text-slate-900">
                            {formatRupiah(effectiveAmount)}
                          </span>
                          {amt2 > 0 && amt1 > 0 && (
                            <p className="text-[8.5px] text-slate-400 font-semibold font-sans uppercase">
                              (P1: {formatRupiah(amt1)} + P2: {formatRupiah(amt2)})
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
