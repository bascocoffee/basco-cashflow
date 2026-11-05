import React, { useState, useMemo } from 'react';
import { 
  PackagePlus, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown, 
  FileSpreadsheet,
  AlertCircle,
  FileText,
  Building2,
  Tag,
  Scale,
  BarChart3,
  PieChart as PieChartIcon,
  Package,
  X,
  RotateCcw
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  Legend,
  PieChart,
  Pie
} from 'recharts';
import * as XLSX from 'xlsx';
import { IncomingIngredientBatch, PaymentStatus } from '../types';
import { RecipeIngredient, UNIT_OPTIONS } from './CogsDailySalesPage';
import { formatRupiah } from '../utils';

interface IncomingGoodsModuleProps {
  ingredients: RecipeIngredient[];
  incomingBatches: IncomingIngredientBatch[];
  onAddBatch: (batch: Omit<IncomingIngredientBatch, 'id'>) => void;
  onUpdateBatch: (batch: IncomingIngredientBatch) => void;
  onDeleteBatch: (id: string) => void;
  selectedMonth: string; // YYYY-MM or 'ALL'
  onChangeSelectedMonth: (month: string) => void;
  availableMonths: string[];
}

export default function IncomingGoodsModule({
  ingredients,
  incomingBatches,
  onAddBatch,
  onUpdateBatch,
  onDeleteBatch,
  selectedMonth,
  onChangeSelectedMonth,
  availableMonths
}: IncomingGoodsModuleProps) {
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  // Form Fields
  const [formTanggal, setFormTanggal] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [formNamaBahan, setFormNamaBahan] = useState<string>('');
  const [formKategori, setFormKategori] = useState<string>('Minuman');
  const [formBerat, setFormBerat] = useState<string>('1000');
  const [formSatuan, setFormSatuan] = useState<string>('gram');
  const [formHarga, setFormHarga] = useState<string>('');
  const [formStatusPembayaran, setFormStatusPembayaran] = useState<PaymentStatus>('Lunas');
  const [formSupplier, setFormSupplier] = useState<string>('');
  const [formNomorNota, setFormNomorNota] = useState<string>('');
  const [formKeterangan, setFormKeterangan] = useState<string>('');

  // Table Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterNamaBahan, setFilterNamaBahan] = useState<string>('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'EXACT' | 'RANGE'>('ALL');
  const [filterExactDate, setFilterExactDate] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [chartDimension, setChartDimension] = useState<'item' | 'category'>('item');
  const [itemChartMetric, setItemChartMetric] = useState<'nominal' | 'kuantitas'>('nominal');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'name_asc'>('date_desc');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // List of unique ingredient names with transaction count & category
  const availableBahanList = useMemo(() => {
    const map = new Map<string, { name: string; count: number; kategori: string }>();

    incomingBatches.forEach(b => {
      const name = (b.namaBahan || '').trim();
      if (name) {
        const key = name.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, { name, count: 1, kategori: b.kategori || 'Minuman' });
        }
      }
    });

    ingredients.forEach(ing => {
      const name = (ing.namaBahan || '').trim();
      if (name) {
        const key = name.toLowerCase();
        if (!map.has(key)) {
          const nLower = name.toLowerCase();
          let cat = 'Minuman';
          if (nLower.includes('cup') || nLower.includes('sedotan') || nLower.includes('lid') || nLower.includes('box') || nLower.includes('plastik') || nLower.includes('kantong') || nLower.includes('paper')) {
            cat = 'Packaging';
          } else if (nLower.includes('ayam') || nLower.includes('mie') || nLower.includes('beras') || nLower.includes('kentang') || nLower.includes('sosis') || nLower.includes('keju') || nLower.includes('roti') || nLower.includes('daging')) {
            cat = 'Makanan';
          }
          map.set(key, { name, count: 0, kategori: cat });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  }, [incomingBatches, ingredients]);

  // Check if any filter is active
  const isAnyFilterActive = useMemo(() => {
    return (
      dateFilterMode !== 'ALL' ||
      filterNamaBahan !== 'ALL' ||
      filterPayment !== 'ALL' ||
      filterCategory !== 'ALL' ||
      Boolean(searchQuery.trim())
    );
  }, [dateFilterMode, filterNamaBahan, filterPayment, filterCategory, searchQuery]);

  // Reset all filters to default
  const handleResetAllFilters = () => {
    setDateFilterMode('ALL');
    setFilterExactDate('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterNamaBahan('ALL');
    setFilterPayment('ALL');
    setFilterCategory('ALL');
    setSearchQuery('');
  };

  // Handle selecting an ingredient from the Master Bahan dropdown
  const handleSelectIngredient = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ingId = e.target.value;
    setSelectedIngredientId(ingId);

    if (ingId === 'MANUAL') {
      setFormNamaBahan('');
      setFormSatuan('gram');
      return;
    }

    const ing = ingredients.find(i => i.id === ingId);
    if (ing) {
      setFormNamaBahan(ing.namaBahan);
      
      // Attempt to auto detect category from name or default
      const nLower = ing.namaBahan.toLowerCase();
      if (nLower.includes('cup') || nLower.includes('sedotan') || nLower.includes('lid') || nLower.includes('box') || nLower.includes('plastik') || nLower.includes('kantong') || nLower.includes('paper')) {
        setFormKategori('Packaging');
      } else if (nLower.includes('ayam') || nLower.includes('mie') || nLower.includes('beras') || nLower.includes('kentang') || nLower.includes('sosis') || nLower.includes('keju') || nLower.includes('roti') || nLower.includes('daging')) {
        setFormKategori('Makanan');
      } else if (nLower.includes('kopi') || nLower.includes('susu') || nLower.includes('sirup') || nLower.includes('syrup') || nLower.includes('tea') || nLower.includes('teh') || nLower.includes('powder') || nLower.includes('creamer') || nLower.includes('gula')) {
        setFormKategori('Minuman');
      }

      // Attempt to extract numeric quantity and unit from satuanBeli
      const numIsi = parseFloat(ing.satuanBeli) || 1;
      const unitBeli = ing.satuanBeli ? ing.satuanBeli.replace(/^[0-9.\s]+/, '').trim().toLowerCase() : (ing.satuanTakaran || 'gram');
      
      setFormBerat(numIsi.toString());
      setFormSatuan(UNIT_OPTIONS.includes(unitBeli) ? unitBeli : (ing.satuanTakaran || 'gram'));
      
      if (ing.hargaBeli && ing.hargaBeli > 0) {
        setFormHarga(ing.hargaBeli.toString());
      }
    }
  };

  const handleEditClick = (batch: IncomingIngredientBatch) => {
    setEditingBatchId(batch.id);
    setFormTanggal(batch.tanggal);
    setSelectedIngredientId(batch.ingredientId || 'MANUAL');
    setFormNamaBahan(batch.namaBahan);
    setFormKategori(batch.kategori || 'Minuman');
    setFormBerat(batch.berat.toString());
    setFormSatuan(batch.satuan);
    setFormHarga(batch.harga.toString());
    setFormStatusPembayaran(batch.statusPembayaran);
    setFormSupplier(batch.supplier || '');
    setFormNomorNota(batch.nomorNota || '');
    setFormKeterangan(batch.keterangan || '');
    setIsFormOpen(true);

    setTimeout(() => {
      document.getElementById('form-barang-masuk')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancelForm = () => {
    setEditingBatchId(null);
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setSelectedIngredientId('');
    setFormNamaBahan('');
    setFormKategori('Minuman');
    setFormBerat('1000');
    setFormSatuan('gram');
    setFormHarga('');
    setFormStatusPembayaran('Lunas');
    setFormSupplier('');
    setFormNomorNota('');
    setFormKeterangan('');
    setIsFormOpen(false);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const beratNum = parseFloat(formBerat) || 0;
    const hargaNum = parseFloat(formHarga) || 0;
    const namaTrim = formNamaBahan.trim();

    if (!namaTrim) {
      alert('Mohon masukkan nama barang / bahan baku!');
      return;
    }

    if (beratNum <= 0) {
      alert('Berat atau kuantitas barang masuk harus lebih besar dari 0!');
      return;
    }

    if (hargaNum < 0) {
      alert('Harga tidak boleh negatif!');
      return;
    }

    // Auto calculate price per unit
    const calculatedHargaSatuan = beratNum > 0 ? Math.round(hargaNum / beratNum) : 0;
    const finalKategori = formKategori || 'Minuman';

    if (editingBatchId) {
      onUpdateBatch({
        id: editingBatchId,
        tanggal: formTanggal,
        ingredientId: selectedIngredientId && selectedIngredientId !== 'MANUAL' ? selectedIngredientId : undefined,
        namaBahan: namaTrim,
        kategori: finalKategori,
        berat: beratNum,
        satuan: formSatuan,
        harga: hargaNum,
        hargaSatuan: calculatedHargaSatuan,
        statusPembayaran: formStatusPembayaran,
        supplier: formSupplier.trim() || undefined,
        nomorNota: formNomorNota.trim() || undefined,
        keterangan: formKeterangan.trim() || undefined,
        createdAt: new Date().toISOString()
      });
    } else {
      onAddBatch({
        tanggal: formTanggal,
        ingredientId: selectedIngredientId && selectedIngredientId !== 'MANUAL' ? selectedIngredientId : undefined,
        namaBahan: namaTrim,
        kategori: finalKategori,
        berat: beratNum,
        satuan: formSatuan,
        harga: hargaNum,
        hargaSatuan: calculatedHargaSatuan,
        statusPembayaran: formStatusPembayaran,
        supplier: formSupplier.trim() || undefined,
        nomorNota: formNomorNota.trim() || undefined,
        keterangan: formKeterangan.trim() || undefined,
        createdAt: new Date().toISOString()
      });
    }

    handleCancelForm();
  };

  // Filtered and Sorted Batches
  const filteredBatches = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return incomingBatches
      .filter(batch => {
        // Date Filter
        if (dateFilterMode === 'TODAY') {
          if (batch.tanggal !== todayStr) return false;
        } else if (dateFilterMode === 'EXACT') {
          if (filterExactDate && batch.tanggal !== filterExactDate) return false;
        } else if (dateFilterMode === 'RANGE') {
          if (filterStartDate && batch.tanggal < filterStartDate) return false;
          if (filterEndDate && batch.tanggal > filterEndDate) return false;
        } else if (selectedMonth !== 'ALL') {
          // Month filter only applies if dateFilterMode is ALL
          if (!batch.tanggal || !batch.tanggal.startsWith(selectedMonth)) return false;
        }

        // Nama Bahan Filter
        if (filterNamaBahan !== 'ALL') {
          const target = filterNamaBahan.trim().toLowerCase();
          const batchName = (batch.namaBahan || '').trim().toLowerCase();
          const matchMaster = batch.ingredientId && ingredients.find(i => i.id === batch.ingredientId)?.namaBahan.trim().toLowerCase() === target;
          if (batchName !== target && !matchMaster) return false;
        }

        // Payment status filter
        if (filterPayment !== 'ALL' && batch.statusPembayaran !== filterPayment) return false;

        // Category filter
        if (filterCategory !== 'ALL') {
          const cat = batch.kategori || 'Minuman';
          if (cat !== filterCategory) return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = batch.namaBahan.toLowerCase().includes(q);
          const matchSup = (batch.supplier || '').toLowerCase().includes(q);
          const matchKet = (batch.keterangan || '').toLowerCase().includes(q);
          const matchNota = (batch.nomorNota || '').toLowerCase().includes(q);
          const matchCat = (batch.kategori || '').toLowerCase().includes(q);
          if (!matchName && !matchSup && !matchKet && !matchNota && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return b.tanggal.localeCompare(a.tanggal);
        if (sortBy === 'date_asc') return a.tanggal.localeCompare(b.tanggal);
        if (sortBy === 'amount_desc') return b.harga - a.harga;
        if (sortBy === 'name_asc') return a.namaBahan.localeCompare(b.namaBahan);
        return 0;
      });
  }, [
    incomingBatches, 
    dateFilterMode, 
    filterExactDate, 
    filterStartDate, 
    filterEndDate, 
    selectedMonth, 
    filterNamaBahan, 
    ingredients, 
    filterPayment, 
    filterCategory, 
    searchQuery, 
    sortBy
  ]);

  // Chart Batches for Visual Breakdown (respects active date/month filter)
  const chartBatches = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return incomingBatches.filter(b => {
      if (dateFilterMode === 'TODAY') {
        if (b.tanggal !== todayStr) return false;
      } else if (dateFilterMode === 'EXACT') {
        if (filterExactDate && b.tanggal !== filterExactDate) return false;
      } else if (dateFilterMode === 'RANGE') {
        if (filterStartDate && b.tanggal < filterStartDate) return false;
        if (filterEndDate && b.tanggal > filterEndDate) return false;
      } else if (selectedMonth !== 'ALL') {
        if (!b.tanggal || !b.tanggal.startsWith(selectedMonth)) return false;
      }
      return true;
    });
  }, [incomingBatches, dateFilterMode, filterExactDate, filterStartDate, filterEndDate, selectedMonth]);

  // Monthly/Date Category Breakdown for Chart & Stats
  const categoryStats = useMemo(() => {
    const categoryMap: Record<string, { totalNominal: number; itemCount: number; totalLunas: number; totalBelumLunas: number }> = {
      'Minuman': { totalNominal: 0, itemCount: 0, totalLunas: 0, totalBelumLunas: 0 },
      'Makanan': { totalNominal: 0, itemCount: 0, totalLunas: 0, totalBelumLunas: 0 },
      'Packaging': { totalNominal: 0, itemCount: 0, totalLunas: 0, totalBelumLunas: 0 },
      'Lain-lain': { totalNominal: 0, itemCount: 0, totalLunas: 0, totalBelumLunas: 0 }
    };

    let totalMonthNominal = 0;

    chartBatches.forEach(b => {
      const cat = b.kategori && categoryMap[b.kategori] ? b.kategori : (b.kategori || 'Minuman');
      if (!categoryMap[cat]) {
        categoryMap[cat] = { totalNominal: 0, itemCount: 0, totalLunas: 0, totalBelumLunas: 0 };
      }
      categoryMap[cat].totalNominal += b.harga;
      categoryMap[cat].itemCount += 1;
      totalMonthNominal += b.harga;

      if (b.statusPembayaran === 'Lunas') {
        categoryMap[cat].totalLunas += b.harga;
      } else {
        categoryMap[cat].totalBelumLunas += b.harga;
      }
    });

    const palette: Record<string, { fill: string; text: string; bg: string; border: string }> = {
      'Minuman': { fill: '#0284c7', text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
      'Makanan': { fill: '#d97706', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
      'Packaging': { fill: '#059669', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
      'Lain-lain': { fill: '#7c3aed', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' }
    };

    const chartData = Object.entries(categoryMap)
      .map(([name, data]) => {
        const percentage = totalMonthNominal > 0 ? ((data.totalNominal / totalMonthNominal) * 100) : 0;
        const color = palette[name] || { fill: '#64748b', text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
        return {
          name,
          total: data.totalNominal,
          count: data.itemCount,
          percentage: Number(percentage.toFixed(1)),
          totalLunas: data.totalLunas,
          totalBelumLunas: data.totalBelumLunas,
          fill: color.fill,
          textColor: color.text,
          bgColor: color.bg,
          borderColor: color.border
        };
      })
      .filter(item => item.total > 0 || item.count > 0 || ['Minuman', 'Makanan', 'Packaging'].includes(item.name))
      .sort((a, b) => b.total - a.total);

    return {
      chartData,
      totalMonthNominal,
      hasData: chartBatches.length > 0 && totalMonthNominal > 0
    };
  }, [chartBatches]);

  // Breakdown per Nama Barang / Bahan (Aggregates Total Nominal & Total Berat)
  const itemStats = useMemo(() => {
    const itemMap: Record<string, {
      namaBahan: string;
      kategori: string;
      totalNominal: number;
      totalBerat: number;
      satuan: string;
      count: number;
      totalLunas: number;
      totalBelumLunas: number;
      rataHargaSatuan: number;
    }> = {};

    let totalMonthNominal = 0;
    let totalMonthBerat = 0;

    chartBatches.forEach(b => {
      const key = (b.namaBahan || 'Tanpa Nama').trim();
      if (!itemMap[key]) {
        itemMap[key] = {
          namaBahan: key,
          kategori: b.kategori || 'Minuman',
          totalNominal: 0,
          totalBerat: 0,
          satuan: b.satuan || 'unit',
          count: 0,
          totalLunas: 0,
          totalBelumLunas: 0,
          rataHargaSatuan: 0
        };
      }

      itemMap[key].totalNominal += b.harga;
      itemMap[key].totalBerat += b.berat;
      itemMap[key].count += 1;
      totalMonthNominal += b.harga;
      totalMonthBerat += b.berat;

      if (b.statusPembayaran === 'Lunas') {
        itemMap[key].totalLunas += b.harga;
      } else {
        itemMap[key].totalBelumLunas += b.harga;
      }
    });

    // Generate distinct attractive palette colors for items
    const colorPalette = [
      '#f59e0b', '#0284c7', '#10b981', '#8b5cf6', '#ec4899', 
      '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#84cc16',
      '#e11d48', '#3b82f6', '#d97706', '#059669', '#7c3aed'
    ];

    const chartData = Object.values(itemMap)
      .map((item, idx) => {
        const percentage = totalMonthNominal > 0 ? ((item.totalNominal / totalMonthNominal) * 100) : 0;
        const avgUnit = item.totalBerat > 0 ? Math.round(item.totalNominal / item.totalBerat) : 0;
        return {
          ...item,
          name: item.namaBahan,
          total: item.totalNominal,
          berat: item.totalBerat,
          percentage: Number(percentage.toFixed(1)),
          rataHargaSatuan: avgUnit,
          fill: colorPalette[idx % colorPalette.length]
        };
      })
      .sort((a, b) => {
        if (itemChartMetric === 'kuantitas') {
          return b.berat - a.berat;
        }
        return b.total - a.total;
      });

    return {
      chartData,
      totalMonthNominal,
      totalMonthBerat,
      totalItemCount: Object.keys(itemMap).length,
      hasData: chartData.length > 0 && totalMonthNominal > 0
    };
  }, [chartBatches, itemChartMetric]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    let totalNominal = 0;
    let totalLunas = 0;
    let totalBelumLunas = 0;
    let totalItemCount = filteredBatches.length;
    const uniqueBahan = new Set<string>();

    filteredBatches.forEach(b => {
      totalNominal += b.harga;
      uniqueBahan.add(b.namaBahan.toLowerCase());
      if (b.statusPembayaran === 'Lunas') {
        totalLunas += b.harga;
      } else {
        totalBelumLunas += b.harga;
      }
    });

    return {
      totalNominal,
      totalLunas,
      totalBelumLunas,
      totalItemCount,
      uniqueBahanCount: uniqueBahan.size
    };
  }, [filteredBatches]);

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (filteredBatches.length === 0) {
      alert('Tidak ada data barang masuk untuk diekspor.');
      return;
    }

    const dataToExport = filteredBatches.map((b, idx) => ({
      'No': idx + 1,
      'Tanggal Masuk': b.tanggal,
      'Kategori': b.kategori || 'Minuman',
      'Nama Barang / Bahan': b.namaBahan,
      'Berat / Kuantitas': b.berat,
      'Satuan': b.satuan,
      'Total Harga (Rp)': b.harga,
      'Harga per Satuan (Rp)': b.hargaSatuan || Math.round(b.berat > 0 ? b.harga / b.berat : 0),
      'Status Pembayaran': b.statusPembayaran,
      'Supplier / Toko': b.supplier || '-',
      'Nomor Nota / Invoice': b.nomorNota || '-',
      'Keterangan / Catatan': b.keterangan || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Barang Masuk');
    XLSX.writeFile(wb, `Laporan_Barang_Masuk_${selectedMonth}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Helper for Payment Status Badge
  const renderStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'Lunas':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200/80">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Lunas
          </span>
        );
      case 'Belum Lunas':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200/80">
            <AlertCircle className="h-3 w-3 mr-1" />
            Belum Lunas
          </span>
        );
      case 'Tempo / Utang':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200/80">
            <Clock className="h-3 w-3 mr-1" />
            Tempo / Utang
          </span>
        );
      case 'Konsinyasi':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200/80">
            Konsinyasi
          </span>
        );
      case 'Gratis / Sample':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200/80">
            Gratis / Sample
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div id="sec-barang-masuk" className="space-y-6 scroll-mt-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-xs">
              <PackagePlus className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-base md:text-lg font-black uppercase tracking-wider text-slate-900">
                  Modul Pencatatan Barang / Bahan Masuk
                </h3>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[10px] rounded-full uppercase">
                  Bulan Ini
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Pencatatan pembelian & stok masuk cafe terintegrasi langsung dengan database Master Bahan Baku resep.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isFormOpen && editingBatchId) {
                  handleCancelForm();
                } else {
                  setIsFormOpen(!isFormOpen);
                }
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs ${
                isFormOpen 
                  ? 'bg-slate-800 text-white hover:bg-slate-700' 
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-extrabold'
              }`}
            >
              <Plus className={`h-4 w-4 transition-transform ${isFormOpen ? 'rotate-45' : ''}`} />
              <span>{isFormOpen ? 'Tutup Form' : 'Input Barang Masuk'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              title="Download Excel Laporan Barang Masuk"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
            >
              <span>{isMinimized ? 'Perluas' : 'Minimize'}</span>
              {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Input / Edit Form (Collapsible) */}
            {isFormOpen && (
              <form 
                id="form-barang-masuk" 
                onSubmit={handleSubmitForm}
                className="p-5 md:p-6 bg-amber-50/40 rounded-2xl border border-amber-200 shadow-2xs space-y-5 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-amber-200 text-amber-900 rounded-lg">
                      <Tag className="h-4 w-4" />
                    </span>
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                      {editingBatchId ? 'Edit Catatan Barang Masuk' : 'Form Input Barang / Bahan Masuk Baru'}
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    Terintegrasi Bahan Baku
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Field 1: Tanggal Masuk */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Tanggal Masuk *
                    </label>
                    <input
                      type="date"
                      value={formTanggal}
                      onChange={(e) => setFormTanggal(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  {/* Field 2: Pemilihan Master Bahan Baku */}
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Pilih Dari Bahan Baku Resep *</span>
                      <span className="text-[10px] text-amber-800 lowercase font-semibold">
                        ({ingredients.length} bahan terdaftar)
                      </span>
                    </label>
                    <select
                      value={selectedIngredientId}
                      onChange={handleSelectIngredient}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- Pilih Barang / Bahan Baku Tersedia --</option>
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.id}>
                          {ing.namaBahan} (Standar: {ing.satuanBeli} @ {formatRupiah(ing.hargaBeli)})
                        </option>
                      ))}
                      <option value="MANUAL">➕ Input Bahan Baku Lain / Manual</option>
                    </select>
                  </div>

                  {/* Field 3: Status Pembayaran */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Status Pembayaran *
                    </label>
                    <select
                      value={formStatusPembayaran}
                      onChange={(e) => setFormStatusPembayaran(e.target.value as PaymentStatus)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Lunas">✅ Lunas (Cash / Transfer)</option>
                      <option value="Belum Lunas">❌ Belum Lunas</option>
                      <option value="Tempo / Utang">⏳ Tempo / Utang Supplier</option>
                      <option value="Konsinyasi">🤝 Konsinyasi</option>
                      <option value="Gratis / Sample">🎁 Gratis / Sample Promo</option>
                    </select>
                  </div>

                  {/* Field 4: Nama Bahan & Kategori */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Nama Barang / Bahan Baku *
                    </label>
                    <input
                      type="text"
                      value={formNamaBahan}
                      onChange={(e) => setFormNamaBahan(e.target.value)}
                      placeholder="Contoh: Susu Fresh Milk Diamond, Sirup Karamel, Cup 16oz..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  {/* Field 4b: Kategori Barang */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Kategori Barang *</span>
                      <span className="text-[10px] text-slate-400 font-normal">Untuk grafik bulanan</span>
                    </label>
                    <select
                      value={formKategori}
                      onChange={(e) => setFormKategori(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="Minuman">☕ Minuman (Kopi, Sirup, Powder, Susu)</option>
                      <option value="Makanan">🥪 Makanan (Beras, Roti, Ayam, Mie, Saus)</option>
                      <option value="Packaging">📦 Packaging (Cup, Sedotan, Box, Lid, Plastik)</option>
                      <option value="Lain-lain">✨ Lain-lain (Cleaning, Logistik, Gas)</option>
                    </select>
                  </div>

                  {/* Field 5: Berat / Kuantitas & Satuan */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Berat / Kuantitas *
                    </label>
                    <div className="flex space-x-1.5">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={formBerat}
                        onChange={(e) => setFormBerat(e.target.value)}
                        placeholder="1000"
                        className="w-2/3 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />
                      <select
                        value={formSatuan}
                        onChange={(e) => setFormSatuan(e.target.value)}
                        className="w-1/3 px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Field 6: Total Harga Beli (Rp) */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Total Harga (Rp) *</span>
                      {parseFloat(formBerat) > 0 && parseFloat(formHarga) > 0 && (
                        <span className="text-[10px] text-emerald-700 font-mono font-bold">
                          @{formatRupiah(Math.round(parseFloat(formHarga) / parseFloat(formBerat)))}/{formSatuan}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        value={formHarga}
                        onChange={(e) => setFormHarga(e.target.value)}
                        placeholder="Contoh: 18000"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Field 7: Supplier / Toko */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Supplier / Toko (Opsional)
                    </label>
                    <input
                      type="text"
                      value={formSupplier}
                      onChange={(e) => setFormSupplier(e.target.value)}
                      placeholder="Contoh: Toko Kopi Sejahtera, Tokopedia..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Field 8: Nomor Nota / Invoice */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Nomor Nota / Invoice (Opsional)
                    </label>
                    <input
                      type="text"
                      value={formNomorNota}
                      onChange={(e) => setFormNomorNota(e.target.value)}
                      placeholder="Contoh: INV-2026/06/001"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Field 9: Keterangan / Catatan */}
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Keterangan / Catatan Pembayaran
                    </label>
                    <input
                      type="text"
                      value={formKeterangan}
                      onChange={(e) => setFormKeterangan(e.target.value)}
                      placeholder="Contoh: Jatuh tempo tgl 25, restock mingguan bar..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs"
                  >
                    {editingBatchId ? 'Simpan Perubahan' : 'Tambahkan Barang Masuk'}
                  </button>
                </div>
              </form>
            )}

            {/* Filter and Overview Controls */}
            <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5 shadow-2xs">
              
              {/* Row 1: Primary Selectors (Periode Bulan, Filter Tanggal, Filter Nama Bahan) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
                
                {/* 1. Periode Bulan */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1 flex items-center space-x-1">
                    <Calendar className="h-3 w-3 text-amber-600" />
                    <span>Periode Bulan</span>
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => onChangeSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Semua Periode ({incomingBatches.length} Entri)</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>
                        Bulan {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Filter Tanggal (Mode) */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-indigo-600" />
                      <span>Filter Tanggal</span>
                    </span>
                    {dateFilterMode !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDateFilterMode('ALL');
                          setFilterExactDate('');
                          setFilterStartDate('');
                          setFilterEndDate('');
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                      >
                        Reset Tanggal
                      </button>
                    )}
                  </label>
                  <select
                    value={dateFilterMode}
                    onChange={(e) => {
                      const mode = e.target.value as 'ALL' | 'TODAY' | 'EXACT' | 'RANGE';
                      setDateFilterMode(mode);
                      const todayStr = new Date().toISOString().split('T')[0];
                      if (mode === 'EXACT' && !filterExactDate) {
                        setFilterExactDate(todayStr);
                      } else if (mode === 'RANGE') {
                        if (!filterStartDate) setFilterStartDate(todayStr);
                        if (!filterEndDate) setFilterEndDate(todayStr);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Semua Tanggal</option>
                    <option value="TODAY">📅 Hari Ini</option>
                    <option value="EXACT">🎯 Tanggal Spesifik</option>
                    <option value="RANGE">↔️ Rentang Tanggal</option>
                  </select>
                </div>

                {/* 3. Filter Nama Bahan */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Package className="h-3 w-3 text-emerald-600" />
                      <span>Filter Nama Bahan</span>
                    </span>
                    {filterNamaBahan !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setFilterNamaBahan('ALL')}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                      >
                        Reset Bahan
                      </button>
                    )}
                  </label>
                  <select
                    value={filterNamaBahan}
                    onChange={(e) => setFilterNamaBahan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs truncate"
                  >
                    <option value="ALL">Semua Bahan ({availableBahanList.length} jenis bahan tersedia)</option>
                    {availableBahanList.map(b => (
                      <option key={b.name} value={b.name}>
                        {b.name} ({b.count}x masuk • {b.kategori})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 1b: Tanggal Input Controls when EXACT or RANGE is active */}
              {(dateFilterMode === 'EXACT' || dateFilterMode === 'RANGE') && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 flex flex-wrap items-center gap-3">
                  {dateFilterMode === 'EXACT' ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-700">Pilih Tanggal Masuk:</span>
                      <input
                        type="date"
                        value={filterExactDate}
                        onChange={(e) => setFilterExactDate(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-slate-700">Dari Tanggal:</span>
                        <input
                          type="date"
                          value={filterStartDate}
                          onChange={(e) => setFilterStartDate(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-slate-700">Sampai:</span>
                        <input
                          type="date"
                          value={filterEndDate}
                          onChange={(e) => setFilterEndDate(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setDateFilterMode('ALL');
                      setFilterExactDate('');
                      setFilterStartDate('');
                      setFilterEndDate('');
                    }}
                    className="text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1 ml-auto"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Hapus Filter Tanggal</span>
                  </button>
                </div>
              )}

              {/* Row 2: Secondary Controls (Status Pembayaran, Kategori, Search, Sort) */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Status Pembayaran Filter */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Status:</span>
                    <select
                      value={filterPayment}
                      onChange={(e) => setFilterPayment(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="Lunas">Lunas</option>
                      <option value="Belum Lunas">Belum Lunas</option>
                      <option value="Tempo / Utang">Tempo / Utang</option>
                      <option value="Konsinyasi">Konsinyasi</option>
                      <option value="Gratis / Sample">Gratis / Sample</option>
                    </select>
                  </div>

                  {/* Kategori Filter */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Kategori:</span>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                    >
                      <option value="ALL">Semua Kategori</option>
                      <option value="Minuman">☕ Minuman</option>
                      <option value="Makanan">🥪 Makanan</option>
                      <option value="Packaging">📦 Packaging</option>
                      <option value="Lain-lain">✨ Lain-lain</option>
                    </select>
                  </div>
                </div>

                {/* Search and Sort */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Search */}
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nota, toko, catatan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 w-full sm:w-44 md:w-52"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="date_desc">📅 Tanggal Terbaru</option>
                    <option value="date_asc">📅 Tanggal Terlama</option>
                    <option value="amount_desc">💰 Nominal Terbesar</option>
                    <option value="name_asc">🔤 Nama A - Z</option>
                  </select>
                </div>
              </div>

              {/* Active Filters Badges & Quick Reset Button */}
              {isAnyFilterActive && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 text-xs text-slate-600">
                  <span className="font-black text-[10px] uppercase tracking-wider text-slate-500">Filter Aktif:</span>
                  
                  {/* Date Filter Badge */}
                  {dateFilterMode !== 'ALL' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      <span>
                        {dateFilterMode === 'TODAY' && 'Tanggal: Hari Ini'}
                        {dateFilterMode === 'EXACT' && `Tanggal: ${filterExactDate || '-'}`}
                        {dateFilterMode === 'RANGE' && `Rentang: ${filterStartDate || '...'} s/d ${filterEndDate || '...'}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDateFilterMode('ALL');
                          setFilterExactDate('');
                          setFilterStartDate('');
                          setFilterEndDate('');
                        }}
                        className="ml-1 hover:text-indigo-950 cursor-pointer"
                        title="Hapus filter tanggal"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {/* Nama Bahan Badge */}
                  {filterNamaBahan !== 'ALL' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span>Bahan: {filterNamaBahan}</span>
                      <button
                        type="button"
                        onClick={() => setFilterNamaBahan('ALL')}
                        className="ml-1 hover:text-emerald-950 cursor-pointer"
                        title="Hapus filter bahan"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {/* Payment Status Badge */}
                  {filterPayment !== 'ALL' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <span>Status: {filterPayment}</span>
                      <button
                        type="button"
                        onClick={() => setFilterPayment('ALL')}
                        className="ml-1 hover:text-amber-950 cursor-pointer"
                        title="Hapus filter status"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {/* Category Badge */}
                  {filterCategory !== 'ALL' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                      <span>Kategori: {filterCategory}</span>
                      <button
                        type="button"
                        onClick={() => setFilterCategory('ALL')}
                        className="ml-1 hover:text-sky-950 cursor-pointer"
                        title="Hapus filter kategori"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {/* Search Query Badge */}
                  {searchQuery && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      <span>Pencarian: "{searchQuery}"</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="ml-1 hover:text-slate-950 cursor-pointer"
                        title="Hapus pencarian"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {/* Reset All Button */}
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="ml-auto text-[11px] font-black text-rose-600 hover:text-rose-700 flex items-center space-x-1 cursor-pointer bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset Semua ({filteredBatches.length} hasil)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Metrics Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Total Pembelian */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xs relative overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Total Nilai Barang Masuk
                </span>
                <p className="text-xl font-black text-amber-400 font-mono">
                  {formatRupiah(summaryStats.totalNominal)}
                </p>
                <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-400 font-medium">
                  <span>{summaryStats.totalItemCount} transaksi masuk</span>
                  <span>•</span>
                  <span>{summaryStats.uniqueBahanCount} jenis bahan</span>
                </div>
              </div>

              {/* Card 2: Total Lunas */}
              <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 block mb-1">
                  Total Terbayar (Lunas)
                </span>
                <p className="text-xl font-black text-emerald-950 font-mono">
                  {formatRupiah(summaryStats.totalLunas)}
                </p>
                <span className="text-[10.5px] text-emerald-700 font-semibold block mt-1">
                  {summaryStats.totalNominal > 0 
                    ? `${((summaryStats.totalLunas / summaryStats.totalNominal) * 100).toFixed(1)}% dari total pembelian` 
                    : '100%'}
                </span>
              </div>

              {/* Card 3: Tagihan / Tempo / Belum Lunas */}
              <div className="bg-rose-50 border border-rose-200/80 p-4 rounded-2xl shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-800 block mb-1">
                  Tagihan Belum Lunas / Tempo
                </span>
                <p className="text-xl font-black text-rose-950 font-mono">
                  {formatRupiah(summaryStats.totalBelumLunas)}
                </p>
                <span className="text-[10.5px] text-rose-700 font-semibold block mt-1">
                  Kewajiban pelunasan supplier
                </span>
              </div>

              {/* Card 4: Kesiapan Master Bahan Baku */}
              <div className="bg-blue-50 border border-blue-200/80 p-4 rounded-2xl shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-900 block mb-1">
                  Integrasi Bahan Baku
                </span>
                <p className="text-xl font-black text-blue-950 font-mono">
                  {ingredients.length} Bahan Resep
                </p>
                <span className="text-[10.5px] text-blue-700 font-semibold block mt-1">
                  Otomatis terhubung resep COGS
                </span>
              </div>
            </div>

            {/* Monthly Analytics Chart (Per Nama Barang / Bahan & Per Kategori) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>{chartDimension === 'item' ? 'Grafik Belanja per Nama Barang' : 'Grafik Belanja per Kategori'}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
                        {selectedMonth === 'ALL' ? 'Semua Periode' : `Bulan ${selectedMonth}`}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {chartDimension === 'item'
                        ? 'Otomatis terkalkulasi akumulasi total nominal (Rp) dan berat / kuantitas per barang dalam bulan ini'
                        : 'Distribusi alokasi nominal belanja barang / bahan baku bulanan per kategori'}
                    </p>
                  </div>
                </div>

                {/* Control Toggles: Dimension (Nama Barang vs Kategori), Metric (Nominal vs Berat), and Chart Type (Bar vs Pie) */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Dimension Switcher */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setChartDimension('item')}
                      className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        chartDimension === 'item'
                          ? 'bg-amber-500 text-slate-950 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Package className="h-3.5 w-3.5" />
                      <span>Per Nama Barang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartDimension('category')}
                      className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        chartDimension === 'category'
                          ? 'bg-amber-500 text-slate-950 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>Per Kategori</span>
                    </button>
                  </div>

                  {/* Metric Switcher (Only in 'item' mode) */}
                  {chartDimension === 'item' && (
                    <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setItemChartMetric('nominal')}
                        className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                          itemChartMetric === 'nominal'
                            ? 'bg-white text-slate-900 shadow-2xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Total Nominal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemChartMetric('kuantitas')}
                        className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                          itemChartMetric === 'kuantitas'
                            ? 'bg-white text-slate-900 shadow-2xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Scale className="h-3.5 w-3.5 text-sky-600" />
                        <span>Total Berat / Qty</span>
                      </button>
                    </div>
                  )}

                  {/* Chart Type Switcher: Bar Chart vs Pie Chart */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setChartType('bar')}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        chartType === 'bar'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Diagram Batang"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('pie')}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        chartType === 'pie'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Proporsi (Pie)"
                    >
                      <PieChartIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {!(chartDimension === 'item' ? itemStats.hasData : categoryStats.hasData) ? (
                <div className="py-10 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <BarChart3 className="h-9 w-9 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">Belum ada data barang masuk pada periode bulan ini.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Catat barang masuk terlebih dahulu atau pilih periode bulan lain.</p>
                </div>
              ) : chartDimension === 'item' ? (
                /* === VIEW 1: DIAGRAM SESUAI TOTAL DAN NAMA BARANG BULAN TERSEBUT === */
                <div className="space-y-6">
                  {/* Top Key Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Total Nominal Bulan Ini</span>
                      <span className="text-base sm:text-lg font-black font-mono text-amber-950 block mt-0.5">
                        {formatRupiah(itemStats.totalMonthNominal)}
                      </span>
                      <span className="text-[10.5px] text-amber-700 font-medium">Akumulasi pengeluaran bahan</span>
                    </div>
                    <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl">
                      <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">Total Berat / Kuantitas</span>
                      <span className="text-base sm:text-lg font-black font-mono text-sky-950 block mt-0.5">
                        {itemStats.totalMonthBerat.toLocaleString('id-ID')} unit/satuan
                      </span>
                      <span className="text-[10.5px] text-sky-700 font-medium">Volume stok masuk</span>
                    </div>
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Varian Barang Masuk</span>
                      <span className="text-base sm:text-lg font-black font-mono text-emerald-950 block mt-0.5">
                        {itemStats.totalItemCount} Nama Barang
                      </span>
                      <span className="text-[10.5px] text-emerald-700 font-medium">Bahan aktif terbeli</span>
                    </div>
                    <div className="p-3 bg-slate-900 text-white rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Barang Belanja Terbesar</span>
                      <span className="text-sm sm:text-base font-black text-amber-400 truncate block mt-0.5" title={itemStats.chartData[0]?.name}>
                        {itemStats.chartData[0]?.name || '-'}
                      </span>
                      <span className="text-[10.5px] text-slate-300 font-mono font-medium">
                        {itemStats.chartData[0] ? formatRupiah(itemStats.chartData[0].total) : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Chart and Ranked Table Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Left: Recharts Graphic */}
                    <div className="lg:col-span-7 h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'bar' ? (
                          <BarChart
                            data={itemStats.chartData}
                            margin={{ top: 15, right: 20, left: 10, bottom: 40 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fontSize: 10, fontWeight: 600, fill: '#475569' }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickLine={false}
                              interval={0}
                              angle={-25}
                              textAnchor="end"
                              height={55}
                            />
                            <YAxis 
                              tick={{ fontSize: 10, fill: '#64748b' }}
                              tickFormatter={(v) => {
                                if (itemChartMetric === 'nominal') {
                                  return `Rp${(v / 1000).toLocaleString('id-ID')}k`;
                                }
                                return `${v.toLocaleString('id-ID')}`;
                              }}
                              axisLine={false}
                              tickLine={false}
                              width={75}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs z-50 min-w-56">
                                      <div className="flex items-center space-x-2 font-bold mb-1 pb-1 border-b border-slate-700">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.fill }} />
                                        <span className="font-extrabold text-sm">{data.name}</span>
                                      </div>
                                      <div className="space-y-1 mt-1">
                                        <div className="flex justify-between items-center">
                                          <span className="text-slate-400">Total Nominal:</span>
                                          <span className="text-amber-400 font-mono font-black">{formatRupiah(data.total)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-slate-400">Total Berat/Volume:</span>
                                          <span className="text-sky-400 font-mono font-bold">{data.berat.toLocaleString('id-ID')} {data.satuan}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px]">
                                          <span className="text-slate-400">Harga Rata-rata/Unit:</span>
                                          <span className="text-white font-mono font-semibold">{formatRupiah(data.rataHargaSatuan)}/{data.satuan}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800">
                                          <span className="text-slate-400">Porsi Pengeluaran:</span>
                                          <span className="text-emerald-400 font-bold">{data.percentage}% ({data.count}x beli)</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar 
                              dataKey={itemChartMetric === 'nominal' ? 'total' : 'berat'} 
                              radius={[6, 6, 0, 0]}
                              maxBarSize={45}
                            >
                              {itemStats.chartData.map((entry, index) => (
                                <Cell key={`item-bar-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        ) : (
                          <PieChart>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs z-50">
                                      <div className="flex items-center space-x-2 font-bold mb-1 pb-1 border-b border-slate-700">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.fill }} />
                                        <span>{data.name}</span>
                                      </div>
                                      <div className="text-amber-400 font-mono font-black text-sm">
                                        {formatRupiah(data.total)}
                                      </div>
                                      <div className="text-sky-300 font-mono text-[11px] mt-0.5">
                                        {data.berat.toLocaleString('id-ID')} {data.satuan} • {data.percentage}%
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend 
                              formatter={(value) => <span className="text-[11px] font-semibold text-slate-700 truncate inline-block max-w-36">{value}</span>} 
                            />
                            <Pie
                              data={itemStats.chartData}
                              dataKey={itemChartMetric === 'nominal' ? 'total' : 'berat'}
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={2}
                            >
                              {itemStats.chartData.map((entry, index) => (
                                <Cell key={`item-pie-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    {/* Right: Detailed Breakdown List per Nama Barang */}
                    <div className="lg:col-span-5 space-y-2 max-h-72 overflow-y-auto pr-1">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex justify-between items-center">
                        <span>Rincian Barang & Total Otomatis</span>
                        <span>{itemStats.chartData.length} Barang</span>
                      </div>
                      {itemStats.chartData.map((item) => (
                        <div 
                          key={item.name} 
                          className="p-2.5 bg-slate-50 hover:bg-amber-50/40 border border-slate-200/80 rounded-xl transition flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 truncate">
                                {item.name}
                              </p>
                              <div className="flex items-center space-x-2 text-[10.5px] text-slate-500 mt-0.5">
                                <span className="font-mono text-sky-700 font-bold bg-sky-50 px-1 rounded">
                                  {item.berat.toLocaleString('id-ID')} {item.satuan}
                                </span>
                                <span>•</span>
                                <span>{item.count}x beli</span>
                                <span>•</span>
                                <span className="text-[10px] text-slate-400">~{formatRupiah(item.rataHargaSatuan)}/{item.satuan}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-black font-mono text-slate-900 block">
                              {formatRupiah(item.total)}
                            </span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded-full inline-block mt-0.5">
                              {item.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* === VIEW 2: DIAGRAM PER KATEGORI (MINUMAN, MAKANAN, PACKAGING) === */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  
                  {/* Left / Center: Interactive Recharts Visualization */}
                  <div className="lg:col-span-7 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'bar' ? (
                        <BarChart
                          data={categoryStats.chartData}
                          margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 11, fontWeight: 600, fill: '#475569' }}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            tickFormatter={(v) => `Rp${(v / 1000).toLocaleString('id-ID')}k`}
                            axisLine={false}
                            tickLine={false}
                            width={75}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs z-50">
                                    <div className="flex items-center space-x-2 font-bold mb-1 pb-1 border-b border-slate-700">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.fill }} />
                                      <span>Kategori: {data.name}</span>
                                    </div>
                                    <div className="text-amber-400 font-mono font-black text-sm">
                                      {formatRupiah(data.total)}
                                    </div>
                                    <div className="text-slate-300 text-[11px] mt-1 space-y-0.5">
                                      <div>Porsi: <span className="font-bold text-white">{data.percentage}%</span> dari total belanja</div>
                                      <div>Jumlah Entri: <span className="font-bold text-white">{data.count} transaksi</span></div>
                                      <div>Sudah Lunas: <span className="text-emerald-400 font-mono font-bold">{formatRupiah(data.totalLunas)}</span></div>
                                      {data.totalBelumLunas > 0 && (
                                        <div>Belum Lunas: <span className="text-rose-400 font-mono font-bold">{formatRupiah(data.totalBelumLunas)}</span></div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="total" 
                            radius={[6, 6, 0, 0]}
                            maxBarSize={55}
                          >
                            {categoryStats.chartData.map((entry, index) => (
                              <Cell key={`bar-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : (
                        <PieChart>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs z-50">
                                    <div className="flex items-center space-x-2 font-bold mb-1 pb-1 border-b border-slate-700">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.fill }} />
                                      <span>{data.name}</span>
                                    </div>
                                    <div className="text-amber-400 font-mono font-black text-sm">
                                      {formatRupiah(data.total)}
                                    </div>
                                    <div className="text-slate-300 text-[11px] mt-0.5">
                                      {data.percentage}% • {data.count} transaksi
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend 
                            formatter={(value) => <span className="text-xs font-semibold text-slate-700">{value}</span>} 
                          />
                          <Pie
                            data={categoryStats.chartData}
                            dataKey="total"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {categoryStats.chartData.map((entry, index) => (
                              <Cell key={`pie-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Right: Category Metric Details */}
                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {categoryStats.chartData.map(cat => (
                      <div 
                        key={cat.name} 
                        className={`p-3 rounded-xl border ${cat.borderColor} ${cat.bgColor} flex flex-col justify-between transition hover:shadow-xs`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.fill }} />
                            <span className="text-xs font-black text-slate-900">{cat.name}</span>
                          </div>
                          <span className={`text-[11px] font-black ${cat.textColor} bg-white/80 px-1.5 py-0.5 rounded border border-slate-200/50`}>
                            {cat.percentage}%
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="text-sm font-black font-mono text-slate-900">
                            {formatRupiah(cat.total)}
                          </div>
                          <div className="text-[10.5px] text-slate-500 flex items-center justify-between mt-1">
                            <span>{cat.count} transaksi</span>
                            {cat.totalBelumLunas > 0 ? (
                              <span className="text-rose-600 font-bold">Utang: {formatRupiah(cat.totalBelumLunas)}</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">100% Lunas</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Total Summary Footer */}
                    <div className="sm:col-span-2 p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        Total Belanja Periode {selectedMonth === 'ALL' ? 'Semua' : selectedMonth}:
                      </span>
                      <span className="font-mono font-black text-amber-400 text-sm">
                        {formatRupiah(categoryStats.totalMonthNominal)}
                      </span>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    <th className="py-3 px-3.5 text-center w-12">No</th>
                    <th className="py-3 px-3.5">Tanggal</th>
                    <th className="py-3 px-3.5">Nama Barang / Bahan</th>
                    <th className="py-3 px-3.5 text-right">Berat / Volume</th>
                    <th className="py-3 px-3.5 text-right">Harga Beli</th>
                    <th className="py-3 px-3.5 text-right">Harga / Unit</th>
                    <th className="py-3 px-3.5 text-center">Status Pembayaran</th>
                    <th className="py-3 px-3.5">Supplier & No. Nota</th>
                    <th className="py-3 px-3.5">Keterangan</th>
                    <th className="py-3 px-3.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        <PackagePlus className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-600">
                          {isAnyFilterActive 
                            ? 'Tidak ada catatan barang masuk yang cocok dengan filter yang dipilih.' 
                            : 'Belum ada catatan barang masuk pada periode ini.'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {isAnyFilterActive ? (
                            <button
                              type="button"
                              onClick={handleResetAllFilters}
                              className="text-amber-700 font-bold underline hover:text-amber-800 cursor-pointer"
                            >
                              Klik di sini untuk mereset semua filter
                            </button>
                          ) : (
                            <>Klik tombol <strong>"Input Barang Masuk"</strong> di atas untuk menambahkan bahan yang masuk.</>
                          )}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((batch, index) => {
                      const hargaUnit = batch.hargaSatuan || Math.round(batch.berat > 0 ? batch.harga / batch.berat : 0);
                      const isLinkedToMaster = Boolean(batch.ingredientId);

                      return (
                        <tr key={batch.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                            {index + 1}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-slate-900">
                            <button
                              type="button"
                              onClick={() => {
                                setDateFilterMode('EXACT');
                                setFilterExactDate(batch.tanggal);
                              }}
                              title={`Klik untuk filter tanggal ${batch.tanggal}`}
                              className="hover:text-amber-700 hover:underline cursor-pointer text-left"
                            >
                              {batch.tanggal}
                            </button>
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex items-center space-x-2">
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setFilterNamaBahan(batch.namaBahan)}
                                    title={`Klik untuk filter bahan ${batch.namaBahan}`}
                                    className="font-extrabold text-slate-900 block text-xs hover:text-amber-700 hover:underline text-left cursor-pointer transition"
                                  >
                                    {batch.namaBahan}
                                  </button>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                    batch.kategori === 'Minuman'
                                      ? 'bg-sky-100 text-sky-800'
                                      : batch.kategori === 'Makanan'
                                      ? 'bg-amber-100 text-amber-800'
                                      : batch.kategori === 'Packaging'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {batch.kategori || 'Minuman'}
                                  </span>
                                </div>
                                {isLinkedToMaster ? (
                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded uppercase">
                                    Master Resep
                                  </span>
                                ) : (
                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[9px] font-bold rounded uppercase">
                                    Manual
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {batch.berat.toLocaleString('id-ID')} <span className="text-[10px] text-slate-500 font-sans">{batch.satuan}</span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-black text-slate-950 whitespace-nowrap">
                            {formatRupiah(batch.harga)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {formatRupiah(hargaUnit)} <span className="text-[9.5px] text-slate-400">/{batch.satuan}</span>
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            {renderStatusBadge(batch.statusPembayaran)}
                          </td>
                          <td className="py-3 px-3.5 text-xs text-slate-700">
                            <div className="font-semibold text-slate-900">{batch.supplier || '-'}</div>
                            {batch.nomorNota && (
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                #{batch.nomorNota}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-xs text-slate-600 max-w-xs truncate">
                            {batch.keterangan || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleEditClick(batch)}
                                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                                title="Edit Barang Masuk"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Hapus catatan barang masuk "${batch.namaBahan}" tanggal ${batch.tanggal}?`)) {
                                    onDeleteBatch(batch.id);
                                  }
                                }}
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                                title="Hapus Barang Masuk"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
