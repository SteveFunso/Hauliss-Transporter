import { ShieldCheck, Clock, XCircle, CalendarClock, AlertTriangle, Users, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApi } from '@/hooks/useApi';
import { getDriverCompliance, type DriverCompliance } from '@/lib/api/compliance';

/**
 * BUG-006: a real Compliance page. The "Compliance" nav item previously
 * rendered the Reports component verbatim (same element, different header).
 * This page answers the compliance questions a transporter admin actually
 * has: which drivers are fully verified, whose documents are pending or
 * rejected, and whose documents are expiring/expired.
 */
export function Compliance() {
  const { data, isLoading, refetch } = useApi(() => getDriverCompliance(), []);
  const summary = (data as any)?.summary;
  const drivers: DriverCompliance[] = (data as any)?.drivers || [];

  const statusBadge = (d: DriverCompliance) => {
    if (d.compliant) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Compliant</Badge>;
    if (d.rejected > 0) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Rejected docs</Badge>;
    if (d.expired > 0) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Expired docs</Badge>;
    if (d.pending > 0) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending review</Badge>;
    if (d.expiring_30d > 0) return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Expiring soon</Badge>;
    return <Badge variant="outline">No documents</Badge>;
  };

  const stats = [
    { label: 'Drivers with documents', value: summary?.total_drivers, icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Fully compliant', value: summary?.fully_compliant, icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Pending review', value: summary?.with_pending, icon: Clock, color: 'bg-amber-100 text-amber-600' },
    { label: 'Rejected documents', value: summary?.with_rejected, icon: XCircle, color: 'bg-red-100 text-red-600' },
    { label: 'Expiring in 30 days', value: summary?.with_expiring, icon: CalendarClock, color: 'bg-orange-100 text-orange-600' },
    { label: 'Expired documents', value: summary?.with_expired, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
  ];

  const goToDrivers = () => {
    window.dispatchEvent(new CustomEvent('navigate:section', { detail: 'drivers' }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Driver Document Compliance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Verification status across your fleet. Review pending documents from the Drivers page.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-10 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{s.value ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-driver table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display font-semibold text-lg">Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Expiring / Expired</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, c) => (
                      <TableCell key={c}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && drivers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No driver documents on record yet
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                drivers.map((d) => (
                  <TableRow key={d.driver_id}>
                    <TableCell>
                      <p className="font-medium">{d.full_name || 'Unknown driver'}</p>
                      <p className="text-xs text-muted-foreground">{d.phone_number || d.driver_id.slice(0, 8)}</p>
                    </TableCell>
                    <TableCell>{d.verified}/{d.total}</TableCell>
                    <TableCell>{d.pending || '—'}</TableCell>
                    <TableCell>{d.rejected || '—'}</TableCell>
                    <TableCell>
                      {d.expiring_30d || d.expired
                        ? `${d.expiring_30d} / ${d.expired}`
                        : '—'}
                    </TableCell>
                    <TableCell>{statusBadge(d)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={goToDrivers}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
