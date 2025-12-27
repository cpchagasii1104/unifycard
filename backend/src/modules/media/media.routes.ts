// src/modules/media/media.routes.ts
// Endpoint para upload de mídia (presign ou upload direto)

import { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { runQueryWithTenant } from '@core/database/pool';

const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /media/presign
   * Cria registro de mídia e retorna URL para upload
   * Por enquanto, retorna URL temporária (em produção, usar S3 presign)
   */
  fastify.post<{
    Body: {
      media_type: 'image' | 'video' | 'audio' | 'document';
      file_name: string;
      file_size: number;
      mime_type: string;
    };
  }>('/presign', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const { media_type, file_name, file_size, mime_type } = req.body;

      // Validações básicas
      if (!['image', 'video', 'audio', 'document'].includes(media_type)) {
        return reply.status(400).send({ error: 'Tipo de mídia inválido' });
      }

      if (file_size > 50 * 1024 * 1024) {
        // 50MB max
        return reply.status(400).send({ error: 'Arquivo muito grande (máximo 50MB)' });
      }

      // Gera ID único para a mídia
      const mediaId = uuidv4();

      // Cria registro temporário (sem post_id ainda)
      await runQueryWithTenant(
        req.tenant.id,
        `
        INSERT INTO post_media (
          media_id, tenant_id, media_type, url, file_size, mime_type, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          mediaId,
          req.tenant.id,
          media_type,
          `https://storage.example.com/media/${mediaId}/${file_name}`, // Placeholder
          file_size,
          mime_type,
          JSON.stringify({ file_name }),
        ]
      );

      // Em produção, aqui geraria presign URL do S3
      // Por enquanto, retorna URL de upload direto
      return reply.send({
        media_id: mediaId,
        upload_url: `/api/media/upload/${mediaId}`, // Placeholder
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hora
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao gerar presign');
      return reply.status(500).send({ error: 'Erro ao gerar URL de upload' });
    }
  });

  /**
   * POST /media/upload/:id
   * Upload direto (placeholder - em produção seria S3)
   */
  fastify.post<{
    Params: { id: string };
  }>('/upload/:id', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // Placeholder - em produção, salvaria no S3
    return reply.send({
      success: true,
      media_id: req.params.id,
      url: `https://storage.example.com/media/${req.params.id}`,
    });
  });
};

export default mediaRoutes;
