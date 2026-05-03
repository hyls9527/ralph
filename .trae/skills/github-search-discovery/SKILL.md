---
name: github-search-discovery
description: Search and discover GitHub repositories, issues, and code. Use when finding open-source libraries, searching for code examples, discovering relevant repositories, or exploring GitHub ecosystems.
---
# GitHub Search & Discovery

Search and discover repositories, code, issues, and users on GitHub.

## When to Use

- Finding open-source libraries for a specific task
- Searching for code examples and patterns
- Discovering trending or popular repositories
- Exploring GitHub ecosystems and communities
- Finding alternatives to existing tools

## Search Commands

### Repository Search

`ash
# Search by keyword
gh search repos "react chart library" --limit 10

# Search by language and stars
gh search repos "state management" --language=typescript --stars=">1000"

# Search by topic
gh search repos --topic=authentication --language=python

# Sort by stars
gh search repos "web framework" --sort=stars --order=desc
`

### Code Search

`ash
# Search code in public repos
gh search code "useAuth" --language=typescript

# Search in specific repo
gh search code "export function" --repo=vercel/next.js

# Search by filename
gh search code "filename:package.json react"
`

### Issue Search

`ash
# Find good first issues
gh search issues "good first issue" --repo=facebook/react

# Find bugs
gh search issues "bug" --label=bug --state=open

# Find feature requests
gh search issues "feature request" --state=open --sort=reactions
`

## Discovery Patterns

### Find Best Library for Task

1. Search repos with high stars and recent activity
2. Check last commit date (should be recent)
3. Review open issues and PR response time
4. Check license compatibility
5. Evaluate documentation quality

### Evaluate Repository Quality

`ash
# View repo info
gh repo view owner/repo

# Check contributors
gh api repos/owner/repo/contributors --jq '.[].login' | head -10

# Check recent releases
gh release list --repo owner/repo --limit 5

# Check open issues count
gh api repos/owner/repo --jq '{stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count}'
`

### Trending Discovery

`ash
# Trending this week
gh search repos --sort=stars --order=desc --created=">2025-01-01" --limit 20

# Most starred by language
gh search repos --language=rust --sort=stars --limit 10
`

## Integration Tips

- Use gh api for advanced queries not covered by search commands
- Combine with jq for custom filtering
- Use --json flag for structured output
- Cache results for repeated queries
