import fs from "fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync("services/GemmaService.ts", "utf8");

assert(source.includes("NPO_INSIGHT_CACHE_TTL_MS = 12 * 60 * 60 * 1000"), "NPO insight drafts must have a 12h persistent cache TTL");
assert(source.includes("NPO_INSIGHT_STALE_TTL_MS = 48 * 60 * 60 * 1000"), "NPO insight drafts must allow stale fallback during Gemma failures");
assert(source.includes("private inFlight = new Map"), "Gemma service must dedupe identical in-flight requests");
assert(source.includes("GEMMA_CIRCUIT_FAILURE_THRESHOLD = 3"), "Gemma service must open a circuit after repeated failures");
assert(source.includes("this.registerGemmaFailure()"), "Gemma failures must be tracked for circuit breaker protection");
assert(source.includes("readNPOInsightCache(cacheKey, NPO_INSIGHT_CACHE_TTL_MS)"), "NPO insight drafts must read fresh cache before calling Edge");
assert(source.includes("readNPOInsightCache(cacheKey, NPO_INSIGHT_STALE_TTL_MS)"), "NPO insight drafts must fall back to stale cache on Edge failure");
assert(source.includes("writeNPOInsightCache(cacheKey, result)"), "NPO insight drafts must persist successful Edge responses");

console.log("PASS Gemma invocation guard contract validated");
