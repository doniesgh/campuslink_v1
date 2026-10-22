const mongoose = require('mongoose');
const User = require('../models/userModel');
const Group = require('../models/groupModel');
const AuditLog = require('../models/auditLogModel');
const HttpError = require('../utils/httpError');
const {
  requireFields,
  normalizeEmail,
  assertObjectId,
  throwIfInvalid,
  escapeRegex,
  parsePagination,
  normalizeLocale,
  LOCALES,
} = require('../utils/validation');
const { idOf } = require('../utils/serialize');
const { revokeAllRefreshTokens } = require('../service/tokenService');
const auditService = require('../service/auditService');
const realtime = require('../service/realtime');
const { notifyAccountChanged } = require('../service/accountNotifications');
const { isEmailConfigured } = require('../service/mailService');
const { isProduction } = require('../utils/env');

// Maximum number of users sent by GET /api/users/directory (the admin's offline copy of the user list).
const DIRECTORY_MAX = 5000;

// POST /api/users/import: accounts per import (each password is hashed, about 0.5 s on a small server) and per
// dry run (only checked), problems listed at most, and the id the web app gives each import.
const IMPORT_MAX_ROWS = 50;
const IMPORT_CHECK_MAX_ROWS = 1000;
const IMPORT_MAX_ERRORS = 200;
const IMPORT_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;
const IMPORT_SOURCE_MAX_LENGTH = 200;

const { ROLES } = User;

const noChanges = () => new HttpError(400, 'NO_CHANGES', 'No changes provided');
const userNotFound = () => new HttpError(404, 'USER_NOT_FOUND', 'User not found');
const emailTaken = () => new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

const ONLY_STUDENTS_MESSAGE = 'Only students can be assigned to a group';

// Copies the allowed fields present in the body, checking their types.
// Returns { changes, details } where details holds type errors ({ field: message }).
const pickChanges = (body, allowed) => {
  const changes = {};
  const details = {};

  allowed.forEach((field) => {
    if (body[field] === undefined) return;
    const value = body[field];

    if (field === 'twoFactorEnabled') {
      if (typeof value !== 'boolean') details[field] = 'twoFactorEnabled must be a boolean';
      else changes[field] = value;
    } else if (field === 'group') {
      // A group id, or null to remove the student from their group.
      if (value === null) changes.group = null;
      else if (typeof value === 'string' && mongoose.isObjectIdOrHexString(value.trim())) {
        changes.group = new mongoose.Types.ObjectId(value.trim());
      } else details.group = 'group must be a group id or null';
    } else if (typeof value !== 'string') {
      details[field] = `${field} must be a string`;
    } else if (field === 'role') {
      changes[field] = value.trim().toUpperCase();
    } else if (field === 'locale') {
      const locale = normalizeLocale(value);
      if (locale) changes.locale = locale;
      else details.locale = `Locale must be one of ${LOCALES.join(', ')}`;
    } else {
      changes[field] = value;
    }
  });

  if (changes.role !== undefined && !ROLES.includes(changes.role)) {
    details.role = `Role must be one of ${ROLES.join(', ')}`;
  }

  return { changes, details };
};

// Two-step verification sends its login codes by email: on a production server without an email service, turning
// it on would lock the account out.
const assertTwoFactorAvailable = (changes) => {
  if (changes.twoFactorEnabled === true && isProduction() && !isEmailConfigured()) {
    throw new HttpError(409, 'EMAIL_UNAVAILABLE', 'Two-step verification needs an email service, which this server does not have');
  }
};

// Checks a group assignment: only for students, and the group must exist.
const checkGroupAssignment = async (groupId, role) => {
  if (groupId === undefined || groupId === null) return;
  if (role !== 'STUDENT') throwIfInvalid({ group: ONLY_STUDENTS_MESSAGE });
  if (!(await Group.exists({ _id: groupId }))) throwIfInvalid({ group: 'Unknown group' });
};

const findUserOr404 = async (id) => {
  assertObjectId(id);
  const user = await User.findById(id);
  if (!user) throw userNotFound();
  return user;
};

// GET /api/users/me
const getMe = async (req, res) => {
  res.status(200).json(req.user);
};

// PATCH /api/users/me — only firstname, lastname, twoFactorEnabled and locale; other fields are ignored.
const updateMe = async (req, res) => {
  const { changes, details } = pickChanges(req.body ?? {}, ['firstname', 'lastname', 'twoFactorEnabled', 'locale']);
  throwIfInvalid(details);
  if (Object.keys(changes).length === 0) throw noChanges();
  assertTwoFactorAvailable(changes);

  const user = req.user;
  user.set(changes);
  await user.save();

  res.status(200).json(user);
};

// Builds the user filter of GET /api/users from the query string.
const buildListFilter = async (query) => {
  const { role, email, q, group, program, level } = query;
  const filter = {};
  const details = {};
  const present = (value) => value !== undefined && String(value).trim() !== '';

  if (present(role)) {
    const normalizedRole = String(role).trim().toUpperCase();
    if (!ROLES.includes(normalizedRole)) {
      throw new HttpError(400, 'INVALID_ROLE', `Role must be one of ${ROLES.join(', ')}`);
    }
    filter.role = normalizedRole;
  }

  if (present(email)) {
    // Case-insensitive "contains" search.
    filter.email = { $regex: escapeRegex(String(email).trim()), $options: 'i' };
  }

  if (present(q)) {
    const regex = { $regex: escapeRegex(String(q).trim().slice(0, 100)), $options: 'i' };
    filter.$or = [{ firstname: regex }, { lastname: regex }, { email: regex }];
  }

  const groupFilter = {};
  if (present(group)) {
    if (mongoose.isObjectIdOrHexString(String(group).trim())) groupFilter._id = String(group).trim();
    else details.group = 'group must be a group id';
  }
  if (present(program)) {
    if (mongoose.isObjectIdOrHexString(String(program).trim())) groupFilter.program = String(program).trim();
    else details.program = 'program must be a program id';
  }
  if (present(level)) {
    const number = Number(level);
    if (Number.isInteger(number) && number >= Group.MIN_LEVEL && number <= Group.MAX_LEVEL) groupFilter.level = number;
    else details.level = `level must be an integer between ${Group.MIN_LEVEL} and ${Group.MAX_LEVEL}`;
  }
  throwIfInvalid(details);

  if (groupFilter.program !== undefined || groupFilter.level !== undefined) {
    filter.group = { $in: await Group.distinct('_id', groupFilter) };
  } else if (groupFilter._id !== undefined) {
    filter.group = new mongoose.Types.ObjectId(groupFilter._id);
  }

  return filter;
};

// GET /api/users?role=&email=&q=&group=&program=&level=&page=1&limit=20 [admin]
const listUsers = async (req, res) => {
  const filter = await buildListFilter(req.query);
  const { page, limit, skip } = parsePagination(req.query);

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({ items, total, page, limit });
};

// GET /api/users/directory [admin] → { items, total, truncated }: every user (at most DIRECTORY_MAX), by name.
// The web app keeps it on the admin's device to search, filter, export and edit the list offline.
const getDirectory = async (req, res) => {
  const [items, total] = await Promise.all([
    User.find().collation({ locale: 'fr', strength: 1 }).sort({ lastname: 1, firstname: 1, _id: 1 }).limit(DIRECTORY_MAX),
    User.estimatedDocumentCount(),
  ]);
  res.status(200).json({ items, total, truncated: total > items.length });
};

// GET /api/users/stats [admin]
const getUserStats = async (req, res) => {
  const counts = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);

  const stats = Object.fromEntries(ROLES.map((role) => [role, 0]));
  counts.forEach(({ _id, count }) => {
    if (ROLES.includes(_id)) stats[_id] = count;
  });

  res.status(200).json(stats);
};

// POST /api/users [admin]
const createUser = async (req, res) => {
  const body = req.body ?? {};
  requireFields(body, ['firstname', 'lastname', 'email', 'password']);

  const { changes, details } = pickChanges(body, ['role', 'locale', 'group']);
  throwIfInvalid(details);

  const role = changes.role || 'STUDENT';
  await checkGroupAssignment(changes.group, role);

  const user = new User({
    firstname: body.firstname,
    lastname: body.lastname,
    email: body.email,
    password: body.password,
    role,
    locale: changes.locale,
    group: changes.group ?? null,
  });
  await user.validate();

  if (await User.exists({ email: user.email })) throw emailTaken();

  await user.save();
  await user.populateGroup();

  await auditService.record(req, {
    action: 'user.create',
    targetType: 'User',
    targetId: user._id,
    summary: `Created ${user.role} account ${user.email}`,
    metadata: { email: user.email, role: user.role, group: idOf(user.group) },
  });

  res.status(201).json(user);
};

// Problem code of a model validation error, per field (the web app translates the codes).
const importErrorCode = (field, error) => {
  if (error.kind === 'required') return 'REQUIRED';
  if (field === 'email') return 'INVALID_EMAIL';
  if (field === 'password') return 'PASSWORD_TOO_SHORT';
  if (field === 'role') return 'INVALID_ROLE';
  if (error.kind === 'maxlength') return 'TOO_LONG';
  return 'INVALID';
};

const isText = (value) => typeof value === 'string' && value.trim() !== '';

// Checks the rows of an import: each one against the model, then together (same email twice, emails already
// used, groups). Returns the users to insert and the problems, as { row, field, code, message } sorted by row
// (`row` is the line of the file, sent by the web app).
const checkImportRows = async (rows) => {
  const errors = [];
  const users = [];
  const fail = (row, field, code, message) => errors.push({ row, field, code, message });

  rows.forEach((item, index) => {
    const row = Number.isInteger(item?.row) && item.row > 0 ? item.row : index + 1;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail(row, null, 'INVALID_ROW', 'Each row must be an object');
      return;
    }

    const role = isText(item.role) ? item.role.trim().toUpperCase() : 'STUDENT';
    let group = null;
    if (isText(item.group)) {
      if (mongoose.isObjectIdOrHexString(item.group.trim())) group = new mongoose.Types.ObjectId(item.group.trim());
      else fail(row, 'group', 'UNKNOWN_GROUP', 'group must be a group id');
    }
    if (group && role !== 'STUDENT') fail(row, 'group', 'GROUP_NOT_ALLOWED', ONLY_STUDENTS_MESSAGE);

    // Strings only (no query operators); the model checks the rest (email format, lengths, role, password).
    const text = (field) => (typeof item[field] === 'string' ? item[field] : undefined);
    const user = new User({
      firstname: text('firstname'),
      lastname: text('lastname'),
      email: text('email'),
      password: text('password'),
      role,
      group,
    });
    const invalid = user.validateSync();
    Object.entries(invalid?.errors ?? {}).forEach(([field, error]) => fail(row, field, importErrorCode(field, error), error.message));
    users.push({ row, user });
  });

  const seen = new Set();
  users.forEach(({ row, user }) => {
    if (!user.email) return;
    if (seen.has(user.email)) fail(row, 'email', 'DUPLICATE_EMAIL', 'This email is used by another row of the import');
    seen.add(user.email);
  });

  const groupIds = [...new Set(users.map(({ user }) => idOf(user.group)).filter(Boolean))];
  const [taken, groups] = await Promise.all([
    seen.size > 0 ? User.find({ email: { $in: [...seen] } }).select('email').setOptions({ populateGroup: false }) : [],
    groupIds.length > 0 ? Group.find({ _id: { $in: groupIds } }).select('_id') : [],
  ]);
  const takenEmails = new Set(taken.map((user) => user.email));
  const knownGroups = new Set(groups.map((group) => String(group._id)));
  users.forEach(({ row, user }) => {
    if (takenEmails.has(user.email)) fail(row, 'email', 'EMAIL_TAKEN', 'An account with this email already exists');
    const groupId = idOf(user.group);
    if (groupId && !knownGroups.has(String(groupId))) fail(row, 'group', 'UNKNOWN_GROUP', 'Unknown group');
  });

  errors.sort((a, b) => a.row - b.row);
  return { users: users.map(({ user }) => user), errors };
};

const importInvalid = (errors) =>
  new HttpError(422, 'IMPORT_INVALID', `${errors.length} problem(s) in the imported rows: nothing was imported`, {
    errors: errors.slice(0, IMPORT_MAX_ERRORS),
    total: errors.length,
  });

// The accounts of an import already done with this id (its audit entry exists), or null.
const importedBefore = async (importId, rows) => {
  if (!(await AuditLog.exists({ action: 'user.import', targetType: 'Import', targetId: importId }))) return null;
  const emails = rows.map((row) => (typeof row?.email === 'string' ? normalizeEmail(row.email) : null)).filter(Boolean);
  return User.find({ email: { $in: emails } });
};

// One insert for the whole import, all or nothing. insertMany skips the save hook: the passwords are hashed here.
const insertImport = async (users, rows) => {
  for (const user of users) user.password = await User.hashPassword(user.password);
  try {
    await User.insertMany(users, { ordered: true });
  } catch (error) {
    // An account created meanwhile with one of these emails: what this import inserted is removed.
    await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });
    if (error?.code !== 11000 && !error?.writeErrors) throw error;
    const recheck = await checkImportRows(rows);
    if (recheck.errors.length > 0) throw importInvalid(recheck.errors);
    throw emailTaken();
  }
};

// POST /api/users/import [admin] { importId, source?, dryRun?, users: [{ row, firstname, lastname, email, password,
// role?, group? }] }. The web app reads the Excel or CSV file on the admin's device and sends its rows.
// - dryRun: true → 200 { dryRun: true, count } when every row is valid (at most IMPORT_CHECK_MAX_ROWS rows).
// - Otherwise at most IMPORT_MAX_ROWS rows, all or nothing: 201 { importId, created, items } or
//   422 IMPORT_INVALID (details.errors [{ row, field, code, message }], details.total) and nothing is created.
// - Sent again with the same importId (a reply lost on a bad connection) → 200, the accounts are not created twice.
const importUsers = async (req, res) => {
  const body = req.body ?? {};
  const dryRun = body.dryRun === true;
  const { importId, users: rows } = body;
  const details = {};
  if (!dryRun && (typeof importId !== 'string' || !IMPORT_ID_PATTERN.test(importId))) {
    details.importId = 'importId must be 8 to 100 letters, digits, "-" or "_"';
  }
  if (!Array.isArray(rows) || rows.length === 0) details.users = 'users must be a non-empty array';
  throwIfInvalid(details);

  const max = dryRun ? IMPORT_CHECK_MAX_ROWS : IMPORT_MAX_ROWS;
  if (rows.length > max) {
    throw new HttpError(400, 'IMPORT_TOO_LARGE', `At most ${max} accounts per request`, { max });
  }

  const previous = dryRun ? null : await importedBefore(importId, rows);
  if (previous) {
    res.status(200).json({ importId, created: previous.length, items: previous, replayed: true });
    return;
  }

  const { users, errors } = await checkImportRows(rows);
  if (errors.length > 0) throw importInvalid(errors);
  if (dryRun) {
    res.status(200).json({ dryRun: true, count: users.length });
    return;
  }

  await insertImport(users, rows);
  const items = await User.find({ _id: { $in: users.map((user) => user._id) } })
    .collation({ locale: 'fr', strength: 1 })
    .sort({ lastname: 1, firstname: 1, _id: 1 });
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, IMPORT_SOURCE_MAX_LENGTH) : '';
  const roles = Object.fromEntries(ROLES.map((role) => [role, items.filter((user) => user.role === role).length]).filter(([, count]) => count > 0));
  await auditService.record(req, {
    action: 'user.import',
    targetType: 'Import',
    targetId: importId,
    summary: `Imported ${items.length} account(s)${source ? ` from ${source}` : ''}`,
    metadata: { count: items.length, source: source || null, roles, users: items.map((user) => ({ id: user.id, email: user.email })) },
  });

  res.status(201).json({ importId, created: items.length, items });
};

// GET /api/users/:id [admin]
const getUser = async (req, res) => {
  res.status(200).json(await findUserOr404(req.params.id));
};

const UPDATABLE_FIELDS = ['firstname', 'lastname', 'email', 'role', 'password', 'twoFactorEnabled', 'locale', 'group'];

// PATCH /api/users/:id [admin]
const updateUser = async (req, res) => {
  const user = await findUserOr404(req.params.id);

  const { changes, details } = pickChanges(req.body ?? {}, UPDATABLE_FIELDS);
  throwIfInvalid(details);
  if (Object.keys(changes).length === 0) throw noChanges();
  assertTwoFactorAvailable(changes);

  const nextRole = changes.role ?? user.role;
  await checkGroupAssignment(changes.group, nextRole);
  // Only students have a group: changing a student's role to another role clears it.
  if (nextRole !== 'STUDENT' && user.group) changes.group = null;

  if (changes.email !== undefined) {
    const email = normalizeEmail(changes.email);
    if (email !== user.email && (await User.exists({ email, _id: { $ne: user._id } }))) {
      throw emailTaken();
    }
  }

  const before = { role: user.role, group: idOf(user.group) };

  // set() + save() so validators and the password hashing hook run.
  user.set(changes);
  const changed = UPDATABLE_FIELDS.filter(
    (field) => user.isModified(field) && !(field === 'group' && idOf(user.group) === before.group)
  );
  const passwordChanged = user.isModified('password');
  const roleChanged = user.isModified('role');
  await user.save();
  if (changes.group !== undefined) await user.populateGroup();

  // The user is told (in-app + push) what an admin changed on their account; not their own edits.
  const groupChanged = idOf(user.group) !== before.group;
  const notice = req.user._id.equals(user._id)
    ? null
    : {
        ...(roleChanged ? { role: user.role } : {}),
        ...(groupChanged ? { group: user.group?.name ?? null } : {}),
        password: passwordChanged,
      };

  if (passwordChanged) {
    // Notified first: revoking the sessions also deletes the push subscriptions the message must reach.
    if (notice) await notifyAccountChanged(user, notice);
    // Also closes every real-time connection of the user.
    await revokeAllRefreshTokens(user._id);
  } else {
    if (notice) void notifyAccountChanged(user, notice);
    // Real-time connections were opened (and joined their rooms) under the old role: the clients reconnect
    // with a new ticket or token and join again under the new one.
    if (roleChanged) await realtime.disconnectUser(user._id);
  }

  if (changed.length > 0) {
    const metadata = { changes: changed };
    if (changed.includes('role')) metadata.role = { from: before.role, to: user.role };
    if (changed.includes('group')) metadata.group = { from: before.group, to: idOf(user.group) };
    await auditService.record(req, {
      action: 'user.update',
      targetType: 'User',
      targetId: user._id,
      summary: changed.includes('role')
        ? `Updated ${user.email} (role ${before.role} → ${user.role})`
        : `Updated ${user.email} (${changed.join(', ')})`,
      metadata,
    });
  }

  res.status(200).json(user);
};

// Number of SCHEDULED sessions of a teacher that have not ended yet (0 without the timetable module).
const countUpcomingSessions = async (teacherId) => {
  const { ClassSession } = mongoose.models;
  if (!ClassSession) return 0;
  return ClassSession.countDocuments({ teacher: teacherId, status: 'SCHEDULED', endsAt: { $gt: new Date() } });
};

// DELETE /api/users/:id [admin]
// A TEACHER who still has SCHEDULED sessions that have not ended → 409 IN_USE (details.references.sessions):
// reassign or cancel them first. Past and cancelled sessions do not block the deletion.
const deleteUser = async (req, res) => {
  assertObjectId(req.params.id);

  if (req.user._id.equals(req.params.id)) {
    throw new HttpError(400, 'CANNOT_DELETE_SELF', 'You cannot delete your own account');
  }

  const found = await User.findById(req.params.id).setOptions({ populateGroup: false });
  if (!found) throw userNotFound();

  if (found.role === 'TEACHER') {
    const sessions = await countUpcomingSessions(found._id);
    if (sessions > 0) {
      throw new HttpError(409, 'IN_USE', 'This teacher still has scheduled sessions', { references: { sessions } });
    }
  }

  const user = await User.findOneAndDelete({ _id: found._id }).setOptions({ populateGroup: false });
  if (!user) throw userNotFound();

  // Sessions, push subscriptions, real-time connections and in-app notifications of the account go with it.
  const { models } = mongoose;
  await Promise.all([
    revokeAllRefreshTokens(user._id),
    models.PushSubscription?.deleteMany({ user: user._id }),
    models.Notification?.deleteMany({ user: user._id }),
  ]);
  // Every real-time connection of the account is closed (they leave every room). revokeAllRefreshTokens does it
  // too: explicit here so an account deletion never depends on how sessions are revoked.
  await realtime.disconnectUser(user._id);

  await auditService.record(req, {
    action: 'user.delete',
    targetType: 'User',
    targetId: user._id,
    summary: `Deleted ${user.role} account ${user.email}`,
    metadata: { email: user.email, role: user.role, firstname: user.firstname, lastname: user.lastname },
  });

  res.status(204).end();
};

module.exports = {
  getMe,
  updateMe,
  listUsers,
  getDirectory,
  getUserStats,
  createUser,
  importUsers,
  getUser,
  updateUser,
  deleteUser,
};
