from rest_framework.exceptions import ValidationError


class EmailAlreadyUsed(ValidationError):
    def __init__(self, detail=None, code=None):
        self.detail = detail or 'Email already used, try another one.'
        self.code = code or 'email_already_used'


class PhoneNumberAlreadyUsed(ValidationError):
    def __init__(self, detail=None, code=None):
        self.detail = detail or 'Phone number already used, try another one.'
        self.code = code or 'phone_number_already_used'