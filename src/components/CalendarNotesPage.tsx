import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  CalendarNoteActivity, 
  ActivityCategory, 
  ActivityPriority,
  NotificationH1Alert 
} from '../types/calendarNotes';
import { 
  CALENDAR_NOTES_STORAGE_KEY, 
  DEFAULT_CALENDAR_ACTIVITIES, 
  computeH1Alerts 
} from '../utils/calendarNotesData';
import { 
  fetchCalendarNotesFromSheet, 
  saveCalendarNotesToSheet 
} from '../sheetsService';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Bell,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  Tag,
  MapPin,
  User as UserIcon,
  DollarSign,
  Info,
  CalendarDays,
  ListTodo,
  Check,
  X,
  Sparkles,
  FileText,
  Flame,
  Volume2,
  VolumeX,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Cloud,
  FileSpreadsheet,
  Smartphone,
  Monitor,
  CheckCheck
} from 'lucide-react';

export const CATEGORY_COLORS: Record<ActivityCategory, { bg: string; text: string; border: string; badge: string; dot: string }> = {
  'Operasional': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  'Maintenance & Alat': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
  'Restock / Belanja': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-900', dot: 'bg-emerald-500' },
  'Event & Acara Cafe': { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-900', dot: 'bg-purple-500' },
  'Promo & Marketing': { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-900', dot: 'bg-pink-500' },
  'Pembayaran & Tagihan': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-900', dot: 'bg-rose-500' },
  'Kebersihan & Sanitasi': { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-900', dot: 'bg-teal-500' },
  'Rapat & Evaluasi': { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-900', dot: 'bg-indigo-500' },
  'Lain-lain': { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-900', dot: 'bg-slate-500' },
};

export const PRIORITY_CONFIG: Record<ActivityPriority, { label: string; badge: string; border: string }> = {
  'rendah': { label: 'Rendah', badge: 'bg-slate-100 text-slate-700 border-slate-200', border: 'border-slate-200' },
  'sedang': { label: 'Sedang', badge: 'bg-sky-100 text-sky-800 border-sky-300', border: 'border-sky-300' },
  'tinggi': { label: 'Tinggi', badge: 'bg-amber-100 text-amber-800 border-amber-300', border: 'border-amber-300' },
  'urgent': { label: 'Mendesak / Urgent', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse', border: 'border-rose-400' },
};

const CATEGORIES_LIST: ActivityCategory[] = [
  'Operasional',
  'Maintenance & Alat',
  'Restock / Belanja',
  'Event & Acara Cafe',
  'Promo & Marketing',
  'Pembayaran & Tagihan',
  'Kebersihan & Sanitasi',
  'Rapat & Evaluasi',
  'Lain-lain'
];

interface CalendarNotesPageProps {
  spreadsheetId?: string | null;
  spreadsheetName?: string | null;
  spreadsheetUrl?: string | null;
  token?: string | null;
  isManagerMode?: boolean;
  onUpdateActivitiesCount?: (count: number, h1Count: number) => void;
}

export default function CalendarNotesPage({
  spreadsheetId,
  spreadsheetName,
  spreadsheetUrl,
  token,
  isManagerMode,
  onUpdateActivitiesCount
}: CalendarNotesPageProps) {
  // Load activities from localStorage or default
  const [activities, setActivities] = useState<CalendarNoteActivity[]>(() => {
    try {
      const saved = localStorage.getItem(CALENDAR_NOTES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading calendar activities', e);
    }
    return DEFAULT_CALENDAR_ACTIVITIES;
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_NOTES_STORAGE_KEY, JSON.stringify(activities));
    } catch (e) {
      console.error('Error saving calendar activities', e);
    }
  }, [activities]);

  // Realtime Cloud Sync & Multi-Device Persistence State
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const syncTimeoutRef = useRef<any>(null);
  const isInitialMountDoneRef = useRef(false);

  const showSyncToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setSyncFeedback({ message, type });
    setTimeout(() => {
      setSyncFeedback(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // Debounced auto-save to Google Sheets
  const triggerCloudSync = useCallback((currentActivities = activities) => {
    if (!spreadsheetId || !token || !isInitialMountDoneRef.current) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      setIsSyncingCloud(true);
      try {
        await saveCalendarNotesToSheet(spreadsheetId, currentActivities, token);
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeStr);
      } catch (err: any) {
        console.warn('Could not auto-sync calendar notes to sheet:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    }, 1200);
  }, [spreadsheetId, token, activities]);

  // Load from Google Sheets
  const loadCalendarNotesFromCloud = useCallback(async (isManual = false) => {
    if (!spreadsheetId || !token) {
      if (isManual) {
        showSyncToast('Spreadsheet Google Sheets belum terhubung. Silakan login akun Google terlebih dahulu.', 'info');
      }
      return;
    }

    setIsLoadingCloud(true);
    try {
      const remoteData = await fetchCalendarNotesFromSheet(spreadsheetId, token);
      if (remoteData && remoteData.length > 0) {
        setActivities(remoteData);
        localStorage.setItem(CALENDAR_NOTES_STORAGE_KEY, JSON.stringify(remoteData));
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeStr);
        if (isManual) {
          showSyncToast(`✅ Berhasil memuat ${remoteData.length} data agenda kalender dari Google Sheets!`, 'success');
        }
      } else if (isManual) {
        showSyncToast('ℹ️ Terhubung ke Google Sheets. Belum ada catatan agenda yang tersimpan di spreadsheet.', 'info');
      }
    } catch (err: any) {
      console.warn('Could not load calendar notes from cloud:', err);
      if (isManual) {
        showSyncToast('❌ Gagal memuat data dari Google Sheets. Pastikan akun Google memiliki izin akses.', 'error');
      }
    } finally {
      setIsLoadingCloud(false);
      isInitialMountDoneRef.current = true;
    }
  }, [spreadsheetId, token]);

  // Force Save to Google Sheets
  const handleForceSaveToCloud = async () => {
    if (!spreadsheetId || !token) {
      showSyncToast('Spreadsheet Google Sheets belum terhubung.', 'info');
      return;
    }
    setIsSyncingCloud(true);
    try {
      await saveCalendarNotesToSheet(spreadsheetId, activities, token);
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(timeStr);
      showSyncToast(`✅ ${activities.length} catatan & agenda kalender berhasil disimpan ke tab Google Sheets!`, 'success');
    } catch (err: any) {
      console.error('Gagal menyimpan ke Google Sheets:', err);
      showSyncToast('❌ Gagal menyimpan ke Google Sheets. Silakan periksa koneksi internet.', 'error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Mount effect to fetch from cloud
  useEffect(() => {
    if (spreadsheetId && token) {
      loadCalendarNotesFromCloud(false);
    } else {
      isInitialMountDoneRef.current = true;
    }
  }, [spreadsheetId, token]);

  // Current Calendar Month State (Year & Month)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  
  // View Mode: 'calendar' | 'list'
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Filter and Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [filterCompletion, setFilterCompletion] = useState<'ALL' | 'pending' | 'completed'>('ALL');
  const [filterOnlyH1, setFilterOnlyH1] = useState(false);

  // Selected date cell in calendar
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Modal Form State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<CalendarNoteActivity | null>(null);

  // Form fields
  const [formJudul, setFormJudul] = useState('');
  const [formTanggal, setFormTanggal] = useState('');
  const [formWaktuMulai, setFormWaktuMulai] = useState('');
  const [formWaktuSelesai, setFormWaktuSelesai] = useState('');
  const [formKategori, setFormKategori] = useState<ActivityCategory>('Operasional');
  const [formPrioritas, setFormPrioritas] = useState<ActivityPriority>('sedang');
  const [formPenanggungJawab, setFormPenanggungJawab] = useState('');
  const [formLokasi, setFormLokasi] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formNominalEstimasi, setFormNominalEstimasi] = useState('');
  const [formIngatkanH1, setFormIngatkanH1] = useState(true);
  const [formIngatkanHariH, setFormIngatkanHariH] = useState(true);

  // Notification Banner Dismissal in current session
  const [isAlertBannerOpen, setIsAlertBannerOpen] = useState(true);

  // Browser notification permission state
  const [browserNotificationStatus, setBrowserNotificationStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const requestBrowserNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setBrowserNotificationStatus(permission);
      if (permission === 'granted') {
        new Notification('Basco Cafe - Notifikasi Kegiatan Aktif', {
          body: 'Notifikasi H-1 untuk jadwal & kegiatan cafe Anda telah diaktifkan.',
          icon: '/favicon.ico'
        });
      }
    }
  };

  // Compute H-1 and today alerts
  const h1Alerts = useMemo(() => {
    return computeH1Alerts(activities);
  }, [activities]);

  const h1CountOnly = useMemo(() => {
    return h1Alerts.filter(a => a.type === 'h-1').length;
  }, [h1Alerts]);

  // Notify parent component if callback provided
  useEffect(() => {
    if (onUpdateActivitiesCount) {
      onUpdateActivitiesCount(activities.length, h1Alerts.length);
    }
  }, [activities.length, h1Alerts.length, onUpdateActivitiesCount]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedCalendarDate(today.toISOString().split('T')[0]);
  };

  // Generate calendar days grid (Monday first or Sunday first)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    // We can use Monday as start of week: (firstDayIndex + 6) % 7
    const adjustedFirstDay = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: {
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // Today string
    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month filler days
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateString = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateString,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateString === todayStr
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateString,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateString === todayStr
      });
    }

    // Next month filler days to complete grid (42 cells = 6 weeks or 35 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const dateString = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      days.push({
        dateString,
        dayNumber: n,
        isCurrentMonth: false,
        isToday: dateString === todayStr
      });
    }

    return days;
  }, [year, month]);

  // Group activities by date
  const activitiesByDate = useMemo(() => {
    const map: Record<string, CalendarNoteActivity[]> = {};
    activities.forEach(act => {
      if (!map[act.tanggal]) {
        map[act.tanggal] = [];
      }
      map[act.tanggal].push(act);
    });
    return map;
  }, [activities]);

  // Filtered activities for list view and date inspections
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = act.judul.toLowerCase().includes(q);
        const matchDesc = act.deskripsi?.toLowerCase().includes(q);
        const matchPic = act.penanggungJawab?.toLowerCase().includes(q);
        const matchLoc = act.lokasi?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchPic && !matchLoc) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && act.kategori !== selectedCategory) {
        return false;
      }

      // Priority filter
      if (selectedPriority !== 'ALL' && act.prioritas !== selectedPriority) {
        return false;
      }

      // Completion filter
      if (filterCompletion === 'pending' && act.isCompleted) return false;
      if (filterCompletion === 'completed' && !act.isCompleted) return false;

      // Only H-1 filter
      if (filterOnlyH1) {
        const isH1 = h1Alerts.some(alert => alert.activity.id === act.id && alert.type === 'h-1');
        if (!isH1) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by date ascending, then time
      const dateCmp = a.tanggal.localeCompare(b.tanggal);
      if (dateCmp !== 0) return dateCmp;
      return (a.waktuMulai || '').localeCompare(b.waktuMulai || '');
    });
  }, [activities, searchQuery, selectedCategory, selectedPriority, filterCompletion, filterOnlyH1, h1Alerts]);

  // Activities for currently selected calendar date
  const activitiesForSelectedDate = useMemo(() => {
    return activitiesByDate[selectedCalendarDate] || [];
  }, [activitiesByDate, selectedCalendarDate]);

  // Handlers for activity CRUD
  const handleOpenAddModal = (defaultDate?: string) => {
    setEditingActivity(null);
    setFormJudul('');
    setFormTanggal(defaultDate || selectedCalendarDate || new Date().toISOString().split('T')[0]);
    setFormWaktuMulai('09:00');
    setFormWaktuSelesai('11:00');
    setFormKategori('Operasional');
    setFormPrioritas('sedang');
    setFormPenanggungJawab('');
    setFormLokasi('');
    setFormDeskripsi('');
    setFormNominalEstimasi('');
    setFormIngatkanH1(true);
    setFormIngatkanHariH(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (act: CalendarNoteActivity) => {
    setEditingActivity(act);
    setFormJudul(act.judul);
    setFormTanggal(act.tanggal);
    setFormWaktuMulai(act.waktuMulai || '');
    setFormWaktuSelesai(act.waktuSelesai || '');
    setFormKategori(act.kategori);
    setFormPrioritas(act.prioritas);
    setFormPenanggungJawab(act.penanggungJawab || '');
    setFormLokasi(act.lokasi || '');
    setFormDeskripsi(act.deskripsi || '');
    setFormNominalEstimasi(act.nominalEstimasi ? String(act.nominalEstimasi) : '');
    setFormIngatkanH1(act.ingatkanH1);
    setFormIngatkanHariH(act.ingatkanHariH ?? true);
    setIsModalOpen(true);
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formJudul.trim() || !formTanggal) {
      alert('Mohon lengkapi judul kegiatan dan tanggal catatan.');
      return;
    }

    const nominal = formNominalEstimasi ? Number(formNominalEstimasi.replace(/\D/g, '')) : 0;

    if (editingActivity) {
      // Update
      const updated = activities.map(a => {
        if (a.id === editingActivity.id) {
          return {
            ...a,
            judul: formJudul.trim(),
            tanggal: formTanggal,
            waktuMulai: formWaktuMulai || undefined,
            waktuSelesai: formWaktuSelesai || undefined,
            kategori: formKategori,
            prioritas: formPrioritas,
            penanggungJawab: formPenanggungJawab.trim() || undefined,
            lokasi: formLokasi.trim() || undefined,
            deskripsi: formDeskripsi.trim() || undefined,
            nominalEstimasi: nominal,
            ingatkanH1: formIngatkanH1,
            ingatkanHariH: formIngatkanHariH,
            updatedAt: new Date().toISOString()
          };
        }
        return a;
      });
      setActivities(updated);
      triggerCloudSync(updated);
    } else {
      // Create new
      const newAct: CalendarNoteActivity = {
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        judul: formJudul.trim(),
        tanggal: formTanggal,
        waktuMulai: formWaktuMulai || undefined,
        waktuSelesai: formWaktuSelesai || undefined,
        kategori: formKategori,
        prioritas: formPrioritas,
        penanggungJawab: formPenanggungJawab.trim() || undefined,
        lokasi: formLokasi.trim() || undefined,
        deskripsi: formDeskripsi.trim() || undefined,
        nominalEstimasi: nominal,
        ingatkanH1: formIngatkanH1,
        ingatkanHariH: formIngatkanHariH,
        isCompleted: false,
        createdAt: new Date().toISOString()
      };
      const updated = [newAct, ...activities];
      setActivities(updated);
      triggerCloudSync(updated);
    }

    setIsModalOpen(false);
  };

  const handleToggleComplete = (id: string) => {
    const updated = activities.map(a => {
      if (a.id === id) {
        const nextState = !a.isCompleted;
        return {
          ...a,
          isCompleted: nextState,
          completedAt: nextState ? new Date().toISOString() : undefined
        };
      }
      return a;
    });
    setActivities(updated);
    triggerCloudSync(updated);
  };

  const handleDeleteActivity = (id: string) => {
    if (window.confirm('Hapus catatan kegiatan ini?')) {
      const updated = activities.filter(a => a.id !== id);
      setActivities(updated);
      triggerCloudSync(updated);
    }
  };

  // Helper format rupiah
  const formatRupiah = (num: number) => {
    return `Rp${num.toLocaleString('id-ID')}`;
  };

  // Format date helper (ID)
  const formatDateID = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* ============================================================ */}
      {/* 1. TOP HEADER & METRIC SUMMARY */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-md shadow-amber-500/20">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <span>Catatan & Agenda Kalender</span>
                  {h1Alerts.length > 0 && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                      <BellRing className="h-3 w-3" />
                      <span>{h1Alerts.length} Perhatian H-1 / Hari H</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Jadwal kegiatan, agenda cafe, audit, dan pengingat H-1 otomatis
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Browser notification activation */}
            {browserNotificationStatus !== 'granted' && typeof window !== 'undefined' && 'Notification' in window && (
              <button
                type="button"
                onClick={requestBrowserNotification}
                className="flex items-center space-x-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Aktifkan Notifikasi Popup Browser untuk H-1"
              >
                <Bell className="h-3.5 w-3.5 text-amber-700" />
                <span>Aktifkan Notifikasi Browser</span>
              </button>
            )}

            {/* View Mode Switcher */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'calendar'
                    ? 'bg-white text-slate-950 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Kalender</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-950 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <ListTodo className="h-3.5 w-3.5" />
                <span>Daftar Agenda</span>
              </button>
            </div>

            {/* Add New Activity Button */}
            <button
              type="button"
              onClick={() => handleOpenAddModal(selectedCalendarDate)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Tambah Catatan</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Total Catatan</span>
            <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">{activities.length} Kegiatan</span>
          </div>

          <div 
            onClick={() => { setFilterOnlyH1(prev => !prev); }}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              filterOnlyH1 
                ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-400/40' 
                : 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wider block">Notifikasi H-1 (Besok)</span>
              {filterOnlyH1 && <span className="text-[9px] font-bold bg-amber-600 text-white px-1.5 py-0.2 rounded">Aktif</span>}
            </div>
            <span className="text-xl font-black text-amber-950 font-mono mt-0.5 flex items-center space-x-1.5">
              <BellRing className="h-4 w-4 text-amber-600 animate-bounce" />
              <span>{h1CountOnly} Kegiatan</span>
            </span>
          </div>

          <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl">
            <span className="text-[10.5px] font-bold text-sky-800 uppercase tracking-wider block">Hari Ini (D-Day)</span>
            <span className="text-xl font-black text-sky-950 font-mono mt-0.5 block">
              {h1Alerts.filter(a => a.type === 'hari-h').length} Kegiatan
            </span>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
            <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider block">Selesai / Terlaksana</span>
            <span className="text-xl font-black text-emerald-950 font-mono mt-0.5 block">
              {activities.filter(a => a.isCompleted).length} / {activities.length}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SPREADSHEET REALTIME SYNC & MULTI-DEVICE CLOUD STATUS BAR */}
      {/* ============================================================ */}
      <div className="bg-linear-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Left: Device & Cloud info */}
          <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>Sinkronisasi Google Spreadsheet Real-Time</span>
                </span>
                {spreadsheetId && token ? (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Terhubung • Tab: Catatan &amp; Agenda Kalender</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <span>Mode Lokal (Tersimpan di Browser)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="inline-flex items-center space-x-1 text-emerald-900 font-bold">
                  <Smartphone className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <span>Mobile (HP)</span>
                </span>
                <span>&amp;</span>
                <span className="inline-flex items-center space-x-1 text-emerald-900 font-bold">
                  <Monitor className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <span>Komputer (PC)</span>
                </span>
                <span className="text-slate-500">
                  — Setiap catatan yang Anda tambah atau ubah tersinkronisasi otomatis ke Google Sheets sehingga bisa diakses di mana saja.
                </span>
                {lastSyncTime && (
                  <span className="text-slate-700 font-bold bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200/60 font-mono text-[11px]">
                    Sinkron terakhir: {lastSyncTime}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Cloud Sync Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {spreadsheetId && token ? (
              <>
                {/* Pull / Refresh from Sheet */}
                <button
                  type="button"
                  onClick={() => loadCalendarNotesFromCloud(true)}
                  disabled={isLoadingCloud || isSyncingCloud}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-slate-800 border border-emerald-300 hover:border-emerald-400 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                  title="Ambil data agenda terbaru dari Google Sheets"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-emerald-600 ${isLoadingCloud ? 'animate-spin' : ''}`} />
                  <span>{isLoadingCloud ? 'Memuat...' : 'Tarik dari Sheet'}</span>
                </button>

                {/* Force Push to Sheet */}
                <button
                  type="button"
                  onClick={handleForceSaveToCloud}
                  disabled={isLoadingCloud || isSyncingCloud}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50"
                  title="Simpan seluruh agenda kalender ke Google Sheets sekarang"
                >
                  <Cloud className={`h-3.5 w-3.5 ${isSyncingCloud ? 'animate-pulse' : ''}`} />
                  <span>{isSyncingCloud ? 'Menyimpan...' : 'Simpan ke Sheet'}</span>
                </button>

                {/* Open in Google Sheets */}
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-100/70 hover:bg-emerald-100 text-emerald-900 border border-emerald-300/80 rounded-xl text-xs font-bold transition cursor-pointer"
                    title="Buka file Google Sheets langsung di tab baru"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            ) : (
              <div className="text-xs text-amber-800 font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                Hubungkan Google Drive di menu atas untuk sinkronisasi cloud
              </div>
            )}
          </div>

        </div>

        {/* Sync Toast Feedback */}
        {syncFeedback && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition animate-in fade-in duration-200 ${
            syncFeedback.type === 'success' 
              ? 'bg-emerald-100/90 text-emerald-950 border border-emerald-300' 
              : syncFeedback.type === 'error'
              ? 'bg-rose-100/90 text-rose-950 border border-rose-300'
              : 'bg-sky-100/90 text-sky-950 border border-sky-300'
          }`}>
            <div className="flex items-center space-x-2">
              <CheckCheck className="h-4 w-4 shrink-0 text-emerald-700" />
              <span>{syncFeedback.message}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSyncFeedback(null)}
              className="text-slate-500 hover:text-slate-900 font-bold p-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. SPECIAL H-1 & D-DAY NOTIFICATION BANNER (PROMINENT ALERT) */}
      {/* ============================================================ */}
      {h1Alerts.length > 0 && isAlertBannerOpen && (
        <div className="bg-linear-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3 min-w-0">
              <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-md shrink-0 mt-0.5">
                <BellRing className="h-5 w-5 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Pengingat Kegiatan Segera (H-1 & Hari H)
                  </h3>
                  <span className="text-[11px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-300">
                    {h1Alerts.length} Agenda Perlu Diperhatikan
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Berikut kegiatan yang dijadwalkan besok atau hari ini. Siapkan bahan, alat, atau dana sebelum kegiatan dimulai.
                </p>

                {/* List of alert items */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {h1Alerts.map(alert => {
                    const act = alert.activity;
                    const catStyle = CATEGORY_COLORS[act.kategori] || CATEGORY_COLORS['Lain-lain'];
                    const isTomorrow = alert.type === 'h-1';
                    const isToday = alert.type === 'hari-h';

                    return (
                      <div 
                        key={act.id} 
                        className={`p-3 rounded-xl border bg-white shadow-2xs flex flex-col justify-between transition hover:shadow-md ${
                          isTomorrow ? 'border-amber-300 ring-1 ring-amber-300' : isToday ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              isTomorrow 
                                ? 'bg-amber-500 text-slate-950 font-black animate-pulse' 
                                : isToday 
                                ? 'bg-rose-500 text-white font-black' 
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {isTomorrow ? 'H-1 Besok!' : isToday ? 'Hari Ini (D-Day)' : 'Terlewat'}
                            </span>
                            <span className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded ${catStyle.badge}`}>
                              {act.kategori}
                            </span>
                          </div>

                          <h4 className="text-xs sm:text-sm font-black text-slate-900 line-clamp-1 mt-1">
                            {act.judul}
                          </h4>

                          <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-1">
                            <span className="flex items-center space-x-1">
                              <CalendarIcon className="h-3 w-3 text-slate-400" />
                              <span className="font-semibold">{alert.formattedDate}</span>
                            </span>
                            {act.waktuMulai && (
                              <span className="flex items-center space-x-1 text-slate-600 font-mono">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span>{act.waktuMulai}</span>
                              </span>
                            )}
                          </div>

                          {act.penanggungJawab && (
                            <div className="text-[10.5px] text-slate-600 mt-1 flex items-center space-x-1 truncate">
                              <UserIcon className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="font-medium truncate">PIC: {act.penanggungJawab}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleToggleComplete(act.id)}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center space-x-1 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Tandai Selesai</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(act)}
                            className="text-[11px] font-bold text-amber-800 hover:underline cursor-pointer"
                          >
                            Lihat Detail
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Dismiss banner */}
            <button
              type="button"
              onClick={() => setIsAlertBannerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              title="Tutup Pengingat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. TOOLBAR: SEARCH & FILTERS */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari catatan, judul kegiatan, PIC, lokasi, deskripsi..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Kategori:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Semua Kategori</option>
                {CATEGORIES_LIST.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Prioritas:</span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Semua Prioritas</option>
                <option value="urgent">Mendesak (Urgent)</option>
                <option value="tinggi">Tinggi</option>
                <option value="sedang">Sedang</option>
                <option value="rendah">Rendah</option>
              </select>
            </div>

            {/* Completion Filter */}
            <div className="flex items-center space-x-1.5">
              <select
                value={filterCompletion}
                onChange={(e) => setFilterCompletion(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="pending">Belum Selesai</option>
                <option value="completed">Sudah Selesai</option>
              </select>
            </div>

            {/* H-1 Toggle Button */}
            <button
              type="button"
              onClick={() => setFilterOnlyH1(prev => !prev)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                filterOnlyH1
                  ? 'bg-rose-500 text-white border-rose-600 font-black shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Hanya H-1</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. MAIN VIEW: CALENDAR VIEW OR LIST VIEW */}
      {/* ============================================================ */}
      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left / Center: Interactive Full Month Grid */}
          <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            
            {/* Month Header Navigation */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 capitalize">
                  {monthName}
                </h3>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  {year}
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={goToToday}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 rounded-lg hover:bg-amber-100 transition cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition cursor-pointer"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition cursor-pointer"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((dayName, idx) => (
                <div 
                  key={dayName} 
                  className={`text-[11px] font-black py-1 uppercase tracking-wider ${
                    idx >= 5 ? 'text-rose-500' : 'text-slate-500'
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {calendarDays.map((cell) => {
                const cellActivities = activitiesByDate[cell.dateString] || [];
                const isSelected = selectedCalendarDate === cell.dateString;

                // Check if any activity on this date has H-1 alert triggered
                const hasH1Alert = h1Alerts.some(a => a.activity.tanggal === cell.dateString && a.type === 'h-1');
                const hasTodayAlert = cell.isToday && cellActivities.length > 0;

                return (
                  <div
                    key={cell.dateString}
                    onClick={() => setSelectedCalendarDate(cell.dateString)}
                    onDoubleClick={() => handleOpenAddModal(cell.dateString)}
                    className={`min-h-[85px] sm:min-h-[105px] p-1.5 rounded-xl border transition flex flex-col justify-between cursor-pointer group relative ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/20'
                        : cell.isToday
                        ? 'bg-amber-50/40 border-amber-300/80 shadow-2xs'
                        : cell.isCurrentMonth
                        ? 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                        : 'bg-slate-50/60 border-slate-150 text-slate-400'
                    }`}
                  >
                    {/* Top Date Header in Cell */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold flex items-center justify-center w-5 h-5 rounded-full ${
                        cell.isToday
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : isSelected
                          ? 'bg-slate-900 text-white'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}>
                        {cell.dayNumber}
                      </span>

                      {/* Notification H-1 Badge in Cell */}
                      {hasH1Alert && (
                        <span className="flex h-2 w-2 relative" title="Kegiatan H-1 (Besok!)">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                        </span>
                      )}
                    </div>

                    {/* Activities pills inside cell */}
                    <div className="space-y-1 mt-1 overflow-hidden">
                      {cellActivities.slice(0, 2).map((act) => {
                        const catStyle = CATEGORY_COLORS[act.kategori] || CATEGORY_COLORS['Lain-lain'];
                        return (
                          <div
                            key={act.id}
                            className={`text-[9.5px] font-bold px-1 py-0.5 rounded truncate border ${catStyle.bg} ${catStyle.text} ${catStyle.border} ${
                              act.isCompleted ? 'opacity-50 line-through' : ''
                            }`}
                            title={`${act.waktuMulai ? `${act.waktuMulai} - ` : ''}${act.judul} (${act.kategori})`}
                          >
                            <span className="truncate">{act.judul}</span>
                          </div>
                        );
                      })}

                      {cellActivities.length > 2 && (
                        <div className="text-[9px] font-extrabold text-slate-500 pl-1">
                          +{cellActivities.length - 2} lainnya
                        </div>
                      )}
                    </div>

                    {/* Quick Add Button on Hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddModal(cell.dateString);
                        }}
                        className="p-1 bg-amber-500 text-slate-950 rounded-md hover:bg-amber-600 transition"
                        title="Tambah kegiatan pada tanggal ini"
                      >
                        <Plus className="h-2.5 w-2.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Hari Ini</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Ada Notifikasi H-1</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Operasional</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Restock</span>
                </span>
              </div>
              <span className="italic text-slate-400">
                Klik 2x tanggal untuk tambah catatan cepat
              </span>
            </div>
          </div>

          {/* Right: Selected Date Detail Panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    Agenda Terpilih
                  </span>
                  <h4 className="text-base font-black text-slate-900 mt-1">
                    {formatDateID(selectedCalendarDate)}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAddModal(selectedCalendarDate)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Tambah</span>
                </button>
              </div>

              {/* List of activities on selected date */}
              {activitiesForSelectedDate.length === 0 ? (
                <div className="py-10 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <CalendarDays className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">Tidak ada kegiatan pada tanggal ini.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Klik tombol Tambah untuk membuat catatan baru.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {activitiesForSelectedDate.map(act => {
                    const catStyle = CATEGORY_COLORS[act.kategori] || CATEGORY_COLORS['Lain-lain'];
                    const priorityConfig = PRIORITY_CONFIG[act.prioritas];

                    return (
                      <div
                        key={act.id}
                        className={`p-3 rounded-xl border transition ${
                          act.isCompleted
                            ? 'bg-slate-50/80 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start space-x-2">
                            <button
                              type="button"
                              onClick={() => handleToggleComplete(act.id)}
                              className="mt-0.5 text-slate-400 hover:text-emerald-600 cursor-pointer"
                              title={act.isCompleted ? "Tandai belum selesai" : "Tandai selesai"}
                            >
                              {act.isCompleted ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Circle className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <h5 className={`text-xs font-black text-slate-900 ${act.isCompleted ? 'line-through text-slate-500' : ''}`}>
                                {act.judul}
                              </h5>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded ${catStyle.badge}`}>
                                  {act.kategori}
                                </span>
                                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${priorityConfig.badge}`}>
                                  {priorityConfig.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(act)}
                              className="p-1 text-slate-400 hover:text-amber-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="Edit Catatan"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(act.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="Hapus Catatan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Additional Info: Time, PIC, Location, Budget */}
                        <div className="mt-2 text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2 rounded-lg">
                          {act.waktuMulai && (
                            <div className="flex items-center space-x-1.5 text-slate-700">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span className="font-mono font-medium">
                                {act.waktuMulai} {act.waktuSelesai ? `- ${act.waktuSelesai}` : 'WIB'}
                              </span>
                            </div>
                          )}

                          {act.penanggungJawab && (
                            <div className="flex items-center space-x-1.5 text-slate-700">
                              <UserIcon className="h-3 w-3 text-slate-400" />
                              <span>PIC: <strong className="font-semibold">{act.penanggungJawab}</strong></span>
                            </div>
                          )}

                          {act.lokasi && (
                            <div className="flex items-center space-x-1.5 text-slate-700">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span>{act.lokasi}</span>
                            </div>
                          )}

                          {act.nominalEstimasi && act.nominalEstimasi > 0 && (
                            <div className="flex items-center space-x-1.5 text-amber-900 font-mono font-bold">
                              <DollarSign className="h-3 w-3 text-amber-600" />
                              <span>Estimasi: {formatRupiah(act.nominalEstimasi)}</span>
                            </div>
                          )}

                          {act.deskripsi && (
                            <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/70 whitespace-pre-wrap">
                              {act.deskripsi}
                            </p>
                          )}
                        </div>

                        {/* H-1 status badge */}
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          {act.ingatkanH1 ? (
                            <span className="text-amber-800 font-bold flex items-center space-x-1">
                              <Bell className="h-3 w-3 text-amber-600" />
                              <span>Pengingat H-1 Aktif</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Pengingat H-1 Nonaktif</span>
                          )}
                          {act.isCompleted && (
                            <span className="text-emerald-700 font-bold">Sudah Selesai</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* ============================================================ */
        /* 5. LIST VIEW: COMPREHENSIVE AGENDA TABLE / CARDS */
        /* ============================================================ */
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-amber-600" />
              <span>Daftar Agenda & Catatan Terjadwal ({filteredActivities.length})</span>
            </h3>
            <span className="text-xs text-slate-500">
              Urutan berdasarkan tanggal terdekat
            </span>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <ListTodo className="h-9 w-9 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-600">Tidak ada catatan kegiatan yang sesuai dengan filter.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Ubah kata kunci pencarian atau tambah catatan baru.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((act) => {
                const catStyle = CATEGORY_COLORS[act.kategori] || CATEGORY_COLORS['Lain-lain'];
                const priorityConfig = PRIORITY_CONFIG[act.prioritas];
                const isH1 = h1Alerts.some(a => a.activity.id === act.id && a.type === 'h-1');
                const isToday = h1Alerts.some(a => a.activity.id === act.id && a.type === 'hari-h');

                return (
                  <div
                    key={act.id}
                    className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      act.isCompleted
                        ? 'bg-slate-50/60 border-slate-200 opacity-60'
                        : isH1
                        ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-300 shadow-2xs'
                        : isToday
                        ? 'bg-rose-50/30 border-rose-300 ring-1 ring-rose-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start space-x-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(act.id)}
                        className="mt-1 text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                        title={act.isCompleted ? "Tandai belum selesai" : "Tandai selesai"}
                      >
                        {act.isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {isH1 && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 animate-pulse">
                              H-1 Besok!
                            </span>
                          )}
                          {isToday && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-500 text-white">
                              Hari Ini (D-Day)
                            </span>
                          )}
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${catStyle.badge}`}>
                            {act.kategori}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityConfig.badge}`}>
                            {priorityConfig.label}
                          </span>
                          {act.ingatkanH1 && (
                            <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded flex items-center space-x-1">
                              <Bell className="h-2.5 w-2.5" />
                              <span>Pengingat H-1</span>
                            </span>
                          )}
                        </div>

                        <h4 className={`text-sm sm:text-base font-black text-slate-900 ${act.isCompleted ? 'line-through text-slate-500' : ''}`}>
                          {act.judul}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                          <span className="flex items-center space-x-1 font-semibold text-slate-700">
                            <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>{formatDateID(act.tanggal)}</span>
                          </span>

                          {act.waktuMulai && (
                            <span className="flex items-center space-x-1 font-mono text-slate-700">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>{act.waktuMulai} {act.waktuSelesai ? `- ${act.waktuSelesai}` : 'WIB'}</span>
                            </span>
                          )}

                          {act.penanggungJawab && (
                            <span className="flex items-center space-x-1 text-slate-700">
                              <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                              <span>PIC: <strong>{act.penanggungJawab}</strong></span>
                            </span>
                          )}

                          {act.lokasi && (
                            <span className="flex items-center space-x-1 text-slate-600">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>{act.lokasi}</span>
                            </span>
                          )}

                          {act.nominalEstimasi && act.nominalEstimasi > 0 && (
                            <span className="flex items-center space-x-1 text-amber-900 font-mono font-bold">
                              <DollarSign className="h-3.5 w-3.5 text-amber-600" />
                              <span>{formatRupiah(act.nominalEstimasi)}</span>
                            </span>
                          )}
                        </div>

                        {act.deskripsi && (
                          <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-150 whitespace-pre-wrap">
                            {act.deskripsi}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(act)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteActivity(act.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. MODAL FORM: TAMBAH / EDIT CATATAN & KEGIATAN */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-xl shadow-xs">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {editingActivity ? 'Edit Catatan Kegiatan' : 'Tambah Catatan Kegiatan Baru'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Lengkapi detail agenda, tanggal, jam, dan aktifkan notifikasi H-1
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4">
              
              {/* Judul Kegiatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Kegiatan / Catatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  placeholder="Contoh: Restock Biji Kopi, Servis Mesin Espresso, Rapat Tim..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Tanggal & Waktu */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Pelaksanaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={formWaktuMulai}
                    onChange={(e) => setFormWaktuMulai(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={formWaktuSelesai}
                    onChange={(e) => setFormWaktuSelesai(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Kategori & Prioritas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori Agenda
                  </label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value as ActivityCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    {CATEGORIES_LIST.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tingkat Prioritas
                  </label>
                  <select
                    value={formPrioritas}
                    onChange={(e) => setFormPrioritas(e.target.value as ActivityPriority)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="rendah">Rendah</option>
                    <option value="sedang">Sedang</option>
                    <option value="tinggi">Tinggi</option>
                    <option value="urgent">Mendesak / Urgent</option>
                  </select>
                </div>
              </div>

              {/* PIC, Lokasi, dan Estimasi Biaya */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Penanggung Jawab (PIC)
                  </label>
                  <input
                    type="text"
                    value={formPenanggungJawab}
                    onChange={(e) => setFormPenanggungJawab(e.target.value)}
                    placeholder="Nama Barista / Manager"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lokasi / Area
                  </label>
                  <input
                    type="text"
                    value={formLokasi}
                    onChange={(e) => setFormLokasi(e.target.value)}
                    placeholder="Bar, Dapur, Outdoor, Vendor..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estimasi Biaya (Rp)
                  </label>
                  <input
                    type="number"
                    value={formNominalEstimasi}
                    onChange={(e) => setFormNominalEstimasi(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Deskripsi & Catatan Lengkap */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Rincian / Instruksi
                </label>
                <textarea
                  rows={3}
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  placeholder="Instruksi kerja, SOP, barang yang perlu dibeli, atau catatan khusus..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* H-1 & D-Day Notification Toggles */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BellRing className="h-4 w-4 text-amber-700" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Ingatkan H-1 (H-1 Notifikasi Sebelum Kegiatan)
                      </span>
                      <span className="text-[10.5px] text-slate-500">
                        Munculkan banner perhatian dan badge merah di sidebar sehari sebelumnya
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIngatkanH1}
                      onChange={(e) => setFormIngatkanH1(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-200/50">
                  <div className="flex items-center space-x-2">
                    <CalendarDays className="h-4 w-4 text-slate-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Ingatkan Saat Hari H
                      </span>
                      <span className="text-[10.5px] text-slate-500">
                        Tetap tampilkan pengingat di hari pelaksanaan kegiatan
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIngatkanHariH}
                      onChange={(e) => setFormIngatkanHariH(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
                >
                  {editingActivity ? 'Simpan Perubahan' : 'Simpan Catatan'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
