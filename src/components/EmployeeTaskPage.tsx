import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock3, 
  PauseCircle, 
  RefreshCw, 
  ExternalLink, 
  Download, 
  FileSpreadsheet, 
  Edit3, 
  Trash2, 
  Filter, 
  Sparkles, 
  Check, 
  ChevronDown,
  UserCheck,
  ShieldCheck,
  Printer,
  X
} from 'lucide-react';
import { EmployeeTask, TaskStatus, TaskPriority, TaskShift } from '../types/employeeTask';
import { 
  getStoredEmployeeTasks, 
  saveStoredEmployeeTasks, 
  computeTaskMetrics, 
  formatRupiah,
  COMMON_TASK_SUGGESTIONS,
  COMMON_STAFF_SUGGESTIONS
} from '../utils/employeeTaskData';
import { 
  fetchEmployeeTasksFromSheet, 
  saveEmployeeTasksToSheet, 
  appendEmployeeTaskToSheet 
} from '../sheetsService';

interface EmployeeTaskPageProps {
  spreadsheetId: string | null;
  spreadsheetName?: string | null;
  spreadsheetUrl: string | null;
  token: string | null;
  isManagerMode?: boolean;
}

export default function EmployeeTaskPage({
  spreadsheetId,
  spreadsheetName,
  spreadsheetUrl,
  token,
  isManagerMode = false
}: EmployeeTaskPageProps) {
  // Tasks state
  const [tasks, setTasks] = useState<EmployeeTask[]>(() => getStoredEmployeeTasks());
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('basco_employee_tasks_last_sync') || null;
  });
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all'); // all, today, this_week, this_month, custom
  const [customDate, setCustomDate] = useState<string>('');

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);

  // Form field states
  const [formNama, setFormNama] = useState('');
  const [formGaji, setFormGaji] = useState<number | ''>('');
  const [formTugas, setFormTugas] = useState('');
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formShift, setFormShift] = useState<TaskShift>('Pagi');
  const [formStatus, setFormStatus] = useState<TaskStatus>('Belum Dikerjakan');
  const [formPrioritas, setFormPrioritas] = useState<TaskPriority>('Sedang');
  const [formPic, setFormPic] = useState('Manager Cafe');
  const [formCatatan, setFormCatatan] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [taskToDelete, setTaskToDelete] = useState<EmployeeTask | null>(null);

  // Save to localStorage whenever tasks change
  useEffect(() => {
    saveStoredEmployeeTasks(tasks);
  }, [tasks]);

  // Initial fetch from Google Sheets if connected
  useEffect(() => {
    if (spreadsheetId && token && !isManagerMode) {
      handleFetchFromSheet();
    }
  }, [spreadsheetId, token]);

  const handleFetchFromSheet = async () => {
    if (!spreadsheetId || !token) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const sheetTasks = await fetchEmployeeTasksFromSheet(spreadsheetId, token);
      if (sheetTasks && sheetTasks.length > 0) {
        setTasks(sheetTasks);
        saveStoredEmployeeTasks(sheetTasks);
        const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeNow);
        localStorage.setItem('basco_employee_tasks_last_sync', timeNow);
        setSyncMessage({ type: 'success', text: `Berhasil memuat ${sheetTasks.length} tugas dari Google Sheets` });
      } else if (sheetTasks !== null && sheetTasks.length === 0 && tasks.length > 0) {
        // Tab exists but empty, push user's existing local tasks to sheet
        await saveEmployeeTasksToSheet(spreadsheetId, tasks, token);
        const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeNow);
        localStorage.setItem('basco_employee_tasks_last_sync', timeNow);
        setSyncMessage({ type: 'success', text: 'Tugas lokal berhasil disinkronkan ke sheet Tugas Karyawan' });
      } else if (sheetTasks !== null && sheetTasks.length === 0) {
        setTasks([]);
        saveStoredEmployeeTasks([]);
      }
    } catch (err: any) {
      console.error('Fetch employee tasks error:', err);
      setSyncMessage({ type: 'error', text: 'Gagal mengambil data dari Google Sheets' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncToSheet = async () => {
    if (!spreadsheetId || !token) {
      setSyncMessage({ type: 'error', text: 'Spreadsheet belum terhubung. Silakan login akun Google terlebih dahulu.' });
      return;
    }
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await saveEmployeeTasksToSheet(spreadsheetId, tasks, token);
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(timeNow);
      localStorage.setItem('basco_employee_tasks_last_sync', timeNow);
      setSyncMessage({ type: 'success', text: `Sukses menyimpan ${tasks.length} tugas ke tab 'Tugas Karyawan' Google Sheets` });
    } catch (err: any) {
      console.error('Sync error:', err);
      setSyncMessage({ type: 'error', text: 'Gagal menyimpan ke Google Sheets' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Open modal for Create
  const handleOpenAddModal = () => {
    setEditingTask(null);
    setFormNama('');
    setFormGaji('');
    setFormTugas('');
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setFormShift('Pagi');
    setFormStatus('Belum Dikerjakan');
    setFormPrioritas('Sedang');
    setFormPic('Manager Cafe');
    setFormCatatan('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (task: EmployeeTask) => {
    setEditingTask(task);
    setFormNama(task.nama);
    setFormGaji(task.gaji);
    setFormTugas(task.tugas);
    setFormTanggal(task.tanggalPelaksanaan);
    setFormShift((task.shift as TaskShift) || 'Pagi');
    setFormStatus(task.status);
    setFormPrioritas(task.prioritas || 'Sedang');
    setFormPic(task.penanggungJawab || 'Manager Cafe');
    setFormCatatan(task.catatan || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit modal form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      setFormError('Nama Karyawan wajib diisi');
      return;
    }
    if (!formTugas.trim()) {
      setFormError('Deskripsi Tugas wajib diisi');
      return;
    }
    if (!formTanggal) {
      setFormError('Tanggal Pelaksanaan wajib diisi');
      return;
    }

    const gajiNum = typeof formGaji === 'number' ? formGaji : (parseFloat(formGaji) || 0);

    const nowIso = new Date().toISOString();

    if (editingTask) {
      // Update existing task
      const updated: EmployeeTask = {
        ...editingTask,
        nama: formNama.trim(),
        gaji: gajiNum,
        tugas: formTugas.trim(),
        tanggalPelaksanaan: formTanggal,
        shift: formShift,
        status: formStatus,
        prioritas: formPrioritas,
        penanggungJawab: formPic.trim() || 'Manager Cafe',
        catatan: formCatatan.trim(),
        updatedAt: nowIso
      };

      const newTaskList = tasks.map(t => t.id === editingTask.id ? updated : t);
      setTasks(newTaskList);
      setIsModalOpen(false);

      // Async sync to sheet if connected
      if (spreadsheetId && token && !isManagerMode) {
        saveEmployeeTasksToSheet(spreadsheetId, newTaskList, token).catch(err => {
          console.warn('Background sync error on edit:', err);
        });
      }
    } else {
      // Add new task
      const newTask: EmployeeTask = {
        id: `task-${Date.now()}`,
        nama: formNama.trim(),
        gaji: gajiNum,
        tugas: formTugas.trim(),
        tanggalPelaksanaan: formTanggal,
        shift: formShift,
        status: formStatus,
        prioritas: formPrioritas,
        penanggungJawab: formPic.trim() || 'Manager Cafe',
        catatan: formCatatan.trim(),
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const newTaskList = [newTask, ...tasks];
      setTasks(newTaskList);
      setIsModalOpen(false);

      // Async append or sync to sheet
      if (spreadsheetId && token && !isManagerMode) {
        appendEmployeeTaskToSheet(spreadsheetId, newTask, token).catch(() => {
          saveEmployeeTasksToSheet(spreadsheetId, newTaskList, token).catch(err => {
            console.warn('Background sync error on add:', err);
          });
        });
      }
    }
  };

  // Quick toggle task status
  const handleQuickStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus,
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    });

    setTasks(updated);

    if (spreadsheetId && token && !isManagerMode) {
      saveEmployeeTasksToSheet(spreadsheetId, updated, token).catch(err => {
        console.warn('Quick status sync error:', err);
      });
    }
  };

  // Confirm delete task
  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;
    const filtered = tasks.filter(t => t.id !== taskToDelete.id);
    setTasks(filtered);
    setTaskToDelete(null);

    if (spreadsheetId && token && !isManagerMode) {
      saveEmployeeTasksToSheet(spreadsheetId, filtered, token).catch(err => {
        console.warn('Delete sync error:', err);
      });
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["No", "Tanggal Pelaksanaan", "Nama Karyawan", "Tugas", "Shift", "Gaji (Rp)", "Status", "Prioritas", "PIC", "Catatan"];
    const rows = filteredTasks.map((t, index) => [
      String(index + 1),
      t.tanggalPelaksanaan,
      `"${t.nama.replace(/"/g, '""')}"`,
      `"${t.tugas.replace(/"/g, '""')}"`,
      t.shift || '-',
      String(t.gaji || 0),
      t.status,
      t.prioritas || 'Sedang',
      `"${(t.penanggungJawab || '-').replace(/"/g, '""')}"`,
      `"${(t.catatan || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `basco_tugas_karyawan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics computation
  const metrics = useMemo(() => computeTaskMetrics(tasks), [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    // Start of current week (Monday)
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (dayOfWeek - 1));
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Current Month prefix (YYYY-MM)
    const currentMonthPrefix = todayStr.substring(0, 7);

    return tasks.filter(t => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchNama = t.nama.toLowerCase().includes(query);
        const matchTugas = t.tugas.toLowerCase().includes(query);
        const matchCatatan = (t.catatan || '').toLowerCase().includes(query);
        const matchPic = (t.penanggungJawab || '').toLowerCase().includes(query);
        if (!matchNama && !matchTugas && !matchCatatan && !matchPic) return false;
      }

      // 2. Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }

      // 3. Shift filter
      if (shiftFilter !== 'all' && t.shift !== shiftFilter) {
        return false;
      }

      // 4. Date filter
      if (dateRangeFilter === 'today' && t.tanggalPelaksanaan !== todayStr) {
        return false;
      }
      if (dateRangeFilter === 'this_week' && (t.tanggalPelaksanaan < startOfWeekStr || t.tanggalPelaksanaan > todayStr)) {
        return false;
      }
      if (dateRangeFilter === 'this_month' && !t.tanggalPelaksanaan.startsWith(currentMonthPrefix)) {
        return false;
      }
      if (dateRangeFilter === 'custom' && customDate && t.tanggalPelaksanaan !== customDate) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort newest date first, then status (Belum Dikerjakan first)
      if (a.tanggalPelaksanaan !== b.tanggalPelaksanaan) {
        return b.tanggalPelaksanaan.localeCompare(a.tanggalPelaksanaan);
      }
      return a.nama.localeCompare(b.nama);
    });
  }, [tasks, searchTerm, statusFilter, shiftFilter, dateRangeFilter, customDate]);

  // Total gaji of filtered tasks
  const filteredTotalGaji = useMemo(() => {
    return filteredTasks.reduce((acc, t) => acc + (Number(t.gaji) || 0), 0);
  }, [filteredTasks]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in" id="employee-tasks-module">
      
      {/* Top Banner / Integration Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="p-3 bg-linear-to-br from-amber-500 to-amber-600 text-slate-950 rounded-2xl shadow-md shadow-amber-500/20 shrink-0">
            <Users className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">
                Pencatatan Tugas Karyawan
              </h2>
              <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                Terintegrasi Sheets
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Rekapitulasi jobdesk operasional staf cafe, alokasi gaji tugas harian & sinkronisasi otomatis ke lembar kerja.
            </p>
          </div>
        </div>

        {/* Action Buttons & Google Sheet Link */}
        <div className="flex flex-wrap items-center gap-2.5">
          {spreadsheetUrl && (
            <a
              href={`${spreadsheetUrl}#gid=0`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-2xs"
              title="Buka Spreadsheet di Tab Baru"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Buka Google Sheet</span>
              <ExternalLink className="h-3 w-3 ml-0.5 text-emerald-500" />
            </a>
          )}

          <button
            type="button"
            onClick={handleSyncToSheet}
            disabled={isSyncing || !spreadsheetId}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-xs"
            title="Sinkronisasi manual ke Google Sheet"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkron ke Sheets'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Tambah Tugas</span>
          </button>
        </div>
      </div>

      {/* Sync Status Feedback Toast / Notification */}
      {syncMessage && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
          syncMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2">
            {syncMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{syncMessage.text}</span>
            {lastSyncTime && syncMessage.type === 'success' && (
              <span className="text-[10px] text-emerald-600 opacity-80">(Terakhir: {lastSyncTime})</span>
            )}
          </div>
          <button 
            type="button" 
            onClick={() => setSyncMessage(null)}
            className="p-1 hover:opacity-70 text-slate-500"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Bento Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Tugas & Total Gaji */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Total Tugas</span>
            <div className="p-2 bg-amber-50 text-amber-800 rounded-xl">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{metrics.totalTasks}</span>
            <span className="text-xs font-bold text-slate-500">tugas terdaftar</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Alokasi Total Upah:</span>
            <span className="font-mono font-bold text-slate-900">{formatRupiah(metrics.totalGaji)}</span>
          </div>
        </div>

        {/* Card 2: Selesai & Progress */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Tugas Selesai</span>
            <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-600">{metrics.selesaiCount}</span>
            <span className="text-xs font-bold text-slate-400">/ {metrics.totalTasks} ({metrics.completionRate}%)</span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.completionRate}%` }}
            />
          </div>
        </div>

        {/* Card 3: Sedang Berjalan & Belum Dikerjakan */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Dalam Proses</span>
            <div className="p-2 bg-sky-50 text-sky-800 rounded-xl">
              <Clock3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-sky-600">{metrics.sedangBerjalanCount}</span>
            <span className="text-xs font-bold text-slate-500">berjalan</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-black text-amber-600">{metrics.belumDikerjakanCount}</span>
            <span className="text-xs font-bold text-slate-400">menunggu</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Ditunda:</span>
            <span className="font-bold text-slate-600">{metrics.ditundaCount} tugas</span>
          </div>
        </div>

        {/* Card 4: Tugas Hari Ini */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Agenda Hari Ini</span>
            <div className="p-2 bg-indigo-50 text-indigo-800 rounded-xl">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-indigo-600">{metrics.todayCount}</span>
            <span className="text-xs font-bold text-slate-500">tugas hari ini</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Tanggal:</span>
            <span className="font-mono font-bold text-slate-800">{new Date().toISOString().split('T')[0]}</span>
          </div>
        </div>

      </div>

      {/* Filter, Search & Export Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama karyawan, deskripsi tugas, atau catatan..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="Belum Dikerjakan">Belum Dikerjakan</option>
              <option value="Sedang Berjalan">Sedang Berjalan</option>
              <option value="Selesai">Selesai</option>
              <option value="Ditunda">Ditunda</option>
            </select>

            {/* Shift Filter */}
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
            >
              <option value="all">Semua Shift</option>
              <option value="Pagi">Shift Pagi</option>
              <option value="Siang">Shift Siang</option>
              <option value="Sore">Shift Sore</option>
              <option value="Malam">Shift Malam</option>
              <option value="Full Day">Full Day</option>
              <option value="Fleksibel">Fleksibel</option>
            </select>

            {/* Date Range Filter */}
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini</option>
              <option value="this_week">Minggu Ini</option>
              <option value="this_month">Bulan Ini</option>
              <option value="custom">Pilih Tanggal...</option>
            </select>

            {dateRangeFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            )}

            {/* Export CSV button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Unduh data dalam format CSV"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Unduh CSV</span>
            </button>
          </div>

        </div>

        {/* Filter stats badge */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
          <div>
            Menampilkan <span className="font-bold text-slate-800">{filteredTasks.length}</span> dari {tasks.length} total tugas
            {(statusFilter !== 'all' || shiftFilter !== 'all' || dateRangeFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setShiftFilter('all');
                  setDateRangeFilter('all');
                  setCustomDate('');
                }}
                className="ml-2 text-amber-800 underline font-bold cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <span>Subtotal Upah Terfilter:</span>
            <span className="font-mono font-bold text-slate-900">{formatRupiah(filteredTotalGaji)}</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4 w-32">Tanggal</th>
                <th className="py-3.5 px-4 w-44">Nama Karyawan</th>
                <th className="py-3.5 px-4">Deskripsi Tugas</th>
                <th className="py-3.5 px-3 w-28 text-center">Shift</th>
                <th className="py-3.5 px-4 w-32 text-right">Gaji / Upah</th>
                <th className="py-3.5 px-4 w-36 text-center">Status</th>
                <th className="py-3.5 px-3 w-24 text-center">Prioritas</th>
                <th className="py-3.5 px-4 w-44">Catatan / PIC</th>
                <th className="py-3.5 px-4 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="p-3 bg-slate-100 text-slate-400 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto">
                        <Users className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">Tidak ada catatan tugas</p>
                      <p className="text-xs text-slate-400">
                        {tasks.length === 0 
                          ? 'Mulai catat tugas karyawan cafe Anda secara manual sekarang.'
                          : 'Tidak ada tugas yang sesuai dengan filter pencarian.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="mt-2 inline-flex items-center space-x-1 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah Tugas Baru</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, index) => {
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70 transition-colors group">
                      
                      {/* 1. No */}
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* 2. Tanggal */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{task.tanggalPelaksanaan}</span>
                        </div>
                      </td>

                      {/* 3. Nama Karyawan */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-900 flex items-center justify-center font-black text-xs shrink-0 uppercase">
                            {task.nama.charAt(0)}
                          </div>
                          <div className="truncate">
                            <p className="font-extrabold text-slate-900 truncate">{task.nama}</p>
                            {task.penanggungJawab && task.penanggungJawab !== '-' && (
                              <p className="text-[10px] text-slate-400 truncate">PIC: {task.penanggungJawab}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Tugas / Jobdesk */}
                      <td className="py-3 px-4">
                        <div className="max-w-md">
                          <p className={`font-semibold leading-relaxed ${
                            task.status === 'Selesai' ? 'text-slate-600 line-through decoration-slate-400' : 'text-slate-900'
                          }`}>
                            {task.tugas}
                          </p>
                        </div>
                      </td>

                      {/* 5. Shift */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {task.shift || 'Pagi'}
                        </span>
                      </td>

                      {/* 6. Gaji / Upah */}
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                        {formatRupiah(task.gaji)}
                      </td>

                      {/* 7. Status with interactive quick dropdown */}
                      <td className="py-3 px-4 text-center">
                        <div className="relative inline-block text-left">
                          <select
                            value={task.status}
                            onChange={(e) => handleQuickStatusChange(task.id, e.target.value as TaskStatus)}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wider border cursor-pointer focus:outline-none transition-all ${
                              task.status === 'Selesai'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : task.status === 'Sedang Berjalan'
                                ? 'bg-sky-50 text-sky-800 border-sky-300 animate-pulse'
                                : task.status === 'Ditunda'
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                          >
                            <option value="Belum Dikerjakan">Belum Selesai</option>
                            <option value="Sedang Berjalan">Sedang Berjalan</option>
                            <option value="Selesai">✓ Selesai</option>
                            <option value="Ditunda">Ditunda</option>
                          </select>
                        </div>
                      </td>

                      {/* 8. Prioritas */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          task.prioritas === 'Urgent'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : task.prioritas === 'Tinggi'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : task.prioritas === 'Sedang'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {task.prioritas || 'Sedang'}
                        </span>
                      </td>

                      {/* 9. Catatan */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        <p className="line-clamp-2" title={task.catatan || '-'}>
                          {task.catatan || '-'}
                        </p>
                      </td>

                      {/* 10. Aksi */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(task)}
                            className="p-1.5 text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="Edit Tugas"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTaskToDelete(task)}
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Hapus Tugas"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Summary */}
            {filteredTasks.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-extrabold text-slate-900 text-xs">
                  <td colSpan={5} className="py-3 px-4 uppercase tracking-wider text-right text-slate-500">
                    Total Upah Tugas ({filteredTasks.length} baris):
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-slate-950">
                    {formatRupiah(filteredTotalGaji)}
                  </td>
                  <td colSpan={4} className="py-3 px-4 text-[10.5px] text-slate-400 font-medium">
                    *Tersinkronisasi dengan tab Google Sheets 'Tugas Karyawan'
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MODAL FORM: Tambah / Edit Tugas Karyawan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 my-8 animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-xl">
                  {editingTask ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5 stroke-[2.5]" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900">
                    {editingTask ? 'Edit Tugas Karyawan' : 'Tambah Tugas Karyawan Baru'}
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Data akan otomatis tersinkronisasi ke Google Spreadsheet personal Anda.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
              
              {/* Field 1: Nama Karyawan with Quick Suggestion Badges from manual entries */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                  Nama Karyawan / Staf <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Masukkan nama karyawan / staf..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold text-slate-900"
                  required
                />
                {/* Dynamic quick-pick suggestions only from previously entered staff names */}
                {(() => {
                  const staffSuggestions = Array.from(
                    new Set([
                      ...tasks.map((t) => t.nama.trim()).filter(Boolean),
                      ...COMMON_STAFF_SUGGESTIONS.map((s) => s.split(' (')[0].trim()).filter(Boolean),
                    ])
                  ).slice(0, 4);
                  if (staffSuggestions.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider py-0.5">Pilih Cepat:</span>
                      {staffSuggestions.map((cleanName, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormNama(cleanName)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded text-[10px] font-medium transition cursor-pointer"
                        >
                          + {cleanName}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Field 2 & 3: Gaji & Tanggal Pelaksanaan (2 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Gaji / Upah Tugas */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                    Gaji / Upah Tugas (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                    <input
                      type="number"
                      value={formGaji}
                      onChange={(e) => setFormGaji(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      min="0"
                      step="5000"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  {typeof formGaji === 'number' && formGaji > 0 && (
                    <p className="text-[10px] font-mono text-emerald-600 font-bold">{formatRupiah(formGaji)}</p>
                  )}
                </div>

                {/* Tanggal Pelaksanaan */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                    Tanggal Pelaksanaan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>

              </div>

              {/* Field 4: Tugas / Deskripsi Pekerjaan */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                  Tugas / Instruksi Pekerjaan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formTugas}
                  onChange={(e) => setFormTugas(e.target.value)}
                  rows={2}
                  placeholder="Deskripsikan pekerjaan yang harus diselesaikan..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-slate-900"
                  required
                />
                {/* Common task suggestions */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider py-0.5">Rekomendasi Tugas:</span>
                  {COMMON_TASK_SUGGESTIONS.slice(0, 3).map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormTugas(t)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9.5px] font-medium transition cursor-pointer truncate max-w-[220px]"
                      title={t}
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 5 & 6: Shift & Status (2 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Shift */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                    Shift / Waktu Kerja
                  </label>
                  <select
                    value={formShift}
                    onChange={(e) => setFormShift(e.target.value as TaskShift)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Pagi">Pagi (07:00 - 15:00)</option>
                    <option value="Siang">Siang (11:00 - 19:00)</option>
                    <option value="Sore">Sore (14:00 - 22:00)</option>
                    <option value="Malam">Malam (16:00 - Closing)</option>
                    <option value="Full Day">Full Day</option>
                    <option value="Fleksibel">Fleksibel / Sesuai Kebutuhan</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                    Status Pelaksanaan
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Belum Dikerjakan">Belum Dikerjakan</option>
                    <option value="Sedang Berjalan">Sedang Berjalan</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Ditunda">Ditunda</option>
                  </select>
                </div>

              </div>

              {/* Field 7 & 8: Prioritas & Penanggung Jawab PIC (2 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Prioritas */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                    Prioritas Tugas
                  </label>
                  <select
                    value={formPrioritas}
                    onChange={(e) => setFormPrioritas(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Rendah">Rendah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Tinggi">Tinggi</option>
                    <option value="Urgent">Mendesak / Urgent</option>
                  </select>
                </div>

                {/* Penanggung Jawab (PIC) */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                    Pemberi Tugas (PIC / Supervisor)
                  </label>
                  <input
                    type="text"
                    value={formPic}
                    onChange={(e) => setFormPic(e.target.value)}
                    placeholder="Contoh: Manager Cafe"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

              </div>

              {/* Field 9: Catatan Tambahan */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 block">
                  Catatan / Keterangan Tambahan / Evaluasi
                </label>
                <textarea
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  rows={2}
                  placeholder="Catatan tambahan hasil eksekusi tugas..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-slate-900"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="flex space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {editingTask ? 'Simpan Perubahan' : 'Tambah Tugas'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Hapus Tugas */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-4 animate-scale-up">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">Hapus Tugas Ini?</h4>
                <p className="text-[11px] text-slate-400 font-medium">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-extrabold text-slate-900">{taskToDelete.nama}</p>
              <p className="text-slate-600">{taskToDelete.tugas}</p>
              <p className="text-[10px] text-slate-400 font-mono">Tanggal: {taskToDelete.tanggalPelaksanaan} | Upah: {formatRupiah(taskToDelete.gaji)}</p>
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-xs"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
