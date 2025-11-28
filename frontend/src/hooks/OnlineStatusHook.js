import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/AuthHook";
import { WSUrl } from "@/config/urls";

const INACTIVITY_TIMEOUT = 5000;

export const useOnlineStatus = () => {
  const { accessToken } = useAuth();
  const wsRef = useRef(null);
  const visibilityTimerRef = useRef(null);

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
      const ws = new WebSocket(`${WSUrl}/online_status/?token=${tokenParam}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket подключен. Статус: online");
        ws.send(JSON.stringify({ type: "online_status", online: true }));
      };

      ws.onclose = () => {
        console.log("WebSocket закрыт.");
      };

      ws.onerror = (err) => console.log("Ошибка WS:", err);
    };

    const handleVisibilityChange = () => {
      clearVisibilityTimer();

      if (document.visibilityState === "visible") {
        console.log("Видимость: visible. Статус: online.");
        connectWebSocket();
      } else {
        console.log("Видимость: hidden. Статус: offline.");
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "online_status", online: false }));
        }

        visibilityTimerRef.current = setTimeout(() => {
          if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            wsRef.current.close();
          }
        }, INACTIVITY_TIMEOUT);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    connectWebSocket();

    const handleUnload = () => {
      clearVisibilityTimer();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleUnload);
      clearVisibilityTimer();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    };
  }, [accessToken]);
};
