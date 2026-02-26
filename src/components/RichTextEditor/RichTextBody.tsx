import React from 'react';
import DOMPurify from 'dompurify';

interface RichTextBodyProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h2', 'h3', 'img'];
const ALLOWED_ATTR = ['src', 'alt', 'title', 'width', 'height', 'class'];

export const RichTextBody: React.FC<RichTextBodyProps> = ({ html, className, style }) => {
  if (!html?.trim()) {
    return <span style={{ color: '#999' }}>—</span>;
  }
  const isPlainText = !/<\s*(p|div|br|strong|em|ul|ol|li|h[1-6]|img)/i.test(html);
  const toShow = isPlainText
    ? html
    : DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ADD_ATTR: ['src'],
      });
  const combinedStyle = {
    fontSize: 14,
    lineHeight: 1.55,
    marginBottom: 12,
    ...style,
  };
  if (isPlainText) {
    return (
      <div className={className} style={{ ...combinedStyle, whiteSpace: 'pre-wrap' }}>
        {html}
      </div>
    );
  }
  return (
    <>
      <div
        className={`rich-text-body ${className ?? ''}`.trim()}
        style={combinedStyle}
        dangerouslySetInnerHTML={{ __html: toShow }}
      />
      <style>{`
        .rich-text-body p { margin: 0 0 0.5em 0; }
        .rich-text-body p:last-child { margin-bottom: 0; }
        .rich-text-body h2 { font-size: 1.25em; margin: 0.75em 0 0.25em 0; }
        .rich-text-body h3 { font-size: 1.1em; margin: 0.5em 0 0.25em 0; }
        .rich-text-body ul, .rich-text-body ol { margin: 0.25em 0; padding-left: 1.5em; }
        .rich-text-body img { max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 8px 0; }
      `}</style>
    </>
  );
};
