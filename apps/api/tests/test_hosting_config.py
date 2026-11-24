import pytest
from breathewise.core.config import Settings


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg"])
def test_hosted_postgres_uses_installed_driver(scheme):
    settings = Settings(_env_file=None, database_url=f"{scheme}://user:pass@db/example")
    assert settings.database_url == "postgresql+psycopg://user:pass@db/example"


def test_sqlite_url_unchanged():
    assert (
        Settings(_env_file=None, database_url="sqlite:///demo.db").database_url
        == "sqlite:///demo.db"
    )
