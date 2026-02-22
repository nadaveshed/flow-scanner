#!/usr/bin/env node
/**
 * Flow scanner: finds data flows from API Gateway / Lambda (sources) to DynamoDB (sinks).
 * Optionally filters by OWASP vulnerability (injection, SSRF).
 *
 * Usage:
 *   node dist/index.js [--target <path>] [--vulnerable-only] [--vuln injection|ssrf|all]
 *
 * Default target: ./demo-app (clone of serverless-typescript-demo src)
 */

import * as path from "path";
import * as fs from "fs";
import { findSourcesInDir } from "./sources.js";
import { findSinksInDir } from "./sinks.js";
import { linkFlows } from "./flows.js";
import { tagVulnerabilities, filterByVulnerability } from "./vulnerabilities.js";
import type { DataFlow, FlowWithVulnerability, VulnerabilityType } from "./types.js";

const DEFAULT_TARGET = path.join(process.cwd(), "demo-app", "src");

function parseArgs(): {
  target: string;
  vulnerableOnly: boolean;
  vuln: VulnerabilityType | "all";
} {
  const args = process.argv.slice(2);
  let target = DEFAULT_TARGET;
  let vulnerableOnly = false;
  let vuln: VulnerabilityType | "all" = "all";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && args[i + 1]) {
      target = path.resolve(args[++i]);
    } else if (args[i] === "--vulnerable-only") {
      vulnerableOnly = true;
    } else if (args[i] === "--vuln" && args[i + 1]) {
      const v = args[++i].toLowerCase();
      if (v === "injection" || v === "ssrf" || v === "all") vuln = v;
    }
  }

  return { target, vulnerableOnly, vuln };
}

function main() {
  const { target, vulnerableOnly, vuln } = parseArgs();

  if (!fs.existsSync(target)) {
    console.error("Target directory not found:", target);
    console.error("Clone serverless-typescript-demo and copy src into demo-app/src, or pass --target <path>.");
    process.exit(1);
  }

  const sources = findSourcesInDir(target);
  const sinks = findSinksInDir(target);
  const flows = linkFlows(sources, sinks);

  console.log("=== Flow Scanner ===\n");
  console.log("Target:", target);
  console.log("Sources found:", sources.length);
  console.log("Sinks found:", sinks.length);
  console.log("Flows (source → sink):", flows.length);
  console.log("");

  if (vulnerableOnly) {
    const vulnerable = tagVulnerabilities(flows, target);
    const filtered = filterByVulnerability(vulnerable, vuln);
    console.log("--- Flows with OWASP vulnerability ---");
    console.log("Vulnerability filter:", vuln);
    console.log("Vulnerable flows:", filtered.length);
    console.log("");
    filtered.forEach((f: FlowWithVulnerability, i: number) => {
      console.log(`${i + 1}. [${f.vulnerability.toUpperCase()}] ${f.reason}`);
      console.log(`   Source: ${f.source.file}:${f.source.line}  ${f.source.expression}`);
      console.log(`   Sink:   ${f.sink.file}:${f.sink.line}  ${f.sink.expression}`);
      console.log(`   Link:   ${f.link}`);
      console.log("");
    });
  } else {
    console.log("--- All flows (source → DynamoDB) ---");
    flows.forEach((f: DataFlow, i: number) => {
      console.log(`${i + 1}. Source: ${f.source.file}:${f.source.line}  ${f.source.expression}`);
      console.log(`   Sink:   ${f.sink.file}:${f.sink.line}  ${f.sink.expression}`);
      console.log(`   Link:   ${f.link}`);
      console.log("");
    });
    console.log("Tip: use --vulnerable-only --vuln injection to show only flows with injection risk.");
  }
}

main();
