import { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Bell,
  Shield,
  CreditCard,
  Users,
  Globe,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  Building2,
  UserPlus,
  Landmark,
  KeyRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/lib/auth/AuthContext';
import { changePassword } from '@/lib/api/auth';
import {
  getCompany,
  updateCompany,
  isNoCompanyError,
  NO_COMPANY_MESSAGE,
  type Company,
  type CompanyProfileUpdate,
  type CompanyNotificationSettings,
  type CompanyBankSettings,
  type RolePermissions,
} from '@/lib/api/company';
import { createUser, type CreatedUser } from '@/lib/api/users';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Tabs. The "API & Integrations" tab was removed (QA TP-SET-01): API keys and
// gateway toggles are platform concerns, not company settings.
// ---------------------------------------------------------------------------
const settingsTabs = [
  { id: 'general', name: 'General', icon: Globe },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'payment', name: 'Payment', icon: CreditCard },
  { id: 'team', name: 'Team', icon: Users },
] as const;
type SettingsTab = (typeof settingsTabs)[number]['id'];

const SETTINGS_TAB_KEY = 'hauliss_settings_tab';

// Other sections deep-link here via sessionStorage; accept a few synonyms.
const TAB_ALIASES: Record<string, SettingsTab> = {
  users: 'team',
  'user-management': 'team',
  members: 'team',
  password: 'security',
  '2fa': 'security',
  bank: 'payment',
  payout: 'payment',
  payouts: 'payment',
  payments: 'payment',
  profile: 'general',
  company: 'general',
};

const resolveTab = (value: string | null): SettingsTab | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (settingsTabs.some((t) => t.id === v)) return v as SettingsTab;
  return TAB_ALIASES[v] ?? null;
};

// ---------------------------------------------------------------------------
// Form models
// ---------------------------------------------------------------------------
type ProfileForm = {
  company_name: string;
  trading_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  state: string;
  registration_number: string;
  tax_id: string;
  logo_url: string;
};

const PROFILE_FIELDS: (keyof ProfileForm)[] = [
  'company_name', 'trading_name', 'contact_email', 'contact_phone', 'address',
  'city', 'state', 'registration_number', 'tax_id', 'logo_url',
];

const emptyProfile: ProfileForm = {
  company_name: '', trading_name: '', contact_email: '', contact_phone: '', address: '',
  city: '', state: '', registration_number: '', tax_id: '', logo_url: '',
};

const profileFromCompany = (c: Company): ProfileForm => ({
  company_name: c.company_name ?? '',
  trading_name: c.trading_name ?? '',
  contact_email: c.contact_email ?? '',
  contact_phone: c.contact_phone ?? '',
  address: c.address ?? '',
  city: c.city ?? '',
  state: c.state ?? '',
  registration_number: c.registration_number ?? '',
  tax_id: c.tax_id ?? '',
  logo_url: c.logo_url ?? '',
});

// UI defaults for preferences the company has not set yet (everything on
// except SMS). Only explicitly toggled values are ever written back.
const DEFAULT_NOTIFICATIONS: CompanyNotificationSettings = {
  email: true,
  push: true,
  sms: false,
  booking_updates: true,
  driver_alerts: true,
  payment_notifications: true,
};

const NOTIFICATION_ROWS: {
  key: keyof CompanyNotificationSettings;
  title: string;
  description: string;
  group: 'channel' | 'type';
}[] = [
  { key: 'email', title: 'Email Notifications', description: 'Receive notifications via email', group: 'channel' },
  { key: 'push', title: 'Push Notifications', description: 'Receive push notifications', group: 'channel' },
  { key: 'sms', title: 'SMS Notifications', description: 'Receive SMS notifications', group: 'channel' },
  { key: 'booking_updates', title: 'Booking Updates', description: 'New bookings, status changes', group: 'type' },
  { key: 'driver_alerts', title: 'Driver Alerts', description: 'Driver status, documents', group: 'type' },
  { key: 'payment_notifications', title: 'Payment Notifications', description: 'Payments, payouts, refunds', group: 'type' },
];

const emptyBank: CompanyBankSettings = { bank_name: '', account_number: '', account_name: '' };

const bankFromCompany = (c: Company): CompanyBankSettings => ({
  bank_name: c.settings?.bank?.bank_name ?? '',
  account_number: c.settings?.bank?.account_number ?? '',
  account_name: c.settings?.bank?.account_name ?? '',
});

// Team roles a company admin may create. Drivers are invited from the Drivers
// page; company_owner is assigned from the Users page.
const TEAM_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to this company workspace' },
  { value: 'fleet_manager', label: 'Fleet Manager', description: 'Manage fleet and drivers' },
  { value: 'support', label: 'Support', description: 'Handle support tickets' },
] as const;

const PERMISSION_KEYS = [
  'view_dashboard', 'manage_drivers', 'manage_bookings', 'manage_fleet',
  'manage_payments', 'manage_support', 'manage_settings', 'manage_users',
] as const;

const permissionSet = (enabled: readonly string[]): Record<string, boolean> =>
  Object.fromEntries(PERMISSION_KEYS.map((k) => [k, enabled.includes(k)]));

const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: permissionSet(PERMISSION_KEYS),
  fleet_manager: permissionSet(['view_dashboard', 'manage_drivers', 'manage_bookings', 'manage_fleet']),
  support: permissionSet(['view_dashboard', 'manage_support']),
};

// Server-persisted permissions overlay the defaults so new permission keys
// always show up (as off) for roles saved before they existed.
const mergeRolePermissions = (saved?: RolePermissions | null): RolePermissions =>
  Object.fromEntries(
    TEAM_ROLES.map((r) => [r.value, { ...DEFAULT_ROLE_PERMISSIONS[r.value], ...(saved?.[r.value] ?? {}) }])
  );

// Drop null/undefined entries so partial server objects never blank a toggle.
const compact = <T extends object>(obj: T | null | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj ?? {}).filter(([, v]) => v !== null && v !== undefined)
  ) as Partial<T>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const humanize = (value?: string | null) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const statusBadgeClass = (value?: string | null) => {
  switch (String(value || '').toLowerCase()) {
    case 'active':
    case 'verified':
    case 'approved':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
    case 'pending':
    case 'under_review':
    case 'in_review':
    case 'submitted':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
    case 'suspended':
    case 'rejected':
    case 'inactive':
    case 'blocked':
      return 'bg-red-100 text-red-700 hover:bg-red-100';
    default:
      return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
  }
};

const selectClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20';

export function Settings() {
  const { user } = useAuth();
  const signedInEmail: string | undefined = (user as any)?.email;

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const { data: company, isLoading, error, refetch } = useApi(() => getCompany(), []);
  // Latest persisted company (updated from PATCH responses without a refetch).
  // Falls back to the fetched record until the hydration effect has run so the
  // page never flashes an error state between "loaded" and "hydrated".
  const [current, setCurrent] = useState<Company | null>(null);
  const activeCompany = current ?? company;

  // General
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [profileSaving, setProfileSaving] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<CompanyNotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);

  // Security
  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Payment
  const [bank, setBank] = useState<CompanyBankSettings>(emptyBank);
  const [bankSaving, setBankSaving] = useState(false);

  // Team
  const [member, setMember] = useState({ email: '', full_name: '', phone_number: '', role: 'admin' });
  const [memberSaving, setMemberSaving] = useState(false);
  const [createdMember, setCreatedMember] = useState<CreatedUser | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState('');
  const [editingPermissions, setEditingPermissions] = useState<Record<string, boolean>>({});
  const [permissionsSaving, setPermissionsSaving] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

  // Deep link: other sections set sessionStorage before navigating here.
  useEffect(() => {
    const saved = sessionStorage.getItem(SETTINGS_TAB_KEY);
    if (saved === null) return;
    sessionStorage.removeItem(SETTINGS_TAB_KEY);
    const tab = resolveTab(saved);
    if (tab) setActiveTab(tab);
  }, []);

  const hydrateFromCompany = useCallback((c: Company) => {
    setCurrent(c);
    setProfile(profileFromCompany(c));
    setNotifications({ ...DEFAULT_NOTIFICATIONS, ...compact(c.settings?.notifications) });
    setTwoFactor(Boolean(c.settings?.security?.two_factor));
    setBank(bankFromCompany(c));
    setRolePermissions(mergeRolePermissions(c.settings?.role_permissions));
  }, []);

  useEffect(() => {
    if (company) hydrateFromCompany(company);
  }, [company, hydrateFromCompany]);

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  // ---------------------------------------------------------------- General
  const handleSaveProfile = async () => {
    if (!profile.company_name.trim()) {
      toast.error('Company name is required');
      return;
    }
    const contactEmail = profile.contact_email.trim();
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      toast.error('Enter a valid contact email address');
      return;
    }
    const logoUrl = profile.logo_url.trim();
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      toast.error('Logo URL must start with http:// or https://');
      return;
    }

    // Send only the fields that actually changed.
    const baseline = activeCompany ? profileFromCompany(activeCompany) : emptyProfile;
    const patch: CompanyProfileUpdate = {};
    for (const key of PROFILE_FIELDS) {
      const value = profile[key].trim();
      if (value !== baseline[key]) patch[key] = value;
    }
    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save');
      return;
    }

    setProfileSaving(true);
    try {
      const updated = await updateCompany(patch);
      setCurrent(updated);
      setProfile(profileFromCompany(updated));
      toast.success('Company profile saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save company profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // ---------------------------------------------------------- Notifications
  const handleToggleNotification = async (
    key: keyof CompanyNotificationSettings,
    title: string,
    checked: boolean
  ) => {
    const previous = notifications;
    setNotifications((prev) => ({ ...prev, [key]: checked }));
    setNotifSaving(key);
    try {
      const updated = await updateCompany({ settings: { notifications: { [key]: checked } } });
      setCurrent(updated);
      setNotifications((prev) => ({ ...prev, ...compact(updated.settings?.notifications) }));
      toast.success(`${title} ${checked ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      setNotifications(previous);
      toast.error(err.message || `Failed to update ${title.toLowerCase()}`);
    } finally {
      setNotifSaving(null);
    }
  };

  // --------------------------------------------------------------- Security
  const handleToggleTwoFactor = async (checked: boolean) => {
    setTwoFactor(checked);
    setTwoFactorSaving(true);
    try {
      const updated = await updateCompany({ settings: { security: { two_factor: checked } } });
      setCurrent(updated);
      setTwoFactor(updated.settings?.security?.two_factor ?? checked);
      toast.success(`Two-factor authentication ${checked ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      setTwoFactor(!checked);
      toast.error(err.message || 'Failed to update two-factor authentication');
    } finally {
      setTwoFactorSaving(false);
    }
  };

  const passwordTooShort = passwordForm.next.length > 0 && passwordForm.next.length < 8;
  const passwordMismatch = passwordForm.confirm.length > 0 && passwordForm.next !== passwordForm.confirm;

  const handleChangePassword = async () => {
    const { current: currentPassword, next, confirm } = passwordForm;
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    if (next.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (next !== confirm) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (next === currentPassword) {
      toast.error('New password must be different from your current password');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, next, confirm);
      toast.success('Password changed successfully');
      setPasswordForm({ current: '', next: '', confirm: '' });
      setShowPasswords(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  // ---------------------------------------------------------------- Payment
  const handleSaveBank = async () => {
    const bank_name = bank.bank_name.trim();
    const account_number = bank.account_number.trim();
    const account_name = bank.account_name.trim();
    if (!bank_name) {
      toast.error('Bank name is required');
      return;
    }
    if (!/^\d{10}$/.test(account_number)) {
      toast.error('Account number must be exactly 10 digits');
      return;
    }
    if (!account_name) {
      toast.error('Account name is required');
      return;
    }
    setBankSaving(true);
    try {
      const updated = await updateCompany({ settings: { bank: { bank_name, account_number, account_name } } });
      setCurrent(updated);
      setBank({ ...{ bank_name, account_number, account_name }, ...compact(updated.settings?.bank) });
      toast.success('Payout bank account saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save bank account');
    } finally {
      setBankSaving(false);
    }
  };

  // ------------------------------------------------------------------- Team
  const handleCreateMember = async () => {
    const email = member.email.trim().toLowerCase();
    const full_name = member.full_name.trim();
    if (!full_name) {
      toast.error('Full name is required');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    setMemberSaving(true);
    try {
      // No password is sent: the server generates a temporary one, emails a
      // welcome message and returns the password once.
      const created = await createUser({
        email,
        full_name,
        phone_number: member.phone_number.trim() || undefined,
        role: member.role,
      });
      setCreatedMember({ ...created, email: created?.email || email, role: created?.role || member.role });
      setMember({ email: '', full_name: '', phone_number: '', role: 'admin' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create team member');
    } finally {
      setMemberSaving(false);
    }
  };

  const handlePermissionsOpen = (role: string) => {
    setEditingRole(role);
    setEditingPermissions({ ...DEFAULT_ROLE_PERMISSIONS[role], ...(rolePermissions[role] ?? {}) });
    setPermissionsOpen(true);
  };

  const handleSavePermissions = async () => {
    setPermissionsSaving(true);
    try {
      const updated = await updateCompany({
        settings: { role_permissions: { [editingRole]: editingPermissions } },
      });
      setCurrent(updated);
      setRolePermissions(mergeRolePermissions({
        ...rolePermissions,
        [editingRole]: editingPermissions,
        ...(updated.settings?.role_permissions ?? {}),
      }));
      toast.success(`${roleLabel(editingRole)} permissions updated`);
      setPermissionsOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save permissions');
    } finally {
      setPermissionsSaving(false);
    }
  };

  const roleLabel = (role: string) => TEAM_ROLES.find((r) => r.value === role)?.label ?? humanize(role);

  // ------------------------------------------------------------- Rendering
  const header = (
    <div>
      <h2 className="font-display font-semibold text-2xl text-foreground">Settings</h2>
      <p className="text-muted-foreground mt-1">
        Manage your company profile, preferences and team
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-64 space-y-2">
            {settingsTabs.map((tab) => (
              <Skeleton key={tab.id} className="h-12 w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error && isNoCompanyError(error)) {
    return (
      <div className="p-6 space-y-6">
        {header}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-[#F97316]" />
            </div>
            <h3 className="font-display font-semibold text-lg">{NO_COMPANY_MESSAGE}</h3>
            {error.toLowerCase() !== NO_COMPANY_MESSAGE.toLowerCase() && (
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            )}
            <p className="text-sm text-muted-foreground max-w-md">
              Company settings become available once Hauliss links this admin account
              {signedInEmail ? ` (${signedInEmail})` : ''} to a transport company.
            </p>
            <Button variant="outline" className="gap-2 mt-2" onClick={refetch}>
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !activeCompany) {
    return (
      <div className="p-6 space-y-6">
        {header}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="font-medium">Failed to load company settings</p>
            <p className="text-sm text-muted-foreground max-w-md">{error || 'No company data was returned.'}</p>
            <Button variant="outline" className="gap-2 mt-2" onClick={refetch}>
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const transporterId = activeCompany.transporter_id || '';

  return (
    <div className="p-6 space-y-6">
      {header}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 space-y-2">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-[#F97316]/10 text-[#F97316]'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display font-semibold text-lg">Company Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Read-only identity */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Transporter ID</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium truncate">{transporterId || '—'}</span>
                      {transporterId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Copy Transporter ID"
                          onClick={() => copyToClipboard(transporterId, 'Transporter ID')}
                        >
                          {copied === 'Transporter ID' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge className={statusBadgeClass(activeCompany.status)}>{humanize(activeCompany.status) || 'Unknown'}</Badge>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Verification</p>
                    <Badge className={statusBadgeClass(activeCompany.verification_status)}>
                      {humanize(activeCompany.verification_status) || 'Unknown'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={profile.company_name}
                      onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tradingName">Trading Name</Label>
                    <Input
                      id="tradingName"
                      placeholder="Name shown to customers (optional)"
                      value={profile.trading_name}
                      onChange={(e) => setProfile({ ...profile, trading_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={profile.contact_email}
                      onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      value={profile.contact_phone}
                      onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Registration Number (CAC)</Label>
                    <Input
                      id="registrationNumber"
                      value={profile.registration_number}
                      onChange={(e) => setProfile({ ...profile, registration_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxId">Tax ID (TIN)</Label>
                    <Input
                      id="taxId"
                      value={profile.tax_id}
                      onChange={(e) => setProfile({ ...profile, tax_id: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Address</Label>
                  <Textarea
                    id="companyAddress"
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="logoUrl"
                      placeholder="https://..."
                      value={profile.logo_url}
                      onChange={(e) => setProfile({ ...profile, logo_url: e.target.value })}
                    />
                    {activeCompany.logo_url && (
                      <img
                        src={activeCompany.logo_url}
                        alt="Company logo"
                        className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-end border-t pt-6">
                  <Button
                    className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                  >
                    {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {profileSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display font-semibold text-lg">Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">Changes are saved immediately.</p>
                <div className="space-y-4">
                  {NOTIFICATION_ROWS.filter((r) => r.group === 'channel').map((row) => (
                    <div key={row.key} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{row.title}</p>
                        <p className="text-sm text-muted-foreground">{row.description}</p>
                      </div>
                      <Switch
                        checked={notifications[row.key]}
                        disabled={notifSaving === row.key}
                        onCheckedChange={(checked) => handleToggleNotification(row.key, row.title, checked)}
                      />
                    </div>
                  ))}
                </div>
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Notification Types</h4>
                  <div className="space-y-4">
                    {NOTIFICATION_ROWS.filter((r) => r.group === 'type').map((row) => (
                      <div key={row.key} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{row.title}</p>
                          <p className="text-sm text-muted-foreground">{row.description}</p>
                        </div>
                        <Switch
                          checked={notifications[row.key]}
                          disabled={notifSaving === row.key}
                          onCheckedChange={(checked) => handleToggleNotification(row.key, row.title, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display font-semibold text-lg">Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Two-Factor Authentication
                    </p>
                    <p className="text-sm text-muted-foreground">Require a one-time code emailed at sign-in</p>
                  </div>
                  <Switch
                    checked={twoFactor}
                    disabled={twoFactorSaving}
                    onCheckedChange={handleToggleTwoFactor}
                  />
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-1 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" /> Change Password
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {signedInEmail ? `Signed in as ${signedInEmail}. ` : ''}
                    Use at least 8 characters.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showPasswords ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Enter your current password"
                          value={passwordForm.current}
                          onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(!showPasswords)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                        >
                          {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type={showPasswords ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Enter new password"
                        value={passwordForm.next}
                        onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                        className={cn(passwordTooShort && 'border-red-400 focus-visible:ring-red-200')}
                      />
                      {passwordTooShort && (
                        <p className="text-xs text-red-600">Must be at least 8 characters</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type={showPasswords ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Confirm new password"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                        className={cn(passwordMismatch && 'border-red-400 focus-visible:ring-red-200')}
                      />
                      {passwordMismatch && (
                        <p className="text-xs text-red-600">Passwords do not match</p>
                      )}
                    </div>
                  </div>
                  <Button
                    className="mt-4 bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
                    onClick={handleChangePassword}
                    disabled={passwordSaving}
                  >
                    {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {passwordSaving ? 'Updating...' : 'Change Password'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'payment' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display font-semibold text-lg">Payment Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-1 flex items-center gap-2">
                    <Landmark className="w-4 h-4" /> Bank account for payouts
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Hauliss pays your completed-trip earnings into this account.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        placeholder="e.g. Access Bank"
                        value={bank.bank_name}
                        onChange={(e) => setBank({ ...bank, bank_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="10-digit NUBAN"
                        value={bank.account_number}
                        onChange={(e) => setBank({ ...bank, account_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className={cn(
                          bank.account_number.length > 0 && bank.account_number.length !== 10 && 'border-red-400 focus-visible:ring-red-200'
                        )}
                      />
                      {bank.account_number.length > 0 && bank.account_number.length !== 10 && (
                        <p className="text-xs text-red-600">Account number must be exactly 10 digits</p>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="accountName">Account Name</Label>
                      <Input
                        id="accountName"
                        placeholder="Name on the bank account"
                        value={bank.account_name}
                        onChange={(e) => setBank({ ...bank, account_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button
                      className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
                      onClick={handleSaveBank}
                      disabled={bankSaving}
                    >
                      {bankSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {bankSaving ? 'Saving...' : 'Save Bank Account'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'team' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display font-semibold text-lg">Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-1 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Add a team member
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    A temporary password is generated and emailed to them. Drivers are invited from the Drivers page.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="memberName">Full Name *</Label>
                      <Input
                        id="memberName"
                        placeholder="Jane Doe"
                        value={member.full_name}
                        onChange={(e) => setMember({ ...member, full_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memberEmail">Email *</Label>
                      <Input
                        id="memberEmail"
                        type="email"
                        placeholder="jane@company.com"
                        value={member.email}
                        onChange={(e) => setMember({ ...member, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memberPhone">Phone</Label>
                      <Input
                        id="memberPhone"
                        type="tel"
                        placeholder="+234 800 000 0000"
                        value={member.phone_number}
                        onChange={(e) => setMember({ ...member, phone_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memberRole">Role</Label>
                      <select
                        id="memberRole"
                        value={member.role}
                        onChange={(e) => setMember({ ...member, role: e.target.value })}
                        className={selectClass}
                      >
                        {TEAM_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
                      onClick={handleCreateMember}
                      disabled={memberSaving}
                    >
                      {memberSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {memberSaving ? 'Creating...' : 'Create Team Member'}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h4 className="font-medium">Role Permissions</h4>
                  <div className="space-y-3">
                    {TEAM_ROLES.map((role) => (
                      <div key={role.value} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{role.label}</p>
                          <p className="text-sm text-muted-foreground">{role.description}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handlePermissionsOpen(role.value)}>
                          Edit Permissions
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Permissions Editor Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={(open) => { if (!permissionsSaving) setPermissionsOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">
              Edit {roleLabel(editingRole)} Permissions
            </DialogTitle>
            <DialogDescription>Saved to your company settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {PERMISSION_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
                <Switch
                  checked={Boolean(editingPermissions[key])}
                  onCheckedChange={(checked) => setEditingPermissions((prev) => ({ ...prev, [key]: checked }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsOpen(false)} disabled={permissionsSaving}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleSavePermissions} disabled={permissionsSaving}>
              {permissionsSaving ? 'Saving...' : 'Save Permissions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time credentials dialog for a newly created team member */}
      <Dialog open={!!createdMember} onOpenChange={(open) => { if (!open) setCreatedMember(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Team member created</DialogTitle>
            <DialogDescription>
              A welcome email with sign-in instructions has been sent to {createdMember?.email}.
              {createdMember?.temporary_password
                ? ' The temporary password below is shown only once — share it securely if needed.'
                : ''}
            </DialogDescription>
          </DialogHeader>
          {createdMember && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{createdMember.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  title="Copy email"
                  onClick={() => copyToClipboard(createdMember.email, 'Email')}
                >
                  {copied === 'Email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm font-medium">{roleLabel(createdMember.role)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Temporary password</p>
                  {createdMember.temporary_password ? (
                    <p className="text-sm font-mono font-medium break-all">{createdMember.temporary_password}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sent to the member by email</p>
                  )}
                </div>
                {createdMember.temporary_password && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title="Copy temporary password"
                    onClick={() => copyToClipboard(createdMember.temporary_password as string, 'Temporary password')}
                  >
                    {copied === 'Temporary password' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={() => setCreatedMember(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
