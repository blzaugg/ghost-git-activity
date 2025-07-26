# shadow-git-activity

A Node.js tool to shadow Git commit activity from a source repository into a target repository.

Useful for showing Git contribution activity without:

- Copying code
- Leaking proprietary information
- Breaking NDAs

It's fake activity with real integrity.

## What It Does

- Scans commits from a local source repo and branch.
- Filters commits by a list of authors.
- Creates matching shadow commits in a local target repo:
  - Preserves original **timestamp**
  - Matches **line additions/deletions** into a single file (`shadow-activity.log`)
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
git clone https://github.com/blzaugg/shadow-git-activity.git
cd shadow-git-activity
```

Then copy and configure your config.json:

```bash
cp config-sample.json config.json
# edit config.json to match your repo paths and author settings
```

## Usage

```bash
# Simulate and preview the shadow commits (no changes made)
node shadow.js --dry-run

# Create shadow commits in the target repo
node shadow.js

# Resume after a failed run (skips previously mirrored commits)
node shadow.js --resume

# Combine resume + dry-run
node shadow.js --dry-run --resume
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
shadow.js           # Main script
config.json         # Required configuration file
config-sample.json  # Sample configuration file
dryrun.txt          # Output in dry-run mode
```

## Author

Byran Zaugg  
[github.com/blzaugg](https://github.com/blzaugg)

## License

MIT
