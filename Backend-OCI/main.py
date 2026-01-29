import os
import oci
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional
import json
import base64

# Cargar variables de entorno
load_dotenv()

# Inicializar FastAPI
app = FastAPI(title="Atena Assistant API")

# Configurar CORS para permitir conexiones del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración OCI
OCI_CONFIG_FILE = os.getenv("OCI_CONFIG_FILE", "~/.oci/config")
OCI_CONFIG_PROFILE = os.getenv("OCI_CONFIG_PROFILE", "DEFAULT")
OCI_COMPARTMENT_ID = os.getenv("OCI_COMPARTMENT_ID")
OCI_SERVICE_ENDPOINT = os.getenv("OCI_SERVICE_ENDPOINT", "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com")
OCI_MODEL_ID = os.getenv("OCI_MODEL_ID", "meta.llama-3.3-70b-instruct")
# Modelo para visión (imágenes)
OCI_VISION_MODEL_ID = os.getenv("OCI_VISION_MODEL_ID", "meta.llama-3.2-90b-vision-instruct")

# Inicializar cliente OCI
config = oci.config.from_file(OCI_CONFIG_FILE, OCI_CONFIG_PROFILE)
genai_client = oci.generative_ai_inference.GenerativeAiInferenceClient(
    config=config,
    service_endpoint=OCI_SERVICE_ENDPOINT,
    retry_strategy=oci.retry.NoneRetryStrategy(),
    timeout=(10, 240)
)

# Modelo para las peticiones
class ChatRequest(BaseModel):
    message: str
    conversation_history: list = []

class ChatResponse(BaseModel):
    response: str
    conversation_history: list

# Configuración del asistente
SYSTEM_PROMPT = """Eres Atena, un asistente virtual inteligente y sabio, inspirado en la diosa griega de la sabiduría.
Respondes de manera concisa, clara y útil.
Tu tono es profesional pero cercano.
Ofreces perspectivas estratégicas y bien razonadas.
Responde en el mismo idioma en que te escriban."""


def build_chat_messages(conversation_history: list, user_message: str) -> list:
    """Construye el historial de mensajes para OCI GenAI (solo texto)"""
    messages = []
    
    # Agregar mensaje del sistema
    system_content = oci.generative_ai_inference.models.TextContent()
    system_content.text = SYSTEM_PROMPT
    system_message = oci.generative_ai_inference.models.SystemMessage()
    system_message.content = [system_content]
    messages.append(system_message)
    
    # Agregar historial de conversación
    for msg in conversation_history:
        content = oci.generative_ai_inference.models.TextContent()
        if isinstance(msg.get("content"), str):
            content.text = msg["content"]
        elif isinstance(msg.get("content"), list):
            # Extraer texto de mensajes con imágenes
            text_content = ""
            for item in msg["content"]:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_content = item.get("text", "")
                    break
            content.text = text_content if text_content else "[imagen]"
        
        if msg["role"] == "user":
            user_msg = oci.generative_ai_inference.models.UserMessage()
            user_msg.content = [content]
            messages.append(user_msg)
        elif msg["role"] == "assistant":
            assistant_msg = oci.generative_ai_inference.models.AssistantMessage()
            assistant_msg.content = [content]
            messages.append(assistant_msg)
    
    # Agregar mensaje actual del usuario
    user_content = oci.generative_ai_inference.models.TextContent()
    user_content.text = user_message
    current_user_msg = oci.generative_ai_inference.models.UserMessage()
    current_user_msg.content = [user_content]
    messages.append(current_user_msg)
    
    return messages


def build_vision_messages(conversation_history: list, user_message: str, images_base64: list) -> list:
    """Construye mensajes con imágenes para el modelo de visión"""
    messages = []
    
    # Agregar mensaje del sistema
    system_content = oci.generative_ai_inference.models.TextContent()
    system_content.text = SYSTEM_PROMPT + "\nPuedes analizar y describir imágenes que te compartan."
    system_message = oci.generative_ai_inference.models.SystemMessage()
    system_message.content = [system_content]
    messages.append(system_message)
    
    # Agregar historial de conversación (solo texto para el historial)
    for msg in conversation_history:
        content = oci.generative_ai_inference.models.TextContent()
        if isinstance(msg.get("content"), str):
            content.text = msg["content"]
        elif isinstance(msg.get("content"), list):
            text_content = ""
            for item in msg["content"]:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_content = item.get("text", "")
                    break
            content.text = text_content if text_content else "[imagen enviada anteriormente]"
        
        if msg["role"] == "user":
            user_msg = oci.generative_ai_inference.models.UserMessage()
            user_msg.content = [content]
            messages.append(user_msg)
        elif msg["role"] == "assistant":
            assistant_msg = oci.generative_ai_inference.models.AssistantMessage()
            assistant_msg.content = [content]
            messages.append(assistant_msg)
    
    # Construir mensaje actual con imágenes
    current_content = []
    
    # Agregar las imágenes
    for img_base64 in images_base64:
        image_content = oci.generative_ai_inference.models.ImageContent()
        image_url = oci.generative_ai_inference.models.ImageUrl()
        image_url.url = f"data:image/jpeg;base64,{img_base64}"
        image_content.image_url = image_url
        current_content.append(image_content)
    
    # Agregar el texto del usuario
    text_content = oci.generative_ai_inference.models.TextContent()
    text_content.text = user_message if user_message.strip() else "¿Qué puedes decirme sobre esta imagen?"
    current_content.append(text_content)
    
    # Crear mensaje del usuario con imágenes y texto
    current_user_msg = oci.generative_ai_inference.models.UserMessage()
    current_user_msg.content = current_content
    messages.append(current_user_msg)
    
    return messages


@app.get("/")
async def root():
    return {
        "status": "online", 
        "assistant": "Atena",
        "models": {
            "text": OCI_MODEL_ID,
            "vision": OCI_VISION_MODEL_ID
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Construir mensajes
        messages = build_chat_messages(request.conversation_history, request.message)
        
        # Configurar la petición de chat
        chat_request = oci.generative_ai_inference.models.GenericChatRequest()
        chat_request.messages = messages
        chat_request.api_format = oci.generative_ai_inference.models.BaseChatRequest.API_FORMAT_GENERIC
        chat_request.max_tokens = 1000
        chat_request.temperature = 0.7
        chat_request.top_p = 0.9
        
        # Configurar detalles del chat
        chat_detail = oci.generative_ai_inference.models.ChatDetails()
        chat_detail.serving_mode = oci.generative_ai_inference.models.OnDemandServingMode(
            model_id=OCI_MODEL_ID
        )
        chat_detail.compartment_id = OCI_COMPARTMENT_ID
        chat_detail.chat_request = chat_request
        
        # Llamar a la API de OCI
        response = genai_client.chat(chat_detail)
        
        # Extraer respuesta
        assistant_message = ""
        if response.data.chat_response.choices:
            choice = response.data.chat_response.choices[0]
            if choice.message.content:
                for content in choice.message.content:
                    if hasattr(content, 'text'):
                        assistant_message += content.text
        
        # Actualizar historial
        updated_history = request.conversation_history + [
            {"role": "user", "content": request.message},
            {"role": "assistant", "content": assistant_message}
        ]
        
        return ChatResponse(
            response=assistant_message,
            conversation_history=updated_history
        )
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat-with-image")
async def chat_with_image(
    message: str = Form(...),
    conversation_history: str = Form("[]"),
    images: list[UploadFile] = File(...)
):
    """
    Endpoint para chat con imágenes usando el modelo de visión.
    Utiliza meta.llama-3.2-90b-vision-instruct para analizar imágenes.
    Nota: OCI solo permite 1 imagen por solicitud, se procesan secuencialmente.
    """
    try:
        # Parsear historial
        history = json.loads(conversation_history)
        
        # Convertir imágenes a base64
        images_base64 = []
        for image in images:
            image_bytes = await image.read()
            img_base64 = base64.b64encode(image_bytes).decode('utf-8')
            images_base64.append(img_base64)
        
        num_images = len(images_base64)
        print(f"Procesando {num_images} imagen(es) con modelo de visión...")
        
        # OCI solo permite 1 imagen por solicitud
        # Si hay múltiples imágenes, procesarlas secuencialmente
        all_responses = []
        
        for i, img_base64 in enumerate(images_base64):
            if num_images > 1:
                # Mensaje específico para cada imagen - SIN mencionar otras imágenes
                img_message = f"{message}. Responde solo sobre esta única imagen, de forma breve." if message.strip() else "Describe brevemente esta imagen."
            else:
                img_message = message if message.strip() else "¿Qué puedes decirme sobre esta imagen?"
            
            # Construir mensajes con UNA sola imagen
            messages = build_vision_messages(history, img_message, [img_base64])
            
            # Configurar la petición de chat
            chat_request = oci.generative_ai_inference.models.GenericChatRequest()
            chat_request.messages = messages
            chat_request.api_format = oci.generative_ai_inference.models.BaseChatRequest.API_FORMAT_GENERIC
            chat_request.max_tokens = 1000
            chat_request.temperature = 0.7
            chat_request.top_p = 0.9
            
            # Configurar detalles del chat - USAR MODELO DE VISIÓN
            chat_detail = oci.generative_ai_inference.models.ChatDetails()
            chat_detail.serving_mode = oci.generative_ai_inference.models.OnDemandServingMode(
                model_id=OCI_VISION_MODEL_ID
            )
            chat_detail.compartment_id = OCI_COMPARTMENT_ID
            chat_detail.chat_request = chat_request
            
            # Llamar a la API de OCI
            response = genai_client.chat(chat_detail)
            
            # Extraer respuesta
            img_response = ""
            if response.data.chat_response.choices:
                choice = response.data.chat_response.choices[0]
                if choice.message.content:
                    for content in choice.message.content:
                        if hasattr(content, 'text'):
                            img_response += content.text
            
            all_responses.append(img_response)
            print(f"Imagen {i+1}/{num_images} procesada")
        
        # Combinar respuestas si hay múltiples imágenes
        if num_images > 1:
            assistant_message = ""
            for i, resp in enumerate(all_responses):
                assistant_message += f"**Imagen {i+1}:**\n{resp}\n\n"
            assistant_message = assistant_message.strip()
        else:
            assistant_message = all_responses[0]
        
        print(f"Respuesta completa generada")
        
        # Construir contenido del usuario para el historial
        user_content = [
            {"type": "text", "text": message if message.strip() else "📷 Imagen(es) enviada(s)"}
        ]
        
        # Actualizar historial
        updated_history = history + [
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": assistant_message}
        ]
        
        return {
            "response": assistant_message,
            "conversation_history": updated_history
        }
        
    except oci.exceptions.ServiceError as e:
        print(f"Error OCI: {e.code} - {e.message}")
        
        # Si el modelo de visión falla, dar mensaje informativo
        if "NotAuthorizedOrNotFound" in str(e) or "InvalidParameter" in str(e):
            error_msg = (
                "No se pudo procesar la imagen. "
                "Verifica que el modelo de visión esté disponible en tu región. "
                f"Modelo configurado: {OCI_VISION_MODEL_ID}"
            )
            raise HTTPException(status_code=500, detail=error_msg)
        
        raise HTTPException(status_code=500, detail=str(e.message))
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)