# Flow Scanner: How It Works

## What We're Doing

We find **data flows**: where does user input from the API end up? Specifically:

- **Sources** = where data comes in (the HTTP request: path, body, query params, or the raw event).
- **Sinks** = where data goes out (in this app, DynamoDB: reading or writing products).

The goal is to list each path from "user sent this" to "we used it here."

---

## How We Do It

### 1. Find the sources

We scan the code for places that touch the API Gateway event: things like `event.pathParameters`, `event.body`, `event.queryStringParameters`, or the whole `event` when it’s passed around. Those are our **sources**.

### 2. Find the sinks

We look for calls that hit DynamoDB. In this demo app that means store methods like `store.getProduct(id)`, `store.putProduct(product)`, `store.deleteProduct(...)`, `store.getProducts(...)`. Those are our **sinks**.

### 3. Connect them

For each sink, we ask: could any of its arguments have come from a source? We use simple rules (e.g. same variable name, or "id" from the path used in `getProduct(id)`). We do **not** do full program analysis—just pattern-based linking so the tool stays simple and easy to change.

### 4. What you get

A list of **flows**: each one is a path from a source (e.g. "path param `id`") to a sink (e.g. "DynamoDB `getProduct(id)`").

---

## Choices We Made

- **Simple patterns, not a full parser.** We use regex and line-based patterns to spot sources and sinks, and simple heuristics to link them. A heavier tool would use a full JavaScript/TypeScript parser and proper data-flow analysis; we kept it lightweight on purpose.

- **Infrastructure (CDK) is optional.** We could later read the CDK stack to map API routes to Lambda handlers and label flows (e.g. "GET /products/{id} → get-product → DynamoDB"). For now the scanner works on the `src/` code alone.

- **One app, one repo.** The design assumes a single codebase. Supporting many repos would mean running the scanner per repo and merging the results.

---

## What We Assume

- **Sources:** Only Lambdas triggered by API Gateway (the event looks like an HTTP request). We treat `event.pathParameters`, `event.body`, `event.queryStringParameters`, and `event` itself as source locations.

- **Sinks:** Only DynamoDB: the store methods above, or the underlying DynamoDB commands (Get, Put, Delete, Scan, Query). We assume the store is backed by DynamoDB.

- **When a flow "exists":** If we can connect a source expression (e.g. `event.pathParameters.id`) to a sink argument (e.g. `id` in `store.getProduct(id)`) with our heuristics, we report it. We don’t require full proof that the value actually flows at runtime.

---

## Step 2: Vulnerability Filtering

We tag flows by **risk type** and let you filter the list.

### Two risk types we care about

1. **Injection**  
   User input (path, body, or query) reaches DynamoDB (or another place that runs or stores data) without us detecting any sanitization. So we flag: "untrusted data might be used as-is."

2. **SSRF (Server-Side Request Forgery)**  
   User input is used as a URL or passed to an HTTP client (e.g. `fetch(url)` where `url` comes from the event). So we flag: "the app might make HTTP requests to a user-controlled address."

### How you use it

A CLI option (e.g. `--vulnerable-only --vuln injection`) limits the report to flows that match the chosen risk type.

We still use simple patterns (e.g. "argument to `store.getProduct(...)` comes from `event.pathParameters`" for injection, and "argument to `fetch(...)` from event" for SSRF). We don’t do full taint or sanitization analysis—so results are "might be vulnerable," not "is definitely vulnerable."
