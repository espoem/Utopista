const constants = require('./constants');
const {URL} = require('url');
const config = require('./config');

const UTOPIAN_API_ENDPOINT = 'https://api.utopian.io/api';
const UTOPIAN_API_POSTS = UTOPIAN_API_ENDPOINT + '/posts';
const UTOPIAN_API_MODERATORS = UTOPIAN_API_ENDPOINT + '/moderators';
const UTOPIAN_API_SPONSORS = UTOPIAN_API_ENDPOINT + '/sponsors';

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
 */
const requestURL = url => {
  const myURL = new URL(url);
  const options = {
    hostname: myURL.hostname,
    protocol: myURL.protocol,
    path: myURL.pathname + myURL.search,
    headers: {
      'x-api-key-id': config.app['x-api-key-id'],
      'x-api-key': config.app['x-api-key'],
      'origin': config.app.origin
    }
  };

  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested url
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

// CALLS TO UTOPIAN API

// https://utopian.docs.apiary.io/#reference/0/posts-collection/query-posts
utopian.getPosts = params => {
  if (!params) {
    params = {};
  }

  if (!params.limit || params.limit < 1) {
    params.limit = 50;
  }

  if (!params.skip || params.skip < 0) {
    params.skip = 0;
  }

  return new Promise((resolve, reject) => {
    requestURL(UTOPIAN_API_POSTS + '?' + utopian.encodeQueryData(params)).then(data => {
      resolve(JSON.parse(data));
    }).catch(err => {
      reject(err);
    });
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
      promises.push(utopian.postsCountByCategoryAndStatus(category, 'pending'));  // bug: https://github.com/utopian-io/api.utopian.io/issues/100
    });

    Promise.all(promises).then(data => {
      for (let i = 0; i < constants.CATEGORIES.length; i++) {
        response.categories[constants.CATEGORIES[i]] = {
          total: data[3 * i] + data[3 * i + 1] + data[3 * i + 2],
          approved: data[3 * i],
          rejected: data[3 * i + 1],
          pending: data[3 * i + 2],
          _links: {}
        };
      }

      resolve(response);
    }).catch(err => {
      reject(err);
    });
  });
};

utopian.postsCountByCategoryAndStatus = (category, status) => {
  const query = {
    limit: 1,
    type: category || 'all',
    status: status || 'any'
  };

  return new Promise((resolve, reject) => {
    utopian.getPosts(query).then(result => {
      resolve(result.total);
    }).catch(err => {
      reject(err);
    });
  });
};

// https://utopian.docs.apiary.io/#reference/0/posts-collection/get-an-individual-post
utopian.getPost = (author, permlink) => {
  if (!author || !permlink) {
    throw new Error('Author and permlink are required');
  }

  return new Promise((resolve, reject) => {
    requestURL(`${UTOPIAN_API_POSTS}/${author}/${permlink}`).then(data => {
      resolve(JSON.parse(data));
    }).catch(err => {
      reject(err);
    });
  });
};

// https://utopian.docs.apiary.io/#reference/0/moderators-collection/list-all-moderators
utopian.getModerators = () => {
  return new Promise((resolve, reject) => {
    requestURL(UTOPIAN_API_MODERATORS).then(data => {
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

// https://utopian.docs.apiary.io/#reference/0/sponsors-collection/list-sponsors
utopian.getSponsors = () => {
  return new Promise((resolve, reject) => {
    requestURL(UTOPIAN_API_SPONSORS).then(data => {
      resolve(JSON.parse(data));
    }).catch(err => {
      reject(err);
    });
  });
};

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

module.exports = utopian;