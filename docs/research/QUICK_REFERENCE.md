# Quick Reference: AI PR Review Bot Patterns

## The 3 Systems Analyzed

| System | Stars | Language | License | Key Strength |
|--------|-------|----------|---------|--------------|
| **PR-Agent** | 12.3K | Python | Apache 2.0 | Token-aware chunking |
| **Claude Code Action** | 8.5K | TypeScript | MIT | Simple, stateless |
| **CodeRabbit** | 288K installs | Proprietary | Proprietary | Learning system |

---

## 1. LARGE PR HANDLING

### The Problem
- 100+ file PRs exceed token limits
- Need to prioritize which files to review
- Can't just truncate randomly

### PR-Agent Solution
```
1. Parse diff into files
2. Sort by: language → token count (descending)
3. Add files until soft threshold (1500 tokens)
4. If still over, compress and create multiple patches
5. Run 3-4 AI calls, one per patch
6. Summarize findings
```

### Key Constants
- **Soft threshold**: 1500 tokens (warning)
- **Hard threshold**: 1000 tokens (stop adding context)
- **Max AI calls**: 4 (configurable)

### For Your Bot
```typescript
const SOFT_THRESHOLD = 1500;
const HARD_THRESHOLD = 1000;
const MAX_CHUNKS = 4;

// Sort files by language, then by token count
files.sort((a, b) => {
  if (a.language !== b.language) {
    return languagePriority[a.language] - languagePriority[b.language];
  }
  return b.tokens - a.tokens;
});
```

---

## 2. RE-REVIEW HANDLING

### The Problem
- PR gets 5 pushes with small fixes
- Don't want to re-review unchanged files
- Need to track what was already reviewed

### PR-Agent Solution
```
1. Store review timestamp in database
2. On new push, get commits since last review
3. Extract files changed in those commits
4. Review only those files
5. Skip if no new commits or no file changes
```

### Key Data
```typescript
interface ReviewRecord {
  prNumber: number;
  repo: string;
  reviewedAt: Date;           // When last reviewed
  lastCommitSha: string;      // Last commit reviewed
  filesReviewed: string[];    // Files in that review
}
```

### For Your Bot
```typescript
// 1. Get previous review
const previous = await db.reviews.findOne({ prNumber, repo })
  .sort({ reviewedAt: -1 });

if (!previous) {
  // Full review needed
  return null;
}

// 2. Get new commits
const allCommits = await github.getPRCommits(prNumber);
const newCommits = allCommits.filter(
  c => new Date(c.timestamp) > previous.reviewedAt
);

// 3. Get files changed in new commits
const changedFiles = new Set<string>();
for (const commit of newCommits) {
  const files = await github.getCommitFiles(commit.sha);
  files.forEach(f => changedFiles.add(f));
}

// 4. Review only changed files
return Array.from(changedFiles);
```

### Cost Savings
- **First review**: 100% of files
- **Re-review with 1 new commit**: ~20% of files
- **Overall savings**: ~70% reduction in API calls

---

## 3. CONTEXT STRATEGY

### The Problem
- Need repo context (architecture, conventions)
- Can't load entire repo (too many tokens)
- Don't want to use embeddings (too complex)

### PR-Agent Solution
```
1. Admin specifies context files (README, CONTRIBUTING, etc.)
2. Load those files from repo
3. Truncate to 500 lines each
4. Cache for 15 minutes
5. Inject into prompt
```

### Key Config
```toml
[config]
repo_context_files = [
    "README.md",
    "CONTRIBUTING.md",
    "docs/architecture.md"
]
repo_context_max_lines = 500
repo_context_from_default_branch = true
```

### For Your Bot
```typescript
// 1. Load context files
const context: { [path: string]: string } = {};
for (const filePath of contextFiles) {
  const content = await github.getFileContent(repo, filePath);
  context[filePath] = content.split('\n').slice(0, 500).join('\n');
}

// 2. Cache for 15 minutes
cache.set(`context:${repo}`, context, 15 * 60 * 1000);

// 3. Inject into prompt
const contextStr = Object.entries(context)
  .map(([path, content]) => `## ${path}\n\`\`\`\n${content}\n\`\`\``)
  .join('\n\n');

const userPrompt = `
## Repository Context
${contextStr}

## Changes
\`\`\`diff
${diff}
\`\`\`
`;
```

### When to Add Embeddings
- Only if >30% of reviews need "search repo for similar patterns"
- Start with file-based context first
- Add vector DB later if needed

---

## 4. REVIEW SUBMISSION

### The Problem
- Need to post findings to GitHub
- Inline comments are better than summary-only
- Don't want to spam with test comments

### PR-Agent Solution
```
1. Create inline comments for each finding
2. Use GitHub Review API (not individual comments)
3. Batch all comments in one review
4. Fallback to individual comments if batch fails
```

### Claude Code Action Solution
```
1. Buffer comments by default
2. Classify after session ends
3. Post only real findings (filter test probes)
4. Prevents accidental spam
```

### For Your Bot
```typescript
// 1. Create inline comments
const comments = findings.map(f => ({
  path: f.file,
  line: f.line,
  body: f.message,
  confirmed: true  // Mark as real finding
}));

// 2. Submit as review
const review = await octokit.rest.pulls.createReview({
  owner, repo, pull_number: prNumber,
  commit_id: latestCommitSha,
  comments: comments,
  body: summaryComment,
  event: "COMMENT"  // or "APPROVE" / "REQUEST_CHANGES"
});

// 3. Store in database
await db.reviews.insertOne({
  prNumber,
  repo,
  githubReviewId: review.id,
  githubCommentId: review.id,
  findings: findings,
  reviewedAt: new Date()
});
```

---

## 5. PROMPT STRUCTURE

### The Problem
- Need to inject PR context into prompt
- Don't want to hardcode everything
- Need to support customization

### PR-Agent Solution
```
1. Use Jinja2 templates
2. Define variables dict
3. Render template with variables
4. Count tokens of rendered prompt
5. Adjust diff size based on remaining tokens
```

### Claude Code Action Solution
```
1. Simple string concatenation
2. No template engine
3. Extract user request separately
4. Pass to Claude SDK
```

### For Your Bot (Keep It Simple)
```typescript
function buildPrompt(
  pr: PullRequest,
  diff: string,
  context: RepoContext
): { system: string; user: string } {
  const contextStr = Object.entries(context)
    .map(([path, content]) => `## ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  return {
    system: `You are an expert code reviewer. Focus on:
- Code quality and best practices
- Security vulnerabilities
- Performance issues
- Test coverage

Be concise and actionable.`,

    user: `
## PR: ${pr.title}
**Branch**: ${pr.branch}
**Description**: ${pr.description}

## Repository Context
${contextStr}

## Changes
\`\`\`diff
${diff}
\`\`\`

Please review these changes.`
  };
}
```

---

## 6. TOKEN COUNTING

### The Problem
- Different models count tokens differently
- Need accurate counts to avoid truncation
- Can't just estimate

### PR-Agent Solution
```
1. OpenAI models: Use tiktoken encoder
2. Claude models: Use Anthropic API
3. Unknown models: Apply estimation factor
```

### For Your Bot
```typescript
async function countTokens(text: string, model: string): Promise<number> {
  if (model.includes('claude')) {
    const response = await anthropic.messages.countTokens({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: text }]
    });
    return response.input_tokens;
  } else if (model.includes('gpt')) {
    const encoding = encoding_for_model(model);
    return encoding.encode(text).length;
  }
  return Math.ceil(text.length / 4);  // Fallback
}
```

### Token Budgets
- Claude 3.5 Sonnet: 200K context
- GPT-4 Turbo: 128K context
- GPT-4o: 128K context

---

## 7. IMPLEMENTATION CHECKLIST

### MVP (Week 1-2)
- [ ] GitHub webhook setup
- [ ] Diff parsing
- [ ] Token counting (Anthropic API)
- [ ] Basic chunking (soft/hard thresholds)
- [ ] Simple review submission (summary only)
- [ ] MongoDB schema

### Phase 2 (Week 3)
- [ ] Inline comments
- [ ] GitHub Review API
- [ ] Comment buffering

### Phase 3 (Week 4)
- [ ] Incremental review tracking
- [ ] Commit range detection
- [ ] File-based filtering

### Phase 4 (Week 5)
- [ ] Repo context loading
- [ ] Configurable prompts
- [ ] Custom instructions

### Phase 5 (Week 6)
- [ ] Error handling
- [ ] Rate limiting
- [ ] Logging
- [ ] Documentation

---

## 8. COMMON PITFALLS

❌ **Don't use embeddings initially**
- File-based context works for 95% of cases
- Add later if needed

❌ **Don't skip token counting**
- It's the difference between working and broken
- Use model APIs, not estimates

❌ **Don't hardcode prompts**
- Store in database
- Allow per-repo customization

❌ **Don't ignore incremental review**
- Saves 70% on API costs
- Easy to implement

❌ **Don't post unconfirmed comments**
- Buffer and filter first
- Prevents spam

---

## 9. COST ESTIMATES

| Scenario | Tokens | Cost (Claude 3.5) |
|----------|--------|-------------------|
| Small PR (5 files) | 5K | $0.0015 |
| Medium PR (20 files) | 20K | $0.006 |
| Large PR (100 files, 4 chunks) | 80K | $0.024 |
| Re-review (incremental) | 10K | $0.003 |

**With incremental review**: ~70% cost reduction

---

## 10. KEY TAKEAWAYS

1. **Token budgets**: Soft 1500, Hard 1000
2. **File sorting**: Language → token count
3. **Incremental review**: Timestamp + file tracking
4. **Context**: File-based, no embeddings
5. **Comments**: Inline + summary, buffered
6. **Prompts**: Simple injection, stored in DB
7. **Token counting**: Model-specific APIs
8. **Cost**: ~$0.006 per medium PR
9. **Savings**: ~70% with incremental review
10. **Complexity**: Start simple, add features later

---

**Source**: Analysis of PR-Agent (12.3K stars), Claude Code Action (8.5K stars), CodeRabbit (288K installs)  
**Date**: July 28, 2026
