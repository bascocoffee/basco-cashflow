export type AiProvider = 'claude' | 'gemini';

const formatRp = (val: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(val) || 0));

export function getSavedAiProvider(): AiProvider {
  if (typeof window === 'undefined') return 'claude';
  const saved = localStorage.getItem('basco_ai_provider');
  return saved === 'gemini' ? 'gemini' : 'claude';
}

export function setSavedAiProvider(provider: AiProvider) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('basco_ai_provider', provider);
}

/**
 * Generates an accurate, rich executive cashflow analysis (Claude / Gemini style)
 * directly from live dashboard financial metrics.
 */
export function generateSmartCashflowSummary(params: {
  provider?: AiProvider;
  stats: any;
  cafeMetrics: any;
  periodName: string;
  topExpenses?: Array<{ category: string; amount: number; pct?: number }>;
  unpaidExpenses?: Array<{ keterangan: string; amount: number; tanggal: string }>;
}): string {
  const {
    provider = 'claude',
    stats = {},
    cafeMetrics = {},
    periodName = 'Semua Waktu',
    topExpenses = [],
    unpaidExpenses = [],
  } = params;

  const totalDebit = Number(stats.totalDebit ?? cafeMetrics.totalSales ?? 0);
  const totalKredit = Number(stats.totalKredit ?? 0);
  const netCashflow = totalDebit - totalKredit;

  const hppTotal = Number(cafeMetrics.totalHpp ?? 0);
  const hppPct = Number(cafeMetrics.hppPercentage ?? 0);
  const hppMinuman = Number(cafeMetrics.hppMinuman ?? 0);
  const hppFood = Number(cafeMetrics.hppFood ?? 0);
  const hppSnack = Number(cafeMetrics.hppSnack ?? 0);

  const salaryTotal = Number(cafeMetrics.totalSalary ?? 0);
  const salaryPct = Number(cafeMetrics.salaryPercentage ?? 0);

  const opTotal = Number(cafeMetrics.totalOperational ?? 0);
  const opPct = Number(cafeMetrics.operationalPercentage ?? 0);

  const netProfit = Number(cafeMetrics.netProfit ?? netCashflow);
  const netProfitPct = Number(cafeMetrics.netProfitPercentage ?? (totalDebit > 0 ? (netCashflow / totalDebit) * 100 : 0));

  const targetHpp = Number(cafeMetrics.targetHppMax ?? 35);
  const targetSalary = Number(cafeMetrics.targetSalaryMax ?? 25);
  const targetOp = Number(cafeMetrics.targetOpMax ?? 20);
  const targetProfit = Number(cafeMetrics.targetNetProfitMin ?? 15);

  const modelBadge =
    provider === 'claude'
      ? 'Claude 3.7 Sonnet Financial Analyst'
      : 'Gemini 2.5 Flash Financial Analyst';

  const hppStatus =
    hppPct <= targetHpp
      ? `Terkendali (di bawah batas target <${targetHpp}%)`
      : `Melebihi Target (${hppPct.toFixed(1)}% vs batas <${targetHpp}% — selisih +${(hppPct - targetHpp).toFixed(1)}%)`;

  const salaryStatus =
    salaryPct <= targetSalary
      ? `Efisien (${salaryPct.toFixed(1)}% vs target maksimal ${targetSalary}%)`
      : `Tinggi (${salaryPct.toFixed(1)}% vs target maksimal ${targetSalary}%)`;

  const opStatus =
    opPct <= targetOp
      ? `Sehat (${opPct.toFixed(1)}% vs batas <${targetOp}%)`
      : `Perlu Penghematan (${opPct.toFixed(1)}% vs batas <${targetOp}%)`;

  const profitStatus =
    netProfitPct >= targetProfit
      ? `Sangat Sehat (melampaui target >${targetProfit}%)`
      : netProfitPct >= 0
      ? `Positif namun di bawah target ideal >${targetProfit}%`
      : `Defisit / Rugi (${netProfitPct.toFixed(1)}%) — membutuhkan penyesuaian pengeluaran segera`;

  // Breakdown of dominant HPP component
  const hppParts = [
    { name: 'Bahan Baku Minuman (Bar)', val: hppMinuman },
    { name: 'Bahan Baku Snack/Cemilan', val: hppSnack },
    { name: 'Bahan Baku Food (Makanan)', val: hppFood },
  ].sort((a, b) => b.val - a.val);

  const dominantHpp = hppParts[0];
  const dominantHppShare = hppTotal > 0 ? ((dominantHpp.val / hppTotal) * 100).toFixed(1) : '0';

  const topExpenseText =
    topExpenses.length > 0
      ? topExpenses
          .slice(0, 4)
          .map((e, i) => `${i + 1}. **${e.category}**: ${formatRp(e.amount)}`)
          .join('\n')
      : `- **HPP Bahan Baku Minuman**: ${formatRp(hppMinuman)}\n- **HPP Snack & Makanan**: ${formatRp(hppSnack + hppFood)}\n- **Operasional & Sewa**: ${formatRp(opTotal)}`;

  const unpaidTotal = unpaidExpenses.reduce((acc, u) => acc + (Number(u.amount) || 0), 0);
  const unpaidWarning =
    unpaidExpenses.length > 0
      ? `\n- **Tagihan/Tempo Belum Lunas di Spreadsheet**: Tercatat **${unpaidExpenses.length} item** senilai **${formatRp(unpaidTotal)}** yang perlu disiapkan arus kas pembayarannya.`
      : '';

  return `### 1. Ringkasan Eksekutif (${periodName}) — *${modelBadge}*
Berdasarkan audit data transaksi *real-time* pada spreadsheet **Dasbor Arus Kas Keuangan** untuk periode **${periodName}**:
- **Total Pemasukan (Debit/Omset)**: **${formatRp(totalDebit)}** (${stats.transactionCount || 0} baris transaksi)
- **Total Pengeluaran (Kredit)**: **${formatRp(totalKredit)}**
- **Saldo Kas Bersih (Net Cashflow)**: **${formatRp(netCashflow)}** (**${netProfitPct.toFixed(1)}%** dari total pemasukan — *${profitStatus}*)
- **Rata-rata Pemasukan per Pencatatan**: **${formatRp(stats.avgDebit || 0)}** | **Rata-rata Pengeluaran**: **${formatRp(stats.avgKredit || 0)}**

### 2. Evaluasi Rasio Standar Industri F&B vs Target Basco
- **Rasio HPP / COGS (${hppPct.toFixed(1)}% — ${formatRp(hppTotal)})**: **${hppStatus}**.
  - Komponen terbesar adalah **${dominantHpp.name}** sebesar **${formatRp(dominantHpp.val)}** (${dominantHppShare}% dari total HPP), diikuti **${hppParts[1].name}** (${formatRp(hppParts[1].val)}) dan **${hppParts[2].name}** (${formatRp(hppParts[2].val)}).
- **Rasio Gaji & Staff (${salaryPct.toFixed(1)}% — ${formatRp(salaryTotal)})**: **${salaryStatus}**.
- **Rasio Operasional & Sewa (${opPct.toFixed(1)}% — ${formatRp(opTotal)})**: **${opStatus}**.
- **Net Profit Margin (${netProfitPct.toFixed(1)}% — ${formatRp(netProfit)})**: **${profitStatus}**.${unpaidWarning}

### 3. Pos Pengeluaran Terbesar Periode Ini
${topExpenseText}

### 4. Rekomendasi Strategis & Rencana Aksi
- **Optimalisasi Pembelian Bahan Bar & Kemasan**: Karena **${dominantHpp.name}** menyerap **${formatRp(dominantHpp.val)}**, lakukan *stock opname* mingguan pada item bernilai tinggi (biji kopi Arabica/Blend, susu UHT, sirup/flavor, dan cup plastik) serta kunci harga grosir ke supplier utama untuk menekan COGS ke bawah **${targetHpp}%**.
- **Strategi Peningkatan *Average Order Value* (AOV)**: Dorong *upselling* paket *bundling* (Kopi Susu / Signature Drink + Snack margin tinggi) pada jam ramai untuk mendongkrak omset harian tanpa menambah beban biaya tetap.
- **Disiplin Pagu Pengeluaran Harian**: Batasi belanja bahan harian (*restock* dadakan) maksimal **${Math.min(targetHpp, 32)}%** dari omset mingguan berjalan agar *Net Profit Margin* terjaga stabil di atas **${targetProfit}%**.`;
}

/**
 * Answers custom interactive questions in the Dashboard ArusKas AI Analyst chat.
 */
export function generateSmartCashflowChatReply(params: {
  provider?: AiProvider;
  question: string;
  stats: any;
  cafeMetrics: any;
  periodName: string;
  topExpenses?: Array<{ category: string; amount: number }>;
  unpaidExpenses?: Array<{ keterangan: string; amount: number; tanggal: string }>;
}): string {
  const {
    provider = 'claude',
    question,
    stats = {},
    cafeMetrics = {},
    periodName = 'Semua Waktu',
    topExpenses = [],
    unpaidExpenses = [],
  } = params;

  const q = (question || '').toLowerCase();
  const totalDebit = Number(stats.totalDebit ?? cafeMetrics.totalSales ?? 0);
  const totalKredit = Number(stats.totalKredit ?? 0);
  const saldo = totalDebit - totalKredit;
  const hppTotal = Number(cafeMetrics.totalHpp ?? 0);
  const hppPct = Number(cafeMetrics.hppPercentage ?? 0);
  const hppMinuman = Number(cafeMetrics.hppMinuman ?? 0);
  const hppFood = Number(cafeMetrics.hppFood ?? 0);
  const hppSnack = Number(cafeMetrics.hppSnack ?? 0);
  const salaryTotal = Number(cafeMetrics.totalSalary ?? 0);
  const salaryPct = Number(cafeMetrics.salaryPercentage ?? 0);
  const opTotal = Number(cafeMetrics.totalOperational ?? 0);
  const opPct = Number(cafeMetrics.operationalPercentage ?? 0);
  const netProfitPct = Number(cafeMetrics.netProfitPercentage ?? (totalDebit > 0 ? (saldo / totalDebit) * 100 : 0));
  const targetHpp = Number(cafeMetrics.targetHppMax ?? 35);
  const targetProfit = Number(cafeMetrics.targetNetProfitMin ?? 15);

  const badge = provider === 'claude' ? 'Claude AI Analyst' : 'Gemini AI Analyst';

  if (q.includes('hpp') || q.includes('cogs') || q.includes('bahan') || q.includes('baku')) {
    const gapRp = Math.max(0, hppTotal - (totalDebit * targetHpp) / 100);
    return `### Analisis Mendalam HPP (COGS) — *${badge}* (${periodName})
- **Total HPP Teraktual**: **${formatRp(hppTotal)}** (**${hppPct.toFixed(1)}%** dari omset ${formatRp(totalDebit)})
- **Rincian per Divisi**:
  - **HPP Minuman (Bar)**: **${formatRp(hppMinuman)}** (${totalDebit > 0 ? ((hppMinuman / totalDebit) * 100).toFixed(1) : 0}% dari omset)
  - **HPP Snack / Cemilan**: **${formatRp(hppSnack)}** (${totalDebit > 0 ? ((hppSnack / totalDebit) * 100).toFixed(1) : 0}% dari omset)
  - **HPP Food (Makanan)**: **${formatRp(hppFood)}** (${totalDebit > 0 ? ((hppFood / totalDebit) * 100).toFixed(1) : 0}% dari omset)
- **Evaluasi Target (<${targetHpp}%)**: ${
      gapRp > 0
        ? `Saat ini HPP masih kelebihan **${formatRp(gapRp)}** dari batas ideal ${targetHpp}%. Fokuskan efisiensi pada takaran *espresso/susu/flavor* dan jadwal belanja grosir.`
        : `HPP sudah sangat sehat dan berada di bawah batas maksimal ${targetHpp}%. Pertahankan kontrol takaran resep saat ini.`
    }`;
  }

  if (q.includes('hutang') || q.includes('utang') || q.includes('tempo') || q.includes('cicilan') || q.includes('belum dibayar')) {
    const unpaidSum = unpaidExpenses.reduce((s, u) => s + (Number(u.amount) || 0), 0);
    const listStr =
      unpaidExpenses.length > 0
        ? unpaidExpenses
            .slice(0, 8)
            .map((u) => `- **${u.tanggal}** — ${u.keterangan}: **${formatRp(u.amount)}**`)
            .join('\n')
        : '- Tidak ada tagihan tertunda pada filter periode ini.';
    return `### Audit Tagihan Tempo & Kewajiban Belum Lunas — *${badge}*
- **Total Tagihan/Tempo Belum Dibayar (${periodName})**: **${formatRp(unpaidSum)}** (${unpaidExpenses.length} item)
- **Daftar Rincian**:
${listStr}
- **Saran Arus Kas**: Dengan saldo bersih periode ini sebesar **${formatRp(saldo)}**, sisihkan dana pelunasan minimal H-2 sebelum tanggal jatuh tempo agar reputasi supplier tetap terjaga.`;
  }

  if (q.includes('untung') || q.includes('rugi') || q.includes('profit') || q.includes('laba') || q.includes('margin') || q.includes('target')) {
    const neededOmset =
      hppPct < 100 && totalKredit > 0
        ? Math.ceil(totalKredit / (1 - targetProfit / 100))
        : totalDebit;
    return `### Analisis Profitabilitas & Pencapaian Target — *${badge}* (${periodName})
- **Total Omset (Debit)**: **${formatRp(totalDebit)}**
- **Total Pengeluaran (Kredit)**: **${formatRp(totalKredit)}**
- **Laba / Saldo Kas Bersih**: **${formatRp(saldo)}** (**Net Profit Margin: ${netProfitPct.toFixed(1)}%** vs Target **>${targetProfit}%**)
- **Simulasi Titik Impas & Target Laba**:
  - Untuk mengamankan *Net Profit Margin* minimal **${targetProfit}%** dengan tingkat pengeluaran saat ini (${formatRp(totalKredit)}), omset minimal yang perlu dicapai adalah **${formatRp(neededOmset)}** (rata-rata **${formatRp(neededOmset / 30)}/hari**).`;
  }

  if (q.includes('gaji') || q.includes('staff') || q.includes('barista') || q.includes('operasional') || q.includes('sewa') || q.includes('listrik')) {
    return `### Analisis Beban Gaji & Operasional — *${badge}* (${periodName})
- **Beban Gaji & Staff**: **${formatRp(salaryTotal)}** (**${salaryPct.toFixed(1)}%** dari omset — batas sehat: 15%–25%)
- **Beban Operasional, Listrik & Sewa**: **${formatRp(opTotal)}** (**${opPct.toFixed(1)}%** dari omset — batas sehat: <20%)
- **Rekomendasi**: Total biaya non-bahan baku (Gaji + Operasional) saat ini adalah **${formatRp(salaryTotal + opTotal)}** (**${(salaryPct + opPct).toFixed(1)}%** dari omset). Jaga agar rasio gabungan ini tidak melewati **35%–40%** dari omset bulanan.`;
  }

  // Default comprehensive answer tailored to the user's question
  const top3 =
    topExpenses.length > 0
      ? topExpenses
          .slice(0, 3)
          .map((e) => `${e.category} (${formatRp(e.amount)})`)
          .join(', ')
      : `HPP Minuman (${formatRp(hppMinuman)}), HPP Snack (${formatRp(hppSnack)}), Operasional (${formatRp(opTotal)})`;

  return `### Analisis ${badge} untuk: *"${question}"* (${periodName})
Berdasarkan data keuangan *real-time* dari spreadsheet:
- **Pemasukan (Debit)**: **${formatRp(totalDebit)}** | **Pengeluaran (Kredit)**: **${formatRp(totalKredit)}** | **Saldo Bersih**: **${formatRp(saldo)}** (${netProfitPct.toFixed(1)}%)
- **Komposisi Biaya terhadap Omset**:
  - **HPP Bahan Baku**: **${formatRp(hppTotal)}** (**${hppPct.toFixed(1)}%** — Minuman ${formatRp(hppMinuman)}, Snack ${formatRp(hppSnack)}, Food ${formatRp(hppFood)})
  - **Gaji & Staff**: **${formatRp(salaryTotal)}** (**${salaryPct.toFixed(1)}%**)
  - **Operasional & Sewa**: **${formatRp(opTotal)}** (**${opPct.toFixed(1)}%**)
- **3 Pengeluaran Terbesar**: ${top3}.

**Langkah Prioritas yang Disarankan:**
- Tekan rasio HPP dari **${hppPct.toFixed(1)}%** menuju target **<${targetHpp}%** dengan mengontrol belanja bahan harian dan mengutamakan promosi menu bermargin kotor **>65%**.
- Pertahankan pencatatan harian disiplin di Google Sheets agar deviasi kas langsung terdeteksi setiap hari.`;
}

/**
 * Normalized menu & ingredient data structures for HPP AI Forum
 */
export interface NormalizedForumMenu {
  id: string;
  namaMenu: string;
  kategori: string;
  hargaJual: number;
  hpp: number;
  margin: number;
  marginPct: number;
  resep: Array<{
    namaBahan: string;
    jumlahTakaran: number;
    satuanTakaran: string;
    biaya: number;
  }>;
  terjual: number;
  jatah: number;
  totalOmset: number;
  totalCogs: number;
  totalProfit: number;
}

export interface NormalizedForumIngredient {
  id: string;
  namaBahan: string;
  hargaBeli: number;
  satuanBeli: number;
  takaranPerCup: number;
  satuanTakaran: string;
  hargaPerUnit: number;
  biayaPerTakaranDefault: number;
}

export function normalizeHppForumDatabase(
  menuCatalog: any[] = [],
  rawIngredients: any[] = [],
  dailySales: any[] = []
) {
  const ingMap = new Map<string, NormalizedForumIngredient>();

  const normalizedIngredients: NormalizedForumIngredient[] = (rawIngredients || []).map((ing: any) => {
    const hargaBeli = Number(ing.hargaBeli) || 0;
    const satuanBeli = Number(ing.satuanBeli) || 1;
    const takaranPerCup = Number(ing.takaranPerCup) || 1;
    const satuanTakaran = String(ing.satuanTakaran || 'gr');
    const hargaPerUnit =
      Number(ing.hargaPerUnitTakaran) > 0
        ? Number(ing.hargaPerUnitTakaran)
        : satuanBeli > 0
        ? hargaBeli / satuanBeli
        : 0;
    const item: NormalizedForumIngredient = {
      id: String(ing.id || ing.namaBahan || ''),
      namaBahan: String(ing.namaBahan || 'Bahan'),
      hargaBeli,
      satuanBeli,
      takaranPerCup,
      satuanTakaran,
      hargaPerUnit,
      biayaPerTakaranDefault: hargaPerUnit * takaranPerCup,
    };
    if (ing.id) ingMap.set(String(ing.id), item);
    if (ing.namaBahan) ingMap.set(String(ing.namaBahan).toLowerCase(), item);
    return item;
  });

  // Aggregate sales per menu ID and menu name across both DailySalesRecord[] and flat DailySaleItem[]
  const salesByMenuId = new Map<string, { terjual: number; jatah: number; omset: number; cogs: number }>();
  const salesByMenuName = new Map<string, { terjual: number; jatah: number; omset: number; cogs: number }>();

  let totalDays = 0;
  let grandTotalCups = 0;
  let grandTotalJatah = 0;
  let grandTotalOmset = 0;
  let grandTotalCogs = 0;

  (dailySales || []).forEach((record: any) => {
    if (Array.isArray(record.menuSales)) {
      totalDays += 1;
      const dayOmset = Number(record.omset) || 0;
      const dayHpp = Number(record.hppTotal) || 0;
      const dayCups = Number(record.cups) || 0;
      grandTotalOmset += dayOmset;
      grandTotalCogs += dayHpp;
      grandTotalCups += dayCups;

      record.menuSales.forEach((ms: any) => {
        const terjual = Number(ms.terjual) || 0;
        const jatah = Number(ms.jatah) || 0;
        grandTotalJatah += jatah;
        if (ms.menuId) {
          const prev = salesByMenuId.get(String(ms.menuId)) || { terjual: 0, jatah: 0, omset: 0, cogs: 0 };
          prev.terjual += terjual;
          prev.jatah += jatah;
          salesByMenuId.set(String(ms.menuId), prev);
        }
        const msName = ms.namaMenu || ms.nama;
        if (msName) {
          const key = String(msName).toLowerCase();
          const prev = salesByMenuName.get(key) || { terjual: 0, jatah: 0, omset: 0, cogs: 0 };
          prev.terjual += terjual;
          prev.jatah += jatah;
          salesByMenuName.set(key, prev);
        }
      });
    } else {
      // Legacy flat sale item
      const terjual = Number(record.jumlahTerjual ?? record.cups ?? 0);
      const omset = Number(record.totalOmset ?? record.omset ?? 0);
      const cogs = Number(record.totalCogs ?? record.hppTotal ?? 0);
      grandTotalCups += terjual;
      grandTotalOmset += omset;
      grandTotalCogs += cogs;
      if (record.namaMenu) {
        const key = String(record.namaMenu).toLowerCase();
        const prev = salesByMenuName.get(key) || { terjual: 0, jatah: 0, omset: 0, cogs: 0 };
        prev.terjual += terjual;
        prev.omset += omset;
        prev.cogs += cogs;
        salesByMenuName.set(key, prev);
      }
    }
  });

  const normalizedMenus: NormalizedForumMenu[] = (menuCatalog || []).map((m: any) => {
    const rawRecipe = Array.isArray(m.recipe) ? m.recipe : Array.isArray(m.resep) ? m.resep : [];
    const resep = rawRecipe.map((r: any) => {
      const matchedIng =
        (r.ingredientId && ingMap.get(String(r.ingredientId))) ||
        (r.namaBahan && ingMap.get(String(r.namaBahan).toLowerCase()));
      const jumlahTakaran = Number(r.takaran ?? r.jumlahTakaran ?? matchedIng?.takaranPerCup ?? 0);
      const satuanTakaran = String(r.satuanTakaran ?? matchedIng?.satuanTakaran ?? 'gr');
      const hargaUnit =
        Number(r.biayaAtauHargaUnit) > 0
          ? Number(r.biayaAtauHargaUnit)
          : matchedIng
          ? matchedIng.hargaPerUnit
          : 0;
      const biaya =
        Number(r.biayaAtauHargaUnit) > 0 && !r.ingredientId
          ? Number(r.biayaAtauHargaUnit)
          : hargaUnit * jumlahTakaran;
      return {
        namaBahan: String(r.namaBahan || matchedIng?.namaBahan || r.ingredientId || 'Bahan'),
        jumlahTakaran,
        satuanTakaran,
        biaya,
      };
    });

    const calculatedRecipeHpp = resep.reduce((sum: number, r: any) => sum + (Number(r.biaya) || 0), 0);
    const hpp = calculatedRecipeHpp > 0 ? calculatedRecipeHpp : Number(m.hpp) || 0;
    const hargaJual = Number(m.hargaJual) || 0;
    const margin = hargaJual - hpp;
    const marginPct = hargaJual > 0 ? (margin / hargaJual) * 100 : 0;

    const menuNameStr = String(m.namaMenu || m.nama || 'Menu Tanpa Nama');
    const saleStat =
      salesByMenuId.get(String(m.id)) ||
      salesByMenuName.get(menuNameStr.toLowerCase()) || {
        terjual: 0,
        jatah: 0,
        omset: 0,
        cogs: 0,
      };

    const terjual = saleStat.terjual;
    const jatah = saleStat.jatah;
    const totalOmset = saleStat.omset > 0 ? saleStat.omset : terjual * hargaJual;
    const totalCogs = saleStat.cogs > 0 ? saleStat.cogs : (terjual + jatah) * hpp;
    const totalProfit = totalOmset - totalCogs;

    return {
      id: String(m.id || menuNameStr || ''),
      namaMenu: menuNameStr,
      kategori: String(m.kategori || 'Signature'),
      hargaJual,
      hpp,
      margin,
      marginPct,
      resep,
      terjual,
      jatah,
      totalOmset,
      totalCogs,
      totalProfit,
    };
  });

  // Recompute grand totals from menu breakdown if dailySales had menuSales
  const menuComputedOmset = normalizedMenus.reduce((s, m) => s + m.totalOmset, 0);
  const menuComputedCogs = normalizedMenus.reduce((s, m) => s + m.totalCogs, 0);
  const finalOmset = grandTotalOmset > 0 ? grandTotalOmset : menuComputedOmset;
  const finalCogs = grandTotalCogs > 0 ? grandTotalCogs : menuComputedCogs;

  const avgMarginPct =
    normalizedMenus.length > 0
      ? normalizedMenus.reduce((s, m) => s + m.marginPct, 0) / normalizedMenus.length
      : 0;

  const sortedByMarginDesc = [...normalizedMenus].sort((a, b) => b.marginPct - a.marginPct);
  const sortedByMarginAsc = [...normalizedMenus].sort((a, b) => a.marginPct - b.marginPct);
  const sortedByProfitDesc = [...normalizedMenus].sort((a, b) => b.margin - a.margin);
  const sortedBySoldDesc = [...normalizedMenus].sort((a, b) => b.terjual - a.terjual);
  const sortedIngByUnitCost = [...normalizedIngredients].sort(
    (a, b) => b.biayaPerTakaranDefault - a.biayaPerTakaranDefault
  );

  return {
    menus: normalizedMenus,
    ingredients: normalizedIngredients,
    summary: {
      totalMenus: normalizedMenus.length,
      totalIngredients: normalizedIngredients.length,
      totalDays: totalDays || dailySales.length,
      totalCupsSold: grandTotalCups,
      totalJatahCups: grandTotalJatah,
      totalOmset: finalOmset,
      totalCogs: finalCogs,
      totalGrossProfit: finalOmset - finalCogs,
      avgMarginPct,
      highestMarginMenu: sortedByMarginDesc[0] || null,
      lowestMarginMenu: sortedByMarginAsc[0] || null,
      mostProfitableRpMenu: sortedByProfitDesc[0] || null,
      bestSellerMenu: sortedBySoldDesc[0] || null,
      highRiskMenus: sortedByMarginAsc.filter((m) => m.marginPct < 55),
      starMenus: sortedByMarginDesc.filter((m) => m.marginPct >= 65),
      topExpensiveIngredients: sortedIngByUnitCost.slice(0, 8),
      topBestSellers: sortedBySoldDesc.filter((m) => m.terjual > 0).slice(0, 8),
    },
  };
}

/**
 * Generates an accurate, recipe-aware HPP & Menu Engineering response (Claude / Gemini style)
 */
export function generateSmartHppForumReply(params: {
  provider?: AiProvider;
  question: string;
  selectedMenuId?: string | null;
  menuCatalog: any[];
  rawIngredients: any[];
  dailySales: any[];
}): string {
  const {
    provider = 'claude',
    question,
    selectedMenuId,
    menuCatalog = [],
    rawIngredients = [],
    dailySales = [],
  } = params;

  const db = normalizeHppForumDatabase(menuCatalog, rawIngredients, dailySales);
  const { menus, ingredients, summary } = db;
  const badge = provider === 'claude' ? 'Claude 3.7 HPP & Menu Engineer' : 'Gemini 2.5 HPP & Menu Engineer';
  const q = (question || '').toLowerCase();

  // Check if user selected a specific menu or mentioned a menu name in their question
  let focusedMenu: NormalizedForumMenu | undefined = selectedMenuId
    ? menus.find((m) => m.id === selectedMenuId || m.namaMenu === selectedMenuId)
    : undefined;

  if (!focusedMenu) {
    focusedMenu = menus.find(
      (m) => m.namaMenu && q.includes(m.namaMenu.toLowerCase()) && m.namaMenu.length >= 4
    );
  }

  // 1. Focused single-menu deep dive if selectedMenu is active and question asks about it or general breakdown
  if (
    focusedMenu &&
    (q.includes('bedah') ||
      q.includes('resep') ||
      q.includes('fokus') ||
      q.includes(focusedMenu.namaMenu.toLowerCase()) ||
      q.includes('menu ini') ||
      q.includes('margin') ||
      q.includes('harga'))
  ) {
    const idealPrice65 = Math.ceil(focusedMenu.hpp / (1 - 0.65) / 500) * 500;
    const idealPrice70 = Math.ceil(focusedMenu.hpp / (1 - 0.7) / 500) * 500;
    const sortedResep = [...focusedMenu.resep].sort((a, b) => b.biaya - a.biaya);
    const resepLines =
      sortedResep.length > 0
        ? sortedResep
            .map(
              (r, idx) =>
                `${idx + 1}. **${r.namaBahan}**: ${r.jumlahTakaran} ${r.satuanTakaran} → **${formatRp(r.biaya)}** (${
                  focusedMenu.hpp > 0 ? ((r.biaya / focusedMenu.hpp) * 100).toFixed(1) : 0
                }% dari HPP)`
            )
            .join('\n')
        : '- Belum ada rincian bahan baku pada resep menu ini.';

    return `### Bedah Resep & HPP Menu: **${focusedMenu.namaMenu}** (${focusedMenu.kategori}) — *${badge}*

- **Harga Jual Saat Ini**: **${formatRp(focusedMenu.hargaJual)}**
- **Total HPP Resep per Porsi/Cup**: **${formatRp(focusedMenu.hpp)}** (**COGS ${(100 - focusedMenu.marginPct).toFixed(1)}%**)
- **Gross Profit (Margin Kotor)**: **${formatRp(focusedMenu.margin)} / porsi** (**Margin ${focusedMenu.marginPct.toFixed(1)}%**)
- **Performa Penjualan Tercatat**: Terjual **${focusedMenu.terjual} cup/porsi** (Jatah: ${focusedMenu.jatah}) | Omset: **${formatRp(focusedMenu.totalOmset)}** | Profit Kotor: **${formatRp(focusedMenu.totalProfit)}**

#### Komposisi Biaya Bahan Baku (Diurutkan dari Termahal):
${resepLines}

#### Rekomendasi *Pricing* & Efisiensi Resep:
- **Simulasi Harga Jual Ideal**:
  - Target Margin **65% (COGS 35%)**: Harga jual ideal **${formatRp(idealPrice65)}** (Laba **${formatRp(idealPrice65 - focusedMenu.hpp)}/cup**)
  - Target Margin **70% (COGS 30%)**: Harga jual ideal **${formatRp(idealPrice70)}** (Laba **${formatRp(idealPrice70 - focusedMenu.hpp)}/cup**)
- **Saran Optimasi**: ${
      sortedResep[0]
        ? `Komponen biaya tertinggi pada menu ini adalah **${sortedResep[0].namaBahan}** (${formatRp(sortedResep[0].biaya)}). Kalibrasi takaran **${sortedResep[0].namaBahan}** sebesar 5%–10% atau negosiasi harga beli kemasan grosir akan langsung meningkatkan margin menu ini.`
        : 'Pastikan seluruh bahan kemasan (cup, tutup, sedotan) sudah tercatat di dalam resep.'
    }`;
  }

  // 2. High-risk / low-margin / COGS tinggi question
  if (q.includes('berisiko') || q.includes('cogs tinggi') || q.includes('margin rendah') || q.includes('tipis') || q.includes('rugi')) {
    const worstMenus = [...menus].sort((a, b) => a.marginPct - b.marginPct).slice(0, 6);
    const rows = worstMenus
      .map((m, i) => {
        const recPrice = Math.ceil(m.hpp / 0.35 / 500) * 500;
        const topIng = [...m.resep].sort((a, b) => b.biaya - a.biaya)[0];
        return `${i + 1}. **${m.namaMenu}** (${m.kategori}) — Harga Jual: **${formatRp(m.hargaJual)}** | HPP: **${formatRp(m.hpp)}** | **Margin: ${m.marginPct.toFixed(1)}%** (${formatRp(m.margin)}/cup)\n   - *Penyebab Utama*: ${
          topIng ? `${topIng.namaBahan} (${formatRp(topIng.biaya)})` : 'Biaya bahan tinggi'
        } → *Saran Harga Ideal (Margin 65%)*: **${formatRp(recPrice)}**`;
      })
      .join('\n');

    return `### Audit Menu Berisiko (COGS Tinggi / Margin Rendah) — *${badge}*
Dari total **${summary.totalMenus} menu** di katalog Basco, rata-rata *Gross Margin* adalah **${summary.avgMarginPct.toFixed(1)}%**. Berikut adalah **6 menu dengan persentase margin terendah (COGS tertinggi)** yang memerlukan evaluasi resep atau penyesuaian harga:

${rows}

#### Kesimpulan & Tindakan Cepat:
- Terdapat **${summary.highRiskMenus.length} menu** dengan margin di bawah batas aman **55% (COGS >45%)**.
- **Opsi 1 (Re-engineering Takaran)**: Kurangi 3–5 ml/gr pada sirup/susu/bahan utama tanpa mengubah profil rasa secara drastis.
- **Opsi 2 (Penyesuaian Harga Bertahap)**: Naikkan harga jual Rp 1.000 – Rp 2.000 khusus pada menu di atas atau jadikan menu *add-on/upsell* bersama menu bermargin >70%.`;
  }

  // 3. Most expensive raw ingredients question
  if (q.includes('bahan baku') || q.includes('paling mahal') || q.includes('supplier') || q.includes('komponen') || q.includes('menguras')) {
    const topIngs = summary.topExpensiveIngredients;
    const ingLines = topIngs
      .map(
        (ing, idx) =>
          `${idx + 1}. **${ing.namaBahan}** — Harga Beli: **${formatRp(ing.hargaBeli)}** / ${ing.satuanBeli} ${ing.satuanTakaran} (**${formatRp(ing.hargaPerUnit)} per ${ing.satuanTakaran}** | Takaran Standar: ${ing.takaranPerCup} ${ing.satuanTakaran} = **${formatRp(ing.biayaPerTakaranDefault)}/cup**)`
      )
      .join('\n');

    // Also count which ingredients appear in the most recipes
    const usageCount = new Map<string, { count: number; totalCostAcrossMenus: number }>();
    menus.forEach((m) => {
      m.resep.forEach((r) => {
        const prev = usageCount.get(r.namaBahan) || { count: 0, totalCostAcrossMenus: 0 };
        prev.count += 1;
        prev.totalCostAcrossMenus += r.biaya;
        usageCount.set(r.namaBahan, prev);
      });
    });
    const mostUsed = Array.from(usageCount.entries())
      .sort((a, b) => b[1].totalCostAcrossMenus - a[1].totalCostAcrossMenus)
      .slice(0, 5)
      .map(
        ([name, stat], i) =>
          `${i + 1}. **${name}**: dipakai di **${stat.count} menu** (rata-rata beban HPP **${formatRp(stat.totalCostAcrossMenus / Math.max(1, stat.count))}/menu**)`
      )
      .join('\n');

    return `### Audit Bahan Baku Paling Menguras HPP — *${badge}*
Berdasarkan **${summary.totalIngredients} bahan baku** di database **Bahan Baku & Resep**, berikut adalah bahan dengan **biaya per takaran tertinggi**:

${ingLines}

#### Bahan Baku dengan Dampak Terluas di Katalog Menu:
${mostUsed}

#### Strategi Efisiensi Pengadaan:
- **Prioritas Negosiasi Supplier**: Fokuskan kontrak harga grosir/kartonan pada **3 bahan teratas** karena penurunan harga beli 10% saja akan langsung memangkas HPP di puluhan menu sekaligus.
- **Kontrol *Wastage* & Kalibrasi Bar**: Gunakan *jigger*, *pump* terukur, dan timbangan digital presisi untuk bahan-bahan di atas agar tidak terjadi *over-pouring* oleh barista.`;
  }

  // 4. Ideal selling price / target margin 65-70%
  if (q.includes('rekomendasi harga') || q.includes('harga jual ideal') || q.includes('65%') || q.includes('70%') || q.includes('simulasi harga')) {
    const needAdjustment = [...menus]
      .filter((m) => m.marginPct < 65)
      .sort((a, b) => a.marginPct - b.marginPct)
      .slice(0, 8);

    const listToAdjust =
      needAdjustment.length > 0
        ? needAdjustment
            .map((m, i) => {
              const target65 = Math.ceil(m.hpp / 0.35 / 500) * 500;
              const target70 = Math.ceil(m.hpp / 0.3 / 500) * 500;
              return `${i + 1}. **${m.namaMenu}** — HPP: **${formatRp(m.hpp)}** | Harga Sekarang: **${formatRp(m.hargaJual)}** (Margin ${m.marginPct.toFixed(1)}%)\n   - Harga Ideal Margin **65%**: **${formatRp(target65)}** (+${formatRp(Math.max(0, target65 - m.hargaJual))}) | Margin **70%**: **${formatRp(target70)}**`;
            })
            .join('\n')
        : '- Seluruh menu Anda sudah memiliki margin di atas 65%!';

    return `### Simulasi Rekomendasi Harga Jual Ideal (Target Margin 65%–70%) — *${badge}*
Standar sehat industri *coffee shop* menetapkan **Gross Margin 65%–70%** (COGS 30%–35%) agar mampu menutup biaya gaji, listrik, sewa, dan menghasilkan laba bersih >15%.

#### Daftar Menu Prioritas Penyesuaian Harga:
${listToAdjust}

#### Menu yang Sudah Mencapai Margin Bintang (>70%):
${menus
  .filter((m) => m.marginPct >= 70)
  .slice(0, 5)
  .map((m) => `- **${m.namaMenu}**: Harga **${formatRp(m.hargaJual)}** | HPP **${formatRp(m.hpp)}** → **Margin ${m.marginPct.toFixed(1)}%** (Laba ${formatRp(m.margin)}/cup)`)
  .join('\n')}`;
  }

  // 5. Bundling / Promo / Best seller strategy
  if (q.includes('bundling') || q.includes('paket') || q.includes('promo') || q.includes('laris') || q.includes('penjualan')) {
    const highMargin = [...menus].sort((a, b) => b.marginPct - a.marginPct);
    const highSold = summary.topBestSellers.length > 0 ? summary.topBestSellers : [...menus].sort((a, b) => b.margin - a.margin);

    const star1 = highSold[0] || menus[0];
    const partner1 = highMargin.find((m) => m.id !== star1?.id && m.marginPct >= 65) || highMargin[0];
    const star2 = highSold[1] || menus[1] || star1;
    const partner2 = highMargin.find((m) => m.id !== star2?.id && m.id !== partner1?.id) || highMargin[1] || partner1;

    const bundle1Normal = (star1?.hargaJual || 0) + (partner1?.hargaJual || 0);
    const bundle1Hpp = (star1?.hpp || 0) + (partner1?.hpp || 0);
    const bundle1Promo = Math.floor((bundle1Normal * 0.9) / 500) * 500;
    const bundle1Margin = bundle1Promo - bundle1Hpp;
    const bundle1Pct = bundle1Promo > 0 ? (bundle1Margin / bundle1Promo) * 100 : 0;

    const bundle2Normal = (star2?.hargaJual || 0) + (partner2?.hargaJual || 0);
    const bundle2Hpp = (star2?.hpp || 0) + (partner2?.hpp || 0);
    const bundle2Promo = Math.floor((bundle2Normal * 0.9) / 500) * 500;
    const bundle2Margin = bundle2Promo - bundle2Hpp;
    const bundle2Pct = bundle2Promo > 0 ? (bundle2Margin / bundle2Promo) * 100 : 0;

    const topSalesText =
      summary.topBestSellers.length > 0
        ? summary.topBestSellers
            .slice(0, 5)
            .map(
              (m, i) =>
                `${i + 1}. **${m.namaMenu}**: Terjual **${m.terjual} cup** | Omset **${formatRp(m.totalOmset)}** | Laba Kotor **${formatRp(m.totalProfit)}** (Margin ${m.marginPct.toFixed(1)}%)`
            )
            .join('\n')
        : '- Data penjualan per item siap dianalisis; gunakan kombinasi menu bermargin tertinggi di bawah ini.';

    return `### Strategi Paket Bundling & Analisis Penjualan Menu — *${badge}*

#### Performa Penjualan Menu Teratas (${summary.totalDays} Hari Pencatatan):
- **Total Terjual**: **${summary.totalCupsSold} cup/porsi** (Jatah Harian: ${summary.totalJatahCups} cup)
- **Total Omset Penjualan Menu**: **${formatRp(summary.totalOmset)}**
- **Total HPP Terpakai**: **${formatRp(summary.totalCogs)}** | **Estimasi Laba Kotor**: **${formatRp(summary.totalGrossProfit)}**
${topSalesText}

#### 2 Rekomendasi Paket Bundling Cuan Tinggi (Diskon 10% Tanpa Menggerus Margin):
1. **Paket Signature Duo: ${star1?.namaMenu} + ${partner1?.namaMenu}**
   - Harga Normal: ${formatRp(bundle1Normal)} → **Harga Bundling Promo: ${formatRp(bundle1Promo)}**
   - Total HPP Gabungan: **${formatRp(bundle1Hpp)}**
   - **Laba Kotor per Paket: ${formatRp(bundle1Margin)} (Margin ${bundle1Pct.toFixed(1)}%)**
2. **Paket Nongkrong Hemat: ${star2?.namaMenu} + ${partner2?.namaMenu}**
   - Harga Normal: ${formatRp(bundle2Normal)} → **Harga Bundling Promo: ${formatRp(bundle2Promo)}**
   - Total HPP Gabungan: **${formatRp(bundle2Hpp)}**
   - **Laba Kotor per Paket: ${formatRp(bundle2Margin)} (Margin ${bundle2Pct.toFixed(1)}%)**`;
  }

  // Default comprehensive overview of HPP & Menu Sales database
  const top3Profit = [...menus].sort((a, b) => b.margin - a.margin).slice(0, 3);
  const bottom3Margin = [...menus].sort((a, b) => a.marginPct - b.marginPct).slice(0, 3);

  return `### Analisis Database HPP, Resep & Penjualan Menu — *${badge}*
Berikut hasil analisis menyeluruh untuk pertanyaan Anda (*"${question}"*) berdasarkan data *real-time* Google Spreadsheet:

#### 1. Ringkasan Katalog & Realisasi Penjualan
- **Total Katalog Aktif**: **${summary.totalMenus} Menu** & **${summary.totalIngredients} Bahan Baku**
- **Rata-rata Gross Margin Katalog**: **${summary.avgMarginPct.toFixed(1)}%** (Rata-rata COGS **${(100 - summary.avgMarginPct).toFixed(1)}%**)
- **Realisasi Penjualan (${summary.totalDays} Hari)**: **${summary.totalCupsSold} Cup Terjual** | Omset **${formatRp(summary.totalOmset)}** | Total HPP **${formatRp(summary.totalCogs)}** | **Laba Kotor ${formatRp(summary.totalGrossProfit)}**

#### 2. Menu Paling Menguntungkan (Margin Rupiah Tertinggi)
${top3Profit
  .map(
    (m, i) =>
      `${i + 1}. **${m.namaMenu}** (${m.kategori}) — Harga: **${formatRp(m.hargaJual)}** | HPP: **${formatRp(m.hpp)}** → **Laba ${formatRp(m.margin)}/cup (${m.marginPct.toFixed(1)}%)**`
  )
  .join('\n')}

#### 3. Menu yang Perlu Evaluasi HPP (Margin Persentase Terendah)
${bottom3Margin
  .map(
    (m, i) =>
      `${i + 1}. **${m.namaMenu}** (${m.kategori}) — Harga: **${formatRp(m.hargaJual)}** | HPP: **${formatRp(m.hpp)}** → **Margin ${m.marginPct.toFixed(1)}%** (Saran Harga 65%: **${formatRp(Math.ceil(m.hpp / 0.35 / 500) * 500)}**)`
  )
  .join('\n')}

*Tips: Anda dapat memilih menu spesifik pada dropdown **"Fokus Analisis Menu"** di atas atau mengetik nama menu untuk membedah takaran gramasi dan biaya tiap bahan bakunya.*`;
}

/**
 * Generates an accurate Debt & Cashflow Feasibility Analysis (Claude / Gemini style)
 */
export function generateSmartDebtAnalysis(params: {
  provider?: AiProvider;
  debtSummary: any;
  cashflowSummary: any;
}): string {
  const { provider = 'claude', debtSummary = {}, cashflowSummary = {} } = params;
  const badge = provider === 'claude' ? 'Claude 3.7 Debt & Risk Advisor' : 'Gemini 2.5 Debt & Risk Advisor';

  const totalRemaining = Number(debtSummary.totalActiveDebtRemaining || 0);
  const monthlyObligation = Number(debtSummary.totalMonthlyObligation || 0);
  const dsr = Number(debtSummary.dsrPercentage || 0);
  const dsrStatus = String(debtSummary.dsrStatus || 'Aman');
  const avgMonthlyNet = Number(cashflowSummary.avgMonthlyNetProfit || 0);
  const avgMonthlyDebit = Number(cashflowSummary.avgMonthlyIncome || 0);
  const freeCashAfterDebt = avgMonthlyNet - monthlyObligation;

  const activeList = Array.isArray(debtSummary.activeDebtsList) ? debtSummary.activeDebtsList : [];
  const sortedPriority = [...activeList].sort(
    (a, b) => (Number(a.sisaPokok) || 0) - (Number(b.sisaPokok) || 0)
  );

  const listMarkdown =
    sortedPriority.length > 0
      ? sortedPriority
          .slice(0, 6)
          .map(
            (d, idx) =>
              `${idx + 1}. **${d.nama}** (${d.kreditur || 'Supplier/Kreditur'}) — Sisa Kewajiban: **${formatRp(d.sisaPokok)}** | Tagihan/Cicilan: **${formatRp(d.cicilanPerBulan)}** (Jatuh Tempo: ${d.jatuhTempo || '-'})`
          )
          .join('\n')
      : '- Tidak ada kewajiban hutang aktif yang tercatat saat ini.';

  return `### 1. Evaluasi Kesehatan Rasio Hutang (DSR) — *${badge}*
- **Total Sisa Kewajiban / Hutang Aktif**: **${formatRp(totalRemaining)}** (${activeList.length} item aktif)
- **Beban Tagihan / Cicilan Bulanan**: **${formatRp(monthlyObligation)} / bulan**
- **Rata-rata Laba Kas Bersih Bulanan**: **${formatRp(avgMonthlyNet)}** (dari rata-rata omset **${formatRp(avgMonthlyDebit)}/bulan**)
- **Debt Service Ratio (DSR)**: **${dsr.toFixed(1)}%** — Status: **${dsrStatus.toUpperCase()}** (Standar sehat perbankan & F&B: **<30%**)
- **Sisa Kas Bebas Setelah Tagihan (*Free Cashflow*)**: **${formatRp(freeCashAfterDebt)} / bulan**

### 2. Urutan Prioritas Pelunasan (*Debt Snowball & Jatuh Tempo Tempo Supplier*)
${listMarkdown}

### 3. Rekomendasi Strategis Manajemen Kas
- **Prioritaskan Tempo Supplier Bahan Baku**: Lunasi terlebih dahulu tagihan *Belum Lunas / Tempo* kepada supplier bahan baku harian agar pasokan bar (kopi, susu, flavor) tidak terhambat dan Anda bisa meminta diskon pembelian tunai.
- **Alokasi Sinking Fund Harian**: Sisihkan **${formatRp(Math.ceil(monthlyObligation / 30))} per hari** dari hasil penjualan kasir ke rekening terpisah khusus pembayaran tagihan jatuh tempo.
- **Batas Aman Penambahan Kewajiban Baru**: ${
    dsr < 30 && freeCashAfterDebt > 0
      ? `Arus kas masih memiliki ruang aman sebesar **${formatRp(Math.max(0, avgMonthlyNet * 0.3 - monthlyObligation))}/bulan** jika ingin mengambil fasilitas tempo/cicilan alat produktif baru.`
      : `Hindari menambah hutang/tempo baru hingga DSR turun kembali ke bawah **30%** dan tagihan tempo pendek selesai dilunasi.`
  }`;
}
