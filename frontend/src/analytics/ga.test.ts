describe('GA analytics wrapper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    document.head.innerHTML = '';
    process.env = { ...originalEnv };
    delete process.env.REACT_APP_GA_ID;
    delete process.env.NEXT_PUBLIC_GA_ID;
    delete process.env.VITE_GA_ID;
    delete (window as any).gtag;
    delete (window as any).dataLayer;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('tracks events when a measurement id is configured', async () => {
    process.env.REACT_APP_GA_ID = 'G-TEST1234';
    const gtagMock = jest.fn();
    (window as any).gtag = gtagMock;

    const ga = await import('./ga');
    ga.initAnalytics();
    ga.trackEvent({
      action: 'test_action',
      category: 'Test',
      label: 'label',
      value: 42,
    });

    expect(gtagMock).toHaveBeenCalledWith(
      'event',
      'test_action',
      expect.objectContaining({
        event_category: 'Test',
        event_label: 'label',
        value: 42,
      })
    );
    expect(document.getElementById('ga4-gtag-script')).not.toBeNull();
  });

  it('does not load GA script when measurement id is missing', async () => {
    const ga = await import('./ga');

    ga.initAnalytics();
    ga.trackEvent({ action: 'noop_action' });

    expect(document.getElementById('ga4-gtag-script')).toBeNull();
  });
});
