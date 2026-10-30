import { requireAuthenticatedPageActor } from '@/lib/auth/session';
import { AppShell } from '@/components/domain/app-shell';

export const dynamic = 'force-dynamic';

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireAuthenticatedPageActor();

  return (
    <AppShell
      membership={actor.membership}
      organization={actor.organization}
      facility={actor.facility}
    >
      {children}
    </AppShell>
  );
}
