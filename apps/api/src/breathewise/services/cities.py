from breathewise.schemas.environment import City

CITY_GROUPS = [
    ("delhi", "Delhi", ["New Delhi"]),
    ("mumbai", "Mumbai", ["Navi Mumbai"]),
    ("hyderabad", "Hyderabad", []),
    ("bengaluru", "Bengaluru", ["Bangalore"]),
    ("pune", "Pune", []),
    ("chennai", "Chennai", []),
    ("kolkata", "Kolkata", []),
    ("ahmedabad", "Ahmedabad", []),
    ("lucknow", "Lucknow", []),
    ("moradabad", "Moradabad", []),
    ("srinagar", "Srinagar", []),
    ("ghaziabad", "Ghaziabad", []),
    ("agra", "Agra", []),
    ("indore", "Indore", []),
    ("guwahati", "Guwahati", []),
    ("jaipur", "Jaipur", []),
]


def cities():
    return [City(id=id, name=name, aliases=aliases) for id, name, aliases in CITY_GROUPS]


def validate_city(city_id):
    from breathewise.core.errors import ServiceError

    if city_id not in {row[0] for row in CITY_GROUPS}:
        raise ServiceError(404, "CITY_NOT_FOUND", "Unknown requested city group")
