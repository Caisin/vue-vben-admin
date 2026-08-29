import { USER_OVERVIEW_PATH } from './routes/core';

interface PermissionRefreshTargetOptions {
  currentFullPath: string;
  currentRouteAvailable: boolean;
  homePath?: null | string;
}

function resolvePermissionRefreshTarget({
  currentFullPath,
  currentRouteAvailable,
  homePath,
}: PermissionRefreshTargetOptions) {
  if (currentRouteAvailable) return currentFullPath;
  return homePath || USER_OVERVIEW_PATH;
}

export { resolvePermissionRefreshTarget };
