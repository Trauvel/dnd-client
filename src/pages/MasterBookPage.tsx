import React, { useEffect, useState } from 'react';
import {
  getMasterBook,
  updateMasterBook,
  findSectionById,
  updateSectionInTree,
  removeSectionFromTree,
  addSectionInTree,
  reorderSectionInTree,
  moveSectionInTree,
  getSiblingContext,
  getSectionAndDescendantIds,
  flattenSections,
  sectionOrDescendantMatches,
  getHighlightSegments,
  downloadMasterBookAsJson,
  parseMasterBookFromJson,
  type MasterBookData,
  type MasterBookSection,
} from '../api/masterBook';
import { RichTextEditor } from '../components/RichTextEditor';

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
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  const toggleSectionCollapsed = (id: string) => {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const reorderSection = (id: string, direction: 'up' | 'down') => {
    setData({ sections: reorderSectionInTree(data.sections, id, direction) });
    setDirty(true);
  };

  const setSectionParent = (id: string, newParentId: string | null, index?: number) => {
    const section = findSectionById(data.sections, id);
    if (!section) return;
    const parentChildren = newParentId
      ? (findSectionById(data.sections, newParentId)?.children ?? [])
      : data.sections;
    const pos = typeof index === 'number' ? index : parentChildren.length;
    setData({ sections: moveSectionInTree(data.sections, id, newParentId, pos) });
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {dirty && (
            <span style={{ fontSize: 13, color: '#666' }}>Есть несохранённые изменения</span>
          )}
          <button
            type="button"
            onClick={() => downloadMasterBookAsJson(data)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #0d6efd',
              background: '#fff',
              color: '#0d6efd',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Экспорт JSON
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #28a745',
              background: '#fff',
              color: '#28a745',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Импорт JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text = reader.result as string;
                const imported = parseMasterBookFromJson(text);
                if (imported) {
                  setData(imported);
                  setDirty(true);
                  setSelectedId(imported.sections[0]?.id ?? null);
                  setError(null);
                } else {
                  setError('Неверный формат файла. Ожидается JSON с полем sections.');
                }
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
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
          maxHeight: 'calc(100vh - 220px)',
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
            minHeight: 0,
            borderRight: '1px solid #dee2e6',
            background: '#f8f9fa',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>
            Разделы
          </div>
          {data.sections.length > 0 && (
            <input
              type="text"
              placeholder="Поиск по заголовку и тексту..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                border: '1px solid #dee2e6',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
            />
          )}
          {data.sections.length === 0 ? (
            <div style={{ fontSize: 13, color: '#999' }}>
              Разделов пока нет. Добавьте готовые или создайте свой.
            </div>
          ) : (
            (function renderSectionList(sections: MasterBookSection[], depth: number): React.ReactNode[] {
              const filtered = sections.filter((s) => sectionOrDescendantMatches(s, searchQuery));
              return filtered.flatMap((s) => {
                const siblingCtx = getSiblingContext(data.sections, s.id);
                const canMoveUp = siblingCtx && siblingCtx.index > 0;
                const canMoveDown = siblingCtx && siblingCtx.index < siblingCtx.siblings.length - 1;
                const hasChildren = (s.children?.length ?? 0) > 0;
                const isCollapsed = collapsedSectionIds.has(s.id);
                const titleSegments = searchQuery.trim() ? getHighlightSegments(s.title || '—', searchQuery) : null;
                return (
                  <div key={s.id} style={{ marginBottom: 2 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        borderRadius: 8,
                        background: selectedId === s.id ? '#e7f1ff' : 'transparent',
                        paddingLeft: depth * 12,
                      }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleSectionCollapsed(s.id); }}
                          title={isCollapsed ? 'Развернуть' : 'Свернуть'}
                          style={{
                            padding: '4px 6px',
                            border: 'none',
                            borderRadius: 4,
                            background: isCollapsed ? 'transparent' : '#e9ecef',
                            cursor: 'pointer',
                            color: '#495057',
                            fontSize: 11,
                            lineHeight: 1,
                            minWidth: 22,
                            textAlign: 'center',
                          }}
                        >
                          {isCollapsed ? '▶' : '▼'}
                        </button>
                      ) : (
                        <span style={{ width: 22, minWidth: 22, display: 'inline-block', textAlign: 'center', fontSize: 11, color: 'transparent' }}>·</span>
                      )}
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
                        {titleSegments
                          ? titleSegments.map((seg, i) =>
                              seg.type === 'match' ? (
                                <mark key={i} style={{ background: '#fff3cd', padding: '0 1px', borderRadius: 2 }}>
                                  {seg.value}
                                </mark>
                              ) : (
                                seg.value
                              )
                            )
                          : (s.title || '—')}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); reorderSection(s.id, 'up'); }}
                        disabled={!canMoveUp}
                        title="Поднять выше"
                        style={{
                          padding: '2px 4px',
                          border: 'none',
                          background: 'none',
                          cursor: canMoveUp ? 'pointer' : 'not-allowed',
                          color: canMoveUp ? '#495057' : '#ccc',
                          fontSize: 12,
                          lineHeight: 1,
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); reorderSection(s.id, 'down'); }}
                        disabled={!canMoveDown}
                        title="Опустить ниже"
                        style={{
                          padding: '2px 4px',
                          border: 'none',
                          background: 'none',
                          cursor: canMoveDown ? 'pointer' : 'not-allowed',
                          color: canMoveDown ? '#495057' : '#ccc',
                          fontSize: 12,
                          lineHeight: 1,
                        }}
                      >
                        ↓
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
                    {hasChildren && !isCollapsed && (
                      <div style={{ marginTop: 2 }}>{renderSectionList(s.children!, depth + 1)}</div>
                    )}
                  </div>
                );
              });
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
            minHeight: 0,
            padding: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {selected ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
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
                <div style={{ minWidth: 180 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#666',
                      marginBottom: 6,
                    }}
                  >
                    Родитель
                  </label>
                  <select
                    value={getSiblingContext(data.sections, selected.id)?.parentId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSectionParent(selected.id, v || null);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 14,
                      border: '1px solid #dee2e6',
                      borderRadius: 8,
                      boxSizing: 'border-box',
                      background: '#fff',
                    }}
                  >
                    <option value="">Корень</option>
                    {flattenSections(data.sections)
                      .filter((sec) => !getSectionAndDescendantIds(selected).includes(sec.id))
                      .map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.title || '—'}
                        </option>
                      ))}
                  </select>
                </div>
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
                <RichTextEditor
                  value={selected.body}
                  onChange={(html) => updateSection(selected.id, { body: html })}
                  placeholder="Введите текст раздела... Можно вставлять скриншоты (Ctrl+V)."
                  minHeight={240}
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
