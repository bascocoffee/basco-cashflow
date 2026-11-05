import { Transaction, MonthlyData, FinancialSummary } from './types';

// Format currency to IDR (Indonesian Rupiah)
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Parse date string robustly, handling YYYY-MM-DD, DD/MM/YYYY, timestamps, Excel serials, and Indonesian month names safely
export function parseDateString(dateString: string): Date {
  if (!dateString) return new Date();
  const trimmed = String(dateString).trim();

  // 1. Check for Excel / Google Sheets numeric serial date (e.g. 46312 for Oct 17, 2026)
  if (/^\d{5}$/.test(trimmed)) {
    const serial = parseInt(trimmed, 10);
    const utcDays = serial - 25569;
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      return new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
    }
  }

  // 2. Check for YYYY-MM-DD (with optional time or T-separator)
  const yyyymmddReg = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[\sT].*)?$/;
  const matchYMD = trimmed.match(yyyymmddReg);
  if (matchYMD) {
    const year = parseInt(matchYMD[1], 10);
    const month = parseInt(matchYMD[2], 10) - 1; // 0-indexed
    const day = parseInt(matchYMD[3], 10);
    return new Date(year, month, day); // local timezone
  }

  // 3. Check for DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (with optional time)
  const dd_mm_yyyyReg = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[\sT].*)?$/;
  const matchDMY = trimmed.match(dd_mm_yyyyReg);
  if (matchDMY) {
    const part1 = parseInt(matchDMY[1], 10);
    const part2 = parseInt(matchDMY[2], 10);
    const year = parseInt(matchDMY[3], 10);

    let day = part1;
    let month = part2 - 1; // 0-indexed

    if (part2 > 12) {
      day = part2;
      month = part1 - 1;
    }

    return new Date(year, month, day); // local timezone
  }

  // 4. Check for 2-digit year: DD/MM/YY or DD-MM-YY
  const dmyShortMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})(?:[\sT].*)?$/);
  if (dmyShortMatch) {
    const day = parseInt(dmyShortMatch[1], 10);
    const month = parseInt(dmyShortMatch[2], 10) - 1;
    const yearNum = parseInt(dmyShortMatch[3], 10);
    const year = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    return new Date(year, month, day);
  }

  // 5. Check for Indonesian month names like "17 Okt 2026" or "17 Oktober 2026" or "17-Okt-2026"
  const indoMonthNames = [
    ['jan', 'januari'],
    ['feb', 'februari'],
    ['mar', 'maret'],
    ['apr', 'april'],
    ['mei', 'may'],
    ['jun', 'juni'],
    ['jul', 'juli'],
    ['agu', 'agust', 'agustus', 'ags'],
    ['sep', 'sept', 'september', 'okt'],
    ['okt', 'oktober', 'oct', 'october'],
    ['nov', 'november'],
    ['des', 'desember', 'dec', 'december']
  ];
  const indoDateMatch = trimmed.match(/^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{2,4})(?:[\sT].*)?$/);
  if (indoDateMatch) {
    const day = parseInt(indoDateMatch[1], 10);
    const monthWord = indoDateMatch[2].toLowerCase();
    let year = parseInt(indoDateMatch[3], 10);
    if (year < 100) year += 2000;

    let foundMonth = -1;
    for (let m = 0; m < indoMonthNames.length; m++) {
      if (indoMonthNames[m].some(alias => monthWord.startsWith(alias))) {
        foundMonth = m;
        break;
      }
    }
    if (foundMonth !== -1) {
      return new Date(year, foundMonth, day);
    }
  }

  // Fallback to native parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return new Date();
}

// Format Date to friendly local Indonesian format (hari/bulan/tahun)
export function formatLocalDate(dateString: string): string {
  if (!dateString) return '-';
  const date = parseDateString(dateString);
  if (isNaN(date.getTime())) return dateString;

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Calculate financial statistics
export function getFinancialSummary(transactions: Transaction[]): FinancialSummary {
  let totalDebit = 0;
  let totalKredit = 0;

  transactions.forEach(t => {
    totalDebit += t.debit || 0;
    totalKredit += (t.kredit || 0) + (t.kredit2 || 0);
  });

  return {
    totalDebit,
    totalKredit,
    saldo: totalDebit - totalKredit
  };
}

// Aggregate transactions into monthly chart data
export function aggregateMonthlyData(transactions: Transaction[]): MonthlyData[] {
  const monthsMap: Record<string, { debit: number; kredit: number }> = {};
  
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  const monthNamesLong = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  // Sort ascending for chronological chart plotting
  const sorted = [...transactions].sort((a, b) => parseDateString(a.tanggal).getTime() - parseDateString(b.tanggal).getTime());

  sorted.forEach(t => {
    if (!t.tanggal) return;
    const date = parseDateString(t.tanggal);
    if (isNaN(date.getTime())) return;
    
    const mIdx = date.getMonth();
    const year = String(date.getFullYear());
    const key = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
    
    if (!monthsMap[key]) {
      monthsMap[key] = { debit: 0, kredit: 0 };
    }
    monthsMap[key].debit += t.debit || 0;
    monthsMap[key].kredit += (t.kredit || 0) + (t.kredit2 || 0);
  });

  const keys = Object.keys(monthsMap).sort();
  
  const result: MonthlyData[] = keys.map(key => {
    const [year, mStr] = key.split('-');
    const mIdx = parseInt(mStr) - 1;
    const debit = monthsMap[key].debit;
    const kredit = monthsMap[key].kredit;
    return {
      month: `${monthNamesShort[mIdx]} '${year.slice(2)}`,
      monthLong: `${monthNamesLong[mIdx]} ${year}`,
      year,
      debit,
      kredit,
      saldo: debit - kredit
    };
  });

  if (result.length === 0) {
    // Return sample empty structure
    const currentYear = new Date().getFullYear();
    return [
      { month: `Mei '${String(currentYear).slice(2)}`, monthLong: `Mei ${currentYear}`, year: String(currentYear), debit: 0, kredit: 0, saldo: 0 },
      { month: `Jun '${String(currentYear).slice(2)}`, monthLong: `Juni ${currentYear}`, year: String(currentYear), debit: 0, kredit: 0, saldo: 0 },
      { month: `Jul '${String(currentYear).slice(2)}`, monthLong: `Juli ${currentYear}`, year: String(currentYear), debit: 0, kredit: 0, saldo: 0 },
    ];
  }

  return result;
}

// Calculate spending per category
export interface CategoryDistribution {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export function getCategorySpendDistribution(transactions: Transaction[]): CategoryDistribution[] {
  const categoryMap: Record<string, { displayName: string; amount: number; count: number }> = {};
  let totalKredit = 0;

  transactions.forEach(t => {
    const rawCat1 = (t.jenisPengeluaran || '').trim() || 'Lain-lain';
    const key1 = rawCat1.toUpperCase();

    // Process primary category (kredit)
    if (t.kredit > 0) {
      if (!categoryMap[key1]) {
        categoryMap[key1] = { displayName: rawCat1, amount: 0, count: 0 };
      }
      categoryMap[key1].amount += t.kredit;
      categoryMap[key1].count += 1;
      totalKredit += t.kredit;
    }

    // Process secondary category (kredit2)
    if (t.kredit2 > 0) {
      const rawCat2 = (t.jenisPengeluaran2 && t.jenisPengeluaran2 !== '-')
        ? t.jenisPengeluaran2.trim()
        : rawCat1;
      const key2 = rawCat2.toUpperCase();

      if (!categoryMap[key2]) {
        categoryMap[key2] = { displayName: rawCat2, amount: 0, count: 0 };
      }
      categoryMap[key2].amount += t.kredit2;
      
      if (key2 !== key1 || t.kredit <= 0) {
        categoryMap[key2].count += 1;
      }
      
      totalKredit += t.kredit2;
    }
  });

  const list: CategoryDistribution[] = Object.values(categoryMap).map(data => {
    return {
      category: data.displayName,
      amount: data.amount,
      count: data.count,
      percentage: totalKredit > 0 ? parseFloat(((data.amount / totalKredit) * 100).toFixed(1)) : 0
    };
  });

  // Sort by highest amount spent
  return list.sort((a, b) => b.amount - a.amount);
}
