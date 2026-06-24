const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DATABASE MENTOR (Penyimpanan berdasarkan Username)
let mentorDatabases = {
  "admin": [
    { q: "Kerajaan Hindu tertua di Nusantara?", a: "KUTAI" },
    { q: "Sumpah yang diikrarkan oleh Mahapatih Gajah Mada?", a: "PALAPA" }
  ]
};

let activeRooms = {}; 

// API MENTOR: Ambil Soal
app.get('/api/questions/:username', (req, res) => {
  const user = req.params.username;
  res.json(mentorDatabases[user] || []);
});

// API MENTOR: Tambah 1 Soal Manual
app.post('/api/questions/:username', (req, res) => {
  const user = req.params.username;
  const { q, a } = req.body;
  if (!mentorDatabases[user]) mentorDatabases[user] = [];
  
  if (q && a) {
    mentorDatabases[user].push({ q, a: a.toUpperCase().replace(/[^A-Z]/g, "") });
    return res.json({ success: true });
  }
  res.status(400).json({ error: "Data tidak valid" });
});

// API MENTOR: Bulk Upload via TXT
app.post('/api/questions/bulk/:username', (req, res) => {
  const user = req.params.username;
  const { questions } = req.body;
  if (!mentorDatabases[user]) mentorDatabases[user] = [];
  
  if (Array.isArray(questions) && questions.length > 0) {
    questions.forEach(item => {
      if(item.q && item.a) {
        mentorDatabases[user].push({ 
          q: item.q, 
          a: item.a.toUpperCase().replace(/[^A-Z]/g, "") 
        });
      }
    });
    return res.json({ success: true });
  }
  res.status(400).json({ error: "Data tidak valid" });
});

// API MENTOR: Hapus Soal
app.delete('/api/questions/:username/:index', (req, res) => {
  const user = req.params.username;
  const index = parseInt(req.params.index);
  if (mentorDatabases[user] && index >= 0 && index < mentorDatabases[user].length) {
    mentorDatabases[user].splice(index, 1);
    return res.json({ success: true });
  }
  res.status(400).json({ error: "Gagal menghapus" });
});

// SOCKET IO ENGINE
io.on('connection', (socket) => {
  
  socket.on('createRoom', (mentorUsername) => {
    let roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    if (!mentorDatabases[mentorUsername]) mentorDatabases[mentorUsername] = [];

    activeRooms[roomCode] = {
      hostId: socket.id,
      mentorName: mentorUsername,
      players: {},
      gameStarted: false,
      questions: [],
      currentQuestionIndex: 0,
      timer: 0,
      intervalId: null
    };
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = activeRooms[roomCode];
    if (!room) return socket.emit('joinError', "Game PIN tidak ditemukan!");
    if (room.gameStarted) return socket.emit('joinError', "Game sudah dimulai!");
    
    room.players[socket.id] = { name: playerName, score: 0, answered: false };
    socket.join(roomCode);
    
    socket.emit('joinSuccess', { roomCode, playerName });
    io.to(room.hostId).emit('updatePlayerList', Object.values(room.players).map(p => p.name));
  });

  socket.on('startGame', (roomCode) => {
    const room = activeRooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.gameStarted = true;
      let myQuestions = mentorDatabases[room.mentorName] || [];
      // Acak soal dan ambil maksimal 5
      room.questions = [...myQuestions].sort(() => Math.random() - 0.5).slice(0, 5);
      room.currentQuestionIndex = 0;

      if (room.questions.length === 0) return socket.emit('errorMsg', "Bank soal kosong! Isi di panel Admin.");
      sendQuestion(roomCode);
    }
  });

  function sendQuestion(roomCode) {
    const room = activeRooms[roomCode];
    if (!room) return;
    const currentQ = room.questions[room.currentQuestionIndex];
    room.timer = 30;
    
    Object.keys(room.players).forEach(id => room.players[id].answered = false);

    io.to(roomCode).emit('nextQuestion', {
      questionText: currentQ.q,
      length: currentQ.a.length,
      index: room.currentQuestionIndex + 1,
      total: room.questions.length,
      playersData: Object.values(room.players)
    });

    clearInterval(room.intervalId);
    room.intervalId = setInterval(() => {
      room.timer--;
      io.to(roomCode).emit('timerUpdate', room.timer);

      let playersArray = Object.values(room.players);
      let allAnswered = playersArray.length > 0 && playersArray.every(p => p.answered);

      if (room.timer <= 0 || allAnswered) {
        clearInterval(room.intervalId);
        io.to(roomCode).emit('questionTimeout', currentQ.a);
        
        setTimeout(() => {
          room.currentQuestionIndex++;
          if (room.currentQuestionIndex < room.questions.length) {
            sendQuestion(roomCode);
          } else {
            let finalStandings = Object.values(room.players).sort((a,b) => b.score - a.score);
            io.to(roomCode).emit('gameOver', finalStandings);
            delete activeRooms[roomCode];
          }
        }, 4000);
      }
    }, 1000);
  }

  socket.on('submitGuess', ({ roomCode, guess }) => {
    const room = activeRooms[roomCode];
    if (!room) return;
    const currentQ = room.questions[room.currentQuestionIndex];
    const player = room.players[socket.id];
    
    if (!player || player.answered) return;

    let answer = currentQ.a;
    let result = [];
    
    for (let i = 0; i < answer.length; i++) {
      if (guess[i] === answer[i]) result.push("correct");
      else if (answer.includes(guess[i])) result.push("present");
      else result.push("wrong");
    }

    let isCorrect = (guess === answer);
    socket.emit('guessResult', { result, isCorrect });
  });

  socket.on('updateScore', ({ roomCode, points }) => {
    const room = activeRooms[roomCode];
    if (room && room.players[socket.id]) {
      room.players[socket.id].score += points;
      room.players[socket.id].answered = true;
      io.to(room.hostId).emit('liveLeaderboardUpdate', Object.values(room.players));
    }
  });

  socket.on('disconnect', () => {
    for (let code in activeRooms) {
      if (activeRooms[code].hostId === socket.id) {
        clearInterval(activeRooms[code].intervalId);
        io.to(code).emit('joinError', "Host telah meninggalkan permainan.");
        delete activeRooms[code];
      } else if (activeRooms[code].players[socket.id]) {
        delete activeRooms[code].players[socket.id];
        io.to(activeRooms[code].hostId).emit('updatePlayerList', Object.values(activeRooms[code].players).map(p => p.name));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));