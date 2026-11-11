const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');
const storageService = require('../service/storageService');

// Champs qu'un recruteur peut renseigner (author et status ne viennent jamais du client).
const OFFER_FIELDS = ['title', 'description', 'type', 'domain', 'duration', 'location', 'contractType', 'level', 'filiere', 'company'];
const pickOfferFields = (body = {}) =>
  Object.fromEntries(OFFER_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

const isAdmin = (user) => user.role === 'ADMIN';
/** Un recruteur ne gère que ses offres ; un admin gère tout. */
const ownsOffer = (user, offer) => isAdmin(user) || (!!offer?.author && String(offer.author) === String(user._id));

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
    const o = await Opportunity.create({ ...pickOfferFields(req.body), author: req.user._id, status: 'approved' });
    res.status(201).json(o);
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateOpportunity = async (req, res) => {
  try {
    const o = await Opportunity.findById(req.params.id);
    if (!o) return res.status(404).json({ message: 'Introuvable' });
    if (!ownsOffer(req.user, o)) return res.status(403).json({ message: 'Cette offre ne vous appartient pas' });
    o.set(pickOfferFields(req.body));
    await o.save();
    res.json(o);
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.deleteOpportunity = async (req, res) => {
  try {
    const o = await Opportunity.findById(req.params.id);
    if (!o) return res.status(404).json({ message: 'Introuvable' });
    if (!ownsOffer(req.user, o)) return res.status(403).json({ message: 'Cette offre ne vous appartient pas' });
    await o.deleteOne();
    res.json({ message: 'Supprimée' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ---------- Candidatures ----------
/*exports.apply = async (req, res) => {
  try {
    const a = await Application.create({
      opportunity: req.params.id,
      cvUrl: req.body.cvUrl,
      coverLetter: req.body.coverLetter,
    });
    res.status(201).json(a);
  } catch (e) { res.status(400).json({ message: e.message }); }
};*/
//remplacé par :
exports.apply = async (req, res) => {
  let stored = null;
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ message: 'Offre introuvable' });
    if (req.file) {
      stored = await storageService.save({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: 'cv',
      });
    }
    const application = await Application.create({
      opportunity: opp._id,
      student: req.user._id,
      coverLetter: req.body.coverLetter || '',
      cv: stored ? { key: stored.key, filename: stored.filename, mimeType: stored.mimeType, size: stored.size } : undefined,
    });
    res.status(201).json(application);
  } catch (e) {
    if (stored) await storageService.remove(stored.key).catch(() => {}); // pas de fichier orphelin si l'enregistrement échoue
    res.status(500).json({ message: e.message });
  }
};

// Télécharge le CV d'une candidature : l'étudiant qui a postulé, le recruteur de l'offre, ou un admin.
// Pas de try/catch : les erreurs (404 fichier absent, id invalide) passent par errorHandler, en JSON.
exports.downloadCv = async (req, res) => {
  const a = await Application.findById(req.params.id).populate('opportunity');
  if (!a || !a.cv?.key) return res.status(404).json({ message: 'CV introuvable' });
  const isApplicant = !!a.student && String(a.student) === String(req.user._id);
  if (!isApplicant && !ownsOffer(req.user, a.opportunity)) {
    return res.status(403).json({ message: "Vous n'avez pas accès à ce CV" });
  }
  await storageService.sendFile(res, a.cv.key, { filename: a.cv.filename, mimeType: a.cv.mimeType });
};

// « Où j'ai postulé » : les candidatures de l'étudiant connecté.
exports.getMyApplications = async (req, res) => {
  try {
    res.json(await Application.find({ student: req.user._id }).sort({ createdAt: -1 }).populate('opportunity'));
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// « Demandes » : les candidatures reçues pour les offres du recruteur connecté (toutes pour un admin).
exports.getReceivedApplications = async (req, res) => {
  try {
    let filter = {};
    if (!isAdmin(req.user)) {
      const mine = await Opportunity.find({ author: req.user._id }).select('_id');
      filter = { opportunity: { $in: mine.map((o) => o._id) } };
    }
    res.json(await Application.find(filter).sort({ createdAt: -1 }).populate('opportunity'));
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getApplicationsOfOpportunity = async (req, res) => {
  try {
    const o = await Opportunity.findById(req.params.id);
    if (!o) return res.status(404).json({ message: 'Introuvable' });
    if (!ownsOffer(req.user, o)) return res.status(403).json({ message: 'Cette offre ne vous appartient pas' });
    res.json(await Application.find({ opportunity: o._id }).sort({ createdAt: -1 }));
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const a = await Application.findById(req.params.id).populate('opportunity');
    if (!a) return res.status(404).json({ message: 'Candidature introuvable' });
    // Offre supprimée (opportunity null) : seul un admin peut encore traiter la candidature.
    if (!ownsOffer(req.user, a.opportunity)) return res.status(403).json({ message: "Cette candidature ne concerne pas l'une de vos offres" });
    a.status = req.body.status;
    await a.save(); // la validation refuse un statut hors liste
    res.json(a);
  } catch (e) { res.status(400).json({ message: e.message }); }
};

/*
exports.deleteApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        message: "Candidature introuvable"
      });
    }

    // Vérifier que l'utilisateur connecté est propriétaire
    if (application.student.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Vous ne pouvez pas supprimer cette candidature"
      });
    }

   // await application.deleteOne();

    return res.status(200).json({
      message: "Candidature annulée avec succès"
    });

  } catch (error) {
    return res.status(500).json({
      message: "Erreur lors de l'annulation de la candidature",
      error: error.message
    });
  }
};*/
exports.deleteApplication = async (req, res) => {
  try {
    // Un étudiant ne peut annuler que ses propres candidatures.
    const application = await Application.findOneAndDelete({ _id: req.params.id, student: req.user._id });

    if (!application) {
      return res.status(404).json({
        message: "Candidature introuvable"
      });
    }

    if (application.cv?.key) await storageService.remove(application.cv.key); // le CV disparaît avec la candidature

    return res.status(200).json({
      message: "Candidature supprimée avec succès"
    });

  } catch (error) {
    return res.status(500).json({
      message: "Erreur lors de la suppression de la candidature",
      error: error.message
    });
  }
};