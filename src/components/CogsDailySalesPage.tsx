import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import RecipePdfModal from './RecipePdfModal';
import SalesCogsReportPdfModal from './SalesCogsReportPdfModal';
import HppAiForum from './HppAiForum';
import { pushDailySalesToCloud, pullDailySalesFromCloud, loadCloudSlot, saveCloudSlot } from '../utils/cloudSync';
import { scanSalesReceiptImage, type ReceiptScanResult } from '../utils/receiptScanner';
import { 
  FileText,
  DollarSign, 
  Coffee, 
  TrendingUp, 
  Users, 
  PieChart, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  RotateCcw, 
  Calendar, 
  CheckCircle, 
  Award, 
  ArrowUpRight, 
  HelpCircle,
  FileSpreadsheet,
  Layers,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Utensils,
  BookOpen,
  CheckSquare,
  AlertTriangle,
  Info,
  Calculator,
  Sliders,
  Search,
  Filter,
  Cloud,
  Upload,
  RefreshCw,
  ExternalLink,
  Check,
  Trophy,
  Pizza,
  ArrowUpDown,
  Sparkles,
  Zap,
  TrendingDown,
  Target,
  Copy,
  Bot,
  PackagePlus,
  Camera,
  Image as ImageIcon,
  X,
  Loader2,
  Undo2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';
import { formatRupiah } from '../utils';
import { IncomingIngredientBatch, AppRole } from '../types';
import IncomingGoodsModule from './IncomingGoodsModule';
import { 
  fetchMenuCatalogFromSheet, 
  saveMenuCatalogToSheet, 
  fetchDailySalesFromSheet, 
  saveDailySalesToSheet,
  fetchIngredientsFromSheet,
  saveIngredientsToSheet,
  fetchBiayaListFromSheet,
  saveBiayaListToSheet,
  fetchIncomingBatchesFromSheet,
  saveIncomingBatchesToSheet,
  normalizeDateString
} from '../sheetsService';

export const formatDateDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export const UNIT_OPTIONS = [
  'gram',
  'g',
  'pcs',
  'porsi',
  'biji',
  'pack',
  'kg',
  'ml',
  'liter',
  'cup',
  'botol',
  'sachet',
  'pax'
];

export const calculateIngredientCostForCup = (ing: RecipeIngredient): number => {
  let numSatuanBeli = parseFloat(ing.satuanBeli) || 1;
  const rawUnitBeli = ing.satuanBeli.replace(/^[0-9.\s]+/, '').trim().toLowerCase();
  const rawUnitTakaran = (ing.satuanTakaran || '').trim().toLowerCase();

  // Unit Conversions
  if ((rawUnitBeli === 'liter' || rawUnitBeli === 'l') && (rawUnitTakaran === 'ml' || rawUnitTakaran === 'mili')) {
    numSatuanBeli = numSatuanBeli * 1000;
  } else if ((rawUnitBeli === 'kg' || rawUnitBeli === 'kilogram') && (rawUnitTakaran === 'gram' || rawUnitTakaran === 'gr' || rawUnitTakaran === 'g')) {
    numSatuanBeli = numSatuanBeli * 1000;
  } else if (rawUnitBeli === 'pack' && rawUnitTakaran === 'pcs') {
    if (numSatuanBeli === 1) numSatuanBeli = 100;
  }

  const hargaPerUnit = ing.hargaBeli / (numSatuanBeli || 1);
  return hargaPerUnit * ing.takaranPerCup;
};

export const calculateRecipeItemCost = (ing: RecipeIngredient, takaran: number): number => {
  let numSatuanBeli = parseFloat(ing.satuanBeli) || 1;
  const rawUnitBeli = ing.satuanBeli.replace(/^[0-9.\s]+/, '').trim().toLowerCase();
  const rawUnitTakaran = (ing.satuanTakaran || '').trim().toLowerCase();

  // Unit Conversions
  if ((rawUnitBeli === 'liter' || rawUnitBeli === 'l') && (rawUnitTakaran === 'ml' || rawUnitTakaran === 'mili')) {
    numSatuanBeli = numSatuanBeli * 1000;
  } else if ((rawUnitBeli === 'kg' || rawUnitBeli === 'kilogram') && (rawUnitTakaran === 'gram' || rawUnitTakaran === 'gr' || rawUnitTakaran === 'g')) {
    numSatuanBeli = numSatuanBeli * 1000;
  } else if (rawUnitBeli === 'pack' && rawUnitTakaran === 'pcs') {
    if (numSatuanBeli === 1) numSatuanBeli = 100;
  }

  const hargaPerUnit = ing.hargaBeli / (numSatuanBeli || 1);
  return hargaPerUnit * takaran;
};

export interface MenuRecipeIngredient {
  ingredientId: string;
  takaran: number;
}

export interface MenuItem {
  id: string;
  nama: string;
  aliases?: string[];
  kategori: 'Minuman' | 'Makanan' | 'Snack';
  hargaJual: number;
  hpp: number;
  defaultJatah: number; // Jatah quota default per hari
  recipe?: MenuRecipeIngredient[];
}

/** Normalize menu name for alphabetical sorting by stripping invisible Unicode and collapsing whitespace. */
const normalizeMenuSortName = (name?: string): string =>
  (name || '').replace(/[\u200B-\u200D\uFEFF\u00A0\s]+/g, ' ').trim();

/** Locale-aware alphabetical comparator for menu names (A -> Z). */
const compareMenuNamesAsc = (aName?: string, bName?: string): number =>
  normalizeMenuSortName(aName).localeCompare(normalizeMenuSortName(bName), 'id', {
    sensitivity: 'base',
    numeric: true,
  });

const DELETED_MENU_IDS_STORAGE_KEY = 'aruskas_cogs_deleted_menu_ids';
const DELETED_MENU_NAMES_STORAGE_KEY = 'aruskas_cogs_deleted_menu_names';

const readDeletedMenuTombstones = (): { deletedIds: Set<string>; deletedNames: Set<string> } => {
  try {
    const rawIds = localStorage.getItem(DELETED_MENU_IDS_STORAGE_KEY);
    const rawNames = localStorage.getItem(DELETED_MENU_NAMES_STORAGE_KEY);
    const ids = rawIds ? JSON.parse(rawIds) : [];
    const names = rawNames ? JSON.parse(rawNames) : [];
    return {
      deletedIds: new Set<string>(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && x.length > 0) : []),
      deletedNames: new Set<string>(
        Array.isArray(names)
          ? names.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim().toLowerCase())
          : []
      ),
    };
  } catch {
    return { deletedIds: new Set<string>(), deletedNames: new Set<string>() };
  }
};

const writeDeletedMenuTombstones = (deletedIds: Set<string>, deletedNames: Set<string>) => {
  try {
    localStorage.setItem(DELETED_MENU_IDS_STORAGE_KEY, JSON.stringify(Array.from(deletedIds)));
    localStorage.setItem(DELETED_MENU_NAMES_STORAGE_KEY, JSON.stringify(Array.from(deletedNames)));
  } catch {
    // ignore storage errors
  }
};

const scoreMenuCatalogRichness = (item: MenuItem): number => {
  let score = 0;
  if (Array.isArray(item.recipe) && item.recipe.length > 0) score += 1000 + item.recipe.length;
  if ((Number(item.hargaJual) || 0) > 0) score += 100;
  if ((Number(item.hpp) || 0) > 0) score += 10;
  if (item.kategori && item.kategori !== 'Minuman') score += 2;
  if (Array.isArray(item.aliases) && item.aliases.length > 0) score += 1;
  return score;
};

/** Remove duplicate menus sharing the same normalized name (keeping the richest entry) and guarantee unique IDs. */
const dedupeMenuCatalogItems = (items: MenuItem[]): MenuItem[] => {
  const byName = new Map<string, MenuItem>();
  const orderedKeys: string[] = [];

  items.forEach((rawItem, idx) => {
    if (!rawItem) return;
    const cleanName = normalizeMenuSortName(rawItem.nama) || 'Menu';
    const nameKey = cleanName.toLowerCase() || `__idx_${idx}`;
    const item: MenuItem = cleanName !== rawItem.nama ? { ...rawItem, nama: cleanName } : rawItem;

    const existing = byName.get(nameKey);
    if (!existing) {
      byName.set(nameKey, item);
      orderedKeys.push(nameKey);
      return;
    }

    const winner = scoreMenuCatalogRichness(item) > scoreMenuCatalogRichness(existing) ? item : existing;
    const loser = winner === item ? existing : item;
    const mergedAliases = Array.from(
      new Set(
        [
          ...(Array.isArray(winner.aliases) ? winner.aliases : []),
          ...(Array.isArray(loser.aliases) ? loser.aliases : []),
        ]
          .map(a => normalizeMenuSortName(a))
          .filter(a => a && a.toLowerCase() !== nameKey)
      )
    );
    byName.set(nameKey, mergedAliases.length > 0 ? { ...winner, aliases: mergedAliases } : winner);
  });

  const seenIds = new Set<string>();
  return orderedKeys.map((key, idx) => {
    const item = byName.get(key)!;
    const baseId = (item.id || '').trim() || `m-row-${idx + 1}`;
    let uniqueId = baseId;
    let suffix = 2;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${baseId}-${suffix++}`;
    }
    seenIds.add(uniqueId);
    return uniqueId === item.id ? item : { ...item, id: uniqueId };
  });
};

export const findIngredientHelper = (ingredientsList: RecipeIngredient[], ingId: string): RecipeIngredient | undefined => {
  if (!ingredientsList || ingredientsList.length === 0 || !ingId) return undefined;
  let found = ingredientsList.find(i => i.id === ingId);
  if (found) return found;
  return ingredientsList.find(i => 
    (i.id && i.id.toLowerCase() === ingId.toLowerCase()) || 
    (i.namaBahan && i.namaBahan.toLowerCase() === ingId.toLowerCase())
  );
};

export const calculateMenuItemHppFromRecipe = (item: MenuItem, allIngredients: RecipeIngredient[]): number => {
  if (!item.recipe || item.recipe.length === 0) {
    return item.hpp;
  }
  const totalRecipeHpp = item.recipe.reduce((sum, r) => {
    const ing = findIngredientHelper(allIngredients, r.ingredientId);
    if (!ing) return sum;
    return sum + calculateRecipeItemCost(ing, r.takaran);
  }, 0);

  return totalRecipeHpp > 0 ? totalRecipeHpp : item.hpp;
};

export interface DailyMenuItemSale {
  menuId: string;
  nama: string;
  kategori: string;
  hargaJual: number;
  hpp: number;
  jatah: number;     // Target / Jatah porsi harian
  terjual: number;   // Realisasi porsi terjual
}

export interface DailySalesRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  cups: number;
  omset: number;
  hppTotal: number;
  notes?: string;
  menuSales?: DailyMenuItemSale[];
}

export interface BiayaOperasionalItem {
  id: string;
  nama: string;
  jumlah: number;
  kategori: 'Gaji' | 'Sewa & Utilitas';
}

export interface RecipeIngredient {
  id: string;
  namaBahan: string;
  hargaBeli: number; // e.g. Rp 200,000
  satuanBeli: string; // e.g. 1000 gram
  takaranPerCup: number; // e.g. 18 gram
  satuanTakaran: string; // e.g. gram
}

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { 
    id: 'm-1', 
    nama: 'Es Kopi Susu Basco', 
    kategori: 'Minuman', 
    hargaJual: 19000, 
    hpp: 8535, 
    defaultJatah: 0,
    recipe: [
      { ingredientId: 'ing-1', takaran: 18 },  // Espresso 18g
      { ingredientId: 'ing-2', takaran: 120 }, // Milk 120ml
      { ingredientId: 'ing-3', takaran: 25 },  // Syrup Aren 25ml
      { ingredientId: 'ing-4', takaran: 1 },   // Cup 1pcs
      { ingredientId: 'ing-5', takaran: 1 }    // Ice 1cup
    ]
  },
  { 
    id: 'm-2', 
    nama: 'Americano / Long Black', 
    kategori: 'Minuman', 
    hargaJual: 16000, 
    hpp: 5500, 
    defaultJatah: 0,
    recipe: [
      { ingredientId: 'ing-1', takaran: 18 },  // Espresso 18g
      { ingredientId: 'ing-4', takaran: 1 },   // Cup 1pcs
      { ingredientId: 'ing-5', takaran: 1 }    // Ice 1cup
    ]
  },
  { 
    id: 'm-3', 
    nama: 'Caramel Macchiato', 
    kategori: 'Minuman', 
    hargaJual: 22000, 
    hpp: 8890, 
    defaultJatah: 0,
    recipe: [
      { ingredientId: 'ing-1', takaran: 18 },
      { ingredientId: 'ing-2', takaran: 130 },
      { ingredientId: 'ing-3', takaran: 30 },
      { ingredientId: 'ing-4', takaran: 1 },
      { ingredientId: 'ing-5', takaran: 1 }
    ]
  },
  { 
    id: 'm-4', 
    nama: 'Matcha Latte Signature', 
    kategori: 'Minuman', 
    hargaJual: 22000, 
    hpp: 10200, 
    defaultJatah: 0,
    recipe: [
      { ingredientId: 'ing-2', takaran: 150 },
      { ingredientId: 'ing-4', takaran: 1 },
      { ingredientId: 'ing-5', takaran: 1 }
    ]
  },
  { 
    id: 'm-5', 
    nama: 'Chocolate Iced/Hot', 
    kategori: 'Minuman', 
    hargaJual: 20000, 
    hpp: 9000, 
    defaultJatah: 0,
    recipe: [
      { ingredientId: 'ing-2', takaran: 150 },
      { ingredientId: 'ing-4', takaran: 1 },
      { ingredientId: 'ing-5', takaran: 1 }
    ]
  },
  { 
    id: 'm-6', 
    nama: 'Mie Ayam Special Basco', 
    kategori: 'Makanan', 
    hargaJual: 18000, 
    hpp: 15600, 
    defaultJatah: 0, 
    recipe: [
      { ingredientId: 'ing-7', takaran: 150 }, // Mie Basah 150g
      { ingredientId: 'ing-6', takaran: 80 },  // Daging Ayam 80g
      { ingredientId: 'ing-11', takaran: 1 }   // Paper Bowl 1pcs
    ] 
  },
  { 
    id: 'm-7', 
    nama: 'Nasi Goreng Basco', 
    kategori: 'Makanan', 
    hargaJual: 22000, 
    hpp: 8900, 
    defaultJatah: 0, 
    recipe: [
      { ingredientId: 'ing-8', takaran: 180 },  // Nasi 180g
      { ingredientId: 'ing-12', takaran: 2 },   // Sosis 2pcs
      { ingredientId: 'ing-10', takaran: 20 },  // Bumbu 20ml
      { ingredientId: 'ing-11', takaran: 1 }    // Paper Box 1pcs
    ] 
  },
  { 
    id: 'm-8', 
    nama: 'French Fries / Snack Box', 
    kategori: 'Snack', 
    hargaJual: 15000, 
    hpp: 9300, 
    defaultJatah: 0, 
    recipe: [
      { ingredientId: 'ing-9', takaran: 150 },  // Kentang 150g
      { ingredientId: 'ing-10', takaran: 25 },  // Minyak/Bumbu 25ml
      { ingredientId: 'ing-11', takaran: 1 }    // Paper Box 1pcs
    ] 
  },
];

const DEFAULT_BIAYA_ITEMS: BiayaOperasionalItem[] = [
  { id: '1', nama: 'Gaji Barista 1', jumlah: 2500000, kategori: 'Gaji' },
  { id: '2', nama: 'Gaji Barista 2', jumlah: 1200000, kategori: 'Gaji' },
  { id: '3', nama: 'Gaji Barista 3', jumlah: 800000, kategori: 'Gaji' },
  { id: '4', nama: 'Gaji Barista 4', jumlah: 765000, kategori: 'Gaji' },
  { id: '5', nama: 'Gaji Barista 5', jumlah: 240000, kategori: 'Gaji' },
  { id: '6', nama: 'Gaji Manager', jumlah: 500000, kategori: 'Gaji' },
  { id: '7', nama: 'Gaji Media', jumlah: 1000000, kategori: 'Gaji' },
  { id: '8', nama: 'Sewa Tempat', jumlah: 500000, kategori: 'Sewa & Utilitas' },
  { id: '9', nama: 'Listrik', jumlah: 500000, kategori: 'Sewa & Utilitas' },
  { id: '10', nama: 'PDAM', jumlah: 150000, kategori: 'Sewa & Utilitas' },
  { id: '11', nama: 'Wifi', jumlah: 350000, kategori: 'Sewa & Utilitas' },
  { id: '12', nama: 'Kasir', jumlah: 65000, kategori: 'Sewa & Utilitas' },
];

const DEFAULT_INGREDIENTS: RecipeIngredient[] = [
  { id: 'ing-1', namaBahan: 'Biji Kopi Espresso Blend', hargaBeli: 200000, satuanBeli: '1000 gram', takaranPerCup: 18, satuanTakaran: 'gram' }, // Rp 3,600
  { id: 'ing-2', namaBahan: 'Susu Fresh Milk / UHT', hargaBeli: 18000, satuanBeli: '1000 ml', takaranPerCup: 120, satuanTakaran: 'ml' }, // Rp 2,160
  { id: 'ing-3', namaBahan: 'Sirup Aren Organik', hargaBeli: 35000, satuanBeli: '1000 ml', takaranPerCup: 25, satuanTakaran: 'ml' }, // Rp 875
  { id: 'ing-4', namaBahan: 'Kemasan Cup, Lid & Straw', hargaBeli: 150000, satuanBeli: '100 pcs', takaranPerCup: 1, satuanTakaran: 'pcs' }, // Rp 1,500
  { id: 'ing-5', namaBahan: 'Es Batu & Filter Water', hargaBeli: 20000, satuanBeli: '50 cup', takaranPerCup: 1, satuanTakaran: 'cup' }, // Rp 400
  { id: 'ing-6', namaBahan: 'Daging Ayam & Bumbu Olahan', hargaBeli: 120000, satuanBeli: '1000 gram', takaranPerCup: 80, satuanTakaran: 'gram' },
  { id: 'ing-7', namaBahan: 'Mie Basah Ramen / Ayam', hargaBeli: 30000, satuanBeli: '1000 gram', takaranPerCup: 150, satuanTakaran: 'gram' },
  { id: 'ing-8', namaBahan: 'Beras / Nasi Putih Pulen', hargaBeli: 75000, satuanBeli: '5000 gram', takaranPerCup: 180, satuanTakaran: 'gram' },
  { id: 'ing-9', namaBahan: 'Kentang Shoestring Frozen', hargaBeli: 90000, satuanBeli: '2000 gram', takaranPerCup: 150, satuanTakaran: 'gram' },
  { id: 'ing-10', namaBahan: 'Minyak Goreng & Bumbu Dapur', hargaBeli: 35000, satuanBeli: '1000 ml', takaranPerCup: 25, satuanTakaran: 'ml' },
  { id: 'ing-11', namaBahan: 'Paper Box / Paper Bowl Makanan', hargaBeli: 75000, satuanBeli: '50 pcs', takaranPerCup: 1, satuanTakaran: 'pcs' },
  { id: 'ing-12', namaBahan: 'Sosis & Meatball Premium', hargaBeli: 60000, satuanBeli: '30 pcs', takaranPerCup: 2, satuanTakaran: 'pcs' },
];

const DEFAULT_DAILY_SALES: DailySalesRecord[] = [];

export interface CogsDailySalesPageProps {
  spreadsheetId?: string | null;
  spreadsheetName?: string | null;
  spreadsheetUrl?: string | null;
  token?: string | null;
  user?: any;
  userRole?: AppRole;
}

export default function CogsDailySalesPage({
  spreadsheetId,
  spreadsheetName,
  spreadsheetUrl,
  token,
  user,
  userRole = 'owner'
}: CogsDailySalesPageProps = {}) {
  // Navigation Subtab State inside App 2 (for Barista: locked to 'pencatatan_harian')
  const [activeSubTab, setActiveSubTab] = useState<'pencatatan_harian' | 'penjualan_menu' | 'kalkulator_cogs' | 'penggunaan_bahan' | 'barang_masuk' | 'forum_ai_hpp' | 'all'>(
    userRole === 'barista' ? 'pencatatan_harian' : 'all'
  );

  useEffect(() => {
    if (userRole === 'barista' && activeSubTab !== 'pencatatan_harian') {
      setActiveSubTab('pencatatan_harian');
    }
  }, [userRole, activeSubTab]);

  // Barista minimalist form filter states
  const [baristaSearch, setBaristaSearch] = useState<string>('');
  const [baristaCategory, setBaristaCategory] = useState<'ALL' | 'Minuman' | 'Makanan' | 'Snack'>('ALL');

  // Barista photo receipt scanner states
  const receiptCameraInputRef = useRef<HTMLInputElement | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const [receiptApplyMode, setReceiptApplyMode] = useState<'replace' | 'add'>('replace');
  const [isScanningReceipt, setIsScanningReceipt] = useState<boolean>(false);
  const [receiptScanProgress, setReceiptScanProgress] = useState<string>('');
  const [receiptScanError, setReceiptScanError] = useState<string | null>(null);
  const [receiptScanResult, setReceiptScanResult] = useState<ReceiptScanResult | null>(null);
  const [receiptUndoSnapshot, setReceiptUndoSnapshot] = useState<Record<string, { jatah: number; terjual: number }> | null>(null);
  const [unmatchedAssignMap, setUnmatchedAssignMap] = useState<Record<number, string>>({});

  // Ensure view starts at the top navigation when entering this page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Cloud Sync State
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Module Minimize / Collapse States
  const [isMinFormInput, setIsMinFormInput] = useState<boolean>(false);
  const [isMinChart, setIsMinChart] = useState<boolean>(false);
  const [isMinHistoric, setIsMinHistoric] = useState<boolean>(false);
  const [isMinCatalog, setIsMinCatalog] = useState<boolean>(false);
  const [isMinRecipeCalc, setIsMinRecipeCalc] = useState<boolean>(false);
  const [isMinMatrix, setIsMinMatrix] = useState<boolean>(false);
  const [isMinIngredientReport, setIsMinIngredientReport] = useState<boolean>(false);

  // Recipe PDF Export Modal States
  const [showRecipePdfModal, setShowRecipePdfModal] = useState<boolean>(false);
  const [pdfModalSelectedMenu, setPdfModalSelectedMenu] = useState<MenuItem | null>(null);

  // Sales, COGS & Incoming Goods PDF Report Modal State
  const [showSalesCogsReportPdfModal, setShowSalesCogsReportPdfModal] = useState<boolean>(false);

  const handleOpenPdfModalForMenu = (menu: MenuItem) => {
    setPdfModalSelectedMenu(menu);
    setShowRecipePdfModal(true);
  };

  const handleOpenPdfModalForAll = () => {
    setPdfModalSelectedMenu(null);
    setShowRecipePdfModal(true);
  };

  // Category Navigation Filters ('ALL' | 'Minuman' | 'Makanan' | 'Snack')
  const [cogsCategoryFilter, setCogsCategoryFilter] = useState<'ALL' | 'Minuman' | 'Makanan' | 'Snack'>('ALL');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<'ALL' | 'Minuman' | 'Makanan' | 'Snack'>('ALL');

  // Catalog Sorting State ('margin_pct_desc' | 'margin_pct_asc' | 'margin_desc' | 'margin_asc' | 'harga_desc' | 'harga_asc' | 'hpp_desc' | 'hpp_asc' | 'nama_asc' | 'nama_desc')
  type CatalogSortOption =
    | 'margin_pct_desc'
    | 'margin_pct_asc'
    | 'margin_desc'
    | 'margin_asc'
    | 'harga_desc'
    | 'harga_asc'
    | 'hpp_desc'
    | 'hpp_asc'
    | 'nama_asc'
    | 'nama_desc';

  const VALID_CATALOG_SORT_OPTIONS: readonly CatalogSortOption[] = [
    'margin_pct_desc',
    'margin_pct_asc',
    'margin_desc',
    'margin_asc',
    'harga_desc',
    'harga_asc',
    'hpp_desc',
    'hpp_asc',
    'nama_asc',
    'nama_desc',
  ];

  const [catalogSortOption, setCatalogSortOption] = useState<CatalogSortOption>(() => {
    const saved = localStorage.getItem('aruskas_cogs_catalog_sort_v2') as CatalogSortOption | null;
    return saved && (VALID_CATALOG_SORT_OPTIONS as readonly string[]).includes(saved)
      ? saved
      : 'nama_asc';
  });
  const catalogSortSelectRef = useRef<HTMLSelectElement | null>(null);
  const [confirmDeleteMenuId, setConfirmDeleteMenuId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_catalog_sort_v2', catalogSortOption);
    // Keep DOM <select> value aligned in case browser form-restoration overrides controlled value
    if (catalogSortSelectRef.current && catalogSortSelectRef.current.value !== catalogSortOption) {
      catalogSortSelectRef.current.value = catalogSortOption;
    }
  }, [catalogSortOption]);

  // AI Menu Margin Analysis State
  const [targetIdealMarginPct, setTargetIdealMarginPct] = useState<number>(65); // Default target 65%
  const [aiMarginAnalysisText, setAiMarginAnalysisText] = useState<string | null>(null);
  const [aiMarginAnalysisLoading, setAiMarginAnalysisLoading] = useState<boolean>(false);
  const [aiMarginAnalysisError, setAiMarginAnalysisError] = useState<string | null>(null);

  // States for Analysis Penggunaan Bahan Baku
  const [ingredientFilterTimeframe, setIngredientFilterTimeframe] = useState<'harian' | 'bulanan'>('harian');
  const [ingredientSelectedDate, setIngredientSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [ingredientSelectedMonth, setIngredientSelectedMonth] = useState<string>('ALL');
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState<string>('');
  const [ingredientViewMode, setIngredientViewMode] = useState<'bahan' | 'menu'>('bahan');
  const [expandedIngredientId, setExpandedIngredientId] = useState<string | null>(null);

  // Menu Catalog State
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const { deletedIds, deletedNames } = readDeletedMenuTombstones();
    const saved = localStorage.getItem('aruskas_cogs_page_menu_catalog');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return dedupeMenuCatalogItems(
            parsed
              .filter(
                (item: MenuItem) =>
                  item &&
                  !deletedIds.has(item.id) &&
                  !deletedNames.has(normalizeMenuSortName(item.nama).toLowerCase())
              )
              .map((item: MenuItem) => ({ ...item, defaultJatah: 0 }))
          );
        }
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_MENU_ITEMS.filter(
      item => !deletedIds.has(item.id) && !deletedNames.has(normalizeMenuSortName(item.nama).toLowerCase())
    );
  });
  const menuItemsRef = useRef<MenuItem[]>(menuItems);
  useEffect(() => {
    menuItemsRef.current = menuItems;
  }, [menuItems]);

  // Menu sorting mode state (default: bestseller_qty -> terbanyak terjual ke terbawah)
  const [menuSortMode, setMenuSortMode] = useState<'bestseller_qty' | 'bestseller_omset' | 'bestseller_profit' | 'alphabetical'>(() => {
    const saved = localStorage.getItem('aruskas_cogs_menu_sort_mode');
    if (saved === 'bestseller_qty' || saved === 'bestseller_omset' || saved === 'bestseller_profit' || saved === 'alphabetical') {
      return saved;
    }
    return 'bestseller_qty';
  });

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_menu_sort_mode', menuSortMode);
  }, [menuSortMode]);

  // Chart view mode state ('daily' trend or 'monthly' aggregated comparison)
  const [chartViewType, setChartViewType] = useState<'daily' | 'monthly'>('daily');

  // Search query state for Best Sellers Leaderboard
  const [bestsellerSearchQuery, setBestsellerSearchQuery] = useState<string>('');

  // Master financial parameters
  const [hargaPerCup, setHargaPerCup] = useState<number>(19000);
  const [hppPerCup, setHppPerCup] = useState<number>(9018);
  const [targetProfit, setTargetProfit] = useState<number>(3500000);
  const [useDailySalesAccumulation, setUseDailySalesAccumulation] = useState<boolean>(true);
  const [manualOmsetBulanan, setManualOmsetBulanan] = useState<number>(24357500);

  // Recipe ingredients calculator state
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(() => {
    const saved = localStorage.getItem('aruskas_cogs_ingredients');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_INGREDIENTS;
  });

  // Auto-recovery useEffect: if ingredients list becomes empty, restore DEFAULT_INGREDIENTS
  useEffect(() => {
    if (!ingredients || ingredients.length === 0) {
      setIngredients(DEFAULT_INGREDIENTS);
      localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(DEFAULT_INGREDIENTS));
    }
  }, [ingredients]);

  // Biaya items
  const [biayaList, setBiayaList] = useState<BiayaOperasionalItem[]>(() => {
    const saved = localStorage.getItem('aruskas_cogs_page_biaya');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return DEFAULT_BIAYA_ITEMS;
  });

  // Daily sales records
  const [dailySales, setDailySales] = useState<DailySalesRecord[]>(() => {
    const saved = localStorage.getItem('aruskas_cogs_page_daily_sales');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((rec: DailySalesRecord) => ({
            ...rec,
            menuSales: (rec.menuSales || []).map(ms => ({
              ...ms,
              jatah: ms.jatah === 20 ? 0 : (ms.jatah || 0)
            }))
          }));
        }
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_DAILY_SALES;
  });

  // Incoming Ingredient Batches (Barang Masuk) — Realtime synced with tab "Barang Masuk & Pembelian"
  const [incomingBatches, setIncomingBatches] = useState<IncomingIngredientBatch[]>(() => {
    const saved = localStorage.getItem('aruskas_cogs_incoming_batches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (b: any) => b && b.id !== 'in-batch-1' && b.id !== 'in-batch-2' && b.id !== 'in-batch-3'
          );
          if (filtered.length > 0) return filtered;
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  });

  // Selected date / mode for Daily Sales vs HPP visual comparison
  const [selectedComparisonDailyDate, setSelectedComparisonDailyDate] = useState<string>('LIVE_FORM');
  const [comparisonDailySortMode, setComparisonDailySortMode] = useState<'date_desc' | 'sales_desc' | 'hpp_desc' | 'profit_desc' | 'margin_desc'>('date_desc');
  const [isMinComparisonSection, setIsMinComparisonSection] = useState<boolean>(false);

  // Function to sync with Google Sheets Cloud & Shared Server Cache (Realtime all data across roles & devices)
  const syncDataToCloud = async (
    currentMenu = menuItems, 
    currentSales = dailySales,
    currentIngs = ingredients,
    currentBiaya = biayaList,
    currentIncoming = incomingBatches,
    explicitSelectedDate?: string
  ) => {
    const cleanSales = (currentSales || []).filter(
      r => r && r.id !== 'ds-1' && r.id !== 'ds-2' && r.id !== 'ds-3'
    );
    const activeDate = normalizeDateString(explicitSelectedDate || selectedDate) || explicitSelectedDate || selectedDate;

    // 1. Always push dailySales & menu_catalog to cross-device cloud & shared server cache so Barista <-> Owner/Manajer syncs across devices
    try {
      await pushDailySalesToCloud({
        records: cleanSales,
        selectedDate: activeDate,
        immediate: true
      });
    } catch {
      // ignore offline error
    }

    const { deletedIds: tombIds, deletedNames: tombNames } = readDeletedMenuTombstones();
    const deletedIdsArr = Array.from(tombIds);
    const deletedNamesArr = Array.from(tombNames);

    if (!spreadsheetId) {
      const nowTs = Date.now();
      lastMenuCatalogUpdatedAtRef.current = nowTs;
      await saveCloudSlot('menu_catalog', {
        items: currentMenu,
        deletedIds: deletedIdsArr,
        deletedNames: deletedNamesArr,
        updatedAt: nowTs,
      }).catch(() => {});
      return;
    }

    // Resolve valid OAuth token (fallback to shared Google OAuth token if logged in via role password)
    let activeOAuthToken = token && !token.endsWith('-local-token') ? token : (localStorage.getItem('aruskas_google_access_token') || '');
    if (!activeOAuthToken || activeOAuthToken.endsWith('-local-token')) {
      try {
        const resp = await fetch('/api/auth/shared-token');
        if (resp.ok) {
          const data = await resp.json();
          if (data?.accessToken && !data.accessToken.endsWith('-local-token')) {
            activeOAuthToken = data.accessToken;
            localStorage.setItem('aruskas_google_access_token', data.accessToken);
          }
        }
      } catch {
        // ignore
      }
    }
    if (!activeOAuthToken || activeOAuthToken.endsWith('-local-token')) {
      try {
        const cloudAuth = await loadCloudSlot<any>('auth_token');
        if (cloudAuth?.accessToken && !cloudAuth.accessToken.endsWith('-local-token')) {
          activeOAuthToken = cloudAuth.accessToken;
          localStorage.setItem('aruskas_google_access_token', cloudAuth.accessToken);
        }
      } catch {
        // ignore
      }
    }

    const effectiveToken = activeOAuthToken || token || 'local-token';

    setIsSyncingSheet(true);
    try {
      lastMenuCatalogUpdatedAtRef.current = Date.now();
      await saveMenuCatalogToSheet(spreadsheetId, currentMenu, effectiveToken, deletedIdsArr, deletedNamesArr);
      await saveDailySalesToSheet(spreadsheetId, cleanSales, effectiveToken, currentMenu);
      await saveIngredientsToSheet(spreadsheetId, currentIngs, effectiveToken);
      await saveBiayaListToSheet(spreadsheetId, currentBiaya, effectiveToken);
      await saveIncomingBatchesToSheet(spreadsheetId, currentIncoming, effectiveToken);
      setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error syncing data to Google Sheets:', err);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Debounced auto-save hook for real-time changes
  const isCloudLoadedRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const lastRemoteUpdatedAtRef = useRef<number>(0);
  const lastMenuCatalogUpdatedAtRef = useRef<number>(0);
  const autoSaveTimeoutRef = useRef<any>(null);

  // Inline recipe name editing states (for renaming directly inside Recipe Drawer)
  const [editingRecipeNameId, setEditingRecipeNameId] = useState<string | null>(null);
  const [editingRecipeNameValue, setEditingRecipeNameValue] = useState<string>('');

  const triggerAutoSaveToCloud = (
    currentMenu = menuItems,
    currentSales = dailySales,
    currentIngs = ingredients,
    currentBiaya = biayaList,
    currentIncoming = incomingBatches
  ) => {
    if (isApplyingRemoteRef.current) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (isApplyingRemoteRef.current) return;
      syncDataToCloud(currentMenu, currentSales, currentIngs, currentBiaya, currentIncoming);
    }, 1200);
  };

  // Sync to LocalStorage & Realtime Cloud Sync
  useEffect(() => {
    localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(menuItems));
    if (isCloudLoadedRef.current && !isApplyingRemoteRef.current) {
      triggerAutoSaveToCloud(menuItems, dailySales, ingredients, biayaList, incomingBatches);
    }
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(dailySales));
    if (isCloudLoadedRef.current && !isApplyingRemoteRef.current) {
      triggerAutoSaveToCloud(menuItems, dailySales, ingredients, biayaList, incomingBatches);
    }
  }, [dailySales]);

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(ingredients));
    if (isCloudLoadedRef.current && !isApplyingRemoteRef.current) {
      triggerAutoSaveToCloud(menuItems, dailySales, ingredients, biayaList, incomingBatches);
    }
  }, [ingredients]);

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_page_biaya', JSON.stringify(biayaList));
    if (isCloudLoadedRef.current && !isApplyingRemoteRef.current) {
      triggerAutoSaveToCloud(menuItems, dailySales, ingredients, biayaList, incomingBatches);
    }
  }, [biayaList]);

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(incomingBatches));
    if (isCloudLoadedRef.current && !isApplyingRemoteRef.current) {
      triggerAutoSaveToCloud(menuItems, dailySales, ingredients, biayaList, incomingBatches);
    }
  }, [incomingBatches]);

  // Handler CRUD for Incoming Batches (with immediate realtime Google Sheet & Cloud sync)
  const handleRefreshIncomingFromSheet = async () => {
    if (!spreadsheetId) return;
    setIsSyncingSheet(true);
    try {
      const cloudIncoming = await fetchIncomingBatchesFromSheet(spreadsheetId, token || 'local-token');
      if (cloudIncoming && cloudIncoming.length > 0) {
        isApplyingRemoteRef.current = true;
        setIncomingBatches(cloudIncoming);
        localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(cloudIncoming));
        setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 300);
      }
    } catch (err) {
      console.error('Error refreshing incoming batches:', err);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleAddIncomingBatch = (newBatch: Omit<IncomingIngredientBatch, 'id'>) => {
    const created: IncomingIngredientBatch = {
      ...newBatch,
      tanggal: normalizeDateString(newBatch.tanggal) || newBatch.tanggal,
      id: `in-batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setIncomingBatches(prev => {
      const next = [created, ...prev];
      localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(next));
      if (spreadsheetId) {
        saveIncomingBatchesToSheet(spreadsheetId, next, token || 'local-token').catch(() => {});
      }
      return next;
    });
  };

  const handleUpdateIncomingBatch = (updatedBatch: IncomingIngredientBatch) => {
    const stamped: IncomingIngredientBatch = {
      ...updatedBatch,
      tanggal: normalizeDateString(updatedBatch.tanggal) || updatedBatch.tanggal,
      createdAt: new Date().toISOString(),
    };
    setIncomingBatches(prev => {
      const next = prev.map(b => (b.id === stamped.id ? stamped : b));
      localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(next));
      if (spreadsheetId) {
        saveIncomingBatchesToSheet(spreadsheetId, next, token || 'local-token').catch(() => {});
      }
      return next;
    });
  };

  const handleDeleteIncomingBatch = (id: string) => {
    setIncomingBatches(prev => {
      const next = prev.filter(b => b.id !== id);
      localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(next));
      if (spreadsheetId) {
        saveIncomingBatchesToSheet(spreadsheetId, next, token || 'local-token', [id]).catch(() => {});
      }
      return next;
    });
  };

  // On mount / when connected to Google Sheets, pull remote catalog, daily sales, ingredients & biaya
  useEffect(() => {
    if (spreadsheetId && token) {
      const loadCloudData = async () => {
        setIsSyncingSheet(true);
        isApplyingRemoteRef.current = true;
        try {
          // 1. Fetch Remote Ingredients
          const cloudIngs = await fetchIngredientsFromSheet(spreadsheetId, token);
          if (cloudIngs && cloudIngs.length > 0) {
            setIngredients(cloudIngs);
            localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(cloudIngs));
          }

          // 2. Fetch Remote Biaya List
          const cloudBiaya = await fetchBiayaListFromSheet(spreadsheetId, token);
          if (cloudBiaya && cloudBiaya.length > 0) {
            setBiayaList(cloudBiaya);
            localStorage.setItem('aruskas_cogs_page_biaya', JSON.stringify(cloudBiaya));
          }

          // 3. Fetch Remote Menu Catalog & sync deletion tombstones
          const [cloudMenu, remoteMenuSlot] = await Promise.all([
            fetchMenuCatalogFromSheet(spreadsheetId, token),
            loadCloudSlot<{ items?: MenuItem[]; deletedIds?: string[]; deletedNames?: string[]; updatedAt?: number }>('menu_catalog').catch(() => null),
          ]);
          const localTombs = readDeletedMenuTombstones();
          const mergedDeletedIds = new Set<string>(localTombs.deletedIds);
          const mergedDeletedNames = new Set<string>(localTombs.deletedNames);
          (remoteMenuSlot?.deletedIds || []).forEach(id => { if (id) mergedDeletedIds.add(id); });
          (remoteMenuSlot?.deletedNames || []).forEach(n => {
            const nl = (n || '').trim().toLowerCase();
            if (nl) mergedDeletedNames.add(nl);
          });
          writeDeletedMenuTombstones(mergedDeletedIds, mergedDeletedNames);
          if (remoteMenuSlot?.updatedAt) {
            lastMenuCatalogUpdatedAtRef.current = Math.max(
              lastMenuCatalogUpdatedAtRef.current,
              Number(remoteMenuSlot.updatedAt) || 0
            );
          }

          let activeMenu = menuItemsRef.current;
          if (cloudMenu && cloudMenu.length > 0) {
            const cleanedCloudMenu = dedupeMenuCatalogItems(
              cloudMenu.filter(
                (m: MenuItem) =>
                  m &&
                  !mergedDeletedIds.has(m.id) &&
                  !mergedDeletedNames.has(normalizeMenuSortName(m.nama).toLowerCase())
              )
            );
            setMenuItems(cleanedCloudMenu);
            activeMenu = cleanedCloudMenu;
            localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(cleanedCloudMenu));
            // Persist cleaned catalog back if duplicate/deleted rows were stripped
            if (cleanedCloudMenu.length < cloudMenu.length) {
              const cleanTs = Date.now();
              lastMenuCatalogUpdatedAtRef.current = Math.max(lastMenuCatalogUpdatedAtRef.current, cleanTs);
              saveMenuCatalogToSheet(
                spreadsheetId,
                cleanedCloudMenu,
                token,
                Array.from(mergedDeletedIds),
                Array.from(mergedDeletedNames)
              ).catch(() => {});
            }
          }

          // 4. Fetch Cross-Device Cloud & Shared Server Daily Sales (Barista <-> Owner/Manager) & Remote Google Sheet Daily Sales
          let sharedServerRecords: DailySalesRecord[] = [];
          let sharedLastSelectedDate: string | null = null;
          try {
            const sharedData = await pullDailySalesFromCloud();
            if (sharedData?.updatedAt && sharedData.updatedAt > lastRemoteUpdatedAtRef.current) {
              lastRemoteUpdatedAtRef.current = sharedData.updatedAt;
            }
            if (sharedData?.lastSelectedDate) {
              const normSharedDate = normalizeDateString(sharedData.lastSelectedDate) || sharedData.lastSelectedDate;
              sharedLastSelectedDate = normSharedDate;
              localStorage.setItem('aruskas_cogs_selected_date', normSharedDate);
              setSelectedDate(normSharedDate);
            }
            if (sharedData?.recordsByDate && typeof sharedData.recordsByDate === 'object') {
              sharedServerRecords = (Object.values(sharedData.recordsByDate) as DailySalesRecord[]).filter(
                r => r && r.id !== 'ds-1' && r.id !== 'ds-2' && r.id !== 'ds-3'
              );
            }
          } catch {
            // ignore
          }

          const cloudSales = await fetchDailySalesFromSheet(spreadsheetId, token, activeMenu);
          if ((cloudSales && cloudSales.length > 0) || sharedServerRecords.length > 0) {
            setDailySales(prevSales => {
              const mergedMap = new Map<string, DailySalesRecord>();
              
              // First add existing non-dummy local sales
              prevSales.forEach(rec => {
                if (!rec || rec.id === 'ds-1' || rec.id === 'ds-2' || rec.id === 'ds-3') return;
                const normDate = normalizeDateString(rec.tanggal) || rec.tanggal;
                mergedMap.set(normDate, rec);
              });

              // Merge shared server/cloud records (from Barista / Manager / Owner session across devices)
              sharedServerRecords.forEach(sRec => {
                if (!sRec || !sRec.tanggal) return;
                const normDate = normalizeDateString(sRec.tanggal) || sRec.tanggal;
                const existing = mergedMap.get(normDate) as any;
                const sUpdated = (sRec as any).updatedAt || 0;
                const exUpdated = existing?.updatedAt || 0;
                if (!existing || sUpdated >= exUpdated) {
                  mergedMap.set(normDate, { ...sRec, tanggal: normDate });
                }
              });

              // Smart merge with cloudSales (preserving newer local/Barista entries!)
              (cloudSales || []).forEach(cRec => {
                if (!cRec || cRec.id === 'ds-1' || cRec.id === 'ds-2' || cRec.id === 'ds-3') return;
                const normDate = normalizeDateString(cRec.tanggal) || cRec.tanggal;
                const existing = mergedMap.get(normDate) as any;
                
                if (!existing) {
                  mergedMap.set(normDate, cRec);
                } else {
                  const hasLocalUpdate = Boolean(existing.updatedAt);
                  const baseList = (cRec.menuSales && cRec.menuSales.length > 0)
                    ? cRec.menuSales
                    : (existing.menuSales || []);

                  const mergedMenuSales = baseList.map((cMs: any) => {
                    const localMs = existing.menuSales?.find((lMs: any) => 
                      lMs.menuId === cMs.menuId || (lMs.nama && cMs.nama && lMs.nama.trim().toLowerCase() === cMs.nama.trim().toLowerCase())
                    );
                    const finalJatah = hasLocalUpdate && localMs !== undefined
                      ? (localMs.jatah ?? cMs.jatah ?? 0)
                      : (typeof cMs.jatah === 'number' && cMs.jatah > 0) 
                        ? cMs.jatah 
                        : (localMs?.jatah ?? cMs.jatah ?? 0);
                    const finalTerjual = hasLocalUpdate && localMs !== undefined
                      ? (localMs.terjual ?? cMs.terjual ?? 0)
                      : (typeof cMs.terjual === 'number' && cMs.terjual > 0)
                        ? cMs.terjual
                        : (localMs?.terjual ?? cMs.terjual ?? 0);

                    return {
                      ...cMs,
                      jatah: finalJatah,
                      terjual: finalTerjual
                    };
                  });

                  // Also preserve any menu items present in existing.menuSales that weren't in cRec.menuSales
                  if (existing.menuSales && Array.isArray(existing.menuSales)) {
                    existing.menuSales.forEach((lMs: any) => {
                      const inMerged = mergedMenuSales.some((mMs: any) =>
                        mMs.menuId === lMs.menuId || (mMs.nama && lMs.nama && mMs.nama.trim().toLowerCase() === lMs.nama.trim().toLowerCase())
                      );
                      if (!inMerged) {
                        mergedMenuSales.push(lMs);
                      }
                    });
                  }

                  const finalMenuSales = mergedMenuSales.length > 0 ? mergedMenuSales : (existing.menuSales || cRec.menuSales || []);
                  const calcCups = finalMenuSales.reduce((s: number, ms: any) => s + (Number(ms.terjual) || 0), 0);
                  const calcOmset = finalMenuSales.reduce((s: number, ms: any) => {
                    const matched = activeMenu.find(m => m.id === ms.menuId || (m.nama || '').trim().toLowerCase() === (ms.nama || '').trim().toLowerCase());
                    const harga = Number(ms.hargaJual) || matched?.hargaJual || 0;
                    return s + ((Number(ms.terjual) || 0) * harga);
                  }, 0);
                  const calcHpp = finalMenuSales.reduce((s: number, ms: any) => {
                    const matched = activeMenu.find(m => m.id === ms.menuId || (m.nama || '').trim().toLowerCase() === (ms.nama || '').trim().toLowerCase());
                    const hppUnit = Number(ms.hpp) || matched?.hpp || 0;
                    return s + (((Number(ms.terjual) || 0) + (Number(ms.jatah) || 0)) * hppUnit);
                  }, 0);

                  mergedMap.set(normDate, {
                    ...cRec,
                    ...(hasLocalUpdate ? { updatedAt: existing.updatedAt } : {}),
                    cups: calcCups > 0 || hasLocalUpdate ? calcCups : (cRec.cups || existing.cups || 0),
                    omset: calcOmset > 0 || hasLocalUpdate ? calcOmset : (cRec.omset || existing.omset || 0),
                    hppTotal: calcHpp > 0 || hasLocalUpdate ? calcHpp : (cRec.hppTotal || existing.hppTotal || 0),
                    notes: (hasLocalUpdate && existing.notes) ? existing.notes : (cRec.notes || existing.notes || ''),
                    menuSales: finalMenuSales
                  } as DailySalesRecord);
                }
              });

              const mergedList = Array.from(mergedMap.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
              localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(mergedList));

              // If the newly opened device has no record for its current selectedDate, snap to sharedLastSelectedDate or the most recent recorded date with data
              const targetCheckDate = sharedLastSelectedDate || normalizeDateString(selectedDate) || selectedDate;
              const hasTargetRecord = mergedList.some(r => (normalizeDateString(r.tanggal) || r.tanggal) === targetCheckDate);
              if (!hasTargetRecord && mergedList.length > 0) {
                const latestWithData = [...mergedList].reverse().find(r => (r.cups || 0) > 0 || (r.omset || 0) > 0 || (r.menuSales || []).some(ms => (ms.jatah || 0) > 0 || (ms.terjual || 0) > 0)) || mergedList[mergedList.length - 1];
                if (latestWithData?.tanggal) {
                  const latestNorm = normalizeDateString(latestWithData.tanggal) || latestWithData.tanggal;
                  localStorage.setItem('aruskas_cogs_selected_date', latestNorm);
                  setSelectedDate(latestNorm);
                }
              }

              return mergedList;
            });

            // Auto-merge newly discovered menu items from Google Sheet into activeMenu catalog (ignoring renamed aliases, existing IDs, & deleted menus)
            const { deletedIds: deletedIdSet, deletedNames: deletedNameSet } = readDeletedMenuTombstones();
            const currentIds = new Set(activeMenu.map(m => m.id));
            const currentNames = new Set<string>();
            activeMenu.forEach(m => {
              const nm = (m.nama || '').trim().toLowerCase();
              if (nm) currentNames.add(nm);
              if (Array.isArray(m.aliases)) {
                m.aliases.forEach(a => {
                  const al = (a || '').trim().toLowerCase();
                  if (al) currentNames.add(al);
                });
              }
            });
            const newMenus: MenuItem[] = [];

            cloudSales.forEach(rec => {
              if (rec.menuSales) {
                rec.menuSales.forEach((ms: any) => {
                  const nameLower = (ms.nama || '').trim().toLowerCase();
                  const hasKnownId = Boolean(ms.menuId && currentIds.has(ms.menuId));
                  const isDeletedMenu = Boolean(
                    (ms.menuId && deletedIdSet.has(ms.menuId)) ||
                    (nameLower && deletedNameSet.has(nameLower))
                  );
                  if (!hasKnownId && !isDeletedMenu && nameLower && !currentNames.has(nameLower)) {
                    currentNames.add(nameLower);
                    newMenus.push({
                      id: ms.menuId || `menu-${nameLower.replace(/[^a-z0-9]/g, '-')}`,
                      nama: ms.nama,
                      kategori: 'Minuman',
                      hargaJual: 0,
                      hpp: 0,
                      defaultJatah: 0,
                      recipe: []
                    });
                  }
                });
              }
            });

            if (newMenus.length > 0) {
              const mergedCatalog = dedupeMenuCatalogItems([...activeMenu, ...newMenus]);
              setMenuItems(mergedCatalog);
              localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(mergedCatalog));
            }
          }

          // 5. Fetch Remote Incoming Batches (Barang Masuk)
          const cloudIncoming = await fetchIncomingBatchesFromSheet(spreadsheetId, token);
          if (cloudIncoming && cloudIncoming.length > 0) {
            setIncomingBatches(cloudIncoming);
            localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(cloudIncoming));
          }

          setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
          console.error('Error fetching cloud data:', err);
        } finally {
          setIsSyncingSheet(false);
          isCloudLoadedRef.current = true;
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 400);
        }
      };
      loadCloudData();
    } else {
      isCloudLoadedRef.current = true;
    }
  }, [spreadsheetId, token]);

  // Background cross-device polling so changes made on Device A (e.g. Barista HP) appear automatically on Device B (Owner/Manager Laptop)
  useEffect(() => {
    let isMounted = true;
    const pollCrossDeviceSales = async () => {
      try {
        const sharedData = await pullDailySalesFromCloud();
        if (!isMounted || !sharedData) return;

        const remoteUpdated = Number(sharedData.updatedAt) || 0;
        const hasNewRemoteUpdate = remoteUpdated > lastRemoteUpdatedAtRef.current;

        if (sharedData.recordsByDate && typeof sharedData.recordsByDate === 'object') {
          const remoteRecords = (Object.values(sharedData.recordsByDate) as DailySalesRecord[]).filter(
            r => r && r.id !== 'ds-1' && r.id !== 'ds-2' && r.id !== 'ds-3'
          );
          if (remoteRecords.length > 0) {
            setDailySales(prev => {
              let changed = false;
              const map = new Map<string, DailySalesRecord>();
              prev.forEach(r => {
                if (!r || r.id === 'ds-1' || r.id === 'ds-2' || r.id === 'ds-3') return;
                const d = normalizeDateString(r.tanggal) || r.tanggal;
                map.set(d, r);
              });
              remoteRecords.forEach(r => {
                if (!r || !r.tanggal) return;
                const d = normalizeDateString(r.tanggal) || r.tanggal;
                const ex = map.get(d) as any;
                const rUp = (r as any).updatedAt || 0;
                const exUp = ex?.updatedAt || 0;
                if (!ex || rUp > exUp) {
                  map.set(d, { ...r, tanggal: d });
                  changed = true;
                }
              });
              if (!changed) return prev;
              isApplyingRemoteRef.current = true;
              const next = Array.from(map.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
              localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(next));
              setTimeout(() => {
                isApplyingRemoteRef.current = false;
              }, 300);
              return next;
            });
          }
        }

        if (hasNewRemoteUpdate && sharedData.lastSelectedDate) {
          lastRemoteUpdatedAtRef.current = remoteUpdated;
          const normRemoteDate = normalizeDateString(sharedData.lastSelectedDate) || sharedData.lastSelectedDate;
          if (normRemoteDate) {
            localStorage.setItem('aruskas_cogs_selected_date', normRemoteDate);
            setSelectedDate(normRemoteDate);
          }
        }

        // Realtime poll for Catalog Menu / Recipe renames & deletions across devices & roles
        try {
          const remoteCatalog = await loadCloudSlot<{ items?: MenuItem[]; deletedIds?: string[]; deletedNames?: string[]; updatedAt?: number }>('menu_catalog');
          if (isMounted && remoteCatalog && Array.isArray(remoteCatalog.items)) {
            const remoteCatalogTs = Number(remoteCatalog.updatedAt) || 0;
            if (remoteCatalogTs > lastMenuCatalogUpdatedAtRef.current && (remoteCatalog.items.length > 0 || remoteCatalogTs > 0)) {
              lastMenuCatalogUpdatedAtRef.current = remoteCatalogTs;
              const tombs = readDeletedMenuTombstones();
              if (Array.isArray(remoteCatalog.deletedIds)) {
                remoteCatalog.deletedIds.forEach(id => { if (id) tombs.deletedIds.add(id); });
              }
              if (Array.isArray(remoteCatalog.deletedNames)) {
                remoteCatalog.deletedNames.forEach(n => {
                  const nl = (n || '').trim().toLowerCase();
                  if (nl) tombs.deletedNames.add(nl);
                });
              }
              writeDeletedMenuTombstones(tombs.deletedIds, tombs.deletedNames);

              const nextRemoteItems = dedupeMenuCatalogItems(
                remoteCatalog.items.filter(
                  m =>
                    m &&
                    !tombs.deletedIds.has(m.id) &&
                    !tombs.deletedNames.has(normalizeMenuSortName(m.nama).toLowerCase())
                )
              );
              setMenuItems(prev => {
                const prevSig = `${prev.length}::` + prev.map(m => `${m.id}:${m.nama}:${m.hargaJual}:${m.hpp}:${m.defaultJatah}`).join('|');
                const nextSig = `${nextRemoteItems.length}::` + nextRemoteItems.map(m => `${m.id}:${m.nama}:${m.hargaJual}:${m.hpp}:${m.defaultJatah}`).join('|');
                if (prevSig === nextSig) return prev;
                isApplyingRemoteRef.current = true;
                localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(nextRemoteItems));
                setTimeout(() => {
                  isApplyingRemoteRef.current = false;
                }, 300);
                return nextRemoteItems;
              });
            }
          }
        } catch {
          // ignore cloud catalog poll error
        }

        // Realtime poll for "Barang Masuk & Pembelian" from Google Spreadsheet
        if (spreadsheetId) {
          const remoteIncoming = await fetchIncomingBatchesFromSheet(spreadsheetId, token || 'local-token');
          if (isMounted && remoteIncoming && remoteIncoming.length > 0) {
            setIncomingBatches(prev => {
              const prevSig = prev.map(b => `${b.id}:${b.tanggal}:${b.harga}:${b.statusPembayaran}`).join('|');
              const nextSig = remoteIncoming.map(b => `${b.id}:${b.tanggal}:${b.harga}:${b.statusPembayaran}`).join('|');
              if (prevSig === nextSig) return prev;
              isApplyingRemoteRef.current = true;
              localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(remoteIncoming));
              setTimeout(() => {
                isApplyingRemoteRef.current = false;
              }, 300);
              return remoteIncoming;
            });
          }
        }
      } catch {
        // ignore network poll errors
      }
    };

    const intervalId = setInterval(pollCrossDeviceSales, 7000);
    const handleFocus = () => {
      pollCrossDeviceSales();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [spreadsheetId, token]);

  // Export and Import Data Sheet JSON Backup
  const handleExportDataSheetJSON = () => {
    const data = {
      menuItems,
      dailySales,
      ingredients,
      biayaList,
      incomingBatches,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aruskas_menu_cogs_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDataSheetJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.menuItems && Array.isArray(parsed.menuItems)) {
          setMenuItems(parsed.menuItems);
        }
        if (parsed.dailySales && Array.isArray(parsed.dailySales)) {
          setDailySales(parsed.dailySales);
        }
        if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
          setIngredients(parsed.ingredients);
        }
        if (parsed.biayaList && Array.isArray(parsed.biayaList)) {
          setBiayaList(parsed.biayaList);
        }
        if (parsed.incomingBatches && Array.isArray(parsed.incomingBatches)) {
          setIncomingBatches(parsed.incomingBatches);
        }
        alert('Data berhasil diimpor! Spreadsheet internal telah diperbarui.');
        if (spreadsheetId && token) {
          syncDataToCloud(
            parsed.menuItems || menuItems, 
            parsed.dailySales || dailySales,
            parsed.ingredients || ingredients,
            parsed.biayaList || biayaList,
            parsed.incomingBatches || incomingBatches
          );
        }
      } catch (err) {
        alert('Format file JSON tidak valid!');
      }
    };
    reader.readAsText(file);
  };

  // Daily Entry Mode: 'itemized' (Per Menu & Jatah) vs 'quick' (Total Direct Input)
  const [entryMode, setEntryMode] = useState<'itemized' | 'quick'>('itemized');

  // Form State for Itemized Daily Entry (persisted across Barista, Manager & Owner roles)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const savedDate = localStorage.getItem('aruskas_cogs_selected_date');
    if (savedDate) return normalizeDateString(savedDate) || savedDate;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [dailyNotes, setDailyNotes] = useState<string>('');

  useEffect(() => {
    const norm = normalizeDateString(selectedDate) || selectedDate;
    if (norm) {
      localStorage.setItem('aruskas_cogs_selected_date', norm);
    }
  }, [selectedDate]);

  // Listen for cross-tab / cross-role updates from Barista -> Owner & Manager
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'aruskas_cogs_page_daily_sales' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setDailySales(parsed);
          }
        } catch {}
      } else if (e.key === 'aruskas_cogs_page_menu_catalog' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setMenuItems(parsed);
          }
        } catch {}
      } else if (e.key === 'aruskas_cogs_selected_date' && e.newValue) {
        setSelectedDate(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);
  
  // State for daily itemized inputs (menuId -> { jatah, terjual })
  const [itemizedInputs, setItemizedInputs] = useState<Record<string, { jatah: number; terjual: number }>>({});

  // Helper to immediately persist any form input changes into dailySales & shared storage so Owner/Manager sees Barista inputs automatically
  const commitItemizedInputsLive = (
    nextInputs: Record<string, { jatah: number; terjual: number }>,
    dateStr = selectedDate,
    notesStr = dailyNotes
  ) => {
    const normSelected = normalizeDateString(dateStr) || dateStr;
    localStorage.setItem('aruskas_cogs_selected_date', normSelected);

    const menuSalesList: DailyMenuItemSale[] = menuItems.map(item => {
      const input = nextInputs[item.id] || { jatah: item.defaultJatah, terjual: 0 };
      return {
        menuId: item.id,
        nama: item.nama,
        kategori: item.kategori,
        hargaJual: item.hargaJual,
        hpp: item.hpp,
        jatah: Number(input.jatah) || 0,
        terjual: Number(input.terjual) || 0
      };
    });

    const cups = menuSalesList.reduce((s, ms) => s + (ms.terjual || 0), 0);
    const omset = menuSalesList.reduce((s, ms) => s + ((ms.terjual || 0) * (ms.hargaJual || 0)), 0);
    const hppTotal = menuSalesList.reduce((s, ms) => s + (((ms.terjual || 0) + (ms.jatah || 0)) * (ms.hpp || 0)), 0);

    setDailySales(prev => {
      const existingIndex = prev.findIndex(d => normalizeDateString(d.tanggal) === normSelected);
      const newRecord: DailySalesRecord & { updatedAt?: number } = {
        id: existingIndex >= 0 ? prev[existingIndex].id : `ds-${Date.now()}`,
        tanggal: normSelected,
        cups,
        omset,
        hppTotal,
        notes: (notesStr || '').trim(),
        menuSales: menuSalesList,
        updatedAt: Date.now()
      };

      let nextList: DailySalesRecord[];
      if (existingIndex >= 0) {
        nextList = [...prev];
        nextList[existingIndex] = newRecord;
      } else {
        nextList = [...prev, newRecord].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      }

      localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(nextList));
      lastRemoteUpdatedAtRef.current = newRecord.updatedAt || Date.now();
      pushDailySalesToCloud({
        record: newRecord,
        selectedDate: normSelected
      }).catch(() => {});

      return nextList;
    });
  };

  // Quick form states
  const [quickJatah, setQuickJatah] = useState<string>('0');
  const [quickCups, setQuickCups] = useState<string>('45');
  const [quickOmset, setQuickOmset] = useState<string>('855000');

  // Helper batch actions for Itemized Sales & Jatah Input
  const handleFillSalesFromJatah = () => {
    const nextInputs: Record<string, { jatah: number; terjual: number }> = {};
    menuItems.forEach(m => {
      const jatahVal = itemizedInputs[m.id]?.jatah ?? m.defaultJatah ?? 0;
      nextInputs[m.id] = { jatah: jatahVal, terjual: jatahVal };
    });
    setItemizedInputs(nextInputs);
    commitItemizedInputsLive(nextInputs);
  };

  const handleResetSalesToZero = () => {
    const nextInputs: Record<string, { jatah: number; terjual: number }> = {};
    menuItems.forEach(m => {
      const jatahVal = itemizedInputs[m.id]?.jatah ?? m.defaultJatah ?? 0;
      nextInputs[m.id] = { jatah: jatahVal, terjual: 0 };
    });
    setItemizedInputs(nextInputs);
    commitItemizedInputsLive(nextInputs);
  };

  const handleResetJatahToDefault = () => {
    const nextInputs: Record<string, { jatah: number; terjual: number }> = {};
    menuItems.forEach(m => {
      const terjualVal = itemizedInputs[m.id]?.terjual ?? 0;
      nextInputs[m.id] = { jatah: 0, terjual: terjualVal };
    });
    setItemizedInputs(nextInputs);
    setQuickJatah('0');
    commitItemizedInputsLive(nextInputs);
  };

  const handleResetAllJatahToZeroAllMonths = () => {
    if (!window.confirm('Reset angka jatah barista (20 / default) menjadi 0 untuk SEMUA bulan dan menu agar dapat diinput manual?')) {
      return;
    }
    const nextInputs: Record<string, { jatah: number; terjual: number }> = {};
    menuItems.forEach(m => {
      const terjualVal = itemizedInputs[m.id]?.terjual ?? 0;
      nextInputs[m.id] = { jatah: 0, terjual: terjualVal };
    });
    setItemizedInputs(nextInputs);
    setQuickJatah('0');

    const updatedSales = dailySales.map(rec => ({
      ...rec,
      menuSales: (rec.menuSales || []).map(ms => ({
        ...ms,
        jatah: 0
      }))
    }));
    setDailySales(updatedSales);
    localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(updatedSales));

    const updatedMenus = menuItems.map(m => ({ ...m, defaultJatah: 0 }));
    setMenuItems(updatedMenus);
    localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(updatedMenus));

    alert('Berhasil mereset semua jatah barista menjadi 0 untuk semua bulan & menu! Anda sekarang bisa menginput secara manual.');
  };

  // Apply scanned receipt items immediately to itemizedInputs & live shared sync
  const applyScannedReceiptItems = (
    scannedItems: ReceiptScanResult['items'],
    mode: 'replace' | 'add',
    targetDateStr = selectedDate,
    baseInputs = itemizedInputs
  ) => {
    const qtyByMenuId = new Map<string, number>();
    scannedItems.forEach((item) => {
      qtyByMenuId.set(item.menuId, (qtyByMenuId.get(item.menuId) || 0) + (Number(item.qty) || 0));
    });

    const nextInputs: Record<string, { jatah: number; terjual: number }> = {};
    menuItems.forEach((m) => {
      const existing = baseInputs[m.id] || { jatah: m.defaultJatah, terjual: 0 };
      const scannedQty = qtyByMenuId.get(m.id) || 0;
      nextInputs[m.id] = {
        jatah: existing.jatah,
        terjual: mode === 'add' ? (existing.terjual || 0) + scannedQty : scannedQty,
      };
    });

    setItemizedInputs(nextInputs);
    commitItemizedInputsLive(nextInputs, targetDateStr);
  };

  const handleReceiptPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setReceiptScanError(null);
    setUnmatchedAssignMap({});
    setIsScanningReceipt(true);
    setReceiptScanProgress('Menyiapkan foto nota...');

    // Save undo snapshot before applying new scan
    const snapshot: Record<string, { jatah: number; terjual: number }> = {};
    menuItems.forEach((m) => {
      snapshot[m.id] = { ...(itemizedInputs[m.id] || { jatah: m.defaultJatah, terjual: 0 }) };
    });

    try {
      const result = await scanSalesReceiptImage(file, menuItems, (msg) => {
        setReceiptScanProgress(msg);
      });
      setReceiptScanResult(result);

      if (result.items.length > 0) {
        setReceiptUndoSnapshot(snapshot);
        applyScannedReceiptItems(result.items, receiptApplyMode, selectedDate, snapshot);
      } else {
        setReceiptUndoSnapshot(null);
        setReceiptScanError(
          'Belum ada nama menu yang cocok otomatis dari foto ini. Pastikan tulisan nama menu dan jumlah terjual pada nota terlihat jelas.'
        );
      }
    } catch (err: any) {
      console.error('Receipt scan failed:', err);
      setReceiptScanError(err?.message || 'Gagal membaca foto nota. Coba ambil ulang dengan cahaya yang lebih jelas.');
    } finally {
      setIsScanningReceipt(false);
      setReceiptScanProgress('');
    }
  };

  const handleUndoReceiptScan = () => {
    if (!receiptUndoSnapshot) return;
    setItemizedInputs(receiptUndoSnapshot);
    commitItemizedInputsLive(receiptUndoSnapshot);
    setReceiptUndoSnapshot(null);
    setReceiptScanResult(null);
    setReceiptScanError(null);
  };

  const handleAssignUnmatchedReceiptItem = (unmatchedIdx: number, receiptName: string, qty: number) => {
    const chosenMenuId = unmatchedAssignMap[unmatchedIdx];
    if (!chosenMenuId) return;
    const chosenMenu = menuItems.find((m) => m.id === chosenMenuId);
    if (!chosenMenu) return;

    setItemizedInputs((prev) => {
      const current = prev[chosenMenuId] || { jatah: chosenMenu.defaultJatah, terjual: 0 };
      const next = {
        ...prev,
        [chosenMenuId]: {
          ...current,
          terjual: (current.terjual || 0) + qty,
        },
      };
      commitItemizedInputsLive(next);
      return next;
    });

    setReceiptScanResult((prev) => {
      if (!prev) return prev;
      const remainingUnmatched = prev.unmatched.filter((_, idx) => idx !== unmatchedIdx);
      const existingIdx = prev.items.findIndex((it) => it.menuId === chosenMenuId);
      const nextItems = [...prev.items];
      if (existingIdx >= 0) {
        nextItems[existingIdx] = {
          ...nextItems[existingIdx],
          qty: nextItems[existingIdx].qty + qty,
          receiptName: `${nextItems[existingIdx].receiptName}, ${receiptName}`,
        };
      } else {
        nextItems.push({
          menuId: chosenMenuId,
          matchedMenuName: chosenMenu.nama,
          receiptName,
          qty,
          confidence: 'high',
        });
      }
      return { ...prev, items: nextItems, unmatched: remainingUnmatched };
    });

    setUnmatchedAssignMap((prev) => {
      const copy = { ...prev };
      delete copy[unmatchedIdx];
      return copy;
    });
  };

  const handleApplyDetectedReceiptDate = (detectedDate: string) => {
    if (!detectedDate || !receiptScanResult) return;
    setSelectedDate(detectedDate);
    if (receiptScanResult.items.length > 0) {
      const existingRec = dailySales.find((d) => normalizeDateString(d.tanggal) === detectedDate);
      const targetBase: Record<string, { jatah: number; terjual: number }> = {};
      menuItems.forEach((m) => {
        const found = existingRec?.menuSales?.find((ms) => ms.menuId === m.id);
        targetBase[m.id] = {
          jatah: found ? Number(found.jatah) || 0 : m.defaultJatah,
          terjual: found ? Number(found.terjual) || 0 : 0,
        };
      });
      applyScannedReceiptItems(receiptScanResult.items, receiptApplyMode, detectedDate, targetBase);
    }
  };

  // Excel Input File Ref & Handlers
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadExcelTemplate = () => {
    // Template table formatted with columns: Tanggal, Nama Menu, Porsi Terjual
    const templateRows = menuItems.map(item => {
      const currentInput = itemizedInputs[item.id] || { jatah: item.defaultJatah || 0, terjual: 0 };
      return {
        'Tanggal': selectedDate,
        'Nama Menu': item.nama,
        'Porsi Terjual': currentInput.terjual || 0
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    worksheet['!cols'] = [
      { wch: 18 }, // Tanggal
      { wch: 36 }, // Nama Menu
      { wch: 18 }  // Porsi Terjual
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catatan Penjualan');

    // Instruction Sheet
    const panduanData = [
      { 'PANDUAN PENGISIAN TEMPLATE EXCEL PENJUALAN': '1. Kolom "Tanggal": Isikan tanggal penjualan dengan format YYYY-MM-DD (contoh: 2026-07-28).' },
      { 'PANDUAN PENGISIAN TEMPLATE EXCEL PENJUALAN': '2. Kolom "Nama Menu": Nama menu kopi / minuman / makanan (sudah terisi otomatis sesuai katalog).' },
      { 'PANDUAN PENGISIAN TEMPLATE EXCEL PENJUALAN': '3. Kolom "Porsi Terjual": Isikan jumlah porsi terjual untuk menu tersebut (angka bulat, contoh: 25, 40, dll).' },
      { 'PANDUAN PENGISIAN TEMPLATE EXCEL PENJUALAN': '4. Anda dapat menyalin atau menambah baris untuk mencatat penjualan beberapa tanggal sekaligus.' },
      { 'PANDUAN PENGISIAN TEMPLATE EXCEL PENJUALAN': '5. Simpan file Excel ini (.xlsx), lalu klik tombol "Upload Excel Data" di aplikasi.' },
      { 'PANDUAN PENGISIAN TEMPLATE EXCEL PENJUALAN': '6. Seluruh data penjualan harian menu akan langsung otomatis terinput dan tersimpan di aplikasi serta tersinkronisasi!' }
    ];
    const panduanSheet = XLSX.utils.json_to_sheet(panduanData);
    panduanSheet['!cols'] = [{ wch: 95 }];
    XLSX.utils.book_append_sheet(workbook, panduanSheet, 'Panduan Pengisian');

    XLSX.writeFile(workbook, `Template_Penjualan_Menu_${selectedDate}.xlsx`);
  };

  const handleUploadExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        // Select worksheet (prefer sheet named 'Catatan Penjualan' / 'Penjualan' / 'Sales' or non-panduan sheet)
        let targetSheetName = workbook.SheetNames.find(s => 
          s.toLowerCase().includes('penjualan') || 
          s.toLowerCase().includes('catatan') || 
          s.toLowerCase().includes('sales') ||
          s.toLowerCase().includes('menu')
        );
        if (!targetSheetName) {
          targetSheetName = workbook.SheetNames.find(s => !s.toLowerCase().includes('panduan')) || workbook.SheetNames[0];
        }
        const worksheet = workbook.Sheets[targetSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          alert('File Excel kosong atau format tidak sesuai.');
          return;
        }

        // Keep local copy of menu catalog in case new menus are in the excel
        let currentMenuItems = [...menuItems];
        let hasNewMenus = false;

        // Group inputs by Date
        const recordsByDate: Record<string, {
          notes: string;
          itemInputs: Record<string, { jatah?: number; terjual: number }>;
        }> = {};

        let totalParsedRows = 0;

        rows.forEach((row: any) => {
          // Flexible key lookup for date
          const dateRaw = row['Tanggal'] ?? row['tanggal'] ?? row['TANGGAL'] ?? 
                          row['Tanggal (YYYY-MM-DD)'] ?? row['Date'] ?? row['date'] ?? 
                          row['Tgl'] ?? row['tgl'] ?? selectedDate;
          
          let dateStr = '';
          if (dateRaw instanceof Date) {
            const y = dateRaw.getFullYear();
            const m = String(dateRaw.getMonth() + 1).padStart(2, '0');
            const d = String(dateRaw.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
          } else {
            dateStr = normalizeDateString(dateRaw) || String(dateRaw || '').trim();
          }
          if (!dateStr || dateStr.length < 8) {
            dateStr = normalizeDateString(selectedDate) || selectedDate;
          }

          // Flexible key lookup for Menu Name or ID
          const menuNamaRaw = String(
            row['Nama Menu'] ?? row['nama_menu'] ?? row['NAMA MENU'] ?? 
            row['Nama'] ?? row['nama'] ?? row['Menu'] ?? row['menu'] ?? 
            row['Item'] ?? row['item'] ?? ''
          ).trim();
          const menuIdRaw = String(
            row['ID Menu'] || row['id_menu'] || row['ID'] || row['id'] || ''
          ).trim();

          if (!menuNamaRaw && !menuIdRaw) return;

          // Match menu in catalog
          let targetMenu = currentMenuItems.find(m => menuIdRaw && m.id.toLowerCase() === menuIdRaw.toLowerCase());
          if (!targetMenu && menuNamaRaw) {
            const cleanNama = menuNamaRaw.toLowerCase();
            // 1. Exact name match
            targetMenu = currentMenuItems.find(m => m.nama.toLowerCase().trim() === cleanNama);
            // 2. Contains name or partial match
            if (!targetMenu) {
              targetMenu = currentMenuItems.find(m => {
                const itemClean = m.nama.toLowerCase().trim();
                return itemClean.includes(cleanNama) || cleanNama.includes(itemClean);
              });
            }
          }

          // If menu not found, auto-create menu item so user never loses their data
          if (!targetMenu && menuNamaRaw) {
            targetMenu = {
              id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              nama: menuNamaRaw,
              kategori: 'Minuman',
              hargaJual: 18000,
              hpp: 6000,
              defaultJatah: 0
            };
            currentMenuItems.push(targetMenu);
            hasNewMenus = true;
          }

          if (!targetMenu) return;

          // Lookup Porsi Terjual
          const terjualRaw = row['Porsi Terjual'] ?? row['porsi_terjual'] ?? row['PORSI TERJUAL'] ?? 
                             row['Terjual (Porsi)'] ?? row['Terjual'] ?? row['terjual'] ?? 
                             row['Porsi'] ?? row['porsi'] ?? row['Qty'] ?? row['qty'] ?? 
                             row['Jumlah'] ?? row['jumlah'] ?? row['Sales'] ?? row['sales'] ?? 0;
          
          const cleanTerjualStr = String(terjualRaw).replace(/[^\d.-]/g, '');
          const terjualVal = Math.max(0, parseFloat(cleanTerjualStr) || 0);

          // Lookup Jatah Barista if exists
          const jatahRaw = row['Jatah Barista (Porsi)'] ?? row['Jatah Barista'] ?? 
                           row['Jatah'] ?? row['jatah'] ?? undefined;
          let jatahVal: number | undefined = undefined;
          if (jatahRaw !== undefined && String(jatahRaw).trim() !== '') {
            jatahVal = Math.max(0, parseFloat(String(jatahRaw).replace(/[^\d.-]/g, '')) || 0);
          }

          const notesVal = String(
            row['Catatan Harian'] ?? row['Catatan'] ?? row['catatan'] ?? row['Notes'] ?? ''
          ).trim();

          if (!recordsByDate[dateStr]) {
            recordsByDate[dateStr] = {
              notes: notesVal,
              itemInputs: {}
            };
          } else if (notesVal && !recordsByDate[dateStr].notes) {
            recordsByDate[dateStr].notes = notesVal;
          }

          recordsByDate[dateStr].itemInputs[targetMenu.id] = {
            jatah: jatahVal,
            terjual: terjualVal
          };
          totalParsedRows++;
        });

        const datesImported = Object.keys(recordsByDate);
        if (datesImported.length === 0 || totalParsedRows === 0) {
          alert('Tidak ada data menu yang valid berhasil ditemukan dari file Excel. Pastikan kolom tabel berisi: Tanggal, Nama Menu, Porsi Terjual.');
          return;
        }

        // If new menus were detected, update state and local storage
        if (hasNewMenus) {
          setMenuItems(currentMenuItems);
          localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(currentMenuItems));
        }

        let updatedSalesList = [...dailySales];
        let lastImportedDate = selectedDate;
        let grandTotalCups = 0;
        let grandTotalOmset = 0;

        datesImported.forEach(tgl => {
          lastImportedDate = tgl;
          const { notes, itemInputs } = recordsByDate[tgl];
          const existingIdx = updatedSalesList.findIndex(d => normalizeDateString(d.tanggal) === tgl || d.tanggal === tgl);
          const existingRecord = existingIdx >= 0 ? updatedSalesList[existingIdx] : null;

          const menuSalesList: DailyMenuItemSale[] = currentMenuItems.map(item => {
            const uploadedInput = itemInputs[item.id];
            const existingMenuSale = existingRecord?.menuSales?.find(ms => ms.menuId === item.id || ms.nama?.toLowerCase().trim() === item.nama.toLowerCase().trim());
            
            // Jatah: keep uploaded jatah if provided, else keep existing recorded jatah, else defaultJatah
            let jatah = item.defaultJatah || 0;
            if (uploadedInput?.jatah !== undefined) {
              jatah = uploadedInput.jatah;
            } else if (existingMenuSale && typeof existingMenuSale.jatah === 'number') {
              jatah = existingMenuSale.jatah;
            }

            // Terjual: if provided in excel, use it. Otherwise keep existing if this menu wasn't in upload, or 0
            let terjual = 0;
            if (uploadedInput !== undefined) {
              terjual = uploadedInput.terjual;
            } else if (existingMenuSale && typeof existingMenuSale.terjual === 'number') {
              terjual = existingMenuSale.terjual;
            }

            return {
              menuId: item.id,
              nama: item.nama,
              kategori: item.kategori,
              hargaJual: item.hargaJual,
              hpp: item.hpp,
              jatah,
              terjual
            };
          });

          const totalCups = menuSalesList.reduce((s, ms) => s + (ms.terjual || 0), 0);
          const totalOmset = menuSalesList.reduce((s, ms) => s + ((ms.terjual || 0) * (ms.hargaJual || 0)), 0);
          const totalHpp = menuSalesList.reduce((s, ms) => s + (((ms.terjual || 0) + (ms.jatah || 0)) * (ms.hpp || 0)), 0);

          grandTotalCups += totalCups;
          grandTotalOmset += totalOmset;

          const newRecord: DailySalesRecord = {
            id: existingRecord ? existingRecord.id : `ds-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            tanggal: tgl,
            cups: totalCups,
            omset: totalOmset,
            hppTotal: totalHpp,
            notes: notes || existingRecord?.notes || '',
            menuSales: menuSalesList
          };

          if (existingIdx >= 0) {
            updatedSalesList[existingIdx] = newRecord;
          } else {
            updatedSalesList.push(newRecord);
          }
        });

        updatedSalesList.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        setDailySales(updatedSalesList);
        localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(updatedSalesList));

        // Update form state with the latest imported date
        setSelectedDate(lastImportedDate);
        const latestImported = recordsByDate[lastImportedDate];
        if (latestImported) {
          setItemizedInputs(prev => {
            const next = { ...prev };
            currentMenuItems.forEach(item => {
              const inp = latestImported.itemInputs[item.id];
              if (inp !== undefined) {
                next[item.id] = {
                  jatah: inp.jatah !== undefined ? inp.jatah : (next[item.id]?.jatah ?? item.defaultJatah ?? 0),
                  terjual: inp.terjual
                };
              }
            });
            return next;
          });
          if (latestImported.notes) {
            setDailyNotes(latestImported.notes);
          }
        }

        // Trigger Google Sheets sync if connected
        if (spreadsheetId && token) {
          syncDataToCloud(currentMenuItems, updatedSalesList);
        }

        alert(`✅ Impor Excel Penjualan Berhasil!\n\n` +
          `Data penjualan harian menu otomatis terinput ke aplikasi:\n` +
          `• Tanggal: ${datesImported.join(', ')}\n` +
          `• Menu Terdata: ${totalParsedRows} baris menu\n` +
          `• Total Porsi Terjual: ${grandTotalCups.toLocaleString('id-ID')} Porsi\n` +
          `• Total Omset Terhitung: Rp ${grandTotalOmset.toLocaleString('id-ID')}\n\n` +
          `Form input harian dan rekap historis penjualan menu telah diperbarui secara otomatis.`);

      } catch (err) {
        console.error('Error importing Excel:', err);
        alert('Gagal memproses file Excel. Pastikan format file .xlsx / .xls / .csv valid dengan kolom: Tanggal, Nama Menu, Porsi Terjual.');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = ''; // reset file input
  };

  // Menu Catalog Modal / Form State
  const [showAddMenuModal, setShowAddMenuModal] = useState<boolean>(false);
  const [newMenuNama, setNewMenuNama] = useState<string>('');
  const [newMenuKategori, setNewMenuKategori] = useState<'Minuman' | 'Makanan' | 'Snack'>('Minuman');
  const [newMenuHarga, setNewMenuHarga] = useState<string>('20000');
  const [newMenuHpp, setNewMenuHpp] = useState<string>('0');
  const [newMenuJatah, setNewMenuJatah] = useState<string>('0');
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);

  // Draft Recipe Composition for New/Edited Menu Form
  const [newMenuRecipe, setNewMenuRecipe] = useState<MenuRecipeIngredient[]>([]);
  const [formRecipeIngId, setFormRecipeIngId] = useState<string>('');
  const [formRecipeTakaran, setFormRecipeTakaran] = useState<string>('18');

  // Recipe Ingredient Form State
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [newIngNama, setNewIngNama] = useState<string>('');
  const [newIngHarga, setNewIngHarga] = useState<string>('');
  const [newIngIsiBeli, setNewIngIsiBeli] = useState<string>('1000');
  const [newIngSatuanBeliUnit, setNewIngSatuanBeliUnit] = useState<string>('gram');
  const [newIngTakaran, setNewIngTakaran] = useState<string>('');
  const [newIngSatuanTakaranUnit, setNewIngSatuanTakaranUnit] = useState<string>('gram');

  // Menu Recipe Editor state
  const [expandedRecipeMenuId, setExpandedRecipeMenuId] = useState<string | null>(null);
  const [recipeFormIngId, setRecipeFormIngId] = useState<string>('');
  const [recipeFormTakaran, setRecipeFormTakaran] = useState<string>('18');

  // Expanded row in history table
  const [expandedDailyId, setExpandedDailyId] = useState<string | null>(null);

  // Historic Table Filter & Search State
  const [historicSearchQuery, setHistoricSearchQuery] = useState<string>('');
  const [historicSelectedMonth, setHistoricSelectedMonth] = useState<string>('ALL');

  // Main Omset & Financial Overview Month Filter State
  const [selectedOmsetMonth, setSelectedOmsetMonth] = useState<string>('ALL');

  // Available Months (YYYY-MM) from both dailySales & incomingBatches
  const availableMonths = useMemo(() => {
    const setMonths = new Set<string>();
    dailySales.forEach(rec => {
      if (rec.tanggal && rec.tanggal.length >= 7) {
        setMonths.add(rec.tanggal.slice(0, 7));
      }
    });
    incomingBatches.forEach(b => {
      if (b.tanggal && b.tanggal.length >= 7) {
        setMonths.add(b.tanggal.slice(0, 7));
      }
    });
    return Array.from(setMonths).sort((a, b) => b.localeCompare(a));
  }, [dailySales, incomingBatches]);

  const formatMonthLabel = (ymStr: string) => {
    if (ymStr === 'ALL') return 'Semua Bulan';
    const [year, month] = ymStr.split('-');
    const monthsIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const mIndex = parseInt(month, 10) - 1;
    if (mIndex >= 0 && mIndex < 12) {
      return `${monthsIndo[mIndex]} ${year}`;
    }
    return ymStr;
  };

  // Filtered Daily Sales for Historic Table
  const filteredDailySales = useMemo(() => {
    return dailySales.filter(rec => {
      // Month Filter
      if (historicSelectedMonth !== 'ALL') {
        if (!rec.tanggal.startsWith(historicSelectedMonth)) {
          return false;
        }
      }
      // Search Query Filter
      if (historicSearchQuery.trim() !== '') {
        const q = historicSearchQuery.toLowerCase().trim();
        const formattedDate = formatDateDDMMYYYY(rec.tanggal);
        const matchesDate = rec.tanggal.toLowerCase().includes(q) || formattedDate.includes(q);
        const matchesNotes = rec.notes ? rec.notes.toLowerCase().includes(q) : false;
        const matchesMenu = rec.menuSales ? rec.menuSales.some(ms => (ms.nama || '').toLowerCase().includes(q) || ((ms as any).kategori || '').toLowerCase().includes(q)) : false;
        return matchesDate || matchesNotes || matchesMenu;
      }
      return true;
    });
  }, [dailySales, historicSelectedMonth, historicSearchQuery]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_page_biaya', JSON.stringify(biayaList));
  }, [biayaList]);

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(dailySales));
  }, [dailySales]);

  useEffect(() => {
    localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(ingredients));
  }, [ingredients]);

  // Sync default itemized inputs whenever menuItems or selectedDate changes
  useEffect(() => {
    const normSelected = normalizeDateString(selectedDate);
    const existingRecord = dailySales.find(d => normalizeDateString(d.tanggal) === normSelected);
    const initialMap: Record<string, { jatah: number; terjual: number }> = {};

    menuItems.forEach(item => {
      let jatahVal = item.defaultJatah;
      let terjualVal = 0;

      if (existingRecord && existingRecord.menuSales) {
        const itemNamaLower = (item.nama || '').trim().toLowerCase();
        const aliasSet = new Set(
          [itemNamaLower, ...(Array.isArray(item.aliases) ? item.aliases.map(a => a.trim().toLowerCase()) : [])].filter(Boolean)
        );
        const found = existingRecord.menuSales.find(ms => 
          ms.menuId === item.id || 
          (ms.nama && aliasSet.has(ms.nama.trim().toLowerCase()))
        );
        if (found) {
          jatahVal = typeof found.jatah === 'number' ? found.jatah : item.defaultJatah;
          terjualVal = typeof found.terjual === 'number' ? found.terjual : 0;
        }
      }

      initialMap[item.id] = { jatah: jatahVal, terjual: terjualVal };
    });

    setItemizedInputs(initialMap);

    if (existingRecord) {
      setDailyNotes(existingRecord.notes || '');
      setQuickCups(existingRecord.cups.toString());
      setQuickOmset(existingRecord.omset.toString());
      if (existingRecord.menuSales && existingRecord.menuSales.length > 0) {
        const totJatah = existingRecord.menuSales.reduce((s, ms) => s + (ms.jatah || 0), 0);
        setQuickJatah(totJatah.toString());
      } else {
        setQuickJatah('0');
      }
    } else {
      setDailyNotes('');
      const defaultTotalJatah = menuItems.reduce((s, m) => s + (m.defaultJatah || 0), 0);
      setQuickJatah(defaultTotalJatah.toString());
    }
  }, [selectedDate, menuItems, dailySales]);

  // Weighted Average Calculation from Catalog
  const weightedAvgPrices = useMemo(() => {
    if (menuItems.length === 0) return { avgHarga: 19000, avgHpp: 9018 };
    const totalJatahSum = menuItems.reduce((s, m) => s + (m.defaultJatah || 1), 0);
    const weightedHarga = menuItems.reduce((s, m) => s + (m.hargaJual * (m.defaultJatah || 1)), 0) / totalJatahSum;
    const weightedHpp = menuItems.reduce((s, m) => s + (m.hpp * (m.defaultJatah || 1)), 0) / totalJatahSum;
    return {
      avgHarga: Math.round(weightedHarga),
      avgHpp: Math.round(weightedHpp)
    };
  }, [menuItems]);

  // Calculated COGS from Ingredients Recipe Calculator
  const calculatedRecipeHpp = useMemo(() => {
    return ingredients.reduce((sum, ing) => {
      return sum + calculateIngredientCostForCup(ing);
    }, 0);
  }, [ingredients]);

  // Sync weighted average to master parameters
  const applyWeightedAverageToMaster = () => {
    setHargaPerCup(weightedAvgPrices.avgHarga);
    setHppPerCup(weightedAvgPrices.avgHpp);
    alert(`Parameter Master diperbarui: Avg Harga Jual Rp ${weightedAvgPrices.avgHarga.toLocaleString('id-ID')} & Avg HPP Rp ${weightedAvgPrices.avgHpp.toLocaleString('id-ID')}`);
  };

  const applyRecipeHppToMaster = () => {
    setHppPerCup(Math.round(calculatedRecipeHpp));
    alert(`HPP Per Cup Master diperbarui dari hasil Kalkulator Resep: Rp ${Math.round(calculatedRecipeHpp).toLocaleString('id-ID')}`);
  };

  const applyCategoryRecipesToMenuItems = (targetCat?: 'Minuman' | 'Makanan' | 'Snack' | 'ALL') => {
    const filterCat = targetCat || cogsCategoryFilter;
    let updatedCount = 0;
    setMenuItems(prev => prev.map(item => {
      if (filterCat === 'ALL' || item.kategori === filterCat) {
        const recipeHpp = calculateMenuItemHppFromRecipe(item, ingredients);
        if (recipeHpp > 0) {
          updatedCount++;
          return { ...item, hpp: Math.round(recipeHpp) };
        }
      }
      return item;
    }));
    
    const catLabel = filterCat === 'ALL' ? 'Semua Menu' : filterCat;
    alert(`Berhasil memperbarui HPP untuk ${updatedCount} menu ${catLabel} berdasarkan kalkulasi resep bahan baku!`);
  };

  // Calculations for current itemized entry form
  const itemizedCalculations = useMemo(() => {
    let totalCups = 0;
    let totalJatah = 0;
    let totalOmset = 0;
    let totalHpp = 0;

    menuItems.forEach(item => {
      const input = itemizedInputs[item.id] || { jatah: item.defaultJatah, terjual: 0 };
      totalCups += input.terjual;
      totalJatah += input.jatah;
      totalOmset += input.terjual * item.hargaJual;
      // HPP Harian adalah total jumlah dari jatah barista dan penjualan
      totalHpp += (input.terjual + input.jatah) * item.hpp;
    });

    const grossProfit = totalOmset - totalHpp;
    const fulfillmentPct = totalJatah > 0 ? (totalCups / totalJatah) * 100 : 0;

    return {
      totalCups,
      totalJatah,
      totalOmset,
      totalHpp,
      grossProfit,
      fulfillmentPct
    };
  }, [menuItems, itemizedInputs]);

  // Active Comparison Data Metrics for Daily Sales vs Total HPP & Gross Margin %
  const activeCompData = useMemo(() => {
    if (selectedComparisonDailyDate === 'LIVE_FORM') {
      const omset = itemizedCalculations.totalOmset;
      const hpp = itemizedCalculations.totalHpp;
      const grossProfit = itemizedCalculations.grossProfit;
      const cups = itemizedCalculations.totalCups;
      const marginPct = omset > 0 ? (grossProfit / omset) * 100 : 0;
      const cogsRatioPct = omset > 0 ? (hpp / omset) * 100 : 0;
      return {
        label: `Data Draft Form Input (${formatDateDDMMYYYY(selectedDate)})`,
        omset,
        hpp,
        grossProfit,
        cups,
        marginPct,
        cogsRatioPct
      };
    }

    if (selectedComparisonDailyDate === 'AVERAGE_ALL') {
      const totalOmset = filteredDailySales.reduce((acc, d) => acc + d.omset, 0);
      const totalHpp = filteredDailySales.reduce((acc, d) => acc + (d.hppTotal || (d.cups * hppPerCup)), 0);
      const totalCups = filteredDailySales.reduce((acc, d) => acc + d.cups, 0);
      const count = filteredDailySales.length || 1;

      const omset = totalOmset / count;
      const hpp = totalHpp / count;
      const grossProfit = omset - hpp;
      const cups = Math.round(totalCups / count);
      const marginPct = omset > 0 ? (grossProfit / omset) * 100 : 0;
      const cogsRatioPct = omset > 0 ? (hpp / omset) * 100 : 0;

      return {
        label: `Rata-Rata Harian (${filteredDailySales.length} Hari Transaksi)`,
        omset,
        hpp,
        grossProfit,
        cups,
        marginPct,
        cogsRatioPct
      };
    }

    const rec = dailySales.find(d => d.tanggal === selectedComparisonDailyDate);
    if (rec) {
      const omset = rec.omset;
      const hpp = rec.hppTotal || (rec.cups * hppPerCup);
      const grossProfit = omset - hpp;
      const cups = rec.cups;
      const marginPct = omset > 0 ? (grossProfit / omset) * 100 : 0;
      const cogsRatioPct = omset > 0 ? (hpp / omset) * 100 : 0;
      return {
        label: `Transaksi Harian (${formatDateDDMMYYYY(rec.tanggal)})`,
        omset,
        hpp,
        grossProfit,
        cups,
        marginPct,
        cogsRatioPct
      };
    }

    return {
      label: 'Belum Ada Data Selected',
      omset: 0,
      hpp: 0,
      grossProfit: 0,
      cups: 0,
      marginPct: 0,
      cogsRatioPct: 0
    };
  }, [selectedComparisonDailyDate, itemizedCalculations, selectedDate, filteredDailySales, dailySales, hppPerCup]);

  // Sorted list for Comparison Table
  const sortedDailyComparisonList = useMemo(() => {
    const list = [...filteredDailySales];
    list.sort((a, b) => {
      const hppA = a.hppTotal || (a.cups * hppPerCup);
      const gpA = a.omset - hppA;
      const marginA = a.omset > 0 ? (gpA / a.omset) * 100 : 0;

      const hppB = b.hppTotal || (b.cups * hppPerCup);
      const gpB = b.omset - hppB;
      const marginB = b.omset > 0 ? (gpB / b.omset) * 100 : 0;

      switch (comparisonDailySortMode) {
        case 'sales_desc':
          return b.omset - a.omset;
        case 'hpp_desc':
          return hppB - hppA;
        case 'profit_desc':
          return gpB - gpA;
        case 'margin_desc':
          return marginB - marginA;
        case 'date_desc':
        default:
          return (b.tanggal || '').localeCompare(a.tanggal || '');
      }
    });
    return list;
  }, [filteredDailySales, hppPerCup, comparisonDailySortMode]);

  // Filtered Daily Sales for Omset & Financial Overview
  const filteredSalesForOmset = useMemo(() => {
    if (selectedOmsetMonth === 'ALL') return dailySales;
    return dailySales.filter(rec => rec.tanggal && rec.tanggal.startsWith(selectedOmsetMonth));
  }, [dailySales, selectedOmsetMonth]);

  // Comprehensive Menu Best-Seller Ranking & Aggregated Sales Data (terbanyak -> terbawah)
  const menuBestSellerList = useMemo(() => {
    const salesByMenuId = new Map<string, { terjual: number; jatah: number; omset: number; hpp: number }>();

    menuItems.forEach(m => {
      salesByMenuId.set(m.id, { terjual: 0, jatah: 0, omset: 0, hpp: 0 });
    });

    let grandTotalCups = 0;
    let grandTotalOmset = 0;
    let grandTotalHpp = 0;

    filteredSalesForOmset.forEach(rec => {
      if (rec.menuSales && rec.menuSales.length > 0) {
        rec.menuSales.forEach(ms => {
          const matchMenu = menuItems.find(m => m.id === ms.menuId || m.nama.trim().toLowerCase() === ms.nama?.trim().toLowerCase());
          const targetId = matchMenu ? matchMenu.id : (ms.menuId || ms.nama);

          const qtyTerjual = ms.terjual || 0;
          const qtyJatah = ms.jatah || 0;
          const harga = ms.hargaJual || matchMenu?.hargaJual || 0;
          const hpp = ms.hpp || matchMenu?.hpp || 0;

          const current = salesByMenuId.get(targetId) || { terjual: 0, jatah: 0, omset: 0, hpp: 0 };
          current.terjual += qtyTerjual;
          current.jatah += qtyJatah;
          current.omset += qtyTerjual * harga;
          current.hpp += (qtyTerjual + qtyJatah) * hpp;

          salesByMenuId.set(targetId, current);

          grandTotalCups += qtyTerjual;
          grandTotalOmset += qtyTerjual * harga;
          grandTotalHpp += (qtyTerjual + qtyJatah) * hpp;
        });
      }
    });

    const rankedList = menuItems.map(m => {
      const stats = salesByMenuId.get(m.id) || { terjual: 0, jatah: 0, omset: 0, hpp: 0 };
      const grossProfit = stats.omset - stats.hpp;
      const sharePct = grandTotalCups > 0 ? (stats.terjual / grandTotalCups) * 100 : 0;

      return {
        ...m,
        totalTerjual: stats.terjual,
        totalJatah: stats.jatah,
        totalOmset: stats.omset,
        totalHpp: stats.hpp,
        grossProfit,
        sharePct
      };
    });

    // Sort according to menuSortMode (default: bestseller_qty -> terbanyak porsi terjual ke terbawah)
    rankedList.sort((a, b) => {
      if (menuSortMode === 'bestseller_omset') {
        if (b.totalOmset !== a.totalOmset) return b.totalOmset - a.totalOmset;
        return b.totalTerjual - a.totalTerjual;
      } else if (menuSortMode === 'bestseller_profit') {
        if (b.grossProfit !== a.grossProfit) return b.grossProfit - a.grossProfit;
        return b.totalTerjual - a.totalTerjual;
      } else if (menuSortMode === 'alphabetical') {
        const cmp = compareMenuNamesAsc(a.nama, b.nama);
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
      } else {
        // Default: bestseller_qty (Terbanyak porsi terjual -> terbawah)
        if (b.totalTerjual !== a.totalTerjual) {
          return b.totalTerjual - a.totalTerjual;
        }
        return b.totalOmset - a.totalOmset;
      }
    });

    return {
      rankedList,
      grandTotalCups,
      grandTotalOmset,
      grandTotalHpp,
      grandTotalGrossProfit: grandTotalOmset - grandTotalHpp
    };
  }, [menuItems, filteredSalesForOmset, menuSortMode]);

  // Sorted menu catalog for tables (uses best-seller ranking order)
  const sortedMenuItems = useMemo(() => {
    return menuBestSellerList.rankedList;
  }, [menuBestSellerList]);

  const cogsFilteredMenuItems = useMemo(() => {
    if (cogsCategoryFilter === 'ALL') return sortedMenuItems;
    return sortedMenuItems.filter(m => m.kategori === cogsCategoryFilter);
  }, [sortedMenuItems, cogsCategoryFilter]);

  const catalogFilteredMenuItems = useMemo(() => {
    const list = catalogCategoryFilter === 'ALL'
      ? [...menuItems]
      : menuItems.filter(m => m.kategori === catalogCategoryFilter);

    return list.sort((a, b) => {
      if (catalogSortOption === 'nama_asc') {
        return compareMenuNamesAsc(a.nama, b.nama) || a.id.localeCompare(b.id);
      }
      if (catalogSortOption === 'nama_desc') {
        return compareMenuNamesAsc(b.nama, a.nama) || b.id.localeCompare(a.id);
      }

      const hppA = calculateMenuItemHppFromRecipe(a, ingredients) || a.hpp;
      const hppB = calculateMenuItemHppFromRecipe(b, ingredients) || b.hpp;
      const marginA = a.hargaJual - hppA;
      const marginB = b.hargaJual - hppB;
      const marginPctA = a.hargaJual > 0 ? (marginA / a.hargaJual) * 100 : 0;
      const marginPctB = b.hargaJual > 0 ? (marginB / b.hargaJual) * 100 : 0;

      switch (catalogSortOption) {
        case 'margin_desc':
          return (marginB - marginA) || compareMenuNamesAsc(a.nama, b.nama);
        case 'margin_asc':
          return (marginA - marginB) || compareMenuNamesAsc(a.nama, b.nama);
        case 'margin_pct_desc':
          return (marginPctB - marginPctA) || compareMenuNamesAsc(a.nama, b.nama);
        case 'margin_pct_asc':
          return (marginPctA - marginPctB) || compareMenuNamesAsc(a.nama, b.nama);
        case 'harga_desc':
          return (b.hargaJual - a.hargaJual) || compareMenuNamesAsc(a.nama, b.nama);
        case 'harga_asc':
          return (a.hargaJual - b.hargaJual) || compareMenuNamesAsc(a.nama, b.nama);
        case 'hpp_desc':
          return (hppB - hppA) || compareMenuNamesAsc(a.nama, b.nama);
        case 'hpp_asc':
          return (hppA - hppB) || compareMenuNamesAsc(a.nama, b.nama);
        default:
          return compareMenuNamesAsc(a.nama, b.nama) || a.id.localeCompare(b.id);
      }
    });
  }, [menuItems, catalogCategoryFilter, catalogSortOption, ingredients]);

  // Overall Monthly Accumulations (filtered by selected month)
  const totalDailyCups = useMemo(() => {
    return filteredSalesForOmset.reduce((sum, item) => sum + item.cups, 0);
  }, [filteredSalesForOmset]);

  const totalDailyRevenue = useMemo(() => {
    return filteredSalesForOmset.reduce((sum, item) => sum + item.omset, 0);
  }, [filteredSalesForOmset]);

  const totalDailyHppCalculated = useMemo(() => {
    return filteredSalesForOmset.reduce((sum, item) => sum + (item.hppTotal || (item.cups * hppPerCup)), 0);
  }, [filteredSalesForOmset, hppPerCup]);

  // Active Omset
  const omsetBulanan = useMemo(() => {
    return useDailySalesAccumulation ? totalDailyRevenue : manualOmsetBulanan;
  }, [useDailySalesAccumulation, totalDailyRevenue, manualOmsetBulanan]);

  // Total Biaya Bulanan
  const totalGaji = useMemo(() => {
    return biayaList.filter(b => b.kategori === 'Gaji').reduce((sum, item) => sum + item.jumlah, 0);
  }, [biayaList]);

  const totalSewaUtilitas = useMemo(() => {
    return biayaList.filter(b => b.kategori === 'Sewa & Utilitas').reduce((sum, item) => sum + item.jumlah, 0);
  }, [biayaList]);

  const totalBiayaBulanan = useMemo(() => {
    return totalGaji + totalSewaUtilitas;
  }, [totalGaji, totalSewaUtilitas]);

  // Analytical Calculation Engine for Ingredient Usage (Penjualan vs Jatah Barista)
  const ingredientUsageReport = useMemo(() => {
    // 1. Determine relevant daily records
    let recordsToProcess: {
      tanggal: string;
      menuSales: DailyMenuItemSale[];
    }[] = [];

    if (ingredientFilterTimeframe === 'harian') {
      const normTargetDate = normalizeDateString(ingredientSelectedDate) || ingredientSelectedDate;
      const existingRec = dailySales.find(d => normalizeDateString(d.tanggal) === normTargetDate);

      let currentMenuSales: DailyMenuItemSale[] = [];
      if (existingRec && existingRec.menuSales && existingRec.menuSales.length > 0) {
        currentMenuSales = existingRec.menuSales;
      } else if (normTargetDate === (normalizeDateString(selectedDate) || selectedDate)) {
        currentMenuSales = menuItems.map(m => {
          const input = itemizedInputs[m.id] || { jatah: m.defaultJatah, terjual: 0 };
          return {
            menuId: m.id,
            nama: m.nama,
            kategori: m.kategori,
            hargaJual: m.hargaJual,
            hpp: m.hpp,
            jatah: input.jatah,
            terjual: input.terjual
          };
        });
      }

      recordsToProcess = [{
        tanggal: normTargetDate,
        menuSales: currentMenuSales
      }];
    } else {
      // Bulanan Mode
      const filteredRecs = dailySales.filter(d => {
        if (ingredientSelectedMonth === 'ALL') return true;
        return d.tanggal.startsWith(ingredientSelectedMonth);
      });

      recordsToProcess = filteredRecs.map(d => ({
        tanggal: d.tanggal,
        menuSales: d.menuSales || []
      }));
    }

    // 2. Map of Ingredient ID -> Aggregated Stats
    const ingredientMap = new Map<string, {
      ingredient: RecipeIngredient;
      usageSales: number;
      usageJatah: number;
      totalUsage: number;
      cupsSales: number;
      cupsJatah: number;
      costSales: number;
      costJatah: number;
      totalCost: number;
      menuBreakdown: Map<string, {
        menuId: string;
        menuNama: string;
        kategori: string;
        terjual: number;
        jatah: number;
        takaranPerCup: number;
        usageSales: number;
        usageJatah: number;
        totalUsage: number;
        costSales: number;
        costJatah: number;
        totalCost: number;
      }>;
    }>();

    ingredients.forEach(ing => {
      ingredientMap.set(ing.id, {
        ingredient: ing,
        usageSales: 0,
        usageJatah: 0,
        totalUsage: 0,
        cupsSales: 0,
        cupsJatah: 0,
        costSales: 0,
        costJatah: 0,
        totalCost: 0,
        menuBreakdown: new Map()
      });
    });

    recordsToProcess.forEach(rec => {
      rec.menuSales.forEach(ms => {
        const terjual = ms.terjual || 0;
        const jatah = ms.jatah || 0;
        if (terjual === 0 && jatah === 0) return;

        const menu = menuItems.find(m => m.id === ms.menuId || (m.nama || '').trim().toLowerCase() === (ms.nama || '').trim().toLowerCase());
        const recipeList = menu?.recipe || [];

        recipeList.forEach(r => {
          const ingData = ingredientMap.get(r.ingredientId);
          if (!ingData) return;

          const ing = ingData.ingredient;
          const takaran = r.takaran || 0;
          const uSales = terjual * takaran;
          const uJatah = jatah * takaran;
          const cSales = calculateRecipeItemCost(ing, uSales);
          const cJatah = calculateRecipeItemCost(ing, uJatah);

          ingData.usageSales += uSales;
          ingData.usageJatah += uJatah;
          ingData.totalUsage += (uSales + uJatah);
          ingData.cupsSales += terjual;
          ingData.cupsJatah += jatah;
          ingData.costSales += cSales;
          ingData.costJatah += cJatah;
          ingData.totalCost += (cSales + cJatah);

          const menuKey = menu ? menu.id : (ms.menuId || ms.nama || 'unknown');
          const existingMB = ingData.menuBreakdown.get(menuKey) || {
            menuId: menuKey,
            menuNama: ms.nama || menu?.nama || 'Unknown Menu',
            kategori: ms.kategori || menu?.kategori || 'Minuman',
            terjual: 0,
            jatah: 0,
            takaranPerCup: takaran,
            usageSales: 0,
            usageJatah: 0,
            totalUsage: 0,
            costSales: 0,
            costJatah: 0,
            totalCost: 0
          };

          existingMB.terjual += terjual;
          existingMB.jatah += jatah;
          existingMB.usageSales += uSales;
          existingMB.usageJatah += uJatah;
          existingMB.totalUsage += (uSales + uJatah);
          existingMB.costSales += cSales;
          existingMB.costJatah += cJatah;
          existingMB.totalCost += (cSales + cJatah);

          ingData.menuBreakdown.set(menuKey, existingMB);
        });
      });
    });

    const ingredientList = Array.from(ingredientMap.values());

    const totalCostSales = ingredientList.reduce((sum, item) => sum + item.costSales, 0);
    const totalCostJatah = ingredientList.reduce((sum, item) => sum + item.costJatah, 0);
    const totalOverallCost = totalCostSales + totalCostJatah;
    const activeIngredientsCount = ingredientList.filter(item => item.totalUsage > 0).length;

    // Menu-centric aggregation
    const menuCentricMap = new Map<string, {
      menuId: string;
      menuNama: string;
      kategori: string;
      hargaJual: number;
      terjual: number;
      jatah: number;
      ingredientsUsed: {
        ingredientId: string;
        ingredientNama: string;
        satuanTakaran: string;
        takaranPerCup: number;
        totalUsageSales: number;
        totalUsageJatah: number;
        totalUsageAll: number;
        costSales: number;
        costJatah: number;
        totalCost: number;
      }[];
      costSales: number;
      costJatah: number;
      totalCost: number;
    }>();

    recordsToProcess.forEach(rec => {
      rec.menuSales.forEach(ms => {
        const terjual = ms.terjual || 0;
        const jatah = ms.jatah || 0;
        if (terjual === 0 && jatah === 0) return;

        const menu = menuItems.find(m => m.id === ms.menuId || (m.nama || '').trim().toLowerCase() === (ms.nama || '').trim().toLowerCase());
        const menuKey = menu ? menu.id : (ms.menuId || ms.nama || 'unknown');
        const recipeList = menu?.recipe || [];

        let menuData = menuCentricMap.get(menuKey);
        if (!menuData) {
          menuData = {
            menuId: menuKey,
            menuNama: ms.nama || menu?.nama || 'Unknown Menu',
            kategori: ms.kategori || menu?.kategori || 'Minuman',
            hargaJual: ms.hargaJual || menu?.hargaJual || 0,
            terjual: 0,
            jatah: 0,
            ingredientsUsed: [],
            costSales: 0,
            costJatah: 0,
            totalCost: 0
          };
          menuCentricMap.set(menuKey, menuData);
        }

        menuData.terjual += terjual;
        menuData.jatah += jatah;

        recipeList.forEach(r => {
          const ing = ingredients.find(i => i.id === r.ingredientId);
          if (!ing) return;

          const takaran = r.takaran || 0;
          const uSales = terjual * takaran;
          const uJatah = jatah * takaran;
          const cSales = calculateRecipeItemCost(ing, uSales);
          const cJatah = calculateRecipeItemCost(ing, uJatah);

          let existingIngUsed = menuData!.ingredientsUsed.find(i => i.ingredientId === ing.id);
          if (!existingIngUsed) {
            existingIngUsed = {
              ingredientId: ing.id,
              ingredientNama: ing.namaBahan,
              satuanTakaran: ing.satuanTakaran,
              takaranPerCup: takaran,
              totalUsageSales: 0,
              totalUsageJatah: 0,
              totalUsageAll: 0,
              costSales: 0,
              costJatah: 0,
              totalCost: 0
            };
            menuData!.ingredientsUsed.push(existingIngUsed);
          }

          existingIngUsed.totalUsageSales += uSales;
          existingIngUsed.totalUsageJatah += uJatah;
          existingIngUsed.totalUsageAll += (uSales + uJatah);
          existingIngUsed.costSales += cSales;
          existingIngUsed.costJatah += cJatah;
          existingIngUsed.totalCost += (cSales + cJatah);

          menuData!.costSales += cSales;
          menuData!.costJatah += cJatah;
          menuData!.totalCost += (cSales + cJatah);
        });
      });
    });

    const menuList = Array.from(menuCentricMap.values());

    return {
      recordsProcessedCount: recordsToProcess.length,
      ingredientList,
      menuList,
      totalCostSales,
      totalCostJatah,
      totalOverallCost,
      activeIngredientsCount
    };
  }, [
    ingredientFilterTimeframe, 
    ingredientSelectedDate, 
    ingredientSelectedMonth, 
    dailySales, 
    selectedDate, 
    itemizedInputs, 
    menuItems, 
    ingredients
  ]);

  const handleExportIngredientUsageCSV = () => {
    const report = ingredientUsageReport;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Laporan Penggunaan Bahan Baku (Sales & Jatah Barista)\n";
    csvContent += `Periode,${ingredientFilterTimeframe === 'harian' ? ingredientSelectedDate : ingredientSelectedMonth}\n\n`;
    csvContent += "Nama Bahan Baku,Satuan Takaran,Volume Sales,Volume Jatah Barista,Total Volume Terpakai,Cost Sales (Rp),Cost Jatah Barista (Rp),Total Cost (Rp)\n";

    report.ingredientList.forEach(item => {
      const ing = item.ingredient;
      csvContent += `"${ing.namaBahan.replace(/"/g, '""')}","${ing.satuanTakaran}",${item.usageSales},${item.usageJatah},${item.totalUsage},${Math.round(item.costSales)},${Math.round(item.costJatah)},${Math.round(item.totalCost)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_penggunaan_bahan_baku_${ingredientFilterTimeframe}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Product & Margin Parameters
  const marginPerCup = useMemo(() => Math.max(0, hargaPerCup - hppPerCup), [hargaPerCup, hppPerCup]);
  const marginPersentase = useMemo(() => hargaPerCup > 0 ? (marginPerCup / hargaPerCup) : 0, [marginPerCup, hargaPerCup]);
  
  const estimasiPenjualanCups = useMemo(() => {
    return hargaPerCup > 0 ? (omsetBulanan / hargaPerCup) : 0;
  }, [omsetBulanan, hargaPerCup]);

  const totalEstimasiHPP = useMemo(() => {
    return useDailySalesAccumulation ? totalDailyHppCalculated : (estimasiPenjualanCups * hppPerCup);
  }, [useDailySalesAccumulation, totalDailyHppCalculated, estimasiPenjualanCups, hppPerCup]);

  // Laba Rugi
  const grossProfit = useMemo(() => omsetBulanan - totalEstimasiHPP, [omsetBulanan, totalEstimasiHPP]);
  const netProfit = useMemo(() => grossProfit - totalBiayaBulanan, [grossProfit, totalBiayaBulanan]);

  // Save Itemized Daily Entry
  const handleSaveItemizedDaily = async (e: React.FormEvent) => {
    e.preventDefault();

    const menuSalesList: DailyMenuItemSale[] = menuItems.map(item => {
      const input = itemizedInputs[item.id] || { jatah: item.defaultJatah, terjual: 0 };
      return {
        menuId: item.id,
        nama: item.nama,
        kategori: item.kategori,
        hargaJual: item.hargaJual,
        hpp: item.hpp,
        jatah: Number(input.jatah) || 0,
        terjual: Number(input.terjual) || 0
      };
    });

    const cups = itemizedCalculations.totalCups;
    const omset = itemizedCalculations.totalOmset;
    const hppTotal = itemizedCalculations.totalHpp;

    if (cups <= 0 && omset <= 0 && itemizedCalculations.totalJatah <= 0) {
      if (!window.confirm('Jumlah porsi terjual & jatah masih 0. Simpan catatan harian ini?')) {
        return;
      }
    }

    const normSelected = normalizeDateString(selectedDate) || selectedDate;
    localStorage.setItem('aruskas_cogs_selected_date', normSelected);

    const existingIndex = dailySales.findIndex(d => normalizeDateString(d.tanggal) === normSelected);
    const newRecord: DailySalesRecord & { updatedAt?: number } = {
      id: existingIndex >= 0 ? dailySales[existingIndex].id : `ds-${Date.now()}`,
      tanggal: normSelected,
      cups,
      omset,
      hppTotal,
      notes: dailyNotes.trim(),
      menuSales: menuSalesList,
      updatedAt: Date.now()
    };

    let nextDailySales: DailySalesRecord[] = [];
    if (existingIndex >= 0) {
      nextDailySales = [...dailySales];
      nextDailySales[existingIndex] = newRecord;
      setDailySales(nextDailySales);
    } else {
      nextDailySales = [...dailySales, newRecord].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      setDailySales(nextDailySales);
    }

    localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(nextDailySales));
    lastRemoteUpdatedAtRef.current = newRecord.updatedAt || Date.now();
    await pushDailySalesToCloud({
      record: newRecord,
      records: nextDailySales.filter(r => r && r.id !== 'ds-1' && r.id !== 'ds-2' && r.id !== 'ds-3'),
      selectedDate: normSelected,
      immediate: true
    });
    syncDataToCloud(menuItems, nextDailySales, ingredients, biayaList, incomingBatches, normSelected);

    alert(`Data penjualan & jatah menu harian tanggal ${selectedDate} berhasil disimpan dan otomatis tersinkron ke semua perangkat (Owner, Manajer & Barista)!`);
  };

  // AI Menu Margin Analysis Handler
  const runAiMenuMarginAnalysis = async () => {
    setAiMarginAnalysisLoading(true);
    setAiMarginAnalysisError(null);
    try {
      const formattedCatalog = menuItems.map(m => {
        const calcHpp = calculateMenuItemHppFromRecipe(m, ingredients);
        const hppVal = calcHpp > 0 ? calcHpp : m.hpp;
        const marginVal = m.hargaJual - hppVal;
        const marginPct = m.hargaJual > 0 ? (marginVal / m.hargaJual) * 100 : 0;
        return {
          nama: m.nama,
          kategori: m.kategori,
          hargaJual: m.hargaJual,
          hpp: Math.round(hppVal),
          margin: Math.round(marginVal),
          marginPct: Number(marginPct.toFixed(1))
        };
      });

      const res = await fetch('/api/gemini/menu-margin-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuCatalog: formattedCatalog,
          targetMarginPercent: targetIdealMarginPct
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal memproses analisis Gemini.');
      }

      setAiMarginAnalysisText(data.analysis);
    } catch (err: any) {
      console.error('Menu Margin Analysis Error:', err);
      setAiMarginAnalysisError(err.message || 'Terjadi kesalahan saat menghubungi API AI Gemini.');
    } finally {
      setAiMarginAnalysisLoading(false);
    }
  };

  const applyIdealPriceToMenuItem = (menuId: string, idealPrice: number) => {
    setMenuItems(prev => {
      const updatedList = prev.map(m => m.id === menuId ? { ...m, hargaJual: idealPrice } : m);
      localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(updatedList));
      if (spreadsheetId && token) {
        saveMenuCatalogToSheet(spreadsheetId, updatedList, token).catch(e => console.error("Cloud sync error:", e));
      }
      return updatedList;
    });
    alert('Harga Jual Ideal berhasil diterapkan ke katalog menu!');
  };

  const applyAllIdealPrices = (idealPricesMap: Record<string, number>) => {
    let count = 0;
    setMenuItems(prev => {
      const updatedList = prev.map(m => {
        if (idealPricesMap[m.id] && idealPricesMap[m.id] > m.hargaJual) {
          count++;
          return { ...m, hargaJual: idealPricesMap[m.id] };
        }
        return m;
      });
      localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(updatedList));
      if (spreadsheetId && token) {
        saveMenuCatalogToSheet(spreadsheetId, updatedList, token).catch(e => console.error("Cloud sync error:", e));
      }
      return updatedList;
    });
    alert(`Berhasil memperbarui harga jual ideal untuk ${count} menu!`);
  };

  // Save Quick Daily Entry
  const handleSaveQuickDaily = (e: React.FormEvent) => {
    e.preventDefault();
    const cupsNum = parseFloat(quickCups) || 0;
    const jatahNum = parseFloat(quickJatah) || 0;
    const omsetNum = parseFloat(quickOmset) || 0;
    // HPP Harian adalah total jumlah dari jatah barista dan penjualan
    const hppEst = Math.round((cupsNum + jatahNum) * hppPerCup);

    if (!selectedDate || (cupsNum <= 0 && jatahNum <= 0)) return;

    const normSelected = normalizeDateString(selectedDate) || selectedDate;
    const existingIndex = dailySales.findIndex(d => normalizeDateString(d.tanggal) === normSelected);
    const newRecord: DailySalesRecord & { updatedAt?: number } = {
      id: existingIndex >= 0 ? dailySales[existingIndex].id : `ds-${Date.now()}`,
      tanggal: normSelected,
      cups: cupsNum,
      omset: omsetNum,
      hppTotal: hppEst,
      notes: dailyNotes.trim(),
      updatedAt: Date.now()
    };

    let nextDailySales: DailySalesRecord[] = [];
    if (existingIndex >= 0) {
      nextDailySales = [...dailySales];
      nextDailySales[existingIndex] = newRecord;
      setDailySales(nextDailySales);
    } else {
      nextDailySales = [...dailySales, newRecord].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      setDailySales(nextDailySales);
    }

    lastRemoteUpdatedAtRef.current = newRecord.updatedAt || Date.now();
    pushDailySalesToCloud({
      record: newRecord,
      records: nextDailySales.filter(r => r && r.id !== 'ds-1' && r.id !== 'ds-2' && r.id !== 'ds-3'),
      selectedDate: normSelected,
      immediate: true
    }).catch(() => {});

    if (spreadsheetId && token) {
      syncDataToCloud(menuItems, nextDailySales, ingredients, biayaList, incomingBatches, normSelected);
    }

    alert(`Data penjualan harian tanggal ${selectedDate} berhasil diperbarui!`);
  };

  // Menu Catalog Handlers
  const handleAddIngredientToDraftRecipe = () => {
    const takVal = parseFloat(formRecipeTakaran) || 0;
    if (!formRecipeIngId || takVal <= 0) {
      alert('Pilih bahan baku dan masukkan takaran resep yang valid!');
      return;
    }

    setNewMenuRecipe(prev => {
      const idx = prev.findIndex(r => r.ingredientId === formRecipeIngId);
      let updated: MenuRecipeIngredient[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = { ingredientId: formRecipeIngId, takaran: takVal };
      } else {
        updated = [...prev, { ingredientId: formRecipeIngId, takaran: takVal }];
      }

      // Auto calculate new HPP
      const calcHpp = updated.reduce((sum, r) => {
        const ing = ingredients.find(i => i.id === r.ingredientId);
        if (!ing) return sum;
        return sum + calculateRecipeItemCost(ing, r.takaran);
      }, 0);

      setNewMenuHpp(Math.round(calcHpp).toString());
      return updated;
    });

    setFormRecipeIngId('');
    setFormRecipeTakaran('18');
  };

  const handleRemoveIngredientFromDraftRecipe = (indexOrIngId: number | string) => {
    setNewMenuRecipe(prev => {
      let updated: MenuRecipeIngredient[] = [];
      if (typeof indexOrIngId === 'number') {
        updated = prev.filter((_, idx) => idx !== indexOrIngId);
      } else {
        updated = prev.filter(r => r.ingredientId !== indexOrIngId);
      }
      const calcHpp = updated.reduce((sum, r) => {
        const ing = findIngredientHelper(ingredients, r.ingredientId);
        if (!ing) return sum;
        return sum + calculateRecipeItemCost(ing, r.takaran);
      }, 0);

      setNewMenuHpp(Math.round(calcHpp).toString());
      return updated;
    });
  };

  /** Persist catalog updates across localStorage, cloudSlot, dailySales records & Sheets. */
  const commitRenamedCatalogAndSales = (
    updatedCatalog: MenuItem[],
    renamedMenu?: {
      id: string;
      oldName: string;
      newName: string;
      kategori: MenuItem['kategori'];
      hargaJual: number;
      hpp: number;
    }
  ) => {
    const nowTs = Date.now();
    lastMenuCatalogUpdatedAtRef.current = nowTs;

    // Clear tombstones if any active menu reuses an old ID/name
    const tombs = readDeletedMenuTombstones();
    updatedCatalog.forEach(m => {
      if (m.id) tombs.deletedIds.delete(m.id);
      const nl = (m.nama || '').trim().toLowerCase();
      if (nl) tombs.deletedNames.delete(nl);
    });
    writeDeletedMenuTombstones(tombs.deletedIds, tombs.deletedNames);

    const cleanCatalog = dedupeMenuCatalogItems(updatedCatalog);
    setMenuItems(cleanCatalog);
    localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(cleanCatalog));
    saveCloudSlot('menu_catalog', {
      items: cleanCatalog,
      deletedIds: Array.from(tombs.deletedIds),
      deletedNames: Array.from(tombs.deletedNames),
      updatedAt: nowTs,
    }).catch(() => {});

    let nextSales = dailySales;
    if (renamedMenu) {
      const oldLower = renamedMenu.oldName.trim().toLowerCase();
      const targetMenu = updatedCatalog.find(m => m.id === renamedMenu.id);
      const aliasSet = new Set<string>(
        [
          oldLower,
          renamedMenu.newName.trim().toLowerCase(),
          ...(Array.isArray(targetMenu?.aliases)
            ? targetMenu!.aliases!.map(a => a.trim().toLowerCase())
            : []),
        ].filter(Boolean)
      );

      let salesChanged = false;
      nextSales = dailySales.map(rec => {
        if (!rec.menuSales || rec.menuSales.length === 0) return rec;
        let recModified = false;
        const updatedMenuSales = rec.menuSales.map(ms => {
          const msNameLower = (ms.nama || '').trim().toLowerCase();
          if (ms.menuId === renamedMenu.id || (msNameLower && aliasSet.has(msNameLower))) {
            if (ms.nama !== renamedMenu.newName || ms.menuId !== renamedMenu.id) {
              recModified = true;
              return {
                ...ms,
                menuId: renamedMenu.id,
                nama: renamedMenu.newName,
                kategori: renamedMenu.kategori,
                hargaJual: renamedMenu.hargaJual || ms.hargaJual,
                hpp: renamedMenu.hpp || ms.hpp,
              };
            }
          }
          return ms;
        });
        if (!recModified) return rec;
        salesChanged = true;
        return {
          ...rec,
          menuSales: updatedMenuSales,
          updatedAt: nowTs,
        };
      });

      if (salesChanged) {
        setDailySales(nextSales);
        localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(nextSales));
      }
    }

    if (spreadsheetId && token) {
      syncDataToCloud(updatedCatalog, nextSales);
    } else if (renamedMenu) {
      pushDailySalesToCloud({ records: nextSales, selectedDate, immediate: true }).catch(() => {});
    }
  };

  const handleRenameMenuFromRecipe = (menuId: string, rawNewName: string) => {
    const trimmed = rawNewName.trim();
    if (!trimmed) return;
    const existing = menuItems.find(m => m.id === menuId);
    if (!existing) return;

    if (existing.nama.trim() === trimmed) {
      setEditingRecipeNameId(null);
      return;
    }

    const prevAliases = Array.isArray(existing.aliases) ? existing.aliases : [];
    const nextAliases = Array.from(
      new Set([...prevAliases, existing.nama.trim()].filter(a => a && a.toLowerCase() !== trimmed.toLowerCase()))
    );

    const updatedList = menuItems.map(m =>
      m.id === menuId
        ? { ...m, nama: trimmed, aliases: nextAliases }
        : m
    );

    commitRenamedCatalogAndSales(updatedList, {
      id: existing.id,
      oldName: existing.nama,
      newName: trimmed,
      kategori: existing.kategori,
      hargaJual: existing.hargaJual,
      hpp: existing.hpp,
    });

    if (editingMenuItemId === menuId) {
      setNewMenuNama(trimmed);
    }
    setEditingRecipeNameId(null);
  };

  const handleSaveMenu = (e: React.FormEvent) => {
    e.preventDefault();
    const harga = parseFloat(newMenuHarga) || 0;
    const hppVal = parseFloat(newMenuHpp) || 0;
    const jatah = parseFloat(newMenuJatah) || 0;
    const trimmedName = newMenuNama.trim();

    if (!trimmedName || harga <= 0) return;

    if (editingMenuItemId) {
      const existing = menuItems.find(m => m.id === editingMenuItemId);
      const prevAliases = existing && Array.isArray(existing.aliases) ? existing.aliases : [];
      const nextAliases = existing && existing.nama.trim().toLowerCase() !== trimmedName.toLowerCase()
        ? Array.from(new Set([...prevAliases, existing.nama.trim()].filter(a => a && a.toLowerCase() !== trimmedName.toLowerCase())))
        : prevAliases;

      const updatedList = menuItems.map(m => m.id === editingMenuItemId ? {
        ...m,
        nama: trimmedName,
        aliases: nextAliases,
        kategori: newMenuKategori,
        hargaJual: harga,
        hpp: hppVal,
        defaultJatah: jatah,
        recipe: newMenuRecipe
      } : m);

      setEditingMenuItemId(null);
      commitRenamedCatalogAndSales(
        updatedList,
        existing
          ? {
              id: existing.id,
              oldName: existing.nama,
              newName: trimmedName,
              kategori: newMenuKategori,
              hargaJual: harga,
              hpp: hppVal,
            }
          : undefined
      );
    } else {
      const newMenu: MenuItem = {
        id: `m-${Date.now()}`,
        nama: trimmedName,
        kategori: newMenuKategori,
        hargaJual: harga,
        hpp: hppVal,
        defaultJatah: jatah,
        recipe: newMenuRecipe
      };
      const updatedList = [...menuItems, newMenu];
      commitRenamedCatalogAndSales(updatedList);
    }

    setNewMenuNama('');
    setNewMenuHarga('20000');
    setNewMenuHpp('0');
    setNewMenuJatah('20');
    setNewMenuRecipe([]);
    setFormRecipeIngId('');
    setShowAddMenuModal(false);
  };

  const handleEditMenuClick = (menu: MenuItem) => {
    setEditingMenuItemId(menu.id);
    setNewMenuNama(menu.nama);
    setNewMenuKategori(menu.kategori);
    setNewMenuHarga(menu.hargaJual.toString());
    const initialRecipe = menu.recipe || [];
    setNewMenuRecipe(initialRecipe);
    const calculatedHpp = initialRecipe.length > 0 ? calculateMenuItemHppFromRecipe(menu, ingredients) : menu.hpp;
    setNewMenuHpp(Math.round(calculatedHpp).toString());
    setNewMenuJatah(menu.defaultJatah.toString());
    setShowAddMenuModal(true);

    // Auto scroll directly to the edit row above the menu being edited
    setTimeout(() => {
      const el = document.getElementById(`edit-menu-row-${menu.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleDeleteMenu = (targetMenu: MenuItem) => {
    const nowTs = Date.now();
    lastMenuCatalogUpdatedAtRef.current = nowTs;

    const tombs = readDeletedMenuTombstones();
    if (targetMenu.id) tombs.deletedIds.add(targetMenu.id);
    const targetNameLower = normalizeMenuSortName(targetMenu.nama).toLowerCase();
    if (targetNameLower) tombs.deletedNames.add(targetNameLower);
    if (Array.isArray(targetMenu.aliases)) {
      targetMenu.aliases.forEach(a => {
        const al = normalizeMenuSortName(a).toLowerCase();
        if (al) tombs.deletedNames.add(al);
      });
    }
    writeDeletedMenuTombstones(tombs.deletedIds, tombs.deletedNames);

    const updated = menuItemsRef.current.filter(
      m => m.id !== targetMenu.id && (!targetNameLower || normalizeMenuSortName(m.nama).toLowerCase() !== targetNameLower)
    );
    setMenuItems(updated);
    localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(updated));

    if (confirmDeleteMenuId === targetMenu.id) setConfirmDeleteMenuId(null);
    if (editingMenuItemId === targetMenu.id) {
      setEditingMenuItemId(null);
      setShowAddMenuModal(false);
    }
    if (expandedRecipeMenuId === targetMenu.id) setExpandedRecipeMenuId(null);

    saveCloudSlot('menu_catalog', {
      items: updated,
      deletedIds: Array.from(tombs.deletedIds),
      deletedNames: Array.from(tombs.deletedNames),
      updatedAt: nowTs,
    }).catch(() => {});

    if (spreadsheetId) {
      syncDataToCloud(updated, dailySales);
    }
  };

  // Ingredient Handlers
  const handleEditIngredientClick = (ing: RecipeIngredient) => {
    setEditingIngId(ing.id);
    setNewIngNama(ing.namaBahan);
    setNewIngHarga(ing.hargaBeli.toString());

    const numIsi = parseFloat(ing.satuanBeli) || 1;
    const unitBeliStr = ing.satuanBeli.replace(/^[0-9.\s]+/, '').trim().toLowerCase() || 'gram';
    setNewIngIsiBeli(numIsi.toString());
    setNewIngSatuanBeliUnit(UNIT_OPTIONS.includes(unitBeliStr) ? unitBeliStr : 'gram');

    setNewIngTakaran(ing.takaranPerCup.toString());
    const unitTakaranStr = (ing.satuanTakaran || '').trim().toLowerCase() || 'gram';
    setNewIngSatuanTakaranUnit(UNIT_OPTIONS.includes(unitTakaranStr) ? unitTakaranStr : 'gram');
  };

  const handleCancelEditIngredient = () => {
    setEditingIngId(null);
    setNewIngNama('');
    setNewIngHarga('');
    setNewIngIsiBeli('1000');
    setNewIngSatuanBeliUnit('gram');
    setNewIngTakaran('');
    setNewIngSatuanTakaranUnit('gram');
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const hb = parseFloat(newIngHarga) || 0;
    const isi = parseFloat(newIngIsiBeli) || 1;
    const tk = parseFloat(newIngTakaran) || 1;
    if (!newIngNama.trim() || hb <= 0) return;

    const formattedSatuanBeli = `${isi} ${newIngSatuanBeliUnit}`;

    if (editingIngId) {
      setIngredients(prev => prev.map(item => {
        if (item.id === editingIngId) {
          return {
            ...item,
            namaBahan: newIngNama.trim(),
            hargaBeli: hb,
            satuanBeli: formattedSatuanBeli,
            takaranPerCup: tk,
            satuanTakaran: newIngSatuanTakaranUnit
          };
        }
        return item;
      }));
      handleCancelEditIngredient();
    } else {
      const newIng: RecipeIngredient = {
        id: `ing-${Date.now()}`,
        namaBahan: newIngNama.trim(),
        hargaBeli: hb,
        satuanBeli: formattedSatuanBeli,
        takaranPerCup: tk,
        satuanTakaran: newIngSatuanTakaranUnit
      };

      setIngredients(prev => [...prev, newIng]);
      setNewIngNama('');
      setNewIngHarga('');
      setNewIngTakaran('');
    }
  };

  const handleDeleteIngredient = (id: string) => {
    let nextIngredients: RecipeIngredient[] = [];
    setIngredients(prev => {
      nextIngredients = prev.filter(ing => ing.id !== id);
      localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(nextIngredients));
      return nextIngredients;
    });

    // Also remove deleted ingredient from any menu recipes and sync
    setMenuItems(prev => {
      const updatedList = prev.map(m => {
        if (!m.recipe || m.recipe.length === 0) return m;
        const newRecipe = m.recipe.filter(r => r.ingredientId !== id);
        if (newRecipe.length === m.recipe.length) return m;

        const newCalculatedHpp = newRecipe.length > 0
          ? newRecipe.reduce((sum, r) => {
              const ing = findIngredientHelper(nextIngredients, r.ingredientId);
              if (!ing) return sum;
              return sum + calculateRecipeItemCost(ing, r.takaran);
            }, 0)
          : m.hpp;

        return {
          ...m,
          recipe: newRecipe,
          hpp: Math.round(newCalculatedHpp)
        };
      });

      localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(updatedList));
      if (spreadsheetId && token) {
        saveMenuCatalogToSheet(spreadsheetId, updatedList, token).catch(e => console.error("Cloud sync error:", e));
      }
      return updatedList;
    });

    if (editingIngId === id) {
      handleCancelEditIngredient();
    }
  };

  // Menu Recipe Handlers
  const handleAddIngredientToRecipe = (menuId: string, ingId: string, takaranVal: number) => {
    if (!menuId || !ingId || takaranVal <= 0) return;
    setMenuItems(prev => {
      const updatedList = prev.map(m => {
        if (m.id === menuId) {
          const currentRecipe = m.recipe || [];
          const idx = currentRecipe.findIndex(r => r.ingredientId === ingId);
          let newRecipe: MenuRecipeIngredient[];
          if (idx >= 0) {
            newRecipe = [...currentRecipe];
            newRecipe[idx] = { ingredientId: ingId, takaran: takaranVal };
          } else {
            newRecipe = [...currentRecipe, { ingredientId: ingId, takaran: takaranVal }];
          }
          
          const newCalculatedHpp = newRecipe.reduce((sum, r) => {
            const ing = findIngredientHelper(ingredients, r.ingredientId);
            if (!ing) return sum;
            return sum + calculateRecipeItemCost(ing, r.takaran);
          }, 0);

          return {
            ...m,
            recipe: newRecipe,
            hpp: Math.round(newCalculatedHpp)
          };
        }
        return m;
      });

      localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(updatedList));
      if (spreadsheetId && token) {
        saveMenuCatalogToSheet(spreadsheetId, updatedList, token).catch(e => console.error("Cloud sync error:", e));
      }
      return updatedList;
    });
  };

  const handleRemoveIngredientFromRecipe = (menuId: string, indexOrIngId: number | string) => {
    setMenuItems(prev => {
      const updatedList = prev.map(m => {
        if (m.id === menuId) {
          const currentRecipe = m.recipe || [];
          let newRecipe: MenuRecipeIngredient[] = [];
          if (typeof indexOrIngId === 'number') {
            newRecipe = currentRecipe.filter((_, idx) => idx !== indexOrIngId);
          } else {
            newRecipe = currentRecipe.filter(r => r.ingredientId !== indexOrIngId);
          }
          const newCalculatedHpp = newRecipe.length > 0 
            ? newRecipe.reduce((sum, r) => {
                const ing = findIngredientHelper(ingredients, r.ingredientId);
                if (!ing) return sum;
                return sum + calculateRecipeItemCost(ing, r.takaran);
              }, 0)
            : m.hpp;

          return {
            ...m,
            recipe: newRecipe,
            hpp: Math.round(newCalculatedHpp)
          };
        }
        return m;
      });

      localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(updatedList));
      if (spreadsheetId && token) {
        saveMenuCatalogToSheet(spreadsheetId, updatedList, token).catch(e => console.error("Cloud sync error:", e));
      }
      return updatedList;
    });
  };

  const handleCleanInvalidIngredientsFromRecipe = (menuId: string) => {
    setMenuItems(prev => {
      const updatedList = prev.map(m => {
        if (m.id === menuId) {
          const currentRecipe = m.recipe || [];
          const newRecipe = currentRecipe.filter(r => findIngredientHelper(ingredients, r.ingredientId) !== undefined);
          const newCalculatedHpp = newRecipe.length > 0 
            ? newRecipe.reduce((sum, r) => {
                const ing = findIngredientHelper(ingredients, r.ingredientId);
                if (!ing) return sum;
                return sum + calculateRecipeItemCost(ing, r.takaran);
              }, 0)
            : m.hpp;

          return {
            ...m,
            recipe: newRecipe,
            hpp: Math.round(newCalculatedHpp)
          };
        }
        return m;
      });

      localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(updatedList));
      if (spreadsheetId && token) {
        saveMenuCatalogToSheet(spreadsheetId, updatedList, token).catch(e => console.error("Cloud sync error:", e));
      }
      return updatedList;
    });
  };

  const handleDeleteDaily = (id: string) => {
    if (window.confirm('Hapus catatan penjualan harian ini?')) {
      setDailySales(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleEditDaily = (record: DailySalesRecord) => {
    setSelectedDate(record.tanggal);
    setIsMinFormInput(false);

    if (record.menuSales && record.menuSales.length > 0) {
      setEntryMode('itemized');
      const initialMap: Record<string, { jatah: number; terjual: number }> = {};
      menuItems.forEach(item => {
        const found = record.menuSales?.find(ms => ms.menuId === item.id);
        initialMap[item.id] = {
          jatah: found ? found.jatah : (item.defaultJatah || 0),
          terjual: found ? found.terjual : 0,
        };
      });
      setItemizedInputs(initialMap);
      const totJatah = record.menuSales.reduce((s, ms) => s + (ms.jatah || 0), 0);
      setQuickJatah(totJatah.toString());
    } else {
      setEntryMode('quick');
      setQuickCups(record.cups.toString());
      setQuickOmset(record.omset.toString());
    }
    setDailyNotes(record.notes || '');

    if (activeSubTab !== 'all' && activeSubTab !== 'pencatatan_harian') {
      setActiveSubTab('pencatatan_harian');
    }

    setTimeout(() => {
      const el = document.getElementById('sec-pencatatan-harian');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  // Reset to initial default benchmark
  const handleResetToDefault = () => {
    if (window.confirm('Kembalikan seluruh katalog menu, parameter, dan data penjualan harian ke nilai benchmark awal?')) {
      setHargaPerCup(19000);
      setHppPerCup(9018);
      setManualOmsetBulanan(24357500);
      setTargetProfit(3500000);
      setUseDailySalesAccumulation(true);
      setMenuItems(DEFAULT_MENU_ITEMS.map(item => ({ ...item, defaultJatah: 0 })));
      setBiayaList(DEFAULT_BIAYA_ITEMS);
      setIngredients(DEFAULT_INGREDIENTS);
      setDailySales(DEFAULT_DAILY_SALES);
      setIncomingBatches([]);
      localStorage.removeItem('aruskas_cogs_page_menu_catalog');
      localStorage.removeItem('aruskas_cogs_page_biaya');
      localStorage.removeItem('aruskas_cogs_page_daily_sales');
      localStorage.removeItem('aruskas_cogs_ingredients');
      localStorage.removeItem('aruskas_cogs_incoming_batches');
    }
  };

  // Download Comprehensive CSV Report
  const handleDownloadCSV = () => {
    const csvLines: string[] = [];
    csvLines.push(`"LAPORAN DATA MENU, COGS & PENJUALAN HARIAN BASCO CAFE"`);
    csvLines.push(`"Tanggal Export:","${new Date().toLocaleString('id-ID')}"`);
    csvLines.push(``);
    
    csvLines.push(`"--- A. KATALOG SHEET DATA MENU & HPP ---"`);
    csvLines.push(`"Nama Menu","Kategori","Harga Jual (Rp)","HPP per Unit (Rp)","Margin per Unit (Rp)","Margin (%)","Jatah Harian Default"`);
    menuItems.forEach(m => {
      const margin = m.hargaJual - m.hpp;
      const pct = m.hargaJual > 0 ? (margin / m.hargaJual) * 100 : 0;
      csvLines.push(`"${m.nama}","${m.kategori}","${m.hargaJual}","${m.hpp}","${margin}","${pct.toFixed(1)}%","${m.defaultJatah}"`);
    });
    csvLines.push(``);

    csvLines.push(`"--- B. FINANCIAL SUMMARY BULANAN ---"`);
    csvLines.push(`"Total Omset Bulanan:","Rp ${omsetBulanan.toLocaleString('id-ID')}"`);
    csvLines.push(`"Total Estimasi HPP (COGS):","Rp ${Math.round(totalEstimasiHPP).toLocaleString('id-ID')}"`);
    csvLines.push(`"Total Biaya Operasional (Gaji & Utilitas):","Rp ${totalBiayaBulanan.toLocaleString('id-ID')}"`);
    csvLines.push(`"Keuntungan Kotor (Gross Profit):","Rp ${Math.round(grossProfit).toLocaleString('id-ID')}"`);
    csvLines.push(`"Keuntungan Bersih (Net Profit):","Rp ${Math.round(netProfit).toLocaleString('id-ID')}"`);
    csvLines.push(``);

    csvLines.push(`"--- C. REKAPITULASI PENJUALAN HARIAN ---"`);
    csvLines.push(`"Tanggal","Total Porsi/Cups","Nominal Omset (Rp)","Total HPP (Rp)","Gross Profit (Rp)","Catatan Shift"`);
    dailySales.forEach(rec => {
      const hppDaily = rec.hppTotal || (rec.cups * hppPerCup);
      const gpDaily = rec.omset - hppDaily;
      csvLines.push(`"${formatDateDDMMYYYY(rec.tanggal)}","${rec.cups}","${rec.omset}","${Math.round(hppDaily)}","${Math.round(gpDaily)}","${(rec.notes || '-').replace(/"/g, '""')}"`);
    });
    csvLines.push(``);

    csvLines.push(`"--- D. REKAPITULASI BARANG / BAHAN MASUK ---"`);
    csvLines.push(`"Tanggal","Nama Bahan Baku","Kategori","Berat / Volume","Satuan","Total Harga (Rp)","Harga per Satuan (Rp)","Status Pembayaran","Supplier","Nomor Nota","Keterangan"`);
    incomingBatches.forEach(b => {
      csvLines.push(`"${formatDateDDMMYYYY(b.tanggal)}","${b.namaBahan}","${b.kategori || '-'}","${b.berat}","${b.satuan}","${b.harga}","${Math.round(b.hargaSatuan)}","${b.statusPembayaran}","${b.supplier || '-'}","${b.nomorNota || '-'}","${(b.keterangan || '-').replace(/"/g, '""')}"`);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvLines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Analisis_Menu_COGS_Penjualan_Harian_Basco_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Recharts Chart Data (supports daily trend & monthly aggregated views)
  const chartData = useMemo(() => {
    if (chartViewType === 'monthly') {
      // Group daily sales by month (YYYY-MM)
      const monthMap = new Map<string, { omset: number; hpp: number; grossProfit: number; cups: number; count: number }>();

      const targetSales = selectedOmsetMonth === 'ALL' 
        ? dailySales 
        : dailySales.filter(rec => rec.tanggal && rec.tanggal.startsWith(selectedOmsetMonth));

      targetSales.forEach(rec => {
        const ym = rec.tanggal && rec.tanggal.length >= 7 ? rec.tanggal.slice(0, 7) : '2026-08';
        const estHpp = rec.hppTotal || (rec.cups * hppPerCup);
        const grossProf = rec.omset - estHpp;

        const curr = monthMap.get(ym) || { omset: 0, hpp: 0, grossProfit: 0, cups: 0, count: 0 };
        curr.omset += rec.omset;
        curr.hpp += estHpp;
        curr.grossProfit += grossProf;
        curr.cups += rec.cups;
        curr.count += 1;
        monthMap.set(ym, curr);
      });

      const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b));

      return sortedKeys.map(ym => {
        const item = monthMap.get(ym)!;
        return {
          tanggal: formatMonthLabel(ym),
          rawYM: ym,
          Omset: item.omset,
          HPP: Math.round(item.hpp),
          GrossProfit: Math.round(item.grossProfit),
          Cups: item.cups,
          HariTerdata: item.count
        };
      });
    }

    // Daily breakdown for filteredSalesForOmset
    return filteredSalesForOmset.map(rec => {
      const estHpp = rec.hppTotal || (rec.cups * hppPerCup);
      const grossProf = rec.omset - estHpp;
      let label = rec.tanggal;
      if (rec.tanggal && rec.tanggal.length === 10) {
        const d = rec.tanggal.slice(8, 10);
        const m = formatMonthLabel(rec.tanggal.slice(0, 7)).split(' ')[0];
        label = `${d} ${m}`;
      }

      return {
        tanggal: label,
        rawTanggal: rec.tanggal,
        Omset: rec.omset,
        HPP: Math.round(estHpp),
        GrossProfit: Math.round(grossProf),
        Cups: rec.cups
      };
    });
  }, [filteredSalesForOmset, dailySales, chartViewType, selectedOmsetMonth, hppPerCup]);

  // MINIMALIST & MOBILE-FIRST FORM VIEW FOR BARISTA ROLE
  if (userRole === 'barista') {
    const baristaFilteredMenus = sortedMenuItems.filter(m => {
      const matchCat = baristaCategory === 'ALL' || m.kategori === baristaCategory;
      const matchQuery = !baristaSearch.trim() || m.nama.toLowerCase().includes(baristaSearch.trim().toLowerCase());
      return matchCat && matchQuery;
    });

    return (
      <div className="max-w-3xl mx-auto px-1 sm:px-4 py-2 sm:py-5 font-sans">
        <form
          onSubmit={handleSaveItemizedDaily}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-6 space-y-4 sm:space-y-5"
        >
          {/* Minimalist Form Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900 leading-tight">
                  Form Catatan Penjualan & Jatah Harian
                </h2>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Input jumlah porsi terjual & jatah barista per menu harian
                </p>
              </div>
            </div>
          </div>

          {/* Date Picker & Live Summary Counters (Mobile Responsive Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="col-span-2 sm:col-span-1 flex items-center space-x-2.5 bg-white p-2.5 rounded-lg border border-slate-200">
              <Calendar className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                  Tanggal Laporan
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-transparent text-xs font-black font-mono text-slate-900 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-lg flex flex-col justify-center">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700">
                Total Terjual
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-amber-950">
                {itemizedCalculations.totalCups} <span className="text-[10px] font-bold">Porsi</span>
              </span>
            </div>

            <div className="bg-indigo-50/80 border border-indigo-200/80 p-2.5 rounded-lg flex flex-col justify-center">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-indigo-700">
                Total Jatah
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-indigo-950">
                {itemizedCalculations.totalJatah} <span className="text-[10px] font-bold">Porsi</span>
              </span>
            </div>
          </div>

          {/* Scan Foto Nota Penjualan Keseluruhan Harian */}
          <div className="rounded-xl border-2 border-dashed border-emerald-300/90 bg-linear-to-br from-emerald-50/80 via-white to-amber-50/50 p-3.5 space-y-3">
            {/* Hidden Camera & File Inputs */}
            <input
              ref={receiptCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptPhotoUpload}
              className="hidden"
            />
            <input
              ref={receiptFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptPhotoUpload}
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start space-x-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 shadow-xs">
                  <Camera className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                    Scan Foto Nota Penjualan Harian
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Foto nota keseluruhan harian langsung membaca menu terjual &amp; mengisi form penjualan otomatis.
                  </p>
                </div>
              </div>

              {/* Mode Switch: Replace vs Add */}
              <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5 self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setReceiptApplyMode('replace')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold transition cursor-pointer ${
                    receiptApplyMode === 'replace'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Isi form terjual sesuai hasil scan nota harian"
                >
                  Isi Otomatis
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptApplyMode('add')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold transition cursor-pointer ${
                    receiptApplyMode === 'add'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Tambahkan jumlah hasil scan ke angka terjual yang sudah ada (cocok untuk gabungan nota shift)"
                >
                  + Tambah Shift
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isScanningReceipt}
                onClick={() => receiptCameraInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
              >
                {isScanningReceipt ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Camera className="h-4 w-4 shrink-0" />
                )}
                <span>{isScanningReceipt ? 'Membaca Foto Nota...' : 'Ambil Foto Nota (Kamera)'}</span>
              </button>

              <button
                type="button"
                disabled={isScanningReceipt}
                onClick={() => receiptFileInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-60"
              >
                <ImageIcon className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Pilih Gambar / Galeri Nota</span>
              </button>
            </div>

            {/* Scanning Progress Indicator */}
            {isScanningReceipt && (
              <div className="flex items-center space-x-2 px-3 py-2 bg-white/90 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 shrink-0" />
                <span>{receiptScanProgress || 'Memproses foto nota penjualan...'}</span>
              </div>
            )}

            {/* Scan Error Banner */}
            {receiptScanError && (
              <div className="flex items-start justify-between gap-2 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{receiptScanError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptScanError(null)}
                  className="text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                  aria-label="Tutup pesan error scan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Scan Results Preview & Auto-filled Summary */}
            {receiptScanResult && (
              <div className="bg-white border border-emerald-200 rounded-xl p-3 space-y-2.5 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <img
                      src={receiptScanResult.previewUrl}
                      alt="Preview Foto Nota"
                      className="w-11 h-11 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-black text-emerald-900">
                          {receiptScanResult.items.length} Menu Terisi Otomatis
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">
                          {receiptScanResult.engineUsed}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-medium truncate">
                        Total terbaca: {receiptScanResult.items.reduce((s, it) => s + it.qty, 0)} Porsi terjual (langsung masuk ke form di bawah)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {receiptUndoSnapshot && (
                      <button
                        type="button"
                        onClick={handleUndoReceiptScan}
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                        title="Batalkan hasil scan & kembalikan angka sebelum scan"
                      >
                        <Undo2 className="h-3 w-3" />
                        <span>Urungkan</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReceiptScanResult(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                      aria-label="Tutup ringkasan scan"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Detected Receipt Date Prompt */}
                {receiptScanResult.tanggal && receiptScanResult.tanggal !== selectedDate && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px]">
                    <span className="text-amber-900 font-semibold">
                      Tanggal pada nota terdeteksi: <strong className="font-mono">{receiptScanResult.tanggal}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApplyDetectedReceiptDate(receiptScanResult.tanggal!)}
                      className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-[10px] cursor-pointer transition"
                    >
                      Gunakan Tanggal Ini
                    </button>
                  </div>
                )}

                {/* Matched Items Chips */}
                {receiptScanResult.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {receiptScanResult.items.map((it) => (
                      <span
                        key={it.menuId}
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10.5px] font-bold text-emerald-950"
                        title={`Terbaca di nota: "${it.receiptName}"`}
                      >
                        <CheckCircle className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>{it.matchedMenuName}</span>
                        <span className="font-mono font-black text-emerald-700 bg-white px-1 rounded">
                          ×{it.qty}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Unmatched Receipt Lines with 1-Click Manual Mapping */}
                {receiptScanResult.unmatched.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                      Item Nota Belum Cocok Otomatis ({receiptScanResult.unmatched.length}):
                    </p>
                    <div className="space-y-1.5">
                      {receiptScanResult.unmatched.map((u, idx) => (
                        <div
                          key={`${u.receiptName}-${idx}`}
                          className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-amber-50/70 border border-amber-200/80 p-2 rounded-lg text-[11px]"
                        >
                          <div className="flex-1 min-w-0 flex items-center justify-between sm:justify-start gap-2">
                            <span className="font-bold text-slate-800 truncate">"{u.receiptName}"</span>
                            <span className="font-mono font-black text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                              {u.qty} porsi
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <select
                              value={unmatchedAssignMap[idx] || ''}
                              onChange={(ev) =>
                                setUnmatchedAssignMap((prev) => ({ ...prev, [idx]: ev.target.value }))
                              }
                              className="flex-1 sm:w-44 px-2 py-1 bg-white border border-slate-300 rounded-lg text-[10.5px] font-semibold text-slate-800 focus:outline-none"
                            >
                              <option value="">Pilih Menu Katalog...</option>
                              {sortedMenuItems.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nama}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!unmatchedAssignMap[idx]}
                              onClick={() => handleAssignUnmatchedReceiptItem(idx, u.receiptName, u.qty)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer shrink-0 transition"
                            >
                              + Input
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search, Category Filter & Quick Reset Toolbar */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={baristaSearch}
                  onChange={(e) => setBaristaSearch(e.target.value)}
                  placeholder="Cari nama menu..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
                {(['ALL', 'Minuman', 'Makanan', 'Snack'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setBaristaCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer ${
                      baristaCategory === cat
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'Semua' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleFillSalesFromJatah}
                  className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded-lg text-[11px] transition cursor-pointer"
                >
                  Isi Sales = Jatah
                </button>
                <button
                  type="button"
                  onClick={handleResetSalesToZero}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                >
                  Reset Sales = 0
                </button>
                <button
                  type="button"
                  onClick={handleResetJatahToDefault}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold rounded-lg text-[11px] transition cursor-pointer"
                >
                  Reset Jatah = 0
                </button>
              </div>

              <select
                autoComplete="off"
                value={menuSortMode}
                onChange={(e) => setMenuSortMode(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] border border-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="bestseller_qty">Urut: Paling Laku</option>
                <option value="alphabetical">Urut: Abjad (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Minimalist Mobile-Responsive Menu Input List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {/* Desktop / Tablet Column Header */}
            <div className="hidden sm:grid sm:grid-cols-12 bg-slate-100 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
              <div className="col-span-6">Nama Menu</div>
              <div className="col-span-3 text-center text-amber-900">Penjualan (Terjual)</div>
              <div className="col-span-3 text-center text-indigo-900">Jatah Barista</div>
            </div>

            {baristaFilteredMenus.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-semibold">
                Menu tidak ditemukan untuk pencarian "{baristaSearch}".
              </div>
            ) : (
              baristaFilteredMenus.map((m) => {
                const currentInput = itemizedInputs[m.id] || { jatah: m.defaultJatah, terjual: 0 };
                const isFilledSales = currentInput.terjual > 0;
                const isFilledJatah = currentInput.jatah > 0;
                const isRowFilled = isFilledSales || isFilledJatah;

                const updateTerjual = (nextVal: number) => {
                  const val = Math.max(0, nextVal);
                  setItemizedInputs(prev => {
                    const next = {
                      ...prev,
                      [m.id]: { ...(prev[m.id] || { jatah: m.defaultJatah }), terjual: val }
                    };
                    commitItemizedInputsLive(next);
                    return next;
                  });
                };

                const updateJatah = (nextVal: number) => {
                  const val = Math.max(0, nextVal);
                  setItemizedInputs(prev => {
                    const next = {
                      ...prev,
                      [m.id]: { ...(prev[m.id] || { terjual: 0 }), jatah: val }
                    };
                    commitItemizedInputsLive(next);
                    return next;
                  });
                };

                return (
                  <div
                    key={m.id}
                    className={`p-3 sm:px-4 sm:py-2.5 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2.5 sm:gap-2 transition-colors ${
                      isRowFilled ? 'bg-emerald-50/30' : 'bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Menu Name & Category */}
                    <div className="sm:col-span-6 flex items-center justify-between sm:justify-start gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRowFilled ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                        <span className={`text-xs sm:text-sm truncate ${isRowFilled ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                          {m.nama}
                        </span>
                      </div>
                      <span className="text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 shrink-0">
                        {m.kategori}
                      </span>
                    </div>

                    {/* Mobile & Desktop Input Controls (Terjual & Jatah) */}
                    <div className="grid grid-cols-2 sm:col-span-6 gap-2.5 sm:gap-3">
                      {/* Terjual Input with +/- Stepper */}
                      <div className="bg-amber-50/60 sm:bg-transparent p-2 sm:p-0 rounded-xl border border-amber-200/60 sm:border-0 flex flex-col items-center">
                        <span className="sm:hidden text-[9.5px] font-extrabold uppercase text-amber-800 mb-1">
                          Terjual (Porsi)
                        </span>
                        <div className="flex items-center justify-center space-x-1 w-full">
                          <button
                            type="button"
                            onClick={() => updateTerjual(currentInput.terjual - 1)}
                            className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-white hover:bg-amber-100 border border-slate-200 text-slate-700 font-black text-sm flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
                            aria-label="Kurangi Terjual"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={currentInput.terjual === 0 ? '' : currentInput.terjual}
                            placeholder="0"
                            onChange={(e) => {
                              const rawVal = e.target.value;
                              updateTerjual(rawVal === '' ? 0 : parseInt(rawVal, 10) || 0);
                            }}
                            className={`w-full max-w-[68px] h-8 sm:h-7 px-1 rounded-lg text-center font-mono text-xs sm:text-sm transition-all focus:outline-none ${
                              isFilledSales
                                ? 'bg-amber-400 text-amber-950 font-black border-2 border-amber-500 shadow-2xs'
                                : 'bg-white text-slate-600 border border-slate-200 focus:border-amber-400'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => updateTerjual(currentInput.terjual + 1)}
                            className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
                            aria-label="Tambah Terjual"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Jatah Input with +/- Stepper */}
                      <div className="bg-indigo-50/60 sm:bg-transparent p-2 sm:p-0 rounded-xl border border-indigo-200/60 sm:border-0 flex flex-col items-center">
                        <span className="sm:hidden text-[9.5px] font-extrabold uppercase text-indigo-800 mb-1">
                          Jatah Barista
                        </span>
                        <div className="flex items-center justify-center space-x-1 w-full">
                          <button
                            type="button"
                            onClick={() => updateJatah(currentInput.jatah - 1)}
                            className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-white hover:bg-indigo-100 border border-slate-200 text-slate-700 font-black text-sm flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
                            aria-label="Kurangi Jatah"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={currentInput.jatah === 0 ? '' : currentInput.jatah}
                            placeholder="0"
                            onChange={(e) => {
                              const rawVal = e.target.value;
                              updateJatah(rawVal === '' ? 0 : parseInt(rawVal, 10) || 0);
                            }}
                            className={`w-full max-w-[68px] h-8 sm:h-7 px-1 rounded-lg text-center font-mono text-xs sm:text-sm transition-all focus:outline-none ${
                              isFilledJatah
                                ? 'bg-indigo-100 text-indigo-950 font-black border-2 border-indigo-400 shadow-2xs'
                                : 'bg-white text-slate-600 border border-slate-200 focus:border-indigo-400'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => updateJatah(currentInput.jatah + 1)}
                            className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
                            aria-label="Tambah Jatah"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Catatan Shift & Save Button */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Catatan Shift / Operasional (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Shift Pagi / Malam..."
                value={dailyNotes}
                onChange={(e) => setDailyNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSyncingSheet}
              className="w-full py-3.5 px-5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
              <span>{isSyncingSheet ? 'Menyimpan...' : 'Simpan Catatan Penjualan & Jatah Harian'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      
      {/* App Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 mb-2">
              <Coffee className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-widest">Aplikasi 2: Analisis Arus Kas Cafe</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              COGS & Penjualan Harian
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed font-medium">
              Sistem pencatatan harian sales &amp; jatah menu, pengolahan katalog harga jual &amp; HPP, serta kalkulator resep COGS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (spreadsheetId && token) {
                  syncDataToCloud();
                  alert('Berhasil menyinkronkan data catalog menu & penjualan harian ke Google Sheets!');
                } else {
                  localStorage.setItem('aruskas_cogs_page_menu_catalog', JSON.stringify(menuItems));
                  localStorage.setItem('aruskas_cogs_page_daily_sales', JSON.stringify(dailySales));
                  localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(ingredients));
                  localStorage.setItem('aruskas_cogs_page_biaya', JSON.stringify(biayaList));
                  localStorage.setItem('aruskas_cogs_incoming_batches', JSON.stringify(incomingBatches));
                  alert('Data telah disinkronkan & diamankan ke memori browser!');
                }
              }}
              disabled={isSyncingSheet}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              title="Sinkronkan seluruh data menu, HPP, & penjualan harian ke Google Sheets"
            >
              <Cloud className={`h-4 w-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheet ? 'Menyinkronkan...' : 'Sinkronkan Spreadsheet (Semua Data)'}</span>
            </button>
            <button
              onClick={() => setShowSalesCogsReportPdfModal(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer"
              title="Ekspor PDF Laporan Penjualan Menu, Pemakaian Bahan Baku & Barang Masuk"
            >
              <FileText className="h-4 w-4" />
              <span>Export PDF Laporan</span>
            </button>
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export Sheet CSV</span>
            </button>
            <button
              onClick={handleResetToDefault}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-extrabold text-xs rounded-xl transition flex items-center space-x-2 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Benchmark</span>
            </button>
          </div>
        </div>

        {/* SUB-NAVIGATION TABS (Aplikasi 2) */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Gabung Semua Modul</span>
          </button>

          <button
            onClick={() => {
              if (activeSubTab === 'all') {
                document.getElementById('sec-pencatatan-harian')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setActiveSubTab('pencatatan_harian');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'pencatatan_harian'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>1. Pencatatan Harian</span>
          </button>

          <button
            onClick={() => {
              if (activeSubTab === 'all') {
                document.getElementById('sec-penjualan-menu')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setActiveSubTab('penjualan_menu');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'penjualan_menu'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>2. Penjualan Menu</span>
          </button>

          <button
            onClick={() => {
              if (activeSubTab === 'all') {
                document.getElementById('sec-kalkulator-cogs')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setActiveSubTab('kalkulator_cogs');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'kalkulator_cogs'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>3. Kalkulator COGS</span>
          </button>

          <button
            onClick={() => {
              if (activeSubTab === 'all') {
                document.getElementById('sec-penggunaan-bahan')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setActiveSubTab('penggunaan_bahan');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'penggunaan_bahan'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>4. Penggunaan Bahan Baku</span>
          </button>

          <button
            onClick={() => {
              if (activeSubTab === 'all') {
                document.getElementById('sec-barang-masuk')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setActiveSubTab('barang_masuk');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'barang_masuk'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <PackagePlus className="h-4 w-4 text-emerald-400" />
            <span>5. Barang Masuk</span>
            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 font-black text-[9px] rounded-full">{incomingBatches.length}</span>
          </button>

          <button
            onClick={() => {
              if (activeSubTab === 'all') {
                document.getElementById('sec-forum-ai-hpp')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setActiveSubTab('forum_ai_hpp');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'forum_ai_hpp'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Bot className="h-4 w-4 text-amber-400" />
            <span>6. Forum AI Database HPP</span>
            <span className="px-1.5 py-0.5 bg-slate-950 text-amber-400 font-black text-[8px] rounded uppercase">AI</span>
          </button>
        </div>
      </div>

      {/* Pilihan Bulan untuk Omset & Summary Keuangan */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-100 text-amber-900 rounded-2xl">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Pilihan Bulan Omset & Keuangan
              </h3>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                {selectedOmsetMonth === 'ALL' ? 'Semua Bulan' : formatMonthLabel(selectedOmsetMonth)}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Pilih bulan untuk memfilter Omset, Total HPP, dan Ringkasan Laba Rugi
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Filter Bulan:</span>
          <select
            value={selectedOmsetMonth}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedOmsetMonth(val);
              setHistoricSelectedMonth(val);
            }}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs min-w-[210px]"
          >
            <option value="ALL">Semua Bulan ({dailySales.length} Hari Terdata)</option>
            {availableMonths.map(ym => (
              <option key={ym} value={ym}>
                🗓️ {formatMonthLabel(ym)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Omset */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Omset ({selectedOmsetMonth === 'ALL' ? 'Semua Bulan' : formatMonthLabel(selectedOmsetMonth)})
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900 font-mono tracking-tight">
            {formatRupiah(omsetBulanan)}
          </p>
          <div className="mt-2 text-[10.5px] text-slate-500 flex items-center justify-between font-semibold">
            <span>Sales: <strong className="text-slate-800">{totalDailyCups} Porsi / Cups</strong></span>
            <span className="text-emerald-700 font-bold">Rp {hargaPerCup.toLocaleString('id-ID')}/Cup</span>
          </div>
        </div>

        {/* Card 2: HPP COGS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Estimasi HPP ({selectedOmsetMonth === 'ALL' ? 'Semua Bulan' : formatMonthLabel(selectedOmsetMonth)})
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Coffee className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900 font-mono tracking-tight">
            {formatRupiah(Math.round(totalEstimasiHPP))}
          </p>
          <div className="mt-2 text-[10.5px] text-slate-500 flex items-center justify-between font-semibold">
            <span>Rasio HPP: <strong className="text-amber-700">{((totalEstimasiHPP / (omsetBulanan || 1)) * 100).toFixed(1)}%</strong></span>
            <span>HPP/Cup: <strong className="text-slate-800">Rp {hppPerCup.toLocaleString('id-ID')}</strong></span>
          </div>
        </div>

        {/* Card 3: Gross Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Gross Profit ({selectedOmsetMonth === 'ALL' ? 'Semua Bulan' : formatMonthLabel(selectedOmsetMonth)})
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900 font-mono tracking-tight">
            {formatRupiah(Math.round(grossProfit))}
          </p>
          <div className="mt-2 text-[10.5px] text-slate-500 flex items-center justify-between font-semibold">
            <span>Gross Margin: <strong className="text-indigo-700">{(marginPersentase * 100).toFixed(1)}%</strong></span>
            <span>Rp {marginPerCup.toLocaleString('id-ID')}/Cup</span>
          </div>
        </div>

        {/* Card 4: Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Net Profit ({selectedOmsetMonth === 'ALL' ? 'Semua Bulan' : formatMonthLabel(selectedOmsetMonth)})
            </span>
            <div className={`p-2 rounded-xl ${netProfit >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className={`text-xl font-black font-mono tracking-tight ${netProfit >= 0 ? 'text-blue-900' : 'text-red-600'}`}>
            {formatRupiah(Math.round(netProfit))}
          </p>
          <div className="mt-2 text-[10.5px] text-slate-500 flex items-center justify-between font-semibold">
            <span>NPM: <strong className="text-blue-700">{((netProfit / (omsetBulanan || 1)) * 100).toFixed(1)}%</strong></span>
            <span>Status: <strong className={netProfit >= targetProfit ? "text-emerald-600 font-black" : "text-amber-600"}>{netProfit >= targetProfit ? "Capai Target" : "Under Target"}</strong></span>
          </div>
        </div>
      </div>

      {/* Kartu Ringkasan Estimasi Laba Bersih Bulanan (Automated Calculation) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Kartu Ringkasan Estimasi Laba Bersih Bulanan
                </h3>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] rounded-full uppercase tracking-wider border border-emerald-500/30">
                  Kalkulasi Otomatis
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Formula Otomatis: Laba Kotor (Gross Profit) - Total Biaya Operasional (Fixed Cost) = Estimasi Laba Bersih (Net Profit)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/60 self-start sm:self-auto">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Periode:</span>
            <span className="text-xs font-black text-amber-400">
              {selectedOmsetMonth === 'ALL' ? 'Semua Bulan Terdata' : formatMonthLabel(selectedOmsetMonth)}
            </span>
          </div>
        </div>

        {/* Formula Steps 3-Column Box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1: Margin Laba Kotor */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2 relative overflow-hidden">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>1. Margin Laba Kotor (GP)</span>
              <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-bold font-mono">
                {(marginPersentase * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-black text-indigo-300 font-mono tracking-tight">
              {formatRupiah(Math.round(grossProfit))}
            </p>
            <div className="text-[10px] text-slate-400 space-y-0.5 pt-1.5 border-t border-slate-700/50">
              <div className="flex justify-between">
                <span>Omset Penjualan:</span>
                <span className="font-mono text-slate-200 font-bold">{formatRupiah(omsetBulanan)}</span>
              </div>
              <div className="flex justify-between">
                <span>(-) Total HPP (COGS):</span>
                <span className="font-mono text-amber-300 font-bold">{formatRupiah(Math.round(totalEstimasiHPP))}</span>
              </div>
            </div>
          </div>

          {/* Step 2: Total Biaya Operasional (Fixed Cost) */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2 relative overflow-hidden">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>2. Total Biaya Operasional</span>
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded font-bold font-mono">
                {((totalBiayaBulanan / (omsetBulanan || 1)) * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-black text-amber-300 font-mono tracking-tight">
              {formatRupiah(totalBiayaBulanan)}
            </p>
            <div className="text-[10px] text-slate-400 space-y-0.5 pt-1.5 border-t border-slate-700/50">
              <div className="flex justify-between">
                <span>Gaji Barista ({biayaList.filter(b => b.kategori === 'Gaji').length} orang):</span>
                <span className="font-mono text-slate-200 font-bold">{formatRupiah(totalGaji)}</span>
              </div>
              <div className="flex justify-between">
                <span>Sewa, Utilitas & Admin:</span>
                <span className="font-mono text-slate-200 font-bold">{formatRupiah(totalSewaUtilitas)}</span>
              </div>
            </div>
          </div>

          {/* Step 3: Estimasi Laba Bersih (Net Profit) */}
          <div className={`p-4 rounded-xl border space-y-2 relative overflow-hidden ${
            netProfit >= 0 
              ? 'bg-emerald-950/40 border-emerald-500/50' 
              : 'bg-rose-950/40 border-rose-500/50'
          }`}>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-300">
              <span>3. Estimasi Laba Bersih</span>
              <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider ${
                netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {netProfit >= 0 ? 'SURPLUS' : 'DEFISIT'}
              </span>
            </div>
            <p className={`text-2xl font-black font-mono tracking-tight ${
              netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatRupiah(Math.round(netProfit))}
            </p>
            <div className="text-[10px] text-slate-300 space-y-0.5 pt-1.5 border-t border-slate-700/50 font-semibold">
              <div className="flex justify-between">
                <span>Net Profit Margin (NPM):</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {((netProfit / (omsetBulanan || 1)) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status Target Laba:</span>
                <span className={netProfit >= targetProfit ? "text-emerald-300 font-black" : "text-amber-300 font-bold"}>
                  {netProfit >= targetProfit ? "Capai Target" : "Under Target"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: PENCATATAN HARIAN */}
      {/* ========================================================================= */}
      {(activeSubTab === 'all' || activeSubTab === 'pencatatan_harian') && (
        <div id="sec-pencatatan-harian" className="space-y-8 scroll-mt-6">
          {/* FORM INPUT CATATAN PENJUALAN & JATAH MENU HARIAN */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    Form Input Catatan Penjualan & Jatah Menu Harian
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Input kuota jatah porsi target dan realisasi porsi terjual per menu harian.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEntryMode('itemized')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      entryMode === 'itemized' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Rincian Per Menu (Jatah & Sales)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode('quick')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      entryMode === 'quick' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Input Total Cepat
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMinFormInput(!isMinFormInput)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  title={isMinFormInput ? "Perluas Modul" : "Minimalkan Modul"}
                >
                  <span>{isMinFormInput ? 'Perluas' : 'Minimize'}</span>
                  {isMinFormInput ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isMinFormInput && (
              <>

            {/* Date Selector Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Pilih Tanggal Laporan</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-extrabold font-mono text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {entryMode === 'itemized' && (
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Terjual:</span>
                    <span className="font-mono font-extrabold text-emerald-800">{itemizedCalculations.totalCups} Porsi</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Jatah Barista:</span>
                    <span className="font-mono font-bold text-slate-900">{itemizedCalculations.totalJatah} Porsi</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Realisasi Jatah Barista:</span>
                    <span className="font-mono font-black text-indigo-700">{itemizedCalculations.fulfillmentPct.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Omset Harian:</span>
                    <span className="font-mono font-black text-slate-900">{formatRupiah(itemizedCalculations.totalOmset)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-600 font-bold block uppercase">Total HPP Harian (Sales + Jatah):</span>
                    <span className="font-mono font-black text-amber-900">{formatRupiah(itemizedCalculations.totalHpp)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 font-bold block uppercase">Margin Laba Kotor Harian:</span>
                    <span className="font-mono font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {formatRupiah(itemizedCalculations.grossProfit)} ({itemizedCalculations.totalOmset > 0 ? ((itemizedCalculations.grossProfit / itemizedCalculations.totalOmset) * 100).toFixed(1) : '0.0'}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* EXCEL IMPORT / DOWNLOAD TEMPLATE BANNER */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/70 p-4 rounded-xl border border-emerald-200/90 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-start space-x-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-emerald-950 text-xs uppercase tracking-wide block">
                      Input & Upload Data via Microsoft Excel (.xlsx / .csv)
                    </span>
                    <span className="bg-emerald-200/90 text-emerald-950 text-[10.5px] font-black px-2 py-0.5 rounded-md border border-emerald-300">
                      Tabel: Tanggal | Nama Menu | Porsi Terjual
                    </span>
                  </div>
                  <p className="text-[11.5px] text-emerald-850 font-medium mt-0.5 leading-relaxed">
                    Template tabel praktis berisi: <strong className="font-bold text-emerald-950">Tanggal</strong>, <strong className="font-bold text-emerald-950">Nama Menu</strong>, dan <strong className="font-bold text-emerald-950">Porsi Terjual</strong>. Download template, isi porsi terjual menu di Excel, lalu upload kembali untuk otomatis terinput ke catatan penjualan harian menu!
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-extrabold rounded-xl text-xs transition cursor-pointer shadow-2xs flex items-center space-x-1.5"
                  title="Download template Excel dengan daftar menu terkini"
                >
                  <Download className="h-4 w-4 text-emerald-700" />
                  <span>Download Template Excel</span>
                </button>

                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleUploadExcelFile}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => excelFileInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center space-x-1.5"
                  title="Upload file Excel porsi jatah & penjualan"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Excel Data</span>
                </button>
              </div>
            </div>

            {/* MODE 1: ITEMIZED PER MENU INPUT */}
            {entryMode === 'itemized' ? (
              <form onSubmit={handleSaveItemizedDaily} className="space-y-4">
                {/* Batch Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2 font-bold text-slate-800">
                    <Sliders className="h-4 w-4 text-amber-600" />
                    <span>Opsi Bantuan Input Penjualan & Jatah Barista:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      autoComplete="off"
                      value={menuSortMode}
                      onChange={(e) => setMenuSortMode(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black rounded-lg text-xs transition cursor-pointer shadow-2xs border border-amber-300"
                      title="Pilih Urutan Tampilan Tabel Menu"
                    >
                      <option value="bestseller_qty">🔥 Urutkan: Paling Laku (Terbanyak → Terbawah)</option>
                      <option value="bestseller_omset">💰 Urutkan: Omset Rp (Terbesar → Terkecil)</option>
                      <option value="bestseller_profit">📈 Urutkan: Gross Profit (Terbesar → Terkecil)</option>
                      <option value="alphabetical">🔤 Urutkan: Abjad (A - Z)</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleFillSalesFromJatah}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs transition cursor-pointer shadow-xs flex items-center space-x-1"
                      title="Isi porsi penjualan harian sama dengan jatah barista"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Isi Sales = Jatah Barista</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSalesToZero}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold rounded-lg text-xs transition cursor-pointer"
                      title="Reset semua porsi terjual menjadi 0"
                    >
                      Reset Sales = 0
                    </button>
                    <button
                      type="button"
                      onClick={handleResetJatahToDefault}
                      className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-extrabold rounded-lg text-xs transition cursor-pointer"
                      title="Reset jatah porsi hari ini menjadi 0"
                    >
                      Reset Jatah Hari Ini = 0
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAllJatahToZeroAllMonths}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center space-x-1"
                      title="Reset jatah barista angka 20 menjadi 0 untuk semua bulan dan menu"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Jatah (Semua Bulan = 0)</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                        <th className="py-2.5 px-3">Menu & Kategori</th>
                        <th className="py-2.5 px-3 text-right">Harga Jual</th>
                        <th className="py-2.5 px-3 text-right">HPP / Unit</th>
                        <th className="py-2.5 px-3 text-center w-36 bg-amber-50/50 text-amber-950 border-x border-amber-100">
                          <div>Penjualan Harian (Terjual)</div>
                          <span className="text-[8.5px] font-medium text-amber-700 normal-case block font-sans">
                            Sync Sheet: Harian Penjualan Menu
                          </span>
                        </th>
                        <th className="py-2.5 px-3 text-center w-32 bg-indigo-50/50 text-indigo-950 border-r border-indigo-100">
                          <div>Jatah Barista (Porsi)</div>
                          <span className="text-[8.5px] font-medium text-indigo-700 normal-case block font-sans">
                            Input Manual & Sync ke Sheet
                          </span>
                        </th>
                        <th className="py-2.5 px-3 text-right">Omset Harian</th>
                        <th className="py-2.5 px-3 text-right text-amber-900 bg-amber-50/40 font-black">
                          HPP Harian (Terjual + Jatah)
                        </th>
                        <th className="py-2.5 px-3 text-center">Realisasi / Jatah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {sortedMenuItems.map(m => {
                        const currentInput = itemizedInputs[m.id] || { jatah: m.defaultJatah, terjual: 0 };
                        const omsetRow = currentInput.terjual * m.hargaJual;
                        // HPP Harian adalah total jumlah dari jatah barista + penjualan
                        const hppRow = (currentInput.terjual + currentInput.jatah) * m.hpp;
                        const pctRow = currentInput.jatah > 0 ? (currentInput.terjual / currentInput.jatah) * 100 : 0;
                        const isFilledSales = currentInput.terjual > 0;
                        const isFilledJatah = currentInput.jatah > 0;
                        const isRowFilled = isFilledSales || isFilledJatah;

                        return (
                          <tr 
                            key={m.id} 
                            className={
                              isRowFilled 
                                ? "bg-emerald-50/30 hover:bg-emerald-100/40 transition-colors" 
                                : "hover:bg-slate-50/80 transition-colors opacity-60"
                            }
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                {isRowFilled && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" title="Menu Terisi"></span>
                                )}
                                <p className={`font-bold ${isRowFilled ? 'text-slate-900 font-black' : 'text-slate-600'}`}>{m.nama}</p>
                              </div>
                              <span className="text-[9px] text-slate-400 uppercase font-semibold">{m.kategori}</span>
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono font-bold ${isRowFilled ? 'text-slate-800' : 'text-slate-400'}`}>
                              Rp {m.hargaJual.toLocaleString('id-ID')}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono ${isRowFilled ? 'text-slate-600' : 'text-slate-400'}`}>
                              Rp {m.hpp.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-center bg-amber-50/30 border-x border-amber-100/60">
                              <input
                                type="number"
                                min="0"
                                value={currentInput.terjual}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  const val = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10) || 0);
                                  setItemizedInputs(prev => {
                                    const next = {
                                      ...prev,
                                      [m.id]: { ...(prev[m.id] || { jatah: m.defaultJatah }), terjual: val }
                                    };
                                    commitItemizedInputsLive(next);
                                    return next;
                                  });
                                }}
                                placeholder="0"
                                className={`w-24 px-2 py-1 rounded text-center font-mono transition-all focus:outline-none ${
                                  isFilledSales 
                                    ? "bg-amber-400 text-amber-950 font-black border-2 border-amber-500 shadow-xs ring-2 ring-amber-300/50" 
                                    : "bg-slate-100/80 text-slate-400 border border-slate-200 hover:bg-white focus:ring-1 focus:ring-amber-400"
                                }`}
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center bg-indigo-50/30 border-r border-indigo-100/60">
                              <input
                                type="number"
                                min="0"
                                value={currentInput.jatah}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  const val = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10) || 0);
                                  setItemizedInputs(prev => {
                                    const next = {
                                      ...prev,
                                      [m.id]: { ...(prev[m.id] || { terjual: 0 }), jatah: val }
                                    };
                                    commitItemizedInputsLive(next);
                                    return next;
                                  });
                                }}
                                placeholder="0"
                                className={`w-20 px-2 py-1 rounded text-center font-mono transition-all focus:outline-none ${
                                  isFilledJatah 
                                    ? "bg-indigo-100 text-indigo-950 font-black border-2 border-indigo-400 shadow-xs ring-2 ring-indigo-300/50" 
                                    : "bg-slate-100/80 text-slate-400 border border-slate-200 hover:bg-white focus:ring-1 focus:ring-indigo-400"
                                }`}
                              />
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono ${isFilledSales ? 'font-extrabold text-emerald-800' : 'text-slate-300 font-normal'}`}>
                              {formatRupiah(omsetRow)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono bg-amber-50/30 ${isRowFilled ? 'font-bold text-amber-900' : 'text-slate-300 font-normal'}`}>
                              {formatRupiah(hppRow)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                !isRowFilled
                                  ? 'bg-slate-100 text-slate-300'
                                  : pctRow >= 100 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : pctRow >= 75
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {pctRow.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-extrabold text-xs border-t-2 border-slate-800">
                      <tr>
                        <td className="py-3 px-3 uppercase text-[11px] text-amber-400 font-black">
                          TOTAL REKAP HARIAN
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">-</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">-</td>
                        <td className="py-3 px-3 text-center font-mono text-emerald-400 font-black text-sm">
                          {itemizedCalculations.totalCups} Porsi
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-amber-300 font-extrabold text-sm">
                          {itemizedCalculations.totalJatah} Porsi
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-300 font-black">
                          {formatRupiah(itemizedCalculations.totalOmset)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-200 font-black">
                          {formatRupiah(itemizedCalculations.totalHpp)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-indigo-300 font-black">
                          {itemizedCalculations.fulfillmentPct.toFixed(0)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-8">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Catatan Shift / Event / Kendala Operasional</label>
                    <input
                      type="text"
                      placeholder="e.g. Shift Malam Rame - Event Nobar / Hujan Pagi"
                      value={dailyNotes}
                      onChange={(e) => setDailyNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4 flex items-end justify-end">
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      <span>Simpan Catatan & Sales Harian</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* MODE 2: QUICK ENTRY FORM */
              <form onSubmit={handleSaveQuickDaily} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Penjualan Harian (Porsi Terjual)</label>
                    <input
                      type="number"
                      min="0"
                      value={quickCups === '0' || quickCups === 0 ? '' : quickCups}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuickCups(val);
                        const c = parseFloat(val) || 0;
                        setQuickOmset((c * hargaPerCup).toString());
                      }}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono font-extrabold text-amber-950 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Jatah Barista (Porsi)</label>
                    <input
                      type="number"
                      min="0"
                      value={quickJatah === '0' || quickJatah === 0 ? '' : quickJatah}
                      onChange={(e) => setQuickJatah(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Total Omset Harian (Rp)</label>
                    <input
                      type="number"
                      value={quickOmset}
                      onChange={(e) => setQuickOmset(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-800 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Catatan Shift / Event</label>
                    <input
                      type="text"
                      placeholder="e.g. Shift Regular"
                      value={dailyNotes}
                      onChange={(e) => setDailyNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Simpan Transaksi Harian Quick</span>
                  </button>
                </div>
              </form>
            )}
            </>
            )}
          </div>

          {/* ========================================================================= */}
          {/* FITUR KOMPARASI PENJUALAN HARIAN VS TOTAL HPP & MARGIN LABA KOTOR HARIAN */}
          {/* ========================================================================= */}
          <div id="sec-komparasi-sales-vs-hpp-harian" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl shadow-xs">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                      Analisis Komparasi Penjualan Harian vs Total HPP & Margin Laba Kotor
                    </h3>
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-900 font-extrabold text-[10px] rounded-full uppercase">
                      Komparasi Visual Laba Kotor
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Hitung total penjualan harian berdasarkan transaksi, bandingkan secara visual dengan HPP total, dan evaluasi persentase margin laba kotor.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Data Selector */}
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
                  <Calendar className="h-4 w-4 text-indigo-600 shrink-0 ml-1" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pilih Data:</span>
                  <select
                    value={selectedComparisonDailyDate}
                    onChange={(e) => setSelectedComparisonDailyDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="LIVE_FORM">📝 Draft Form Input ({formatDateDDMMYYYY(selectedDate)})</option>
                    <option value="AVERAGE_ALL">📊 Rata-Rata Transaksi ({filteredDailySales.length} Hari)</option>
                    <optgroup label="── Riwayat Transaksi Harian ──">
                      {dailySales.map(d => (
                        <option key={d.id} value={d.tanggal}>
                          📅 {formatDateDDMMYYYY(d.tanggal)} ({formatRupiah(d.omset)})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMinComparisonSection(!isMinComparisonSection)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  title={isMinComparisonSection ? "Perluas Modul" : "Minimalkan Modul"}
                >
                  <span>{isMinComparisonSection ? 'Perluas' : 'Minimize'}</span>
                  {isMinComparisonSection ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isMinComparisonSection && (
              <div className="space-y-6">
                {/* Active Selection Banner & Margin Health Status */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Mode Data Aktif:</span>
                    <h4 className="text-xs font-black text-slate-900 flex items-center space-x-2 mt-0.5">
                      <span>{activeCompData.label}</span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-mono">
                        {activeCompData.cups} Porsi
                      </span>
                    </h4>
                  </div>

                  {/* Dynamic Margin Status Badge */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-500">Status Kesehatan Margin Harian:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-2xs ${
                      activeCompData.marginPct >= 65
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : activeCompData.marginPct >= 50
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : activeCompData.marginPct >= 35
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}>
                      <Award className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {activeCompData.marginPct >= 65
                          ? 'Sangat Sehat (≥65%)'
                          : activeCompData.marginPct >= 50
                          ? 'Sehat Normal (50-64%)'
                          : activeCompData.marginPct >= 35
                          ? 'Waspada Margin (35-49%)'
                          : 'Margin Kritis (<35%)'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* 4 KPI Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Total Penjualan Harian */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Total Penjualan (Omset)</span>
                      <div className="p-1.5 bg-white/10 rounded-lg text-emerald-400">
                        <DollarSign className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-xl font-black font-mono tracking-tight text-white">
                      {formatRupiah(activeCompData.omset)}
                    </p>
                    <div className="text-[10.5px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-700/80 font-medium">
                      <span>Total Volume Terjual</span>
                      <strong className="text-emerald-400 font-mono font-bold">{activeCompData.cups} Cups</strong>
                    </div>
                  </div>

                  {/* Card 2: Total HPP Harian */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">Total HPP (COGS)</span>
                      <div className="p-1.5 bg-amber-500 text-slate-950 rounded-lg shadow-2xs">
                        <Utensils className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-xl font-black font-mono tracking-tight text-amber-950">
                      {formatRupiah(Math.round(activeCompData.hpp))}
                    </p>
                    <div className="text-[10.5px] text-amber-900/80 flex items-center justify-between pt-1 border-t border-amber-200 font-semibold">
                      <span>Rasio HPP dari Penjualan</span>
                      <strong className="font-mono font-black text-amber-950">{activeCompData.cogsRatioPct.toFixed(1)}%</strong>
                    </div>
                  </div>

                  {/* Card 3: Laba Kotor Harian (Gross Profit) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-300/80 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900">Laba Kotor Harian</span>
                      <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-2xs">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-xl font-black font-mono tracking-tight text-emerald-950">
                      {formatRupiah(Math.round(activeCompData.grossProfit))}
                    </p>
                    <div className="text-[10.5px] text-emerald-900/80 flex items-center justify-between pt-1 border-t border-emerald-200 font-semibold">
                      <span>Status Surplus</span>
                      <strong className={`font-mono font-black ${activeCompData.grossProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                        {activeCompData.grossProfit >= 0 ? '👍 Untung' : '⚠️ Rugi'}
                      </strong>
                    </div>
                  </div>

                  {/* Card 4: Persentase Margin Laba Kotor Harian */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-300/80 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">% Margin Laba Kotor</span>
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
                        <Target className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex items-baseline space-x-1.5">
                      <p className="text-2xl font-black font-mono tracking-tight text-indigo-950">
                        {activeCompData.marginPct.toFixed(1)}%
                      </p>
                      <span className="text-[10px] text-indigo-700 font-extrabold">/ Target 65%</span>
                    </div>
                    <div className="text-[10.5px] text-indigo-900/80 flex items-center justify-between pt-1 border-t border-indigo-200 font-semibold">
                      <span>Deviasi vs Target</span>
                      <strong className={`font-mono font-black ${
                        activeCompData.marginPct >= 65 ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        {activeCompData.marginPct >= 65 ? '+' : ''}{(activeCompData.marginPct - 65).toFixed(1)}%
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Visual Side-by-Side Dual Bar Ratio Comparison */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <BarChart2 className="h-4 w-4 text-indigo-600" />
                      <h5 className="font-black text-slate-900 uppercase tracking-wide">
                        Komparasi Visual Proporsi Omset Penjualan vs Total HPP
                      </h5>
                    </div>
                    <div className="flex items-center space-x-4 font-bold text-[11px]">
                      <span className="flex items-center space-x-1 text-emerald-800">
                        <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                        <span>Laba Kotor ({activeCompData.marginPct.toFixed(1)}%)</span>
                      </span>
                      <span className="flex items-center space-x-1 text-amber-900">
                        <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
                        <span>Total HPP / COGS ({activeCompData.cogsRatioPct.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>

                  {/* Stacked Ratio Bar */}
                  <div className="w-full h-8 bg-slate-200 rounded-xl overflow-hidden flex shadow-inner relative">
                    <div 
                      style={{ width: `${Math.min(100, Math.max(0, activeCompData.marginPct))}%` }}
                      className="bg-emerald-500 h-full flex items-center justify-center text-white font-mono font-black text-xs transition-all duration-500"
                      title={`Laba Kotor: ${formatRupiah(Math.round(activeCompData.grossProfit))} (${activeCompData.marginPct.toFixed(1)}%)`}
                    >
                      {activeCompData.marginPct > 15 && `${activeCompData.marginPct.toFixed(1)}% Laba`}
                    </div>
                    <div 
                      style={{ width: `${Math.min(100, Math.max(0, activeCompData.cogsRatioPct))}%` }}
                      className="bg-amber-500 h-full flex items-center justify-center text-slate-950 font-mono font-black text-xs transition-all duration-500"
                      title={`Total HPP: ${formatRupiah(Math.round(activeCompData.hpp))} (${activeCompData.cogsRatioPct.toFixed(1)}%)`}
                    >
                      {activeCompData.cogsRatioPct > 15 && `${activeCompData.cogsRatioPct.toFixed(1)}% HPP`}
                    </div>

                    {/* 65% Target Marker */}
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10"
                      style={{ left: '65%' }}
                      title="Target Ideal Margin Laba Kotor: 65%"
                    >
                      <div className="absolute -top-1 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black px-1 rounded">
                        65%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-semibold pt-1">
                    <span>Rp 0 Penjualan</span>
                    <span>Target Ideal Margin: <strong>≥ 65.0%</strong></span>
                    <span>Total Omset: <strong>{formatRupiah(activeCompData.omset)}</strong></span>
                  </div>

                  {/* Smart Insight Box */}
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-start space-x-3 text-xs">
                    <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-indigo-950">
                      <span className="font-black text-[11px] uppercase tracking-wide block">💡 Insight Profitabilitas Harian:</span>
                      <p className="text-[11.5px] leading-relaxed">
                        {activeCompData.marginPct >= 65
                          ? `Luar biasa! Margin laba kotor harian Anda (${activeCompData.marginPct.toFixed(1)}%) berada di atas target ideal 65.0%. Pengendalian HPP per cup sangat efisien.`
                          : activeCompData.marginPct >= 50
                          ? `Margin laba kotor harian (${activeCompData.marginPct.toFixed(1)}%) tergolong sehat. Evaluasi porsi menu dengan HPP tinggi untuk meningkatkan margin mendekati target 65%.`
                          : activeCompData.marginPct >= 35
                          ? `Perhatian! Margin laba kotor harian (${activeCompData.marginPct.toFixed(1)}%) berada di bawah standar ideal. Pertimbangkan penyesuaian harga jual atau negosiasi harga bahan baku.`
                          : `Peringatan! Margin laba kotor harian (${activeCompData.marginPct.toFixed(1)}%) sangat rendah/kritis. Cek resep & porsi jatah barista agar HPP tidak menggerus keuntungan cafe.`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Matrix Table: Komparasi Penjualan & Margin Semua Hari Terdata */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-900">
                        Tabel Matrix Komparasi Penjualan & Margin Laba Kotor Harian
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Perbandingan nominal penjualan, total HPP, laba kotor, dan % margin laba kotor per hari transaksi.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Urutkan:</span>
                      <select
                        value={comparisonDailySortMode}
                        onChange={(e) => setComparisonDailySortMode(e.target.value as any)}
                        className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        <option value="date_desc">📅 Tanggal (Terbaru → Terlama)</option>
                        <option value="sales_desc">💰 Total Penjualan (Terbesar → Terkecil)</option>
                        <option value="profit_desc">📈 Laba Kotor (Terbesar → Terkecil)</option>
                        <option value="margin_desc">🎯 % Margin Laba Kotor (Tertinggi → Terendah)</option>
                        <option value="hpp_desc">📦 Total HPP (Terbesar → Terkecil)</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/90 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3 text-right">Porsi/Cups</th>
                          <th className="py-2.5 px-3 text-right">Total Penjualan (Omset)</th>
                          <th className="py-2.5 px-3 text-right">Total HPP (COGS)</th>
                          <th className="py-2.5 px-3 text-right">Laba Kotor (Rp)</th>
                          <th className="py-2.5 px-3 text-right">% Margin Laba Kotor</th>
                          <th className="py-2.5 px-3 text-center">Visual Ratio (Omset vs HPP)</th>
                          <th className="py-2.5 px-3 text-center">Pilih</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                        {/* Row 1: Current Form Draft */}
                        <tr className="bg-indigo-50/40 hover:bg-indigo-100/40 transition-colors font-semibold">
                          <td className="py-2.5 px-3 font-mono font-black text-indigo-950 flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                            <span>Draft Input ({formatDateDDMMYYYY(selectedDate)})</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{itemizedCalculations.totalCups}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                            {formatRupiah(itemizedCalculations.totalOmset)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900">
                            {formatRupiah(itemizedCalculations.totalHpp)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800">
                            {formatRupiah(itemizedCalculations.grossProfit)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {(() => {
                              const m = itemizedCalculations.totalOmset > 0 
                                ? (itemizedCalculations.grossProfit / itemizedCalculations.totalOmset) * 100 
                                : 0;
                              return (
                                <span className={`px-2 py-0.5 rounded font-mono font-black text-xs ${
                                  m >= 65 ? 'bg-emerald-100 text-emerald-900' : m >= 50 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                                }`}>
                                  {m.toFixed(1)}%
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="w-24 h-3 bg-slate-200 rounded-full mx-auto overflow-hidden flex shadow-inner">
                              <div 
                                style={{ width: `${Math.min(100, Math.max(0, itemizedCalculations.totalOmset > 0 ? (itemizedCalculations.grossProfit / itemizedCalculations.totalOmset) * 100 : 0))}%` }}
                                className="bg-emerald-500 h-full"
                              ></div>
                              <div 
                                style={{ width: `${Math.min(100, Math.max(0, itemizedCalculations.totalOmset > 0 ? (itemizedCalculations.totalHpp / itemizedCalculations.totalOmset) * 100 : 0))}%` }}
                                className="bg-amber-500 h-full"
                              ></div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedComparisonDailyDate('LIVE_FORM')}
                              className={`px-2 py-1 rounded text-[10px] font-black uppercase transition cursor-pointer ${
                                selectedComparisonDailyDate === 'LIVE_FORM'
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200'
                              }`}
                            >
                              {selectedComparisonDailyDate === 'LIVE_FORM' ? 'Aktif' : 'Pilih'}
                            </button>
                          </td>
                        </tr>

                        {/* Rows from Historic Daily Sales */}
                        {sortedDailyComparisonList.map(rec => {
                          const hppEst = rec.hppTotal || (rec.cups * hppPerCup);
                          const gpEst = rec.omset - hppEst;
                          const marginPct = rec.omset > 0 ? (gpEst / rec.omset) * 100 : 0;
                          const cogsRatio = rec.omset > 0 ? (hppEst / rec.omset) * 100 : 0;
                          const isSelected = selectedComparisonDailyDate === rec.tanggal;

                          return (
                            <tr key={rec.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-amber-50/60 font-semibold' : ''}`}>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {formatDateDDMMYYYY(rec.tanggal)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{rec.cups}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">{formatRupiah(rec.omset)}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900">{formatRupiah(Math.round(hppEst))}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800">{formatRupiah(Math.round(gpEst))}</td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`px-2 py-0.5 rounded font-mono font-black text-xs ${
                                  marginPct >= 65 ? 'bg-emerald-100 text-emerald-900' : marginPct >= 50 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                                }`}>
                                  {marginPct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="w-24 h-3 bg-slate-200 rounded-full mx-auto overflow-hidden flex shadow-inner" title={`Laba ${marginPct.toFixed(1)}% | HPP ${cogsRatio.toFixed(1)}%`}>
                                  <div style={{ width: `${Math.min(100, Math.max(0, marginPct))}%` }} className="bg-emerald-500 h-full"></div>
                                  <div style={{ width: `${Math.min(100, Math.max(0, cogsRatio))}%` }} className="bg-amber-500 h-full"></div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedComparisonDailyDate(rec.tanggal)}
                                  className={`px-2 py-1 rounded text-[10px] font-black uppercase transition cursor-pointer ${
                                    isSelected ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  {isSelected ? 'Aktif' : 'Pilih'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* GRAFIK & ANALISIS TREN HARIAN / BULANAN */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Grafik Tren Penjualan & Margin ({chartViewType === 'daily' ? 'Harian' : 'Agregat Bulanan'})
                  </h3>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[10px] rounded-full uppercase">
                    {selectedOmsetMonth === 'ALL' ? 'Semua Bulan' : formatMonthLabel(selectedOmsetMonth)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  Visualisasi Omset, Estimasi HPP, dan Gross Profit {chartViewType === 'daily' ? 'per Hari' : 'per Bulan'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Month Filter Selector */}
                <select
                  value={selectedOmsetMonth}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedOmsetMonth(val);
                    setHistoricSelectedMonth(val);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">🗓️ Semua Bulan ({dailySales.length} Hari)</option>
                  {availableMonths.map(ym => (
                    <option key={ym} value={ym}>🗓️ {formatMonthLabel(ym)}</option>
                  ))}
                </select>

                {/* View Mode Switcher: Daily vs Monthly */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setChartViewType('daily')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      chartViewType === 'daily'
                        ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📅 Tren Harian
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewType('monthly')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      chartViewType === 'monthly'
                        ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📊 Agregat Bulanan
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMinChart(!isMinChart)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  title={isMinChart ? "Perluas Modul" : "Minimalkan Modul"}
                >
                  <span>{isMinChart ? 'Perluas' : 'Minimize'}</span>
                  {isMinChart ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isMinChart && (
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="tanggal" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                    <RechartsTooltip 
                      formatter={(value: any, name: any) => [
                        typeof value === 'number' ? formatRupiah(value) : value, 
                        name === 'Omset' ? 'Nominal Omset' : name === 'HPP' ? 'Total HPP' : 'Gross Profit'
                      ]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <Bar dataKey="Omset" fill="#0f172a" radius={[4, 4, 0, 0]} name="Omset" />
                    <Bar dataKey="HPP" fill="#f59e0b" radius={[4, 4, 0, 0]} name="HPP" />
                    <Line type="monotone" dataKey="GrossProfit" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="Gross Profit" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 🏆 PERINGKAT MENU PALING LAKU (BEST SELLERS LEADERBOARD) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500 text-slate-900 rounded-2xl shadow-xs">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      🏆 Peringkat Menu Paling Laku (Best Sellers Leaderboard)
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[10px] rounded-full uppercase">
                      {menuBestSellerList.rankedList.length} Menu
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    Urutan menu terlaris dari porsi terbanyak sampai terbawah untuk {selectedOmsetMonth === 'ALL' ? 'Semua Bulan' : formatMonthLabel(selectedOmsetMonth)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Sync Month Selector */}
                <select
                  value={selectedOmsetMonth}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedOmsetMonth(val);
                    setHistoricSelectedMonth(val);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">🗓️ Semua Bulan ({dailySales.length} Hari)</option>
                  {availableMonths.map(ym => (
                    <option key={ym} value={ym}>🗓️ {formatMonthLabel(ym)}</option>
                  ))}
                </select>

                {/* Sort Selector */}
                <select
                  autoComplete="off"
                  value={menuSortMode}
                  onChange={(e) => setMenuSortMode(e.target.value as any)}
                  className="px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-xl text-xs font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                >
                  <option value="bestseller_qty">🔥 Urutkan: Porsi Terjual (Terbanyak → Terbawah)</option>
                  <option value="bestseller_omset">💰 Urutkan: Omset Rp (Terbesar → Terkecil)</option>
                  <option value="bestseller_profit">📈 Urutkan: Gross Profit Rp (Terbesar → Terkecil)</option>
                  <option value="alphabetical">🔤 Urutkan: Abjad (A - Z)</option>
                </select>
              </div>
            </div>

            {/* Top 3 Best Sellers Showcase Cards */}
            {menuBestSellerList.rankedList.length >= 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* #1 Gold */}
                {(() => {
                  const m1 = menuBestSellerList.rankedList[0];
                  if (!m1) return null;
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/60 relative overflow-hidden shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider shadow-2xs">
                          <span>🥇 Champion #1</span>
                        </span>
                        <span className="text-[11px] font-mono font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-lg">
                          {m1.totalTerjual} Porsi ({m1.sharePct.toFixed(1)}%)
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 truncate">{m1.nama}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">{m1.kategori}</p>
                      <div className="mt-3 pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-bold">Omset Generated:</span>
                        <span className="font-mono font-black text-slate-900">{formatRupiah(m1.totalOmset)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* #2 Silver */}
                {(() => {
                  const m2 = menuBestSellerList.rankedList[1];
                  if (!m2) return null;
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent border-2 border-slate-300 relative overflow-hidden shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-300 text-slate-900 font-black text-[10px] rounded-full uppercase tracking-wider shadow-2xs">
                          <span>🥈 Runner Up #2</span>
                        </span>
                        <span className="text-[11px] font-mono font-black text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded-lg">
                          {m2.totalTerjual} Porsi ({m2.sharePct.toFixed(1)}%)
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 truncate">{m2.nama}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">{m2.kategori}</p>
                      <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-bold">Omset Generated:</span>
                        <span className="font-mono font-black text-slate-900">{formatRupiah(m2.totalOmset)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* #3 Bronze */}
                {(() => {
                  const m3 = menuBestSellerList.rankedList[2];
                  if (!m3) return null;
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-700/10 via-amber-700/5 to-transparent border-2 border-amber-600/40 relative overflow-hidden shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-700/20 text-amber-950 font-black text-[10px] rounded-full uppercase tracking-wider shadow-2xs">
                          <span>🥉 Third Place #3</span>
                        </span>
                        <span className="text-[11px] font-mono font-black text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded-lg">
                          {m3.totalTerjual} Porsi ({m3.sharePct.toFixed(1)}%)
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 truncate">{m3.nama}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">{m3.kategori}</p>
                      <div className="mt-3 pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-bold">Omset Generated:</span>
                        <span className="font-mono font-black text-slate-900">{formatRupiah(m3.totalOmset)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Search Input for Leaderboard */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-md">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari nama menu dalam peringkat..."
                  value={bestsellerSearchQuery}
                  onChange={(e) => setBestsellerSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="text-right text-[11px] font-bold text-slate-500">
                Total Penjualan: <span className="text-slate-900 font-mono font-black">{menuBestSellerList.grandTotalCups} Cups</span> ({formatRupiah(menuBestSellerList.grandTotalOmset)})
              </div>
            </div>

            {/* Detailed Leaderboard Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3.5 text-center w-14">Rank</th>
                    <th className="py-2.5 px-3">Menu & Kategori</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                    <th className="py-2.5 px-3 text-center w-48">Kontribusi Penjualan</th>
                    <th className="py-2.5 px-3 text-right font-black bg-amber-50 text-amber-950 border-x border-amber-100">
                      Porsi Terjual
                    </th>
                    <th className="py-2.5 px-3 text-right">Nominal Omset (Rp)</th>
                    <th className="py-2.5 px-3 text-right text-emerald-900 bg-emerald-50/50">Gross Profit (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {menuBestSellerList.rankedList
                    .filter(m => m.nama.toLowerCase().includes(bestsellerSearchQuery.toLowerCase()) || m.kategori.toLowerCase().includes(bestsellerSearchQuery.toLowerCase()))
                    .map((m, idx) => {
                      const rankNum = idx + 1;
                      const isTop1 = rankNum === 1;
                      const isTop2 = rankNum === 2;
                      const isTop3 = rankNum === 3;

                      return (
                        <tr 
                          key={m.id} 
                          className={
                            isTop1 
                              ? "bg-amber-50/50 hover:bg-amber-100/60 font-semibold" 
                              : isTop2 
                              ? "bg-slate-50/80 hover:bg-slate-100/80" 
                              : isTop3 
                              ? "bg-amber-50/20 hover:bg-amber-100/30" 
                              : "hover:bg-slate-50 transition-colors"
                          }
                        >
                          <td className="py-2.5 px-3.5 text-center font-mono font-black">
                            {isTop1 ? (
                              <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black rounded-lg text-xs shadow-2xs">#1 🥇</span>
                            ) : isTop2 ? (
                              <span className="px-2 py-0.5 bg-slate-300 text-slate-900 font-black rounded-lg text-xs shadow-2xs">#2 🥈</span>
                            ) : isTop3 ? (
                              <span className="px-2 py-0.5 bg-amber-700/30 text-amber-950 font-black rounded-lg text-xs shadow-2xs">#3 🥉</span>
                            ) : (
                              <span className="text-slate-500 font-bold">#{rankNum}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className={`font-bold ${isTop1 ? 'text-amber-950 text-sm font-black' : 'text-slate-900'}`}>{m.nama}</p>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">{m.kategori}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            Rp {m.hargaJual.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span className="text-slate-500">{m.sharePct.toFixed(1)}% dari total</span>
                                <span className="font-mono text-slate-800">{m.totalTerjual} cups</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isTop1 ? 'bg-amber-500' : isTop2 ? 'bg-slate-500' : isTop3 ? 'bg-amber-700' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(2, m.sharePct))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-amber-900 bg-amber-50/50 border-x border-amber-100">
                            {m.totalTerjual} Porsi
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            Rp {m.totalOmset.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                            Rp {m.grossProfit.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* HISTORIS RIWAYAT PENJUALAN HARIAN */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Tabel Data Penjualan & Jatah Barista Harian Historic
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  Daftar rekapitulasi harian beserta rincian itemized per menu
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Search Box Input */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari tanggal, shift, menu..."
                    value={historicSearchQuery}
                    onChange={(e) => setHistoricSearchQuery(e.target.value)}
                    className="pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44 sm:w-56"
                  />
                  {historicSearchQuery && (
                    <button
                      onClick={() => setHistoricSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black cursor-pointer px-1"
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Pilihan Bulan Selector */}
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                  <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <select
                    value={historicSelectedMonth}
                    onChange={(e) => setHistoricSelectedMonth(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Bulan</option>
                    {availableMonths.map(ym => (
                      <option key={ym} value={ym}>
                        {formatMonthLabel(ym)}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-[10px] font-mono font-extrabold px-2.5 py-1.5 bg-slate-100 rounded-xl text-slate-700 whitespace-nowrap">
                  {filteredDailySales.length} / {dailySales.length} Hari
                </span>

                <button
                  type="button"
                  onClick={() => setShowSalesCogsReportPdfModal(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  title="Export Laporan PDF (Penjualan Menu, Pemakaian Bahan Baku & Barang Masuk)"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Export PDF Laporan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMinHistoric(!isMinHistoric)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  title={isMinHistoric ? "Perluas Modul" : "Minimalkan Modul"}
                >
                  <span>{isMinHistoric ? 'Perluas' : 'Minimize'}</span>
                  {isMinHistoric ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isMinHistoric && (
              <>
                <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3">Tanggal (TGL/BLN/THN)</th>
                    <th className="py-3 px-3 text-right">Porsi/Cups</th>
                    <th className="py-3 px-3 text-right">Nominal Omset (Rp)</th>
                    <th className="py-3 px-3 text-right">Total HPP (Rp)</th>
                    <th className="py-3 px-3 text-right">Gross Profit (Rp)</th>
                    <th className="py-3 px-3 text-right">% Margin Kotor</th>
                    <th className="py-3 px-3">Catatan / Shift</th>
                    <th className="py-3 px-3 text-center">Detail Menu</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {filteredDailySales.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400 text-xs font-medium">
                        {dailySales.length === 0 
                          ? 'Belum ada data penjualan harian.' 
                          : 'Tidak ada data penjualan harian yang sesuai dengan filter bulan atau pencarian.'}
                      </td>
                    </tr>
                  ) : (
                    filteredDailySales.map(rec => {
                      const hppEst = rec.hppTotal || (rec.cups * hppPerCup);
                      const gpEst = rec.omset - hppEst;
                      const isExpanded = expandedDailyId === rec.id;

                      return (
                        <React.Fragment key={rec.id}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900 whitespace-nowrap">
                              {formatDateDDMMYYYY(rec.tanggal)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-800">
                              {rec.cups}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-800">
                              {formatRupiah(rec.omset)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                              {formatRupiah(Math.round(hppEst))}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                              {formatRupiah(Math.round(gpEst))}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black">
                              {(() => {
                                const marginPct = rec.omset > 0 ? (gpEst / rec.omset) * 100 : 0;
                                return (
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    marginPct >= 65 ? 'bg-emerald-100 text-emerald-900' : marginPct >= 50 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                                  }`}>
                                    {marginPct.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate text-[11px]">
                              {rec.notes || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {rec.menuSales && rec.menuSales.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedDailyId(isExpanded ? null : rec.id)}
                                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] rounded border border-amber-200 transition cursor-pointer flex items-center justify-center space-x-1 mx-auto"
                                >
                                  <span>{rec.menuSales.length} Menu</span>
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-bold">Ringkasan</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditDaily(rec)}
                                  className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  title="Edit Penjualan & Jatah"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDaily(rec.id)}
                                  className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Hapus"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Menu Breakdown Row */}
                          {isExpanded && rec.menuSales && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={9} className="p-4">
                                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                                  <span className="text-[10px] font-black uppercase text-slate-500 block">
                                    Rincian Jatah Barista & Realisasi Menu ({formatDateDDMMYYYY(rec.tanggal)})
                                  </span>

                                  {(() => {
                                    const activeItems = rec.menuSales.filter(ms => (ms.jatah || 0) > 0 || (ms.terjual || 0) > 0);
                                    if (activeItems.length === 0) {
                                      return (
                                        <p className="text-[11px] text-slate-400 italic py-1">
                                          Tidak ada menu dengan porsi jatah barista atau porsi terjual pada tanggal ini.
                                        </p>
                                      );
                                    }
                                    return (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                                        {activeItems.map((ms, idx) => {
                                          const pct = ms.jatah > 0 ? (ms.terjual / ms.jatah) * 100 : 0;
                                          return (
                                            <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                              <p className="font-bold text-slate-800 text-[11px] truncate">{ms.nama}</p>
                                              <div className="flex justify-between items-center text-[10.5px] mt-1 font-mono">
                                                <span className="font-extrabold text-slate-900">Sold: {ms.terjual} ({pct.toFixed(0)}%)</span>
                                                <span className="text-slate-500">Jatah Barista: {ms.jatah}</span>
                                              </div>
                                              <p className="text-[10px] text-emerald-700 font-bold text-right mt-0.5">
                                                Omset: {formatRupiah(ms.terjual * ms.hargaJual)}
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-extrabold text-xs border-t-2 border-slate-800">
                  <tr>
                    <td className="py-3 px-3 uppercase text-[10px] text-amber-400 font-black">
                      TOTAL / AVG HISTORIC
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-black">
                      {filteredDailySales.reduce((acc, d) => acc + d.cups, 0)} Porsi
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-300 font-black">
                      {formatRupiah(filteredDailySales.reduce((acc, d) => acc + d.omset, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-200 font-black">
                      {formatRupiah(Math.round(filteredDailySales.reduce((acc, d) => acc + (d.hppTotal || (d.cups * hppPerCup)), 0)))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-indigo-300 font-black">
                      {formatRupiah(Math.round(
                        filteredDailySales.reduce((acc, d) => acc + d.omset, 0) - 
                        filteredDailySales.reduce((acc, d) => acc + (d.hppTotal || (d.cups * hppPerCup)), 0)
                      ))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-black">
                      {(() => {
                        const totO = filteredDailySales.reduce((acc, d) => acc + d.omset, 0);
                        const totH = filteredDailySales.reduce((acc, d) => acc + (d.hppTotal || (d.cups * hppPerCup)), 0);
                        const margin = totO > 0 ? ((totO - totH) / totO) * 100 : 0;
                        return `${margin.toFixed(1)}%`;
                      })()}
                    </td>
                    <td colSpan={3} className="py-3 px-3 text-slate-400 font-medium text-[11px] text-center">
                      {filteredDailySales.length} Hari Terdata
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: PENJUALAN MENU (KATALOG SHEET & PRICING) */}
      {/* ========================================================================= */}
      {(activeSubTab === 'all' || activeSubTab === 'penjualan_menu') && (
        <div id="sec-penjualan-menu" className="space-y-6 scroll-mt-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    Sheet Data Menu & HPP (Price & Cost Catalog)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Daftar menu, harga jual, HPP per item, serta jatah barista default yang menjadi acuan penginputan realisasi.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (activeSubTab === 'all') {
                      document.getElementById('sec-forum-ai-hpp')?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      setActiveSubTab('forum_ai_hpp');
                    }
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                  title="Tanyakan analisis HPP & resep menu ke Forum AI"
                >
                  <Bot className="h-4 w-4 text-slate-950" />
                  <span>Forum Tanya AI HPP</span>
                </button>
                <button
                  onClick={applyWeightedAverageToMaster}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center space-x-1.5 cursor-pointer"
                  title="Terapkan rata-rata terbobot harga & HPP katalog ke parameter master"
                >
                  <Award className="h-3.5 w-3.5 text-amber-600" />
                  <span>Gunakan Avg Catalog (Rp {weightedAvgPrices.avgHarga.toLocaleString('id-ID')} / HPP Rp {weightedAvgPrices.avgHpp.toLocaleString('id-ID')})</span>
                </button>
                <button
                  onClick={() => setShowSalesCogsReportPdfModal(true)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  title="Export PDF Laporan Penjualan Menu, Pemakaian Bahan Baku & Barang Masuk"
                >
                  <FileText className="h-4 w-4" />
                  <span>Export PDF Laporan</span>
                </button>
                <button
                  onClick={() => {
                    setEditingMenuItemId(null);
                    setNewMenuNama('');
                    setNewMenuHarga('20000');
                    setNewMenuHpp('0');
                    setNewMenuJatah('0');
                    setNewMenuRecipe([]);
                    setFormRecipeIngId('');
                    setShowAddMenuModal(true);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Menu Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinCatalog(!isMinCatalog)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer ml-1"
                  title={isMinCatalog ? "Perluas Modul" : "Minimalkan Modul"}
                >
                  <span>{isMinCatalog ? 'Perluas' : 'Minimize'}</span>
                  {isMinCatalog ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isMinCatalog && (
              <>

            {/* Google Sheets Cloud Connection Status & Sync Banner */}
            <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-emerald-950">
                      {spreadsheetName ? `Spreadsheet Connected: ${spreadsheetName}` : 'Spreadsheet Synchronized'}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-black uppercase flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      <span>Cloud Sync Active</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80 font-medium mt-0.5">
                    Data menu & penjualan harian otomatis tersinkron ke Google Sheets agar dapat diakses dari PC manapun.
                    {lastSyncTime && ` Terakhir disinkronkan: ${lastSyncTime}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {spreadsheetId && token && (
                  <button
                    type="button"
                    onClick={() => syncDataToCloud()}
                    disabled={isSyncingSheet}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSheet ? 'Menyinkronkan...' : 'Sinkronkan Cloud'}</span>
                  </button>
                )}

                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-300 transition flex items-center space-x-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Buka Google Sheets</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleExportDataSheetJSON}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-200 transition flex items-center space-x-1.5 cursor-pointer"
                  title="Ekspor file cadangan data menu & hpp"
                >
                  <Download className="h-3.5 w-3.5 text-slate-600" />
                  <span>Ekspor Backup (.json)</span>
                </button>

                <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-200 transition flex items-center space-x-1.5 cursor-pointer">
                  <Upload className="h-3.5 w-3.5 text-slate-600" />
                  <span>Impor Backup</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportDataSheetJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Form Add Menu Baru (Top of table when creating new menu) */}
            {showAddMenuModal && !editingMenuItemId && (
              <form onSubmit={handleSaveMenu} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Tambah Menu Baru ke Catalog Sheet
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddMenuModal(false)}
                    className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                  >
                    Batal
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nama Menu</label>
                    <input
                      type="text"
                      placeholder="e.g. Kopi Susu Aren"
                      value={newMenuNama}
                      onChange={(e) => setNewMenuNama(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Kategori</label>
                    <select
                      value={newMenuKategori}
                      onChange={(e) => setNewMenuKategori(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="Minuman">Minuman</option>
                      <option value="Makanan">Makanan</option>
                      <option value="Snack">Snack</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Harga Jual (Rp)</label>
                    <input
                      type="number"
                      value={newMenuHarga}
                      onChange={(e) => setNewMenuHarga(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                      <span>HPP / COGS (Rp)</span>
                      {newMenuRecipe.length > 0 && (
                        <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1 rounded">AUTO</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={newMenuHpp}
                      onChange={(e) => setNewMenuHpp(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-extrabold focus:outline-none text-amber-900 bg-amber-50/50"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Jatah Barista Default (Porsi)</label>
                    <input
                      type="number"
                      value={newMenuJatah}
                      onChange={(e) => setNewMenuJatah(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Sub-form Input Komposisi Resep & Kalkulator COGS */}
                <div className="bg-white p-3.5 border border-amber-200/90 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <Utensils className="h-4 w-4 text-amber-700" />
                      <span className="text-xs font-black uppercase tracking-wide text-slate-800">
                        Input Komposisi Resep (COGS Terhitung Otomatis)
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-amber-950 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center space-x-1.5">
                      <span>Total HPP Resep:</span>
                      <strong className="font-mono text-sm text-amber-900 font-extrabold">
                        Rp {newMenuRecipe.reduce((sum, r) => {
                          const ing = findIngredientHelper(ingredients, r.ingredientId);
                          return ing ? sum + calculateRecipeItemCost(ing, r.takaran) : sum;
                        }, 0).toLocaleString('id-ID')}
                      </strong>
                    </div>
                  </div>

                  {/* Inputs for adding ingredient to recipe draft */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Pilih Bahan Baku Terinput
                      </label>
                      <select
                        value={formRecipeIngId}
                        onChange={(e) => setFormRecipeIngId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                      >
                        <option value="">-- Pilih Bahan Baku ({ingredients.length} Tersedia) --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.namaBahan} (Harga: Rp {ing.hargaBeli.toLocaleString('id-ID')} / {ing.satuanBeli})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Takaran Resep
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="18"
                        value={formRecipeTakaran}
                        onChange={(e) => setFormRecipeTakaran(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleAddIngredientToDraftRecipe}
                        className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah Ke Resep</span>
                      </button>
                    </div>
                  </div>

                  {/* List of draft recipe ingredients */}
                  {newMenuRecipe.length > 0 ? (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                            <th className="py-1.5 px-2.5">Bahan Baku (Terpilih)</th>
                            <th className="py-1.5 px-2.5 text-center">Takaran Resep</th>
                            <th className="py-1.5 px-2.5 text-right">Biaya HPP Kontribusi</th>
                            <th className="py-1.5 px-2.5 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                          {newMenuRecipe.map((r, rIdx) => {
                            const ing = findIngredientHelper(ingredients, r.ingredientId);
                            if (!ing) {
                              return (
                                <tr key={`${r.ingredientId}-${rIdx}`} className="bg-red-50 text-red-900 border-b border-red-100">
                                  <td className="py-1.5 px-2.5 font-bold text-red-700 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
                                    <span>Bahan Tidak Ditemukan ({r.ingredientId})</span>
                                  </td>
                                  <td className="py-1.5 px-2.5 text-center font-mono text-red-700 font-bold">{r.takaran}</td>
                                  <td className="py-1.5 px-2.5 text-right font-mono text-slate-400">Rp 0</td>
                                  <td className="py-1.5 px-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveIngredientFromDraftRecipe(rIdx)}
                                      className="p-1 text-red-600 hover:text-red-900 transition cursor-pointer"
                                      title="Hapus dari resep"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                            const cost = calculateRecipeItemCost(ing, r.takaran);

                            return (
                              <tr key={`${r.ingredientId}-${rIdx}`} className="hover:bg-slate-50">
                                <td className="py-1.5 px-2.5 font-bold text-slate-900">{ing.namaBahan}</td>
                                <td className="py-1.5 px-2.5 text-center font-mono font-bold text-amber-900">
                                  <span className="px-2 py-0.5 bg-amber-100 rounded text-[11px]">
                                    {r.takaran} {ing.satuanTakaran}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-amber-900">
                                  Rp {Math.round(cost).toLocaleString('id-ID')}
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIngredientFromDraftRecipe(rIdx)}
                                    className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                    title="Hapus bahan dari resep"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic text-center py-2.5 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      Belum ada komposisi resep. Pilih bahan baku di atas untuk menghitung COGS / HPP menu ini secara otomatis.
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Simpan Menu Baru
                  </button>
                </div>
              </form>
            )}

            {/* CATEGORY FILTER & SORTING TABS FOR MENU CATALOG */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Filter Kategori:
                </span>
                <button
                  type="button"
                  onClick={() => setCatalogCategoryFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                    catalogCategoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Semua ({menuItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogCategoryFilter('Minuman')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                    catalogCategoryFilter === 'Minuman'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                  }`}
                >
                  🥤 Minuman ({menuItems.filter(m => m.kategori === 'Minuman').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogCategoryFilter('Makanan')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                    catalogCategoryFilter === 'Makanan'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200'
                  }`}
                >
                  🍔 Food ({menuItems.filter(m => m.kategori === 'Makanan').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogCategoryFilter('Snack')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                    catalogCategoryFilter === 'Snack'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-orange-50 border border-slate-200'
                  }`}
                >
                  🍟 Snack ({menuItems.filter(m => m.kategori === 'Snack').length})
                </button>
              </div>

              {/* URUTAN PILIHAN SORTING MENU */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <ArrowUpDown className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-[10px] font-black uppercase text-slate-600 whitespace-nowrap">Urutkan Data:</span>
                  <select
                    ref={catalogSortSelectRef}
                    autoComplete="off"
                    value={catalogSortOption}
                    onChange={(e) => setCatalogSortOption(e.target.value as CatalogSortOption)}
                    className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="margin_pct_desc">📊 Margin % (Tertinggi ➔ Terendah)</option>
                    <option value="margin_pct_asc">📊 Margin % (Terendah ➔ Tertinggi)</option>
                    <option value="margin_desc">📈 Margin Rp (Tertinggi ➔ Terendah)</option>
                    <option value="margin_asc">📉 Margin Rp (Terendah ➔ Tertinggi)</option>
                    <option value="harga_desc">💰 Harga Jual (Tertinggi ➔ Terendah)</option>
                    <option value="harga_asc">💰 Harga Jual (Terendah ➔ Tertinggi)</option>
                    <option value="hpp_desc">🏷️ HPP / COGS (Tertinggi ➔ Terendah)</option>
                    <option value="hpp_asc">🏷️ HPP / COGS (Terendah ➔ Tertinggi)</option>
                    <option value="nama_asc">🔤 Nama Menu (A ➔ Z)</option>
                    <option value="nama_desc">🔤 Nama Menu (Z ➔ A)</option>
                  </select>
                </div>

                <div className="text-[11px] text-slate-500 font-bold hidden sm:block">
                  <strong>{catalogFilteredMenuItems.length}</strong> menu
                </div>
              </div>
            </div>

            {/* Menu Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => setCatalogSortOption(prev => prev === 'nama_asc' ? 'nama_desc' : 'nama_asc')}
                        className="inline-flex items-center space-x-1 uppercase tracking-wider hover:text-amber-700 transition cursor-pointer font-black"
                        title="Klik untuk mengurutkan berdasarkan Nama Menu (A-Z / Z-A)"
                      >
                        <span>Nama Menu</span>
                        {catalogSortOption === 'nama_asc' && <span className="text-amber-600">▲</span>}
                        {catalogSortOption === 'nama_desc' && <span className="text-amber-600">▼</span>}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual (Rp)</th>
                    <th className="py-2.5 px-3 text-right">HPP (COGS)</th>
                    <th className="py-2.5 px-3 text-right">Margin / Unit</th>
                    <th className="py-2.5 px-3 text-right">Margin (%)</th>
                    <th className="py-2.5 px-3 text-center">Jatah Barista Default/Hari</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {catalogFilteredMenuItems.map(m => {
                    const margin = m.hargaJual - m.hpp;
                    const marginPct = m.hargaJual > 0 ? (margin / m.hargaJual) * 100 : 0;
                    const isRecipeExpanded = expandedRecipeMenuId === m.id;
                    const recipeIngredientCount = m.recipe ? m.recipe.length : 0;
                    const calculatedRecipeHpp = calculateMenuItemHppFromRecipe(m, ingredients);
                    const isEditingThisMenu = editingMenuItemId === m.id;

                    return (
                      <React.Fragment key={m.id}>
                        {/* INLINE EDIT FORM - Directly above the menu row being edited */}
                        {isEditingThisMenu && (
                          <tr id={`edit-menu-row-${m.id}`} className="bg-amber-100/60 border-2 border-amber-400">
                            <td colSpan={8} className="p-3.5 sm:p-4">
                              <form onSubmit={handleSaveMenu} className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-4 shadow-sm">
                                <div className="flex justify-between items-center border-b border-amber-300 pb-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center space-x-1.5">
                                    <Edit3 className="h-4 w-4 text-amber-700" />
                                    <span>Edit Menu: "{m.nama}" (Muncul Di Atas Menu)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddMenuModal(false);
                                      setEditingMenuItemId(null);
                                    }}
                                    className="text-xs text-slate-600 hover:text-slate-900 font-bold px-2.5 py-1 bg-white rounded-lg border border-slate-200"
                                  >
                                    Batal
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                  <div className="sm:col-span-4">
                                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Nama Menu</label>
                                    <input
                                      type="text"
                                      value={newMenuNama}
                                      onChange={(e) => setNewMenuNama(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      required
                                    />
                                  </div>

                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Kategori</label>
                                    <select
                                      value={newMenuKategori}
                                      onChange={(e) => setNewMenuKategori(e.target.value as any)}
                                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    >
                                      <option value="Minuman">Minuman</option>
                                      <option value="Makanan">Makanan</option>
                                      <option value="Snack">Snack</option>
                                    </select>
                                  </div>

                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Harga Jual (Rp)</label>
                                    <input
                                      type="number"
                                      value={newMenuHarga}
                                      onChange={(e) => setNewMenuHarga(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      required
                                    />
                                  </div>

                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 flex items-center justify-between">
                                      <span>HPP / COGS (Rp)</span>
                                      {newMenuRecipe.length > 0 && (
                                        <span className="text-[9px] font-extrabold text-amber-800 bg-amber-200 px-1 rounded">AUTO</span>
                                      )}
                                    </label>
                                    <input
                                      type="number"
                                      value={newMenuHpp}
                                      onChange={(e) => setNewMenuHpp(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-extrabold focus:outline-none text-amber-900 bg-amber-100/50"
                                      required
                                    />
                                  </div>

                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Jatah Barista Default</label>
                                    <input
                                      type="number"
                                      value={newMenuJatah}
                                      onChange={(e) => setNewMenuJatah(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      required
                                    />
                                  </div>
                                </div>

                                {/* Sub-form Input Komposisi Resep & Kalkulator COGS */}
                                <div className="bg-white p-3.5 border border-amber-300 rounded-xl space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-slate-100 pb-2">
                                    <div className="flex items-center space-x-2">
                                      <Utensils className="h-4 w-4 text-amber-700" />
                                      <span className="text-xs font-black uppercase tracking-wide text-slate-800">
                                        Input Komposisi Resep (COGS Terhitung Otomatis)
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-bold text-amber-950 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center space-x-1.5">
                                      <span>Total HPP Resep:</span>
                                      <strong className="font-mono text-sm text-amber-900 font-extrabold">
                                        Rp {newMenuRecipe.reduce((sum, r) => {
                                          const ing = findIngredientHelper(ingredients, r.ingredientId);
                                          return ing ? sum + calculateRecipeItemCost(ing, r.takaran) : sum;
                                        }, 0).toLocaleString('id-ID')}
                                      </strong>
                                    </div>
                                  </div>

                                  {/* Inputs for adding ingredient to recipe draft */}
                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                    <div className="sm:col-span-6">
                                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                        Pilih Bahan Baku Terinput
                                      </label>
                                      <select
                                        value={formRecipeIngId}
                                        onChange={(e) => setFormRecipeIngId(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                      >
                                        <option value="">-- Pilih Bahan Baku ({ingredients.length} Tersedia) --</option>
                                        {ingredients.map(ing => (
                                          <option key={ing.id} value={ing.id}>
                                            {ing.namaBahan} (Harga: Rp {ing.hargaBeli.toLocaleString('id-ID')} / {ing.satuanBeli})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="sm:col-span-3">
                                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                        Takaran Resep
                                      </label>
                                      <input
                                        type="number"
                                        step="any"
                                        placeholder="18"
                                        value={formRecipeTakaran}
                                        onChange={(e) => setFormRecipeTakaran(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>

                                    <div className="sm:col-span-12">
                                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        <span className="text-[9.5px] font-extrabold uppercase text-slate-500">Preset Takaran Cepat:</span>
                                        {[10, 25, 50, 80, 100, 150, 180, 200].map(g => (
                                          <button
                                            key={`preset-g-draft-${g}`}
                                            type="button"
                                            onClick={() => setFormRecipeTakaran(String(g))}
                                            className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-mono font-bold text-[10px] rounded-md border border-amber-300 transition cursor-pointer"
                                          >
                                            +{g}g
                                          </button>
                                        ))}
                                        {[1, 2, 3, 5, 10].map(p => (
                                          <button
                                            key={`preset-p-draft-${p}`}
                                            type="button"
                                            onClick={() => setFormRecipeTakaran(String(p))}
                                            className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-950 font-mono font-bold text-[10px] rounded-md border border-blue-300 transition cursor-pointer"
                                          >
                                            +{p} pcs
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="sm:col-span-3">
                                      <button
                                        type="button"
                                        onClick={handleAddIngredientToDraftRecipe}
                                        className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer shadow-xs"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Tambah Ke Resep</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* List of draft recipe ingredients */}
                                  {newMenuRecipe.length > 0 ? (
                                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                                            <th className="py-1.5 px-2.5">Bahan Baku (Terpilih)</th>
                                            <th className="py-1.5 px-2.5 text-center">Takaran Resep</th>
                                            <th className="py-1.5 px-2.5 text-right">Biaya HPP Kontribusi</th>
                                            <th className="py-1.5 px-2.5 text-center">Aksi</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                          {newMenuRecipe.map((r, rIdx) => {
                                            const ing = findIngredientHelper(ingredients, r.ingredientId);
                                            if (!ing) {
                                              return (
                                                <tr key={`${r.ingredientId}-${rIdx}`} className="bg-red-50 text-red-900 border-b border-red-100">
                                                  <td className="py-1.5 px-2.5 font-bold text-red-700 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
                                                    <span>Bahan Tidak Ditemukan ({r.ingredientId})</span>
                                                  </td>
                                                  <td className="py-1.5 px-2.5 text-center font-mono text-red-700 font-bold">{r.takaran}</td>
                                                  <td className="py-1.5 px-2.5 text-right font-mono text-slate-400">Rp 0</td>
                                                  <td className="py-1.5 px-2.5 text-center">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleRemoveIngredientFromDraftRecipe(rIdx)}
                                                      className="p-1 text-red-600 hover:text-red-900 transition cursor-pointer"
                                                      title="Hapus dari resep"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                  </td>
                                                </tr>
                                              );
                                            }
                                            const cost = calculateRecipeItemCost(ing, r.takaran);

                                            return (
                                              <tr key={`${r.ingredientId}-${rIdx}`} className="hover:bg-slate-50">
                                                <td className="py-1.5 px-2.5 font-bold text-slate-900">{ing.namaBahan}</td>
                                                <td className="py-1.5 px-2.5 text-center font-mono font-bold text-amber-900">
                                                  <span className="px-2 py-0.5 bg-amber-100 rounded text-[11px]">
                                                    {r.takaran} {ing.satuanTakaran}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-amber-900">
                                                  Rp {Math.round(cost).toLocaleString('id-ID')}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleRemoveIngredientFromDraftRecipe(rIdx)}
                                                    className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                                    title="Hapus bahan dari resep"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-slate-400 italic text-center py-2.5 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                      Belum ada komposisi resep. Pilih bahan baku di atas untuk menghitung COGS / HPP menu ini secara otomatis.
                                    </p>
                                  )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-amber-300">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddMenuModal(false);
                                      setEditingMenuItemId(null);
                                    }}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="submit"
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-1.5"
                                  >
                                    <Check className="h-4 w-4" />
                                    <span>Update Menu Ini</span>
                                  </button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        )}

                        <tr className={`hover:bg-slate-50/80 transition-colors ${isRecipeExpanded ? 'bg-amber-50/30 font-semibold' : ''} ${isEditingThisMenu ? 'bg-amber-100/30 font-bold border-l-4 border-amber-500' : ''}`}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              <span>{m.nama}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border ${
                              m.kategori === 'Minuman' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : m.kategori === 'Makanan'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              {m.kategori}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                            {formatRupiah(m.hargaJual)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-amber-800">{formatRupiah(m.hpp)}</span>
                              <button
                                type="button"
                                onClick={() => setExpandedRecipeMenuId(isRecipeExpanded ? null : m.id)}
                                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline flex items-center space-x-1 mt-0.5 cursor-pointer"
                              >
                                <Utensils className="h-3 w-3" />
                                <span>{recipeIngredientCount > 0 ? `Resep (${recipeIngredientCount} Bahan)` : 'Buat Resep'}</span>
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatRupiah(margin)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-800">
                            {marginPct.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-extrabold text-slate-700">
                            {m.defaultJatah} Porsi
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => setExpandedRecipeMenuId(isRecipeExpanded ? null : m.id)}
                                className={`p-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                                  isRecipeExpanded 
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs' 
                                    : 'text-amber-700 hover:bg-amber-100 bg-amber-50 border border-amber-200/80'
                                }`}
                                title="Atur & Lihat Resep Menu"
                              >
                                <Utensils className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-bold">Resep</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditMenuClick(m)}
                                className="p-1 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                                title="Edit Menu"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              {confirmDeleteMenuId === m.id ? (
                                <div className="inline-flex items-center space-x-1 bg-red-50 border border-red-200 rounded-lg px-1.5 py-0.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMenu(m)}
                                    className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded transition cursor-pointer"
                                    title="Konfirmasi Hapus Menu"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteMenuId(null)}
                                    className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded border border-slate-200 transition cursor-pointer"
                                    title="Batal Hapus"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMenuId(m.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                  title="Hapus Menu"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Recipe Drawer for this Menu Item */}
                        {isRecipeExpanded && (
                          <tr className="bg-amber-50/40 border-y-2 border-amber-200">
                            <td colSpan={8} className="p-4">
                              <div className="bg-white rounded-xl border border-amber-200/90 shadow-xs p-4 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                                  <div className="flex items-center space-x-2">
                                    <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                                      <Utensils className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      {editingRecipeNameId === m.id ? (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                                            Nama Resep / Menu:
                                          </span>
                                          <input
                                            type="text"
                                            value={editingRecipeNameValue}
                                            onChange={(e) => setEditingRecipeNameValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleRenameMenuFromRecipe(m.id, editingRecipeNameValue);
                                              } else if (e.key === 'Escape') {
                                                setEditingRecipeNameId(null);
                                              }
                                            }}
                                            className="px-2.5 py-1 bg-white border border-amber-400 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[200px]"
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRenameMenuFromRecipe(m.id, editingRecipeNameValue)}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-lg transition cursor-pointer flex items-center space-x-1"
                                          >
                                            <Check className="h-3 w-3" />
                                            <span>Simpan</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingRecipeNameId(null)}
                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                          >
                                            Batal
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                                            Komposisi Resep Bahan Baku: <span className="text-amber-800 font-extrabold">{m.nama}</span>
                                          </h4>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingRecipeNameId(m.id);
                                              setEditingRecipeNameValue(m.nama);
                                            }}
                                            className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold transition cursor-pointer"
                                            title="Ubah nama menu/resep ini (otomatis memperbarui form input catatan penjualan)"
                                          >
                                            <Edit3 className="h-3 w-3" />
                                            <span>Ubah Nama</span>
                                          </button>
                                        </div>
                                      )}
                                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                        Pilih bahan baku dari master list untuk membentuk resep menu ini. Perubahan nama otomatis sinkron ke Form Catatan Penjualan.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center space-x-3 text-xs font-bold gap-y-2">
                                    <span className="text-slate-600">Harga Jual: <strong className="text-slate-900">{formatRupiah(m.hargaJual)}</strong></span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-amber-900">
                                      HPP Resep: <strong className="text-amber-950 font-mono text-sm ml-1">{formatRupiah(calculatedRecipeHpp)}</strong>
                                    </span>
                                    
                                    {(() => {
                                      const invalidRecipeCount = (m.recipe || []).filter(r => !findIngredientHelper(ingredients, r.ingredientId)).length;
                                      return invalidRecipeCount > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => handleCleanInvalidIngredientsFromRecipe(m.id)}
                                          className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-lg border border-red-300 transition flex items-center space-x-1 cursor-pointer ml-1 shadow-2xs"
                                          title="Hapus semua bahan yang tidak ditemukan dalam 1 kali klik"
                                        >
                                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                          <span>Bersihkan {invalidRecipeCount} Bahan Tidak Ditemukan</span>
                                        </button>
                                      ) : null;
                                    })()}

                                    <button
                                      type="button"
                                      onClick={() => handleOpenPdfModalForMenu(m)}
                                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer shadow-2xs ml-1"
                                      title="Ekspor Resep Menu Ini Ke PDF"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      <span>Ekspor PDF Resep</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedRecipeMenuId(null)}
                                      className="text-slate-400 hover:text-slate-700 text-xs font-bold underline ml-2 cursor-pointer"
                                    >
                                      Tutup Drawer
                                    </button>
                                  </div>
                                </div>

                                {/* Table of Ingredients in Recipe */}
                                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                                        <th className="py-2 px-3">Bahan Baku (Terinput)</th>
                                        <th className="py-2 px-3 text-right">Harga Beli</th>
                                        <th className="py-2 px-3 text-center">Kemasan Beli</th>
                                        <th className="py-2 px-3 text-center">Takaran Dalam Resep</th>
                                        <th className="py-2 px-3 text-right">Biaya HPP Kontribusi</th>
                                        <th className="py-2 px-3 text-center">Aksi</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                      {(!m.recipe || m.recipe.length === 0) ? (
                                        <tr>
                                          <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                            Belum ada bahan baku yang terhubung dengan resep menu ini. Pilih bahan baku di bawah untuk menambahkan.
                                          </td>
                                        </tr>
                                      ) : (
                                        m.recipe.map((r, rIndex) => {
                                          const ing = findIngredientHelper(ingredients, r.ingredientId);
                                          if (!ing) {
                                            return (
                                              <tr key={`${r.ingredientId}-${rIndex}`} className="bg-red-50 text-red-900 border-b border-red-100">
                                                <td className="py-2 px-3 font-bold text-red-700 flex items-center gap-1.5">
                                                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                                                  <span>Bahan Tidak Ditemukan ({r.ingredientId})</span>
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono text-slate-400">-</td>
                                                <td className="py-2 px-3 text-center font-mono text-slate-400">-</td>
                                                <td className="py-2 px-3 text-center font-mono font-bold text-red-700">
                                                  <span className="px-2 py-0.5 bg-red-100 rounded text-[11px]">
                                                    {r.takaran}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-red-700">Rp 0</td>
                                                <td className="py-2 px-3 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleRemoveIngredientFromRecipe(m.id, rIndex)}
                                                    className="p-1 text-red-600 hover:text-red-900 transition cursor-pointer"
                                                    title="Hapus dari resep"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          }
                                          const itemCost = calculateRecipeItemCost(ing, r.takaran);

                                          return (
                                            <tr key={`${r.ingredientId}-${rIndex}`} className="hover:bg-slate-50">
                                              <td className="py-2 px-3 font-bold text-slate-900">{ing.namaBahan}</td>
                                              <td className="py-2 px-3 text-right font-mono">Rp {ing.hargaBeli.toLocaleString('id-ID')}</td>
                                              <td className="py-2 px-3 text-center font-mono text-slate-600">{ing.satuanBeli}</td>
                                              <td className="py-2 px-3 text-center font-mono font-bold text-amber-900">
                                                <span className="px-2 py-0.5 bg-amber-100 rounded text-[11px]">
                                                  {r.takaran} {ing.satuanTakaran}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-bold text-amber-900">
                                                Rp {Math.round(itemCost).toLocaleString('id-ID')}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveIngredientFromRecipe(m.id, rIndex)}
                                                  className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                                  title="Hapus dari resep"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                      {m.recipe && m.recipe.length > 0 && (
                                        <tr className="bg-amber-50 font-extrabold text-amber-950 border-t border-amber-200">
                                          <td colSpan={4} className="py-2.5 px-3 uppercase text-[11px]">Total HPP Resep Menu:</td>
                                          <td className="py-2.5 px-3 text-right font-mono text-sm">{formatRupiah(calculatedRecipeHpp)}</td>
                                          <td></td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Form Tambah Bahan Ke Resep Menu */}
                                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                    <div className="flex flex-col sm:flex-row items-end gap-3">
                                      <div className="flex-1 w-full">
                                        <div className="flex items-center justify-between mb-1">
                                          <label className="block text-[10px] font-bold uppercase text-slate-500">Pilih Bahan Baku Master (Dari Input Bahan Baku)</label>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setIngredients(DEFAULT_INGREDIENTS);
                                              localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(DEFAULT_INGREDIENTS));
                                              alert('✅ Berhasil memuat ulang 12 Master Bahan Baku Default!');
                                            }}
                                            className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline flex items-center gap-1 cursor-pointer"
                                            title="Klik jika pilihan bahan baku kosong"
                                          >
                                            <RotateCcw className="h-2.5 w-2.5" />
                                            <span>{ingredients.length === 0 ? 'Muat Master Bahan Baku Default' : 'Reset Master Bahan'}</span>
                                          </button>
                                        </div>
                                        <select
                                          value={recipeFormIngId}
                                          onChange={(e) => setRecipeFormIngId(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                        >
                                          <option value="">-- Pilih Bahan Baku Terinput ({ingredients.length} Tersedia) --</option>
                                          {ingredients.map(ing => (
                                            <option key={ing.id} value={ing.id}>
                                              {ing.namaBahan} (Harga: Rp {ing.hargaBeli.toLocaleString('id-ID')} / {ing.satuanBeli})
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="w-full sm:w-36">
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Takaran Resep</label>
                                        <input
                                          type="number"
                                          step="any"
                                          placeholder="18"
                                          value={recipeFormTakaran}
                                          onChange={(e) => setRecipeFormTakaran(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const takVal = parseFloat(recipeFormTakaran) || 0;
                                          if (recipeFormIngId && takVal > 0) {
                                            handleAddIngredientToRecipe(m.id, recipeFormIngId, takVal);
                                            setRecipeFormIngId('');
                                          } else {
                                            alert('Pilih bahan baku dan masukkan takaran resep yang valid!');
                                          }
                                        }}
                                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                      >
                                        <Plus className="h-4 w-4" />
                                        <span>Tambah ke Resep Menu</span>
                                      </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      <span className="text-[9.5px] font-extrabold uppercase text-slate-500">Preset Takaran Cepat:</span>
                                      {[10, 25, 50, 80, 100, 150, 180, 200].map(g => (
                                        <button
                                          key={`preset-g-exp-${g}`}
                                          type="button"
                                          onClick={() => setRecipeFormTakaran(String(g))}
                                          className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-mono font-bold text-[10px] rounded-md border border-amber-300 transition cursor-pointer"
                                        >
                                          +{g}g
                                        </button>
                                      ))}
                                      {[1, 2, 3, 5, 10].map(p => (
                                        <button
                                          key={`preset-p-exp-${p}`}
                                          type="button"
                                          onClick={() => setRecipeFormTakaran(String(p))}
                                          className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-950 font-mono font-bold text-[10px] rounded-md border border-blue-300 transition cursor-pointer"
                                        >
                                          +{p} pcs
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ========================================================================= */}
            {/* ANALISIS AI MARGIN IDEAL MENU & OPTIMASI PROFIT */}
            {/* ========================================================================= */}
            <div id="sec-ai-menu-margin-analysis" className="mt-8 border-t border-slate-200/80 pt-6 space-y-6">
              {/* Card Header & AI Badge */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-2xl p-5 text-white shadow-lg space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl font-black shadow-md">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-black uppercase tracking-wider text-white">
                          Analisis AI Margin Ideal Menu & Optimasi Profit
                        </h4>
                        <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                          Gemini F&B Profit Consultant
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-0.5">
                        Evaluasi otomatis kesehatan margin kotor katalog menu (Target COGS 25-35% / Margin Ideal 65-75%) dan rekomendasi penyesuaian harga jual.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                      <Target className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-[10px] font-extrabold uppercase text-slate-300">Target Margin Ideal:</span>
                      <select
                        value={targetIdealMarginPct}
                        onChange={(e) => setTargetIdealMarginPct(Number(e.target.value))}
                        className="bg-slate-900 text-white font-mono font-extrabold text-xs px-2 py-0.5 rounded border border-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value={60}>60% (COGS 40%)</option>
                        <option value={65}>65% (COGS 35% - Standar F&B)</option>
                        <option value={70}>70% (COGS 30% - High Profit)</option>
                        <option value={75}>75% (COGS 25% - Premium)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={runAiMenuMarginAnalysis}
                      disabled={aiMarginAnalysisLoading}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer"
                    >
                      {aiMarginAnalysisLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Menganalisis...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Jalankan Analisis AI Gemini</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Real-time Quick Metrics Grid */}
                {(() => {
                  let totalMarginPctSum = 0;
                  let idealCount = 0;
                  let warningCount = 0;
                  let criticalCount = 0;
                  const lowMarginList: Array<{ menu: typeof menuItems[0]; calcHpp: number; marginPct: number; idealPrice: number; extraMargin: number }> = [];
                  const idealPricesMap: Record<string, number> = {};

                  menuItems.forEach(m => {
                    const calcHpp = calculateMenuItemHppFromRecipe(m, ingredients) || m.hpp;
                    const marginVal = m.hargaJual - calcHpp;
                    const marginPct = m.hargaJual > 0 ? (marginVal / m.hargaJual) * 100 : 0;
                    totalMarginPctSum += marginPct;

                    if (marginPct >= targetIdealMarginPct) {
                      idealCount++;
                    } else {
                      warningCount++;
                      if (marginPct < 55) criticalCount++;
                      // Formula ideal price rounded up to nearest 500
                      const rawTargetPrice = calcHpp / (1 - (targetIdealMarginPct / 100));
                      const idealPrice = Math.ceil(rawTargetPrice / 500) * 500;
                      idealPricesMap[m.id] = idealPrice;
                      lowMarginList.push({
                        menu: m,
                        calcHpp,
                        marginPct,
                        idealPrice,
                        extraMargin: idealPrice - m.hargaJual
                      });
                    }
                  });

                  const avgMarginPct = menuItems.length > 0 ? (totalMarginPctSum / menuItems.length) : 0;

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Rata-rata Margin Catalog</span>
                          <div className="flex items-baseline space-x-1 mt-1">
                            <span className={`text-lg font-mono font-black ${avgMarginPct >= targetIdealMarginPct ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {avgMarginPct.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">/ Target {targetIdealMarginPct}%</span>
                          </div>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Menu Margin Ideal (≥{targetIdealMarginPct}%)</span>
                          <div className="flex items-baseline space-x-1 mt-1">
                            <span className="text-lg font-mono font-black text-emerald-400">{idealCount}</span>
                            <span className="text-[10px] text-slate-400 font-bold">dari {menuItems.length} menu</span>
                          </div>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Menu Perlu Penyesuaian</span>
                          <div className="flex items-baseline space-x-1 mt-1">
                            <span className="text-lg font-mono font-black text-amber-400">{warningCount}</span>
                            <span className="text-[10px] text-slate-400 font-bold">({criticalCount} Kritis &lt;55%)</span>
                          </div>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Potensi Tambahan Profit</span>
                          <div className="flex items-baseline space-x-1 mt-1">
                            <span className="text-lg font-mono font-black text-emerald-400">
                              +Rp {lowMarginList.reduce((sum, item) => sum + item.extraMargin, 0).toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">/ unit</span>
                          </div>
                        </div>
                      </div>

                      {/* AI Analysis Result Output Box */}
                      {aiMarginAnalysisError && (
                        <div className="p-3.5 bg-red-950/80 border border-red-800 rounded-xl text-red-200 text-xs font-medium flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                          <span>{aiMarginAnalysisError}</span>
                        </div>
                      )}

                      {aiMarginAnalysisText && (
                        <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-4 space-y-3 text-slate-200 text-xs leading-relaxed animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div className="flex items-center space-x-2">
                              <Sparkles className="h-4 w-4 text-amber-400" />
                              <span className="font-extrabold text-amber-400 text-xs uppercase tracking-wide">
                                Hasil Analisis AI Gemini: Kesehatan & Optimasi Margin Menu
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(aiMarginAnalysisText);
                                alert('Hasil analisis AI berhasil disalin ke clipboard!');
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 transition flex items-center space-x-1 cursor-pointer"
                            >
                              <Copy className="h-3 w-3" />
                              <span>Salin Analisis</span>
                            </button>
                          </div>

                          <div className="whitespace-pre-line text-slate-200 font-sans space-y-1.5 pt-1">
                            {aiMarginAnalysisText}
                          </div>
                        </div>
                      )}

                      {/* Table Recommendation for Low Margin Items */}
                      {lowMarginList.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 text-slate-800 p-4 space-y-3 shadow-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div>
                              <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                                <TrendingUp className="h-4 w-4 text-amber-600" />
                                <span>Daftar Menu Margin Rendah (&lt;{targetIdealMarginPct}%) & Rekomendasi Harga Jual Baru</span>
                              </h5>
                              <p className="text-[11px] text-slate-500 font-medium">
                                Terapkan harga jual ideal yang direkomendasikan agar setiap porsi memenuhi margin kotor target {targetIdealMarginPct}%.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => applyAllIdealPrices(idealPricesMap)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                            >
                              <Zap className="h-3.5 w-3.5" />
                              <span>Terapkan Semua Harga Ideal Baru</span>
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                                  <th className="py-2 px-3">Nama Menu</th>
                                  <th className="py-2 px-3">Kategori</th>
                                  <th className="py-2 px-3 text-right">Harga Jual Saat Ini</th>
                                  <th className="py-2 px-3 text-right">HPP (COGS)</th>
                                  <th className="py-2 px-3 text-right">Margin Saat Ini (%)</th>
                                  <th className="py-2 px-3 text-right">Harga Jual Ideal ({targetIdealMarginPct}%)</th>
                                  <th className="py-2 px-3 text-right">Potensi Kenaikan Profit</th>
                                  <th className="py-2 px-3 text-center">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                {lowMarginList.map(({ menu, calcHpp, marginPct, idealPrice, extraMargin }) => (
                                  <tr key={`rec-${menu.id}`} className="hover:bg-amber-50/50 transition">
                                    <td className="py-2 px-3 font-bold text-slate-900">{menu.nama}</td>
                                    <td className="py-2 px-3">
                                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                        {menu.kategori}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                                      Rp {menu.hargaJual.toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-800">
                                      Rp {calcHpp.toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-extrabold text-red-600">
                                      {marginPct.toFixed(1)}%
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/60">
                                      Rp {idealPrice.toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-800">
                                      +Rp {extraMargin.toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => applyIdealPriceToMenuItem(menu.id, idealPrice)}
                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[10.5px] rounded-lg transition cursor-pointer shadow-2xs whitespace-nowrap"
                                      >
                                        Terapkan Price Baru
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: KALKULATOR COGS & RESEP */}
      {/* ========================================================================= */}
      {(activeSubTab === 'all' || activeSubTab === 'kalkulator_cogs') && (
        <div id="sec-kalkulator-cogs" className="space-y-8 scroll-mt-6">
          
          {/* ========================================================================= */}
          {/* NAVIGASI KATEGORI COGS (MINUMAN, FOOD, SNACK) */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 rounded-2xl p-5 shadow-lg border border-slate-800 text-white space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl font-black shadow-md">
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black uppercase tracking-wider text-white">
                      Kalkulator COGS / HPP Per Kategori
                    </h3>
                    <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                      {cogsCategoryFilter === 'ALL' ? 'Semua Menu' : cogsCategoryFilter === 'Makanan' ? 'Food / Makanan' : cogsCategoryFilter === 'Snack' ? 'Snack / Cemilan' : 'Minuman'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Hitung & analisa HPP resep khusus untuk Minuman, Makanan (Food), dan Snack dengan dukungan takaran Gram (g) & Pcs
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyCategoryRecipesToMenuItems(cogsCategoryFilter)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer"
                  title="Terapkan hasil kalkulasi resep ke harga Pokok HPP Katalog Menu"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Update HPP {cogsCategoryFilter === 'ALL' ? 'Semua' : cogsCategoryFilter} Ke Catalog</span>
                </button>
              </div>
            </div>

            {/* NAVIGASI TOMBOL PILIHAN KATEGORI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setCogsCategoryFilter('ALL')}
                className={`p-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer border ${
                  cogsCategoryFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]'
                    : 'bg-slate-800 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Layers className="h-4 w-4" />
                <span>Semua Menu ({menuItems.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCogsCategoryFilter('Minuman')}
                className={`p-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer border ${
                  cogsCategoryFilter === 'Minuman'
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md scale-[1.02]'
                    : 'bg-slate-800 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Coffee className="h-4 w-4 text-blue-300" />
                <span>🥤 Minuman ({menuItems.filter(m => m.kategori === 'Minuman').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCogsCategoryFilter('Makanan')}
                className={`p-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer border ${
                  cogsCategoryFilter === 'Makanan'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md scale-[1.02]'
                    : 'bg-slate-800 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Utensils className="h-4 w-4 text-emerald-300" />
                <span>🍔 Food / Makanan ({menuItems.filter(m => m.kategori === 'Makanan').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCogsCategoryFilter('Snack')}
                className={`p-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer border ${
                  cogsCategoryFilter === 'Snack'
                    ? 'bg-orange-600 text-white border-orange-400 shadow-md scale-[1.02]'
                    : 'bg-slate-800 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Pizza className="h-4 w-4 text-orange-300" />
                <span>🍟 Snack / Cemilan ({menuItems.filter(m => m.kategori === 'Snack').length})</span>
              </button>
            </div>

            {/* SUMMARY METRICS DEDICATED PER CATEGORY */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-slate-800">
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl text-white">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Kategori Terfilter</span>
                <strong className="text-sm font-black uppercase text-amber-400">
                  {cogsCategoryFilter === 'ALL' ? 'Semua Kategori' : cogsCategoryFilter}
                </strong>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl text-white">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Total Menu</span>
                <strong className="text-sm font-black font-mono text-white">
                  {cogsFilteredMenuItems.length} Items
                </strong>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl text-white">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Rata-Rata HPP Resep</span>
                <strong className="text-sm font-black font-mono text-amber-300">
                  Rp {cogsFilteredMenuItems.length > 0
                    ? Math.round(cogsFilteredMenuItems.reduce((s, m) => s + calculateMenuItemHppFromRecipe(m, ingredients), 0) / cogsFilteredMenuItems.length).toLocaleString('id-ID')
                    : 0}
                </strong>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl text-white">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Avg Margin Profit</span>
                <strong className="text-sm font-black font-mono text-emerald-400">
                  {cogsFilteredMenuItems.length > 0
                    ? (cogsFilteredMenuItems.reduce((s, m) => {
                        const h = calculateMenuItemHppFromRecipe(m, ingredients);
                        return s + (m.hargaJual > 0 ? ((m.hargaJual - h) / m.hargaJual) * 100 : 0);
                      }, 0) / cogsFilteredMenuItems.length).toFixed(1)
                    : 0}%
                </strong>
              </div>
            </div>
          </div>
          
          {/* A. KALKULATOR RESEP BAHAN BAKU PER CUP */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    Kalkulator HPP Bahan Baku & Recipe Costing
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Hitung HPP aktual per cup berdasarkan harga beli bahan baku & takaran resep.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={applyRecipeHppToMaster}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Gunakan HPP Resep (Rp {Math.round(calculatedRecipeHpp).toLocaleString('id-ID')})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMinRecipeCalc(!isMinRecipeCalc)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  title={isMinRecipeCalc ? "Perluas Modul" : "Minimalkan Modul"}
                >
                  <span>{isMinRecipeCalc ? 'Perluas' : 'Minimize'}</span>
                  {isMinRecipeCalc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isMinRecipeCalc && (
              <>

            {/* Ingredient Form */}
            <form onSubmit={handleAddIngredient} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 block">
                  {editingIngId ? 'Edit Bahan Baku Resep' : 'Tambah Bahan Baku Resep'}
                </span>
                {editingIngId && (
                  <button
                    type="button"
                    onClick={handleCancelEditIngredient}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nama Bahan</label>
                  <input
                    type="text"
                    placeholder="e.g. Biji Kopi Arabika"
                    value={newIngNama}
                    onChange={(e) => setNewIngNama(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Harga Beli (Rp)</label>
                  <input
                    type="number"
                    placeholder="200000"
                    value={newIngHarga}
                    onChange={(e) => setNewIngHarga(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Kemasan Beli (Jumlah & Satuan)</label>
                  <div className="flex space-x-1.5">
                    <input
                      type="number"
                      placeholder="1000"
                      value={newIngIsiBeli}
                      onChange={(e) => setNewIngIsiBeli(e.target.value)}
                      className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                    <select
                      value={newIngSatuanBeliUnit}
                      onChange={(e) => setNewIngSatuanBeliUnit(e.target.value)}
                      className="w-1/2 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    >
                      {UNIT_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {editingIngId ? 'Simpan Bahan' : 'Tambah Bahan'}
                  </button>
                </div>
              </div>
            </form>

            {/* Ingredients Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3">Komponen Bahan Baku</th>
                    <th className="py-2.5 px-3 text-right">Harga Beli</th>
                    <th className="py-2.5 px-3 text-center">Kemasan Beli</th>
                    <th className="py-2.5 px-3 text-right">Biaya per Satuan</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {ingredients.map(ing => {
                    const numSatuanBeli = parseFloat(ing.satuanBeli) || 1;
                    const rawUnitBeli = ing.satuanBeli.replace(/^[0-9.\s]+/, '').trim() || 'unit';
                    const unitCost = ing.hargaBeli / (numSatuanBeli || 1);

                    return (
                      <tr key={ing.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {ing.namaBahan}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          Rp {ing.hargaBeli.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[11px] font-bold text-slate-800 border border-slate-200">
                            {ing.satuanBeli}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-amber-900">
                          Rp {unitCost < 10 ? unitCost.toFixed(2) : Math.round(unitCost).toLocaleString('id-ID')} / {rawUnitBeli}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleEditIngredientClick(ing)}
                              className="p-1 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                              title="Edit Bahan"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIngredient(ing.id)}
                              className="p-1 text-slate-300 hover:text-red-600 transition cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
            )}
          </div>

          {/* C. REKAPITULASI RESEP MENU & HPP DARI BAHAN BAKU TERINPUT */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 text-amber-900 rounded-xl">
                  <Utensils className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    Matriks Resep Menu & HPP Berdasarkan Bahan Baku Terinput
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Rincian takaran resep dan HPP otomatis per menu yang dihitung dari daftar bahan baku terinput.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleOpenPdfModalForAll}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                  title="Ekspor PDF Katalog Resep Lengkap Seluruh Menu"
                >
                  <Download className="h-4 w-4" />
                  <span>Ekspor PDF Semua Resep</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMinMatrix(!isMinMatrix)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  title={isMinMatrix ? "Perluas Modul" : "Minimalkan Modul"}
                >
                  <span>{isMinMatrix ? 'Perluas' : 'Minimize'}</span>
                  {isMinMatrix ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isMinMatrix && (
              <>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3">Nama Menu</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Komposisi Bahan Baku (Resep)</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                    <th className="py-2.5 px-3 text-right">HPP Resep</th>
                    <th className="py-2.5 px-3 text-right">Margin / Unit</th>
                    <th className="py-2.5 px-3 text-center">Aksi Resep</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {cogsFilteredMenuItems.map(m => {
                    const calcHpp = calculateMenuItemHppFromRecipe(m, ingredients);
                    const marginVal = m.hargaJual - calcHpp;
                    const marginPct = m.hargaJual > 0 ? (marginVal / m.hargaJual) * 100 : 0;
                    const recipeList = m.recipe || [];

                    return (
                      <tr key={`matrix-${m.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">{m.nama}</td>
                        <td className="py-3 px-3">
                          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border ${
                            m.kategori === 'Minuman' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : m.kategori === 'Makanan'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {m.kategori}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {recipeList.length === 0 ? (
                            <span className="text-slate-400 italic text-[11px]">Belum disetting resep</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {recipeList.map(r => {
                                const ing = findIngredientHelper(ingredients, r.ingredientId);
                                if (!ing) {
                                  return (
                                    <span key={r.ingredientId} className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-[10.5px] font-semibold text-red-700">
                                      ⚠️ Bahan hilang
                                    </span>
                                  );
                                }
                                return (
                                  <span key={r.ingredientId} className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10.5px] font-semibold text-amber-950">
                                    {ing.namaBahan}: <strong>{r.takaran}{ing.satuanTakaran}</strong>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(m.hargaJual)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-amber-900">
                          {formatRupiah(Math.round(calcHpp))}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className="font-bold text-emerald-700">{formatRupiah(Math.round(marginVal))}</span>
                          <span className="text-[10px] text-slate-400 block font-normal">({marginPct.toFixed(1)}%)</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubTab('penjualan_menu');
                                setExpandedRecipeMenuId(m.id);
                                setTimeout(() => {
                                  const el = document.getElementById('sec-penjualan-menu');
                                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                              }}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-md transition inline-flex items-center space-x-1 cursor-pointer shadow-2xs"
                              title="Edit Komposisi Resep"
                            >
                              <Utensils className="h-3 w-3" />
                              <span>Edit Resep</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenPdfModalForMenu(m)}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] rounded-md transition inline-flex items-center space-x-1 cursor-pointer shadow-2xs"
                              title="Ekspor PDF Resep Menu Ini"
                            >
                              <Download className="h-3 w-3" />
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: ANALYSIS PENGGUNAAN BAHAN BAKU (PENJUALAN & JATAH BARISTA) */}
      {/* ========================================================================= */}
      {(activeSubTab === 'all' || activeSubTab === 'penggunaan_bahan') && (
        <div id="sec-penggunaan-bahan" className="space-y-6 scroll-mt-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black uppercase tracking-wider text-slate-900">
                      Laporan Penggunaan Bahan Baku (Sales & Jatah Barista)
                    </h3>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full uppercase">
                      Otomatis Resep
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Hitungan rinci pemakaian bahan baku dari realisasi penjualan menu dan jatah barista (harian & bulanan).
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportIngredientUsageCSV}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                  title="Download CSV Laporan Bahan Baku"
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV Bahan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMinIngredientReport(!isMinIngredientReport)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>{isMinIngredientReport ? 'Perluas' : 'Minimize'}</span>
                  {isMinIngredientReport ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isMinIngredientReport && (
              <>
                {/* Filters Bar: Timeframe Mode, Date / Month Pickers, View Mode */}
                <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Timeframe selector: Harian vs Bulanan */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setIngredientFilterTimeframe('harian')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          ingredientFilterTimeframe === 'harian'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        📅 Harian
                      </button>
                      <button
                        type="button"
                        onClick={() => setIngredientFilterTimeframe('bulanan')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          ingredientFilterTimeframe === 'bulanan'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🗓️ Bulanan
                      </button>
                    </div>

                    {/* Dynamic Picker based on Timeframe */}
                    {ingredientFilterTimeframe === 'harian' ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-600">Pilih Tanggal:</span>
                        <input
                          type="date"
                          value={ingredientSelectedDate}
                          onChange={(e) => setIngredientSelectedDate(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setIngredientSelectedDate(selectedDate)}
                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold rounded-xl transition cursor-pointer"
                        >
                          Hari Ini ({formatDateDDMMYYYY(selectedDate)})
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-600">Pilih Bulan:</span>
                        <select
                          value={ingredientSelectedMonth}
                          onChange={(e) => setIngredientSelectedMonth(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                        >
                          <option value="ALL">Semua Bulan Terdata ({dailySales.length} Hari)</option>
                          {availableMonths.map(ym => (
                            <option key={ym} value={ym}>
                              {formatMonthLabel(ym)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* View Mode Toggle & Search Box */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search Box */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari bahan / menu..."
                        value={ingredientSearchQuery}
                        onChange={(e) => setIngredientSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
                      />
                    </div>

                    {/* View mode toggle: Per Bahan Baku vs Per Menu */}
                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setIngredientViewMode('bahan')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          ingredientViewMode === 'bahan'
                            ? 'bg-slate-900 text-white shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Per Bahan Baku
                      </button>
                      <button
                        type="button"
                        onClick={() => setIngredientViewMode('menu')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          ingredientViewMode === 'menu'
                            ? 'bg-slate-900 text-white shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Per Menu Produk
                      </button>
                    </div>
                  </div>
                </div>

                {/* Metric Cards Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xs relative overflow-hidden">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      Total Estimasi Biaya Bahan Baku
                    </span>
                    <p className="text-xl font-black text-amber-400 font-mono">
                      {formatRupiah(Math.round(ingredientUsageReport.totalOverallCost))}
                    </p>
                    <span className="text-[10.5px] text-slate-400 font-medium block mt-1">
                      {ingredientUsageReport.activeIngredientsCount} dari {ingredients.length} jenis bahan terpakai
                    </span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 block mb-1">
                      Biaya Bahan Baku Penjualan
                    </span>
                    <p className="text-xl font-black text-emerald-950 font-mono">
                      {formatRupiah(Math.round(ingredientUsageReport.totalCostSales))}
                    </p>
                    <span className="text-[10.5px] text-emerald-700 font-semibold block mt-1">
                      {ingredientUsageReport.totalOverallCost > 0 
                        ? `${((ingredientUsageReport.totalCostSales / ingredientUsageReport.totalOverallCost) * 100).toFixed(1)}% dari total pemakaian bahan`
                        : '0%'}
                    </span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 block mb-1">
                      Biaya Bahan Baku Jatah Barista
                    </span>
                    <p className="text-xl font-black text-amber-950 font-mono">
                      {formatRupiah(Math.round(ingredientUsageReport.totalCostJatah))}
                    </p>
                    <span className="text-[10.5px] text-amber-800 font-semibold block mt-1">
                      {ingredientUsageReport.totalOverallCost > 0 
                        ? `${((ingredientUsageReport.totalCostJatah / ingredientUsageReport.totalOverallCost) * 100).toFixed(1)}% dari total pemakaian bahan`
                        : '0%'}
                    </span>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200/80 p-4 rounded-2xl shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900 block mb-1">
                      Periode Teranalisis
                    </span>
                    <p className="text-base font-black text-indigo-950 mt-1">
                      {ingredientFilterTimeframe === 'harian' 
                        ? formatDateDDMMYYYY(ingredientSelectedDate)
                        : ingredientSelectedMonth === 'ALL'
                        ? `Semua Data (${ingredientUsageReport.recordsProcessedCount} Hari)`
                        : formatMonthLabel(ingredientSelectedMonth)}
                    </p>
                    <span className="text-[10.5px] text-indigo-700 font-semibold block mt-0.5">
                      Mode: {ingredientFilterTimeframe === 'harian' ? 'Pencatatan Harian' : 'Akumulasi Bulanan'}
                    </span>
                  </div>
                </div>

                {/* VIEW MODE 1: REKAP PER BAHAN BAKU */}
                {ingredientViewMode === 'bahan' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Rincian Pemakaian Per Komponen Bahan Baku
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Klik tanda ➕ di baris bahan baku untuk melihat rincian menu pengguna
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700">
                            <th className="py-2.5 px-3 w-10 text-center">Detail</th>
                            <th className="py-2.5 px-3">Nama Bahan Baku</th>
                            <th className="py-2.5 px-3 text-center">Satuan Takaran</th>
                            <th className="py-2.5 px-3 text-right bg-emerald-50/50">Usage Penjualan</th>
                            <th className="py-2.5 px-3 text-right bg-amber-50/50">Usage Jatah Barista</th>
                            <th className="py-2.5 px-3 text-right font-black bg-slate-200/60">Total Volume Terpakai</th>
                            <th className="py-2.5 px-3 text-right bg-emerald-50/50">Cost Penjualan (Rp)</th>
                            <th className="py-2.5 px-3 text-right bg-amber-50/50">Cost Jatah Barista (Rp)</th>
                            <th className="py-2.5 px-3 text-right font-black bg-slate-200/60">Total Cost (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {ingredientUsageReport.ingredientList
                            .filter(item => {
                              if (!ingredientSearchQuery) return true;
                              const q = ingredientSearchQuery.toLowerCase();
                              return item.ingredient.namaBahan.toLowerCase().includes(q);
                            })
                            .map(item => {
                              const ing = item.ingredient;
                              const isExpanded = expandedIngredientId === ing.id;
                              const menuBreakdownList = Array.from(item.menuBreakdown.values()) as any[];
                              const isUsed = item.totalUsage > 0;

                              return (
                                <React.Fragment key={`ing-row-${ing.id}`}>
                                  <tr className={`transition-colors ${isUsed ? 'hover:bg-slate-50' : 'bg-slate-50/40 text-slate-400'}`}>
                                    <td className="py-2.5 px-3 text-center">
                                      {menuBreakdownList.length > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedIngredientId(isExpanded ? null : ing.id)}
                                          className="p-1 bg-slate-200 hover:bg-slate-300 rounded text-slate-800 text-xs font-black transition cursor-pointer"
                                          title="Lihat Menu Pengguna"
                                        >
                                          {isExpanded ? '➖' : '➕'}
                                        </button>
                                      ) : (
                                        <span className="text-slate-300 text-xs">-</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-slate-900">
                                      <div>
                                        <span className={isUsed ? 'text-slate-900 font-extrabold' : 'text-slate-500 font-normal'}>
                                          {ing.namaBahan}
                                        </span>
                                        <span className="text-[10px] text-slate-400 block font-normal">
                                          Harga beli: Rp {ing.hargaBeli.toLocaleString('id-ID')} / {ing.satuanBeli}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono">
                                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10.5px] font-bold text-slate-700 border border-slate-200">
                                        {ing.satuanTakaran}
                                      </span>
                                    </td>

                                    {/* Usage Sales */}
                                    <td className="py-2.5 px-3 text-right font-mono bg-emerald-50/30">
                                      <span className="font-extrabold text-emerald-950">
                                        {item.usageSales.toLocaleString('id-ID')} {ing.satuanTakaran}
                                      </span>
                                      {item.cupsSales > 0 && (
                                        <span className="text-[9.5px] text-emerald-700 block font-medium">
                                          ({item.cupsSales} cup)
                                        </span>
                                      )}
                                    </td>

                                    {/* Usage Jatah */}
                                    <td className="py-2.5 px-3 text-right font-mono bg-amber-50/30">
                                      <span className="font-extrabold text-amber-950">
                                        {item.usageJatah.toLocaleString('id-ID')} {ing.satuanTakaran}
                                      </span>
                                      {item.cupsJatah > 0 && (
                                        <span className="text-[9.5px] text-amber-800 block font-medium">
                                          ({item.cupsJatah} cup)
                                        </span>
                                      )}
                                    </td>

                                    {/* Total Usage Volume */}
                                    <td className="py-2.5 px-3 text-right font-mono font-black bg-slate-100 text-slate-900">
                                      {item.totalUsage.toLocaleString('id-ID')} {ing.satuanTakaran}
                                    </td>

                                    {/* Cost Penjualan */}
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-900 bg-emerald-50/30">
                                      {formatRupiah(Math.round(item.costSales))}
                                    </td>

                                    {/* Cost Jatah */}
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900 bg-amber-50/30">
                                      {formatRupiah(Math.round(item.costJatah))}
                                    </td>

                                    {/* Total Cost */}
                                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950 bg-slate-100">
                                      {formatRupiah(Math.round(item.totalCost))}
                                    </td>
                                  </tr>

                                  {/* Expanded Breakdown Row */}
                                  {isExpanded && menuBreakdownList.length > 0 && (
                                    <tr key={`ing-exp-${ing.id}`} className="bg-slate-100/80">
                                      <td colSpan={9} className="p-3 pl-12 border-y border-slate-300">
                                        <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-2xs space-y-2">
                                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                                            📌 Rincian Menu Pengguna Bahan: <strong className="text-amber-900">{ing.namaBahan}</strong>
                                          </span>
                                          <table className="w-full text-left border-collapse text-[11px]">
                                            <thead>
                                              <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-600">
                                                <th className="py-1.5 px-2">Nama Menu</th>
                                                <th className="py-1.5 px-2 text-center">Takaran / Cup</th>
                                                <th className="py-1.5 px-2 text-right">Porsi Terjual</th>
                                                <th className="py-1.5 px-2 text-right">Volume Sales</th>
                                                <th className="py-1.5 px-2 text-right">Porsi Jatah</th>
                                                <th className="py-1.5 px-2 text-right">Volume Jatah</th>
                                                <th className="py-1.5 px-2 text-right font-bold">Total Cost (Rp)</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium">
                                              {menuBreakdownList.map(mb => (
                                                <tr key={mb.menuId} className="hover:bg-amber-50/40">
                                                  <td className="py-1.5 px-2 font-bold text-slate-900">{mb.menuNama}</td>
                                                  <td className="py-1.5 px-2 text-center font-mono">{mb.takaranPerCup} {ing.satuanTakaran}</td>
                                                  <td className="py-1.5 px-2 text-right font-mono text-emerald-800">{mb.terjual} cup</td>
                                                  <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-950">{mb.usageSales.toLocaleString('id-ID')} {ing.satuanTakaran}</td>
                                                  <td className="py-1.5 px-2 text-right font-mono text-amber-800">{mb.jatah} cup</td>
                                                  <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-950">{mb.usageJatah.toLocaleString('id-ID')} {ing.satuanTakaran}</td>
                                                  <td className="py-1.5 px-2 text-right font-mono font-extrabold text-slate-900">{formatRupiah(Math.round(mb.totalCost))}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* VIEW MODE 2: REKAP PER MENU PRODUK */}
                {ingredientViewMode === 'menu' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Rincian Pemakaian Bahan Baku Berdasarkan Penjualan & Jatah Per Menu
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700">
                            <th className="py-2.5 px-3">Nama Menu</th>
                            <th className="py-2.5 px-3 text-center">Porsi Terjual</th>
                            <th className="py-2.5 px-3 text-center">Porsi Jatah</th>
                            <th className="py-2.5 px-3">Komposisi Bahan Baku Terpakai</th>
                            <th className="py-2.5 px-3 text-right">Cost Sales (Rp)</th>
                            <th className="py-2.5 px-3 text-right">Cost Jatah (Rp)</th>
                            <th className="py-2.5 px-3 text-right font-black">Total Cost Bahan (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                          {ingredientUsageReport.menuList
                            .filter(m => {
                              if (!ingredientSearchQuery) return true;
                              const q = ingredientSearchQuery.toLowerCase();
                              return m.menuNama.toLowerCase().includes(q);
                            })
                            .map(m => (
                              <tr key={`menu-ing-row-${m.menuId}`} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-3 font-bold text-slate-900">
                                  <div>
                                    <span>{m.menuNama}</span>
                                    <span className="text-[9.5px] text-slate-400 block uppercase font-semibold">{m.kategori}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-emerald-900 bg-emerald-50/20">
                                  {m.terjual} cup
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-amber-900 bg-amber-50/20">
                                  {m.jatah} cup
                                </td>
                                <td className="py-3 px-3">
                                  {m.ingredientsUsed.length === 0 ? (
                                    <span className="text-slate-400 italic text-[11px]">Tidak ada resep/bahan baku</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {m.ingredientsUsed.map(iu => (
                                        <span key={iu.ingredientId} className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10.5px] font-semibold text-amber-950">
                                          {iu.ingredientNama}: <strong>{iu.totalUsageAll.toLocaleString('id-ID')} {iu.satuanTakaran}</strong>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-900">
                                  {formatRupiah(Math.round(m.costSales))}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-amber-900">
                                  {formatRupiah(Math.round(m.costJatah))}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-slate-950 bg-slate-100">
                                  {formatRupiah(Math.round(m.totalCost))}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 5: BARANG / BAHAN MASUK (INCOMING GOODS) */}
      {/* ========================================================================= */}
      {(activeSubTab === 'all' || activeSubTab === 'barang_masuk') && (
        <div id="sec-barang-masuk" className="space-y-6 scroll-mt-6">
          <IncomingGoodsModule
            ingredients={ingredients}
            incomingBatches={incomingBatches}
            onAddBatch={handleAddIncomingBatch}
            onUpdateBatch={handleUpdateIncomingBatch}
            onDeleteBatch={handleDeleteIncomingBatch}
            selectedMonth={selectedOmsetMonth}
            onChangeSelectedMonth={setSelectedOmsetMonth}
            availableMonths={availableMonths}
            onSyncFromSheet={handleRefreshIncomingFromSheet}
            isSyncingSheet={isSyncingSheet}
            lastSyncTime={lastSyncTime}
            spreadsheetUrl={spreadsheetUrl}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 6: FORUM TANYA AI DATABASE HPP & PENJUALAN MENU */}
      {/* ========================================================================= */}
      {(activeSubTab === 'all' || activeSubTab === 'forum_ai_hpp') && (
        <div id="sec-forum-ai-hpp" className="space-y-6 scroll-mt-6">
          <HppAiForum
            menuCatalog={menuItems as any}
            rawIngredients={ingredients as any}
            dailySales={dailySales as any}
            onApplySuggestedPrice={applyIdealPriceToMenuItem}
          />
        </div>
      )}

      {/* Recipe PDF Export Modal */}
      <RecipePdfModal
        isOpen={showRecipePdfModal}
        onClose={() => setShowRecipePdfModal(false)}
        selectedMenu={pdfModalSelectedMenu}
        menuItems={menuItems}
        ingredients={ingredients}
        spreadsheetName={spreadsheetName}
      />

      {/* Comprehensive Sales, COGS & Incoming Goods PDF Report Modal */}
      {showSalesCogsReportPdfModal && (
        <SalesCogsReportPdfModal
          isOpen={showSalesCogsReportPdfModal}
          onClose={() => setShowSalesCogsReportPdfModal(false)}
          dailySales={dailySales}
          menuCatalog={menuItems}
          ingredients={ingredients}
          incomingBatches={incomingBatches}
          defaultMonth={selectedOmsetMonth}
          cafeName={spreadsheetName ? spreadsheetName.replace(/\.(xlsx|csv|gsheet)$/i, '') : 'Basco Coffee & Roastery'}
        />
      )}

    </div>
  );
}
