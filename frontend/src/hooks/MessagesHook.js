import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/AuthHook";
import { WSUrl } from "@/config/urls";

export const useMessagesSocket = () => {
    const { accessToken } = useAuth();
    const wsRef = useRef(null);
    const visibilityTimerRef = useRef(null);

    const [connected, setConnected] = useState(false);

    const [incomingMessage, setIncomingMessage] = useState(null); // new_message
    const [createdMessage, setCreatedMessage] = useState(null);   // create_message

    const normalizeMessage = (msg) => ({
        ...msg,
        text: msg.message_text,
        created_at: new Date().toISOString(),
        from_user_id: msg.from_user_id || msg.user_from?.id
    });

    const sendMessage = useCallback((text, fromUserId, chatId) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "message_create",
                from_user: fromUserId,
                to_chat: chatId,
                text,
                created_at: new Date().toISOString(),
            }));
        } else {
            console.warn("WS не подключен. Сообщение не отправлено:", text);
        }
    }, []);

    useEffect(() => {
        if (!accessToken) return;

        const clearVisibilityTimer = () => {
            if (visibilityTimerRef.current) {
                clearTimeout(visibilityTimerRef.current);
                visibilityTimerRef.current = null;
            }
        };

        const connectWebSocket = () => {
            if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

            const tokenParam = encodeURIComponent(accessToken);
            const ws = new WebSocket(`${WSUrl}/messages/?token=${tokenParam}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WS подключен");
                setConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // СВОЁ сообщение
                    if (data.type === "create_message") {
                        setCreatedMessage(normalizeMessage(data.message));
                    }

                    // ЧУЖОЕ сообщение
                    if (data.type === "new_message") {
                        setIncomingMessage(normalizeMessage(data.message));
                    }
                } catch (err) {
                console.error("Ошибка парсинга WS:", err);
            }
        };

        ws.onclose = () => {
            console.log("WS закрыт");
            setConnected(false);
        };

        ws.onerror = (err) => console.error("WS ошибка:", err);
    };

    const handleVisibilityChange = () => {
        clearVisibilityTimer();

        if (document.visibilityState === "visible") {
            connectWebSocket();
        } else {
            visibilityTimerRef.current = setTimeout(() => {
                if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
                    wsRef.current.close();
                }
            }, 5000);
        }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", clearVisibilityTimer);

    connectWebSocket();

    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("beforeunload", clearVisibilityTimer);
        clearVisibilityTimer();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    };
}, [accessToken]);

return {
    sendMessage,
    incomingMessage,
    createdMessage,
    connected
};
};
