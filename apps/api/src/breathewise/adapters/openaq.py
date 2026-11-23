"""Bounded OpenAQ v3 hourly adapter; keys stay in headers, publication is not guessed."""

import math
import re
from datetime import UTC, datetime, timedelta

import httpx
from breathewise.core.time import utc
from breathewise.schemas.ingestion import ImportBatch

BASE_URL = "https://api.openaq.org"


class ProviderError(Exception):
    def __init__(self, code, *, retryable=False):
        super().__init__(code)
        self.code = code
        self.retryable = retryable


def parse_time(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Provider timestamp has no timezone")
    return utc(parsed)


def delhi_assignment(location):
    locality = (location.get("locality") or "").strip().casefold()
    if locality in {"delhi", "new delhi"}:
        return "provider_locality"
    if (
        not locality
        and location.get("owner", {}).get("name") == "Delhi Pollution Control Committee"
        and re.search(
            r",\s*(?:New\s+)?Delhi\s*-\s*DPCC\s*$", location.get("name") or "", re.IGNORECASE
        )
    ):
        return "explicit_provider_station_name_and_DPCC_owner_not_boundary_GIS"
    raise ProviderError("OPENAQ_DELHI_LOCALITY_UNVERIFIED")


class OpenAQ:
    def __init__(self, key: str, client: httpx.Client):
        if not key:
            raise ProviderError("OPENAQ_KEY_MISSING")
        self.key = key
        self.client = client
        self.raw_responses = []

    def get(self, path, params=None):
        try:
            response = self.client.get(
                BASE_URL + path,
                params=params,
                headers={"X-API-Key": self.key},
                timeout=15,
                follow_redirects=False,
            )
        except (httpx.TimeoutException, httpx.NetworkError):
            raise ProviderError("OPENAQ_NETWORK_ERROR", retryable=True) from None
        if response.status_code in {401, 403}:
            raise ProviderError("OPENAQ_AUTH_FAILED")
        if response.status_code == 429:
            raise ProviderError("OPENAQ_RATE_LIMITED", retryable=True)
        if response.status_code >= 500:
            raise ProviderError("OPENAQ_TEMPORARY_FAILURE", retryable=True)
        if response.status_code != 200:
            raise ProviderError("OPENAQ_REQUEST_REJECTED")
        try:
            body = response.json()
            if not isinstance(body.get("results"), list):
                raise ValueError()
        except (ValueError, AttributeError):
            raise ProviderError("OPENAQ_INVALID_RESPONSE") from None
        self.raw_responses.append({"path": path, "params": params, "body": body})
        return body

    def fetch_hourly(self, **kwargs):
        try:
            return self._fetch_hourly(**kwargs)
        except ProviderError:
            raise
        except (KeyError, TypeError, ValueError, AttributeError):
            raise ProviderError("OPENAQ_SCHEMA_MISMATCH") from None

    def _fetch_hourly(self, *, location_id, start, end, mode, received_at=None, sensor_id=None):
        if (
            mode not in {"live", "historical_replay"}
            or not 0 < (end - start).total_seconds() <= 7 * 86400
        ):
            raise ProviderError("OPENAQ_INVALID_SCOPE")
        if start.tzinfo is None or end.tzinfo is None:
            raise ProviderError("OPENAQ_TIMEZONE_REQUIRED")
        explicit_receipt_clock = received_at is not None
        received_at = received_at or datetime.now(UTC)
        body = self.get(f"/v3/locations/{location_id}")
        if len(body["results"]) != 1:
            raise ProviderError("OPENAQ_LOCATION_NOT_FOUND")
        location = body["results"][0]
        if location.get("id") != location_id:
            raise ProviderError("OPENAQ_LOCATION_ID_MISMATCH")
        if (
            location.get("country", {}).get("code") != "IN"
            or location.get("isMobile") is not False
            or location.get("isMonitor") is not True
        ):
            raise ProviderError("OPENAQ_STATION_INELIGIBLE")
        city_method = delhi_assignment(location)
        if location.get("timezone") != "Asia/Kolkata":
            raise ProviderError("OPENAQ_TIMEZONE_UNSUPPORTED")
        sensors = [
            sensor
            for sensor in location.get("sensors", [])
            if sensor.get("parameter", {}).get("name") == "pm25"
        ]
        if sensor_id is not None:
            sensors = [sensor for sensor in sensors if sensor.get("id") == sensor_id]
        if len(sensors) != 1:
            raise ProviderError("OPENAQ_PM25_SENSOR_MISSING_OR_AMBIGUOUS")
        sensor = sensors[0]
        units = {
            "µg/m³": "µg/m³",
            "μg/m³": "µg/m³",
            "µg/m3": "µg/m³",
            "ug/m3": "ug/m3",
            "mg/m3": "mg/m3",
            "mg/m³": "mg/m3",
        }
        station_id = f"openaq-{location_id}"
        source = f"OpenAQ / {location.get('provider', {}).get('name', 'provider unknown')}; {BASE_URL}/v3/locations/{location_id}"
        observations = []
        skipped = {}
        complete = False
        for page in range(1, 11):
            response = self.get(
                f"/v3/sensors/{sensor['id']}/hours",
                {
                    "datetime_from": start.isoformat(),
                    "datetime_to": end.isoformat(),
                    "limit": 1000,
                    "page": page,
                },
            )
            for row in response["results"]:
                reason = None
                value = row.get("value")
                if type(value) not in {int, float} or not math.isfinite(value) or value < 0:
                    reason = "invalid_or_missing_value"
                elif row.get("flagInfo", {}).get("hasFlags") is not False:
                    reason = "flagged_or_unknown_quality"
                try:
                    period = row["period"]
                    measured = parse_time(period["datetimeTo"]["utc"])
                    began = parse_time(period["datetimeFrom"]["utc"])
                    if (
                        measured - began != timedelta(hours=1)
                        or measured.minute not in {0, 30}
                        or measured.second
                        or measured.microsecond
                    ):
                        reason = "unsupported_interval"
                except (KeyError, ValueError, TypeError):
                    reason = "invalid_period"
                if reason:
                    skipped[reason] = skipped.get(reason, 0) + 1
                    continue
                if not utc(start) <= measured <= utc(end) or measured > received_at:
                    continue
                parameter = row.get("parameter", {})
                if parameter.get("name") != "pm25" or parameter.get("units") not in units:
                    raise ProviderError("OPENAQ_PARAMETER_OR_UNITS_UNSUPPORTED")
                coverage = row.get("coverage")
                flags = [
                    "availability_first_seen_at_fetch",
                    "original_model_preprocessing_unverified",
                ]
                if not location.get("licenses"):
                    flags.append("provider_license_metadata_unavailable")
                if city_method != "provider_locality":
                    flags.append("city_from_source_station_name_and_owner")
                if not coverage:
                    flags.append("provider_coverage_unknown")
                elif coverage.get("percentCoverage", 0) < 100:
                    flags.append("provider_partial_hour")
                observations.append(
                    {
                        "station_id": station_id,
                        "pollutant": "pm25",
                        "measured_at": measured,
                        "available_at": received_at,
                        "value": value,
                        "unit": units[parameter["units"]],
                        "source": source,
                        "averaging_period_minutes": 60,
                        "quality_flags": flags,
                    }
                )
            if len(response["results"]) < 1000:
                complete = True
                break
        if not complete:
            raise ProviderError("OPENAQ_PAGINATION_LIMIT")
        if not observations:
            raise ProviderError("OPENAQ_NO_USABLE_OBSERVATIONS")
        if not explicit_receipt_clock:
            completed_at = datetime.now(UTC)
            for row in observations:
                row["available_at"] = completed_at
        unique = {}
        for row in observations:
            key = row["measured_at"]
            if key in unique and unique[key] != row:
                raise ProviderError("OPENAQ_CONFLICTING_HOURLY_RECORDS")
            unique[key] = row
        batch = ImportBatch.model_validate(
            {
                "schema_version": "1.0",
                "data_mode": mode,
                "timestamp_semantics": "hour_ending_utc",
                "provenance": "OpenAQ v3 /hours; exclusive hour-ending timestamps; actual API first-seen availability, not historic publication; raw license/provider metadata archived",
                "stations": [
                    {
                        "id": station_id,
                        "name": location["name"],
                        "city_id": "delhi",
                        "latitude": location["coordinates"]["latitude"],
                        "longitude": location["coordinates"]["longitude"],
                        "source": source,
                        "data_mode": mode,
                    }
                ],
                "observations": list(unique.values()),
            }
        )
        return batch, {
            "skipped": skipped,
            "fetched_rows": len(observations),
            "location_id": location_id,
            "sensor_id": sensor["id"],
            "actual_provider_fetch": True,
            "city_assignment_method": city_method,
            "license_metadata_present": bool(location.get("licenses")),
        }
