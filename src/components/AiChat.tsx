import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MessageSquare, Send, Bot, User, RefreshCw, AlertCircle, Sparkles, TrendingUp, HelpCircle } from 'lucide-react';
import { Transaction } from '../types';

interface AiChatProps {
  transactions: Transaction[];
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export default function AiChat({ transactions }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('aruskas_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        role: 'model',
        content: `Halo! Saya **Basco Cashflow AI Analyst**, asisten analis keuangan pribadi Anda. ☕📈

Saya siap membantu Anda menganalisis database kas kafe, memantau rasio HPP (COGS), merencanakan efisiensi biaya tetap, serta memberikan rekomendasi taktis agar profitabilitas kafe Anda terus meningkat.

**Apa yang ingin Anda diskusikan hari ini?** Anda bisa mengetik pertanyaan sendiri, atau menggunakan salah satu pilihan pertanyaan siap pakai di bawah ini!`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Save history
  useEffect(() => {
    localStorage.setItem('aruskas_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Compute stats on the fly to send as context
  const financialContext = useMemo(() => {
    let totalDebit = 0;
    let totalKreditSum = 0;
    let totalCOGS = 0;
    let totalCOGSDrink = 0;
    let totalCOGSFood = 0;
    let totalCOGSSnack = 0;
    let totalWages = 0;
    let totalOperasional = 0;

    const getCategoryGroup = (catName: string, desc?: string): string => {
      const norm = (catName || '').toLowerCase().trim();
      const normDesc = (desc || '').toLowerCase().trim();

      if (
        norm.includes('i connect') || norm.includes('iconnect') || norm.includes('i-connect') ||
        normDesc.includes('i connect') || normDesc.includes('iconnect') || normDesc.includes('i-connect') ||
        norm.includes('wifi') || normDesc.includes('wifi') || norm.includes('internet') || normDesc.includes('internet')
      ) {
        return 'operasional';
      }

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

      if (
        norm.includes('gaji') || norm.includes('karyawan') || norm.includes('barista') ||
        norm.includes('staff') || norm.includes('salary') || norm.includes('payroll') || norm.includes('upah') ||
        normDesc.includes('gaji') || normDesc.includes('upah') || normDesc.includes('payroll')
      ) {
        return 'wages';
      }

      if (
        norm.includes('operasional') || norm.includes('sewa') || norm.includes('tempat') ||
        norm.includes('utilitas') || norm.includes('listrik') || norm.includes('air') || norm.includes('pajak') ||
        normDesc.includes('sewa') || normDesc.includes('listrik')
      ) {
        return 'operasional';
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

    transactions.forEach(t => {
      totalDebit += t.debit || 0;
      totalKreditSum += (t.kredit || 0) + (t.kredit2 || 0);

      if (t.kredit > 0) {
        const grp = getCategoryGroup(t.jenisPengeluaran || '', t.keterangan);
        if (grp === 'wages') totalWages += t.kredit;
        else if (grp === 'operasional') totalOperasional += t.kredit;
        else if (grp.startsWith('cogs_')) {
          totalCOGS += t.kredit;
          if (grp === 'cogs_food') totalCOGSFood += t.kredit;
          else if (grp === 'cogs_snack') totalCOGSSnack += t.kredit;
          else totalCOGSDrink += t.kredit;
        } else {
          totalOperasional += t.kredit; // fallback other to operasional
        }
      }

      if (t.kredit2 > 0) {
        const grp2 = getCategoryGroup(t.jenisPengeluaran2 || '', t.keterangan);
        if (grp2 === 'wages') totalWages += t.kredit2;
        else if (grp2 === 'operasional') totalOperasional += t.kredit2;
        else if (grp2.startsWith('cogs_')) {
          totalCOGS += t.kredit2;
          if (grp2 === 'cogs_food') totalCOGSFood += t.kredit2;
          else if (grp2 === 'cogs_snack') totalCOGSSnack += t.kredit2;
          else totalCOGSDrink += t.kredit2;
        } else {
          totalOperasional += t.kredit2;
        }
      }
    });

    const saldo = totalDebit - totalKreditSum;
    const cogsRatio = totalDebit > 0 ? (totalCOGS / totalDebit) * 100 : 0;
    const cogsDrinkRatio = totalDebit > 0 ? (totalCOGSDrink / totalDebit) * 100 : 0;
    const cogsFoodRatio = totalDebit > 0 ? (totalCOGSFood / totalDebit) * 100 : 0;
    const cogsSnackRatio = totalDebit > 0 ? (totalCOGSSnack / totalDebit) * 100 : 0;
    const wagesRatio = totalDebit > 0 ? (totalWages / totalDebit) * 100 : 0;
    const operasionalRatio = totalDebit > 0 ? (totalOperasional / totalDebit) * 100 : 0;
    const netProfitMargin = totalDebit > 0 ? (saldo / totalDebit) * 100 : 0;

    return {
      totalDebit,
      totalKredit: totalKreditSum,
      saldo,
      totalCOGS,
      totalCOGSDrink,
      totalCOGSFood,
      totalCOGSSnack,
      totalWages,
      totalOperasional,
      cogsRatio: parseFloat(cogsRatio.toFixed(1)),
      cogsDrinkRatio: parseFloat(cogsDrinkRatio.toFixed(1)),
      cogsFoodRatio: parseFloat(cogsFoodRatio.toFixed(1)),
      cogsSnackRatio: parseFloat(cogsSnackRatio.toFixed(1)),
      wagesRatio: parseFloat(wagesRatio.toFixed(1)),
      operasionalRatio: parseFloat(operasionalRatio.toFixed(1)),
      netProfitMargin: parseFloat(netProfitMargin.toFixed(1))
    };
  }, [transactions]);

  const handleSend = async (messageText: string) => {
    if (!messageText.trim()) return;
    setError(null);
    setIsLoading(true);

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context: financialContext
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Gagal terhubung dengan server AI.');
      }

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'model',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal mengirim pesan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Hapus seluruh riwayat obrolan ini?')) {
      const defaultMsg: ChatMessage = {
        role: 'model',
        content: `Halo! Saya **Basco Cashflow AI Analyst**, asisten analis keuangan pribadi Anda. ☕📈

Saya siap membantu Anda menganalisis database kas kafe, memantau rasio HPP (COGS), merencanakan efisiensi biaya tetap, serta memberikan rekomendasi taktis agar profitabilitas kafe Anda terus meningkat.

**Apa yang ingin Anda diskusikan hari ini?** Anda bisa mengetik pertanyaan sendiri, atau menggunakan salah satu pilihan pertanyaan siap pakai di bawah ini!`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([defaultMsg]);
      localStorage.removeItem('aruskas_chat_history');
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
        <p key={idx} className="text-xs text-slate-650 leading-relaxed mb-1 font-medium">
          {parseInlineStyles(trimmed)}
        </p>
      );
    });
  };

  const PRESETS = [
    {
      title: 'Kinerja Finansial',
      desc: 'Bagaimana kondisi keuangan kafe saya saat ini?',
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />
    },
    {
      title: 'Rasio HPP (COGS)',
      desc: 'Apakah rasio COGS kafe saya sudah ideal? Bagaimana menguranginya?',
      icon: <Sparkles className="h-4 w-4 text-indigo-500" />
    },
    {
      title: 'Biaya Wifi & Listrik',
      desc: 'Bagaimana cara menekan pengeluaran operasional (seperti internet & utilitas)?',
      icon: <HelpCircle className="h-4 w-4 text-amber-500" />
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6" id="ai-chat-view">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col h-[650px] overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
              <Bot className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-wide">Basco Cashflow AI Analyst</h2>
              <p className="text-[10px] text-slate-400 font-medium">Asisten Analis Keuangan Kafe Berbasis Database</p>
            </div>
          </div>
          <button
            onClick={handleClearChat}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg transition text-[10px] font-bold border border-slate-700/60"
            title="Mulai Ulang Chat"
          >
            Hapus Riwayat
          </button>
        </div>

        {/* Message Panel */}
        <div className="flex-grow p-5 overflow-y-auto bg-slate-50/50 space-y-4">
          {messages.map((m, index) => (
            <div
              key={index}
              className={`flex items-start gap-3.5 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`p-2 rounded-xl border ${
                m.role === 'user'
                  ? 'bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-emerald-50 border-emerald-100 text-emerald-600'
              }`}>
                {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div className={`rounded-2xl p-4 shadow-xs border ${
                m.role === 'user'
                  ? 'bg-emerald-600 border-emerald-650 text-white'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}>
                {m.role === 'user' ? (
                  <p className="text-xs font-semibold leading-relaxed">{m.content}</p>
                ) : (
                  <div>{renderMessageContent(m.content)}</div>
                )}
                <div className={`text-[9px] mt-1.5 font-bold ${
                  m.role === 'user' ? 'text-emerald-200 text-right' : 'text-slate-400'
                }`}>
                  {m.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3.5 max-w-[80%]">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center space-x-2">
                <RefreshCw className="h-3.5 w-3.5 text-emerald-500 animate-spin" />
                <span className="text-xs font-bold text-slate-500">Basco AI sedang membaca database & mengetik analisis...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-150 rounded-2xl text-xs font-semibold text-red-700 flex items-start space-x-2 shadow-xs">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length <= 1 && !isLoading && (
          <div className="px-5 py-3 border-t border-slate-100 bg-white">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Saran Pertanyaan:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p.desc)}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition text-left cursor-pointer group flex gap-2"
                >
                  <div className="shrink-0 mt-0.5">{p.icon}</div>
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-800 group-hover:text-slate-950 transition">{p.title}</h4>
                    <p className="text-[9.5px] text-slate-500 mt-0.5 font-medium line-clamp-1">{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="border-t border-slate-200 p-4 bg-white flex items-center space-x-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Tanyakan analisis kas kafe Anda di sini..."
            className="flex-grow px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-slate-400 focus:outline-none rounded-xl text-xs font-semibold transition"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-xl transition flex items-center space-x-2 font-bold text-xs shrink-0 cursor-pointer"
          >
            <span>Kirim</span>
            <Send className="h-3 w-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
