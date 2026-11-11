const mongoose = require('mongoose');
const Post = require('../models/Post');
const Reservation = require('../models/Reservation');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const same = (a, b) => String(a) === String(b);

/** Notification temps réel (facultative) : ne fait rien si le serveur socket.io n'est pas exposé via app.set('io', io). */
function notify(req, userId, event, payload) {
  try {
    const io = req.app.get('io');
    if (io) io.to(String(userId)).emit(event, payload);
  } catch (_) { /* sans effet sur la réponse */ }
}

// POST /api/posts/:id/reservations   { seats, message }
// exports.requestSeat = async (req, res) => {
//     console.log('[reservation] requestSeat reçu', req.params.id, req.body, req.user && req.user._id);

//   try {
//     if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
//     const post = await Post.findById(req.params.id).lean();
//     if (!post || post.type !== 'covoiturage') return res.status(404).json({ message: 'Covoiturage introuvable' });

//     if (same(post.author, req.user._id)) return res.status(400).json({ message: 'Vous ne pouvez pas réserver votre propre trajet' });
//     if (post.status !== 'active') return res.status(409).json({ message: "Ce trajet n'accepte plus de demandes" });
//     const c = post.covoiturage || {};
//     if (c.departureDate && new Date(c.departureDate) < new Date()) return res.status(409).json({ message: 'Ce trajet est déjà parti' });

//     const seats = Math.min(Math.max(parseInt(req.body.seats) || 1, 1), 8);
//     if ((c.seats || 0) < seats) return res.status(409).json({ message: 'Plus assez de places disponibles' });

//     const existing = await Reservation.findOne({ post: post._id, passenger: req.user._id, status: { $in: ['pending', 'accepted'] } });
//     if (existing) return res.status(409).json({ message: 'Vous avez déjà une demande pour ce trajet' });

//     const reservation = await Reservation.create({
//       post: post._id,
//       passenger: req.user._id,
//       driver: post.author,
//       seats,
//       message: req.body.message ? String(req.body.message).slice(0, 300) : undefined,
//     });

//     notify(req, post.author, 'reservation:new', { reservationId: reservation._id, postId: post._id, seats });
//     res.status(201).json(reservation);
//   } catch (err) {
//     res.status(500).json({ message: 'Erreur serveur', error: err.message });
//   }
// };

exports.requestSeat = async (req, res) => {
  console.log(
    '[reservation] requestSeat reçu',
    req.params.id,
    req.body,
    req.user?._id
  );

  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'ID invalide'
      });
    }

    const post = await Post.findById(req.params.id).lean();

    if (!post || post.type !== 'covoiturage') {
      return res.status(404).json({
        message: 'Covoiturage introuvable'
      });
    }

    if (same(post.author, req.user._id)) {
      return res.status(400).json({
        message: 'Vous ne pouvez pas réserver votre propre trajet'
      });
    }

    if (post.status !== 'active') {
      return res.status(409).json({
        message: "Ce trajet n'accepte plus de demandes"
      });
    }

    const c = post.covoiturage || {};

    if (c.departureDate && new Date(c.departureDate) < new Date()) {
      return res.status(409).json({
        message: 'Ce trajet est déjà parti'
      });
    }

    const seats = Math.min(
      Math.max(parseInt(req.body.seats) || 1, 1),
      8
    );

    if ((c.seats || 0) < seats) {
      return res.status(409).json({
        message: 'Plus assez de places disponibles'
      });
    }

    // Vérifier les demandes existantes
    const existing = await Reservation.findOne({
      post: post._id,
      passenger: req.user._id,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existing) {
      return res.status(409).json({
        message: existing.status === 'pending'
          ? 'Votre demande est déjà en attente de confirmation'
          : 'Votre réservation est déjà acceptée',
        reservation: existing
      });
    }

    // Créer une nouvelle réservation
    const reservation = await Reservation.create({
      post: post._id,
      passenger: req.user._id,
      driver: post.author,
      seats,
      message: req.body.message
        ? String(req.body.message).slice(0, 300)
        : undefined
    });

    // Notification au conducteur
    notify(req, post.author, 'reservation:new', {
      reservationId: reservation._id,
      postId: post._id,
      seats
    });

    return res.status(201).json({
      message: 'Votre demande de réservation a été envoyée',
      reservation
    });

  } catch (err) {
    console.error('[reservation] requestSeat error:', err);

    return res.status(500).json({
      message: 'Erreur serveur',
      error: err.message
    });
  }
};

// GET /api/posts/:id/reservations
// Conducteur : toutes les demandes du trajet. Autre utilisateur : uniquement les siennes.
exports.listForPost = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
    const post = await Post.findById(req.params.id).select('author type').lean();
    if (!post || post.type !== 'covoiturage') return res.status(404).json({ message: 'Covoiturage introuvable' });

    const isDriver = same(post.author, req.user._id);
    const filter = isDriver ? { post: post._id } : { post: post._id, passenger: req.user._id };
    const reservations = await Reservation.find(filter)
      .sort({ createdAt: -1 })
      .populate('passenger', 'firstname lastname avatar')
      .lean();

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
        { returnDocument: 'before' } // renvoie l'état d'avant pour savoir s'il faut rendre les places
      );
      if (!prev) return res.status(404).json({ message: 'Demande introuvable ou déjà terminée' });
      if (prev.status === 'accepted') {
        await Post.updateOne({ _id: prev.post }, { $inc: { 'covoiturage.seats': prev.seats } });
      }
      notify(req, prev.driver, 'reservation:cancelled', { reservationId: prev._id, postId: prev.post });
      return res.json({ ...prev.toObject(), status: 'cancelled' });
    }

    // --- Le conducteur accepte ou refuse (une demande en attente seulement) ---
    const reservation = await Reservation.findOneAndUpdate(
      { _id: rid, driver: req.user._id, status: 'pending' },
      { status: action === 'accept' ? 'accepted' : 'rejected' },
      { returnDocument: 'after' }
    );
    if (!reservation) return res.status(404).json({ message: 'Demande introuvable ou déjà traitée' });

    if (action === 'accept') {
      // Décrémentation atomique : échoue s'il ne reste pas assez de places (deux acceptations simultanées impossibles)
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

    notify(req, reservation.passenger, `reservation:${reservation.status}`, { reservationId: reservation._id, postId: reservation.post });
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/posts/reservations/me  (mes demandes, avec le trajet)
exports.getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({ passenger: req.user._id })
      .sort({ createdAt: -1 })
      .populate('post', 'title status covoiturage')
      .lean();
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
