/**
 * Link sources to sinks in the same file (naive: same variable name or body → putProduct).
 */

import type { DataFlow, Source, Sink } from "./types.js";

export function linkFlows(sources: Source[], sinks: Sink[]): DataFlow[] {
  const flows: DataFlow[] = [];

  for (const sink of sinks) {
    const sameFileSources = sources.filter((s) => s.file === sink.file);
    for (const source of sameFileSources) {
      const link = linkReason(source, sink);
      if (link) {
        flows.push({ source, sink, link });
      }
    }
  }

  return flows;
}

function linkReason(source: Source, sink: Sink): string | null {
  // event.body → putProduct(product) where product = JSON.parse(event.body)
  if (source.name === "body" && sink.method === "putProduct") {
    return "event.body parsed and passed to putProduct (request body → DynamoDB item)";
  }
  // event.pathParameters.id → getProduct(id), deleteProduct(id), or putProduct (id in path)
  if (source.name === "id" && sink.args.some((a) => a === "id")) {
    return "path parameter 'id' used as DynamoDB key argument";
  }
  if (source.name === "id" && sink.method === "putProduct" && sink.args.some((a) => a === "product")) {
    return "path parameter 'id' used in same handler as putProduct (id may constrain product)";
  }
  // Generic: same variable name
  if (sink.args.includes(source.name)) {
    return `same variable: ${source.name}`;
  }
  if (source.name === "event" && sink.args.length > 0) {
    return "event (whole) in same handler as DynamoDB call";
  }
  return null;
}
