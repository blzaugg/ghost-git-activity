#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PATH_CONFIG = path.resolve(process.cwd(), "config.json");
const FILENAME_SHADOW_LOG = "shadow-activity.log";

// ================================
// ==== READ FLAGS ================
// ================================

// --dry-run: Simulate and preview the shadow commits (no changes made)
const dryRun = process.argv.includes("--dry-run");
// --debug: Print debug information
const debug = process.argv.includes("--debug");

// ================================
// ==== LOAD CONFIG ===============
// ================================

if (!fs.existsSync(PATH_CONFIG)) {
  console.error("Missing config.json file");
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(PATH_CONFIG, "utf-8"));

if (debug) {
  console.log("DEBUG: Config:");
  console.log("- config.repoPathSource:", config.repoPathSource);
  console.log("- config.repoPathTarget:", config.repoPathTarget);
  console.log("- config.branchName:", config.branchName);
  console.log("- config.commitAuthorEmailsSource:", config.commitAuthorEmailsSource.join(", "));
  console.log("- config.commitAuthorNameTarget:", config.commitAuthorNameTarget);
  console.log("- config.commitAuthorEmailTarget:", config.commitAuthorEmailTarget);
  console.log("");
}

// ================================
// ==== VALIDATE CONFIG ===========
// ================================

// Check if given path is a directory
const isDirectory = (path) => fs.existsSync(path) && fs.lstatSync(path).isDirectory();

// Source Repo Path
if (!isDirectory(config.repoPathSource)) {
  console.error(`Config 'repoPathSource' is missing or not a directory: "${config.repoPathSource}"`)
  process.exit(1);
}

// Target Repo Path
if (!isDirectory(config.repoPathTarget)) {
  console.error(`Config 'repoPathTarget' is missing or not a directory: "${config.repoPathTarget}"`);
  process.exit(1);
}

// Branch Name
if (
  typeof config.branchName !== "string"
  || config.branchName.trim() === ""
) {
  console.error(`Config 'branchName' is invalid or missing: "${config.branchName}"`);
  process.exit(1);
}

// Source Commit Author Emails
if (
  !Array.isArray(config.commitAuthorEmailsSource)
  || config.commitAuthorEmailsSource.length === 0
) {
  console.error("Config 'commitAuthorEmailsSource' must be a non-empty array.");
  process.exit(1);
}
if (
  !config.commitAuthorEmailsSource.every(email =>
    typeof email === "string"
    && email.trim() !== ""
  )
) {
  console.error("Config 'commitAuthorEmailsSource' values must be strings.");
  process.exit(1);
}

// Target Commit Author Name
if (
  typeof config.commitAuthorNameTarget !== "string"
  || config.commitAuthorNameTarget.trim() === ""
) {
  console.error(`Config 'commitAuthorNameTarget' is invalid or missing: "${config.commitAuthorNameTarget}"`);
  process.exit(1);
}

// Target Commit Author Email
const emailRegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (
  typeof config.commitAuthorEmailTarget !== "string"
  || !emailRegExp.test(config.commitAuthorEmailTarget)
) {
  console.error(`Config 'commitAuthorEmailTarget' is invalid or missing: "${config.commitAuthorEmailTarget}"`);
  process.exit(1);
}

// ================================
// ==== METHODS ===================
// ================================

/**
 * Runs Git commands in the specified working directory with given environment
 * variables.
 *
 * @param {string} cwd The current working directory where the Git command should be executed.
 * @param {string} cmd The Git command to run (without 'git' prefix).
 * @param {Object} [env={}] Additional environment variables to set for the command.
 *
 * @returns {string} The trimmed output of the Git command.
 *
 * @throws {Error} Throws an error if the Git command fails.
 */
function runGit(cwd, cmd, env = {}) {
  // if (debug) {
  //   console.log("DEBUG: runGit with:");
  //   console.log("- cwd:", cwd);
  //   console.log("- cmd:", cmd);
  //   console.log("- env:", env);
  //   console.log("");
  // }

  try {
    const gitOutput = execSync(`git ${cmd}`, {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        ...env,
      },
      stdio: [
          "pipe",
          "pipe",
          "inherit"
      ],
    }).trim();

    // if (debug) {
    //   console.log("DEBUG: Git command output:");
    //   console.log(gitOutput);
    //   console.log("");
    // }

    return gitOutput;
  } catch (e) {
    console.error(`Git command failed: git ${cmd} on path ${cwd}`);
    throw e;
  }
}

/**
 * Get commit data from the linear commit history of the source repository.  
 * Ignores merges via --no-merges.
 *
 * Returns an array of objects with:
 * - short SHA
 * - author email
 * - author date
 */
function getCommitsDataFromRepoSource() {
  // Use unit separator to avoid conflicts with commit messages
  const unitSeparatorGit = "%x1f";
  const unitSeparatorString = "\x1f";

  // short sha (%h), author email (%ae), ISO date (%aI)
  const prettyFormat = ["%h", "%ae", "%aI"].join(unitSeparatorGit);

  const commitLog = runGit(config.repoPathSource, `log ${config.branchName} --reverse --pretty=format:"${prettyFormat}"`);
  const logLines = commitLog.trim().split("\n");

  // if (debug) {
  //   console.log("DEBUG: Commit Log lines:");

  //   const unitSeparatorRegEx = new RegExp(unitSeparatorString, "g");
  //   logLines.forEach((logLine) => {
  //     console.log(`- ${logLine.replaceAll(unitSeparatorRegEx, " ")}`);
  //   });

  //   console.log("");
  // }

  return logLines.map((logLine) => {
      const [commitShaSource, commitAuthorEmailSource, commitAuthorDateSource] = logLine.split(unitSeparatorString);
      return {
        commitShaSource,
        commitAuthorEmailSource,
        commitAuthorDateSource,
      };
    });
}

/**
 * Gets all shadowed commit SHAs from the target repository.
 */
function getShadowedShas() {
  // commit message (%s)
  const prettyFormat = "%s";
  const commitLog = runGit(config.repoPathTarget, `log --pretty=format:"${prettyFormat}" --reverse`);

  const commitMessages = commitLog.split("\n");
  return commitMessages
    .map((commitMessage) => {
      const commitMessageParts = commitMessage.split(" ");
      // Commit message starts with SHA
      return commitMessageParts.length > 0 ? commitMessageParts[0] : null;
    });
}

/**
 * Overwrite the shadow log file the new SHA.
 * @param {string} content The content to write to the shadow log file. 
 */
function updateShadowLogFile(content) {
  const shadowLogFilePath = path.join(config.repoPathTarget, FILENAME_SHADOW_LOG);
  fs.writeFileSync(shadowLogFilePath, content);
}

/**
 * Creates a shadow commit in the target repository with the given commit message and date.
 *
 * @param {string} commitMessage The commit message to use for the shadow commit.
 * @param {string} commitAuthorDateSource The ISO date string to use for the commit author date.
 */
function createShadowCommit(commitMessage, commitAuthorDateSource) {
  updateShadowLogFile(commitMessage);

  // Stage Shadow Log File
  runGit(config.repoPathTarget, `add ${FILENAME_SHADOW_LOG}`);

  // Commit with env vars to fake author date/time and author/committer info
  const env = {
    GIT_AUTHOR_NAME: config.commitAuthorNameTarget,
    GIT_AUTHOR_EMAIL: config.commitAuthorEmailTarget,
    GIT_AUTHOR_DATE: commitAuthorDateSource,
    GIT_COMMITTER_NAME: config.commitAuthorNameTarget,
    GIT_COMMITTER_EMAIL: config.commitAuthorEmailTarget,
    GIT_COMMITTER_DATE: commitAuthorDateSource,
  };

  runGit(config.repoPathTarget, `commit -m "${commitMessage}"`, env);
}

// ================================
// ==== MAIN ======================
// ================================

async function main() {
  console.log("Starting shadow-git-activity...");
  console.log("");

  // ================================
  // ==== LOAD SOURCE COMMITS =======
  // ================================

  const commitsDataFromRepoSource = getCommitsDataFromRepoSource();

  if (debug) {
    console.log("DEBUG: Commits data from repo source:", commitsDataFromRepoSource.length);
  }

  if (commitsDataFromRepoSource.length === 0) {
    console.warn("No Commits data found in repo source.");
    process.exit(1);
  }

  // Filter commits by config.commitAuthorEmailsSource whitelist
  const filteredCommitsDataFromRepoSource = commitsDataFromRepoSource.filter(({ commitAuthorEmailSource }) =>
    config.commitAuthorEmailsSource.includes(commitAuthorEmailSource)
  );

  if (debug) {
    console.log("DEBUG: Filtered commits data from repo source:", filteredCommitsDataFromRepoSource.length);
  }

  if (filteredCommitsDataFromRepoSource.length === 0) {
    console.warn(`No commit authors matched config.commitAuthorEmailsSource: ${config.commitAuthorEmailsSource.join(", ")}`);
    process.exit(1);
  }

  // ================================
  // ==== LOAD TARGET ===============
  // ================================

  // Load already shadowed SHAs
  const shadowedShas = new Set(getShadowedShas());

  if (debug) {
    console.log("DEBUG: Shadowed SHAs from target repo:", shadowedShas.size);
  }

  // ================================
  // ==== PROCESS SOURCE COMMITS ====
  // ================================

  console.log(""); // Pre-loop padding

  let newCommitsCount = 0;
  for (const { commitShaSource, commitAuthorEmailSource, commitAuthorDateSource } of filteredCommitsDataFromRepoSource) {
    if (shadowedShas.has(commitShaSource)) {
      console.warn(`Skipping already shadowed commit: ${commitShaSource}`);
      continue;
    }

    // Example: "89532a8 2024-09-30T19:40:22-07:00 alice.public@example.net"
    const commitMessage = `${commitShaSource} ${commitAuthorDateSource} ${commitAuthorEmailSource}`;

    if (dryRun) {
      console.warn(`[dry-run] Created shadow commit: ${commitMessage}`);
    } else {
      createShadowCommit(commitMessage, commitAuthorDateSource);
      console.log(`Created shadow commit: ${commitMessage}`);
    }

    // Count new commits
    newCommitsCount++;
  }

  console.log(""); // Post-loop padding

  console.log(filteredCommitsDataFromRepoSource.length, "source commits processed.");

  if (dryRun) {
    console.warn(`${dryRun && '[dry-run]'} ${newCommitsCount} new shadow commits created.`);
  } else {
    console.log(newCommitsCount, "new shadow commits created.");
  }

  console.log("");
}

main().catch((e) => {
  console.error("Error during processing:", e);
  process.exit(1);
});
