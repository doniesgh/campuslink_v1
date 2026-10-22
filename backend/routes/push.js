const express = require('express');
const { getVapidPublicKey, saveSubscription, deleteSubscription } = require('../controllers/pushController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// Mounted at /api/push. The public key is public (the browser needs it to subscribe).
router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscriptions', requireAuth, saveSubscription);
router.delete('/subscriptions', requireAuth, deleteSubscription);

module.exports = router;
