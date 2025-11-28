from django.db import IntegrityError
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .models import Profile
from .exceptions import EmailAlreadyUsed, PhoneNumberAlreadyUsed

class UserLoginSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=52)
    password = serializers.CharField(max_length=128)

    class Meta:
        model = User
        fields = ('phone', 'password')
        extra_kwargs = {'password': {'write_only': True}}
        read_only_fields = ['phone']


class UserRegSerializer(serializers.Serializer):
    fio = serializers.CharField(max_length=52)
    phone = serializers.CharField(max_length=128)
    password = serializers.CharField(max_length=128)

    def save(self, validated_data):
        try:
            user = User.objects.create_user(
                username=validated_data['phone'],
                password=validated_data['password'],
            )
        except IntegrityError:
            raise PhoneNumberAlreadyUsed()

        try:
            profile = Profile.objects.create(
                user=user,
                fio=validated_data.get('fio', ''),
                phone=validated_data.get('phone', ''),
            )
        except IntegrityError as e:
            user.delete()

            msg = str(e).lower()

            if 'phone' in msg:
                raise PhoneNumberAlreadyUsed()

            raise ValidationError('Profile creation failed.')

        return user

    class Meta:
        fields = ['fio', 'phone', 'password']
        extra_kwargs = {'password': {'write_only': True}}


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = "__all__"

    def validate(self, data):
        profile = self.instance
        for field in data:
            if data[field] == '':
                data[field] = getattr(profile, field)
        return data
    
    def get_avatar(self, obj):
        request = self.context.get('request')
        if obj.avatar:
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return None




class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        user = self.context['request'].user
        
        if not user.check_password(attrs['current_password']):
            raise ValidationError('Current password is incorrect!')

        if attrs['new_password'] != attrs['confirm_password']:
            raise ValidationError('New password didnt match with confirm password')

        if attrs['current_password'] == attrs['new_password'] == attrs['confirm_password']:
            raise ValidationError('New password should not be the same as current password')

        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()


class SearchInputSerializer(serializers.Serializer):
    query = serializers.CharField()

    class Meta:
        fields = ('query',)