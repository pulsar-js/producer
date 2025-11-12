const { pathToFileURL } = require('url');
const path = require('path');

// Cache for the ESM module
let esmModuleCache = null;

async function loadESM() {
  if (!esmModuleCache) {
    const modulePath = pathToFileURL(path.join(__dirname, 'index.js')).href;
    esmModuleCache = await import(modulePath);
  }
  return esmModuleCache;
}

// Sync wrapper that throws helpful error
function requiresAsync() {
  throw new Error(
    '@pulsar-js/producer: This is an ESM module. ' +
    'Use dynamic import() or import the CommonJS async wrappers:\n' +
    'const { publish, test, getPublisher } = require("@pulsar-js/producer");\n' +
    'await publish(...) or await test(...)'
  );
}

// Export async wrappers
module.exports = {
  get Publisher() {
    return requiresAsync();
  },

  async publish(connection_string, message, opts = {}, bus) {
    const mod = await loadESM();
    return mod.publish(connection_string, message, opts, bus);
  },

  async test(connection_string, opts = {}, bus) {
    const mod = await loadESM();
    return mod.test(connection_string, opts, bus);
  },

  async getPublisher(connection_string, opts = {}) {
    const mod = await loadESM();
    return new mod.Publisher(connection_string, opts);
  },
};

// Default export
module.exports.default = module.exports.publish;
