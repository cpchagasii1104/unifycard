// src/core/location/index.ts
// Location Core - Exports públicos

export * from './location.types';
export * from './address.types';
export * from './location.service';
export * from './location.validators';
export * from './address-helpers';
export { locationRepository } from './location.repository';
export * from './postal-resolution.types';
export { postalAddressResolverService } from './postal-address-resolver.service';
export { default as locationRoutes } from './location.routes';

