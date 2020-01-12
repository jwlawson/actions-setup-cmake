import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as vi from './version-info';

const PACKAGE_NAME: string = 'cmake';

function getURL(version: vi.VersionInfo): string {
  const matching_assets: vi.AssetInfo[] = version.assets
    .filter((a) => a.platform === process.platform && a.filetype === 'archive')
    .sort();
  const num_found = matching_assets.length;
  if (num_found == 0) {
    throw new Error(
      `Could not find ${process.platform} asset for cmake version ${version.name}`
    );
  }
  const asset_url = matching_assets[0].url;
  core.debug(
    `Found ${num_found} assets for ${process.platform} with version ${version.name}`
  );
  core.debug(`Using asset url ${asset_url}`);
  return asset_url;
}

async function getArchive(url: string): Promise<string> {
  const download = await tc.downloadTool(url);
  if (url.endsWith('zip')) {
    return await tc.extractZip(download);
  } else if (url.endsWith('tar.gz')) {
    return await tc.extractTar(download);
  } else {
    throw new Error(`Could not determine filetype of ${url}`);
  }
}

export async function addCMakeToToolCache(
  version: vi.VersionInfo
): Promise<string> {
  const extracted_archive = await getArchive(getURL(version));
  return await tc.cacheDir(extracted_archive, PACKAGE_NAME, version.name);
}

export async function addCMakeToPath(version: vi.VersionInfo): Promise<void> {
  let tool_path: string = tc.find(PACKAGE_NAME, version.name);
  if (!tool_path) {
    tool_path = await addCMakeToToolCache(version);
  }
  const bin_path = path.join(tool_path, 'bin');
  await core.addPath(bin_path);
}
