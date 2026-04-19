import { useEffect, useState } from 'react';
import {
  Users,
  Truck,
  ClipboardList,
  Wallet,
  MapPin,
  Clock,
  CheckCircle,
  MoreVertical,
  AlertCircle,
  Download,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/layout/StatsCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  type DashboardStats
} from '@/lib/api/dashboard';
import { toast } from 'sonner';

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

  const { data: stats, isLoading: statsLoading, error: statsError } = useApi<DashboardStats>(() => getDashboardStats(), []);
  const { data: revenueResponse, isLoading: revenueLoading } = useApi(() => getRevenueChart(), []);
  const { data: bookingResponse, isLoading: bookingLoading } = useApi(() => getBookingStatusChart(), []);

  const revenueChartData = revenueResponse?.data || [];
  const bookingStatusData = bookingResponse?.data || [];

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const recentActivities = [
    { id: 1, type: 'booking', message: 'New booking #BKG004 created', time: '5 min ago' },
    { id: 2, type: 'trip', message: 'Trip #BKG001 completed by Ibrahim M.', time: '15 min ago' },
    { id: 3, type: 'payment', message: 'Payment of ₦45,000 received', time: '1 hour ago' },
    { id: 4, type: 'driver', message: 'Driver Yusuf B. document verified', time: '2 hours ago' }
  ];

  const onlineDrivers = [
    { name: 'Ibrahim Musa', location: 'Oshodi', status: 'in_transit', truck: 'LAGOS-AB123CD' },
    { name: 'Tunde Afolayan', location: 'Ikeja', status: 'available', truck: 'LAGOS-EF456GH' },
    { name: 'Emeka Okafor', location: 'Apapa', status: 'in_transit', truck: 'LAGOS-MN012OP' }
  ];

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
              prefix="₦"
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
                <DropdownMenuItem onClick={() => toast.info("Export as CSV coming soon")}>
                  <Download className="w-4 h-4 mr-2" /> Export Data
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Refreshing chart data...")}>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display font-semibold text-lg">Recent Activity</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#F97316]"
              onClick={() => toast.info("Activity log coming soon")}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    activity.type === 'booking' && 'bg-blue-100 text-blue-600',
                    activity.type === 'trip' && 'bg-emerald-100 text-emerald-600',
                    activity.type === 'payment' && 'bg-amber-100 text-amber-600',
                    activity.type === 'driver' && 'bg-purple-100 text-purple-600'
                  )}>
                    {activity.type === 'booking' && <ClipboardList className="w-4 h-4" />}
                    {activity.type === 'trip' && <CheckCircle className="w-4 h-4" />}
                    {activity.type === 'payment' && <Wallet className="w-4 h-4" />}
                    {activity.type === 'driver' && <Users className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Online Drivers */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg">Online Drivers</CardTitle>
            <p className="text-sm text-muted-foreground">{onlineDrivers.length} drivers currently online</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {onlineDrivers.map((driver, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                  onClick={() => toast.info(`${driver.name} — ${driver.truck}, ${driver.location} (${driver.status === 'in_transit' ? 'In Transit' : 'Available'})`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F97316] to-[#111111] flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        {driver.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{driver.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {driver.location}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={driver.status === 'in_transit' ? 'default' : 'secondary'}
                    className={cn(
                      driver.status === 'in_transit' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
                      driver.status === 'available' && 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                    )}
                  >
                    {driver.status === 'in_transit' ? (
                      <><Clock className="w-3 h-3 mr-1" /> In Transit</>
                    ) : (
                      <><CheckCircle className="w-3 h-3 mr-1" /> Available</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fleet Utilization */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg">Fleet Utilization</CardTitle>
            <p className="text-sm text-muted-foreground">This week's performance</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Utilization Rate</span>
                  <span className="font-medium">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  className="text-center p-4 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => toast.info("Trip details coming soon")}
                >
                  <p className="text-2xl font-bold text-[#F97316]">156</p>
                  <p className="text-xs text-muted-foreground mt-1">Trips This Week</p>
                </div>
                <div
                  className="text-center p-4 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => toast.info("On-time report coming soon")}
                >
                  <p className="text-2xl font-bold text-[#111111]">92%</p>
                  <p className="text-xs text-muted-foreground mt-1">On-Time Rate</p>
                </div>
              </div>

              <div className="space-y-3">
                <div
                  className="flex items-center justify-between cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                  onClick={() => toast.info("Available trucks list coming soon")}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm">Available Trucks</span>
                  </div>
                  <span className="text-sm font-medium">652</span>
                </div>
                <div
                  className="flex items-center justify-between cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                  onClick={() => toast.info("In-transit trucks list coming soon")}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                    <span className="text-sm">In Transit</span>
                  </div>
                  <span className="text-sm font-medium">306</span>
                </div>
                <div
                  className="flex items-center justify-between cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                  onClick={() => toast.info("Maintenance list coming soon")}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-sm">In Maintenance</span>
                  </div>
                  <span className="text-sm font-medium">87</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
