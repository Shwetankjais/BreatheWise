"""Source-reviewed educational facts, independent of unverified AQI categories."""

from typing import Literal

from breathewise.schemas.common import Pollutant
from pydantic import BaseModel

SOURCE = "https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health"


class Advisory(BaseModel):
    pollutant: Pollutant
    content_version: str = "2026-11-24.1"
    reviewed_at: str = "2026-11-24"
    review_scope: str = "engineering source review; no clinical review"
    scope: Literal["general_education"] = "general_education"
    title: str
    summary: str
    source_title: str = "WHO: Ambient (outdoor) air pollution"
    source_url: str = SOURCE
    limitations: list[str] = [
        "Educational population-level information; no diagnosis or personal risk estimate.",
        "This content does not assign a CPCB AQI category or prescribe a safe activity window.",
    ]


FACTS = {
    "pm25": (
        "Fine particulate pollution",
        "Exposure to particulate pollution can harm cardiovascular and respiratory health.",
    ),
    "pm10": (
        "Particulate pollution",
        "Particulate pollution is associated with adverse health effects; its composition varies by source.",
    ),
    "co": (
        "Carbon monoxide",
        "Carbon monoxide is a toxic gas associated with incomplete fuel combustion.",
    ),
    "o3": (
        "Ground-level ozone",
        "Ground-level ozone contributes to photochemical smog; it forms through reactions involving gases and sunlight.",
    ),
    "no2": (
        "Nitrogen dioxide",
        "Transport and industrial fuel combustion are common sources of nitrogen dioxide.",
    ),
    "so2": (
        "Sulfur dioxide",
        "Sulfur dioxide can arise from fossil fuel burning and processing sulfur-containing ores.",
    ),
}


def advisory(pollutant: Pollutant):
    title, summary = FACTS[pollutant]
    return Advisory(pollutant=pollutant, title=title, summary=summary)
