from rest_framework import serializers
from django.db.models import Q

from accounts.models import Profile
from .models import Chat, Message

from accounts.serializers import UserProfileSerializer


class MessageSerializer(serializers.ModelSerializer):
    user_from = UserProfileSerializer(read_only=True)

    class Meta:
        model = Message
        fields = "__all__"


class ChatSerializer(serializers.ModelSerializer):
    user_1 = UserProfileSerializer(read_only=True)
    user_2 = UserProfileSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = "__all__"

    def get_fields(self):
        fields = super().get_fields()
        for field_name, field in fields.items():
            # если это вложенный сериализатор, передаем context
            if isinstance(field, serializers.BaseSerializer):
                field.context.update(self.context)
        return fields

    def get_last_message(self, obj):
        last_msg = Message.objects.filter(chat=obj).order_by('-created_at').first()
        if last_msg:
            return MessageSerializer(last_msg, context={"request": self.context["request"]}).data
        return None
    

class ChatCreateSerializer(serializers.Serializer):
    user = serializers.IntegerField()

    def validate_user(self, value):
        try:
            user = Profile.objects.get(id=value)
        except Profile.DoesNotExist:
            raise serializers.ValidationError({"error": "Profile is undefined"})

        return value