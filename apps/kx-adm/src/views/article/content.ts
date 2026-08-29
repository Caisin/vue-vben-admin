import type { OutputBlockData, OutputData } from '@editorjs/editorjs';

import type {
  ArticleBlock,
  ArticleContent,
  ArticleListItem,
} from '#/api/article';

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function stringOf(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberOf(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fileIdOf(value: unknown): number | string | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return /^[1-9]\d*$/.test(normalized) ? normalized : undefined;
}

function listItems(value: unknown): ArticleListItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { content: item, items: [] };
    const record = recordOf(item);
    return {
      content: stringOf(record.content ?? record.text),
      items: listItems(record.items),
    };
  });
}

function tableRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value.map((row) =>
    Array.isArray(row) ? row.map((cell) => stringOf(cell)) : [],
  );
}

function normalizeBlock(block: OutputBlockData): ArticleBlock | undefined {
  const id = block.id || crypto.randomUUID();
  const data = recordOf(block.data);
  switch (block.type) {
    case 'attachment': {
      const file_id = fileIdOf(data.file_id);
      if (!file_id) return undefined;
      return {
        id,
        type: 'attachment',
        data: { file_id, title: stringOf(data.title) },
      };
    }
    case 'checklist': {
      return {
        id,
        type: 'checklist',
        data: {
          items: Array.isArray(data.items)
            ? data.items.map((item) => ({
                checked: Boolean(recordOf(item).checked),
                text: stringOf(recordOf(item).text),
              }))
            : [],
        },
      };
    }
    case 'code': {
      return {
        id,
        type: 'code',
        data: { code: stringOf(data.code), language: stringOf(data.language) },
      };
    }
    case 'delimiter': {
      return { id, type: 'delimiter', data: {} };
    }
    case 'gallery': {
      const items = Array.isArray(data.items)
        ? data.items
            .map((item) => {
              const record = recordOf(item);
              const file_id = fileIdOf(record.file_id);
              return file_id
                ? {
                    alt: stringOf(record.alt),
                    caption: stringOf(record.caption),
                    file_id,
                  }
                : undefined;
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
        : [];
      if (items.length === 0) return undefined;
      return {
        id,
        type: 'gallery',
        data: { items },
      };
    }
    case 'header': {
      return {
        id,
        type: 'header',
        data: {
          level: Math.min(4, Math.max(2, numberOf(data.level, 2))),
          text: stringOf(data.text),
        },
      };
    }
    case 'image': {
      const file_id = fileIdOf(data.file_id);
      if (!file_id) return undefined;
      return {
        id,
        type: 'image',
        data: {
          alt: stringOf(data.alt),
          caption: stringOf(data.caption),
          file_id,
        },
      };
    }
    case 'link': {
      return {
        id,
        type: 'link',
        data: {
          description: stringOf(data.description),
          title: stringOf(data.title),
          url: stringOf(data.url),
        },
      };
    }
    case 'list': {
      const style = data.style === 'ordered' ? 'ordered' : 'unordered';
      return {
        id,
        type: 'list',
        data: { items: listItems(data.items), style },
      };
    }
    case 'paragraph': {
      return { id, type: 'paragraph', data: { text: stringOf(data.text) } };
    }
    case 'quote': {
      return {
        id,
        type: 'quote',
        data: { caption: stringOf(data.caption), text: stringOf(data.text) },
      };
    }
    case 'table': {
      return {
        id,
        type: 'table',
        data: {
          content: tableRows(data.content),
          with_headings: Boolean(data.with_headings ?? data.withHeadings),
        },
      };
    }
    default: {
      return undefined;
    }
  }
}

export function normalizeEditorData(data: OutputData): ArticleContent {
  return {
    blocks: data.blocks
      .map(normalizeBlock)
      .filter((item): item is ArticleBlock => Boolean(item)),
    time: data.time,
    version: data.version || '2.31.6',
  };
}

export function articleAssetFileIds(content?: ArticleContent) {
  const ids = new Map<string, number | string>();
  for (const block of content?.blocks ?? []) {
    if (block.type === 'image' || block.type === 'attachment') {
      const id = fileIdOf(block.data.file_id);
      if (id) ids.set(String(id), id);
    }
    if (block.type === 'gallery') {
      for (const item of block.data.items) {
        const id = fileIdOf(item.file_id);
        if (id) ids.set(String(id), id);
      }
    }
  }
  return [...ids.values()];
}

export function toEditorData(
  content?: ArticleContent,
  assetUrls: ReadonlyMap<string, string> = new Map(),
): OutputData {
  return {
    blocks:
      content?.blocks.map((block) => {
        if (block.type === 'image') {
          return {
            data: {
              ...block.data,
              url: assetUrls.get(String(block.data.file_id)),
            },
            id: block.id,
            type: block.type,
          };
        }
        if (block.type === 'gallery') {
          return {
            data: {
              items: block.data.items.map((item) => ({
                ...item,
                url: assetUrls.get(String(item.file_id)),
              })),
            },
            id: block.id,
            type: block.type,
          };
        }
        return { data: block.data, id: block.id, type: block.type };
      }) ?? [],
    time: typeof content?.time === 'number' ? content.time : Date.now(),
    version: content?.version || '2.31.6',
  };
}
