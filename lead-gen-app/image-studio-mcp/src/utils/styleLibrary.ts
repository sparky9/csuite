/**
 * Custom style preset library persistence helpers
 */
import fs from 'node:fs';
import path from 'node:path';
import { STYLE_LIBRARY_PATH } from '../config/constants.js';

export interface CustomStyle {
  key: string;
  name: string;
  prompt: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

type StyleMap = Record<string, CustomStyle>;

const ensureLibrary = (): void => {
  const dir = path.dirname(STYLE_LIBRARY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STYLE_LIBRARY_PATH)) {
    fs.writeFileSync(STYLE_LIBRARY_PATH, JSON.stringify({}), 'utf-8');
  }
};

const readLibrary = (): StyleMap => {
  try {
    ensureLibrary();
    const content = fs.readFileSync(STYLE_LIBRARY_PATH, 'utf-8');
    if (!content.trim()) {
      return {};
    }
    const parsed = JSON.parse(content) as StyleMap;
    return parsed ?? {};
  } catch (error) {
    console.error('Failed to read style library; returning empty map.', error);
    return {};
  }
};

const writeLibrary = (styles: StyleMap): void => {
  try {
    ensureLibrary();
    fs.writeFileSync(STYLE_LIBRARY_PATH, JSON.stringify(styles, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist style library', error);
  }
};

export const listCustomStyles = (): CustomStyle[] => {
  const map = readLibrary();
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
};

export const getCustomStyle = (key: string): CustomStyle | undefined => {
  const map = readLibrary();
  return map[key];
};

interface SaveStyleInput {
  key: string;
  name?: string;
  prompt: string;
  description?: string;
  tags?: string[];
}

export const saveCustomStyle = (input: SaveStyleInput): CustomStyle => {
  const cleanedKey = input.key.trim().toLowerCase().replace(/\s+/g, '_');
  if (!cleanedKey) {
    throw new Error('Style key cannot be empty');
  }

  const now = new Date().toISOString();
  const map = readLibrary();
  const existing = map[cleanedKey];
  const style: CustomStyle = {
    key: cleanedKey,
    name: input.name?.trim() || existing?.name || cleanedKey,
    prompt: input.prompt,
    description: input.description?.trim() || existing?.description,
    tags: input.tags ?? existing?.tags,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  map[cleanedKey] = style;
  writeLibrary(map);
  return style;
};

export const removeCustomStyle = (key: string): boolean => {
  const cleanedKey = key.trim().toLowerCase();
  const map = readLibrary();
  if (!map[cleanedKey]) {
    return false;
  }
  delete map[cleanedKey];
  writeLibrary(map);
  return true;
};

export const customStyleExists = (key: string): boolean => Boolean(getCustomStyle(key));