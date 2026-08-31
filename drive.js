/**
 * GESTOR DE RECURSOS GOOGLE DRIVE (Vanilla JS)
 * MATH MINDS
 */
class GoogleDriveManager {
  constructor(options = {}) {
    this.breadcrumbsEl = document.getElementById(options.breadcrumbsId || 'drive-breadcrumbs');
    this.contentEl = document.getElementById(options.contentId || 'drive-content');
    this.endpoint = options.endpoint || 'obtener_fichas.php';
    this.rol = options.rol || 'estudiante';
    this.usuarioId = options.usuarioId || 0;
    this.onOpenFile = options.onOpenFile || null;

    // Pila de navegación de carpetas: [{ id: 0, nombre: 'Inicio' }]
    this.ruta = [
      { id: 0, nombre: options.rootName || 'Inicio' }
    ];

    this.iconos = {
      carpeta: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
      archivo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
      imagen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
      pdf: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>`
    };
  }

  // Inicializar cargando el directorio raíz
  init() {
    this.cargarContenido(0);
  }

  // Actualizar credenciales de sesión si cambian
  setUsuario(usuarioId, rol = 'estudiante') {
    this.usuarioId = usuarioId;
    this.rol = rol;
  }

  // Cargar contenido desde el backend PHP
  async cargarContenido(carpetaId = 0) {
    this.mostrarCargando();

    try {
      const url = `${this.endpoint}?carpeta_id=${carpetaId}&usuario_id=${this.usuarioId}&rol=${this.rol}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        this.mostrarError(data.mensaje || 'Error al obtener los recursos.');
        return;
      }

      this.renderizarBreadcrumbs();
      this.renderizarContenido(data.carpetas || [], data.archivos || []);

    } catch (error) {
      console.error('Error al cargar contenido:', error);
      this.mostrarError('No se pudo conectar con el servidor.');
    }
  }

  // Renderizar Migas de Pan dinámicamente
  renderizarBreadcrumbs() {
    if (!this.breadcrumbsEl) return;
    this.breadcrumbsEl.innerHTML = '';

    this.ruta.forEach((item, index) => {
      const esUltimo = index === this.ruta.length - 1;

      const node = document.createElement('button');
      node.type = 'button';
      node.className = `drive-breadcrumb-node ${esUltimo ? 'active' : ''}`;
      node.textContent = (index === 0 ? '📁 ' : '') + item.nombre;

      if (!esUltimo) {
        node.addEventListener('click', () => {
          this.navegarANivel(index);
        });
      }

      this.breadcrumbsEl.appendChild(node);

      if (!esUltimo) {
        const sep = document.createElement('span');
        sep.className = 'drive-breadcrumb-sep';
        sep.textContent = '>';
        this.breadcrumbsEl.appendChild(sep);
      }
    });
  }

  // Volver a un nivel anterior en la ruta
  navegarANivel(indice) {
    this.ruta = this.ruta.slice(0, indice + 1);
    const destino = this.ruta[this.ruta.length - 1];
    this.cargarContenido(destino.id);
  }

  // Abrir una subcarpeta
  abrirCarpeta(carpetaId, nombre) {
    this.ruta.push({ id: carpetaId, nombre: nombre });
    this.cargarContenido(carpetaId);
  }

  // Abrir un archivo
  abrirArchivo(archivo) {
    if (typeof this.onOpenFile === 'function') {
      this.onOpenFile(archivo);
      return;
    }
    window.open(`ver_archivo.php?id=${archivo.id}`, '_blank');
  }

  // Renderizar tarjetas de carpetas y archivos
  renderizarContenido(carpetas, archivos) {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = '';

    const total = carpetas.length + archivos.length;

    if (total === 0) {
      this.contentEl.innerHTML = `
        <div class="drive-status-state">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
          </svg>
          <p>Esta carpeta está vacía</p>
        </div>
      `;
      return;
    }

    // --- CARPETAS ---
    if (carpetas.length > 0) {
      const seccionCarpetas = document.createElement('div');
      seccionCarpetas.innerHTML = `<div class="drive-section-title">📁 Carpetas (${carpetas.length})</div>`;

      const gridCarpetas = document.createElement('div');
      gridCarpetas.className = 'drive-grid-layout';

      carpetas.forEach(c => {
        const card = document.createElement('div');
        card.className = 'drive-item-card folder-type';
        card.title = c.nombre;

        card.innerHTML = `
          <div class="drive-item-icon folder">
            ${this.iconos.carpeta}
          </div>
          <div class="drive-item-info">
            <span class="drive-item-title">${this.escapeHTML(c.nombre)}</span>
            <span class="drive-item-sub">Carpeta</span>
          </div>
        `;

        card.addEventListener('click', () => {
          this.abrirCarpeta(c.id, c.nombre);
        });

        gridCarpetas.appendChild(card);
      });

      seccionCarpetas.appendChild(gridCarpetas);
      this.contentEl.appendChild(seccionCarpetas);
    }

    // --- ARCHIVOS ---
    if (archivos.length > 0) {
      const seccionArchivos = document.createElement('div');
      seccionArchivos.innerHTML = `<div class="drive-section-title">📄 Archivos (${archivos.length})</div>`;

      const gridArchivos = document.createElement('div');
      gridArchivos.className = 'drive-grid-layout';

      archivos.forEach(a => {
        const card = document.createElement('div');
        card.className = 'drive-item-card file-type';
        const titulo = a.titulo || 'Archivo';
        card.title = titulo;

        const infoIcon = this.obtenerIconoYClase(a.ruta_archivo || titulo);

        card.innerHTML = `
          <div class="drive-item-icon ${infoIcon.clase}">
            ${infoIcon.svg}
          </div>
          <div class="drive-item-info">
            <span class="drive-item-title">${this.escapeHTML(titulo)}</span>
            <span class="drive-item-sub">${infoIcon.tipoTexto}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          this.abrirArchivo(a);
        });

        gridArchivos.appendChild(card);
      });

      seccionArchivos.appendChild(gridArchivos);
      this.contentEl.appendChild(seccionArchivos);
    }
  }

  // Detectar tipo e icono del archivo
  obtenerIconoYClase(nombreArchivo) {
    const ext = (nombreArchivo || '').split('.').pop().toLowerCase();
    const imgs = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
    
    if (imgs.includes(ext)) {
      return { svg: this.iconos.imagen, clase: 'image', tipoTexto: 'Imagen' };
    }
    if (ext === 'pdf') {
      return { svg: this.iconos.pdf, clase: 'pdf', tipoTexto: 'Documento PDF' };
    }
    return { svg: this.iconos.archivo, clase: 'file', tipoTexto: 'Recurso' };
  }

  mostrarCargando() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="drive-status-state">
        <div class="drive-spinner"></div>
        <p>Cargando contenido...</p>
      </div>
    `;
  }

  mostrarError(msg) {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="drive-status-state" style="color: #ef4444;">
        <p>⚠️ ${this.escapeHTML(msg)}</p>
      </div>
    `;
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Exportación global para navegadores
window.GoogleDriveManager = GoogleDriveManager;
