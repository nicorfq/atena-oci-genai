'use client'

import { useState, useRef, useEffect, DragEvent } from 'react'
import styles from './page.module.css'

interface Message {
  role: 'user' | 'assistant'
  content: string | MessageContent[]
  imagePreviews?: string[]
  timestamp?: number // Nuevo campo para la hora
}

interface MessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
    detail: string
  }
}

interface SavedChat {
  id: string
  title: string
  messages: Message[]
  conversationHistory: Message[]
  createdAt: number
}

// Traducciones para los diferentes idiomas
const translations = {
  'es-ES': {
    welcomeTitle: 'Hola, ¿en qué puedo ayudarte?',
    welcomeSubtitle: 'Soy Atena, tu asistente virtual. Pregúntame lo que necesites o comparte una imagen.',
    placeholder: 'Escribe un mensaje...',
    placeholderWithImages: 'Añade un mensaje o envía las imágenes...',
    disclaimer: 'Atena puede cometer errores. Verifica la información importante.',
    history: 'Historial',
    newChat: 'Nuevo chat',
    clearHistory: 'Limpiar todo el historial',
    clearHistoryConfirm: '¿Estás seguro de que quieres eliminar todo el historial?',
    tooltips: {
      close: 'Cerrar',
      deleteChat: 'Eliminar chat',
      menu: 'Historial',
      lightMode: 'Modo claro',
      darkMode: 'Modo oscuro',
      attach: 'Adjuntar imagen',
      removeImage: 'Eliminar imagen',
      record: 'Grabar voz',
      stopRecord: 'Detener grabación',
      language: 'Idioma de voz',
      send: 'Enviar mensaje',
      copy: 'Copiar mensaje',
    },
    dropImage: 'Suelta la imagen aquí',
    imagesSent: '📷 Imagen(es) enviada(s)',
    errorMessage: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
  },
  'en-US': {
    welcomeTitle: 'Hello, how can I help you?',
    welcomeSubtitle: "I'm Atena, your virtual assistant. Ask me anything or share an image.",
    placeholder: 'Write a message...',
    placeholderWithImages: 'Add a message or send the images...',
    disclaimer: 'Atena can make mistakes. Verify important information.',
    history: 'History',
    newChat: 'New chat',
    clearHistory: 'Clear all history',
    clearHistoryConfirm: 'Are you sure you want to delete all history?',
    tooltips: {
      close: 'Close',
      deleteChat: 'Delete chat',
      menu: 'History',
      lightMode: 'Light mode',
      darkMode: 'Dark mode',
      attach: 'Attach image',
      removeImage: 'Remove image',
      record: 'Record voice',
      stopRecord: 'Stop recording',
      language: 'Voice language',
      send: 'Send message',
      copy: 'Copy message',
    },
    dropImage: 'Drop the image here',
    imagesSent: '📷 Image(s) sent',
    errorMessage: 'Sorry, there was an error processing your message. Please try again.',
  },
  'pt-BR': {
    welcomeTitle: 'Olá, como posso ajudá-lo?',
    welcomeSubtitle: 'Sou Atena, sua assistente virtual. Pergunte-me o que precisar ou compartilhe uma imagem.',
    placeholder: 'Escreva uma mensagem...',
    placeholderWithImages: 'Adicione uma mensagem ou envie as imagens...',
    disclaimer: 'Atena pode cometer erros. Verifique informações importantes.',
    history: 'Histórico',
    newChat: 'Novo chat',
    clearHistory: 'Limpar todo o histórico',
    clearHistoryConfirm: 'Tem certeza de que deseja excluir todo o histórico?',
    tooltips: {
      close: 'Fechar',
      deleteChat: 'Excluir chat',
      menu: 'Histórico',
      lightMode: 'Modo claro',
      darkMode: 'Modo escuro',
      attach: 'Anexar imagem',
      removeImage: 'Remover imagem',
      record: 'Gravar voz',
      stopRecord: 'Parar gravação',
      language: 'Idioma de voz',
      send: 'Enviar mensagem',
      copy: 'Copiar mensagem',
    },
    dropImage: 'Solte a imagem aqui',
    imagesSent: '📷 Imagem(ns) enviada(s)',
    errorMessage: 'Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente.',
  },
}

type Language = 'es-ES' | 'en-US' | 'pt-BR'

// Componente para mostrar la hora o fecha del mensaje
const MessageTimestamp = ({ timestamp }: { timestamp?: number }) => {
  if (!timestamp) return null
  
  const formatTimestamp = (ts: number) => {
    const messageDate = new Date(ts)
    const today = new Date()
    
    // Comparar si es el mismo día
    const isToday = 
      messageDate.getDate() === today.getDate() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getFullYear() === today.getFullYear()
    
    if (isToday) {
      // Si es hoy, mostrar la hora
      return messageDate.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit'
      })
    } else {
      // Verificar si es del mismo año
      const isSameYear = messageDate.getFullYear() === today.getFullYear()
      
      if (isSameYear) {
        // Mismo año: mostrar día y mes (ej: "26 ene")
        return messageDate.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short'
        })
      } else {
        // Otro año: mostrar día, mes y año (ej: "26 ene 2024")
        return messageDate.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      }
    }
  }

  // Formato completo para el tooltip (ej: "Jan 27, 2026, 11:02 AM")
  const getFullDateTime = (ts: number) => {
    const messageDate = new Date(ts)
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <span 
      className={styles.messageTimestamp}
      title={getFullDateTime(timestamp)}
    >
      {formatTimestamp(timestamp)}
    </span>
  )
}

// Componente para botón de copiar mensaje completo
const CopyMessageButton = ({ content, tooltip }: { content: string; tooltip: string }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error al copiar:', err)
    }
  }

  return (
    <button
      onClick={copyToClipboard}
      className={styles.copyMessageButton}
      aria-label={tooltip}
      title={tooltip}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  )
}

// Componente para renderizar mensaje con bloques de código
const MessageWithCode = ({ content }: { content: string }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const copyToClipboard = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Error al copiar:', err)
    }
  }

  // Regex para detectar bloques de código con o sin lenguaje
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = []
  let lastIndex = 0
  let match
  let codeIndex = 0

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Agregar texto antes del bloque de código
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
    }
    // Agregar bloque de código
    parts.push({ type: 'code', content: match[2].trim(), language: match[1] || undefined })
    lastIndex = match.index + match[0].length
  }

  // Agregar texto restante
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) })
  }

  // Si no hay bloques de código, retornar texto simple
  if (parts.length === 0) {
    return <>{content}</>
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>
        } else {
          const currentCodeIndex = codeIndex++
          return (
            <div key={index} className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeLanguage}>{part.language || 'código'}</span>
                <button
                  onClick={() => copyToClipboard(part.content, currentCodeIndex)}
                  className={styles.copyButton}
                  aria-label="Copiar código"
                >
                  {copiedIndex === currentCodeIndex ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <pre className={styles.codeContent}><code>{part.content}</code></pre>
            </div>
          )
        }
      })}
    </>
  )
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<Message[]>([])
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceLang, setVoiceLang] = useState<Language>('es-ES')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [savedChats, setSavedChats] = useState<SavedChat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  // Obtener traducciones según el idioma seleccionado
  const t = translations[voiceLang]

  // Cargar tema guardado al iniciar
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
    
    // Cargar chats guardados
    const chats = localStorage.getItem('atena-chats')
    if (chats) {
      setSavedChats(JSON.parse(chats))
    }
  }, [])

  // Guardar chat actual cuando cambian los mensajes
  useEffect(() => {
    if (messages.length > 0 && currentChatId) {
      const updatedChats = savedChats.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages, conversationHistory }
          : chat
      )
      setSavedChats(updatedChats)
      localStorage.setItem('atena-chats', JSON.stringify(updatedChats))
    }
  }, [messages, conversationHistory])

  // Crear nuevo chat
  const createNewChat = () => {
    if (messages.length > 0 && currentChatId) {
      // Guardar chat actual antes de crear uno nuevo
      saveCurrentChat()
    }
    
    const newId = Date.now().toString()
    setCurrentChatId(newId)
    setMessages([])
    setConversationHistory([])
    clearAllImages()
    setSidebarOpen(false)
  }

  // Guardar chat actual
  const saveCurrentChat = () => {
    if (messages.length === 0) return
    
    const firstMessage = getMessageText(messages[0].content)
    const title = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')
    
    const existingIndex = savedChats.findIndex(c => c.id === currentChatId)
    
    if (existingIndex >= 0) {
      const updatedChats = [...savedChats]
      updatedChats[existingIndex] = {
        ...updatedChats[existingIndex],
        messages,
        conversationHistory
      }
      setSavedChats(updatedChats)
      localStorage.setItem('atena-chats', JSON.stringify(updatedChats))
    } else if (currentChatId) {
      const newChat: SavedChat = {
        id: currentChatId,
        title,
        messages,
        conversationHistory,
        createdAt: Date.now()
      }
      const updatedChats = [newChat, ...savedChats]
      setSavedChats(updatedChats)
      localStorage.setItem('atena-chats', JSON.stringify(updatedChats))
    }
  }

  // Cargar chat guardado
  const loadChat = (chat: SavedChat) => {
    if (messages.length > 0 && currentChatId) {
      saveCurrentChat()
    }
    setCurrentChatId(chat.id)
    setMessages(chat.messages)
    setConversationHistory(chat.conversationHistory)
    setSidebarOpen(false)
  }

  // Eliminar chat
  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updatedChats = savedChats.filter(c => c.id !== chatId)
    setSavedChats(updatedChats)
    localStorage.setItem('atena-chats', JSON.stringify(updatedChats))
    
    if (currentChatId === chatId) {
      setCurrentChatId(null)
      setMessages([])
      setConversationHistory([])
    }
  }

  // Limpiar todo el historial
  const clearAllHistory = () => {
    if (confirm(t.clearHistoryConfirm)) {
      setSavedChats([])
      localStorage.removeItem('atena-chats')
      setCurrentChatId(null)
      setMessages([])
      setConversationHistory([])
    }
  }

  // Cambiar tema
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  // Manejar selección de imagen
  const handleImageSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validImages = fileArray.filter(file => file.type.startsWith('image/'))
    
    validImages.forEach(file => {
      const maxSize = 4 * 1024 * 1024 // 4MB
      if (file.size > maxSize) {
        compressImage(file).then(compressedFile => {
          addImage(compressedFile)
        })
      } else {
        addImage(file)
      }
    })
  }

  const addImage = (file: File) => {
    setSelectedImages(prev => [...prev, file])
    createPreview(file)
  }

  const createPreview = (file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreviews(prev => [...prev, reader.result as string])
    }
    reader.readAsDataURL(file)
  }

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        const maxDim = 1024
        let { width, height } = img
        
        if (width > height && width > maxDim) {
          height = (height * maxDim) / width
          width = maxDim
        } else if (height > maxDim) {
          width = (width * maxDim) / height
          height = maxDim
        }
        
        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          } else {
            resolve(file)
          }
        }, 'image/jpeg', 0.8)
      }
      
      img.src = URL.createObjectURL(file)
    })
  }

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const clearAllImages = () => {
    setSelectedImages([])
    setImagePreviews([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Reconocimiento de voz
  const startListening = () => {
    console.log('Iniciando reconocimiento de voz...')
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    recognitionRef.current = new SpeechRecognition()
    
    recognitionRef.current.lang = voiceLang
    recognitionRef.current.continuous = true
    recognitionRef.current.interimResults = true

    recognitionRef.current.onstart = () => {
      console.log('Escuchando...')
      setIsListening(true)
    }

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        }
      }
      
      if (finalTranscript) {
        console.log('Texto detectado:', finalTranscript)
        setInput(prev => prev + (prev ? ' ' : '') + finalTranscript)
      }
    }

    recognitionRef.current.onerror = (event: any) => {
      console.error('Error de reconocimiento:', event.error)
      if (event.error !== 'no-speech') {
        setIsListening(false)
      }
    }

    recognitionRef.current.onend = () => {
      console.log('Reconocimiento finalizado')
      setIsListening(false)
    }

    recognitionRef.current.start()
    console.log('Recognition started')
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  // Drag & Drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleImageSelect(files)
    }
  }

  const sendMessage = async () => {
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return

    // Crear ID de chat si es nuevo
    if (!currentChatId) {
      setCurrentChatId(Date.now().toString())
    }

    const userMessage = input.trim()
    const currentImagePreviews = [...imagePreviews]
    const currentImages = [...selectedImages]
    const messageTimestamp = Date.now() // Capturar el timestamp
    
    // Limpiar inmediatamente
    setInput('')
    clearAllImages()
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage || t.imagesSent,
      imagePreviews: currentImagePreviews.length > 0 ? currentImagePreviews : undefined,
      timestamp: messageTimestamp // Agregar timestamp al mensaje del usuario
    }])
    setIsLoading(true)

    try {
      let response

      if (currentImages.length > 0) {
        // Enviar con imágenes
        const formData = new FormData()
        formData.append('message', userMessage)
        formData.append('conversation_history', JSON.stringify(conversationHistory))
        currentImages.forEach(image => {
          formData.append('images', image)
        })

        response = await fetch('http://localhost:8000/chat-with-image', {
          method: 'POST',
          body: formData,
        })
      } else {
        // Enviar solo texto
        response = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            conversation_history: conversationHistory,
          }),
        })
      }

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now() // Agregar timestamp al mensaje del asistente
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Actualizar historial de conversación
      const newUserMessage: Message = {
        role: 'user',
        content: currentImages.length > 0 
          ? [
              ...(userMessage ? [{ type: 'text' as const, text: userMessage }] : []),
              ...currentImages.map(() => ({
                type: 'image_url' as const,
                image_url: { url: '[imagen]', detail: 'high' }
              }))
            ]
          : userMessage
      }
      
      setConversationHistory(prev => [...prev, newUserMessage, assistantMessage])

    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t.errorMessage,
        timestamp: Date.now()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    if (messages.length > 0 && currentChatId) {
      saveCurrentChat()
    }
    createNewChat()
  }

  const getMessageText = (content: string | MessageContent[]): string => {
    if (typeof content === 'string') return content
    const textContent = content.find(c => c.type === 'text')
    return textContent?.text || ''
  }

  return (
    <>
      {/* Sidebar */}
      <div className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h2>{t.history}</h2>
          <button onClick={() => setSidebarOpen(false)} className={styles.closeSidebar} title={t.tooltips.close}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <button onClick={createNewChat} className={styles.newChatButton}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          {t.newChat}
        </button>

        <div className={styles.chatList}>
          {savedChats.map(chat => (
            <div
              key={chat.id}
              onClick={() => loadChat(chat)}
              className={`${styles.chatItem} ${currentChatId === chat.id ? styles.chatItemActive : ''}`}
            >
              <span className={styles.chatTitle}>{chat.title}</span>
              <button
                onClick={(e) => deleteChat(chat.id, e)}
                className={styles.deleteChat}
                aria-label={t.tooltips.deleteChat}
                title={t.tooltips.deleteChat}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {savedChats.length > 0 && (
          <button onClick={clearAllHistory} className={styles.clearHistoryButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            {t.clearHistory}
          </button>
        )}
      </div>

      {/* Overlay para cerrar sidebar en móvil */}
      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}

      <main 
        className={`${styles.main} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className={styles.dragOverlay}>
            <div className={styles.dragContent}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              <span>{t.dropImage}</span>
            </div>
          </div>
        )}

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button onClick={() => setSidebarOpen(true)} className={styles.menuButton} aria-label={t.tooltips.menu} title={t.tooltips.menu}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            </button>
            <div className={styles.logo}>
              <img src="/owl-logo.png" alt="Atena" className={styles.logoImage} />
              <span className={styles.logoText}>Atena</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button 
              onClick={toggleTheme} 
              className={styles.themeButton}
              aria-label={theme === 'dark' ? t.tooltips.lightMode : t.tooltips.darkMode}
              title={theme === 'dark' ? t.tooltips.lightMode : t.tooltips.darkMode}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          {messages.length > 0 && (
            <button onClick={clearChat} className={styles.clearButton}>
              {t.newChat}
            </button>
          )}
        </div>
      </header>

      {/* Chat container */}
      <div className={styles.chatContainer}>
        {messages.length === 0 ? (
          <div className={styles.welcome}>
            <h1 className={styles.welcomeTitle}>{t.welcomeTitle}</h1>
            <p className={styles.welcomeSubtitle}>
              {t.welcomeSubtitle}
            </p>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`${styles.message} ${styles[message.role]} fade-in`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {message.role === 'assistant' && (
                  <img src="/owl-logo.png" alt="Atena" className={styles.messageIcon} />
                )}
                <div className={styles.messageWrapper}>
                  <div className={styles.messageContent}>
                    {message.imagePreviews && message.imagePreviews.length > 0 && (
                      <div className={styles.messageImages}>
                        {message.imagePreviews.map((img, imgIndex) => (
                          <img 
                            key={imgIndex}
                            src={img} 
                            alt={`Imagen adjunta ${imgIndex + 1}`} 
                            className={styles.messageImage}
                          />
                        ))}
                      </div>
                    )}
                    <MessageWithCode content={getMessageText(message.content)} />
                  </div>
                  <div className={styles.messageActions}>
                    <MessageTimestamp timestamp={message.timestamp} />
                    <CopyMessageButton content={getMessageText(message.content)} tooltip={t.tooltips.copy} />
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className={`${styles.message} ${styles.assistant} fade-in`}>
                <img src="/owl-logo.png" alt="Atena" className={styles.messageIcon} />
                <div className={styles.typing}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className={styles.inputWrapper}>
        {/* Image previews */}
        {imagePreviews.length > 0 && (
          <div className={styles.imagePreviewsContainer}>
            {imagePreviews.map((preview, index) => (
              <div key={index} className={styles.imagePreviewItem}>
                <img src={preview} alt={`Preview ${index + 1}`} className={styles.imagePreview} />
                <button onClick={() => removeImage(index)} className={styles.removeImageButton} title={t.tooltips.removeImage}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className={styles.inputContainer}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleImageSelect(e.target.files)}
            accept="image/*"
            multiple
            className={styles.fileInput}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={styles.attachButton}
            aria-label={t.tooltips.attach}
            title={t.tooltips.attach}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <button 
            onClick={isListening ? stopListening : startListening}
            className={`${styles.micButton} ${isListening ? styles.listening : ''}`}
            aria-label={isListening ? t.tooltips.stopRecord : t.tooltips.record}
            title={isListening ? t.tooltips.stopRecord : t.tooltips.record}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <select 
            value={voiceLang}
            onChange={(e) => setVoiceLang(e.target.value as Language)}
            className={styles.langSelect}
            aria-label={t.tooltips.language}
            title={t.tooltips.language}
          >
            <option value="es-ES">ES</option>
            <option value="en-US">EN</option>
            <option value="pt-BR">PT</option>
          </select>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedImages.length > 0 ? t.placeholderWithImages : t.placeholder}
            className={styles.input}
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && selectedImages.length === 0) || isLoading}
            className={styles.sendButton}
            aria-label={t.tooltips.send}
            title={t.tooltips.send}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className={styles.disclaimer}>
          {t.disclaimer}
        </p>
      </div>
    </main>
    </>
  )
}
