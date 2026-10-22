const Post = require('../models/Post');
const Comment = require('../models/Comment');
const HttpError = require('../utils/httpError');
const { assertObjectId, isBlank, notFound, parsePagination, validationError } = require('../utils/validation');

const { POST_TYPES, POST_STATUSES } = Post;
const AUTHOR_FIELDS = 'firstname lastname';
// Never sent to clients: who liked the post (only likesCount is public).
const HIDDEN_FIELDS = '-likes -__v';
// Fields the author (or an admin) can change. The type is chosen once, at creation.
const EDITABLE = ['title', 'description', 'tags', 'images', 'location', 'covoiturage', 'objetPerdu', 'status'];

// One string query parameter (repeated parameters such as ?tag=a&tag=b keep the first value).
const queryString = (value) => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.trim() !== '' ? first.trim() : undefined;
};

const findPost = async (id) => {
  assertObjectId(id);
  const post = await Post.findById(id);
  if (!post) throw notFound('Post');
  return post;
};

// The author of a post or comment, or an admin.
const assertCanManage = (user, doc) => {
  if (!doc.author.equals(user._id) && user.role !== 'ADMIN') {
    throw new HttpError(403, 'FORBIDDEN', 'Only the author or an admin can do this');
  }
};

const readPost = (id) => Post.findById(id).select(HIDDEN_FIELDS).populate('author', AUTHOR_FIELDS).lean();

// POST /api/posts
const createPost = async (req, res) => {
  const body = req.body ?? {};
  const { type } = body;
  const details = {};

  if (!POST_TYPES.includes(type)) details.type = `type must be one of ${POST_TYPES.join(', ')}`;
  if (isBlank(body.title)) details.title = 'title is required';
  if (isBlank(body.description)) details.description = 'description is required';
  if (type === 'covoiturage') {
    const trip = body.covoiturage ?? {};
    ['departure', 'destination', 'departureDate', 'seats'].forEach((field) => {
      if (isBlank(trip[field])) details[`covoiturage.${field}`] = `covoiturage.${field} is required`;
    });
  }
  if (type === 'objet_perdu' && !['perdu', 'trouve'].includes(body.objetPerdu?.kind)) {
    details['objetPerdu.kind'] = "objetPerdu.kind must be 'perdu' or 'trouve'";
  }
  if (Object.keys(details).length > 0) throw validationError(details);

  const data = { type, author: req.user._id };
  EDITABLE.forEach((field) => {
    if (body[field] !== undefined && field !== 'status') data[field] = body[field];
  });

  const post = await Post.create(data);
  res.status(201).json(post);
};

// GET /api/posts?type=&status=active|closed|resolved|all&q=&tag=&author=&sort=recent|popular&page=&limit=
const getPosts = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
  const type = queryString(req.query.type);
  const status = queryString(req.query.status) ?? 'active';
  const q = queryString(req.query.q);
  const tag = queryString(req.query.tag);
  const author = queryString(req.query.author);

  const filter = {};
  const details = {};
  if (type) {
    if (POST_TYPES.includes(type)) filter.type = type;
    else details.type = `type must be one of ${POST_TYPES.join(', ')}`;
  }
  if (status !== 'all') {
    if (POST_STATUSES.includes(status)) filter.status = status;
    else details.status = `status must be one of ${POST_STATUSES.join(', ')}, all`;
  }
  if (Object.keys(details).length > 0) throw validationError(details);
  if (tag) filter.tags = tag.toLowerCase();
  if (author) {
    assertObjectId(author);
    filter.author = author;
  }
  if (q) filter.$text = { $search: q };

  const sortBy = req.query.sort === 'popular' ? { likesCount: -1, createdAt: -1 } : { createdAt: -1 };
  const [posts, total] = await Promise.all([
    Post.find(filter).select(HIDDEN_FIELDS).populate('author', AUTHOR_FIELDS).sort(sortBy).skip(skip).limit(limit).lean(),
    Post.countDocuments(filter),
  ]);

  res.status(200).json({ posts, page, pages: Math.ceil(total / limit), total });
};

// GET /api/posts/:id — counts a view, except with ?view=0 (a refresh of the counters).
const getPost = async (req, res) => {
  assertObjectId(req.params.id);
  if (req.query.view !== '0') await Post.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
  const post = await readPost(req.params.id);
  if (!post) throw notFound('Post');
  res.status(200).json(post);
};

// PUT /api/posts/:id (author or admin)
const updatePost = async (req, res) => {
  const post = await findPost(req.params.id);
  assertCanManage(req.user, post);

  const body = req.body ?? {};
  EDITABLE.forEach((field) => {
    if (body[field] !== undefined) post[field] = body[field];
  });
  await post.save();
  res.status(200).json(await readPost(post._id));
};

// PATCH /api/posts/:id/status { status: 'active' | 'closed' | 'resolved' } (author or admin)
const changeStatus = async (req, res) => {
  const { status } = req.body ?? {};
  if (!POST_STATUSES.includes(status)) {
    throw validationError({ status: `status must be one of ${POST_STATUSES.join(', ')}` });
  }
  const post = await findPost(req.params.id);
  assertCanManage(req.user, post);

  post.status = status;
  await post.save();
  res.status(200).json(await readPost(post._id));
};

// DELETE /api/posts/:id (author or admin): the post and its comments → 204
const deletePost = async (req, res) => {
  const post = await findPost(req.params.id);
  assertCanManage(req.user, post);

  await Promise.all([post.deleteOne(), Comment.deleteMany({ post: post._id })]);
  res.status(204).end();
};

// POST /api/posts/:id/like → { liked, likesCount }. Toggles atomically (two quick clicks never double count).
const toggleLike = async (req, res) => {
  assertObjectId(req.params.id);
  const userId = req.user._id;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const liked = await Post.exists({ _id: req.params.id, likes: userId });
    if (liked === null && !(await Post.exists({ _id: req.params.id }))) throw notFound('Post');

    // Only applies when the like state is still the one just read.
    const updated = await Post.findOneAndUpdate(
      liked ? { _id: req.params.id, likes: userId } : { _id: req.params.id, likes: { $ne: userId } },
      liked ? { $pull: { likes: userId }, $inc: { likesCount: -1 } } : { $addToSet: { likes: userId }, $inc: { likesCount: 1 } },
      { returnDocument: 'after', projection: { likesCount: 1 } }
    ).lean();
    if (updated) return res.status(200).json({ liked: !liked, likesCount: updated.likesCount });
  }
  throw new HttpError(409, 'CONFLICT', 'The post changed at the same time, try again');
};

// GET /api/posts/me
const getMyPosts = async (req, res) => {
  const posts = await Post.find({ author: req.user._id }).select(HIDDEN_FIELDS).sort({ createdAt: -1 }).lean();
  res.status(200).json(posts);
};

module.exports = {
  createPost,
  getPosts,
  getPost,
  updatePost,
  changeStatus,
  deletePost,
  toggleLike,
  getMyPosts,
  assertCanManage,
};
