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

router.post('/:id/apply', c.apply);
router.get('/:id/applications', c.getApplicationsOfOpportunity);

module.exports = router;