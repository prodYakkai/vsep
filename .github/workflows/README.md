# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the VSEP project.

## Workflows

### 1. `ci.yml` - Continuous Integration
**Triggers:** Pull requests and pushes to main/develop branches

**Purpose:** Quick testing and validation
- Tests on Node.js 18.x, 20.x, and 22.x
- Type checking with TypeScript
- Linting with ESLint
- Build verification
- Launcher functionality testing

### 2. `build-and-package.yml` - Build and Package
**Triggers:** 
- Pushes to main/develop branches
- Tags starting with 'v' (releases)
- Manual workflow dispatch

**Purpose:** Creates distributable packages
- Full build with all dependencies
- Creates optimized tar.gz packages
- Two package types:
  - **Full package**: `vsep-<commit>.tar.gz` - Complete with node_modules
  - **Production package**: `vsep-production-<commit>.tar.gz` - Lightweight, requires `npm install`
- Automatic GitHub releases for tags
- Build artifacts stored for 30-90 days

## Package Structure

The workflows create packages following the same structure as `package.sh` but with optimizations:

### Full Package Includes:
- `dist/` - Compiled TypeScript
- `keys/` - SSL certificates
- `config/` - Configuration files
- `node_modules/` - All dependencies (optimized)
- `src/static/node_modules/` - Frontend dependencies
- `package.json` & `package-lock.json`
- `launcher.js` & `dev-chromium.js`
- Shell scripts (`*.sh`, `*.ps1`)
- Documentation (`README.md`, `CLAUDE.md`)

### Production Package Includes:
- `dist/` - Compiled TypeScript
- `keys/` - SSL certificates  
- `config/` - Configuration files
- `package.json` - For dependency installation
- `launcher.js` - Universal launcher
- `README.md` - Documentation

## Usage

### For Development
```bash
# Workflows trigger automatically on:
git push origin main                    # Triggers CI + Build
git push origin feature-branch         # Triggers CI only (via PR)
```

### For Releases
```bash
# Create and push a tag to trigger release
git tag v1.0.0
git push origin v1.0.0                 # Triggers Build + Release
```

### Manual Trigger
Go to Actions tab in GitHub → Build and Package → Run workflow

## Artifacts

### CI Workflow
- No artifacts (validation only)

### Build and Package Workflow
- **Build Artifacts** (30 days retention)
  - `vsep-package-node-18.x`
  - `vsep-package-node-20.x`
- **Production Artifacts** (90 days retention)
  - `vsep-production-package` (Node 20 only)

### Release Workflow
- Attached to GitHub release
- Public download links
- Permanent storage

## Deployment

### Option 1: Full Package (Recommended for quick deployment)
```bash
# Download and extract
wget https://github.com/your-org/vsep/releases/download/v1.0.0/vsep-<commit>.tar.gz
tar -xzf vsep-<commit>.tar.gz
cd vsep/

# Run directly (all dependencies included)
node launcher.js
```

### Option 2: Production Package (Recommended for production)
```bash
# Download and extract
wget https://github.com/your-org/vsep/releases/download/v1.0.0/vsep-production-<commit>.tar.gz
tar -xzf vsep-production-<commit>.tar.gz
cd vsep/

# Install production dependencies
npm install --production

# Run launcher
node launcher.js --env production
```

## Optimization Features

The workflows include several optimizations:

1. **Dependency Caching**: npm cache and node_modules caching
2. **Package Optimization**: Excludes test files, docs, and cache from node_modules
3. **Matrix Testing**: Tests on multiple Node.js versions
4. **Artifact Management**: Different retention periods for different use cases
5. **Conditional Steps**: Production artifacts only created for Node 20.x
6. **Build Verification**: Ensures all required files are present

## Requirements

### Repository Setup
- Node.js project with package.json
- Required files: `launcher.js`, `keys/`, `config/` directories
- Scripts defined in package.json (especially `build:prod`, `type-check`, `lint`)

### GitHub Settings
- Actions enabled
- `GITHUB_TOKEN` automatically available (no setup needed)
- For releases: Tags must start with 'v' (e.g., v1.0.0, v2.1.0-beta)

## Troubleshooting

### Common Issues

1. **Missing dependencies in static/**
   - Ensure `src/static/package.json` exists
   - Workflow runs `npm run install:all` which includes static dependencies

2. **Build failures**
   - Check TypeScript errors with `npm run type-check`
   - Fix linting issues with `npm run lint:fix`

3. **Package too large**
   - Check if unnecessary files are included
   - Consider using production package instead

4. **Release not created**
   - Ensure tag starts with 'v'
   - Check if build workflow completed successfully
   - Verify `GITHUB_TOKEN` permissions