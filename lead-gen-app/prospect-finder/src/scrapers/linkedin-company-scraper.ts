/**
 * LinkedIn Company Scraper
 *
 * Searches LinkedIn for company pages and extracts company data.
 * IMPORTANT: LinkedIn has aggressive bot detection - use with caution.
 */

import { BaseScraper } from './base-scraper.js';
import { BrowserInstance } from '../types/scraper.types.js';
import { LinkedInCompanyResult } from '../types/prospect.types.js';
import { logger } from '../utils/logger.js';

export interface LinkedInCompanySearchParams {
  company_name: string;
}

export class LinkedInCompanyScraper extends BaseScraper<
  LinkedInCompanySearchParams,
  LinkedInCompanyResult | null
> {
  protected validateParams(params: LinkedInCompanySearchParams): boolean {
    return typeof params.company_name === 'string' && params.company_name.length > 0;
  }

  protected getRateLimitSource(): 'linkedin_company' {
    return 'linkedin_company';
  }

  protected async performScrape(
    params: LinkedInCompanySearchParams,
    browser: BrowserInstance
  ): Promise<LinkedInCompanyResult | null> {
    logger.info('Starting LinkedIn company scrape', {
      company_name: params.company_name,
    });

    try {
      // Navigate to LinkedIn company search
      const searchUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(params.company_name)}`;
      logger.debug('Navigating to LinkedIn search', { url: searchUrl });

      await browser.page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout,
      });

      // Longer delay for LinkedIn (more aggressive detection)
      await this.randomDelay(3000, 5000);

      // Check for login wall
      const isLoginPage = await browser.page.locator('text=/sign in/i').count() > 0;
      if (isLoginPage) {
        logger.warn('LinkedIn login wall detected - cannot scrape without authentication');
        return null;
      }

      // Wait for search results
      try {
        await browser.page.waitForSelector('.search-results-container', { timeout: 10000 });
      } catch (error) {
        logger.warn('Search results container not found');
        return null;
      }

      // Find the first company result
      const firstResult = browser.page.locator('.search-results-container .entity-result').first();
      const resultCount = await browser.page.locator('.entity-result').count();

      if (resultCount === 0) {
        logger.info('No company results found', { company_name: params.company_name });
        return null;
      }

      // Extract company URL from first result
      let companyUrl: string | null = null;
      try {
        const linkElement = firstResult.locator('a.app-aware-link').first();
        const href = await linkElement.getAttribute('href');
        if (href && href.includes('/company/')) {
          companyUrl = href.split('?')[0]; // Remove query params
        }
      } catch (error) {
        logger.error('Could not extract company URL from search results');
        return null;
      }

      if (!companyUrl) {
        logger.warn('No company URL found in search results');
        return null;
      }

      logger.debug('Found company URL', { url: companyUrl });

      // Navigate to company page
      await browser.page.goto(companyUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout,
      });

      await this.randomDelay(3000, 5000);

      // Check for login wall again
      const isLoginPageAgain = await browser.page.locator('text=/sign in/i').count() > 0;
      if (isLoginPageAgain) {
        logger.warn('LinkedIn login wall on company page - returning partial data');
        return {
          name: params.company_name,
          linkedin_url: companyUrl,
          industry: null,
          employee_count: null,
          website: null,
          description: null,
          follower_count: null,
          employee_range: null,
          employee_growth_pct: null,
          recent_posts: [],
          insights: [],
          summary: null,
        };
      }

      // Extract company data
      const result: LinkedInCompanyResult = {
        name: params.company_name,
        linkedin_url: companyUrl,
        industry: null,
        employee_count: null,
        website: null,
        description: null,
        follower_count: null,
        employee_range: null,
        employee_growth_pct: null,
        recent_posts: [],
        insights: [],
        summary: null,
      };

      // Extract company name (more accurate from page)
      try {
        const nameElement = browser.page.locator('h1').first();
        const name = await nameElement.textContent();
        if (name) {
          result.name = name.trim();
        }
      } catch (error) {
        logger.debug('Could not extract company name from page');
      }

      // Extract employee count
      try {
        const employeeText = await browser.page
          .locator('text=/\\d+[,\\d]*\\s+(employees|employee)/i')
          .first()
          .textContent();

        if (employeeText) {
          const match = employeeText.match(/([\\d,]+)\\s+(employees|employee)/i);
          if (match) {
            const countStr = match[1].replace(/,/g, '');
            result.employee_count = parseInt(countStr, 10);
          }
        }
      } catch (error) {
        logger.debug('Could not extract employee count');
      }

      // Extract industry
      try {
        // Look for industry in the about section
        const industryElement = browser.page.locator('text=/Industry/i').first();
        const parent = industryElement.locator('..');
        const industryText = await parent.textContent();

        if (industryText) {
          const match = industryText.match(/Industry\\s*(.+)/i);
          if (match) {
            result.industry = match[1].trim();
          }
        }
      } catch (error) {
        logger.debug('Could not extract industry');
      }

      // Extract website
      try {
        const websiteLink = browser.page.locator('a[href*="http"]:has-text("Website")').first();
        const href = await websiteLink.getAttribute('href');
        if (href && this.isValidUrl(href)) {
          result.website = href;
        }
      } catch (error) {
        // Try alternative method
        try {
          const websiteLink = browser.page
            .locator('a[data-tracking-control-name*="website"]')
            .first();
          const href = await websiteLink.getAttribute('href');
          if (href && this.isValidUrl(href)) {
            result.website = href;
          }
        } catch (innerError) {
          logger.debug('Could not extract website');
        }
      }

      // Extract description/about
      try {
        const aboutSection = browser.page.locator('section:has-text("About")').first();
        const descElement = aboutSection.locator('p').first();
        const description = await descElement.textContent();
        if (description) {
          result.description = description.trim().substring(0, 500); // Limit to 500 chars
        }
      } catch (error) {
        logger.debug('Could not extract description');
      }

      // Follower count
      try {
        const followerText = await browser.page
          .locator('text=/followers/i')
          .first()
          .textContent();
        if (followerText) {
          const match = followerText.match(/([\d,.]+)\s+followers/i);
          if (match) {
            result.follower_count = Number.parseInt(match[1].replace(/,/g, ''), 10);
          }
        }
      } catch (error) {
        logger.debug('Could not extract follower count');
      }

      // Employee range text (e.g., 51-200 employees)
      try {
        const rangeText = await browser.page
          .locator('text=/employees/i')
          .first()
          .textContent();
        if (rangeText) {
          const match = rangeText.match(/([\d,]+\s*-\s*[\d,]+\s*employees)/i);
          if (match) {
            result.employee_range = match[1].replace(/\s+/g, ' ').trim();
          }
        }
      } catch (error) {
        logger.debug('Could not extract employee range');
      }

      // Growth percentage (e.g., 18% increase)
      try {
        const growthText = await browser.page
          .locator('text=\% increase, text=\% decrease, text=/growth/i')
          .first()
          .textContent();
        if (growthText) {
          const match = growthText.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
          if (match) {
            result.employee_growth_pct = Number.parseFloat(match[1]);
          }
        }
      } catch (error) {
        logger.debug('Could not extract headcount growth');
      }

      // Recent posts (captures first three headlines)
      try {
        const postsSection = browser.page.locator('section').filter({ hasText: 'Posts' }).first();
        if (await postsSection.count()) {
          type PostPreview = {
            title: string;
            url: string | null;
            age: string | null;
          };

          const posts = (await postsSection
            .locator('article')
            .evaluateAll((nodes: Element[]) =>
              nodes.slice(0, 3).map((node: Element): PostPreview => {
                const anchor = node.querySelector('a[href]');
                const title = (anchor?.textContent || node.textContent || '').trim();
                const url = anchor ? anchor.getAttribute('href') : null;
                const timeEl = node.querySelector('time');
                const age = timeEl?.textContent?.trim() || null;
                return {
                  title: title.replace(/\s+/g, ' ').slice(0, 200),
                  url,
                  age,
                };
              })
            )) as PostPreview[];
          result.recent_posts = posts.filter((post) => post.title.length > 0);
        }
      } catch (error) {
        logger.debug('Could not extract recent posts');
      }

      // Build insights & summary for downstream RAG usage
      const insights: string[] = [];
      if (result.employee_count) {
        insights.push(`Employee count: ${result.employee_count.toLocaleString()}`);
      } else if (result.employee_range) {
        insights.push(`Employee range: ${result.employee_range}`);
      }
      if (result.employee_growth_pct !== null && !Number.isNaN(result.employee_growth_pct)) {
        const direction = result.employee_growth_pct >= 0 ? 'growth' : 'decline';
        insights.push(`Headcount ${direction}: ${result.employee_growth_pct}%`);
      }
      if (result.follower_count) {
        insights.push(`Followers: ${result.follower_count.toLocaleString()}`);
      }
      if (result.recent_posts.length > 0) {
        const newest = result.recent_posts[0];
        insights.push(`Recent post: ${newest.title}${newest.age ? ` (${newest.age})` : ''}`);
      }
      if (result.website) {
        insights.push(`Website: ${result.website}`);
      }
      if (result.industry) {
        insights.push(`Industry: ${result.industry}`);
      }
      if (result.description) {
        const intro = result.description.replace(/\s+/g, ' ').slice(0, 180);
        insights.push(`About: ${intro}${result.description.length > 180 ? '…' : ''}`);
      }

      result.insights = insights;
      result.summary = insights.join(' | ') || null;

      logger.info('LinkedIn company scrape completed', {
        name: result.name,
        employee_count: result.employee_count,
        employee_range: result.employee_range,
        follower_count: result.follower_count,
        has_recent_posts: result.recent_posts.length > 0,
      });

      return result;
    } catch (error: any) {
      logger.error('Error during LinkedIn company scrape', {
        error: error.message,
        stack: error.stack,
      });

      // Check if it's a timeout or network error
      if (error.message?.includes('timeout') || error.message?.includes('net::')) {
        throw new Error('LinkedIn request timed out - possible rate limiting');
      }

      throw error;
    }
  }
}
