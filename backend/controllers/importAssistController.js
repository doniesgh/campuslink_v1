const auditService = require('../service/auditService');
const { aiModel, isAiConfigured } = require('../service/aiService');
const { assistImport } = require('../service/importAssist');

// GET /api/users/import/assist [admin] → { enabled, model }: whether the web app can offer the smart import.
const getImportAssist = (req, res) => {
  const enabled = isAiConfigured();
  res.status(200).json({ enabled, model: enabled ? aiModel() : null });
};

// POST /api/users/import/assist [admin] { lines, values } → { mapping, model } (see service/importAssist.js).
// 503 AI_DISABLED / AI_NO_CREDITS, 429 AI_BUSY, 502 AI_FAILED when the AI service can't answer.
const postImportAssist = async (req, res) => {
  const { mapping, model } = await assistImport(req.body ?? {});
  // Part of a file left the server for the AI service: who, when and with which model.
  await auditService.record(req, {
    action: 'user.import.assist',
    summary: `Asked the AI (${model}) how an import file is laid out`,
    metadata: { model, lines: Array.isArray(req.body?.lines) ? req.body.lines.length : 0, columns: mapping.columns },
  });
  res.status(200).json({ mapping, model });
};

module.exports = { getImportAssist, postImportAssist };
