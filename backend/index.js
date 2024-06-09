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
const maxUsers = 2;
const turns = {};
const restartVotes = {};

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.emit('updateRooms', rooms);

    socket.on('createRoom', ({ roomName, username }) => {
        leaveCurrentRoom(socket);
        if (rooms[roomName]) {
            socket.emit('roomExists');
        } else {
            addUserToRoom(socket, roomName, username);
            socket.emit('roomCreated', roomName);
            io.emit('updateRooms', rooms);
            io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName) });
        }
    });

    socket.on('joinRoom', ({ roomName, username }) => {
        leaveCurrentRoom(socket);
        const room = rooms[roomName];
        if (room && room.length < maxUsers) {
            addUserToRoom(socket, roomName, username);
            socket.emit('joinedRoom', roomName);
            io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName) });
        } else if (!room) {
            addUserToRoom(socket, roomName, username);
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
            const roomName = getUserRoom(socket.id);
            if (roomName) {
                io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName), winner: false });

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
        const roomName = getUserRoom(socket.id);
        if (roomName) {
            handleAttack(socket, roomName, moveName);
        }
    });

    socket.on('restartGame', () => {
        const roomName = getUserRoom(socket.id);
        if (roomName) {
            handleRestartGame(roomName, socket.id);
        }
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
        console.log('A user disconnected');
    });
});

server.listen(PORT, () => {
    console.log('Server ip : http://' + ip.address() + ':' + PORT);
});

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
                io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName), winner: true });
            }
            break;
        }
    }
}

function addUserToRoom(socket, roomName, username) {
    users[socket.id] = { socketId: socket.id, username, userPokemon: null };
    if (!rooms[roomName]) {
        rooms[roomName] = [];
    }
    rooms[roomName].push(socket.id);
    socket.join(roomName);
}

function getRoomUsers(roomName) {
    return rooms[roomName].map(id => users[id]);
}

function getUserRoom(socketId) {
    return Object.keys(rooms).find(roomName => rooms[roomName].includes(socketId));
}

function startGame(roomName) {
    const room = rooms[roomName];
    const firstTurn = room[Math.floor(Math.random() * room.length)];
    turns[roomName] = firstTurn;
    io.to(roomName).emit('startTurn', { turn: firstTurn });
}

function handleAttack(socket, roomName, moveName) {
    const attacker = users[socket.id];
    const defenderSocketId = rooms[roomName].find(id => id !== socket.id);
    const defender = users[defenderSocketId];
    const move = attacker.userPokemon.moves.find(m => m.name === moveName);

    let power = calculateDamage(attacker, defender, move);
    defender.userPokemon.health -= power;
    let newHealth = defender.userPokemon.health;

    const result = getAttackResult(attacker, defender, move, power);
    io.to(roomName).emit('attackResult', { attacker, defender, move, result, newHealth });

    if (newHealth <= 0) {
        defender.userPokemon.health = 0;
        io.to(roomName).emit('winner', { winner: attacker.username });
        io.to(roomName).emit('displayBattleLog', `${attacker.username} is the winner!`);
    }

    const nextTurn = turns[roomName] === socket.id ? defenderSocketId : socket.id;
    turns[roomName] = nextTurn;
    io.to(roomName).emit('startTurn', { turn: nextTurn });
    io.to(roomName).emit('displaySelectedPokemon', [attacker, defender]);
}

function calculateDamage(attacker, defender, move) {
    const isSpecial = move.damage_class.name === 'special';
    const isStab = move.type.name === attacker.userPokemon.type;
    const isCritical = Math.random() < 0.1;
    const effectiveness = determineEffectiveness(move.type.name, defender.userPokemon.type);
    const rollDamage = 0.85 + Math.random() * 0.3;

    return Math.round(((42 * (isSpecial ? attacker.userPokemon.specialAttack : attacker.userPokemon.attack) * move.power) /
            ((isSpecial ? defender.userPokemon.specialDefense : defender.userPokemon.defense) * 50) + 2) *
        (isCritical ? 1.5 : 1) * rollDamage * (isStab ? 1.5 : 1) * effectiveness);
}

function determineEffectiveness(moveType, defenderType) {
    const effectiveness = {
        fire: { grass: 1.25, water: 0.75, fire: 0.75 },
        water: { fire: 1.25, grass: 0.75, water: 0.75 },
        grass: { water: 1.25, fire: 0.75, grass: 0.75 },
        flying: { grass: 1.25 }
    };
    return effectiveness[moveType]?.[defenderType] || 1;
}

function getAttackResult(attacker, defender, move, power) {
    const effectiveness = determineEffectiveness(move.type.name, defender.userPokemon.type);
    const isCritical = Math.random() < 0.1;
    return `${effectiveness > 1 ? "<b>It was super effective!</b>" : (effectiveness < 1 ? "<b>It was not very effective...</b>" : "")} 
            ${isCritical ? "<b>It's a critical hit!</b>" : ""} ${defender.userPokemon.name} took <b>${power} damage.</b> 
            ${defender.userPokemon.name}'s health is now at <b>${defender.userPokemon.health}</b>!`;

}

function handleRestartGame(roomName, socketId) {
    if (!restartVotes[roomName]) {
        restartVotes[roomName] = new Set();
    }
    restartVotes[roomName].add(socketId);

    if (restartVotes[roomName].size === rooms[roomName].length) {
        rooms[roomName].forEach(socketId => {
            users[socketId].userPokemon = null;
        });
        turns[roomName] = null;
        io.to(roomName).emit('gameRestarted');
        io.to(roomName).emit('updateUsers', { room: roomName, users: getRoomUsers(roomName), winner: false });
        restartVotes[roomName].clear();
    }
}

function handleDisconnect(socket) {
    const roomName = getUserRoom(socket.id);
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
}
