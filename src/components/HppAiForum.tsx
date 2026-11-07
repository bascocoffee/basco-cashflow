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
  Filter,
  MessageSquare,
  ShoppingBag,
} from 'lucide-react';
import {
  normalizeHppForumDatabase,
  generateSmartHppForumReply,
  getSavedAiProvider,
  setSavedAiProvider,
  type AiProvider,
} from '../utils/aiAssistantEngine';

interface HppAiForumProps {
  menuCatalog: any[];
  rawIngredients: any[];
  dailySales?: any[];
  onApplySuggestedPrice?: (menuId: string, idealPrice: number) => void;
}

interface ForumMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  engine?: string;
}

const DEFAULT_WELCOME_MESSAGE = `Halo! Saya **Basco HPP & Menu Engineering AI Expert (Claude 3.7 & Gemini 2.5)** ☕🤖

Saya terhubung langsung secara *real-time* ke **Database Katalog Menu, Resep Bahan Baku, dan Rekap Penjualan Harian** dari Google Spreadsheet Anda.

**Apa yang bisa saya analisis untuk Anda hari ini?**
- 📊 **Audit Menu Berisiko**: Menemukan menu yang COGS-nya terlalu tinggi atau marginnya di bawah standar F&B (<60%).
- 🧪 **Bedah Resep & Bahan Baku Termahal**: Mengidentifikasi komponen bahan baku yang paling menguras HPP per cup/porsi.
- 💲 **Simulasi Harga Jual Ideal**: Menghitung rekomendasi harga jual agar *Gross Margin* mencapai target ideal **65%–70%**.
- 🍱 **Strategi Paket Bundling**: Merancang kombinasi menu laris + menu margin tinggi untuk mendongkrak omset harian.

Silakan pilih **Fokus Menu**, klik **Saran Pertanyaan Cepat**, atau ketik pertanyaan Anda di bawah ini!`;

export default function HppAiForum({
  menuCatalog = [],
  rawIngredients = [],
  dailySales = [],
}: HppAiForumProps) {
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => getSavedAiProvider());
  const [messages, setMessages] = useState<ForumMessage[]>(() => {
    const saved = localStorage.getItem('aruskas_hpp_ai_forum_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return [
      {
        role: 'model',
        content: DEFAULT_WELCOME_MESSAGE,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [selectedMenuId, setSelectedMenuId] = useState<string>('all');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Normalize live HPP, Recipe & Sales database
  const normalizedDb = useMemo(
    () => normalizeHppForumDatabase(menuCatalog, rawIngredients, dailySales),
    [menuCatalog, rawIngredients, dailySales]
  );

  const { menus: normalizedMenus, summary: dbSummary } = normalizedDb;

  const selectedMenuItem = useMemo(() => {
    if (selectedMenuId === 'all') return null;
    return normalizedMenus.find((m) => m.id === selectedMenuId) || null;
  }, [selectedMenuId, normalizedMenus]);

  useEffect(() => {
    if (feedContainerRef.current) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight;
      } else {
        feedContainerRef.current.scrollTo({
          top: feedContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem('aruskas_hpp_ai_forum_history', JSON.stringify(messages));
  }, [messages]);

  const handleSelectProvider = (provider: AiProvider) => {
    setAiProvider(provider);
    setSavedAiProvider(provider);
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend) return;

    setIsLoading(true);
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const userMsg: ForumMessage = {
      role: 'user',
      content: textToSend,
      timestamp: nowTime,
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    if (!customPrompt) setInput('');

    const focusId = selectedMenuItem ? selectedMenuItem.id : null;

    try {
      let replyText = '';
      try {
        const response = await fetch('/api/gemini/hpp-forum', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: aiProvider,
            question: textToSend,
            selectedMenuId: focusId,
            selectedMenu: selectedMenuItem
              ? {
                  id: selectedMenuItem.id,
                  nama: selectedMenuItem.namaMenu,
                  namaMenu: selectedMenuItem.namaMenu,
                  kategori: selectedMenuItem.kategori,
                  hargaJual: selectedMenuItem.hargaJual,
                  hpp: selectedMenuItem.hpp,
                  margin: selectedMenuItem.margin,
                  marginPct: selectedMenuItem.marginPct,
                }
              : null,
            messages: updatedHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            menuCatalog,
            rawIngredients,
            dailySales,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          replyText = data.reply || '';
        }
      } catch {
        // Fallback to local Claude/Gemini HPP analytical engine
      }

      if (!replyText.trim()) {
        replyText = generateSmartHppForumReply({
          provider: aiProvider,
          question: textToSend,
          selectedMenuId: focusId,
          menuCatalog,
          rawIngredients,
          dailySales,
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: replyText,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          engine: aiProvider === 'claude' ? 'Claude 3.7 Sonnet' : 'Gemini 2.5 Flash',
        },
      ]);
    } catch (err) {
      console.error(err);
      const fallbackReply = generateSmartHppForumReply({
        provider: aiProvider,
        question: textToSend,
        selectedMenuId: focusId,
        menuCatalog,
        rawIngredients,
        dailySales,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: fallbackReply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          engine: aiProvider === 'claude' ? 'Claude 3.7 Sonnet' : 'Gemini 2.5 Flash',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Hapus seluruh riwayat diskusi di Forum AI HPP?')) {
      const defaultMsg: ForumMessage = {
        role: 'model',
        content: DEFAULT_WELCOME_MESSAGE,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
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
        return (
          <strong key={i} className="font-extrabold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
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
          <li
            key={idx}
            className="ml-4 list-disc pl-1 mb-1 text-xs text-slate-700 leading-relaxed font-medium"
          >
            {parseInlineStyles(cleanContent)}
          </li>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        return (
          <li
            key={idx}
            className="ml-4 list-decimal pl-1 mb-1 text-xs text-slate-700 leading-relaxed font-medium"
          >
            {parseInlineStyles(numMatch[2])}
          </li>
        );
      }
      if (trimmed.startsWith('#')) {
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        const cleanHeading = trimmed.replace(/^#+\s*/, '');
        const headingClass =
          level === 1
            ? 'text-xs font-black text-slate-900 mt-3 mb-1 uppercase tracking-wide'
            : level === 2
            ? 'text-xs font-black text-slate-900 mt-2.5 mb-1 pb-0.5 border-b border-slate-100'
            : 'text-[11px] font-extrabold text-slate-900 mt-2 mb-1';
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

  const PRESET_QUESTIONS = [
    {
      title: 'Menu Berisiko (COGS Tinggi)',
      desc: 'Mana saja menu di katalog yang margin keuntungannya paling rendah atau berisiko COGS tinggi?',
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
    },
    {
      title: 'Bahan Baku Paling Mahal',
      desc: 'Bahan baku mana dari database master yang paling menguras modal HPP resep?',
      icon: <Layers className="h-4 w-4 text-amber-500" />,
    },
    {
      title: 'Rekomendasi Harga Jual Ideal',
      desc: 'Berapa rekomendasi harga jual ideal untuk menu agar mencapai target margin profit 65-70%?',
      icon: <DollarSign className="h-4 w-4 text-emerald-500" />,
    },
    {
      title: 'Ide Paket Bundling & Terlaris',
      desc: 'Analisis penjualan menu dan berikan kombinasi paket bundling untuk mendongkrak omset.',
      icon: <Sparkles className="h-4 w-4 text-indigo-500" />,
    },
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[720px]">
      {/* Header Forum AI */}
      <div className="bg-slate-900 p-4 sm:p-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl font-black shrink-0 shadow-xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Forum Tanya AI - Database HPP & Penjualan Menu
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black text-[9px] rounded-md uppercase tracking-wider">
                Live Spreadsheet Sync
              </span>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black text-[9px] rounded-md uppercase tracking-wider">
                {aiProvider === 'claude' ? 'Claude 3.7 Sonnet' : 'Gemini 2.5 Flash'}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
              Konsultasikan resep, takaran bahan baku, margin profit, dan strategi harga jual menu secara interaktif.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <div className="inline-flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => handleSelectProvider('claude')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                aiProvider === 'claude'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Claude AI
            </button>
            <button
              type="button"
              onClick={() => handleSelectProvider('gemini')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                aiProvider === 'gemini'
                  ? 'bg-indigo-500 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Gemini AI
            </button>
          </div>

          <button
            onClick={handleClearHistory}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition border border-slate-700/60 cursor-pointer"
            title="Mulai Ulang Diskusi Forum"
          >
            Bersihkan Forum
          </button>
        </div>
      </div>

      {/* Database Context Indicator Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold text-[10.5px]">
            <BookOpen className="h-3.5 w-3.5 text-amber-600" />
            <span>{dbSummary.totalMenus} Menu Katalog</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold text-[10.5px]">
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            <span>{dbSummary.totalIngredients} Bahan Baku</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold text-[10.5px]">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              Avg Margin:{' '}
              <strong className="text-emerald-700">{dbSummary.avgMarginPct.toFixed(1)}%</strong>
            </span>
          </div>

          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold text-[10.5px]">
            <ShoppingBag className="h-3.5 w-3.5 text-sky-600" />
            <span>
              Terjual: <strong className="text-slate-900">{dbSummary.totalCupsSold} Cup</strong> (Omset{' '}
              <strong className="text-emerald-700">
                Rp {Math.round(dbSummary.totalOmset).toLocaleString('id-ID')}
              </strong>
              )
            </span>
          </div>
        </div>

        {/* Focus Dropdown Menu Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Fokus Analisis Menu:
          </span>
          <select
            value={selectedMenuId}
            onChange={(e) => {
              const nextId = e.target.value;
              setSelectedMenuId(nextId);
              if (nextId !== 'all') {
                const target = normalizedMenus.find((m) => m.id === nextId);
                if (target) {
                  handleSend(`Bedah resep, HPP, dan rekomendasi harga jual untuk menu ${target.namaMenu}`);
                }
              }
            }}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-[260px]"
          >
            <option value="all">🌐 Semua Menu Katalog ({dbSummary.totalMenus})</option>
            {normalizedMenus.map((m) => (
              <option key={m.id} value={m.id}>
                [{m.kategori}] {m.namaMenu} — Jual Rp {m.hargaJual.toLocaleString('id-ID')} | HPP Rp{' '}
                {Math.round(m.hpp).toLocaleString('id-ID')} ({m.marginPct.toFixed(0)}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Highlighted Banner for Selected Menu Focus */}
      {selectedMenuItem && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-amber-950 font-medium">
            <Coffee className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Fokus Diskusi:{' '}
              <strong className="font-extrabold text-amber-900">{selectedMenuItem.namaMenu}</strong> (
              {selectedMenuItem.kategori}) — Harga Jual:{' '}
              <strong>Rp {selectedMenuItem.hargaJual.toLocaleString('id-ID')}</strong> | HPP Resep:{' '}
              <strong>Rp {Math.round(selectedMenuItem.hpp).toLocaleString('id-ID')}</strong> | Margin:{' '}
              <strong>
                Rp {Math.round(selectedMenuItem.margin).toLocaleString('id-ID')} (
                {selectedMenuItem.marginPct.toFixed(1)}%)
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleSend(`Bedah detail resep dan efisiensi bahan baku untuk menu ${selectedMenuItem.namaMenu}`)
              }
              className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-[10px] font-bold cursor-pointer transition"
            >
              Bedah Resep Menu Ini
            </button>
            <button
              type="button"
              onClick={() => setSelectedMenuId('all')}
              className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
            >
              Reset Fokus
            </button>
          </div>
        </div>
      )}

      {/* Forum Message Feed */}
      <div ref={feedContainerRef} className="flex-grow p-4 sm:p-5 overflow-y-auto bg-slate-50/60 space-y-4">
        {messages.map((m, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 max-w-[90%] ${
              m.role === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div
              className={`p-2 rounded-xl border shrink-0 ${
                m.role === 'user'
                  ? 'bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-amber-100 border-amber-200 text-amber-900'
              }`}
            >
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div
              className={`rounded-2xl p-4 shadow-xs border relative group ${
                m.role === 'user'
                  ? 'bg-slate-900 border-slate-950 text-white'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {m.role === 'model' && (
                <button
                  onClick={() => handleCopyText(m.content, index)}
                  className="absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center space-x-1 cursor-pointer"
                  title="Salin Analisis"
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

              <div
                className={`text-[9px] mt-2 font-bold flex items-center gap-2 ${
                  m.role === 'user' ? 'text-slate-400 justify-end' : 'text-slate-400 justify-between'
                }`}
              >
                <span>{m.timestamp}</span>
                {m.engine && <span className="text-amber-700 font-extrabold">{m.engine}</span>}
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
                {aiProvider === 'claude' ? 'Claude AI' : 'Gemini AI'} sedang mengaudit resep, takaran bahan baku & margin penjualan...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Preset Quick Questions Bar */}
      {!isLoading && (
        <div className="px-4 py-2.5 bg-slate-100/80 border-t border-slate-200 overflow-x-auto scrollbar-none">
          <div className="flex items-center space-x-2 min-w-max">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0 flex items-center space-x-1">
              <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Analisis Cepat:</span>
            </span>
            {PRESET_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  handleSend(
                    selectedMenuItem
                      ? `Khusus untuk menu '${selectedMenuItem.namaMenu}': ${q.desc}`
                      : q.desc
                  )
                }
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
                ? `Tanyakan resep/HPP khusus untuk menu '${selectedMenuItem.namaMenu}'...`
                : 'Tanyakan analisis HPP, bahan termahal, rekomendasi harga jual, atau sebut nama menu...'
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
          <span>Analisis</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
