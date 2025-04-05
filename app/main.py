import uvicorn
from fastapi import FastAPI
from app.controllers import user_controller

app = FastAPI()

app.include_router(user_controller.router)

if __name__ == "__main__":
    import os
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)