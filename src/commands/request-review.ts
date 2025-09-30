import { simpleGit } from "simple-git";

interface RequestReviewOptions {
  branch?: string;
  push?: boolean;
  force?: boolean;
}

export async function requestReview(
  range: string,
  options: RequestReviewOptions
) {
  try {
    const git = simpleGit();

    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    if (currentBranch === "HEAD") {
      console.error(
        "Currently in detached HEAD state. Please checkout a branch."
      );
      process.exit(1);
    }

    const status = await git.status();
    if (!status.isClean()) {
      console.error(
        "Working directory is not clean. Please commit or stash your changes."
      );
      process.exit(1);
    }

    // Regex to check that matches format "n" or "n-m" where m and n are numbers.
    if (!/^\d+(-\d+)?$/.test(range.trim())) {
      console.error(
        'Invalid range format. Use "n" or "n-m" where n and m are numbers.'
      );
      process.exit(1);
    }
    let startIndex: number;
    let endIndex: number;

    if (range.includes("-")) {
      const parts = range.split("-");
      const start = parseInt(parts[0]?.trim() || "");
      const end = parseInt(parts[1]?.trim() || "");
      if (parts.length > 2 || isNaN(start) || isNaN(end)) {
        console.error(
          'Invalid range format. Use "n" or "n-m" where n and m are numbers.'
        );
        process.exit(1);
      }
      startIndex = start - 1; // Convert to 0-based
      endIndex = end - 1;
    } else {
      const single = parseInt(range.trim());
      if (isNaN(single)) {
        console.error(
          'Invalid range format. Use "n" or "n-m" where n and m are numbers.'
        );
        process.exit(1);
      }
      startIndex = endIndex = single - 1; // Convert to 0-based
    }

    // Determine target branch name
    const targetBranch = options.branch || `glu/tmp/${range}`;

    // Check if origin exists and has the current branch
    const remotes = await git.getRemotes(true);
    const originRemote = remotes.find((r: any) => r.name === "origin");

    if (!originRemote) {
      console.error(
        "No origin remote found. Please add an origin remote first."
      );
      process.exit(1);
    }

    const originBranch = `origin/${currentBranch}`;

    // Check if origin branch exists
    try {
      await git.revparse(["--verify", originBranch]);
    } catch {
      console.error(
        `No origin branch found for ${currentBranch}. Push the branch first or there are no commits to compare.`
      );
      process.exit(1);
    }

    // Get commits that are on current branch but not on origin branch
    const logOptions = {
      from: originBranch,
      to: "HEAD",
      format: { hash: "%H" },
    };
    const log = await git.log(logOptions);

    if (log.all.length === 0) {
      console.log(`No commits found ahead of ${originBranch}`);
      return;
    }

    const allCommits = [...log.all].reverse(); // oldest to newest

    // Validate range
    if (
      startIndex < 0 ||
      endIndex >= allCommits.length ||
      startIndex > endIndex
    ) {
      console.error(
        `Invalid range ${range}. Available commits: 1-${allCommits.length}`
      );
      process.exit(1);
    }

    // Select commits in range
    const selectedCommits = allCommits.slice(startIndex, endIndex + 1);

    console.log(`Creating branch ${targetBranch} from ${originBranch}...`);

    // Check if branch already exists
    try {
      await git.revparse(["--verify", targetBranch]);
      if (options.force) {
        console.log(`Branch ${targetBranch} exists, deleting...`);
        await git.deleteLocalBranch(targetBranch, true);
      } else {
        console.error(
          `Branch ${targetBranch} already exists. Use --force to overwrite.`
        );
        process.exit(1);
      }
    } catch {
      // Branch doesn't exist, which is fine
    }

    // Create new branch from origin branch
    await git.checkoutBranch(targetBranch, originBranch);

    // Cherry-pick selected commits
    console.log(
      `Cherry-picking ${selectedCommits.length} commit(s) from range ${range}...`
    );
    for (const commit of selectedCommits) {
      try {
        await git.raw(["cherry-pick", commit.hash]);
        console.log(`✓ Cherry-picked ${commit.hash.substring(0, 7)}`);
      } catch (error) {
        console.error(
          `Failed to cherry-pick ${commit.hash.substring(0, 7)}: ${error}`
        );
        console.log("Resolve conflicts and run: git cherry-pick --continue");
        process.exit(1);
      }
    }

    // Push branch if requested
    if (options.push) {
      console.log(`Pushing ${targetBranch} to origin...`);
      if (options.force) {
        await git.push("origin", targetBranch, ["--force"]);
        console.log(`✅ Branch ${targetBranch} force pushed to origin`);
      } else {
        try {
          await git.push("origin", targetBranch);
          console.log(`✅ Branch ${targetBranch} pushed to origin`);
        } catch (error) {
          console.error(`Failed to push: ${error}`);
          console.log(
            "Use --force to force push if the branch exists on origin"
          );
          process.exit(1);
        }
      }
    } else {
      console.log(`✅ Branch ${targetBranch} created locally`);
      console.log("To push: git push origin " + targetBranch);
    }

    // Switch back to original branch
    await git.checkout(currentBranch);

    console.log(`Branch ready for PR: ${targetBranch}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
