import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom"; // Предполагаем использование React Router
import toast from "react-hot-toast";

import '#/css/ProfilePage.css';
import { useAuth } from "@/hooks/AuthHook";
import { apiUrl } from "@/config/urls";
import Header from "@/features/Header/Header";
import { formatLastOnline } from "@/utils/ProfilePageUtils";
import axios from "axios";


const Icons = {
    User: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    AtSign: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>,
    Info: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
    Mail: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
    Send: (props) => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
};

export default function OtherProfilePage() {
    const { userId } = useParams();
    const navigate = useNavigate();

    const { accessToken, authRequest, dbReady, user, logout } = useAuth();

    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!accessToken || !dbReady) return;

        const requestedUserId = String(userId);
        const currentUserId = String(user?.id);

        if (requestedUserId === currentUserId) {
            console.log("Redirecting to /me (self-profile)");
            navigate('/me', { replace: true });
            return;
        }

        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                const response = await axios.get(`${apiUrl}/v1/accounts/uprofile/?user=${requestedUserId}`);

                if (response.status === 200) {
                    setProfileData(response?.data.data);
                    console.log(response.data.data)
                } else {
                    toast.error("Профиль не найден или доступ ограничен.");
                }
            } catch (err) {
                console.error(err);
                toast.error("Ошибка при загрузке профиля.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, [accessToken, dbReady, authRequest, userId, user, navigate]);

    if (isLoading || profileData === null) {
        return <Header />;
    }

    const isOnline = profileData?.online_status;

    const statusText = isOnline
        ? 'в сети'
        : formatLastOnline(profileData?.last_online);

    const startChat = async (e) => {
        e.preventDefault();
        if (!accessToken || !dbReady) return;

        try {
            // Создаём чат или получаем существующий
            const response = await authRequest(
                'post',
                `${apiUrl}/v1/msg/chat/?action=create`,
                { user: profileData.id }
            );

            if (response.status === 200) {
                const chatId = response.data.id;

                // Переходим на главную с state
                navigate('/', { state: { chatId } });
            } else {
                toast.error('Не удалось создать чат');
            }
        } catch (err) {
            console.error(err);
            toast.error('Ошибка при создании чата');
        }
    };


    return (
        <>
            <Header />
            <div className="profile-page other-profile-page">
                <div className="profile-card">
                    <div className="card-header">
                        <div className="avatar-wrapper">
                            <img
                                src={profileData?.avatar || 'https://via.placeholder.com/200'}
                                alt="avatar"
                            />
                            {isOnline && <span className="online-indicator" />}
                        </div>

                        <div className="user-intro">
                            <div className="name-display">
                                {profileData.fio || 'Пользователь'}
                            </div>

                            <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
                                {statusText}
                            </span>
                        </div>

                        <div className="actions">
                            <Link to="#" className="message-btn" onClick={startChat}>
                                <Icons.Send style={{ width: '1.25em', height: '1.25em' }} />
                                Написать
                            </Link>
                        </div>
                    </div>

                    <div className="details-list">

                        <div className="list-item">
                            <div className="item-icon"><Icons.AtSign /></div>
                            <div className="item-content">
                                <label>Имя пользователя</label>
                                <div className="display-text">
                                    {profileData.username || '—'}
                                </div>
                            </div>
                        </div>

                        <div className="list-item">
                            <div className="item-icon"><Icons.Info /></div>
                            <div className="item-content">
                                <label>О себе</label>
                                <div className="display-text bio-text">
                                    {profileData.bio || '—'}
                                </div>
                            </div>
                        </div>

                        <div className="list-item">
                            <div className="item-icon"><Icons.Mail /></div>
                            <div className="item-content">
                                <label>Почта</label>
                                <div className="display-text">
                                    {profileData.email || '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}