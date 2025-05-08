import { createClerkClient } from '@clerk/react-router/api.server';
import { Hono } from 'hono';

import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { onAuthorize } from '../lib/utils/authorizer';
import type { HonoAuthContext } from '../types/context';

// This route is to handle "syncing" the Clerk sign-in with the local sign-in
export const clerkRoute = new Hono<HonoAuthContext>().post('/sync', async (c) => {
  try {
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    });
    // auth the request to extract our Clerk session details.
    const { isSignedIn, toAuth } = await clerkClient.authenticateRequest(c.req.raw);

    if (!isSignedIn) {
      // add logic here to handle the case where the user is not signed in to Clerk.
      throw new AppError(AuthenticationErrorCode.InvalidCredentials, {
        message: 'Not signed into Clerk',
      });
    }

    const { sessionClaims } = toAuth();

    // email needs to be added the session claims in the Clerk dashboard.
    const { email } = sessionClaims;

    if (!email || typeof email !== 'string') return c.json({ message: 'email_missing' });

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!user) {
      throw new AppError(AuthenticationErrorCode.InvalidCredentials, {
        message: 'Invalid email',
      });
    }

    // create the session locally on the request/context
    await onAuthorize({ userId: user.id }, c);

    return c.text('', 201);
  } catch (e) {
    console.log(e);
    return c.json({ message: 'wooops' });
  }
});
