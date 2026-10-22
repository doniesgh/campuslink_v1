const PushSubscription = require('../models/pushSubscriptionModel');
const pushService = require('../service/pushService');
const HttpError = require('../utils/httpError');
const { isAllowedPushEndpoint, MAX_ENDPOINT_LENGTH } = require('../utils/pushEndpoint');
const { readEnum, readString, throwIfInvalid } = require('../utils/validation');

const { SUBSCRIPTION_TYPES, MAX_SUBSCRIPTIONS_PER_USER } = PushSubscription;
const KEY_MAX_LENGTH = 200;
const TOKEN_MAX_LENGTH = 4096;
const USER_AGENT_MAX_LENGTH = 300;

// GET /api/push/vapid-public-key → { publicKey }; 503 PUSH_DISABLED when no VAPID keys are configured.
const getVapidPublicKey = (req, res) => {
  const publicKey = pushService.getPublicKey();
  if (!publicKey) throw new HttpError(503, 'PUSH_DISABLED', 'Push notifications are not configured');
  res.status(200).json({ publicKey });
};

// Keeps the MAX_SUBSCRIPTIONS_PER_USER most recently updated subscriptions of the user.
const dropOldestSubscriptions = async (userId) => {
  const extra = await PushSubscription.find({ user: userId })
    .sort({ updatedAt: -1, _id: -1 })
    .skip(MAX_SUBSCRIPTIONS_PER_USER)
    .select('_id')
    .lean();
  if (extra.length > 0) await PushSubscription.deleteMany({ _id: { $in: extra.map(({ _id }) => _id) } });
};

// POST /api/push/subscriptions
//   { type: "web", endpoint, keys: { p256dh, auth } } (browser) | { type: "fcm", token } (mobile app)
// Upsert by endpoint/token, tied to the current login session: 201 when created, 200 when it already existed.
const saveSubscription = async (req, res) => {
  const body = req.body ?? {};
  const details = {};
  const type = readEnum(body.type ?? 'web', SUBSCRIPTION_TYPES, 'type', details, { upper: false });

  let filter;
  let values;
  if (type === 'web') {
    const endpoint = readString(body.endpoint, 'endpoint', details, { min: 1, max: MAX_ENDPOINT_LENGTH });
    if (endpoint && !isAllowedPushEndpoint(endpoint)) details.endpoint = 'endpoint must be a browser push service URL';
    const p256dh = readString(body.keys?.p256dh, 'keys.p256dh', details, { min: 1, max: KEY_MAX_LENGTH });
    const auth = readString(body.keys?.auth, 'keys.auth', details, { min: 1, max: KEY_MAX_LENGTH });
    filter = { endpoint };
    values = { type, endpoint, keys: { p256dh, auth } };
  } else if (type === 'fcm') {
    const token = readString(body.token, 'token', details, { min: 1, max: TOKEN_MAX_LENGTH });
    filter = { token };
    values = { type, token };
  }
  throwIfInvalid(details);

  const existed = await PushSubscription.exists(filter);
  const subscription = await PushSubscription.findOneAndUpdate(
    filter,
    {
      $set: {
        ...values,
        user: req.user._id,
        sessionId: req.sessionId ?? null,
        userAgent: String(req.get('user-agent') ?? '').slice(0, USER_AGENT_MAX_LENGTH),
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );
  await dropOldestSubscriptions(req.user._id);

  res.status(existed ? 200 : 201).json(subscription);
};

// DELETE /api/push/subscriptions { endpoint } | { token } → 204 (idempotent; only the user's own subscription).
const deleteSubscription = async (req, res) => {
  const { endpoint, token } = req.body ?? {};
  let filter;
  if (typeof endpoint === 'string' && endpoint) filter = { endpoint };
  else if (typeof token === 'string' && token) filter = { token };
  else throwIfInvalid({ endpoint: 'endpoint or token is required' });

  await PushSubscription.deleteOne({ ...filter, user: req.user._id });
  res.status(204).end();
};

module.exports = { getVapidPublicKey, saveSubscription, deleteSubscription };
