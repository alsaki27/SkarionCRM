import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import {
  parseDocumentWithAI,
  suggestAccountWithAI,
  checkComplianceWithAI,
  analyzeTransactionsWithAI,
  generateW2PreviewWithAI,
} from '../services/ai.js';

export const aiRouter = router({
  parseDocument: protectedProcedure
    .input(
      z.object({
        fileContent: z.string(),
        fileType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return parseDocumentWithAI(input.fileContent, input.fileType);
    }),

  suggestAccount: protectedProcedure
    .input(
      z.object({
        description: z.string(),
        amount: z.number(),
      })
    )
    .query(async ({ input }) => {
      return suggestAccountWithAI(input.description, input.amount);
    }),

  checkCompliance: protectedProcedure
    .input(
      z.object({
        itemIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return checkComplianceWithAI(input.itemIds, ctx.orgId!, ctx.db);
    }),

  analyzeTransactions: protectedProcedure
    .input(
      z.object({
        transactionIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return analyzeTransactionsWithAI(input.transactionIds, ctx.orgId!, ctx.db);
    }),

  generateW2Preview: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        taxYearId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      return generateW2PreviewWithAI(
        input.employeeId,
        input.taxYearId,
        ctx.orgId!,
        ctx.db
      );
    }),
});
