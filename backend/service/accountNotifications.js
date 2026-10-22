// In-app + push notifications of the user management module (type ACCOUNT). French uses "tu".
const User = require('../models/userModel');
const { notifyUsers, notifyUsersInBackground } = require('./notificationService');

const ROLE_LABELS = {
  fr: { STUDENT: 'Étudiant', TEACHER: 'Enseignant', ADMIN: 'Admin', ALUMNI: 'Alumni' },
  en: { STUDENT: 'Student', TEACHER: 'Teacher', ADMIN: 'Admin', ALUMNI: 'Alumni' },
};

const roleLabel = (locale, role) => (ROLE_LABELS[locale] ?? ROLE_LABELS.en)[role] ?? role;

/**
 * Tells `user` what an admin changed on their account: `{ role?, group?, password? }` (only the changed parts).
 * `group` is the new group's name, or null when the student left their group.
 * Resolves once the notification is created and pushed (never throws): with `password`, call it BEFORE
 * revoking the sessions, which also deletes the push subscriptions this message must reach.
 */
const notifyAccountChanged = (user, { role, group, password = false }) => {
  const parts = { role: role !== undefined, group: group !== undefined, password };
  if (!parts.role && !parts.group && !parts.password) return Promise.resolve(null);

  return notifyUsers([user._id], (locale) => {
    const fr = locale === 'fr';
    const lines = [];
    if (parts.role) lines.push(fr ? `Ton rôle est maintenant : ${roleLabel('fr', role)}.` : `Your role is now: ${roleLabel('en', role)}.`);
    if (parts.group) {
      if (group) lines.push(fr ? `Tu es maintenant dans le groupe ${group}.` : `You're now in group ${group}.`);
      else lines.push(fr ? "Tu n'es plus dans un groupe." : "You're no longer in a group.");
    }
    if (parts.password) {
      lines.push(
        fr
          ? 'Un administrateur a changé ton mot de passe : connecte-toi avec le nouveau.'
          : 'An administrator changed your password: log in with the new one.'
      );
    }
    return {
      type: 'ACCOUNT',
      title: fr ? 'Ton compte a été modifié' : 'Your account was updated',
      body: lines.join('\n'),
      link: '/dashboard/account',
      data: { userId: String(user._id), changes: Object.keys(parts).filter((key) => parts[key]) },
      tag: `account-${user._id}`,
      urgency: parts.password ? 'high' : 'normal',
    };
  });
};

/** Tells every admin that someone created an account (public sign-up). In the background, never throws. */
const notifyAdminsOfSignup = async (user) => {
  try {
    const admins = await User.find({ role: 'ADMIN' }).select('_id').setOptions({ populateGroup: false }).lean();
    if (admins.length === 0) return;
    const name = `${user.firstname} ${user.lastname}`;
    notifyUsersInBackground(
      admins.map(({ _id }) => _id),
      (locale) => ({
        type: 'ACCOUNT',
        title: locale === 'fr' ? `Nouveau compte : ${name}` : `New account: ${name}`,
        body:
          locale === 'fr'
            ? `${user.email} vient de s'inscrire. Pense à l'ajouter à son groupe.`
            : `${user.email} just signed up. Remember to put them in their group.`,
        link: `/dashboard/admin/users?q=${encodeURIComponent(user.email)}`,
        data: { userId: String(user._id) },
        tag: `signup-${user._id}`,
      })
    );
  } catch (error) {
    console.error('[notifications] Could not notify the admins of a sign-up:', error.message);
  }
};

module.exports = { notifyAccountChanged, notifyAdminsOfSignup };
