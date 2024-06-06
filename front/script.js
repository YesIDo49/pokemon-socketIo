let room = '';
let socketid = '';
const roomArea = document.querySelector('#room');
const userArea = document.querySelector('#userName');
const pokemonContainer = document.querySelector('#choice-pokemon')
const socket = io('http://localhost:3000');
let starters = ['charizard', 'venusaur', 'blastoise'];
let pokemons = [];
let username = null;
let maxUsers = 2;
let pokemonDisplayed = false;

socket.on('connect', () => {
    console.log('Connected');
});

socket.on('updateRooms', (rooms) => {
    const roomsSelect = document.getElementById('rooms');
    roomsSelect.innerHTML = '<option value="">Select a room</option>';
    for (let room in rooms) {
        const option = document.createElement('option');
        option.value = room;
        option.textContent = `${room} (${rooms[room].length}/2)`;
        roomsSelect.appendChild(option);
    }
});

socket.on('updateUsers', ({ room, users }) => {
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

socket.on('displaySelectedPokemon', (users) => {
    pokemonContainer.innerHTML = '<h2>Selected Pokémon</h2>';
    users.forEach(user => {
        if (user.userPokemon) {
            pokemonContainer.innerHTML +=
                `<div class="pokemon-select">
                    <div class="pokemon-card">
                        <img src="${user.userPokemon.sprite}" alt="${user.userPokemon.name} sprite">
                        <h4>${user.userPokemon.type} Type</h4>
                        <h2>${user.userPokemon.name}</h2>
                        <p>(${user.username})</p>
                    </div>
                </div>`;
        }
    });
});

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

function setUsername() {
    username = document.getElementById('username').value;
    if (!username) {
        alert('Please enter a username');
        return false;
    }
    return true;
}

function createRoom() {
    if (!setUsername()) return;

    const roomName = document.getElementById('roomName').value;
    if (roomName) {
        socket.emit('createRoom', { roomName, username });
    } else {
        alert('Please enter a room name');
    }
}

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

async function displayPokemon() {
    await getPokemon();

    pokemons.forEach((pokemon) => {
        pokemonContainer.innerHTML +=
            `
            <div class="pokemon-select">
                <div class="pokemon-card" onclick="choosePokemon(${pokemon.id})">
                    <img src="${pokemon.sprite}" alt="${pokemon.name} sprite">
                    <h4>${pokemon.type} Type</h4>
                    <h2>${pokemon.name}</h2>
                </div>
            </div>
            `
    })
}

function choosePokemon(pokemonId) {
    const pokemon = pokemons.find(p => p.id === pokemonId);
    socket.emit('updateUser', { username, userPokemon: pokemon });
    displayMoves(pokemon);
}

function displayMoves(pokemon) {
    let moves = pokemon.moves;
    moves.forEach((move) => {
        document.getElementById('moves').innerHTML +=
            `<li class="move-card" onclick="">
                <h4>${move.name}</h4>
                <p>type : ${move.type.name}</p>
                <p>classe : ${move.damage_class.name}</p>
            </li>`
    });
}

async function getPokemon() {
    for (const starter of starters) {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${starter}`);
        const pokemon = await response.json();
        let index = starters.indexOf(starter);

        let pokemonData = {};
        pokemonData.id = index + 1;
        pokemonData.name = pokemon.name;
        pokemonData.type = pokemon.types[0].type.name;
        pokemonData.sprite = pokemon.sprites.front_default;

        let moves = [];
        let pokemonMoves = []

        switch (starter) {
            case 'charizard':
                moves = ['flamethrower', 'air-slash', 'dragon-pulse', 'slash'];
                break;
            case 'venusaur':
                moves = ['energy-ball', 'sludge-bomb', 'body-slam', 'tera-blast'];
                break
            case 'blastoise':
                moves = ['hydro-pump', 'flash-cannon', 'aura-sphere', 'facade'];
                break;
        }

        for (const move of moves) {
            try {
                const response = await fetch(`https://pokeapi.co/api/v2/move/${move}`)
                const pokemonMove = await response.json()
                pokemonMoves.push(pokemonMove)
                pokemonData.moves = pokemonMoves;
            } catch (error) {
                console.error('Error fetching move:', move, error);
            }
        }

        pokemons.push(pokemonData);
    }
}

socket.on('disconnect', () => {
    pokemonDisplayed = false;
});
