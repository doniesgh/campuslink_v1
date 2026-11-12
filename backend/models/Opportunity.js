// models/Opportunity.js
const mongoose = require('mongoose');

const OpportunitySchema = new mongoose.Schema({
  title: String,
  description: String,
  type: { type: String, enum: ['stage', 'emploi', 'pfe', 'alternance', 'projet'] },
  domain: String,
  duration: String,
  location: String,
  contractType: String,
  level: String,
  filiere: String,
  company: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.models.Opportunity || mongoose.model('Opportunity', OpportunitySchema);