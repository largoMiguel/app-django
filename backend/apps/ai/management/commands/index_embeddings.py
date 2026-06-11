"""Indexa PQRS en pgvector para búsqueda semántica."""
from django.core.management.base import BaseCommand

from apps.ai.tasks import index_pqrs_embedding, reindex_all_embeddings
from apps.pqrs.models import PQRS


class Command(BaseCommand):
    help = "Indexa embeddings de PQRS para búsqueda inteligente"

    def add_arguments(self, parser):
        parser.add_argument("--entity-id", type=int, help="Solo esta entidad")
        parser.add_argument(
            "--async",
            action="store_true",
            dest="use_async",
            help="Encolar en Celery (recomendado en producción)",
        )

    def handle(self, *args, **options):
        entity_id = options.get("entity_id")
        if options.get("use_async"):
            reindex_all_embeddings.delay(entity_id=entity_id)
            self.stdout.write(self.style.SUCCESS("Tarea de reindexación encolada en Celery."))
            return

        qs = PQRS.objects.all().order_by("-id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        ids = list(qs.values_list("id", flat=True)[:2000])
        for pqrs_id in ids:
            index_pqrs_embedding(pqrs_id)
        self.stdout.write(self.style.SUCCESS(f"Indexados {len(ids)} PQRS."))
