import React, { useEffect, useState } from 'react';
import {
  getMasterBook,
  updateMasterBook,
  findSectionById,
  updateSectionInTree,
  removeSectionFromTree,
  addSectionInTree,
  type MasterBookData,
  type MasterBookSection,
} from '../api/masterBook';

function generateId(): string {
  return `mb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_SECTION_TITLES = ['Расы', 'Заметки о бое', 'Общие заметки'];

const MasterBookPage: React.FC = () => {
  const [data, setData] = useState<MasterBookData>({ sections: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const book = await getMasterBook();
      setData(book);
      if (book.sections.length > 0 && !selectedId) {
        setSelectedId(book.sections[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки книги мастера');
    } finally {
      setLoading(false);
    }
  };

  const addSection = (parentId?: string | null, title?: string) => {
    const newSection: MasterBookSection = {
      id: generateId(),
      title: title ?? 'Новый раздел',
      body: '',
      children: [],
    };
    const next = { sections: addSectionInTree(data.sections, newSection, parentId) };
    setData(next);
    setSelectedId(newSection.id);
    setDirty(true);
  };

  const addDefaultSections = () => {
    const flatTitles = (sections: MasterBookSection[]): string[] =>
      sections.flatMap((s) => [s.title, ...flatTitles(s.children ?? [])]);
    const existing = flatTitles(data.sections);
    const toAdd = DEFAULT_SECTION_TITLES.filter((t) => !existing.includes(t)).map((title) => ({
      id: generateId(),
      title,
      body: '',
      children: [],
    }));
    if (toAdd.length === 0) return;
    let nextSections = data.sections;
    for (const sec of toAdd) nextSections = addSectionInTree(nextSections, sec, null);
    setData({ sections: nextSections });
    if (!selectedId && toAdd.length > 0) setSelectedId(toAdd[0].id);
    setDirty(true);
  };

  const removeSection = (id: string) => {
    const next = removeSectionFromTree(data.sections, id);
    setData({ sections: next });
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
    setDirty(true);
  };

  const updateSection = (id: string, patch: Partial<Pick<MasterBookSection, 'title' | 'body'>>) => {
    setData({ sections: updateSectionInTree(data.sections, id, patch) });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMasterBook(data);
      setData(updated);
      setDirty(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const selected = findSectionById(data.sections, selectedId ?? '');

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
        <p>Загрузка книги мастера...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Книга заметок</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && (
            <span style={{ fontSize: 13, color: '#666' }}>Есть несохранённые изменения</span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: dirty ? '#0d6efd' : '#adb5bd',
              color: '#fff',
              cursor: dirty ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <p style={{ margin: 0, color: '#555', fontSize: 14 }}>
        Ваши заметки и разделы (расы, правила боя, общие заметки). Доступны и в игре по кнопке «Книга».
      </p>

      {error && (
        <div style={{ padding: 12, background: '#f8d7da', color: '#721c24', borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 0,
          minHeight: 400,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Боковая панель — разделы */}
        <aside
          style={{
            width: 220,
            minWidth: 220,
            borderRight: '1px solid #dee2e6',
            background: '#f8f9fa',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>
            Разделы
          </div>
          {data.sections.length === 0 ? (
            <div style={{ fontSize: 13, color: '#999' }}>
              Разделов пока нет. Добавьте готовые или создайте свой.
            </div>
          ) : (
            (function renderSectionList(sections: MasterBookSection[], depth: number) {
              return sections.map((s) => (
                <div key={s.id} style={{ marginBottom: 2 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: 8,
                      background: selectedId === s.id ? '#e7f1ff' : 'transparent',
                      paddingLeft: depth * 12,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: '6px 8px',
                        border: 'none',
                        borderRadius: 8,
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: depth === 0 ? 14 : 13,
                        fontWeight: selectedId === s.id ? 600 : 400,
                        color: selectedId === s.id ? '#0d6efd' : '#333',
                      }}
                    >
                      {s.title || '—'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); addSection(s.id, 'Подраздел'); }}
                      title="Добавить дочернюю заметку"
                      style={{
                        padding: '2px 6px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#0d6efd',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(s.id)}
                      title="Удалить раздел"
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#999',
                        fontSize: 16,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  {(s.children?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 2 }}>{renderSectionList(s.children!, depth + 1)}</div>
                  )}
                </div>
              ));
            })(data.sections, 0)
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => addSection(null)}
              style={{
                padding: '8px 12px',
                border: '1px dashed #adb5bd',
                borderRadius: 8,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                color: '#495057',
              }}
            >
              + Новый раздел
            </button>
            {data.sections.length === 0 && (
              <button
                type="button"
                onClick={addDefaultSections}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#0d6efd',
                }}
              >
                Добавить: Расы, Заметки о бое, Общие заметки
              </button>
            )}
          </div>
        </aside>

        {/* Основная область — редактирование выбранного раздела */}
        <main
          style={{
            flex: 1,
            padding: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {selected ? (
            <>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#666',
                    marginBottom: 6,
                  }}
                >
                  Название раздела
                </label>
                <input
                  type="text"
                  value={selected.title}
                  onChange={(e) => updateSection(selected.id, { title: e.target.value })}
                  placeholder="Например: Расы, Заметки о бое"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 16,
                    border: '1px solid #dee2e6',
                    borderRadius: 8,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#666',
                    marginBottom: 6,
                  }}
                >
                  Содержимое
                </label>
                <textarea
                  value={selected.body}
                  onChange={(e) => updateSection(selected.id, { body: e.target.value })}
                  placeholder="Введите текст раздела..."
                  style={{
                    width: '100%',
                    flex: 1,
                    minHeight: 240,
                    padding: 12,
                    fontSize: 14,
                    lineHeight: 1.5,
                    border: '1px solid #dee2e6',
                    borderRadius: 8,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ color: '#999', fontSize: 14 }}>
              Выберите раздел слева или добавьте новый.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MasterBookPage;
