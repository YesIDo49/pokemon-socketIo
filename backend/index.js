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

let roomMessages = {};
const rooms = {};
let maxUsers = 2;

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.emit('updateRooms', rooms);

    socket.on('createRoom', (roomName) => {
        if (rooms[roomName]) {
            socket.emit('roomExists');
        } else {
            rooms[roomName] = [socket.id];
            socket.join(roomName);
            socket.emit('roomCreated', roomName);
            io.emit('updateRooms', rooms);
        }
    });

    socket.on('joinRoom', (roomName) => {
        let currentRoom = null;
        for (let room in rooms) {
            if (rooms[room].includes(socket.id)) {
                currentRoom = room;
                break;
            }
        }

        if (currentRoom) {
            rooms[currentRoom] = rooms[currentRoom].filter(id => id !== socket.id);
            socket.leave(currentRoom);
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
            }
        }

        const room = rooms[roomName];
        if (room && room.length < maxUsers) {
            room.push(socket.id);
            socket.join(roomName);
            socket.emit('joinedRoom', roomName);
            io.to(roomName).emit('userJoined', socket.id);
        } else if (!room) {
            rooms[roomName] = [socket.id];
            socket.join(roomName);
            socket.emit('joinedRoom', roomName);
        } else {
            socket.emit('roomFull');
        }
        io.emit('updateRooms', rooms);
    });

    socket.on('disconnect', () => {
        for (let roomName in rooms) {
            const room = rooms[roomName];
            const index = room.indexOf(socket.id);
            if (index !== -1) {
                room.splice(index, 1);
                if (room.length === 0) {
                    delete rooms[roomName];
                }
                io.emit('updateRooms', rooms);
                break;
            }
        }
        console.log('A user disconnected');
    });
});

server.listen(PORT, () => {
    console.log('Server ip : http://' + ip.address() + ':' + PORT);
});
