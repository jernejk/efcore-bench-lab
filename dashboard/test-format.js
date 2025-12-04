// Simple test for format utilities
function formatDuration(ms) {
  if (ms < 1000) {
    return formatNumber(ms, 'ms');
  } else if (ms < 60000) {
    const seconds = ms / 1000;
    return formatNumber(seconds, 's');
  } else if (ms < 3600000) {
    const minutes = ms / 60000;
    return formatNumber(minutes, 'min');
  } else {
    const hours = ms / 3600000;
    return formatNumber(hours, 'h');
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = bytes / Math.pow(k, i);
  return formatNumber(value, units[i]);
}

function formatNumber(value, unit = "") {
  const absValue = Math.abs(value);

  let formatted;
  if (absValue >= 100) {
    formatted = Math.round(value).toString();
  } else if (absValue >= 10) {
    formatted = value.toFixed(1);
  } else {
    formatted = value.toFixed(2);
  }

  return unit ? `${formatted} ${unit}` : formatted;
}

// Test examples from user request
console.log('Duration formatting examples:');
console.log('209347.99 ms ->', formatDuration(209347.99));
console.log('5000 ms ->', formatDuration(5000));
console.log('150 ms ->', formatDuration(150));
console.log('3600000 ms ->', formatDuration(3600000));

console.log('\nSize formatting examples:');
console.log('8113850 bytes ->', formatBytes(8113850));
console.log('1024 bytes ->', formatBytes(1024));
console.log('512 bytes ->', formatBytes(512));
console.log('1073741824 bytes ->', formatBytes(1073741824));

console.log('\nNumber formatting examples:');
console.log('1.77 ->', formatNumber(1.77));
console.log('14.5 ->', formatNumber(14.5));
console.log('230 ->', formatNumber(230));
console.log('999 ->', formatNumber(999));
