import { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  TrendingUp, 
  RefreshCw, 
  ExternalLink, 
  LogOut, 
  Copy, 
  Check, 
  Coffee, 
  ClipboardList, 
  Layers, 
  Calculator, 
  Bot,
  Users,
  FileJson,
  X,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Flame,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  FileSpreadsheet,
  Calendar,
  BellRing,
  CreditCard,
  ShoppingCart,
  UserCheck,
  History
} from 'lucide-react';
import { logout } from '../firebase';
import { CALENDAR_NOTES_STORAGE_KEY, DEFAULT_CALENDAR_ACTIVITIES, computeH1Alerts } from '../utils/calendarNotesData';
import { getStoredDebts, getDueDateStatus } from '../utils/debtUtils';
import { SHOPPING_LIST_STORAGE_KEY, DEFAULT_SHOPPING_ITEMS, computeShoppingMetrics } from '../utils/shoppingListData';
import { AppRole } from '../types';

export type TabType = 'dashboard' | 'employee_tasks' | 'calendar_notes' | 'barista_schedule' | 'omset_cogs' | 'cogs' | 'shopping_report' | 'categories' | 'fixed_cost' | 'debt_tracker' | 'ai_chat' | 'usage_history';

interface SidebarProps {
  user: User;
  spreadsheetName: string | null;
  spreadsheetUrl: string | null;
  onRefresh: () => Promise<void>;
  onDisconnectSheet: () => void;
  isSyncing: boolean;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isManagerMode?: boolean;
  userRole?: AppRole;
  onLogoutManager?: () => void;
  onLoginGoogle?: () => void;
  onOpenBackupModal?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  user,
  spreadsheetName,
  spreadsheetUrl,
  onRefresh,
  onDisconnectSheet,
  isSyncing,
  activeTab,
  setActiveTab,
  isManagerMode = false,
  userRole = 'owner',
  onLogoutManager,
  onLoginGoogle,
  onOpenBackupModal,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse
}: SidebarProps) {
  const [copied, setCopied] = useState(false);

  // Compute H-1 alerts count for sidebar badge
  const [h1AlertCount, setH1AlertCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CALENDAR_NOTES_STORAGE_KEY);
      if (saved) {
        const activities = JSON.parse(saved);
        if (Array.isArray(activities)) {
          const alerts = computeH1Alerts(activities);
          return alerts.length;
        }
      } else {
        const alerts = computeH1Alerts(DEFAULT_CALENDAR_ACTIVITIES);
        return alerts.length;
      }
    } catch {
      return 0;
    }
    return 0;
  });

  // Periodically refresh H-1 alert count in sidebar
  const [debtAlertCount, setDebtAlertCount] = useState<number>(0);
  const [shoppingUrgentCount, setShoppingUrgentCount] = useState<number>(0);
  const [shoppingNeedCount, setShoppingNeedCount] = useState<number>(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const saved = localStorage.getItem(CALENDAR_NOTES_STORAGE_KEY);
        const acts = saved ? JSON.parse(saved) : DEFAULT_CALENDAR_ACTIVITIES;
        if (Array.isArray(acts)) {
          const alerts = computeH1Alerts(acts);
          setH1AlertCount(alerts.length);
        }
      } catch {}

      try {
        const debtsList = getStoredDebts();
        const now = new Date();
        const urgent = debtsList.filter(d => {
          if (d.status !== 'active') return false;
          const status = getDueDateStatus(d, now);
          return status.status === 'overdue' || status.status === 'due_today' || status.status === 'due_soon';
        });
        setDebtAlertCount(urgent.length);
      } catch {}

      try {
        const savedShop = localStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
        const shopItems = savedShop ? JSON.parse(savedShop) : DEFAULT_SHOPPING_ITEMS;
        if (Array.isArray(shopItems)) {
          const m = computeShoppingMetrics(shopItems);
          setShoppingUrgentCount(m.urgentCount);
          setShoppingNeedCount(m.needToBuyCount);
        }
      } catch {}
    };

    updateCount();
    const interval = setInterval(updateCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyLink = () => {
    if (spreadsheetUrl) {
      navigator.clipboard.writeText(spreadsheetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Apakah Anda yakin ingin keluar dari aplikasi?");
    if (confirmLogout) {
      if (onLogoutManager) {
        onLogoutManager();
      } else {
        await logout();
      }
    }
  };

  const handleItemClick = (id: TabType) => {
    setActiveTab(id);
    onCloseMobile();
  };

  const navGroups = useMemo(() => {
    if (userRole === 'barista') {
      return [
        {
          groupTitle: 'Pencatatan Harian Barista',
          items: [
            { 
              id: 'omset_cogs' as TabType, 
              label: 'Pencatatan Harian', 
              icon: Coffee, 
              badge: 'Form', 
              highlight: true,
              description: 'Form input penjualan & jatah menu'
            },
          ]
        }
      ];
    }

    if (userRole === 'manager') {
      return [
        {
          groupTitle: 'Dasbor & Operasional Bar',
          items: [
            { 
              id: 'employee_tasks' as TabType, 
              label: 'Tugas Karyawan', 
              icon: UserCheck, 
              badge: 'Baru',
              badgeColor: 'amber' as const,
              description: 'Jobdesk, upah & tugas staf'
            },
            { 
              id: 'barista_schedule' as TabType, 
              label: 'Jadwal Operasional', 
              icon: Users, 
              badge: 'Basco',
              description: 'Roster & shift Basco Coffee'
            },
            { 
              id: 'omset_cogs' as TabType, 
              label: 'Analisis COGS & Sales', 
              icon: Coffee, 
              badge: 'Aplikasi 2', 
              highlight: true,
              description: 'Penjualan menu & laba kotor'
            },
          ]
        },
        {
          groupTitle: 'Manajemen Finansial & Stok',
          items: [
            { 
              id: 'shopping_report' as TabType, 
              label: 'Bahan Perlu Dibelanjakan', 
              icon: ShoppingCart,
              badge: shoppingUrgentCount > 0 ? `${shoppingUrgentCount} Urgent` : (shoppingNeedCount > 0 ? `${shoppingNeedCount} Butuh` : undefined),
              badgeColor: shoppingUrgentCount > 0 ? ('rose' as const) : ('amber' as const),
              description: 'Laporan belanja & notifikasi Sheet 4'
            },
            { 
              id: 'cogs' as TabType, 
              label: 'Stok Opname Bulanan', 
              icon: ClipboardList,
              description: 'Audit bahan baku & inventory'
            },
          ]
        }
      ];
    }

    return [
      {
        groupTitle: 'Dasbor & Operasional Bar',
        items: [
          { 
            id: 'dashboard' as TabType, 
            label: 'Dasbor Utama', 
            icon: LayoutDashboard,
            description: 'Arus kas & transaksi harian'
          },
          { 
            id: 'employee_tasks' as TabType, 
            label: 'Tugas Karyawan', 
            icon: UserCheck, 
            badge: 'Baru',
            badgeColor: 'amber' as const,
            description: 'Jobdesk, upah & tugas staf'
          },
          { 
            id: 'calendar_notes' as TabType, 
            label: 'Catatan Kalender', 
            icon: Calendar,
            badge: h1AlertCount > 0 ? `${h1AlertCount} H-1` : undefined,
            badgeColor: h1AlertCount > 0 ? ('rose' as const) : undefined,
            description: 'Agenda, catatan & notifikasi H-1'
          },
          { 
            id: 'barista_schedule' as TabType, 
            label: 'Jadwal Operasional', 
            icon: Users, 
            badge: 'Basco',
            description: 'Roster & shift Basco Coffee'
          },
          { 
            id: 'omset_cogs' as TabType, 
            label: 'Analisis COGS & Sales', 
            icon: Coffee, 
            badge: 'Aplikasi 2', 
            highlight: true,
            description: 'Penjualan menu & laba kotor'
          },
        ]
      },
      {
        groupTitle: 'Manajemen Finansial & Stok',
        items: [
          { 
            id: 'shopping_report' as TabType, 
            label: 'Bahan Perlu Dibelanjakan', 
            icon: ShoppingCart,
            badge: shoppingUrgentCount > 0 ? `${shoppingUrgentCount} Urgent` : (shoppingNeedCount > 0 ? `${shoppingNeedCount} Butuh` : undefined),
            badgeColor: shoppingUrgentCount > 0 ? ('rose' as const) : ('amber' as const),
            description: 'Laporan belanja & notifikasi Sheet 4'
          },
          { 
            id: 'cogs' as TabType, 
            label: 'Stok Opname Bulanan', 
            icon: ClipboardList,
            description: 'Audit bahan baku & inventory'
          },
          { 
            id: 'categories' as TabType, 
            label: 'Kategori Pengeluaran', 
            icon: Layers,
            description: 'Alokasi pos belanja cafe'
          },
          { 
            id: 'debt_tracker' as TabType, 
            label: 'Pencatatan Hutang & AI', 
            icon: CreditCard,
            badge: debtAlertCount > 0 ? `${debtAlertCount} Tempo` : 'Owner',
            badgeColor: debtAlertCount > 0 ? ('rose' as const) : ('amber' as const),
            description: 'Hutang bulanan, tahunan & AI'
          },
          { 
            id: 'fixed_cost' as TabType, 
            label: 'Simulasi Fixed Cost', 
            icon: Calculator,
            description: 'BEP & biaya sewa/operasional'
          },
        ]
      },
      {
        groupTitle: 'Kecerdasan Buatan (AI)',
        items: [
          { 
            id: 'ai_chat' as TabType, 
            label: 'Tanya AI Analyst', 
            icon: Bot, 
            badge: 'AI',
            description: 'Konsultasi finansial cafe cerdas'
          }
        ]
      },
      {
        groupTitle: 'Audit & Riwayat (Owner)',
        items: [
          {
            id: 'usage_history' as TabType,
            label: 'Riwayat Penggunaan',
            icon: History,
            badge: 'Owner',
            badgeColor: 'amber' as const,
            description: 'Log aktivitas 3 role (Owner, Manajer, Barista)'
          }
        ]
      }
    ];
  }, [userRole, isManagerMode, h1AlertCount, shoppingUrgentCount, shoppingNeedCount, debtAlertCount]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-left-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 bg-slate-950 text-slate-100 flex flex-col border-r border-slate-800/80 transition-all duration-300 ease-in-out ${
          isOpenMobile 
            ? 'translate-x-0 shadow-2xl w-72' 
            : `-translate-x-full lg:translate-x-0 ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}`
        }`}
      >
        {/* Top Branding & Logo Header */}
        <div className={`border-b border-slate-850 flex items-center bg-slate-900/90 transition-all duration-300 ${
          isCollapsed ? 'p-3 justify-center' : 'p-4 sm:p-5 justify-between'
        }`}>
          {isCollapsed ? (
            /* Minimized Brand Header */
            <div className="flex flex-col items-center space-y-2 py-1">
              <button
                type="button"
                onClick={() => handleItemClick('dashboard')}
                className="bg-linear-to-br from-amber-400 to-amber-600 text-slate-950 p-2.5 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform cursor-pointer"
                title="Basco Cashflow - Dasbor Utama"
              >
                <TrendingUp className="h-5 w-5 stroke-[2.5]" />
              </button>

              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="hidden lg:flex p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title="Perluas Sidebar (Expand)"
                  aria-label="Perluas Sidebar"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            /* Expanded Brand Header */
            <>
              <div 
                className="flex items-center space-x-3 cursor-pointer group min-w-0"
                onClick={() => handleItemClick('dashboard')}
              >
                <div className="bg-linear-to-br from-amber-400 to-amber-600 text-slate-950 p-2.5 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
                  <TrendingUp className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-black tracking-tight uppercase text-white leading-none flex items-center space-x-1 truncate">
                    <span>BASCO</span>
                    <span className="text-amber-400">CASHFLOW</span>
                  </h1>
                  <p className="text-[9px] font-extrabold text-amber-300/80 uppercase tracking-widest leading-none mt-1.5 flex items-center space-x-1 truncate">
                    <Flame className="h-2.5 w-2.5 inline text-amber-400 shrink-0" />
                    <span>Cafe Operating System</span>
                  </p>
                </div>
              </div>

              {/* Action buttons on desktop (minimize) and mobile (close) */}
              <div className="flex items-center space-x-1">
                {onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="hidden lg:flex p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    title="Kecilkan / Minimize Sidebar"
                    aria-label="Minimize Sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  aria-label="Tutup Menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Scrollable Navigation Menu List */}
        <div className={`flex-1 overflow-y-auto space-y-5 scrollbar-thin scrollbar-thumb-slate-800 ${
          isCollapsed ? 'px-2 py-3' : 'px-3.5 py-4'
        }`}>
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              {!isCollapsed ? (
                <div className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {group.groupTitle}
                </div>
              ) : (
                <div className="h-px bg-slate-850 mx-2 my-2" title={group.groupTitle} />
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  if (isCollapsed) {
                    /* Collapsed Icon-Only Button with Tooltip */
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={`w-full relative flex flex-col items-center justify-center p-2.5 rounded-xl transition-all group cursor-pointer ${
                          isActive
                            ? item.highlight
                              ? 'bg-linear-to-br from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'bg-slate-850 text-amber-400 border border-amber-400/40 shadow-inner'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900/90'
                        }`}
                        title={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
                      >
                        <Icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                          isActive && !item.highlight ? 'text-amber-400' : ''
                        }`} />

                        {/* Mini Badge dot indicator */}
                        {item.badge && (
                          <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-slate-950 ${
                            item.badgeColor === 'rose'
                              ? 'bg-rose-500 animate-pulse'
                              : item.highlight
                              ? 'bg-amber-400 animate-pulse'
                              : 'bg-indigo-400'
                          }`} />
                        )}
                      </button>
                    );
                  }

                  /* Expanded Full Button */
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group cursor-pointer ${
                        isActive
                          ? item.highlight
                            ? 'bg-linear-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20'
                            : 'bg-slate-850 text-amber-400 font-extrabold border border-amber-400/30 shadow-inner'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                          isActive
                            ? item.highlight
                              ? 'bg-slate-950/20 text-slate-950'
                              : 'bg-amber-400/10 text-amber-400'
                            : 'bg-slate-900 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <div className="leading-tight truncate flex items-center space-x-1.5">
                            <span className={isActive ? 'font-black' : 'font-semibold'}>{item.label}</span>
                          </div>
                          {item.description && (
                            <p className={`text-[10px] truncate mt-0.5 ${
                              isActive 
                                ? item.highlight ? 'text-slate-900/80 font-medium' : 'text-slate-400' 
                                : 'text-slate-400'
                            }`}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.badge ? (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shrink-0 ml-2 ${
                          item.badgeColor === 'rose'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : isActive
                            ? item.highlight
                              ? 'bg-slate-950 text-amber-300'
                              : 'bg-amber-400 text-slate-950'
                            : item.highlight
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {item.badge}
                        </span>
                      ) : isActive ? (
                        <ChevronRight className={`h-4 w-4 shrink-0 ${item.highlight ? 'text-slate-950' : 'text-amber-400'}`} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Utility Shortcut: Backup JSON */}
          {userRole === 'owner' && onOpenBackupModal && (
            <div className="pt-2">
              {isCollapsed ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenBackupModal();
                    onCloseMobile();
                  }}
                  className="w-full flex items-center justify-center p-2.5 bg-slate-900 hover:bg-slate-850 text-amber-400 border border-slate-800 rounded-xl transition group cursor-pointer"
                  title="Backup & Restore JSON Data"
                >
                  <FileJson className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onOpenBackupModal();
                    onCloseMobile();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-amber-300 border border-slate-800 rounded-xl text-xs font-bold transition group cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg group-hover:bg-amber-500/20 transition">
                      <FileJson className="h-4 w-4" />
                    </div>
                    <span>Backup & Restore JSON</span>
                  </div>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">
                    v2.5
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Google Sheets Connection Card (Only visible for Owner) */}
          {userRole === 'owner' && spreadsheetName && (
            isCollapsed ? (
              <div className="pt-1 flex flex-col items-center">
                <a
                  href={spreadsheetUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-slate-900 hover:bg-slate-850 text-emerald-400 border border-slate-800 rounded-xl flex items-center justify-center relative transition group"
                  title={`Google Sheet Aktif: ${spreadsheetName}`}
                >
                  <FileSpreadsheet className="h-5 w-5" />
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </a>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/90 border border-slate-800/90 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-400">
                      Google Sheets Aktif
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isSyncing}
                    className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    title="Sinkronisasi Ulang Data"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
                  </button>
                </div>

                <a
                  href={spreadsheetUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs font-bold text-slate-200 hover:text-emerald-300 truncate transition flex items-center justify-between group"
                >
                  <span className="truncate">{spreadsheetName}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 ml-1 text-slate-500 group-hover:text-emerald-400" />
                </a>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onDisconnectSheet}
                    className="text-red-400/90 hover:text-red-300 font-bold transition cursor-pointer"
                  >
                    Ganti Sheet
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Bottom User Profile & Session Footer */}
        <div className={`border-t border-slate-850 bg-slate-900/95 transition-all ${
          isCollapsed ? 'p-2.5 flex flex-col items-center space-y-2' : 'p-3.5 flex items-center justify-between'
        }`}>
          {isCollapsed ? (
            /* Minimized User View */
            <div className="flex flex-col items-center space-y-2">
              <div 
                className={`h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs shadow-md ${
                  userRole === 'owner'
                    ? 'bg-purple-600 text-white'
                    : userRole === 'barista'
                    ? 'bg-sky-500 text-white'
                    : 'bg-amber-500 text-slate-950'
                }`}
                title={userRole === 'owner' ? 'Akses Owner' : userRole === 'barista' ? 'Akses Barista' : 'Akses Manager'}
              >
                {userRole === 'owner' ? '👑' : userRole === 'barista' ? '☕' : '👔'}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                title="Keluar / Logout"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Expanded User View */
            <>
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm shadow-md shrink-0 ${
                  userRole === 'owner'
                    ? 'bg-purple-600 text-white'
                    : userRole === 'barista'
                    ? 'bg-sky-500 text-white'
                    : 'bg-amber-500 text-slate-950'
                }`}>
                  {userRole === 'owner' ? '👑' : userRole === 'barista' ? '☕' : '👔'}
                </div>

                <div className="min-w-0 text-left">
                  <div className="flex items-center space-x-1">
                    <p className="text-xs font-bold text-slate-100 truncate leading-tight">
                      {user.displayName || (userRole === 'owner' ? 'Owner Basco' : userRole === 'barista' ? 'Barista Basco' : 'Manager Cafe')}
                    </p>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider shrink-0 ${
                      userRole === 'owner'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : userRole === 'barista'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {userRole === 'owner' ? 'Owner' : userRole === 'barista' ? 'Barista' : 'Manajer'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                    {user.email || (userRole === 'owner' ? 'Akses Owner (Pemilik)' : userRole === 'barista' ? 'Akses Barista' : 'Akses Manajer')}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                {userRole !== 'barista' && isManagerMode && onLoginGoogle && (
                  <button
                    type="button"
                    onClick={onLoginGoogle}
                    className="p-1.5 text-[10px] font-bold text-slate-300 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition"
                    title="Hubungkan dengan Akun Google"
                  >
                    Google
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                  title="Keluar / Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
