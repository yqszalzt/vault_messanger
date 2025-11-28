import React, { useState, useEffect, useRef, useMemo } from "react";
import '#/css/Messages/MessagesList.css';
import { useAuth } from "@/hooks/AuthHook";
import { apiMediaUrl, apiUrl } from "@/config/urls";
import { useLocation, Link } from "react-router-dom";
import { useMessagesSocket } from "@/hooks/MessagesHook";
import toast from "react-hot-toast";
import { formatLastOnline } from "@/utils/ProfilePageUtils";


// --- ИКОНКИ ---
const SendIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>);
const CloseIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const BackIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>);

// Иконки контекстного меню
const ReplyIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6M3 10l6-6" /></svg>);
const CopyIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
const EditIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>);
const DeleteIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d00" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);


// --- УТИЛИТЫ ВРЕМЕНИ И ДАТ ---
const formatMessageTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateSeparator = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Сегодня";
    if (date.toDateString() === yesterday.toDateString()) return "Вчера";

    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};


export default function MessagesList() {
    const [chatsData, setChatsData] = useState([]);
    const [messages, setMessages] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(0);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const { accessToken, authRequest, dbReady } = useAuth();
    const location = useLocation();
    const chatIdFromState = location.state?.chatId;
    const [messageText, setMessageText] = useState("");

    // Resize States
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, message: null });

    const { sendMessage, incomingMessage, createdMessage } = useMessagesSocket();
    const messagesEndRef = useRef(null);

    // --- ЛОГИКА РЕСАЙЗА ---
    const startResizing = (e) => {
        setIsResizing(true);
        e.preventDefault(); // Предотвратить выделение текста
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            // Ограничиваем ширину от 200 до 700
            let newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
            if (newWidth < 200) newWidth = 200;
            if (newWidth > 700) newWidth = 700;
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => setIsResizing(false);

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // --- ЛОГИКА ESC И КЛИКА ВНЕ МЕНЮ ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                if (contextMenu.visible) setContextMenu({ ...contextMenu, visible: false });
                else setSelectedChatId(null);
            }
        };
        const handleClickOutside = () => setContextMenu({ ...contextMenu, visible: false });

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("click", handleClickOutside);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("click", handleClickOutside);
        };
    }, [contextMenu]);

    // --- КОНТЕКСТНОЕ МЕНЮ ---
    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        // Позиционируем меню
        let x = e.clientX;
        let y = e.clientY;

        // Коррекция, если меню уходит за экран (простая версия)
        if (window.innerWidth - x < 200) x -= 200;
        if (window.innerHeight - y < 200) y -= 200;

        setContextMenu({ visible: true, x, y, message: msg });
    };

    // --- ГРУППИРОВКА СООБЩЕНИЙ ПО ДАТЕ ---
    const groupedMessages = useMemo(() => {
        const groups = [];
        let lastDate = null;

        messages.forEach(msg => {
            const msgDate = new Date(msg.created_at || Date.now()).toDateString(); // created_at должен быть в объекте msg
            if (msgDate !== lastDate) {
                groups.push({ type: 'date', date: msg.created_at, id: `date-${msgDate}` });
                lastDate = msgDate;
            }
            groups.push({ type: 'msg', ...msg });
        });
        return groups;
    }, [messages]);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // Обработка входящих
    useEffect(() => {
        if (!incomingMessage) return;
        if (incomingMessage.chat_id !== selectedChatId) {
            const sender = incomingMessage.user_from || {};
            const avatar = `${apiMediaUrl}${sender.avatar}` || '/default-avatar.png';
            const name = sender.fio || sender.username || 'Пользователь';
            const text = incomingMessage.message_text || '';

            toast.custom(t => (
                <div
                    className="toast-notification"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        background: '#fff',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        borderLeft: '4px solid #3390ec',
                        fontFamily: 'sans-serif'
                    }}
                    onClick={() => {
                        setSelectedChatId(incomingMessage.chat_id);
                        toast.dismiss(t.id);
                    }}
                >
                    <img
                        src={avatar}
                        alt={name}
                        style={{ width: 40, height: 40, borderRadius: '50%', marginRight: 12, objectFit: 'cover' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '14px', marginBottom: '2px' }}>{name}</strong>
                        <span style={{ fontSize: '13px', color: '#555', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
                    </div>
                </div>
            ));
        }

        if (incomingMessage.chat_id === selectedChatId) {
            setMessages(prev => [...prev, incomingMessage]);
        }
    }, [incomingMessage, selectedChatId]);

    // Обработка исходящих
    useEffect(() => {
        if (!createdMessage) return;
        if (createdMessage.chat_id !== selectedChatId) return;
        setMessages(prev => [...prev, createdMessage]);
    }, [createdMessage, selectedChatId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Загрузка профиля
    useEffect(() => {
        if (!accessToken || !dbReady) return;
        authRequest('GET', `${apiUrl}/v1/accounts/profile/`)
            .then(res => res.status === 200 && setCurrentUserId(res.data.id))
            .catch(console.error);
    }, [accessToken, dbReady, authRequest]);

    // Загрузка чатов
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
                        return { ...chat, other_user: otherUser, last_message: lastMessage };
                    });
                    setChatsData(normalizedChats);
                    if (chatIdFromState) setSelectedChatId(chatIdFromState);
                }
            })
            .catch(console.error);
    }, [accessToken, dbReady, authRequest, currentUserId, chatIdFromState]);

    // Загрузка истории сообщений
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
    const isSidebarNarrow = sidebarWidth < 240;

    return (
        <div className="messages-page">
            {/* Сайдбар */}
            <div 
                className={`chats-sidebar ${selectedChatId ? 'mobile-hidden' : ''} ${isSidebarNarrow ? 'narrow' : ''}`} 
                style={{ width: isSidebarNarrow ? '70px' : `${sidebarWidth}px` }}
                ref={sidebarRef}
            >
                <div className="chats-list">
                    {chatsData.map(chat => {
                        const otherUser = chat.user_1.id === currentUserId ? chat.user_2 : chat.user_1;
                        // Простая проверка для демонстрации
                        const lastMsg = chat.last_message ? chat.last_message.message_text : "Нет сообщений";

                        return (
                            <div
                                key={chat.id}
                                className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                                onClick={() => setSelectedChatId(chat.id)}
                                title={isSidebarNarrow ? (otherUser.fio || otherUser.username) : ""}
                            >
                                <img
                                    src={otherUser.avatar || "/default-avatar.png"}
                                    alt={otherUser.fio}
                                    className="chat-avatar"
                                />
                                {!isSidebarNarrow && (
                                    <div className="chat-info">
                                        <div className="chat-name">{otherUser.fio || otherUser.username}</div>
                                        <div className="chat-last-message">{lastMsg}</div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                <div className="resizer-handle" onMouseDown={startResizing} />
            </div>

            <div className={`chat-window ${!selectedChatId ? 'mobile-hidden' : 'mobile-visible'}`}>
                {!selectedChat ? (
                    <div className="empty-chat">
                        <span>Выберите чат для начала общения</span>
                    </div>
                ) : (
                    <div className="chat-detail">
                        <div className="chat-header">
                            <button className="chat-back-btn mobile-only" onClick={() => setSelectedChatId(null)}>
                                <BackIcon />
                            </button>
                            
                            <Link 
                                to={`/profile/${selectedChat.user_1.id === currentUserId ? selectedChat.user_2.id : selectedChat.user_1.id}`} 
                                className="chat-user-info" 
                                style={{textDecoration: 'none'}}
                            >
                                <img
                                    src={selectedChat.user_1.id === currentUserId ? selectedChat.user_2.avatar : selectedChat.user_1.avatar}
                                    alt="avatar"
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
                                            ? (selectedChat.user_2.online_status ? <span style={{color: '#3390ec'}}>в сети</span> : formatLastOnline(selectedChat.user_2.last_online))
                                            : (selectedChat.user_1.online_status ? <span style={{color: '#3390ec'}}>в сети</span> : formatLastOnline(selectedChat.user_1.last_online))
                                        }
                                    </div>
                                </div>
                            </Link>
                            <button
                                className="chat-close-btn"
                                onClick={(e) => { e.preventDefault(); setSelectedChatId(null) }}
                                title="Закрыть чат (Esc)"
                            >
                                <CloseIcon />
                            </button>
                        </div>

                        <div className="chat-messages">
                            {groupedMessages.map((item) => {
                                if (item.type === 'date') {
                                    return (
                                        <div key={item.id} className="date-separator">
                                            <span>{formatDateSeparator(item.date)}</span>
                                        </div>
                                    );
                                }
                                const msg = item;
                                return (
                                    <div
                                        key={msg.id}
                                        className={`chat-message ${msg.user_from?.id === currentUserId ? 'own' : 'other'}`}
                                        onContextMenu={(e) => handleContextMenu(e, msg)}
                                    >
                                        <div className="message-content">{msg.message_text}</div>
                                        <div className="message-time">
                                            {formatMessageTime(msg.created_at)}
                                            {/* {msg.user_from?.id === currentUserId && <span className="read-status"> ✓✓</span>} */}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-area">
                            <input
                                type="text"
                                placeholder="Написать сообщение..."
                                value={messageText}
                                onChange={e => setMessageText(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleSendMessage(); }}
                            />
                            <button onClick={handleSendMessage} title="Отправить">
                                <SendIcon />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {contextMenu.visible && (
                <div 
                    className="context-menu" 
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="context-item" onClick={() => { console.log("Ответить", contextMenu.message); setContextMenu({...contextMenu, visible: false}); }}>
                        <ReplyIcon /> <span>Ответить</span>
                    </div>
                    <div className="context-item" onClick={() => { 
                        navigator.clipboard.writeText(contextMenu.message.message_text); 
                        toast.success("Скопировано");
                        setContextMenu({...contextMenu, visible: false}); 
                    }}>
                        <CopyIcon /> <span>Копировать</span>
                    </div>
                    <div className="context-item" onClick={() => { console.log("Изменить", contextMenu.message); setContextMenu({...contextMenu, visible: false}); }}>
                        <EditIcon /> <span>Изменить</span>
                    </div>
                    <div className="context-item delete" onClick={() => { console.log("Удалить", contextMenu.message); setContextMenu({...contextMenu, visible: false}); }}>
                        <DeleteIcon /> <span>Удалить</span>
                    </div>
                </div>
            )}
        </div>
    )
}