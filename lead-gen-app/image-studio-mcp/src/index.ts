/**
 * Main entry point for Image Studio MCP server
 */
import dotenv from 'dotenv';
import { ImageStudioMCPServer } from './server/mcp.js';

dotenv.config();

async function main(): Promise<void> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error('REPLICATE_API_TOKEN not set. Please configure your .env file.');
    process.exit(1);
  }

  const server = new ImageStudioMCPServer(token);
  await server.start();
}

main().catch((error) => {
  console.error('Fatal server error:', error);
  process.exit(1);
});
