import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
// @ts-ignore
import { Jimp, loadFont } from 'jimp';
// @ts-ignore
import { SANS_16_WHITE, SANS_16_BLACK } from 'jimp/fonts';

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dixdw1mus',
  api_key: process.env.CLOUDINARY_API_KEY || '647788876868715',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'Aku2U6rp22oHgQQEESnZ7w3YaUI'
});

const router = Router();

const uploadSchema = z.object({
  masterId: z.number(),
  childDeviceId: z.number().optional(),
  category: z.enum(['MASTER', 'DEVICE_1', 'DEVICE_2', 'POWER_SOURCE']),
  imageBase64: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// Upload evidence
router.post('/', authenticate, async (req: any, res, next) => {
  try {
    const data = uploadSchema.parse(req.body);

    // Ensure uploads directory exists for local fallback
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Process base64 string
    // Format is usually "data:image/jpeg;base64,/9j/4AAQ..."
    const matches = data.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;

    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(data.imageBase64, 'base64');
    }

    let stampedBuffer: Buffer = buffer;

    try {
      // Load the image with Jimp
      const image = await Jimp.read(buffer);

      // Auto-downscale huge images if width or height exceeds 2048 to prevent memory blowout / keep upload fast
      if (image.bitmap && (image.bitmap.width > 2048 || image.bitmap.height > 2048)) {
        if (image.bitmap.width >= image.bitmap.height) {
          image.resize({ w: 2048 });
        } else {
          image.resize({ h: 2048 });
        }
      }

      // Create watermark text
      const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const latStr = data.latitude !== undefined && data.latitude !== null ? data.latitude.toFixed(6) : 'N/A';
      const lngStr = data.longitude !== undefined && data.longitude !== null ? data.longitude.toFixed(6) : 'N/A';
      const text = `Lat: ${latStr} | Lng: ${lngStr} | ${dateStr}`;

      // Load fonts (both black and white to simulate an outline/shadow for readability)
      const fontWhite = await loadFont(SANS_16_WHITE);
      const fontBlack = await loadFont(SANS_16_BLACK);

      // Print black text offset by 1px as a shadow, then white text on top
      image.print({ font: fontBlack, x: 13, y: 13, text });
      image.print({ font: fontWhite, x: 12, y: 12, text });

      stampedBuffer = await image.getBuffer('image/jpeg');
    } catch (jimpErr) {
      console.warn('Jimp watermarking failed, using original buffer:', jimpErr);
      stampedBuffer = buffer;
    }

    // Save locally as persistent/fallback cache
    const filename = `${crypto.randomUUID()}.jpg`;
    const filepath = path.join(uploadsDir, filename);
    try {
      fs.writeFileSync(filepath, stampedBuffer);
    } catch (fsErr) {
      console.warn('Local fs write failed:', fsErr);
    }

    // Upload to Cloudinary with local fallback
    let imageUrl = `/uploads/${filename}`;
    try {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'lc-platform-evidence',
            resource_type: 'image'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(stampedBuffer);
      });

      if (uploadResult?.secure_url) {
        imageUrl = uploadResult.secure_url;
      }
    } catch (cldErr) {
      console.warn('Cloudinary upload failed, falling back to local file URL:', cldErr);
    }

    const evidence = await prisma.installationEvidence.create({
      data: {
        category: data.category,
        imageUrl,
        latitude: data.latitude,
        longitude: data.longitude,
        userId: req.user.id,
        masterId: data.masterId,
        childDeviceId: data.childDeviceId,
      },
    });

    res.status(201).json(evidence);
  } catch (error) {
    next(error);
  }
});

export default router;
