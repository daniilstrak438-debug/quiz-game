
"use strict";

// ==========================================
// ОСНОВНЫЕ ПЕРЕМЕННЫЕ
// ==========================================

let teams = ["Команда 1", "Команда 2"];
let scores = [];
let questionCount = 5;
let gameQuestions = [];
let currentQuestion = 0;

let answerOpened = false;
let questionResolved = false;
let gameActive = false;
let isPaused = false;

const ROUND_TIME = 20;
let timeLeft = ROUND_TIME;
let timerInterval = null;

let pointerStartX = 0;
let pointerStartY = 0;
let pointerId = null;
let dragging = false;

let allQuestions = [];
let selectedCategories = new Set();

const audioFiles = {};
const audioElements = {};


// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const screen = document.getElementById(screenId);

    if (screen) {
        screen.classList.add("active");
    }
}

function shuffleArray(array) {
    const result = array.slice();

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function updateTimerDisplay() {
    document.getElementById("timer").textContent = timeLeft;

    document.getElementById("timer-progress").style.width =
        (timeLeft / ROUND_TIME * 100) + "%";

    const urgent = timeLeft <= 5;

    document.getElementById("timer").classList.toggle("urgent", urgent);

    document.getElementById("timer-progress")
        .classList.toggle("urgent", urgent);
}


// ==========================================
// ЗВУКИ
// ==========================================

function playSound(type) {
    const checkbox = document.getElementById(type + "-enabled");

    if (!checkbox || !checkbox.checked) return;

    const audio = audioElements[type];

    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
    }

    // Простые встроенные звуки, если свой файл не загружен.
    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        const frequencies = {
            "button-sound": 500,
            "point-sound": 850,
            "timeout-sound": 180,
            "victory-sound": 1000
        };

        oscillator.frequency.value = frequencies[type] || 500;
        oscillator.type = "sine";

        gain.gain.setValueAtTime(0.12, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            context.currentTime + 0.2
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start();
        oscillator.stop(context.currentTime + 0.2);

        oscillator.onended = () => context.close();
    } catch (error) {
        console.warn("Не удалось воспроизвести звук:", error);
    }
}

function playMusic() {
    const checkbox = document.getElementById("music-enabled");

    if (!checkbox || !checkbox.checked) return;

    const music = audioElements.music;

    if (music) {
        music.loop = true;
        music.play().catch(() => {});
    }
}

function stopMusic() {
    const music = audioElements.music;

    if (music) {
        music.pause();
    }
}

function loadSettings() {
    const ids = [
        "music-enabled",
        "button-sound-enabled",
        "point-sound-enabled",
        "timeout-sound-enabled",
        "victory-sound-enabled"
    ];

    ids.forEach(id => {
        const checkbox = document.getElementById(id);
        const saved = localStorage.getItem("quiz-" + id);

        checkbox.checked = saved === null
            ? id === "button-sound-enabled" ||
              id === "point-sound-enabled" ||
              id === "timeout-sound-enabled" ||
              id === "victory-sound-enabled"
            : saved === "true";

        checkbox.addEventListener("change", () => {
            localStorage.setItem(
                "quiz-" + id,
                checkbox.checked
            );

            if (id === "music-enabled") {
                if (checkbox.checked) playMusic();
                else stopMusic();
            }
        });
    });
}

function setupAudioFiles() {
    const files = {
        "music-file": "music",
        "button-sound-file": "button-sound",
        "point-sound-file": "point-sound",
        "timeout-sound-file": "timeout-sound",
        "victory-sound-file": "victory-sound"
    };

    Object.entries(files).forEach(([inputId, type]) => {
        const input = document.getElementById(inputId);

        input.addEventListener("change", () => {
            const file = input.files[0];

            if (!file) return;

            if (audioFiles[type]) {
                URL.revokeObjectURL(audioFiles[type]);
            }

            const url = URL.createObjectURL(file);
            audioFiles[type] = url;

            if (audioElements[type]) {
                audioElements[type].pause();
            }

            audioElements[type] = new Audio(url);

            if (type === "music" &&
                document.getElementById("music-enabled").checked) {
                playMusic();
            }

            alert("Аудиофайл загружен!");
        });
    });
}


// ==========================================
// ТАЙМЕР
// ==========================================

function startTimer() {
    stopTimer();

    timeLeft = ROUND_TIME;
    updateTimerDisplay();

    runTimer();
}

function runTimer() {
    stopTimer();

    timerInterval = setInterval(() => {
        if (!gameActive || questionResolved || isPaused) {
            stopTimer();
            return;
        }

        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            stopTimer();
            skipQuestion();
        }
    }, 1000);
}


// ==========================================
// ГЛАВНЫЙ ЭКРАН
// ==========================================

document.getElementById("start-btn").addEventListener("click", () => {
    playSound("button-sound");
    renderTeams();
    showScreen("teams-screen");
});

document.getElementById("database-btn").addEventListener("click", async () => {
    playSound("button-sound");
    showScreen("database-screen");
    await renderBatches();
});

document.getElementById("settings-btn").addEventListener("click", () => {
    playSound("button-sound");
    showScreen("settings-screen");
});

document.getElementById("database-back-btn").addEventListener("click", () => {
    playSound("button-sound");
    showScreen("start-screen");
});

document.getElementById("settings-back-btn").addEventListener("click", () => {
    playSound("button-sound");
    showScreen("start-screen");
});


// ==========================================
// КОМАНДЫ
// ==========================================

function renderTeams() {
    const container = document.getElementById("teams-list");
    container.innerHTML = "";

    teams.forEach((teamName, index) => {
        const item = document.createElement("div");
        item.className = "team-item";

        const input = document.createElement("input");
        input.value = teamName;
        input.placeholder = "Название команды";

        input.addEventListener("input", () => {
            teams[index] = input.value;
        });

        item.appendChild(input);

        if (teams.length > 2) {
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Удалить";

            deleteButton.addEventListener("click", () => {
                teams.splice(index, 1);
                renderTeams();
            });

            item.appendChild(deleteButton);
        }

        container.appendChild(item);
    });

    document.getElementById("add-team-btn").style.display =
        teams.length < 4 ? "block" : "none";
}

document.getElementById("add-team-btn").addEventListener("click", () => {
    if (teams.length < 4) {
        teams.push("Команда " + (teams.length + 1));
        renderTeams();
    }
});

document.getElementById("teams-next-btn").addEventListener("click", async () => {
    playSound("button-sound");

    if (teams.some(team => !team.trim())) {
        alert("У каждой команды должно быть название.");
        return;
    }

    await refreshQuestions();
    renderCategories();
    showScreen("questions-screen");
});


// ==========================================
// ЗАГРУЗКА ВОПРОСОВ ИЗ INDEXEDDB
// ==========================================

async function refreshQuestions() {
    try {
        await openDatabase();
        allQuestions = await getAllQuestions();

        document.getElementById("available-count").textContent =
            "Всего вопросов в базе: " + allQuestions.length;

        return allQuestions;
    } catch (error) {
        console.error(error);
        alert("Не удалось загрузить базу вопросов.");
        return [];
    }
}


// ==========================================
// КАТЕГОРИИ
// ==========================================

function renderCategories() {
    const container = document.getElementById("categories-list");
    container.innerHTML = "";

    const categories = [
        ...new Set(allQuestions.map(item => item.category))
    ].sort((a, b) => a.localeCompare(b, "ru"));

    categories.forEach(category => {
        const label = document.createElement("label");
        label.className = "category-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedCategories.size === 0 ||
            selectedCategories.has(category);

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                selectedCategories.add(category);
            } else {
                selectedCategories.delete(category);
            }

            updateAvailableCount();
        });

        const text = document.createElement("span");
        text.textContent = category;

        label.appendChild(checkbox);
        label.appendChild(text);

        container.appendChild(label);
    });

    selectedCategories = new Set(categories);
    updateAvailableCount();
}

function updateAvailableCount() {
    const categories = [...document.querySelectorAll(
        "#categories-list input[type='checkbox']"
    )];

    const selected = categories
        .filter(checkbox => checkbox.checked)
        .map(checkbox =>
            checkbox.nextElementSibling.textContent
        );

    const count = allQuestions.filter(item =>
        selected.includes(item.category)
    ).length;

    document.getElementById("available-count").textContent =
        "Доступно вопросов: " + count;
}

document.getElementById("select-all-categories")
    .addEventListener("click", () => {
        document.querySelectorAll(
            "#categories-list input[type='checkbox']"
        ).forEach(checkbox => {
            checkbox.checked = true;
        });

        updateAvailableCount();
    });


// ==========================================
// НАЧАЛО ИГРЫ
// ==========================================

document.getElementById("questions-next-btn").addEventListener("click", () => {
    playSound("button-sound");

    const count = Number(
        document.getElementById("question-count").value
    );

    if (!Number.isInteger(count) || count < 1) {
        alert("Введи правильное количество вопросов.");
        return;
    }

    const selected = [...document.querySelectorAll(
        "#categories-list input[type='checkbox']:checked"
    )].map(checkbox =>
        checkbox.nextElementSibling.textContent
    );

    if (selected.length === 0) {
        alert("Выбери хотя бы одну категорию.");
        return;
    }

    const availableQuestions = allQuestions.filter(item =>
        selected.includes(item.category)
    );

    if (availableQuestions.length === 0) {
        alert("В выбранных категориях нет вопросов.");
        return;
    }

    if (count > availableQuestions.length) {
        alert(
            "В выбранных категориях только " +
            availableQuestions.length + " вопросов."
        );
        return;
    }

    questionCount = count;

    scores = teams.map(() => 0);

    gameQuestions = shuffleArray(availableQuestions)
        .slice(0, questionCount);

    currentQuestion = 0;
    answerOpened = false;
    questionResolved = false;
    gameActive = true;
    isPaused = false;

    document.getElementById("pause-btn").style.display = "block";

    showScreen("game-screen");
    playMusic();
    renderQuestion();
});


// ==========================================
// ОТОБРАЖЕНИЕ ВОПРОСА
// ==========================================

function renderQuestion() {
    stopTimer();

    if (currentQuestion >= questionCount) {
        finishGame();
        return;
    }

    const question = gameQuestions[currentQuestion];

    questionResolved = false;
    answerOpened = false;
    dragging = false;
    isPaused = false;

    const circle = document.getElementById("game-circle");

    circle.className = "";
    circle.style.transform = "translate(0, 0)";
    circle.style.opacity = "1";

    document.getElementById("pause-btn").style.display = "block";

    document.getElementById("round-counter").textContent =
        "Вопрос " + (currentQuestion + 1) + " / " + questionCount;

    document.getElementById("category").textContent =
        question.category;

    document.getElementById("question-text").textContent =
        question.question;

    document.getElementById("circle-text").textContent = "?";

    document.getElementById("game-hint").style.display = "block";
    document.getElementById("game-hint").textContent =
        "Нажми на круг, чтобы открыть ответ";

    document.getElementById("swipe-hint").style.display = "none";

    document.getElementById("round-feedback").textContent = "";
    document.getElementById("round-feedback").className = "";

    document.getElementById("direction-info").textContent = "";

    startTimer();
}


// ==========================================
// ОТКРЫТИЕ ОТВЕТА
// ==========================================

function revealAnswer() {
    if (answerOpened || questionResolved || !gameActive || isPaused) {
        return;
    }

    answerOpened = true;

    document.getElementById("circle-text").textContent =
        gameQuestions[currentQuestion].answer;

    document.getElementById("game-hint").style.display = "none";
    document.getElementById("swipe-hint").style.display = "block";
}


// ==========================================
// ПРОПУСК ВОПРОСА
// ==========================================

function skipQuestion() {
    if (questionResolved || !gameActive || isPaused) {
        return;
    }

    questionResolved = true;
    stopTimer();

    playSound("timeout-sound");

    const feedback = document.getElementById("round-feedback");
    feedback.textContent = "ВРЕМЯ ВЫШЛО!";
    feedback.className = "timeout";

    document.getElementById("game-circle").style.opacity = "0";
    document.getElementById("game-hint").style.display = "none";
    document.getElementById("swipe-hint").style.display = "none";
    document.getElementById("pause-btn").style.display = "none";

    setTimeout(() => {
        if (!gameActive) return;

        currentQuestion++;
        renderQuestion();
    }, 700);
}


// ==========================================
// ПАУЗА
// ==========================================

document.getElementById("pause-btn").addEventListener("click", () => {
    if (!gameActive || questionResolved || isPaused) return;

    playSound("button-sound");

    isPaused = true;
    stopTimer();

    const circle = document.getElementById("game-circle");

    circle.className = "paused";
    circle.style.transform = "translate(0, 0)";
    circle.style.opacity = "1";

    document.getElementById("circle-text").textContent = "ПРОДОЛЖИТЬ";
    document.getElementById("game-hint").style.display = "none";
    document.getElementById("swipe-hint").style.display = "none";
    document.getElementById("pause-btn").style.display = "none";
});

function resumeGame() {
    if (!isPaused || !gameActive) return;

    playSound("button-sound");

    isPaused = false;

    const circle = document.getElementById("game-circle");

    circle.className = "";
    circle.style.transform = "translate(0, 0)";

    document.getElementById("pause-btn").style.display = "block";

    if (answerOpened) {
        document.getElementById("circle-text").textContent =
            gameQuestions[currentQuestion].answer;

        document.getElementById("game-hint").style.display = "none";
        document.getElementById("swipe-hint").style.display = "block";
    } else {
        document.getElementById("circle-text").textContent = "?";
        document.getElementById("game-hint").style.display = "block";
        document.getElementById("swipe-hint").style.display = "none";
    }

    runTimer();
}


// ==========================================
// СВАЙПЫ
// ==========================================

const circle = document.getElementById("game-circle");

circle.addEventListener("pointerdown", event => {
    if (!gameActive || questionResolved) return;

    if (isPaused) {
        resumeGame();
        return;
    }

    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerId = event.pointerId;
    dragging = false;

    circle.setPointerCapture(event.pointerId);
});

circle.addEventListener("pointermove", event => {
    if (pointerId !== event.pointerId || questionResolved || isPaused) {
        return;
    }

    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        dragging = true;
    }

    if (dragging) {
        circle.classList.add("dragging");

        circle.style.transform =
            "translate(" + dx + "px, " + dy + "px) rotate(" +
            (dx / 10) + "deg)";
    }
});

circle.addEventListener("pointerup", event => {
    if (pointerId !== event.pointerId) return;

    const differenceX = event.clientX - pointerStartX;
    const differenceY = event.clientY - pointerStartY;

    const distance = Math.sqrt(
        differenceX * differenceX +
        differenceY * differenceY
    );

    pointerId = null;
    circle.classList.remove("dragging");

    if (questionResolved || !gameActive || isPaused) return;

    if (distance < 25) {
        circle.style.transform = "translate(0, 0)";
        revealAnswer();
        return;
    }

    if (!answerOpened || distance < 55) {
        circle.style.transform = "translate(0, 0)";
        return;
    }

    let direction = "";

    if (Math.abs(differenceX) > Math.abs(differenceY)) {
        direction = differenceX > 0 ? "вправо" : "влево";
    } else {
        direction = differenceY > 0 ? "вниз" : "вверх";
    }

    awardPoint(direction);
});

circle.addEventListener("pointercancel", () => {
    pointerId = null;
    dragging = false;

    if (!questionResolved && !isPaused) {
        circle.classList.remove("dragging");
        circle.style.transform = "translate(0, 0)";
    }
});


// ==========================================
// НАЧИСЛЕНИЕ ОЧКА
// ==========================================

function awardPoint(direction) {
    if (!answerOpened || questionResolved || !gameActive || isPaused) {
        return;
    }

    let team = -1;

    if (teams.length === 2) {
        if (direction === "вверх") team = 0;
        if (direction === "вниз") team = 1;
    }

  if (teams.length === 3) {
        if (direction === "вверх") team = 0;
        if (direction === "влево") team = 1;
        if (direction === "вправо") team = 2;
    }

    if (teams.length === 4) {
        if (direction === "вверх") team = 0;
        if (direction === "влево") team = 1;
        if (direction === "вправо") team = 2;
        if (direction === "вниз") team = 3;
    }

    if (team === -1) {
        circle.style.transform = "translate(0, 0)";
        return;
    }

    questionResolved = true;
    stopTimer();

    scores[team]++;

    playSound("point-sound");

    const feedback = document.getElementById("round-feedback");
    feedback.textContent = teams[team] + " +1 ОЧКО!";
    feedback.className = "success";

    circle.classList.add("fly-" + directionToClass(direction));

    document.getElementById("pause-btn").style.display = "none";

    setTimeout(() => {
        if (!gameActive) return;

        currentQuestion++;
        renderQuestion();
    }, 650);
}

function directionToClass(direction) {
    if (direction === "влево") return "left";
    if (direction === "вправо") return "right";
    if (direction === "вверх") return "up";
    return "down";
}


// ==========================================
// РЕЗУЛЬТАТЫ И ПОБЕДИТЕЛЬ
// ==========================================

function finishGame() {
    gameActive = false;
    questionResolved = true;
    isPaused = false;

    stopTimer();
    stopMusic();

    renderScore();
    showScreen("score-screen");
}

function renderScore() {
    const container = document.getElementById("score-list");
    container.innerHTML = "";

    const winnerTitle = document.getElementById("winner-title");
    const winnerSubtitle = document.getElementById("winner-subtitle");

    const maxScore = Math.max(...scores);
    const winners = scores
        .map((score, index) => score === maxScore ? index : -1)
        .filter(index => index !== -1);

    if (winners.length === 1) {
        winnerTitle.textContent = "🏆 ПОБЕДИТЕЛЬ!";
        winnerSubtitle.textContent =
            "Побеждает команда «" + teams[winners[0]] + "»!";

        playSound("victory-sound");
    } else {
        winnerTitle.textContent = "🤝 НИЧЬЯ!";
        winnerSubtitle.textContent =
            "Сегодня победила дружба!";
    }

    teams.forEach((teamName, index) => {
        const item = document.createElement("div");

        item.textContent =
            teamName + ": " + scores[index] + " очков";

        if (winners.includes(index)) {
            item.className = "winner";
        }

        container.appendChild(item);
    });
}


// ==========================================
// КОМНАТА УПРАВЛЕНИЯ ВОПРОСАМИ
// ==========================================

document.getElementById("import-file-btn")
    .addEventListener("click", async () => {
        playSound("button-sound");

        const input = document.getElementById("question-file");
        const file = input.files[0];

        if (!file) {
            alert("Сначала выбери файл.");
            return;
        }

        try {
            const text = await file.text();

            let items;

            if (file.name.toLowerCase().endsWith(".json")) {
                items = parseJSON(text);
            } else {
                items = parseTXT(text);
            }

            const result = await importQuestions(
                items,
                file.name,
                "Файл"
            );

            showImportResult(result);
            input.value = "";

            await refreshQuestions();
            await renderBatches();
        } catch (error) {
            console.error(error);
            alert("Ошибка импорта: " + error.message);
        }
    });

document.getElementById("import-text-btn")
    .addEventListener("click", async () => {
        playSound("button-sound");

        const text = document.getElementById("question-text-input").value;

        if (!text.trim()) {
            alert("Сначала вставь вопросы.");
            return;
        }

        try {
            const items = parseTXT(text);

            const result = await importQuestions(
                items,
                "Вставленный текст",
                "Вставка"
            );

            showImportResult(result);

            document.getElementById("question-text-input").value = "";

            await refreshQuestions();
            await renderBatches();
        } catch (error) {
            console.error(error);
            alert("Ошибка импорта: " + error.message);
        }
    });

function showImportResult(result) {
    alert(
        "Импорт завершён!\n\n" +
        "Добавлено: " + result.imported + "\n" +
        "Дубликатов: " + result.duplicates + "\n" +
        "Некорректных: " + result.invalid
    );
}

async function renderBatches() {
    const container = document.getElementById("batches-list");
    container.innerHTML = "";

    try {
        await openDatabase();

        const batches = await getAllBatches();

        if (batches.length === 0) {
            container.textContent = "Пока нет загруженных наборов.";
            return;
        }

        batches.forEach(batch => {
            const item = document.createElement("div");
            item.className = "batch-item";

            const info = document.createElement("div");

            const name = document.createElement("strong");
            name.textContent = batch.name;

            const details = document.createElement("div");
            details.textContent =
                (batch.count || 0) + " вопросов";

            info.appendChild(name);
            info.appendChild(details);

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Удалить";

            deleteButton.addEventListener("click", async () => {
                if (!confirm(
                    "Удалить набор «" + batch.name +
                    "» вместе со всеми его вопросами?"
                )) {
                    return;
                }

                try {
                    await deleteBatch(batch.id);
                    await renderBatches();
                    await refreshQuestions();
                    alert("Набор удалён.");
                } catch (error) {
                    alert("Не удалось удалить набор.");
                    console.error(error);
                }
            });

            item.appendChild(info);
            item.appendChild(deleteButton);

            container.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        container.textContent = "Не удалось загрузить наборы.";
    }
}


// ==========================================
// ЭКСПОРТ БАЗЫ
// ==========================================

document.getElementById("export-database-btn")
    .addEventListener("click", async () => {
        playSound("button-sound");

        try {
            const json = await exportDatabase();

            const blob = new Blob(
                [json],
                { type: "application/json;charset=utf-8" }
            );

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = "quiz-backup.json";
            link.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert("Не удалось экспортировать базу.");
        }
    });


// ==========================================
// ВОЗВРАТ НА ГЛАВНУЮ
// ==========================================

document.getElementById("restart-btn").addEventListener("click", () => {
    stopTimer();
    stopMusic();

    teams = ["Команда 1", "Команда 2"];
    scores = [];
    questionCount = 5;
    gameQuestions = [];
    currentQuestion = 0;

    answerOpened = false;
    questionResolved = false;
    gameActive = false;
    isPaused = false;

    timeLeft = ROUND_TIME;

    document.getElementById("question-count").value = 5;

    renderTeams();
    showScreen("start-screen");
});


// ==========================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================

async function initializeGame() {
    loadSettings();
    setupAudioFiles();

    try {
        await openDatabase();
await addTestQuestion();
await refreshQuestions();
    } catch (error) {
        console.error("Ошибка запуска базы данных:", error);
        alert("Не удалось открыть базу данных вопросов.");
    }
}

initializeGame();
