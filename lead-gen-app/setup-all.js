#!/usr/bin/env node

/**
 * Unified Setup Script for Lead Generation Ecosystem
 *
 * This script sets up all modules in the lead generation ecosystem:
 * - ProspectFinder MCP (scrapers, AI-powered prospecting)
 * - LeadTracker Pro MCP (conversational CRM)
 * - EmailOrchestrator MCP (AI-powered email campaigns)
 * - VPA Core MCP (unified orchestration)
 *
 * Future modules can be added by extending MODULES_CONFIG
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration for all modules
const MODULES_CONFIG = {
  'prospect-finder': {
    path: './prospect-finder',
    name: 'ProspectFinder MCP',
    description: 'Web scraping and AI-powered B2B prospecting',
    npm_script: 'npm install',
    env_example: '.env.example',
    env_target: '.env',
    config_files: ['config/proxies.json.example', 'config/scraper-limits.json'],
    optional: false,
  },
  'leadtracker-pro': {
    path: './leadtracker-pro',
  name: 'LeadTracker Pro MCP',
    description: 'Conversational CRM for sales teams',
    npm_script: 'npm install',
    env_example: '.env.example',
    env_target: '.env',
    optional: false,
  },
  'email-orchestrator': {
    path: './email-orchestrator',
    name: 'EmailOrchestrator MCP',
    description: 'AI-powered email campaign automation',
    npm_script: 'npm install',
    env_example: '.env.example',
    env_target: '.env',
    optional: false,
  },
  'vpa-core': {
    path: './vpa-core',
    name: 'VPA Core MCP',
    description: 'Unified AI assistant orchestrating all modules',
    npm_script: 'npm install',
    env_example: '.env.example',
    env_target: '.env',
    optional: false,
  },

  // Future modules can be added here
  // 'content-writer': { ... },
  // 'social-media': { ... },
  // 'analytics': { ... },
};

class SetupManager {
  constructor() {
    this.responses = {};
    this.setupCompleteness = {};
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m',
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  ask(question) {
    return new Promise((resolve) => {
      process.stdout.write(`${question} `);
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  askYesNo(question, defaultValue = false) {
    const prompt = defaultValue ? `${question} (Y/n)` : `${question} (y/N)`;
    return this.ask(prompt).then((answer) => {
      const clean = answer.toLowerCase().toLowerCase();
      if (clean === '') return defaultValue;
      return clean.startsWith('y') || clean === 'yes';
    });
  }

  async setupDatabase() {
    this.log('\n🗄️  DATABASE SETUP', 'info');
    this.log('==================', 'info');

    const hasDatabase = await this.askYesNo('Do you have a PostgreSQL database set up?', false);

    if (!hasDatabase) {
      this.log('📋 Recommended: Neon PostgreSQL (free tier: https://neon.tech)', 'info');
      this.log('1. Sign up at https://neon.tech', 'info');
      this.log('2. Create a new project', 'info');
      this.log('3. Copy the connection string', 'info');
      this.log('4. Run this setup again when ready\n', 'info');

      const response = await this.ask('Enter your database connection string (or press Enter to skip for now):');
      if (response.trim()) {
        this.responses.database_url = response.trim();
        return true;
      }
      return false;
    } else {
      const dbUrl = await this.ask('Enter your database connection string:');
      this.responses.database_url = dbUrl;
      return true;
    }
  }

  async setupAnthropic() {
    this.log('\n🤖 ANTHROPIC API SETUP', 'info');
    this.log('========================', 'info');

    const hasAnthropicKey = await this.askYesNo('Do you have an Anthropic API key?', false);

    if (!hasAnthropicKey) {
      this.log('📋 Get your API key at: https://console.anthropic.com/', 'info');
      this.log('Free tier available for testing\n', 'info');

      const response = await this.ask('Enter your Anthropic API key (or press Enter to skip for now):');
      if (response.trim()) {
        this.responses.anthropic_api_key = response.trim();
        return true;
      }
      return false;
    } else {
      const apiKey = await this.ask('Enter your Anthropic API key:');
      this.responses.anthropic_api_key = apiKey;
      return true;
    }
  }

  async setupModules() {
    for (const [moduleKey, moduleConfig] of Object.entries(MODULES_CONFIG)) {
      const modulePath = join(__dirname, moduleConfig.path);

      if (!existsSync(modulePath)) {
        if (!moduleConfig.optional) {
          this.log(`❌ Required module ${moduleConfig.name} not found at ${modulePath}`, 'error');
          continue;
        } else {
          this.log(`⚠️  Optional module ${moduleConfig.name} not found, skipping`, 'warning');
          continue;
        }
      }

      this.log(`\n📦 SETTING UP ${moduleConfig.name.toUpperCase()}`, 'info');
      this.log('='.repeat(50), 'info');
      this.log(moduleConfig.description, 'info');

      let setupComplete = true;

      // Install dependencies
      if (moduleConfig.npm_script) {
        try {
          this.log(`Installing dependencies for ${moduleConfig.name}...`, 'info');
          process.chdir(modulePath);
          execSync(moduleConfig.npm_script, { stdio: 'inherit' });
          this.log(`✅ Dependencies installed for ${moduleConfig.name}`, 'success');
        } catch (error) {
          this.log(`❌ Failed to install dependencies for ${moduleConfig.name}`, 'error');
          setupComplete = false;
        }
      }

      // Copy config files
      if (moduleConfig.config_files) {
        for (const configFile of moduleConfig.config_files) {
          const srcPath = join(modulePath, configFile);
          const destPath = join(modulePath, configFile.replace('.example', ''));

          if (existsSync(srcPath) && !existsSync(destPath)) {
            try {
              const content = readFileSync(srcPath, 'utf-8');
              writeFileSync(destPath, content);
              this.log(`✅ Created config: ${configFile.replace('.example', '')}`, 'success');
            } catch (error) {
              this.log(`❌ Failed to copy config: ${configFile}`, 'error');
            }
          }
        }
      }

      // Build TypeScript
      const tsconfigPath = join(modulePath, 'tsconfig.json');
      const packageJsonPath = join(modulePath, 'package.json');

      if (existsSync(tsconfigPath) && existsSync(packageJsonPath)) {
        try {
          this.log(`Building TypeScript for ${moduleConfig.name}...`, 'info');
          execSync('npm run build', { stdio: 'inherit' });
          this.log(`✅ TypeScript built for ${moduleConfig.name}`, 'success');
        } catch (error) {
          this.log(`❌ Failed to build TypeScript for ${moduleConfig.name}`, 'error');
          setupComplete = false;
        }
      }

      this.setupCompleteness[moduleKey] = setupComplete;
    }
  }

  generateEnvFiles() {
    for (const [moduleKey, moduleConfig] of Object.entries(MODULES_CONFIG)) {
      const modulePath = join(__dirname, moduleConfig.path);

      if (!existsSync(modulePath)) continue;

      const envExamplePath = join(modulePath, moduleConfig.env_example);
      const envTargetPath = join(modulePath, moduleConfig.env_target);

      if (existsSync(envExamplePath) && !existsSync(envTargetPath)) {
        try {
          let envContent = readFileSync(envExamplePath, 'utf-8');

          // Replace with user-provided values
          if (this.responses.database_url) {
            envContent = envContent.replace(
              /DATABASE_URL=.*/,
              `DATABASE_URL=${this.responses.database_url}`
            );
          }

          if (this.responses.anthropic_api_key) {
            envContent = envContent.replace(
              /ANTHROPIC_API_KEY=.*/,
              `ANTHROPIC_API_KEY=${this.responses.anthropic_api_key}`
            );
          }

          // Module-specific defaults
          switch (moduleKey) {
            case 'email-orchestrator':
              envContent = envContent.replace(/COMPANY_NAME=.*/, 'COMPANY_NAME=Your Company Name');
              envContent = envContent.replace(/COMPANY_ADDRESS=.*/, 'COMPANY_ADDRESS=123 Main St, City, ST 12345');
              break;
          }

          writeFileSync(envTargetPath, envContent);
          this.log(`✅ Created .env file for ${moduleConfig.name}`, 'success');
        } catch (error) {
          this.log(`❌ Failed to create .env file for ${moduleConfig.name}`, 'error');
        }
      }
    }
  }

  printSummary() {
    this.log('\n🎉 SETUP COMPLETE SUMMARY', 'success');
    this.log('=======================', 'success');

    for (const [moduleKey, complete] of Object.entries(this.setupCompleteness)) {
      const config = MODULES_CONFIG[moduleKey];
      if (complete) {
        this.log(`✅ ${config.name} - Ready to use`, 'success');
      } else {
        this.log(`❌ ${config.name} - Setup incomplete`, 'error');
      }
    }

    this.log('\n🚀 NEXT STEPS', 'info');
    this.log('=============', 'info');

    if (this.responses.database_url && this.responses.anthropic_api_key) {
      this.log('1. Start with standalone prospecting:', 'info');
      this.log('   npm run quick-search hvac-texas', 'info');
      this.log('   npm run export:csv [filename]', 'info');

      this.log('\n2. Set up Claude Desktop MCP (when ready):', 'info');
      this.log('   - Add configs from README files', 'info');
      this.log('   - MCP will provide AI-powered prospecting', 'info');
    } else {
      this.log('1. Complete configuration:', 'info');
      if (!this.responses.database_url) {
        this.log('   - Set up PostgreSQL database (Neon recommended)', 'error');
      }
      if (!this.responses.anthropic_api_key) {
        this.log('   - Get Anthropic API key for AI features', 'error');
      }

      this.log('\n2. Can still use without full setup:', 'info');
      this.log('   npm run quick-search hvac-texas  # Get prospects now!', 'info');
    }

    this.log('\n📚 DOCUMENTATION', 'info');
    this.log('=================', 'info');
    this.log('• Standalone tools: QUICK_START_CHEATSHEET.md', 'info');
    this.log('• Full MCP setup: README.md', 'info');
    this.log('• Business plan: lead gen business plan.md', 'info');

    this.log('\n🎯 START PROSPECTING!', 'success');
    this.log('=====================', 'success');
  }

  async run() {
    this.log('🚀 LEAD GENERATION ECOSYSTEM SETUP', 'success');
    this.log('=====================================', 'success');
  this.log('Setting up: ProspectFinder + LeadTracker Pro + EmailOrchestrator + VPA Core', 'info');
    this.log('This may take a few minutes...\n', 'info');

    try {
      // Setup dependencies
      await this.setupDatabase();
      await this.setupAnthropic();

      this.log('\n📦 INSTALLING MODULES', 'info');
      this.log('======================', 'info');

      await this.setupModules();
      this.generateEnvFiles();
      this.printSummary();

    } catch (error) {
      this.log(`\n❌ Setup failed: ${error.message}`, 'error');
      this.log('You can run this script again to retry', 'warning');
    }

    process.exit(0);
  }
}

// Run the setup
const setup = new SetupManager();
setup.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
