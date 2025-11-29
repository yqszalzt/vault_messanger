from django.db import models

from accounts.models import Profile


class Chat(models.Model):
    user_1 = models.ForeignKey(Profile, related_name="user_1_profile", on_delete=models.SET_NULL, null=True, blank=True)
    user_2 = models.ForeignKey(Profile, related_name="user_2_profile", on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "чат"
        verbose_name_plural = "чаты"
    
    def get_opponent(self, profile):
        return self.user_1 if self.user_2 == profile else self.user_2


class Message(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE)
    user_from = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True)
    message_text = models.CharField()

    is_edit = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)