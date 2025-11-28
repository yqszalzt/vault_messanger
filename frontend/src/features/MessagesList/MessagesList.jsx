import React, { useState, useEffect, useRef } from "react";
import '#/css/Messages/MessagesList.css';
import { useAuth } from "@/hooks/AuthHook";
import { apiUrl } from "@/config/urls";
import { useLocation, Link } from "react-router-dom";
import { useMessagesSocket } from "@/hooks/MessagesHook";
import toast from "react-hot-toast";

export default function MessagesList() {
    const [chatsData, setChatsData] = useState([]);
    const [messages, setMessages] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(0);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const { accessToken, authRequest, dbReady } = useAuth();
    const location = useLocation();
    const chatIdFromState = location.state?.chatId;
    const [messageText, setMessageText] = useState("");

    const { sendMessage, incomingMessage, createdMessage } = useMessagesSocket();

    const messagesEndRef = useRef(null);

    // Функция скролла вниз
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Когда мне прислали
    useEffect(() => {
        if (!incomingMessage) return;
        if (incomingMessage.chat_id !== selectedChatId) return;
        console.log(incomingMessage)
        setMessages(prev => [...prev, incomingMessage]);
    }, [incomingMessage, selectedChatId]);

    // Когда я отправил
    useEffect(() => {
        if (!createdMessage) return;
        if (createdMessage.chat_id !== selectedChatId) return;

        setMessages(prev => [...prev, createdMessage]);
    }, [createdMessage, selectedChatId]);

    // ------------------- Автоскролл -------------------
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // ------------------- Загрузка профиля -------------------
    useEffect(() => {
        if (!accessToken || !dbReady) return;

        authRequest('GET', `${apiUrl}/v1/accounts/profile/`)
            .then(res => res.status === 200 && setCurrentUserId(res.data.id))
            .catch(console.error);
    }, [accessToken, dbReady, authRequest]);

    // ------------------- Загрузка чатов -------------------
    useEffect(() => {
        if (!accessToken || !dbReady) return;

        authRequest('GET', `${apiUrl}/v1/msg/chat/?ac=true`)
            .then(res => {
                if (res.status === 200) {
                    const normalizedChats = res.data.map(chat => {
                        const otherUser = chat.user_1.id === currentUserId ? chat.user_2 : chat.user_1;
                        let lastMessage = null;
                        if (chat.last_message) {
                            lastMessage = {
                                ...chat.last_message,
                                from_user_id: chat.last_message.user_from?.id ?? null
                            };
                        }
                        return {
                            ...chat,
                            other_user: otherUser,
                            last_message: lastMessage
                        };
                    });

                    setChatsData(normalizedChats);

                    if (chatIdFromState) setSelectedChatId(chatIdFromState);
                }
            })
            .catch(console.error);
    }, [accessToken, dbReady, authRequest, currentUserId, chatIdFromState]);

    // ------------------- Загрузка сообщений выбранного чата -------------------
    useEffect(() => {
        if (!selectedChatId || !accessToken || !dbReady) return;

        const fetchMessages = async () => {
            try {
                const res = await authRequest('GET', `${apiUrl}/v1/msg/messages/?chat=${selectedChatId}`);
                if (res.status === 200) setMessages(res.data);
            } catch (err) {
                console.error(err);
            }
        };

        fetchMessages();
    }, [selectedChatId, accessToken, dbReady, authRequest]);

    const handleSendMessage = async () => {
        if (!messageText.trim() || !selectedChatId) return;

        try {
            sendMessage(messageText.trim(), currentUserId, selectedChatId);
            setMessageText("");
        } catch (err) {
            console.error(err);
        }
    };

    const selectedChat = chatsData.find(c => c.id === selectedChatId);

    return (
        <div className="messages-page">
            <div className="chats-sidebar">
                <div className="chats-list">
                    {chatsData.map(chat => {
                        const otherUser = chat.user_1.id === currentUserId ? chat.user_2 : chat.user_1;
                        const lastMsgText = chat.last_message
                            ? (chat.last_message.user_from?.id === currentUserId
                                ? `Вы: ${chat.last_message.message_text}`
                                : chat.last_message.message_text)
                            : "У вас ещё нет сообщений";

                        return (
                            <div
                                key={chat.id}
                                className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                                onClick={() => setSelectedChatId(chat.id)}
                            >
                                <img
                                    src={otherUser.avatar || "/default-avatar.png"}
                                    alt={otherUser.fio || otherUser.username}
                                    className="chat-avatar"
                                />
                                <div className="chat-info">
                                    <div className="chat-name">{otherUser.fio || otherUser.username}</div>
                                    <div className="chat-last-message">{lastMsgText}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="chat-window">
                {!selectedChat ? (
                    <div className="empty-chat">Выберите, с кем хотите общаться</div>
                ) : (
                    <div className="chat-detail">
                        <Link to={`/profile/${selectedChat.user_1.id === currentUserId
                            ? selectedChat.user_2.id
                            : selectedChat.user_1.id}`} className="chat-header">
                            <div className="chat-user-info">
                                <img
                                    src={selectedChat.user_1.id === currentUserId
                                        ? selectedChat.user_2.avatar
                                        : selectedChat.user_1.avatar
                                    }
                                    alt={selectedChat.user_1.id === currentUserId
                                        ? selectedChat.user_2.fio
                                        : selectedChat.user_1.fio
                                    }
                                    className="chat-header-avatar"
                                />
                                <div className="chat-header-text">
                                    <div className="chat-header-name">
                                        {selectedChat.user_1.id === currentUserId
                                            ? selectedChat.user_2.fio || selectedChat.user_2.username
                                            : selectedChat.user_1.fio || selectedChat.user_1.username}
                                    </div>
                                    <div className="chat-header-status">
                                        {selectedChat.user_1.id === currentUserId
                                            ? (selectedChat.user_2.online_status ? "в сети" : "")
                                            : (selectedChat.user_1.online_status ? "в сети" : "")
                                        }
                                    </div>
                                </div>
                            </div>
                            <button
                                className="chat-close-btn"
                                onClick={(e) => { e.preventDefault(); setSelectedChatId(null) }}
                            >
                                ×
                            </button>
                        </Link>

                        <div className="chat-messages">
                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={`chat-message ${msg.user_from?.id === currentUserId ? 'own' : 'other'}`}
                                >
                                    {msg.message_text}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-area">
                            <input
                                type="text"
                                placeholder="Введите сообщение..."
                                value={messageText}
                                onChange={e => setMessageText(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleSendMessage(); }}
                            />
                            <button onClick={handleSendMessage}>Отправить</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
