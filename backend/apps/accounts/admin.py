from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.common.roles import is_platform_superadmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "full_name", "is_active", "is_staff", "last_login")
    list_filter = ("is_active", "is_staff", "is_superuser", "groups")
    search_fields = ("email", "full_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Datos", {"fields": ("full_name",)}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Importante", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "full_name", "password1", "password2"),
        }),
    )
    readonly_fields = ("last_login", "date_joined")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if is_platform_superadmin(request.user):
            return qs
        if request.user.entity_id:
            return qs.filter(entity_id=request.user.entity_id)
        return qs.none()
