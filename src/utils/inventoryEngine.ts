import { IncomingIngredientBatch } from '../types';

export const INVENTORY_SETTINGS_KEY = 'aruskas_inventory_settings';

export interface IngredientStockSetting {
  initialStock?: number;
  minThreshold?: number;
}

export type InventorySettingsMap = Record<string, IngredientStockSetting>;

export type StockStatusType = 'habis' | 'kritis' | 'menipis' | 'aman';

export interface LiveIngredientStockItem {
  id: string;
  namaBahan: string;
  satuanTakaran: string;
  initialStock: number;
  totalIncoming: number;
  totalUsed: number;
  usedToday: number;
  avgDailyUsage: number;
  remainingStock: number;
  minThreshold: number;
  daysRemaining: number | null;
  status: StockStatusType;
}

export interface LiveInventorySummary {
  items: LiveIngredientStockItem[];
  habisCount: number;
  kritisCount: number;
  menipisCount: number;
  amanCount: number;
  alertCount: number; // habis + kritis + menipis
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

function normalizeUnit(u?: string): string {
  const s = String(u || '').trim().toLowerCase();
  if (s === 'gr' || s === 'g' || s === 'gram' || s === 'grams') return 'gram';
  if (s === 'kg' || s === 'kilogram') return 'kg';
  if (s === 'l' || s === 'ltr' || s === 'liter' || s === 'litre') return 'liter';
  if (s === 'ml' || s === 'mili' || s === 'mililiter') return 'ml';
  if (s === 'pcs' || s === 'pc' || s === 'buah' || s === 'biji' || s === 'unit') return 'pcs';
  if (s === 'cup' || s === 'cups') return 'cup';
  if (s === 'pack' || s === 'pak' || s === 'dus' || s === 'box') return 'pack';
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

  // Weight conversions
  if (fromU === 'kg' && toU === 'gram') return q * 1000;
  if (fromU === 'gram' && toU === 'kg') return q / 1000;

  // Volume conversions
  if (fromU === 'liter' && toU === 'ml') return q * 1000;
  if (fromU === 'ml' && toU === 'liter') return q / 1000;

  // Packaging conversions (standard 1 pack = 100 pcs if target is pcs/cup)
  if (fromU === 'pack' && (toU === 'pcs' || toU === 'cup')) {
    return q <= 10 ? q * 100 : q;
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
    resep?: Array<{ ingredientId: string; takaran: number }>;
  }>;
  settings?: InventorySettingsMap;
  todayStr?: string;
}): LiveInventorySummary {
  const {
    ingredients = [],
    incomingBatches = [],
    dailySales = [],
    menuItems = [],
    settings = getInventorySettings(),
    todayStr = new Date().toISOString().split('T')[0],
  } = params;

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

  // 3. Aggregate incoming stock per ingredient ID
  const incomingMap = new Map<string, number>();
  incomingBatches.forEach((b) => {
    if (!b) return;
    let targetIng = b.ingredientId ? ingById.get(b.ingredientId) : undefined;
    if (!targetIng && b.namaBahan) {
      targetIng = ingByName.get(normalizeNameKey(b.namaBahan));
    }
    if (!targetIng) return;

    const converted = convertBatchQtyToTargetUnit(
      Number(b.berat) || 0,
      b.satuan || targetIng.satuanTakaran || 'gram',
      targetIng.satuanTakaran || 'gram'
    );
    incomingMap.set(targetIng.id, (incomingMap.get(targetIng.id) || 0) + converted);
  });

  // 4. Aggregate auto-deducted recipe usage across dailySales
  const usedTotalMap = new Map<string, number>();
  const usedTodayMap = new Map<string, number>();
  const activeDatesSet = new Set<string>();

  dailySales.forEach((ds) => {
    if (!ds || !Array.isArray(ds.menuSales)) return;
    const isToday = ds.tanggal === todayStr;
    let dayHasSale = false;

    ds.menuSales.forEach((ms) => {
      const porsi = (Number(ms?.terjual) || 0) + (Number(ms?.jatah) || 0);
      if (porsi <= 0) return;
      dayHasSale = true;

      let menu = ms.menuId ? menuById.get(ms.menuId) : undefined;
      if (!menu && ms.nama) {
        menu = menuByName.get(normalizeNameKey(ms.nama));
      }
      if (!menu || !Array.isArray(menu.resep)) return;

      menu.resep.forEach((r) => {
        if (!r.ingredientId || !r.takaran) return;
        const usedQty = porsi * (Number(r.takaran) || 0);
        usedTotalMap.set(r.ingredientId, (usedTotalMap.get(r.ingredientId) || 0) + usedQty);
        if (isToday) {
          usedTodayMap.set(r.ingredientId, (usedTodayMap.get(r.ingredientId) || 0) + usedQty);
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

  const items: LiveIngredientStockItem[] = ingredients.map((ing) => {
    const st = settings[ing.id] || {};
    const initialStock = Number(st.initialStock) || 0;
    const totalIncoming = incomingMap.get(ing.id) || 0;
    const totalUsed = usedTotalMap.get(ing.id) || 0;
    const usedToday = usedTodayMap.get(ing.id) || 0;
    const avgDailyUsage = totalUsed > 0 ? totalUsed / activeDayCount : 0;

    const remainingStock = initialStock + totalIncoming - totalUsed;
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
    } else if (remainingStock <= minThreshold || (daysRemaining !== null && daysRemaining <= 2)) {
      status = 'kritis';
      kritisCount++;
    } else if (remainingStock <= minThreshold * 1.8 || (daysRemaining !== null && daysRemaining <= 5)) {
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
  };
}
