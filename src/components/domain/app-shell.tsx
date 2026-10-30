'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  QrCode,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  TestTubes,
  Truck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { clearOfflineSessionStorage, getUnsyncedEventCount } from '@/lib/offline/db';
import { useNetworkAndOfflineQueue } from '@/lib/offline/hooks';
import { Button, Dialog, DialogContent } from '@/components/ui/primitives';
import { DemoDatasetBanner, RoleBadge } from '@/components/domain/badges';
import { cn } from '@/lib/utils';
import type { Facility, Membership, MembershipRole, Organization } from '@/types/domain';

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  Icon: typeof LayoutDashboard;
  roles: readonly MembershipRole[];
  mobilePrimary?: boolean;
  demoOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/app/dashboard',
    label: 'Operations Overview',
    shortLabel: 'Overview',
    Icon: LayoutDashboard,
    roles: ['collector', 'courier', 'lab', 'admin'],
    mobilePrimary: true,
  },
  {
    href: '/app/samples',
    label: 'Specimen Registry',
    shortLabel: 'Samples',
    Icon: TestTubes,
    roles: ['collector', 'courier', 'lab', 'admin'],
    mobilePrimary: true,
  },
  {
    href: '/app/samples/new',
    label: 'Register Sample',
    shortLabel: 'New',
    Icon: PlusCircle,
    roles: ['collector', 'admin'],
  },
  {
    href: '/app/scan',
    label: 'Scan Opaque QR',
    shortLabel: 'Scan',
    Icon: QrCode,
    roles: ['collector', 'courier', 'lab', 'admin'],
    mobilePrimary: true,
  },
  {
    href: '/app/handovers',
    label: 'Courier Handovers',
    shortLabel: 'Queue',
    Icon: Truck,
    roles: ['courier', 'collector', 'admin'],
    mobilePrimary: true,
  },
  {
    href: '/app/lab',
    label: 'Receiving Lab Desk',
    shortLabel: 'Lab Desk',
    Icon: FlaskConical,
    roles: ['lab', 'admin'],
    mobilePrimary: true,
  },
  {
    href: '/app/exceptions',
    label: 'Exception Inbox',
    shortLabel: 'Alerts',
    Icon: AlertTriangle,
    roles: ['collector', 'lab', 'admin'],
    mobilePrimary: true,
  },
  {
    href: '/app/analytics',
    label: 'Verified Analytics',
    shortLabel: 'Metrics',
    Icon: BarChart3,
    roles: ['lab', 'admin'],
  },
  {
    href: '/app/settings',
    label: 'Policies & Facilities',
    shortLabel: 'Settings',
    Icon: Settings,
    roles: ['admin'],
  },
  {
    href: '/app/demo',
    label: 'Judge Failure Sim',
    shortLabel: 'Demo Sim',
    Icon: Sparkles,
    roles: ['admin'],
    demoOnly: true,
  },
];

export function AppShell({
  membership,
  organization,
  facility,
  children,
}: {
  membership: Membership;
  organization: Organization;
  facility: Facility | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [unsyncedOnLogout, setUnsyncedOnLogout] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  const {
    effectiveOnline,
    simulatedOffline,
    setSimulatedOffline,
    pendingOnDeviceCount,
    conflictCount,
    isSyncingNow,
    triggerSync,
  } = useNetworkAndOfflineQueue({
    organizationId: organization.id,
    actorUserId: membership.user_id,
    isDemoOrg: organization.is_demo,
    onSynced: () => {
      router.refresh();
    },
  });

  // Register static-shell service worker safely
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
        // Non-blocking if browser restricts SW registration
      });
    }
  }, []);

  const visibleNav = NAV_ITEMS.filter(
    (item) =>
      item.roles.includes(membership.role) && (!item.demoOnly || organization.is_demo)
  );

  const mobileTabs = visibleNav.filter((item) => item.mobilePrimary).slice(0, 5);

  const initiateSignOut = async () => {
    const pendingCount = await getUnsyncedEventCount(organization.id, membership.user_id);
    if (pendingCount > 0) {
      setUnsyncedOnLogout(pendingCount);
      setLogoutDialogOpen(true);
      return;
    }
    await executeSignOut(false);
  };

  const executeSignOut = async (discardUnsynced: boolean) => {
    setSigningOut(true);
    try {
      await clearOfflineSessionStorage({
        organizationId: organization.id,
        actorUserId: membership.user_id,
        discardUnsynced,
      });
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
      setLogoutDialogOpen(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#F7FAFC] text-[#142437]">
      <DemoDatasetBanner isDemo={organization.is_demo} />

      {/* Persistent Connectivity & Offline Sync Status Header */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/app/dashboard"
              className="flex items-center gap-2.5 font-bold tracking-tight text-[#142437]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#142437] text-[#5EEAD4]">
                <Shield className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="leading-tight">
                <span className="block text-base">SampleShield</span>
                <span className="block text-[11px] font-medium text-slate-500">
                  {organization.name}
                </span>
              </div>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live Connectivity Pill */}
            <div
              data-testid="connectivity-indicator"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                effectiveOnline
                  ? 'border-[#0E9488]/30 bg-[#E5F7F3] text-[#0B5D56]'
                  : 'border-dashed border-2 border-[#D97706] bg-amber-50 text-[#78350F]'
              )}
            >
              {effectiveOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Online · Server connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {simulatedOffline ? 'No-Network Mode (Demo)' : 'Offline · Queueing on device'}
                  </span>
                </>
              )}
            </div>

            {/* Demo Offline Toggle for Judge Presentation */}
            {organization.is_demo ? (
              <button
                type="button"
                data-testid="toggle-demo-offline"
                onClick={() => setSimulatedOffline(!simulatedOffline)}
                className={cn(
                  'hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                  simulatedOffline
                    ? 'border-[#0E9488] bg-[#0E9488] text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                {simulatedOffline ? 'Reconnect Network' : 'Simulate Offline'}
              </button>
            ) : null}

            {/* Pending Device Sync Counter + Explicit Retry */}
            {pendingOnDeviceCount > 0 || conflictCount > 0 ? (
              <div className="inline-flex items-center gap-1.5">
                <Link
                  href="/app/handovers"
                  data-testid="pending-sync-pill"
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                    conflictCount > 0
                      ? 'bg-[#FDF1F0] text-[#8A1F1C] border border-[#D85A56]'
                      : 'bg-amber-100 text-[#78350F] border border-amber-300'
                  )}
                >
                  <span>
                    {conflictCount > 0
                      ? `${conflictCount} Needs review`
                      : `${pendingOnDeviceCount} Pending on device`}
                  </span>
                </Link>
                {pendingOnDeviceCount > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void triggerSync(true)}
                    disabled={isSyncingNow || !effectiveOnline}
                    aria-label="Retry synchronization now"
                    data-testid="header-retry-sync"
                  >
                    <RefreshCw
                      className={cn('h-3.5 w-3.5', isSyncingNow && 'animate-spin')}
                      aria-hidden="true"
                    />
                    <span className="hidden md:inline">Retry sync</span>
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right leading-tight">
                <p className="text-xs font-semibold text-[#142437]">{membership.display_name}</p>
                <p className="text-[11px] text-slate-500">
                  {facility ? `${facility.code}` : 'All Facilities'}
                </p>
              </div>
              <RoleBadge role={membership.role} />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => void initiateSignOut()}
              aria-label="Sign out"
              data-testid="sign-out-button"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        {/* Desktop Collapsible Navigation Sidebar */}
        <aside
          aria-label="Primary navigation"
          className={cn(
            'no-print hidden md:flex flex-col border-r border-slate-200/80 bg-white transition-all duration-200 shrink-0',
            collapsed ? 'w-[76px]' : 'w-64'
          )}
        >
          <div className="flex-1 py-4 px-3 space-y-1">
            {visibleNav.map(({ href, label, Icon }) => {
              const active =
                pathname === href ||
                (href !== '/app/samples' && pathname.startsWith(`${href}/`)) ||
                (href === '/app/samples' &&
                  pathname.startsWith('/app/samples/') &&
                  pathname !== '/app/samples/new');

              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-[#E5F7F3] text-[#0B5D56]'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-[#142437]'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      active ? 'text-[#0E9488]' : 'text-slate-500'
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed ? <span className="truncate">{label}</span> : null}
                </Link>
              );
            })}
          </div>

          <div className="border-t border-slate-200 p-3 space-y-3">
            {!collapsed ? (
              <div className="rounded-xl bg-[#F7FAFC] p-3 border border-slate-200/80">
                <p className="text-xs font-semibold text-[#142437] truncate">
                  {membership.display_name}
                </p>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">
                  {facility ? `${facility.name}` : 'Network-wide role'}
                </p>
                <div className="mt-2">
                  <RoleBadge role={membership.role} />
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-[#142437] cursor-pointer"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span>Collapse rail</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8 pb-24 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Thumb-Friendly Bottom Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 py-1.5"
      >
        <div className="grid grid-cols-5 gap-1">
          {mobileTabs.map(({ href, shortLabel, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center min-h-12 rounded-xl px-1 py-1 text-[11px] font-semibold transition-colors',
                  active ? 'bg-[#E5F7F3] text-[#0B5D56]' : 'text-slate-600'
                )}
              >
                <Icon
                  className={cn('h-5 w-5 mb-0.5', active ? 'text-[#0E9488]' : 'text-slate-500')}
                  aria-hidden="true"
                />
                <span className="truncate max-w-full">{shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Unsynced Offline Events Sign-Out Guard Dialog */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent
          title="Unsynced custody events on this device"
          description={`You have ${unsyncedOnLogout} custody event(s) saved locally that have not yet been confirmed by the server.`}
        >
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-[#78350F] space-y-1.5">
            <p className="font-semibold">
              Signing out clears cached courier assignments for privacy.
            </p>
            <p>
              We recommend reconnecting and clicking <strong>Retry sync</strong> before signing out
              so no handover record is lost.
            </p>
          </div>

          <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
            <Button
              variant="outline"
              onClick={() => setLogoutDialogOpen(false)}
              disabled={signingOut}
            >
              Stay signed in & sync
            </Button>
            <Button
              variant="danger"
              onClick={() => void executeSignOut(true)}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Discard unsynced & sign out'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
