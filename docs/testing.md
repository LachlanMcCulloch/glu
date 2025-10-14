## Testing Strategy

We use three levels of testing:

### Unit Tests (`*.test.ts`)

- **Location**: Co-located with source files (e.g., `src/services/foo.test.ts`)
- **Purpose**: Test individual functions/methods in isolation
- **Speed**: Fast (< 1s per file)
- **Dependencies**: Mocked
- **Run**: `npm run test:unit`

### Integration Tests (`*.int.test.ts`)

- **Location**: Co-located with source files (e.g., `src/services/foo.int.test.ts`)
- **Purpose**: Test interactions with real dependencies (git, filesystem)
- **Speed**: Slower (can be several seconds)
- **Dependencies**: Real (uses GitFixture for real git repos)
- **Run**: `npm run test:int`

### E2E Tests (`tests/e2e/**/*.test.ts`)

- **Location**: Separate `tests/e2e/` directory
- **Purpose**: Test full CLI workflows as a user would
- **Speed**: Slowest
- **Dependencies**: Full CLI + real git repos
- **Run**: `npm run test:e2e`

### Running Tests

```bash
npm test              # Run all tests
npm run test:unit     # Fast feedback during development
npm run test:int      # Integration tests only
npm run test:watch    # Watch mode (unit tests only)
```
