/**
 * Naive sink detection: DynamoDB access (store methods or SDK commands).
 */

import * as fs from "fs";
import * as path from "path";
import type { Sink } from "./types.js";

// store.getProduct(id), store.putProduct(product), store.deleteProduct(id), store.getProducts()
const STORE_METHOD_REGEX =
  /(?:store|[\w]+Store)\s*\.\s*(getProduct|putProduct|deleteProduct|getProducts)\s*\(\s*([^)]*)\s*\)/g;

// Extract argument variable names from the args string: "id" -> [id], "product" -> [product], "id, opts" -> [id, opts]
function parseArgs(argsStr: string): string[] {
  return argsStr
    .split(",")
    .map((s) => s.trim().replace(/\s*$/, ""))
    .map((s) => {
      const m = s.match(/^(\w+)/);
      return m ? m[1] : s;
    })
    .filter(Boolean);
}

export function findSinksInFile(filePath: string, content: string): Sink[] {
  const sinks: Sink[] = [];
  let m: RegExpExecArray | null;
  const regex = new RegExp(STORE_METHOD_REGEX.source, STORE_METHOD_REGEX.flags);
  while ((m = regex.exec(content)) !== null) {
    const lineNum = content.slice(0, m.index).split("\n").length;
    const method = m[1];
    const argsStr = m[2];
    const args = parseArgs(argsStr);
    sinks.push({
      kind: "dynamodb",
      file: filePath,
      line: lineNum,
      expression: m[0],
      method,
      args,
    });
  }
  return sinks;
}

export function findSinksInDir(dir: string, ext: string[] = [".ts", ".js"]): Sink[] {
  const sinks: Sink[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
      sinks.push(...findSinksInDir(full, ext));
    } else if (e.isFile() && ext.some((x) => e.name.endsWith(x))) {
      const content = fs.readFileSync(full, "utf-8");
      sinks.push(...findSinksInFile(full, content));
    }
  }

  return sinks;
}
