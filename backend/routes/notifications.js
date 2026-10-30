const express = require('express');
const {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// Mounted at /api/notifications. The signed-in user's own notifications only.
router.use(requireAuth);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/read-all', markAllAsRead);
router.post('/:id/read', markAsRead);

module.exports = router;
