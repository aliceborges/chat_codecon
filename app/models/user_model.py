from sqlalchemy import Column, String
from app.models.base_model import BaseModel


class User(BaseModel):
    __tablename__ = "users"
    
    username = Column(String, nullable=False, unique=True)