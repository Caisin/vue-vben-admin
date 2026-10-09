import type { ReleaseWrite } from '#/api/system/client-releases';

export const platforms = [
  { label: 'macOS · Apple Silicon', value: 'darwin-aarch64' },
  { label: 'macOS · Intel', value: 'darwin-x86_64' },
  { label: 'Windows · x64', value: 'windows-x86_64' },
  { label: 'Windows · ARM64', value: 'windows-aarch64' },
  { label: 'Windows · x86', value: 'windows-i686' },
  { label: 'Linux · x64 (AppImage)', value: 'linux-x86_64' },
  { label: 'Linux · ARM64 (AppImage)', value: 'linux-aarch64' },
  { label: 'Linux · ARMv7 (AppImage)', value: 'linux-armv7' },
];
export function validateRelease(value: ReleaseWrite) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version))
    throw new Error('请输入正式版本号，例如 1.2.3');
  if (value.artifacts.length === 0 || value.artifacts.length > 8)
    throw new Error('请添加 1 至 8 个平台更新包');
  const targets = new Set<string>();
  for (const a of value.artifacts) {
    if (!platforms.some((p) => p.value === a.target) || targets.has(a.target))
      throw new Error('平台不能为空或重复');
    targets.add(a.target);
    if (!a.file_id) {
      let url: URL;
      try {
        url = new URL(a.url);
      } catch {
        throw new Error('请输入有效的更新包地址');
      }
      if (url.protocol !== 'https:' || url.username || url.password || url.hash)
        throw new Error('更新包需要无账号密码的 HTTPS 地址');
    }
    if (!a.signature.trim())
      throw new Error('发行包缺少签名，请重新生成发行包');
  }
}
/** 只接受发行脚本输出的结构，文件内容始终作为数据处理。 */
export function parseReleaseManifest(text: string): ReleaseWrite {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('发行清单格式无效');
  const d = data as Record<string, unknown>;
  if (
    typeof d.version !== 'string' ||
    typeof d.notes !== 'string' ||
    !Array.isArray(d.artifacts)
  )
    throw new Error('发行清单缺少版本、更新说明或平台包');
  const value: ReleaseWrite = {
    version: d.version,
    notes: d.notes,
    artifacts: d.artifacts.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('平台包格式无效');
      const a = item as Record<string, unknown>;
      if (
        typeof a.target !== 'string' ||
        typeof a.url !== 'string' ||
        typeof a.signature !== 'string'
      )
        throw new Error('平台包缺少地址或签名');
      return { target: a.target, url: a.url, signature: a.signature.trim() };
    }),
  };
  validateRelease(value);
  return value;
}

/** 只读取有界元信息，安装包用 Blob 切片上传，不将整个大文件复制到内存。 */
export async function parseReleaseBundle(file: File) {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (
    header.length !== 12 ||
    new TextDecoder().decode(header.slice(0, 8)) !== 'KXUPDATE'
  )
    throw new Error('请选择发行脚本生成的 .kx-update 发行包');
  const length = new DataView(header.buffer).getUint32(8, true);
  if (!length || length > 65_536 || file.size <= length + 12)
    throw new Error('发行包长度无效');
  const data = JSON.parse(await file.slice(12, 12 + length).text());
  if (
    typeof data.name !== 'string' ||
    /[\\/]/.test(data.name) ||
    !data.name ||
    data.size !== file.size - length - 12
  )
    throw new Error('发行包内容不完整');
  const release = parseReleaseManifest(
    JSON.stringify({
      version: data.version,
      notes: data.notes,
      artifacts: [
        {
          target: data.target,
          signature: data.signature,
          url: 'https://bundle.invalid/package',
        },
      ],
    }),
  );
  const artifact = release.artifacts[0];
  if (!artifact) throw new Error('发行包缺少平台');
  const target = artifact.target;
  if (
    (target.startsWith('darwin-') && !data.name.endsWith('.app.tar.gz')) ||
    (target.startsWith('windows-') && !/\.(exe|msi)$/.test(data.name)) ||
    (target.startsWith('linux-') && !data.name.endsWith('.AppImage'))
  )
    throw new Error('安装包格式与平台不匹配');
  return {
    release,
    file: new File([file.slice(12 + length)], data.name, {
      type: 'application/octet-stream',
    }),
  };
}
