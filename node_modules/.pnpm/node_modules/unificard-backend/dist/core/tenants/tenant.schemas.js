"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTenantRegionSchema = void 0;
// src/core/tenants/tenant.schemas.ts
const zod_1 = require("zod");
exports.setTenantRegionSchema = zod_1.z.object({
    countryId: zod_1.z.string().uuid('ID do país inválido').nullable().optional(),
    stateId: zod_1.z.string().uuid('ID do estado inválido').nullable().optional(),
    cityId: zod_1.z.string().uuid('ID da cidade inválida').nullable().optional(),
});
//# sourceMappingURL=tenant.schemas.js.map