# Flow Scanner: Source-to-Sink Data Flow Analysis

## Goal

Identify execution graphs (data flows) from **external sources** to **pre-defined sinks** in the [serverless-typescript-demo](https://github.com/aws-samples/serverless-typescript-demo) app.

- **Sources:** API Gateway (HTTP request) or Lambda entry (event)
- **Sinks:** DynamoDB (read/write operations)

## Planned Solution

### Approach

1. **Static analysis over source code**  
   We treat the repo as a set of TypeScript/JavaScript files and build a **naive** flow graph by:
   - **Source detection:** Finding where external input enters (API Gateway event: `event.pathParameters`, `event.body`, `event.queryStringParameters`, etc., or Lambda handler `event`).
   - **Sink detection:** Finding calls that reach DynamoDB (e.g. `GetCommand`, `PutCommand`, `DeleteCommand`, `ScanCommand`, `QueryCommand`, or wrapper methods like `store.getProduct(id)`, `store.putProduct(product)`).
   - **Flow construction:** For each sink, we trace back whether any of its arguments (or the object passed to it) can be derived from a source (same file or via simple cross-file references). We do **not** implement full taint analysis; we use pattern-based heuristics (e.g. “this identifier is assigned from `event.pathParameters.id`”).

2. **Output**  
   A list of **flows**: each flow is a path from a source (e.g. “API Gateway → Lambda → `event.pathParameters.id`”) to a sink (e.g. “DynamoDB `getProduct(id)`”).

### Decisions

- **No full AST/CFG:** To keep the scanner “naive” and easy to extend, we use **regex and line-based patterns** to detect sources and sinks, plus simple heuristics to link them (e.g. same variable name, or “id” used in both event and store call). A production tool would use a proper JS/TS parser and data-flow analysis.
- **CDK/Infra as optional input:** We can optionally parse the CDK stack (`lib/serverless-typescript-demo-stack.ts`) to map API routes → Lambda handlers and Lambda → DynamoDB permissions, which helps label flows (e.g. “GET /products/{id} → get-product → DynamoDB”). The naive scanner can still work on `src/` only.
- **Single repo, single app:** The implementation assumes one codebase (the demo app). Extending to multiple repos would require a small wrapper that runs the scanner per repo and merges results.

### Assumptions

- **Sources:** Only API Gateway–triggered Lambdas (event shaped as `APIGatewayProxyEvent`). We consider as source locations: `event.pathParameters`, `event.body`, `event.queryStringParameters`, and `event` itself when passed to a function that eventually uses it.
- **Sinks:** Only DynamoDB usage: `GetCommand`, `PutCommand`, `DeleteCommand`, `ScanCommand`, `QueryCommand`, or any call to a method named like `getProduct`, `putProduct`, `deleteProduct`, `getProducts` on a store object. We assume the store implementation is DynamoDB (e.g. `DynamoDbStore`).
- **Flows:** A flow “exists” if we can heuristically connect a source expression (e.g. `event.pathParameters.id`) to a sink argument (e.g. `id` in `store.getProduct(id)` or `product` in `store.putProduct(product)` where `product` comes from `event.body`). We do not require full def-use chains.
- **Step 2 – Vulnerabilities:** We add **OWASP Top 10**–style checks (e.g. **Injection** or **SSRF**). A flow is “vulnerable” if untrusted data from a source reaches a sink **without** proper validation/sanitization (e.g. path parameter `id` used in DynamoDB key or in a URL for SSRF). The scanner will optionally **filter** to report only flows that are tagged as potentially vulnerable.

---

## Step 2: OWASP Vulnerability Filtering

We extend the scanner to:

1. **Classify flows** with a simple vulnerability model, e.g.:
   - **Injection (A03:2021):** Source (e.g. `event.pathParameters.id`, `event.body`) → DynamoDB key/item or any string used in a query. We consider a flow “injection-prone” if user input reaches a DynamoDB API or a dynamic string used for execution (simplified: no sanitization detected).
   - **SSRF (A10:2021):** Source → URL or HTTP client (e.g. `fetch(url)` where `url` is from event). We tag flows where user input is used as URL/host.

2. **Filter:** A CLI flag or option (e.g. `--vulnerable-only` or `--vuln injection`) restricts the reported flows to those that contain the selected vulnerability type.

Implementation stays naive: we use patterns (e.g. “argument to `store.getProduct(...)` comes from `event.pathParameters`”) to tag flows as injection-relevant, and “argument to `fetch(...)` or `http.get(...)` from event” for SSRF, without full taint or sanitization analysis.
