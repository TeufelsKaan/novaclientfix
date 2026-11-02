# Nova Client release workflow

The user wants launcher changes delivered through automatic updates. When a requested launcher change is ready and publication is authorized in the current session, bump the version, run the appropriate checks, build the installer and publish the matching version tag to the configured GitHub repository. Preserve the existing update URL so already installed clients remain connected.

Use the release workflow in `.github/workflows/release.yml`. Never claim a release is live until the GitHub workflow has succeeded and its public installer and `latest.yml` are reachable. If authentication or repository access is missing, finish the local implementation, checks and build, then report exactly what is needed to publish. Do not overwrite existing release tags or replace published installers in place.
