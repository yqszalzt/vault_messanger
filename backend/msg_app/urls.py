from django.urls import path

from .views import ChatView, MessageView


urlpatterns = [
    path('chat/', ChatView.as_view()),
    path('messages/', MessageView.as_view())
]