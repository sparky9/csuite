declare module 'csv-parse/sync' {
  interface ParseOptions {
    columns?: boolean | string[];
    skip_empty_lines?: boolean;
    trim?: boolean;
    [key: string]: unknown;
  }

  export function parse<T = any>(input: string, options?: ParseOptions): T[];
}
