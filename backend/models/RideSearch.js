const mongoose = require('mongoose');

// « Je cherche un covoiturage » : une demande de trajet que le système surveille.
const rideSearchSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    departure: { type: String, required: true, trim: true, maxlength: 120 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },
    departureCoords: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    destinationCoords: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    // GeoJSON calculé à partir de departureCoords (pour $geoNear)
    departureGeo: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined },
    },
    when: { type: Date, required: true, index: true }, // heure de départ souhaitée
    windowMin: { type: Number, min: 15, max: 360, default: 90 }, // flexibilité (± minutes)
    seats: { type: Number, min: 1, max: 8, default: 1 },
    maxPrice: { type: Number, min: 0 },
    note: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ['active', 'cancelled', 'matched'], default: 'active', index: true },
    notifiedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }], // évite de prévenir deux fois pour le même trajet
  },
  { timestamps: true }
);

rideSearchSchema.index({ departureGeo: '2dsphere' });

rideSearchSchema.pre('validate', function () {
  const p = this.departureCoords;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
    this.departureGeo = { type: 'Point', coordinates: [p.lng, p.lat] };
  }
});

module.exports = mongoose.model('RideSearch', rideSearchSchema);
