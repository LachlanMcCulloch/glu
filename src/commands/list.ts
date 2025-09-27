import { simpleGit } from 'simple-git';

export async function listCommits() {
  try {
    const git = simpleGit();
    
    // Get the current branch
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    
    if (currentBranch === 'HEAD') {
      console.error('Currently in detached HEAD state. Please checkout a branch.');
      process.exit(1);
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
      format: {
        hash: '%H',
        abbreviated_hash: '%h',
        subject: '%s',
        author_name: '%an',
        author_date: '%ad',
      }
    };

    const log = await git.log(logOptions);
    
    if (log.all.length === 0) {
      console.log(`No commits found ahead of ${originBranch}`);
      return;
    }

    console.log(`Commits ahead of ${originBranch}:\n`);
    
    [...log.all].reverse().forEach((commit: any, index: number) => {
      const shortSha = commit.hash.substring(0, 7);
      const message = commit.subject.length > 60 
        ? commit.subject.substring(0, 57) + '...' 
        : commit.subject;
      
      console.log(`${index + 1}. ${shortSha} ${message}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}