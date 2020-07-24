const path = require('path');
const nock = require('nock');

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

test('Download uses correct platform url', async () => {
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
  nock.disableNetConnect();
  const darwin_nock = nock('https://fakeaddress.com')
    .get('/cmake-Darwin-x86_64.tar.gz')
    .reply(200, { bazel_darwin: true });
  const linux_nock = nock('https://fakeaddress.com')
    .get('/cmake-Linux-x86_64.tar.gz')
    .reply(200, { bazel_linux: true });
  const windows_nock = nock('https://fakeaddress.com')
    .get('/cmake-win32-x86_64.zip')
    .reply(200, { bazel_windows: true });

  // As we do not provide valid archives, the extract command will always fail
  await expect(setup.addCMakeToToolCache(required_version)).rejects.toThrow();
  if (process.platform === 'win32') {
    expect(darwin_nock.isDone()).toBe(false);
    expect(linux_nock.isDone()).toBe(false);
    expect(windows_nock.isDone()).toBe(true);
  } else if (process.platform === 'darwin') {
    expect(darwin_nock.isDone()).toBe(true);
    expect(linux_nock.isDone()).toBe(false);
    expect(windows_nock.isDone()).toBe(false);
  } else if (process.platform === 'linux') {
    expect(darwin_nock.isDone()).toBe(false);
    expect(linux_nock.isDone()).toBe(true);
    expect(windows_nock.isDone()).toBe(false);
  }

  nock.cleanAll();
  nock.enableNetConnect();
});
