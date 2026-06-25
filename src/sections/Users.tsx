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
  Activity,
  Loader2
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
import { getUsers, getUserStats, updateUser, createUser, type AdminUser } from '@/lib/api/users';
import { toast } from 'sonner';

// Real, assignable platform roles (filter, labels and dialogs all derive from this).
const ROLES: { value: string; label: string }[] = [
  { value: 'client', label: 'Client' },
  { value: 'driver', label: 'Driver' },
  { value: 'agent', label: 'Agent' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

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

export function Users() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Dialog states
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ full_name: '', email: '', phone_number: '', role: 'client', password: '' });

  const [viewProfileUser, setViewProfileUser] = useState<AdminUser | null>(null);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserForm, setEditUserForm] = useState({ full_name: '', email: '', phone_number: '', role: '' });
  const [editUserId, setEditUserId] = useState<string | null>(null);

  const pagination = usePagination(20);

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
    if (!addUserForm.full_name || !addUserForm.email || !addUserForm.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    setAddUserLoading(true);
    try {
      await createUser({
        email: addUserForm.email,
        password: addUserForm.password,
        full_name: addUserForm.full_name,
        phone_number: addUserForm.phone_number || undefined,
        role: addUserForm.role || 'client',
      });
      toast.success(`User "${addUserForm.full_name}" created successfully`);
      setAddUserOpen(false);
      setAddUserForm({ full_name: '', email: '', phone_number: '', role: 'client', password: '' });
      refetch();
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
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find((r) => r.value === role)?.label ?? role;
  };

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
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
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
                              <AvatarImage src={user.profile_photo_url} alt={user.full_name} />
                              <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white">
                                {user.full_name?.split(' ').map(n => n[0]).join('') || '?'}
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
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString('en-NG', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewProfileUser(user)}>
                                <Eye className="w-4 h-4 mr-2" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast.info("Activity log — view details")}>
                                <Activity className="w-4 h-4 mr-2" /> View Activity
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
              Send an invitation to a new platform user.
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
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Password *</Label>
              <Input
                id="add-password"
                type="password"
                placeholder="Enter password"
                value={addUserForm.password}
                onChange={(e) => setAddUserForm(f => ({ ...f, password: e.target.value }))}
              />
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
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={!!viewProfileUser} onOpenChange={(open) => !open && setViewProfileUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          {viewProfileUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={viewProfileUser.profile_photo_url} alt={viewProfileUser.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white text-lg">
                    {viewProfileUser.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{viewProfileUser.full_name}</p>
                  <Badge variant="outline" className="font-normal mt-1">
                    {getRoleLabel(viewProfileUser.role)}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{viewProfileUser.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{viewProfileUser.phone_number || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Joined {new Date(viewProfileUser.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {viewProfileUser.status === 'active' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="capitalize">{viewProfileUser.status}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewProfileUser(null)}>
              Close
            </Button>
            {viewProfileUser && (
              <Button
                className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
                onClick={() => {
                  handleOpenEdit(viewProfileUser);
                  setViewProfileUser(null);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" /> Edit User
              </Button>
            )}
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
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
