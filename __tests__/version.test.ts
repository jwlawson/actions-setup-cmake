const path = require('path');
const nock = require('nock');
const dataPath = path.join(__dirname, 'data');

import * as version from '../src/version';

describe('Pulling from multipage results with Link header', () => {
  beforeEach(() => {
    nock.disableNetConnect();
    // Releases file contains version info for:
    // 3.16.2, 3.16.1, 3.16.0, 3.16.0-rc4
    // 3.15.6, 3.15.5, 3.15.1, 3.15.0
    // 3.14.7, 3.14.1, 3.14.0
    // 3.13.5
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .replyWithFile(200, path.join(dataPath, 'releases.json'), {
        'Content-Type': 'application/json',
        Link:
          '<https://api.github.com/repos/Kitware/CMake/releases?page=2>; rel="next", <https://api.github.com/repos/Kitware/CMake/releases?page=2>; rel="last"',
      });
    // Releases file 2 contains version info for:
    // 2.4.8, 2.6.4, 2.8.10.2, 2.8.12.2
    // 3.0.0, 3.0.1, 3.0.2
    // 3.1.0, 3.1.1, 3.1.2, 3.1.3
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 2 })
      .replyWithFile(200, path.join(dataPath, 'releases2.json'), {
        'Content-Type': 'application/json',
        Link:
          '<https://api.github.com/repos/Kitware/CMake/releases?page=1>; rel="first", <https://api.github.com/repos/Kitware/CMake/releases?page=1>; rel="prev"',
      });
  });
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
  it('parses the latest version', async () => {
    const version_info = await version.getAllVersionInfo();
    const latest = version.getLatestMatching('', version_info);
    expect(latest.name).toMatch(/3.16.2/);
  });
  it('selects an exact version for full release', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.15.5', version_info);
    expect(selected.name).toMatch(/3.15.5/);
  });
  it('selects the latest version for provided minor release', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.15', version_info);
    expect(selected.name).toMatch(/3.15.6/);
  });
  it('selects the latest version for provided minor release with x', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.15.x', version_info);
    expect(selected.name).toMatch(/3.15.6/);
  });
  it('selects the latest version for provided major release with x', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    expect(selected.name).toMatch(/3.16.2/);
  });
  it('throws on non-existent full version', async () => {
    const version_info = await version.getAllVersionInfo();
    expect(() => {
      version.getLatestMatching('100.0.0', version_info);
    }).toThrow('Unable to find version matching 100.0.0');
  });
  it('throws on non-existent part version', async () => {
    const version_info = await version.getAllVersionInfo();
    expect(() => {
      version.getLatestMatching('100.0.x', version_info);
    }).toThrow('Unable to find version matching 100.0');
  });
  it('select versions on second page', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('2.x', version_info);
    expect(selected.name).toMatch(/2.8.12/);
  });
  it('ignores extra numbers in version', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('2.8.10', version_info);
    expect(selected.name).toMatch(/2.8.10/);
  });
});

describe('Pulling from multipage results without Link header', () => {
  // When the Link header is not available, we still want to be able to parse
  // all pages. This could be done by iterating over all possible pages until
  // we get no further results.
  beforeEach(() => {
    nock.disableNetConnect();
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .replyWithFile(200, path.join(dataPath, 'releases.json'), {
        'Content-Type': 'application/json',
      });
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 2 })
      .replyWithFile(200, path.join(dataPath, 'releases2.json'), {
        'Content-Type': 'application/json',
      });
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 3 })
      .reply(200, []);
  });
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
  it('selects exact version from first page', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.15.5', version_info);
    expect(selected.name).toMatch(/3.15.5/);
  });
  it('throws on non-existent full version', async () => {
    const version_info = await version.getAllVersionInfo();
    expect(() => {
      version.getLatestMatching('100.0.0', version_info);
    }).toThrow('Unable to find version matching 100.0.0');
  });
  it('selects versions on second page', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('2.x', version_info);
    expect(selected.name).toMatch(/2.8.12/);
  });
});

describe('When api token is required', () => {
  beforeEach(() => {
    nock('https://api.github.com', {
      reqheaders: {
        Authorization: 'token secret_token',
      },
    })
      .get('/repos/Kitware/CMake/releases')
      .replyWithFile(200, path.join(dataPath, 'releases.json'), {
        'Content-Type': 'application/json',
      });
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .replyWithError('Invalid API token');
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 2 })
      .reply(200, []);
  });
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
  it('includes api token in request', async () => {
    const version_info = await version.getAllVersionInfo('secret_token');
    expect(version_info).toEqual(expect.arrayContaining([expect.anything()]));
  });
  it('passing empty token gives error', async () => {
    await expect(version.getAllVersionInfo('')).rejects.toThrow(
      'Invalid API token'
    );
  });
  it('not passing token gives error', async () => {
    await expect(version.getAllVersionInfo()).rejects.toThrow(
      'Invalid API token'
    );
  });
});

describe('When using macos 3.19.2 release', () => {
  const releases = [
    {
      tag_name: 'v3.19.2',
      assets: [
        {
          name: 'cmake-3.19.2-Linux-x86_64.tar.gz',
          browser_download_url:
            'https://fakeaddress/cmake-3.19.2-Linux-x86_64.tar.gz',
        },
        {
          name: 'cmake-3.19.2-macos-universal.dmg',
          browser_download_url:
            'https://fakeaddress.com/cmake-3.19.2-macos-universal.dmg',
        },
        {
          name: 'cmake-3.19.2-macos-universal.tar.gz',
          browser_download_url:
            'https://fakeaddress.com/cmake-3.19.2-macos-universal.tar.gz',
        },
      ],
    },
  ];

  beforeEach(() => {
    nock.disableNetConnect();
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .reply(200, releases);
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 2 })
      .reply(200, []);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('correctly parses the version', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    expect(selected.name).toMatch(/3.19.2/);
  });

  it('correctly parses the universal macos archive', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    const assets = selected.assets;
    const macos = assets.filter(
      (a) => a.platform === 'darwin' && a.filetype === 'archive'
    );
    expect(macos.length).toBe(1);
    const macosAsset = macos[0];
    expect(macosAsset).toEqual({
      name: 'cmake-3.19.2-macos-universal.tar.gz',
      platform: 'darwin',
      arch: 'x86_64',
      filetype: 'archive',
      url: 'https://fakeaddress.com/cmake-3.19.2-macos-universal.tar.gz',
    });
  });
});

describe('When providing multiple different archs', () => {
  const releases = [
    {
      tag_name: 'v3.19.3',
      assets: [
        {
          name: 'cmake-3.19.3-Linux-aarch64.tar.gz',
          browser_download_url:
            'https://fakeaddress.com/cmake-3.19.3-Linux-aarch64.tar.gz',
        },
        {
          name: 'cmake-3.19.3-Linux-x86_64.tar.gz',
          browser_download_url:
            'https://fakeaddress.com/cmake-3.19.3-Linux-x86_64.tar.gz',
        },
      ],
    },
  ];

  beforeEach(() => {
    nock.disableNetConnect();
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .reply(200, releases);
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 2 })
      .reply(200, []);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('correctly parses the version', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    expect(selected.name).toMatch(/3.19.3/);
  });

  it('correctly parses the x86 archive', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    const assets = selected.assets;
    const macos = assets.filter((a) => a.arch === 'x86_64');
    expect(macos.length).toBe(1);
    const macosAsset = macos[0];
    expect(macosAsset).toEqual({
      name: 'cmake-3.19.3-Linux-x86_64.tar.gz',
      platform: 'linux',
      arch: 'x86_64',
      filetype: 'archive',
      url: 'https://fakeaddress.com/cmake-3.19.3-Linux-x86_64.tar.gz',
    });
  });

  it('correctly parses the aarch86 archive', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    const assets = selected.assets;
    const macos = assets.filter((a) => a.arch != 'x86_64');
    expect(macos.length).toBe(1);
    const macosAsset = macos[0];
    expect(macosAsset).toEqual({
      name: 'cmake-3.19.3-Linux-aarch64.tar.gz',
      platform: 'linux',
      arch: '',
      filetype: 'archive',
      url: 'https://fakeaddress.com/cmake-3.19.3-Linux-aarch64.tar.gz',
    });
  });
});

describe('When using the 3.20 release', () => {
  // The 3.20 release changes the linux and windows filenames from
  //  * cmake-3.20.0-Linux-x86_64 -> cmake-3.20.0-linux-x86_64
  //  * cmake-3.20.0-win64-x64 -> cmake-3.20.0-windows-x86_64
  const releases = [
    {
      tag_name: 'v3.20.0',
      assets: [
        {
          name: 'cmake-3.20.0-linux-x86_64.tar.gz',
          browser_download_url:
            'https://url.test/cmake-3.20.0-linux-x86_64.tar.gz',
        },
        {
          name: 'cmake-3.20.0-windows-x86_64.tar.gz',
          browser_download_url:
            'https://url.test/cmake-3.20.0-windows-x86_64.tar.gz',
        },
      ],
    },
  ];

  beforeEach(() => {
    nock.disableNetConnect();
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .reply(200, releases);
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 2 })
      .reply(200, []);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('correctly parses the version', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    expect(selected.name).toMatch(/3.20.0/);
  });

  it('correctly parses the linux archive', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    const assets = selected.assets.filter(
      (a) => a.platform === 'linux' && a.filetype === 'archive'
    );
    expect(assets.length).toBe(1);
    expect(assets[0]).toEqual({
      name: 'cmake-3.20.0-linux-x86_64.tar.gz',
      platform: 'linux',
      arch: 'x86_64',
      filetype: 'archive',
      url: 'https://url.test/cmake-3.20.0-linux-x86_64.tar.gz',
    });
  });

  it('correctly parses the windows archive', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = version.getLatestMatching('3.x', version_info);
    const assets = selected.assets.filter(
      (a) => a.platform === 'win32' && a.filetype === 'archive'
    );
    expect(assets.length).toBe(1);
    expect(assets[0]).toEqual({
      name: 'cmake-3.20.0-windows-x86_64.tar.gz',
      platform: 'win32',
      arch: 'x86_64',
      filetype: 'archive',
      url: 'https://url.test/cmake-3.20.0-windows-x86_64.tar.gz',
    });
  });
});
