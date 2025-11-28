from django.apps import AppConfig


class MsgApConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'msg_app'

    def ready(self):
        from . import signals
        return super().ready()