# Image Studio MCP – Setup Guide

## 1. Prerequisites

- Node.js 18+
- Replicate account + API token (`https://replicate.com/account`)
- Optional: GraphicsMagick/Libvips runtime libraries required by `sharp`

## 2. Installation

```bash
npm install
cp .env.example .env
# Edit .env and set REPLICATE_API_TOKEN
```

## 3. Development Workflow

```bash
# Run MCP server in watch mode
npm run dev

# Start compiled server
npm start

# Use CLI without building
npm run cli -- stage --input ./room.jpg --output ./staged.jpg --style ikea_modern
```

## 4. Environment Variables

| Variable                     | Description                                                                   | Default                            |
| ---------------------------- | ----------------------------------------------------------------------------- | ---------------------------------- |
| `REPLICATE_API_TOKEN`        | Required Replicate auth token                                                 | –                                  |
| `IMAGE_STUDIO_MODEL_STAGING` | Override the staging model (defaults to Seedream v4)                          | `bytedance/seedream-4:…`           |
| `DEFAULT_STYLE`              | Fallback style or generative preset key                                       | `ikea_modern`                      |
| `DEFAULT_IMAGE_RESOLUTION`   | Default resolution passed to model                                            | `768`                              |
| `DEFAULT_SAMPLES`            | Default sample count (5 recommended for best results)                         | `5`                                |
| `MAX_CONCURRENT_REQUESTS`    | Batch concurrency limit                                                       | `3`                                |
| `IMAGE_STUDIO_ANALYTICS_DB`  | Path to SQLite analytics store                                                | `./data/image-studio-analytics.db` |
| `IMAGE_STUDIO_AUTO_WEB`      | Toggle automatic WebP export variants (`true`/`false`)                        | `true`                             |
| `IMAGE_STUDIO_WEB_SIZES`     | Comma-separated list of WebP export widths (e.g. `512,768,1024`). Empty skips | `512,768,1024`                     |
| `IMAGE_STUDIO_REVISION_DIR`  | Folder where revision history JSON files are stored                           | `./data/revisions`                 |

CLI commands accept advanced flags for prompt strength, negative prompts, deterministic seeds, multi-sample generation, and web export toggles. Run `npx image-studio --help` for the full matrix of options.

## 5. MCP Integration

1. Build the project (`npm run build`).
2. Point Claude Desktop to the compiled `dist/index.js` via your MCP configuration.
3. Tools exposed: `generate_image`, `transform_image`, `stage_image`, `batch_stage_images`, `generate_style_variations`, `list_styles`, `list_revisions`, `get_revision`, and `validate_token`. Additional helpers live in `src/server/mcp.ts`.

## 6. Workflow Extras

- CSV batch templates can be scaffolded with `npm run cli -- batch-template`. Populate overrides for input/output paths, styles, web asset preferences, and per-image flags, then pass the CSV to `image-studio batch --template <path>`.
- Every operation writes a revision JSON payload (plus lookup index) under `data/revisions/`. Use `npm run cli -- revisions list` to browse recent runs or `npm run cli -- revisions view <id>` for expanded metadata, costs, and web variant paths.

## 7. Repo Structure

```
image-studio-mcp/
  src/
    core/            # Replicate orchestration, generative + staging APIs
    server/          # MCP server wiring
    utils/           # Image helpers, presets, validation
    config/          # Constants and defaults
    types/           # Shared types
  examples/          # Usage samples for dev reference
  test/test-images/  # Drop local images for manual testing

Happy creating!
Happy staging!
```
