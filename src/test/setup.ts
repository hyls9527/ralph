import '@testing-library/jest-dom/vitest';
import React from 'react';
import { flushSync } from 'react-dom';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof React.act !== 'function') {
  (React as Record<string, unknown>).act = (callback: () => void | Promise<void>) => {
    return new Promise<void>((resolve) => {
      flushSync(() => {
        const result = callback();
        if (result instanceof Promise) {
          result.then(() => resolve());
        } else {
          resolve();
        }
      });
    });
  };
}
