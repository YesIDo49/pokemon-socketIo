let room = '';
let socketid = '';
const roomArea = document.querySelector('#room');
const userArea = document.querySelector('#userName');
const pokemonContainer = document.querySelector('#choice-pokemon');
const battleContainer = document.querySelector('#pokemon-battle');
const pokemonScreen = document.querySelector('.pokemon-screen');
const movesContainer = document.getElementById('moves');
const battleLogContainer = document.getElementById('battle-log');
const turnLogContainer = document.getElementById('turn-log');
const socket = io('http://localhost:3000');
let starters = ['charizard', 'venusaur', 'blastoise'];
let pokemons = [];
let username = null;
const maxUsers = 2;
let pokemonDisplayed = false;
let myTurn = false;
let winner = false;

// Connection socket
socket.on('connect', () => {
    console.log('Connected');
});

// Update rooms available
socket.on('updateRooms', (rooms) => {
    const roomsSelect = document.getElementById('rooms');
    roomsSelect.innerHTML = '<option value="">Select a room</option>';
    for (let room in rooms) {
        const option = document.createElement('option');
        option.value = room;
        option.textContent = `${room} (${rooms[room].length}/${maxUsers})`;
        roomsSelect.appendChild(option);
    }
});

// Update users in room
socket.on('updateUsers', ({ room, users, winner }) => {
    const usersInRoom = document.getElementById('usersInRoom');
    usersInRoom.innerHTML = `<h2>Users in Room: ${room}</h2>`;
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.username + (user.userPokemon ? ` - ${user.userPokemon.name}` : '');
        usersInRoom.appendChild(li);
    });

    if (users.length === maxUsers && !pokemonDisplayed) {
        displayPokemon();
        pokemonDisplayed = true;
    }
});

// Show selected Pokémon
socket.on('displaySelectedPokemon', (users) => {
    document.querySelector('.pokemon-container').classList.add('battle');
    const currentUser = users.find(user => user.socketId === socket.id);
    const sortedUsers = [currentUser, ...users.filter(user => user.socketId !== socket.id)];

    pokemonContainer.classList.add('is-hidden');
    battleContainer.classList.remove('is-hidden');

    pokemonScreen.innerHTML = '';

    sortedUsers.forEach(user => {
        if (user.userPokemon) {
            pokemonScreen.innerHTML +=
                `<div class="pokemon-card is-selected">
                    <div class="pokemon-image">
                        <img src="${user.userPokemon.sprite}" alt="${user.userPokemon.name} sprite">
                    </div>
                    <div class="pokemon-info">
                        <h2>${user.userPokemon.name}</h2>
                        <p>${user.userPokemon.health} HP</p>
                    </div>
                </div>`;
        }
    });
});

// Show winner
socket.on('winner', (data) => {
    winner = true;
    turnLogContainer.innerHTML = ``;
    movesContainer.style.visibility = 'hidden';
    displayBattleLog(`${data.winner} is the winner!`);
    document.getElementById('restartButton').classList.remove('is-hidden');
});

// Restart game
function restartGame() {
    pokemonDisplayed = true;
    winner = false;
    socket.emit('restartGame');
    document.getElementById('restartButton').classList.add('is-hidden');
    displayTurnLog('Waiting for the other player to vote for restart...');
}

socket.on('gameRestarted', () => {
    battleLogContainer.innerHTML = '';
    turnLogContainer.innerHTML = '';
    pokemonContainer.innerHTML = '';
    pokemonContainer.classList.remove('is-hidden');
    battleContainer.classList.add('is-hidden');
    movesContainer.style.visibility = 'hidden';
    document.getElementById('restartButton').classList.add('is-hidden');
    pokemonDisplayed = false;
    pokemons = [];
});

// All alerts notifications
socket.on('roomCreated', (roomName) => {
    alert(`Room ${roomName} created successfully`);
});

socket.on('roomExists', () => {
    alert('Room already exists');
});

socket.on('joinedRoom', (roomName) => {
    alert(`Joined room ${roomName}`);
});

socket.on('roomFull', () => {
    alert('Room is full');
});

// Start turn
socket.on('startTurn', (data) => {
    myTurn = data.turn === socket.id;
    if (myTurn && !winner) {
        movesContainer.style.visibility = 'visible';
        displayTurnLog('It is your turn to choose an attack!');
    } else {
        movesContainer.style.visibility = 'hidden';
        displayTurnLog('Waiting for the other player to choose an attack...');
    }
});

// Damage of the attack
socket.on('attackResult', (data) => {
    const { attacker, defender, move, result, newHealth } = data;
    defender.userPokemon.health = newHealth;
    displayBattleLog(`${attacker.username}'s ${attacker.userPokemon.name} used <b>${move.name}</b> on ${defender.username}'s ${defender.userPokemon.name}. ${result}`);
});

// Add name to user
function setUsername() {
    username = document.getElementById('username').value;
    if (!username) {
        alert('Please enter a username');
        return false;
    }
    return true;
}

// Create room
function createRoom() {
    if (!setUsername()) return;

    const roomName = document.getElementById('roomName').value;
    if (roomName) {
        socket.emit('createRoom', { roomName, username });
    } else {
        alert('Please enter a room name');
    }
}

// Join room
function joinRoom() {
    if (!setUsername()) return;

    const roomsSelect = document.getElementById('rooms');
    const roomName = roomsSelect.value;
    if (roomName) {
        socket.emit('joinRoom', { roomName, username });
    } else {
        alert('Please select a room');
    }
}

// Show all pokemons
async function displayPokemon() {
    pokemonContainer.innerHTML = '<img class="background" src="assets/starter.jpeg" alt="">';
    document.querySelector('.join-battle').classList.add('is-hidden');
    document.querySelector('.pokemon-container').classList.remove('is-hidden');

    await getPokemon();

    pokemons.forEach((pokemon) => {
        pokemonContainer.innerHTML +=
            `<div class="pokemon-card" onclick="choosePokemon(${pokemon.id})">
                <img src="${pokemon.sprite}" alt="${pokemon.name} sprite">
                <div class="pokemon-title">
                    <img src="assets/type_pokemon_${pokemon.type}.png" alt="${pokemon.type} icon">
                    <h2>${pokemon.name}</h2>
                </div>
            </div>`;
    });
}

// Choose pokemon
function choosePokemon(pokemonId) {
    const pokemon = pokemons.find(p => p.id === pokemonId);
    socket.emit('updateUser', { username, userPokemon: pokemon });
    displayMoves(pokemon);
}

// Show pokemon moves
function displayMoves(pokemon) {
    movesContainer.innerHTML = '';
    pokemon.moves.forEach((move) => {
        movesContainer.innerHTML +=
            `<li class="move-card" onclick="chooseMove('${move.name}')">
                <h4>${move.name}</h4>
                <div class="move-type">
                    <img src="assets/type_pokemon_${move.type.name}.png" alt="${move.type.name} icon">
                    <img src="assets/move-${move.damage_class.name}.png" alt="${move.damage_class.name} icon">
                </div>
            </li>`;
    });
}

// Choose move
function chooseMove(moveName) {
    if (!myTurn) {
        alert('It is not your turn yet!');
        return;
    }
    socket.emit('attack', { moveName });
    myTurn = false;
}

// Get all 3 pokemons from PokeAPI
async function getPokemon() {
    for (const starter of starters) {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${starter}`);
        const pokemon = await response.json();
        let index = starters.indexOf(starter);

        let pokemonData = {
            id: index + 1,
            name: pokemon.name,
            type: pokemon.types[0].type.name,
            sprite: pokemon.sprites.front_default,
            health: pokemon.stats[0].base_stat * 5,
            attack: pokemon.stats[1].base_stat,
            defense: pokemon.stats[2].base_stat,
            specialAttack: pokemon.stats[3].base_stat,
            specialDefense: pokemon.stats[4].base_stat,
            moves: []
        };

        const moveNames = {
            charizard: ['flamethrower', 'air-slash', 'dragon-pulse', 'slash'],
            venusaur: ['energy-ball', 'sludge-bomb', 'body-slam', 'tera-blast'],
            blastoise: ['hydro-pump', 'flash-cannon', 'aura-sphere', 'facade']
        }[starter];

        for (const move of moveNames) {
            try {
                const moveResponse = await fetch(`https://pokeapi.co/api/v2/move/${move}`);
                const pokemonMove = await moveResponse.json();
                pokemonData.moves.push(pokemonMove);
            } catch (error) {
                console.error('Error fetching move:', move, error);
            }
        }

        pokemons.push(pokemonData);
    }
}

// Show battle messages
function displayBattleLog(message) {
    battleLogContainer.innerHTML = `<p>${message}</p>`;
}

// Show turn messages
function displayTurnLog(message) {
    turnLogContainer.innerHTML = `<p>${message}</p>`;
}

socket.on('disconnect', () => {
    pokemonDisplayed = false;
});
