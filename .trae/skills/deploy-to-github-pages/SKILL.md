---
name: deploy-to-github-pages
description: Deploy static sites and web applications to GitHub Pages using GitHub Actions. Use when the user wants to deploy a website, configure GitHub Pages, set up CI/CD for static hosting, or publish a web app online.
---
# Deploy to GitHub Pages

Deploy static sites and web applications to GitHub Pages using GitHub Actions.

## When to Use

- User wants to deploy a website to GitHub Pages
- Setting up CI/CD for static site hosting
- Publishing a React, Next.js, Vite, or other web app
- Configuring custom domains on GitHub Pages
- Troubleshooting GitHub Pages deployment issues

## Standard Workflow

### 1. Configure Build Output

Ensure your project builds to a static output directory:

| Framework | Build Command | Output Directory |
|-----------|--------------|-----------------|
| Vite/React | 
pm run build | dist/ |
| Next.js (static) | 
pm run build | out/ |
| Create React App | 
pm run build | uild/ |
| Astro | 
pm run build | dist/ |
| Docusaurus | 
pm run build | uild/ |

### 2. Create GitHub Actions Workflow

Create .github/workflows/deploy.yml:

`yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
`

### 3. Enable GitHub Pages

1. Go to repository Settings > Pages
2. Set Source to "GitHub Actions"
3. Push to main branch to trigger deployment

### 4. Configure Base Path (if needed)

For projects deployed to username.github.io/repo-name/:

- **Vite**: Set ase: '/repo-name/' in ite.config.ts
- **Next.js**: Set asePath: '/repo-name' in 
ext.config.js
- **React Router**: Use <BrowserRouter basename="/repo-name">

## Alternative: gh-pages Branch Method

For simpler projects, deploy directly to a gh-pages branch:

`yaml
- name: Deploy
  uses: JamesIves/github-pages-deploy-action@v4
  with:
    branch: gh-pages
    folder: dist
`

## Custom Domain Setup

1. Add CNAME file to your build output with your domain
2. Configure DNS: Add CNAME record pointing to username.github.io
3. Enable HTTPS in repository Settings > Pages

## Troubleshooting

- **404 on refresh**: Configure SPA fallback or use HashRouter
- **Assets not loading**: Check ase path configuration
- **Build fails**: Ensure 
pm run build works locally first
- **Permission denied**: Add permissions: contents: write to workflow
