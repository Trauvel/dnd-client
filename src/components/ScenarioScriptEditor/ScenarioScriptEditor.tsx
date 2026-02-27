import React, { useCallback, useEffect, useState } from 'react';
import {
  saveScenarioScript,
  type ScenarioScriptData,
  type ScenarioScriptLocation,
  type ScenarioScriptSituation,
  type ScenarioScriptBranch,
  type ScenarioFile,
} from '../../api/scenarios';
import type { ScenarioNpc } from '../../api/scenarioNpcs';

function generateId(): string {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

/** Карточка одной локации: мемоизирована, чтобы при вводе в одной не ререндерить остальные */
const LocationCard = React.memo(function LocationCard_(props: {
  loc: ScenarioScriptLocation;
  startLocationId: string | null;
  updateLocation: (id: string, patch: Partial<ScenarioScriptLocation>) => void;
  removeLocation: (id: string) => void;
  setStartLocation: (id: string | null) => void;
  audios: ScenarioFile[];
  attachments: ScenarioFile[];
  npcs: ScenarioNpc[];
  situations: ScenarioScriptSituation[];
  addSituation: (locationId: string) => void;
  updateSituation: (id: string, patch: Partial<ScenarioScriptSituation>) => void;
  removeSituation: (id: string) => void;
}) {
  const { loc, startLocationId, updateLocation, removeLocation, setStartLocation, audios, attachments, npcs, situations, addSituation, updateSituation, removeSituation } = props;
  const locSituations = situations.filter((s) => s.locationId === loc.id);
  return (
    <div style={{ marginBottom: 10, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #dee2e6' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <input
          type="text"
          value={loc.title}
          onChange={(e) => updateLocation(loc.id, { title: e.target.value })}
          placeholder="Название локации"
          style={{ flex: '1 1 200px', padding: '4px 8px', fontSize: 13 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <input type="radio" name="startLoc" checked={startLocationId === loc.id} onChange={() => setStartLocation(loc.id)} />
          Старт
        </label>
        <button type="button" onClick={() => removeLocation(loc.id)} style={{ padding: '2px 6px', fontSize: 11, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>×</button>
      </div>
      <textarea value={loc.body} onChange={(e) => updateLocation(loc.id, { body: e.target.value })} placeholder="Текст сценария (что говорить, описание, что могут сделать игроки)" rows={3} style={{ width: '100%', padding: 6, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }} />
      <textarea value={loc.notes ?? ''} onChange={(e) => updateLocation(loc.id, { notes: e.target.value })} placeholder="Заметки мастера по локации (опционально)" rows={1} style={{ width: '100%', padding: 6, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }} />
      {audios.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Аудио локации (можно несколько)</label>
          <select
            multiple
            value={loc.audioIds ?? []}
            onChange={(e) => { const selected = Array.from(e.target.selectedOptions, (o) => o.value); updateLocation(loc.id, { audioIds: selected }); }}
            style={{ width: '100%', minHeight: 72, padding: '4px 8px', fontSize: 12 }}
          >
            {audios.map((a) => (<option key={a.id} value={a.id}>{a.displayName ?? a.fileName}</option>))}
          </select>
        </div>
      )}
      {attachments.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Карты/изображения локации (можно несколько)</label>
          <select
            multiple
            value={loc.mapFileIds ?? []}
            onChange={(e) => { const selected = Array.from(e.target.selectedOptions, (o) => o.value); updateLocation(loc.id, { mapFileIds: selected }); }}
            style={{ width: '100%', minHeight: 72, padding: '4px 8px', fontSize: 12 }}
          >
            {attachments.filter((a) => a.mimeType?.startsWith('image/')).map((a) => (<option key={a.id} value={a.id}>{a.displayName ?? a.fileName}</option>))}
            {attachments.filter((a) => !a.mimeType?.startsWith('image/')).length > 0 && (
              <>
                <option disabled>— прочие вложения —</option>
                {attachments.filter((a) => !a.mimeType?.startsWith('image/')).map((a) => (<option key={a.id} value={a.id}>{a.displayName ?? a.fileName}</option>))}
              </>
            )}
          </select>
        </div>
      )}
      <div style={{ fontSize: 12, marginBottom: 4 }}>NPC здесь (в игре появятся в книге мастера):</div>
      <select
        multiple
        value={loc.npcIds ?? []}
        onChange={(e) => { const selected = Array.from(e.target.selectedOptions, (o) => o.value); updateLocation(loc.id, { npcIds: selected }); }}
        style={{ width: '100%', minHeight: 60, fontSize: 12 }}
      >
        {npcs.map((n) => (<option key={n.id} value={n.id}>{n.name}</option>))}
      </select>
      {(loc.npcIds?.length ?? 0) > 0 && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Выбрано: {loc.npcIds!.length} — в книге по кнопке «Книга» в комнате появятся карточки этих NPC</div>
      )}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <strong style={{ fontSize: 12, color: '#555' }}>Ситуации (ветки)</strong>
          <button type="button" onClick={() => addSituation(loc.id)} style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, border: 'none', background: '#17a2b8', color: '#fff', cursor: 'pointer' }}>+ Ситуация</button>
        </div>
        {locSituations.map((sit) => (
          <div key={sit.id} style={{ marginBottom: 8, padding: 8, background: '#f8f9fa', borderRadius: 6, border: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
              <input type="text" value={sit.title} onChange={(e) => updateSituation(sit.id, { title: e.target.value })} placeholder="Название (подпись на кнопке)" style={{ flex: '1 1 180px', padding: '4px 8px', fontSize: 12 }} />
              <button type="button" onClick={() => removeSituation(sit.id)} style={{ padding: '2px 6px', fontSize: 11, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>×</button>
            </div>
            <textarea value={sit.body} onChange={(e) => updateSituation(sit.id, { body: e.target.value })} placeholder="Текст ветки" rows={2} style={{ width: '100%', padding: 6, fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>
    </div>
  );
});

interface ScenarioScriptEditorProps {
  scenarioId: string;
  initialScript: ScenarioScriptData | null | undefined;
  npcs: ScenarioNpc[];
  audios?: ScenarioFile[];
  attachments?: ScenarioFile[];
  onScriptChange?: (script: ScenarioScriptData) => void;
}

export const ScenarioScriptEditor: React.FC<ScenarioScriptEditorProps> = ({
  scenarioId,
  initialScript,
  npcs,
  audios = [],
  attachments = [],
  onScriptChange,
}) => {
  const normalizeLocation = (loc: ScenarioScriptLocation) => {
    const legacy = loc as ScenarioScriptLocation & { audioId?: string | null; mapFileId?: string | null };
    return {
      ...loc,
      audioIds: loc.audioIds ?? (legacy.audioId ? [legacy.audioId] : []),
      mapFileIds: loc.mapFileIds ?? (legacy.mapFileId ? [legacy.mapFileId] : []),
    };
  };

  const [script, setScript] = useState<ScenarioScriptData>(() => {
    const locs = (initialScript?.locations ?? []).map(normalizeLocation);
    return {
      locations: locs,
      situations: initialScript?.situations ?? [],
      branches: initialScript?.branches ?? [],
      startLocationId: initialScript?.startLocationId ?? null,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialScript) {
      const locs = (initialScript.locations ?? []).map(normalizeLocation);
      setScript({
        locations: locs,
        situations: initialScript.situations ?? [],
        branches: initialScript.branches ?? [],
        startLocationId: initialScript.startLocationId ?? null,
      });
    }
  }, [scenarioId, initialScript?.locations?.length, initialScript?.situations?.length]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveScenarioScript(scenarioId, script);
      onScriptChange?.(script);
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const locations = script.locations ?? [];
  const situations = script.situations ?? [];
  const branches = script.branches ?? [];

  const addLocation = () => {
    const id = generateId();
    setScript((prev) => ({
      ...prev,
      locations: [...(prev.locations ?? []), { id, title: 'Новая локация', body: '', notes: '', npcIds: [], order: (prev.locations?.length ?? 0), audioIds: [], mapFileIds: [] }],
    }));
  };

  const updateLocation = useCallback((id: string, patch: Partial<ScenarioScriptLocation>) => {
    setScript((prev) => ({
      ...prev,
      locations: (prev.locations ?? []).map((loc) => (loc.id === id ? { ...loc, ...patch } : loc)),
    }));
  }, []);

  const removeLocation = useCallback((id: string) => {
    setScript((prev) => ({
      ...prev,
      locations: (prev.locations ?? []).filter((l) => l.id !== id),
      situations: (prev.situations ?? []).map((s) => (s.locationId === id ? { ...s, locationId: null as string | null } : s)),
      branches: (prev.branches ?? []).filter((b) => b.fromId !== id && b.toId !== id),
      startLocationId: prev.startLocationId === id ? null : prev.startLocationId,
    }));
  }, []);

  const addSituation = useCallback((locationId: string) => {
    const id = generateId();
    setScript((prev) => ({
      ...prev,
      situations: [...(prev.situations ?? []), { id, title: 'Новая ситуация', body: '', locationId, order: (prev.situations?.length ?? 0) }],
    }));
  }, []);

  const updateSituation = useCallback((id: string, patch: Partial<ScenarioScriptSituation>) => {
    setScript((prev) => ({
      ...prev,
      situations: (prev.situations ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }, []);

  const removeSituation = useCallback((id: string) => {
    setScript((prev) => ({
      ...prev,
      situations: (prev.situations ?? []).filter((s) => s.id !== id),
      branches: (prev.branches ?? []).filter((b) => b.fromId !== id && b.toId !== id),
    }));
  }, []);

  const addBranch = () => {
    const id = generateId();
    const firstLoc = locations[0]?.id;
    const firstSit = situations[0]?.id;
    setScript((prev) => ({
      ...prev,
      branches: [
        ...(prev.branches ?? []),
        {
          id,
          fromType: 'location',
          fromId: firstLoc ?? '',
          toType: firstSit ? 'situation' : 'location',
          toId: firstSit ?? firstLoc ?? '',
          label: 'Переход',
        },
      ],
    }));
  };

  const updateBranch = (branchId: string, patch: Partial<ScenarioScriptBranch>) => {
    setScript((prev) => ({
      ...prev,
      branches: (prev.branches ?? []).map((b) => (b.id === branchId ? { ...b, ...patch } : b)),
    }));
  };

  const removeBranch = (branchId: string) => {
    setScript((prev) => ({
      ...prev,
      branches: (prev.branches ?? []).filter((b) => b.id !== branchId),
    }));
  };

  const setStartLocation = useCallback((locId: string | null) => {
    setScript((prev) => ({ ...prev, startLocationId: locId }));
  }, []);

  return (
    <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6' }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Сценарий (книга мастера)</h4>
      {error && <div style={{ color: '#dc3545', fontSize: 12, marginBottom: 8 }}>{error}</div>}

      {/* Локации */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <strong style={{ fontSize: 13 }}>Локации</strong>
          <button type="button" onClick={addLocation} style={{ padding: '2px 8px', fontSize: 12, borderRadius: 4, border: 'none', background: '#28a745', color: '#fff', cursor: 'pointer' }}>
            + Локация
          </button>
        </div>
        {locations.length === 0 && <div style={{ fontSize: 12, color: '#666' }}>Добавьте локации (начало игры, таверна и т.д.)</div>}
        {locations.map((loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            startLocationId={script.startLocationId ?? null}
            updateLocation={updateLocation}
            removeLocation={removeLocation}
            setStartLocation={setStartLocation}
            audios={audios}
            attachments={attachments}
            npcs={npcs}
            situations={situations}
            addSituation={addSituation}
            updateSituation={updateSituation}
            removeSituation={removeSituation}
          />
        ))}
      </div>

      {/* Ситуации без локации (если остались со старых данных) */}
      {situations.some((s) => !s.locationId) && (
        <div style={{ marginBottom: 12, padding: 10, background: '#fff3cd', borderRadius: 8, border: '1px solid #ffc107' }}>
          <strong style={{ fontSize: 12 }}>Ситуации без локации</strong>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Привяжите к локации или удалите.</div>
          {situations.filter((s) => !s.locationId).map((sit) => (
            <div key={sit.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>{sit.title || '—'}</span>
              <select value="" onChange={(e) => { const v = e.target.value; if (v) updateSituation(sit.id, { locationId: v }); }} style={{ fontSize: 11 }}>
                <option value="">— выбрать локацию —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
              <button type="button" onClick={() => removeSituation(sit.id)} style={{ padding: '2px 6px', fontSize: 11, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Переходы */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <strong style={{ fontSize: 13 }}>Переходы</strong>
          <button type="button" onClick={addBranch} style={{ padding: '2px 8px', fontSize: 12, borderRadius: 4, border: 'none', background: '#007bff', color: '#fff', cursor: 'pointer' }}>
            + Переход
          </button>
        </div>
        {branches.map((b) => (
          <div key={b.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6, padding: 6, background: '#fff', borderRadius: 4, border: '1px solid #dee2e6' }}>
            <span style={{ fontSize: 12 }}>Из</span>
            <select value={`${b.fromType}:${b.fromId}`} onChange={(e) => { const [fromType, fromId] = e.target.value.split(':'); updateBranch(b.id, { fromType: fromType as 'location'|'situation', fromId }); }} style={{ fontSize: 12 }}>
              {locations.map((l) => <option key={l.id} value={`location:${l.id}`}>{l.title}</option>)}
              {situations.map((s) => <option key={s.id} value={`situation:${s.id}`}>{s.title}</option>)}
            </select>
            <input type="text" value={b.label} onChange={(e) => updateBranch(b.id, { label: e.target.value })} placeholder="Подпись кнопки" style={{ width: 120, padding: '2px 6px', fontSize: 12 }} />
            <span style={{ fontSize: 12 }}>→ В</span>
            <select value={`${b.toType}:${b.toId}`} onChange={(e) => { const [toType, toId] = e.target.value.split(':'); updateBranch(b.id, { toType: toType as 'location'|'situation', toId }); }} style={{ fontSize: 12 }}>
              {locations.map((l) => <option key={l.id} value={`location:${l.id}`}>{l.title}</option>)}
              {situations.map((s) => <option key={s.id} value={`situation:${s.id}`}>{s.title}</option>)}
            </select>
            <button type="button" onClick={() => removeBranch(b.id)} style={{ padding: '2px 6px', fontSize: 11, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: saving ? '#6c757d' : '#28a745', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Сохранение...' : 'Сохранить сценарий (книгу мастера)'}
      </button>
    </div>
  );
};
