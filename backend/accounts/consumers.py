from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
import jwt
from django.conf import settings
from django.contrib.auth.models import User
from accounts.models import Profile 

class OnlineStatusConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.token = self.scope['query_string'].decode().split('token=')[-1]

        self.user = await self.get_user_from_token(self.token)
        if not self.user:
            await self.close()
            return

        self.profile = await self.get_profile(self.user)
        if not self.profile:
            await self.close()
            return

        await self.set_online(self.profile)

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'profile') and self.profile:
            await self.set_offline(self.profile)

    async def receive(self, text_data=None, bytes_data=None):
        pass

    @database_sync_to_async
    def get_user_from_token(self, token):
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            return User.objects.get(id=payload['user_id'])
        except Exception:
            return None

    @database_sync_to_async
    def get_profile(self, user):
        try:
            return Profile.objects.get(user=user)
        except Profile.DoesNotExist:
            return None

    @database_sync_to_async
    def set_online(self, profile):
        profile.online_status = True
        profile.save(update_fields=['online_status'])

    @database_sync_to_async
    def set_offline(self, profile):
        profile.online_status = False
        profile.last_online = timezone.now()
        profile.save(update_fields=['online_status', 'last_online'])
