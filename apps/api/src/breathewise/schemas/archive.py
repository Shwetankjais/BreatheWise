"""Historical chart contracts preserve the archive's unresolved recorded clock."""

from typing import Literal

from breathewise.schemas.common import Pollutant, StrictModel
from pydantic import Field, NaiveDatetime


class ArchiveClock(StrictModel):
    dataset_id: str = "delhi_observed_archive_v1"
    dataset_mode: Literal["recorded_clock"] = "recorded_clock"
    clock_basis: Literal["source_naive_clock_unverified"] = "source_naive_clock_unverified"
    timezone: None = None
    interval_semantics: Literal["unverified"] = "unverified"
    publication_time_known: bool = False
    limitations: list[str] = Field(
        default_factory=lambda: [
            "Source timezone and interval start/end are unresolved; values are not authoritative UTC",
            "Historical publication/issue-time availability is unknown",
            "Quarantined copies and interpolated sensitivity products are excluded",
        ]
    )


class ArchivePollutantCoverage(StrictModel):
    pollutant: Pollutant
    unit: str
    valid_count: int
    missing_count: int
    invalid_count: int
    coverage_fraction: float


class ArchiveStation(StrictModel):
    station_id: str
    source_folders: list[str]
    labels: list[str]
    first_record: NaiveDatetime
    last_record: NaiveDatetime
    grid_rows: int
    expected_count: int
    absent_hour_count: int
    pollutants: list[ArchivePollutantCoverage]


class ArchiveCatalogue(ArchiveClock):
    dataset_fingerprint: str
    stations: list[ArchiveStation]
    station_count: int
    excluded_row_count: int
    source_file_count: int


class ArchiveDistribution(StrictModel):
    count: int
    minimum: float | None = None
    p05: float | None = None
    p25: float | None = None
    median: float | None = None
    p75: float | None = None
    p95: float | None = None
    maximum: float | None = None
    mean: float | None = None
    stddev: float | None = None


class ArchiveBucket(StrictModel):
    period_start: NaiveDatetime
    period_end: NaiveDatetime
    value: float | None
    valid_count: int
    expected_count: int
    missing_count: int
    coverage_fraction: float
    meets_requested_sufficiency: bool


class ArchiveExplore(ArchiveClock):
    dataset_fingerprint: str
    station_id: str
    pollutant: Pollutant
    unit: str
    start: NaiveDatetime
    end: NaiveDatetime
    aggregation: Literal["daily", "monthly"]
    min_count: int
    min_coverage: float
    valid_count: int
    expected_count: int
    missing_count: int
    source_null_count: int
    invalid_count: int
    absent_hour_count: int
    coverage_fraction: float
    distribution: ArchiveDistribution
    points: list[ArchiveBucket]
    lineage_source_files: list[str]


class ArchiveComparisonBucket(StrictModel):
    period_start: NaiveDatetime
    period_end: NaiveDatetime
    paired_hour_count: int
    expected_count: int
    paired_coverage_fraction: float
    means: dict[str, float | None]


class ArchivePairAgreement(StrictModel):
    station_a: str
    station_b: str
    count: int
    mean_difference: float | None
    mean_absolute_difference: float | None
    interpretation: str = "Differences between observed station records, not forecast evaluation"


class ArchiveCompare(ArchiveClock):
    dataset_fingerprint: str
    station_ids: list[str]
    pollutant: Pollutant
    unit: str
    start: NaiveDatetime
    end: NaiveDatetime
    aggregation: Literal["daily", "monthly"]
    clock_assumption: Literal["same_recorded_clock"]
    alignment_status: Literal["conditional_same_recorded_clock_only"] = (
        "conditional_same_recorded_clock_only"
    )
    matched_hour_count: int
    expected_count: int
    unmatched_or_missing_hour_count: int
    points: list[ArchiveComparisonBucket]
    pair_agreement: list[ArchivePairAgreement]
    forecast_evaluation: bool = False
