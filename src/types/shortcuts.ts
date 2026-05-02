export interface ShortcutConfig {
  id: string;
  key: string;
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];

  context: 'global' | 'input' | 'modal' | 'default';

  action: () => void;

  description: {
    zh: string;
    en: string;
  };

  when?: () => boolean;
  enabled?: boolean;
}

export type ShortcutContext = ShortcutConfig['context'];
