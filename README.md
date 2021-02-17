# Setup cmake for GitHub Actions

Github action to setup the cmake build script generator.

This action will update the path for your workflow to include cmake
matching the platform and version requirements.

### Usage

Adding a step that uses this action to your workflow will setup cmake
and make it available to subsequent steps:

```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
    - name: Setup cmake
      uses: jwlawson/actions-setup-cmake@v1.8
      with:
        cmake-version: '3.16.x'
    - name: Use cmake
      run: cmake --version
```

### Options

There are two options for the action:

* `cmake-version` controls the version of CMake that is added to the path. This
  can be a fully specified verison `3.3.0`, partly specified `3.2`, a wildcard
  version `3.2.x`. By default it is empty which will give the latest CMake
  version available on GitHub.

  The [version tests] show some expected values for given versions.

* `github-api-token` is optional, but is used to authenticate with GitHub's
  API. By default it will use the token generated by the workflow. If set to
  blank then no authentication is used to access the API and there is a chance
  that the test runner will have hit the API rate limit causing the action to
  fail to download the available versions from GitHub.

  See also:
   - [GitHub API rate limiting]
   - [GITHUB_TOKEN]


### How it works

The action will download the list of releases of CMake available on GitHub and
choose the best match for the test runner's platform and the version
requirements given as as option. The CMake package is then either downloaded
from GitHub, or a cached version from the action's tool cache is used, and the
executables are provided on the path for subsequent workflow steps.


[version tests]: ./__tests__/version.test.ts
[GitHub API rate limiting]: https://developer.github.com/v3/#rate-limiting
[GITHUB_TOKEN]: https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret


