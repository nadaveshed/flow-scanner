/**
 * Types for flow scanner: sources, sinks, and data flows.
 */

export type SourceKind = "api-gateway" | "lambda-event";

export interface Source {
  kind: SourceKind;
  file: string;
  line: number;
  /** e.g. event.pathParameters.id, event.body */
  expression: string;
  /** Extracted variable/field name for matching, e.g. "id", "body" */
  name: string;
}

export type SinkKind = "dynamodb";

export interface Sink {
  kind: SinkKind;
  file: string;
  line: number;
  /** e.g. store.getProduct(id) */
  expression: string;
  /** Method name: getProduct, putProduct, deleteProduct, getProducts */
  method: string;
  /** Argument names/variables used (e.g. ["id"] or ["product"]) */
  args: string[];
}

export interface DataFlow {
  source: Source;
  sink: Sink;
  /** How we linked them, e.g. "same variable: id" */
  link: string;
}

/** OWASP vulnerability categories we detect (naive). */
export type VulnerabilityType = "injection" | "ssrf";

export interface FlowWithVulnerability extends DataFlow {
  vulnerability: VulnerabilityType;
  /** Short reason, e.g. "User input (path param) used as DynamoDB key without sanitization" */
  reason: string;
}
