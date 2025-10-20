# glu

[![CI](https://github.com/LachlanMcCulloch/glu/actions/workflows/ci.yml/badge.svg)](https://github.com/LachlanMcCulloch/glu/actions/workflows/ci.yml)

Git stacked commit management CLI - inspired by git patch stack.

## Installation

Clone the repository and install dependencies:

```bash
npm install
npm run build
```

To install globally:

```bash
npm install -g .
```

## Commands

```bash
glu ls                    # List commits ahead of origin
glu rr <range>           # Create branch for PR from commit range
glu config <command>     # Manage configuration settings
```

## Usage

### List Commits

List commits on current branch that are ahead of origin:

```bash
glu ls
```

Shows index, commit SHA (7 chars), and commit message preview. Requires origin remote and that the current branch exists on origin.

### Request Review

Create a branch for PR from commit range:

```bash
glu request-review <range>
# or use the alias
glu rr <range>
```

Range formats:

- `n`: Single commit (e.g., `1`)
- `n-m`: Range of commits (e.g., `1-3` for commits 1, 2, and 3)

Options:

- `-b, --branch <branch>`: Target branch name (defaults to commit message-based name with configured prefix)
- `--no-push`: Create branch locally without pushing to origin
- `--force`: Force overwrite if branch already exists

**Note:** Branch names are automatically generated from commit messages and can be customized with configuration. See [Configuration](docs/configuration.md) for details.

Examples:

```bash
# Create and push branch (default behavior)
glu rr 1

# Create branch with commit range
glu rr 1-3 --force

# Create branch locally only
glu rr 2 --no-push

# Override branch name
glu rr 1 -b "my-custom-feature"
```

## How Glu Works: Glu IDs and Branch Tracking

### Glu IDs

Glu automatically assigns unique IDs to your commits to track them across multiple review branches. These IDs are:

- **Stable**: Once assigned, a commit's glu ID never changes
- **Transparent**: Stored as git trailers in commit messages (no hidden metadata)
- **Automatic**: Injected when you create your first review branch

Example commit message after glu ID injection:

```
Add user authentication

Implement JWT-based authentication for API endpoints

Glu-ID: glu_abc123_def456
```

### Branch Tracking

Glu tracks which review branches contain which commits. This allows you to:

- See at a glance which commits have been sent for review
- Track the same commit across multiple PRs
- Avoid duplicate work

When you run `glu ls`, you'll see branch tracking information:

```bash
$ glu ls

feature-branch → origin/feature-branch [↑3 ↓0]

  3  f8e9a2b  Fix auth bug ● review/fix-auth
  2  d4c5b6a  Add dashboard ● review/dashboard, review/big-feature
  1  a1b2c3d  Update README
```

The `●` indicator shows which review branches contain each commit.

### Tracking Data Storage

Glu stores tracking data in `.git/glu/graph.json`. This file:

- ✅ **Is automatically excluded** from git (stored in `.git/`)
- ✅ **Is local to your repository** (not shared with others)
- ✅ **Can be safely deleted** (will be recreated if needed)

```bash
# View tracking data
cat .git/glu/graph.json

# Reset tracking data (if corrupted)
rm -rf .git/glu/
```

## Workflow

1. Work directly off main/master branch with commits
2. Push your branch to origin at least once to establish tracking
3. Make more commits locally (your "patch stack")
4. Use `glu ls` to see unpushed commits with indices
5. Use `glu rr <range>` to create PR branches from commit ranges
6. Create PRs manually on your platform of choice

**Example patch stack workflow:**

```bash
# Work on main with multiple commits
git checkout main
git commit -m "Add user authentication"
git commit -m "Add password validation"
git commit -m "Add login UI"

# Push to establish tracking
git push origin main

# Add more commits
git commit -m "Fix validation bug"
git commit -m "Add logout functionality"

# See your patch stack
glu ls
# main → origin/main [↑2 ↓0]
#   2  abc1234  Fix validation bug
#   1  def5678  Add logout functionality

# Create PR for single patch
glu rr 1

# Create PR for multiple patches
glu rr 1-2 --force
```

## Configuration

Glu supports flexible configuration for branch naming, formatting, and behavior. You can customize:

- **Branch prefixes** (e.g., `username/feat/branch-name`)
- **Naming separators** (hyphens vs underscores)
- **Branch length limits**
- **Conventional commit prefix handling**
- **Remote settings**

### Quick Setup

```bash
# Set your branch prefix
glu config set branchPrefix "username/feat/"

# View current configuration
glu config list

# See all options
glu config --help
```

For detailed configuration options, see [Configuration Documentation](docs/configuration.md).

## Development

- Build: `npm run build`
- Start: `npm start`
- Test: `npm test`

## License

Copyright (C) 2025 Lachlan McCulloch

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
