/**
 * Naive source detection: API Gateway / Lambda event as external input.
 */

import * as fs from "fs";
import * as path from "path";
import type { Source } from "./types.js";

const SOURCE_PATTERNS = [
  // event.pathParameters.id, event.pathParameters!.id
  {
    regex: /event\.pathParameters!?\.(\w+)/g,
    kind: "api-gateway" as const,
    nameGroup: 1,
  },
  // event.body
  {
    regex: /event\.body\b/g,
    kind: "api-gateway" as const,
    name: "body",
  },
  // event.queryStringParameters?.x
  {
    regex: /event\.queryStringParameters\??\.(\w+)/g,
    kind: "api-gateway" as const,
    nameGroup: 1,
  },
  // event (whole event as source when passed to something)
  {
    regex: /\bevent\b(?!\s*\.)/g,
    kind: "lambda-event" as const,
    name: "event",
  },
];

export function findSourcesInFile(filePath: string, content: string): Source[] {
  const sources: Source[] = [];
  const lines = content.split("\n");

  for (const pattern of SOURCE_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      const lineNum =
        content.slice(0, m.index).split("\n").length;
      const name: string =
        "nameGroup" in pattern && pattern.nameGroup
          ? (m[pattern.nameGroup] ?? "?")
          : "name" in pattern
            ? (pattern.name as string)
            : "?";
      const expression = m[0];
      // Avoid duplicate same line/expression
      if (
        !sources.some(
          (s) => s.line === lineNum && s.expression === expression
        )
      ) {
        sources.push({
          kind: pattern.kind,
          file: filePath,
          line: lineNum,
          expression,
          name,
        });
      }
    }
  }

  return sources;
}

export function findSourcesInDir(dir: string, ext: string[] = [".ts", ".js"]): Source[] {
  const sources: Source[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
      sources.push(...findSourcesInDir(full, ext));
    } else if (e.isFile() && ext.some((x) => e.name.endsWith(x))) {
      const content = fs.readFileSync(full, "utf-8");
      sources.push(...findSourcesInFile(full, content));
    }
  }

  return sources;
}
