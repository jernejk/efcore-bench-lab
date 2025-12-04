/**
 * Utility functions for formatting time and size values in a human-readable way
 */

/**
 * Formats duration in milliseconds to the most appropriate unit
 * Examples: 209347.99 ms → "3.49 min", 5000 ms → "5.00 s", 150 ms → "150 ms"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    // Less than 1 second - show as milliseconds
    return formatNumber(ms, 'ms');
  } else if (ms < 60000) {
    // Less than 1 minute - show as seconds
    const seconds = ms / 1000;
    return formatNumber(seconds, 's');
  } else if (ms < 3600000) {
    // Less than 1 hour - show as minutes
    const minutes = ms / 60000;
    return formatNumber(minutes, 'min');
  } else {
    // 1 hour or more - show as hours
    const hours = ms / 3600000;
    return formatNumber(hours, 'h');
  }
}

/**
 * Formats bytes to the most appropriate unit
 * Examples: 8113850 → "7.73 GB", 1024 → "1.00 KB", 512 → "512 B"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = bytes / Math.pow(k, i);
  return formatNumber(value, units[i]);
}

/**
 * Formats a number with appropriate decimal places based on its magnitude
 * - Small numbers (0-9.99): x.xx format (1.77)
 * - Medium numbers (10-99.9): xx.x format (14.5)
 * - Large numbers (100+): xxx format (230)
 */
export function formatNumber(value: number, unit: string = ""): string {
  const absValue = Math.abs(value);

  let formatted: string;
  if (absValue >= 100) {
    // Large numbers - no decimals
    formatted = Math.round(value).toString();
  } else if (absValue >= 10) {
    // Medium numbers - 1 decimal place
    formatted = value.toFixed(1);
  } else {
    // Small numbers - 2 decimal places
    formatted = value.toFixed(2);
  }

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use formatBytes instead
 */
export function formatBytesLegacy(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
