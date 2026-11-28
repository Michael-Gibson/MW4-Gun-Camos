# MW4 Camo Tracker: working notes for Claude

A plain HTML/CSS/JS tracker for Call of Duty: Modern Warfare 4. Game data is in `mw4-data.js`, app logic in `script.js`, styles in `styles.css`. The README explains the features and data layout.

## MW4 research agents: use them every session

The owner wants these project agents (in `.claude/agents/`) used every time we work on this app:

- **mw4-update-scout:** run it at the start of a session, in the background, but **at most once a day**: skip it if it already ran that day (the last check date is kept in the `update-scout-once-a-day` memory note). Run it again after a known game update, even on the same day. It checks for new MW4 changes (patches, seasons, weapons, camos, DMZ) against `mw4-data.js`. Share what it finds and offer to add it.
- **mw4-researcher:** use it for any MW4 fact that goes into `mw4-data.js` (challenges, costs, weapons). It cross-checks several sources. Don't add game data from memory.
- **mw4-feature-scout:** run it when planning what to build next, or at the end of a piece of work, to suggest features that would help players track MW4 progress.

Show their findings to the owner. Flag anything single-sourced or unconfirmed in the data (`verify` notes, "$ ?") instead of guessing.

## Routine for every change (approved by the owner)

1. Create a new branch before starting.
2. Make the change and test it thoroughly. Do a syntax check (`node --check`), then run the browser tests: `cd tests && npm install && npm test` (headless Microsoft Edge via `playwright-core`, `channel: 'msedge'`). Add or update checks in the matching `tests/test-*.js` file for every change, and look at the screenshots in `tests/output/`.
3. Update `README.md`: the feature text, plus a Changelog entry under "Unreleased (branch `name`)".
4. Report, then **wait for the owner's go-ahead**.
5. On go-ahead, run the usual cycle: move the Unreleased entries under today's date, commit, `git push -u origin <branch>`, `git checkout main`, `git pull`, `git merge <branch>`, `git push`, delete the branch locally and on GitHub, and confirm `main` matches `origin/main`.

## Picking up where we left off

The owner wants the context restored every time they reopen this folder. At the start of each session:
1. Read the `mw4-tracker-current-state` memory note (the session handoff).
2. Check `git status` and `git branch`.
3. Briefly tell the owner where things stand: what's in progress, what's waiting on them, and any pending findings.

Keep that note updated as work moves on: a new branch started, a change waiting for approval, something merged, new scout or research findings, open questions. Finished work is recorded in the README changelog and git history, so the note only needs the current state.

## Notes

- Node is in `C:\Program Files\nodejs` but not on the Git Bash PATH: use `export PATH="$PATH:/c/Program Files/nodejs"`.
- Progress is saved by weapon name and camo id. Don't rename ids, and add a migration in `script.js` when a saved format changes.
