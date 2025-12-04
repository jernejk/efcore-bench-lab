// Test file for format utilities (can be run in browser console for testing)
import { formatDuration, formatBytes, formatNumber } from './format-utils';

// Test data
const testCases = {
  duration: [
    { input: 150, expected: "150 ms" },
    { input: 5000, expected: "5.00 s" },
    { input: 209347.99, expected: "3.49 min" },
    { input: 3600000, expected: "1.00 h" },
  ],
  bytes: [
    { input: 512, expected: "512 B" },
    { input: 1024, expected: "1.00 KB" },
    { input: 8113850, expected: "7.73 GB" },
    { input: 0, expected: "0 B" },
  ],
  numbers: [
    { input: 1.77, expected: "1.77" },
    { input: 14.5, expected: "14.5" },
    { input: 230, expected: "230" },
    { input: 999, expected: "999" },
  ]
};

// Console test function
export function testFormatUtils() {
  console.log("Testing formatDuration:");
  testCases.duration.forEach(({ input, expected }) => {
    const result = formatDuration(input);
    console.log(`${input}ms -> ${result} ${result === expected ? '✅' : '❌ (expected: ' + expected + ')'}`);
  });

  console.log("\nTesting formatBytes:");
  testCases.bytes.forEach(({ input, expected }) => {
    const result = formatBytes(input);
    console.log(`${input} bytes -> ${result} ${result === expected ? '✅' : '❌ (expected: ' + expected + ')'}`);
  });

  console.log("\nTesting formatNumber:");
  testCases.numbers.forEach(({ input, expected }) => {
    const result = formatNumber(input);
    console.log(`${input} -> ${result} ${result === expected ? '✅' : '❌ (expected: ' + expected + ')'}`);
  });
}
