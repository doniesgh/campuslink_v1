// Seed plugin of the job offers (Annonces page): offers of every type published by the demo companies (COMPANY role)
// and the admin, and applications of demo students at every status, most with a PDF CV saved through
// service/storageService.js (disk locally, GridFS on Render), so recruiters can download them.
// Idempotent: the offers of the demo accounts and the applications of the demo students (and their CV files) are
// replaced; the other accounts' offers and applications are kept.
const Opportunity = require('../../models/Opportunity');
const Application = require('../../models/Application');
const storageService = require('../../service/storageService');

const DAY_MS = 24 * 60 * 60 * 1000;

// `by`: 0 / 1 = users.companies[i], 'admin'. `age`: days since publication.
const OFFERS = [
  {
    by: 0, age: 5, type: 'pfe', title: 'PFE - Application mobile de suivi de livraisons (Flutter)',
    domain: 'Développement mobile', duration: '6 mois', location: 'Tunis, Lac 2', contractType: 'Stage conventionné', level: 'Bac+5', filiere: 'TWIN',
    description: "Concevoir et développer l'application des livreurs : tournée du jour, suivi GPS, preuve de livraison (photo, signature) et mode hors ligne. Stack : Flutter, Firebase, API Node.js. Encadrement par un lead mobile, gratification mensuelle.",
  },
  {
    by: 0, age: 9, type: 'stage', title: "Stage d'été - Développeur web React / Node.js",
    domain: 'Développement web', duration: '2 mois (juillet - août)', location: 'Tunis, Lac 2', contractType: 'Stage', level: 'Bac+4', filiere: 'TWIN',
    description: "Rejoins l'équipe produit pour développer de nouveaux écrans de notre back-office (React, TypeScript) et les API qui vont avec (Node.js, MongoDB). Revue de code, tests et mise en production chaque semaine.",
  },
  {
    by: 1, age: 3, type: 'pfe', title: 'PFE - Détection de fraude par machine learning',
    domain: 'Data science', duration: '6 mois', location: 'Ariana, Technopole El Ghazala', contractType: 'Stage conventionné', level: 'Bac+5', filiere: 'DS',
    description: 'Construire un modèle de détection des transactions frauduleuses sur des données anonymisées : exploration, feature engineering, modèles (gradient boosting, isolation forest), explicabilité et mise en production d\'une API de scoring.',
  },
  {
    by: 1, age: 12, type: 'emploi', title: 'Data engineer junior (CDI)',
    domain: 'Data engineering', duration: '', location: 'Ariana', contractType: 'CDI', level: 'Bac+5', filiere: 'DS',
    description: 'Tu développes et maintiens nos pipelines de données (Python, Airflow, Spark) et notre entrepôt de données. Débutants bienvenus : parcours d\'intégration de 3 mois avec un mentor.',
  },
  {
    by: 0, age: 7, type: 'alternance', title: 'Alternance - DevOps / Cloud',
    domain: 'DevOps', duration: '12 mois', location: 'Tunis', contractType: 'Alternance', level: 'Bac+4', filiere: 'SAE',
    description: 'Automatiser nos déploiements (GitLab CI, Docker, Kubernetes), suivre la supervision (Prometheus, Grafana) et participer à la migration vers le cloud. Rythme : 3 jours en entreprise, 2 jours à l\'école.',
  },
  {
    by: 'admin', age: 1, type: 'projet', title: 'Projet étudiant - Site du club robotique',
    domain: 'Développement web', duration: '3 mois', location: 'ESPRIT Ghazela', contractType: 'Bénévolat', level: 'Tous niveaux', filiere: 'Toutes', company: 'ESPRIT',
    description: "Le club robotique cherche 2 ou 3 étudiants pour refaire son site : présentation des projets, calendrier des compétitions et inscriptions. Projet valorisable dans ton portfolio.",
  },
];

// `offer`: index in OFFERS. `cv`: attach a generated PDF CV.
const APPLICATIONS = [
  { student: 'yasmine.haddad', offer: 0, status: 'en_cours', age: 4, cv: true, coverLetter: "Passionnée par le développement mobile, j'ai réalisé une application Flutter de covoiturage en projet de module. Votre sujet de suivi de livraisons hors ligne correspond exactement à ce que je veux approfondir." },
  { student: 'yasmine.haddad', offer: 1, status: 'acceptee', age: 8, cv: true, coverLetter: "Je souhaite consolider mes compétences React et Node.js au sein d'une équipe produit." },
  { student: 'aziz.benamor', offer: 0, status: 'refusee', age: 4, cv: true, coverLetter: 'Intéressé par Flutter, je suis disponible à partir de février.' },
  { student: 'omar.ferchichi', offer: 1, status: 'envoyee', age: 2, cv: true, coverLetter: "I'm a 4TWIN student who loves building web apps with React and Node.js. I'd be glad to join your product team this summer." },
  { student: 'ines.zouari', offer: 2, status: 'en_cours', age: 2, cv: true, coverLetter: "Mon projet de module portait sur la détection d'anomalies : ce PFE est une suite naturelle." },
  { student: 'youssef.hammami', offer: 2, status: 'refusee', age: 3, cv: false, coverLetter: 'Très intéressé par la data science appliquée à la finance.' },
  { student: 'malek.ayari', offer: 3, status: 'envoyee', age: 6, cv: true, coverLetter: 'Diplômé en juin, je cherche un premier poste en data engineering.' },
  { student: 'aya.khelifi', offer: 4, status: 'envoyee', age: 5, cv: true, coverLetter: "L'alternance DevOps me permettrait d'appliquer ce que j'apprends en architecture logicielle." },
  { student: 'hamza.dridi', offer: 4, status: 'acceptee', age: 6, cv: true, coverLetter: 'Je pratique déjà Docker et GitLab CI sur mes projets personnels.' },
  { student: 'sarra.mansouri', offer: 5, status: 'envoyee', age: 0.5, cv: false, coverLetter: 'Membre du club depuis deux ans, je serais ravie de refaire le site !' },
];

const SKILLS = {
  TWIN: 'React, Angular, Node.js, Flutter, MongoDB',
  DS: 'Python, pandas, scikit-learn, SQL, Power BI',
  SAE: 'Java, Spring Boot, Docker, GitLab CI, UML',
};

// A one-page PDF (Helvetica, WinAnsi: Latin-1 text only).
const pdf = (lines) => {
  const escape = (text) => text.replace(/[\\()]/g, (char) => `\\${char}`);
  const content = lines
    .map((line, index) => `BT /F1 ${index === 0 ? 20 : 12} Tf 72 ${770 - index * 26} Td (${escape(line)}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = objects.map((body, index) => {
    const offset = Buffer.byteLength(out, 'latin1');
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
};

const cvOf = (student) => {
  const group = student.group?.name ?? '';
  const program = Object.keys(SKILLS).find((code) => group.includes(code)) ?? 'TWIN';
  return pdf([
    `${student.firstname} ${student.lastname}`,
    `Etudiant(e) en 4e annee ${group} - ESPRIT`,
    student.email,
    '',
    `Competences : ${SKILLS[program]}`,
    'Projets : application de covoiturage (PWA), tableau de bord de suivi des absences',
    'Langues : arabe, francais, anglais',
    'Activites : club robotique, hackathons',
  ]);
};

module.exports = {
  name: 'opportunities',
  run: async ({ users, now, log }) => {
    const student = (slug) => {
      const found = users.students.find(({ email }) => email === `${slug}@campuslink.local`);
      if (!found) throw new Error(`Unknown demo student ${slug}@campuslink.local`);
      return found;
    };
    const daysAgo = (days) => new Date(now.getTime() - days * DAY_MS);

    // Previous run: offers of the demo accounts, applications to them or by the demo students, and their CVs.
    const demoIds = Object.values(users.byEmail).map(({ _id }) => _id);
    const oldOffers = (await Opportunity.find({ author: { $in: demoIds } }).select('_id').lean()).map(({ _id }) => _id);
    const oldFilter = { $or: [{ opportunity: { $in: oldOffers } }, { student: { $in: demoIds } }] };
    for (const { cv } of await Application.find(oldFilter).select('cv').lean()) {
      if (cv?.key) await storageService.remove(cv.key);
    }
    await Application.deleteMany(oldFilter);
    await Opportunity.deleteMany({ _id: { $in: oldOffers } });

    const offers = [];
    for (const { by, age, company, ...fields } of OFFERS) {
      const author = by === 'admin' ? users.admin : users.companies[by];
      const createdAt = daysAgo(age);
      const [offer] = await Opportunity.create(
        [{ ...fields, company: company ?? author.company, author: author._id, status: 'approved', createdAt, updatedAt: createdAt }],
        { timestamps: false }
      );
      offers.push(offer);
    }

    let withCv = 0;
    for (const { student: slug, offer, status, age, cv, coverLetter } of APPLICATIONS) {
      const applicant = student(slug);
      let stored;
      if (cv) {
        const name = `CV-${applicant.firstname}-${applicant.lastname}.pdf`.replace(/\s+/g, '-');
        stored = await storageService.save({ buffer: cvOf(applicant), originalName: name, mimeType: 'application/pdf', folder: 'cv' });
        withCv += 1;
      }
      const createdAt = daysAgo(age);
      // Answered applications were updated a day later.
      const updatedAt = status === 'envoyee' ? createdAt : new Date(Math.min(now.getTime(), createdAt.getTime() + DAY_MS));
      await Application.create(
        [{
          opportunity: offers[offer]._id,
          student: applicant._id,
          coverLetter,
          status,
          cv: stored ? { key: stored.key, filename: stored.filename, mimeType: stored.mimeType, size: stored.size } : undefined,
          createdAt,
          updatedAt,
        }],
        { timestamps: false }
      );
    }

    log(`${offers.length} job offers (${users.companies.map(({ company }) => company).join(', ')}, ESPRIT), ${APPLICATIONS.length} applications (${withCv} with a CV).`);
  },
};
