const express = require('express');
const router = express.Router();
const utopian = require('../utopian_api');

// code by oups

router.get('/:ghuser/:ghproject/:status?', (req, res) => {
  let contributions = [];

  let perPage = 9;
  let page = req.query.page || 1;

  let projectFullName = req.params.ghuser + '/' + req.params.ghproject;

  let query = {
    sortBy: 'created',
    type: 'graphics',
    limit: perPage,
    skip: ( ( perPage * page ) - perPage )
  };
  req.params.status === 'pending' ? query.filterBy = 'review' : query.status = req.params.status || 'any';

  utopian.getPostsByGithubProject(projectFullName, query).then((posts) => {
    console.log('calling get posts by github');
    for (let i = 0; i < posts.results.length; i++) {
      contributions.push(posts.results[i]);
    }

    res.render('project', {
      title: 'Project',
      project: projectFullName,
      posts: contributions,
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