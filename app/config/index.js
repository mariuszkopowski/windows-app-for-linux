const path = require('path');
const fs = require('fs');
const { parseArgs } = require('util');
const defaults = require('./options');

const DEFAULT_CONFIG_PATH = path.join(
  process.env.XDG_CONFIG_HOME || path.join(require('os').homedir(), '.config'),
  'windows-app-for-linux',
  'config.json'
);

// The CLI is parsed with node's built-in util.parseArgs (no dependency; yargs >= 18 is
// ESM-only, which breaks require() under Jest/older Node). Like hideBin(), we drop the 2
// leading entries, assuming argv = [execPath, appPath, ...args] —
// true for `electron .` (unpackaged: Electron sets process.defaultApp=true and keeps the
// appPath entry) but NOT for a packaged binary (AppImage/Flatpak/Snap), where argv is only
// [execPath, ...args]. Pad it so a real CLI flag like --smoke-test isn't eaten as if it were
// the appPath. Only applies to the real process.argv default — explicit argv (tests) is
// already [execPath, appPath, ...args]-shaped and passed through untouched.
function defaultArgv() {
  const isPackagedElectron = process.versions?.electron && typeof process.defaultApp === 'undefined';
  return isPackagedElectron ? [process.argv[0], '', ...process.argv.slice(1)] : process.argv;
}

function loadConfig({ configPath = DEFAULT_CONFIG_PATH, argv = defaultArgv() } = {}) {
  const fileConfig = (() => {
    try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
    catch { return {}; }
  })();

  // strict:false — Chromium/Electron flags (--ozone-platform, ...) share this argv and must be ignored.
  const { values: args } = parseArgs({
    args: argv.slice(2),
    options: {
      url: { type: 'string' },
      'user-agent': { type: 'string' },
      'cloud-environment': { type: 'string' },
      'smoke-test': { type: 'boolean', default: false },
    },
    strict: false,
    allowPositionals: true,
  });
  // An unknown --cloud-environment preset is ignored rather than aborting startup.
  if (!Object.hasOwn(defaults.cloudEnvironments, args['cloud-environment'])) delete args['cloud-environment'];

  const cloudEnvironment = args['cloud-environment'] || fileConfig.cloudEnvironment;
  const envUrl = cloudEnvironment && defaults.cloudEnvironments[cloudEnvironment];

  return {
    ...defaults,
    ...(envUrl && { url: envUrl }),
    ...fileConfig,
    ...(args.url && { url: args.url }),
    ...(args['user-agent'] && { userAgent: args['user-agent'] }),
    // CLI-only — not persisted to/read from config.json, always reflects this run's flag.
    smokeTest: Boolean(args['smoke-test']),
    window: {
      ...defaults.window,
      ...(fileConfig.window || {}),
    },
  };
}

function saveConfig(updates, { configPath = DEFAULT_CONFIG_PATH } = {}) {
  const existing = (() => {
    try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
    catch { return {}; }
  })();

  const merged = { ...existing, ...updates };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) delete merged[key];
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
  return merged;
}

const config = loadConfig();
module.exports = config;
module.exports.loadConfig = loadConfig;
module.exports.saveConfig = saveConfig;
