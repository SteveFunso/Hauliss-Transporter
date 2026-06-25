import { useState, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  Plus,
  MapPin,
  CheckCircle,
  XCircle,
  Wrench,
  Truck as TruckIcon,
  Gauge,
  Weight,
  Eye,
  Edit,
  Settings,
  Filter,
  ChevronLeft,
  ChevronRight,
  Star
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
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import { getFleetAvailability, getFleetStats, getTruckTypes, createTruck, type FleetDriver, type TruckType } from '@/lib/api/fleet';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { MapView } from '@/components/ui/map-view';

export function Fleet() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedFleetDriver, setSelectedFleetDriver] = useState<FleetDriver | null>(null);

  // Dialog states
  const [addTruckOpen, setAddTruckOpen] = useState(false);
  const [editTruckOpen, setEditTruckOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<FleetDriver | null>(null);

  // Add truck form
  const [addForm, setAddForm] = useState({
    plate_number: '',
    vehicle_type: '',
    driver_name: '',
  });

  // Edit truck form
  const [editForm, setEditForm] = useState({
    plate_number: '',
    vehicle_type: '',
    driver_name: '',
  });

  const pagination = usePagination(20);

  const { data, isLoading, refetch } = useApi(
    () => getFleetAvailability({
      page: pagination.page,
      limit: pagination.limit,
      is_online: statusFilter === 'available' ? 'true' : statusFilter === 'offline' ? 'false' : undefined,
    }),
    [pagination.page, statusFilter]
  );

  const { data: truckTypesData } = useApi(() => getTruckTypes(), []);
  const { data: fleetStats, isLoading: statsLoading } = useApi(() => getFleetStats(), []);

  const fleetList: FleetDriver[] = (data as any)?.data || [];
  const paginationMeta = (data as any)?.pagination;
  const truckTypes: TruckType[] = Array.isArray(truckTypesData) ? truckTypesData : [];

  // Build Type filter options from the DISTINCT vehicle_type values actually
  // present in the fleet rows, so the filter compares like-with-like (the
  // catalog display names may differ from the value stored on the truck).
  const fleetVehicleTypes = Array.from(
    new Set(fleetList.map((d) => d.vehicle_type).filter((v): v is string => !!v))
  ).sort();

  // Sync pagination total when API response arrives
  useEffect(() => {
    if (paginationMeta?.total) {
      pagination.setTotal(paginationMeta.total);
    }
  }, [paginationMeta?.total]);

  // Client-side filtering for search and truck type (API may not support these filters)
  const filteredFleet = fleetList.filter((driver) => {
    const matchesSearch =
      !searchQuery ||
      driver.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.truck_plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.vehicle_type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || driver.vehicle_type?.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (isOnline: boolean) => {
    return isOnline
      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Available</Badge>
      : <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Offline</Badge>;
  };

  const getTruckTypeLabel = (type: string) => {
    if (!type) return '—';
    // Try to match from API truck types
    const found = truckTypes.find((t) => t.name?.toLowerCase() === type.toLowerCase());
    if (found) return found.name;
    // Fallback: capitalize the type string
    switch (type.toLowerCase()) {
      case 'flatbed':
        return 'Flatbed';
      case 'box_truck':
        return 'Box Truck';
      case 'tanker':
        return 'Tanker';
      case 'tipper':
        return 'Tipper';
      case 'refrigerated':
        return 'Refrigerated';
      default:
        return type;
    }
  };

  const handleAddTruck = async () => {
    if (!addForm.plate_number || !addForm.vehicle_type) {
      toast.error('Plate Number and Vehicle Type are required');
      return;
    }
    try {
      await createTruck({
        plate_number: addForm.plate_number,
        vehicle_type: addForm.vehicle_type,
        driver_name: addForm.driver_name || undefined,
      });
      toast.success(`Truck "${addForm.plate_number}" registered successfully`);
      setAddForm({ plate_number: '', vehicle_type: '', driver_name: '' });
      setAddTruckOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register truck');
    }
  };

  const handleEditTruck = async () => {
    if (!editingTruck) return;
    try {
      await createTruck({
        plate_number: editForm.plate_number,
        vehicle_type: editForm.vehicle_type,
        driver_name: editForm.driver_name || undefined,
        driver_id: editingTruck.driver_id,
      });
      toast.success(`Truck "${editForm.plate_number}" updated successfully`);
      setEditTruckOpen(false);
      setEditingTruck(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update truck');
    }
  };

  const openEditDialog = (driver: FleetDriver) => {
    setEditingTruck(driver);
    setEditForm({
      plate_number: driver.truck_plate_number || '',
      vehicle_type: driver.vehicle_type || '',
      driver_name: driver.driver_name || '',
    });
    setEditTruckOpen(true);
  };

  // Loading skeleton for table rows
  const TableRowSkeleton = () => (
    <TableRow>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-10" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded ml-auto" /></TableCell>
    </TableRow>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Fleet Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage trucks, track locations, and monitor fleet status
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={() => setAddTruckOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Add Truck
        </Button>
      </div>

      {/* Add Truck Dialog */}
      <Dialog open={addTruckOpen} onOpenChange={setAddTruckOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Register New Truck</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-plate">Plate Number *</Label>
              <Input
                id="add-plate"
                placeholder="ABC-123-XY"
                value={addForm.plate_number}
                onChange={(e) => setAddForm({ ...addForm, plate_number: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-type">Vehicle Type *</Label>
              <select
                id="add-type"
                value={addForm.vehicle_type}
                onChange={(e) => setAddForm({ ...addForm, vehicle_type: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="">Select type...</option>
                {truckTypes.map((tt) => (
                  <option key={tt.id} value={tt.name}>{tt.name}</option>
                ))}
                {truckTypes.length === 0 && (
                  <>
                    <option value="Flatbed">Flatbed</option>
                    <option value="Box Truck">Box Truck</option>
                    <option value="Tanker">Tanker</option>
                    <option value="Tipper">Tipper</option>
                    <option value="Refrigerated">Refrigerated</option>
                  </>
                )}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-driver">Driver Name</Label>
              <Input
                id="add-driver"
                placeholder="Driver full name"
                value={addForm.driver_name}
                onChange={(e) => setAddForm({ ...addForm, driver_name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTruckOpen(false)}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleAddTruck}>
              Register Truck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Truck Dialog */}
      <Dialog open={editTruckOpen} onOpenChange={setEditTruckOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Truck</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-plate">Plate Number</Label>
              <Input
                id="edit-plate"
                value={editForm.plate_number}
                onChange={(e) => setEditForm({ ...editForm, plate_number: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-type">Vehicle Type</Label>
              <select
                id="edit-type"
                value={editForm.vehicle_type}
                onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="">Select type...</option>
                {/* Keep the row's existing value selectable even if it isn't a
                    catalog name, so opening Edit doesn't blank the field. */}
                {editForm.vehicle_type &&
                  !truckTypes.some((tt) => tt.name === editForm.vehicle_type) && (
                    <option value={editForm.vehicle_type}>{getTruckTypeLabel(editForm.vehicle_type)}</option>
                  )}
                {truckTypes.map((tt) => (
                  <option key={tt.id} value={tt.name}>{tt.name}</option>
                ))}
                {truckTypes.length === 0 && (
                  <>
                    <option value="Flatbed">Flatbed</option>
                    <option value="Box Truck">Box Truck</option>
                    <option value="Tanker">Tanker</option>
                    <option value="Tipper">Tipper</option>
                    <option value="Refrigerated">Refrigerated</option>
                  </>
                )}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-driver">Driver Name</Label>
              <Input
                id="edit-driver"
                value={editForm.driver_name}
                onChange={(e) => setEditForm({ ...editForm, driver_name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTruckOpen(false)}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleEditTruck}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('all'); toast.info(`Showing all trucks`); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Trucks</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{fleetStats?.total?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                <TruckIcon className="w-6 h-6 text-[#F97316]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('available'); toast.info('Filtering: Available trucks'); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{fleetStats?.online?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => toast.info('In-transit tracking — view details')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Transit</p>
                <p className="text-2xl font-semibold">—</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('offline'); toast.info('Filtering: Offline trucks'); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{fleetStats?.offline?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => toast.info(`${truckTypes.length} truck types available`)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Truck Types</p>
                <p className="text-2xl font-semibold">{truckTypes.length || '—'}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Weight className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Map */}
      {!isLoading && filteredFleet.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#F97316]" />
              Fleet Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MapView
              height="350px"
              markers={filteredFleet
                .filter((d) => d.lat && d.lng)
                .map((d) => ({
                  lat: Number(d.lat),
                  lng: Number(d.lng),
                  label: d.driver_name || d.truck_plate_number || 'Unassigned',
                  color: d.is_online ? 'green' : 'gray',
                }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search trucks by plate number, driver, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                <option value="available">Available</option>
                <option value="offline">Offline</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Types</option>
                {fleetVehicleTypes.map((vt) => (
                  <option key={vt} value={vt}>{getTruckTypeLabel(vt)}</option>
                ))}
              </select>
              <Button variant="outline" size="icon" onClick={() => toast.info('Advanced filters — view details')}>
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trucks Table */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg">
                All Trucks ({paginationMeta?.total ?? filteredFleet.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Driver / Truck</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trips</TableHead>
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
                  ) : filteredFleet.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No fleet entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFleet.map((driver) => (
                      <TableRow
                        key={driver.driver_id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedFleetDriver(driver)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{driver.driver_name || driver.truck_plate_number || 'Unassigned'}</p>
                            <p className="text-sm text-muted-foreground">{driver.truck_plate_number || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {getTruckTypeLabel(driver.vehicle_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span className="font-medium">
                              {driver.rating != null ? Number(driver.rating).toFixed(1) : 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(driver.is_online)}</TableCell>
                        <TableCell>
                          <span className="font-medium">{driver.total_trips ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedFleetDriver(driver); }}>
                                <Eye className="w-4 h-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(driver); }}>
                                <Edit className="w-4 h-4 mr-2" /> Edit Truck
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info(`Opening live tracking for ${driver.truck_plate_number || driver.driver_name}...`); }}>
                                <MapPin className="w-4 h-4 mr-2" /> Track Location
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info(`Maintenance scheduled for ${driver.truck_plate_number || driver.driver_name}`); }}>
                                <Settings className="w-4 h-4 mr-2" /> Maintenance
                              </DropdownMenuItem>
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
                    Page {pagination.page} of {pagination.totalPages} ({paginationMeta.total} entries)
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

        {/* Fleet Driver Details Panel */}
        <div className="lg:col-span-1">
          {selectedFleetDriver ? (
            <Card className="border-0 shadow-sm sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display font-semibold text-lg">
                    Fleet Details
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedFleetDriver(null)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Header */}
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-xl bg-gradient-to-br from-[#F97316] to-[#111111] flex items-center justify-center mb-4">
                    <TruckIcon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg">{selectedFleetDriver.driver_name || selectedFleetDriver.truck_plate_number || 'Unassigned'}</h3>
                  <p className="text-muted-foreground">{selectedFleetDriver.truck_plate_number || '—'}</p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Star className="w-5 h-5 mx-auto mb-2 text-amber-500 fill-amber-500" />
                    <p className="text-lg font-semibold">{selectedFleetDriver.rating != null ? Number(selectedFleetDriver.rating).toFixed(1) : 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Gauge className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-lg font-semibold">{selectedFleetDriver.total_trips ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">Total Trips</p>
                  </div>
                </div>

                {/* Status & Location */}
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="mt-1">{getStatusBadge(selectedFleetDriver.is_online)}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Vehicle Type</span>
                    <div className="mt-1">
                      <Badge variant="outline">
                        {getTruckTypeLabel(selectedFleetDriver.vehicle_type)}
                      </Badge>
                    </div>
                  </div>
                  {selectedFleetDriver.lat && selectedFleetDriver.lng ? (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Last Known Location</span>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-4 h-4 text-[#F97316]" />
                        <span className="text-sm">
                          {Number(selectedFleetDriver.lat).toFixed(4)}, {Number(selectedFleetDriver.lng).toFixed(4)}
                        </span>
                      </div>
                      <MapView
                        height="200px"
                        center={{ lat: Number(selectedFleetDriver.lat), lng: Number(selectedFleetDriver.lng) }}
                        zoom={15}
                        markers={[{
                          lat: Number(selectedFleetDriver.lat),
                          lng: Number(selectedFleetDriver.lng),
                          label: selectedFleetDriver.driver_name || selectedFleetDriver.truck_plate_number || 'Unassigned',
                          color: selectedFleetDriver.is_online ? 'green' : 'gray',
                        }]}
                      />
                    </div>
                  ) : null}
                  {selectedFleetDriver.minutes_away != null && (
                    <div>
                      <span className="text-sm text-muted-foreground">ETA</span>
                      <p className="text-sm mt-1">{selectedFleetDriver.minutes_away} min away</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-muted-foreground">Last Updated</span>
                    <p className="text-sm mt-1">
                      {selectedFleetDriver.updated_at
                        ? new Date(selectedFleetDriver.updated_at).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-[#F97316] hover:bg-[#F97316]/90 text-white"
                    onClick={() => toast.info(`Opening live tracking for ${selectedFleetDriver.truck_plate_number || selectedFleetDriver.driver_name}...`)}
                  >
                    <MapPin className="w-4 h-4 mr-2" /> Track Location
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast.info(`Maintenance scheduled for ${selectedFleetDriver.truck_plate_number || selectedFleetDriver.driver_name}`)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a truck to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
