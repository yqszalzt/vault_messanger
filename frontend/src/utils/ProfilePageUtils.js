export const declension = (number, titles) => {
    const cases = [2, 0, 1, 1, 1, 2];
    if (number % 100 > 4 && number % 100 < 20) return titles[2];
    if (number % 10 < 5) return titles[cases[number % 10]];
    return titles[2];
};

export const formatLastOnline = (lastOnlineTimestamp) => {
    if (!lastOnlineTimestamp) return "был(а) недавно";
    
    const now = new Date();
    const lastOnline = new Date(lastOnlineTimestamp);
    
    const diffSeconds = Math.floor((now - lastOnline) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) {
        return "был(а) только что";
    }
    
    if (diffHours < 1) {
        return `был(а) ${diffMinutes} минут${declension(diffMinutes, ['а', 'ы', ''])} назад`;
    }
    
    if (diffDays < 1) {
        return `был(а) ${diffHours} час${declension(diffHours, ['', 'а', 'ов'])} назад`;
    }
    
    if (diffDays < 7) {
        return `был(а) ${diffDays} д${declension(diffDays, ['ень', 'ня', 'ней'])} назад`;
    }

    return lastOnline.toLocaleDateString();
};