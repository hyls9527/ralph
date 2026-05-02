import { FocusTrap } from '../../lib/focus-trap';
import { useEffect, useRef } from 'react';

interface AccessibleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  closeOnEscape = true,
  closeOnClickOutside = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        containerRef.current?.focus({ preventScroll: true });
      });

      return () => {
        previousFocusRef.current?.focus({ preventScroll: true });
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={closeOnClickOutside ? () => onOpenChange(false) : undefined}
      role="presentation"
    >
      <FocusTrap
        active={open}
        focusTrapOptions={{
          onDeactivate: () => onOpenChange(false),
          escapeDeactivates: closeOnEscape,
        }}
      >
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby={description ? 'modal-description' : undefined}
          tabIndex={-1}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="modal-title" className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
            {title}
          </h2>

          {description && (
            <p id="modal-description" className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {description}
            </p>
          )}

          {children}
        </div>
      </FocusTrap>
    </div>
  );
};
