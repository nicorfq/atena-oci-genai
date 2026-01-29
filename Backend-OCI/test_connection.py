"""
Script de diagnóstico para verificar la conexión con OCI Generative AI
Ejecutar: python test_oci_connection.py
"""

import os
import sys
from pathlib import Path

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_status(check, status, message=""):
    icon = "✅" if status else "❌"
    print(f"{icon} {check}")
    if message:
        print(f"   └─ {message}")

def check_python_version():
    """Verificar versión de Python"""
    print_header("1. VERIFICANDO PYTHON")
    version = sys.version_info
    is_valid = version.major == 3 and version.minor >= 10
    print_status(
        f"Python {version.major}.{version.minor}.{version.micro}",
        is_valid,
        "Requerido: Python 3.10+" if not is_valid else ""
    )
    return is_valid

def check_dependencies():
    """Verificar dependencias instaladas"""
    print_header("2. VERIFICANDO DEPENDENCIAS")
    
    dependencies = {
        'oci': 'OCI SDK',
        'fastapi': 'FastAPI',
        'uvicorn': 'Uvicorn',
        'dotenv': 'python-dotenv (importar como dotenv)',
    }
    
    all_installed = True
    for module, name in dependencies.items():
        try:
            if module == 'dotenv':
                __import__('dotenv')
            else:
                __import__(module)
            print_status(f"{name}", True)
        except ImportError:
            print_status(f"{name}", False, f"Instalar: pip install {module if module != 'dotenv' else 'python-dotenv'}")
            all_installed = False
    
    return all_installed

def check_env_file():
    """Verificar archivo .env"""
    print_header("3. VERIFICANDO ARCHIVO .env")
    
    env_paths = [
        Path(".env"),
        Path("Backend-OCI/.env"),
        Path("../Backend-OCI/.env"),
    ]
    
    env_file = None
    for path in env_paths:
        if path.exists():
            env_file = path
            break
    
    if not env_file:
        print_status("Archivo .env", False, "No encontrado. Crear en Backend-OCI/.env")
        print("\n   Contenido requerido:")
        print("   ─────────────────────────────────────────")
        print("   OCI_CONFIG_FILE=C:/Users/TU_USUARIO/.oci/config")
        print("   OCI_CONFIG_PROFILE=DEFAULT")
        print("   OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxxxx")
        print("   OCI_SERVICE_ENDPOINT=https://inference.generativeai.us-chicago-1.oci.oraclecloud.com")
        print("   OCI_MODEL_ID=meta.llama-3.3-70b-instruct")
        return False
    
    print_status(f"Archivo .env encontrado", True, str(env_file.absolute()))
    
    # Cargar y verificar variables
    from dotenv import load_dotenv
    load_dotenv(env_file)
    
    required_vars = [
        'OCI_CONFIG_FILE',
        'OCI_CONFIG_PROFILE', 
        'OCI_COMPARTMENT_ID',
        'OCI_SERVICE_ENDPOINT',
        'OCI_MODEL_ID'
    ]
    
    all_vars_set = True
    print("\n   Variables de entorno:")
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Ocultar parte del OCID por seguridad
            display_value = value
            if 'ocid1' in value:
                display_value = value[:30] + "..." + value[-10:]
            print_status(f"  {var}", True, display_value)
        else:
            print_status(f"  {var}", False, "No configurado")
            all_vars_set = False
    
    return all_vars_set

def check_oci_config():
    """Verificar archivo de configuración OCI"""
    print_header("4. VERIFICANDO CONFIGURACIÓN OCI")
    
    from dotenv import load_dotenv
    load_dotenv()
    
    config_file = os.getenv('OCI_CONFIG_FILE', '~/.oci/config')
    config_file = os.path.expanduser(config_file)
    
    # En Windows, convertir path
    if sys.platform == 'win32':
        config_file = config_file.replace('/', '\\')
    
    config_path = Path(config_file)
    
    if not config_path.exists():
        print_status("Archivo config OCI", False, f"No encontrado en: {config_file}")
        print("\n   Ubicaciones comunes:")
        print("   - Windows: C:\\Users\\TU_USUARIO\\.oci\\config")
        print("   - Linux/Mac: ~/.oci/config")
        return False
    
    print_status("Archivo config OCI", True, str(config_path.absolute()))
    
    # Leer y verificar contenido
    try:
        import oci
        profile = os.getenv('OCI_CONFIG_PROFILE', 'DEFAULT')
        config = oci.config.from_file(str(config_path), profile)
        
        print(f"\n   Perfil: [{profile}]")
        print_status(f"  user", bool(config.get('user')), config.get('user', 'No configurado')[:50] + "...")
        print_status(f"  tenancy", bool(config.get('tenancy')), config.get('tenancy', 'No configurado')[:50] + "...")
        print_status(f"  region", bool(config.get('region')), config.get('region', 'No configurado'))
        print_status(f"  fingerprint", bool(config.get('fingerprint')), config.get('fingerprint', 'No configurado'))
        
        # Verificar key_file
        key_file = config.get('key_file', '')
        key_path = Path(os.path.expanduser(key_file))
        if key_path.exists():
            print_status(f"  key_file", True, str(key_path))
        else:
            print_status(f"  key_file", False, f"No encontrado: {key_file}")
            return False
        
        return True
        
    except Exception as e:
        print_status("Lectura de config", False, str(e))
        return False

def test_oci_connection():
    """Probar conexión real con OCI"""
    print_header("5. PROBANDO CONEXIÓN CON OCI")
    
    try:
        import oci
        from dotenv import load_dotenv
        load_dotenv()
        
        config_file = os.path.expanduser(os.getenv('OCI_CONFIG_FILE', '~/.oci/config'))
        profile = os.getenv('OCI_CONFIG_PROFILE', 'DEFAULT')
        
        print("   Cargando configuración...")
        config = oci.config.from_file(config_file, profile)
        
        print("   Validando configuración...")
        oci.config.validate_config(config)
        print_status("Configuración válida", True)
        
        # Probar conexión con Identity (más simple que GenAI)
        print("\n   Probando autenticación...")
        identity = oci.identity.IdentityClient(config)
        user = identity.get_user(config['user']).data
        print_status("Autenticación exitosa", True, f"Usuario: {user.name}")
        
        return True
        
    except oci.exceptions.ServiceError as e:
        print_status("Conexión OCI", False, f"Error de servicio: {e.message}")
        return False
    except Exception as e:
        print_status("Conexión OCI", False, str(e))
        return False

def test_generative_ai():
    """Probar conexión con Generative AI"""
    print_header("6. PROBANDO GENERATIVE AI")
    
    try:
        import oci
        from dotenv import load_dotenv
        load_dotenv()
        
        config_file = os.path.expanduser(os.getenv('OCI_CONFIG_FILE', '~/.oci/config'))
        profile = os.getenv('OCI_CONFIG_PROFILE', 'DEFAULT')
        compartment_id = os.getenv('OCI_COMPARTMENT_ID')
        service_endpoint = os.getenv('OCI_SERVICE_ENDPOINT')
        model_id = os.getenv('OCI_MODEL_ID', 'meta.llama-3.3-70b-instruct')
        
        if not compartment_id:
            print_status("Compartment ID", False, "No configurado en .env")
            return False
        
        print(f"   Endpoint: {service_endpoint}")
        print(f"   Modelo: {model_id}")
        print(f"   Compartment: {compartment_id[:40]}...")
        
        config = oci.config.from_file(config_file, profile)
        
        print("\n   Inicializando cliente GenAI...")
        genai_client = oci.generative_ai_inference.GenerativeAiInferenceClient(
            config=config,
            service_endpoint=service_endpoint,
            retry_strategy=oci.retry.NoneRetryStrategy(),
            timeout=(10, 60)
        )
        print_status("Cliente inicializado", True)
        
        # Enviar mensaje de prueba
        print("\n   Enviando mensaje de prueba...")
        
        # Construir mensaje
        user_content = oci.generative_ai_inference.models.TextContent()
        user_content.text = "Responde solo con: OK"
        
        user_message = oci.generative_ai_inference.models.UserMessage()
        user_message.content = [user_content]
        
        chat_request = oci.generative_ai_inference.models.GenericChatRequest()
        chat_request.messages = [user_message]
        chat_request.api_format = oci.generative_ai_inference.models.BaseChatRequest.API_FORMAT_GENERIC
        chat_request.max_tokens = 50
        chat_request.temperature = 0.7
        
        chat_detail = oci.generative_ai_inference.models.ChatDetails()
        chat_detail.serving_mode = oci.generative_ai_inference.models.OnDemandServingMode(
            model_id=model_id
        )
        chat_detail.compartment_id = compartment_id
        chat_detail.chat_request = chat_request
        
        response = genai_client.chat(chat_detail)
        
        # Extraer respuesta
        if response.data.chat_response.choices:
            choice = response.data.chat_response.choices[0]
            if choice.message.content:
                response_text = ""
                for content in choice.message.content:
                    if hasattr(content, 'text'):
                        response_text += content.text
                
                print_status("Respuesta recibida", True, f'"{response_text.strip()}"')
                return True
        
        print_status("Respuesta", False, "Sin contenido")
        return False
        
    except oci.exceptions.ServiceError as e:
        print_status("Generative AI", False)
        print(f"\n   Error de servicio OCI:")
        print(f"   └─ Código: {e.code}")
        print(f"   └─ Mensaje: {e.message}")
        
        if "NotAuthorizedOrNotFound" in str(e):
            print("\n   💡 Posible solución:")
            print("   - Verificar que el Compartment ID es correcto")
            print("   - Verificar políticas IAM:")
            print("     allow any-user to manage generative-ai-family in compartment <nombre>")
        
        if "InvalidParameter" in str(e):
            print("\n   💡 Posible solución:")
            print("   - Verificar que el modelo existe en tu región")
            print("   - Modelos disponibles: meta.llama-3.3-70b-instruct")
        
        return False
        
    except Exception as e:
        print_status("Generative AI", False, str(e))
        return False

def main():
    print("\n" + "="*60)
    print("   🦉 DIAGNÓSTICO DE CONEXIÓN OCI - ATENA")
    print("="*60)
    
    results = []
    
    results.append(("Python", check_python_version()))
    results.append(("Dependencias", check_dependencies()))
    results.append(("Archivo .env", check_env_file()))
    results.append(("Config OCI", check_oci_config()))
    results.append(("Conexión OCI", test_oci_connection()))
    results.append(("Generative AI", test_generative_ai()))
    
    # Resumen
    print_header("RESUMEN")
    
    all_passed = True
    for name, passed in results:
        print_status(name, passed)
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 ¡Todo configurado correctamente!")
        print("   Puedes iniciar el backend con: python main.py")
    else:
        print("\n⚠️  Hay problemas que resolver antes de continuar.")
        print("   Revisa los errores marcados con ❌ arriba.")
    
    print("\n")

if __name__ == "__main__":
    main()