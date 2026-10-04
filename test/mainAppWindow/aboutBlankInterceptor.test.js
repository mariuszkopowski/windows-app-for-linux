const { createAboutBlankInterceptor } = require('../../app/mainAppWindow/helpers');

describe('createAboutBlankInterceptor', () => {
  it('cancels about:blank requests', () => {
    const handler = createAboutBlankInterceptor(jest.fn());
    const callback = jest.fn();
    handler({ url: 'about:blank', resourceType: 'mainFrame' }, callback);
    expect(callback).toHaveBeenCalledWith({ cancel: true });
  });

  it('increments internal count on about:blank', () => {
    const handler = createAboutBlankInterceptor(jest.fn());
    handler({ url: 'about:blank', resourceType: 'mainFrame' }, jest.fn());
    expect(handler.getCount()).toBe(1);
  });

  it('opens follow-up HTTPS mainFrame request externally', () => {
    const openExternal = jest.fn();
    const handler = createAboutBlankInterceptor(openExternal);
    handler({ url: 'about:blank', resourceType: 'mainFrame' }, jest.fn());
    const callback = jest.fn();
    handler({ url: 'https://example.com', resourceType: 'mainFrame' }, callback);
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
    expect(callback).toHaveBeenCalledWith({ cancel: true });
  });

  it('resets count to 0 after handling follow-up request', () => {
    const handler = createAboutBlankInterceptor(jest.fn());
    handler({ url: 'about:blank', resourceType: 'mainFrame' }, jest.fn());
    handler({ url: 'https://example.com', resourceType: 'mainFrame' }, jest.fn());
    expect(handler.getCount()).toBe(0);
  });

  it('does not open external for sub-resource requests after about:blank', () => {
    const openExternal = jest.fn();
    const handler = createAboutBlankInterceptor(openExternal);
    handler({ url: 'about:blank', resourceType: 'mainFrame' }, jest.fn());
    handler({ url: 'https://example.com/script.js', resourceType: 'script' }, jest.fn());
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('passes through unrelated requests without cancelling', () => {
    const handler = createAboutBlankInterceptor(jest.fn());
    const callback = jest.fn();
    handler({ url: 'https://windows.cloud.microsoft/api', resourceType: 'xhr' }, callback);
    expect(callback).toHaveBeenCalledWith({});
  });

  it('resets count on unrelated request', () => {
    const handler = createAboutBlankInterceptor(jest.fn());
    handler({ url: 'about:blank', resourceType: 'mainFrame' }, jest.fn());
    handler({ url: 'https://example.com/image.png', resourceType: 'image' }, jest.fn());
    expect(handler.getCount()).toBe(0);
  });

  it('lets exempt requests (our auth popups) through untouched', () => {
    const openExternal = jest.fn();
    const handler = createAboutBlankInterceptor(openExternal, d => d.webContentsId === 7);
    const first = jest.fn();
    const second = jest.fn();
    handler({ url: 'about:blank', resourceType: 'mainFrame', webContentsId: 7 }, first);
    handler({ url: 'https://login.microsoftonline.com/x', resourceType: 'mainFrame', webContentsId: 7 }, second);
    expect(first).toHaveBeenCalledWith({});
    expect(second).toHaveBeenCalledWith({});
    expect(openExternal).not.toHaveBeenCalled();
    expect(handler.getCount()).toBe(0);
  });
});
