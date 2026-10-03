import { Fragment, useCallback, useEffect, useSyncExternalStore } from 'react';
import { Truck, ChevronLeft, ChevronRight, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth/AuthContext';

export type SidebarMenuItem = { id: string; label: string; icon: LucideIcon };

interface SidebarProps {
  items: SidebarMenuItem[];
  /** Desktop (lg and up) rail state — persisted by the shell. */
  collapsed: boolean;
  /** Off-canvas drawer state below lg. */
  mobileOpen: boolean;
  activeItem: string;
  onToggleCollapsed: () => void;
  onMobileClose: () => void;
  onSetActive: (item: string) => void;
}

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

const initialsOf = (name?: string | null): string => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HA';
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
};

const roleLabel = (role?: string | null): string =>
  role ? role.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

export function Sidebar({
  items,
  collapsed,
  mobileOpen,
  activeItem,
  onToggleCollapsed,
  onMobileClose,
  onSetActive,
}: SidebarProps) {
  const { user } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // Icons-only rail: only ever on desktop. The mobile drawer always shows labels.
  const rail = collapsed && isDesktop;

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  // A drawer left open while the window grows past lg would sit on top of the
  // desktop layout — close it.
  useEffect(() => {
    if (isDesktop && mobileOpen) onMobileClose();
  }, [isDesktop, mobileOpen, onMobileClose]);

  const displayName = user?.fullName || user?.email || 'Signed in';
  const subtitle = user?.companyName || roleLabel(user?.role);

  return (
    <TooltipProvider delayDuration={0}>
      {/* Backdrop — mobile drawer only */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-300',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          'fixed left-0 top-0 z-50 h-screen flex flex-col bg-[#111111] border-r border-white/10',
          'w-[280px] transition-[transform,width] duration-300 ease-[var(--ease-expo-out)]',
          // Below lg: off-canvas drawer
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          // lg and up: always visible, expanded or rail
          'lg:translate-x-0 lg:shadow-none',
          collapsed ? 'lg:w-[80px]' : 'lg:w-[280px]'
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex items-center h-20 border-b border-white/10 shrink-0',
            rail ? 'justify-center px-2' : 'justify-between px-6'
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#111111] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-white" />
            </div>
            {!rail && (
              <span className="font-display font-bold text-xl text-white whitespace-nowrap">
                Hauliss
              </span>
            )}
          </div>
          {!rail && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapsed}
                aria-label="Collapse sidebar"
                className="hidden lg:inline-flex shrink-0 text-white/60 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMobileClose}
                aria-label="Close navigation"
                className="lg:hidden shrink-0 text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>

        {/* Expand control — rail only. Full-width and centred so it is obvious
            how to get the labels back (QA TP-NAV-02). */}
        {rail && (
          <div className="px-3 pt-3 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-label="Expand sidebar"
                  className="w-full h-10 rounded-lg bg-white/10 hover:bg-[#F97316]/30 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-3" aria-label="Sections">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              const button = (
                <button
                  type="button"
                  onClick={() => onSetActive(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={rail ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden',
                    rail ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                    isActive
                      ? 'bg-[#F97316]/20 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-5 h-5 shrink-0 transition-transform duration-200',
                      isActive && 'scale-110'
                    )}
                  />
                  {!rail && <span className="whitespace-nowrap truncate">{item.label}</span>}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#F97316] rounded-r-full" />
                  )}
                </button>
              );

              // Tooltips only make sense when the label is hidden.
              return rail ? (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <Fragment key={item.id}>{button}</Fragment>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Signed-in user */}
        <div className={cn('border-t border-white/10 shrink-0', rail ? 'p-3' : 'p-4')}>
          <div className={cn('flex items-center gap-3', rail && 'justify-center')}>
            <div
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F97316] to-[#111111] flex items-center justify-center shrink-0 overflow-hidden"
              title={rail ? `${displayName}${subtitle ? ` · ${subtitle}` : ''}` : undefined}
            >
              {user?.profilePhotoUrl ? (
                <img src={user.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">{initialsOf(user?.fullName)}</span>
              )}
            </div>
            {!rail && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                {subtitle && <p className="text-xs text-white/60 truncate">{subtitle}</p>}
              </div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
