import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  BarChart3, 
  LineChart as LineChartIcon,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import { Transaction } from '../types';
import { formatRupiah, parseDateString, formatLocalDate } from '../utils';

const INDONESIAN_DAY_NAMES = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu'
];

const INDONESIAN_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface WeeklyFinancialReportCardProps {
  transactions: Transaction[];
  onOpenTransaction?: (transaction: Transaction) => void;
}

interface DailyFinancialData {
  dayName: string;
  dayShort: string;
  dateKey: string;
  dateObj: Date;
  dateLabel: string;
  fullDateLabel: string;
  debit: number;
  kredit: number;
  saldo: number;
  debitCount: number;
  kreditCount: number;
  totalCount: number;
  isToday: boolean;
  transactions: Transaction[];
}

export default function WeeklyFinancialReportCard({
  transactions
}: WeeklyFinancialReportCardProps) {
  // Week offset from current week: 0 = current week, -1 = last week, +1 = next week, etc.
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'table'>('bar');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DailyFinancialData | null>(null);

  // Helper to format Date to YYYY-MM-DD in local time
  const formatToDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to get Monday of the target week
  const getTargetMonday = (offset: number): Date => {
    const now = new Date();
    // In JS: 0=Sun, 1=Mon, ..., 6=Sat
    const currentDay = now.getDay();
    // Distance from Monday (1)
    const distanceToMonday = (currentDay + 6) % 7; // 0 for Mon, 1 for Tue, ..., 6 for Sun
    
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);
    
    // Apply week offset
    monday.setDate(monday.getDate() + offset * 7);
    return monday;
  };

  // Compute 7 days of the target week
  const targetWeekDates = useMemo(() => {
    const monday = getTargetMonday(weekOffset);
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [weekOffset]);

  const todayKey = formatToDateKey(new Date());

  // Aggregate financial data for the 7 days of the week
  const weeklyData = useMemo(() => {
    const dailyList: DailyFinancialData[] = targetWeekDates.map((dateObj, idx) => {
      const dateKey = formatToDateKey(dateObj);
      const dayName = INDONESIAN_DAY_NAMES[idx];
      const dayShort = dayName.substring(0, 3);
      const isToday = dateKey === todayKey;
      
      const dayDate = dateObj.getDate();
      const monthShort = INDONESIAN_MONTH_NAMES[dateObj.getMonth()].substring(0, 3);
      const dateLabel = `${dayDate} ${monthShort}`;
      const fullDateLabel = `${dayName}, ${dayDate} ${INDONESIAN_MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

      // Filter transactions matching this exact calendar date
      const dayTransactions = transactions.filter(t => {
        if (!t.tanggal) return false;
        const tDate = parseDateString(t.tanggal);
        return formatToDateKey(tDate) === dateKey;
      });

      let debit = 0;
      let kredit = 0;
      let debitCount = 0;
      let kreditCount = 0;

      dayTransactions.forEach(t => {
        const dVal = t.debit || 0;
        const kVal = (t.kredit || 0) + (t.kredit2 || 0);
        
        if (dVal > 0) {
          debit += dVal;
          debitCount += 1;
        }
        if (kVal > 0) {
          kredit += kVal;
          kreditCount += 1;
        }
      });

      return {
        dayName,
        dayShort,
        dateKey,
        dateObj,
        dateLabel,
        fullDateLabel,
        debit,
        kredit,
        saldo: debit - kredit,
        debitCount,
        kreditCount,
        totalCount: dayTransactions.length,
        isToday,
        transactions: dayTransactions
      };
    });

    // Summary calculations
    let totalDebit = 0;
    let totalKredit = 0;
    let totalTransactions = 0;
    let totalDebitCount = 0;
    let totalKreditCount = 0;

    let peakDebitDay: DailyFinancialData | null = null;
    let peakKreditDay: DailyFinancialData | null = null;

    dailyList.forEach(day => {
      totalDebit += day.debit;
      totalKredit += day.kredit;
      totalTransactions += day.totalCount;
      totalDebitCount += day.debitCount;
      totalKreditCount += day.kreditCount;

      if (day.debit > 0 && (!peakDebitDay || day.debit > peakDebitDay.debit)) {
        peakDebitDay = day;
      }
      if (day.kredit > 0 && (!peakKreditDay || day.kredit > peakKreditDay.kredit)) {
        peakKreditDay = day;
      }
    });

    const saldo = totalDebit - totalKredit;
    const totalFlow = totalDebit + totalKredit;
    const debitRatio = totalFlow > 0 ? (totalDebit / totalFlow) * 100 : 50;
    const kreditRatio = totalFlow > 0 ? (totalKredit / totalFlow) * 100 : 50;
    const netMargin = totalDebit > 0 ? (saldo / totalDebit) * 100 : 0;
    const avgDailyDebit = Math.round(totalDebit / 7);
    const avgDailyKredit = Math.round(totalKredit / 7);

    return {
      dailyList,
      totalDebit,
      totalKredit,
      saldo,
      totalTransactions,
      totalDebitCount,
      totalKreditCount,
      debitRatio: parseFloat(debitRatio.toFixed(1)),
      kreditRatio: parseFloat(kreditRatio.toFixed(1)),
      netMargin: parseFloat(netMargin.toFixed(1)),
      avgDailyDebit,
      avgDailyKredit,
      peakDebitDay,
      peakKreditDay
    };
  }, [targetWeekDates, transactions, todayKey]);

  // Week range label formatted nicely
  const weekRangeLabel = useMemo(() => {
    const start = targetWeekDates[0];
    const end = targetWeekDates[6];
    
    const startDay = start.getDate();
    const startMonth = INDONESIAN_MONTH_NAMES[start.getMonth()];
    const startYear = start.getFullYear();
    
    const endDay = end.getDate();
    const endMonth = INDONESIAN_MONTH_NAMES[end.getMonth()];
    const endYear = end.getFullYear();

    if (startYear === endYear) {
      if (startMonth === endMonth) {
        return `${startDay} – ${endDay} ${startMonth} ${startYear}`;
      }
      return `${startDay} ${startMonth.substring(0, 3)} – ${endDay} ${endMonth} ${startYear}`;
    }
    return `${startDay} ${startMonth.substring(0, 3)} ${startYear} – ${endDay} ${endMonth.substring(0, 3)} ${endYear}`;
  }, [targetWeekDates]);

  const isCurrentWeek = weekOffset === 0;

  // Custom Tooltip for Recharts
  const CustomWeeklyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: DailyFinancialData = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-700 text-xs space-y-1.5 select-none font-sans min-w-[190px] z-50">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
            <span className="font-extrabold text-slate-200">{data.fullDateLabel}</span>
            {data.isToday && (
              <span className="text-[9.5px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded">
                Hari Ini
              </span>
            )}
          </div>
          
          <div className="flex justify-between items-center space-x-3">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              Pemasukan (Debit):
            </span>
            <span className="font-bold text-emerald-400 font-mono">{formatRupiah(data.debit)}</span>
          </div>

          <div className="flex justify-between items-center space-x-3">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
              Pengeluaran (Kredit):
            </span>
            <span className="font-bold text-rose-400 font-mono">{formatRupiah(data.kredit)}</span>
          </div>

          <div className="flex justify-between items-center space-x-3 border-t border-slate-800 pt-1.5 mt-1">
            <span className="text-slate-400 font-bold">Arus Bersih (Saldo):</span>
            <span className={`font-black font-mono ${data.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatRupiah(data.saldo)}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 pt-1 text-right italic border-t border-slate-800/60">
            {data.totalCount} transaksi tercatat
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300"
      id="weekly-financial-report-card"
    >
      {/* HEADER SECTION WITH WEEK CONTROLLERS */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Title & Badge */}
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                Laporan Keuangan Mingguan
              </h3>
              {isCurrentWeek ? (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10.5px] font-extrabold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Minggu Berjalan</span>
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-300 text-[10px] font-bold">
                  {weekOffset < 0 ? `${Math.abs(weekOffset)} Minggu Lalu` : `${weekOffset} Minggu Mendatang`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-medium">
              Komparasi arus kas masuk (<strong className="text-emerald-400 font-bold">Debit</strong>) vs keluar (<strong className="text-rose-400 font-bold">Kredit</strong>) 7 hari kerja
            </p>
          </div>
        </div>

        {/* Week Navigator & Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Week Selector */}
          <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
              title="Minggu Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="px-3 py-1 flex items-center space-x-2 text-xs font-mono font-bold text-amber-300 min-w-[170px] justify-center text-center">
              <Calendar className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{weekRangeLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
              title="Minggu Berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Current Week Reset Button */}
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-1"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Kembali ke Minggu Ini</span>
            </button>
          )}

          {/* Chart View Mode Switcher */}
          <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                chartType === 'bar' 
                  ? 'bg-amber-500 text-slate-950 font-bold' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grafik Batang Komparasi"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                chartType === 'line' 
                  ? 'bg-amber-500 text-slate-950 font-bold' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grafik Garis Tren"
            >
              <LineChartIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                chartType === 'table' 
                  ? 'bg-amber-500 text-slate-950 font-bold' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Tabel Rincian Harian"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized(prev => !prev)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer border border-slate-700/60"
            title={isMinimized ? "Tampilkan Laporan" : "Sembunyikan Laporan"}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${isMinimized ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        </div>

      </div>

      {/* CARD BODY CONTENT */}
      {!isMinimized && (
        <div className="p-5 sm:p-6 space-y-6">

          {/* 1. TOP STATS CARDS (3 METRIC TILES) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* TOTAL DEBIT (PEMASUKAN MINGGUAN) */}
            <div className="bg-slate-50/80 hover:bg-emerald-50/30 transition-colors p-4 rounded-xl border border-slate-200/90 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                    Total Debit (Pemasukan)
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                    {formatRupiah(weeklyData.totalDebit)}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rata-rata / Hari:</span>
                <span className="font-mono font-bold text-slate-800">{formatRupiah(weeklyData.avgDailyDebit)}</span>
              </div>
            </div>

            {/* TOTAL KREDIT (PENGELUARAN MINGGUAN) */}
            <div className="bg-slate-50/80 hover:bg-rose-50/30 transition-colors p-4 rounded-xl border border-slate-200/90 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-md">
                    Total Kredit (Pengeluaran)
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-rose-600 font-mono tracking-tight mt-2">
                    {formatRupiah(weeklyData.totalKredit)}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ArrowDownRight className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rata-rata / Hari:</span>
                <span className="font-mono font-bold text-slate-800">{formatRupiah(weeklyData.avgDailyKredit)}</span>
              </div>
            </div>

            {/* SALDO BERSIH MINGGUAN (NET CASHFLOW) */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-colors ${
              weeklyData.saldo >= 0 
                ? 'bg-emerald-50/50 border-emerald-200/80' 
                : 'bg-rose-50/50 border-rose-200/80'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    weeklyData.saldo >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    Saldo Bersih Minggu Ini
                  </span>
                  <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight mt-2 ${
                    weeklyData.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {weeklyData.saldo >= 0 ? `+${formatRupiah(weeklyData.saldo)}` : formatRupiah(weeklyData.saldo)}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  weeklyData.saldo >= 0 ? 'bg-emerald-200/60 text-emerald-800' : 'bg-rose-200/60 text-rose-800'
                }`}>
                  {weeklyData.saldo >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">Status Arus Kas:</span>
                <span className={`font-black uppercase tracking-wide px-2 py-0.5 rounded text-[10px] ${
                  weeklyData.saldo >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {weeklyData.saldo > 0 ? 'Surplus Kas' : weeklyData.saldo < 0 ? 'Defisit Kas' : 'Imbang'}
                </span>
              </div>
            </div>

          </div>

          {/* 2. VISUAL RATIO COMPARISON BAR */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold text-slate-700 gap-1">
              <div className="flex items-center space-x-2">
                <span className="text-slate-500 uppercase tracking-wider text-[10.5px]">Rasio Perbandingan:</span>
                <span className="text-emerald-700 flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Debit {weeklyData.debitRatio}%</span>
                </span>
                <span className="text-slate-400">vs</span>
                <span className="text-rose-700 flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                  <span>Kredit {weeklyData.kreditRatio}%</span>
                </span>
              </div>

              <div className="text-[11px] text-slate-500">
                Total Transaksi: <strong className="text-slate-800">{weeklyData.totalTransactions} catatan</strong> ({weeklyData.totalDebitCount} IN / {weeklyData.totalKreditCount} OUT)
              </div>
            </div>

            {/* Progress Split Bar */}
            <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500 relative group"
                style={{ width: `${weeklyData.debitRatio}%` }}
                title={`Pemasukan: ${weeklyData.debitRatio}% (${formatRupiah(weeklyData.totalDebit)})`}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-500 relative group"
                style={{ width: `${weeklyData.kreditRatio}%` }}
                title={`Pengeluaran: ${weeklyData.kreditRatio}% (${formatRupiah(weeklyData.totalKredit)})`}
              />
            </div>
          </div>

          {/* 3. CHART & VISUALIZATION AREA */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <span>{chartType === 'bar' ? '📊 Grafik Batang Komparasi Harian' : chartType === 'line' ? '📈 Grafik Garis Tren Harian' : '📋 Tabel Transaksi Harian'}</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Rincian angka harian per hari kerja (Senin s/d Minggu)
                </p>
              </div>

              {/* Legend & Peak Indicators */}
              <div className="flex items-center space-x-4 text-[11px] font-bold">
                <div className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                  <span>Debit (Pemasukan)</span>
                </div>
                <div className="flex items-center space-x-1.5 text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                  <span>Kredit (Pengeluaran)</span>
                </div>
              </div>
            </div>

            {/* CHART DISPLAY */}
            {chartType === 'bar' && (
              <div className="w-full h-64 sm:h-72 text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyData.dailyList}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="dayShort" 
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const dayData = weeklyData.dailyList.find(d => d.dayShort === payload.value);
                        const isDayToday = dayData?.isToday;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text 
                              x={0} 
                              y={0} 
                              dy={14} 
                              textAnchor="middle" 
                              fill={isDayToday ? '#d97706' : '#64748b'}
                              fontWeight={isDayToday ? '900' : '700'}
                              fontSize={isDayToday ? 12 : 11}
                            >
                              {payload.value}
                            </text>
                            <text 
                              x={0} 
                              y={0} 
                              dy={27} 
                              textAnchor="middle" 
                              fill={isDayToday ? '#b45309' : '#94a3b8'}
                              fontWeight={isDayToday ? '800' : '500'}
                              fontSize={9.5}
                            >
                              {dayData?.dateLabel || ''}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                      tickFormatter={(val) => {
                        if (val === 0) return '0';
                        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                        if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
                        return String(val);
                      }}
                    />
                    <RechartsTooltip content={<CustomWeeklyTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.8 }} />
                    <Bar 
                      dataKey="debit" 
                      name="Pemasukan" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32}
                    />
                    <Bar 
                      dataKey="kredit" 
                      name="Pengeluaran" 
                      fill="#f43f5e" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartType === 'line' && (
              <div className="w-full h-64 sm:h-72 text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={weeklyData.dailyList}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="dayShort" 
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}
                    />
                    <YAxis 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                      tickFormatter={(val) => {
                        if (val === 0) return '0';
                        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                        if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
                        return String(val);
                      }}
                    />
                    <RechartsTooltip content={<CustomWeeklyTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
                    <Line 
                      type="monotone" 
                      dataKey="debit" 
                      name="Pemasukan" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 1.5, fill: '#fff' }}
                      activeDot={{ r: 6, fill: '#10b981' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="kredit" 
                      name="Pengeluaran" 
                      stroke="#f43f5e" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 1.5, fill: '#fff' }}
                      activeDot={{ r: 6, fill: '#f43f5e' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="saldo" 
                      name="Saldo Bersih" 
                      stroke="#0284c7" 
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#0284c7' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartType === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase font-black text-slate-600">
                      <th className="py-2.5 px-3">Hari & Tanggal</th>
                      <th className="py-2.5 px-3 text-right text-emerald-800">Debit (Masuk)</th>
                      <th className="py-2.5 px-3 text-right text-rose-800">Kredit (Keluar)</th>
                      <th className="py-2.5 px-3 text-right text-slate-800">Arus Bersih</th>
                      <th className="py-2.5 px-3 text-center">Jumlah Transaksi</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weeklyData.dailyList.map((day, idx) => (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50/80 transition ${
                          day.isToday ? 'bg-amber-50/60 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{day.dayName}</span>
                            <span className="text-[11px] font-mono text-slate-500">({day.dateLabel})</span>
                            {day.isToday && (
                              <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-bold uppercase">
                                Hari Ini
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                          {day.debit > 0 ? formatRupiah(day.debit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                          {day.kredit > 0 ? formatRupiah(day.kredit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold">
                          <span className={day.saldo > 0 ? 'text-emerald-700' : day.saldo < 0 ? 'text-rose-700' : 'text-slate-400'}>
                            {day.saldo !== 0 ? formatRupiah(day.saldo) : 'Rp 0'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-600">
                          {day.totalCount > 0 ? (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {day.totalCount} entri
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {day.totalCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedDayDetail(day)}
                              className="px-2 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-600 text-[10.5px] font-bold rounded-lg transition cursor-pointer flex items-center space-x-1 mx-auto"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Lihat</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-black text-slate-900">
                      <td className="py-3 px-3">TOTAL 7 HARI MINGGU INI</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatRupiah(weeklyData.totalDebit)}</td>
                      <td className="py-3 px-3 text-right font-mono text-rose-700">{formatRupiah(weeklyData.totalKredit)}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className={weeklyData.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {formatRupiah(weeklyData.saldo)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">{weeklyData.totalTransactions} Catatan</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

          </div>

          {/* 4. DAILY MATRIX 7-DAY MINI CARDS STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {weeklyData.dailyList.map((day, idx) => {
              const hasActivity = day.debit > 0 || day.kredit > 0;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (day.totalCount > 0) setSelectedDayDetail(day);
                  }}
                  className={`p-3 rounded-xl border text-center transition flex flex-col justify-between ${
                    day.isToday 
                      ? 'bg-amber-50/90 border-amber-300 shadow-xs ring-2 ring-amber-400/30' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                  } ${day.totalCount > 0 ? 'cursor-pointer hover:border-slate-300' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1.5">
                      <span className={`text-[11px] font-black uppercase ${day.isToday ? 'text-amber-900' : 'text-slate-700'}`}>
                        {day.dayShort}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {day.dateLabel}
                      </span>
                    </div>

                    {day.isToday && (
                      <span className="block text-[8.5px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded uppercase tracking-wider mb-1.5">
                        Hari Ini
                      </span>
                    )}

                    <div className="space-y-1 text-left my-1.5 font-mono text-[10.5px]">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 font-sans font-bold">IN:</span>
                        <span className={day.debit > 0 ? 'font-bold text-emerald-600' : 'text-slate-300'}>
                          {day.debit > 0 ? formatRupiah(day.debit).replace('Rp\u00A0', '') : '0'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 font-sans font-bold">OUT:</span>
                        <span className={day.kredit > 0 ? 'font-bold text-rose-600' : 'text-slate-300'}>
                          {day.kredit > 0 ? formatRupiah(day.kredit).replace('Rp\u00A0', '') : '0'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-medium">Net:</span>
                    <span className={`font-black font-mono ${
                      day.saldo > 0 ? 'text-emerald-700' : day.saldo < 0 ? 'text-rose-700' : 'text-slate-400'
                    }`}>
                      {day.saldo > 0 ? `+${formatRupiah(day.saldo).replace('Rp\u00A0', '')}` : day.saldo < 0 ? formatRupiah(day.saldo).replace('Rp\u00A0', '') : '0'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* MODAL / DRAWER DETAIL TRANSAKSI HARIAN TERPILIH */}
      {selectedDayDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black">{selectedDayDetail.fullDateLabel}</h4>
                  <p className="text-[11px] text-slate-400">
                    {selectedDayDetail.totalCount} transaksi ({selectedDayDetail.debitCount} Masuk, {selectedDayDetail.kreditCount} Keluar)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Day Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Debit</span>
                <span className="font-mono font-bold text-emerald-600 text-xs">
                  {formatRupiah(selectedDayDetail.debit)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Kredit</span>
                <span className="font-mono font-bold text-rose-600 text-xs">
                  {formatRupiah(selectedDayDetail.kredit)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Saldo Bersih</span>
                <span className={`font-mono font-black text-xs ${
                  selectedDayDetail.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {formatRupiah(selectedDayDetail.saldo)}
                </span>
              </div>
            </div>

            {/* Transactions List */}
            <div className="p-4 max-h-80 overflow-y-auto space-y-2">
              {selectedDayDetail.transactions.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada transaksi pada tanggal ini</p>
              ) : (
                selectedDayDetail.transactions.map((t, idx) => {
                  const isDebit = (t.debit || 0) > 0;
                  const kreditTotal = (t.kredit || 0) + (t.kredit2 || 0);
                  return (
                    <div 
                      key={idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                            isDebit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isDebit ? 'Pemasukan' : 'Pengeluaran'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[140px]">
                            {t.jenisPengeluaran || 'Umum'}
                          </span>
                          {t.operasionalDanManajemen && t.operasionalDanManajemen !== '-' && (
                            <span className="text-[9px] font-semibold text-slate-500 bg-slate-200/80 px-1.5 py-0.2 rounded">
                              {t.operasionalDanManajemen}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800 truncate" title={t.keterangan}>
                          {t.keterangan || 'Tanpa keterangan'}
                        </p>
                      </div>

                      <div className="text-right font-mono font-extrabold shrink-0">
                        {isDebit ? (
                          <span className="text-emerald-600">+{formatRupiah(t.debit)}</span>
                        ) : (
                          <span className="text-rose-600">-{formatRupiah(kreditTotal)}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
