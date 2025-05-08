import { getAuth } from '@clerk/react-router/ssr.server';
import { Trans } from '@lingui/react/macro';
import { Link, data, redirect } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import {
  IS_GOOGLE_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  OIDC_PROVIDER_LABEL,
} from '@documenso/lib/constants/auth';
import { env } from '@documenso/lib/utils/env';

import { SignInForm } from '~/components/forms/signin';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signin';

export function meta() {
  return appMetaTags('Sign In');
}

export async function loader(args: Route.LoaderArgs) {
  const request = args.request;
  const { getToken } = await getAuth(args);
  let { isAuthenticated } = await getOptionalSession(request);

  const responseHeaders = new Headers();

  // currently only running this on the sign-in page, but it could be done elsewhere.
  if (!isAuthenticated) {
    const res = await authClient.client.clerk.sync.$post(undefined, {
      headers: { Authorization: `Bearer ${await getToken()}` },
    });

    // since this is a server side request we need to extract the set-cookie header
    const setCookieFromSync = res.headers.getSetCookie();

    // take the set cookie headers from the response & map to new headers
    if (setCookieFromSync && setCookieFromSync.length > 0) {
      setCookieFromSync.forEach((cookie) => {
        responseHeaders.append('Set-Cookie', cookie);
      });
    }
    // re-eval our auth state
    isAuthenticated = (await getOptionalSession(request)).isAuthenticated;
  }

  // SSR env variables.
  const isGoogleSSOEnabled = IS_GOOGLE_SSO_ENABLED;
  const isOIDCSSOEnabled = IS_OIDC_SSO_ENABLED;
  const oidcProviderLabel = OIDC_PROVIDER_LABEL;

  // pass our new headers to the redirect
  if (isAuthenticated) {
    throw redirect('/documents', { headers: responseHeaders });
  }

  // return the data with our new headers from the loader
  return data(
    {
      isGoogleSSOEnabled,
      isOIDCSSOEnabled,
      oidcProviderLabel,
    },
    {
      headers: responseHeaders,
    },
  );
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { isGoogleSSOEnabled, isOIDCSSOEnabled, oidcProviderLabel } = loaderData;

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="border-border dark:bg-background z-10 rounded-xl border bg-neutral-100 p-6">
        <h1 className="text-2xl font-semibold">
          <Trans>Sign in to your account</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>Welcome back, we are lucky to have you.</Trans>
        </p>
        <hr className="-mx-6 my-4" />

        <SignInForm
          isGoogleSSOEnabled={isGoogleSSOEnabled}
          isOIDCSSOEnabled={isOIDCSSOEnabled}
          oidcProviderLabel={oidcProviderLabel}
        />

        {env('NEXT_PUBLIC_DISABLE_SIGNUP') !== 'true' && (
          <p className="text-muted-foreground mt-6 text-center text-sm">
            <Trans>
              Don't have an account?{' '}
              <Link to="/signup" className="text-documenso-700 duration-200 hover:opacity-70">
                Sign up
              </Link>
            </Trans>
          </p>
        )}
      </div>
    </div>
  );
}
