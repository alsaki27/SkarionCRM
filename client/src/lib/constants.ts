export const APP_NAME = 'Skarion CRM';
export const APP_VERSION = '2.0.0';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const;

export const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
] as const;

export const BUSINESS_TYPES = [
  'llc',
  'corporation',
  'sole_proprietorship',
  'partnership',
  'nonprofit',
  's_corporation',
  'other',
] as const;

export const FISCAL_YEAR_ENDS = [
  '12-31',
  '03-31',
  '06-30',
  '09-30',
] as const;

export const PAY_FREQUENCIES = [
  'hourly',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'annually',
] as const;

export const PAY_TYPES = [
  'salary',
  'hourly',
  'commission',
  'piece_rate',
] as const;

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contractor',
  'intern',
] as const;

export const CONTACT_TYPES = [
  'client',
  'vendor',
  'employee',
  'contractor',
  'prospect',
  'partner',
] as const;

export const TAX_FORM_TYPES = [
  'w2',
  'w2c',
  '1099_nec',
  '1099_misc',
  '940',
  '941',
  '944',
  '1040',
  '1120',
  '1065',
  '990',
  'other',
] as const;
