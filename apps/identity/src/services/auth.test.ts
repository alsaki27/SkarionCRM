import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginStep1, loginStep2, authenticateSuperadmin, AuthError } from './auth.js';
import { verifyPassword } from '../lib/password.js';
import {
  generateNumericCode,
  generateOpaqueToken,
  sha256Hex,
  signAccessToken,
} from '../lib/tokens.js';

vi.mock('../lib/password.js');
vi.mock('../lib/tokens.js');

function mockDb() {
  return {
    query: {
      users: { findFirst: vi.fn() },
      loginOtpCodes: { findFirst: vi.fn() },
    },
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    select: vi
      .fn()
      .mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('loginStep1', () => {
  it('throws 401 on wrong password', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'hash',
      disabledAt: null,
    });
    await expect(loginStep1(db, { email: 'a@b.com', password: 'wrong' })).rejects.toThrow(
      AuthError
    );
  });

  it('throws 401 on disabled account', async () => {
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'hash',
      disabledAt: new Date(),
    });
    await expect(loginStep1(db, { email: 'a@b.com', password: 'x' })).rejects.toThrow(
      'Invalid email or password.'
    );
  });

  it('throws 401 on user not found', async () => {
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue(undefined);
    await expect(loginStep1(db, { email: 'a@b.com', password: 'x' })).rejects.toThrow(
      'Invalid email or password.'
    );
  });

  it('throws 401 on missing passwordHash', async () => {
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: null,
      disabledAt: null,
    });
    await expect(loginStep1(db, { email: 'a@b.com', password: 'x' })).rejects.toThrow(
      'Invalid email or password.'
    );
  });

  it('returns pendingToken and code on success', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(generateOpaqueToken).mockReturnValue('mock-pending-token');
    vi.mocked(generateNumericCode).mockReturnValue('123456');
    vi.mocked(sha256Hex).mockResolvedValue('mock-hash');
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'hash',
      disabledAt: null,
    });
    const result = await loginStep1(db, { email: 'a@b.com', password: 'x' });
    expect(result.pendingToken).toBe('mock-pending-token');
    expect(result.code).toBe('123456');
    expect(result.expiresAt).toBeInstanceOf(Date);
  });
});

describe('loginStep2', () => {
  beforeEach(() => {
    vi.mocked(signAccessToken).mockResolvedValue('mock-access-token');
    vi.mocked(generateOpaqueToken).mockReturnValue('mock-refresh');
    vi.mocked(sha256Hex).mockImplementation(async (input: string) => {
      return `hash(${input})`;
    });
  });

  function setupValidOtp(db: ReturnType<typeof mockDb>) {
    db.query.loginOtpCodes.findFirst.mockResolvedValue({
      id: 'otp1',
      userId: 'u1',
      codeHash: 'hash(123456)',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      attemptCount: 0,
    });
  }

  function setupFullSession(db: ReturnType<typeof mockDb>) {
    setupValidOtp(db);
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      displayName: 'Test User',
      isSuperadmin: false,
      tokenVersion: 1,
      disabledAt: null,
    });
  }

  it('throws 401 on wrong code', async () => {
    const db = mockDb();
    setupValidOtp(db);
    await expect(
      loginStep2(db, { pendingToken: 'pending-tok', code: 'wrong', jwtSecret: 's' })
    ).rejects.toThrow('Incorrect code.');
  });

  it('throws 401 on expired code', async () => {
    const db = mockDb();
    db.query.loginOtpCodes.findFirst.mockResolvedValue({
      id: 'otp1',
      userId: 'u1',
      codeHash: 'hash(123456)',
      consumedAt: null,
      expiresAt: new Date(Date.now() - 60000),
      attemptCount: 0,
    });
    await expect(
      loginStep2(db, { pendingToken: 'pending-tok', code: '123456', jwtSecret: 's' })
    ).rejects.toThrow('expired');
  });

  it('throws 401 on already consumed code', async () => {
    const db = mockDb();
    db.query.loginOtpCodes.findFirst.mockResolvedValue({
      id: 'otp1',
      userId: 'u1',
      codeHash: 'hash(123456)',
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      attemptCount: 0,
    });
    await expect(
      loginStep2(db, { pendingToken: 'pending-tok', code: '123456', jwtSecret: 's' })
    ).rejects.toThrow('expired');
  });

  it('throws 429 on too many attempts', async () => {
    const db = mockDb();
    db.query.loginOtpCodes.findFirst.mockResolvedValue({
      id: 'otp1',
      userId: 'u1',
      codeHash: 'hash(123456)',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      attemptCount: 5,
    });
    await expect(
      loginStep2(db, { pendingToken: 'pending-tok', code: '123456', jwtSecret: 's' })
    ).rejects.toThrow('Too many incorrect code attempts');
  });

  it('throws 401 when pending token not found', async () => {
    const db = mockDb();
    db.query.loginOtpCodes.findFirst.mockResolvedValue(undefined);
    await expect(
      loginStep2(db, { pendingToken: 'pending-tok', code: '123456', jwtSecret: 's' })
    ).rejects.toThrow('expired');
  });

  it('issues session with correct code', async () => {
    const db = mockDb();
    setupFullSession(db);
    const result = await loginStep2(db, {
      pendingToken: 'pending-tok',
      code: '123456',
      jwtSecret: 's',
    });
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh');
    expect(result.user.id).toBe('u1');
  });
});

// Regression coverage for a real production incident: a prior version of
// the superadmin-skips-OTP login path issued a session for any account
// with isSuperadmin=true WITHOUT checking the password at all - a full
// auth bypass, since the admin email is predictable. These tests exist
// specifically to make that regression impossible to reintroduce silently.
describe('authenticateSuperadmin', () => {
  it('returns null on wrong password for a superadmin account', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue({
      id: 'admin1',
      email: 'admin@skarion.com',
      passwordHash: 'hash',
      isSuperadmin: true,
      disabledAt: null,
    });
    const result = await authenticateSuperadmin(db, {
      email: 'admin@skarion.com',
      password: 'wrong-or-anything',
    });
    expect(result).toBeNull();
  });

  it('returns null for a non-superadmin account regardless of password', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'hash',
      isSuperadmin: false,
      disabledAt: null,
    });
    const result = await authenticateSuperadmin(db, { email: 'a@b.com', password: 'x' });
    expect(result).toBeNull();
  });

  it('returns null when the account does not exist', async () => {
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue(undefined);
    const result = await authenticateSuperadmin(db, {
      email: 'nobody@skarion.com',
      password: 'x',
    });
    expect(result).toBeNull();
  });

  it('returns null for a disabled superadmin account even with the correct password', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue({
      id: 'admin1',
      email: 'admin@skarion.com',
      passwordHash: 'hash',
      isSuperadmin: true,
      disabledAt: new Date(),
    });
    const result = await authenticateSuperadmin(db, {
      email: 'admin@skarion.com',
      password: 'correct',
    });
    expect(result).toBeNull();
  });

  it('returns the user only when the password actually matches', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const db = mockDb();
    db.query.users.findFirst.mockResolvedValue({
      id: 'admin1',
      email: 'admin@skarion.com',
      displayName: 'Admin',
      passwordHash: 'hash',
      isSuperadmin: true,
      tokenVersion: 1,
      disabledAt: null,
    });
    const result = await authenticateSuperadmin(db, {
      email: 'admin@skarion.com',
      password: 'correct',
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('admin1');
    expect(vi.mocked(verifyPassword)).toHaveBeenCalledWith('correct', 'hash');
  });
});
