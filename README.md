# glu

Git stacked commit management CLI - inspired by git-stack.

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

Create a branch for PR from selected commits:

```bash
glu request-review
# or use the alias
glu rr
```

Options:
- `-c, --commits <commits>`: Comma-separated commit indices (from `glu ls`)
- `-b, --branch <branch>`: Target branch name (defaults to `<current>-review`)
- `--push`: Push branch to origin after creation

Examples:
```bash
# Create branch with all unpushed commits
glu rr --push

# Create branch with specific commits only
glu rr -c "1,3,5" -b "feature-partial" --push

# Create branch locally only
glu rr -c "2,3"
```

## Workflow

1. Work on your feature branch with multiple commits
2. Push your branch to origin at least once
3. Make more commits locally 
4. Use `glu ls` to see unpushed commits with indices
5. Use `glu rr` to create PR branches from selected commits
6. Create PRs manually on your platform of choice

## Development

- Build: `npm run build`
- Start: `npm start`
