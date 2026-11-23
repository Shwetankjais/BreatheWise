import json

from breathewise.db.session import engine
from breathewise.services.alerts import evaluate
from sqlalchemy.orm import Session

with Session(engine()) as db, db.begin():
    print(json.dumps(evaluate(db)))
