const HttpError = require('../utils/httpError');

// AI completions through OpenRouter (https://openrouter.ai): one API key, many models. Off unless
// OPENROUTER_API_KEY is set. OPENROUTER_MODEL picks the model (it must support structured outputs).
// Requests only go to providers that do not store or train on the data (data_collection: "deny"), unless
// OPENROUTER_ALLOW_DATA_COLLECTION=true (some free models need it). OPENROUTER_BASE_URL is for tests.
const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS = 45000;

const isAiConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);
const aiModel = () => process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
const baseUrl = () => (process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

const aiError = (status) => {
  if (status === 429) return new HttpError(429, 'AI_BUSY', 'The AI service is busy or its daily limit is reached');
  if (status === 402) return new HttpError(503, 'AI_NO_CREDITS', 'The AI account has no credits left');
  if (status === 401 || status === 403) return new HttpError(503, 'AI_DISABLED', 'The AI service refused the API key');
  return new HttpError(502, 'AI_FAILED', `The AI service answered ${status}`);
};

// Text of the answer: a string, or the text parts of an array.
const messageText = (content) => (Array.isArray(content) ? content.map((part) => part?.text ?? '').join('') : content);

/**
 * Asks the model for a JSON object that follows `schema` (structured outputs, strict). Returns
 * { data, model, usage }. Throws HttpError: 503 AI_DISABLED (no key, key refused), 503 AI_NO_CREDITS,
 * 429 AI_BUSY, 502 AI_FAILED (unreachable, error, or an answer that is not the expected JSON).
 */
const completeJson = async ({ system, user, schemaName, schema, maxTokens = 2000 }) => {
  if (!isAiConfigured()) throw new HttpError(503, 'AI_DISABLED', 'AI is not configured on this server');

  let response;
  try {
    response = await fetch(`${baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        // Optional attribution shown in the OpenRouter dashboard.
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'CampusLink',
      },
      body: JSON.stringify({
        model: aiModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
        provider: {
          require_parameters: true,
          data_collection: process.env.OPENROUTER_ALLOW_DATA_COLLECTION === 'true' ? 'allow' : 'deny',
        },
        temperature: 0,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error('[ai] OpenRouter unreachable:', error.message);
    throw new HttpError(502, 'AI_FAILED', 'The AI service could not be reached');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`[ai] OpenRouter answered ${response.status}:`, String(body?.error?.message ?? '').slice(0, 300));
    throw aiError(response.status);
  }
  // OpenRouter can also report a failure inside a 200 answer.
  if (body?.error) {
    console.error('[ai] OpenRouter error:', String(body.error.message ?? '').slice(0, 300));
    throw aiError(Number(body.error.code) || 502);
  }

  const text = messageText(body?.choices?.[0]?.message?.content);
  try {
    return { data: JSON.parse(text), model: body.model || aiModel(), usage: body.usage ?? null };
  } catch {
    console.error('[ai] Answer is not JSON:', String(text).slice(0, 200));
    throw new HttpError(502, 'AI_FAILED', 'The AI service did not answer in the expected format');
  }
};

module.exports = { completeJson, isAiConfigured, aiModel };
