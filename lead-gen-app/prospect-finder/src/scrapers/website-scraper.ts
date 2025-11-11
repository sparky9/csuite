/**
 * Website Scraper
 *
 * Extracts additional data from company websites:
 * - Contact emails
 * - Phone numbers
 * - Employee names (from team pages)
 * - Services offered
 */

import { BaseScraper } from './base-scraper.js';
import { BrowserInstance } from '../types/scraper.types.js';
import { logger } from '../utils/logger.js';

export interface WebsiteScrapeParams {
  website_url: string;
}

export interface WebsiteScrapeResult {
  emails: string[];
  phones: string[];
  employee_names: string[];
  services: string[];
  social_links: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
}

export class WebsiteScraper extends BaseScraper<WebsiteScrapeParams, WebsiteScrapeResult> {
  protected validateParams(params: WebsiteScrapeParams): boolean {
    return (
      typeof params.website_url === 'string' &&
      params.website_url.length > 0 &&
      this.isValidUrl(params.website_url)
    );
  }

  protected getRateLimitSource(): 'email_finder' {
    // Reuse email_finder rate limit since this is similar workload
    return 'email_finder';
  }

  protected async performScrape(
    params: WebsiteScrapeParams,
    browser: BrowserInstance
  ): Promise<WebsiteScrapeResult> {
    const result: WebsiteScrapeResult = {
      emails: [],
      phones: [],
      employee_names: [],
      services: [],
      social_links: {},
    };

    // Normalize URL
    let baseUrl = params.website_url;
    if (!baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }

    logger.info('Starting website scrape', { url: baseUrl });

    // Pages to scrape
    const pagesToScrape = [
      { path: '', type: 'home' },
      { path: '/contact', type: 'contact' },
      { path: '/contact-us', type: 'contact' },
      { path: '/about', type: 'about' },
      { path: '/about-us', type: 'about' },
      { path: '/team', type: 'team' },
      { path: '/our-team', type: 'team' },
      { path: '/services', type: 'services' },
      { path: '/what-we-do', type: 'services' },
    ];

    for (const page of pagesToScrape) {
      try {
        const url = `${baseUrl}${page.path}`;
        logger.debug('Scraping page', { url, type: page.type });

        await browser.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });

        await this.randomDelay(1000, 2000);

        // Extract data based on page type
        if (page.type === 'contact' || page.type === 'home') {
          await this.extractContactInfo(browser, result);
        }

        if (page.type === 'team' || page.type === 'about') {
          await this.extractTeamMembers(browser, result);
        }

        if (page.type === 'services' || page.type === 'home') {
          await this.extractServices(browser, result);
        }

        if (page.type === 'home') {
          await this.extractSocialLinks(browser, result, baseUrl);
        }
      } catch (error: any) {
        logger.debug('Could not scrape page', {
          path: page.path,
          error: error.message,
        });
        // Continue to next page
      }
    }

    // Deduplicate results
    result.emails = [...new Set(result.emails)];
    result.phones = [...new Set(result.phones)];
    result.employee_names = [...new Set(result.employee_names)];
    result.services = [...new Set(result.services)];

    logger.info('Website scrape completed', {
      url: baseUrl,
      emails: result.emails.length,
      phones: result.phones.length,
      employees: result.employee_names.length,
      services: result.services.length,
    });

    return result;
  }

  /**
   * Extract contact information (emails and phones)
   */
  private async extractContactInfo(
    browser: BrowserInstance,
    result: WebsiteScrapeResult
  ): Promise<void> {
    try {
      // Get page content
      const bodyText = await browser.page.locator('body').textContent();

      if (bodyText) {
        // Extract emails
        const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
        const emailMatches = bodyText.match(emailRegex);
        if (emailMatches) {
          for (const email of emailMatches) {
            const cleanEmail = email.toLowerCase().trim();
            if (
              this.isValidEmail(cleanEmail) &&
              !cleanEmail.includes('@example.com') &&
              !cleanEmail.includes('@domain.com') &&
              !cleanEmail.endsWith('.png') &&
              !cleanEmail.endsWith('.jpg')
            ) {
              result.emails.push(cleanEmail);
            }
          }
        }

        // Extract phone numbers
        const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const phoneMatches = bodyText.match(phoneRegex);
        if (phoneMatches) {
          for (const phone of phoneMatches) {
            const normalized = this.normalizePhone(phone);
            if (this.isValidPhone(normalized)) {
              result.phones.push(normalized);
            }
          }
        }
      }

      // Check mailto: links
      const mailtoLinks = await browser.page.locator('a[href^="mailto:"]').all();
      for (const link of mailtoLinks) {
        try {
          const href = await link.getAttribute('href');
          if (href) {
            const email = href.replace('mailto:', '').split('?')[0].toLowerCase().trim();
            if (this.isValidEmail(email)) {
              result.emails.push(email);
            }
          }
        } catch (error) {
          // Ignore
        }
      }

      // Check tel: links
      const telLinks = await browser.page.locator('a[href^="tel:"]').all();
      for (const link of telLinks) {
        try {
          const href = await link.getAttribute('href');
          if (href) {
            const phone = href.replace('tel:', '').replace(/\s/g, '');
            const normalized = this.normalizePhone(phone);
            if (this.isValidPhone(normalized)) {
              result.phones.push(normalized);
            }
          }
        } catch (error) {
          // Ignore
        }
      }
    } catch (error: any) {
      logger.debug('Error extracting contact info', { error: error.message });
    }
  }

  /**
   * Extract team member names
   */
  private async extractTeamMembers(
    browser: BrowserInstance,
    result: WebsiteScrapeResult
  ): Promise<void> {
    try {
      // Look for common team section patterns
      const teamSelectors = [
        '.team-member',
        '.staff-member',
        '.employee',
        '[class*="team"]',
        '[id*="team"]',
      ];

      for (const selector of teamSelectors) {
        try {
          const members = await browser.page.locator(selector).all();

          for (const member of members) {
            try {
              // Look for name in heading tags
              const nameElement = member.locator('h1, h2, h3, h4, h5, .name, .title').first();
              const nameText = await nameElement.textContent();

              if (nameText) {
                const name = nameText.trim();
                // Validate it looks like a person's name (2-4 words, capitalized)
                if (
                  name.match(/^[A-Z][a-z]+(?: [A-Z][a-z]+){1,3}$/) &&
                  name.length < 50
                ) {
                  result.employee_names.push(name);
                }
              }
            } catch (error) {
              // Ignore individual member errors
            }
          }

          if (members.length > 0) {
            break; // Found a working selector
          }
        } catch (error) {
          // Try next selector
        }
      }
    } catch (error: any) {
      logger.debug('Error extracting team members', { error: error.message });
    }
  }

  /**
   * Extract services offered
   */
  private async extractServices(
    browser: BrowserInstance,
    result: WebsiteScrapeResult
  ): Promise<void> {
    try {
      // Look for service listings
      const serviceSelectors = [
        '.service',
        '.services li',
        '[class*="service-"]',
        '[id*="service"]',
      ];

      for (const selector of serviceSelectors) {
        try {
          const services = await browser.page.locator(selector).all();

          for (const service of services) {
            try {
              const serviceText = await service.textContent();
              if (serviceText) {
                const text = serviceText.trim();
                // Only include if it's a reasonable length (not full paragraphs)
                if (text.length > 5 && text.length < 100 && !text.includes('\n\n')) {
                  result.services.push(text);
                }
              }
            } catch (error) {
              // Ignore individual service errors
            }
          }

          if (services.length > 0) {
            break; // Found services
          }
        } catch (error) {
          // Try next selector
        }
      }

      // Limit services to reasonable number
      if (result.services.length > 20) {
        result.services = result.services.slice(0, 20);
      }
    } catch (error: any) {
      logger.debug('Error extracting services', { error: error.message });
    }
  }

  /**
   * Extract social media links
   */
  private async extractSocialLinks(
    browser: BrowserInstance,
    result: WebsiteScrapeResult,
    _baseUrl: string
  ): Promise<void> {
    try {
      const socialPatterns = {
        facebook: /facebook\.com\/[^\/\s"']+/,
        twitter: /(?:twitter|x)\.com\/[^\/\s"']+/,
        linkedin: /linkedin\.com\/(?:company|in)\/[^\/\s"']+/,
        instagram: /instagram\.com\/[^\/\s"']+/,
      };

      // Get all links on page
      const links = await browser.page.locator('a[href]').all();

      for (const link of links) {
        try {
          const href = await link.getAttribute('href');
          if (!href) continue;

          // Check each social pattern
          for (const [platform, pattern] of Object.entries(socialPatterns)) {
            if (pattern.test(href)) {
              const match = href.match(pattern);
              if (match && match[0]) {
                result.social_links[platform as keyof typeof result.social_links] =
                  match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
              }
            }
          }
        } catch (error) {
          // Ignore individual link errors
        }
      }
    } catch (error: any) {
      logger.debug('Error extracting social links', { error: error.message });
    }
  }
}
