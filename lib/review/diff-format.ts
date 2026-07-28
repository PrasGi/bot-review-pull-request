export interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
  previous_filename?: string;
}

export interface NewHunkLine {
  lineNumber: number;
  added: boolean;
}

export interface FileDiffMeta {
  path: string;
  newHunkLines: Set<number>;
}

const PR_DATA_TAG = /<\/?\s*pr_data\s*>/gi;

export function sanitizeUntrusted(text: string): string {
  return text.replace(PR_DATA_TAG, "[pr-data-tag-removed]");
}

interface HunkHeader {
  newStart: number;
}

function parseHunkHeader(line: string): HunkHeader | null {
  const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
  if (!match) return null;
  return { newStart: Number.parseInt(match[1] ?? "0", 10) };
}

export function formatFileDiff(file: PrFile): {
  rendered: string;
  newHunkLines: Set<number>;
} {
  const newHunkLines = new Set<number>();
  const stats = `+${file.additions} -${file.deletions}`;
  const pathLabel =
    file.status === "renamed" && file.previous_filename
      ? `${file.previous_filename} → ${file.filename}`
      : file.filename;
  const header = `## File: '${pathLabel}' (${file.status}, ${stats})`;

  if (!file.patch) {
    return { rendered: `${header}\n(no textual diff available)`, newHunkLines };
  }

  const lines = sanitizeUntrusted(file.patch).split("\n");
  const out: string[] = [header, ""];
  let newLineNo = 0;
  let hunkIndex = 0;
  let oldBuffer: string[] = [];

  const flushOld = (): void => {
    if (oldBuffer.length > 0) {
      out.push("__old hunk__", ...oldBuffer);
      oldBuffer = [];
    }
  };

  for (const line of lines) {
    const hunkHeader = parseHunkHeader(line);
    if (hunkHeader) {
      flushOld();
      hunkIndex += 1;
      newLineNo = hunkHeader.newStart;
      out.push(`@@ hunk ${hunkIndex} @@`, "__new hunk__");
      continue;
    }
    if (line.startsWith("-")) {
      oldBuffer.push(line);
      continue;
    }
    if (line.startsWith("+")) {
      out.push(`${newLineNo} + ${line.slice(1)}`);
      newHunkLines.add(newLineNo);
      newLineNo += 1;
      continue;
    }
    if (line.startsWith("\\")) {
      continue;
    }
    const content = line.startsWith(" ") ? line.slice(1) : line;
    out.push(`${newLineNo}   ${content}`);
    newLineNo += 1;
  }
  flushOld();

  return { rendered: out.join("\n"), newHunkLines };
}

export function formatFilesForPrompt(files: PrFile[]): {
  rendered: string;
  newHunkLinesByPath: Map<string, Set<number>>;
} {
  const parts: string[] = [];
  const newHunkLinesByPath = new Map<string, Set<number>>();
  for (const file of files) {
    const { rendered, newHunkLines } = formatFileDiff(file);
    parts.push(rendered);
    newHunkLinesByPath.set(file.filename, newHunkLines);
  }
  return { rendered: parts.join("\n\n"), newHunkLinesByPath };
}
