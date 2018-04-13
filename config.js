if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}

module.exports = {
  app: {
    "x-api-key-id": process.env['X-API-KEY-ID'],
    "x-api-key": process.env['X-API-KEY'],
    "origin": process.env['ORIGIN']
  }
};