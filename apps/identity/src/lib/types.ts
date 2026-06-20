export type AppName = 'crm' | 'hr' | 'books';

/** Maps each app the user has an active membership in to their role in that app. */
export type AppMembershipsMap = Partial<Record<AppName, string>>;

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  MFA_ENCRYPTION_KEY: string;
  INVITATION_TOKEN_PEPPER: string;
  APP_URL: string;
}
