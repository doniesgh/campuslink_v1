const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { assertObjectId, isBlank, notFound, parsePagination, validationError } = require('../utils/validation');
const { assertCanManage } = require('./postController');

const AUTHOR_FIELDS = 'firstname lastname';

const assertPostExists = async (id) => {
  assertObjectId(id);
  if (!(await Post.exists({ _id: id }))) throw notFound('Post');
};

// POST /api/posts/:id/comments { content, parent? } → 201 comment (author populated).
// Replies are one level deep: `parent` must be a top-level comment of the same post.
const addComment = async (req, res) => {
  const { content, parent } = req.body ?? {};
  await assertPostExists(req.params.id);
  if (isBlank(content) || typeof content !== 'string') throw validationError({ content: 'content is required' });

  if (parent) {
    assertObjectId(parent);
    const parentComment = await Comment.findOne({ _id: parent, post: req.params.id, parent: null });
    if (!parentComment) throw notFound('Parent comment');
  }

  const comment = await Comment.create({
    post: req.params.id,
    author: req.user._id,
    content,
    parent: parent || null,
  });
  await Post.updateOne({ _id: req.params.id }, { $inc: { commentsCount: 1 } });

  const saved = await Comment.findById(comment._id).select('-__v').populate('author', AUTHOR_FIELDS).lean();
  res.status(201).json(saved);
};

// GET /api/posts/:id/comments?page=&limit= → { comments, page, pages, total }, oldest first.
const getComments = async (req, res) => {
  await assertPostExists(req.params.id);
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

  const [comments, total] = await Promise.all([
    Comment.find({ post: req.params.id })
      .select('-__v')
      .populate('author', AUTHOR_FIELDS)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments({ post: req.params.id }),
  ]);

  res.status(200).json({ comments, page, pages: Math.ceil(total / limit), total });
};

// DELETE /api/comments/:id (author or admin): the comment and its replies → 204
const deleteComment = async (req, res) => {
  assertObjectId(req.params.id);
  const comment = await Comment.findById(req.params.id);
  if (!comment) throw notFound('Comment');
  assertCanManage(req.user, comment);

  const { deletedCount } = await Comment.deleteMany({ $or: [{ _id: comment._id }, { parent: comment._id }] });
  await Post.updateOne({ _id: comment.post }, { $inc: { commentsCount: -deletedCount } });

  res.status(204).end();
};

module.exports = { addComment, getComments, deleteComment };
