// Variables globales
let uploadedDocuments = [];
let isConnected = false;
const serverUrl = "http://127.0.0.1:8000";

// Inicialización cuando el DOM esté cargado
document.addEventListener("DOMContentLoaded", function () {
  // Obtener elementos del DOM
  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");
  const typingIndicator = document.getElementById("typing-indicator");
  const serverStatus = document.getElementById("server-status");
  const reconnectButton = document.getElementById("reconnect-button");
  const fileInput = document.getElementById("file-input");
  const uploadButton = document.getElementById("upload-button");
  const uploadStatus = document.getElementById("upload-status");
  const documentsList = document.getElementById("documents-list");
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const closeSidebar = document.getElementById("close-sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const darkModeToggle = document.getElementById("dark-mode-toggle");

  // Inicializar la interfaz
  initInterface();

  // Función para inicializar la interfaz
  function initInterface() {
    // Cargar documentos existentes si los hay
    const savedDocuments = localStorage.getItem("uploadedDocuments");
    if (savedDocuments) {
      uploadedDocuments = JSON.parse(savedDocuments);
      updateDocumentsList();
    }

    // Cargar preferencia de modo oscuro
    const darkModeEnabled = localStorage.getItem("darkModeEnabled") === "true";
    if (darkModeEnabled) {
      document.body.classList.add("dark-mode");
      darkModeToggle.classList.add("active");
    }

    // Event listeners para el menú lateral
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.add("active");
      sidebarOverlay.classList.add("active");
    });

    closeSidebar.addEventListener("click", closeSidebarMenu);
    sidebarOverlay.addEventListener("click", closeSidebarMenu);

    // Event listener para modo oscuro
    darkModeToggle.addEventListener("click", toggleDarkMode);

    // Event listeners para mensajes
    sendButton.addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        sendMessage();
      }
    });

    reconnectButton.addEventListener("click", function () {
      // Limpiar mensajes de error
      const errorMessages = document.querySelectorAll(".error-message");
      errorMessages.forEach((msg) => msg.remove());
      checkServerConnection();
    });

    // Event listeners para subida de documentos
    uploadButton.addEventListener("click", function () {
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      if (fileInput.files.length > 0) {
        // Subir cada archivo seleccionado
        for (let i = 0; i < fileInput.files.length; i++) {
          uploadDocument(fileInput.files[i]);
        }
        // Resetear el input de archivos
        fileInput.value = "";
      }
    });

    // Intentar conectar al servidor al cargar la página
    checkServerConnection();
  }

  // Función para toggle del modo oscuro
  function toggleDarkMode() {
    // Cambiar la clase en el body en lugar de habilitar/deshabilitar CSS
    document.body.classList.toggle("dark-mode");

    // Actualizar el estado en localStorage
    const isDarkMode = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkModeEnabled", isDarkMode);

    // Actualizar el botón de toggle
    darkModeToggle.classList.toggle("active", isDarkMode);
  }

  // Función para cerrar el menú lateral
  function closeSidebarMenu() {
    sidebar.classList.remove("active");
    sidebarOverlay.classList.remove("active");
  }

  // Función para verificar la conexión al servidor
  async function checkServerConnection() {
    try {
      addMessage("Verificando conexión con el servidor...", false);

      const response = await fetch(`${serverUrl}/health`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        isConnected = true;
        serverStatus.classList.add("connected");
        userInput.disabled = false;
        sendButton.disabled = false;
        uploadButton.disabled = false;

        // Reemplazar el último mensaje con uno de conexión exitosa
        if (chatMessages.lastChild) {
          chatMessages.removeChild(chatMessages.lastChild);
        }

        addMessage(
          "¡Conexión exitosa con el servidor FastAPI! ¿En qué puedo ayudarte?",
          false
        );
      } else {
        showError(
          "El servidor respondió con un error. Código: " + response.status
        );
      }
    } catch (error) {
      showError(
        "No se pudo conectar al servidor. Asegúrate de que FastAPI esté ejecutándose en 127.0.0.1:8000"
      );
    }
  }

  // Función para mostrar errores
  function showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.classList.add("error-message");
    errorDiv.textContent = message;
    chatMessages.appendChild(errorDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Función para obtener la hora actual formateada
  function getCurrentTime() {
    const now = new Date();
    return `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
  }

  // Función para agregar mensaje al chat
  function addMessage(message, isUser) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");
    messageDiv.classList.add(isUser ? "user-message" : "bot-message");

    messageDiv.textContent = message;

    const timestamp = document.createElement("div");
    timestamp.classList.add("timestamp");
    timestamp.textContent = getCurrentTime();

    messageDiv.appendChild(timestamp);
    chatMessages.appendChild(messageDiv);

    // Scroll al final del chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
  }

  // Función para enviar mensaje al servidor
  async function sendMessageToServer(message) {
    if (!isConnected) {
      showError("No hay conexión con el servidor");
      return;
    }

    try {
      typingIndicator.style.display = "block";

      // Preparar datos a enviar (incluyendo documentos si existen)
      const requestData = {
        message: message,
        documents: uploadedDocuments.map((doc) => doc.serverPath),
      };

      // Enviar mensaje al servidor
      const response = await fetch(`${serverUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();

      typingIndicator.style.display = "none";

      // Mostrar respuesta del bot
      if (data.response) {
        addMessage(data.response, false);
      } else {
        addMessage("No recibí una respuesta válida del servidor", false);
      }
    } catch (error) {
      typingIndicator.style.display = "none";
      showError("Error al conectar con el servidor: " + error.message);
      isConnected = false;
      serverStatus.classList.remove("connected");
      userInput.disabled = true;
      sendButton.disabled = true;
      uploadButton.disabled = true;
    }
  }

  // Función para subir documentos al servidor
  async function uploadDocument(file) {
    if (!isConnected) {
      showError("No hay conexión con el servidor");
      return;
    }

    try {
      // Mostrar estado de subida
      uploadStatus.textContent = `Subiendo ${file.name}...`;
      uploadStatus.className = "upload-status uploading";

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${serverUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();

      // Guardar información del documento
      uploadedDocuments.push({
        name: file.name,
        serverPath: data.file_path,
        uploadedAt: new Date(),
      });

      // Guardar en localStorage
      localStorage.setItem(
        "uploadedDocuments",
        JSON.stringify(uploadedDocuments)
      );

      // Actualizar la lista de documentos
      updateDocumentsList();

      // Mostrar confirmación de subida exitosa
      uploadStatus.textContent = `${file.name} subido correctamente`;
      uploadStatus.className = "upload-status success";

      // Ocultar el estado después de 3 segundos
      setTimeout(() => {
        uploadStatus.textContent = "";
        uploadStatus.className = "upload-status";
      }, 3000);

      // Agregar mensaje sobre el documento subido
      addMessage(`He subido el documento: ${file.name}`, true);
    } catch (error) {
      uploadStatus.textContent = `Error al subir ${file.name}: ${error.message}`;
      uploadStatus.className = "upload-status error";

      // Ocultar el estado después de 5 segundos
      setTimeout(() => {
        uploadStatus.textContent = "";
        uploadStatus.className = "upload-status";
      }, 5000);
    }
  }

  // Actualizar la lista de documentos en la interfaz
  function updateDocumentsList() {
    // Limpiar lista
    documentsList.innerHTML = "";

    if (uploadedDocuments.length === 0) {
      documentsList.innerHTML =
        '<p class="no-documents">No hay documentos subidos</p>';
      return;
    }

    // Agregar cada documento a la lista
    uploadedDocuments.forEach((doc, index) => {
      const docElement = document.createElement("div");
      docElement.className = "document-item";
      docElement.innerHTML = `
        <div class="document-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z" fill="#6e8efb"/>
          </svg>
        </div>
        <div class="document-info">
          <span class="document-name">${doc.name}</span>
          <span class="document-date">${formatDate(doc.uploadedAt)}</span>
        </div>
        <button class="remove-document" data-index="${index}" title="Eliminar documento">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
          </svg>
        </button>
      `;
      documentsList.appendChild(docElement);
    });

    // Agregar event listeners a los botones de eliminar
    document.querySelectorAll(".remove-document").forEach((button) => {
      button.addEventListener("click", function () {
        const index = parseInt(this.getAttribute("data-index"));
        removeDocument(index);
      });
    });
  }

  // Formatear fecha para mostrar
  function formatDate(date) {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Eliminar documento de la lista
  async function removeDocument(index) {
    if (index >= 0 && index < uploadedDocuments.length) {
      const doc = uploadedDocuments[index];
      const docName = doc.name;
      const docPath = doc.serverPath;

      console.log("Intentando eliminar documento:", docName, "Ruta:", docPath);

      // Mostrar indicador de carga
      const deletingMessage = addMessage(
        `Eliminando documento: ${docName}...`,
        false
      );

      try {
        // Eliminar del servidor
        const response = await fetch(`${serverUrl}/delete-file`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file_path: docPath }),
        });

        console.log(
          "Respuesta del servidor:",
          response.status,
          response.statusText
        );

        const data = await response.json();
        console.log("Datos de respuesta:", data);

        if (!response.ok) {
          throw new Error(
            data.detail || `Error ${response.status} al eliminar el archivo`
          );
        }

        // Eliminar de la lista local
        uploadedDocuments.splice(index, 1);

        // Actualizar localStorage
        localStorage.setItem(
          "uploadedDocuments",
          JSON.stringify(uploadedDocuments)
        );

        // Actualizar interfaz
        updateDocumentsList();

        // Reemplazar mensaje de eliminación con confirmación
        deletingMessage.textContent = `He eliminado el documento: ${docName}`;
        const timestamp = deletingMessage.querySelector(".timestamp");
        if (timestamp) {
          timestamp.textContent = getCurrentTime();
        }

        console.log("Documento eliminado exitosamente");
      } catch (error) {
        console.error("Error eliminando documento:", error);

        // Reemplazar mensaje de eliminación con error
        deletingMessage.textContent = `Error al eliminar el documento ${docName}: ${error.message}`;
        deletingMessage.classList.remove("bot-message");
        deletingMessage.classList.add("error-message");

        const timestamp = deletingMessage.querySelector(".timestamp");
        if (timestamp) {
          timestamp.textContent = getCurrentTime();
        }
      }
    }
  }

  // Manejar el envío de mensajes
  function sendMessage() {
    const message = userInput.value.trim();

    if (message) {
      addMessage(message, true);
      userInput.value = "";

      sendMessageToServer(message);
    }
  }
});
