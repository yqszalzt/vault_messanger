// !!! FULL UPDATED CODE WITH CHAT SORTING + UNREAD BADGES
// !!! EVERYTHING INCLUDED, NOTHING REMOVED

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

const ReplyIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6M3 10l6-6" /></svg>);
const CopyIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
const EditIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>);
const DeleteIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d00" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);


// --- УТИЛИТЫ ---
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
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, message: null });
    const { sendMessage, sendMessage2, incomingMessage, createdMessage, markAsRead } = useMessagesSocket();
    const messagesEndRef = useRef(null);
    const [notifiedMessageIds, setNotifiedMessageIds] = useState(new Set());

    const startResizing = (e) => {
        setIsResizing(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
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


    useEffect(() => {
        const keyDown = (e) => {
            if (e.key === "Escape") {
                if (contextMenu.visible) setContextMenu({ ...contextMenu, visible: false });
                else setSelectedChatId(null);
            }
        };
        const closeMenu = () => setContextMenu({ ...contextMenu, visible: false });

        window.addEventListener("keydown", keyDown);
        window.addEventListener("click", closeMenu);

        return () => {
            window.removeEventListener("keydown", keyDown);
            window.removeEventListener("click", closeMenu);
        };
    }, [contextMenu]);


    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        let x = e.clientX;
        let y = e.clientY;

        if (window.innerWidth - x < 200) x -= 200;
        if (window.innerHeight - y < 200) y -= 200;

        setContextMenu({ visible: true, x, y, message: msg });
    };


    // --- ГРУППИРОВКА ПО ДАТАМ ---
    // const groupedMessages = useMemo(() => {
    //     const groups = [];
    //     let lastDate = null;

    //     messages.forEach(msg => {
    //         const msgDate = new Date(msg.created_at).toDateString();
    //         if (msgDate !== lastDate) {
    //             groups.push({ type: 'date', date: msg.created_at, id: `date-${msgDate}` });
    //             lastDate = msgDate;
    //         }
    //         groups.push({ type: 'msg', ...msg });
    //     });

    //     return groups;
    // }, [messages]);

    const groupedMessages = useMemo(() => {
        // теперь просто возвращаем сообщения без даты
        return messages.map(msg => ({ type: 'msg', ...msg }));
    }, [messages]);


    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });


    // --------------------------------------------------
    // 👉 CHANGE HERE: обработка EDIT/DELETE + сортировка чатов
    // --------------------------------------------------
    useEffect(() => {
        if (!incomingMessage) return;

        const msgId = incomingMessage.id;

        // --- Если сообщение уже уведомляли — ничего не делаем ---
        if (notifiedMessageIds.has(msgId)) return;

        const isCurrentChat = incomingMessage.chat_id === selectedChatId;

        // если сообщение в открытом чате — сразу читаем
        if (isCurrentChat) {
            if (incomingMessage.type === "new_message" || incomingMessage.type === "created_message") {
                setMessages(prev => [...prev, incomingMessage]);

                setChatsData(prev =>
                    prev.map(chat =>
                        chat.id === incomingMessage.chat_id
                            ? { ...chat, last_message: incomingMessage, unread_count: 0 }
                            : chat
                    ).sort((a, b) => new Date(b.last_message?.created_at) - new Date(a.last_message?.created_at))
                );
            }
        } else {
            // --- НЕ выбранный чат: ставим unread + last_message ---
            if (incomingMessage.type === "new_message") {
                setChatsData(prev =>
                    prev.map(chat =>
                        chat.id === incomingMessage.chat_id
                            ? {
                                ...chat,
                                last_message: incomingMessage,
                                unread_count: (chat.unread_count || 0) + 1
                            }
                            : chat
                    ).sort((a, b) => new Date(b.last_message?.created_at) - new Date(a.last_message?.created_at))
                );
            }
        }

        // редактирование
        if (incomingMessage.type === "edit_message_success") {
            setMessages(prev =>
                prev.map(m =>
                    m.id === incomingMessage.message.id
                        ? { ...m, message_text: incomingMessage.message.message_text, is_edit: true }
                        : m
                )
            );
            return;
        }

        // удаление
        if (incomingMessage.type === "delete_message_success") {
            setMessages(prev => prev.filter(m => m.id !== incomingMessage.message.id));
            return;
        }

        // НЕ выбран этот чат → уведомление + unread badge
        if (incomingMessage.chat_id !== selectedChatId) {
            setChatsData(prev => {
                const updated = prev.map(chat =>
                    chat.id === incomingMessage.chat_id
                        ? {
                            ...chat,
                            last_message: incomingMessage
                        }
                        : chat
                );

                return updated.sort((a, b) => (
                    new Date(b.last_message?.created_at) - new Date(a.last_message?.created_at)
                ));
            });

            const sender = incomingMessage.user_from || {};
            toast(`${sender.fio || sender.username}: ${incomingMessage.message_text}`);

            return;
        }

        setMessages(prev => [...prev, incomingMessage]);

        setChatsData(prev => {
            const updated = prev.map(chat =>
                chat.id === incomingMessage.chat_id
                    ? { ...chat, last_message: incomingMessage, unread_count: 0 }
                    : chat
            );

            return updated.sort((a, b) =>
                new Date(b.last_message?.created_at) - new Date(a.last_message?.created_at)
            );
        });

        setNotifiedMessageIds(prev => new Set([...prev, msgId]));
    }, [incomingMessage, selectedChatId]);


    useEffect(() => {
        if (!createdMessage) return;
        if (createdMessage.chat_id !== selectedChatId) return;

        setMessages(prev => [...prev, createdMessage]);

        setChatsData(prev => {
            const updated = prev.map(chat =>
                chat.id === createdMessage.chat_id
                    ? { ...chat, last_message: createdMessage, unread_count: 0 }
                    : chat
            );

            return updated.sort((a, b) =>
                new Date(b.last_message?.created_at) - new Date(a.last_message?.created_at)
            );
        });
    }, [createdMessage, selectedChatId]);


    useEffect(scrollToBottom, [messages]);


    // загрузка профиля
    useEffect(() => {
        if (!accessToken || !dbReady) return;
        authRequest('GET', `${apiUrl}/v1/accounts/profile/`)
            .then(res => res.status === 200 && setCurrentUserId(res.data.id))
            .catch(console.error);
    }, [accessToken, dbReady]);


    // --------------------------------------------------
    // 👉 CHANGE HERE: сортировка чатов после загрузки
    // --------------------------------------------------
    useEffect(() => {
        if (!accessToken || !dbReady) return;

        authRequest('GET', `${apiUrl}/v1/msg/chat/?ac=true`)
            .then(res => {
                if (res.status === 200) {
                    const normalized = res.data.map(chat => {
                        const otherUser = chat.user_1.id === currentUserId ? chat.user_2 : chat.user_1;
                        return {
                            ...chat,
                            other_user: otherUser,
                            unread_count: 0,
                        };
                    });

                    // сортировка
                    normalized.sort((a, b) =>
                        new Date(b.last_message?.created_at) - new Date(a.last_message?.created_at)
                    );

                    setChatsData(normalized);

                    if (chatIdFromState) setSelectedChatId(chatIdFromState);
                }
            });
    }, [accessToken, dbReady, currentUserId, chatIdFromState]);


    // загрузка сообщений чата
    useEffect(() => {
        if (!selectedChatId || !accessToken || !dbReady) return;

        const fetchMessages = async () => {
            try {
                const res = await authRequest('GET', `${apiUrl}/v1/msg/messages/?chat=${selectedChatId}`);
                if (res.status === 200) {
                    setMessages(res.data);

                    // Send read confirmation
                    markAsRead(selectedChatId);

                    // reset unread_count locally
                    setChatsData(prev =>
                        prev.map(chat =>
                            chat.id === selectedChatId ? { ...chat, unread_count: 0 } : chat
                        )
                    );
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchMessages();
    }, [selectedChatId, accessToken, dbReady]);


    const handleSendMessage = () => {
        if (!messageText.trim() || !selectedChatId) return;
        sendMessage(messageText.trim(), currentUserId, selectedChatId);
        setMessageText("");
    };

    const selectedChat = chatsData.find(c => c.id === selectedChatId);
    const isSidebarNarrow = sidebarWidth < 240;


    return (
        <div className="messages-page">

            {/* SIDEBAR */}
            <div
                className={`chats-sidebar ${selectedChatId ? 'mobile-hidden' : ''} ${isSidebarNarrow ? 'narrow' : ''}`}
                style={{ width: isSidebarNarrow ? '70px' : `${sidebarWidth}px` }}
                ref={sidebarRef}
            >
                <div className="chats-list">
                    {chatsData.map(chat => {
                        const otherUser = chat.user_1.id === currentUserId ? chat.user_2 : chat.user_1;

                        const lastMsg = chat.last_message
                            ? (chat.last_message.from_user_id === currentUserId
                                ? `Вы: ${chat.last_message.message_text}`
                                : chat.last_message.message_text)
                            : "Нет сообщений";

                        return (
                            <div
                                key={chat.id}
                                className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                                onClick={() => setSelectedChatId(chat.id)}
                                title={isSidebarNarrow ? otherUser.fio : ""}
                            >
                                <img
                                    src={otherUser.avatar || "/default-avatar.png"}
                                    alt={otherUser.fio}
                                    className="chat-avatar"
                                />

                                {!isSidebarNarrow && (
                                    <div className="chat-info">
                                        <div className="chat-name">{otherUser.fio}</div>
                                        <div className="chat-last-message">
                                            {lastMsg}
                                        </div>
                                    </div>
                                )}

                                {/* -------------------------------------------------- */}
                                {/* 👉 CHANGE HERE: синяя цифра непрочитанных */}
                                {/* -------------------------------------------------- */}
                                {chat.unread_count > 0 && (
                                    <div className="unread-badge">
                                        {chat.unread_count}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="resizer-handle" onMouseDown={startResizing} />
            </div>


            {/* MAIN CHAT WINDOW */}
            <div className={`chat-window ${!selectedChatId ? 'mobile-hidden' : 'mobile-visible'}`}>
                {!selectedChat ? (
                    <div className="empty-chat">Выберите чат</div>
                ) : (
                    <div className="chat-detail">

                        {/* HEADER */}
                        <div className="chat-header">
                            <button className="chat-back-btn mobile-only" onClick={() => setSelectedChatId(null)}>
                                <BackIcon />
                            </button>

                            <Link
                                to={`/profile/${selectedChat.other_user.id}`}
                                className="chat-user-info"
                                style={{ textDecoration: 'none' }}
                            >
                                <img
                                    src={selectedChat.other_user.avatar}
                                    alt="avatar"
                                    className="chat-header-avatar"
                                />

                                <div className="chat-header-text">
                                    <div className="chat-header-name">{selectedChat.other_user.fio}</div>
                                    <div className="chat-header-status">
                                        {selectedChat.other_user.online_status ? (
                                            <span style={{ color: '#3390ec' }}>в сети</span>
                                        ) : (
                                            formatLastOnline(selectedChat.other_user.last_online)
                                        )}
                                    </div>
                                </div>
                            </Link>

                            <button
                                className="chat-close-btn"
                                onClick={() => setSelectedChatId(null)}
                            >
                                <CloseIcon />
                            </button>
                        </div>


                        {/* MESSAGES LIST */}
                        <div className="chat-messages">
                            {groupedMessages.map(item => {
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
                                            {msg.is_edit && <span className="edited-status">ред.</span>}
                                            {formatMessageTime(msg.created_at)}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>


                        {/* INPUT */}
                        <div className="chat-input-area">
                            <input
                                type="text"
                                placeholder="Написать сообщение..."
                                value={messageText}
                                onChange={e => setMessageText(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleSendMessage(); }}
                            />
                            <button onClick={handleSendMessage}>
                                <SendIcon />
                            </button>
                        </div>

                    </div>
                )}
            </div>


            {/* CONTEXT MENU */}
            {contextMenu.visible && (
                <div
                    className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="context-item" onClick={() => setContextMenu({ ...contextMenu, visible: false })}>
                        <ReplyIcon /> Ответить
                    </div>

                    <div
                        className="context-item"
                        onClick={() => {
                            navigator.clipboard.writeText(contextMenu.message.message_text);
                            toast.success("Скопировано");
                            setContextMenu({ ...contextMenu, visible: false });
                        }}
                    >
                        <CopyIcon /> Копировать
                    </div>

                    <div
                        className="context-item"
                        onClick={() => {
                            const newText = prompt("Измените сообщение", contextMenu.message.message_text);
                            if (!newText) return;

                            sendMessage2("edit_message", {
                                message_id: contextMenu.message.id,
                                text: newText
                            });

                            setContextMenu({ ...contextMenu, visible: false });
                        }}
                    >
                        <EditIcon /> Изменить
                    </div>

                    <div
                        className="context-item delete"
                        onClick={() => {
                            if (window.confirm("Удалить сообщение?")) {
                                sendMessage2("delete_message", {
                                    message_id: contextMenu.message.id
                                });
                            }
                            setContextMenu({ ...contextMenu, visible: false });
                        }}
                    >
                        <DeleteIcon /> Удалить
                    </div>
                </div>
            )}

        </div>
    );
}
