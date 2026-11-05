// Types for Catatan & Agenda Kalender with H-1 Notification

export type ActivityPriority = 'rendah' | 'sedang' | 'tinggi' | 'urgent';

export type ActivityCategory = 
  | 'Operasional'
  | 'Maintenance & Alat'
  | 'Restock / Belanja'
  | 'Event & Acara Cafe'
  | 'Promo & Marketing'
  | 'Pembayaran & Tagihan'
  | 'Kebersihan & Sanitasi'
  | 'Rapat & Evaluasi'
  | 'Lain-lain';

export interface CalendarNoteActivity {
  id: string;
  judul: string; // Activity / Note Title
  tanggal: string; // YYYY-MM-DD
  waktuMulai?: string; // HH:mm, e.g. "09:00"
  waktuSelesai?: string; // HH:mm, e.g. "11:30"
  kategori: ActivityCategory;
  prioritas: ActivityPriority;
  penanggungJawab?: string; // PIC name (Barista / Manager / Vendor)
  lokasi?: string; // Area Bar, Dapur, Area Outdoor, etc.
  deskripsi?: string; // Detailed notes / checklist
  nominalEstimasi?: number; // Optional budget/cost if related to restock or bill
  
  // Notification H-1 & Alert settings
  ingatkanH1: boolean; // Flag to enable H-1 notification (defaults to true)
  ingatkanHariH?: boolean; // Also alert on D-Day
  isCompleted: boolean; // Completion status
  completedAt?: string; // ISO string when marked done
  
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationH1Alert {
  activity: CalendarNoteActivity;
  daysDiff: number; // 1 = Tomorrow (H-1), 0 = Today (Hari H), <0 = Past/Overdue
  type: 'h-1' | 'hari-h' | 'terlewat';
  formattedDate: string;
}
