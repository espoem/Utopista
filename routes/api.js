var router = require('express').Router();
var utopian = require('utopian-api');
var request = require('request');

// CONSTANTS

var CATEGORIES = [
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
  'task-ideas',
  'task-bug-hunting',
  'task-translations',
  'task-analysis',
  'task-social',
  'task-graphics',
  'task-development',
  'task-documentation'
];

// ENDPOINTS

var UTOPIAN_API_ENDPOINT = 'https://api.utopian.io/api';

// MODERATORS ROUTES

router.get('/moderators', function (req, res) {
  var mods = {
    total: 0,
    results: []
  };
  utopian.getModerators().then(function (moderators) {
    moderators.results.forEach(function (mod) {
      mods.results.push({
        _id: mod._id,
        account: mod.account,
        referrer: mod.referrer || '',
        supervisor: mod.supermoderator === true,
        total_moderated: mod.total_moderated || 0,
        banned: mod.banned === true,
        total_paid_steem: mod.total_paid_rewards_steem || 0,
        opted_out: mod.opted_out === true
      });
      mods.total += 1;
    });
    res.json(mods);
  });
});

// temporary solution for case that user is not moderator
// utopian.getModerator = (username) => {
//     return new Promise((resolve, reject) => {
//         utopian.getModerators().then((moderators) => {
//             moderators.results.filter((moderator) => {
//                 if (moderator.account === username && moderator.banned === false && moderator.reviewed === true) {
//                     resolve([moderator])
//                 }
//             })
//             resolve([])
//         }).catch((err) => reject(err))
//     })
// }

router.get('/moderators/:name', function (req, res) {
  utopian.getModerator(req.params.name)
    .then(function (moderators) {
      res.json(moderators);
    })
    .catch(function (err) {
      res.json(err);
    });
});

router.get('/supervisors', function (req, res) {
  var sups = {
    total: 0,
    results: []
  };
  utopian.getModerators().then(function (moderators) {
    sups.results = moderators.results.filter(function (mod) {
      return mod.supermoderator === true;
    });
    sups.total = sups.results.length;
    res.json(sups);
  });
});

// SPONSORS ROUTES

// utopian.getSponsor = (username) => {
//   return new Promise((resolve, reject) => {
//     utopian.getSponsors().then((sponsors) => {
//       sponsors.results.filter((sponsor) => {
//         if (sponsor.account === username) {
//           resolve([sponsor])
//         }
//       })
//       resolve([])
//     }).catch((err) => reject(err))
//   })
// }

router.get('/sponsors', function (req, res) {
  utopian.getSponsors()
    .then(function (sponsors) {
      res.json(sponsors);
    });
});

router.get('/sponsors/:name', function (req, res) {
  utopian.getSponsor(req.params.name)
    .then(function (sponsor) {
      res.json(sponsor);
    });
});

// TEAMS ROUTES
router.get('/teams', function (req, res) {
  var teams = {
    total: 0,
    results: {}
  };

  utopian.getModerators().then(function (moderators) {
    moderators.results.forEach(function (mod) {
      if (mod.supermoderator || !mod.referrer) {
        mod.moderators_count = 0;
        mod.moderators = [];
        teams.results[mod.account] = mod;
      }
    });

    moderators.results.forEach(function (mod) {
      if (!mod.supermoderator) {
        if (mod.referrer) {
          teams.results[mod.referrer].moderators.push(mod);
          teams.results[mod.referrer].moderators_count += 1;
        }
      }
    });

    teams.total = Object.keys(teams.results).length;
    res.json(teams);
  });
});

// UTOPIAN STATS ROUTE
router.get('/stats', function (req, res) {
  utopian.getStats().then(function (stats) {
    res.json(stats);
  });
});

// POSTS ROUTE
router.get('/posts', function (req, res) {
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
    promises.push(utopian.getPosts(query));
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
  });
});

router.get('/posts/unreviewed', function (req, res) {
  var promises = [];
  var response = {
    categories: {}
  };

  CATEGORIES.forEach(function (category) {
    promises.push(unreviewedPostsCountByCategory(category));
  });

  Promise.all(promises).then(function (data) {
    data.forEach(function (catData, index) {
      response.categories[CATEGORIES[index]] = {
        total: catData,
        _links: {
          self: [req.originalUrl, CATEGORIES[index]].join('/')
        }
      };
    });

    res.json(response);
  }).catch(function (err) {
    res.json({error: err});
  });
});

router.get('/posts/unreviewed/:category', function (req, res) {
  var category = req.params.category;
  var limit = 50;
  var result = {
    category: category,
    results: []
  };

  request(UTOPIAN_API_ENDPOINT + '/posts?filterBy=review&type=' + category + '&limit=' + limit, function (err, response, body) {
    var data = JSON.parse(body);
    data.results.forEach(function (value) {
      result.results.push({
        author: value.author,
        title: value.title,
        createdAt: value.created,
        link: ['https://utopian.io', value.category, '@'+value.author, value.permlink].join('/')
      });
    });
    res.json(result);
  });
});

function unreviewedPostsCountByCategory(category) {
  var query = {
    limit: 1,
    type: category || 'all',
    filterBy: 'review'
  };

  return new Promise(function (resolve, reject) {
    utopian.getPosts(query).then(function (result) {
      resolve(result.total);
    }).catch(function (err) {
      reject(err);
    });
  });
}

module.exports = router;
