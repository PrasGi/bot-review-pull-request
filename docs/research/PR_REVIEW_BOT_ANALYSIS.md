# Production-Grade AI PR Review Bot Analysis
## Engineering Patterns from Open-Source Implementations

**Analysis Date**: July 28, 2026  
**Scope**: 3 major production systems with 1000+ stars each

---

## EXECUTIVE SUMMARY

Three production-grade AI PR review bots analyzed:
1. **PR-Agent** (The-PR-Agent/pr-agent) — 12,263 stars, Python, Apache 2.0
2. **Claude Code Action** (anthropics/claude-code-action) — 8,472 stars, TypeScript, MIT
3. **CodeRabbit** (coderabbitai) — 288K+ installs, proprietary but public patterns

**Key Findings**:
- **Large PR handling**: Token-aware compression with soft/hard thresholds, file prioritization by language
- **Re-review**: Incremental review via commit range detection + previous review timestamp comparison
- **Context**: File-based repo context (no embeddings), prompt-injected via Jinja2 templates
- **Review submission**: GitHub Review API with inline comments + summary comments
- **Prompt structure**: System + user templates with variable injection, model-specific token counting

---

## 1. LARGE PR HANDLING STRATEGY

### PR-Agent: Token-Aware Adaptive Compression

**Repository**: https://github.com/The-PR-Agent/pr-agent

#### Diff Chunking Logic
**File**: `pr_agent/algo/pr_processing.py` ([permalink](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/algo/pr_processing.py#L38-L142))

```python
def get_pr_diff(git_provider: GitProvider, token_handler: TokenHandler,
                model: str,
                add_line_numbers_to_hunks: bool = False,
                disable_extra_lines: bool = False,
                large_pr_handling=False,
                return_remaining_files=False):
    # Step 1: Generate extended diff with context lines
    patches_extended, total_tokens, patches_extended_tokens = pr_generate_extended_diff(
        pr_languages, token_handler, add_line_numbers_to_hunks,
        patch_extra_lines_before=PATCH_EXTRA_LINES_BEFORE, 
        patch_extra_lines_after=PATCH_EXTRA_LINES_AFTER)

    # Step 2: Check soft threshold (1500 tokens buffer)
    if total_tokens + OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD < get_max_tokens(model):
        return "\n".join(patches_extended)  # Return full diff

    # Step 3: If over limit, compress and prune
    patches_compressed_list, total_tokens_list, deleted_files_list, remaining_files_list, file_dict, files_in_patches_list = \
        pr_generate_compressed_diff(pr_languages, token_handler, model, add_line_numbers_to_hunks, large_pr_handling)
```

**Token Budget Constants** ([line 26-27](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/algo/pr_processing.py#L26-L27)):
```python
OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD = 1500  # Warning threshold
OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD = 1000  # Hard stop for additional info
```

#### File Prioritization Strategy
**File**: `pr_agent/algo/pr_processing.py` ([lines 210-276](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/algo/pr_processing.py#L210-L276))

```python
def pr_generate_compressed_diff(top_langs: list, token_handler: TokenHandler, model: str,
                                convert_hunks_to_line_numbers: bool,
                                large_pr_handling: bool):
    # Sort files by token count (largest first)
    sorted_files = []
    for lang in top_langs:
        sorted_files.extend(sorted(lang['files'], key=lambda x: x.tokens, reverse=True))
    
    # Process files in order until token budget exhausted
    for filename, data in file_dict.items():
        if total_tokens + new_patch_tokens > max_tokens_model - OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD:
            remaining_files_list_new.append(filename)  # Skip this file
            continue
        
        patches.append(patch_final)
        total_tokens += token_handler.count_tokens(patch_final)
```

**Key Pattern**: Files sorted by **main language** (Python, JavaScript, etc.) then by **token count descending**. Largest files processed first to maximize coverage.

#### Large PR Multi-Patch Mode
**File**: `pr_agent/algo/pr_processing.py` ([lines 84-86](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/algo/pr_processing.py#L84-L86))

```python
if large_pr_handling and len(patches_compressed_list) > 1:
    get_logger().info(f"Large PR handling mode, and found {len(patches_compressed_list)} patches")
    return ""  # Return empty string, trigger multiple AI calls
```

**Strategy**: When `large_pr_handling=True` and multiple patches exist:
- Generate **separate AI calls per patch** (up to 4 calls configurable)
- Each call reviews a subset of files
- Final call summarizes all findings
- **Config**: `pr_description.max_ai_calls` (default: 4)

#### Token Counting Strategy
**File**: `pr_agent/algo/token_handler.py` ([lines 99-152](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/algo/token_handler.py#L99-L152))

```python
def _get_token_count_by_model_type(self, patch: str, default_estimate: int) -> int:
    model_name = get_settings().config.model.lower()
    
    # OpenAI: Use tiktoken encoder
    if ModelTypeValidator.is_openai_model(model_name):
        return default_estimate
    
    # Claude: Use Anthropic API token counting
    if ModelTypeValidator.is_anthropic_model(model_name):
        return self._calc_claude_tokens(patch)
    
    # Unknown: Apply estimation factor
    return self._apply_estimation_factor(model_name, default_estimate)
```

**Model-Specific Handling**:
- **OpenAI (GPT-4, o1)**: tiktoken encoder
- **Claude**: Anthropic API `count_tokens()` call
- **Others**: Estimation factor (1 + `model_token_count_estimate_factor`)

---

### Claude Code Action: Prompt-Based Chunking

**Repository**: https://github.com/anthropics/claude-code-action

#### Approach
Claude Code Action uses a **simpler model**: No explicit chunking. Instead:
1. **Checkout PR branch** with `fetch-depth: 1`
2. **Pass full diff to Claude** via `gh pr diff`
3. **Claude handles token limits** via system prompt constraints
4. **Tool restrictions** limit what Claude can do (prevents runaway API calls)

**Example Workflow** ([docs/solutions.md](https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md#automatic-pr-code-review)):
```yaml
- uses: anthropics/claude-code-action@v1
  with:
    prompt: |
      REPO: ${{ github.repository }}
      PR NUMBER: ${{ github.event.pull_request.number }}
      Please review this pull request...
    claude_args: |
      --allowedTools "mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*),Bash(gh pr diff:*)"
```

**Key Difference**: Relies on Claude's native 200K token context window rather than pre-chunking.

---

## 2. RE-REVIEW & INCREMENTAL REVIEW HANDLING

### PR-Agent: Commit Range Detection

**File**: `pr_agent/tools/pr_reviewer.py` ([lines 115-161](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/tools/pr_reviewer.py#L115-L161))

```python
def parse_incremental(self, args: List[str]):
    is_incremental = False
    if args and len(args) >= 1:
        arg = args[0]
        if arg == "-i":
            is_incremental = True
    incremental = IncrementalPR(is_incremental)
    return incremental

async def run(self) -> None:
    if self.incremental.is_incremental:
        can_run = self._can_run_incremental_review()
        if not can_run and self.incremental.is_incremental:
            return None  # Skip if no new commits
    
    # Check if there are unreviewed files
    if (self.incremental.is_incremental
        and hasattr(self.git_provider, "unreviewed_files_map")
        and not self.git_provider.unreviewed_files_map):
        previous_review_url = ""
        if hasattr(self.git_provider, "previous_review"):
            previous_review_url = getattr(self.git_provider.previous_review, "html_url", "")
        self.git_provider.publish_comment(
            f"Incremental Review Skipped\nNo files changed since [previous PR Review]({previous_review_url})")
        return None
```

#### Previous Review Detection
**File**: `pr_agent/git_providers/github_provider.py` ([lines 166-181](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/git_providers/github_provider.py#L166-L181))

```python
def _get_incremental_commits(self):
    if not self.pr_commits:
        self.pr_commits = list(self.pr.get_commits())
    
    # Fetch previous review (most recent review comment)
    self.previous_review = self.get_previous_review(full=True, incremental=True)
    
    if self.previous_review:
        # Get commit range since last review
        self.incremental.commits_range = self.get_commit_range()
        
        for commit in self.incremental.commits_range:
            if commit.commit.message.startswith(f"Merge branch '{self._get_repo().default_branch}'"):
                # Skip merge commits
                continue
            # Process new commits
    else:
        get_logger().info("No previous review found, will review the entire PR")
        self.incremental.is_incremental = False
```

#### Commit Range Calculation
**File**: `pr_agent/git_providers/github_provider.py` ([lines 181-190](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/git_providers/github_provider.py#L181-L190))

```python
def get_commit_range(self):
    last_review_time = self.previous_review.created_at
    first_new_commit_index = None
    
    for index in range(len(self.pr_commits) - 1, -1, -1):
        commit_time = self.pr_commits[index].commit.author.date
        if commit_time < last_review_time:
            first_new_commit_index = index + 1
            break
    
    if first_new_commit_index is None:
        return []  # No new commits
    
    return self.pr_commits[first_new_commit_index:]
```

**Logic**:
1. Fetch all PR commits
2. Get previous review timestamp
3. Find first commit **after** previous review time
4. Return commits in that range
5. Only review files changed in those commits

#### IncrementalPR Data Structure
**File**: `pr_agent/git_providers/git_provider.py`

```python
class IncrementalPR:
    def __init__(self, is_incremental: bool = False):
        self.is_incremental = is_incremental
        self.commits_range = None
        self.first_new_commit = None
        self.last_seen_commit = None
    
    @property
    def first_new_commit_sha(self):
        return None if self.first_new_commit is None else self.first_new_commit.sha
    
    @property
    def last_seen_commit_sha(self):
        return None if self.last_seen_commit is None else self.last_seen_commit.sha
```

---

### Claude Code Action: Stateless Re-Review

Claude Code Action takes a **stateless approach**:
- No tracking of previous reviews
- Each PR review is independent
- Relies on GitHub's PR comment history for context
- User can manually trigger re-review by commenting `@claude /review-pr`

**Advantage**: Simpler, no state management needed  
**Tradeoff**: Cannot automatically detect "only review new commits"

---

## 3. CONTEXT STRATEGY: RAG vs. PROMPT INJECTION

### PR-Agent: File-Based Repo Context (No Embeddings)

**File**: `pr_agent/algo/repo_context.py` ([lines 78-102](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/algo/repo_context.py#L78-L102))

```python
def _get_repo_context_config() -> tuple[list, int] | None:
    context_files = get_settings().config.get("repo_context_files", [])
    if not context_files:
        return None
    
    max_lines = get_settings().config.get("repo_context_max_lines", 500)
    
    return context_files, max_lines

def _load_repo_context_files(git_provider, context_files: list) -> tuple[dict[str, str], bool]:
    from_default_branch = _read_bool_setting("repo_context_from_default_branch", default=True)
    files = {}
    
    for file_path in context_files:
        try:
            content = git_provider.get_repo_file_content(file_path, from_default_branch=from_default_branch)
            files[file_path] = str(content).rstrip()
        except Exception as e:
            get_logger().warning(f"Failed to load repo context file: {file_path}")
            continue
    
    return files, had_fetch_error
```

**Configuration** (`.pr_agent.toml` or env):
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

**Caching Strategy** ([lines 21-50](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/algo/repo_context.py#L21-L50)):
```python
class _RepoContextCache:
    def __init__(self, max_size: int = 256, ttl_seconds: int = 900):  # 15 min TTL
        self._max_size = max(1, int(max_size))
        self._ttl_seconds = max(0, int(ttl_seconds))
        self._entries = OrderedDict()
    
    def get(self, key, default=None):
        entry = self._entries.get(key)
        if entry is None:
            return default
        
        value, expires_at = entry
        if expires_at <= time.monotonic():
            del self._entries[key]
            return default
        
        self._entries.move_to_end(key)
        return value
```

**Key Points**:
- **No embeddings or vector DB** — just file content
- **Manual file selection** — admin specifies which files to include
- **LRU cache** with 15-minute TTL
- **Max 256 cached contexts** per process
- **Truncation** to 500 lines per file

### Claude Code Action: Implicit Context via Checkout

Claude Code Action doesn't explicitly load repo context. Instead:
- **Entire repo checked out** on runner
- Claude can read any file via `Read` tool
- **No pre-loading** — files fetched on-demand
- **Advantage**: Flexible, can access any file
- **Tradeoff**: Slower (file I/O per request)

---

## 4. REVIEW SUBMISSION: GitHub API USAGE

### PR-Agent: Inline Comments + Summary

**File**: `pr_agent/git_providers/github_provider.py` ([lines 512-572](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/git_providers/github_provider.py#L512-L572))

```python
def publish_inline_comments(self, comments: list[dict], disable_fallback: bool = False):
    try:
        # Publish all comments in a single review
        self.pr.create_review(commit=self.last_commit_id, comments=comments)
    except Exception as e:
        get_logger().info(f"Initially failed to publish inline comments")
        
        if (getattr(e, "status", None) == 422 and not disable_fallback):
            # Fallback: publish comments individually
            self._publish_inline_comments_fallback_with_verification(comments)

def _publish_inline_comments_fallback_with_verification(self, comments):
    verified_comments, invalid_comments = self._verify_code_comments(comments)
    
    if verified_comments:
        try:
            self.pr.create_review(commit=self.last_commit_id, comments=verified_comments)
        except:
            pass
```

**Comment Structure**:
```python
{
    "body": "Issue description",
    "path": "src/index.js",
    "position": 42,  # Line number in diff
    "subject_type": "LINE"  # or "FILE"
}
```

**Review Publishing** ([pr_reviewer.py lines 184-191](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/tools/pr_reviewer.py#L184-L191)):
```python
if get_settings().pr_reviewer.persistent_comment and not self.incremental.is_incremental:
    # Update existing comment (persistent mode)
    self.git_provider.publish_persistent_comment(
        pr_review,
        initial_header=f"{PRReviewHeader.REGULAR.value} 🔍",
        update_header=True,
        final_update_message=final_update_message
    )
else:
    # Post new comment (default)
    self.git_provider.publish_comment(pr_review)
```

**Two Modes**:
1. **Persistent Comment**: Updates same comment on re-review
2. **New Comment**: Posts fresh comment each time

---

### Claude Code Action: Inline Comments via MCP

**File**: `src/mcp/github-inline-comment-server.ts` ([lines 37-80](https://github.com/anthropics/claude-code-action/blob/main/src/mcp/github-inline-comment-server.ts#L37-L80))

```typescript
server.tool(
  "create_inline_comment",
  "Create an inline comment on a specific line or lines in a PR file",
  {
    path: z.string().describe("The file path to comment on (e.g., 'src/index.js')"),
    body: z.string().describe("The comment text (supports markdown and GitHub code suggestion blocks)"),
    line: z.number().nonnegative().optional(),
    startLine: z.number().nonnegative().optional(),
    side: z.enum(["LEFT", "RIGHT"]).optional().default("RIGHT"),
    commit_id: z.string().optional(),
    confirmed: z.boolean()
      .optional()
      .describe("If true, post immediately. If false, buffer for classification")
  }
);
```

**Buffering Strategy** ([lines 15-20](https://github.com/anthropics/claude-code-action/blob/main/src/mcp/github-inline-comment-server.ts#L15-L20)):
```typescript
// Calls without confirmed=true are buffered here instead of posted
// This prevents subagents from posting test/probe comments
const BUFFER_PATH = "/tmp/inline-comments-buffer.jsonl";
const CLASSIFY_ENABLED = process.env.CLASSIFY_INLINE_COMMENTS !== "false";
```

**Key Feature**: Comments are **buffered by default** and classified after session ends:
- Real review comments → posted
- Test/probe comments → filtered out
- Prevents accidental spam from subagents

---

## 5. PROMPT STRUCTURE & SYSTEM PROMPTS

### PR-Agent: Jinja2 Template Injection

**File**: `pr_agent/tools/pr_reviewer.py` ([lines 79-113](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/tools/pr_reviewer.py#L79-L113))

```python
self.vars = {
    "title": self.git_provider.pr.title,
    "branch": self.git_provider.get_pr_branch(),
    "description": self.pr_description,
    "language": self.main_language,
    "diff": "",  # Populated later
    "num_pr_files": self.git_provider.get_num_of_files(),
    "num_max_findings": get_settings().pr_reviewer.num_max_findings,
    "require_score": get_settings().pr_reviewer.require_score_review,
    "require_tests": get_settings().pr_reviewer.require_tests_review,
    "require_estimate_effort_to_review": get_settings().pr_reviewer.require_estimate_effort_to_review,
    "require_estimate_contribution_time_cost": get_settings().pr_reviewer.require_estimate_contribution_time_cost,
    'require_can_be_split_review': get_settings().pr_reviewer.require_can_be_split_review,
    'require_security_review': get_settings().pr_reviewer.require_security_review,
    'require_todo_scan': get_settings().pr_reviewer.get("require_todo_scan", False),
    'question_str': question_str,
    'answer_str': answer_str,
    "extra_instructions": get_settings().pr_reviewer.extra_instructions,
    "skills_context": get_skills_context(),
    "repo_context": build_repo_context(self.git_provider),
    "commit_messages_str": self.git_provider.get_commit_messages(),
    "custom_labels": "",
}

self.token_handler = TokenHandler(
    self.git_provider.pr,
    self.vars,
    get_settings().pr_review_prompt.system,
    get_settings().pr_review_prompt.user
)
```

**Template Rendering** ([token_handler.py lines 74-97](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/algo/token_handler.py#L74-L97)):
```python
def _get_system_user_tokens(self, pr, encoder, vars: dict, system, user):
    try:
        environment = Environment(undefined=StrictUndefined)
        system_prompt = environment.from_string(system).render(vars)
        user_prompt = environment.from_string(user).render(vars)
        system_prompt_tokens = len(encoder.encode(system_prompt))
        user_prompt_tokens = len(encoder.encode(user_prompt))
        return system_prompt_tokens + user_prompt_tokens
    except Exception as e:
        get_logger().error(f"Error in _get_system_user_tokens: {e}")
        return 0
```

**Prompt Files** (TOML-based):
- `pr_agent/settings/pr_review_prompts.toml` — system + user templates
- `pr_agent/settings/pr_code_suggestions_prompts.toml` — for /improve tool
- `pr_agent/settings/pr_description_prompts.toml` — for /describe tool

**Example Template Variables**:
```jinja2
{{ title }}              # PR title
{{ description }}        # PR body
{{ diff }}              # Formatted diff (injected after token calculation)
{{ language }}          # Main language (Python, JavaScript, etc.)
{{ num_pr_files }}      # Number of files changed
{{ require_score }}     # Boolean: include effort score?
{{ repo_context }}      # Loaded repo context files
{{ commit_messages_str }}  # All commit messages
{{ extra_instructions }}   # User-provided custom instructions
```

---

### Claude Code Action: Direct Prompt Injection

Claude Code Action uses simpler prompt injection:

**File**: `src/create-prompt/index.ts` ([lines 883-968](https://github.com/anthropics/claude-code-action/blob/main/src/create-prompt/index.ts#L883-L968))

```typescript
function extractUserRequestFromContext(
  context: PreparedContext,
  githubData: GitHubData
): string | null {
  // Extract user's actual command/request as separate content block
  // Enables slash command processing in the CLI
  // Example: "@claude /review-pr" -> returns "/review-pr"
}

// Write the prompt file
await writeFile(`${promptDir}/claude-prompt.txt`, promptContent);

// Extract and write the user request separately for SDK multi-block messaging
// This allows the CLI to process slash commands (e.g., "@claude /review-pr")
```

**Prompt Structure**:
```
REPO: owner/repo
PR NUMBER: 123

Please review this pull request with a focus on:
- Code quality and best practices
- Potential bugs or issues
- Security implications
- Performance considerations
```

**Key Difference**: No template variables — just plain text with GitHub context injected directly.

---

## 6. COMPARATIVE SUMMARY TABLE

| Aspect | PR-Agent | Claude Code Action | CodeRabbit |
|--------|----------|-------------------|-----------|
| **Large PR Handling** | Token-aware compression + multi-patch mode | Relies on 200K context window | Agentic review with learning |
| **Chunking Strategy** | Files sorted by language + token count | No pre-chunking | Proprietary (not public) |
| **Token Budget** | Soft: 1500, Hard: 1000 tokens | Implicit (200K limit) | Unknown |
| **Re-Review** | Incremental via commit range + timestamp | Stateless (manual trigger) | Tracks previous reviews |
| **Context** | File-based (no embeddings) | Repo checkout + on-demand reads | Learnings + code context |
| **RAG/Embeddings** | No | No | Proprietary learnings system |
| **Review API** | `pr.create_review()` + inline comments | `create_inline_comment` MCP tool | GitHub Review API |
| **Comment Buffering** | No | Yes (filters test comments) | N/A |
| **Prompt Structure** | Jinja2 templates + variable injection | Plain text + context injection | Proprietary |
| **Persistent Comments** | Optional (configurable) | No | Yes |
| **Multi-Model Support** | OpenAI, Claude, Deepseek, etc. | Claude only (Bedrock, Vertex AI) | Proprietary |
| **Open Source** | Yes (Apache 2.0) | Yes (MIT) | No |

---

## 7. ARCHITECTURAL RECOMMENDATIONS FOR YOUR NEXT.JS + MONGODB BOT

### Based on Production Patterns

#### 1. **Diff Chunking** (Recommended: PR-Agent Pattern)
```typescript
// Pseudo-code for your implementation
interface DiffChunk {
  files: string[];
  tokens: number;
  priority: number; // Language priority
}

async function chunkDiff(diff: string, model: string): Promise<DiffChunk[]> {
  // 1. Parse diff into files
  const files = parseDiff(diff);
  
  // 2. Sort by language (main language first)
  const sorted = sortByLanguage(files);
  
  // 3. Count tokens per file
  const withTokens = await Promise.all(
    sorted.map(f => ({ ...f, tokens: await countTokens(f.patch) }))
  );
  
  // 4. Chunk until soft threshold (1500 tokens)
  const chunks: DiffChunk[] = [];
  let current: DiffChunk = { files: [], tokens: 0, priority: 0 };
  
  for (const file of withTokens) {
    if (current.tokens + file.tokens > MAX_TOKENS - SOFT_THRESHOLD) {
      chunks.push(current);
      current = { files: [], tokens: 0, priority: 0 };
    }
    current.files.push(file.name);
    current.tokens += file.tokens;
  }
  
  if (current.files.length > 0) chunks.push(current);
  return chunks;
}
```

#### 2. **Incremental Re-Review** (Recommended: PR-Agent Pattern)
```typescript
// Store in MongoDB
interface ReviewRecord {
  prNumber: number;
  repo: string;
  reviewedAt: Date;
  lastCommitSha: string;
  filesReviewed: string[];
  findings: Finding[];
}

async function getIncrementalCommits(
  prNumber: number,
  repo: string
): Promise<string[]> {
  // 1. Fetch previous review from MongoDB
  const previous = await ReviewRecord.findOne({ prNumber, repo })
    .sort({ reviewedAt: -1 });
  
  if (!previous) {
    return null; // Full review needed
  }
  
  // 2. Get all commits since last review
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
  
  return Array.from(changedFiles);
}
```

#### 3. **Context Strategy** (Recommended: Hybrid)
```typescript
// Don't use embeddings initially — too complex
// Instead: File-based context like PR-Agent

interface RepoContext {
  files: {
    [path: string]: string; // File content
  };
  maxLines: number;
  loadedAt: Date;
}

async function buildRepoContext(
  repo: string,
  contextFiles: string[] = [
    "README.md",
    "CONTRIBUTING.md",
    "docs/architecture.md"
  ]
): Promise<RepoContext> {
  const files: { [path: string]: string } = {};
  
  for (const filePath of contextFiles) {
    try {
      const content = await github.getFileContent(repo, filePath);
      files[filePath] = content.split('\n').slice(0, 500).join('\n');
    } catch (e) {
      console.warn(`Failed to load ${filePath}`);
    }
  }
  
  return {
    files,
    maxLines: 500,
    loadedAt: new Date()
  };
}
```

#### 4. **Review Submission** (Recommended: Claude Code Action Pattern)
```typescript
// Use GitHub Review API for inline comments
// Buffer comments to filter test probes

interface ReviewComment {
  path: string;
  line: number;
  body: string;
  confirmed: boolean;
}

async function submitReview(
  prNumber: number,
  comments: ReviewComment[]
): Promise<void> {
  // 1. Filter confirmed comments
  const confirmed = comments.filter(c => c.confirmed);
  
  // 2. Create review with inline comments
  const review = await github.createReview(prNumber, {
    commit_id: await github.getLatestCommitSha(prNumber),
    comments: confirmed.map(c => ({
      path: c.path,
      line: c.line,
      body: c.body
    })),
    body: "## AI Code Review\n\n[Summary here]",
    event: "COMMENT" // or "APPROVE" / "REQUEST_CHANGES"
  });
  
  return review;
}
```

#### 5. **Prompt Structure** (Recommended: Simple Injection)
```typescript
// Don't over-engineer with Jinja2 — keep it simple

interface ReviewPrompt {
  system: string;
  user: string;
}

function buildReviewPrompt(
  pr: PullRequest,
  diff: string,
  context: RepoContext
): ReviewPrompt {
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

---

## 8. KEY TAKEAWAYS

1. **Don't use embeddings/RAG initially** — File-based context is simpler and works well
2. **Token budgets matter** — Implement soft (1500) and hard (1000) thresholds
3. **Incremental review is valuable** — Track previous reviews by timestamp + commit SHA
4. **Multi-patch mode for large PRs** — Split into 3-4 AI calls rather than one huge call
5. **Buffer comments** — Filter test probes before posting to GitHub
6. **Persistent comments optional** — Update same comment or post new ones (both valid)
7. **Model-specific token counting** — Use Anthropic API for Claude, tiktoken for OpenAI
8. **File prioritization** — Sort by language + token count, process largest first
9. **Stateless is simpler** — Claude Code Action's approach works well for simpler use cases
10. **Configuration over code** — Use TOML/YAML for prompts, not hardcoded strings

---

## REFERENCES

### PR-Agent
- **Repository**: https://github.com/The-PR-Agent/pr-agent
- **Latest Release**: v0.39.0 (July 2026)
- **Key Files**:
  - Diff chunking: `pr_agent/algo/pr_processing.py`
  - Token handling: `pr_agent/algo/token_handler.py`
  - Incremental review: `pr_agent/git_providers/github_provider.py`
  - Review submission: `pr_agent/tools/pr_reviewer.py`
  - Repo context: `pr_agent/algo/repo_context.py`

### Claude Code Action
- **Repository**: https://github.com/anthropics/claude-code-action
- **Latest Release**: v1.0.180 (July 2026)
- **Key Files**:
  - Inline comments: `src/mcp/github-inline-comment-server.ts`
  - Prompt creation: `src/create-prompt/index.ts`
  - Solutions guide: `docs/solutions.md`

### CodeRabbit
- **Website**: https://www.coderabbit.ai/
- **Marketplace**: https://github.com/marketplace/coderabbitai
- **Skills**: https://github.com/coderabbitai/skills
- **Note**: Proprietary implementation, patterns inferred from public docs

---

**Analysis completed**: July 28, 2026  
**Confidence level**: High (based on source code analysis + documentation)
