let teams = ["Команда 1", "Команда 2"];
let scores = [];
let questionCount = 5;
let gameQuestions = [];
let currentQuestion = 0;
let answerOpened = false;

const ROUND_TIME = 20;
let timeLeft = ROUND_TIME;
let timerInterval = null;
let questionResolved = false;
let gameActive = false;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerId = null;
let dragging = false;

function showScreen() {
    const screenId = arguments[0];

    document.querySelectorAll(".screen").forEach(function(screen) {
        screen.classList.remove("active");
    });

    document.getElementById(screenId).classList.add("active");
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
    document.getElementById("timer-progress").classList.toggle("urgent", urgent);
}

function startTimer() {
    stopTimer();

    timeLeft = ROUND_TIME;
    updateTimerDisplay();

    timerInterval = setInterval(function() {
        if (!gameActive || questionResolved) {
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

// Начало

document.getElementById("start-btn").addEventListener("click", function() {
    renderTeams();
    showScreen("teams-screen");
});

// Команды

function renderTeams() {
    const container = document.getElementById("teams-list");
    container.innerHTML = "";

    teams.forEach(function(teamName, index) {
        const item = document.createElement("div");
        item.className = "team-item";

        const input = document.createElement("input");
        input.value = teamName;
        input.placeholder = "Название команды";

        input.addEventListener("input", function() {
            teams[index] = input.value;
        });

        item.appendChild(input);

        if (teams.length > 2) {
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Удалить";

            deleteButton.addEventListener("click", function() {
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

document.getElementById("add-team-btn").addEventListener("click", function() {
    if (teams.length < 4) {
        teams.push("Команда " + (teams.length + 1));
        renderTeams();
    }
});

document.getElementById("teams-next-btn").addEventListener("click", function() {
    renderTeams();
    showScreen("questions-screen");
});

// Количество вопросов

document.getElementById("questions-next-btn").addEventListener("click", function() {
    const count = Number(document.getElementById("question-count").value);

    if (!Number.isInteger(count) || count < 1) {
        alert("Введи правильное количество вопросов.");
        return;
    }

    if (count > questions.length) {
        alert("В базе пока только " + questions.length + " вопросов.");
        return;
    }

    questionCount = count;

    scores = teams.map(function() {
        return 0;
    });

    gameQuestions = questions.slice();

    for (let i = gameQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        const temporary = gameQuestions[i];
        gameQuestions[i] = gameQuestions[j];
        gameQuestions[j] = temporary;
    }

    gameQuestions = gameQuestions.slice(0, questionCount);

    currentQuestion = 0;
    answerOpened = false;
    gameActive = true;

    showScreen("game-screen");
    renderQuestion();
});

// Отображение вопроса

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

    const circle = document.getElementById("game-circle");

    circle.className = "";
    circle.style.transform = "translate(0, 0)";
    circle.style.opacity = "1";

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

// Открытие ответа

function revealAnswer() {
    if (answerOpened || questionResolved || !gameActive) {
        return;
    }

    answerOpened = true;

    document.getElementById("circle-text").textContent =
        gameQuestions[currentQuestion].answer;

    document.getElementById("game-hint").style.display = "none";
    document.getElementById("swipe-hint").style.display = "block";
}

// Пропуск вопроса по времени

function skipQuestion() {
    if (questionResolved || !gameActive) {
        return;
    }

    questionResolved = true;
    stopTimer();

    const feedback = document.getElementById("round-feedback");
    feedback.textContent = "ВРЕМЯ ВЫШЛО!";
    feedback.className = "timeout";

    document.getElementById("game-circle").style.opacity = "0";

    document.getElementById("game-hint").style.display = "none";
    document.getElementById("swipe-hint").style.display = "none";

    setTimeout(function() {
        if (!gameActive) return;

        currentQuestion++;
        renderQuestion();
    }, 700);
}

// Свайп

const circle = document.getElementById("game-circle");

circle.addEventListener("pointerdown", function(event) {
    if (!gameActive || questionResolved) return;

    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerId = event.pointerId;
    dragging = false;

    circle.setPointerCapture(event.pointerId);
});

circle.addEventListener("pointermove", function(event) {
    if (pointerId !== event.pointerId || questionResolved) return;

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

circle.addEventListener("pointerup", function(event) {
    if (pointerId !== event.pointerId) return;

    const differenceX = event.clientX - pointerStartX;
    const differenceY = event.clientY - pointerStartY;

    const distance = Math.sqrt(
        differenceX * differenceX +
        differenceY * differenceY
    );

    pointerId = null;
    circle.classList.remove("dragging");

    if (questionResolved || !gameActive) return;

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

circle.addEventListener("pointercancel", function() {
    pointerId = null;
    dragging = false;

    if (!questionResolved) {
        circle.classList.remove("dragging");
        circle.style.transform = "translate(0, 0)";
    }
});

// Начисление очка

function awardPoint(direction) {
    if (!answerOpened || questionResolved || !gameActive) {
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

    const feedback = document.getElementById("round-feedback");
    feedback.textContent = teams[team] + " +1 ОЧКО!";
    feedback.className = "success";

    circle.classList.add("fly-" + directionToClass(direction));

    setTimeout(function() {
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

// Результаты

function finishGame() {
    gameActive = false;
    questionResolved = true;
    stopTimer();

    renderScore();
    showScreen("score-screen");
}

function renderScore() {
    const container = document.getElementById("score-list");
    container.innerHTML = "";

    teams.forEach(function(teamName, index) {
        const item = document.createElement("div");

        item.textContent =
            teamName + ": " + scores[index] + " очков";

        container.appendChild(item);
    });
}

// Возврат на главную

document.getElementById("restart-btn").addEventListener("click", function() {
    stopTimer();

    teams = ["Команда 1", "Команда 2"];
    scores = [];
    questionCount = 5;
    gameQuestions = [];
    currentQuestion = 0;
    answerOpened = false;
    questionResolved = false;
    gameActive = false;

    document.getElementById("question-count").value = 5;

    renderTeams();
    showScreen("start-screen");
});