// Seed plugin of the forum: posts of every type by the demo accounts, with likes, comments and replies.
// - Carpool: rides around Tunis with map coordinates (nearby page, route maps), seat requests (pending, accepted,
//   declined; the seats left account for the accepted ones), a past ride, and ride searches. The searches a ride
//   matches are found by service/rideMatching.js, as when a ride is published.
// - Lost & found: lost/found pairs made for the matching (one written in Arabic, one decoy, one without a match).
// - The forum notifications these actions send (new seat request, accepted/declined, matching ride), in English as
//   the API writes them.
// Idempotent: the forum data of the demo accounts (posts, comments, seat requests, searches, forum notifications) is
// replaced; the other accounts' data is kept. Sends no push and no real-time event. Dates are relative to the run.
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const Reservation = require('../../models/Reservation');
const RideSearch = require('../../models/RideSearch');
const ForumNotification = require('../../models/ForumNotification');
const { searchesForRide } = require('../../service/rideMatching');
const { atLocalTime } = require('../../service/timetableService');

const HOUR_MS = 60 * 60 * 1000;

// Approximate coordinates, Tunis area.
const P = {
  manouba: { name: 'Manouba', lat: 36.8089, lng: 10.097 },
  ghazela: { name: 'ESPRIT Ghazela', lat: 36.8993, lng: 10.1893 },
  benArous: { name: 'Ben Arous', lat: 36.7531, lng: 10.2189 },
  ennasr: { name: 'Cité Ennasr', lat: 36.887, lng: 10.165 },
  tunis: { name: 'Tunis Centre', lat: 36.7995, lng: 10.18 },
  sousse: { name: 'Sousse', lat: 35.8256, lng: 10.6369 },
  ariana: { name: 'Ariana', lat: 36.8665, lng: 10.1647 },
  marsa: { name: 'La Marsa', lat: 36.8782, lng: 10.3247 },
};

const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
};

// `by`: demo account (e-mail without @campuslink.local). `when`: [days from today, hour, minute], campus time.
// `age`: hours since publication. `offered`: seats offered; `requests`: seat requests (`replyTo` of a comment: index
// of the comment it answers).
const ride = (by, from, to, when, offered, price, title, description, tags, extra = {}) => {
  const distanceKm = Math.round(km(from, to) * 1.25 * 10) / 10;
  return {
    by,
    type: 'covoiturage',
    title,
    description,
    tags,
    location: from.name,
    when,
    offered,
    route: {
      departure: from.name,
      destination: to.name,
      price,
      departureCoords: { lat: from.lat, lng: from.lng },
      destinationCoords: { lat: to.lat, lng: to.lng },
      distanceKm,
      durationMin: Math.round(distanceKm * 1.6),
    },
    ...extra,
  };
};

const item = (by, kind, title, description, tags, category, daysAgo, place, extra = {}) => ({
  by,
  type: 'objet_perdu',
  title,
  description,
  tags,
  location: place,
  item: { kind, category, daysAgo, place },
  ...extra,
});

const post = (by, type, title, description, tags, extra = {}) => ({ by, type, title, description, tags, ...extra });

const POSTS = [
  // ----- Carpool -----
  ride('amira.bensalah', P.manouba, P.ghazela, [1, 7, 45], 3, 2,
    'Manouba → ESPRIT Ghazela · départ 7h45',
    'Je fais ce trajet chaque matin par la route de Bizerte. Départ devant la gare de la Manouba, arrivée à 8h20 environ. Ambiance calme, pas de fumeurs.',
    ['covoiturage', 'manouba', 'esprit', 'matin'],
    {
      age: 3, likes: 3,
      requests: [{ by: 'yasmine.haddad', seats: 1, status: 'accepted', message: 'Je monte à la gare, merci !' }],
      comments: [
        { by: 'malek.ayari', content: 'Tu passes par Den Den ?' },
        { by: 'amira.bensalah', content: 'Oui, vers 7h50 devant la pharmacie.', replyTo: 0 },
      ],
    }),
  ride('ahmed.karray', P.benArous, P.ghazela, [1, 7, 30], 2, 3,
    'Ben Arous → ESPRIT Ghazela · 7h30',
    'Départ de la station de métro de Ben Arous, arrivée avant 8h15 pour le premier cours. Voiture climatisée, petit détour possible par Ennasr.',
    ['covoiturage', 'benarous', 'esprit'],
    { age: 6, likes: 2, requests: [{ by: 'nour.chaabane', seats: 1, status: 'pending', message: 'Je serai à la station à 7h25.' }] }),
  ride('omar.ferchichi', P.tunis, P.sousse, [3, 15, 0], 3, 12,
    'Tunis → Sousse · vendredi 15h',
    'Je rentre à Sousse pour le week-end. Bagages acceptés, une pause café à Enfidha. Participation aux frais : 12 TND par personne.',
    ['covoiturage', 'sousse', 'weekend'],
    {
      age: 10, likes: 4,
      requests: [
        { by: 'sarra.mansouri', seats: 1, status: 'accepted', message: 'Une petite valise, ça passe ?' },
        { by: 'rami.belhaj', seats: 2, status: 'rejected', message: 'Two seats for my brother and me?' },
      ],
    }),
  ride('yasmine.haddad', P.ariana, P.marsa, [1, 18, 0], 2, 2,
    'Ariana → La Marsa · demain 18h',
    "Après les cours, direction La Marsa. Deux places libres, on peut s'arrêter à la plage si le temps le permet !",
    ['covoiturage', 'marsa', 'soir'],
    { age: 14, likes: 1, requests: [{ by: 'ines.zouari', seats: 1, status: 'pending', message: 'Je descends à Carthage, ça te va ?' }] }),
  ride('sarra.mansouri', P.ghazela, P.manouba, [1, 17, 30], 3, 2,
    'ESPRIT Ghazela → Manouba · retour 17h30',
    'Trajet retour après les cours, départ du parking principal. 3 places, 2 TND.',
    ['covoiturage', 'manouba', 'esprit', 'retour'],
    { age: 20, likes: 2 }),
  ride('aziz.benamor', P.ennasr, P.ghazela, [-2, 8, 0], 2, 1,
    'Ennasr → ESPRIT Ghazela · lundi 8h',
    "Trajet de lundi matin, départ devant la mosquée d'Ennasr 2.",
    ['covoiturage', 'ennasr', 'esprit'],
    { age: 72, likes: 1, status: 'closed', requests: [{ by: 'mariem.jlassi', seats: 1, status: 'accepted', message: 'Merci Aziz !' }] }),

  // ----- Lost & found (pairs for the matching) -----
  item('yasmine.haddad', 'perdu', 'Sac à dos noir Nike perdu à la bibliothèque',
    "J'ai perdu mon sac à dos noir (Nike) avec un trousseau rouge, un ordinateur portable et mon cahier de réseaux. Une récompense symbolique est prévue !",
    ['sac', 'nike', 'bibliotheque'], 'sac', 1, 'Bibliothèque ESPRIT', { age: 26, likes: 2 }),
  item('admin', 'trouve', 'Cartable noir trouvé près de la bibliothèque',
    "Cartable noir de marque Nike avec un porte-clés rouge, déposé à l'accueil de l'administration. À récupérer avec une pièce d'identité.",
    ['cartable', 'accueil'], 'sac', 1, 'Bibliothèque',
    {
      age: 22,
      comments: [
        { by: 'yasmine.haddad', content: "C'est sûrement le mien ! Je passe à l'accueil à midi." },
        { by: 'admin', content: "Il vous attend, pensez à votre carte d'étudiant.", replyTo: 0 },
      ],
    }),
  item('ahmed.karray', 'trouve', 'Sac à dos rouge Adidas trouvé en salle B12',
    'Sac à dos rouge Adidas oublié après le TD de jeudi. Il contient des cahiers et une gourde.',
    ['sac', 'adidas'], 'sac', 2, 'Salle B12 Bloc B', { age: 50 }),
  item('nour.chaabane', 'perdu', 'Écouteurs sans fil blancs perdus (boîtier gris)',
    "J'ai perdu mes écouteurs sans fil blancs dans leur boîtier gris, probablement à la cafétéria pendant la pause de midi.",
    ['ecouteurs', 'cafeteria'], 'ecouteurs', 1, 'Cafétéria', { age: 30 }),
  item('amira.bensalah', 'trouve', "Boîtier d'écouteurs blanc trouvé à la cafétéria",
    "Petit boîtier d'écouteurs blanc trouvé sur une table de la cafétéria. Décrivez la marque pour le récupérer.",
    ['ecouteurs', 'boitier'], 'ecouteurs', 1, 'Cafétéria', { age: 28 }),
  item('malek.ayari', 'perdu', 'محفظة جلدية بنية ضاعت قرب المبيت',
    'ضاعت مني محفظة جلدية بنية فيها بطاقة الطالب وبطاقة بنكية. إذا وجدها أحد يتصل بي من فضلكم، شكرا.',
    ['محفظة', 'مبيت'], 'portefeuille', 2, 'Foyer universitaire', { age: 44 }),
  item('hamza.dridi', 'trouve', 'Portefeuille en cuir marron trouvé devant le foyer',
    "Portefeuille marron en cuir contenant une carte d'étudiant. Je l'ai gardé : contactez-moi en décrivant son contenu.",
    ['portefeuille', 'cuir'], 'portefeuille', 1, 'Foyer universitaire', { age: 24 }),
  item('karim.trabelsi', 'perdu', 'Clés avec porte-clé Tour Eiffel',
    "J'ai égaré mon trousseau de clés avec un porte-clé Tour Eiffel, sans doute sur le parking des enseignants.",
    ['cles', 'parking'], 'cles', 3, 'Parking enseignants', { age: 70 }),
  item('aziz.benamor', 'trouve', 'Trousseau de 3 clés avec mini Tour Eiffel',
    'Trouvé ce matin un trousseau de 3 clés avec une petite Tour Eiffel métallique près du parking.',
    ['cles', 'trousseau'], 'cles', 2, 'Parking', { age: 48 }),
  item('admin', 'trouve', 'Calculatrice scientifique Casio fx-991',
    "Calculatrice Casio retrouvée en amphi A après l'examen. Disponible à l'accueil.",
    ['calculatrice', 'casio'], 'calculatrice', 4, 'Amphi A', { age: 95 }),
  item('youssef.hammami', 'trouve', "Carte d'étudiant retrouvée",
    "Une carte d'étudiant a été retrouvée dans un couloir du bâtiment principal. Elle a été rendue à sa propriétaire.",
    ['carte etudiant', 'trouve'], 'carte etudiant', 6, 'Couloir du bâtiment principal', { age: 140, status: 'resolved' }),

  // ----- Experiences -----
  post('selim.rekik', 'experience', "Mon stage de fin d'études en fintech : 5 leçons",
    "Après 4 mois dans une équipe qui développe des applications bancaires, voici ce que j'ai appris : 1) lire le code des autres avant d'écrire le sien, 2) les tests sauvent des nuits, 3) la sécurité n'est pas une option, 4) poser des questions tôt, 5) documenter pendant qu'on code. Si vous cherchez un stage, n'hésitez pas à me demander.",
    ['stage', 'fintech', 'conseils'],
    {
      age: 40, likes: 5, location: 'Tunis',
      comments: [
        { by: 'ines.zouari', content: 'Merci Selim ! Tu as fait ton stage où ?' },
        { by: 'selim.rekik', content: 'Chez un éditeur de logiciels bancaires à Tunis, je te donne les détails en message.', replyTo: 0 },
      ],
    }),
  post('amira.bensalah', 'experience', 'Réussir son projet de fin de module : conseils',
    'Après des années de soutenances, trois choses font la différence : un sujet délimité, un dépôt Git propre dès le premier jour et une démo répétée au moins deux fois. Le reste suit.',
    ['projet', 'conseils', 'soutenance'], { age: 60, likes: 3 }),
  post('sarra.mansouri', 'experience', 'Mes conseils pour réussir les examens',
    "Réviser régulièrement, préparer des fiches de synthèse et refaire les exercices des années précédentes. Et dormir la veille de l'examen ! Bon courage à tous.",
    ['examens', 'conseils', 'etudes'],
    {
      age: 80, likes: 4, location: 'ESPRIT Ghazela',
      comments: [
        { by: 'lina.bouazizi', content: 'Thanks! Past exams helped me a lot too.' },
        { by: 'mariem.jlassi', content: 'Tu as des fiches à partager pour la BDD ?' },
      ],
    }),
  post('rami.belhaj', 'experience', 'My first semester at ESPRIT',
    'The start can feel overwhelming, but joining a club, meeting people from other groups and planning the week on Sunday made a big difference for me.',
    ['university', 'experience', 'students'], { age: 100, likes: 2 }),

  // ----- Ideas -----
  post('nour.chaabane', 'idee', 'Une salle de révision ouverte 24h/24 pendant les examens',
    "Pendant la période d'examens, la bibliothèque ferme trop tôt. Et si une salle restait ouverte la nuit, avec prises, Wi-Fi et café ? Likez si vous êtes d'accord !",
    ['idee', 'examens', 'bibliotheque'],
    { age: 36, likes: 6, comments: [{ by: 'hamza.dridi', content: 'Oui ! Surtout pendant les partiels de janvier.' }] }),
  post('ines.zouari', 'idee', 'Une bibliothèque de résumés et de polycopiés',
    'Chaque année on refait les mêmes résumés. Des ressources classées par matière et par niveau, avec des notes, feraient gagner du temps à tout le monde.',
    ['idee', 'ressources', 'cours'], { age: 52, likes: 3 }),
  post('admin', 'idee', 'Hackathon CampusLink : proposez vos thèmes',
    'Nous préparons un hackathon étudiant sur la vie du campus. Quelles thématiques voulez-vous ? Mobilité, entraide, environnement… Répondez en commentaire !',
    ['hackathon', 'campus', 'evenement'],
    {
      age: 12, likes: 5, location: 'ESPRIT Ghazela',
      comments: [
        { by: 'aziz.benamor', content: "Mobilité : améliorer le covoiturage entre les blocs et l'arrêt de métro." },
        { by: 'aya.khelifi', content: 'Environnement : le tri des déchets sur le campus.' },
      ],
    }),
  post('aziz.benamor', 'idee', 'Créer un club de programmation',
    'Un club pour apprendre le développement web, partager nos projets et organiser des ateliers. Qui est partant ?',
    ['programmation', 'club', 'web'],
    { age: 30, likes: 4, comments: [{ by: 'omar.ferchichi', content: 'Great idea, I can run a React workshop.' }] }),
  post('aya.khelifi', 'idee', 'Une boîte à livres sur le campus',
    'Installer une boîte à livres pour échanger gratuitement manuels et romans entre étudiants.',
    ['livres', 'idee', 'campus'], { age: 120, likes: 2, status: 'closed' }),
];

// Ride searches ("Look for a ride"). The first two match a ride above, the last one waits for a live demo.
const SEARCHES = [
  { by: 'malek.ayari', from: P.manouba, to: P.ghazela, when: [1, 8, 0], windowMin: 90, seats: 1, maxPrice: 5, note: 'Je peux attendre 10 minutes', age: 30 },
  { by: 'youssef.hammami', from: P.tunis, to: P.sousse, when: [3, 14, 30], windowMin: 120, seats: 1, maxPrice: 15, note: 'Une petite valise', age: 26 },
  { by: 'skander.mejri', from: P.ennasr, to: P.ghazela, when: [1, 8, 15], windowMin: 60, seats: 1, maxPrice: 4, note: 'Cours à 8h30', age: 4 },
];

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

module.exports = {
  name: 'forum',
  run: async ({ users, now, time, log }) => {
    const user = (slug) => {
      const found = users.byEmail[`${slug}@campuslink.local`];
      if (!found) throw new Error(`Unknown demo account ${slug}@campuslink.local`);
      return found;
    };
    const today = time.formatLocalDate(now);
    const at = ([days, hour, minute]) => atLocalTime(time.addDaysToDateString(today, days), { hour, minute });
    const ago = (hours) => new Date(now.getTime() - hours * HOUR_MS);
    const later = (date, hours) => new Date(date.getTime() + hours * HOUR_MS);

    // Previous run (and anything the demo accounts wrote since).
    const demoIds = Object.values(users.byEmail).map(({ _id }) => _id);
    const old = (await Post.find({ author: { $in: demoIds } }).select('_id').lean()).map(({ _id }) => _id);
    await Promise.all([
      Comment.deleteMany({ $or: [{ post: { $in: old } }, { author: { $in: demoIds } }] }),
      Reservation.deleteMany({ $or: [{ post: { $in: old } }, { passenger: { $in: demoIds } }, { driver: { $in: demoIds } }] }),
      RideSearch.deleteMany({ user: { $in: demoIds } }),
      ForumNotification.deleteMany({ user: { $in: demoIds } }),
    ]);
    await Post.deleteMany({ _id: { $in: old } });

    // Who likes: students and teachers, in a different order for every post.
    const likers = [...users.students, ...users.teachers];
    const notifications = [];
    const counts = { posts: 0, comments: 0, requests: 0 };
    const rides = [];

    for (const [index, spec] of POSTS.entries()) {
      const author = user(spec.by);
      const createdAt = ago(spec.age);
      const accepted = (spec.requests || []).filter(({ status }) => status === 'accepted').reduce((sum, { seats }) => sum + seats, 0);
      const likes = likers
        .slice(index % likers.length)
        .concat(likers.slice(0, index % likers.length))
        .filter(({ _id }) => String(_id) !== String(author._id))
        .slice(0, spec.likes || 0)
        .map(({ _id }) => _id);

      const data = {
        author: author._id,
        type: spec.type,
        title: spec.title,
        description: spec.description,
        tags: spec.tags,
        location: spec.location,
        status: spec.status || 'active',
        likes,
        likesCount: likes.length,
        views: 8 + ((index * 37) % 240),
        createdAt,
        updatedAt: createdAt,
      };
      if (spec.route) data.covoiturage = { ...spec.route, departureDate: at(spec.when), seats: spec.offered - accepted };
      if (spec.item) {
        const { kind, category, daysAgo, place } = spec.item;
        data.objetPerdu = { kind, category, place, date: atLocalTime(time.addDaysToDateString(today, -daysAgo), { hour: 12, minute: 0 }) };
      }
      // timestamps: false keeps the dates set here; create() runs the hook that fills covoiturage.departureGeo.
      const [doc] = await Post.create([data], { timestamps: false });
      counts.posts += 1;

      const saved = [];
      for (const [position, { by, content, replyTo }] of (spec.comments || []).entries()) {
        const commentAt = later(createdAt, (position + 1) / 3);
        const parent = replyTo === undefined ? null : saved[replyTo]._id;
        const [comment] = await Comment.create(
          [{ post: doc._id, author: user(by)._id, content, parent, createdAt: commentAt, updatedAt: commentAt }],
          { timestamps: false }
        );
        saved.push(comment);
      }
      if (saved.length > 0) await Post.updateOne({ _id: doc._id }, { $set: { commentsCount: saved.length } }, { timestamps: false });
      counts.comments += saved.length;

      // Seat requests, and the notifications the API sent for them (reservationController.js).
      const routeText = spec.route ? `${spec.route.departure} → ${spec.route.destination}` : '';
      for (const [position, request] of (spec.requests || []).entries()) {
        const requestedAt = later(createdAt, 1 + position);
        const answeredAt = later(requestedAt, 1);
        const passenger = user(request.by);
        const stamp = request.status === 'pending' ? requestedAt : answeredAt;
        const [reservation] = await Reservation.create(
          [{ post: doc._id, passenger: passenger._id, driver: author._id, seats: request.seats, message: request.message, status: request.status, createdAt: requestedAt, updatedAt: stamp }],
          { timestamps: false }
        );
        counts.requests += 1;
        const refs = { postId: doc._id, reservationId: reservation._id };
        notifications.push({
          user: author._id, type: 'reservation:new', title: 'New seat request',
          body: `${plural(request.seats, 'seat')} · ${routeText}`, data: refs,
          read: request.status !== 'pending', createdAt: requestedAt,
        });
        if (request.status !== 'pending') {
          notifications.push({
            user: passenger._id, type: `reservation:${request.status}`,
            title: request.status === 'accepted' ? 'Your seat request was accepted' : 'Your seat request was declined',
            body: routeText, data: refs, read: spec.status === 'closed', createdAt: answeredAt,
          });
        }
      }
      if (spec.route && data.status === 'active') rides.push(doc);
    }

    // Ride searches, then the searches each ride matches, found like when a ride is published (rideMatching.js).
    for (const search of SEARCHES) {
      const createdAt = ago(search.age);
      await RideSearch.create(
        [{
          user: user(search.by)._id,
          departure: search.from.name,
          destination: search.to.name,
          departureCoords: { lat: search.from.lat, lng: search.from.lng },
          destinationCoords: { lat: search.to.lat, lng: search.to.lng },
          when: at(search.when),
          windowMin: search.windowMin,
          seats: search.seats,
          maxPrice: search.maxPrice,
          note: search.note,
          createdAt,
          updatedAt: createdAt,
        }],
        { timestamps: false }
      );
    }
    let matched = 0;
    for (const doc of rides.map((ride) => ride.toObject())) {
      const c = doc.covoiturage;
      for (const match of await searchesForRide(doc)) {
        // Standard text of rideMatching.notifyRideSearchers (the AI sentence needs OpenRouter).
        notifications.push({
          user: match.search.user, type: 'ride:match', title: 'A ride matches your search',
          body: `${c.departure} → ${c.destination} · ${plural(c.seats, 'seat')} left`,
          data: { postId: doc._id, searchId: match.search._id, score: match.score },
          read: false, createdAt: later(doc.createdAt, 0.1),
        });
        await RideSearch.updateOne({ _id: match.search._id }, { $addToSet: { notifiedPosts: doc._id } }, { timestamps: false });
        matched += 1;
      }
    }

    if (notifications.length > 0) {
      await ForumNotification.create(
        notifications.map((notification) => ({ ...notification, updatedAt: notification.createdAt })),
        { timestamps: false }
      );
    }
    log(
      `${counts.posts} forum posts (${rides.length} upcoming rides), ${counts.comments} comments, ${counts.requests} seat requests, ` +
        `${SEARCHES.length} ride searches (${matched} matched), ${notifications.length} forum notifications.`
    );
  },
};
