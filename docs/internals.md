# Glu Internals

This document explains how glu works under the hood.

## Architecture

Glu follows a clean architecture with clear separation of concerns:

```
src/
├── commands/          # CLI command handlers
├── use-cases/         # Business logic
├── services/          # Domain services
├── infrastructure/    # External integrations (git, file system)
├── core/             # Types and errors
└── utils/            # Helpers
```

## Glu ID System

### Generation

Glu IDs are generated using:

- **Timestamp**: Base36-encoded milliseconds (sortable, compact)
- **Random**: 6 bytes of cryptographic randomness (collision-resistant)

Format: `glu_{timestamp}_{random}`

Example: `glu_k8j5x6h48_a1b2c3d4e5f6`

### Injection Process

When you run `glu request-review`:

1. **Check** which commits need glu IDs
2. **Create temp branch** from base commit
3. **Cherry-pick** each commit in order
4. **Amend** commits without glu IDs
5. **Update** original branch reference
6. **Delete** temp branch

This ensures glu IDs are added to your original branch, not just review branches.

### Storage Format

Glu IDs are stored as git trailers:

```
commit message title

commit message body

Glu-ID: glu_abc123_def456
```

This format:

- ✅ Works with all git tools
- ✅ Visible in `git log`
- ✅ Preserved during cherry-pick/rebase
- ✅ No special git configuration needed

## Graph Tracking System

### Data Structure

Graph data is stored in `.git/glu/graph.json`:

```json
{
  "version": "1.0.0",
  "commits": {
    "glu_abc123_def456": {
      "firstSeen": "2025-01-15T10:30:00.000Z",
      "locations": [
        {
          "branch": "review/feature-a",
          "commitHash": "abc123...",
          "status": "pushed",
          "remote": "origin",
          "pushedAt": "2025-01-15T10:35:00.000Z"
        },
        {
          "branch": "review/big-feature",
          "commitHash": "def456...",
          "status": "unpushed"
        }
      ]
    }
  }
}
```

### Tracking Operations

**Record commit location:**

```typescript
await gluGraphService.recordCommitLocation(gluId, branchName, commitHash)
```

**Mark branch as pushed:**

```typescript
await gluGraphService.markBranchPushed(branchName, remoteName)
```

**Query branches for commit:**

```typescript
const branches = await gluGraphService.getBranchesForGluId(gluId)
```

### Graph Cleanup

The graph tracks deleted branches automatically. To manually prune:

```bash
# Clean up tracking for deleted branches
rm .git/glu/graph.json
# Will be recreated on next glu command
```

## Request Review Flow

Complete flow for `glu request-review 1-2`:

1. **Validate**
   - Working directory clean
   - Range valid
   - Current branch exists

2. **Inject Glu IDs**
   - Check which commits need IDs
   - Inject IDs into original branch
   - Re-fetch commits (hashes changed)

3. **Create Review Branch**
   - Create temp branch
   - Cherry-pick commits to temp branch
   - Create named review branch from temp
   - Delete temp branch

4. **Track in Graph**
   - Record each commit's location
   - Store branch and commit hash

5. **Push (if enabled)**
   - Push review branch to remote
   - Mark branch as pushed in graph

6. **Cleanup**
   - Delete temp branches
   - Return result with PR URL

## List Command Flow

Complete flow for `glu ls`:

1. **Get unpushed commits**
   - Compare current branch with upstream
   - Assign glu index (1, 2, 3...)

2. **Enrich with tracking**
   - Extract glu ID from each commit
   - Query graph for branches
   - Filter out current branch

3. **Format output**
   - Show branch name and status
   - Display commits with indexes
   - Add branch tracking indicators

## Error Handling

All errors inherit from `ApplicationError`:

```typescript
interface ApplicationError {
  exitCode: number
  userMessage: string
  context?: Record<string, unknown>
}
```

User-facing errors include:

- Clear description of what went wrong
- Context-specific details
- Suggested fixes

Example:

```
❌ Working directory is not clean

Modified files:
  • src/index.ts
  • package.json

Please commit or stash your changes before proceeding:
  git add .
  git commit -m "your message"
or
  git stash
```

## Testing Strategy

### Unit Tests (`.test.ts`)

- Mock all dependencies
- Test business logic
- Fast execution

### Integration Tests (`.int.test.ts`)

- Real git operations
- Use GitFixture for repos
- Test service integration

### E2E Tests (`tests/e2e/`)

- Full CLI commands
- Real file system
- User perspective

## Performance Considerations

### Graph Queries

For `glu ls` with many commits:

- Load entire graph once
- Query in-memory
- Avoid repeated I/O

### Glu ID Injection

Only runs if commits need IDs:

- Check first, inject later
- Skip if all commits have IDs
- Batch operations

## Future Enhancements

Potential improvements:

- Remote graph sync (share tracking across team)
- Branch pruning automation
- Glu ID migration tools
- Support for git worktrees
- Batch operations for multiple ranges
