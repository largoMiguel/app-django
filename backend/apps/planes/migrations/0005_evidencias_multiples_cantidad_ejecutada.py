from decimal import Decimal, InvalidOperation

from django.db import migrations, models


def migrate_meta_ejecutada_to_cantidad(apps, schema_editor):
    PlanEvidencia = apps.get_model("planes", "PlanEvidencia")
    for ev in PlanEvidencia.objects.all():
        raw = getattr(ev, "meta_ejecutada", "") or ""
        if not raw:
            ev.cantidad_ejecutada = Decimal("0")
        else:
            text = str(raw).strip().replace(",", ".")
            try:
                ev.cantidad_ejecutada = Decimal(text)
            except InvalidOperation:
                import re

                match = re.search(r"\d+(?:\.\d+)?", text)
                ev.cantidad_ejecutada = Decimal(match.group()) if match else Decimal("0")
        ev.save(update_fields=["cantidad_ejecutada"])


class Migration(migrations.Migration):

    dependencies = [
        ("planes", "0004_evidencia_avance_meta_ejecutada"),
    ]

    operations = [
        migrations.AddField(
            model_name="planevidencia",
            name="cantidad_ejecutada",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.RunPython(migrate_meta_ejecutada_to_cantidad, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="planevidencia",
            name="meta_ejecutada",
        ),
        migrations.RemoveField(
            model_name="planevidencia",
            name="avance",
        ),
        migrations.AlterField(
            model_name="planevidencia",
            name="actividad",
            field=models.ForeignKey(
                db_column="actividad_id",
                on_delete=models.deletion.CASCADE,
                related_name="evidencias",
                to="planes.planactividad",
            ),
        ),
    ]
