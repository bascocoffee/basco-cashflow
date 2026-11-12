import { AppRole } from '../types';
import { loadCloudSlot, saveCloudSlot } from './cloudSync';

export type ActivityActionType =
  | 'login'
  | 'logout'
  | 'navigate'
  | 'create'
  | 'update'
  | 'delete'
  | 'scan_receipt'
  | 'sync'
  | 'export';

export interface AppActivityLog {
  id: string;
  timestamp: number;
  role: AppRole;
  actorName: string;
  authMethod: 'password' | 'google' | 'session';
  actionType: ActivityActionType;
  module: string;
  description: string;
  deviceLabel: string;
}

interface CloudActivityPayload {
  logs?: AppActivityLog[];
  clearedAt?: number;
  updatedAt?: number;
}

export const ACTIVITY_LOGS_SLOT = 'app_usage_logs';
export const ACTIVITY_LOGS_STORAGE_KEY = 'basco_app_usage_logs_v1';
export const ACTIVITY_CLEARED_AT_KEY = 'basco_app_usage_cleared_at_v1';
const MAX_STORED_LOGS = 500;
const NAVIGATE_DEDUPE_MS = 15000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastNavSignature = '';
let lastNavTs = 0;

/** Returns a concise human-readable device label from userAgent. */
export function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'HP / Tablet Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
  if (/Windows/i.test(ua)) return 'PC / Laptop Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'MacBook / macOS';
  if (/Linux/i.test(ua)) return 'Desktop Linux';
  return 'Web Browser';
}

export function getActiveRoleFromStorage(): AppRole {
  try {
    const saved = localStorage.getItem('aruskas_user_role');
    if (saved === 'owner' || saved === 'manager' || saved === 'barista') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'owner';
}

export function getDefaultActorName(role: AppRole): string {
  if (role === 'owner') return 'Owner Basco Coffee';
  if (role === 'manager') return 'Manager Cafe';
  return 'Barista Basco';
}

export function getActiveAuthMethod(): 'password' | 'google' | 'session' {
  try {
    if (localStorage.getItem('aruskas_is_manager_mode') === 'true') {
      return 'password';
    }
    const token = localStorage.getItem('aruskas_google_access_token');
    if (token && !token.endsWith('-local-token')) {
      return 'google';
    }
  } catch {
    // ignore
  }
  return 'session';
}

function readClearedAt(): number {
  try {
    const raw = localStorage.getItem(ACTIVITY_CLEARED_AT_KEY);
    return Number(raw) || 0;
  } catch {
    return 0;
  }
}

function writeClearedAt(ts: number): void {
  try {
    localStorage.setItem(ACTIVITY_CLEARED_AT_KEY, String(ts));
  } catch {
    // ignore
  }
}

export function readLocalActivityLogs(): AppActivityLog[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalActivityLogs(logs: AppActivityLog[]): void {
  try {
    localStorage.setItem(ACTIVITY_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_STORED_LOGS)));
  } catch {
    // ignore storage quota errors
  }
}

function mergeActivityLogs(
  localLogs: AppActivityLog[],
  remoteLogs: AppActivityLog[],
  clearedAt: number
): AppActivityLog[] {
  const byId = new Map<string, AppActivityLog>();
  const ingest = (list: AppActivityLog[]) => {
    for (const item of list) {
      if (!item || typeof item.id !== 'string' || !item.timestamp) continue;
      if (clearedAt > 0 && item.timestamp <= clearedAt) continue;
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
  };
  ingest(remoteLogs);
  ingest(localLogs);
  return Array.from(byId.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_STORED_LOGS);
}

async function flushLogsToCloud(): Promise<void> {
  try {
    const remote = await loadCloudSlot<CloudActivityPayload>(ACTIVITY_LOGS_SLOT);
    const localLogs = readLocalActivityLogs();
    const localClearedAt = readClearedAt();
    const remoteClearedAt = Number(remote?.clearedAt) || 0;
    const effectiveClearedAt = Math.max(localClearedAt, remoteClearedAt);
    if (effectiveClearedAt > localClearedAt) {
      writeClearedAt(effectiveClearedAt);
    }

    const remoteLogs = Array.isArray(remote?.logs) ? remote!.logs : [];
    const merged = mergeActivityLogs(localLogs, remoteLogs, effectiveClearedAt);
    writeLocalActivityLogs(merged);

    await saveCloudSlot(ACTIVITY_LOGS_SLOT, {
      logs: merged,
      clearedAt: effectiveClearedAt,
      updatedAt: Date.now(),
    });
  } catch {
    // ignore offline errors; local logs remain cached for next flush
  }
}

export interface LogAppActivityInput {
  role?: AppRole;
  actorName?: string;
  authMethod?: 'password' | 'google' | 'session';
  actionType: ActivityActionType;
  module: string;
  description: string;
  timestamp?: number;
  immediateSync?: boolean;
}

/**
 * Record an application usage event across Owner, Manajer, or Barista roles
 * and synchronize it across devices via cloudSync.
 */
export function logAppActivity(input: LogAppActivityInput): void {
  if (typeof window === 'undefined') return;
  const now = input.timestamp || Date.now();
  const role: AppRole = input.role || getActiveRoleFromStorage();

  // Prevent repeated navigate spam when component re-renders or switches right back
  if (input.actionType === 'navigate') {
    const sig = `${role}:${input.module}`;
    if (sig === lastNavSignature && now - lastNavTs < NAVIGATE_DEDUPE_MS) {
      return;
    }
    lastNavSignature = sig;
    lastNavTs = now;
  }

  const entry: AppActivityLog = {
    id: `act-${now}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    role,
    actorName: (input.actorName || '').trim() || getDefaultActorName(role),
    authMethod: input.authMethod || getActiveAuthMethod(),
    actionType: input.actionType,
    module: input.module,
    description: input.description,
    deviceLabel: detectDeviceLabel(),
  };

  const clearedAt = readClearedAt();
  const nextLocal = mergeActivityLogs([entry, ...readLocalActivityLogs()], [], clearedAt);
  writeLocalActivityLogs(nextLocal);

  if (input.immediateSync) {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    void flushLogsToCloud();
    return;
  }

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushLogsToCloud();
  }, 1000);
}

/** Fetch merged usage logs from cloud + local cache (newest first). */
export async function fetchAppActivityLogs(): Promise<AppActivityLog[]> {
  const localLogs = readLocalActivityLogs();
  const localClearedAt = readClearedAt();

  try {
    const remote = await loadCloudSlot<CloudActivityPayload>(ACTIVITY_LOGS_SLOT);
    const remoteClearedAt = Number(remote?.clearedAt) || 0;
    const effectiveClearedAt = Math.max(localClearedAt, remoteClearedAt);
    if (effectiveClearedAt > localClearedAt) {
      writeClearedAt(effectiveClearedAt);
    }

    const remoteLogs = Array.isArray(remote?.logs) ? remote!.logs : [];
    const merged = mergeActivityLogs(localLogs, remoteLogs, effectiveClearedAt);
    writeLocalActivityLogs(merged);
    return merged;
  } catch {
    return mergeActivityLogs(localLogs, [], localClearedAt);
  }
}

/** Clear all logs or logs older than `keepDays` days (Owner action). */
export async function pruneAppActivityLogs(keepDays?: number): Promise<AppActivityLog[]> {
  const now = Date.now();
  const cutoff = typeof keepDays === 'number' && keepDays > 0 ? now - keepDays * 24 * 60 * 60 * 1000 : now;
  const current = await fetchAppActivityLogs();
  const remaining = typeof keepDays === 'number' && keepDays > 0
    ? current.filter(item => item.timestamp >= cutoff)
    : [];

  writeClearedAt(cutoff);
  writeLocalActivityLogs(remaining);

  try {
    await saveCloudSlot(ACTIVITY_LOGS_SLOT, {
      logs: remaining,
      clearedAt: cutoff,
      updatedAt: now,
    });
  } catch {
    // ignore offline error
  }

  return remaining;
}
