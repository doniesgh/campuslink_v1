const mongoose = require('mongoose');

// Notifications du forum (demandes de places, trajets qui correspondent à une recherche).
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true }, // reservation:new | reservation:accepted | reservation:rejected | reservation:cancelled | ride:match
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 300 },
    data: { type: mongoose.Schema.Types.Mixed }, // { postId, reservationId, searchId }
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);
schema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ForumNotification', schema);
