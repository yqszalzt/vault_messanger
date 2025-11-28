import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainPage from '@/pages/MainPage/MainPage';
import RegistrationPage from '@/pages/RegistrationPage/RegistrationPage';
import LoginPage from '@/pages/LoginPage/LoginPage';
import ProfilePage from '@/pages/ProfilePage/ProfilePage';
import OtherProfilePage from '@/pages/OtherProfilePage/OtherProfilePage';


const Router = () => {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      
      <Route path="/reg" element={<RegistrationPage />} />
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/me" element={<ProfilePage />} />
      <Route path="/profile/:userId" element={<OtherProfilePage />} />
    </Routes>
  );
};

export default Router;

