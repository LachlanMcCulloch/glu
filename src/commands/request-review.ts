import { simpleGit } from 'simple-git';

interface RequestReviewOptions {
  commits?: string;
  branch?: string;
  push?: boolean;
}

export async function requestReview(options: RequestReviewOptions) {
  try {
    const git = simpleGit();
    
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    
    if (currentBranch === 'HEAD') {
      console.error('Currently in detached HEAD state. Please checkout a branch.');
      process.exit(1);
    }
    
    // Determine target branch name
    const targetBranch = options.branch || `${currentBranch}-review`;
    
    const status = await git.status();
    if (!status.isClean()) {
      console.error('Working directory is not clean. Please commit or stash your changes.');
      process.exit(1);
    }

    // If commits are specified, parse them
    let commitIndices: number[] = [];
    if (options.commits) {
      try {
        commitIndices = options.commits.split(',').map(c => parseInt(c.trim()) - 1);
      } catch {
        console.error('Invalid commit indices format. Use comma-separated numbers like: 1,2,3');
        process.exit(1);
      }
    }

    // Check if origin exists and has the current branch
    const remotes = await git.getRemotes(true);
    const originRemote = remotes.find((r: any) => r.name === 'origin');
    
    if (!originRemote) {
      console.error('No origin remote found. Please add an origin remote first.');
      process.exit(1);
    }

    const originBranch = `origin/${currentBranch}`;
    
    // Check if origin branch exists
    try {
      await git.revparse(['--verify', originBranch]);
    } catch {
      console.error(`No origin branch found for ${currentBranch}. Push the branch first or there are no commits to compare.`);
      process.exit(1);
    }

    // Get commits that are on current branch but not on origin branch
    const logOptions = {
      from: originBranch,
      to: 'HEAD',
      format: { hash: '%H' }
    };
    const log = await git.log(logOptions);
    
    if (log.all.length === 0) {
      console.log(`No commits found ahead of ${originBranch}`);
      return;
    }

    const allCommits = [...log.all].reverse(); // oldest to newest
    
    // Select commits to cherry-pick
    let selectedCommits = allCommits;
    if (commitIndices.length > 0) {
      selectedCommits = commitIndices.map(i => {
        if (i < 0 || i >= allCommits.length) {
          console.error(`Invalid commit index: ${i + 1}`);
          process.exit(1);
        }
        return allCommits[i]!;
      });
    }

    console.log(`Creating branch ${targetBranch} from ${originBranch}...`);
    
    // Create new branch from origin branch
    await git.checkoutBranch(targetBranch, originBranch);

    // If specific commits are selected, reset and cherry-pick only those
    if (commitIndices.length > 0) {
      // Reset to an empty state (orphan branch)
      await git.raw(['reset', '--hard', 'HEAD~' + allCommits.length]);
      
      console.log(`Cherry-picking ${selectedCommits.length} selected commit(s)...`);
      for (const commit of selectedCommits) {
        try {
          await git.raw(['cherry-pick', commit.hash]);
          console.log(`✓ Cherry-picked ${commit.hash.substring(0, 7)}`);
        } catch (error) {
          console.error(`Failed to cherry-pick ${commit.hash.substring(0, 7)}: ${error}`);
          console.log('Resolve conflicts and run: git cherry-pick --continue');
          process.exit(1);
        }
      }
    } else {
      console.log(`Branch ${targetBranch} created with all commits from ${currentBranch}`);
    }

    // Push branch if requested
    if (options.push) {
      console.log(`Pushing ${targetBranch} to origin...`);
      await git.push('origin', targetBranch);
      console.log(`✅ Branch ${targetBranch} pushed to origin`);
    } else {
      console.log(`✅ Branch ${targetBranch} created locally`);
      console.log('To push: git push origin ' + targetBranch);
    }

    // Switch back to original branch
    await git.checkout(currentBranch);
    
    console.log(`Branch ready for PR: ${targetBranch}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}