import { useState } from 'react';
import {
  Download,
  FileText,
  TrendingUp,
  Users,
  Truck,
  Wallet,
  CheckCircle,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/useApi';
import { getReport, getDashboardStats, type ChartDataPoint } from '@/lib/api/dashboard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const reportTypes = [
  { id: 'revenue', name: 'Revenue Report', icon: Wallet, color: 'bg-emerald-100 text-emerald-600' },
  { id: 'fleet', name: 'Fleet Utilization', icon: Truck, color: 'bg-blue-100 text-blue-600' },
  { id: 'drivers', name: 'Driver Performance', icon: Users, color: 'bg-purple-100 text-purple-600' },
];

export function Reports() {
  const [selectedReport, setSelectedReport] = useState<string>('revenue');
  const [dateRange, setDateRange] = useState<string>('30d');

  const { data: revenueData, isLoading: revenueLoading } = useApi(
    () => getReport('revenue', dateRange),
    [selectedReport, dateRange]
  );
  const { data: fleetData, isLoading: fleetLoading } = useApi(
    () => getReport('fleet', dateRange),
    [dateRange]
  );
  const { data: driverData } = useApi(
    () => getReport('drivers', dateRange),
    [dateRange]
  );
  const { data: stats, isLoading: statsLoading } = useApi(
    () => getDashboardStats(),
    []
  );

  const handleExport = () => {
    let csvData: ChartDataPoint[] = [];
    let filename = 'report';

    if (selectedReport === 'revenue' && revenueData?.data) {
      csvData = revenueData.data;
      filename = 'revenue_report';
    } else if (selectedReport === 'fleet' && fleetData?.data) {
      csvData = fleetData.data;
      filename = 'fleet_report';
    } else if (selectedReport === 'drivers' && driverData?.data) {
      csvData = driverData.data;
      filename = 'driver_report';
    }

    if (csvData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  const getReportIcon = (type: string) => {
    const report = reportTypes.find(r => r.id === type);
    if (!report) return <FileText className="w-5 h-5" />;
    const Icon = report.icon;
    return <Icon className="w-5 h-5" />;
  };

  const getReportColor = (type: string) => {
    const report = reportTypes.find(r => r.id === type);
    return report?.color || 'bg-gray-100 text-gray-600';
  };

  const formatRevenue = (val: number) => {
    if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `₦${(val / 1_000).toFixed(0)}K`;
    return `₦${val}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Reports & Analytics</h2>
          <p className="text-muted-foreground mt-1">
            Generate reports, analyze performance, and export data
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button
            className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              selectedReport === report.id
                ? 'bg-[#F97316] text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <report.icon className="w-4 h-4" />
            {report.name}
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg flex items-center justify-between">
              <span>Revenue Trend</span>
              {stats && (
                <Badge className={stats.revenue_change >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                  {stats.revenue_change >= 0 ? '+' : ''}{stats.revenue_change}% YoY
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {revenueLoading ? (
                <div className="space-y-4 h-full flex flex-col justify-end">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData?.data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} tickFormatter={(value) => formatRevenue(value)} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#F97316" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg flex items-center justify-between">
              <span>{selectedReport === 'drivers' ? 'Driver Rating Distribution' : 'Truck Type Distribution'}</span>
              {selectedReport !== 'drivers' && stats && (
                <Badge className="bg-blue-100 text-blue-700">{stats.total_trucks} Total</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {fleetLoading ? (
                <div className="space-y-4 h-full flex flex-col justify-end">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(selectedReport === 'drivers' ? driverData?.data : fleetData?.data) || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar dataKey="value" fill="#F97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                  <Badge className={stats?.revenue_change && stats.revenue_change >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                    {stats?.revenue_change && stats.revenue_change >= 0 ? '+' : ''}{stats?.revenue_change ?? 0}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatRevenue(stats?.total_revenue ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-2">This month</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Truck className="w-6 h-6 text-blue-600" />
                  </div>
                  <Badge className="bg-blue-100 text-blue-700">
                    {stats?.bookings_change && stats.bookings_change >= 0 ? '+' : ''}{stats?.bookings_change ?? 0}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Active Trucks</p>
                <p className="text-2xl font-bold mt-1">{stats?.total_trucks?.toLocaleString() ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-2">Available now</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <Badge className="bg-purple-100 text-purple-700">
                    {stats?.drivers_change && stats.drivers_change >= 0 ? '+' : ''}{stats?.drivers_change ?? 0}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Active Drivers</p>
                <p className="text-2xl font-bold mt-1">{stats?.active_drivers?.toLocaleString() ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-2">On platform</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">
                    {stats?.avg_rating?.toFixed(1) ?? '0'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Completed Trips</p>
                <p className="text-2xl font-bold mt-1">{stats?.completed_trips?.toLocaleString() ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-2">All time</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Reports (templates for jumping to a report view) */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display font-semibold text-lg">
            Quick Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { id: 1, name: 'Revenue Report', type: 'revenue' },
              { id: 2, name: 'Fleet Utilization', type: 'fleet' },
              { id: 3, name: 'Driver Performance', type: 'drivers' },
            ].map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', getReportColor(report.type))}>
                    {getReportIcon(report.type)}
                  </div>
                  <div>
                    <p className="font-medium">{report.name}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setSelectedReport(report.type);
                    toast.info('Opening report...');
                  }}
                >
                  <Eye className="w-4 h-4" />
                  View
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
