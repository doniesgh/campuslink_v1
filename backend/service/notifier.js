const ForumNotification = require('../models/ForumNotification');

/**
 * Enregistre une notification et la pousse en temps réel (si le serveur socket.io est exposé via app.set('io', io)
 * et que les clients rejoignent une salle portant leur identifiant). Ne lève jamais d'erreur.
 */
async function notifyUser(req, userId, { type, title, body = '', data }) {
  try {
    const n = await ForumNotification.create({ user: userId, type, title, body, data });
    const io = req && req.app && req.app.get('io');
    if (io) io.to(String(userId)).emit('forum:notification', { id: n._id, type, title, body, data });
    return n;
  } catch (err) {
    console.warn('[notify]', err.message);
    return null;
  }
}

module.exports = { notifyUser };
