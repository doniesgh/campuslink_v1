// models/Application.js
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // CV déposé : fichier dans le stockage (GridFS en production), jamais dans le dépôt ni sur le disque de Render.
  cv: { key: String, filename: String, mimeType: String, size: Number },
  coverLetter: String,
  status: { type: String, enum: ['envoyee', 'en_cours', 'acceptee', 'refusee'], default: 'envoyee' },
}, { timestamps: true });

// La clé de stockage ne quitte jamais le serveur : le CV se télécharge via GET /applications/:id/cv.
applicationSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.cv) delete ret.cv.key;
    return ret;
  },
});

module.exports = mongoose.model('Application', applicationSchema);