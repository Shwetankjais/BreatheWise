"""Bounded provider metadata discovery, not station eligibility or a national corpus fetch."""

import json

import httpx
from breathewise.adapters.openaq import OpenAQ, ProviderError, delhi_assignment
from breathewise.core.config import get_settings

try:
    with httpx.Client() as client:
        adapter = OpenAQ(get_settings().openaq_api_key.get_secret_value(), client)
        body = adapter.get(
            "/v3/locations",
            {
                "coordinates": "28.6139,77.2090",
                "radius": 25000,
                "iso": "IN",
                "limit": 100,
                "page": 1,
            },
        )
        candidates = []
        for row in body["results"]:
            if (
                row.get("country", {}).get("code") != "IN"
                or row.get("isMobile") is not False
                or row.get("isMonitor") is not True
            ):
                continue
            try:
                method = delhi_assignment(row)
            except ProviderError:
                continue
            candidates.append(
                {
                    "location_id": row["id"],
                    "name": row.get("name"),
                    "locality": row.get("locality"),
                    "source": "OpenAQ provider metadata",
                    "city_assignment_method": method,
                    "observation_and_model_eligibility": "unverified",
                }
            )
        print(
            json.dumps(
                {
                    "status": "bounded_provider_metadata_only",
                    "maximum_records": 100,
                    "radius_metres": 25000,
                    "candidates": candidates,
                },
                indent=2,
            )
        )
except ProviderError as exc:
    raise SystemExit(exc.code) from None
