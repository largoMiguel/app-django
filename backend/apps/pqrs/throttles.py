from rest_framework.throttling import UserRateThrottle


class PQRSAIAutoCreateThrottle(UserRateThrottle):
    scope = "pqrs_ai_auto"
