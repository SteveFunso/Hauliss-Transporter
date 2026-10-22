import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText, Upload, ExternalLink, Trash2, Loader2, RefreshCw, CheckCircle, Clock, XCircle, AlertCircle, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  getCompanyDocuments,
  submitCompanyDocument,
  deleteCompanyDocument,
  type CompanyDocument,
  type CompanyDocRequirement,
  type CompanyDocumentsPayload,
} from '@/lib/api/company';
import { uploadDriverDocumentFile } from '@/lib/api/drivers';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.gif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/gif,application/pdf';
const ALLOWED_RE = /\.(jpe?g|png|webp|heic|gif|pdf)$/i;
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;

const fmtDate = (v?: string | number | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
};

const VERIFICATION: Record<string, { label: string; className: string; hint: string }> = {
  verified: { label: 'Verified', className: 'bg-emerald-100 text-emerald-700', hint: 'Your company is verified. Keep documents current by re-uploading them before they expire.' },
  under_review: { label: 'Under review', className: 'bg-amber-100 text-amber-700', hint: 'Hauliss is reviewing your documents.' },
  documents_submitted: { label: 'Documents submitted', className: 'bg-amber-100 text-amber-700', hint: 'Your documents are waiting for review by Hauliss.' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700', hint: 'One or more documents were rejected. Check the notes below and upload a corrected file.' },
  unverified: { label: 'Unverified', className: 'bg-slate-100 text-slate-600', hint: 'Upload the required documents to start verification.' },
};

type UploadForm = { file: File | null; expiry_date: string; document_number: string; name: string };
const emptyUpload: UploadForm = { file: null, expiry_date: '', document_number: '', name: '' };

type UploadTarget = { key: string; requirement: CompanyDocRequirement | null; replacing: CompanyDocument | null };

/**
 * Settings → Documents. The company's compliance documents (the files behind
 * the KYC requirements Hauliss publishes for transport companies, plus any
 * extra document), each uploaded here, reviewed by Hauliss and re-uploaded
 * when it expires or is rejected. One live document per type.
 */
export function CompanyDocuments() {
  const [data, setData] = useState<CompanyDocumentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCompanyDocuments());
    } catch (e: any) {
      setError(e?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // One upload panel at a time: under the requirement it satisfies, or under
  // "Other documents" for a free-form one.
  const [target, setTarget] = useState<UploadTarget | null>(null);
  const [form, setForm] = useState<UploadForm>(emptyUpload);
  const [fileKey, setFileKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const documents = data?.documents || [];
  const requirements = data?.requirements || [];
  const latestByType = useMemo(() => {
    const m = new Map<string, CompanyDocument>();
    for (const d of [...documents].sort((a, b) => b.uploaded_at - a.uploaded_at)) {
      if (!m.has(d.document_type)) m.set(d.document_type, d);
    }
    return m;
  }, [documents]);
  const requirementTypes = useMemo(() => new Set(requirements.map((r) => r.document_type)), [requirements]);
  const otherDocs = documents.filter((d) => !requirementTypes.has(d.document_type));

  const openUpload = (requirement: CompanyDocRequirement | null, replacing: CompanyDocument | null) => {
    setTarget({ key: requirement ? requirement.id : 'other', requirement, replacing });
    setForm({
      ...emptyUpload,
      document_number: replacing?.document_number || '',
      name: requirement ? requirement.name : replacing?.document_name || '',
    });
    setFileKey((k) => k + 1);
  };
  const closeUpload = () => { setTarget(null); setForm(emptyUpload); };

  const submit = async () => {
    if (!target) return;
    const file = form.file;
    if (!file) { toast.error('Choose a file to upload'); return; }
    if (!ALLOWED_RE.test(file.name) && !ALLOWED_MIME.test(file.type)) {
      toast.error('Unsupported file type. Upload a JPEG, PNG, WebP, HEIC, GIF or PDF.');
      return;
    }
    const name = (target.requirement?.name || form.name).trim();
    if (!name) { toast.error('Give the document a name'); return; }
    if (form.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.expiry_date)) { toast.error('Expiry date must be a valid date'); return; }
    setUploading(true);
    try {
      const { file_url } = await uploadDriverDocumentFile(file, 'company_document');
      await submitCompanyDocument({
        document_type: target.requirement?.document_type || target.replacing?.document_type || name,
        document_name: name,
        requirement_id: target.requirement?.id || null,
        document_url: file_url,
        document_number: form.document_number.trim() || undefined,
        expiry_date: form.expiry_date || undefined,
        file_name: file.name,
      });
      toast.success(`${name} ${target.replacing ? 're-uploaded' : 'uploaded'} and submitted to Hauliss for review`);
      closeUpload();
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload the document');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (doc: CompanyDocument) => {
    if (!window.confirm(`Remove ${doc.document_name || doc.document_type}? You can upload it again afterwards.`)) return;
    setDeleting(doc.id);
    try {
      await deleteCompanyDocument(doc.id);
      toast.success('Document removed');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove the document');
    } finally {
      setDeleting(null);
    }
  };

  const badge = (doc: CompanyDocument | undefined) => {
    if (!doc) return <Badge variant="outline" className="gap-1"><AlertCircle className="w-3 h-3" /> Not uploaded</Badge>;
    if (doc.status === 'approved' && doc.is_expired) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><AlertCircle className="w-3 h-3" /> Expired</Badge>;
    if (doc.status === 'approved') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1"><CheckCircle className="w-3 h-3" /> Approved</Badge>;
    if (doc.status === 'rejected') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1"><Clock className="w-3 h-3" /> Pending review</Badge>;
  };

  const docDetails = (doc: CompanyDocument) => (
    <div className="text-xs text-muted-foreground space-y-0.5">
      <p>
        {doc.file_name ? `${doc.file_name} · ` : ''}Uploaded {fmtDate(doc.uploaded_at)}
        {doc.document_number ? ` · No. ${doc.document_number}` : ''}
      </p>
      {doc.expiry_date && (
        <p className={doc.is_expired ? 'text-red-600 font-medium' : ''}>{doc.is_expired ? 'Expired' : 'Expires'} {fmtDate(doc.expiry_date)}</p>
      )}
      {doc.status === 'rejected' && doc.review_notes && (
        <p className="text-red-700 bg-red-50 rounded-md px-2 py-1 inline-block">Reason: {doc.review_notes}</p>
      )}
      {doc.document_url && (
        <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[#F97316] hover:underline">
          <ExternalLink className="w-3 h-3" /> Open
        </a>
      )}
    </div>
  );

  const removeButton = (doc: CompanyDocument) => (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
      disabled={deleting === doc.id}
      onClick={() => remove(doc)}
      aria-label={`Remove ${doc.document_name || doc.document_type}`}
    >
      {deleting === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </Button>
  );

  const uploadPanel = (key: string) =>
    target?.key === key ? (
      <div className="mt-3 p-3 rounded-lg border border-dashed border-border space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <Upload className="w-4 h-4 text-[#F97316]" />
          {target.replacing
            ? `Re-upload ${target.requirement?.name || target.replacing.document_name || 'document'}`
            : target.requirement
              ? `Upload ${target.requirement.name}`
              : 'Upload another document'}
        </p>
        {target.replacing && (
          <p className="text-xs text-muted-foreground">
            The new file replaces the {target.replacing.status === 'rejected' ? 'rejected' : target.replacing.is_expired ? 'expired' : 'current'} document and shows as Pending until Hauliss approves it.
          </p>
        )}
        {!target.requirement && (
          <div className="space-y-1.5">
            <Label htmlFor="cdoc-name" className="text-xs">Document name</Label>
            <Input id="cdoc-name" placeholder="e.g. Fleet insurance policy" value={form.name} disabled={uploading} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cdoc-file" className="text-xs">File (JPEG, PNG, WebP, HEIC, GIF or PDF)</Label>
          <Input key={fileKey} id="cdoc-file" type="file" accept={ACCEPT} disabled={uploading} onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cdoc-expiry" className="text-xs">Expiry date (optional)</Label>
            <Input id="cdoc-expiry" type="date" value={form.expiry_date} disabled={uploading} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdoc-number" className="text-xs">Document / certificate number (optional)</Label>
            <Input id="cdoc-number" placeholder="e.g. RC 123456" value={form.document_number} disabled={uploading} onChange={(e) => setForm({ ...form, document_number: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={closeUpload} disabled={uploading}>Cancel</Button>
          <Button size="sm" className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-1.5" onClick={submit} disabled={uploading || !form.file}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload & Submit'}
          </Button>
        </div>
      </div>
    ) : null;

  const status = VERIFICATION[data?.verification_status || 'unverified'] || VERIFICATION.unverified;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display font-semibold text-lg">Company Documents</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Compliance documents for your company. Hauliss reviews every upload; re-upload a document when it expires or is rejected.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-50 text-center space-y-2">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>Retry</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-[#F97316]" />
                <div>
                  <p className="font-medium">Verification status</p>
                  <p className="text-sm text-muted-foreground">{status.hint}</p>
                </div>
              </div>
              <Badge className={status.className}>{status.label}</Badge>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Required documents</h4>
              {requirements.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Hauliss has not published a document list for transport companies yet. You can still upload documents below.
                </p>
              )}
              {requirements.map((r) => {
                const doc = latestByType.get(r.document_type);
                const needsAction = !doc || doc.status === 'rejected' || (doc.status === 'approved' && doc.is_expired);
                return (
                  <div key={r.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{r.name}</p>
                          <Badge variant="outline" className="text-[10px]">{r.is_mandatory ? 'Required' : 'Optional'}</Badge>
                        </div>
                        {r.description && (
                          <p className="text-xs text-muted-foreground">{r.description}{r.regulator ? ` · ${r.regulator}` : ''}</p>
                        )}
                        {doc && <div className="mt-1">{docDetails(doc)}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {badge(doc)}
                        {!target && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant={needsAction ? 'default' : 'outline'}
                              className={`h-7 px-2 text-xs gap-1 ${needsAction ? 'bg-[#F97316] hover:bg-[#F97316]/90 text-white' : ''}`}
                              onClick={() => openUpload(r, doc || null)}
                            >
                              <Upload className="w-3.5 h-3.5" /> {doc ? 'Re-upload' : 'Upload'}
                            </Button>
                            {doc && doc.status !== 'approved' && removeButton(doc)}
                          </div>
                        )}
                      </div>
                    </div>
                    {uploadPanel(r.id)}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Other documents</h4>
                {!target && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-[#F97316] hover:text-[#F97316]" onClick={() => openUpload(null, null)}>
                    <Upload className="w-3.5 h-3.5" /> Upload another document
                  </Button>
                )}
              </div>
              {otherDocs.length === 0 && target?.key !== 'other' && (
                <p className="text-sm text-muted-foreground">
                  Nothing else on file. Use "Upload another document" for anything Hauliss has asked for that is not listed above.
                </p>
              )}
              {otherDocs.map((doc) => (
                <div key={doc.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{doc.document_name || doc.document_type}</p>
                      <div className="mt-1">{docDetails(doc)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {badge(doc)}
                      {!target && (
                        <div className="flex gap-1">
                          {(doc.status === 'rejected' || doc.is_expired) && (
                            <Button size="sm" className="h-7 px-2 text-xs gap-1 bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={() => openUpload(null, doc)}>
                              <Upload className="w-3.5 h-3.5" /> Re-upload
                            </Button>
                          )}
                          {doc.status !== 'approved' && removeButton(doc)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {uploadPanel('other')}
            </div>

            {(data?.kyc_submissions || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Submitted with your application</h4>
                <p className="text-xs text-muted-foreground">
                  Files and details from your transporter application. They cannot be edited here; upload a newer version above if Hauliss asks for one.
                </p>
                {(data?.kyc_submissions || []).map((k, i) => {
                  const url = typeof k.value === 'string' && /^https?:\/\//i.test(k.value) ? k.value : null;
                  return (
                    <div key={`kyc-${i}`} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                      <p className="font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />{k.name || 'KYC item'}</p>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#F97316] hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Open file
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">{String(k.value || '').slice(0, 40)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
