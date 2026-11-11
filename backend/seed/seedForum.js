// scripts/seedForum.js — posts de démonstration pour le forum CampusLink
//
//   node scripts/seedForum.js            ajoute les posts
//   node scripts/seedForum.js --reset    supprime d'abord TOUS les posts et recherches de ces 4 utilisateurs
//
// Les dates sont relatives à l'heure d'exécution : relance le script juste avant la démo.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); // le .env est dans backend/, pas dans seed/
const mongoose = require('mongoose');
const Post = require('../models/Post');
const RideSearch = require('../models/RideSearch');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/CampusLink'; // attention à la casse : la base existante s'appelle CampusLink

// ---------- Les 4 utilisateurs ----------
const U = {
  student: '6ae4a46b24d620131129899f', // Student Student
  admin: '6af377a34f12b8bec904d219',   // Admin CampusLink
  amira: '6af377a34f12b8bec904d21a',   // Amira Ben Salah (enseignante)
  user4: '6af377a44f12b8bec904d21b',   // 4e utilisateur (renomme-le si tu veux)
};
const ids = Object.values(U);

// ---------- Lieux (coordonnées approximatives, région de Tunis) ----------
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

// ---------- Utilitaires ----------
const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d; };
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const likesFrom = (n) => ids.slice(0, Math.min(n, ids.length));

function km(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

const base = (author, type, title, description, tags, extra = {}) => {
  const likes = extra.likes || [];
  delete extra.likes;
  return { author, type, title, description, tags, likes, likesCount: likes.length, views: rnd(25, 320), ...extra };
};

function ride(author, from, to, when, seats, price, title, description, tags, extra = {}) {
  const distanceKm = Math.round(km(from, to) * 1.25 * 10) / 10;
  return base(author, 'covoiturage', title, description, tags, {
    covoiturage: {
      departure: from.name, destination: to.name, departureDate: when, seats, price,
      departureCoords: { lat: from.lat, lng: from.lng },
      destinationCoords: { lat: to.lat, lng: to.lng },
      distanceKm, durationMin: Math.round(distanceKm * 1.6),
    },
    ...extra,
  });
}

function item(author, kind, title, description, tags, category, daysAgo, place, extra = {}) {
  const date = new Date(); date.setDate(date.getDate() - daysAgo); date.setHours(12, 0, 0, 0);
  return base(author, 'objet_perdu', title, description, tags, { objetPerdu: { kind, category, date, place }, ...extra });
}

// ---------- Les posts ----------
const posts = [
  // ===== Covoiturage =====
  ride(U.amira, P.manouba, P.ghazela, at(1, 7, 45), 3, 2,
    'Manouba → ESPRIT Ghazela · départ 7h45',
    "Je fais ce trajet chaque matin par la route de Bizerte. Départ devant la gare de la Manouba, arrivée à 8h20 environ. Ambiance calme, musique douce, pas de fumeurs. Il reste 3 places !",
    ['covoiturage', 'manouba', 'esprit', 'matin'], { likes: likesFrom(3), createdAt: hoursAgo(3) }),
  ride(U.user4, P.benArous, P.ghazela, at(1, 7, 30), 2, 3,
    'Ben Arous → ESPRIT Ghazela · 7h30',
    "Départ de la station de métro de Ben Arous, arrivée avant 8h15 pour le premier cours. Voiture climatisée, je peux faire un petit détour par Ennasr si besoin.",
    ['covoiturage', 'benarous', 'esprit'], { likes: likesFrom(2), createdAt: hoursAgo(6) }),
  ride(U.user4, P.tunis, P.sousse, at(3, 15), 3, 12,
    'Tunis → Sousse · vendredi 15h',
    "Je rentre à Sousse pour le week-end. 3 places, bagages acceptés, une pause café à Enfidha. Participation aux frais : 12 TND par personne.",
    ['covoiturage', 'sousse', 'weekend'], { likes: likesFrom(4), createdAt: hoursAgo(10) }),
  ride(U.student, P.ariana, P.marsa, at(1, 18), 2, 2,
    'Ariana → La Marsa · ce soir 18h',
    "Après les cours, direction La Marsa. Deux places libres, on peut s'arrêter à la plage si le temps le permet !",
    ['covoiturage', 'marsa', 'soir'], { likes: likesFrom(1), createdAt: hoursAgo(14) }),
  ride(U.student, P.ghazela, P.manouba, at(1, 17, 30), 3, 2,
    'ESPRIT Ghazela → Manouba · retour 17h30',
    "Trajet retour après les cours, départ du parking principal. 3 places, 2 TND.",
    ['covoiturage', 'manouba', 'esprit', 'retour'], { likes: likesFrom(2), createdAt: hoursAgo(20) }),

  // ===== Objets perdus / trouvés (paires faites pour le matching IA) =====
  item(U.student, 'perdu', 'Sac à dos noir Nike perdu à la bibliothèque',
    "J'ai perdu mon sac à dos noir (Nike) avec un trousseau rouge, un ordinateur portable et mon cahier de réseaux. Une récompense symbolique est prévue !",
    ['sac', 'nike', 'bibliotheque'], 'sac', 1, 'Bibliothèque ESPRIT', { likes: likesFrom(2), createdAt: hoursAgo(26) }),
  item(U.admin, 'trouve', 'Cartable noir trouvé près de la bibliothèque',
    "Cartable noir de marque Nike avec un porte-clés rouge, déposé à l'accueil de l'administration. À récupérer avec une pièce d'identité.",
    ['cartable', 'accueil'], 'sac', 1, 'Bibliothèque', { createdAt: hoursAgo(22) }),
  item(U.user4, 'trouve', 'Sac à dos rouge Adidas trouvé en salle B12',
    "Sac à dos rouge Adidas oublié après le TD de jeudi. Il contient des cahiers et une gourde.",
    ['sac', 'adidas'], 'sac', 2, 'Salle B12 Bloc B', { createdAt: hoursAgo(50) }), // leurre : autre couleur et marque

  item(U.user4, 'perdu', 'Écouteurs sans fil blancs perdus (boîtier gris)',
    "J'ai perdu mes écouteurs sans fil blancs dans leur boîtier gris, probablement à la cafétéria pendant la pause de midi.",
    ['ecouteurs', 'cafeteria'], 'ecouteurs', 1, 'Cafétéria', { createdAt: hoursAgo(30) }),
  item(U.amira, 'trouve', "Boîtier d'écouteurs blanc trouvé à la cafétéria",
    "Petit boîtier d'écouteurs blanc trouvé sur une table de la cafétéria. Décrivez la marque pour le récupérer.",
    ['ecouteurs', 'boitier'], 'ecouteurs', 1, 'Cafétéria', { createdAt: hoursAgo(28) }),

  item(U.student, 'perdu', 'محفظة جلدية بنية ضاعت قرب المبيت',
    'ضاعت مني محفظة جلدية بنية فيها بطاقة الطالب وبطاقة بنكية. إذا وجدها أحد يتصل بي من فضلكم، شكرا.',
    ['محفظة', 'مبيت'], 'portefeuille', 2, 'Foyer universitaire', { createdAt: hoursAgo(44) }), // en arabe : l'IA fait le lien avec le post français
  item(U.user4, 'trouve', 'Portefeuille en cuir marron trouvé devant le foyer',
    "Portefeuille marron en cuir contenant une carte d'étudiant. Je l'ai gardé : contactez-moi en décrivant son contenu.",
    ['portefeuille', 'cuir'], 'portefeuille', 1, 'Foyer universitaire', { createdAt: hoursAgo(24) }),

  item(U.amira, 'perdu', 'Clés avec porte-clé Tour Eiffel',
    "J'ai égaré mon trousseau de clés avec un porte-clé Tour Eiffel, sans doute sur le parking des enseignants.",
    ['cles', 'parking'], 'cles', 3, 'Parking enseignants', { createdAt: hoursAgo(70) }),
  item(U.student, 'trouve', 'Trousseau de 3 clés avec mini Tour Eiffel',
    "Trouvé ce matin un trousseau de 3 clés avec une petite Tour Eiffel métallique près du parking.",
    ['cles', 'trousseau'], 'cles', 2, 'Parking', { createdAt: hoursAgo(48) }),

  item(U.admin, 'trouve', 'Calculatrice scientifique Casio fx-991',
    "Calculatrice Casio retrouvée en amphi A après l'examen. Disponible à l'accueil.",
    ['calculatrice', 'casio'], 'calculatrice', 4, 'Amphi A', { createdAt: hoursAgo(95) }), // sans correspondance

  // ===== Expériences =====
  base(U.student, 'experience', "Mon stage de fin d'études en fintech : 5 leçons",
    "Après 4 mois dans une équipe qui développe des applications bancaires, voici ce que j'ai appris : 1) lire le code des autres avant d'écrire le sien, 2) les tests sauvent des nuits, 3) la sécurité n'est pas une option, 4) poser des questions tôt, 5) documenter pendant qu'on code. Si vous cherchez un stage, n'hésitez pas à me demander.",
    ['stage', 'fintech', 'conseils'], { likes: likesFrom(4), createdAt: hoursAgo(40) }),
  base(U.amira, 'experience', 'Réussir son projet de fin de module : conseils',
    "Après des années de soutenances, trois choses font la différence : un sujet délimité, un dépôt Git propre dès le premier jour et une démo répétée au moins deux fois. Le reste suit.",
    ['projet', 'conseils', 'soutenance'], { likes: likesFrom(3), createdAt: hoursAgo(60) }),

  // ===== Idées =====
  base(U.user4, 'idee', 'Une salle de révision ouverte 24h/24 pendant les examens',
    "Pendant la période d'examens, la bibliothèque ferme trop tôt. Et si une salle restait ouverte la nuit, avec prises, Wi-Fi et café ? Votez si vous êtes d'accord !",
    ['idee', 'examens', 'bibliotheque'], { likes: likesFrom(4), createdAt: hoursAgo(36) }),
  base(U.student, 'idee', 'Une application pour partager polycopiés et résumés',
    "Chaque année on refait les mêmes résumés. Une bibliothèque de ressources classées par matière et par niveau, avec notation, ferait gagner du temps à tout le monde.",
    ['idee', 'ressources', 'cours'], { likes: likesFrom(3), createdAt: hoursAgo(52) }),
  base(U.admin, 'idee', 'Hackathon CampusLink : proposez vos idées',
    "Nous préparons un hackathon étudiant sur la vie du campus. Quelles thématiques voulez-vous ? Mobilité, entraide, environnement… Répondez en commentaire !",
    ['hackathon', 'campus', 'evenement'], { likes: likesFrom(4), createdAt: hoursAgo(12) }),
];

// ---------- Recherches de covoiturage ----------
const search = (user, from, to, when, windowMin, seats, maxPrice, note) => ({
  user, departure: from.name, destination: to.name,
  departureCoords: { lat: from.lat, lng: from.lng },
  destinationCoords: { lat: to.lat, lng: to.lng },
  when, windowMin, seats, maxPrice, note,
});

const searches = [
  search(U.student, P.manouba, P.ghazela, at(1, 8), 90, 1, 5, 'Je peux attendre 10 minutes'),       // correspond au trajet d'Amira
  search(U.amira, P.tunis, P.sousse, at(3, 14, 30), 120, 1, 15, 'Une petite valise'),              // correspond au trajet de user4
  search(U.user4, P.ennasr, P.ghazela, at(1, 8, 15), 60, 1, 4, 'Cours à 8h30'),                    // sans trajet : à utiliser pour la démo en direct
];

// ---------- Exécution ----------
(async () => {
  await mongoose.connect(MONGO_URI);
  if (process.argv.includes('--reset')) {
    const a = await Post.deleteMany({ author: { $in: ids } });
    const b = await RideSearch.deleteMany({ user: { $in: ids } });
    console.log(`Reset : ${a.deletedCount} posts et ${b.deletedCount} recherches supprimés`);
  }
  for (const p of posts) await Post.create(p); // create() : exécute les hooks qui calculent departureGeo
  for (const s of searches) await RideSearch.create(s);
  console.log(`OK : ${posts.length} posts et ${searches.length} recherches créés`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });