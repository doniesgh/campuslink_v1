const Post = require('../models/Post');
const ai = require('./aiMatcher');

/* ---------- utilitaires de texte ---------- */
const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const tokens = (s) => new Set(norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
const overlap = (a, b) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  a.forEach((w) => b.has(w) && n++);
  return n / Math.min(a.size, b.size);
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/* ---------- 1. Objets perdus / trouvés ---------- */

/** Score par règles (0-100) : catégorie 40, date 25, lieu 20, texte 15. */
function ruleScore(src, cand) {
  const me = src.objetPerdu || {};
  const o = cand.objetPerdu || {};
  const reasons = [];
  let score = 0;
  let daysApart = null;

  if (me.category && o.category && norm(me.category).trim() === norm(o.category).trim()) {
    score += 40;
    reasons.push('Same category');
  }
  if (me.date && o.date) {
    daysApart = Math.abs(new Date(me.date) - new Date(o.date)) / 86400000;
    if (daysApart <= 14) {
      score += Math.round(25 * (1 - daysApart / 14));
      reasons.push(daysApart < 1 ? 'Same day' : `${Math.round(daysApart)} day(s) apart`);
    }
  }
  const p = overlap(tokens(me.place), tokens(o.place));
  if (p > 0) { score += Math.round(20 * p); reasons.push('Similar place'); }

  const t = overlap(
    tokens(`${src.title} ${src.description} ${(src.tags || []).join(' ')}`),
    tokens(`${cand.title} ${cand.description} ${(cand.tags || []).join(' ')}`)
  );
  if (t > 0) { score += Math.round(15 * t); reasons.push('Similar description'); }

  return { score, reasons, daysApart };
}

const MIN_FINAL_SCORE = 50;
const AI_CANDIDATES = 8;

/**
 * Candidats par règles, puis réordonnés par l'IA quand elle est disponible
 * (score final = 30 % règles + 70 % IA). Sans IA : règles seules.
 */
async function findLostFound(post, { userId, useAI = true } = {}) {
  const me = post.objetPerdu || {};
  if (!['perdu', 'trouve'].includes(me.kind)) return { matches: [], ai: false };

  const pool = await Post.find({
    _id: { $ne: post._id },
    type: 'objet_perdu',
    status: 'active',
    'objetPerdu.kind': me.kind === 'perdu' ? 'trouve' : 'perdu',
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('author', 'firstname lastname avatar')
    .lean();

  const scored = pool
    .map((c) => ({ post: c, ...ruleScore(post, c) }))
    .filter((x) => x.daysApart === null || x.daysApart <= 30) // objets déclarés à plus d'un mois d'écart : improbable
    .sort((a, b) => b.score - a.score);

  let aiMap = null;
  if (useAI && ai.isEnabled()) {
    aiMap = await ai.rerankLostFound(post, scored.slice(0, AI_CANDIDATES).map((x) => x.post), userId);
  }

  const considered = aiMap ? scored.slice(0, AI_CANDIDATES) : scored;
  const matches = considered
    .map(({ post: c, score, reasons }) => {
      const verdict = aiMap && aiMap.get(String(c._id));
      return {
        post: c,
        score: verdict ? Math.round(0.3 * score + 0.7 * verdict.score) : score,
        reasons,
        ai: Boolean(verdict),
        aiReason: verdict ? verdict.reason : undefined,
      };
    })
    .filter((m) => m.score >= MIN_FINAL_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { matches, ai: Boolean(aiMap) };
}

/* ---------- 2. Covoiturages compatibles ---------- */

/**
 * Autres trajets actifs qui partent près d'ici, arrivent près d'ici et à une heure proche.
 * Score : départ 40 + arrivée 40 + heure 20. Nécessite les coordonnées (trip map).
 */
async function findCompatibleRides(post, { departureKm = 3, arrivalKm = 5, windowMin = 90 } = {}) {
  const c = post.covoiturage || {};
  const start = c.departureGeo && c.departureGeo.coordinates;
  const end = c.destinationCoords;
  if (!start || !end || !c.departureDate) return [];

  const when = new Date(c.departureDate);
  const from = new Date(Math.max(Date.now(), +when - windowMin * 60000));
  const to = new Date(+when + windowMin * 60000);

  const rides = await Post.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: start },
        key: 'covoiturage.departureGeo',
        distanceField: 'departureM',
        maxDistance: departureKm * 1000,
        spherical: true,
        query: {
          _id: { $ne: post._id },
          type: 'covoiturage',
          status: 'active',
          'covoiturage.seats': { $gte: 1 },
          'covoiturage.departureDate': { $gte: from, $lte: to },
        },
      },
    },
    { $limit: 30 },
    { $project: { likes: 0 } },
  ]);
  await Post.populate(rides, { path: 'author', select: 'firstname lastname avatar' });

  return rides
    .map((r) => {
      const d = r.covoiturage || {};
      if (!d.destinationCoords) return null;
      const depKm = r.departureM / 1000;
      const arrKm = haversineKm(end.lat, end.lng, d.destinationCoords.lat, d.destinationCoords.lng);
      if (arrKm > arrivalKm) return null;
      const minutes = Math.abs(new Date(d.departureDate) - when) / 60000;
      const score = Math.round(40 * (1 - depKm / departureKm) + 40 * (1 - arrKm / arrivalKm) + 20 * (1 - minutes / windowMin));
      return {
        post: r,
        score,
        departureKm: Math.round(depKm * 10) / 10,
        arrivalKm: Math.round(arrKm * 10) / 10,
        minutesApart: Math.round(minutes),
      };
    })
    .filter((x) => x && x.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* ---------- 3. Automatique : prévenir les auteurs concernés dès qu'un post est créé ---------- */

/** À appeler après Post.create (sans await) : les auteurs d'objets compatibles reçoivent un événement socket.io « match:new ». */
async function notifyNewPost(req, post) {
  const io = req.app.get('io');
  if (!io || post.type !== 'objet_perdu') return;
  const { matches } = await findLostFound(post, { useAI: false }); // pas d'IA ici : pas de coût à chaque publication
  matches
    .filter((m) => m.score >= 60)
    .forEach((m) => {
      const authorId = m.post.author && (m.post.author._id || m.post.author);
      if (authorId) io.to(String(authorId)).emit('match:new', { postId: post._id, matchedPostId: m.post._id, score: m.score });
    });
}

module.exports = { findLostFound, findCompatibleRides, notifyNewPost, _internal: { ruleScore, haversineKm } };
