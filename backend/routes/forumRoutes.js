
// const express = require('express');
// const router = express.Router();

// const { requireAuth } = require('../middleware/requireAuth');
// const post = require('../controllers/postController');
// const comment = require('../controllers/commentController');

// // ---------- Annonces ----------
// router.get('/', post.getPosts);                          // liste + filtres + recherche
// router.get('/me', requireAuth, post.getMyPosts);         // mes annonces (avant /:id !)
// router.get('/nearby', requireAuth, post.getNearbyRides); // NOUVEAU : covoiturages près de moi (avant /:id !)
// router.get('/:id/matches', requireAuth, post.getMatches);// NOUVEAU : correspondances objets perdus/trouvés
// router.get('/:id', post.getPost);
// router.post('/', requireAuth, post.createPost);
// router.put('/:id', requireAuth, post.updatePost);
// router.patch('/:id/status', requireAuth, post.changeStatus);
// router.delete('/:id', requireAuth, post.deletePost);
// router.post('/:id/like', requireAuth, post.toggleLike);

// // ---------- Commentaires ----------
// router.get('/:postId/comments', comment.getComments);
// router.post('/:postId/comments', requireAuth, comment.addComment);
// router.delete('/comments/:id', requireAuth, comment.deleteComment);

// module.exports = router;
const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/requireAuth');
const post = require('../controllers/postController');
const comment = require('../controllers/commentController');
const reservation = require('../controllers/reservationController'); // demandes de places
const match = require('../controllers/matchController');             // correspondances (IA) + trajets compatibles

// ---------- Annonces ----------
router.get('/', post.getPosts);                              // liste + filtres + recherche
router.get('/me', requireAuth, post.getMyPosts);             // mes annonces (avant /:id !)
router.get('/nearby', requireAuth, post.getNearbyRides);     // covoiturages près de moi (avant /:id !)

// ---------- Réservations de places (avant /:id !) ----------
router.get('/reservations/me', requireAuth, reservation.getMyReservations);
router.put('/reservations/:rid', requireAuth, reservation.updateReservation); // accept | reject | cancel
router.get('/:id/reservations', requireAuth, reservation.listForPost);
router.post('/:id/reservations', requireAuth, reservation.requestSeat);

// ---------- Matching ----------
router.get('/:id/matches', requireAuth, match.getMatches);           // objets perdus/trouvés
router.get('/:id/compatible', requireAuth, match.getCompatibleRides); // covoiturages compatibles

router.get('/:id', post.getPost);
router.post('/', requireAuth, post.createPost);
router.put('/:id', requireAuth, post.updatePost);
router.patch('/:id/status', requireAuth, post.changeStatus);
router.delete('/:id', requireAuth, post.deletePost);
router.post('/:id/like', requireAuth, post.toggleLike);

// ---------- Commentaires ----------
router.get('/:id/comments', comment.getComments);
router.post('/:id/comments', requireAuth, comment.addComment);
router.delete('/comments/:id', requireAuth, comment.deleteComment);
router.put('/comments/:id', requireAuth, comment.updateComment);
module.exports = router;