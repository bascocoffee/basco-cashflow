import { useState, useEffect, FormEvent } from 'react';
import { Barista, BaristaRole } from '../types';
import { User, Phone, Briefcase, Tag, Calendar, FileText, CheckCircle2, X, Sparkles, DollarSign, Wallet, TrendingUp, Clock, Award } from 'lucide-react';
import { COLOR_THEMES, DEFAULT_ROLE_SALARIES, calculateServiceDuration } from '../utils/baristaScheduleData';

interface BaristaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (barista: Barista) => void;
  editingBarista?: Barista | null;
}

const ROLES: BaristaRole[] = [
  'Head Barista',
  'Senior Barista',
  'Barista',
  'Junior Barista',
  'Cashier / Bar',
  'Part Time'
];

const COLOR_OPTIONS = [
  { id: 'emerald', label: 'Emerald Green', bg: 'bg-emerald-500' },
  { id: 'sky', label: 'Sky Blue', bg: 'bg-sky-500' },
  { id: 'amber', label: 'Amber Gold', bg: 'bg-amber-500' },
  { id: 'violet', label: 'Violet Purple', bg: 'bg-violet-500' },
  { id: 'rose', label: 'Rose Pink', bg: 'bg-rose-500' },
  { id: 'indigo', label: 'Indigo Navy', bg: 'bg-indigo-500' },
  { id: 'teal', label: 'Teal Cyan', bg: 'bg-teal-500' },
  { id: 'orange', label: 'Warm Orange', bg: 'bg-orange-500' },
];

export default function BaristaFormModal({
  isOpen,
  onClose,
  onSave,
  editingBarista
}: BaristaFormModalProps) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [role, setRole] = useState<BaristaRole>('Barista');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState('amber');
  const [isActive, setIsActive] = useState(true);
  const [joinDate, setJoinDate] = useState('');
  const [monthlySalary, setMonthlySalary] = useState<string>('');
  const [positionAllowance, setPositionAllowance] = useState<string>('');
  const [dailySalary, setDailySalary] = useState<string>('');
  const [annualIncreaseValue, setAnnualIncreaseValue] = useState<string>('');
  const [annualIncreaseType, setAnnualIncreaseType] = useState<'fixed' | 'percentage'>('fixed');
  const [overtimeRatePerHour, setOvertimeRatePerHour] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto fill standard when role changes if not editing or when requested
  const applyRoleStandard = (targetRole: BaristaRole) => {
    const std = DEFAULT_ROLE_SALARIES.find(r => r.role === targetRole);
    if (std) {
      setMonthlySalary(String(std.baseSalary));
      setPositionAllowance(String(std.positionAllowance));
      setDailySalary(String(std.dailyAllowance));
      setAnnualIncreaseValue(String(std.annualIncreaseValue));
      setAnnualIncreaseType(std.annualIncreaseType);
      setOvertimeRatePerHour(String(std.overtimeRatePerHour));
    }
  };

  useEffect(() => {
    if (editingBarista) {
      setName(editingBarista.name || '');
      setNickname(editingBarista.nickname || '');
      setRole(editingBarista.role || 'Barista');
      setPhone(editingBarista.phone || '');
      setColor(editingBarista.color || 'amber');
      setIsActive(editingBarista.isActive ?? true);
      setJoinDate(editingBarista.joinDate || '');
      setMonthlySalary(editingBarista.monthlySalary !== undefined ? String(editingBarista.monthlySalary) : '');
      setPositionAllowance(editingBarista.positionAllowance !== undefined ? String(editingBarista.positionAllowance) : '');
      setDailySalary(editingBarista.dailySalary !== undefined ? String(editingBarista.dailySalary) : '');
      setAnnualIncreaseValue(editingBarista.annualIncreaseValue !== undefined ? String(editingBarista.annualIncreaseValue) : '150000');
      setAnnualIncreaseType(editingBarista.annualIncreaseType || 'fixed');
      setOvertimeRatePerHour(editingBarista.overtimeRatePerHour !== undefined ? String(editingBarista.overtimeRatePerHour) : '20000');
      setNotes(editingBarista.notes || '');
    } else {
      setName('');
      setNickname('');
      setRole('Barista');
      setPhone('');
      setColor(COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].id);
      setIsActive(true);
      const today = new Date().toISOString().split('T')[0];
      setJoinDate(today);
      applyRoleStandard('Barista');
      setNotes('');
    }
    setError(null);
  }, [editingBarista, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama barista wajib diisi.');
      return;
    }

    const parsedMonthly = monthlySalary.trim() ? Number(monthlySalary.replace(/[^0-9]/g, '')) : 0;
    const parsedAllowance = positionAllowance.trim() ? Number(positionAllowance.replace(/[^0-9]/g, '')) : 0;
    const parsedDaily = dailySalary.trim() ? Number(dailySalary.replace(/[^0-9]/g, '')) : 0;
    const parsedAnnual = annualIncreaseValue.trim() ? Number(annualIncreaseValue.replace(/[^0-9]/g, '')) : 0;
    const parsedOvertime = overtimeRatePerHour.trim() ? Number(overtimeRatePerHour.replace(/[^0-9]/g, '')) : 0;

    const newBarista: Barista = {
      id: editingBarista?.id || `barista-${Date.now()}`,
      name: name.trim(),
      nickname: nickname.trim() || name.trim().split(' ')[0],
      role,
      phone: phone.trim(),
      color,
      isActive,
      joinDate: joinDate || new Date().toISOString().split('T')[0],
      monthlySalary: isNaN(parsedMonthly) ? 0 : parsedMonthly,
      positionAllowance: isNaN(parsedAllowance) ? 0 : parsedAllowance,
      dailySalary: isNaN(parsedDaily) ? 0 : parsedDaily,
      annualIncreaseType,
      annualIncreaseValue: isNaN(parsedAnnual) ? 0 : parsedAnnual,
      overtimeRatePerHour: isNaN(parsedOvertime) ? 0 : parsedOvertime,
      notes: notes.trim()
    };

    onSave(newBarista);
    onClose();
  };

  const currentTheme = COLOR_THEMES[color] || COLOR_THEMES.amber;
  const tenure = calculateServiceDuration(joinDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${currentTheme.bg} shadow-sm text-base`}>
              {nickname ? nickname.charAt(0).toUpperCase() : (name ? name.charAt(0).toUpperCase() : 'B')}
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center space-x-2">
                <span>{editingBarista ? 'Edit Profil Barista' : 'Tambah Barista Baru'}</span>
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded-md border border-amber-500/30">
                  Basco Coffee
                </span>
              </h3>
              <p className="text-[11px] text-amber-200/80 font-medium">
                Data personal, masa kerja, standar gaji jabatan, uang kehadiran & kenaikan tahunan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nama Lengkap & Panggilan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>Nama Lengkap <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!nickname && e.target.value) {
                    setNickname(e.target.value.split(' ')[0]);
                  }
                }}
                placeholder="Contoh: Dimas Pratama"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Panggilan</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Dimas"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>
          </div>

          {/* Role & No Telepon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                  <span>Jabatan / Role</span>
                </label>
                <button
                  type="button"
                  onClick={() => applyRoleStandard(role)}
                  className="text-[10px] text-amber-700 hover:text-amber-800 font-extrabold flex items-center space-x-1 cursor-pointer"
                  title="Gunakan standar gaji default untuk jabatan ini"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Auto-Isi Standar</span>
                </button>
              </div>
              <select
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value as BaristaRole;
                  setRole(newRole);
                  if (!editingBarista) {
                    applyRoleStandard(newRole);
                  }
                }}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>No. WhatsApp / HP</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812-xxxx-xxxx"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>
          </div>

          {/* Tanggal Bergabung / Mulai Kerja & Masa Kerja */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-amber-950 flex items-center space-x-1.5">
                <Calendar className="h-4 w-4 text-amber-700" />
                <span>Tanggal Mulai Kerja & Masa Kerja</span>
              </label>
              <div className="px-2.5 py-0.5 bg-amber-200/80 text-amber-900 font-extrabold text-[11px] rounded-full flex items-center space-x-1">
                <Award className="h-3 w-3" />
                <span>Masa Kerja: {tenure.text}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Tanggal Mulai Bekerja</label>
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Kenaikan Gaji per Tahun Masa Kerja</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="25000"
                    value={annualIncreaseValue}
                    onChange={(e) => setAnnualIncreaseValue(e.target.value)}
                    placeholder="150.000"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                </div>
                <p className="text-[9px] text-amber-800">
                  {tenure.years > 0 
                    ? `Mendapat kenaikan: Rp ${(Number(annualIncreaseValue || 0) * tenure.years).toLocaleString('id-ID')} (${tenure.years} tahun)`
                    : 'Kenaikan otomatis aktif setelah masa kerja ≥ 1 tahun'}
                </p>
              </div>
            </div>
          </div>

          {/* Gaji Bulanan, Tunjangan Jabatan & Uang Harian */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-slate-900 font-extrabold text-xs">
              <div className="flex items-center space-x-1.5">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span>Nominal Komponen Gaji ({role})</span>
              </div>
              <span className="text-[10px] text-slate-500">Terintegrasi otomatis dengan slip gaji</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Gaji Pokok */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Gaji Pokok Jabatan</span>
                  <span className="text-[10px] text-amber-700 font-bold">/ Bulan</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="2.800.000"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                </div>
              </div>

              {/* Tunjangan Jabatan */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Tunjangan Jabatan</span>
                  <span className="text-[10px] text-blue-700 font-bold">/ Bulan</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="25000"
                    value={positionAllowance}
                    onChange={(e) => setPositionAllowance(e.target.value)}
                    placeholder="150.000"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                </div>
              </div>

              {/* Uang Hadir / Makan Harian */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Uang Hadir / Makan</span>
                  <span className="text-[10px] text-emerald-700 font-bold">/ Shift Masuk</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={dailySalary}
                    onChange={(e) => setDailySalary(e.target.value)}
                    placeholder="20.000"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                </div>
                <p className="text-[9px] text-slate-500">Dikalikan total hari masuk dari jadwal</p>
              </div>

              {/* Upah Lembur per Jam */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Tarif Lembur</span>
                  <span className="text-[10px] text-violet-700 font-bold">/ Jam</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={overtimeRatePerHour}
                    onChange={(e) => setOvertimeRatePerHour(e.target.value)}
                    placeholder="20.000"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                </div>
                <p className="text-[9px] text-slate-500">Tarif per jam lembur shift tambahan</p>
              </div>
            </div>
          </div>

          {/* Pilihan Warna Badge / Avatar */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Warna Badge & Tag Barista</span>
              </span>
              <span className="text-[10px] text-slate-400 capitalize font-medium">{color}</span>
            </label>
            <div className="flex flex-wrap gap-2.5 pt-0.5">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setColor(opt.id)}
                  className={`w-7 h-7 rounded-full ${opt.bg} flex items-center justify-center transition cursor-pointer ${
                    color === opt.id ? 'ring-3 ring-offset-2 ring-slate-800 scale-110 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'
                  }`}
                  title={opt.label}
                >
                  {color === opt.id && <CheckCircle2 className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Status Aktif Barista */}
          <div className="space-y-1">
            <label className="flex items-center space-x-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className={`text-xs font-bold ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {isActive ? 'Barista Aktif (Tersedia dalam roster jadwal & penggajian)' : 'Status Nonaktif'}
                </span>
                <p className="text-[10px] text-slate-500">Barista aktif akan tampil pada matriks jadwal dan kalkulator slip gaji</p>
              </div>
            </label>
          </div>

          {/* Catatan / Keahlian Barista */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>Catatan / Keahlian Khusus</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Ahli manual brew V60, kalibrasi grinder, latte art..."
              rows={2}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{editingBarista ? 'Simpan Perubahan' : 'Tambah Barista'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

