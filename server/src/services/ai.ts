import OpenAI from 'openai';
import { DB } from '../db/index.js';
import {
  complianceItems,
  complianceCategories,
  transactions,
  w2Forms,
  employees,
  taxYears,
  chartOfAccounts,
  users,
  contacts,
} from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function parseDocumentWithAI(fileContent: string, fileType: string) {
  const client = getOpenAI();
  if (!client) {
    return {
      documentType: 'unknown',
      extractedFields: {},
      confidence: 0,
      warning: 'OpenAI API key not configured. Using fallback analysis.',
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a document analysis assistant. Analyze the provided document content and extract structured data. Return a JSON object with exactly these keys: documentType (string), extractedFields (object), and confidence (number 0-1).',
        },
        {
          role: 'user',
          content: `File type: ${fileType}\n\nContent:\n${fileContent.substring(0, 12000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(content);
    return {
      documentType: String(parsed.documentType || 'unknown'),
      extractedFields: parsed.extractedFields || {},
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch (error) {
    console.error('parseDocumentWithAI error:', error);
    return {
      documentType: 'unknown',
      extractedFields: {},
      confidence: 0,
      error: 'Failed to analyze document with AI',
    };
  }
}

export async function suggestAccountWithAI(description: string, amount: number) {
  const client = getOpenAI();
  if (!client) {
    return {
      suggestions: ['1000', '5000', '6000'],
      confidence: 0.75,
      warning: 'OpenAI API key not configured. Using fallback suggestions.',
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an accounting assistant. Given a transaction description and amount, suggest the most appropriate chart of account codes. Return a JSON object with exactly these keys: suggestions (array of strings, max 3), confidence (number 0-1), and reasoning (string). Common account codes: 1000 (Cash), 1100 (Accounts Receivable), 1200 (Inventory), 1500 (Fixed Assets), 2000 (Accounts Payable), 2100 (Accrued Liabilities), 3000 (Equity), 4000 (Revenue), 5000 (Cost of Goods Sold), 6000 (Operating Expenses), 7000 (Payroll Expenses).',
        },
        {
          role: 'user',
          content: `Description: ${description}\nAmount: ${amount}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(content);
    return {
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map(String)
        : ['6000'],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (error) {
    console.error('suggestAccountWithAI error:', error);
    return {
      suggestions: ['6000'],
      confidence: 0,
      error: 'Failed to get account suggestions from AI',
    };
  }
}

export async function checkComplianceWithAI(
  itemIds: string[],
  orgId: string,
  db: DB
) {
  const client = getOpenAI();

  const rows = await db
    .select()
    .from(complianceItems)
    .leftJoin(complianceCategories, eq(complianceItems.categoryId, complianceCategories.id))
    .leftJoin(users, eq(complianceItems.assignedTo, users.id))
    .where(and(eq(complianceItems.orgId, orgId), inArray(complianceItems.id, itemIds)));

  const items = rows.map((r) => ({
    id: r.compliance_items.id,
    title: r.compliance_items.title,
    description: r.compliance_items.description,
    status: r.compliance_items.status,
    dueDate: r.compliance_items.dueDate,
    completedDate: r.compliance_items.completedDate,
    evidenceRequired: r.compliance_items.evidenceRequired,
    nextReviewDate: r.compliance_items.nextReviewDate,
    category: r.compliance_categories?.name ?? null,
    assignee: r.users?.fullName ?? null,
  }));

  if (!client) {
    return {
      risks: [] as Array<{ itemId: string; severity: string; description: string }>,
      suggestions: [] as string[],
      warning: 'OpenAI API key not configured. Using fallback analysis.',
      itemsAnalyzed: items.length,
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a compliance analyst. Analyze the provided compliance items and identify risks and suggest improvements. Return a JSON object with exactly these keys: risks (array of { itemId, severity: "low"|"medium"|"high"|"critical", description }), suggestions (array of strings).',
        },
        {
          role: 'user',
          content: JSON.stringify(items),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(content);
    return {
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      itemsAnalyzed: items.length,
    };
  } catch (error) {
    console.error('checkComplianceWithAI error:', error);
    return {
      risks: [] as Array<{ itemId: string; severity: string; description: string }>,
      suggestions: [] as string[],
      itemsAnalyzed: items.length,
      error: 'Failed to analyze compliance with AI',
    };
  }
}

export async function analyzeTransactionsWithAI(
  transactionIds: string[],
  orgId: string,
  db: DB
) {
  const client = getOpenAI();

  const rows = await db
    .select()
    .from(transactions)
    .leftJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
    .leftJoin(contacts, eq(transactions.contactId, contacts.id))
    .where(and(eq(transactions.orgId, orgId), inArray(transactions.id, transactionIds)));

  const txs = rows.map((r) => ({
    id: r.transactions.id,
    description: r.transactions.description,
    amount: r.transactions.amount,
    transactionType: r.transactions.transactionType,
    transactionDate: r.transactions.transactionDate,
    debitCredit: r.transactions.debitCredit,
    account: r.chart_of_accounts?.name ?? null,
    contact: r.contacts?.fullName ?? null,
    isReconciled: r.transactions.isReconciled,
  }));

  if (!client) {
    return {
      anomalies: [] as Array<{
        transactionId: string;
        severity: string;
        type: string;
        description: string;
      }>,
      warning: 'OpenAI API key not configured. Using fallback analysis.',
      transactionsAnalyzed: txs.length,
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a financial analyst. Analyze the provided transactions and identify any anomalies, unusual patterns, or potential errors. Return a JSON object with exactly these keys: anomalies (array of { transactionId, severity: "low"|"medium"|"high"|"critical", type: string, description }).',
        },
        {
          role: 'user',
          content: JSON.stringify(txs),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(content);
    return {
      anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
      transactionsAnalyzed: txs.length,
    };
  } catch (error) {
    console.error('analyzeTransactionsWithAI error:', error);
    return {
      anomalies: [] as Array<{
        transactionId: string;
        severity: string;
        type: string;
        description: string;
      }>,
      transactionsAnalyzed: txs.length,
      error: 'Failed to analyze transactions with AI',
    };
  }
}

export async function generateW2PreviewWithAI(
  employeeId: string,
  taxYearId: string,
  orgId: string,
  db: DB
) {
  const client = getOpenAI();

  const w2Rows = await db
    .select()
    .from(w2Forms)
    .where(
      and(
        eq(w2Forms.employeeId, employeeId),
        eq(w2Forms.taxYearId, taxYearId),
        eq(w2Forms.orgId, orgId)
      )
    )
    .limit(1);

  const w2Form = w2Rows[0] ?? null;

  if (!w2Form) {
    return {
      preview: null as string | null,
      error: 'W2 form not found for the specified employee and tax year.',
    };
  }

  const employeeRows = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.orgId, orgId)))
    .limit(1);
  const employee = employeeRows[0] ?? null;

  const taxYearRows = await db
    .select()
    .from(taxYears)
    .where(and(eq(taxYears.id, taxYearId), eq(taxYears.orgId, orgId)))
    .limit(1);
  const taxYear = taxYearRows[0] ?? null;

  if (!client) {
    return {
      preview: null as string | null,
      warning: 'OpenAI API key not configured. W2 data is available but no AI-generated summary was created.',
      rawData: {
        box1Wages: w2Form.box1Wages,
        box2FederalTax: w2Form.box2FederalTax,
        box3SocialWages: w2Form.box3SocialWages,
        box4SocialTax: w2Form.box4SocialTax,
        box5MedicareWages: w2Form.box5MedicareWages,
        box6MedicareTax: w2Form.box6MedicareTax,
      },
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a payroll tax specialist. Generate a natural language summary of W2 data that a regular employee can understand. Include key takeaways about their earnings, taxes withheld, and any notable items. Be concise but informative.',
        },
        {
          role: 'user',
          content: `Employee: ${employee?.firstName} ${employee?.lastName} (${employee?.employeeId})\nTax Year: ${taxYear?.year}\n\nW2 Data:\n- Box 1 (Wages): ${w2Form.box1Wages}\n- Box 2 (Federal Tax): ${w2Form.box2FederalTax}\n- Box 3 (Social Security Wages): ${w2Form.box3SocialWages}\n- Box 4 (Social Security Tax): ${w2Form.box4SocialTax}\n- Box 5 (Medicare Wages): ${w2Form.box5MedicareWages}\n- Box 6 (Medicare Tax): ${w2Form.box6MedicareTax}\n- Box 7 (Social Security Tips): ${w2Form.box7SocialTips}\n- Box 8 (Allocated Tips): ${w2Form.box8AllocatedTips}\n- Box 10 (Dependent Care): ${w2Form.box10DependentCare}\n- Box 11 (Nonqualified Plans): ${w2Form.box11NonqualifiedPlans}\n- Box 12 Codes: ${JSON.stringify(w2Form.box12Codes)}\n- Box 13: ${JSON.stringify(w2Form.box13Checkboxes)}\n- Box 14: ${JSON.stringify(w2Form.box14Other)}`,
        },
      ],
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    return {
      preview: content,
      rawData: {
        box1Wages: w2Form.box1Wages,
        box2FederalTax: w2Form.box2FederalTax,
        box3SocialWages: w2Form.box3SocialWages,
        box4SocialTax: w2Form.box4SocialTax,
        box5MedicareWages: w2Form.box5MedicareWages,
        box6MedicareTax: w2Form.box6MedicareTax,
      },
    };
  } catch (error) {
    console.error('generateW2PreviewWithAI error:', error);
    return {
      preview: null as string | null,
      error: 'Failed to generate W2 preview with AI',
      rawData: {
        box1Wages: w2Form.box1Wages,
        box2FederalTax: w2Form.box2FederalTax,
        box3SocialWages: w2Form.box3SocialWages,
        box4SocialTax: w2Form.box4SocialTax,
        box5MedicareWages: w2Form.box5MedicareWages,
        box6MedicareTax: w2Form.box6MedicareTax,
      },
    };
  }
}
