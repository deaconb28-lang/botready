import type { Metadata } from 'next';

import { Footer, Measure, Nav, Shell } from '@/components/primitives';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;

  return (
    <Shell>
      <Nav />
      <Measure as="main" className="max-w-[600px] pb-14 pt-10">
        <p id="main" className="label text-ink-60">
          Sign in
        </p>
        <h1 className="display-section mt-3 text-[30px]">One link, no password.</h1>
        <p className="mt-3 text-[15px] text-ink-60">
          Enter your email and we send a one-time link. Signing in raises the scan allowance to 50
          an hour and unlocks any fix pack you have bought.
        </p>
        <SignInForm next={next ?? '/'} initialError={error ?? null} />
      </Measure>
      <Footer />
    </Shell>
  );
}
