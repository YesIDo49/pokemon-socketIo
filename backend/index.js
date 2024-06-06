import express from 'express';
import http from 'http';
import ip from 'ip';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

app.use(cors());
app.get('/', (req, res) => {
    res.json('ip address: http://' + ip.address() + ':' + PORT);
});

const rooms = {};
const users = {};
let maxUsers = 2;

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.emit('updateRooms', rooms);

    function leaveCurrentRoom(socket) {
        for (let roomName in rooms) {
            const room = rooms[roomName];
            const index = room.indexOf(socket.id);
            if (index !== -1) {
                room.splice(index, 1);
                socket.leave(roomName);
                if (room.length === 0) {
                    delete rooms[roomName];
                } else {
                    io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName) });
                }
                break;
            }
        }
    }

    socket.on('createRoom', ({ roomName, username }) => {
        leaveCurrentRoom(socket);

        if (rooms[roomName]) {
            socket.emit('roomExists');
        } else {
            users[socket.id] = { username, userPokemon: null };
            rooms[roomName] = [socket.id];
            socket.join(roomName);
            socket.emit('roomCreated', roomName);
            io.emit('updateRooms', rooms);
            io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName) });
        }
    });

    socket.on('joinRoom', ({ roomName, username }) => {
        leaveCurrentRoom(socket);

        const room = rooms[roomName];
        if (room && room.length < 2) {
            users[socket.id] = { username, userPokemon: null };
            room.push(socket.id);
            socket.join(roomName);
            socket.emit('joinedRoom', roomName);
            io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName) });
        } else if (!room) {
            users[socket.id] = { username, userPokemon: null };
            rooms[roomName] = [socket.id];
            socket.join(roomName);
            socket.emit('joinedRoom', roomName);
            io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName) });
        } else {
            socket.emit('roomFull');
        }
        io.emit('updateRooms', rooms);
    });

    socket.on('updateUser', ({ username, userPokemon }) => {
        if (users[socket.id]) {
            users[socket.id].userPokemon = userPokemon;
            const roomName = Object.keys(rooms).find(roomName => rooms[roomName].includes(socket.id));
            if (roomName) {
                io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName) });
            }
        }
    });

    socket.on('disconnect', () => {
        leaveCurrentRoom(socket);
        delete users[socket.id];
        console.log('A user disconnected');
    });

    function getRoomUsers(roomName) {
        return rooms[roomName].map(id => users[id]);
    }
});server.listen(PORT, () => {
    console.log('Server ip : http://' + ip.address() + ':' + PORT);
});
