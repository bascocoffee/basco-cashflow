import { Transaction, CafeRatioGroup, CafeRatioCategoryConfig } from '../types';

export const DEFAULT_CAFE_RATIO_CONFIG: CafeRatioCategoryConfig = {
  mode: 'auto',
  salesMode: 'all_debit',
  selectedSalesCategories: [],
  categoryMapping: {}
};

export const CAFE_RATIO_GROUP_INFO: Record<CafeRatioGroup, {
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  targetText: string;
  badgeBg: string;
}> = {
  cogs_minuman: {
    label: 'HPP Minuman (Coffee, Milk, Syrup, dll)',
    shortLabel: 'HPP Minuman',
    icon: '🥤',
    description: 'Bahan baku minuman, susu, biji kopi, sirup, es kristal, krimer, boba, rasa',
    targetText: 'Target: 15% - 22% Omset',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-300'
  },
  cogs_food: {
    label: 'HPP Makanan (Food / Kitchen)',
    shortLabel: 'HPP Makanan',
    icon: '🍔',
    description: 'Bahan baku makanan utama, ayam, mie, nasi, daging, saus, bumbu dapur',
    targetText: 'Target: 8% - 15% Omset',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  cogs_snack: {
    label: 'HPP Cemilan (Snack / Pastry)',
    shortLabel: 'HPP Cemilan',
    icon: '🍟',
    description: 'Bahan cemilan, kentang goreng, dimsum, roti, pastry, keripik, cireng',
    targetText: 'Target: 4% - 8% Omset',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-300'
  },
  cogs_general: {
    label: 'HPP Bahan Baku Umum / Campuran',
    shortLabel: 'HPP Umum',
    icon: '📦',
    description: 'Bahan baku gabungan atau COGS umum cafe',
    targetText: 'Target Total HPP: <35%',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  wages: {
    label: 'Gaji Karyawan & Barista (Labor Cost)',
    shortLabel: 'Gaji & Staff',
    icon: '👥',
    description: 'Gaji pokok, upah harian, lembur, uang kehadiran, tunjangan & bonus barista/staff',
    targetText: 'Target: 15% - 25% Omset',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300'
  },
  operasional: {
    label: 'Operasional, Sewa & Utilitas (Opex)',
    shortLabel: 'Operasional & Sewa',
    icon: '🏢',
    description: 'Sewa ruko/tempat, listrik PLN, air PDAM, internet/wifi, gas LPG, kebersihan, ATK',
    targetText: 'Target: <20% Omset',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300'
  },
  promo: {
    label: 'Promosi & Marketing',
    shortLabel: 'Promosi',
    icon: '📣',
    description: 'Iklan media sosial, cetak brosur, diskon promosi, event, endorse / influencer',
    targetText: 'Target: 3% - 7% Omset',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-300'
  },
  other: {
    label: 'Lain-lain / Non-Rasio Operasional',
    shortLabel: 'Lain-lain / Non-Rasio',
    icon: '⚪',
    description: 'Pajak, administrasi bank, investasi peralatan, prive pemilik, renovasi, atau lainnya',
    targetText: 'Overhead / Non-Rasio',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-300'
  }
};

/**
 * Intelligent keyword-based detector for Cafe and Coffee Shop categories and item descriptions
 */
export function detectCategoryGroup(catName: string, desc?: string): CafeRatioGroup {
  const norm = (catName || '').toLowerCase().trim();
  const normDesc = (desc || '').toLowerCase().trim();

  // 1. Explicit wifi/internet to Operasional
  if (
    norm.includes('i connect') || norm.includes('iconnect') || norm.includes('i-connect') ||
    normDesc.includes('i connect') || normDesc.includes('iconnect') || normDesc.includes('i-connect') ||
    norm.includes('wifi') || normDesc.includes('wifi') ||
    norm.includes('internet') || normDesc.includes('internet') ||
    norm.includes('indihome') || normDesc.includes('indihome') ||
    norm.includes('biznet') || normDesc.includes('biznet') ||
    norm.includes('myrepublic') || normDesc.includes('myrepublic')
  ) {
    return 'operasional';
  }

  // 2. Specific ingredients to COGS Drink
  if (
    norm.includes('wedang uwuh') || norm.includes('wedang') || norm.includes('uwuh') ||
    normDesc.includes('wedang uwuh') || normDesc.includes('wedang') || normDesc.includes('uwuh') ||
    norm.includes('kreamer') || norm.includes('creamer') || norm.includes('krimer') ||
    norm.includes('fiber creme') || norm.includes('max creamer') ||
    normDesc.includes('kreamer') || normDesc.includes('creamer') || normDesc.includes('krimer') ||
    normDesc.includes('fiber creme') || normDesc.includes('max creamer') ||
    norm.includes('es krim vanilla') || norm.includes('eskrim vanilla') || norm.includes('ice cream vanilla') ||
    norm.includes('es krim') || norm.includes('eskrim') || norm.includes('ice cream') || norm.includes('es cream') ||
    norm.includes('vanilla') || norm.includes('vanila') ||
    normDesc.includes('es krim vanilla') || normDesc.includes('eskrim vanilla') || normDesc.includes('ice cream vanilla') ||
    normDesc.includes('es krim') || normDesc.includes('eskrim') || normDesc.includes('ice cream') || normDesc.includes('es cream') ||
    normDesc.includes('vanilla') || normDesc.includes('vanila') ||
    norm.includes('air galon') || norm.includes('galon') ||
    normDesc.includes('air galon') || normDesc.includes('galon')
  ) {
    return 'cogs_minuman';
  }

  // 3. Oil, LPG, Gas, Chopsticks to COGS Food
  if (
    norm.includes('minyak') || normDesc.includes('minyak') ||
    norm.includes('lpg') || normDesc.includes('lpg') ||
    norm.includes('gas') || normDesc.includes('gas') ||
    norm.includes('sumpit') || normDesc.includes('sumpit')
  ) {
    return 'cogs_food';
  }

  // 4. Payroll / Gaji / Wages
  if (
    norm.includes('gaji') || norm.includes('karyawan') || norm.includes('barista') ||
    norm.includes('pekerjaan') || norm.includes('staff') || norm.includes('salary') ||
    norm.includes('payroll') || norm.includes('upah') || norm.includes('pendidikan') ||
    normDesc.includes('gaji') || normDesc.includes('upah') || normDesc.includes('gaji barista') ||
    normDesc.includes('salary') || normDesc.includes('payroll') || normDesc.includes('bonus staff') ||
    norm.includes('honor') || normDesc.includes('honor') || norm.includes('kasbon') || normDesc.includes('kasbon') ||
    norm.includes('lembur') || normDesc.includes('lembur') || norm.includes('overtime') ||
    norm.includes('thr') || normDesc.includes('thr') || norm.includes('uang makan') || normDesc.includes('uang makan')
  ) {
    return 'wages';
  }

  // 5. Operasional, Sewa, Kebersihan (Sabun dll), Transportasi/Parkir & Utilitas
  if (
    // Kebersihan & Cuci (Sabun cuci, deterjen, pel, sponge dll)
    norm.includes('sabun') || normDesc.includes('sabun') ||
    norm.includes('cuci') || normDesc.includes('cuci') ||
    norm.includes('deterjen') || normDesc.includes('deterjen') ||
    norm.includes('sunlight') || normDesc.includes('sunlight') ||
    norm.includes('mama lemon') || normDesc.includes('mama lemon') ||
    norm.includes('pembersih') || normDesc.includes('pembersih') ||
    norm.includes('pel') || normDesc.includes('pel') ||
    norm.includes('karbol') || normDesc.includes('karbol') ||
    norm.includes('sikat') || normDesc.includes('sikat') ||
    norm.includes('sponge') || normDesc.includes('sponge') || norm.includes('spon') || normDesc.includes('spon') ||
    norm.includes('kebersihan') || normDesc.includes('kebersihan') ||
    // Transportasi & Parkir (Transport, parkir, bensin, bbm dll)
    norm.includes('transport') || normDesc.includes('transport') ||
    norm.includes('transportasi') || normDesc.includes('transportasi') ||
    norm.includes('parkir') || normDesc.includes('parkir') ||
    norm.includes('bensin') || normDesc.includes('bensin') ||
    norm.includes('bbm') || normDesc.includes('bbm') ||
    norm.includes('pertalite') || normDesc.includes('pertalite') ||
    norm.includes('pertamax') || normDesc.includes('pertamax') ||
    norm.includes('solar') || normDesc.includes('solar') ||
    norm.includes('ongkir') || normDesc.includes('ongkir') ||
    norm.includes('kurir') || normDesc.includes('kurir') ||
    norm.includes('ekspedisi') || normDesc.includes('ekspedisi') ||
    norm.includes('grab') || normDesc.includes('grab') ||
    norm.includes('gojek') || normDesc.includes('gojek') ||
    norm.includes('ojol') || normDesc.includes('ojol') ||
    // Tagihan & Sewa & Utilitas
    norm.includes('bayar tagihan') || normDesc.includes('bayar tagihan') ||
    norm.includes('tagihan') || normDesc.includes('tagihan') ||
    norm.includes('operasional') || norm.includes('sewa') || norm.includes('tempat') ||
    norm.includes('utilitas') || norm.includes('rumah') ||
    norm.includes('listrik') || norm.includes('pln') ||
    norm.includes('air') || norm.includes('pdam') ||
    norm.includes('kesehatan') || norm.includes('bpjs') ||
    norm.includes('peralatan') || norm.includes('inventaris') ||
    norm.includes('pajak') || norm.includes('administrasi') ||
    norm.includes('rent') || norm.includes('utility') || norm.includes('tax') || norm.includes('admin') ||
    normDesc.includes('sewa') || normDesc.includes('listrik') || normDesc.includes('pajak') ||
    norm.includes('atk') || normDesc.includes('atk') ||
    norm.includes('maintenance') || normDesc.includes('maintenance') ||
    norm.includes('servis') || normDesc.includes('servis') ||
    // Kemasan & Packaging
    norm.includes('packaging') || normDesc.includes('packaging') ||
    norm.includes('kemasan') || normDesc.includes('kemasan') ||
    norm.includes('paper cup') || normDesc.includes('paper cup') ||
    norm.includes('plastic cup') || normDesc.includes('plastic cup') ||
    norm.includes('cup sealer') || normDesc.includes('cup sealer') ||
    norm.includes('sedotan') || normDesc.includes('sedotan') ||
    norm.includes('straw') || normDesc.includes('straw') ||
    norm.includes('kresek') || normDesc.includes('kresek') ||
    norm.includes('plastik') || normDesc.includes('plastik') ||
    norm.includes('tissue') || normDesc.includes('tissue') || norm.includes('tisu') || normDesc.includes('tisu')
  ) {
    return 'operasional';
  }

  // 6. Promosi & Marketing
  if (
    norm.includes('promosi') || norm.includes('marketing') || norm.includes('iklan') ||
    norm.includes('ads') || norm.includes('promo') || norm.includes('hiburan') ||
    norm.includes('rekreasi') || norm.includes('event') || normDesc.includes('promo') ||
    normDesc.includes('iklan') || normDesc.includes('marketing') ||
    norm.includes('instagram') || normDesc.includes('instagram') ||
    norm.includes('tiktok') || normDesc.includes('tiktok') ||
    norm.includes('endorse') || normDesc.includes('endorse') ||
    norm.includes('brosur') || normDesc.includes('brosur') ||
    norm.includes('spanduk') || normDesc.includes('spanduk') ||
    norm.includes('banner') || normDesc.includes('banner')
  ) {
    return 'promo';
  }

  // 7. Check for Snack
  const isSnack = (str: string) => {
    const s = str.toLowerCase();
    return (
      s.includes('dimsum') || s.includes('singkong') || s.includes('kentang') ||
      s.includes('sewel') || s.includes('tahu walik') || s.includes('tahu') ||
      s.includes('walik') || s.includes('snack') || s.includes('cemilan') ||
      s.includes('keripik') || s.includes('camilan') || s.includes('pisang goreng') ||
      s.includes('risol') || s.includes('cireng') || s.includes('french fries') ||
      s.includes('croissant') || s.includes('kue') || s.includes('donut') ||
      s.includes('donat') || s.includes('saos delmonte') || s.includes('delmonte') ||
      s.includes('del monte') || s.includes('mayonaise') || s.includes('mayo') ||
      s.includes('nugget') || s.includes('toast') || s.includes('waffle') ||
      s.includes('pastry')
    );
  };

  // 8. Check for Food
  const isFood = (str: string) => {
    const s = str.toLowerCase();
    return (
      s.includes('totole') || s.includes('kaldu') || s.includes('kecap') ||
      s.includes('bawang putih') || s.includes('mie') || s.includes('daun bawang') ||
      s.includes('ayam') || s.includes('bawang goreng') || s.includes('bawang merah') ||
      s.includes('bawang') || s.includes('minyak bawang') ||
      s.includes('nasi') || s.includes('saus') || s.includes('sauce') ||
      s.includes('sambal') || s.includes('cabai') || s.includes('cabe') ||
      s.includes('telur') || s.includes('daging') || s.includes('beef') ||
      s.includes('chicken') || s.includes('ikan') || s.includes('udang') ||
      s.includes('bumbu') || s.includes('garam') || s.includes('lada') ||
      s.includes('merica') || s.includes('masako') || s.includes('royco') ||
      s.includes('minyak goreng') || s.includes('mentega') || s.includes('butter') ||
      s.includes('margarin') || s.includes('roti') || s.includes('sosis') ||
      s.includes('bakso') || s.includes('kornet') || s.includes('beras') ||
      s.includes('terigu') || s.includes('tepung') || s.includes('keju') || s.includes('cheese')
    );
  };

  // 9. Check for Minuman
  const isMinuman = (str: string) => {
    const s = str.toLowerCase();
    return (
      s.includes('kopi') || s.includes('coffee') || s.includes('espresso') ||
      s.includes('robusta') || s.includes('arabika') || s.includes('biji kopi') ||
      s.includes('beans') || s.includes('teh') || s.includes('tea') ||
      s.includes('matcha') || s.includes('soda') || s.includes('fanta') ||
      s.includes('sprite') || s.includes('coca') || s.includes('coke') ||
      s.includes('aqua') || s.includes('le minerale') || s.includes('air mineral') ||
      s.includes('air minum') || s.includes('susu') || s.includes('milk') ||
      s.includes('uht') || s.includes('full cream') || s.includes('fresh milk') ||
      s.includes('omela') || s.includes('dairy') || s.includes('skm') ||
      s.includes('kental manis') || s.includes('tiga sapi') || s.includes('carnation') ||
      s.includes('greenfields') || s.includes('ultra milk') || s.includes('frisian flag') ||
      s.includes('gula') || s.includes('sugar') || s.includes('sweetener') ||
      s.includes('gula aren') || s.includes('brown sugar') || s.includes('palm sugar') ||
      s.includes('es batu') || s.includes('ice cube') || s.includes('es kristal') ||
      s.includes('flavor') || s.includes('perisa') || s.includes('essen') ||
      s.includes('syrup') || s.includes('sirup') || s.includes('whipped cream') ||
      s.includes('whip cream') || s.includes('cream') || s.includes('creme') ||
      s.includes('jeruk') || s.includes('lemon') || s.includes('lime') ||
      s.includes('fruit') || s.includes('buah') || s.includes('mangga') ||
      s.includes('strawberry') || s.includes('lychee') || s.includes('leci') ||
      s.includes('coklat') || s.includes('cokelat') || s.includes('chocolate') ||
      s.includes('boba') || s.includes('yakult') || s.includes('jelly') ||
      s.includes('grass jelly') || s.includes('cincau') || s.includes('pudding') ||
      s.includes('buavita') || s.includes('diamond juice') || s.includes('diamond') ||
      s.includes('caramel') || s.includes('karamel') || s.includes('monin') ||
      s.includes('morin') || s.includes('torani') || s.includes('denali') ||
      s.includes('dripp') || s.includes('marjan') || s.includes('abc') ||
      s.includes('taro') || s.includes('red velvet') || s.includes('hazelnut') ||
      s.includes('pandan')
    );
  };

  if (isSnack(norm) || isSnack(normDesc)) return 'cogs_snack';
  if (isFood(norm) || isFood(normDesc)) return 'cogs_food';
  if (isMinuman(norm) || isMinuman(normDesc)) return 'cogs_minuman';

  // 10. General COGS keywords
  if (
    norm.includes('bahan baku') || norm.includes('hpp') || norm.includes('cogs') ||
    norm.includes('belanja') || norm.includes('makanan') || norm.includes('food') ||
    norm.includes('beverage') || norm.includes('minuman')
  ) {
    if (norm.includes('makanan') || norm.includes('food')) return 'cogs_food';
    if (norm.includes('snack') || norm.includes('cemilan')) return 'cogs_snack';
    if (norm.includes('minuman') || norm.includes('beverage') || norm.includes('drink')) return 'cogs_minuman';
    return 'cogs_general';
  }

  return 'other';
}

export interface ExtractedCategoryItem {
  name: string;
  totalAmount: number;
  count: number;
  type: 'debit' | 'kredit';
}

/**
 * Extract all unique categories present in the transactions array specifically from "Pengeluaran 1" (jenisPengeluaran).
 */
export function extractUniqueCategories(
  transactions: Transaction[],
  masterCategories: string[] = []
): {
  incomeCategories: ExtractedCategoryItem[];
  expenseCategories: ExtractedCategoryItem[];
} {
  const incomeMap: Record<string, { totalAmount: number; count: number }> = {};
  const expenseMap: Record<string, { totalAmount: number; count: number }> = {};

  // Aggregate from transactions strictly using "Pengeluaran 1" (t.jenisPengeluaran)
  transactions.forEach(t => {
    // 1. Income (Debit)
    if (t.debit > 0) {
      const rawCat = (t.jenisPengeluaran || '').trim();
      const cat = (rawCat && rawCat !== '-') ? rawCat : 'Pemasukan / Omset Cafe';
      if (!incomeMap[cat]) incomeMap[cat] = { totalAmount: 0, count: 0 };
      incomeMap[cat].totalAmount += t.debit;
      incomeMap[cat].count += 1;
    }

    // 2. Expenses (Kredit 1 + Kredit 2): strictly using "Pengeluaran 1" (t.jenisPengeluaran)
    const expenseAmount = (t.kredit || 0) + (t.kredit2 || 0);
    if (expenseAmount > 0) {
      const rawCat = (t.jenisPengeluaran || '').trim();
      const cat = (rawCat && rawCat !== '-') ? rawCat : 'Lain-lain';
      if (!expenseMap[cat]) expenseMap[cat] = { totalAmount: 0, count: 0 };
      expenseMap[cat].totalAmount += expenseAmount;
      expenseMap[cat].count += 1;
    }
  });

  // Only if no expense transactions exist and masterCategories were provided, fallback to master categories
  if (Object.keys(expenseMap).length === 0 && masterCategories.length > 0) {
    masterCategories.forEach(cat => {
      const norm = cat.trim();
      if (!norm || norm === '-') return;
      const lower = norm.toLowerCase();
      if (
        lower.includes('penjualan') || lower.includes('pendapatan') ||
        lower.includes('pemasukan') || lower.includes('omset')
      ) {
        if (!incomeMap[norm]) incomeMap[norm] = { totalAmount: 0, count: 0 };
      } else {
        if (!expenseMap[norm]) expenseMap[norm] = { totalAmount: 0, count: 0 };
      }
    });
  }

  const incomeCategories: ExtractedCategoryItem[] = Object.entries(incomeMap).map(([name, val]) => ({
    name,
    totalAmount: val.totalAmount,
    count: val.count,
    type: 'debit' as const
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  const expenseCategories: ExtractedCategoryItem[] = Object.entries(expenseMap).map(([name, val]) => ({
    name,
    totalAmount: val.totalAmount,
    count: val.count,
    type: 'kredit' as const
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  return { incomeCategories, expenseCategories };
}

/**
 * Generate default intelligent category mapping for all detected expense categories
 */
export function generateAutoCategoryMapping(categories: string[]): Record<string, CafeRatioGroup> {
  const mapping: Record<string, CafeRatioGroup> = {};
  categories.forEach(cat => {
    mapping[cat] = detectCategoryGroup(cat);
  });
  return mapping;
}

export interface CafeMetricsResult {
  totalSales: number;
  totalCOGS: number;
  totalCOGSDrink: number;
  totalCOGSFood: number;
  totalCOGSSnack: number;
  totalWages: number;
  totalOperasional: number;
  totalPromo: number;
  totalExpensesCalculated: number;
  cogsRatio: number;
  cogsDrinkRatio: number;
  cogsFoodRatio: number;
  cogsSnackRatio: number;
  wagesRatio: number;
  operasionalRatio: number;
  netProfitMargin: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingProfit: number;
  operatingProfitMargin: number;
  netProfit: number;
  cogsDetails: { tanggal: string; category: string; keterangan: string; amount: number; subCategory?: 'Minuman' | 'Food' | 'Snack' }[];
  wagesDetails: { tanggal: string; category: string; keterangan: string; amount: number }[];
  operasionalDetails: { tanggal: string; category: string; keterangan: string; amount: number }[];
  activeMode: 'auto' | 'manual';
  mappedCount: number;
}

/**
 * Compute complete Cafe KPI metrics & ratios taking into account automatic or manual configuration
 */
export function computeCafeMetricsWithConfig(
  transactions: Transaction[],
  config: CafeRatioCategoryConfig = DEFAULT_CAFE_RATIO_CONFIG
): CafeMetricsResult {
  let totalSales = 0;
  let totalCOGS = 0;
  let totalCOGSDrink = 0;
  let totalCOGSFood = 0;
  let totalCOGSSnack = 0;
  let totalWages = 0;
  let totalOperasional = 0;
  let totalPromo = 0;
  let totalExpensesCalculated = 0;

  const cogsDetails: { tanggal: string; category: string; keterangan: string; amount: number; subCategory?: 'Minuman' | 'Food' | 'Snack' }[] = [];
  const wagesDetails: { tanggal: string; category: string; keterangan: string; amount: number }[] = [];
  const operasionalDetails: { tanggal: string; category: string; keterangan: string; amount: number }[] = [];

  const isManual = config.mode === 'manual';
  const mapping = config.categoryMapping || {};
  const mappedCount = Object.keys(mapping).length;

  const getEffectiveGroup = (catName: string, desc?: string): CafeRatioGroup => {
    if (isManual) {
      if (mapping[catName]) return mapping[catName];
      // Fallback for unmapped category in manual mode
      return detectCategoryGroup(catName, desc);
    }
    return detectCategoryGroup(catName, desc);
  };

  transactions.forEach(t => {
    // 1. Process Income (Sales / Omset)
    if (t.debit > 0) {
      if (!isManual || config.salesMode === 'all_debit') {
        totalSales += t.debit;
      } else {
        const cat = (t.jenisPengeluaran || '').trim();
        if (config.selectedSalesCategories && config.selectedSalesCategories.includes(cat)) {
          totalSales += t.debit;
        }
      }
    }

    // 2. Process Expenses (Kredit 1 + Kredit 2)
    // Strictly categorized using "Pengeluaran 1" (t.jenisPengeluaran) from Aliran Data & Filter
    const expenseAmount = (t.kredit || 0) + (t.kredit2 || 0);
    if (expenseAmount > 0) {
      totalExpensesCalculated += expenseAmount;
      const rawCat = (t.jenisPengeluaran || '').trim();
      const cat1 = (rawCat && rawCat !== '-') ? rawCat : 'Lain-lain';
      const grp = getEffectiveGroup(cat1, t.keterangan);

      if (grp === 'wages') {
        totalWages += expenseAmount;
        wagesDetails.push({
          tanggal: t.tanggal,
          category: cat1,
          keterangan: t.keterangan || '-',
          amount: expenseAmount
        });
      } else if (grp === 'promo') {
        totalPromo += expenseAmount;
      } else if (grp.startsWith('cogs_')) {
        totalCOGS += expenseAmount;
        let subCategory: 'Minuman' | 'Food' | 'Snack' = 'Minuman';

        if (grp === 'cogs_food') {
          totalCOGSFood += expenseAmount;
          subCategory = 'Food';
        } else if (grp === 'cogs_snack') {
          totalCOGSSnack += expenseAmount;
          subCategory = 'Snack';
        } else if (grp === 'cogs_minuman') {
          totalCOGSDrink += expenseAmount;
          subCategory = 'Minuman';
        } else {
          // cogs_general: check description and category keyword
          const autoSub = detectCategoryGroup(cat1, t.keterangan);
          if (autoSub === 'cogs_food') {
            totalCOGSFood += expenseAmount;
            subCategory = 'Food';
          } else if (autoSub === 'cogs_snack') {
            totalCOGSSnack += expenseAmount;
            subCategory = 'Snack';
          } else {
            totalCOGSDrink += expenseAmount;
            subCategory = 'Minuman';
          }
        }

        cogsDetails.push({
          tanggal: t.tanggal,
          category: cat1,
          keterangan: t.keterangan || '-',
          amount: expenseAmount,
          subCategory
        });
      } else if (grp === 'operasional') {
        totalOperasional += expenseAmount;
        operasionalDetails.push({
          tanggal: t.tanggal,
          category: cat1,
          keterangan: t.keterangan || '-',
          amount: expenseAmount
        });
      }
    }
  });

  const cogsRatio = totalSales > 0 ? (totalCOGS / totalSales) * 100 : 0;
  const cogsDrinkRatio = totalSales > 0 ? (totalCOGSDrink / totalSales) * 100 : 0;
  const cogsFoodRatio = totalSales > 0 ? (totalCOGSFood / totalSales) * 100 : 0;
  const cogsSnackRatio = totalSales > 0 ? (totalCOGSSnack / totalSales) * 100 : 0;
  const wagesRatio = totalSales > 0 ? (totalWages / totalSales) * 100 : 0;
  const operasionalRatio = totalSales > 0 ? (totalOperasional / totalSales) * 100 : 0;
  const netProfit = totalSales - totalExpensesCalculated;
  const netProfitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  const grossProfit = totalSales - totalCOGS;
  const grossProfitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  const operatingProfit = totalSales - totalCOGS - totalWages - totalOperasional;
  const operatingProfitMargin = totalSales > 0 ? (operatingProfit / totalSales) * 100 : 0;

  return {
    totalSales,
    totalCOGS,
    totalCOGSDrink,
    totalCOGSFood,
    totalCOGSSnack,
    totalWages,
    totalOperasional,
    totalPromo,
    totalExpensesCalculated,
    cogsRatio: parseFloat(cogsRatio.toFixed(1)),
    cogsDrinkRatio: parseFloat(cogsDrinkRatio.toFixed(1)),
    cogsFoodRatio: parseFloat(cogsFoodRatio.toFixed(1)),
    cogsSnackRatio: parseFloat(cogsSnackRatio.toFixed(1)),
    wagesRatio: parseFloat(wagesRatio.toFixed(1)),
    operasionalRatio: parseFloat(operasionalRatio.toFixed(1)),
    netProfitMargin: parseFloat(netProfitMargin.toFixed(1)),
    grossProfit,
    grossProfitMargin: parseFloat(grossProfitMargin.toFixed(1)),
    operatingProfit,
    operatingProfitMargin: parseFloat(operatingProfitMargin.toFixed(1)),
    netProfit,
    cogsDetails,
    wagesDetails,
    operasionalDetails,
    activeMode: isManual ? 'manual' : 'auto',
    mappedCount
  };
}
