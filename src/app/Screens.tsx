// Full-screen states shown before the app itself.
import type { ReactNode } from 'react';
import { Spinner } from '../ui/primitives';

export function Splash() {
  return (
    <div className="splash">
      <Spinner />
    </div>
  );
}

/** Something went wrong before the app could open, with ways forward. */
export function ProblemScreen({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <main className="auth" role="alert">
      <div>
        <h1>{title}</h1>
        <p className="muted mt-6">{text}</p>
      </div>
      <div className="stack gap-8">{children}</div>
    </main>
  );
}
