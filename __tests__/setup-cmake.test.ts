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
    platform: string,
    darwin: boolean,
    linux: boolean,
    windows: boolean
  ) {
    const orig_platform: string = process.platform;
    Object.defineProperty(process, 'platform', {
      value: platform,
    });
    expect(process.platform).toBe(platform);

    const darwin_nock = nock('https://fakeaddress.com')
      .get('/cmake-Darwin-x86_64.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    const linux_nock = nock('https://fakeaddress.com')
      .get('/cmake-Linux-x86_64.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    const windows_nock = nock('https://fakeaddress.com')
      .get('/cmake-win32-x86_64.zip')
      .replyWithFile(200, path.join(dataPath, 'empty.zip'));

    await setup.addCMakeToToolCache(required_version);
    expect(darwin_nock.isDone()).toBe(darwin);
    expect(linux_nock.isDone()).toBe(linux);
    expect(windows_nock.isDone()).toBe(windows);

    Object.defineProperty(process, 'platform', {
      value: orig_platform,
    });
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

  it('downloads the macos archive', async () => {
    const orig_platform: string = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    expect(process.platform).toBe('darwin');
    const package_nock = nock('https://fakeaddress.com')
      .get('/cmake-3.19.2-macos-universal.dmg')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    const archive_nock = nock('https://fakeaddress.com')
      .get('/cmake-3.19.2-macos-universal.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    await setup.addCMakeToToolCache(macos_version);
    expect(package_nock.isDone()).toBe(false);
    expect(archive_nock.isDone()).toBe(true);
    Object.defineProperty(process, 'platform', {
      value: orig_platform,
    });
  });
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

  it('downloads the 64 bit archive on macos', async () => {
    const orig_platform: string = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    expect(process.platform).toBe('darwin');
    const darwin_nock = nock('https://fakeaddress.com')
      .get('/cmake-2.8.12.2-Darwin-universal.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    const darwin64_nock = nock('https://fakeaddress.com')
      .get('/cmake-2.8.12.2-Darwin64-universal.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    await setup.addCMakeToToolCache(version);
    expect(darwin_nock.isDone()).toBe(false);
    expect(darwin64_nock.isDone()).toBe(true);
    Object.defineProperty(process, 'platform', {
      value: orig_platform,
    });
  });

  it('downloads the 32 bit archive on linux', async () => {
    const orig_platform: string = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    expect(process.platform).toBe('linux');
    const linux_nock = nock('https://fakeaddress.com')
      .get('/cmake-2.8.12.2-Linux-i386.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));

    await setup.addCMakeToToolCache(version);
    expect(linux_nock.isDone()).toBe(true);
    Object.defineProperty(process, 'platform', {
      value: orig_platform,
    });
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
        arch: '',
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
        platform: 'darwin',
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

  it('downloads the x86_64 archive on linux', async () => {
    const orig_platform: string = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    expect(process.platform).toBe('linux');
    const x86_nock = nock('https://fakeaddress.com')
      .get('/cmake-3.19.3-Linux-x86_64.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    const aarch64_nock = nock('https://fakeaddress.com')
      .get('/cmake-3.19.3-Linux-aarch64.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    await setup.addCMakeToToolCache(version);
    expect(x86_nock.isDone()).toBe(true);
    expect(aarch64_nock.isDone()).toBe(false);
    Object.defineProperty(process, 'platform', {
      value: orig_platform,
    });
  });

  it('downloads the first archive on macos', async () => {
    const orig_platform: string = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    expect(process.platform).toBe('darwin');
    const first_nock = nock('https://fakeaddress.com')
      .get('/cmake-3.19.3-macos-universal.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    const second_nock = nock('https://fakeaddress.com')
      .get('/cmake-3.19.3-macos10.10-universal.tar.gz')
      .replyWithFile(200, path.join(dataPath, 'empty.tar.gz'));
    await setup.addCMakeToToolCache(version);
    expect(first_nock.isDone()).toBe(true);
    expect(second_nock.isDone()).toBe(false);
    Object.defineProperty(process, 'platform', {
      value: orig_platform,
    });
  });
});
