import * as core from '@actions/core';
import * as setup from './setup-cmake';
import * as version from './version';

async function run() {
  try {
    const required_version = core.getInput('cmake-version');
    const api_token = core.getInput('github-api-token');
    const all_version_info = await version.getAllVersionInfo(api_token);
    const chosen_version_info = version.getLatestMatching(
      required_version,
      all_version_info
    );
    await setup.addCMakeToPath(chosen_version_info);
  } catch (error) {
    core.setFailed(error.message);
  }
}
run();
