import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";

import '#/css/ProfilePage.css';
import { useAuth } from "@/hooks/AuthHook";
import { apiUrl } from "@/config/urls";
import Header from "@/features/Header/Header";
import { declension, formatLastOnline } from "@/utils/ProfilePageUtils";


const Icons = {
    User: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    AtSign: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>,
    Info: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
    Mail: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
};

export default function ProfilePage() {
    const [profileData, setProfileData] = useState({});
    const [formData, setFormData] = useState({});
    const { accessToken, authRequest, dbReady, logout } = useAuth();
    const saveTimerRef = useRef(null);
    const [isMounted, setIsMounted] = useState(false);

    const bioRef = useRef(null); 

    const handleSaveProfile = async (fieldsToUpdate) => {
        if (!Object.keys(fieldsToUpdate).length) return;
        
        try {
            const response = await authRequest('PATCH', `${apiUrl}/v1/accounts/profile/`, fieldsToUpdate);
            if (response.status === 200) {
                setProfileData(response?.data);
                setFormData(response?.data);
                
                toast.success("Профиль сохранен!", {
                    autoClose: 2000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    theme: "light",
                });
            }
        } catch (err) {
            console.error("Save error:", err);
            toast.error("Ошибка сохранения");
        }
    };

    useEffect(() => {
        setIsMounted(true);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (bioRef.current && formData.bio !== undefined) {
            bioRef.current.style.height = 'auto';
            bioRef.current.style.height = bioRef.current.scrollHeight + 'px';
        }
    }, [formData.bio]); 

    useEffect(() => {
        if (!Object.keys(profileData).length) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        const fieldsToUpdate = {};
        let isChanged = false;
        
        const editableKeys = ['fio', 'username', 'bio', 'email'];

        editableKeys.forEach(key => {
            
            const formValue = formData[key] === null || formData[key] === undefined ? '' : String(formData[key]);
            const profileValue = profileData[key] === null || profileData[key] === undefined ? '' : String(profileData[key]);

            if (formValue !== profileValue) {
                
                if (profileData[key] === null && formValue === '' && !isMounted) {
                    return; 
                }

                if (key === 'fio' && formValue === '') {
                    fieldsToUpdate[key] = ""; 
                } 
                else {
                    fieldsToUpdate[key] = formData[key];
                }
                
                isChanged = true;
            }
        });

        if (!isChanged) return;

        saveTimerRef.current = setTimeout(() => {
            handleSaveProfile(fieldsToUpdate);
        }, 2000); 

        return () => clearTimeout(saveTimerRef.current);
    }, [formData, profileData]); 

    useEffect(() => {
        if (!accessToken || !dbReady) return;
        const fetchProfile = async () => {
            try {
                const response = await authRequest('GET', `${apiUrl}/v1/accounts/profile/`);
                if (response.status === 200) {
                    setProfileData(response?.data);
                    setFormData(response?.data);
                }
            } catch (err) { console.log(err); }
        };
        fetchProfile();
    }, [accessToken, dbReady, authRequest]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isOnline = true; 
    
    const statusText = isOnline 
        ? 'в сети' 
        : formatLastOnline(profileData?.last_online);

    return (
        <>
            <Header />
            <div className="profile-page">
                <div className="profile-card">
                    <div className="card-header">
                        <div className="avatar-wrapper">
                            <img 
                                src={profileData?.avatar || 'https://via.placeholder.com/200'} 
                                alt="avatar" 
                            />
                        </div>
                        
                        <div className="user-intro">
                            <input
                                type="text"
                                name="fio"
                                className="name-input"
                                placeholder="Ваше Имя"
                                value={formData.fio || ''}
                                onChange={handleInputChange}
                                autoComplete="off"
                                maxLength={256}
                            />
                            <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
                                {statusText}
                            </span>
                        </div>
                    </div>

                    <div className="details-list">
                        
                        <div className="list-item">
                            <div className="item-icon"><Icons.AtSign /></div>
                            <div className="item-content">
                                <label>Имя пользователя</label>
                                <input
                                    type="text"
                                    name="username"
                                    placeholder="Username"
                                    value={formData.username || ''}
                                    onChange={handleInputChange}
                                    maxLength={25}
                                />
                            </div>
                        </div>

                        <div className="list-item">
                            <div className="item-icon"><Icons.Info /></div>
                            <div className="item-content">
                                <label>О себе</label>
                                <textarea
                                    ref={bioRef}
                                    name="bio"
                                    placeholder="Напишите немного о себе..."
                                    value={formData.bio || ''}
                                    onChange={handleInputChange}
                                    maxLength={100}
                                    onInput={(e) => {
                                        e.target.style.height = "auto";
                                        e.target.style.height = e.target.scrollHeight + "px";
                                    }}
                                />
                            </div>
                        </div>

                         <div className="list-item">
                            <div className="item-icon"><Icons.Mail /></div>
                            <div className="item-content">
                                <label>Почта</label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="example@mail.com"
                                    value={formData.email || ''}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}