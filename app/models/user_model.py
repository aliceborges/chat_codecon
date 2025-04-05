from sqlalchemy import Column, String
from app.models.base_model import BaseModel


class User(BaseModel):
    __tablename__ = "users"
    
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)