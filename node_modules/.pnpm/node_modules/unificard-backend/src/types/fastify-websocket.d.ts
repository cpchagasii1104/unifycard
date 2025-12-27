// src/types/fastify-websocket.d.ts
// Extensões de tipos para @fastify/websocket

import 'fastify';
import { SocketStream } from '@fastify/websocket';

declare module 'fastify' {
  interface RouteShorthandOptions {
    websocket?: boolean;
  }

  interface FastifyRequest {
    tenant?: {
      id: string;
      name?: string;
    };
    user?: {
      id: string;
      email?: string;
      globalUserId?: string;
    };
    requestId?: string;
  }
}








