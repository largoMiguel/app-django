# Generated manually

from django.db import migrations, models


def backfill_correo_alerta(apps, schema_editor):
    PQRS = apps.get_model("pqrs", "PQRS")
    PQRSCorreo = apps.get_model("pqrs", "PQRSCorreo")
    alert_estados = {"error", "rebotado", "rebote_temporal", "reclamacion_spam"}
    alert_correo = {"error", "rebotado", "rebote_temporal", "reclamacion_spam"}

    for pqrs in PQRS.objects.all().iterator():
        tiene = False
        latest: dict[str, str] = {}
        for correo in PQRSCorreo.objects.filter(pqrs_id=pqrs.id).order_by("created_at", "id"):
            if correo.estado in alert_correo:
                tiene = True
                break
            for d in correo.destinatarios or []:
                email = (d.get("email") or "").strip().lower()
                estado = d.get("estado")
                if email and estado:
                    latest[email] = estado
        if not tiene:
            tiene = any(est in alert_estados for est in latest.values())
        if tiene and not pqrs.correo_alerta:
            PQRS.objects.filter(pk=pqrs.pk).update(correo_alerta=True)


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0010_pqrs_correo"),
    ]

    operations = [
        migrations.AddField(
            model_name="pqrs",
            name="correo_alerta",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="True si algún correo PQRS tiene rebote, error o spam pendiente.",
            ),
        ),
        migrations.RunPython(backfill_correo_alerta, migrations.RunPython.noop),
    ]
