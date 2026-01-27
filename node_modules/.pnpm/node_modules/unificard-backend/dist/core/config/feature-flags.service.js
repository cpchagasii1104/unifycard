"use strict";
// src/core/config/feature-flags.service.ts
// Serviço de feature flags simples
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlagsService = void 0;
const staging_config_1 = require("./staging.config");
class FeatureFlagsService {
    /**
     * Verifica se o fundo regional está visível
     */
    isFundVisibilityEnabled() {
        return staging_config_1.stagingConfig.fundVisibilityEnabled;
    }
}
exports.featureFlagsService = new FeatureFlagsService();
