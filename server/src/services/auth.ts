import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users, organizations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { JWTPayload } from '../trpc.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skarion-dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface AuthResult {
  user: typeof users.$inferSelect;
  token: string;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(userId: string, orgId: string, email: string, role: string): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      orgId,
      email,
      role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  async register(
    email: string,
    password: string,
    fullName: string,
    orgName: string,
    businessType?: string
  ): Promise<AuthResult> {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' });
    }

    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existingOrg = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
    });
    if (existingOrg) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Organization slug already taken' });
    }

    const [org] = await db.insert(organizations).values({
      name: orgName,
      slug: orgSlug,
      businessType,
      status: 'active',
    }).returning();

    const passwordHash = await this.hashPassword(password);

    const [user] = await db.insert(users).values({
      orgId: org.id,
      email,
      fullName,
      role: 'owner',
      passwordHash,
      isActive: true,
    }).returning();

    const token = this.generateToken(user.id, org.id, user.email, user.role);

    return { user, token };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.passwordHash) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid credentials' });
    }

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid credentials' });
    }

    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const token = this.generateToken(user.id, user.orgId, user.email, user.role);

    return { user, token };
  }

  async inviteUser(
    orgId: string,
    invitedBy: string,
    email: string,
    fullName: string,
    role: string
  ): Promise<typeof users.$inferSelect> {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });
    if (!org) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    const existing = await db.query.users.findFirst({
      where: and(eq(users.orgId, orgId), eq(users.email, email)),
    });
    if (existing) {
      throw new TRPCError({ code: 'CONFLICT', message: 'User already in organization' });
    }

    const tempPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10).toUpperCase();
    const passwordHash = await this.hashPassword(tempPassword);

    const [user] = await db.insert(users).values({
      orgId,
      email,
      fullName,
      role,
      passwordHash,
      isActive: true,
    }).returning();

    return user;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.passwordHash) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    const valid = await this.verifyPassword(oldPassword, user.passwordHash);
    if (!valid) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid current password' });
    }

    const newHash = await this.hashPassword(newPassword);
    await db.update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, userId));
  }
}

export const authService = new AuthService();
