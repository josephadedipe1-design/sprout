'use client';

import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for inline rendering (no block wrappers)
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Custom underline extension: ++text++ → <u>text</u>
const underlineExtension = {
  name: 'underline',
  level: 'inline' as const,
  start(src: string) { return src.indexOf('++'); },
  tokenizer(src: string) {
    const match = /^\+\+([^+]+)\+\+/.exec(src);
    if (match) {
      return {
        type: 'underline',
        raw: match[0],
        text: match[1],
        tokens: [],
      } as any;
    }
    return undefined;
  },
  renderer(token: any) {
    return `<u>${token.text}</u>`;
  },
};

marked.use({ extensions: [underlineExtension] });

export function renderAnnouncementMarkdown(raw: string): string {
  const html = marked.parse(raw, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'p', 'span', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}
