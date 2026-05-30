from django.contrib import admin

from .models import Entity, Secretaria


@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "nit", "is_active", "enable_pqrs")
    search_fields = ("name", "code", "nit", "slug")
    list_filter = ("is_active", "enable_pqrs")


@admin.register(Secretaria)
class SecretariaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "entity", "is_active")
    list_filter = ("entity", "is_active")
    search_fields = ("nombre",)
