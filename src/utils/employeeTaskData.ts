import { EmployeeTask, EmployeeTaskMetrics, TaskStatus } from '../types/employeeTask';

export const EMPLOYEE_TASKS_STORAGE_KEY = 'basco_employee_tasks';

// Default sample employee tasks for cafe operations
export const DEFAULT_EMPLOYEE_TASKS: EmployeeTask[] = [
  {
    id: 'task-1',
    nama: 'Rian Pratama',
    gaji: 120000,
    tugas: 'Kalibrasi Grinder Espresso, Cek Tekanan Mesin & Suhu Chiller Susu',
    tanggalPelaksanaan: '2026-10-28',
    shift: 'Pagi',
    status: 'Selesai',
    prioritas: 'Tinggi',
    penanggungJawab: 'Manager Cafe',
    catatan: 'Kalibrasi grinder rasio 1:2 extraction 26 detik, rasa stabil.',
    createdAt: '2026-10-28T07:00:00.000Z',
    updatedAt: '2026-10-28T09:30:00.000Z'
  },
  {
    id: 'task-2',
    nama: 'Dinda Ayu',
    gaji: 95000,
    tugas: 'Restock Cup 16oz, Sirup Karamel, Sedotan & Kemasan Takeaway',
    tanggalPelaksanaan: '2026-10-28',
    shift: 'Siang',
    status: 'Selesai',
    prioritas: 'Sedang',
    penanggungJawab: 'Head Barista',
    catatan: 'Stok cup dan kemasan aman untuk 2 hari ke depan.',
    createdAt: '2026-10-28T10:00:00.000Z',
    updatedAt: '2026-10-28T13:45:00.000Z'
  },
  {
    id: 'task-3',
    nama: 'Budi Santoso',
    gaji: 90000,
    tugas: 'Deep Cleaning Ice Maker, Descaling Steam Wand & Sanitasi Drip Tray Bar',
    tanggalPelaksanaan: '2026-10-28',
    shift: 'Malam',
    status: 'Sedang Berjalan',
    prioritas: 'Tinggi',
    penanggungJawab: 'Head Barista',
    catatan: 'Sedang proses backflush kimia cafiza dan filter air.',
    createdAt: '2026-10-28T17:00:00.000Z',
    updatedAt: '2026-10-28T19:00:00.000Z'
  },
  {
    id: 'task-4',
    nama: 'Siti Rahma',
    gaji: 95000,
    tugas: 'Rekonsiliasi Kas POS Harian, Cetak Z-Report & Audit Nota Tunai',
    tanggalPelaksanaan: '2026-10-28',
    shift: 'Malam',
    status: 'Belum Dikerjakan',
    prioritas: 'Tinggi',
    penanggungJawab: 'Manager Cafe',
    catatan: 'Dikerjakan menjelang closing pukul 22.00 WIB.',
    createdAt: '2026-10-28T18:00:00.000Z',
    updatedAt: '2026-10-28T18:00:00.000Z'
  },
  {
    id: 'task-5',
    nama: 'Eko Wahyudi',
    gaji: 100000,
    tugas: 'Baking Croissant & Persiapan Adonan Donat Kentang Batch Pagi',
    tanggalPelaksanaan: '2026-10-29',
    shift: 'Pagi',
    status: 'Belum Dikerjakan',
    prioritas: 'Sedang',
    penanggungJawab: 'Kitchen Lead',
    catatan: 'Gunakan butter unsalted Anchor suhu ruang.',
    createdAt: '2026-10-28T15:00:00.000Z',
    updatedAt: '2026-10-28T15:00:00.000Z'
  }
];

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

export const COMMON_STAFF_SUGGESTIONS = [
  'Rian Pratama (Head Barista)',
  'Dinda Ayu (Barista)',
  'Budi Santoso (Junior Barista)',
  'Siti Rahma (Kasir / Bar)',
  'Eko Wahyudi (Kitchen / Pastry)',
  'Andi Wijaya (Barista Part Time)',
  'Maya Putri (Service / Floor)'
];

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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
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
