const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { POST_TYPES } = require('../models/Post');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Champs modifiables par l'auteur
const EDITABLE = [
  'title', 'description', 'tags', 'images', 'location',
  'covoiturage', 'objetPerdu', 'status',
];
// Vérifie si l'utilisateur est l'auteur du contenu ou un administrateur
const assertCanManage = (user, document) => {
  const isOwner = document.author.equals(user._id);
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    const error = new Error('Action non autorisée');
    error.status = 403;
    throw error;
  }
};
// POST /api/posts
exports.createPost = async (req, res) => {
  try {
    const { type, title, description } = req.body;

    if (!POST_TYPES.includes(type)) {
      return res.status(400).json({ message: `Type invalide. Valeurs : ${POST_TYPES.join(', ')}` });
    }
    if (!title || !description) {
      return res.status(400).json({ message: 'Titre et description obligatoires' });
    }
    if (type === 'covoiturage') {
      const c = req.body.covoiturage || {};
      if (!c.departure || !c.destination || !c.departureDate || !c.seats) {
        return res.status(400).json({ message: 'Covoiturage : départ, destination, date et places requis' });
      }
    }
    if (type === 'objet_perdu') {
      const o = req.body.objetPerdu || {};
      if (!['perdu', 'trouve'].includes(o.kind)) {
        return res.status(400).json({ message: "Objet : kind doit être 'perdu' ou 'trouve'" });
      }
    }

    const data = { type, author: req.user._id };
    EDITABLE.forEach((f) => { if (req.body[f] !== undefined && f !== 'status') data[f] = req.body[f]; });

    const post = await Post.create(data);
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/posts?type=&status=&q=&tag=&author=&page=&limit=&sort=
exports.getPosts = async (req, res) => {
  try {
    const { type, status = 'active', q, tag, author, sort = 'recent' } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const filter = {};
    if (type) filter.type = type;
    if (status !== 'all') filter.status = status;
    if (tag) filter.tags = tag.toLowerCase();
    if (author && isValidId(author)) filter.author = author;
    if (q) filter.$text = { $search: q };

    const sortBy = sort === 'popular' ? { likesCount: -1, createdAt: -1 } : { createdAt: -1 };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('author', 'firstname lastname')
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    res.json({ posts, page, pages: Math.ceil(total / limit), total });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};


// GET /api/posts/:id
exports.getPost = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "ID invalide" });
    }

    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { returnDocument: 'after' }
    ).populate("author", "firstname lastname name avatar");

    if (!post) {
      return res.status(404).json({
        message: "Annonce introuvable",
      });
    }

    return res.json(post);
  } catch (err) {
    return res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
    });
  }
};


// PUT /api/posts/:id  (auteur ou admin)
exports.updatePost = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Annonce introuvable' });

    const isOwner = post.author.equals(req.user._id);
    if (!isOwner && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Action non autorisée' });
    }

    EDITABLE.forEach((f) => { if (req.body[f] !== undefined) post[f] = req.body[f]; });
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// DELETE /api/posts/:id  (auteur ou admin)
exports.deletePost = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Annonce introuvable' });

    const isOwner = post.author.equals(req.user._id);
    if (!isOwner && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Action non autorisée' });
    }

    await Promise.all([post.deleteOne(), Comment.deleteMany({ post: post._id })]);
    res.json({ message: 'Annonce supprimée' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// POST /api/posts/:id/like  (toggle)
exports.toggleLike = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Annonce introuvable' });

    const idx = post.likes.findIndex((u) => u.equals(req.user._id));
    if (idx === -1) post.likes.push(req.user._id);
    else post.likes.splice(idx, 1);

    post.likesCount = post.likes.length;
    await post.save();

    res.json({ liked: idx === -1, likesCount: post.likesCount });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// PATCH /api/posts/:id/status  { status: 'active' | 'closed' | 'resolved' }
exports.changeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'closed', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Annonce introuvable' });

    if (!post.author.equals(req.user._id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Action non autorisée' });
    }
    post.status = status;
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/posts/me
// GET /api/posts/me
exports.getMyPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 8, 50);

    const { type, status = 'all', q, tag } = req.query;

    const filter = {
      author: req.user._id,
    };

    if (type) filter.type = type;

    if (status !== 'all') {
      filter.status = status;
    }

    if (tag) {
      filter.tags = tag.toLowerCase();
    }

    if (q) {
      filter.$text = { $search: q };
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('author', 'firstname lastname name avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Post.countDocuments(filter),
    ]);

    res.json({
      posts,
      page,
      pages: Math.ceil(total / limit),
      total,
    });

  } catch (err) {
    res.status(500).json({
      message: 'Erreur lors de la récupération de vos publications',
      error: err.message,
    });
  }
};

///////////: RIDES //////////
// GET /api/posts/nearby?lat=&lng=&radiusKm=20&seats=1
exports.getNearbyRides = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ message: 'Coordonnées invalides' });
    }
    const radiusKm = Math.min(Math.max(parseFloat(req.query.radiusKm) || 20, 1), 200);
    const seats = Math.max(parseInt(req.query.seats) || 1, 1);

    const rides = await Post.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          key: 'covoiturage.departureGeo',
          distanceField: 'distanceM',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: {
            type: 'covoiturage',
            status: 'active',
            'covoiturage.departureDate': { $gte: new Date() },
            'covoiturage.seats': { $gte: seats },
          },
        },
      },
      { $limit: 50 },
      { $project: { likes: 0 } },
    ]);
    await Post.populate(rides, { path: 'author', select: 'firstname lastname avatar' });

    // awayKm = distance entre l'utilisateur et le départ (≠ covoiturage.distanceKm, longueur du trajet)
    res.json(rides.map((r) => ({ ...r, awayKm: Math.round(r.distanceM / 100) / 10 })));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/* ---------- Matching objets perdus / trouvés ---------- */
const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const tokens = (s) => new Set(norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
const overlap = (a, b) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  a.forEach((w) => b.has(w) && n++);
  return n / Math.min(a.size, b.size);
};
const MIN_SCORE = 50;

// GET /api/posts/:id/matches  (objet perdu -> objets trouvés, et inversement)
exports.getMatches = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
    const post = await Post.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ message: 'Annonce introuvable' });
    if (post.type !== 'objet_perdu' || !post.objetPerdu?.kind) {
      return res.status(400).json({ message: "Réservé aux annonces d'objets perdus/trouvés" });
    }

    const me = post.objetPerdu;
    const opposite = me.kind === 'perdu' ? 'trouve' : 'perdu';
    const candidates = await Post.find({
      _id: { $ne: post._id },
      type: 'objet_perdu',
      status: 'active',
      'objetPerdu.kind': opposite,
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('author', 'firstname lastname avatar')
      .lean();

    const myText = tokens(`${post.title} ${post.description} ${(post.tags || []).join(' ')}`);
    const myPlace = tokens(me.place);

    const matches = candidates
      .map((c) => {
        const o = c.objetPerdu || {};
        const reasons = [];
        let score = 0;

        if (me.category && o.category && norm(me.category).trim() === norm(o.category).trim()) {
          score += 40;
          reasons.push('Même catégorie');
        }
        if (me.date && o.date) {
          const days = Math.abs(new Date(me.date) - new Date(o.date)) / 86400000;
          if (days <= 14) {
            score += Math.round(25 * (1 - days / 14));
            reasons.push(days < 1 ? 'Même jour' : `${Math.round(days)} jour(s) d'écart`);
          }
        }
        const p = overlap(myPlace, tokens(o.place));
        if (p > 0) { score += Math.round(20 * p); reasons.push('Lieu similaire'); }

        const t = overlap(myText, tokens(`${c.title} ${c.description} ${(c.tags || []).join(' ')}`));
        if (t > 0) { score += Math.round(15 * t); reasons.push('Description proche'); }

        return { post: c, score, reasons };
      })
      .filter((m) => m.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({ matches });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
exports.assertCanManage = assertCanManage;