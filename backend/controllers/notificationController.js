const Notification = require('../models/notificationModel');
const { assertObjectId, notFound, parseBooleanQuery, parsePagination } = require('../utils/validation');

// GET /api/notifications?page&limit&unread=true → { items, total, page, limit, unreadCount }, newest first.
const listNotifications = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const mine = { user: req.user._id };
  const filter = parseBooleanQuery(req.query.unread) ? { ...mine, readAt: null } : mine;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...mine, readAt: null }),
  ]);

  res.status(200).json({ items, total, page, limit, unreadCount });
};

// GET /api/notifications/unread-count → { count }
const getUnreadCount = async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, readAt: null });
  res.status(200).json({ count });
};

// POST /api/notifications/:id/read → 204, idempotent (replayed by the offline outbox).
const markAsRead = async (req, res) => {
  assertObjectId(req.params.id);
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) throw notFound('Notification');
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.status(204).end();
};

// POST /api/notifications/read-all → 204
const markAllAsRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.status(204).end();
};

module.exports = { listNotifications, getUnreadCount, markAsRead, markAllAsRead };
