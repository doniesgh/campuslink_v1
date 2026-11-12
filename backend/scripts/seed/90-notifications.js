// Seed plugin of the in-app notifications (bell, notifications page) of the demo accounts:
// - TIMETABLE_CHANGE for the room change and the cancellation made by 20-timetable.js, sent to the students of the
//   groups and the teacher, with the texts of service/timetableService.js in each user's language;
// - ACCOUNT, with the texts of service/accountNotifications.js: sign-ups for the admin, group/role changes.
// Runs after the timetable plugin. Sends no push. Idempotent: the notifications it created before (data.seed) are
// replaced; the other notifications are kept.
const Notification = require('../../models/notificationModel');
const ClassSession = require('../../models/classSessionModel');
const { buildChangeText } = require('../../service/timetableService');

const HOUR_MS = 60 * 60 * 1000;

const roomOf = (rooms, id) => {
  const room = Object.values(rooms).find(({ _id }) => String(_id) === String(id));
  return room ? { name: room.name, building: room.building } : null;
};

module.exports = {
  name: 'notifications',
  run: async ({ users, rooms, subjects, now, time, log }) => {
    await Notification.deleteMany({ 'data.seed': true });
    const ago = (hours) => new Date(now.getTime() - hours * HOUR_MS);
    const docs = [];

    // ----- Timetable changes (the demo ones of 20-timetable.js) -----
    const recipientsOf = (session) => {
      const groups = new Set(session.groups.map(String));
      return [
        ...users.students.filter(({ group }) => group && groups.has(String(group._id ?? group))),
        ...users.teachers.filter(({ _id }) => String(_id) === String(session.teacher)),
      ];
    };
    const timetableChange = (session, kind, before, hoursAgo, read) => {
      const subject = Object.values(subjects).find(({ _id }) => String(_id) === String(session.subject));
      const after = { startsAt: session.startsAt, endsAt: session.endsAt, room: roomOf(rooms, session.room) };
      const summary = { kind, subjectName: subject?.name, count: 1, first: { before, after } };
      const date = time.formatLocalDate(session.startsAt);
      for (const user of recipientsOf(session)) {
        docs.push({
          user: user._id,
          type: 'TIMETABLE_CHANGE',
          ...buildChangeText(user.locale, summary),
          link: `/dashboard/timetable?date=${date}`,
          data: { kind, sessionId: String(session._id), seriesId: session.seriesId ? String(session.seriesId) : null, count: 1, date, seed: true },
          readAt: read ? ago(hoursAgo - 0.5) : null,
          createdAt: ago(hoursAgo),
        });
      }
    };

    const moved = await ClassSession.findOne({ source: 'SEED', 'change.kind': 'ROOM' }).lean();
    if (moved) {
      const previous = Object.values(rooms).find(({ name }) => name === moved.change.previousRoom?.name);
      const before = { startsAt: moved.startsAt, endsAt: moved.endsAt, room: previous ? { name: previous.name, building: previous.building } : null };
      timetableChange(moved, 'ROOM', before, 2, false);
    }
    const cancelled = await ClassSession.findOne({ source: 'SEED', status: 'CANCELLED' }).lean();
    if (cancelled) {
      const before = { startsAt: cancelled.startsAt, endsAt: cancelled.endsAt, room: roomOf(rooms, cancelled.room) };
      timetableChange(cancelled, 'CANCELLED', before, 5, false);
    }
    const timetableCount = docs.length;

    // ----- Account (texts of service/accountNotifications.js) -----
    const signup = (account, hoursAgo, read) => {
      const name = `${account.firstname} ${account.lastname}`;
      const fr = users.admin.locale === 'fr';
      docs.push({
        user: users.admin._id,
        type: 'ACCOUNT',
        title: fr ? `Nouveau compte : ${name}` : `New account: ${name}`,
        body: fr
          ? `${account.email} vient de s'inscrire. Pense à l'ajouter à son groupe.`
          : `${account.email} just signed up. Remember to put them in their group.`,
        link: `/dashboard/admin/users?q=${encodeURIComponent(account.email)}`,
        data: { userId: String(account._id), seed: true },
        readAt: read ? ago(hoursAgo - 1) : null,
        createdAt: ago(hoursAgo),
      });
    };
    const accountChanged = (account, line, changes, hoursAgo) => {
      const fr = account.locale === 'fr';
      docs.push({
        user: account._id,
        type: 'ACCOUNT',
        title: fr ? 'Ton compte a été modifié' : 'Your account was updated',
        body: line(fr),
        link: '/dashboard/account',
        data: { userId: String(account._id), changes, seed: true },
        readAt: ago(hoursAgo - 2),
        createdAt: ago(hoursAgo),
      });
    };
    const byEmail = (slug) => users.byEmail[`${slug}@campuslink.local`];
    const inGroup = (fr, account) =>
      fr ? `Tu es maintenant dans le groupe ${account.group.name}.` : `You're now in group ${account.group.name}.`;

    const skander = byEmail('skander.mejri');
    if (skander) signup(skander, 20, false);
    if (users.companies[0]) signup(users.companies[0], 6 * 24, true);
    for (const slug of ['yasmine.haddad', 'omar.ferchichi', 'ines.zouari']) {
      const account = byEmail(slug);
      if (account?.group) accountChanged(account, (fr) => inGroup(fr, account), ['group'], 30 * 24);
    }
    const leila = byEmail('leila.gharbi');
    if (leila) {
      accountChanged(leila, (fr) => (fr ? 'Ton rôle est maintenant : Enseignant.' : 'Your role is now: Teacher.'), ['role'], 40 * 24);
    }

    await Notification.create(docs, { timestamps: false });
    log(`${docs.length} notifications (${timetableCount} timetable changes, ${docs.length - timetableCount} account).`);
  },
};
