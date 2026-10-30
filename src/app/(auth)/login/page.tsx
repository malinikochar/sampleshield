'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, Shield, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, FieldLabel, Input } from '@/components/ui/primitives';

interface DemoPersona {
  label: string;
  roleTitle: string;
  facilityNote: string;
  email: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    label: 'Asha Verma',
    roleTitle: 'Clinic Collector',
    facilityNote: 'Kishangarh PHC (Create, Collect & Dispatch)',
    email: 'asha.collector@sahyog-demo.example',
  },
  {
    label: 'Ravi Meena',
    roleTitle: 'Route Courier',
    facilityNote: 'Assigned Transit & Offline Queue',
    email: 'ravi.courier@sahyog-demo.example',
  },
  {
    label: 'Dr. Priya Sharma',
    roleTitle: 'Receiving Lab Staff',
    facilityNote: 'Ajmer Reference Lab (Receive & Accept/Reject)',
    email: 'priya.lab@sahyog-demo.example',
  },
  {
    label: 'Kabir Joshi',
    roleTitle: 'Secondary Lab (Mismatch Test)',
    facilityNote: 'Jaipur Hub (Triggers Wrong-Destination Guard)',
    email: 'kabir.jaipur@sahyog-demo.example',
  },
  {
    label: 'Meera Nair',
    roleTitle: 'Operations Admin',
    facilityNote: 'Policies, Analytics & Judge Failure Sim',
    email: 'meera.admin@sahyog-demo.example',
  },
];

const DEMO_DEFAULT_PASSWORD = 'SampleShieldDemo!2026';

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const reason = searchParams.get('reason');

  const [email, setEmail] = useState('asha.collector@sahyog-demo.example');
  const [password, setPassword] = useState(DEMO_DEFAULT_PASSWORD);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    reason === 'no_active_membership'
      ? 'Your account does not have an active facility or organization membership. Contact your organization administrator.'
      : reason === 'auth_callback_failed'
      ? 'Authentication callback expired or could not be verified. Please sign in again.'
      : null
  );

  const signInWithCredentials = async (targetEmail: string, targetPassword: string) => {
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: targetEmail.trim(),
        password: targetPassword,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const destination =
        nextPath && nextPath.startsWith('/app') ? nextPath : '/app/dashboard';
      router.push(destination);
      router.refresh();
    } catch {
      setErrorMsg('Unable to reach authentication service. Verify network connectivity.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithCredentials(email, password);
  };

  return (
    <div className="mx-auto max-w-5xl w-full grid lg:grid-cols-12 gap-8 items-start">
      {/* Left: Sign-In Form */}
      <Card className="lg:col-span-6 p-6 sm:p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#142437] text-[#5EEAD4]">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#142437]">Sign in to SampleShield</h1>
            <p className="text-xs text-slate-600">
              Organization-scoped specimen accountability workspace
            </p>
          </div>
        </div>

        {errorMsg ? (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#D85A56]/60 bg-[#FDF1F0] p-3.5 text-xs font-medium text-[#8A1F1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="email" required>
              Authorized Staff Email
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <FieldLabel htmlFor="password" required>
              Password
            </FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            disabled={submitting}
            data-testid="login-submit"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>{submitting ? 'Verifying session & membership…' : 'Sign In Securely'}</span>
          </Button>
        </form>

        <p className="mt-5 text-xs text-slate-500 leading-relaxed">
          Offline note: First sign-in requires network connectivity so Supabase Auth & RLS can
          verify your active organization role and facility assignment.
        </p>
      </Card>

      {/* Right: Seeded Synthetic Demo Accounts for Judge Walkthrough */}
      <Card className="lg:col-span-6 p-6 sm:p-7 bg-white border-slate-200">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5F7F3] px-2.5 py-1 text-xs font-semibold text-[#0B5D56]">
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Sahyog Rural Health Network
          </span>
          <span className="font-mono text-[11px] font-semibold text-slate-500">
            SYNTHETIC DEMO TENANT
          </span>
        </div>

        <h2 className="text-base font-bold text-[#142437]">
          One-Tap Judge Role Switcher (Real Supabase Auth)
        </h2>
        <p className="text-xs text-slate-600 mt-1 mb-4">
          Each button signs in as a real seeded Supabase user governed by PostgreSQL Row Level
          Security—no mocked client-side role flags.
        </p>

        <div className="space-y-2.5">
          {DEMO_PERSONAS.map((persona) => {
            const selected = email === persona.email;
            return (
              <button
                key={persona.email}
                type="button"
                disabled={submitting}
                data-testid={`demo-persona-${persona.email.split('.')[0]}`}
                onClick={() => {
                  setEmail(persona.email);
                  setPassword(DEMO_DEFAULT_PASSWORD);
                  void signInWithCredentials(persona.email, DEMO_DEFAULT_PASSWORD);
                }}
                className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  selected
                    ? 'border-[#0E9488] bg-[#E5F7F3]/50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#142437]">{persona.label}</span>
                    <span className="rounded bg-[#183B56]/10 px-2 py-0.5 text-[11px] font-semibold text-[#183B56]">
                      {persona.roleTitle}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{persona.facilityNote}</p>
                  <p className="font-mono text-[11px] text-slate-500 mt-0.5">{persona.email}</p>
                </div>
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${
                    selected ? 'text-[#0E9488]' : 'text-slate-300'
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F7FAFC] text-[#142437]">
      <div className="bg-[#142437] text-slate-200 px-4 py-1.5 text-xs text-center font-mono">
        DEMO DATA — NOT REAL PATIENT RECORDS · SUPABASE AUTH + RLS ENFORCED
      </div>

      <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#142437]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to SampleShield overview</span>
        </Link>
      </div>

      <main className="flex-1 flex items-center px-4 sm:px-6 py-8">
        <Suspense
          fallback={
            <div className="mx-auto max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading authentication workspace…
            </div>
          }
        >
          <LoginFormInner />
        </Suspense>
      </main>
    </div>
  );
}
