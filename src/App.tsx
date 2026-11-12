import React, { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
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
  PanelLeftOpen,
} from "lucide-react";
import { initAuth, googleSignIn, getAccessToken, logout } from "./firebase";
import { loadCloudSlot, saveCloudSlot } from "./utils/cloudSync";
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
  fetchShoppingListFromSheet4,
  fetchDebtsFromSheet,
} from "./sheetsService";
import { saveStoredDebts } from "./utils/debtUtils";
import { CALENDAR_NOTES_STORAGE_KEY } from "./utils/calendarNotesData";
import {
  SHOPPING_LIST_STORAGE_KEY,
  DEFAULT_SHOPPING_ITEMS,
  computeShoppingMetrics,
} from "./utils/shoppingListData";
import { Transaction, CATEGORIES, AppRole } from "./types";

// Components
import Sidebar, { TabType } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import TransactionForm from "./components/TransactionForm";
import CategoryManager from "./components/CategoryManager";
import CategoryExpenses from "./components/CategoryExpenses";
import AiChat from "./components/AiChat";
import CogsDetail from "./components/CogsDetail";
import FixedCostSimulator from "./components/FixedCostSimulator";
import CogsDailySalesPage from "./components/CogsDailySalesPage";
import StockOpnamePage from "./components/StockOpnamePage";
import BaristaSchedulePage from "./components/BaristaSchedulePage";
import CalendarNotesPage from "./components/CalendarNotesPage";
import DebtTrackerPage from "./components/DebtTrackerPage";
import ShoppingReportPage from "./components/ShoppingReportPage";
import BackupRestoreModal from "./components/BackupRestoreModal";
import EmployeeTaskPage from "./components/EmployeeTaskPage";
import UsageHistoryPage from "./components/UsageHistoryPage";
import { logAppActivity } from "./utils/activityLogger";
import {
  KeyRound,
  UserCheck,
  Lock,
  Crown,
  Briefcase,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

const ROLE_USERS: Record<AppRole, User> = {
  owner: {
    uid: "owner-local-uid",
    displayName: "Owner Basco Coffee",
    email: "Akses Owner (Pemilik)",
    photoURL: null,
    emailVerified: true,
    isAnonymous: true,
    metadata: {} as any,
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: async () => Promise.resolve(),
    getIdToken: async () => Promise.resolve(""),
    getIdTokenResult: async () => Promise.resolve({} as any),
    reload: async () => Promise.resolve(),
    toJSON: () => ({}),
    phoneNumber: null,
    providerId: "owner",
  },
  manager: {
    uid: "manager-local-uid",
    displayName: "Manager Cafe",
    email: "Akses Manager (Operasional)",
    photoURL: null,
    emailVerified: true,
    isAnonymous: true,
    metadata: {} as any,
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: async () => Promise.resolve(),
    getIdToken: async () => Promise.resolve(""),
    getIdTokenResult: async () => Promise.resolve({} as any),
    reload: async () => Promise.resolve(),
    toJSON: () => ({}),
    phoneNumber: null,
    providerId: "manager",
  },
  barista: {
    uid: "barista-local-uid",
    displayName: "Barista Basco",
    email: "Akses Barista (Staff)",
    photoURL: null,
    emailVerified: true,
    isAnonymous: true,
    metadata: {} as any,
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: async () => Promise.resolve(),
    getIdToken: async () => Promise.resolve(""),
    getIdTokenResult: async () => Promise.resolve({} as any),
    reload: async () => Promise.resolve(),
    toJSON: () => ({}),
    phoneNumber: null,
    providerId: "barista",
  },
};

const DEFAULT_SHEET_ID = "1RG8LIT_hzbNl3ru6mCbUSH_P3oqN6yaHqAhUotPSpUc";
const DEFAULT_SHEET_NAME = "Dasbor Arus Kas Keuangan";
const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1RG8LIT_hzbNl3ru6mCbUSH_P3oqN6yaHqAhUotPSpUc/edit?gid=0#gid=0";

const syncCodeDefaultSheetToStorage = () => {
  try {
    const lastCodeDefault = localStorage.getItem("aruskas_code_default_sheet_id");
    const savedId = localStorage.getItem("aruskas_sheet_id");
    if (
      lastCodeDefault !== DEFAULT_SHEET_ID ||
      savedId === "1jIhpD_JWJWAJdI5rdCTbYYBSlPw4De3H2EMW91fxjNM"
    ) {
      localStorage.setItem("aruskas_code_default_sheet_id", DEFAULT_SHEET_ID);
      localStorage.setItem("aruskas_sheet_id", DEFAULT_SHEET_ID);
      localStorage.setItem("aruskas_sheet_name", DEFAULT_SHEET_NAME);
      localStorage.setItem("aruskas_sheet_url", DEFAULT_SHEET_URL);
      localStorage.removeItem("aruskas_manager_transactions");
    }
  } catch {
    // ignore storage errors
  }
};

syncCodeDefaultSheetToStorage();

const getInitialSheetId = (): string => {
  syncCodeDefaultSheetToStorage();
  const saved = localStorage.getItem("aruskas_sheet_id");
  if (saved && !saved.startsWith("local_")) return saved;
  return DEFAULT_SHEET_ID;
};

const getInitialSheetName = (): string => {
  syncCodeDefaultSheetToStorage();
  const saved = localStorage.getItem("aruskas_sheet_name");
  if (saved && !saved.startsWith("Database Lokal")) return saved;
  return DEFAULT_SHEET_NAME;
};

const getInitialSheetUrl = (): string => {
  syncCodeDefaultSheetToStorage();
  const saved = localStorage.getItem("aruskas_sheet_url");
  if (saved && saved.includes("docs.google.com/spreadsheets")) return saved;
  return DEFAULT_SHEET_URL;
};

const resolveSharedGoogleToken = async (): Promise<string | null> => {
  const applySharedAuthData = (data: any): string | null => {
    if (
      data?.spreadsheetId &&
      !data.spreadsheetId.startsWith("local_") &&
      data.spreadsheetId !== "1jIhpD_JWJWAJdI5rdCTbYYBSlPw4De3H2EMW91fxjNM"
    ) {
      localStorage.setItem("aruskas_sheet_id", data.spreadsheetId);
      if (data.spreadsheetName)
        localStorage.setItem("aruskas_sheet_name", data.spreadsheetName);
      if (data.spreadsheetUrl)
        localStorage.setItem("aruskas_sheet_url", data.spreadsheetUrl);
    }
    if (data?.accessToken && !data.accessToken.endsWith("-local-token")) {
      localStorage.setItem("aruskas_google_access_token", data.accessToken);
      return data.accessToken;
    }
    return null;
  };

  try {
    const resp = await fetch("/api/auth/shared-token");
    if (resp.ok) {
      const data = await resp.json();
      const tok = applySharedAuthData(data);
      if (tok) return tok;
    }
  } catch {
    // ignore network errors
  }

  try {
    const cloudAuth = await loadCloudSlot<any>("auth_token");
    const tok = applySharedAuthData(cloudAuth);
    if (tok) return tok;
  } catch {
    // ignore cloud errors
  }

  const localToken = await getAccessToken();
  if (localToken && !localToken.endsWith("-local-token")) {
    return localToken;
  }
  return null;
};

const DEFAULT_MANAGER_TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    tanggal: "2026-06-01",
    debit: 24500000,
    kredit: 0,
    kredit2: 0,
    jenisPengeluaran: "-",
    jenisPengeluaran2: "-",
    keterangan: "Pemasukan Penjualan Kasir POS (Minggu 1 Juni)",
    operasionalDanManajemen: "-",
  },
  {
    id: "2",
    tanggal: "2026-06-03",
    debit: 0,
    kredit: 4800000,
    kredit2: 0,
    jenisPengeluaran: "Bahan Baku & HPP (COGS)",
    jenisPengeluaran2: "-",
    keterangan: "Susu Fresh Milk, Biji Kopi Blend, Sirup Karamel",
    operasionalDanManajemen: "Operasional",
  },
  {
    id: "3",
    tanggal: "2026-06-05",
    debit: 0,
    kredit: 1200000,
    kredit2: 0,
    jenisPengeluaran: "Operasional & Sewa Tempat",
    jenisPengeluaran2: "-",
    keterangan: "Listrik & Wifi Cafe Kece",
    operasionalDanManajemen: "Operasional",
  },
  {
    id: "4",
    tanggal: "2026-06-10",
    debit: 28900000,
    kredit: 0,
    kredit2: 0,
    jenisPengeluaran: "-",
    jenisPengeluaran2: "-",
    keterangan: "Pemasukan Penjualan Kasir POS (Minggu 2-3 Juni)",
    operasionalDanManajemen: "-",
  },
  {
    id: "5",
    tanggal: "2026-06-12",
    debit: 0,
    kredit: 450000,
    kredit2: 0,
    jenisPengeluaran: "Promosi & Marketing",
    jenisPengeluaran2: "-",
    keterangan: "Sponsorship Event Musik Akustik & Selebaran",
    operasionalDanManajemen: "Operasional",
  },
  {
    id: "6",
    tanggal: "2026-06-18",
    debit: 0,
    kredit: 850000,
    kredit2: 0,
    jenisPengeluaran: "Peralatan & Inventaris",
    jenisPengeluaran2: "-",
    keterangan: "Beli Gelas Latte, Sedotan Bambu, & Cup Sealer",
    operasionalDanManajemen: "Operasional",
  },
  {
    id: "7",
    tanggal: "2026-06-25",
    debit: 0,
    kredit: 7500000,
    kredit2: 0,
    jenisPengeluaran: "Gaji Karyawan & Barista",
    jenisPengeluaran2: "-",
    keterangan: "Gaji 2 Barista & 1 Staff Dapur",
    operasionalDanManajemen: "Manajemen",
  },
  {
    id: "8",
    tanggal: "2026-07-01",
    debit: 18500000,
    kredit: 0,
    kredit2: 0,
    jenisPengeluaran: "-",
    jenisPengeluaran2: "-",
    keterangan: "Penjualan Omset Kasir Juli Minggu 1",
    operasionalDanManajemen: "-",
  },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User Role State ('owner' | 'manager' | 'barista')
  const [userRole, setUserRole] = useState<AppRole>(() => {
    const saved = localStorage.getItem("aruskas_user_role") as AppRole;
    if (saved && ["owner", "manager", "barista"].includes(saved)) return saved;
    return localStorage.getItem("aruskas_is_manager_mode") === "true"
      ? "manager"
      : "owner";
  });

  // Selected Role Tab on Landing Page
  const [loginRoleTab, setLoginRoleTab] = useState<AppRole>("owner");
  const [rolePinInput, setRolePinInput] = useState("");
  const [rolePinError, setRolePinError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Manager Mode State (Akses Tanpa Email)
  const [isManagerMode, setIsManagerMode] = useState<boolean>(() => {
    return localStorage.getItem("aruskas_is_manager_mode") === "true";
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [managerPinInput, setManagerPinInput] = useState("");
  const [managerPinError, setManagerPinError] = useState<string | null>(null);

  // Spreadsheet State (Defaults automatically to primary Google Sheet across all devices)
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() =>
    getInitialSheetId(),
  );
  const [spreadsheetName, setSpreadsheetName] = useState<string | null>(() =>
    getInitialSheetName(),
  );
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() =>
    getInitialSheetUrl(),
  );
  const [isSearchingSheet, setIsSearchingSheet] = useState(false);
  const [isInitializingSheet, setIsInitializingSheet] = useState(false);
  const [foundSheetInfo, setFoundSheetInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [customSheetInput, setCustomSheetInput] = useState("");
  const [isLinkingCustomSheet, setIsLinkingCustomSheet] = useState(false);

  const hasValidGoogleToken = Boolean(token && !token.endsWith("-local-token"));

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  // Categories State
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem("aruskas_categories");
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
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

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
      return localStorage.getItem("basco_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("basco_sidebar_collapsed", String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  // Sync categories to localStorage
  useEffect(() => {
    localStorage.setItem("aruskas_categories", JSON.stringify(categories));
  }, [categories]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      async (firebaseUser, cachedToken) => {
        setUser(firebaseUser);
        const sheetId = getInitialSheetId();
        const sheetName = getInitialSheetName();
        const sheetUrl = getInitialSheetUrl();
        setSpreadsheetId(sheetId);
        setSpreadsheetName(sheetName);
        setSpreadsheetUrl(sheetUrl);
        localStorage.setItem("aruskas_sheet_id", sheetId);
        localStorage.setItem("aruskas_sheet_name", sheetName);
        localStorage.setItem("aruskas_sheet_url", sheetUrl);

        let activeToken = cachedToken;
        if (!activeToken || activeToken.endsWith("-local-token")) {
          activeToken = await resolveSharedGoogleToken();
        } else {
          const authPayload = {
            accessToken: activeToken,
            spreadsheetId: sheetId,
            spreadsheetName: sheetName,
            spreadsheetUrl: sheetUrl,
          };
          localStorage.setItem("aruskas_google_access_token", activeToken);
          fetch("/api/auth/shared-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(authPayload),
          }).catch(() => {});
          saveCloudSlot("auth_token", authPayload).catch(() => {});
        }
        setToken(activeToken);
        setAuthChecking(false);
      },
      async () => {
        // Pre-fetch shared Google token & sheet from backend so PIN logins on new devices immediately connect
        await resolveSharedGoogleToken();
        if (!localStorage.getItem("aruskas_is_manager_mode")) {
          setUser(null);
          setToken(null);
        }
        setAuthChecking(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // Role Mode effect (PIN Login with Automatic Shared Google Sheet Sync)
  useEffect(() => {
    if (isManagerMode) {
      let isMounted = true;
      const activeUser = ROLE_USERS[userRole] || ROLE_USERS.manager;
      setUser(activeUser);

      const sheetId = getInitialSheetId();
      const sheetName = getInitialSheetName();
      const sheetUrl = getInitialSheetUrl();
      setSpreadsheetId(sheetId);
      setSpreadsheetName(sheetName);
      setSpreadsheetUrl(sheetUrl);
      localStorage.setItem("aruskas_sheet_id", sheetId);
      localStorage.setItem("aruskas_sheet_name", sheetName);
      localStorage.setItem("aruskas_sheet_url", sheetUrl);

      // Load cached real transactions while Google Sheet syncs (ignore legacy 8-row dummy data)
      const savedTx = localStorage.getItem("aruskas_manager_transactions");
      const hasRealSheet = Boolean(sheetId && !sheetId.startsWith("local_"));
      if (savedTx) {
        try {
          const parsed = JSON.parse(savedTx);
          const isLegacyDummy =
            Array.isArray(parsed) &&
            parsed.some((t: any) => t?.id === "m1" && t?.debit === 18500000);
          if (isLegacyDummy && hasRealSheet) {
            localStorage.removeItem("aruskas_manager_transactions");
            setTransactions([]);
          } else {
            setTransactions(parsed);
          }
        } catch (e) {
          setTransactions(hasRealSheet ? [] : DEFAULT_MANAGER_TRANSACTIONS);
        }
      } else if (!hasRealSheet) {
        setTransactions(DEFAULT_MANAGER_TRANSACTIONS);
        localStorage.setItem(
          "aruskas_manager_transactions",
          JSON.stringify(DEFAULT_MANAGER_TRANSACTIONS),
        );
      }

      resolveSharedGoogleToken().then((sharedToken) => {
        if (!isMounted) return;
        if (sharedToken) {
          setToken(sharedToken);
        } else {
          setToken((prev) =>
            prev && !prev.endsWith("-local-token")
              ? prev
              : `${userRole}-local-token`,
          );
        }
        setAuthChecking(false);
      });

      return () => {
        isMounted = false;
      };
    }
  }, [isManagerMode, userRole]);

  // Route protection for Manager and Barista roles
  useEffect(() => {
    if (userRole === "barista") {
      if (activeTab !== "omset_cogs") {
        setActiveTab("omset_cogs");
      }
    } else if (userRole === "manager") {
      const allowedManagerTabs: TabType[] = [
        "employee_tasks",
        "barista_schedule",
        "omset_cogs",
        "shopping_report",
        "cogs",
      ];
      if (!allowedManagerTabs.includes(activeTab)) {
        setActiveTab("employee_tasks");
      }
    }
  }, [userRole, activeTab]);

  // Track tab navigation across all 3 roles
  const lastLoggedNavRef = useRef<string>("");
  useEffect(() => {
    if (!user) {
      lastLoggedNavRef.current = "";
      return;
    }
    if (userRole === "barista" && activeTab !== "omset_cogs") return;
    if (
      userRole === "manager" &&
      !["employee_tasks", "barista_schedule", "omset_cogs", "shopping_report", "cogs"].includes(activeTab)
    ) {
      return;
    }
    const navKey = `${userRole}:${activeTab}`;
    if (lastLoggedNavRef.current === navKey) return;
    lastLoggedNavRef.current = navKey;

    const moduleTitleMap: Record<TabType, string> = {
      dashboard: userRole === "manager" ? "Dashboard Pencatatan Harian" : "Dasbor Utama & Arus Kas",
      employee_tasks: userRole === "barista" ? "Tugas & SOP Barista" : userRole === "manager" ? "Tugas Karyawan" : "Pencatatan Tugas Karyawan",
      calendar_notes: "Catatan & Agenda Kalender",
      barista_schedule: userRole === "barista" ? "Jadwal Shift & Slip Gaji" : "Jadwal Operasional",
      omset_cogs: userRole === "barista" ? "Pencatatan Penjualan & Jatah Harian" : userRole === "manager" ? "Penjualan Menu" : "Analisis COGS & Sales",
      cogs: userRole === "barista" ? "Stok Opname & Resep" : "Stok Opname Bulanan",
      shopping_report: "Bahan yang Harus Dibelanjakan",
      categories: "Kategori Pengeluaran",
      fixed_cost: "Simulasi Biaya Tetap & BEP",
      debt_tracker: "Pencatatan Hutang & Liabilitas",
      ai_chat: "Tanya AI Analyst Cafe",
      usage_history: "Riwayat Penggunaan Aplikasi",
    };
    const modName = moduleTitleMap[activeTab] || activeTab;
    logAppActivity({
      role: userRole,
      actorName: user?.displayName || user?.email || undefined,
      actionType: "navigate",
      module: modName,
      description: `Membuka halaman ${modName}`,
    });
  }, [user, userRole, activeTab]);

  // Unified Role Password Login Handler (Owner, Manager, Barista)
  const handleLoginWithRolePin = async (role: AppRole, pinCode?: string) => {
    const inputClean = (pinCode || rolePinInput || "").trim().toLowerCase();

    const expectedPassword =
      role === "owner"
        ? "basco12.indonesia"
        : role === "manager"
          ? "bascospv"
          : "baristabasco";

    if (!inputClean || inputClean !== expectedPassword) {
      setRolePinError("Password salah! Silakan periksa kembali password Anda.");
      return;
    }

    setUserRole(role);
    localStorage.setItem("aruskas_user_role", role);
    setIsManagerMode(true);
    localStorage.setItem("aruskas_is_manager_mode", "true");
    setUser(ROLE_USERS[role]);

    const sheetId = getInitialSheetId();
    const sheetName = getInitialSheetName();
    const sheetUrl = getInitialSheetUrl();
    setSpreadsheetId(sheetId);
    setSpreadsheetName(sheetName);
    setSpreadsheetUrl(sheetUrl);
    localStorage.setItem("aruskas_sheet_id", sheetId);
    localStorage.setItem("aruskas_sheet_name", sheetName);
    localStorage.setItem("aruskas_sheet_url", sheetUrl);

    const sharedToken = await resolveSharedGoogleToken();
    setToken(sharedToken || `${role}-local-token`);

    const savedTx = localStorage.getItem("aruskas_manager_transactions");
    const hasRealSheet = Boolean(sheetId && !sheetId.startsWith("local_"));
    if (savedTx) {
      try {
        const parsed = JSON.parse(savedTx);
        const isLegacyDummy =
          Array.isArray(parsed) &&
          parsed.some((t: any) => t?.id === "m1" && t?.debit === 18500000);
        if (isLegacyDummy && hasRealSheet) {
          localStorage.removeItem("aruskas_manager_transactions");
          setTransactions([]);
        } else {
          setTransactions(parsed);
        }
      } catch (e) {
        setTransactions(hasRealSheet ? [] : DEFAULT_MANAGER_TRANSACTIONS);
      }
    } else if (!hasRealSheet) {
      setTransactions(DEFAULT_MANAGER_TRANSACTIONS);
      localStorage.setItem(
        "aruskas_manager_transactions",
        JSON.stringify(DEFAULT_MANAGER_TRANSACTIONS),
      );
    }

    if (role === "barista") {
      setActiveTab("omset_cogs");
    } else if (role === "manager") {
      setActiveTab("employee_tasks");
    } else {
      setActiveTab("dashboard");
    }

    logAppActivity({
      role,
      actorName: ROLE_USERS[role].displayName || undefined,
      authMethod: "password",
      actionType: "login",
      module: "Autentikasi",
      description: `Login ke aplikasi sebagai role ${role === "owner" ? "Owner" : role === "manager" ? "Manajer" : "Barista"} menggunakan Password Role`,
      immediateSync: true,
    });

    setShowPinModal(false);
    setRolePinError(null);
    setRolePinInput("");
    setManagerPinError(null);
    setManagerPinInput("");
  };

  // Enter Manager mode backward-compatibility
  const handleEnterManagerMode = (pinCode?: string) => {
    handleLoginWithRolePin("manager", pinCode);
  };

  // Logout from any mode
  const handleLogoutManager = async () => {
    logAppActivity({
      role: userRole,
      actorName: user?.displayName || user?.email || undefined,
      actionType: "logout",
      module: "Autentikasi",
      description: `Logout dari sesi role ${userRole === "owner" ? "Owner" : userRole === "manager" ? "Manajer" : "Barista"}`,
      immediateSync: true,
    });
    setIsManagerMode(false);
    localStorage.removeItem("aruskas_is_manager_mode");
    localStorage.removeItem("aruskas_user_role");
    setUserRole("owner");
    setUser(null);
    setToken(null);
    setRolePinError(null);
    setRolePinInput("");
    setActiveTab("dashboard");
    try {
      await logout();
    } catch {}
  };

  // Drive and Sheets logic whenever a Spreadsheet ID is active (any role, with or without OAuth token)
  useEffect(() => {
    if (user && hasValidGoogleToken && !spreadsheetId) {
      checkForSpreadsheet(token!);
    } else if (user && spreadsheetId && !spreadsheetId.startsWith("local_")) {
      loadTransactionsFromSheet(spreadsheetId, token || "");
    }
  }, [user, token, hasValidGoogleToken, spreadsheetId]);

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
      setError("Gagal memeriksa file Google Drive Anda");
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
      if (list.length > 0) {
        localStorage.setItem(
          "aruskas_manager_transactions",
          JSON.stringify(list),
        );
      }

      // Fetch custom categories from sheet
      const sheetCats = await fetchCategories(id, accessToken);
      if (sheetCats && sheetCats.length > 0) {
        setCategories(sheetCats);
      }

      // Fetch ingredients and stock opname from sheet on app entry
      try {
        const remoteIngs = await fetchIngredientsFromSheet(id, accessToken);
        if (remoteIngs && remoteIngs.length > 0) {
          localStorage.setItem(
            "aruskas_cogs_ingredients",
            JSON.stringify(remoteIngs),
          );
        }

        const allOpname = await fetchAllStockOpnameReportsFromSheet(
          id,
          accessToken,
        );
        if (allOpname && allOpname.reports.length > 0) {
          localStorage.setItem(
            "basco_opname_reports_history",
            JSON.stringify(allOpname.reports),
          );
          Object.entries(allOpname.monthlyEntries).forEach(([m, val]) => {
            localStorage.setItem(
              `basco_opname_draft_${m}`,
              JSON.stringify(val.entries),
            );
            const report = allOpname.reports.find((r) => r.periodeBulan === m);
            if (report) {
              localStorage.setItem(
                `basco_opname_report_${m}`,
                JSON.stringify(report),
              );
            }
          });
        }
      } catch (opnameErr) {
        console.warn("Could not sync stock opname on app start:", opnameErr);
      }

      // Fetch calendar notes & agenda from sheet on app entry
      try {
        const remoteCalendar = await fetchCalendarNotesFromSheet(
          id,
          accessToken,
        );
        if (remoteCalendar && remoteCalendar.length > 0) {
          localStorage.setItem(
            CALENDAR_NOTES_STORAGE_KEY,
            JSON.stringify(remoteCalendar),
          );
        }
      } catch (calErr) {
        console.warn("Could not sync calendar notes on app start:", calErr);
      }

      // Fetch shopping list from Sheet 4 on app entry
      try {
        const remoteShopping = await fetchShoppingListFromSheet4(
          id,
          accessToken,
        );
        if (remoteShopping && remoteShopping.items.length > 0) {
          localStorage.setItem(
            SHOPPING_LIST_STORAGE_KEY,
            JSON.stringify(remoteShopping.items),
          );
          setShoppingUrgentCount(
            computeShoppingMetrics(remoteShopping.items).urgentCount,
          );
        }
      } catch (shopErr) {
        console.warn(
          "Could not sync shopping list from Sheet 4 on app start:",
          shopErr,
        );
      }

      // Sync & auto-create 'Pencatatan Hutang' sheet tab on app entry
      try {
        const remoteDebts = await fetchDebtsFromSheet(id, accessToken);
        if (Array.isArray(remoteDebts) && remoteDebts.length > 0) {
          saveStoredDebts(remoteDebts);
        }
      } catch (debtErr) {
        console.warn(
          "Could not sync Pencatatan Hutang sheet on app start:",
          debtErr,
        );
      }
    } catch (err: any) {
      console.error(err);
      if (!hasValidGoogleToken) {
        setError(
          'Gagal membaca Google Sheets karena akses file masih "Dibatasi" (Private). Buka Google Sheets → klik "Bagikan" (Share) → ubah Akses Umum menjadi "Siapa saja yang memiliki link", atau klik tombol "Google" di pojok kiri bawah untuk menghubungkan akun Google.',
        );
      } else {
        setError(
          "Gagal mengambil data dari spreadsheet. Hubungan spreadsheet Anda mungkin terputus.",
        );
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  // Google Login click handler (Supports Owner, Manajer, or Barista role)
  const handleLogin = async (targetRole?: AppRole | React.MouseEvent) => {
    setIsLoggingIn(true);
    setError(null);
    const chosenRole: AppRole =
      typeof targetRole === "string" &&
      ["owner", "manager", "barista"].includes(targetRole)
        ? targetRole
        : user
          ? userRole
          : loginRoleTab;

    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setUserRole(chosenRole);
        localStorage.setItem("aruskas_user_role", chosenRole);
        setIsManagerMode(false);
        localStorage.removeItem("aruskas_is_manager_mode");

        const sheetId = getInitialSheetId();
        const sheetName = getInitialSheetName();
        const sheetUrl = getInitialSheetUrl();
        setSpreadsheetId(sheetId);
        setSpreadsheetName(sheetName);
        setSpreadsheetUrl(sheetUrl);
        localStorage.setItem("aruskas_sheet_id", sheetId);
        localStorage.setItem("aruskas_sheet_name", sheetName);
        localStorage.setItem("aruskas_sheet_url", sheetUrl);

        const authPayload = {
          accessToken: result.accessToken,
          spreadsheetId: sheetId,
          spreadsheetName: sheetName,
          spreadsheetUrl: sheetUrl,
        };
        fetch("/api/auth/shared-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authPayload),
        }).catch(() => {});
        saveCloudSlot("auth_token", authPayload).catch(() => {});

        if (chosenRole === "barista") {
          setActiveTab("omset_cogs");
        } else if (chosenRole === "manager") {
          setActiveTab("employee_tasks");
        } else {
          setActiveTab("dashboard");
        }

        logAppActivity({
          role: chosenRole,
          actorName: result.user?.displayName || result.user?.email || undefined,
          authMethod: "google",
          actionType: "login",
          module: "Autentikasi",
          description: `Login via Google OAuth sebagai role ${chosenRole === "owner" ? "Owner" : chosenRole === "manager" ? "Manajer" : "Barista"}`,
          immediateSync: true,
        });
      }
    } catch (err: any) {
      console.error("Google Sign-in error:", err);
      const code = err?.code || "";
      const message = err?.message || "";
      if (code === "auth/unauthorized-domain") {
        setError(
          `Domain ${window.location.hostname} belum terdaftar di Authorized Domains Firebase.`,
        );
      } else if (code === "auth/operation-not-allowed") {
        setError(
          "Google Sign-in belum diaktifkan di Firebase Console (Buka Firebase Console > Authentication > Sign-in method > pilih Google lalu klik Enable & Save).",
        );
      } else if (code === "auth/popup-closed-by-user") {
        setError("Jendela popup login Google ditutup sebelum selesai.");
      } else if (code === "auth/popup-blocked") {
        setError(
          "Jendela popup diblokir oleh browser. Harap izinkan pop-up di browser Anda.",
        );
      } else {
        setError(
          `Gagal login (${code || "Detail"}): ${message || "Pastikan izin Google Sheets & Drive diberikan."}`,
        );
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
      setSpreadsheetName("Dasbor Arus Kas Keuangan");
      setSpreadsheetUrl(sheet.url);

      // Store in LocalStorage
      localStorage.setItem("aruskas_sheet_id", sheet.id);
      localStorage.setItem("aruskas_sheet_name", "Dasbor Arus Kas Keuangan");
      localStorage.setItem("aruskas_sheet_url", sheet.url);

      fetch("/api/auth/shared-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: sheet.id,
          spreadsheetName: "Dasbor Arus Kas Keuangan",
          spreadsheetUrl: sheet.url,
        }),
      }).catch(() => {});

      setFoundSheetInfo(null);
    } catch (err: any) {
      console.error(err);
      setError("Gagal menginisialisasi spreadsheet baru di Google Drive");
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

    localStorage.setItem("aruskas_sheet_id", id);
    localStorage.setItem("aruskas_sheet_name", name);
    localStorage.setItem("aruskas_sheet_url", url);

    fetch("/api/auth/shared-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spreadsheetId: id,
        spreadsheetName: name,
        spreadsheetUrl: url,
      }),
    }).catch(() => {});

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
      setCustomSheetInput("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal menautkan spreadsheet");
    } finally {
      setIsLinkingCustomSheet(false);
    }
  };

  // Disconnect Sheet
  const handleDisconnectSheet = () => {
    const confirmation = window.confirm(
      "Apakah Anda yakin ingin mengganti spreadsheet yang aktif? Data di Google Sheets Anda tidak akan terhapus, tetapi aplikasi akan kembali ke menu setup.",
    );
    if (confirmation) {
      setSpreadsheetId(null);
      setSpreadsheetName(null);
      setSpreadsheetUrl(null);
      setTransactions([]);
      setFoundSheetInfo(null);
      localStorage.removeItem("aruskas_sheet_id");
      localStorage.removeItem("aruskas_sheet_name");
      localStorage.removeItem("aruskas_sheet_url");
      if (hasValidGoogleToken && token) {
        checkForSpreadsheet(token);
      }
    }
  };

  // Refresh manually
  const handleRefresh = async () => {
    if (spreadsheetId && !spreadsheetId.startsWith("local_")) {
      let activeToken = hasValidGoogleToken && token ? token : "";
      if (!activeToken) {
        const sharedToken = await resolveSharedGoogleToken();
        if (sharedToken) {
          setToken(sharedToken);
          activeToken = sharedToken;
        }
      }
      await loadTransactionsFromSheet(spreadsheetId, activeToken);
      logAppActivity({
        role: userRole,
        actorName: user?.displayName || user?.email || undefined,
        actionType: "sync",
        module: "Sinkronisasi Google Sheets",
        description: "Memuat ulang data transaksi dari Google Sheets",
      });
    }
  };

  // Add / Edit submission
  const handleFormSubmit = async (data: Omit<Transaction, "id">) => {
    const actorName = user?.displayName || user?.email || undefined;
    const isEdit = Boolean(editingTransaction);
    if (!spreadsheetId || spreadsheetId.startsWith("local_")) {
      let updated: Transaction[];
      if (editingTransaction) {
        updated = transactions.map((t) =>
          t.id === editingTransaction.id
            ? { ...data, id: editingTransaction.id }
            : t,
        );
      } else {
        const newTx: Transaction = { ...data, id: String(Date.now()) };
        updated = [newTx, ...transactions];
      }
      setTransactions(updated);
      localStorage.setItem(
        "aruskas_manager_transactions",
        JSON.stringify(updated),
      );
      const txNominal = Number(data.debit || data.kredit || data.kredit2 || 0);
      const txKind = Number(data.debit || 0) > 0 ? "pemasukan" : "pengeluaran";
      logAppActivity({
        role: userRole,
        actorName,
        actionType: isEdit ? "update" : "create",
        module: "Dasbor Utama & Arus Kas",
        description: `${isEdit ? "Mengubah" : "Menambahkan"} transaksi ${txKind} (${data.jenisPengeluaran || "-"}: ${data.keterangan || "-"}) sebesar Rp ${txNominal.toLocaleString("id-ID")}`,
      });
      return;
    }

    const effectiveToken = token || `${userRole}-local-token`;
    if (editingTransaction) {
      // Edit mode
      await updateTransaction(
        spreadsheetId,
        editingTransaction.id,
        data,
        effectiveToken,
      );
    } else {
      // Add mode
      await addTransaction(spreadsheetId, data, effectiveToken);
    }

    const txNominal = Number(data.debit || data.kredit || data.kredit2 || 0);
    const txKind = Number(data.debit || 0) > 0 ? "pemasukan" : "pengeluaran";
    logAppActivity({
      role: userRole,
      actorName,
      actionType: isEdit ? "update" : "create",
      module: "Dasbor Utama & Arus Kas",
      description: `${isEdit ? "Mengubah" : "Menambahkan"} transaksi ${txKind} (${data.jenisPengeluaran || "-"}: ${data.keterangan || "-"}) sebesar Rp ${txNominal.toLocaleString("id-ID")}`,
    });

    // Refresh transactions
    await loadTransactionsFromSheet(spreadsheetId, effectiveToken);
  };

  // Delete transaction action
  const handleDeleteTransaction = async (id: string) => {
    const targetTx = transactions.find((t) => t.id === id);
    const actorName = user?.displayName || user?.email || undefined;
    if (!spreadsheetId || spreadsheetId.startsWith("local_")) {
      const updated = transactions.filter((t) => t.id !== id);
      setTransactions(updated);
      localStorage.setItem(
        "aruskas_manager_transactions",
        JSON.stringify(updated),
      );
      logAppActivity({
        role: userRole,
        actorName,
        actionType: "delete",
        module: "Dasbor Utama & Arus Kas",
        description: `Menghapus transaksi ${targetTx ? `${targetTx.jenisPengeluaran || "-"}: ${targetTx.keterangan || "-"}` : id}`,
      });
      return;
    }
    const effectiveToken = token || `${userRole}-local-token`;
    try {
      setIsLoadingData(true);
      await deleteTransaction(spreadsheetId, id, effectiveToken);
      logAppActivity({
        role: userRole,
        actorName,
        actionType: "delete",
        module: "Dasbor Utama & Arus Kas",
        description: `Menghapus transaksi ${targetTx ? `${targetTx.jenisPengeluaran || "-"}: ${targetTx.keterangan || "-"}` : id}`,
      });
      await loadTransactionsFromSheet(spreadsheetId, effectiveToken);
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
    logAppActivity({
      role: userRole,
      actorName: user?.displayName || user?.email || undefined,
      actionType: "create",
      module: "Kategori Pengeluaran",
      description: `Menambahkan kategori pengeluaran baru: "${trimmed}"`,
    });

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

    const updatedCats = categories.map((c) => (c === oldCat ? trimmed : c));
    setCategories(updatedCats);

    // Update affected local transactions
    const updatedTx = transactions.map((t) => {
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
      return changed
        ? { ...t, jenisPengeluaran: jp1, jenisPengeluaran2: jp2 }
        : t;
    });
    setTransactions(updatedTx);

    if (spreadsheetId && token) {
      setIsLoadingData(true);
      try {
        await saveCategoriesToSheet(spreadsheetId, updatedCats, token);
        // Sync affected transaction rows to Google Sheets
        const affected = transactions.filter(
          (t) =>
            t.jenisPengeluaran === oldCat || t.jenisPengeluaran2 === oldCat,
        );
        for (const t of affected) {
          const jp1 =
            t.jenisPengeluaran === oldCat ? trimmed : t.jenisPengeluaran;
          const jp2 =
            (t.jenisPengeluaran2 || "-") === oldCat
              ? trimmed
              : t.jenisPengeluaran2 || "-";
          await updateTransaction(
            spreadsheetId,
            t.id,
            {
              tanggal: t.tanggal,
              debit: t.debit,
              kredit: t.kredit,
              kredit2: t.kredit2 || 0,
              jenisPengeluaran: jp1,
              jenisPengeluaran2: jp2,
              keterangan: t.keterangan,
              operasionalDanManajemen: t.operasionalDanManajemen || "-",
            },
            token,
          );
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
    const updatedCats = categories.filter((c) => c !== catToDelete);
    setCategories(updatedCats);

    const fallbackCat = updatedCats[0] || "Lain-lain";

    // Update affected local transactions
    const updatedTx = transactions.map((t) => {
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
      return changed
        ? { ...t, jenisPengeluaran: jp1, jenisPengeluaran2: jp2 }
        : t;
    });
    setTransactions(updatedTx);

    if (spreadsheetId && token) {
      setIsLoadingData(true);
      try {
        await saveCategoriesToSheet(spreadsheetId, updatedCats, token);
        // Update affected transaction rows in Google Sheets
        const affected = transactions.filter(
          (t) =>
            t.jenisPengeluaran === catToDelete ||
            t.jenisPengeluaran2 === catToDelete,
        );
        for (const t of affected) {
          const jp1 =
            t.jenisPengeluaran === catToDelete
              ? fallbackCat
              : t.jenisPengeluaran;
          const jp2 =
            (t.jenisPengeluaran2 || "-") === catToDelete
              ? "-"
              : t.jenisPengeluaran2 || "-";
          await updateTransaction(
            spreadsheetId,
            t.id,
            {
              tanggal: t.tanggal,
              debit: t.debit,
              kredit: t.kredit,
              kredit2: t.kredit2 || 0,
              jenisPengeluaran: jp1,
              jenisPengeluaran2: jp2,
              keterangan: t.keterangan,
              operasionalDanManajemen: t.operasionalDanManajemen || "-",
            },
            token,
          );
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

  // SIGN IN LANDING SCREEN (If not logged in) - 3 Roles: Owner, Manajer, Barista
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0b2e22] via-[#134e3a] to-[#082219] flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
        {/* Subtle Decorative Background Glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-emerald-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

        {/* App Title & Header */}
        <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center z-10 px-4">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2.5 shadow-xl mb-3.5 border-2 border-emerald-300/40">
            <img
              src="/basco-logo.png"
              alt="Basco Logo"
              className="h-full w-full object-contain"
            />
          </div>

          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white drop-shadow-xs">
            Basco Cashflow & Cafe System
          </h2>
          <p className="mt-1 text-xs text-emerald-100/80 max-w-md mx-auto font-bold uppercase tracking-wider">
            Sistem Pemantau Keuangan & Operasional
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4">
          <div className="bg-white py-7 px-5 sm:px-8 rounded-2xl border border-emerald-900/20 shadow-2xl">
            {/* 3 ROLE SELECTOR TABS */}
            <div className="mb-6">
              <label className="text-[11px] font-black uppercase tracking-wider text-emerald-950/70 block mb-2 text-center">
                Pilih Aksi
              </label>
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-emerald-950/5 rounded-xl border border-emerald-900/15">
                <button
                  type="button"
                  onClick={() => {
                    setLoginRoleTab("owner");
                    setRolePinError(null);
                    setRolePinInput("");
                    setShowPassword(false);
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    loginRoleTab === "owner"
                      ? "bg-[#14532d] text-white shadow-sm ring-2 ring-emerald-800/30"
                      : "text-emerald-950/70 hover:text-emerald-950 hover:bg-white/80"
                  }`}
                >
                  <span className="text-base sm:mr-1.5">👑</span>
                  <span>Owner</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginRoleTab("manager");
                    setRolePinError(null);
                    setRolePinInput("");
                    setShowPassword(false);
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    loginRoleTab === "manager"
                      ? "bg-[#14532d] text-white shadow-sm ring-2 ring-emerald-800/30"
                      : "text-emerald-950/70 hover:text-emerald-950 hover:bg-white/80"
                  }`}
                >
                  <span className="text-base sm:mr-1.5">👔</span>
                  <span>Manajer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginRoleTab("barista");
                    setRolePinError(null);
                    setRolePinInput("");
                    setShowPassword(false);
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    loginRoleTab === "barista"
                      ? "bg-[#14532d] text-white shadow-sm ring-2 ring-emerald-800/30"
                      : "text-emerald-950/70 hover:text-emerald-950 hover:bg-white/80"
                  }`}
                >
                  <span className="text-base sm:mr-1.5">☕</span>
                  <span>Barista</span>
                </button>
              </div>
            </div>

            {/* Error alerts if any */}
            {rolePinError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 mb-5 flex items-start space-x-2">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
                <span>{rolePinError}</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 mb-5 flex items-start space-x-2">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB CONTENT: OWNER */}
            {loginRoleTab === "owner" && (
              <div className="space-y-5">
                {/* Role description banner */}
                <div className="p-4 bg-emerald-950/5 rounded-xl border border-emerald-800/20 text-emerald-950">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-[#14532d] text-white rounded-lg shrink-0 shadow-xs">
                      <Crown className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        Akses Penuh Owner (Pemilik Usaha)
                      </h4>
                      <p className="text-[11px] text-emerald-900/80 font-medium mt-0.5 leading-relaxed">
                        Kendali lengkap perhitungan
                      </p>
                    </div>
                  </div>
                </div>

                {/* Option 1: Google OAuth */}
                <div>
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="w-full flex justify-center items-center py-2.5 px-4 border border-emerald-800/25 rounded-xl text-xs font-bold bg-white text-slate-800 hover:bg-emerald-50/60 transition cursor-pointer disabled:opacity-60 shadow-xs hover:border-emerald-700/40"
                  >
                    {isLoggingIn ? (
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#14532d]" />
                        <span>Menghubungkan akun Google...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          className="h-4 w-4 shrink-0"
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          ></path>
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          ></path>
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          ></path>
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          ></path>
                        </svg>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                          Masuk Akun Google (Sinkron Google Sheets)
                        </span>
                      </div>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center font-medium mt-1.5">
                    Memerlukan akun Google dengan izin Google Sheets personal
                    Anda
                  </p>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                    <span className="bg-white px-3 text-slate-400">
                      Atau Masuk dengan Password Owner
                    </span>
                  </div>
                </div>

                {/* Option 2: Owner Password Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLoginWithRolePin("owner", rolePinInput);
                  }}
                  className="space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={rolePinInput}
                        onChange={(e) => setRolePinInput(e.target.value)}
                        placeholder="Masukkan password"
                        className="w-full pl-9 pr-10 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#14532d] focus:border-[#14532d] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-emerald-900 transition cursor-pointer"
                        tabIndex={-1}
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#14532d] hover:bg-[#0f3f22] text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-1.5"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Masuk sebagai Owner</span>
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: MANAJER */}
            {loginRoleTab === "manager" && (
              <div className="space-y-5">
                {/* Role description banner */}
                <div className="p-4 bg-emerald-950/5 rounded-xl border border-emerald-800/20 text-emerald-950">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-[#14532d] text-white rounded-lg shrink-0 shadow-xs">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        Akses Manajer Operasional Cafe
                      </h4>
                      <p className="text-[11px] text-emerald-900/80 font-medium mt-0.5 leading-relaxed">
                        Kelola operasional: Tugas Karyawan, Jadwal Operasional,
                        Sales, Bahan Perlu Dibelanjakan, dan Stok Opname Bulanan.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Manager Features Checklist */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5 font-medium">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#14532d] shrink-0" />
                    <span>
                      Fitur Terbuka: Tugas Karyawan, Jadwal Operasional, COGS &
                      Sales, Belanja & Stok Opname
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-5">
                    Dasbor utama kas, catatan kalender, kategori pengeluaran,
                    hutang & simulasi fixed cost pemilik usaha dilindungi.
                  </p>
                </div>

                {/* Manager Password Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLoginWithRolePin("manager", rolePinInput);
                  }}
                  className="space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={rolePinInput}
                        onChange={(e) => setRolePinInput(e.target.value)}
                        placeholder="Masukkan password"
                        className="w-full pl-9 pr-10 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#14532d] focus:border-[#14532d] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-emerald-900 transition cursor-pointer"
                        tabIndex={-1}
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#14532d] hover:bg-[#0f3f22] text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-1.5"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Masuk Manajer</span>
                  </button>
                </form>

                {/* Option 2: Google OAuth for Manager */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleLogin("manager")}
                    disabled={isLoggingIn}
                    className="w-full flex justify-center items-center py-2 px-4 border border-emerald-800/25 rounded-xl text-xs font-bold bg-white text-slate-800 hover:bg-emerald-50/60 transition cursor-pointer disabled:opacity-60 shadow-2xs"
                  >
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-emerald-950">
                      🔗 Masuk Manajer via Akun Google (Sinkron Otomatis)
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: BARISTA */}
            {loginRoleTab === "barista" && (
              <div className="space-y-5">
                {/* Role description banner */}
                <div className="p-4 bg-emerald-950/5 rounded-xl border border-emerald-800/20 text-emerald-950">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-[#14532d] text-white rounded-lg shrink-0 shadow-xs">
                      <Coffee className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        Akses Barista & Tim Bar
                      </h4>
                      <p className="text-[11px] text-emerald-900/80 font-medium mt-0.5 leading-relaxed">
                        Area khusus barista: input pencatatan penjualan & jatah
                        menu harian pada modul Analisis COGS & Sales.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Barista Features Checklist */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5 font-medium">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#14532d] shrink-0" />
                    <span>
                      Fitur Terbuka: Analisis COGS & Sales (Bagian 1: Pencatatan
                      Harian)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-5">
                    Aman & fokus khusus pencatatan penjualan menu harian
                    barista.
                  </p>
                </div>

                {/* Barista Password Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLoginWithRolePin("barista", rolePinInput);
                  }}
                  className="space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={rolePinInput}
                        onChange={(e) => setRolePinInput(e.target.value)}
                        placeholder="Masukkan password"
                        className="w-full pl-9 pr-10 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#14532d] focus:border-[#14532d] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-emerald-900 transition cursor-pointer"
                        tabIndex={-1}
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#14532d] hover:bg-[#0f3f22] text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-1.5"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Masuk Barista</span>
                  </button>
                </form>

                {/* Option 2: Google OAuth for Barista */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleLogin("barista")}
                    disabled={isLoggingIn}
                    className="w-full flex justify-center items-center py-2 px-4 border border-emerald-800/25 rounded-xl text-xs font-bold bg-white text-slate-800 hover:bg-emerald-50/60 transition cursor-pointer disabled:opacity-60 shadow-2xs"
                  >
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-emerald-950">
                      🔗 Masuk Barista via Akun Google (Sinkron Otomatis)
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Footer privacy guarantee */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center flex items-center justify-center space-x-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#14532d] shrink-0" />
              <span>
                Sistem Enkripsi Sesi Client-Side & Google Cloud Terproteksi
              </span>
            </div>
          </div>
        </div>
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
            Untuk menyimpan riwayat Arus Kas secara otomatis, mari siapkan
            Google Spreadsheet Anda.
          </p>

          <div className="mt-6 bg-white p-6 rounded border border-slate-200 shadow-sm text-left space-y-4">
            {/* Loading Search State */}
            {isSearchingSheet && (
              <div className="py-4 text-center space-y-2">
                <RefreshCw className="h-6 w-6 text-slate-900 animate-spin mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Mencari spreadsheet di Google Drive Anda...
                </p>
              </div>
            )}

            {/* Found existing sheet */}
            {!isSearchingSheet && foundSheetInfo && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3 animate-fade-in">
                <div className="flex items-start space-x-2.5">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900">
                      Ditemukan Spreadsheet yang Cocok!
                    </h4>
                    <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                      Spreadsheet sebelumnya terdeteksi di Google Drive Anda:
                    </p>
                    <p className="text-[11px] font-bold text-slate-750 mt-2 font-mono truncate max-w-[285px]">
                      📁 {foundSheetInfo.name}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2.5 pt-1">
                  <button
                    onClick={() =>
                      handleSelectExistingSheet(
                        foundSheetInfo.id,
                        foundSheetInfo.name,
                      )
                    }
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
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Buat Spreadsheet Baru
                  </h4>
                  <p className="text-[10.5px] text-slate-400 font-medium mt-1">
                    Kami akan membuat file spreadsheet baru bernama{" "}
                    <span className="font-bold text-slate-800">
                      "Dasbor Arus Kas Keuangan"
                    </span>{" "}
                    lengkap dengan kolom (Tanggal, Debit, Kredit, Jenis
                    Pengeluaran, Keterangan) dan beberapa data contoh untuk
                    visualisasi instan.
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
              <span className="text-slate-400 font-bold lowercase tracking-normal">
                Akun: {user.email}
              </span>
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
      title:
        userRole === "manager"
          ? "Dashboard Pencatatan Harian"
          : "Dasbor Utama & Arus Kas",
      subtitle:
        userRole === "manager"
          ? "Pencatatan transaksi harian & arus kas operasional cafe"
          : "Ringkasan pemasukan, pengeluaran & saldo harian cafe",
    },
    employee_tasks: {
      title:
        userRole === "barista"
          ? "Tugas & SOP Barista"
          : userRole === "manager"
            ? "Tugas Karyawan"
            : "Pencatatan Tugas Karyawan",
      subtitle:
        userRole === "barista"
          ? "Checklist harian tugas barista & SOP operasional bar"
          : "Manajemen tugas staf, alokasi upah/gaji & sinkronisasi Google Sheets",
    },
    calendar_notes: {
      title: "Catatan & Agenda Kalender",
      subtitle:
        "Kalender kegiatan cafe, checklist operasional, audit, dan pengingat H-1 otomatis",
    },
    barista_schedule: {
      title:
        userRole === "barista"
          ? "Jadwal Shift & Slip Gaji"
          : userRole === "manager"
            ? "Jadwal Operasional"
            : "Jadwal Operasional Basco Coffee",
      subtitle:
        userRole === "barista"
          ? "Roster jam kerja, shift bar & unduh slip gaji"
          : "Manajemen roster mingguan, pembagian shift bar & estimasi gaji tim",
    },
    omset_cogs: {
      title:
        userRole === "barista"
          ? "Pencatatan Penjualan & Jatah Harian"
          : userRole === "manager"
            ? "Penjualan Menu"
            : "Analisis COGS & Sales (Aplikasi 2)",
      subtitle:
        userRole === "barista"
          ? "Form input harian porsi terjual & jatah barista"
          : userRole === "manager"
            ? "Catatan penjualan menu harian, rekapitulasi porsi & integrasi Excel"
            : "Laporan omset harian, food cost, margin keuntungan, dan target sales",
    },
    cogs: {
      title:
        userRole === "barista" ? "Stok Opname & Resep" : "Stok Opname Bulanan",
      subtitle:
        userRole === "barista"
          ? "Audit persediaan bahan baku bar & cek resep minuman"
          : "Pencatatan persediaan bahan baku, stok masuk, stok akhir & audit bulanan",
    },
    shopping_report: {
      title: "Bahan yang Harus Dibelanjakan (Sheet 4)",
      subtitle:
        "Laporan pengadaan stok & notifikasi belanja bahan terintegrasi dengan spreadsheet Sheet 4",
    },
    categories: {
      title: "Kategori Pengeluaran",
      subtitle:
        "Rincian alokasi biaya operasional, bahan baku, dan pemeliharaan bar",
    },
    fixed_cost: {
      title: "Simulasi Biaya Tetap & BEP",
      subtitle: "Kalkulasi Break Even Point, sewa tempat, listrik & gaji tetap",
    },
    debt_tracker: {
      title: "Pencatatan Hutang & Liabilitas Cafe",
      subtitle:
        "Kalkulasi cicilan bulanan & tahunan, notifikasi jatuh tempo pembayaran, serta otomasi AI kelayakan berhutang",
    },
    ai_chat: {
      title: "Tanya AI Analyst Cafe",
      subtitle:
        "Asisten AI cerdas untuk efisiensi operasional & konsultasi finansial",
    },
    usage_history: {
      title: "Riwayat Penggunaan Aplikasi",
      subtitle:
        "Pantau jejak aktivitas 3 role (Owner, Manajer, Barista) secara real-time (Khusus Owner)",
    },
  };

  const currentTabInfo = tabTitles[activeTab] || tabTitles.dashboard;

  return (
    <div
      className="min-h-screen bg-slate-100/70 font-sans flex text-slate-800"
      id="app-root"
    >
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
        userRole={userRole}
        onLogoutManager={handleLogoutManager}
        onLoginGoogle={handleLogin}
        onOpenBackupModal={() => setIsGlobalBackupModalOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main Content Area with Dynamic Left Padding on Desktop */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
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
                title={
                  isSidebarCollapsed
                    ? "Perluas Sidebar (Expand)"
                    : "Kecilkan Sidebar (Minimize)"
                }
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
              {/* Connected Google Sheet pill (Desktop - Owner only) */}
              {userRole === "owner" && spreadsheetName && (
                <div className="hidden md:flex items-center space-x-2 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <a
                    href={spreadsheetUrl || "#"}
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

              {/* Quick Backup JSON button (Available for Owner) */}
              {userRole === "owner" && (
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

              {/* Shopping Notification Button (Sheet 4) */}
              {userRole !== "barista" && shoppingUrgentCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("shopping_report")}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer animate-pulse"
                  title={`${shoppingUrgentCount} bahan mendesak perlu dibelanjakan (Sheet 4)`}
                >
                  <ShoppingCart className="h-3.5 w-3.5 text-rose-600" />
                  <span>{shoppingUrgentCount} Belanja</span>
                </button>
              )}

              {/* Sync Button */}
              {userRole !== "barista" && spreadsheetName && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isLoadingData}
                  className={`p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-200 bg-white transition flex items-center justify-center cursor-pointer ${
                    isLoadingData ? "cursor-wait bg-slate-100" : ""
                  }`}
                  title="Sinkronisasi Data Google Sheets"
                  id="sync-button"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoadingData ? "animate-spin text-amber-600" : ""}`}
                  />
                </button>
              )}

              {/* Role Badge indicator */}
              <div
                className={`hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold uppercase tracking-wider border shadow-2xs ${
                  userRole === "owner"
                    ? "bg-purple-100 border-purple-300 text-purple-900"
                    : userRole === "barista"
                      ? "bg-sky-100 border-sky-300 text-sky-900"
                      : "bg-amber-100 border-amber-300 text-amber-900"
                }`}
              >
                <span>
                  {userRole === "owner"
                    ? "👑 Akses Owner"
                    : userRole === "barista"
                      ? "☕ Akses Barista"
                      : "👔 Akses Manajer"}
                </span>
              </div>
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
              <p className="text-xs font-bold text-slate-600">
                Mengambil data terbaru dari Google Sheets...
              </p>
            </div>
          ) : activeTab === "dashboard" ? (
            <Dashboard
              transactions={transactions}
              onAddTransaction={handleAddClick}
              onEditTransaction={handleEditClick}
              onDeleteTransaction={handleDeleteTransaction}
              spreadsheetUrl={spreadsheetUrl}
              categories={categories}
              onManageCategories={() => setIsCategoryManagerOpen(true)}
              onNavigateToDebt={
                userRole === "owner"
                  ? () => setActiveTab("debt_tracker")
                  : undefined
              }
              onNavigateToShopping={() => setActiveTab("shopping_report")}
              onRefresh={handleRefresh}
              isLoadingData={isLoadingData}
            />
          ) : activeTab === "employee_tasks" ? (
            <EmployeeTaskPage
              spreadsheetId={spreadsheetId}
              spreadsheetName={spreadsheetName}
              spreadsheetUrl={userRole === "owner" ? spreadsheetUrl : null}
              token={token}
              isManagerMode={Boolean(
                !spreadsheetId || spreadsheetId.startsWith("local_"),
              )}
            />
          ) : activeTab === "omset_cogs" ? (
            <CogsDailySalesPage
              spreadsheetId={spreadsheetId}
              spreadsheetName={spreadsheetName}
              spreadsheetUrl={userRole === "owner" ? spreadsheetUrl : null}
              token={token}
              user={user}
              userRole={userRole}
            />
          ) : activeTab === "barista_schedule" ? (
            <BaristaSchedulePage
              transactions={transactions}
              categories={categories}
              spreadsheetId={spreadsheetId}
              token={token}
            />
          ) : activeTab === "cogs" ? (
            <StockOpnamePage
              transactions={transactions}
              spreadsheetId={spreadsheetId}
              token={token}
            />
          ) : activeTab === "shopping_report" ? (
            <ShoppingReportPage
              spreadsheetId={spreadsheetId}
              spreadsheetName={spreadsheetName}
              spreadsheetUrl={userRole === "owner" ? spreadsheetUrl : null}
              token={token}
              isManagerMode={Boolean(
                !spreadsheetId || spreadsheetId.startsWith("local_"),
              )}
              onNavigateToIncomingGoods={() => setActiveTab("omset_cogs")}
            />
          ) : activeTab === "calendar_notes" ? (
            <CalendarNotesPage
              spreadsheetId={spreadsheetId}
              spreadsheetName={spreadsheetName}
              spreadsheetUrl={spreadsheetUrl}
              token={token}
              isManagerMode={Boolean(
                !spreadsheetId || spreadsheetId.startsWith("local_"),
              )}
            />
          ) : activeTab === "categories" ? (
            <CategoryExpenses
              transactions={transactions}
              categories={categories}
              onBackToDashboard={() => setActiveTab("dashboard")}
            />
          ) : activeTab === "fixed_cost" ? (
            <FixedCostSimulator />
          ) : activeTab === "debt_tracker" ? (
            <DebtTrackerPage
              transactions={transactions}
              spreadsheetId={spreadsheetId}
              spreadsheetUrl={userRole === "owner" ? spreadsheetUrl : null}
              token={token}
            />
          ) : activeTab === "ai_chat" ? (
            <AiChat transactions={transactions} />
          ) : activeTab === "usage_history" && userRole === "owner" ? (
            <UsageHistoryPage />
          ) : (
            <Dashboard
              transactions={transactions}
              onAddTransaction={handleAddClick}
              onEditTransaction={handleEditClick}
              onDeleteTransaction={handleDeleteTransaction}
              spreadsheetUrl={spreadsheetUrl}
              categories={categories}
              onManageCategories={() => setIsCategoryManagerOpen(true)}
              onNavigateToDebt={
                userRole === "owner"
                  ? () => setActiveTab("debt_tracker")
                  : undefined
              }
              onNavigateToShopping={() => setActiveTab("shopping_report")}
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
              <span className="text-slate-900 font-bold font-sans">
                Basco Cashflow Dashboard
              </span>
              <span>- Platform Manajemen Terpadu Cafe & Barista.</span>
            </div>
            <div>
              <span className="text-slate-400">
                Terhubung Google Sheets API
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
