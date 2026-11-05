import { ShoppingIngredientItem, ShoppingReportMetrics } from '../types/shoppingList';

export const SHOPPING_LIST_STORAGE_KEY = 'basco_shopping_list_sheet4';

export const DEFAULT_SHOPPING_ITEMS: ShoppingIngredientItem[] = [
  {
    id: 'shop-1',
    tanggal: new Date().toISOString().split('T')[0],
    namaBahan: 'Susu Fresh Milk (Diamond / Greenfields)',
    kategori: 'Minuman',
    jumlah: 12,
    satuan: 'liter',
    sisaStok: 1.5,
    stokMinimum: 5,
    estimasiHarga: 18000,
    estimasiTotal: 216000,
    supplier: 'Agen Susu Segar Sejahtera',
    prioritas: 'urgent',
    status: 'perlu_dibeli',
    catatan: 'Stok di chiller bar sisa 1.5 botol, butuh untuk operasional besok pagi!',
    checked: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop-2',
    tanggal: new Date().toISOString().split('T')[0],
    namaBahan: 'Biji Kopi House Blend (Espresso)',
    kategori: 'Minuman',
    jumlah: 5,
    satuan: 'kg',
    sisaStok: 0.8,
    stokMinimum: 2,
    estimasiHarga: 190000,
    estimasiTotal: 950000,
    supplier: 'Roastery Kopi Nusantara',
    prioritas: 'urgent',
    status: 'perlu_dibeli',
    catatan: 'Roast date maksimal 2 minggu lalu. Profil medium-dark.',
    checked: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop-3',
    tanggal: new Date().toISOString().split('T')[0],
    namaBahan: 'Paper Cup Hot 8oz + Lid Hitam',
    kategori: 'Packaging',
    jumlah: 250,
    satuan: 'pcs',
    sisaStok: 35,
    stokMinimum: 100,
    estimasiHarga: 850,
    estimasiTotal: 212500,
    supplier: 'Pabrik Kemasan Plastik & Paper',
    prioritas: 'tinggi',
    status: 'perlu_dibeli',
    catatan: 'Pastikan lid pas tidak bocor / anti-tumpah.',
    checked: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop-4',
    tanggal: new Date().toISOString().split('T')[0],
    namaBahan: 'Gula Aren Cair Organik Premium',
    kategori: 'Minuman',
    jumlah: 5,
    satuan: 'liter',
    sisaStok: 0.6,
    stokMinimum: 2,
    estimasiHarga: 32000,
    estimasiTotal: 160000,
    supplier: 'Pengrajin Aren Garut',
    prioritas: 'tinggi',
    status: 'perlu_dibeli',
    catatan: 'Kekentalan brix tinggi untuk menu Kopi Susu Gula Aren signature.',
    checked: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop-5',
    tanggal: new Date().toISOString().split('T')[0],
    namaBahan: 'Sirup Karamel Monin / Davinci',
    kategori: 'Minuman',
    jumlah: 2,
    satuan: 'botol',
    sisaStok: 1,
    stokMinimum: 1,
    estimasiHarga: 145000,
    estimasiTotal: 290000,
    supplier: 'Toko Bahan Kue & Kafe Inti',
    prioritas: 'sedang',
    status: 'perlu_dibeli',
    catatan: 'Bisa beli ukuran 750ml.',
    checked: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop-6',
    tanggal: new Date().toISOString().split('T')[0],
    namaBahan: 'Gas Elpiji 12kg (Dapur & Steamer)',
    kategori: 'Operasional',
    jumlah: 1,
    satuan: 'tabung',
    sisaStok: 0,
    stokMinimum: 1,
    estimasiHarga: 215000,
    estimasiTotal: 215000,
    supplier: 'Pangkalan Gas Barokah',
    prioritas: 'urgent',
    status: 'perlu_dibeli',
    catatan: 'Tabung cadangan kosong, langsung antar ke cafe.',
    checked: false,
    createdAt: new Date().toISOString()
  }
];

// Helper to compute notification metrics
export function computeShoppingMetrics(items: ShoppingIngredientItem[]): ShoppingReportMetrics {
  let needToBuyCount = 0;
  let urgentCount = 0;
  let purchasedCount = 0;
  let totalEstimatedBudget = 0;
  let lowStockItemsCount = 0;

  items.forEach(item => {
    if (item.status === 'sudah_dibeli') {
      purchasedCount++;
    } else if (item.status === 'perlu_dibeli' || item.status === 'sedang_dipesan') {
      needToBuyCount++;
      totalEstimatedBudget += (item.estimasiTotal || 0);

      if (item.prioritas === 'urgent' || item.prioritas === 'tinggi') {
        urgentCount++;
      }

      if (item.sisaStok !== undefined && item.stokMinimum !== undefined && item.sisaStok <= item.stokMinimum) {
        lowStockItemsCount++;
      }
    }
  });

  return {
    totalItems: items.length,
    needToBuyCount,
    urgentCount,
    purchasedCount,
    totalEstimatedBudget,
    lowStockItemsCount
  };
}

// Generate formatted WhatsApp text for shopping
export function generateWhatsAppShoppingText(items: ShoppingIngredientItem[]): string {
  const pendingItems = items.filter(i => i.status === 'perlu_dibeli' || i.status === 'sedang_dipesan');
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  let text = `🛒 *DAFTAR BELANJA BAHAN CAFE (SPREADSHEET SHEET 4)*\n`;
  text += `📅 Tanggal: ${dateFormatted}\n`;
  text += `-----------------------------------------\n\n`;

  const urgentItems = pendingItems.filter(i => i.prioritas === 'urgent' || i.prioritas === 'tinggi');
  const normalItems = pendingItems.filter(i => i.prioritas !== 'urgent' && i.prioritas !== 'tinggi');

  if (urgentItems.length > 0) {
    text += `🚨 *PRIORITAS MENDESAK / SEGERA (STOK MENIPIS):*\n`;
    urgentItems.forEach((item, idx) => {
      const budget = item.estimasiTotal ? `(Est: Rp${item.estimasiTotal.toLocaleString('id-ID')})` : '';
      const supplier = item.supplier ? `[Toko: ${item.supplier}]` : '';
      text += `${idx + 1}. *${item.namaBahan}* : ${item.jumlah} ${item.satuan} ${budget} ${supplier}\n`;
      if (item.catatan) text += `   _Catatan: ${item.catatan}_\n`;
    });
    text += `\n`;
  }

  if (normalItems.length > 0) {
    text += `📦 *BAHAN REGULER / RESTOCK TAMBAHAN:*\n`;
    normalItems.forEach((item, idx) => {
      const budget = item.estimasiTotal ? `(Est: Rp${item.estimasiTotal.toLocaleString('id-ID')})` : '';
      const supplier = item.supplier ? `[Toko: ${item.supplier}]` : '';
      text += `${idx + 1}. *${item.namaBahan}* : ${item.jumlah} ${item.satuan} ${budget} ${supplier}\n`;
      if (item.catatan) text += `   _Catatan: ${item.catatan}_\n`;
    });
    text += `\n`;
  }

  const totalBudget = pendingItems.reduce((acc, curr) => acc + (curr.estimasiTotal || 0), 0);
  text += `-----------------------------------------\n`;
  text += `💰 *TOTAL ESTIMASI ANGGARAN: Rp${totalBudget.toLocaleString('id-ID')}*\n`;
  text += `📌 *Total Item yang Harus Dibelanjakan: ${pendingItems.length} Bahan*\n`;
  text += `_Mohon konfirmasi jika ada bahan yang kosong di supplier._\n`;

  return text;
}
