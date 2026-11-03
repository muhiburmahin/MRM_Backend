import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as fs from 'fs';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (cloudName && apiKey && apiSecret && process.env.NODE_ENV !== 'test') {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      this.logger.log(`Cloudinary storage configured for cloud "${cloudName}"`);
    } else {
      this.logger.log(
        'Cloudinary not configured or test environment active; using local storage fallback.',
      );
    }
  }

  get isEnabled(): boolean {
    return this.isConfigured;
  }

  async uploadFile(
    filePath: string,
    folder = 'mrm-assets',
  ): Promise<{
    url: string;
    publicId: string;
    width?: number;
    height?: number;
    bytes: number;
    format: string;
  } | null> {
    if (!this.isConfigured) return null;

    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
        folder,
        resource_type: 'auto',
      });

      // Attempt to clean up the temporary local file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // ignore local cleanup error
      }

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format,
      };
    } catch (error) {
      this.logger.error(
        `Cloudinary upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

