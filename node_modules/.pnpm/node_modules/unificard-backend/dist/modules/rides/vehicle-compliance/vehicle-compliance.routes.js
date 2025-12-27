"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const db_1 = require("@core/db");
const vehicleComplianceRoutes = async (fastify) => {
    // ---------------------------------------------------------------------------
    // GET /drivers/:driverId/documents
    // Lista documentos de um motorista
    // ---------------------------------------------------------------------------
    fastify.get('/drivers/:driverId/documents', {
        preHandler: [fastify.requirePermission(['rides:vehicle-compliance:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const { driverId } = req.params;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const rows = await (0, db_1.runQueriesWithTenant)(tenantId, {
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
            expires_at,
            is_current,
            uploaded_at,
            created_at,
            updated_at
          FROM rides_driver_documents
          WHERE driver_id = $1
          ORDER BY uploaded_at DESC;
        `,
            values: [driverId],
        });
        return reply.send(rows);
    });
    // ---------------------------------------------------------------------------
    // POST /drivers/:driverId/documents
    // Cria um novo documento de motorista
    // ---------------------------------------------------------------------------
    fastify.post('/drivers/:driverId/documents', {
        preHandler: [fastify.requirePermission(['rides:vehicle-compliance:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const { driverId } = req.params;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { documentType, fileUrl, fileName, fileSizeBytes, fileMimeType, expiresAt, extractedData, } = req.body;
        if (!documentType) {
            throw new errors_1.BadRequestError('documentType is required');
        }
        if (!fileUrl) {
            throw new errors_1.BadRequestError('fileUrl is required');
        }
        const rows = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
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
                throw new errors_1.NotFoundError('Driver not found');
            }
            // invalidar documento atual do mesmo tipo (is_current = false)
            await trx.query({
                text: `
            UPDATE rides_driver_documents
            SET is_current = false, updated_at = now()
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
              expires_at,
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
              expires_at,
              is_current,
              uploaded_at,
              created_at,
              updated_at;
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
        const document = rows[0];
        if (!document) {
            throw new Error('Failed to create driver document');
        }
        reply.code(201);
        return document;
    });
    // ---------------------------------------------------------------------------
    // GET /vehicles/:vehicleId/documents
    // Lista documentos de um veículo
    // ---------------------------------------------------------------------------
    fastify.get('/vehicles/:vehicleId/documents', {
        preHandler: [fastify.requirePermission(['rides:vehicle-compliance:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const { vehicleId } = req.params;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const rows = await (0, db_1.runQueriesWithTenant)(tenantId, {
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
            expires_at,
            is_current,
            uploaded_at,
            created_at,
            updated_at
          FROM rides_vehicle_documents
          WHERE vehicle_id = $1
          ORDER BY uploaded_at DESC;
        `,
            values: [vehicleId],
        });
        return reply.send(rows);
    });
    // ---------------------------------------------------------------------------
    // POST /vehicles/:vehicleId/documents
    // Cria novo documento de veículo
    // ---------------------------------------------------------------------------
    fastify.post('/vehicles/:vehicleId/documents', {
        preHandler: [fastify.requirePermission(['rides:vehicle-compliance:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const { vehicleId } = req.params;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { documentType, fileUrl, fileName, fileSizeBytes, fileMimeType, expiresAt, extractedData, } = req.body;
        if (!documentType) {
            throw new errors_1.BadRequestError('documentType is required');
        }
        if (!fileUrl) {
            throw new errors_1.BadRequestError('fileUrl is required');
        }
        const vehicleDocRows = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
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
                throw new errors_1.NotFoundError('Vehicle not found');
            }
            // invalidar documento atual do mesmo tipo
            await trx.query({
                text: `
            UPDATE rides_vehicle_documents
            SET is_current = false, updated_at = now()
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
              expires_at,
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
              expires_at,
              is_current,
              uploaded_at,
              created_at,
              updated_at;
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
        const document = vehicleDocRows[0];
        if (!document) {
            throw new Error('Failed to create vehicle document');
        }
        reply.code(201);
        return document;
    });
    // ---------------------------------------------------------------------------
    // PATCH /driver-documents/:documentId/status
    // Atualiza status de documento de motorista (para backoffice, revisão, etc.)
    // ---------------------------------------------------------------------------
    fastify.patch('/driver-documents/:documentId/status', {
        preHandler: [fastify.requirePermission(['rides:vehicle-compliance:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const { documentId } = req.params;
        const { status, rejectedReason, rejectionCode } = req.body;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        if (!status)
            throw new errors_1.BadRequestError('status is required');
        const normalized = String(status).toLowerCase();
        const allowed = [
            'pending',
            'under_review',
            'approved',
            'rejected',
            'expired',
        ];
        if (!allowed.includes(normalized)) {
            throw new errors_1.BadRequestError('Invalid status value');
        }
        const rows = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
          UPDATE rides_driver_documents
          SET
            status = $2,
            verified_at = CASE 
              WHEN $2 IN ('approved', 'rejected') THEN now()
              ELSE verified_at
            END,
            rejected_reason = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejected_reason END,
            rejection_code = CASE WHEN $2 = 'rejected' THEN $4 ELSE rejection_code END,
            updated_at = now()
          WHERE document_id = $1
          RETURNING
            document_id,
            driver_id,
            document_type,
            status,
            verified_at,
            rejected_reason,
            rejection_code,
            updated_at;
        `,
            values: [documentId, normalized, rejectedReason ?? null, rejectionCode ?? null],
        });
        if (rows.length === 0) {
            throw new errors_1.NotFoundError('Driver document not found');
        }
        return reply.send(rows[0]);
    });
    // ---------------------------------------------------------------------------
    // PATCH /vehicle-documents/:documentId/status
    // Atualiza status de documento de veículo
    // ---------------------------------------------------------------------------
    fastify.patch('/vehicle-documents/:documentId/status', {
        preHandler: [fastify.requirePermission(['rides:vehicle-compliance:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const { documentId } = req.params;
        const { status, rejectedReason, rejectionCode } = req.body;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        if (!status)
            throw new errors_1.BadRequestError('status is required');
        const normalized = String(status).toLowerCase();
        const allowed = [
            'pending',
            'under_review',
            'approved',
            'rejected',
            'expired',
        ];
        if (!allowed.includes(normalized)) {
            throw new errors_1.BadRequestError('Invalid status value');
        }
        const rows = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
          UPDATE rides_vehicle_documents
          SET
            status = $2,
            verified_at = CASE 
              WHEN $2 IN ('approved', 'rejected') THEN now()
              ELSE verified_at
            END,
            rejected_reason = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejected_reason END,
            rejection_code = CASE WHEN $2 = 'rejected' THEN $4 ELSE rejection_code END,
            updated_at = now()
          WHERE document_id = $1
          RETURNING
            document_id,
            vehicle_id,
            document_type,
            status,
            verified_at,
            rejected_reason,
            rejection_code,
            updated_at;
        `,
            values: [documentId, normalized, rejectedReason ?? null, rejectionCode ?? null],
        });
        if (rows.length === 0) {
            throw new errors_1.NotFoundError('Vehicle document not found');
        }
        return reply.send(rows[0]);
    });
};
exports.default = vehicleComplianceRoutes;
//# sourceMappingURL=vehicle-compliance.routes.js.map