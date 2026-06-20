// server/src/services/aiClient.ts
// Resolves which AI provider/model to use for the chat assistant: env-configured
// keys first (OPENAI_API_KEY, KIMI_API_KEY, OLLAMA_URL), then admin-managed
// DB keys (ai_provider_keys) ordered by priority. All providers used here are
// OpenAI-API-compatible, so a single OpenAI SDK client (with a per-provider
// baseURL) covers OpenAI, Kimi/Moonshot, Ollama, and similar OpenAI-compatible
// endpoints (OpenRouter, DeepSeek, etc.) without provider-specific branches.

import OpenAI from 'openai';
import {
  listEnabledAiProviderKeys,
  getAiProviderKeyDecrypted,
  recordAiProviderKeySuccess,
  recordAiProviderKeyFailure,
} from './aiProviderKeys.js';

export interface ActiveAiClient {
  client: OpenAI;
  model: string;
  /** Set when this client came from a DB-managed key, so callers can record success/failure. */
  dbKeyId?: string;
  orgId?: string;
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: process.env.OPENAI_MODEL || 'gpt-4o',
  kimi: 'moonshot-v1-32k',
  ollama: process.env.OLLAMA_MODEL || 'llama3.2',
};

export function buildClientFromKey(
  provider: string,
  apiKey: string,
  baseUrl?: string | null
): OpenAI {
  switch (provider) {
    case 'openai':
      return new OpenAI({ apiKey });
    case 'kimi':
      return new OpenAI({ apiKey, baseURL: baseUrl || process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1' });
    case 'ollama':
      // Ollama's OpenAI-compatible endpoint doesn't require a real key.
      return new OpenAI({ apiKey: apiKey || 'ollama', baseURL: baseUrl || `${process.env.OLLAMA_URL || 'http://localhost:11434'}/v1` });
    default:
      // Generic OpenAI-compatible provider (OpenRouter, DeepSeek, custom gateway, etc.)
      return new OpenAI({ apiKey, baseURL: baseUrl || undefined });
  }
}

/** Env-based provider, if configured. Mirrors the precedence already used by services/ai.ts. */
function getEnvClient(): ActiveAiClient | null {
  if (process.env.OPENAI_API_KEY) {
    return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model: DEFAULT_MODELS.openai };
  }
  if (process.env.KIMI_API_KEY) {
    return {
      client: buildClientFromKey('kimi', process.env.KIMI_API_KEY, process.env.KIMI_BASE_URL),
      model: DEFAULT_MODELS.kimi,
    };
  }
  if (process.env.OLLAMA_URL) {
    return { client: buildClientFromKey('ollama', '', process.env.OLLAMA_URL), model: DEFAULT_MODELS.ollama };
  }
  return null;
}

/**
 * Resolve the active AI client for an org: env-configured provider first,
 * then the highest-priority enabled DB-managed key for that org.
 */
export async function getActiveAiClient(orgId: string): Promise<ActiveAiClient | null> {
  const envClient = getEnvClient();
  if (envClient) return envClient;

  const keys = await listEnabledAiProviderKeys(orgId);
  for (const key of keys) {
    const withSecret = await getAiProviderKeyDecrypted(orgId, key.id);
    if (!withSecret) continue;
    const client = buildClientFromKey(key.provider, withSecret.decryptedKey, key.baseUrl);
    const model = DEFAULT_MODELS[key.provider] || DEFAULT_MODELS.openai;
    return { client, model, dbKeyId: key.id, orgId };
  }

  return null;
}

/** Test a single DB-managed key by sending a tiny request, and record the result. */
export async function testAiProviderKey(
  orgId: string,
  id: string
): Promise<{ success: boolean; error?: string; latencyMs: number }> {
  const start = Date.now();
  const keyRow = await getAiProviderKeyDecrypted(orgId, id);
  if (!keyRow) return { success: false, error: 'Key not found', latencyMs: Date.now() - start };

  try {
    const client = buildClientFromKey(keyRow.provider, keyRow.decryptedKey, keyRow.baseUrl);
    const model = DEFAULT_MODELS[keyRow.provider] || DEFAULT_MODELS.openai;
    await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: "Say 'SkarionCRM test OK' and nothing else." }],
      max_tokens: 20,
    });
    await recordAiProviderKeySuccess(orgId, id);
    return { success: true, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown provider error';
    await recordAiProviderKeyFailure(orgId, id, message);
    return { success: false, error: message, latencyMs: Date.now() - start };
  }
}
