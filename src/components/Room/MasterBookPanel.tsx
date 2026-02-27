import React, { useState, useEffect } from 'react';
import type { ScenarioScriptData, ScenarioScriptBranch, ScenarioFile } from '../../api/scenarios';
import type { ScenarioNpc } from '../../api/scenarioNpcs';
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
} from '../../api/masterBook';
import { API_CONFIG } from '../../config';
import { DraggableWindow } from './DraggableWindow';
import { RichTextEditor, RichTextBody } from '../RichTextEditor';

function generateId(): string {
  return `mb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface MasterBookPanelProps {
  scriptData: ScenarioScriptData | null;
  scenarioNpcs: ScenarioNpc[];
  scenarioAudios?: ScenarioFile[];
  onClose: () => void;
}

const sideCol = {
  width: 200,
  minWidth: 200,
  borderRight: '1px solid #dee2e6',
  overflowY: 'auto' as const,
  padding: 12,
  background: '#f8f9fa',
};
const rightCol = {
  width: 240,
  minWidth: 240,
  borderLeft: '1px solid #dee2e6',
  overflowY: 'auto' as const,
  padding: 12,
  background: '#f8f9fa',
};

export const MasterBookPanel: React.FC<MasterBookPanelProps> = ({
  scriptData,
  scenarioNpcs,
  scenarioAudios = [],
  onClose,
}) => {
  const hasScenario = scriptData && (scriptData.locations?.length ?? 0) > 0;
  const locations = scriptData?.locations ?? [];
  const situations = scriptData?.situations ?? [];
  const branches = scriptData?.branches ?? [];
  const startId = scriptData?.startLocationId ?? locations[0]?.id ?? null;

  const [currentType, setCurrentType] = useState<'location' | 'situation'>('location');
  const [currentId, setCurrentId] = useState<string | null>(startId);
  const [npcOverlay, setNpcOverlay] = useState<ScenarioNpc | null>(null);
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [notesBookData, setNotesBookData] = useState<MasterBookData | null>(null);
  const [selectedNotesSectionId, setSelectedNotesSectionId] = useState<string | null>(null);
  const [notesSaving, setNotesSaving] = useState(false);
  const [collapsedNotesIds, setCollapsedNotesIds] = useState<Set<string>>(new Set());
  const [notesSearchQuery, setNotesSearchQuery] = useState('');

  const toggleNotesSectionCollapsed = (id: string) => {
    setCollapsedNotesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (hasScenario && startId && !currentId && !selectedNotesSectionId) {
      setCurrentId(startId);
      setCurrentType('location');
    }
  }, [hasScenario, startId, currentId, selectedNotesSectionId]);

  useEffect(() => {
    getMasterBook()
      .then((data) => setNotesBookData(data))
      .catch(() => setNotesBookData({ sections: [] }));
  }, []);

  const saveNotesBook = async () => {
    if (!notesBookData) return;
    setNotesSaving(true);
    try {
      const updated = await updateMasterBook(notesBookData);
      setNotesBookData(updated);
    } finally {
      setNotesSaving(false);
    }
  };

  const updateNotesSection = (id: string, patch: Partial<Pick<MasterBookSection, 'title' | 'body'>>) => {
    if (!notesBookData) return;
    setNotesBookData({ sections: updateSectionInTree(notesBookData.sections, id, patch) });
  };

  const addNotesSection = (parentId?: string | null) => {
    if (!notesBookData) return;
    const newSection: MasterBookSection = {
      id: generateId(),
      title: 'Новая заметка',
      body: '',
      children: [],
    };
    setNotesBookData({ sections: addSectionInTree(notesBookData.sections, newSection, parentId ?? null) });
    setSelectedNotesSectionId(newSection.id);
  };

  const removeNotesSection = (id: string) => {
    if (!notesBookData) return;
    const next = removeSectionFromTree(notesBookData.sections, id);
    setNotesBookData({ sections: next });
    if (selectedNotesSectionId === id) setSelectedNotesSectionId(next[0]?.id ?? null);
  };

  const reorderNotesSection = (id: string, direction: 'up' | 'down') => {
    if (!notesBookData) return;
    setNotesBookData({ sections: reorderSectionInTree(notesBookData.sections, id, direction) });
  };

  const setNotesSectionParent = (id: string, newParentId: string | null) => {
    if (!notesBookData) return;
    const section = findSectionById(notesBookData.sections, id);
    if (!section) return;
    const parentChildren = newParentId
      ? (findSectionById(notesBookData.sections, newParentId)?.children ?? [])
      : notesBookData.sections;
    setNotesBookData({ sections: moveSectionInTree(notesBookData.sections, id, newParentId, parentChildren.length) });
  };

  const currentLocation = currentType === 'location' ? locations.find((l) => l.id === currentId) : null;
  const currentSituation = currentType === 'situation' ? situations.find((s) => s.id === currentId) : null;
  const selectedNotesSection =
    selectedNotesSectionId && notesBookData
      ? findSectionById(notesBookData.sections, selectedNotesSectionId)
      : null;
  const title = selectedNotesSection
    ? selectedNotesSection.title
    : (currentLocation?.title ?? currentSituation?.title ?? '—');
  const body = selectedNotesSection
    ? selectedNotesSection.body
    : (currentLocation?.body ?? currentSituation?.body ?? '');
  const locationNotes = selectedNotesSection ? undefined : currentLocation?.notes;
  const npcIds = selectedNotesSection ? [] : (currentLocation?.npcIds ?? []);
  const npcsHere = scenarioNpcs.filter((n) => npcIds.includes(n.id));

  const handleSelectScenario = (type: 'location' | 'situation', id: string) => {
    setSelectedNotesSectionId(null);
    setCurrentType(type);
    setCurrentId(id);
    setNpcOverlay(null);
  };

  const handleSelectNotesSection = (sectionId: string) => {
    setSelectedNotesSectionId(sectionId);
    setNpcOverlay(null);
  };

  const outBranches = branches.filter(
    (b) => b.fromType === currentType && b.fromId === currentId
  );

  /** Ситуации, привязанные к текущей локации (для правой колонки и навигации) */
  const situationsInCurrentLocation =
    currentType === 'location' && currentId
      ? situations.filter((s) => s.locationId === currentId)
      : [];

  const getLocationTitle = (locId: string | null | undefined) =>
    locId ? locations.find((l) => l.id === locId)?.title ?? '?' : null;

  const handleBranch = (toType: 'location' | 'situation', toId: string) => {
    setCurrentType(toType);
    setCurrentId(toId);
    setNpcOverlay(null);
  };

  const imageUrlForNpc = (npc: ScenarioNpc) => {
    if (npc.imageUrl?.startsWith('http')) return npc.imageUrl;
    if (npc.imageUrl) return `${API_CONFIG.WEBSITE_API_URL}${npc.imageUrl}`;
    return null;
  };

  const branchFromTitle = (b: ScenarioScriptBranch) =>
    b.fromType === 'location'
      ? locations.find((l) => l.id === b.fromId)?.title ?? '?'
      : situations.find((s) => s.id === b.fromId)?.title ?? '?';
  const branchToTitle = (b: ScenarioScriptBranch) =>
    b.toType === 'location'
      ? locations.find((l) => l.id === b.toId)?.title ?? '?'
      : situations.find((s) => s.id === b.toId)?.title ?? '?';

  return (
    <>
    <DraggableWindow
      title="Книга мастера"
      onClose={onClose}
      width={960}
      maxWidth={960}
      maxHeight="90vh"
    >
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Левая колонка — быстрые переходы */}
          <aside style={sideCol}>
            <input
              id="masterbook-import-json"
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const imported = parseMasterBookFromJson(reader.result as string);
                  if (imported) setNotesBookData(imported);
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Книга заметок</div>
              {notesBookData && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => downloadMasterBookAsJson(notesBookData)} style={{ padding: '2px 6px', fontSize: 10, border: '1px solid #0d6efd', background: '#fff', color: '#0d6efd', borderRadius: 4, cursor: 'pointer' }}>Экспорт</button>
                  <button type="button" onClick={() => (document.getElementById('masterbook-import-json') as HTMLInputElement)?.click()} style={{ padding: '2px 6px', fontSize: 10, border: '1px solid #28a745', background: '#fff', color: '#28a745', borderRadius: 4, cursor: 'pointer' }}>Импорт</button>
                </div>
              )}
            </div>
            {notesBookData && notesBookData.sections.length > 0 && (
              <input
                type="text"
                placeholder="Поиск..."
                value={notesSearchQuery}
                onChange={(e) => setNotesSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #dee2e6', borderRadius: 6, boxSizing: 'border-box', marginBottom: 8 }}
              />
            )}
            {!notesBookData ? (
              <div style={{ fontSize: 12, color: '#999' }}>Загрузка…</div>
            ) : notesBookData.sections.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Разделов пока нет</div>
            ) : (
              (() => {
                function renderNotesTree(sections: MasterBookSection[], depth: number) {
                  const filtered = sections.filter((s) => sectionOrDescendantMatches(s, notesSearchQuery));
                  return filtered.map((sec) => {
                    const siblingCtx = notesBookData ? getSiblingContext(notesBookData.sections, sec.id) : null;
                    const canMoveUp = siblingCtx && siblingCtx.index > 0;
                    const canMoveDown = siblingCtx && siblingCtx.index < siblingCtx.siblings.length - 1;
                    const hasChildren = (sec.children?.length ?? 0) > 0;
                    const isCollapsed = collapsedNotesIds.has(sec.id);
                    const titleSegments = notesSearchQuery.trim() ? getHighlightSegments(sec.title || '—', notesSearchQuery) : null;
                    return (
                      <div key={sec.id} style={{ marginBottom: 2 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            paddingLeft: depth * 10,
                            borderRadius: 6,
                            background: selectedNotesSectionId === sec.id ? '#e7f1ff' : 'transparent',
                          }}
                        >
                          {hasChildren ? (
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleNotesSectionCollapsed(sec.id); }} title={isCollapsed ? 'Развернуть' : 'Свернуть'} style={{ padding: '2px 4px', border: 'none', background: 'none', cursor: 'pointer', color: '#666', fontSize: 10, lineHeight: 1, width: 16, textAlign: 'center' }}>{isCollapsed ? '▶' : '▼'}</button>
                          ) : (
                            <span style={{ width: 16, display: 'inline-block', textAlign: 'center', fontSize: 10, color: 'transparent' }}>·</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelectNotesSection(sec.id)}
                            style={{
                              flex: 1,
                              textAlign: 'left',
                              padding: '6px 8px',
                              border: 'none',
                              borderRadius: 6,
                              background: 'none',
                              color: selectedNotesSectionId === sec.id ? '#0d6efd' : '#333',
                              fontWeight: selectedNotesSectionId === sec.id ? 600 : 400,
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
                              : (sec.title || '—')}
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); reorderNotesSection(sec.id, 'up'); }} disabled={!canMoveUp} title="Выше" style={{ padding: '2px 4px', border: 'none', background: 'none', cursor: canMoveUp ? 'pointer' : 'not-allowed', color: canMoveUp ? '#495057' : '#ccc', fontSize: 11 }}>↑</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); reorderNotesSection(sec.id, 'down'); }} disabled={!canMoveDown} title="Ниже" style={{ padding: '2px 4px', border: 'none', background: 'none', cursor: canMoveDown ? 'pointer' : 'not-allowed', color: canMoveDown ? '#495057' : '#ccc', fontSize: 11 }}>↓</button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); addNotesSection(sec.id); }}
                            title="Добавить дочернюю"
                            style={{ padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', color: '#0d6efd', fontSize: 14 }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeNotesSection(sec.id)}
                            title="Удалить"
                            style={{ padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 14 }}
                          >
                            ×
                          </button>
                        </div>
                        {hasChildren && !isCollapsed && <div style={{ marginTop: 2 }}>{renderNotesTree(sec.children!, depth + 1)}</div>}
                      </div>
                    );
                  });
                }
                return renderNotesTree(notesBookData.sections, 0);
              })()
            )}
            {notesBookData && (
              <button
                type="button"
                onClick={() => addNotesSection(null)}
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  border: '1px dashed #adb5bd',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#495057',
                }}
              >
                + Новый раздел
              </button>
            )}
            {hasScenario && (
              <>
                <div style={{ marginTop: 12, marginBottom: 12, borderTop: '1px solid #dee2e6' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>Локации и ситуации</div>
              </>
            )}
            {hasScenario && (
              <>
            {locations.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Нет</div>}
            {locations.map((loc) => {
              const isLocActive = currentType === 'location' && currentId === loc.id;
              const locSituations = situations.filter((s) => s.locationId === loc.id);
              return (
                <div key={loc.id} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleSelectScenario('location', loc.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      border: 'none',
                      borderRadius: 6,
                      background: isLocActive ? '#e7f1ff' : 'transparent',
                      color: isLocActive ? '#0d6efd' : '#333',
                      fontWeight: isLocActive ? 600 : 400,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {loc.title || '—'}
                  </button>
                  {locSituations.length > 0 && (
                    <div style={{ marginLeft: 12, marginTop: 2 }}>
                      {locSituations.map((sit) => {
                        const isSitActive = currentType === 'situation' && currentId === sit.id;
                        return (
                          <button
                            key={sit.id}
                            type="button"
                            onClick={() => handleSelectScenario('situation', sit.id)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '4px 8px',
                              marginBottom: 2,
                              border: 'none',
                              borderRadius: 4,
                              background: isSitActive ? '#e7f1ff' : 'transparent',
                              color: isSitActive ? '#0d6efd' : '#555',
                              fontWeight: isSitActive ? 600 : 400,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            {sit.title || '—'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {situations.some((s) => !s.locationId) && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' }}>Без локации</div>
                {situations.filter((s) => !s.locationId).map((sit) => {
                  const isActive = currentType === 'situation' && currentId === sit.id;
                  return (
                    <button
                      key={sit.id}
                      type="button"
                      onClick={() => handleSelectScenario('situation', sit.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '4px 8px',
                        marginBottom: 2,
                        border: 'none',
                        borderRadius: 4,
                        background: isActive ? '#e7f1ff' : 'transparent',
                        color: isActive ? '#0d6efd' : '#555',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {sit.title || '—'}
                    </button>
                  );
                })}
              </>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' }}>NPC (враги / союзники)</div>
            {scenarioNpcs.filter((n) => n.npcKinds?.includes('enemy') || n.npcKinds?.includes('ally')).length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Нет</div>}
            {scenarioNpcs.filter((n) => n.npcKinds?.includes('enemy') || n.npcKinds?.includes('ally')).map((npc) => (
              <button
                key={npc.id}
                type="button"
                onClick={() => setNpcOverlay(npc)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  marginBottom: 4,
                  border: 'none',
                  borderRadius: 6,
                  background: 'transparent',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {npc.name}
              </button>
            ))}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' }}>Персонажи мастера</div>
            {scenarioNpcs.filter((n) => n.npcKinds?.includes('story')).length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Нет</div>}
            {scenarioNpcs.filter((n) => n.npcKinds?.includes('story')).map((npc) => (
              <button
                key={npc.id}
                type="button"
                onClick={() => setNpcOverlay(npc)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  marginBottom: 4,
                  border: 'none',
                  borderRadius: 6,
                  background: 'transparent',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {npc.name}
              </button>
            ))}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' }}>Переходы</div>
            {branches.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Нет</div>}
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleBranch(b.toType, b.toId)}
                title={`Перейти: ${branchToTitle(b)}`}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  marginBottom: 4,
                  border: 'none',
                  borderRadius: 6,
                  background: 'transparent',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#555',
                }}
              >
                {branchFromTitle(b)} → <strong>{b.label}</strong>
              </button>
            ))}
              </>
            )}
          </aside>

          {/* Центр — текст текущей локации/ситуации или редактирование заметки */}
          <main style={{ flex: 1, overflowY: 'auto', padding: 16, minWidth: 0 }}>
            {selectedNotesSection ? (
              <>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Редактирование раздела книги заметок</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: '1 1 180px' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Название</label>
                    <input
                      type="text"
                      value={selectedNotesSection.title}
                      onChange={(e) => updateNotesSection(selectedNotesSection.id, { title: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 16, border: '1px solid #dee2e6', borderRadius: 8, boxSizing: 'border-box' }}
                    />
                  </div>
                  {notesBookData && (
                    <div style={{ minWidth: 140 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Родитель</label>
                      <select
                        value={getSiblingContext(notesBookData.sections, selectedNotesSection.id)?.parentId ?? ''}
                        onChange={(e) => setNotesSectionParent(selectedNotesSection.id, e.target.value || null)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #dee2e6', borderRadius: 8, boxSizing: 'border-box', background: '#fff' }}
                      >
                        <option value="">Корень</option>
                        {flattenSections(notesBookData.sections)
                          .filter((sec) => !getSectionAndDescendantIds(selectedNotesSection).includes(sec.id))
                          .map((sec) => (
                            <option key={sec.id} value={sec.id}>{sec.title || '—'}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Содержимое</label>
                  <RichTextEditor
                    value={selectedNotesSection.body}
                    onChange={(html) => updateNotesSection(selectedNotesSection.id, { body: html })}
                    minHeight={200}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => notesBookData && downloadMasterBookAsJson(notesBookData)}
                    disabled={!notesBookData}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #0d6efd', background: '#fff', color: '#0d6efd', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Экспорт JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => (document.getElementById('masterbook-import-json') as HTMLInputElement)?.click()}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #28a745', background: '#fff', color: '#28a745', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Импорт JSON
                  </button>
                  <button
                    type="button"
                    onClick={saveNotesBook}
                    disabled={notesSaving}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d6efd', color: '#fff', cursor: notesSaving ? 'wait' : 'pointer', fontWeight: 600 }}
                  >
                    {notesSaving ? 'Сохранение…' : 'Сохранить заметки'}
                  </button>
                </div>
              </>
            ) : (
              <>
            {hasScenario && (
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12, padding: 8, background: '#f8f9fa', borderRadius: 8 }}>
                <strong>Как пользоваться:</strong> выбери элемент слева или нажми переход справа. NPC — нажми на имя (слева или справа), откроется карточка.
              </div>
            )}
            {!hasScenario && notesBookData && (
              <div style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>Выберите раздел слева или добавьте новый.</div>
            )}
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{title}</div>
            {(() => {
              const ids = currentLocation?.audioIds ?? (currentLocation as { audioId?: string })?.audioId ? [(currentLocation as { audioId?: string }).audioId!] : [];
              const locationAudios = scenarioAudios.filter((a) => ids.includes(a.id));
              if (locationAudios.length === 0) return null;
              return (
                <div style={{ marginBottom: 12, padding: 8, background: '#f0f4ff', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 6 }}>Аудио локации</div>
                  {locationAudios.map((audioFile) => (
                    <div key={audioFile.id} style={{ marginBottom: 8 }}>
                      <audio src={audioFile.url} controls style={{ width: '100%', maxWidth: 400 }} />
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{audioFile.displayName ?? audioFile.fileName}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <RichTextBody html={body ?? ''} />
            {currentLocation && locationNotes && (
              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setNotesCollapsed((c) => !c)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#555' }}
                >
                  {notesCollapsed ? '▶ Заметки по локации' : '▼ Заметки по локации'}
                </button>
                {!notesCollapsed && (
                  <div style={{ marginTop: 6, padding: 8, background: '#f8f9fa', borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                    {locationNotes}
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </main>

          {hasScenario && (
          <aside style={rightCol}>
            {selectedNotesSectionId ? (
              <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
                Книга заметок
              </div>
            ) : (
              <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
              {currentType === 'location' ? 'Эта локация' : 'Эта ситуация'}
            </div>
            {currentLocation && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Ситуации этой локации</div>
                {situationsInCurrentLocation.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Нет</div>}
                {situationsInCurrentLocation.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {situationsInCurrentLocation.map((sit) => (
                      <button
                        key={sit.id}
                        type="button"
                        onClick={() => handleSelectScenario('situation', sit.id)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #dee2e6',
                          borderRadius: 8,
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 13,
                          textAlign: 'left',
                        }}
                      >
                        {sit.title || '—'}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>NPC здесь</div>
                {npcIds.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Не указаны</div>}
                {npcIds.length > 0 && npcsHere.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Загрузка…</div>}
                {npcsHere.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {npcsHere.map((npc) => (
                      <button
                        key={npc.id}
                        type="button"
                        onClick={() => setNpcOverlay(npc)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: 8,
                          border: '1px solid #dee2e6',
                          borderRadius: 8,
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 13,
                          textAlign: 'left',
                        }}
                      >
                        {imageUrlForNpc(npc) ? (
                          <img src={imageUrlForNpc(npc)!} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                        ) : (
                          <span style={{ width: 36, height: 36, borderRadius: 6, background: '#dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                            {(npc.name || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {currentSituation && (
              <>
                {currentSituation.locationId && (
                  <div style={{ fontSize: 12, marginBottom: 12 }}>
                    <span style={{ color: '#666' }}>Локация: </span>
                    <button
                      type="button"
                      onClick={() => currentSituation.locationId && handleSelectScenario('location', currentSituation.locationId)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#0d6efd', textDecoration: 'underline', fontSize: 12 }}
                    >
                      {getLocationTitle(currentSituation.locationId) ?? '?'}
                    </button>
                  </div>
                )}
              </>
            )}
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 6 }}>Переходы отсюда</div>
            {outBranches.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Нет</div>}
            {outBranches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {outBranches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBranch(b.toType, b.toId)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#007bff',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
              </>
            )}
          </aside>
          )}
        </div>
    </DraggableWindow>

      {npcOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setNpcOverlay(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 400,
              width: '100%',
              padding: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              {imageUrlForNpc(npcOverlay) ? (
                <img src={imageUrlForNpc(npcOverlay)!} alt={npcOverlay.name} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 8, background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>
                  {(npcOverlay.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{npcOverlay.name}</div>
                {!npcOverlay.npcKinds?.includes('story') && npcOverlay.type && <div style={{ fontSize: 13, color: '#666' }}>{npcOverlay.type}</div>}
              </div>
            </div>
            {npcOverlay.npcKinds?.includes('story') ? (
              <>
                {(npcOverlay.description ?? npcOverlay.notes) && (
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', padding: 8, background: '#f8f9fa', borderRadius: 8, marginBottom: 12 }}>
                    {npcOverlay.description ?? npcOverlay.notes}
                  </div>
                )}
              </>
            ) : (
              npcOverlay.notes && (
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', padding: 8, background: '#f8f9fa', borderRadius: 8, marginBottom: 12 }}>
                  {npcOverlay.notes}
                </div>
              )
            )}
            <button
              type="button"
              onClick={() => setNpcOverlay(null)}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#6c757d', color: '#fff', cursor: 'pointer', fontSize: 13 }}
            >
              Назад к сценарию
            </button>
          </div>
        </div>
      )}
    </>
  );
};
