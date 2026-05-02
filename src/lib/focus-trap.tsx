import { FocusTrap as ReactFocusTrap } from 'focus-trap-react';
import { type ReactNode } from 'react';

interface FocusTrapProps {
  active: boolean;
  children: ReactNode;
  focusTrapOptions?: {
    onDeactivate?: () => void;
    escapeDeactivates?: boolean;
    clickOutsideDeactivates?: boolean;
    initialFocus?: string | HTMLElement;
  };
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  active,
  children,
  focusTrapOptions,
}) => {
  return (
    <ReactFocusTrap
      active={active}
      focusTrapOptions={{
        escapeDeactivates: true,
        clickOutsideDeactivates: false,
        ...focusTrapOptions,
      }}
    >
      {children}
    </ReactFocusTrap>
  );
};
