# Flow Scanner

A **naive** static scanner that finds data flows from **external sources** (API Gateway / Lambda event) to **pre-defined sinks** (DynamoDB) in the [serverless-typescript-demo](https://github.com/aws-samples/serverless-typescript-demo) style apps. It can filter flows by **OWASP Top 10** vulnerability (e.g. **Injection**, **SSRF**).

## Deliverables

- **SOLUTION.md** — Short written explanation of the planned solution (decisions, assumptions).
- **Implementation** — Naive scanner in this repo:
  - Detects **sources**: `event.pathParameters.*`, `event.body`, `event.queryStringParameters.*`, `event`.
  - Detects **sinks**: `store.getProduct`, `store.putProduct`, `store.deleteProduct`, `store.getProducts` (DynamoDB).
  - **Links** flows when the same variable/expression is used (e.g. path `id` → `store.getProduct(id)`).
- **Step 2** — OWASP vulnerability tagging and filtering:
  - **Injection (A03):** User input (path/body/query) → DynamoDB without sanitization.
  - **SSRF (A10):** User input in same handler as HTTP client (e.g. `fetch`).
  - CLI: `--vulnerable-only --vuln injection` or `--vuln ssrf` to show only vulnerable flows.

## Usage

1. **Build**
   ```bash
   npm install
   npm run build
   ```

2. **Scan** (default target: `./demo-app/src`)
   ```bash
   node dist/index.js
   ```

3. **Scan a different app**
   ```bash
   node dist/index.js --target /path/to/serverless-typescript-demo/src
   ```

4. **Show only flows with injection risk**
   ```bash
   node dist/index.js --vulnerable-only --vuln injection
   ```

5. **Show only flows with SSRF risk**
   ```bash
   node dist/index.js --vulnerable-only --vuln ssrf
   ```

## Demo app

The folder `demo-app/src` contains a minimal copy of the serverless-typescript-demo Lambda + store structure (API handlers and DynamoDB store) so you can run the scanner without cloning the full repo. To scan the real repo, clone it and pass:

```bash
node dist/index.js --target /path/to/serverless-typescript-demo/src
```

## Assumptions

- **Sources:** API Gateway–triggered Lambdas (`APIGatewayProxyEvent`); we look for `event.pathParameters`, `event.body`, `event.queryStringParameters`.
- **Sinks:** DynamoDB via store methods (`getProduct`, `putProduct`, `deleteProduct`, `getProducts`).
- **Linking:** Same-file, same-variable heuristics (no full taint analysis).
- **Vulnerabilities:** Naive tagging (e.g. any API Gateway → DynamoDB flow is injection-prone; SSRF if same file has `fetch`/axios and event).

See **SOLUTION.md** for full design and assumptions.
