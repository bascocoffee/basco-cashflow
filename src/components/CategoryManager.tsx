import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  AlertTriangle, 
  Tag 
} from 'lucide-react';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onAddCategory: (cat: string) => Promise<void>;
  onEditCategory: (oldCat: string, newCat: string) => Promise<void>;
  onDeleteCategory: (cat: string) => Promise<void>;
}

export default function CategoryManager({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory
}: CategoryManagerProps) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await onAddCategory(name);
      setNewCategoryName('');
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan kategori');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (index: number, value: string) => {
    setEditingIndex(index);
    setEditingValue(value);
    setError(null);
  };

  const handleSaveEdit = async (index: number, oldVal: string) => {
    const newVal = editingValue.trim();
    if (!newVal || newVal === oldVal) {
      setEditingIndex(null);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onEditCategory(oldVal, newVal);
      setEditingIndex(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui kategori');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (cat: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onDeleteCategory(cat);
      setConfirmDeleteCat(null);
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus kategori');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" id="category-manager-modal">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          {/* Dialog Container */}
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative transform overflow-hidden rounded bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-md border border-slate-200 z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-slate-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                    Kelola Kategori Keuangan
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  id="close-category-manager"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-150 rounded text-xs font-bold text-red-700">
                    {error}
                  </div>
                )}

                {/* Form to Add New Category */}
                <form onSubmit={handleAdd} className="space-y-2">
                  <label htmlFor="new-category-input" className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
                    Tambah Kategori Baru
                  </label>
                  <div className="flex space-x-2">
                    <input
                      id="new-category-input"
                      type="text"
                      placeholder="Contoh: Belanja Online"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      disabled={isSubmitting}
                      className="flex-grow block rounded border border-slate-200 py-1.5 px-3 text-xs text-slate-900 font-bold focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 placeholder-slate-350 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !newCategoryName.trim()}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-[10px] uppercase tracking-wider rounded flex items-center space-x-1 transition shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </form>

                {/* Categories List */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                    Daftar Kategori Saat Ini ({categories.length})
                  </p>
                  
                  <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-[240px] overflow-y-auto">
                    {categories.map((cat, index) => {
                      const isEditing = editingIndex === index;

                      return (
                        <div key={cat} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition text-xs">
                          {isEditing ? (
                            <div className="flex items-center space-x-2 w-full pr-1">
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="flex-grow block rounded border border-slate-250 py-1 px-2.5 text-xs text-slate-900 font-bold focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveEdit(index, cat)}
                                disabled={isSubmitting || !editingValue.trim()}
                                className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition border border-emerald-200"
                                title="Simpan"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingIndex(null)}
                                className="p-1 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 transition border border-slate-200"
                                title="Batal"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center space-x-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                <span className="font-bold text-slate-700">{cat}</span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <button
                                  onClick={() => handleStartEdit(index, cat)}
                                  className="p-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition"
                                  title="Edit Kategori"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteCat(cat)}
                                  className="p-1 rounded border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                                  title="Hapus Kategori"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Delete Confirmation Sub-panel */}
                {confirmDeleteCat && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-amber-50 border border-amber-200 rounded space-y-2.5"
                  >
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-amber-950 uppercase tracking-wide">Konfirmasi Hapus</p>
                        <p className="text-[10.5px] text-amber-800 font-medium leading-normal mt-0.5">
                          Menghapus kategori <strong className="font-extrabold text-amber-950">"{confirmDeleteCat}"</strong> akan memindahkan semua transaksi aktif dengan kategori ini ke kategori pertama yang tersedia.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setConfirmDeleteCat(null)}
                        className="px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => handleDelete(confirmDeleteCat)}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded transition"
                      >
                        Ya, Hapus
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded transition"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
