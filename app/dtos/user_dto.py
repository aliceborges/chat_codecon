from pydantic import BaseModel, EmailStr

class UserCreateDTO(BaseModel):
    username: str
    
class UserUpdateDTO(BaseModel):
    username: str
