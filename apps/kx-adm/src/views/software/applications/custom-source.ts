export interface CustomSource {
  documentation_url: string;
  version: string;
  url: string;
  sha256: string;
  platform: string;
  arch: string;
  format: string;
  executable: string;
  args: string[];
  install_steps: {
    args: string[];
    program: string;
    working_directory: string;
  }[];
}

export function customSourceFrom(
  source: Record<string, unknown> = {},
): CustomSource {
  return {
    documentation_url: String(source.documentation_url ?? ''),
    version: String(source.version ?? ''),
    url: String(source.url ?? ''),
    sha256: String(source.sha256 ?? ''),
    platform: String(source.platform ?? 'linux'),
    arch: String(source.arch ?? 'x86_64'),
    format: String(source.format ?? 'binary'),
    executable: String(source.executable ?? 'app'),
    args: Array.isArray(source.args) ? source.args.map(String) : [],
    install_steps: Array.isArray(source.install_steps)
      ? source.install_steps.map((step) => ({
          program: String(step.program ?? ''),
          args: Array.isArray(step.args) ? step.args.map(String) : [],
          working_directory: String(step.working_directory ?? '{release}'),
        }))
      : [],
  };
}
