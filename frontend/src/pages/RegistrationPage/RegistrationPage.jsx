import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import ReactInputMask from "react-input-mask";

import '#/css/RegLog/Registration.css';
import Header from "@/features/Header/Header";
import axios from "axios";
import { apiUrl } from "@/config/urls";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";


export default function RegistrationPage() {
    const navigate = useNavigate();

    const [showPassword, setShowPassword] = useState(false);
    const [showCheckPassword, setShowCheckPassword] = useState(false);

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [checkPassword, setCheckPassword] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== checkPassword) {
            toast.error("Пароли не совпадают!");
            return;
        }

        const cleanPhone = phone.replace(/\D/g, "");

        try {
            const response = await axios.post(`${apiUrl}/v1/accounts/registration/`, {
                fio: name,
                phone: cleanPhone,
                password
            });

            if (response.status === 201) {
                toast.success("Успешная регистрация. Пожалуйста, пройдите авторизацию");
                navigate("/login", { state: { phone } });
                return;
            }
        } catch (err) {
            const error = err?.response?.data?.error;

            if (error === "Phone number already used, try another one.") {
                toast.error("Номер телефона уже используется. Попробуйте другой");
                return;
            }

            toast.error("Ошибка при регистрации");
            console.error(err);
        }
    };

    return (
        <>
            <Header />
            <div className="registration-page">
                <h2 className="title">Регистрация</h2>
                <div className="content">
                    <form className="form" onSubmit={handleSubmit}>

                        <label className="field">
                            <div className="input-group">
                                <input
                                    type={"text"}
                                    placeholder="Ваше имя..."
                                    className="input-field"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    minLength="4"
                                    required
                                />
                            </div>
                        </label>

                        {/* Поле для Телефона */}
                        <label className="field">
                            <div className="input-group phone-input">
                                {/* <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/f/f3/Flag_of_Russia.svg" 
                                alt="Флаг России" 
                                className="flag" 
                            /> */}
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
                                    minLength="8"
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

                        <label className="field">
                            <div className="input-group password-input">
                                <input
                                    type={showCheckPassword ? "text" : "password"}
                                    placeholder="Повтор пароля"
                                    className="input-field"
                                    value={checkPassword}
                                    onChange={(e) => setCheckPassword(e.target.value)}
                                    minLength="8"
                                    required
                                />
                                <span
                                    className="eye-icon"
                                    onClick={() => setShowCheckPassword(!showCheckPassword)}
                                    title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                                >
                                    {showCheckPassword ? <FaEyeSlash /> : <FaEye />}
                                </span>
                            </div>
                        </label>

                        <button type="submit" className="submit-btn">
                            Зарегистрироваться
                        </button>

                        <p className="login-link">
                            Уже зарегистрированы? <Link to="/login">Войти</Link>
                        </p>

                    </form>
                </div>
            </div>
        </>
    );
}