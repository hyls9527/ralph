import { FocusTrap } from '../../lib/focus-trap';
import { useEffect, useRef, useState } from 'react';

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
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setIsClosing(false);
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        containerRef.current?.focus({ preventScroll: true });
      });
    }
  }, [open]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onOpenChange(false);
      setShouldRender(false);
      previousFocusRef.current?.focus({ preventScroll: true });
    }, 150);
  };

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center ${
        isClosing ? 'opacity-0' : 'animate-backdrop-enter'
      }`}
      onClick={closeOnClickOutside ? handleClose : undefined}
      role="presentation"
      style={{ transition: 'opacity 0.15s ease-in' }}
    >
      <FocusTrap
        active={open && !isClosing}
        focusTrapOptions={{
          onDeactivate: handleClose,
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
          className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            isClosing ? 'animate-modal-exit' : 'animate-modal-enter'
          }`}
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
