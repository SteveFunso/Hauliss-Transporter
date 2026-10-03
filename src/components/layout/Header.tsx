import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Bell,
  Menu,
  Moon,
  Sun,
  LogOut,
  User as UserIcon,
  Settings as SettingsIcon,
  KeyRound,
  Loader2,
  Pencil,
  Users,
  Truck,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api/client';
import {
  fetchRecentNotifications,
  notificationTime,
  type AdminNotification,
} from '@/lib/api/notifications';
import type { SidebarMenuItem } from '@/components/layout/Sidebar';

// ─── Types ──────────────────────────────────────────────────────────────────

export type NavigateOptions = {
  /** Remount the section even when it is already active (so mount-time readers such as sessionStorage hand-offs run again). */
  remount?: boolean;
};

interface HeaderProps {
  /** The navigable sections (same list the sidebar renders) — searchable by name. */
  sections: SidebarMenuItem[];
  sidebarCollapsed: boolean;
  onOpenMobileSidebar: () => void;
  pageTitle: string;
  onNavigate: (section: string, options?: NavigateOptions) => void;
}

type Theme = 'light' | 'dark';

type SearchRow = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const THEME_KEY = 'hauliss_theme';
const SEARCH_KEY = 'hauliss_search';
const SETTINGS_TAB_KEY = 'hauliss_settings_tab';

const SEARCH_ACTIONS: Array<{ section: string; noun: string; icon: LucideIcon }> = [
  { section: 'users', noun: 'users', icon: Users },
  { section: 'drivers', noun: 'drivers', icon: Truck },
  { section: 'bookings', noun: 'bookings', icon: ClipboardList },
];

const readStoredTheme = (): Theme => (localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');

const applyTheme = (theme: Theme) => {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

const initialsOf = (name?: string | null): string => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AD';
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
};

const roleLabel = (role?: string | null): string =>
  role ? role.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

function formatRelativeTime(ms: number | null): string {
  if (!ms) return '';
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const hrs = Math.round(diffMin / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ms).toLocaleDateString();
}

function ProfileField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium truncate', mono && 'font-mono text-xs', !value && 'text-muted-foreground font-normal')}>
        {value || '—'}
      </dd>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

export function Header({ sections, sidebarCollapsed, onOpenMobileSidebar, pageTitle, onNavigate }: HeaderProps) {
  const { user, logout, refreshUser } = useAuth();

  // Theme (the stored preference is applied on load by App)
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  // Notifications
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      setNotifications(await fetchRecentNotifications(8));
      setNotifError(null);
    } catch (err) {
      setNotifError(errorMessage(err, 'Could not load notifications'));
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unread = notifications.filter((n) => !n.is_read).length;

  // Search
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const term = query.trim();

  const rows: SearchRow[] = useMemo(() => {
    if (term.length < 2) return [];
    const lower = term.toLowerCase();
    const sectionRows: SearchRow[] = sections
      .filter((m) => m.label.toLowerCase().includes(lower) || m.id.includes(lower))
      .map((m) => ({
        key: `section:${m.id}`,
        label: m.label,
        hint: 'Open section',
        icon: m.icon,
        run: () => onNavigate(m.id),
      }));
    const actionRows: SearchRow[] = SEARCH_ACTIONS.map((a) => ({
      key: `search:${a.section}`,
      label: `Search ${a.noun} for “${term}”`,
      hint: 'Search',
      icon: a.icon,
      run: () => {
        sessionStorage.setItem(SEARCH_KEY, term);
        onNavigate(a.section, { remount: true });
      },
    }));
    return [...sectionRows, ...actionRows];
  }, [term, sections, onNavigate]);

  useEffect(() => {
    setActiveRow(0);
  }, [term]);

  const showResults = searchOpen && rows.length > 0;

  const runRow = (row: SearchRow | undefined) => {
    if (!row) return;
    setQuery('');
    setSearchOpen(false);
    searchInputRef.current?.blur();
    row.run();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
      searchInputRef.current?.blur();
      return;
    }
    if (!showResults) {
      if (e.key === 'Enter' && rows.length) {
        e.preventDefault();
        runRow(rows[0]);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveRow((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveRow((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runRow(rows[activeRow] ?? rows[0]);
    }
  };

  // Profile dialog
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });

  const openProfile = () => {
    setForm({ fullName: user?.fullName || '', phone: user?.phoneNumber || '' });
    setEditing(false);
    setProfileOpen(true);
  };

  const startEditing = () => {
    setForm({ fullName: user?.fullName || '', phone: user?.phoneNumber || '' });
    setEditing(true);
  };

  const saveProfile = async () => {
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    if (fullName.length < 2) {
      toast.error('Please enter your full name');
      return;
    }
    if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/api/auth/profile', { full_name: fullName, phone_number: phone });
      await refreshUser({ fullName, phoneNumber: phone });
      toast.success('Profile updated');
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const goToChangePassword = () => {
    sessionStorage.setItem(SETTINGS_TAB_KEY, 'security');
    setProfileOpen(false);
    onNavigate('settings', { remount: true });
  };

  const initials = initialsOf(user?.fullName);
  const displayName = user?.fullName || 'Account';
  const firstName = user?.fullName?.split(' ')[0] || 'Admin';

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-40 h-20 bg-background/80 backdrop-blur-xl border-b border-border transition-all duration-300',
        sidebarCollapsed ? 'lg:left-[80px]' : 'lg:left-[280px]'
      )}
    >
      <div className="h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenMobileSidebar}
            className="lg:hidden shrink-0"
            aria-label="Open navigation"
            aria-controls="app-sidebar"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="min-w-0">
            <h1 className="font-display font-semibold text-lg sm:text-xl text-foreground truncate min-w-0">
              {pageTitle}
            </h1>
            <p className="hidden sm:block text-sm text-muted-foreground truncate">
              Welcome back, {firstName}
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              role="combobox"
              aria-expanded={showResults}
              aria-controls="header-search-results"
              aria-autocomplete="list"
              autoComplete="off"
              placeholder="Search sections, users, drivers…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 w-56 lg:w-64 bg-muted/50 border-0"
            />
            {showResults && (
              <div
                className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden z-50"
                // Keep focus in the input so a click on a row is not preceded by blur.
                onMouseDown={(e) => e.preventDefault()}
              >
                <ul id="header-search-results" role="listbox" className="max-h-80 overflow-y-auto py-1">
                  {rows.map((row, index) => {
                    const Icon = row.icon;
                    const active = index === activeRow;
                    return (
                      <li
                        key={row.key}
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveRow(index)}
                        onClick={() => runRow(row)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 text-sm cursor-pointer',
                          active ? 'bg-[#F97316]/10' : 'hover:bg-muted/60'
                        )}
                      >
                        <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-[#F97316]' : 'text-muted-foreground')} />
                        <span className="flex-1 truncate">{row.label}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{row.hint}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          {/* Notifications */}
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) void loadNotifications();
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground"
                aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
              >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <Badge className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center text-[10px] bg-[#F97316] text-white border-0">
                    {unread > 99 ? '99+' : unread}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <p className="font-semibold">Notifications</p>
                {unread > 0 && <span className="text-xs text-muted-foreground">{unread} unread</span>}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifLoading && notifications.length === 0 ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : notifError ? (
                  <div className="p-4 text-sm text-red-600">{notifError}</div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-sm text-center text-muted-foreground">No notifications yet</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex gap-3 px-4 py-3 border-b border-border/60 last:border-0',
                        !n.is_read && 'bg-[#F97316]/5'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 w-2 h-2 rounded-full shrink-0',
                          n.is_read ? 'bg-transparent' : 'bg-[#F97316]'
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm truncate', !n.is_read && 'font-medium')}>{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(notificationTime(n))}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-1.5 sm:px-2" aria-label="Account menu">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline font-medium max-w-[10rem] truncate">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                {user?.companyName && (
                  <p className="text-xs text-muted-foreground truncate">{user.companyName}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={openProfile}>
                <UserIcon className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNavigate('settings')}>
                <SettingsIcon className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onSelect={() => logout()}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Profile dialog */}
      <Dialog
        open={profileOpen}
        onOpenChange={(open) => {
          setProfileOpen(open);
          if (!open) setEditing(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">My profile</DialogTitle>
            <DialogDescription>Your account details for the transporter portal.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14">
              <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold truncate">{displayName}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              {user?.role && (
                <Badge variant="outline" className="mt-1">
                  {roleLabel(user.role)}
                </Badge>
              )}
            </div>
          </div>

          {editing ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profile-full-name">Full name</Label>
                <Input
                  id="profile-full-name"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-phone">Phone number</Label>
                <Input
                  id="profile-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+234…"
                  autoComplete="tel"
                />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <ProfileField label="Full name" value={user?.fullName} />
              <ProfileField label="Email" value={user?.email} />
              <ProfileField label="Phone" value={user?.phoneNumber} />
              <ProfileField label="Role" value={roleLabel(user?.role)} />
              <ProfileField label="Company" value={user?.companyName} />
              <ProfileField label="Transporter ID" value={user?.transporterId} mono />
            </dl>
          )}

          <DialogFooter className="sm:justify-between gap-2">
            <Button variant="outline" onClick={goToChangePassword} className="gap-2">
              <KeyRound className="w-4 h-4" />
              Change password
            </Button>
            {editing ? (
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
                  onClick={saveProfile}
                  disabled={saving}
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
            ) : (
              <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2" onClick={startEditing}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
