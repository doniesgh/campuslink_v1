const HttpError = require('../utils/httpError');

// AI completions through OpenRouter (https://openrouter.ai): one API key, many models. Off unless
// OPENROUTER_API_KEY is set. OPENROUTER_MODEL picks the model, or several separated by commas: the next ones are
// tried when one is busy or down (free models often are).
// Requests only go to providers that do not store or train on the data (data_collection: "deny"), unless
// OPENROUTER_ALLOW_DATA_COLLECTION=true (free models need it). OPENROUTER_BASE_URL is for tests.
const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS = 50000;
const MODELS_TIMEOUT_MS = 10000;

const isAiConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);
const aiModels = () => {
  const models = (process.env.OPENROUTER_MODEL || '').split(',').map((model) => model.trim()).filter(Boolean);
  return models.length > 0 ? models : [DEFAULT_MODEL];
};
const aiModel = () => aiModels()[0];
const baseUrl = () => (process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

// What each model supports (OpenRouter's public model list, read once): how it can be asked for JSON —
// "schema" (structured outputs: the schema is enforced), "object" (JSON mode) or "text" (asked in the prompt; the
// free models are often of this kind) — and whether it reasons first (then asked not to).
const capabilities = new Map();
let catalog = null;

const loadCatalog = () => {
  catalog ??= fetch(`${baseUrl()}/models`, { signal: AbortSignal.timeout(MODELS_TIMEOUT_MS) })
    .then((response) => {
      if (!response.ok) throw new Error(`models answered ${response.status}`);
      return response.json();
    })
    .then((body) => {
      for (const entry of Array.isArray(body?.data) ? body.data : []) {
        const params = entry.supported_parameters ?? [];
        let json = 'text';
        if (params.includes('structured_outputs')) json = 'schema';
        else if (params.includes('response_format')) json = 'object';
        capabilities.set(entry.id, { json, reasoning: params.includes('reasoning') });
      }
    })
    .catch(() => {
      // Unknown: asked again next time; meanwhile the models are asked with the schema, as most support it.
      catalog = null;
    });
  return catalog;
};

const JSON_MODES = ['text', 'object', 'schema'];

/** What every model of the list supports: the JSON mode all of them honour, and whether any of them reasons. */
const capabilitiesOf = async (models) => {
  if (models.some((model) => !capabilities.has(model))) await loadCatalog();
  const known = models.map((model) => capabilities.get(model) ?? { json: 'schema', reasoning: false });
  return {
    json: known.reduce((lowest, { json }) => (JSON_MODES.indexOf(json) < JSON_MODES.indexOf(lowest) ? json : lowest), 'schema'),
    reasoning: known.some(({ reasoning }) => reasoning),
  };
};

// The JSON object of an answer, also when it comes in a ```json block or after a sentence.
const parseJson = (text) => {
  const value = String(text ?? '').trim();
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object');
    return JSON.parse(value.slice(start, end + 1));
  }
};

const aiError = (status) => {
  if (status === 429) return new HttpError(429, 'AI_BUSY', 'The AI service is busy or its daily limit is reached');
  if (status === 402) return new HttpError(503, 'AI_NO_CREDITS', 'The AI account has no credits left');
  if (status === 401 || status === 403) return new HttpError(503, 'AI_DISABLED', 'The AI service refused the API key');
  return new HttpError(502, 'AI_FAILED', `The AI service answered ${status}`);
};

// Text of the answer: a string, or the text parts of an array.
const messageText = (content) => (Array.isArray(content) ? content.map((part) => part?.text ?? '').join('') : content);

/**
 * Asks the model for a JSON object that follows `schema`: enforced by the provider (structured outputs) when the
 * model supports it, otherwise described in the instructions; the caller checks the answer either way. Returns
 * { data, model, usage }. Throws HttpError: 503 AI_DISABLED (no key, key refused), 503 AI_NO_CREDITS,
 * 429 AI_BUSY, 502 AI_FAILED (unreachable, error, or an answer that is not JSON).
 */
const completeJson = async ({ system, user, schemaName, schema, maxTokens = 4000 }) => {
  if (!isAiConfigured()) throw new HttpError(503, 'AI_DISABLED', 'AI is not configured on this server');

  const models = aiModels();
  const [model] = models;
  const { json, reasoning } = await capabilitiesOf(models);
  const instructions =
    json === 'schema' ? system : `${system}\n\nAnswer with one JSON object only, no other text, following this JSON schema:\n${JSON.stringify(schema)}`;
  const formats = {
    schema: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    object: { type: 'json_object' },
  };

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
        model,
        // Fallbacks: OpenRouter tries the next model when one fails (rate limit, down).
        ...(models.length > 1 ? { models } : {}),
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: user },
        ],
        ...(formats[json] ? { response_format: formats[json] } : {}),
        // Reading a spreadsheet's layout needs no reasoning: reasoning models otherwise think for 30 s or more, and
        // can spend all their tokens before answering.
        ...(reasoning ? { reasoning: { enabled: false } } : {}),
        provider: {
          // Only providers that honour the JSON format asked for.
          require_parameters: Boolean(formats[json]),
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

  // OpenRouter answers 200 at once and keeps the connection open while the model works: a model too slow is cut
  // off here, by the timeout.
  const body = await response.json().catch(() => null);
  if (response.ok && !body) {
    console.error(`[ai] ${model} did not answer within ${TIMEOUT_MS / 1000} s`);
    throw new HttpError(502, 'AI_FAILED', 'The AI service took too long to answer');
  }
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
    return { data: parseJson(text), model: body.model || model, usage: body.usage ?? null };
  } catch {
    console.error('[ai] Answer is not JSON:', String(text).slice(0, 200));
    throw new HttpError(502, 'AI_FAILED', 'The AI service did not answer in the expected format');
  }
};

module.exports = { completeJson, isAiConfigured, aiModel };
