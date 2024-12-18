# Release Process Documentation

## Overview

The Aurora Sound to Light project uses an automated release process powered by GitHub Actions. This document outlines the release workflow, requirements, and guidelines for creating new releases.

## Release Workflow

### 1. Automated Release Process

The release automation handles:
- Version management across all project files
- Test execution and validation
- Build processes
- Release creation
- Changelog generation
- HACS validation

### 2. Triggering a Release

To create a new release:

1. Go to the GitHub Actions tab in the repository
2. Select "Release Automation" workflow
3. Click "Run workflow"
4. Fill in the required parameters:
   - Version number (e.g., 1.0.1)
   - Release type (patch/minor/major)
   - Pre-release flag (if applicable)

### 3. Release Pipeline Stages

#### a. Validation
- Runs all test suites (frontend and backend)
- Executes code quality checks
- Validates HACS compatibility
- Ensures all requirements are met

#### b. Preparation
- Updates version numbers in:
  - manifest.json
  - package.json
  - pyproject.toml
- Generates changelog
- Creates release branch
- Opens pull request for review

#### c. Build
- Builds frontend assets
- Creates Python package
- Prepares distribution artifacts

#### d. Publication
- Creates GitHub release
- Attaches build artifacts
- Updates release notes
- Manages release branches

#### e. Cleanup
- Handles post-release tasks
- Cleans up temporary branches

## Version Numbers

We follow Semantic Versioning (SemVer):
- MAJOR version for incompatible API changes
- MINOR version for new functionality in a backward compatible manner
- PATCH version for backward compatible bug fixes

## Release Types

### Patch Releases (0.0.X)
- Bug fixes
- Performance improvements
- Minor documentation updates

### Minor Releases (0.X.0)
- New features
- Non-breaking changes
- Dependency updates

### Major Releases (X.0.0)
- Breaking changes
- Major feature additions
- Significant architectural changes

## Pre-release Process

For pre-releases:
1. Use the pre-release flag in the workflow
2. Version format: X.Y.Z-alpha.N or X.Y.Z-beta.N
3. Clearly mark as pre-release in GitHub

## Quality Gates

All releases must pass:
- 100% of automated tests
- Code coverage requirements (80% minimum)
- HACS validation
- Linting and formatting checks
- Security scans

## Release Artifacts

Each release includes:
- Source code (zip/tar.gz)
- Built frontend assets
- Python wheel package
- Changelog
- Release notes

## Post-Release

After release completion:
1. Verify the GitHub release page
2. Confirm HACS compatibility
3. Monitor for any immediate issues
4. Update documentation if needed

## Release Schedule

- Patch releases: As needed for bug fixes
- Minor releases: Every 2-4 weeks with new features
- Major releases: Scheduled based on roadmap

## Emergency Releases

For critical fixes:
1. Use patch version
2. Skip non-essential steps
3. Mark as "security" or "hotfix"
4. Document the emergency process

## Release Checklist

Before triggering release:
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Changelog reviewed
- [ ] Dependencies updated
- [ ] Breaking changes documented
- [ ] Migration guides ready (if needed)

## Troubleshooting

### Common Issues

1. Failed Tests
   - Review test logs
   - Fix failing tests
   - Re-run workflow

2. Version Conflicts
   - Check version numbers
   - Resolve conflicts
   - Update dependencies

3. Build Failures
   - Check build logs
   - Verify dependencies
   - Test locally first

### Support

For release issues:
1. Check Actions logs
2. Review error messages
3. Contact maintainers
4. Open support ticket

## Best Practices

1. Code Freeze
   - Implement feature freeze before release
   - Only allow bug fixes
   - Review all pending changes

2. Testing
   - Run full test suite
   - Perform manual testing
   - Verify in test environment

3. Documentation
   - Update all relevant docs
   - Review release notes
   - Verify example code

4. Communication
   - Announce release schedule
   - Document breaking changes
   - Update stakeholders

## Maintenance

Regular tasks:
- Archive old releases
- Clean up artifacts
- Update dependencies
- Review automation workflow

## Security Considerations

- Review security implications
- Update dependencies
- Run security scans
- Document security fixes

## Contributing

For release contributions:
1. Follow PR template
2. Include tests
3. Update documentation
4. Follow versioning rules 