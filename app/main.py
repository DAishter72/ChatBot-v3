import os
import shutil
from typing import List, Optional
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from app.bot.agente import agent


load_dotenv()


# Directorio donde se guardarán los archivos subidos
UPLOAD_DIRECTORY = "uploaded_documents"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

# Modelo para la solicitud de eliminación


class DeleteFileRequest(BaseModel):
    file_path: str


class ChatMessage(BaseModel):
    message: str
    documents: Optional[List[str]] = None


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Punto de entrada para verificar el estado del servidor."""
    return JSONResponse(
        status_code=200,
        content={"status": "OK", "message": "Servidor funcionando correctamente"}
    )


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Crear un nombre único para el archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename.replace(' ', '_')}"
        # Guardar el archivo en el directorio
        file_path = os.path.join(UPLOAD_DIRECTORY, safe_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {"message": f"Archivo {file.filename} subido correctamente",
                "filename": file.filename,
                "file_path": file_path}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error al subir el archivo: {str(e)}")


@app.post("/chat")
async def chat(chat_request: ChatMessage):
    """Punto de entrada para el chat del agente."""
    config = {
        "configurable": {"thread_id": 2},
    }

    # Construir el mensaje para la IA
    user_message = chat_request.message

    # Si hay documentos, mencionarlos en el mensaje
    # if chat_request.documents:
    #    doc_names = [os.path.basename(doc_path)
    #                 for doc_path in chat_request.documents]
    #    user_message += f"\n\nHe subido estos documentos: {', '.join(doc_names)}."

    # Invocar al agente - él decidirá si usar las tools de PDF
    if chat_request.documents is not None:
        response = agent.invoke({
            "messages": [{"role": "user", "content": user_message}],
            "documents": chat_request.documents
        }, config)
    else:
        response = agent.invoke({
            "messages": [{"role": "user", "content": user_message}]
        }, config)

    return {"response": response["messages"][-1].content}


@app.delete("/delete-file")
async def delete_file(request: DeleteFileRequest):
    """Elimina un archivo del servidor de manera segura."""
    try:
        file_path = request.file_path

        # Validaciones de seguridad
        if not file_path:
            raise HTTPException(
                status_code=400, detail="Se requiere la ruta del archivo")

        # Convertir a path absoluto y verificar que está dentro del directorio permitido
        absolute_path = Path(file_path).resolve()
        upload_dir = Path(UPLOAD_DIRECTORY).resolve()

        # Verificar que el archivo está dentro del directorio de uploads
        if upload_dir not in absolute_path.parents and absolute_path != upload_dir:
            raise HTTPException(
                status_code=403, detail="Acceso no permitido a esta ruta")

        # Verificar que el archivo existe
        if not absolute_path.exists():
            raise HTTPException(status_code=404, detail="El archivo no existe")

        # Verificar que es un archivo (no un directorio)
        if not absolute_path.is_file():
            raise HTTPException(
                status_code=400, detail="La ruta no corresponde a un archivo")

        # Eliminar el archivo
        absolute_path.unlink()

        # Verificar que se eliminó correctamente
        if absolute_path.exists():
            raise HTTPException(
                status_code=500, detail="El archivo no se pudo eliminar")

        return {"message": f"Archivo {absolute_path.name} eliminado correctamente", "success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar el archivo: {str(e)}")
