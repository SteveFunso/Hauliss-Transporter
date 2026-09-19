import { useEffect, useMemo, useState } from 'react';
import {
  Search, MoreVertical, Plus, MapPin, CheckCircle, XCircle, Wrench, Truck as TruckIcon, Gauge, Weight,
  Eye, Edit, Trash2, ChevronLeft, ChevronRight, Star, UserPlus, RotateCcw, Fuel,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { MapView } from '@/components/ui/map-view';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import {
  getTrucks, getFleetAvailability, getFleetStats, getTruckTypes, createTruck, updateTruck, setTruckStatus,
  assignTruckDriver, deleteTruck, type Truck, type TruckStatus, type FleetDriver, type TruckType, type TruckInput,
} from '@/lib/api/fleet';
import { getDrivers, type AdminDriver } from '@/lib/api/drivers';
import { TRACKING_FOCUS_KEY } from '@/sections/LiveTracking';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// QA 2026-09 rewrite. Fleet Management now reads and writes the TRUCKS REGISTER:
//  - Edit Truck PATCHes the truck by id (it used to POST a new truck and 409 on the plate).
//  - KPI cards and the list share one source, so Total / Available / Offline / Maintenance add up.
//  - Maintenance, Track Location and Delete are real actions (no "coming soon", no window.confirm).

const FUEL_TYPES = ['diesel', 'petrol', 'cng', 'lpg', 'electric', 'hybrid'];
const FALLBACK_TYPES = ['Flatbed', 'Box Truck', 'Tanker', 'Tipper', 'Refrigerated', 'Mini Van'];

type TruckForm = {
  plate_number: string; vehicle_type: string; make: string; model: string; year: string;
  capacity_tons: string; fuel_type: string; tank_capacity_litres: string; fuel_efficiency_km_per_litre: string; notes: string; driver_id: string;
};
const emptyForm: TruckForm = {
  plate_number: '', vehicle_type: '', make: '', model: '', year: '', capacity_tons: '', fuel_type: '',
  tank_capacity_litres: '', fuel_efficiency_km_per_litre: '', notes: '', driver_id: '',
};

const titleCase = (s: string) => s.split(/[\s_-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function navigateToTracking(driverId: string | null) {
  if (driverId) sessionStorage.setItem(TRACKING_FOCUS_KEY, driverId);
  window.dispatchEvent(new CustomEvent('navigate:section', { detail: 'tracking' }));
}

function formToInput(f: TruckForm): TruckInput {
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  return {
    plate_number: f.plate_number.trim(), vehicle_type: f.vehicle_type, make: f.make.trim() || null, model: f.model.trim() || null,
    year: num(f.year), capacity_tons: num(f.capacity_tons), fuel_type: f.fuel_type || null,
    tank_capacity_litres: num(f.tank_capacity_litres), fuel_efficiency_km_per_litre: num(f.fuel_efficiency_km_per_litre), notes: f.notes.trim() || null,
  };
}

export function Fleet() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TruckStatus | 'online' | 'offline'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Truck | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Truck | null>(null);
  const [form, setForm] = useState<TruckForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [assignFor, setAssignFor] = useState<Truck | null>(null);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [maintenanceFor, setMaintenanceFor] = useState<Truck | null>(null);
  const [maintenanceNote, setMaintenanceNote] = useState('');
  const [deleteFor, setDeleteFor] = useState<Truck | null>(null);

  const pagination = usePagination(20);
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchQuery), 300); return () => clearTimeout(t); }, [searchQuery]);

  const registerStatus = statusFilter === 'active' || statusFilter === 'maintenance' || statusFilter === 'retired' ? statusFilter : undefined;
  const { data, isLoading, refetch } = useApi(
    () => getTrucks({ page: pagination.page, limit: pagination.limit, search: debouncedSearch || undefined, status: registerStatus }),
    [pagination.page, pagination.limit, debouncedSearch, registerStatus]
  );
  const { data: availabilityData, refetch: refetchAvailability } = useApi(() => getFleetAvailability({ page: 1, limit: 100 }), []);
  const { data: truckTypesData } = useApi(() => getTruckTypes(), []);
  const { data: fleetStats, isLoading: statsLoading, refetch: refetchStats } = useApi(() => getFleetStats(), []);
  const { data: driversData } = useApi(() => getDrivers({ page: 1, limit: 100 }), []);

  const trucks: Truck[] = (data as any)?.data || [];
  const paginationMeta = (data as any)?.pagination;
  const truckTypes: TruckType[] = Array.isArray(truckTypesData) ? truckTypesData : [];
  const drivers: AdminDriver[] = (driversData as any)?.data || [];
  const availability: FleetDriver[] = (availabilityData as any)?.data || [];
  const liveByDriver = useMemo(() => new Map(availability.map((a) => [a.driver_id, a])), [availability]);
  const liveFor = (t: Truck) => (t.assigned_driver_id ? liveByDriver.get(t.assigned_driver_id) : undefined);

  useEffect(() => { if (paginationMeta?.total != null) pagination.setTotal(paginationMeta.total); }, [paginationMeta?.total]);

  const refreshAll = () => { refetch(); refetchStats(); refetchAvailability(); };

  const vehicleTypes = useMemo(() => Array.from(new Set(trucks.map((t) => t.vehicle_type).filter(Boolean))).sort(), [trucks]);
  const filtered = trucks.filter((t) => {
    const matchesType = typeFilter === 'all' || t.vehicle_type === typeFilter;
    const matchesOnline = statusFilter === 'online' ? t.is_online : statusFilter === 'offline' ? !t.is_online && t.status === 'active' : true;
    return matchesType && matchesOnline;
  });

  const typeLabel = (v: string) => truckTypes.find((tt) => tt.name.toLowerCase() === (v || '').toLowerCase())?.name || titleCase(v || '');
  const typeOptions = truckTypes.length ? truckTypes.map((tt) => tt.name) : FALLBACK_TYPES;

  const statusBadge = (t: Truck) => {
    if (t.status === 'maintenance') return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">In maintenance</Badge>;
    if (t.status === 'retired') return <Badge className="bg-gray-200 text-gray-700 hover:bg-gray-200">Retired</Badge>;
    return t.is_online
      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Available</Badge>
      : <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Offline</Badge>;
  };

  // ---- actions -------------------------------------------------------------
  const openAdd = () => { setForm(emptyForm); setAddOpen(true); };
  const openEdit = (t: Truck) => {
    setEditing(t);
    setForm({
      plate_number: t.plate_number || '', vehicle_type: t.vehicle_type || '', make: t.make || '', model: t.model || '', year: t.year?.toString() || '',
      capacity_tons: t.capacity_tons?.toString() || '', fuel_type: t.fuel_type || '', tank_capacity_litres: t.tank_capacity_litres?.toString() || '',
      fuel_efficiency_km_per_litre: t.fuel_efficiency_km_per_litre?.toString() || '', notes: t.notes || '', driver_id: t.assigned_driver_id || '',
    });
    setEditOpen(true);
  };

  const validate = () => {
    if (!form.plate_number.trim() || !form.vehicle_type) { toast.error('Plate Number and Vehicle Type are required'); return false; }
    for (const [k, label] of [['year', 'Year'], ['capacity_tons', 'Capacity'], ['tank_capacity_litres', 'Tank capacity'], ['fuel_efficiency_km_per_litre', 'Fuel efficiency']] as const) {
      const v = form[k]; if (v.trim() !== '' && !Number.isFinite(Number(v))) { toast.error(`${label} must be a number`); return false; }
    }
    return true;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const input = formToInput(form);
      await createTruck({ ...input, plate_number: input.plate_number!, vehicle_type: input.vehicle_type!, driver_id: form.driver_id || undefined });
      toast.success(`Truck "${form.plate_number.trim().toUpperCase()}" registered successfully`);
      setAddOpen(false); refreshAll();
    } catch (err: any) { toast.error(err.message || 'Failed to register truck'); } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    try {
      await updateTruck(editing.id, formToInput(form));
      if ((form.driver_id || null) !== (editing.assigned_driver_id || null)) await assignTruckDriver(editing.id, form.driver_id || null);
      toast.success(`Truck "${form.plate_number.trim().toUpperCase()}" updated successfully`);
      setEditOpen(false); setEditing(null); setSelected(null); refreshAll();
    } catch (err: any) { toast.error(err.message || 'Failed to update truck'); } finally { setSaving(false); }
  };

  const handleAssign = async () => {
    if (!assignFor) return;
    setSaving(true);
    try {
      await assignTruckDriver(assignFor.id, assignDriverId || null);
      toast.success(assignDriverId ? `Driver assigned to ${assignFor.plate_number}` : `${assignFor.plate_number} is now unassigned`);
      setAssignFor(null); setSelected(null); refreshAll();
    } catch (err: any) { toast.error(err.message || 'Failed to assign driver'); } finally { setSaving(false); }
  };

  const handleMaintenance = async () => {
    if (!maintenanceFor) return;
    const toMaintenance = maintenanceFor.status !== 'maintenance';
    setSaving(true);
    try {
      await setTruckStatus(maintenanceFor.id, toMaintenance ? 'maintenance' : 'active', toMaintenance && maintenanceNote.trim() ? `Maintenance: ${maintenanceNote.trim()}` : undefined);
      toast.success(toMaintenance ? `${maintenanceFor.plate_number} marked as in maintenance` : `${maintenanceFor.plate_number} returned to service`);
      setMaintenanceFor(null); setMaintenanceNote(''); setSelected(null); refreshAll();
    } catch (err: any) { toast.error(err.message || 'Failed to update truck status'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    setSaving(true);
    try {
      await deleteTruck(deleteFor.id);
      toast.success(`Truck "${deleteFor.plate_number}" deleted successfully`);
      if (selected?.id === deleteFor.id) setSelected(null);
      setDeleteFor(null); refreshAll();
    } catch (err: any) { toast.error(err.message || 'Failed to delete truck'); } finally { setSaving(false); }
  };

  // ---- form ----------------------------------------------------------------
  const TruckFields = ({ idPrefix }: { idPrefix: string }) => (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-plate`}>Plate Number *</Label>
          <Input id={`${idPrefix}-plate`} placeholder="ABC-123-XY" value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-type`}>Vehicle Type *</Label>
          <select id={`${idPrefix}-type`} value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20">
            <option value="">Select type…</option>
            {form.vehicle_type && !typeOptions.some((n) => n.toLowerCase() === form.vehicle_type.toLowerCase()) && <option value={form.vehicle_type}>{typeLabel(form.vehicle_type)}</option>}
            {typeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2"><Label htmlFor={`${idPrefix}-make`}>Make</Label><Input id={`${idPrefix}-make`} placeholder="MAN" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
        <div className="grid gap-2"><Label htmlFor={`${idPrefix}-model`}>Model</Label><Input id={`${idPrefix}-model`} placeholder="TGS" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
        <div className="grid gap-2"><Label htmlFor={`${idPrefix}-year`}>Year</Label><Input id={`${idPrefix}-year`} inputMode="numeric" placeholder="2020" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2"><Label htmlFor={`${idPrefix}-cap`}>Capacity (tons)</Label><Input id={`${idPrefix}-cap`} inputMode="decimal" placeholder="15" value={form.capacity_tons} onChange={(e) => setForm({ ...form, capacity_tons: e.target.value })} /></div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-fuel`}>Fuel</Label>
          <select id={`${idPrefix}-fuel`} value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20">
            <option value="">—</option>{FUEL_TYPES.map((f) => <option key={f} value={f}>{titleCase(f)}</option>)}
          </select>
        </div>
        <div className="grid gap-2"><Label htmlFor={`${idPrefix}-tank`}>Tank (litres)</Label><Input id={`${idPrefix}-tank`} inputMode="decimal" placeholder="400" value={form.tank_capacity_litres} onChange={(e) => setForm({ ...form, tank_capacity_litres: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label htmlFor={`${idPrefix}-eff`}>Fuel efficiency (km/L)</Label><Input id={`${idPrefix}-eff`} inputMode="decimal" placeholder="3.5" value={form.fuel_efficiency_km_per_litre} onChange={(e) => setForm({ ...form, fuel_efficiency_km_per_litre: e.target.value })} /></div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-driver`}>Assigned driver</Label>
          <select id={`${idPrefix}-driver`} value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20">
            <option value="">Unassigned</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name || d.email}{d.status !== 'active' ? ` (${d.status})` : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-2"><Label htmlFor={`${idPrefix}-notes`}>Notes</Label><Textarea id={`${idPrefix}-notes`} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
    </div>
  );

  const TableRowSkeleton = () => (
    <TableRow>
      <TableCell><div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div></TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell><TableCell><Skeleton className="h-4 w-10" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded ml-auto" /></TableCell>
    </TableRow>
  );

  const kpis = [
    { key: 'all', label: 'Total Trucks', value: fleetStats?.total, icon: TruckIcon, bg: 'bg-[#F97316]/10', fg: 'text-[#F97316]' },
    { key: 'online', label: 'Available', value: fleetStats?.online, icon: CheckCircle, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
    { key: 'offline', label: 'Offline', value: fleetStats?.offline, icon: XCircle, bg: 'bg-gray-100', fg: 'text-gray-600' },
    { key: 'maintenance', label: 'In Maintenance', value: fleetStats?.maintenance ?? 0, icon: Wrench, bg: 'bg-amber-100', fg: 'text-amber-600' },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Fleet Management</h2>
          <p className="text-muted-foreground mt-1">Register trucks, assign drivers, and keep the fleet in service</p>
        </div>
        <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2" onClick={openAdd}><Plus className="w-4 h-4" />Add Truck</Button>
      </div>

      {/* Stats: every figure comes from the trucks register, so they add up and match the list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <Card key={k.key} className={cn('border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow', statusFilter === k.key && 'ring-2 ring-[#F97316]/40')}
            onClick={() => { setStatusFilter(k.key as any); pagination.setPage(1); }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{k.label}</p>
                  {statsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-semibold">{k.value?.toLocaleString() ?? '—'}</p>}
                </div>
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', k.bg)}><k.icon className={cn('w-6 h-6', k.fg)} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Truck Types</p><p className="text-2xl font-semibold">{truckTypes.length || vehicleTypes.length || '—'}</p></div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center"><Weight className="w-6 h-6 text-purple-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet map: trucks whose assigned driver has reported a position */}
      {availability.some((a) => a.lat && a.lng) && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display font-semibold text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-[#F97316]" />Fleet Locations</CardTitle>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigateToTracking(null)}><MapPin className="w-4 h-4" />Open Live Tracking</Button>
          </CardHeader>
          <CardContent>
            <MapView height="320px" markers={availability.filter((a) => a.lat && a.lng).map((a) => ({
              lat: Number(a.lat), lng: Number(a.lng), label: `${a.truck_plate_number || 'No plate'} · ${a.driver_name || 'Unassigned'}`, color: a.is_online ? 'green' : 'gray',
            }))} />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search trucks by plate number, driver, or type..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); pagination.setPage(1); }} className="pl-9" />
            </div>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); pagination.setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20">
                <option value="all">All Status</option>
                <option value="online">Available (online)</option>
                <option value="offline">Offline</option>
                <option value="active">In service</option>
                <option value="maintenance">In maintenance</option>
                <option value="retired">Retired</option>
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20">
                <option value="all">All Types</option>
                {vehicleTypes.map((vt) => <option key={vt} value={vt}>{typeLabel(vt)}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trucks table */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="font-display font-semibold text-lg">All Trucks ({paginationMeta?.total ?? filtered.length})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Truck / Driver</TableHead><TableHead>Type</TableHead><TableHead>Capacity</TableHead>
                    <TableHead>Status</TableHead><TableHead>Trips</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (<><TableRowSkeleton /><TableRowSkeleton /><TableRowSkeleton /><TableRowSkeleton /><TableRowSkeleton /></>)
                  : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No trucks match these filters. Register one with “Add Truck”.</TableCell></TableRow>
                  ) : filtered.map((t) => {
                    const live = liveFor(t);
                    return (
                      <TableRow key={t.id} className={cn('hover:bg-muted/50 cursor-pointer', selected?.id === t.id && 'bg-muted/40')} onClick={() => setSelected(t)}>
                        <TableCell>
                          <p className="font-medium text-foreground">{t.plate_number}</p>
                          <p className="text-sm text-muted-foreground">{t.assigned_driver_name || 'Unassigned'}{t.make || t.model ? ` · ${[t.make, t.model].filter(Boolean).join(' ')}` : ''}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-normal">{typeLabel(t.vehicle_type)}</Badge></TableCell>
                        <TableCell>{t.capacity_tons != null ? `${t.capacity_tons} t` : '—'}</TableCell>
                        <TableCell>{statusBadge(t)}</TableCell>
                        <TableCell><span className="font-medium">{live?.total_trips ?? '—'}</span></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${t.plate_number}`} onClick={(e) => e.stopPropagation()}><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelected(t); }}><Eye className="w-4 h-4 mr-2" /> View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(t); }}><Edit className="w-4 h-4 mr-2" /> Edit Truck</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAssignDriverId(t.assigned_driver_id || ''); setAssignFor(t); }}><UserPlus className="w-4 h-4 mr-2" /> Assign Driver</DropdownMenuItem>
                              <DropdownMenuItem disabled={!t.assigned_driver_id} onClick={(e) => { e.stopPropagation(); navigateToTracking(t.assigned_driver_id); }}>
                                <MapPin className="w-4 h-4 mr-2" /> Track Location{!t.assigned_driver_id && <span className="ml-1 text-xs text-muted-foreground">(no driver)</span>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMaintenanceNote(''); setMaintenanceFor(t); }}>
                                {t.status === 'maintenance' ? <><RotateCcw className="w-4 h-4 mr-2" /> Return to Service</> : <><Wrench className="w-4 h-4 mr-2" /> Mark In Maintenance</>}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => { e.stopPropagation(); setDeleteFor(t); }}><Trash2 className="w-4 h-4 mr-2" /> Delete Truck</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {paginationMeta && paginationMeta.total_pages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages} ({paginationMeta.total} trucks)</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={pagination.prevPage} disabled={pagination.page <= 1}><ChevronLeft className="w-4 h-4 mr-1" />Previous</Button>
                    <Button variant="outline" size="sm" onClick={pagination.nextPage} disabled={pagination.page >= pagination.totalPages}>Next<ChevronRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details panel */}
        <div className="lg:col-span-1">
          {selected ? (() => { const live = liveFor(selected); return (
            <Card className="border-0 shadow-sm sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display font-semibold text-lg">Truck Details</CardTitle>
                  <Button variant="ghost" size="icon" aria-label="Close details" onClick={() => setSelected(null)}><XCircle className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-xl bg-gradient-to-br from-[#F97316] to-[#111111] flex items-center justify-center mb-4"><TruckIcon className="w-10 h-10 text-white" /></div>
                  <h3 className="font-semibold text-lg">{selected.plate_number}</h3>
                  <p className="text-muted-foreground">{[selected.make, selected.model, selected.year].filter(Boolean).join(' ') || typeLabel(selected.vehicle_type)}</p>
                  <div className="mt-2">{statusBadge(selected)}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 text-center"><Star className="w-5 h-5 mx-auto mb-2 text-amber-500 fill-amber-500" /><p className="text-lg font-semibold">{live?.rating != null ? Number(live.rating).toFixed(1) : 'N/A'}</p><p className="text-xs text-muted-foreground">Driver rating</p></div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center"><Gauge className="w-5 h-5 mx-auto mb-2 text-muted-foreground" /><p className="text-lg font-semibold">{live?.total_trips ?? '—'}</p><p className="text-xs text-muted-foreground">Total trips</p></div>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Driver</dt><dd className="font-medium">{selected.assigned_driver_name || 'Unassigned'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Vehicle type</dt><dd><Badge variant="outline">{typeLabel(selected.vehicle_type)}</Badge></dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Capacity</dt><dd>{selected.capacity_tons != null ? `${selected.capacity_tons} tons` : '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1"><Fuel className="w-3.5 h-3.5" /> Fuel</dt><dd>{selected.fuel_type ? titleCase(selected.fuel_type) : '—'}{selected.tank_capacity_litres ? ` · ${selected.tank_capacity_litres} L` : ''}{selected.fuel_efficiency_km_per_litre ? ` · ${selected.fuel_efficiency_km_per_litre} km/L` : ''}</dd></div>
                  {selected.notes && <div><dt className="text-muted-foreground">Notes</dt><dd className="mt-1 whitespace-pre-wrap">{selected.notes}</dd></div>}
                  <div className="flex justify-between"><dt className="text-muted-foreground">Registered</dt><dd>{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : '—'}</dd></div>
                </dl>
                {live && live.lat && live.lng ? (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Last known location · {live.updated_at ? new Date(live.updated_at).toLocaleString() : '—'}</span>
                    <MapView height="180px" center={{ lat: Number(live.lat), lng: Number(live.lng) }} zoom={14}
                      markers={[{ lat: Number(live.lat), lng: Number(live.lng), label: selected.plate_number, color: live.is_online ? 'green' : 'gray' }]} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No GPS position yet. Positions appear once the assigned driver goes online in the driver app.</p>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1 bg-[#F97316] hover:bg-[#F97316]/90 text-white" disabled={!selected.assigned_driver_id} onClick={() => navigateToTracking(selected.assigned_driver_id)}>
                    <MapPin className="w-4 h-4 mr-2" /> Track Location
                  </Button>
                  <Button variant="outline" aria-label="Edit truck" onClick={() => openEdit(selected)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="outline" aria-label={selected.status === 'maintenance' ? 'Return to service' : 'Mark in maintenance'} onClick={() => { setMaintenanceNote(''); setMaintenanceFor(selected); }}>
                    {selected.status === 'maintenance' ? <RotateCcw className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ); })() : (
            <Card className="border-0 shadow-sm h-full flex items-center justify-center min-h-[240px]">
              <div className="text-center text-muted-foreground"><Eye className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>Select a truck to view details</p></div>
            </Card>
          )}
        </div>
      </div>

      {/* Add */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>Register New Truck</DialogTitle><DialogDescription>Add a truck to your fleet register. Only plate and type are required.</DialogDescription></DialogHeader>
          <TruckFields idPrefix="add" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleAdd} disabled={saving}>{saving ? 'Registering…' : 'Register Truck'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit (PATCH by id) */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>Edit Truck{editing ? ` · ${editing.plate_number}` : ''}</DialogTitle><DialogDescription>Changes are saved to this truck's record.</DialogDescription></DialogHeader>
          <TruckFields idPrefix="edit" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign driver */}
      <Dialog open={!!assignFor} onOpenChange={(o) => { if (!o) setAssignFor(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Assign Driver{assignFor ? ` · ${assignFor.plate_number}` : ''}</DialogTitle><DialogDescription>A driver drives one truck at a time; assigning moves them off any other truck.</DialogDescription></DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="assign-driver">Driver</Label>
            <select id="assign-driver" value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20">
              <option value="">Unassigned</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name || d.email}{d.status !== 'active' ? ` (${d.status})` : ''}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFor(null)} disabled={saving}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleAssign} disabled={saving}>{saving ? 'Saving…' : 'Save Assignment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance */}
      <AlertDialog open={!!maintenanceFor} onOpenChange={(o) => { if (!o) setMaintenanceFor(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{maintenanceFor?.status === 'maintenance' ? `Return ${maintenanceFor?.plate_number} to service?` : `Mark ${maintenanceFor?.plate_number} as in maintenance?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {maintenanceFor?.status === 'maintenance'
                ? 'The truck becomes available for jobs again.'
                : 'The truck is excluded from job matching until it is returned to service.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {maintenanceFor?.status !== 'maintenance' && (
            <div className="grid gap-2"><Label htmlFor="maint-note">Reason / work to be done (optional)</Label><Textarea id="maint-note" rows={2} value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)} placeholder="e.g. Brake pads and roadworthiness renewal" /></div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#F97316] hover:bg-[#F97316]/90" onClick={(e) => { e.preventDefault(); handleMaintenance(); }} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={!!deleteFor} onOpenChange={(o) => { if (!o) setDeleteFor(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteFor?.plate_number}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the truck from your register. Trip history is kept; the assigned driver (if any) is unassigned. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-600/90" onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={saving}>{saving ? 'Deleting…' : 'Delete Truck'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
