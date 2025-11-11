/**
 * Predefined styling prompts for common use cases
 */

import { getCustomStyle, listCustomStyles } from './styleLibrary.js';

export const STYLE_PRESETS = {
  ikea_modern: {
    name: 'IKEA Modern',
    prompt:
      'modern IKEA furniture, light wood, minimalist, Scandinavian style, bright natural lighting, clean lines, functional design',
    description: 'Affordable, minimalist Scandinavian style',
  },
  high_end: {
    name: 'High-End Luxury',
    prompt:
      'luxury designer furniture, dark polished wood, elegant upholstery, sophisticated decor, premium materials, ambient lighting, high-end finishes',
    description: 'Luxury designer furniture for upscale properties',
  },
  sparse_professional: {
    name: 'Professional Staging',
    prompt:
      'minimal professional staging, neutral colors, clean modern furniture, real estate photography, bright and inviting, uncluttered space',
    description: 'Minimal professional staging for real estate listings',
  },
  cozy_traditional: {
    name: 'Cozy Traditional',
    prompt:
      'warm traditional furniture, comfortable upholstery, lived-in feel, cozy textures, wooden furniture, family-friendly, inviting atmosphere',
    description: 'Warm, inviting traditional style',
  },
  industrial_loft: {
    name: 'Industrial Loft',
    prompt:
      'industrial loft style, metal and wood furniture, exposed elements, modern minimalist, urban aesthetic, concrete and steel accents',
    description: 'Urban industrial style with exposed elements',
  },
  minimalist_contemporary: {
    name: 'Minimalist Contemporary',
    prompt:
      'minimalist contemporary furniture, neutral palette, clean geometric shapes, open space, simple elegant design, modern aesthetic',
    description: 'Clean minimalist contemporary design',
  },
  bohemian_eclectic: {
    name: 'Bohemian Eclectic',
    prompt:
      'bohemian eclectic style, colorful textiles, mixed patterns, vintage furniture, plants and natural elements, artistic and creative',
    description: 'Colorful, artistic bohemian style',
  },
  mid_century_modern: {
    name: 'Mid-Century Modern',
    prompt:
      'mid-century modern furniture, organic curves, tapered legs, warm wood tones, retro aesthetic, iconic designs, 1950s-60s style',
    description: 'Classic mid-century modern aesthetic',
  },
  farmhouse_rustic: {
    name: 'Farmhouse Rustic',
    prompt:
      'farmhouse rustic style, reclaimed wood, vintage charm, neutral colors, comfortable casual furniture, country aesthetic',
    description: 'Rustic farmhouse charm',
  },
  lived_in_staging: {
    name: 'Lived-In Staging',
    prompt:
      'mid-range luxury furniture, lived-in feel, warm and inviting, professional real estate staging, keep perspective, keep walls exactly the same',
    description: 'Realistic professional staging with lived-in warmth (user-validated best practice)',
  },
};

export function getStylePrompt(styleKey: string): string {
  const trimmed = styleKey.trim();
  const custom = getCustomStyle(trimmed);
  if (custom) {
    return custom.prompt;
  }
  const preset = STYLE_PRESETS[trimmed as keyof typeof STYLE_PRESETS];
  if (preset) {
    return preset.prompt;
  }
  return styleKey;
}

export function listAvailableStyles(): string[] {
  const builtins = Object.entries(STYLE_PRESETS).map(
    ([key, style]) => `${key}: ${style.name} - ${style.description}`,
  );
  const custom = listCustomStyles().map((style) => {
    const details = style.description ? ` - ${style.description}` : '';
    return `${style.key}: ${style.name}${details} (custom)`;
  });
  return [...builtins, ...custom];
}

export function getStyleMetadata(styleKey: string) {
  const trimmed = styleKey.trim();
  const custom = getCustomStyle(trimmed);
  if (custom) {
    return {
      key: custom.key,
      name: custom.name,
      description: custom.description,
      source: 'custom' as const,
    };
  }
  const preset = STYLE_PRESETS[trimmed as keyof typeof STYLE_PRESETS];
  if (preset) {
    return {
      key: trimmed,
      name: preset.name,
      description: preset.description,
      source: 'builtin' as const,
    };
  }
  return undefined;
}
