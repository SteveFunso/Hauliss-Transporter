import {
  Truck,
  Clock,
  Zap,
  Percent,
  Banknote,
  Receipt,
  ArrowRight,
  Info,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/useApi';
import { getPlatformRateCard } from '@/lib/api/pricing';

/**
 * QA TP-PRC-05/06: for a company admin this page is a READ-ONLY view of the
 * platform rate card (commission, payout terms, base rates, surge rules) from
 * GET /api/admin/pricing. The previous commission editor and truck-type
 * create/edit/delete controls wrote to an in-memory platform catalogue and
 * were removed; a transporter prices its own routes under Service Routes.
 */

const formatNaira = (minor: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((Number.isFinite(minor) ? minor : 0) / 100);

const formatPercent = (rate: number) => {
  const n = Number.isFinite(rate) ? rate : 0;
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}%`;
};

const humanize = (value?: string | null) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatMultiplier = (m: number) => {
  const n = Number.isFinite(m) ? m : 1;
  return `×${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}`;
};

export function Pricing() {
  const { data: rateCard, isLoading, error, refetch } = useApi(() => getPlatformRateCard(), []);

  const goToRoutes = () => {
    window.dispatchEvent(new CustomEvent('navigate:section', { detail: 'routes' }));
  };

  const commission = rateCard?.commission_rate ?? 0;
  const transporterShare = Math.max(0, 100 - commission);
  const baseRates = rateCard?.base_rates ?? [];
  const activeSurgeRules = (rateCard?.surge_rules ?? []).filter((r) => r.is_active);

  const kpis = [
    {
      label: 'Platform commission',
      value: formatPercent(commission),
      hint: `You keep ${formatPercent(transporterShare)} of each fare`,
      icon: Percent,
      color: 'bg-[#F97316]/10 text-[#F97316]',
    },
    {
      label: 'Payout frequency',
      value: rateCard?.payout_frequency ? humanize(rateCard.payout_frequency) : '—',
      hint: 'How often earnings are paid out',
      icon: Clock,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Minimum payout',
      value: formatNaira(rateCard?.min_payout_minor ?? 0),
      hint: 'Minimum balance before a payout is made',
      icon: Banknote,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Processing fee',
      value: formatNaira(rateCard?.payout_fee_minor ?? 0),
      hint: 'Charged per payout',
      icon: Receipt,
      color: 'bg-amber-100 text-amber-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Platform Rate Card</h2>
          <p className="text-muted-foreground mt-1">
            Commission, payout terms and base rates that apply to your company
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={goToRoutes}
        >
          Configure Route Prices
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Read-only notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-[#F97316]/10 text-sm">
        <Info className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">Rates and fees are set by Hauliss.</p>
          <p className="text-muted-foreground">
            Configure your own route prices under{' '}
            <button type="button" onClick={goToRoutes} className="text-[#F97316] font-medium hover:underline">
              Service Routes
            </button>
            .
          </p>
        </div>
      </div>

      {error ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="font-medium">Failed to load the rate card</p>
            <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            <Button variant="outline" className="gap-2 mt-2" onClick={refetch}>
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      {isLoading ? (
                        <Skeleton className="h-8 w-24 mt-1" />
                      ) : (
                        <p className="text-2xl font-semibold truncate">{kpi.value}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${kpi.color}`}>
                      <kpi.icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Base rates per truck type */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#F97316]" /> Base Rates by Truck Type
                {!isLoading && baseRates.length > 0 && (
                  <span className="text-muted-foreground font-normal text-base">({baseRates.length})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <Skeleton className="h-4 w-32 flex-1" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : baseRates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No base rates have been published yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Truck Type</TableHead>
                      <TableHead>Base Fare</TableHead>
                      <TableHead>Per km</TableHead>
                      <TableHead>Minimum Fare</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baseRates.map((rate, i) => (
                      <TableRow key={`${rate.truck_type}-${i}`} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#F97316]/10 flex items-center justify-center text-[#F97316]">
                              <Truck className="w-5 h-5" />
                            </div>
                            <p className="font-medium">{humanize(rate.truck_type) || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell><span className="font-medium">{formatNaira(rate.base_fare_minor)}</span></TableCell>
                        <TableCell><span className="font-medium">{formatNaira(rate.per_km_minor)}</span></TableCell>
                        <TableCell><span className="font-medium">{formatNaira(rate.min_fare_minor)}</span></TableCell>
                        <TableCell>
                          <Badge className={rate.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}>
                            {rate.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Surge rules */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#F97316]" /> Active Surge Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : activeSurgeRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No surge rules are currently active
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSurgeRules.map((rule, i) => (
                    <div key={`${rule.name}-${i}`} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{rule.name || 'Surge rule'}</p>
                        <p className="text-sm text-muted-foreground">Applied on top of the base fare</p>
                      </div>
                      <Badge className="bg-[#F97316]/10 text-[#F97316] hover:bg-[#F97316]/10 text-base font-semibold">
                        {formatMultiplier(rule.multiplier)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
