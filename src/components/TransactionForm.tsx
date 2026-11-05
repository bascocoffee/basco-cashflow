import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Tag, FileText, ArrowUpRight, ArrowDownRight, Save, Briefcase } from 'lucide-react';
import { Transaction } from '../types';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Transaction, 'id'>) => Promise<void>;
  editingTransaction: Transaction | null;
  categories: string[];
  onManageCategories: () => void;
}

export default function TransactionForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editingTransaction,
  categories,
  onManageCategories
}: TransactionFormProps) {
  const [tanggal, setTanggal] = useState<string>('');
  const [type, setType] = useState<'debit' | 'kredit'>('kredit'); // Default to Kredit (Pengeluaran)
  const [jumlah, setJumlah] = useState<number>(0);
  const [jumlah2, setJumlah2] = useState<number>(0);
  const [jenisPengeluaran, setJenisPengeluaran] = useState<string>('');
  const [jenisPengeluaran2, setJenisPengeluaran2] = useState<string>('-');
  const [keterangan, setKeterangan] = useState<string>('');
  const [operasionalDanManajemen, setOperasionalDanManajemen] = useState<string>('-');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load editing transaction if exists
  useEffect(() => {
    if (editingTransaction) {
      setTanggal(editingTransaction.tanggal);
      if (editingTransaction.debit > 0) {
        setType('debit');
        setJumlah(editingTransaction.debit);
        setJumlah2(0);
      } else {
        setType('kredit');
        setJumlah(editingTransaction.kredit);
        setJumlah2(editingTransaction.kredit2 || 0);
      }
      setJenisPengeluaran(editingTransaction.jenisPengeluaran || categories[0] || 'Lain-lain');
      setJenisPengeluaran2(editingTransaction.jenisPengeluaran2 || '-');
      setKeterangan(editingTransaction.keterangan || '');
      setOperasionalDanManajemen(editingTransaction.operasionalDanManajemen || '-');
    } else {
      // Set defaults for new transaction
      const today = new Date().toISOString().split('T')[0];
      setTanggal(today);
      setType('kredit');
      setJumlah(0);
      setJumlah2(0);
      setJenisPengeluaran(categories[0] || 'Lain-lain');
      setJenisPengeluaran2('-');
      setKeterangan('');
      setOperasionalDanManajemen('-');
    }
    setError(null);
  }, [editingTransaction, isOpen, categories]);

  // Adjust default category based on transaction type for helper purposes
  useEffect(() => {
    if (!editingTransaction && categories.length > 0) {
      if (type === 'debit') {
        const foundIncome = categories.find(c => c.toLowerCase().includes('gaji') || c.toLowerCase().includes('pemasukan') || c.toLowerCase().includes('investasi'));
        setJenisPengeluaran(foundIncome || categories[0]);
      } else {
        const foundExpense = categories.find(c => c.toLowerCase().includes('makan') || c.toLowerCase().includes('belanja') || c.toLowerCase().includes('rumah'));
        setJenisPengeluaran(foundExpense || categories[0]);
      }
    }
  }, [type, editingTransaction, categories]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tanggal) {
      setError('Tanggal transaksi wajib diisi');
      return;
    }
    if (jumlah <= 0) {
      setError('Jumlah uang harus lebih besar dari 0');
      return;
    }
    if (!jenisPengeluaran) {
      setError('Pilih kategori / pengeluaran 1');
      return;
    }

    setIsSubmitting(true);
    try {
      const debitValue = type === 'debit' ? jumlah : 0;
      const kreditValue = type === 'kredit' ? jumlah : 0;
      const kredit2Value = type === 'kredit' && jenisPengeluaran2 !== '-' ? jumlah2 : 0;

      await onSubmit({
        tanggal,
        debit: debitValue,
        kredit: kreditValue,
        kredit2: kredit2Value,
        jenisPengeluaran,
        jenisPengeluaran2,
        keterangan: keterangan.trim(),
        operasionalDanManajemen
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal menyimpan transaksi. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="transaction-form-modal">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="relative transform overflow-hidden rounded bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-lg border border-slate-200">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                {editingTransaction ? 'Edit Transaksi Keuangan' : 'Tambah Transaksi Baru'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                {editingTransaction ? 'Perbarui entri data yang sudah ada' : 'Catat pengeluaran atau pemasukan baru'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            
            {/* Type Selector (Debit vs Kredit) */}
            <div>
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-2">Tipe Transaksi</label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded">
                <button
                  type="button"
                  onClick={() => setType('kredit')}
                  className={`py-2 px-4 rounded font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
                    type === 'kredit'
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                  }`}
                >
                  <ArrowDownRight className="h-4 w-4" />
                  <span>Kredit (Pengeluaran)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('debit')}
                  className={`py-2 px-4 rounded font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
                    type === 'debit'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  <span>Debit (Pemasukan)</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-150 rounded text-xs font-bold text-red-700 animate-shake">
                {error}
              </div>
            )}

            {/* Amount / Jumlah Uang */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Amount 1 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="jumlah-input" className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                    {type === 'kredit' && jenisPengeluaran2 !== '-' ? 'Jumlah Pengeluaran 1' : 'Jumlah Transaksi'}
                  </label>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">IDR (Rupiah)</span>
                </div>
                <div className="relative rounded shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-slate-400 text-xs font-black">Rp</span>
                  </div>
                  <input
                    type="number"
                    name="jumlah"
                    id="jumlah-input"
                    min="0"
                    step="1"
                    required
                    placeholder="0"
                    value={jumlah || ''}
                    onChange={(e) => setJumlah(Math.max(0, parseInt(e.target.value) || 0))}
                    className="block w-full rounded border border-slate-200 py-2 pl-9 pr-4 text-xs text-slate-900 font-bold focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 placeholder-slate-350 transition-colors"
                  />
                </div>
              </div>

              {/* Amount 2 (only for Kredit and if a second category is selected) */}
              <div>
                {type === 'kredit' && jenisPengeluaran2 !== '-' ? (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label htmlFor="jumlah2-input" className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                        Jumlah Keterangan
                      </label>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">IDR (Rupiah)</span>
                    </div>
                    <div className="relative rounded shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-slate-400 text-xs font-black">Rp</span>
                      </div>
                      <input
                        type="number"
                        name="jumlah2"
                        id="jumlah2-input"
                        min="0"
                        step="1"
                        required
                        placeholder="0"
                        value={jumlah2 || ''}
                        onChange={(e) => setJumlah2(Math.max(0, parseInt(e.target.value) || 0))}
                        className="block w-full rounded border border-slate-200 py-2 pl-9 pr-4 text-xs text-slate-900 font-bold focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 placeholder-slate-350 transition-colors bg-amber-50/10"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="hidden sm:block pt-6">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 border border-slate-100 p-2.5 rounded text-center">
                      Satu Kategori Aktif
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Date and Operasional/Manajemen Select Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date / Tanggal */}
              <div>
                <label htmlFor="tanggal-input" className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-1.5">Tanggal</label>
                <div className="relative rounded shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="date"
                    name="tanggal"
                    id="tanggal-input"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="block w-full rounded border border-slate-200 py-2 pl-9 pr-4 text-xs font-bold text-slate-900 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors"
                  />
                </div>
              </div>

              {/* Operasional & Manajemen Select */}
              <div>
                <label htmlFor="opman-select" className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-1.5">
                  Klasifikasi Operasional / Manajemen
                </label>
                <div className="relative rounded shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                  </div>
                  <select
                    name="opman"
                    id="opman-select"
                    required
                    value={operasionalDanManajemen}
                    onChange={(e) => setOperasionalDanManajemen(e.target.value)}
                    className="block w-full rounded border border-slate-200 py-2 pl-9 pr-4 text-xs font-bold text-slate-900 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors bg-white cursor-pointer"
                  >
                    <option value="-">- Bukan Keduanya -</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Manajemen">Manajemen</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pengeluaran 1 and Pengeluaran 2 Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category / Jenis Pengeluaran 1 */}
              <div>
                <label htmlFor="kategori-select" className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-1.5">Kategori / Pengeluaran 1</label>
                <div className="flex space-x-1.5">
                  <div className="relative rounded shadow-sm flex-grow">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Tag className="h-4 w-4 text-slate-400" />
                    </div>
                    <select
                      name="kategori"
                      id="kategori-select"
                      required
                      value={jenisPengeluaran}
                      onChange={(e) => setJenisPengeluaran(e.target.value)}
                      className="block w-full rounded border border-slate-200 py-2 pl-9 pr-4 text-xs font-bold text-slate-900 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors bg-white cursor-pointer"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={onManageCategories}
                    className="px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded text-xs font-bold hover:text-slate-900 transition flex items-center justify-center cursor-pointer shrink-0"
                    title="Kelola Kategori"
                  >
                    Kelola
                  </button>
                </div>
              </div>

              {/* Category 2 / Jenis Pengeluaran 2 */}
              <div>
                <label htmlFor="kategori2-select" className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-1.5">Kategori / Keterangan</label>
                <div className="relative rounded shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Tag className="h-4 w-4 text-slate-400" />
                  </div>
                  <select
                    name="kategori2"
                    id="kategori2-select"
                    required
                    value={jenisPengeluaran2}
                    onChange={(e) => setJenisPengeluaran2(e.target.value)}
                    className="block w-full rounded border border-slate-200 py-2 pl-9 pr-4 text-xs font-bold text-slate-900 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors bg-white cursor-pointer"
                  >
                    <option value="-">- Tidak Ada -</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Description / Keterangan */}
            <div>
              <label htmlFor="keterangan-input" className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-1.5">Keterangan / Deskripsi</label>
              <div className="relative rounded shadow-sm">
                <div className="pointer-events-none absolute top-2.5 left-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
                <textarea
                  name="keterangan"
                  id="keterangan-input"
                  rows={2}
                  maxLength={120}
                  placeholder="Contoh: Belanja bahan dapur mingguan"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="block w-full rounded border border-slate-200 py-2 pl-9 pr-4 text-xs font-bold text-slate-900 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 placeholder-slate-350 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded transition disabled:opacity-55"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 text-white font-bold text-xs rounded flex items-center justify-center space-x-2 transition disabled:opacity-55 ${
                  type === 'debit' 
                    ? 'bg-emerald-500 hover:bg-emerald-600' 
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}</span>
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
