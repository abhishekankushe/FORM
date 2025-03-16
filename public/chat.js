const socket = io("http://localhost:5001"); // Update to match your backend port

// ✅ **DOM Elements**
const userList = document.getElementById("userList");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendMessageButton = document.getElementById("sendMessage");
const fileInput = document.getElementById("fileInput");
const typingIndicator = document.createElement("p");
typingIndicator.id = "typingIndicator";
typingIndicator.className = "text-muted small mt-2";

let selectedReceiver = null; // Keeps track of the selected user
const chatHistory = {}; // Stores messages per user

// ✅ **Get logged-in user (use localStorage or prompt)**
const username = localStorage.getItem("chatUsername") || prompt("Enter your name:") || "Anonymous";
localStorage.setItem("chatUsername", username);
socket.emit("join", username);

// ✅ **Update Online Users List**
socket.on("updateUserList", (users) => {
    userList.innerHTML = "";
    users.forEach(user => {
        if (user !== username) { // Prevent showing yourself in the list
            const li = document.createElement("li");
            li.className = "list-group-item";
            li.textContent = user;
            li.addEventListener("click", () => selectReceiver(user));
            userList.appendChild(li);
        }
    });
});

// ✅ **Select Receiver (Click on a User to Start Chat)**
function selectReceiver(user) {
    selectedReceiver = user;

    // Highlight selected user
    document.querySelectorAll("#userList li").forEach(li => li.classList.remove("active"));
    [...userList.children].forEach(li => {
        if (li.textContent === user) li.classList.add("active");
    });

    // Load previous messages for the selected user
    chatBox.innerHTML = `<h5 class="text-center text-primary">Chatting with: ${user}</h5>`;
    if (chatHistory[user]) {
        chatHistory[user].forEach(msg => {
            displayMessage(msg, msg.sender === username ? "sent" : "received");
        });
    }
}

// ✅ **Send Text Message**
sendMessageButton.addEventListener("click", () => {
    if (!selectedReceiver) return alert("Select a user to chat with!");
    sendMessage();
});

// ✅ **Send File Message**
fileInput?.addEventListener("change", async () => {
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/upload", {
                method: "POST",
                body: formData,
                headers: { Authorization: "Bearer your_token" }
            });

            const data = await response.json();
            if (data.url) {
                sendMessage(data.url, "image");
            } else {
                alert("File upload failed.");
            }
        } catch (error) {
            console.error("❌ Error uploading file:", error);
            alert("Upload error!");
        }
    }
});

// ✅ **Function to Send Message**
function sendMessage(content = messageInput.value.trim(), type = "text") {
    if (!selectedReceiver) {
        alert("Please select a user to chat with!");
        return;
    }

    if (content) {
        const messageData = { sender: username, receiver: selectedReceiver, content, type };
        socket.emit("sendMessage", messageData); // Send to server
        saveMessage(messageData);
        displayMessage(messageData, "sent");
        messageInput.value = "";
    }
}

// ✅ **Save Messages to Chat History**
function saveMessage(messageData) {
    const { sender, receiver } = messageData;

    if (!chatHistory[sender]) chatHistory[sender] = [];
    if (!chatHistory[receiver]) chatHistory[receiver] = [];

    chatHistory[sender].push(messageData);
    chatHistory[receiver].push(messageData);
}

// ✅ **Receive Messages & Update UI Correctly**
socket.on("receiveMessage", (messageData) => {
    saveMessage(messageData);
    if (
        (messageData.sender === selectedReceiver && messageData.receiver === username) ||
        (messageData.sender === username && messageData.receiver === selectedReceiver)
    ) {
        displayMessage(messageData, messageData.sender === username ? "sent" : "received");
    }
});

// ✅ **Display Messages Correctly**
function displayMessage(messageData, type) {
    const div = document.createElement("div");
    div.className = `message ${type}`;

    if (messageData.type === "image") {
        div.innerHTML = `
            <div class="msg-bubble ${type}">
                <b>${messageData.sender}:</b> <br>
                <img src="${messageData.content}" width="200px" class="chat-image">
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="msg-bubble ${type}">
                <b>${messageData.sender}:</b> ${messageData.content}
            </div>
        `;
    }

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
}

// ✅ **Typing Indicator**
let typingTimeout;
messageInput.addEventListener("input", () => {
    if (!selectedReceiver) return;
    socket.emit("typing", { sender: username, receiver: selectedReceiver });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("stopTyping", { sender: username, receiver: selectedReceiver });
    }, 1000);
});

// ✅ **Show Typing Indicator**
socket.on("userTyping", ({ sender, receiver }) => {
    if (receiver === username && sender === selectedReceiver) {
        typingIndicator.textContent = `${sender} is typing...`;
        if (!document.getElementById("typingIndicator")) {
            chatBox.appendChild(typingIndicator);
        }
    }
});

// ✅ **Remove Typing Indicator Correctly**
socket.on("stopTyping", ({ sender, receiver }) => {
    if (receiver === username && sender === selectedReceiver) {
        typingIndicator.remove();
    }
});
