/**
 * Safe lesson renderer.
 *
 * Lesson bodies are bundled content written in a tiny formatting subset. This renderer
 * converts that subset into React elements — it never uses dangerouslySetInnerHTML, so
 * even if a lesson body were ever replaced with user-generated text, no HTML or script
 * could execute. Supported syntax:
 *
 *   ## Heading        ### Sub-heading      - bullet      1. numbered
 *   > callout         **bold**             `code`
 */
import type { ReactNode } from 'react';

type Block =
  | { kind: 'heading'; level: 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }
  | { kind: 'callout'; text: string; tone: 'info' | 'danger' };

export function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let list: { type: 'bullets' | 'numbers'; items: string[] } | null = null;

  const flushParagraph = () => {
    if (buffer.length > 0) {
      blocks.push({ kind: 'paragraph', text: buffer.join(' ') });
      buffer = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list.type === 'bullets' ? { kind: 'bullets', items: list.items } : { kind: 'numbers', items: list.items });
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', level: 4, text: trimmed.slice(4) });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', level: 3, text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith('> ')) {
      flushParagraph();
      flushList();
      const text = trimmed.slice(2);
      blocks.push({ kind: 'callout', text, tone: /never|do not|don’t|scam|risk|warning/i.test(text) ? 'danger' : 'info' });
      continue;
    }
    if (/^[-*] /.test(trimmed)) {
      flushParagraph();
      if (!list || list.type !== 'bullets') {
        flushList();
        list = { type: 'bullets', items: [] };
      }
      list.items.push(trimmed.slice(2));
      continue;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph();
      if (!list || list.type !== 'numbers') {
        flushList();
        list = { type: 'numbers', items: [] };
      }
      list.items.push(trimmed.replace(/^\d+\.\s/, ''));
      continue;
    }
    buffer.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Inline formatting: **bold**, `code`. Built as React nodes, never as HTML strings. */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`b${key++}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={`c${key++}`}>{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({ body, className }: { body: string; className?: string }): JSX.Element {
  const blocks = parseBlocks(body);
  return (
    <div className={className ?? 'lesson-body'}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return block.level === 3 ? <h3 key={index}>{renderInline(block.text)}</h3> : <h4 key={index}>{renderInline(block.text)}</h4>;
          case 'bullets':
            return (
              <ul key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'numbers':
            return (
              <ol key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case 'callout':
            return (
              <div key={index} className={block.tone === 'danger' ? 'callout danger-callout' : 'callout'}>
                <p style={{ margin: 0 }}>{renderInline(block.text)}</p>
              </div>
            );
          case 'paragraph':
          default:
            return <p key={index}>{renderInline(block.text)}</p>;
        }
      })}
    </div>
  );
}
