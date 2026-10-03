import { realPhotoUrl } from '@/lib/utils';
import { useState, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  UserPlus,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Loader2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import { getUsers, getUserStats, getUser, updateUser, createUser, type AdminUser, type CreatedUser } from '@/lib/api/users';
import { toast } from 'sonner';

// Display labels for every role the directory can return.
const ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  driver: 'Driver',
  agent: 'Agent',
  company_owner: 'Company Owner',
  fleet_manager: 'Fleet Manager',
  support: 'Support',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

// Role filter (QA TP-USR-05): the transporter portal never lists Super Admins.
const FILTER_ROLES = ['admin', 'fleet_manager', 'support', 'company_owner', 'driver', 'client'];

// Roles a company admin may assign here. Drivers are invited from the Drivers page.
const ASSIGNABLE_ROLES = ['admin', 'fleet_manager', 'support', 'company_owner'];

const SEARCH_KEY = 'hauliss_search';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleLabel = (role?: string | null) =>
  (role && ROLE_LABELS[role]) ||
  String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
  '—';

const formatDate = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-NG', options ?? { day: 'numeric', month: 'short', year: 'numeric' });
};

const initialsOf = (name?: string | null) =>
  (name || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

const defaultAddForm = { full_name: '', email: '', phone_number: '', role: 'admin', password: '' };

// Let one Radix dialog finish closing before the next opens; opening the
// second mid-exit-animation can leave `pointer-events: none` stuck on <body>.
const DIALOG_HANDOFF_MS = 150;

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div>
            <Skeleton className="h-4 w-32 mb-1.5" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded ml-auto" /></TableCell>
    </TableRow>
  );
}

function ProfileField({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="p-3 rounded-lg bg-muted/50 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={`text-sm font-medium mt-0.5 break-words ${mono ? 'font-mono' : ''} ${empty ? 'text-muted-foreground font-normal' : ''}`}>
        {empty ? '—' : value}
      </div>
    </div>
  );
}

export function Users() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Dialog states
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserForm, setAddUserForm] = useState(defaultAddForm);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);

  // View Profile: fetched from GET /api/admin/users/:id (QA TP-USR-05)
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<AdminUser | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewAttempt, setViewAttempt] = useState(0);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserForm, setEditUserForm] = useState({ full_name: '', email: '', phone_number: '', role: '' });
  const [editUserId, setEditUserId] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);

  const pagination = usePagination(20);

  // Deep link from other sections (e.g. the header search).
  useEffect(() => {
    const saved = sessionStorage.getItem(SEARCH_KEY);
    if (saved === null) return;
    sessionStorage.removeItem(SEARCH_KEY);
    if (saved.trim()) setSearchQuery(saved);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      pagination.setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    pagination.setPage(1);
  }, [statusFilter, roleFilter]);

  const { data, isLoading, error, refetch } = useApi(
    () => getUsers({
      page: pagination.page,
      limit: pagination.limit,
      status: statusFilter,
      role: roleFilter,
      search: debouncedSearch,
    }),
    [pagination.page, pagination.limit, statusFilter, roleFilter, debouncedSearch]
  );

  const { data: stats, isLoading: statsLoading } = useApi(() => getUserStats(), []);

  // Update pagination total when data changes
  useEffect(() => {
    if (data) {
      const response = data as any;
      if (response?.pagination?.total !== undefined) {
        pagination.setTotal(response.pagination.total);
      }
    }
  }, [data]);

  const userList: AdminUser[] = (data as any)?.data || [];

  // Load the full record whenever a profile is opened (or Retry is pressed).
  useEffect(() => {
    if (!viewProfileId) {
      setViewProfile(null);
      setViewError(null);
      setViewLoading(false);
      return;
    }
    let cancelled = false;
    setViewLoading(true);
    setViewError(null);
    getUser(viewProfileId)
      .then((u) => { if (!cancelled) setViewProfile(u); })
      .catch((err: any) => { if (!cancelled) setViewError(err?.message || 'Failed to load profile'); })
      .finally(() => { if (!cancelled) setViewLoading(false); });
    return () => { cancelled = true; };
  }, [viewProfileId, viewAttempt]);

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

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await updateUser(userId, { status: newStatus });
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || `Failed to update user status`);
    }
  };

  const handleAddUser = async () => {
    const full_name = addUserForm.full_name.trim();
    const email = addUserForm.email.trim().toLowerCase();
    if (!full_name || !email) {
      toast.error('Full name and email are required');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    if (addUserForm.password && addUserForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setAddUserLoading(true);
    try {
      const created = await createUser({
        email,
        full_name,
        phone_number: addUserForm.phone_number.trim() || undefined,
        role: addUserForm.role || 'admin',
        // Blank → the server generates a temporary password and emails it.
        password: addUserForm.password || undefined,
      });
      toast.success(`User "${full_name}" created successfully`);
      setAddUserOpen(false);
      const role = addUserForm.role;
      setAddUserForm(defaultAddForm);
      refetch();
      if (created?.temporary_password) {
        setTimeout(() => {
          setCreatedUser({ ...created, email: created.email || email, role: created.role || role });
        }, DIALOG_HANDOFF_MS);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleOpenEdit = (user: AdminUser) => {
    setEditUserId(user.id);
    setEditUserForm({
      full_name: user.full_name || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      role: user.role || '',
    });
    setEditUserOpen(true);
  };

  // View → Edit: close the profile dialog first, then open the editor.
  const handleEditFromProfile = () => {
    const target = viewProfile ?? userList.find((u) => u.id === viewProfileId) ?? null;
    setViewProfileId(null);
    if (!target) return;
    setTimeout(() => handleOpenEdit(target), DIALOG_HANDOFF_MS);
  };

  const handleEditUser = async () => {
    if (!editUserId) return;
    setEditUserLoading(true);
    try {
      await updateUser(editUserId, {
        full_name: editUserForm.full_name,
        phone_number: editUserForm.phone_number,
        role: editUserForm.role,
      });
      toast.success('User updated successfully');
      setEditUserOpen(false);
      setEditUserId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    } finally {
      setEditUserLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setRoleFilter('all');
    toast.info('Filters cleared');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Inactive</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
      case 'suspended':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Suspended</Badge>;
      case 'banned':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Banned</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Keep a non-assignable current role (e.g. driver) selectable so the editor
  // never silently changes it.
  const editRoleOptions =
    editUserForm.role && !ASSIGNABLE_ROLES.includes(editUserForm.role)
      ? [editUserForm.role, ...ASSIGNABLE_ROLES]
      : ASSIGNABLE_ROLES;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Users</h2>
          <p className="text-muted-foreground mt-1">
            Manage platform users and their permissions
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={() => setAddUserOpen(true)}
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Roles</option>
                {FILTER_ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
              <Button
                variant="outline"
                size="icon"
                onClick={handleClearFilters}
                title="Clear all filters"
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display font-semibold text-lg">
            All Users {pagination.total > 0 && `(${pagination.total})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex items-center gap-3 text-red-600 py-8 justify-center">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">Failed to load users. {error}</p>
              <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <>
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                    </>
                  ) : userList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    userList.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={realPhotoUrl(user.profile_photo_url)} alt={user.full_name} />
                              <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white">
                                {initialsOf(user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{user.full_name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="w-3.5 h-3.5" />
                              {user.phone_number || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {roleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(user.created_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {/* modal={false}: a modal menu opening a modal dialog can leave body pointer-events stuck */}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewProfileId(user.id)}>
                                <Eye className="w-4 h-4 mr-2" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit User
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status === 'active' ? (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleStatusChange(user.id, 'inactive')}
                                >
                                  <XCircle className="w-4 h-4 mr-2" /> Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-emerald-600"
                                  onClick={() => handleStatusChange(user.id, 'active')}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" /> Activate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={pagination.prevPage}
                      disabled={pagination.page <= 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={pagination.nextPage}
                      disabled={pagination.page >= pagination.totalPages}
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-xl font-semibold">{stats?.active?.toLocaleString() ?? '0'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Verification</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-xl font-semibold">{stats?.pending?.toLocaleString() ?? '0'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inactive Users</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-xl font-semibold">{stats?.inactive?.toLocaleString() ?? '0'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-xl font-semibold">{stats?.total?.toLocaleString() ?? '0'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a team account for your company. Drivers are invited from the Drivers page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-name">Full Name *</Label>
              <Input
                id="add-name"
                placeholder="Enter full name"
                value={addUserForm.full_name}
                onChange={(e) => setAddUserForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="user@example.com"
                value={addUserForm.email}
                onChange={(e) => setAddUserForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-phone">Phone Number</Label>
              <Input
                id="add-phone"
                placeholder="+234..."
                value={addUserForm.phone_number}
                onChange={(e) => setAddUserForm(f => ({ ...f, phone_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={addUserForm.role}
                onValueChange={(value) => setAddUserForm(f => ({ ...f, role: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Password (optional)</Label>
              <Input
                id="add-password"
                type="password"
                autoComplete="new-password"
                placeholder="Leave blank to generate one"
                value={addUserForm.password}
                onChange={(e) => setAddUserForm(f => ({ ...f, password: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank and a temporary password is generated and emailed with a welcome message.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={handleAddUser}
              disabled={addUserLoading}
            >
              {addUserLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time credentials (only when the server generated the password) */}
      <Dialog open={!!createdUser} onOpenChange={(open) => { if (!open) setCreatedUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User created</DialogTitle>
            <DialogDescription>
              A welcome email has been sent to {createdUser?.email}. The temporary password below is shown only once.
            </DialogDescription>
          </DialogHeader>
          {createdUser && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium break-all">{createdUser.email}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm font-medium">{roleLabel(createdUser.role)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Temporary password</p>
                  <p className="text-sm font-mono font-medium break-all">{createdUser.temporary_password}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  title="Copy temporary password"
                  onClick={() => copyToClipboard(createdUser.temporary_password || '', 'Temporary password')}
                >
                  {copied === 'Temporary password' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={() => setCreatedUser(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={!!viewProfileId} onOpenChange={(open) => { if (!open) setViewProfileId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>Full account record from the user directory.</DialogDescription>
          </DialogHeader>

          {viewLoading ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : viewError ? (
            <div className="py-6 flex flex-col items-center text-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm font-medium">Failed to load profile</p>
              <p className="text-sm text-muted-foreground">{viewError}</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setViewAttempt((a) => a + 1)}>
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            </div>
          ) : viewProfile ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={realPhotoUrl(viewProfile.profile_photo_url)} alt={viewProfile.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white text-lg">
                    {initialsOf(viewProfile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-lg font-semibold truncate">{viewProfile.full_name || '—'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-normal">{roleLabel(viewProfile.role)}</Badge>
                    {getStatusBadge(viewProfile.status)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-4">
                <ProfileField
                  label="Email"
                  value={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="break-all">{viewProfile.email}</span>
                      {viewProfile.email_verified ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-normal">Verified</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-normal">Unverified</Badge>
                      )}
                    </span>
                  }
                />
                <ProfileField label="Phone" value={viewProfile.phone_number} />
                <ProfileField label="Account type" value={viewProfile.account_type ? roleLabel(viewProfile.account_type) : ''} />
                <ProfileField label="Company" value={viewProfile.company_name} />
                <ProfileField label="Transporter ID" value={viewProfile.transporter_id} mono />
                <ProfileField label="Vehicle type" value={viewProfile.vehicle_type} />
                <ProfileField label="Joined" value={formatDate(viewProfile.created_at, { day: 'numeric', month: 'long', year: 'numeric' })} />
                <ProfileField label="Last updated" value={formatDate(viewProfile.updated_at, { day: 'numeric', month: 'long', year: 'numeric' })} />
                <div className="sm:col-span-2">
                  <ProfileField
                    label="User ID"
                    mono
                    value={
                      <span className="inline-flex items-center gap-2 max-w-full">
                        <span className="break-all">{viewProfile.id}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Copy user ID"
                          onClick={() => copyToClipboard(viewProfile.id, 'User ID')}
                        >
                          {copied === 'User ID' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </span>
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewProfileId(null)}>
              Close
            </Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={handleEditFromProfile}
              disabled={viewLoading || (!viewProfile && !userList.some((u) => u.id === viewProfileId))}
            >
              <Pencil className="w-4 h-4 mr-2" /> Edit User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editUserForm.full_name}
                onChange={(e) => setEditUserForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUserForm.email}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                value={editUserForm.phone_number}
                onChange={(e) => setEditUserForm(f => ({ ...f, phone_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editUserForm.role}
                onValueChange={(value) => setEditUserForm(f => ({ ...f, role: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {editRoleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={handleEditUser}
              disabled={editUserLoading}
            >
              {editUserLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
