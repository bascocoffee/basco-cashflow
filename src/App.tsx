import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  TrendingUp, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  FileSpreadsheet, 
  RefreshCw, 
  Sparkles,
  ArrowRight,
  LogOut,
  Info,
  Layers,
  ShoppingCart,
  Calculator,
  Bot,
  Coffee,
  Users,
  ClipboardList,
  Menu,
  FileJson,
  ExternalLink,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { initAuth, googleSignIn, getAccessToken, logout } from './firebase';
import { 
  findExistingSpreadsheet, 
  createSpreadsheet, 
  getSpreadsheetDetails,
  fetchTransactions, 
  addTransaction, 
  updateTransaction, 
  deleteTransaction, 
  fetchCategories, 
  saveCategoriesToSheet, 
  fetchIngredientsFromSheet, 
  fetchAllStockOpnameReportsFromSheet, 
  fetchCalendarNotesFromSheet, 
  fetchShoppingListFromSheet4 
} from './sheetsService';
import { CALENDAR_NOTES_STORAGE_KEY } from './utils/calendarNotesData';
import { SHOPPING_LIST_STORAGE_KEY, DEFAULT_SHOPPING_ITEMS, computeShoppingMetrics } from './utils/shoppingListData';
import { Transaction, CATEGORIES } from './types';

// Components
import Sidebar, { TabType } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import CategoryManager from './components/CategoryManager';
import CategoryExpenses from './components/CategoryExpenses';
import AiChat from './components/AiChat';
import CogsDetail from './components/CogsDetail';
import FixedCostSimulator from './components/FixedCostSimulator';
import CogsDailySalesPage from './components/CogsDailySalesPage';
import StockOpnamePage from './components/StockOpnamePage';
import BaristaSchedulePage from './components/BaristaSchedulePage';
import CalendarNotesPage from './components/CalendarNotesPage';
import DebtTrackerPage from './components/DebtTrackerPage';
import ShoppingReportPage from './components/ShoppingReportPage';
import BackupRestoreModal from './components/BackupRestoreModal';
import EmployeeTaskPage from './components/EmployeeTaskPage';
import { KeyRound, UserCheck, Lock } from 'lucide-react';

const MANAGER_USER: User = {
  uid: 'manager-local-uid',
  displayName: 'Manager Cafe',
  email: 'Tanpa Email (Akses Manager)',
  photoURL: null,
  emailVerified: true,
  isAnonymous: true,
  metadata: {} as any,
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => Promise.resolve(),
  getIdToken: async () => Promise.resolve(''),
  getIdTokenResult: async () => Promise.resolve({} as any),
  reload: async () => Promise.resolve(),
  toJSON: () => ({}),
  phoneNumber: null,
  providerId: 'manager'
};

const DEFAULT_MANAGER_TRANSACTIONS: Transaction[] = [
  { id: '1', tanggal: '2026-06-01', debit: 24500000, kredit: 0, kredit2: 0, jenisPengeluaran: '-', jenisPengeluaran2: '-', keterangan: 'Pemasukan Penjualan Kasir POS (Minggu 1 Juni)', operasionalDanManajemen: '-' },
  { id: '2', tanggal: '2026-06-03', debit: 0, kredit: 4800000, kredit2: 0, jenisPengeluaran: 'Bahan Baku & HPP (COGS)', jenisPengeluaran2: '-', keterangan: 'Susu Fresh Milk, Biji Kopi Blend, Sirup Karamel', operasionalDanManajemen: 'Operasional' },
  { id: '3', tanggal: '2026-06-05', debit: 0, kredit: 1200000, kredit2: 0, jenisPengeluaran: 'Operasional & Sewa Tempat', jenisPengeluaran2: '-', keterangan: 'Listrik & Wifi Cafe Kece', operasionalDanManajemen: 'Operasional' },
  { id: '4', tanggal: '2026-06-10', debit: 28900000, kredit: 0, kredit2: 0, jenisPengeluaran: '-', jenisPengeluaran2: '-', keterangan: 'Pemasukan Penjualan Kasir POS (Minggu 2-3 Juni)', operasionalDanManajemen: '-' },
  { id: '5', tanggal: '2026-06-12', debit: 0, kredit: 450000, kredit2: 0, jenisPengeluaran: 'Promosi & Marketing', jenisPengeluaran2: '-', keterangan: 'Sponsorship Event Musik Akustik & Selebaran', operasionalDanManajemen: 'Operasional' },
  { id: '6', tanggal: '2026-06-18', debit: 0, kredit: 850000, kredit2: 0, jenisPengeluaran: 'Peralatan & Inventaris', jenisPengeluaran2: '-', keterangan: 'Beli Gelas Latte, Sedotan Bambu, & Cup Sealer', operasionalDanManajemen: 'Operasional' },
  { id: '7', tanggal: '2026-06-25', debit: 0, kredit: 7500000, kredit2: 0, jenisPengeluaran: 'Gaji Karyawan & Barista', jenisPengeluaran2: '-', keterangan: 'Gaji 2 Barista & 1 Staff Dapur', operasionalDanManajemen: 'Manajemen' },
  { id: '8', tanggal: '2026-07-01', debit: 18500000, kredit: 0, kredit2: 0, jenisPengeluaran: '-', jenisPengeluaran2: '-', keterangan: 'Penjualan Omset Kasir Juli Minggu 1', operasionalDanManajemen: '-' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manager Mode State (Akses Tanpa Email)
  const [isManagerMode, setIsManagerMode] = useState<boolean>(() => {
    return localStorage.getItem('aruskas_is_manager_mode') === 'true';
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [managerPinInput, setManagerPinInput] = useState('');
  const [managerPinError, setManagerPinError] = useState<string | null>(null);

  // Spreadsheet State
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetName, setSpreadsheetName] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [isSearchingSheet, setIsSearchingSheet] = useState(false);
  const [isInitializingSheet, setIsInitializingSheet] = useState(false);
  const [foundSheetInfo, setFoundSheetInfo] = useState<{ id: string; name: string } | null>(null);
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [isLinkingCustomSheet, setIsLinkingCustomSheet] = useState(false);

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Categories State
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('aruskas_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [...CATEGORIES];
  });
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isGlobalBackupModalOpen, setIsGlobalBackupModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Shopping items notification state from Sheet 4
  const [shoppingUrgentCount, setShoppingUrgentCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
      const items = saved ? JSON.parse(saved) : DEFAULT_SHOPPING_ITEMS;
      if (Array.isArray(items)) {
        return computeShoppingMetrics(items).urgentCount;
      }
    } catch {}
    return 0;
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('basco_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('basco_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  // Sync categories to localStorage
  useEffect(() => {
    localStorage.setItem('aruskas_categories', JSON.stringify(categories));
  }, [categories]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      async (firebaseUser, cachedToken) => {
        setUser(firebaseUser);
        setToken(cachedToken);
        setAuthChecking(false);
        // Look for stored spreadsheet details
        const storedId = localStorage.getItem('aruskas_sheet_id');
        const storedName = localStorage.getItem('aruskas_sheet_name');
        const storedUrl = localStorage.getItem('aruskas_sheet_url');
        if (storedId) {
          setSpreadsheetId(storedId);
          setSpreadsheetName(storedName || 'Dasbor Arus Kas Keuangan');
          setSpreadsheetUrl(storedUrl || `https://docs.google.com/spreadsheets/d/${storedId}/edit`);
        }
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthChecking(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Manager Mode effect (Bypass Email Login)
  useEffect(() => {
    if (isManagerMode) {
      setUser(MANAGER_USER);
      setToken('manager-local-token');
      const storedId = localStorage.getItem('aruskas_sheet_id');
      const storedName = localStorage.getItem('aruskas_sheet_name');
      const storedUrl = localStorage.getItem('aruskas_sheet_url');
      
      setSpreadsheetId(storedId || 'local_manager_db');
      setSpreadsheetName(storedName || 'Database Lokal Manager');
      setSpreadsheetUrl(storedUrl || null);

      // Load transactions from localStorage or default
      const savedTx = localStorage.getItem('aruskas_manager_transactions');
      if (savedTx) {
        try {
          setTransactions(JSON.parse(savedTx));
        } catch (e) {
          setTransactions(DEFAULT_MANAGER_TRANSACTIONS);
        }
      } else {
        setTransactions(DEFAULT_MANAGER_TRANSACTIONS);
        localStorage.setItem('aruskas_manager_transactions', JSON.stringify(DEFAULT_MANAGER_TRANSACTIONS));
      }
      setAuthChecking(false);
    }
  }, [isManagerMode]);

  // Enter Manager mode without email login (Password PIN: basco12)
  const handleEnterManagerMode = (pinCode?: string) => {
    const inputClean = (pinCode || '').trim();
    const storedPin = localStorage.getItem('aruskas_manager_pin') || 'basco12';
    
    if (inputClean.toLowerCase() !== 'basco12' && inputClean !== storedPin) {
      setManagerPinError('PIN / Password Salah! Password Manager adalah basco12');
      return;
    }
    
    setIsManagerMode(true);
    localStorage.setItem('aruskas_is_manager_mode', 'true');
    localStorage.setItem('aruskas_manager_pin', 'basco12');
    setActiveTab('dashboard');
    setShowPinModal(false);
    setManagerPinError(null);
    setManagerPinInput('');
  };

  // Logout from Manager mode
  const handleLogoutManager = () => {
    setIsManagerMode(false);
    localStorage.removeItem('aruskas_is_manager_mode');
    setUser(null);
    setToken(null);
    setSpreadsheetId(null);
    setSpreadsheetName(null);
  };

  // Drive and Sheets logic when authenticated via Google
  useEffect(() => {
    if (user && token && !isManagerMode && !spreadsheetId) {
      // Look for spreadsheet automatically on drive first
      checkForSpreadsheet(token);
    } else if (user && token && !isManagerMode && spreadsheetId) {
      // Fetch transaction log data from sheet
      loadTransactionsFromSheet(spreadsheetId, token);
    }
  }, [user, token, isManagerMode, spreadsheetId]);

  // Check if spreadsheet already exists on user's drive
  const checkForSpreadsheet = async (accessToken: string) => {
    setIsSearchingSheet(true);
    setError(null);
    try {
      const found = await findExistingSpreadsheet(accessToken);
      if (found) {
        setFoundSheetInfo(found);
      }
    } catch (err: any) {
      console.error(err);
      setError('Gagal memeriksa file Google Drive Anda');
    } finally {
      setIsSearchingSheet(false);
    }
  };

  // Fetch transactions from sheets
  const loadTransactionsFromSheet = async (id: string, accessToken: string) => {
    setIsLoadingData(true);
    setError(null);
    try {
      const list = await fetchTransactions(id, accessToken);
      setTransactions(list);

      // Fetch custom categories from sheet
      const sheetCats = await fetchCategories(id, accessToken);
      if (sheetCats && sheetCats.length > 0) {
        setCategories(sheetCats);
      }

      // Fetch ingredients and stock opname from sheet on app entry
      try {
        const remoteIngs = await fetchIngredientsFromSheet(id, accessToken);
        if (remoteIngs && remoteIngs.length > 0) {
          localStorage.setItem('aruskas_cogs_ingredients', JSON.stringify(remoteIngs));
        }

        const allOpname = await fetchAllStockOpnameReportsFromSheet(id, accessToken);
        if (allOpname && allOpname.reports.length > 0) {
          localStorage.setItem('basco_opname_reports_history', JSON.stringify(allOpname.reports));
          Object.entries(allOpname.monthlyEntries).forEach(([m, val]) => {
            localStorage.setItem(`basco_opname_draft_${m}`, JSON.stringify(val.entries));
            const report = allOpname.reports.find(r => r.periodeBulan === m);
            if (report) {
              localStorage.setItem(`basco_opname_report_${m}`, JSON.stringify(report));
            }
          });
        }
      } catch (opnameErr) {
        console.warn("Could not sync stock opname on app start:", opnameErr);
      }

      // Fetch calendar notes & agenda from sheet on app entry
      try {
        const remoteCalendar = await fetchCalendarNotesFromSheet(id, accessToken);
        if (remoteCalendar && remoteCalendar.length > 0) {
          localStorage.setItem(CALENDAR_NOTES_STORAGE_KEY, JSON.stringify(remoteCalendar));
        }
      } catch (calErr) {
        console.warn("Could not sync calendar notes on app start:", calErr);
      }

      // Fetch shopping list from Sheet 4 on app entry
      try {
        const remoteShopping = await fetchShoppingListFromSheet4(id, accessToken);
        if (remoteShopping && remoteShopping.items.length > 0) {
          localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(remoteShopping.items));
          setShoppingUrgentCount(computeShoppingMetrics(remoteShopping.items).urgentCount);
        }
      } catch (shopErr) {
        console.warn("Could not sync shopping list from Sheet 4 on app start:", shopErr);
      }
    } catch (err: any) {
      console.error(err);
      setError('Gagal mengambil data dari spreadsheet. Hubungan spreadsheet Anda mungkin terputus.');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Google Login click handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        
        // Restore local storage if present
        const storedId = localStorage.getItem('aruskas_sheet_id');
        const storedName = localStorage.getItem('aruskas_sheet_name');
        const storedUrl = localStorage.getItem('aruskas_sheet_url');
        if (storedId) {
          setSpreadsheetId(storedId);
          setSpreadsheetName(storedName || 'Dasbor Arus Kas Keuangan');
          setSpreadsheetUrl(storedUrl || `https://docs.google.com/spreadsheets/d/${storedId}/edit`);
        }
      }
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setError(`Domain ${window.location.hostname} belum terdaftar di Authorized Domains Firebase. Anda bisa langsung masuk tanpa kendala menggunakan tombol "AKSES KHUSUS MANAGER (PIN: basco12)" di bawah.`);
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Jendela login ditutup sebelum selesai.');
      } else {
        setError(err.message || 'Gagal masuk menggunakan Google Auth. Harap izinkan akses Google Drive & Sheets.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Create new Spreadsheet
  const handleCreateNewSheet = async () => {
    if (!token) return;
    setIsInitializingSheet(true);
    setError(null);
    try {
      const sheet = await createSpreadsheet(token);
      
      // Store in local states
      setSpreadsheetId(sheet.id);
      setSpreadsheetName('Dasbor Arus Kas Keuangan');
      setSpreadsheetUrl(sheet.url);

      // Store in LocalStorage
      localStorage.setItem('aruskas_sheet_id', sheet.id);
      localStorage.setItem('aruskas_sheet_name', 'Dasbor Arus Kas Keuangan');
      localStorage.setItem('aruskas_sheet_url', sheet.url);

      setFoundSheetInfo(null);
    } catch (err: any) {
      console.error(err);
      setError('Gagal menginisialisasi spreadsheet baru di Google Drive');
    } finally {
      setIsInitializingSheet(false);
    }
  };

  // Select existing sheet
  const handleSelectExistingSheet = (id: string, name: string) => {
    setSpreadsheetId(id);
    setSpreadsheetName(name);
    const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
    setSpreadsheetUrl(url);

    localStorage.setItem('aruskas_sheet_id', id);
    localStorage.setItem('aruskas_sheet_name', name);
    localStorage.setItem('aruskas_sheet_url', url);

    setFoundSheetInfo(null);
  };

  // Link existing sheet by ID or URL
  const handleLinkCustomSheet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customSheetInput.trim() || !token) return;
    setIsLinkingCustomSheet(true);
    setError(null);
    try {
      const details = await getSpreadsheetDetails(customSheetInput, token);
      handleSelectExistingSheet(details.id, details.name);
      setCustomSheetInput('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal menautkan spreadsheet');
    } finally {
      setIsLinkingCustomSheet(false);
    }
  };

  // Disconnect Sheet
  const handleDisconnectSheet = () => {
    const confirmation = window.confirm("Apakah Anda yakin ingin mengganti spreadsheet yang aktif? Data di Google Sheets Anda tidak akan terhapus, tetapi aplikasi akan kembali ke menu setup.");
    if (confirmation) {
      setSpreadsheetId(null);
      setSpreadsheetName(null);
      setSpreadsheetUrl(null);
      setTransactions([]);
      setFoundSheetInfo(null);
      localStorage.removeItem('aruskas_sheet_id');
      localStorage.removeItem('aruskas_sheet_name');
      localStorage.removeItem('aruskas_sheet_url');
      if (token) {
        checkForSpreadsheet(token);
      }
    }
  };

  // Refresh manually
  const handleRefresh = async () => {
    if (spreadsheetId && token) {
      await loadTransactionsFromSheet(spreadsheetId, token);
    }
  };

  // Add / Edit submission
  const handleFormSubmit = async (data: Omit<Transaction, 'id'>) => {
    if (isManagerMode || !spreadsheetId || !token) {
      if (isManagerMode) {
        let updated: Transaction[];
        if (editingTransaction) {
          updated = transactions.map(t => t.id === editingTransaction.id ? { ...data, id: editingTransaction.id } : t);
        } else {
          const newTx: Transaction = { ...data, id: String(Date.now()) };
          updated = [newTx, ...transactions];
        }
        setTransactions(updated);
        localStorage.setItem('aruskas_manager_transactions', JSON.stringify(updated));
        return;
      }
      throw new Error("Sesi Google Sheets terputus");
    }

    if (editingTransaction) {
      // Edit mode
      await updateTransaction(spreadsheetId, editingTransaction.id, data, token);
    } else {
      // Add mode
      await addTransaction(spreadsheetId, data, token);
    }

    // Refresh transactions
    await loadTransactionsFromSheet(spreadsheetId, token);
  };

  // Delete transaction action
  const handleDeleteTransaction = async (id: string) => {
    if (isManagerMode || !spreadsheetId || !token) {
      if (isManagerMode) {
        const updated = transactions.filter(t => t.id !== id);
        setTransactions(updated);
        localStorage.setItem('aruskas_manager_transactions', JSON.stringify(updated));
        return;
      }
      return;
    }
    try {
      setIsLoadingData(true);
      await deleteTransaction(spreadsheetId, id, token);
      await loadTransactionsFromSheet(spreadsheetId, token);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal menghapus transaksi: ${err.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Add category action
  const handleAddCategory = async (newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      throw new Error("Kategori sudah ada");
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    
    if (spreadsheetId && token) {
      setIsLoadingData(true);
      try {
        await saveCategoriesToSheet(spreadsheetId, updated, token);
      } catch (err) {
        console.error(err);
        setError("Gagal menyimpan kategori baru ke Google Sheets");
      } finally {
        setIsLoadingData(false);
      }
    }
  };

  // Edit category action
  const handleEditCategory = async (oldCat: string, newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed || oldCat === trimmed) return;
    if (categories.includes(trimmed)) {
      throw new Error("Kategori baru sudah ada");
    }
    
    const updatedCats = categories.map(c => c === oldCat ? trimmed : c);
    setCategories(updatedCats);

    // Update affected local transactions
    const updatedTx = transactions.map(t => {
      let changed = false;
      let jp1 = t.jenisPengeluaran;
      let jp2 = t.jenisPengeluaran2 || "-";
      if (t.jenisPengeluaran === oldCat) {
        jp1 = trimmed;
        changed = true;
      }
      if (t.jenisPengeluaran2 === oldCat) {
        jp2 = trimmed;
        changed = true;
      }
      return changed ? { ...t, jenisPengeluaran: jp1, jenisPengeluaran2: jp2 } : t;
    });
    setTransactions(updatedTx);

    if (spreadsheetId && token) {
      setIsLoadingData(true);
      try {
        await saveCategoriesToSheet(spreadsheetId, updatedCats, token);
        // Sync affected transaction rows to Google Sheets
        const affected = transactions.filter(t => t.jenisPengeluaran === oldCat || t.jenisPengeluaran2 === oldCat);
        for (const t of affected) {
          const jp1 = t.jenisPengeluaran === oldCat ? trimmed : t.jenisPengeluaran;
          const jp2 = (t.jenisPengeluaran2 || "-") === oldCat ? trimmed : (t.jenisPengeluaran2 || "-");
          await updateTransaction(spreadsheetId, t.id, {
            tanggal: t.tanggal,
            debit: t.debit,
            kredit: t.kredit,
            kredit2: t.kredit2 || 0,
            jenisPengeluaran: jp1,
            jenisPengeluaran2: jp2,
            keterangan: t.keterangan,
            operasionalDanManajemen: t.operasionalDanManajemen || "-"
          }, token);
        }
        await loadTransactionsFromSheet(spreadsheetId, token);
      } catch (err) {
        console.error(err);
        setError("Gagal memperbarui kategori di Google Sheets");
      } finally {
        setIsLoadingData(false);
      }
    }
  };

  // Delete category action
  const handleDeleteCategory = async (catToDelete: string) => {
    const updatedCats = categories.filter(c => c !== catToDelete);
    setCategories(updatedCats);

    const fallbackCat = updatedCats[0] || "Lain-lain";

    // Update affected local transactions
    const updatedTx = transactions.map(t => {
      let changed = false;
      let jp1 = t.jenisPengeluaran;
      let jp2 = t.jenisPengeluaran2 || "-";
      if (t.jenisPengeluaran === catToDelete) {
        jp1 = fallbackCat;
        changed = true;
      }
      if (t.jenisPengeluaran2 === catToDelete) {
        jp2 = "-";
        changed = true;
      }
      return changed ? { ...t, jenisPengeluaran: jp1, jenisPengeluaran2: jp2 } : t;
    });
    setTransactions(updatedTx);

    if (spreadsheetId && token) {
      setIsLoadingData(true);
      try {
        await saveCategoriesToSheet(spreadsheetId, updatedCats, token);
        // Update affected transaction rows in Google Sheets
        const affected = transactions.filter(t => t.jenisPengeluaran === catToDelete || t.jenisPengeluaran2 === catToDelete);
        for (const t of affected) {
          const jp1 = t.jenisPengeluaran === catToDelete ? fallbackCat : t.jenisPengeluaran;
          const jp2 = (t.jenisPengeluaran2 || "-") === catToDelete ? "-" : (t.jenisPengeluaran2 || "-");
          await updateTransaction(spreadsheetId, t.id, {
            tanggal: t.tanggal,
            debit: t.debit,
            kredit: t.kredit,
            kredit2: t.kredit2 || 0,
            jenisPengeluaran: jp1,
            jenisPengeluaran2: jp2,
            keterangan: t.keterangan,
            operasionalDanManajemen: t.operasionalDanManajemen || "-"
          }, token);
        }
        await loadTransactionsFromSheet(spreadsheetId, token);
      } catch (err) {
        console.error(err);
        setError("Gagal menghapus kategori di Google Sheets");
      } finally {
        setIsLoadingData(false);
      }
    }
  };

  // Open transaction modal
  const handleAddClick = () => {
    setEditingTransaction(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction(t);
    setIsFormOpen(true);
  };

  // Loading state of checking login
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500"></span>
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500 font-mono tracking-wider uppercase animate-pulse">
            Memeriksa Sesi Google...
          </p>
        </div>
      </div>
    );
  }

  // SIGN IN LANDING SCREEN (If not logged in)
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
          {/* Logo */}
          <div className="inline-flex h-14 w-14 items-center justify-center rounded bg-slate-900 text-white shadow-sm mb-5 border border-slate-950">
            <TrendingUp className="h-7 w-7" />
          </div>
          
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-955">
            ArusKas Dashboard
          </h2>
          <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto font-bold uppercase tracking-wider">
            Sistem Pemantau Keuangan Real-Time Terotomatisasi
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
          <div className="bg-white py-8 px-6 sm:px-10 rounded border border-slate-200 shadow-sm">
            
            {/* Features list */}
            <div className="space-y-4 mb-8 text-xs font-semibold text-slate-650">
              <div className="flex items-start space-x-3.5">
                <div className="bg-emerald-100 text-emerald-800 p-1.5 rounded shrink-0 border border-emerald-200">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-slate-900 font-extrabold uppercase tracking-wide text-[11px]">Sinkronisasi Google Sheets Otomatis</p>
                  <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">Setiap data form masuk langsung terarsip dengan aman di akun spreadsheet personal Anda.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="bg-indigo-100 text-indigo-800 p-1.5 rounded shrink-0 border border-indigo-200">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-slate-900 font-extrabold uppercase tracking-wide text-[11px]">Visualisasi Arus Kas Interaktif</p>
                  <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">Visual grafik tren bulanan otomatis untuk memantau selisih Debit & Kredit.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="bg-amber-100 text-amber-800 p-1.5 rounded shrink-0 border border-amber-200">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-slate-900 font-extrabold uppercase tracking-wide text-[11px]">Filter Kategori & Analisis</p>
                  <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">Kelompokkan pengeluaran Anda dengan filter tanggal terperinci & analisis bento.</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-150 rounded text-xs font-bold text-red-700 mb-5 flex items-start space-x-2">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* CSI Google Login Button */}
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-200 rounded text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-60 shadow-2xs"
            >
              {isLoggingIn ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />
                  <span>Menghubungkan akun...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4 shrink-0">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Masuk dengan Akun Google</span>
                </div>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                <span className="bg-white px-3 text-slate-400">Atau Akses Manager</span>
              </div>
            </div>

            {/* MANAGER ACCESS SECTION */}
            <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-amber-500 text-slate-950 rounded-lg shrink-0">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Akses Khusus Manager</h4>
                  <p className="text-[10.5px] text-amber-900 font-medium">Masuk operasional dengan PIN password: <span className="font-mono font-bold text-amber-950">basco12</span></p>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setManagerPinError(null);
                    setManagerPinInput('');
                    setShowPinModal(true);
                  }}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
                >
                  <Lock className="h-4 w-4" />
                  <span>Masuk Akses Manager (PIN: basco12)</span>
                </button>
              </div>
              <p className="text-[9.5px] text-slate-500 text-center font-bold">
                Menu Terbuka: Dashboard Pencatatan Harian, Penjualan Menu, Jadwal Operasional & Stok Opname Bulanan
              </p>
            </div>

            <div className="mt-5 text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center flex items-center justify-center space-x-1">
              <Info className="h-3 w-3 shrink-0" />
              <span>Berjalan client-side secara privat & aman.</span>
            </div>

          </div>
        </div>

        {/* MODAL PIN MANAGER */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4 animate-scale-up">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-amber-100 text-amber-900 rounded-lg">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Verifikasi PIN Manager</h3>
                    <p className="text-[10px] text-slate-400 font-medium">PIN Password: basco12</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => { setShowPinModal(false); setManagerPinError(null); }}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {managerPinError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 text-center">
                  {managerPinError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEnterManagerMode(managerPinInput);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    Masukkan PIN / Password Manager
                  </label>
                  <input
                    type="password"
                    value={managerPinInput}
                    onChange={(e) => setManagerPinInput(e.target.value)}
                    placeholder="Masukkan basco12"
                    className="w-full px-3 py-2.5 text-center text-lg tracking-widest font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                    autoFocus
                  />
                  <p className="text-[10.5px] text-slate-400 text-center">
                    Gunakan password: <span className="font-mono font-bold text-amber-800">basco12</span>
                  </p>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowPinModal(false); setManagerPinError(null); }}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-2xs"
                  >
                    Masuk Manager
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }

  // SPREADSHEET INITIALIZATION / CHOICE VIEW
  if (!spreadsheetId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        
        <div className="max-w-md mx-auto w-full px-4 text-center">
          
          <div className="inline-flex h-14 w-14 items-center justify-center rounded bg-slate-100 text-slate-800 border border-slate-200 shadow-sm mb-5">
            <FileSpreadsheet className="h-7 w-7" />
          </div>

          <h3 className="text-base font-black uppercase tracking-widest text-slate-900">
            Hubungkan Spreadsheet Anda
          </h3>
          <p className="mt-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest max-w-xs mx-auto">
            Untuk menyimpan riwayat Arus Kas secara otomatis, mari siapkan Google Spreadsheet Anda.
          </p>

          <div className="mt-6 bg-white p-6 rounded border border-slate-200 shadow-sm text-left space-y-4">
            
            {/* Loading Search State */}
            {isSearchingSheet && (
              <div className="py-4 text-center space-y-2">
                <RefreshCw className="h-6 w-6 text-slate-900 animate-spin mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mencari spreadsheet di Google Drive Anda...</p>
              </div>
            )}

            {/* Found existing sheet */}
            {!isSearchingSheet && foundSheetInfo && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3 animate-fade-in">
                <div className="flex items-start space-x-2.5">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900">Ditemukan Spreadsheet yang Cocok!</h4>
                    <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">Spreadsheet sebelumnya terdeteksi di Google Drive Anda:</p>
                    <p className="text-[11px] font-bold text-slate-750 mt-2 font-mono truncate max-w-[285px]">
                      📁 {foundSheetInfo.name}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2.5 pt-1">
                  <button
                    onClick={() => handleSelectExistingSheet(foundSheetInfo.id, foundSheetInfo.name)}
                    className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded transition"
                  >
                    Gunakan Spreadsheet Ini
                  </button>
                  <button
                    onClick={handleCreateNewSheet}
                    disabled={isInitializingSheet}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider rounded border border-slate-200 transition"
                  >
                    Buat Baru
                  </button>
                </div>
              </div>
            )}

            {/* No sheet found & Initial setup option */}
            {!isSearchingSheet && !foundSheetInfo && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded border border-slate-200">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Buat Spreadsheet Baru</h4>
                  <p className="text-[10.5px] text-slate-400 font-medium mt-1">
                    Kami akan membuat file spreadsheet baru bernama <span className="font-bold text-slate-800">"Dasbor Arus Kas Keuangan"</span> lengkap dengan kolom (Tanggal, Debit, Kredit, Jenis Pengeluaran, Keterangan) dan beberapa data contoh untuk visualisasi instan.
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-150 rounded text-xs font-bold text-red-700">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleCreateNewSheet}
                  disabled={isInitializingSheet}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-60"
                >
                  {isInitializingSheet ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Membuat Spreadsheet di Drive...</span>
                    </>
                  ) : (
                    <>
                      <span>Inisialisasi Spreadsheet Baru</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Direct Link Existing Spreadsheet by URL or ID */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-700">
                Atau Tautkan Link / ID Spreadsheet Yang Sudah Ada:
              </label>
              <form onSubmit={handleLinkCustomSheet} className="space-y-2">
                <input
                  type="text"
                  value={customSheetInput}
                  onChange={(e) => setCustomSheetInput(e.target.value)}
                  placeholder="Paste URL Google Sheets atau ID di sini..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono text-slate-800 placeholder:text-slate-400 placeholder:font-sans"
                />
                <button
                  type="submit"
                  disabled={isLinkingCustomSheet || !customSheetInput.trim()}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] uppercase tracking-wider rounded flex items-center justify-center space-x-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {isLinkingCustomSheet ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Memeriksa & Menautkan...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Hubungkan Spreadsheet Ini</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Action manual sign out if they want to cancel */}
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
              <span className="text-slate-400 font-bold lowercase tracking-normal">Akun: {user.email}</span>
              <button
                onClick={() => logout()}
                className="text-red-650 hover:underline font-bold flex items-center space-x-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Keluar</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    );
  }

  // ACTIVE DASHBOARD APPLICATION VIEW
  const tabTitles: Record<TabType, { title: string; subtitle: string }> = {
    dashboard: {
      title: isManagerMode ? 'Dashboard Pencatatan Harian' : 'Dasbor Utama & Arus Kas',
      subtitle: isManagerMode ? 'Pencatatan transaksi harian & arus kas operasional cafe' : 'Ringkasan pemasukan, pengeluaran & saldo harian cafe'
    },
    employee_tasks: {
      title: isManagerMode ? 'Tugas Karyawan' : 'Pencatatan Tugas Karyawan',
      subtitle: isManagerMode ? 'Catatan tugas operasional staf & jobdesk cafe' : 'Manajemen tugas staf, alokasi upah/gaji & sinkronisasi Google Sheets'
    },
    calendar_notes: {
      title: 'Catatan & Agenda Kalender',
      subtitle: 'Kalender kegiatan cafe, checklist operasional, audit, dan pengingat H-1 otomatis'
    },
    barista_schedule: {
      title: isManagerMode ? 'Jadwal Operasional' : 'Jadwal Operasional Basco Coffee',
      subtitle: isManagerMode ? 'Roster shift kerja barista dan operasional harian Basco Coffee' : 'Manajemen roster mingguan, pembagian shift bar & estimasi gaji tim'
    },
    omset_cogs: {
      title: isManagerMode ? 'Penjualan Menu' : 'Analisis COGS & Sales (Aplikasi 2)',
      subtitle: isManagerMode ? 'Catatan penjualan menu harian, rekapitulasi porsi & integrasi Excel' : 'Laporan omset harian, food cost, margin keuntungan, dan target sales'
    },
    cogs: {
      title: 'Stok Opname Bulanan',
      subtitle: 'Pencatatan persediaan bahan baku, stok masuk, stok akhir & audit bulanan'
    },
    shopping_report: {
      title: 'Bahan yang Harus Dibelanjakan (Sheet 4)',
      subtitle: 'Laporan pengadaan stok & notifikasi belanja bahan terintegrasi dengan spreadsheet Sheet 4'
    },
    categories: {
      title: 'Kategori Pengeluaran',
      subtitle: 'Rincian alokasi biaya operasional, bahan baku, dan pemeliharaan bar'
    },
    fixed_cost: {
      title: 'Simulasi Biaya Tetap & BEP',
      subtitle: 'Kalkulasi Break Even Point, sewa tempat, listrik & gaji tetap'
    },
    debt_tracker: {
      title: 'Pencatatan Hutang & Liabilitas Cafe',
      subtitle: 'Kalkulasi cicilan bulanan & tahunan, notifikasi jatuh tempo pembayaran, serta otomasi AI kelayakan berhutang'
    },
    ai_chat: {
      title: 'Tanya AI Analyst Cafe',
      subtitle: 'Asisten AI cerdas untuk efisiensi operasional & konsultasi finansial'
    }
  };

  const currentTabInfo = tabTitles[activeTab] || tabTitles.dashboard;

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans flex text-slate-800" id="app-root">
      
      {/* Left Sidebar Component (Desktop Sticky + Mobile Drawer) */}
      <Sidebar
        user={user!}
        spreadsheetName={spreadsheetName}
        spreadsheetUrl={spreadsheetUrl}
        onRefresh={handleRefresh}
        onDisconnectSheet={handleDisconnectSheet}
        isSyncing={isLoadingData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isManagerMode={isManagerMode}
        onLogoutManager={handleLogoutManager}
        onLoginGoogle={handleLogin}
        onOpenBackupModal={() => setIsGlobalBackupModalOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main Content Area with Dynamic Left Padding on Desktop */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'
      }`}>
        
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            
            {/* Left: Mobile Menu Toggle / Desktop Minimize Toggle & Title */}
            <div className="flex items-center space-x-3 min-w-0">
              {/* Mobile menu open button */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                aria-label="Buka Menu Navigasi"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Desktop Minimize/Expand toggle button in top bar */}
              <button
                type="button"
                onClick={handleToggleSidebarCollapse}
                className="hidden lg:flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer group"
                title={isSidebarCollapsed ? "Perluas Sidebar (Expand)" : "Kecilkan Sidebar (Minimize)"}
                aria-label="Toggle Sidebar Minimize"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="h-4.5 w-4.5 text-amber-600 group-hover:scale-110 transition-transform" />
                ) : (
                  <PanelLeftClose className="h-4.5 w-4.5 text-slate-600 group-hover:text-slate-900 group-hover:scale-110 transition-transform" />
                )}
              </button>

              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-black text-slate-900 truncate leading-tight flex items-center space-x-2">
                  <span>{currentTabInfo.title}</span>
                </h1>
                <p className="text-[10.5px] text-slate-500 font-medium truncate hidden sm:block">
                  {currentTabInfo.subtitle}
                </p>
              </div>
            </div>

            {/* Right: Quick Status, Actions & Sheet Info */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              
              {/* Connected Google Sheet pill (Desktop) */}
              {spreadsheetName && (
                <div className="hidden md:flex items-center space-x-2 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <a
                    href={spreadsheetUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-slate-800 hover:text-emerald-700 truncate max-w-[140px] flex items-center space-x-1"
                    title={`Google Sheet: ${spreadsheetName}`}
                  >
                    <span className="truncate">{spreadsheetName}</span>
                    <ExternalLink className="h-3 w-3 inline shrink-0" />
                  </a>
                </div>
              )}

              {/* Quick Backup JSON button (Hidden in Manager Mode) */}
              {!isManagerMode && (
                <button
                  type="button"
                  onClick={() => setIsGlobalBackupModalOpen(true)}
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="Backup / Restore Semua Data Aplikasi (JSON)"
                >
                  <FileJson className="h-3.5 w-3.5 text-amber-600" />
                  <span>Backup JSON</span>
                </button>
              )}

              {/* Shopping Notification Button (Sheet 4) - Hidden in Manager Mode */}
              {!isManagerMode && shoppingUrgentCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('shopping_report')}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer animate-pulse"
                  title={`${shoppingUrgentCount} bahan mendesak perlu dibelanjakan (Sheet 4)`}
                >
                  <ShoppingCart className="h-3.5 w-3.5 text-rose-600" />
                  <span>{shoppingUrgentCount} Belanja</span>
                </button>
              )}

              {/* Sync Button */}
              {spreadsheetName && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isLoadingData}
                  className={`p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-200 bg-white transition flex items-center justify-center cursor-pointer ${
                    isLoadingData ? 'cursor-wait bg-slate-100' : ''
                  }`}
                  title="Sinkronisasi Data Google Sheets"
                  id="sync-button"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingData ? 'animate-spin text-amber-600' : ''}`} />
                </button>
              )}

              {/* Manager Badge indicator */}
              {isManagerMode && (
                <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-[10.5px] font-extrabold uppercase tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                  <span>Akses Manager</span>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-grow p-3 sm:p-5 lg:p-6">
          {error && (
            <div className="max-w-7xl mx-auto mb-4">
              <div className="p-4 bg-red-50 border border-red-150 rounded-2xl text-xs font-semibold text-red-700 flex items-start space-x-2.5 shadow-xs">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-grow">
                  <span>{error}</span>
                  <button 
                    onClick={handleRefresh} 
                    className="underline ml-2 text-red-800 font-bold hover:text-red-950 block sm:inline mt-1 sm:mt-0"
                  >
                    Coba Sinkronisasi Ulang
                  </button>
                </div>
              </div>
            </div>
          )}

          {isLoadingData && transactions.length === 0 ? (
            <div className="h-[400px] flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="h-8 w-8 text-amber-600 animate-spin" />
              <p className="text-xs font-bold text-slate-600">Mengambil data terbaru dari Google Sheets...</p>
            </div>
          ) : activeTab === 'dashboard' ? (
            <Dashboard
              transactions={transactions}
              onAddTransaction={handleAddClick}
              onEditTransaction={handleEditClick}
              onDeleteTransaction={handleDeleteTransaction}
              spreadsheetUrl={spreadsheetUrl}
              categories={categories}
              onManageCategories={() => setIsCategoryManagerOpen(true)}
              onNavigateToDebt={!isManagerMode ? () => setActiveTab('debt_tracker') : undefined}
              onNavigateToShopping={!isManagerMode ? () => setActiveTab('shopping_report') : undefined}
            />
          ) : activeTab === 'employee_tasks' ? (
            <EmployeeTaskPage
              spreadsheetId={spreadsheetId}
              spreadsheetName={spreadsheetName}
              spreadsheetUrl={spreadsheetUrl}
              token={token}
              isManagerMode={isManagerMode}
            />
          ) : activeTab === 'omset_cogs' ? (
            <CogsDailySalesPage
              spreadsheetId={spreadsheetId}
              spreadsheetName={spreadsheetName}
              spreadsheetUrl={spreadsheetUrl}
              token={token}
              user={user}
            />
          ) : activeTab === 'barista_schedule' ? (
            <BaristaSchedulePage
              transactions={transactions}
              categories={categories}
              spreadsheetId={spreadsheetId}
              token={token}
            />
          ) : activeTab === 'cogs' ? (
            <StockOpnamePage
              transactions={transactions}
              spreadsheetId={spreadsheetId}
              token={token}
            />
          ) : !isManagerMode && activeTab === 'shopping_report' ? (
            <ShoppingReportPage
              spreadsheetId={spreadsheetId}
              spreadsheetName={spreadsheetName}
              spreadsheetUrl={spreadsheetUrl}
              token={token}
              isManagerMode={isManagerMode}
              onNavigateToIncomingGoods={() => setActiveTab('omset_cogs')}
            />
          ) : !isManagerMode && activeTab === 'calendar_notes' ? (
            <CalendarNotesPage
              spreadsheetId={spreadsheetId}
              spreadsheetName={spreadsheetName}
              spreadsheetUrl={spreadsheetUrl}
              token={token}
              isManagerMode={isManagerMode}
            />
          ) : !isManagerMode && activeTab === 'categories' ? (
            <CategoryExpenses
              transactions={transactions}
              categories={categories}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          ) : !isManagerMode && activeTab === 'fixed_cost' ? (
            <FixedCostSimulator />
          ) : !isManagerMode && activeTab === 'debt_tracker' ? (
            <DebtTrackerPage
              transactions={transactions}
            />
          ) : !isManagerMode && activeTab === 'ai_chat' ? (
            <AiChat
              transactions={transactions}
            />
          ) : (
            <Dashboard
              transactions={transactions}
              onAddTransaction={handleAddClick}
              onEditTransaction={handleEditClick}
              onDeleteTransaction={handleDeleteTransaction}
              spreadsheetUrl={spreadsheetUrl}
              categories={categories}
              onManageCategories={() => setIsCategoryManagerOpen(true)}
              onNavigateToDebt={!isManagerMode ? () => setActiveTab('debt_tracker') : undefined}
              onNavigateToShopping={!isManagerMode ? () => setActiveTab('shopping_report') : undefined}
              onRefresh={handleRefresh}
              isLoadingData={isLoadingData}
            />
          )}
        </main>

        {/* Transaction Modal Form */}
        <TransactionForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
          editingTransaction={editingTransaction}
          categories={categories}
          onManageCategories={() => setIsCategoryManagerOpen(true)}
        />

        {/* Category Manager Modal */}
        <CategoryManager
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          categories={categories}
          onAddCategory={handleAddCategory}
          onEditCategory={handleEditCategory}
          onDeleteCategory={handleDeleteCategory}
        />

        {/* Global Backup & Restore JSON Modal */}
        <BackupRestoreModal
          isOpen={isGlobalBackupModalOpen}
          onClose={() => setIsGlobalBackupModalOpen(false)}
          transactions={transactions}
          categories={categories}
        />

        {/* Modern Compact Footer */}
        <footer className="bg-white border-t border-slate-200/80 py-4 text-center text-[11px] font-semibold text-slate-500 mt-auto">
          <div className="px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-900 font-bold font-sans">Basco Cashflow Dashboard</span>
              <span>- Platform Manajemen Terpadu Cafe & Barista.</span>
            </div>
            <div>
              <span className="text-slate-400">Terhubung Google Sheets API</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
