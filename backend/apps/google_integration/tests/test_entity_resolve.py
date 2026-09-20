from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import UserEntityMembership
from apps.entities.models import Entity
from apps.google_integration.entity_resolve import resolve_entity_for_google_user

User = get_user_model()


class EntityResolveTests(TestCase):
    def setUp(self):
        self.entity_a = Entity.objects.create(
            name="Alcaldía A",
            code="A",
            slug="alcaldia-a",
            email="contacto@chiquiza-boyaca.gov.co",
            email_domains="chiquiza-boyaca.gov.co",
            enable_pqrs=True,
            enable_ai_reports=True,
        )
        self.entity_b = Entity.objects.create(
            name="Alcaldía B",
            code="B",
            slug="alcaldia-b",
            enable_pqrs=True,
        )
        self.user = User.objects.create_user(
            email="planeacion@chiquiza-boyaca.gov.co",
            password="unused",
            full_name="Planeación",
        )
        UserEntityMembership.objects.create(
            user=self.user,
            entity=self.entity_a,
            role="secretario",
            is_active=True,
            is_default=True,
        )

    def test_resuelve_por_dominio_y_membresia(self):
        entity = resolve_entity_for_google_user(
            self.user, "planeacion@chiquiza-boyaca.gov.co"
        )
        self.assertEqual(entity.id, self.entity_a.id)

    def test_aislamiento_entidad_sin_membresia(self):
        UserEntityMembership.objects.filter(user=self.user).delete()
        UserEntityMembership.objects.create(
            user=self.user,
            entity=self.entity_b,
            role="secretario",
            is_active=True,
            is_default=True,
        )
        entity = resolve_entity_for_google_user(
            self.user, "planeacion@chiquiza-boyaca.gov.co"
        )
        self.assertIsNone(entity)
