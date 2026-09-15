const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { saveMessage, getMessages, createUser } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '..', 'client', 'index.html')); });

app.get('/api/messages', (req, res) => {
  try { res.json(getMessages(50, 'general')); } 
  catch (error) { res.status(500).json({ error: 'Mesajlar alınamadı.' }); }
});

const activeUsers = new Set();

io.on('connection', (socket) => {
  socket.on('join', (username) => {
    try {
      const cleanUsername = String(username || '').trim();
      if (!cleanUsername) return;
      const lowerCaseName = cleanUsername.toLowerCase();

      if (activeUsers.has(lowerCaseName)) {
        socket.emit('login_error', 'Bu kullanıcı adı şu an aktif! Lütfen başka bir isim seç.');
        return;
      }

      socket.username = cleanUsername;
      activeUsers.add(lowerCaseName); 
      createUser(cleanUsername); 
      
      socket.emit('login_success');
      io.emit('active_users', Array.from(activeUsers));
      
    } catch (error) { console.error('Giriş hatası:', error); }
  });

  socket.on('chat message', (data) => {
    try {
      if (!socket.username) {
        socket.emit('message_error', 'Önce giriş yapmalısınız.');
        return;
      }

      const username = socket.username;
      const content = String(data.content || '').trim();
      const room = 'general';

      if (!content) return; 
      if (content.length > 500) { 
        socket.emit('message_error', 'Mesajınız çok uzun (Maksimum 500 karakter).'); 
        return; 
      }

      const messageId = saveMessage(username, content, room);
      
      io.emit('chat message', { 
        id: messageId, 
        username, 
        content, 
        room, 
        created_at: new Date().toISOString() 
      });
    } catch (error) { 
      console.error('Mesaj kaydedilirken hata:', error);
      socket.emit('message_error', 'Mesaj gönderilemedi.');
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      activeUsers.delete(socket.username.toLowerCase());
      io.emit('active_users', Array.from(activeUsers));
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => { console.log(`Sauran sunucusu çalışıyor → http://localhost:${PORT}`); });