
"use strict";

const DB_NAME = "QuizDatabase";
const DB_VERSION = 1;

let db = null;
let dbPromise = null;

const TEST_QUESTION = {
    category: "Аниме",
    question: "Как зовут капитана пиратов Соломенной Шляпы?",
    answer: "Луффи"
};

// ==========================================
// ОТКРЫТИЕ БАЗЫ
// ==========================================

function openDatabase() {
    if (db) return Promise.resolve(db);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains("questions")) {
                const store = database.createObjectStore("questions", {
                    keyPath: "id",
                    autoIncrement: true
                });

                store.createIndex("batchId", "batchId", {
                    unique: false
                });
            }

            if (!database.objectStoreNames.contains("batches")) {
                database.createObjectStore("batches", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }

            if (!database.objectStoreNames.contains("meta")) {
                database.createObjectStore("meta", {
                    keyPath: "key"
                });
            }
        };

        request.onsuccess = () => {
            db = request.result;

            db.onversionchange = () => {
                db.close();
                db = null;
                dbPromise = null;
            };

            // ВАЖНО: сразу завершаем открытие базы.
            // Тестовый вопрос добавляется отдельно.
            resolve(db);
        };

        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };
    });

    return dbPromise;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function normalizeText(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase()
        .replace(/ё/g, "е");
}

function normalizeQuestion(item) {
    if (!item || typeof item !== "object") {
        return null;
    }

    const category = String(item.category ?? "").trim();
    const question = String(item.question ?? "").trim();
    const answer = String(item.answer ?? "").trim();

    if (!category || !question || !answer) {
        return null;
    }

    return { category, question, answer };
}

function questionKey(item) {
    return normalizeText(item.category) +
        "|" + normalizeText(item.question);
}

function getStore(name, mode = "readonly") {
    if (!db) {
        throw new Error("База данных ещё не открыта");
    }

    return db.transaction(name, mode).objectStore(name);
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ==========================================
// ПОЛУЧЕНИЕ ДАННЫХ
// ==========================================

async function getAllQuestions() {
    await openDatabase();
    return requestResult(getStore("questions").getAll());
}

async function getAllBatches() {
    await openDatabase();
    return requestResult(getStore("batches").getAll());
}

async function getCategories() {
    const items = await getAllQuestions();
    const categories = new Map();

    for (const item of items) {
        const key = normalizeText(item.category);

        if (!categories.has(key)) {
            categories.set(key, item.category.trim());
        }
    }

    return [...categories.values()].sort((a, b) =>
        a.localeCompare(b, "ru")
    );
}

// ==========================================
// ИМПОРТ ВОПРОСОВ
// ==========================================

async function importQuestions(
    items,
    batchName = "Новый набор",
    source = "Вставка"
) {
    await openDatabase();

    if (!Array.isArray(items)) {
        throw new Error("Ожидается массив вопросов");
    }

    const existing = await getAllQuestions();
    const known = new Set(existing.map(questionKey));

    const accepted = [];
    let duplicates = 0;
    let invalid = 0;

    for (const rawItem of items) {
        const item = normalizeQuestion(rawItem);

        if (!item) {
            invalid++;
            continue;
        }

        const key = questionKey(item);

        if (known.has(key)) {
            duplicates++;
            continue;
        }

        known.add(key);
        accepted.push(item);
    }

    if (accepted.length === 0) {
        return {
            imported: 0,
            duplicates,
            invalid,
            batchId: null
        };
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            ["questions", "batches"],
            "readwrite"
        );

        const questionsStore = transaction.objectStore("questions");
        const batchesStore = transaction.objectStore("batches");

        const batchRequest = batchesStore.add({
            name: String(batchName || "Новый набор").trim(),
            source: String(source || "Неизвестный источник"),
            date: new Date().toISOString(),
            count: accepted.length
        });

        let batchId = null;

        batchRequest.onsuccess = () => {
            batchId = batchRequest.result;

            for (const item of accepted) {
                questionsStore.add({
                    ...item,
                    batchId
                });
            }
        };

        transaction.oncomplete = () => {
            resolve({
                imported: accepted.length,
                duplicates,
                invalid,
                batchId
            });
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(transaction.error || new Error("Импорт отменён"));
        };
    });
}

// ==========================================
// УДАЛЕНИЕ НАБОРА
// ==========================================

async function deleteBatch(batchId) {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            ["questions", "batches"],
            "readwrite"
        );

        const questionsStore = transaction.objectStore("questions");
        const batchesStore = transaction.objectStore("batches");

        const index = questionsStore.index("batchId");

        const request = index.openCursor(
            IDBKeyRange.only(Number(batchId))
        );

        request.onsuccess = () => {
            const cursor = request.result;

            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        batchesStore.delete(Number(batchId));

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

// ==========================================
// ДОБАВЛЕНИЕ ТЕСТОВОГО ВОПРОСА
// ==========================================

async function addTestQuestion() {
    await openDatabase();

    const marker = await requestResult(
        getStore("meta").get("testQuestionAdded")
    );

    if (marker) return;

    const existing = await getAllQuestions();

    if (existing.length === 0) {
        await importQuestions(
            [TEST_QUESTION],
            "Стартовый тестовый вопрос",
            "Система"
        );
    }

    await new Promise((resolve, reject) => {
        const transaction = db.transaction("meta", "readwrite");

        transaction.objectStore("meta").put({
            key: "testQuestionAdded",
            value: true
        });

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

// ==========================================
// ЧТЕНИЕ TXT
// ==========================================

function parseTXT(text) {
    const blocks = String(text)
        .replace(/^\uFEFF/, "")
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)
        .filter(block => block.trim());

    const result = [];

    for (const block of blocks) {
        const item = {
            category: "",
            question: "",
            answer: ""
        };

        for (const line of block.split("\n")) {
            const match = line.match(
                /^\s*(Категория|Вопрос|Ответ)\s*:\s*(.*)$/i
            );

            if (!match) continue;

            const key = match[1].toLowerCase();
            const value = match[2].trim();

            if (key === "категория") item.category = value;
            if (key === "вопрос") item.question = value;
            if (key === "ответ") item.answer = value;
        }

        result.push(item);
    }

    return result;
}

// ==========================================
// ЧТЕНИЕ JSON
// ==========================================

function parseJSON(text) {
    const data = JSON.parse(text);

    if (Array.isArray(data)) {
        return data;
    }

    if (data && Array.isArray(data.questions)) {
        return data.questions;
    }

    throw new Error("В JSON не найден массив вопросов");
}

// ==========================================
// ЭКСПОРТ БАЗЫ
// ==========================================

async function exportDatabase() {
    const questions = await getAllQuestions();

    const data = questions.map(item => ({
        category: item.category,
        question: item.question,
        answer: item.answer
    }));

    return JSON.stringify(data, null, 4);
}
