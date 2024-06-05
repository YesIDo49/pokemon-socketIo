let room = '';
let socketid = '';
const roomArea = document.querySelector('#room');
const messageArea = document.querySelector('#message');
const userArea = document.querySelector('#user');
// const chatContainer = document.querySelector('.chat');
const pokemonContainer = document.querySelector('#choice-pokemon')
const socket = io('http://localhost:3000');
let messages = {};
let starters = ['charizard', 'venusaur', 'blastoise'];
let pokemons = [];

socket.on('connect', () => {
    console.log('Connected');
});

socket.on('message', (data) => {
    console.log('data : ' + data);
    console.log('messages : ' + messages);
    document.querySelector('.data').innerText = data;


    messages[room] = messages[room] || [];
    messages[room].push(data);

    console.log(messages);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

let send = () => {

    displayPokemon();

    socket.emit('room', roomArea.value);

    // displayMessages(roomArea.value);
}

// const displayMessages = (room) => {
//     chatContainer.innerHTML = '';
//     if (messages[room]) {
//         messages[room].forEach((msg) => {
//             chatContainer.innerHTML += `<div>${msg}</div>`;
//         });
//     }
// };

const displayPokemon = () => {
    pokemons.forEach((pokemon) => {
        pokemonContainer.innerHTML +=
            `<div class="pokemon-card">
                <img src="${pokemon.sprite}" alt="${pokemon.name} sprite">
                <h4>${pokemon.type} Type</h4>
                <h2>${pokemon.name}</h2>
            </div>`
    })
}

roomArea.addEventListener('change', (e) => {
    const newRoom = e.target.value;

    if (room) {
        socket.emit('leave', room);
    }
    socket.emit('join', newRoom);
    room = newRoom;
});



function getPokemon() {
    starters.forEach(async (starter, index)  => {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${starter}`);
        const pokemon = await response.json();

        let pokemonData = {};
        pokemonData.name = pokemon.name;
        pokemonData.type = pokemon.types[0].type.name;
        pokemonData.sprite = pokemon.sprites.front_default;

        let moves = [];
        let pokemonMoves = []

        switch (index) {
            case 0:
                moves = ['flamethrower', 'air-slash', 'dragon-pulse', 'slash']
            case 1:
                moves = ['hydro-pump', 'flash-cannon', 'aurasphere', 'facade']
            case 2:
                moves = ['energy-ball', 'sludge-bomb', 'body-slam', 'tera-blast']
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
    });
}

getPokemon();
