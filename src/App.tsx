import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Dashboard } from '@/sections/Dashboard';
import { Users } from '@/sections/Users';
import { Drivers } from '@/sections/Drivers';
import { Fleet } from '@/sections/Fleet';
import { Bookings } from '@/sections/Bookings';
import { Wallet } from '@/sections/Wallet';
import { Pricing } from '@/sections/Pricing';
import { Reports } from '@/sections/Reports';
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
  tracking: <Fleet />,
  wallet: <Wallet />,
  payments: <Wallet />,
  pricing: <Pricing />,
  reports: <Reports />,
  support: <Support />,
  compliance: <Reports />,
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
  compliance: 'Compliance & Reports',
  settings: 'Settings',
};

function AppContent() {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Cross-section navigation events (e.g. Dashboard tiles). Must be declared
  // BEFORE the early returns below — hooks after a conditional return violate
  // the Rules of Hooks (React #310: more hooks after login than before).
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const section = (e as CustomEvent<string>).detail;
      if (section) setActiveSection(section);
    };
    window.addEventListener("navigate:section", handleNavigate);
    return () => window.removeEventListener("navigate:section", handleNavigate);
  }, []);

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

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSetActiveSection = (section: string) => {
    setActiveSection(section);
  };

  return (
    <div className={cn(
      'min-h-screen bg-background transition-all duration-300',
      isLoading && 'opacity-0'
    )}>
      <Sidebar
        isOpen={sidebarOpen}
        activeItem={activeSection}
        onToggle={handleToggleSidebar}
        onSetActive={handleSetActiveSection}
      />

      {!sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        />
      )}

      <main className={cn(
        'min-h-screen transition-all duration-300',
        sidebarOpen ? 'lg:ml-[280px]' : 'lg:ml-[80px]'
      )}>
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          pageTitle={sectionTitles[activeSection] || 'Dashboard'}
          user={user}
          onLogout={logout}
        />

        <div className="pt-20">
          {sectionComponents[activeSection] || <Dashboard />}
        </div>
      </main>
    </div>
  );
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
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
