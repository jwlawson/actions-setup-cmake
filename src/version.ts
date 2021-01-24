import * as rest from 'typed-rest-client/RestClient';
import * as core from '@actions/core';
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
  } else if (filename.match(/Darwin/) || filename.match(/macos/)) {
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
  zip: 'archive',
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
  } else if (filename.match(/universal/)) {
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
        url: a.browser_download_url,
      });
    });
    const sv_version = semver.coerce(v.tag_name);
    if (sv_version) {
      result.push({
        assets: assets,
        url: v.url,
        name: sv_version.toString(),
        draft: v.draft,
        prerelease: v.prerelease,
      });
    }
  });
  return result;
}

function getHttpOptions(
  api_token: string,
  page_number: number = 1
): rest.IRequestOptions {
  let options: rest.IRequestOptions = {};
  options.additionalHeaders = { Accept: 'application/vnd.github.v3+json' };
  if (page_number > 1) {
    options.queryParameters = { params: { page: page_number } };
  }
  if (api_token) {
    options.additionalHeaders.Authorization = 'token ' + api_token;
  }
  return options;
}

// Parse the pagination Link header to get the next url.
// The header has the form <...url...>; rel="...", <...>; rel="..."
function getNextFromLink(link: string): string | undefined {
  const rLink = /<(?<url>[A-Za-z0-9_?=.\/:-]*?)>; rel="(?<rel>\w*?)"/g;
  let match;
  while ((match = rLink.exec(link)) != null) {
    if (match.groups && /next/.test(match.groups.rel)) {
      return match.groups.url;
    }
  }
  return;
}

export async function getAllVersionInfo(
  api_token: string = ''
): Promise<vi.VersionInfo[]> {
  const client = new rest.RestClient(USER_AGENT);

  // Fetch the first page of releases and use that to select the pagination
  // method to use for all other pages.
  const options = getHttpOptions(api_token);
  const version_response = await client.get<GitHubVersion[]>(
    VERSION_URL,
    options
  );
  if (version_response.statusCode != 200 || !version_response.result) {
    return [];
  }
  let raw_versions = version_response.result;
  // Try to use the Link headers for pagination. If these are not available,
  // then fall back to checking all pages until an empty page of results is
  // returned.
  let headers: { link?: string } = version_response.headers;
  if (headers.link) {
    core.debug(`Using link headers for pagination`);
    let next = getNextFromLink(headers.link);
    while (next) {
      const options = getHttpOptions(api_token);
      const version_response = await client.get<GitHubVersion[]>(next, options);
      if (version_response.statusCode != 200 || !version_response.result) {
        break;
      }
      raw_versions = raw_versions.concat(version_response.result);
      headers = version_response.headers;
      if (!headers.link) {
        break;
      }
      next = getNextFromLink(headers.link);
    }
  } else {
    core.debug(`Using page count for pagination`);
    const max_pages = 20;
    let cur_page = 2;
    while (cur_page <= max_pages) {
      const options = getHttpOptions(api_token, cur_page);
      const version_response = await client.get<GitHubVersion[]>(
        VERSION_URL,
        options
      );
      if (!version_response.result || version_response.result.length == 0) {
        break;
      }
      raw_versions = raw_versions.concat(version_response.result);
      cur_page++;
    }
  }
  core.debug(`overall got ${raw_versions.length} versions`);
  const versions: vi.VersionInfo[] = convertToVersionInfo(raw_versions);
  return versions;
}

function getLatest(version_list: vi.VersionInfo[]): vi.VersionInfo {
  const sorted_versions: vi.VersionInfo[] = version_list.sort((a, b) =>
    semver.rcompare(a.name, b.name)
  );
  return sorted_versions[0];
}

export function getLatestMatching(
  version: string,
  version_list: vi.VersionInfo[]
): vi.VersionInfo {
  let matching_versions = version_list
    .filter((v) => !v.draft && !v.prerelease)
    .filter((v) => semver.satisfies(v.name, version));
  if (matching_versions.length == 0) {
    throw new Error('Unable to find version matching ' + version);
  }
  return getLatest(matching_versions);
}
