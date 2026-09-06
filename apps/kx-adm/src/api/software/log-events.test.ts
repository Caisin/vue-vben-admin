import { describe, expect, it, vi } from 'vitest';

import { softwareEventParser } from './log-events';
vi.mock('#/api/request', () => ({
  plaintextRequestClient: { requestSSE: vi.fn() },
}));

describe('software SSE events', () => {
  it('handles fragmented CRLF frames and exact large IDs', () => {
    const logs = vi.fn();
    const state = vi.fn();
    const parse = softwareEventParser(logs, state);
    const frame =
      'event: log\r\nid: 9007199254740993\r\ndata: {"id":9007199254740993,"content":"安装中"}\r\n\r\nevent: state\r\ndata: {"state":"succeeded"}\r\n\r\n';
    for (const piece of frame) parse(piece);
    expect(logs.mock.calls).toEqual([
      [{ id: '9007199254740993', content: '安装中' }],
    ]);
    expect(state).toHaveBeenCalledWith({ state: 'succeeded' });
  });
  it('ignores keep-alive and raises explicit stream failures', () => {
    const logs = vi.fn();
    const state = vi.fn();
    const parse = softwareEventParser(logs, state);
    parse(': keep-alive\n\n');
    expect(logs).not.toHaveBeenCalled();
    expect(() =>
      parse('event: error\ndata: software_log_stream_unavailable\n\n'),
    ).toThrow('software_log_stream_unavailable');
  });
});
