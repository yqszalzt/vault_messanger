import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FaSearch } from 'react-icons/fa';
import { useAuth } from '@/hooks/AuthHook';
import { Link } from 'react-router-dom';

import '#/css/Header.css';
import logo from '#/img/logo/logo-blue.svg';
import { apiUrl } from '@/config/urls';

export default function Header() {
    const [profileData, setProfileData] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    const searchTimeout = useRef(null);
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    const { accessToken, dbReady, authRequest, logout } = useAuth();

    useEffect(() => {
        if (!accessToken || !dbReady) return;

        const fetchProfile = async () => {
            try {
                const response = await authRequest('GET', `${apiUrl}/v1/accounts/profile/`);
                if (response.status === 200) {
                    setProfileData(response?.data);
                }
            } catch (err) {
                console.log(err);
            }
        };
        fetchProfile();
    }, [accessToken, dbReady, authRequest]);

    const fetchSearchResults = useCallback(async (query) => {
        if (query.trim().length < 2) {
            setSearchResults([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const response = await authRequest('POST', `${apiUrl}/v1/accounts/search/`, {
                query: query.trim(),
            });

            if (response.status === 200) {
                setSearchResults(response?.data || []);
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error('Ошибка при поиске:', err);
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [authRequest]);

    const handleSearchChange = (event) => {
        const query = event.target.value;
        setSearchQuery(query);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            fetchSearchResults(query);
        }, 300);
    };

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    // =============================
    //  Клик вне — скрываем дропдаун + мобильный поиск
    // =============================
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(e.target)
            ) {
                setSearchQuery('');
                setSearchResults([]);
                setIsMobileSearchOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showDropdown =
        searchQuery.length >= 2 &&
        (searchResults.length > 0 || isLoading || (!isLoading && searchResults.length === 0));

    return (
        <header className={`main-header ${isMobileSearchOpen ? 'mobile-active' : ''}`}>
            <div className='container'>

                {!isMobileSearchOpen && (
                    <Link to="/" className="header-logo">
                        <img src={logo} alt="vault" />
                    </Link>
                )}
                <div
                    className={`search-input-container ${isMobileSearchOpen ? 'mobile-open' : ''}`}
                    ref={searchInputRef}
                >
                    <FaSearch className='search-icon' />

                    <input
                        type="text"
                        placeholder="Поиск пользователей..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className='search-input-field'
                        autoFocus={isMobileSearchOpen}
                    />

                    {showDropdown && (
                        <div className='search-results-dropdown' ref={dropdownRef}>
                            {isLoading && (
                                <div className='search-loading'>Загрузка...</div>
                            )}

                            {!isLoading && searchResults.length === 0 && (
                                <div className='search-no-results'>Пользователи не найдены.</div>
                            )}

                            {!isLoading &&
                                searchResults.map(user => (
                                    <Link
                                        to={`/profile/${user.id}`}
                                        key={user.id}
                                        className='search-result-item'
                                    >
                                        <div className="search-result-avatar-wrapper">
                                            <img
                                                src={user.avatar}
                                                alt={user.username}
                                                className="search-result-avatar"
                                            />
                                            {user.online_status && (
                                                <div className="online-indicator search-indicator"></div>
                                            )}
                                        </div>

                                        <div className='search-result-info'>
                                            <div className='search-result-username'>{user.fio}</div>
                                            {user.username && (
                                                <div className='search-result-fio'>@{user.username}</div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                        </div>
                    )}
                </div>

                <div className='search-and-avatar'>
                    {!isMobileSearchOpen && (
                        <FaSearch
                            className="mobile-search-icon"
                            onClick={() => setIsMobileSearchOpen(true)}
                        />
                    )}

                    {accessToken && (
                        <div className="header-actions">
                            <Link to="/me" className="profile-link">
                                <img
                                    src={profileData?.avatar}
                                    alt={profileData?.username}
                                    className="profile-avatar"
                                />
                            </Link>
                        </div>
                    )}
                </div>
            </div>
            {isMobileSearchOpen && (
                <div
                    className="mobile-search-overlay"
                    onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setIsMobileSearchOpen(false);
                    }}
                />
            )}
        </header>
    );
}
