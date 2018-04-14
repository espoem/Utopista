const express = require('express');
const app = express();
const hbs = require('express-handlebars');
const moment = require('moment');

const apiRoutes = require('./routes/api');
const path = require('path');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'handlebars');

app.engine('handlebars', hbs({
  defaultLayout: 'main',
  helpers: {
    formatDate: function (context) {
      return moment(context).fromNow();
    },
    checkPrev: function (context) {
      if (parseInt(context) <= 1) {
        return 'disabled';
      }
    },
    checkNext: function (totalCount, perPage, page) {
      if (( parseInt(totalCount) / parseInt(perPage) ) <= parseInt(page)) {
        return 'disabled';
      }
    },
    parseImage: function (bodyText) {
      var res = bodyText.match(/(https?:\/\/.*\.(?:png|jpg))/i);
      if (res) {
        return 'https://steemitimages.com/0x0/' + res[0];
      } else {
        return 'https://upload.wikimedia.org/wikipedia/commons/6/6c/No_image_3x4.svg';
      }
    }
  }
}));

// MODELS

app.use('/api', apiRoutes);

// OUPS ROUTES
app.use('/', require('./routes/index'));
app.use('/user', require('./routes/user'));
app.use('/moderator', require('./routes/moderator'));
app.use('/project', require('./routes/project'));

// app.get('/', function (req, res) {
//   res.send('HOMEPAGE');
// });

app.listen(process.env.PORT || 5000, process.env.IP, function () {
  console.log('Server started');
});
