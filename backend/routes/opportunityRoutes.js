const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'uploads', 'cv');
fs.mkdirSync(dir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: dir,
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^\w.-]/g, '_')),
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
    fileFilter: (req, file, cb) =>
        /\.(pdf|doc|docx)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('CV : PDF, DOC ou DOCX seulement')),
});
/*postuler*/
const express = require('express');
const router = express.Router();
const c = require('../controllers/opportunityController');
const { requireAuth, requireRole } = require('../middleware/requireAuth');

// Mounted at /api/opportunities. Every route needs a signed-in user (via the /bff relay).
router.use(requireAuth);

// Qui peut faire quoi : modifier ces deux listes suffit pour changer les droits.
const APPLICANTS = ['STUDENT']; // postulent, suivent « Où j'ai postulé »
const RECRUITERS = ['COMPANY', 'ADMIN']; // publient des offres, gèrent les « Demandes »

// Candidatures (avant '/:id' pour que ces chemins ne soient pas pris pour un identifiant d'offre)
router.get('/applications/me', requireRole(...APPLICANTS), c.getMyApplications);
router.get('/applications/received', requireRole(...RECRUITERS), c.getReceivedApplications);
router.patch('/applications/:id/status', requireRole(...RECRUITERS), c.updateApplicationStatus);
router.delete('/applications/:id', requireRole(...APPLICANTS), c.deleteApplication);

// Offres : lecture pour tout utilisateur connecté, écriture pour les recruteurs
router.get('/', c.getOpportunities);
router.get('/:id', c.getOpportunity);
router.post('/', requireRole(...RECRUITERS), c.createOpportunity);
router.put('/:id', requireRole(...RECRUITERS), c.updateOpportunity);
router.delete('/:id', requireRole(...RECRUITERS), c.deleteOpportunity);

//router.post('/:id/apply', c.apply);
router.post('/:id/apply', requireRole(...APPLICANTS), upload.single('cv'), c.apply);
router.get('/:id/applications', requireRole(...RECRUITERS), c.getApplicationsOfOpportunity);

module.exports = router;
