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
        const roomName = Object.keys(rooms).find(roomName => rooms[roomName].includes(socket.id));
        if (roomName) {
            const attacker = users[socket.id];
            const defenderSocketId = rooms[roomName].find(id => id !== socket.id);
            const defender = users[defenderSocketId];
            const move = attacker.userPokemon.moves.find(m => m.name === moveName);
            let isStab = false;
            let isSpecial = false;
            let isCritical = (Math.floor(Math.random() * 10)) === 0;
            let rollDamage = 0.85 + (Math.random() * (1.15 - 0.85));

            const effectiveness = {
                fire: {
                    grass: 'super',
                    water: 'notVery',
                    fire: 'notVery'
                },
                water: {
                    fire: 'super',
                    grass: 'notVery',
                    water: 'notVery'
                },
                grass: {
                    water: 'super',
                    fire: 'notVery',
                    grass: 'notVery'
                },
                flying: {
                    grass: 'super'
                }
            };

            function determineEffectiveness(moveType, defenderType) {
                if (effectiveness[moveType] && effectiveness[moveType][defenderType]) {
                    return effectiveness[moveType][defenderType];
                }
                return 'normal'; // Par défaut, l'efficacité est normale
            }

            let effectivenessResult = determineEffectiveness(move.type.name, defender.userPokemon.type);

            let isSuperEffective = effectivenessResult === 'super';
            let isNotVeryEffective = effectivenessResult === 'notVery';

            if (move.damage_class.name === 'special') {
                isSpecial = true;
            }
            if (move.type.name === attacker.userPokemon.type) {
                isStab = true;
            }

            const power =  Math.round(((42 * (isSpecial ? attacker.userPokemon.specialAttack : attacker.userPokemon.attack) * move.power) /
                ((isSpecial ? defender.userPokemon.specialDefense : defender.userPokemon.defense) * 50) + 2) *
                (isCritical ? 1.5 : 1) * rollDamage * (isStab ? 1.5 : 1) * (isSuperEffective ? 1.5 : (isNotVeryEffective ? 0.5 : 1)));
            defender.userPokemon.health -= power;

            let newHealth = defender.userPokemon.health;

            const result = `${isSuperEffective ? "It was super effective !" : (isNotVeryEffective ? "It was not very effective..." : "")} <b>${isCritical ? "It's a critical hit !" : ""}</b> <br/> ${defender.userPokemon.name} took <b>${power} damage.</b> <br/> ${defender.userPokemon.name}'s health is now at <b>${defender.userPokemon.health}</b> !`;

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
