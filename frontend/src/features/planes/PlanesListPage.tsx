import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { planesApi, type PlanCatalogoItem, type PlanListItem } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { primaryRole, useAuthStore } from "@/core/auth/store";
import PlanFormModal from "./PlanFormModal";
import { PlanesBadge, PlanesLoading, btnPrimary } from "./components/PlanesUi";

const currentYear = new Date().getFullYear();

export default function PlanesListPage() {
  const user = useAuthStore((s) => s.user);
  const role = primaryRole(user);
  const isAdmin = role === "admin";

  const [anio, setAnio] = useState(currentYear);
  const [items, setItems] = useState<PlanListItem[]>([]);
  const [catalogo, setCatalogo] = useState<PlanCatalogoItem[]>([]);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, catRes, secRes] = await Promise.all([
        planesApi.list({ anio: String(anio), page_size: "50" }),
        planesApi.catalogo({ page_size: "50" }),
        secretariasApi.list(),
      ]);
      setItems(plansRes.results);
      setCatalogo(catRes.results);
      setSecretarias(secRes);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAssignSecretaria(planId: number, secretariaId: string) {
    try {
      await planesApi.assignResponsable(planId, secretariaId ? Number(secretariaId) : null);
      load();
    } catch (err) {
      alert(formatApiError(err));
    }
  }

  if (loading) return <PlanesLoading />;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Vigencia</label>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="mr-1 h-4 w-4" />
            Crear plan
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3">Actividades</th>
              <th className="px-4 py-3">Avance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay planes para esta vigencia. {isAdmin && "Cree uno desde el catálogo Decreto 612."}
                </td>
              </tr>
            ) : (
              items.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">{plan.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{plan.catalogo_codigo}</td>
                  <td className="px-4 py-3">
                    <PlanesBadge tone={plan.estado === "CERRADO" ? "success" : "info"}>
                      {plan.estado_label}
                    </PlanesBadge>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <select
                        value={plan.responsable_secretaria ?? ""}
                        onChange={(e) => handleAssignSecretaria(plan.id, e.target.value)}
                        className="max-w-[180px] rounded border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value="">Sin asignar</option>
                        {secretarias.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      plan.responsable_secretaria_nombre || "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{plan.actividades_count ?? 0}</td>
                  <td className="px-4 py-3">{plan.avance_promedio ?? 0}%</td>
                  <td className="px-4 py-3">
                    <Link to={`/planes/${plan.id}`} className="font-medium text-[#0e7490] hover:underline">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PlanFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        catalogo={catalogo}
        secretarias={secretarias}
        defaultAnio={anio}
        onCatalogoCreated={(item) => setCatalogo((prev) => [...prev, item])}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
