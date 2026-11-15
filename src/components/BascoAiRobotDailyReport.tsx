import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bot,
  Sparkles,
  X,
  Minus,
  Maximize2,
  Send,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Coffee,
  Calendar,
  MessageSquare,
  Move,
  Flame,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Transaction, AppRole, DebtItem } from '../types';
import { getStoredDebts, getDueDateStatus } from '../utils/debtUtils';
import { pullDailySalesFromCloud } from '../utils/cloudSync';
import { DailySalesRecord, FixedCostItem } from './FixedCostSimulator';

interface BascoAiRobotDailyReportProps {
  userRole?: AppRole;
  transactions?: Transaction[];
  spreadsheetUrl?: string | null;
  onNavigateToTab?: (tab: string) => void;
}

function formatRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0);
}

export default function BascoAiRobotDailyReport({
  userRole = 'owner',
  transactions = [],
  spreadsheetUrl,
  onNavigateToTab
}: BascoAiRobotDailyReportProps) {
  // Modal visibility states
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    // Show by default on load, or check session
    const closedSession = sessionStorage.getItem('basco_robot_daily_closed');
    return closedSession !== 'true';
  });
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'briefing' | 'chat'>('briefing');

  // Floating draggable position (coordinates)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 410) : 80;
    const defaultY = typeof window !== 'undefined' ? Math.max(60, window.innerHeight - 560) : 80;
    return { x: defaultX, y: defaultY };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Today dates & greeting
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const hourNow = today.getHours();
  const timeGreeting =
    hourNow >= 4 && hourNow < 11
      ? 'Selamat Pagi'
      : hourNow >= 11 && hourNow < 15
      ? 'Selamat Siang'
      : hourNow >= 15 && hourNow < 18
      ? 'Selamat Sore'
      : 'Selamat Malam';

  const dayDateFormatted = today.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Daily Sales & Debts & Fixed Costs state
  const [dailySales, setDailySales] = useState<DailySalesRecord[]>(() => {
    try {
      const saved = localStorage.getItem('aruskas_cogs_page_daily_sales');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [debts, setDebts] = useState<DebtItem[]>(() => getStoredDebts());
  const [fixedCosts] = useState<FixedCostItem[]>(() => {
    try {
      const saved = localStorage.getItem('aruskas_fixed_costs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Robot Daily Intelligence Summary state
  const [robotSummary, setRobotSummary] = useState<string>(() => {
    return localStorage.getItem(`basco_robot_daily_summary_${todayStr}`) || '';
  });
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Chat with Robot state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'model'; content: string; timestamp: string }>>(() => {
    try {
      const saved = localStorage.getItem('basco_robot_chat_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        role: 'model',
        content: `Halo Bos! ☕🤖 Saya **Robot AI Basco**, intelijen harian cafe Anda. Saya memantau penjualan hari ini, arus kas masuk & keluar, beban biaya tetap, dan cicilan hutang secara realtime.\n\nAda yang ingin ditanyakan seputar kondisi kafe hari ini?`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Pull latest cloud daily sales
  useEffect(() => {
    void pullDailySalesFromCloud().then(sharedData => {
      if (sharedData?.recordsByDate && typeof sharedData.recordsByDate === 'object') {
        const remoteSales = (Object.values(sharedData.recordsByDate) as DailySalesRecord[]).filter(
          r => r && r.id !== 'ds-1' && r.id !== 'ds-2' && r.id !== 'ds-3'
        );
        if (remoteSales.length > 0) setDailySales(remoteSales);
      }
    });
  }, []);

  // Save chat history
  useEffect(() => {
    localStorage.setItem('basco_robot_chat_history', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Aggregate Today's Metrics
  const todayMetrics = useMemo(() => {
    // 1. Today's sales record
    const todayRecord = dailySales.find(ds => ds.tanggal === todayStr);
    const todayCups = todayRecord ? Number(todayRecord.cups || 0) : 0;
    const todayOmsetRecord = todayRecord ? Number(todayRecord.omset || 0) : 0;
    const todayHpp = todayRecord ? Number(todayRecord.hppTotal || 0) : 0;

    // 2. Today's Cashflow transactions
    const todayTx = transactions.filter(t => t.tanggal === todayStr);
    const todayInflow = todayTx.reduce((s, t) => s + (Number(t.debit) || 0), 0);
    const todayOutflow = todayTx.reduce((s, t) => s + (Number(t.kredit || 0) + Number(t.kredit2 || 0)), 0);
    const todayNetCashflow = todayInflow - todayOutflow;

    const effectiveTodayOmset = todayOmsetRecord > 0 ? todayOmsetRecord : todayInflow;

    // 3. Daily Fixed Cost Prorata (Monthly / 30)
    const monthlyFixedCost = fixedCosts.reduce((s, item) => s + (Number(item.amount) || 0), 0);
    const dailyFixedCost = Math.round((monthlyFixedCost || 8750000) / 30); // ~Rp 291.667

    // 4. Daily Debt Prorata
    const activeDebts = debts.filter(d => d.status === 'active');
    const monthlyDebtInstallment = activeDebts.reduce((s, d) => s + (Number(d.monthlyInstallment) || 0), 0);
    const dailyDebtCost = Math.round(monthlyDebtInstallment / 30);

    // 5. Daily BEP calculation (BEP Omset = (Fixed + Debt) / 0.65)
    const dailyObligations = dailyFixedCost + dailyDebtCost;
    const dailyBepOmset = Math.round(dailyObligations / 0.65);
    const bepPorsiNeeded = Math.round(dailyBepOmset / 18000); // avg cup price 18k
    const bepPercent = dailyBepOmset > 0 ? Math.round((effectiveTodayOmset / dailyBepOmset) * 100) : 0;

    // 6. Urgent Debt Alerts (H-7 to overdue)
    const debtAlerts = activeDebts.filter(d => {
      const status = getDueDateStatus(d);
      return status.status === 'overdue' || status.status === 'due_today' || status.status === 'due_soon' || status.daysLeft <= 7;
    });

    // 7. Today's Top Menu item
    let topMenuName = '-';
    let topMenuQty = 0;
    if (todayRecord?.menuSales && todayRecord.menuSales.length > 0) {
      todayRecord.menuSales.forEach(ms => {
        if ((ms.terjual || 0) > topMenuQty) {
          topMenuQty = ms.terjual;
          topMenuName = ms.nama;
        }
      });
    }

    return {
      todayCups,
      effectiveTodayOmset,
      todayInflow,
      todayOutflow,
      todayNetCashflow,
      todayHpp,
      dailyFixedCost,
      dailyDebtCost,
      dailyObligations,
      dailyBepOmset,
      bepPorsiNeeded,
      bepPercent,
      debtAlerts,
      topMenuName,
      topMenuQty
    };
  }, [dailySales, transactions, debts, fixedCosts, todayStr]);

  // Generate or Refresh Daily Robot Intelligence
  const handleGenerateDailyReport = async () => {
    setIsLoadingSummary(true);
    try {
      const prompt = `Sebagai 'Robot AI Basco' (intelijen operasional & finansial cafe pintar), berikan briefing harian singkat, tajam, dan menyemangati untuk bos kafe hari ini (${dayDateFormatted}).
Data Realtime Hari Ini:
- Omset Penjualan: Rp ${todayMetrics.effectiveTodayOmset.toLocaleString('id-ID')} (${todayMetrics.todayCups} cups)
- Arus Kas Inflow/Outflow: Masuk Rp ${todayMetrics.todayInflow.toLocaleString('id-ID')}, Keluar Rp ${todayMetrics.todayOutflow.toLocaleString('id-ID')} (Net: Rp ${todayMetrics.todayNetCashflow.toLocaleString('id-ID')})
- Beban Biaya Tetap Harian: Rp ${todayMetrics.dailyFixedCost.toLocaleString('id-ID')}
- Beban Cicilan Hutang Harian: Rp ${todayMetrics.dailyDebtCost.toLocaleString('id-ID')}
- Target BEP Harian: Rp ${todayMetrics.dailyBepOmset.toLocaleString('id-ID')} (Capaian: ${todayMetrics.bepPercent}%)
- Menu Terlaris Hari Ini: ${todayMetrics.topMenuName} (${todayMetrics.topMenuQty} porsi)
- Peringatan Hutang: ${todayMetrics.debtAlerts.length > 0 ? `${todayMetrics.debtAlerts.length} hutang mendekati jatuh tempo` : 'Semua cicilan aman'}

Sajikan dengan format ringkas & menarik:
1. Status Operasional Hari Ini (Surplus / Kejar Target)
2. 3 Poin Kunci Penjualan & Arus Kas
3. 2 Taktik Cepat Barista & Kasir untuk Maksimalkan Omset Sore/Malam Ini`;

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'claude',
          question: prompt,
          periodName: `Hari Ini (${todayStr})`,
        })
      });

      if (!res.ok) throw new Error('Gagal menghubungi AI');
      const data = await res.json();
      const reply = data.reply || data.answer || 'Briefing harian siap.';
      setRobotSummary(reply);
      localStorage.setItem(`basco_robot_daily_summary_${todayStr}`, reply);
    } catch {
      // Deterministic analytical briefing fallback
      const fallback = `### ☕ Briefing Intelijen Harian Robot Basco\n\n` +
        `**Status Hari Ini**: ${todayMetrics.bepPercent >= 100 ? '✅ TARGET BEP HARI INI TERCAPAI!' : `⚡ PERLU KEJAR ${Math.max(0, todayMetrics.bepPorsiNeeded - todayMetrics.todayCups)} CUPS LAGI UNTUK AMAN BEP.`}\n\n` +
        `- **Omset Penjualan**: **Rp ${todayMetrics.effectiveTodayOmset.toLocaleString('id-ID')}** (${todayMetrics.todayCups} porsi terjual)\n` +
        `- **Arus Kas Bersih**: **Rp ${todayMetrics.todayNetCashflow.toLocaleString('id-ID')}** (Inflow Rp ${todayMetrics.todayInflow.toLocaleString('id-ID')} | Outflow Rp ${todayMetrics.todayOutflow.toLocaleString('id-ID')})\n` +
        `- **Beban Tetap + Hutang Harian**: **Rp ${todayMetrics.dailyObligations.toLocaleString('id-ID')}** (BEP Harian: Rp ${todayMetrics.dailyBepOmset.toLocaleString('id-ID')})\n` +
        `${todayMetrics.topMenuQty > 0 ? `- **Menu Favorit**: **${todayMetrics.topMenuName}** (${todayMetrics.topMenuQty} porsi)\n` : ''}` +
        `${todayMetrics.debtAlerts.length > 0 ? `- **⚠️ Perhatian**: Ada ${todayMetrics.debtAlerts.length} pos hutang yang mendekati tanggal jatuh tempo.\n` : ''}\n` +
        `#### 💡 Taktik Rekomendasi Robot Hari Ini:\n` +
        `1. **Tawarkan Upselling & Extra Shot**: Dorong barista menawarkan upsize atau add-on camilan pada setiap pesanan kopi susu.\n` +
        `2. **Optimasi Shift Malam**: Pastikan stok susu dan bahan baku aman sebelum peak hour jam santai malam.`;
      setRobotSummary(fallback);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Initial load summary if empty
  useEffect(() => {
    if (!robotSummary) {
      void handleGenerateDailyReport();
    }
  }, []);

  // Dragging Handlers using Pointer Events (Mouse + Touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const maxX = Math.max(10, window.innerWidth - 380);
    const maxY = Math.max(10, window.innerHeight - 120);
    const newX = Math.max(10, Math.min(maxX, dragStartRef.current.posX + dx));
    const newY = Math.max(10, Math.min(maxY, dragStartRef.current.posY + dy));
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Chat send handler
  const handleSendChat = async (overrideText?: string) => {
    const text = (overrideText || chatInput).trim();
    if (!text || isSendingChat) return;

    const userMsg = {
      role: 'user' as const,
      content: text,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatInput('');
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'claude',
          question: text,
          messages: nextMessages,
          stats: {
            totalDebit: todayMetrics.todayInflow,
            totalKredit: todayMetrics.todayOutflow,
            saldo: todayMetrics.todayNetCashflow,
          },
          context: {
            omsetHariIni: todayMetrics.effectiveTodayOmset,
            cupsHariIni: todayMetrics.todayCups,
            fixedCostHarian: todayMetrics.dailyFixedCost,
            hutangHarian: todayMetrics.dailyDebtCost,
            bepHarian: todayMetrics.dailyBepOmset,
            bepPercent: todayMetrics.bepPercent,
            topMenu: todayMetrics.topMenuName
          }
        })
      });

      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      const reply = data.reply || data.answer || 'Robot AI Basco siap membantu.';
      setChatMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: reply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: `Berdasarkan data hari ini, omset kafe tercatat **Rp ${todayMetrics.effectiveTodayOmset.toLocaleString('id-ID')}** (${todayMetrics.todayCups} cups), menutup **${todayMetrics.bepPercent}%** dari kebutuhan biaya tetap harian (Rp ${todayMetrics.dailyFixedCost.toLocaleString('id-ID')}). Ada pertanyaan spesifik lain yang ingin dianalisis?`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('basco_robot_daily_closed', 'true');
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    sessionStorage.removeItem('basco_robot_daily_closed');
  };

  // Robot AI Basco hanya aktif dan muncul untuk role owner
  if (userRole !== 'owner') {
    return null;
  }

  // If closed completely, render floating trigger avatar docked at bottom-right
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bounce-gentle">
        <button
          type="button"
          onClick={handleOpen}
          className="group relative flex items-center space-x-2 px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-full shadow-2xl border-2 border-emerald-400/80 hover:border-emerald-300 transition-all transform hover:scale-105 active:scale-95"
          title="Buka Laporan Harian Robot AI Basco"
        >
          {/* Animated pulse ring */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
          </span>

          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-full">
            <Bot className="h-5 w-5" />
          </div>
          <div className="text-left hidden sm:block pr-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block leading-tight">
              Laporan Harian
            </span>
            <span className="text-xs font-black tracking-tight text-white block">
              Robot AI Basco 🤖
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none'
      }}
      className={`fixed z-50 select-none transition-shadow ${
        isMinimized ? 'w-[320px]' : 'w-[380px] sm:w-[410px]'
      }`}
    >
      <div className="bg-white rounded-3xl border-2 border-indigo-900/20 shadow-2xl overflow-hidden flex flex-col backdrop-blur-md">
        {/* DRAGGABLE HEADER BAR */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-indigo-900/50"
          title="Klik & geser untuk memindahkan posisi pop up"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <Bot className="h-5 w-5" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-black text-white tracking-tight truncate">
                  Robot AI Basco
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase">
                  Live Intel
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-medium truncate">
                {timeGreeting}, Bos! • Geser sesuka Anda
              </p>
            </div>
          </div>

          {/* Window control buttons */}
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMinimized(prev => !prev)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title={isMinimized ? 'Perluas Pop-up' : 'Kecilkan Pop-up'}
            >
              {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              title="Tutup (Bisa dibuka lagi dari ikon pojok bawah)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* BODY (COLLAPSIBLE WHEN MINIMIZED) */}
        {!isMinimized && (
          <div className="flex flex-col bg-slate-50/70 max-h-[500px]">
            {/* Tab Navigation: Briefing vs Chat */}
            <div className="flex items-center px-4 pt-3 pb-2 border-b border-slate-200/80 bg-white gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('briefing')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 ${
                  activeTab === 'briefing'
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Laporan Harian</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 ${
                  activeTab === 'chat'
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                <span>Tanya Robot AI</span>
              </button>
            </div>

            {/* TAB 1: DAILY BRIEFING CONTENT */}
            {activeTab === 'briefing' && (
              <div className="p-4 space-y-3.5 overflow-y-auto">
                {/* 4 Mini Scorecards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Omset Hari Ini
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-950 block mt-0.5">
                      {formatRupiah(todayMetrics.effectiveTodayOmset)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block">
                      {todayMetrics.todayCups} Porsi Terjual
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      BEP Harian ({todayMetrics.bepPercent}%)
                    </span>
                    <span className="text-sm font-black font-mono text-indigo-950 block mt-0.5">
                      {formatRupiah(todayMetrics.dailyBepOmset)}
                    </span>
                    <span
                      className={`text-[9.5px] font-black uppercase block ${
                        todayMetrics.bepPercent >= 100 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {todayMetrics.bepPercent >= 100 ? '✓ Tertutup' : `Kurang ${Math.max(0, todayMetrics.bepPorsiNeeded - todayMetrics.todayCups)} Cup`}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Biaya Tetap Harian
                    </span>
                    <span className="text-xs font-black font-mono text-amber-950 block mt-0.5">
                      {formatRupiah(todayMetrics.dailyFixedCost)}
                    </span>
                    <span className="text-[9.5px] font-medium text-slate-400 block">
                      Prorata per Hari
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Net Cashflow Hari Ini
                    </span>
                    <span
                      className={`text-xs font-black font-mono block mt-0.5 ${
                        todayMetrics.todayNetCashflow >= 0 ? 'text-blue-900' : 'text-rose-600'
                      }`}
                    >
                      {formatRupiah(todayMetrics.todayNetCashflow)}
                    </span>
                    <span className="text-[9.5px] font-medium text-slate-400 block">
                      Masuk - Keluar
                    </span>
                  </div>
                </div>

                {/* Urgent Debt Warning if any */}
                {todayMetrics.debtAlerts.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-900 text-xs">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black block text-[11px]">Peringatan Jatuh Tempo Hutang!</span>
                      <span className="text-[10px] text-rose-800 leading-tight block">
                        Terdapat {todayMetrics.debtAlerts.length} pos cicilan yang mendekati jatuh tempo pembayaran.
                      </span>
                    </div>
                  </div>
                )}

                {/* AI Robot Briefing Output Box */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs text-xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <div className="flex items-center space-x-1.5 text-indigo-950 font-black text-[11px] uppercase">
                      <Bot className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Analisis Intelijen Robot</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateDailyReport}
                      disabled={isLoadingSummary}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center space-x-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingSummary ? 'animate-spin' : ''}`} />
                      <span>{isLoadingSummary ? 'Menganalisis...' : 'Perbarui'}</span>
                    </button>
                  </div>

                  <div className="text-slate-700 leading-relaxed max-h-[160px] overflow-y-auto pr-1">
                    {isLoadingSummary ? (
                      <div className="py-6 flex flex-col items-center justify-center space-y-2 text-slate-400">
                        <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin" />
                        <span className="text-[11px] font-bold">Robot sedang mengalkulasi data harian...</span>
                      </div>
                    ) : robotSummary ? (
                      <div className="space-y-1.5 text-[11.5px] font-medium">
                        {robotSummary.split('\n').map((line, i) => {
                          const t = line.trim();
                          if (t.startsWith('###')) {
                            return <p key={i} className="font-black text-slate-900 text-xs mt-1">{t.replace(/^###\s*/, '')}</p>;
                          }
                          if (t.startsWith('####')) {
                            return <p key={i} className="font-bold text-indigo-900 text-[11px] mt-1">{t.replace(/^####\s*/, '')}</p>;
                          }
                          if (t.startsWith('-') || t.startsWith('*')) {
                            return <li key={i} className="ml-3 list-disc text-slate-700">{t.replace(/^[-*]\s*/, '')}</li>;
                          }
                          if (!t) return <div key={i} className="h-1" />;
                          return <p key={i}>{t}</p>;
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">Belum ada analisis harian. Klik 'Perbarui'.</p>
                    )}
                  </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="flex items-center justify-between text-[11px] pt-1 font-bold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onNavigateToTab && onNavigateToTab('fixed_cost')}
                    className="hover:text-indigo-600 underline flex items-center space-x-1"
                  >
                    <span>Buka Evaluasi Kinerja Lengkap</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Ngobrol dengan Robot →
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: CHAT WITH ROBOT AI */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-[340px]">
                {/* Chat message stream */}
                <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex items-start space-x-2 ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.role === 'model' && (
                        <div className="p-1 bg-indigo-950 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-[82%] p-2.5 rounded-2xl text-xs font-medium leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                            : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <span
                          className={`text-[9px] block text-right mt-1 ${
                            msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                  {isSendingChat && (
                    <div className="flex items-center space-x-2 text-slate-400 text-xs italic">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                      <span>Robot AI sedang mengetik...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Suggestion Chips */}
                <div className="px-3 py-1.5 border-t border-slate-200/80 bg-white/80 flex items-center space-x-1.5 overflow-x-auto text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => handleSendChat('Berapa target omset harian minimum untuk untung?')}
                    className="whitespace-nowrap px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Target BEP Hari Ini?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat('Bagaimana cara menaikkan penjualan shift sore/malam?')}
                    className="whitespace-nowrap px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Trik Upselling Malam
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat('Apakah ada hutang yang perlu segera dibayar?')}
                    className="whitespace-nowrap px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Cek Tempo Hutang
                  </button>
                </div>

                {/* Chat Input Bar */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="p-2.5 bg-white border-t border-slate-200 flex items-center space-x-2"
                >
                  <input
                    type="text"
                    placeholder="Ketik pertanyaan untuk Robot Basco..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isSendingChat}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl disabled:opacity-50 transition shadow-xs shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
