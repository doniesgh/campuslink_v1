const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/requireAuth');
const post = require('../controllers/postController');
const comment = require('../controllers/commentController');
const reservation = require('../controllers/reservationController'); // (ne pas l'appeler « res » : c'est le nom de la réponse HTTP)
const match = require('../controllers/matchController');
const rideSearch = require('../controllers/rideSearchController');
const notification = require('../controllers/forumNotificationController.js');

// ---------- Annonces ----------
router.get('/', post.getPosts);                          // liste + filtres + recherche
router.get('/me', requireAuth, post.getMyPosts);         // mes annonces (avant /:id !)
router.get('/nearby', requireAuth, post.getNearbyRides); // covoiturages près de moi (avant /:id !)

// ---------- Mon espace : tout ce qui est fixe doit rester AVANT /:id ----------
router.get('/reservations/me', requireAuth, reservation.getMyReservations);
router.get('/reservations/received', requireAuth, reservation.getReceived);
router.put('/reservations/:rid', requireAuth, reservation.updateReservation); // accept | reject | cancel

router.get('/searches', requireAuth, rideSearch.listMySearches);   // mes recherches de covoiturage
router.post('/searches', requireAuth, rideSearch.createSearch);    // « Look for a ride »
router.put('/searches/:sid', requireAuth, rideSearch.cancelSearch); // { action: 'cancel' }

router.get('/notifications', requireAuth, notification.list);
router.put('/notifications/read', requireAuth, notification.markRead);

// ---------- Sur un post ----------
router.get('/:id/reservations', requireAuth, reservation.listForPost);
router.post('/:id/reservations', requireAuth, reservation.requestSeat);
router.get('/:id/matches', requireAuth, match.getMatches);
router.get('/:id/compatible', requireAuth, match.getCompatibleRides);

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
