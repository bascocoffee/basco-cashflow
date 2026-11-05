import { useState } from 'react';
import { ShiftMaster } from '../types';
import { Clock, Plus, Trash2, Edit3, Check, X, RotateCcw, Sparkles } from 'lucide-react';
import { calculateDurationHours, COLOR_THEMES, DEFAULT_SHIFTS } from '../utils/baristaScheduleData';

interface ShiftMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts: ShiftMaster[];
  onSaveShifts: (updatedShifts: ShiftMaster[]) => void;
}

const COLOR_OPTIONS = [
  { id: 'emerald', label: 'Hijau (Pagi/Opening)' },
  { id: 'sky', label: 'Biru (Middle)' },
  { id: 'amber', label: 'Kuning/Emas (Sore/Closing)' },
  { id: 'violet', label: 'Ungu (Malam/Night)' },
  { id: 'indigo', label: 'Indigo (Split Shift)' },
  { id: 'rose', label: 'Merah Muda' },
  { id: 'teal', label: 'Toska' },
  { id: 'orange', label: 'Oranye' },
  { id: 'slate', label: 'Abu-abu (Libur/Off)' },
];

export default function ShiftMasterModal({
  isOpen,
  onClose,
  shifts,
  onSaveShifts
}: ShiftMasterModalProps) {
  const [shiftList, setShiftList] = useState<ShiftMaster[]>(shifts);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  // Editing state
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [color, setColor] = useState('emerald');
  const [isOff, setIsOff] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // New shift creation form visibility
  const [isAddingNew, setIsAddingNew] = useState(false);

  if (!isOpen) return null;

  const startEdit = (shift: ShiftMaster) => {
    setEditingShiftId(shift.id);
    setName(shift.name);
    setShortCode(shift.shortCode);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setColor(shift.color || 'emerald');
    setIsOff(Boolean(shift.isOff));
    setDescription(shift.description || '');
    setIsAddingNew(false);
    setError(null);
  };

  const startAddNew = () => {
    setIsAddingNew(true);
    setEditingShiftId(null);
    setName('');
    setShortCode('');
    setStartTime('08:00');
    setEndTime('16:00');
    setColor('sky');
    setIsOff(false);
    setDescription('');
    setError(null);
  };

  const cancelEditOrAdd = () => {
    setEditingShiftId(null);
    setIsAddingNew(false);
    setError(null);
  };

  const saveShiftItem = () => {
    if (!name.trim()) {
      setError('Nama shift wajib diisi.');
      return;
    }
    if (!shortCode.trim()) {
      setError('Kode singkat (contoh: PAGI, MID, SORE) wajib diisi.');
      return;
    }

    const duration = isOff ? 0 : calculateDurationHours(startTime, endTime);

    if (isAddingNew) {
      const newShift: ShiftMaster = {
        id: `shift-custom-${Date.now()}`,
        name: name.trim(),
        shortCode: shortCode.trim().toUpperCase(),
        startTime: isOff ? '00:00' : startTime,
        endTime: isOff ? '00:00' : endTime,
        durationHours: duration,
        color,
        isOff,
        description: description.trim()
      };
      const updated = [...shiftList, newShift];
      setShiftList(updated);
      onSaveShifts(updated);
      setIsAddingNew(false);
    } else if (editingShiftId) {
      const updated = shiftList.map(s => {
        if (s.id === editingShiftId) {
          return {
            ...s,
            name: name.trim(),
            shortCode: shortCode.trim().toUpperCase(),
            startTime: isOff ? '00:00' : startTime,
            endTime: isOff ? '00:00' : endTime,
            durationHours: duration,
            color,
            isOff,
            description: description.trim()
          };
        }
        return s;
      });
      setShiftList(updated);
      onSaveShifts(updated);
      setEditingShiftId(null);
    }
  };

  const deleteShiftItem = (id: string, sName: string) => {
    if (shiftList.length <= 1) {
      alert('Minimal harus ada 1 shift dalam master data.');
      return;
    }
    if (window.confirm(`Hapus jam shift "${sName}" dari daftar pilihan master?`)) {
      const updated = shiftList.filter(s => s.id !== id);
      setShiftList(updated);
      onSaveShifts(updated);
      if (editingShiftId === id) cancelEditOrAdd();
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Kembalikan master jam shift ke pengaturan standar cafe (Pagi, Middle, Sore, Malam, Split, Libur)?')) {
      setShiftList(DEFAULT_SHIFTS);
      onSaveShifts(DEFAULT_SHIFTS);
      cancelEditOrAdd();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-900 flex items-center justify-center font-black">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                Master Jam Shift Bar Cafe
              </h3>
              <p className="text-[11px] text-amber-200/80 font-medium">
                Sesuaikan jam operasional bar, durasi kerja, dan warna dropdown shift
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

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-grow">
          
          {/* Top Actions: Add New Shift & Reset Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={startAddNew}
                disabled={isAddingNew}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Shift Baru</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center space-x-1 px-2.5 py-1.5 hover:bg-slate-100 rounded-lg transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Standar Cafe</span>
            </button>
          </div>

          {/* Form Editor (When adding or editing) */}
          {(isAddingNew || editingShiftId) && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3.5 animate-fade-in shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center space-x-1.5">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>{isAddingNew ? 'Formulir Shift Baru' : 'Edit Jam Shift Bar'}</span>
                </span>
                <button
                  onClick={cancelEditOrAdd}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {error && (
                <div className="p-2 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                    Nama Shift <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!shortCode && e.target.value) {
                        setShortCode(e.target.value.substring(0, 4).toUpperCase());
                      }
                    }}
                    placeholder="Contoh: Shift Pagi (Opening)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                    Kode Singkat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                    placeholder="PAGI"
                    maxLength={6}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-black text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Toggle Libur / OFF */}
              <div className="flex items-center space-x-2 py-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOff}
                    onChange={(e) => setIsOff(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Ini adalah opsi Libur / Day Off (Tanpa jam kerja)
                  </span>
                </label>
              </div>

              {/* Jam Mulai, Selesai, & Kalkulasi Durasi */}
              {!isOff && (
                <div className="grid grid-cols-3 gap-3 items-center bg-white p-3 rounded-xl border border-amber-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Jam Selesai
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1 text-center bg-amber-50 py-1.5 px-2 rounded-lg border border-amber-200/60">
                    <label className="text-[9.5px] font-bold text-amber-800 block">
                      Durasi Kerja
                    </label>
                    <span className="text-xs font-mono font-black text-amber-950">
                      {calculateDurationHours(startTime, endTime)} Jam
                    </span>
                  </div>
                </div>
              )}

              {/* Warna & Deskripsi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                    Warna Tema Shift
                  </label>
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {COLOR_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                    Keterangan Singkat
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contoh: Kalibrasi espresso, prep ice"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Actions for Form */}
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={cancelEditOrAdd}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={saveShiftItem}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center space-x-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Simpan Shift</span>
                </button>
              </div>
            </div>
          )}

          {/* List of Existing Shifts */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Daftar Jam Shift Aktif ({shiftList.length})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shiftList.map((shift) => {
                const theme = COLOR_THEMES[shift.color] || COLOR_THEMES.emerald;
                const isSelected = editingShiftId === shift.id;
                return (
                  <div
                    key={shift.id}
                    className={`p-3.5 rounded-2xl border transition flex flex-col justify-between ${
                      isSelected 
                        ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-2 ring-amber-500' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${theme.badge}`}>
                            {shift.shortCode}
                          </span>
                          <h5 className="text-xs font-bold text-slate-900">{shift.name}</h5>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => startEdit(shift)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                            title="Edit jam shift"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteShiftItem(shift.id, shift.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                            title="Hapus shift"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center space-x-2 text-xs font-mono font-bold text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {shift.isOff ? (
                          <span className="text-slate-500 font-sans font-bold">Hari Libur (0 Jam)</span>
                        ) : (
                          <span>{shift.startTime} - {shift.endTime} ({shift.durationHours} Jam)</span>
                        )}
                      </div>

                      {shift.description && (
                        <p className="mt-1.5 text-[11px] text-slate-500 font-medium line-clamp-2">
                          {shift.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
}
