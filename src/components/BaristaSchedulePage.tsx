import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Barista, 
  ShiftMaster, 
  BaristaScheduleEntry, 
  ShiftScheduleStatus,
  Transaction,
  RoleSalaryStandard,
  PayslipData,
  SalaryAdjustment 
} from '../types';
import { 
  Users, 
  Calendar, 
  Clock, 
  Plus, 
  Download, 
  FileText, 
  Image as ImageIcon, 
  ChevronLeft, 
  ChevronRight, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Settings2, 
  Sparkles, 
  Coffee, 
  FileJson,
  Check,
  Search,
  Phone,
  Tag,
  Briefcase,
  UserCheck,
  Filter,
  Layers,
  ArrowUpDown,
  Cloud,
  Copy,
  RotateCcw,
  ArrowRightLeft,
  Wallet,
  Award,
  TrendingUp,
  Receipt,
  DollarSign,
  Share2,
  SlidersHorizontal,
  ChevronDown,
  Save,
  RefreshCw,
  CalendarRange,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  saveBaristaScheduleToSheet,
  saveBaristasToSheet,
  saveShiftsToSheet,
  saveFullBaristaDataToSheet,
  fetchBaristaScheduleFromSheet,
  fetchBaristasFromSheet,
  fetchShiftsFromSheet,
  fetchFullBaristaDataFromSheet
} from '../sheetsService';

import { 
  STORAGE_KEYS, 
  DEFAULT_BARISTAS, 
  DEFAULT_SHIFTS, 
  DEFAULT_ROLE_SALARIES,
  getWeekDates, 
  formatToDateKey, 
  INDONESIAN_DAY_NAMES, 
  INDONESIAN_MONTH_NAMES, 
  COLOR_THEMES, 
  calculateDurationHours, 
  generateSampleSchedules,
  calculateServiceDuration,
  calculateBaristaPayroll,
  generatePayslipImage
} from '../utils/baristaScheduleData';
import { parseDateString, formatLocalDate } from '../utils';

import BaristaFormModal from './BaristaFormModal';
import ShiftMasterModal from './ShiftMasterModal';
import ShiftSelectorPopover from './ShiftSelectorPopover';
import BackupRestoreModal from './BackupRestoreModal';
import PayslipModal from './PayslipModal';
import RoleSalarySettingsModal from './RoleSalarySettingsModal';

interface BaristaSchedulePageProps {
  transactions?: Transaction[];
  categories?: string[];
  spreadsheetId?: string | null;
  token?: string | null;
}

// Helper to sanitize schedules (deduplicates by baristaId + date and prunes invalid/orphaned entries)
function sanitizeScheduleEntries(rawSchedules: BaristaScheduleEntry[], validBaristas: Barista[]): BaristaScheduleEntry[] {
  if (!Array.isArray(rawSchedules)) return [];
  const validBaristaIds = new Set(validBaristas.map(b => b.id));
  const seen = new Map<string, BaristaScheduleEntry>();
  
  // Keep the latest entry for each (baristaId, date)
  rawSchedules.forEach(s => {
    if (s && s.baristaId && s.date && validBaristaIds.has(s.baristaId)) {
      const key = `${s.baristaId}_${s.date}`;
      seen.set(key, s);
    }
  });
  
  return Array.from(seen.values());
}

export default function BaristaSchedulePage({
  transactions,
  categories,
  spreadsheetId,
  token
}: BaristaSchedulePageProps) {
  // State for Baristas
  const [baristas, setBaristas] = useState<Barista[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BARISTAS);
      return saved ? JSON.parse(saved) : DEFAULT_BARISTAS;
    } catch {
      return DEFAULT_BARISTAS;
    }
  });

  // State for Master Shifts
  const [shifts, setShifts] = useState<ShiftMaster[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      return saved ? JSON.parse(saved) : DEFAULT_SHIFTS;
    } catch {
      return DEFAULT_SHIFTS;
    }
  });

  // Base date for currently viewed week
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());

  // State for Schedule Entries
  const [schedules, setSchedules] = useState<BaristaScheduleEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeScheduleEntries(parsed, DEFAULT_BARISTAS);
        }
      }
    } catch {}
    // If empty, generate sample for current week
    const currentWeekDates = getWeekDates(new Date());
    return generateSampleSchedules(currentWeekDates, DEFAULT_BARISTAS, DEFAULT_SHIFTS);
  });

  // Realtime Cloud Sync & Persistence State
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const syncTimeoutRef = useRef<any>(null);
  const isInitialMountDoneRef = useRef(false);

  // Auto-sync debounced trigger for changes
  const triggerCloudSync = useCallback((
    currentSchedules = schedules,
    currentBaristas = baristas,
    currentShifts = shifts
  ) => {
    if (!spreadsheetId || !token || !isInitialMountDoneRef.current) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      setIsSyncingCloud(true);
      try {
        await saveBaristaScheduleToSheet(
          spreadsheetId,
          currentSchedules,
          currentBaristas,
          currentShifts,
          token
        );
        setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.error('Error auto-syncing Barista Schedule to Sheet:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    }, 1500);
  }, [spreadsheetId, token, schedules, baristas, shifts]);

  // Load Schedule, Barista Team & Shifts from Google Sheets
  const loadBaristaDataFromCloud = useCallback(async (isManual = false) => {
    if (!spreadsheetId || !token) return;
    setIsLoadingCloud(true);
    try {
      const { schedules: remoteSchedules, baristas: remoteBaristas, shifts: remoteShifts } = 
        await fetchFullBaristaDataFromSheet(spreadsheetId, token);

      let hasNewData = false;

      if (remoteBaristas && remoteBaristas.length > 0) {
        setBaristas(remoteBaristas);
        localStorage.setItem(STORAGE_KEYS.BARISTAS, JSON.stringify(remoteBaristas));
        hasNewData = true;
      }

      if (remoteShifts && remoteShifts.length > 0) {
        setShifts(remoteShifts);
        localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(remoteShifts));
        hasNewData = true;
      }

      if (remoteSchedules && remoteSchedules.length > 0) {
        const validBars = (remoteBaristas && remoteBaristas.length > 0) ? remoteBaristas : baristas;
        const sanitized = sanitizeScheduleEntries(remoteSchedules, validBars);
        setSchedules(sanitized);
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(sanitized));
        hasNewData = true;
      }

      const syncTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(syncTimeStr);

      if (isManual) {
        if (hasNewData) {
          showToast('✅ Data jadwal operasional & tim barista berhasil dimuat dari Google Sheets!');
        } else {
          showToast('ℹ️ Google Sheets terhubung. Tidak ada data baru yang ditemukan di Sheet.');
        }
      }
    } catch (err: any) {
      console.error('Error fetching barista data from sheet:', err);
      if (isManual) {
        showToast('❌ Gagal memuat data dari Google Sheets. Periksa koneksi akun Google.');
      }
    } finally {
      setIsLoadingCloud(false);
      isInitialMountDoneRef.current = true;
    }
  }, [spreadsheetId, token, baristas]);

  // Automatic Load from Google Sheets when connected / on app start / update
  useEffect(() => {
    if (spreadsheetId && token) {
      loadBaristaDataFromCloud(false);
    } else {
      isInitialMountDoneRef.current = true;
    }
  }, [spreadsheetId, token]);

  // Manual Save Handler to persist all schedule, baristas, and shifts into Google Sheets
  const handleManualSaveToSheet = async () => {
    if (!spreadsheetId || !token) {
      alert('Google Sheets belum terhubung. Silakan login akun Google dan hubungkan spreadsheet di halaman Utama/Dasbor.');
      return;
    }

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setIsSyncingCloud(true);

    try {
      await saveFullBaristaDataToSheet(
        spreadsheetId,
        schedules,
        baristas,
        shifts,
        token
      );
      const syncTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(syncTimeStr);
      showToast(`✅ Data jadwal operasional, tim barista, & jam shift berhasil disimpan ke Google Sheets! (${syncTimeStr})`);
    } catch (err: any) {
      console.error('Error saving barista data to sheet:', err);
      alert('Gagal menyimpan ke Google Sheets: ' + (err?.message || 'Terjadi kesalahan jaringan'));
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Active View Tab: 'matrix' (Weekly Table), 'monthly' (1 Month & Cross-Month Table), 'daily' (Daily Shift Board), 'roster' (Barista Team List), 'shifts' (Master Jam Shift), 'payroll' (Kalkulator & Slip Gaji)
  const [viewMode, setViewMode] = useState<'matrix' | 'monthly' | 'daily' | 'roster' | 'shifts' | 'payroll'>('matrix');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(() => formatToDateKey(new Date()));
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Dropdown View Options
  const viewOptions = [
    {
      id: 'matrix' as const,
      name: 'Matriks Mingguan',
      label: 'Matriks Jadwal Mingguan',
      description: 'Tabel rotasi & penugasan shift 7 hari kerja',
      icon: Calendar,
      colorClass: 'bg-amber-500 text-slate-950',
      badge: 'Tabel 7 Hari'
    },
    {
      id: 'monthly' as const,
      name: 'Jadwal 1 Bulan & Lintas Bulan',
      label: 'Jadwal 1 Bulan & Lintas Bulan',
      description: 'Tampilan shift 1 bulan penuh, rentang lintas bulan & download PDF/Excel',
      icon: CalendarRange,
      colorClass: 'bg-indigo-600 text-white',
      badge: '1 Bulan / Lintas Bulan'
    },
    {
      id: 'daily' as const,
      name: 'Papan Harian',
      label: 'Papan Shift Harian',
      description: 'Rekap barisan tim shift harian per tanggal',
      icon: Clock,
      colorClass: 'bg-sky-500 text-white',
      badge: 'Harian'
    },
    {
      id: 'roster' as const,
      name: 'Tim Barista',
      label: `Tim Barista (${baristas.length})`,
      description: 'Profil staf, kontak, masa kerja & struktur gaji',
      icon: Users,
      colorClass: 'bg-emerald-600 text-white',
      badge: `${baristas.length} Orang`
    },
    {
      id: 'shifts' as const,
      name: 'Master Jam Shift',
      label: 'Master Jam Shift',
      description: 'Pengaturan slot & durasi jam operasional',
      icon: Layers,
      colorClass: 'bg-violet-600 text-white',
      badge: `${shifts.length} Slot`
    },
    {
      id: 'payroll' as const,
      name: 'Kalkulator & Slip Gaji',
      label: 'Kalkulator & Slip Gaji',
      description: 'Hitung gaji kehadiran harian, masa kerja & export slip PNG',
      icon: Wallet,
      colorClass: 'bg-amber-500 text-slate-950',
      badge: 'Slip Gaji'
    }
  ];

  const currentViewOption = viewOptions.find(opt => opt.id === viewMode) || viewOptions[0];
  const CurrentViewIcon = currentViewOption.icon;

  // Payroll States
  const [payrollMonth, setPayrollMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [roleStandards, setRoleStandards] = useState<RoleSalaryStandard[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROLE_SALARIES);
      return saved ? JSON.parse(saved) : DEFAULT_ROLE_SALARIES;
    } catch {
      return DEFAULT_ROLE_SALARIES;
    }
  });

  const [payrollAdjustments, setPayrollAdjustments] = useState<Record<string, SalaryAdjustment>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PAYROLL_ADJUSTMENTS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isRoleSalaryModalOpen, setIsRoleSalaryModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipData | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modals & Popovers
  const [isBaristaModalOpen, setIsBaristaModalOpen] = useState(false);
  const [editingBarista, setEditingBarista] = useState<Barista | null>(null);

  const [isShiftMasterModalOpen, setIsShiftMasterModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Popover Cell State
  const [activeCellTarget, setActiveCellTarget] = useState<{
    baristaId: string;
    baristaName: string;
    dateKey: string;
    dateLabel: string;
    currentEntry?: BaristaScheduleEntry | null;
  } | null>(null);

  // -------------------------------------------------------------
  // JADWAL OPERASIONAL 1 BULAN & RENTANG TANGGAL LEWAT BULAN STATE
  // -------------------------------------------------------------
  const [monthlyPreset, setMonthlyPreset] = useState<'current_month' | 'next_month' | 'prev_month' | 'payroll_25' | 'custom'>('current_month');

  const initialMonthlyRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    return {
      start: formatToDateKey(firstDay),
      end: formatToDateKey(lastDay)
    };
  }, []);

  const [rangeStartDate, setRangeStartDate] = useState<string>(() => initialMonthlyRange.start);
  const [rangeEndDate, setRangeEndDate] = useState<string>(() => initialMonthlyRange.end);
  const [monthlyFilterBarista, setMonthlyFilterBarista] = useState<string>('all');
  const [isExportingMonthlyPdf, setIsExportingMonthlyPdf] = useState(false);
  const [isExportingMonthlyExcel, setIsExportingMonthlyExcel] = useState(false);
  const monthlyScheduleExportRef = useRef<HTMLDivElement>(null);

  // List of Dates in selected range (Max 95 days)
  const monthlyDates = useMemo(() => {
    if (!rangeStartDate || !rangeEndDate) return [];
    const start = parseDateString(rangeStartDate);
    const end = parseDateString(rangeEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    const dates: Date[] = [];
    const curr = new Date(start);
    let count = 0;
    while (curr <= end && count < 95) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return dates;
  }, [rangeStartDate, rangeEndDate]);

  // Is Cross-Month check
  const isCrossMonth = useMemo(() => {
    if (monthlyDates.length <= 1) return false;
    const startMonth = monthlyDates[0].getMonth();
    const endMonth = monthlyDates[monthlyDates.length - 1].getMonth();
    return startMonth !== endMonth;
  }, [monthlyDates]);

  // Label for range
  const monthlyRangeLabel = useMemo(() => {
    if (!monthlyDates.length) return '';
    const first = monthlyDates[0];
    const last = monthlyDates[monthlyDates.length - 1];
    if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
      return `${first.getDate()} - ${last.getDate()} ${INDONESIAN_MONTH_NAMES[first.getMonth()]} ${first.getFullYear()} (${monthlyDates.length} Hari)`;
    }
    return `${first.getDate()} ${INDONESIAN_MONTH_NAMES[first.getMonth()].substring(0, 3)} ${first.getFullYear()} s/d ${last.getDate()} ${INDONESIAN_MONTH_NAMES[last.getMonth()].substring(0, 3)} ${last.getFullYear()} (${monthlyDates.length} Hari - Lintas Bulan)`;
  }, [monthlyDates]);

  const applyMonthlyPreset = (preset: 'current_month' | 'next_month' | 'prev_month' | 'payroll_25') => {
    setMonthlyPreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'current_month') {
      const s = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      setRangeStartDate(formatToDateKey(s));
      setRangeEndDate(formatToDateKey(e));
    } else if (preset === 'next_month') {
      const s = new Date(y, m + 1, 1);
      const e = new Date(y, m + 2, 0);
      setRangeStartDate(formatToDateKey(s));
      setRangeEndDate(formatToDateKey(e));
    } else if (preset === 'prev_month') {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      setRangeStartDate(formatToDateKey(s));
      setRangeEndDate(formatToDateKey(e));
    } else if (preset === 'payroll_25') {
      // 25th of prev month to 24th of current month
      const s = new Date(y, m - 1, 25);
      const e = new Date(y, m, 24);
      setRangeStartDate(formatToDateKey(s));
      setRangeEndDate(formatToDateKey(e));
    }
  };

  const calculateBaristaRangeStats = useCallback((baristaId: string) => {
    let totalShifts = 0;
    let totalOff = 0;
    let totalHours = 0;

    monthlyDates.forEach(d => {
      const dKey = formatToDateKey(d);
      const entry = schedules.find(s => s.baristaId === baristaId && s.date === dKey);
      if (!entry) return;
      const shift = shifts.find(sh => sh.id === entry.shiftId);
      if (!shift) return;

      if (shift.isOff || entry.status === 'libur') {
        totalOff += 1;
      } else if (entry.status !== 'izin' && entry.status !== 'sakit') {
        totalShifts += 1;
        const dur = (entry.customStartTime && entry.customEndTime)
          ? calculateDurationHours(entry.customStartTime, entry.customEndTime)
          : calculateDurationHours(shift.startTime, shift.endTime);
        totalHours += dur;
      }
    });

    return { totalShifts, totalOff, totalHours: Math.round(totalHours * 10) / 10 };
  }, [monthlyDates, schedules, shifts]);

  // Export Loading States
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const scheduleExportRef = useRef<HTMLDivElement>(null);

  // Sync to LocalStorage & Realtime Cloud Sync
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BARISTAS, JSON.stringify(baristas));
    triggerCloudSync(schedules, baristas, shifts);
  }, [baristas]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
    triggerCloudSync(schedules, baristas, shifts);
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
    triggerCloudSync(schedules, baristas, shifts);
  }, [schedules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLE_SALARIES, JSON.stringify(roleStandards));
  }, [roleStandards]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAYROLL_ADJUSTMENTS, JSON.stringify(payrollAdjustments));
  }, [payrollAdjustments]);

  // Payroll Handlers
  const handleUpdateSalaryAdjustment = (baristaId: string, periodMonth: string, adj: SalaryAdjustment) => {
    const key = `${baristaId}_${periodMonth}`;
    setPayrollAdjustments(prev => ({
      ...prev,
      [key]: adj
    }));
    showToast('Penyesuaian bonus & potongan slip gaji berhasil disimpan.');
    
    // Update active payslip if opened
    if (selectedPayslip && selectedPayslip.baristaId === baristaId) {
      const b = baristas.find(bar => bar.id === baristaId);
      if (b) {
        const updatedSlip = calculateBaristaPayroll(b, schedules, periodMonth, adj, roleStandards, shifts);
        setSelectedPayslip(updatedSlip);
      }
    }
  };

  const handleOpenPayslipModal = (barista: Barista) => {
    const key = `${barista.id}_${payrollMonth}`;
    const adj = payrollAdjustments[key];
    const payslip = calculateBaristaPayroll(barista, schedules, payrollMonth, adj, roleStandards, shifts);
    setSelectedPayslip(payslip);
    setIsPayslipModalOpen(true);
  };

  const handleSaveRoleStandards = (updatedStandards: RoleSalaryStandard[]) => {
    setRoleStandards(updatedStandards);
    showToast('Master standar gaji jabatan berhasil diperbarui.');
  };

  // Current week dates
  const weekDates = getWeekDates(baseDate);
  const startWeek = weekDates[0];
  const endWeek = weekDates[6];

  const weekRangeLabel = `${startWeek.getDate()} ${INDONESIAN_MONTH_NAMES[startWeek.getMonth()]} ${startWeek.getFullYear()} – ${endWeek.getDate()} ${INDONESIAN_MONTH_NAMES[endWeek.getMonth()]} ${endWeek.getFullYear()}`;

  // Week navigation
  const handlePrevWeek = () => {
    const next = new Date(baseDate);
    next.setDate(baseDate.getDate() - 7);
    setBaseDate(next);
  };

  const handleNextWeek = () => {
    const next = new Date(baseDate);
    next.setDate(baseDate.getDate() + 7);
    setBaseDate(next);
  };

  const handleCurrentWeek = () => {
    setBaseDate(new Date());
  };

  // Barista CRUD Handlers
  const handleSaveBarista = (savedBarista: Barista) => {
    if (editingBarista) {
      setBaristas(prev => prev.map(b => b.id === savedBarista.id ? savedBarista : b));
      showToast(`Data barista "${savedBarista.name}" berhasil diperbarui.`);
    } else {
      setBaristas(prev => [...prev, savedBarista]);
      showToast(`Barista "${savedBarista.name}" berhasil ditambahkan.`);
    }
  };

  const handleDeleteBarista = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus barista "${name}"? Jadwal shift terkait akan tetap tersimpan dalam riwayat.`)) {
      setBaristas(prev => prev.filter(b => b.id !== id));
      showToast(`Barista "${name}" telah dihapus.`);
    }
  };

  const handleToggleBaristaActive = (id: string) => {
    setBaristas(prev => prev.map(b => {
      if (b.id === id) {
        return { ...b, isActive: !b.isActive };
      }
      return b;
    }));
  };

  // Shifts Master Update Handler
  const handleSaveShifts = (updatedShifts: ShiftMaster[]) => {
    setShifts(updatedShifts);
    showToast('Master jam shift bar berhasil diperbarui.');
  };

  // Schedule Entry Assignment Handlers
  const handleAssignShift = (
    baristaId: string,
    dateKey: string,
    shiftId: string,
    status: ShiftScheduleStatus,
    customStart?: string,
    customEnd?: string,
    notes?: string
  ) => {
    setSchedules(prev => {
      const existingIdx = prev.findIndex(s => s.baristaId === baristaId && s.date === dateKey);
      const newEntry: BaristaScheduleEntry = {
        id: existingIdx >= 0 ? prev[existingIdx].id : `sched-${baristaId}-${dateKey}`,
        baristaId,
        date: dateKey,
        shiftId,
        status,
        customStartTime: customStart,
        customEndTime: customEnd,
        notes
      };

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = newEntry;
        return next;
      } else {
        return [...prev, newEntry];
      }
    });
  };

  const handleDeleteScheduleEntry = (baristaId: string, dateKey: string) => {
    setSchedules(prev => prev.filter(s => !(s.baristaId === baristaId && s.date === dateKey)));
  };

  // Quick fill barista's week with a shift
  const handleQuickFillWeek = (baristaId: string, shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    setSchedules(prev => {
      const filtered = prev.filter(s => !(s.baristaId === baristaId && weekDates.some(d => formatToDateKey(d) === s.date)));
      const additions: BaristaScheduleEntry[] = weekDates.map(d => ({
        id: `sched-${baristaId}-${formatToDateKey(d)}`,
        baristaId,
        date: formatToDateKey(d),
        shiftId,
        status: shift.isOff ? 'libur' : 'scheduled'
      }));
      return [...filtered, ...additions];
    });
    showToast(`Shift diterapkan ke seluruh hari minggu ini.`);
  };

  const showToast = (msg: string) => {
    setExportToast(msg);
    setTimeout(() => setExportToast(null), 3000);
  };

  // Filtered Baristas
  const filteredBaristas = baristas.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (b.nickname && b.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          b.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || b.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Calculate Barista Weekly Hours
  const calculateBaristaWeekHours = (baristaId: string) => {
    let totalHours = 0;
    let totalShifts = 0;
    let offDays = 0;

    weekDates.forEach(d => {
      const dKey = formatToDateKey(d);
      const entry = schedules.find(s => s.baristaId === baristaId && s.date === dKey);
      if (entry) {
        const shift = shifts.find(s => s.id === entry.shiftId);
        if (shift) {
          if (shift.isOff || entry.status === 'libur') {
            offDays++;
          } else {
            totalShifts++;
            if (entry.customStartTime && entry.customEndTime) {
              totalHours += calculateDurationHours(entry.customStartTime, entry.customEndTime);
            } else {
              totalHours += shift.durationHours || 0;
            }
          }
        }
      }
    });

    return { totalHours, totalShifts, offDays };
  };

  // Summary Metrics for the week
  const weekTotalHours = baristas.reduce((acc, b) => acc + calculateBaristaWeekHours(b.id).totalHours, 0);
  const activeBaristasCount = baristas.filter(b => b.isActive).length;
  const avgHoursPerBarista = activeBaristasCount > 0 ? (weekTotalHours / activeBaristasCount).toFixed(1) : '0';

  // -------------------------------------------------------------
  // FITUR SALIN JADWAL DARI MINGGU LALU & MINGGU DEPAN
  // -------------------------------------------------------------
  const handleCopyLastWeekSchedule = () => {
    const prevBaseDate = new Date(baseDate);
    prevBaseDate.setDate(baseDate.getDate() - 7);
    const prevWeekDates = getWeekDates(prevBaseDate);
    const currentWeekDates = getWeekDates(baseDate);

    const prevStart = prevWeekDates[0];
    const prevEnd = prevWeekDates[6];
    const prevRangeLabel = `${prevStart.getDate()} ${INDONESIAN_MONTH_NAMES[prevStart.getMonth()].substring(0, 3)} – ${prevEnd.getDate()} ${INDONESIAN_MONTH_NAMES[prevEnd.getMonth()].substring(0, 3)}`;

    // Cari jadwal unik per barista yang ada di minggu sebelumnya
    const validBaristaIds = new Set(baristas.map(b => b.id));
    const prevEntries: { baristaId: string; dayIndex: number; entry: BaristaScheduleEntry }[] = [];
    
    prevWeekDates.forEach((pDate, idx) => {
      const pKey = formatToDateKey(pDate);
      // Ensure only 1 entry per valid barista is copied per day
      baristas.forEach(b => {
        const entry = schedules.find(s => s.baristaId === b.id && s.date === pKey);
        if (entry) {
          prevEntries.push({
            baristaId: b.id,
            dayIndex: idx,
            entry
          });
        }
      });
    });

    if (prevEntries.length === 0) {
      alert(`⚠️ Tidak ada data jadwal shift pada minggu lalu (${prevRangeLabel}) untuk disalin.`);
      return;
    }

    const currentKeys = currentWeekDates.map(d => formatToDateKey(d));
    const currentCount = schedules.filter(s => currentKeys.includes(s.date) && validBaristaIds.has(s.baristaId)).length;

    if (currentCount > 0) {
      const confirmed = window.confirm(
        `Minggu ini sudah memiliki ${currentCount} shift jadwal.\n\nApakah Anda yakin ingin menimpa jadwal minggu ini dengan jadwal dari minggu lalu (${prevRangeLabel})?`
      );
      if (!confirmed) return;
    }

    // Buat entri jadwal baru untuk minggu ini
    const newEntries: BaristaScheduleEntry[] = prevEntries.map(({ baristaId, dayIndex, entry }) => {
      const targetDateKey = formatToDateKey(currentWeekDates[dayIndex]);
      return {
        id: `sched-${baristaId}-${targetDateKey}`,
        baristaId: entry.baristaId,
        date: targetDateKey,
        shiftId: entry.shiftId,
        status: entry.status,
        customStartTime: entry.customStartTime,
        customEndTime: entry.customEndTime,
        notes: entry.notes
      };
    });

    // Update state jadwal (menimpa hari-hari pada minggu terpilih)
    setSchedules(prev => {
      const filtered = prev.filter(s => !currentKeys.includes(s.date));
      return sanitizeScheduleEntries([...filtered, ...newEntries], baristas);
    });

    showToast(`✅ Berhasil menyalin ${newEntries.length} jadwal shift dari minggu lalu (${prevRangeLabel}) ke minggu ini!`);
  };

  const handleCopyCurrentWeekToNextWeek = () => {
    const currentWeekDates = getWeekDates(baseDate);
    const nextBaseDate = new Date(baseDate);
    nextBaseDate.setDate(baseDate.getDate() + 7);
    const nextWeekDates = getWeekDates(nextBaseDate);

    const nextStart = nextWeekDates[0];
    const nextEnd = nextWeekDates[6];
    const nextRangeLabel = `${nextStart.getDate()} ${INDONESIAN_MONTH_NAMES[nextStart.getMonth()].substring(0, 3)} – ${nextEnd.getDate()} ${INDONESIAN_MONTH_NAMES[nextEnd.getMonth()].substring(0, 3)}`;

    const validBaristaIds = new Set(baristas.map(b => b.id));
    const currentEntries: { baristaId: string; dayIndex: number; entry: BaristaScheduleEntry }[] = [];
    
    currentWeekDates.forEach((cDate, idx) => {
      const cKey = formatToDateKey(cDate);
      baristas.forEach(b => {
        const entry = schedules.find(s => s.baristaId === b.id && s.date === cKey);
        if (entry) {
          currentEntries.push({
            baristaId: b.id,
            dayIndex: idx,
            entry
          });
        }
      });
    });

    if (currentEntries.length === 0) {
      alert(`⚠️ Tidak ada data jadwal pada minggu ini untuk disalin ke minggu depan.`);
      return;
    }

    const nextKeys = nextWeekDates.map(d => formatToDateKey(d));
    const nextCount = schedules.filter(s => nextKeys.includes(s.date) && validBaristaIds.has(s.baristaId)).length;

    if (nextCount > 0) {
      const confirmed = window.confirm(
        `Minggu depan (${nextRangeLabel}) sudah memiliki ${nextCount} shift.\n\nApakah Anda yakin ingin menimpanya dengan jadwal minggu ini?`
      );
      if (!confirmed) return;
    }

    const newEntries: BaristaScheduleEntry[] = currentEntries.map(({ baristaId, dayIndex, entry }) => {
      const targetDateKey = formatToDateKey(nextWeekDates[dayIndex]);
      return {
        id: `sched-${baristaId}-${targetDateKey}`,
        baristaId: entry.baristaId,
        date: targetDateKey,
        shiftId: entry.shiftId,
        status: entry.status,
        customStartTime: entry.customStartTime,
        customEndTime: entry.customEndTime,
        notes: entry.notes
      };
    });

    setSchedules(prev => {
      const filtered = prev.filter(s => !nextKeys.includes(s.date));
      return sanitizeScheduleEntries([...filtered, ...newEntries], baristas);
    });

    showToast(`✅ Berhasil menyalin ${newEntries.length} jadwal ke minggu depan (${nextRangeLabel})!`);
  };

  const handleClearWeekSchedule = () => {
    const currentKeys = weekDates.map(d => formatToDateKey(d));
    const count = schedules.filter(s => currentKeys.includes(s.date)).length;
    if (count === 0) {
      showToast('Jadwal minggu ini sudah kosong.');
      return;
    }

    if (window.confirm(`Apakah Anda yakin ingin mengosongkan ${count} shift jadwal pada periode ${weekRangeLabel}?`)) {
      setSchedules(prev => prev.filter(s => !currentKeys.includes(s.date)));
      showToast(`Jadwal minggu ini telah dikosongkan.`);
    }
  };

  // -------------------------------------------------------------
  // EXPORT TO PDF (Aesthetic Cafe Schedule Sheet - Landscape A4)
  // -------------------------------------------------------------
  const handleExportPDF = () => {
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 297;
      const margin = 10;

      // Header Background & Branding Bar (Slate 900)
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 24, 'F');

      // Accent gold strip
      doc.setFillColor(245, 158, 11);
      doc.rect(0, 23, pageWidth, 1, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('JADWAL OPERASIONAL BASCO COFFEE', margin, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(251, 191, 36); // Amber 400
      doc.text(`Periode: ${weekRangeLabel}   |   Basco Coffee Management`, margin, 17);

      doc.setFontSize(7.5);
      doc.setTextColor(203, 213, 225);
      doc.text(
        `Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`,
        pageWidth - margin - 65,
        17
      );

      // Prepare Table Columns & Rows
      const tableHeaders = [
        'No',
        'Nama Barista',
        'Jabatan',
        ...weekDates.map(d => {
          const dayName = INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7];
          return `${dayName}\n${d.getDate()}/${d.getMonth() + 1}`;
        }),
        'Total Jam',
        'Shift'
      ];

      const tableRows = filteredBaristas.map((barista, idx) => {
        const stats = calculateBaristaWeekHours(barista.id);
        const dayCols = weekDates.map(d => {
          const dKey = formatToDateKey(d);
          const entry = schedules.find(s => s.baristaId === barista.id && s.date === dKey);
          if (!entry) return '-';

          const shift = shifts.find(s => s.id === entry.shiftId);
          if (!shift) return '-';

          if (shift.isOff || entry.status === 'libur') {
            return 'OFF (Libur)';
          }

          const hours = (entry.customStartTime && entry.customEndTime)
            ? `${entry.customStartTime}-${entry.customEndTime}`
            : `${shift.startTime}-${shift.endTime}`;

          const statusSuffix = entry.status !== 'scheduled' ? ` [${entry.status.toUpperCase()}]` : '';
          return `${shift.shortCode}\n${hours}${statusSuffix}`;
        });

        return [
          String(idx + 1),
          barista.name + (barista.nickname ? ` (${barista.nickname})` : ''),
          barista.role,
          ...dayCols,
          `${stats.totalHours} Jam`,
          `${stats.totalShifts}x`
        ];
      });

      const activeTeamForPdf = filteredBaristas.filter(b => b.isActive);
      const pdfFootRow = [
        'Σ',
        'Kekuatan Barista Masuk',
        `${activeTeamForPdf.length} Staf Aktif`,
        ...weekDates.map(d => {
          const dKey = formatToDateKey(d);
          const workingCount = activeTeamForPdf.filter(b => {
            const entry = schedules.find(s => s.baristaId === b.id && s.date === dKey);
            if (!entry) return false;
            const sh = shifts.find(x => x.id === entry.shiftId);
            return sh && !sh.isOff && entry.status !== 'libur' && entry.status !== 'izin' && entry.status !== 'sakit';
          }).length;
          return `${workingCount} Barista`;
        }),
        `${weekTotalHours} Jam`,
        ''
      ];

      const autoTableOptions: any = {
        head: [tableHeaders],
        body: tableRows,
        foot: [pdfFootRow],
        startY: 28,
        margin: { top: 28, left: margin, right: margin, bottom: 25 },
        theme: 'grid',
        headStyles: {
          fillColor: [245, 158, 11], // Amber 500
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8,
          cellPadding: 2
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.5,
          cellPadding: 2
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          valign: 'middle',
          halign: 'center',
          lineColor: [226, 232, 240],
          lineWidth: 0.2
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 36, halign: 'left', fontStyle: 'bold' },
          2: { cellWidth: 24, halign: 'left' },
          3: { cellWidth: 27 },
          4: { cellWidth: 27 },
          5: { cellWidth: 27 },
          6: { cellWidth: 27 },
          7: { cellWidth: 27 },
          8: { cellWidth: 27 },
          9: { cellWidth: 27 },
          10: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
          11: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      };

      // Multi-pattern runner for autoTable
      if (typeof autoTable === 'function') {
        autoTable(doc, autoTableOptions);
      } else if ((autoTable as any)?.default) {
        (autoTable as any).default(doc, autoTableOptions);
      } else if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(autoTableOptions);
      }

      // Shift Master Legend at the bottom
      const finalY = Math.min((doc as any).lastAutoTable?.finalY ?? 150, 175) + 6;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Keterangan Master Jam Shift Bar:', margin, finalY);

      doc.setFont('helvetica', 'normal');
      let legendX = margin;
      shifts.forEach((s) => {
        const txt = `${s.shortCode}: ${s.name} (${s.isOff ? 'OFF' : `${s.startTime}-${s.endTime}`})`;
        doc.text(txt, legendX, finalY + 4.5);
        legendX += 54;
      });

      // Signoff / Approval Area
      doc.text('Mengetahui / Disetujui:', 220, finalY);
      doc.text('Head Barista / Store Manager', 220, finalY + 15);
      doc.line(220, finalY + 13, 275, finalY + 13);

      const filename = `Jadwal_Barista_${formatToDateKey(startWeek)}_sd_${formatToDateKey(endWeek)}.pdf`;
      doc.save(filename);
      showToast('✅ Laporan jadwal PDF berhasil diunduh.');
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert('Gagal membuat PDF: ' + (err?.message || 'Error'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // -------------------------------------------------------------
  // EXPORT JADWAL BULANAN / LINTAS BULAN KE PDF (LANDSCAPE A4)
  // -------------------------------------------------------------
  const handleExportMonthlyPDF = () => {
    setIsExportingMonthlyPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 297;
      const margin = 8;

      // Header Background (Slate 900)
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 24, 'F');

      // Accent gold strip
      doc.setFillColor(245, 158, 11);
      doc.rect(0, 23, pageWidth, 1.2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('BASCO COFFEE - JADWAL OPERASIONAL & ROSTER KERJA BULANAN', margin, 9.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(251, 191, 36); // Amber 400
      doc.text(`Periode: ${monthlyRangeLabel}   |   ${isCrossMonth ? 'Jadwal Lintas Bulan' : 'Jadwal Bulanan'}`, margin, 16);

      doc.setFontSize(7.5);
      doc.setTextColor(203, 213, 225);
      doc.text(
        `Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`,
        pageWidth - margin - 65,
        16
      );

      // Table Headers
      const tableHeaders = [
        'No',
        'Nama Barista',
        'Jabatan',
        ...monthlyDates.map(d => {
          const dayName = INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7].substring(0, 2);
          return `${dayName}\n${d.getDate()}/${d.getMonth() + 1}`;
        }),
        'Masuk',
        'OFF',
        'Jam'
      ];

      const activeBaristas = baristas.filter(b => b.isActive);
      const targetBaristas = monthlyFilterBarista === 'all'
        ? activeBaristas
        : activeBaristas.filter(b => b.id === monthlyFilterBarista);

      const tableRows = targetBaristas.map((barista, idx) => {
        const stats = calculateBaristaRangeStats(barista.id);
        const dayCols = monthlyDates.map(d => {
          const dKey = formatToDateKey(d);
          const entry = schedules.find(s => s.baristaId === barista.id && s.date === dKey);
          if (!entry) return '-';

          const shift = shifts.find(s => s.id === entry.shiftId);
          if (!shift) return '-';

          if (shift.isOff || entry.status === 'libur') {
            return 'OFF';
          }

          return shift.shortCode;
        });

        return [
          String(idx + 1),
          barista.name + (barista.nickname ? ` (${barista.nickname})` : ''),
          barista.role,
          ...dayCols,
          `${stats.totalShifts}x`,
          `${stats.totalOff}x`,
          `${stats.totalHours}j`
        ];
      });

      // Footer Row: Daily staffing
      const pdfFootRow = [
        'Σ',
        'Kekuatan Masuk',
        `${targetBaristas.length} Staf`,
        ...monthlyDates.map(d => {
          const dKey = formatToDateKey(d);
          const workingCount = targetBaristas.filter(b => {
            const entry = schedules.find(s => s.baristaId === b.id && s.date === dKey);
            if (!entry) return false;
            const sh = shifts.find(x => x.id === entry.shiftId);
            return sh && !sh.isOff && entry.status !== 'libur' && entry.status !== 'izin' && entry.status !== 'sakit';
          }).length;
          return String(workingCount);
        }),
        '',
        '',
        ''
      ];

      const colCount = tableHeaders.length;
      const isLargeRange = monthlyDates.length > 31;

      const autoTableOptions: any = {
        head: [tableHeaders],
        body: tableRows,
        foot: [pdfFootRow],
        startY: 28,
        margin: { top: 28, left: margin, right: margin, bottom: 25 },
        theme: 'grid',
        horizontalPageBreak: isLargeRange,
        horizontalPageBreakRepeat: [0, 1],
        headStyles: {
          fillColor: [245, 158, 11],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: monthlyDates.length > 25 ? 6 : 7.5,
          cellPadding: 1.2
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: monthlyDates.length > 25 ? 6 : 7.5,
          cellPadding: 1.2
        },
        styles: {
          fontSize: monthlyDates.length > 25 ? 6 : 7.5,
          cellPadding: 1.2,
          valign: 'middle',
          halign: 'center',
          lineColor: [226, 232, 240],
          lineWidth: 0.15
        },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center' },
          1: { cellWidth: 28, halign: 'left', fontStyle: 'bold' },
          2: { cellWidth: 20, halign: 'left' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index >= 3 && data.column.index < colCount - 3) {
            const val = String(data.cell.raw).trim();
            if (val === 'OFF') {
              data.cell.styles.fillColor = [241, 245, 249];
              data.cell.styles.textColor = [148, 163, 184];
            } else if (val !== '-') {
              data.cell.styles.fillColor = [254, 243, 199];
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      };

      if (typeof autoTable === 'function') {
        autoTable(doc, autoTableOptions);
      } else if ((autoTable as any)?.default) {
        (autoTable as any).default(doc, autoTableOptions);
      } else if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(autoTableOptions);
      }

      // Legend & Signature block
      const finalY = Math.min((doc as any).lastAutoTable?.finalY ?? 150, 172) + 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Keterangan Kode Shift:', margin, finalY);

      doc.setFont('helvetica', 'normal');
      let legX = margin;
      shifts.forEach((s) => {
        const txt = `${s.shortCode}: ${s.name} (${s.isOff ? 'OFF' : `${s.startTime}-${s.endTime}`})`;
        doc.text(txt, legX, finalY + 4);
        legX += 45;
      });

      // Approval
      doc.text('Mengetahui / Disetujui:', 220, finalY);
      doc.text('Store Manager / Owner Basco Coffee', 220, finalY + 14);
      doc.line(220, finalY + 12, 280, finalY + 12);

      const filename = `Jadwal_Shift_Basco_${rangeStartDate}_sd_${rangeEndDate}.pdf`;
      doc.save(filename);
      showToast('✅ Laporan jadwal 1 bulan / rentang tanggal (PDF) berhasil diunduh.');
    } catch (err: any) {
      console.error('Error generating Monthly PDF:', err);
      alert('Gagal membuat PDF bulanan: ' + (err?.message || 'Error'));
    } finally {
      setIsExportingMonthlyPdf(false);
    }
  };

  // -------------------------------------------------------------
  // EXPORT JADWAL BULANAN / LINTAS BULAN KE EXCEL (.XLSX)
  // -------------------------------------------------------------
  const handleExportMonthlyExcel = () => {
    setIsExportingMonthlyExcel(true);
    try {
      const activeBaristas = baristas.filter(b => b.isActive);
      const targetBaristas = monthlyFilterBarista === 'all'
        ? activeBaristas
        : activeBaristas.filter(b => b.id === monthlyFilterBarista);

      const headerRow1 = ['BASCO COFFEE - JADWAL OPERASIONAL & ROSTER KERJA BULANAN'];
      const headerRow2 = ['Periode Jadwal:', `${rangeStartDate} s/d ${rangeEndDate}`, 'Total Hari:', monthlyDates.length, 'Jenis:', isCrossMonth ? 'Lintas Bulan' : 'Bulanan'];
      const headerRow3 = ['Dicetak Pada:', new Date().toLocaleString('id-ID'), 'Total Barista Aktif:', targetBaristas.length];
      const emptyRow: any[] = [];

      const colHeaders = [
        'No',
        'Nama Barista',
        'Jabatan',
        ...monthlyDates.map(d => {
          const dayName = INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7].substring(0, 3);
          return `${dayName} ${d.getDate()}/${d.getMonth() + 1}`;
        }),
        'Total Hadir (Shift)',
        'Total Libur (OFF)',
        'Total Jam Kerja'
      ];

      const dataRows = targetBaristas.map((barista, idx) => {
        const stats = calculateBaristaRangeStats(barista.id);
        const dayCols = monthlyDates.map(d => {
          const dKey = formatToDateKey(d);
          const entry = schedules.find(s => s.baristaId === barista.id && s.date === dKey);
          if (!entry) return '-';
          const shift = shifts.find(s => s.id === entry.shiftId);
          if (!shift) return '-';
          if (shift.isOff || entry.status === 'libur') return 'OFF';
          return `${shift.shortCode} (${shift.startTime}-${shift.endTime})`;
        });

        return [
          idx + 1,
          barista.name + (barista.nickname ? ` (${barista.nickname})` : ''),
          barista.role,
          ...dayCols,
          stats.totalShifts,
          stats.totalOff,
          stats.totalHours
        ];
      });

      // Foot row
      const footRow = [
        '',
        'TOTAL BARISTA MASUK BERTUGAS',
        '',
        ...monthlyDates.map(d => {
          const dKey = formatToDateKey(d);
          return targetBaristas.filter(b => {
            const entry = schedules.find(s => s.baristaId === b.id && s.date === dKey);
            if (!entry) return false;
            const sh = shifts.find(x => x.id === entry.shiftId);
            return sh && !sh.isOff && entry.status !== 'libur' && entry.status !== 'izin' && entry.status !== 'sakit';
          }).length;
        }),
        '',
        '',
        ''
      ];

      const aoa = [
        headerRow1,
        headerRow2,
        headerRow3,
        emptyRow,
        colHeaders,
        ...dataRows,
        emptyRow,
        footRow
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const colWidths = [
        { wch: 6 },
        { wch: 25 },
        { wch: 18 },
        ...monthlyDates.map(() => ({ wch: 15 })),
        { wch: 18 },
        { wch: 16 },
        { wch: 16 }
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Roster Bulanan');

      const filename = `Jadwal_Operasional_Basco_${rangeStartDate}_sd_${rangeEndDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast('✅ File Excel Jadwal Operasional (.xlsx) berhasil diunduh.');
    } catch (err: any) {
      console.error('Error generating Excel:', err);
      alert('Gagal mendownload Excel: ' + (err?.message || 'Error'));
    } finally {
      setIsExportingMonthlyExcel(false);
    }
  };

  // -------------------------------------------------------------
  // EXPORT TO IMAGE / PNG (High-DPI 2D Canvas for WhatsApp)
  // -------------------------------------------------------------
  const handleExportImage = () => {
    setIsExportingImage(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D Context tidak tersedia');

      const dpr = 2; // High-DPI Retina
      const width = 1360;
      const headerHeight = 90;
      const colHeaderHeight = 44;
      const rowHeight = 54;
      const dailyTotalHeight = 42;
      const legendHeight = 70;
      const padding = 20;

      const totalRows = filteredBaristas.length;
      const tableHeight = totalRows * rowHeight;
      const height = headerHeight + colHeaderHeight + tableHeight + dailyTotalHeight + legendHeight + padding * 2;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // Header Dark Bar
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, headerHeight);

      // Gold Accent
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, headerHeight - 3, width, 3);

      // Title & Subtitle
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('JADWAL OPERASIONAL BASCO COFFEE', padding + 10, 38);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Periode: ${weekRangeLabel}   •   Basco Coffee Management`, padding + 10, 64);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const printDate = `Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`;
      const dateW = ctx.measureText(printDate).width;
      ctx.fillText(printDate, width - padding - dateW - 10, 64);

      // Table layout calculations
      const tableX = padding;
      const tableY = headerHeight + 16;
      const tableWidth = width - padding * 2;

      const colBaristaWidth = 230;
      const colTotalWidth = 110;
      const colDayWidth = (tableWidth - colBaristaWidth - colTotalWidth) / 7;

      // Draw Column Header
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(tableX, tableY, tableWidth, colHeaderHeight);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('BARISTA & ROLE', tableX + 16, tableY + 27);

      const todayKey = formatToDateKey(new Date());

      weekDates.forEach((d, idx) => {
        const dX = tableX + colBaristaWidth + idx * colDayWidth;
        const isToday = formatToDateKey(d) === todayKey;

        if (isToday) {
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(dX, tableY, colDayWidth, colHeaderHeight);
        }

        ctx.fillStyle = isToday ? '#78350f' : '#1e293b';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const dayName = INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7];
        const dayNameW = ctx.measureText(dayName).width;
        ctx.fillText(dayName, dX + (colDayWidth - dayNameW) / 2, tableY + 18);

        ctx.fillStyle = isToday ? '#b45309' : '#64748b';
        ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const dateStr = `${d.getDate()} ${INDONESIAN_MONTH_NAMES[d.getMonth()].substring(0, 3)}`;
        const dateStrW = ctx.measureText(dateStr).width;
        ctx.fillText(dateStr, dX + (colDayWidth - dateStrW) / 2, tableY + 34);

        // Vertical divider
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dX, tableY);
        ctx.lineTo(dX, tableY + colHeaderHeight + tableHeight + dailyTotalHeight);
        ctx.stroke();
      });

      // Total Header
      const totalColX = tableX + colBaristaWidth + 7 * colDayWidth;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const totW = ctx.measureText('TOTAL JAM').width;
      ctx.fillText('TOTAL JAM', totalColX + (colTotalWidth - totW) / 2, tableY + 27);

      ctx.strokeStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(totalColX, tableY);
      ctx.lineTo(totalColX, tableY + colHeaderHeight + tableHeight + dailyTotalHeight);
      ctx.stroke();

      const shiftColorMap: Record<string, { bg: string; text: string; border: string }> = {
        emerald: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
        sky: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
        amber: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
        violet: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
        indigo: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
        rose: { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
        teal: { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
        slate: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
      };

      // Draw Rows
      filteredBaristas.forEach((barista, rowIdx) => {
        const rowY = tableY + colHeaderHeight + rowIdx * rowHeight;

        ctx.fillStyle = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(tableX, rowY, tableWidth, rowHeight);

        // Bottom border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX, rowY + rowHeight);
        ctx.lineTo(tableX + tableWidth, rowY + rowHeight);
        ctx.stroke();

        // Barista Initial & Name
        ctx.fillStyle = barista.isActive ? '#f59e0b' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(tableX + 24, rowY + rowHeight / 2, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const initial = (barista.nickname || barista.name).charAt(0).toUpperCase();
        const initW = ctx.measureText(initial).width;
        ctx.fillText(initial, tableX + 24 - initW / 2, rowY + rowHeight / 2 + 4);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(barista.name, tableX + 48, rowY + 23);

        ctx.fillStyle = '#64748b';
        ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(barista.role, tableX + 48, rowY + 39);

        let baristaTotalHours = 0;
        let baristaShiftsCount = 0;

        weekDates.forEach((d, dayIdx) => {
          const dX = tableX + colBaristaWidth + dayIdx * colDayWidth;
          const dateKey = formatToDateKey(d);
          const entry = schedules.find(s => s.baristaId === barista.id && s.date === dateKey);

          if (entry) {
            const shift = shifts.find(sh => sh.id === entry.shiftId);
            if (shift) {
              if (!shift.isOff && entry.status !== 'libur') {
                baristaShiftsCount++;
                if (entry.customStartTime && entry.customEndTime) {
                  baristaTotalHours += calculateDurationHours(entry.customStartTime, entry.customEndTime);
                } else {
                  baristaTotalHours += shift.durationHours || 0;
                }
              }

              const theme = shiftColorMap[shift.color] || shiftColorMap.slate;
              const bMarginX = 5;
              const bMarginY = 5;
              const bW = colDayWidth - bMarginX * 2;
              const bH = rowHeight - bMarginY * 2;

              ctx.fillStyle = shift.isOff || entry.status === 'libur' ? '#f1f5f9' : theme.bg;
              ctx.strokeStyle = shift.isOff || entry.status === 'libur' ? '#cbd5e1' : theme.border;
              ctx.lineWidth = 1;

              ctx.beginPath();
              ctx.roundRect(dX + bMarginX, rowY + bMarginY, bW, bH, 6);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = shift.isOff || entry.status === 'libur' ? '#475569' : theme.text;
              ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              const codeText = shift.isOff || entry.status === 'libur' ? 'OFF' : shift.shortCode;
              const codeW = ctx.measureText(codeText).width;
              ctx.fillText(codeText, dX + (colDayWidth - codeW) / 2, rowY + 22);

              ctx.fillStyle = '#475569';
              ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              const timeText = shift.isOff || entry.status === 'libur'
                ? 'Libur'
                : (entry.customStartTime && entry.customEndTime)
                  ? `${entry.customStartTime}-${entry.customEndTime}`
                  : `${shift.startTime}-${shift.endTime}`;
              const timeW = ctx.measureText(timeText).width;
              ctx.fillText(timeText, dX + (colDayWidth - timeW) / 2, rowY + 38);
            }
          } else {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const dashW = ctx.measureText('-').width;
            ctx.fillText('-', dX + (colDayWidth - dashW) / 2, rowY + rowHeight / 2 + 4);
          }
        });

        // Total Column
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const hrsText = `${baristaTotalHours} Jam`;
        const hrsW = ctx.measureText(hrsText).width;
        ctx.fillText(hrsText, totalColX + (colTotalWidth - hrsW) / 2, rowY + 23);

        ctx.fillStyle = '#64748b';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const shiftCountText = `${baristaShiftsCount} shift`;
        const sCountW = ctx.measureText(shiftCountText).width;
        ctx.fillText(shiftCountText, totalColX + (colTotalWidth - sCountW) / 2, rowY + 39);
      });

      // Daily Operational Strength Row
      const dailyTotalY = tableY + colHeaderHeight + tableHeight;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(tableX, dailyTotalY, tableWidth, dailyTotalHeight);

      // Top divider line for the strength row
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableX, dailyTotalY);
      ctx.lineTo(tableX + tableWidth, dailyTotalY);
      ctx.stroke();

      const activeTeamForExport = filteredBaristas.filter(b => b.isActive);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Kekuatan Barista Harian:', tableX + 14, dailyTotalY + 18);

      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`(dari total ${activeTeamForExport.length} staf aktif)`, tableX + 14, dailyTotalY + 32);

      weekDates.forEach((d, dayIdx) => {
        const dX = tableX + colBaristaWidth + dayIdx * colDayWidth;
        const dateKey = formatToDateKey(d);
        const isToday = dateKey === todayKey;

        // Calculate working baristas strictly from active baristas on this date
        const workingBaristas = activeTeamForExport.filter(b => {
          const entry = schedules.find(s => s.baristaId === b.id && s.date === dateKey);
          if (!entry) return false;
          const sh = shifts.find(x => x.id === entry.shiftId);
          return sh && !sh.isOff && entry.status !== 'libur' && entry.status !== 'izin' && entry.status !== 'sakit';
        });

        const activeCount = workingBaristas.length;

        if (isToday) {
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(dX, dailyTotalY, colDayWidth, dailyTotalHeight);
        }

        ctx.fillStyle = isToday ? '#78350f' : activeCount === 0 ? '#e11d48' : '#047857';
        ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const txt = `${activeCount} Barista`;
        const txtW = ctx.measureText(txt).width;
        ctx.fillText(txt, dX + (colDayWidth - txtW) / 2, dailyTotalY + (isToday ? 18 : 24));

        if (isToday) {
          ctx.fillStyle = '#b45309';
          ctx.font = 'bold 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const todayBadge = 'HARI INI';
          const tbW = ctx.measureText(todayBadge).width;
          ctx.fillText(todayBadge, dX + (colDayWidth - tbW) / 2, dailyTotalY + 31);
        }
      });

      // Total column for strength row
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const totTeamTxt = `${activeTeamForExport.length} Staf`;
      const totTeamW = ctx.measureText(totTeamTxt).width;
      ctx.fillText(totTeamTxt, totalColX + (colTotalWidth - totTeamW) / 2, dailyTotalY + 18);

      ctx.fillStyle = '#64748b';
      ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const totSub = 'Total Tim';
      const totSubW = ctx.measureText(totSub).width;
      ctx.fillText(totSub, totalColX + (colTotalWidth - totSubW) / 2, dailyTotalY + 31);

      // Outer Border
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tableX, tableY, tableWidth, colHeaderHeight + tableHeight + dailyTotalHeight);

      // Legend
      const legendY = dailyTotalY + dailyTotalHeight + 18;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Keterangan Master Jam Shift Bar:', tableX, legendY);

      let legX = tableX;
      shifts.forEach((s) => {
        const theme = shiftColorMap[s.color] || shiftColorMap.slate;
        ctx.fillStyle = theme.bg;
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(legX, legendY + 8, 44, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.text;
        ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const cW = ctx.measureText(s.shortCode).width;
        ctx.fillText(s.shortCode, legX + (44 - cW) / 2, legendY + 22);

        ctx.fillStyle = '#334155';
        ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const desc = `${s.name} (${s.isOff ? 'OFF' : `${s.startTime}-${s.endTime}`})`;
        ctx.fillText(desc, legX + 50, legendY + 22);

        legX += ctx.measureText(desc).width + 68;
      });

      // Export file download
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const filename = `Jadwal_Shift_Barista_${formatToDateKey(startWeek)}_sd_${formatToDateKey(endWeek)}.png`;
      link.download = filename;
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('✅ Gambar jadwal barista (PNG HD) berhasil diexport.');
    } catch (err: any) {
      console.error('Error exporting image:', err);
      alert('Gagal membuat gambar jadwal: ' + (err?.message || 'Error'));
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in" id="barista-schedule-page">
      
      {/* Toast Notification */}
      {exportToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 border border-slate-700 animate-slide-up text-xs font-bold">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{exportToast}</span>
        </div>
      )}

      {/* TOP HERO & ACTIONS BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-amber-900/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Manajemen Tim & Jadwal Shift
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
                Jadwal Operasional Basco Coffee
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
            Atur jadwal shift mingguan, rotasi jam bar, rekap jam kerja tim barista, serta export laporan PDF & Gambar.
          </p>
        </div>

        {/* Action Buttons: Cloud Badge, Simpan ke Sheet, Muat Sheet, Tambah Barista, Jam Shift, Export PDF, Export Gambar, Backup JSON */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {spreadsheetId && (
            <div className="flex items-center space-x-2 bg-emerald-950/80 border border-emerald-500/40 px-3 py-2 rounded-xl text-xs">
              <Cloud className={`h-4 w-4 ${isSyncingCloud ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
              <div>
                <span className="text-[9.5px] font-bold text-emerald-300 uppercase block tracking-wider">
                  {isSyncingCloud ? 'Menyimpan...' : isLoadingCloud ? 'Memuat Sheet...' : 'Realtime Cloud'}
                </span>
                <span className="text-[9px] text-emerald-400/80">
                  {lastSyncTime ? `Sinkron ${lastSyncTime}` : 'Terintegrasi Sheets'}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleManualSaveToSheet}
            disabled={isSyncingCloud}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer active:scale-[0.98]"
            title="Simpan data jadwal operasional, tim barista, & jam shift ke Google Sheets sekarang"
          >
            <Save className={`h-4 w-4 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
            <span>{isSyncingCloud ? 'Menyimpan...' : 'Simpan ke Sheet'}</span>
          </button>

          {spreadsheetId && (
            <button
              type="button"
              onClick={() => loadBaristaDataFromCloud(true)}
              disabled={isLoadingCloud || isSyncingCloud}
              className="px-3 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-60 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center space-x-1.5 cursor-pointer"
              title="Muat ulang data jadwal & tim barista dari Google Sheets"
            >
              <RefreshCw className={`h-4 w-4 text-amber-400 ${isLoadingCloud ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoadingCloud ? 'Memuat...' : 'Muat Sheet'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingBarista(null);
              setIsBaristaModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Barista</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShiftMasterModalOpen(true)}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center space-x-1.5 cursor-pointer"
            title="Edit pilihan jam shift bar"
          >
            <Settings2 className="h-4 w-4 text-amber-400" />
            <span>Jam Shift Bar</span>
          </button>

          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
              title="Export Laporan PDF Jadwal"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportImage}
              disabled={isExportingImage}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
              title="Export Gambar PNG untuk WhatsApp"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Gambar</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsBackupModalOpen(true)}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            title="Backup dan Restore JSON semua data aplikasi"
          >
            <FileJson className="h-4 w-4" />
            <span>Backup JSON</span>
          </button>
        </div>
      </div>

      {/* METRICS STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Barista Aktif</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{activeBaristasCount} <span className="text-xs font-bold text-slate-400">/ {baristas.length} Orang</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Total Jam Kerja Minggu Ini</p>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{weekTotalHours} <span className="text-xs font-bold text-slate-400">Jam</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Rata-rata / Barista</p>
            <p className="text-xl font-black text-sky-600 mt-0.5">{avgHoursPerBarista} <span className="text-xs font-bold text-slate-400">Jam/Mgg</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Pilihan Jam Shift Bar</p>
            <p className="text-xl font-black text-violet-600 mt-0.5">{shifts.length} <span className="text-xs font-bold text-slate-400">Master Slot</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
            <Layers className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* NAVIGATION DROPDOWN SELECTOR & CONTEXTUAL CONTROLLERS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* View Mode Dropdown */}
        <div className="relative z-30" ref={viewDropdownRef}>
          <button
            type="button"
            onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
            className="w-full md:w-auto flex items-center justify-between space-x-3 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl border border-slate-700 shadow-sm transition cursor-pointer group min-w-[260px]"
            aria-expanded={isViewDropdownOpen}
            aria-haspopup="true"
          >
            <div className="flex items-center space-x-3 text-left">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs ${currentViewOption.colorClass}`}>
                <CurrentViewIcon className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-extrabold text-slate-400 block tracking-wider leading-none">
                  Mode Tampilan
                </span>
                <span className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center space-x-2 mt-0.5">
                  <span>{currentViewOption.name}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded-md text-amber-300 font-mono font-bold border border-slate-700">
                    {currentViewOption.badge}
                  </span>
                </span>
              </div>
            </div>
            
            <div className="flex items-center pl-2 border-l border-slate-700/80 text-slate-400 group-hover:text-amber-400 transition">
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isViewDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
            </div>
          </button>

          {/* Dropdown Options Menu Overlay */}
          {isViewDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-full md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden py-1.5 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                <span>Pilih Menu Tampilan</span>
                <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-bold">
                  Basco Coffee
                </span>
              </div>
              <div className="p-1.5 space-y-1">
                {viewOptions.map((opt) => {
                  const IconComp = opt.icon;
                  const isSelected = viewMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setViewMode(opt.id);
                        setIsViewDropdownOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer group ${
                        isSelected 
                          ? 'bg-amber-500/15 border border-amber-400/60 shadow-xs' 
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${opt.colorClass}`}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-black tracking-tight ${isSelected ? 'text-amber-950' : 'text-slate-900 group-hover:text-slate-950'}`}>
                              {opt.label}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                            {opt.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {opt.badge}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Contextual Controller for Matrix View (Week Navigator, Copy Tool & Save) */}
        {viewMode === 'matrix' && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            
            {spreadsheetId && (
              <button
                type="button"
                onClick={handleManualSaveToSheet}
                disabled={isSyncingCloud}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                title="Simpan perubahan jadwal minggu ini langsung ke Google Sheets"
              >
                <Save className={`h-3.5 w-3.5 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
                <span>{isSyncingCloud ? 'Menyimpan...' : 'Simpan Jadwal'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLastWeekSchedule}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              title="Salin semua jadwal shift dari minggu lalu ke minggu yang sedang dilihat saat ini"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Salin Jadwal Minggu Lalu</span>
            </button>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200 cursor-pointer"
                title="Minggu Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                <Calendar className="h-4 w-4 text-amber-700 shrink-0" />
                <span className="text-xs font-black text-amber-950 font-mono tracking-tight whitespace-nowrap">
                  {weekRangeLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCurrentWeek}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Minggu Ini
              </button>

              <button
                type="button"
                onClick={handleNextWeek}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200 cursor-pointer"
                title="Minggu Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('monthly-cross-schedule-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-1 cursor-pointer active:scale-95"
                title="Lihat jadwal shift 1 bulan & lintas bulan di bawah"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Jadwal 1 Bulan</span>
              </button>
            </div>
          </div>
        )}

        {/* Contextual Controller for Monthly View */}
        {viewMode === 'monthly' && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <button
              type="button"
              onClick={handleExportMonthlyPDF}
              disabled={isExportingMonthlyPdf}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Download PDF 1 Bulan</span>
            </button>
            <button
              type="button"
              onClick={handleExportMonthlyExcel}
              disabled={isExportingMonthlyExcel}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Download Excel (.xlsx)</span>
            </button>
          </div>
        )}

        {/* Contextual Controller for Daily View */}
        {viewMode === 'daily' && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <span className="text-xs font-bold text-slate-500">Pilih Tanggal:</span>
            <div className="flex items-center space-x-1.5">
              <input
                type="date"
                value={selectedDailyDate}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setSelectedDailyDate(formatToDateKey(new Date()))}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Hari Ini
              </button>
            </div>
          </div>
        )}

        {/* Contextual Controller for Roster & Shifts */}
        {(viewMode === 'roster' || viewMode === 'shifts' || viewMode === 'payroll') && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Mode Aktif: <strong className="text-slate-800">{currentViewOption.label}</strong></span>
          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* 1. JADWAL OPERASIONAL & ROSTER SHIFT TIM (MINGGUAN & BULANAN) */}
      {/* ========================================================= */}
      {(viewMode === 'matrix' || viewMode === 'monthly') && (
        <div className="space-y-4">
          
          {/* Bagian Jadwal Mingguan (Hanya tampil saat mode Matriks Mingguan) */}
          {viewMode === 'matrix' && (
            <>
              {/* Quick Schedule Management Bar (Copy to next week, Clear week, Shift Master) */}
              <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl border border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-extrabold text-slate-200 text-xs">Aksi Cepat Jadwal:</span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">Kelola rotasi dan salin jadwal mingguan secara instan</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLastWeekSchedule}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg transition flex items-center space-x-1 cursor-pointer"
                title="Salin jadwal sama dengan minggu lalu"
              >
                <Copy className="h-3 w-3" />
                <span>Salin Dari Minggu Lalu</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCurrentWeekToNextWeek}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] rounded-lg border border-slate-700 transition flex items-center space-x-1 cursor-pointer"
                title="Salin jadwal minggu ini ke minggu depan"
              >
                <ArrowRightLeft className="h-3 w-3 text-sky-400" />
                <span>Salin Ke Minggu Depan</span>
              </button>

              <button
                type="button"
                onClick={handleClearWeekSchedule}
                className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-bold text-[11px] rounded-lg border border-rose-800/40 transition flex items-center space-x-1 cursor-pointer"
                title="Kosongkan jadwal minggu ini"
              >
                <RotateCcw className="h-3 w-3 text-rose-400" />
                <span>Kosongkan Minggu Ini</span>
              </button>
            </div>
          </div>

          {/* Legend of Shift Badges */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">Pilihan Jam Shift Bar:</span>
              {shifts.map(s => {
                const theme = COLOR_THEMES[s.color] || COLOR_THEMES.emerald;
                return (
                  <div key={s.id} className="flex items-center space-x-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${theme.badge}`}>
                      {s.shortCode}
                    </span>
                    <span className="font-bold text-slate-700 text-[11px]">{s.name}</span>
                    <span className="text-slate-400 font-mono text-[10px]">({s.isOff ? 'OFF' : `${s.startTime}-${s.endTime}`})</span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsShiftMasterModalOpen(true)}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1 hover:underline"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Edit Jam Shift</span>
            </button>
          </div>

          {/* Schedule Table Container (Captured by html2canvas for Export) */}
          <div 
            ref={scheduleExportRef}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            {/* Header in image export */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Coffee className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight uppercase">Jadwal Shift Barista</h3>
                  <p className="text-[11px] text-amber-300 font-mono font-medium">{weekRangeLabel}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-extrabold">Basco Cafe Management</span>
                <span className="text-[11px] font-bold text-slate-300">Klik slot jadwal untuk mengubah shift</span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 text-xs font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4 w-52 sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                      Barista & Role
                    </th>
                    {weekDates.map((d, i) => {
                      const dayName = INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7];
                      const isToday = formatToDateKey(d) === formatToDateKey(new Date());
                      return (
                        <th 
                          key={i} 
                          className={`py-2.5 px-2.5 text-center border-r border-slate-200 last:border-r-0 ${
                            isToday ? 'bg-amber-100/70 text-amber-950 font-black' : ''
                          }`}
                        >
                          <span className="block text-[11px] font-extrabold">{dayName}</span>
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                            isToday ? 'bg-amber-500 text-white' : 'text-slate-500'
                          }`}>
                            {d.getDate()} {INDONESIAN_MONTH_NAMES[d.getMonth()].substring(0, 3)}
                          </span>
                        </th>
                      );
                    })}
                    <th className="py-3 px-3 text-center w-24 bg-slate-100 border-l border-slate-200">
                      Total Jam
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs font-medium">
                  {filteredBaristas.map((barista) => {
                    const stats = calculateBaristaWeekHours(barista.id);
                    const bTheme = COLOR_THEMES[barista.color] || COLOR_THEMES.amber;

                    return (
                      <tr key={barista.id} className="hover:bg-slate-50/80 transition group">
                        
                        {/* Barista Profile Column */}
                        <td className="py-3 px-4 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-200 z-10 shadow-xs">
                          <div className="flex items-center space-x-2.5">
                            <div className={`w-8 h-8 rounded-xl ${bTheme.bg} text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs`}>
                              {barista.nickname ? barista.nickname.charAt(0).toUpperCase() : barista.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-extrabold text-slate-900 text-xs truncate max-w-[130px]" title={barista.name}>
                                  {barista.name}
                                </span>
                                {!barista.isActive && (
                                  <span className="text-[9px] bg-slate-200 text-slate-600 px-1 py-0.2 rounded">Off</span>
                                )}
                              </div>
                              <p className="text-[10.5px] text-slate-500 font-semibold truncate">
                                {barista.role}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 7 Days of the Week Cells */}
                        {weekDates.map((d, dIdx) => {
                          const dateKey = formatToDateKey(d);
                          const entry = schedules.find(s => s.baristaId === barista.id && s.date === dateKey);
                          const shift = entry ? shifts.find(s => s.id === entry.shiftId) : null;
                          const theme = shift ? (COLOR_THEMES[shift.color] || COLOR_THEMES.emerald) : null;
                          const isToday = dateKey === formatToDateKey(new Date());

                          return (
                            <td 
                              key={dIdx} 
                              className={`py-2 px-1.5 text-center border-r border-slate-200 last:border-r-0 align-middle ${
                                isToday ? 'bg-amber-50/30' : ''
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCellTarget({
                                    baristaId: barista.id,
                                    baristaName: barista.name,
                                    dateKey,
                                    dateLabel: `${INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7]}, ${d.getDate()} ${INDONESIAN_MONTH_NAMES[d.getMonth()]}`,
                                    currentEntry: entry || null
                                  });
                                }}
                                className={`w-full p-1.5 rounded-xl border text-center transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                                  shift
                                    ? shift.isOff || entry?.status === 'libur'
                                      ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                                      : `${theme?.lightBg} ${theme?.border} ${theme?.text} shadow-2xs hover:shadow-xs`
                                    : 'bg-slate-50/50 border-dashed border-slate-200 text-slate-400 hover:bg-slate-100 hover:border-slate-300'
                                }`}
                              >
                                {shift ? (
                                  <div>
                                    <div className="flex items-center justify-center space-x-1">
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                        shift.isOff ? 'bg-slate-200 text-slate-700' : theme?.badge
                                      }`}>
                                        {shift.shortCode}
                                      </span>
                                    </div>
                                    <p className="text-[10px] font-mono font-bold mt-0.5 leading-tight">
                                      {shift.isOff ? (
                                        'Libur'
                                      ) : entry?.customStartTime && entry?.customEndTime ? (
                                        `${entry.customStartTime}-${entry.customEndTime}`
                                      ) : (
                                        `${shift.startTime}-${shift.endTime}`
                                      )}
                                    </p>
                                    {entry?.status && entry.status !== 'scheduled' && (
                                      <span className="text-[8.5px] font-black uppercase text-amber-700 block tracking-tight">
                                        • {entry.status}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="py-2 text-[10px] font-semibold text-slate-400 flex items-center justify-center space-x-0.5">
                                    <Plus className="h-3 w-3" />
                                    <span>Set</span>
                                  </div>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        {/* Total Hours Column */}
                        <td className="py-3 px-3 text-center border-l border-slate-200 bg-slate-50/40">
                          <span className="text-xs font-black font-mono text-slate-900 block">
                            {stats.totalHours} Jam
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {stats.totalShifts} shift
                          </span>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Daily Operational Strength / Shift Count Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-700 font-bold">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <div>
                  <span className="block font-black text-slate-900 text-xs">Kekuatan Barista Harian Minggu Ini</span>
                  <span className="block text-[10.5px] text-slate-500 font-normal">
                    Jumlah barista masuk bertugas per hari (dari total {baristas.filter(b => b.isActive).length} staf aktif)
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold text-slate-700 w-full md:w-auto">
                {weekDates.map((d, idx) => {
                  const dKey = formatToDateKey(d);
                  const isToday = dKey === formatToDateKey(new Date());

                  // Filter strictly from the current active baristas in the team
                  const activeTeam = baristas.filter(b => b.isActive);
                  const workingBaristas = activeTeam.filter(b => {
                    const entry = schedules.find(s => s.baristaId === b.id && s.date === dKey);
                    if (!entry) return false;
                    const shift = shifts.find(sh => sh.id === entry.shiftId);
                    return shift && !shift.isOff && entry.status !== 'libur' && entry.status !== 'izin' && entry.status !== 'sakit';
                  });

                  const activeCount = workingBaristas.length;
                  const totalTeamCount = activeTeam.length;
                  const offOrUnsetCount = totalTeamCount - activeCount;

                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border transition ${
                        isToday 
                          ? 'bg-amber-100/90 border-amber-300 shadow-2xs' 
                          : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                      title={`${INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7]}, ${d.getDate()} ${INDONESIAN_MONTH_NAMES[d.getMonth()]}: ${activeCount} Barista Masuk Bertugas, ${offOrUnsetCount} Libur/Off dari total ${totalTeamCount} Barista`}
                    >
                      <span className={`font-sans text-[10.5px] uppercase font-extrabold ${isToday ? 'text-amber-900' : 'text-slate-500'}`}>
                        {INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7].substring(0, 3)}:
                      </span>
                      <span className={`font-black text-xs ${isToday ? 'text-amber-950 font-mono' : activeCount === 0 ? 'text-rose-600 font-mono' : 'text-slate-900 font-mono'}`}>
                        {activeCount}
                      </span>
                      <span className="font-sans text-[10px] font-bold text-slate-500">
                        Barista
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </>
      )}

          {/* ==================================================================== */}
          {/* TAMPILAN SHIFT SELAMA 1 BULAN & RENTANG TANGGAL LEWAT BULAN */}
          {/* DILENGKAPI DOWNLOAD JADWAL 1 BULAN ATAU LEBIH (PDF & EXCEL) */}
          {/* ==================================================================== */}
          <div 
            id="monthly-cross-schedule-section" 
            className={`${viewMode === 'matrix' ? 'mt-8 pt-6 border-t-2 border-dashed border-amber-200/80' : ''} space-y-4`}
          >
            
            {/* Main Header Card */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-md">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                <div className="flex items-start sm:items-center space-x-3.5">
                  <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 rounded-2xl shadow-sm shrink-0">
                    <CalendarRange className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                        Jadwal Shift 1 Bulan & Rentang Lintas Bulan
                      </h3>
                      {isCrossMonth && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          🗓️ Rentang Lintas Bulan
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {monthlyDates.length} Hari Kerja
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 font-mono">
                      {monthlyRangeLabel}
                    </p>
                  </div>
                </div>

                {/* Download Actions (PDF & Excel 1 Bulan atau Lebih) */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportMonthlyPDF}
                    disabled={isExportingMonthlyPdf}
                    className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    title="Download jadwal 1 bulan / lintas bulan dalam format PDF Landscape A4 resmi"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{isExportingMonthlyPdf ? 'Membuat PDF...' : 'Download Jadwal (PDF)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportMonthlyExcel}
                    disabled={isExportingMonthlyExcel}
                    className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    title="Download jadwal 1 bulan / lintas bulan dalam format spreadsheet Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>{isExportingMonthlyExcel ? 'Menyiapkan Excel...' : 'Download Jadwal (Excel)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
                    title="Cetak Jadwal"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </div>

              </div>

              {/* Control Bar: Presets & Date Pickers */}
              <div className="mt-5 pt-4 border-t border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                
                {/* Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase tracking-wider">Pilihan Rentang:</span>
                  
                  <button
                    type="button"
                    onClick={() => applyMonthlyPreset('current_month')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                      monthlyPreset === 'current_month'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    1 Bulan Penuh (Bulan Ini)
                  </button>

                  <button
                    type="button"
                    onClick={() => applyMonthlyPreset('next_month')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                      monthlyPreset === 'next_month'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    1 Bulan Depan
                  </button>

                  <button
                    type="button"
                    onClick={() => applyMonthlyPreset('prev_month')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                      monthlyPreset === 'prev_month'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    1 Bulan Lalu
                  </button>

                  <button
                    type="button"
                    onClick={() => applyMonthlyPreset('payroll_25')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                      monthlyPreset === 'payroll_25'
                        ? 'bg-purple-500 text-white font-black'
                        : 'bg-slate-800 text-purple-300 hover:bg-slate-700 border border-purple-500/40'
                    }`}
                    title="Rentang Lewat Bulan dari tanggal 25 s/d 24 (Standar Cut-off Payroll Basco)"
                  >
                    🔄 Lintas Bulan (25-24)
                  </button>
                </div>

                {/* Custom Date Pickers & Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1 rounded-xl border border-slate-700">
                    <span className="text-[10.5px] font-bold text-slate-400">Mulai:</span>
                    <input
                      type="date"
                      value={rangeStartDate}
                      onChange={(e) => {
                        setRangeStartDate(e.target.value);
                        setMonthlyPreset('custom');
                      }}
                      className="bg-transparent text-white font-mono text-xs font-bold outline-none cursor-pointer"
                    />
                  </div>

                  <span className="text-slate-500 font-bold">s/d</span>

                  <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1 rounded-xl border border-slate-700">
                    <span className="text-[10.5px] font-bold text-slate-400">Sampai:</span>
                    <input
                      type="date"
                      value={rangeEndDate}
                      onChange={(e) => {
                        setRangeEndDate(e.target.value);
                        setMonthlyPreset('custom');
                      }}
                      className="bg-transparent text-white font-mono text-xs font-bold outline-none cursor-pointer"
                    />
                  </div>

                  {/* Filter Staf */}
                  <select
                    value={monthlyFilterBarista}
                    onChange={(e) => setMonthlyFilterBarista(e.target.value)}
                    className="bg-slate-800 text-white text-xs font-bold px-2 py-1.5 rounded-xl border border-slate-700 outline-none cursor-pointer"
                  >
                    <option value="all">Semua Staf ({baristas.filter(b => b.isActive).length})</option>
                    {baristas.filter(b => b.isActive).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* Monthly Matrix Table Card */}
            <div 
              ref={monthlyScheduleExportRef}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Monthly Matrix Table Subheader */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-extrabold text-slate-800">
                    Matriks Shift {monthlyDates.length} Hari ({monthlyDates[0]?.getDate()} {INDONESIAN_MONTH_NAMES[monthlyDates[0]?.getMonth()]} - {monthlyDates[monthlyDates.length-1]?.getDate()} {INDONESIAN_MONTH_NAMES[monthlyDates[monthlyDates.length-1]?.getMonth()]})
                  </span>
                  <span className="text-slate-400 text-[11px] hidden md:inline">
                    • Klik kotak slot untuk mengubah shift langsung
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-[11px] font-bold text-slate-500">
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
                    <span>Hari Ini</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 rounded bg-rose-50 border border-rose-200" />
                    <span>Sabtu/Minggu</span>
                  </div>
                </div>
              </div>

              {/* Scrollable Monthly Grid */}
              <div className="overflow-x-auto max-w-full">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-48 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 shadow-xs">
                        Barista & Jabatan
                      </th>
                      {monthlyDates.map((d, idx) => {
                        const dayNum = (d.getDay() + 6) % 7;
                        const dayName = INDONESIAN_DAY_NAMES[dayNum].substring(0, 3);
                        const isWeekend = dayNum === 5 || dayNum === 6;
                        const isToday = formatToDateKey(d) === formatToDateKey(new Date());

                        return (
                          <th 
                            key={idx}
                            className={`py-2 px-1 text-center min-w-[42px] border-r border-slate-200 last:border-r-0 ${
                              isToday 
                                ? 'bg-amber-100/80 text-amber-950 font-black ring-1 ring-amber-400' 
                                : isWeekend 
                                  ? 'bg-rose-50/70 text-rose-700' 
                                  : 'text-slate-700'
                            }`}
                          >
                            <span className="block text-[9.5px] font-bold opacity-80">{dayName}</span>
                            <span className="block text-xs font-black font-mono">{d.getDate()}</span>
                            <span className="block text-[8px] font-mono text-slate-400">
                              {d.getMonth() + 1}
                            </span>
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-2.5 text-center w-16 bg-slate-100 border-l border-slate-200 text-[10.5px]">
                        Masuk
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-14 bg-slate-100 border-l border-slate-200 text-[10.5px]">
                        OFF
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-16 bg-slate-100 border-l border-slate-200 text-[10.5px]">
                        Total Jam
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(monthlyFilterBarista === 'all'
                      ? baristas.filter(b => b.isActive)
                      : baristas.filter(b => b.id === monthlyFilterBarista)
                    ).map((barista) => {
                      const stats = calculateBaristaRangeStats(barista.id);

                      return (
                        <tr key={barista.id} className="hover:bg-slate-50/80 transition group">
                          {/* Sticky Left Column: Barista Info */}
                          <td className="py-2 px-3 sticky left-0 bg-white group-hover:bg-slate-50 transition z-10 border-r border-slate-200 shadow-xs">
                            <div className="flex items-center space-x-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                COLOR_THEMES[barista.color]?.badge || 'bg-amber-500 text-white'
                              }`}>
                                {barista.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <span className="block font-black text-slate-900 text-xs truncate max-w-[125px]" title={barista.name}>
                                  {barista.name}
                                </span>
                                <span className="block text-[10px] text-slate-500 font-semibold truncate">
                                  {barista.role}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Day Columns */}
                          {monthlyDates.map((d, dIdx) => {
                            const dateKey = formatToDateKey(d);
                            const entry = schedules.find(s => s.baristaId === barista.id && s.date === dateKey);
                            const shift = entry ? shifts.find(s => s.id === entry.shiftId) : null;
                            const theme = shift ? (COLOR_THEMES[shift.color] || COLOR_THEMES.emerald) : null;
                            const isToday = dateKey === formatToDateKey(new Date());
                            const dayNum = (d.getDay() + 6) % 7;
                            const isWeekend = dayNum === 5 || dayNum === 6;

                            return (
                              <td
                                key={dIdx}
                                className={`p-0.5 text-center border-r border-slate-100 align-middle ${
                                  isToday ? 'bg-amber-50/40' : isWeekend ? 'bg-rose-50/20' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCellTarget({
                                      baristaId: barista.id,
                                      baristaName: barista.name,
                                      dateKey,
                                      dateLabel: `${INDONESIAN_DAY_NAMES[dayNum]}, ${d.getDate()} ${INDONESIAN_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
                                      currentEntry: entry || null
                                    });
                                  }}
                                  className={`w-full py-1.5 px-0.5 rounded-lg border text-center transition cursor-pointer hover:scale-105 ${
                                    shift
                                      ? shift.isOff || entry?.status === 'libur'
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
                                        : `${theme?.lightBg} ${theme?.border} ${theme?.text} shadow-2xs font-black`
                                      : 'bg-transparent border-transparent hover:bg-slate-100 text-slate-300'
                                  }`}
                                  title={
                                    shift
                                      ? `${barista.name}: ${shift.name} (${shift.isOff ? 'Libur' : `${shift.startTime}-${shift.endTime}`})`
                                      : `${barista.name}: Belum ada shift`
                                  }
                                >
                                  <span className="block text-[9.5px] font-black uppercase leading-tight font-mono">
                                    {shift ? (shift.isOff ? 'OFF' : shift.shortCode) : '-'}
                                  </span>
                                </button>
                              </td>
                            );
                          })}

                          {/* Stats Summary Columns */}
                          <td className="py-2 px-2 text-center font-bold font-mono text-emerald-700 bg-slate-50/50 border-l border-slate-200 text-xs">
                            {stats.totalShifts}
                          </td>
                          <td className="py-2 px-2 text-center font-bold font-mono text-slate-500 bg-slate-50/50 border-l border-slate-200 text-xs">
                            {stats.totalOff}
                          </td>
                          <td className="py-2 px-2 text-center font-black font-mono text-slate-900 bg-slate-50/50 border-l border-slate-200 text-xs">
                            {stats.totalHours}j
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Foot Row: Kekuatan Barista Masuk Harian Sepanjang Bulan */}
                  <tfoot>
                    <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-extrabold text-xs">
                      <td className="py-2.5 px-3 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 shadow-xs">
                        <div className="flex items-center space-x-1.5 text-slate-800">
                          <Users className="h-3.5 w-3.5 text-amber-600" />
                          <span>Kekuatan Masuk</span>
                        </div>
                      </td>

                      {monthlyDates.map((d, idx) => {
                        const dKey = formatToDateKey(d);
                        const isToday = dKey === formatToDateKey(new Date());
                        const activeTeam = baristas.filter(b => b.isActive);
                        const count = activeTeam.filter(b => {
                          const entry = schedules.find(s => s.baristaId === b.id && s.date === dKey);
                          if (!entry) return false;
                          const shift = shifts.find(sh => sh.id === entry.shiftId);
                          return shift && !shift.isOff && entry.status !== 'libur' && entry.status !== 'izin' && entry.status !== 'sakit';
                        }).length;

                        return (
                          <td
                            key={idx}
                            className={`py-2 px-0.5 text-center font-mono font-black border-r border-slate-200 last:border-r-0 ${
                              isToday
                                ? 'bg-amber-200 text-amber-950 ring-1 ring-amber-400'
                                : count === 0
                                  ? 'text-rose-600'
                                  : 'text-slate-800'
                            }`}
                            title={`${count} barista bertugas`}
                          >
                            {count}
                          </td>
                        );
                      })}

                      <td colSpan={3} className="py-2 px-2 text-center font-bold text-[10px] text-slate-500 bg-slate-100 border-l border-slate-200">
                        Total {monthlyDates.length} Hari
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* 2. DAILY SHIFT KANBAN / BOARD VIEW */}
      {/* ========================================================= */}
      {viewMode === 'daily' && (
        <div className="space-y-4">
          
          {/* Day Selector Buttons */}
          <div className="flex overflow-x-auto gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
            {weekDates.map((d, i) => {
              const dKey = formatToDateKey(d);
              const isSelected = selectedDailyDate === dKey;
              const isToday = dKey === formatToDateKey(new Date());

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDailyDate(dKey)}
                  className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-center transition cursor-pointer border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-500'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span className="text-xs font-extrabold uppercase">{INDONESIAN_DAY_NAMES[(d.getDay() + 6) % 7]}</span>
                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </div>
                  <span className={`text-[11px] font-mono font-bold block mt-0.5 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`}>
                    {d.getDate()} {INDONESIAN_MONTH_NAMES[d.getMonth()]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Daily Shift Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {shifts.map((shift) => {
              const theme = COLOR_THEMES[shift.color] || COLOR_THEMES.emerald;
              const assignedBaristas = schedules
                .filter(s => s.date === selectedDailyDate && s.shiftId === shift.id)
                .map(s => {
                  const barista = baristas.find(b => b.id === s.baristaId);
                  return { barista, schedule: s };
                })
                .filter(item => item.barista !== undefined);

              return (
                <div 
                  key={shift.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden"
                >
                  {/* Shift Column Header */}
                  <div className={`p-4 border-b ${theme.lightBg} border-slate-200 flex items-center justify-between`}>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${theme.badge}`}>
                        {shift.shortCode}
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{shift.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono font-bold">
                          {shift.isOff ? 'Hari Libur / Off' : `${shift.startTime} - ${shift.endTime} (${shift.durationHours} Jam)`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2 py-1 bg-white rounded-lg border border-slate-200 text-slate-700">
                      {assignedBaristas.length}
                    </span>
                  </div>

                  {/* Assigned Barista Cards */}
                  <div className="p-3 space-y-2 flex-grow min-h-[140px] bg-slate-50/50">
                    {assignedBaristas.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl text-slate-400">
                        <p className="text-xs font-semibold">Belum ada barista</p>
                        <p className="text-[10px]">pada shift ini</p>
                      </div>
                    ) : (
                      assignedBaristas.map(({ barista, schedule }) => {
                        const bTheme = barista ? (COLOR_THEMES[barista.color] || COLOR_THEMES.amber) : COLOR_THEMES.amber;
                        return (
                          <div
                            key={schedule.id}
                            onClick={() => {
                              if (barista) {
                                setActiveCellTarget({
                                  baristaId: barista.id,
                                  baristaName: barista.name,
                                  dateKey: selectedDailyDate,
                                  dateLabel: selectedDailyDate,
                                  currentEntry: schedule
                                });
                              }
                            }}
                            className="bg-white p-3 rounded-xl border border-slate-200 hover:border-amber-400 shadow-2xs hover:shadow-xs transition cursor-pointer flex items-center justify-between group"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className={`w-7 h-7 rounded-lg ${bTheme.bg} text-white flex items-center justify-center font-black text-xs shrink-0`}>
                                {barista?.nickname ? barista.nickname.charAt(0).toUpperCase() : (barista?.name.charAt(0).toUpperCase() || 'B')}
                              </div>
                              <div>
                                <h5 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition">
                                  {barista?.name}
                                </h5>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  {barista?.role}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              {schedule.status !== 'scheduled' && (
                                <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  {schedule.status}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Barista to this shift button */}
                  <div className="p-2.5 bg-white border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        // Pick first unassigned barista
                        const assignedIds = new Set(schedules.filter(s => s.date === selectedDailyDate).map(s => s.baristaId));
                        const unassigned = baristas.find(b => !assignedIds.has(b.id));
                        if (unassigned) {
                          handleAssignShift(unassigned.id, selectedDailyDate, shift.id, shift.isOff ? 'libur' : 'scheduled');
                          showToast(`${unassigned.name} dimasukkan ke ${shift.name}`);
                        } else if (baristas.length > 0) {
                          setActiveCellTarget({
                            baristaId: baristas[0].id,
                            baristaName: baristas[0].name,
                            dateKey: selectedDailyDate,
                            dateLabel: selectedDailyDate,
                            currentEntry: null
                          });
                        }
                      }}
                      className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-slate-500" />
                      <span>Tugaskan Barista</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ROSTER / TEAM MANAGEMENT VIEW */}
      {/* ========================================================= */}
      {viewMode === 'roster' && (
        <div className="space-y-4">
          
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="relative flex-grow sm:w-64">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari barista atau role..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="all">Semua Jabatan</option>
                <option value="Head Barista">Head Barista</option>
                <option value="Senior Barista">Senior Barista</option>
                <option value="Barista">Barista</option>
                <option value="Junior Barista">Junior Barista</option>
                <option value="Cashier / Bar">Cashier / Bar</option>
                <option value="Part Time">Part Time</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingBarista(null);
                setIsBaristaModalOpen(true);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Barista Baru</span>
            </button>
          </div>

          {/* Baristas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBaristas.map((barista) => {
              const stats = calculateBaristaWeekHours(barista.id);
              const theme = COLOR_THEMES[barista.color] || COLOR_THEMES.amber;

              return (
                <div
                  key={barista.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-11 h-11 rounded-2xl ${theme.bg} text-white flex items-center justify-center font-black text-sm shadow-sm`}>
                          {barista.nickname ? barista.nickname.charAt(0).toUpperCase() : barista.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{barista.name}</h4>
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-block mt-0.5">
                            {barista.role}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBarista(barista);
                            setIsBaristaModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Edit barista"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBarista(barista.id, barista.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus barista"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                      {/* Contact & Status */}
                    <div className="space-y-2 pt-1 text-xs text-slate-600">
                      {barista.phone && (
                        <div className="flex items-center space-x-2 font-mono">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <a href={`https://wa.me/${barista.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline font-bold">
                            {barista.phone}
                          </a>
                        </div>
                      )}

                      {/* Masa Kerja & Gaji Badges */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-150">
                          <span className="text-slate-500 font-bold flex items-center space-x-1">
                            <Award className="h-3.5 w-3.5 text-amber-600" />
                            <span>Masa Kerja:</span>
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {barista.joinDate 
                              ? calculateServiceDuration(barista.joinDate).text 
                              : 'Belum diatur'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-amber-50/80 border border-amber-200/80 p-2 rounded-xl">
                            <span className="text-[9.5px] font-extrabold uppercase text-amber-800 tracking-wider block">Gaji Pokok</span>
                            <span className="text-xs font-black font-mono text-slate-900">
                              {barista.monthlySalary ? `Rp ${barista.monthlySalary.toLocaleString('id-ID')}` : 'Rp 0'}
                            </span>
                          </div>
                          <div className="bg-emerald-50/80 border border-emerald-200/80 p-2 rounded-xl">
                            <span className="text-[9.5px] font-extrabold uppercase text-emerald-800 tracking-wider block">Uang Hadir / Shift</span>
                            <span className="text-xs font-black font-mono text-slate-900">
                              {barista.dailySalary ? `Rp ${barista.dailySalary.toLocaleString('id-ID')}` : 'Rp 0'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {barista.notes && (
                        <p className="text-[11px] text-slate-500 font-medium bg-slate-50 p-2 rounded-xl border border-slate-150">
                          {barista.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bottom Stats & Quick Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Jam Minggu Ini</span>
                      <span className="font-mono font-black text-slate-900">{stats.totalHours} Jam</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenPayslipModal(barista)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black transition flex items-center space-x-1 cursor-pointer shadow-xs"
                        title="Lihat Slip Gaji Barista"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>Slip</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleBaristaActive(barista.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                          barista.isActive 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {barista.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MASTER SHIFT SETTINGS VIEW */}
      {/* ========================================================= */}
      {viewMode === 'shifts' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Master Jam Shift Bar Cafe</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Pengaturan jam masuk, jam pulang, dan durasi kerja yang muncul pada pilihan dropdown shift
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsShiftMasterModalOpen(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Edit3 className="h-4 w-4" />
              <span>Kelola & Edit Shift</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((shift) => {
              const theme = COLOR_THEMES[shift.color] || COLOR_THEMES.emerald;
              return (
                <div
                  key={shift.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${theme.badge}`}>
                        {shift.shortCode}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {shift.durationHours} Jam Kerja
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">{shift.name}</h4>
                    <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                      {shift.isOff ? 'Libur / Day Off' : `${shift.startTime} s/d ${shift.endTime}`}
                    </p>
                    {shift.description && (
                      <p className="text-[11px] text-slate-500 mt-2 font-medium">
                        {shift.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. KALKULATOR & SLIP GAJI VIEW (INTEGRASI JADWAL HARIAN)  */}
      {/* ========================================================= */}
      {viewMode === 'payroll' && (() => {
        // Calculate payroll for all active or filtered baristas
        const payrollItems = baristas.map(barista => {
          const key = `${barista.id}_${payrollMonth}`;
          const adj = payrollAdjustments[key];
          return calculateBaristaPayroll(barista, schedules, payrollMonth, adj, roleStandards, shifts);
        });

        const activePayrollItems = payrollItems.filter(p => {
          const barista = baristas.find(b => b.id === p.baristaId);
          if (!barista?.isActive) return false;
          if (roleFilter !== 'all' && p.role !== roleFilter) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return p.baristaName.toLowerCase().includes(q) || (p.baristaNickname || '').toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
          }
          return true;
        });

        // Aggregates
        const totalNetPayroll = activePayrollItems.reduce((sum, item) => sum + item.netSalary, 0);
        const totalDaysAll = activePayrollItems.reduce((sum, item) => sum + item.totalDaysPresent, 0);
        const totalHoursAll = activePayrollItems.reduce((sum, item) => sum + item.totalHoursWorked, 0);
        const avgTenureMonths = activePayrollItems.length > 0 
          ? Math.round(activePayrollItems.reduce((sum, item) => sum + (item.yearsOfService * 12 + item.monthsOfService), 0) / activePayrollItems.length) 
          : 0;
        const avgTenureY = Math.floor(avgTenureMonths / 12);
        const avgTenureM = avgTenureMonths % 12;

        // Current period label
        const [yearStr, monthStr] = payrollMonth.split('-');
        const monthNum = parseInt(monthStr, 10);
        const periodTitle = `${INDONESIAN_MONTH_NAMES[monthNum - 1]} ${yearStr}`;

        // Change month helpers
        const handlePrevMonth = () => {
          const d = new Date(parseInt(yearStr, 10), monthNum - 2, 1);
          setPayrollMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        };

        const handleNextMonth = () => {
          const d = new Date(parseInt(yearStr, 10), monthNum, 1);
          setPayrollMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        };

        const handleDownloadAllPayslips = async () => {
          if (activePayrollItems.length === 0) {
            alert('Tidak ada data slip gaji untuk diunduh.');
            return;
          }
          if (confirm(`Unduh ${activePayrollItems.length} gambar slip gaji untuk periode ${periodTitle}?`)) {
            for (const item of activePayrollItems) {
              try {
                const dataUrl = await generatePayslipImage(item);
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `Slip_Gaji_${item.baristaName.replace(/\s+/g, '_')}_${item.periodMonth}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                // slight delay for browser download queue
                await new Promise(r => setTimeout(r, 400));
              } catch (e) {
                console.error(e);
              }
            }
            showToast(`Berhasil mengunduh ${activePayrollItems.length} slip gaji.`);
          }
        };

        return (
          <div className="space-y-5 animate-fade-in">
            
            {/* Top Period Selector & Action Tools */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3 w-full md:w-auto">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Penggajian & Slip Gaji Tim Basco Coffee
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Otomatisasi kalkulasi gaji berdasarkan jadwal harian, masa kerja pertahun, jabatan & tarif shift
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                
                {/* Month Navigator */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    title="Bulan Sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="px-3 text-xs font-black text-slate-900 flex items-center space-x-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-600" />
                    <span>{periodTitle}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    title="Bulan Berikutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Master Role Salary Settings Button */}
                <button
                  type="button"
                  onClick={() => setIsRoleSalaryModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
                  <span>Standar Gaji Jabatan</span>
                </button>

                {/* Download All Slips Button */}
                <button
                  type="button"
                  onClick={handleDownloadAllPayslips}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Semua Slip</span>
                </button>

              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Total Penggajian Periode</p>
                  <p className="text-xl font-black text-amber-600 mt-0.5 font-mono">
                    Rp {totalNetPayroll.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{activePayrollItems.length} Karyawan Aktif</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Total Shift Masuk Tim</p>
                  <p className="text-xl font-black text-emerald-600 mt-0.5 font-mono">
                    {totalDaysAll} <span className="text-xs font-bold text-slate-400">Shift</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{totalHoursAll} Total Jam Operasional</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Rata-rata Masa Kerja</p>
                  <p className="text-xl font-black text-sky-600 mt-0.5 font-mono">
                    {avgTenureY} Thn {avgTenureM} Bln
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Kenaikan Gaji per Tahun Otomatis</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Award className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Export Slip Gaji</p>
                  <p className="text-xl font-black text-violet-600 mt-0.5">
                    Gambar PNG HD
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Siap bagikan langsung ke WhatsApp</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                  <Share2 className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Payroll Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Daftar Rincian Gaji ({activePayrollItems.length} Barista)
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    • Periode {periodTitle}
                  </span>
                </div>
                
                {/* Search in Payroll */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari barista atau role..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Karyawan / Barista</th>
                      <th className="py-3 px-3">Jabatan & Masa Kerja</th>
                      <th className="py-3 px-3 text-center">Rekap Shift Masuk</th>
                      <th className="py-3 px-3 text-right">Gaji Pokok</th>
                      <th className="py-3 px-3 text-right">Tunj. Jabatan</th>
                      <th className="py-3 px-3 text-right">Kenaikan Thn</th>
                      <th className="py-3 px-3 text-right">Uang Hadir</th>
                      <th className="py-3 px-3 text-right">Lembur & Bonus</th>
                      <th className="py-3 px-3 text-right">Potongan</th>
                      <th className="py-3 px-4 text-right">Gaji Bersih (THP)</th>
                      <th className="py-3 px-4 text-center">Aksi & Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activePayrollItems.map((item) => {
                      const barista = baristas.find(b => b.id === item.baristaId);
                      if (!barista) return null;

                      return (
                        <tr key={item.baristaId} className="hover:bg-amber-50/30 transition">
                          
                          {/* Barista Name & Avatar */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                                {barista.avatarUrl ? (
                                  <img 
                                    src={barista.avatarUrl} 
                                    alt={barista.name} 
                                    className="w-full h-full rounded-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  barista.nickname?.charAt(0) || barista.name.charAt(0)
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{item.baristaName}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  ID: {barista.id} {item.baristaNickname ? `• ${item.baristaNickname}` : ''}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role & Service Duration */}
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10.5px]">
                              {item.role}
                            </span>
                            <div className="mt-1 flex items-center space-x-1 text-[10px] text-amber-800 font-semibold">
                              <Award className="h-3 w-3 text-amber-600 shrink-0" />
                              <span>{item.serviceDurationText}</span>
                            </div>
                          </td>

                          {/* Shift Attendance */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-emerald-700 block font-mono">
                              {item.totalDaysPresent} Hari Masuk
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {item.totalHoursWorked} Jam {item.totalOvertimeHours > 0 ? `(+${item.totalOvertimeHours}j lembur)` : ''}
                            </span>
                          </td>

                          {/* Gaji Pokok */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                            Rp {item.baseSalary.toLocaleString('id-ID')}
                          </td>

                          {/* Tunjangan Jabatan */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-slate-600">
                            Rp {item.positionAllowance.toLocaleString('id-ID')}
                          </td>

                          {/* Kenaikan Masa Kerja */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-amber-700">
                            +{item.annualIncreaseAmount.toLocaleString('id-ID')}
                          </td>

                          {/* Uang Hadir */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-slate-600">
                            Rp {item.attendanceAllowance.toLocaleString('id-ID')}
                          </td>

                          {/* Lembur & Bonus */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-emerald-700">
                            +{(item.overtimePay + item.bonus).toLocaleString('id-ID')}
                          </td>

                          {/* Potongan */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-rose-600">
                            {item.deductions > 0 ? `-${item.deductions.toLocaleString('id-ID')}` : 'Rp 0'}
                          </td>

                          {/* Take Home Pay (Gaji Bersih) */}
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-black text-slate-900 text-sm block">
                              Rp {item.netSalary.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9.5px] text-emerald-600 font-bold uppercase tracking-wider">
                              Siap Ditransfer
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenPayslipModal(barista)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs transition flex items-center space-x-1 cursor-pointer shadow-xs"
                                title="Lihat Slip & Download Gambar"
                              >
                                <Receipt className="h-3.5 w-3.5" />
                                <span>Slip Gaji</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBarista(barista);
                                  setIsBaristaModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                                title="Edit Barista & Komponen Gaji"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {activePayrollItems.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold">Tidak ada data barista pada filter ini.</p>
                </div>
              )}

            </div>

          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* MODALS & POPOVERS */}
      {/* ========================================================= */}

      {/* 1. Barista Form Modal */}
      <BaristaFormModal
        isOpen={isBaristaModalOpen}
        onClose={() => setIsBaristaModalOpen(false)}
        onSave={handleSaveBarista}
        editingBarista={editingBarista}
      />

      {/* 2. Shift Master Modal */}
      <ShiftMasterModal
        isOpen={isShiftMasterModalOpen}
        onClose={() => setIsShiftMasterModalOpen(false)}
        shifts={shifts}
        onSaveShifts={handleSaveShifts}
      />

      {/* 3. Cell Shift Selector Popover */}
      {activeCellTarget && (
        <ShiftSelectorPopover
          isOpen={Boolean(activeCellTarget)}
          onClose={() => setActiveCellTarget(null)}
          baristaName={activeCellTarget.baristaName}
          dateStr={activeCellTarget.dateLabel}
          currentEntry={activeCellTarget.currentEntry}
          shifts={shifts}
          onSelectShift={(shiftId, status, customStart, customEnd, notes) => {
            handleAssignShift(
              activeCellTarget.baristaId,
              activeCellTarget.dateKey,
              shiftId,
              status,
              customStart,
              customEnd,
              notes
            );
            showToast('Jadwal barista berhasil disimpan.');
          }}
          onDeleteEntry={() => {
            handleDeleteScheduleEntry(activeCellTarget.baristaId, activeCellTarget.dateKey);
            showToast('Jadwal telah dihapus.');
          }}
          onOpenShiftMaster={() => setIsShiftMasterModalOpen(true)}
        />
      )}

      {/* 4. Full Application Backup & Restore JSON Modal */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        transactions={transactions}
        categories={categories}
        onRestoreSuccess={() => {
          showToast('Data aplikasi berhasil dipulihkan!');
        }}
      />

      {/* 5. Payslip Modal (Gambar PNG & WhatsApp) */}
      <PayslipModal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
        payslip={selectedPayslip}
        onUpdateAdjustment={handleUpdateSalaryAdjustment}
      />

      {/* 6. Role Salary Master Settings Modal */}
      <RoleSalarySettingsModal
        isOpen={isRoleSalaryModalOpen}
        onClose={() => setIsRoleSalaryModalOpen(false)}
        roleStandards={roleStandards}
        onSaveStandards={handleSaveRoleStandards}
      />

    </div>
  );
}
