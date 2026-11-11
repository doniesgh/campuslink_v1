const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/requireAuth');
const post = require('../controllers/postController');
const comment = require('../controllers/commentController');
const reservation = require('../controllers/reservationController'); // demandes de places
const match = require('../controllers/matchController'); 

router.get('/', post.getPosts);                              // liste + filtres + recherche
router.get('/me', requireAuth, post.getMyPosts);             // mes annonces (avant /:id !)
router.get('/nearby', requireAuth, post.getNearbyRides); 

router.get('/reservations/received', requireAuth, reservation.getReceived);
router.get('/reservations/me', requireAuth, reservation.getMyReservations);
router.put('/reservations/:rid', requireAuth, reservation.updateReservation); 
router.get('/:id/reservations', requireAuth, reservation.listForPost);
router.post('/:id/reservations', requireAuth,  reservation.requestSeat);

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