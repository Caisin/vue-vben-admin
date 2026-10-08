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
    let url: URL;
    try {
      url = new URL(a.url);
    } catch {
      throw new Error('请输入有效的更新包地址');
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash)
      throw new Error('更新包需要无账号密码的 HTTPS 地址');
    if (!a.signature.trim())
      throw new Error('请为每个更新包导入对应的签名文件');
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
