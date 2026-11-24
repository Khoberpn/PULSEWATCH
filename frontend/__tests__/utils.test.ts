import { formatLatency, formatDuration, formatRelativeTime, getStatusBadgeVariant } from "../src/lib/utils";

// Unit test assertions
function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${message} - Expected: ${expected}, Got: ${actual}`);
  }
}

console.log("Running Frontend Unit Tests...");

// 1. Latency formatting
assertEqual(formatLatency(null), "—", "formatLatency(null) should return em-dash");
assertEqual(formatLatency(undefined), "—", "formatLatency(undefined) should return em-dash");
assertEqual(formatLatency(0.4), "< 1 ms", "formatLatency(<1) should return < 1 ms");
assertEqual(formatLatency(150), "150 ms", "formatLatency(150) should return 150 ms");
assertEqual(formatLatency(1550), "1.55 s", "formatLatency(1550) should return 1.55 s");

// 2. Duration formatting
assertEqual(formatDuration(null), "Ongoing", "formatDuration(null) should return Ongoing");
assertEqual(formatDuration(45), "45s", "formatDuration(45) should return 45s");
assertEqual(formatDuration(125), "2m 5s", "formatDuration(125) should return 2m 5s");
assertEqual(formatDuration(3665), "1h 1m", "formatDuration(3665) should return 1h 1m");

// 3. Status badge variants
const upVariant = getStatusBadgeVariant("UP", true);
assertEqual(upVariant.label, "OPERATIONAL", "UP status label should be OPERATIONAL");

const degradedVariant = getStatusBadgeVariant("DEGRADED", true);
assertEqual(degradedVariant.label, "DEGRADED", "DEGRADED status label should be DEGRADED");

const downVariant = getStatusBadgeVariant("DOWN", true);
assertEqual(downVariant.label, "DOWN", "DOWN status label should be DOWN");

const pausedVariant = getStatusBadgeVariant("UP", false);
assertEqual(pausedVariant.label, "PAUSED", "Disabled monitor should return PAUSED");

console.log("ALL 12 FRONTEND UTILITY AND COMPONENT ASSERTIONS PASSED!");
