import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Visual viewport follows mobile browser keyboards; layout viewport often does not. */
export function useWebKeyboard() {
  useEffect(() => {
    if (Platform.OS !== 'web' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const style = document.createElement('style');
    style.textContent = `
      body, [aria-modal="true"] { max-height: var(--fit-visible-height); }
      [aria-modal="true"] { top: var(--fit-visible-top); }
    `;
    document.head.appendChild(style);
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--fit-visible-height', `${viewport.height}px`);
        document.documentElement.style.setProperty('--fit-visible-top', `${viewport.offsetTop}px`);
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !['INPUT', 'TEXTAREA'].includes(active.tagName)) return;
        const rect = active.getBoundingClientRect();
        let visibleTop = viewport.offsetTop + 16;
        let visibleBottom = viewport.offsetTop + viewport.height - 16;
        // Fixed headers and save actions reduce the form's scroll area even when
        // the field is technically inside the browser viewport.
        for (let parent = active.parentElement; parent; parent = parent.parentElement) {
          if (!/(auto|scroll|hidden)/.test(getComputedStyle(parent).overflowY)) continue;
          const bounds = parent.getBoundingClientRect();
          visibleTop = Math.max(visibleTop, bounds.top + 16);
          visibleBottom = Math.min(visibleBottom, bounds.bottom - 16);
        }
        if (rect.bottom > visibleBottom || rect.top < visibleTop) active.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    };
    viewport.addEventListener('resize', reveal);
    viewport.addEventListener('scroll', reveal);
    document.addEventListener('focusin', reveal);
    // A growing textarea or a moved caret can become covered without a new focus.
    document.addEventListener('input', reveal);
    document.addEventListener('selectionchange', reveal);
    reveal();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', reveal);
      viewport.removeEventListener('scroll', reveal);
      document.removeEventListener('focusin', reveal);
      document.removeEventListener('input', reveal);
      document.removeEventListener('selectionchange', reveal);
      style.remove();
      document.documentElement.style.removeProperty('--fit-visible-height');
      document.documentElement.style.removeProperty('--fit-visible-top');
    };
  }, []);
}
