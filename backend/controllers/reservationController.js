const mongoose = require('mongoose');
const Post = require('../models/Post');
const Reservation = require('../models/Reservation');
const { notifyUser } = require('../service/notifier');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const same = (a, b) => String(a) === String(b);

async function routeOf(postId) {
  const p = await Post.findById(postId).select('covoiturage.departure covoiturage.destination').lean();
  const c = (p && p.covoiturage) || {};
  return `${c.departure || '?'} → ${c.destination || '?'}`;
}

// POST /api/posts/:id/reservations   { seats, message }
exports.requestSeat = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
    const post = await Post.findById(req.params.id).lean();
    if (!post || post.type !== 'covoiturage') return res.status(404).json({ message: 'Covoiturage introuvable' });

    if (same(post.author, req.user._id)) return res.status(400).json({ message: 'Vous ne pouvez pas réserver votre propre trajet' });
    if (post.status !== 'active') return res.status(409).json({ message: "Ce trajet n'accepte plus de demandes" });
    const c = post.covoiturage || {};
    if (c.departureDate && new Date(c.departureDate) < new Date()) return res.status(409).json({ message: 'Ce trajet est déjà parti' });

    const seats = Math.min(Math.max(parseInt(req.body.seats) || 1, 1), 8);
    if ((c.seats || 0) < seats) return res.status(409).json({ message: 'Plus assez de places disponibles' });

    const existing = await Reservation.findOne({ post: post._id, passenger: req.user._id, status: { $in: ['pending', 'accepted'] } });
    if (existing) return res.status(409).json({ message: 'Vous avez déjà une demande pour ce trajet' });

    const reservation = await Reservation.create({
      post: post._id,
      passenger: req.user._id,
      driver: post.author,
      seats,
      message: req.body.message ? String(req.body.message).slice(0, 300) : undefined,
    });

    await notifyUser(req, post.author, {
      type: 'reservation:new',
      title: 'New seat request',
      body: `${seats} seat${seats === 1 ? '' : 's'} · ${c.departure} → ${c.destination}`,
      data: { postId: post._id, reservationId: reservation._id },
    });
    res.status(201).json(reservation);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/posts/:id/reservations — conducteur : toutes les demandes ; autre utilisateur : les siennes
exports.listForPost = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
    const post = await Post.findById(req.params.id).select('author type').lean();
    if (!post || post.type !== 'covoiturage') return res.status(404).json({ message: 'Covoiturage introuvable' });

    const isDriver = same(post.author, req.user._id);
    const filter = isDriver ? { post: post._id } : { post: post._id, passenger: req.user._id };
    const reservations = await Reservation.find(filter).sort({ createdAt: -1 }).populate('passenger', 'firstname lastname avatar').lean();
    res.json({ role: isDriver ? 'driver' : 'passenger', reservations });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// PUT /api/posts/reservations/:rid   { action: 'accept' | 'reject' | 'cancel' }
exports.updateReservation = async (req, res) => {
  try {
    const { rid } = req.params;
    const { action } = req.body;
    if (!isValidId(rid)) return res.status(400).json({ message: 'ID invalide' });
    if (!['accept', 'reject', 'cancel'].includes(action)) return res.status(400).json({ message: 'Action invalide' });

    // --- Le passager annule sa demande (en attente ou déjà acceptée) ---
    if (action === 'cancel') {
      const prev = await Reservation.findOneAndUpdate(
        { _id: rid, passenger: req.user._id, status: { $in: ['pending', 'accepted'] } },
        { status: 'cancelled' },
        { returnDocument: 'before' } // état d'avant : sait s'il faut rendre les places
      );
      if (!prev) return res.status(404).json({ message: 'Demande introuvable ou déjà terminée' });
      if (prev.status === 'accepted') {
        await Post.updateOne({ _id: prev.post }, { $inc: { 'covoiturage.seats': prev.seats } });
      }
      await notifyUser(req, prev.driver, {
        type: 'reservation:cancelled',
        title: 'A seat request was cancelled',
        body: await routeOf(prev.post),
        data: { postId: prev.post, reservationId: prev._id },
      });
      return res.json({ ...prev.toObject(), status: 'cancelled' });
    }

    // --- Le conducteur accepte ou refuse (demande en attente seulement) ---
    const reservation = await Reservation.findOneAndUpdate(
      { _id: rid, driver: req.user._id, status: 'pending' },
      { status: action === 'accept' ? 'accepted' : 'rejected' },
      { returnDocument: 'after' }
    );
    if (!reservation) return res.status(404).json({ message: 'Demande introuvable ou déjà traitée' });

    if (action === 'accept') {
      // Décrémentation atomique : échoue s'il ne reste pas assez de places
      const post = await Post.findOneAndUpdate(
        { _id: reservation.post, status: 'active', 'covoiturage.seats': { $gte: reservation.seats } },
        { $inc: { 'covoiturage.seats': -reservation.seats } },
        { returnDocument: 'after' }
      );
      if (!post) {
        await Reservation.updateOne({ _id: reservation._id }, { status: 'pending' }); // on annule l'acceptation
        return res.status(409).json({ message: 'Plus assez de places disponibles' });
      }
      // Trajet complet : les autres demandes en attente sont refusées
      if (post.covoiturage.seats === 0) {
        await Reservation.updateMany({ post: post._id, status: 'pending' }, { status: 'rejected' });
      }
    }

    await notifyUser(req, reservation.passenger, {
      type: `reservation:${reservation.status}`,
      title: action === 'accept' ? 'Your seat request was accepted' : 'Your seat request was declined',
      body: await routeOf(reservation.post),
      data: { postId: reservation.post, reservationId: reservation._id },
    });
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/posts/reservations/me — les demandes que j'ai envoyées
exports.getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({ passenger: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('post', 'title status covoiturage')
      .lean();
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/posts/reservations/received — les demandes reçues sur mes trajets
exports.getReceived = async (req, res) => {
  try {
    const reservations = await Reservation.find({ driver: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('passenger', 'firstname lastname avatar')
      .populate('post', 'title status covoiturage')
      .lean();
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
