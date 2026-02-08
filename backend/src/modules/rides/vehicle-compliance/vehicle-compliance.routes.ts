// src/modules/rides/vehicle-compliance/vehicle-compliance.routes.ts
//
// Rotas Fastify para compliance de documentos de motoristas e veículos.
//
// Tabelas envolvidas (conforme migration 017_rides_driver_vehicle_compliance.sql):
//  - rides_driver_documents
//  - rides_vehicle_documents
//  - (indiretamente) rides_drivers, rides_vehicles
//
// Principais responsabilidades:
//  - listar documentos de motorista / veículo
//  - registrar novos documentos (metadata + file_url)
//  - atualizar status (pending / under_review / approved / rejected / expired)

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { BadRequestError, NotFoundError } from '@core/errors';
import {
  runQueryWithTenant,
  runQueriesWithTenant,
  runTenantTransaction,
} from '@core/db';

type DocumentStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired';

interface DriverDocumentsParams {
  driverId: string;
}

interface VehicleDocumentsParams {
  vehicleId: string;
}

interface DocumentStatusParams {
  documentId: string;
}

interface CreateDriverDocumentBody {
  documentType: string;
  fileUrl: string;
  fileName?: string;
  fileSizeBytes?: number;
  fileMimeType?: string;
  expiresAt?: string;
  extractedData?: any;
}

interface CreateVehicleDocumentBody {
  documentType: string;
  fileUrl: string;
  fileName?: string;
  fileSizeBytes?: number;
  fileMimeType?: string;
  expiresAt?: string;
  extractedData?: any;
}

interface UpdateDocumentStatusBody {
  status: string;
  rejectedReason?: string;
  rejectionCode?: string;
}

interface DriverDocumentRow {
  document_id: string;
  driver_id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  file_size_bytes: number | null;
  file_mime_type: string | null;
  status: string;
  expiresAt: Date | null;
  is_current: boolean;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface VehicleDocumentRow {
  document_id: string;
  vehicle_id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  file_size_bytes: number | null;
  file_mime_type: string | null;
  status: string;
  expiresAt: Date | null;
  is_current: boolean;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleComplianceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ---------------------------------------------------------------------------
  // GET /drivers/:driverId/documents
  // Lista documentos de um motorista
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: DriverDocumentsParams }>(
    '/drivers/:driverId/documents',
    {
      preHandler: [fastify.requirePermission(['rides:vehicle-compliance:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const { driverId } = req.params;

      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const rows = await runQueriesWithTenant<DriverDocumentRow>(tenantId, {
        text: `
          SELECT
            document_id,
            driver_id,
            document_type,
            file_url,
            file_name,
            file_size_bytes,
            file_mime_type,
            status,
            expiresAt,
            is_current,
            uploadedAt,
            createdAt,
            updatedAt
          FROM rides_driver_documents
          WHERE driver_id = $1
          ORDER BY uploadedAt DESC;
        `,
        values: [driverId],
      });

      return reply.send(rows);
    }
  );

  // ---------------------------------------------------------------------------
  // POST /drivers/:driverId/documents
  // Cria um novo documento de motorista
  // ---------------------------------------------------------------------------
  fastify.post<{ Params: DriverDocumentsParams; Body: CreateDriverDocumentBody }>(
    '/drivers/:driverId/documents',
    {
      preHandler: [fastify.requirePermission(['rides:vehicle-compliance:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const { driverId } = req.params;

      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const {
        documentType,
        fileUrl,
        fileName,
        fileSizeBytes,
        fileMimeType,
        expiresAt,
        extractedData,
      } = req.body;

      if (!documentType) {
        throw new BadRequestError('documentType is required');
      }
      if (!fileUrl) {
        throw new BadRequestError('fileUrl is required');
      }

      const rows = await runTenantTransaction(tenantId, async (trx) => {
        // conferir se driver existe
        const driver = await trx.query({
          text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE driver_id = $1
            LIMIT 1;
          `,
          values: [driverId],
        });

        if (driver.rows.length === 0) {
          throw new NotFoundError('Driver not found');
        }

        // invalidar documento atual do mesmo tipo (is_current = false)
        await trx.query({
          text: `
            UPDATE rides_driver_documents
            SET is_current = false, updatedAt = now()
            WHERE driver_id = $1
              AND document_type = $2
              AND is_current = true;
          `,
          values: [driverId, documentType],
        });

        const result = await trx.query({
          text: `
            INSERT INTO rides_driver_documents (
              tenant_id,
              driver_id,
              document_type,
              file_url,
              file_name,
              file_size_bytes,
              file_mime_type,
              extracted_data,
              expiresAt,
              status,
              is_current
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              COALESCE($8::jsonb, '{}'::jsonb),
              $9,
              'pending',
              true
            )
            RETURNING
              document_id,
              driver_id,
              document_type,
              file_url,
              file_name,
              file_size_bytes,
              file_mime_type,
              status,
              expiresAt,
              is_current,
              uploadedAt,
              createdAt,
              updatedAt;
          `,
          values: [
            tenantId,
            driverId,
            documentType,
            fileUrl,
            fileName ?? null,
            fileSizeBytes ?? null,
            fileMimeType ?? null,
            extractedData ? JSON.stringify(extractedData) : null,
            expiresAt ?? null,
          ],
        });

        return result.rows;
      });
      
      const document = (rows as DriverDocumentRow[])[0];

      if (!document) {
        throw new Error('Failed to create driver document');
      }

      reply.code(201);
      return document;
    }
  );

  // ---------------------------------------------------------------------------
  // GET /vehicles/:vehicleId/documents
  // Lista documentos de um veículo
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: VehicleDocumentsParams }>(
    '/vehicles/:vehicleId/documents',
    {
      preHandler: [fastify.requirePermission(['rides:vehicle-compliance:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const { vehicleId } = req.params;

      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const rows = await runQueriesWithTenant<VehicleDocumentRow>(tenantId, {
        text: `
          SELECT
            document_id,
            vehicle_id,
            document_type,
            file_url,
            file_name,
            file_size_bytes,
            file_mime_type,
            status,
            expiresAt,
            is_current,
            uploadedAt,
            createdAt,
            updatedAt
          FROM rides_vehicle_documents
          WHERE vehicle_id = $1
          ORDER BY uploadedAt DESC;
        `,
        values: [vehicleId],
      });

      return reply.send(rows);
    }
  );

  // ---------------------------------------------------------------------------
  // POST /vehicles/:vehicleId/documents
  // Cria novo documento de veículo
  // ---------------------------------------------------------------------------
  fastify.post<{ Params: VehicleDocumentsParams; Body: CreateVehicleDocumentBody }>(
    '/vehicles/:vehicleId/documents',
    {
      preHandler: [fastify.requirePermission(['rides:vehicle-compliance:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const { vehicleId } = req.params;

      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const {
        documentType,
        fileUrl,
        fileName,
        fileSizeBytes,
        fileMimeType,
        expiresAt,
        extractedData,
      } = req.body;

      if (!documentType) {
        throw new BadRequestError('documentType is required');
      }
      if (!fileUrl) {
        throw new BadRequestError('fileUrl is required');
      }

      const vehicleDocRows = await runTenantTransaction(tenantId, async (trx) => {
        // conferir se vehicle existe
        const vehicle = await trx.query({
          text: `
            SELECT vehicle_id
            FROM rides_vehicles
            WHERE vehicle_id = $1
            LIMIT 1;
          `,
          values: [vehicleId],
        });

        if (vehicle.rows.length === 0) {
          throw new NotFoundError('Vehicle not found');
        }

        // invalidar documento atual do mesmo tipo
        await trx.query({
          text: `
            UPDATE rides_vehicle_documents
            SET is_current = false, updatedAt = now()
            WHERE vehicle_id = $1
              AND document_type = $2
              AND is_current = true;
          `,
          values: [vehicleId, documentType],
        });

        const result = await trx.query({
          text: `
            INSERT INTO rides_vehicle_documents (
              tenant_id,
              vehicle_id,
              document_type,
              file_url,
              file_name,
              file_size_bytes,
              file_mime_type,
              extracted_data,
              expiresAt,
              status,
              is_current
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              COALESCE($8::jsonb, '{}'::jsonb),
              $9,
              'pending',
              true
            )
            RETURNING
              document_id,
              vehicle_id,
              document_type,
              file_url,
              file_name,
              file_size_bytes,
              file_mime_type,
              status,
              expiresAt,
              is_current,
              uploadedAt,
              createdAt,
              updatedAt;
          `,
          values: [
            tenantId,
            vehicleId,
            documentType,
            fileUrl,
            fileName ?? null,
            fileSizeBytes ?? null,
            fileMimeType ?? null,
            extractedData ? JSON.stringify(extractedData) : null,
            expiresAt ?? null,
          ],
        });

        return result.rows;
      });
      
      const document = (vehicleDocRows as VehicleDocumentRow[])[0];

      if (!document) {
        throw new Error('Failed to create vehicle document');
      }

      reply.code(201);
      return document;
    }
  );

  // ---------------------------------------------------------------------------
  // PATCH /driver-documents/:documentId/status
  // Atualiza status de documento de motorista (para backoffice, revisão, etc.)
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: DocumentStatusParams; Body: UpdateDocumentStatusBody }>(
    '/driver-documents/:documentId/status',
    {
      preHandler: [fastify.requirePermission(['rides:vehicle-compliance:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const { documentId } = req.params;
      const { status, rejectedReason, rejectionCode } = req.body;

      if (!tenantId) throw new BadRequestError('Missing tenant context');
      if (!status) throw new BadRequestError('status is required');

      const normalized = String(status).toLowerCase() as DocumentStatus;
      const allowed: DocumentStatus[] = [
        'pending',
        'under_review',
        'approved',
        'rejected',
        'expired',
      ];

      if (!allowed.includes(normalized)) {
        throw new BadRequestError('Invalid status value');
      }

      const rows = await runQueriesWithTenant<{
        document_id: string;
        driver_id: string;
        document_type: string;
        status: string;
        verifiedAt: Date | null;
        rejected_reason: string | null;
        rejection_code: string | null;
        updatedAt: Date;
      }>(tenantId, {
        text: `
          UPDATE rides_driver_documents
          SET
            status = $2,
            verifiedAt = CASE 
              WHEN $2 IN ('approved', 'rejected') THEN now()
              ELSE verifiedAt
            END,
            rejected_reason = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejected_reason END,
            rejection_code = CASE WHEN $2 = 'rejected' THEN $4 ELSE rejection_code END,
            updatedAt = now()
          WHERE document_id = $1
          RETURNING
            document_id,
            driver_id,
            document_type,
            status,
            verifiedAt,
            rejected_reason,
            rejection_code,
            updatedAt;
        `,
        values: [documentId, normalized, rejectedReason ?? null, rejectionCode ?? null],
      });

      if (rows.length === 0) {
        throw new NotFoundError('Driver document not found');
      }

      return reply.send(rows[0]);
    }
  );

  // ---------------------------------------------------------------------------
  // PATCH /vehicle-documents/:documentId/status
  // Atualiza status de documento de veículo
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: DocumentStatusParams; Body: UpdateDocumentStatusBody }>(
    '/vehicle-documents/:documentId/status',
    {
      preHandler: [fastify.requirePermission(['rides:vehicle-compliance:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const { documentId } = req.params;
      const { status, rejectedReason, rejectionCode } = req.body;

      if (!tenantId) throw new BadRequestError('Missing tenant context');
      if (!status) throw new BadRequestError('status is required');

      const normalized = String(status).toLowerCase() as DocumentStatus;
      const allowed: DocumentStatus[] = [
        'pending',
        'under_review',
        'approved',
        'rejected',
        'expired',
      ];

      if (!allowed.includes(normalized)) {
        throw new BadRequestError('Invalid status value');
      }

      const rows = await runQueriesWithTenant<{
        document_id: string;
        vehicle_id: string;
        document_type: string;
        status: string;
        verifiedAt: Date | null;
        rejected_reason: string | null;
        rejection_code: string | null;
        updatedAt: Date;
      }>(tenantId, {
        text: `
          UPDATE rides_vehicle_documents
          SET
            status = $2,
            verifiedAt = CASE 
              WHEN $2 IN ('approved', 'rejected') THEN now()
              ELSE verifiedAt
            END,
            rejected_reason = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejected_reason END,
            rejection_code = CASE WHEN $2 = 'rejected' THEN $4 ELSE rejection_code END,
            updatedAt = now()
          WHERE document_id = $1
          RETURNING
            document_id,
            vehicle_id,
            document_type,
            status,
            verifiedAt,
            rejected_reason,
            rejection_code,
            updatedAt;
        `,
        values: [documentId, normalized, rejectedReason ?? null, rejectionCode ?? null],
      });

      if (rows.length === 0) {
        throw new NotFoundError('Vehicle document not found');
      }

      return reply.send(rows[0]);
    }
  );
};

export default vehicleComplianceRoutes;

