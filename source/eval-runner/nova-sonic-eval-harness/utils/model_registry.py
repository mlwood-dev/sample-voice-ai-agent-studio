"""
Model Registry
Resolves short model aliases to actual Bedrock model IDs using configs/models.yaml.
"""

import yaml
from pathlib import Path
from typing import Optional, Dict, Any


class ModelRegistry:
    """
    Loads model ID mappings from a YAML config and resolves
    short aliases (e.g. "claude-haiku") to full Bedrock model IDs.
    """

    def __init__(self, config_path: str = "configs/models.yaml"):
        self._config_path = Path(config_path)
        self._data: Dict[str, Any] = {}
        self._load()

    def _load(self):
        if not self._config_path.exists():
            print(f"⚠️  Model config not found at {self._config_path}, using empty registry")
            return
        with open(self._config_path, 'r') as f:
            self._data = yaml.safe_load(f) or {}

    def resolve_user_model(self, alias: str) -> Dict[str, str]:
        """
        Resolve a user simulator model alias.

        Args:
            alias: Short name like "claude-haiku" or a full Bedrock model ID

        Returns:
            Dict with "model_id" and "region"
        """
        return self._resolve("user_models", alias)

    def resolve_sonic_model(self, alias: str) -> Dict[str, str]:
        """
        Resolve a Nova Sonic model alias.

        Args:
            alias: Short name like "nova-sonic" or a full Bedrock model ID

        Returns:
            Dict with "model_id" and "region"
        """
        return self._resolve("sonic_models", alias)

    def resolve_judge_model(self, alias: str) -> Dict[str, str]:
        """
        Resolve a judge model alias.

        Args:
            alias: Short name like "claude-opus" or a full Bedrock model ID

        Returns:
            Dict with "model_id" and "region"
        """
        return self._resolve("judge_models", alias)

    def _resolve(self, category: str, alias: str) -> Dict[str, str]:
        """Resolve an alias within a category, falling back to treating it as a literal model ID."""
        models = self._data.get(category, {})
        if alias in models:
            entry = models[alias]
            return {"model_id": entry["model_id"], "region": entry.get("region", "us-east-1")}
        # Not found as alias -- treat the alias itself as a full model ID
        return {"model_id": alias, "region": "us-east-1"}

    def list_user_models(self) -> Dict[str, str]:
        """Return all registered user model aliases and their IDs."""
        return {k: v["model_id"] for k, v in self._data.get("user_models", {}).items()}

    def list_sonic_models(self) -> Dict[str, str]:
        """Return all registered sonic model aliases and their IDs."""
        return {k: v["model_id"] for k, v in self._data.get("sonic_models", {}).items()}

    def list_judge_models(self) -> Dict[str, str]:
        """Return all registered judge model aliases and their IDs."""
        return {k: v["model_id"] for k, v in self._data.get("judge_models", {}).items()}


# Singleton instance
_default_registry: Optional[ModelRegistry] = None


def get_model_registry(config_path: str = "configs/models.yaml") -> ModelRegistry:
    """Get or create the default model registry singleton."""
    global _default_registry
    if _default_registry is None:
        _default_registry = ModelRegistry(config_path)
    return _default_registry


NOVA_PRO_ALIAS = "nova-pro"
NOVA_PRO_MODEL_ID = "us.amazon.nova-pro-v1:0"
NOVA_PRO_REGION = "us-east-1"


def is_anthropic_access_error(exc: BaseException) -> bool:
    """True when Bedrock rejects an Anthropic model because the use-case form is missing."""
    parts = [str(exc), type(exc).__name__]
    cause = getattr(exc, "__cause__", None)
    if cause is not None:
        parts.append(str(cause))
    response = getattr(exc, "response", None)
    if isinstance(response, dict):
        err = response.get("Error") or {}
        parts.append(str(err.get("Code", "")))
        parts.append(str(err.get("Message", "")))
    text = " ".join(parts).lower()
    return (
        "model use case details have not been submitted" in text
        or "anthropic use case details form" in text
    )


def nova_pro_resolution() -> Dict[str, str]:
    """Canonical Nova Pro target used when Anthropic models are unavailable."""
    return {"model_id": NOVA_PRO_MODEL_ID, "region": NOVA_PRO_REGION, "alias": NOVA_PRO_ALIAS}
