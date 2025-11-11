/**
 * Scraper interfaces and configuration types
 */

export type Browser = any;
export type Page = any;

export interface ScraperConfig {
  headless: boolean;
  timeout_ms: number;
  max_retries: number;
  retry_delay_ms: number;
  use_stealth: boolean;
  user_agent?: string;
}

export interface ProxyConfig {
  provider: string;
  rotation_strategy: 'round_robin' | 'random' | 'least_used';
  proxies: ProxyServer[];
  health_check_interval_minutes: number;
  max_failures_before_disable: number;
}

export interface ProxyServer {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
  country?: string;
  last_used: Date | null;
  failure_count: number;
  enabled: boolean;
}

export interface RateLimitConfig {
  yellow_pages: RateLimitRules;
  google_maps: RateLimitRules;
  linkedin_company: RateLimitRules;
  linkedin_people: RateLimitRules;
  email_finder: RateLimitRules;
}

export interface RateLimitRules {
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  concurrent_browsers: number;
  cooldown_on_limit_ms?: number;
}

export interface BrowserInstance {
  id: string;
  browser: Browser;
  page: Page;
  proxy: ProxyServer | null;
  in_use: boolean;
  created_at: Date;
  last_used: Date;
  request_count: number;
}

export interface ScraperResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  retry_count: number;
  duration_ms: number;
  proxy_used?: string;
}

export interface BaseScraper<TParams, TResult> {
  scrape(params: TParams): Promise<ScraperResult<TResult>>;
  validateParams(params: TParams): boolean;
  getRateLimits(): RateLimitRules;
}
