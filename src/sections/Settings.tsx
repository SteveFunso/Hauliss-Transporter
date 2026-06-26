import { useState, useEffect } from 'react';
import {
  Save,
  Bell,
  Shield,
  CreditCard,
  Users,
  Globe,
  CheckCircle,
  Database,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { getSettings, updateSettings, type PlatformSettingsUpdate } from '@/lib/api/settings';
import { createUser } from '@/lib/api/users';
import { toast } from 'sonner';

const generateApiKey = (prefix: string) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = prefix;
  for (let i = 0; i < 24; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
};

const settingsTabs = [
  { id: 'general', name: 'General', icon: Globe },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'payment', name: 'Payment', icon: CreditCard },
  { id: 'users', name: 'User Management', icon: Users },
  { id: 'api', name: 'API & Integrations', icon: Database },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    notifications: {
      email: true,
      push: true,
      sms: false,
      bookingUpdates: true,
      driverAlerts: true,
      paymentNotifications: true,
    },
    security: {
      twoFactor: true,
      sessionTimeout: 30,
      passwordExpiry: 90,
    }
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [liveApiKey, setLiveApiKey] = useState('');
  const [testApiKey, setTestApiKey] = useState('');
  const [regeneratingKey, setRegeneratingKey] = useState<'live' | 'test' | null>(null);
  const [flutterwaveEnabled, setFlutterwaveEnabled] = useState(false);
  const [flutterwaveSaving, setFlutterwaveSaving] = useState(false);
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({
    'Google Maps': true,
    'Paystack': true,
    'Twilio SMS': true,
    'SendGrid Email': true,
  });
  const [integrationSaving, setIntegrationSaving] = useState<string | null>(null);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({
    view_dashboard: true,
    manage_drivers: false,
    manage_bookings: false,
    manage_fleet: false,
    manage_payments: false,
    manage_support: false,
    manage_settings: false,
    manage_users: false,
  });
  const [permissionsSaving, setPermissionsSaving] = useState(false);

  const { data: savedSettings, isLoading, refetch } = useApi(() => getSettings(), []);

  useEffect(() => {
    if (savedSettings) {
      // The server returns scalar settings either as a bare string or wrapped in
      // a {value} envelope, sometimes inconsistently. Tolerate both shapes so a
      // bare string never blanks the field.
      const readSetting = (v: any): string =>
        (typeof v === 'string' ? v : v?.value) ?? '';
      const s = savedSettings as any;
      setSettings({
        companyName: readSetting(s.platform_name),
        companyEmail: readSetting(s.platform_email ?? s.contact_email),
        companyPhone: readSetting(s.platform_phone ?? s.contact_phone),
        companyAddress: readSetting(s.company_address),
        timezone: readSetting(s.timezone) || 'Africa/Lagos',
        currency: readSetting(s.currency) || 'NGN',
        notifications: {
          email: savedSettings.notifications?.email ?? true,
          push: savedSettings.notifications?.push ?? true,
          sms: savedSettings.notifications?.sms ?? false,
          bookingUpdates: savedSettings.notifications?.booking_updates ?? true,
          driverAlerts: savedSettings.notifications?.driver_alerts ?? true,
          paymentNotifications: savedSettings.notifications?.payment_notifications ?? true,
        },
        security: {
          twoFactor: savedSettings.security?.two_factor ?? true,
          sessionTimeout: savedSettings.security?.session_timeout ?? 30,
          passwordExpiry: savedSettings.security?.password_expiry ?? 90,
        }
      });
      // Hydrate server-persisted toggles that previously reset to defaults on reload.
      setFlutterwaveEnabled(savedSettings.flutterwave_enabled ?? false);
      if (savedSettings.integrations) {
        setIntegrations((prev) => ({ ...prev, ...savedSettings.integrations }));
      }
      // Load API keys from settings if available, otherwise generate initial ones
      setLiveApiKey(s.live_api_key || generateApiKey('pk_live_'));
      setTestApiKey(s.test_api_key || generateApiKey('pk_test_'));
    }
  }, [savedSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        platform_name: settings.companyName,
        platform_email: settings.companyEmail,
        platform_phone: settings.companyPhone,
        company_address: settings.companyAddress,
        timezone: settings.timezone,
        currency: settings.currency,
        notifications: {
          email: settings.notifications.email,
          push: settings.notifications.push,
          sms: settings.notifications.sms,
          booking_updates: settings.notifications.bookingUpdates,
          driver_alerts: settings.notifications.driverAlerts,
          payment_notifications: settings.notifications.paymentNotifications,
        },
        security: {
          two_factor: settings.security.twoFactor,
          session_timeout: settings.security.sessionTimeout,
          password_expiry: settings.security.passwordExpiry,
        },
      });
      toast.success('Settings saved successfully');
      // Refetch so the form reflects persisted values and never drifts.
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    if (!newPassword.trim()) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    toast.success('Password updated');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setInviteSending(true);
    try {
      await createUser({
        email: inviteEmail,
        full_name: inviteEmail.split('@')[0],
        role: inviteRole,
        password: crypto.randomUUID().slice(0, 12),
      });
      toast.success(`User account created for ${inviteEmail}`);
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user account');
    } finally {
      setInviteSending(false);
    }
  };

  const handleRegenerateApiKey = async (type: 'live' | 'test') => {
    const newKey = generateApiKey(type === 'live' ? 'pk_live_' : 'pk_test_');
    setRegeneratingKey(type);
    try {
      const payload: any = {};
      if (type === 'live') {
        payload.live_api_key = newKey;
      } else {
        payload.test_api_key = newKey;
      }
      await updateSettings(payload as PlatformSettingsUpdate);
      if (type === 'live') setLiveApiKey(newKey);
      else setTestApiKey(newKey);
      toast.success(`${type === 'live' ? 'Live' : 'Test'} API key regenerated`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate API key');
    } finally {
      setRegeneratingKey(null);
    }
  };

  const handleToggleIntegration = async (name: string, checked: boolean) => {
    setIntegrationSaving(name);
    const updatedIntegrations = { ...integrations, [name]: checked };
    try {
      await updateSettings({ integrations: updatedIntegrations } as any);
      setIntegrations(updatedIntegrations);
      toast.success(`${name} ${checked ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error(err.message || `Failed to update ${name}`);
    } finally {
      setIntegrationSaving(null);
    }
  };

  const persistNotificationChange = async (key: string, checked: boolean, newNotifications: typeof settings.notifications) => {
    setNotifSaving(key);
    try {
      await updateSettings({
        notifications: {
          email: newNotifications.email,
          push: newNotifications.push,
          sms: newNotifications.sms,
          booking_updates: newNotifications.bookingUpdates,
          driver_alerts: newNotifications.driverAlerts,
          payment_notifications: newNotifications.paymentNotifications,
        },
      });
      toast.success(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} ${checked ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      // Revert on failure
      setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, [key]: !checked } }));
      toast.error(err.message || 'Failed to update notification setting');
    } finally {
      setNotifSaving(null);
    }
  };

  const handlePermissionsOpen = (role: string) => {
    setEditingRole(role);
    // Set default permissions per role
    const defaults: Record<string, Record<string, boolean>> = {
      'Admin': { view_dashboard: true, manage_drivers: true, manage_bookings: true, manage_fleet: true, manage_payments: true, manage_support: true, manage_settings: true, manage_users: true },
      'Fleet Manager': { view_dashboard: true, manage_drivers: true, manage_bookings: true, manage_fleet: true, manage_payments: false, manage_support: false, manage_settings: false, manage_users: false },
      'Support Agent': { view_dashboard: true, manage_drivers: false, manage_bookings: false, manage_fleet: false, manage_payments: false, manage_support: true, manage_settings: false, manage_users: false },
    };
    const fallback = defaults[role] || { view_dashboard: true, manage_drivers: false, manage_bookings: false, manage_fleet: false, manage_payments: false, manage_support: false, manage_settings: false, manage_users: false };
    // Prefer server-persisted permissions for this role when available.
    const saved = savedSettings?.role_permissions?.[role];
    setRolePermissions(saved ? { ...fallback, ...saved } : fallback);
    setPermissionsOpen(true);
  };

  const handleSavePermissions = async () => {
    setPermissionsSaving(true);
    try {
      await updateSettings({ role_permissions: { [editingRole]: rolePermissions } } as any);
      toast.success(`${editingRole} permissions updated`);
      setPermissionsOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save permissions');
    } finally {
      setPermissionsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-64 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display font-semibold text-2xl text-foreground">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage platform configuration and preferences
        </p>
      </div>

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
                <CardTitle className="font-display font-semibold text-lg">General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={settings.companyName}
                      onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Company Email</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={settings.companyEmail}
                      onChange={(e) => setSettings({...settings, companyEmail: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Phone Number</Label>
                    <Input
                      id="companyPhone"
                      value={settings.companyPhone}
                      onChange={(e) => setSettings({...settings, companyPhone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <select
                      id="timezone"
                      value={settings.timezone}
                      onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                    >
                      <option value="Africa/Lagos">Africa/Lagos</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Company Address</Label>
                  <Textarea
                    id="companyAddress"
                    value={settings.companyAddress}
                    onChange={(e) => setSettings({...settings, companyAddress: e.target.value})}
                  />
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={settings.notifications.email}
                      disabled={notifSaving === 'email'}
                      onCheckedChange={(checked) => {
                        const newNotifs = {...settings.notifications, email: checked};
                        setSettings({ ...settings, notifications: newNotifs });
                        persistNotificationChange('email', checked, newNotifs);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive push notifications</p>
                    </div>
                    <Switch
                      checked={settings.notifications.push}
                      disabled={notifSaving === 'push'}
                      onCheckedChange={(checked) => {
                        const newNotifs = {...settings.notifications, push: checked};
                        setSettings({ ...settings, notifications: newNotifs });
                        persistNotificationChange('push', checked, newNotifs);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive SMS notifications</p>
                    </div>
                    <Switch
                      checked={settings.notifications.sms}
                      disabled={notifSaving === 'sms'}
                      onCheckedChange={(checked) => {
                        const newNotifs = {...settings.notifications, sms: checked};
                        setSettings({ ...settings, notifications: newNotifs });
                        persistNotificationChange('sms', checked, newNotifs);
                      }}
                    />
                  </div>
                </div>
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Notification Types</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">Booking Updates</p>
                        <p className="text-sm text-muted-foreground">New bookings, status changes</p>
                      </div>
                      <Switch
                        checked={settings.notifications.bookingUpdates}
                        disabled={notifSaving === 'bookingUpdates'}
                        onCheckedChange={(checked) => {
                          const newNotifs = {...settings.notifications, bookingUpdates: checked};
                          setSettings({ ...settings, notifications: newNotifs });
                          persistNotificationChange('bookingUpdates', checked, newNotifs);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">Driver Alerts</p>
                        <p className="text-sm text-muted-foreground">Driver status, documents</p>
                      </div>
                      <Switch
                        checked={settings.notifications.driverAlerts}
                        disabled={notifSaving === 'driverAlerts'}
                        onCheckedChange={(checked) => {
                          const newNotifs = {...settings.notifications, driverAlerts: checked};
                          setSettings({ ...settings, notifications: newNotifs });
                          persistNotificationChange('driverAlerts', checked, newNotifs);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">Payment Notifications</p>
                        <p className="text-sm text-muted-foreground">Payments, payouts, refunds</p>
                      </div>
                      <Switch
                        checked={settings.notifications.paymentNotifications}
                        disabled={notifSaving === 'paymentNotifications'}
                        onCheckedChange={(checked) => {
                          const newNotifs = {...settings.notifications, paymentNotifications: checked};
                          setSettings({ ...settings, notifications: newNotifs });
                          persistNotificationChange('paymentNotifications', checked, newNotifs);
                        }}
                      />
                    </div>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Two-Factor Authentication
                      </p>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                    </div>
                    <Switch
                      checked={settings.security.twoFactor}
                      onCheckedChange={async (checked) => {
                        setSettings({ ...settings, security: {...settings.security, twoFactor: checked} });
                        try {
                          await updateSettings({
                            security: {
                              two_factor: checked,
                              session_timeout: settings.security.sessionTimeout,
                              password_expiry: settings.security.passwordExpiry,
                            },
                          });
                          toast.success(`Two-factor authentication ${checked ? 'enabled' : 'disabled'}`);
                        } catch (err: any) {
                          setSettings(prev => ({ ...prev, security: { ...prev.security, twoFactor: !checked } }));
                          toast.error(err.message || 'Failed to update 2FA setting');
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => setSettings({
                        ...settings,
                        security: {...settings.security, sessionTimeout: parseInt(e.target.value)}
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordExpiry">Password Expiry (days)</Label>
                    <Input
                      id="passwordExpiry"
                      type="number"
                      value={settings.security.passwordExpiry}
                      onChange={(e) => setSettings({
                        ...settings,
                        security: {...settings.security, passwordExpiry: parseInt(e.target.value)}
                      })}
                    />
                  </div>
                </div>
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-1">Change Password</h4>
                  <p className="text-sm text-muted-foreground mb-4">Not yet available</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled
                      />
                    </div>
                  </div>
                  <Button
                    className="mt-4 bg-[#F97316] hover:bg-[#F97316]/90 text-white"
                    onClick={handleChangePassword}
                    disabled
                  >
                    Change Password
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
                <div className="space-y-4">
                  <h4 className="font-medium">Payment Gateways</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border-2 border-emerald-500 bg-emerald-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Paystack</span>
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">Primary payment gateway</p>
                    </div>
                    <div className={cn('p-4 rounded-lg border-2', flutterwaveEnabled ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50')}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Flutterwave</span>
                        <Switch
                          checked={flutterwaveEnabled}
                          disabled={flutterwaveSaving}
                          onCheckedChange={async (checked) => {
                            setFlutterwaveSaving(true);
                            try {
                              await updateSettings({ flutterwave_enabled: checked } as any);
                              setFlutterwaveEnabled(checked);
                              toast.success(`Flutterwave ${checked ? 'enabled' : 'disabled'}`);
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to update Flutterwave setting');
                            } finally {
                              setFlutterwaveSaving(false);
                            }
                          }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">Backup payment gateway</p>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-1">Bank Transfer Settings</h4>
                  <p className="text-sm text-muted-foreground mb-4">Not yet available</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input id="bankName" placeholder="Access Bank" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input id="accountNumber" placeholder="0123456789" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountName">Account Name</Label>
                      <Input id="accountName" placeholder="Hauliss Logistics Ltd" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sortCode">Sort Code</Label>
                      <Input id="sortCode" placeholder="044150149" disabled />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'users' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display font-semibold text-lg">User Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Role Permissions</h4>
                  <div className="space-y-3">
                    {['Admin', 'Fleet Manager', 'Support Agent'].map((role) => (
                      <div key={role} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{role}</p>
                          <p className="text-sm text-muted-foreground">
                            {role === 'Admin' && 'Full platform access'}
                            {role === 'Fleet Manager' && 'Manage fleet and drivers'}
                            {role === 'Support Agent' && 'Handle support tickets'}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handlePermissionsOpen(role)}>Edit Permissions</Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Create New Admin</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter email address"
                      className="flex-1"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                    >
                      <option value="admin">Admin</option>
                      <option value="fleet_manager">Fleet Manager</option>
                      <option value="support">Support</option>
                    </select>
                    <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleSendInvite} disabled={inviteSending}>
                      {inviteSending ? 'Creating...' : 'Create User'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'api' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display font-semibold text-lg">API & Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">API Keys</h4>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm">{liveApiKey || 'Loading...'}</span>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handleRegenerateApiKey('live')} disabled={regeneratingKey === 'live'}>
                        {regeneratingKey === 'live' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">Placeholder key — server-side API key issuance is not yet available.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm">{testApiKey || 'Loading...'}</span>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handleRegenerateApiKey('test')} disabled={regeneratingKey === 'test'}>
                        {regeneratingKey === 'test' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">Placeholder key — server-side API key issuance is not yet available.</p>
                  </div>
                </div>
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Active Integrations</h4>
                  <div className="space-y-3">
                    {Object.entries(integrations).map(([name, enabled]) => (
                      <div key={name} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <CheckCircle className={cn('w-5 h-5', enabled ? 'text-emerald-600' : 'text-gray-400')} />
                          <span className="font-medium">{name}</span>
                        </div>
                        <Switch
                          checked={enabled}
                          disabled={integrationSaving === name}
                          onCheckedChange={(checked) => handleToggleIntegration(name, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Permissions Editor Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">
              Edit {editingRole} Permissions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {Object.entries(rolePermissions).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
                <Switch
                  checked={value}
                  onCheckedChange={(checked) => setRolePermissions(prev => ({ ...prev, [key]: checked }))}
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
    </div>
  );
}
