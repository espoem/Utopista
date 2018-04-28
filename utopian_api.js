const constants = require('./constants');
const {URL} = require('url');
const config = require('./config');

const UTOPIAN_API_ENDPOINT = 'https://api.utopian.io/api';
const UTOPIAN_API_POSTS = UTOPIAN_API_ENDPOINT + '/posts';
const UTOPIAN_API_MODERATORS = UTOPIAN_API_ENDPOINT + '/moderators';
const UTOPIAN_API_SPONSORS = UTOPIAN_API_ENDPOINT + '/sponsors';
const UTOPIAN_API_STATS = UTOPIAN_API_ENDPOINT + '/stats';

const GITHUB_REPO_URL = 'https://api.github.com/repos/';

const utopian = {};

// HELPER METHODS

/**
 * @method encodeQueryData: Add parameters to a given url
 * @param {Object} parameters: Object of parameters
 * @returns string encoded query with the parameters given.
 */
utopian.encodeQueryData = parameters => {
  // temporary data holder
  let ret = [];
  for (let d in parameters) {
    ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(parameters[d]));
  }
  return ret.join('&');
};

/**
 * Fetches URL and returns its body
 * https://www.tomas-dvorak.cz/posts/nodejs-request-without-dependencies/
 * @param {string} url string url to fetch
 * @param {object} headers object with headers
 */
const requestURL = (url, headers) => {
  const myURL = new URL(url);
  const options = {
    hostname: myURL.hostname,
    protocol: myURL.protocol,
    path: myURL.pathname + myURL.search
  };

  if (headers) options.headers = headers;

  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on requested url
    const lib = url.startsWith('https') ? require('https') : require('http');
    const request = lib.get(options, response => {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error(`Failed to load page, status code: ${response.statusCode}`));
      }
      // temporary data holder
      const body = [];
      // on every content chunk, push it to the data array
      response.on('data', chunk => body.push(chunk));
      // we are done, resolve promise with those joined chunks
      response.on('end', () => resolve(body.join('')));
    });
    // handle connection errors of the request
    request.on('error', err => reject(err));
  });
};

/**
 * Request Utopian api endpoint.
 * @param {string} url URL of the endpoint
 * @returns {Promise} Response data
 */
const requestUtopianApi = url => {
  return requestURL(url,
    {
      'x-api-key-id': config.app['x-api-key-id'],
      'x-api-key': config.app['x-api-key'],
      'origin': config.app.origin
    });
};

/**
 * Request Github api endpoint.
 * @param {string} url URL of the endpoint
 * @returns {Promise} Response data
 */
const requestGithubApi = url => {
  return requestURL(url, {'User-Agent': ''});
};

// CALLS TO UTOPIAN API

/**
 * Get posts from Utopian.
 *
 * Supported queries:
 * https://utopian.docs.apiary.io/#reference/0/posts-collection/query-posts
 * -limit
 * -skip
 * -type: ideas | bug-hunting | blog | ... | task-development | ... : this is the category type
 * -sortBy: created | votes | reward
 * -filterBy: active | review | any
 * -status: reviewed | flagged | pending | any
 * -projectId
 * -platform: github
 * -author
 * -moderator
 * -section: project | author | all
 * -bySimilarity
 *
 * @param params Object with query parameters.
 * @returns {Promise<any>} Promise object with the data {total: count_of_posts, results: array_of_post_objects}
 */
utopian.getPosts = params => {
  if (!params) {
    params = {};
  }

  if (!params.limit || params.limit < 1) {
    params.limit = 20;
  }
  const wanted = params.limit;

  if (params.limit > 500) {
    params.limit = 500;
  }

  if (!params.skip || params.skip < 0) {
    params.skip = 0;
  }

  let data = {
    total: 0,
    results: []
  };
  let rCount = Math.ceil(wanted / params.limit);

  async function fetch(params) {
    for (let i = 0; i < rCount; i++) {
      if (i > 0 && wanted > data.total) {
        rCount = Math.ceil(data.total / params.limit);
      }

      await new Promise((resolve, reject) => {
        requestUtopianApi(UTOPIAN_API_POSTS + '?' + utopian.encodeQueryData(params)).then(d => {
          let json = JSON.parse(d);
          data.total = json.total;
          data.results.push.apply(data.results, json.results);
          params.skip += params.limit;
          params.limit = ( params.limit + params.skip > wanted ) ? wanted % params.limit : params.limit;
          resolve();
        }).catch(err => {
          reject(err);
        });
      });
    }
  }

  return new Promise((resolve, reject) => {
    fetch(params).then(_ => {
      resolve(data);
    }).catch(err => reject(err));
  });
};

utopian.getPostsReviewStats = () => {
  return new Promise((resolve, reject) => {
    let promises = [];
    let response = {
      categories: {}
    };

    constants.CATEGORIES.forEach(category => {
      promises.push(utopian.postsCountByCategoryAndStatus(category, 'reviewed'));
      promises.push(utopian.postsCountByCategoryAndStatus(category, 'flagged'));
      promises.push(utopian.postsCountByCategoryAndStatus(category, 'pending'));
    });

    Promise.all(promises).then(data => {
      for (let i = 0; i < constants.CATEGORIES.length; i++) {
        response.categories[constants.CATEGORIES[i]] = {
          total: data[3 * i] + data[3 * i + 1] + data[3 * i + 2],
          approved: data[3 * i],
          rejected: data[3 * i + 1],
          pending: data[3 * i + 2],
          // _links: {}
        };
      }

      resolve(response);
    }).catch(err => {
      reject(err);
    });
  });
};

/**
 * Get number of posts with given category and status.
 * category: all | ideas | bug-hunting | blog | ... | task-development | ...
 * status: reviewed | flagged | pending
 *
 * @param {string} category posts category
 * @param {string} status posts status
 * @returns {Promise}
 */
utopian.postsCountByCategoryAndStatus = (category, status) => {
  const query = {
    limit: 1,
    type: category || 'all'
  };

  if (status === 'pending') {
    query.filterBy = 'review';
  } else {
    query.status = status || 'any';
  }

  return new Promise((resolve, reject) => {
    utopian.getPosts(query).then(data => {
      resolve(data.total);
    }).catch(err => {
      reject(err);
    });
  });
};

/**
 * Get post details.
 * https://utopian.docs.apiary.io/#reference/0/posts-collection/get-an-individual-post
 * @param {string} author post author
 * @param {string} permlink post permlink
 * @returns {Promise}
 */
utopian.getPost = (author, permlink) => {
  if (!author || !permlink) {
    throw new Error('Author and permlink are required');
  }

  return new Promise((resolve, reject) => {
    requestUtopianApi(`${UTOPIAN_API_POSTS}/${author}/${permlink}`).then(data => {
      resolve(JSON.parse(data));
    }).catch(err => {
      reject(err);
    });
  });
};

/**
 * Get all Utopian moderators
 * https://utopian.docs.apiary.io/#reference/0/moderators-collection/list-all-moderators
 * {total: number_of_moderators, results: array_of_moderators}
 * @returns {Promise}
 */
utopian.getModerators = () => {
  return new Promise((resolve, reject) => {
    requestUtopianApi(UTOPIAN_API_MODERATORS).then(data => {
      resolve(JSON.parse(data));
    }).catch(err => {
      reject(err);
    });
  });
};

utopian.getModerator = name => {
  return new Promise((resolve, reject) => {
    utopian.getModerators().then(moderators => {
      moderators.results.forEach(mod => {
        if (mod.account === name && mod.banned === false) {
          resolve(mod);
        }
      });
      reject({error: `${name} is not a moderator`});
    }).catch(err => {
      reject(err);
    });
  });
};

utopian.getSupervisors = () => {
  return new Promise((resolve, reject) => {
    let sups = {
      total: 0,
      results: []
    };
    utopian.getModerators().then(moderators => {
      sups.results = moderators.results.filter(mod => {
        return mod.supermoderator === true;
      });
      sups.total = sups.results.length;
      resolve(sups);
    }).catch(err => {
      reject(err);
    });
  });
};

utopian.getModeratorsTeams = () => {
  return new Promise((resolve, reject) => {
    let teams = {
      total: 0,
      results: {}
    };

    utopian.getModerators().then(moderators => {
      for (const mod of moderators.results) {
        if (mod.supermoderator && !mod.referrer) {
          mod.moderators_count = 0;
          mod.moderators = [];
          teams.results[mod.account] = mod;
        }
      }

      for (const mod of moderators.results) {
        if (!mod.supermoderator && mod.referrer) {
          teams.results[mod.referrer].moderators.push(mod);
          teams.results[mod.referrer].moderators_count += 1;
        }
      }

      teams.total = Object.keys(teams.results).length;
      resolve(teams);
    });
  });
};

utopian.getModeratorsTeam = supervisor => {
  return new Promise((resolve, reject) => {
    utopian.getModeratorsTeams().then(teams => {
      let team = teams.results[supervisor];
      if (team) {
        resolve(team);
      } else {
        reject({error: `${supervisor} team was not found`});
      }
    }).catch(err => {
      reject(err);
    });
  });
};

/**
 * Get all Utopian sponsors.
 * https://utopian.docs.apiary.io/#reference/0/sponsors-collection/list-sponsors
 * @returns {Promise}
 */
utopian.getSponsors = () => {
  return new Promise((resolve, reject) => {
    requestUtopianApi(UTOPIAN_API_SPONSORS).then(data => {
      resolve(JSON.parse(data));
    }).catch(err => {
      reject(err);
    });
  });
};

/**
 * Get a Utopian sponsor's details.
 * @param name sponsor's name
 * @returns {Promise}
 */
utopian.getSponsor = (name) => {
  return new Promise((resolve, reject) => {
    utopian.getSponsors().then(sponsors => {
      for (const sponsor of sponsors.results) {
        if (sponsor.account === name) {
          resolve(sponsor);
        }
      }
      reject({error: `${name} is not a sponsor`});
    }).catch(err => {
      reject(err);
    });
  });
};


/**
 * @method getPostsByGithubProject: Return list of posts related to given github repository
 * @argument {string} repoName: repository name, i.e.: utopian-io/utopian-api-npm
 * @argument {Object} options: options for the data (optional)
 * @returns Promise object array of posts
 */
utopian.getPostsByGithubProject = (repoName, options) => {
  return new Promise((resolve, reject) => {
    return utopian.getGithubRepoIdByRepoName(repoName)
      .then(id => {
        return utopian.getPosts(Object.assign({
          section: 'project',
          sortBy: 'created',
          platform: 'github',
          projectId: id,
          type: 'all'
        }, options || {})).then(resolve).catch(reject);
      }).catch(reject);
  });
};


/**
 * @method getGithubRepoIdByRepoName: Return github repo id by given github repo
 * @argument {string} repoName: repository full name, i.e.: utopian-io/utopian-api-npm
 * @returns Promise object array of posts
 */
utopian.getGithubRepoIdByRepoName = (repoName) => {
  return new Promise((resolve, reject) => {
    requestGithubApi(GITHUB_REPO_URL + repoName).then((data) => {
      resolve(JSON.parse(data).id);
    }).catch((err) => {
      reject(err);
    });
  });
};

/**
 * Get Utopian statistics from API.
 * https://utopian.docs.apiary.io/#reference/0/stats-collection/get-stats
 * @returns {Promise<any>}
 */
utopian.getStats = () => {
  return new Promise((resolve, reject) => {
    requestUtopianApi(UTOPIAN_API_STATS).then((data) => {
      resolve(JSON.parse(data));
    }).catch((err) => reject(err));
  });
};

/**
 * Get user details.
 * @param user username
 * @returns {Promise<any>}
 */
utopian.getUser = (user) => {
  return new Promise((resolve, reject) => {
    requestUtopianApi(UTOPIAN_API_ENDPOINT + '/users/' + user).then(data => {
      resolve(JSON.parse(data));
    }).catch(err => reject(err));
  });
};

/**
 * Get statistics of user's contributions.
 * @param user user name
 * @returns {Promise<any>}
 */
utopian.getUserStats = (user) => {
  return new Promise((resolve, reject) => {
    let promises = [];
    let statuses = ['reviewed', 'flagged', 'pending'];
    const query = {
      limit: 1,
      section: 'author',
      author: user
    };

    for (const status of statuses) {
      if (status === 'pending') {
        query.status = null;
        query.filterBy = 'review';
      } else {
        query.status = status;
        query.filterBy = null;
      }
      promises.push(utopian.getPosts(query));
    }

    const result = {
      account: user,
      contributions: {}
    };
    Promise.all(promises).then(data => {
      for (let i = 0; i < data.length; i++) {
        result.contributions[statuses[i]] = data[i].total;
      }
      resolve(result);
    }).catch(err => {
      reject(err);
    });
  });
};

module.exports = utopian;