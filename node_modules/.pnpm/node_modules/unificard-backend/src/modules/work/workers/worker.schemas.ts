// backend/src/modules/work/workers/worker.schemas.ts

import { z } from 'zod';

export const locationSchema = z.object({
  latitude: z
    .number({
      required_error: 'Latitude is required',
      invalid_type_error: 'Latitude must be a number',
    })
    .min(-90, 'Latitude must be >= -90')
    .max(90, 'Latitude must be <= 90'),
  longitude: z
    .number({
      required_error: 'Longitude is required',
      invalid_type_error: 'Longitude must be a number',
    })
    .min(-180, 'Longitude must be >= -180')
    .max(180, 'Longitude must be <= 180'),
});

export const availabilitySchema = z.record(z.string(), z.array(z.string()));

export const createWorkerSchema = z.object({
  bio: z
    .string()
    .min(1, 'Bio must not be empty')
    .max(2000, 'Bio must be at most 2000 characters')
    .optional(),
  hourlyRate: z
    .number()
    .nonnegative('Hourly rate must be >= 0')
    .max(1_000_000, 'Hourly rate is too high')
    .optional(),
  location: locationSchema.optional(),
  availability: availabilitySchema.optional(),
});

export const updateWorkerSchema = z.object({
  bio: z
    .string()
    .min(1, 'Bio must not be empty')
    .max(2000, 'Bio must be at most 2000 characters')
    .optional(),
  hourlyRate: z
    .number()
    .nonnegative('Hourly rate must be >= 0')
    .max(1_000_000, 'Hourly rate is too high')
    .optional(),
  location: locationSchema.optional(),
  availability: availabilitySchema.optional(),
  isActive: z.boolean().optional(),
});

export const workerIdParamsSchema = z.object({
  workerId: z.string().uuid('Invalid worker ID format'),
});

export const listWorkersQuerySchema = z.object({
  skillId: z.string().uuid('Invalid skill ID format').optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  minReputation: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (!Number.isNaN(v) && v >= 0 && v <= 5),
      'minReputation must be between 0 and 5'
    ),
  lat: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (!Number.isNaN(v) && v >= -90 && v <= 90),
      'lat must be between -90 and 90'
    ),
  lng: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (!Number.isNaN(v) && v >= -180 && v <= 180),
      'lng must be between -180 and 180'
    ),
  radiusKm: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (!Number.isNaN(v) && v > 0),
      'radiusKm must be > 0'
    ),
  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))
    .refine(
      (v) => v === undefined || (!Number.isNaN(v) && v >= 1 && v <= 100),
      'limit must be between 1 and 100'
    ),
  offset: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))
    .refine(
      (v) => v === undefined || (!Number.isNaN(v) && v >= 0),
      'offset must be >= 0'
    ),
});
