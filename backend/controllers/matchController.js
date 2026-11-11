const mongoose = require('mongoose');
const Post = require('../models/Post');
const matching = require('../service/matching');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/posts/:id/matches   (objet perdu <-> objet trouvé, avec IA si disponible)
exports.getMatches = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
    const post = await Post.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ message: 'Annonce introuvable' });
    if (post.type !== 'objet_perdu' || !post.objetPerdu || !post.objetPerdu.kind) {
      return res.status(400).json({ message: "Réservé aux annonces d'objets perdus/trouvés" });
    }
    res.json(await matching.findLostFound(post, { userId: req.user._id }));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/posts/:id/compatible   (covoiturages compatibles : départ, arrivée et heure proches)
exports.getCompatibleRides = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
    const post = await Post.findById(req.params.id).lean();
    if (!post || post.type !== 'covoiturage') return res.status(404).json({ message: 'Covoiturage introuvable' });
    res.json({ rides: await matching.findCompatibleRides(post) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
