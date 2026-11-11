const mongoose = require('mongoose');
const RideSearch = require('../models/RideSearch');
const { ridesForSearch } = require('../service/rideMatching');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const validCoords = (c) =>
  c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)) && Math.abs(Number(c.lat)) <= 90 && Math.abs(Number(c.lng)) <= 180;
const MAX_ACTIVE_SEARCHES = 5;

// POST /api/posts/searches
exports.createSearch = async (req, res) => {
  try {
    const b = req.body || {};
    const departure = String(b.departure || '').trim();
    const destination = String(b.destination || '').trim();
    if (!departure || !destination) return res.status(400).json({ message: 'Départ et destination requis' });
    if (!validCoords(b.departureCoords) || !validCoords(b.destinationCoords)) {
      return res.status(400).json({ message: 'Choisissez le départ et la destination sur la carte' });
    }
    const when = new Date(b.when);
    const windowMin = Math.min(Math.max(parseInt(b.windowMin) || 90, 15), 360);
    if (Number.isNaN(+when) || +when + windowMin * 60000 < Date.now()) return res.status(400).json({ message: 'Choisissez une date future' });

    const active = await RideSearch.countDocuments({ user: req.user._id, status: 'active', when: { $gte: new Date() } });
    if (active >= MAX_ACTIVE_SEARCHES) return res.status(409).json({ message: `Maximum ${MAX_ACTIVE_SEARCHES} recherches actives` });

    const maxPrice = b.maxPrice === undefined || b.maxPrice === '' || b.maxPrice === null ? undefined : Number(b.maxPrice);
    if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) return res.status(400).json({ message: 'Prix maximum invalide' });

    const search = await RideSearch.create({
      user: req.user._id,
      departure,
      destination,
      departureCoords: { lat: Number(b.departureCoords.lat), lng: Number(b.departureCoords.lng) },
      destinationCoords: { lat: Number(b.destinationCoords.lat), lng: Number(b.destinationCoords.lng) },
      when,
      windowMin,
      seats: Math.min(Math.max(parseInt(b.seats) || 1, 1), 8),
      maxPrice,
      note: b.note ? String(b.note).slice(0, 300) : undefined,
    });
    const obj = search.toObject();
    res.status(201).json({ search: obj, matches: await ridesForSearch(obj) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/posts/searches — mes recherches, avec les trajets qui correspondent déjà
exports.listMySearches = async (req, res) => {
  try {
    const searches = await RideSearch.find({ user: req.user._id, status: { $ne: 'cancelled' } }).sort({ when: -1 }).limit(30).lean();
    const result = await Promise.all(
      searches.map(async (s) => ({ search: s, matches: s.status === 'active' ? await ridesForSearch(s) : [] }))
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// PUT /api/posts/searches/:sid   { action: 'cancel' }
exports.cancelSearch = async (req, res) => {
  try {
    if (!isValidId(req.params.sid)) return res.status(400).json({ message: 'ID invalide' });
    if ((req.body || {}).action !== 'cancel') return res.status(400).json({ message: 'Action invalide' });
    const search = await RideSearch.findOneAndUpdate(
      { _id: req.params.sid, user: req.user._id, status: 'active' },
      { status: 'cancelled' },
      { returnDocument: 'after' }
    );
    if (!search) return res.status(404).json({ message: 'Recherche introuvable' });
    res.json(search);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
