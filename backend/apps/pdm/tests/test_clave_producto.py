"""Tests para clave_producto."""
from apps.pdm.clave_producto import calcular_claves_producto


def test_clave_unica_usa_codigo_producto():
    rows = [{"codigo_producto": "1702038", "codigo_indicador_producto_mga": "170203801"}]
    assert calcular_claves_producto(rows) == {0: "1702038"}


def test_clave_repetida_usa_indicador():
    rows = [
        {"codigo_producto": "4003018", "codigo_indicador_producto_mga": "400301802", "codigo_indicador_producto": "IP-35"},
        {"codigo_producto": "4003018", "codigo_indicador_producto_mga": "400301807", "codigo_indicador_producto": "IP-36"},
    ]
    claves = calcular_claves_producto(rows)
    assert claves[0] == "4003018-400301802"
    assert claves[1] == "4003018-400301807"


def test_clave_colision_indicador_mga_usa_sispt():
    rows = [
        {"codigo_producto": "4501026", "codigo_indicador_producto_mga": "450102602", "codigo_indicador_producto": "IP-93"},
        {"codigo_producto": "4501026", "codigo_indicador_producto_mga": "450102602", "codigo_indicador_producto": "IP-98"},
    ]
    claves = calcular_claves_producto(rows)
    assert claves[0] == "4501026-450102602-IP93"
    assert claves[1] == "4501026-450102602-IP98"
