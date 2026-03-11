import { useState, useEffect } from 'react';
import { getReferenceBooks, getReferenceEntries } from '../../api/referenceBooks';
import type { ReferenceBook } from '../../api/referenceBooks';
import { generateTreasure, generateTreasureFromEntries, type TreasureItem } from './treasureData';

const style = { padding: 6, marginBottom: 4, borderRadius: 4, border: '1px solid #dee2e6', background: '#fff', fontSize: 13 };

export function TreasureGenerator() {
  const [items, setItems] = useState<TreasureItem[]>([]);
  const [level, setLevel] = useState<'low' | 'mid' | 'high'>('mid');
  const [books, setBooks] = useState<ReferenceBook[]>([]);
  const [source, setSource] = useState<'builtin' | string>('builtin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReferenceBooks().then(setBooks).catch(() => setBooks([]));
  }, []);

  const handleGenerate = async () => {
    setError(null);
    if (source === 'builtin') {
      setItems(generateTreasure(level));
      return;
    }
    setLoading(true);
    try {
      const entries = await getReferenceEntries(source);
      const result = generateTreasureFromEntries(
        entries.map((e) => ({ name: e.name, data: e.data })),
        level
      );
      setItems(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки справочника');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 13 }}>
          Источник сокровищ:
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={{ marginLeft: 8, padding: '4px 8px', minWidth: 220 }}
          >
            <option value="builtin">Встроенный список</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Уровень:
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as 'low' | 'mid' | 'high')}
            style={{ marginLeft: 6, padding: 4 }}
          >
            <option value="low">Низкий</option>
            <option value="mid">Средний</option>
            <option value="high">Высокий</option>
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}
          >
            {loading ? 'Загрузка…' : 'Сгенерировать сокровища'}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: '#dc3545' }}>{error}</div>}
      </div>
      {items.length > 0 && (
        <div>
          {items.map((it, i) => (
            <div key={i} style={style}>
              {it.type === 'coins' && it.value && `💰 ${it.description}: ${it.value}`}
              {it.type === 'gem' && `💎 ${it.description}`}
              {it.type === 'item' && `📦 ${it.description}`}
              {it.type === 'magic' && `✨ ${it.description}`}
              {it.type === 'ref' && (
                <>
                  📜 {it.description}
                  {it.value != null && it.value !== '' && ` — ${it.value}`}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
