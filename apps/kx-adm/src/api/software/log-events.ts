import JSONBigInt from 'json-bigint';

import { plaintextRequestClient } from '#/api/request';

export interface SoftwareLog {
  id: number | string;
  operation_id: number | string;
  step: number;
  stream: string;
  content: string;
  created_at: number | string;
}
export interface SoftwareStreamState {
  id: number | string;
  state: string;
  action: string;
  step: number;
  total_steps: number;
  error_summary: string;
}

export function softwareEventParser(
  onLog: (log: SoftwareLog) => void,
  onState: (state: SoftwareStreamState) => void,
) {
  let buffer = '';
  const json = JSONBigInt({ storeAsString: true, strict: true });
  return (chunk: string) => {
    buffer = `${buffer}${chunk}`.replaceAll('\r\n', '\n');
    if (buffer.length > 1_048_576)
      throw new Error('software_log_frame_too_large');
    let end = buffer.indexOf('\n\n');
    while (end >= 0) {
      const lines = buffer.slice(0, end).split('\n');
      buffer = buffer.slice(end + 2);
      const event = lines
        .find((line) => line.startsWith('event:'))
        ?.slice(6)
        .trim();
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (event === 'error')
        throw new Error(data || 'software_log_stream_unavailable');
      if (event === 'log' && data) onLog(json.parse(data));
      if (event === 'state' && data) onState(json.parse(data));
      end = buffer.indexOf('\n\n');
    }
  };
}

export async function watchSoftwareLogs(
  id: number | string,
  after: string,
  onLog: (log: SoftwareLog) => void,
  onState: (state: SoftwareStreamState) => void,
  signal: AbortSignal,
) {
  const connection = new AbortController();
  const abort = () => connection.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  try {
    await plaintextRequestClient.requestSSE(
      `/software/operations/${id}/events?after=${encodeURIComponent(after)}`,
      undefined,
      {
        signal: connection.signal,
        onMessage: softwareEventParser(onLog, onState),
      },
    );
  } finally {
    connection.abort();
    signal.removeEventListener('abort', abort);
  }
}
