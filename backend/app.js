const { existsSync } = require("node:fs");
const path = require("node:path");

const productionEnv = path.join(__dirname, ".env.production");
if (existsSync(productionEnv)) process.loadEnvFile(productionEnv);

require("./dist/main");
