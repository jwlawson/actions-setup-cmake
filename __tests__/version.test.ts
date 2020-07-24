const path = require('path');
const nock = require('nock');
const dataPath = path.join(__dirname, 'data');

import * as version from '../src/version';

describe('When a version is needed', () => {
  beforeEach(() => {
    nock.disableNetConnect();
    // Releases file contains version info for:
    // 3.16.2, 3.16.1, 3.16.0, 3.16.0-rc4
    // 3.15.6, 3.15.5, 3.15.1, 3.15.0
    // 3.14.7, 3.14.1, 3.14.0
    // 3.13.5
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 1 })
      .replyWithFile(200, path.join(dataPath, 'releases.json'), {
        'Content-Type': 'application/json',
        Link:
          '<...releases?page=2>; rel="next", <...releases?page=2>; rel="last"',
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
          '<...releases?page=1>; rel="prev", <...releases?page=2>; rel="last"',
      });
  });
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
  it('latest version is correctly parsed', async () => {
    const version_info = await version.getAllVersionInfo();
    const latest = await version.getLatestMatching('', version_info);
    expect(latest.name).toMatch(/3.16.2/);
  });
  it('exact version is selected', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = await version.getLatestMatching('3.15.5', version_info);
    expect(selected.name).toMatch(/3.15.5/);
  });
  it('latest version is selected for provided minor release', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = await version.getLatestMatching('3.15', version_info);
    expect(selected.name).toMatch(/3.15.6/);
  });
  it('latest version is selected for provided minor release with x', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = await version.getLatestMatching('3.15.x', version_info);
    expect(selected.name).toMatch(/3.15.6/);
  });
  it('latest version is selected for provided major release with x', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = await version.getLatestMatching('3.x', version_info);
    expect(selected.name).toMatch(/3.16.2/);
  });
  it('non-existant full version throws', async () => {
    const version_info = await version.getAllVersionInfo();
    await expect(
      version.getLatestMatching('100.0.0', version_info)
    ).rejects.toThrow('Unable to find version matching 100.0.0');
  });
  it('non-existant part version throws', async () => {
    const version_info = await version.getAllVersionInfo();
    await expect(
      version.getLatestMatching('100.0.x', version_info)
    ).rejects.toThrow('Unable to find version matching 100.0');
  });
  it('versions on second page get chosen', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = await version.getLatestMatching('2.x', version_info);
    expect(selected.name).toMatch(/2.8.12/);
  });
  it('extra numbers in version get ignored', async () => {
    const version_info = await version.getAllVersionInfo();
    const selected = await version.getLatestMatching('2.8.10', version_info);
    expect(selected.name).toMatch(/2.8.10/);
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
      .query({ page: 1 })
      .replyWithFile(200, path.join(dataPath, 'releases.json'), {
        'Content-Type': 'application/json',
      });
    nock('https://api.github.com')
      .get('/repos/Kitware/CMake/releases')
      .query({ page: 1 })
      .replyWithError('Invalid API token');
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
