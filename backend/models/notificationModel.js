const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// ACCOUNT: the user's own account changed (role, group, password) or, for admins, a new sign-up.
const NOTIFICATION_TYPES = ['TIMETABLE_CHANGE', 'ANNOUNCEMENT', 'SYSTEM', 'ACCOUNT'];
const TITLE_MAX_LENGTH = 200;
const BODY_MAX_LENGTH = 1000;

// In-app notification of one user, created by service/notificationService.js (which also sends the push).
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: TITLE_MAX_LENGTH },
    body: { type: String, trim: true, maxlength: BODY_MAX_LENGTH, default: '' },
    // Relative web path opened by the notification, e.g. "/dashboard/forum/<id>".
    link: { type: String, default: null },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
    readAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false,
    toJSON: {
      // { id, type, title, body, link, data, readAt, createdAt }
      transform: (doc, ret) => ({
        id: String(ret._id),
        type: ret.type,
        title: ret.title,
        body: ret.body || '',
        link: ret.link ?? null,
        data: ret.data ?? {},
        readAt: ret.readAt ?? null,
        createdAt: ret.createdAt,
      }),
    },
  }
);

// Newest first per user, and the unread count.
notificationSchema.index({ user: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.TITLE_MAX_LENGTH = TITLE_MAX_LENGTH;
module.exports.BODY_MAX_LENGTH = BODY_MAX_LENGTH;
