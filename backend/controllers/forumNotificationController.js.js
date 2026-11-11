const mongoose = require('mongoose');
const ForumNotification = require('../models/ForumNotification');
// GET /api/posts/notifications
exports.list = async (req, res) => {
  try {
    const [notifications, unread] = await Promise.all([
      ForumNotification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      ForumNotification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ notifications, unread });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// PUT /api/posts/notifications/read   { ids?: string[] }  (sans ids : toutes)
exports.markRead = async (req, res) => {
  try {
    const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) : null;
    const filter = { user: req.user._id, read: false, ...(ids ? { _id: { $in: ids } } : {}) };
    await ForumNotification.updateMany(filter, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
