import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Coffee, Utensils, Sandwich, Sparkles, RefreshCw, AlertCircle, ShoppingCart, TrendingDown } from 'lucide-react';
import { Transaction } from '../types';
import { parseDateString } from '../utils';

interface CogsDetailProps {
  transactions: Transaction[];
}

export default function CogsDetail({ transactions }: CogsDetailProps) {
  const formatIndonesianDateWithDashes = (dateStr: string) => {
    const date = parseDateString(dateStr);
    if (!date || isNaN(date.getTime())) return dateStr;
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} - ${monthName} - ${year}`;
  };

  // Extract list of unique months
  const uniqueMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    transactions.forEach(t => {
      if (t.tanggal) {
        const date = parseDateString(t.tanggal);
        if (date && !isNaN(date.getTime())) {
          const year = date.getFullYear();
          const monthNum = date.getMonth(); // 0-indexed
          const monthName = monthNames[monthNum];
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
      const mIdxA = monthNames.indexOf(mNameA);
      const mIdxB = monthNames.indexOf(mNameB);
      return mIdxB - mIdxA;
    });
  }, [transactions]);

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('amount_desc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached analysis on month change
  useEffect(() => {
    const cached = localStorage.getItem(`aruskas_cogs_analysis_${selectedMonth}`);
    if (cached) {
      setAiAnalysis(cached);
    } else {
      setAiAnalysis('');
    }
    setError(null);
  }, [selectedMonth]);

  // Map transactions to subcategories of COGS
  const getCategoryGroup = (catName: string, desc?: string): 'cogs_minuman' | 'cogs_food' | 'cogs_snack' | 'other' => {
    const norm = (catName || '').toLowerCase().trim();
    const normDesc = (desc || '').toLowerCase().trim();

    if (
      norm.includes('wedang uwuh') || norm.includes('wedang') || norm.includes('uwuh') ||
      normDesc.includes('wedang uwuh') || normDesc.includes('wedang') || normDesc.includes('uwuh') ||
      norm.includes('kreamer') || norm.includes('creamer') || norm.includes('krimer') || norm.includes('fiber creme') || norm.includes('max creamer') ||
      normDesc.includes('kreamer') || normDesc.includes('creamer') || normDesc.includes('krimer') || normDesc.includes('fiber creme') || normDesc.includes('max creamer') ||
      norm.includes('es krim vanilla') || norm.includes('eskrim vanilla') || norm.includes('ice cream vanilla') || norm.includes('es krim') || norm.includes('eskrim') || norm.includes('ice cream') || norm.includes('es cream') || norm.includes('vanilla') || norm.includes('vanila') ||
      normDesc.includes('es krim vanilla') || normDesc.includes('eskrim vanilla') || normDesc.includes('ice cream vanilla') || normDesc.includes('es krim') || normDesc.includes('eskrim') || normDesc.includes('ice cream') || normDesc.includes('es cream') || normDesc.includes('vanilla') || normDesc.includes('vanila') ||
      norm.includes('air galon') || norm.includes('galon') ||
      normDesc.includes('air galon') || normDesc.includes('galon')
    ) {
      return 'cogs_minuman';
    }

    if (
      norm.includes('minyak') || normDesc.includes('minyak') ||
      norm.includes('lpg') || normDesc.includes('lpg') ||
      norm.includes('gas') || normDesc.includes('gas') ||
      norm.includes('sumpit') || normDesc.includes('sumpit')
    ) {
      return 'cogs_food';
    }

    const isSnack = (str: string) => {
      const s = str.toLowerCase();
      return s.includes('dimsum') || s.includes('singkong') || s.includes('kentang') || s.includes('snack') || s.includes('cemilan') || s.includes('tahu') || s.includes('croissant') || s.includes('donat');
    };

    const isFood = (str: string) => {
      const s = str.toLowerCase();
      return s.includes('totole') || s.includes('kaldu') || s.includes('mie') || s.includes('ayam') || s.includes('daging') || s.includes('telur') || s.includes('saus') || s.includes('nasi') || s.includes('bumbu') || s.includes('minyak goreng') || s.includes('kecap') || s.includes('bawang putih');
    };

    const isMinuman = (str: string) => {
      const s = str.toLowerCase();
      return s.includes('kopi') || s.includes('coffee') || s.includes('teh') || s.includes('tea') || s.includes('susu') || s.includes('milk') || s.includes('kreamer') || s.includes('creamer') || s.includes('krimer') || s.includes('fiber creme') || s.includes('wedang') || s.includes('uwuh') || s.includes('es krim') || s.includes('eskrim') || s.includes('ice cream') || s.includes('vanilla') || s.includes('vanila') || s.includes('es batu') || s.includes('sirup') || s.includes('sugar') || s.includes('gula') || s.includes('caramel') || s.includes('morin') || s.includes('monin');
    };

    if (isSnack(norm) || isSnack(normDesc)) return 'cogs_snack';
    if (isFood(norm) || isFood(normDesc)) return 'cogs_food';
    if (isMinuman(norm) || isMinuman(normDesc)) return 'cogs_minuman';

    if (norm.includes('bahan baku') || norm.includes('hpp') || norm.includes('cogs') || norm.includes('belanja')) {
      if (norm.includes('food') || norm.includes('makanan')) return 'cogs_food';
      if (norm.includes('snack') || norm.includes('cemilan')) return 'cogs_snack';
      return 'cogs_minuman';
    }

    return 'other';
  };

  // Process selected month transaction filtering
  const cogsData = useMemo(() => {
    let totalDrink = 0;
    let totalFood = 0;
    let totalSnack = 0;
    const items: { tanggal: string; categoryName: string; keterangan: string; amount: number; subCategory: 'Minuman' | 'Food' | 'Snack' }[] = [];

    transactions.forEach(t => {
      if (!t.tanggal) return;

      // Check if matches selected month
      let matchMonth = true;
      if (selectedMonth !== 'all') {
        const date = parseDateString(t.tanggal);
        if (date && !isNaN(date.getTime())) {
          const year = date.getFullYear();
          const monthNum = date.getMonth(); // 0-indexed
          const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          const monthName = monthNames[monthNum];
          const tMonthLabel = `${monthName} ${year}`;
          if (tMonthLabel !== selectedMonth) {
            matchMonth = false;
          }
        } else {
          matchMonth = false;
        }
      }

      if (!matchMonth) return;

      // Look at kredit
      if (t.kredit > 0) {
        const grp = getCategoryGroup(t.jenisPengeluaran || '', t.keterangan);
        if (grp.startsWith('cogs_')) {
          const amount = t.kredit;
          let subCategory: 'Minuman' | 'Food' | 'Snack' = 'Minuman';
          if (grp === 'cogs_food') {
            totalFood += amount;
            subCategory = 'Food';
          } else if (grp === 'cogs_snack') {
            totalSnack += amount;
            subCategory = 'Snack';
          } else {
            totalDrink += amount;
            subCategory = 'Minuman';
          }
          items.push({
            tanggal: t.tanggal,
            categoryName: t.jenisPengeluaran || 'HPP',
            keterangan: t.keterangan || '-',
            amount,
            subCategory
          });
        }
      }

      // Look at kredit2
      if (t.kredit2 > 0) {
        const cat2 = (t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-') ? t.jenisPengeluaran2 : (t.jenisPengeluaran || '');
        const grp2 = getCategoryGroup(cat2, t.keterangan);
        if (grp2.startsWith('cogs_')) {
          const amount = t.kredit2;
          let subCategory: 'Minuman' | 'Food' | 'Snack' = 'Minuman';
          if (grp2 === 'cogs_food') {
            totalFood += amount;
            subCategory = 'Food';
          } else if (grp2 === 'cogs_snack') {
            totalSnack += amount;
            subCategory = 'Snack';
          } else {
            totalDrink += amount;
            subCategory = 'Minuman';
          }
          items.push({
            tanggal: t.tanggal,
            categoryName: cat2,
            keterangan: t.keterangan || '-',
            amount,
            subCategory
          });
        }
      }
    });

    const totalCogs = totalDrink + totalFood + totalSnack;
    const drinkPercent = totalCogs > 0 ? Math.round((totalDrink / totalCogs) * 100) : 0;
    const foodPercent = totalCogs > 0 ? Math.round((totalFood / totalCogs) * 100) : 0;
    const snackPercent = totalCogs > 0 ? Math.round((totalSnack / totalCogs) * 100) : 0;

    // Group categories with the same name in 1 month
    const groupedMap: { [key: string]: { 
      tanggal: string; 
      categoryName: string; 
      keteranganList: string[]; 
      amount: number; 
      subCategory: 'Minuman' | 'Food' | 'Snack' 
    } } = {};

    items.forEach(item => {
      const date = parseDateString(item.tanggal);
      if (!date || isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const monthNum = date.getMonth(); // 0-indexed
      const monthKey = `${year}-${monthNum.toString().padStart(2, '0')}`;
      
      // Group key is: Month + Category Name + Subcategory
      const groupKey = `${monthKey}_${item.categoryName}_${item.subCategory}`;

      if (!groupedMap[groupKey]) {
        groupedMap[groupKey] = {
          tanggal: item.tanggal,
          categoryName: item.categoryName,
          keteranganList: [],
          amount: 0,
          subCategory: item.subCategory
        };
      }

      // Keep the latest date as representative of the group in that month
      if (item.tanggal > groupedMap[groupKey].tanggal) {
        groupedMap[groupKey].tanggal = item.tanggal;
      }

      if (item.keterangan && item.keterangan !== '-') {
        const trimmed = item.keterangan.trim();
        if (trimmed && !groupedMap[groupKey].keteranganList.includes(trimmed)) {
          groupedMap[groupKey].keteranganList.push(trimmed);
        }
      }
      
      groupedMap[groupKey].amount += item.amount;
    });

    const groupedItems = Object.values(groupedMap).map(g => ({
      tanggal: g.tanggal,
      categoryName: g.categoryName,
      keterangan: g.keteranganList.length > 0 ? g.keteranganList.join(', ') : '-',
      amount: g.amount,
      subCategory: g.subCategory
    }));

    // Sort items by date descending
    groupedItems.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    return {
      totalDrink,
      totalFood,
      totalSnack,
      totalCogs,
      drinkPercent,
      foodPercent,
      snackPercent,
      items: groupedItems
    };
  }, [transactions, selectedMonth]);

  const filteredAndSortedItems = useMemo(() => {
    let items = [...cogsData.items];

    // Filter by subcategory (Minuman / Food / Snack)
    if (selectedSubCategory !== 'all') {
      items = items.filter(item => item.subCategory === selectedSubCategory);
    }

    // Filter by search query (categoryName or keterangan)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.categoryName.toLowerCase().includes(q) || 
        item.keterangan.toLowerCase().includes(q)
      );
    }

    // Sort items
    if (sortOrder === 'amount_desc') {
      items.sort((a, b) => b.amount - a.amount);
    } else if (sortOrder === 'amount_asc') {
      items.sort((a, b) => a.amount - b.amount);
    } else if (sortOrder === 'date_desc') {
      items.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    } else if (sortOrder === 'date_asc') {
      items.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    }

    return items;
  }, [cogsData.items, selectedSubCategory, searchQuery, sortOrder]);

  const handleCogsAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    const monthLabel = selectedMonth === 'all' ? 'Seluruh Periode' : selectedMonth;
    const cogsSummary = {
      totalDrink: cogsData.totalDrink,
      totalFood: cogsData.totalFood,
      totalSnack: cogsData.totalSnack,
      totalCogs: cogsData.totalCogs,
      drinkPercent: cogsData.drinkPercent,
      foodPercent: cogsData.foodPercent,
      snackPercent: cogsData.snackPercent
    };

    try {
      const response = await fetch('/api/gemini/cogs-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthLabel,
          cogsSummary,
          transactionsList: cogsData.items.map(i => ({
            category: i.categoryName,
            keterangan: i.keterangan,
            amount: i.amount,
            tanggal: i.tanggal,
            subCategory: i.subCategory
          }))
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal memproses analisis HPP.');
      }

      const data = await response.json();
      setAiAnalysis(data.analysis);
      localStorage.setItem(`aruskas_cogs_analysis_${selectedMonth}`, data.analysis);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat meminta analisis.');
    } finally {
      setIsLoading(false);
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

  const renderFormattedAnalysis = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const cleanContent = trimmed.replace(/^[-*]\s*/, '');
        return (
          <li key={idx} className="ml-4 list-disc pl-1 mb-1.5 text-xs text-slate-700 leading-relaxed font-medium">
            {parseInlineStyles(cleanContent)}
          </li>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal pl-1 mb-1.5 text-xs text-slate-700 leading-relaxed font-medium">
            {parseInlineStyles(numMatch[2])}
          </li>
        );
      }
      if (trimmed.startsWith('#')) {
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        const cleanHeading = trimmed.replace(/^#+\s*/, '');
        const headingClass = level === 1 ? "text-sm font-black text-slate-900 mt-4 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1" :
                             level === 2 ? "text-xs font-black text-slate-900 mt-3 mb-1.5" :
                             "text-[11px] font-bold text-slate-800 mt-2 mb-1";
        return (
          <p key={idx} className={headingClass}>
            {parseInlineStyles(cleanHeading)}
          </p>
        );
      }
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p key={idx} className="text-xs text-slate-650 leading-relaxed mb-1.5 font-medium">
          {parseInlineStyles(trimmed)}
        </p>
      );
    });
  };

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" id="cogs-detail-view">
      {/* Title & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShoppingCart className="h-4.5 w-4.5 text-indigo-500" />
            <span>Rincian HPP / COGS (Cost of Goods Sold)</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-wide">
            Mengelompokkan pengeluaran bahan baku kafe ke dalam kategori Minuman, Makanan, & Snack
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-slate-400 transition cursor-pointer"
          >
            <option value="all">Semua Bulan (Seluruh Periode)</option>
            {uniqueMonths.map((m, idx) => (
              <option key={idx} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* COGS visual cards layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Total COGS card */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Total HPP / COGS</span>
            <h2 className="text-xl font-black mt-1 tracking-tight">{formatIDR(cogsData.totalCogs)}</h2>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-4">
            Total seluruh biaya belanja bahan baku & kebutuhan produksi kafe pada periode yang dipilih.
          </p>
        </div>

        {/* Minuman Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">HPP Minuman</span>
              <h2 className="text-base font-black mt-1 tracking-tight text-slate-900">{formatIDR(cogsData.totalDrink)}</h2>
            </div>
            <div className="bg-blue-50 text-blue-500 p-2.5 rounded-xl border border-blue-100">
              <Coffee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Kontribusi HPP:</span>
            <span className="text-xs font-black text-blue-600">{cogsData.drinkPercent}%</span>
          </div>
        </div>

        {/* Makanan Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">HPP Makanan</span>
              <h2 className="text-base font-black mt-1 tracking-tight text-slate-900">{formatIDR(cogsData.totalFood)}</h2>
            </div>
            <div className="bg-orange-50 text-orange-500 p-2.5 rounded-xl border border-orange-100">
              <Utensils className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Kontribusi HPP:</span>
            <span className="text-xs font-black text-orange-600">{cogsData.foodPercent}%</span>
          </div>
        </div>

        {/* Snack Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">HPP Snack</span>
              <h2 className="text-base font-black mt-1 tracking-tight text-slate-900">{formatIDR(cogsData.totalSnack)}</h2>
            </div>
            <div className="bg-amber-50 text-amber-500 p-2.5 rounded-xl border border-amber-100">
              <Sandwich className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Kontribusi HPP:</span>
            <span className="text-xs font-black text-amber-600">{cogsData.snackPercent}%</span>
          </div>
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Table of mapped cogs transactions */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Rincian Transaksi Bahan Baku & HPP</h3>
            <span className="text-[10px] font-bold bg-indigo-50 border border-indigo-150 text-indigo-700 px-2.5 py-1 rounded-full">
              {filteredAndSortedItems.length} transaksi
            </span>
          </div>

          {/* Controls: Filter & Sort */}
          <div className="p-4 bg-slate-50/30 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                placeholder="Cari kategori/keterangan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[11px] font-semibold text-slate-700 bg-white border border-slate-250 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 transition shadow-2xs"
              />
            </div>
            <div>
              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                className="w-full text-[11px] font-bold text-slate-700 bg-white border border-slate-250 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 transition cursor-pointer shadow-2xs"
              >
                <option value="all">Semua Kategori HPP</option>
                <option value="Minuman">HPP Minuman</option>
                <option value="Food">HPP Makanan (Food)</option>
                <option value="Snack">HPP Snack</option>
              </select>
            </div>
            <div>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full text-[11px] font-bold text-slate-700 bg-white border border-slate-250 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 transition cursor-pointer shadow-2xs"
              >
                <option value="amount_desc">Nominal: Tinggi ke Rendah</option>
                <option value="amount_asc">Nominal: Rendah ke Tinggi</option>
                <option value="date_desc">Tanggal: Terbaru</option>
                <option value="date_asc">Tanggal: Terlama</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto flex-grow max-h-[450px]">
            {filteredAndSortedItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                Tidak ada transaksi belanja bahan baku atau COGS yang cocok dengan filter Anda.
              </div>
            ) : (
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4 w-12 text-center">No.</th>
                    <th className="py-3 px-4">Kategori HPP</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredAndSortedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10.5px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            item.subCategory === 'Minuman' ? 'bg-blue-400' :
                            item.subCategory === 'Food' ? 'bg-orange-400' : 'bg-amber-400'
                          }`} />
                          <span className="text-slate-800 font-semibold">{item.categoryName}</span>
                          <span className="text-[9.5px] font-bold text-slate-400">({item.subCategory})</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 italic max-w-[200px] truncate" title={item.keterangan}>
                        {item.keterangan}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {formatIDR(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: AI COGS Analysis */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          <div className="bg-indigo-900/5 border border-indigo-150 rounded-3xl p-6 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Analisis COGS dengan Gemini AI</h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold mb-6">
                Gemini AI akan memproses perbandingan rincian belanja bahan baku minuman, makanan, & cemilan di periode ini untuk merancang saran penghematan & efisiensi taktis.
              </p>

              {aiAnalysis ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs max-h-[350px] overflow-y-auto mb-4">
                  {renderFormattedAnalysis(aiAnalysis)}
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 text-xs font-semibold p-4 text-center">
                  {isLoading ? (
                    <div className="space-y-2 flex flex-col items-center">
                      <RefreshCw className="h-7 w-7 text-indigo-600 animate-spin" />
                      <span>Gemini AI sedang membaca rincian transaksi belanja kafe...</span>
                    </div>
                  ) : (
                    <span>Klik tombol di bawah ini untuk memulai analisis AI otomatis.</span>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-150 rounded-xl text-[11px] font-semibold text-red-700 flex items-start space-x-2 mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleCogsAnalysis}
              disabled={isLoading || cogsData.items.length === 0}
              className="w-full mt-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-xl transition font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shrink-0 cursor-pointer shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Minta Analisis COGS AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
