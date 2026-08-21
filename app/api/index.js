// Vercel serverless entrypoint (cloud #2, cardless).
// Express apps are plain (req, res) functions, so this is a valid @vercel/node handler.
const app = require('../app');

module.exports = (req, res) => app(req, res);
