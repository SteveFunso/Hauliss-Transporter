import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Truck,
  Clock,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/useApi';
import { getTruckTypes, updateTruckType, deleteTruckType, createTruckType, type TruckType } from '@/lib/api/fleet';
import { getSettings, updateSettings } from '@/lib/api/settings';
import { toast } from 'sonner';

type PricingConfig = TruckType & { active: boolean };

const defaultFormData = { name: '', basePrice: '', minPrice: '', maxPrice: '', capacity: '' };

export function Pricing() {
  const { data: truckTypes, isLoading, refetch } = useApi(() => getTruckTypes(), []);
  const { data: settings } = useApi(() => getSettings(), []);
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PricingConfig | null>(null);
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [savingCommission, setSavingCommission] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (Array.isArray(truckTypes)) {
      setConfigs(truckTypes.map(t => ({ ...t, active: t.is_available })));
    }
  }, [truckTypes]);

  useEffect(() => {
    if (settings) {
      const pcr = settings.platform_commission_rate;
      const ratePct = (typeof pcr === 'object' ? Number((pcr as any)?.value) : Number(pcr)) * 100;
      setCommissionRate(Number.isFinite(ratePct) ? ratePct : 10);
    }
  }, [settings]);

  const handleToggleActive = async (id: string) => {
    const config = configs.find(c => c.id === id);
    if (!config) return;
    const newActive = !config.active;
    setToggleLoading(id);
    try {
      await updateTruckType(id, { is_available: newActive });
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, active: newActive } : c));
      toast.success(`Status updated to ${newActive ? 'Active' : 'Inactive'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setToggleLoading(null);
    }
  };

  const handleDeleteConfirm = async (id: string) => {
    setDeleteLoading(true);
    try {
      await deleteTruckType(id);
      setConfigs(prev => prev.filter(config => config.id !== id));
      toast.success('Pricing removed');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete pricing');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenEdit = (config: PricingConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      basePrice: String(config.base_price),
      minPrice: String(config.min_price),
      maxPrice: String(config.max_price),
      capacity: config.capacity,
    });
  };

  const handleFormSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a pricing name');
      return;
    }
    if (!formData.capacity.trim()) {
      toast.error('Please enter a capacity');
      return;
    }
    const basePrice = Number(formData.basePrice);
    const minPrice = Number(formData.minPrice);
    const maxPrice = Number(formData.maxPrice);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      toast.error('Base price must be greater than 0');
      return;
    }
    if (!Number.isFinite(minPrice) || minPrice <= 0) {
      toast.error('Min price must be greater than 0');
      return;
    }
    if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
      toast.error('Max price must be greater than 0');
      return;
    }
    if (minPrice > maxPrice) {
      toast.error('Min price cannot be greater than max price');
      return;
    }
    setFormSaving(true);
    try {
      if (editingConfig) {
        await updateTruckType(editingConfig.id, {
          name: formData.name,
          base_price: basePrice,
          min_price: minPrice,
          max_price: maxPrice,
          capacity: formData.capacity,
        });
        toast.success('Pricing updated');
      } else {
        await createTruckType({
          name: formData.name,
          capacity: formData.capacity,
          base_price: basePrice,
          min_price: minPrice,
          max_price: maxPrice,
          is_available: true,
        });
        toast.success('Pricing configuration created');
      }
      setShowForm(false);
      setEditingConfig(null);
      setFormData(defaultFormData);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save pricing');
    } finally {
      setFormSaving(false);
    }
  };

  const handleSaveCommission = async () => {
    setSavingCommission(true);
    try {
      await updateSettings({ platform_commission_rate: { value: commissionRate / 100 } });
      toast.success('Commission rates updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update commission');
    } finally {
      setSavingCommission(false);
    }
  };

  const getTruckTypeIcon = (_type: string) => {
    return <Truck className="w-5 h-5" />;
  };

  const driverCommission = 100 - commissionRate;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Pricing Configuration</h2>
          <p className="text-muted-foreground mt-1">
            Manage pricing models and commission structures for different truck types
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-4 h-4" />
          Add Pricing
        </Button>
      </div>

      {/* Pricing Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display font-semibold text-lg">
            Pricing Models ({configs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck Type</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Min Price</TableHead>
                  <TableHead>Max Price</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#F97316]/10 flex items-center justify-center text-[#F97316]">
                          {getTruckTypeIcon(config.name)}
                        </div>
                        <div>
                          <p className="font-medium">{config.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {config.capacity}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">₦{config.base_price.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">₦{config.min_price.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">₦{config.max_price.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{config.rating != null ? Number(config.rating).toFixed(1) : 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.active}
                          disabled={toggleLoading === config.id}
                          onCheckedChange={() => handleToggleActive(config.id)}
                        />
                        <Badge className={config.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}>
                          {toggleLoading === config.id ? '...' : (config.active ? 'Active' : 'Inactive')}
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
                          <DropdownMenuItem onClick={() => handleOpenEdit(config)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteConfirmId(config.id)}
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
          )}
        </CardContent>
      </Card>

      {/* Commission Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#F97316]" /> Commission Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Platform Commission</p>
                <p className="text-sm text-muted-foreground">Percentage taken from each trip</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-20 text-right font-bold text-lg"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Driver Commission</p>
                <p className="text-sm text-muted-foreground">Percentage paid to drivers</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{driverCommission}</span>
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            <Button
              className="w-full bg-[#F97316] hover:bg-[#F97316]/90 text-white"
              onClick={handleSaveCommission}
              disabled={savingCommission}
            >
              {savingCommission ? 'Saving...' : 'Update Commission Rates'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#F97316]" /> Payout Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Payout Frequency</p>
                <p className="text-sm text-muted-foreground">How often drivers get paid</p>
              </div>
              <Badge className="bg-[#F97316]/10 text-[#F97316]">
                {typeof settings?.payout_frequency === 'object' ? (settings.payout_frequency as any)?.value : settings?.payout_frequency ?? 'Weekly'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Minimum Payout</p>
                <p className="text-sm text-muted-foreground">Minimum balance to withdraw</p>
              </div>
              <span className="text-lg font-bold">
                ₦{(((typeof settings?.min_payout === 'object' ? (settings.min_payout as any)?.value : settings?.min_payout) ?? 500000) / 100).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Processing Fee</p>
                <p className="text-sm text-muted-foreground">Fee per withdrawal</p>
              </div>
              <span className="text-lg font-bold">
                ₦{(((typeof settings?.payout_fee === 'object' ? (settings.payout_fee as any)?.value : settings?.payout_fee) ?? 5000) / 100).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Form Dialog */}
      <Dialog open={showForm || !!editingConfig} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingConfig(null); setFormData(defaultFormData); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">
              {editingConfig ? 'Edit Pricing' : 'Add New Pricing'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pricing Name</Label>
              <Input
                placeholder="e.g., Standard Flatbed"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Price (NGN)</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Price (NGN)</Label>
                <Input
                  type="number"
                  placeholder="3000"
                  value={formData.minPrice}
                  onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Price (NGN)</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  placeholder="e.g., 10 tons"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingConfig(null); setFormData(defaultFormData); }} disabled={formSaving}>
              Cancel
            </Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleFormSubmit} disabled={formSaving}>
              {formSaving ? 'Saving...' : (editingConfig ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to remove this pricing configuration? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteConfirm(deleteConfirmId)} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
