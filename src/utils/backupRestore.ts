import { AppFullBackupData, Transaction, Barista, ShiftMaster, BaristaScheduleEntry } from '../types';
import { STORAGE_KEYS, DEFAULT_BARISTAS, DEFAULT_SHIFTS } from './baristaScheduleData';

export function collectAllAppData(inMemoryTransactions?: Transaction[], inMemoryCategories?: string[]): AppFullBackupData {
  // 1. Transactions
  let txList: Transaction[] = inMemoryTransactions || [];
  if (!txList || txList.length === 0) {
    try {
      const savedTx = localStorage.getItem('aruskas_manager_transactions');
      if (savedTx) txList = JSON.parse(savedTx);
    } catch {
      txList = [];
    }
  }

  // 2. Categories
  let catList: string[] = inMemoryCategories || [];
  if (!catList || catList.length === 0) {
    try {
      const savedCat = localStorage.getItem('aruskas_categories');
      if (savedCat) catList = JSON.parse(savedCat);
    } catch {
      catList = [];
    }
  }

  // 3. Baristas
  let baristaList: Barista[] = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.BARISTAS);
    baristaList = saved ? JSON.parse(saved) : DEFAULT_BARISTAS;
  } catch {
    baristaList = DEFAULT_BARISTAS;
  }

  // 4. Shifts
  let shiftList: ShiftMaster[] = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    shiftList = saved ? JSON.parse(saved) : DEFAULT_SHIFTS;
  } catch {
    shiftList = DEFAULT_SHIFTS;
  }

  // 5. Schedules
  let scheduleList: BaristaScheduleEntry[] = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    scheduleList = saved ? JSON.parse(saved) : [];
  } catch {
    scheduleList = [];
  }

  // 6. COGS Daily Sales & Menus
  let menuCatalog: any[] = [];
  let ingredients: any[] = [];
  let dailySales: any[] = [];
  let biayaList: any[] = [];
  try {
    const m = localStorage.getItem('aruskas_cogs_page_menu_catalog');
    if (m) menuCatalog = JSON.parse(m);
    const ing = localStorage.getItem('aruskas_cogs_ingredients');
    if (ing) ingredients = JSON.parse(ing);
    const ds = localStorage.getItem('aruskas_cogs_page_daily_sales');
    if (ds) dailySales = JSON.parse(ds);
    const b = localStorage.getItem('aruskas_cogs_page_biaya');
    if (b) biayaList = JSON.parse(b);
  } catch (e) {
    console.error("Failed to read COGS items for backup", e);
  }

  // 6b. Incoming Ingredient Batches (Barang Masuk)
  let incomingBatches: any[] = [];
  try {
    const ib = localStorage.getItem('aruskas_cogs_incoming_batches');
    if (ib) incomingBatches = JSON.parse(ib);
  } catch {}

  // 7. Fixed Costs
  let fixedCosts: any[] = [];
  try {
    const fc = localStorage.getItem('aruskas_fixed_costs');
    if (fc) fixedCosts = JSON.parse(fc);
  } catch {}

  // 8. Stock Opname Drafts (all keys starting with basco_opname_draft_)
  const stockOpnameDrafts: Record<string, any> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('basco_opname_draft_')) {
        const val = localStorage.getItem(key);
        if (val) stockOpnameDrafts[key] = JSON.parse(val);
      }
    }
  } catch {}

  // 9. Calendar Notes & Activities
  let calendarActivities: any[] = [];
  try {
    const ca = localStorage.getItem('basco_calendar_notes_activities');
    if (ca) calendarActivities = JSON.parse(ca);
  } catch {}

  // 10. Debts & Liabilities
  let debtList: any[] = [];
  try {
    const d = localStorage.getItem('aruskas_debt_records');
    if (d) debtList = JSON.parse(d);
  } catch {}

  // 11. Shopping List from Sheet 4
  let shoppingList: any[] = [];
  try {
    const sl = localStorage.getItem('basco_shopping_list_sheet4');
    if (sl) shoppingList = JSON.parse(sl);
  } catch {}

  const backupData: AppFullBackupData = {
    appName: 'Basco Cashflow & Cafe Management',
    version: '2.5.0',
    exportedAt: new Date().toISOString(),
    transactions: txList,
    categories: catList,
    baristas: baristaList,
    shifts: shiftList,
    schedules: scheduleList,
    cogsMenuCatalog: menuCatalog,
    cogsIngredients: ingredients,
    cogsDailySales: dailySales,
    cogsBiaya: biayaList,
    cogsIncomingBatches: incomingBatches,
    calendarActivities: calendarActivities,
    stockOpnameDrafts: stockOpnameDrafts,
    fixedCosts: fixedCosts,
    debts: debtList,
    shoppingItems: shoppingList,
    notes: 'Full database snapshot including transactions, barista schedules, calendar activities, COGS recipes, debt records, and Sheet 4 shopping list.'
  };

  return backupData;
}

export function downloadJsonFile(filename: string, dataObj: any): void {
  const jsonStr = JSON.stringify(dataObj, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface RestoreSummary {
  transactionsCount: number;
  categoriesCount: number;
  baristasCount: number;
  shiftsCount: number;
  schedulesCount: number;
  menuCatalogCount: number;
  ingredientsCount: number;
  dailySalesCount: number;
  fixedCostsCount: number;
  stockOpnameMonthsCount: number;
  calendarActivitiesCount?: number;
  debtsCount?: number;
  exportedAt?: string;
  isValid: boolean;
  errorMessage?: string;
}

export function parseAndValidateBackupJson(jsonString: string): { data: AppFullBackupData | null; summary: RestoreSummary } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return {
        data: null,
        summary: {
          transactionsCount: 0,
          categoriesCount: 0,
          baristasCount: 0,
          shiftsCount: 0,
          schedulesCount: 0,
          menuCatalogCount: 0,
          ingredientsCount: 0,
          dailySalesCount: 0,
          fixedCostsCount: 0,
          stockOpnameMonthsCount: 0,
          isValid: false,
          errorMessage: 'Format file JSON tidak valid.'
        }
      };
    }

    const txCount = Array.isArray(parsed.transactions) ? parsed.transactions.length : 0;
    const catCount = Array.isArray(parsed.categories) ? parsed.categories.length : 0;
    const baristasCount = Array.isArray(parsed.baristas) ? parsed.baristas.length : 0;
    const shiftsCount = Array.isArray(parsed.shifts) ? parsed.shifts.length : 0;
    const schedulesCount = Array.isArray(parsed.schedules) ? parsed.schedules.length : 0;
    const menuCount = Array.isArray(parsed.cogsMenuCatalog) ? parsed.cogsMenuCatalog.length : 0;
    const ingCount = Array.isArray(parsed.cogsIngredients) ? parsed.cogsIngredients.length : 0;
    const dsCount = Array.isArray(parsed.cogsDailySales) ? parsed.cogsDailySales.length : 0;
    const fcCount = Array.isArray(parsed.fixedCosts) ? parsed.fixedCosts.length : 0;
    const opnameCount = parsed.stockOpnameDrafts ? Object.keys(parsed.stockOpnameDrafts).length : 0;
    const caCount = Array.isArray(parsed.calendarActivities) ? parsed.calendarActivities.length : 0;
    const debtsCount = Array.isArray(parsed.debts) ? parsed.debts.length : 0;

    return {
      data: parsed as AppFullBackupData,
      summary: {
        transactionsCount: txCount,
        categoriesCount: catCount,
        baristasCount: baristasCount,
        shiftsCount: shiftsCount,
        schedulesCount: schedulesCount,
        menuCatalogCount: menuCount,
        ingredientsCount: ingCount,
        dailySalesCount: dsCount,
        fixedCostsCount: fcCount,
        stockOpnameMonthsCount: opnameCount,
        calendarActivitiesCount: caCount,
        debtsCount: debtsCount,
        exportedAt: parsed.exportedAt,
        isValid: true
      }
    };
  } catch (err: any) {
    return {
      data: null,
      summary: {
        transactionsCount: 0,
        categoriesCount: 0,
        baristasCount: 0,
        shiftsCount: 0,
        schedulesCount: 0,
        menuCatalogCount: 0,
        ingredientsCount: 0,
        dailySalesCount: 0,
        fixedCostsCount: 0,
        stockOpnameMonthsCount: 0,
        isValid: false,
        errorMessage: err?.message || 'Gagal membaca isi JSON.'
      }
    };
  }
}

export function restoreAllAppData(backupData: AppFullBackupData): boolean {
  try {
    if (backupData.transactions && Array.isArray(backupData.transactions)) {
      localStorage.setItem('aruskas_manager_transactions', JSON.stringify(backupData.transactions));
    }
    if (backupData.categories && Array.isArray(backupData.categories)) {
      localStorage.setItem('aruskas_categories', JSON.stringify(backupData.categories));
    }
    if (backupData.baristas && Array.isArray(backupData.baristas)) {
      localStorage.setItem(STORAGE_KEYS.BARISTAS, JSON.stringify(backupData.baristas));
    }
    if (backupData.shifts && Array.isArray(backupData.shifts)) {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(backupData.shifts));
    }
    if (backupData.schedules && Array.isArray(backupData.schedules)) {
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(backupData.schedules));
    }
    if (backupData.cogsMenuCatalog && Array.isArray(backupData.cogsMenuCatalog)) {
      localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(backupData.cogsMenuCatalog));
    }
    if (backupData.cogsIngredients && Array.isArray(backupData.cogsIngredients)) {
      localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(backupData.cogsIngredients));
    }
    if (backupData.cogsDailySales && Array.isArray(backupData.cogsDailySales)) {
      localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(backupData.cogsDailySales));
    }
    if (backupData.cogsBiaya && Array.isArray(backupData.cogsBiaya)) {
      localStorage.setItem('aruskas_cogs_page_biaya', JSON.stringify(backupData.cogsBiaya));
    }
    if (backupData.cogsIncomingBatches && Array.isArray(backupData.cogsIncomingBatches)) {
      localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(backupData.cogsIncomingBatches));
    }
    if (backupData.calendarActivities && Array.isArray(backupData.calendarActivities)) {
      localStorage.setItem('basco_calendar_notes_activities', JSON.stringify(backupData.calendarActivities));
    }
    if (backupData.fixedCosts && Array.isArray(backupData.fixedCosts)) {
      localStorage.setItem('aruskas_fixed_costs', JSON.stringify(backupData.fixedCosts));
    }
    if (backupData.debts && Array.isArray(backupData.debts)) {
      localStorage.setItem('aruskas_debt_records', JSON.stringify(backupData.debts));
    }
    if (backupData.shoppingItems && Array.isArray(backupData.shoppingItems)) {
      localStorage.setItem('basco_shopping_list_sheet4', JSON.stringify(backupData.shoppingItems));
    }
    if (backupData.stockOpnameDrafts && typeof backupData.stockOpnameDrafts === 'object') {
      Object.entries(backupData.stockOpnameDrafts).forEach(([k, v]) => {
        localStorage.setItem(k, JSON.stringify(v));
      });
    }
    return true;
  } catch (error) {
    console.error("Restore failed:", error);
    return false;
  }
}
