import type { JsonValue } from '#/api/request';
import type {
  WmxtAdminUser,
  WmxtFamily,
  WmxtOrganizationView,
} from '#/api/wmxt';
import type { StorageFileReference } from '#/components/file-picker';

export interface SelectOption {
  label: string;
  value: number | string;
}

export function userLabel(user: WmxtAdminUser): string {
  return `${user.nickname || user.username || user.tel || '用户'}（${user.user_id}）`;
}

export function userOptions(users: WmxtAdminUser[]): SelectOption[] {
  return users.map((user) => ({ label: userLabel(user), value: user.user_id }));
}

export function familyOptions(families: WmxtFamily[]): SelectOption[] {
  return families.flatMap((family) =>
    family.id === undefined
      ? []
      : [
          {
            label: `${family.name}（${family.invite_code || family.id}）`,
            value: family.id,
          },
        ],
  );
}

export function organizationOptions(
  organizations: WmxtOrganizationView[],
): SelectOption[] {
  return organizations.map((organization) => ({
    label: `${organization.name}（${organization.org_code || organization.id}）`,
    value: organization.id,
  }));
}

function displayJsonItem(item: JsonValue): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'number' || typeof item === 'boolean')
    return String(item);
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const fileId = item.file_id;
    const label = item.label;
    const value = item.value;
    if (typeof fileId === 'string' || typeof fileId === 'number')
      return String(fileId);
    if (typeof label === 'string') return label;
    if (typeof value === 'string') return value;
  }
  return '';
}

export function jsonArrayToLines(value: JsonValue | null | undefined): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => displayJsonItem(item))
    .filter(Boolean)
    .join('\n');
}

export function fileRefsToJson(
  value: null | StorageFileReference[] | undefined,
): JsonValue {
  return (value ?? []).map((item) => ({
    file_ext: item.file_ext ?? '',
    file_id: item.file_id,
    file_name: item.file_name ?? '',
    media_type: item.media_type ?? 'file',
    size: item.size ?? 0,
  }));
}

export function fileRefsFromJson(
  value: JsonValue | null | undefined,
): StorageFileReference[] {
  if (!Array.isArray(value)) return [];
  const references: StorageFileReference[] = [];
  for (const item of value) {
    if (typeof item === 'string' || typeof item === 'number') {
      references.push({ file_id: item });
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const fileId = item.file_id ?? item.value;
      if (typeof fileId === 'string' || typeof fileId === 'number') {
        references.push({
          file_ext:
            typeof item.file_ext === 'string' ? item.file_ext : undefined,
          file_id: fileId,
          file_name:
            typeof item.file_name === 'string' ? item.file_name : undefined,
          media_type:
            item.media_type === 'image' || item.media_type === 'video'
              ? item.media_type
              : 'file',
          size:
            typeof item.size === 'string' || typeof item.size === 'number'
              ? item.size
              : undefined,
        });
      }
    }
  }
  return references;
}

export function linesToStringArray(value: null | string | undefined): string[] {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function linesToOptionObjects(value: null | string | undefined) {
  return linesToStringArray(value).map((item) => ({
    label: item,
    value: item,
  }));
}

export function toNumber(
  value: number | string | undefined,
  fallback = 0,
): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}
