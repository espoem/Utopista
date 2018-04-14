const express = require('express');
const router = express.Router();
const utopian = require('../utopian_api');

// code by oups

router.get('/:moderatorName/:status?', (req, res) => {
  let reviews = [];

  let perPage = 9;
  let page = req.query.page || 1;

  utopian.getPosts({
    type: 'graphics',
    moderator: req.params.moderatorName,
    status: req.params.status || 'any',
    limit: perPage,
    skip: ( ( perPage * page ) - perPage )
  }).then((posts) => {
    for (let i = 0; i < posts.results.length; i++) {
      reviews.push(posts.results[i]);
    }

    res.render('moderator', {
      title: 'Moderator',
      mod: req.params.moderatorName,
      posts: reviews,
      total: posts.total,
      nextPage: parseInt(page) + 1,
      prevPage: ( parseInt(page) - 1 ) >= 2 ? parseInt(page) - 1 : 1,
      page: parseInt(page)
    });
  });
});

module.exports = router;