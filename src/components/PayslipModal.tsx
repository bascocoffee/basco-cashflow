import React, { useState } from 'react';
import { PayslipData, SalaryAdjustment } from '../types';
import { 
  X, 
  Download, 
  Share2, 
  Printer, 
  Check, 
  Award, 
  Calendar, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  Sparkles, 
  ShieldCheck, 
  Edit3, 
  User, 
  Receipt,
  FileCheck,
  Building,
  Coffee
} from 'lucide-react';
import { generatePayslipImage } from '../utils/baristaScheduleData';

interface PayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payslip: PayslipData | null;
  onUpdateAdjustment?: (baristaId: string, periodMonth: string, adjustment: SalaryAdjustment) => void;
}

export default function PayslipModal({
  isOpen,
  onClose,
  payslip,
  onUpdateAdjustment
}: PayslipModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isEditingAdjustment, setIsEditingAdjustment] = useState(false);

  // Local state for adjustments
  const [bonus, setBonus] = useState<string>(() => payslip ? String(payslip.bonus || '') : '');
  const [bonusNotes, setBonusNotes] = useState<string>(() => payslip?.bonusNotes || '');
  const [overtimeHours, setOvertimeHours] = useState<string>(() => payslip ? String(payslip.totalOvertimeHours || '') : '');
  const [deductions, setDeductions] = useState<string>(() => payslip ? String(payslip.deductions || '') : '');
  const [deductionNotes, setDeductionNotes] = useState<string>(() => payslip?.deductionNotes || '');

  // Reset when payslip changes
  React.useEffect(() => {
    if (payslip) {
      setBonus(payslip.bonus ? String(payslip.bonus) : '');
      setBonusNotes(payslip.bonusNotes || '');
      setOvertimeHours(payslip.totalOvertimeHours ? String(payslip.totalOvertimeHours) : '');
      setDeductions(payslip.deductions ? String(payslip.deductions) : '');
      setDeductionNotes(payslip.deductionNotes || '');
      setIsEditingAdjustment(false);
    }
  }, [payslip]);

  if (!isOpen || !payslip) return null;

  const handleDownloadImage = async () => {
    try {
      setIsExporting(true);
      const dataUrl = await generatePayslipImage(payslip);
      const link = document.createElement('a');
      const filename = `Slip_Gaji_${payslip.baristaName.replace(/\s+/g, '_')}_${payslip.periodMonth}.png`;
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate payslip image:', err);
      alert('Gagal membuat gambar slip gaji. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyWhatsApp = () => {
    const text = `*☕ BASCO COFFEE - SLIP GAJI KARYAWAN*
Periode: ${payslip.periodLabel}
No Slip: ${payslip.slipNumber}
----------------------------------------
*Data Karyawan:*
• Nama: ${payslip.baristaName} (${payslip.baristaNickname || ''})
• Jabatan: ${payslip.role}
• Tgl Masuk: ${payslip.joinDate}
• Masa Kerja: ${payslip.serviceDurationText}
• Kehadiran: ${payslip.totalDaysPresent} Shift (${payslip.totalHoursWorked} Jam)
----------------------------------------
*Penerimaan (Earnings):*
+ Gaji Pokok: Rp ${payslip.baseSalary.toLocaleString('id-ID')}
+ Tunjangan Jabatan: Rp ${payslip.positionAllowance.toLocaleString('id-ID')}
+ Kenaikan Masa Kerja: Rp ${payslip.annualIncreaseAmount.toLocaleString('id-ID')}
+ Uang Kehadiran/Makan: Rp ${payslip.attendanceAllowance.toLocaleString('id-ID')} (${payslip.totalDaysPresent}x)
+ Upah Lembur: Rp ${payslip.overtimePay.toLocaleString('id-ID')}
+ Bonus/Insentif: Rp ${payslip.bonus.toLocaleString('id-ID')} ${payslip.bonusNotes ? `(${payslip.bonusNotes})` : ''}
*Total Penghasilan: Rp ${payslip.totalEarnings.toLocaleString('id-ID')}*

*Potongan (Deductions):*
- Kasbon / Lainnya: Rp ${payslip.deductions.toLocaleString('id-ID')} ${payslip.deductionNotes ? `(${payslip.deductionNotes})` : ''}
*Total Potongan: Rp ${payslip.totalDeductions.toLocaleString('id-ID')}*
----------------------------------------
*💵 GAJI BERSIH (TAKE HOME PAY):*
*Rp ${payslip.netSalary.toLocaleString('id-ID')}*
_(${payslip.terbilangText})_
----------------------------------------
_Terima kasih atas dedikasi dan kerja keras terbaik untuk Basco Coffee!_`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    });
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateAdjustment) return;

    const parsedBonus = bonus ? Number(bonus.replace(/[^0-9]/g, '')) : 0;
    const parsedDeductions = deductions ? Number(deductions.replace(/[^0-9]/g, '')) : 0;
    const parsedOvertime = overtimeHours ? Number(overtimeHours) : 0;

    onUpdateAdjustment(payslip.baristaId, payslip.periodMonth, {
      bonus: isNaN(parsedBonus) ? 0 : parsedBonus,
      bonusNotes: bonusNotes.trim(),
      deductions: isNaN(parsedDeductions) ? 0 : parsedDeductions,
      deductionNotes: deductionNotes.trim(),
      overtimeHours: isNaN(parsedOvertime) ? 0 : parsedOvertime
    });

    setIsEditingAdjustment(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header Action Bar */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight flex items-center space-x-2">
                <span>Slip Gaji Resmi: {payslip.baristaName}</span>
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono font-bold">
                  {payslip.periodLabel}
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-400 font-mono">
                No. Ref: {payslip.slipNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsEditingAdjustment(!isEditingAdjustment)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                isEditingAdjustment ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Sesuaikan Bonus & Potongan"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{isEditingAdjustment ? 'Tutup Penyesuaian' : 'Bonus / Kasbon'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
              title="Salin ringkasan format WhatsApp"
            >
              {copiedToast ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copiedToast ? 'Tersalin!' : 'Salin WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-md disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExporting ? 'Membuat Gambar...' : 'Download Gambar (PNG)'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Edit Adjustment Form (Collapsible) */}
        {isEditingAdjustment && (
          <form onSubmit={handleSaveAdjustment} className="p-4 bg-amber-50/90 border-b border-amber-200 animate-fade-in shrink-0">
            <div className="text-xs font-black text-amber-950 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-700" />
              <span>Penyesuaian Bonus & Potongan Bulan Ini</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block">Bonus / Insentif (Rp)</label>
                <input
                  type="number"
                  min="0"
                  step="25000"
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block">Keterangan Bonus</label>
                <input
                  type="text"
                  value={bonusNotes}
                  onChange={(e) => setBonusNotes(e.target.value)}
                  placeholder="Cth: Insentif omset target"
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block">Potongan / Kasbon (Rp)</label>
                <input
                  type="number"
                  min="0"
                  step="25000"
                  value={deductions}
                  onChange={(e) => setDeductions(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block">Keterangan Potongan</label>
                <input
                  type="text"
                  value={deductionNotes}
                  onChange={(e) => setDeductionNotes(e.target.value)}
                  placeholder="Cth: Kasbon minggu ke-2"
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-800"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-3">
              <button
                type="button"
                onClick={() => setIsEditingAdjustment(false)}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Simpan & Hitung Ulang
              </button>
            </div>
          </form>
        )}

        {/* Payslip Document Preview Container */}
        <div className="p-6 overflow-y-auto flex-grow flex justify-center bg-slate-200/60">
          
          <div className="bg-white rounded-2xl border border-slate-300 shadow-xl w-full max-w-2xl p-6 sm:p-8 space-y-6 text-slate-800 relative">
            
            {/* Header Document */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b-2 border-slate-900 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-amber-950 text-white flex items-center justify-center font-black shadow-md">
                  <Coffee className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950">
                    BASCO COFFEE
                  </h1>
                  <p className="text-xs font-black uppercase tracking-wider text-amber-600">
                    Slip Gaji Resmi Karyawan & Barista
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Cafe & Roastery Management System
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right space-y-0.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-xs font-black text-slate-900 uppercase">
                  Periode: <span className="text-amber-700">{payslip.periodLabel}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-600 font-bold">
                  No: {payslip.slipNumber}
                </div>
                <div className="text-[10px] text-slate-400">
                  Tgl Cetak: {payslip.generationDate}
                </div>
              </div>
            </div>

            {/* Employee Information Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                  Nama Karyawan
                </span>
                <span className="text-sm font-black text-slate-900 block">
                  {payslip.baristaName}
                </span>
                <span className="text-xs font-bold text-sky-700 inline-block mt-0.5 px-2 py-0.5 bg-sky-50 rounded-md border border-sky-200">
                  {payslip.role}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                  Tanggal Mulai Kerja
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 block">
                  {payslip.joinDate}
                </span>
                <div className="mt-1 flex items-center space-x-1 text-xs font-bold text-amber-800">
                  <Award className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Masa Kerja: {payslip.serviceDurationText}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                  Rekap Kehadiran Shift
                </span>
                <span className="text-xs font-black text-emerald-800 block">
                  {payslip.totalDaysPresent} Hari Masuk ({payslip.totalHoursWorked} Jam)
                </span>
                <span className="text-[10.5px] text-slate-600 block mt-0.5">
                  {payslip.totalOvertimeHours}j Lembur • {payslip.totalDaysOff} Libur • {payslip.totalLeaveDays} Izin
                </span>
              </div>
            </div>

            {/* Side-by-Side Breakdown: Earnings vs Deductions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* PENGHASILAN (EARNINGS) */}
              <div className="border border-emerald-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-emerald-700 text-white px-4 py-2.5 text-xs font-black tracking-wider uppercase flex items-center justify-between">
                  <span>PENGHASILAN (EARNINGS)</span>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-200" />
                </div>
                <div className="p-3.5 space-y-2.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">Gaji Pokok Jabatan</span>
                      <span className="text-[10px] text-slate-500">Standar posisi {payslip.role}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      Rp {payslip.baseSalary.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">Tunjangan Jabatan</span>
                      <span className="text-[10px] text-slate-500">Tunjangan struktural & tugas</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      Rp {payslip.positionAllowance.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">Kenaikan Masa Kerja</span>
                      <span className="text-[10px] text-amber-700 font-semibold">
                        {payslip.yearsOfService > 0 ? `${payslip.yearsOfService} Tahun Pengabdian` : 'Belum 1 tahun'}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      Rp {payslip.annualIncreaseAmount.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">Uang Kehadiran & Makan</span>
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        {payslip.totalDaysPresent} Hari Masuk Harian
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      Rp {payslip.attendanceAllowance.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">Upah Lembur</span>
                      <span className="text-[10px] text-slate-500">{payslip.totalOvertimeHours} Jam shift tambahan</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      Rp {payslip.overtimePay.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">Bonus & Insentif</span>
                      <span className="text-[10px] text-slate-500">{payslip.bonusNotes || 'Performa tim'}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      Rp {payslip.bonus.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-50 px-4 py-2.5 border-t border-emerald-200 flex justify-between items-center text-xs font-black text-emerald-950">
                  <span>TOTAL PENGHASILAN</span>
                  <span className="font-mono text-sm text-emerald-800">
                    Rp {payslip.totalEarnings.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* POTONGAN (DEDUCTIONS) */}
              <div className="border border-rose-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
                <div>
                  <div className="bg-rose-800 text-white px-4 py-2.5 text-xs font-black tracking-wider uppercase flex items-center justify-between">
                    <span>POTONGAN (DEDUCTIONS)</span>
                    <DollarSign className="h-3.5 w-3.5 text-rose-200" />
                  </div>
                  <div className="p-3.5 space-y-2.5 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-800 block">Potongan Kasbon / Pinjaman</span>
                        <span className="text-[10px] text-slate-500">{payslip.deductionNotes || 'Kasbon staf'}</span>
                      </div>
                      <span className="font-mono font-bold text-rose-700">
                        Rp {payslip.deductions.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-800 block">Potongan Keterlambatan / Izin</span>
                        <span className="text-[10px] text-slate-500">Penyesuaian absensi</span>
                      </div>
                      <span className="font-mono font-bold text-slate-400">
                        Rp 0
                      </span>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-800 block">BPJS / Jaminan Sosial</span>
                        <span className="text-[10px] text-slate-500">Iuran jaminan</span>
                      </div>
                      <span className="font-mono font-bold text-slate-400">
                        Rp 0
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-rose-50 px-4 py-2.5 border-t border-rose-200 flex justify-between items-center text-xs font-black text-rose-950">
                  <span>TOTAL POTONGAN</span>
                  <span className="font-mono text-sm text-rose-800">
                    Rp {payslip.totalDeductions.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

            </div>

            {/* Grand Total: Take Home Pay */}
            <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 rounded-2xl text-white shadow-lg border-2 border-amber-500/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                  GAJI BERSIH DITERIMA (TAKE HOME PAY)
                </span>
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                  Rp {payslip.netSalary.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="text-left sm:text-right max-w-sm">
                <span className="text-[10.5px] font-bold text-slate-400 block">
                  Terbilang:
                </span>
                <span className="text-xs font-bold italic text-amber-200 leading-snug block">
                  "{payslip.terbilangText}"
                </span>
              </div>
            </div>

            {/* Signature Columns */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center">
              <div className="space-y-12">
                <span className="text-xs font-extrabold text-slate-700 block">
                  Diterima Oleh,
                </span>
                <div>
                  <span className="text-xs font-black text-slate-950 block underline decoration-slate-400 underline-offset-4">
                    {payslip.baristaName}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {payslip.role}
                  </span>
                </div>
              </div>

              <div className="space-y-12">
                <span className="text-xs font-extrabold text-slate-700 block">
                  Disetujui / Manajemen,
                </span>
                <div>
                  <span className="text-xs font-black text-slate-950 block underline decoration-slate-400 underline-offset-4">
                    Basco Coffee Roastery
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Store Manager / Owner
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Footer Note */}
            <div className="pt-2 text-center text-[10px] text-slate-400">
              Slip gaji ini digenerate otomatis berdasarkan pencatatan jadwal harian & struktur jabatan Basco Coffee.
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
