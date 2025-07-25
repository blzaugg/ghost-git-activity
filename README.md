# ghost-git-activity

A Node.js tool to replay commit metadata from one private Git repository into another dummy private repository.

Useful for showing Git contribution activity without:

- Copying code
- Leaking proprietary information
- Breaking NDAs

It's fake activity with real integrity.

## What It Does

- Scans commits from a local Git repo and branch.
- Filters by a list of authors.
- Creates matching dummy commits in a second repo:
  - Preserves original **timestamp**
  - Matches **line additions/deletions** in a single file (`dummy.txt`)
  - All commits attributed to a single **public author**
  - Commit message format:
    ```
    <original-short-sha> <ISO timestamp> +<adds> -<deletes> <original author>
    ```
- Skips:
  - Merge commits
  - Zero-diff commits
  - Commits by all other authors

## Installation

Clone the repository:

```bash
git clone https://github.com/blzaugg/ghost-git-activity.git
cd ghost-git-activity
```

Then copy and configure your config.json:

```bash
cp config-sample.json config.json
# edit config.json to match your repo paths and author settings
```

## Usage

```bash
# Simulate and preview the dummy commits (no changes made)
node ghost.js --dry-run

# Create dummy commits in the target repo
node ghost.js

# Resume after a failed run (skips previously mirrored commits)
node ghost.js --resume

# Combine resume + dry-run
node ghost.js --dry-run --resume
```

## Output Example (`dryrun.txt`)

```
a1b2c3d 2025-07-16T14:22:33+00:00 +15 -3 Alice Lastname
f6e7g8h 2025-07-16T15:05:42+00:00 +3 -1 Alice Lastname
```

---

## Requirements

- Node.js v18+
- Git CLI installed and on `$PATH`

No external npm packages. Uses raw `git` via Node’s `child_process`.

---

## File Structure

```
ghost.js            # Main script
config.json         # Required configuration file
config-sample.json  # Sample configuration file
dryrun.txt          # Output in dry-run mode
```

## Author

Byran Zaugg  
[github.com/blzaugg](https://github.com/blzaugg)

## License

MIT
