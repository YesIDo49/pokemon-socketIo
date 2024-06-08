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
let turns = {};
let winner = false;

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
                    io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName), winner : true });
                    console.log(users)
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
            users[socket.id] = { socketId: socket.id, username, userPokemon: null };
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
        if (room && room.length < maxUsers) {
            users[socket.id] = { socketId: socket.id, username, userPokemon: null };
            room.push(socket.id);
            socket.join(roomName);
            socket.emit('joinedRoom', roomName);
            io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName) });
        } else if (!room) {
            users[socket.id] = { socketId: socket.id, username, userPokemon: null };
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

                const roomUsers = getRoomUsers(roomName);
                const allSelected = roomUsers.every(user => user.userPokemon !== null);
                if (allSelected) {
                    io.to(roomName).emit('displaySelectedPokemon', roomUsers);
                    startGame(roomName);
                }
            }
        }
    });

    socket.on('attack', ({ moveName }) => {
        const roomName = Object.keys(rooms).find(roomName => rooms[roomName].includes(socket.id));
        if (roomName) {
            const attacker = users[socket.id];
            const defenderSocketId = rooms[roomName].find(id => id !== socket.id);
            const defender = users[defenderSocketId];
            const move = attacker.userPokemon.moves.find(m => m.name === moveName);

            const power = 1
            defender.userPokemon.health -= power;
            let newHealth = defender.userPokemon.health;

            const result = `It was super effective! ${defender.userPokemon.name} took ${power} damage. ${defender.userPokemon.name}'s health is now ${defender.userPokemon.health}!`;

            io.to(roomName).emit('attackResult', { attacker, defender, move, result, newHealth });

            const nextTurn = turns[roomName] === socket.id ? defenderSocketId : socket.id;
            turns[roomName] = nextTurn;
            io.to(roomName).emit('startTurn', { turn: nextTurn });
            io.to(roomName).emit('displaySelectedPokemon', [attacker, defender]);
        }
    });

    socket.on('disconnect', () => {
        const roomName = Object.keys(rooms).find(roomName => rooms[roomName].includes(socket.id));
        if (roomName) {
            const room = rooms[roomName];
            if (room.length === 1) {
                const remainingUser = users[room[0]];
                io.to(roomName).emit('winner', { winner: remainingUser.username });
            }
        }
        leaveCurrentRoom(socket);
        delete users[socket.id];
        io.emit('updateRooms', rooms);

        console.log('A user disconnected');
    });

    function getRoomUsers(roomName) {
        return rooms[roomName].map(id => users[id]);
    }

    function startGame(roomName) {
        const room = rooms[roomName];
        const firstTurn = room[Math.floor(Math.random() * room.length)];
        turns[roomName] = firstTurn;
        io.to(roomName).emit('startTurn', { turn: firstTurn });
    }
});

server.listen(PORT, () => {
    console.log('Server ip : http://' + ip.address() + ':' + PORT);
});
