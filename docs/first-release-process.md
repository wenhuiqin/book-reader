# First Commit, Tag, and Release Process

This document is a practical checklist for the first public release of this repository.

## 1. Prepare the working tree

Make sure the repository contains only the changes you want in the first public version.

```bash
git status
```

If needed, review the final staged diff before committing:

```bash
git diff --staged
```

## 2. Create the first proper public commit

Recommended commit message:

```bash
git add README.md LICENSE docs package.json pnpm-lock.yaml src electron public .gitignore
git commit -m "feat: prepare first public release"
```

If you want a more neutral message:

```bash
git commit -m "chore: prepare v1.0.0 release"
```

## 3. Create the first version tag

Use an annotated tag so the tag itself carries release context:

```bash
git tag -a v1.0.0 -m "First public release"
```

Check it:

```bash
git show v1.0.0 --stat
```

## 4. Push commit and tag

```bash
git push origin main
git push origin v1.0.0
```

Or push both together:

```bash
git push origin main --tags
```

## 5. Create the GitHub Release

### Option A: Create on GitHub web

1. Open the repository Releases page.
2. Click `Draft a new release`.
3. Choose tag `v1.0.0`.
4. Release title:

```text
v1.0.0 - First public release
```

5. Paste the body from `docs/release-v1.0.0.md`.
6. Attach the generated `.dmg` file from `dist/`.
7. Publish the release.

### Option B: Create with GitHub CLI

If `gh` is already authenticated:

```bash
gh release create v1.0.0 dist/*.dmg --title "v1.0.0 - First public release" --notes-file docs/release-v1.0.0.md
```

## 6. Recommended release order

Use this sequence to avoid metadata drift:

1. Finalize docs and packaging metadata.
2. Build the release artifact locally.
3. Smoke test the packaged app.
4. Commit release-ready changes.
5. Tag `v1.0.0`.
6. Push commit and tag.
7. Publish the GitHub Release with the built asset.

## 7. Suggested pre-release checks

- `package.json` version matches the intended release version
- `README.md` reflects actual supported formats and limitations
- `LICENSE` is present
- macOS package builds successfully with `npm run dist:mac`
- release asset name and app name are acceptable for public distribution
- repository links in `package.json` are correct

## 8. Suggested versioning rule going forward

- `v1.0.0`: first public release
- `v1.0.1`: bug-fix only
- `v1.1.0`: backward-compatible features
- `v2.0.0`: breaking behavior or packaging changes
