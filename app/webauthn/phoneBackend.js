const { spawn } = require('child_process');

// Maps helper/internal error codes onto the DOMException names WebAuthn uses.
const DOM_ERROR_NAMES = {
  'page-aborted': 'AbortError',
  'bad-origin': 'SecurityError',
  'bad-request': 'TypeError',
};

class PasskeyError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.domName = DOM_ERROR_NAMES[code] || 'NotAllowedError';
  }
}

// Runs one GetAssertion over the phone (hybrid) transport via the native
// helper (helper/phone-passkey). Protocol: one JSON request line on stdin,
// newline-delimited JSON events on stdout; closing stdin cancels.
// `onEvent` receives {type: 'qr'|'status', ...}. Resolves with the
// AuthenticationResponseJSON, rejects with PasskeyError.
function runPhoneAssertion({ helperPath, origin, topOrigin, publicKey, onEvent, signal, spawnFn = spawn }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = '';
    let stderr = '';
    const child = spawnFn(helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    function finish(fn, value) {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      try { child.stdin.end(); } catch { /* already closed */ }
      // Give the helper a moment to exit on its own, then make sure.
      setTimeout(() => { try { child.kill('SIGTERM'); } catch { /* gone */ } }, 500).unref();
      fn(value);
    }

    function onAbort() {
      const reason = signal.reason === 'page' ? 'page-aborted' : 'cancelled';
      finish(reject, new PasskeyError(reason, 'The passkey request was cancelled.'));
    }

    function handleLine(line) {
      if (!line.trim()) return;
      let event;
      try { event = JSON.parse(line); } catch { return; }
      if (event.type === 'result') finish(resolve, event.credential);
      else if (event.type === 'error') finish(reject, new PasskeyError(event.code, event.message));
      else if (onEvent) onEvent(event);
    }

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        handleLine(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
    });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString('utf8')).slice(-2000); });
    child.on('error', (err) => finish(reject, new PasskeyError('helper-failed', err.message)));
    child.on('close', (code) => {
      handleLine(buffer);
      finish(reject, new PasskeyError('helper-exited', `Passkey helper exited (${code}). ${stderr}`.trim()));
    });

    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    child.stdin.on('error', () => { /* helper already gone; 'close' reports it */ });
    child.stdin.write(`${JSON.stringify({ origin, topOrigin: topOrigin || null, publicKey })}\n`);
  });
}

// The tunnel to the phone occasionally fails right after the QR scan
// (`Transport(ConnectionFailed)`); the QR code is single-use, so a retry means
// a fresh helper run and a new QR. Phone-side refusals and cancellations are
// not retried.
const MAX_ATTEMPTS = 3;

function isRetryableTransportError(err) {
  return err instanceof PasskeyError
    && (err.code === 'channel' || err.code === 'assertion')
    && /Transport\(/.test(err.message);
}

async function runPhoneAssertionWithRetry({ maxAttempts = MAX_ATTEMPTS, onRetry, signal, ...options }) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await runPhoneAssertion({ ...options, signal });
    } catch (err) {
      if (attempt >= maxAttempts || (signal && signal.aborted) || !isRetryableTransportError(err)) throw err;
      if (onRetry) onRetry(attempt, err);
    }
  }
}

module.exports = { runPhoneAssertion, runPhoneAssertionWithRetry, isRetryableTransportError, PasskeyError };
