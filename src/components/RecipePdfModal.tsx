import React, { useState } from 'react';
import { MenuItem, RecipeIngredient, calculateRecipeItemCost, calculateMenuItemHppFromRecipe } from './CogsDailySalesPage';
import { downloadSingleRecipePDF, downloadAllRecipesPDF } from '../utils/recipePdfExport';
import { FileText, Download, Printer, X, Coffee, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface RecipePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMenu: MenuItem | null; // null if exporting all recipes
  menuItems: MenuItem[];
  ingredients: RecipeIngredient[];
  spreadsheetName?: string | null;
}

export default function RecipePdfModal({
  isOpen,
  onClose,
  selectedMenu,
  menuItems,
  ingredients,
  spreadsheetName
}: RecipePdfModalProps) {
  const [cafeName, setCafeName] = useState(() => {
    return spreadsheetName ? spreadsheetName.replace(/\.(xlsx|csv|gsheet)$/i, '') : 'KAFE & ROASTERY';
  });

  if (!isOpen) return null;

  const isAllExport = !selectedMenu;
  const currentMenu = selectedMenu || menuItems[0];

  const calcHpp = currentMenu ? calculateMenuItemHppFromRecipe(currentMenu, ingredients) : 0;
  const marginVal = currentMenu ? currentMenu.hargaJual - calcHpp : 0;
  const marginPct = currentMenu && currentMenu.hargaJual > 0 ? (marginVal / currentMenu.hargaJual) * 100 : 0;

  const handleDownloadPdf = () => {
    if (isAllExport) {
      downloadAllRecipesPDF(menuItems, ingredients, cafeName);
    } else if (selectedMenu) {
      downloadSingleRecipePDF(selectedMenu, ingredients, cafeName);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        
        {/* MODAL HEADER */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                {isAllExport ? 'Ekspor Katalog Buku Resep PDF (Semua Menu)' : `Ekspor Resep PDF: ${selectedMenu?.nama}`}
              </h3>
              <p className="text-[11px] text-slate-300">
                SOP standar resep & rincian HPP bahan baku kafe siap cetak/download
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL CONTROLS */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Nama Kafe / Usaha:</label>
            <input
              type="text"
              value={cafeName}
              onChange={(e) => setCafeName(e.target.value)}
              placeholder="Contoh: Kopi Senja & Roastery"
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-64"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
              title="Cetak via printer atau Simpan PDF browser"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print / Cetak</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download File PDF</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE PREVIEW SHEET */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1 space-y-6">
          <div className="bg-white rounded-xl border border-slate-300 shadow-md p-6 max-w-2xl mx-auto space-y-6 print:shadow-none print:border-none print:p-0">
            
            {/* BRANDING HEADER */}
            <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block">STANDARD OPERATING PROCEDURE (SOP)</span>
                <h2 className="text-lg font-black uppercase tracking-wide text-white">{cafeName}</h2>
                <p className="text-[11px] text-slate-300">Kartu Resep Standar & Kalkulasi HPP Bahan Baku</p>
              </div>
              <div className="text-right">
                <Coffee className="h-8 w-8 text-amber-400 ml-auto mb-1" />
                <span className="text-[9px] text-slate-400 block">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {/* PREVIEW CONTENT */}
            {isAllExport ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-xs font-semibold text-amber-950">
                    PDF akan mengompres seluruh <strong>{menuItems.length} menu</strong> beserta rincian resep lengkap dan kartu SOP ke dalam 1 file PDF ringkas.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                        <th className="py-2 px-3">Nama Menu</th>
                        <th className="py-2 px-3">Kategori</th>
                        <th className="py-2 px-3 text-right">Harga Jual</th>
                        <th className="py-2 px-3 text-right">HPP Resep</th>
                        <th className="py-2 px-3 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {menuItems.map(m => {
                        const hpp = calculateMenuItemHppFromRecipe(m, ingredients);
                        const margin = m.hargaJual - hpp;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-900">{m.nama}</td>
                            <td className="py-2 px-3 text-slate-500">{m.kategori}</td>
                            <td className="py-2 px-3 text-right font-mono">Rp {m.hargaJual.toLocaleString('id-ID')}</td>
                            <td className="py-2 px-3 text-right font-mono text-amber-900 font-bold">Rp {Math.round(hpp).toLocaleString('id-ID')}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">Rp {Math.round(margin).toLocaleString('id-ID')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : currentMenu ? (
              <div className="space-y-5">
                {/* MENU CARD */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-900 rounded border border-amber-200 inline-block mb-1">
                      {currentMenu.kategori}
                    </span>
                    <h3 className="text-base font-black text-slate-900">{currentMenu.nama}</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-right border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Harga Jual</span>
                      <strong className="text-xs font-mono font-black text-slate-900">Rp {currentMenu.hargaJual.toLocaleString('id-ID')}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">HPP Resep</span>
                      <strong className="text-xs font-mono font-black text-amber-900">Rp {Math.round(calcHpp).toLocaleString('id-ID')}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Margin Unit</span>
                      <strong className="text-xs font-mono font-black text-emerald-700">Rp {Math.round(marginVal).toLocaleString('id-ID')} ({marginPct.toFixed(0)}%)</strong>
                    </div>
                  </div>
                </div>

                {/* INGREDIENTS RECIPE TABLE */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2">
                    Komposisi & Takaran Bahan Baku
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                          <th className="py-2 px-3">No</th>
                          <th className="py-2 px-3">Bahan Baku</th>
                          <th className="py-2 px-3 text-center">Takaran Resep</th>
                          <th className="py-2 px-3 text-right">Harga Beli Master</th>
                          <th className="py-2 px-3 text-right">HPP Kontribusi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {(!currentMenu.recipe || currentMenu.recipe.length === 0) ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                              Belum ada bahan baku yang terhubung dengan resep menu ini.
                            </td>
                          </tr>
                        ) : (
                          currentMenu.recipe.map((r, idx) => {
                            const ing = ingredients.find(i => i.id === r.ingredientId);
                            const itemCost = ing ? calculateRecipeItemCost(ing, r.takaran) : 0;
                            return (
                              <tr key={r.ingredientId} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-bold text-slate-900">{ing ? ing.namaBahan : 'Tidak ditemukan'}</td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-amber-900">
                                  {r.takaran} {ing?.satuanTakaran || ''}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">
                                  {ing ? `Rp ${ing.hargaBeli.toLocaleString('id-ID')} / ${ing.satuanBeli}` : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-extrabold text-amber-900">
                                  Rp {Math.round(itemCost).toLocaleString('id-ID')}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {currentMenu.recipe && currentMenu.recipe.length > 0 && (
                          <tr className="bg-amber-100/60 font-black text-amber-950 border-t border-amber-300">
                            <td colSpan={4} className="py-2 px-3 uppercase text-[10px]">TOTAL HPP RESEP PER PORSI:</td>
                            <td className="py-2 px-3 text-right font-mono text-sm">Rp {Math.round(calcHpp).toLocaleString('id-ID')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SOP INSTRUCTIONS */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <h5 className="text-[11px] font-black uppercase tracking-wide text-slate-900">Catatan Pembuatan Barista (SOP):</h5>
                  <ol className="text-[10px] text-slate-600 space-y-1 list-decimal list-inside font-medium">
                    <li>Timbang/ukur setiap bahan baku dengan presisi sesuai takaran gramasi/mili di atas.</li>
                    <li>Jaga kebersihan peralatan bar (jigger, grinder, pitcher, shaker) sebelum & sesudah penyajian.</li>
                    <li>Jika ada perubahan merk/kemasan bahan baku, lakukan update takaran & HPP di aplikasi.</li>
                  </ol>
                </div>
              </div>
            ) : null}

          </div>
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center space-x-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Dokumen PDF Siap Di-download & Dicetak</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition cursor-pointer"
          >
            Tutup Modal
          </button>
        </div>

      </div>
    </div>
  );
}
