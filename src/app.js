const express = require('express');
const http = require('http');
const socket = require('socket.io');
const BadWordsFilter = require('bad-words');

const { generateMessage, generateLocationMessage } = require('./utils/message');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom
} = require('./db/users');

const app = express();
const port = process.env.PORT || '4444';
const server = http.createServer(app);

const io = socket(server, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  socket.on('Join', ({ username, room }, callback) => {
    const { user, error } = addUser({ id: socket.id, username, room });

    if (error) {
      return callback({ id: null, error });
    }

    socket.join(user.room);
    socket.emit('Message', 'Welcome!');
    socket.broadcast.to(user.room).emit('Message', generateMessage('Admin', `${ user.username } has joined!`));

    io.to(user.room).emit('RoomData', {
      room: user.room,
      users: getUsersInRoom(room)
    });

    console.log('Info: ', user);

    callback({ id: user.id, error: null });
  });

  socket.on('Message', ({ id, message }, callback) => {
    const user = getUser(id);

    if (!user) {
      return callback({ success: false, error: 'User is invalid or not found!' });
    }

    const badWordsFilter = new BadWordsFilter();
    io.to(user.room).emit('Message', generateMessage(user.username, badWordsFilter.clean(message)));

    callback({ success: true, error: null });
  });

  socket.on('Disconnect', (id) => {
    const user = removeUser(id);

    if (user) {
      io.to(user.room).emit('Message', generateMessage('Admin', `${ user.username } has left!`));
      io.to(user.room).emit('RoomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });

  socket.on('Validate', (id, callback) => {
    const user = getUser(id);

    if (!user) {
      return callback({ isValid: false });
    }

    callback({ isValid: true, user });
  });
});

server.listen(port, () => {
  console.log(`Server is running at port ${ port }!`);
});
