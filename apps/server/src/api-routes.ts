import { createDb } from './db';

import { contextStorage } from 'hono/context-storage';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { trpcServer } from '@hono/trpc-server';
import { autumnApi } from './routes/autumn';
import { env } from 'cloudflare:workers';
import type { HonoContext } from './ctx';
import { createAuth } from './lib/auth';
import { aiRouter } from './routes/ai';
import { Autumn } from 'autumn-js';
import { Hono } from 'hono';

export const api = new Hono<HonoContext>()
  .use(contextStorage())
  // .use('*', async (c, next) => {
  //   const db = createDb(env.HYPERDRIVE.connectionString);
  //   c.set('db', db);
  //   const auth = createAuth();
  //   c.set('auth', auth);
  //   const session = await auth.api.getSession({ headers: c.req.raw.headers });
  //   c.set('sessionUser', session?.user);

  //   // Bearer token if no session user yet
  //   if (c.req.header('Authorization') && !session?.user) {
  //     const token = c.req.header('Authorization')?.split(' ')[1];

  //     if (token) {
  //       const localJwks = await auth.api.getJwks();
  //       const jwks = createLocalJWKSet(localJwks);

  //       const { payload } = await jwtVerify(token, jwks);
  //       const userId = payload.sub;

  //       if (userId) {
  //         c.set(
  //           'sessionUser',
  //           await db.query.user.findFirst({
  //             where: (user, ops) => {
  //               return ops.eq(user.id, userId);
  //             },
  //           }),
  //         );
  //       }
  //     }
  //   }

  //   const autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
  //   c.set('autumn', autumn);
  //   await next();
  // })
  .route('/ai', aiRouter)
  // .route('/autumn', autumnApi)
  // .on(['GET', 'POST'], '/auth/*', (c) => c.var.auth.handler(c.req.raw))
  // .route(
  //   '/trpc',
  //   new Hono().use(
  //     trpcServer({
  //       endpoint: '/api/trpc',
  //       router: appRouter,
  //       createContext: (_, c) => {
  //         return { c, sessionUser: c.var['sessionUser'], db: c.var['db'] };
  //       },
  //       allowMethodOverride: true,
  //       onError: (opts) => {
  //         console.error('Error in TRPC handler:', opts.error);
  //       },
  //     }),
  //   ),
  // )
  .onError(async (err, c) => {
    if (err instanceof Response) return err;
    console.error('Error in Hono handler:', err);
    return c.json(
      {
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  });
