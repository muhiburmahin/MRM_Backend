const main = require('../dist/main');
const handler = main.default || main;

module.exports = async (req, res) => {
  return handler(req, res);
};
