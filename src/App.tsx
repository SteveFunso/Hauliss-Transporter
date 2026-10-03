import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Users as UsersIcon,
  Truck,
  ClipboardList,
  Wallet as WalletIcon,
  CreditCard,
  FileText,
  MessageSquare,
  Settings as SettingsIcon,
  Building2,
  BarChart3,
  MapPin,
  ShieldCheck,
  Route as RouteIcon,
} from 'lucide-react';
import { Sidebar, type SidebarMenuItem } from '@/components/layout/Sidebar';
import { Header, type NavigateOptions } from '@/components/layout/Header';
import { Dashboard } from '@/sections/Dashboard';
import { Users } from '@/sections/Users';
import { Drivers } from '@/sections/Drivers';
import { Fleet } from '@/sections/Fleet';
import { LiveTracking } from '@/sections/LiveTracking';
import { Bookings } from '@/sections/Bookings';
import { Wallet } from '@/sections/Wallet';
import { Pricing } from '@/sections/Pricing';
import { Reports } from '@/sections/Reports';
import { Compliance } from '@/sections/Compliance';
import { Support } from '@/sections/Support';
import { Settings } from '@/sections/Settings';
import { Routes } from '@/sections/Routes';
import Login from '@/sections/Login';
import Register from '@/sections/Register';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

const sectionComponents: Record<string, React.ReactNode> = {
  dashboard: <Dashboard />,
  users: <Users />,
  drivers: <Drivers />,
  fleet: <Fleet />,
  routes: <Routes />,
  bookings: <Bookings />,
  // QA 2026-09: was `<Fleet />` — the Live Tracking nav item re-rendered Fleet Management.
  tracking: <LiveTracking />,
  wallet: <Wallet />,
  payments: <Wallet />,
  pricing: <Pricing />,
  reports: <Reports />,
  support: <Support />,
  // BUG-006: was `<Reports />` — the Compliance nav item literally re-rendered
  // the Reports page. Now a real driver-document compliance view.
  compliance: <Compliance />,
  settings: <Settings />,
};

const sectionTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  drivers: 'Drivers',
  fleet: 'Fleet Management',
  routes: 'Service Routes',
  bookings: 'Bookings',
  tracking: 'Live Tracking',
  wallet: 'Wallets & Payments',
  payments: 'Payments',
  pricing: 'Pricing Configuration',
  reports: 'Reports & Analytics',
  support: 'Support Tickets',
  compliance: 'Compliance',
  settings: 'Settings',
};

// The 14 navigable sections — drives the sidebar and the header search.
const menuItems: SidebarMenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: UsersIcon },
  { id: 'drivers', label: 'Drivers', icon: Truck },
  { id: 'fleet', label: 'Fleet Management', icon: Building2 },
  { id: 'routes', label: 'Service Routes', icon: RouteIcon },
  { id: 'bookings', label: 'Bookings', icon: ClipboardList },
  { id: 'tracking', label: 'Live Tracking', icon: MapPin },
  { id: 'wallet', label: 'Wallets', icon: WalletIcon },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'pricing', label: 'Pricing', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'support', label: 'Support', icon: MessageSquare },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const DEFAULT_SECTION = 'dashboard';
const SECTION_IDS = new Set(Object.keys(sectionComponents));
const SIDEBAR_COLLAPSED_KEY = 'hauliss_sidebar_collapsed';
const THEME_KEY = 'hauliss_theme';

/** `#bookings` → 'bookings'; anything unknown (or no hash) → dashboard. */
function sectionFromHash(): string {
  const raw = window.location.hash
    .replace(/^#\/?/, '')
    .split(/[/?&]/)[0]
    .trim()
    .toLowerCase();
  return SECTION_IDS.has(raw) ? raw : DEFAULT_SECTION;
}

/**
 * The authenticated shell: sidebar + header + active section. Mounted only
 * while signed in, so drawer/section state naturally resets on logout.
 */
function Shell() {
  // Desktop rail state (persisted) and the separate mobile drawer state.
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  // The URL hash is the source of truth for the active section so Back/Forward
  // and deep links work (#dashboard, #users, …).
  const [activeSection, setActiveSection] = useState<string>(sectionFromHash);
  const [sectionNonce, setSectionNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const activeRef = useRef(activeSection);

  useEffect(() => {
    activeRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  const navigate = useCallback((section: string, options?: NavigateOptions) => {
    const next = SECTION_IDS.has(section) ? section : DEFAULT_SECTION;
    if (options?.remount && activeRef.current === next) {
      setSectionNonce((n) => n + 1);
    }
    setActiveSection(next);
    if (window.location.hash !== `#${next}`) {
      window.location.hash = next;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => setActiveSection(sectionFromHash());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${sectionFromHash()}`);
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Cross-section navigation events (e.g. Dashboard tiles).
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const section = (e as CustomEvent<string>).detail;
      if (section) navigate(section);
    };
    window.addEventListener('navigate:section', handleNavigate);
    return () => window.removeEventListener('navigate:section', handleNavigate);
  }, [navigate]);

  const handleSetActiveSection = (section: string) => {
    navigate(section);
    setMobileOpen(false);
  };

  return (
    <div className={cn(
      'min-h-screen bg-background transition-all duration-300',
      isLoading && 'opacity-0'
    )}>
      <Sidebar
        items={menuItems}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        activeItem={activeSection}
        onToggleCollapsed={toggleCollapsed}
        onMobileClose={closeMobile}
        onSetActive={handleSetActiveSection}
      />

      <main className={cn(
        'min-h-screen min-w-0 transition-all duration-300',
        collapsed ? 'lg:ml-[80px]' : 'lg:ml-[280px]'
      )}>
        <Header
          sections={menuItems}
          sidebarCollapsed={collapsed}
          onOpenMobileSidebar={openMobile}
          pageTitle={sectionTitles[activeSection] || 'Dashboard'}
          onNavigate={navigate}
        />

        <div key={sectionNonce} className="pt-20">
          {sectionComponents[activeSection] || <Dashboard />}
        </div>
      </main>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#000000] via-[#111111] to-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Honour ?route=register from marketing-site deep links, plus support
    // toggling between Login <-> Register via state. Default is Login.
    return <UnauthenticatedSwitcher />;
  }

  return <Shell />;
}

// Switches between Login and Register for unauthenticated users.
// Initial mode honours ?route=register on the URL (used by the marketing site's
// "Become a Transporter" CTA) and falls back to Login.
function UnauthenticatedSwitcher() {
  const initial =
    typeof window !== 'undefined' &&
    window.location.search.includes('route=register')
      ? 'register'
      : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initial as any);

  if (mode === 'register') {
    return <Register onBackToLogin={() => setMode('login')} />;
  }
  return <Login onCreateAccount={() => setMode('register')} />;
}

function App() {
  // Persisted dark/light preference must win before the first paint of any
  // section (the header toggle writes the same key).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', localStorage.getItem(THEME_KEY) === 'dark');
  }, []);

  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
