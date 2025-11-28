from django.utils import timezone

from django.core.files.base import ContentFile
from django.utils.crypto import get_random_string
from django.db import models
from django.contrib.auth.models import User
from .utils import generate_avatar

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    email = models.EmailField(blank=True, unique=True, verbose_name='Почта', null=True)
    phone = models.CharField(max_length=15, verbose_name='Телефон', blank=False, unique=True)

    username = models.CharField(max_length=25, unique=True, blank=True, null=True)
    fio = models.CharField(max_length=256, verbose_name='ФИО', blank=False)
    avatar = models.ImageField(upload_to='users/avatar/', null=True, blank=True)
    bio = models.TextField(null=True, blank=True, max_length=100)
    online_status = models.BooleanField(default=False)
    last_online = models.DateTimeField(
        verbose_name="Последний онлайн",
        default=timezone.now,
        null=True,
        blank=True
    )

    def save(self, *args, **kwargs):
        if self.phone and not str(self.phone).startswith('+'):
            self.phone = '+' + self.phone

        if not self.pk and not self.avatar:
            try:
                avatar_file = generate_avatar(self.fio)
                file_name = f"{self.fio}_avatar_{get_random_string(8)}.png"
                self.avatar.save(file_name, ContentFile(avatar_file.read()), save=False)
            except Exception as e:
                print("Ошибка генерации аватарки:", e)

        if self.online_status:
            self.last_online = None
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.fio} - {self.user.username}'
    
    class Meta:
        verbose_name = 'Профиль'
        verbose_name_plural = 'Профили'
