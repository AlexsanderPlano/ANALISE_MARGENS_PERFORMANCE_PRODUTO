/**
 * Mapa UI v2.0 — Modal com Ferramentas de Análise Visual
 * 6 ferramentas (do amplo ao específico):
 *   Design System | Estrutura DOM | Navegação | Heatmap | Interativos | Inspetor
 * Apenas Desktop (auto-detecta dispositivo)
 */

(function() {
    'use strict';

    // =========================================================
    // CONFIGURAÇÃO
    // =========================================================
    const CONFIG = {
        cores: {
            bg: '#0f172a',
            bgCard: '#1e293b',
            bgHover: '#334155',
            texto: '#f8fafc',
            textoMuted: '#94a3b8',
            accent: '#3b82f6',
            accentHover: '#2563eb',
            verde: '#22c55e',
            amarelo: '#fbbf24',
            laranja: '#f97316',
            rosa: '#ec4899',
            roxo: '#a78bfa',
            cyan: '#22d3ee',
            vermelho: '#ef4444',
            borda: '#334155'
        },
        modal: {
            width: '750px',
            height: '96vh',
            sidebarWidth: '68px'
        },
        zIndex: {
            overlay: 99990,
            modal: 99995,
            highlight: 99989,
            toast: 99999,
            btn: 99988
        }
    };

    // =========================================================
    // ESTADO GLOBAL
    // =========================================================
    const state = {
        modalAberto: false,
        ferramentaAtiva: 'arvore',
        inspetorAtivo: false,
        elementoDestacado: null,
        elementoInspecionado: null,
        funcaoCapturada: null,
        heatmapAtivo: false,
        heatmapOverlays: [],
        ultimoScan: null
    };

    // Registro de event listeners (monkey-patch)
    const eventListenersMap = new WeakMap();
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        try {
            if (this instanceof Element) {
                if (!eventListenersMap.has(this)) eventListenersMap.set(this, []);
                eventListenersMap.get(this).push({
                    type,
                    name: (typeof listener === 'function' ? listener.name : '') || 'anonima'
                });
            }
        } catch(e) {}
        return originalAddEventListener.call(this, type, listener, options);
    };

    // Referências DOM
    let elModal, elSidebar, elConteudo, elOverlayModal, elHighlight, elBtnFlutuante, elToast;

    // =========================================================
    // UTILITÁRIOS
    // =========================================================

    function isDesktop() {
        return window.innerWidth > 1024 &&
            !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function obterSeletor(el) {
        if (!el || !el.tagName) return '?';
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        else if (el.classList.length > 0) s += '.' + Array.from(el.classList).join('.');
        return s;
    }

    function obterHierarquia(el, niveis = 4) {
        const h = [];
        let p = el;
        while (p && p !== document.body && h.length < niveis) {
            let nome = p.tagName.toLowerCase();
            if (p.id) nome += '#' + p.id;
            else if (p.classList.length > 0) nome += '.' + p.classList[0];
            h.unshift(nome);
            p = p.parentElement;
        }
        return h.join(' > ');
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
        const match = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return rgb;
        return '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }

    function showToast(msg) {
        if (!elToast) {
            elToast = document.createElement('div');
            elToast.id = 'inspetor-toast';
            elToast.style.cssText = `
                position: fixed; bottom: 80px; right: 20px; z-index: ${CONFIG.zIndex.toast};
                background: ${CONFIG.cores.bgCard}; color: ${CONFIG.cores.texto};
                padding: 12px 20px; border-radius: 8px; font-size: 13px;
                font-family: system-ui, sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
            `;
            document.body.appendChild(elToast);
        }
        elToast.textContent = msg;
        elToast.style.opacity = '1';
        clearTimeout(elToast._timer);
        elToast._timer = setTimeout(() => elToast.style.opacity = '0', 2500);
    }

    function copiarTexto(texto) {
        navigator.clipboard.writeText(texto).then(() => {
            showToast('Copiado!');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Copiado!');
        });
    }

    // Destacar elemento na página (flash + scroll)
    function destacarNaPagina(domEl) {
        if (!domEl) return;

        // Scroll até o elemento
        domEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Flash visual
        const rect = domEl.getBoundingClientRect();
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; z-index: ${CONFIG.zIndex.highlight + 1};
            top: ${rect.top}px; left: ${rect.left}px;
            width: ${rect.width}px; height: ${rect.height}px;
            border: 3px solid ${CONFIG.cores.accent};
            background: rgba(59,130,246,0.15);
            border-radius: 6px; pointer-events: none;
            transition: opacity 0.8s ease;
        `;
        document.body.appendChild(flash);

        // Label no topo do flash
        const label = document.createElement('span');
        label.textContent = obterSeletor(domEl);
        label.style.cssText = `
            position: absolute; top: -22px; left: 0;
            background: ${CONFIG.cores.accent}; color: white;
            font-size: 10px; font-weight: 700; padding: 2px 8px;
            border-radius: 4px; font-family: system-ui;
            white-space: nowrap;
        `;
        flash.appendChild(label);

        // Remover após 2.5s com fade
        setTimeout(() => { flash.style.opacity = '0'; }, 1800);
        setTimeout(() => { flash.remove(); }, 2600);
    }

    // Cor swatch HTML
    function swatch(cor, tamanho = 14) {
        return `<span style="display:inline-block;width:${tamanho}px;height:${tamanho}px;border-radius:3px;background:${cor};border:1px solid ${CONFIG.cores.borda};vertical-align:middle;margin-right:6px;flex-shrink:0;"></span>`;
    }

    // =========================================================
    // CRIAR ESTRUTURA — BOTÃO FLUTUANTE
    // =========================================================

    function criarBotaoFlutuante() {
        elBtnFlutuante = document.createElement('button');
        elBtnFlutuante.id = 'btn-inspetor-v2';
        elBtnFlutuante.innerHTML = '🎨 Mapa UI';
        elBtnFlutuante.style.cssText = `
            position: fixed; top: 12px; right: 12px; z-index: ${CONFIG.zIndex.btn};
            padding: 8px 16px; background: ${CONFIG.cores.accent}; color: white;
            border: none; border-radius: 8px;
            font-size: 12px; font-weight: 700; cursor: pointer;
            box-shadow: 0 3px 12px rgba(59,130,246,0.4); transition: all 0.15s ease;
            font-family: system-ui, sans-serif; letter-spacing: 0.3px;
        `;
        elBtnFlutuante.addEventListener('click', toggleModal);
        elBtnFlutuante.addEventListener('mouseenter', () => {
            elBtnFlutuante.style.background = CONFIG.cores.accentHover;
            elBtnFlutuante.style.boxShadow = '0 4px 16px rgba(59,130,246,0.5)';
        });
        elBtnFlutuante.addEventListener('mouseleave', () => {
            elBtnFlutuante.style.background = CONFIG.cores.accent;
            elBtnFlutuante.style.boxShadow = '0 3px 12px rgba(59,130,246,0.4)';
        });
        document.body.appendChild(elBtnFlutuante);
    }

    // =========================================================
    // CRIAR ESTRUTURA — HIGHLIGHT (overlay de destaque na página)
    // =========================================================

    function criarHighlight() {
        elHighlight = document.createElement('div');
        elHighlight.id = 'inspetor-highlight';
        elHighlight.style.cssText = `
            position: fixed; pointer-events: none; z-index: ${CONFIG.zIndex.highlight};
            border: 2px solid ${CONFIG.cores.accent}; background: rgba(59,130,246,0.12);
            display: none; transition: all 0.08s ease;
        `;
        document.body.appendChild(elHighlight);
    }

    // =========================================================
    // CRIAR ESTRUTURA — MODAL PRINCIPAL
    // =========================================================

    function criarModal() {
        // Overlay escuro atrás do modal
        elOverlayModal = document.createElement('div');
        elOverlayModal.id = 'inspetor-overlay-modal';
        elOverlayModal.style.cssText = `
            position: fixed; inset: 0; z-index: ${CONFIG.zIndex.overlay};
            background: transparent; display: none; pointer-events: none;
        `;
        elOverlayModal.addEventListener('click', () => {
            if (!state.inspetorAtivo) fecharModal();
        });
        document.body.appendChild(elOverlayModal);

        // Modal — alinhado à direita, redimensionável
        elModal = document.createElement('div');
        elModal.id = 'inspetor-modal';
        elModal.style.cssText = `
            position: fixed; z-index: ${CONFIG.zIndex.modal};
            top: 16px; right: 16px; left: auto; transform: none;
            width: ${CONFIG.modal.width}; max-width: 95vw; height: ${CONFIG.modal.height}; max-height: 95vh;
            min-width: 400px; min-height: 300px; overflow: hidden;
            background: ${CONFIG.cores.bg}; border-radius: 16px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.6); display: none;
            font-family: system-ui, -apple-system, sans-serif; color: ${CONFIG.cores.texto};
            border: 1px solid ${CONFIG.cores.borda};
        `;

        elModal.innerHTML = `
            <div id="inspetor-header" style="
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 18px; background: linear-gradient(135deg, ${CONFIG.cores.accent} 0%, ${CONFIG.cores.accentHover} 100%);
                border-bottom: 1px solid rgba(255,255,255,0.1); user-select: none; cursor: move;
            ">
                <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">Mapa UI</span>
                <div style="display: flex; gap: 6px;">
                    <button id="inspetor-btn-min" title="Minimizar" style="
                        background: rgba(255,255,255,0.15); border: none; color: white;
                        width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 16px; line-height: 1;
                    ">−</button>
                    <button id="inspetor-btn-close" title="Fechar" style="
                        background: rgba(255,255,255,0.15); border: none; color: white;
                        width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 14px; line-height: 1;
                    ">✕</button>
                </div>
            </div>
            <div id="inspetor-body" style="
                display: flex; height: calc(100% - 52px);
            ">
                <div id="inspetor-sidebar" style="
                    width: ${CONFIG.modal.sidebarWidth}; min-width: ${CONFIG.modal.sidebarWidth};
                    background: ${CONFIG.cores.bgCard}; border-right: 1px solid ${CONFIG.cores.borda};
                    display: flex; flex-direction: column; padding: 8px 0; gap: 2px; overflow-y: auto;
                "></div>
                <div id="inspetor-conteudo" style="
                    flex: 1; overflow-y: auto; padding: 16px;
                    font-size: 13px; line-height: 1.5;
                "></div>
            </div>
        `;

        document.body.appendChild(elModal);

        elSidebar = elModal.querySelector('#inspetor-sidebar');
        elConteudo = elModal.querySelector('#inspetor-conteudo');

        // Eventos header
        elModal.querySelector('#inspetor-btn-close').addEventListener('click', fecharModal);
        elModal.querySelector('#inspetor-btn-min').addEventListener('click', minimizarModal);

        // Drag modal
        habilitarDrag(elModal.querySelector('#inspetor-header'), elModal);

        // Resize handle no canto inferior esquerdo
        const resizeHandle = document.createElement('div');
        resizeHandle.style.cssText = `
            position: absolute; bottom: 0; left: 0; width: 18px; height: 18px;
            cursor: nesw-resize; z-index: 10;
        `;
        // Ícone de 3 linhas diagonais
        resizeHandle.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" style="opacity:0.4;">
            <line x1="14" y1="18" x2="18" y2="14" stroke="${CONFIG.cores.textoMuted}" stroke-width="1.5"/>
            <line x1="9" y1="18" x2="18" y2="9" stroke="${CONFIG.cores.textoMuted}" stroke-width="1.5"/>
            <line x1="4" y1="18" x2="18" y2="4" stroke="${CONFIG.cores.textoMuted}" stroke-width="1.5"/>
        </svg>`;
        elModal.appendChild(resizeHandle);

        let isResizing = false, resizeStartX, resizeStartY, resizeOrigW, resizeOrigH, resizeOrigRight;
        resizeHandle.addEventListener('mousedown', e => {
            e.preventDefault();
            isResizing = true;
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
            const rect = elModal.getBoundingClientRect();
            resizeOrigW = rect.width;
            resizeOrigH = rect.height;
            resizeOrigRight = window.innerWidth - rect.right;
            elModal.style.transition = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!isResizing) return;
            const dx = e.clientX - resizeStartX; // negativo = arrastou pra esquerda = aumenta largura
            const dy = e.clientY - resizeStartY;
            const newW = Math.max(400, resizeOrigW - dx);
            const newH = Math.max(300, resizeOrigH + dy);
            elModal.style.width = newW + 'px';
            elModal.style.height = newH + 'px';
            elModal.style.right = resizeOrigRight + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                elModal.style.transition = '';
            }
        });

        // Popular sidebar
        criarSidebar();
    }

    // Sidebar dinâmica: Árvore + abas da página + ferramentas
    function criarSidebar() {
        elSidebar.innerHTML = '';

        // Detectar abas da página
        const tabItems = document.querySelectorAll('.tab-item, [data-tab]');
        const abas = [];
        tabItems.forEach(t => {
            const id = t.dataset.tab || '';
            const texto = t.textContent.trim();
            if (id && texto) abas.push({ id: 'aba-' + id, secId: id, label: texto.substring(0, 10), icon: '📄' });
        });

        const items = [
            { id: 'arvore', icon: '🌳', label: 'Árvore', desc: 'Mapa da página' },
            'sep',
            { id: 'estrutura', icon: '🏗️', label: 'Estrutura', desc: 'Estrutura global' },
            ...abas.map(a => ({ ...a, desc: 'Detalhes da aba ' + a.label })),
            'sep',
            { id: 'heatmap', icon: '🎯', label: 'Heatmap', desc: 'Mapa visual de blocos' },
            { id: 'interativos', icon: '⚡', label: 'Ações', desc: 'Elementos interativos' },
            { id: 'inspetor', icon: '🔍', label: 'Inspetor', desc: 'Inspecionar elemento' },
            'sep',
            { id: 'recarregar', icon: '🔄', label: 'Atualizar', desc: 'Recarregar página (Ctrl+Shift+R)' }
        ];

        // Ícones por aba
        const iconeAbas = { 'visao-geral': '📊', 'por-produto': '🛒', 'por-cliente': '🧑‍🤝‍🧑', 'ajustes': '⚙️' };
        items.forEach(item => {
            if (item === 'sep') {
                const sep = document.createElement('div');
                sep.style.cssText = `height:1px;background:${CONFIG.cores.borda};margin:6px 10px;`;
                elSidebar.appendChild(sep);
                return;
            }
            if (item.secId && iconeAbas[item.secId]) item.icon = iconeAbas[item.secId];

            const btn = document.createElement('button');
            btn.dataset.tool = item.id;
            btn.title = item.desc;
            btn.innerHTML = `<span style="font-size:16px;display:block;line-height:1;">${item.icon}</span><span style="font-size:8px;margin-top:1px;display:block;opacity:0.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:54px;">${item.label}</span>`;
            btn.style.cssText = `
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                width: 56px; height: 46px; margin: 0 auto; border: none; border-radius: 8px;
                cursor: pointer; transition: all 0.15s ease; background: transparent; color: ${CONFIG.cores.textoMuted};
                padding: 3px;
            `;
            btn.addEventListener('click', () => selecionarFerramenta(item.id));
            btn.addEventListener('mouseenter', () => {
                if (state.ferramentaAtiva !== item.id) btn.style.background = CONFIG.cores.bgHover;
            });
            btn.addEventListener('mouseleave', () => {
                if (state.ferramentaAtiva !== item.id) btn.style.background = 'transparent';
            });
            elSidebar.appendChild(btn);
        });
        atualizarSidebarAtiva();
    }

    function atualizarSidebarAtiva() {
        elSidebar.querySelectorAll('button').forEach(btn => {
            const ativo = btn.dataset.tool === state.ferramentaAtiva;
            btn.style.background = ativo ? CONFIG.cores.accent : 'transparent';
            btn.style.color = ativo ? 'white' : CONFIG.cores.textoMuted;
        });
    }

    // Drag do modal (usa top/right)
    function habilitarDrag(handle, target) {
        let isDragging = false, startX, startY, origTop, origRight;
        handle.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = target.getBoundingClientRect();
            origTop = rect.top;
            origRight = window.innerWidth - rect.right;
            target.style.transition = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            target.style.top = (origTop + dy) + 'px';
            target.style.right = (origRight - dx) + 'px';
            target.style.left = 'auto';
            target.style.transform = 'none';
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            target.style.transition = '';
        });
    }

    // =========================================================
    // CONTROLE DO MODAL
    // =========================================================

    function toggleModal() {
        if (state.modalAberto) fecharModal();
        else abrirModal();
    }

    function abrirModal() {
        state.modalAberto = true;
        elModal.style.display = 'block';
        elOverlayModal.style.display = 'block';
        elBtnFlutuante.style.display = 'none';
        selecionarFerramenta(state.ferramentaAtiva);
    }

    function fecharModal() {
        state.modalAberto = false;
        elModal.style.display = 'none';
        elOverlayModal.style.display = 'none';
        elBtnFlutuante.style.display = 'block';
        desativarInspetor();
        limparHeatmap();
    }

    function minimizarModal() {
        // Minimiza: esconde modal mas mantém overlay e modo inspetor se ativo
        elModal.style.display = 'none';
        if (!state.inspetorAtivo) {
            elOverlayModal.style.display = 'none';
            elBtnFlutuante.style.display = 'block';
        }
    }

    function restaurarModal() {
        elModal.style.display = 'block';
        elOverlayModal.style.display = 'block';
    }

    // =========================================================
    // SELEÇÃO DE FERRAMENTA
    // =========================================================

    function selecionarFerramenta(id) {
        // Desativar ferramentas anteriores
        if (state.ferramentaAtiva === 'inspetor' && id !== 'inspetor') desativarInspetor();
        if (state.ferramentaAtiva === 'heatmap' && id !== 'heatmap') limparHeatmap();

        state.ferramentaAtiva = id;
        atualizarSidebarAtiva();

        if (id === 'inspetor') renderInspetor();
        else if (id === 'arvore') renderArvore();
        else if (id === 'interativos') renderInterativos();
        else if (id === 'heatmap') renderHeatmap();
        else if (id === 'estrutura') renderEstrutura();
        else if (id.startsWith('aba-')) renderAbaDetalhe(id.replace('aba-', ''));
        else if (id === 'recarregar') { location.reload(true); return; }
        else renderArvore();
    }

    // =========================================================
    // HELPER: Seção HTML
    // =========================================================

    function secao(titulo, conteudo, opts = {}) {
        const corTitulo = opts.corTitulo || CONFIG.cores.amarelo;
        const bgSec = opts.bg || CONFIG.cores.bgCard;
        return `
            <div style="margin-bottom: 12px; background: ${bgSec}; border-radius: 10px; overflow: hidden;">
                <div style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: ${corTitulo}; font-weight: 600; border-bottom: 1px solid ${CONFIG.cores.borda};">${titulo}</div>
                <div style="padding: 12px 14px;">${conteudo}</div>
            </div>
        `;
    }

    function grid2(label, valor, corValor) {
        const cv = corValor || CONFIG.cores.texto;
        return `<span style="color:${CONFIG.cores.textoMuted};font-size:12px;">${label}</span><span style="color:${cv};font-size:12px;word-break:break-all;">${valor}</span>`;
    }

    function btnCopiar(texto, label = 'COPIAR') {
        const id = 'cp_' + Math.random().toString(36).slice(2, 8);
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => copiarTexto(texto));
        }, 50);
        return `<button id="${id}" style="
            background: ${CONFIG.cores.accent}; border: none; color: white; padding: 10px 16px;
            border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; width: 100%;
            margin-top: 8px; transition: background 0.15s;
        " onmouseenter="this.style.background='${CONFIG.cores.accentHover}'"
           onmouseleave="this.style.background='${CONFIG.cores.accent}'"
        >${label}</button>`;
    }

    function btnCopiarInline(texto, label, bg) {
        const id = 'cp_' + Math.random().toString(36).slice(2, 8);
        const bgCor = bg || CONFIG.cores.bgHover;
        const isAccent = bg === CONFIG.cores.accent;
        const corTexto = isAccent ? 'white' : CONFIG.cores.textoMuted;
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => copiarTexto(texto));
        }, 50);
        return `<button id="${id}" style="
            background: ${bgCor}; border: 1px solid ${CONFIG.cores.borda}; color: ${corTexto};
            padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;
            transition: all 0.15s; white-space: nowrap;
        " onmouseenter="this.style.background='${CONFIG.cores.accent}';this.style.color='white';this.style.borderColor='${CONFIG.cores.accent}';"
           onmouseleave="this.style.background='${bgCor}';this.style.color='${corTexto}';this.style.borderColor='${CONFIG.cores.borda}';"
        >${label}</button>`;
    }

    // =========================================================
    // TOOL 1: INSPETOR (inspecionar elemento individual)
    // =========================================================

    function renderInspetor() {
        if (state.elementoInspecionado) {
            renderInfoElemento(state.elementoInspecionado);
        } else {
            elConteudo.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                    <h3 style="margin: 0 0 8px; font-size: 16px; color: ${CONFIG.cores.texto};">Inspetor de Elementos</h3>
                    <p style="color: ${CONFIG.cores.textoMuted}; font-size: 13px; margin: 0 0 24px;">
                        Ative o modo inspetor para selecionar elementos na página.
                    </p>
                    <button id="btn-ativar-inspetor" style="
                        background: ${CONFIG.cores.accent}; border: none; color: white;
                        padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600;
                        cursor: pointer; transition: all 0.15s;
                    ">Ativar Inspetor</button>
                    <p style="color: ${CONFIG.cores.textoMuted}; font-size: 11px; margin-top: 16px;">
                        Clique esquerdo = captura função &nbsp;|&nbsp; Clique direito = inspeciona
                    </p>
                </div>
            `;
            document.getElementById('btn-ativar-inspetor').addEventListener('click', ativarInspetor);
        }
    }

    function ativarInspetor() {
        state.inspetorAtivo = true;
        state.funcaoCapturada = null;
        // Minimizar modal para inspecionar a página
        elModal.style.display = 'none';
        elOverlayModal.style.display = 'none';
        elBtnFlutuante.style.display = 'block';
        elBtnFlutuante.innerHTML = '✕ Fechar';
        elBtnFlutuante.style.background = CONFIG.cores.vermelho;
        elBtnFlutuante.style.boxShadow = '0 3px 12px rgba(239,68,68,0.4)';

        document.addEventListener('mousemove', onInspetorMouseMove);
        document.addEventListener('contextmenu', onInspetorRightClick);
        document.addEventListener('click', onInspetorLeftClick, true);
        showToast('Inspetor ativado — Esquerdo: captura função | Direito: inspeciona');
    }

    function desativarInspetor() {
        if (!state.inspetorAtivo) return;
        state.inspetorAtivo = false;
        elHighlight.style.display = 'none';
        elBtnFlutuante.innerHTML = '🎨 Mapa UI';
        elBtnFlutuante.style.background = CONFIG.cores.accent;
        elBtnFlutuante.style.boxShadow = '0 3px 12px rgba(59,130,246,0.4)';

        document.removeEventListener('mousemove', onInspetorMouseMove);
        document.removeEventListener('contextmenu', onInspetorRightClick);
        document.removeEventListener('click', onInspetorLeftClick, true);
    }

    function isInspetor(el) {
        if (!el) return false;
        return el === elBtnFlutuante || el === elModal || el === elOverlayModal ||
               el === elHighlight || el === elToast ||
               elModal.contains(el);
    }

    function onInspetorMouseMove(e) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || isInspetor(el)) return;
        state.elementoDestacado = el;
        const rect = el.getBoundingClientRect();
        elHighlight.style.display = 'block';
        elHighlight.style.top = rect.top + 'px';
        elHighlight.style.left = rect.left + 'px';
        elHighlight.style.width = rect.width + 'px';
        elHighlight.style.height = rect.height + 'px';
    }

    function onInspetorLeftClick(e) {
        if (!state.inspetorAtivo || isInspetor(e.target)) return;
        const el = e.target;
        const info = obterInfoFuncao(el);
        state.funcaoCapturada = {
            seletor: obterSeletor(el),
            funcao: info.funcao,
            tipo: info.tipo,
            listeners: info.todosListeners,
            hora: new Date().toLocaleTimeString()
        };
        if (info.funcao !== 'nenhuma') showToast('Capturado: ' + info.funcao);
        else showToast('Clique em: ' + obterSeletor(el).substring(0, 30));
    }

    function onInspetorRightClick(e) {
        if (!state.inspetorAtivo || isInspetor(e.target)) return;
        e.preventDefault();
        state.elementoInspecionado = e.target;
        elHighlight.style.display = 'none';
        desativarInspetor();
        abrirModal();
        renderInfoElemento(e.target);
    }

    function obterInfoFuncao(el) {
        let funcao = 'nenhuma', tipo = '';
        let atual = el, nivel = 0;
        while (atual && nivel < 5 && funcao === 'nenhuma') {
            const onclick = atual.getAttribute && atual.getAttribute('onclick');
            if (onclick) {
                const m = onclick.match(/^(\w+)\s*\(/);
                funcao = m ? m[1] + '()' : onclick.substring(0, 40);
                tipo = nivel === 0 ? 'onclick' : `onclick (pai: ${obterSeletor(atual)})`;
                break;
            }
            const listeners = eventListenersMap.get(atual) || [];
            const clicks = listeners.filter(l => l.type === 'click');
            if (clicks.length > 0) {
                funcao = clicks.map(l => l.name + '()').join(', ');
                tipo = nivel === 0 ? 'addEventListener' : `addEventListener (pai: ${obterSeletor(atual)})`;
                break;
            }
            if (atual.onclick && typeof atual.onclick === 'function') {
                funcao = (atual.onclick.name || 'anonima') + '()';
                tipo = nivel === 0 ? 'onclick prop' : `onclick prop (pai: ${obterSeletor(atual)})`;
                break;
            }
            atual = atual.parentElement;
            nivel++;
        }
        if (el.tagName === 'A' && el.href && funcao === 'nenhuma') {
            funcao = 'navegar → ' + (el.href.length > 30 ? el.href.substring(0, 30) + '...' : el.href);
            tipo = 'link';
        }
        const listeners = eventListenersMap.get(el) || [];
        const todosListeners = listeners.map(l => `${l.type}: ${l.name}()`).join(', ') || 'nenhum';
        return { funcao, tipo, todosListeners };
    }

    function capturarEventosElemento(el) {
        const eventos = [];
        const inlineEvts = ['onclick','onchange','oninput','onsubmit','onfocus','onblur','onkeyup','onkeydown','ondblclick','onmouseover'];
        inlineEvts.forEach(attr => {
            const v = el.getAttribute(attr);
            if (v) {
                const m = v.match(/^(\w+)\s*\(/);
                eventos.push(`${attr.replace('on','')}: ${m ? m[1]+'()' : v.substring(0,30)}`);
            }
        });
        ['click','change','input','submit','focus','blur'].forEach(tipo => {
            if (el['on'+tipo] && typeof el['on'+tipo] === 'function') {
                const n = el['on'+tipo].name || 'anonima';
                if (!eventos.some(e => e.startsWith(tipo+':'))) eventos.push(`${tipo}: ${n}()`);
            }
        });
        return eventos.length > 0 ? eventos.join(' | ') : 'nenhum';
    }

    function renderInfoElemento(el) {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const seletor = obterSeletor(el);
        const hierarquia = obterHierarquia(el);
        const eventos = capturarEventosElemento(el);

        let conteudo = '';
        const textos = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).filter(t => t);
        conteudo = textos.length > 0 ? textos.join(' ') : (el.textContent?.trim() || '');
        conteudo = conteudo.replace(/\s+/g, ' ').substring(0, 100);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') conteudo = el.value || el.placeholder || '-';
        if (el.tagName === 'IMG') conteudo = el.alt || el.src?.split('/').pop() || '-';

        const distL = Math.round(rect.left), distR = Math.round(window.innerWidth - rect.right);
        const distT = Math.round(rect.top), distB = Math.round(window.innerHeight - rect.bottom);

        let html = '';

        // Contexto
        html += secao('Contexto', `
            <div style="display:grid;grid-template-columns:70px 1fr;gap:4px;">
                ${grid2('Seletor', `<code style="color:${CONFIG.cores.rosa};">${seletor}</code>`)}
                ${grid2('ID', el.id || '-', CONFIG.cores.amarelo)}
                ${grid2('Classes', el.classList.length > 0 ? Array.from(el.classList).join(' ') : '-', CONFIG.cores.verde)}
            </div>
        `);

        // Conteúdo
        if (conteudo && conteudo !== '-') {
            html += secao('Conteúdo', `<div style="font-size:13px;word-break:break-word;">${conteudo}</div>`);
        }

        // Função capturada
        if (state.funcaoCapturada) {
            html += secao('Função Capturada (Clique)', `
                <div style="color:${CONFIG.cores.amarelo};font-size:14px;font-weight:600;margin-bottom:4px;">${state.funcaoCapturada.funcao}</div>
                <div style="color:${CONFIG.cores.textoMuted};font-size:11px;">via ${state.funcaoCapturada.tipo || 'clique'} em ${state.funcaoCapturada.seletor}</div>
                <div style="color:${CONFIG.cores.bgHover};font-size:10px;margin-top:4px;">${state.funcaoCapturada.hora}</div>
            `, { corTitulo: CONFIG.cores.laranja, bg: '#2d1f0f' });
        }

        // Eventos JS
        html += secao('Eventos JS', `<div style="color:${eventos !== 'nenhum' ? CONFIG.cores.verde : CONFIG.cores.textoMuted};font-size:12px;">${eventos}</div>`,
            { corTitulo: CONFIG.cores.verde, bg: eventos !== 'nenhum' ? '#1e3a2f' : CONFIG.cores.bgCard });

        // Dimensões + Posição
        html += secao('Dimensões e Posição', `
            <div style="display:grid;grid-template-columns:80px 1fr;gap:4px;">
                ${grid2('Tamanho', `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`)}
                ${grid2('Padding', cs.padding, CONFIG.cores.verde)}
                ${grid2('Margin', cs.margin, CONFIG.cores.laranja)}
                ${grid2('Posição', `↑${distT}px ←${distL}px →${distR}px ↓${distB}px`, CONFIG.cores.cyan)}
                ${grid2('Viewport', `${window.innerWidth} × ${window.innerHeight}`)}
            </div>
        `);

        // Estilos visuais
        html += secao('Estilos', `
            <div style="display:grid;grid-template-columns:80px 1fr;gap:4px;">
                ${grid2('Background', `<span style="display:flex;align-items:center;gap:4px;">${swatch(cs.backgroundColor)}${cs.backgroundColor}</span>`)}
                ${grid2('Cor texto', `<span style="display:flex;align-items:center;gap:4px;">${swatch(cs.color)}${cs.color}</span>`)}
                ${grid2('Borda', cs.border !== 'none' ? cs.border : '-')}
                ${grid2('Radius', cs.borderRadius)}
                ${grid2('Fonte', `${cs.fontFamily.split(',')[0].replace(/"/g,'')} ${cs.fontSize} (${cs.fontWeight})`)}
            </div>
        `);

        // Hierarquia
        html += secao('Hierarquia', `<code style="font-size:11px;color:${CONFIG.cores.textoMuted};word-break:break-all;">${hierarquia}</code>`);

        // Botão copiar
        const textoCopiavel = montarTextoCopiavel(el, cs, rect, eventos);
        html += btnCopiar(textoCopiavel, 'COPIAR TUDO');

        // Botão novo inspetor
        html += `<button id="btn-reinspecionar" style="
            background: transparent; border: 1px solid ${CONFIG.cores.borda}; color: ${CONFIG.cores.textoMuted};
            padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 12px; width: 100%; margin-top: 6px;
        ">Inspecionar outro elemento</button>`;

        elConteudo.innerHTML = html;

        document.getElementById('btn-reinspecionar').addEventListener('click', () => {
            state.elementoInspecionado = null;
            ativarInspetor();
        });
    }

    function montarTextoCopiavel(el, cs, rect, eventos) {
        const seletor = obterSeletor(el);
        const distL = Math.round(rect.left), distR = Math.round(window.innerWidth - rect.right);
        const distT = Math.round(rect.top), distB = Math.round(window.innerHeight - rect.bottom);
        const funcaoTxt = state.funcaoCapturada ? ` | FUNCAO: ${state.funcaoCapturada.funcao} (${state.funcaoCapturada.tipo} em ${state.funcaoCapturada.seletor})` : '';
        const eventosTxt = eventos !== 'nenhum' ? ` | Eventos: ${eventos}` : '';
        return `Elemento: ${seletor} (${Math.round(rect.width)}x${Math.round(rect.height)}, bg: ${cs.backgroundColor}, cor: ${cs.color}, fonte: ${cs.fontFamily.split(',')[0].replace(/"/g,'')} ${cs.fontSize} ${cs.fontWeight}, radius: ${cs.borderRadius}, padding: ${cs.padding}, margin: ${cs.margin}, posicao: ↑${distT} ←${distL} →${distR} ↓${distB})${funcaoTxt}${eventosTxt}`;
    }

    // =========================================================
    // TOOL 2: ÁRVORE DOM
    // =========================================================

    // Modos: 'mapa' (semântico) e 'codigo' (DOM text)
    let arvoreViewMode = 'mapa';

    function renderArvore() {
        const modos = [
            { id: 'mapa', label: 'Mapa' },
            { id: 'estrutura', label: 'Estrutura' },
            { id: 'codigo', label: 'DOM' }
        ];

        let html = `
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted}; text-transform: uppercase; letter-spacing: 0.5px;">Mapa da Página</span>
                <div style="display: flex; gap: 4px;">
                    ${modos.map(m => `<button id="arvore-btn-${m.id}" style="
                        padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; border: 1px solid ${CONFIG.cores.borda};
                        background: ${arvoreViewMode === m.id ? CONFIG.cores.accent : 'transparent'};
                        color: ${arvoreViewMode === m.id ? 'white' : CONFIG.cores.textoMuted};
                    ">${m.label}</button>`).join('')}
                </div>
            </div>
        `;

        if (arvoreViewMode === 'mapa') {
            const mapa = scanMapaSemantico();
            html += renderMapaSemantico(mapa);

            const textoTudo = gerarTextoMapaSemantico(mapa, 'tudo');
            const textoCasca = gerarTextoMapaSemantico(mapa, 'casca');
            html += `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">`;
            html += btnCopiarInline(textoTudo, 'COPIAR TUDO', CONFIG.cores.accent);
            html += btnCopiarInline(textoCasca, 'SÓ CASCA', CONFIG.cores.bgHover);
            mapa.abas.forEach(aba => {
                const textoAba = gerarTextoMapaSemantico(mapa, aba.id);
                html += btnCopiarInline(textoAba, aba.titulo || aba.id, CONFIG.cores.bgHover);
            });
            html += `</div>`;
        } else if (arvoreViewMode === 'estrutura') {
            html += renderEstruturaSections();
        } else {
            const tree = scanArvore(document.body, 0, 4);
            html += `<div style="background: ${CONFIG.cores.bgCard}; border-radius: 10px; padding: 12px; font-family: monospace; font-size: 12px; overflow-x: auto;">`;
            html += renderArvoreNode(tree, 0);
            html += '</div>';
            const textoArvore = gerarTextoArvore(tree, 0);
            html += btnCopiar(textoArvore, 'COPIAR DOM');
        }

        elConteudo.innerHTML = html;

        modos.forEach(m => {
            document.getElementById('arvore-btn-' + m.id).addEventListener('click', () => {
                arvoreViewMode = m.id;
                renderArvore();
            });
        });
    }

    // ---- ESTRUTURA: hierarquia com seletores + anotações ----

    function renderEstruturaSections() {
        const C = CONFIG.cores;
        const anotacoes = {
            'app-header': 'header principal',
            'app-header-inner': 'container interno',
            'app-header-left': 'logo + hamburger',
            'app-header-right': 'status Airtable',
            'app-header-hamburger': 'botão menu',
            'app-header-title': 'título da app',
            'tabs-bar': 'barra de navegação',
            'tabs-bar-inner': 'container tabs',
            'tab-item': 'aba',
            'active': 'ativa',
            'sidebar': 'menu lateral',
            'sidebar-header': 'cabeçalho sidebar',
            'sidebar-close': 'fechar sidebar',
            'sidebar-actions': 'ações sidebar',
            'sidebar-btn': 'botão do menu',
            'sidebar-overlay': 'fundo escuro sidebar',
            'main-content': 'conteúdo principal',
            'section': 'aba/seção',
            'page-header': 'cabeçalho da aba',
            'cards-grid': 'grid de summary cards',
            'summary-card': 'card resumo',
            'card': 'container card',
            'card-header': 'header azul (clicável)',
            'card-header-green': 'header verde',
            'card-header-dark': 'header escuro',
            'card-body': 'conteúdo do card',
            'card-collapsible': 'conteúdo colapsável',
            'card-toggle': 'chevron abrir/fechar',
            'filter-bar': 'barra de filtro',
            'filter-input': 'campo busca',
            'filter-count': 'contador resultados',
            'ranking-table': 'tabela ranking',
            'table-wrap': 'wrapper tabela (scroll)',
            'text-right': 'alinhado à direita',
            'dre-line': 'linha DRE',
            'metric-row': 'linha métrica',
            'footer': 'rodapé',
            'produto-card': 'card de produto'
        };

        function obterAnotacao(el) {
            const notas = [];
            if (el.id) {
                const idNota = anotacoes[el.id];
                if (idNota) notas.push(idNota);
            }
            el.classList.forEach(cls => {
                if (anotacoes[cls]) notas.push(anotacoes[cls]);
            });
            // Texto do elemento (se curto)
            if ((el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'SPAN' || el.tagName === 'BUTTON') && el.textContent) {
                const txt = el.textContent.trim().split('\n')[0].trim();
                if (txt.length > 0 && txt.length < 35) notas.push('"' + txt + '"');
            }
            return notas.join(', ');
        }

        const tagsVisiveis = ['html','body','header','nav','main','section','article','aside','footer','div','form','table','ul','ol','button','input','h1','h2','h3','h4','span','a','thead','tbody','tr'];

        function filtrarFilhos(el, maxDepth, depth) {
            if (depth >= maxDepth) return [];
            const filhos = [];
            Array.from(el.children).forEach(child => {
                const tag = child.tagName?.toLowerCase();
                if (!tag) return;
                if (child.id && child.id.startsWith('inspetor-')) return;
                if (child.id === 'btn-inspetor-v2') return;
                const temIdentidade = child.id || (child.classList.length > 0);
                if (!tagsVisiveis.includes(tag) && !temIdentidade) return;
                const rect = child.getBoundingClientRect();
                if (tag !== 'body' && rect.width === 0 && rect.height === 0) return;
                const ehImportante = temIdentidade || ['header','nav','main','section','aside','footer','form','table','thead','tbody'].includes(tag);
                if (!ehImportante && depth > 2) return;
                filhos.push(child);
            });
            return filhos;
        }

        const estruturaElements = [];

        function scanEstrutura(el, depth, maxDepth, prefixo) {
            const tag = el.tagName?.toLowerCase();
            if (!tag) return '';

            const idx = estruturaElements.length;
            estruturaElements.push(el);

            let seletor = tag;
            if (el.id) seletor += `<span style="color:${C.amarelo};">#${el.id}</span>`;
            if (el.classList.length > 0) seletor += `<span style="color:${C.verde};">.${Array.from(el.classList).slice(0, 3).join('.')}</span>`;

            const nota = obterAnotacao(el);
            const notaHtml = nota ? `<span style="color:${C.textoMuted};font-size:10px;margin-left:8px;">← ${nota}</span>` : '';

            let html = `<div class="estrutura-item" data-est-idx="${idx}" style="margin:1px 0;white-space:nowrap;font-size:11px;cursor:pointer;padding:1px 4px;border-radius:3px;transition:background 0.1s;"
                 onmouseenter="this.style.background='${C.bgHover}'" onmouseleave="this.style.background='transparent'">
                <span style="color:${C.borda};">${prefixo}</span><span style="color:${C.cyan};">${seletor}</span>${notaHtml}
            </div>`;

            const filhos = filtrarFilhos(el, maxDepth, depth + 1);
            filhos.forEach((child, i) => {
                const ehUltimo = i === filhos.length - 1;
                const conector = ehUltimo ? '└── ' : '├── ';
                const continuacao = ehUltimo ? '&nbsp;&nbsp;&nbsp;&nbsp;' : '│&nbsp;&nbsp;&nbsp;';
                const novoPrefixo = prefixo.replace('├── ', '│&nbsp;&nbsp;&nbsp;').replace('└── ', '&nbsp;&nbsp;&nbsp;&nbsp;') + conector;
                html += scanEstrutura(child, depth + 1, maxDepth, depth === 0 ? conector : novoPrefixo);
            });

            return html;
        }

        // Estado do explorador
        if (!window._explorerHistory) window._explorerHistory = [];
        if (!window._explorerCurrent) window._explorerCurrent = document.body;

        function renderExplorerLevel(parentEl) {
            const filhos = filtrarFilhos(parentEl, 20, 0);
            let h = '';

            // Breadcrumb / botão voltar
            const hist = window._explorerHistory;
            if (hist.length > 0) {
                h += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid ${C.borda};">`;
                h += `<button class="explorer-back" style="padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid ${C.borda};background:${C.bgHover};color:${C.texto};font-weight:600;">◀ Voltar</button>`;
                // Breadcrumb
                h += `<div style="display:flex;align-items:center;gap:4px;font-size:10px;overflow-x:auto;flex:1;">`;
                hist.forEach((hEl, hi) => {
                    const hTag = hEl.tagName.toLowerCase();
                    const hId = hEl.id ? '#' + hEl.id : '';
                    const hCls = hEl.classList.length > 0 ? '.' + Array.from(hEl.classList).slice(0, 2).join('.') : '';
                    h += `<span class="explorer-crumb" data-crumb-idx="${hi}" style="color:${C.cyan};cursor:pointer;padding:2px 4px;border-radius:3px;white-space:nowrap;" onmouseenter="this.style.background='${C.bgHover}'" onmouseleave="this.style.background='transparent'">${hTag}${hId}${hCls}</span>`;
                    h += `<span style="color:${C.borda};">›</span>`;
                });
                // Atual
                const curTag = parentEl.tagName.toLowerCase();
                const curId = parentEl.id ? '#' + parentEl.id : '';
                const curCls = parentEl.classList.length > 0 ? '.' + Array.from(parentEl.classList).slice(0, 2).join('.') : '';
                h += `<span style="color:${C.texto};font-weight:700;">${curTag}${curId}${curCls}</span>`;
                h += `</div></div>`;
            }

            // Info do elemento atual
            const curNota = obterAnotacao(parentEl);
            const rect = parentEl.getBoundingClientRect();
            h += `<div style="background:${C.bg};border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:10px;color:${C.textoMuted};">`;
            h += `<span style="color:${C.texto};font-weight:600;">${parentEl.tagName.toLowerCase()}</span>`;
            if (parentEl.id) h += `<span style="color:${C.amarelo};">#${parentEl.id}</span>`;
            if (parentEl.classList.length > 0) h += `<span style="color:${C.verde};">.${Array.from(parentEl.classList).join('.')}</span>`;
            h += ` <span style="margin-left:8px;">${Math.round(rect.width)}×${Math.round(rect.height)}</span>`;
            if (curNota) h += ` <span style="margin-left:8px;">← ${curNota}</span>`;
            h += ` <span style="margin-left:8px;">${filhos.length} filhos</span>`;
            h += `</div>`;

            // Lista de filhos
            if (filhos.length === 0) {
                h += `<div style="color:${C.textoMuted};font-size:11px;padding:8px;">Sem filhos visíveis</div>`;
            } else {
                filhos.forEach((child, ci) => {
                    const childIdx = estruturaElements.length;
                    estruturaElements.push(child);
                    const tag = child.tagName.toLowerCase();
                    const id = child.id ? `<span style="color:${C.amarelo};">#${child.id}</span>` : '';
                    const cls = child.classList.length > 0 ? `<span style="color:${C.verde};">.${Array.from(child.classList).slice(0, 3).join('.')}</span>` : '';
                    const nota = obterAnotacao(child);
                    const notaH = nota ? `<span style="color:${C.textoMuted};font-size:10px;margin-left:6px;">← ${nota}</span>` : '';
                    const childRect = child.getBoundingClientRect();
                    const dim = `<span style="color:${C.textoMuted};font-size:10px;margin-left:6px;">${Math.round(childRect.width)}×${Math.round(childRect.height)}</span>`;
                    const nFilhos = filtrarFilhos(child, 20, 0).length;
                    const expandIcon = nFilhos > 0 ? `<span style="color:${C.accent};margin-right:4px;">▶</span>` : `<span style="color:${C.borda};margin-right:4px;">•</span>`;
                    const filhosTag = nFilhos > 0 ? `<span style="color:${C.textoMuted};font-size:9px;margin-left:4px;background:${C.bgHover};padding:1px 5px;border-radius:3px;">${nFilhos}</span>` : '';

                    h += `<div class="explorer-item" data-est-idx="${childIdx}" style="margin:2px 0;padding:6px 8px;border-radius:6px;font-size:11px;cursor:pointer;display:flex;align-items:center;border:1px solid transparent;transition:all 0.1s;"
                        onmouseenter="this.style.background='${C.bgHover}';this.style.borderColor='${C.borda}'" onmouseleave="this.style.background='transparent';this.style.borderColor='transparent'">
                        ${expandIcon}<span style="color:${C.cyan};">${tag}</span>${id}${cls}${filhosTag}${dim}${notaH}
                    </div>`;
                });
            }

            return h;
        }

        let html = `<div id="explorer-container" style="background:${C.bgCard};border-radius:10px;padding:12px;font-family:'JetBrains Mono',monospace;overflow-x:auto;">`;
        html += renderExplorerLevel(window._explorerCurrent);
        html += '</div>';

        // Gerar texto copiável (árvore completa)
        function gerarTextoEstrutura(el, depth, maxDepth, prefixo) {
            const tag = el.tagName?.toLowerCase();
            if (!tag) return '';
            let sel = tag;
            if (el.id) sel += '#' + el.id;
            if (el.classList.length > 0) sel += '.' + Array.from(el.classList).slice(0, 3).join('.');
            const notas = [];
            if (el.id && anotacoes[el.id]) notas.push(anotacoes[el.id]);
            el.classList.forEach(cls => { if (anotacoes[cls]) notas.push(anotacoes[cls]); });
            const notaTxt = notas.length > 0 ? '  ← ' + notas.join(', ') : '';
            let txt = `${prefixo}${sel}${notaTxt}\n`;
            const filhos = filtrarFilhos(el, maxDepth, depth + 1);
            filhos.forEach((child, i) => {
                const ehUltimo = i === filhos.length - 1;
                const conector = ehUltimo ? '└── ' : '├── ';
                const novoPrefixo = prefixo.replace('├── ', '│   ').replace('└── ', '    ') + conector;
                txt += gerarTextoEstrutura(child, depth + 1, maxDepth, depth === 0 ? conector : novoPrefixo);
            });
            return txt;
        }

        const textoEstrutura = gerarTextoEstrutura(document.body, 0, 6, '');
        html += btnCopiar(textoEstrutura, 'COPIAR ESTRUTURA');

        // Bind cliques
        setTimeout(() => {
            // Clique em item → expandir (se tem filhos) ou destacar
            document.querySelectorAll('.explorer-item').forEach(item => {
                item.addEventListener('click', () => {
                    const idx = parseInt(item.dataset.estIdx);
                    const domEl = estruturaElements[idx];
                    if (!domEl) return;
                    const nFilhos = filtrarFilhos(domEl, 20, 0).length;
                    if (nFilhos > 0) {
                        // Navegar para dentro
                        window._explorerHistory.push(window._explorerCurrent);
                        window._explorerCurrent = domEl;
                        renderArvore();
                    } else {
                        // Destacar na página
                        destacarNaPagina(domEl);
                    }
                });
                // Duplo clique → sempre destacar
                item.addEventListener('dblclick', () => {
                    const idx = parseInt(item.dataset.estIdx);
                    const domEl = estruturaElements[idx];
                    if (domEl) destacarNaPagina(domEl);
                });
            });
            // Botão voltar
            const btnBack = document.querySelector('.explorer-back');
            if (btnBack) {
                btnBack.addEventListener('click', () => {
                    if (window._explorerHistory.length > 0) {
                        window._explorerCurrent = window._explorerHistory.pop();
                        renderArvore();
                    }
                });
            }
            // Breadcrumbs clicáveis
            document.querySelectorAll('.explorer-crumb').forEach(crumb => {
                crumb.addEventListener('click', () => {
                    const crumbIdx = parseInt(crumb.dataset.crumbIdx);
                    window._explorerCurrent = window._explorerHistory[crumbIdx];
                    window._explorerHistory = window._explorerHistory.slice(0, crumbIdx);
                    renderArvore();
                });
            });
        }, 50);

        return html;
    }

    // ---- MAPA SEMÂNTICO: escaneia a página e monta estrutura por abas ----

    function scanMapaSemantico() {
        const mapa = { casca: [], abas: [] };

        // CASCA: header
        const header = document.querySelector('.app-header, header');
        if (header) {
            const titulo = header.querySelector('.app-header-title, h1, h2');
            const status = header.querySelector('#statusText, .status-text');
            mapa.casca.push({
                tipo: 'header',
                label: titulo ? titulo.textContent.trim() : 'Header',
                extra: status ? status.textContent.trim() : '',
                seletor: obterSeletor(header)
            });
        }

        // CASCA: tabs bar
        const tabItems = document.querySelectorAll('.tab-item, [data-tab]');
        if (tabItems.length > 0) {
            const tabs = [];
            tabItems.forEach(t => {
                tabs.push({
                    texto: t.textContent.trim(),
                    ativo: t.classList.contains('active'),
                    dataTab: t.dataset.tab || ''
                });
            });
            mapa.casca.push({ tipo: 'tabs', items: tabs });
        }

        // CASCA: sidebar
        const sidebar = document.querySelector('.sidebar, aside#sidebar');
        if (sidebar) {
            const btns = sidebar.querySelectorAll('.sidebar-btn, button');
            const items = [];
            btns.forEach(b => {
                const txt = b.textContent.trim();
                if (txt && !txt.includes('✕') && txt.length < 40) items.push(txt);
            });
            mapa.casca.push({ tipo: 'sidebar', items });
        }

        // ABAS: cada section (inclusive ocultas)
        const sections = document.querySelectorAll('section[id], section.section');
        sections.forEach(sec => {
            if (isInspetor(sec)) return;

            // Temporariamente mostrar section oculta para escanear conteúdo
            const estaOculta = sec.style.display === 'none' || (!sec.classList.contains('active') && window.getComputedStyle(sec).display === 'none');
            if (estaOculta) {
                sec.style.display = 'block';
                sec.style.visibility = 'hidden';
                sec.style.position = 'absolute';
                sec.style.pointerEvents = 'none';
            }

            const aba = {
                id: sec.id || '',
                ativa: sec.classList.contains('active'),
                titulo: '',
                subtitulo: '',
                componentes: []
            };

            // Título da aba
            const h2 = sec.querySelector('.page-header h2, h2');
            if (h2) aba.titulo = h2.textContent.trim();
            const p = sec.querySelector('.page-header p');
            if (p) aba.subtitulo = p.textContent.trim();

            // Summary cards
            const cardsGrid = sec.querySelector('.cards-grid');
            if (cardsGrid) {
                aba.componentes.push({ tipo: 'summary-cards', seletor: obterSeletor(cardsGrid) });
            }

            // Filtros
            const filtros = sec.querySelectorAll('.filter-bar, .filter-input');
            filtros.forEach(f => {
                const input = f.querySelector('input') || (f.tagName === 'INPUT' ? f : null);
                const count = sec.querySelector('.filter-count');
                aba.componentes.push({
                    tipo: 'filtro',
                    placeholder: input ? (input.placeholder || '') : '',
                    contador: count ? count.textContent.trim() : ''
                });
            });

            // Cards colapsáveis
            const cards = sec.querySelectorAll('.card');
            cards.forEach(card => {
                const cardHeader = card.querySelector('.card-header');
                const titulo = cardHeader ? cardHeader.textContent.trim().replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ') : '';
                const tabela = card.querySelector('table');
                const comp = { tipo: 'card', titulo };

                if (tabela) {
                    const ths = tabela.querySelectorAll('thead th');
                    comp.colunas = Array.from(ths).map(th => th.textContent.trim()).filter(t => t);
                    comp.tbody = tabela.querySelector('tbody')?.id || '';
                }

                // DRE items dentro do card
                const dreItems = card.querySelectorAll('.dre-line, .metric-row');
                if (dreItems.length > 0) {
                    comp.dreLinhas = dreItems.length;
                }

                aba.componentes.push(comp);
            });

            // Container dinâmico (ex: containerProdutos)
            const containers = sec.querySelectorAll('[id^="container"]');
            containers.forEach(c => {
                const filhos = c.children.length;
                aba.componentes.push({
                    tipo: 'container-dinamico',
                    id: c.id,
                    filhos
                });
            });

            // Restaurar section oculta
            if (estaOculta) {
                sec.style.display = '';
                sec.style.visibility = '';
                sec.style.position = '';
                sec.style.pointerEvents = '';
            }

            mapa.abas.push(aba);
        });

        // CASCA: footer
        const footer = document.querySelector('.footer, footer, div.footer');
        if (footer) {
            mapa.casca.push({ tipo: 'footer', texto: footer.textContent.trim().substring(0, 60) });
        }

        return mapa;
    }

    function renderMapaSemantico(mapa) {
        let html = '';
        const C = CONFIG.cores;

        // CASCA
        let cascaHtml = '';
        mapa.casca.forEach(item => {
            if (item.tipo === 'header') {
                cascaHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="color:${C.cyan};font-weight:600;">App Header</span>
                    <span style="color:${C.texto};">"${item.label}"</span>
                    ${item.extra ? `<span style="color:${C.textoMuted};font-size:11px;">+ ${item.extra}</span>` : ''}
                </div>`;
            }
            if (item.tipo === 'tabs') {
                cascaHtml += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                    <span style="color:${C.cyan};font-weight:600;">Tabs</span>
                    ${item.items.map(t => `<span style="
                        padding:2px 8px;border-radius:4px;font-size:11px;
                        ${t.ativo ? `background:${C.accent};color:white;font-weight:600;` : `background:${C.bgHover};color:${C.textoMuted};`}
                    ">${t.texto}</span>`).join('')}
                </div>`;
            }
            if (item.tipo === 'sidebar') {
                cascaHtml += `<div style="margin-bottom:6px;">
                    <span style="color:${C.cyan};font-weight:600;">Sidebar</span>
                    <span style="color:${C.textoMuted};font-size:11px;margin-left:6px;">${item.items.join(' · ')}</span>
                </div>`;
            }
            if (item.tipo === 'footer') {
                cascaHtml += `<div style="margin-bottom:6px;">
                    <span style="color:${C.cyan};font-weight:600;">Footer</span>
                    <span style="color:${C.textoMuted};font-size:11px;margin-left:6px;">"${item.texto}"</span>
                </div>`;
            }
        });
        html += secao('Casca (estrutura global)', cascaHtml);

        // ABAS — colapsáveis, clique para expandir
        mapa.abas.forEach((aba, idx) => {
            const badge = aba.ativa
                ? `<span style="background:${C.verde};color:white;font-size:9px;padding:1px 6px;border-radius:4px;margin-left:6px;">ATIVA</span>`
                : `<span style="color:${C.textoMuted};font-size:9px;margin-left:6px;">oculta</span>`;
            const qtdComp = aba.componentes.length;
            const resumo = `<span style="color:${C.textoMuted};font-size:10px;margin-left:6px;">${qtdComp} componente${qtdComp !== 1 ? 's' : ''}</span>`;

            let conteudo = '';
            if (aba.subtitulo) {
                conteudo += `<div style="color:${C.textoMuted};font-size:11px;margin-bottom:8px;font-style:italic;">${aba.subtitulo}</div>`;
            }

            aba.componentes.forEach(comp => {
                const indent = `padding-left:12px;border-left:2px solid ${C.borda};margin-bottom:6px;padding-top:2px;padding-bottom:2px;`;

                if (comp.tipo === 'summary-cards') {
                    conteudo += `<div style="${indent}">
                        <span style="color:${C.laranja};">Summary Cards</span>
                        <span style="color:${C.textoMuted};font-size:10px;margin-left:4px;">(grid dinâmico)</span>
                    </div>`;
                }
                if (comp.tipo === 'filtro') {
                    conteudo += `<div style="${indent}">
                        <span style="color:${C.roxo};">Filtro</span>
                        ${comp.placeholder ? `<span style="color:${C.textoMuted};font-size:11px;margin-left:4px;">"${comp.placeholder}"</span>` : ''}
                        ${comp.contador ? `<span style="color:${C.textoMuted};font-size:10px;margin-left:4px;">${comp.contador}</span>` : ''}
                    </div>`;
                }
                if (comp.tipo === 'card') {
                    conteudo += `<div style="${indent}">
                        <span style="color:${C.amarelo};">Card</span>
                        <span style="color:${C.texto};font-size:11px;margin-left:4px;">${comp.titulo.substring(0, 50)}</span>
                    </div>`;
                    if (comp.colunas && comp.colunas.length > 0) {
                        conteudo += `<div style="padding-left:24px;margin-bottom:4px;">
                            <span style="color:${C.textoMuted};font-size:10px;">Tabela: ${comp.colunas.join(', ')}</span>
                        </div>`;
                    }
                    if (comp.dreLinhas) {
                        conteudo += `<div style="padding-left:24px;margin-bottom:4px;">
                            <span style="color:${C.textoMuted};font-size:10px;">DRE: ${comp.dreLinhas} linhas</span>
                        </div>`;
                    }
                }
                if (comp.tipo === 'container-dinamico') {
                    conteudo += `<div style="${indent}">
                        <span style="color:${C.verde};">Container</span>
                        <span style="color:${C.textoMuted};font-size:11px;margin-left:4px;">#${comp.id} (${comp.filhos} cards)</span>
                    </div>`;
                }
            });

            if (!conteudo) conteudo = `<div style="color:${C.textoMuted};font-size:11px;">Sem componentes detectados</div>`;

            const abaId = 'mapa-aba-' + idx;
            const corTitulo = aba.ativa ? C.verde : C.textoMuted;

            html += `
                <div style="margin-bottom: 12px; background: ${C.bgCard}; border-radius: 10px; overflow: hidden;">
                    <div id="${abaId}-header" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid ${C.borda}; transition: background 0.15s;"
                         onmouseenter="this.style.background='${C.bgHover}'" onmouseleave="this.style.background='transparent'">
                        <div style="display: flex; align-items: center;">
                            <span style="color: ${corTitulo}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">${aba.titulo || aba.id}</span>
                            ${badge}${resumo}
                        </div>
                        <span id="${abaId}-chevron" style="color:${C.textoMuted};font-size:12px;transition:transform 0.2s;">▶</span>
                    </div>
                    <div id="${abaId}-body" style="display: none; padding: 12px 14px;">
                        ${conteudo}
                    </div>
                </div>
            `;
        });

        // Adicionar event listeners após renderizar (via setTimeout)
        setTimeout(() => {
            mapa.abas.forEach((aba, idx) => {
                const abaId = 'mapa-aba-' + idx;
                const header = document.getElementById(abaId + '-header');
                const body = document.getElementById(abaId + '-body');
                const chevron = document.getElementById(abaId + '-chevron');
                if (!header || !body) return;

                header.addEventListener('click', () => {
                    const aberto = body.style.display !== 'none';
                    body.style.display = aberto ? 'none' : 'block';
                    chevron.style.transform = aberto ? 'rotate(0deg)' : 'rotate(90deg)';
                });
            });
        }, 30);

        return html;
    }

    // filtro: 'tudo' | 'casca' | id da aba (ex: 'por-produto')
    function gerarTextoMapaSemantico(mapa, filtro) {
        let txt = '';
        const incluirCasca = filtro === 'tudo' || filtro === 'casca';
        const incluirAbas = filtro === 'tudo';
        const abaEspecifica = !incluirCasca && filtro !== 'tudo' ? filtro : null;

        if (incluirCasca) {
            txt += 'MAPA DA PÁGINA\n\n';
            txt += '## Casca (estrutura global)\n';
            mapa.casca.forEach(item => {
                if (item.tipo === 'header') txt += `  Header: "${item.label}"${item.extra ? ' + ' + item.extra : ''}\n`;
                if (item.tipo === 'tabs') txt += `  Tabs: ${item.items.map(t => t.texto + (t.ativo ? ' [ATIVA]' : '')).join(' | ')}\n`;
                if (item.tipo === 'sidebar') txt += `  Sidebar: ${item.items.join(' · ')}\n`;
                if (item.tipo === 'footer') txt += `  Footer: "${item.texto}"\n`;
            });
        }

        function gerarTextoAba(aba) {
            let t = `\n## Aba: ${aba.titulo || aba.id} ${aba.ativa ? '[ATIVA]' : '(oculta)'}\n`;
            if (aba.subtitulo) t += `  "${aba.subtitulo}"\n`;
            aba.componentes.forEach(comp => {
                if (comp.tipo === 'summary-cards') t += `  ├── Summary Cards (grid)\n`;
                if (comp.tipo === 'filtro') t += `  ├── Filtro: "${comp.placeholder}" ${comp.contador}\n`;
                if (comp.tipo === 'card') {
                    t += `  ├── Card: ${comp.titulo.substring(0, 50)}\n`;
                    if (comp.colunas) t += `  │   └── Tabela: ${comp.colunas.join(', ')}\n`;
                    if (comp.dreLinhas) t += `  │   └── DRE: ${comp.dreLinhas} linhas\n`;
                }
                if (comp.tipo === 'container-dinamico') t += `  ├── Container #${comp.id} (${comp.filhos} cards)\n`;
            });
            return t;
        }

        if (incluirAbas) {
            mapa.abas.forEach(aba => { txt += gerarTextoAba(aba); });
        } else if (abaEspecifica) {
            const aba = mapa.abas.find(a => a.id === abaEspecifica);
            if (aba) txt = gerarTextoAba(aba).trim();
        }

        return txt.trim();
    }

    // ---- ÁRVORE DOM (modo código) ----

    function scanArvore(el, depth, maxDepth) {
        if (depth >= maxDepth) return null;
        const tag = el.tagName?.toLowerCase();
        if (!tag) return null;

        if (el.id && el.id.startsWith('inspetor-')) return null;
        if (el.id === 'btn-inspetor-v2') return null;

        const estruturais = ['html','body','header','nav','main','section','article','aside','footer','div','form','table','ul','ol','dialog'];
        const temIdentidade = el.id || (el.classList.length > 0);
        const ehEstrutural = estruturais.includes(tag);

        if (!ehEstrutural && !temIdentidade && depth > 1) return null;

        const rect = el.getBoundingClientRect();
        if (tag !== 'body' && (rect.width === 0 || rect.height === 0)) return null;

        const node = {
            tag,
            id: el.id || '',
            classes: el.classList.length > 0 ? Array.from(el.classList).slice(0, 3).join('.') : '',
            largura: Math.round(rect.width),
            altura: Math.round(rect.height),
            filhos: []
        };

        Array.from(el.children).forEach(child => {
            const childNode = scanArvore(child, depth + 1, maxDepth);
            if (childNode) node.filhos.push(childNode);
        });

        return node;
    }

    function renderArvoreNode(node, indent) {
        if (!node) return '';
        const pad = '&nbsp;'.repeat(indent * 3);
        const id = node.id ? `<span style="color:${CONFIG.cores.amarelo};">#${node.id}</span>` : '';
        const cls = node.classes ? `<span style="color:${CONFIG.cores.verde};">.${node.classes}</span>` : '';
        const dim = `<span style="color:${CONFIG.cores.textoMuted};font-size:10px;margin-left:8px;">${node.largura}×${node.altura}</span>`;

        let html = `<div style="margin: 1px 0; white-space: nowrap;">${pad}<span style="color:${CONFIG.cores.cyan};">&lt;${node.tag}&gt;</span>${id}${cls}${dim}</div>`;

        node.filhos.forEach(f => {
            html += renderArvoreNode(f, indent + 1);
        });
        return html;
    }

    function gerarTextoArvore(node, indent) {
        if (!node) return '';
        const pad = '  '.repeat(indent);
        const id = node.id ? '#' + node.id : '';
        const cls = node.classes ? '.' + node.classes : '';
        let txt = `${pad}<${node.tag}>${id}${cls} (${node.largura}×${node.altura})\n`;
        node.filhos.forEach(f => { txt += gerarTextoArvore(f, indent + 1); });
        return txt;
    }

    // =========================================================
    // TOOL: ESTRUTURA GLOBAL
    // =========================================================

    function renderEstrutura() {
        const mapa = scanMapaSemantico();
        const C = CONFIG.cores;
        let html = `
            <div style="margin-bottom:12px;">
                <span style="font-size:11px;color:${C.textoMuted};text-transform:uppercase;letter-spacing:0.5px;">Estrutura Global</span>
            </div>
        `;

        let cascaHtml = '';
        mapa.casca.forEach(item => {
            if (item.tipo === 'header') {
                cascaHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="color:${C.cyan};font-weight:600;">App Header</span>
                    <span style="color:${C.texto};">"${item.label}"</span>
                    ${item.extra ? `<span style="color:${C.textoMuted};font-size:11px;">+ ${item.extra}</span>` : ''}
                </div>`;
            }
            if (item.tipo === 'tabs') {
                cascaHtml += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                    <span style="color:${C.cyan};font-weight:600;">Tabs</span>
                    ${item.items.map(t => `<span style="padding:2px 8px;border-radius:4px;font-size:11px;
                        ${t.ativo ? `background:${C.accent};color:white;font-weight:600;` : `background:${C.bgHover};color:${C.textoMuted};`}
                    ">${t.texto}</span>`).join('')}
                </div>`;
            }
            if (item.tipo === 'sidebar') {
                cascaHtml += `<div style="margin-bottom:6px;">
                    <span style="color:${C.cyan};font-weight:600;">Sidebar</span>
                    <span style="color:${C.textoMuted};font-size:11px;margin-left:6px;">${item.items.join(' · ')}</span>
                </div>`;
            }
            if (item.tipo === 'footer') {
                cascaHtml += `<div style="margin-bottom:6px;">
                    <span style="color:${C.cyan};font-weight:600;">Footer</span>
                    <span style="color:${C.textoMuted};font-size:11px;margin-left:6px;">"${item.texto}"</span>
                </div>`;
            }
        });
        html += secao('Casca', cascaHtml);

        // Resumo das abas
        mapa.abas.forEach(aba => {
            const badge = aba.ativa
                ? `<span style="background:${C.verde};color:white;font-size:9px;padding:1px 6px;border-radius:4px;margin-left:6px;">ATIVA</span>`
                : `<span style="color:${C.textoMuted};font-size:9px;margin-left:6px;">oculta</span>`;
            html += `<div style="background:${C.bgCard};border-radius:8px;padding:10px 14px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;">
                    <span style="color:${C.texto};font-size:12px;font-weight:600;">${aba.titulo || aba.id}</span>${badge}
                    <span style="color:${C.textoMuted};font-size:10px;margin-left:8px;">${aba.componentes.length} componentes</span>
                </div>
                <button data-goto-aba="${aba.id}" style="background:${C.bgHover};border:none;color:${C.textoMuted};padding:4px 10px;border-radius:6px;cursor:pointer;font-size:10px;">Explorar →</button>
            </div>`;
        });

        const textoCasca = gerarTextoMapaSemantico(mapa, 'casca');
        html += btnCopiar(textoCasca, 'COPIAR ESTRUTURA');

        elConteudo.innerHTML = html;

        // Bind dos botões "Explorar"
        elConteudo.querySelectorAll('[data-goto-aba]').forEach(btn => {
            btn.addEventListener('click', () => {
                selecionarFerramenta('aba-' + btn.dataset.gotoAba);
            });
        });
    }

    // =========================================================
    // TOOL: DETALHE POR ABA (lista elementos + alterar)
    // =========================================================

    function renderAbaDetalhe(secId) {
        const sec = document.getElementById(secId);
        if (!sec) { elConteudo.innerHTML = `<div style="color:${CONFIG.cores.textoMuted};padding:20px;">Seção não encontrada</div>`; return; }

        const C = CONFIG.cores;

        // Mostrar temporariamente se oculta
        const estaOculta = window.getComputedStyle(sec).display === 'none';
        if (estaOculta) {
            sec.style.display = 'block';
            sec.style.visibility = 'hidden';
            sec.style.position = 'absolute';
            sec.style.pointerEvents = 'none';
        }

        const h2 = sec.querySelector('.page-header h2, h2');
        const titulo = h2 ? h2.textContent.trim() : secId;

        // Anotações conhecidas (reutiliza da Estrutura)
        const anotacoes = {
            'page-header': 'cabeçalho da aba', 'cards-grid': 'grid de summary cards',
            'summary-card': 'card resumo', 'card': 'container card', 'card-header': 'header azul (clicável)',
            'card-header-green': 'header verde', 'card-header-dark': 'header escuro',
            'card-body': 'conteúdo do card', 'card-collapsible': 'conteúdo colapsável',
            'card-toggle': 'chevron', 'filter-bar': 'barra de filtro', 'filter-input': 'campo busca',
            'filter-count': 'contador resultados', 'ranking-table': 'tabela ranking',
            'table-wrap': 'wrapper tabela (scroll)', 'produto-card': 'card de produto',
            'card-label': 'label', 'card-value': 'valor', 'card-delta': 'variação', 'badge': 'badge período',
            'dre-line': 'linha DRE', 'metric-row': 'linha métrica', 'text-right': 'alinhado direita'
        };

        function obterNota(el) {
            const notas = [];
            el.classList.forEach(cls => { if (anotacoes[cls]) notas.push(anotacoes[cls]); });
            if ((el.tagName === 'H2' || el.tagName === 'SPAN' || el.tagName === 'BUTTON' || el.tagName === 'INPUT') && el.textContent) {
                const txt = el.textContent.trim().split('\n')[0].trim();
                if (txt.length > 0 && txt.length < 40) notas.push('"' + txt + '"');
            }
            if (el.tagName === 'INPUT' && el.placeholder) notas.push('"' + el.placeholder + '"');
            return notas.join(', ');
        }

        const tagsVisiveis = ['div','section','header','nav','aside','footer','form','table','thead','tbody','tr','th','td','ul','ol','li','button','input','select','textarea','span','a','h1','h2','h3','h4','i','img'];
        const abaElements = [];

        function filtrarFilhosAba(el, depth) {
            if (depth >= 8) return [];
            const filhos = [];
            Array.from(el.children).forEach(child => {
                const tag = child.tagName?.toLowerCase();
                if (!tag) return;
                if (child.id && child.id.startsWith('inspetor-')) return;
                const temId = child.id || (child.classList.length > 0);
                if (!tagsVisiveis.includes(tag) && !temId) return;
                const rect = child.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;
                const ehImportante = temId || ['section','header','nav','aside','footer','form','table','thead','tbody'].includes(tag);
                if (!ehImportante && depth > 5) return;
                filhos.push(child);
            });
            return filhos;
        }

        function scanAbaEstrutura(el, depth, prefixo) {
            const tag = el.tagName?.toLowerCase();
            if (!tag) return '';

            const idx = abaElements.length;
            abaElements.push(el);

            let seletor = tag;
            if (el.id) seletor += `<span style="color:${C.amarelo};">#${el.id}</span>`;
            if (el.classList.length > 0) seletor += `<span style="color:${C.verde};">.${Array.from(el.classList).slice(0, 3).join('.')}</span>`;

            const nota = obterNota(el);
            const notaHtml = nota ? `<span style="color:${C.textoMuted};font-size:10px;margin-left:6px;">← ${nota}</span>` : '';

            let html = `<div class="aba-tree-item" data-aba-idx="${idx}" style="margin:1px 0;white-space:nowrap;font-size:11px;display:flex;align-items:center;gap:4px;padding:2px 4px;border-radius:3px;transition:background 0.1s;cursor:pointer;"
                 onmouseenter="this.style.background='${C.bgHover}'" onmouseleave="this.style.background='transparent'">
                <input type="checkbox" class="aba-tree-check" data-aba-idx="${idx}" style="width:12px;height:12px;accent-color:${C.accent};cursor:pointer;flex-shrink:0;">
                <span style="color:${C.borda};flex-shrink:0;">${prefixo}</span><span style="color:${C.cyan};">${seletor}</span>${notaHtml}
            </div>`;

            const filhos = filtrarFilhosAba(el, depth + 1);
            filhos.forEach((child, i) => {
                const ehUltimo = i === filhos.length - 1;
                const conector = ehUltimo ? '└── ' : '├── ';
                const novoPrefixo = prefixo.replace('├── ', '│&nbsp;&nbsp;&nbsp;').replace('└── ', '&nbsp;&nbsp;&nbsp;&nbsp;') + conector;
                html += scanAbaEstrutura(child, depth + 1, depth === 0 ? conector : novoPrefixo);
            });

            return html;
        }

        let html = `
            <div style="margin-bottom:8px;">
                <div style="font-size:14px;font-weight:700;color:${C.texto};">${titulo}</div>
            </div>
            <div style="background:${C.bgCard};border-radius:10px;padding:10px;font-family:'JetBrains Mono',monospace;overflow-x:auto;">
        `;
        html += scanAbaEstrutura(sec, 0, '');
        html += '</div>';

        // Painel de detalhe
        html += `<div id="painel-detalhe-aba" style="display:none;"></div>`;

        // Gerar texto copiável
        function gerarTextoAba(el, depth, prefixo) {
            const tag = el.tagName?.toLowerCase();
            if (!tag) return '';
            if (el.id && el.id.startsWith('inspetor-')) return '';
            const temId = el.id || (el.classList.length > 0);
            if (!tagsVisiveis.includes(tag) && !temId) return '';
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return '';
            const ehImportante = temId || ['section','header','nav','aside','footer','form','table','thead','tbody'].includes(tag);
            if (!ehImportante && depth > 5) return '';

            let sel = tag;
            if (el.id) sel += '#' + el.id;
            if (el.classList.length > 0) sel += '.' + Array.from(el.classList).slice(0, 3).join('.');
            const nota = obterNota(el);
            const notaTxt = nota ? '  ← ' + nota : '';
            let txt = `${prefixo}${sel}${notaTxt}\n`;

            const filhos = filtrarFilhosAba(el, depth + 1);
            filhos.forEach((child, i) => {
                const ehUltimo = i === filhos.length - 1;
                const conector = ehUltimo ? '└── ' : '├── ';
                const novoPrefixo = prefixo.replace('├── ', '│   ').replace('└── ', '    ') + conector;
                txt += gerarTextoAba(child, depth + 1, depth === 0 ? conector : novoPrefixo);
            });
            return txt;
        }
        const textoAba = gerarTextoAba(sec, 0, '');
        html += btnCopiar(textoAba, 'COPIAR ESTRUTURA');

        // Restaurar
        if (estaOculta) {
            sec.style.display = '';
            sec.style.visibility = '';
            sec.style.position = '';
            sec.style.pointerEvents = '';
        }

        elConteudo.innerHTML = html;

        // Clique no TEXTO → destaca na página
        elConteudo.querySelectorAll('.aba-tree-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('aba-tree-check')) return;
                const idx = parseInt(item.dataset.abaIdx);
                const domEl = abaElements[idx];
                if (domEl) destacarNaPagina(domEl);
            });
        });

        // Clique no CHECKBOX → abre painel de alteração
        elConteudo.querySelectorAll('.aba-tree-check').forEach(cb => {
            cb.addEventListener('change', () => {
                const idx = parseInt(cb.dataset.abaIdx);
                const domEl = abaElements[idx];
                if (cb.checked) {
                    destacarNaPagina(domEl);
                    const elInfo = {
                        tipo: domEl.tagName.toLowerCase(),
                        label: obterSeletor(domEl),
                        domEl: domEl,
                        seletor: obterSeletor(domEl)
                    };
                    renderDetalhesElemento(elInfo, secId, titulo);
                } else {
                    const painel = document.getElementById('painel-detalhe-aba');
                    if (painel) painel.style.display = 'none';
                }
            });
        });
    }

    function scanElementosAba(sec) {
        const C = CONFIG.cores;
        const elementos = [];

        // Page header
        const pageHeader = sec.querySelector('.page-header');
        if (pageHeader) {
            const h2 = pageHeader.querySelector('h2');
            elementos.push({
                tipo: 'Header',
                label: h2 ? h2.textContent.trim() : 'Page Header',
                extra: '',
                corTipo: C.cyan,
                domEl: pageHeader,
                seletor: obterSeletor(pageHeader)
            });
        }

        // Summary cards grid
        const cardsGrid = sec.querySelector('.cards-grid');
        if (cardsGrid) {
            elementos.push({
                tipo: 'Summary Cards',
                label: 'Grid de cards resumo',
                extra: 'dinâmico',
                corTipo: C.laranja,
                domEl: cardsGrid,
                seletor: obterSeletor(cardsGrid)
            });
        }

        // Filtros
        sec.querySelectorAll('.filter-bar').forEach(f => {
            const input = f.querySelector('input');
            const count = f.querySelector('.filter-count');
            elementos.push({
                tipo: 'Filtro',
                label: input ? `"${input.placeholder}"` : 'Filtro',
                extra: count ? count.textContent.trim() : '',
                corTipo: C.roxo,
                domEl: f,
                seletor: obterSeletor(f)
            });
        });

        // Cards colapsáveis — separar header e body
        function scanCard(card) {
            const header = card.querySelector('.card-header');
            const body = card.querySelector('.card-body, .card-collapsible');
            const titulo = header ? header.textContent.trim().replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ') : 'Card';

            if (header) {
                elementos.push({
                    tipo: 'Card Header',
                    label: titulo.substring(0, 45),
                    extra: '',
                    corTipo: C.cyan,
                    domEl: header,
                    seletor: obterSeletor(header)
                });
            }

            if (body) {
                const tabela = body.querySelector('table');
                const el = {
                    tipo: 'Card Body',
                    label: titulo.substring(0, 35) + ' (conteúdo)',
                    extra: '',
                    corTipo: C.amarelo,
                    domEl: body,
                    seletor: obterSeletor(body)
                };
                if (tabela) {
                    const ths = Array.from(tabela.querySelectorAll('thead th')).map(th => th.textContent.trim()).filter(t => t);
                    el.extra = ths.length + ' colunas';
                    el.colunas = ths;
                }
                elementos.push(el);
            }

            if (!header && !body) {
                elementos.push({
                    tipo: 'Card',
                    label: titulo.substring(0, 45),
                    extra: '',
                    corTipo: C.amarelo,
                    domEl: card,
                    seletor: obterSeletor(card)
                });
            }
        }

        sec.querySelectorAll(':scope > .card').forEach(scanCard);

        // Container dinâmico com cards individuais
        sec.querySelectorAll('[id^="container"]').forEach(container => {
            container.querySelectorAll('.card').forEach(scanCard);

            if (container.children.length === 0 || container.querySelectorAll('.card').length === 0) {
                elementos.push({
                    tipo: 'Container',
                    label: '#' + container.id,
                    extra: container.children.length + ' filhos',
                    corTipo: C.verde,
                    domEl: container,
                    seletor: obterSeletor(container)
                });
            }
        });

        return elementos;
    }

    function renderDetalhesElemento(el, secId, abaLabel) {
        const painel = document.getElementById('painel-detalhe-aba');
        if (!painel) return;

        const C = CONFIG.cores;
        const domEl = el.domEl;
        const cs = window.getComputedStyle(domEl);
        const rect = domEl.getBoundingClientRect();

        // Descrições didáticas
        function descBorda(v) {
            if (!v || v === '-' || v.includes('0px none') || v === 'none') return 'sem borda';
            return 'linha ao redor';
        }
        function descRadius(v) {
            if (!v || v === '0px') return 'cantos retos';
            return 'cantos arredondados';
        }
        function descPadding(v) {
            if (!v || v === '0px') return 'sem espaço interno';
            const partes = v.split(' ').filter(p => p !== '0px');
            if (partes.length === 0) return 'sem espaço interno';
            return 'espaço interno (afasta conteúdo das bordas)';
        }
        function descMargin(v) {
            if (!v || v === '0px') return 'alinhado à esquerda, sem margem';
            if (v.includes('auto')) return 'centralizado na página';
            const partes = v.split(' ').filter(p => p !== '0px');
            if (partes.length === 0) return 'sem margem';
            return 'com margem externa';
        }
        function descBg(v) {
            if (!v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') return 'transparente';
            if (v.includes('255, 255, 255')) return 'branco';
            return '';
        }
        function descCor(v) {
            if (!v) return '';
            if (v.includes('255, 255, 255') || v === '#ffffff') return 'branco';
            if (v.includes('0, 0, 0') || v === '#000000') return 'preto';
            return '';
        }

        const bordaVal = cs.border !== 'none' ? cs.border : '0px none';
        const bgDesc = descBg(cs.backgroundColor);
        const corDesc = descCor(cs.color);

        // Propriedades com checkbox
        const props = [
            { key: 'seletor', label: 'Seletor', valor: el.seletor, display: `<code style="color:${C.rosa};">${el.seletor}</code>`, desc: '' },
            { key: 'tamanho', label: 'Tamanho', valor: `${Math.round(rect.width)}x${Math.round(rect.height)}`, display: `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`, desc: '' },
            { key: 'bg', label: 'Background', valor: cs.backgroundColor, display: `<span style="display:flex;align-items:center;gap:4px;">${swatch(cs.backgroundColor)}${cs.backgroundColor}</span>`, desc: bgDesc },
            { key: 'cor', label: 'Cor texto', valor: cs.color, display: `<span style="display:flex;align-items:center;gap:4px;">${swatch(cs.color)}${cs.color}</span>`, desc: corDesc },
            { key: 'fonte', label: 'Fonte', valor: `${cs.fontFamily.split(',')[0].replace(/"/g,'')} ${cs.fontSize} (${cs.fontWeight})`, display: `${cs.fontFamily.split(',')[0].replace(/"/g,'')} ${cs.fontSize} (${cs.fontWeight})`, desc: '' },
            { key: 'borda', label: 'Borda', valor: bordaVal, display: bordaVal, desc: descBorda(bordaVal) },
            { key: 'radius', label: 'Radius', valor: cs.borderRadius, display: cs.borderRadius, desc: descRadius(cs.borderRadius) },
            { key: 'padding', label: 'Padding', valor: cs.padding, display: cs.padding, desc: descPadding(cs.padding) },
            { key: 'margin', label: 'Margin', valor: cs.margin, display: cs.margin, desc: descMargin(cs.margin) }
        ];

        const cbStyle = `width:14px;height:14px;accent-color:${C.accent};cursor:pointer;flex-shrink:0;`;

        let propsHtml = '';
        props.forEach(p => {
            const descHtml = p.desc ? `<div style="color:${C.textoMuted};font-size:9px;font-style:italic;margin-top:1px;">${p.desc}</div>` : '';
            const valorCopia = p.desc ? `${p.label}: ${p.desc} → ${p.valor}` : `${p.label}: ${p.valor}`;
            propsHtml += `
                <div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;cursor:pointer;border-radius:4px;transition:background 0.1s;" class="prop-row"
                     onmouseenter="this.style.background='${C.bgHover}'" onmouseleave="this.style.background='transparent'">
                    <input type="checkbox" class="prop-check" data-key="${p.key}" data-label="${p.label}" data-valor="${valorCopia}" style="${cbStyle};margin-top:2px;">
                    <span style="color:${C.textoMuted};font-size:11px;min-width:70px;margin-top:1px;">${p.label}</span>
                    <div style="flex:1;">
                        <span style="color:${C.texto};font-size:11px;word-break:break-all;">${p.display}</span>
                        ${descHtml}
                    </div>
                </div>
            `;
        });

        let html = `
            <div style="margin-top:12px;background:${C.bgCard};border-radius:10px;overflow:hidden;">
                <div style="padding:10px 14px;background:${C.bg};border-bottom:1px solid ${C.borda};display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:${C.accent};font-size:12px;font-weight:700;">${el.tipo}: ${el.label.substring(0, 30)}</span>
                    <button id="btn-fechar-detalhe" style="background:none;border:none;color:${C.textoMuted};cursor:pointer;font-size:14px;">✕</button>
                </div>

                <div style="padding:14px;">
                    <div style="margin-bottom:6px;">
                        <span style="font-size:10px;color:${C.textoMuted};text-transform:uppercase;font-weight:600;">Propriedades</span>
                        <span style="font-size:9px;color:${C.textoMuted};margin-left:8px;">clique para adicionar à instrução</span>
                    </div>
                    ${propsHtml}
                    ${el.colunas ? `<div style="font-size:10px;color:${C.textoMuted};margin-top:6px;margin-bottom:4px;">Colunas: ${el.colunas.join(', ')}</div>` : ''}

                    <div style="font-size:10px;color:${C.amarelo};text-transform:uppercase;margin-top:12px;margin-bottom:6px;font-weight:600;">O que alterar?</div>
                    <div id="alterar-lista" style="margin-bottom:8px;"></div>

                    <button id="btn-copiar-alterar" style="
                        width:100%;margin-top:8px;padding:10px;background:${C.accent};border:none;color:white;
                        border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s;
                    " onmouseenter="this.style.background='${C.accentHover}'" onmouseleave="this.style.background='${C.accent}'">COPIAR INSTRUÇÃO</button>
                </div>
            </div>
        `;

        painel.innerHTML = html;
        painel.style.display = 'block';
        painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        const alterarLista = document.getElementById('alterar-lista');

        function atualizarAlterarLista() {
            const marcados = painel.querySelectorAll('.prop-check:checked');
            if (marcados.length === 0) {
                alterarLista.innerHTML = `<div style="color:${C.textoMuted};font-size:11px;font-style:italic;">Selecione propriedades acima para alterar</div>`;
                return;
            }
            let html = '';
            marcados.forEach(cb => {
                const key = cb.dataset.key;
                const label = cb.dataset.label;
                const valor = cb.dataset.valor;
                html += `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;align-items:center;">
                        <div style="font-size:11px;color:${C.texto};background:${C.bg};padding:6px 10px;border-radius:6px;border:1px solid ${C.borda};">${valor}</div>
                        <input type="text" class="alterar-input" data-key="${key}" data-label="${label}" placeholder="Alterar para..." style="
                            font-size:11px;color:${C.texto};background:${C.bg};padding:6px 10px;border-radius:6px;
                            border:1px solid ${C.borda};outline:none;font-family:system-ui;width:100%;
                        " onfocus="this.style.borderColor='${C.accent}'" onblur="this.style.borderColor='${C.borda}'">
                    </div>
                `;
            });
            alterarLista.innerHTML = html;
        }

        atualizarAlterarLista();

        // Checkbox: ao marcar/desmarcar, atualiza lista
        painel.querySelectorAll('.prop-check').forEach(cb => {
            cb.addEventListener('change', () => atualizarAlterarLista());

            cb.closest('.prop-row').addEventListener('click', (e) => {
                if (e.target === cb) return;
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
            });
        });

        // Fechar
        document.getElementById('btn-fechar-detalhe').addEventListener('click', () => {
            painel.style.display = 'none';
            elConteudo.querySelectorAll('.aba-elemento-item').forEach(i => { i.style.borderLeftColor = 'transparent'; });
        });

        // Copiar: monta texto com atual → alterar para cada prop, e limpa tudo
        document.getElementById('btn-copiar-alterar').addEventListener('click', () => {
            const inputs = alterarLista.querySelectorAll('.alterar-input');
            const instrucoes = [];
            inputs.forEach(inp => {
                const label = inp.dataset.label;
                const key = inp.dataset.key;
                const cb = painel.querySelector(`.prop-check[data-key="${key}"]`);
                const atual = cb ? cb.dataset.valor : '';
                const novo = inp.value.trim();
                if (novo) {
                    instrucoes.push(`${atual} → ${novo}`);
                } else {
                    instrucoes.push(atual);
                }
            });
            let texto = `Aba: ${abaLabel} | Elemento: ${el.tipo} "${el.label}"`;
            if (instrucoes.length > 0) texto += ` | ${instrucoes.join(' | ')}`;
            copiarTexto(texto);
            // Limpar
            painel.querySelectorAll('.prop-check').forEach(c => { c.checked = false; });
            atualizarAlterarLista();
        });
    }

    // =========================================================
    // TOOL 3: ELEMENTOS INTERATIVOS
    // =========================================================

    function renderInterativos() {
        const elementos = scanInterativos();
        const grupos = { button: [], input: [], select: [], textarea: [], a: [] };

        elementos.forEach(el => {
            const tag = el.tag;
            if (grupos[tag]) grupos[tag].push(el);
            else if (tag === 'button' || el.role === 'button') grupos.button.push(el);
        });

        const C = CONFIG.cores;
        let html = `
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: ${C.textoMuted}; text-transform: uppercase;">Elementos Interativos</span>
                <span style="font-size: 11px; color: ${C.textoMuted};">${elementos.length} encontrados</span>
            </div>
        `;

        const labels = { button: 'Botões', input: 'Inputs', select: 'Selects', textarea: 'Textareas', a: 'Links' };
        const icons = { button: '🔘', input: '📝', select: '📋', textarea: '📄', a: '🔗' };

        let globalIdx = 0;

        for (const [tag, items] of Object.entries(grupos)) {
            if (items.length === 0) continue;
            let conteudo = '';
            items.forEach((item, i) => {
                const idx = globalIdx++;
                conteudo += `
                    <div class="interativo-item" data-int-idx="${idx}" style="padding: 8px; margin-bottom: 4px; background: ${C.bg}; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.15s; border-left: 3px solid transparent;"
                         onmouseenter="this.style.background='${C.bgHover}'" onmouseleave="this.style.background='${C.bg}'">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color:${C.cyan};font-weight:600;">${item.seletor}</span>
                            <span style="color:${C.textoMuted};font-size:10px;">${item.largura}×${item.altura}</span>
                        </div>
                        ${item.texto ? `<div style="color:${C.texto};margin-top:3px;">Texto: "${item.texto}"</div>` : ''}
                        ${item.valor ? `<div style="color:${C.verde};margin-top:3px;">Valor: "${item.valor}"</div>` : ''}
                        ${item.placeholder ? `<div style="color:${C.textoMuted};margin-top:3px;">Placeholder: "${item.placeholder}"</div>` : ''}
                        ${item.opcoes ? `<div style="color:${C.roxo};margin-top:3px;">Opções: ${item.opcoes}</div>` : ''}
                        ${item.eventos !== 'nenhum' ? `<div style="color:${C.laranja};margin-top:3px;">Eventos: ${item.eventos}</div>` : ''}
                    </div>
                `;
            });
            html += secao(`${icons[tag]} ${labels[tag]} (${items.length})`, conteudo);
        }

        // Painel de detalhe
        html += `<div id="painel-detalhe-interativo" style="display:none;"></div>`;

        elConteudo.innerHTML = html;

        // Bind cliques
        elConteudo.querySelectorAll('.interativo-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.intIdx);
                const el = elementos[idx];
                // Destacar
                elConteudo.querySelectorAll('.interativo-item').forEach(i => { i.style.borderLeftColor = 'transparent'; });
                item.style.borderLeftColor = C.accent;
                destacarNaPagina(el.domEl);
                renderDetalheInterativo(el);
            });
        });
    }

    function renderDetalheInterativo(item) {
        const painel = document.getElementById('painel-detalhe-interativo');
        if (!painel) return;

        const C = CONFIG.cores;
        const domEl = item.domEl;
        const cs = window.getComputedStyle(domEl);
        const rect = domEl.getBoundingClientRect();
        const eventos = item.eventos || 'nenhum';

        // Detectar função/ação do elemento
        const infoFuncao = obterInfoFuncao(domEl);
        const onclick = domEl.getAttribute('onclick') || '';

        let funcaoDesc = '';
        if (infoFuncao.funcao !== 'nenhuma') {
            funcaoDesc = infoFuncao.funcao;
        } else if (onclick) {
            funcaoDesc = onclick.substring(0, 60);
        }

        let html = `
            <div style="margin-top:12px;background:${C.bgCard};border-radius:10px;overflow:hidden;">
                <div style="padding:10px 14px;background:${C.bg};border-bottom:1px solid ${C.borda};display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:${C.accent};font-size:12px;font-weight:700;">${item.seletor}</span>
                    <button id="btn-fechar-detalhe-int" style="background:none;border:none;color:${C.textoMuted};cursor:pointer;font-size:14px;">✕</button>
                </div>

                <div style="padding:14px;">
                    ${item.texto ? `<div style="font-size:13px;color:${C.texto};margin-bottom:10px;font-weight:600;">Texto: "${item.texto}"</div>` : ''}

                    ${funcaoDesc ? `
                    <div style="margin-bottom:12px;background:#2d1f0f;border-radius:8px;padding:10px;">
                        <div style="font-size:10px;color:${C.laranja};text-transform:uppercase;margin-bottom:4px;font-weight:600;">Função</div>
                        <div style="font-size:12px;color:${C.amarelo};font-weight:600;">${funcaoDesc}</div>
                        ${infoFuncao.tipo ? `<div style="font-size:10px;color:${C.textoMuted};margin-top:2px;">via ${infoFuncao.tipo}</div>` : ''}
                    </div>
                    ` : ''}

                    ${eventos !== 'nenhum' ? `
                    <div style="margin-bottom:12px;background:#1e3a2f;border-radius:8px;padding:10px;">
                        <div style="font-size:10px;color:${C.verde};text-transform:uppercase;margin-bottom:4px;font-weight:600;">Eventos JS</div>
                        <div style="font-size:11px;color:${C.verde};">${eventos}</div>
                    </div>
                    ` : ''}

                    <div style="font-size:10px;color:${C.textoMuted};text-transform:uppercase;margin-bottom:6px;font-weight:600;">Design</div>
                    <div style="display:grid;grid-template-columns:80px 1fr;gap:4px;font-size:11px;margin-bottom:12px;">
                        ${grid2('Tamanho', `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`)}
                        ${grid2('Background', `<span style="display:flex;align-items:center;gap:4px;">${swatch(cs.backgroundColor)}${cs.backgroundColor}</span>`)}
                        ${grid2('Cor texto', `<span style="display:flex;align-items:center;gap:4px;">${swatch(cs.color)}${cs.color}</span>`)}
                        ${grid2('Fonte', `${cs.fontFamily.split(',')[0].replace(/"/g,'')} ${cs.fontSize} (${cs.fontWeight})`)}
                        ${grid2('Borda', cs.border !== 'none' ? cs.border : '-')}
                        ${grid2('Radius', cs.borderRadius)}
                        ${grid2('Padding', cs.padding)}
                    </div>

                    <div style="font-size:10px;color:${C.amarelo};text-transform:uppercase;margin-bottom:6px;font-weight:600;">O que alterar?</div>
                    <textarea id="campo-alterar-int" placeholder="Descreva a alteração desejada..." style="
                        width:100%;min-height:60px;background:${C.bg};color:${C.texto};border:1px solid ${C.borda};
                        border-radius:8px;padding:10px;font-size:12px;font-family:system-ui;resize:vertical;outline:none;
                    " onfocus="this.style.borderColor='${C.accent}'" onblur="this.style.borderColor='${C.borda}'"></textarea>

                    <button id="btn-copiar-alterar-int" style="
                        width:100%;margin-top:8px;padding:10px;background:${C.accent};border:none;color:white;
                        border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s;
                    " onmouseenter="this.style.background='${C.accentHover}'" onmouseleave="this.style.background='${C.accent}'">COPIAR INSTRUÇÃO</button>
                </div>
            </div>
        `;

        painel.innerHTML = html;
        painel.style.display = 'block';
        painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        document.getElementById('btn-fechar-detalhe-int').addEventListener('click', () => {
            painel.style.display = 'none';
            elConteudo.querySelectorAll('.interativo-item').forEach(i => { i.style.borderLeftColor = 'transparent'; });
        });

        document.getElementById('btn-copiar-alterar-int').addEventListener('click', () => {
            const alteracao = document.getElementById('campo-alterar-int').value.trim();
            const props = `seletor: ${item.seletor}, tamanho: ${Math.round(rect.width)}x${Math.round(rect.height)}, bg: ${cs.backgroundColor}, cor: ${cs.color}, fonte: ${cs.fontFamily.split(',')[0].replace(/"/g,'')} ${cs.fontSize}, radius: ${cs.borderRadius}, padding: ${cs.padding}`;
            const funcTxt = funcaoDesc ? `, função: ${funcaoDesc}` : '';
            const eventTxt = eventos !== 'nenhum' ? `, eventos: ${eventos}` : '';
            let texto = `Elemento: ${item.seletor}${item.texto ? ' "' + item.texto + '"' : ''} | Atual: (${props}${funcTxt}${eventTxt})`;
            if (alteracao) texto += ` | ALTERAR: ${alteracao}`;
            copiarTexto(texto);
        });
    }

    function scanInterativos() {
        const seletores = 'button, input, select, textarea, a[href], [role="button"], [onclick]';
        const els = document.querySelectorAll(seletores);
        const resultado = [];

        els.forEach(el => {
            if (isInspetor(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;

            const tag = el.tagName.toLowerCase();
            const item = {
                tag,
                seletor: obterSeletor(el),
                largura: Math.round(rect.width),
                altura: Math.round(rect.height),
                eventos: capturarEventosElemento(el),
                domEl: el
            };

            if (tag === 'button' || tag === 'a') item.texto = el.textContent?.trim().substring(0, 40) || '';
            if (tag === 'input' || tag === 'textarea') {
                item.tipo = el.type || 'text';
                item.valor = el.value || '';
                item.placeholder = el.placeholder || '';
            }
            if (tag === 'select') {
                item.valor = el.options[el.selectedIndex]?.text || '';
                item.opcoes = Array.from(el.options).map(o => o.text).join(', ');
            }

            resultado.push(item);
        });

        return resultado;
    }

    // =========================================================
    // TOOL 4: DESIGN SYSTEM SCANNER
    // =========================================================

    function renderDesign() {
        const scan = scanDesignSystem();
        state.ultimoScan = scan;

        let html = `
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted}; text-transform: uppercase;">Design System Scanner</span>
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted};">${scan.totalElementos} elementos analisados</span>
            </div>
        `;

        // PALETA DE CORES
        let coresHtml = '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
        scan.cores.backgrounds.slice(0, 12).forEach(c => {
            coresHtml += `
                <div style="text-align: center; cursor: pointer;" onclick="navigator.clipboard.writeText('${c.hex || c.valor}');" title="Clique para copiar">
                    <div style="width: 40px; height: 40px; border-radius: 8px; background: ${c.valor}; border: 1px solid ${CONFIG.cores.borda};"></div>
                    <div style="font-size: 9px; color: ${CONFIG.cores.textoMuted}; margin-top: 3px;">${c.hex || c.valor}</div>
                    <div style="font-size: 9px; color: ${CONFIG.cores.textoMuted};">×${c.qtd}</div>
                </div>
            `;
        });
        coresHtml += '</div>';

        if (scan.cores.textos.length > 0) {
            coresHtml += `<div style="margin-top: 10px; font-size: 11px; color: ${CONFIG.cores.textoMuted}; margin-bottom: 6px;">Cores de Texto:</div>`;
            coresHtml += '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
            scan.cores.textos.slice(0, 8).forEach(c => {
                coresHtml += `
                    <div style="display:flex;align-items:center;gap:4px;background:${CONFIG.cores.bg};padding:4px 8px;border-radius:6px;cursor:pointer;" onclick="navigator.clipboard.writeText('${c.hex || c.valor}');" title="Copiar">
                        ${swatch(c.valor)} <span style="font-size:11px;">${c.hex || c.valor}</span> <span style="font-size:10px;color:${CONFIG.cores.textoMuted};">×${c.qtd}</span>
                    </div>
                `;
            });
            coresHtml += '</div>';
        }

        if (scan.cores.bordas.length > 0) {
            coresHtml += `<div style="margin-top: 10px; font-size: 11px; color: ${CONFIG.cores.textoMuted}; margin-bottom: 6px;">Cores de Borda:</div>`;
            coresHtml += '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
            scan.cores.bordas.slice(0, 6).forEach(c => {
                coresHtml += `
                    <div style="display:flex;align-items:center;gap:4px;background:${CONFIG.cores.bg};padding:4px 8px;border-radius:6px;">
                        ${swatch(c.valor)} <span style="font-size:11px;">${c.hex || c.valor}</span> <span style="font-size:10px;color:${CONFIG.cores.textoMuted};">×${c.qtd}</span>
                    </div>
                `;
            });
            coresHtml += '</div>';
        }

        html += secao('🎨 Paleta de Cores', coresHtml);

        // TIPOGRAFIA
        let tipoHtml = '';
        scan.tipografia.fontes.forEach(f => {
            tipoHtml += `<div style="padding:6px 8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;display:flex;justify-content:space-between;">
                <span style="font-family:${f.valor};font-size:13px;">${f.valor}</span>
                <span style="color:${CONFIG.cores.textoMuted};font-size:11px;">×${f.qtd}</span>
            </div>`;
        });
        tipoHtml += `<div style="margin-top:8px;font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Tamanhos:</div>`;
        tipoHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        scan.tipografia.tamanhos.slice(0, 10).forEach(t => {
            tipoHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;">${t.valor} <span style="color:${CONFIG.cores.textoMuted};">×${t.qtd}</span></span>`;
        });
        tipoHtml += '</div>';
        tipoHtml += `<div style="margin-top:8px;font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Pesos:</div>`;
        tipoHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        scan.tipografia.pesos.forEach(p => {
            tipoHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;font-weight:${p.valor};">${p.valor} <span style="color:${CONFIG.cores.textoMuted};">×${p.qtd}</span></span>`;
        });
        tipoHtml += '</div>';
        html += secao('🔤 Tipografia', tipoHtml);

        // ESPAÇAMENTOS
        let espHtml = '';
        espHtml += `<div style="font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Paddings mais usados:</div>`;
        espHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
        scan.espacamentos.paddings.slice(0, 8).forEach(p => {
            espHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;color:${CONFIG.cores.verde};">${p.valor} <span style="color:${CONFIG.cores.textoMuted};">×${p.qtd}</span></span>`;
        });
        espHtml += '</div>';
        espHtml += `<div style="font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Margins mais usados:</div>`;
        espHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
        scan.espacamentos.margins.slice(0, 8).forEach(m => {
            espHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;color:${CONFIG.cores.laranja};">${m.valor} <span style="color:${CONFIG.cores.textoMuted};">×${m.qtd}</span></span>`;
        });
        espHtml += '</div>';
        espHtml += `<div style="font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Border-radius:</div>`;
        espHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        scan.espacamentos.radiuses.slice(0, 6).forEach(r => {
            espHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;color:${CONFIG.cores.cyan};">${r.valor} <span style="color:${CONFIG.cores.textoMuted};">×${r.qtd}</span></span>`;
        });
        espHtml += '</div>';
        html += secao('📐 Espaçamentos', espHtml);

        // COMPONENTES (botões, inputs, tabelas, cards)
        let compHtml = '';

        // Botões
        if (scan.componentes.botoes.length > 0) {
            compHtml += `<div style="font-size:11px;color:${CONFIG.cores.amarelo};margin-bottom:6px;font-weight:600;">Botões (${scan.componentes.botoes.length} estilos)</div>`;
            scan.componentes.botoes.slice(0, 5).forEach(b => {
                compHtml += `<div style="padding:6px 8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;font-size:11px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        ${swatch(b.bg)} <span style="color:${CONFIG.cores.cyan};">${b.exemplo}</span>
                        <span style="color:${CONFIG.cores.textoMuted};">×${b.qtd}</span>
                    </div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">bg: ${b.bg} | cor: ${b.cor} | radius: ${b.radius} | padding: ${b.padding}</div>
                </div>`;
            });
        }

        // Tabelas
        if (scan.componentes.tabelas.length > 0) {
            compHtml += `<div style="font-size:11px;color:${CONFIG.cores.amarelo};margin-top:12px;margin-bottom:6px;font-weight:600;">Tabelas (${scan.componentes.tabelas.length})</div>`;
            scan.componentes.tabelas.forEach(t => {
                compHtml += `<div style="padding:8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;font-size:11px;">
                    <div style="color:${CONFIG.cores.cyan};font-weight:600;">${t.seletor}</div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:3px;">Colunas: ${t.colunas} | Linhas: ${t.linhas}</div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">Header bg: ${t.headerBg} | Header cor: ${t.headerCor}</div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">Body bg: ${t.bodyBg} | Borda: ${t.borda}</div>
                    ${t.headers ? `<div style="color:${CONFIG.cores.roxo};margin-top:2px;">Headers: ${t.headers}</div>` : ''}
                </div>`;
            });
        }

        // Cards
        if (scan.componentes.cards.length > 0) {
            compHtml += `<div style="font-size:11px;color:${CONFIG.cores.amarelo};margin-top:12px;margin-bottom:6px;font-weight:600;">Cards/Painéis (${scan.componentes.cards.length} estilos)</div>`;
            scan.componentes.cards.slice(0, 5).forEach(c => {
                compHtml += `<div style="padding:6px 8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;font-size:11px;">
                    <div style="display:flex;align-items:center;gap:6px;">${swatch(c.bg)} <span style="color:${CONFIG.cores.cyan};">${c.exemplo}</span> <span style="color:${CONFIG.cores.textoMuted};">×${c.qtd}</span></div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">bg: ${c.bg} | radius: ${c.radius} | shadow: ${c.shadow ? 'sim' : 'não'} | padding: ${c.padding}</div>
                </div>`;
            });
        }

        // Inputs
        if (scan.componentes.inputs.length > 0) {
            compHtml += `<div style="font-size:11px;color:${CONFIG.cores.amarelo};margin-top:12px;margin-bottom:6px;font-weight:600;">Inputs (${scan.componentes.inputs.length} estilos)</div>`;
            scan.componentes.inputs.slice(0, 4).forEach(inp => {
                compHtml += `<div style="padding:6px 8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;font-size:11px;">
                    <div style="color:${CONFIG.cores.cyan};">${inp.exemplo}</div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">bg: ${inp.bg} | borda: ${inp.borda} | radius: ${inp.radius} | padding: ${inp.padding} | ×${inp.qtd}</div>
                </div>`;
            });
        }

        html += secao('🧩 Componentes', compHtml || '<span style="color:#64748b;">Nenhum componente encontrado</span>');

        // Copiar resumo
        const resumo = gerarResumoDesign(scan);
        html += btnCopiar(resumo, 'COPIAR DESIGN SYSTEM');

        elConteudo.innerHTML = html;
    }

    function scanDesignSystem() {
        const allElements = document.querySelectorAll('body *');
        const bgMap = {}, txtMap = {}, bordaMap = {};
        const fonteMap = {}, tamanhoMap = {}, pesoMap = {};
        const paddingMap = {}, marginMap = {}, radiusMap = {};
        let total = 0;

        allElements.forEach(el => {
            if (isInspetor(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            const cs = window.getComputedStyle(el);
            total++;

            // Cores
            const bg = cs.backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                bgMap[bg] = (bgMap[bg] || 0) + 1;
            }
            const cor = cs.color;
            if (cor) txtMap[cor] = (txtMap[cor] || 0) + 1;

            const bc = cs.borderColor;
            if (bc && cs.borderWidth !== '0px' && bc !== 'rgb(0, 0, 0)') {
                bordaMap[bc] = (bordaMap[bc] || 0) + 1;
            }

            // Tipografia
            const fonte = cs.fontFamily.split(',')[0].replace(/"/g, '').trim();
            if (fonte) fonteMap[fonte] = (fonteMap[fonte] || 0) + 1;
            tamanhoMap[cs.fontSize] = (tamanhoMap[cs.fontSize] || 0) + 1;
            pesoMap[cs.fontWeight] = (pesoMap[cs.fontWeight] || 0) + 1;

            // Espaçamentos
            const p = cs.padding;
            if (p && p !== '0px') paddingMap[p] = (paddingMap[p] || 0) + 1;
            const m = cs.margin;
            if (m && m !== '0px') marginMap[m] = (marginMap[m] || 0) + 1;
            const r = cs.borderRadius;
            if (r && r !== '0px') radiusMap[r] = (radiusMap[r] || 0) + 1;
        });

        function sortMap(map) {
            return Object.entries(map)
                .map(([valor, qtd]) => ({ valor, qtd, hex: rgbToHex(valor) }))
                .sort((a, b) => b.qtd - a.qtd);
        }

        // Componentes
        const botoes = scanBotoes();
        const tabelas = scanTabelas();
        const cards = scanCards();
        const inputs = scanInputs();

        return {
            totalElementos: total,
            cores: {
                backgrounds: sortMap(bgMap),
                textos: sortMap(txtMap),
                bordas: sortMap(bordaMap)
            },
            tipografia: {
                fontes: sortMap(fonteMap),
                tamanhos: sortMap(tamanhoMap),
                pesos: sortMap(pesoMap)
            },
            espacamentos: {
                paddings: sortMap(paddingMap),
                margins: sortMap(marginMap),
                radiuses: sortMap(radiusMap)
            },
            componentes: { botoes, tabelas, cards, inputs }
        };
    }

    function scanBotoes() {
        const btns = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
        const estilos = {};

        btns.forEach(btn => {
            if (isInspetor(btn)) return;
            const rect = btn.getBoundingClientRect();
            if (rect.width === 0) return;
            const cs = window.getComputedStyle(btn);
            const key = `${cs.backgroundColor}|${cs.color}|${cs.borderRadius}|${cs.padding}`;
            if (!estilos[key]) {
                estilos[key] = {
                    bg: cs.backgroundColor,
                    cor: cs.color,
                    radius: cs.borderRadius,
                    padding: cs.padding,
                    exemplo: obterSeletor(btn),
                    qtd: 0
                };
            }
            estilos[key].qtd++;
        });

        return Object.values(estilos).sort((a, b) => b.qtd - a.qtd);
    }

    function scanTabelas() {
        const tabelas = document.querySelectorAll('table');
        return Array.from(tabelas).filter(t => !isInspetor(t)).map(t => {
            const headerRow = t.querySelector('thead tr, tr:first-child');
            const headers = headerRow ? Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent.trim()).slice(0, 6) : [];
            const rows = t.querySelectorAll('tbody tr, tr');
            const th = t.querySelector('th');
            const td = t.querySelector('td');
            const thCs = th ? window.getComputedStyle(th) : null;
            const tdCs = td ? window.getComputedStyle(td) : null;

            return {
                seletor: obterSeletor(t),
                colunas: headers.length || (headerRow ? headerRow.children.length : 0),
                linhas: rows.length,
                headers: headers.join(', '),
                headerBg: thCs ? thCs.backgroundColor : '-',
                headerCor: thCs ? thCs.color : '-',
                bodyBg: tdCs ? tdCs.backgroundColor : '-',
                borda: tdCs ? tdCs.border : '-'
            };
        });
    }

    function scanCards() {
        // Detectar elementos que parecem cards (radius + shadow ou radius + bg diferente)
        const candidatos = document.querySelectorAll('div, section, article');
        const estilos = {};

        candidatos.forEach(el => {
            if (isInspetor(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 30) return;
            const cs = window.getComputedStyle(el);
            const hasShadow = cs.boxShadow !== 'none';
            const hasRadius = cs.borderRadius !== '0px';
            const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';

            if ((hasRadius && hasShadow) || (hasRadius && hasBg && rect.width > 100)) {
                const key = `${cs.backgroundColor}|${cs.borderRadius}|${hasShadow}|${cs.padding}`;
                if (!estilos[key]) {
                    estilos[key] = {
                        bg: cs.backgroundColor,
                        radius: cs.borderRadius,
                        shadow: hasShadow,
                        padding: cs.padding,
                        exemplo: obterSeletor(el),
                        qtd: 0
                    };
                }
                estilos[key].qtd++;
            }
        });

        return Object.values(estilos).sort((a, b) => b.qtd - a.qtd);
    }

    function scanInputs() {
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="search"], input:not([type]), textarea, select');
        const estilos = {};

        inputs.forEach(inp => {
            if (isInspetor(inp)) return;
            const cs = window.getComputedStyle(inp);
            const key = `${cs.backgroundColor}|${cs.border}|${cs.borderRadius}|${cs.padding}`;
            if (!estilos[key]) {
                estilos[key] = {
                    bg: cs.backgroundColor,
                    borda: cs.border,
                    radius: cs.borderRadius,
                    padding: cs.padding,
                    exemplo: obterSeletor(inp),
                    qtd: 0
                };
            }
            estilos[key].qtd++;
        });

        return Object.values(estilos).sort((a, b) => b.qtd - a.qtd);
    }

    function gerarResumoDesign(scan) {
        let txt = 'DESIGN SYSTEM SCANNER\n\n';

        txt += 'PALETA DE CORES:\n';
        txt += '  Backgrounds: ' + scan.cores.backgrounds.slice(0, 8).map(c => `${c.hex || c.valor} (×${c.qtd})`).join(', ') + '\n';
        txt += '  Textos: ' + scan.cores.textos.slice(0, 6).map(c => `${c.hex || c.valor} (×${c.qtd})`).join(', ') + '\n';
        txt += '  Bordas: ' + scan.cores.bordas.slice(0, 4).map(c => `${c.hex || c.valor} (×${c.qtd})`).join(', ') + '\n';

        txt += '\nTIPOGRAFIA:\n';
        txt += '  Fontes: ' + scan.tipografia.fontes.map(f => `${f.valor} (×${f.qtd})`).join(', ') + '\n';
        txt += '  Tamanhos: ' + scan.tipografia.tamanhos.slice(0, 8).map(t => `${t.valor} (×${t.qtd})`).join(', ') + '\n';
        txt += '  Pesos: ' + scan.tipografia.pesos.map(p => `${p.valor} (×${p.qtd})`).join(', ') + '\n';

        txt += '\nESPAÇAMENTOS:\n';
        txt += '  Paddings: ' + scan.espacamentos.paddings.slice(0, 6).map(p => `${p.valor} (×${p.qtd})`).join(', ') + '\n';
        txt += '  Margins: ' + scan.espacamentos.margins.slice(0, 6).map(m => `${m.valor} (×${m.qtd})`).join(', ') + '\n';
        txt += '  Border-radius: ' + scan.espacamentos.radiuses.slice(0, 4).map(r => `${r.valor} (×${r.qtd})`).join(', ') + '\n';

        txt += '\nCOMPONENTES:\n';
        if (scan.componentes.botoes.length > 0) {
            txt += '  Botões:\n';
            scan.componentes.botoes.slice(0, 3).forEach(b => {
                txt += `    ${b.exemplo} (×${b.qtd}) bg:${b.bg} cor:${b.cor} radius:${b.radius} padding:${b.padding}\n`;
            });
        }
        if (scan.componentes.tabelas.length > 0) {
            txt += '  Tabelas:\n';
            scan.componentes.tabelas.forEach(t => {
                txt += `    ${t.seletor} (${t.colunas}col × ${t.linhas}rows) header-bg:${t.headerBg} | Headers: ${t.headers}\n`;
            });
        }

        return txt;
    }

    // =========================================================
    // TOOL 5: NAVEGAÇÃO
    // =========================================================

    function renderNavegacao() {
        const nav = scanNavegacao();

        let html = `
            <div style="margin-bottom: 12px;">
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted}; text-transform: uppercase;">Mapa de Navegação</span>
            </div>
        `;

        // Tabs/abas
        if (nav.tabs.length > 0) {
            let tabsHtml = '';
            nav.tabs.forEach(g => {
                tabsHtml += `<div style="margin-bottom: 8px;">
                    <div style="color:${CONFIG.cores.cyan};font-size:12px;font-weight:600;margin-bottom:4px;">${g.container}</div>`;
                g.items.forEach(item => {
                    const ativoStyle = item.ativo ? `background:${CONFIG.cores.accent};color:white;` : `background:${CONFIG.cores.bg};color:${CONFIG.cores.textoMuted};`;
                    tabsHtml += `<span style="${ativoStyle} padding:3px 10px;border-radius:4px;font-size:11px;margin:2px 3px 2px 0;display:inline-block;">${item.texto}${item.ativo ? ' ●' : ''}</span>`;
                });
                tabsHtml += '</div>';
            });
            html += secao('📑 Abas / Tabs', tabsHtml);
        }

        // Nav menus
        if (nav.menus.length > 0) {
            let menuHtml = '';
            nav.menus.forEach(m => {
                menuHtml += `<div style="margin-bottom: 8px;">
                    <div style="color:${CONFIG.cores.cyan};font-size:12px;font-weight:600;margin-bottom:4px;">${m.container}</div>`;
                m.items.forEach(item => {
                    const ativoStyle = item.ativo ? `color:${CONFIG.cores.verde};` : `color:${CONFIG.cores.texto};`;
                    menuHtml += `<div style="padding:3px 0;font-size:12px;${ativoStyle}">${item.ativo ? '● ' : '  '}${item.texto}${item.href ? ` → ${item.href}` : ''}</div>`;
                });
                menuHtml += '</div>';
            });
            html += secao('🧭 Menus de Navegação', menuHtml);
        }

        // Links internos
        if (nav.links.length > 0) {
            let linksHtml = '<div style="max-height: 200px; overflow-y: auto;">';
            nav.links.slice(0, 20).forEach(l => {
                linksHtml += `<div style="padding:3px 0;font-size:11px;display:flex;justify-content:space-between;">
                    <span style="color:${CONFIG.cores.cyan};word-break:break-all;">${l.texto}</span>
                    <span style="color:${CONFIG.cores.textoMuted};font-size:10px;flex-shrink:0;margin-left:8px;">${l.href}</span>
                </div>`;
            });
            linksHtml += '</div>';
            html += secao(`🔗 Links (${nav.links.length})`, linksHtml);
        }

        // Seções visíveis
        if (nav.secoes.length > 0) {
            let secoesHtml = '';
            nav.secoes.forEach(s => {
                const visStyle = s.visivel ? `color:${CONFIG.cores.verde};` : `color:${CONFIG.cores.textoMuted};text-decoration:line-through;`;
                secoesHtml += `<div style="padding:4px 8px;margin-bottom:3px;background:${CONFIG.cores.bg};border-radius:4px;font-size:11px;${visStyle}">
                    ${s.seletor}${s.titulo ? ` — "${s.titulo}"` : ''} ${s.visivel ? '(visível)' : '(oculta)'}
                </div>`;
            });
            html += secao('📄 Seções da Página', secoesHtml);
        }

        const textoNav = gerarTextoNavegacao(nav);
        html += btnCopiar(textoNav, 'COPIAR MAPA');

        elConteudo.innerHTML = html;
    }

    function scanNavegacao() {
        const resultado = { tabs: [], menus: [], links: [], secoes: [] };

        // Tabs: procurar containers com botões/links que parecem tabs
        const tabContainers = document.querySelectorAll('[role="tablist"], .tabs, .nav-tabs, .tab-bar, .tab-buttons');
        tabContainers.forEach(container => {
            if (isInspetor(container)) return;
            const btns = container.querySelectorAll('button, a, [role="tab"]');
            if (btns.length > 1) {
                resultado.tabs.push({
                    container: obterSeletor(container),
                    items: Array.from(btns).map(btn => ({
                        texto: btn.textContent.trim().substring(0, 30),
                        ativo: btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true' ||
                               (window.getComputedStyle(btn).backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                                window.getComputedStyle(btn).backgroundColor !== 'transparent')
                    }))
                });
            }
        });

        // Também buscar padrões comuns de tabs sem container específico
        if (resultado.tabs.length === 0) {
            const possiveisTabs = document.querySelectorAll('nav button, header button');
            const groups = new Map();
            possiveisTabs.forEach(btn => {
                if (isInspetor(btn)) return;
                const parent = btn.parentElement;
                if (!groups.has(parent)) groups.set(parent, []);
                groups.get(parent).push(btn);
            });
            groups.forEach((btns, parent) => {
                if (btns.length > 1) {
                    resultado.tabs.push({
                        container: obterSeletor(parent),
                        items: btns.map(btn => ({
                            texto: btn.textContent.trim().substring(0, 30),
                            ativo: btn.classList.contains('active')
                        }))
                    });
                }
            });
        }

        // Menus de navegação
        const navs = document.querySelectorAll('nav, [role="navigation"], .sidebar, .nav-menu, .menu');
        navs.forEach(nav => {
            if (isInspetor(nav)) return;
            const items = nav.querySelectorAll('a, button, .nav-item, .menu-item, .sidebar-item');
            if (items.length > 0) {
                resultado.menus.push({
                    container: obterSeletor(nav),
                    items: Array.from(items).slice(0, 15).map(item => ({
                        texto: item.textContent.trim().substring(0, 40),
                        href: item.href ? item.getAttribute('href') : '',
                        ativo: item.classList.contains('active') || item.classList.contains('selected')
                    }))
                });
            }
        });

        // Links
        const allLinks = document.querySelectorAll('a[href]');
        allLinks.forEach(a => {
            if (isInspetor(a)) return;
            const rect = a.getBoundingClientRect();
            if (rect.width === 0) return;
            resultado.links.push({
                texto: a.textContent.trim().substring(0, 40) || '[sem texto]',
                href: a.getAttribute('href')?.substring(0, 50) || ''
            });
        });

        // Seções
        const secoes = document.querySelectorAll('section, [role="tabpanel"], .panel, .page, .view, .screen');
        secoes.forEach(sec => {
            if (isInspetor(sec)) return;
            const cs = window.getComputedStyle(sec);
            const visivel = cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
            const heading = sec.querySelector('h1, h2, h3, h4, .title');
            resultado.secoes.push({
                seletor: obterSeletor(sec),
                titulo: heading ? heading.textContent.trim().substring(0, 40) : '',
                visivel
            });
        });

        return resultado;
    }

    function gerarTextoNavegacao(nav) {
        let txt = 'MAPA DE NAVEGAÇÃO\n\n';
        if (nav.tabs.length > 0) {
            txt += 'TABS:\n';
            nav.tabs.forEach(g => {
                txt += `  ${g.container}: ${g.items.map(i => i.texto + (i.ativo ? ' [ATIVO]' : '')).join(' | ')}\n`;
            });
        }
        if (nav.menus.length > 0) {
            txt += '\nMENUS:\n';
            nav.menus.forEach(m => {
                txt += `  ${m.container}:\n`;
                m.items.forEach(i => { txt += `    ${i.ativo ? '● ' : '  '}${i.texto}${i.href ? ' → '+i.href : ''}\n`; });
            });
        }
        if (nav.secoes.length > 0) {
            txt += '\nSEÇÕES:\n';
            nav.secoes.forEach(s => {
                txt += `  ${s.seletor}${s.titulo ? ' — "'+s.titulo+'"' : ''} (${s.visivel ? 'visível' : 'oculta'})\n`;
            });
        }
        return txt;
    }

    // =========================================================
    // TOOL 6: HEATMAP
    // =========================================================

    function renderHeatmap() {
        let html = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
                <h3 style="margin: 0 0 8px; font-size: 16px;">Heatmap Visual</h3>
                <p style="color: ${CONFIG.cores.textoMuted}; font-size: 13px; margin: 0 0 20px;">
                    Colore e numera os principais blocos da página.
                </p>
                <button id="btn-gerar-heatmap" style="
                    background: ${CONFIG.cores.accent}; border: none; color: white;
                    padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600;
                    cursor: pointer;
                ">Gerar Heatmap</button>
            </div>
        `;

        elConteudo.innerHTML = html;
        document.getElementById('btn-gerar-heatmap').addEventListener('click', gerarHeatmap);
    }

    function gerarHeatmap() {
        limparHeatmap();

        // Minimizar modal para ver a página
        elModal.style.display = 'none';
        elOverlayModal.style.display = 'none';
        elBtnFlutuante.style.display = 'block';
        elBtnFlutuante.innerHTML = '✕ Fechar Heatmap';
        elBtnFlutuante.style.background = CONFIG.cores.vermelho;
        elBtnFlutuante.style.boxShadow = '0 3px 12px rgba(239,68,68,0.4)';
        state.heatmapAtivo = true;

        // Encontrar blocos principais
        const blocos = encontrarBlocosPrincipais();
        const cores = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#f43f5e','#14b8a6','#a855f7','#6366f1','#d946ef','#0ea5e9','#84cc16','#f59e0b'];

        const legenda = [];
        const overlays = []; // referências para toggle individual

        blocos.forEach((bloco, i) => {
            const cor = cores[i % cores.length];
            const rect = bloco.el.getBoundingClientRect();

            const overlay = document.createElement('div');
            overlay.className = 'inspetor-heatmap-overlay';
            overlay.dataset.blocoIdx = i;
            overlay.style.cssText = `
                position: fixed; z-index: ${CONFIG.zIndex.highlight};
                top: ${rect.top}px; left: ${rect.left}px;
                width: ${rect.width}px; height: ${rect.height}px;
                background: ${cor}22; border: 2px solid ${cor};
                pointer-events: none; display: none; align-items: flex-start; justify-content: flex-start;
            `;
            overlay.innerHTML = `<span style="
                background: ${cor}; color: white; font-size: 12px; font-weight: 700;
                padding: 2px 8px; border-radius: 0 0 6px 0; font-family: system-ui;
            ">${i + 1}</span>`;

            document.body.appendChild(overlay);
            state.heatmapOverlays.push(overlay);
            overlays.push(overlay);

            legenda.push({
                num: i + 1,
                cor,
                seletor: obterSeletor(bloco.el),
                largura: Math.round(rect.width),
                altura: Math.round(rect.height),
                ativo: false
            });
        });

        // Mostrar legenda como painel clicável
        const legendaPanel = document.createElement('div');
        legendaPanel.className = 'inspetor-heatmap-overlay';
        legendaPanel.style.cssText = `
            position: fixed; z-index: ${CONFIG.zIndex.modal}; bottom: 70px; right: 20px;
            background: ${CONFIG.cores.bg}; border: 1px solid ${CONFIG.cores.borda};
            border-radius: 12px; padding: 12px; max-height: 50vh; overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4); font-family: system-ui; width: 280px;
        `;
        let legendaHtml = `<div style="font-size:11px;color:${CONFIG.cores.amarelo};text-transform:uppercase;margin-bottom:8px;font-weight:600;">Heatmap (${legenda.length} blocos) — clique para destacar</div>`;
        legenda.forEach((l, i) => {
            legendaHtml += `<div class="heatmap-legenda-item" data-idx="${i}" style="display:flex;align-items:center;gap:6px;padding:6px 8px;font-size:11px;cursor:pointer;border-radius:6px;transition:background 0.15s;margin-bottom:2px;">
                <span style="background:${l.cor};color:white;width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;flex-shrink:0;">${l.num}</span>
                <span style="color:${CONFIG.cores.texto};word-break:break-all;flex:1;">${l.seletor}</span>
                <span style="color:${CONFIG.cores.textoMuted};flex-shrink:0;font-size:10px;">${l.largura}×${l.altura}</span>
            </div>`;
        });
        legendaHtml += `<button onclick="document.getElementById('btn-inspetor-v2').click();" style="
            width:100%;margin-top:10px;padding:8px;background:${CONFIG.cores.accent};border:none;color:white;
            border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;
        ">Voltar ao Mapa UI</button>`;
        legendaPanel.innerHTML = legendaHtml;
        document.body.appendChild(legendaPanel);
        state.heatmapOverlays.push(legendaPanel);

        // Click handlers nos itens da legenda
        legendaPanel.querySelectorAll('.heatmap-legenda-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.idx);
                const overlay = overlays[idx];
                const l = legenda[idx];
                l.ativo = !l.ativo;

                if (l.ativo) {
                    overlay.style.display = 'flex';
                    item.style.background = CONFIG.cores.bgHover;
                    item.style.boxShadow = `inset 3px 0 0 ${l.cor}`;
                } else {
                    overlay.style.display = 'none';
                    item.style.background = 'transparent';
                    item.style.boxShadow = 'none';
                }
            });

            item.addEventListener('mouseenter', () => {
                const idx = parseInt(item.dataset.idx);
                if (!legenda[idx].ativo) item.style.background = CONFIG.cores.bgHover;
            });
            item.addEventListener('mouseleave', () => {
                const idx = parseInt(item.dataset.idx);
                if (!legenda[idx].ativo) item.style.background = 'transparent';
            });
        });

        showToast(`Heatmap: ${legenda.length} blocos — clique na legenda para destacar`);
    }

    function encontrarBlocosPrincipais() {
        const candidatos = document.querySelectorAll('header, nav, main, section, article, aside, footer, [role="banner"], [role="main"], [role="contentinfo"]');
        let blocos = [];

        // Primeiro: elementos semânticos
        candidatos.forEach(el => {
            if (isInspetor(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 30) return;
            if (rect.top > window.innerHeight * 2) return; // Muito abaixo
            blocos.push({ el, area: rect.width * rect.height });
        });

        // Se poucos, adicionar divs grandes com id ou class
        if (blocos.length < 5) {
            const divs = document.querySelectorAll('div[id], div[class]');
            divs.forEach(el => {
                if (isInspetor(el)) return;
                if (blocos.some(b => b.el === el || b.el.contains(el) || el.contains(b.el))) return;
                const rect = el.getBoundingClientRect();
                if (rect.width < 100 || rect.height < 50) return;
                if (rect.top > window.innerHeight * 2) return;
                blocos.push({ el, area: rect.width * rect.height });
            });
        }

        // Remover sobreposições (se um contém o outro, manter o menor)
        blocos.sort((a, b) => a.area - b.area);
        const filtrado = [];
        blocos.forEach(b => {
            const jaContido = filtrado.some(f => f.el.contains(b.el));
            if (!jaContido) filtrado.push(b);
        });

        return filtrado.slice(0, 16).sort((a, b) => {
            const ra = a.el.getBoundingClientRect();
            const rb = b.el.getBoundingClientRect();
            return ra.top - rb.top || ra.left - rb.left;
        });
    }

    function limparHeatmap() {
        state.heatmapOverlays.forEach(el => el.remove());
        state.heatmapOverlays = [];
        state.heatmapAtivo = false;
    }

    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    function init() {
        if (!isDesktop()) {
            console.log('Mapa UI v2: Mobile detectado, desativado.');
            return;
        }

        criarBotaoFlutuante();
        criarHighlight();
        criarModal();

        // Fechar com ESC
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (state.inspetorAtivo) {
                    desativarInspetor();
                    abrirModal();
                } else if (state.heatmapAtivo) {
                    limparHeatmap();
                    abrirModal();
                } else if (state.modalAberto) {
                    fecharModal();
                }
            }
        });

        // Interceptar clique no botão flutuante quando heatmap ativo
        const originalToggle = toggleModal;
        elBtnFlutuante.removeEventListener('click', toggleModal);
        elBtnFlutuante.addEventListener('click', () => {
            if (state.inspetorAtivo) {
                desativarInspetor();
                abrirModal();
                renderInspetor();
            } else if (state.heatmapAtivo) {
                limparHeatmap();
                abrirModal();
            } else {
                toggleModal();
            }
        });

        console.log('Mapa UI v2.0 carregado — clique no botão para abrir');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
