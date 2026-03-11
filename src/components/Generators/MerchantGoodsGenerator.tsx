import { useState, useEffect } from 'react';
import { getReferenceBooks, getReferenceEntries } from '../../api/referenceBooks';
import type { ReferenceBook } from '../../api/referenceBooks';
import {
  generateMerchantGoods,
  generateMerchantGoodsFromEntries,
  MERCHANT_CATEGORIES,
  MERCHANT_QUALITIES,
  type MerchantCategory,
  type MerchantQuality,
} from './merchantGoodsData';

const style = { padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #dee2e6', background: '#f8f9fa' };

export function MerchantGoodsGenerator() {
  const [list, setList] = useState<Array<{ name: string; price: number; priceText?: string; qty: number | string; note?: string }>>([]);
  const [count, setCount] = useState(12);
  const [category, setCategory] = useState<MerchantCategory>('Коробейник');
  const [quality, setQuality] = useState<MerchantQuality>('Средний');
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
      setList(generateMerchantGoods(category, quality, count));
      return;
    }
    setLoading(true);
    try {
      const entries = await getReferenceEntries(source);
      const result = generateMerchantGoodsFromEntries(
        entries.map((e) => ({ name: e.name, data: e.data })),
        quality,
        count
      );
      setList(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки справочника');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 13 }}>
          Источник товаров:
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
        {source === 'builtin' && (
          <label style={{ fontSize: 13 }}>
            Категория:
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MerchantCategory)}
              style={{ marginLeft: 8, padding: '4px 8px', minWidth: 220 }}
            >
              {MERCHANT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
        )}
        <label style={{ fontSize: 13 }}>
          Качество:
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as MerchantQuality)}
            style={{ marginLeft: 8, padding: '4px 8px', minWidth: 140 }}
          >
            {MERCHANT_QUALITIES.map((q) => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13 }}>
            Количество товаров:
            <input
              type="number"
              min={5}
              max={24}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 12)}
              style={{ marginLeft: 6, width: 48, padding: 4 }}
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}
          >
            {loading ? 'Загрузка…' : 'Сгенерировать список'}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: '#dc3545' }}>{error}</div>}
      </div>
      {list.length > 0 && (
        <div style={{ fontSize: 13 }}>
          {list.map((g, i) => (
            <div key={i} style={style}>
              <strong>{g.name}</strong>
              {' — '}
              {g.priceText ?? `${g.price} зм`}
              {g.qty != null && g.qty !== '' && ` · В наличии: ${g.qty}`}
              {g.note && <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>{g.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
