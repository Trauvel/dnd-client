import React, { useEffect, useState } from 'react';
import {
  getScenarios,
  createScenario,
  uploadScenarioFiles,
  updateScenarioApi,
  deleteScenarioFile,
  renameScenarioFile,
  type Scenario,
} from '../api/scenarios';

const ScenariosPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'black' }}>
          {scenarios.map((s) => (
            <div
              key={s.id}
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                background: '#ffffff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{s.title}</h3>
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
                </div>
                <div style={{ fontSize: '12px', color: '#777' }}>
                  {new Date(s.createdAt).toLocaleDateString('ru-RU')}
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '14px' }}>
                {s.mainFileUrl ? (
                  <div style={{ marginBottom: '6px' }}>
                    <strong>Сценарий:</strong>{' '}
                    <a href={s.mainFileUrl} target="_blank" rel="noreferrer" style={{ color: 'black' }}>
                      открыть PDF
                    </a>
                  </div>
                ) : (
                  <div style={{ marginBottom: '6px', color: '#999' }}>Основной файл не загружен</div>
                )}
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

                <div style={{ marginTop: '8px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    Добавить вложения к этому сценарию
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      if (!files.length) return;
                      try {
                        const updated = await uploadScenarioFiles({
                          scenarioId: s.id,
                          attachments: files,
                        });
                        setScenarios((prev) =>
                          prev.map((it) => (it.id === s.id ? updated : it))
                        );
                        e.target.value = '';
                      } catch (err: any) {
                        setError(err.message || 'Ошибка загрузки вложений');
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScenariosPage;
