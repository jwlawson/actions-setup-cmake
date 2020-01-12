// Each asset is a file that is packaged as part of a version release.
export interface AssetInfo {
  name: string;
  platform: string;
  arch: string;
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
