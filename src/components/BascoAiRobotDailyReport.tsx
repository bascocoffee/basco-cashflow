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
import { computeLiveInventoryStock, LiveIngredientStockItem } from '../utils/inventoryEngine';

interface BascoAiRobotDailyReportProps {
  userRole?: AppRole;
  transactions?: Transaction[];
  spreadsheetUrl?: string | null;
  onNavigateToTab?: (tab: string) => void;
}

interface RobotChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  actionTab?: string;
  actionLabel?: string;
}

/**
 * Karakter Maskot SVG "Basco" — Asisten Aplikasi & Asisten Pribadi Owner
 */
function BascoCharacterAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  return (
    <div className={`${dims} rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 p-0.5 shadow-md shrink-0 flex items-center justify-center relative`}>
      <svg viewBox="0 0 64 64" className="w-full h-full rounded-[14px] bg-slate-950" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Antenna / Coffee Steam */}
        <circle cx="32" cy="7" r="3.5" fill="#34D399" />
        <rect x="30.5" y="10" width="3" height="6" rx="1.5" fill="#F59E0B" />
        {/* Robot Head */}
        <rect x="12" y="16" width="40" height="34" rx="12" fill="#1E293B" stroke="#F59E0B" strokeWidth="2.5" />
        {/* Ear / Headset Pods */}
        <rect x="6" y="26" width="6" height="14" rx="3" fill="#F59E0B" />
        <rect x="52" y="26" width="6" height="14" rx="3" fill="#F59E0B" />
        {/* Visor Screen */}
        <rect x="17" y="23" width="30" height="16" rx="7" fill="#0F172A" />
        {/* Expressive Eyes */}
        <circle cx="25.5" cy="31" r="3.2" fill="#34D399" />
        <circle cx="38.5" cy="31" r="3.2" fill="#34D399" />
        <circle cx="26.5" cy="29.8" r="1" fill="#FFFFFF" />
        <circle cx="39.5" cy="29.8" r="1" fill="#FFFFFF" />
        {/* Friendly Smile */}
        <path d="M26 43.5C28 45.8 36 45.8 38 43.5" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
        {/* Mini Coffee Cup Badge */}
        <path d="M27 53H37L35.5 59H28.5L27 53Z" fill="#D97706" />
      </svg>
    </div>
  );
}

/**
 * Knowledge Base Karakter Basco: Panduan Penggunaan Aplikasi & Asisten Owner
 */
function matchBascoAppGuide(
  question: string,
  metrics: {
    effectiveTodayOmset: number;
    todayCups: number;
    dailyFixedCost: number;
    bepPercent: number;
    dailyBepOmset: number;
    topMenuName: string;
    overdueCount: number;
    dueSoonCount: number;
    totalRemainingDebt: number;
    lowStockItems?: LiveIngredientStockItem[];
  }
): { content: string; actionTab?: string; actionLabel?: string } | null {
  const q = question.toLowerCase();

  // 1. Panduan umum / daftar fitur aplikasi
  if (
    q.includes('cara pakai') ||
    q.includes('panduan') ||
    q.includes('bantuan') ||
    q.includes('fitur apa') ||
    q.includes('menu apa') ||
    q.includes('fungsi aplikasi')
  ) {
    return {
      content: `Halo Bos! Saya **Basco**, asisten pribadi Anda di aplikasi ini. Berikut panduan singkat fungsi menu utama:\n\n1. **Dasbor Utama:** Catat arus kas masuk/keluar harian & pantau saldo kas.\n2. **Analisis COGS & Sales:** Input penjualan menu harian, jatah barista, edit resep/HPP, dan laporan barang masuk.\n3. **Stok Opname Bulanan:** Audit selisih stok bahan baku tiap akhir bulan.\n4. **Jadwal & Tugas Barista:** Atur shift kerja dan checklist tugas staf.\n5. **Pencatatan Hutang:** Pantau jatuh tempo supplier, cicilan & KUR.\n6. **Kinerja Global & AI:** Evaluasi BEP, rasio biaya tetap, dan analisis keuangan mendalam.\n\nTanyakan saja bagian mana yang ingin Anda pelajari, misalnya *"Cara input penjualan harian"*!`,
      actionTab: 'dashboard',
      actionLabel: 'Buka Dasbor Utama'
    };
  }

  // 2. Cara input penjualan harian / jatah / cups
  if (
    (q.includes('cara') || q.includes('gimana') || q.includes('bagaimana') || q.includes('input')) &&
    (q.includes('penjualan') || q.includes('sales') || q.includes('cup') || q.includes('jatah') || q.includes('omset'))
  ) {
    return {
      content: `**Cara Input Penjualan Harian & Jatah Barista:**\n1. Buka menu **Analisis COGS & Sales** di sidebar.\n2. Pastikan berada di tab **1. Pencatatan Harian**.\n3. Pilih **Tanggal** yang ingin diinput.\n4. Isi jumlah **Terjual (Cups)** dan **Jatah Barista** per menu (bisa juga pakai fitur *Scan Struk* otomatis).\n5. Klik **Simpan Data Penjualan Harian** — data langsung tersimpan ke **Cloud MySQL & Google Sheets**!`,
      actionTab: 'omset_cogs',
      actionLabel: 'Buka Menu COGS & Penjualan'
    };
  }

  // 3. Cara edit resep / HPP / tambah menu / barang masuk
  if (
    (q.includes('cara') || q.includes('gimana') || q.includes('bagaimana') || q.includes('edit') || q.includes('ubah') || q.includes('tambah')) &&
    (q.includes('resep') || q.includes('hpp') || q.includes('menu') || q.includes('bahan') || q.includes('barang masuk'))
  ) {
    return {
      content: `**Cara Mengelola Menu, Resep HPP & Barang Masuk:**\n1. Masuk ke menu **Analisis COGS & Sales**.\n2. Pilih tab **2. Penjualan Menu** atau **3. Kalkulator COGS** untuk menambah menu baru, mengatur harga jual, atau mengedit takaran resep bahan baku (HPP otomatis terhitung).\n3. Untuk mencatat pembelian/kulakan bahan baku beserta notanya, pilih tab **5. Barang Masuk**.`,
      actionTab: 'omset_cogs',
      actionLabel: 'Buka Katalog & Resep COGS'
    };
  }

  // 4. Cara catat transaksi kas / pengeluaran / pemasukan
  if (
    (q.includes('cara') || q.includes('gimana') || q.includes('bagaimana') || q.includes('catat') || q.includes('input')) &&
    (q.includes('transaksi') || q.includes('kas') || q.includes('pengeluaran') || q.includes('pemasukan') || q.includes('belanja'))
  ) {
    return {
      content: `**Cara Mencatat Transaksi Kas Masuk / Keluar:**\n1. Buka **Dasbor Utama**.\n2. Klik tombol hijau **+ Transaksi Baru** di kanan atas.\n3. Pilih tipe (**Pemasukan** atau **Pengeluaran**), isi nominal, tanggal, kategori, dan keterangan.\n4. Klik **Simpan** — transaksi otomatis masuk ke buku kas, Cloud MySQL, dan Google Sheets.`,
      actionTab: 'dashboard',
      actionLabel: 'Buka Dasbor Utama'
    };
  }

  // 5. MySQL & Google Sheets info
  if (q.includes('mysql') || q.includes('database') || q.includes('spreadsheet') || q.includes('sheets') || q.includes('sinkron')) {
    return {
      content: `**Info Penyimpanan Ganda (Dual-Storage):**\nAplikasi Basco menyimpan seluruh data secara bersamaan ke:\n• **TiDB Cloud MySQL** (online 24 jam, instan, bebas error token).\n• **Google Sheets** (backup & tampilan spreadsheet).\n\nDi sidebar kiri bagian bawah, pastikan indikator **MySQL DB Aktif** menyala biru/cyan dan **Google Sheets Aktif** menyala hijau. Jika butuh tarik ulang data terbaru, klik tombol **Refresh** di kartu tersebut.`
    };
  }

  // 6. Stok opname & jadwal barista
  if ((q.includes('cara') || q.includes('gimana') || q.includes('bagaimana')) && (q.includes('stok') || q.includes('opname'))) {
    return {
      content: `**Cara Melakukan Stok Opname Bulanan:**\n1. Buka menu **Stok Opname Bulanan** di sidebar.\n2. Pilih bulan audit yang diinginkan.\n3. Masukkan stok fisik akhir hasil perhitungan di bar/gudang.\n4. Klik **Simpan ke Google Sheets** untuk merekam selisih pemakaian bahan baku.`,
      actionTab: 'cogs',
      actionLabel: 'Buka Stok Opname'
    };
  }

  if ((q.includes('cara') || q.includes('gimana') || q.includes('bagaimana')) && (q.includes('jadwal') || q.includes('shift') || q.includes('tugas'))) {
    return {
      content: `**Cara Mengatur Jadwal & Tugas Staf:**\n• Gunakan menu **Jadwal Operasional** untuk mengatur roster shift pagi/sore barista.\n• Gunakan menu **Tugas Karyawan** untuk memantau *checklist* pekerjaan harian dan alokasi upah staf.`,
      actionTab: 'barista_schedule',
      actionLabel: 'Buka Jadwal Operasional'
    };
  }

  // 7. Evaluasi hutang & tempo (owner assistant shortcut)
  if (q.includes('hutang') || q.includes('tempo') || q.includes('cicilan')) {
    return {
      content: `**Ringkasan Kewajiban Hutang & Tempo:**\n• Total Sisa Hutang Aktif: **${formatRupiah(metrics.totalRemainingDebt)}**\n• Jatuh Tempo Terdekat: **${metrics.overdueCount} lewat tempo**, **${metrics.dueSoonCount} segera jatuh tempo**.\n\nUntuk melihat rincian kreditor atau mencatat pembayaran cicilan, langsung klik tombol di bawah ini ya Bos!`,
      actionTab: 'debt_tracker',
      actionLabel: 'Buka Pencatatan Hutang'
    };
  }

  // 8. Target BEP hari ini
  if (q.includes('bep') || (q.includes('target') && q.includes('hari ini'))) {
    const kurang = Math.max(0, metrics.dailyBepOmset - metrics.effectiveTodayOmset);
    return {
      content: `**Status Target BEP Hari Ini:**\n• Omset Tercatat Hari Ini: **${formatRupiah(metrics.effectiveTodayOmset)}** (${metrics.todayCups} cups)\n• Beban Tetap & Cicilan Harian: **${formatRupiah(metrics.dailyFixedCost)}**\n• Target Omset BEP Harian: **${formatRupiah(metrics.dailyBepOmset)}** (Tercapai **${metrics.bepPercent}%**)\n• ${kurang === 0 ? '✅ **Target BEP hari ini sudah terlampaui, Bos!** Penjualan selanjutnya adalah margin profit.' : `⏳ Kurang **${formatRupiah(kurang)}** lagi untuk menutup seluruh beban harian.`}`,
      actionTab: 'fixed_cost',
      actionLabel: 'Buka Evaluasi Kinerja Global'
    };
  }

  // 9. Cek stok menipis / pemotongan stok otomatis
  if (
    q.includes('stok menipis') ||
    q.includes('bahan habis') ||
    q.includes('stok bahan') ||
    q.includes('sisa stok') ||
    q.includes('mau habis') ||
    q.includes('perlu belanja')
  ) {
    const alerts = metrics.lowStockItems || [];
    if (alerts.length === 0) {
      return {
        content: `✅ **Laporan Stok Bahan Baku Live:**\nSeluruh stok bahan baku terpantau dalam kondisi **AMAN** dan mencukupi berdasarkan hitungan pemotongan otomatis resep.`,
        actionTab: 'omset_cogs',
        actionLabel: 'Lihat Stok Bahan Live'
      };
    }
    const listText = alerts
      .slice(0, 6)
      .map(
        (a) =>
          `• **${a.namaBahan}**: Sisa **${Math.round(a.remainingStock).toLocaleString('id-ID')} ${a.satuanTakaran}** (${a.status.toUpperCase()}${a.daysRemaining !== null ? ` • ~${a.daysRemaining.toFixed(1)} hari` : ''})`
      )
      .join('\n');
    return {
      content: `⚠️ **Peringatan Stok Bahan Baku Menipis (${alerts.length} item):**\n${listText}${alerts.length > 6 ? `\n• *...dan ${alerts.length - 6} bahan lainnya*` : ''}\n\nKlik tombol di bawah untuk lihat detail pemotongan otomatis & salin daftar belanja!`,
      actionTab: 'omset_cogs',
      actionLabel: 'Buka Stok Bahan Live'
    };
  }

  return null;
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

  // Chat with Basco Assistant state
  const [chatMessages, setChatMessages] = useState<RobotChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('basco_robot_chat_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        role: 'model',
        content: `Halo Bos! ☕🤖 Saya **Basco**, karakter asisten pribadi Anda & pemandu aplikasi **Basco Cashflow**.\n\nAnda bisa bertanya tentang:\n• **Cara menggunakan fitur & menu aplikasi** (input penjualan, edit resep HPP, stok, MySQL/Sheets).\n• **Laporan & strategi bisnis Owner** (omset hari ini, BEP, hutang tempo, margin).\n\nAda yang bisa Basco bantu hari ini?`,
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
    const overdueCount = activeDebts.filter(d => getDueDateStatus(d).status === 'overdue').length;
    const dueSoonCount = debtAlerts.length - overdueCount;
    const totalRemainingDebt = activeDebts.reduce((s, d) => s + (Number(d.remainingAmount) || 0), 0);

    // 7. Live Inventory Low Stock Alerts (Auto-deducted from recipes)
    let lowStockItems: LiveIngredientStockItem[] = [];
    try {
      const rawIngs = JSON.parse(localStorage.getItem('aruskas_cogs_ingredients') || '[]');
      const rawBatches = JSON.parse(localStorage.getItem('aruskas_cogs_incoming_batches') || '[]');
      const rawMenu = JSON.parse(localStorage.getItem('aruskas_cogs_page_menu_catalog') || '[]');
      if (Array.isArray(rawIngs) && rawIngs.length > 0) {
        const inv = computeLiveInventoryStock({
          ingredients: rawIngs,
          incomingBatches: Array.isArray(rawBatches) ? rawBatches : [],
          dailySales,
          menuItems: Array.isArray(rawMenu) ? rawMenu : [],
          todayStr,
        });
        lowStockItems = inv.items.filter(i => i.status !== 'aman');
      }
    } catch {
      // ignore
    }

    // 8. Today's Top Menu item
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
      overdueCount,
      dueSoonCount,
      totalRemainingDebt,
      lowStockItems,
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

  const handleResetChat = () => {
    const initialMsg: RobotChatMessage = {
      role: 'model',
      content: `Halo Bos! ☕🤖 Saya **Basco**, karakter asisten pribadi Anda & pemandu aplikasi **Basco Cashflow**.\n\nAda yang ingin ditanyakan seputar penggunaan aplikasi atau kondisi kafe hari ini?`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages([initialMsg]);
    localStorage.setItem('basco_robot_chat_history', JSON.stringify([initialMsg]));
  };

  // Chat send handler (App Assistant + Owner Business Assistant)
  const handleSendChat = async (overrideText?: string) => {
    const text = (overrideText || chatInput).trim();
    if (!text || isSendingChat) return;

    const userMsg: RobotChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatInput('');
    setIsSendingChat(true);

    // 1. Check built-in Basco App Guide & Quick Owner Assistant first
    const localGuide = matchBascoAppGuide(text, todayMetrics);
    if (localGuide) {
      setTimeout(() => {
        setChatMessages(prev => [
          ...prev,
          {
            role: 'model',
            content: localGuide.content,
            actionTab: localGuide.actionTab,
            actionLabel: localGuide.actionLabel,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsSendingChat(false);
      }, 220);
      return;
    }

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'claude',
          question: text,
          messages: nextMessages,
          periodName: 'Hari Ini & Bulan Berjalan',
          stats: {
            totalDebit: todayMetrics.effectiveTodayOmset || todayMetrics.todayInflow,
            totalKredit: todayMetrics.todayOutflow,
            saldo: todayMetrics.todayNetCashflow,
          },
          cafeMetrics: {
            totalSales: todayMetrics.effectiveTodayOmset,
            cups: todayMetrics.todayCups,
            totalFixedCost: todayMetrics.dailyFixedCost,
            totalDebt: todayMetrics.dailyDebtCost,
            bepRevenue: todayMetrics.dailyBepOmset,
            bepProgressPct: todayMetrics.bepPercent,
          },
          context: {
            role: 'Basco Karakter Asisten Aplikasi & Asisten Pribadi Owner',
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
      const reply = data.reply || data.answer || 'Basco siap membantu Bos!';
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
          content: `Berdasarkan data hari ini, omset kafe tercatat **Rp ${todayMetrics.effectiveTodayOmset.toLocaleString('id-ID')}** (${todayMetrics.todayCups} cups), menutup **${todayMetrics.bepPercent}%** dari kebutuhan biaya tetap harian (Rp ${todayMetrics.dailyFixedCost.toLocaleString('id-ID')}).\n\nBos juga bisa tanya cara pakai menu aplikasi (misal: *"Cara input penjualan"* atau *"Cara edit resep HPP"*).`,
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

          <BascoCharacterAvatar size="md" />
          <div className="text-left hidden sm:block pr-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block leading-tight">
              Asisten Owner & Aplikasi
            </span>
            <span className="text-xs font-black tracking-tight text-white block">
              Tanya Basco 🤖
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
              <BascoCharacterAvatar size="md" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-black text-white tracking-tight truncate">
                  Basco — Asisten AI
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase">
                  Owner Guide
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-medium truncate">
                {timeGreeting}, Bos! • Panduan & Bisnis
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
                <span>Tanya Basco (Chat)</span>
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

                {/* Low Stock Warning if any */}
                {todayMetrics.lowStockItems.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between space-x-2 text-amber-950 text-xs">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black block text-[11px]">
                          Peringatan Stok Menipis ({todayMetrics.lowStockItems.length} Bahan)
                        </span>
                        <span className="text-[10px] text-amber-900 leading-tight block">
                          {todayMetrics.lowStockItems
                            .slice(0, 3)
                            .map((i) => `${i.namaBahan} (${Math.round(i.remainingStock)} ${i.satuanTakaran})`)
                            .join(', ')}
                        </span>
                      </div>
                    </div>
                    {onNavigateToTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('omset_cogs')}
                        className="text-[10px] font-black text-amber-900 underline shrink-0 cursor-pointer"
                      >
                        Cek
                      </button>
                    )}
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
                    Tanya Asisten Basco →
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: CHAT WITH BASCO CHARACTER ASSISTANT */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-[350px]">
                {/* Sub-bar with persona badge & Reset Chat */}
                <div className="px-3.5 py-1.5 bg-amber-50/80 border-b border-amber-200/70 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-amber-900">
                    ☕ Mode Asisten Aplikasi & Owner
                  </span>
                  <button
                    type="button"
                    onClick={handleResetChat}
                    className="text-slate-500 hover:text-rose-600 font-bold transition cursor-pointer"
                    title="Bersihkan obrolan dan mulai ulang"
                  >
                    Reset Chat
                  </button>
                </div>

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
                        <div className="shrink-0 mt-0.5">
                          <BascoCharacterAvatar size="sm" />
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
                        {msg.role === 'model' && msg.actionTab && msg.actionLabel && onNavigateToTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab(msg.actionTab!)}
                            className="mt-2 inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10.5px] font-black transition cursor-pointer"
                          >
                            <span>{msg.actionLabel}</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
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
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600" />
                      <span>Basco sedang menyiapkan jawaban...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Suggestion Chips (Panduan Aplikasi + Asisten Owner) */}
                <div className="px-3 py-1.5 border-t border-slate-200/80 bg-white/90 flex items-center space-x-1.5 overflow-x-auto text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => handleSendChat('Bagaimana cara pakai aplikasi ini dan apa saja fiturnya?')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                  >
                    📖 Cara Pakai Aplikasi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat('Cek stok menipis dan bahan yang mau habis')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition cursor-pointer"
                  >
                    📦 Cek Stok Menipis
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat('Bagaimana cara input penjualan harian & resep HPP?')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    ☕ Input Penjualan & HPP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat('Berapa target BEP hari ini?')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    🎯 Target BEP Hari Ini?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat('Apakah ada hutang yang perlu segera dibayar?')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    💳 Cek Tempo Hutang
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat('Bagaimana status database MySQL & Google Sheets?')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    🗄️ Info MySQL & Sheets
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
                    placeholder="Tanya Basco (cara pakai aplikasi / kondisi kafe)..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isSendingChat}
                    className="p-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-xl disabled:opacity-50 transition shadow-xs shrink-0 cursor-pointer"
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
