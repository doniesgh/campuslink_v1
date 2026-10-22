const express = require('express');
const router = express.Router();

// Adapte ce chemin à ton middleware d'authentification existant.
// Il doit renseigner req.user (avec _id et role).
const { requireAuth } = require('../middleware/requireAuth');
const post = require('../controllers/postController');
const comment = require('../controllers/commentController');

// ---------- Annonces ----------
router.get('/', post.getPosts);                    // liste + filtres + recherche
router.get('/posts/me', requireAuth, post.getMyPosts);      // mes annonces (avant /:id !)
router.get('/posts/:id', post.getPost);
router.post('/', requireAuth, post.createPost);
router.put('/posts/:id', requireAuth, post.updatePost);
router.patch('/posts/:id/status', requireAuth, post.changeStatus);
router.delete('/posts/:id', requireAuth, post.deletePost);
router.post('/posts/:id/like', requireAuth, post.toggleLike);

// ---------- Commentaires ----------
router.get('/posts/:postId/comments', comment.getComments);
router.post('/posts/:postId/comments', requireAuth, comment.addComment);
router.delete('/comments/:id', requireAuth, comment.deleteComment);

module.exports = router;

// Dans app.js / server.js :
//   app.use('/api', require('./routes/forumRoutes'));
