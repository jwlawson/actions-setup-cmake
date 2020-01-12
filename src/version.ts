import Octokit from '@octokit/rest';
import * as rest from 'typed-rest-client/RestClient';
import * as semver from 'semver';
import * as vi from './version-info';

const VERSION_URL: string =
  'https://api.github.com/repos/Kitware/CMake/releases';
const USER_AGENT: string = 'jwlawson-actions-setup-cmake';

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubVersion {
  assets: GithubAsset[];
  url: string;
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
}

function extractPlatformFrom(filename: string): string {
  if (filename.match(/Linux/)) {
    return 'linux';
  } else if (filename.match(/Darwin/)) {
    return 'darwin';
  } else if (filename.match(/win32/)) {
    return 'win32';
  } else {
    return '';
  }
}

const KNOWN_EXTENSIONS: { [key: string]: string } = {
  dmg: 'package',
  gz: 'archive',
  sh: 'script',
  txt: 'text',
  asc: 'text',
  msi: 'package',
  zip: 'archive'
};

function extractFileTypeFrom(filename: string): string {
  const ext = filename.split('.').pop() || '';
  if (KNOWN_EXTENSIONS.hasOwnProperty(ext)) {
    return KNOWN_EXTENSIONS[ext];
  } else {
    return '';
  }
}

function extractArchFrom(filename: string): string {
  if (filename.match(/x86_64/)) {
    return 'x86_64';
  } else if (filename.match(/x86/)) {
    return 'x86';
  } else if (filename.match(/i386/)) {
    return 'x86';
  } else {
    return '';
  }
}

function convertToVersionInfo(versions: GitHubVersion[]): vi.VersionInfo[] {
  let result = new Array<vi.VersionInfo>();
  versions.map((v) => {
    let assets = new Array<vi.AssetInfo>();
    v.assets.map((a) => {
      assets.push({
        name: a.name,
        platform: extractPlatformFrom(a.name),
        arch: extractArchFrom(a.name),
        filetype: extractFileTypeFrom(a.name),
        url: a.browser_download_url
      });
    });
    const sv_version = semver.coerce(v.tag_name);
    if (sv_version) {
      result.push({
        assets: assets,
        url: v.url,
        name: sv_version.toString(),
        draft: v.draft,
        prerelease: v.prerelease
      });
    }
  });
  return result;
}

function getHttpOptions(api_token: string): Octokit.Options {
  if (api_token) {
    return { auth: 'token ' + api_token };
  } else {
    return {};
  }
}

interface GitHubHeaders {
  link: string;
}

function getNumPagesFromHeaders(headers: GitHubHeaders): number {
  if (headers.link) {
    const last_page_match = headers.link.match(/page=([0-9]*)>; rel="last"/);
    if (last_page_match && last_page_match.length > 1) {
      return parseInt(last_page_match[1], 10);
    }
  }
  return 1;
}

export async function getAllVersionInfo(
  api_token: string = ''
): Promise<vi.VersionInfo[]> {
  const client = new Octokit(getHttpOptions(api_token));
  const first_page = await client.repos.listReleases({
    owner: 'Kitware',
    repo: 'CMake'
  });
  let raw_versions: GitHubVersion[] = first_page.data;
  const last_page = getNumPagesFromHeaders(first_page.headers);
  let cur_page = 2;
  for (; cur_page <= last_page; cur_page++) {
    const this_page = await client.repos.listReleases({
      owner: 'Kitware',
      repo: 'CMake',
      page: cur_page
    });
    raw_versions = raw_versions.concat(this_page.data);
  }
  const versions: vi.VersionInfo[] = convertToVersionInfo(raw_versions);
  return versions;
}

async function getLatest(
  version_list: vi.VersionInfo[]
): Promise<vi.VersionInfo> {
  const sorted_versions: vi.VersionInfo[] = version_list.sort((a, b) =>
    semver.rcompare(a.name, b.name)
  );
  return sorted_versions[0];
}

export async function getLatestMatching(
  version: string,
  version_list: vi.VersionInfo[]
): Promise<vi.VersionInfo> {
  let matching_versions = version_list
    .filter((v) => !v.draft && !v.prerelease)
    .filter((v) => semver.satisfies(v.name, version));
  if (matching_versions.length == 0) {
    throw new Error('Unable to find version matching ' + version);
  }
  return getLatest(matching_versions);
}
