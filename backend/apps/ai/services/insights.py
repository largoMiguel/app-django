"""Reexportación de insights por módulo."""
from apps.ai.services.insights_pdm import generate_pdm_insights
from apps.ai.services.insights_pqrs import generate_pqrs_insights

__all__ = ["generate_pqrs_insights", "generate_pdm_insights"]
