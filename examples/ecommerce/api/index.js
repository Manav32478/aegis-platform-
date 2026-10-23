// Vercel serverless entrypoint — same store, deployed serverlessly.
const app = require('../server');

module.exports = (req, res) => app(req, res);
