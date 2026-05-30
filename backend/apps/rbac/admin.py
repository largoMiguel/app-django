from django.contrib import admin

from .models import RoleMeta


@admin.register(RoleMeta)
class RoleMetaAdmin(admin.ModelAdmin):
    list_display = ("group", "description", "is_system", "updated_at")
    list_filter = ("is_system",)
    search_fields = ("group__name", "description")
