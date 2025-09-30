import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import { simpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('glu ls', () => {
  let tempDir: string;
  let gluPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glu-test-'));
    gluPath = path.resolve(process.cwd(), 'dist/index.js');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('shows error when no origin remote', async () => {
    // Create a basic git repo
    const git = simpleGit(tempDir);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    
    // Create and commit a file
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test\n');
    await git.add('.');
    await git.commit('Initial commit');

    // Run glu ls (should fail - no origin)
    const result = await execa('node', [gluPath, 'ls'], {
      cwd: tempDir,
      reject: false
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No origin remote found');
  });

  test('shows commits ahead of origin with tracking info', async () => {
    // Create git repo with commits ahead of origin
    const git = simpleGit(tempDir);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    await git.addConfig('init.defaultBranch', 'main');
    
    // Create initial commits
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test\n');
    await git.add('.');
    const commit1 = await git.commit('Initial commit');
    
    await fs.writeFile(path.join(tempDir, 'feature.txt'), 'feature\n');
    await git.add('.');
    await git.commit('Add feature');
    
    await fs.writeFile(path.join(tempDir, 'fix.txt'), 'fix\n');
    await git.add('.');
    await git.commit('Fix feature');
    
    // Add origin remote
    await git.addRemote('origin', 'https://github.com/test/test.git');
    
    // Get current branch name (might be master or main)
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    
    // Create origin/<branch> ref pointing to first commit
    const refPath = path.join(tempDir, '.git', 'refs', 'remotes', 'origin');
    await fs.ensureDir(refPath);
    await fs.writeFile(path.join(refPath, currentBranch), commit1.commit + '\n');

    // Run glu ls
    const result = await execa('node', [gluPath, 'ls'], {
      cwd: tempDir,
      reject: false
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`${currentBranch} → origin/${currentBranch}`);
    expect(result.stdout).toContain('[↑2 ↓2]'); // 2 behind because we have newer commits on current branch
    expect(result.stdout).toContain('Add feature');
    expect(result.stdout).toContain('Fix feature');
  });
});