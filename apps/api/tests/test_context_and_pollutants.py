def test_environment_context_endpoint(backend):
    client, _, _, _ = backend
    res = client.get("/api/v1/environment/context?latitude=28.6&longitude=77.2")
    assert res.status_code == 200
    body = res.json()
    assert "data" in body
    data = body["data"]
    assert data["user_latitude"] == 28.6
    assert data["user_longitude"] == 77.2
    assert "nearest_station" in data
    assert "weather" in data
    assert "ground_pollutants" in data
    assert data["in_bounds"] is True
    assert data["nearest_station"]["id"] == "fixture"


def test_environment_context_out_of_bounds(backend):
    client, _, _, _ = backend
    # Mumbai coordinates
    res = client.get("/api/v1/environment/context?latitude=19.076&longitude=72.877")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["in_bounds"] is False
    assert data["distance_km"] > 500
    assert "outside" in data["boundary_message"].lower()


def test_station_pollutants_endpoint(backend):
    client, _, _, _ = backend
    res = client.get("/api/v1/stations/fixture/pollutants")
    assert res.status_code == 200
    pollutants = res.json()["data"]
    # Check all 6 criteria pollutants are represented
    for p in ["pm25", "pm10", "no2", "so2", "co", "o3"]:
        assert p in pollutants
        assert "available" in pollutants[p]
        assert "averaging_period" in pollutants[p]
    # In fixture batch, co and pm25 were provided
    assert pollutants["pm25"]["available"] is True
    assert pollutants["pm25"]["value"] == 200
    assert pollutants["co"]["available"] is True
    # pm10 was not provided, should be available=False
    assert pollutants["pm10"]["available"] is False
