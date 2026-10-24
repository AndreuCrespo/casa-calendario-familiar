import type { InputHTMLAttributes } from 'react';

/** Text field for an amount in euros (parse it with parseEuros). */
export function MoneyInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'>) {
  return <input type="text" inputMode="decimal" autoComplete="off" maxLength={16} {...props} />;
}
