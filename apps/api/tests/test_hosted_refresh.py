from types import SimpleNamespace

import pytest
from breathewise.jobs import hosted_refresh


def test_hosted_refresh_requires_live_mode_and_key(monkeypatch):
    for mode, key in (("demo", "configured"), ("live", "")):
        monkeypatch.setattr(
            hosted_refresh,
            "get_settings",
            lambda mode=mode, key=key: SimpleNamespace(
                data_mode=mode,
                openaq_api_key=SimpleNamespace(get_secret_value=lambda: key),
            ),
        )
        with pytest.raises(SystemExit, match="requires DATA_MODE=live and OPENAQ_API_KEY"):
            hosted_refresh.main()


def test_hosted_refresh_runs_bounded_import_and_retains_failure(monkeypatch, capsys):
    monkeypatch.setattr(
        hosted_refresh,
        "get_settings",
        lambda: SimpleNamespace(
            data_mode="live",
            openaq_api_key=SimpleNamespace(get_secret_value=lambda: "configured"),
        ),
    )
    monkeypatch.setenv("BREATHEWISE_REFRESH_INTERVAL_SECONDS", "900")
    calls = []

    def fake_run(command, **options):
        calls.append((command, options))
        return SimpleNamespace(returncode=1)

    monkeypatch.setattr(hosted_refresh.subprocess, "run", fake_run)

    def stop_after_first_cycle(interval):
        assert interval == 900
        raise KeyboardInterrupt

    monkeypatch.setattr(hosted_refresh.time, "sleep", stop_after_first_cycle)
    with pytest.raises(KeyboardInterrupt):
        hosted_refresh.main()

    command, options = calls[0]
    assert command[-4:] == ["--lookback-hours", "24", "--overlap-hours", "2"]
    assert options["check"] is False
    assert '"exit_code": 1' in capsys.readouterr().out
