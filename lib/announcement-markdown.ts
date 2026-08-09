'use client';

import { marked, Renderer } from 'marked';
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

// Override the built-in link renderer to add target="_blank" + rel and reject non-http(s) URLs
const renderer = new Renderer();
renderer.link = ({ href, tokens }: any) => {
  const text = (tokens || []).map((t: any) => t.raw || t.text || '').join('') || '';
  if (!href || !/^https?:\/\//i.test(href)) {
    return text;
  }
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

marked.use({ extensions: [underlineExtension], renderer });

export function renderAnnouncementMarkdown(raw: string): string {
  const html = marked.parse(raw, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'u', 'br', 'p', 'span', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}
