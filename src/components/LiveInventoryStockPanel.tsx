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
  TrendingDown
} from 'lucide-react';
import { IncomingIngredientBatch } from '../types';
import {
  computeLiveInventoryStock,
  getInventorySettings,
  saveInventorySetting,
  InventorySettingsMap,
  StockStatusType
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
    resep?: Array<{ ingredientId: string; takaran: number }>;
  }>;
  onNavigateToIncomingGoods?: () => void;
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

export default function LiveInventoryStockPanel({
  ingredients,
  incomingBatches,
  dailySales,
  menuItems,
  onNavigateToIncomingGoods,
}: LiveInventoryStockPanelProps) {
  const [settings, setSettings] = useState<InventorySettingsMap>(() => getInventorySettings());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'alerts'>('all');
  const [copiedRestock, setCopiedRestock] = useState(false);

  const summary = useMemo(
    () =>
      computeLiveInventoryStock({
        ingredients,
        incomingBatches,
        dailySales,
        menuItems,
        settings,
      }),
    [ingredients, incomingBatches, dailySales, menuItems, settings]
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
    field: 'initialStock' | 'minThreshold',
    rawVal: string
  ) => {
    const val = Math.max(0, Number(rawVal) || 0);
    const updated = saveInventorySetting(ingredientId, { [field]: val });
    setSettings({ ...updated });
  };

  const handleCopyRestockList = () => {
    const urgent = summary.items.filter((i) => i.status !== 'aman');
    if (urgent.length === 0) return;
    const lines = [
      `📦 *DAFTAR BELANJA STOK MENIPIS — BASCO COFFEE*`,
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
              <h4 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                Stok Bahan Baku Live (Pemotongan Otomatis Resep)
              </h4>
              <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 font-black text-[10px] rounded-full uppercase">
                Auto-Deduct
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Stok awal + Barang Masuk dikurangi otomatis pemakaian resep (penjualan & jatah barista).
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

      {/* Low Stock Alert Banner */}
      {summary.alertCount > 0 ? (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs">
              <p className="font-black text-rose-900">
                Peringatan Stok Menipis: {summary.alertCount} bahan baku perlu segera diperhatikan!
              </p>
              <p className="text-rose-800 font-medium mt-0.5">
                {urgentItems
                  .slice(0, 4)
                  .map(
                    (i) =>
                      `${i.namaBahan} (${Math.round(i.remainingStock).toLocaleString('id-ID')} ${i.satuanTakaran})`
                  )
                  .join(' • ')}
                {urgentItems.length > 4 ? ` • +${urgentItems.length - 4} lainnya` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterMode(filterMode === 'alerts' ? 'all' : 'alerts')}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black rounded-xl shrink-0 transition cursor-pointer"
          >
            {filterMode === 'alerts' ? 'Tampilkan Semua' : `Filter ${summary.alertCount} Bahan Menipis`}
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs text-emerald-900 font-bold">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Seluruh stok bahan baku dalam kondisi aman dan mencukupi.</span>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-500">Total Bahan</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">{summary.items.length}</p>
        </div>
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
          <p className="text-[10px] font-black uppercase text-rose-700 flex items-center gap-1">
            <Flame className="h-3 w-3" /> Habis / Minus
          </p>
          <p className="text-lg font-black text-rose-900 mt-0.5">{summary.habisCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
          <p className="text-[10px] font-black uppercase text-orange-700 flex items-center gap-1">
            <TrendingDown className="h-3 w-3" /> Kritis (≤2 Hari)
          </p>
          <p className="text-lg font-black text-orange-900 mt-0.5">{summary.kritisCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-[10px] font-black uppercase text-amber-800">Menipis</p>
          <p className="text-lg font-black text-amber-900 mt-0.5">{summary.menipisCount}</p>
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

      {/* Live Inventory Table with Inner Scroll & Sticky Header */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-xs">
            <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <th className="py-2.5 px-3">Nama Bahan</th>
              <th className="py-2.5 px-3 text-right">Stok Awal</th>
              <th className="py-2.5 px-3 text-right">Total Masuk</th>
              <th className="py-2.5 px-3 text-right">Terpakai (Resep)</th>
              <th className="py-2.5 px-3 text-right">Sisa Stok Live</th>
              <th className="py-2.5 px-3 text-center">Estimasi Cukup</th>
              <th className="py-2.5 px-3 text-right">Batas Min</th>
              <th className="py-2.5 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                  Tidak ada bahan baku yang sesuai filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const badge = STATUS_BADGE[item.status];
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {item.namaBahan}
                      <span className="ml-1.5 text-[10px] font-semibold text-slate-400">
                        ({item.satuanTakaran})
                      </span>
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
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      +{Math.round(item.totalIncoming).toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                      -{Math.round(item.totalUsed).toLocaleString('id-ID')}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-black ${
                        item.remainingStock <= 0
                          ? 'text-rose-700'
                          : item.status === 'kritis'
                          ? 'text-orange-700'
                          : item.status === 'menipis'
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {Math.round(item.remainingStock).toLocaleString('id-ID')} {item.satuanTakaran}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-600">
                      {item.daysRemaining !== null
                        ? item.remainingStock <= 0
                          ? '0 hari'
                          : `~${item.daysRemaining.toFixed(1)} hari`
                        : '-'}
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
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${badge.cls}`}
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
