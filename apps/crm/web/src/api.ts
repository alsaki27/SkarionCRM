// apps/crm/web/src/api.ts
// Access token kept in memory only (never localStorage - it's a 15-minute
// JWT and localStorage is readable by any script on the page, which turns
// one XSS bug into a stolen-session bug). Refreshed via identity's httpOnly
// refresh-token cookie, scoped to the identity domain - this app never
// reads that cookie directly, it just calls identity's /auth/refresh with
// credentials included and the browser attaches the cookie automatically.
// Mirrors apps/identity/admin/src/api.ts and apps/identity/login's pattern.

// VITE_API_URL is already configured as a Cloudflare Pages env var for this
// project (set when the Worker was first deployed) - reusing that name
// rather than introducing a new, unconfigured one. Identity's URL is
// hardcoded rather than env-configured since it's the same constant
// auth.skarion.com referenced by every app in this monorepo.
const CRM_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8788';
const IDENTITY_API_URL = 'https://auth.skarion.com';

let accessToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const response = await fetch(`${IDENTITY_API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token: string };
  accessToken = data.access_token;
  return accessToken;
}

/** Redirects to the public login app, returning here after a successful login. */
export function redirectToLogin(): void {
  const returnTo = encodeURIComponent(window.location.href);
  window.location.href = `${IDENTITY_API_URL}/?return_to=${returnTo}`;
}

export async function crmFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!accessToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      redirectToLogin();
      throw new ApiError('No session.', 401);
    }
  }

  let response = await fetch(`${CRM_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      redirectToLogin();
      throw new ApiError('Session expired.', 401);
    }
    response = await fetch(`${CRM_API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(body.error ?? 'Request failed', response.status);
  }
  return response.json() as Promise<T>;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  address: unknown;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  title: string | null;
  companyId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'disqualified' | 'converted';
export type LeadSource = 'website' | 'referral' | 'social_media' | 'cold_call' | 'email_campaign' | 'event' | 'other';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  companyDomain: string | null;
  source: LeadSource;
  status: LeadStatus;
  notes: string | null;
  ownerId: string;
  convertedToContactId: string | null;
  convertedToCompanyId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type OpportunityStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'AED' | 'SAR';

export interface Opportunity {
  id: string;
  name: string;
  companyId: string | null;
  contactId: string | null;
  stage: OpportunityStage;
  amount: string | null;
  currency: Currency;
  expectedCloseDate: string | null;
  probability: number | null;
  notes: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'note';

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  content: string | null;
  contactId: string | null;
  companyId: string | null;
  opportunityId: string | null;
  actorId: string;
  happenedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  assigneeId: string;
  contactId: string | null;
  companyId: string | null;
  opportunityId: string | null;
  completedAt: string | null;
  completedBy: string | null;
  priority: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function listCompanies() {
  return crmFetch<{ companies: Company[] }>('/api/companies');
}
