import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  ClipboardList, 
  Boxes, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  DollarSign, 
  Save, 
  Calendar, 
  RefreshCw,
  PackageCheck,
  TrendingDown,
  Info,
  X,
  Zap,
  Layers,
  Utensils,
  BarChart3,
  Cloud,
  Check
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Transaction } from '../types';
import { 
  fetchStockOpnameFromSheet, 
  fetchAllStockOpnameReportsFromSheet,
  saveStockOpnameToSheet, 
  fetchIngredientsFromSheet, 
  saveIngredientsToSheet 
} from '../sheetsService';

export interface StockItemMaster {
  id: string;
  namaBahan: string;
  kategori: 'Minuman' | 'Makanan' | 'Packaging' | 'Lain-lain';
  satuan: string; // e.g. gram, ml, pcs, kg, liter, pack
  hargaSatuan: number; // Harga per 1 unit satuan (Rp/gram, Rp/ml, Rp/pcs)
  satuanBeli?: string;
  hargaBeli?: number;
}

export interface StockOpnameEntry {
  itemId: string;
  stokAwal: number; // Stok awal bulan
  stokMasuk: number; // Pembelian / masuk bulan ini
  terpakai: number; // Bahan Terpakai (Auto kalkulasi / Manual)
  sisaDiBar: number; // Sisa Bahan di Bar (Opname Fisik)
  wasteLoss: number; // Bahan Waste / Loss
  catatanLoss?: string; // Keterangan penyebab loss/waste
  isAutoTerpakai?: boolean; // Tag jika terpakai diisi dari penjualan otomatis
}

export interface MonthlyStockOpnameReport {
  id: string;
  periodeBulan: string; // YYYY-MM, e.g. "2026-07"
  namaPeriode: string; // e.g. "Juli 2026"
  tanggalOpname: string; // e.g. "2026-07-29"
  petugasOpname: string;
  status: 'Draft' | 'Finalized';
  entries: Record<string, StockOpnameEntry>; // itemId -> entry
}

// Interfaces matching CogsDailySalesPage recipes & sales
export interface RecipeIngredient {
  id: string;
  namaBahan: string;
  hargaBeli: number;
  satuanBeli: string;
  takaranPerCup: number;
  satuanTakaran: string;
}

export interface MenuRecipeIngredient {
  ingredientId: string;
  takaran: number;
}

export interface MenuItem {
  id: string;
  nama: string;
  kategori: string;
  hargaJual: number;
  hpp: number;
  defaultJatah: number;
  recipe?: MenuRecipeIngredient[];
}

export interface DailyMenuItemSale {
  menuId: string;
  nama: string;
  kategori: string;
  hargaJual: number;
  hpp: number;
  jatah: number;     // Jatah porsi harian
  terjual: number;   // Terjual
}

export interface DailySalesRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  cups: number;
  omset: number;
  hppTotal: number;
  notes?: string;
  menuSales?: DailyMenuItemSale[];
}

interface StockOpnamePageProps {
  transactions?: Transaction[];
  spreadsheetId?: string | null;
  token?: string | null;
}

const DEFAULT_COGS_INGREDIENTS: RecipeIngredient[] = [
  { id: 'ing-1', namaBahan: 'Biji Kopi Espresso Blend', hargaBeli: 200000, satuanBeli: '1000 gram', takaranPerCup: 18, satuanTakaran: 'gram' },
  { id: 'ing-2', namaBahan: 'Susu Fresh Milk / UHT', hargaBeli: 18000, satuanBeli: '1000 ml', takaranPerCup: 120, satuanTakaran: 'ml' },
  { id: 'ing-3', namaBahan: 'Sirup Aren Organik', hargaBeli: 35000, satuanBeli: '1000 ml', takaranPerCup: 25, satuanTakaran: 'ml' },
  { id: 'ing-4', namaBahan: 'Kemasan Cup, Lid & Straw', hargaBeli: 150000, satuanBeli: '100 pcs', takaranPerCup: 1, satuanTakaran: 'pcs' },
  { id: 'ing-5', namaBahan: 'Es Batu & Filter Water', hargaBeli: 20000, satuanBeli: '50 cup', takaranPerCup: 1, satuanTakaran: 'cup' },
];

export default function StockOpnamePage({ transactions = [], spreadsheetId, token }: StockOpnamePageProps) {
  // Current Month State (YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [petugas, setPetugas] = useState<string>('Barista Leader');

  // State for Cogs Ingredients directly synced from Kalkulator HPP & Recipe Costing
  const [cogsIngredients, setCogsIngredients] = useState<RecipeIngredient[]>(() => {
    const saved = localStorage.getItem('aruskas_cogs_ingredients');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_COGS_INGREDIENTS;
  });

  // State for Menu Catalog (Resep Menu)
  const [menuCatalog, setMenuCatalog] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('aruskas_cogs_page_menu_catalog');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  // State for Daily Sales Records
  const [dailySales, setDailySales] = useState<DailySalesRecord[]>(() => {
    const saved = localStorage.getItem('aruskas_cogs_page_daily_sales');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  // Auto Refresh/Listen to LocalStorage changes or sync from Kalkulator HPP
  useEffect(() => {
    const syncFromLocalStorage = () => {
      const savedIng = localStorage.getItem('aruskas_cogs_ingredients');
      if (savedIng) {
        try {
          const parsed = JSON.parse(savedIng);
          if (Array.isArray(parsed)) setCogsIngredients(parsed);
        } catch (e) { /* ignore */ }
      }

      const savedCat = localStorage.getItem('aruskas_cogs_page_menu_catalog');
      if (savedCat) {
        try {
          const parsed = JSON.parse(savedCat);
          if (Array.isArray(parsed)) setMenuCatalog(parsed);
        } catch (e) { /* ignore */ }
      }

      const savedSales = localStorage.getItem('aruskas_cogs_page_daily_sales');
      if (savedSales) {
        try {
          const parsed = JSON.parse(savedSales);
          if (Array.isArray(parsed)) setDailySales(parsed);
        } catch (e) { /* ignore */ }
      }
    };

    syncFromLocalStorage();
    window.addEventListener('storage', syncFromLocalStorage);
    return () => window.removeEventListener('storage', syncFromLocalStorage);
  }, []);

  // Convert RecipeIngredients into StockItemMaster list
  const masterItems: StockItemMaster[] = useMemo(() => {
    return cogsIngredients.map(ing => {
      let numSatuanBeli = parseFloat(ing.satuanBeli) || 1;
      const rawUnitBeli = (ing.satuanBeli || '').replace(/^[0-9.\s]+/, '').trim().toLowerCase();
      const rawUnitTakaran = (ing.satuanTakaran || '').trim().toLowerCase();

      // Unit Conversions
      if ((rawUnitBeli === 'liter' || rawUnitBeli === 'l') && (rawUnitTakaran === 'ml' || rawUnitTakaran === 'mili')) {
        numSatuanBeli = numSatuanBeli * 1000;
      } else if ((rawUnitBeli === 'kg' || rawUnitBeli === 'kilogram') && (rawUnitTakaran === 'gram' || rawUnitTakaran === 'gr' || rawUnitTakaran === 'g')) {
        numSatuanBeli = numSatuanBeli * 1000;
      } else if (rawUnitBeli === 'pack' && rawUnitTakaran === 'pcs') {
        if (numSatuanBeli === 1) numSatuanBeli = 100;
      }

      const hargaSatuan = (ing.hargaBeli || 0) / (numSatuanBeli || 1);

      // Category detection
      let kategori: 'Minuman' | 'Makanan' | 'Packaging' | 'Lain-lain' = 'Minuman';
      const nameLower = ing.namaBahan.toLowerCase();
      if (nameLower.includes('cup') || nameLower.includes('lid') || nameLower.includes('straw') || nameLower.includes('sedotan') || nameLower.includes('plastik') || nameLower.includes('paperbag') || nameLower.includes('kemasan')) {
        kategori = 'Packaging';
      } else if (nameLower.includes('ayam') || nameLower.includes('beras') || nameLower.includes('daging') || nameLower.includes('kentang') || nameLower.includes('roti') || nameLower.includes('mie') || nameLower.includes('keju')) {
        kategori = 'Makanan';
      } else if (nameLower.includes('sabun') || nameLower.includes('tissue') || nameLower.includes('gas')) {
        kategori = 'Lain-lain';
      }

      return {
        id: ing.id,
        namaBahan: ing.namaBahan,
        kategori,
        satuan: ing.satuanTakaran || 'gram',
        hargaSatuan,
        satuanBeli: ing.satuanBeli,
        hargaBeli: ing.hargaBeli
      };
    });
  }, [cogsIngredients]);

  // AUTOMATIC CALCULATION OF BAHAN TERPAKAI BASED ON MONTHLY SALES (Terjual + Jatah)
  // Usage Map: ingredientId -> { totalQuantity, totalPortions, breakdown: [{ menuNama, portions, amount }] }
  const monthlyRecipeUsageMap = useMemo(() => {
    const usage: Record<string, { 
      totalQuantity: number; 
      totalPortions: number; 
      breakdown: { menuNama: string; portions: number; totalAmount: number }[] 
    }> = {};

    // Filter sales for the selected month (YYYY-MM)
    const monthSalesRecords = dailySales.filter(rec => rec.tanggal && rec.tanggal.startsWith(selectedMonth));

    monthSalesRecords.forEach(rec => {
      if (!rec.menuSales) return;

      rec.menuSales.forEach(sale => {
        const totalPorsi = (sale.terjual || 0) + (sale.jatah || 0); // TERJUAL + JATAH BARISTA
        if (totalPorsi <= 0) return;

        // Find recipe for this menu in catalog
        const menu = menuCatalog.find(m => m.id === sale.menuId || m.nama.toLowerCase().trim() === sale.nama.toLowerCase().trim());
        if (menu && menu.recipe && menu.recipe.length > 0) {
          menu.recipe.forEach(recItem => {
            const ingId = recItem.ingredientId;
            const amountUsed = totalPorsi * (recItem.takaran || 0);

            if (!usage[ingId]) {
              usage[ingId] = { totalQuantity: 0, totalPortions: 0, breakdown: [] };
            }

            usage[ingId].totalQuantity += amountUsed;
            usage[ingId].totalPortions += totalPorsi;

            let bd = usage[ingId].breakdown.find(b => b.menuNama === sale.nama);
            if (!bd) {
              bd = { menuNama: sale.nama, portions: 0, totalAmount: 0 };
              usage[ingId].breakdown.push(bd);
            }
            bd.portions += totalPorsi;
            bd.totalAmount += amountUsed;
          });
        }
      });
    });

    return usage;
  }, [selectedMonth, dailySales, menuCatalog]);

  // Total cups sold + jatah in selected month
  const monthTotalCups = useMemo(() => {
    const monthSalesRecords = dailySales.filter(rec => rec.tanggal && rec.tanggal.startsWith(selectedMonth));
    let cups = 0;
    monthSalesRecords.forEach(rec => {
      if (rec.menuSales) {
        rec.menuSales.forEach(s => {
          cups += (s.terjual || 0) + (s.jatah || 0);
        });
      } else {
        cups += rec.cups || 0;
      }
    });
    return cups;
  }, [selectedMonth, dailySales]);

  // Current Opname Entries for the selected month: Record<itemId, StockOpnameEntry>
  const [opnameEntries, setOpnameEntries] = useState<Record<string, StockOpnameEntry>>({});

  // Saved Reports History Key
  const [reportsHistory, setReportsHistory] = useState<MonthlyStockOpnameReport[]>(() => {
    const saved = localStorage.getItem('basco_opname_reports_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const syncTimeoutRef = useRef<any>(null);

  // Dedicated Cloud Loader: Pulls both full history and active month opname from Google Sheets
  const loadCloudOpname = useCallback(async () => {
    if (!spreadsheetId || !token) return;
    setIsSyncingSheet(true);
    try {
      // 1. Sync remote ingredients
      const remoteIngs = await fetchIngredientsFromSheet(spreadsheetId, token);
      if (remoteIngs && remoteIngs.length > 0) {
        setCogsIngredients(remoteIngs);
        localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(remoteIngs));
      }

      // 2. Sync all reports history from Google Sheets
      const allOpnameData = await fetchAllStockOpnameReportsFromSheet(spreadsheetId, token);
      if (allOpnameData && allOpnameData.reports.length > 0) {
        setReportsHistory(allOpnameData.reports);
        localStorage.setItem('basco_opname_reports_history', JSON.stringify(allOpnameData.reports));
      }

      // 3. Sync specific month opname data
      const remoteData = await fetchStockOpnameFromSheet(spreadsheetId, selectedMonth, token);
      if (remoteData && remoteData.entries && Object.keys(remoteData.entries).length > 0) {
        if (remoteData.petugas) {
          setPetugas(remoteData.petugas);
        }
        setOpnameEntries(prev => {
          const merged = { ...prev, ...remoteData.entries };
          localStorage.setItem(`basco_opname_draft_${selectedMonth}`, JSON.stringify(merged));
          return merged;
        });
      }
      setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error fetching cloud opname:', err);
    } finally {
      setIsSyncingSheet(false);
    }
  }, [spreadsheetId, token, selectedMonth]);

  // Cloud Sync Handler
  const syncOpnameToCloud = useCallback(async (
    entriesToSync = opnameEntries,
    items = masterItems
  ) => {
    if (!spreadsheetId || !token) return;
    setIsSyncingSheet(true);
    try {
      await saveStockOpnameToSheet(spreadsheetId, selectedMonth, entriesToSync, items, petugas || 'Barista Leader', token);
      setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error syncing Stock Opname to Google Sheets:', err);
    } finally {
      setIsSyncingSheet(false);
    }
  }, [spreadsheetId, token, selectedMonth, opnameEntries, masterItems, petugas]);

  // Load entries whenever selectedMonth or masterItems changes, and pull from Google Sheets if connected
  useEffect(() => {
    const savedDraft = localStorage.getItem(`basco_opname_draft_${selectedMonth}`);
    const savedReport = localStorage.getItem(`basco_opname_report_${selectedMonth}`);
    let existingEntries: Record<string, StockOpnameEntry> = {};

    if (savedDraft) {
      try {
        existingEntries = JSON.parse(savedDraft);
      } catch (e) { /* ignore */ }
    } else if (savedReport) {
      try {
        const parsed = JSON.parse(savedReport);
        existingEntries = parsed.entries || {};
        if (parsed.petugasOpname) setPetugas(parsed.petugasOpname);
      } catch (e) { /* ignore */ }
    }

    const updatedEntries: Record<string, StockOpnameEntry> = { ...existingEntries };

    masterItems.forEach(item => {
      const autoCalculatedUsage = monthlyRecipeUsageMap[item.id]?.totalQuantity || 0;
      const existing = updatedEntries[item.id];

      if (!existing) {
        // Initialize new item entry with clean defaults
        const autoUsage = autoCalculatedUsage > 0 ? autoCalculatedUsage : 0;
        updatedEntries[item.id] = {
          itemId: item.id,
          stokAwal: 0,
          stokMasuk: 0,
          terpakai: autoUsage,
          sisaDiBar: 0,
          wasteLoss: 0,
          catatanLoss: '',
          isAutoTerpakai: autoCalculatedUsage > 0
        };
      }
    });

    setOpnameEntries(updatedEntries);

    // If connected to Google Sheets, pull remote opname for this month & all history
    if (spreadsheetId && token) {
      loadCloudOpname();
    }
  }, [selectedMonth, masterItems, spreadsheetId, token, loadCloudOpname]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('Semua');

  // Breakdown detail modal state
  const [selectedBreakdownItem, setSelectedBreakdownItem] = useState<{
    namaBahan: string;
    satuan: string;
    data: { totalQuantity: number; totalPortions: number; breakdown: { menuNama: string; portions: number; totalAmount: number }[] };
  } | null>(null);

  // Modal Master Item State
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingMasterItem, setEditingMasterItem] = useState<StockItemMaster | null>(null);
  const [formNamaBahan, setFormNamaBahan] = useState('');
  const [formSatuan, setFormSatuan] = useState('gram');
  const [formHargaBeli, setFormHargaBeli] = useState('');
  const [formSatuanBeli, setFormSatuanBeli] = useState('1000 gram');

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Smart & Bidirectional calculate field values when user updates Stok Awal / Masuk / Terpakai / Sisa di Bar / Waste Loss
  const handleEntryChange = (
    itemId: string, 
    field: keyof StockOpnameEntry, 
    value: string | number,
    _autoCalculateLoss = true
  ) => {
    setOpnameEntries(prev => {
      const current = prev[itemId] || {
        itemId,
        stokAwal: 0,
        stokMasuk: 0,
        terpakai: 0,
        sisaDiBar: 0,
        wasteLoss: 0,
        catatanLoss: ''
      };

      const numVal = typeof value === 'number' ? value : (parseFloat(value) || 0);

      const updated = {
        ...current,
        [field]: field === 'catatanLoss' ? value : Math.max(0, numVal),
        ...(field === 'terpakai' ? { isAutoTerpakai: false } : {})
      };

      const totalAvail = (updated.stokAwal || 0) + (updated.stokMasuk || 0);

      if (field === 'wasteLoss') {
        // User directly input Waste / Loss -> Auto calculate Sisa di Bar
        const calculatedSisa = totalAvail - (updated.terpakai || 0) - (updated.wasteLoss || 0);
        updated.sisaDiBar = Math.max(0, calculatedSisa);
      } else if (field === 'sisaDiBar') {
        // User directly input Sisa di Bar -> Auto calculate Waste / Loss
        const calculatedLoss = totalAvail - (updated.terpakai || 0) - (updated.sisaDiBar || 0);
        updated.wasteLoss = Math.max(0, calculatedLoss);
      } else if (field === 'stokAwal' || field === 'stokMasuk' || field === 'terpakai') {
        // Changing stock available or usage -> adjust waste/loss or sisa di bar
        if (updated.sisaDiBar > 0) {
          updated.wasteLoss = Math.max(0, totalAvail - (updated.terpakai || 0) - updated.sisaDiBar);
        } else if (updated.wasteLoss > 0) {
          updated.sisaDiBar = Math.max(0, totalAvail - (updated.terpakai || 0) - updated.wasteLoss);
        } else {
          updated.sisaDiBar = Math.max(0, totalAvail - (updated.terpakai || 0));
          updated.wasteLoss = 0;
        }
      }

      const next = {
        ...prev,
        [itemId]: updated
      };

      localStorage.setItem(`basco_opname_draft_${selectedMonth}`, JSON.stringify(next));

      // Realtime debounced auto-sync to Google Sheets
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        if (spreadsheetId && token) {
          saveStockOpnameToSheet(spreadsheetId, selectedMonth, next, masterItems, token)
            .then(() => {
              setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            })
            .catch(e => console.error("Cloud sync error:", e));
        }
      }, 1000);

      return next;
    });
  };

  // Sync / Apply all automatic calculated usage values from monthly sales + jatah
  const handleApplyAllAutoUsage = () => {
    setOpnameEntries(prev => {
      const next = { ...prev };
      let countApplied = 0;

      masterItems.forEach(item => {
        const autoUsage = monthlyRecipeUsageMap[item.id]?.totalQuantity || 0;
        if (autoUsage > 0) {
          const current = next[item.id] || {
            itemId: item.id,
            stokAwal: 0,
            stokMasuk: 0,
            terpakai: 0,
            sisaDiBar: 0,
            wasteLoss: 0,
            catatanLoss: ''
          };

          const totalAvail = (current.stokAwal || 0) + (current.stokMasuk || 0);
          const wasteLoss = Math.max(0, totalAvail - autoUsage - (current.sisaDiBar || 0));

          next[item.id] = {
            ...current,
            terpakai: autoUsage,
            wasteLoss,
            isAutoTerpakai: true
          };
          countApplied++;
        }
      });

      if (countApplied === 0) {
        alert(`Tidak ada kalkulasi resep dari penjualan untuk periode ${selectedMonth}. Pastikan Anda telah menginput Penjualan Harian dan Resep Menu di Kalkulator HPP.`);
      } else {
        localStorage.setItem(`basco_opname_draft_${selectedMonth}`, JSON.stringify(next));
        if (spreadsheetId && token) {
          setIsSyncingSheet(true);
          saveStockOpnameToSheet(spreadsheetId, selectedMonth, next, masterItems, token)
            .then(() => {
              setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            })
            .catch(e => console.error("Cloud sync error:", e))
            .finally(() => setIsSyncingSheet(false));
        }
        alert(`✅ Berhasil menyinkronkan ${countApplied} bahan terpakai otomatis & tersimpan realtime ke Google Sheets!`);
      }

      return next;
    });
  };

  // Filtered Master Items
  const filteredItems = useMemo(() => {
    return masterItems.filter(item => {
      const matchSearch = item.namaBahan.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategory === 'Semua' || item.kategori === filterCategory;
      return matchSearch && matchCat;
    });
  }, [masterItems, searchTerm, filterCategory]);

  // Overall Calculations
  const summaryCalculations = useMemo(() => {
    let totalNominalTerpakai = 0;
    let totalNominalSisaBar = 0;
    let totalNominalWasteLoss = 0;
    let totalItemLossCount = 0;

    masterItems.forEach(item => {
      const entry = opnameEntries[item.id] || {
        itemId: item.id,
        stokAwal: 0,
        stokMasuk: 0,
        terpakai: 0,
        sisaDiBar: 0,
        wasteLoss: 0
      };

      const harga = item.hargaSatuan || 0;
      totalNominalTerpakai += (entry.terpakai || 0) * harga;
      totalNominalSisaBar += (entry.sisaDiBar || 0) * harga;
      totalNominalWasteLoss += (entry.wasteLoss || 0) * harga;

      if ((entry.wasteLoss || 0) > 0) {
        totalItemLossCount++;
      }
    });

    const totalTerhitung = totalNominalTerpakai + totalNominalWasteLoss;
    const lossPercentage = totalTerhitung > 0 ? (totalNominalWasteLoss / totalTerhitung) * 100 : 0;

    return {
      totalNominalTerpakai,
      totalNominalSisaBar,
      totalNominalWasteLoss,
      totalItemLossCount,
      lossPercentage
    };
  }, [masterItems, opnameEntries]);

  // Category-based Chart Data Calculation for Bar Chart Visualization
  const categoryChartData = useMemo(() => {
    const categories: ('Minuman' | 'Makanan' | 'Packaging' | 'Lain-lain')[] = ['Minuman', 'Makanan', 'Packaging', 'Lain-lain'];
    
    return categories.map(cat => {
      let terpakai = 0;
      let sisaBar = 0;
      let wasteLoss = 0;

      masterItems.forEach(item => {
        if (item.kategori === cat) {
          const entry = opnameEntries[item.id] || {
            terpakai: 0,
            sisaDiBar: 0,
            wasteLoss: 0
          };
          const harga = item.hargaSatuan || 0;
          terpakai += (entry.terpakai || 0) * harga;
          sisaBar += (entry.sisaDiBar || 0) * harga;
          wasteLoss += (entry.wasteLoss || 0) * harga;
        }
      });

      return {
        kategori: cat,
        'Bahan Terpakai': Math.round(terpakai),
        'Sisa Bahan (Bar)': Math.round(sisaBar),
        'Bahan Waste / Loss': Math.round(wasteLoss)
      };
    });
  }, [masterItems, opnameEntries]);

  // Save current report
  const handleSaveOpnameReport = async () => {
    const reportDate = new Date().toISOString().split('T')[0];
    
    // Format Month name in Indonesian
    const [year, monthNum] = selectedMonth.split('-');
    const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const monthName = dateObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

    setIsSavingReport(true);
    try {
      const newReport: MonthlyStockOpnameReport = {
        id: `opname-${selectedMonth}-${Date.now()}`,
        periodeBulan: selectedMonth,
        namaPeriode: monthName,
        tanggalOpname: reportDate,
        petugasOpname: petugas || 'Barista Leader',
        status: 'Finalized',
        entries: opnameEntries
      };

      localStorage.setItem(`basco_opname_report_${selectedMonth}`, JSON.stringify(newReport));
      localStorage.setItem(`basco_opname_draft_${selectedMonth}`, JSON.stringify(opnameEntries));

      // Update History List
      setReportsHistory(prev => {
        const filtered = prev.filter(r => r.periodeBulan !== selectedMonth);
        const nextList = [newReport, ...filtered];
        localStorage.setItem('basco_opname_reports_history', JSON.stringify(nextList));
        return nextList;
      });

      if (spreadsheetId && token) {
        setIsSyncingSheet(true);
        const success = await saveStockOpnameToSheet(
          spreadsheetId, 
          selectedMonth, 
          opnameEntries, 
          masterItems, 
          petugas || 'Barista Leader', 
          token
        );
        setIsSyncingSheet(false);

        if (success) {
          const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          setLastSyncTime(nowTime);
          // Refresh reports history from sheet to guarantee data match
          const allOpnameData = await fetchAllStockOpnameReportsFromSheet(spreadsheetId, token);
          if (allOpnameData && allOpnameData.reports.length > 0) {
            setReportsHistory(allOpnameData.reports);
            localStorage.setItem('basco_opname_reports_history', JSON.stringify(allOpnameData.reports));
          }
          alert(`✅ Sukses! Data Form Stok Opname Bulan ${monthName} (${masterItems.length} bahan baku) berhasil disimpan & terinput langsung ke Google Sheets (Tab 'Laporan Stok Opname')!`);
        } else {
          alert(`⚠️ Data berhasil disimpan di penyimpanan lokal, namun gagal terinput ke Google Sheets. Silakan pastikan akun terhubung dan memiliki izin edit.`);
        }
      } else {
        alert(`✅ Data Laporan Stok Opname Bulan ${monthName} berhasil disimpan di penyimpanan aplikasi lokal.`);
      }
    } catch (e: any) {
      console.error("Save opname error:", e);
      alert(`❌ Terjadi kesalahan saat menyimpan laporan: ${e?.message || 'Error tidak diketahui'}`);
    } finally {
      setIsSavingReport(false);
      setIsSyncingSheet(false);
    }
  };

  // Helper to save Cogs Ingredients both to state and LocalStorage + Google Sheets
  const saveCogsIngredientsBoth = (updatedList: RecipeIngredient[]) => {
    setCogsIngredients(updatedList);
    localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(updatedList));
    if (spreadsheetId && token) {
      saveIngredientsToSheet(spreadsheetId, updatedList, token).catch(e => console.error("Sync ingredients error:", e));
    }
  };

  // Master Item Add/Edit Handlers
  const handleOpenAddItemModal = () => {
    setEditingMasterItem(null);
    setFormNamaBahan('');
    setFormSatuan('gram');
    setFormHargaBeli('200000');
    setFormSatuanBeli('1000 gram');
    setShowItemModal(true);
  };

  const handleOpenEditItemModal = (item: StockItemMaster) => {
    const existingIng = cogsIngredients.find(i => i.id === item.id);
    setEditingMasterItem(item);
    setFormNamaBahan(item.namaBahan);
    setFormSatuan(item.satuan);
    setFormHargaBeli(existingIng ? existingIng.hargaBeli.toString() : (item.hargaBeli || Math.round(item.hargaSatuan * 1000)).toString());
    setFormSatuanBeli(existingIng ? existingIng.satuanBeli : (item.satuanBeli || `1000 ${item.satuan}`));
    setShowItemModal(true);
  };

  const handleSaveMasterItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaBahan.trim()) {
      alert('Nama bahan baku tidak boleh kosong!');
      return;
    }

    const hargaBeliNum = parseFloat(formHargaBeli) || 0;

    if (editingMasterItem) {
      // Edit
      const updatedIngs = cogsIngredients.map(ing => ing.id === editingMasterItem.id ? {
        ...ing,
        namaBahan: formNamaBahan.trim(),
        hargaBeli: hargaBeliNum,
        satuanBeli: formSatuanBeli.trim(),
        satuanTakaran: formSatuan.trim()
      } : ing);
      saveCogsIngredientsBoth(updatedIngs);
    } else {
      // Create new ingredient integrated with Kalkulator HPP & Recipe Costing
      const newIng: RecipeIngredient = {
        id: `ing-${Date.now()}`,
        namaBahan: formNamaBahan.trim(),
        hargaBeli: hargaBeliNum,
        satuanBeli: formSatuanBeli.trim(),
        takaranPerCup: 1,
        satuanTakaran: formSatuan.trim()
      };
      saveCogsIngredientsBoth([...cogsIngredients, newIng]);
    }

    setShowItemModal(false);
  };

  const handleDeleteMasterItem = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus bahan baku ini dari master list & Kalkulator HPP?')) {
      const updatedIngs = cogsIngredients.filter(i => i.id !== id);
      saveCogsIngredientsBoth(updatedIngs);

      setOpnameEntries(prev => {
        const next = { ...prev };
        delete next[id];
        localStorage.setItem(`basco_opname_draft_${selectedMonth}`, JSON.stringify(next));
        return next;
      });
    }
  };

  // Download Excel Template for Stok Opname
  const handleDownloadTemplateExcel = () => {
    const rows = masterItems.map(item => {
      const entry = opnameEntries[item.id] || {
        stokAwal: 0,
        stokMasuk: 0,
        terpakai: 0,
        sisaDiBar: 0,
        wasteLoss: 0,
        catatanLoss: ''
      };

      const autoUsage = monthlyRecipeUsageMap[item.id]?.totalQuantity || 0;

      return {
        'ID Bahan': item.id,
        'Nama Bahan Baku': item.namaBahan,
        'Kategori': item.kategori,
        'Satuan': item.satuan,
        'Harga per Satuan (Rp)': Math.round(item.hargaSatuan),
        'Stok Awal Bulan': entry.stokAwal,
        'Pembelian / Masuk': entry.stokMasuk,
        'Bahan Terpakai (Resep & Terjual)': entry.terpakai,
        'Kalkulasi Otomatis Penjualan': autoUsage,
        'Sisa Bahan di Bar': entry.sisaDiBar,
        'Bahan Waste / Loss': entry.wasteLoss,
        'Catatan / Penyebab Loss': entry.catatanLoss || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 12 }, // ID
      { wch: 32 }, // Nama
      { wch: 15 }, // Kategori
      { wch: 12 }, // Satuan
      { wch: 20 }, // Harga
      { wch: 18 }, // Stok Awal
      { wch: 18 }, // Masuk
      { wch: 28 }, // Terpakai
      { wch: 25 }, // Auto Calc
      { wch: 20 }, // Sisa Bar
      { wch: 20 }, // Waste/Loss
      { wch: 35 }  // Catatan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok Opname Bulanan');

    // Instruction Sheet
    const infoRows = [
      { 'PETUNJUK APLIKASI STOK OPNAME BULANAN': '1. Isikan data persediaan bahan baku untuk periode ' + selectedMonth },
      { 'PETUNJUK APLIKASI STOK OPNAME BULANAN': '2. Kolom Bahan Terpakai: terkalkulasi otomatis dari Penjualan Terjual + Jatah Barista x Resep Menu' },
      { 'PETUNJUK APLIKASI STOK OPNAME BULANAN': '3. Kolom Sisa Bahan di Bar: hasil perhitungan fisik / opname akhir bulan di area bar/dapur' },
      { 'PETUNJUK APLIKASI STOK OPNAME BULANAN': '4. Kolom Bahan Waste / Loss: jumlah bahan rusak, tumpah, expired, atau selisih hilang' },
      { 'PETUNJUK APLIKASI STOK OPNAME BULANAN': '5. Simpan file Excel dan upload ke aplikasi untuk sinkronisasi otomatis' }
    ];
    const infoSheet = XLSX.utils.json_to_sheet(infoRows);
    infoSheet['!cols'] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, infoSheet, 'Panduan');

    XLSX.writeFile(workbook, `Template_Stok_Opname_Bulanan_${selectedMonth}.xlsx`);
  };

  // Upload Excel Handler
  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rows || rows.length === 0) {
          alert('File Excel kosong atau tidak sesuai template.');
          return;
        }

        const nextEntries = { ...opnameEntries };
        let countImported = 0;

        rows.forEach((row: any) => {
          const idRaw = row['ID Bahan'] || row['ID'] || row['id'];
          const namaRaw = row['Nama Bahan Baku'] || row['Nama Bahan'] || row['Nama'] || row['nama'];

          let item = masterItems.find(m => idRaw && m.id === String(idRaw).trim());
          if (!item && namaRaw) {
            item = masterItems.find(m => m.namaBahan.toLowerCase().trim() === String(namaRaw).toLowerCase().trim());
          }

          if (item) {
            const stokAwal = parseFloat(String(row['Stok Awal Bulan'] ?? row['Stok Awal'] ?? 0)) || 0;
            const stokMasuk = parseFloat(String(row['Pembelian / Masuk'] ?? row['Stok Masuk'] ?? row['Masuk'] ?? 0)) || 0;
            const terpakai = parseFloat(String(row['Bahan Terpakai (Resep & Terjual)'] ?? row['Bahan Terpakai'] ?? row['Terpakai'] ?? 0)) || 0;
            const sisaDiBar = parseFloat(String(row['Sisa Bahan di Bar'] ?? row['Sisa Bar'] ?? row['Sisa'] ?? 0)) || 0;
            
            let wasteLoss = parseFloat(String(row['Bahan Waste / Loss'] ?? row['Waste'] ?? row['Loss'] ?? -1));
            if (isNaN(wasteLoss) || wasteLoss < 0) {
              wasteLoss = Math.max(0, (stokAwal + stokMasuk) - terpakai - sisaDiBar);
            }

            const catatanLoss = String(row['Catatan / Penyebab Loss'] ?? row['Catatan'] ?? row['Keterangan'] ?? '').trim();

            nextEntries[item.id] = {
              itemId: item.id,
              stokAwal,
              stokMasuk,
              terpakai,
              sisaDiBar,
              wasteLoss,
              catatanLoss,
              isAutoTerpakai: false
            };
            countImported++;
          }
        });

        if (countImported === 0) {
          alert('Tidak ada bahan baku yang berhasil dicocokkan dari Excel.');
          return;
        }

        setOpnameEntries(nextEntries);
        localStorage.setItem(`basco_opname_draft_${selectedMonth}`, JSON.stringify(nextEntries));

        if (spreadsheetId && token) {
          setIsSyncingSheet(true);
          saveStockOpnameToSheet(spreadsheetId, selectedMonth, nextEntries, masterItems, token)
            .then(() => {
              setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            })
            .catch(e => console.error("Cloud sync error:", e))
            .finally(() => setIsSyncingSheet(false));
        }

        alert(`✅ Sukses mengimpor ${countImported} item data stok opname dari file Excel & tersimpan otomatis ke Google Sheets!`);

      } catch (err) {
        console.error('Error Excel import:', err);
        alert('Gagal membaca file Excel. Pastikan format file .xlsx / .xls valid.');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-amber-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-widest mb-1">
              <ClipboardList className="h-4 w-4" />
              <span>Modul Terintegrasi Manajemen Persediaan & Stock Audit</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Form Stok Opname Bulanan
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Terhubung otomatis dengan <strong className="text-amber-300">Kalkulator HPP & Recipe Costing</strong>.
              Nilai <strong className="text-amber-300">Bahan Terpakai</strong> dikalkulasi otomatis dari total porsi <strong className="text-amber-300">Penjualan Terjual + Jatah Barista</strong> selama 1 bulan.
            </p>
          </div>

          {/* Month Selector, Controls & Cloud Realtime Sync Pill */}
          <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            {spreadsheetId && (
              <div className="flex items-center space-x-2 bg-emerald-950/70 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs">
                <Cloud className={`h-4 w-4 ${isSyncingSheet ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
                <div>
                  <span className="text-[9.5px] font-bold text-emerald-300 uppercase block tracking-wider">
                    {isSyncingSheet ? 'Menyinkronkan...' : 'Realtime Cloud'}
                  </span>
                  <span className="text-[9px] text-emerald-400/80">
                    {lastSyncTime ? `Sinkron ${lastSyncTime}` : 'Terintegrasi Sheets'}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[9.5px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                Periode Opname
              </label>
              <div className="flex items-center space-x-2 bg-slate-900/90 text-white px-3 py-1.5 rounded-xl border border-amber-500/30 text-xs font-mono font-bold">
                <Calendar className="h-4 w-4 text-amber-400 shrink-0" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-white focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                Petugas / Auditor
              </label>
              <input
                type="text"
                value={petugas}
                onChange={(e) => setPetugas(e.target.value)}
                placeholder="Nama Barista Leader"
                className="bg-slate-900/90 text-white px-3 py-1.5 rounded-xl border border-amber-500/30 text-xs font-semibold focus:outline-none w-36"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Integration Info Callout */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-amber-500 text-slate-900 rounded-xl shrink-0 mt-0.5">
            <Zap className="h-5 w-5 font-black" />
          </div>
          <div>
            <span className="font-extrabold text-amber-950 text-xs uppercase tracking-wide block">
              Otomatisasi Resep & Penjualan Harian
            </span>
            <p className="text-[11.5px] text-amber-900 font-medium mt-0.5 leading-relaxed">
              Bahan baku terhubung dengan master list Kalkulator HPP ({masterItems.length} bahan baku). Total pemakaian bulan <span className="font-bold">{selectedMonth}</span> dikalkulasikan dari <span className="font-bold text-amber-950">{monthTotalCups} porsi (terjual + jatah barista)</span>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApplyAllAutoUsage}
          className="px-4 py-2 bg-amber-900 hover:bg-amber-950 text-amber-300 font-black rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center space-x-1.5 shrink-0"
        >
          <RefreshCw className="h-4 w-4 text-amber-400" />
          <span>Sync Bahan Terpakai dari Penjualan</span>
        </button>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Bahan Terpakai */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Bahan Terpakai</span>
              <h3 className="text-lg font-black text-slate-900 mt-1 font-mono">
                {formatRupiah(summaryCalculations.totalNominalTerpakai)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10.5px] text-slate-500 font-medium mt-3">
            Akumulasi nilai HPP bahan baku terpakai resep ({monthTotalCups} porsi)
          </p>
        </div>

        {/* Sisa Bahan di Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sisa Bahan di Bar (Fisik)</span>
              <h3 className="text-lg font-black text-indigo-950 mt-1 font-mono">
                {formatRupiah(summaryCalculations.totalNominalSisaBar)}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10.5px] text-slate-500 font-medium mt-3">
            Nilai fisik aset stok tersisa yang siap pakai di area bar/dapur
          </p>
        </div>

        {/* Bahan Waste / Loss */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/30 to-white shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Bahan Waste & Loss</span>
              <h3 className="text-lg font-black text-red-650 mt-1 font-mono">
                {formatRupiah(summaryCalculations.totalNominalWasteLoss)}
              </h3>
            </div>
            <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-bold text-amber-900 mt-3">
            <span>Rasio Loss: {summaryCalculations.lossPercentage.toFixed(1)}%</span>
            <span>{summaryCalculations.totalItemLossCount} Item Terdeteksi</span>
          </div>
        </div>

        {/* Action Button Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simpan & Audit</span>
            <p className="text-[11px] font-semibold text-slate-700 mt-1">
              Simpan laporan opname periode <span className="font-bold text-amber-800">{selectedMonth}</span>
            </p>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleSaveOpnameReport}
              disabled={isSavingReport || isSyncingSheet}
              className="flex-1 py-2 px-3 bg-amber-900 hover:bg-amber-950 disabled:bg-amber-900/50 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
            >
              {isSavingReport ? (
                <>
                  <RefreshCw className="h-4 w-4 text-amber-400 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 text-amber-400" />
                  <span>Simpan ke Sheets</span>
                </>
              )}
            </button>

            {spreadsheetId && (
              <button
                type="button"
                onClick={loadCloudOpname}
                disabled={isSyncingSheet || isSavingReport}
                className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs transition cursor-pointer"
                title="Tarik data terbaru dari Google Sheets"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncingSheet ? 'animate-spin text-amber-600' : ''}`} />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Excel Upload & Download Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-emerald-700 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <span className="font-black text-emerald-950 text-xs uppercase tracking-wide block">
              Integrasi Excel Stok Opname Bulanan
            </span>
            <p className="text-[11.5px] text-emerald-850 font-medium mt-0.5 leading-relaxed">
              Download template Excel berisi master bahan baku & kalkulasi otomatis penjualan, catat fisik sisa di bar secara offline, lalu upload file untuk sinkronkan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
          <button
            type="button"
            onClick={handleDownloadTemplateExcel}
            className="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-extrabold rounded-xl text-xs transition cursor-pointer shadow-2xs flex items-center space-x-1.5"
            title="Download template Excel stok opname"
          >
            <Download className="h-4 w-4 text-emerald-700" />
            <span>Download Template Excel</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleUploadExcel}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center space-x-1.5"
            title="Upload data Excel stok opname"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Excel Opname</span>
          </button>
        </div>
      </div>

      {/* Kartu Ringkasan Stok Opname Bulanan (Otomatis berdasarkan Data Input) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Ringkasan Stok Opname Bulanan
            </span>
            <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
              Kalkulasi Otomatis Live
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Periode: <strong className="text-slate-800">{selectedMonth}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Kartu 1: Total Nilai Bahan Terpakai */}
          <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs bg-gradient-to-b from-emerald-50/20 to-white flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Total Nilai Bahan Terpakai
                </span>
                <h3 className="text-xl font-black text-emerald-950 mt-1 font-mono">
                  {formatRupiah(summaryCalculations.totalNominalTerpakai)}
                </h3>
              </div>
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <PackageCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10.5px] font-medium text-emerald-900 mt-3 border-t border-emerald-100 pt-2">
              <span>HPP Terpakai Resep</span>
              <span className="font-mono font-bold">{monthTotalCups} porsi</span>
            </div>
          </div>

          {/* Kartu 2: Total Sisa Bahan */}
          <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-xs bg-gradient-to-b from-indigo-50/20 to-white flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                  Total Sisa Bahan (di Bar)
                </span>
                <h3 className="text-xl font-black text-indigo-950 mt-1 font-mono">
                  {formatRupiah(summaryCalculations.totalNominalSisaBar)}
                </h3>
              </div>
              <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-xl">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10.5px] font-medium text-indigo-900 mt-3 border-t border-indigo-100 pt-2">
              <span>Nilai Aset Stok Fisik</span>
              <span className="font-bold">Bar & Dapur</span>
            </div>
          </div>

          {/* Kartu 3: Total Nilai Waste / Loss */}
          <div className="bg-white p-4 rounded-2xl border border-red-200/80 shadow-xs bg-gradient-to-b from-red-50/20 to-white flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block">
                  Total Nilai Waste / Loss
                </span>
                <h3 className="text-xl font-black text-red-700 mt-1 font-mono">
                  {formatRupiah(summaryCalculations.totalNominalWasteLoss)}
                </h3>
              </div>
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10.5px] font-bold text-red-900 mt-3 border-t border-red-100 pt-2">
              <span>Rasio Loss: {summaryCalculations.lossPercentage.toFixed(1)}%</span>
              <span>{summaryCalculations.totalItemLossCount} Item Terdeteksi</span>
            </div>
          </div>

        </div>
      </div>

      {/* Visualisasi Grafik Batang Perbandingan Stok Per Kategori */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Grafik Perbandingan Stok Per Kategori (Bulanan)
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Visualisasi nominal (Rp) Bahan Terpakai, Sisa Bahan di Bar, dan Waste/Loss per Kategori
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            <span>Periode:</span>
            <span className="text-indigo-900 font-extrabold">{selectedMonth}</span>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categoryChartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="kategori" 
                tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value;
                }}
                tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, '']}
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  borderColor: '#334155', 
                  borderRadius: '12px', 
                  color: '#fff',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' 
                }}
                itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                labelStyle={{ color: '#fbbf24', fontWeight: 800, marginBottom: '4px' }}
              />
              <Legend 
                verticalAlign="top" 
                align="right"
                wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontWeight: 700 }}
              />
              <Bar 
                dataKey="Bahan Terpakai" 
                fill="#10b981" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={45} 
              />
              <Bar 
                dataKey="Sisa Bahan (Bar)" 
                fill="#6366f1" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={45} 
              />
              <Bar 
                dataKey="Bahan Waste / Loss" 
                fill="#ef4444" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={45} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Stock Opname Form Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-950 text-amber-400 rounded-xl">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Tabel Input Stok Opname Bulanan
              </h2>
              <p className="text-[10.5px] font-medium text-slate-500">
                Terintegrasi dengan Kalkulator HPP ({masterItems.length} bahan baku) & Penjualan Menu (Terjual + Jatah)
              </p>
            </div>
          </div>

          {/* Search, Category Filter, and Add Material Button */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama bahan baku..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="Semua">Semua Kategori</option>
              <option value="Minuman">Minuman</option>
              <option value="Makanan">Makanan</option>
              <option value="Packaging">Packaging</option>
              <option value="Lain-lain">Lain-lain</option>
            </select>

            {/* Add New Master Material Button */}
            <button
              type="button"
              onClick={handleOpenAddItemModal}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center space-x-1"
            >
              <Plus className="h-3.5 w-3.5 text-amber-400" />
              <span>Tambah Bahan Baru</span>
            </button>
          </div>
        </div>

        {/* Interactive Form Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <th className="py-3 px-3.5 w-10 text-center">No</th>
                <th className="py-3 px-3.5">Bahan Baku & Kategori</th>
                <th className="py-3 px-3.5 text-center">Satuan</th>
                <th className="py-3 px-3.5 text-right">Harga / Satuan</th>
                <th className="py-3 px-3.5 text-center w-24 bg-slate-200/50">Stok Awal</th>
                <th className="py-3 px-3.5 text-center w-24 bg-slate-200/50">Stok Masuk</th>
                
                {/* REQUIRED FIELDS */}
                <th className="py-3 px-3.5 text-center w-36 bg-emerald-50 text-emerald-950 border-x border-emerald-200">
                  <div className="flex flex-col items-center">
                    <span>Bahan Terpakai</span>
                    <span className="text-[9px] font-normal text-emerald-700 lowercase">(penjualan + jatah x resep)</span>
                  </div>
                </th>
                <th className="py-3 px-3.5 text-center w-28 bg-indigo-50 text-indigo-950 border-r border-indigo-200">
                  Sisa Bahan di Bar
                </th>
                <th className="py-3 px-3.5 text-center w-28 bg-red-50 text-red-950 border-r border-red-200">
                  Bahan Waste / Loss
                </th>

                <th className="py-3 px-3.5 text-right font-black">Nilai Loss (Rp)</th>
                <th className="py-3 px-3.5 w-40">Catatan / Keterangan Loss</th>
                <th className="py-3 px-3.5 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 font-medium">
                    Tidak ada bahan baku yang cocok dengan pencarian / filter Anda.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const entry = opnameEntries[item.id] || {
                    itemId: item.id,
                    stokAwal: 0,
                    stokMasuk: 0,
                    terpakai: 0,
                    sisaDiBar: 0,
                    wasteLoss: 0,
                    catatanLoss: ''
                  };

                  const autoData = monthlyRecipeUsageMap[item.id];
                  const autoQuantity = autoData?.totalQuantity || 0;
                  const nominalLoss = (entry.wasteLoss || 0) * (item.hargaSatuan || 0);
                  const isLossExist = (entry.wasteLoss || 0) > 0;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50 transition-colors ${isLossExist ? 'bg-red-50/20' : ''}`}
                    >
                      <td className="py-2.5 px-3.5 text-center font-bold text-slate-400 font-mono">
                        {index + 1}
                      </td>

                      {/* Bahan Baku & Kategori */}
                      <td className="py-2.5 px-3.5">
                        <span className="font-extrabold text-slate-900 block text-xs">
                          {item.namaBahan}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {item.kategori}
                        </span>
                      </td>

                      {/* Satuan */}
                      <td className="py-2.5 px-3.5 text-center font-bold text-slate-600 bg-slate-50/50">
                        {item.satuan}
                      </td>

                      {/* Harga per Satuan */}
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                        Rp {Math.round(item.hargaSatuan).toLocaleString('id-ID')}
                      </td>

                      {/* Stok Awal */}
                      <td className="py-2.5 px-3 text-center bg-slate-50">
                        <input
                          type="number"
                          min="0"
                          value={entry.stokAwal}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleEntryChange(item.id, 'stokAwal', e.target.value)}
                          className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-center font-mono font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>

                      {/* Stok Masuk */}
                      <td className="py-2.5 px-3 text-center bg-slate-50">
                        <input
                          type="number"
                          min="0"
                          value={entry.stokMasuk}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleEntryChange(item.id, 'stokMasuk', e.target.value)}
                          className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-center font-mono font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>

                      {/* 1. BAHAN TERPAKAI (AUTO / MANUAL) */}
                      <td className="py-2.5 px-3 text-center bg-emerald-50/40 border-x border-emerald-100">
                        <div className="flex flex-col items-center space-y-1">
                          <input
                            type="number"
                            min="0"
                            value={entry.terpakai}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleEntryChange(item.id, 'terpakai', e.target.value)}
                            className="w-24 px-2 py-1 bg-emerald-50 border border-emerald-300 rounded text-center font-mono font-black text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs"
                          />

                          {/* Auto Calc Indicator Badge & Click to Fill Button */}
                          {autoData && autoData.totalQuantity > 0 ? (
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleEntryChange(item.id, 'terpakai', autoQuantity)}
                                className="text-[9.5px] font-black text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300/80 px-2 py-0.5 rounded-md cursor-pointer transition flex items-center space-x-1 active:scale-95 shadow-2xs"
                                title={`Klik untuk mengisi otomatis ${autoQuantity.toLocaleString('id-ID')} ke kolom Bahan Terpakai`}
                              >
                                <Zap className="h-3 w-3 text-emerald-600 fill-emerald-600" />
                                <span>Isi Auto: {autoQuantity.toLocaleString('id-ID')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedBreakdownItem({
                                  namaBahan: item.namaBahan,
                                  satuan: item.satuan,
                                  data: autoData
                                })}
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 rounded-md transition"
                                title="Lihat rincian pemakaian per menu"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-medium">Manual</span>
                          )}
                        </div>
                      </td>

                      {/* 2. SISA BAHAN DI BAR */}
                      <td className="py-2.5 px-3 text-center bg-indigo-50/40 border-r border-indigo-100">
                        {(() => {
                          const totalAvail = (entry.stokAwal || 0) + (entry.stokMasuk || 0);
                          const expectedSisa = Math.max(0, totalAvail - (entry.terpakai || 0));
                          return (
                            <div className="flex flex-col items-center space-y-1">
                              <input
                                type="number"
                                min="0"
                                value={entry.sisaDiBar}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleEntryChange(item.id, 'sisaDiBar', e.target.value)}
                                className="w-22 px-2 py-1 bg-indigo-50 border border-indigo-300 rounded text-center font-mono font-black text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs"
                              />
                              {totalAvail > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleEntryChange(item.id, 'sisaDiBar', expectedSisa)}
                                  className="text-[9px] font-bold text-indigo-800 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300/80 px-1.5 py-0.5 rounded cursor-pointer transition flex items-center space-x-0.5 active:scale-95 shadow-2xs"
                                  title={`Klik untuk mengisi Sisa Teoretis (${expectedSisa.toLocaleString('id-ID')})`}
                                >
                                  <span>Isi Sisa: {expectedSisa.toLocaleString('id-ID')}</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* 3. BAHAN WASTE / LOSS */}
                      <td className="py-2.5 px-3 text-center bg-red-50/40 border-r border-red-100">
                        {(() => {
                          const totalAvail = (entry.stokAwal || 0) + (entry.stokMasuk || 0);
                          const calculatedLoss = Math.max(0, totalAvail - (entry.terpakai || 0) - (entry.sisaDiBar || 0));
                          return (
                            <div className="flex flex-col items-center space-y-1">
                              <input
                                type="number"
                                min="0"
                                value={entry.wasteLoss}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleEntryChange(item.id, 'wasteLoss', e.target.value, false)}
                                className={`w-22 px-2 py-1 border rounded text-center font-mono font-black shadow-2xs focus:outline-none ${
                                  isLossExist 
                                    ? 'bg-red-100 border-red-400 text-red-900' 
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              />
                              {calculatedLoss > 0 && entry.wasteLoss !== calculatedLoss && (
                                <button
                                  type="button"
                                  onClick={() => handleEntryChange(item.id, 'wasteLoss', calculatedLoss, false)}
                                  className="text-[9px] font-bold text-red-800 bg-red-100 hover:bg-red-200 border border-red-300/80 px-1.5 py-0.5 rounded cursor-pointer transition flex items-center space-x-0.5 active:scale-95 shadow-2xs"
                                  title={`Klik untuk mengisi Loss (${calculatedLoss.toLocaleString('id-ID')})`}
                                >
                                  <span>Isi Loss: {calculatedLoss.toLocaleString('id-ID')}</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Nilai Loss (Rp) */}
                      <td className={`py-2.5 px-3.5 text-right font-mono font-black ${
                        isLossExist ? 'text-red-700' : 'text-slate-400'
                      }`}>
                        {formatRupiah(nominalLoss)}
                      </td>

                      {/* Catatan / Keterangan Loss */}
                      <td className="py-2.5 px-3.5">
                        <input
                          type="text"
                          placeholder="e.g. Susu tumpah / expired"
                          value={entry.catatanLoss || ''}
                          onChange={(e) => handleEntryChange(item.id, 'catatanLoss', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditItemModal(item)}
                            className="p-1 text-slate-400 hover:text-amber-800 transition rounded"
                            title="Edit data master bahan ini"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMasterItem(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition rounded"
                            title="Hapus bahan dari daftar master"
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

            {/* Table Footer Summary */}
            {filteredItems.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-black">
                  <td colSpan={6} className="py-3 px-3.5 text-right uppercase tracking-wider text-[10px] text-amber-400">
                    TOTAL AKUMULASI OPNAME PERIODE {selectedMonth}:
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-emerald-300 font-extrabold text-xs">
                    {formatRupiah(summaryCalculations.totalNominalTerpakai)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-indigo-300 font-extrabold text-xs">
                    {formatRupiah(summaryCalculations.totalNominalSisaBar)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-red-300 font-extrabold text-xs">
                    {formatRupiah(summaryCalculations.totalNominalWasteLoss)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-red-400 font-black">
                    {formatRupiah(summaryCalculations.totalNominalWasteLoss)}
                  </td>
                  <td colSpan={2} className="py-3 px-3.5 text-[10px] text-slate-300 font-normal">
                    {summaryCalculations.totalItemLossCount > 0 ? (
                      <span className="text-amber-300 font-bold">
                        ⚠️ Terdeteksi {summaryCalculations.totalItemLossCount} item bahan mengalami waste/loss
                      </span>
                    ) : (
                      <span>✅ Bebas waste & loss</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bottom Save & Sheet Sync Action Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 md:p-5 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-amber-500 text-slate-950 rounded-xl shrink-0 font-black shadow-xs">
            <Save className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-white">
                Simpan Laporan Stok Opname Periode {selectedMonth}
              </span>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-md">
                {masterItems.length} Bahan
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Data opname akan tersimpan di aplikasi dan langsung terinput ke Google Sheets tab <span className="text-amber-300 font-mono font-bold">'Laporan Stok Opname'</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          {spreadsheetId && (
            <button
              type="button"
              onClick={loadCloudOpname}
              disabled={isSyncingSheet || isSavingReport}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
              title="Tarik data terbaru dari Google Sheets"
            >
              <RefreshCw className={`h-4 w-4 text-emerald-400 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>Tarik dari Sheet</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveOpnameReport}
            disabled={isSavingReport || isSyncingSheet}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-sm"
          >
            {isSavingReport ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                <span>Menyimpan ke Sheets...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-slate-950" />
                <span>Simpan ke Google Sheets</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Historical Reports Browser Section */}
      {reportsHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <ClipboardList className="h-4 w-4 text-amber-800" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Riwayat Laporan Stok Opname Terpantau
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {reportsHistory.map(rep => (
              <div 
                key={rep.id} 
                onClick={() => setSelectedMonth(rep.periodeBulan)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  selectedMonth === rep.periodeBulan 
                    ? 'border-amber-600 bg-amber-50/50 shadow-2xs' 
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs">{rep.namaPeriode}</span>
                    <span className="block text-[10px] text-slate-400 font-medium">
                      Auditor: {rep.petugasOpname}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[9.5px] rounded-full">
                    {rep.status}
                  </span>
                </div>
                <div className="text-[10.5px] font-mono font-bold text-slate-600 mt-2 pt-2 border-t border-slate-200 flex justify-between">
                  <span>Tanggal: {rep.tanggalOpname}</span>
                  <span className="text-amber-800 hover:underline">Lihat Detail →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Breakdown Usage Detail */}
      {selectedBreakdownItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 relative">
            <button
              onClick={() => setSelectedBreakdownItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Rincian Kalkulasi Resep Penjualan
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedBreakdownItem.namaBahan} • Periode {selectedMonth}
                </p>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-xs">
              <span className="font-bold text-emerald-950">Total Pemakaian Otomatis:</span>
              <span className="font-mono font-black text-emerald-900 text-sm">
                {selectedBreakdownItem.data.totalQuantity.toLocaleString('id-ID')} {selectedBreakdownItem.satuan}
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <h4 className="text-[10.5px] font-extrabold uppercase text-slate-500">Breakdown Pemakaian per Menu (Terjual + Jatah Barista)</h4>
              {selectedBreakdownItem.data.breakdown.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900 block">{item.menuNama}</span>
                    <span className="text-[10px] text-slate-500">{item.portions} porsi total</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-800">
                    {item.totalAmount.toLocaleString('id-ID')} {selectedBreakdownItem.satuan}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedBreakdownItem(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Master Material */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 relative">
            <button
              onClick={() => setShowItemModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-950 text-amber-400 rounded-xl">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingMasterItem ? 'Edit Bahan Baku Master' : 'Tambah Bahan Baku Master Baru'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Terintegrasi langsung dengan Kalkulator HPP & Recipe Costing
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveMasterItem} className="space-y-3 pt-2">
              <div>
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600 mb-1">
                  Nama Bahan Baku
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biji Kopi Arabika, Susu Evaporasi"
                  value={formNamaBahan}
                  onChange={(e) => setFormNamaBahan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-extrabold uppercase text-slate-600 mb-1">
                    Satuan Takaran
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. gram, ml, pcs, kg"
                    value={formSatuan}
                    onChange={(e) => setFormSatuan(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-extrabold uppercase text-slate-600 mb-1">
                    Kemasan Beli
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1000 gram, 100 pcs"
                    value={formSatuanBeli}
                    onChange={(e) => setFormSatuanBeli(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600 mb-1">
                  Harga Beli Kemasan (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 200000"
                  value={formHargaBeli}
                  onChange={(e) => setFormHargaBeli(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-900 hover:bg-amber-950 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-xs"
                >
                  Simpan Bahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
