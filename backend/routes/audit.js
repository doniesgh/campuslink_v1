const express = require('express');
const { listAuditLogs, listAuditActions } = require('../controllers/auditController');
const { requireAuth, requireRole } = require('../middleware/requireAuth');

const router = express.Router();

// Mounted at /api/audit. ADMIN only.
router.use(requireAuth, requireRole('ADMIN'));

router.get('/', listAuditLogs);
router.get('/actions', listAuditActions);
// How this API sees the caller's address (the IP recorded in the log and used by the rate limits): to set
// TRUST_PROXY behind a hosting proxy (Render, nginx...). Admins only.
router.get('/request-info', (req, res) => {
  res.status(200).json({
    ip: req.ip,
    ips: req.ips,
    forwardedFor: req.get('x-forwarded-for') ?? null,
    trustProxy: req.app.get('trust proxy'),
  });
});

module.exports = router;
