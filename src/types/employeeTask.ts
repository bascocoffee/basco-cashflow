export type TaskStatus = 'Belum Dikerjakan' | 'Sedang Berjalan' | 'Selesai' | 'Ditunda';
export type TaskPriority = 'Rendah' | 'Sedang' | 'Tinggi' | 'Urgent';
export type TaskShift = 'Pagi' | 'Siang' | 'Sore' | 'Malam' | 'Full Day' | 'Fleksibel';

export interface EmployeeTask {
  id: string; // ID unik atau nomor baris spreadsheet
  nama: string; // Nama karyawan / staf
  gaji: number; // Gaji / Upah / Insentif pengerjaan tugas (Rp)
  tugas: string; // Deskripsi tugas / pekerjaan yang harus dilakukan
  tanggalPelaksanaan: string; // Format YYYY-MM-DD
  shift?: TaskShift | string; // Shift kerja atau waktu pelaksanaan
  status: TaskStatus; // Status pengerjaan
  prioritas?: TaskPriority; // Tingkat urgensi tugas
  penanggungJawab?: string; // Pemberi tugas / Supervisor / PIC
  catatan?: string; // Catatan tambahan / evaluasi hasil pengerjaan
  createdAt?: string; // Timestamp pembuatan
  updatedAt?: string; // Timestamp perubahan
  sourceRowIndex?: number; // Baris di Google Sheet (jika ada)
}

export interface EmployeeTaskMetrics {
  totalTasks: number;
  totalGaji: number;
  selesaiCount: number;
  sedangBerjalanCount: number;
  belumDikerjakanCount: number;
  ditundaCount: number;
  completionRate: number; // Persentase 0-100%
  todayCount: number;
}
