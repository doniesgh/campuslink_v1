const Post = require('../models/Post');
const RideSearch = require('../models/RideSearch');
const ai = require('./aiMatcher');
const { notifyUser } = require('./notifier');
const { haversineKm } = require('./matching')._internal;

const DEP_KM = 5; // le départ du trajet doit être à moins de 5 km
const ARR_KM = 5; // et l'arrivée aussi
const MIN_SCORE = 50;
const MAX_NOTIFICATIONS_PER_RIDE = 20;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round1 = (x) => Math.round(x * 10) / 10;

/** Départ 40 + arrivée 40 + heure 20 (0-100). */
function score(depKm, arrKm, minutes, windowMin) {
  return Math.round(40 * clamp01(1 - depKm / DEP_KM) + 40 * clamp01(1 - arrKm / ARR_KM) + 20 * clamp01(1 - minutes / windowMin));
}

/** Trajets publiés qui correspondent à une recherche (le départ proche d'abord via $geoNear). */
async function ridesForSearch(search) {
  const g = search.departureGeo && search.departureGeo.coordinates;
  const win = search.windowMin || 90;
  const when = new Date(search.when);
  if (!g || !search.destinationCoords || +when + win * 60000 < Date.now()) return [];

  const rides = await Post.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: g },
        key: 'covoiturage.departureGeo',
        distanceField: 'depM',
        maxDistance: DEP_KM * 1000,
        spherical: true,
        query: {
          type: 'covoiturage',
          status: 'active',
          author: { $ne: search.user },
          'covoiturage.seats': { $gte: search.seats || 1 },
          'covoiturage.departureDate': { $gte: new Date(Math.max(Date.now(), +when - win * 60000)), $lte: new Date(+when + win * 60000) },
        },
      },
    },
    { $limit: 30 },
    { $project: { likes: 0 } },
  ]);
  await Post.populate(rides, { path: 'author', select: 'firstname lastname avatar' });

  return rides
    .map((r) => {
      const c = r.covoiturage || {};
      if (!c.destinationCoords) return null;
      if (search.maxPrice != null && (c.price || 0) > search.maxPrice) return null;
      const depKm = r.depM / 1000;
      const arrKm = haversineKm(search.destinationCoords.lat, search.destinationCoords.lng, c.destinationCoords.lat, c.destinationCoords.lng);
      if (arrKm > ARR_KM) return null;
      const minutes = Math.abs(new Date(c.departureDate) - when) / 60000;
      const s = score(depKm, arrKm, minutes, win);
      return s < MIN_SCORE ? null : { post: r, score: s, departureKm: round1(depKm), arrivalKm: round1(arrKm), minutesApart: Math.round(minutes) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/** Recherches actives qui correspondent à un trajet qui vient d'être publié. */
async function searchesForRide(post) {
  const c = post.covoiturage || {};
  const g = c.departureGeo && c.departureGeo.coordinates;
  if (!g || !c.destinationCoords || !c.departureDate) return [];
  const date = new Date(c.departureDate);

  const searches = await RideSearch.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: g },
        key: 'departureGeo',
        distanceField: 'depM',
        maxDistance: DEP_KM * 1000,
        spherical: true,
        query: {
          status: 'active',
          user: { $ne: post.author },
          seats: { $lte: c.seats || 0 },
          when: { $gte: new Date(Math.max(Date.now(), +date - 360 * 60000)), $lte: new Date(+date + 360 * 60000) },
          notifiedPosts: { $ne: post._id },
        },
      },
    },
    { $limit: 50 },
  ]);

  return searches
    .map((s) => {
      if (!s.destinationCoords) return null;
      const minutes = Math.abs(date - new Date(s.when)) / 60000;
      if (minutes > (s.windowMin || 90)) return null;
      if (s.maxPrice != null && (c.price || 0) > s.maxPrice) return null;
      const depKm = s.depM / 1000;
      const arrKm = haversineKm(s.destinationCoords.lat, s.destinationCoords.lng, c.destinationCoords.lat, c.destinationCoords.lng);
      if (arrKm > ARR_KM) return null;
      const sc = score(depKm, arrKm, minutes, s.windowMin || 90);
      return sc < MIN_SCORE ? null : { search: s, score: sc, departureKm: round1(depKm), arrivalKm: round1(arrKm), minutesApart: Math.round(minutes) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

/**
 * À appeler (sans await) après la création d'un covoiturage : prévient les personnes dont une recherche correspond.
 * Le texte de la notification est écrit par l'IA quand elle est disponible (sinon un texte standard).
 */
async function notifyRideSearchers(req, post) {
  const matches = (await searchesForRide(post)).slice(0, MAX_NOTIFICATIONS_PER_RIDE);
  const c = post.covoiturage;

  for (const m of matches) {
    const fallback = `${c.departure} → ${c.destination} · ${c.seats} seat${c.seats === 1 ? '' : 's'} left`;
    const sentence = m.score >= 70
      ? await ai.explainRideMatch(
          { departure: m.search.departure, destination: m.search.destination, when: m.search.when, note: m.search.note },
          { departure: c.departure, destination: c.destination, date: c.departureDate, seatsLeft: c.seats, price: c.price, departureKm: m.departureKm, arrivalKm: m.arrivalKm, minutesApart: m.minutesApart }
        )
      : null;

    await notifyUser(req, m.search.user, {
      type: 'ride:match',
      title: 'A ride matches your search',
      body: sentence || fallback,
      data: { postId: post._id, searchId: m.search._id, score: m.score },
    });
    await RideSearch.updateOne({ _id: m.search._id }, { $addToSet: { notifiedPosts: post._id } });
  }
  return matches.length;
}

module.exports = { ridesForSearch, searchesForRide, notifyRideSearchers, _internal: { score } };
