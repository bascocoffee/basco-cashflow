import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Calculator, Percent, Sparkles, RefreshCw, AlertCircle, Coins, HelpCircle, ShieldAlert } from 'lucide-react';

interface FixedCostItem {
  id: string;
  name: string;
  category: string;
  amount: number;
}

export default function FixedCostSimulator() {
  // Load fixed costs from local storage or set defaults
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>(() => {
    const saved = localStorage.getItem('aruskas_fixed_costs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // default list
      }
    }
    return [
      { id: '1', name: 'Sewa Ruko Bulanan', category: 'Sewa Tempat', amount: 3500000 },
      { id: '2', name: 'Gaji Tetap Barista & Staff', category: 'Tenaga Kerja', amount: 4000000 },
      { id: '3', name: 'Paket Internet (i connect wifi)', category: 'Utilitas', amount: 350000 },
      { id: '4', name: 'Beban Listrik & Air Minimum', category: 'Utilitas', amount: 750000 },
      { id: '5', name: 'Retribusi Sampah & Keamanan', category: 'Administrasi', amount: 150000 }
    ];
  });

  // Simulator inputs
  const [estRevenue, setEstRevenue] = useState<number>(15000000);
  const [contributionMargin, setContributionMargin] = useState<number>(65); // default 65%

  // Add Item form inputs
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Sewa Tempat');
  const [newItemAmount, setNewItemAmount] = useState<string>('');

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save fixed costs to local storage
  useEffect(() => {
    localStorage.setItem('aruskas_fixed_costs', JSON.stringify(fixedCosts));
  }, [fixedCosts]);

  // Load cached AI analysis on load
  useEffect(() => {
    const cached = localStorage.getItem('aruskas_fixed_cost_analysis');
    if (cached) {
      setAiAnalysis(cached);
    }
  }, []);

  // Total fixed cost sum
  const totalFixedCost = useMemo(() => {
    return fixedCosts.reduce((sum, item) => sum + item.amount, 0);
  }, [fixedCosts]);

  // Mathematical outputs
  const simResults = useMemo(() => {
    const marginPercent = contributionMargin / 100;
    const contributionMarginAmount = estRevenue * marginPercent;
    
    // BEP Revenue = Fixed Costs / Margin %
    const bepRevenue = marginPercent > 0 ? totalFixedCost / marginPercent : 0;
    
    // Net profit = contribution margin - fixed costs
    const netProfit = contributionMarginAmount - totalFixedCost;

    const isProfitable = netProfit >= 0;
    const bepProgress = bepRevenue > 0 ? (estRevenue / bepRevenue) * 100 : 0;

    return {
      contributionMarginAmount,
      bepRevenue,
      netProfit,
      isProfitable,
      bepProgress: Math.min(100, Math.round(bepProgress))
    };
  }, [totalFixedCost, estRevenue, contributionMargin]);

  // Add items handler
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemAmount || parseFloat(newItemAmount) <= 0) return;

    const newItem: FixedCostItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      category: newItemCategory,
      amount: parseFloat(newItemAmount)
    };

    setFixedCosts(prev => [...prev, newItem]);
    setNewItemName('');
    setNewItemAmount('');
  };

  const handleDeleteItem = (id: string) => {
    setFixedCosts(prev => prev.filter(item => item.id !== id));
  };

  const handleFixedCostAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini/fixed-cost-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixedCosts,
          totalFixedCost,
          revenueContext: {
            monthlyRevenue: estRevenue,
            contributionMargin
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal memproses analisis fixed cost.');
      }

      const data = await response.json();
      setAiAnalysis(data.analysis);
      localStorage.setItem('aruskas_fixed_cost_analysis', data.analysis);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal mendapatkan analisis.');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" id="fixed-cost-simulator">
      {/* Page Title Header */}
      <div className="mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Calculator className="h-4.5 w-4.5 text-emerald-500" />
          <span>Kalkulator & Simulasi Biaya Tetap (Fixed Cost) Bulanan</span>
        </h1>
        <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-wide">
          Atur beban biaya tetap bulanan kafe Anda dan lakukan simulasi pencapaian Break-Even Point (BEP)
        </p>
      </div>

      {/* Grid Layout: Controls / Inputs on left, Outputs & AI on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side (Total 7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Table of manual fixed costs */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Daftar Biaya Tetap Bulanan</h3>
              <span className="text-xs font-black text-slate-900 bg-slate-150 px-3 py-1 rounded-full">
                Total: {formatIDR(totalFixedCost)}
              </span>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto max-h-[300px]">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[9.5px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-2.5 px-4">Nama Pengeluaran</th>
                    <th className="py-2.5 px-4">Golongan</th>
                    <th className="py-2.5 px-4 text-right">Jumlah Bulanan</th>
                    <th className="py-2.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {fixedCosts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-4 text-slate-900 font-bold">{item.name}</td>
                      <td className="py-2 px-4">
                        <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-md text-slate-600 font-semibold uppercase tracking-wider">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-slate-900">{formatIDR(item.amount)}</td>
                      <td className="py-2 px-4 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Manual input form */}
            <form onSubmit={handleAddItem} className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Biaya Tetap</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paket langganan internet, Gaji kasir"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Golongan Kategori</label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition cursor-pointer"
                >
                  <option value="Sewa Tempat">Sewa Tempat</option>
                  <option value="Tenaga Kerja">Tenaga Kerja</option>
                  <option value="Utilitas">Utilitas (Listrik/Wifi)</option>
                  <option value="Peralatan">Peralatan</option>
                  <option value="Administrasi">Administrasi</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Jumlah (Rp)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Jumlah"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </form>
          </div>

          {/* Interactive simulator controls */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <span>Perkiraan Omset Bulanan (Rp)</span>
              </label>
              <input
                type="number"
                min="0"
                step="100000"
                value={estRevenue}
                onChange={(e) => setEstRevenue(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-sm font-black bg-slate-50 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:border-slate-400 transition"
              />
              <span className="text-[10px] text-slate-400 mt-1 block font-semibold leading-relaxed">
                Asumsi total pendapatan penjualan kafe dalam satu bulan penuh.
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <span>Margin Kontribusi Kotor (%)</span>
                <Percent className="h-3 w-3 text-slate-400" />
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="20"
                  max="90"
                  value={contributionMargin}
                  onChange={(e) => setContributionMargin(parseInt(e.target.value, 10))}
                  className="flex-grow accent-emerald-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="text-sm font-black text-slate-900 shrink-0 w-12 text-right">{contributionMargin}%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block font-semibold leading-relaxed">
                Rasio sisa uang omset setelah dikurangi COGS/Bahan baku (rata-rata kafe F&B: 60% s.d. 70%).
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Simulator Results & AI (Total 5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Results card */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-sm">
            <h3 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Simulasi Hasil Finansial</h3>
            
            <div className="mt-4 space-y-3">
              {/* Margin kontribusi rupiah */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold">Omset Ter-margin ({contributionMargin}%):</span>
                <span className="font-bold text-slate-200">{formatIDR(simResults.contributionMarginAmount)}</span>
              </div>

              {/* Total Fixed Cost */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold">Total Pengeluaran Fixed Cost:</span>
                <span className="font-bold text-slate-200">{formatIDR(totalFixedCost)}</span>
              </div>

              {/* BEP Target */}
              <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-3">
                <span className="text-slate-400 font-bold">Target BEP Omset Minimum:</span>
                <span className="font-black text-indigo-400 text-sm">{formatIDR(simResults.bepRevenue)}</span>
              </div>

              {/* Estimasi Keuntungan Bersih */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Estimasi Profit / Loss Bersih:</span>
                <span className={`text-sm font-black ${simResults.isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatIDR(simResults.netProfit)}
                </span>
              </div>
            </div>

            {/* Progress bar to BEP */}
            <div className="mt-5 pt-3 border-t border-slate-800">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-wider mb-1">
                <span className="text-slate-400">Pencapaian Target BEP</span>
                <span className={simResults.isProfitable ? 'text-emerald-400' : 'text-amber-400'}>{simResults.bepProgress}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    simResults.isProfitable ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${simResults.bepProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* AI Advisor for Fixed Costs */}
          <div className="bg-emerald-950/5 border border-emerald-900/10 rounded-3xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="h-4.5 w-4.5 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">AI Fixed Cost Advisor</h3>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-semibold mb-4">
                Asisten AI akan menghitung BEP, mengevaluasi rasio sewa/gaji staff Anda, dan memberikan solusi penghematan tetap (seperti wifi, shifting, dll).
              </p>

              {aiAnalysis ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs max-h-[220px] overflow-y-auto text-xs font-medium mb-4">
                  {renderFormattedAnalysis(aiAnalysis)}
                </div>
              ) : (
                <div className="h-[120px] flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 text-[10.5px] font-bold p-3 text-center mb-4">
                  {isLoading ? (
                    <div className="space-y-1.5 flex flex-col items-center">
                      <RefreshCw className="h-5 w-5 text-emerald-600 animate-spin" />
                      <span>Gemini AI sedang menghitung kelayakan finansial...</span>
                    </div>
                  ) : (
                    <span>Klik tombol di bawah ini untuk menganalisis model biaya tetap Anda.</span>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-[10.5px] font-semibold text-red-700 flex items-start space-x-1.5 mb-3">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleFixedCostAnalysis}
              disabled={isLoading || fixedCosts.length === 0}
              className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-xl transition font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shrink-0 cursor-pointer shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Minta Analisis Biaya AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
