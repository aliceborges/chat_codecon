from sqlalchemy.orm import Session
from app.dtos.user_dto import UserCreateDTO, UserUpdateDTO
from datetime import datetime
from typing import List

from app.models.user_model import User

def get_users(db: Session) -> List[User]:
    return db.query(User).filter(User.deleted_at == None).all()

def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id, User.deleted_at == None).first()

def create_user(db: Session, user_data: UserCreateDTO) -> User:
    user = User(**user_data.dict())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def update_user(db: Session, user_id: str, user_data: UserUpdateDTO) -> User | None:
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    for field, value in user_data.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user

def delete_user(db: Session, user_id: str) -> bool:
    user = get_user_by_id(db, user_id)
    if not user:
        return False
    user.deleted_at = datetime.utcnow()
    db.commit()
    return True