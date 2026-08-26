# Generated manually for clave_producto support

from django.db import migrations, models


def backfill_clave_producto(apps, schema_editor):
    PdmProducto = apps.get_model("pdm", "PdmProducto")
    for prod in PdmProducto.objects.all().iterator():
        prod.clave_producto = prod.codigo_producto or ""
        prod.save(update_fields=["clave_producto"])


class Migration(migrations.Migration):

    dependencies = [
        ("pdm", "0008_informe_pdm_tipo"),
    ]

    operations = [
        migrations.AddField(
            model_name="pdmproducto",
            name="clave_producto",
            field=models.CharField(db_index=True, default="", max_length=96),
        ),
        migrations.RunPython(backfill_clave_producto, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="pdmproducto",
            name="clave_producto",
            field=models.CharField(db_index=True, max_length=96),
        ),
        migrations.RenameField(
            model_name="pdmactividad",
            old_name="codigo_producto",
            new_name="clave_producto",
        ),
        migrations.AlterField(
            model_name="pdmactividad",
            name="clave_producto",
            field=models.CharField(db_index=True, max_length=96),
        ),
        migrations.RemoveConstraint(
            model_name="pdmproducto",
            name="uq_pdm_producto_entity_codigo",
        ),
        migrations.AddConstraint(
            model_name="pdmproducto",
            constraint=models.UniqueConstraint(
                fields=("entity", "clave_producto"),
                name="uq_pdm_producto_entity_clave",
            ),
        ),
        migrations.AddIndex(
            model_name="pdmproducto",
            index=models.Index(fields=("entity", "clave_producto"), name="pdm_prod_entity_clave_idx"),
        ),
    ]
