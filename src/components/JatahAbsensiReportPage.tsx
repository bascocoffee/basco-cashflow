import React, { useEffect, useMemo, useState } from 'react';
import {
  Coffee,
  Users,
  Calendar,
  RefreshCw,
  Search,
  Lock,
  CheckCircle2,
  XCircle,
  Download,
  Clock,
  Award,
  FileSpreadsheet,
  Filter
} from 'lucide-react';
import {
  fetchJatahHarianReportFromSheet,
  JatahHarianRecord
} from '../sheetsService';

interface JatahAbsensiReportPageProps {
  spreadsheetId: string | null;
  token: string | null;
  spreadsheetUrl?: string | null;
}

const formatMonthLabel = (ymStr: string) => {
  if (!ymStr || ymStr === 'ALL') return 'Semua Bulan Terdata';
  const [year, month] = ymStr.split('-');
  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const mIdx = parseInt(month, 10) - 1;
  if (mIdx >= 0 && mIdx < 12) return `${monthsIndo[mIdx]} ${year}`;
  return ymStr;
};

const formatDateIndo = (dateStr: string) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthsIndo = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const mIdx = parseInt(m, 10) - 1;
  const mName = mIdx >= 0 && mIdx < 12 ? monthsIndo[mIdx] : m;
  return `${d} ${mName} ${y}`;
};

const getShiftBadgeCls = (shift: string) => {
  const s = shift.toLowerCase();
  if (s.includes('pagi')) return 'bg-sky-100 text-sky-800 border-sky-200';
  if (s.includes('sore')) return 'bg-amber-100 text-amber-900 border-amber-200';
  if (s.includes('manajemen')) return 'bg-purple-100 text-purple-800 border-purple-200';
  if (s.includes('tamu')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function JatahAbsensiReportPage({
  spreadsheetId,
  token,
  spreadsheetUrl,
}: JatahAbsensiReportPageProps) {
  const [records, setRecords] = useState<JatahHarianRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Filter States: Harian vs Bulanan
  const [timeframe, setTimeframe] = useState<'harian' | 'bulanan'>('bulanan');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Secondary Filters
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeViewTab, setActiveViewTab] = useState<'rekap_staf' | 'log_detail'>('rekap_staf');

  const loadData = async () => {
    if (!spreadsheetId || spreadsheetId.startsWith('local_')) {
      setErrorMsg('Spreadsheet Google belum terhubung.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchJatahHarianReportFromSheet(spreadsheetId, token);
      setRecords(data);
      setLastUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));

      // Auto-select latest available month if current month has no data
      if (data.length > 0) {
        const monthsSet = new Set(data.map((r) => r.tanggal.slice(0, 7)).filter((m) => m.length === 7));
        const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
        if (sortedMonths.length > 0 && !monthsSet.has(selectedMonth) && selectedMonth !== 'ALL') {
          setSelectedMonth(sortedMonths[0]);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengambil data dari Sheet JATAH HARIAN.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetId]);

  // Derived filter options
  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => {
      if (r.tanggal && r.tanggal.length >= 7) s.add(r.tanggal.slice(0, 7));
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const availableStaff = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => {
      if (r.nama) s.add(r.nama);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const availableShifts = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => {
      if (r.shift && r.shift !== '-') s.add(r.shift);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const latestDataDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString().split('T')[0];
    const dates = records.map((r) => r.tanggal).filter(Boolean).sort((a, b) => b.localeCompare(a));
    return dates[0] || new Date().toISOString().split('T')[0];
  }, [records]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records
      .filter((r) => {
        if (timeframe === 'harian') {
          if (r.tanggal !== selectedDate) return false;
        } else {
          if (selectedMonth !== 'ALL' && !r.tanggal.startsWith(selectedMonth)) return false;
        }
        if (selectedStaff !== 'ALL' && r.nama !== selectedStaff) return false;
        if (selectedShift !== 'ALL' && r.shift !== selectedShift) return false;
        if (q) {
          const hay = `${r.nama} ${r.shift} ${r.jatahMenu} ${r.keterangan}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [records, timeframe, selectedDate, selectedMonth, selectedStaff, selectedShift, searchQuery]);

  // Summary Stats & Staff Aggregation
  const summaryStats = useMemo(() => {
    let totalEntri = filteredRecords.length;
    let totalPorsi = 0;
    let ambilCount = 0;
    let tidakAmbilCount = 0;
    const uniqueDates = new Set<string>();
    const menuCounts = new Map<string, number>();

    const staffMap = new Map<
      string,
      {
        nama: string;
        totalHadir: number;
        ambilCount: number;
        tidakAmbilCount: number;
        totalPorsi: number;
        shifts: Record<string, number>;
        menus: Map<string, number>;
      }
    >();

    filteredRecords.forEach((r) => {
      if (r.tanggal) uniqueDates.add(r.tanggal);
      if (r.ambilJatah) {
        ambilCount++;
        totalPorsi += r.jumlahPorsi;
      } else {
        tidakAmbilCount++;
      }

      if (r.ambilJatah && r.jatahMenu && r.jatahMenu !== '-') {
        r.jatahMenu.split(',').forEach((m) => {
          const clean = m.trim();
          if (clean) {
            menuCounts.set(clean, (menuCounts.get(clean) || 0) + 1);
          }
        });
      }

      const existing = staffMap.get(r.nama) || {
        nama: r.nama,
        totalHadir: 0,
        ambilCount: 0,
        tidakAmbilCount: 0,
        totalPorsi: 0,
        shifts: {},
        menus: new Map<string, number>(),
      };

      existing.totalHadir += 1;
      if (r.ambilJatah) {
        existing.ambilCount += 1;
        existing.totalPorsi += r.jumlahPorsi;
      } else {
        existing.tidakAmbilCount += 1;
      }

      if (r.shift && r.shift !== '-') {
        existing.shifts[r.shift] = (existing.shifts[r.shift] || 0) + 1;
      }

      if (r.ambilJatah && r.jatahMenu && r.jatahMenu !== '-') {
        r.jatahMenu.split(',').forEach((m) => {
          const clean = m.trim();
          if (clean) {
            existing.menus.set(clean, (existing.menus.get(clean) || 0) + 1);
          }
        });
      }

      staffMap.set(r.nama, existing);
    });

    const staffList = Array.from(staffMap.values()).sort((a, b) => b.totalPorsi - a.totalPorsi || b.totalHadir - a.totalHadir);
    const topMenus = Array.from(menuCounts.entries()).sort((a, b) => b[1] - a[1]);

    return {
      totalEntri,
      totalPorsi,
      ambilCount,
      tidakAmbilCount,
      uniqueDaysCount: uniqueDates.size,
      uniqueStaffCount: staffList.length,
      staffList,
      topMenu: topMenus[0] || null,
    };
  }, [filteredRecords]);

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'ID,Tanggal,Timestamp,Nama Staf,Shift / Status Absensi,Ambil Jatah?,Menu Jatah,Jumlah Porsi,Keterangan\n';
    filteredRecords.forEach((r) => {
      csv += `"${r.id}","${r.tanggal}","${r.timestamp}","${r.nama.replace(/"/g, '""')}","${r.shift.replace(/"/g, '""')}","${r.ambilJatah ? 'YA' : 'TIDAK'}","${r.jatahMenu.replace(/"/g, '""')}",${r.jumlahPorsi},"${r.keterangan.replace(/"/g, '""')}"\n`;
    });
    const encoded = encodeURI(csv);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = `laporan_jatah_absensi_${timeframe}_${timeframe === 'harian' ? selectedDate : selectedMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
            <Coffee className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Laporan Jatah & Absensi Staf
              </h2>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-slate-900 text-amber-300 text-[10px] font-black uppercase rounded-full tracking-wider">
                <Lock className="h-2.5 w-2.5" />
                <span>Read-Only • Sheet JATAH HARIAN</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Data diambil langsung secara real-time (hanya baca) dari tab Google Sheets <strong>JATAH HARIAN</strong> tanpa mengubah data asli.
            </p>
            {lastUpdated && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>Terakhir dimuat: {lastUpdated} ({records.length} total baris di sheet)</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Memuat...' : 'Refresh Sheet'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
              <span>Buka Sheet</span>
            </a>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Filter Bar: Harian vs Bulanan + Staf + Shift */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Periode Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-amber-600" />
              <span>Mode Laporan:</span>
            </span>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTimeframe('harian')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  timeframe === 'harian'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📅 Harian
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('bulanan')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  timeframe === 'bulanan'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🗓️ Bulanan
              </button>
            </div>

            {timeframe === 'harian' ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-xl transition cursor-pointer"
                >
                  Hari Ini
                </button>
                {latestDataDate !== selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(latestDataDate)}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold rounded-xl transition cursor-pointer"
                  >
                    Data Terbaru ({formatDateIndo(latestDataDate)})
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="ALL">Semua Bulan Terdata</option>
                  {availableMonths.map((ym) => (
                    <option key={ym} value={ym}>
                      🗓️ {formatMonthLabel(ym)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Staf, Shift & Search Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">Semua Staf ({availableStaff.length})</option>
                {availableStaff.map((staf) => (
                  <option key={staf} value={staf}>
                    {staf}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">Semua Shift</option>
              {availableShifts.map((sh) => (
                <option key={sh} value={sh}>
                  {sh}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari menu / catatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Total Absensi Tercatat
            </span>
            <Users className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{summaryStats.totalEntri}x</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            {summaryStats.uniqueStaffCount} staf/pihak • {summaryStats.uniqueDaysCount} hari aktif
          </p>
        </div>

        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
              Total Jatah Diambil
            </span>
            <Coffee className="h-4 w-4 text-amber-700" />
          </div>
          <p className="text-2xl font-black text-amber-950 mt-1.5">{summaryStats.totalPorsi} Porsi</p>
          <p className="text-[11px] text-amber-800 font-medium mt-0.5">
            Periode: {timeframe === 'harian' ? formatDateIndo(selectedDate) : formatMonthLabel(selectedMonth)}
          </p>
        </div>

        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
              Status Pengambilan
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-950 mt-1.5">
            {summaryStats.ambilCount} <span className="text-sm font-bold text-emerald-700">Ambil</span>
          </p>
          <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
            {summaryStats.tidakAmbilCount} catatan tidak mengambil jatah
          </p>
        </div>

        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">
              Menu Jatah Terbanyak
            </span>
            <Award className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="text-base font-black text-indigo-950 mt-2 truncate">
            {summaryStats.topMenu ? summaryStats.topMenu[0] : '-'}
          </p>
          <p className="text-[11px] text-indigo-700 font-medium mt-1">
            {summaryStats.topMenu ? `Diambil ${summaryStats.topMenu[1]} kali` : 'Belum ada data'}
          </p>
        </div>
      </div>

      {/* View Switcher & Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
            <button
              type="button"
              onClick={() => setActiveViewTab('rekap_staf')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeViewTab === 'rekap_staf'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👥 Rekap Per Staf ({summaryStats.staffList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('log_detail')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeViewTab === 'log_detail'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 Log Detail Absensi & Jatah ({filteredRecords.length})
            </button>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Menampilkan {filteredRecords.length} baris dari Sheet JATAH HARIAN
          </span>
        </div>

        {/* TAB 1: REKAP PER STAF */}
        {activeViewTab === 'rekap_staf' && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200">
                  <th className="py-2.5 px-3.5">No</th>
                  <th className="py-2.5 px-3.5">Nama Staf / Pihak</th>
                  <th className="py-2.5 px-3.5 text-center">Total Kehadiran</th>
                  <th className="py-2.5 px-3.5">Rincian Shift / Status</th>
                  <th className="py-2.5 px-3.5 text-center">Ambil / Tidak</th>
                  <th className="py-2.5 px-3.5 text-right bg-amber-50/70">Total Porsi Jatah</th>
                  <th className="py-2.5 px-3.5">Menu yang Diambil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {summaryStats.staffList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Tidak ada data absensi & jatah pada periode yang dipilih.
                    </td>
                  </tr>
                ) : (
                  summaryStats.staffList.map((staf, idx) => {
                    const shiftBadges = Object.entries(staf.shifts);
                    const menuSummary = Array.from(staf.menus.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([mName, cnt]) => `${mName} (${cnt}x)`)
                      .join(', ');

                    return (
                      <tr key={staf.nama} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-extrabold text-slate-900">{staf.nama}</td>
                        <td className="py-3 px-3.5 text-center font-mono font-black text-slate-800">
                          {staf.totalHadir}x
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex flex-wrap gap-1">
                            {shiftBadges.map(([shName, cnt]) => (
                              <span
                                key={shName}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getShiftBadgeCls(shName)}`}
                              >
                                {shName}: {cnt}x
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="text-emerald-700 font-bold">{staf.ambilCount} Ambil</span>
                          {staf.tidakAmbilCount > 0 && (
                            <span className="text-slate-400 ml-1.5">/ {staf.tidakAmbilCount} Tidak</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-black text-amber-900 bg-amber-50/40">
                          {staf.totalPorsi} porsi
                        </td>
                        <td className="py-3 px-3.5 text-[11px] text-slate-600 max-w-xs">
                          {menuSummary || <span className="text-slate-400 italic">-</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: LOG DETAIL ABSENSI & JATAH */}
        {activeViewTab === 'log_detail' && (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-xs">
                <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Nama</th>
                  <th className="py-2.5 px-3">Shift / Status Absensi</th>
                  <th className="py-2.5 px-3 text-center">Ambil Jatah?</th>
                  <th className="py-2.5 px-3">Menu Jatah</th>
                  <th className="py-2.5 px-3 text-right">Porsi</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3 text-right">Timestamp Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Tidak ada catatan pada periode / filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {formatDateIndo(r.tanggal)}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                        {r.nama}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getShiftBadgeCls(r.shift)}`}>
                          {r.shift}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {r.ambilJatah ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>YA</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">
                            <XCircle className="h-3 w-3" />
                            <span>TIDAK</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-amber-900">
                        {r.ambilJatah ? r.jatahMenu : <span className="text-slate-400 font-normal">Tidak Ambil</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {r.jumlahPorsi}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {r.keterangan || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {r.timestamp || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
