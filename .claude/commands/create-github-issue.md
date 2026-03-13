Create a GitHub Issue using `gh` CLI.

---
**LABEL LIST LAST UPDATED**: 2026-03-13
**Repository**: shotleybuilder/svelte-gridlite-views

**CURRENT LABELS**:
- `bug` - Something isn't working
- `documentation` - Improvements or additions to documentation
- `duplicate` - This issue or pull request already exists
- `enhancement` - New feature or request
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `invalid` - This doesn't seem right
- `question` - Further information is requested
- `wontfix` - This will not be worked on

---

## Instructions

### 1. Check Label Freshness

**IMPORTANT**: Before creating the issue, check if the label list above is stale:

If labels are stale (>30 days old):
1. Fetch fresh labels:
   ```bash
   gh label list --repo shotleybuilder/svelte-gridlite-views --limit 100 --json name,description,color
   ```
2. Update this command file with new timestamp and updated label list

### 2. Gather Issue Information

Ask user for (or extract from context):
- **Title**: Clear, concise issue title
- **Body**: Issue description with context
- **Labels**: Select from CURRENT LABELS list above
- **Assignee**: (optional) GitHub username

### 3. Create the Issue

```bash
gh issue create \
  --repo shotleybuilder/svelte-gridlite-views \
  --title "Issue title here" \
  --body "Issue description here" \
  --label "bug,enhancement" \
  --assignee @me
```

### 4. Verify Labels

**CRITICAL**: Before submitting, verify all labels exist in the CURRENT LABELS list above to avoid errors.

### 5. Link to Session (if applicable)

If working in a session, the session will reference this new Issue #.
