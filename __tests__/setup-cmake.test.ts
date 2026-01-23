const path = require('path');
const nock = require('nock');

const dataPath = path.join(__dirname, 'data');
const cachePath = path.join(__dirname, 'CACHE');
const tempPath = path.join(__dirname, 'TEMP');
// Set temp and tool directories before importing (used to set global state)
process.env['RUNNER_TEMP'] = tempPath;
process.env['RUNNER_TOOL_CACHE'] = cachePath;

import * as setup from '../src/setup-cmake';
import * as vi from '../src/version-info';
import * as v from '../src/version';
import * as fs from 'fs';

afterEach(() => {
  fs.rmdirSync(cachePath, { recursive: true });
  fs.rmdirSync(tempPath, { recursive: true });
});

describe('When adding tool to cache', () => {
  const required_version: vi.VersionInfo = {
    name: '1.2.1',
    assets: [
      {
        name: 'cmake-Darwin-x86_64',
        platform: 'darwin',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-Darwin-x86_64.tar.gz',
      },
      {
        name: 'cmake-Linux-x86_64.tar.gz',
        platform: 'linux',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-Linux-x86_64.tar.gz',
      },
      {
        name: 'cmake-win32-x86_64.zip',
        platform: 'win32',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-win32-x86_64.zip',
      },
    ],
    url: '',
    draft: false,
    prerelease: false,
  };

  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  async function checkDownloads(
    platform: NodeJS.Platform,
    darwin: boolean,
    linux: boolean,
    windows: boolean
  ) {
    const darwin_nock = nock('https://fakeaddress.com')
      .get('/cmake-Darwin-x86_64.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    const linux_nock = nock('https://fakeaddress.com')
      .get('/cmake-Linux-x86_64.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    const windows_nock = nock('https://fakeaddress.com')
      .get('/cmake-win32-x86_64.zip')
      .replyWithFile(200, path.join(dataPath, 'empty.zip'));

    await setup.addCMakeToToolCache(required_version, platform, ['x86_64']);
    expect(darwin_nock.isDone()).toBe(darwin);
    expect(linux_nock.isDone()).toBe(linux);
    expect(windows_nock.isDone()).toBe(windows);
  }

  it('downloads right archive on windows', async () => {
    await checkDownloads('win32', false, false, true);
  });

  it('downloads right archive on macos', async () => {
    await checkDownloads('darwin', true, false, false);
  });

  it('downloads right archive on linux', async () => {
    await checkDownloads('linux', false, true, false);
  });
});

describe('When using version 3.19.2 on macos', () => {
  const macos_version: vi.VersionInfo = {
    name: '3.19.2',
    assets: [
      {
        name: 'cmake-3.19.2-macos-universal.dmg',
        platform: 'darwin',
        arch: 'x86_64',
        filetype: 'package',
        url: 'https://fakeaddress.com/cmake-3.19.2-macos-universal.dmg',
      },
      {
        name: 'cmake-3.19.2-macos-universal.tar.gz',
        platform: 'darwin',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-3.19.2-macos-universal.tar.gz',
      },
    ],
    url: '',
    draft: false,
    prerelease: false,
  };

  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it.each(['arm64', 'x64'] as NodeJS.Architecture[])(
    'downloads the universal macos archive (%s)',
    async (arch) => {
      const package_nock = nock('https://fakeaddress.com')
        .get('/cmake-3.19.2-macos-universal.dmg')
        .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
      const archive_nock = nock('https://fakeaddress.com')
        .get('/cmake-3.19.2-macos-universal.tar.gz')
        .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
      const candidates = v.getArchCandidates('darwin', arch, false);
      await setup.addCMakeToToolCache(macos_version, 'darwin', candidates);
      expect(package_nock.isDone()).toBe(false);
      expect(archive_nock.isDone()).toBe(true);
    }
  );
});

describe('When using version 2.8', () => {
  // The Darwin-universal package is actually only 32 bit, whereas we need the
  // 64 bit version. We also need to consider 'universal' packages to be
  // compatible as the newer 3.19+ packages are also universal.
  // On the other hand, the Linux package is 32 bit and there is no 64 bit
  // package, so we should select the 32 bit package instead of failing.
  const version: vi.VersionInfo = {
    name: '2.8.12',
    assets: [
      {
        name: 'cmake-2.8.12.2-Darwin-universal.tar.gz',
        platform: 'darwin',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-2.8.12.2-Darwin-universal.tar.gz',
      },
      {
        name: 'cmake-2.8.12.2-Darwin64-universal.tar.gz',
        platform: 'darwin',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-2.8.12.2-Darwin64-universal.tar.gz',
      },
      {
        name: 'cmake-2.8.12.2-Linux-i386.tar.gz',
        platform: 'linux',
        arch: 'x86',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-2.8.12.2-Linux-i386.tar.gz',
      },
    ],
    url: '',
    draft: false,
    prerelease: false,
  };

  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it.each(['arm64', 'x64'] as NodeJS.Architecture[])(
    'downloads the 64 bit archive on macos (%s)',
    async (arch) => {
      const darwin_nock = nock('https://fakeaddress.com')
        .get('/cmake-2.8.12.2-Darwin-universal.tar.gz')
        .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
      const darwin64_nock = nock('https://fakeaddress.com')
        .get('/cmake-2.8.12.2-Darwin64-universal.tar.gz')
        .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
      const candidates = v.getArchCandidates('darwin', arch, false);
      expect(candidates).toEqual(['universal', 'x86_64']);
      await setup.addCMakeToToolCache(version, 'darwin', candidates);
      expect(darwin_nock.isDone()).toBe(false);
      expect(darwin64_nock.isDone()).toBe(true);
    }
  );

  // There is no Linux x86_64 version of cmake 2.8.12 (!!)
  it('downloads the 32 bit archive on x64 linux when that is all that is available', async () => {
    const linux_nock = nock('https://fakeaddress.com')
      .get('/cmake-2.8.12.2-Linux-i386.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));

    const candidates = v.getArchCandidates('linux', 'x64', false);
    expect(candidates).toEqual(['x86_64', 'x86']);
    await setup.addCMakeToToolCache(version, 'linux', candidates);
    expect(linux_nock.isDone()).toBe(true);
  });
});

describe('Using version 3.19.3', () => {
  // Version 3.19.3 introduced aarch64 packages for Linux that were not
  // correctly considered when selecting which package to use.
  const version: vi.VersionInfo = {
    name: '3.9.13',
    assets: [
      {
        name: 'cmake-3.19.3-Linux-aarch64.tar.gz',
        platform: 'linux',
        arch: 'aarch64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-3.19.3-Linux-aarch64.tar.gz',
      },
      {
        name: 'cmake-3.19.3-Linux-x86_64.tar.gz',
        platform: 'linux',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-3.19.3-Linux-x86_64.tar.gz',
      },
      {
        name: 'cmake-3.19.3-macos-universal.tar.gz',
        platform: 'darwin',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-3.19.3-macos-universal.tar.gz',
      },
      {
        name: 'cmake-3.19.3-macos10.10-universal.tar.gz',
        platform: 'darwin10.10',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://fakeaddress.com/cmake-3.19.3-macos-universal.tar.gz',
      },
    ],
    url: '',
    draft: false,
    prerelease: false,
  };

  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it.each([
    {
      arch: 'x64' as NodeJS.Architecture,
      arch_candidates: ['x86_64', 'x86'],
      x86_nock_done: true,
      aarch64_nock_done: false,
    },
    {
      arch: 'arm64' as NodeJS.Architecture,
      arch_candidates: ['aarch64'],
      x86_nock_done: false,
      aarch64_nock_done: true,
    },
  ])(
    'downloads the correct archive on linux $arch',
    async ({ arch, x86_nock_done, aarch64_nock_done, arch_candidates }) => {
      const x86_nock = nock('https://fakeaddress.com')
        .get('/cmake-3.19.3-Linux-x86_64.tar.gz')
        .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
      const aarch64_nock = nock('https://fakeaddress.com')
        .get('/cmake-3.19.3-Linux-aarch64.tar.gz')
        .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
      const candidates = v.getArchCandidates('linux', arch, false);
      expect(candidates).toEqual(arch_candidates);
      await setup.addCMakeToToolCache(version, 'linux', candidates);
      expect(x86_nock.isDone()).toBe(x86_nock_done);
      expect(aarch64_nock.isDone()).toBe(aarch64_nock_done);
    }
  );

  it.each(['x64', 'arm64'] as NodeJS.Architecture[])(
    'downloads the first archive on macos (%s)',
    async (arch) => {
      const first_nock = nock('https://fakeaddress.com')
        .get('/cmake-3.19.3-macos-universal.tar.gz')
        .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
      const second_nock = nock('https://fakeaddress.com')
        .get('/cmake-3.19.3-macos10.10-universal.tar.gz')
        .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
      const candidates = v.getArchCandidates('darwin', arch, false);
      expect(candidates).toEqual(['universal', 'x86_64']);
      await setup.addCMakeToToolCache(version, 'darwin', candidates);
      expect(first_nock.isDone()).toBe(true);
      expect(second_nock.isDone()).toBe(false);
    }
  );
});

describe('Using a version with both x86_64 and x86 binaries', () => {
  const version: vi.VersionInfo = {
    name: '3.20.2',
    assets: [
      {
        name: 'cmake-3.20.2-windows-i386.msi',
        platform: 'win32',
        arch: 'x86',
        filetype: 'package',
        url: 'https://url.test/cmake-3.20.2-windows-i386.msi',
      },
      {
        name: 'cmake-3.20.2-windows-i386.zip',
        platform: 'win32',
        arch: 'x86',
        filetype: 'archive',
        url: 'https://url.test/cmake-3.20.2-windows-i386.zip',
      },
      {
        name: 'cmake-3.20.2-windows-x86_64.msi',
        platform: 'win32',
        arch: 'x86_64',
        filetype: 'package',
        url: 'https://url.test/cmake-3.20.2-windows-x86_64.msi',
      },
      {
        name: 'cmake-3.20.2-windows-x86_64.zip',
        platform: 'win32',
        arch: 'x86_64',
        filetype: 'archive',
        url: 'https://url.test/cmake-3.20.2-windows-x86_64.zip',
      },
    ],
    url: '',
    draft: false,
    prerelease: false,
  };

  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  const platform = 'win32';
  const arch = 'x64';

  it('downloads the 32 bit package when requested', async () => {
    const x86_nock = nock('https://url.test')
      .get('/cmake-3.20.2-windows-i386.zip')
      .replyWithFile(200, path.join(dataPath, 'empty.zip'));
    const candidates = v.getArchCandidates(platform, arch, true);
    expect(candidates).toEqual(['x86']);
    await setup.addCMakeToToolCache(version, 'win32', candidates);
    expect(x86_nock.isDone()).toBe(true);
  });

  it('downloads the 64 bit package when requested', async () => {
    const x64_nock = nock('https://url.test')
      .get('/cmake-3.20.2-windows-x86_64.zip')
      .replyWithFile(200, path.join(dataPath, 'empty.zip'));
    const candidates = v.getArchCandidates(platform, arch, false);
    expect(candidates).toEqual(['x86_64', 'x86']);
    await setup.addCMakeToToolCache(version, 'win32', candidates);
    expect(x64_nock.isDone()).toBe(true);
  });
});
