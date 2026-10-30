import { redirect } from 'next/navigation';
import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { DemoControlClient } from '@/app/app/demo/demo-client';

export default async function DemoControlPage() {
  const actor = await requireAuthenticatedPageActor(['admin']);

  if (!actor.organization.is_demo) {
    redirect('/app/dashboard?denied=role');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
          Judge Failure-Injection & Demo Control Center
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Deterministically trigger synthetic custody scenarios in PostgreSQL to verify offline
          replay, wrong-destination blocking, and human-reviewed lab alerts.
        </p>
      </div>

      <DemoControlClient organizationName={actor.organization.name} />
    </div>
  );
}
