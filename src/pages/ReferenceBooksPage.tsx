import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getReferenceBooks,
  getReferenceBook,
  getReferenceEntries,
  getReferenceEntriesPage,
  createReferenceBook,
  updateReferenceBook,
  deleteReferenceBook,
  addReferenceField,
  updateReferenceField,
  deleteReferenceField,
  createReferenceEntry,
  updateReferenceEntry,
  deleteReferenceEntry,
  type ReferenceBook,
  type ReferenceField,
  type ReferenceEntry,
  type FieldType,
  type AbilityBonusItem,
  ABILITY_BONUS_KEYS,
} from '../api/referenceBooks';

const REF_PAGE_SIZE = 50;

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string', label: 'Строка' },
  { value: 'number', label: 'Число' },
  { value: 'text', label: 'Текст (многострочный)' },
  { value: 'reference', label: 'Ссылка на справочник' },
  { value: 'reference-multiple', label: 'Ссылка на справочник (несколько)' },
  { value: 'ability-bonus-list', label: 'Бонусы к характеристикам (список)' },
];

function formatAbilityBonusList(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return '—';
  const labels: Record<string, string> = Object.fromEntries(ABILITY_BONUS_KEYS.map((a) => [a.value, a.label]));
  return raw
    .filter((x): x is AbilityBonusItem => x && typeof x === 'object' && 'ability_key' in x && typeof (x as AbilityBonusItem).bonus === 'number')
    .map((x) => `${labels[x.ability_key] ?? x.ability_key} ${x.bonus >= 0 ? '+' : ''}${x.bonus}`)
    .join(', ');
}

const ReferenceBooksPage: React.FC = () => {
  const [books, setBooks] = useState<ReferenceBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<ReferenceBook | null>(null);
  const [entries, setEntries] = useState<ReferenceEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [tab, setTab] = useState<'entries' | 'fields' | 'settings'>('entries');
  const [modal, setModal] = useState<'createBook' | 'editBook' | 'createField' | 'editField' | 'createEntry' | 'editEntry' | null>(null);
  const [editBookForm, setEditBookForm] = useState<Partial<ReferenceBook>>({});
  const [editFieldForm, setEditFieldForm] = useState<Partial<ReferenceField> & { targetBookId?: string }>({});
  const [editEntryForm, setEditEntryForm] = useState<{ name: string; data: Record<string, unknown> }>({ name: '', data: {} });
  const [editingField, setEditingField] = useState<ReferenceField | null>(null);
  const [editingEntry, setEditingEntry] = useState<ReferenceEntry | null>(null);
  const [refEntriesByBookId, setRefEntriesByBookId] = useState<Record<string, ReferenceEntry[]>>({});
  const [refEntriesTotalByBookId, setRefEntriesTotalByBookId] = useState<Record<string, number>>({});
  const [refSearchByBookId, setRefSearchByBookId] = useState<Record<string, string>>({});
  const [refOffsetByBookId, setRefOffsetByBookId] = useState<Record<string, number>>({});
  const [loadingRefBookId, setLoadingRefBookId] = useState<string | null>(null);
  const [entriesSearchQuery, setEntriesSearchQuery] = useState('');
  const [entriesSearchTotal, setEntriesSearchTotal] = useState<number | null>(null);
  const [entriesSearching, setEntriesSearching] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<{ book: ReferenceBook; entries: ReferenceEntry[] }[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const overlayMouseDown = useRef(false);

  const loadBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getReferenceBooks();
      setBooks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);


  const selectBook = async (book: ReferenceBook) => {
    setSelectedBook(book);
    setTab('entries');
    setEntriesSearchQuery('');
    setEntriesSearchTotal(null);
    setEntriesLoading(true);
    try {
      const list = await getReferenceEntries(book.id);
      setEntries(list);
      const refIds = [...new Set(book.fields.filter((f) => (f.fieldType === 'reference' || f.fieldType === 'reference-multiple') && f.targetBookId).map((f) => f.targetBookId!))];
      const next: Record<string, ReferenceEntry[]> = {};
      for (const id of refIds) {
        try { next[id] = await getReferenceEntries(id); } catch { next[id] = []; }
      }
      setRefEntriesByBookId(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки записей');
    } finally {
      setEntriesLoading(false);
    }
  };

  const runEntriesSearch = async (append = false) => {
    if (!selectedBook) return;
    const q = entriesSearchQuery.trim();
    setEntriesSearching(true);
    try {
      if (!q) {
        const list = await getReferenceEntries(selectedBook.id);
        setEntries(list);
        setEntriesSearchTotal(null);
      } else {
        const offset = append ? entries.length : 0;
        const result = await getReferenceEntriesPage(selectedBook.id, {
          limit: 100,
          offset,
          search: q,
        });
        if (append) {
          setEntries((prev) => {
            const seen = new Set(prev.map((e) => e.id));
            const add = result.entries.filter((e) => !seen.has(e.id));
            return [...prev, ...add].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
          });
        } else {
          setEntries(result.entries);
        }
        setEntriesSearchTotal(result.total);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка поиска');
    } finally {
      setEntriesSearching(false);
    }
  };

  const clearEntriesSearch = async () => {
    setEntriesSearchQuery('');
    if (!selectedBook) return;
    setEntriesLoading(true);
    try {
      const list = await getReferenceEntries(selectedBook.id);
      setEntries(list);
      setEntriesSearchTotal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setEntriesLoading(false);
    }
  };

  const runGlobalSearch = async () => {
    const q = globalSearchQuery.trim();
    if (!q) {
      setGlobalSearchResults([]);
      return;
    }
    setGlobalSearching(true);
    setError(null);
    try {
      const limit = 200;
      const results = await Promise.all(
        books.map(async (book) => {
          const { entries: list } = await getReferenceEntriesPage(book.id, { limit, offset: 0, search: q });
          return { book, entries: list };
        })
      );
      setGlobalSearchResults(results.filter((r) => r.entries.length > 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка поиска');
      setGlobalSearchResults([]);
    } finally {
      setGlobalSearching(false);
    }
  };

  const clearGlobalSearch = () => {
    setGlobalSearchQuery('');
    setGlobalSearchResults([]);
  };

  const refreshBook = async () => {
    if (!selectedBook) return;
    try {
      const b = await getReferenceBook(selectedBook.id);
      if (b) {
        setSelectedBook(b);
        setBooks((prev) => prev.map((x) => (x.id === b.id ? b : x)));
        const list = await getReferenceEntries(selectedBook.id);
        setEntries(list);
        const refIds = [...new Set(b.fields.filter((f) => (f.fieldType === 'reference' || f.fieldType === 'reference-multiple') && f.targetBookId).map((f) => f.targetBookId!))];
        const next: Record<string, ReferenceEntry[]> = {};
        for (const id of refIds) {
          try { next[id] = await getReferenceEntries(id); } catch { next[id] = []; }
        }
        setRefEntriesByBookId(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleCreateBook = async () => {
    const name = (editBookForm.name ?? '').trim();
    if (!name) return;
    try {
      const book = await createReferenceBook({
        name,
        slug: editBookForm.slug ?? name,
        description: editBookForm.description ?? undefined,
        order: editBookForm.order ?? 0,
      });
      setBooks((prev) => [...prev, book].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)));
      setModal(null);
      setEditBookForm({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания');
    }
  };

  const handleUpdateBook = async () => {
    if (!selectedBook) return;
    try {
      const updated = await updateReferenceBook(selectedBook.id, {
        name: editBookForm.name,
        slug: editBookForm.slug,
        description: editBookForm.description ?? undefined,
        order: editBookForm.order,
        parentBookIds: editBookForm.parentBookIds,
      });
      setSelectedBook(updated);
      setBooks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setModal(null);
      setEditBookForm({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления');
    }
  };

  const handleDeleteBook = async () => {
    if (!selectedBook || !window.confirm(`Удалить справочник «${selectedBook.name}» и все записи?`)) return;
    try {
      await deleteReferenceBook(selectedBook.id);
      setSelectedBook(null);
      setBooks((prev) => prev.filter((x) => x.id !== selectedBook.id));
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };

  const handleAddField = async () => {
    if (!selectedBook) return;
    const name = (editFieldForm.name ?? '').trim();
    const key = (editFieldForm.key ?? name).trim().toLowerCase().replace(/\s+/g, '_') || 'field';
    if (!name) return;
    try {
      const field = await addReferenceField(selectedBook.id, {
        key,
        name,
        fieldType: editFieldForm.fieldType ?? 'string',
        targetBookId: editFieldForm.fieldType === 'reference' ? editFieldForm.targetBookId : undefined,
        order: editFieldForm.order ?? 0,
        required: editFieldForm.required ?? false,
      });
      await refreshBook();
      setModal(null);
      setEditFieldForm({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка добавления поля');
    }
  };

  const handleUpdateField = async () => {
    if (!selectedBook || !editingField) return;
    try {
      await updateReferenceField(selectedBook.id, editingField.id, {
        name: editFieldForm.name,
        key: editFieldForm.key,
        fieldType: editFieldForm.fieldType,
        targetBookId: editFieldForm.fieldType === 'reference' ? editFieldForm.targetBookId ?? null : null,
        order: editFieldForm.order,
        required: editFieldForm.required,
      });
      await refreshBook();
      setModal(null);
      setEditingField(null);
      setEditFieldForm({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления поля');
    }
  };

  const handleDeleteField = async (field: ReferenceField) => {
    if (!selectedBook || !window.confirm(`Удалить поле «${field.name}»?`)) return;
    try {
      await deleteReferenceField(selectedBook.id, field.id);
      await refreshBook();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };

  const handleCreateEntry = async () => {
    if (!selectedBook) return;
    const name = (editEntryForm.name ?? '').trim();
    if (!name) return;
    try {
      await createReferenceEntry(selectedBook.id, {
        name,
        data: editEntryForm.data ?? {},
      });
      await refreshBook();
      setModal(null);
      setEditEntryForm({ name: '', data: {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания записи');
    }
  };

  const handleUpdateEntry = async () => {
    if (!selectedBook || !editingEntry) return;
    try {
      await updateReferenceEntry(selectedBook.id, editingEntry.id, {
        name: editEntryForm.name.trim(),
        data: editEntryForm.data ?? {},
      });
      await refreshBook();
      setModal(null);
      setEditingEntry(null);
      setEditEntryForm({ name: '', data: {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления записи');
    }
  };

  const handleDeleteEntry = async (entry: ReferenceEntry) => {
    if (!selectedBook || !window.confirm(`Удалить запись «${entry.name}»?`)) return;
    try {
      await deleteReferenceEntry(selectedBook.id, entry.id);
      await refreshBook();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };

  const openEditBook = () => {
    if (selectedBook) {
      setEditBookForm({
        name: selectedBook.name,
        slug: selectedBook.slug,
        description: selectedBook.description ?? '',
        order: selectedBook.order,
        parentBookIds: selectedBook.parentBookIds ?? [],
      });
      setModal('editBook');
    }
  };

  const toggleParentBook = (parentId: string) => {
    setEditBookForm((p) => {
      const cur = p.parentBookIds ?? [];
      const next = cur.includes(parentId) ? cur.filter((id) => id !== parentId) : [...cur, parentId];
      return { ...p, parentBookIds: next };
    });
  };

  const openEditField = (field: ReferenceField) => {
    setEditingField(field);
    setEditFieldForm({
      key: field.key,
      name: field.name,
      fieldType: field.fieldType,
      targetBookId: field.targetBookId ?? undefined,
      order: field.order,
      required: field.required,
    });
    setModal('editField');
  };

  const getEnsureIdsForBook = useCallback(
    (bookId: string): string[] => {
      if (!selectedBook) return [];
      const ids: string[] = [];
      for (const f of selectedBook.fields) {
        if ((f.fieldType !== 'reference' && f.fieldType !== 'reference-multiple') || f.targetBookId !== bookId) continue;
        const v = editEntryForm.data[f.key];
        if (f.fieldType === 'reference' && typeof v === 'string' && v) ids.push(v);
        if (f.fieldType === 'reference-multiple' && Array.isArray(v)) ids.push(...(v as string[]).filter(Boolean));
      }
      return [...new Set(ids)];
    },
    [selectedBook, editEntryForm.data]
  );

  const loadRefPage = useCallback(
    async (bookId: string, search: string, offset: number, append: boolean, ensureIds?: string[]) => {
      setLoadingRefBookId(bookId);
      try {
        const result = await getReferenceEntriesPage(bookId, {
          limit: REF_PAGE_SIZE,
          offset,
          search: search || undefined,
          ensureIds: ensureIds?.length ? ensureIds : undefined,
        });
        setRefEntriesByBookId((prev) => {
          const next = { ...prev };
          const list = append && next[bookId] ? [...next[bookId]] : [];
          if (!append) list.length = 0;
          const seen = new Set(list.map((e) => e.id));
          for (const e of result.entries) {
            if (!seen.has(e.id)) {
              list.push(e);
              seen.add(e.id);
            }
          }
          next[bookId] = list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
          return next;
        });
        setRefEntriesTotalByBookId((p) => ({ ...p, [bookId]: result.total }));
        setRefOffsetByBookId((p) => ({ ...p, [bookId]: offset + REF_PAGE_SIZE }));
      } catch {
        setRefEntriesByBookId((p) => ({ ...p, [bookId]: [] }));
        setRefEntriesTotalByBookId((p) => ({ ...p, [bookId]: 0 }));
      } finally {
        setLoadingRefBookId((cur) => (cur === bookId ? null : cur));
      }
    },
    []
  );

  const loadRefPageWithEnsure = useCallback(
    (bookId: string, search: string, offset: number, append: boolean) => {
      const ensureIds = search.trim() === '' && offset === 0 ? getEnsureIdsForBook(bookId) : undefined;
      loadRefPage(bookId, search, offset, append, ensureIds);
    },
    [loadRefPage, getEnsureIdsForBook]
  );

  const openEditEntry = async (entry: ReferenceEntry) => {
    setEditingEntry(entry);
    setEditEntryForm({ name: entry.name, data: { ...entry.data } });
    setModal('editEntry');
    if (!selectedBook) return;
    const refIds = [...new Set(selectedBook.fields.filter((f) => (f.fieldType === 'reference' || f.fieldType === 'reference-multiple') && f.targetBookId).map((f) => f.targetBookId!))];
    for (const id of refIds) {
      const ensureIds: string[] = [];
      for (const f of selectedBook.fields) {
        if ((f.fieldType !== 'reference' && f.fieldType !== 'reference-multiple') || f.targetBookId !== id) continue;
        const v = entry.data[f.key];
        if (f.fieldType === 'reference' && typeof v === 'string' && v) ensureIds.push(v);
        if (f.fieldType === 'reference-multiple' && Array.isArray(v)) ensureIds.push(...(v as string[]).filter(Boolean));
      }
      loadRefPage(id, '', 0, false, [...new Set(ensureIds)]);
    }
    setRefSearchByBookId({});
    setRefOffsetByBookId({});
  };

  const setEntryData = (key: string, value: unknown) => {
    setEditEntryForm((prev) => ({
      ...prev,
      data: { ...prev.data, [key]: value },
    }));
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <p>Загрузка справочников…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Справочники</h1>
        <button
          type="button"
          onClick={() => { setModal('createBook'); setEditBookForm({ name: '', slug: '', description: '', order: 0 }); }}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #0d6efd', background: '#0d6efd', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          + Создать справочник
        </button>
      </div>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Справочники для классов, рас, предметов, редакций и т.д. Записи могут ссылаться на другие справочники (например, архетип → класс, редакция).
      </p>
      {error && (
        <div style={{ padding: 12, background: '#f8d7da', color: '#721c24', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!selectedBook ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <input
              type="search"
              placeholder="Поиск по всем справочникам (название и содержимое записей)…"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runGlobalSearch()}
              style={{ flex: '1 1 280px', minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #dee2e6' }}
            />
            <button
              type="button"
              onClick={runGlobalSearch}
              disabled={globalSearching}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#0d6efd', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
            >
              {globalSearching ? 'Поиск…' : 'Искать'}
            </button>
            {(globalSearchQuery.trim() || globalSearchResults.length > 0) && (
              <button
                type="button"
                onClick={clearGlobalSearch}
                disabled={globalSearching}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer' }}
              >
                Сбросить
              </button>
            )}
          </div>

          {globalSearchResults.length > 0 && (
            <div style={{ marginBottom: 24, border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
              <div style={{ padding: '10px 12px', background: '#f8f9fa', fontWeight: 600 }}>
                Найдено в {globalSearchResults.length} справочниках: {globalSearchResults.reduce((s, r) => s + r.entries.length, 0)} записей
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f1f3f5' }}>
                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Справочник</th>
                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Название записи</th>
                    <th style={{ padding: 10, width: 120 }} />
                  </tr>
                </thead>
                <tbody>
                  {globalSearchResults.flatMap(({ book, entries }) =>
                    entries.map((entry) => (
                      <tr key={`${book.id}-${entry.id}`} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 10, color: '#555' }}>{book.name}</td>
                        <td style={{ padding: 10 }}>{entry.name}</td>
                        <td style={{ padding: 10 }}>
                          <button
                            type="button"
                            onClick={() => selectBook(book)}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #0d6efd', background: '#fff', color: '#0d6efd', cursor: 'pointer', fontSize: 13 }}
                          >
                            Открыть справочник
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {books.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => selectBook(book)}
                style={{
                  padding: 16,
                  textAlign: 'left',
                  border: '1px solid #dee2e6',
                  borderRadius: 12,
                  background: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{book.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{book.slug}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Записей: {book.entriesCount ?? 0}</div>
              </button>
            ))}
            {books.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: '#999' }}>
                Нет справочников. Создайте первый — например «Классы», «Расы», «Редакции».
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedBook(null)}
              style={{ padding: '6px 12px', border: '1px solid #dee2e6', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
            >
              ← Назад
            </button>
            <h2 style={{ margin: 0 }}>{selectedBook.name}</h2>
            <span style={{ fontSize: 13, color: '#666' }}>{selectedBook.slug}</span>
            <button type="button" onClick={openEditBook} style={{ padding: '6px 12px', border: '1px solid #0d6efd', borderRadius: 6, background: '#fff', color: '#0d6efd', cursor: 'pointer' }}>
              Настройки
            </button>
            <button
              type="button"
              onClick={() => handleDeleteBook()}
              style={{ padding: '6px 12px', border: '1px solid #dc3545', borderRadius: 6, background: '#fff', color: '#dc3545', cursor: 'pointer' }}
            >
              Удалить справочник
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['entries', 'fields', 'settings'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: tab === t ? '#0d6efd' : '#e9ecef',
                  color: tab === t ? '#fff' : '#333',
                  cursor: 'pointer',
                  fontWeight: tab === t ? 600 : 400,
                }}
              >
                {t === 'entries' ? 'Записи' : t === 'fields' ? 'Поля' : 'Настройки'}
              </button>
            ))}
          </div>

          {tab === 'entries' && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px' }}>
                  <input
                    type="search"
                    placeholder="Поиск по названию и содержимому…"
                    value={entriesSearchQuery}
                    onChange={(e) => setEntriesSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runEntriesSearch()}
                    style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 6, border: '1px solid #dee2e6' }}
                  />
                  <button
                    type="button"
                    onClick={() => runEntriesSearch()}
                    disabled={entriesSearching}
                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #0d6efd', background: '#0d6efd', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {entriesSearching ? '…' : 'Искать'}
                  </button>
                  {entriesSearchQuery.trim() && (
                    <button
                      type="button"
                      onClick={clearEntriesSearch}
                      disabled={entriesSearching}
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer' }}
                    >
                      Сбросить
                    </button>
                  )}
                </div>
                {entriesSearchTotal !== null && (
                  <span style={{ fontSize: 13, color: '#666' }}>Найдено: {entriesSearchTotal}</span>
                )}
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const data: Record<string, unknown> = {};
                      selectedBook.fields.forEach((f) => {
                        if (f.fieldType === 'number') data[f.key] = 0;
                        else if (f.fieldType === 'reference-multiple' || f.fieldType === 'ability-bonus-list') data[f.key] = [];
                        else data[f.key] = '';
                      });
                      setEditEntryForm({ name: '', data });
                      setModal('createEntry');
                      setRefSearchByBookId({});
                      setRefOffsetByBookId({});
                      const refIds = [...new Set(selectedBook.fields.filter((f) => (f.fieldType === 'reference' || f.fieldType === 'reference-multiple') && f.targetBookId).map((f) => f.targetBookId!))];
                      setRefEntriesByBookId((p) => {
                        const next = { ...p };
                        refIds.forEach((id) => { next[id] = []; });
                        return next;
                      });
                      setRefEntriesTotalByBookId((p) => {
                        const next = { ...p };
                        refIds.forEach((id) => { next[id] = 0; });
                        return next;
                      });
                      refIds.forEach((id) => loadRefPage(id, '', 0, false));
                    }}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #28a745', background: '#28a745', color: '#fff', cursor: 'pointer' }}
                  >
                    + Добавить запись
                  </button>
                </div>
              {entriesLoading ? (
                <p>Загрузка записей…</p>
              ) : (
                <div style={{ border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
                  {entries.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Записей пока нет</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Название</th>
                          {selectedBook.fields.slice(0, 3).map((f) => (
                            <th key={f.id} style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: 12 }}>{f.name}</th>
                          ))}
                          <th style={{ padding: 10, width: 100 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: 10 }}>{entry.name}</td>
                            {selectedBook.fields.slice(0, 3).map((f) => {
                              const raw = entry.data[f.key];
                              let display: string;
                              if (f.fieldType === 'reference' && f.targetBookId && typeof raw === 'string') {
                                display = (refEntriesByBookId[f.targetBookId] ?? []).find((e) => e.id === raw)?.name ?? raw;
                              } else if (f.fieldType === 'reference-multiple' && f.targetBookId && Array.isArray(raw)) {
                                const names = (raw as string[]).map((id) => (refEntriesByBookId[f.targetBookId!] ?? []).find((e) => e.id === id)?.name ?? id);
                                display = names.length ? names.join(', ') : '—';
                              } else if (f.fieldType === 'ability-bonus-list') {
                                display = formatAbilityBonusList(raw);
                              } else {
                                display = raw != null && raw !== '' ? String(raw) : '—';
                              }
                              return (
                                <td key={f.id} style={{ padding: 10, fontSize: 13, color: '#555' }}>
                                  {display}
                                </td>
                              );
                            })}
                            <td style={{ padding: 10 }}>
                              <button type="button" onClick={() => openEditEntry(entry)} style={{ marginRight: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Изменить</button>
                              <button type="button" onClick={() => handleDeleteEntry(entry)} style={{ padding: '4px 8px', fontSize: 12, color: '#dc3545', cursor: 'pointer', border: 'none', background: 'none' }}>Удалить</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              </div>
            </>
          )}

          {tab === 'fields' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => { setEditFieldForm({ key: '', name: '', fieldType: 'string', order: 0, required: false }); setModal('createField'); }}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #28a745', background: '#28a745', color: '#fff', cursor: 'pointer' }}
                >
                  + Добавить поле
                </button>
              </div>
              <div style={{ border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
                {selectedBook.fields.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Полей нет. Добавьте поля для записей (строка, число, текст, ссылка на другой справочник).</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: 10, textAlign: 'left' }}>Ключ</th>
                        <th style={{ padding: 10, textAlign: 'left' }}>Название</th>
                        <th style={{ padding: 10, textAlign: 'left' }}>Тип</th>
                        <th style={{ padding: 10 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBook.fields.map((f) => (
                        <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 10 }}>{f.key}</td>
                          <td style={{ padding: 10 }}>{f.name}</td>
                          <td style={{ padding: 10 }}>{FIELD_TYPES.find((t) => t.value === f.fieldType)?.label ?? f.fieldType}{(f.fieldType === 'reference' || f.fieldType === 'reference-multiple') && f.targetBookId ? ` (справочник)` : ''}</td>
                          <td style={{ padding: 10 }}>
                            <button type="button" onClick={() => openEditField(f)} style={{ marginRight: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Изменить</button>
                            <button type="button" onClick={() => handleDeleteField(f)} style={{ padding: '4px 8px', fontSize: 12, color: '#dc3545', cursor: 'pointer', border: 'none', background: 'none' }}>Удалить</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {tab === 'settings' && (
            <div style={{ padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
              <p>Настройки справочника: название, ключ (slug), описание. Используйте кнопку «Настройки» выше для редактирования.</p>
            </div>
          )}
        </>
      )}

      {/* Modal: create book */}
      {modal === 'createBook' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onMouseDown={() => { overlayMouseDown.current = true; }} onClick={() => { if (overlayMouseDown.current) setModal(null); overlayMouseDown.current = false; }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, maxWidth: 400, width: '100%' }} onMouseDown={() => { overlayMouseDown.current = false; }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Новый справочник</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Название</label>
              <input type="text" value={editBookForm.name ?? ''} onChange={(e) => setEditBookForm((p) => ({ ...p, name: e.target.value }))} placeholder="Классы" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ключ (slug)</label>
              <input type="text" value={editBookForm.slug ?? ''} onChange={(e) => setEditBookForm((p) => ({ ...p, slug: e.target.value }))} placeholder="classes" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Описание</label>
              <textarea value={editBookForm.description ?? ''} onChange={(e) => setEditBookForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer' }}>Отмена</button>
              <button type="button" onClick={handleCreateBook} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0d6efd', color: '#fff', cursor: 'pointer' }}>Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: edit book */}
      {modal === 'editBook' && selectedBook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onMouseDown={() => { overlayMouseDown.current = true; }} onClick={() => { if (overlayMouseDown.current) setModal(null); overlayMouseDown.current = false; }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, maxWidth: 400, width: '100%' }} onMouseDown={() => { overlayMouseDown.current = false; }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Настройки справочника</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Название</label>
              <input type="text" value={editBookForm.name ?? ''} onChange={(e) => setEditBookForm((p) => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ключ (slug)</label>
              <input type="text" value={editBookForm.slug ?? ''} onChange={(e) => setEditBookForm((p) => ({ ...p, slug: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Описание</label>
              <textarea value={editBookForm.description ?? ''} onChange={(e) => setEditBookForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Родительские справочники</label>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: '#666' }}>Записи этого справочника могут относиться к записям выбранных справочников.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto', padding: 8, background: '#f8f9fa', borderRadius: 6 }}>
                {books.filter((b) => b.id !== selectedBook.id).length === 0 ? (
                  <span style={{ fontSize: 12, color: '#999' }}>Нет других справочников</span>
                ) : (
                  books.filter((b) => b.id !== selectedBook.id).map((b) => (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={(editBookForm.parentBookIds ?? []).includes(b.id)} onChange={() => toggleParentBook(b.id)} />
                      <span>{b.name}</span>
                      <span style={{ color: '#999', fontSize: 11 }}>{b.slug}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer' }}>Отмена</button>
              <button type="button" onClick={handleUpdateBook} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0d6efd', color: '#fff', cursor: 'pointer' }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: create/edit field */}
      {(modal === 'createField' || modal === 'editField') && selectedBook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onMouseDown={() => { overlayMouseDown.current = true; }} onClick={() => { if (overlayMouseDown.current) { setModal(null); setEditingField(null); } overlayMouseDown.current = false; }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, maxWidth: 400, width: '100%' }} onMouseDown={() => { overlayMouseDown.current = false; }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{editingField ? 'Изменить поле' : 'Новое поле'}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Название</label>
              <input type="text" value={editFieldForm.name ?? ''} onChange={(e) => setEditFieldForm((p) => ({ ...p, name: e.target.value }))} placeholder="Кость хитов" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ключ</label>
              <input type="text" value={editFieldForm.key ?? ''} onChange={(e) => setEditFieldForm((p) => ({ ...p, key: e.target.value }))} placeholder="hitDie" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} disabled={!!editingField} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Тип</label>
              <select value={editFieldForm.fieldType ?? 'string'} onChange={(e) => setEditFieldForm((p) => ({ ...p, fieldType: e.target.value as FieldType }))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }}>
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {(editFieldForm.fieldType === 'reference' || editFieldForm.fieldType === 'reference-multiple') && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Справочник для ссылки</label>
                <select value={editFieldForm.targetBookId ?? ''} onChange={(e) => setEditFieldForm((p) => ({ ...p, targetBookId: e.target.value || undefined }))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }}>
                  <option value="">— Выберите —</option>
                  {books.filter((b) => b.id !== selectedBook.id).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={editFieldForm.required ?? false} onChange={(e) => setEditFieldForm((p) => ({ ...p, required: e.target.checked }))} />
                <span>Обязательное поле</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setModal(null); setEditingField(null); }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer' }}>Отмена</button>
              <button type="button" onClick={editingField ? handleUpdateField : handleAddField} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0d6efd', color: '#fff', cursor: 'pointer' }}>{editingField ? 'Сохранить' : 'Добавить'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: create/edit entry */}
      {(modal === 'createEntry' || modal === 'editEntry') && selectedBook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onMouseDown={() => { overlayMouseDown.current = true; }} onClick={() => { if (overlayMouseDown.current) { setModal(null); setEditingEntry(null); } overlayMouseDown.current = false; }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onMouseDown={() => { overlayMouseDown.current = false; }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{editingEntry ? 'Изменить запись' : 'Новая запись'}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Название</label>
              <input type="text" value={editEntryForm.name} onChange={(e) => setEditEntryForm((p) => ({ ...p, name: e.target.value }))} placeholder="Воин" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }} />
            </div>
            {selectedBook.fields.map((f) => (
              <div key={f.id} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{f.name}{f.required ? ' *' : ''}</label>
                {f.fieldType === 'reference' && f.targetBookId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="Поиск…"
                        value={refSearchByBookId[f.targetBookId] ?? ''}
                        onChange={(e) => setRefSearchByBookId((p) => ({ ...p, [f.targetBookId!]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && loadRefPageWithEnsure(f.targetBookId!, refSearchByBookId[f.targetBookId] ?? '', 0, false)}
                        style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #dee2e6' }}
                      />
                      <button
                        type="button"
                        onClick={() => loadRefPageWithEnsure(f.targetBookId!, refSearchByBookId[f.targetBookId] ?? '', 0, false)}
                        disabled={loadingRefBookId === f.targetBookId}
                        style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #0d6efd', background: '#0d6efd', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Найти
                      </button>
                    </div>
                    {loadingRefBookId === f.targetBookId && (refEntriesByBookId[f.targetBookId]?.length ?? 0) === 0 ? (
                      <span style={{ fontSize: 12, color: '#666' }}>Загрузка…</span>
                    ) : (
                      <>
                        <select
                          value={String(editEntryForm.data[f.key] ?? '')}
                          onChange={(e) => setEntryData(f.key, e.target.value || null)}
                          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }}
                        >
                          <option value="">— Не выбрано —</option>
                          {(refEntriesByBookId[f.targetBookId] ?? []).map((ent) => (
                            <option key={ent.id} value={ent.id}>{ent.name}</option>
                          ))}
                        </select>
                        {(refEntriesTotalByBookId[f.targetBookId] ?? 0) > (refEntriesByBookId[f.targetBookId]?.length ?? 0) && (
                          <button
                            type="button"
                            onClick={() => loadRefPageWithEnsure(f.targetBookId!, refSearchByBookId[f.targetBookId] ?? '', refOffsetByBookId[f.targetBookId] ?? 0, true)}
                            disabled={loadingRefBookId === f.targetBookId}
                            style={{ fontSize: 12, padding: '4px 8px', cursor: 'pointer', alignSelf: 'flex-start' }}
                          >
                            Загрузить ещё
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : f.fieldType === 'reference-multiple' && f.targetBookId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="Поиск…"
                        value={refSearchByBookId[f.targetBookId] ?? ''}
                        onChange={(e) => setRefSearchByBookId((p) => ({ ...p, [f.targetBookId!]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && loadRefPageWithEnsure(f.targetBookId!, refSearchByBookId[f.targetBookId] ?? '', 0, false)}
                        style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #dee2e6' }}
                      />
                      <button
                        type="button"
                        onClick={() => loadRefPageWithEnsure(f.targetBookId!, refSearchByBookId[f.targetBookId] ?? '', 0, false)}
                        disabled={loadingRefBookId === f.targetBookId}
                        style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #0d6efd', background: '#0d6efd', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Найти
                      </button>
                    </div>
                    <div style={{ maxHeight: 200, overflow: 'auto', padding: '8px 0', border: '1px solid #dee2e6', borderRadius: 6, paddingLeft: 8 }}>
                      {loadingRefBookId === f.targetBookId && (refEntriesByBookId[f.targetBookId]?.length ?? 0) === 0 ? (
                        <span style={{ fontSize: 12, color: '#666' }}>Загрузка…</span>
                      ) : (
                        <>
                          {((refEntriesByBookId[f.targetBookId] ?? []) as ReferenceEntry[]).map((ent) => {
                            const selected = (Array.isArray(editEntryForm.data[f.key]) ? editEntryForm.data[f.key] as string[] : [].concat(editEntryForm.data[f.key] ?? []).filter(Boolean)) as string[];
                            const checked = selected.includes(ent.id);
                            return (
                              <label key={ent.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked ? selected.filter((id) => id !== ent.id) : [...selected, ent.id];
                                    setEntryData(f.key, next);
                                  }}
                                />
                                <span>{ent.name}</span>
                              </label>
                            );
                          })}
                          {(refEntriesTotalByBookId[f.targetBookId] ?? 0) > (refEntriesByBookId[f.targetBookId]?.length ?? 0) && (
                            <button
                              type="button"
                              onClick={() => loadRefPageWithEnsure(f.targetBookId!, refSearchByBookId[f.targetBookId] ?? '', refOffsetByBookId[f.targetBookId] ?? 0, true)}
                              disabled={loadingRefBookId === f.targetBookId}
                              style={{ marginTop: 6, fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}
                            >
                              Загрузить ещё
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : f.fieldType === 'ability-bonus-list' ? (
                  (() => {
                    const raw = editEntryForm.data[f.key];
                    const list: AbilityBonusItem[] = Array.isArray(raw)
                      ? (raw as unknown[]).filter((x): x is AbilityBonusItem => x != null && typeof x === 'object' && 'ability_key' in x && typeof (x as AbilityBonusItem).bonus === 'number')
                      : [];
                    return (
                      <div style={{ border: '1px solid #dee2e6', borderRadius: 6, padding: 8 }}>
                        {list.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <select
                              value={item.ability_key ?? ''}
                              onChange={(e) => setEntryData(f.key, list.map((it, i) => (i === idx ? { ...it, ability_key: e.target.value } : it)))}
                              style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #dee2e6' }}
                            >
                              {ABILITY_BONUS_KEYS.map((a) => (
                                <option key={a.value} value={a.value}>{a.label}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={item.bonus ?? 0}
                              onChange={(e) => setEntryData(f.key, list.map((it, i) => (i === idx ? { ...it, bonus: e.target.value === '' ? 0 : Number(e.target.value) } : it)))}
                              style={{ width: 72, padding: 6, borderRadius: 4, border: '1px solid #dee2e6' }}
                            />
                            <button type="button" onClick={() => setEntryData(f.key, list.filter((_, i) => i !== idx))} style={{ padding: '4px 8px', cursor: 'pointer', border: 'none', background: '#dc3545', color: '#fff', borderRadius: 4 }}>−</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setEntryData(f.key, [...list, { ability_key: 'strength', bonus: 0 }])} style={{ marginTop: 4, padding: '6px 12px', cursor: 'pointer', border: '1px solid #28a745', background: '#28a745', color: '#fff', borderRadius: 4 }}>+ Добавить бонус</button>
                      </div>
                    );
                  })()
                ) : f.fieldType === 'text' ? (
                  <textarea
                    value={String(editEntryForm.data[f.key] ?? '')}
                    onChange={(e) => setEntryData(f.key, e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }}
                  />
                ) : f.fieldType === 'number' ? (
                  <input
                    type="number"
                    value={editEntryForm.data[f.key] ?? ''}
                    onChange={(e) => setEntryData(f.key, e.target.value === '' ? null : Number(e.target.value))}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }}
                  />
                ) : (
                  <input
                    type="text"
                    value={String(editEntryForm.data[f.key] ?? '')}
                    onChange={(e) => setEntryData(f.key, e.target.value)}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #dee2e6' }}
                  />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => { setModal(null); setEditingEntry(null); }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer' }}>Отмена</button>
              <button type="button" onClick={editingEntry ? handleUpdateEntry : handleCreateEntry} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0d6efd', color: '#fff', cursor: 'pointer' }}>{editingEntry ? 'Сохранить' : 'Добавить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferenceBooksPage;
