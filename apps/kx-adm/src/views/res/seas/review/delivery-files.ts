/** 从目录或文件名识别集数；不能识别时返回 0，由用户确认后提交。 */
export function deliveryEpisode(path: string): number {
  const parts = path.replaceAll('\\', '/').split('/');
  for (const parent of parts.slice(0, -1).toReversed()) {
    const marked =
      parent.match(/第\s*(\d+)\s*集/i) ??
      parent.match(/^ep(?:isode)?[-_ ]*(\d+)$/i) ??
      parent.match(/^(\d{1,3})$/);
    if (marked) return Number(marked[1]);
  }
  const name = (parts.at(-1) ?? '').replace(/\.[^.]+$/, '');
  const marked = name.match(/第\s*(\d+)\s*集/i) ?? name.match(/(\d+)\D*$/);
  return Number(marked?.[1] ?? 0);
}
