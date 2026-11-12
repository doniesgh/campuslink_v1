/*postuler*/
const express = require('express');
const router = express.Router();
const c = require('../controllers/opportunityController');
const { requireAuth, requireRole } = require('../middleware/requireAuth');
const { createUpload } = require('../middleware/upload');

// CV : PDF ou DOCX, 5 Mo maximum, gardé en mémoire puis enregistré par service/storageService.js
// (GridFS quand STORAGE_DRIVER=gridfs, comme sur Render). Une requête JSON sans fichier passe telle quelle.
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const uploadCv = createUpload({
  field: 'cv',
  types: { 'application/pdf': ['.pdf'], [DOCX]: ['.docx'] },
  maxFileSizeMb: 5,
});

// Mounted at /api/opportunities. Every route needs a signed-in user (via the /bff relay).
router.use(requireAuth);

// Qui peut faire quoi : modifier ces deux listes suffit pour changer les droits.
const APPLICANTS = ['STUDENT']; // postulent, suivent « Où j'ai postulé »
const RECRUITERS = ['COMPANY', 'ADMIN']; // publient des offres, gèrent les « Demandes »

// Candidatures (avant '/:id' pour que ces chemins ne soient pas pris pour un identifiant d'offre)
router.get('/applications/me', requireRole(...APPLICANTS), c.getMyApplications);
router.get('/applications/received', requireRole(...RECRUITERS), c.getReceivedApplications);
router.get('/applications/:id/cv', requireRole(...APPLICANTS, ...RECRUITERS), c.downloadCv); // le contrôleur vérifie à qui appartient la candidature
router.patch('/applications/:id/status', requireRole(...RECRUITERS), c.updateApplicationStatus);
router.delete('/applications/:id', requireRole(...APPLICANTS), c.deleteApplication);

// Offres : lecture pour tout utilisateur connecté, écriture pour les recruteurs
router.get('/', c.getOpportunities);
router.get('/:id', c.getOpportunity);
router.post('/', requireRole(...RECRUITERS), c.createOpportunity);
router.put('/:id', requireRole(...RECRUITERS), c.updateOpportunity);
router.delete('/:id', requireRole(...RECRUITERS), c.deleteOpportunity);

//router.post('/:id/apply', c.apply);
router.post('/:id/apply', requireRole(...APPLICANTS), uploadCv, c.apply);
router.get('/:id/applications', requireRole(...RECRUITERS), c.getApplicationsOfOpportunity);

const { userRateLimit } = require('../middleware/rateLimit');
const summaryRateLimit = userRateLimit({
  name: 'offer-summary', limitEnv: 'RATE_LIMIT_AI_MAX', defaultLimit: 30, defaultWindowMs: 60 * 60 * 1000,
});

// après la route apply
router.post('/:id/summary', summaryRateLimit, c.summarizeOpportunity);

module.exports = router;
