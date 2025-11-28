from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import json
from .models import Chat, Message
from accounts.models import Profile

class MessagesConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        token = self.scope['query_string'].decode().split('token=')[-1]
        self.user = await self.get_user_from_token(token)

        if not self.user:
            await self.close()
            return

        # --- Всегда работаем через Profile ---
        self.profile = await self.get_profile(self.user)
        if not self.profile:
            await self.close()
            return

        # Группы теперь привязываются к профилю
        self.user_group_name = f"profile_{self.profile.id}"
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if data.get("type") == "message_create":
            text = data.get("text")
            to_chat = data.get("to_chat")

            if not text or not to_chat:
                return

            chat = await self.get_chat(to_chat)
            if not chat:
                return

            message = await self.create_message(text, self.profile, chat)
            profile_data = await self.serialize_profile(self.profile)
            # --- Отправляем себе ---
            await self.send(text_data=json.dumps({
                "type": "create_message",
                "message": {
                    "id": message.id,
                    "chat_id": chat.id,
                    "message_text": message.message_text,
                    "from_user_id": self.profile.id,
                    "user_from": profile_data
                }
            }))

            # --- Отправляем оппоненту ---
            opponent = chat.get_opponent(self.profile)
            await self.channel_layer.group_send(
                f"profile_{opponent.id}",
                {
                    "type": "new_message",
                    "message": {
                        "id": message.id,
                        "chat_id": chat.id,
                        "message_text": message.message_text,
                        "from_user_id": self.profile.id,
                        "user_from": profile_data
                    }
                }
            )

    async def new_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "new_message",
            "message": event["message"]
        }))

    @database_sync_to_async
    def get_user_from_token(self, token):
        import jwt
        from django.conf import settings
        from django.contrib.auth.models import User
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            return User.objects.get(id=payload['user_id'])
        except Exception:
            return None

    @database_sync_to_async
    def get_profile(self, user):
        return Profile.objects.filter(user=user).first()

    @database_sync_to_async
    def get_chat(self, chat_id):
        return Chat.objects.filter(id=chat_id).first()

    @database_sync_to_async
    def create_message(self, message_text, user_from, chat):
        return Message.objects.create(
            chat=chat,
            user_from=user_from,
            message_text=message_text
        )

    @database_sync_to_async
    def serialize_profile(self, profile):
        from accounts.serializers import UserProfileSerializer
        return UserProfileSerializer(profile).data