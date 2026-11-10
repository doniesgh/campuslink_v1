const mongoose = require('mongoose');

const POST_TYPES = ['covoiturage', 'objet_perdu', 'experience', 'idee'];

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: POST_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    tags: [{ type: String, trim: true, lowercase: true }],
    images: [{ type: String }], // URLs (upload géré ailleurs : multer / cloudinary...)
    location: { type: String, trim: true },

    // --- Covoiturage ---
    // covoiturage: {
    //   departure: String,
    //   destination: String,
    //   departureDate: Date,
    //   seats: { type: Number, min: 1, max: 8 },
    //   price: { type: Number, min: 0, default: 0 },
    //   contactPhone: String,
    // },
    covoiturage: {
      departure: String,
      destination: String,
      departureDate: Date,
      seats: { type: Number, min: 1, max: 8 },
      price: { type: Number, min: 0, default: 0 },
      contactPhone: String,

      // trip map (envoyés par le formulaire)
      departureCoords: { lat: Number, lng: Number },
      destinationCoords: { lat: Number, lng: Number },
      distanceKm: Number,
      durationMin: Number,

      // GeoJSON calculé automatiquement (pour $geoNear)
      departureGeo: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number], default: undefined }, // sans ce default, Mongoose crée [] et l'index 2dsphere plante
      },
    },
    // --- Objet perdu / trouvé ---
    objetPerdu: {
      kind: { type: String, enum: ['perdu', 'trouve'] },
      category: String, // clés, téléphone, documents, ...
      date: Date,
      place: String,
      contactPhone: String,
    },

    status: { type: String, enum: ['active', 'closed', 'resolved'], default: 'active', index: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);
postSchema.index({ 'covoiturage.departureGeo': '2dsphere' });

// Calcule le point GeoJSON à partir de departureCoords à chaque sauvegarde
postSchema.pre('validate', function () {
  const p = this.get('covoiturage.departureCoords');
  const ok = this.type === 'covoiturage' && p &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

  if (ok) this.set('covoiturage.departureGeo', { type: 'Point', coordinates: [p.lng, p.lat] });
  else if (this.type === 'covoiturage') this.set('covoiturage.departureGeo', undefined);
});
postSchema.index({ title: 'text', description: 'text', tags: 'text' });
postSchema.index({ type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
module.exports.POST_TYPES = POST_TYPES;
