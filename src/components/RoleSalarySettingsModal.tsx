import React, { useState } from 'react';
import { RoleSalaryStandard, BaristaRole } from '../types';
import { X, CheckCircle2, RotateCcw, ShieldCheck, Sparkles, Wallet, Award, DollarSign } from 'lucide-react';
import { DEFAULT_ROLE_SALARIES } from '../utils/baristaScheduleData';

interface RoleSalarySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleStandards: RoleSalaryStandard[];
  onSaveStandards: (standards: RoleSalaryStandard[]) => void;
}

export default function RoleSalarySettingsModal({
  isOpen,
  onClose,
  roleStandards,
  onSaveStandards
}: RoleSalarySettingsModalProps) {
  const [standards, setStandards] = useState<RoleSalaryStandard[]>(roleStandards);

  React.useEffect(() => {
    setStandards(roleStandards);
  }, [roleStandards, isOpen]);

  if (!isOpen) return null;

  const handleFieldChange = (role: BaristaRole, field: keyof RoleSalaryStandard, value: any) => {
    setStandards(prev => prev.map(s => {
      if (s.role === role) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset semua standar gaji ke pengaturan awal default Basco Coffee?')) {
      setStandards(DEFAULT_ROLE_SALARIES);
    }
  };

  const handleSave = () => {
    onSaveStandards(standards);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center space-x-2">
                <span>Master Standar Gaji per Jabatan</span>
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded-md border border-amber-500/30">
                  Basco Coffee
                </span>
              </h3>
              <p className="text-[11px] text-amber-200/80 font-medium">
                Atur nominal gaji pokok, tunjangan jabatan, uang kehadiran & kenaikan tahunan per role
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
              title="Reset ke pengaturan default"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Default</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-grow bg-slate-50/50">
          <div className="grid grid-cols-1 gap-4">
            {standards.map((std) => (
              <div 
                key={std.role}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-amber-300 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h4 className="text-sm font-black text-slate-900">{std.role}</h4>
                    <span className="text-[10.5px] text-slate-400 font-medium hidden sm:inline">• {std.description}</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Posisi Barista Basco Coffee
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Gaji Pokok */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Gaji Pokok / Bulan
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={std.baseSalary}
                        onChange={(e) => handleFieldChange(std.role, 'baseSalary', Number(e.target.value) || 0)}
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Tunjangan Jabatan */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Tunjangan Jabatan / Bln
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        step="25000"
                        value={std.positionAllowance}
                        onChange={(e) => handleFieldChange(std.role, 'positionAllowance', Number(e.target.value) || 0)}
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Uang Hadir / Makan Harian */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Uang Hadir / Shift Masuk
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={std.dailyAllowance}
                        onChange={(e) => handleFieldChange(std.role, 'dailyAllowance', Number(e.target.value) || 0)}
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Kenaikan Gaji per Tahun Masa Kerja */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Kenaikan Gaji / Thn Kerja
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        step="25000"
                        value={std.annualIncreaseValue}
                        onChange={(e) => handleFieldChange(std.role, 'annualIncreaseValue', Number(e.target.value) || 0)}
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Simpan Standar Gaji</span>
          </button>
        </div>

      </div>
    </div>
  );
}
