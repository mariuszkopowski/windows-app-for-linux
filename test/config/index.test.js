const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadConfig, saveConfig } = require('../../app/config');

describe('loadConfig', () => {
  let tmpFile = null;

  afterEach(() => {
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
      tmpFile = null;
    }
  });

  function writeTmpConfig(obj) {
    tmpFile = path.join(os.tmpdir(), `waf-test-config-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(obj));
    return tmpFile;
  }

  it('returns defaults when config file does not exist', () => {
    const cfg = loadConfig({ configPath: '/nonexistent/path/config.json' });
    expect(cfg.url).toBe('https://windows.cloud.microsoft/#/devices');
    expect(cfg.sessionPartition).toBe('persist:windows-app');
  });

  it('merges file config over defaults', () => {
    const file = writeTmpConfig({ userAgent: 'custom-ua-string' });
    const cfg = loadConfig({ configPath: file });
    expect(cfg.userAgent).toBe('custom-ua-string');
    expect(cfg.url).toBe('https://windows.cloud.microsoft/#/devices');
  });

  it('merges window config deeply — preserves unset defaults', () => {
    const file = writeTmpConfig({ window: { width: 1920 } });
    const cfg = loadConfig({ configPath: file });
    expect(cfg.window.width).toBe(1920);
    expect(cfg.window.height).toBe(800);
  });

  it('CLI --url overrides file config', () => {
    const file = writeTmpConfig({ url: 'https://file.example.com' });
    const cfg = loadConfig({
      configPath: file,
      argv: ['node', 'app', '--url', 'https://cli.example.com'],
    });
    expect(cfg.url).toBe('https://cli.example.com');
  });

  it('CLI --user-agent overrides defaults', () => {
    const cfg = loadConfig({
      configPath: '/nonexistent.json',
      argv: ['node', 'app', '--user-agent', 'TestUA/1.0'],
    });
    expect(cfg.userAgent).toBe('TestUA/1.0');
  });

  it('ignores malformed JSON in config file', () => {
    tmpFile = path.join(os.tmpdir(), `waf-test-bad-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, '{ not valid json }');
    const cfg = loadConfig({ configPath: tmpFile });
    expect(cfg.url).toBe('https://windows.cloud.microsoft/#/devices');
  });

  it('CLI --cloud-environment resolves to the matching URL', () => {
    const cfg = loadConfig({
      configPath: '/nonexistent.json',
      argv: ['node', 'app', '--cloud-environment', 'gcchigh'],
    });
    expect(cfg.url).toBe('https://rdweb.wvd.azure.us/arm/webclient/index.html');
  });

  it('file cloudEnvironment resolves to the matching URL', () => {
    const file = writeTmpConfig({ cloudEnvironment: 'dod' });
    const cfg = loadConfig({ configPath: file });
    expect(cfg.url).toBe('https://rdweb.wvd.microsoft.us/arm/webclient/index.html');
  });

  it('explicit file url wins over cloudEnvironment preset', () => {
    const file = writeTmpConfig({ cloudEnvironment: 'gcchigh', url: 'https://custom.example.com' });
    const cfg = loadConfig({ configPath: file });
    expect(cfg.url).toBe('https://custom.example.com');
  });

  it('CLI --url wins over CLI --cloud-environment', () => {
    const cfg = loadConfig({
      configPath: '/nonexistent.json',
      argv: ['node', 'app', '--cloud-environment', 'gcchigh', '--url', 'https://cli.example.com'],
    });
    expect(cfg.url).toBe('https://cli.example.com');
  });

  it('smokeTest defaults to false', () => {
    const cfg = loadConfig({ configPath: '/nonexistent.json' });
    expect(cfg.smokeTest).toBe(false);
  });

  it('CLI --smoke-test sets smokeTest to true', () => {
    const cfg = loadConfig({
      configPath: '/nonexistent.json',
      argv: ['node', 'app', '--smoke-test'],
    });
    expect(cfg.smokeTest).toBe(true);
  });

  it('smokeTest is never read from the config file (CLI-only)', () => {
    const file = writeTmpConfig({ smokeTest: true });
    const cfg = loadConfig({ configPath: file });
    expect(cfg.smokeTest).toBe(false);
  });
});

describe('saveConfig', () => {
  let tmpFile = null;

  afterEach(() => {
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
      tmpFile = null;
    }
  });

  function tmpPath() {
    tmpFile = path.join(os.tmpdir(), `waf-test-save-${Date.now()}-${Math.random()}.json`);
    return tmpFile;
  }

  it('creates the config file with the given updates when none exists', () => {
    const file = tmpPath();
    saveConfig({ cloudEnvironment: 'gcchigh' }, { configPath: file });
    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.cloudEnvironment).toBe('gcchigh');
  });

  it('merges updates with the existing file, preserving unrelated keys', () => {
    const file = tmpPath();
    fs.writeFileSync(file, JSON.stringify({ userAgent: 'keep-me' }));
    saveConfig({ cloudEnvironment: 'dod' }, { configPath: file });
    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.userAgent).toBe('keep-me');
    expect(written.cloudEnvironment).toBe('dod');
  });

  it('deletes a key when the update value is undefined', () => {
    const file = tmpPath();
    fs.writeFileSync(file, JSON.stringify({ url: 'https://stale.example.com', cloudEnvironment: 'custom' }));
    saveConfig({ cloudEnvironment: 'gcchigh', url: undefined }, { configPath: file });
    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.url).toBeUndefined();
    expect(written.cloudEnvironment).toBe('gcchigh');
  });

  it('a subsequent loadConfig picks up the saved values', () => {
    const file = tmpPath();
    saveConfig({ cloudEnvironment: 'dod' }, { configPath: file });
    const cfg = loadConfig({ configPath: file });
    expect(cfg.url).toBe('https://rdweb.wvd.microsoft.us/arm/webclient/index.html');
  });
});
