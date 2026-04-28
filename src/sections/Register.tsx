import { useEffect, useMemo, useState } from "react";
import {
  Truck,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Upload,
  Loader2,
  Building2,
  ShieldCheck,
  ListChecks,
  FileCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  fetchTransporterKycRequirements,
  submitTransporterSignup,
  uploadKycFile,
  type KycRequirement,
  type KycSubmission,
} from "@/lib/api/onboarding";

type Props = {
  onBackToLogin: () => void;
};

type Step = 1 | 2 | 3 | 4;

type CompanyForm = {
  company_name: string;
  trading_name: string;
  email: string;
  contact_phone: string;
  contact_person_name: string;
  registration_number: string;
  tax_id: string;
  address: string;
  city: string;
  state: string;
};

const EMPTY_COMPANY: CompanyForm = {
  company_name: "",
  trading_name: "",
  email: "",
  contact_phone: "",
  contact_person_name: "",
  registration_number: "",
  tax_id: "",
  address: "",
  city: "Lagos",
  state: "Lagos",
};

export default function Register({ onBackToLogin }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [company, setCompany] = useState<CompanyForm>({ ...EMPTY_COMPANY });
  const [requirements, setRequirements] = useState<KycRequirement[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [reqError, setReqError] = useState("");
  // Map requirement id -> submitted value (URL for files, free-text for numbers/dates)
  const [values, setValues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [done, setDone] = useState<{ application_id: string } | null>(null);

  // Load KYC requirements when entering step 3 (or earlier so user sees count).
  useEffect(() => {
    let mounted = true;
    setLoadingReqs(true);
    setReqError("");
    fetchTransporterKycRequirements()
      .then((rs) => {
        if (!mounted) return;
        setRequirements(rs);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setReqError(e?.message || "Could not load KYC requirements");
      })
      .finally(() => mounted && setLoadingReqs(false));
    return () => {
      mounted = false;
    };
  }, []);

  const requirementsByCategory = useMemo(() => {
    const map = new Map<string, KycRequirement[]>();
    for (const r of requirements) {
      const list = map.get(r.category) || [];
      list.push(r);
      map.set(r.category, list);
    }
    for (const [k, list] of map) {
      list.sort((a, b) =>
        a.sort_order !== b.sort_order
          ? a.sort_order - b.sort_order
          : a.name.localeCompare(b.name)
      );
      map.set(k, list);
    }
    return Array.from(map.entries());
  }, [requirements]);

  const mandatoryCount = useMemo(
    () => requirements.filter((r) => r.is_mandatory).length,
    [requirements]
  );
  const mandatoryFilled = useMemo(
    () =>
      requirements.filter(
        (r) => r.is_mandatory && (values[r.id] || "").trim().length > 0
      ).length,
    [requirements, values]
  );

  const stepOneValid =
    company.company_name.trim().length >= 2 &&
    /^\S+@\S+\.\S+$/.test(company.email);
  const stepTwoValid =
    company.contact_phone.trim().length >= 6 &&
    company.address.trim().length >= 4;
  const stepThreeValid = mandatoryFilled === mandatoryCount;

  function next() {
    if (step === 1 && !stepOneValid) return;
    if (step === 2 && !stepTwoValid) return;
    if (step === 3 && !stepThreeValid) return;
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }
  function prev() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  async function handleFile(req: KycRequirement, file: File) {
    setUploading((u) => ({ ...u, [req.id]: true }));
    try {
      const url = await uploadKycFile(file);
      if (!url) throw new Error("Upload returned no URL");
      setValues((v) => ({ ...v, [req.id]: url }));
    } catch (e: any) {
      setSubmitErr(e?.message || "Upload failed");
    } finally {
      setUploading((u) => ({ ...u, [req.id]: false }));
    }
  }

  async function submit() {
    setSubmitErr("");
    setSubmitting(true);
    try {
      const submissions: KycSubmission[] = requirements
        .filter((r) => (values[r.id] || "").trim().length > 0)
        .map((r) => ({
          requirement_id: r.id,
          name: r.name,
          value: values[r.id]!,
        }));
      const res = await submitTransporterSignup({
        email: company.email.trim(),
        contact_phone: company.contact_phone.trim() || undefined,
        contact_person_name: company.contact_person_name.trim() || undefined,
        company_name: company.company_name.trim(),
        trading_name: company.trading_name.trim() || undefined,
        registration_number: company.registration_number.trim() || undefined,
        tax_id: company.tax_id.trim() || undefined,
        address: company.address.trim() || undefined,
        city: company.city.trim() || undefined,
        state: company.state.trim() || undefined,
        kyc_submissions: submissions,
      });
      setDone({ application_id: res.application_id });
    } catch (e: any) {
      setSubmitErr(e?.message || "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/15 grid place-items-center mb-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white font-display">
            Application submitted
          </h1>
          <p className="text-sm text-white/60 mt-2 max-w-md mx-auto leading-relaxed">
            Thanks for applying to join Hauliss. Our team will review your
            documents and reach out via{" "}
            <span className="text-white">{company.email}</span> within 1–3
            business days.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60">
            <span>Reference</span>
            <span className="text-white font-mono">
              {done.application_id.slice(0, 8)}
            </span>
          </div>
          <div className="mt-8">
            <Button
              onClick={onBackToLogin}
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
            >
              Back to sign in
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell wide>
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <button
          onClick={onBackToLogin}
          className="text-xs text-white/60 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </button>
        <div className="text-[11px] uppercase tracking-wider text-white/40">
          Step {step} of 4
        </div>
      </div>

      {/* Stepper */}
      <Stepper step={step} />

      {/* Body */}
      <div className="mt-8">
        {step === 1 && <StepCompany company={company} setCompany={setCompany} />}
        {step === 2 && (
          <StepOperations company={company} setCompany={setCompany} />
        )}
        {step === 3 && (
          <StepKyc
            loading={loadingReqs}
            error={reqError}
            requirementsByCategory={requirementsByCategory}
            values={values}
            setValues={setValues}
            uploading={uploading}
            onFile={handleFile}
            mandatoryFilled={mandatoryFilled}
            mandatoryCount={mandatoryCount}
          />
        )}
        {step === 4 && (
          <StepReview
            company={company}
            requirements={requirements}
            values={values}
            error={submitErr}
          />
        )}
      </div>

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between gap-3 pt-5 border-t border-white/10">
        {step > 1 ? (
          <Button
            variant="outline"
            onClick={prev}
            className="border-white/15 text-white hover:bg-white/10 bg-transparent"
            disabled={submitting}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        ) : (
          <span />
        )}

        {step < 4 ? (
          <Button
            onClick={next}
            disabled={
              (step === 1 && !stepOneValid) ||
              (step === 2 && !stepTwoValid) ||
              (step === 3 && !stepThreeValid)
            }
            className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
          >
            Continue <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting
              </>
            ) : (
              <>
                Submit application <CheckCircle2 className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </Shell>
  );
}

// -----------------------------------------------------------------------------
// Layout shell — matches the existing Login.tsx visual language.
// -----------------------------------------------------------------------------
function Shell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#000000] via-[#111111] to-[#0a0a0a] p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#F97316]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#F97316]/5 rounded-full blur-3xl" />
      </div>

      <Card
        className={`relative w-full ${
          wide ? "max-w-2xl" : "max-w-md"
        } border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl`}
      >
        <CardContent className="p-7 md:p-9">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-[#F97316] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-[#F97316]/20">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white font-display">
              Become a Hauliss Transporter
            </h1>
            <p className="text-xs text-white/50 mt-1 text-center">
              List your fleet, win loads, get paid faster.
            </p>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items: { n: Step; label: string; icon: typeof Building2 }[] = [
    { n: 1, label: "Company", icon: Building2 },
    { n: 2, label: "Operations", icon: ShieldCheck },
    { n: 3, label: "KYC docs", icon: ListChecks },
    { n: 4, label: "Review", icon: FileCheck },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <div key={it.n} className="flex items-center flex-1">
            <div
              className={`flex items-center gap-2 ${
                active
                  ? "text-white"
                  : done
                  ? "text-emerald-400"
                  : "text-white/40"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold border ${
                  active
                    ? "bg-[#F97316] text-white border-[#F97316] shadow shadow-[#F97316]/30"
                    : done
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                    : "bg-white/5 border-white/15"
                }`}
              >
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : it.n}
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider hidden sm:inline">
                {it.label}
              </span>
            </div>
            {i < items.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 ${
                  done ? "bg-emerald-400/40" : "bg-white/10"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 1: Company basics
// -----------------------------------------------------------------------------
function StepCompany({
  company,
  setCompany,
}: {
  company: CompanyForm;
  setCompany: (u: (c: CompanyForm) => CompanyForm) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-white/70 leading-relaxed">
        Tell us about your transport company. We'll use this to set up your
        portal account.
      </div>
      <Field label="Company name *" hint="As registered with CAC">
        <Input
          value={company.company_name}
          onChange={(e) =>
            setCompany((c) => ({ ...c, company_name: e.target.value }))
          }
          placeholder="e.g. Northbound Logistics Limited"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </Field>
      <Field label="Trading name (optional)">
        <Input
          value={company.trading_name}
          onChange={(e) =>
            setCompany((c) => ({ ...c, trading_name: e.target.value }))
          }
          placeholder="e.g. Northbound"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </Field>
      <Field label="Contact email *" hint="Used to send your portal credentials">
        <Input
          type="email"
          value={company.email}
          onChange={(e) =>
            setCompany((c) => ({ ...c, email: e.target.value }))
          }
          placeholder="ops@yourcompany.ng"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </Field>
      <Field label="Contact person (optional)">
        <Input
          value={company.contact_person_name}
          onChange={(e) =>
            setCompany((c) => ({
              ...c,
              contact_person_name: e.target.value,
            }))
          }
          placeholder="Name of primary contact"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </Field>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 2: Operations & contact
// -----------------------------------------------------------------------------
function StepOperations({
  company,
  setCompany,
}: {
  company: CompanyForm;
  setCompany: (u: (c: CompanyForm) => CompanyForm) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-white/70 leading-relaxed">
        Where do you operate from? This helps us route loads to your fleet.
      </div>
      <Field label="Phone number *">
        <Input
          value={company.contact_phone}
          onChange={(e) =>
            setCompany((c) => ({ ...c, contact_phone: e.target.value }))
          }
          placeholder="+234..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </Field>
      <Field label="Operating address *">
        <Textarea
          value={company.address}
          onChange={(e) =>
            setCompany((c) => ({ ...c, address: e.target.value }))
          }
          rows={2}
          placeholder="Street, area"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <Input
            value={company.city}
            onChange={(e) =>
              setCompany((c) => ({ ...c, city: e.target.value }))
            }
            className="bg-white/5 border-white/10 text-white"
          />
        </Field>
        <Field label="State">
          <Input
            value={company.state}
            onChange={(e) =>
              setCompany((c) => ({ ...c, state: e.target.value }))
            }
            className="bg-white/5 border-white/10 text-white"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CAC RC number (optional)">
          <Input
            value={company.registration_number}
            onChange={(e) =>
              setCompany((c) => ({
                ...c,
                registration_number: e.target.value,
              }))
            }
            placeholder="RC-..."
            className="bg-white/5 border-white/10 text-white"
          />
        </Field>
        <Field label="TIN (optional)">
          <Input
            value={company.tax_id}
            onChange={(e) =>
              setCompany((c) => ({ ...c, tax_id: e.target.value }))
            }
            className="bg-white/5 border-white/10 text-white"
          />
        </Field>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 3: Dynamic KYC
// -----------------------------------------------------------------------------
function StepKyc({
  loading,
  error,
  requirementsByCategory,
  values,
  setValues,
  uploading,
  onFile,
  mandatoryFilled,
  mandatoryCount,
}: {
  loading: boolean;
  error: string;
  requirementsByCategory: Array<[string, KycRequirement[]]>;
  values: Record<string, string>;
  setValues: (u: (v: Record<string, string>) => Record<string, string>) => void;
  uploading: Record<string, boolean>;
  onFile: (r: KycRequirement, f: File) => void;
  mandatoryFilled: number;
  mandatoryCount: number;
}) {
  if (loading) {
    return (
      <div className="text-center text-white/60 py-12">
        <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
        Loading current KYC requirements...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-white/70 leading-relaxed">
          Hauliss verifies every transport company before activation. Upload or
          enter the items below — fields marked{" "}
          <Badge className="bg-amber-500/15 text-amber-300 border-amber-400/20 text-[10px] mx-1">
            Required
          </Badge>{" "}
          are mandatory.
        </div>
        <Badge className="bg-white/5 border-white/10 text-white/80 text-[11px] whitespace-nowrap">
          {mandatoryFilled} / {mandatoryCount} required
        </Badge>
      </div>

      <div className="bg-[#F97316]/10 border border-[#F97316]/20 rounded-lg p-3 flex items-start gap-2 text-xs text-[#FED7AA]">
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          The list below is configured live by Hauliss compliance. Optional
          items improve your verification score and help your fleet match
          higher-value loads.
        </span>
      </div>

      <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1 -mr-1">
        {requirementsByCategory.map(([category, list]) => (
          <div key={category}>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40 mb-2">
              {category}
            </div>
            <div className="space-y-2.5">
              {list.map((r) => (
                <RequirementInput
                  key={r.id}
                  r={r}
                  value={values[r.id] || ""}
                  uploading={!!uploading[r.id]}
                  onValue={(v) => setValues((cur) => ({ ...cur, [r.id]: v }))}
                  onFile={(f) => onFile(r, f)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequirementInput({
  r,
  value,
  uploading,
  onValue,
  onFile,
}: {
  r: KycRequirement;
  value: string;
  uploading: boolean;
  onValue: (v: string) => void;
  onFile: (f: File) => void;
}) {
  const isFile =
    r.doc_type === "document" ||
    r.doc_type === "certificate" ||
    r.doc_type === "photo";

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{r.name}</span>
            {r.is_mandatory ? (
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-400/20 text-[10px]">
                Required
              </Badge>
            ) : (
              <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px]">
                Optional
              </Badge>
            )}
            {r.regulator && (
              <Badge
                variant="outline"
                className="text-[10px] border-white/15 text-white/50"
              >
                {r.regulator}
              </Badge>
            )}
          </div>
          {r.description && (
            <div className="text-[12px] text-white/50 mt-1 leading-relaxed">
              {r.description}
            </div>
          )}
        </div>
        {value && (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        )}
      </div>

      {isFile ? (
        <FileSlot
          value={value}
          uploading={uploading}
          onPick={(f) => onFile(f)}
          onClear={() => onValue("")}
        />
      ) : r.doc_type === "date" ? (
        <Input
          type="date"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          className="bg-white/5 border-white/10 text-white"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder={`Enter ${r.name.toLowerCase()}`}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      )}
    </div>
  );
}

function FileSlot({
  value,
  uploading,
  onPick,
  onClear,
}: {
  value: string;
  uploading: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  if (value) {
    return (
      <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-400/20 rounded-md px-3 py-2 text-xs">
        <span className="text-emerald-300 flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{lastSegment(value)}</span>
        </span>
        <button
          onClick={onClear}
          className="text-white/40 hover:text-white text-[11px] underline ml-3"
        >
          Replace
        </button>
      </div>
    );
  }
  return (
    <label
      className={`flex items-center justify-center gap-2 border border-dashed border-white/15 rounded-md py-3 cursor-pointer hover:border-[#F97316]/50 hover:bg-[#F97316]/5 transition-colors text-xs text-white/60 ${
        uploading ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      {uploading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Upload className="w-4 h-4" />
      )}
      {uploading ? "Uploading..." : "Click to upload (PDF, JPG, PNG)"}
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function lastSegment(url: string) {
  try {
    const u = new URL(url);
    return u.pathname.split("/").pop() || url;
  } catch {
    return url.split("/").pop() || url;
  }
}

// -----------------------------------------------------------------------------
// Step 4: Review & submit
// -----------------------------------------------------------------------------
function StepReview({
  company,
  requirements,
  values,
  error,
}: {
  company: CompanyForm;
  requirements: KycRequirement[];
  values: Record<string, string>;
  error: string;
}) {
  const submitted = requirements.filter(
    (r) => (values[r.id] || "").trim().length > 0
  );
  return (
    <div className="space-y-4">
      <div className="text-sm text-white/70 leading-relaxed">
        Review your details. Click <strong>Submit application</strong> to send
        it to Hauliss Compliance for review.
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <ReviewBlock title="Company">
        <KV k="Company name" v={company.company_name} />
        {company.trading_name && (
          <KV k="Trading name" v={company.trading_name} />
        )}
        <KV k="Email" v={company.email} />
        {company.contact_person_name && (
          <KV k="Contact" v={company.contact_person_name} />
        )}
      </ReviewBlock>

      <ReviewBlock title="Operations">
        <KV k="Phone" v={company.contact_phone} />
        <KV k="Address" v={company.address} />
        <KV k="City / State" v={`${company.city}, ${company.state}`} />
        {company.registration_number && (
          <KV k="CAC RC" v={company.registration_number} />
        )}
        {company.tax_id && <KV k="TIN" v={company.tax_id} />}
      </ReviewBlock>

      <ReviewBlock title={`KYC submissions (${submitted.length})`}>
        {submitted.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between text-xs py-1"
          >
            <span className="text-white/70 truncate">
              {r.name}
              {r.is_mandatory && (
                <Badge className="ml-2 bg-amber-500/15 text-amber-300 border-amber-400/20 text-[9px]">
                  Required
                </Badge>
              )}
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-3" />
          </div>
        ))}
      </ReviewBlock>
    </div>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-white/50 shrink-0">{k}</span>
      <span className="text-white text-right break-words">{v}</span>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs text-white/60 uppercase tracking-wide">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <div className="text-[11px] text-white/40 mt-1">{hint}</div>}
    </div>
  );
}
