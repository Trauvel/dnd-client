Да, так делается нормально. Самый практичный вариант для твоей схемы: распознавание на стороне клиента → отправка текста на сервер. Аудио можно вообще не отправлять (проще, дешевле, меньше рисков).

Ниже — рабочая архитектура и минимальный код под WebSocket (лучше, чем HTTP, потому что стрим и меньше накладных расходов).

Архитектура
На клиенте (страница игрока)

Захват микрофона (только чтобы легально держать “режим диктовки” и показывать индикатор). Само распознавание — через Web Speech API.

Получаешь события распознавания:

partial (промежуточный текст)

final (зафиксированная фраза)

Отправляешь на сервер:

roomId

playerId (или имя)

type: partial|final

text

tsClient (timestamp)

seq (счётчик сообщений, чтобы упорядочивать)

На сервере (Node.js)

WS принимает сообщения.

Сервер проверяет room/player, проставляет tsServer.

Пишет в лог (файл/SQLite/PostgreSQL).

(Опционально) ретранслирует мастеру/всем “живую ленту”.

Почему WS, а не HTTP

Частые короткие сообщения (partial) по HTTP будут шуметь и грузить сервер.

WS держит одно соединение → минимальная задержка.

Минимальный протокол сообщений

Клиент → сервер:

{
  "v": 1,
  "roomId": "room-123",
  "playerId": "p1",
  "type": "partial",
  "seq": 42,
  "tsClient": 1700000000000,
  "text": "я иду к ворот"
}

Сервер → мастер (опционально):

{
  "roomId": "room-123",
  "playerId": "p1",
  "type": "final",
  "seq": 43,
  "tsServer": 1700000000123,
  "text": "я иду к воротам"
}
Клиент (браузер): Web Speech + WS

Важно: Web Speech API лучше всего работает в Chromium (Chrome/Edge). В Firefox часто не работает. Но ты уже готов к “на стороне игрока”.

<button id="start">Старт</button>
<button id="stop">Стоп</button>
<pre id="live"></pre>

<script>
const roomId = "room-123";
const playerId = "p1";

let ws;
let recognition;
let seq = 0;
let running = false;

function connectWs() {
  ws = new WebSocket("ws://localhost:8080");
  ws.onopen = () => console.log("WS open");
  ws.onclose = () => console.log("WS close");
  ws.onerror = (e) => console.log("WS error", e);
}

function send(type, text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    v: 1,
    roomId,
    playerId,
    type,
    seq: ++seq,
    tsClient: Date.now(),
    text
  }));
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert("SpeechRecognition недоступен в этом браузере");
    return;
  }

  recognition = new SR();
  recognition.lang = "ru-RU";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const txt = (res[0]?.transcript || "").trim();
      if (!txt) continue;

      if (res.isFinal) finalText += (finalText ? " " : "") + txt;
      else interim += (interim ? " " : "") + txt;
    }

    // Показываем живую строку игроку
    document.getElementById("live").textContent =
      (finalText ? ("FINAL: " + finalText + "\n") : "") +
      (interim ? ("LIVE: " + interim) : "");

    // Отправляем на сервер
    if (interim) send("partial", interim);
    if (finalText) send("final", finalText);
  };

  recognition.onerror = (e) => {
    // Часто бывают: no-speech, audio-capture, not-allowed, network
    console.log("rec error", e.error);
    // Можно попробовать перезапускать, но аккуратно
  };

  recognition.onend = () => {
    // В некоторых браузерах continuous всё равно заканчивается
    if (running) {
      try { recognition.start(); } catch {}
    }
  };

  running = true;
  recognition.start();
}

function stopRecognition() {
  running = false;
  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
  }
}

document.getElementById("start").onclick = () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) connectWs();
  startRecognition();
};

document.getElementById("stop").onclick = () => {
  stopRecognition();
  if (ws) ws.close();
};
</script>

Примечание: микрофон getUserMedia здесь не обязателен, потому что SpeechRecognition сам запросит доступ. Если хочешь индикатор уровня громкости/запись аудио — добавим.

Сервер (Node.js): ws + лог в файл (JSONL)

Установка:

npm i ws

server.js:

import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

const wss = new WebSocketServer({ port: 8080 });

const logsDir = path.resolve("./logs");
fs.mkdirSync(logsDir, { recursive: true });

// roomId -> Set(ws)
const roomClients = new Map();

function appendLog(roomId, lineObj) {
  const file = path.join(logsDir, `${roomId}.jsonl`);
  fs.appendFile(file, JSON.stringify(lineObj) + "\n", () => {});
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

wss.on("connection", (ws) => {
  ws.roomId = null;
  ws.playerId = null;
  ws.role = "player"; // можно "dm"

  ws.on("message", (buf) => {
    const msg = safeJsonParse(buf.toString("utf8"));
    if (!msg || msg.v !== 1) return;

    const { roomId, playerId, type, text, seq, tsClient } = msg;

    // минимальная валидация
    if (!roomId || !playerId) return;
    if (type !== "partial" && type !== "final") return;
    if (typeof text !== "string" || !text.trim()) return;

    // запоминаем привязку сокета к комнате
    if (!ws.roomId) {
      ws.roomId = roomId;
      ws.playerId = playerId;

      if (!roomClients.has(roomId)) roomClients.set(roomId, new Set());
      roomClients.get(roomId).add(ws);
    }

    const entry = {
      roomId,
      playerId,
      type,
      seq: Number.isFinite(seq) ? seq : null,
      tsClient: Number.isFinite(tsClient) ? tsClient : null,
      tsServer: Date.now(),
      text: text.trim()
    };

    // логируем только final (обычно достаточно)
    if (type === "final") appendLog(roomId, entry);

    // (опционально) транслируем DM/наблюдателям
    const clients = roomClients.get(roomId);
    if (clients) {
      const payload = JSON.stringify(entry);
      for (const c of clients) {
        if (c.readyState === 1) c.send(payload);
      }
    }
  });

  ws.on("close", () => {
    if (ws.roomId && roomClients.has(ws.roomId)) {
      roomClients.get(ws.roomId).delete(ws);
      if (roomClients.get(ws.roomId).size === 0) roomClients.delete(ws.roomId);
    }
  });
});

console.log("WS server on ws://localhost:8080");

Формат jsonl удобен: одна реплика = одна строка JSON.

Практические детали, без которых будет больно
1) Не логируй все partial

Partial приходят часто и “шумные”.
Схема:

partial: показывать мастеру “живую строку” (UI), но не писать в БД/файл.

final: писать в лог.

2) Склейка фраз

SpeechRecognition иногда режет фразу странно. На сервере можно склеивать “final” от одного игрока, если пауза < N секунд. Но это уже второй шаг.

3) Перезапуск recognition

Даже с continuous = true распознавание может завершаться. Поэтому onend -> start() (как в примере).

4) Идентификация и безопасность

Минимум:

при входе в комнату выдавай token (JWT или просто случайная строка).

сервер принимает сообщения только с валидным токеном.

Иначе любой сможет слать фейки в лог.