import type { Page, PageQuery } from '#/api/request';

import { apiURL, plaintextRequestClient, requestClient } from '#/api/request';
import { resolveFileAccessUrl } from '#/api/storage/file-url';

export interface SiteConfig {
  app_name: string;
  company_name: string;
  app_version: string;
  language: string;
  title: string;
  description: string;
  hero_title: string;
  hero_description: string;
  about_title: string;
  about_subtitle: string;
  explore_title: string;
  explore_subtitle: string;
  explore_description: string;
  contact_title: string;
  contact_description: string;
  contact_email: string;
  screenshots_title: string;
  download_title: string;
  android_url: string;
  ios_url: string;
  android_package: string;
  ios_bundle: string;
  copyright: string;
  theme: 'cinema' | 'guyan' | 'light';
  layout: 'centered' | 'showcase' | 'split';
  accent: string;
  logo: string;
  app_icon: string;
  hero_image: string;
  hero_background: string;
  about_image: string;
  explore_image: string;
  contact_image: string;
  screenshots: string[];
  features: { title: string; description: string }[];
  statistics: { value: string; label: string }[];
  sections: { id: string; label: string; enabled: boolean }[];
  legal: { slug: string; title: string; markdown: string }[];
}
export interface SiteWrite {
  name: string;
  domains: string[];
  config: SiteConfig;
  version?: null | number;
}
export interface Site extends SiteWrite {
  id: number;
  code: string;
  version: number;
  enabled: boolean;
  published_bundle_id?: null | number;
  published_version?: null | number;
  updated_at: number;
}
export interface SiteBuild {
  id: number;
  site_id: number;
  site_version: number;
  mode: 'export' | 'preview' | 'publish';
  state: string;
  task_id?: null | number;
  error?: null | string;
  preview_path?: null | string;
  download_path?: null | string;
  created_at: number;
}
const root = '/official-sites';
export const siteResourceUrl = (path: string) =>
  resolveFileAccessUrl(path, apiURL);
export const OfficialSitesApi = {
  defaults: () => requestClient.get<SiteWrite>(`${root}/defaults`),
  list: (params: PageQuery & { keyword?: string }) =>
    requestClient.get<Page<Site>>(`${root}/sites`, { params }),
  get: (id: number) => requestClient.get<Site>(`${root}/sites/${id}`),
  save: (input: SiteWrite, id?: number) =>
    id
      ? requestClient.put<Site>(`${root}/sites/${id}`, input)
      : requestClient.post<Site>(`${root}/sites`, input),
  copy: (id: number) =>
    requestClient.post<Site>(`${root}/sites/${id}/copy`, {}),
  unpublish: (site: Site) =>
    requestClient.post<Site>(`${root}/sites/${site.id}/unpublish`, {
      version: site.version,
    }),
  build: (site: Site, mode: SiteBuild['mode']) =>
    requestClient.post<SiteBuild>(`${root}/sites/${site.id}/${mode}`, {
      version: site.version,
    }),
  builds: (id: number) =>
    requestClient.get<Page<SiteBuild>>(`${root}/sites/${id}/builds`, {
      params: { size: 30 },
    }),
  progress: (id: number) =>
    requestClient.get<SiteBuild>(`${root}/builds/${id}`),
  download: (id: number) =>
    plaintextRequestClient.download<Blob>(`${root}/builds/${id}/download`),
};
