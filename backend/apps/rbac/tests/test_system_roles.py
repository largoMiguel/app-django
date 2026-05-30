"""Tests RBAC: roles system no editables por admin de entidad."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase

from apps.entities.models import Entity
from apps.rbac.models import RoleMeta

User = get_user_model()


class RBACSystemRoleTests(APITestCase):
    def setUp(self):
        self.entity = Entity.objects.create(name="Ent", code="E1", slug="ent")
        self.admin = User.objects.create_user(
            email="admin@ent.com",
            password="testpass1234",
            full_name="Admin Ent",
            entity=self.entity,
            role="admin",
            is_staff=True,
        )
        self.system_group, _ = Group.objects.get_or_create(name="admin")
        RoleMeta.objects.update_or_create(
            group=self.system_group,
            defaults={"is_system": True},
        )

    def test_admin_entidad_no_puede_editar_rol_system(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/v1/rbac/roles/{self.system_group.pk}/",
            {"description": "hack"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
