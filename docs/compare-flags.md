# Browser vs Electron Flag Comparison

## To test in browser:
```bash
./test-browser.sh
```

This will:
1. Launch Chromium with the same User-Agent
2. Log all output to `/tmp/chromium-test.log`
3. You can observe what works in the browser

## Key differences to check:

### 1. SharedArrayBuffer
- **Browser**: Enabled by default (with proper headers)
- **Electron**: Needs explicit enablement
- **Status**: ✅ Added `enable-blink-features=SharedArrayBuffer`

### 2. WebRTC
- **Browser**: Enabled by default
- **Electron**: Needs explicit enablement  
- **Status**: ✅ Added `enable-webrtc`

### 3. WebAssembly
- **Browser**: Enabled by default
- **Electron**: Should be enabled by default, but added explicitly
- **Status**: ✅ Added `enable-webassembly`

### 4. Security Headers
- **Browser**: Sends proper COOP/COEP headers for SharedArrayBuffer
- **Electron**: May need to add these headers
- **Status**: ⚠️ Need to check if we need to add COOP/COEP headers

### 5. Permissions
- **Browser**: Prompts for permissions
- **Electron**: Needs explicit permission handlers
- **Status**: ✅ Added permission handlers

## Next steps:
1. Run the browser test and check `/tmp/chromium-test.log`
2. Compare network requests between browser and Electron
3. Check if COOP/COEP headers are needed for SharedArrayBuffer

