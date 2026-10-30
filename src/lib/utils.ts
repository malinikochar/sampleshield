import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SampleEventType } from '@/types/domain';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRelativeMinutes(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hrs = Math.floor(diffMin / 60);
  const rem = diffMin % 60;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

export const EVENT_TYPE_LABELS: Record<SampleEventType, string> = {
  sample_created: 'Sample Passport Registered',
  sample_collected: 'Specimen Collected & Sealed',
  sample_dispatched: 'Dispatched from Clinic',
  courier_pickup: 'Courier Custody Pickup',
  courier_dropoff: 'Courier Laboratory Drop-off',
  lab_received: 'Received at Laboratory Intake',
  lab_accepted: 'Accepted by Laboratory Staff',
  lab_rejected: 'Rejected by Laboratory Staff',
  admin_correction: 'Administrative Audit Note',
};
