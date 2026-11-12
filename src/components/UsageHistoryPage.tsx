import { useState, useEffect, useMemo } from 'react';
import {
  History,
  Crown,
  Briefcase,
  Coffee,
  RefreshCw,
  Search,
  Download,
  Trash2,
  ShieldCheck,
  Smartphone,
  Clock,
  LogIn,
  LogOut,
  PlusCircle,
  Edit3,
  Camera,
  Eye,
  FileSpreadsheet,
  Filter
} from 'lucide-react';
import { AppRole } from '../types';
import {
  AppActivityLog,
  ActivityActionType,
  fetchAppActivityLogs,
  pruneAppActivityLogs,
  readLocalActivityLogs
} from '../utils/activityLogger';

const ROLE_META: Record<
  AppRole,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    cardBorder: string;
    cardAccent: string;
    icon: typeof Crown;
  }
> = {
  owner: {
    label: 'Owner',
    badgeBg: 'bg-amber-100 border-amber-300',
    badgeText: 'text-amber-900',
    cardBorder: 'border-amber-200 bg-amber-50/40',
    cardAccent: 'bg-amber-500 text-slate-950',
    icon: Crown,
  },
  manager: {
    label: 'Manajer',
    badgeBg: 'bg-indigo-100 border-indigo-300',
    badgeText: 'text-indigo-900',
    cardBorder: 'border-indigo-200 bg-indigo-50/40',
    cardAccent: 'bg-indigo-600 text-white',
    icon: Briefcase,
  },
  barista: {
    label: 'Barista',
    badgeBg: 'bg-emerald-100 border-emerald-300',
    badgeText: 'text-emerald-900',
    cardBorder: 'border-emerald-200 bg-emerald-50/40',
    cardAccent: 'bg-emerald-600 text-white',
    icon: Coffee,
  },
};

const ACTION_META: Record<
  ActivityActionType,
  {
    label: string;
    badgeClass: string;
    icon: typeof LogIn;
  }
> = {
  login: {
    label: 'Login',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: LogIn,
  },
  logout: {
    label: 'Logout',
    badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
    icon: LogOut,
  },
  navigate: {
    label: 'Buka Menu',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    icon: Eye,
  },
  create: {
    label: 'Input / Tambah',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: PlusCircle,
  },
  update: {
    label: 'Edit / Simpan',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Edit3,
  },
  delete: {
    label: 'Hapus',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: Trash2,
  },
  scan_receipt: {
    label: 'Scan Nota',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-200',
    icon: Camera,
  },
  sync: {
    label: 'Sinkronisasi',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: RefreshCw,
  },
  export: {
    label: 'Ekspor / Unduh',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: FileSpreadsheet,
  },
};

function formatDateTimeID(ts: number): string {
  try {
    return new Date(ts).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatRelativeTimeID(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec} dtk lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

function toLocalDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function UsageHistoryPage() {
  const [logs, setLogs] = useState<AppActivityLog[]>(() => readLocalActivityLogs());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AppRole>('ALL');
  const [actionFilter, setActionFilter] = useState<'ALL' | ActivityActionType>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'today' | '7d' | '30d' | 'all' | 'custom'>('7d');
  const [customDate, setCustomDate] = useState<string>(() => toLocalDateKey(Date.now()));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmClearMode, setConfirmClearMode] = useState<null | 'old' | 'all'>(null);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const merged = await fetchAppActivityLogs();
      setLogs(merged);
      setLastSyncedAt(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
    const interval = setInterval(() => {
      void loadLogs();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Per-role live statistics across all stored logs
  const roleStats = useMemo(() => {
    const buildStats = (targetRole: AppRole) => {
      const roleLogs = logs.filter(l => l.role === targetRole);
      const latest = roleLogs[0] || null;
      const loginCount = roleLogs.filter(l => l.actionType === 'login').length;
      const writeCount = roleLogs.filter(
        l => l.actionType === 'create' || l.actionType === 'update' || l.actionType === 'delete' || l.actionType === 'scan_receipt'
      ).length;

      const moduleFreq = new Map<string, number>();
      roleLogs.forEach(l => {
        if (l.module) moduleFreq.set(l.module, (moduleFreq.get(l.module) || 0) + 1);
      });
      let topModule = '-';
      let topCount = 0;
      moduleFreq.forEach((cnt, mod) => {
        if (cnt > topCount) {
          topCount = cnt;
          topModule = mod;
        }
      });

      return {
        total: roleLogs.length,
        latest,
        loginCount,
        writeCount,
        topModule,
      };
    };

    return {
      owner: buildStats('owner'),
      manager: buildStats('manager'),
      barista: buildStats('barista'),
    };
  }, [logs]);

  // Filtered list for table display
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const todayKey = toLocalDateKey(now);
    const q = searchQuery.trim().toLowerCase();

    return logs.filter(item => {
      if (roleFilter !== 'ALL' && item.role !== roleFilter) return false;
      if (actionFilter !== 'ALL' && item.actionType !== actionFilter) return false;

      if (dateRangeFilter === 'today') {
        if (toLocalDateKey(item.timestamp) !== todayKey) return false;
      } else if (dateRangeFilter === '7d') {
        if (now - item.timestamp > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (dateRangeFilter === '30d') {
        if (now - item.timestamp > 30 * 24 * 60 * 60 * 1000) return false;
      } else if (dateRangeFilter === 'custom' && customDate) {
        if (toLocalDateKey(item.timestamp) !== customDate) return false;
      }

      if (q) {
        const hay = `${item.module} ${item.description} ${item.actorName} ${item.deviceLabel} ${item.role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [logs, roleFilter, actionFilter, dateRangeFilter, customDate, searchQuery]);

  const handleExportCsv = () => {
    const headers = ['Waktu', 'Role', 'Nama Aktor', 'Metode Login', 'Jenis Aksi', 'Modul', 'Deskripsi Aktivitas', 'Perangkat'];
    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = filteredLogs.map(item => [
      escapeCsv(formatDateTimeID(item.timestamp)),
      escapeCsv(ROLE_META[item.role]?.label || item.role),
      escapeCsv(item.actorName),
      escapeCsv(item.authMethod),
      escapeCsv(ACTION_META[item.actionType]?.label || item.actionType),
      escapeCsv(item.module),
      escapeCsv(item.description),
      escapeCsv(item.deviceLabel),
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwayat-penggunaan-aplikasi-${toLocalDateKey(Date.now())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmClear = async (mode: 'old' | 'all') => {
    setIsClearing(true);
    try {
      const next = await pruneAppActivityLogs(mode === 'old' ? 30 : undefined);
      setLogs(next);
      setConfirmClearMode(null);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-slate-900 text-amber-400 rounded-2xl shadow-xs shrink-0">
            <History className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Riwayat Penggunaan Aplikasi (Audit 3 Role)
              </h2>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                <ShieldCheck className="h-3 w-3" />
                <span>Khusus Owner</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Pantau aktivitas login, pembukaan menu, input penjualan barista, scan nota, perubahan resep, dan transaksi keuangan dari role Owner, Manajer, dan Barista secara realtime.
            </p>
            {lastSyncedAt && (
              <p className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>Terakhir disinkronkan lintas perangkat: {lastSyncedAt} • {logs.length} total log tersimpan</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={isLoading}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Menyegarkan...' : 'Refresh Realtime'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Ekspor CSV</span>
          </button>

          {confirmClearMode ? (
            <div className="inline-flex items-center space-x-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-rose-900">
                {confirmClearMode === 'old' ? 'Hapus log >30 hari?' : 'Hapus SEMUA log?'}
              </span>
              <button
                type="button"
                disabled={isClearing}
                onClick={() => void handleConfirmClear(confirmClearMode)}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-lg transition cursor-pointer"
              >
                {isClearing ? 'Proses...' : 'Ya, Hapus'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearMode(null)}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setConfirmClearMode('old')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
                title="Hapus log yang lebih lama dari 30 hari"
              >
                Bersihkan &gt;30 Hari
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearMode('all')}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center space-x-1 cursor-pointer"
                title="Kosongkan seluruh riwayat aktivitas"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3 Role Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['owner', 'manager', 'barista'] as AppRole[]).map(roleKey => {
          const meta = ROLE_META[roleKey];
          const stat = roleStats[roleKey];
          const Icon = meta.icon;
          const isSelected = roleFilter === roleKey;

          return (
            <button
              key={roleKey}
              type="button"
              onClick={() => setRoleFilter(isSelected ? 'ALL' : roleKey)}
              className={`text-left rounded-2xl border p-4 transition-all cursor-pointer shadow-2xs hover:shadow-sm ${meta.cardBorder} ${
                isSelected ? 'ring-2 ring-slate-900' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-xl ${meta.cardAccent}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Role {meta.label}
                    </p>
                    <p className="text-[11px] text-slate-500 font-semibold">
                      {stat.loginCount}x login • {stat.writeCount} aksi perubahan data
                    </p>
                  </div>
                </div>
                <span className="text-xl font-black font-mono text-slate-900">
                  {stat.total}
                </span>
              </div>

              <div className="bg-white/80 rounded-xl border border-slate-200/70 p-2.5 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-semibold">Aktivitas Terakhir:</span>
                  <span className="font-bold text-slate-900">
                    {stat.latest ? formatRelativeTimeID(stat.latest.timestamp) : 'Belum ada log'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-semibold">Modul Teratas:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[170px]" title={stat.topModule}>
                    {stat.topModule}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-semibold">Perangkat Terakhir:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[170px]">
                    {stat.latest?.deviceLabel || '-'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filter Role:
            </span>
            {(
              [
                { key: 'ALL', label: `Semua (${logs.length})` },
                { key: 'owner', label: `Owner (${roleStats.owner.total})` },
                { key: 'manager', label: `Manajer (${roleStats.manager.total})` },
                { key: 'barista', label: `Barista (${roleStats.barista.total})` },
              ] as const
            ).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRoleFilter(opt.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  roleFilter === opt.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari aktivitas, modul, atau perangkat..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          {/* Action Type Filter */}
          <select
            autoComplete="off"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as 'ALL' | ActivityActionType)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Jenis Aktivitas</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="navigate">Buka Menu / Halaman</option>
            <option value="create">Input / Tambah Data</option>
            <option value="update">Edit / Simpan Perubahan</option>
            <option value="delete">Hapus Data</option>
            <option value="scan_receipt">Scan Foto Nota</option>
            <option value="sync">Sinkronisasi Cloud/Sheet</option>
            <option value="export">Ekspor / Backup</option>
          </select>

          {/* Date Range Filter */}
          <select
            autoComplete="off"
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value as 'today' | '7d' | '30d' | 'all' | 'custom')}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="today">Hari Ini</option>
            <option value="7d">7 Hari Terakhir</option>
            <option value="30d">30 Hari Terakhir</option>
            <option value="all">Semua Waktu</option>
            <option value="custom">Pilih Tanggal Spesifik</option>
          </select>

          {dateRangeFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
            />
          )}

          <span className="ml-auto text-xs font-bold text-slate-500">
            Menampilkan <strong className="text-slate-900">{filteredLogs.length}</strong> aktivitas
          </span>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <History className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-black text-slate-700">Belum ada riwayat aktivitas untuk filter ini</p>
            <p className="text-xs text-slate-400 font-medium">
              Aktivitas login, navigasi menu, input penjualan barista, dan perubahan data dari 3 role akan otomatis tercatat di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">Waktu</th>
                  <th className="py-3 px-3 whitespace-nowrap">Role</th>
                  <th className="py-3 px-3 whitespace-nowrap">Jenis Aksi</th>
                  <th className="py-3 px-3 whitespace-nowrap">Modul</th>
                  <th className="py-3 px-4">Detail Aktivitas</th>
                  <th className="py-3 px-4 whitespace-nowrap">Perangkat &amp; Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map(item => {
                  const rMeta = ROLE_META[item.role] || ROLE_META.owner;
                  const aMeta = ACTION_META[item.actionType] || ACTION_META.navigate;
                  const RoleIcon = rMeta.icon;
                  const ActionIcon = aMeta.icon;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-800 text-[11px]">
                          {formatDateTimeID(item.timestamp)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          {formatRelativeTimeID(item.timestamp)}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-black ${rMeta.badgeBg} ${rMeta.badgeText}`}
                        >
                          <RoleIcon className="h-3 w-3 shrink-0" />
                          <span>{rMeta.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[10.5px] font-extrabold ${aMeta.badgeClass}`}
                        >
                          <ActionIcon className="h-3 w-3 shrink-0" />
                          <span>{aMeta.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                        {item.module}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium min-w-[240px]">
                        <div>{item.description}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Oleh: {item.actorName}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1 text-[11px] font-bold text-slate-700">
                          <Smartphone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{item.deviceLabel}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase">
                          {item.authMethod === 'google'
                            ? 'Google OAuth'
                            : item.authMethod === 'password'
                              ? 'Password Role'
                              : 'Sesi Aktif'}
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
    </div>
  );
}
