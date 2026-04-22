import { getInput, info, debug, setFailed, warning } from '@actions/core';
import { addCMakeToPath } from './setup-cmake.js';
import { getAllVersionInfo, getLatestMatching } from './version.js';

function getArchCandidates(): string[] {
  // Detect the system architecture and prioritize it
  const systemArch = process.arch;

  if (systemArch === 'arm64') {
    // On ARM64 systems, try arm64 first, then fallback to x86_64 via emulation
    return ['arm64', 'aarch64', 'x86_64', 'x86'];
  } else if (systemArch === 'x64') {
    // On x86_64 systems, try x86_64 first, then x86 for older packages
    return ['x86_64', 'x86', 'arm64'];
  } else if (systemArch === 'ia32') {
    // On 32-bit x86 systems, only try x86
    return ['x86', 'x86_64'];
  } else {
    // For other architectures, try in order of likelihood
    warning(`Unknown architecture ${systemArch}, defaulting to standard order`);
    return ['x86_64', 'arm64', 'x86'];
  }
}

async function run() {
  try {
    const requested_version = getInput('cmake-version');
    const required_version =
      requested_version === 'latest' ? '' : requested_version;
    const api_token = getInput('github-api-token');
    const all_version_info = await getAllVersionInfo(api_token);
    const chosen_version_info = getLatestMatching(
      required_version,
      all_version_info,
    );
    info(`Using cmake version ${chosen_version_info.name}`);

    const arch_candidates = getArchCandidates();
    debug(`Architecture candidates: ${arch_candidates.join(', ')}`);

    await addCMakeToPath(chosen_version_info, arch_candidates);
  } catch (error) {
    setFailed((error as Error).message);
  }
}
run();
