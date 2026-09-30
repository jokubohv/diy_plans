/** SSR render helper: guide-ui tests must not need jsdom (packet C). */
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/** Extract the first tag containing the given attribute fragment, for attribute assertions. */
export function extractTag(html: string, fragment: string): string {
  const index = html.indexOf(fragment);
  if (index === -1) return '';
  const start = html.lastIndexOf('<', index);
  const end = html.indexOf('>', index);
  if (start === -1 || end === -1) return '';
  return html.slice(start, end + 1);
}

export function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
