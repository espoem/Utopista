const express = require('express');
const router = express.Router();
const utopian = require('../utopian_api');

// code by oups

router.get('/:status?', (req, res) => {
  let graphicPosts = [];

  let perPage = 9;
  let page = req.query.page || 1;

  let query = {
    sortBy: 'created',
    type: 'graphics',
    limit: perPage,
    skip: ( ( perPage * page ) - perPage )
  };
  req.params.status === 'pending' ? query.filterBy = 'review' : query.status = req.params.status || 'any';

  utopian.getPosts(query).then((posts) => {
    for (i = 0; i < posts.results.length; i++) {
      graphicPosts.push(posts.results[i]);
    }
    res.render('home', {
      title: 'Latest Graphics Contributions',
      posts: graphicPosts,
      total: posts.total,
      nextPage: parseInt(page) + 1,
      prevPage: ( parseInt(page) - 1 ) >= 2 ? parseInt(page) - 1 : 1,
      page: parseInt(page)
    });
  }).catch(err => {
    res.json({error: err.message});
  });
});

module.exports = router;


