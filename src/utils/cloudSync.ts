// Universal Cross-Device Cloud Sync Engine
// Persists input data across all devices (HP, Tablet, Laptop) and all roles (Barista, Manajer, Owner)
// even when logged in via Role Password without Google OAuth or across stateless Vercel Serverless instances.

const KV_APP_KEY = "etem1g9b";
const KV_BASE_URL = `https://keyvalue.immanuel.co/api/KeyVal`;
const PASTE_BASE_URL = `https://api.pastes.dev`;

export interface SharedDailySalesState {
  updatedAt: number;
  lastSelectedDate: string | null;
  recordsByDate: Record<string, any>;
  deletedDates?: Record<string, number>;
}

const LOCAL_SALES_PATCH_KEY = "basco_cloud_sales_patch_v2";

export async function saveCloudSlot(slotName: string, data: any): Promise<boolean> {
  const payloadWithTs = {
    ...data,
    updatedAt: data?.updatedAt || Date.now(),
  };

  let pasteKey = "";

  // 1. Store unlimited-size JSON blob on api.pastes.dev + pointer on keyvalue.immanuel.co
  try {
    const postRes = await fetch(`${PASTE_BASE_URL}/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloadWithTs),
    });

    if (postRes.ok) {
      const postJson = await postRes.json();
      if (postJson?.key) {
        pasteKey = String(postJson.key).trim();
        await fetch(
          `${KV_BASE_URL}/UpdateValue/${KV_APP_KEY}/basco_v2_${slotName}/${encodeURIComponent(pasteKey)}`,
          { method: "POST" }
        );
      }
    }
  } catch {
    // fallback to backend API below
  }

  // 2. Mirror to backend API (/api/cloud-sync/:slot)
  try {
    await fetch(`/api/cloud-sync/${encodeURIComponent(slotName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pasteKey: pasteKey || undefined,
        data: payloadWithTs,
      }),
    });
  } catch {
    // ignore if backend route is unreachable
  }

  return Boolean(pasteKey);
}

export async function loadCloudSlot<T = any>(slotName: string): Promise<T | null> {
  let cloudData: any = null;
  let apiData: any = null;

  // 1. Try reading pointer from keyvalue.immanuel.co -> JSON from api.pastes.dev
  try {
    const ptrRes = await fetch(
      `${KV_BASE_URL}/GetValue/${KV_APP_KEY}/basco_v2_${slotName}?_t=${Date.now()}`,
      { cache: "no-store" }
    );
    if (ptrRes.ok) {
      const rawPtr = (await ptrRes.text()).replace(/"/g, "").trim();
      if (rawPtr && rawPtr !== "null" && rawPtr.length >= 4 && rawPtr.length <= 40 && !rawPtr.includes(" ")) {
        const pasteRes = await fetch(`${PASTE_BASE_URL}/${encodeURIComponent(rawPtr)}`, {
          cache: "no-store",
        });
        if (pasteRes.ok) {
          cloudData = await pasteRes.json();
        }
      }
    }
  } catch {
    // fallback to backend API below
  }

  // 2. Also check backend mirror (/api/cloud-sync/:slot)
  try {
    const apiRes = await fetch(`/api/cloud-sync/${encodeURIComponent(slotName)}?_t=${Date.now()}`, {
      cache: "no-store",
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json?.data) {
        apiData = json.data;
      }
    }
  } catch {
    // ignore
  }

  if (cloudData && apiData) {
    return (cloudData.updatedAt || 0) >= (apiData.updatedAt || 0) ? cloudData : apiData;
  }
  return cloudData || apiData || null;
}

// Helper for local patch cache of Daily Sales
function getLocalSalesPatch(): SharedDailySalesState {
  try {
    const raw = localStorage.getItem(LOCAL_SALES_PATCH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.recordsByDate) {
        return parsed;
      }
    }
  } catch {}
  return {
    updatedAt: 0,
    lastSelectedDate: null,
    recordsByDate: {},
    deletedDates: {},
  };
}

function setLocalSalesPatch(state: SharedDailySalesState) {
  try {
    localStorage.setItem(LOCAL_SALES_PATCH_KEY, JSON.stringify(state));
  } catch {}
}

let salesSyncTimer: any = null;
let pendingSalesPush = false;

export async function pushDailySalesToCloud(options: {
  record?: any;
  records?: any[];
  selectedDate?: string;
  deletedDate?: string;
  immediate?: boolean;
}): Promise<void> {
  const currentPatch = getLocalSalesPatch();
  const now = Date.now();

  if (options.selectedDate) {
    currentPatch.lastSelectedDate = options.selectedDate;
  }

  if (options.deletedDate) {
    currentPatch.deletedDates = currentPatch.deletedDates || {};
    currentPatch.deletedDates[options.deletedDate] = now;
    delete currentPatch.recordsByDate[options.deletedDate];
    currentPatch.updatedAt = now;
  }

  if (options.record && options.record.tanggal) {
    const tgl = options.record.tanggal;
    currentPatch.recordsByDate[tgl] = {
      ...options.record,
      updatedAt: options.record.updatedAt || now,
    };
    if (currentPatch.deletedDates) {
      delete currentPatch.deletedDates[tgl];
    }
    currentPatch.updatedAt = now;
  }

  if (Array.isArray(options.records)) {
    options.records.forEach((r) => {
      if (!r || !r.tanggal) return;
      // Only include user-created / modified records or non-dummy records
      if (r.id === "ds-1" || r.id === "ds-2" || r.id === "ds-3") return;
      if (r.updatedAt || options.immediate) {
        currentPatch.recordsByDate[r.tanggal] = {
          ...r,
          updatedAt: r.updatedAt || now,
        };
      }
    });
    currentPatch.updatedAt = now;
  }

  setLocalSalesPatch(currentPatch);

  // Also notify legacy endpoint immediately
  try {
    fetch("/api/cogs/shared-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: options.record,
        records: Object.values(currentPatch.recordsByDate),
        selectedDate: currentPatch.lastSelectedDate,
      }),
    }).catch(() => {});
  } catch {}

  const executeCloudPush = async () => {
    pendingSalesPush = false;
    try {
      const remote = await loadCloudSlot<SharedDailySalesState>("daily_sales");
      const local = getLocalSalesPatch();

      const mergedRecords: Record<string, any> = {};
      const mergedDeleted: Record<string, number> = {
        ...(remote?.deletedDates || {}),
        ...(local.deletedDates || {}),
      };

      if (remote?.recordsByDate && typeof remote.recordsByDate === "object") {
        Object.entries(remote.recordsByDate).forEach(([tgl, rec]: [string, any]) => {
          const delTs = mergedDeleted[tgl] || 0;
          if ((rec?.updatedAt || 0) >= delTs) {
            mergedRecords[tgl] = rec;
          }
        });
      }

      Object.entries(local.recordsByDate || {}).forEach(([tgl, rec]: [string, any]) => {
        const existing = mergedRecords[tgl];
        const delTs = mergedDeleted[tgl] || 0;
        const recTs = rec?.updatedAt || now;
        if (recTs >= delTs && (!existing || recTs >= (existing.updatedAt || 0))) {
          mergedRecords[tgl] = { ...rec, updatedAt: recTs };
        }
      });

      const finalState: SharedDailySalesState = {
        updatedAt: Math.max(now, remote?.updatedAt || 0, local.updatedAt || 0),
        lastSelectedDate: local.lastSelectedDate || remote?.lastSelectedDate || null,
        recordsByDate: mergedRecords,
        deletedDates: mergedDeleted,
      };

      setLocalSalesPatch(finalState);
      await saveCloudSlot("daily_sales", finalState);
    } catch {
      // ignore network error
    }
  };

  if (options.immediate) {
    if (salesSyncTimer) clearTimeout(salesSyncTimer);
    await executeCloudPush();
  } else {
    pendingSalesPush = true;
    if (salesSyncTimer) clearTimeout(salesSyncTimer);
    salesSyncTimer = setTimeout(() => {
      if (pendingSalesPush) executeCloudPush();
    }, 600);
  }
}

export async function pullDailySalesFromCloud(): Promise<SharedDailySalesState | null> {
  try {
    const [cloudSlot, apiResp] = await Promise.all([
      loadCloudSlot<SharedDailySalesState>("daily_sales"),
      fetch(`/api/cogs/shared-sales?_t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const local = getLocalSalesPatch();
    const mergedRecords: Record<string, any> = {};
    const mergedDeleted: Record<string, number> = {
      ...(cloudSlot?.deletedDates || {}),
      ...(local.deletedDates || {}),
    };

    const mergeSource = (srcRecords?: Record<string, any>) => {
      if (!srcRecords || typeof srcRecords !== "object") return;
      Object.entries(srcRecords).forEach(([tgl, rec]: [string, any]) => {
        if (!rec || !rec.tanggal) return;
        if (rec.id === "ds-1" || rec.id === "ds-2" || rec.id === "ds-3") return;
        const delTs = mergedDeleted[tgl] || 0;
        const recTs = rec.updatedAt || 1;
        if (recTs < delTs) return;
        const existing = mergedRecords[tgl];
        if (!existing || recTs >= (existing.updatedAt || 0)) {
          mergedRecords[tgl] = rec;
        }
      });
    };

    mergeSource(local.recordsByDate);
    mergeSource(apiResp?.recordsByDate);
    mergeSource(cloudSlot?.recordsByDate);

    // Determine latest selectedDate by comparing updatedAt
    let bestSelectedDate = local.lastSelectedDate;
    let bestTs = local.updatedAt || 0;

    if (apiResp?.lastSelectedDate && (apiResp.updatedAt || 0) >= bestTs) {
      bestSelectedDate = apiResp.lastSelectedDate;
      bestTs = apiResp.updatedAt || 0;
    }
    if (cloudSlot?.lastSelectedDate && (cloudSlot.updatedAt || 0) >= bestTs) {
      bestSelectedDate = cloudSlot.lastSelectedDate;
      bestTs = cloudSlot.updatedAt || 0;
    }

    const result: SharedDailySalesState = {
      updatedAt: Math.max(local.updatedAt || 0, apiResp?.updatedAt || 0, cloudSlot?.updatedAt || 0),
      lastSelectedDate: bestSelectedDate || cloudSlot?.lastSelectedDate || apiResp?.lastSelectedDate || null,
      recordsByDate: mergedRecords,
      deletedDates: mergedDeleted,
    };

    setLocalSalesPatch(result);
    return result;
  } catch {
    return getLocalSalesPatch();
  }
}
