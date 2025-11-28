import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import ReactInputMask from "react-input-mask";
import axios from "axios";

import Header from "@/features/Header/Header";
import { apiUrl } from "@/config/urls";
import toast from "react-hot-toast";

import { useAuth } from "@/hooks/AuthHook";

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { setTokens, dbReady } = useAuth();

    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (location.state?.phone) {
            setPhone(location.state.phone);
        }
    }, [location.state]);

    const handleSubmit = async (e) => {
        if (!dbReady) return;
        e.preventDefault();

        const cleanPhone = phone.replace(/\D/g, "");

        try {
            const response = await axios.post(`${apiUrl}/v1/accounts/login/`, {
                phone: cleanPhone,
                password,
            });

            const { access, refresh } = response.data.data;

            if (!access || !refresh) {
                toast.error("Ошибка при авторизации");
                return;
            }

            await setTokens(access, refresh);

            toast.success("Успешная авторизация!");

            navigate("/");

        } catch (err) {
            const error = err?.response?.data?.error;

            if (error === "Phone or password are incorrect.") {
                toast.error("Неверный телефон или пароль");
                return;
            }

            toast.error("Ошибка авторизации");
            console.error(err);
        }
    };

    return (
        <>
            <Header />
            <div className="registration-page">
                <h2 className="title">Вход</h2>

                <div className="content">
                    <form className="form" onSubmit={handleSubmit}>

                        <label className="field">
                            <div className="input-group phone-input">
                                <ReactInputMask
                                    mask="+7 (999) 999-99-99"
                                    placeholder="+7 (___) ___-__-__"
                                    className="input-field"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                            </div>
                        </label>

                        <label className="field">
                            <div className="input-group password-input">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Пароль"
                                    className="input-field"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <span
                                    className="eye-icon"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </span>
                            </div>
                        </label>

                        <button type="submit" className="submit-btn">
                            Войти
                        </button>

                        <p className="login-link">
                            Нет аккаунта? <Link to="/reg">Зарегистрироваться</Link>
                        </p>
                    </form>
                </div>
            </div>
        </>
    );
}
