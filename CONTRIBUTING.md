# Contributing to Ralph

Thank you for your interest in contributing to Ralph! This guide covers the process and standards for contributing to this project.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

## How to Contribute

### 1. Report Issues

Before opening a new issue:
- Search [existing issues](../../issues) to avoid duplicates
- Use the issue templates when available
- Include as much relevant information as possible

### 2. Suggest Features

- Open a feature request issue with `[Feature Request]` prefix
- Describe the problem you want to solve, not just the solution
- Explain why this would be valuable to the community

### 3. Submit Pull Requests

#### Before You Start

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment:
   ```bash
   pnpm install
   cd src-tauri
   cargo build
   cd ..
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Standards

- **Rust code**: Follow `cargo fmt` style, pass `cargo clippy -- -D warnings`
- **TypeScript code**: Follow ESLint rules, pass `pnpm lint`
- **Tests**: All new code must have tests. Run `pnpm test` and `cargo test --workspace`
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) format:
  - `feat:` new features
  - `fix:` bug fixes
  - `docs:` documentation changes
  - `refactor:` code refactoring
  - `test:` test additions or fixes
  - `chore:` maintenance tasks

#### Submitting

1. Ensure all tests pass
2. Update documentation if needed
3. Push to your fork
4. Open a Pull Request with:
   - Clear title and description
   - Link to related issues
   - Screenshots for UI changes (if applicable)
   - Test instructions

### 4. Review Process

- All PRs require at least one review
- CI must pass (tests, linting, build)
- Maintainers may request changes
- Once approved, maintainers will merge your PR

## Project Structure

```
ralph/
├── src/                    # React frontend (Tauri)
├── src-core/               # Core Rust library (evaluation engine)
├── src-tauri/              # Tauri backend (desktop app)
├── src-cli/                # CLI binary
├── e2e/                    # Playwright E2E tests
├── docs/                   # Documentation
├── archive/                # Historical reports
└── .github/                # GitHub workflows and issue templates
```

## Development Workflow

1. **Setup**: `pnpm install`
2. **Run dev server**: `pnpm tauri dev`
3. **Run tests**: `pnpm test` + `cargo test --workspace`
4. **Lint**: `pnpm lint` + `cargo clippy --workspace -- -D warnings`
5. **Format**: `pnpm format` + `cargo fmt --all`

## Questions?

- Open a [Discussion](../../discussions) for general questions
- Open an [Issue](../../issues) for bugs or feature requests

Thank you for contributing!
