const socket = io();

let currentRoomCode = "";
let myPlayerName = "";
let currentAnswerLength = 0;
let row = 0; let col = 0; let score = 0;
let isMyTurnActive = false;

function showScreen(screenId) {
  document.querySelectorAll('.fullscreen-container').forEach(el => el.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => showScreen("homeScreen"), 1500);
  initKeyboard();
});

// Menggunakan reload untuk memastikan bersihnya cache koneksi socket setelah game selesai/keluar
function goToHome() { window.location.reload(); }

// ==========================================
// MENTOR / HOST
// ==========================================
document.getElementById("btnHost").addEventListener("click", () => {
  let mentorID = document.getElementById("inputMentorID").value.trim().toLowerCase();
  if(!mentorID) return document.getElementById("hostError").innerText = "Isi Username Mentor!";
  socket.emit('createRoom', mentorID);
});

socket.on('roomCreated', (roomCode) => {
  currentRoomCode = roomCode;
  showScreen("mentorLobby");
  document.getElementById("generatedRoomCode").innerText = roomCode;
});

socket.on('updatePlayerList', (players) => {
  document.getElementById("playerCount").innerText = players.length;
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  players.forEach(p => {
    let span = document.createElement("span");
    span.className = "player-tag"; span.innerText = p; list.appendChild(span);
  });
  if (players.length > 0) document.getElementById("mentorOptions").classList.remove("hidden");
});

document.getElementById("btnStartPlay").addEventListener("click", () => {
  socket.emit('startGame', currentRoomCode);
});

socket.on('errorMsg', (msg) => {
  document.getElementById("mentorErrorMsg").innerText = msg;
});

function renderLiveLeaderboard(players) {
  players.sort((a,b) => b.score - a.score);
  const lb = document.getElementById("liveLeaderboard");
  lb.innerHTML = "";
  players.forEach((p, idx) => {
    let div = document.createElement("div"); div.className = "live-player";
    let status = p.answered ? "Sudah Menjawab" : "Berpikir...";
    div.innerHTML = `<span>Peringkat ${idx+1}: ${p.name} <strong>[${status}]</strong></span> <span>${p.score} Pts</span>`;
    lb.appendChild(div);
  });
}

socket.on('liveLeaderboardUpdate', (players) => {
  if (currentRoomCode && !myPlayerName) renderLiveLeaderboard(players);
});

// ==========================================
// SISWA / PLAYER
// ==========================================
document.getElementById("btnEnterRoom").addEventListener("click", () => {
  let roomCode = document.getElementById("inputRoomCode").value.toUpperCase().trim();
  let playerName = document.getElementById("inputPlayerName").value.toUpperCase().trim();
  
  if (!roomCode || playerName.length < 2) {
    document.getElementById("joinError").innerText = "Isi PIN dan Nickname!";
    return;
  }
  myPlayerName = playerName;
  socket.emit('joinRoom', { roomCode, playerName });
});

socket.on('joinSuccess', ({ roomCode, playerName }) => {
  currentRoomCode = roomCode; 
  showScreen("studentWaiting");
  document.getElementById("displayName").innerText = playerName;
  document.getElementById("gamePlayerName").innerText = playerName;
});

socket.on('joinError', (msg) => { alert(msg); goToHome(); });

// ==========================================
// GAMEPLAY ENGINE (TIMER & WORDLE)
// ==========================================
socket.on('nextQuestion', ({ questionText, length, index, total, playersData }) => {
  document.getElementById("message").innerText = ""; 
  
  if (currentRoomCode && !myPlayerName) {
    showScreen("mentorMonitorScreen");
    document.getElementById("monitorProgress").innerText = `${index}/${total}`;
    renderLiveLeaderboard(playersData);
    return;
  }

  showScreen("gameScreen");
  document.getElementById("question").innerText = questionText;
  currentAnswerLength = length;
  createBoard(length);
  isMyTurnActive = true;
});

socket.on('timerUpdate', (time) => {
  if (currentRoomCode && !myPlayerName) {
    document.getElementById("monitorTimer").innerText = time;
  } else if (myPlayerName) {
    document.getElementById("studentTimer").innerText = time;
  }
});

socket.on('questionTimeout', (correctAnswer) => {
    isMyTurnActive = false;
    let msgEl = document.getElementById("message");
    if(msgEl.innerText === "") showMessage(`WAKTU HABIS! JAWABAN: ${correctAnswer}`, "#e21b3c");
});

function createBoard(length) {
  const board = document.getElementById("board");
  board.innerHTML = ""; row = 0; col = 0;
  resetKeyboardColors();

  for (let i = 0; i < 3; i++) {
    let r = document.createElement("div"); r.className = "row";
    for (let j = 0; j < length; j++) {
      let box = document.createElement("div"); 
      box.className = "box"; 
      r.appendChild(box);
    }
    board.appendChild(r);
  }
}

document.addEventListener("keydown", (e) => {
  if (!isMyTurnActive) return;
  if (e.key === "Backspace") handleInput("DEL");
  else if (e.key === "Enter") handleInput("ENTER");
  else if (/^[a-zA-Z]$/.test(e.key)) handleInput(e.key.toUpperCase());
});

function handleInput(key) {
  let rows = document.getElementById("board").children;
  if (key === "DEL" && col > 0) {
    col--; rows[row].children[col].innerText = "";
  } else if (key === "ENTER") {
    checkGuess();
  } else if (key !== "DEL" && key !== "ENTER" && col < currentAnswerLength) {
    rows[row].children[col].innerText = key; col++;
  }
}

function checkGuess() {
  let rows = document.getElementById("board").children;
  let boxes = rows[row].children;
  let guess = "";
  for (let i = 0; i < boxes.length; i++) guess += boxes[i].innerText;

  if (guess.length !== currentAnswerLength) {
      // Menambahkan efek visual getar kecil jika jawaban belum lengkap (opsional)
      rows[row].classList.add("shake-row");
      setTimeout(() => rows[row].classList.remove("shake-row"), 300);
      return showMessage("Huruf belum lengkap!", "#e21b3c");
  }

  isMyTurnActive = false;
  socket.emit('submitGuess', { roomCode: currentRoomCode, guess });

  socket.once('guessResult', ({ result, isCorrect }) => {
    for (let i = 0; i < result.length; i++) {
      setTimeout(() => {
        boxes[i].classList.add("flip"); boxes[i].classList.add(result[i]);
        updateKeyboardColor(guess[i], result[i]);
      }, i * 150);
    }

    setTimeout(() => {
      if (isCorrect) {
        let kalkulasiPoin = (row === 0) ? 30 : (row === 1) ? 20 : 10;
        score += kalkulasiPoin;
        document.getElementById("score").innerText = score;
        showMessage("BENAR SEKALI!", "#26890c");
        socket.emit('updateScore', { roomCode: currentRoomCode, points: kalkulasiPoin });
      } else {
        row++; col = 0;
        if (row === 3) {
          showMessage("KESEMPATAN HABIS!", "#e21b3c");
          socket.emit('updateScore', { roomCode: currentRoomCode, points: 0 });
        } else {
          isMyTurnActive = true;
        }
      }
    }, result.length * 150);
  });
}

function showMessage(text, color) {
  let msg = document.getElementById("message");
  msg.innerText = text; msg.style.color = color;
}

// ==========================================
// PODIUM AKHIR
// ==========================================
socket.on('gameOver', (finalStandings) => {
  showScreen("leaderboardScreen");
  const flb = document.getElementById("finalLeaderboardList");
  flb.innerHTML = "";
  finalStandings.forEach((p, idx) => {
    let div = document.createElement("div"); div.className = "live-player";
    let rank = idx === 0 ? "Juara 1" : idx === 1 ? "Juara 2" : idx === 2 ? "Juara 3" : `Peringkat ${idx+1}`;
    div.innerHTML = `<span>${rank}: ${p.name}</span> <span>${p.score} Pts</span>`;
    flb.appendChild(div);
  });
});

// ==========================================
// KEYBOARD GENERATOR
// ==========================================
function initKeyboard() {
  const layout = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const container = document.getElementById("keyboard-container");
  container.innerHTML = "";
  layout.forEach((rowStr, idx) => {
    let rowDiv = document.createElement("div"); rowDiv.className = "key-row";
    if (idx === 2) {
      let enter = document.createElement("button"); enter.className = "key wide-key"; enter.innerText = "ENTER";
      enter.onclick = () => handleInput("ENTER"); rowDiv.appendChild(enter);
    }
    for (let char of rowStr) {
      let b = document.createElement("button"); b.className = "key"; b.id = "key-" + char; b.innerText = char;
      b.onclick = () => handleInput(char); rowDiv.appendChild(b);
    }
    if (idx === 2) {
      let del = document.createElement("button"); del.className = "key wide-key"; del.innerText = "DEL";
      del.onclick = () => handleInput("DEL"); rowDiv.appendChild(del);
    }
    container.appendChild(rowDiv);
  });
}

function updateKeyboardColor(letter, status) {
  let k = document.getElementById("key-" + letter); if (!k) return;
  if (k.classList.contains("correct")) return;
  if (status === "correct") k.className = "key correct";
  else if (status === "present" && !k.classList.contains("correct")) k.className = "key present";
  else if (status === "wrong" && !k.classList.contains("present")) k.className = "key wrong";
}

function resetKeyboardColors() {
  document.querySelectorAll(".key").forEach(k => {
    k.className = "key"; if(k.innerText === "ENTER" || k.innerText === "DEL") k.classList.add("wide-key");
  });
}