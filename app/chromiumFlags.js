function buildFeatureFlags(isWayland, isNvidia) {
  return [
    ...(!isNvidia ? ['VaapiVideoDecoder'] : []),
    'SharedArrayBuffer',
    'CrossOriginOpenerPolicy',
    ...(isWayland ? ['WebRTCPipeWireCapturer'] : []),
  ].join(',');
}

// Proprietary NVIDIA drivers crash Chromium's GPU process (SIGSEGV in ANGLE's
// EGL_CreateWindowSurface) when GPU compositing is on, leaving no window.
// Software compositing avoids it; other GPUs/drivers are left untouched.
function buildGpuSwitches(isNvidia) {
  return isNvidia ? ['disable-gpu-compositing'] : [];
}

module.exports = { buildFeatureFlags, buildGpuSwitches };
