export function packageDefaults() {
  return {
    manager: 'auto',
    name: '',
    version: '',
    service: '',
    adopt_existing: false,
  };
}

export function packageConfigFrom(value: unknown) {
  if (!value || typeof value !== 'object') return packageDefaults();
  const record = value as Record<string, unknown>;
  return {
    manager: ['apt', 'auto', 'brew', 'dnf', 'yum'].includes(
      String(record.manager),
    )
      ? String(record.manager)
      : 'auto',
    name: String(record.name ?? ''),
    version: String(record.version ?? ''),
    service: String(record.service ?? ''),
    adopt_existing: record.adopt_existing === true,
  };
}
