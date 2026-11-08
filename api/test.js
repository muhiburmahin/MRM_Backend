module.exports = (req, res) => {
  const fs = require('fs');
  const path = require('path');

  let mainError = null;
  let canRequireMain = false;
  try {
    require('../dist/main');
    canRequireMain = true;
  } catch (err) {
    mainError = {
      message: err.message,
      stack: err.stack,
    };
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify(
      {
        ok: true,
        canRequireMain,
        mainError,
        cwd: process.cwd(),
        node: process.version,
        has_database_url: Boolean(process.env.DATABASE_URL),
        env_keys: Object.keys(process.env).filter((k) => !k.toLowerCase().includes('secret')),
        dist_exists: fs.existsSync(path.join(process.cwd(), 'dist')),
      },
      null,
      2,
    ),
  );
};
