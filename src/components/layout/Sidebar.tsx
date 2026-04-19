import { useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  ClipboardList, 
  Wallet, 
  CreditCard, 
  FileText, 
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  BarChart3,
  MapPin,
  ShieldCheck,
  Route
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  isOpen: boolean;
  activeItem: string;
  onToggle: () => void;
  onSetActive: (item: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'drivers', label: 'Drivers', icon: Truck },
  { id: 'fleet', label: 'Fleet Management', icon: Building2 },
  { id: 'routes', label: 'Service Routes', icon: Route },
  { id: 'bookings', label: 'Bookings', icon: ClipboardList },
  { id: 'tracking', label: 'Live Tracking', icon: MapPin },
  { id: 'wallet', label: 'Wallets', icon: Wallet },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'pricing', label: 'Pricing', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'support', label: 'Support', icon: MessageSquare },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings }
];

export function Sidebar({ isOpen, activeItem, onToggle, onSetActive }: SidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.style.setProperty('--sidebar-width', isOpen ? '280px' : '80px');
    }
  }, [isOpen]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        ref={sidebarRef}
        className={cn(
          'fixed left-0 top-0 z-50 h-screen bg-[#111111] border-r border-white/10 transition-all duration-300 ease-[var(--ease-expo-out)]',
          'hidden lg:flex flex-col'
        )}
        style={{ width: 'var(--sidebar-width, 280px)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#111111] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span 
              className={cn(
                'font-display font-bold text-xl text-white transition-all duration-300',
                !isOpen && 'opacity-0 w-0 overflow-hidden'
              )}
            >
              Hauliss
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="shrink-0 text-white/60 hover:text-white hover:bg-white/10"
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;
              
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSetActive(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden',
                        isActive 
                          ? 'bg-[#F97316]/20 text-white' 
                          : 'text-white/60 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <Icon className={cn(
                        'w-5 h-5 shrink-0 transition-transform duration-200',
                        isActive && 'scale-110'
                      )} />
                      <span 
                        className={cn(
                          'transition-all duration-300 whitespace-nowrap',
                          !isOpen && 'opacity-0 w-0 overflow-hidden'
                        )}
                      >
                        {item.label}
                      </span>
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#F97316] rounded-r-full" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="lg:hidden">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Profile */}
        <div className="border-t border-white/10 p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F97316] to-[#111111] flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-semibold">AD</span>
            </div>
            <div 
              className={cn(
                'transition-all duration-300',
                !isOpen && 'opacity-0 w-0 overflow-hidden'
              )}
            >
              <p className="text-sm font-medium text-white">Admin User</p>
              <p className="text-xs text-white/60">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
