import { Transaction, Barista, ShiftMaster, BaristaScheduleEntry, BaristaRole, ShiftScheduleStatus, IncomingIngredientBatch, StockOpnameEntry, MonthlyStockOpnameReport } from './types';
import { CalendarNoteActivity, ActivityCategory, ActivityPriority } from './types/calendarNotes';
import { ShoppingIngredientItem, ShoppingUrgency, ShoppingStatus } from './types/shoppingList';
import { EmployeeTask } from './types/employeeTask';
import { parseDateString } from './utils';
import { saveCloudSlot, loadCloudSlot, pushDailySalesToCloud, pullDailySalesFromCloud } from './utils/cloudSync';

// Fetch the sheetId and properties for Sheet1 or other sheets
async function getSheetId(spreadsheetId: string, accessToken: string): Promise<number> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return 0;
  const data = await res.json();
  const sheets = data.sheets || [];
  if (sheets.length > 0) {
    return sheets[0].properties.sheetId || 0;
  }
  return 0;
}

// Extract clean spreadsheet ID from either a full URL or a raw ID
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

// Fetch spreadsheet details (validates existence and permissions)
export async function getSpreadsheetDetails(spreadsheetIdOrUrl: string, accessToken: string): Promise<{ id: string; name: string; url: string }> {
  const cleanId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!cleanId) {
    throw new Error('ID atau Link Google Spreadsheet tidak valid.');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 404) {
      throw new Error('Google Spreadsheet tidak ditemukan. Periksa kembali ID atau Link yang dimasukkan.');
    } else if (res.status === 403 || res.status === 401) {
      if (errorText.includes('has not been used') || errorText.includes('disabled') || errorText.includes('SERVICE_DISABLED')) {
        throw new Error('Google Sheets API belum diaktifkan di project Firebase Anda. Aktifkan di: https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=basco-cashflow');
      }
      throw new Error(`Izin akses ditolak (403). Pastikan akun yang login memiliki akses Editor pada file spreadsheet tersebut, serta centang izin Google Sheets & Drive saat login.`);
    }
    throw new Error(`Gagal membuka spreadsheet (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const name = data.properties?.title || 'Basco Cashflow';
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;

  return { id: cleanId, name, url: spreadsheetUrl };
}

// Find existing spreadsheet in user's Google Drive
export async function findExistingSpreadsheet(accessToken: string): Promise<{ id: string; name: string } | null> {
  try {
    const query = encodeURIComponent("(name = 'Dasbor Arus Kas Keuangan' or name = 'Basco Cashflow' or name contains 'Basco') and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=5`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!res.ok) {
      console.error('Failed to search Drive files:', await res.text());
      return null;
    }
    
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return { id: data.files[0].id, name: data.files[0].name };
    }
    return null;
  } catch (error) {
    console.error('Error finding spreadsheet:', error);
    return null;
  }
}

// Create a new spreadsheet with header and initial sample data
export async function createSpreadsheet(accessToken: string): Promise<{ id: string; url: string }> {
  // Create spreadsheet structure
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: 'Basco Cashflow'
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal membuat spreadsheet: ${err}`);
  }

  const spreadsheet = await res.json();
  const id = spreadsheet.spreadsheetId;
  const url = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${id}/edit`;

  // Write headers and some sample financial transactions to make the dashboard active immediately
  const headers = ["Tanggal", "Debit", "Kredit", "Pengeluaran 1", "Jumlah Keterangan", "Keterangan", "Keterangan Detail", "Klasifikasi"];
  const initialData = [
    headers,
    ["2026-06-01", "24500000", "0", "-", "0", "-", "Pemasukan Penjualan Kasir POS (Minggu 1 Juni)", "-"],
    ["2026-06-03", "0", "4800000", "Bahan Baku & HPP (COGS)", "0", "-", "Susu Fresh Milk, Biji Kopi Blend, Sirup Karamel", "Operasional"],
    ["2026-06-05", "0", "1200000", "Operasional & Sewa Tempat", "0", "-", "Listrik & Wifi Cafe Kece", "Operasional"],
    ["2026-06-10", "28900000", "0", "-", "0", "-", "Pemasukan Penjualan Kasir POS (Minggu 2-3 Juni)", "-"],
    ["2026-06-12", "0", "450000", "Promosi & Marketing", "0", "-", "Sponsorship Event Musik Akustik & Selebaran", "Operasional"],
    ["2026-06-18", "0", "850000", "Peralatan & Inventaris", "0", "-", "Beli Gelas Latte, Sedotan Bambu, & Cup Sealer", "Operasional"],
    ["2026-06-25", "0", "7500000", "Gaji Karyawan & Barista", "0", "-", "Gaji 2 Barista & 1 Staff Dapur", "Manajemen"],
    ["2026-06-28", "21200500", "0", "-", "0", "-", "Pemasukan Penjualan Kasir POS (Minggu 4 Juni)", "-"],
    ["2026-07-01", "0", "3500000", "Bahan Baku & HPP (COGS)", "1500000", "Peralatan & Inventaris", "Bahan Baku Juli & Sewa Mesin Espresso La Marzocco", "Operasional"],
    ["2026-07-02", "12500000", "0", "-", "0", "-", "Sewa Lantai 2 untuk Event & Workshop Kopi", "-"],
    ["2026-07-02", "0", "450000", "Promosi & Marketing", "0", "-", "Iklan Instagram Ads & TikTok Promos", "Operasional"]
  ];

  await appendRows(id, "Sheet1!A1", initialData, accessToken);

  return { id, url };
}

// Append rows of data
export async function appendRows(spreadsheetId: string, range: string, values: string[][], accessToken: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal menulis data ke spreadsheet: ${err}`);
  }
}

// Parse RFC-4180 CSV text into 2D string array
function parseCsvToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

// Fetch sheet rows via OAuth API first, and automatically fallback to public/link-shared Google Sheets CSV endpoint
export async function fetchSheetRowsWithFallback(
  spreadsheetId: string,
  sheetName: string,
  range: string,
  accessToken?: string | null
): Promise<string[][] | null> {
  if (!spreadsheetId || spreadsheetId.startsWith('local_')) return null;

  const hasValidOAuth = Boolean(accessToken && !accessToken.endsWith('-local-token'));

  if (hasValidOAuth) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.values || [];
      }
      if (res.status === 400 || res.status === 404) {
        return null;
      }
    } catch {
      // Fall through to public CSV fallback
    }
  }

  // Public / Link-shared Google Sheets CSV fallback (works across all devices without OAuth token!)
  try {
    const isSheet1 = sheetName.trim().toLowerCase() === 'sheet1';
    const csvUrl = isSheet1
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`
      : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    let csvRes = await fetch(csvUrl);
    if (!csvRes.ok && isSheet1) {
      csvRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);
    }
    if (!csvRes.ok) return null;
    const csvText = await csvRes.text();
    if (!csvText || csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
      return null;
    }
    const rows = parseCsvToRows(csvText);
    if (rows.length === 0) return [];

    // Google gviz falls back to Sheet1 (gid=0) if a requested sheetName does not exist.
    // Detect that case so non-existent tabs return null instead of Sheet1 rows.
    if (!isSheet1) {
      const r0 = rows[0] || [];
      if (
        r0[0]?.trim() === 'Tanggal' &&
        r0[1]?.trim() === 'Debit' &&
        r0[2]?.trim() === 'Kredit' &&
        r0[3]?.trim() === 'Pengeluaran 1'
      ) {
        return null;
      }
    }

    return rows;
  } catch (err) {
    console.warn(`Public fallback fetch failed for ${sheetName}:`, err);
    return null;
  }
}

// Fetch all transactions from spreadsheet
export async function fetchTransactions(spreadsheetId: string, accessToken: string): Promise<Transaction[]> {
  const range = "Sheet1!A1:H5000"; // Reading up to 5000 records
  const rows = await fetchSheetRowsWithFallback(spreadsheetId, "Sheet1", range, accessToken);

  if (!rows) {
    throw new Error(`Gagal mengambil data dari Google Sheets. Silakan periksa koneksi internet.`);
  }
  
  if (rows.length > 0 && accessToken && !accessToken.endsWith('-local-token')) {
    // Perform self-healing check for headers asynchronously so it doesn't block fetching
    const currentHeaders = rows[0];
    ensureCorrectHeaders(spreadsheetId, currentHeaders, accessToken).catch(err => {
      console.error("Gagal menyelaraskan header spreadsheet:", err);
    });
  }
  
  if (rows.length <= 1) {
    return []; // Only header or empty sheet
  }

  const transactions: Transaction[] = [];
  
  // Skip row 0 (headers)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawTanggal = row[0] || "";
    // If the date column is blank or matches header, skip
    if (!rawTanggal || String(rawTanggal).trim().toLowerCase() === "tanggal") continue;

    const tanggal = normalizeDateString(rawTanggal) || String(rawTanggal).trim();
    const debit = parseSheetNumber(row[1]);
    const kredit = parseSheetNumber(row[2]);
    const jenisPengeluaran = (row[3] || "").trim() || "Lain-lain";
    const kredit2 = parseSheetNumber(row[4]);
    const rawCol5 = (row[5] || "").trim();
    const rawCol6 = (row[6] || "").trim();
    // In Sheet1, Header F is "Keterangan" and Header G is "Keterangan Detail".
    // If Column G is empty, Column F is the Keterangan (note) and the category is Column D (Pengeluaran 1).
    const jenisPengeluaran2 = rawCol6 ? (rawCol5 || "-") : "-";
    const keterangan = rawCol6 ? rawCol6 : rawCol5;
    const operasionalDanManajemen = (row[7] || "").trim() || "-";

    // Skip completely empty rows where debit, kredit, and kredit2 are all 0 and no category/note is present
    if (debit === 0 && kredit === 0 && kredit2 === 0 && jenisPengeluaran === "Lain-lain" && !keterangan) {
      continue;
    }

    transactions.push({
      id: String(i + 1), // Store row index (1-indexed, e.g. row 2 has id "2")
      tanggal,
      debit,
      kredit,
      kredit2,
      jenisPengeluaran,
      jenisPengeluaran2,
      keterangan,
      operasionalDanManajemen
    });
  }

  // Merge cross-device cloud delta (transactions added/edited/deleted via password login)
  let finalTransactions = transactions;
  try {
    const txDelta = await loadCloudSlot<{
      added?: Transaction[];
      edited?: Record<string, Omit<Transaction, 'id'>>;
      deletedIds?: string[];
    }>('tx_delta');
    if (txDelta) {
      const deletedSet = new Set(txDelta.deletedIds || []);
      finalTransactions = finalTransactions
        .filter(t => !deletedSet.has(t.id))
        .map(t => (txDelta.edited && txDelta.edited[t.id] ? { ...txDelta.edited[t.id], id: t.id } : t));

      if (Array.isArray(txDelta.added)) {
        txDelta.added.forEach(addTx => {
          if (!addTx || deletedSet.has(addTx.id)) return;
          const alreadyInSheet = finalTransactions.some(
            t =>
              t.id === addTx.id ||
              (t.tanggal === addTx.tanggal &&
                t.debit === addTx.debit &&
                t.kredit === addTx.kredit &&
                t.keterangan === addTx.keterangan)
          );
          if (!alreadyInSheet) {
            finalTransactions.push(
              txDelta.edited && txDelta.edited[addTx.id]
                ? { ...txDelta.edited[addTx.id], id: addTx.id }
                : addTx
            );
          }
        });
      }
    }
  } catch {
    // ignore delta error
  }

  // Sort: newest date first
  return finalTransactions.sort((a, b) => parseDateString(b.tanggal).getTime() - parseDateString(a.tanggal).getTime());
}

// Add a single transaction
export async function addTransaction(spreadsheetId: string, transaction: Omit<Transaction, 'id'>, accessToken: string): Promise<void> {
  const hasValidOAuth = Boolean(accessToken && !accessToken.endsWith('-local-token'));
  if (hasValidOAuth) {
    try {
      const row = [
        transaction.tanggal,
        String(transaction.debit),
        String(transaction.kredit),
        transaction.jenisPengeluaran,
        String(transaction.kredit2 || 0),
        transaction.jenisPengeluaran2 || "-",
        transaction.keterangan,
        transaction.operasionalDanManajemen || "-"
      ];
      await appendRows(spreadsheetId, "Sheet1!A:H", [row], accessToken);
      return;
    } catch {
      // fall through to cloud delta
    }
  }

  const currentDelta = (await loadCloudSlot<any>('tx_delta')) || { added: [], edited: {}, deletedIds: [] };
  const newTx: Transaction = { ...transaction, id: `cloud-tx-${Date.now()}` };
  currentDelta.added = [newTx, ...(currentDelta.added || [])];
  await saveCloudSlot('tx_delta', currentDelta);
}

// Edit a transaction by updating its specific row
export async function updateTransaction(
  spreadsheetId: string, 
  id: string, // Represents the spreadsheet row number (e.g., "5")
  transaction: Omit<Transaction, 'id'>, 
  accessToken: string
): Promise<void> {
  const hasValidOAuth = Boolean(accessToken && !accessToken.endsWith('-local-token') && !id.startsWith('cloud-tx-'));
  if (hasValidOAuth) {
    try {
      const range = `Sheet1!A${id}:H${id}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      
      const row = [
        transaction.tanggal,
        String(transaction.debit),
        String(transaction.kredit),
        transaction.jenisPengeluaran,
        String(transaction.kredit2 || 0),
        transaction.jenisPengeluaran2 || "-",
        transaction.keterangan,
        transaction.operasionalDanManajemen || "-"
      ];

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [row]
        })
      });

      if (res.ok) return;
    } catch {
      // fall through to cloud delta
    }
  }

  const currentDelta = (await loadCloudSlot<any>('tx_delta')) || { added: [], edited: {}, deletedIds: [] };
  currentDelta.edited = currentDelta.edited || {};
  currentDelta.edited[id] = transaction;
  await saveCloudSlot('tx_delta', currentDelta);
}

// Delete a transaction by deleting the sheet row dimension
export async function deleteTransaction(spreadsheetId: string, id: string, accessToken: string): Promise<void> {
  const hasValidOAuth = Boolean(accessToken && !accessToken.endsWith('-local-token') && !id.startsWith('cloud-tx-'));
  if (hasValidOAuth) {
    try {
      const rowIndex = parseInt(id) - 1; // 0-indexed index for sheet row deletion
      if (!isNaN(rowIndex) && rowIndex >= 1) {
        const sheetId = await getSheetId(spreadsheetId, accessToken);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1
                  }
                }
              }
            ]
          })
        });

        if (res.ok) return;
      }
    } catch {
      // fall through to cloud delta
    }
  }

  const currentDelta = (await loadCloudSlot<any>('tx_delta')) || { added: [], edited: {}, deletedIds: [] };
  currentDelta.deletedIds = Array.from(new Set([...(currentDelta.deletedIds || []), id]));
  await saveCloudSlot('tx_delta', currentDelta);
}

// Fetch all categories from the 'Kategori' sheet
export async function fetchCategories(spreadsheetId: string, accessToken: string): Promise<string[] | null> {
  try {
    const rows = await fetchSheetRowsWithFallback(spreadsheetId, "Kategori", "Kategori!A1:A200", accessToken);
    if (!rows) {
      if (accessToken && !accessToken.endsWith('-local-token')) {
        // Worksheet 'Kategori' doesn't exist, we will create it!
        await createKategoriSheet(spreadsheetId, accessToken);
        const defaults = [
          "Makanan & Minuman",
          "Transportasi",
          "Kebutuhan Rumah",
          "Kesehatan",
          "Hiburan & Rekreasi",
          "Pendidikan",
          "Pekerjaan & Gaji",
          "Investasi",
          "Utilitas & Tagihan",
          "Lain-lain"
        ];
        await saveCategoriesToSheet(spreadsheetId, defaults, accessToken);
        return defaults;
      }
      return null;
    }

    const categories = rows
      .map(r => r[0])
      .filter(cat => cat && cat.trim() !== "");
    
    return categories.length > 0 ? categories : null;
  } catch (error) {
    console.error("Error fetching categories from sheet:", error);
    return null;
  }
}

// Clear and save the entire categories list to 'Kategori' sheet
export async function saveCategoriesToSheet(spreadsheetId: string, categories: string[], accessToken: string): Promise<void> {
  try {
    // First, clear Kategori!A1:A200 to remove old entries
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Kategori!A1:A200:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Then write the new categories
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Kategori!A1:A${categories.length}?valueInputOption=USER_ENTERED`;
    const values = categories.map(cat => [cat]);
    
    const res = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gagal menyimpan kategori ke spreadsheet: ${err}`);
    }
  } catch (error) {
    console.error("Error saving categories to sheet:", error);
    throw error;
  }
}

// Create the 'Kategori' worksheet/tab in the spreadsheet
async function createKategoriSheet(spreadsheetId: string, accessToken: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: "Kategori"
            }
          }
        }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal membuat tab Kategori di spreadsheet: ${err}`);
  }
}

// Ensure columns on Sheet1 match the web application exactly (self-healing headers)
export async function ensureCorrectHeaders(
  spreadsheetId: string,
  currentHeaders: string[],
  accessToken: string
): Promise<void> {
  const expected = ["Tanggal", "Debit", "Kredit", "Pengeluaran 1", "Jumlah Keterangan", "Keterangan", "Keterangan Detail", "Klasifikasi"];
  
  let matches = true;
  if (!currentHeaders || currentHeaders.length < expected.length) {
    matches = false;
  } else {
    for (let i = 0; i < expected.length; i++) {
      if ((currentHeaders[i] || '').trim() !== expected[i]) {
        matches = false;
        break;
      }
    }
  }

  if (!matches) {
    console.log("Menyelaraskan header spreadsheet dengan aplikasi web...");
    const range = "Sheet1!A1:H1";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [expected]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gagal menyelaraskan header spreadsheet:", err);
    }
  }
}

// Ensure a specific sheet/tab exists in the spreadsheet
export async function createCustomSheetTab(spreadsheetId: string, title: string, accessToken: string): Promise<void> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: title
              }
            }
          }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text();
      if (!text.includes('already exists')) {
        console.warn(`Tab ${title} may already exist or error:`, text);
      }
    }
  } catch (err) {
    console.warn(`Could not create sheet tab "${title}":`, err);
  }
}

// --- MENU CATALOG SYNC ---
export async function fetchMenuCatalogFromSheet(spreadsheetId: string, accessToken: string): Promise<any[] | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: any[] }>('menu_catalog'),
      fetchSheetRowsWithFallback(spreadsheetId, "Catalog Menu", "'Catalog Menu'!A1:G500", accessToken)
    ]);

    const items: any[] = [];
    if (rows && rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        
        let recipe: any[] = [];
        if (row[6]) {
          try { recipe = JSON.parse(row[6]); } catch (e) { /* ignore */ }
        }

        items.push({
          id: row[0],
          nama: row[1] || 'Menu',
          kategori: row[2] || 'Minuman',
          hargaJual: parseSheetNumber(row[3]),
          hpp: parseSheetNumber(row[4]),
          defaultJatah: parseSheetNumber(row[5]),
          recipe
        });
      }
    }

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      // If cloudSlot has non-default catalog items, merge or prefer cloudSlot
      const isDefault8 = cloudSlot.items.length <= 8 && cloudSlot.items.some((m: any) => m.id === 'm-1');
      if (!isDefault8 || items.length === 0) {
        return cloudSlot.items;
      }
    }

    return items.length > 0 ? items : null;
  } catch (error) {
    console.error("Error fetching menu catalog from sheet:", error);
    return null;
  }
}

export async function saveMenuCatalogToSheet(spreadsheetId: string, menuItems: any[], accessToken: string): Promise<void> {
  try {
    await saveCloudSlot('menu_catalog', { items: menuItems });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, "Catalog Menu", accessToken);

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Catalog Menu'!A1:G500:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const headers = ["ID", "Nama Menu", "Kategori", "Harga Jual", "HPP", "Jatah Barista Default", "Recipe JSON"];
    const rows = [
      headers,
      ...menuItems.map(m => [
        m.id,
        m.nama,
        m.kategori,
        String(m.hargaJual),
        String(m.hpp),
        String(m.defaultJatah || 0),
        JSON.stringify(m.recipe || [])
      ])
    ];

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Catalog Menu'!A1:G${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });
  } catch (error) {
    console.error("Error saving menu catalog to sheet:", error);
  }
}

// Helper to normalize date strings to standard YYYY-MM-DD
export function normalizeDateString(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str || str.startsWith('#')) return '';

  // 1. Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Check DD/MM/YYYY or D/M/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Check DD/MM/YY or D/M/YY
  const dmyShortMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShortMatch) {
    const d = dmyShortMatch[1].padStart(2, '0');
    const m = dmyShortMatch[2].padStart(2, '0');
    const yearNum = parseInt(dmyShortMatch[3], 10);
    const y = yearNum < 50 ? `20${dmyShortMatch[3].padStart(2, '0')}` : `19${dmyShortMatch[3].padStart(2, '0')}`;
    return `${y}-${m}-${d}`;
  }

  // 4. Handle Excel/Google Sheet numeric serial date (e.g., 46200 for year 2026)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utcDays = serial - 25569;
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 5. Try standard JS date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

// Helper to robustly parse numerical values from Google Sheets cells
function parseSheetNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val || typeof val !== 'string') return 0;
  const str = val.trim();
  if (!str || str.startsWith('#')) return 0; // Ignore #REF!, #N/A, #VALUE! error cells

  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  const cleaned = str.replace(/[^0-9.,-]/g, '');
  if (!cleaned) return 0;

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',');
    if (parts[1] && parts[1].length === 3) {
      return parseFloat(cleaned.replace(/,/g, ''));
    }
    return parseFloat(cleaned.replace(',', '.'));
  }
  if (cleaned.includes('.') && !cleaned.includes(',')) {
    const parts = cleaned.split('.');
    if (parts[1] && parts[1].length === 3 && parts[0].length <= 3) {
      return parseFloat(cleaned.replace(/\./g, ''));
    }
    return parseFloat(cleaned);
  }
  if (cleaned.includes('.') && cleaned.includes(',')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }

  const res = parseFloat(cleaned);
  return isNaN(res) ? 0 : res;
}

// --- DAILY SALES SYNC ---
export async function fetchDailySalesFromSheet(
  spreadsheetId: string, 
  accessToken: string,
  menuCatalog?: any[]
): Promise<any[] | null> {
  try {
    // Read saved Jatah Barista & Notes fallback from dedicated 'Jatah Barista', 'Input Jatah Barista', and 'Penjualan Harian' tabs
    const jatahFallbackMap: Record<string, { menuSales?: any[]; notes?: string }> = {};

    // 1. Try reading from dedicated tabs 'Jatah Barista' & 'Input Jatah Barista'
    const jatahTabs = ["Jatah Barista", "Input Jatah Barista"];
    for (const jTab of jatahTabs) {
      try {
        const rangeJatah = `'${jTab}'!A1:ZZ1000`;
        const jRows = await fetchSheetRowsWithFallback(spreadsheetId, jTab, rangeJatah, accessToken);
        if (jRows && jRows.length > 1) {
          const headerRow = jRows[0] || [];
          let dateColIdx = 1;
          let notesColIdx = 3;
          let jsonColIdx = -1;

          for (let c = 0; c < headerRow.length; c++) {
            const h = (headerRow[c] || '').toLowerCase();
            if (h.includes('tanggal') || h.includes('date') || h === 'tgl') dateColIdx = c;
            if (h.includes('catatan') || h.includes('note')) notesColIdx = c;
            if (h.includes('json') || h.includes('detail')) jsonColIdx = c;
          }

          for (let i = 1; i < jRows.length; i++) {
            const r = jRows[i];
            if (r && r[dateColIdx]) {
              const rawTgl = r[dateColIdx].trim();
              const normTgl = normalizeDateString(rawTgl) || rawTgl;
              let ms: any[] = [];
              
              const jsonCell = jsonColIdx >= 0 ? r[jsonColIdx] : (r[4] || r[r.length - 2] || r[r.length - 1]);
              if (jsonCell) {
                try { ms = JSON.parse(jsonCell); } catch (e) { /* ignore */ }
              }

              if (!jatahFallbackMap[normTgl] || (ms && ms.length > 0)) {
                jatahFallbackMap[normTgl] = {
                  menuSales: ms,
                  notes: r[notesColIdx] || jatahFallbackMap[normTgl]?.notes || ''
                };
                if (rawTgl !== normTgl) {
                  jatahFallbackMap[rawTgl] = jatahFallbackMap[normTgl];
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn(`Could not fetch from ${jTab}:`, e);
      }
    }

    // 2. Read saved fallback from 'Penjualan Harian' tab as secondary fallback
    try {
      const fallbackRange = "'Penjualan Harian'!A1:G1000";
      const fbRows = await fetchSheetRowsWithFallback(spreadsheetId, "Penjualan Harian", fallbackRange, accessToken);
      if (fbRows && fbRows.length > 1) {
        for (let i = 1; i < fbRows.length; i++) {
          const r = fbRows[i];
          if (r && r[1]) {
            const rawTgl = r[1].trim();
            const normTgl = normalizeDateString(rawTgl) || rawTgl;
            let ms: any[] = [];
            if (r[6]) {
              try { ms = JSON.parse(r[6]); } catch (e) { /* ignore */ }
            }
            if (!jatahFallbackMap[normTgl]) {
              jatahFallbackMap[normTgl] = {
                menuSales: ms,
                notes: r[5] || ''
              };
              if (rawTgl !== normTgl) {
                jatahFallbackMap[rawTgl] = jatahFallbackMap[normTgl];
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch jatah fallback from Penjualan Harian:", e);
    }

    // 3. Try fetching candidate tabs or auto-detect tabs from spreadsheet metadata
    const candidateTabs = ["Harian Penjualan Menu", "Laporan Harian Penjualan", "Penjualan Harian"];
    let sheetTitles: string[] = candidateTabs;

    if (accessToken && !accessToken.endsWith('-local-token')) {
      try {
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
        const metaRes = await fetch(metaUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const titlesFromSheet: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
          if (titlesFromSheet.length > 0) {
            const combined = new Set<string>();
            candidateTabs.forEach(t => {
              const foundReal = titlesFromSheet.find(real => real.trim().toLowerCase() === t.toLowerCase());
              if (foundReal) combined.add(foundReal);
            });
            titlesFromSheet.forEach(t => combined.add(t));
            sheetTitles = Array.from(combined);
          }
        }
      } catch (e) {
        console.warn("Could not fetch spreadsheet metadata titles:", e);
      }
    }
    
    for (const tabName of sheetTitles) {
      const range = `'${tabName}'!A1:ZZ1000`;
      const rows = await fetchSheetRowsWithFallback(spreadsheetId, tabName, range, accessToken);
      if (!rows || rows.length <= 1) continue;

      // Find header row (row containing 'Tanggal', 'Date', or 'Tgl')
      let headerRowIdx = -1;
      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const rowCells = rows[r] || [];
        const hasDateHeader = rowCells.some(cell => {
          const cStr = String(cell || '').trim().toLowerCase();
          return cStr === 'tanggal' || cStr === 'date' || cStr === 'tgl' || cStr.includes('tanggal');
        });
        if (hasDateHeader) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx === -1) {
        headerRowIdx = 0;
      }

      const headerRow = rows[headerRowIdx] || [];
      let dateColIdx = 0;
      for (let i = 0; i < headerRow.length; i++) {
        const h = (headerRow[i] || '').trim().toLowerCase();
        if (h.includes('tanggal') || h.includes('date') || h === 'tgl') {
          dateColIdx = i;
          break;
        }
      }

      // Map out all sales columns and jatah columns in headerRow
      const salesColMap: Record<number, string> = {};
      const jatahColMap: Record<number, string> = {};

      for (let c = 0; c < headerRow.length; c++) {
        if (c === dateColIdx) continue;
        const rawHeader = (headerRow[c] || '').trim();
        const hLower = rawHeader.toLowerCase();

        if (!rawHeader || rawHeader.startsWith('#')) continue;
        if (hLower.includes('total') || hLower.includes('catatan') || hLower.includes('note') || hLower.includes('waktu') || hLower === 'id' || hLower === 'json') {
          continue;
        }

        if (hLower.startsWith('jatah') || hLower.includes('jatah -') || hLower.includes('jatah barista')) {
          const targetName = rawHeader
            .replace(/^jatah\s*-\s*/i, '')
            .replace(/^jatah\s*barista\s*/i, '')
            .replace(/^jatah\s*/i, '')
            .trim();
          if (targetName) {
            jatahColMap[c] = targetName.toLowerCase();
          }
        } else {
          salesColMap[c] = rawHeader;
        }
      }

      // Master Menu List: Combine provided menuCatalog with any new menu columns found in Sheet
      const masterMenuList: any[] = [];
      const seenNames = new Set<string>();

      if (menuCatalog && menuCatalog.length > 0) {
        menuCatalog.forEach(m => {
          const nLower = (m.nama || '').trim().toLowerCase();
          if (nLower && !seenNames.has(nLower)) {
            seenNames.add(nLower);
            masterMenuList.push({
              id: m.id,
              nama: m.nama,
              kategori: m.kategori || 'Minuman',
              hargaJual: m.hargaJual || 0,
              hpp: m.hpp || 0,
              defaultJatah: m.defaultJatah || 0
            });
          }
        });
      }

      Object.values(salesColMap).forEach(hName => {
        const nLower = hName.trim().toLowerCase();
        if (nLower && !seenNames.has(nLower)) {
          seenNames.add(nLower);
          masterMenuList.push({
            id: `menu-${nLower.replace(/[^a-z0-9]/g, '-')}`,
            nama: hName,
            kategori: 'Minuman',
            hargaJual: 0,
            hpp: 0,
            defaultJatah: 0
          });
        }
      });

      const records: any[] = [];

      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[dateColIdx]) continue;
        const rawTgl = String(row[dateColIdx]).trim();
        if (!rawTgl || rawTgl.startsWith('#') || rawTgl.toLowerCase().includes('tanggal') || rawTgl.toLowerCase().includes('date')) continue;

        const normalizedTgl = normalizeDateString(rawTgl) || rawTgl;
        if (!normalizedTgl) continue;

        const fallbackInfo = jatahFallbackMap[normalizedTgl] || jatahFallbackMap[rawTgl];
        const menuSalesList: any[] = [];

        masterMenuList.forEach(m => {
          const mNameLower = m.nama.trim().toLowerCase();
          let terjual = 0;
          let jatah = m.defaultJatah || 0;

          // Sum sales from matching columns in salesColMap
          Object.entries(salesColMap).forEach(([colIdxStr, colMenuName]) => {
            if (colMenuName.trim().toLowerCase() === mNameLower) {
              const colIdx = Number(colIdxStr);
              terjual += parseSheetNumber(row[colIdx]);
            }
          });

          // Jatah fallback from saved tab
          if (fallbackInfo?.menuSales) {
            const fbItem = fallbackInfo.menuSales.find((s: any) =>
              s.menuId === m.id || (s.nama && s.nama.trim().toLowerCase() === mNameLower)
            );
            if (fbItem && typeof fbItem.jatah === 'number') {
              jatah = fbItem.jatah;
            }
          }

          // Jatah column in sheet row override if present
          Object.entries(jatahColMap).forEach(([colIdxStr, targetName]) => {
            if (targetName === mNameLower) {
              const colIdx = Number(colIdxStr);
              const rawVal = row[colIdx];
              if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
                jatah = parseSheetNumber(rawVal);
              }
            }
          });

          menuSalesList.push({
            menuId: m.id,
            nama: m.nama,
            kategori: m.kategori || 'Minuman',
            hargaJual: m.hargaJual || 0,
            hpp: m.hpp || 0,
            terjual,
            jatah
          });
        });

        const totCups = menuSalesList.reduce((s, ms) => s + ms.terjual, 0);
        const totOmset = menuSalesList.reduce((s, ms) => {
          const m = masterMenuList.find(item => item.id === ms.menuId);
          return s + (ms.terjual * (m?.hargaJual || 0));
        }, 0);
        const totHpp = menuSalesList.reduce((s, ms) => {
          const m = masterMenuList.find(item => item.id === ms.menuId);
          return s + ((ms.terjual + ms.jatah) * (m?.hpp || 0));
        }, 0);

        let notes = fallbackInfo?.notes || '';
        const notesIdx = headerRow.findIndex(h => (h || '').toLowerCase().includes('catatan') || (h || '').toLowerCase().includes('note'));
        if (notesIdx >= 0 && row[notesIdx]) {
          notes = row[notesIdx];
        }

        records.push({
          id: `ds-${normalizedTgl}`,
          tanggal: normalizedTgl,
          cups: totCups,
          omset: totOmset,
          hppTotal: totHpp,
          notes,
          menuSales: menuSalesList
        });
      }

      if (records.length > 0) {
        try {
          const cloudSales = await pullDailySalesFromCloud();
          if (cloudSales?.recordsByDate && Object.keys(cloudSales.recordsByDate).length > 0) {
            const byDate = new Map<string, any>();
            records.forEach(r => byDate.set(normalizeDateString(r.tanggal) || r.tanggal, r));
            Object.entries(cloudSales.recordsByDate).forEach(([tgl, cRec]: [string, any]) => {
              const normTgl = normalizeDateString(tgl) || tgl;
              if (cRec && normTgl) {
                byDate.set(normTgl, { ...cRec, tanggal: normTgl });
              }
            });
            return Array.from(byDate.values()).sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));
          }
        } catch {}
        return records;
      }
    }

    // Fallback: If 'Harian Penjualan Menu' is not available, try 'Penjualan Harian' tab
    const fallbackRange = "'Penjualan Harian'!A1:G1000";
    const fallbackRows = await fetchSheetRowsWithFallback(spreadsheetId, "Penjualan Harian", fallbackRange, accessToken);
    if (fallbackRows && fallbackRows.length > 1) {
      const records: any[] = [];
      for (let i = 1; i < fallbackRows.length; i++) {
        const row = fallbackRows[i];
        if (!row || !row[0] || !row[1]) continue;

        let menuSales: any[] = [];
        if (row[6]) {
          try { menuSales = JSON.parse(row[6]); } catch (e) { /* ignore */ }
        }

        records.push({
          id: row[0],
          tanggal: row[1],
          cups: parseSheetNumber(row[2]),
          omset: parseSheetNumber(row[3]),
          hppTotal: parseSheetNumber(row[4]),
          notes: row[5] || '',
          menuSales
        });
      }
      if (records.length > 0) {
        try {
          const cloudSales = await pullDailySalesFromCloud();
          if (cloudSales?.recordsByDate && Object.keys(cloudSales.recordsByDate).length > 0) {
            const byDate = new Map<string, any>();
            records.forEach(r => byDate.set(normalizeDateString(r.tanggal) || r.tanggal, r));
            Object.entries(cloudSales.recordsByDate).forEach(([tgl, cRec]: [string, any]) => {
              const normTgl = normalizeDateString(tgl) || tgl;
              if (cRec && normTgl) {
                byDate.set(normTgl, { ...cRec, tanggal: normTgl });
              }
            });
            return Array.from(byDate.values()).sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));
          }
        } catch {}
        return records;
      }
      return null;
    }

    try {
      const cloudSales = await pullDailySalesFromCloud();
      if (cloudSales?.recordsByDate && Object.keys(cloudSales.recordsByDate).length > 0) {
        return Object.values(cloudSales.recordsByDate);
      }
    } catch {}
    return null;
  } catch (error) {
    console.error("Error fetching daily sales from sheet:", error);
    return null;
  }
}

export async function saveDailySalesToSheet(
  spreadsheetId: string, 
  dailySales: any[], 
  accessToken: string,
  menuCatalog?: any[]
): Promise<void> {
  try {
    await pushDailySalesToCloud({ records: dailySales });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    const activeMenuList = (menuCatalog && menuCatalog.length > 0) ? menuCatalog : [];
    const menuJatahHeaders = activeMenuList.map(m => `Jatah - ${m.nama}`);
    const menuTerjualHeaders = activeMenuList.map(m => m.nama);

    // 1. Create and save to dedicated sheet tab 'Jatah Barista' & 'Input Jatah Barista'
    const jatahTabsToSave = ["Jatah Barista", "Input Jatah Barista"];

    for (const tabTitle of jatahTabsToSave) {
      await createCustomSheetTab(spreadsheetId, tabTitle, accessToken);

      const clearUrlJatah = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabTitle}'!A1:ZZ1000:clear`;
      await fetch(clearUrlJatah, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const jatahHeaders = [
        "ID", 
        "Tanggal", 
        ...menuJatahHeaders, 
        "Total Jatah Barista (Porsi)", 
        "Catatan", 
        "Detail Jatah Menu JSON", 
        "Waktu Sync"
      ];

      const jatahRows = [
        jatahHeaders,
        ...dailySales.map(d => {
          const jatahCols = activeMenuList.map(m => {
            const ms = d.menuSales?.find((s: any) => s.menuId === m.id || s.nama === m.nama);
            return String(ms ? (ms.jatah ?? 0) : (m.defaultJatah ?? 0));
          });

          const totJatah = d.menuSales 
            ? d.menuSales.reduce((s: number, ms: any) => s + (ms.jatah || 0), 0)
            : 0;

          return [
            d.id,
            d.tanggal,
            ...jatahCols,
            String(totJatah),
            d.notes || '',
            JSON.stringify(d.menuSales || []),
            new Date().toISOString()
          ];
        })
      ];

      const writeUrlJatah = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabTitle}'!A1:ZZ${jatahRows.length}?valueInputOption=USER_ENTERED`;
      await fetch(writeUrlJatah, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: jatahRows })
      });
    }

    // 2. Save full daily sales records to tab 'Penjualan Harian' for backward compatibility
    await createCustomSheetTab(spreadsheetId, "Penjualan Harian", accessToken);

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Penjualan Harian'!A1:G1000:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const headers = ["ID", "Tanggal", "Total Cups Terjual", "Total Omset", "Total HPP (Sales+Jatah)", "Catatan", "Menu Sales JSON"];
    const rows = [
      headers,
      ...dailySales.map(d => [
        d.id,
        d.tanggal,
        String(d.cups),
        String(d.omset),
        String(d.hppTotal),
        d.notes || '',
        JSON.stringify(d.menuSales || [])
      ])
    ];

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Penjualan Harian'!A1:G${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });

    // 3. Save directly to sheet tab 'Harian Penjualan Menu'
    await createCustomSheetTab(spreadsheetId, "Harian Penjualan Menu", accessToken);

    // Check if 'Harian Penjualan Menu' contains existing formulas (e.g. IMPORTRANGE)
    let existingFormulas: string[][] = [];
    try {
      const formulaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Harian Penjualan Menu'!A1:ZZ1000?valueRenderOption=FORMULA`;
      const formulaRes = await fetch(formulaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (formulaRes.ok) {
        const formulaData = await formulaRes.json();
        existingFormulas = formulaData.values || [];
      }
    } catch (e) {
      console.warn("Could not fetch formulas from Harian Penjualan Menu:", e);
    }

    const hasImportRange = existingFormulas.some(row => 
      row && row.some(cell => typeof cell === 'string' && cell.toUpperCase().includes('IMPORTRANGE'))
    );

    if (hasImportRange) {
      // If IMPORTRANGE exists, keep formulas intact
      const cleanGrid: string[][] = [];
      const numRowsToClean = Math.max(existingFormulas.length, 100);

      for (let r = 0; r < numRowsToClean; r++) {
        const rowFormulas = existingFormulas[r] || [];
        const cleanRow: string[] = [];

        for (let c = 0; c < Math.max(rowFormulas.length, 35); c++) {
          const cellVal = rowFormulas[c];
          if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
            cleanRow.push(cellVal);
          } else if (r === 0 && cellVal) {
            cleanRow.push(cellVal);
          } else if (c === 0 && cellVal && !cellVal.startsWith('#')) {
            cleanRow.push(cellVal);
          } else {
            cleanRow.push("");
          }
        }
        cleanGrid.push(cleanRow);
      }

      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Harian Penjualan Menu'!A1?valueInputOption=USER_ENTERED`;
      await fetch(writeUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: cleanGrid })
      });
    } else {
      // Standard sheet (no IMPORTRANGE): write full sales & jatah columns directly to 'Harian Penjualan Menu'
      const clearUrlHarian = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Harian Penjualan Menu'!A1:ZZ1000:clear`;
      await fetch(clearUrlHarian, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const harianHeaders = [
        "Tanggal",
        ...menuTerjualHeaders,
        ...menuJatahHeaders,
        "Total Cups Terjual",
        "Total Jatah Barista",
        "Total Omset (Rp)",
        "Total HPP (Rp)",
        "Catatan"
      ];

      const harianRows = [
        harianHeaders,
        ...dailySales.map(d => {
          const terjualCols = activeMenuList.map(m => {
            const ms = d.menuSales?.find((s: any) => s.menuId === m.id || s.nama === m.nama);
            return String(ms ? (ms.terjual ?? 0) : 0);
          });

          const jatahCols = activeMenuList.map(m => {
            const ms = d.menuSales?.find((s: any) => s.menuId === m.id || s.nama === m.nama);
            return String(ms ? (ms.jatah ?? 0) : 0);
          });

          const totJatah = d.menuSales 
            ? d.menuSales.reduce((s: number, ms: any) => s + (ms.jatah || 0), 0)
            : 0;

          return [
            d.tanggal,
            ...terjualCols,
            ...jatahCols,
            String(d.cups),
            String(totJatah),
            String(d.omset),
            String(d.hppTotal),
            d.notes || ''
          ];
        })
      ];

      const writeUrlHarian = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Harian Penjualan Menu'!A1:ZZ${harianRows.length}?valueInputOption=USER_ENTERED`;
      await fetch(writeUrlHarian, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: harianRows })
      });
    }
  } catch (error) {
    console.error("Error saving daily sales to sheet:", error);
  }
}

// --- INGREDIENTS (BAHAN BAKU RESEP) SYNC ---
export async function fetchIngredientsFromSheet(spreadsheetId: string, accessToken: string): Promise<any[] | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: any[] }>('ingredients'),
      fetchSheetRowsWithFallback(spreadsheetId, "Bahan Baku & Resep", "'Bahan Baku & Resep'!A1:F300", accessToken)
    ]);

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      const isDefault = cloudSlot.items.length <= 12 && cloudSlot.items.some((i: any) => i.id === 'ing-1');
      if (!isDefault) return cloudSlot.items;
    }

    if (!rows || rows.length <= 1) return cloudSlot?.items || null;

    const items: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0] || !row[1]) continue;

      items.push({
        id: row[0],
        namaBahan: row[1],
        hargaBeli: parseSheetNumber(row[2]),
        satuanBeli: row[3] || '1000 gram',
        takaranPerCup: parseSheetNumber(row[4]) || 1,
        satuanTakaran: row[5] || 'gram'
      });
    }

    return items.length > 0 ? items : (cloudSlot?.items || null);
  } catch (error) {
    console.error("Error fetching ingredients from sheet:", error);
    return null;
  }
}

export async function saveIngredientsToSheet(spreadsheetId: string, ingredients: any[], accessToken: string): Promise<void> {
  try {
    await saveCloudSlot('ingredients', { items: ingredients });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, "Bahan Baku & Resep", accessToken);

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Bahan Baku & Resep'!A1:F300:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const headers = ["ID Bahan", "Nama Bahan Baku", "Harga Beli (Rp)", "Satuan Beli", "Takaran per Cup", "Satuan Takaran"];
    const rows = [
      headers,
      ...ingredients.map(ing => [
        ing.id,
        ing.namaBahan,
        String(ing.hargaBeli),
        ing.satuanBeli || '',
        String(ing.takaranPerCup),
        ing.satuanTakaran || ''
      ])
    ];

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Bahan Baku & Resep'!A1:F${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });
  } catch (error) {
    console.error("Error saving ingredients to sheet:", error);
  }
}

// --- BARANG / BAHAN MASUK (INCOMING INGREDIENTS / PURCHASES) SYNC ---
export async function fetchIncomingBatchesFromSheet(spreadsheetId: string, accessToken: string): Promise<IncomingIngredientBatch[] | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: IncomingIngredientBatch[] }>('incoming_batches'),
      fetchSheetRowsWithFallback(spreadsheetId, "Barang Masuk & Pembelian", "'Barang Masuk & Pembelian'!A1:K1500", accessToken)
    ]);

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      const isDefault3 = cloudSlot.items.length <= 3 && cloudSlot.items.some(b => b.id === 'in-batch-1');
      if (!isDefault3) return cloudSlot.items;
    }

    if (!rows || rows.length <= 1) return cloudSlot?.items || null;

    const items: IncomingIngredientBatch[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0] || !row[2]) continue;

      items.push({
        id: row[0],
        tanggal: row[1] || new Date().toISOString().split('T')[0],
        namaBahan: row[2],
        ingredientId: row[3] || undefined,
        kategori: row[4] || 'Minuman',
        berat: parseSheetNumber(row[5]),
        satuan: row[6] || 'gram',
        harga: parseSheetNumber(row[7]),
        hargaSatuan: parseSheetNumber(row[8]),
        statusPembayaran: (row[9] as any) || 'Lunas',
        supplier: row[10] || '',
        keterangan: row[11] || '',
        nomorNota: row[12] || '',
        createdAt: row[13] || undefined
      });
    }

    return items.length > 0 ? items : (cloudSlot?.items || null);
  } catch (error) {
    console.error("Error fetching incoming batches from sheet:", error);
    return null;
  }
}

export async function saveIncomingBatchesToSheet(spreadsheetId: string, batches: IncomingIngredientBatch[], accessToken: string): Promise<void> {
  try {
    await saveCloudSlot('incoming_batches', { items: batches });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, "Barang Masuk & Pembelian", accessToken);

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Barang Masuk & Pembelian'!A1:N2000:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const headers = [
      "ID Batch", 
      "Tanggal Masuk", 
      "Nama Barang / Bahan", 
      "ID Master Bahan", 
      "Kategori", 
      "Berat / Jumlah", 
      "Satuan", 
      "Total Harga (Rp)", 
      "Harga per Satuan (Rp)", 
      "Status Pembayaran", 
      "Supplier / Toko", 
      "Keterangan / Catatan", 
      "Nomor Nota / Invoice",
      "Waktu Input"
    ];

    const rows = [
      headers,
      ...batches.map(b => [
        b.id,
        b.tanggal,
        b.namaBahan,
        b.ingredientId || '',
        b.kategori || 'Minuman',
        String(b.berat),
        b.satuan,
        String(b.harga),
        String(b.hargaSatuan || Math.round(b.berat > 0 ? b.harga / b.berat : 0)),
        b.statusPembayaran,
        b.supplier || '',
        b.keterangan || '',
        b.nomorNota || '',
        b.createdAt || new Date().toISOString()
      ])
    ];

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Barang Masuk & Pembelian'!A1:N${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });
  } catch (error) {
    console.error("Error saving incoming batches to sheet:", error);
  }
}

// --- BIAYA OPERASIONAL SYNC ---
export async function fetchBiayaListFromSheet(spreadsheetId: string, accessToken: string): Promise<any[] | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: any[] }>('biaya_list'),
      fetchSheetRowsWithFallback(spreadsheetId, "Biaya Operasional", "'Biaya Operasional'!A1:D100", accessToken)
    ]);

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      return cloudSlot.items;
    }

    if (!rows || rows.length <= 1) return null;

    const items: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0] || !row[1]) continue;

      items.push({
        id: row[0],
        nama: row[1],
        jumlah: parseSheetNumber(row[2]),
        kategori: row[3] || 'Gaji'
      });
    }

    return items.length > 0 ? items : null;
  } catch (error) {
    console.error("Error fetching biaya list from sheet:", error);
    return null;
  }
}

export async function saveBiayaListToSheet(spreadsheetId: string, biayaList: any[], accessToken: string): Promise<void> {
  try {
    await saveCloudSlot('biaya_list', { items: biayaList });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, "Biaya Operasional", accessToken);

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Biaya Operasional'!A1:D100:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const headers = ["ID", "Nama Pengeluaran / Gaji", "Jumlah (Rp)", "Kategori Biaya"];
    const rows = [
      headers,
      ...biayaList.map(b => [
        b.id,
        b.nama,
        String(b.jumlah),
        b.kategori
      ])
    ];

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Biaya Operasional'!A1:D${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });
  } catch (error) {
    console.error("Error saving biaya list to sheet:", error);
  }
}

// --- STOCK OPNAME SYNC ---
export async function fetchStockOpnameFromSheet(
  spreadsheetId: string, 
  month: string, 
  accessToken: string
): Promise<{ entries: Record<string, StockOpnameEntry>; petugas?: string } | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<any>('stock_opname'),
      fetchSheetRowsWithFallback(spreadsheetId, "Laporan Stok Opname", "'Laporan Stok Opname'!A1:L5000", accessToken)
    ]);

    if (cloudSlot?.monthlyMap && cloudSlot.monthlyMap[month]?.entries) {
      return {
        entries: cloudSlot.monthlyMap[month].entries,
        petugas: cloudSlot.monthlyMap[month].petugas
      };
    }

    if (!rows || rows.length <= 1) return null;

    const entries: Record<string, StockOpnameEntry> = {};
    let petugas = '';

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0] || !row[2]) continue;

      const rowMonth = row[0].trim();
      if (rowMonth !== month) continue;

      if (row[1] && row[1].trim()) petugas = row[1].trim();
      const itemId = row[2].trim();

      entries[itemId] = {
        itemId,
        namaBahan: row[3] || '',
        stokAwal: parseSheetNumber(row[4]),
        stokMasuk: parseSheetNumber(row[5]),
        terpakai: parseSheetNumber(row[6]),
        sisaDiBar: parseSheetNumber(row[7]),
        wasteLoss: parseSheetNumber(row[8]),
        catatanLoss: row[9] || '',
        nilaiLoss: parseSheetNumber(row[10]),
        isAutoTerpakai: false
      };
    }

    return Object.keys(entries).length > 0 ? { entries, petugas } : null;
  } catch (error) {
    console.error("Error fetching stock opname from sheet:", error);
    return null;
  }
}

// Fetch all historical and active stock opname records from Google Sheets
export async function fetchAllStockOpnameReportsFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<{
  reports: MonthlyStockOpnameReport[];
  monthlyEntries: Record<string, { entries: Record<string, StockOpnameEntry>; petugas: string }>;
} | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<any>('stock_opname'),
      fetchSheetRowsWithFallback(spreadsheetId, "Laporan Stok Opname", "'Laporan Stok Opname'!A1:L5000", accessToken)
    ]);

    const monthlyMap: Record<string, { entries: Record<string, StockOpnameEntry>; petugas: string; lastUpdated: string }> = {};

    if (rows && rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0] || !row[2]) continue;

        const rowMonth = row[0].trim();
        const petugas = (row[1] || 'Barista Leader').trim();
        const itemId = row[2].trim();
        const namaBahan = row[3] || '';
        const lastUpdated = row[11] || '';

        if (!monthlyMap[rowMonth]) {
          monthlyMap[rowMonth] = {
            entries: {},
            petugas,
            lastUpdated
          };
        }

        if (row[1] && row[1].trim()) {
          monthlyMap[rowMonth].petugas = row[1].trim();
        }
        if (lastUpdated) {
          monthlyMap[rowMonth].lastUpdated = lastUpdated;
        }

        monthlyMap[rowMonth].entries[itemId] = {
          itemId,
          namaBahan,
          stokAwal: parseFloat(row[4]) || 0,
          stokMasuk: parseFloat(row[5]) || 0,
          terpakai: parseFloat(row[6]) || 0,
          sisaDiBar: parseFloat(row[7]) || 0,
          wasteLoss: parseFloat(row[8]) || 0,
          catatanLoss: row[9] || '',
          nilaiLoss: parseFloat(row[10]) || 0,
          isAutoTerpakai: false
        };
      }
    }

    if (cloudSlot?.monthlyMap && typeof cloudSlot.monthlyMap === 'object') {
      Object.entries(cloudSlot.monthlyMap).forEach(([m, val]: [string, any]) => {
        if (val && val.entries) {
          monthlyMap[m] = {
            entries: val.entries,
            petugas: val.petugas || 'Barista Leader',
            lastUpdated: val.lastUpdated || new Date().toISOString()
          };
        }
      });
    }

    if (Object.keys(monthlyMap).length === 0) return null;

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const reports: MonthlyStockOpnameReport[] = Object.entries(monthlyMap).map(([m, val]) => {
      let namaPeriode = m;
      try {
        const [yr, mo] = m.split('-');
        const moIdx = parseInt(mo, 10) - 1;
        if (moIdx >= 0 && moIdx < 12) {
          namaPeriode = `${monthNames[moIdx]} ${yr}`;
        }
      } catch (e) { /* ignore */ }

      const tanggalOpname = val.lastUpdated ? val.lastUpdated.split('T')[0] : `${m}-01`;

      return {
        id: `opname-${m}`,
        periodeBulan: m,
        namaPeriode,
        tanggalOpname,
        petugasOpname: val.petugas,
        status: 'Finalized',
        entries: val.entries
      };
    });

    reports.sort((a, b) => b.periodeBulan.localeCompare(a.periodeBulan));

    return {
      reports,
      monthlyEntries: monthlyMap
    };
  } catch (error) {
    console.error("Error fetching all stock opname reports from sheet:", error);
    return null;
  }
}

export async function saveStockOpnameToSheet(
  spreadsheetId: string,
  month: string,
  entries: Record<string, any>,
  masterItems: any[],
  petugasOrToken: string,
  maybeToken?: string
): Promise<boolean> {
  const isSecondToken = maybeToken !== undefined;
  const petugas = isSecondToken 
    ? (petugasOrToken || 'Barista Leader') 
    : (petugasOrToken.startsWith('ya29.') ? 'Barista Leader' : (petugasOrToken || 'Barista Leader'));
  const accessToken = isSecondToken ? maybeToken : petugasOrToken;

  try {
    // Save to persistent cross-device cloud slot
    const existingCloud = (await loadCloudSlot<any>('stock_opname')) || { monthlyMap: {} };
    existingCloud.monthlyMap = existingCloud.monthlyMap || {};
    existingCloud.monthlyMap[month] = {
      entries,
      petugas: petugas || 'Barista Leader',
      lastUpdated: new Date().toISOString()
    };
    await saveCloudSlot('stock_opname', existingCloud);

    if (!accessToken || accessToken.endsWith('-local-token')) {
      return true;
    }

    await createCustomSheetTab(spreadsheetId, "Laporan Stok Opname", accessToken);

    // Fetch existing records from other months so we preserve them
    let existingRows: string[][] = [];
    try {
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Laporan Stok Opname'!A1:L5000`;
      const readRes = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (readRes.ok) {
        const d = await readRes.json();
        existingRows = d.values || [];
      }
    } catch (e) {
      console.warn("Could not read previous stock opname rows:", e);
    }

    const headers = [
      "Periode Bulan", 
      "Petugas Opname", 
      "ID Bahan", 
      "Nama Bahan Baku", 
      "Stok Awal", 
      "Pembelian/Masuk", 
      "Bahan Terpakai", 
      "Sisa di Bar", 
      "Waste / Loss", 
      "Catatan Loss", 
      "Nilai Loss (Rp)", 
      "Waktu Update"
    ];

    // Filter out rows for the current month
    const preservedRows = existingRows.length > 1 
      ? existingRows.slice(1).filter(r => r && r[0] && r[0].trim() !== month)
      : [];

    const processedIds = new Set<string>();

    const newMonthRows = masterItems.map(item => {
      processedIds.add(item.id);
      const entry = entries[item.id] || {
        stokAwal: 0,
        stokMasuk: 0,
        terpakai: 0,
        sisaDiBar: 0,
        wasteLoss: 0,
        catatanLoss: ''
      };

      const hargaSatuan = item.hargaSatuan || (item.hargaBeli && item.satuanBeli ? item.hargaBeli / (parseFloat(item.satuanBeli) || 1) : 0);
      const nilaiLoss = Math.round((entry.wasteLoss || 0) * (hargaSatuan || 0));

      return [
        month,
        petugas || 'Barista Leader',
        item.id,
        item.namaBahan,
        String(entry.stokAwal || 0),
        String(entry.stokMasuk || 0),
        String(entry.terpakai || 0),
        String(entry.sisaDiBar || 0),
        String(entry.wasteLoss || 0),
        entry.catatanLoss || '',
        String(nilaiLoss),
        new Date().toISOString()
      ];
    });

    // Also include any custom entries in `entries` that might not be in masterItems
    Object.entries(entries).forEach(([k, entry]: [string, any]) => {
      if (!processedIds.has(k) && entry) {
        newMonthRows.push([
          month,
          petugas || 'Barista Leader',
          k,
          entry.namaBahan || k,
          String(entry.stokAwal || 0),
          String(entry.stokMasuk || 0),
          String(entry.terpakai || 0),
          String(entry.sisaDiBar || 0),
          String(entry.wasteLoss || 0),
          entry.catatanLoss || '',
          String(entry.nilaiLoss || 0),
          new Date().toISOString()
        ]);
      }
    });

    const combinedRows = [headers, ...preservedRows, ...newMonthRows];

    // Clear and rewrite tab
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Laporan Stok Opname'!A1:L5000:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Laporan Stok Opname'!A1:L${combinedRows.length}?valueInputOption=USER_ENTERED`;
    const writeRes = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: combinedRows })
    });

    if (!writeRes.ok) {
      console.error("Failed to write stock opname to sheet:", await writeRes.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error saving stock opname to sheet:", error);
    return false;
  }
}

// --- JADWAL BARISTA & TIM SYNC ---

// Fetch schedules from 'Jadwal Barista' sheet
export async function fetchBaristaScheduleFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<BaristaScheduleEntry[] | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: BaristaScheduleEntry[] }>('barista_schedule'),
      fetchSheetRowsWithFallback(spreadsheetId, "Jadwal Barista", "'Jadwal Barista'!A1:K4000", accessToken)
    ]);

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      return cloudSlot.items;
    }

    if (!rows || rows.length <= 1) return null;

    const schedules: BaristaScheduleEntry[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[1] || !row[3]) continue; // needs date and baristaId

      const rawDate = normalizeDateString(row[1]);
      if (!rawDate) continue;

      const baristaId = (row[3] || '').trim();
      const shiftId = (row[5] || '').trim();
      const rawStatus = (row[8] || 'scheduled').trim().toLowerCase();
      
      let status: ShiftScheduleStatus = 'scheduled';
      if (rawStatus === 'hadir') status = 'hadir';
      else if (rawStatus === 'libur' || rawStatus === 'off') status = 'libur';
      else if (rawStatus === 'izin') status = 'izin';
      else if (rawStatus === 'sakit') status = 'sakit';
      else if (rawStatus === 'lembur') status = 'lembur';

      const entryId = row[0] && row[0].trim() !== '' ? row[0].trim() : `sched-${baristaId}-${rawDate}`;

      schedules.push({
        id: entryId,
        date: rawDate,
        baristaId,
        shiftId: shiftId || 'shift-pagi',
        status,
        notes: row[9] || ''
      });
    }

    return schedules.length > 0 ? schedules : null;
  } catch (error) {
    console.error("Error fetching barista schedule from sheet:", error);
    return null;
  }
}

// Save schedules to 'Jadwal Barista' sheet
export async function saveBaristaScheduleToSheet(
  spreadsheetId: string,
  scheduleEntries: BaristaScheduleEntry[],
  baristas: Barista[],
  shifts: ShiftMaster[],
  accessToken: string
): Promise<void> {
  try {
    await saveCloudSlot('barista_schedule', { items: scheduleEntries });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, "Jadwal Barista", accessToken);

    const headers = ["ID Entry", "Tanggal", "Hari", "Barista ID", "Nama Barista", "Shift ID", "Nama Shift", "Jam Kerja", "Status Shift", "Catatan", "Waktu Sync"];
    const rows = [
      headers,
      ...scheduleEntries.map(e => {
        const b = baristas.find((bar: any) => bar.id === e.baristaId);
        const s = shifts.find((sh: any) => sh.id === e.shiftId);
        const jam = s ? `${s.startTime} - ${s.endTime}` : '-';

        return [
          e.id,
          e.date,
          '',
          e.baristaId,
          b ? b.name : '-',
          e.shiftId,
          s ? s.name : '-',
          jam,
          e.status || 'scheduled',
          e.notes || '',
          new Date().toISOString()
        ];
      })
    ];

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Jadwal Barista'!A1:K4000:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Jadwal Barista'!A1:K${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });
  } catch (error) {
    console.error("Error saving barista schedule to sheet:", error);
    throw error;
  }
}

// Fetch baristas list from 'Master Tim Barista' sheet
export async function fetchBaristasFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<Barista[] | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: Barista[] }>('baristas'),
      fetchSheetRowsWithFallback(spreadsheetId, "Master Tim Barista", "'Master Tim Barista'!A1:P200", accessToken)
    ]);

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      return cloudSlot.items;
    }

    if (!rows || rows.length <= 1) return null;

    const baristas: Barista[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0] || !row[1]) continue;

      const rawRole = (row[3] || 'Barista').trim() as BaristaRole;
      const isActive = row[6] === undefined || row[6] === '' || row[6] === 'Aktif' || row[6] === 'true' || row[6] === '1';

      baristas.push({
        id: row[0].trim(),
        name: row[1].trim(),
        nickname: row[2] ? row[2].trim() : undefined,
        role: rawRole,
        phone: row[4] ? row[4].trim() : '',
        color: row[5] ? row[5].trim() : 'amber',
        isActive,
        joinDate: normalizeDateString(row[7]) || undefined,
        monthlySalary: parseSheetNumber(row[8]),
        positionAllowance: parseSheetNumber(row[9]),
        dailySalary: parseSheetNumber(row[10]),
        annualIncreaseType: (row[11] === 'percentage' || row[11] === '%' ? 'percentage' : 'fixed'),
        annualIncreaseValue: parseSheetNumber(row[12]),
        overtimeRatePerHour: parseSheetNumber(row[13]),
        notes: row[14] || ''
      });
    }

    return baristas.length > 0 ? baristas : null;
  } catch (error) {
    console.error("Error fetching baristas from sheet:", error);
    return null;
  }
}

// Save baristas list to 'Master Tim Barista' sheet
export async function saveBaristasToSheet(
  spreadsheetId: string,
  baristas: Barista[],
  accessToken: string
): Promise<void> {
  try {
    await saveCloudSlot('baristas', { items: baristas });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, "Master Tim Barista", accessToken);

    const headers = [
      "ID Barista", 
      "Nama Lengkap", 
      "Panggilan", 
      "Jabatan / Role", 
      "No. Telepon / WhatsApp", 
      "Warna Label", 
      "Status Aktif", 
      "Tanggal Mulai Kerja", 
      "Gaji Pokok (Rp)", 
      "Tunjangan Jabatan (Rp)", 
      "Uang Harian / Kehadiran (Rp)", 
      "Tipe Kenaikan Gaji", 
      "Nilai Kenaikan / Tahun", 
      "Tarif Lembur / Jam (Rp)", 
      "Catatan", 
      "Waktu Update"
    ];

    const rows = [
      headers,
      ...baristas.map(b => [
        b.id,
        b.name,
        b.nickname || '',
        b.role || 'Barista',
        b.phone || '',
        b.color || 'amber',
        b.isActive ? 'Aktif' : 'Non-Aktif',
        b.joinDate || '',
        String(b.monthlySalary || 0),
        String(b.positionAllowance || 0),
        String(b.dailySalary || 0),
        b.annualIncreaseType || 'fixed',
        String(b.annualIncreaseValue || 0),
        String(b.overtimeRatePerHour || 0),
        b.notes || '',
        new Date().toISOString()
      ])
    ];

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Master Tim Barista'!A1:P200:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Master Tim Barista'!A1:P${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });
  } catch (error) {
    console.error("Error saving baristas to sheet:", error);
    throw error;
  }
}

// Fetch shift masters from 'Master Jam Shift' sheet
export async function fetchShiftsFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<ShiftMaster[] | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: ShiftMaster[] }>('shifts'),
      fetchSheetRowsWithFallback(spreadsheetId, "Master Jam Shift", "'Master Jam Shift'!A1:J100", accessToken)
    ]);

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      return cloudSlot.items;
    }

    if (!rows || rows.length <= 1) return null;

    const shifts: ShiftMaster[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0] || !row[1]) continue;

      const isOff = row[7] === 'true' || row[7] === 'Libur' || row[7] === '1';

      shifts.push({
        id: row[0].trim(),
        name: row[1].trim(),
        shortCode: row[2] ? row[2].trim() : 'SHIFT',
        startTime: row[3] ? row[3].trim() : '07:00',
        endTime: row[4] ? row[4].trim() : '15:00',
        durationHours: parseFloat(row[5]) || 8,
        color: row[6] ? row[6].trim() : 'emerald',
        isOff,
        description: row[8] || ''
      });
    }

    return shifts.length > 0 ? shifts : null;
  } catch (error) {
    console.error("Error fetching shifts from sheet:", error);
    return null;
  }
}

// Save shift masters to 'Master Jam Shift' sheet
export async function saveShiftsToSheet(
  spreadsheetId: string,
  shifts: ShiftMaster[],
  accessToken: string
): Promise<void> {
  try {
    await saveCloudSlot('shifts', { items: shifts });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, "Master Jam Shift", accessToken);

    const headers = [
      "ID Shift", 
      "Nama Shift", 
      "Kode Singkat", 
      "Jam Mulai", 
      "Jam Selesai", 
      "Durasi (Jam)", 
      "Warna Label", 
      "Status Libur / Off", 
      "Keterangan", 
      "Waktu Update"
    ];

    const rows = [
      headers,
      ...shifts.map(s => [
        s.id,
        s.name,
        s.shortCode,
        s.startTime,
        s.endTime,
        String(s.durationHours || 0),
        s.color || 'emerald',
        s.isOff ? 'Libur' : 'Masuk',
        s.description || '',
        new Date().toISOString()
      ])
    ];

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Master Jam Shift'!A1:J100:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Master Jam Shift'!A1:J${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });
  } catch (error) {
    console.error("Error saving shifts to sheet:", error);
    throw error;
  }
}

// Save all Barista Schedule, Team & Shifts to Google Sheets in parallel
export async function saveFullBaristaDataToSheet(
  spreadsheetId: string,
  schedules: BaristaScheduleEntry[],
  baristas: Barista[],
  shifts: ShiftMaster[],
  accessToken: string
): Promise<void> {
  await Promise.all([
    saveBaristaScheduleToSheet(spreadsheetId, schedules, baristas, shifts, accessToken),
    saveBaristasToSheet(spreadsheetId, baristas, accessToken),
    saveShiftsToSheet(spreadsheetId, shifts, accessToken)
  ]);
}

// Fetch all Barista Schedule, Team & Shifts from Google Sheets in parallel
export async function fetchFullBaristaDataFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<{
  schedules: BaristaScheduleEntry[] | null;
  baristas: Barista[] | null;
  shifts: ShiftMaster[] | null;
}> {
  const [schedules, baristas, shifts] = await Promise.all([
    fetchBaristaScheduleFromSheet(spreadsheetId, accessToken),
    fetchBaristasFromSheet(spreadsheetId, accessToken),
    fetchShiftsFromSheet(spreadsheetId, accessToken)
  ]);

  return { schedules, baristas, shifts };
}

// --- CATATAN & AGENDA KALENDER SYNC ---
export async function fetchCalendarNotesFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<CalendarNoteActivity[] | null> {
  if (!spreadsheetId) return null;

  try {
    const cloudSlot = await loadCloudSlot<{ items?: CalendarNoteActivity[] }>('calendar_notes');
    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      return cloudSlot.items;
    }

    // 1. Discover actual sheet titles from spreadsheet metadata if live OAuth token is present
    let detectedTab: string | null = null;
    const tabCandidates = ["Catatan & Agenda Kalender", "Catatan & Agenda", "Agenda Kalender", "Catatan Kalender", "Agenda"];

    if (accessToken && !accessToken.endsWith('-local-token')) {
      try {
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
        const metaRes = await fetch(metaUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const sheetList = (metaData.sheets || []).map((s: any) => s.properties?.title as string).filter(Boolean);
          for (const cand of tabCandidates) {
            const found = sheetList.find(t => t.trim().toLowerCase() === cand.toLowerCase());
            if (found) {
              detectedTab = found;
              break;
            }
          }
          if (!detectedTab) {
            const partialMatch = sheetList.find(t => /catatan|agenda|kalender/i.test(t));
            if (partialMatch) detectedTab = partialMatch;
          }
        }
      } catch (metaErr) {
        console.warn("Could not query spreadsheet metadata for calendar notes:", metaErr);
      }
    }

    const tabToQuery = detectedTab || "Catatan & Agenda Kalender";
    const range = `'${tabToQuery}'!A1:P2500`;
    const rows = await fetchSheetRowsWithFallback(spreadsheetId, tabToQuery, range, accessToken);
    if (!rows || rows.length <= 1) return null;

    const activities: CalendarNoteActivity[] = [];
    const validCategories: ActivityCategory[] = [
      'Operasional',
      'Maintenance & Alat',
      'Restock / Belanja',
      'Event & Acara Cafe',
      'Promo & Marketing',
      'Pembayaran & Tagihan',
      'Kebersihan & Sanitasi',
      'Rapat & Evaluasi',
      'Lain-lain'
    ];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[1] && !row[2]) continue;

      const rawId = (row[0] || '').trim();
      const id = rawId && rawId.toLowerCase() !== 'id agenda' ? rawId : `act-sheet-${i}-${Date.now()}`;
      
      const rawDate = (row[1] || '').trim();
      const tanggal = normalizeDateString(rawDate) || rawDate;
      const judul = (row[2] || '').trim();
      if (!judul) continue;

      // Category
      const rawCat = (row[3] || '').trim();
      const matchedCat = validCategories.find(c => c.toLowerCase() === rawCat.toLowerCase());
      const kategori: ActivityCategory = matchedCat || 'Operasional';

      // Priority
      const rawPri = (row[4] || '').trim().toLowerCase();
      let prioritas: ActivityPriority = 'sedang';
      if (rawPri.includes('urgent') || rawPri.includes('mendesak')) prioritas = 'urgent';
      else if (rawPri.includes('tinggi') || rawPri.includes('high')) prioritas = 'tinggi';
      else if (rawPri.includes('rendah') || rawPri.includes('low')) prioritas = 'rendah';

      // Time
      const rawStart = (row[5] || '').trim();
      const waktuMulai = rawStart && rawStart !== '-' ? rawStart : undefined;
      const rawEnd = (row[6] || '').trim();
      const waktuSelesai = rawEnd && rawEnd !== '-' ? rawEnd : undefined;

      // PIC & Location
      const rawPic = (row[7] || '').trim();
      const penanggungJawab = rawPic && rawPic !== '-' ? rawPic : undefined;
      const rawLoc = (row[8] || '').trim();
      const lokasi = rawLoc && rawLoc !== '-' ? rawLoc : undefined;

      // Nominal Estimasi
      const nominalEstimasi = parseSheetNumber(row[9]);

      // Status
      const rawStatus = (row[10] || '').trim().toLowerCase();
      const isCompleted = rawStatus === 'selesai' || rawStatus === 'done' || rawStatus === 'yes' || rawStatus === 'true' || rawStatus === '1';

      // H-1 & Hari H
      const rawH1 = (row[11] || '').trim().toLowerCase();
      const ingatkanH1 = !(rawH1 === 'tidak' || rawH1 === 'no' || rawH1 === 'false' || rawH1 === '0');

      const rawHariH = (row[12] || '').trim().toLowerCase();
      const ingatkanHariH = !(rawHariH === 'tidak' || rawHariH === 'no' || rawHariH === 'false' || rawHariH === '0');

      // Notes & Timestamps
      const deskripsi = row[13] || '';
      const rawCompletedAt = (row[14] || '').trim();
      const completedAt = rawCompletedAt && rawCompletedAt !== '-' ? rawCompletedAt : undefined;
      const createdAt = (row[15] || '').trim() || new Date().toISOString();

      activities.push({
        id,
        tanggal,
        judul,
        kategori,
        prioritas,
        waktuMulai,
        waktuSelesai,
        penanggungJawab,
        lokasi,
        nominalEstimasi,
        isCompleted,
        ingatkanH1,
        ingatkanHariH,
        deskripsi,
        completedAt,
        createdAt
      });
    }

    return activities.length > 0 ? activities : null;
  } catch (error) {
    console.warn("Could not fetch calendar notes from sheet:", error);
    return null;
  }
}

export async function saveCalendarNotesToSheet(
  spreadsheetId: string,
  activities: CalendarNoteActivity[],
  accessToken: string
): Promise<void> {
  try {
    await saveCloudSlot('calendar_notes', { items: activities });
  } catch {}
  if (!spreadsheetId || !accessToken || accessToken.endsWith('-local-token')) return;

  try {
    await createCustomSheetTab(spreadsheetId, "Catatan & Agenda Kalender", accessToken);

    const headers = [
      "ID Agenda",
      "Tanggal",
      "Judul Catatan / Agenda",
      "Kategori",
      "Prioritas",
      "Jam Mulai",
      "Jam Selesai",
      "Penanggung Jawab / PIC",
      "Lokasi / Ruang",
      "Estimasi Biaya (Rp)",
      "Status Selesai",
      "Ingatkan H-1",
      "Ingatkan Hari H",
      "Deskripsi / Checklist Detail",
      "Waktu Selesai",
      "Dibuat Pada"
    ];

    const rows = [
      headers,
      ...activities.map(a => [
        a.id,
        a.tanggal,
        a.judul,
        a.kategori || 'Operasional',
        a.prioritas || 'sedang',
        a.waktuMulai || '-',
        a.waktuSelesai || '-',
        a.penanggungJawab || '-',
        a.lokasi || '-',
        String(a.nominalEstimasi || 0),
        a.isCompleted ? 'Selesai' : 'Belum Selesai',
        a.ingatkanH1 !== false ? 'Ya' : 'Tidak',
        a.ingatkanHariH !== false ? 'Ya' : 'Tidak',
        a.deskripsi || '',
        a.completedAt || '-',
        a.createdAt || new Date().toISOString()
      ])
    ];

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Catatan & Agenda Kalender'!A1:P2500:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    }).catch(() => null);

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Catatan & Agenda Kalender'!A1:P${rows.length}?valueInputOption=USER_ENTERED`;
    const res = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`Gagal menyimpan catatan & agenda ke spreadsheet: ${err}`);
    }
  } catch (error) {
    console.warn("Could not save calendar notes to sheet:", error);
  }
}

// Helper to convert 0-based column index to spreadsheet column letter (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA)
export function columnIndexToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// --- BAHAN YANG HARUS DIBELANJAKAN (SHEET 4 / SHOPPING LIST) SYNC ---
export async function fetchShoppingListFromSheet4(
  spreadsheetId: string,
  accessToken: string
): Promise<{ items: ShoppingIngredientItem[]; actualTabName: string; statusColIndex?: number } | null> {
  try {
    // 1. Discover actual sheet titles from spreadsheet metadata if live OAuth token is present
    let detectedTab: string | null = null;
    const candidateTabNames = ["Sheet 4", "Sheet4", "sheet 4", "sheet4", "Bahan yang Harus Dibelanjakan", "Bahan Belanja", "Daftar Belanja"];

    const hasValidOAuth = Boolean(accessToken && !accessToken.endsWith('-local-token'));

    if (hasValidOAuth) {
      try {
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
        const metaRes = await fetch(metaUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const sheetList = (metaData.sheets || []).map((s: any) => s.properties?.title as string).filter(Boolean);
          
          // Check for exact / loose match with Sheet 4
          for (const cand of candidateTabNames) {
            const found = sheetList.find(t => t.trim().toLowerCase() === cand.toLowerCase());
            if (found) {
              detectedTab = found;
              break;
            }
          }

          // If not found yet, check if any tab has 'sheet 4' or 'sheet4' in its name
          if (!detectedTab) {
            const matchSheet4 = sheetList.find(t => /sheet\s*4/i.test(t));
            if (matchSheet4) detectedTab = matchSheet4;
          }

          // If still not found, check if 4th sheet exists (index 3) and user meant the 4th tab
          if (!detectedTab && sheetList.length >= 4) {
            const fourthSheet = sheetList[3];
            if (fourthSheet && !['Sheet1', 'Kategori', 'Catalog Menu', 'Bahan Baku & Resep'].includes(fourthSheet)) {
              detectedTab = fourthSheet;
            }
          }
        }
      } catch (e) {
        console.warn("Could not query spreadsheet metadata for Sheet 4:", e);
      }
    }

    const tabToQuery = detectedTab || "Sheet 4";
    const range = `'${tabToQuery}'!A1:Z1000`;

    // 2. Query values with fallback to public CSV if no OAuth token
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: ShoppingIngredientItem[]; actualTabName?: string; statusByName?: Record<string, ShoppingStatus> }>('shopping_list'),
      fetchSheetRowsWithFallback(spreadsheetId, tabToQuery, range, accessToken)
    ]);
    if (!rows || rows.length === 0) {
      if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
        return { items: cloudSlot.items, actualTabName: cloudSlot.actualTabName || tabToQuery };
      }
      return null;
    }

    let formulaRows: string[][] = [];
    if (hasValidOAuth) {
      try {
        const formulaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`;
        const formulaRes = await fetch(formulaUrl, { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null);
        if (formulaRes && formulaRes.ok) {
          const fData = await formulaRes.json();
          formulaRows = fData.values || [];
        }
      } catch {}
    }

    // 3. Inspect header row to dynamically detect column indices
    let colNama = -1;
    let colJumlah = -1;
    let colSatuan = -1;
    let colSisaStok = -1;
    let colStokMin = -1;
    let colHarga = -1;
    let colSupplier = -1;
    let colPrioritas = -1;
    let colStatus = -1;
    let colTanggal = -1;
    let colCatatan = -1;
    let colKategori = -1;

    let startRowIndex = 1;
    const headerRow = rows[0] || [];

    headerRow.forEach((rawH, idx) => {
      const h = (rawH || '').trim().toLowerCase();
      if (!h) return;
      if (colNama === -1 && (h.includes('nama') || h.includes('bahan') || h.includes('barang') || h.includes('item') || h.includes('produk') || h.includes('deskripsi'))) colNama = idx;
      if (colJumlah === -1 && (h.includes('jumlah') || h.includes('qty') || h.includes('kuantitas') || h.includes('berat') || h.includes('order') || h.includes('banyak') || h.includes('kebutuhan'))) colJumlah = idx;
      if (colSatuan === -1 && (h.includes('satuan') || h.includes('unit') || h.includes('uom'))) colSatuan = idx;
      if (colSisaStok === -1 && (h.includes('sisa') || h.includes('stok saat') || h.includes('stok bar') || h === 'stok')) colSisaStok = idx;
      if (colStokMin === -1 && (h.includes('min') || h.includes('batas') || h.includes('stok aman'))) colStokMin = idx;
      if (colHarga === -1 && (h.includes('harga') || h.includes('estimasi') || h.includes('biaya') || h.includes('total') || h.includes('nominal') || h.includes('anggaran') || h.includes('budget'))) colHarga = idx;
      if (colSupplier === -1 && (h.includes('supplier') || h.includes('toko') || h.includes('vendor') || h.includes('agen') || h.includes('tempat'))) colSupplier = idx;
      if (colPrioritas === -1 && (h.includes('prioritas') || h.includes('urgensi') || h.includes('priority') || h.includes('urgency') || h.includes('urg'))) colPrioritas = idx;
      if (colStatus === -1 && (h.includes('status') || h.includes('kondisi') || h.includes('selesai') || h.includes('keterangan status'))) colStatus = idx;
      if (colTanggal === -1 && (h.includes('tanggal') || h.includes('tgl') || h.includes('date') || h.includes('deadline') || h.includes('waktu'))) colTanggal = idx;
      if (colCatatan === -1 && (h.includes('catatan') || h.includes('keterangan') || h.includes('note') || h.includes('memo'))) colCatatan = idx;
      if (colKategori === -1 && (h.includes('kategori') || h.includes('pos') || h.includes('jenis'))) colKategori = idx;
    });

    // Fallbacks if header wasn't detected or row 0 is pure data without column names
    if (colNama === -1) {
      if (rows.length > 0 && typeof rows[0][1] === 'string' && rows[0][1].length > 1) {
        colTanggal = 1;
        colNama = 2;
        colJumlah = 3;
        colSatuan = 4;
        colHarga = 5;
        startRowIndex = 1;
      } else {
        colNama = 1;
        colJumlah = 2;
        colSatuan = 3;
        colHarga = 4;
        startRowIndex = 0;
      }
    }

    // Check if column Tanggal or Nama Bahan is driven by formulas (such as =IMPORTRANGE(" Responses 2!AZ311:AZ1000"))
    let isFormulaDrivenCol = false;
    for (let r = 0; r < Math.min(formulaRows.length, 30); r++) {
      const fRow = formulaRows[r] || [];
      const fTgl = String(fRow[colTanggal] || '');
      const fNama = String(fRow[colNama] || '');
      if (fTgl.startsWith('=') || fNama.startsWith('=')) {
        isFormulaDrivenCol = true;
        break;
      }
    }

    const items: ShoppingIngredientItem[] = [];

    for (let i = startRowIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawNama = (row[colNama] || '').trim();
      // Skip empty or header repeated rows
      if (!rawNama || rawNama.toLowerCase() === 'nama bahan' || rawNama.toLowerCase() === 'nama barang') continue;

      const rawJumlah = colJumlah >= 0 ? row[colJumlah] : '1';
      const jumlah = parseSheetNumber(rawJumlah) || 1;

      const satuan = (colSatuan >= 0 && row[colSatuan]) ? row[colSatuan].trim() : 'pcs';
      const sisaStok = colSisaStok >= 0 ? parseSheetNumber(row[colSisaStok]) : undefined;
      const stokMinimum = colStokMin >= 0 ? parseSheetNumber(row[colStokMin]) : undefined;
      const estimasiTotal = colHarga >= 0 ? parseSheetNumber(row[colHarga]) : 0;
      const supplier = colSupplier >= 0 ? (row[colSupplier] || '').trim() : '';
      const kategori = colKategori >= 0 ? (row[colKategori] || 'Minuman').trim() : 'Minuman';

      // Parse priority
      const rawPri = (colPrioritas >= 0 && row[colPrioritas] ? row[colPrioritas] : '').trim().toLowerCase();
      let prioritas: ShoppingUrgency = 'sedang';
      if (rawPri.includes('urgent') || rawPri.includes('mendesak') || rawPri.includes('darurat')) prioritas = 'urgent';
      else if (rawPri.includes('tinggi') || rawPri.includes('high')) prioritas = 'tinggi';
      else if (rawPri.includes('rendah') || rawPri.includes('low')) prioritas = 'rendah';
      else if (sisaStok !== undefined && stokMinimum !== undefined && sisaStok <= stokMinimum) {
        prioritas = sisaStok === 0 ? 'urgent' : 'tinggi';
      }

      // Parse status
      const rawStat = (colStatus >= 0 && row[colStatus] ? row[colStatus] : '').trim().toLowerCase();
      let status: ShoppingStatus = 'perlu_dibeli';
      if (rawStat.includes('sudah') || rawStat.includes('selesai') || rawStat.includes('done') || rawStat.includes('lunas') || rawStat.includes('dibeli')) {
        status = 'sudah_dibeli';
      } else if (rawStat.includes('pesan') || rawStat.includes('order') || rawStat.includes('otw') || rawStat.includes('proses')) {
        status = 'sedang_dipesan';
      } else if (rawStat.includes('batal') || rawStat.includes('cancel')) {
        status = 'dibatalkan';
      }

      // Parse date - keep exactly as retrieved from sheet, never alter
      const rawTgl = colTanggal >= 0 ? row[colTanggal] : '';
      const tanggal = normalizeDateString(rawTgl) || (rawTgl ? rawTgl.trim() : new Date().toISOString().split('T')[0]);

      // Catatan
      const catatan = colCatatan >= 0 ? (row[colCatatan] || '').trim() : '';

      items.push({
        id: `shop-${i}-${Date.now()}`,
        tanggal,
        namaBahan: rawNama,
        kategori,
        jumlah,
        satuan,
        sisaStok,
        stokMinimum,
        estimasiHarga: jumlah > 0 ? Math.round(estimasiTotal / jumlah) : estimasiTotal,
        estimasiTotal,
        supplier,
        prioritas,
        status,
        catatan,
        checked: status === 'sudah_dibeli',
        sourceRowIndex: i + 1,
        statusColIndex: colStatus,
        isFormulaDriven: isFormulaDrivenCol
      });
    }

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      return { items: cloudSlot.items, actualTabName: cloudSlot.actualTabName || tabToQuery, statusColIndex: colStatus };
    }

    return { items, actualTabName: tabToQuery, statusColIndex: colStatus };
  } catch (error) {
    console.error("Error fetching shopping list from Sheet 4:", error);
    return null;
  }
}

// -------------------------------------------------------------
// UPDATE SINGLE SHOPPING ITEM STATUS DIRECTLY IN SHEET 4
// -------------------------------------------------------------
// CRITICAL: This targets ONLY the Status cell in the item's row.
// It NEVER modifies or clears Column Tanggal, Column Nama Bahan,
// or any =IMPORTRANGE(...) formula, ensuring zero data loss and
// keeping date and ingredient name 100% invariant when "Sudah Dibeli" is clicked.
export async function updateShoppingItemStatusInSheet4(
  spreadsheetId: string,
  item: ShoppingIngredientItem,
  newStatus: ShoppingStatus,
  accessToken: string,
  tabName = 'Sheet 4'
): Promise<boolean> {
  try {
    const existingCloud = await loadCloudSlot<{ items?: ShoppingIngredientItem[]; actualTabName?: string }>('shopping_list');
    if (existingCloud?.items && Array.isArray(existingCloud.items)) {
      const updatedItems = existingCloud.items.map(i =>
        (i.id === item.id || i.namaBahan === item.namaBahan)
          ? { ...i, status: newStatus, checked: newStatus === 'sudah_dibeli' }
          : i
      );
      await saveCloudSlot('shopping_list', { items: updatedItems, actualTabName: tabName });
    }
    if (!accessToken || accessToken.endsWith('-local-token')) {
      return true;
    }

    const statusText = newStatus === 'sudah_dibeli' ? 'Sudah Dibeli' : 
                       newStatus === 'sedang_dipesan' ? 'Sedang Dipesan' : 
                       newStatus === 'dibatalkan' ? 'Dibatalkan' : 'Perlu Dibeli';

    // 1. Discover actual sheet title from spreadsheet metadata
    let detectedTab = tabName;
    try {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
      const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const sheetList = (metaData.sheets || []).map((s: any) => s.properties?.title as string).filter(Boolean);
        const candidateTabNames = [tabName, "Sheet 4", "Sheet4", "sheet 4", "sheet4", "Bahan yang Harus Dibelanjakan", "Bahan Belanja", "Daftar Belanja"];
        for (const cand of candidateTabNames) {
          const found = sheetList.find(t => t.trim().toLowerCase() === cand.toLowerCase());
          if (found) {
            detectedTab = found;
            break;
          }
        }
      }
    } catch {}

    let targetRow = item.sourceRowIndex;
    let targetCol = item.statusColIndex;

    // 2. Query header row to locate or verify the Status column
    const headerRange = `'${detectedTab}'!A1:Z3`;
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(headerRange)}?valueRenderOption=FORMATTED_VALUE`;
    const headerRes = await fetch(headerUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    
    let headerRow: string[] = [];
    if (headerRes.ok) {
      const hData = await headerRes.json();
      headerRow = hData.values?.[0] || [];
      const foundIdx = headerRow.findIndex((h: string) => {
        const s = (h || '').trim().toLowerCase();
        return s.includes('status') || s.includes('kondisi') || s.includes('selesai') || s.includes('keterangan status');
      });
      if (foundIdx >= 0) {
        targetCol = foundIdx;
      }
    }

    // 3. Fallback: If targetRow is unknown, match by namaBahan in the sheet
    if (!targetRow || targetRow < 1) {
      const scanRange = `'${detectedTab}'!A1:Z500`;
      const scanUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(scanRange)}`;
      const scanRes = await fetch(scanUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (scanRes.ok) {
        const sData = await scanRes.json();
        const sRows: string[][] = sData.values || [];
        for (let r = 0; r < sRows.length; r++) {
          const rowVals = sRows[r] || [];
          const matchesName = rowVals.some(v => v && v.toString().trim().toLowerCase() === item.namaBahan.trim().toLowerCase());
          if (matchesName) {
            targetRow = r + 1;
            break;
          }
        }
      }
    }

    if (!targetRow) {
      console.warn("Could not find matching row in Sheet 4 for item:", item.namaBahan);
      return false;
    }

    // If still no status column, create one at the end of the header row
    if (targetCol === undefined || targetCol < 0) {
      targetCol = Math.max(headerRow.length, 3);
      const colLet = columnIndexToLetter(targetCol);
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(detectedTab)}'!${colLet}1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [['Status Belanja']] })
      });
    }

    // 4. Perform TARGETED single-cell update on the Status column cell
    // NEVER touches Column Tanggal or Column Nama Bahan or IMPORTRANGE formula!
    const colLetter = columnIndexToLetter(targetCol);
    const targetCell = `'${detectedTab}'!${colLetter}${targetRow}`;
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetCell)}?valueInputOption=USER_ENTERED`;
    
    const updateRes = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [[statusText]] })
    });

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.warn("Failed to update status cell in sheet:", err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating shopping item status in Sheet 4:", error);
    return false;
  }
}

// -------------------------------------------------------------
// SAVE SHOPPING LIST TO SHEET 4 (SAFE & FORMULA-PRESERVING)
// -------------------------------------------------------------
// CRITICAL: NEVER calls :clear!
// Checks existing cells with valueRenderOption=FORMULA.
// Any cell with =IMPORTRANGE(...) or formula in Column Tanggal or
// Column Nama Bahan is preserved intact and NEVER overwritten with static values.
export async function saveShoppingListToSheet4(
  spreadsheetId: string,
  items: ShoppingIngredientItem[],
  accessToken: string,
  tabName = 'Sheet 4'
): Promise<void> {
  try {
    await saveCloudSlot('shopping_list', { items, actualTabName: tabName });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, tabName, accessToken);

    // Fetch existing values AND formulas to detect formulas and headers
    const range = `'${tabName}'!A1:Z1000`;
    const formulaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`;
    let existingRows: string[][] = [];
    
    try {
      const fRes = await fetch(formulaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (fRes.ok) {
        const fData = await fRes.json();
        existingRows = fData.values || [];
      }
    } catch {}

    // 1. IF SHEET IS COMPLETELY EMPTY: Initialize standard header and write items
    if (existingRows.length === 0) {
      const headers = [
        "ID",
        "Tanggal",
        "Nama Bahan / Barang",
        "Kategori",
        "Jumlah Butuh",
        "Satuan",
        "Sisa Stok Saat Ini",
        "Stok Minimum Aman",
        "Estimasi Total Biaya (Rp)",
        "Supplier / Toko Langganan",
        "Prioritas / Urgensi",
        "Status Belanja",
        "Catatan / Spesifikasi",
        "Waktu Terakhir Diperbarui"
      ];

      const rows = [
        headers,
        ...items.map(item => [
          item.id,
          item.tanggal || new Date().toISOString().split('T')[0],
          item.namaBahan,
          item.kategori || 'Minuman',
          String(item.jumlah || 1),
          item.satuan || 'pcs',
          item.sisaStok !== undefined ? String(item.sisaStok) : '-',
          item.stokMinimum !== undefined ? String(item.stokMinimum) : '-',
          String(item.estimasiTotal || 0),
          item.supplier || '',
          item.prioritas === 'urgent' ? 'Mendesak / Urgent' : item.prioritas === 'tinggi' ? 'Tinggi' : item.prioritas === 'sedang' ? 'Sedang' : 'Rendah',
          item.status === 'sudah_dibeli' ? 'Sudah Dibeli' : item.status === 'sedang_dipesan' ? 'Sedang Dipesan' : item.status === 'dibatalkan' ? 'Dibatalkan' : 'Perlu Dibeli',
          item.catatan || '',
          new Date().toISOString()
        ])
      ];

      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A1:N${rows.length}?valueInputOption=USER_ENTERED`;
      const res = await fetch(writeUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gagal menyimpan daftar belanja bahan ke ${tabName}: ${err}`);
      }
      return;
    }

    // 2. IF SHEET HAS EXISTING ROWS / HEADERS / FORMULAS:
    // DO NOT CLEAR THE SHEET! That was destroying the user's IMPORTRANGE formula.
    // Detect which columns have formulas
    const formulaColumns = new Set<number>();
    for (let r = 0; r < Math.min(existingRows.length, 50); r++) {
      const row = existingRows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '');
        if (val.startsWith('=')) {
          formulaColumns.add(c);
        }
      }
    }

    // Detect column indices in existing header (row 0)
    const headerRow = existingRows[0] || [];
    let colStatus = -1;
    let colCatatan = -1;

    headerRow.forEach((rawH, idx) => {
      const h = (rawH || '').trim().toLowerCase();
      if (!h) return;
      if (colStatus === -1 && (h.includes('status') || h.includes('kondisi') || h.includes('selesai') || h.includes('keterangan status'))) colStatus = idx;
      if (colCatatan === -1 && (h.includes('catatan') || h.includes('keterangan') || h.includes('note'))) colCatatan = idx;
    });

    if (colStatus === -1) {
      colStatus = Math.max(headerRow.length, 3);
      const colLet = columnIndexToLetter(colStatus);
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!${colLet}1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [['Status Belanja']] })
      });
    }

    // Update row by row ONLY editable non-formula columns
    // Column Tanggal and Column Nama Bahan are 100% UNTOUCHED
    for (const item of items) {
      if (item.sourceRowIndex && item.sourceRowIndex > 0) {
        const rowIdx = item.sourceRowIndex;
        const statusText = item.status === 'sudah_dibeli' ? 'Sudah Dibeli' : 
                           item.status === 'sedang_dipesan' ? 'Sedang Dipesan' : 
                           item.status === 'dibatalkan' ? 'Dibatalkan' : 'Perlu Dibeli';
        
        // Update status cell in Google Sheets
        const statusLetter = columnIndexToLetter(colStatus);
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!${statusLetter}${rowIdx}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[statusText]] })
        });

        // If catatan is present and colCatatan is not formula-driven
        if (colCatatan >= 0 && !formulaColumns.has(colCatatan) && item.catatan !== undefined) {
          const catLetter = columnIndexToLetter(colCatatan);
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!${catLetter}${rowIdx}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[item.catatan || '']] })
          });
        }
      }
    }
  } catch (error) {
    console.error("Error saving shopping list to Sheet 4:", error);
    throw error;
  }
}

// =============================================================
// EMPLOYEE TASKS SYNC (TUGAS KARYAWAN)
// =============================================================

// Fetch employee tasks from 'Tugas Karyawan' tab in Google Sheets
export async function fetchEmployeeTasksFromSheet(
  spreadsheetId: string,
  accessToken: string,
  tabName = 'Tugas Karyawan'
): Promise<EmployeeTask[] | null> {
  try {
    const [cloudSlot, rows] = await Promise.all([
      loadCloudSlot<{ items?: EmployeeTask[] }>('employee_tasks'),
      fetchSheetRowsWithFallback(spreadsheetId, tabName, `'${tabName}'!A1:K1000`, accessToken)
    ]);

    if (cloudSlot?.items && Array.isArray(cloudSlot.items) && cloudSlot.items.length > 0) {
      return cloudSlot.items;
    }

    if (!rows) {
      return null;
    }
    if (rows.length <= 1) {
      return [];
    }

    const tasks: EmployeeTask[] = [];

    // Header expected:
    // [0]: ID, [1]: Tanggal, [2]: Nama Karyawan, [3]: Tugas, [4]: Shift, [5]: Gaji, [6]: Status, [7]: Prioritas, [8]: PIC, [9]: Catatan, [10]: Waktu Update
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const id = row[0] || `task-${r}`;
      const rawTanggal = row[1] || '';
      const tanggalPelaksanaan = normalizeDateString(rawTanggal) || String(rawTanggal).trim();
      const nama = row[2] || '';
      const tugas = row[3] || '';

      // Skip empty ghost rows
      if (!nama && !tugas) continue;

      const shift = (row[4] as any) || 'Pagi';
      const gaji = parseSheetNumber(row[5]);
      
      const rawStatus = (row[6] || '').trim();
      let status: EmployeeTask['status'] = 'Belum Dikerjakan';
      if (rawStatus.toLowerCase().includes('selesai') || rawStatus.toLowerCase().includes('done')) {
        status = 'Selesai';
      } else if (rawStatus.toLowerCase().includes('sedang') || rawStatus.toLowerCase().includes('progress')) {
        status = 'Sedang Berjalan';
      } else if (rawStatus.toLowerCase().includes('tunda') || rawStatus.toLowerCase().includes('delay')) {
        status = 'Ditunda';
      }

      const rawPrioritas = (row[7] || '').trim();
      let prioritas: EmployeeTask['prioritas'] = 'Sedang';
      if (rawPrioritas.toLowerCase().includes('tinggi') || rawPrioritas.toLowerCase().includes('high')) {
        prioritas = 'Tinggi';
      } else if (rawPrioritas.toLowerCase().includes('urgent') || rawPrioritas.toLowerCase().includes('darurat')) {
        prioritas = 'Urgent';
      } else if (rawPrioritas.toLowerCase().includes('rendah') || rawPrioritas.toLowerCase().includes('low')) {
        prioritas = 'Rendah';
      }

      const penanggungJawab = row[8] || '-';
      const catatan = row[9] || '';
      const updatedAt = row[10] || new Date().toISOString();

      tasks.push({
        id,
        nama,
        gaji,
        tugas,
        tanggalPelaksanaan: tanggalPelaksanaan || new Date().toISOString().split('T')[0],
        shift,
        status,
        prioritas,
        penanggungJawab,
        catatan,
        updatedAt,
        sourceRowIndex: r + 1
      });
    }

    return tasks;
  } catch (error) {
    console.error("Error fetching employee tasks from sheet:", error);
    return null;
  }
}

// Save all employee tasks to 'Tugas Karyawan' tab in Google Sheets
export async function saveEmployeeTasksToSheet(
  spreadsheetId: string,
  tasks: EmployeeTask[],
  accessToken: string,
  tabName = 'Tugas Karyawan'
): Promise<void> {
  try {
    await saveCloudSlot('employee_tasks', { items: tasks });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, tabName, accessToken);

    const headers = [
      "ID",
      "Tanggal Pelaksanaan",
      "Nama Karyawan",
      "Tugas / Pekerjaan",
      "Shift / Waktu",
      "Gaji / Upah (Rp)",
      "Status",
      "Prioritas",
      "PIC / Penanggung Jawab",
      "Catatan / Evaluasi",
      "Waktu Terakhir Diperbarui"
    ];

    const rows = [
      headers,
      ...tasks.map(t => [
        t.id,
        t.tanggalPelaksanaan,
        t.nama,
        t.tugas,
        t.shift || '-',
        String(t.gaji || 0),
        t.status,
        t.prioritas || 'Sedang',
        t.penanggungJawab || '-',
        t.catatan || '',
        t.updatedAt || new Date().toISOString()
      ])
    ];

    // Clear range first to avoid leftover rows
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A1:K1000:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A1:K${rows.length}?valueInputOption=USER_ENTERED`;
    const res = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gagal menyimpan data tugas karyawan ke ${tabName}: ${err}`);
    }
  } catch (error) {
    console.error("Error saving employee tasks to sheet:", error);
    throw error;
  }
}

// Append a single new task row to 'Tugas Karyawan'
export async function appendEmployeeTaskToSheet(
  spreadsheetId: string,
  task: EmployeeTask,
  accessToken: string,
  tabName = 'Tugas Karyawan'
): Promise<void> {
  try {
    const existing = await loadCloudSlot<{ items?: EmployeeTask[] }>('employee_tasks');
    const list = Array.isArray(existing?.items) ? [...existing.items, task] : [task];
    await saveCloudSlot('employee_tasks', { items: list });
    if (!accessToken || accessToken.endsWith('-local-token')) return;

    await createCustomSheetTab(spreadsheetId, tabName, accessToken);

    const row = [
      task.id,
      task.tanggalPelaksanaan,
      task.nama,
      task.tugas,
      task.shift || '-',
      String(task.gaji || 0),
      task.status,
      task.prioritas || 'Sedang',
      task.penanggungJawab || '-',
      task.catatan || '',
      task.updatedAt || new Date().toISOString()
    ];

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(tabName)}'!A:K:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [row] })
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("Failed to append task to sheet:", err);
    }
  } catch (err) {
    console.error("Error appending employee task to sheet:", err);
  }
}

