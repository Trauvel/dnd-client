import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMasterBook, findSectionById, sectionOrDescendantMatches, getHighlightSegments, type MasterBookData, type MasterBookSection } from '../../api/masterBook';
import { DraggableWindow } from './DraggableWindow';
import { RichTextBody } from '../RichTextEditor';

interface NotesBookViewPanelProps {
  onClose: () => void;
}

export const NotesBookViewPanel: React.FC<NotesBookViewPanelProps> = ({ onClose }) => {
  const [data, setData] = useState<MasterBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMasterBook()
      .then((book) => {
        if (!cancelled) {
          setData(book);
          if (book.sections.length > 0 && !selectedId) setSelectedId(book.sections[0]!.id);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Ошибка загрузки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const selected = data ? findSectionById(data.sections, selectedId ?? '') : null;

  return (
    <DraggableWindow
      title="Книга заметок"
      onClose={onClose}
      width={640}
      maxHeight="85vh"
      headerExtra={
        <Link to="/notes-book" style={{ fontSize: 13, color: '#0d6efd', textDecoration: 'none' }}>
          Редактировать на сайте
        </Link>
      }
    >
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 24, color: '#666' }}>Загрузка...</div>
          ) : error ? (
            <div style={{ padding: 24, color: '#dc3545' }}>{error}</div>
          ) : !data || data.sections.length === 0 ? (
            <div style={{ padding: 24, color: '#666' }}>
              Разделов пока нет.{' '}
              <Link to="/notes-book" style={{ color: '#0d6efd' }}>Добавить в Книге заметок</Link>
            </div>
          ) : (
            <>
              <aside
                style={{
                  width: 180,
                  minWidth: 180,
                  borderRight: '1px solid #dee2e6',
                  padding: 12,
                  overflowY: 'auto',
                  background: '#f8f9fa',
                  overflow: 'scroll'
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
                  Разделы
                </div>
                <input
                  type="text"
                  placeholder="Поиск по заголовку и тексту..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #dee2e6', borderRadius: 6, boxSizing: 'border-box', marginBottom: 8 }}
                />
                {(() => {
                  function renderTree(sections: MasterBookSection[], depth: number) {
                    const filtered = sections.filter((s) => sectionOrDescendantMatches(s, searchQuery));
                    return filtered.map((s) => {
                      const hasChildren = (s.children?.length ?? 0) > 0;
                      const isCollapsed = collapsedIds.has(s.id);
                      const titleSegments = searchQuery.trim() ? getHighlightSegments(s.title || '—', searchQuery) : null;
                      return (
                        <div key={s.id} style={{ marginBottom: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 12 }}>
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleCollapsed(s.id); }}
                                title={isCollapsed ? 'Развернуть' : 'Свернуть'}
                                style={{ padding: '2px 4px', border: 'none', background: 'none', cursor: 'pointer', color: '#666', fontSize: 10, lineHeight: 1, flexShrink: 0 }}
                              >
                                {isCollapsed ? '▶' : '▼'}
                              </button>
                            ) : (
                              <span style={{ width: 14, display: 'inline-block', textAlign: 'center', fontSize: 10, color: 'transparent' }}>·</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedId(s.id)}
                              style={{
                                flex: 1,
                                textAlign: 'left',
                                padding: '6px 8px',
                                marginBottom: 2,
                                border: 'none',
                                borderRadius: 6,
                                background: selectedId === s.id ? '#e7f1ff' : 'transparent',
                                color: selectedId === s.id ? '#0d6efd' : '#333',
                                fontWeight: selectedId === s.id ? 600 : 400,
                                fontSize: depth === 0 ? 13 : 12,
                                cursor: 'pointer',
                              }}
                            >
                              {titleSegments
                                ? titleSegments.map((seg, i) =>
                                    seg.type === 'match' ? (
                                      <mark key={i} style={{ background: '#fff3cd', padding: '0 1px', borderRadius: 2 }}>{seg.value}</mark>
                                    ) : (
                                      seg.value
                                    )
                                  )
                                : (s.title || '—')}
                            </button>
                          </div>
                          {hasChildren && !isCollapsed && renderTree(s.children ?? [], depth + 1)}
                        </div>
                      );
                    });
                  }
                  return renderTree(data.sections, 0);
                })()}
              </aside>
              <main style={{ flex: 1, overflowY: 'auto', padding: 16, minWidth: 0 }}>
                {selected && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{selected.title || '—'}</div>
                    <RichTextBody html={selected.body ?? ''} />
                  </>
                )}
              </main>
            </>
          )}
        </div>
    </DraggableWindow>
  );
};
