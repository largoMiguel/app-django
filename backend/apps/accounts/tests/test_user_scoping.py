from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.entities.models import Entity

User = get_user_model()


class UserScopingTests(TestCase):
    def setUp(self):
        self.entity_a = Entity.objects.create(name="Entidad A", code="EA", slug="entidad-a")
        self.entity_b = Entity.objects.create(name="Entidad B", code="EB", slug="entidad-b")

        self.admin_a = User.objects.create_user(
            email="admin.a@test.com",
            password="testpass1234",
            full_name="Admin A",
            entity=self.entity_a,
            role="admin",
            is_staff=True,
        )
        self.user_a = User.objects.create_user(
            email="user.a@test.com",
            password="testpass1234",
            full_name="User A",
            entity=self.entity_a,
            role="ciudadano",
        )
        self.user_b = User.objects.create_user(
            email="user.b@test.com",
            password="testpass1234",
            full_name="User B",
            entity=self.entity_b,
            role="ciudadano",
        )

    def test_admin_solo_lista_usuarios_de_su_entidad(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_a)
        response = client.get("/api/v1/users/")
        self.assertEqual(response.status_code, 200)
        emails = {item["email"] for item in response.data["results"]}
        self.assertIn(self.user_a.email, emails)
        self.assertNotIn(self.user_b.email, emails)
