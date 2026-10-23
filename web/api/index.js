// Vercel serverless entrypoint for the Aegis web portal.
// Lets you deploy the professional portal to Vercel too — the router can then
// serve the real-time dashboard from the edge.
const app = require('../server');

module.exports = (req, res) => app(req, res);
