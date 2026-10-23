const express = require('express');
const {
  getMe,
  updateMe,
  listUsers,
  getDirectory,
  getUserStats,
  createUser,
  importUsers,
  getUser,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { getImportAssist, postImportAssist } = require('../controllers/importAssistController');
const { requireAuth, requireRole } = require('../middleware/requireAuth');
const { userRateLimit } = require('../middleware/rateLimit');

// Each smart-import analysis is a paid AI call: RATE_LIMIT_AI_MAX per admin and hour (default 30).
const importAssistRateLimit = userRateLimit({
  name: 'import-assist',
  limitEnv: 'RATE_LIMIT_AI_MAX',
  defaultLimit: 30,
  defaultWindowMs: 60 * 60 * 1000,
  message: 'Too many AI analyses, please try again later',
});

const router = express.Router();

// Mounted at /api/users. Every route needs a valid access token.
router.use(requireAuth);

// Current user (any role). Declared before /:id so "me" is not read as an id.
router.get('/me', getMe);
router.patch('/me', updateMe);

// Administration
const adminOnly = requireRole('ADMIN');
router.get('/', adminOnly, listUsers);
router.get('/stats', adminOnly, getUserStats);
router.get('/directory', adminOnly, getDirectory);
router.post('/', adminOnly, createUser);
// Bulk creation from an Excel or CSV file read in the browser (see importUsers).
router.post('/import', adminOnly, importUsers);
// Smart import: the AI reads the layout of a file the web app could not (service/importAssist.js).
router.get('/import/assist', adminOnly, getImportAssist);
router.post('/import/assist', adminOnly, importAssistRateLimit, postImportAssist);
router.get('/:id', adminOnly, getUser);
router.patch('/:id', adminOnly, updateUser);
router.delete('/:id', adminOnly, deleteUser);

module.exports = router;
