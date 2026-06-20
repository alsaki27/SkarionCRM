// server/src/routers/chat.ts
// Chat assistant: manager-tier roles (owner/admin/accountant/bookkeeper) get
// read-only tool access across the org's data; everyone else gets a narrower
// set of tools scoped to their own employee record only. Tool access is
// resolved server-side from ctx.user.role — the model cannot expand its own
// permissions no matter what's asked of it.

import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type OpenAI from 'openai';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { aiConversations } from '../db/schema.js';
import { getActiveAiClient } from '../services/aiClient.js';
import { recordAiProviderKeySuccess, recordAiProviderKeyFailure } from '../services/aiProviderKeys.js';
import * as tools from '../services/aiDataTools.js';
import { isManagerRole } from '../services/aiDataTools.js';

type ToolDef = {
  spec: OpenAI.Chat.Completions.ChatCompletionTool;
  run: (orgId: string, userId: string, args: Record<string, unknown>) => Promise<unknown>;
};

const MANAGER_TOOLS: Record<string, ToolDef> = {
  getInvoiceSummary: {
    spec: {
      type: 'function',
      function: {
        name: 'getInvoiceSummary',
        description: "Get invoice counts and totals grouped by status for the org.",
        parameters: { type: 'object', properties: {} },
      },
    },
    run: (orgId) => tools.getInvoiceSummary(orgId),
  },
  getOverdueInvoices: {
    spec: {
      type: 'function',
      function: {
        name: 'getOverdueInvoices',
        description: 'List currently overdue invoices (not paid/cancelled/refunded, past due date).',
        parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Max rows, default 20' } } },
      },
    },
    run: (orgId, _u, args) => tools.getOverdueInvoices(orgId, (args.limit as number) || 20),
  },
  getTransactionSummary: {
    spec: {
      type: 'function',
      function: {
        name: 'getTransactionSummary',
        description: 'Get transaction totals grouped by type and debit/credit, optionally within a date range.',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
      },
    },
    run: (orgId, _u, args) =>
      tools.getTransactionSummary(orgId, args.startDate as string | undefined, args.endDate as string | undefined),
  },
  getComplianceStatus: {
    spec: {
      type: 'function',
      function: {
        name: 'getComplianceStatus',
        description: 'Get compliance item counts by status, plus upcoming (not yet completed) due items.',
        parameters: { type: 'object', properties: {} },
      },
    },
    run: (orgId) => tools.getComplianceStatus(orgId),
  },
  getEmployeeHeadcount: {
    spec: {
      type: 'function',
      function: {
        name: 'getEmployeeHeadcount',
        description: 'Get employee headcount broken down by status and employment type.',
        parameters: { type: 'object', properties: {} },
      },
    },
    run: (orgId) => tools.getEmployeeHeadcount(orgId),
  },
  getLatestPayrollSummary: {
    spec: {
      type: 'function',
      function: {
        name: 'getLatestPayrollSummary',
        description: 'Get totals for the most recent payroll run.',
        parameters: { type: 'object', properties: {} },
      },
    },
    run: (orgId) => tools.getLatestPayrollSummary(orgId),
  },
};

const SELF_SCOPED_TOOLS: Record<string, ToolDef> = {
  getMyPtoBalances: {
    spec: {
      type: 'function',
      function: {
        name: 'getMyPtoBalances',
        description: "Get the current user's own PTO/leave balances.",
        parameters: { type: 'object', properties: {} },
      },
    },
    run: (orgId, userId) => tools.getMyPtoBalances(orgId, userId),
  },
  getMyTimesheetSummary: {
    spec: {
      type: 'function',
      function: {
        name: 'getMyTimesheetSummary',
        description: "Get the current user's own recent timesheets.",
        parameters: {
          type: 'object',
          properties: { weeks: { type: 'number', description: 'How many recent weeks, default 4' } },
        },
      },
    },
    run: (orgId, userId, args) => tools.getMyTimesheetSummary(orgId, userId, (args.weeks as number) || 4),
  },
};

function toolsForRole(role: string): Record<string, ToolDef> {
  return isManagerRole(role) ? { ...MANAGER_TOOLS, ...SELF_SCOPED_TOOLS } : SELF_SCOPED_TOOLS;
}

const SYSTEM_PROMPT = `You are the SkarionCRM assistant. Answer questions about the user's organization using the provided tools — never invent numbers. If a tool returns no data, say so plainly. Keep answers concise and business-appropriate. You can only see data the tools return; you have no access to anything outside this org.`;

type StoredMessage = { role: 'user' | 'assistant'; content: string; timestamp: string };

export const chatRouter = router({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return db.query.aiConversations.findMany({
      where: and(eq(aiConversations.orgId, ctx.orgId!), eq(aiConversations.userId, ctx.user.id)),
      orderBy: [desc(aiConversations.updatedAt)],
      columns: { id: true, title: true, updatedAt: true, createdAt: true },
      limit: 50,
    });
  }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const convo = await db.query.aiConversations.findFirst({
        where: and(
          eq(aiConversations.id, input.id),
          eq(aiConversations.orgId, ctx.orgId!),
          eq(aiConversations.userId, ctx.user.id)
        ),
      });
      if (!convo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
      return convo;
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid().optional(),
        message: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.orgId!;
      const userId = ctx.user.id;

      const active = await getActiveAiClient(orgId);
      if (!active) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No AI provider is configured. Ask an admin to add one in Settings → AI Providers.',
        });
      }

      let convo = input.conversationId
        ? await db.query.aiConversations.findFirst({
            where: and(
              eq(aiConversations.id, input.conversationId),
              eq(aiConversations.orgId, orgId),
              eq(aiConversations.userId, userId)
            ),
          })
        : null;

      const priorMessages: StoredMessage[] = (convo?.messages as StoredMessage[] | null) ?? [];
      const userMessage: StoredMessage = { role: 'user', content: input.message, timestamp: new Date().toISOString() };

      const availableTools = toolsForRole(ctx.user.role);
      const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...priorMessages.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
        { role: 'user', content: input.message },
      ];

      let replyText: string;
      try {
        replyText = await runToolLoop(active.client, active.model, chatMessages, availableTools, orgId, userId);
        if (active.dbKeyId) await recordAiProviderKeySuccess(orgId, active.dbKeyId);
      } catch (err) {
        if (active.dbKeyId) {
          await recordAiProviderKeyFailure(orgId, active.dbKeyId, err instanceof Error ? err.message : 'Unknown error');
        }
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: `AI provider request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }

      const assistantMessage: StoredMessage = { role: 'assistant', content: replyText, timestamp: new Date().toISOString() };
      const updatedMessages = [...priorMessages, userMessage, assistantMessage];

      if (convo) {
        [convo] = await db
          .update(aiConversations)
          .set({ messages: updatedMessages, updatedAt: new Date() })
          .where(eq(aiConversations.id, convo.id))
          .returning();
      } else {
        [convo] = await db
          .insert(aiConversations)
          .values({
            orgId,
            userId,
            title: input.message.slice(0, 80),
            model: active.model,
            messages: updatedMessages,
          })
          .returning();
      }

      return { conversationId: convo!.id, reply: replyText };
    }),
});

async function runToolLoop(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  availableTools: Record<string, ToolDef>,
  orgId: string,
  userId: string,
  maxRounds = 4
): Promise<string> {
  const toolSpecs = Object.values(availableTools).map((t) => t.spec);
  const conversation = [...messages];

  for (let round = 0; round < maxRounds; round++) {
    const response = await client.chat.completions.create({
      model,
      messages: conversation,
      tools: toolSpecs.length > 0 ? toolSpecs : undefined,
      temperature: 0.3,
    });

    const choice = response.choices[0];
    const toolCalls = choice?.message?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      return choice?.message?.content ?? '';
    }

    conversation.push(choice.message);

    for (const call of toolCalls) {
      const tool = availableTools[call.function.name];
      let result: unknown;
      if (!tool) {
        result = { error: `Tool "${call.function.name}" is not available for your role.` };
      } else {
        try {
          const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          result = await tool.run(orgId, userId, args);
        } catch (err) {
          result = { error: err instanceof Error ? err.message : 'Tool execution failed.' };
        }
      }
      conversation.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return "I wasn't able to finish gathering that information — try narrowing your question.";
}
