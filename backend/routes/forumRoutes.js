const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const post = require('../controllers/postController');
const comment = require('../controllers/commentController');

const router = express.Router();

// Mounted at /api (forum: /api/posts/... and /api/comments/:id). Signed-in users only: posts can hold phone
// numbers and names of students.
router.use(['/posts', '/comments'], requireAuth);

// ---------- Posts ----------
router.get('/posts', post.getPosts);
router.post('/posts', post.createPost);
router.get('/posts/me', post.getMyPosts); // before /posts/:id
router.get('/posts/:id', post.getPost);
router.put('/posts/:id', post.updatePost);
router.patch('/posts/:id/status', post.changeStatus);
router.delete('/posts/:id', post.deletePost);
router.post('/posts/:id/like', post.toggleLike);

// ---------- Comments ----------
router.get('/posts/:id/comments', comment.getComments);
router.post('/posts/:id/comments', comment.addComment);
router.delete('/comments/:id', comment.deleteComment);

module.exports = router;
