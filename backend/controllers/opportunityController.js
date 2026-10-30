const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');

// ---------- Offres ----------
/*exports.getOpportunities = async (req, res) => {
  try {
    const { type, domain, location, contractType, level, q } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (domain) filter.domain = new RegExp(domain, 'i');
    if (location) filter.location = new RegExp(location, 'i');
    if (contractType) filter.contractType = contractType;
    if (level) filter.level = level;
    if (q) filter.title = new RegExp(q, 'i');
    res.json(await Opportunity.find(filter).sort({ createdAt: -1 }));
  } catch (e) { res.status(500).json({ message: e.message }); }
};*/

exports.getOpportunity = async (req, res) => {
  try {
    const o = await Opportunity.findById(req.params.id);
    if (!o) return res.status(404).json({ message: 'Introuvable' });
    res.json(o);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
exports.getOpportunities = async (req, res) => {
  try {
    const { type, domain, location, contractType, level, q } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (domain) filter.domain = new RegExp(domain, 'i');
    if (location) filter.location = new RegExp(location, 'i');
    if (contractType) filter.contractType = contractType;
    if (level) filter.level = level;
    if (q) filter.title = new RegExp(q, 'i');

    const offers = await Opportunity.find(filter).sort({ createdAt: -1 }).lean();

    // Nombre de candidatures regroupé par offre
    const counts = await Application.aggregate([
      { $group: { _id: '$opportunity', total: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => { countMap[String(c._id)] = c.total; });

    res.json(offers.map((o) => ({ ...o, applicationsCount: countMap[String(o._id)] || 0 })));
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.createOpportunity = async (req, res) => {
  try {
    const o = await Opportunity.create({ ...req.body, status: 'approved' });
    res.status(201).json(o);
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateOpportunity = async (req, res) => {
  try {
    const o = await Opportunity.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!o) return res.status(404).json({ message: 'Introuvable' });
    res.json(o);
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.deleteOpportunity = async (req, res) => {
  try {
    await Opportunity.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supprimée' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ---------- Candidatures ----------
exports.apply = async (req, res) => {
  try {
    const a = await Application.create({
      opportunity: req.params.id,
      cvUrl: req.body.cvUrl,
      coverLetter: req.body.coverLetter,
    });
    res.status(201).json(a);
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.getMyApplications = async (req, res) => {
  try {
    res.json(await Application.find().populate('opportunity'));
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getApplicationsOfOpportunity = async (req, res) => {
  try {
    res.json(await Application.find({ opportunity: req.params.id }));
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    res.json(await Application.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }));
  } catch (e) { res.status(400).json({ message: e.message }); }
};