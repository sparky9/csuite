import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SUPPORTED_IMAGE_FORMATS } from '../config/constants.js';

export class ImageProcessor {
  async readImage(imagePath: string): Promise<Buffer> {
    try {
      const buffer = await fs.readFile(imagePath);
      const metadata = await sharp(buffer).metadata();
      if (!metadata.format) {
        throw new Error('Invalid image file');
      }
      return buffer;
    } catch (error: any) {
      throw new Error(`Failed to read image ${imagePath}: ${error.message}`);
    }
  }

  async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  async saveImage(imageBuffer: Buffer, outputPath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await sharp(imageBuffer).toFile(outputPath);
    } catch (error: any) {
      throw new Error(`Failed to save image ${outputPath}: ${error.message}`);
    }
  }

  async generateWebVariants(
    imageBuffer: Buffer,
    baseOutputPath: string,
    sizes: number[],
    quality = 82,
  ): Promise<string[]> {
    if (!sizes || sizes.length === 0) {
      return [];
    }

    try {
      const directory = path.dirname(baseOutputPath);
      const ext = path.extname(baseOutputPath);
      const name = path.basename(baseOutputPath, ext);
      await fs.mkdir(directory, { recursive: true });

      const variants = await Promise.all(
        sizes.map(async (size) => {
          const output = path.join(directory, `${name}_${size}.webp`);
          await sharp(imageBuffer)
            .resize({ width: size, withoutEnlargement: true })
            .webp({ quality })
            .toFile(output);
          return output;
        }),
      );

      return variants;
    } catch (error: any) {
      throw new Error(`Failed to generate web variants: ${error.message}`);
    }
  }

  async createComparison(
    originalPath: string,
    stagedPath: string,
    outputPath: string,
  ): Promise<void> {
    try {
      const [original, staged] = await Promise.all([
        sharp(originalPath)
          .resize(800, null, { withoutEnlargement: true })
          .toBuffer(),
        sharp(stagedPath)
          .resize(800, null, { withoutEnlargement: true })
          .toBuffer(),
      ]);

      const originalMeta = await sharp(original).metadata();
      const width = originalMeta.width ?? 800;
      const height = originalMeta.height ?? 600;

      await sharp({
        create: {
          width: width * 2 + 20,
          height,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          { input: original, left: 0, top: 0 },
          { input: staged, left: width + 20, top: 0 },
        ])
        .toFile(outputPath);
    } catch (error: any) {
      throw new Error(`Failed to create comparison: ${error.message}`);
    }
  }

  async getImageFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      return files
        .filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return SUPPORTED_IMAGE_FORMATS.includes(ext);
        })
        .map((file) => path.join(dirPath, file));
    } catch (error: any) {
      throw new Error(`Failed to read directory ${dirPath}: ${error.message}`);
    }
  }

  isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_IMAGE_FORMATS.includes(ext);
  }
}
