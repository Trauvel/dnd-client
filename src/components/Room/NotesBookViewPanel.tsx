import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMasterBook, findSectionById, type MasterBookData, type MasterBookSection } from '../../api/masterBook';
import { DraggableWindow } from './DraggableWindow';

interface NotesBookViewPanelProps {
  onClose: () => void;
}

export const NotesBookViewPanel: React.FC<NotesBookViewPanelProps> = ({ onClose }) => {
  const [data, setData] = useState<MasterBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
                  Разделы
                </div>
                {(() => {
                  function renderTree(sections: MasterBookSection[], depth: number) {
                    return sections.map((s) => (
                      <div key={s.id} style={{ marginBottom: 2 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            paddingLeft: 8 + depth * 12,
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
                          {s.title || '—'}
                        </button>
                        {(s.children?.length ?? 0) > 0 && renderTree(s.children ?? [], depth + 1)}
                      </div>
                    ));
                  }
                  return renderTree(data.sections, 0);
                })()}
              </aside>
              <main style={{ flex: 1, overflowY: 'auto', padding: 16, minWidth: 0 }}>
                {selected && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{selected.title || '—'}</div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55 }}>{selected.body || '—'}</div>
                  </>
                )}
              </main>
            </>
          )}
        </div>
    </DraggableWindow>
  );
};
