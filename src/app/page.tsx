import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  FlaskConical,
  QrCode,
  Shield,
  ShieldCheck,
  Truck,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F7FAFC] text-[#142437]">
      {/* Top Safety & Prototype Ribbon */}
      <div className="bg-[#142437] text-slate-200 px-4 py-2 text-xs">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono font-semibold text-[#5EEAD4]">
            OPERATIONAL CHAIN-OF-CUSTODY PROTOTYPE · SYNTHETIC DATA ONLY
          </span>
          <span className="text-slate-300">
            Not a diagnostic medical device · Laboratory staff retain final disposition authority
          </span>
        </div>
      </div>

      {/* Navigation */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#142437] text-[#5EEAD4]">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <span className="font-bold text-lg tracking-tight text-[#142437]">SampleShield</span>
              <span className="hidden sm:inline-block ml-2 rounded-md bg-[#E5F7F3] px-2 py-0.5 text-[11px] font-semibold text-[#0B5D56]">
                PWA · Offline-First
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70] transition-colors"
            >
              <span>Sign in to Operations Desk</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Editorial Hero + Live Component Product Mockup */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 lg:py-20">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0E9488]/30 bg-[#E5F7F3] px-3.5 py-1.5 text-xs font-semibold text-[#0B5D56]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>Clinic-to-Laboratory Specimen Accountability</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-[#142437] leading-[1.12]">
                Every sample has a journey.{' '}
                <span className="text-[#0E9488]">Every handoff should be accountable.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Diagnostic specimens collected at rural clinics change hands multiple times before
                reaching a receiving laboratory. SampleShield replaces paper blind spots with an{' '}
                <strong className="font-semibold text-[#142437]">opaque QR Sample Passport</strong>,{' '}
                <strong className="font-semibold text-[#142437]">offline-queued courier handovers</strong>,
                and a <strong className="font-semibold text-[#142437]">human-reviewed lab exception inbox</strong>.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0E9488] px-6 py-3 text-base font-semibold text-white shadow-xs hover:bg-[#0B7A70] transition-colors"
                >
                  <span>Launch Interactive Demo</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-[#142437] hover:bg-slate-50 transition-colors"
                >
                  How Custody Works
                </a>
              </div>

              <dl className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    QR Privacy
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-[#142437]">Zero PHI in Code</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Sync Guarantee
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-[#142437]">Idempotent UUIDs</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Lab Authority
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-[#142437]">100% Human Review</dd>
                </div>
              </dl>
            </div>

            {/* HTML/CSS Sample Passport Architectural Mockup (Synthetic Preview) */}
            <div className="lg:col-span-6">
              <div
                aria-label="Interactive illustration of SampleShield Sample Passport"
                className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_12px_36px_rgba(20,36,55,0.08)] space-y-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
                  <div>
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                      SYNTHETIC SAMPLE PASSPORT PREVIEW
                    </span>
                    <p className="font-mono text-lg font-bold text-[#142437] mt-0.5">
                      SS-3H8W-5T6J-C4ZP
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5F7F3] border border-[#0E9488]/30 px-3 py-1 text-xs font-semibold text-[#0B5D56]">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    RLS Scoped
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-[#F7FAFC] border border-slate-200/80 p-3">
                    <span className="text-slate-500 font-medium">Origin Clinic</span>
                    <p className="font-semibold text-[#142437] mt-0.5">
                      Kishangarh PHC (PHC-KISH)
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F7FAFC] border border-slate-200/80 p-3">
                    <span className="text-slate-500 font-medium">Authorized Destination</span>
                    <p className="font-semibold text-[#142437] mt-0.5">
                      District Reference Lab (LAB-AJMR)
                    </p>
                  </div>
                </div>

                {/* Truthful Offline vs Confirmed Comparison */}
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-200 bg-[#F7FAFC]/60 p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#183B56] text-white">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-[#142437]">
                          Dispatched from Clinic · Asha Verma
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          Server receipt: 09:14:22 · Assigned: Ravi Meena
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#E5F7F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#0B5D56]">
                      Confirmed
                    </span>
                  </div>

                  <div className="rounded-xl border-2 border-dashed border-[#D97706] bg-amber-50/80 p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-[#78350F]">
                        <CloudOff className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-[#78350F]">
                          Courier Custody Pickup · Ravi Meena
                        </p>
                        <p className="text-[11px] font-mono text-[#92400E]">
                          Device queued: 09:21:05 · Will replay idempotently on signal
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#D97706] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#78350F]">
                      Pending on device
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#E8A23C]/60 bg-[#FEF6E7] p-3 flex items-start gap-2.5">
                    <AlertTriangle
                      className="h-4 w-4 text-[#92400E] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="text-xs text-[#78350F]">
                      <p className="font-bold">
                        Operational Exception Guard · Human Review Required
                      </p>
                      <p className="mt-0.5 text-[11px]">
                        Wrong-destination scans are blocked automatically; delayed arrivals alert the
                        receiving bench without auto-rejecting specimens.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Step Workflow Section */}
        <section id="how-it-works" className="border-t border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0E9488]">
                Three-Stage Accountability Loop
              </p>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-[#142437]">
                Built for rural connectivity realities and strict clinical boundaries
              </h2>
            </div>

            <div className="mt-10 grid md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-[#F7FAFC] p-6 space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E5F7F3] text-[#0E9488]">
                  <QrCode className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-[#142437]">
                  1. Register & Label with Opaque QR
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Clinic collectors register specimen type, source clinic, and authorized receiving
                  laboratory. The printable QR encodes only a random code—never patient names,
                  diagnoses, or phone numbers.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-[#F7FAFC] p-6 space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FEF6E7] text-[#92400E]">
                  <Truck className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-[#142437]">
                  2. Record Handovers Offline Safely
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Assigned couriers capture custody pickups in low-signal zones. Events remain
                  truthfully badged <em>Pending on this device</em> until confirmed atomically once
                  by PostgreSQL using idempotent event UUIDs.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-[#F7FAFC] p-6 space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#183B56]/10 text-[#183B56]">
                  <FlaskConical className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-[#142437]">
                  3. Lab Exception Review & Disposition
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Destination mismatches, handover gaps, and operational SLA delays surface in the
                  Lab Inbox. Authorized laboratory staff inspect the specimen and record documented
                  acceptance or rejection.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-[#F7FAFC] py-6 px-4 sm:px-6 text-xs text-slate-600">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p>
            <strong>SampleShield</strong> · Operational specimen chain-of-custody prototype.
          </p>
          <p>
            Safety boundary: Not a clinical diagnostic system or LIS replacement. All demonstration
            records are fictional.
          </p>
        </div>
      </footer>
    </div>
  );
}
