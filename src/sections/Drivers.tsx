import { realPhotoUrl } from '@/lib/utils';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  MoreVertical,
  UserPlus,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit,
  Ban,
  Wallet,
  FileCheck,
  Shield,
  Phone,
  Mail,
  Filter,
  Truck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
  FileText,
  File as FileIcon,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import {
  getDrivers,
  getDriverDocuments,
  reviewDriverDocument,
  updateDriverStatus,
  updateDriver,
  getDriverStats,
  uploadDriverDocumentFile,
  submitDriverDocument,
  DRIVER_DOCUMENT_TYPES,
  DRIVER_DOCUMENT_ACCEPT,
  type AdminDriver,
  type DriverDocument,
  type DriverDocumentType,
} from '@/lib/api/drivers';
import { preRegisterDriver, resendDriverInvite } from '@/lib/api/drivers';
import { useAuth } from '@/lib/auth/AuthContext';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const SEARCH_KEY = 'hauliss_search';

const selectClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20';

const PDF_URL_RE = /\.pdf(\?|#|$)/i;
const ALLOWED_UPLOAD_RE = /\.(jpe?g|png|webp|heic|gif|pdf)$/i;
const ALLOWED_UPLOAD_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'application/pdf',
]);

const defaultUploadForm: {
  type: DriverDocumentType;
  file: File | null;
  expiry_date: string;
  document_number: string;
} = { type: 'drivers_license', file: null, expiry_date: '', document_number: '' };

const documentTypeLabel = (type: string) =>
  DRIVER_DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type;

const formatDocDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Thumbnail for a document: image preview, a PDF tile, or a generic file tile. */
function DocumentThumb({ url, title }: { url?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const base = 'w-12 h-12 rounded-md border shrink-0 flex items-center justify-center overflow-hidden';
  if (url && PDF_URL_RE.test(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${title} (PDF)`}
        className={`${base} flex-col bg-red-50 border-red-100 text-red-600`}
      >
        <FileText className="w-5 h-5" />
        <span className="text-[9px] font-semibold leading-none mt-0.5">PDF</span>
      </a>
    );
  }
  if (url && !failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${title}`}
        className={`${base} bg-muted border-border`}
      >
        <img
          src={url}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </a>
    );
  }
  return (
    <div className={`${base} bg-muted border-border text-muted-foreground`} title={title}>
      <FileIcon className="w-5 h-5" />
    </div>
  );
}

export function Drivers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<AdminDriver | null>(null);
  const [driverDocs, setDriverDocs] = useState<DriverDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialog states
  const [addDriverOpen, setAddDriverOpen] = useState(false);
  const [editDriverOpen, setEditDriverOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<AdminDriver | null>(null);

  // Add driver form. Company and Transporter ID are not typed in: a company
  // admin can only add drivers to their own company, so both come from the
  // signed-in profile (typing the company's UUID here used to produce
  // "Cannot assign a driver to another company").
  const { user } = useAuth();
  const ownTransporterId = user?.transporterId || '';
  const ownCompanyName = user?.companyName || '';
  const [addForm, setAddForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    vehicle_type: '',
    license_number: '',
  });

  // Edit driver form
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone_number: '',
    vehicle_type: '',
    transporter_id: '',
  });

  // Advanced filter state
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');

  // Document review / upload state (QA TP-DRV-06/07)
  const [docActionLoading, setDocActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DriverDocument | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(defaultUploadForm);
  const [uploading, setUploading] = useState(false);
  // Remounts the file input to clear it after a successful upload.
  const [fileInputKey, setFileInputKey] = useState(0);

  const pagination = usePagination(20);

  // Deep link from other sections (e.g. the header search).
  useEffect(() => {
    const saved = sessionStorage.getItem(SEARCH_KEY);
    if (saved === null) return;
    sessionStorage.removeItem(SEARCH_KEY);
    if (saved.trim()) {
      setSearchQuery(saved);
      pagination.setPage(1);
    }
  }, []);

  // KPI cards read DRIVER stats (was user stats: "Active Drivers 63" against "Total Drivers 29").
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useApi(
    () => getDriverStats(),
    []
  );

  const { data, isLoading, refetch } = useApi(
    () => getDrivers({
      page: pagination.page,
      limit: pagination.limit,
      status: statusFilter,
      search: searchQuery || undefined,
      vehicle_type: vehicleTypeFilter || undefined,
    }),
    [pagination.page, statusFilter, searchQuery, vehicleTypeFilter]
  );

  const driverList: AdminDriver[] = (data as any)?.data || [];
  const paginationMeta = (data as any)?.pagination;

  // Sync pagination total when API response arrives
  useEffect(() => {
    if (paginationMeta?.total) {
      pagination.setTotal(paginationMeta.total);
    }
  }, [paginationMeta?.total]);

  // Ignore responses from a superseded documents request (driver switched mid-flight).
  const docsRequestRef = useRef(0);
  const loadDocuments = useCallback(async (driverId: string) => {
    const requestId = ++docsRequestRef.current;
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await getDriverDocuments(driverId);
      const payload = (res as any)?.data ?? res;
      const docs = Array.isArray(payload?.documents) ? (payload.documents as DriverDocument[]) : [];
      if (requestId === docsRequestRef.current) setDriverDocs(docs);
    } catch (err: any) {
      if (requestId === docsRequestRef.current) {
        setDriverDocs([]);
        setDocsError(err?.message || 'Failed to load documents');
      }
    } finally {
      if (requestId === docsRequestRef.current) setDocsLoading(false);
    }
  }, []);

  // Fetch documents when a driver is selected
  useEffect(() => {
    setUploadOpen(false);
    setUploadForm(defaultUploadForm);
    setFileInputKey((k) => k + 1);
    if (!selectedDriver) {
      docsRequestRef.current += 1;
      setDriverDocs([]);
      setDocsError(null);
      setDocsLoading(false);
      return;
    }
    loadDocuments(selectedDriver.id);
  }, [selectedDriver?.id, loadDocuments]);

  // BUG-001/002: real document review — this panel previously had no
  // approve/reject controls at all (rows were click-to-toast stubs).
  const reviewDocument = async (doc: DriverDocument, status: 'verified' | 'rejected', reason?: string): Promise<boolean> => {
    if (!selectedDriver) return false;
    setDocActionLoading(doc.id);
    try {
      await reviewDriverDocument(doc.id, status, reason);
      toast.success(`${doc.title} ${status === 'verified' ? 'approved' : 'rejected'}`);
      await loadDocuments(selectedDriver.id);
      // Once all documents are verified the backend activates the driver —
      // refresh the list so the status column updates.
      refetch(); refetchStats();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to review document');
      return false;
    } finally {
      setDocActionLoading(null);
    }
  };

  const openRejectDialog = (doc: DriverDocument) => {
    setRejectReason('');
    setRejectTarget(doc);
  };

  const closeRejectDialog = () => {
    if (rejectSaving) return;
    setRejectTarget(null);
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('A rejection reason is required');
      return;
    }
    setRejectSaving(true);
    try {
      const ok = await reviewDocument(rejectTarget, 'rejected', reason);
      if (ok) {
        setRejectTarget(null);
        setRejectReason('');
      }
    } finally {
      setRejectSaving(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedDriver) return;
    const file = uploadForm.file;
    if (!file) {
      toast.error('Choose a file to upload');
      return;
    }
    if (!(ALLOWED_UPLOAD_MIME.has(file.type) || ALLOWED_UPLOAD_RE.test(file.name))) {
      toast.error('Unsupported file type. Upload a JPEG, PNG, WebP, HEIC, GIF or PDF.');
      return;
    }
    if (uploadForm.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(uploadForm.expiry_date)) {
      toast.error('Expiry date must be a valid date');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await uploadDriverDocumentFile(file, uploadForm.type);
      await submitDriverDocument({
        driver_id: selectedDriver.id,
        type: uploadForm.type,
        image_url: file_url,
        expiry_date: uploadForm.expiry_date || undefined,
        document_number: uploadForm.document_number.trim() || undefined,
      });
      toast.success(`${documentTypeLabel(uploadForm.type)} uploaded and submitted for review`);
      setUploadForm(defaultUploadForm);
      setFileInputKey((k) => k + 1);
      setUploadOpen(false);
      await loadDocuments(selectedDriver.id);
      refetch(); refetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = useCallback(async (driverId: string, newStatus: string, label: string) => {
    setActionLoading(driverId);
    try {
      await updateDriverStatus(driverId, newStatus);
      toast.success(`Driver ${label} successfully`);
      refetch(); refetchStats();
      if (selectedDriver?.id === driverId) {
        setSelectedDriver(null);
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to ${label.toLowerCase()} driver`);
    } finally {
      setActionLoading(null);
    }
  }, [refetch, refetchStats, selectedDriver]);

  const [addLoading, setAddLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Earnings dialog state
  const [earningsOpen, setEarningsOpen] = useState(false);
  const [earningsDriver, setEarningsDriver] = useState<AdminDriver | null>(null);

  const handleResendInvite = async (driver: AdminDriver) => {
    setActionLoading(driver.id);
    try {
      await resendDriverInvite(driver.id);
      toast.success(`Sign-up instructions re-sent to ${driver.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Could not resend the invitation', { duration: 8000 });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddDriver = async () => {
    if (!addForm.email || !addForm.full_name || !addForm.phone) {
      toast.error('Email, Full Name and Phone are required');
      return;
    }
    setAddLoading(true);
    try {
      // Pre-registration (not a password account): the driver completes
      // sign-up in the driver app with this email + the company's Transporter ID.
      const created = await preRegisterDriver({
        email: addForm.email.trim(),
        full_name: addForm.full_name.trim(),
        phone_number: addForm.phone.trim(),
        vehicle_type: addForm.vehicle_type.trim() || undefined,
        license_number: addForm.license_number.trim() || undefined,
        company_name: ownCompanyName || undefined,
        transporter_id: ownTransporterId || undefined,
      });
      toast.success(
        created?.invite_email_sent
          ? `Driver added as pending. Sign-up instructions were emailed to ${addForm.email.trim()}.`
          : `Driver added as pending. Ask ${addForm.full_name.trim()} to sign up in the driver app with ${addForm.email.trim()}` +
              (ownTransporterId ? ` and Transporter ID ${ownTransporterId}.` : '.'),
        { duration: 9000 }
      );
      setAddForm({ email: '', full_name: '', phone: '', vehicle_type: '', license_number: '' });
      setAddDriverOpen(false);
      refetch(); refetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add driver', { duration: 8000 });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditDriver = async () => {
    if (!editingDriver) return;
    setEditLoading(true);
    try {
      await updateDriver(editingDriver.id, {
        full_name: editForm.full_name,
        phone_number: editForm.phone_number,
        vehicle_type: editForm.vehicle_type,
        transporter_id: editForm.transporter_id,
      });
      toast.success(`Driver "${editForm.full_name}" updated successfully`);
      setEditDriverOpen(false);
      setEditingDriver(null);
      refetch(); refetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update driver');
    } finally {
      setEditLoading(false);
    }
  };

  const openEditDialog = (driver: AdminDriver) => {
    setEditingDriver(driver);
    setEditForm({
      full_name: driver.full_name || '',
      phone_number: driver.phone_number || '',
      vehicle_type: driver.vehicle_type || '',
      transporter_id: driver.transporter_id || '',
    });
    setEditDriverOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Inactive</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Suspended</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getDocumentBadge = (status: string) => {
    switch (status) {
      // The backend vocabulary is 'verified' (BUG-001 QA follow-up: this
      // component compared against 'approved', so verified docs rendered as
      // "unknown" and progress stuck at 0%). 'approved' kept for safety.
      case 'verified':
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1"><CheckCircle className="w-3 h-3" /> Verified</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><AlertCircle className="w-3 h-3" /> Expired</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getVerificationProgress = (docs: DriverDocument[]) => {
    if (docs.length === 0) return 0;
    const verified = docs.filter(d => d.status === 'verified' || d.status === 'approved').length;
    return Math.round((verified / docs.length) * 100);
  };

  const getInitials = (name?: string) =>
    (name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  // Loading skeleton for table rows
  const TableRowSkeleton = () => (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded ml-auto" /></TableCell>
    </TableRow>
  );

  const uploadFormPanel = (
    <div className="p-3 rounded-lg border border-dashed border-border space-y-3">
      <p className="text-sm font-medium flex items-center gap-2">
        <Upload className="w-4 h-4 text-[#F97316]" /> Upload on the driver's behalf
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="doc-type" className="text-xs">Document type</Label>
        <select
          id="doc-type"
          className={selectClass}
          value={uploadForm.type}
          disabled={uploading}
          onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value as DriverDocumentType })}
        >
          {DRIVER_DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-file" className="text-xs">File (JPEG, PNG, WebP, HEIC, GIF or PDF)</Label>
        <Input
          key={fileInputKey}
          id="doc-file"
          type="file"
          accept={DRIVER_DOCUMENT_ACCEPT}
          disabled={uploading}
          onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] ?? null })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-expiry" className="text-xs">Expiry date (optional)</Label>
        <Input
          id="doc-expiry"
          type="date"
          value={uploadForm.expiry_date}
          disabled={uploading}
          onChange={(e) => setUploadForm({ ...uploadForm, expiry_date: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-number" className="text-xs">Document number (optional)</Label>
        <Input
          id="doc-number"
          placeholder="e.g. licence or policy number"
          value={uploadForm.document_number}
          disabled={uploading}
          onChange={(e) => setUploadForm({ ...uploadForm, document_number: e.target.value })}
        />
      </div>
      <div className="flex gap-2 justify-end">
        {driverDocs.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(false)} disabled={uploading}>
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-1.5"
          onClick={handleUploadDocument}
          disabled={uploading || !uploadForm.file}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading...' : 'Upload & Submit'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Drivers</h2>
          <p className="text-muted-foreground mt-1">
            Manage drivers, verify documents, and track performance
          </p>
        </div>
        <Button
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
          onClick={() => setAddDriverOpen(true)}
        >
          <UserPlus className="w-4 h-4" />
          Add Driver
        </Button>
      </div>

      {/* Add Driver Dialog */}
      <Dialog open={addDriverOpen} onOpenChange={setAddDriverOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Driver</DialogTitle>
            <DialogDescription>
              The driver is added to {ownCompanyName || 'your company'}
              {ownTransporterId ? ` (Transporter ID ${ownTransporterId})` : ''} as pending and finishes sign-up in the
              driver app with this email and your Transporter ID.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="driver@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-name">Full Name *</Label>
              <Input
                id="add-name"
                placeholder="John Doe"
                value={addForm.full_name}
                onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-phone">Phone *</Label>
              <Input
                id="add-phone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="add-vehicle">Vehicle type</Label>
                <Input
                  id="add-vehicle"
                  placeholder="Mini Van"
                  value={addForm.vehicle_type}
                  onChange={(e) => setAddForm({ ...addForm, vehicle_type: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-license">Licence number</Label>
                <Input
                  id="add-license"
                  placeholder="Optional"
                  value={addForm.license_number}
                  onChange={(e) => setAddForm({ ...addForm, license_number: e.target.value })}
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium text-right">{ownCompanyName || '—'}</span>
              </div>
              <div className="flex justify-between gap-3 mt-1">
                <span className="text-muted-foreground">Transporter ID</span>
                <span className="font-mono font-medium">{ownTransporterId || '—'}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDriverOpen(false)} disabled={addLoading}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleAddDriver} disabled={addLoading}>
              {addLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding...</> : 'Add Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Driver Dialog */}
      <Dialog open={editDriverOpen} onOpenChange={setEditDriverOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone_number}
                onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-vehicle">Vehicle Type</Label>
              <Input
                id="edit-vehicle"
                value={editForm.vehicle_type}
                onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tid">Transporter ID</Label>
              <Input
                id="edit-tid"
                value={editForm.transporter_id}
                onChange={(e) => setEditForm({ ...editForm, transporter_id: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDriverOpen(false)} disabled={editLoading}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleEditDriver} disabled={editLoading}>
              {editLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Document Dialog (replaces window.prompt) */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) closeRejectDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.title || 'document'}</DialogTitle>
            <DialogDescription>
              Tell the driver why this document was rejected. The reason is sent to them so they can resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason *</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              placeholder="e.g. The photo is blurry — please upload a clear image of the full document"
              value={rejectReason}
              disabled={rejectSaving}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRejectDialog} disabled={rejectSaving}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={rejectSaving || !rejectReason.trim()}
            >
              {rejectSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rejecting...</> : 'Reject Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Drivers</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{statsData?.total?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                <Truck className="w-6 h-6 text-[#F97316]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Drivers</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{statsData?.active?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Verification</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold">{statsData?.pending_activation?.toLocaleString() ?? '—'}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Rating</p>
                <p className="text-2xl font-semibold">N/A</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Star className="w-6 h-6 text-blue-600 fill-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers by name, email, or transporter ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  pagination.setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  pagination.setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
              <Button variant="outline" size="icon" onClick={() => setAdvancedFilterOpen(true)}>
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drivers Table */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg">
                All Drivers ({paginationMeta?.total ?? driverList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Driver</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <>
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                    </>
                  ) : driverList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No drivers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    driverList.map((driver) => (
                      <TableRow
                        key={driver.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedDriver(driver)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={realPhotoUrl(driver.profile_photo_url)} alt={driver.full_name} />
                              <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white">
                                {getInitials(driver.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{driver.full_name}</p>
                              <p className="text-sm text-muted-foreground">{driver.transporter_id || driver.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm">
                            {driver.vehicle_type || '—'}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(driver.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDriver(driver); }}>
                                <Eye className="w-4 h-4 mr-2" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(driver); }}>
                                <Edit className="w-4 h-4 mr-2" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDriver(driver); }}>
                                <FileCheck className="w-4 h-4 mr-2" /> Verify Documents
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEarningsDriver(driver); setEarningsOpen(true); }}>
                                <Wallet className="w-4 h-4 mr-2" /> View Earnings
                              </DropdownMenuItem>
                              {driver.status === 'pending_activation' && (
                                <DropdownMenuItem
                                  disabled={actionLoading === driver.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResendInvite(driver);
                                  }}
                                >
                                  {actionLoading === driver.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                  )}
                                  Resend invitation email
                                </DropdownMenuItem>
                              )}
                              {driver.status === 'active' ? (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  disabled={actionLoading === driver.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(driver.id, 'suspended', 'suspended');
                                  }}
                                >
                                  {actionLoading === driver.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Ban className="w-4 h-4 mr-2" />
                                  )}
                                  Suspend
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-emerald-600"
                                  disabled={actionLoading === driver.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(driver.id, 'active', 'activated');
                                  }}
                                >
                                  {actionLoading === driver.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                  )}
                                  Activate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {paginationMeta && paginationMeta.total_pages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({paginationMeta.total} drivers)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={pagination.prevPage}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={pagination.nextPage}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Driver Details Panel */}
        <div className="lg:col-span-1">
          {selectedDriver ? (
            <Card className="border-0 shadow-sm sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display font-semibold text-lg">
                    Driver Details
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedDriver(null)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={realPhotoUrl(selectedDriver.profile_photo_url)} alt={selectedDriver.full_name} />
                    <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white text-lg">
                      {getInitials(selectedDriver.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedDriver.full_name}</h3>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(selectedDriver.status)}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedDriver.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedDriver.phone_number || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedDriver.transporter_id || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedDriver.vehicle_type || '—'}</span>
                  </div>
                </div>

                {/* Verification Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Verification Progress</span>
                    {docsLoading ? (
                      <Skeleton className="h-4 w-8" />
                    ) : (
                      <span>{getVerificationProgress(driverDocs)}%</span>
                    )}
                  </div>
                  {docsLoading ? (
                    <Skeleton className="h-2 w-full rounded-full" />
                  ) : (
                    <Progress value={getVerificationProgress(driverDocs)} className="h-2" />
                  )}
                </div>

                {/* Documents */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      Documents
                      {!docsLoading && !docsError && driverDocs.length > 0 && (
                        <span className="text-muted-foreground font-normal text-sm"> ({driverDocs.length})</span>
                      )}
                    </h4>
                    {!docsLoading && !docsError && driverDocs.length > 0 && !uploadOpen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-[#F97316] hover:text-[#F97316]"
                        onClick={() => setUploadOpen(true)}
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload
                      </Button>
                    )}
                  </div>
                  {docsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                  ) : docsError ? (
                    <div className="p-4 rounded-lg bg-red-50 text-center space-y-2">
                      <p className="text-sm text-red-700">{docsError}</p>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => loadDocuments(selectedDriver.id)}>
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                      </Button>
                    </div>
                  ) : driverDocs.length === 0 ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                        <p className="text-sm font-medium">No documents submitted yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This driver has not uploaded any verification documents. You can upload them on their behalf below.
                        </p>
                      </div>
                      {uploadFormPanel}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {driverDocs.map((doc) => {
                        const expiry = formatDocDate(doc.expiry_date);
                        const expiryDate = doc.expiry_date ? new Date(doc.expiry_date) : null;
                        const isExpired = !!expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now();
                        return (
                          <div key={doc.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                            <div className="flex items-start gap-3">
                              <DocumentThumb url={doc.image_url} title={doc.title || documentTypeLabel(doc.type)} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium truncate">{doc.title || documentTypeLabel(doc.type)}</p>
                                  {getDocumentBadge(doc.status)}
                                </div>
                                {doc.document_number && (
                                  <p className="text-xs text-muted-foreground truncate">No. {doc.document_number}</p>
                                )}
                                <p className={`text-xs ${isExpired ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                  {expiry ? `${isExpired ? 'Expired' : 'Expires'} ${expiry}` : 'No expiry date'}
                                </p>
                                {doc.image_url && (
                                  <a
                                    href={doc.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-[#F97316] hover:underline mt-1"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Open
                                  </a>
                                )}
                              </div>
                            </div>
                            {doc.status === 'rejected' && doc.rejection_reason && (
                              <p className="text-xs text-red-700 bg-red-50 rounded-md px-2 py-1.5">
                                Reason: {doc.rejection_reason}
                              </p>
                            )}
                            {doc.status === 'pending' && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  disabled={docActionLoading === doc.id}
                                  onClick={() => reviewDocument(doc, 'verified')}
                                >
                                  {docActionLoading === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Approve'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2"
                                  disabled={docActionLoading === doc.id}
                                  onClick={() => openRejectDialog(doc)}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {uploadOpen && uploadFormPanel}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-[#F97316]">—</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Trips</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-[#111111]">—</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Earnings</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-[#F97316] hover:bg-[#F97316]/90 text-white"
                    onClick={() => {
                      if (selectedDriver.phone_number) {
                        window.open(`tel:${selectedDriver.phone_number}`);
                      } else {
                        toast.info('No phone number available for this driver');
                      }
                    }}
                  >
                    <Phone className="w-4 h-4 mr-2" /> Call Driver
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedDriver.email) {
                        window.open(`mailto:${selectedDriver.email}`);
                      } else {
                        toast.info('No email available for this driver');
                      }
                    }}
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a driver to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Advanced Filters Dialog */}
      <Dialog open={advancedFilterOpen} onOpenChange={setAdvancedFilterOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filter-vehicle">Vehicle Type</Label>
              <Input
                id="filter-vehicle"
                placeholder="e.g., Flatbed, Box Truck"
                value={vehicleTypeFilter}
                onChange={(e) => setVehicleTypeFilter(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setVehicleTypeFilter('');
            }}>
              Clear Filters
            </Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={() => {
              pagination.setPage(1);
              setAdvancedFilterOpen(false);
            }}>
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Earnings Summary Dialog */}
      <Dialog open={earningsOpen} onOpenChange={setEarningsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Driver Earnings Summary</DialogTitle>
          </DialogHeader>
          {earningsDriver && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={realPhotoUrl(earningsDriver.profile_photo_url)} alt={earningsDriver.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white">
                    {getInitials(earningsDriver.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{earningsDriver.full_name}</p>
                  <p className="text-sm text-muted-foreground">{earningsDriver.transporter_id || earningsDriver.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-[#F97316]">—</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Trips</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-[#111111]">—</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Earnings</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Detailed earnings data will be available once trips are recorded for this driver.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarningsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
