import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { importJobs } from '../db/schema.js';
import { auditService } from '../services/audit.js';

// ------------------------------------------------------------------
// Normalized job shape (camelCase to match Skarion conventions)
// ------------------------------------------------------------------
interface NormalizedJob {
  title: string;
  company: string;
  location: string | null;
  source: string;
  sourceUrl: string | null;
  seniorityLevel: string | null;
  employmentType: string | null;
  applicantsCount: number | null;
  companyEmployeesCount: number | null;
  companyWebsite: string | null;
  postedAt: string | null;
}

// ------------------------------------------------------------------
// Greenhouse fetcher
// ------------------------------------------------------------------
async function fetchGreenhouseJobs(boardToken: string): Promise<NormalizedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Greenhouse board "${boardToken}" not found (${res.status})`,
    });
  }

  const data = (await res.json()) as any;
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];

  return jobs
    .filter((j: any) => j.title)
    .map((j: any) => ({
      title: j.title as string,
      company: boardToken,
      location: j.location?.name ?? null,
      source: 'greenhouse' as const,
      sourceUrl: j.absolute_url ?? null,
      seniorityLevel: null,
      employmentType: null,
      applicantsCount: null,
      companyEmployeesCount: null,
      companyWebsite: null,
      postedAt: j.updated_at ? j.updated_at.slice(0, 10) : null,
    }));
}

// ------------------------------------------------------------------
// Lever fetcher
// ------------------------------------------------------------------
async function fetchLeverJobs(company: string): Promise<NormalizedJob[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Lever company "${company}" not found (${res.status})`,
    });
  }

  const data = (await res.json()) as any;
  const postings = Array.isArray(data) ? data : [];

  return postings
    .filter((p: any) => p.text)
    .map((p: any) => ({
      title: p.text as string,
      company,
      location: p.categories?.location ?? null,
      source: 'lever' as const,
      sourceUrl: p.hostedUrl ?? null,
      seniorityLevel: null,
      employmentType: p.categories?.commitment ?? null,
      applicantsCount: null,
      companyEmployeesCount: null,
      companyWebsite: null,
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : null,
    }));
}

// ------------------------------------------------------------------
// Ashby fetcher
// ------------------------------------------------------------------
async function fetchAshbyJobs(boardName: string): Promise<NormalizedJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Ashby board "${boardName}" not found (${res.status})`,
    });
  }

  const data = (await res.json()) as any;
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];

  return jobs
    .filter((j: any) => j.title)
    .map((j: any) => ({
      title: j.title as string,
      company: boardName,
      location: j.location ?? null,
      source: 'ashby' as const,
      sourceUrl: j.jobUrl ?? null,
      seniorityLevel: null,
      employmentType: j.employmentType ?? null,
      applicantsCount: null,
      companyEmployeesCount: null,
      companyWebsite: null,
      postedAt: j.publishedDate ? j.publishedDate.slice(0, 10) : null,
    }));
}

// ------------------------------------------------------------------
// USAJobs fetcher
// ------------------------------------------------------------------
async function fetchUsaJobs(keyword: string): Promise<NormalizedJob[]> {
  const apiKey = process.env.USAJOBS_API_KEY;
  const userAgent = process.env.USAJOBS_USER_AGENT;

  if (!apiKey || !userAgent) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'USAJobs import requires USAJOBS_API_KEY and USAJOBS_USER_AGENT env vars. ' +
        'Register for free at https://developer.usajobs.gov.',
    });
  }

  const params = new URLSearchParams({
    Keyword: keyword,
    ResultsPerPage: '250',
  });

  const res = await fetch(`https://data.usajobs.gov/api/search?${params}`, {
    headers: {
      Host: 'data.usajobs.gov',
      'User-Agent': userAgent,
      'Authorization-Key': apiKey,
    },
  });

  if (!res.ok) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `USAJobs search failed (${res.status})`,
    });
  }

  const data = (await res.json()) as any;
  const items = Array.isArray(data?.SearchResult?.SearchResultItems)
    ? data.SearchResult.SearchResultItems
    : [];

  return items
    .map((item: any) => item.MatchedObjectDescriptor ?? {})
    .filter((d: any) => d.PositionTitle)
    .map((d: any) => ({
      title: d.PositionTitle as string,
      company: d.OrganizationName ?? d.DepartmentName ?? null,
      location: d.PositionLocationDisplay ?? null,
      source: 'usajobs' as const,
      sourceUrl: d.PositionURI ?? null,
      seniorityLevel: d.JobGrade?.[0]?.Code ?? null,
      employmentType: d.PositionSchedule?.[0]?.Name ?? null,
      applicantsCount: null,
      companyEmployeesCount: null,
      companyWebsite: null,
      postedAt: d.PublicationStartDate ? d.PublicationStartDate.slice(0, 10) : null,
    }));
}

// ------------------------------------------------------------------
// Provider dispatcher
// ------------------------------------------------------------------
async function fetchAtsJobs(
  provider: 'greenhouse' | 'lever' | 'ashby' | 'usajobs',
  token: string
): Promise<NormalizedJob[]> {
  switch (provider) {
    case 'greenhouse':
      return fetchGreenhouseJobs(token);
    case 'lever':
      return fetchLeverJobs(token);
    case 'ashby':
      return fetchAshbyJobs(token);
    case 'usajobs':
      return fetchUsaJobs(token);
    default:
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unsupported ATS provider: ${provider}`,
      });
  }
}

// ------------------------------------------------------------------
// Zod schemas
// ------------------------------------------------------------------
const jobRowSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().nullable().optional(),
  source: z.string(),
  sourceUrl: z.string().nullable().optional(),
  seniorityLevel: z.string().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  applicantsCount: z.number().nullable().optional(),
  companyEmployeesCount: z.number().nullable().optional(),
  companyWebsite: z.string().nullable().optional(),
  postedAt: z.string().nullable().optional(),
});

// ------------------------------------------------------------------
// Router
// ------------------------------------------------------------------
export const atsRouter = router({
  // ================================================================
  // 1. fetchGreenhouse
  // ================================================================
  fetchGreenhouse: protectedProcedure
    .input(z.object({ boardToken: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const jobs = await fetchGreenhouseJobs(input.boardToken);
      return jobs;
    }),

  // ================================================================
  // 2. fetchLever
  // ================================================================
  fetchLever: protectedProcedure
    .input(z.object({ company: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const jobs = await fetchLeverJobs(input.company);
      return jobs;
    }),

  // ================================================================
  // 3. fetchAshby
  // ================================================================
  fetchAshby: protectedProcedure
    .input(z.object({ boardName: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const jobs = await fetchAshbyJobs(input.boardName);
      return jobs;
    }),

  // ================================================================
  // 4. fetchUsaJobs
  // ================================================================
  fetchUsaJobs: protectedProcedure
    .input(z.object({ keyword: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const jobs = await fetchUsaJobs(input.keyword);
      return jobs;
    }),

  // ================================================================
  // 5. importJobs — persist fetched jobs as an importJob record
  // ================================================================
  importJobs: protectedProcedure
    .input(
      z.object({
        jobs: z.array(jobRowSchema).min(1),
        source: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [job] = await db
        .insert(importJobs)
        .values({
          orgId: ctx.orgId!,
          name: `ATS Import: ${input.source} (${input.jobs.length} jobs)`,
          sourceType: input.source,
          entityType: 'contacts',
          rawData: input.jobs as any,
          mappedFields: {},
          totalRows: input.jobs.length,
          status: 'pending',
          createdBy: ctx.user.id,
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'importJob',
        job.id,
        {
          name: job.name,
          sourceType: job.sourceType,
          entityType: job.entityType,
          totalRows: job.totalRows,
        }
      );

      return job;
    }),

  // ================================================================
  // 6. getSupportedProviders
  // ================================================================
  getSupportedProviders: protectedProcedure.query(async ({ ctx }) => {
    // Verify org context even for a static list
    if (!ctx.orgId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Organization context required' });
    }

    return [
      {
        name: 'Greenhouse',
        slug: 'greenhouse',
        description: 'Import from Greenhouse boards',
      },
      {
        name: 'Lever',
        slug: 'lever',
        description: 'Import from Lever job postings',
      },
      {
        name: 'Ashby',
        slug: 'ashby',
        description: 'Import from Ashby job boards',
      },
      {
        name: 'USAJobs',
        slug: 'usajobs',
        description: 'Import from USAJobs federal listings',
      },
    ];
  }),

  // ================================================================
  // 7. testConnection
  // ================================================================
  testConnection: protectedProcedure
    .input(
      z.object({
        provider: z.enum(['greenhouse', 'lever', 'ashby', 'usajobs']),
        token: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const jobs = await fetchAtsJobs(input.provider, input.token);
        return {
          success: true,
          count: jobs.length,
          sample: jobs.slice(0, 3),
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;

        const message = err instanceof Error ? err.message : 'Unknown connection error';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Connection test failed for ${input.provider}: ${message}`,
        });
      }
    }),
});
