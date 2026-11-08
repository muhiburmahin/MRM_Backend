let cachedHandler = null;

async function getHandler() {
  if (!cachedHandler) {
    const main = require('../dist/main');
    cachedHandler = main.default || main;
  }
  return cachedHandler;
}

module.exports = async (req, res) => {
  try {
    const handler = await getHandler();
    return await handler(req, res);
  } catch (err) {
    console.error('[MRM Serverless Error]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          statusCode: 500,
          error: 'FUNCTION_INVOCATION_FAILED',
          message: err?.message || 'Serverless error',
        }),
      );
    }
  }
};


