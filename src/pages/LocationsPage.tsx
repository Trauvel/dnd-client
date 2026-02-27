import React, { useEffect, useState } from 'react';
import {
  getScenarios,
  createScenario,
  uploadScenarioFiles,
  updateScenarioApi,
  deleteScenarioFile,
  renameScenarioFile,
  buildScenarioExportPayload,
  downloadScenarioAsJson,
  type Scenario,
} from '../api/scenarios';
import {
  getScenarioNpcs,
  createScenarioNpc,
  updateScenarioNpc,
  deleteScenarioNpc,
  type ScenarioNpc,
  type UpsertScenarioNpcPayload,
} from '../api/scenarioNpcs';
import { ScenarioScriptEditor } from '../components/ScenarioScriptEditor/ScenarioScriptEditor';

const ScenariosPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [npcByScenario, setNpcByScenario] = useState<Record<string, ScenarioNpc[]>>({});
  const [npcLoading, setNpcLoading] = useState<Record<string, boolean>>({});
  const [npcEditing, setNpcEditing] = useState<{
    scenarioId: string | null;
    npc: Partial<ScenarioNpc> | null;
    isNew: boolean;
  }>({ scenarioId: null, npc: null, isNew: true });
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    scenario: false,
    attachments: false,
    npc: false,
    script: false,
  });
  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getScenarios();
      setScenarios(list);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки сценариев');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNpcs = async (scenarioId: string) => {
    setNpcLoading((prev) => ({ ...prev, [scenarioId]: true }));
    try {
      const list = await getScenarioNpcs(scenarioId);
      setNpcByScenario((prev) => ({ ...prev, [scenarioId]: list }));
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки NPC сценария');
    } finally {
      setNpcLoading((prev) => ({ ...prev, [scenarioId]: false }));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const scenario = await createScenario({ title: title.trim(), description: description.trim() || undefined });

      if (mainFile || (attachments && attachments.length)) {
        const updated = await uploadScenarioFiles({
          scenarioId: scenario.id,
          mainFile,
          attachments,
        });
        setScenarios((prev) => [updated, ...prev]);
      } else {
        setScenarios((prev) => [scenario, ...prev]);
      }

      setTitle('');
      setDescription('');
      setMainFile(null);
      setAttachments([]);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания сценария');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ marginBottom: '20px' }}>Сценарии</h1>

      <form
        onSubmit={handleCreate}
        style={{
          marginBottom: '30px',
          padding: '20px',
          borderRadius: '12px',
          background: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          color: 'black',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '15px' }}>Новый сценарий</h2>
        {error && (
          <div style={{ color: 'red', marginBottom: '10px' }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Название</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ddd',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                resize: 'vertical',
              }}
              placeholder="Кратко о сюжете, уровне персонажей, сеттинге..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Основной файл сценария (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setMainFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              Приложения (карты, карточки врагов и т.п.)
            </label>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => setAttachments(e.target.files ? Array.from(e.target.files) : [])}
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            style={{
              marginTop: '10px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: isSaving ? '#6c757d' : '#28a745',
              color: '#fff',
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? 'Сохранение...' : 'Создать сценарий'}
          </button>
        </div>
      </form>

      {isLoading ? (
        <div>Загрузка сценариев...</div>
      ) : scenarios.length === 0 ? (
        <div>Сценариев пока нет. Создай первый выше.</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'black' }}>
            {scenarios.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: '#fff',
                  border: '1px solid #dee2e6',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{s.title}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {((s.description ?? '').slice(0, 120))}{(s.description?.length ?? 0) > 120 ? '…' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedScenarioId(s.id)}
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #0d6efd', background: '#0d6efd', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Открыть
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const npcs = (npcByScenario[s.id] ?? []).map((n) => ({ name: n.name, type: n.type ?? null, npcKinds: n.npcKinds ?? [], description: n.description ?? null }));
                      downloadScenarioAsJson(buildScenarioExportPayload(s, npcs));
                    }}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #6c757d', background: '#fff', color: '#6c757d', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Экспорт JSON
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selectedScenarioId && (() => {
            const s = scenarios.find((sc) => sc.id === selectedScenarioId);
            if (!s) return null;
            return (
            <div style={{ marginTop: '24px', padding: '20px', borderRadius: '10px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', color: 'black' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ margin: 0 }}>{s.title}</h2>
                <button type="button" onClick={() => setSelectedScenarioId(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer' }}>← К списку</button>
              </div>

              {/* Секция: Сценарий */}
              <div style={{ marginBottom: 12, border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden' }}>
                <button type="button" onClick={() => toggleSection('scenario')} style={{ width: '100%', padding: '10px 12px', textAlign: 'left', border: 'none', background: '#f8f9fa', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>{collapsedSections.scenario ? '▶' : '▼'} Сценарий</button>
                {!collapsedSections.scenario && (
                <div style={{ padding: 12 }}>
                  <textarea
                    value={s.description ?? ''}
                    cols={70}
                    onChange={(e) =>
                      setScenarios((prev) =>
                        prev.map((it) =>
                          it.id === s.id ? { ...it, description: e.target.value } : it
                        )
                      )
                    }
                    rows={15}
                    style={{
                      marginTop: '6px',
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      resize: 'vertical',
                    }}
                    placeholder="Описание сценария..."
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const updated = await updateScenarioApi(s.id, {
                          description: s.description ?? '',
                        });
                        setScenarios((prev) =>
                          prev.map((it) => (it.id === s.id ? updated : it))
                        );
                      } catch (err: any) {
                        setError(err.message || 'Ошибка обновления сценария');
                      }
                    }}
                    style={{
                      marginTop: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#007bff',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Сохранить описание
                  </button>
                  <div style={{ fontSize: '12px', color: '#777', marginTop: 8 }}>{new Date(s.createdAt).toLocaleDateString('ru-RU')}</div>
                  <div style={{ marginTop: '10px', fontSize: '14px' }}>
                    {s.mainFileUrl ? (
                      <div style={{ marginBottom: '6px' }}>
                        <strong>Сценарий:</strong>{' '}
                        <a href={s.mainFileUrl} target="_blank" rel="noreferrer" style={{ color: 'black' }}>открыть PDF</a>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '6px', color: '#999' }}>Основной файл не загружен</div>
                    )}
                  </div>
                </div>
                )}
              </div>

              <div style={{ marginBottom: 12, border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden' }}>
                <button type="button" onClick={() => toggleSection('attachments')} style={{ width: '100%', padding: '10px 12px', textAlign: 'left', border: 'none', background: '#f8f9fa', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>{collapsedSections.attachments ? '▶' : '▼'} Приложения</button>
                {!collapsedSections.attachments && (
                <div style={{ padding: 12 }}>
                {s.attachments.length > 0 && (
                  <div>
                    <strong>Приложения:</strong>
                    <div
                      style={{
                        marginTop: '6px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      {s.attachments.map((f) => {
                        const name = f.displayName ?? f.fileName;
                        const isImage = f.mimeType?.startsWith('image/');
                        const isPdf = f.mimeType === 'application/pdf';
                        return (
                          <div
                            key={f.id}
                            style={{
                              width: '180px',
                              borderRadius: '8px',
                              border: '1px solid #ddd',
                              padding: '8px',
                              background: '#f8f9fa',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                              <div
                                style={{
                                  width: '100%',
                                  height: '110px',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  background: '#e9ecef',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginBottom: '4px',
                                }}
                              >
                                {isImage ? (
                                  <img
                                    src={f.url}
                                    alt={name}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                    }}
                                  />
                                ) : isPdf ? (
                                  <span style={{ fontSize: '32px', fontWeight: 700, color: '#d9534f' }}>
                                    PDF
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '24px', fontWeight: 700 }}>FILE</span>
                                )}
                              </div>
                            </a>
                            <input
                              type="text"
                              value={name}
                              onChange={(e) =>
                                setScenarios((prev) =>
                                  prev.map((it) =>
                                    it.id === s.id
                                      ? {
                                          ...it,
                                          attachments: it.attachments.map((af) =>
                                            af.id === f.id ? { ...af, displayName: e.target.value } : af
                                          ),
                                        }
                                      : it
                                  )
                                )
                              }
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                fontSize: '12px',
                              }}
                            />
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: '4px',
                                gap: '4px',
                              }}
                            >
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const updated = await renameScenarioFile(s.id, f.id, name);
                                    setScenarios((prev) =>
                                      prev.map((it) => (it.id === s.id ? updated : it))
                                    );
                                  } catch (err: any) {
                                    setError(err.message || 'Ошибка переименования файла');
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: '#007bff',
                                  color: '#fff',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                              >
                                Имя
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const updated = await deleteScenarioFile(s.id, f.id);
                                    setScenarios((prev) =>
                                      prev.map((it) => (it.id === s.id ? updated : it))
                                    );
                                  } catch (err: any) {
                                    setError(err.message || 'Ошибка удаления файла');
                                  }
                                }}
                                style={{
                                  width: '32px',
                                  padding: '2px 0',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: '#dc3545',
                                  color: '#fff',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(s.audios?.length ?? 0) > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <strong>Аудио:</strong>
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {s.audios.map((f) => {
                        const name = f.displayName ?? f.fileName;
                        return (
                          <div
                            key={f.id}
                            style={{
                              borderRadius: '6px',
                              border: '1px solid #ddd',
                              padding: '8px',
                              background: '#f8f9fa',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 600 }}>{name}</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={name}
                                onChange={(e) =>
                                  setScenarios((prev) =>
                                    prev.map((it) =>
                                      it.id === s.id
                                        ? {
                                            ...it,
                                            audios: (it.audios ?? []).map((af) =>
                                              af.id === f.id ? { ...af, displayName: e.target.value } : af
                                            ),
                                          }
                                        : it
                                    )
                                  )
                                }
                                style={{
                                  flex: 1,
                                  minWidth: '100px',
                                  padding: '4px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #ccc',
                                  fontSize: '12px',
                                }}
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const updated = await renameScenarioFile(s.id, f.id, name);
                                    setScenarios((prev) =>
                                      prev.map((it) => (it.id === s.id ? updated : it))
                                    );
                                  } catch (err: any) {
                                    setError(err.message || 'Ошибка переименования');
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: '#007bff',
                                  color: '#fff',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                              >
                                Сохранить
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const updated = await deleteScenarioFile(s.id, f.id);
                                    setScenarios((prev) =>
                                      prev.map((it) => (it.id === s.id ? updated : it))
                                    );
                                  } catch (err: any) {
                                    setError(err.message || 'Ошибка удаления');
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: '#dc3545',
                                  color: '#fff',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Добавить вложения к этому сценарию</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      if (!files.length) return;
                      try {
                        const updated = await uploadScenarioFiles({ scenarioId: s.id, attachments: files });
                        setScenarios((prev) => prev.map((it) => (it.id === s.id ? updated : it)));
                        e.target.value = '';
                      } catch (err: any) {
                        setError(err.message || 'Ошибка загрузки вложений');
                      }
                    }}
                  />
                </div>
                </div>
                )}
              </div>

              <div style={{ marginBottom: 12, border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden' }}>
                <button type="button" onClick={() => toggleSection('npc')} style={{ width: '100%', padding: '10px 12px', textAlign: 'left', border: 'none', background: '#f8f9fa', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>{collapsedSections.npc ? '▶' : '▼'} NPC этого сценария</button>
                {!collapsedSections.npc && (
                <div style={{ padding: 12 }}>
                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, background: '#e9ecef', fontSize: 12, cursor: 'pointer' }}>
                    {s.audios?.length ? 'Добавить аудио' : 'Загрузить аудио'}
                    <input
                      type="file"
                      multiple
                      accept="audio/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const files = e.target.files ? Array.from(e.target.files) : [];
                        if (!files.length) return;
                        try {
                          const updated = await uploadScenarioFiles({
                            scenarioId: s.id,
                            audioFiles: files,
                          });
                          setScenarios((prev) =>
                            prev.map((it) => (it.id === s.id ? updated : it))
                          );
                          e.target.value = '';
                        } catch (err: any) {
                          setError(err.message || 'Ошибка загрузки аудио');
                        }
                      }}
                    />
                  </label>
                </div>

                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>NPC этого сценария</h4>
                  <button
                    type="button"
                    onClick={() => loadNpcs(s.id)}
                    disabled={npcLoading[s.id]}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#17a2b8',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                      marginBottom: '8px',
                    }}
                  >
                    {npcLoading[s.id] ? 'Загрузка NPC...' : 'Обновить список NPC'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNpcEditing({
                        scenarioId: s.id,
                        npc: {
                          name: '',
                          type: '',
                          npcKinds: ['ally'],
                          hpText: '',
                          speed: '',
                          armorClass: undefined,
                          challenge: '',
                          xp: undefined,
                          habitat: '',
                          description: '',
                        },
                        isNew: true,
                      })
                    }
                    style={{
                      marginLeft: '8px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#28a745',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    + NPC
                  </button>
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(npcByScenario[s.id] ?? []).length === 0 && !npcLoading[s.id] && (
                      <div style={{ fontSize: '13px', color: '#666' }}>NPC пока нет.</div>
                    )}
                    {(npcByScenario[s.id] ?? []).map((npc) => (
                      <div
                        key={npc.id}
                        style={{
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          padding: '8px',
                          width: '260px',
                          background: '#f8f9fa',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              background: '#e9ecef',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              fontWeight: 700,
                            }}
                          >
                            {npc.imageUrl ? (
                              <img
                                src={npc.imageUrl}
                                alt={npc.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              (npc.name || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: '14px' }}>{npc.name}</span>
                              {(npc.npcKinds ?? []).includes('enemy') && (
                                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f8d7da', color: '#721c24' }}>Враг</span>
                              )}
                              {(npc.npcKinds ?? []).includes('ally') && (
                                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#d4edda', color: '#155724' }}>Союзник</span>
                              )}
                              {(npc.npcKinds ?? []).includes('story') && (
                                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#e2d5f1', color: '#3d2a54' }}>Персонаж мастера</span>
                              )}
                            </div>
                            {npc.type && (
                              <div style={{ fontSize: '12px', color: '#555' }}>{npc.type}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#333', marginTop: '4px' }}>
                          {npc.armorClass != null && (
                            <div>
                              КД {npc.armorClass}
                              {npc.armorClassText ? ` (${npc.armorClassText})` : ''}
                            </div>
                          )}
                          {npc.hpText && <div>Хиты {npc.hpText}</div>}
                          {npc.speed && <div>Скорость {npc.speed}</div>}
                          {(npc.challenge || npc.xp != null) && (
                            <div>
                              Опасность {npc.challenge || '-'}
                              {npc.xp != null ? ` (${npc.xp} XP)` : ''}
                            </div>
                          )}
                          {npc.habitat && <div>Местность: {npc.habitat}</div>}
                        </div>
                        {npc.description && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#555',
                              marginTop: '4px',
                              maxHeight: '60px',
                              overflow: 'auto',
                            }}
                          >
                            {npc.description}
                          </div>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '4px',
                            marginTop: '6px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setNpcEditing({
                                scenarioId: s.id,
                                npc,
                                isNew: false,
                              })
                            }
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: 'none',
                              background: '#007bff',
                              color: '#fff',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Править
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Удалить NPC "${npc.name}"?`)) return;
                              try {
                                await deleteScenarioNpc(s.id, npc.id);
                                setNpcByScenario((prev) => ({
                                  ...prev,
                                  [s.id]: (prev[s.id] ?? []).filter((n) => n.id !== npc.id),
                                }));
                              } catch (err: any) {
                                setError(err.message || 'Ошибка удаления NPC');
                              }
                            }}
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: 'none',
                              background: '#dc3545',
                              color: '#fff',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
                )}
              </div>

              <div style={{ marginBottom: 12, border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden' }}>
                <button type="button" onClick={() => toggleSection('script')} style={{ width: '100%', padding: '10px 12px', textAlign: 'left', border: 'none', background: '#f8f9fa', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>{collapsedSections.script ? '▶' : '▼'} Локации в сценарии и переходы</button>
                {!collapsedSections.script && (
                <div style={{ padding: 12 }}>
                <ScenarioScriptEditor
                  scenarioId={s.id}
                  initialScript={s.scriptData}
                  npcs={npcByScenario[s.id] ?? []}
                  audios={s.audios ?? []}
                  attachments={s.attachments ?? []}
                  onScriptChange={(script) =>
                    setScenarios((prev) =>
                      prev.map((it) => (it.id === s.id ? { ...it, scriptData: script } : it))
                    )
                  }
                />
                </div>
                )}
              </div>
            </div>
            );
          })()}
        </>
      )}
      {npcEditing.scenarioId && npcEditing.npc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setNpcEditing({ scenarioId: null, npc: null, isNew: true });
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#000',
              borderRadius: 10,
              padding: 16,
              maxWidth: 700,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              {npcEditing.isNew ? 'Новый NPC' : `Редактирование NPC: ${npcEditing.npc.name}`}
            </h3>
            {(() => {
              const currentNpc = npcEditing.npc;
              if (!currentNpc) return null;
              const scenarioForNpc = scenarios.find((sc) => sc.id === npcEditing.scenarioId);
              const imageAttachments =
                scenarioForNpc?.attachments.filter((f) => f.mimeType?.startsWith('image/')) ?? [];
              const currentImage =
                imageAttachments.find((f) => f.id === currentNpc.imageFileId) ?? null;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      border: '1px solid #ddd',
                      overflow: 'hidden',
                      background: '#f1f3f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 700,
                    }}
                  >
                    {currentImage ? (
                      <img
                        src={currentImage.url}
                        alt={currentImage.displayName ?? currentImage.fileName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      (currentNpc.name || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 6 }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        Картинка NPC (из вложений сценария)
                      </label>
                      <select
                        value={npcEditing.npc.imageFileId ?? ''}
                        onChange={(e) =>
                          setNpcEditing((prev) =>
                            prev.scenarioId
                              ? {
                                  ...prev,
                                  npc: {
                                    ...prev.npc!,
                                    imageFileId: e.target.value || undefined,
                                  },
                                }
                              : prev
                          )
                        }
                        style={{ width: '100%', fontSize: 12 }}
                      >
                        <option value="">— без картинки —</option>
                        {imageAttachments.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.displayName ?? f.fileName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      Чтобы загрузить новую картинку, добавь её во вложения сценария выше, а затем выбери в этом списке.
                    </div>
                  </div>
                </div>
              );
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Имя</label>
                <input
                  type="text"
                  value={npcEditing.npc.name ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, name: e.target.value } }
                        : prev
                    )
                  }
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                  Тип/размер/мировоззрение
                </label>
                <input
                  type="text"
                  value={npcEditing.npc.type ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, type: e.target.value } }
                        : prev
                    )
                  }
                  placeholder='например: "Средний гуманоид, Нейтральный"'
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Роли (можно несколько)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {(['enemy', 'ally', 'story'] as const).map((kind) => {
                    const kinds = npcEditing.npc?.npcKinds ?? [];
                    const checked = kinds.includes(kind);
                    return (
                      <label key={kind} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setNpcEditing((prev) =>
                              prev.scenarioId
                                ? {
                                    ...prev,
                                    npc: {
                                      ...prev.npc!,
                                      npcKinds: e.target.checked
                                        ? [...(prev.npc!.npcKinds ?? []), kind]
                                        : (prev.npc!.npcKinds ?? []).filter((k) => k !== kind),
                                    },
                                  }
                                : prev
                            )
                          }
                        />
                        {kind === 'enemy' && 'Враг (в бой)'}
                        {kind === 'ally' && 'Союзник / нейтральный'}
                        {kind === 'story' && 'Персонаж мастера (картинка и описание)'}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Местность</label>
                <input
                  type="text"
                  value={npcEditing.npc.habitat ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, habitat: e.target.value } }
                        : prev
                    )
                  }
                  placeholder="например: Город"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>КД</label>
                <input
                  type="number"
                  value={npcEditing.npc.armorClass ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? {
                            ...prev,
                            npc: {
                              ...prev.npc!,
                              armorClass: e.target.value ? Number(e.target.value) : undefined,
                            },
                          }
                        : prev
                    )
                  }
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>КД (текст)</label>
                <input
                  type="text"
                  value={npcEditing.npc.armorClassText ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, armorClassText: e.target.value } }
                        : prev
                    )
                  }
                  placeholder="например: Кожаный доспех"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Хиты (текст)</label>
                <input
                  type="text"
                  value={npcEditing.npc.hpText ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, hpText: e.target.value } }
                        : prev
                    )
                  }
                  placeholder="напр. 9 (2d8)"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Скорость</label>
                <input
                  type="text"
                  value={npcEditing.npc.speed ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, speed: e.target.value } }
                        : prev
                    )
                  }
                  placeholder="30 ft."
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 8 }}>
              {(
                [
                  ['strength', 'СИЛ'],
                  ['dexterity', 'ЛОВ'],
                  ['constitution', 'ТЕЛ'],
                  ['intelligence', 'ИНТ'],
                  ['wisdom', 'МДР'],
                  ['charisma', 'ХАР'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{label}</label>
                  <input
                    type="number"
                    value={(npcEditing.npc as any)[key] ?? ''}
                    onChange={(e) =>
                      setNpcEditing((prev) =>
                        prev.scenarioId
                          ? {
                              ...prev,
                              npc: {
                                ...prev.npc!,
                                [key]: e.target.value ? Number(e.target.value) : undefined,
                              },
                            }
                          : prev
                      )
                    }
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Навыки</label>
                <textarea
                  rows={2}
                  value={npcEditing.npc.skills ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, skills: e.target.value } }
                        : prev
                    )
                  }
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Чувства</label>
                <textarea
                  rows={2}
                  value={npcEditing.npc.senses ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, senses: e.target.value } }
                        : prev
                    )
                  }
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Языки</label>
                <textarea
                  rows={2}
                  value={npcEditing.npc.languages ?? ''}
                  onChange={(e) =>
                    setNpcEditing((prev) =>
                      prev.scenarioId
                        ? { ...prev, npc: { ...prev.npc!, languages: e.target.value } }
                        : prev
                    )
                  }
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                  Опасность и XP
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={npcEditing.npc.challenge ?? ''}
                    onChange={(e) =>
                      setNpcEditing((prev) =>
                        prev.scenarioId
                          ? { ...prev, npc: { ...prev.npc!, challenge: e.target.value } }
                          : prev
                      )
                    }
                    placeholder="1/8"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    value={npcEditing.npc.xp ?? ''}
                    onChange={(e) =>
                      setNpcEditing((prev) =>
                        prev.scenarioId
                          ? {
                              ...prev,
                              npc: {
                                ...prev.npc!,
                                xp: e.target.value ? Number(e.target.value) : undefined,
                              },
                            }
                          : prev
                      )
                    }
                    placeholder="25"
                    style={{ width: 80 }}
                  />
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Описание</label>
              <textarea
                rows={3}
                value={npcEditing.npc.description ?? ''}
                onChange={(e) =>
                  setNpcEditing((prev) =>
                    prev.scenarioId
                      ? { ...prev, npc: { ...prev.npc!, description: e.target.value } }
                      : prev
                  )
                }
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                Преимущества / черты
              </label>
              <textarea
                rows={3}
                value={npcEditing.npc.traits ?? ''}
                onChange={(e) =>
                  setNpcEditing((prev) =>
                    prev.scenarioId
                      ? { ...prev, npc: { ...prev.npc!, traits: e.target.value } }
                      : prev
                  )
                }
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                Способности / действия
              </label>
              <textarea
                rows={4}
                value={npcEditing.npc.actions ?? ''}
                onChange={(e) =>
                  setNpcEditing((prev) =>
                    prev.scenarioId
                      ? { ...prev, npc: { ...prev.npc!, actions: e.target.value } }
                      : prev
                  )
                }
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                Заметки мастера (для книги мастера)
              </label>
              <textarea
                rows={2}
                value={npcEditing.npc.notes ?? ''}
                onChange={(e) =>
                  setNpcEditing((prev) =>
                    prev.scenarioId
                      ? { ...prev, npc: { ...prev.npc!, notes: e.target.value } }
                      : prev
                  )
                }
                placeholder="Заметки по этому NPC, подсказки для себя в игре"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={() =>
                  setNpcEditing({
                    scenarioId: null,
                    npc: null,
                    isNew: true,
                  })
                }
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#6c757d',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!npcEditing.scenarioId || !npcEditing.npc?.name?.trim()) return;
                  try {
                    const scenarioId = npcEditing.scenarioId;
                    const basePayload: UpsertScenarioNpcPayload = {
                      name: npcEditing.npc.name!.trim(),
                      type: npcEditing.npc.type ?? undefined,
                      npcKinds: (npcEditing.npc.npcKinds?.length ? npcEditing.npc.npcKinds : null) ?? null,
                      armorClass: npcEditing.npc.armorClass ?? null,
                      armorClassText: npcEditing.npc.armorClassText ?? null,
                      hpAverage: npcEditing.npc.hpAverage ?? null,
                      hpText: npcEditing.npc.hpText ?? null,
                      speed: npcEditing.npc.speed ?? null,
                      strength: npcEditing.npc.strength ?? null,
                      dexterity: npcEditing.npc.dexterity ?? null,
                      constitution: npcEditing.npc.constitution ?? null,
                      intelligence: npcEditing.npc.intelligence ?? null,
                      wisdom: npcEditing.npc.wisdom ?? null,
                      charisma: npcEditing.npc.charisma ?? null,
                      skills: npcEditing.npc.skills ?? null,
                      senses: npcEditing.npc.senses ?? null,
                      languages: npcEditing.npc.languages ?? null,
                      xp: npcEditing.npc.xp ?? null,
                      challenge: npcEditing.npc.challenge ?? null,
                      habitat: npcEditing.npc.habitat ?? null,
                      traits: npcEditing.npc.traits ?? null,
                      abilities: npcEditing.npc.abilities ?? null,
                      actions: npcEditing.npc.actions ?? null,
                      legendaryActions: npcEditing.npc.legendaryActions ?? null,
                      description: npcEditing.npc.description ?? null,
                      notes: npcEditing.npc.notes ?? null,
                      imageFileId: npcEditing.npc.imageFileId ?? null,
                    };

                    let saved: ScenarioNpc;
                    if (npcEditing.isNew) {
                      saved = await createScenarioNpc(scenarioId, basePayload);
                      setNpcByScenario((prev) => ({
                        ...prev,
                        [scenarioId]: [...(prev[scenarioId] ?? []), saved],
                      }));
                    } else {
                      saved = await updateScenarioNpc(scenarioId, npcEditing.npc.id!, basePayload);
                      setNpcByScenario((prev) => ({
                        ...prev,
                        [scenarioId]: (prev[scenarioId] ?? []).map((n) =>
                          n.id === saved.id ? saved : n
                        ),
                      }));
                    }

                    setNpcEditing({ scenarioId: null, npc: null, isNew: true });
                  } catch (err: any) {
                    setError(err.message || 'Ошибка сохранения NPC');
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#28a745',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenariosPage;
