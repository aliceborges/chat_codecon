# FastAPI CRUD com Clerk

Este projeto implementa um CRUD básico de usuários com autenticação via Clerk, usando FastAPI, SQLAlchemy e Alembic.

## Instalação
1. Clone o repositório:
   ```sh
   git clone https://github.com/aliceborges/chat_codecon.git
   cd chat_codecon
   ```

2. Crie um ambiente virtual e instale as dependências:
   ```sh
   python -m venv venv
   source venv/bin/activate  # No Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Execute o servidor:
   ```sh
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
