export type TreeOptionWithChildren<T> = T & { children?: T[] };

export function wrapTreeWithRoot<T>(
  items: T[],
  root: T,
): TreeOptionWithChildren<T>[] {
  return [{ ...root, children: items }];
}

export function prependTreeOption<T>(items: T[], option: T): T[] {
  return [option, ...items];
}
