import { useState } from 'react';
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
  FileJson
} from 'lucide-react';
import { logout } from '../firebase';

export type TabType = 'dashboard' | 'barista_schedule' | 'omset_cogs' | 'cogs' | 'categories' | 'fixed_cost' | 'ai_chat';

interface NavbarProps {
  user: User;
  spreadsheetName: string | null;
  spreadsheetUrl: string | null;
  onRefresh: () => Promise<void>;
  onDisconnectSheet: () => void;
  isSyncing: boolean;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isManagerMode?: boolean;
  onLogoutManager?: () => void;
  onLoginGoogle?: () => void;
  onOpenBackupModal?: () => void;
}

export default function Navbar({ 
  user, 
  spreadsheetName, 
  spreadsheetUrl, 
  onRefresh, 
  onDisconnectSheet,
  isSyncing,
  activeTab,
  setActiveTab,
  isManagerMode = false,
  onLogoutManager,
  onLoginGoogle,
  onOpenBackupModal
}: NavbarProps) {
  const [copied, setCopied] = useState(false);

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

  const navItems: { id: TabType; label: string; icon: any; badge?: string; highlight?: boolean }[] = isManagerMode ? [
    { id: 'dashboard', label: 'Dashboard Pencatatan Harian', icon: TrendingUp },
    { id: 'omset_cogs', label: 'Penjualan Menu', icon: Coffee, highlight: true },
    { id: 'barista_schedule', label: 'Jadwal Operasional', icon: Users, badge: 'Shift' },
    { id: 'cogs', label: 'Stok Opname Bulanan', icon: ClipboardList },
  ] : [
    { id: 'dashboard', label: 'Dasbor Utama', icon: TrendingUp },
    { id: 'barista_schedule', label: 'Jadwal Barista', icon: Users, badge: 'Shift Bar' },
    { id: 'omset_cogs', label: 'Analisis COGS & Sales', icon: Coffee, badge: 'Aplikasi 2', highlight: true },
    { id: 'cogs', label: 'Stok Opname Bulanan', icon: ClipboardList },
    { id: 'categories', label: 'Kategori Pengeluaran', icon: Layers },
    { id: 'fixed_cost', label: 'Simulasi Fixed Cost', icon: Calculator },
    { id: 'ai_chat', label: 'Tanya AI Analyst', icon: Bot, badge: 'AI' },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs" id="main-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header Row */}
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo & App Branding */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-amber-950 text-amber-400 p-2 rounded-xl flex items-center justify-center border border-amber-800 shadow-xs">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight uppercase text-slate-900 leading-none">
                Basco<span className="text-amber-600">Cashflow</span>
              </h1>
              <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest leading-none mt-1 sm:block hidden">
                Integrated Cafe Management Platform
              </p>
            </div>
          </div>

          {/* Sync Status / Google Sheets Connection */}
          {spreadsheetName && (
            <div className="hidden lg:flex items-center space-x-3 bg-emerald-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sheet:</span>
              <a 
                href={spreadsheetUrl || "#"} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-bold text-slate-800 underline hover:text-emerald-600 flex items-center space-x-1 transition-colors"
              >
                <span>{spreadsheetName}</span>
                <ExternalLink className="h-3 w-3 inline" />
              </a>
              
              <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
                <button 
                  onClick={handleCopyLink} 
                  title="Salin Link Spreadsheet" 
                  className="hover:text-emerald-650 transition p-0.5 rounded hover:bg-slate-100"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                </button>
                <button 
                  onClick={onDisconnectSheet} 
                  className="text-red-500 hover:text-red-650 text-[11px] font-bold ml-1 transition"
                  title="Ganti Spreadsheet"
                >
                  Ganti
                </button>
              </div>
            </div>
          )}

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Global Backup JSON button */}
            {onOpenBackupModal && (
              <button
                type="button"
                onClick={onOpenBackupModal}
                className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Backup / Restore Semua Data Aplikasi (JSON)"
              >
                <FileJson className="h-4 w-4 text-amber-600" />
                <span>Backup JSON</span>
              </button>
            )}

            {/* Sync Button */}
            {spreadsheetName && (
              <button
                onClick={onRefresh}
                disabled={isSyncing}
                className={`p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white transition-all flex items-center justify-center ${
                  isSyncing ? 'cursor-wait bg-slate-100' : ''
                }`}
                title="Sinkronisasi Data"
                id="sync-button"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-slate-950' : ''}`} />
              </button>
            )}

            {/* Profile Avatar & Details */}
            <div className="flex items-center space-x-2.5 pl-2 border-l border-slate-200">
              {isManagerMode ? (
                <div className="h-8 w-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-2xs">
                  🔑
                </div>
              ) : user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User Avatar"} 
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
                  {user.displayName ? user.displayName.charAt(0) : user.email?.charAt(0) || 'U'}
                </div>
              )}
              
              <div className="hidden sm:block text-left">
                <div className="flex items-center space-x-1.5">
                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {user.displayName || "Pengguna Google"}
                  </p>
                  {isManagerMode && (
                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 font-extrabold text-[9px] rounded uppercase">
                      Tanpa Email
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-mono leading-none mt-0.5">
                  {user.email}
                </p>
              </div>

              {isManagerMode && onLoginGoogle && (
                <button
                  onClick={onLoginGoogle}
                  className="hidden md:flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-300 transition"
                  title="Hubungkan dengan Akun Google"
                >
                  <span>Link Google</span>
                </button>
              )}

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition ml-1"
                title="Keluar / Logout"
                id="logout-button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>

        {/* MAIN NAVIGATION BAR / TAB NAVIGASI UTAMA */}
        <div className="border-t border-slate-100 py-1 overflow-x-auto scrollbar-none">
          <div className="flex space-x-1 sm:space-x-2 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`py-2.5 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer shrink-0 ${
                    isActive
                      ? item.highlight
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? (item.highlight ? 'text-slate-950' : 'text-amber-400') : 'text-slate-400'}`} />
                  <span>{item.label}</span>

                  {item.badge && (
                    <span className={`text-[8.5px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest ${
                      isActive 
                        ? 'bg-slate-950 text-amber-400' 
                        : item.highlight
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Mobile Sub-Navbar for Spreadsheet Status */}
        {spreadsheetName && (
          <div className="lg:hidden flex items-center justify-between py-1.5 border-t border-slate-100 text-[10px] text-slate-600 px-1">
            <div className="flex items-center space-x-1.5 font-medium text-slate-800">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Sheet:</span>
              <a 
                href={spreadsheetUrl || "#"} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-bold underline truncate max-w-[150px] inline-flex items-center"
              >
                {spreadsheetName}
                <ExternalLink className="h-2.5 w-2.5 ml-1 inline shrink-0" />
              </a>
            </div>
            
            <div className="flex items-center space-x-2.5">
              <button 
                onClick={handleCopyLink} 
                className="text-slate-800 font-bold"
              >
                {copied ? "Tersalin!" : "Salin Link"}
              </button>
              <span className="text-slate-300">|</span>
              <button 
                onClick={onDisconnectSheet} 
                className="text-red-500 font-bold"
              >
                Ganti
              </button>
            </div>
          </div>
        )}

      </div>
    </nav>
  );
}

