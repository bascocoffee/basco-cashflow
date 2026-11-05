import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  Coffee, 
  BookOpen, 
  DollarSign, 
  HelpCircle, 
  Layers, 
  TrendingUp, 
  Check, 
  Copy, 
  Award, 
  ArrowUpRight,
  Filter,
  MessageSquare
} from 'lucide-react';

export interface RecipeIngredient {
  id: string;
  namaBahan: string;
  satuanBeli: string;
  hargaBeli: number;
  jumlahTakaran: number;
  satuanTakaran: string;
  biayaAtauHargaUnit: number;
}

export interface MenuItem {
  id: string;
  nama: string;
  kategori: string;
  hargaJual: number;
  hpp?: number;
  margin?: number;
  marginPct?: number;
  jatahBaristaDefault?: number;
  resep?: RecipeIngredient[];
}

export interface RawIngredient {
  id: string;
  namaBahan: string;
  satuanBeli: string;
  hargaBeli: number;
  isiPerBeli: number;
  satuanTakaran: string;
  hargaPerUnitTakaran: number;
}

export interface DailySaleItem {
  id: string;
  tanggal: string;
  menuId: string;
  namaMenu: string;
  kategori: string;
  jumlahTerjual: number;
  hargaJualItem: number;
  hppItem: number;
  totalOmset: number;
  totalCogs: number;
  totalProfit: number;
}

interface HppAiForumProps {
  menuCatalog: MenuItem[];
  rawIngredients: RawIngredient[];
  dailySales?: DailySaleItem[];
  onApplySuggestedPrice?: (menuId: string, idealPrice: number) => void;
}

interface ForumMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export default function HppAiForum({
  menuCatalog = [],
  rawIngredients = [],
  dailySales = [],
  onApplySuggestedPrice
}: HppAiForumProps) {
  const [messages, setMessages] = useState<ForumMessage[]>(() => {
    const saved = localStorage.getItem('aruskas_hpp_ai_forum_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        role: 'model',
        content: `Halo! Saya **Basco HPP & Sales AI Expert** ☕🤖

Saya adalah forum konsultan pintar yang terhubung langsung ke **Database HPP, Resep Bahan Baku, dan Record Penjualan Menu** kafe Anda.

**Apa yang bisa saya bantu hari ini?**
- 📊 Menganalisis menu mana yang margin COGS-nya paling berisiko atau paling menguntungkan.
- 💡 Mengidentifikasi bahan baku mana yang paling banyak menyedot modal (HPP).
- 💲 Memberikan rekomendasi harga jual ideal agar margin profit kafe Anda mencapai target F&B 65-70%.
- 🍱 Membuatkan simulasi bundling / paket hemat menu makanan & minuman.

Silakan ketik pertanyaan Anda atau pilih pertanyaan cepat di bawah ini!`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [selectedMenuId, setSelectedMenuId] = useState<string>('all');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Auto-scroll to bottom of internal chat feed only (never scroll the main window)
  useEffect(() => {
    if (feedContainerRef.current) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight;
      } else {
        feedContainerRef.current.scrollTo({
          top: feedContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages, isLoading]);

  // Sync history to local storage
  useEffect(() => {
    localStorage.setItem('aruskas_hpp_ai_forum_history', JSON.stringify(messages));
  }, [messages]);

  // Selected menu item object
  const selectedMenuItem = useMemo(() => {
    if (selectedMenuId === 'all') return null;
    return menuCatalog.find(m => m.id === selectedMenuId) || null;
  }, [selectedMenuId, menuCatalog]);

  // Calculate quick database metrics
  const stats = useMemo(() => {
    const totalMenu = menuCatalog.length;
    const totalBahan = rawIngredients.length;

    let sumMarginPct = 0;
    let menuCountWithPrice = 0;

    menuCatalog.forEach(m => {
      if (m.hargaJual > 0) {
        const hpp = m.hpp || 0;
        const margin = m.hargaJual - hpp;
        const marginPct = (margin / m.hargaJual) * 100;
        sumMarginPct += marginPct;
        menuCountWithPrice++;
      }
    });

    const avgMarginPct = menuCountWithPrice > 0 ? sumMarginPct / menuCountWithPrice : 0;

    let totalOmsetSales = 0;
    let totalCogsSales = 0;
    let totalItemsSold = 0;

    dailySales.forEach(d => {
      totalOmsetSales += d.totalOmset || 0;
      totalCogsSales += d.totalCogs || 0;
      totalItemsSold += d.jumlahTerjual || 0;
    });

    const totalProfitSales = totalOmsetSales - totalCogsSales;

    return {
      totalMenu,
      totalBahan,
      avgMarginPct: parseFloat(avgMarginPct.toFixed(1)),
      salesSummary: {
        totalItemsSold,
        totalOmset: totalOmsetSales,
        totalCogs: totalCogsSales,
        totalProfit: totalProfitSales
      }
    };
  }, [menuCatalog, rawIngredients, dailySales]);

  // Send message handler
  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend) return;

    setError(null);
    setIsLoading(true);

    const userMsg: ForumMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInput('');

    try {
      // Build context payload
      const hppContext = {
        menuCatalog: menuCatalog.map(m => {
          const hpp = m.hpp || 0;
          const margin = m.hargaJual - hpp;
          const marginPct = m.hargaJual > 0 ? (margin / m.hargaJual) * 100 : 0;
          return {
            id: m.id,
            nama: m.nama,
            kategori: m.kategori,
            hargaJual: m.hargaJual,
            hpp,
            margin,
            marginPct,
            resep: m.resep || []
          };
        }),
        ingredientsList: rawIngredients,
        salesSummary: stats.salesSummary
      };

      const response = await fetch('/api/gemini/hpp-forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content
          })),
          selectedMenu: selectedMenuItem,
          hppContext
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal terhubung ke AI Forum HPP.');
      }

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'model',
        content: data.reply || 'Maaf, AI tidak dapat merumuskan jawaban saat ini.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal mengirim pertanyaan ke AI Forum.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Hapus seluruh riwayat diskusi di Forum AI HPP?')) {
      const defaultMsg: ForumMessage = {
        role: 'model',
        content: `Halo! Saya **Basco HPP & Sales AI Expert** ☕🤖

Saya adalah forum konsultan pintar yang terhubung langsung ke **Database HPP, Resep Bahan Baku, dan Record Penjualan Menu** kafe Anda.

**Apa yang bisa saya bantu hari ini?**
- 📊 Menganalisis menu mana yang margin COGS-nya paling berisiko atau paling menguntungkan.
- 💡 Mengidentifikasi bahan baku mana yang paling banyak menyedot modal (HPP).
- 💲 Memberikan rekomendasi harga jual ideal agar margin profit kafe Anda mencapai target F&B 65-70%.
- 🍱 Membuatkan simulasi bundling / paket hemat menu makanan & minuman.

Silakan ketik pertanyaan Anda atau pilih pertanyaan cepat di bawah ini!`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([defaultMsg]);
      localStorage.removeItem('aruskas_hpp_ai_forum_history');
    }
  };

  const handleCopyText = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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

  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const cleanContent = trimmed.replace(/^[-*]\s*/, '');
        return (
          <li key={idx} className="ml-4 list-disc pl-1 mb-1 text-xs text-slate-700 leading-relaxed font-medium">
            {parseInlineStyles(cleanContent)}
          </li>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal pl-1 mb-1 text-xs text-slate-700 leading-relaxed font-medium">
            {parseInlineStyles(numMatch[2])}
          </li>
        );
      }
      if (trimmed.startsWith('#')) {
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        const cleanHeading = trimmed.replace(/^#+\s*/, '');
        const headingClass = level === 1 ? "text-xs font-black text-slate-900 mt-3 mb-1 uppercase tracking-wide" :
                             level === 2 ? "text-xs font-black text-slate-900 mt-2 mb-1 pb-0.5 border-b border-slate-100" :
                             "text-[10.5px] font-bold text-slate-800 mt-1.5 mb-0.5";
        return (
          <p key={idx} className={headingClass}>
            {parseInlineStyles(cleanHeading)}
          </p>
        );
      }
      if (!trimmed) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-xs text-slate-700 leading-relaxed mb-1 font-medium">
          {parseInlineStyles(trimmed)}
        </p>
      );
    });
  };

  // Preset Questions
  const PRESET_QUESTIONS = [
    {
      title: 'Menu Berisiko (COGS Tinggi)',
      desc: 'Mana saja menu di katalog yang margin keuntungannya di bawah target F&B (< 60%)?',
      icon: <AlertCircle className="h-4 w-4 text-red-500" />
    },
    {
      title: 'Bahan Baku Paling Mahal',
      desc: 'Bahan baku mana dari database master yang paling menguras modal HPP resep?',
      icon: <Layers className="h-4 w-4 text-amber-500" />
    },
    {
      title: 'Rekomendasi Harga Jual Ideal',
      desc: 'Berapa harga jual ideal untuk seluruh menu agar mencapai margin profit 65-70%?',
      icon: <DollarSign className="h-4 w-4 text-emerald-500" />
    },
    {
      title: 'Ide Paket Bundling Menu',
      desc: 'Berikan 3 kombinasi paket bundling (Food + Drink) untuk mendongkrak rata-rata omset per pelanggan.',
      icon: <Sparkles className="h-4 w-4 text-indigo-500" />
    }
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px]">
      
      {/* Header Forum AI */}
      <div className="bg-slate-900 p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl font-black shrink-0 shadow-xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Forum Tanya AI - Database HPP & Penjualan Menu
              </h3>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black text-[9px] rounded-md uppercase tracking-wider">
                Live HPP Sync
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
              Konsultasikan resep, margin profit, dan penyesuaian harga jual menu secara interaktif dengan AI.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleClearHistory}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition border border-slate-700/60"
            title="Mulai Ulang Diskusi Forum"
          >
            Bersihkan Forum
          </button>
        </div>
      </div>

      {/* Database Context Indicator Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold text-[10.5px]">
            <BookOpen className="h-3.5 w-3.5 text-amber-600" />
            <span>{stats.totalMenu} Menu Katalog</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold text-[10.5px]">
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            <span>{stats.totalBahan} Bahan Baku Master</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold text-[10.5px]">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span>Avg Margin: <strong className="text-emerald-700">{stats.avgMarginPct}%</strong></span>
          </div>
        </div>

        {/* Focus Dropdown Menu Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fokus Menu:</span>
          <select
            value={selectedMenuId}
            onChange={(e) => setSelectedMenuId(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all"> Semua Menu Katalog ({stats.totalMenu})</option>
            {menuCatalog.map(m => (
              <option key={m.id} value={m.id}>
                [{m.kategori}] {m.nama} (Rp {(m.hargaJual || 0).toLocaleString('id-ID')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Highlighted Banner for Selected Menu Focus */}
      {selectedMenuItem && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center space-x-2 text-amber-950 font-medium">
            <Coffee className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Fokus Diskusi: <strong className="font-extrabold text-amber-900">{selectedMenuItem.nama}</strong> ({selectedMenuItem.kategori}) — Harga: <strong>Rp {selectedMenuItem.hargaJual.toLocaleString('id-ID')}</strong> | HPP: <strong>Rp {(selectedMenuItem.hpp || 0).toLocaleString('id-ID')}</strong> | Margin: <strong>{(selectedMenuItem.marginPct || 0).toFixed(1)}%</strong>
            </span>
          </div>
          <button
            onClick={() => setSelectedMenuId('all')}
            className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer ml-2"
          >
            Kembali ke Semua Menu
          </button>
        </div>
      )}

      {/* Forum Message Feed */}
      <div ref={feedContainerRef} className="flex-grow p-4 sm:p-5 overflow-y-auto bg-slate-50/60 space-y-4">
        {messages.map((m, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 max-w-[88%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
          >
            <div className={`p-2 rounded-xl border shrink-0 ${
              m.role === 'user'
                ? 'bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-amber-100 border-amber-200 text-amber-900'
            }`}>
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div className={`rounded-2xl p-4 shadow-xs border relative group ${
              m.role === 'user'
                ? 'bg-slate-900 border-slate-950 text-white'
                : 'bg-white border-slate-200 text-slate-800'
            }`}>
              {/* Copy button for model response */}
              {m.role === 'model' && (
                <button
                  onClick={() => handleCopyText(m.content, index)}
                  className="absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center space-x-1"
                  title="Salin Pesan"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              )}

              {m.role === 'user' ? (
                <p className="text-xs font-bold leading-relaxed">{m.content}</p>
              ) : (
                <div className="space-y-1">{renderMessageContent(m.content)}</div>
              )}

              <div className={`text-[9px] mt-2 font-bold ${
                m.role === 'user' ? 'text-slate-400 text-right' : 'text-slate-400'
              }`}>
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="p-2 rounded-xl bg-amber-100 border border-amber-200 text-amber-900">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center space-x-3">
              <RefreshCw className="h-4 w-4 text-amber-600 animate-spin" />
              <span className="text-xs font-bold text-slate-600">
                AI sedang membaca resep & menghitung kalkulasi HPP database Anda...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Preset Quick Questions Bar */}
      {!isLoading && (
        <div className="px-4 py-2.5 bg-slate-100/80 border-t border-slate-200 overflow-x-auto scrollbar-none">
          <div className="flex items-center space-x-2 min-w-max">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0 flex items-center space-x-1">
              <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Saran Pertanyaan:</span>
            </span>
            {PRESET_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(selectedMenuItem ? `Khusus untuk menu '${selectedMenuItem.nama}': ${q.desc}` : q.desc)}
                className="px-3 py-1.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-[11px] font-bold text-slate-800 transition flex items-center space-x-1.5 cursor-pointer shadow-2xs group"
              >
                <span className="shrink-0">{q.icon}</span>
                <span className="group-hover:text-amber-900 transition">{q.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form Input Query */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3.5 bg-white border-t border-slate-200 flex items-center space-x-3"
      >
        <div className="relative flex-grow">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={
              selectedMenuItem
                ? `Tanyakan resep/HPP khusus untuk menu '${selectedMenuItem.nama}'...`
                : "Tanyakan analisis HPP, resep, atau harga jual menu di sini..."
            }
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-amber-500 rounded-xl text-xs font-semibold focus:outline-none transition"
          />
          <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
        </div>

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition flex items-center space-x-2 shrink-0 cursor-pointer shadow-xs"
        >
          <span>Kirim</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

    </div>
  );
}
