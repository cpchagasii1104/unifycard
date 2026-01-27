// src/modules/groups/services/group-image.service.ts
// Serviço para processamento de imagens de grupos (avatar e capa)

import sharp from 'sharp';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestError } from '@core/errors';

export type ImageType = 'avatar' | 'cover';

interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

interface ImageVersions {
  original: ProcessedImage;
  versions: Record<string, ProcessedImage>;
}

class GroupImageService {
  private readonly uploadsDir: string;
  private readonly maxAvatarSize = 100 * 1024; // 100KB
  private readonly maxCoverSize = 300 * 1024; // 300KB

  constructor() {
    // Diretório de uploads: uploads/groups/{groupId}/
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'groups');
    this.ensureUploadsDir();
  }

  private ensureUploadsDir(): void {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Processa imagem de avatar (1:1)
   * Gera versões: 256x256, 64x64
   */
  async processAvatar(
    groupId: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<ImageVersions> {
    // Validar tipo de imagem
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestError('Arquivo deve ser uma imagem');
    }

    // Validar tamanho original (máximo 5MB antes de processar)
    if (imageBuffer.length > 5 * 1024 * 1024) {
      throw new BadRequestError('Imagem muito grande. Tamanho máximo: 5MB');
    }

    const groupDir = path.join(this.uploadsDir, groupId);
    if (!fs.existsSync(groupDir)) {
      fs.mkdirSync(groupDir, { recursive: true });
    }

    const baseId = `avatar_${randomUUID()}`;
    const versions: Record<string, ProcessedImage> = {};

    // Processar versão 256x256 (principal)
    const avatar256 = await sharp(imageBuffer)
      .resize(256, 256, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Otimizar até ficar abaixo de 100KB
    let optimized256 = avatar256;
    let quality = 85;
    while (optimized256.length > this.maxAvatarSize && quality > 50) {
      quality -= 5;
      optimized256 = await sharp(imageBuffer)
        .resize(256, 256, { fit: 'cover', position: 'center' })
        .webp({ quality })
        .toBuffer();
    }

    const avatar256Path = path.join(groupDir, `${baseId}_256.webp`);
    fs.writeFileSync(avatar256Path, optimized256);
    versions['256x256'] = {
      url: `/uploads/groups/${groupId}/${baseId}_256.webp`,
      width: 256,
      height: 256,
      size: optimized256.length,
      format: 'webp',
    };

    // Processar versão 64x64 (thumbnail)
    const avatar64 = await sharp(imageBuffer)
      .resize(64, 64, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();

    const avatar64Path = path.join(groupDir, `${baseId}_64.webp`);
    fs.writeFileSync(avatar64Path, avatar64);
    versions['64x64'] = {
      url: `/uploads/groups/${groupId}/${baseId}_64.webp`,
      width: 64,
      height: 64,
      size: avatar64.length,
      format: 'webp',
    };

    return {
      original: versions['256x256'], // Usar 256x256 como "original" para avatar
      versions,
    };
  }

  /**
   * Processa imagem de capa (16:9)
   * Gera versões: 1280x720, 640x360
   */
  async processCover(
    groupId: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<ImageVersions> {
    // Validar tipo de imagem
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestError('Arquivo deve ser uma imagem');
    }

    // Validar tamanho original (máximo 10MB antes de processar)
    if (imageBuffer.length > 10 * 1024 * 1024) {
      throw new BadRequestError('Imagem muito grande. Tamanho máximo: 10MB');
    }

    const groupDir = path.join(this.uploadsDir, groupId);
    if (!fs.existsSync(groupDir)) {
      fs.mkdirSync(groupDir, { recursive: true });
    }

    const baseId = `cover_${randomUUID()}`;
    const versions: Record<string, ProcessedImage> = {};

    // Processar versão 1280x720 (principal)
    const cover1280 = await sharp(imageBuffer)
      .resize(1280, 720, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Otimizar até ficar abaixo de 300KB
    let optimized1280 = cover1280;
    let quality = 85;
    while (optimized1280.length > this.maxCoverSize && quality > 50) {
      quality -= 5;
      optimized1280 = await sharp(imageBuffer)
        .resize(1280, 720, { fit: 'cover', position: 'center' })
        .webp({ quality })
        .toBuffer();
    }

    const cover1280Path = path.join(groupDir, `${baseId}_1280x720.webp`);
    fs.writeFileSync(cover1280Path, optimized1280);
    versions['1280x720'] = {
      url: `/uploads/groups/${groupId}/${baseId}_1280x720.webp`,
      width: 1280,
      height: 720,
      size: optimized1280.length,
      format: 'webp',
    };

    // Processar versão 640x360 (thumbnail)
    const cover640 = await sharp(imageBuffer)
      .resize(640, 360, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();

    const cover640Path = path.join(groupDir, `${baseId}_640x360.webp`);
    fs.writeFileSync(cover640Path, cover640);
    versions['640x360'] = {
      url: `/uploads/groups/${groupId}/${baseId}_640x360.webp`,
      width: 640,
      height: 360,
      size: cover640.length,
      format: 'webp',
    };

    return {
      original: versions['1280x720'], // Usar 1280x720 como "original" para capa
      versions,
    };
  }

  /**
   * Processa imagem baseado no tipo
   */
  async processImage(
    groupId: string,
    imageType: ImageType,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<ImageVersions> {
    if (imageType === 'avatar') {
      return this.processAvatar(groupId, imageBuffer, mimeType);
    } else {
      return this.processCover(groupId, imageBuffer, mimeType);
    }
  }

  /**
   * Remove imagens antigas do grupo
   */
  async removeOldImages(groupId: string, imageType: ImageType): Promise<void> {
    const groupDir = path.join(this.uploadsDir, groupId);
    if (!fs.existsSync(groupDir)) {
      return;
    }

    const files = fs.readdirSync(groupDir);
    const prefix = imageType === 'avatar' ? 'avatar_' : 'cover_';

    for (const file of files) {
      if (file.startsWith(prefix)) {
        const filePath = path.join(groupDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          // Ignorar erros ao remover arquivos antigos
          console.warn(`Erro ao remover arquivo antigo: ${filePath}`, err);
        }
      }
    }
  }
}

export const groupImageService = new GroupImageService();

