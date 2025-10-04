# Configuration Examples

This document provides real-world examples of how to configure glu for different development workflows.

## Personal Development

### Basic Personal Setup

```bash
# Set your username as prefix
glu config set branchPrefix "johndoe/"

# Result: commit "feat: add user login" → branch "johndoe/add-user-login"
```

### Feature Branch Convention

```bash
# Use feature prefix
glu config set branchPrefix "johndoe/feat/"

# Result: commit "add user login" → branch "johndoe/feat/add-user-login"
```

### Underscore Preference

```bash
# Use underscores instead of hyphens
glu config set branchPrefix "johndoe/"
glu config set formatting.separator "_"

# Result: commit "add user login" → branch "johndoe/add_user_login"
```

## Team Development

### Team Prefix Setup

```bash
# Set team prefix for better organization
glu config set branchPrefix "frontend-team/"

# Result: commit "implement dark mode" → branch "frontend-team/implement-dark-mode"
```

### Department-Based Naming

```bash
# Use department and feature type
glu config set branchPrefix "ui-ux/feature/"

# Result: commit "redesign header component" → branch "ui-ux/feature/redesign-header-component"
```

## Project-Specific Configuration

### Create Project Config (`.glurc` in project root)

```json
{
  "conventionalCommits": {
    "stripPrefixes": ["feat:", "fix:", "docs:", "JIRA-", "PROJ-"]
  },
  "formatting": {
    "maxBranchLength": 40,
    "separator": "-"
  }
}
```

This ensures all team members follow the same conventions while allowing personal prefixes in their user config.

## Enterprise Setups

### Ticket-Based Development

```bash
# Remove ticket prefixes from branch names
glu config set conventionalCommits.stripPrefixes '["JIRA-", "PROJ-", "TICKET-", "feat:", "fix:"]'
glu config set branchPrefix "dev/feature/"

# Result: commit "JIRA-123: implement user dashboard" → branch "dev/feature/implement-user-dashboard"
```

### Multi-Team Organization

```bash
# For Platform Team
glu config set branchPrefix "platform/infra/"

# For Frontend Team
glu config set branchPrefix "frontend/ui/"

# For Backend Team
glu config set branchPrefix "backend/api/"
```

## Workflow-Specific Examples

### GitFlow Style

```bash
# For feature branches
glu config set branchPrefix "feature/"

# Result: commit "add payment processing" → branch "feature/add-payment-processing"
```

### GitHub Flow Style

```bash
# Simple descriptive branches
glu config set branchPrefix ""

# Result: commit "feat: add payment processing" → branch "add-payment-processing"
```

### Release Candidate Workflow

```bash
# For release candidates
glu config set branchPrefix "rc/"
glu config set formatting.maxBranchLength 30

# Result: commit "prepare v2.1.0 release" → branch "rc/prepare-v210-release"
```

## Advanced Formatting

### Short Branch Names

```bash
# Aggressive length limiting for systems with branch name constraints
glu config set formatting.maxBranchLength 20
glu config set branchPrefix "dev/"

# Result: commit "implement comprehensive user authentication system" → branch "dev/implement-comprehe"
```

### Custom Separators

```bash
# Use different separators for different contexts
glu config set formatting.separator "."

# Result: commit "add user login feature" → branch "add.user.login.feature"
```

## Migration Examples

### Migrating from Manual Branch Naming

Before glu:

```bash
git checkout -b "johndoe/feat/user-auth-implementation-with-jwt"
```

With glu:

```bash
# Configure once
glu config set branchPrefix "johndoe/feat/"

# Then just commit and create branches
git commit -m "implement user authentication with JWT"
glu rr 1  # Creates: johndoe/feat/implement-user-authentication-with-jwt
```

### Migrating Team Conventions

If your team currently uses:

- `team-frontend/feature/branch-name`
- Manual branch creation
- Ticket numbers in branch names

Configure glu to match:

```bash
glu config set branchPrefix "team-frontend/feature/"
glu config set conventionalCommits.stripPrefixes '["TICKET-", "JIRA-", "feat:", "fix:"]'
```

## Testing Your Configuration

After setting up configuration, test it:

```bash
# View your current config
glu config list

# Create a test commit
git commit --allow-empty -m "test: verify branch naming works correctly"

# Test branch creation (locally only)
glu rr 1 --no-push

# Check the generated branch name
git branch | grep test
```

## Troubleshooting Common Issues

### Branch Names Too Long

```bash
# Reduce max length
glu config set formatting.maxBranchLength 30

# Or use shorter prefix
glu config set branchPrefix "dev/"
```

### Special Characters in Branch Names

```bash
# Check what conventional commit prefixes are being stripped
glu config get conventionalCommits.stripPrefixes

# Add custom prefixes that contain special characters
glu config set conventionalCommits.stripPrefixes '["feat(ui):", "fix(api):", "docs(readme):"]'
```

### Reset to Start Over

```bash
# Reset everything to defaults
glu config reset

# Then reconfigure step by step
glu config set branchPrefix "username/"
```
