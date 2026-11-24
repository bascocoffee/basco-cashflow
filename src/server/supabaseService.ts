// Supabase PostgreSQL Cloud Sync Service (via PostgREST API)
// Zero external dependencies, works natively on Node.js and Vercel Serverless.

export interface SupabaseStatus {
  enabled: boolean;
  connected: boolean;
  url: string;
  slotCount?: number;
  message: string;
  lastChecked: string;
}

const getSupabaseConfig = () => {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return { url, key, enabled: Boolean(url && key) };
};

export async function getSupabaseStatus(): Promise<SupabaseStatus> {
  const { url, key, enabled } = getSupabaseConfig();
  const lastChecked = new Date().toISOString();

  if (!enabled) {
    return {
      enabled: false,
      connected: false,
      url: url || '-',
      message: 'SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY belum dikonfigurasi di .env / Vercel.',
      lastChecked,
    };
  }

  try {
    const res = await fetch(`${url}/rest/v1/basco_cloud_slots?select=slot_name`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
      },
    });

    if (res.ok) {
      const rows: any = await res.json();
      const count = Array.isArray(rows) ? rows.length : 0;
      return {
        enabled: true,
        connected: true,
        url,
        slotCount: count,
        message: `Terhubung ke Supabase PostgreSQL (${count} slot data tersimpan).`,
        lastChecked,
      };
    }

    const errText = await res.text();
    if (res.status === 404 || errText.includes('does not exist') || errText.includes('42P01')) {
      return {
        enabled: true,
        connected: false,
        url,
        message: 'Koneksi Supabase aktif, tetapi tabel "basco_cloud_slots" belum dibuat. Jalankan SQL setup di Supabase SQL Editor.',
        lastChecked,
      };
    }

    return {
      enabled: true,
      connected: false,
      url,
      message: `Supabase error (${res.status}): ${errText.slice(0, 150)}`,
      lastChecked,
    };
  } catch (err: any) {
    return {
      enabled: true,
      connected: false,
      url,
      message: `Gagal menghubungi Supabase: ${err?.message || 'Network error'}`,
      lastChecked,
    };
  }
}

export async function saveSlotToSupabase(slotName: string, data: any): Promise<boolean> {
  const { url, key, enabled } = getSupabaseConfig();
  if (!enabled || !slotName || !data) return false;

  const updatedAt = Number(data?.updatedAt) || Date.now();
  const payload = {
    ...data,
    updatedAt,
  };

  try {
    const res = await fetch(`${url}/rest/v1/basco_cloud_slots`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        slot_name: slotName,
        payload,
        updated_at: updatedAt,
        updated_iso: new Date(updatedAt).toISOString(),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] Save slot "${slotName}" failed (${res.status}):`, errText.slice(0, 200));
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn(`[Supabase] Save slot "${slotName}" error:`, err?.message || err);
    return false;
  }
}

export async function loadSlotFromSupabase(slotName: string): Promise<any | null> {
  const { url, key, enabled } = getSupabaseConfig();
  if (!enabled || !slotName) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/basco_cloud_slots?slot_name=eq.${encodeURIComponent(slotName)}&select=payload,updated_at`,
      {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    );

    if (!res.ok) {
      return null;
    }

    const rows: any = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.payload) {
      const payload = rows[0].payload;
      if (!payload.updatedAt && rows[0].updated_at) {
        payload.updatedAt = Number(rows[0].updated_at);
      }
      return payload;
    }

    return null;
  } catch (err: any) {
    console.warn(`[Supabase] Load slot "${slotName}" error:`, err?.message || err);
    return null;
  }
}
