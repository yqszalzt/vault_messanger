import React from "react";

import '#/css/MainPage.css';
import Header from "@/features/Header/Header";
import MessagesList from "@/features/MessagesList/MessagesList";


export default function MainPage() {
    return (
        <>
            <Header />
            <div className="container">
                <MessagesList />
            </div>
        </>
    )
}