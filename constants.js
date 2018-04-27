let consts = {};

consts.CATEGORIES = [
  'all',
  'blog',
  'ideas',
  'bug-hunting',
  'tutorials',
  'video-tutorials',
  'translations',
  'analysis',
  'development',
  'documentation',
  'social',
  'graphics',
  'sub-projects',
  'copywriting',
  'task-ideas',
  'task-bug-hunting',
  'task-translations',
  'task-analysis',
  'task-social',
  'task-graphics',
  'task-development',
  'task-documentation'
];

consts.STATUS_MAPPER = {
  reviewed: 'reviewed',
  flagged: 'flagged',
  pending: 'pending',
  unreviewed: 'pending'
};

module.exports = consts;