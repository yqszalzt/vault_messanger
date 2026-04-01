# Vault Messenger

Мессенджер на Django Channels + React. Весь реалтайм — через WebSocket, без поллинга.

---

## Стек

| Слой | Технология |
|---|---|
| Backend | Django 5 + Django REST Framework |
| Реалтайм | Django Channels + Daphne (ASGI) |
| БД | PostgreSQL (+ `pg_trgm` для поиска) |
| Аутентификация | JWT (SimpleJWT) |
| Frontend | React + React Router |
| Пакетный менеджер | uv (Python 3.11) |

---

## Структура проекта

```
vault_messanger/
├── backend/
│   ├── accounts/          # Профили, авторизация, онлайн-статус, поиск
│   │   ├── consumers.py   # WS: OnlineStatusConsumer
│   │   └── utils.py       # Генерация аватарок (Pillow)
│   ├── msg_app/           # Чаты, сообщения
│   │   ├── consumers.py   # WS: MessagesConsumer
│   │   └── views.py       # REST: ChatView, MessageView
│   └── backend/           # settings, urls, asgi
└── frontend/
    └── src/
        ├── hooks/
        │   ├── OnlineStatusHook.js   # WS онлайн-статуса
        │   └── MessagesHook.js       # WS сообщений
        └── features/
            └── MessagesList/         # Основной UI мессенджера
```

---

## WebSocket — два соединения

Клиент держит два независимых WS-соединения. Оба аутентифицируются через JWT в query string.

### `/online_status/?token=<jwt>`

Управляет присутствием пользователя.

- **Connect** → `profile.online_status = True`
- **Disconnect** → `online_status = False`, `last_online = now()`

Фронт отслеживает `document.visibilityState`: при скрытии вкладки через 5 секунд сокет закрывается и пользователь уходит в оффлайн. При возврате — соединение восстанавливается автоматически. На `beforeunload` сокет закрывается немедленно.

### `/messages/?token=<jwt>`

Основной канал. Каждый подключённый пользователь состоит в группе `profile_{id}`.

| Событие (клиент → сервер) | Описание |
|---|---|
| `message_create` | Отправить сообщение в чат |
| `edit_message` | Редактировать сообщение по `message_id` |
| `delete_message` | Удалить сообщение по `message_id` |
| `messages_read` | Пометить список сообщений прочитанными |

| Событие (сервер → клиент) | Описание |
|---|---|
| `create_message` | Подтверждение отправки отправителю |
| `new_message` | Входящее сообщение получателю |
| `edit_message_success` / `edit_message_event` | Подтверждение + уведомление оппоненту |
| `delete_message_success` / `delete_message_event` | Подтверждение + уведомление оппоненту |
| `messages_read` | Уведомление о прочтении |
| `new_chat` | Новый чат появился у обоих участников |

---

## Функциональность в режиме реального времени

### Отправка сообщений

Сообщения отправляются напрямую через WS (не REST). Сервер сохраняет в БД и одновременно рассылает через `channel_layer.group_send`: отправитель получает `create_message`, получатель — `new_message`. Оба видят сообщение без перезагрузки страницы.

### Редактирование и удаление

Контекстное меню на сообщении (ПКМ). Доступные действия: **Ответить**, **Копировать**, **Изменить**, **Удалить**. Изменение и удаление летят через WS и мгновенно применяются у обоих участников. Отредактированное сообщение помечается тегом `ред.`.

### Прочитанность

При открытии чата фронт автоматически отправляет `messages_read` со списком id. Бэк делает `Message.objects.filter(id__in=...).update(is_read=True)` и уведомляет оппонента. В сайдбаре у непрочитанных чатов отображается синий бейдж с числом — сбрасывается при открытии чата.

### Toast-уведомления

Если сообщение пришло в чат, который сейчас не открыт — всплывает уведомление вида `Алексей: текст сообщения`. Чат с новым сообщением сразу всплывает наверх в сайдбаре.

### Создание чата

`POST /api/v1/msg/chat/?action=create`. После создания сервер делает `group_send` обоим участникам — новый чат появляется в сайдбаре у каждого без перезагрузки. Повторное создание чата между теми же пользователями возвращает существующий.

### Онлайн-статус

В шапке открытого чата: **в сети** (синим) или **был(а) N минут назад**. Данные из полей `online_status` и `last_online` профиля, которые обновляет `OnlineStatusConsumer`.

---

## Поиск пользователей

`POST /api/v1/accounts/search/` — полнотекстовый поиск с триграммами.

```python
Profile.objects
    .annotate(
        vector=SearchVector('username', 'fio'),
        trigram_username=TrigramSimilarity('username', query),
        trigram_fio=TrigramSimilarity('fio', query),
    )
    .annotate(
        rank=SearchRank(F('vector'), SearchQuery(query))
             + F('trigram_username')
             + F('trigram_fio')
    )
    .filter(rank__gt=0.1)
    .order_by('-rank')
```

Ищет по `username` и `fio`. Опечатки и неточные запросы обрабатываются — поиск толерантен к ошибкам за счёт триграмм (`pg_trgm`).

Расширение инициализируется при старте PostgreSQL:

```sql
-- postgres/init_pg.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## Авто-генерация аватарок

При регистрации без аватара сервер генерирует его через Pillow:

1. Берёт инициалы из ФИО
2. Выбирает случайную градиентную палитру (20 вариантов)
3. Рисует вертикальный градиент + инициалы шрифтом Geologica Bold по центру
4. Сохраняет как PNG и подвязывает к профилю

---

## API

Все endpoints требуют заголовок `Authorization: Bearer <access_token>`, кроме `/login/` и `/registration/`.

### Accounts (`/api/v1/accounts/`)

| Метод | URL | Auth | Описание |
|---|---|---|---|
| POST | `login/` | — | Вход по телефону + паролю, возвращает JWT |
| POST | `registration/` | — | Регистрация |
| GET | `profile/` | ✓ | Свой профиль |
| GET | `profile/?user=<id>` | ✓ | Профиль другого пользователя |
| PATCH | `profile/` | ✓ | Редактирование профиля |
| PATCH | `user-act/` | ✓ | Смена пароля |
| POST | `search/` | — | Поиск пользователей |

### Messages (`/api/v1/msg/`)

| Метод | URL | Auth | Описание |
|---|---|---|---|
| GET | `chat/?ac=true` | ✓ | Все чаты (отсортированы по последнему сообщению) |
| POST | `chat/?action=create` | ✓ | Создать чат с пользователем |
| GET | `messages/?chat=<id>` | ✓ | История сообщений чата |

---

## Модели

### `Profile`
```
user          OneToOneField(User)
email         EmailField (unique, nullable)
phone         CharField (unique) — используется как логин
username      CharField (unique, nullable)
fio           CharField
avatar        ImageField — авто-генерируется при регистрации
bio           TextField (max 100)
online_status BooleanField
last_online   DateTimeField
```

### `Chat`
```
user_1      ForeignKey(Profile)
user_2      ForeignKey(Profile)
is_active   BooleanField
```

### `Message`
```
chat          ForeignKey(Chat)
user_from     ForeignKey(Profile)
message_text  CharField
is_edit       BooleanField
is_read       BooleanField
created_at    DateTimeField
```

---

## UI — детали

- **Ресайз сайдбара** мышью (от 200 до 700px). При ширине < 240px — компактный режим: только аватарки без имён.
- **Мобильная адаптация**: при открытом чате сайдбар скрывается, появляется кнопка «Назад».
- **Закрытие** чата и контекстного меню по `Escape`.
- **Отправка** сообщения по `Enter`.
- **Клик по аватарке** в шапке открытого чата ведёт на профиль собеседника.
- **Сортировка чатов** живая — при новом сообщении чат мгновенно всплывает наверх.

---

## Запуск

```bash
# Backend
cd backend
uv sync
uv run manage.py migrate
uv run manage.py createsuperuser
uv run daphne backend.asgi:application --port 8000

# Frontend
cd frontend
npm install
npm start
```

Переменные окружения — `backend/.env` (см. `.env.example`).

| Переменная | Описание |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` | PostgreSQL |
| `DEBUG` | `True` / `False` |
