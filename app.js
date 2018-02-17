var express = require('express');
// var utopian = require('utopian-api')
var app = express();

var apiRoutes = require('./routes/api');

// MODELS

app.use('/api', apiRoutes);

app.get('/', function (req, res) {
  res.send('HOMEPAGE');
});

app.listen(process.env.PORT || 5000, process.env.IP, function () {
  console.log('Server started');
});
