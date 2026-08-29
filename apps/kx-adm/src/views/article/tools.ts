import type {
  API,
  BlockTool,
  BlockToolConstructorOptions,
  ToolConfig,
} from '@editorjs/editorjs';

interface ArticleImageToolData {
  alt?: string;
  caption?: string;
  file_id?: number | string;
  url?: string;
}

interface ArticleAttachmentToolData {
  file_id?: number | string;
  title?: string;
}

interface ArticleGalleryToolItem {
  alt?: string;
  caption?: string;
  file_id?: number | string;
  url?: string;
}

interface ArticleGalleryToolData {
  items?: ArticleGalleryToolItem[];
}

interface ArticleLinkToolData {
  description?: string;
  title?: string;
  url?: string;
}

interface ToolOptions<TData extends object> extends BlockToolConstructorOptions<
  TData,
  ToolConfig
> {
  api: API;
  data: TData;
}

function textInput(value: string, placeholder: string) {
  const input = document.createElement('input');
  input.className = 'article-tool-input';
  input.placeholder = placeholder;
  input.value = value;
  return input;
}

export class ArticleImageTool implements BlockTool {
  static get isReadOnlySupported() {
    return true;
  }

  private altInput = textInput('', '图片替代文本');
  private captionInput = textInput('', '图片说明');

  private data: ArticleImageToolData;

  private readOnly: boolean;

  constructor({ data, readOnly }: ToolOptions<ArticleImageToolData>) {
    this.data = data ?? {};
    this.readOnly = readOnly;
  }

  render() {
    const root = document.createElement('div');
    root.className = 'article-image-tool';
    const box = document.createElement('div');
    box.className = 'article-image-tool__box';
    if (this.data.url) {
      const image = document.createElement('img');
      image.alt = this.data.alt ?? '';
      image.src = this.data.url;
      box.append(image);
    } else {
      box.textContent = this.data.file_id
        ? `图片文件 #${this.data.file_id}`
        : '未选择图片';
    }
    this.altInput.value = this.data.alt ?? '';
    this.captionInput.value = this.data.caption ?? '';
    this.altInput.disabled = this.readOnly;
    this.captionInput.disabled = this.readOnly;
    root.append(box, this.altInput, this.captionInput);
    return root;
  }

  save() {
    return {
      alt: this.altInput.value.trim(),
      caption: this.captionInput.value.trim(),
      file_id: this.data.file_id,
    } satisfies ArticleImageToolData;
  }
}

export class ArticleAttachmentTool implements BlockTool {
  static get isReadOnlySupported() {
    return true;
  }

  private data: ArticleAttachmentToolData;

  private readOnly: boolean;

  private titleInput = textInput('', '附件标题');

  constructor({ data, readOnly }: ToolOptions<ArticleAttachmentToolData>) {
    this.data = data ?? {};
    this.readOnly = readOnly;
  }

  render() {
    const root = document.createElement('div');
    root.className = 'article-attachment-tool';
    const label = document.createElement('div');
    label.textContent = this.data.file_id
      ? `附件文件 #${this.data.file_id}`
      : '未选择附件';
    this.titleInput.value = this.data.title ?? '';
    this.titleInput.disabled = this.readOnly;
    root.append(label, this.titleInput);
    return root;
  }

  save() {
    return {
      file_id: this.data.file_id,
      title: this.titleInput.value.trim() || `附件 #${this.data.file_id ?? ''}`,
    } satisfies ArticleAttachmentToolData;
  }
}

export class ArticleGalleryTool implements BlockTool {
  static get isReadOnlySupported() {
    return true;
  }

  private data: ArticleGalleryToolData;

  constructor({ data }: ToolOptions<ArticleGalleryToolData>) {
    this.data = data ?? {};
  }

  render() {
    const root = document.createElement('div');
    root.className = 'article-gallery-tool';
    for (const item of this.data.items ?? []) {
      const figure = document.createElement('figure');
      if (item.url) {
        const image = document.createElement('img');
        image.alt = item.alt ?? '';
        image.src = item.url;
        figure.append(image);
      } else {
        const placeholder = document.createElement('div');
        placeholder.textContent = `图片文件 #${item.file_id ?? ''}`;
        figure.append(placeholder);
      }
      if (item.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = item.caption;
        figure.append(caption);
      }
      root.append(figure);
    }
    return root;
  }

  save() {
    return {
      items: (this.data.items ?? []).map(({ alt, caption, file_id }) => ({
        alt: alt?.trim() ?? '',
        caption: caption?.trim() ?? '',
        file_id,
      })),
    } satisfies ArticleGalleryToolData;
  }
}

export class ArticleLinkTool implements BlockTool {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return { icon: '<span>链</span>', title: '链接' };
  }

  private data: ArticleLinkToolData;

  private descriptionInput = textInput('', '链接说明');

  private readOnly: boolean;

  private titleInput = textInput('', '链接标题');

  private urlInput = textInput('', 'https://');

  constructor({ data, readOnly }: ToolOptions<ArticleLinkToolData>) {
    this.data = data ?? {};
    this.readOnly = readOnly;
  }

  render() {
    const root = document.createElement('div');
    root.className = 'article-link-tool';
    this.urlInput.value = this.data.url ?? '';
    this.titleInput.value = this.data.title ?? '';
    this.descriptionInput.value = this.data.description ?? '';
    this.urlInput.disabled = this.readOnly;
    this.titleInput.disabled = this.readOnly;
    this.descriptionInput.disabled = this.readOnly;
    root.append(this.urlInput, this.titleInput, this.descriptionInput);
    return root;
  }

  save() {
    return {
      description: this.descriptionInput.value.trim(),
      title: this.titleInput.value.trim(),
      url: this.urlInput.value.trim(),
    } satisfies ArticleLinkToolData;
  }
}
