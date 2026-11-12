export interface ReceiptMenuRef {
  id: string;
  nama: string;
  kategori?: string;
  hargaJual?: number;
}

export interface ScannedReceiptMenuItem {
  menuId: string;
  matchedMenuName: string;
  receiptName: string;
  qty: number;
  confidence: 'high' | 'medium';
}

export interface UnmatchedReceiptItem {
  receiptName: string;
  qty: number;
}

export interface ReceiptScanResult {
  engineUsed: string;
  previewUrl: string;
  tanggal: string | null;
  items: ScannedReceiptMenuItem[];
  unmatched: UnmatchedReceiptItem[];
  rawSummary: string;
  rawText?: string;
}

const ABBREVIATION_MAP: Record<string, string> = {
  kopsus: 'kopi susu',
  kopsu: 'kopi susu',
  aren: 'gula aren',
  amer: 'americano',
  amc: 'americano',
  lb: 'long black',
  cap: 'cappuccino',
  capp: 'cappuccino',
  capu: 'cappuccino',
  cappu: 'cappuccino',
  choco: 'chocolate',
  coklat: 'chocolate',
  cokelat: 'chocolate',
  choc: 'chocolate',
  straw: 'strawberry',
  stroberi: 'strawberry',
  car: 'caramel',
  karamel: 'caramel',
  macc: 'macchiato',
  mach: 'macchiato',
  match: 'matcha',
  macha: 'matcha',
  greentea: 'green tea matcha',
  rv: 'red velvet',
  esp: 'espresso',
  lt: 'latte',
  van: 'vanilla',
  haz: 'hazelnut',
  ice: 'es',
  iced: 'es',
  dingin: 'es',
  panas: 'hot',
  ff: 'french fries',
  kentang: 'french fries',
  nasgor: 'nasi goreng',
  migor: 'mie goreng',
  mayam: 'mie ayam',
  spc: 'special',
  spesial: 'special',
  reg: 'regular',
  lrg: 'large',
  sig: 'signature',
  bsc: 'basco',
};

const NOISE_LINE_KEYWORDS = [
  'subtotal',
  'sub total',
  'grand total',
  'total item',
  'total qty',
  'total porsi',
  'total bayar',
  'total penjualan',
  'total harga',
  'pajak',
  'pb1',
  'ppn',
  'service charge',
  'diskon',
  'discount',
  'potongan',
  'voucher',
  'promo',
  'tunai',
  'cash',
  'kembalian',
  'kembali',
  'change',
  'qris',
  'gopay',
  'ovo',
  'dana',
  'shopeepay',
  'debit',
  'kredit',
  'credit',
  'transfer',
  'edc',
  'kasir',
  'cashier',
  'waiter',
  'pelanggan',
  'customer',
  'meja',
  'table',
  'struk',
  'receipt',
  'invoice',
  'no nota',
  'no order',
  'terima kasih',
  'thank you',
  'powered by',
  'wifi',
  'password',
  'instagram',
];

const INDONESIAN_MONTHS: Record<string, string> = {
  jan: '01', januari: '01', january: '01',
  feb: '02', februari: '02', february: '02',
  mar: '03', maret: '03', march: '03',
  apr: '04', april: '04',
  mei: '05', may: '05',
  jun: '06', juni: '06', june: '06',
  jul: '07', juli: '07', july: '07',
  agu: '08', ags: '08', agustus: '08', aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  okt: '10', oktober: '10', oct: '10', october: '10',
  nov: '11', november: '11',
  des: '12', desember: '12', dec: '12', december: '12',
};

function normalizeMenuText(raw: string): string {
  const tokens = String(raw || '')
    .toLowerCase()
    .replace(/[\/\\|_+*•·:;()\[\]{}"'`~,.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  const expanded: string[] = [];
  for (const tok of tokens) {
    const mapped = ABBREVIATION_MAP[tok];
    if (mapped) {
      expanded.push(...mapped.split(' '));
    } else {
      expanded.push(tok);
    }
  }
  return expanded.join(' ').trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function scoreMenuMatch(queryNorm: string, targetNorm: string): number {
  if (!queryNorm || !targetNorm) return 0;
  if (queryNorm === targetNorm) return 1;

  const qCompact = queryNorm.replace(/\s+/g, '');
  const tCompact = targetNorm.replace(/\s+/g, '');
  if (qCompact === tCompact) return 0.98;

  const qTokens = queryNorm.split(' ').filter((w) => w.length >= 2);
  const tTokens = targetNorm.split(' ').filter((w) => w.length >= 2);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  let matchedQueryTokens = 0;
  let tokenSimilaritySum = 0;

  for (const qt of qTokens) {
    let bestTokSim = 0;
    for (const tt of tTokens) {
      if (qt === tt) {
        bestTokSim = 1;
        break;
      }
      if (tt.startsWith(qt) || qt.startsWith(tt)) {
        bestTokSim = Math.max(bestTokSim, 0.86);
      } else {
        const dist = levenshteinDistance(qt, tt);
        const maxLen = Math.max(qt.length, tt.length);
        const sim = maxLen > 0 ? 1 - dist / maxLen : 0;
        if (sim >= 0.72) {
          bestTokSim = Math.max(bestTokSim, sim * 0.9);
        }
      }
    }
    if (bestTokSim >= 0.72) {
      matchedQueryTokens++;
    }
    tokenSimilaritySum += bestTokSim;
  }

  const queryRecall = tokenSimilaritySum / qTokens.length;
  const targetCoverage = matchedQueryTokens / tTokens.length;
  const maxStrLen = Math.max(queryNorm.length, targetNorm.length);
  const charSimilarity = maxStrLen > 0 ? 1 - levenshteinDistance(queryNorm, targetNorm) / maxStrLen : 0;

  const containsBonus =
    targetNorm.includes(queryNorm) || queryNorm.includes(targetNorm) ? 0.14 : 0;

  return Math.min(1, queryRecall * 0.55 + targetCoverage * 0.25 + charSimilarity * 0.2 + containsBonus);
}

/** Match an item name extracted from a receipt against the cafe menu catalog. */
export function matchReceiptMenuName(
  receiptName: string,
  menuCatalog: ReceiptMenuRef[]
): { menu: ReceiptMenuRef; confidence: 'high' | 'medium'; score: number } | null {
  const queryNorm = normalizeMenuText(receiptName);
  if (!queryNorm || queryNorm.length < 2) return null;

  let best: { menu: ReceiptMenuRef; score: number } | null = null;
  for (const menu of menuCatalog) {
    const targetNorm = normalizeMenuText(menu.nama);
    const score = scoreMenuMatch(queryNorm, targetNorm);
    if (!best || score > best.score) {
      best = { menu, score };
    }
  }

  if (!best || best.score < 0.52) return null;
  return {
    menu: best.menu,
    confidence: best.score >= 0.76 ? 'high' : 'medium',
    score: best.score,
  };
}

/** Load an uploaded image file and return a compressed base64 JPEG plus an OCR-enhanced canvas copy. */
export async function compressReceiptImage(
  file: File,
  maxDim = 1600,
  quality = 0.86
): Promise<{
  dataUrl: string;
  base64: string;
  mimeType: string;
  ocrDataUrl: string;
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal memuat file gambar nota.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser tidak mendukung pemrosesan kanvas gambar.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const mimeType = 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const base64 = dataUrl.split(',')[1] || '';

    // Create high-contrast grayscale canvas for local Tesseract OCR fallback
    const ocrCanvas = document.createElement('canvas');
    ocrCanvas.width = width;
    ocrCanvas.height = height;
    const ocrCtx = ocrCanvas.getContext('2d');
    let ocrDataUrl = dataUrl;
    if (ocrCtx) {
      ocrCtx.filter = 'grayscale(100%) contrast(145%) brightness(105%)';
      ocrCtx.drawImage(canvas, 0, 0);
      ocrDataUrl = ocrCanvas.toDataURL('image/png');
    }

    return { dataUrl, base64, mimeType, ocrDataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function detectDateFromReceiptText(text: string): string | null {
  const isoMatch = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dmyMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  const namedMonthMatch = text
    .toLowerCase()
    .match(/\b(\d{1,2})\s+([a-z]{3,10})\s+(20\d{2})\b/);
  if (namedMonthMatch) {
    const [, d, monthWord, y] = namedMonthMatch;
    const m = INDONESIAN_MONTHS[monthWord];
    if (m && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  return null;
}

function isNoiseReceiptLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (!lower || lower.length < 2) return true;
  if (/^[-=_.*#\s]+$/.test(lower)) return true;
  if (!/[a-z]/i.test(lower)) return true;

  for (const kw of NOISE_LINE_KEYWORDS) {
    if (lower === kw || lower.startsWith(`${kw} `) || lower.startsWith(`${kw}:`) || lower.includes(` ${kw}`)) {
      // Skip strictly summary/payment rows unless "total" is actually preceded by something else
      if (kw === 'total' || lower.startsWith('total') || NOISE_LINE_KEYWORDS.some((k) => lower.includes(k))) {
        return true;
      }
    }
  }
  if (/^\s*total\b/i.test(lower)) return true;
  if (/\b(?:rp\.?\s*[\d.,]+)\s*$/i.test(lower) && !/\d+\s*[x×]\b/i.test(lower) && lower.split(/\s+/).length <= 2) {
    return true;
  }
  return false;
}

function cleanItemCandidateText(raw: string): string {
  return raw
    .replace(/^\s*\d{1,2}\s*[.)]\s+/, '') // strip leading numbering "1. " or "1) "
    .replace(/\b(?:rp|idr)\.?\s*[\d.,]+\b/gi, '') // strip currency amounts
    .replace(/\b\d{1,3}(?:[.,]\d{3})+\b/g, '') // strip formatted thousand numbers (19.000, 100,000)
    .replace(/\b\d{4,}\b/g, '') // strip >= 1000 raw prices
    .replace(/\b(?:pcs|cup|cups|porsi|qty|btl|pack|box)\b/gi, '')
    .replace(/[-:=]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse OCR raw receipt text into matched menu quantities + unmatched item candidates. */
export function parseOcrReceiptText(
  rawText: string,
  menuCatalog: ReceiptMenuRef[]
): {
  tanggal: string | null;
  items: ScannedReceiptMenuItem[];
  unmatched: UnmatchedReceiptItem[];
} {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const tanggal = detectDateFromReceiptText(rawText);
  const aggregatedMap = new Map<string, ScannedReceiptMenuItem>();
  const unmatchedMap = new Map<string, number>();

  const recordExtractedLine = (candidateName: string, qty: number) => {
    const cleanName = cleanItemCandidateText(candidateName);
    if (!cleanName || cleanName.length < 2 || qty <= 0 || qty > 999) return;
    if (isNoiseReceiptLine(cleanName)) return;

    const match = matchReceiptMenuName(cleanName, menuCatalog);
    if (match) {
      const prev = aggregatedMap.get(match.menu.id);
      if (prev) {
        prev.qty += qty;
      } else {
        aggregatedMap.set(match.menu.id, {
          menuId: match.menu.id,
          matchedMenuName: match.menu.nama,
          receiptName: cleanName,
          qty,
          confidence: match.confidence,
        });
      }
    } else {
      const key = cleanName.toLowerCase();
      unmatchedMap.set(key, (unmatchedMap.get(key) || 0) + qty);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check 2-line POS format where next line is qty x @unitPrice ...
    if (i + 1 < lines.length && !isNoiseReceiptLine(line)) {
      const nextLine = lines[i + 1];
      const nextQtyMatch = nextLine.match(/^\s*(\d{1,3})\s*[x×*]\s*(?:@?\s*(?:rp\.?\s*)?[\d.,]+)?/i);
      if (nextQtyMatch && !/[a-z]{4,}/i.test(nextLine.replace(/\brp\b/gi, ''))) {
        const qty = parseInt(nextQtyMatch[1], 10) || 0;
        recordExtractedLine(line, qty);
        i++; // consume next line
        continue;
      }
    }

    if (isNoiseReceiptLine(line)) continue;

    // Pattern 1: Leading qty ("5x Es Kopi Susu", "5 x Es Kopi Susu", "5 Es Kopi Susu 95.000")
    const leadXMatch = line.match(/^(?:\d{1,2}\s*[.)]\s+)?(\d{1,3})\s*[x×*]\s+(.+)$/i);
    if (leadXMatch) {
      const qty = parseInt(leadXMatch[1], 10) || 0;
      recordExtractedLine(leadXMatch[2], qty);
      continue;
    }

    // Pattern 2: Name with "x Qty" or "Qty x" ("Es Kopi Susu x 5", "Es Kopi Susu 5x")
    const midXMatch = line.match(/^(.+?)\s+(?:[x×*]\s*(\d{1,3})|(\d{1,3})\s*[x×*])(?:\s+.*)?$/i);
    if (midXMatch) {
      const qty = parseInt(midXMatch[2] || midXMatch[3], 10) || 0;
      recordExtractedLine(midXMatch[1], qty);
      continue;
    }

    // Pattern 3: Tabular POS / Tally ("Es Kopi Susu Basco   5   95.000" or "Matcha Latte   3 pcs" or "Americano : 4")
    const strippedPriceLine = line
      .replace(/\b(?:rp|idr)\.?\s*[\d.,]+\s*$/i, '')
      .replace(/\b\d{1,3}(?:[.,]\d{3})+\s*$/i, '')
      .replace(/\b\d{4,}\s*$/i, '')
      .trim();

    const tailQtyMatch = strippedPriceLine.match(/^(.+?)(?:\s+[-:=]?\s*|\s+)(\d{1,3})(?:\s*(?:pcs|cup|cups|porsi|qty))?$/i);
    if (tailQtyMatch) {
      const qty = parseInt(tailQtyMatch[2], 10) || 0;
      recordExtractedLine(tailQtyMatch[1], qty);
      continue;
    }

    // Pattern 4: Leading standalone quantity ("5 Es Kopi Susu Basco")
    const leadQtyMatch = strippedPriceLine.match(/^(\d{1,3})\s+([a-zA-Z].{2,})$/);
    if (leadQtyMatch) {
      const qty = parseInt(leadQtyMatch[1], 10) || 0;
      recordExtractedLine(leadQtyMatch[2], qty);
    }
  }

  const unmatched: UnmatchedReceiptItem[] = Array.from(unmatchedMap.entries()).map(([k, qty]) => ({
    receiptName: k.replace(/\b\w/g, (c) => c.toUpperCase()),
    qty,
  }));

  return {
    tanggal,
    items: Array.from(aggregatedMap.values()),
    unmatched,
  };
}

/**
 * Scan a daily sales receipt photo:
 * 1) Sends compressed image + menu catalog to `/api/cogs/scan-sales-receipt` (Gemini/Claude Vision)
 * 2) Automatically falls back to local Tesseract OCR + fuzzy catalog matcher if Vision AI is unavailable
 */
export async function scanSalesReceiptImage(
  file: File,
  menuCatalog: ReceiptMenuRef[],
  onProgress?: (status: string) => void
): Promise<ReceiptScanResult> {
  onProgress?.('Mengoptimalkan ukuran & ketajaman foto nota...');
  const compressed = await compressReceiptImage(file);

  onProgress?.('Membaca daftar menu terjual dari foto nota...');
  try {
    const response = await fetch('/api/cogs/scan-sales-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
        menuCatalog: menuCatalog.map((m) => ({
          id: m.id,
          nama: m.nama,
          kategori: m.kategori,
          hargaJual: m.hargaJual,
        })),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.ok && !data?.visionUnavailable) {
        const reconciledMap = new Map<string, ScannedReceiptMenuItem>();
        const stillUnmatched: UnmatchedReceiptItem[] = [];

        for (const item of Array.isArray(data.items) ? data.items : []) {
          const qty = Math.max(0, Math.round(Number(item?.qty || 0)));
          if (!item?.menuId || qty <= 0) continue;
          const prev = reconciledMap.get(item.menuId);
          if (prev) {
            prev.qty += qty;
          } else {
            reconciledMap.set(item.menuId, {
              menuId: String(item.menuId),
              matchedMenuName: String(item.matchedMenuName || ''),
              receiptName: String(item.receiptName || item.matchedMenuName || ''),
              qty,
              confidence: item.confidence === 'medium' ? 'medium' : 'high',
            });
          }
        }

        // Extra client-side fuzzy match pass on any items Vision flagged as unmatched
        for (const u of Array.isArray(data.unmatched) ? data.unmatched : []) {
          const qty = Math.max(0, Math.round(Number(u?.qty || 0)));
          const receiptName = String(u?.receiptName || '').trim();
          if (qty <= 0 || !receiptName) continue;

          const fuzzy = matchReceiptMenuName(receiptName, menuCatalog);
          if (fuzzy) {
            const prev = reconciledMap.get(fuzzy.menu.id);
            if (prev) {
              prev.qty += qty;
            } else {
              reconciledMap.set(fuzzy.menu.id, {
                menuId: fuzzy.menu.id,
                matchedMenuName: fuzzy.menu.nama,
                receiptName,
                qty,
                confidence: fuzzy.confidence,
              });
            }
          } else {
            stillUnmatched.push({ receiptName, qty });
          }
        }

        return {
          engineUsed: `AI Vision (${data.engine || 'vision'})`,
          previewUrl: compressed.dataUrl,
          tanggal: data.tanggal || null,
          items: Array.from(reconciledMap.values()),
          unmatched: stillUnmatched,
          rawSummary: String(data.rawSummary || ''),
        };
      }
    }
  } catch (err) {
    console.warn('[ReceiptScanner] Server Vision fallback to local OCR:', err);
  }

  // Fallback: Local Tesseract OCR + Smart Indonesian Cafe Line Parser
  onProgress?.('Menjalankan pembaca teks nota lokal (OCR)...');
  const { createWorker } = await import('tesseract.js');
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker('ind+eng');
  } catch {
    worker = await createWorker('eng');
  }
  try {
    const {
      data: { text },
    } = await worker.recognize(compressed.ocrDataUrl);
    const parsed = parseOcrReceiptText(text || '', menuCatalog);

    return {
      engineUsed: 'OCR Nota Lokal (Tesseract)',
      previewUrl: compressed.dataUrl,
      tanggal: parsed.tanggal,
      items: parsed.items,
      unmatched: parsed.unmatched,
      rawSummary:
        parsed.items.length > 0
          ? `${parsed.items.length} menu berhasil dikenali dari foto nota`
          : 'Teks terbaca, periksa kesesuaian nama menu',
      rawText: text || '',
    };
  } finally {
    await worker.terminate().catch(() => {});
  }
}
