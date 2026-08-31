import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  MoreVertical,
  UserPlus,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit,
  Ban,
  Wallet,
  FileCheck,
  Shield,
  Phone,
  Mail,
  Filter,
  Truck,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { getDrivers, getDriverDocuments, reviewDriverDocument, updateDriverStatus, updateDriver, type AdminDriver, type DriverDocument } from '@/lib/api/drivers';
import { getUserStats, createUser } from '@/lib/api/users';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export function Drivers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<AdminDriver | null>(null);
  const [driverDocs, setDriverDocs] = useState<DriverDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialog states
  const [addDriverOpen, setAddDriverOpen] = useState(false);
  const [editDriverOpen, setEditDriverOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<AdminDriver | null>(null);

  // Add driver form
  const [addForm, setAddForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    company: '',
    transporter_id: '',
  });

  // Edit driver form
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone_number: '',
    vehicle_type: '',
    transporter_id: '',
  });

  // Advanced filter state
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');

  const pagination = usePagination(20);

  const { data: statsData, isLoading: statsLoading } = useApi(
    () => getUserStats(),
    []
  );

  const { data, isLoading, refetch } = useApi(
    () => getDrivers({
      page: pagination.page,
      limit: pagination.limit,
      status: statusFilter,
      search: searchQuery || undefined,
      vehicle_type: vehicleTypeFilter || undefined,
    }),
    [pagination.page, statusFilter, searchQuery, vehicleTypeFilter]
  );

  const driverList: AdminDriver[] = (data as any)?.data || [];
  const paginationMeta = (data as any)?.pagination;

  // Sync pagination total when API response arrives
  useEffect(() => {
    if (paginationMeta?.total) {
      pagination.setTotal(paginationMeta.total);
    }
  }, [paginationMeta?.total]);

  // Fetch documents when a driver is selected
  useEffect(() => {
    if (!selectedDriver) {
      setDriverDocs([]);
      return;
    }
    setDocsLoading(true);
    getDriverDocuments(selectedDriver.id)
      .then((res) => {
        setDriverDocs(res.documents || []);
      })
      .catch(() => {
        setDriverDocs([]);
      })
      .finally(() => setDocsLoading(false));
  }, [selectedDriver?.id]);

  // BUG-001/002: real document review — this panel previously had no
  // approve/reject controls at all (rows were click-to-toast stubs).
  const [docActionLoading, setDocActionLoading] = useState<string | null>(null);
  const handleReviewDocument = useCallback(async (doc: DriverDocument, status: 'verified' | 'rejected') => {
    if (!selectedDriver) return;
    let reason: string | undefined;
    if (status === 'rejected') {
      const input = window.prompt('Reason for rejecting this document (sent to the driver):');
      if (input === null) return;
      reason = input.trim();
      if (!reason) {
        toast.error('A rejection reason is required');
        return;
      }
    }
    setDocActionLoading(doc.id);
    try {
      await reviewDriverDocument(doc.id, status, reason);
      toast.success(`${doc.title} ${status === 'verified' ? 'approved' : 'rejected'}`);
      const res = await getDriverDocuments(selectedDriver.id);
      setDriverDocs(res.documents || []);
      // Once all documents are verified the backend activates the driver —
      // refresh the list so the status column updates.
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to review document');
    } finally {
      setDocActionLoading(null);
    }
  }, [selectedDriver, refetch]);

  const handleStatusChange = useCallback(async (driverId: string, newStatus: string, label: string) => {
    setActionLoading(driverId);
    try {
      await updateDriverStatus(driverId, newStatus);
      toast.success(`Driver ${label} successfully`);
      refetch();
      if (selectedDriver?.id === driverId) {
        setSelectedDriver(null);
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to ${label.toLowerCase()} driver`);
    } finally {
      setActionLoading(null);
    }
  }, [refetch, selectedDriver]);

  const [addLoading, setAddLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Earnings dialog state
  const [earningsOpen, setEarningsOpen] = useState(false);
  const [earningsDriver, setEarningsDriver] = useState<AdminDriver | null>(null);

  const handleAddDriver = async () => {
    if (!addForm.email || !addForm.full_name) {
      toast.error('Email and Full Name are required');
      return;
    }
    setAddLoading(true);
    try {
      await createUser({
        email: addForm.email,
        full_name: addForm.full_name,
        phone_number: addForm.phone || undefined,
        role: 'driver',
        company_name: addForm.company || undefined,
        transporter_id: addForm.transporter_id || undefined,
        password: crypto.randomUUID().slice(0, 12),
      });
      toast.success(`Driver invitation sent to ${addForm.email}`);
      setAddForm({ email: '', full_name: '', phone: '', company: '', transporter_id: '' });
      setAddDriverOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create driver');
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditDriver = async () => {
    if (!editingDriver) return;
    setEditLoading(true);
    try {
      await updateDriver(editingDriver.id, {
        full_name: editForm.full_name,
        phone_number: editForm.phone_number,
        vehicle_type: editForm.vehicle_type,
        transporter_id: editForm.transporter_id,
      });
      toast.success(`Driver "${editForm.full_name}" updated successfully`);
      setEditDriverOpen(false);
      setEditingDriver(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update driver');
    } finally {
      setEditLoading(false);
    }
  };

  const openEditDialog = (driver: AdminDriver) => {
    setEditingDriver(driver);
    setEditForm({
      full_name: driver.full_name || '',
      phone_number: driver.phone_number || '',
      vehicle_type: driver.vehicle_type || '',
      transporter_id: driver.transporter_id || '',
    });
    setEditDriverOpen(true);
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
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Suspended</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getDocumentStatus = (status: string) => {
    switch (status) {
      // The backend vocabulary is 'verified' (BUG-001 QA follow-up: this
      // component compared against 'approved', so verified docs rendered as
      // "unknown" and progress stuck at 0%). 'approved' kept for safety.
      case 'verified':
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getVerificationProgress = (docs: DriverDocument[]) => {
    if (docs.length === 0) return 0;
    const verified = docs.filter(d => d.status === 'verified' || d.status === 'approved').length;
    return Math.round((verified / docs.length) * 100);
  };

  const getInitials = (name?: string) =>
    (name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  // Loading skeleton for table rows
  const TableRowSkeleton = () => (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded ml-auto" /></TableCell>
    </TableRow>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Drivers</h2>
          <p className="text-muted-foreground mt-1">
            Manage drivers, verify documents, and track performance
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={() => setAddDriverOpen(true)}
        >
          <UserPlus className="w-4 h-4" />
          Add Driver
        </Button>
      </div>

      {/* Add Driver Dialog */}
      <Dialog open={addDriverOpen} onOpenChange={setAddDriverOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite New Driver</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="driver@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-name">Full Name *</Label>
              <Input
                id="add-name"
                placeholder="John Doe"
                value={addForm.full_name}
                onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-phone">Phone</Label>
              <Input
                id="add-phone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-company">Company</Label>
              <Input
                id="add-company"
                placeholder="Transport Co."
                value={addForm.company}
                onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-tid">Transporter ID</Label>
              <Input
                id="add-tid"
                placeholder="TRN-XXXX"
                value={addForm.transporter_id}
                onChange={(e) => setAddForm({ ...addForm, transporter_id: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDriverOpen(false)} disabled={addLoading}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleAddDriver} disabled={addLoading}>
              {addLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Driver Dialog */}
      <Dialog open={editDriverOpen} onOpenChange={setEditDriverOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone_number}
                onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-vehicle">Vehicle Type</Label>
              <Input
                id="edit-vehicle"
                value={editForm.vehicle_type}
                onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tid">Transporter ID</Label>
              <Input
                id="edit-tid"
                value={editForm.transporter_id}
                onChange={(e) => setEditForm({ ...editForm, transporter_id: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDriverOpen(false)} disabled={editLoading}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleEditDriver} disabled={editLoading}>
              {editLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Drivers</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{statsData?.drivers?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                <Truck className="w-6 h-6 text-[#F97316]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Drivers</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{statsData?.active?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Verification</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{statsData?.pending?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Rating</p>
                <p className="text-2xl font-semibold">N/A</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Star className="w-6 h-6 text-blue-600 fill-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers by name, email, or transporter ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  pagination.setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  pagination.setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
              <Button variant="outline" size="icon" onClick={() => setAdvancedFilterOpen(true)}>
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drivers Table */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg">
                All Drivers ({paginationMeta?.total ?? driverList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Driver</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
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
                  ) : driverList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No drivers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    driverList.map((driver) => (
                      <TableRow
                        key={driver.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedDriver(driver)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={driver.profile_photo_url} alt={driver.full_name} />
                              <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white">
                                {getInitials(driver.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{driver.full_name}</p>
                              <p className="text-sm text-muted-foreground">{driver.transporter_id || driver.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm">
                            {driver.vehicle_type || '—'}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(driver.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDriver(driver); }}>
                                <Eye className="w-4 h-4 mr-2" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(driver); }}>
                                <Edit className="w-4 h-4 mr-2" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDriver(driver); }}>
                                <FileCheck className="w-4 h-4 mr-2" /> Verify Documents
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEarningsDriver(driver); setEarningsOpen(true); }}>
                                <Wallet className="w-4 h-4 mr-2" /> View Earnings
                              </DropdownMenuItem>
                              {driver.status !== 'suspended' ? (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  disabled={actionLoading === driver.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(driver.id, 'suspended', 'suspended');
                                  }}
                                >
                                  {actionLoading === driver.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Ban className="w-4 h-4 mr-2" />
                                  )}
                                  Suspend
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-emerald-600"
                                  disabled={actionLoading === driver.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(driver.id, 'active', 'activated');
                                  }}
                                >
                                  {actionLoading === driver.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                  )}
                                  Activate
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
              {paginationMeta && paginationMeta.total_pages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({paginationMeta.total} drivers)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={pagination.prevPage}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={pagination.nextPage}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Driver Details Panel */}
        <div className="lg:col-span-1">
          {selectedDriver ? (
            <Card className="border-0 shadow-sm sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display font-semibold text-lg">
                    Driver Details
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedDriver(null)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedDriver.profile_photo_url} alt={selectedDriver.full_name} />
                    <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white text-lg">
                      {getInitials(selectedDriver.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedDriver.full_name}</h3>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(selectedDriver.status)}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedDriver.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedDriver.phone_number || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedDriver.transporter_id || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedDriver.vehicle_type || '—'}</span>
                  </div>
                </div>

                {/* Verification Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Verification Progress</span>
                    {docsLoading ? (
                      <Skeleton className="h-4 w-8" />
                    ) : (
                      <span>{getVerificationProgress(driverDocs)}%</span>
                    )}
                  </div>
                  {docsLoading ? (
                    <Skeleton className="h-2 w-full rounded-full" />
                  ) : (
                    <Progress value={getVerificationProgress(driverDocs)} className="h-2" />
                  )}
                </div>

                {/* Documents */}
                <div className="space-y-3">
                  <h4 className="font-medium">Documents</h4>
                  {docsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  ) : driverDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents uploaded</p>
                  ) : (
                    <div className="space-y-2">
                      {driverDocs.map((doc) => (
                        <div key={doc.id} className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{doc.title}</span>
                            <div className="flex items-center gap-2">
                              {getDocumentStatus(doc.status)}
                              {doc.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={docActionLoading === doc.id}
                                    onClick={() => handleReviewDocument(doc, 'verified')}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2"
                                    disabled={docActionLoading === doc.id}
                                    onClick={() => handleReviewDocument(doc, 'rejected')}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {doc.status === 'rejected' && doc.rejection_reason && (
                            <p className="mt-1 text-xs text-red-600">Reason: {doc.rejection_reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-[#F97316]">—</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Trips</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-[#111111]">—</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Earnings</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-[#F97316] hover:bg-[#F97316]/90 text-white"
                    onClick={() => {
                      if (selectedDriver.phone_number) {
                        window.open(`tel:${selectedDriver.phone_number}`);
                      } else {
                        toast.info('No phone number available for this driver');
                      }
                    }}
                  >
                    <Phone className="w-4 h-4 mr-2" /> Call Driver
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedDriver.email) {
                        window.open(`mailto:${selectedDriver.email}`);
                      } else {
                        toast.info('No email available for this driver');
                      }
                    }}
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a driver to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Advanced Filters Dialog */}
      <Dialog open={advancedFilterOpen} onOpenChange={setAdvancedFilterOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filter-vehicle">Vehicle Type</Label>
              <Input
                id="filter-vehicle"
                placeholder="e.g., Flatbed, Box Truck"
                value={vehicleTypeFilter}
                onChange={(e) => setVehicleTypeFilter(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setVehicleTypeFilter('');
            }}>
              Clear Filters
            </Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={() => {
              pagination.setPage(1);
              setAdvancedFilterOpen(false);
            }}>
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Earnings Summary Dialog */}
      <Dialog open={earningsOpen} onOpenChange={setEarningsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Driver Earnings Summary</DialogTitle>
          </DialogHeader>
          {earningsDriver && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={earningsDriver.profile_photo_url} alt={earningsDriver.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white">
                    {getInitials(earningsDriver.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{earningsDriver.full_name}</p>
                  <p className="text-sm text-muted-foreground">{earningsDriver.transporter_id || earningsDriver.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-[#F97316]">—</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Trips</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-[#111111]">—</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Earnings</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Detailed earnings data will be available once trips are recorded for this driver.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarningsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
