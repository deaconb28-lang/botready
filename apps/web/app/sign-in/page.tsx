import type { Metadata } from 'next';

import { Footer, Nav } from '@/components/primitives';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav />
      <main id="main" className="max-w-[560px] px-5 pb-14 pt-12 sm:px-7">
        <h1 className="text-[22px] font-bold">Sign in</h1>
        <p className="mt-2 text-[15px] text-ink-60">
          Enter your email and we send a one-time link. There is no password. Signing in raises
          the scan allowance to 50 an hour and unlocks any fix pack you have bought.
        </p>
        <SignInForm next={next ?? '/'} initialError={error ?? null} />
      </main>
      <Footer />
    </div>
  );
}
