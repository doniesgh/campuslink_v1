const mongoose = require('mongoose');

const RESERVATION_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'];

const reservationSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seats: { type: Number, min: 1, max: 8, default: 1 },
    message: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: RESERVATION_STATUSES, default: 'pending', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reservation', reservationSchema);
module.exports.RESERVATION_STATUSES = RESERVATION_STATUSES;
