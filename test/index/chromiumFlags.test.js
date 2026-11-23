const { buildFeatureFlags } = require('../../app/chromiumFlags');

describe('buildFeatureFlags', () => {
  it('includes VaapiVideoDecoder on non-NVIDIA', () => {
    expect(buildFeatureFlags(false, false)).toContain('VaapiVideoDecoder');
  });

  it('excludes VaapiVideoDecoder on NVIDIA', () => {
    expect(buildFeatureFlags(false, true)).not.toContain('VaapiVideoDecoder');
  });

  it('always includes SharedArrayBuffer', () => {
    expect(buildFeatureFlags(false, false)).toContain('SharedArrayBuffer');
    expect(buildFeatureFlags(true, true)).toContain('SharedArrayBuffer');
  });

  it('always includes CrossOriginOpenerPolicy', () => {
    expect(buildFeatureFlags(false, false)).toContain('CrossOriginOpenerPolicy');
    expect(buildFeatureFlags(true, true)).toContain('CrossOriginOpenerPolicy');
  });

  it('includes WebRTCPipeWireCapturer on Wayland', () => {
    expect(buildFeatureFlags(true, false)).toContain('WebRTCPipeWireCapturer');
  });

  it('excludes WebRTCPipeWireCapturer on X11', () => {
    expect(buildFeatureFlags(false, false)).not.toContain('WebRTCPipeWireCapturer');
  });

  it('returns comma-separated string', () => {
    const flags = buildFeatureFlags(false, false);
    expect(typeof flags).toBe('string');
    expect(flags.split(',').length).toBeGreaterThan(1);
  });
});

describe('buildGpuSwitches', () => {
  const { buildGpuSwitches } = require('../../app/chromiumFlags');
  it('disables GPU compositing on NVIDIA', () => {
    expect(buildGpuSwitches(true)).toEqual(['disable-gpu-compositing']);
  });
  it('adds nothing on non-NVIDIA', () => {
    expect(buildGpuSwitches(false)).toEqual([]);
  });
});
