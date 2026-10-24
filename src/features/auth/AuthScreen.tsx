import type { ReactNode } from 'react';
import { LangSwitch } from '../../i18n/LangSwitch';

/** Common frame of the sign-in screens: app icon plus the language switch. */
export function AuthScreen({ children, top }: { children: ReactNode; top?: boolean }) {
  return (
    <main className={`auth${top ? ' top' : ''}`}>
      <div className="auth-top">
        <img className="auth-logo" src="/favicon.svg" alt="Casa" width={72} height={72} />
        <LangSwitch />
      </div>
      {children}
    </main>
  );
}
