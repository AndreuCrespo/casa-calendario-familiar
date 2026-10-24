// CSS custom properties in style props (style={{ '--c': color }}) without casts.
import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
