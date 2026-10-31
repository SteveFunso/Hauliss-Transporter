import { useEffect, useMemo, useState } from 'react';
import {
  Truck, Clock, Zap, Percent, Banknote, Receipt, Info, AlertCircle, RefreshCw, Save, RotateCcw, Plus, Pencil, Trash2,
  Loader2, Calculator,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import {
  getPlatformRateCard,
  getCompanyPricing,
  saveCompanyRate,
  resetCompanyRate,
  previewCompanyQuote,
  createCompanyCharge,
  updateCompanyCharge,
  deleteCompanyCharge,
  type PricingVehicleType,
  type CompanyCharge,
  type FarePreview,
  type RateField,
} from '@/lib/api/pricing';

/**
 * Pricing. Hauliss sets the commission, the platform service charge, VAT and
 * surge rules (read-only here). The company sets its OWN transport fare per
 * vehicle type — base fare, per km, per minute, minimum — within the range
 * Hauliss allows for that type, plus named add-on charges (loading, waiting,
 * night surcharge, tolls, insurance …). The quote engine applies both to every
 * booking a shipper makes with this company.
 */

const formatNaira = (minor: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    (Number.isFinite(minor) ? minor : 0) / 100
  );
const formatPercent = (rate: number) => {
  const n = Number.isFinite(rate) ? rate : 0;
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}%`;
};
const humanize = (value?: string | null) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const formatMultiplier = (m: number) => {
  const n = Number.isFinite(m) ? m : 1;
  return `×${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}`;
};
const toNaira = (minor: number | null | undefined) => (minor == null ? '' : String(Math.round(minor) / 100));
const toMinor = (naira: string) => Math.round(parseFloat(naira) * 100);

const RATE_FIELDS: Array<{ key: RateField; label: string; hint: string }> = [
  { key: 'base_fare_minor', label: 'Base fare', hint: 'Charged on every trip' },
  { key: 'per_km_rate_minor', label: 'Per km', hint: 'Times the route distance' },
  { key: 'per_minute_rate_minor', label: 'Per minute', hint: 'Times the estimated duration' },
  { key: 'minimum_fare_minor', label: 'Minimum fare', hint: 'The fare never goes below this' },
];

type RateDraft = Record<RateField, string>;
type ChargeForm = {
  name: string; description: string; charge_type: 'fixed' | 'percent'; amount: string; percent: string;
  truck_type_id: string; is_optional: boolean; is_active: boolean;
};
const emptyCharge: ChargeForm = { name: '', description: '', charge_type: 'fixed', amount: '', percent: '', truck_type_id: '', is_optional: false, is_active: true };

export function Pricing() {
  const { data: rateCard, isLoading, error, refetch } = useApi(() => getPlatformRateCard(), []);
  const { data: pricing, isLoading: pricingLoading, error: pricingError, refetch: refetchPricing } = useApi(() => getCompanyPricing(), []);

  const vehicleTypes: PricingVehicleType[] = pricing?.vehicle_types ?? [];
  const charges: CompanyCharge[] = pricing?.charges ?? [];

  // ---- rate card drafts (naira strings per vehicle type) -------------------
  const [drafts, setDrafts] = useState<Record<string, RateDraft>>({});
  const [savingType, setSavingType] = useState<string | null>(null);
  useEffect(() => {
    const next: Record<string, RateDraft> = {};
    for (const vt of vehicleTypes) {
      const src = vt.company ?? vt.platform;
      next[vt.id] = {
        base_fare_minor: toNaira(src?.base_fare_minor ?? 0),
        per_km_rate_minor: toNaira(src?.per_km_rate_minor ?? 0),
        per_minute_rate_minor: toNaira(src?.per_minute_rate_minor ?? 0),
        minimum_fare_minor: toNaira(src?.minimum_fare_minor ?? 0),
      };
    }
    setDrafts(next);
  }, [pricing]);

  const limitText = (vt: PricingVehicleType, field: RateField) => {
    const lim = vt.limits?.[field];
    if (!lim || (lim.min == null && lim.max == null)) return 'No limit set by Hauliss';
    if (lim.min != null && lim.max != null) return `Hauliss range ${formatNaira(lim.min)} – ${formatNaira(lim.max)}`;
    if (lim.min != null) return `At least ${formatNaira(lim.min)}`;
    return `At most ${formatNaira(lim.max as number)}`;
  };

  const saveRate = async (vt: PricingVehicleType) => {
    const d = drafts[vt.id];
    if (!d) return;
    const body = {} as Record<RateField, number>;
    for (const f of RATE_FIELDS) {
      const minor = toMinor(d[f.key]);
      if (!Number.isFinite(minor) || minor < 0) { toast.error(`${f.label} for ${vt.name} must be a valid amount`); return; }
      const lim = vt.limits?.[f.key];
      if (lim?.min != null && minor < lim.min) { toast.error(`${f.label} for ${vt.name} must be at least ${formatNaira(lim.min)}`); return; }
      if (lim?.max != null && minor > lim.max) { toast.error(`${f.label} for ${vt.name} cannot exceed ${formatNaira(lim.max)}`); return; }
      body[f.key] = minor;
    }
    setSavingType(vt.id);
    try {
      await saveCompanyRate(vt.id, { ...body, is_active: true });
      toast.success(`${vt.name} rate saved — new quotes for your company use it immediately`);
      refetchPricing();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save the rate');
    } finally {
      setSavingType(null);
    }
  };

  const resetRate = async (vt: PricingVehicleType) => {
    setSavingType(vt.id);
    try {
      await resetCompanyRate(vt.id);
      toast.success(`${vt.name} now uses the platform rate`);
      refetchPricing();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset the rate');
    } finally {
      setSavingType(null);
    }
  };

  // ---- add-on charges -------------------------------------------------------
  const [chargeOpen, setChargeOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<CompanyCharge | null>(null);
  const [chargeForm, setChargeForm] = useState<ChargeForm>({ ...emptyCharge });
  const [chargeSaving, setChargeSaving] = useState(false);
  const [chargeBusy, setChargeBusy] = useState<string | null>(null);

  const openNewCharge = () => { setEditingCharge(null); setChargeForm({ ...emptyCharge }); setChargeOpen(true); };
  const openEditCharge = (c: CompanyCharge) => {
    setEditingCharge(c);
    setChargeForm({
      name: c.name, description: c.description || '', charge_type: c.charge_type,
      amount: c.charge_type === 'fixed' ? toNaira(c.amount_minor) : '', percent: c.charge_type === 'percent' ? String(c.percent) : '',
      truck_type_id: c.truck_type ? vehicleTypes.find((v) => v.slug === c.truck_type)?.id ?? '' : '',
      is_optional: c.is_optional, is_active: c.is_active,
    });
    setChargeOpen(true);
  };
  const saveCharge = async () => {
    const name = chargeForm.name.trim();
    if (!name) { toast.error('Give the charge a name'); return; }
    const body = {
      name, description: chargeForm.description.trim() || null, charge_type: chargeForm.charge_type,
      truck_type_id: chargeForm.truck_type_id || null, is_optional: chargeForm.is_optional, is_active: chargeForm.is_active,
      amount_minor: 0, percent: 0,
    };
    if (chargeForm.charge_type === 'fixed') {
      const minor = toMinor(chargeForm.amount);
      if (!Number.isFinite(minor) || minor <= 0) { toast.error('Enter the amount for this charge'); return; }
      body.amount_minor = minor;
    } else {
      const pct = parseFloat(chargeForm.percent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 50) { toast.error('Percentage must be between 0 and 50'); return; }
      body.percent = pct;
    }
    setChargeSaving(true);
    try {
      if (editingCharge) { await updateCompanyCharge(editingCharge.id, body); toast.success(`${name} updated`); }
      else { await createCompanyCharge(body); toast.success(`${name} added — it applies to new quotes from now on`); }
      setChargeOpen(false);
      refetchPricing();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save the charge');
    } finally {
      setChargeSaving(false);
    }
  };
  const toggleCharge = async (c: CompanyCharge) => {
    setChargeBusy(c.id);
    try {
      await updateCompanyCharge(c.id, { is_active: !c.is_active });
      toast.success(`${c.name} ${c.is_active ? 'switched off' : 'switched on'}`);
      refetchPricing();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update the charge');
    } finally {
      setChargeBusy(null);
    }
  };
  const removeCharge = async (c: CompanyCharge) => {
    if (!window.confirm(`Remove "${c.name}"? Quotes already issued keep it.`)) return;
    setChargeBusy(c.id);
    try {
      await deleteCompanyCharge(c.id);
      toast.success(`${c.name} removed`);
      refetchPricing();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove the charge');
    } finally {
      setChargeBusy(null);
    }
  };

  // ---- example quote ----------------------------------------------------------
  const [previewType, setPreviewType] = useState('');
  const [previewKm, setPreviewKm] = useState('25');
  const [previewMinutes, setPreviewMinutes] = useState('');
  const [previewCharges, setPreviewCharges] = useState<string[]>([]);
  const [preview, setPreview] = useState<FarePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => { if (!previewType && vehicleTypes[0]) setPreviewType(vehicleTypes[0].id); }, [vehicleTypes, previewType]);
  const runPreview = async () => {
    const km = parseFloat(previewKm);
    if (!previewType || !Number.isFinite(km) || km <= 0) { toast.error('Pick a vehicle type and a distance'); return; }
    setPreviewing(true);
    try {
      const minutes = parseFloat(previewMinutes);
      setPreview(await previewCompanyQuote({ truck_type_id: previewType, distance_km: km, duration_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined, charge_ids: previewCharges }));
    } catch (e: any) {
      toast.error(e?.message || 'Could not calculate the example');
    } finally {
      setPreviewing(false);
    }
  };
  const optionalForPreview = useMemo(() => {
    const vt = vehicleTypes.find((v) => v.id === previewType);
    return charges.filter((c) => c.is_optional && c.is_active && !c.disabled_by_platform && (!c.truck_type || c.truck_type === vt?.slug));
  }, [charges, vehicleTypes, previewType]);

  // ---- platform figures -------------------------------------------------------
  const commission = pricing?.commission_rate_percent ?? rateCard?.commission_rate ?? 0;
  const activeSurgeRules = (rateCard?.surge_rules ?? []).filter((r) => r.is_active);
  const kpis = [
    { label: 'Platform commission', value: formatPercent(commission), hint: 'Deducted from your fare + charges on each trip', icon: Percent, color: 'bg-[#F97316]/10 text-[#F97316]' },
    { label: 'Payout frequency', value: rateCard?.payout_frequency ? humanize(rateCard.payout_frequency) : '—', hint: 'How often earnings are paid out', icon: Clock, color: 'bg-blue-100 text-blue-600' },
    { label: 'Minimum payout', value: formatNaira(rateCard?.min_payout_minor ?? 0), hint: 'Minimum balance before a payout is made', icon: Banknote, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Processing fee', value: formatNaira(rateCard?.payout_fee_minor ?? 0), hint: 'Charged per payout', icon: Receipt, color: 'bg-amber-100 text-amber-600' },
  ];

  const chargeAmountText = (c: CompanyCharge) => (c.charge_type === 'percent' ? `${c.percent}% of the transport fare` : formatNaira(c.amount_minor));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Pricing</h2>
          <p className="text-muted-foreground mt-1">Your transport fare per vehicle type, your add-on charges, and the platform fees that apply to you</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => { refetch(); refetchPricing(); }}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-lg bg-[#F97316]/10 text-sm">
        <Info className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">You set your transport fare and add-on charges. Hauliss sets the commission, service charge, VAT and surge rules.</p>
          <p className="text-muted-foreground">
            The shipper pays your transport fare + your charges + the Hauliss service charge and VAT on it. You earn your fare + charges minus the platform commission. Your fare must stay within the range Hauliss allows per vehicle type.
          </p>
        </div>
      </div>

      {error || pricingError ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="font-medium">Failed to load pricing</p>
            <p className="text-sm text-muted-foreground max-w-md">{String(error || pricingError)}</p>
            <Button variant="outline" className="gap-2 mt-2" onClick={() => { refetch(); refetchPricing(); }}><RefreshCw className="w-4 h-4" /> Try Again</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      {isLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl font-semibold truncate">{kpi.value}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${kpi.color}`}><kpi.icon className="w-6 h-6" /></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* My rate card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#F97316]" /> My Rate Card
              </CardTitle>
              <p className="text-sm text-muted-foreground">Leave a vehicle type on the platform rate, or set your own within the Hauliss range. Saved rates apply to new quotes at once; existing quotes keep their price.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricingLoading ? (
                <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>
              ) : vehicleTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No vehicle types are available yet.</p>
              ) : (
                vehicleTypes.map((vt) => {
                  const d = drafts[vt.id];
                  const custom = !!vt.company;
                  const busy = savingType === vt.id;
                  return (
                    <div key={vt.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#F97316]/10 flex items-center justify-center text-[#F97316]"><Truck className="w-5 h-5" /></div>
                          <div>
                            <p className="font-medium">{vt.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {vt.platform ? `Platform rate: base ${formatNaira(vt.platform.base_fare_minor)} · ${formatNaira(vt.platform.per_km_rate_minor)}/km · ${formatNaira(vt.platform.per_minute_rate_minor)}/min · min ${formatNaira(vt.platform.minimum_fare_minor)}` : 'No platform rule yet — the catalogue base price applies until you set a rate'}
                            </p>
                          </div>
                        </div>
                        <Badge className={custom ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-100'}>{custom ? 'Your rate' : 'Platform default'}</Badge>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {RATE_FIELDS.map((f) => (
                          <div key={f.key} className="space-y-1">
                            <Label htmlFor={`${vt.id}-${f.key}`} className="text-xs">{f.label} (₦)</Label>
                            <Input id={`${vt.id}-${f.key}`} type="number" min="0" step="1" value={d?.[f.key] ?? ''} disabled={busy}
                              onChange={(e) => setDrafts((all) => ({ ...all, [vt.id]: { ...(all[vt.id] as RateDraft), [f.key]: e.target.value } }))} />
                            <p className="text-[11px] text-muted-foreground">{limitText(vt, f.key)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        {custom && (
                          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => resetRate(vt)}>
                            <RotateCcw className="w-3.5 h-3.5" /> Use platform rate
                          </Button>
                        )}
                        <Button size="sm" className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-1.5" disabled={busy} onClick={() => saveRate(vt)}>
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {custom ? 'Save changes' : 'Set my rate'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Add-on charges */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="font-display font-semibold text-lg flex items-center gap-2"><Receipt className="w-5 h-5 text-[#F97316]" /> Additional Charges</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Loading, waiting time, night or weekend surcharge, tolls, insurance… Automatic charges are added to every quote; optional ones are offered to the shipper. Commission applies to them like the fare.</p>
                </div>
                <Button size="sm" className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-1.5 shrink-0" onClick={openNewCharge}><Plus className="w-4 h-4" /> Add charge</Button>
              </div>
            </CardHeader>
            <CardContent>
              {pricingLoading ? (
                <Skeleton className="h-16 w-full rounded-lg" />
              ) : charges.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No add-on charges yet. Shippers pay your transport fare plus the platform fees only.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Charge</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Applies to</TableHead>
                      <TableHead>How</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {charges.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <p className="font-medium">{c.name}</p>
                          {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                          {c.disabled_by_platform && <Badge className="mt-1 bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">Disabled by Hauliss</Badge>}
                        </TableCell>
                        <TableCell>{chargeAmountText(c)}</TableCell>
                        <TableCell>{c.truck_type_name || 'All vehicle types'}</TableCell>
                        <TableCell>{c.is_optional ? 'Shipper chooses' : 'Automatic'}</TableCell>
                        <TableCell><Switch checked={c.is_active} disabled={chargeBusy === c.id || c.disabled_by_platform} onCheckedChange={() => toggleCharge(c)} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" disabled={chargeBusy === c.id} onClick={() => openEditCharge(c)}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-red-600 hover:text-red-700" disabled={chargeBusy === c.id} onClick={() => removeCharge(c)}>
                              {chargeBusy === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Example quote */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg flex items-center gap-2"><Calculator className="w-5 h-5 text-[#F97316]" /> Example Quote</CardTitle>
              <p className="text-sm text-muted-foreground">What a shipper would pay for a trip with your current configuration (surge rules in force now are applied).</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="pv-type" className="text-xs">Vehicle type</Label>
                  <select id="pv-type" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={previewType} onChange={(e) => { setPreviewType(e.target.value); setPreviewCharges([]); }}>
                    {vehicleTypes.map((vt) => <option key={vt.id} value={vt.id}>{vt.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pv-km" className="text-xs">Distance (km)</Label>
                  <Input id="pv-km" type="number" min="1" value={previewKm} onChange={(e) => setPreviewKm(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pv-min" className="text-xs">Duration (minutes, optional)</Label>
                  <Input id="pv-min" type="number" min="1" placeholder="estimated from distance" value={previewMinutes} onChange={(e) => setPreviewMinutes(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button className="w-full bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-1.5" disabled={previewing} onClick={runPreview}>
                    {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} Calculate
                  </Button>
                </div>
              </div>
              {optionalForPreview.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {optionalForPreview.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={previewCharges.includes(c.id)} onChange={(e) => setPreviewCharges((s) => (e.target.checked ? [...s, c.id] : s.filter((id) => id !== c.id)))} />
                      {c.name} <span className="text-muted-foreground">({chargeAmountText(c)})</span>
                    </label>
                  ))}
                </div>
              )}
              {preview && (
                <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1 max-w-md">
                  <div className="flex justify-between"><span>Transport fare ({preview.distance_km} km, {preview.duration_minutes} min{preview.surge_multiplier > 1 ? `, surge ${formatMultiplier(preview.surge_multiplier)}` : ''})</span><span className="font-medium">{formatNaira(preview.transport_fare_minor)}</span></div>
                  {preview.charge_lines.map((l) => (
                    <div key={l.id} className="flex justify-between"><span>{l.name}</span><span className="font-medium">{formatNaira(l.amount_minor)}</span></div>
                  ))}
                  <div className="flex justify-between text-muted-foreground"><span>Hauliss service charge{preview.service_charge_percent != null ? ` (${formatPercent(preview.service_charge_percent)})` : ''}</span><span>{formatNaira(preview.service_charge_minor)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>VAT on the service charge</span><span>{formatNaira(preview.tax_fee_minor)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 mt-2 font-semibold"><span>Shipper pays</span><span>{formatNaira(preview.total_minor)}</span></div>
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    <div className="flex justify-between"><span>Your fare + charges</span><span>{formatNaira(preview.transporter_charge_minor)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Platform commission ({formatPercent(preview.commission_rate_percent ?? commission)})</span><span>−{formatNaira(preview.commission_fee_minor)}</span></div>
                    <div className="flex justify-between text-emerald-700 font-medium"><span>Your earnings</span><span>{formatNaira(preview.transporter_earnings_minor ?? preview.transporter_charge_minor - preview.commission_fee_minor)}</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">Priced from {preview.pricing_source === 'company' ? 'your rate card' : preview.pricing_source === 'platform' ? 'the platform rate (no rate of yours for this type)' : 'the catalogue base price'}.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Surge rules (platform) */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-[#F97316]" /> Active Surge Rules</CardTitle>
              <p className="text-sm text-muted-foreground">Set by Hauliss; multiplied into the transport fare while in force.</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-14 w-full rounded-lg" />
              ) : activeSurgeRules.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No surge rules are currently active</div>
              ) : (
                <div className="space-y-3">
                  {activeSurgeRules.map((rule, i) => (
                    <div key={`${rule.name}-${i}`} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <p className="font-medium">{rule.name || 'Surge rule'}</p>
                      <Badge className="bg-[#F97316]/10 text-[#F97316] hover:bg-[#F97316]/10 text-base font-semibold">{formatMultiplier(rule.multiplier)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Charge dialog */}
      <Dialog open={chargeOpen} onOpenChange={(v) => { if (!chargeSaving) setChargeOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCharge ? `Edit ${editingCharge.name}` : 'Add a charge'}</DialogTitle>
            <DialogDescription>Shown as its own line on the shipper's quote and paid to you with the fare.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ch-name">Name</Label>
              <Input id="ch-name" placeholder="e.g. Loading and unloading" value={chargeForm.name} disabled={chargeSaving} onChange={(e) => setChargeForm({ ...chargeForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-desc">Description (optional)</Label>
              <Input id="ch-desc" placeholder="What the shipper gets" value={chargeForm.description} disabled={chargeSaving} onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ch-type">Charge type</Label>
                <select id="ch-type" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={chargeForm.charge_type} disabled={chargeSaving} onChange={(e) => setChargeForm({ ...chargeForm, charge_type: e.target.value as 'fixed' | 'percent' })}>
                  <option value="fixed">Fixed amount</option>
                  <option value="percent">Percentage of the transport fare</option>
                </select>
              </div>
              {chargeForm.charge_type === 'fixed' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="ch-amount">Amount (₦)</Label>
                  <Input id="ch-amount" type="number" min="0" value={chargeForm.amount} disabled={chargeSaving} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="ch-percent">Percentage (max 50)</Label>
                  <Input id="ch-percent" type="number" min="0" max="50" step="0.5" value={chargeForm.percent} disabled={chargeSaving} onChange={(e) => setChargeForm({ ...chargeForm, percent: e.target.value })} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-vt">Applies to</Label>
              <select id="ch-vt" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={chargeForm.truck_type_id} disabled={chargeSaving} onChange={(e) => setChargeForm({ ...chargeForm, truck_type_id: e.target.value })}>
                <option value="">All vehicle types</option>
                {vehicleTypes.map((vt) => <option key={vt.id} value={vt.id}>{vt.name}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Shipper chooses this charge</p>
                <p className="text-xs text-muted-foreground">Off = added to every quote automatically. On = offered as an option in the app.</p>
              </div>
              <Switch checked={chargeForm.is_optional} disabled={chargeSaving} onCheckedChange={(v) => setChargeForm({ ...chargeForm, is_optional: v })} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">Active</p>
              <Switch checked={chargeForm.is_active} disabled={chargeSaving} onCheckedChange={(v) => setChargeForm({ ...chargeForm, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeOpen(false)} disabled={chargeSaving}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2" onClick={saveCharge} disabled={chargeSaving}>
              {chargeSaving && <Loader2 className="w-4 h-4 animate-spin" />} {editingCharge ? 'Save changes' : 'Add charge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
