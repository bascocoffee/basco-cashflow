import { CalendarNoteActivity, NotificationH1Alert } from '../types/calendarNotes';

export const CALENDAR_NOTES_STORAGE_KEY = 'basco_calendar_notes_activities';

// Default initial activities to give the user immediate rich sample data
export const DEFAULT_CALENDAR_ACTIVITIES: CalendarNoteActivity[] = [
  {
    id: 'act-1',
    judul: 'Deep Cleaning Mesin Espresso & Grinder',
    tanggal: getRelativeDate(1), // Tomorrow (H-1 right now!)
    waktuMulai: '22:00',
    waktuSelesai: '23:30',
    kategori: 'Maintenance & Alat',
    prioritas: 'tinggi',
    penanggungJawab: 'Head Barista (Dimas)',
    lokasi: 'Bar Utama',
    deskripsi: 'Backflush dengan Cafiza chemical, soak portafilter basket, vacuum hopper & kalibrasi burr grinder.',
    nominalEstimasi: 75000,
    ingatkanH1: true,
    ingatkanHariH: true,
    isCompleted: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'act-2',
    judul: 'Restock Susu Fresh Milk & Sirup Aren',
    tanggal: getRelativeDate(1), // Tomorrow (H-1 right now!)
    waktuMulai: '10:00',
    waktuSelesai: '11:00',
    kategori: 'Restock / Belanja',
    prioritas: 'urgent',
    penanggungJawab: 'Kasir & Purchasing (Siti)',
    lokasi: 'Supplier Agen Susu',
    deskripsi: 'Order 3 karton Diamond Fresh Milk (@12L) + 5 botol Sirup Aren Organik. Pastikan cek tanggal kedaluwarsa.',
    nominalEstimasi: 650000,
    ingatkanH1: true,
    ingatkanHariH: true,
    isCompleted: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'act-3',
    judul: 'Live Music Akustik Akhir Pekan',
    tanggal: getRelativeDate(3),
    waktuMulai: '19:30',
    waktuSelesai: '22:30',
    kategori: 'Event & Acara Cafe',
    prioritas: 'sedang',
    penanggungJawab: 'Manager Cafe & Tim Akustik',
    lokasi: 'Panggung Outdoor Basco',
    deskripsi: 'Check sound system soundboard, siapkan promo bundle kopi + snack box diskon 15%.',
    nominalEstimasi: 500000,
    ingatkanH1: true,
    ingatkanHariH: true,
    isCompleted: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'act-4',
    judul: 'Pembayaran Tagihan Listrik PLN & Internet Wifi',
    tanggal: getRelativeDate(5),
    waktuMulai: '09:00',
    waktuSelesai: '10:00',
    kategori: 'Pembayaran & Tagihan',
    prioritas: 'tinggi',
    penanggungJawab: 'Owner / Manager',
    lokasi: 'M-Banking / Kantor PLN',
    deskripsi: 'Bayar tagihan pascabayar listrik daya 5500VA dan langganan Indihome Biz 100Mbps.',
    nominalEstimasi: 1250000,
    ingatkanH1: true,
    ingatkanHariH: true,
    isCompleted: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'act-5',
    judul: 'Briefing & Evaluasi Target Omset Bulanan',
    tanggal: getRelativeDate(0), // Today
    waktuMulai: '15:30',
    waktuSelesai: '16:30',
    kategori: 'Rapat & Evaluasi',
    prioritas: 'sedang',
    penanggungJawab: 'Manager Cafe',
    lokasi: 'Meeting Room',
    deskripsi: 'Review COGS margin, evaluasi penjualan menu signature, dan rotasi jadwal barista.',
    nominalEstimasi: 0,
    ingatkanH1: true,
    ingatkanHariH: true,
    isCompleted: false,
    createdAt: new Date().toISOString()
  }
];

function getRelativeDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Compute H-1 and today alerts
export function computeH1Alerts(activities: CalendarNoteActivity[], referenceDate = new Date()): NotificationH1Alert[] {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  const todayZero = new Date(refYear, refMonth, refDay, 0, 0, 0, 0).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const alerts: NotificationH1Alert[] = [];

  activities.forEach(act => {
    if (act.isCompleted) return; // ignore completed items
    if (!act.ingatkanH1 && !act.ingatkanHariH) return;

    if (!act.tanggal) return;
    const [y, m, d] = act.tanggal.split('-').map(Number);
    if (!y || !m || !d) return;

    const actDateZero = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    const diffDays = Math.round((actDateZero - todayZero) / oneDayMs);

    // Format human date
    const dateObj = new Date(y, m - 1, d);
    const formattedDate = dateObj.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    if (diffDays === 1 && act.ingatkanH1) {
      alerts.push({
        activity: act,
        daysDiff: 1,
        type: 'h-1',
        formattedDate
      });
    } else if (diffDays === 0 && act.ingatkanHariH) {
      alerts.push({
        activity: act,
        daysDiff: 0,
        type: 'hari-h',
        formattedDate
      });
    } else if (diffDays < 0) {
      // Overdue
      alerts.push({
        activity: act,
        daysDiff: diffDays,
        type: 'terlewat',
        formattedDate
      });
    }
  });

  // Sort: H-1 and Hari H first, then overdue
  return alerts.sort((a, b) => {
    if (a.type === 'hari-h' && b.type !== 'hari-h') return -1;
    if (b.type === 'hari-h' && a.type !== 'hari-h') return 1;
    if (a.type === 'h-1' && b.type !== 'h-1') return -1;
    if (b.type === 'h-1' && a.type !== 'h-1') return 1;
    return a.daysDiff - b.daysDiff;
  });
}
