
const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/requireAuth');
const post = require('../controllers/postController');
const comment = require('../controllers/commentController');

// ---------- Annonces ----------
router.get('/', post.getPosts);                          // liste + filtres + recherche
router.get('/me', requireAuth, post.getMyPosts);         // mes annonces (avant /:id !)
router.get('/nearby', requireAuth, post.getNearbyRides); // NOUVEAU : covoiturages près de moi (avant /:id !)
router.get('/:id/matches', requireAuth, post.getMatches);// NOUVEAU : correspondances objets perdus/trouvés
router.get('/:id', post.getPost);
router.post('/', requireAuth, post.createPost);
router.put('/:id', requireAuth, post.updatePost);
router.patch('/:id/status', requireAuth, post.changeStatus);
router.delete('/:id', requireAuth, post.deletePost);
router.post('/:id/like', requireAuth, post.toggleLike);

// ---------- Commentaires ----------
router.get('/:postId/comments', comment.getComments);
router.post('/:postId/comments', requireAuth, comment.addComment);
router.delete('/comments/:id', requireAuth, comment.deleteComment);

module.exports = router;