# Скрипты dnd-client

## Генератор торговца: данные из папки market

Список товаров для **встроенного** генератора берётся из папки `market/*.md`.

### Куда положить папку market (локально и на сервере)

Папка `market` должна лежать **рядом с папкой dnd-client** (общий родитель).

Пример структуры:

```
app/                    (или любой корень проекта)
├── dnd-client/        — фронтенд
├── market/             — сюда положить папку market с .md файлами
│   ├── Алкоголь и напитки.md
│   ├── Воровские приспособления.md
│   ├── ...
│   └── Редкий Чары.md
└── rpg-core/
```

На сервере: склонируй репозиторий так, чтобы и `dnd-client`, и `market` были в одной родительской папке (например, `app/`). Затем из каталога `dnd-client` выполни:

```bash
cd dnd-client
npm run parse-market
npm run build
```

После этого в сборке будет актуальный список товаров из `market/*.md`.

---

## Справочник «Магические предметы» (website-api)

Справочник заполняется не из dnd-client, а из **backend** (website-api). Нужен файл с данными и сид.

### Файл с данными

Положи файл с магическими предметами сюда:

**`sdr/ru/allitems.js`** — относительно корня, где лежат папки `dnd-client`, `rpg-core`, `sdr`.

То есть структура:

```
app/
├── dnd-client/
├── rpg-core/
│   └── services/
│       └── website-api/
└── sdr/
    └── ru/
        └── allitems.js   ← сюда
```

В `allitems.js` в конце должен быть экспорт массива:

```js
var allItems = [
  { en: { name: "...", type: "...", rarity: 0, attunement: "...", text: "...", source: "DMG" }, ru: { name: "...", ... } },
  // ...
];
```

Поля записей (как в справочнике): `name`, `type` (item_type), `typeAdditions`, `rarity` (число), `attunement`, `text` (описание), `source`.

### Как заполнить справочник на сервере

1. Создать справочник и поля (один раз):
   из каталога `rpg-core/services/website-api`:
   ```bash
   npx ts-node -r tsconfig-paths/register prisma/seed-races.ts
   ```
   (в нём вызывается сид `magic-items`.)

2. Загрузить записи из `allitems.js`:
   из того же каталога `website-api`:
   ```bash
   npx ts-node -r tsconfig-paths/register prisma/seed-items.ts
   ```
   Скрипт ищет `allitems.js` в `app/sdr/ru/allitems.js` и в других вариантах путей (см. `seed-items.ts`).

Если `sdr/ru` лежит не в `app/`, а рядом с `rpg-core`, подойдёт путь `rpg-core/sdr/ru/allitems.js`.
