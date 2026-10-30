const Group = require('../models/groupModel');
const User = require('../models/userModel');

// GET /api/academic/groups [admin] → every group (newest academic year first, then by name) with studentCount.
const listGroups = async (req, res) => {
  const [groups, counts] = await Promise.all([
    Group.find().populate('program', 'name code').collation(Group.NAME_COLLATION).sort({ academicYear: -1, name: 1 }),
    User.aggregate([
      { $match: { role: 'STUDENT', group: { $ne: null } } },
      { $group: { _id: '$group', count: { $sum: 1 } } },
    ]),
  ]);
  const studentCount = new Map(counts.map(({ _id, count }) => [String(_id), count]));

  res.status(200).json(groups.map((group) => ({ ...group.toJSON(), studentCount: studentCount.get(String(group._id)) ?? 0 })));
};

module.exports = { listGroups };
