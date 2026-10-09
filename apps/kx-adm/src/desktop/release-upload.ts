import type { ReleaseWrite } from '#/api/system/client-releases';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ReleaseUploadProgress {
  id: string;
  stage: string;
  bytes: number;
  total: number;
}

export async function uploadDesktopRelease(
  storageCode: string,
  current: ReleaseWrite,
  onProgress: (progress: ReleaseUploadProgress) => void,
) {
  const id = crypto.randomUUID();
  const unlisten = await listen<ReleaseUploadProgress>(
    'desktop-release-upload-progress',
    ({ payload }) => {
      if (payload.id === id) onProgress(payload);
    },
  );
  try {
    return await invoke<null | ReleaseWrite>('desktop_release_upload', {
      id,
      storageCode,
      expectedVersion: current.version || null,
      existingTargets: current.artifacts.map((artifact) => artifact.target),
    });
  } finally {
    unlisten();
  }
}
