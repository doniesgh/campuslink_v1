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

router.get('/applications/me', c.getMyApplications);
router.patch('/applications/:id/status', c.updateApplicationStatus);

router.get('/', c.getOpportunities);
router.get('/:id', c.getOpportunity);
router.post('/', c.createOpportunity);
router.put('/:id', c.updateOpportunity);
router.delete('/:id', c.deleteOpportunity);

//router.post('/:id/apply', c.apply);
router.post('/:id/apply', upload.single('cv'), c.apply);
router.get('/:id/applications', c.getApplicationsOfOpportunity);
router.delete('/applications/:id', c.deleteApplication);
module.exports = router;