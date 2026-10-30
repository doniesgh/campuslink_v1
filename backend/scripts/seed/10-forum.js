// Seed plugin of the forum: posts of every type by the demo students, with a few comments and replies.
// Idempotent: the posts written by demo accounts (and their comments) are replaced; other posts are kept.
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');

const daysFromNow = (now, days, hours = 0, minutes = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  if (hours) date.setHours(hours, minutes, 0, 0);
  return date;
};

// `author` / `by`: index in ctx.users.students.
const posts = (now) => [
  {
    author: 0,
    type: 'covoiturage',
    title: 'Covoiturage vers le campus',
    description:
      'Je cherche des étudiants intéressés par un covoiturage le matin vers le campus. Contactez-moi pour organiser les horaires.',
    tags: ['covoiturage', 'campus', 'transport'],
    location: 'Tunis',
    covoiturage: {
      departure: 'Centre-ville de Tunis',
      destination: 'Campus universitaire',
      departureDate: daysFromNow(now, 2, 7, 30),
      seats: 3,
      price: 5,
    },
    comments: [
      { by: 5, content: 'Je suis intéressé, tu passes par Bab Saadoun ?' },
      { by: 0, content: 'Oui, vers 7h40. Je te garde une place !', replyTo: 0 },
    ],
  },
  {
    author: 6,
    type: 'covoiturage',
    title: 'Trajet retour après les cours',
    description: 'Je propose un trajet retour après les cours. Il reste quelques places, envoyez-moi un message pour les détails.',
    tags: ['transport', 'covoiturage'],
    location: 'Tunis',
    covoiturage: {
      departure: 'Campus universitaire',
      destination: 'Ariana',
      departureDate: daysFromNow(now, 3, 16, 30),
      seats: 2,
      price: 0,
    },
  },
  {
    author: 2,
    type: 'objet_perdu',
    title: 'Clés perdues près de la bibliothèque',
    description: 'J’ai perdu un trousseau de clés près de la bibliothèque. Si vous les avez trouvées, merci de me contacter.',
    tags: ['clés', 'perdu', 'bibliothèque'],
    location: 'Bibliothèque universitaire',
    objetPerdu: { kind: 'perdu', category: 'Clés', date: daysFromNow(now, -2), place: 'Bibliothèque universitaire' },
    comments: [{ by: 8, content: 'J’ai vu un trousseau à l’accueil ce matin, demande là-bas.' }],
  },
  {
    author: 9,
    type: 'objet_perdu',
    title: 'Carte étudiante retrouvée',
    description: 'Une carte étudiante a été retrouvée dans un couloir du campus. Le propriétaire peut me contacter pour la récupérer.',
    tags: ['carte étudiante', 'trouvé', 'campus'],
    location: 'Campus universitaire',
    objetPerdu: { kind: 'trouve', category: 'Carte étudiante', date: daysFromNow(now, -1), place: 'Couloir du bâtiment principal' },
    status: 'resolved',
  },
  {
    author: 1,
    type: 'experience',
    title: 'Mes conseils pour réussir les examens',
    description:
      'Mon conseil est de réviser régulièrement, de préparer des fiches de synthèse et de travailler avec des exercices des années précédentes. Bon courage à tous !',
    tags: ['examens', 'conseils', 'études'],
    location: 'Campus universitaire',
    comments: [
      { by: 11, content: 'Merci ! Les annales m’ont beaucoup aidée aussi.' },
      { by: 3, content: 'Tu as des fiches à partager pour la BDD ?' },
    ],
  },
  {
    author: 12,
    type: 'experience',
    title: 'Mon premier semestre à l’université',
    description:
      'Le début peut sembler difficile, mais participer aux activités, rencontrer d’autres étudiants et bien organiser son temps aide beaucoup.',
    tags: ['université', 'expérience', 'étudiants'],
  },
  {
    author: 4,
    type: 'idee',
    title: 'Créer un club de programmation',
    description:
      'Que pensez-vous de créer un club où les étudiants pourraient apprendre le développement web, partager leurs projets et organiser des ateliers ?',
    tags: ['programmation', 'club', 'développement web'],
    location: 'Campus universitaire',
    comments: [{ by: 7, content: 'Super idée, je peux animer un atelier React.' }],
  },
  {
    author: 10,
    type: 'idee',
    title: 'Une boîte à livres sur le campus',
    description: 'Nous pourrions installer une boîte à livres pour échanger des manuels et des romans gratuitement entre étudiants.',
    tags: ['livres', 'idée', 'campus'],
    location: 'Campus universitaire',
    status: 'closed',
  },
];

module.exports = {
  name: 'forum',
  run: async ({ users, now, log }) => {
    const demoIds = Object.values(users.byEmail).map((user) => user._id);
    const old = await Post.find({ author: { $in: demoIds } }).select('_id').lean();
    await Comment.deleteMany({ $or: [{ post: { $in: old.map(({ _id }) => _id) } }, { author: { $in: demoIds } }] });
    await Post.deleteMany({ _id: { $in: old.map(({ _id }) => _id) } });

    const { students } = users;
    let commentCount = 0;
    const list = posts(now);
    for (const [index, { author, comments = [], ...data }] of list.entries()) {
      // Oldest first, one post every few hours, so the feed has a stable order.
      const createdAt = new Date(now.getTime() - (list.length - index) * 5 * 60 * 60 * 1000);
      const likes = students.filter((_, i) => i !== author && (i + index) % 3 === 0).map((user) => user._id);
      // timestamps: false keeps the dates set here.
      const [post] = await Post.create(
        [{ ...data, author: students[author]._id, likes, likesCount: likes.length, views: 5 + index * 3, createdAt, updatedAt: createdAt }],
        { timestamps: false }
      );

      const saved = [];
      for (const [position, { by, content, replyTo }] of comments.entries()) {
        const at = new Date(createdAt.getTime() + (position + 1) * 20 * 60 * 1000);
        const parent = replyTo === undefined ? null : saved[replyTo]._id;
        const [comment] = await Comment.create(
          [{ post: post._id, author: students[by]._id, content, parent, createdAt: at, updatedAt: at }],
          { timestamps: false }
        );
        saved.push(comment);
      }
      if (saved.length > 0) {
        await Post.updateOne({ _id: post._id }, { $set: { commentsCount: saved.length } }, { timestamps: false });
      }
      commentCount += saved.length;
    }

    log(`${list.length} forum posts, ${commentCount} comments.`);
  },
};
