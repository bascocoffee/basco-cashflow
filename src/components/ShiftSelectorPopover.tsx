import { useState } from 'react';
import { ShiftMaster, ShiftScheduleStatus, BaristaScheduleEntry } from '../types';
import { Clock, Check, X, Settings2, Trash2, ShieldAlert } from 'lucide-react';
import { COLOR_THEMES, calculateDurationHours } from '../utils/baristaScheduleData';

interface ShiftSelectorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  baristaName: string;
  dateStr: string; // e.g. "Senin, 26 Ags 2026"
  currentEntry?: BaristaScheduleEntry | null;
  shifts: ShiftMaster[];
  onSelectShift: (shiftId: string, status: ShiftScheduleStatus, customStart?: string, customEnd?: string, notes?: string) => void;
  onDeleteEntry: () => void;
  onOpenShiftMaster: () => void;
}

const STATUS_OPTIONS: { id: ShiftScheduleStatus; label: string; bg: string }[] = [
  { id: 'scheduled', label: 'Terjadwal', bg: 'bg-blue-100 text-blue-800' },
  { id: 'hadir', label: 'Hadir', bg: 'bg-emerald-100 text-emerald-800' },
  { id: 'libur', label: 'Libur (OFF)', bg: 'bg-slate-100 text-slate-700' },
  { id: 'izin', label: 'Izin', bg: 'bg-amber-100 text-amber-800' },
  { id: 'sakit', label: 'Sakit', bg: 'bg-rose-100 text-rose-800' },
  { id: 'lembur', label: 'Lembur', bg: 'bg-purple-100 text-purple-800' },
];

export default function ShiftSelectorPopover({
  isOpen,
  onClose,
  baristaName,
  dateStr,
  currentEntry,
  shifts,
  onSelectShift,
  onDeleteEntry,
  onOpenShiftMaster
}: ShiftSelectorPopoverProps) {
  const [selectedShiftId, setSelectedShiftId] = useState<string>(
    currentEntry?.shiftId || (shifts[0]?.id || '')
  );
  const [status, setStatus] = useState<ShiftScheduleStatus>(
    currentEntry?.status || 'scheduled'
  );
  const [useCustomTime, setUseCustomTime] = useState<boolean>(
    Boolean(currentEntry?.customStartTime || currentEntry?.customEndTime)
  );
  const [customStart, setCustomStart] = useState<string>(
    currentEntry?.customStartTime || '08:00'
  );
  const [customEnd, setCustomEnd] = useState<string>(
    currentEntry?.customEndTime || '16:00'
  );
  const [notes, setNotes] = useState<string>(currentEntry?.notes || '');

  if (!isOpen) return null;

  const handleSave = (shiftIdToSave?: string) => {
    const targetShiftId = shiftIdToSave || selectedShiftId;
    const chosenShift = shifts.find(s => s.id === targetShiftId);
    
    let finalStatus = status;
    if (chosenShift?.isOff && status === 'scheduled') {
      finalStatus = 'libur';
    }

    onSelectShift(
      targetShiftId,
      finalStatus,
      useCustomTime ? customStart : undefined,
      useCustomTime ? customEnd : undefined,
      notes.trim() || undefined
    );
    onClose();
  };

  const handleQuickSelect = (shift: ShiftMaster) => {
    setSelectedShiftId(shift.id);
    let newStatus = status;
    if (shift.isOff) {
      newStatus = 'libur';
    } else if (newStatus === 'libur') {
      newStatus = 'scheduled';
    }
    
    onSelectShift(
      shift.id,
      newStatus,
      useCustomTime ? customStart : undefined,
      useCustomTime ? customEnd : undefined,
      notes.trim() || undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider">{baristaName}</span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs text-slate-300 font-medium">{dateStr}</span>
            </div>
            <h3 className="text-sm font-black mt-0.5">Pilih / Sesuaikan Jam Shift</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-grow">
          
          {/* Shift Options Dropdown / Clickable Cards */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700">
                Pilihan Jam Shift Bar
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShiftMaster();
                }}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1 hover:underline"
              >
                <Settings2 className="h-3 w-3" />
                <span>Edit Master Jam Shift</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {shifts.map((shift) => {
                const theme = COLOR_THEMES[shift.color] || COLOR_THEMES.emerald;
                const isSelected = selectedShiftId === shift.id;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => handleQuickSelect(shift)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${
                      isSelected
                        ? `${theme.lightBg} ${theme.border} ring-2 ring-amber-500 shadow-xs`
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider ${theme.badge}`}>
                        {shift.shortCode}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{shift.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono font-medium">
                          {shift.isOff ? 'Libur / Tidak Masuk' : `${shift.startTime} - ${shift.endTime} (${shift.durationHours} Jam)`}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Kehadiran Shift */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700 block">
              Status Shift
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {STATUS_OPTIONS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatus(st.id)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border text-center ${
                    status === st.id
                      ? `${st.bg} border-current ring-1 ring-offset-1`
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Time Override (Optional) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomTime}
                  onChange={(e) => setUseCustomTime(e.target.checked)}
                  className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  Custom Jam Kerja Khusus (Override)
                </span>
              </label>
            </div>

            {useCustomTime && (
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 animate-fade-in">
                <div>
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase">Mulai</span>
                  <input
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase">Selesai</span>
                  <input
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>
                <div className="text-center flex flex-col justify-center">
                  <span className="text-[9px] text-slate-400 font-semibold">Total</span>
                  <span className="text-xs font-mono font-black text-slate-800">
                    {calculateDurationHours(customStart, customEnd)} Jam
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Catatan Shift */}
          <div className="space-y-1">
            <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700">
              Catatan / Pesan Shift (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Tukar shift, bantu event acoustic..."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {currentEntry ? (
            <button
              type="button"
              onClick={() => {
                onDeleteEntry();
                onClose();
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center space-x-1 py-1.5 px-2 hover:bg-rose-50 rounded-lg transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus Slot</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Terapkan</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
