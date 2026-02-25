import React, { useState, useEffect } from 'react';
import type { ScenarioScriptData, ScenarioScriptBranch } from '../../api/scenarios';
import type { ScenarioNpc } from '../../api/scenarioNpcs';
import { API_CONFIG } from '../../config';

interface MasterBookPanelProps {
  scriptData: ScenarioScriptData;
  scenarioNpcs: ScenarioNpc[];
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
  onClose,
}) => {
  const locations = scriptData.locations ?? [];
  const situations = scriptData.situations ?? [];
  const branches = scriptData.branches ?? [];
  const startId = scriptData.startLocationId ?? locations[0]?.id ?? null;

  const [currentType, setCurrentType] = useState<'location' | 'situation'>('location');
  const [currentId, setCurrentId] = useState<string | null>(startId);
  const [npcOverlay, setNpcOverlay] = useState<ScenarioNpc | null>(null);
  const [notesCollapsed, setNotesCollapsed] = useState(false);

  useEffect(() => {
    if (startId && !currentId) {
      setCurrentId(startId);
      setCurrentType('location');
    }
  }, [startId, currentId]);

  const currentLocation = currentType === 'location' ? locations.find((l) => l.id === currentId) : null;
  const currentSituation = currentType === 'situation' ? situations.find((s) => s.id === currentId) : null;
  const title = currentLocation?.title ?? currentSituation?.title ?? '—';
  const body = currentLocation?.body ?? currentSituation?.body ?? '';
  const locationNotes = currentLocation?.notes;
  const npcIds = currentLocation?.npcIds ?? [];
  const npcsHere = scenarioNpcs.filter((n) => npcIds.includes(n.id));

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          color: '#333',
          borderRadius: 12,
          maxWidth: 960,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Книга мастера</h3>
          <button type="button" onClick={onClose} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#6c757d', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
            Закрыть
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Левая колонка — быстрые переходы */}
          <aside style={sideCol}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>Локации и ситуации</div>
            {locations.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Нет</div>}
            {locations.map((loc) => {
              const isLocActive = currentType === 'location' && currentId === loc.id;
              const locSituations = situations.filter((s) => s.locationId === loc.id);
              return (
                <div key={loc.id} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setCurrentType('location'); setCurrentId(loc.id); setNpcOverlay(null); }}
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
                            onClick={() => { setCurrentType('situation'); setCurrentId(sit.id); setNpcOverlay(null); }}
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
                      onClick={() => { setCurrentType('situation'); setCurrentId(sit.id); setNpcOverlay(null); }}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' }}>NPC</div>
            {scenarioNpcs.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Нет</div>}
            {scenarioNpcs.map((npc) => (
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
          </aside>

          {/* Центр — текст текущей локации/ситуации */}
          <main style={{ flex: 1, overflowY: 'auto', padding: 16, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 12, padding: 8, background: '#f8f9fa', borderRadius: 8 }}>
              <strong>Как пользоваться:</strong> выбери элемент слева или нажми переход справа. NPC — нажми на имя (слева или справа), откроется карточка.
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{title}</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55, marginBottom: 12 }}>{body || '—'}</div>
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
          </main>

          {/* Правая колонка — инфо по текущей локации/ситуации: NPC здесь, переходы отсюда */}
          <aside style={rightCol}>
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
                        onClick={() => { setCurrentType('situation'); setCurrentId(sit.id); setNpcOverlay(null); }}
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
                      onClick={() => { setCurrentType('location'); setCurrentId(currentSituation.locationId!); setNpcOverlay(null); }}
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
          </aside>
        </div>
      </div>

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
                {npcOverlay.type && <div style={{ fontSize: 13, color: '#666' }}>{npcOverlay.type}</div>}
              </div>
            </div>
            {npcOverlay.notes && (
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', padding: 8, background: '#f8f9fa', borderRadius: 8, marginBottom: 12 }}>
                {npcOverlay.notes}
              </div>
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
    </div>
  );
};
