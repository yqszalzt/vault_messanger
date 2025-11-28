import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Router from './router';
import { useOnlineStatus } from '@/hooks/OnlineStatusHook';
import { useMessagesSocket } from '@/hooks/MessagesHook';

const App = () => {
  useOnlineStatus();
  useMessagesSocket();
  
  return (
    <BrowserRouter>
      <Router />
      <Toaster position="top-right"
        reverseOrder={false} />
    </BrowserRouter>
  );
};

export default App;

