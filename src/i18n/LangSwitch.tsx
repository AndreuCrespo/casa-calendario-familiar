import { Segmented } from '../ui/primitives';
import { LANGS, type Lang, setLang, t, useLang } from '.';

/** ES | EN switch (or full names with `long`). */
export function LangSwitch({ long, onChanged }: { long?: boolean; onChanged?: (lang: Lang) => void }) {
  const lang = useLang();
  return (
    <Segmented
      label={t('settings.language')}
      value={lang}
      block={long}
      options={LANGS.map((l) => ({ id: l.id, label: long ? l.label : l.short, ariaLabel: long ? undefined : l.label }))}
      onChange={async (l) => {
        await setLang(l);
        onChanged?.(l);
      }}
    />
  );
}
