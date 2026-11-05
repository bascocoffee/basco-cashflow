import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  ShoppingCart, 
  ShoppingBag, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  RefreshCw, 
  Cloud, 
  FileSpreadsheet, 
  ExternalLink, 
  Search, 
  Filter, 
  Share2, 
  Copy, 
  Check, 
  CheckCheck, 
  PackagePlus, 
  ArrowRight, 
  X, 
  Sparkles, 
  Building2, 
  Tag, 
  Calendar, 
  DollarSign, 
  Smartphone, 
  Monitor,
  Flame,
  Printer,
  ChevronDown,
  Layers
} from 'lucide-react';
import { ShoppingIngredientItem, ShoppingUrgency, ShoppingStatus } from '../types/shoppingList';
import { 
  SHOPPING_LIST_STORAGE_KEY, 
  DEFAULT_SHOPPING_ITEMS, 
  computeShoppingMetrics, 
  generateWhatsAppShoppingText 
} from '../utils/shoppingListData';
import { fetchShoppingListFromSheet4, saveShoppingListToSheet4, updateShoppingItemStatusInSheet4 } from '../sheetsService';
import { IncomingIngredientBatch } from '../types';

interface ShoppingReportPageProps {
  spreadsheetId?: string | null;
  spreadsheetName?: string | null;
  spreadsheetUrl?: string | null;
  token?: string | null;
  isManagerMode?: boolean;
  onNavigateToIncomingGoods?: () => void;
}

export default function ShoppingReportPage({
  spreadsheetId,
  spreadsheetName,
  spreadsheetUrl,
  token,
  isManagerMode,
  onNavigateToIncomingGoods
}: ShoppingReportPageProps) {
  // Load shopping items from localStorage or default
  const [items, setItems] = useState<ShoppingIngredientItem[]>(() => {
    try {
      const saved = localStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading shopping items', e);
    }
    return DEFAULT_SHOPPING_ITEMS;
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Error saving shopping items', e);
    }
  }, [items]);

  // Cloud sync state with Sheet 4
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [activeTabName, setActiveTabName] = useState<string>('Sheet 4');
  const [syncFeedback, setSyncFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const syncTimeoutRef = useRef<any>(null);
  const isInitialMountDoneRef = useRef(false);

  // Copied WhatsApp indicator
  const [copiedWA, setCopiedWA] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterOnlyUrgent, setFilterOnlyUrgent] = useState(false);
  const [filterOnlyLowStock, setFilterOnlyLowStock] = useState(false);

  // Modal Form State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingIngredientItem | null>(null);

  // Form Fields
  const [formNamaBahan, setFormNamaBahan] = useState('');
  const [formKategori, setFormKategori] = useState('Minuman');
  const [formJumlah, setFormJumlah] = useState('1');
  const [formSatuan, setFormSatuan] = useState('kg');
  const [formSisaStok, setFormSisaStok] = useState('');
  const [formStokMinimum, setFormStokMinimum] = useState('');
  const [formEstimasiHarga, setFormEstimasiHarga] = useState('');
  const [formEstimasiTotal, setFormEstimasiTotal] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formPrioritas, setFormPrioritas] = useState<ShoppingUrgency>('sedang');
  const [formStatus, setFormStatus] = useState<ShoppingStatus>('perlu_dibeli');
  const [formCatatan, setFormCatatan] = useState('');
  const [formTanggal, setFormTanggal] = useState(() => new Date().toISOString().split('T')[0]);

  // Show Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setSyncFeedback({ message, type });
    setTimeout(() => {
      setSyncFeedback(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // Debounced auto-save to Sheet 4
  const triggerCloudSync = useCallback((currentItems = items) => {
    if (!spreadsheetId || !token || !isInitialMountDoneRef.current) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      setIsSyncingCloud(true);
      try {
        await saveShoppingListToSheet4(spreadsheetId, currentItems, token, activeTabName);
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeStr);
      } catch (err: any) {
        console.error('Error auto-syncing shopping list to Sheet 4:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    }, 1500);
  }, [spreadsheetId, token, items, activeTabName]);

  // Load from Sheet 4
  const loadShoppingListFromCloud = useCallback(async (isManual = false) => {
    if (!spreadsheetId || !token) {
      if (isManual) {
        showToast('Spreadsheet Google Sheets belum terhubung. Silakan login akun Google terlebih dahulu.', 'info');
      }
      return;
    }

    setIsLoadingCloud(true);
    try {
      const result = await fetchShoppingListFromSheet4(spreadsheetId, token);
      if (result && result.items.length > 0) {
        setItems(result.items);
        setActiveTabName(result.actualTabName);
        localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(result.items));
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeStr);
        if (isManual) {
          showToast(`✅ Berhasil mengambil ${result.items.length} data bahan belanja dari spreadsheet tab "${result.actualTabName}"!`, 'success');
        }
      } else {
        // If Sheet 4 doesn't exist yet or is empty, initialize it with current items
        if (items.length > 0) {
          await saveShoppingListToSheet4(spreadsheetId, items, token, 'Sheet 4');
          setActiveTabName('Sheet 4');
          const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          setLastSyncTime(timeStr);
          if (isManual) {
            showToast('✅ Tab "Sheet 4" di Google Sheets berhasil dibuat dan disinkronkan!', 'success');
          }
        } else if (isManual) {
          showToast('ℹ️ Terhubung ke Google Sheets "Sheet 4". Belum ada data bahan belanja.', 'info');
        }
      }
    } catch (err: any) {
      console.error('Error fetching shopping list from Sheet 4:', err);
      if (isManual) {
        showToast('❌ Gagal memuat data dari spreadsheet "Sheet 4". Periksa koneksi internet.', 'error');
      }
    } finally {
      setIsLoadingCloud(false);
      isInitialMountDoneRef.current = true;
    }
  }, [spreadsheetId, token, items]);

  // Manual Force Save
  const handleForceSaveToCloud = async () => {
    if (!spreadsheetId || !token) {
      showToast('Spreadsheet Google Sheets belum terhubung.', 'info');
      return;
    }
    setIsSyncingCloud(true);
    try {
      await saveShoppingListToSheet4(spreadsheetId, items, token, activeTabName);
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(timeStr);
      showToast(`✅ ${items.length} bahan belanja berhasil disimpan ke spreadsheet tab "${activeTabName}"!`, 'success');
    } catch (err: any) {
      console.error('Gagal menyimpan ke Sheet 4:', err);
      showToast('❌ Gagal menyimpan ke spreadsheet "Sheet 4". Coba lagi.', 'error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Mount effect
  useEffect(() => {
    if (spreadsheetId && token) {
      loadShoppingListFromCloud(false);
    } else {
      isInitialMountDoneRef.current = true;
    }
  }, [spreadsheetId, token]);

  // Compute metrics
  const metrics = useMemo(() => computeShoppingMetrics(items), [items]);

  // Urgent items for top notification banner
  const urgentAlertItems = useMemo(() => {
    return items.filter(i => 
      (i.status === 'perlu_dibeli' || i.status === 'sedang_dipesan') && 
      (i.prioritas === 'urgent' || (i.sisaStok !== undefined && i.stokMinimum !== undefined && i.sisaStok <= i.stokMinimum))
    );
  }, [items]);

  // Unique categories for filter
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.kategori) set.add(i.kategori);
    });
    return Array.from(set);
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.namaBahan.toLowerCase().includes(q);
        const matchSupplier = item.supplier?.toLowerCase().includes(q);
        const matchNote = item.catatan?.toLowerCase().includes(q);
        const matchCat = item.kategori?.toLowerCase().includes(q);
        if (!matchName && !matchSupplier && !matchNote && !matchCat) return false;
      }

      // Status filter
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;

      // Priority filter
      if (filterPriority !== 'ALL' && item.prioritas !== filterPriority) return false;

      // Category filter
      if (filterCategory !== 'ALL' && item.kategori !== filterCategory) return false;

      // Urgent toggle
      if (filterOnlyUrgent && item.prioritas !== 'urgent' && item.prioritas !== 'tinggi') return false;

      // Low stock toggle
      if (filterOnlyLowStock && !(item.sisaStok !== undefined && item.stokMinimum !== undefined && item.sisaStok <= item.stokMinimum)) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Priority sorting: urgent first, then tinggi, sedang, rendah
      const prioOrder: Record<ShoppingUrgency, number> = { urgent: 0, tinggi: 1, sedang: 2, rendah: 3 };
      const statusOrder: Record<ShoppingStatus, number> = { perlu_dibeli: 0, sedang_dipesan: 1, sudah_dibeli: 2, dibatalkan: 3 };

      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return prioOrder[a.prioritas] - prioOrder[b.prioritas];
    });
  }, [items, searchQuery, filterStatus, filterPriority, filterCategory, filterOnlyUrgent, filterOnlyLowStock]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNamaBahan('');
    setFormKategori('Minuman');
    setFormJumlah('1');
    setFormSatuan('kg');
    setFormSisaStok('');
    setFormStokMinimum('');
    setFormEstimasiHarga('');
    setFormEstimasiTotal('');
    setFormSupplier('');
    setFormPrioritas('sedang');
    setFormStatus('perlu_dibeli');
    setFormCatatan('');
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ShoppingIngredientItem) => {
    setEditingItem(item);
    setFormNamaBahan(item.namaBahan);
    setFormKategori(item.kategori || 'Minuman');
    setFormJumlah(String(item.jumlah || 1));
    setFormSatuan(item.satuan || 'kg');
    setFormSisaStok(item.sisaStok !== undefined ? String(item.sisaStok) : '');
    setFormStokMinimum(item.stokMinimum !== undefined ? String(item.stokMinimum) : '');
    setFormEstimasiHarga(item.estimasiHarga ? String(item.estimasiHarga) : '');
    setFormEstimasiTotal(item.estimasiTotal ? String(item.estimasiTotal) : '');
    setFormSupplier(item.supplier || '');
    setFormPrioritas(item.prioritas);
    setFormStatus(item.status);
    setFormCatatan(item.catatan || '');
    setFormTanggal(item.tanggal || new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  // Save Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaBahan.trim()) {
      alert('Mohon isi nama bahan / barang yang harus dibelanjakan.');
      return;
    }

    const jumlahNum = parseFloat(formJumlah) || 1;
    const sisaNum = formSisaStok !== '' ? parseFloat(formSisaStok) : undefined;
    const minNum = formStokMinimum !== '' ? parseFloat(formStokMinimum) : undefined;
    const hargaNum = formEstimasiHarga !== '' ? parseFloat(formEstimasiHarga.replace(/\D/g, '')) : undefined;
    
    let totalNum = formEstimasiTotal !== '' ? parseFloat(formEstimasiTotal.replace(/\D/g, '')) : 0;
    if (!totalNum && hargaNum) {
      totalNum = hargaNum * jumlahNum;
    }

    if (editingItem) {
      // Update
      const updated = items.map(i => {
        if (i.id === editingItem.id) {
          return {
            ...i,
            namaBahan: formNamaBahan.trim(),
            kategori: formKategori,
            jumlah: jumlahNum,
            satuan: formSatuan.trim() || 'pcs',
            sisaStok: sisaNum,
            stokMinimum: minNum,
            estimasiHarga: hargaNum,
            estimasiTotal: totalNum,
            supplier: formSupplier.trim() || undefined,
            prioritas: formPrioritas,
            status: formStatus,
            catatan: formCatatan.trim() || undefined,
            tanggal: formTanggal,
            checked: formStatus === 'sudah_dibeli',
            updatedAt: new Date().toISOString()
          };
        }
        return i;
      });
      setItems(updated);
      triggerCloudSync(updated);
      showToast(`Bahan "${formNamaBahan}" berhasil diperbarui.`);
    } else {
      // Create
      const newItem: ShoppingIngredientItem = {
        id: `shop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        namaBahan: formNamaBahan.trim(),
        kategori: formKategori,
        jumlah: jumlahNum,
        satuan: formSatuan.trim() || 'pcs',
        sisaStok: sisaNum,
        stokMinimum: minNum,
        estimasiHarga: hargaNum,
        estimasiTotal: totalNum,
        supplier: formSupplier.trim() || undefined,
        prioritas: formPrioritas,
        status: formStatus,
        catatan: formCatatan.trim() || undefined,
        tanggal: formTanggal,
        checked: formStatus === 'sudah_dibeli',
        createdAt: new Date().toISOString()
      };
      const updated = [newItem, ...items];
      setItems(updated);
      triggerCloudSync(updated);
      showToast(`Bahan "${formNamaBahan}" ditambahkan ke daftar belanja.`);
    }

    setIsModalOpen(false);
  };

  // Toggle item status (Belum Dibeli vs Sudah Dibeli)
  // CRITICAL: Kolom tanggal dan nama bahan tidak boleh berubah ketika diklik sudah dibeli!
  // Menggunakan update langsung ke cell kolom Status Belanja di Google Sheets agar rumus
  // =IMPORTRANGE(" Responses 2!AZ311:AZ1000") tetap aman & tidak tertimpa/hilang.
  const handleToggleStatus = async (id: string) => {
    const targetItem = items.find(i => i.id === id);
    if (!targetItem) return;

    const nextStatus: ShoppingStatus = targetItem.status === 'sudah_dibeli' ? 'perlu_dibeli' : 'sudah_dibeli';
    
    // Explicitly guarantee tanggal and namaBahan are invariant
    const updated = items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          tanggal: item.tanggal, // Kolom tanggal TIDAK BERUBAH
          namaBahan: item.namaBahan, // Kolom nama bahan TIDAK BERUBAH
          status: nextStatus,
          checked: nextStatus === 'sudah_dibeli',
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });

    setItems(updated);
    localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(updated));

    // Targeted single-cell update to ONLY the Status column in Google Sheets
    // Keeps formula =IMPORTRANGE(...) and columns Tanggal & Nama Bahan completely untouched
    if (spreadsheetId && token) {
      setIsSyncingCloud(true);
      try {
        const success = await updateShoppingItemStatusInSheet4(
          spreadsheetId,
          { ...targetItem, status: nextStatus },
          nextStatus,
          token,
          activeTabName
        );
        if (success) {
          const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          setLastSyncTime(timeStr);
          showToast(
            nextStatus === 'sudah_dibeli'
              ? `✅ "${targetItem.namaBahan}" ditandai Sudah Dibeli (kolom tanggal & nama bahan tetap utuh di Sheet 4)`
              : `ℹ️ Status "${targetItem.namaBahan}" diubah ke Perlu Dibeli`,
            'success'
          );
        } else {
          // If targeted update couldn't find the cell, fallback to safe formula-preserving sync
          triggerCloudSync(updated);
        }
      } catch (err: any) {
        console.error('Error updating status in Sheet 4:', err);
        triggerCloudSync(updated);
      } finally {
        setIsSyncingCloud(false);
      }
    } else {
      showToast(
        nextStatus === 'sudah_dibeli'
          ? `✅ "${targetItem.namaBahan}" ditandai Sudah Dibeli`
          : `ℹ️ Status "${targetItem.namaBahan}" diubah ke Perlu Dibeli`,
        'success'
      );
    }
  };

  // Delete item
  const handleDeleteItem = (id: string, name: string) => {
    if (window.confirm(`Hapus "${name}" dari daftar bahan belanja?`)) {
      const updated = items.filter(i => i.id !== id);
      setItems(updated);
      triggerCloudSync(updated);
      showToast(`"${name}" dihapus.`);
    }
  };

  // Direct 1-Click Action: Record Purchased Item directly into Incoming Goods (Barang Masuk)
  const handleDirectRecordToIncomingGoods = (item: ShoppingIngredientItem) => {
    try {
      const savedIncoming = localStorage.getItem('aruskas_cogs_incoming_batches');
      let currentBatches: IncomingIngredientBatch[] = [];
      if (savedIncoming) {
        try { currentBatches = JSON.parse(savedIncoming); } catch {}
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const newBatch: IncomingIngredientBatch = {
        id: `in-batch-${Date.now()}`,
        tanggal: todayStr,
        namaBahan: item.namaBahan,
        kategori: item.kategori || 'Minuman',
        berat: item.jumlah,
        satuan: item.satuan,
        harga: item.estimasiTotal || 0,
        hargaSatuan: item.jumlah > 0 && item.estimasiTotal ? Math.round(item.estimasiTotal / item.jumlah) : 0,
        statusPembayaran: 'Lunas',
        supplier: item.supplier || 'Toko Bahan',
        keterangan: `Dicatat dari Daftar Belanja Sheet 4: ${item.catatan || '-'}`,
        nomorNota: `NOTA-${Date.now().toString().slice(-5)}`,
        createdAt: new Date().toISOString()
      };

      const updatedBatches = [newBatch, ...currentBatches];
      localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(updatedBatches));

      // Mark the shopping item as purchased - keeping tanggal & namaBahan 100% invariant
      const updatedItems = items.map(i => {
        if (i.id === item.id) {
          return {
            ...i,
            tanggal: i.tanggal, // Kolom tanggal TIDAK BERUBAH
            namaBahan: i.namaBahan, // Kolom nama bahan TIDAK BERUBAH
            status: 'sudah_dibeli' as ShoppingStatus,
            checked: true,
            updatedAt: new Date().toISOString()
          };
        }
        return i;
      });
      setItems(updatedItems);
      localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(updatedItems));

      // Targeted status update in spreadsheet - preserves IMPORTRANGE formula and columns Tanggal & Nama Bahan
      if (spreadsheetId && token) {
        setIsSyncingCloud(true);
        updateShoppingItemStatusInSheet4(spreadsheetId, { ...item, status: 'sudah_dibeli' }, 'sudah_dibeli', token, activeTabName)
          .then(success => {
            if (success) {
              const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              setLastSyncTime(timeStr);
            }
          })
          .catch(err => {
            console.error("Failed to update status cell in sheet:", err);
          })
          .finally(() => {
            setIsSyncingCloud(false);
          });
      }

      showToast(`🎉 "${item.namaBahan}" berhasil dicatat ke Modul Barang Masuk & status ditandai Sudah Dibeli!`, 'success');
    } catch (err: any) {
      console.error(err);
      alert('Gagal mencatat ke Barang Masuk.');
    }
  };

  // Copy WhatsApp Shopping List
  const handleCopyWhatsApp = () => {
    const waText = generateWhatsAppShoppingText(items);
    navigator.clipboard.writeText(waText);
    setCopiedWA(true);
    showToast('📋 Daftar belanja berhasil disalin! Siap dikirim ke WhatsApp.', 'success');
    setTimeout(() => setCopiedWA(false), 3000);
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const exportData = filteredItems.map((item, idx) => ({
        'No': idx + 1,
        'Tanggal Butuh': item.tanggal || '-',
        'Nama Bahan / Barang': item.namaBahan,
        'Kategori': item.kategori || 'Minuman',
        'Jumlah': item.jumlah,
        'Satuan': item.satuan,
        'Sisa Stok di Bar': item.sisaStok !== undefined ? item.sisaStok : '-',
        'Stok Minimum': item.stokMinimum !== undefined ? item.stokMinimum : '-',
        'Estimasi Total (Rp)': item.estimasiTotal || 0,
        'Supplier / Rekomendasi Toko': item.supplier || '-',
        'Prioritas': item.prioritas.toUpperCase(),
        'Status Belanja': item.status === 'sudah_dibeli' ? 'SUDAH DIBELI' : 'PERLU DIBELI',
        'Catatan': item.catatan || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Belanja Sheet 4');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Laporan_Bahan_Belanja_Sheet4_${dateStr}.xlsx`);
      showToast('📥 Berhasil mengekspor Laporan Belanja Bahan ke Excel (.xlsx)!');
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor data ke Excel.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* ============================================================ */}
      {/* 1. TOP HEADER & METRIC SUMMARY */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-rose-500 text-white rounded-2xl shadow-md shadow-rose-500/20">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <span>Bahan yang Harus Dibelanjakan</span>
                  {metrics.urgentCount > 0 && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                      <Flame className="h-3 w-3" />
                      <span>{metrics.urgentCount} Mendesak</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Laporan pengadaan stok &amp; notifikasi belanja terintegrasi dengan spreadsheet <strong>"{activeTabName}"</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy WhatsApp */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Salin daftar belanja dalam format pesan WhatsApp rapi"
            >
              {copiedWA ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Share2 className="h-3.5 w-3.5 text-emerald-700" />}
              <span>{copiedWA ? 'Tersalin!' : 'Bagikan ke WA'}</span>
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Unduh laporan belanja bahan dalam format Excel"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span>Unduh Excel</span>
            </button>

            {/* Add New Item */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center space-x-1.5 px-4 py-2 bg-linear-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black rounded-xl text-xs shadow-md shadow-rose-500/20 transition cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Tambah Bahan Belanja</span>
            </button>
          </div>
        </div>

        {/* Financial & Status Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl">
            <span className="text-[10.5px] font-bold text-rose-800 uppercase tracking-wider block">Perlu Dibelanjakan</span>
            <span className="text-xl font-black text-rose-950 font-mono mt-0.5 block">{metrics.needToBuyCount} Bahan</span>
          </div>

          <div 
            onClick={() => setFilterOnlyUrgent(prev => !prev)}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              filterOnlyUrgent 
                ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400/40' 
                : 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wider block">Prioritas Mendesak</span>
              {filterOnlyUrgent && <span className="text-[9px] font-bold bg-amber-600 text-white px-1.5 py-0.2 rounded">Aktif</span>}
            </div>
            <span className="text-xl font-black text-amber-950 font-mono mt-0.5 flex items-center space-x-1.5">
              <Flame className="h-4 w-4 text-amber-600 animate-bounce" />
              <span>{metrics.urgentCount} Bahan</span>
            </span>
          </div>

          <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl">
            <span className="text-[10.5px] font-bold text-sky-800 uppercase tracking-wider block">Estimasi Anggaran</span>
            <span className="text-xl font-black text-sky-950 font-mono mt-0.5 block truncate" title={`Rp${metrics.totalEstimatedBudget.toLocaleString('id-ID')}`}>
              Rp{metrics.totalEstimatedBudget.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
            <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider block">Sudah Dibelanjakan</span>
            <span className="text-xl font-black text-emerald-950 font-mono mt-0.5 block">
              {metrics.purchasedCount} / {metrics.totalItems} Selesai
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. REALTIME SPREADSHEET (SHEET 4) INTEGRATION STATUS BAR */}
      {/* ============================================================ */}
      <div className="bg-linear-to-r from-rose-500/10 via-amber-500/5 to-rose-500/10 border border-rose-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Left: Spreadsheet Sheet 4 details */}
          <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>Integrasi Spreadsheet Tab "{activeTabName}"</span>
                </span>
                {spreadsheetId && token ? (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Terhubung Aktif: "{activeTabName}"</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <span>Mode Lokal (Tersimpan di Browser)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="inline-flex items-center space-x-1 text-slate-800 font-bold">
                  <Smartphone className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  <span>Mobile</span>
                </span>
                <span>&amp;</span>
                <span className="inline-flex items-center space-x-1 text-slate-800 font-bold">
                  <Monitor className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  <span>PC</span>
                </span>
                <span className="text-slate-500">
                  — Data belanja bahan dibaca &amp; disinkronkan langsung dari spreadsheet "Sheet 4" Google Drive Anda.
                </span>
                {lastSyncTime && (
                  <span className="text-slate-700 font-bold bg-white/80 px-2 py-0.5 rounded-md border border-rose-200/60 font-mono text-[11px]">
                    Sinkron terakhir: {lastSyncTime}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Cloud Sync Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {spreadsheetId && token ? (
              <>
                {/* Pull / Refresh from Sheet 4 */}
                <button
                  type="button"
                  onClick={() => loadShoppingListFromCloud(true)}
                  disabled={isLoadingCloud || isSyncingCloud}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-slate-800 border border-rose-300 hover:border-rose-400 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                  title="Ambil data daftar belanja terbaru dari Sheet 4"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-rose-600 ${isLoadingCloud ? 'animate-spin' : ''}`} />
                  <span>{isLoadingCloud ? 'Memuat...' : 'Tarik dari Sheet 4'}</span>
                </button>

                {/* Force Push to Sheet 4 */}
                <button
                  type="button"
                  onClick={handleForceSaveToCloud}
                  disabled={isLoadingCloud || isSyncingCloud}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50"
                  title="Simpan seluruh daftar belanja ke Sheet 4 sekarang"
                >
                  <Cloud className={`h-3.5 w-3.5 ${isSyncingCloud ? 'animate-pulse' : ''}`} />
                  <span>{isSyncingCloud ? 'Menyimpan...' : 'Simpan ke Sheet 4'}</span>
                </button>

                {/* Open in Google Sheets */}
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-2 bg-rose-100/70 hover:bg-rose-100 text-rose-900 border border-rose-300/80 rounded-xl text-xs font-bold transition cursor-pointer"
                    title="Buka file Google Sheets langsung di tab baru"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            ) : (
              <div className="text-xs text-amber-800 font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                Hubungkan Google Drive di menu atas untuk sinkronisasi cloud Sheet 4
              </div>
            )}
          </div>

        </div>

        {/* Sync Toast Feedback */}
        {syncFeedback && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition animate-in fade-in duration-200 ${
            syncFeedback.type === 'success' 
              ? 'bg-emerald-100/90 text-emerald-950 border border-emerald-300' 
              : syncFeedback.type === 'error'
              ? 'bg-rose-100/90 text-rose-950 border border-rose-300'
              : 'bg-sky-100/90 text-sky-950 border border-sky-300'
          }`}>
            <div className="flex items-center space-x-2">
              <CheckCheck className="h-4 w-4 shrink-0 text-emerald-700" />
              <span>{syncFeedback.message}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSyncFeedback(null)}
              className="text-slate-500 hover:text-slate-900 font-bold p-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. NOTIFIKASI KHUSUS BAHAN MENDESAK / STOK MENIPIS (BANNER) */}
      {/* ============================================================ */}
      {urgentAlertItems.length > 0 && (
        <div className="bg-linear-to-r from-rose-500/10 via-amber-500/10 to-rose-500/10 border-2 border-rose-400/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3 min-w-0">
              <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-md shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Notifikasi Pengadaan: {urgentAlertItems.length} Bahan Mendesak Perlu Segera Dibelanjakan!
                  </h3>
                  <span className="text-[11px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-300">
                    Stok Kritis
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Bahan berikut berada di bawah batas aman stok minimum atau berstatus mendesak untuk kelangsungan operasional bar.
                </p>

                {/* Urgent items chip row */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {urgentAlertItems.map(item => (
                    <div 
                      key={item.id} 
                      className="bg-white border border-rose-300 rounded-xl px-3 py-1.5 flex items-center space-x-2 text-xs shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                      <span className="font-bold text-slate-900">{item.namaBahan}</span>
                      <span className="text-rose-700 font-black font-mono">({item.jumlah} {item.satuan})</span>
                      {item.supplier && <span className="text-[10.5px] text-slate-500">• {item.supplier}</span>}
                      
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id)}
                        className="ml-1 text-[10.5px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded cursor-pointer"
                        title="Tandai bahan ini sudah dibeli"
                      >
                        Sudah Dibeli
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. FILTER & SEARCH CONTROLS */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search bar */}
          <div className="relative flex-grow max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari bahan, supplier, atau catatan..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-slate-400 font-bold hidden sm:inline">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="perlu_dibeli">Perlu Dibeli</option>
                <option value="sudah_dibeli">Sudah Dibeli</option>
                <option value="sedang_dipesan">Sedang Dipesan</option>
                <option value="dibatalkan">Dibatalkan</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-slate-400 font-bold hidden sm:inline">Prioritas:</span>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="ALL">Semua Prioritas</option>
                <option value="urgent">Mendesak / Urgent</option>
                <option value="tinggi">Tinggi</option>
                <option value="sedang">Sedang</option>
                <option value="rendah">Rendah</option>
              </select>
            </div>

            {/* Category Filter */}
            {categoriesList.length > 0 && (
              <div className="flex items-center space-x-1 text-xs">
                <span className="text-slate-400 font-bold hidden sm:inline">Kategori:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="ALL">Semua Kategori</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Filters button */}
            {(searchQuery || filterStatus !== 'ALL' || filterPriority !== 'ALL' || filterCategory !== 'ALL' || filterOnlyUrgent || filterOnlyLowStock) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('ALL');
                  setFilterPriority('ALL');
                  setFilterCategory('ALL');
                  setFilterOnlyUrgent(false);
                  setFilterOnlyLowStock(false);
                }}
                className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. TABEL & DAFTAR LAPORAN BAHAN YANG HARUS DIBELANJAKAN */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Table header bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Laporan Rincian Bahan ({filteredItems.length} Item Ditampilkan)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              🛡️ Proteksi Kolom Tanggal &amp; Nama Bahan Aktif
            </span>
            <span>Centang kotak untuk menandai sudah dibeli tanpa merubah data tanggal &amp; nama bahan.</span>
          </div>
        </div>

        {/* Responsive Table / Cards */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Tidak ada bahan belanja yang cocok dengan filter</h4>
            <p className="text-xs text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau reset filter di atas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-black uppercase tracking-wider text-[10px] border-b border-slate-200/60">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">Cek</th>
                  <th className="py-3 px-3 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-4">Nama Bahan / Barang</th>
                  <th className="py-3 px-3">Jumlah Butuh</th>
                  <th className="py-3 px-3">Kondisi Stok</th>
                  <th className="py-3 px-3 text-right">Estimasi Biaya</th>
                  <th className="py-3 px-3">Supplier / Toko</th>
                  <th className="py-3 px-3 text-center">Prioritas</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi &amp; Catat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.map((item) => {
                  const isDone = item.status === 'sudah_dibeli';
                  const isLowStock = item.sisaStok !== undefined && item.stokMinimum !== undefined && item.sisaStok <= item.stokMinimum;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition ${
                        isDone ? 'bg-slate-50/40 text-slate-400' : ''
                      } ${
                        item.prioritas === 'urgent' && !isDone ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => handleToggleStatus(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          title="Tandai sudah dibeli (kolom tanggal & nama bahan tidak berubah)"
                        />
                      </td>

                      {/* Tanggal Kebutuhan */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className={`font-mono text-xs font-semibold ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {item.tanggal || '-'}
                          </span>
                        </div>
                      </td>

                      {/* Nama Bahan */}
                      <td className="py-3 px-4 min-w-[200px]">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              {item.namaBahan}
                            </span>
                            {item.isFormulaDriven && (
                              <span className="text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1 py-0.2 rounded" title="Data diimpor dari rumus IMPORTRANGE Sheet 4">
                                IMPORTRANGE
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {item.kategori && (
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                {item.kategori}
                              </span>
                            )}
                            {item.catatan && (
                              <span className="text-[11px] text-slate-500 italic truncate max-w-[260px]" title={item.catatan}>
                                "{item.catatan}"
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Jumlah Butuh */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`font-mono font-bold text-sm ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>
                          {item.jumlah}
                        </span>{' '}
                        <span className="text-slate-500 font-medium">{item.satuan}</span>
                      </td>

                      {/* Kondisi Stok (Sisa vs Minimum) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.sisaStok !== undefined ? (
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-1">
                              <span className={`font-mono font-bold ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                                {item.sisaStok} {item.satuan}
                              </span>
                              {item.stokMinimum !== undefined && (
                                <span className="text-[10px] text-slate-400">/ min {item.stokMinimum}</span>
                              )}
                            </div>
                            {isLowStock && (
                              <span className="text-[9.5px] font-black text-rose-600 flex items-center space-x-0.5">
                                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                <span>Di bawah batas minimum</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Estimasi Biaya */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {item.estimasiTotal ? (
                          <div>
                            <span className={`font-mono font-black text-sm ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>
                              Rp{item.estimasiTotal.toLocaleString('id-ID')}
                            </span>
                            {item.estimasiHarga && item.jumlah > 1 && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                (@Rp{item.estimasiHarga.toLocaleString('id-ID')})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-3">
                        {item.supplier ? (
                          <span className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{item.supplier}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Prioritas Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.prioritas === 'urgent' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10.5px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            <Flame className="h-2.5 w-2.5 animate-pulse" />
                            <span>Mendesak</span>
                          </span>
                        ) : item.prioritas === 'tinggi' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Tinggi
                          </span>
                        ) : item.prioritas === 'sedang' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">
                            Sedang
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Rendah
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.status === 'sudah_dibeli' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Sudah Dibeli</span>
                          </span>
                        ) : item.status === 'sedang_dipesan' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="h-3 w-3" />
                            <span>Sedang Dipesan</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Perlu Dibeli
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* 1-Click: Catat ke Barang Masuk */}
                          {!isDone && (
                            <button
                              type="button"
                              onClick={() => handleDirectRecordToIncomingGoods(item)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10.5px] font-black transition cursor-pointer flex items-center space-x-1 shadow-2xs"
                              title="Tandai sudah dibeli dan otomatis simpan ke Modul Barang Masuk"
                            >
                              <PackagePlus className="h-3 w-3 text-emerald-700" />
                              <span className="hidden sm:inline">Catat Masuk</span>
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit bahan belanja"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.namaBahan)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Hapus bahan belanja"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* 6. MODAL FORM: TAMBAH / EDIT BAHAN YANG HARUS DIBELANJAKAN */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-8">
            
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-linear-to-r from-rose-500 to-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <ShoppingCart className="h-5 w-5 stroke-[2.5]" />
                <h3 className="font-black text-base">
                  {editingItem ? 'Edit Bahan yang Harus Dibelanjakan' : 'Tambah Bahan yang Harus Dibelanjakan'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              
              {/* Nama Bahan */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Nama Bahan / Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNamaBahan}
                  onChange={(e) => setFormNamaBahan(e.target.value)}
                  placeholder="Contoh: Susu Fresh Milk Diamond, Biji Kopi Blend, Cup 8oz..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Kategori & Tanggal Butuh */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Kategori Bahan
                  </label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    <option value="Minuman">Minuman (Kopi, Susu, Sirup, Powder)</option>
                    <option value="Makanan">Makanan (Snack, Roti, Bumbu)</option>
                    <option value="Packaging">Packaging (Cup, Sedotan, Paper Bag)</option>
                    <option value="Operasional">Operasional &amp; Kebersihan</option>
                    <option value="Peralatan">Peralatan / Maintenance Bar</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Target Tanggal Belanja
                  </label>
                  <input
                    type="date"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Jumlah & Satuan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Jumlah Kebutuhan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={formJumlah}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormJumlah(val);
                      if (formEstimasiHarga) {
                        const h = parseFloat(formEstimasiHarga.replace(/\D/g, '')) || 0;
                        const j = parseFloat(val) || 0;
                        setFormEstimasiTotal(String(h * j));
                      }
                    }}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    value={formSatuan}
                    onChange={(e) => setFormSatuan(e.target.value)}
                    placeholder="kg, liter, gram, pcs, botol, pack, dus..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Sisa Stok Saat Ini & Stok Minimum */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80">
                <div>
                  <label className="block text-[11px] font-black text-amber-900 uppercase tracking-wider mb-1">
                    Sisa Stok di Bar (Opsional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formSisaStok}
                    onChange={(e) => setFormSisaStok(e.target.value)}
                    placeholder="Contoh: 1.5"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-amber-900 uppercase tracking-wider mb-1">
                    Batas Minimum Aman
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formStokMinimum}
                    onChange={(e) => setFormStokMinimum(e.target.value)}
                    placeholder="Contoh: 5"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Estimasi Harga Satuan & Total Biaya */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Harga Satuan (Rp)
                  </label>
                  <input
                    type="text"
                    value={formEstimasiHarga}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setFormEstimasiHarga(raw ? Number(raw).toLocaleString('id-ID') : '');
                      const h = Number(raw) || 0;
                      const j = parseFloat(formJumlah) || 1;
                      setFormEstimasiTotal(h * j ? (h * j).toLocaleString('id-ID') : '');
                    }}
                    placeholder="Contoh: 18.000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Total Estimasi Biaya (Rp)
                  </label>
                  <input
                    type="text"
                    value={formEstimasiTotal}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setFormEstimasiTotal(raw ? Number(raw).toLocaleString('id-ID') : '');
                    }}
                    placeholder="Contoh: 216.000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono font-black"
                  />
                </div>
              </div>

              {/* Supplier & Prioritas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Supplier / Rekomendasi Toko
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Contoh: Agen Susu Segar, Roastery Kopi, TBK Inti..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Prioritas / Urgensi Belanja
                  </label>
                  <select
                    value={formPrioritas}
                    onChange={(e) => setFormPrioritas(e.target.value as ShoppingUrgency)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    <option value="urgent">🚨 Mendesak / Urgent (Hari Ini / Stok Habis)</option>
                    <option value="tinggi">⚡ Tinggi (Stok Menipis 1-2 Hari)</option>
                    <option value="sedang">📦 Sedang (Reguler Restock Mingguan)</option>
                    <option value="rendah">⏳ Rendah (Opsional / Cadangan)</option>
                  </select>
                </div>
              </div>

              {/* Status Belanja */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Status Pengadaan
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ShoppingStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  <option value="perlu_dibeli">Perlu Dibelanjakan (Belum Dibeli)</option>
                  <option value="sedang_dipesan">Sedang Dipesan / OTW Pengiriman</option>
                  <option value="sudah_dibeli">Sudah Dibelanjakan (Lengkap)</option>
                  <option value="dibatalkan">Dibatalkan</option>
                </select>
              </div>

              {/* Catatan / Keterangan Spesifik */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Catatan / Spesifikasi Khusus
                </label>
                <textarea
                  rows={2}
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Misal: Cek tanggal kedaluwarsa, minta struk nota asli, ambil ukuran 1 liter..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition cursor-pointer"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Tambah ke Daftar Belanja'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
