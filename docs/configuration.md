# Configuration

Glu supports flexible configuration to customize branch naming, formatting, and behavior. Configuration files are automatically discovered and loaded when you run glu commands.

## Configuration Files

Glu searches for configuration files in the following order:

1. **Project-level** (highest priority):
   - `package.json` (in `glu` field)
   - `.glurc`
   - `.glurc.json`
   - `glu.config.js`

2. **User-level**:
   - `~/.glurc`
   - `~/.config/glu/config.json`

The first configuration file found takes precedence.

## Managing Configuration

### View Current Configuration

```bash
# Show all configuration values
glu config list

# Get a specific value
glu config get branchPrefix
glu config get formatting.separator
```

### Set Configuration Values

```bash
# Set a simple value
glu config set branchPrefix "username/feat/"

# Set nested values using dot notation
glu config set formatting.separator "_"
glu config set formatting.maxBranchLength 60
glu config set remote.name "upstream"
```

### Reset Configuration

```bash
# Reset all settings to defaults
glu config reset
```

## Configuration Options

### Branch Naming

#### `branchPrefix`

**Type:** `string`  
**Default:** `""`  
**Description:** Prefix added to all generated branch names.

```bash
# Examples
glu config set branchPrefix "username/feat/"  # → username/feat/add-new-feature
glu config set branchPrefix "team/feature-"   # → team/feature-add-new-feature
glu config set branchPrefix ""                # → add-new-feature (no prefix)
```

#### `defaultBranchFormat`

**Type:** `string`  
**Default:** `"{prefix}{message}"`  
**Description:** Template for branch name generation. Currently supports `{prefix}` and `{message}` placeholders.

### Formatting Options

#### `formatting.separator`

**Type:** `string`  
**Default:** `"-"`  
**Description:** Character used to separate words in branch names.

```bash
glu config set formatting.separator "-"   # → add-new-feature
glu config set formatting.separator "_"   # → add_new_feature
```

#### `formatting.maxBranchLength`

**Type:** `number`  
**Default:** `50`  
**Description:** Maximum length for generated branch names (excluding prefix).

```bash
glu config set formatting.maxBranchLength 30   # Truncate at 30 characters
glu config set formatting.maxBranchLength 100  # Allow longer branch names
```

### Conventional Commits

#### `conventionalCommits.stripPrefixes`

**Type:** `string[]`  
**Default:** `["feat:", "feat(", "fix:", "fix(", "docs:", "docs(", "style:", "style(", "refactor:", "refactor(", "test:", "test(", "chore:", "chore("]`  
**Description:** List of prefixes to remove from commit messages when generating branch names.

```bash
# Add custom prefixes to strip
glu config set conventionalCommits.stripPrefixes '["feat:", "fix:", "custom:"]'
```

### Remote Settings

#### `remote.name`

**Type:** `string`  
**Default:** `"origin"`  
**Description:** Default remote name to use for git operations.

```bash
glu config set remote.name "upstream"  # Use 'upstream' instead of 'origin'
```

#### `remote.autoCreatePR`

**Type:** `boolean`  
**Default:** `true`  
**Description:** Whether to automatically show PR creation URLs after pushing.

```bash
glu config set remote.autoCreatePR false  # Disable PR URL display
```

## Configuration Examples

### Personal Development Setup

```bash
# Set your username as prefix for all branches
glu config set branchPrefix "johndoe/feat/"

# Use underscores instead of hyphens
glu config set formatting.separator "_"

# Allow longer branch names
glu config set formatting.maxBranchLength 60
```

This configuration will generate branch names like:

- `johndoe/feat/add_user_authentication`
- `johndoe/feat/implement_dark_mode_toggle`

### Team Development Setup

```bash
# Use team prefix
glu config set branchPrefix "frontend-team/"

# Keep default separators and length
glu config set formatting.separator "-"
glu config set formatting.maxBranchLength 50
```

This configuration will generate branch names like:

- `frontend-team/add-user-authentication`
- `frontend-team/implement-dark-mode-toggle`

### Minimal Setup

```bash
# No prefix, use defaults
glu config set branchPrefix ""
```

This configuration will generate branch names like:

- `add-user-authentication`
- `implement-dark-mode-toggle`

## Configuration File Format

Configuration files use JSON format:

```json
{
  "branchPrefix": "username/feat/",
  "defaultBranchFormat": "{prefix}{message}",
  "conventionalCommits": {
    "stripPrefixes": [
      "feat:",
      "feat(",
      "fix:",
      "fix(",
      "docs:",
      "docs(",
      "style:",
      "style(",
      "refactor:",
      "refactor(",
      "test:",
      "test(",
      "chore:",
      "chore("
    ]
  },
  "remote": {
    "name": "origin",
    "autoCreatePR": true
  },
  "formatting": {
    "maxBranchLength": 50,
    "separator": "-"
  }
}
```

## Project vs User Configuration

- **Project configuration** (`.glurc` in project root) is shared with your team and should contain project-specific settings
- **User configuration** (`~/.glurc` in home directory) contains your personal preferences and takes lower precedence

### Example Project Configuration (`.glurc`)

```json
{
  "conventionalCommits": {
    "stripPrefixes": ["feat:", "fix:", "docs:", "JIRA-"]
  },
  "formatting": {
    "maxBranchLength": 40,
    "separator": "-"
  },
  "remote": {
    "name": "origin"
  }
}
```

### Example User Configuration (`~/.glurc`)

```json
{
  "branchPrefix": "johndoe/feat/"
}
```

In this setup, the user gets personalized branch prefixes while respecting team conventions for commit prefix stripping and formatting rules.

## Troubleshooting

### Configuration Not Loading

1. **Check file location**: Ensure your config file is in one of the searched locations
2. **Validate JSON**: Use `glu config list` to see if configuration loaded correctly
3. **Check file permissions**: Ensure the config file is readable

### Invalid Configuration Values

If you set an invalid configuration value, glu will fall back to defaults. Use `glu config list` to verify your settings were applied correctly.

### Reset Corrupted Configuration

```bash
# Reset everything to defaults
glu config reset

# Or manually delete the config file
rm ~/.glurc
```
