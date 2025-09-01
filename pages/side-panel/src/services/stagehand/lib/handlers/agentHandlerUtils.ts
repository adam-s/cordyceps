/**
 * AgentHandler Content Script Functions for Chrome Extension
 *
 * This file contains all functions that execute within the content script context
 * for the AgentHandler Redux implementation. These functions are called via
 * page.evaluate() in the original Playwright implementation and need to be
 * extracted for Chrome extension compatibility.
 */

/**
 * Scroll the window by specified pixels
 */
export const scrollByFunction = ({
  scrollX,
  scrollY,
}: {
  scrollX: number;
  scrollY: number;
}): void => {
  window.scrollBy(scrollX, scrollY);
};

/**
 * Check if an element with the given ID exists in the document
 */
export const checkElementExistsFunction = (id: string): boolean => {
  return !!document.getElementById(id);
};

/**
 * Inject cursor and highlight elements for agent visualization
 */
export const injectCursorAndHighlightFunction = ({
  cursorId,
  highlightId,
}: {
  cursorId: string;
  highlightId: string;
}): void => {
  // Create cursor element
  const cursor = document.createElement('div');
  cursor.id = cursorId;

  // Use the provided SVG for a custom cursor
  cursor.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 28 28" width="28" height="28">
      <polygon fill="#000000" points="9.2,7.3 9.2,18.5 12.2,15.6 12.6,15.5 17.4,15.5"/>
      <rect x="12.5" y="13.6" transform="matrix(0.9221 -0.3871 0.3871 0.9221 -5.7605 6.5909)" width="2" height="8" fill="#000000"/>
    </svg>
  `;

  // Style the cursor
  cursor.style.position = 'absolute';
  cursor.style.top = '0';
  cursor.style.left = '0';
  cursor.style.width = '28px';
  cursor.style.height = '28px';
  cursor.style.pointerEvents = 'none';
  cursor.style.zIndex = '9999999';
  cursor.style.transform = 'translate(-4px, -4px)'; // Adjust to align the pointer tip

  // Create highlight element for click animation
  const highlight = document.createElement('div');
  highlight.id = highlightId;
  highlight.style.position = 'absolute';
  highlight.style.width = '20px';
  highlight.style.height = '20px';
  highlight.style.borderRadius = '50%';
  highlight.style.backgroundColor = 'rgba(66, 134, 244, 0)';
  highlight.style.transform = 'translate(-50%, -50%) scale(0)';
  highlight.style.pointerEvents = 'none';
  highlight.style.zIndex = '9999998';
  highlight.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
  highlight.style.opacity = '0';

  // Add elements to the document
  document.body.appendChild(cursor);
  document.body.appendChild(highlight);

  // Add a function to update cursor position
  const windowWithCursor = window as Window & {
    __updateCursorPosition?: (x: number, y: number) => void;
  };
  windowWithCursor.__updateCursorPosition = function (x: number, y: number) {
    if (cursor) {
      cursor.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
    }
  };

  // Add a function to animate click
  const windowWithClick = window as Window & {
    __animateClick?: (x: number, y: number) => void;
  };
  windowWithClick.__animateClick = function (x: number, y: number) {
    if (highlight) {
      highlight.style.left = `${x}px`;
      highlight.style.top = `${y}px`;
      highlight.style.transform = 'translate(-50%, -50%) scale(1)';
      highlight.style.opacity = '1';

      setTimeout(() => {
        highlight.style.transform = 'translate(-50%, -50%) scale(0)';
        highlight.style.opacity = '0';
      }, 300);
    }
  };
};

/**
 * Update cursor position on the page
 */
export const updateCursorPositionFunction = ({ x, y }: { x: number; y: number }): void => {
  const windowWithCursor = window as Window & {
    __updateCursorPosition?: (x: number, y: number) => void;
  };

  if (windowWithCursor.__updateCursorPosition) {
    windowWithCursor.__updateCursorPosition(x, y);
  }
};

/**
 * Animate click at specified coordinates
 */
export const animateClickFunction = ({ x, y }: { x: number; y: number }): void => {
  const windowWithClick = window as Window & {
    __animateClick?: (x: number, y: number) => void;
  };

  if (windowWithClick.__animateClick) {
    windowWithClick.__animateClick(x, y);
  }
};
