/**
 * Client-Side MySQL Service & Dual-Sync Helper
 * Allows seamless dual-storage: writes to MySQL while syncing with Google Sheets.
 */

export interface MySqlStatusInfo {
  enabled: boolean;
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  message: string;
  tableCount?: number;
  lastChecked: string;
}

let cachedStatus: MySqlStatusInfo | null = null;
let lastCheckTime = 0;

/**
 * Check MySQL Server Connection Status
 */
export async function fetchMySqlStatus(forceRefresh = false): Promise<MySqlStatusInfo> {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && (now - lastCheckTime < 15000)) {
    return cachedStatus;
  }

  try {
    const res = await fetch('/api/mysql/status', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      cachedStatus = data;
      lastCheckTime = now;
      return data;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err: any) {
    const fallbackStatus: MySqlStatusInfo = {
      enabled: true,
      connected: false,
      host: '127.0.0.1',
      port: 3306,
      database: 'basco_cashflow',
      user: 'root',
      message: 'Server backend / MySQL tidak terjangkau.',
      lastChecked: new Date().toISOString()
    };
    cachedStatus = fallbackStatus;
    return fallbackStatus;
  }
}

/**
 * Retry / Re-initialize MySQL connection
 */
export async function retryMySqlConnection(): Promise<MySqlStatusInfo> {
  try {
    const res = await fetch('/api/mysql/init', { method: 'POST', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      cachedStatus = data;
      lastCheckTime = Date.now();
      return data;
    }
  } catch {}
  return fetchMySqlStatus(true);
}

/**
 * Dual-Save Helper: Save Transactions to MySQL (Fire & Forget or Await)
 */
export async function saveTransactionsToMySql(transactions: any[]): Promise<boolean> {
  if (!Array.isArray(transactions) || transactions.length === 0) return true;
  try {
    const res = await fetch('/api/mysql/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Dual-Storage] Simpan transaksi ke MySQL tertunda:', e);
    return false;
  }
}

/**
 * Dual-Save Helper: Save Daily Sales & Itemized Menu Sales to MySQL
 */
export async function saveDailySalesToMySql(records: any[]): Promise<boolean> {
  if (!Array.isArray(records) || records.length === 0) return true;
  try {
    const res = await fetch('/api/mysql/daily-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Dual-Storage] Simpan penjualan harian ke MySQL tertunda:', e);
    return false;
  }
}

/**
 * Dual-Save Helper: Save Menu Catalog to MySQL
 */
export async function saveMenuCatalogToMySql(items: any[]): Promise<boolean> {
  if (!Array.isArray(items) || items.length === 0) return true;
  try {
    const res = await fetch('/api/mysql/menu-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Dual-Storage] Simpan katalog menu ke MySQL tertunda:', e);
    return false;
  }
}

/**
 * Dual-Save Helper: Save Fixed Costs to MySQL
 */
export async function saveFixedCostsToMySql(costs: any[]): Promise<boolean> {
  if (!Array.isArray(costs) || costs.length === 0) return true;
  try {
    const res = await fetch('/api/mysql/fixed-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costs })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Dual-Storage] Simpan fixed costs ke MySQL tertunda:', e);
    return false;
  }
}

/**
 * Dual-Save Helper: Save Debts to MySQL
 */
export async function saveDebtsToMySql(debts: any[]): Promise<boolean> {
  if (!Array.isArray(debts) || debts.length === 0) return true;
  try {
    const res = await fetch('/api/mysql/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debts })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Dual-Storage] Simpan hutang ke MySQL tertunda:', e);
    return false;
  }
}

/**
 * Dual-Save Helper: Save Global Performance Snapshot to MySQL
 */
export async function saveGlobalEvaluationToMySql(snapshot: any): Promise<boolean> {
  if (!snapshot) return false;
  try {
    const res = await fetch('/api/mysql/global-evaluation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Dual-Storage] Simpan evaluasi ke MySQL tertunda:', e);
    return false;
  }
}

/**
 * Sync ALL data bundle to MySQL in one atomic call
 */
export async function syncAllToMySql(bundle: {
  transactions?: any[];
  dailySales?: any[];
  menuCatalog?: any[];
  fixedCosts?: any[];
  debts?: any[];
}): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/mysql/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle)
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: 'Berhasil menyinkronkan seluruh data ke MySQL!' };
    }
    const errData = await res.json().catch(() => ({}));
    return { ok: false, message: errData.error || 'Gagal sinkron ke MySQL.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Koneksi ke server MySQL gagal.' };
  }
}

/**
 * Pull all data from MySQL
 */
export async function fetchAllFromMySql(): Promise<{
  transactions: any[];
  dailySales: any[];
  menuCatalog: any[];
  fixedCosts: any[];
  debts: any[];
} | null> {
  try {
    const [txRes, dsRes, menuRes, fcRes, debtRes] = await Promise.all([
      fetch('/api/mysql/transactions').then(r => r.ok ? r.json() : []),
      fetch('/api/mysql/daily-sales').then(r => r.ok ? r.json() : []),
      fetch('/api/mysql/menu-catalog').then(r => r.ok ? r.json() : []),
      fetch('/api/mysql/fixed-costs').then(r => r.ok ? r.json() : []),
      fetch('/api/mysql/debts').then(r => r.ok ? r.json() : [])
    ]);

    return {
      transactions: Array.isArray(txRes) ? txRes : [],
      dailySales: Array.isArray(dsRes) ? dsRes : [],
      menuCatalog: Array.isArray(menuRes) ? menuRes : [],
      fixedCosts: Array.isArray(fcRes) ? fcRes : [],
      debts: Array.isArray(debtRes) ? debtRes : []
    };
  } catch (e) {
    console.warn('Gagal memuat data dari MySQL:', e);
    return null;
  }
}
