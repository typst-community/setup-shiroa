#!/usr/bin/env node
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";
import fs from "fs";
import path from "path";
import * as semver from "semver";

const repoSet = {
  owner: "Myriad-Dreamin",
  repo: "shiroa",
};

async function listShiroaReleases(octokit: any) {
  core.debug(
    `Fetching releases list for repository '${repoSet.owner}/${repoSet.repo}'`,
  );

  if (octokit) {
    core.debug(`Fetching releases with authentication`);
    return await octokit.paginate(octokit.rest.repos.listReleases, repoSet);
  } else {
    const releasesUrl = `https://api.github.com/repos/${repoSet.owner}/${repoSet.repo}/releases`;

    core.debug(
      `Fetching releases list from '${releasesUrl}' without authentication`,
    );

    const releasesResponse = await tc.downloadTool(releasesUrl);

    try {
      core.debug(`Downloaded releases from ${releasesUrl}.`);
      const releases = JSON.parse(fs.readFileSync(releasesResponse, "utf8"));
      core.debug(`Fetched releases from ${releases}`);

      return releases;
    } catch (error) {
      core.setFailed(
        `Failed to parse releases from ${releasesUrl}: ${
          (error as Error).message
        }. This may be caused by API rate limit exceeded.`,
      );
      process.exit(1);
    }
  }
}

async function getExactShiroaVersion(
  releases: any[],
  version: string,
  allowPrereleases: boolean,
) {
  core.debug(
    `Resolving version '${version}' ${
      allowPrereleases ? "with" : "without"
    } pre-releases`,
  );

  const versions = releases
    .map((release) => release.tag_name.slice(1))
    .filter((v) => semver.valid(v));

  const resolvedVersion = semver.maxSatisfying(
    versions,
    version === "latest" ? "*" : version,
    { includePrerelease: allowPrereleases },
  );

  if (!resolvedVersion) {
    core.setFailed(`Shiroa v${version} could not be resolved.`);
    process.exit(1);
  }

  core.debug(
    `Resolved version '${resolvedVersion}' from '${version}' ${
      allowPrereleases ? "with" : "without"
    } pre-releases`,
  );

  return resolvedVersion;
}

async function downloadShiroa(version: string) {
  if (semver.lt(version, "0.2.0")) {
    core.setFailed(`Version must be >= 0.2.0, was ${version}`);
    process.exit(1);
  }

  core.debug(`Fetching Shiroa v${version}`);

  const baseUrl = `https://github.com/${repoSet.owner}/${repoSet.repo}`;

  const artifacts: Record<string, Record<string, string>> = {
    linux: {
      arm64: "aarch64-unknown-linux-musl",
      arm: "arm-unknown-linux-musleabihf",
      // TODO: Figure out how to reliably detect armv7.
      // armv7: "armv7-unknown-linux-musleabihf",
      loong64: "loongarch64-unknown-linux-musl",
      riscv64: "riscv64gc-unknown-linux-musl",
      x64: "x86_64-unknown-linux-musl",
    },
    darwin: {
      arm64: "aarch64-apple-darwin",
      x64: "x86_64-apple-darwin",
    },
    win32: {
      arm64: "aarch64-pc-windows-msvc",
      x64: "x86_64-pc-windows-msvc",
    },
  };

  const extensions: Record<string, string> = {
    darwin: "tar.gz",
    linux: "tar.gz",
    win32: "zip",
  };

  const currentPlatform = process.platform.toString();
  core.debug(`Detected platform '${currentPlatform}'`);

  const currentArch = process.arch.toString();
  core.debug(`Detected architecture '${currentArch}'`);

  const target = artifacts[currentPlatform]![currentArch]!;
  core.debug(`Determined archive target '${target}'`);

  const extension = extensions[currentPlatform]!;
  core.debug(`Determined archive extension '${extension}'`);

  const directory = `shiroa-${target}`;
  const file = `${directory}.${extension}`;

  core.debug(
    `Downloading release archive version '${version}' target '${target}'`,
  );

  found = await tc.downloadTool(
    `${baseUrl}/releases/download/v${version}/${file}`,
  );

  core.debug(`Downloaded archive to ${found}`);

  if (!found.endsWith(extension)) {
    core.debug(`Renaming archive to include extension '${extension}'`);

    fs.renameSync(
      found,
      path.join(path.dirname(found), `${path.basename(found)}.${extension}`),
    );

    found = path.join(
      path.dirname(found),
      `${path.basename(found)}.${extension}`,
    );
  }

  if (extension == "zip") {
    core.debug(`Extracting zip archive`);
    found = await tc.extractZip(found);
  } else {
    core.debug(`Extracting gzip tar ball`);
    found = await tc.extractTar(found, undefined, "xz");
  }

  core.debug(`Extracted v${version} extracted to ${found}`);

  if (currentPlatform != "win32") {
    found = path.join(found, directory);
  }

  return found;
}

const token = core.getInput("github-token");

const octokit = token
  ? github.getOctokit(token, { baseUrl: "https://api.github.com" })
  : null;

let version = core.getInput("shiroa-version");
const allowPrereleases = core.getBooleanInput("allow-prereleases");

if (version == "latest" || !/\d+\.\d+\.\d+/.test(version)) {
  const releases = await listShiroaReleases(octokit);
  version = await getExactShiroaVersion(releases, version, allowPrereleases);
  core.info(`Resolved Shiroa version: ${version}`);
}

let found = tc.find("shiroa", version);

if (found) {
  core.info(`Shiroa v${version} retrieved from cache at ${found}`);
  core.setOutput("cache-hit", found);
} else {
  found = await downloadShiroa(version);
  found = await tc.cacheDir(found, "shiroa", version);
  core.info(`Shiroa v${version} added to cache at ${found}`);
}

core.addPath(found);
core.setOutput("shiroa-version", version);
core.info(`✅ Shiroa v${version} installed!`);
