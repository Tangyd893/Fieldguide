/**
 * Spike: Programmatic pipeline — generates knowledge-graph.json for tiny-go.
 *
 * Uses @understand-anything/core GraphBuilder + saveGraph.
 * This exercises the same API Fieldguide will call from main process.
 *
 * Usage:
 *   node scripts/spike-generate-graph.mjs
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fieldguideRoot = resolve(__dirname, '..');
const fixtureRoot = resolve(fieldguideRoot, 'tests/fixtures/tiny-go');

// Resolve UA core from the cloned repo
const uaPluginRoot = resolve(fieldguideRoot, '..', 'Understand-Anything', 'understand-anything-plugin');
const require_ = createRequire(resolve(uaPluginRoot, 'package.json'));

let core;
try {
  core = await import(pathToFileURL(require_.resolve('@understand-anything/core')).href);
} catch {
  core = await import(pathToFileURL(resolve(uaPluginRoot, 'packages/core/dist/index.js')).href);
}

const { GraphBuilder, saveGraph, loadGraph } = core;

// Build knowledge graph using actual UA API
const builder = new GraphBuilder('tiny-go', '', undefined);

// --- cmd/main.go ---
builder.addFileWithAnalysis('cmd/main.go', {
  functions: [{ name: 'main', lineRange: [12, 21], params: [] }],
  classes: [],
  imports: [
    { source: 'internal/service', specifiers: ['service'], lineNumber: 7 },
    { source: 'internal/store', specifiers: ['store'], lineNumber: 8 },
  ],
  exports: [],
}, {
  summary: 'Entry point - starts HTTP server',
  tags: ['entry', 'http', 'server'],
  complexity: 'moderate',
  summaries: { main: 'Entry point: creates DB, handler, and starts HTTP server on :8080' },
  fileSummary: 'Main entry point that wires together store, service, and HTTP server',
});

// --- internal/service/handler.go ---
builder.addFileWithAnalysis('internal/service/handler.go', {
  functions: [
    { name: 'NewHandler', lineRange: [17, 19], params: ['db'] },
    { name: 'Hello', lineRange: [22, 28], params: ['w', 'r'] },
    { name: 'ListItems', lineRange: [31, 35], params: ['w', 'r'] },
  ],
  classes: [{ name: 'Handler', lineRange: [12, 14], methods: ['Hello', 'ListItems'], properties: ['db'] }],
  imports: [
    { source: 'internal/store', specifiers: ['store'], lineNumber: 7 },
  ],
  exports: [
    { name: 'Handler', lineNumber: 12 },
    { name: 'NewHandler', lineNumber: 17 },
    { name: 'Hello', lineNumber: 22 },
    { name: 'ListItems', lineNumber: 31 },
  ],
}, {
  summary: 'HTTP handlers for hello and items endpoints',
  tags: ['http', 'handler', 'service'],
  complexity: 'moderate',
  summaries: {
    NewHandler: 'Constructor: creates a Handler with the given DB',
    Hello: 'GET /hello - responds with a greeting',
    ListItems: 'GET /items - returns all stored items as JSON',
    Handler: 'HTTP handler struct that wraps the data store',
  },
  fileSummary: 'Service layer with HTTP handlers for hello and items endpoints',
});

// --- internal/store/db.go ---
builder.addFileWithAnalysis('internal/store/db.go', {
  functions: [
    { name: 'NewDB', lineRange: [18, 26], params: ['name'] },
    { name: 'All', lineRange: [29, 34], params: [] },
  ],
  classes: [{ name: 'DB', lineRange: [13, 16], methods: ['All'], properties: ['mu', 'items'] }],
  imports: [],
  exports: [
    { name: 'Item', lineNumber: 6 },
    { name: 'DB', lineNumber: 13 },
    { name: 'NewDB', lineNumber: 18 },
    { name: 'All', lineNumber: 29 },
  ],
}, {
  summary: 'In-memory data store with thread-safe access',
  tags: ['store', 'data', 'memory'],
  complexity: 'low',
  summaries: {
    DB: 'Thread-safe in-memory data store with RWMutex',
    NewDB: 'Constructor: creates a new DB with initial items',
    All: 'Returns a thread-safe copy of all stored items',
    Item: 'Data model: a stored record with ID and Value',
  },
  fileSummary: 'Simple in-memory data store layer',
});

// --- go.mod (non-code) ---
builder.addNonCodeFile('go.mod', {
  nodeType: 'config',
  summary: 'Go module definition for tiny-go',
  tags: ['go', 'module', 'config'],
  complexity: 'simple',
});

// Edges
builder.addImportEdge('cmd/main.go', 'internal/service/handler.go');
builder.addImportEdge('cmd/main.go', 'internal/store/db.go');
builder.addImportEdge('internal/service/handler.go', 'internal/store/db.go');

// Call edges (from Tree-sitter extracted data)
builder.addCallEdge('cmd/main.go', 'main', 'internal/store/db.go', 'NewDB');
builder.addCallEdge('cmd/main.go', 'main', 'internal/service/handler.go', 'NewHandler');
builder.addCallEdge('internal/service/handler.go', 'ListItems', 'internal/store/db.go', 'All');

const graph = builder.build();

// Write via UA persistence
saveGraph(fixtureRoot, graph);
console.log(`✅ knowledge-graph.json written to ${fixtureRoot}/.understand-anything/`);
console.log(`   Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);

// Verify round-trip with schema validation
try {
  const reloaded = loadGraph(fixtureRoot);
  if (!reloaded) {
    console.error('❌ Round-trip load failed: null');
    process.exit(1);
  }
  console.log(`   Round-trip load: ${reloaded.nodes.length} nodes (schema validated ✅)`);
} catch (err) {
  console.error('❌ Round-trip validation failed:', err.message);
  process.exit(1);
}

// Print node summary
for (const n of graph.nodes.slice(0, 12)) {
  console.log(`   [${n.type}] ${n.id} — "${n.name}"`);
}
if (graph.nodes.length > 12) console.log(`   ... +${graph.nodes.length - 12} more nodes`);
