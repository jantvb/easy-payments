# Release branch strategy (`release/1.0.0`)

## Intended public branch

Easy Payments **v1.0.0** is prepared on:

`release/1.0.0`

Development continues on:

`master`

---

## Critical GitHub limitation

**Branch protection does not hide branches.**

If the GitHub repository is **public**, every branch is readable — including `master`.

You **cannot** make `master` private while exposing `release/1.0.0` in the **same** public repository.

Protection only limits who can **push / force-push / delete** a branch.

---

## Two valid architectures

### A. Same public repository

- Repo is public
- `release/1.0.0` is the **default** branch (public-facing)
- `master` remains readable to everyone
- Protect both branches against direct pushes / force pushes / deletion
- Suitable when you accept that `master` is visible

### B. Private development repo + separate public release repo

- Keep `master` (and ongoing work) in a **private** repository
- Publish only the release snapshot to a **public** repository (contents of `release/1.0.0`)
- Required if `master` must stay private

Do **not** create a second repository automatically from this project task.

---

## Recommended GitHub branch protection (`release/1.0.0`)

Settings → Rules → Rulesets (or Branches → Branch protection rules):

| Setting | Recommended |
|---------|-------------|
| Target | `release/1.0.0` |
| Restrict deletions | On |
| Block force pushes | On |
| Require a pull request before merging | On (optional but recommended) |
| Require approvals | Optional |
| Restrict who can push | Only maintainers / empty (no direct push) |
| Require status checks | Optional once CI exists |
| Allow force pushes | Off |
| Allow deletions | Off |

Goal for public users:

- clone / read / fork (if forks enabled)
- **cannot** push directly to `release/1.0.0`
- changes arrive via PR from `master` (or future release flow)

### Protect `master` (same public repo)

Apply the same write protections to `master`. Remember: this does **not** hide it.

---

## Make `release/1.0.0` the default branch (manual)

After pushing `release/1.0.0`:

1. GitHub → **Settings** → **General** → **Default branch**
2. Switch from `master` to `release/1.0.0`
3. Confirm

Do not change the remote default from the CLI unless you explicitly want that.

---

## Suggested release flow

```
master  (development)
   │
   ├─ review
   ▼
release/1.0.0  (public snapshot)
   │
   ├─ later: git tag v1.0.0
   └─ later: GitHub Release + npm publish
```
