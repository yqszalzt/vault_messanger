import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import re_path
from accounts.consumers import OnlineStatusConsumer
from msg_app.consumers import MessagesConsumer

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter([
            re_path(r'ws/online_status/$', OnlineStatusConsumer.as_asgi()),
            re_path(r'ws/messages/$', MessagesConsumer.as_asgi()),
        ])
    ),
})