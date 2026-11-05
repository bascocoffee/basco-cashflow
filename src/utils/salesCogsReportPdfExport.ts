import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MenuItem, RecipeIngredient, calculateRecipeItemCost, calculateMenuItemHppFromRecipe } from '../components/CogsDailySalesPage';
import { IncomingIngredientBatch } from '../types';

export interface MenuSalesSummaryItem {
  menuId: string;
  nama: string;
  kategori: string;
  porsiTerjual: number;
  hargaJual: number;
  totalOmset: number;
  hppPerUnit: number;
  totalHpp: number;
  labaKotor: number;
  marginPct: number;
}

export interface IngredientUsageSummaryItem {
  ingredientId: string;
  namaBahan: string;
  kategori: string;
  totalTakaran: number;
  satuanTakaran: string;
  biayaSatuanTakaran: number;
  totalBiaya: number;
  kontribusiPct: number;
}

export interface SalesCogsReportData {
  startDate: string;
  endDate: string;
  periodLabel: string;
  cafeName: string;
  menuSalesList: MenuSalesSummaryItem[];
  ingredientUsageList: IngredientUsageSummaryItem[];
  incomingGoodsList: IncomingIngredientBatch[];
  summary: {
    totalPorsi: number;
    totalOmset: number;
    totalHpp: number;
    totalLabaKotor: number;
    averageMarginPct: number;
    totalBiayaBahanTerpakai: number;
    totalBelanjaBarangMasuk: number;
    totalBarangLunas: number;
    totalBarangTempo: number;
  };
}

export function formatRupiahPdf(val: number): string {
  return `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;
}

export function downloadSalesCogsReportPDF(data: SalesCogsReportData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const cafeTitle = (data.cafeName || 'BASCO COFFEE & ROASTERY').toUpperCase();
  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // ==========================================
  // PAGE 1: HEADER & RINGKASAN EKSEKUTIF + PENJUALAN MENU
  // ==========================================
  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 26, 'F');

  // Accent Line
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.rect(0, 26, 210, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(cafeTitle, 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text('LAPORAN COGS, PENJUALAN MENU, PEMAKAIAN BAHAN & BARANG MASUK', 14, 17);

  doc.setFontSize(7.5);
  doc.text(`Dicetak: ${printDateStr}`, 196, 11, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(251, 191, 36); // Amber-400
  doc.text(`Periode: ${data.periodLabel}`, 196, 17, { align: 'right' });

  // Executive Summary Card
  let currentY = 32;
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(14, currentY, 182, 24, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL OMSET PENJUALAN', 20, currentY + 7);
  doc.text('ESTIMASI HPP (COGS)', 66, currentY + 7);
  doc.text('LABA KOTOR (GROSS)', 112, currentY + 7);
  doc.text('TOTAL BARANG MASUK', 158, currentY + 7);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatRupiahPdf(data.summary.totalOmset), 20, currentY + 14);

  doc.setTextColor(217, 119, 6); // Amber-600
  doc.text(formatRupiahPdf(data.summary.totalHpp), 66, currentY + 14);

  doc.setTextColor(16, 185, 129); // Emerald-500
  doc.text(`${formatRupiahPdf(data.summary.totalLabaKotor)} (${data.summary.averageMarginPct.toFixed(1)}%)`, 112, currentY + 14);

  doc.setTextColor(37, 99, 235); // Blue-600
  doc.text(formatRupiahPdf(data.summary.totalBelanjaBarangMasuk), 158, currentY + 14);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Porsi Terjual: ${data.summary.totalPorsi.toLocaleString('id-ID')} cup/pax`, 20, currentY + 20);
  doc.text(`Rasio HPP: ${data.summary.totalOmset > 0 ? ((data.summary.totalHpp / data.summary.totalOmset) * 100).toFixed(1) : 0}%`, 66, currentY + 20);
  doc.text(`Biaya Bahan Terpakai: ${formatRupiahPdf(data.summary.totalBiayaBahanTerpakai)}`, 112, currentY + 20);
  doc.text(`Lunas: ${formatRupiahPdf(data.summary.totalBarangLunas)} | Tempo: ${formatRupiahPdf(data.summary.totalBarangTempo)}`, 158, currentY + 20);

  currentY += 28;

  // SECTION 1: TABEL PENJUALAN MENU
  doc.setFillColor(30, 41, 59);
  doc.rect(14, currentY, 3, 6, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. DATA PENJUALAN MENU (RENTANG TANGGAL TERPILIH)', 20, currentY + 5);

  const menuRows = data.menuSalesList.map((m, idx) => [
    (idx + 1).toString(),
    m.nama,
    m.kategori,
    `${m.porsiTerjual.toLocaleString('id-ID')} cup`,
    formatRupiahPdf(m.hargaJual),
    formatRupiahPdf(m.totalOmset),
    formatRupiahPdf(m.totalHpp),
    formatRupiahPdf(m.labaKotor),
    `${m.marginPct.toFixed(1)}%`
  ]);

  // Total footer for Table 1
  const menuFooter = [
    [
      '',
      `TOTAL (${data.menuSalesList.length} Menu)`,
      '-',
      `${data.summary.totalPorsi.toLocaleString('id-ID')} cup`,
      '-',
      formatRupiahPdf(data.summary.totalOmset),
      formatRupiahPdf(data.summary.totalHpp),
      formatRupiahPdf(data.summary.totalLabaKotor),
      `${data.summary.averageMarginPct.toFixed(1)}%`
    ]
  ];

  autoTable(doc, {
    startY: currentY + 8,
    head: [['No', 'Nama Menu', 'Kategori', 'Terjual', 'Harga Jual', 'Total Omset', 'Total HPP', 'Laba Kotor', 'Margin']],
    body: menuRows.length > 0 ? menuRows : [['-', 'Tidak ada penjualan menu pada rentang tanggal ini', '-', '-', '-', '-', '-', '-', '-']],
    foot: menuRows.length > 0 ? menuFooter : undefined,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 42 },
      2: { cellWidth: 18 },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 14, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  // ==========================================
  // SECTION 2: PEMAKAIAN BAHAN BAKU
  // ==========================================
  // Check if we need a new page for Section 2
  const finalY1 = (doc as any).lastAutoTable.finalY || currentY + 50;
  if (finalY1 > 220) {
    doc.addPage();
    currentY = 16;
  } else {
    currentY = finalY1 + 10;
  }

  doc.setFillColor(217, 119, 6); // Amber-600
  doc.rect(14, currentY, 3, 6, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. PEMAKAIAN BAHAN BAKU (BERDASARKAN RESEP DARI MENU TERJUAL)', 20, currentY + 5);

  const ingRows = data.ingredientUsageList.map((ing, idx) => [
    (idx + 1).toString(),
    ing.namaBahan,
    ing.kategori,
    `${Number(ing.totalTakaran.toFixed(1)).toLocaleString('id-ID')} ${ing.satuanTakaran}`,
    `${formatRupiahPdf(ing.biayaSatuanTakaran)} / ${ing.satuanTakaran}`,
    formatRupiahPdf(ing.totalBiaya),
    `${ing.kontribusiPct.toFixed(1)}%`
  ]);

  const ingFooter = [
    [
      '',
      `TOTAL ESTIMASI BIAYA BAHAN BAKU TERPAKAI`,
      '-',
      '-',
      '-',
      formatRupiahPdf(data.summary.totalBiayaBahanTerpakai),
      '100.0%'
    ]
  ];

  autoTable(doc, {
    startY: currentY + 8,
    head: [['No', 'Nama Bahan Baku', 'Kategori', 'Total Pemakaian', 'Biaya / Satuan', 'Total Biaya HPP', 'Kontribusi']],
    body: ingRows.length > 0 ? ingRows : [['-', 'Tidak ada pemakaian bahan baku pada rentang tanggal ini', '-', '-', '-', '-', '-']],
    foot: ingRows.length > 0 ? ingFooter : undefined,
    theme: 'grid',
    headStyles: {
      fillColor: [180, 83, 9], // Amber-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    footStyles: {
      fillColor: [254, 243, 199], // Amber-100
      textColor: [120, 53, 15],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 24 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 20, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  // ==========================================
  // SECTION 3: LAPORAN BARANG MASUK
  // ==========================================
  const finalY2 = (doc as any).lastAutoTable.finalY || currentY + 50;
  if (finalY2 > 210) {
    doc.addPage();
    currentY = 16;
  } else {
    currentY = finalY2 + 10;
  }

  doc.setFillColor(37, 99, 235); // Blue-600
  doc.rect(14, currentY, 3, 6, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('3. LAPORAN BARANG MASUK (PEMBELIAN INVENTORY PADA PERIODE INI)', 20, currentY + 5);

  const incomingRows = data.incomingGoodsList.map((item, idx) => {
    const formattedDate = item.tanggal ? item.tanggal.split('-').reverse().join('/') : '-';
    return [
      (idx + 1).toString(),
      formattedDate,
      item.namaBahan,
      `${item.berat} ${item.satuan}`,
      formatRupiahPdf(item.hargaSatuan || (item.berat > 0 ? item.harga / item.berat : 0)),
      formatRupiahPdf(item.harga),
      item.statusPembayaran || 'Lunas',
      item.supplier || '-',
      item.nomorNota || item.keterangan || '-'
    ];
  });

  const incomingFooter = [
    [
      '',
      '',
      `TOTAL BARANG MASUK (${data.incomingGoodsList.length} Item)`,
      '-',
      '-',
      formatRupiahPdf(data.summary.totalBelanjaBarangMasuk),
      `Lunas: ${formatRupiahPdf(data.summary.totalBarangLunas)}`,
      `Tempo: ${formatRupiahPdf(data.summary.totalBarangTempo)}`,
      '-'
    ]
  ];

  autoTable(doc, {
    startY: currentY + 8,
    head: [['No', 'Tanggal', 'Nama Barang / Bahan', 'Kuantitas', 'Harga Satuan', 'Total Biaya', 'Status Bayar', 'Supplier', 'Nota / Ket']],
    body: incomingRows.length > 0 ? incomingRows : [['-', '-', 'Tidak ada data barang masuk pada rentang tanggal ini', '-', '-', '-', '-', '-', '-']],
    foot: incomingRows.length > 0 ? incomingFooter : undefined,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138], // Blue-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    footStyles: {
      fillColor: [239, 246, 255], // Blue-50
      textColor: [30, 58, 138],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 38 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 22 },
      8: { cellWidth: 18 }
    },
    margin: { left: 14, right: 14 }
  });

  // ==========================================
  // SIGNATURE SECTION
  // ==========================================
  const finalY3 = (doc as any).lastAutoTable.finalY || currentY + 50;
  let sigY = finalY3 + 12;
  if (sigY > 245) {
    doc.addPage();
    sigY = 25;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text('Disiapkan Oleh,', 30, sigY);
  doc.text('Staff / Barista / Kasir', 30, sigY + 4);

  doc.text('Mengetahui & Disetujui,', 140, sigY);
  doc.text('Store Manager / Owner', 140, sigY + 4);

  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.line(30, sigY + 24, 75, sigY + 24);
  doc.line(140, sigY + 24, 185, sigY + 24);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.text('(Nama & Tanda Tangan)', 30, sigY + 28);
  doc.text('(Nama & Tanda Tangan)', 140, sigY + 28);

  // ==========================================
  // PAGE NUMBERS FOOTER (All Pages)
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${cafeTitle} • Laporan Analisis COGS & Sales (${data.periodLabel})`,
      14,
      290
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, 196, 290, { align: 'right' });
  }

  // Save the PDF
  const cleanStart = data.startDate.replace(/[^0-9]/g, '');
  const cleanEnd = data.endDate.replace(/[^0-9]/g, '');
  const filename = `Laporan_COGS_Sales_Bahan_Masuk_${cleanStart}_${cleanEnd}.pdf`;
  doc.save(filename);
}
