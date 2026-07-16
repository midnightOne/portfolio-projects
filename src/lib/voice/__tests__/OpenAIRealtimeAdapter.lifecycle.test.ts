import { OpenAIRealtimeAdapter } from '../OpenAIRealtimeAdapter';

jest.mock('@/lib/navigation/UIManager', () => ({
  UIManager: {
    getInstance: () => ({
      setBackgroundUpdateCallback: jest.fn(),
      disablePassiveContext: jest.fn(),
    }),
  },
}));

jest.mock('../output-level-meter', () => ({ meterMediaStream: jest.fn() }));

function microphoneStream() {
  const stop = jest.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  return { stream, stop };
}

describe('OpenAIRealtimeAdapter connection resource lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stops a WebSocket microphone when token mint fails before capture starts', async () => {
    const { stream, stop } = microphoneStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(stream) },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'mint failed' }),
    }) as jest.Mock;

    const close = jest.fn();
    const adapter = new OpenAIRealtimeAdapter() as any;
    adapter._config = { sessionConfig: { transport: 'websocket' } };
    adapter._transportKind = 'websocket';
    adapter._sessionInputKind = 'mic';
    adapter._session = { close, connect: jest.fn() };

    await expect(adapter.connect({ audioInput: true })).rejects.toThrow('mint failed');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(adapter._pendingWsMicStream).toBeNull();
    expect(adapter._connectionStatus).toBe('error');
  });

  it('stops a WebSocket microphone when transport connection fails after mint', async () => {
    const { stream, stop } = microphoneStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(stream) },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ client_secret: 'ephemeral', model: 'realtime-test' }),
    }) as jest.Mock;

    const close = jest.fn();
    const adapter = new OpenAIRealtimeAdapter() as any;
    adapter._config = { sessionConfig: { transport: 'websocket' } };
    adapter._transportKind = 'websocket';
    adapter._sessionInputKind = 'mic';
    adapter._session = {
      close,
      connect: jest.fn().mockRejectedValue(new Error('socket failed')),
    };

    await expect(adapter.connect({ audioInput: true })).rejects.toThrow('socket failed');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(adapter._pendingWsMicStream).toBeNull();
  });

  it('releases a pending microphone even before the adapter is connected', async () => {
    const { stream, stop } = microphoneStream();
    const close = jest.fn();
    const adapter = new OpenAIRealtimeAdapter() as any;
    adapter._pendingWsMicStream = stream;
    adapter._session = { close };
    adapter._isConnected = false;

    await adapter.disconnect();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(adapter._pendingWsMicStream).toBeNull();
    expect(adapter._connectionStatus).toBe('disconnected');
  });

  it('still releases local audio when session close throws', async () => {
    const { stream, stop } = microphoneStream();
    const adapter = new OpenAIRealtimeAdapter() as any;
    adapter._pendingWsMicStream = stream;
    adapter._session = { close: jest.fn(() => { throw new Error('close failed'); }) };
    adapter._isConnected = false;

    await expect(adapter.disconnect()).rejects.toThrow('close failed');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(adapter._pendingWsMicStream).toBeNull();
    expect(adapter._connectionStatus).toBe('disconnected');
  });
});
