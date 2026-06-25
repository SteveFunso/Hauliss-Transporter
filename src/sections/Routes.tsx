import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Route,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Map,
  ArrowRight,
  MoreVertical,
  Navigation,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapView } from '@/components/ui/map-view';
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import {
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  getCoverageAreas,
  createCoverageArea,
  deleteCoverageArea,
  getRoutePricing,
  upsertRoutePricing,
  type CompanyRoute,
  type CoverageArea,
  type RoutePricing,
} from '@/lib/api/routes';
import { toast } from 'sonner';

const defaultRouteForm = {
  name: '',
  origin_address: '',
  destination_address: '',
  distance_km: '',
  estimated_duration_mins: '',
};

const defaultAreaForm = {
  area_name: '',
  city: '',
  state: '',
  zone_type: 'coverage',
  radius_km: '',
};

const defaultPricingForm = {
  truck_type: 'flatbed',
  pricing_type: 'per_km',
  base_fare: '',
  per_km_rate: '',
  per_stop_rate: '',
  flat_rate: '',
};

const TRUCK_TYPES = [
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'box_truck', label: 'Box Truck' },
  { value: 'tanker', label: 'Tanker' },
  { value: 'tipper', label: 'Tipper' },
  { value: 'refrigerated', label: 'Refrigerated' },
];

const PRICING_TYPES = [
  { value: 'per_km', label: 'Per KM' },
  { value: 'per_stop', label: 'Per Stop' },
  { value: 'flat_rate', label: 'Flat Rate' },
];

const ZONE_TYPES = [
  { value: 'coverage', label: 'Coverage' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'premium', label: 'Premium' },
];

const zoneColorMap: Record<string, string> = {
  coverage: 'bg-emerald-100 text-emerald-700',
  restricted: 'bg-red-100 text-red-700',
  premium: 'bg-amber-100 text-amber-700',
};

function formatMinor(amountMinor: number): string {
  return `\u20A6${(amountMinor / 100).toLocaleString()}`;
}

function toMinor(display: string): number {
  return Math.round(Number(display) * 100);
}

// ─── Service Routes Tab ─────────────────────────────────────────────────────

function ServiceRoutesTab() {
  const { page, limit, total, totalPages, setTotal, nextPage, prevPage } = usePagination(10);
  const { data, isLoading, refetch } = useApi(() => getRoutes({ page, limit }), [page, limit]);
  const [routes, setRoutes] = useState<CompanyRoute[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CompanyRoute | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultRouteForm);
  const [submitting, setSubmitting] = useState(false);

  // Geocoded coordinates for map preview
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  useAddressAutocomplete(originInputRef, (place) => {
    setFormData((prev) => ({ ...prev, origin_address: place.address }));
    setOriginCoords({ lat: place.lat, lng: place.lng });
  });

  useAddressAutocomplete(destInputRef, (place) => {
    setFormData((prev) => ({ ...prev, destination_address: place.address }));
    setDestCoords({ lat: place.lat, lng: place.lng });
  });

  // Build route map markers
  const routeMapMarkers = useMemo(() => {
    const m: Array<{ lat: number; lng: number; label?: string; color?: string }> = [];
    if (originCoords) m.push({ ...originCoords, label: 'Origin', color: 'green' });
    if (destCoords) m.push({ ...destCoords, label: 'Destination', color: 'red' });
    return m;
  }, [originCoords, destCoords]);

  const routeMapRoute = useMemo(() => {
    if (originCoords && destCoords) {
      return { origin: originCoords, destination: destCoords };
    }
    return undefined;
  }, [originCoords, destCoords]);

  useEffect(() => {
    if (data) {
      const list = Array.isArray(data) ? data : (data as any).data ?? [];
      setRoutes(list);
      const pag = (data as any).pagination;
      if (pag) setTotal(pag.total);
    }
  }, [data, setTotal]);

  const activeCount = routes.filter((r) => r.is_active).length;
  const inactiveCount = routes.length - activeCount;

  const openEdit = (route: CompanyRoute) => {
    setEditingRoute(route);
    setFormData({
      name: route.name,
      origin_address: route.origin_address,
      destination_address: route.destination_address,
      distance_km: String(route.distance_km),
      estimated_duration_mins: String(route.estimated_duration_mins),
    });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRoute(null);
    setFormData(defaultRouteForm);
    setOriginCoords(null);
    setDestCoords(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a route name');
      return;
    }
    if (!formData.origin_address.trim() || !formData.destination_address.trim()) {
      toast.error('Please enter origin and destination addresses');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        origin_address: formData.origin_address,
        destination_address: formData.destination_address,
        distance_km: Number(formData.distance_km) || 0,
        estimated_duration_mins: Number(formData.estimated_duration_mins) || 0,
      };
      if (editingRoute) {
        await updateRoute(editingRoute.id, payload);
        toast.success('Route updated');
      } else {
        await createRoute(payload);
        toast.success('Route created');
      }
      closeForm();
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save route');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (route: CompanyRoute) => {
    try {
      await updateRoute(route.id, { is_active: !route.is_active });
      toast.success(`Route ${route.is_active ? 'deactivated' : 'activated'}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteRoute(deleteConfirmId);
      toast.success('Route deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete route');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
                <Route className="w-5 h-5 text-[#F97316]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Routes</p>
                <p className="text-2xl font-bold">{total || routes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Routes</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Route className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inactive Routes</p>
                <p className="text-2xl font-bold">{inactiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Routes Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display font-semibold text-lg">Service Routes</CardTitle>
          <Button
            className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4" />
            Add Route
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-60" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              ))}
            </div>
          ) : routes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Route className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No routes configured</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first service route to get started.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Origin &rarr; Destination</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map((route) => (
                    <TableRow key={route.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#F97316]/10 flex items-center justify-center text-[#F97316]">
                            <Route className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{route.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="truncate max-w-[140px]" title={route.origin_address}>
                            {route.origin_address}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[140px]" title={route.destination_address}>
                            {route.destination_address}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{route.distance_km} km</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{route.estimated_duration_mins} mins</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={route.is_active}
                            onCheckedChange={() => handleToggleActive(route)}
                          />
                          <Badge className={route.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}>
                            {route.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(route)}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteConfirmId(route.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} routes)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={prevPage} disabled={page <= 1}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextPage} disabled={page >= totalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Route Form Dialog */}
      <Dialog open={showForm || !!editingRoute} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">
              {editingRoute ? 'Edit Route' : 'Add New Route'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Route Name</Label>
              <Input
                placeholder="e.g., Lagos - Abuja Express"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Origin Address</Label>
              <Input
                ref={originInputRef}
                placeholder="e.g., Apapa Port, Lagos"
                value={formData.origin_address}
                onChange={(e) => setFormData({ ...formData, origin_address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Destination Address</Label>
              <Input
                ref={destInputRef}
                placeholder="e.g., Kubwa Industrial Zone, Abuja"
                value={formData.destination_address}
                onChange={(e) => setFormData({ ...formData, destination_address: e.target.value })}
              />
            </div>
            {routeMapMarkers.length > 0 && (
              <MapView
                height="200px"
                markers={routeMapMarkers}
                route={routeMapRoute}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.distance_km}
                  onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Est. Duration (mins)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.estimated_duration_mins}
                  onChange={(e) => setFormData({ ...formData, estimated_duration_mins: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingRoute ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this route? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Coverage Areas Tab ─────────────────────────────────────────────────────

function CoverageAreasTab() {
  const { data, isLoading, refetch } = useApi(() => getCoverageAreas(), []);
  const [areas, setAreas] = useState<CoverageArea[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultAreaForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data) {
      const list = Array.isArray(data) ? data : (data as any).data ?? [];
      setAreas(list);
    }
  }, [data]);

  const closeForm = () => {
    setShowForm(false);
    setFormData(defaultAreaForm);
  };

  const handleSubmit = async () => {
    if (!formData.area_name.trim()) {
      toast.error('Please enter an area name');
      return;
    }
    if (!formData.city.trim() || !formData.state.trim()) {
      toast.error('Please enter city and state');
      return;
    }
    setSubmitting(true);
    try {
      await createCoverageArea({
        area_name: formData.area_name,
        city: formData.city,
        state: formData.state,
        zone_type: formData.zone_type,
        radius_km: Number(formData.radius_km) || 0,
      });
      toast.success('Coverage area created');
      closeForm();
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create coverage area');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteCoverageArea(deleteConfirmId);
      toast.success('Coverage area deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete coverage area');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-lg">Coverage Areas</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Define service zones and restricted areas for your fleet
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-4 h-4" />
          Add Area
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : areas.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Map className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No coverage areas defined</p>
            <p className="text-sm text-muted-foreground mt-1">Add areas to define your service zones.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas.map((area) => (
            <Card key={area.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#F97316]" />
                      <h4 className="font-semibold">{area.area_name}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {area.city}, {area.state}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge className={zoneColorMap[area.zone_type] || 'bg-gray-100 text-gray-700'}>
                        {area.zone_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {area.radius_km} km radius
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteConfirmId(area.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Area Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Add Coverage Area</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Area Name</Label>
              <Input
                placeholder="e.g., Lagos Mainland"
                value={formData.area_name}
                onChange={(e) => setFormData({ ...formData, area_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  placeholder="e.g., Lagos"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  placeholder="e.g., Lagos"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zone Type</Label>
                <Select
                  value={formData.zone_type}
                  onValueChange={(value) => setFormData({ ...formData, zone_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONE_TYPES.map((z) => (
                      <SelectItem key={z.value} value={z.value}>
                        {z.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Radius (km)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.radius_km}
                  onChange={(e) => setFormData({ ...formData, radius_km: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this coverage area? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Route Pricing Tab ──────────────────────────────────────────────────────

function RoutePricingTab() {
  const { data: routesData, isLoading: routesLoading } = useApi(() => getRoutes({ limit: 100 }), []);
  const [routes, setRoutes] = useState<CompanyRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [pricingList, setPricingList] = useState<RoutePricing[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPricing, setEditingPricing] = useState<RoutePricing | null>(null);
  const [formData, setFormData] = useState(defaultPricingForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (routesData) {
      const list = Array.isArray(routesData) ? routesData : (routesData as any).data ?? [];
      setRoutes(list);
    }
  }, [routesData]);

  useEffect(() => {
    if (!selectedRouteId) {
      setPricingList([]);
      return;
    }
    const fetchPricing = async () => {
      setPricingLoading(true);
      try {
        const res = await getRoutePricing(selectedRouteId);
        const list = Array.isArray(res) ? res : (res as any).data ?? [];
        setPricingList(list);
      } catch {
        setPricingList([]);
      } finally {
        setPricingLoading(false);
      }
    };
    fetchPricing();
  }, [selectedRouteId]);

  const refetchPricing = async () => {
    if (!selectedRouteId) return;
    setPricingLoading(true);
    try {
      const res = await getRoutePricing(selectedRouteId);
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      setPricingList(list);
    } catch {
      setPricingList([]);
    } finally {
      setPricingLoading(false);
    }
  };

  const openEdit = (pricing: RoutePricing) => {
    setEditingPricing(pricing);
    setFormData({
      truck_type: pricing.truck_type,
      pricing_type: pricing.pricing_type,
      base_fare: String(pricing.base_fare_minor / 100),
      per_km_rate: String(pricing.per_km_rate_minor / 100),
      per_stop_rate: String(pricing.per_stop_rate_minor / 100),
      flat_rate: String(pricing.flat_rate_minor / 100),
    });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPricing(null);
    setFormData(defaultPricingForm);
  };

  const handleSubmit = async () => {
    if (!selectedRouteId) {
      toast.error('Please select a route first');
      return;
    }
    setSubmitting(true);
    try {
      await upsertRoutePricing({
        route_id: selectedRouteId,
        truck_type: formData.truck_type,
        pricing_type: formData.pricing_type,
        base_fare_minor: toMinor(formData.base_fare),
        per_km_rate_minor: toMinor(formData.per_km_rate),
        per_stop_rate_minor: toMinor(formData.per_stop_rate),
        flat_rate_minor: toMinor(formData.flat_rate),
      });
      toast.success(editingPricing ? 'Pricing updated' : 'Pricing added');
      closeForm();
      refetchPricing();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save pricing');
    } finally {
      setSubmitting(false);
    }
  };

  const pricingTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      per_km: 'bg-blue-100 text-blue-700',
      per_stop: 'bg-purple-100 text-purple-700',
      flat_rate: 'bg-[#F97316]/10 text-[#F97316]',
    };
    const labels: Record<string, string> = {
      per_km: 'Per KM',
      per_stop: 'Per Stop',
      flat_rate: 'Flat Rate',
    };
    return (
      <Badge className={colors[type] || 'bg-gray-100 text-gray-700'}>
        {labels[type] || type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold text-lg">Route Pricing</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure pricing for each route by truck type
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={() => setShowForm(true)}
          disabled={!selectedRouteId}
        >
          <Plus className="w-4 h-4" />
          Add Pricing
        </Button>
      </div>

      {/* Route Selector */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Select Route</Label>
            {routesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a route to view pricing..." />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name} ({route.origin_address} &rarr; {route.destination_address})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Table */}
      {selectedRouteId && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#F97316]" />
              Pricing for {routes.find((r) => r.id === selectedRouteId)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pricingLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : pricingList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="w-12 h-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">No pricing configured</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add pricing rules for this route.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Truck Type</TableHead>
                    <TableHead>Pricing Type</TableHead>
                    <TableHead>Base Fare</TableHead>
                    <TableHead>Per-KM Rate</TableHead>
                    <TableHead>Per-Stop Rate</TableHead>
                    <TableHead>Flat Rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingList.map((pricing) => (
                    <TableRow key={pricing.id} className="hover:bg-muted/50">
                      <TableCell>
                        <span className="font-medium capitalize">
                          {pricing.truck_type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell>{pricingTypeBadge(pricing.pricing_type)}</TableCell>
                      <TableCell>{formatMinor(pricing.base_fare_minor)}</TableCell>
                      <TableCell>{formatMinor(pricing.per_km_rate_minor)}</TableCell>
                      <TableCell>{formatMinor(pricing.per_stop_rate_minor)}</TableCell>
                      <TableCell>{formatMinor(pricing.flat_rate_minor)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(pricing)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pricing Form Dialog */}
      <Dialog open={showForm || !!editingPricing} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">
              {editingPricing ? 'Edit Pricing' : 'Add Route Pricing'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Truck Type</Label>
                <Select
                  value={formData.truck_type}
                  onValueChange={(value) => setFormData({ ...formData, truck_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUCK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pricing Type</Label>
                <Select
                  value={formData.pricing_type}
                  onValueChange={(value) => setFormData({ ...formData, pricing_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_TYPES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Fare (NGN)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.base_fare}
                  onChange={(e) => setFormData({ ...formData, base_fare: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Per-KM Rate (NGN)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.per_km_rate}
                  onChange={(e) => setFormData({ ...formData, per_km_rate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Per-Stop Rate (NGN)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.per_stop_rate}
                  onChange={(e) => setFormData({ ...formData, per_stop_rate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Flat Rate (NGN)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.flat_rate}
                  onChange={(e) => setFormData({ ...formData, flat_rate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingPricing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Routes Section ────────────────────────────────────────────────────

export function Routes() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display font-semibold text-2xl text-foreground">Routes & Coverage</h2>
        <p className="text-muted-foreground mt-1">
          Manage service routes, coverage areas, and route pricing
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="routes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="routes" className="gap-2">
            <Route className="w-4 h-4" />
            Service Routes
          </TabsTrigger>
          <TabsTrigger value="coverage" className="gap-2">
            <Map className="w-4 h-4" />
            Coverage Areas
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Route Pricing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <ServiceRoutesTab />
        </TabsContent>

        <TabsContent value="coverage">
          <CoverageAreasTab />
        </TabsContent>

        <TabsContent value="pricing">
          <RoutePricingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
