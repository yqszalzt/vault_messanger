import { useCallback, useState, useEffect } from "react";
import axios from "axios";
import { apiUrl } from "@/config/urls";

let dbInstance = null;
let dbInitialized = false;
let initPromise = null;

const initDB = () => {
  if (initPromise) return initPromise;
  
  initPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("AuthDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("tokens")) {
        db.createObjectStore("tokens", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInitialized = true;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject("IndexedDB error: " + event.target.error);
    };
  });

  return initPromise;
};

const getToken = async (db, key) => {
  return new Promise((resolve) => {
    const transaction = db.transaction("tokens", "readonly");
    const store = transaction.objectStore("tokens");
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null);
    };

    request.onerror = () => {
      resolve(null);
    };
  });
};

const setToken = async (db, key, value) => {
  return new Promise((resolve) => {
    const transaction = db.transaction("tokens", "readwrite");
    const store = transaction.objectStore("tokens");
    store.put({ id: key, value });
    transaction.oncomplete = () => {
      resolve();
    };
  });
};

const removeToken = async (db, key) => {
  return new Promise((resolve) => {
    const transaction = db.transaction("tokens", "readwrite");
    const store = transaction.objectStore("tokens");
    store.delete(key);
    transaction.oncomplete = () => {
      resolve();
    };
  });
};

export const useAuth = () => {
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dbReady, setDbReady] = useState(dbInitialized);

  useEffect(() => {
    if (!dbInitialized) {
      initDB()
        .then(() => {
          setDbReady(true);
          return Promise.all([
            getToken(dbInstance, "access"),
            getToken(dbInstance, "refresh"),
          ]);
        })
        .then(([access, refresh]) => {
          if (access) setAccessToken(access);
          if (refresh) setRefreshToken(refresh);
        })
        .catch(console.error);
    } else {
      Promise.all([
        getToken(dbInstance, "access"),
        getToken(dbInstance, "refresh"),
      ]).then(([access, refresh]) => {
        if (access) setAccessToken(access);
        if (refresh) setRefreshToken(refresh);
      });
    }
  }, []);

  const setTokens = useCallback(
    async (access, refresh) => {
      if (!dbInitialized) return;
      
      await Promise.all([
        setToken(dbInstance, "access", access),
        setToken(dbInstance, "refresh", refresh),
      ]);
      setAccessToken(access);
      setRefreshToken(refresh);
    },
    []
  );

  const logout = useCallback(async () => {
    if (!dbInitialized) return;
    
    await Promise.all([
      removeToken(dbInstance, "access"),
      removeToken(dbInstance, "refresh"),
    ]);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken || !dbInitialized) return null;

    try {
      const response = await axios.post(
        `${apiUrl}/v1/accounts/token/refresh/`,
        { refresh: refreshToken }
      );
      await setTokens(response.data.access, refreshToken);
      return response.data.access;
    } catch (err) {
      await logout();
      return null;
    }
  }, [refreshToken, setTokens, logout]);

  const authRequest = useCallback(
    async (method, url, data = null) => {
      if (!dbReady) {
        throw new Error("Database not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        let currentAccessToken = accessToken;
        
        if (!currentAccessToken) {
          currentAccessToken = await getToken(dbInstance, "access");
          if (currentAccessToken) {
            setAccessToken(currentAccessToken);
          }
        }

        let response = await axios({
          method,
          url,
          data,
          headers: { Authorization: `Bearer ${currentAccessToken}` },
        });

        return response.data;
      } catch (err) {
        if (err.response?.status === 401 && refreshToken) {
          const newAccessToken = await refreshAccessToken();
          if (!newAccessToken) throw new Error("Сессия истекла. Войдите снова.");

          const response = await axios({
            method,
            url,
            data,
            headers: { Authorization: `Bearer ${newAccessToken}` },
          });
          return response.data;
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, refreshToken, refreshAccessToken, dbReady]
  );

  useEffect(() => {
    if (!accessToken || !dbReady) return;
    const jwtExp = JSON.parse(atob(accessToken.split(".")[1])).exp * 1000;
    if (Date.now() > jwtExp) refreshAccessToken();
  }, [accessToken, refreshAccessToken, dbReady]);

  return { accessToken, refreshToken, isLoading, error, setTokens, logout, authRequest, dbReady };
};