import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MenuItem, RecipeIngredient, calculateRecipeItemCost, calculateMenuItemHppFromRecipe } from '../components/CogsDailySalesPage';

export function downloadSingleRecipePDF(
  menuItem: MenuItem, 
  ingredients: RecipeIngredient[], 
  cafeName: string = 'KAFE & ROASTERY'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const calcHpp = calculateMenuItemHppFromRecipe(menuItem, ingredients);
  const marginVal = menuItem.hargaJual - calcHpp;
  const marginPct = menuItem.hargaJual > 0 ? (marginVal / menuItem.hargaJual) * 100 : 0;

  // Header / Branding
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(cafeName.toUpperCase(), 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('STANDARD OPERATING PROCEDURE (SOP) & KARTU RESEP MENU', 14, 19);

  doc.setFontSize(8);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 196, 19, { align: 'right' });

  // Menu Info Card
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(14, 34, 182, 38, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(menuItem.nama, 20, 44);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text(`KATEGORI: ${menuItem.kategori.toUpperCase()}`, 20, 50);

  // Financial Metrics Grid
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text('Harga Jual:', 20, 62);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Rp ${menuItem.hargaJual.toLocaleString('id-ID')}`, 40, 62);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('HPP / COGS Resep:', 80, 62);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // Amber-700
  doc.text(`Rp ${Math.round(calcHpp).toLocaleString('id-ID')}`, 115, 62);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('Profit Margin:', 148, 62);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // Emerald-700
  doc.text(`Rp ${Math.round(marginVal).toLocaleString('id-ID')} (${marginPct.toFixed(1)}%)`, 170, 62);

  // Table Ingredients Header
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('KOMPOSISI RESEP & RINCIAN TAKARAN BAHAN BAKU', 14, 82);

  const tableRows = (menuItem.recipe || []).map((r, index) => {
    const ing = ingredients.find(i => i.id === r.ingredientId);
    const cost = ing ? calculateRecipeItemCost(ing, r.takaran) : 0;
    return [
      (index + 1).toString(),
      ing ? ing.namaBahan : 'Bahan Baku Tidak Ditemukan',
      `${r.takaran} ${ing?.satuanTakaran || ''}`,
      ing ? `Rp ${ing.hargaBeli.toLocaleString('id-ID')} / ${ing.satuanBeli}` : '-',
      `Rp ${Math.round(cost).toLocaleString('id-ID')}`
    ];
  });

  if (tableRows.length === 0) {
    tableRows.push(['-', 'Belum ada bahan baku terdaftar pada resep ini', '-', '-', 'Rp 0']);
  }

  autoTable(doc, {
    startY: 86,
    head: [['No', 'Nama Bahan Baku', 'Takaran Resep', 'Harga Beli Master', 'HPP Kontribusi']],
    body: tableRows,
    foot: [
      ['', 'TOTAL HPP BAHAN BAKU PER PORSI', '', '', `Rp ${Math.round(calcHpp).toLocaleString('id-ID')}`]
    ],
    headStyles: {
      fillColor: [245, 158, 11], // Amber-500
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9
    },
    footStyles: {
      fillColor: [254, 243, 199], // Amber-100
      textColor: [120, 53, 15],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 40, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  // Notes & Signatures section
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 140;

  // Box Catatan Pembuatan / SOP Barista
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY, 182, 35, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CATATAN PEMBUATAN & STANDAR KUALITAS (SOP):', 18, finalY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('1. Timbang/ukur setiap bahan baku dengan presisi sesuai takaran gramasi/mili di atas.', 18, finalY + 14);
  doc.text('2. Jaga kebersihan peralatan bar (jigger, grinder, pitcher, shaker) sebelum & sesudah penyajian.', 18, finalY + 20);
  doc.text('3. Jika ada perubahan merk/kemasan bahan baku, lakukan update takaran & HPP di aplikasi.', 18, finalY + 26);

  // Signatures
  const sigY = finalY + 45;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  doc.text('Dibuat Oleh (Barista/Head Bar):', 25, sigY);
  doc.line(25, sigY + 18, 75, sigY + 18);
  doc.text('Tanggal: _______________', 25, sigY + 23);

  doc.text('Disetujui Oleh (Manager Kafe):', 135, sigY);
  doc.line(135, sigY + 18, 185, sigY + 18);
  doc.text('Tanggal: _______________', 135, sigY + 23);

  // Footer page number
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Dokumen Resep Resmi Internal - Dibuat melalui Sistem ArusKas Kafe', 105, 287, { align: 'center' });

  // Save PDF
  const safeFileName = menuItem.nama.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  doc.save(`Resep_Menu_${safeFileName}.pdf`);
}

export function downloadAllRecipesPDF(
  menuItems: MenuItem[], 
  ingredients: RecipeIngredient[], 
  cafeName: string = 'KAFE & ROASTERY'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // PAGE 1: COVER & SUMMARY MATRIX
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(cafeName.toUpperCase(), 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('KATALOG BUKU RESEP S.O.P & MATRIKS HPP SELURUH MENU', 14, 22);

  doc.setFontSize(8);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 196, 22, { align: 'right' });

  // Intro box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 38, 182, 18, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`RINGKASAN KATALOG: ${menuItems.length} MENU TERDAFTAR`, 18, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Buku panduan resep & HPP standar operasional kafe. Halaman berikutnya berisi rincian resep per menu.', 18, 51);

  // Table of All Menus
  const summaryRows = menuItems.map((m, idx) => {
    const calcHpp = calculateMenuItemHppFromRecipe(m, ingredients);
    const marginVal = m.hargaJual - calcHpp;
    const marginPct = m.hargaJual > 0 ? (marginVal / m.hargaJual) * 100 : 0;
    const ingCount = m.recipe ? m.recipe.length : 0;

    return [
      (idx + 1).toString(),
      m.nama,
      m.kategori,
      `${ingCount} Bahan`,
      `Rp ${m.hargaJual.toLocaleString('id-ID')}`,
      `Rp ${Math.round(calcHpp).toLocaleString('id-ID')}`,
      `Rp ${Math.round(marginVal).toLocaleString('id-ID')} (${marginPct.toFixed(0)}%)`
    ];
  });

  autoTable(doc, {
    startY: 60,
    head: [['No', 'Nama Menu', 'Kategori', 'Jml Bahan', 'Harga Jual', 'HPP Resep', 'Profit Margin']],
    body: summaryRows,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 25 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  // SUBSEQUENT PAGES: INDIVIDUAL RECIPE SHEETS
  menuItems.forEach((menuItem) => {
    doc.addPage();

    const calcHpp = calculateMenuItemHppFromRecipe(menuItem, ingredients);
    const marginVal = menuItem.hargaJual - calcHpp;
    const marginPct = menuItem.hargaJual > 0 ? (marginVal / menuItem.hargaJual) * 100 : 0;

    // Header / Branding
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(cafeName.toUpperCase(), 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('STANDARD OPERATING PROCEDURE (SOP) & KARTU RESEP MENU', 14, 19);

    doc.setFontSize(8);
    doc.text(`Halaman Resep`, 196, 19, { align: 'right' });

    // Menu Info Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 34, 182, 38, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(menuItem.nama, 20, 44);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(`KATEGORI: ${menuItem.kategori.toUpperCase()}`, 20, 50);

    // Financial Metrics Grid
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    doc.text('Harga Jual:', 20, 62);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Rp ${menuItem.hargaJual.toLocaleString('id-ID')}`, 40, 62);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('HPP / COGS Resep:', 80, 62);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(`Rp ${Math.round(calcHpp).toLocaleString('id-ID')}`, 115, 62);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Profit Margin:', 148, 62);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text(`Rp ${Math.round(marginVal).toLocaleString('id-ID')} (${marginPct.toFixed(1)}%)`, 170, 62);

    // Table Ingredients
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('KOMPOSISI RESEP & RINCIAN TAKARAN BAHAN BAKU', 14, 82);

    const recipeRows = (menuItem.recipe || []).map((r, index) => {
      const ing = ingredients.find(i => i.id === r.ingredientId);
      const cost = ing ? calculateRecipeItemCost(ing, r.takaran) : 0;
      return [
        (index + 1).toString(),
        ing ? ing.namaBahan : 'Bahan Baku Tidak Ditemukan',
        `${r.takaran} ${ing?.satuanTakaran || ''}`,
        ing ? `Rp ${ing.hargaBeli.toLocaleString('id-ID')} / ${ing.satuanBeli}` : '-',
        `Rp ${Math.round(cost).toLocaleString('id-ID')}`
      ];
    });

    if (recipeRows.length === 0) {
      recipeRows.push(['-', 'Belum ada bahan baku terdaftar pada resep ini', '-', '-', 'Rp 0']);
    }

    autoTable(doc, {
      startY: 86,
      head: [['No', 'Nama Bahan Baku', 'Takaran Resep', 'Harga Beli Master', 'HPP Kontribusi']],
      body: recipeRows,
      foot: [
        ['', 'TOTAL HPP BAHAN BAKU PER PORSI', '', '', `Rp ${Math.round(calcHpp).toLocaleString('id-ID')}`]
      ],
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 9
      },
      footStyles: {
        fillColor: [254, 243, 199],
        textColor: [120, 53, 15],
        fontStyle: 'bold',
        fontSize: 9
      },
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 40, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    // Notes
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 140;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY, 182, 35, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('CATATAN PEMBUATAN & STANDAR KUALITAS (SOP):', 18, finalY + 7);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('1. Timbang/ukur setiap bahan baku dengan presisi sesuai takaran gramasi/mili di atas.', 18, finalY + 14);
    doc.text('2. Jaga kebersihan peralatan bar (jigger, grinder, pitcher, shaker) sebelum & sesudah penyajian.', 18, finalY + 20);
    doc.text('3. Jika ada perubahan merk/kemasan bahan baku, lakukan update takaran & HPP di aplikasi.', 18, finalY + 26);

    // Signatures
    const sigY = finalY + 45;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    doc.text('Dibuat Oleh (Barista/Head Bar):', 25, sigY);
    doc.line(25, sigY + 18, 75, sigY + 18);
    doc.text('Tanggal: _______________', 25, sigY + 23);

    doc.text('Disetujui Oleh (Manager Kafe):', 135, sigY);
    doc.line(135, sigY + 18, 185, sigY + 18);
    doc.text('Tanggal: _______________', 135, sigY + 23);

    // Footer page number
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Buku Resep S.O.P Kafe - Generated by ArusKas App', 105, 287, { align: 'center' });
  });

  // Save PDF
  doc.save(`Buku_Resep_Lengkap_Kafe.pdf`);
}
