import { useEffect, useState } from 'react';
import {
  Users,
  Truck,
  ClipboardList,
  Wallet,
  MoreVertical,
  AlertCircle,
  Download,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/layout/StatsCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useApi } from '@/hooks/useApi';
import {
  getDashboardStats,
  getRevenueChart,
  getBookingStatusChart,
  getFleetChart,
  getDriverPerformanceChart,
  type DashboardStats,
  type ChartDataPoint
} from '@/lib/api/dashboard';
import { toast } from 'sonner';

function navigateToSection(section: string) {
  window.dispatchEvent(new CustomEvent('navigate:section', { detail: section }));
}

function StatsCardSkeleton() {
  return (
    <Card className="relative p-6 bg-card border-0 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-9 w-32 mb-3" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
      </div>
    </Card>
  );
}

function ChartSkeleton({ height = 'h-80' }: { height?: string }) {
  return (
    <div className={cn(height, 'flex flex-col items-center justify-center gap-3')}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

export function Dashboard() {
  const [isVisible, setIsVisible] = useState(false);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useApi<DashboardStats>(() => getDashboardStats(), []);
  const { data: revenueResponse, isLoading: revenueLoading, refetch: refetchRevenue } = useApi(() => getRevenueChart(), []);
  const { data: bookingResponse, isLoading: bookingLoading, refetch: refetchBooking } = useApi(() => getBookingStatusChart(), []);
  const { data: fleetResponse, isLoading: fleetLoading, refetch: refetchFleet } = useApi(() => getFleetChart(), []);
  const { data: driverResponse, isLoading: driverLoading, refetch: refetchDrivers } = useApi(() => getDriverPerformanceChart(), []);

  const revenueChartData = revenueResponse?.data || [];
  const bookingStatusData = bookingResponse?.data || [];
  const fleetDistribution = fleetResponse?.data || [];
  const driverRatings = driverResponse?.data || [];

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    refetchStats();
    refetchRevenue();
    refetchBooking();
    refetchFleet();
    refetchDrivers();
    toast.success('Dashboard refreshed');
  };

  const handleExport = () => {
    if (!stats) {
      toast.error('No data to export');
      return;
    }
    const rows: ChartDataPoint[] = Object.entries(stats).map(([key, value]) => ({
      name: key,
      value: value as number
    }));
    const headers = Object.keys(rows[0]).join(',');
    const body = rows.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard_stats.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Stats exported');
  };

  return (
    <div className={cn(
      'p-6 space-y-6 transition-all duration-500',
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    )}>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : statsError ? (
          <Card className="col-span-full border-0 shadow-sm p-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">Failed to load dashboard stats. {statsError}</p>
            </div>
          </Card>
        ) : (
          <>
            <StatsCard
              title="Total Users"
              value={stats?.total_users ?? 0}
              change={stats?.users_change ?? 0}
              changeType={(stats?.users_change ?? 0) >= 0 ? 'positive' : 'negative'}
              icon={<Users className="w-6 h-6" />}
              delay={0}
            />
            <StatsCard
              title="Active Drivers"
              value={stats?.active_drivers ?? 0}
              change={stats?.drivers_change ?? 0}
              changeType={(stats?.drivers_change ?? 0) >= 0 ? 'positive' : 'negative'}
              icon={<Truck className="w-6 h-6" />}
              delay={100}
            />
            <StatsCard
              title="Active Bookings"
              value={stats?.active_bookings ?? 0}
              change={stats?.bookings_change ?? 0}
              changeType={(stats?.bookings_change ?? 0) >= 0 ? 'positive' : 'negative'}
              icon={<ClipboardList className="w-6 h-6" />}
              delay={200}
            />
            <StatsCard
              title="Total Revenue"
              value={stats?.total_revenue ?? 0}
              change={stats?.revenue_change ?? 0}
              changeType={(stats?.revenue_change ?? 0) >= 0 ? 'positive' : 'negative'}
              icon={<Wallet className="w-6 h-6" />}
              formatAsCurrency
              delay={300}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display font-semibold text-lg">Revenue Overview</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Monthly revenue and trip statistics</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" /> Export Data
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRefresh}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <ChartSkeleton />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      stroke="#888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₦${(value / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value: any, name: string) => [
                        name === 'revenue' ? `₦${value.toLocaleString()}` : value,
                        name === 'revenue' ? 'Revenue' : 'Trips'
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#F97316"
                      strokeWidth={3}
                      dot={{ fill: '#F97316', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="trips"
                      stroke="#111111"
                      strokeWidth={2}
                      dot={{ fill: '#111111', r: 3 }}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Status Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg">Booking Status</CardTitle>
            <p className="text-sm text-muted-foreground">Current booking distribution</p>
          </CardHeader>
          <CardContent>
            {bookingLoading ? (
              <>
                <ChartSkeleton height="h-64" />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-6 ml-auto" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bookingStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {bookingStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {bookingStatusData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                      <span className="text-sm font-medium ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display font-semibold text-lg">Fleet Distribution</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Trucks by type</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#F97316]"
              onClick={() => navigateToSection('fleet')}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {fleetLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {fleetDistribution.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                    onClick={() => navigateToSection('fleet')}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Driver Ratings */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display font-semibold text-lg">Driver Ratings</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Rating distribution</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#F97316]"
              onClick={() => navigateToSection('drivers')}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {driverLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {driverRatings.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                    onClick={() => navigateToSection('drivers')}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
