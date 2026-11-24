import { IncomingIngredientBatch } from '../types';

export const INVENTORY_SETTINGS_KEY = 'aruskas_inventory_settings';

export interface IngredientStockSetting {
  initialStock?: number;
  minThreshold?: number;
  manualLiveStock?: number;
}

export type InventorySettingsMap = Record<string, IngredientStockSetting>;

export type StockStatusType = 'habis' | 'kritis' | 'menipis' | 'aman';

export type InventoryFilterMode = 'all' | 'bulanan' | 'harian' | 'tahunan';

export interface InventoryFilterPeriod {
  mode?: InventoryFilterMode;
  selectedYear?: string;  // e.g. "2026" or "ALL"
  selectedMonth?: string; // e.g. "2026-11" or "ALL"
  selectedDate?: string;  // e.g. "2026-11-23"
}

export interface LiveIngredientStockItem {
  id: string;
  namaBahan: string;
  satuanTakaran: string;
  initialStock: number;
  // All-time totals for real-time live balance
  totalIncoming: number;
  totalUsed: number;
  remainingStock: number;
  usedToday: number;
  avgDailyUsage: number;
  minThreshold: number;
  daysRemaining: number | null;
  status: StockStatusType;

  // Period-specific breakdown (Harian / Bulanan / Tahunan / All)
  periodIncoming: number;
  periodUsed: number;
  periodSalesUsage: number;
  periodJatahUsage: number;
  periodPorsiTerjual: number;
  periodPorsiJatah: number;
  periodNet: number;            // initialStock + periodIncoming - periodUsed
  periodRemainingStock: number; // initialStock + periodIncoming - periodUsed
  manualLiveStock: number;      // Input manual Sisa Stok Live
  hasManualLiveStock: boolean;
  selisih: number;              // periodNet - manualLiveStock
}

export interface LiveInventorySummary {
  items: LiveIngredientStockItem[];
  habisCount: number;
  kritisCount: number;
  menipisCount: number;
  amanCount: number;
  alertCount: number; // habis + kritis + menipis
  
  // Period aggregate stats
  filterPeriod: InventoryFilterPeriod;
  totalPeriodIncoming: number;
  totalPeriodUsed: number;
  totalPeriodNet: number;
  totalPeriodPorsiTerjual: number;
  totalPeriodPorsiJatah: number;
}

export function getInventorySettings(): InventorySettingsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(INVENTORY_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveInventorySetting(
  ingredientId: string,
  patch: Partial<IngredientStockSetting>
): InventorySettingsMap {
  const current = getInventorySettings();
  const next: InventorySettingsMap = {
    ...current,
    [ingredientId]: {
      ...(current[ingredientId] || {}),
      ...patch,
    },
  };
  try {
    localStorage.setItem(INVENTORY_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function normalizeUnit(u?: string): string {
  const s = String(u || '').trim().toLowerCase();
  if (s === 'gr' || s === 'g' || s === 'gram' || s === 'grams') return 'gram';
  if (s === 'kg' || s === 'kilogram' || s === 'kilo') return 'kg';
  if (s === 'l' || s === 'ltr' || s === 'liter' || s === 'litre') return 'liter';
  if (s === 'ml' || s === 'mili' || s === 'mililiter' || s === 'cc') return 'ml';
  if (s === 'pcs' || s === 'pc' || s === 'buah' || s === 'biji' || s === 'unit' || s === 'lembar' || s === 'lbr') return 'pcs';
  if (s === 'cup' || s === 'cups') return 'cup';
  if (s === 'pack' || s === 'pak' || s === 'dus' || s === 'box' || s === 'karton' || s === 'ctn' || s === 'pouch') return 'pack';
  if (s === 'botol' || s === 'btl') return 'botol';
  if (s === 'kaleng' || s === 'can') return 'kaleng';
  return s;
}

export function convertBatchQtyToTargetUnit(
  qty: number,
  fromUnitRaw: string,
  targetUnitRaw: string
): number {
  const q = Number(qty) || 0;
  if (q <= 0) return 0;

  const fromU = normalizeUnit(fromUnitRaw);
  const toU = normalizeUnit(targetUnitRaw);

  if (!fromU || !toU || fromU === toU) return q;

  // Cross Weight <-> Volume conversions (in standard cafe operations, 1 L = 1000 ml = 1000 gr)
  const isFromLarge = fromU === 'kg' || fromU === 'liter';
  const isToSmall = toU === 'gram' || toU === 'ml';
  if (isFromLarge && isToSmall) return q * 1000;

  const isFromSmall = fromU === 'gram' || fromU === 'ml';
  const isToLarge = toU === 'kg' || toU === 'liter';
  if (isFromSmall && isToLarge) return q / 1000;

  // Bottles conversion (e.g. 1 botol sirup / sauce = 1000 ml or gram)
  if (fromU === 'botol' && (toU === 'ml' || toU === 'gram')) {
    return q <= 50 ? q * 1000 : q;
  }

  // Cans conversion (e.g. 1 kaleng kental manis / evaporasi = 380 - 500 gr/ml)
  if (fromU === 'kaleng' && (toU === 'gram' || toU === 'ml')) {
    return q <= 50 ? q * 380 : q;
  }

  // Packaging conversions (standard 1 pack = 50 - 100 pcs if target is pcs/cup)
  if (fromU === 'pack' && (toU === 'pcs' || toU === 'cup')) {
    return q <= 20 ? q * 50 : q;
  }
  if ((fromU === 'pcs' || fromU === 'cup') && toU === 'pack') {
    return q / 50;
  }

  return q;
}

function normalizeNameKey(name?: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Compute live auto-deducted inventory stock from:
 * - Master Ingredients
 * - Incoming Goods Batches (Barang Masuk)
 * - Daily Sales & Barista Jatah multiplied by Menu Recipes
 * - Custom initial stock & min threshold settings
 * - Filter Period (Harian, Bulanan, Tahunan, All Time)
 */
export function computeLiveInventoryStock(params: {
  ingredients: Array<{
    id: string;
    namaBahan: string;
    satuanTakaran?: string;
    takaranPerCup?: number;
  }>;
  incomingBatches: IncomingIngredientBatch[];
  dailySales: Array<{
    tanggal?: string;
    menuSales?: Array<{
      menuId?: string;
      nama?: string;
      terjual?: number;
      jatah?: number;
    }>;
  }>;
  menuItems: Array<{
    id: string;
    nama: string;
    recipe?: Array<{ ingredientId: string; takaran: number }>;
    resep?: Array<{ ingredientId: string; takaran: number }>;
  }>;
  settings?: InventorySettingsMap;
  todayStr?: string;
  filterPeriod?: InventoryFilterPeriod;
}): LiveInventorySummary {
  const {
    ingredients = [],
    incomingBatches = [],
    dailySales = [],
    menuItems = [],
    settings = getInventorySettings(),
    todayStr = new Date().toISOString().split('T')[0],
    filterPeriod = { mode: 'bulanan' },
  } = params;

  const currentMode: InventoryFilterMode = filterPeriod.mode || 'bulanan';
  const filterYear = filterPeriod.selectedYear;
  const filterMonth = filterPeriod.selectedMonth;
  const filterDate = filterPeriod.selectedDate;

  // 1. Build fast lookup maps for menuItems
  const menuById = new Map<string, (typeof menuItems)[number]>();
  const menuByName = new Map<string, (typeof menuItems)[number]>();
  menuItems.forEach((m) => {
    if (m.id) menuById.set(m.id, m);
    const nKey = normalizeNameKey(m.nama);
    if (nKey) menuByName.set(nKey, m);
  });

  // 2. Build ingredient lookup maps
  const ingById = new Map<string, (typeof ingredients)[number]>();
  const ingByName = new Map<string, (typeof ingredients)[number]>();
  ingredients.forEach((ing) => {
    if (ing.id) ingById.set(ing.id, ing);
    const nKey = normalizeNameKey(ing.namaBahan);
    if (nKey) ingByName.set(nKey, ing);
  });

  // Helper to match batch to ingredient (id -> exact normalized -> fuzzy substring)
  const findMatchingIngredient = (batch: IncomingIngredientBatch) => {
    if (batch.ingredientId && ingById.has(batch.ingredientId)) {
      return ingById.get(batch.ingredientId);
    }
    if (batch.namaBahan) {
      const bKey = normalizeNameKey(batch.namaBahan);
      if (ingByName.has(bKey)) {
        return ingByName.get(bKey);
      }
      // Substring match
      const matched = ingredients.find((ing) => {
        const iKey = normalizeNameKey(ing.namaBahan);
        return (
          (bKey.length >= 3 && iKey.includes(bKey)) ||
          (iKey.length >= 3 && bKey.includes(iKey))
        );
      });
      if (matched) return matched;
    }
    return undefined;
  };

  // Helper to check if record date matches the filter period (Harian / Bulanan / Tahunan / All)
  const isDateInPeriod = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    if (currentMode === 'all') return true;
    if (currentMode === 'tahunan') {
      if (!filterYear || filterYear === 'ALL') return true;
      return dateStr.startsWith(filterYear); // e.g. "2026"
    }
    if (currentMode === 'bulanan') {
      if (!filterMonth || filterMonth === 'ALL') return true;
      return dateStr.startsWith(filterMonth); // e.g. "2026-11"
    }
    if (currentMode === 'harian') {
      if (!filterDate) return true;
      return dateStr === filterDate; // e.g. "2026-11-23"
    }
    return true;
  };

  // 3. Aggregate incoming stock per ingredient ID (Total Lifetime & Period Specific)
  const incomingMapTotal = new Map<string, number>();
  const incomingMapPeriod = new Map<string, number>();

  incomingBatches.forEach((b) => {
    if (!b) return;
    const targetIng = findMatchingIngredient(b);
    if (!targetIng) return;

    const converted = convertBatchQtyToTargetUnit(
      Number(b.berat) || 0,
      b.satuan || targetIng.satuanTakaran || 'gram',
      targetIng.satuanTakaran || 'gram'
    );

    // All-time incoming
    incomingMapTotal.set(
      targetIng.id,
      (incomingMapTotal.get(targetIng.id) || 0) + converted
    );

    // Period-filtered incoming
    if (isDateInPeriod(b.tanggal)) {
      incomingMapPeriod.set(
        targetIng.id,
        (incomingMapPeriod.get(targetIng.id) || 0) + converted
      );
    }
  });

  // 4. Aggregate auto-deducted recipe usage across dailySales
  // Note: Support both menu.recipe and menu.resep!
  const usedTotalMap = new Map<string, number>();
  const usedPeriodMap = new Map<string, number>();
  const usedSalesPeriodMap = new Map<string, number>();
  const usedJatahPeriodMap = new Map<string, number>();
  const porsiTerjualPeriodMap = new Map<string, number>();
  const porsiJatahPeriodMap = new Map<string, number>();
  const usedTodayMap = new Map<string, number>();
  const activeDatesSet = new Set<string>();

  dailySales.forEach((ds) => {
    if (!ds || !Array.isArray(ds.menuSales)) return;
    const isToday = ds.tanggal === todayStr;
    const inPeriod = isDateInPeriod(ds.tanggal);
    let dayHasSale = false;

    ds.menuSales.forEach((ms) => {
      const terjual = Number(ms?.terjual) || 0;
      const jatah = Number(ms?.jatah) || 0;
      const porsi = terjual + jatah;
      if (porsi <= 0) return;
      dayHasSale = true;

      let menu = ms.menuId ? menuById.get(ms.menuId) : undefined;
      if (!menu && ms.nama) {
        menu = menuByName.get(normalizeNameKey(ms.nama));
      }
      if (!menu) return;

      // Crucial: Support both menu.recipe and menu.resep
      const recipeList = (menu as any).recipe || (menu as any).resep || [];
      if (!Array.isArray(recipeList) || recipeList.length === 0) return;

      recipeList.forEach((r: any) => {
        if (!r.ingredientId || !r.takaran) return;
        const takaranNum = Number(r.takaran) || 0;
        if (takaranNum <= 0) return;

        const usedQty = porsi * takaranNum;
        const usedSalesQty = terjual * takaranNum;
        const usedJatahQty = jatah * takaranNum;

        // All-time usage for real-time live balance
        usedTotalMap.set(r.ingredientId, (usedTotalMap.get(r.ingredientId) || 0) + usedQty);

        if (isToday) {
          usedTodayMap.set(r.ingredientId, (usedTodayMap.get(r.ingredientId) || 0) + usedQty);
        }

        // Period-specific usage
        if (inPeriod) {
          usedPeriodMap.set(r.ingredientId, (usedPeriodMap.get(r.ingredientId) || 0) + usedQty);
          usedSalesPeriodMap.set(r.ingredientId, (usedSalesPeriodMap.get(r.ingredientId) || 0) + usedSalesQty);
          usedJatahPeriodMap.set(r.ingredientId, (usedJatahPeriodMap.get(r.ingredientId) || 0) + usedJatahQty);
          porsiTerjualPeriodMap.set(r.ingredientId, (porsiTerjualPeriodMap.get(r.ingredientId) || 0) + terjual);
          porsiJatahPeriodMap.set(r.ingredientId, (porsiJatahPeriodMap.get(r.ingredientId) || 0) + jatah);
        }
      });
    });

    if (dayHasSale && ds.tanggal) {
      activeDatesSet.add(ds.tanggal);
    }
  });

  const activeDayCount = Math.max(1, activeDatesSet.size);

  // 5. Build stock items
  let habisCount = 0;
  let kritisCount = 0;
  let menipisCount = 0;
  let amanCount = 0;

  let totalInitialStock = 0;
  let totalPeriodIncoming = 0;
  let totalPeriodUsed = 0;
  let totalPeriodPorsiTerjual = 0;
  let totalPeriodPorsiJatah = 0;

  const items: LiveIngredientStockItem[] = ingredients.map((ing) => {
    const st = settings[ing.id] || {};
    const initialStock = Number(st.initialStock) || 0;
    const hasManualLiveStock = st.manualLiveStock !== undefined && st.manualLiveStock !== null;
    const manualLiveStock = hasManualLiveStock ? Number(st.manualLiveStock) || 0 : 0;

    const totalIncoming = incomingMapTotal.get(ing.id) || 0;
    const totalUsed = usedTotalMap.get(ing.id) || 0;
    const usedToday = usedTodayMap.get(ing.id) || 0;
    const avgDailyUsage = totalUsed > 0 ? totalUsed / activeDayCount : 0;

    // Period specific: Stok Awal + Masuk (Periode) - Dipakai (Periode) = Net Periode
    const periodIncoming = incomingMapPeriod.get(ing.id) || 0;
    const periodUsed = usedPeriodMap.get(ing.id) || 0;
    const periodSalesUsage = usedSalesPeriodMap.get(ing.id) || 0;
    const periodJatahUsage = usedJatahPeriodMap.get(ing.id) || 0;
    const periodPorsiTerjual = porsiTerjualPeriodMap.get(ing.id) || 0;
    const periodPorsiJatah = porsiJatahPeriodMap.get(ing.id) || 0;
    const periodNet = initialStock + periodIncoming - periodUsed;
    const periodRemainingStock = periodNet;

    // Selisih = Net Periode - Sisa Stok Live (manual)
    const selisih = periodNet - manualLiveStock;

    // Reference stock for status checks (use manualLiveStock if entered, otherwise periodNet)
    const remainingStock = hasManualLiveStock ? manualLiveStock : periodNet;

    totalInitialStock += initialStock;
    totalPeriodIncoming += periodIncoming;
    totalPeriodUsed += periodUsed;
    totalPeriodPorsiTerjual += periodPorsiTerjual;
    totalPeriodPorsiJatah += periodPorsiJatah;

    const defaultMin =
      avgDailyUsage > 0
        ? Math.round(avgDailyUsage * 3)
        : Math.max(10, (Number(ing.takaranPerCup) || 10) * 30);
    const minThreshold =
      st.minThreshold !== undefined && st.minThreshold >= 0
        ? Number(st.minThreshold)
        : defaultMin;

    const daysRemaining =
      avgDailyUsage > 0 ? Math.max(0, remainingStock / avgDailyUsage) : null;

    let status: StockStatusType = 'aman';
    if (remainingStock <= 0) {
      status = 'habis';
      habisCount++;
    } else if (remainingStock <= minThreshold) {
      status = 'kritis';
      kritisCount++;
    } else if (remainingStock <= minThreshold * 1.8) {
      status = 'menipis';
      menipisCount++;
    } else {
      status = 'aman';
      amanCount++;
    }

    return {
      id: ing.id,
      namaBahan: ing.namaBahan,
      satuanTakaran: ing.satuanTakaran || 'gram',
      initialStock,
      totalIncoming,
      totalUsed,
      usedToday,
      avgDailyUsage,
      remainingStock,
      minThreshold,
      daysRemaining,
      status,

      periodIncoming,
      periodUsed,
      periodSalesUsage,
      periodJatahUsage,
      periodPorsiTerjual,
      periodPorsiJatah,
      periodNet,
      periodRemainingStock,
      manualLiveStock,
      hasManualLiveStock,
      selisih,
    };
  });

  const priorityOrder: Record<StockStatusType, number> = {
    habis: 0,
    kritis: 1,
    menipis: 2,
    aman: 3,
  };

  items.sort((a, b) => {
    const pDiff = priorityOrder[a.status] - priorityOrder[b.status];
    if (pDiff !== 0) return pDiff;
    return a.namaBahan.localeCompare(b.namaBahan);
  });

  return {
    items,
    habisCount,
    kritisCount,
    menipisCount,
    amanCount,
    alertCount: habisCount + kritisCount + menipisCount,
    filterPeriod: {
      mode: currentMode,
      selectedYear: filterYear,
      selectedMonth: filterMonth,
      selectedDate: filterDate,
    },
    totalPeriodIncoming,
    totalPeriodUsed,
    totalPeriodNet: totalInitialStock + totalPeriodIncoming - totalPeriodUsed,
    totalPeriodPorsiTerjual,
    totalPeriodPorsiJatah,
  };
}
