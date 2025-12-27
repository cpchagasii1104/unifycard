"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entityParamsSchema = void 0;
// src/core/reputation/reputation.schemas.ts
const zod_1 = require("zod");
exports.entityParamsSchema = zod_1.z.object({
    entityType: zod_1.z.string().min(1).max(50),
    entityId: zod_1.z.string().uuid('Invalid entity ID'),
});
//# sourceMappingURL=reputation.schemas.js.map