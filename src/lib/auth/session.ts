import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Facility, Membership, MembershipRole, Organization } from '@/types/domain';

export interface AuthenticatedActorContext {
  userId: string;
  email: string;
  membership: Membership;
  organization: Organization;
  facility: Facility | null;
}

/**
 * Fetches verified session claims AND active organization membership from Supabase.
 * Session presence alone is insufficient — active membership is mandatory.
 */
export async function getAuthenticatedActor(): Promise<AuthenticatedActorContext | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return null;
  }

  const userId = claimsData.claims.sub;
  const userEmail =
    typeof claimsData.claims.email === 'string' ? claimsData.claims.email : '';

  const { data: membershipRow, error: membershipError } = await supabase
    .from('memberships')
    .select(
      `
      id,
      organization_id,
      user_id,
      display_name,
      email,
      facility_id,
      role,
      is_active,
      created_at,
      organization:organizations!memberships_organization_id_fkey (
        id,
        name,
        slug,
        is_demo,
        created_at
      ),
      facility:facilities!memberships_facility_org_fkey (
        id,
        organization_id,
        name,
        code,
        facility_type,
        location_label,
        is_active,
        created_at
      )
    `
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membershipRow) {
    return null;
  }

  const rawOrg = Array.isArray(membershipRow.organization)
    ? membershipRow.organization[0]
    : membershipRow.organization;
  const rawFacility = Array.isArray(membershipRow.facility)
    ? membershipRow.facility[0]
    : membershipRow.facility;

  if (!rawOrg) {
    return null;
  }

  const organization: Organization = {
    id: rawOrg.id,
    name: rawOrg.name,
    slug: rawOrg.slug,
    is_demo: Boolean(rawOrg.is_demo),
    created_at: rawOrg.created_at,
  };

  const facility: Facility | null = rawFacility
    ? {
        id: rawFacility.id,
        organization_id: rawFacility.organization_id,
        name: rawFacility.name,
        code: rawFacility.code,
        facility_type: rawFacility.facility_type,
        location_label: rawFacility.location_label,
        is_active: Boolean(rawFacility.is_active),
        created_at: rawFacility.created_at,
      }
    : null;

  const membership: Membership = {
    id: membershipRow.id,
    organization_id: membershipRow.organization_id,
    user_id: membershipRow.user_id,
    display_name: membershipRow.display_name,
    email: membershipRow.email || userEmail,
    facility_id: membershipRow.facility_id,
    role: membershipRow.role as MembershipRole,
    is_active: Boolean(membershipRow.is_active),
    created_at: membershipRow.created_at,
    organization,
    facility,
  };

  return {
    userId,
    email: membership.email,
    membership,
    organization,
    facility,
  };
}

/**
 * Enforces authenticated user + active organization membership for Server Components.
 * Distinguishes unauthenticated users (redirect to /login) from accounts without active membership.
 */
export async function requireAuthenticatedPageActor(
  allowedRoles?: readonly MembershipRole[]
): Promise<AuthenticatedActorContext> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect('/login');
  }

  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect('/login?reason=no_active_membership');
  }

  if (allowedRoles && !allowedRoles.includes(actor.membership.role)) {
    redirect('/app/dashboard?denied=role');
  }

  return actor;
}
