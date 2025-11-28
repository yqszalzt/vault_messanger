from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Message
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .serializers import MessageSerializer

@receiver(post_save, sender=Message)
def notify_new_message(sender, instance, created, **kwargs):
    if not created:
        return

    chat = instance.chat
    from_user = instance.user_from
    to_user = chat.user_1 if chat.user_2 == from_user else chat.user_2

    message_data = MessageSerializer(instance).data

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{to_user.user.id}",
        {
            "type": "new_message",
            "message": message_data
        }
    )
