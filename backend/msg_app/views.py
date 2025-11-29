from rest_framework import status
from django.shortcuts import get_object_or_404, get_list_or_404
from django.db.models import OuterRef, Subquery, DateTimeField, Q
from django.db.models.functions import Coalesce
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from accounts.responses import SuccessResponse, ErrorResponse
from accounts.views import AuthenticateView
from accounts.models import Profile

from .models import Chat, Message
from .serializers import ChatSerializer, ChatCreateSerializer, MessageSerializer


class ChatView(AuthenticateView):

    """
    
    Работа с чатами.
    Создание нового чата, просмотр всех сообщений из чата

    """
    
    def get(self, request):
        __param_get_all_chats = request.GET.get("ac", None)
        if __param_get_all_chats:
            profile = get_object_or_404(Profile, user=request.user)

            last_msg_subquery = Message.objects.filter(
                chat=OuterRef('pk')
            ).order_by('-created_at').values('created_at')[:1]

            chats = Chat.objects.filter(
                Q(user_1=profile) | Q(user_2=profile)
            ).annotate(
                last_msg_time=Subquery(last_msg_subquery, output_field=DateTimeField())
            ).order_by(
                Coalesce('last_msg_time', 'created_at').desc()
            )

            return SuccessResponse(
                ChatSerializer(chats, many=True, context={"request": request}).data,
                status=status.HTTP_200_OK
            )
    
    def post(self, request):
        """
        action:
            create - создаёт переписку между пользователями
        """
        __param_action = request.GET.get("action", None)
        if not __param_action in ["create"]:
            return ErrorResponse({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        
        this_user=get_object_or_404(Profile, user=request.user)

        match __param_action:
            case 'create':
                serializer = ChatCreateSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)

                # профиль второго юзера
                user_2=get_object_or_404(Profile, id=serializer.validated_data.get("user"))

                # проверка на уже имеющийся чат
                chat = Chat.objects.filter(
                    (Q(user_1=this_user) & Q(user_2=user_2)) | (Q(user_1=user_2) & Q(user_2=this_user))
                ).first()
                if chat:
                    return SuccessResponse(ChatSerializer(chat, context={"request": request}).data, status=status.HTTP_200_OK)

                chat = Chat.objects.create(
                    user_1=this_user,
                    user_2=user_2,
                    is_active=True
                )
                chat.save()

                channel_layer = get_channel_layer()
                chat_data = ChatSerializer(chat, context={"request": request}).data
                
                payload = {
                    "type": "new_chat",
                    "chat": chat_data,
                }
                
                async_to_sync(channel_layer.group_send)(
                    f"profile_{this_user.id}",
                    {
                        "type": "new_chat_event",
                        "payload": payload
                    }
                )
                
                async_to_sync(channel_layer.group_send)(
                    f"profile_{user_2.id}",
                    {
                        "type": "new_chat_event",
                        "payload": payload
                    }
                )

                return SuccessResponse(ChatSerializer(chat, context={"request": request}).data, status=status.HTTP_200_OK)
            

class MessageView(AuthenticateView):

    def get(self, request):
        """
        1) Возвращает все сообщения из выбранного чата
        """

        __param_chat_id = request.GET.get("chat", None)
        if __param_chat_id:
            chat = get_object_or_404(Chat, id=__param_chat_id)
            messages = Message.objects.filter(chat=chat)
            serializer = MessageSerializer(messages, many=True, context={"request": request})
            return SuccessResponse(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        pass