const router = require('express').Router();
const constants = require('../constants');
const utopian_api = require('../utopian_api');
const config = require('../config');
const comparator = require('../helpers/comparator');

// CONSTANTS

const UTOPISTA_BASE_URL = config.app.origin;
const UTOPIAN_BASE_URL = 'https://utopian.io';

// ENDPOINTS

// var UTOPIAN_API_ENDPOINT = 'https://api.utopian.io/api';
// var UTOPISTA_API_ENDPOINT = UTOPISTA_BASE_URL + '/api';
const UTOPISTA_MODERATORS = '/moderators';
const UTOPISTA_SUPERVISORS = '/supervisors';
const UTOPISTA_TEAMS = '/teams';
const UTOPISTA_POSTS = '/posts';
const UTOPISTA_POSTS_STATS = UTOPISTA_POSTS + '/stats';
const UTOPISTA_POSTS_UNREVIEWED = UTOPISTA_POSTS + '/unreviewed';
const UTOPISTA_SPONSORS = '/sponsors';
const UTOPISTA_STATS = '/stats';

// API INFO

router.get('/', function (req, res) {
  const response = {
    app: 'utopista',
    author: 'espoem',
    routes: {
      // moderators: UTOPISTA_API_ENDPOINT + UTOPISTA_MODERATORS,
      // supervisors: UTOPISTA_API_ENDPOINT + UTOPISTA_SUPERVISORS,
      // teams: UTOPISTA_API_ENDPOINT + UTOPISTA_TEAMS,
      // posts: UTOPISTA_API_ENDPOINT + UTOPISTA_POSTS,
      // posts_stats: UTOPISTA_API_ENDPOINT + UTOPISTA_POSTS_STATS,
      // posts_unreviewed: UTOPISTA_API_ENDPOINT + UTOPISTA_POSTS_UNREVIEWED
    }
  };

  res.json(response);
});

// MODERATORS ROUTES

router.get(UTOPISTA_MODERATORS, (req, res) => {
  let mods = {
    total: 0,
    results: []
  };
  utopian_api.getModerators().then(moderators => {
    for (const mod of moderators.results) {
      mods.results.push({
        _id: mod._id,
        account: mod.account,
        referrer: mod.referrer,
        supervisor: mod.supermoderator === true,
        total_moderated: mod.total_moderated || 0,
        banned: mod.banned === true,
        total_paid_steem: mod.total_paid_rewards_steem || 0,
        opted_out: mod.opted_out === true
      });
      mods.total += 1;
    }
    res.json(mods);
  });
});

router.get(UTOPISTA_MODERATORS + '/:name', function (req, res) {
  utopian_api.getModerator(req.params.name)
    .then(function (moderator) {
      res.json(moderator);
    })
    .catch(function (err) {
      res.json(err);
    });
});

router.get(UTOPISTA_SUPERVISORS, function (req, res) {
  utopian_api.getSupervisors().then(data => {
    res.json(data);
  }).catch(err => {
    res.json(err);
  });
});

// SPONSORS ROUTES

router.get(UTOPISTA_SPONSORS, function (req, res) {
  utopian_api.getSponsors()
    .then(function (sponsors) {
      res.json(sponsors);
    }).catch(err => res.json({error: err.message}));
});

router.get(UTOPISTA_SPONSORS + '/:name', function (req, res) {
  utopian_api.getSponsor(req.params.name)
    .then(function (sponsor) {
      res.json(sponsor);
    }).catch(err => res.json({error: err.message}));
});

// TEAMS ROUTES
router.get(UTOPISTA_TEAMS, function (req, res) {
  utopian_api.getModeratorsTeams().then(data => {
    res.json(data);
  });
});

router.get(UTOPISTA_TEAMS + '/:name', function (req, res) {
  utopian_api.getModeratorsTeam(req.params.name).then(data => {
    res.json(data);
  }).catch(err => {
    res.json(err);
  });
});

// UTOPIAN STATS ROUTE
router.get(UTOPISTA_STATS, function (req, res) {
  utopian_api.getStats().then(function (stats) {
    res.json(stats);
  }).catch(err => {
    res.error(err);
  });
});

router.get('/users/:user', function (req, res) {
  utopian_api.getUser(req.params.user).then(user => {
    res.json(user);
  }).catch(err => {
    res.json({error: err});
  });
});

router.get('/users/:user/stats', function (req, res) {
  utopian_api.getUserStats(req.params.user).then(data => {
    res.json(data);
  }).catch(err => {
    res.json({error: err.message});
  });
});

// POSTS ROUTE
router.get(UTOPISTA_POSTS, function (req, res) {
  res.json({error: 'This endpoint is not implemented'});
});

router.get(UTOPISTA_POSTS_STATS, function (req, res) {
  utopian_api.getPostsReviewStats().then(data => {
    res.json(data);
  }).catch(err => {
    res.json(err);
  });
});

router.get(UTOPISTA_POSTS + '/:status', function (req, res) {
  let promises = [];
  let response = {
    categories: {}
  };

  const status = constants.STATUS_MAPPER[req.params.status];

  constants.CATEGORIES.forEach(function (category) {
    promises.push(utopian_api.postsCountByCategoryAndStatus(category, status));
  });

  Promise.all(promises).then(function (data) {
    data.forEach(function (catData, index) {
      response.categories[constants.CATEGORIES[index]] = {
        total: catData,
        _links: {
          self: UTOPISTA_BASE_URL + req.originalUrl.replace(/\/$/, '') + '/' + constants.CATEGORIES[index]
        }
      };
    });

    res.json(response);
  }).catch(function (err) {
    res.json({error: err.message});
  });
});

function createUtopianLink(post) {
  return [UTOPIAN_BASE_URL, post.category, '@' + post.author, post.permlink].join('/');
}

/**
 * Get reduced post object.
 * @param post Utopian post record
 * @returns {{author: string|*, title, createdAt: *, category, project: string, score: number, influence: number, scorers: number, _links: {utopian: string}}}
 */
function createReducedPostObject(post) {
  return {
    author: post.author,
    title: post.title,
    createdAt: post.created,
    category: post.json_metadata.type,
    project: ( post.json_metadata.repository ? post.json_metadata.repository.full_name : '' ),
    score: ( post.json_metadata.score ? +post.json_metadata.score : 0 ),
    influence: ( post.json_metadata.total_influence ? +post.json_metadata.total_influence : 0 ),
    scorers: ( post.json_metadata.questions && post.json_metadata.questions.voters ? post.json_metadata.questions.voters.length : 0 ),
    _links: {
      utopian: createUtopianLink(post)
    }
  };
}

router.get(UTOPISTA_POSTS + '/:status/:category/:format?', function (req, res) {
  const category = req.params.category;
  const limit = 25;
  const query = {
    type: category,
    limit: Number(req.query.limit) || limit,
    skip: Number(req.query.skip) || 0
  };
  if (query.limit > 1000) {
    query.limit = 1000; // temporary max limit to 1000
  }

  const status = constants.STATUS_MAPPER[req.params.status];
  if (status === 'pending') {
    query.filterBy = 'review';
  } else {
    query.status = status;
  }

  let data = {
    category: category,
    total: 0,
    results: [],
    _links: {
      self: `${UTOPISTA_BASE_URL + req.originalUrl.split('?').shift()}?limit=${query.limit}&skip=${query.skip}`
    }
  };

  const format = req.params.format;

  let p;
  if (req.query.project) {
    p = utopian_api.getGithubRepoIdByRepoName(req.query.project);
  } else if (req.query.author) {
    p = Promise.resolve(-1);
  } else {
    p = Promise.resolve(0);
  }

  p.then(id => {
    if (id > 0) {
      query.projectId = id;
      query.section = 'project';
      query.platform = 'github';
    } else if (id === -1) {
      query.section = 'author';
      query.author = req.query.author;
    }

    utopian_api.getPosts(query).then(d => {
      data.results = d.results;
      let sortOrder = -1;
      let sortOption = req.query.sortBy;
      if (sortOption && sortOption[0] === '-') {
        sortOrder *= -1;
        sortOption = sortOption.substr(1);
      }

      switch (sortOption) {
        case 'score':
          data.results.sort((a, b) => sortOrder * comparator.comparatorNumeric(getPostTotalScore(a), getPostTotalScore(b)));
          break;
        case 'influence':
          data.results.sort((a, b) => sortOrder * comparator.comparatorNumeric(getPostTotalInfluence(a), getPostTotalInfluence(b)));
          break;
        case 'author':
          data.results.sort((a, b) => sortOrder * comparator.comparatorString(a.author, b.author));
          break;
        case 'project':
          data.results.sort((a, b) => sortOrder * comparator.comparatorString(getPostGithubRepoName(a), getPostGithubRepoName(b)));
          break;
        case 'scorers':
          data.results.sort((a, b) => sortOrder * comparator.comparatorNumeric(getScorersCount(a), getScorersCount(b)));
          break;
        default:
          break;
      }

      data.total = d.total;

      let skip_next = query.skip + query.limit;
      if (skip_next <= data.total) {
        data._links.next = `${UTOPISTA_BASE_URL + req.originalUrl.split('?').shift()}?limit=${query.limit}&skip=${skip_next}`;
      }

      let skip_prev = Math.max(query.skip - query.limit, 0);
      if (query.skip > 0) {
        data._links.prev = `${UTOPISTA_BASE_URL + req.originalUrl.split('?').shift()}?limit=${query.limit}&skip=${skip_prev}`;
      }

      if (!format) {
        for (let i = 0; i < data.results.length; i++) {
          data.results[i] = createReducedPostObject(data.results[i]);
        }
        res.json(data);
      } else if (format === 'table') {
        res.send(createTable(data.results, status));
      } else if (format === 'links') {
        for (let i = 0; i < data.results.length; i++) {
          data.results[i] = createUtopianLink(data.results[i]);
        }
        res.json(data);
      } else {
        throw new Error('Unsupported route parameter ' + format);
      }
    }).catch(err => {
      res.json({error: err.message});
    });
  });
});

function getPostGithubRepoName(post) {
  return ( post.json_metadata.repository ? post.json_metadata.repository.full_name : '' );
}

function getPostTotalInfluence(post) {
  return ( post.json_metadata.total_influence ? +post.json_metadata.total_influence : 0 );
}

function getPostTotalScore(post) {
  return ( post.json_metadata.score ? +post.json_metadata.score : 0 );
}

function getScorersCount(post) {
  return ( post.json_metadata.questions && post.json_metadata.questions.voters ? post.json_metadata.questions.voters.length : 0 );
}

function createTable(posts, status) {
  let html = '<style>table {border-collapse: collapse;}  table, th, td {padding: 5px; border: 1px solid black;}</style>' +
    '<table><thead><tr>' +
    '<th>Category</th>' +
    '<th>Author</th>' +
    '<th>Title</th>' +
    '<th>Created At</th>' +
    '<th>Project</th>' +
    '<th>Score</th>' +
    '<th>Influence</th>' +
    '<th>Scorers</th>' +
    '<th>Vote Queue</th>' +
    '<th>Link</th>' +
    '</tr></thead><tbody>';

  for (const post of posts) {
    const link = [UTOPIAN_BASE_URL, post.category, '@' + post.author, post.permlink].join('/');
    html += '<tr>' +
      '<td>' + post.json_metadata.type + '</td>' +
      '<td>' + post.author + '</td>' +
      '<td>' + post.title + '</td>' +
      '<td>' + post.created + '</td>' +
      '<td>' + getPostGithubRepoName(post) + '</td>' +
      '<td>' + getPostTotalScore(post) + '</td>' +
      '<td>' + getPostTotalInfluence(post) + '</td>' +
      '<td>' + getScorersCount(post) + '</td>' +
      '<td>' + voteQueueStatus(post, status) + '</td>' +
      '<td><a href="' + link + '">View Post</a></td>' +
      '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function voteQueueStatus(post, status) {
  let msg = 'Not in queue';
  if (post.json_metadata && ( status === 'pending' ? post.json_metadata.total_influence >= 60 && post.json_metadata.score >= 80 : post.json_metadata.total_influence > 0 && post.json_metadata.score > 0 && status !== 'flagged' )) {
    msg = 'To be in queue';
    if (post.created <= new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) {
      msg = 'In queue';
    }
    if (post.active_votes) {
      post.active_votes.forEach(vote => {
        if (vote.voter === 'utopian-io') {
          msg = 'Voted';
        }
      });
    }
  }
  else if (post.active_votes) {
    post.active_votes.forEach(vote => {
      if (vote.voter === 'utopian-io') {
        msg = 'Voted';
        if (vote.percent === 0) {
          msg = 'Unvoted';
        }
      }
    });
  }
  return msg;
}

router.get('/users/:author/:post', function (req, res) {
  utopian_api.getPost(req.params.author, req.params.post).then(function (post) {
    res.json(post);
  }).catch(err => {
    res.json({error: err});
  });
});

module.exports = router;
