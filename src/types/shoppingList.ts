// Types for Bahan yang Harus Dibelanjakan (Shopping / Restock List from Sheet 4)

export type ShoppingUrgency = 'urgent' | 'tinggi' | 'sedang' | 'rendah';
export type ShoppingStatus = 'perlu_dibeli' | 'sudah_dibeli' | 'sedang_dipesan' | 'dibatalkan';

export interface ShoppingIngredientItem {
  id: string;
  tanggal?: string; // Tanggal kebutuhan / target belanja YYYY-MM-DD
  namaBahan: string;
  kategori?: string; // Minuman, Makanan, Packaging, Alat, Operasional, Lain-lain
  jumlah: number;
  satuan: string; // kg, liter, gram, pcs, pack, botol, dll.
  sisaStok?: number; // Sisa stok saat ini di bar/gudang
  stokMinimum?: number; // Batas aman minimum stok
  estimasiHarga?: number; // Harga perkiraan per satuan (Rp)
  estimasiTotal?: number; // Total perkiraan biaya belanja (Rp)
  supplier?: string; // Nama toko / agen / supplier langganan
  prioritas: ShoppingUrgency;
  status: ShoppingStatus;
  catatan?: string;
  checked?: boolean; // Ceklis belanja di lapangan
  sourceRowIndex?: number; // Baris asli di spreadsheet Sheet 4
  statusColIndex?: number; // Kolom status di spreadsheet Sheet 4
  isFormulaDriven?: boolean; // True jika tanggal/nama bahan berasal dari rumus/IMPORTRANGE
  createdAt?: string;
  updatedAt?: string;
}

export interface ShoppingReportMetrics {
  totalItems: number;
  needToBuyCount: number;
  urgentCount: number;
  purchasedCount: number;
  totalEstimatedBudget: number;
  lowStockItemsCount: number;
}
