# Architecture Decisions for Your AI PR Review Bot

Based on analysis of 3 production systems (12K+ stars each), here are the key decisions for your Next.js + MongoDB implementation:

## 1. LARGE PR HANDLING ✅

**Decision**: Implement token-aware chunking with soft/hard thresholds

**Why**: PR-Agent's approach is battle-tested and handles 100+ file PRs efficiently

**Implementation**:
- Soft threshold: 1500 tokens (warning)
- Hard threshold: 1000 tokens (stop adding context)
- Sort files by: language → token count (descending)
- Multi-patch mode: Split into 3-4 AI calls for very large PRs

**MongoDB Schema**:
```typescript
interface DiffChunk {
  prId: string;
  chunkIndex: number;
  files: string[];
  tokenCount: number;
  reviewedAt?: Date;
  findings: Finding[];
}
```

---

## 2. RE-REVIEW STRATEGY ✅

**Decision**: Incremental review via commit timestamp + file tracking

**Why**: Avoids re-reviewing unchanged files, saves API costs

**Implementation**:
1. Store review metadata in MongoDB:
   ```typescript
   interface ReviewRecord {
     prNumber: number;
     repo: string;
     reviewedAt: Date;
     lastCommitSha: string;
     filesReviewed: string[];
     findings: Finding[];
   }
   ```

2. On new push:
   - Fetch previous review timestamp
   - Get commits since that time
   - Extract files changed in those commits only
   - Review only those files

3. Skip review if:
   - No new commits since last review
   - No files changed in new commits

**Cost Impact**: ~70% reduction in API calls for active PRs with multiple pushes

---

## 3. CONTEXT STRATEGY ✅

**Decision**: File-based context (NO embeddings/RAG initially)

**Why**: 
- Simpler to implement
- Works well for most repos
- No vector DB overhead
- PR-Agent proves it's sufficient

**Implementation**:
```typescript
interface RepoContext {
  files: {
    [path: string]: string;
  };
  maxLines: number;
  loadedAt: Date;
  ttl: number; // 15 minutes
}

// Config in MongoDB
interface RepoConfig {
  repo: string;
  contextFiles: string[]; // ["README.md", "CONTRIBUTING.md", "docs/architecture.md"]
  maxLinesPerFile: number; // 500
  cacheEnabled: boolean;
}
```

**When to add embeddings**: Only if you see >30% of reviews need "search repo for similar patterns"

---

## 4. REVIEW SUBMISSION ✅

**Decision**: GitHub Review API with inline comments + summary

**Implementation**:
```typescript
interface ReviewComment {
  path: string;
  line: number;
  body: string;
  confirmed: boolean; // Buffer unconfirmed comments
}

async function submitReview(prNumber: number, comments: ReviewComment[]) {
  // 1. Filter confirmed comments
  const confirmed = comments.filter(c => c.confirmed);
  
  // 2. Create review
  const review = await octokit.rest.pulls.createReview({
    owner, repo, pull_number: prNumber,
    commit_id: latestCommitSha,
    comments: confirmed.map(c => ({
      path: c.path,
      line: c.line,
      body: c.body
    })),
    body: summaryComment,
    event: "COMMENT" // or "APPROVE" / "REQUEST_CHANGES"
  });
  
  return review;
}
```

**Two modes**:
- **Persistent**: Update same comment on re-review (set `persistent_comment_id` in MongoDB)
- **New**: Post fresh comment each time (default)

---

## 5. PROMPT STRUCTURE ✅

**Decision**: Simple string injection (no Jinja2 complexity)

**Implementation**:
```typescript
function buildReviewPrompt(
  pr: PullRequest,
  diff: string,
  context: RepoContext
): { system: string; user: string } {
  const contextStr = Object.entries(context.files)
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

**Store in MongoDB**:
```typescript
interface PromptTemplate {
  repo: string;
  systemPrompt: string;
  userPromptTemplate: string; // Can have {{variables}}
  customInstructions?: string;
}
```

---

## 6. TOKEN COUNTING ✅

**Decision**: Model-specific token counting

**Implementation**:
```typescript
async function countTokens(text: string, model: string): Promise<number> {
  if (model.includes('claude')) {
    // Use Anthropic API
    const response = await anthropic.messages.countTokens({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: text }]
    });
    return response.input_tokens;
  } else if (model.includes('gpt')) {
    // Use tiktoken
    const encoding = encoding_for_model(model);
    return encoding.encode(text).length;
  }
  // Fallback: estimate
  return Math.ceil(text.length / 4);
}
```

**Token budgets by model**:
- Claude 3.5 Sonnet: 200K context
- GPT-4 Turbo: 128K context
- GPT-4o: 128K context

---

## 7. DATABASE SCHEMA (MongoDB)

```typescript
// Reviews collection
interface Review {
  _id: ObjectId;
  prNumber: number;
  repo: string;
  owner: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date;
  
  // Incremental tracking
  lastCommitSha: string;
  filesReviewed: string[];
  
  // Results
  findings: Finding[];
  summary: string;
  
  // GitHub
  githubCommentId?: number;
  githubReviewId?: number;
  persistent?: boolean;
}

interface Finding {
  file: string;
  line: number;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion?: string;
}

// Config collection
interface RepoConfig {
  _id: ObjectId;
  repo: string;
  owner: string;
  
  // Chunking
  softTokenThreshold: number; // 1500
  hardTokenThreshold: number; // 1000
  
  // Context
  contextFiles: string[];
  maxLinesPerFile: number;
  
  // Prompts
  systemPrompt: string;
  userPromptTemplate: string;
  customInstructions?: string;
  
  // Behavior
  persistentComments: boolean;
  autoApprove: boolean;
  
  // Models
  model: string; // "claude-3-5-sonnet-20241022"
}
```

---

## 8. IMPLEMENTATION ROADMAP

### Phase 1: MVP (Week 1-2)
- [ ] GitHub webhook integration
- [ ] Basic diff parsing + chunking
- [ ] Simple review submission (summary comment only)
- [ ] MongoDB schema setup
- [ ] Token counting (Anthropic API)

### Phase 2: Inline Comments (Week 3)
- [ ] Parse findings into inline comments
- [ ] GitHub Review API integration
- [ ] Comment buffering + filtering

### Phase 3: Incremental Review (Week 4)
- [ ] Track previous reviews in MongoDB
- [ ] Commit range detection
- [ ] File-based filtering

### Phase 4: Context + Customization (Week 5)
- [ ] Repo context loading
- [ ] Configurable prompts
- [ ] Custom instructions per repo

### Phase 5: Polish (Week 6)
- [ ] Error handling + retries
- [ ] Rate limiting
- [ ] Logging + monitoring
- [ ] Documentation

---

## 9. COST OPTIMIZATION

**Estimated costs** (based on PR-Agent patterns):

| Scenario | Tokens | Cost (Claude 3.5) |
|----------|--------|-------------------|
| Small PR (5 files) | 5K | $0.0015 |
| Medium PR (20 files) | 20K | $0.006 |
| Large PR (100 files, 4 chunks) | 80K | $0.024 |
| Re-review (incremental) | 10K | $0.003 |

**Savings with incremental review**: ~70% reduction on re-reviews

---

## 10. WHAT NOT TO DO

❌ **Don't use embeddings/RAG initially**
- Adds complexity (vector DB, embedding model)
- File-based context works for 95% of cases
- Add later if you see "search repo" requests

❌ **Don't implement persistent comments first**
- Start with simple new comments
- Add persistent mode after MVP works

❌ **Don't try to handle all edge cases**
- Start with Python/JavaScript/TypeScript
- Add language support incrementally

❌ **Don't over-engineer prompts**
- Simple string injection is fine
- Use Jinja2 only if you have 10+ template variables

❌ **Don't skip token counting**
- It's the difference between working and broken
- Use model-specific APIs (Anthropic, OpenAI)

---

## REFERENCES

- **Full Analysis**: See `PR_REVIEW_BOT_ANALYSIS.md`
- **PR-Agent Source**: https://github.com/The-PR-Agent/pr-agent
- **Claude Code Action**: https://github.com/anthropics/claude-code-action
- **GitHub Review API**: https://docs.github.com/en/rest/pulls/reviews

---

**Last Updated**: July 28, 2026  
**Status**: Ready for implementation
