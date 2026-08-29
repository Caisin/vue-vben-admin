import type { OutputData } from '@editorjs/editorjs';

import { describe, expect, it } from 'vitest';

import {
  articleAssetFileIds,
  normalizeEditorData,
  toEditorData,
} from '../content';

describe('article Editor.js content boundary', () => {
  it('normalizes gallery and link blocks into the server contract', () => {
    const content = normalizeEditorData({
      blocks: [
        {
          data: {
            items: [
              { alt: 'A', caption: 'C', file_id: '12', url: 'blob:preview' },
            ],
          },
          id: 'gallery-1',
          type: 'gallery',
        },
        {
          data: {
            description: 'Docs',
            title: 'Example',
            url: 'https://example.com',
          },
          id: 'link-1',
          type: 'link',
        },
      ],
      time: 1,
      version: '2.31.6',
    } as OutputData);

    expect(content.blocks).toEqual([
      {
        data: { items: [{ alt: 'A', caption: 'C', file_id: '12' }] },
        id: 'gallery-1',
        type: 'gallery',
      },
      {
        data: {
          description: 'Docs',
          title: 'Example',
          url: 'https://example.com',
        },
        id: 'link-1',
        type: 'link',
      },
    ]);
  });

  it('deduplicates stable file ids and keeps preview urls transient', () => {
    const content = normalizeEditorData({
      blocks: [
        {
          data: { alt: '', caption: '', file_id: 7 },
          id: 'image-1',
          type: 'image',
        },
        {
          data: {
            items: [{ file_id: 7 }, { file_id: 8 }],
          },
          id: 'gallery-1',
          type: 'gallery',
        },
      ],
      version: '2.31.6',
    } as OutputData);

    expect(articleAssetFileIds(content)).toEqual([7, 8]);
    const editorData = toEditorData(
      content,
      new Map([
        ['7', 'https://cdn.example/7.jpg'],
        ['8', 'https://cdn.example/8.jpg'],
      ]),
    );
    expect(editorData.blocks[0]?.data.url).toBe('https://cdn.example/7.jpg');
    expect(JSON.stringify(content)).not.toContain('cdn.example');
  });

  it('preserves file ids beyond the JavaScript safe integer range', () => {
    const fileId = '9007199254740993';
    const content = normalizeEditorData({
      blocks: [
        {
          data: { alt: '', caption: '', file_id: fileId },
          id: 'image-large-id',
          type: 'image',
        },
      ],
      version: '2.31.6',
    } as OutputData);

    expect(articleAssetFileIds(content)).toEqual([fileId]);
    expect(content.blocks[0]).toMatchObject({ data: { file_id: fileId } });
    expect(
      toEditorData(content, new Map([[fileId, '/preview/large-id']])).blocks[0]
        ?.data.url,
    ).toBe('/preview/large-id');
  });
});
