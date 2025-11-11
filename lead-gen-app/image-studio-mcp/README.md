# Image Studio MCP

Omni-purpose MCP server and CLI for AI-powered image creation. Generate scenes from text prompts, restyle uploaded rooms, or apply targeted transformations to existing photos—all through deterministic Replicate workflows.

## Features

- Text-to-image generation with reusable style presets
- Virtual staging for real-estate photos with side-by-side comparisons
- Image-to-image transformations (restyling, lighting, seasonal swaps)
- Deterministic cost tracking based on configured Replicate model pricing
- Works as Claude MCP server or standalone CLI (`image-studio`)
- Fine-grained control over resolution, prompt strength, seeds, and negative prompts
- Built-in cost analytics with monthly summaries and CSV exports
- Save reusable custom style presets and manage them via CLI or MCP tools
- Automatic WebP export variants for every staged/generation run
- Revision history for each asset with CLI/MCP inspection tools
- CSV batch templates with per-image overrides for production workflows
- Seedream v4 staging pipeline with structure-preserving prompts to keep flooring and layout intact

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template and add your Replicate token
cp .env.example .env
# edit .env and set REPLICATE_API_TOKEN

# Run the MCP server
npm run build
npm start

# Or use the CLI directly without building
npm run cli -- stage --input ./room.jpg --output ./room-staged.jpg --style ikea_modern

# Prompt-to-image (direct CLI binary once built)
npx image-studio generate --prompt "sunlit modern kitchen" --output ./generated/kitchen.jpg
```

## Best Practices for Real Estate Staging

### Prompt Engineering for Accurate Staging

Based on extensive real-world testing, here's a proven prompt pattern for professional real estate staging:

**Example Winning Prompt:**
```
mid-range luxury bedroom furniture, lived-in feel, warm and inviting,
professional real estate staging, keep perspective, keep walls exactly
the same, make the bed bigger as it is a small room.
```

**Key Elements of Effective Staging Prompts:**

1. **Specific Style Level** - Use precise descriptors like "mid-range luxury" rather than generic terms
2. **Realistic Aesthetic** - Include "lived-in feel, warm and inviting" for believable spaces
3. **Explicit Preservation** - Always state "keep perspective, keep walls exactly the same"
4. **Targeted Changes** - Be specific about modifications (e.g., "make the bed bigger")
5. **Context Rationale** - Explain why (e.g., "as it is a small room")
6. **Purpose Statement** - Include "professional real estate staging"

### Multiple Variations Strategy

**Recommendation:** Generate 5 variations per image (default setting)

**Why:**
- Staging images cost only $0.0063 each (less than a penny)
- 5 variations = $0.0315 total (about 3 cents)
- Significantly increases chance of getting the perfect result
- Cost-effective insurance against AI inconsistency

**Usage:**
```bash
image-studio stage images/bedroom.jpg output/bedroom-staged.jpg --samples 5
```

Or via MCP:
```json
{
  "tool": "stage_image",
  "input_path": "images/bedroom.jpg",
  "output_path": "output/bedroom-staged.jpg",
  "num_samples": 5
}
```

### When to Use Manual Editing

AI staging excels at complete room reimagining but struggles with surgical precision. Consider manual editing (Photoshop/GIMP) when you need:

- Exact dimension preservation
- Specific color overlays (e.g., gold walls from a color sample)
- Precise furniture placement
- Combining AI-generated furniture with original room structure

**Hybrid Approach:** Use AI to generate furniture ideas/styles, then manually composite them into the original image for perfect control.

## Cost Considerations

**Per-Image Pricing:**
- Staging: $0.0063 per image (less than a penny)
- Generation from prompt: $0.0085 per image
- Transform: $0.0071 per image

**Default 5-Sample Strategy:**
- Staging 5 variations: $0.0315 (about 3 cents)
- Provides excellent value for finding the perfect result
- Can be overridden with `--samples N` or `num_samples` parameter

**Batch Operations:**
- 20 rooms × 5 samples = 100 images = $0.63
- Professional results at a fraction of traditional staging costs

## Available Styles

Run `npm run cli -- styles` to list every preset with descriptions. Custom prompts are also supported via the `--style` flag or MCP tool parameters.

## MCP Tools

- `generate_image` – Text-to-image generation (supports custom models, seeds, negatives)
- `transform_image` – Image restyling and transformations with strength control
- `stage_image` – Virtual staging for a single room with optional comparisons
- `batch_stage_images` – Stage an entire folder with consistent styling
- `generate_style_variations` – Multiple preset variants for one photo
- `list_styles` – Reference styling presets with descriptions
- `validate_token` – Sanity-check Replicate connectivity before running jobs
- `get_cost_summary` – Retrieve monthly spend totals and per-tool breakdowns
- `create_style` / `remove_style` / `list_custom_styles` – Manage saved custom presets
- `list_revisions` / `get_revision` – Inspect revision history and full metadata for prior runs

Each tool is documented in `src/server/mcp.ts` and exposed via Claude Desktop once the server is running.

## CLI Commands

- `image-studio generate` – Prompt-to-image creation
- `image-studio transform` – Apply guided edits to an existing photo
- `image-studio stage` – Stage a room with furniture and decor (resolution, prompt strength, seeds)
- `image-studio batch` – Stage every image in a folder (same advanced controls apply)
- `image-studio batch-template` – Scaffold a CSV template for batch overrides
- `image-studio styles` – List available staging presets
- `image-studio styles add` / `image-studio styles remove` – Manage custom style presets
- `image-studio validate` – Confirm your Replicate token works
- `image-studio analytics summary` – Monthly spend/usage with optional ROI calculation
- `image-studio analytics export` – CSV export of monthly activity
- `image-studio revisions list` / `image-studio revisions view` – Browse revision history by ID

## Workflow Utilities

- CSV batch templates live in `data/batch-template.csv` by default. Use `image-studio batch-template` to regenerate or specify your own path.
- Every staging, generation, or transform run records a revision JSON file under `data/revisions/`. Use `image-studio revisions list` to locate previous runs and `image-studio revisions view <id>` for detailed metadata, including costs, web variants, comparison boards, and batch provenance.

### Example: Batch → Web Assets → Revisions

```bash
# 1. Create a template with per-image overrides
npm run cli -- batch-template

# 2. Fill in the CSV (input/output paths, styles, comparison flags) and then run the batch
npm run cli -- batch --input ./data/raw --output ./data/staged --template ./data/batch-template.csv --comparisons

# 3. Inspect the captured history and drill into a specific run
npm run cli -- revisions list --limit 10
npm run cli -- revisions view <revision-id>
```

## Project Structure

See `SETUP.md` for detailed setup instructions, environment configuration, and architectural overview.
