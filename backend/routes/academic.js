const express = require('express');
const { listGroups } = require('../controllers/academicController');
const { requireAuth, requireRole } = require('../middleware/requireAuth');

const router = express.Router();

// Mounted at /api/academic. ADMIN only (the users page lists the groups a student can be put in).
router.use(requireAuth, requireRole('ADMIN'));

router.get('/groups', listGroups);

module.exports = router;
