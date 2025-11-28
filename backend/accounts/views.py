from rest_framework.views import APIView, Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.postgres.search import SearchVector, SearchQuery, TrigramSimilarity, SearchRank
from django.db.models import F, FloatField

from .serializers import *
from .exceptions import *
from .responses import SuccessResponse, ErrorResponse


class AuthenticateView(APIView):
    permission_classes = [IsAuthenticated]


class LoginView(APIView):
    """
    Авторизация пользователя
    """

    permission_classes = [AllowAny]
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            username = serializer.validated_data['phone']
            password = serializer.validated_data['password']

            user = authenticate(username=username, password=password)

            if user:
                refresh = RefreshToken.for_user(user)
                return SuccessResponse({
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                })
            else:
                return ErrorResponse('Phone or password are incorrect.', status=status.HTTP_401_UNAUTHORIZED)


class RegisterView(APIView):
    """
    Регистрация пользователя
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            serializer.save(serializer.validated_data)
            return Response({'status': status.HTTP_200_OK, 'detail': "User successfully registered, please, log in"}, status=status.HTTP_201_CREATED)
        except serializers.ValidationError as e:
            return ErrorResponse(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return ErrorResponse(str(e), status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProfileView(AuthenticateView):
    """
    Профиль пользователя и действия с ним
    """
    def get(self, request):
        try:
            __param_user_id = request.GET.get("user", None)
            if __param_user_id:
                try:
                    profile = Profile.objects.get(id=__param_user_id)
                except Profile.DoesNotExist:
                    return ErrorResponse({"error": "Profile not found."}, status=404) 
                
                return SuccessResponse(UserProfileSerializer(profile, context={"request": request}).data, status=status.HTTP_200_OK)
            profile = Profile.objects.get(user=request.user)
            serializer = UserProfileSerializer(profile, context={"request": request})
            return Response({"status": status.HTTP_200_OK, "data": serializer.data}, status=status.HTTP_200_OK)
        except Profile.DoesNotExist:
            return Response({"error": "Profile not found."}, status=404)

    def patch(self, request):
        try:
            profile = Profile.objects.get(user=request.user)
            serializer = UserProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
            
            if serializer.is_valid(raise_exception=True):
                if 'email' in serializer.validated_data:
                    return ErrorResponse("User cant edit email field. Ask admins", status=status.HTTP_403_FORBIDDEN)
                serializer.save()
                return SuccessResponse(serializer.data)
        except Profile.DoesNotExist:
            return ErrorResponse('Profile not found.', status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return ErrorResponse(str(e), status=status.HTTP_400_BAD_REQUEST)


class OtherUserProfileView(APIView):
    """
    Отдача данных о других пользователях
    """
    def get(self, request):
        __param_user_id = request.GET.get("user", None)
        if __param_user_id:
            try:
                profile = Profile.objects.get(id=__param_user_id)
            except Profile.DoesNotExist:
                return ErrorResponse({"error": "Profile not found."}, status=404) 
            
            return SuccessResponse(UserProfileSerializer(profile, context={"request": request}).data, status=status.HTTP_200_OK)


class UserView(AuthenticateView):
    """
    Аккаунты пользователей, смена паролей, почт.
    """

    def patch(self, request):
        try:
            serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return SuccessResponse('Password changed successfully.', status=status.HTTP_200_OK)
        except ValidationError as e:
            error_messages = []
            if 'non_field_errors' in e.detail:
                error_messages.extend(e.detail['non_field_errors'])
            for field, messages in e.detail.items():
                if field != 'non_field_errors':
                    error_messages.extend(messages)
            error_message_str = ', '.join(str(msg) for msg in error_messages)
            return ErrorResponse(error_message_str, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(AuthenticateView):
    """
    Выход из аккаунта
    """

    def get(self, request):
        token = Token.objects.get(user=request.user)
        token.delete()
        return SuccessResponse('Вы успешно вышли из системы', status=status.HTTP_200_OK)
    

class SearchView(APIView):

    """
    Поиск пользователей в Базе Данных.
    
    Внедрено SearchVector и триграммы.
    """

    def post(self, request):
        serializer = SearchInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data.get("query")

        if not query:
            return ErrorResponse({"error": "Query is undefined"}, status=400)

        users = (
            Profile.objects
            .annotate(
                vector=SearchVector('username', 'fio'),
                trigram_username=TrigramSimilarity('username', query),
                trigram_fio=TrigramSimilarity('fio', query),
            )
            .annotate(
                rank=(
                    SearchRank(F('vector'), SearchQuery(query))
                    + F('trigram_username')
                    + F('trigram_fio')
                )
            )
            .filter(rank__gt=0.1)
            .order_by('-rank')
        )

        return SuccessResponse(
            UserProfileSerializer(users, many=True, context={"request": request}).data,
            status=200
        )
