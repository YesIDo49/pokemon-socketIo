let room = '';
let socketid = '';
const roomArea = document.querySelector('#room');
const messageArea = document.querySelector('#message');
const userArea = document.querySelector('#user');
const chatContainer = document.querySelector('.chat');
const socket = io('http://localhost:3000');
let messages = {};

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
    const message = messageArea.value;
    console.log(message);

    messages[roomArea.value] = messages[roomArea.value] || [];
    messages[roomArea.value].push(message);

    socket.emit('room', roomArea.value, `Chat from ${userArea.value} : ${message}`);

    displayMessages(roomArea.value);
}

const displayMessages = (room) => {
    chatContainer.innerHTML = '';
    if (messages[room]) {
        messages[room].forEach((msg) => {
            chatContainer.innerHTML += `<div>${msg}</div>`;
        });
    }
};

roomArea.addEventListener('change', (e) => {
    const newRoom = e.target.value;

    if (room) {
        socket.emit('leave', room);
    }
    socket.emit('join', newRoom);
    room = newRoom;

    displayMessages(room);
});
