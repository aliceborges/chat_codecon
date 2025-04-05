from pydantic import BaseModel, EmailStr

class UserCreateDTO(BaseModel):
    name: str
    email: EmailStr

class UserUpdateDTO(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
