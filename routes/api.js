const router = require('express').Router();
const constants = require('../constants');
const utopian_api = require('../utopian_api');
const config = require('../config');

// CONSTANTS

const UTOPISTA_BASE_URL = config.app.origin;
const UTOPIAN_BASE_URL = 'https://utopian.io';

// ENDPOINTS

// var UTOPIAN_API_ENDPOINT = 'https://api.utopian.io/api';
var UTOPISTA_API_ENDPOINT = UTOPISTA_BASE_URL + '/api';
var UTOPISTA_MODERATORS = '/moderators';
var UTOPISTA_SUPERVISORS = '/supervisors';
var UTOPISTA_TEAMS = '/teams';
var UTOPISTA_POSTS = '/posts';
var UTOPISTA_POSTS_STATS = UTOPISTA_POSTS + '/stats';
var UTOPISTA_POSTS_UNREVIEWED = UTOPISTA_POSTS + '/unreviewed';
var UTOPISTA_SPONSORS = '/sponsors';
var UTOPISTA_STATS = '/stats';

// API INFO

router.get('/', function (req, res) {
  var response = {
    app: 'utopista',
    author: 'espoem',
    routes: {
      moderators: UTOPISTA_API_ENDPOINT + UTOPISTA_MODERATORS,
      supervisors: UTOPISTA_API_ENDPOINT + UTOPISTA_SUPERVISORS,
      teams: UTOPISTA_API_ENDPOINT + UTOPISTA_TEAMS,
      posts: UTOPISTA_API_ENDPOINT + UTOPISTA_POSTS,
      posts_stats: UTOPISTA_API_ENDPOINT + UTOPISTA_POSTS_STATS,
      posts_unreviewed: UTOPISTA_API_ENDPOINT + UTOPISTA_POSTS_UNREVIEWED
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
    });
});

router.get(UTOPISTA_SPONSORS + '/:name', function (req, res) {
  utopian_api.getSponsor(req.params.name)
    .then(function (sponsor) {
      res.json(sponsor);
    });
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

// POSTS ROUTE
router.get(UTOPISTA_POSTS, function (req, res) {
  var maxLimit = 20;
  var q = req.query;
  var limit = Number(q.limit);
  limit = limit > 0 ? limit : maxLimit;
  var query = {
    limit: limit > maxLimit ? maxLimit : limit,
    skip: Number(q.skip) || 0,
    section: q.section || 'all',
    type: q.type || q.category || 'all',
    sortBy: q.sortBy || 'created',
    filterBy: q.filterBy || 'any',
    status: q.status || 'any'
  };

  var auxLimit = limit;
  var promises = [];
  while (auxLimit > 0) {
    promises.push(utopian_api.getPosts(query));
    query.skip = Number(query.skip) + maxLimit;
    auxLimit -= maxLimit;
    query.limit = Math.min(auxLimit, maxLimit);
  }

  Promise.all(promises).then(function (posts) {
    var data = posts ? posts[0] : {total: 0, results: []};
    for (var i = 1; i < posts.length; i++) {
      data.results = data.results.concat(posts[i].results);
    }

    res.json(data);
  }).catch(function (err) {
    res.json({error: err.message});
  });
});

// router.get(UTOPISTA_POSTS + '/all', function (req, res) {
//   utopian_api.getPo
// });

router.get(UTOPISTA_POSTS_STATS, function (req, res) {
  utopian_api.getPostsReviewStats().then(data => {
    res.json(data);
  }).catch(err => {
    res.json(err);
  });
});

router.get(UTOPISTA_POSTS_UNREVIEWED, function (req, res) {
  var promises = [];
  var response = {
    categories: {}
  };

  constants.CATEGORIES.forEach(function (category) {
    promises.push(unreviewedPostsCountByCategory(category));
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

router.get(UTOPISTA_POSTS_UNREVIEWED + '/:category', function (req, res) {
  const category = req.params.category;
  const limit = 50;

  const query = {
    type: category || 'all',
    limit: Number(req.query.limit) || limit,
    skip: Number(req.query.skip) || 0,
    filterBy: 'review'
  };

  // console.log(query);
  // console.log(category);
  // console.log(req.query.skip);

  let result = {
    category: category,
    total: 0,
    results: [],
    _links: {
      self: `${UTOPISTA_BASE_URL + req.originalUrl.split('?').shift()}?limit=${query.limit}&skip=${query.skip}`
    }
  };

  utopian_api.getPosts(query).then(data => {
    result.total = data.total;
    for (const post of data.results) {
      result.results.push({
        author: post.author,
        title: post.title,
        createdAt: post.created,
        category: post.json_metadata.type,
        project: post.json_metadata.repository.full_name,
        _links: {
          utopian: [UTOPIAN_BASE_URL, post.category, '@' + post.author, post.permlink].join('/')
        }
      });
    }

    let skip_next = query.skip + query.limit;
    if (skip_next <= result.total) {
      result._links.next = `${UTOPISTA_BASE_URL + req.originalUrl.split('?').shift()}?limit=${query.limit}&skip=${skip_next}`;
    }

    let skip_prev = Math.max(query.skip - query.limit, 0);
    if (query.skip > 0) {
      result._links.prev = `${UTOPISTA_BASE_URL + req.originalUrl.split('?').shift()}?limit=${query.limit}&skip=${skip_prev}`;
    }

    res.json(result);
  }).catch(err => {
    // res.json({error: err.message});
    res.json('Big Error');
  });
});

router.get(UTOPISTA_POSTS_UNREVIEWED + '/:category/table', function (req, res) {
  const category = req.params.category;
  const limit = 50;

  const query = {
    type: category || 'all',
    limit: Number(req.query.limit) || limit,
    skip: Number(req.query.skip) || 0,
    filterBy: 'review'
  };

  if (req.query.project) {
    utopian_api.getGithubRepoIdByRepoName(req.query.project).then(id => {
      query.projectId = id;
      query.section = 'project';
      query.platform = 'github';
      utopian_api.getPosts(query).then(data => {
        res.send(createTable(data));
      }).catch(err => {
        res.json({error: err});
      });
    });
  } else {
    utopian_api.getPosts(query).then(data => {
      res.send(createTable(data));
    }).catch(err => {
      res.json({error: err});
    });
  }
});

function createTable(data) {
  let html = '<style>table {border-collapse: collapse;}  table, th, td {padding: 5px; border: 1px solid black;}</style>' +
    '<table><thead><tr>' +
    '<th>Category</th>' +
    '<th>Author</th>' +
    '<th>Title</th>' +
    '<th>Created At</th>' +
    '<th>Project</th>' +
    '<th>Link</th>' +
    '</tr></thead><tbody>';

  for (const post of data.results) {
    const link = [UTOPIAN_BASE_URL, post.category, '@' + post.author, post.permlink].join('/');
    html += '<tr>' +
      '<td>' + post.json_metadata.type + '</td>' +
      '<td>' + post.author + '</td>' +
      '<td>' + post.title + '</td>' +
      '<td>' + post.created + '</td>' +
      '<td>' + post.json_metadata.repository.full_name + '</td>' +
      '<td><a href="' + link + '">View Post</a></td>' +
      '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

router.get(UTOPISTA_POSTS + '/:author/:post', function (req, res) {
  utopian_api.getPost(req.params.author, req.params.post).then(function (post) {
    res.json(post);
  }).catch(err => {
    res.json({error: err});
  });
});

function unreviewedPostsCountByCategory(category) {
  const query = {
    limit: 1,
    type: category || 'all',
    filterBy: 'review'
  };

  return new Promise(function (resolve, reject) {
    utopian_api.getPosts(query).then(function (result) {
      resolve(result.total);
    }).catch(function (err) {
      reject(err);
    });
  });
}

function postsPendingCountByCategory(category, moderators) {
  return new Promise((resolve, reject) => {
    let query = {
      limit: 1,
      type: category,
      status: 'pending'
    };
    let total = 0;
    let promises = [];
    moderators.forEach(moderator => {
      query.moderator = moderator;
      // console.log(category, moderator);
      promises.push(utopian_api.getPosts({
        limit: 1,
        type: category,
        status: 'pending',
        moderator: moderator
      }));
    });

    Promise.all(promises).then(data => {
      data.forEach(count => {
        // console.log(total);
        total += count;
      });
      resolve(total);
    }).catch(err => {
      reject(err);
    });
  });
}

module.exports = router;
