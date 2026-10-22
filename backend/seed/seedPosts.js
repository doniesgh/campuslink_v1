const mongoose = require('mongoose');
require('dotenv').config();

const Post = require('../models/Post');
const User = require('../models/userModel');

const seedPosts = [
  // 1. Carpooling
  {
    type: 'covoiturage',
    title: 'Covoiturage vers le campus',
    description:
      'Je cherche des étudiants intéressés par un covoiturage le matin vers le campus. Contactez-moi pour organiser les horaires.',
    tags: ['covoiturage', 'campus', 'transport'],
    location: 'Tunis',
    covoiturage: {
      departure: 'Centre-ville de Tunis',
      destination: 'Campus universitaire',
      departureDate: new Date('2027-01-15T07:30:00'),
      seats: 3,
      price: 5,
      contactPhone: '',
    },
    status: 'active',
  },
  {
    type: 'covoiturage',
    title: 'Trajet retour après les cours',
    description:
      'Je propose un trajet retour après les cours. Il reste quelques places, envoyez-moi un message pour les détails.',
    tags: ['transport', 'covoiturage'],
    location: 'Tunis',
    covoiturage: {
      departure: 'Campus universitaire',
      destination: 'Ariana',
      departureDate: new Date('2027-01-15T16:30:00'),
      seats: 2,
      price: 4,
      contactPhone: '',
    },
    status: 'active',
  },

  // 2. Lost and found
  {
    type: 'objet_perdu',
    title: 'Clés perdues près de la bibliothèque',
    description:
      'J’ai perdu un trousseau de clés près de la bibliothèque. Si vous les avez trouvées, merci de contacter leur propriétaire.',
    tags: ['clés', 'perdu', 'bibliothèque'],
    location: 'Bibliothèque universitaire',
    objetPerdu: {
      kind: 'perdu',
      category: 'Clés',
      date: new Date('2026-10-20'),
      place: 'Bibliothèque universitaire',
      contactPhone: '',
    },
    status: 'active',
  },
  {
    type: 'objet_perdu',
    title: 'Carte étudiante retrouvée',
    description:
      'Une carte étudiante a été retrouvée dans un couloir du campus. Le propriétaire peut me contacter pour la récupérer.',
    tags: ['carte étudiante', 'trouvé', 'campus'],
    location: 'Campus universitaire',
    objetPerdu: {
      kind: 'trouve',
      category: 'Carte étudiante',
      date: new Date('2026-10-21'),
      place: 'Couloir du bâtiment principal',
      contactPhone: '',
    },
    status: 'active',
  },

  // 3. Experiences
  {
    type: 'experience',
    title: 'Mes conseils pour réussir les examens',
    description:
      'Mon conseil est de réviser régulièrement, de préparer des fiches de synthèse et de travailler avec des exercices des années précédentes. Bon courage à tous !',
    tags: ['examens', 'conseils', 'études'],
    location: 'Campus universitaire',
    status: 'active',
  },
  {
    type: 'experience',
    title: 'Mon premier semestre à l’université',
    description:
      'Le début peut sembler difficile, mais participer aux activités, rencontrer d’autres étudiants et bien organiser son temps aide beaucoup.',
    tags: ['université', 'expérience', 'étudiants'],
    status: 'active',
  },

  // 4. Ideas
  {
    type: 'idee',
    title: 'Créer un club de programmation',
    description:
      'Que pensez-vous de créer un club où les étudiants pourraient apprendre le développement web, partager leurs projets et organiser des ateliers ?',
    tags: ['programmation', 'club', 'développement web'],
    location: 'Campus universitaire',
    status: 'active',
  },
  {
    type: 'idee',
    title: 'Une boîte à livres sur le campus',
    description:
      'Nous pourrions installer une boîte à livres pour échanger des manuels et des romans gratuitement entre étudiants.',
    tags: ['livres', 'idée', 'campus'],
    location: 'Campus universitaire',
    status: 'active',
  },
];

async function runSeed() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing from your .env file');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const author = await User.findOne().select('_id');

    if (!author) {
      throw new Error(
        'No users found. Register a user before running the seed.'
      );
    }

    // Remove this line if you want to keep existing posts.
    // WARNING: This deletes ALL documents in the posts collection.
    await Post.deleteMany({});

    const posts = seedPosts.map((post) => ({
      ...post,
      author: author._id,
    }));

    await Post.insertMany(posts);

    console.log(`Successfully inserted ${posts.length} posts.`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runSeed();