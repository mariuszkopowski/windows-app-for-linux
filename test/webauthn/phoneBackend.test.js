const { EventEmitter } = require('events');
const { runPhoneAssertion, PasskeyError } = require('../../app/webauthn/phoneBackend');

function fakeHelper() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), { write: jest.fn(), end: jest.fn() });
  child.kill = jest.fn();
  return child;
}

function run(child, extra = {}) {
  return runPhoneAssertion({
    helperPath: '/fake/helper',
    origin: 'https://login.microsoft.com',
    topOrigin: null,
    publicKey: { challenge: 'abc', rpId: 'login.microsoft.com' },
    spawnFn: () => child,
    ...extra,
  });
}

const line = (obj) => Buffer.from(`${JSON.stringify(obj)}\n`);

describe('runPhoneAssertion', () => {
  it('writes the request as one JSON line on stdin', () => {
    const child = fakeHelper();
    run(child).catch(() => {});
    expect(child.stdin.write).toHaveBeenCalledTimes(1);
    const sent = child.stdin.write.mock.calls[0][0];
    expect(sent.endsWith('\n')).toBe(true);
    expect(JSON.parse(sent)).toEqual({
      origin: 'https://login.microsoft.com',
      topOrigin: null,
      publicKey: { challenge: 'abc', rpId: 'login.microsoft.com' },
    });
  });

  it('forwards qr/status events and resolves with the credential', async () => {
    const child = fakeHelper();
    const onEvent = jest.fn();
    const promise = run(child, { onEvent });
    child.stdout.emit('data', line({ type: 'qr', url: 'FIDO:/1', svg: '<svg/>' }));
    child.stdout.emit('data', line({ type: 'status', state: 'proximity' }));
    child.stdout.emit('data', line({ type: 'result', credential: { id: 'x' } }));
    await expect(promise).resolves.toEqual({ id: 'x' });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[0][0].type).toBe('qr');
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('reassembles events split across chunks', async () => {
    const child = fakeHelper();
    const promise = run(child);
    const full = JSON.stringify({ type: 'result', credential: { id: 'split' } }) + '\n';
    child.stdout.emit('data', Buffer.from(full.slice(0, 10)));
    child.stdout.emit('data', Buffer.from(full.slice(10)));
    await expect(promise).resolves.toEqual({ id: 'split' });
  });

  it('rejects with a mapped error when the helper reports one', async () => {
    const child = fakeHelper();
    const promise = run(child);
    child.stdout.emit('data', line({ type: 'error', code: 'bad-origin', message: 'nope' }));
    await expect(promise).rejects.toMatchObject({ code: 'bad-origin', domName: 'SecurityError', message: 'nope' });
  });

  it('maps unknown helper errors to NotAllowedError', async () => {
    const child = fakeHelper();
    const promise = run(child);
    child.stdout.emit('data', line({ type: 'error', code: 'timeout', message: 'slow' }));
    await expect(promise).rejects.toMatchObject({ domName: 'NotAllowedError' });
  });

  it('rejects when the helper exits without a result, including stderr', async () => {
    const child = fakeHelper();
    const promise = run(child);
    child.stderr.emit('data', Buffer.from('boom'));
    child.emit('close', 3);
    await expect(promise).rejects.toMatchObject({ code: 'helper-exited' });
    await expect(promise).rejects.toThrow(/boom/);
  });

  it('rejects when the helper cannot be spawned', async () => {
    const child = fakeHelper();
    const promise = run(child);
    child.emit('error', new Error('ENOENT'));
    await expect(promise).rejects.toMatchObject({ code: 'helper-failed', domName: 'NotAllowedError' });
  });

  it('ignores non-JSON noise on stdout', async () => {
    const child = fakeHelper();
    const promise = run(child);
    child.stdout.emit('data', Buffer.from('not json\n'));
    child.stdout.emit('data', line({ type: 'result', credential: { id: 'ok' } }));
    await expect(promise).resolves.toEqual({ id: 'ok' });
  });

  it('cancels via AbortSignal: closes stdin and rejects (user → NotAllowedError)', async () => {
    const child = fakeHelper();
    const controller = new AbortController();
    const promise = run(child, { signal: controller.signal });
    controller.abort('user');
    await expect(promise).rejects.toMatchObject({ code: 'cancelled', domName: 'NotAllowedError' });
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('maps a page-initiated abort to AbortError', async () => {
    const child = fakeHelper();
    const controller = new AbortController();
    const promise = run(child, { signal: controller.signal });
    controller.abort('page');
    await expect(promise).rejects.toMatchObject({ domName: 'AbortError' });
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const child = fakeHelper();
    const controller = new AbortController();
    controller.abort('user');
    await expect(run(child, { signal: controller.signal })).rejects.toBeInstanceOf(PasskeyError);
  });
});

describe('runPhoneAssertionWithRetry', () => {
  const { runPhoneAssertionWithRetry, isRetryableTransportError } = require('../../app/webauthn/phoneBackend');

  function helperThat(...outcomes) {
    const spawnFn = jest.fn(() => {
      const child = fakeHelper();
      const outcome = outcomes.shift();
      setImmediate(() => child.stdout.emit('data', line(outcome)));
      return child;
    });
    return spawnFn;
  }
  const base = (spawnFn, extra = {}) => ({
    helperPath: '/fake', origin: 'https://login.microsoft.com', publicKey: {}, spawnFn, ...extra,
  });
  const transportFailure = { type: 'error', code: 'assertion', message: 'Transport(ConnectionFailed)' };

  it('retries a transport failure with a fresh helper run and then succeeds', async () => {
    const spawnFn = helperThat(transportFailure, { type: 'result', credential: { id: 'ok' } });
    const onRetry = jest.fn();
    await expect(runPhoneAssertionWithRetry(base(spawnFn, { onRetry }))).resolves.toEqual({ id: 'ok' });
    expect(spawnFn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts', async () => {
    const spawnFn = helperThat(transportFailure, transportFailure, transportFailure, transportFailure);
    await expect(runPhoneAssertionWithRetry(base(spawnFn))).rejects.toMatchObject({ code: 'assertion' });
    expect(spawnFn).toHaveBeenCalledTimes(3);
  });

  it('does not retry phone-side refusals', async () => {
    const spawnFn = helperThat({ type: 'error', code: 'assertion', message: 'Ctap(OperationDenied)' });
    await expect(runPhoneAssertionWithRetry(base(spawnFn))).rejects.toMatchObject({ code: 'assertion' });
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry after the signal aborted', async () => {
    const controller = new AbortController();
    const spawnFn = jest.fn(() => {
      const child = fakeHelper();
      setImmediate(() => { controller.abort('user'); child.stdout.emit('data', line(transportFailure)); });
      return child;
    });
    await expect(runPhoneAssertionWithRetry(base(spawnFn, { signal: controller.signal }))).rejects.toBeDefined();
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });

  it('classifies only transport errors as retryable', () => {
    expect(isRetryableTransportError(new PasskeyError('assertion', 'Transport(ConnectionFailed)'))).toBe(true);
    expect(isRetryableTransportError(new PasskeyError('timeout', 'Transport(x)'))).toBe(false);
    expect(isRetryableTransportError(new Error('Transport('))).toBe(false);
  });
});
