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
#   1  abc1234  Fix validation bug
#   2  def5678  Add logout functionality

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
