import { useEffect, useMemo, useState } from 'react';
import { MapPin, RefreshCw, Search, Truck as TruckIcon, Wifi, WifiOff, Clock, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapView } from '@/components/ui/map-view';
import { useApi } from '@/hooks/useApi';
import { getFleetAvailability, type FleetDriver } from '@/lib/api/fleet';
import { cn } from '@/lib/utils';

// QA 2026-09: the "Live Tracking" nav item rendered the Fleet Management page.
// This is the real thing: every company truck with a known position on one map,
// auto-refreshed, with a status list you can click to focus a truck.

const REFRESH_MS = 15_000;
export const TRACKING_FOCUS_KEY = 'hauliss:tracking:focus';

function hasPosition(d: FleetDriver) {
  const lat = Number(d.lat), lng = Number(d.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

function ageLabel(iso?: string) {
  if (!iso) return 'no update yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export function LiveTracking() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [focusId, setFocusId] = useState<string | null>(() => sessionStorage.getItem(TRACKING_FOCUS_KEY));
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // One page of up to 100 availability rows covers a company fleet; the map needs them all at once.
  const { data, isLoading, refetch } = useApi(() => getFleetAvailability({ page: 1, limit: 100 }), []);

  useEffect(() => {
    const id = window.setInterval(() => { refetch(); }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refetch]);

  useEffect(() => { if (data) setLastRefresh(new Date()); }, [data]);
  useEffect(() => { sessionStorage.removeItem(TRACKING_FOCUS_KEY); }, []);

  const rows: FleetDriver[] = (data as any)?.data || [];
  const filtered = useMemo(() => rows.filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (d.driver_name || '').toLowerCase().includes(q) || (d.truck_plate_number || '').toLowerCase().includes(q) || (d.vehicle_type || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'online' ? d.is_online : !d.is_online);
    return matchesSearch && matchesStatus;
  }), [rows, search, statusFilter]);

  const positioned = filtered.filter(hasPosition);
  const focus = rows.find((d) => d.driver_id === focusId) || null;
  const online = rows.filter((d) => d.is_online).length;

  const markers = positioned.map((d) => ({
    lat: Number(d.lat), lng: Number(d.lng),
    label: `${d.truck_plate_number || 'No plate'} · ${d.driver_name || 'Unassigned'}`,
    color: d.driver_id === focusId ? 'orange' : d.is_online ? 'green' : 'gray',
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Live Tracking</h2>
          <p className="text-muted-foreground mt-1">Real-time positions of every truck in your fleet</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading…'} · refreshes every {REFRESH_MS / 1000}s</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Trucks tracked', value: rows.length, icon: TruckIcon, bg: 'bg-[#F97316]/10', fg: 'text-[#F97316]' },
          { label: 'Online now', value: online, icon: Wifi, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
          { label: 'Offline', value: rows.length - online, icon: WifiOff, bg: 'bg-gray-100', fg: 'text-gray-600' },
        ].map((k) => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{k.label}</p>
                {isLoading && !data ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-semibold">{k.value}</p>}
              </div>
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', k.bg)}>
                <k.icon className={cn('w-6 h-6', k.fg)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#F97316]" />
              {focus ? `Tracking ${focus.truck_plate_number || focus.driver_name}` : 'All trucks'}
              <span className="ml-auto text-sm font-normal text-muted-foreground">{positioned.length} of {filtered.length} with a GPS fix</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !data ? (
              <Skeleton className="h-[480px] w-full rounded-lg" />
            ) : markers.length === 0 ? (
              <div className="h-[480px] flex flex-col items-center justify-center text-muted-foreground rounded-lg bg-muted/40">
                <Navigation className="w-10 h-10 mb-3 opacity-50" />
                <p>No truck has reported a GPS position yet.</p>
                <p className="text-sm">Positions appear as soon as a driver goes online in the driver app.</p>
              </div>
            ) : (
              <MapView
                height="480px"
                markers={markers}
                center={focus && hasPosition(focus) ? { lat: Number(focus.lat), lng: Number(focus.lng) } : undefined}
                zoom={focus && hasPosition(focus) ? 15 : 11}
              />
            )}
            {focus && (
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                <Badge className={focus.is_online ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}>
                  {focus.is_online ? 'Online' : 'Offline'}
                </Badge>
                <span className="text-muted-foreground">Driver: <span className="text-foreground">{focus.driver_name || 'Unassigned'}</span></span>
                {hasPosition(focus) && <span className="text-muted-foreground">Position: <span className="text-foreground">{Number(focus.lat).toFixed(5)}, {Number(focus.lng).toFixed(5)}</span></span>}
                <span className="text-muted-foreground">Last update: <span className="text-foreground">{ageLabel(focus.updated_at)}</span></span>
                <Button variant="ghost" size="sm" onClick={() => setFocusId(null)}>Show all</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Truck list */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="space-y-3">
            <CardTitle className="font-display font-semibold text-lg">Trucks ({filtered.length})</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search plate, driver or type…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              {(['all', 'online', 'offline'] as const).map((s) => (
                <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
                  className={statusFilter === s ? 'bg-[#F97316] hover:bg-[#F97316]/90 text-white' : ''}
                  onClick={() => setStatusFilter(s)}>
                  {s === 'all' ? 'All' : s === 'online' ? 'Online' : 'Offline'}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="max-h-[520px] overflow-y-auto space-y-2">
            {isLoading && !data ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No trucks match this filter.</p>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.driver_id}
                  onClick={() => setFocusId(d.driver_id === focusId ? null : d.driver_id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/60',
                    d.driver_id === focusId ? 'border-[#F97316] bg-[#F97316]/5' : 'border-transparent bg-muted/30'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{d.truck_plate_number || 'No plate'}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.driver_name || 'Unassigned'} · {d.vehicle_type || 'type unknown'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn('inline-flex items-center gap-1 text-xs font-medium', d.is_online ? 'text-emerald-600' : 'text-gray-500')}>
                        <span className={cn('w-2 h-2 rounded-full', d.is_online ? 'bg-emerald-500' : 'bg-gray-400')} />
                        {d.is_online ? 'Online' : 'Offline'}
                      </span>
                      <p className="text-[11px] text-muted-foreground">{hasPosition(d) ? ageLabel(d.updated_at) : 'no GPS fix'}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
