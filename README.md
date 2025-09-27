# glu

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

- `-b, --branch <branch>`: Target branch name (defaults to `glu/tmp/<range>`)
- `--push`: Push branch to origin after creation
- `--force`: Force push if branch already exists

Examples:

```bash
# Create branch with single commit
glu rr 1 --push

# Create branch with commit range
glu rr 1-3 --push --force

# Create branch locally only
glu rr 2-2 -b "my-feature"
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
glu rr 1 --push

# Create PR for multiple patches
glu rr 1-2 --push --force
```

## Development

- Build: `npm run build`
- Start: `npm start`
