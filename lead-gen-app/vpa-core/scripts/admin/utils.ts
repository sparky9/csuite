/**
 * Admin CLI Utilities
 * Shared functions for all admin tools
 */

import readline from 'readline';

/**
 * Prompt user for input
 */
export async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for number input with validation
 */
export async function promptNumber(question: string, min?: number, max?: number): Promise<number> {
  while (true) {
    const answer = await prompt(question);
    const num = parseInt(answer);

    if (isNaN(num)) {
      console.log('❌ Please enter a valid number');
      continue;
    }

    if (min !== undefined && num < min) {
      console.log(`❌ Number must be at least ${min}`);
      continue;
    }

    if (max !== undefined && num > max) {
      console.log(`❌ Number must be at most ${max}`);
      continue;
    }

    return num;
  }
}

/**
 * Prompt for yes/no confirmation
 */
export async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * Format currency (cents to dollars)
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format relative time (e.g., "3 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Print a divider line
 */
export function divider(char: string = '━', length: number = 60) {
  console.log(char.repeat(length));
}

/**
 * Print section header
 */
export function header(title: string) {
  console.log('\n');
  divider();
  console.log(`  ${title}`);
  divider();
  console.log();
}

/**
 * Print success message
 */
export function success(message: string) {
  console.log(`\n✅ ${message}\n`);
}

/**
 * Print error message
 */
export function error(message: string) {
  console.log(`\n❌ ${message}\n`);
}

/**
 * Print warning message
 */
export function warning(message: string) {
  console.log(`\n⚠️  ${message}\n`);
}

/**
 * Print info message
 */
export function info(message: string) {
  console.log(`ℹ️  ${message}`);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate a random license key
 */
export function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    const segment = Math.random().toString(36).substring(2, 6).toUpperCase();
    segments.push(segment);
  }
  return `VPA-${segments.join('-')}`;
}

/**
 * Format table row
 */
export function tableRow(columns: string[], widths: number[]): string {
  return columns.map((col, i) => {
    const width = widths[i];
    if (col.length > width) {
      return col.substring(0, width - 3) + '...';
    }
    return col.padEnd(width);
  }).join(' | ');
}

/**
 * Print table
 */
export function printTable(headers: string[], rows: string[][], widths: number[]) {
  // Print header
  console.log(tableRow(headers, widths));
  console.log(widths.map(w => '─'.repeat(w)).join('─┼─'));

  // Print rows
  rows.forEach(row => {
    console.log(tableRow(row, widths));
  });
}

/**
 * Export data to CSV
 */
export function exportToCsv(headers: string[], rows: string[][]): string {
  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ];
  return csvRows.join('\n');
}

/**
 * Calculate percentage
 */
export function percentage(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}
