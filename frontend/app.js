const { createServer } = require("node:http");
const next = require("next");
const path = require("node:path");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((request, response) => handle(request, response)).listen(process.env.PORT || 3000);
});
