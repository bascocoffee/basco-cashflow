import { useState, useRef, ChangeEvent } from 'react';
import { 
  Download, 
  Upload, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  FileJson, 
  RefreshCw, 
  ShieldCheck, 
  X, 
  Sparkles,
  Layers,
  Users,
  Clock,
  Coffee,
  Coins,
  Calendar
} from 'lucide-react';
import { 
  collectAllAppData, 
  downloadJsonFile, 
  parseAndValidateBackupJson, 
  restoreAllAppData, 
  RestoreSummary 
} from '../utils/backupRestore';
import { Transaction } from '../types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  categories?: string[];
  onRestoreSuccess?: () => void;
}

export default function BackupRestoreModal({
  isOpen,
  onClose,
  transactions,
  categories,
  onRestoreSuccess
}: BackupRestoreModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'export' | 'import'>('export');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportBackup = () => {
    setIsExporting(true);
    try {
      const fullData = collectAllAppData(transactions, categories);
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const timeKey = `${now.getHours()}${now.getMinutes()}`;
      const filename = `backup_basco_cafe_${dateKey}_${timeKey}.json`;

      downloadJsonFile(filename, fullData);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err: any) {
      alert("Gagal melakukan export JSON: " + (err?.message || "Error tidak diketahui"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setImportError('File harus berekstensi .json');
      setUploadedFile(null);
      setParsedData(null);
      setRestoreSummary(null);
      return;
    }

    setUploadedFile(file);
    setImportError(null);
    setRestoreSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const { data, summary } = parseAndValidateBackupJson(content);
      if (!summary.isValid || !data) {
        setImportError(summary.errorMessage || 'Format file JSON tidak valid.');
        setParsedData(null);
        setRestoreSummary(null);
      } else {
        setParsedData(data);
        setRestoreSummary(summary);
      }
    };
    reader.onerror = () => {
      setImportError('Gagal membaca file dari perangkat Anda.');
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = () => {
    if (!parsedData) return;

    const confirmMsg = "Apakah Anda yakin ingin memulihkan data dari file JSON ini? Data pada aplikasi (Transaksi, Jadwal Barista, Shift, COGS) akan diperbarui sesuai file cadangan.";
    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setTimeout(() => {
      const ok = restoreAllAppData(parsedData);
      setIsRestoring(false);
      if (ok) {
        setRestoreSuccess(true);
        if (onRestoreSuccess) {
          onRestoreSuccess();
        }
        setTimeout(() => {
          onClose();
          // Reload to sync all modules cleanly
          window.location.reload();
        }, 1200);
      } else {
        setImportError("Gagal memulihkan data ke sistem lokal.");
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center space-x-2">
                <span>Backup & Restore JSON Data</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Semua Modul
                </span>
              </h3>
              <p className="text-[11px] text-amber-200/80 font-medium">
                Cadangkan dan pulihkan seluruh data transaksi, barista, jam shift, & resep cafe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection: Export vs Import */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('export')}
            className={`pb-2.5 px-4 font-extrabold text-xs uppercase tracking-wider border-b-2 transition flex items-center space-x-2 ${
              activeSubTab === 'export'
                ? 'border-amber-600 text-amber-950 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="h-4 w-4 text-amber-600" />
            <span>1. Export Cadangan JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('import')}
            className={`pb-2.5 px-4 font-extrabold text-xs uppercase tracking-wider border-b-2 transition flex items-center space-x-2 ${
              activeSubTab === 'import'
                ? 'border-amber-600 text-amber-950 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="h-4 w-4 text-amber-600" />
            <span>2. Pulihkan / Import JSON</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-grow">
          
          {/* EXPORT TAB */}
          {activeSubTab === 'export' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2.5">
                <div className="flex items-center space-x-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span>Cakupan Data yang Diekspor</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  File cadangan JSON akan menyimpan seluruh data aplikasi Anda dalam 1 file terenkapsulasi:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-amber-100">
                    <Users className="h-4 w-4 text-emerald-600" />
                    <span>Daftar Tim Barista & Profil</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-amber-100">
                    <Clock className="h-4 w-4 text-sky-600" />
                    <span>Master Jam Shift Bar & Jadwal</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-amber-100">
                    <Coins className="h-4 w-4 text-amber-600" />
                    <span>Transaksi Kas & Kategori</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-amber-100">
                    <Coffee className="h-4 w-4 text-rose-600" />
                    <span>Katalog COGS, Resep & Stok</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-amber-100 col-span-2">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <span>Catatan Kalender, Agenda Cafe & Pengingat H-1</span>
                  </div>
                </div>
              </div>

              {exportSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>File backup JSON berhasil diunduh ke perangkat Anda!</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleExportBackup}
                disabled={isExporting}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Menyiapkan File JSON...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download Backup Data (.json)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* IMPORT TAB */}
          {activeSubTab === 'import' && (
            <div className="space-y-4 animate-fade-in">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/70 hover:bg-amber-50/40 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition shadow-xs">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {uploadedFile ? uploadedFile.name : 'Klik untuk memilih file backup JSON'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Hanya file ekstensi .json yang didukung
                  </p>
                </div>
              </div>

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {restoreSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Data berhasil dipulihkan! Halaman akan dimuat ulang...</span>
                </div>
              )}

              {/* Summary of Parsed JSON */}
              {restoreSummary && restoreSummary.isValid && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center space-x-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span>Data Terdeteksi dalam File</span>
                    </span>
                    {restoreSummary.exportedAt && (
                      <span className="text-[10px] text-emerald-700 font-mono font-bold">
                        {new Date(restoreSummary.exportedAt).toLocaleDateString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-medium text-slate-700">
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Barista</span>
                      <span className="font-bold text-slate-900">{restoreSummary.baristasCount} Orang</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Jadwal Shift</span>
                      <span className="font-bold text-slate-900">{restoreSummary.schedulesCount} Entri</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Master Shift</span>
                      <span className="font-bold text-slate-900">{restoreSummary.shiftsCount} Jam Shift</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Transaksi Kas</span>
                      <span className="font-bold text-slate-900">{restoreSummary.transactionsCount} Baris</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Menu & Resep</span>
                      <span className="font-bold text-slate-900">{restoreSummary.menuCatalogCount} Menu</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Bahan Baku</span>
                      <span className="font-bold text-slate-900">{restoreSummary.ingredientsCount} Bahan</span>
                    </div>
                    {restoreSummary.calendarActivitiesCount !== undefined && restoreSummary.calendarActivitiesCount > 0 && (
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Catatan Kalender</span>
                        <span className="font-bold text-slate-900">{restoreSummary.calendarActivitiesCount} Agenda</span>
                      </div>
                    )}
                    {restoreSummary.debtsCount !== undefined && restoreSummary.debtsCount > 0 && (
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Catatan Hutang</span>
                        <span className="font-bold text-slate-900">{restoreSummary.debtsCount} Pos Hutang</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Memulihkan Data...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Pulihkan & Terapkan Data Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
