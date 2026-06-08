# Generated manually

from django.db import migrations

ESTADOS_ALERTA = frozenset({
    "error",
    "rebotado",
    "rebote_temporal",
    "reclamacion_spam",
})


def resync_correo_alerta(apps, schema_editor):
    PQRS = apps.get_model("pqrs", "PQRS")
    PQRSCorreo = apps.get_model("pqrs", "PQRSCorreo")

    for pqrs in PQRS.objects.all().iterator():
        latest: dict[str, str] = {}
        for correo in PQRSCorreo.objects.filter(pqrs_id=pqrs.id).order_by("created_at", "id"):
            for d in correo.destinatarios or []:
                email = (d.get("email") or "").strip().lower()
                estado = d.get("estado")
                if email and estado:
                    latest[email] = estado
        flag = any(est in ESTADOS_ALERTA for est in latest.values())
        if pqrs.correo_alerta != flag:
            PQRS.objects.filter(pk=pqrs.pk).update(correo_alerta=flag)


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0011_pqrs_correo_alerta"),
    ]

    operations = [
        migrations.RunPython(resync_correo_alerta, migrations.RunPython.noop),
    ]
