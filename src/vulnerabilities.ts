/**
 * OWASP Top 10 vulnerability tagging (naive).
 * - Injection (A03): user input → DynamoDB key/item (no sanitization).
 * - SSRF (A10): user input → URL / fetch / http.get.
 */

import type { DataFlow, FlowWithVulnerability, VulnerabilityType } from "./types.js";
import * as fs from "fs";

/** Tag flows that are injection-prone: source (path/body/query) → DynamoDB. */
export function tagInjection(flows: DataFlow[]): FlowWithVulnerability[] {
  const result: FlowWithVulnerability[] = [];
  for (const f of flows) {
    // Any flow from API Gateway to DynamoDB is considered potentially vulnerable to injection
    // (user-controlled input used as key or item without sanitization in this naive model)
    if (f.source.kind === "api-gateway" && f.sink.kind === "dynamodb") {
      const reason =
        f.source.name === "body"
          ? "Request body (user input) written to DynamoDB without validation/sanitization — injection risk"
          : `Path/query parameter '${f.source.name}' used as DynamoDB key/argument without sanitization — injection risk`;
      result.push({
        ...f,
        vulnerability: "injection",
        reason,
      });
    }
  }
  return result;
}

/** Tag flows where user input is used as URL (SSRF). We need to detect fetch(url) / http.get(url) in the same file. */
export function tagSSRF(flows: DataFlow[], rootDir: string): FlowWithVulnerability[] {
  const result: FlowWithVulnerability[] = [];
  const urlSourceVars = new Map<string, { file: string; line: number }[]>();

  // Find files that have both a source (event.*) and fetch/axios/http.get
  const files = new Set(flows.map((f) => f.source.file));
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const hasFetch = /\bfetch\s*\(/.test(content) || /\baxios\.(get|post)\s*\(/.test(content) || /\bhttps?\.(get|request)\s*\(/.test(content);
    if (!hasFetch) continue;

    // Simple: if this file has event.* and fetch(urlVar), consider SSRF
    const urlVarMatch = content.match(/\b(?:fetch|axios\.get|https?\.get)\s*\(\s*(\w+)/);
    if (urlVarMatch) {
      const urlVar = urlVarMatch[1];
      const sourcesInFile = flows.filter((f) => f.source.file === file);
      for (const f of sourcesInFile) {
        // If the same file uses event.* and fetch(something), naive: assume URL could come from event
        if (f.source.kind === "api-gateway") {
          result.push({
            ...f,
            vulnerability: "ssrf",
            reason: `User input (${f.source.expression}) in same handler as HTTP client; URL may be user-controlled — SSRF risk`,
          });
        }
      }
    }
  }
  return result;
}

export function tagVulnerabilities(flows: DataFlow[], rootDir: string): FlowWithVulnerability[] {
  const injection = tagInjection(flows);
  const ssrf = tagSSRF(flows, rootDir);
  const byFlowKey = (f: FlowWithVulnerability) =>
    `${f.source.file}:${f.source.line}-${f.sink.file}:${f.sink.line}-${f.vulnerability}`;
  const seen = new Set<string>();
  const combined: FlowWithVulnerability[] = [];
  for (const f of [...injection, ...ssrf]) {
    const key = byFlowKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(f);
  }
  return combined;
}

export function filterByVulnerability(
  vulnerableFlows: FlowWithVulnerability[],
  type: VulnerabilityType | "all"
): FlowWithVulnerability[] {
  if (type === "all") return vulnerableFlows;
  return vulnerableFlows.filter((f) => f.vulnerability === type);
}
