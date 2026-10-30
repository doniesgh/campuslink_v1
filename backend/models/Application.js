// models/Application.js
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cvUrl: String,
  coverLetter: String,
  status: { type: String, enum: ['envoyee', 'en_cours', 'acceptee', 'refusee'], default: 'envoyee' },
}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);