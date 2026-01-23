// Each asset is a file that is packaged as part of a version release.
export interface AssetInfo {
  name: string;
  platform: string;
  arch: InternalArch;
  filetype: string;
  url: string;
}

export interface VersionInfo {
  assets: AssetInfo[];
  url: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
}

// Abstraction over arch strings in package names, used to match compatible
// cmake packages: x64 is mapped to 'x86_64', arm64 is mapped to 'aarch64'.
// Unknown arch strings are mapped to 'unknown'
export type InternalArch =
  | 'x86_64'
  | 'x86'
  | 'aarch64'
  | 'universal'
  | 'unknown';
