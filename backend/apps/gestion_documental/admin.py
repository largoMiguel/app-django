from django.contrib import admin

from .models import (
    Disposicion,
    DocumentoExpediente,
    Expediente,
    FuidRegistro,
    InstrumentoArchivistico,
    SerieDocumental,
    Transferencia,
    UnidadAdministrativa,
)

admin.site.register(InstrumentoArchivistico)
admin.site.register(UnidadAdministrativa)
admin.site.register(SerieDocumental)
admin.site.register(Expediente)
admin.site.register(DocumentoExpediente)
admin.site.register(FuidRegistro)
admin.site.register(Transferencia)
admin.site.register(Disposicion)
