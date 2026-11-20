import mysql, { Pool, PoolOptions } from 'mysql2/promise';

export interface MySqlStatus {
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

let pool: Pool | null = null;
let isDbConnected = false;
let lastDbError = '';
let initPromise: Promise<MySqlStatus> | null = null;

const isConfiguredForCurrentEnv = (host: string, connUrl: string): boolean => {
  if (connUrl && connUrl.trim().length > 0) return true;
  if (process.env.VERCEL && (host === '127.0.0.1' || host === 'localhost')) {
    return false;
  }
  return true;
};

const getDbConfig = (): PoolOptions & { database: string; host: string; port: number; user: string } => {
  const connUrl = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
  if (connUrl.trim()) {
    try {
      const parsed = new URL(connUrl.trim());
      const host = parsed.hostname || '127.0.0.1';
      const port = Number(parsed.port) || 3306;
      const user = decodeURIComponent(parsed.username || 'root');
      const password = decodeURIComponent(parsed.password || '');
      const database = parsed.pathname.replace(/^\//, '') || 'basco_cashflow';
      const isRemote = host !== '127.0.0.1' && host !== 'localhost';
      const useSsl =
        process.env.MYSQL_SSL === 'true' ||
        process.env.MYSQL_SSL === '1' ||
        connUrl.toLowerCase().includes('ssl') ||
        isRemote;

      return {
        host,
        port,
        user,
        password,
        database,
        ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false } } : {}),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 8000,
      };
    } catch (e) {
      console.warn('[MySQL] Invalid MYSQL_URL format, falling back to individual env vars');
    }
  }

  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const isRemote = host !== '127.0.0.1' && host !== 'localhost';
  const useSsl =
    process.env.MYSQL_SSL === 'true' ||
    process.env.MYSQL_SSL === '1' ||
    isRemote;

  return {
    host,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'basco_cashflow',
    ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false } } : {}),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 8000,
  };
};

/**
 * Initialize MySQL Connection Pool and Auto-Create Tables
 */
export async function initMySql(): Promise<MySqlStatus> {
  const config = getDbConfig();
  const dbName = config.database;
  const connUrl = process.env.MYSQL_URL || process.env.DATABASE_URL || '';

  if (!isConfiguredForCurrentEnv(config.host, connUrl)) {
    isDbConnected = false;
    lastDbError = 'MYSQL_URL belum diisi di Vercel Environment Variables.';
    return buildStatus(config, 0);
  }

  try {
    // 1. Best-effort: try to create DB if user has CREATE privilege (skipped gracefully on managed Cloud MySQL like Aiven/TiDB)
    try {
      const rootConn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        ...(config.ssl ? { ssl: config.ssl } : {}),
        connectTimeout: 6000
      });

      await rootConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
      await rootConn.end();
    } catch {
      // Managed cloud MySQL often pre-creates the database and restricts CREATE DATABASE
    }

    // 2. Create the main application pool directly to target database
    if (pool) {
      try { await pool.end(); } catch {}
    }
    pool = mysql.createPool(config);

    // Test connection
    const testConn = await pool.getConnection();
    
    // 3. Create tables if they do not exist
    await testConn.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        tanggal DATE NOT NULL,
        keterangan VARCHAR(255) NOT NULL,
        kategori VARCHAR(100) DEFAULT '',
        jenis_pengeluaran VARCHAR(100) DEFAULT '',
        debit DECIMAL(14,2) DEFAULT 0,
        kredit DECIMAL(14,2) DEFAULT 0,
        kredit2 DECIMAL(14,2) DEFAULT 0,
        saldo DECIMAL(14,2) DEFAULT 0,
        waktu VARCHAR(20) DEFAULT '',
        catatan TEXT,
        is_tempo TINYINT(1) DEFAULT 0,
        tanggal_tempo VARCHAR(30) DEFAULT '',
        status_bayar VARCHAR(30) DEFAULT 'lunas',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tgl (tanggal),
        INDEX idx_kat (kategori)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await testConn.query(`
      CREATE TABLE IF NOT EXISTS menu_catalog (
        id VARCHAR(64) PRIMARY KEY,
        nama VARCHAR(150) NOT NULL,
        kategori VARCHAR(80) DEFAULT 'Minuman',
        harga_jual DECIMAL(14,2) NOT NULL DEFAULT 0,
        hpp DECIMAL(14,2) NOT NULL DEFAULT 0,
        default_jatah INT DEFAULT 0,
        aliases TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_menu_nama (nama)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await testConn.query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id VARCHAR(64) PRIMARY KEY,
        nama_bahan VARCHAR(150) NOT NULL,
        harga_beli DECIMAL(14,2) NOT NULL DEFAULT 0,
        satuan_beli VARCHAR(50) DEFAULT 'gram',
        takaran_per_cup DECIMAL(12,2) DEFAULT 0,
        satuan_takaran VARCHAR(50) DEFAULT 'gram',
        stok_saat_ini DECIMAL(14,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await testConn.query(`
      CREATE TABLE IF NOT EXISTS daily_sales (
        id VARCHAR(64) PRIMARY KEY,
        tanggal DATE UNIQUE NOT NULL,
        cups INT DEFAULT 0,
        omset DECIMAL(14,2) DEFAULT 0,
        hpp_total DECIMAL(14,2) DEFAULT 0,
        notes TEXT,
        menu_sales_json LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sales_tgl (tanggal)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await testConn.query(`
      CREATE TABLE IF NOT EXISTS fixed_costs (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await testConn.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id VARCHAR(64) PRIMARY KEY,
        kreditor VARCHAR(150) NOT NULL,
        total_pinjaman DECIMAL(14,2) NOT NULL DEFAULT 0,
        sisa_hutang DECIMAL(14,2) NOT NULL DEFAULT 0,
        angsuran_per_bulan DECIMAL(14,2) NOT NULL DEFAULT 0,
        jatuh_tempo_tgl INT DEFAULT 1,
        status VARCHAR(30) DEFAULT 'aktif',
        catatan TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await testConn.query(`
      CREATE TABLE IF NOT EXISTS global_evaluations (
        id VARCHAR(64) PRIMARY KEY,
        timestamp_str VARCHAR(50),
        timeframe_mode VARCHAR(20) NOT NULL,
        period_label VARCHAR(100) NOT NULL,
        omset_penjualan DECIMAL(14,2) DEFAULT 0,
        cash_inflow DECIMAL(14,2) DEFAULT 0,
        cash_outflow DECIMAL(14,2) DEFAULT 0,
        net_cashflow DECIMAL(14,2) DEFAULT 0,
        total_fixed_cost DECIMAL(14,2) DEFAULT 0,
        total_debt_installment DECIMAL(14,2) DEFAULT 0,
        total_cogs DECIMAL(14,2) DEFAULT 0,
        operating_profit DECIMAL(14,2) DEFAULT 0,
        net_profit DECIMAL(14,2) DEFAULT 0,
        net_margin_pct DECIMAL(6,2) DEFAULT 0,
        fixed_cost_ratio_pct DECIMAL(6,2) DEFAULT 0,
        status VARCHAR(40) DEFAULT 'SEHAT',
        ai_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    testConn.release();
    isDbConnected = true;
    lastDbError = '';

    console.log(`[MySQL] Berhasil terhubung ke database "${dbName}" di ${config.host}:${config.port}`);
    return getMySqlStatus();
  } catch (error: any) {
    isDbConnected = false;
    lastDbError = error?.message || 'Gagal terhubung ke MySQL.';
    console.warn(`[MySQL] Standby / Offline: ${lastDbError} (Aplikasi tetap berjalan normal menggunakan Local & Google Sheets)`);
    return getMySqlStatus();
  }
}

function buildStatus(config: { host: string; port: number; database: string; user: string }, tableCount: number): MySqlStatus {
  return {
    enabled: true,
    connected: isDbConnected,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    tableCount,
    message: isDbConnected
      ? `Terhubung ke MySQL (${config.database} - ${tableCount} tabel aktif)`
      : `MySQL Standby: ${lastDbError || 'Server MySQL belum terkonfigurasi'}`,
    lastChecked: new Date().toISOString()
  };
}

export async function ensureMySqlReady(): Promise<boolean> {
  if (pool && isDbConnected) return true;
  if (!initPromise) {
    initPromise = initMySql().finally(() => {
      initPromise = null;
    });
  }
  await initPromise;
  return isDbConnected;
}

/**
 * Get Current Status of MySQL
 */
export async function getMySqlStatus(): Promise<MySqlStatus> {
  await ensureMySqlReady();
  const config = getDbConfig();
  let tableCount = 0;

  if (pool && isDbConnected) {
    try {
      const [rows]: any = await pool.query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?",
        [config.database]
      );
      tableCount = rows?.[0]?.count || 0;
    } catch {
      // ignore
    }
  }

  return buildStatus(config, tableCount);
}

// -----------------------------------------------------------------------------
// TRANSACTIONS (Buku Kas & Mutasi Kas)
// -----------------------------------------------------------------------------
export async function syncTransactionsToMySql(transactions: any[]): Promise<{ count: number }> {
  if (!(await ensureMySqlReady()) || !pool || !Array.isArray(transactions) || transactions.length === 0) {
    return { count: 0 };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const sql = `
      INSERT INTO transactions (
        id, tanggal, keterangan, kategori, jenis_pengeluaran, 
        debit, kredit, kredit2, saldo, waktu, catatan, is_tempo, tanggal_tempo, status_bayar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        tanggal = VALUES(tanggal),
        keterangan = VALUES(keterangan),
        kategori = VALUES(kategori),
        jenis_pengeluaran = VALUES(jenis_pengeluaran),
        debit = VALUES(debit),
        kredit = VALUES(kredit),
        kredit2 = VALUES(kredit2),
        saldo = VALUES(saldo),
        waktu = VALUES(waktu),
        catatan = VALUES(catatan),
        is_tempo = VALUES(is_tempo),
        tanggal_tempo = VALUES(tanggal_tempo),
        status_bayar = VALUES(status_bayar);
    `;

    for (const t of transactions) {
      if (!t || !t.id || !t.tanggal) continue;
      // Format YYYY-MM-DD
      const tglMatch = String(t.tanggal).match(/\d{4}-\d{2}-\d{2}/);
      const safeTgl = tglMatch ? tglMatch[0] : new Date().toISOString().split('T')[0];

      await conn.query(sql, [
        String(t.id),
        safeTgl,
        String(t.keterangan || '').slice(0, 255),
        String(t.kategori || '').slice(0, 100),
        String(t.jenisPengeluaran || '').slice(0, 100),
        Number(t.debit) || 0,
        Number(t.kredit) || 0,
        Number(t.kredit2) || 0,
        Number(t.saldo) || 0,
        String(t.waktu || '').slice(0, 20),
        String(t.catatan || ''),
        t.isTempo ? 1 : 0,
        String(t.tanggalTempo || '').slice(0, 30),
        String(t.statusBayar || 'lunas').slice(0, 30)
      ]);
    }

    await conn.commit();
    return { count: transactions.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getTransactionsFromMySql(): Promise<any[]> {
  if (!(await ensureMySqlReady()) || !pool) return [];
  const [rows]: any = await pool.query(
    "SELECT * FROM transactions ORDER BY tanggal ASC, created_at ASC"
  );
  return (rows || []).map((r: any) => ({
    id: r.id,
    tanggal: r.tanggal instanceof Date ? r.tanggal.toISOString().split('T')[0] : String(r.tanggal),
    keterangan: r.keterangan,
    kategori: r.kategori,
    jenisPengeluaran: r.jenis_pengeluaran,
    debit: Number(r.debit) || 0,
    kredit: Number(r.kredit) || 0,
    kredit2: Number(r.kredit2) || 0,
    saldo: Number(r.saldo) || 0,
    waktu: r.waktu,
    catatan: r.catatan,
    isTempo: Boolean(r.is_tempo),
    tanggalTempo: r.tanggal_tempo,
    statusBayar: r.status_bayar
  }));
}

// -----------------------------------------------------------------------------
// DAILY SALES & MENU SALES
// -----------------------------------------------------------------------------
export async function syncDailySalesToMySql(records: any[]): Promise<{ count: number }> {
  if (!(await ensureMySqlReady()) || !pool || !Array.isArray(records) || records.length === 0) {
    return { count: 0 };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const sql = `
      INSERT INTO daily_sales (
        id, tanggal, cups, omset, hpp_total, notes, menu_sales_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cups = VALUES(cups),
        omset = VALUES(omset),
        hpp_total = VALUES(hpp_total),
        notes = VALUES(notes),
        menu_sales_json = VALUES(menu_sales_json);
    `;

    for (const r of records) {
      if (!r || !r.tanggal) continue;
      const tglMatch = String(r.tanggal).match(/\d{4}-\d{2}-\d{2}/);
      const safeTgl = tglMatch ? tglMatch[0] : String(r.tanggal);

      const calcCups = Array.isArray(r.menuSales) && r.menuSales.length > 0
        ? r.menuSales.reduce((s: number, ms: any) => s + (Number(ms?.terjual) || 0), 0)
        : (Number(r.cups) > 0 && Number(r.cups) < 50000 ? Number(r.cups) : 0);

      await conn.query(sql, [
        String(r.id || `ds-${safeTgl}`),
        safeTgl,
        calcCups,
        Number(r.omset) || 0,
        Number(r.hppTotal) || 0,
        String(r.notes || ''),
        JSON.stringify(r.menuSales || [])
      ]);
    }

    await conn.commit();
    return { count: records.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getDailySalesFromMySql(): Promise<any[]> {
  if (!(await ensureMySqlReady()) || !pool) return [];
  const [rows]: any = await pool.query("SELECT * FROM daily_sales ORDER BY tanggal ASC");
  return (rows || []).map((r: any) => {
    let menuSales: any[] = [];
    if (r.menu_sales_json) {
      try { menuSales = JSON.parse(r.menu_sales_json); } catch {}
    }
    return {
      id: r.id,
      tanggal: r.tanggal instanceof Date ? r.tanggal.toISOString().split('T')[0] : String(r.tanggal),
      cups: Number(r.cups) || 0,
      omset: Number(r.omset) || 0,
      hppTotal: Number(r.hpp_total) || 0,
      notes: r.notes || '',
      menuSales
    };
  });
}

// -----------------------------------------------------------------------------
// MENU CATALOG
// -----------------------------------------------------------------------------
export async function syncMenuCatalogToMySql(items: any[]): Promise<{ count: number }> {
  if (!(await ensureMySqlReady()) || !pool || !Array.isArray(items) || items.length === 0) {
    return { count: 0 };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const sql = `
      INSERT INTO menu_catalog (
        id, nama, kategori, harga_jual, hpp, default_jatah, aliases
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nama = VALUES(nama),
        kategori = VALUES(kategori),
        harga_jual = VALUES(harga_jual),
        hpp = VALUES(hpp),
        default_jatah = VALUES(default_jatah),
        aliases = VALUES(aliases);
    `;

    for (const m of items) {
      if (!m || !m.nama) continue;
      await conn.query(sql, [
        String(m.id || `m-${m.nama.toLowerCase().replace(/[^a-z0-9]/g, '-')}`),
        String(m.nama).slice(0, 150),
        String(m.kategori || 'Minuman').slice(0, 80),
        Number(m.hargaJual) || 0,
        Number(m.hpp) || 0,
        Number(m.defaultJatah) || 0,
        Array.isArray(m.aliases) ? JSON.stringify(m.aliases) : ''
      ]);
    }

    await conn.commit();
    return { count: items.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getMenuCatalogFromMySql(): Promise<any[]> {
  if (!(await ensureMySqlReady()) || !pool) return [];
  const [rows]: any = await pool.query("SELECT * FROM menu_catalog ORDER BY nama ASC");
  return (rows || []).map((r: any) => {
    let aliases: string[] = [];
    if (r.aliases) {
      try { aliases = JSON.parse(r.aliases); } catch {}
    }
    return {
      id: r.id,
      nama: r.nama,
      kategori: r.kategori,
      hargaJual: Number(r.harga_jual) || 0,
      hpp: Number(r.hpp) || 0,
      defaultJatah: Number(r.default_jatah) || 0,
      aliases
    };
  });
}

// -----------------------------------------------------------------------------
// FIXED COSTS & DEBTS
// -----------------------------------------------------------------------------
export async function syncFixedCostsToMySql(costs: any[]): Promise<{ count: number }> {
  if (!(await ensureMySqlReady()) || !pool || !Array.isArray(costs) || costs.length === 0) return { count: 0 };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const sql = `
      INSERT INTO fixed_costs (id, name, category, amount)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        amount = VALUES(amount);
    `;
    for (const c of costs) {
      if (!c || !c.name) continue;
      await conn.query(sql, [
        String(c.id || `fc-${Date.now()}`),
        String(c.name).slice(0, 150),
        String(c.category || 'Operasional').slice(0, 100),
        Number(c.amount) || 0
      ]);
    }
    await conn.commit();
    return { count: costs.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getFixedCostsFromMySql(): Promise<any[]> {
  if (!(await ensureMySqlReady()) || !pool) return [];
  const [rows]: any = await pool.query("SELECT * FROM fixed_costs ORDER BY category ASC, name ASC");
  return (rows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    amount: Number(r.amount) || 0
  }));
}

export async function syncDebtsToMySql(debts: any[]): Promise<{ count: number }> {
  if (!(await ensureMySqlReady()) || !pool || !Array.isArray(debts) || debts.length === 0) return { count: 0 };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const sql = `
      INSERT INTO debts (id, kreditor, total_pinjaman, sisa_hutang, angsuran_per_bulan, jatuh_tempo_tgl, status, catatan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        kreditor = VALUES(kreditor),
        total_pinjaman = VALUES(total_pinjaman),
        sisa_hutang = VALUES(sisa_hutang),
        angsuran_per_bulan = VALUES(angsuran_per_bulan),
        jatuh_tempo_tgl = VALUES(jatuh_tempo_tgl),
        status = VALUES(status),
        catatan = VALUES(catatan);
    `;
    for (const d of debts) {
      if (!d || !d.kreditor) continue;
      await conn.query(sql, [
        String(d.id || `debt-${Date.now()}`),
        String(d.kreditor).slice(0, 150),
        Number(d.totalPinjaman || d.totalPokok) || 0,
        Number(d.sisaHutang) || 0,
        Number(d.angsuranPerBulan) || 0,
        Number(d.jatuhTempoTgl) || 1,
        String(d.status || 'aktif').slice(0, 30),
        String(d.catatan || '')
      ]);
    }
    await conn.commit();
    return { count: debts.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getDebtsFromMySql(): Promise<any[]> {
  if (!(await ensureMySqlReady()) || !pool) return [];
  const [rows]: any = await pool.query("SELECT * FROM debts ORDER BY status ASC, kreditor ASC");
  return (rows || []).map((r: any) => ({
    id: r.id,
    kreditor: r.kreditor,
    totalPinjaman: Number(r.total_pinjaman) || 0,
    sisaHutang: Number(r.sisa_hutang) || 0,
    angsuranPerBulan: Number(r.angsuran_per_bulan) || 0,
    jatuhTempoTgl: Number(r.jatuh_tempo_tgl) || 1,
    status: r.status,
    catatan: r.catatan
  }));
}

// -----------------------------------------------------------------------------
// GLOBAL EVALUATION SNAPSHOT
// -----------------------------------------------------------------------------
export async function saveGlobalEvaluationToMySql(s: any): Promise<boolean> {
  if (!(await ensureMySqlReady()) || !pool || !s) return false;
  try {
    const sql = `
      INSERT INTO global_evaluations (
        id, timestamp_str, timeframe_mode, period_label,
        omset_penjualan, cash_inflow, cash_outflow, net_cashflow,
        total_fixed_cost, total_debt_installment, total_cogs,
        operating_profit, net_profit, net_margin_pct, fixed_cost_ratio_pct,
        status, ai_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        period_label = VALUES(period_label),
        omset_penjualan = VALUES(omset_penjualan),
        net_profit = VALUES(net_profit),
        ai_summary = VALUES(ai_summary);
    `;
    await pool.query(sql, [
      String(s.id || `eval-${Date.now()}`),
      String(s.timestamp || new Date().toLocaleString('id-ID')),
      String(s.timeframeMode || 'bulanan'),
      String(s.periodLabel || ''),
      Number(s.omsetPenjualan) || 0,
      Number(s.cashInflow) || 0,
      Number(s.cashOutflow) || 0,
      Number(s.netCashflow) || 0,
      Number(s.totalFixedCost) || 0,
      Number(s.totalDebtInstallment) || 0,
      Number(s.totalCogs) || 0,
      Number(s.operatingProfit) || 0,
      Number(s.netProfit) || 0,
      Number(s.netMarginPct) || 0,
      Number(s.fixedCostRatioPct) || 0,
      String(s.status || 'SEHAT'),
      String(s.aiSummary || '')
    ]);
    return true;
  } catch (err) {
    console.warn("Could not save global evaluation to MySQL:", err);
    return false;
  }
}
