import { useState, useEffect, useRef } from 'react';
import {
  Search,
  MoreVertical,
  Plus,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  Navigation,
  Package,
  Wallet,
  Eye,
  MessageSquare,
  Phone,
  ArrowRight,
  Filter,
  Edit,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { MapView } from '@/components/ui/map-view';
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import { getBookings, getBookingStats, updateBookingStatus, createBooking, type AdminBooking } from '@/lib/api/bookings';
import { getTruckTypes, type TruckType } from '@/lib/api/fleet';
import type { ApiResponse } from '@/lib/api/client';
import { toast } from 'sonner';

const CARGO_TYPES = ['Electronics', 'Building Materials', 'Furniture', 'Agricultural', 'Consumer Goods', 'Industrial'];
const CARGO_WEIGHTS = ['light', 'medium', 'heavy'];

type NewBookingForm = {
  pickupAddress: string;
  dropoffAddress: string;
  cargoType: string;
  cargoWeight: string;
  truckType: string;
  contactName: string;
  contactPhone: string;
};

const emptyForm: NewBookingForm = {
  pickupAddress: '',
  dropoffAddress: '',
  cargoType: '',
  cargoWeight: '',
  truckType: '',
  contactName: '',
  contactPhone: '',
};

export function Bookings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [newBookingForm, setNewBookingForm] = useState<NewBookingForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  useAddressAutocomplete(pickupInputRef, (place) => {
    setNewBookingForm((prev) => ({ ...prev, pickupAddress: place.address }));
  });

  useAddressAutocomplete(dropoffInputRef, (place) => {
    setNewBookingForm((prev) => ({ ...prev, dropoffAddress: place.address }));
  });

  const pagination = usePagination(15);

  const { data: bookingsData, isLoading, error, refetch } = useApi<ApiResponse<AdminBooking[]>>(
    () => getBookings({
      page: pagination.page,
      limit: pagination.limit,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: searchQuery || undefined,
    }),
    [pagination.page, statusFilter, searchQuery]
  );

  const { data: stats, isLoading: statsLoading } = useApi(
    () => getBookingStats(),
    []
  );

  const { data: truckTypesData } = useApi(() => getTruckTypes(), []);
  const truckTypes: TruckType[] = Array.isArray(truckTypesData) ? truckTypesData : [];

  // Sync pagination total when data arrives
  useEffect(() => {
    if (bookingsData?.pagination) {
      pagination.setTotal(bookingsData.pagination.total);
    }
  }, [bookingsData]);

  const bookings = bookingsData?.data ?? [];

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
    setActionLoading(bookingId);
    try {
      await updateBookingStatus(bookingId, newStatus);
      toast.success(`Booking ${newStatus.toLowerCase()} successfully`);
      refetch();
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to update booking status`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateBooking = async () => {
    if (!newBookingForm.pickupAddress || !newBookingForm.dropoffAddress || !newBookingForm.cargoType || !newBookingForm.cargoWeight || !newBookingForm.truckType || !newBookingForm.contactName || !newBookingForm.contactPhone) {
      toast.error("Please fill in all fields");
      return;
    }
    setCreating(true);
    try {
      await createBooking({
        pickup_address: newBookingForm.pickupAddress,
        dropoff_address: newBookingForm.dropoffAddress,
        cargo_type: newBookingForm.cargoType,
        cargo_weight: newBookingForm.cargoWeight,
        truck_type: newBookingForm.truckType,
        contact_name: newBookingForm.contactName,
        contact_phone: newBookingForm.contactPhone,
      });
      toast.success("Booking created successfully");
      setNewBookingOpen(false);
      setNewBookingForm(emptyForm);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to create booking");
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Scheduled</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Confirmed</Badge>;
      case 'assigned':
        return <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Assigned</Badge>;
      case 'dispatched':
        return <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">Dispatched</Badge>;
      case 'in_transit':
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>;
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const shortId = (id: string) => id.slice(0, 8);

  const updateFormField = (field: keyof NewBookingForm, value: string) => {
    setNewBookingForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Bookings</h2>
          <p className="text-muted-foreground mt-1">
            Manage trip bookings, track status, and monitor deliveries
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={() => setNewBookingOpen(true)}
        >
          <Plus className="w-4 h-4" />
          New Booking
        </Button>
      </div>

      {/* New Booking Dialog */}
      <Dialog open={newBookingOpen} onOpenChange={setNewBookingOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Create New Booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pickupAddress">Pickup Address</Label>
              <Input
                ref={pickupInputRef}
                id="pickupAddress"
                placeholder="Enter pickup address"
                value={newBookingForm.pickupAddress}
                onChange={(e) => updateFormField('pickupAddress', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dropoffAddress">Dropoff Address</Label>
              <Input
                ref={dropoffInputRef}
                id="dropoffAddress"
                placeholder="Enter dropoff address"
                value={newBookingForm.dropoffAddress}
                onChange={(e) => updateFormField('dropoffAddress', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cargoType">Cargo Type</Label>
                <select
                  id="cargoType"
                  value={newBookingForm.cargoType}
                  onChange={(e) => updateFormField('cargoType', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                >
                  <option value="">Select type</option>
                  {CARGO_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cargoWeight">Cargo Weight</Label>
                <select
                  id="cargoWeight"
                  value={newBookingForm.cargoWeight}
                  onChange={(e) => updateFormField('cargoWeight', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                >
                  <option value="">Select weight</option>
                  {CARGO_WEIGHTS.map((w) => (
                    <option key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="truckType">Truck Type</Label>
              <select
                id="truckType"
                value={newBookingForm.truckType}
                onChange={(e) => updateFormField('truckType', e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="">Select truck type</option>
                {truckTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>{tt.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  placeholder="Full name"
                  value={newBookingForm.contactName}
                  onChange={(e) => updateFormField('contactName', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  placeholder="Phone number"
                  value={newBookingForm.contactPhone}
                  onChange={(e) => updateFormField('contactPhone', e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBookingOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={handleCreateBooking}
              disabled={creating}
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter Dialog */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); pagination.setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Search</Label>
              <Input
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStatusFilter('all'); setSearchQuery(''); }}>
              Clear Filters
            </Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={() => setFilterOpen(false)}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{stats?.total?.toLocaleString() ?? '0'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                <Navigation className="w-6 h-6 text-[#F97316]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{stats?.in_progress?.toLocaleString() ?? '0'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{stats?.completed?.toLocaleString() ?? '0'}</p>
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
                <p className="text-sm text-muted-foreground">Cancelled</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{stats?.cancelled?.toLocaleString() ?? '0'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{stats?.pending?.toLocaleString() ?? '0'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-blue-600" />
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
                placeholder="Search bookings by ID, location, or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); pagination.setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <Button variant="outline" size="icon" onClick={() => setFilterOpen(true)}>
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bookings Table */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg">
                All Bookings {bookingsData?.pagination ? `(${bookingsData.pagination.total})` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-24" />
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 w-20" />
                      <Skeleton className="h-10 w-20" />
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-2">{error}</p>
                  <Button variant="outline" onClick={refetch}>Try Again</Button>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No bookings found
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking ID</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((booking) => (
                        <TableRow
                          key={booking.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedBooking(booking)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-mono font-medium">{shortId(booking.id)}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(booking.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <span className="truncate max-w-[100px]">{booking.pickup?.address ?? 'N/A'}</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[100px]">{booking.dropoff?.address ?? 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{booking.cargo?.category ?? 'N/A'}</p>
                              <p className="text-xs text-muted-foreground">{booking.cargo?.weight ?? 'N/A'}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}>
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Edit booking — view details"); }}>
                                  <Edit className="w-4 h-4 mr-2" /> Edit Booking
                                </DropdownMenuItem>
                                {booking.status.toLowerCase() === 'pending' && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={(e) => { e.stopPropagation(); handleStatusUpdate(booking.id, 'CONFIRMED'); }}
                                      disabled={actionLoading === booking.id}
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" /> Confirm
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={(e) => { e.stopPropagation(); handleStatusUpdate(booking.id, 'CANCELLED'); }}
                                      disabled={actionLoading === booking.id}
                                    >
                                      <XCircle className="w-4 h-4 mr-2" /> Cancel
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Opening chat..."); }}>
                                  <MessageSquare className="w-4 h-4 mr-2" /> Chat with Driver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Calling customer..."); }}>
                                  <Phone className="w-4 h-4 mr-2" /> Call Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={pagination.prevPage}
                          disabled={pagination.page <= 1}
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={pagination.nextPage}
                          disabled={pagination.page >= pagination.totalPages}
                        >
                          Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Booking Details Panel */}
        <div className="lg:col-span-1">
          {selectedBooking ? (
            <Card className="border-0 shadow-sm sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display font-semibold text-lg">
                    Booking Details
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedBooking(null)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Header */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 mb-4">
                    {getStatusBadge(selectedBooking.status)}
                  </div>
                  <h3 className="font-semibold text-lg">{shortId(selectedBooking.id)}</h3>
                  <p className="text-muted-foreground text-sm">
                    Created {new Date(selectedBooking.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Route */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#F97316]" /> Route
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-1">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Pickup</p>
                        <p className="text-sm text-muted-foreground">{selectedBooking.pickup?.address ?? 'N/A'}</p>
                        {selectedBooking.pickup?.contact_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedBooking.pickup.contact_name} - {selectedBooking.pickup.contact_phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 border-l-2 border-dashed border-border h-6" />
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-1">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Dropoff</p>
                        <p className="text-sm text-muted-foreground">{selectedBooking.dropoff?.address ?? 'N/A'}</p>
                        {selectedBooking.dropoff?.contact_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedBooking.dropoff.contact_name} - {selectedBooking.dropoff.contact_phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Route Map */}
                {(() => {
                  // Server sends lat/lng as strings (incl. placeholder "0"); coerce
                  // and only render when all four are finite, real coordinates.
                  const pLat = Number(selectedBooking.pickup?.lat);
                  const pLng = Number(selectedBooking.pickup?.lng);
                  const dLat = Number(selectedBooking.dropoff?.lat);
                  const dLng = Number(selectedBooking.dropoff?.lng);
                  const valid = [pLat, pLng, dLat, dLng].every((v) => Number.isFinite(v) && v !== 0);
                  if (!valid) return null;
                  return (
                    <MapView
                      height="200px"
                      markers={[
                        { lat: pLat, lng: pLng, label: 'Pickup', color: 'green' },
                        { lat: dLat, lng: dLng, label: 'Dropoff', color: 'red' },
                      ]}
                      route={{
                        origin: { lat: pLat, lng: pLng },
                        destination: { lat: dLat, lng: dLng },
                      }}
                    />
                  );
                })()}

                {/* Cargo Details */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#F97316]" /> Cargo Details
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Category</span>
                      <span className="text-sm font-medium">{selectedBooking.cargo?.category ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Weight</span>
                      <span className="text-sm font-medium">{selectedBooking.cargo?.weight ?? 'N/A'}</span>
                    </div>
                    {selectedBooking.cargo?.size && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Size</span>
                        <span className="text-sm font-medium">{selectedBooking.cargo.size}</span>
                      </div>
                    )}
                  </div>
                  {selectedBooking.cargo?.description && (
                    <p className="text-sm text-muted-foreground">
                      {selectedBooking.cargo.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {selectedBooking.status.toLowerCase() === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleStatusUpdate(selectedBooking.id, 'CONFIRMED')}
                        disabled={actionLoading === selectedBooking.id}
                      >
                        {actionLoading === selectedBooking.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Confirm
                      </Button>
                      <Button
                        className="flex-1"
                        variant="destructive"
                        onClick={() => handleStatusUpdate(selectedBooking.id, 'CANCELLED')}
                        disabled={actionLoading === selectedBooking.id}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Cancel
                      </Button>
                    </div>
                  )}
                  {selectedBooking.status.toLowerCase() === 'confirmed' && (
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => handleStatusUpdate(selectedBooking.id, 'IN_TRANSIT')}
                      disabled={actionLoading === selectedBooking.id}
                    >
                      {actionLoading === selectedBooking.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Navigation className="w-4 h-4 mr-2" />
                      )}
                      Mark In Progress
                    </Button>
                  )}
                  {selectedBooking.status.toLowerCase() === 'in_transit' && (
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleStatusUpdate(selectedBooking.id, 'COMPLETED')}
                      disabled={actionLoading === selectedBooking.id}
                    >
                      {actionLoading === selectedBooking.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Mark Completed
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-[#F97316] hover:bg-[#F97316]/90 text-white"
                      onClick={() => toast.info("Opening chat...")}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" /> Chat
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => toast.info("Calling...")}
                    >
                      <Phone className="w-4 h-4 mr-2" /> Call
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a booking to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
