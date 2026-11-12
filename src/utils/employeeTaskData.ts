import { EmployeeTask, EmployeeTaskMetrics, TaskStatus } from '../types/employeeTask';

export const EMPLOYEE_TASKS_STORAGE_KEY = 'basco_employee_tasks';

// Emptied by default so employee tasks are entered manually
export const DEFAULT_EMPLOYEE_TASKS: EmployeeTask[] = [];

const LEGACY_DUMMY_TASK_SIGNATURES: ReadonlyArray<{ id: string; nama: string; tugas: string }> = [
  {
    id: 'task-1',
    nama: 'Rian Pratama',
    tugas: 'Kalibrasi Grinder Espresso, Cek Tekanan Mesin & Suhu Chiller Susu',
  },
  {
    id: 'task-2',
    nama: 'Dinda Ayu',
    tugas: 'Restock Cup 16oz, Sirup Karamel, Sedotan & Kemasan Takeaway',
  },
  {
    id: 'task-3',
    nama: 'Budi Santoso',
    tugas: 'Deep Cleaning Ice Maker, Descaling Steam Wand & Sanitasi Drip Tray Bar',
  },
  {
    id: 'task-4',
    nama: 'Siti Rahma',
    tugas: 'Rekonsiliasi Kas POS Harian, Cetak Z-Report & Audit Nota Tunai',
  },
  {
    id: 'task-5',
    nama: 'Eko Wahyudi',
    tugas: 'Baking Croissant & Persiapan Adonan Donat Kentang Batch Pagi',
  },
];

/** Filter out legacy sample tasks cached in localStorage, cloud sync, or sheets. */
export function isLegacyDummyEmployeeTask(task: Partial<EmployeeTask> | null | undefined): boolean {
  if (!task) return false;
  const id = String(task.id || '').trim();
  const nama = String(task.nama || '').trim();
  const tugas = String(task.tugas || '').trim();
  return LEGACY_DUMMY_TASK_SIGNATURES.some(
    (d) => d.id === id && d.nama === nama && d.tugas === tugas
  );
}

/** Return tasks excluding legacy dummy sample records. */
export function stripDummyEmployeeTasks(tasks: EmployeeTask[]): EmployeeTask[] {
  return tasks.filter((t) => t && !isLegacyDummyEmployeeTask(t));
}

export const COMMON_TASK_SUGGESTIONS = [
  'Kalibrasi Grinder Espresso & Uji Rasa Kopi',
  'Deep Cleaning Mesin Espresso & Backflush Kimia',
  'Restock Biji Kopi Blend, Sirup & Cup Takeaway',
  'Pembersihan Sanitasi Ice Maker & Drip Tray Bar',
  'Rekonsiliasi Kas Kasir POS & Z-Report Harian',
  'Baking Pastry & Persiapan Adonan Batch Pagi',
  'Cek Suhu & Kebersihan Chiller / Kulkas Susu',
  'Stock Opname Harian Bahan Minuman Cepat Rusak',
  'Pelayanan Tamu VIP / Booking Space Lantai 2',
  'Pengecekan Kebersihan Area Meja & Toilet Tamu'
];

export const COMMON_STAFF_SUGGESTIONS: string[] = [];

export function computeTaskMetrics(tasks: EmployeeTask[]): EmployeeTaskMetrics {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const totalTasks = tasks.length;
  let totalGaji = 0;
  let selesaiCount = 0;
  let sedangBerjalanCount = 0;
  let belumDikerjakanCount = 0;
  let ditundaCount = 0;
  let todayCount = 0;

  for (const t of tasks) {
    totalGaji += (Number(t.gaji) || 0);
    if (t.status === 'Selesai') selesaiCount++;
    else if (t.status === 'Sedang Berjalan') sedangBerjalanCount++;
    else if (t.status === 'Belum Dikerjakan') belumDikerjakanCount++;
    else if (t.status === 'Ditunda') ditundaCount++;

    if (t.tanggalPelaksanaan === todayStr) {
      todayCount++;
    }
  }

  const completionRate = totalTasks > 0 ? Math.round((selesaiCount / totalTasks) * 100) : 0;

  return {
    totalTasks,
    totalGaji,
    selesaiCount,
    sedangBerjalanCount,
    belumDikerjakanCount,
    ditundaCount,
    completionRate,
    todayCount
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export function getStoredEmployeeTasks(): EmployeeTask[] {
  try {
    const raw = localStorage.getItem(EMPLOYEE_TASKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = stripDummyEmployeeTasks(parsed);
        if (cleaned.length !== parsed.length) {
          saveStoredEmployeeTasks(cleaned);
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca data tugas karyawan dari localStorage:', err);
  }
  return DEFAULT_EMPLOYEE_TASKS;
}

export function saveStoredEmployeeTasks(tasks: EmployeeTask[]): void {
  try {
    localStorage.setItem(EMPLOYEE_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.warn('Gagal menyimpan data tugas karyawan ke localStorage:', err);
  }
}
